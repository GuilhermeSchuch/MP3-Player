const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const storage = require("../src/js/playlist-storage");
const model = require("../src/js/playlist-model");

function withTempDirectory(callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mp3-player-playlists-"));
  try {
    return callback(directory);
  }
  finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test("loads an empty document when the playlist file is missing or invalid", () => {
  withTempDirectory((directory) => {
    const filePath = path.join(directory, "playlists.json");
    assert.deepEqual(storage.loadPlaylists(filePath), model.createEmptyDocument());
    fs.writeFileSync(filePath, "not json");
    assert.deepEqual(storage.loadPlaylists(filePath), model.createEmptyDocument());
  });
});

test("saves and restores a normalized playlist document", () => {
  withTempDirectory((directory) => {
    const filePath = path.join(directory, "playlists.json");
    const document = model.addSongs(
      model.createPlaylist(model.createEmptyDocument(), "Saved", "p1"),
      "p1",
      [{ id: "s1", name: "Song.mp3", path: "C:\\Music\\Song.mp3" }],
    );
    storage.savePlaylists(filePath, document);
    assert.deepEqual(storage.loadPlaylists(filePath), document);
  });
});

test("inspects song paths without removing missing records", () => {
  withTempDirectory((directory) => {
    const existingPath = path.join(directory, "song.mp3");
    fs.writeFileSync(existingPath, "audio");
    const songs = storage.inspectPlaylistSongs([
      { id: "s1", name: "Song.mp3", path: existingPath },
      { id: "s2", name: "Missing.mp3", path: path.join(directory, "missing.mp3") },
    ]);
    assert.equal(songs[0].exists, true);
    assert.match(songs[0].url, /^file:/);
    assert.equal(songs[1].exists, false);
    assert.equal(songs[1].url, null);
  });
});
