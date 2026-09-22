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
    { id: "s2", name: "Track.mp3", path: "c:/music/track.mp3" },
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
    { id: "s2", name: "Keep.mp3", path: "C:\\music\\Keep.mp3" },
  ]);
  document = model.replaceSongPath(document, "p1", "s1", {
    id: "s1", name: "Missing.mp3", path: "C:\\new\\Missing.mp3",
  });
  document = model.removeSong(document, "p1", "s1");
  assert.deepEqual(document.playlists[0].songs.map((song) => song.id), ["s2"]);
});
