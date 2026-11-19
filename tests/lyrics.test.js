const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const id3 = require("node-id3");
const { parseLyrics, lookupLyrics } = require("../src/js/lyrics");

test("parses ordered timestamps, repeats, blank cues and the LRC offset", () => {
  assert.deepEqual(parseLyrics("[offset:100]\n[00:02.10][00:05.10] Chorus\n[00:01.10]Intro\n[00:04.10]"), [
    { time: 1, text: "Intro" }, { time: 2, text: "Chorus" }, { time: 4, text: "" }, { time: 5, text: "Chorus" },
  ]);
});

async function folder(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "echodeck-lyrics-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}

test("uses ID3 metadata, selects synced lyrics for the recording and reopens offline", async t => {
  const dir = await folder(t);
  const file = path.join(dir, "01.mp3");
  await fs.writeFile(file, id3.create({ artist: "A & B", title: "Home", album: "Live" }));
  const track = { artistName: "A & B", trackName: "Home", albumName: "Live", duration: 150 };
  const fetchLyrics = async url => {
    assert.equal(url.searchParams.get("artist_name"), "A & B");
    assert.equal(url.searchParams.get("track_name"), "Home");
    return { ok: true, json: async () => [
      { ...track, duration: 190, syncedLyrics: "[00:01]Other version" },
      { ...track, plainLyrics: "Home" }, { ...track, syncedLyrics: "[00:02]Home" },
    ] };
  };
  const result = await lookupLyrics(file, 150, dir, fetchLyrics);
  assert.deepEqual(result, { kind: "synced", lines: [{ time: 2, text: "Home" }] });
  assert.deepEqual(await lookupLyrics(file, 150, dir, () => assert.fail("cache miss")), result);
});

test("falls back to the filename and plain lyrics when timing is unavailable", async t => {
  const dir = await folder(t);
  const file = path.join(dir, "Band - Home.mp3");
  const result = await lookupLyrics(file, 230, dir, async url => {
    assert.equal(url.searchParams.get("artist_name"), "Band");
    assert.equal(url.searchParams.get("track_name"), "Home");
    return { ok: true, json: async () => [
      { artistName: "Band", trackName: "Home", duration: 231, syncedLyrics: "[ar:Band]", plainLyrics: "Line one\nLine two" },
    ] };
  });
  assert.deepEqual(result, { kind: "plain", text: "Line one\nLine two" });
});
