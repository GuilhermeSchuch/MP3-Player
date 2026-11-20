# AI Context: EchoDeck

This file is the working context for AI agents modifying this repository. Treat the current source code as authoritative when it differs from older documentation or historical commits.

## Handoff status

EchoDeck 3.3.0 adds automatic lyrics lookup. EchoDeck 3.4.0 also restores the last master volume, including mute, from the numeric volume entry in config.json. The package, lockfile, and visible footer report **3.5.0**.

Recent delivered behavior includes saved window position, working Play on startup, smooth active-song scrolling, played-song fading with per-run reset, and teal keyboard-focus indicators on control buttons and sliders.

The latest locally generated Windows x64 installer is `out/installer/EchoDeck-Setup-3.2.0-e0a57a1.exe`. It contains the newer focus fix and shares version 3.2.0 with the earlier `EchoDeck Setup-3.2.0.exe`. Identify these builds by source commit and filename. Build outputs are ignored by Git and may be absent in another checkout.

## Project purpose

EchoDeck is a small Windows-focused Electron desktop application for playing local `.mp3` files. Its core goals are:

- Play a user’s local MP3 files with previous, next, pause/play, restart, seek, and volume controls.
- Persist named playlists across application restarts without copying, moving, or deleting the user’s audio files.
- Keep missing playlist entries visible and let the user locate a replacement file or remove the entry explicitly.
- Support shuffle playback and automatic looping of the active playlist.
- Persist per-song dB gain so songs with different loudness can be normalized individually.
- Support English and Portuguese UI labels.
- Expose the application as “EchoDeck” to media-session-aware Windows surfaces.
- Publish the current song through Discord Rich Presence when Discord is running.
- Restore the last window position across launches, including secondary monitors.
- Highlight the current song in teal and fade previously played songs to gray within each playlist run.

Playback and playlists are local. Opening Lyrics enables online lookup through LRCLIB. It has no cloud sync, accounts, shared playlists, metadata editor, audio library manager, or drag-and-drop playlist ordering.

## Technology and runtime

- Electron 29.
- Vanilla HTML, CSS, and browser JavaScript in the renderer.
- Node.js CommonJS modules in the main process, preload, storage module, and tests.
- Electron Builder 26 with NSIS for the Windows x64 setup wizard, configured in `package.json`.
- Electron Forge for development, alternative packaging, and the older maker configuration.
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
npm run make             # Build the Windows x64 NSIS setup wizard
npm run forge-make       # Run the older Forge makers
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

For a fresh checkout, install the locked dependencies with `npm ci`. Windows installer generation uses `npm run make` and writes `out/installer/EchoDeck Setup-<version>.exe`. NSIS is configured with `oneClick: false`, an installation-directory choice, desktop and Start menu shortcuts, and launch after finishing.

To distinguish a rebuild of the same version, an artifact-name override can identify its source commit, as used for the latest local build.

```text
npm run make -- --config.nsis.artifactName=EchoDeck-Setup-3.2.0-e0a57a1.exe
```

The NSIS configuration lives in `package.json`; Forge-specific makers and fuses live in `forge.config.js`. Verify the build command and executable version before reporting an installer ready. Installer builds can download Electron and packaging tools.

## Versioning

For every user-requested app change, increment the release version in `package.json`, the top-level `version` and `packages[""].version` in `package-lock.json`, and the version shown in the app footer (`src/index.html`) to the same value. Use patch increments for fixes, minor increments for features, and major increments for breaking changes unless the user gives an exact version. The installer filename is generated from the package version. Documentation-only edits retain the application version.

## Repository map

```text
main.js                         Electron main process and IPC handlers
preload.js                      Narrow contextBridge API exposed to the renderer
forge.config.js                 Electron Forge packaging, makers, and fuses
package.json                    Scripts, Electron dependencies, Builder/NSIS configuration
README.md                       User-facing project summary and keyboard shortcuts
AI_CONTEXT.md                   Agent handoff, architecture, persistence, and verification
.env.example                    Placeholder Discord application ID configuration

src/index.html                  Main application markup
src/css/styles.css              Compact 500x700-oriented application styling
src/js/renderer.js              UI state, settings, playlist flow, and playback
src/js/playlist-model.js        Pure playlist document model; browser + CommonJS
src/js/playlist-storage.js      Main-process filesystem persistence and path inspection
src/js/discord-presence.js      Discord IPC transport and activity/timestamp payloads
src/assets/                     Control icons, EchoDeck logo, and demo image
src/fonts/                      Madimi font and license text

tests/playlist-model.test.js    Pure model and playback-queue tests
tests/playlist-storage.test.js  Filesystem persistence/path inspection tests
tests/discord-presence.test.js  Activity payload, timestamp, and IPC framing tests
tests/renderer-dialogs.test.js  Guard against unsupported browser modal APIs
tests/renderer-playback.test.js Renderer startup, shuffle, and played-song state tests
tests/window-position.test.js   Main-process position persistence/fallback tests
renderer-scroll.test.js         Renderer active-row top-alignment test

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

The main process selects the settings and playlist directory at startup. It normally uses Electron’s `app.getPath("userData")`. If `%APPDATA%/MP3 Player` contains `config.json` or `playlists.json`, and the current directory contains neither file, it uses that legacy directory for both files. This preserves existing data after the EchoDeck rename.

The general settings array is stored in `config.json`.

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

The main process stores a separate versioned document in `playlists.json` in the selected settings directory.

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
- `playlist-model.normalizePath()` converts backslashes to forward slashes, collapses repeated separators, and lowercases path text for comparisons. Storage preserves the original path.
- Duplicate paths are rejected within one playlist, including Windows slash/case variants.
- Missing playlist files or invalid JSON recover to an empty document and are logged when a logger is supplied.
- Saving normalizes the document before writing it.
- Deleting a playlist or song never deletes a file from disk.

### Lyrics

The renderer requests lyrics by song ID and duration through preload. The main process resolves the saved track and uses src/js/lyrics.js to read ID3 metadata and query LRCLIB. Successful matches are stored under userData in lyrics-cache/. The renderer highlights lines using the audio clock and discards superseded responses.

### Window position

`window-position.json` contains `{ "x": number, "y": number }` in `configuredUserDataPath`, which is Electron's current `userData` directory even when config/playlists use the legacy path. The window's `close` handler saves `getNormalBounds()` coordinates, preserving the normal position when minimized.

`loadWindowPosition(width)` accepts safe integer coordinates, including negative coordinates for monitors left of or above the primary display. It restores a position when the title-bar midpoint is inside a connected display's work area. Missing, invalid, or off-screen positions fall back to Electron's default centered placement. The normal window is fixed at 500×700, with a wider window when `isDev` is enabled in `main.js`.

## IPC API

`preload.js` exposes these methods:

```js
window.electronAPI.loadConfig()
window.electronAPI.saveConfig(config)
window.electronAPI.loadPlaylists()
window.electronAPI.savePlaylists(document)
window.electronAPI.inspectPlaylistSongs(songs)
window.electronAPI.updateDiscordPresence(activity)
window.electronAPI.clearDiscordPresence()
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
2. Clear `audioObj.audioFiles`, `audioObj.indexBySongId`, `currentAudioIndex`, and `playedSongIds`.
3. Inspect the selected playlist’s paths.
4. Render all records, including missing ones.
5. Build the new queue from existing records only.
6. Refresh the per-song gain control and playback-button enabled state.

Automatic looping is implemented by `playIncomingSong()`. Ordered playback wraps to zero after the final queue entry and starts a fresh run. In shuffle mode, `chooseShuffledSongIndex()` chooses among queue entries whose IDs are absent from `playedSongIds`. Once that pool is exhausted, it clears the set and chooses the first song of a new run. Missing entries are excluded from the playable queue.

`playedSongIds` is session-only state. `playCurrentSong()` records each song ID when playback starts, including manually selected songs and Previous navigation. A skipped or partially heard song therefore counts as played. `syncSongRowStates()` applies `songPlaying` to the current row and `songPlayed` to other recorded IDs. The current row stays teal and played rows use gray `#a7adb5`. Row re-rendering reapplies these classes. Ordered forward wrap, shuffle exhaustion, and active-playlist reload clear the set. Reopening the app starts a fresh run.

`scrollToCurrentSong()` uses stable row IDs and `scrollIntoView({ block: "start", behavior: "smooth" })` to align the active song at the top as far as the list's scroll range permits.

## Renderer responsibilities and flow

### Startup

`initializeApp()` loads settings, applies the saved language, parses shuffle state, loads the persisted playlist document, inspects the active playlist, and builds its playable queue.

Loading a playlist shows Play and disables playback controls while inspection runs. Play becomes enabled when there are playable songs and creates the first audio element, honoring shuffle. Keep the distinction between a loaded queue and a mounted audio element. `playSongAtIndex(0)` must be allowed before audio exists even though `currentAudioIndex` starts at zero. After playback starts, the shared control displays Pause.

### Import

The Select Songs control creates/names a playlist first when none is active, then opens the hidden multi-file input. With an active playlist, it opens the picker directly. `handlePlaylistImport()`:

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

Names, messages, and confirmations use the application's `showDialog()` overlay. Electron does not support `window.prompt()`; use `requestTextDialog()`, `showMessageDialog()`, and `showConfirmDialog()` for these flows.

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

`setMediaSessionIdentity(song)` sets the song title, EchoDeck artist, and active playlist album in Media Session metadata. The HTML title, Electron app name, and Windows app ID also identify EchoDeck.

The renderer sends the song title, paused state, and HTML audio position to the main-process Discord IPC adapter. The activity uses Playing type (`0`) with `timestamps.start = Math.floor(nowMs / 1000 - positionSeconds)` while playing. Updates occur on track changes, seeks, restarts, and resumes. Paused updates omit timestamps and set `state: "Paused"`. The current implementation uses an elapsed timer. Verify behavior in the real Discord desktop client when modifying it.

The Discord payload contains the song title and EchoDeck branding. Its `large_image` key is `logo_1_1_`, matching the uploaded asset in the Discord Developer Portal. The repository logo is `src/assets/echodeck-logo.png`. The adapter implements Discord IPC directly using `node:net` and searches Windows pipes `discord-ipc-0` through `discord-ipc-9`.

`main.js` reads `DISCORD_CLIENT_ID` from the process environment first, then `.env` beside `main.js` via `__dirname`. A fresh checkout can use `.env.example`. Preserve the ignored local `.env` and verify packaged configuration availability when generating installers. Connection failures are tolerated and may log an unavailable message. Tests cover payloads and framing rather than a live Discord session.

### Focus styling

The focus rules cover all `button` elements and `.controls input[type="range"]`. Their focus outline is suppressed and `:focus-visible` adds a teal underline with `box-shadow`. Keep buttons and sliders keyboard-focusable when changing these styles.

## Global shortcuts

Global shortcuts are registered in `main.js` and forwarded to the renderer. The view toggle uses a dedicated IPC event.

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
| Ctrl/Cmd + num0 | Switch between Playlist and Lyrics |

## Testing strategy

The suite currently contains 36 tests and runs with `npm test`. It covers pure model/storage behavior and executes main/renderer code in Node VM contexts using Electron, DOM, and audio test doubles.

- `tests/playlist-model.test.js` covers schema normalization, playlist operations, duplicate paths, missing-song filtering, and stable playback queue mappings.
- `tests/playlist-storage.test.js` covers missing/invalid JSON recovery, save/load round trips, existing/missing path inspection, and file URLs.
- `tests/discord-presence.test.js` covers handshake, activity privacy, pause/resume/seek timestamps, framing, and Windows pipe names.
- `tests/renderer-playback.test.js` exercises the real renderer startup and event handlers for Play, shuffle, first-row selection, played-song classes, and ordered/shuffled run reset.
- `tests/window-position.test.js` exercises main-process startup and close persistence with temporary storage and simulated displays.
- `renderer-scroll.test.js` covers active-row top-alignment requests.
- `tests/renderer-dialogs.test.js` guards against unsupported browser modal API calls.

Update the tests at the layer affected by a change. The VM tests exercise application logic with doubles. Browser focus appearance, actual audio output, native display behavior, and live Discord rendering require runtime checks for changes affecting those surfaces.

Recommended final verification:

```text
npm test
node --check main.js
node --check preload.js
node --check src/js/playlist-model.js
node --check src/js/playlist-storage.js
node --check src/js/renderer.js
node --check src/js/discord-presence.js
git diff --check
npm run make             # When an installer is requested
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
9. Keep lyrics lookup scoped to the open Lyrics view and keep playlist looping automatic.
10. Consider maintenance and installer impact before adding dependencies, and reuse the existing platform APIs where suitable.
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
