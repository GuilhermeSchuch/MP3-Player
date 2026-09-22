# AI Context: MP3 Player

This file is the working context for AI agents modifying this repository. Treat the current source code as authoritative when it differs from older documentation or historical commits.

## Project purpose

MP3 Player is a small Windows-focused Electron desktop application for playing local `.mp3` files. Its core goals are:

- Play a user’s local MP3 files with previous, next, pause/play, restart, seek, and volume controls.
- Persist named playlists across application restarts without copying, moving, or deleting the user’s audio files.
- Keep missing playlist entries visible and let the user locate a replacement file or remove the entry explicitly.
- Support shuffle playback and automatic looping of the active playlist.
- Persist per-song dB gain so songs with different loudness can be normalized individually.
- Support English and Portuguese UI labels.
- Expose the application as “MP3 Player” to media-session-aware Windows surfaces.

The application is intentionally local-only. It has no cloud sync, accounts, shared playlists, metadata editor, audio library manager, or drag-and-drop playlist ordering.

## Technology and runtime

- Electron 29.
- Vanilla HTML, CSS, and browser JavaScript in the renderer.
- Node.js CommonJS modules in the main process, preload, storage module, and tests.
- Electron Forge for packaging.
- Node’s built-in `node:test` runner; there is no Jest, Vitest, TypeScript, or lint configuration.
- Web Audio API is used for the per-song gain pipeline.
- Windows is the primary target. The project includes Forge makers for Squirrel, ZIP/darwin, Debian, and RPM, but behavior has primarily been designed and tested around Windows.

## Important commands

Run from the repository root:

```text
npm test                 # Run all Node tests
npm start                # Start with Electron Forge
npm run electron         # Start Electron through nodemon
npm run package          # Package the app with Electron Forge
npm run make             # Build distributable installers/artifacts
```

Useful focused checks:

```text
node --check main.js
node --check preload.js
node --check src/js/playlist-model.js
node --check src/js/playlist-storage.js
node --check src/js/renderer.js
git diff --check
```

`out/` and `node_modules/` are ignored. Packaging writes into `out/`.

## Repository map

```text
main.js                         Electron main process and IPC handlers
preload.js                      Narrow contextBridge API exposed to the renderer
forge.config.js                 Electron Forge packaging, makers, and fuses
package.json                    Scripts and Electron dependencies
README.md                       User-facing project summary and keyboard shortcuts

src/index.html                  Main application markup
src/css/styles.css              Compact 500x700-oriented application styling
src/js/renderer.js              UI state, settings, playlist flow, and playback
src/js/playlist-model.js        Pure playlist document model; browser + CommonJS
src/js/playlist-storage.js      Main-process filesystem persistence and path inspection
src/assets/                     Control icons and demo image
src/fonts/                      Madimi font and license text

tests/playlist-model.test.js    Pure model and playback-queue tests
tests/playlist-storage.test.js  Filesystem persistence/path inspection tests

docs/superpowers/specs/         Design rationale for persistent playlists
docs/superpowers/plans/         Implementation plan and completed task record
```

## Process architecture

The application has three layers:

1. `main.js` owns the Electron window, global shortcuts, configuration file access, playlist file access, and filesystem inspection.
2. `preload.js` exposes a deliberately small `window.electronAPI` bridge through `contextBridge`.
3. `src/js/renderer.js` owns DOM state, UI interactions, playback, Web Audio gain, language labels, and playlist state.

The renderer must not access arbitrary Node filesystem APIs. Filesystem work belongs in `main.js`/`playlist-storage.js`, and new renderer capabilities should normally be added as a narrowly scoped preload IPC method.

`src/index.html` loads `src/js/playlist-model.js` before `src/js/renderer.js`, because the renderer initializes its playlist state from the browser-global `playlistModel`.

## Persistence contracts

### General settings: `config.json`

The main process stores general settings in Electron’s `app.getPath("userData")` directory:

```js
[
  { "name": "shuffle", "text": "Aleatório", "value": false },
  { "name": "language", "text": "Idioma", "value": "pt" },
  { "name": "songGains", "text": "Ganhos por música", "value": {} }
]
```

The renderer normalizes settings to the supported defaults (`shuffle` and `language`) and preserves the separate `songGains` object when saving. Do not reintroduce removed lyrics or loop settings into this schema. Playlist looping is automatic and is not a user setting.

Per-song gain is currently keyed by the song filename (`song.name`), not by playlist ID, song ID, or absolute path. Preserve that behavior unless a deliberate migration is designed.

### Playlists: `playlists.json`

The main process stores a separate versioned document in the same user-data directory:

```json
{
  "version": 1,
  "activePlaylistId": "playlist-id",
  "playlists": [
    {
      "id": "playlist-id",
      "name": "Workout",
      "songs": [
        {
          "id": "song-id",
          "name": "Artist - Song.mp3",
          "path": "C:\\Music\\Artist - Song.mp3"
        }
      ]
    }
  ]
}
```

Persisted playlist songs contain only `id`, `name`, and `path`. Runtime inspection adds `exists` and `url`; those fields must not be treated as persisted schema fields.

Behavioral rules:

- Absolute paths are stored as the source of truth.
- `playlist-model.normalizePath()` lowercases separators and path text for comparisons, while the original path is preserved for storage.
- Duplicate paths are rejected within one playlist, including Windows slash/case variants.
- Missing playlist files or invalid JSON recover to an empty document and are logged when a logger is supplied.
- Saving normalizes the document before writing it.
- Deleting a playlist or song never deletes a file from disk.

## IPC API

`preload.js` exposes these methods:

```js
window.electronAPI.loadConfig()
window.electronAPI.saveConfig(config)
window.electronAPI.loadPlaylists()
window.electronAPI.savePlaylists(document)
window.electronAPI.inspectPlaylistSongs(songs)
window.electronAPI.getFilePath(file)
```

`getFilePath(file)` uses Electron `webUtils.getPathForFile(file)`. Do not use the deprecated `File.path` property in renderer code.

`inspectPlaylistSongs(songs)` checks `fs.existsSync(song.path)` and returns each song with:

```js
{
  id,
  name,
  path,
  exists: boolean,
  url: "file:///..." | null
}
```

Only existing files receive a file URL. The renderer uses a newly imported `File` object for the current session when available, and the inspected `url` for restored songs.

## Playlist and playback model

`playlistDocument` is the normalized persisted document. `activePlaylistSongs` is the currently displayed, inspected list and may contain missing records. `audioObj.audioFiles` is a separate playable queue containing only valid existing songs.

This distinction is essential:

```text
display rows:  [valid A, missing B, valid C]
playback queue: [valid A, valid C]
queue indexes:  A -> 0, C -> 1
row identity:   data-song-id, never DOM index
```

`playlistModel.buildPlaybackQueue()` returns both the playable records and an `indexBySongId` map. Never use `playlist.children[currentAudioIndex]` to identify the currently playing row; missing rows make that index invalid. Use the stable song ID and `getSongRow()` in the renderer.

When a playlist loads or changes, the renderer must:

1. Pause and dismount the current audio element/Web Audio nodes.
2. Clear `audioObj.audioFiles`, `audioObj.indexBySongId`, `currentAudioIndex`, and shuffle history.
3. Inspect the selected playlist’s paths.
4. Render all records, including missing ones.
5. Build the new queue from existing records only.
6. Refresh the per-song gain control and playback-button enabled state.

Automatic looping is implemented by `playIncomingSong()`: the next index wraps to zero at the end of the queue. In shuffle mode, the random history is used to choose unplayed queue indexes and resets after the queue has been exhausted. Missing records never enter this sequence.

## Renderer responsibilities and flow

### Startup

`initializeApp()` loads settings, applies the saved language, parses shuffle state, loads the persisted playlist document, inspects the active playlist, and builds its playable queue.

### Import

The Select Songs control triggers a hidden multi-file input. `handlePlaylistImport()`:

1. Filters for MP3 files.
2. Creates a playlist on first import if none exists.
3. Converts each selected file to `{id, name, path}` through `getFilePath()`.
4. Adds songs through the pure model, which deduplicates normalized paths.
5. Saves the playlist document.
6. Reloads and inspects the active playlist.

### Playlist management

- New prompts for a trimmed non-empty name, creates/selects it, saves, and opens the import picker.
- Rename prompts for a non-empty name and saves the active playlist.
- Delete confirms, removes the selected playlist, saves, and loads the next valid active playlist or empty state.
- The selector saves the chosen `activePlaylistId` before reloading the queue.

### Missing files

Missing rows are visually distinct and cannot start playback. Locate opens a one-file MP3 picker and changes only the selected song record after validation. Cancelled or invalid selection leaves the original record untouched. Remove asks for confirmation and removes only that playlist record.

### Settings and language

Settings are generated dynamically by `buildSettingsElement()`. The current supported settings are:

- Shuffle checkbox.
- Language selector with `en` and `pt`.

Translations live in the `translations` object in `renderer.js`. Static labels use `data-i18n`; dynamically created controls must call `translate()` when built or refreshed. Language changes rebuild the settings element and refresh playlist labels without replacing the settings UI unexpectedly.

### Gain and audio

`mountSongElement(song)` accepts either:

- An imported runtime record with `song.file`, using `URL.createObjectURL(song.file)`.
- A restored record with `song.url`, using the file URL returned by the main process.

The Web Audio graph is `HTMLAudioElement -> MediaElementSource -> GainNode -> AudioContext.destination`. Gain values are dB values from `-12` to `+12` in `0.5` dB steps and are converted with `dbToLinear()` before being applied. `saveSongGain()` persists the value under the song filename.

`setMediaSessionIdentity()` sets Media Session metadata to “MP3 Player” so external Windows surfaces identify the app rather than showing `index.html`.

## Global shortcuts

Global shortcuts are registered in `main.js` and forwarded to renderer key events:

| Shortcut | Action |
| --- | --- |
| Ctrl/Cmd + num9 | Next song |
| Ctrl/Cmd + num8 | Toggle pause/play |
| Ctrl/Cmd + num7 | Previous song |
| Ctrl/Cmd + num6 | Forward one second |
| Ctrl/Cmd + num5 | Restart song |
| Ctrl/Cmd + num4 | Back one second |
| Ctrl/Cmd + num3 | Volume up |
| Ctrl/Cmd + num2 | Mute |
| Ctrl/Cmd + num1 | Volume down |

## Testing strategy

Tests are intentionally DOM-free and focus on deterministic boundaries:

- `tests/playlist-model.test.js` covers schema normalization, playlist operations, duplicate paths, missing-song filtering, and stable playback queue mappings.
- `tests/playlist-storage.test.js` covers missing/invalid JSON recovery, save/load round trips, existing/missing path inspection, and file URLs.

When changing playlist behavior, add or update a pure model/storage test before changing renderer code. Renderer behavior can then be verified with syntax checks and a packaged/app smoke test.

Recommended final verification:

```text
npm test
node --check main.js
node --check preload.js
node --check src/js/playlist-model.js
node --check src/js/playlist-storage.js
node --check src/js/renderer.js
git diff --check
npm run package
```

## Change guidelines for future AIs

1. Read this file, `README.md`, and the relevant source/tests before editing.
2. Preserve existing user changes and do not revert unrelated work.
3. Keep playlist transformations pure in `playlist-model.js`; do not put DOM or Electron calls there.
4. Keep filesystem access in the main process/storage module and expose only narrow preload methods.
5. Preserve the distinction between displayed playlist records and the playable queue.
6. Use stable playlist/song IDs and normalized paths; never use row indexes as persistent identity.
7. Never delete or modify user MP3 files as part of playlist operations.
8. Preserve `config.json` compatibility and the filename-keyed gain behavior unless a migration is explicitly planned.
9. Do not re-add lyrics features or a configurable loop setting; both were intentionally removed.
10. Avoid runtime dependencies unless the user explicitly approves the added maintenance and packaging impact.
11. Keep the compact 500x700 UI usable; test long playlist names, missing rows, and Portuguese labels.
12. Add tests for model/storage changes and run the full verification commands before claiming completion.

## Known boundaries and maintenance notes

- Playlist persistence is local and path-based. Moving an MP3 makes the row missing until the user locates it.
- The gain store is filename-keyed, so two files with the same filename share a gain entry even if their paths differ.
- Playlist ordering is import order; there is currently no reorder UI.
- Playlist names are trimmed but not otherwise required to be unique.
- The renderer uses a hidden audio list for the mounted audio element; do not remove that element without replacing the gain/playback graph.
- `main.js` still uses straightforward synchronous config file reads/writes. Keep changes conservative around startup and IPC because invalid general settings can affect renderer initialization.
- The Content Security Policy currently allows `'unsafe-inline'`; tightening it would require checking all renderer behavior and should be handled as a separate security-focused change.
