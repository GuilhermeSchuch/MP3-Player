# Persistent Playlists Design

## Goal

Allow users to create, manage, and reopen named playlists in MP3 Player. Playlists persist across application restarts without copying or modifying the user’s MP3 files. Missing files remain visible and can be located again or removed explicitly.

## Scope and success criteria

- Users can create, select, rename, and delete playlists.
- Importing MP3 files adds them to the selected playlist.
- The selected playlist is restored after restarting the app.
- Songs are loaded from their saved filesystem paths.
- Missing songs remain visible, are not playable, and offer Locate and Delete actions.
- Shuffle, automatic looping, per-song gain, and language selection continue to work for the active playlist.
- Existing general settings and song gains are preserved.

Out of scope: copying audio into an application-managed library, cloud synchronization, playlists shared between users, drag-and-drop reordering, and metadata/tag editing.

## Persistence model

Add a dedicated `playlists.json` beside the existing user settings file. Keep playlists separate from `config.json`, which continues to hold general settings and per-song gains.

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

Playlist and song IDs are stable application-generated identifiers. A song’s saved path is the source of truth for locating it; normalized paths prevent duplicate imports into the same playlist. The existing gain store remains keyed by filename, matching the current behavior.

The main process owns playlist file access and exposes load/save operations through preload IPC. Saves should preserve the schema version and write the complete validated document. If the file is missing or invalid, the app starts with an empty playlist collection rather than failing to launch.

## User flow and UI

Add a compact playlist toolbar above the song list:

- A select control chooses the active playlist.
- New creates a playlist after asking for its name.
- Rename changes the selected playlist name.
- Delete asks for confirmation, then removes the playlist and its song references.
- The existing Select Songs action adds files to the active playlist.

On first import, when no playlist exists, the app asks for a playlist name and creates it before adding the selected files. Importing into an existing playlist keeps its current songs and skips duplicate paths.

Selecting a playlist replaces the current displayed song list with that playlist’s records and resets playback state to the first playable song. The selected playlist ID is saved so it can be restored at startup.

## Missing-file behavior

When a playlist loads, each song path is checked without interrupting startup.

- Existing songs appear and can be played normally.
- Missing songs stay in the list with a clear Missing label and disabled playback state.
- Locate opens a single-file picker filtered to MP3 files. On success, it updates that song record’s path and refreshes the row.
- Delete removes only the missing song from the playlist after confirmation.

Missing entries are excluded from the playback queue, so next, previous, shuffle, and automatic looping never attempt to play an invalid file. If locating a replacement fails validation, the original missing entry remains unchanged.

## Playback integration

Introduce a normalized renderer-side song model for both newly imported files and restored path-based songs. Each displayed row keeps its stable song ID; playback uses a separate list of valid songs and a mapping back to display rows. This prevents missing rows from corrupting the current index or shuffle sequence.

For imported files, obtain the filesystem path through a preload helper and persist it immediately after adding the song. For restored songs, the main process validates the path and provides a safe local file URL or equivalent loadable source to the renderer. The existing Web Audio gain pipeline receives the normalized source without changing gain semantics.

Changing playlists stops the current audio, clears the old playback queue and shuffle history, loads valid songs from the new playlist, and updates the gain slider for the active song. Empty playlists remain selectable and show the normal import affordance.

## Error handling and compatibility

- Invalid playlist JSON is treated as an empty collection and should be logged for diagnosis.
- Missing or inaccessible paths are represented as missing entries, not removed automatically.
- Duplicate playlist names are allowed only if the UI clearly distinguishes them; the recommended behavior is to reject blank names and trim surrounding whitespace.
- Deleting a playlist never deletes files from disk.
- Existing `config.json` remains readable and is not converted into the playlist schema.

## Verification

Manual verification should cover:

1. Create a playlist, import songs, close the app, reopen it, and confirm the playlist and active selection persist.
2. Create multiple playlists and verify switching isolates their song lists and playback queues.
3. Rename and delete playlists, including confirming that deletion does not remove MP3 files.
4. Move or delete a saved MP3, reopen the app, and verify the missing row offers working Locate and Delete actions.
5. Confirm duplicate imports are skipped and valid songs still play around missing entries.
6. Verify shuffle, automatic looping, per-song gain, and language selection after playlist switching.
7. Run renderer/main syntax checks and Electron packaging.
