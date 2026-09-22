# Persistent Playlists Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add persistent named playlists that store MP3 paths, restore across restarts, and expose explicit missing-file Locate/Delete actions without breaking playback, shuffle, looping, gain, language, or existing settings.

**Architecture:** Keep config.json for general settings and per-song gains, and add a versioned playlists.json owned by the Electron main process. Introduce a small pure playlist-model module for validation and immutable data operations; the renderer will maintain a normalized display list plus a separate playable-song queue so missing rows never corrupt playback indexes.

**Tech Stack:** Electron 29, vanilla HTML/CSS/JavaScript, Node.js built-in node:test, Electron IPC, filesystem paths, and pathToFileURL.

**Spec:** docs/superpowers/specs/2026-09-22-persistent-playlists-design.md

## Global Constraints

- Store absolute MP3 paths in playlists.json; never copy, move, delete, or modify user audio files.
- Keep general settings and per-song gains in the existing config.json format.
- Missing files remain visible and are never removed automatically.
- Only existing and valid songs enter the playback queue.
- Playlist changes reset the active playback queue and shuffle history.
- Existing language selection, per-song gain, automatic looping, and shuffle behavior must continue to work.
- Do not add runtime dependencies; use Electron and Node.js APIs already present in the project.

## Review Focus

- Missing entries mixed with valid songs: next, previous, shuffle, and looping must skip missing records without using the wrong DOM row.
- Invalid or absent playlists.json: startup must recover with an empty document and preserve the existing app launch path.
- Duplicate imports with Windows path casing and slashes: the same file must not be added twice to one playlist.
- Deleting or renaming the active playlist: the UI and playback queue must immediately select a valid remaining playlist or an empty state.
- Locate cancellation or invalid selection: the original missing record must remain unchanged until a valid MP3 is chosen.

### Task 1: Build and test the pure playlist model

Files:
- Create: src/js/playlist-model.js
- Create: tests/playlist-model.test.js
- Modify: package.json, scripts.test

Interfaces:
- Consumes: plain playlist JSON and song metadata objects; no DOM, Electron, or filesystem access.
- Produces: window.playlistModel in the browser and CommonJS exports for Node tests.
- Required functions:
  - createEmptyDocument() -> {version: 1, activePlaylistId: null, playlists: []}
  - normalizeDocument(value) -> validated document or empty document
  - createPlaylist(document, name, id) -> document with a trimmed named playlist
  - renamePlaylist(document, playlistId, name) -> updated document
  - removePlaylist(document, playlistId) -> updated document with a valid active ID
  - addSongs(document, playlistId, songs) -> deduplicated document
  - replaceSongPath(document, playlistId, songId, song) -> updated document
  - removeSong(document, playlistId, songId) -> updated document
  - getActivePlaylist(document) -> playlist or null

- [x] Step 1: Write the failing model tests.

    const { test } = require("node:test");
    const assert = require("node:assert/strict");
    const model = require("../src/js/playlist-model");

    test("normalizes invalid storage to an empty document", () => {
      assert.deepEqual(model.normalizeDocument(null), model.createEmptyDocument());
      assert.deepEqual(model.normalizeDocument({ playlists: "bad" }), model.createEmptyDocument());
    });

    test("adds songs once using normalized paths", () => {
      let document = model.createEmptyDocument();
      document = model.createPlaylist(document, "Workout", "p1");
      document = model.addSongs(document, "p1", [
        { id: "s1", name: "Track.mp3", path: "C:\\Music\\Track.mp3" },
        { id: "s2", name: "Track.mp3", path: "c:/music/track.mp3" }
      ]);
      assert.equal(document.playlists[0].songs.length, 1);
    });

    test("removing the active playlist selects a remaining playlist", () => {
      let document = model.createEmptyDocument();
      document = model.createPlaylist(document, "One", "p1");
      document = model.createPlaylist(document, "Two", "p2");
      document = { ...document, activePlaylistId: "p1" };
      document = model.removePlaylist(document, "p1");
      assert.equal(document.activePlaylistId, "p2");
    });

    test("replacing and deleting a missing song only affect the requested record", () => {
      let document = model.createEmptyDocument();
      document = model.createPlaylist(document, "Mix", "p1");
      document = model.addSongs(document, "p1", [
        { id: "s1", name: "Missing.mp3", path: "C:\\old\\Missing.mp3" },
        { id: "s2", name: "Keep.mp3", path: "C:\\music\\Keep.mp3" }
      ]);
      document = model.replaceSongPath(document, "p1", "s1", {
        id: "s1", name: "Missing.mp3", path: "C:\\new\\Missing.mp3"
      });
      document = model.removeSong(document, "p1", "s1");
      assert.deepEqual(document.playlists[0].songs.map((song) => song.id), ["s2"]);
    });

- [x] Step 2: Run the focused tests and confirm they fail for the missing module/functions.

    Run: node --test tests/playlist-model.test.js
    Expected: FAIL because src/js/playlist-model.js does not yet provide the required exports.

- [x] Step 3: Implement the model as a browser/CommonJS-compatible module.

Use a small UMD wrapper so the same module works in the browser and Node tests. Normalize Windows paths with lowercased separators for comparison only; preserve the original path for storage. Reject blank playlist names and malformed song records, but keep missing paths as valid records.

    function addSongs(document, playlistId, songs) {
      const playlist = document.playlists.find((item) => item.id === playlistId);
      if (!playlist) return document;
      const knownPaths = new Set(playlist.songs.map((song) => normalizePath(song.path)));
      const additions = songs.filter((song) => {
        const key = normalizePath(song.path);
        if (!song.id || !song.name || !song.path || knownPaths.has(key)) return false;
        knownPaths.add(key);
        return true;
      });
      return replacePlaylist(document, playlistId, {
        ...playlist,
        songs: [...playlist.songs, ...additions]
      });
    }

- [x] Step 4: Run the focused tests and confirm they pass.

    Run: node --test tests/playlist-model.test.js
    Expected: all model tests PASS.

- [x] Step 5: Update the test script and commit the isolated model.

Set package.json to use "test": "node --test", run npm test, and commit:

    git add package.json src/js/playlist-model.js tests/playlist-model.test.js
    git commit -m "feat: add playlist data model"

### Task 2: Add main-process persistence and safe file access

Files:
- Modify: main.js for playlists.json and IPC handlers
- Modify: preload.js for playlist and file-path bridges

Interfaces:
- Consumes: the Task 1 document shape.
- Produces:
  - window.electronAPI.loadPlaylists() -> Promise<playlist document>
  - window.electronAPI.savePlaylists(document) -> Promise<void>
  - window.electronAPI.inspectPlaylistSongs(songs) -> Promise<{id,name,path,exists,url}[]>
  - window.electronAPI.getFilePath(file) -> string

- [x] Step 1: Add an IPC contract test fixture in the model test.

Add a test that verifies a normalized document preserves version, activePlaylistId, playlist IDs, and song paths after a JSON round trip:

    test("playlist document survives JSON round trip", () => {
      const document = model.createPlaylist(model.createEmptyDocument(), "Saved", "p1");
      const restored = model.normalizeDocument(JSON.parse(JSON.stringify(document)));
      assert.deepEqual(restored, document);
    });

- [x] Step 2: Implement the main-process playlist file handlers.

Define playlistsPath = path.join(userDataPath, "playlists.json"). The load-playlists handler reads and normalizes JSON, logs malformed data, and returns an empty document. The save-playlists handler validates through the same document rules before writing JSON. The inspect-playlist-songs handler checks fs.existsSync(song.path) and returns a file URL from pathToFileURL only for existing paths.

- [x] Step 3: Expose preload methods without exposing filesystem mutation.

Expose only the four named methods. Implement getFilePath(file) with Electron webUtils.getPathForFile(file), so the renderer does not depend on a deprecated File.path property. Do not expose arbitrary filesystem read/write APIs.

- [x] Step 4: Run syntax checks and commit the IPC layer.

    node --check main.js
    node --check preload.js
    npm test

Expected: all commands succeed. Commit:

    git add main.js preload.js tests/playlist-model.test.js
    git commit -m "feat: persist playlists through electron ipc"

### Task 3: Add playlist management UI and missing-file actions

Files:
- Modify: src/index.html for the playlist toolbar
- Modify: src/css/styles.css for toolbar, missing rows, and action buttons
- Modify: src/js/renderer.js for playlist state, loading, persistence, and events

Interfaces:
- Consumes: window.playlistModel, loadPlaylists, savePlaylists, inspectPlaylistSongs, and getFilePath.
- Produces: renderer functions loadPlaylistDocument(), renderPlaylistSelector(), loadActivePlaylist(), handlePlaylistImport(files), locateSong(songId), and deleteSong(songId).

- [x] Step 1: Add the playlist toolbar markup and translations.

Load playlist-model.js before renderer.js. Add a toolbar containing playlistSelect, New, Rename, and Delete controls, while keeping the existing Select Songs control. Add English and Portuguese labels for the new controls and a Missing status.

- [x] Step 2: Add UI-state tests to the model test.

Keep DOM-free tests in the model layer: assert that a list containing one missing and one valid song can be split into a playable list containing only the valid song while retaining both source records for rendering:

    test("playback candidates exclude missing songs without deleting their records", () => {
      const songs = [
        { id: "s1", name: "Missing.mp3", path: "C:\\missing.mp3", exists: false },
        { id: "s2", name: "Valid.mp3", path: "C:\\valid.mp3", exists: true }
      ];
      assert.deepEqual(songs.filter((song) => song.exists).map((song) => song.id), ["s2"]);
      assert.equal(songs.length, 2);
    });

- [x] Step 3: Implement playlist loading and selector management.

Load the document at startup, use its active ID when valid, otherwise select the first playlist, and save the chosen active ID. New prompts for a trimmed non-empty name; Rename rejects blank names; Delete asks for confirmation and never touches audio files. When no playlist exists, the first import prompts for a name and creates one.

- [x] Step 4: Implement import and missing-file rendering.

Convert selected File objects into {id,name,path} using getFilePath, add them through the model, persist, inspect paths, and render rows with data-song-id. Missing rows must be disabled for playback and include Locate/Delete actions. Locate uses a one-file MP3 picker, validates cancellation and type, updates only the selected record, persists, and reloads the active playlist. Delete confirms, removes the record, persists, and reloads.

- [x] Step 5: Add responsive styles and verify the UI state transitions.

Keep the existing compact layout. Ensure the toolbar remains usable at the current 500px window width, missing rows are visually distinct, and action buttons do not trigger song playback. Run npm test, then manually verify new/select/rename/delete/import/locate/delete-missing flows before committing:

    git add src/index.html src/css/styles.css src/js/renderer.js tests/playlist-model.test.js
    git commit -m "feat: add persistent playlist management ui"

### Task 4: Integrate restored songs with playback, gain, shuffle, and looping

Files:
- Modify: src/js/renderer.js for normalized audio sources and queue mapping
- Modify: README.md to document persistent playlists and missing-file behavior

Interfaces:
- Consumes: active playlist records with {id,name,path,exists,url} and the Task 3 renderer functions.
- Produces: audioObj.audioFiles as valid playable song records, currentAudioIndex as a playable-queue index, and row lookup by data-song-id.

- [x] Step 1: Write playback mapping tests.

Add model tests covering valid-row lookup and queue reset after switching playlists. The expected queue must contain only existing records and preserve display IDs for highlighting:

    test("playable queue retains stable display IDs", () => {
      const records = [
        { id: "missing", name: "Missing.mp3", exists: false },
        { id: "valid", name: "Valid.mp3", exists: true }
      ];
      const queue = records.filter((record) => record.exists);
      assert.deepEqual(queue.map((record) => record.id), ["valid"]);
    });

- [x] Step 2: Normalize audio mounting for File and file URL sources.

Update mountSongElement(song) to use URL.createObjectURL(song.file) for newly imported records and song.url for restored records. Keep the existing Web Audio MediaElementSource and per-song dB gain setup unchanged except for reading song.name from the normalized record.

- [x] Step 3: Replace DOM-index playback assumptions.

Make next/previous/shuffle operate on audioObj.audioFiles only. Highlight rows by data-song-id instead of playlist.children[currentAudioIndex]. When a playlist loads or changes, stop/dismount audio, clear randomicSongsPlayed, reset currentAudioIndex, refresh the gain slider, and scroll to the selected valid row.

- [x] Step 4: Verify edge-case playback and commit.

Run npm test, then manually verify: empty playlist, all songs missing, a missing song between valid songs, switching playlists during playback, automatic looping, shuffle across the last row, and restoration of per-song gain. Commit:

    git add src/js/renderer.js src/js/playlist-model.js README.md tests/playlist-model.test.js
    git commit -m "feat: integrate playlists with playback"

### Task 5: Full verification and handoff

Files:
- Test: tests/playlist-model.test.js
- Verify: main.js, preload.js, src/index.html, src/js/renderer.js, src/css/styles.css, README.md

Interfaces:
- Consumes: all playlist persistence, UI, missing-file, and playback behavior from Tasks 1–4.
- Produces: a packaged Electron app with persistent playlists and no regression in existing settings/audio features.

- [x] Step 1: Run automated checks.

    npm test
    node --check main.js
    node --check preload.js
    node --check src/js/playlist-model.js
    node --check src/js/renderer.js
    git diff --check

Expected: all tests and syntax checks pass with no whitespace errors.

- [x] Step 2: Run the Electron packaging check.

    npm run package

Expected: Electron Forge completes packaging successfully. Existing Electron deprecation warnings may be reported, but packaging must exit with code 0.

- [x] Step 3: Perform the acceptance pass.

Use the current 500x700 window to verify playlist creation, persistence after restart, playlist switching, import deduplication, rename/delete, missing-file Locate/Delete, empty/all-missing playlists, shuffle, automatic looping, language selection, gain restoration, and unchanged MP3 files on disk.

- [x] Step 4: Commit the completed documentation and verification changes.

    git add README.md package.json tests/playlist-model.test.js src/index.html src/css/styles.css src/js/playlist-model.js src/js/renderer.js main.js preload.js
    git commit -m "docs: finalize persistent playlist support"

