const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildActivity,
  buildFrame,
  buildHandshake,
  buildSetActivity,
  getPipeNames,
} = require("../src/js/discord-presence");

test("builds the Discord handshake payload", () => {
  assert.deepEqual(buildHandshake("client-id"), {
    v: 1,
    client_id: "client-id",
  });
});

test("publishes the track as a listening activity with a playback timeline", () => {
  const activity = buildActivity({
    title: "Song Title",
    positionSeconds: 42.5,
    durationSeconds: 180,
    nowMs: 1_700_000_000_000,
    filePath: "C:\\Music\\private-song.mp3",
  });

  assert.deepEqual(activity, {
    type: 2,
    status_display_type: 2,
    details: "Song Title",
    assets: { large_image: "logo_1_1_", large_text: "EchoDeck" },
    timestamps: { start: 1_699_999_957, end: 1_700_000_138 },
  });
  assert.equal(JSON.stringify(activity).includes("private-song"), false);
});

test("removes the timestamp while paused", () => {
  const activity = buildActivity({
    title: "Song Title",
    paused: true,
    positionSeconds: 42.5,
    nowMs: 1_700_000_000_000,
  });

  assert.equal(activity.state, "Paused");
  assert.equal("timestamps" in activity, false);
});

test("resumes the timestamp from the preserved song position", () => {
  const resumedAt = 1_700_000_120_000;
  const activity = buildActivity({
    title: "Song Title",
    positionSeconds: 42.5,
    nowMs: resumedAt,
  });

  assert.deepEqual(activity.timestamps, { start: 1_700_000_077 });
  assert.equal(Math.floor(resumedAt / 1000) - activity.timestamps.start, 43);
});

test("reanchors the timestamp to the seeked song position", () => {
  const nowMs = 1_700_000_000_000;
  const beforeSeek = buildActivity({ title: "Song", positionSeconds: 10, nowMs });
  const afterSeek = buildActivity({ title: "Song", positionSeconds: 75, nowMs });

  assert.deepEqual(beforeSeek.timestamps, { start: 1_699_999_990 });
  assert.deepEqual(afterSeek.timestamps, { start: 1_699_999_925 });
});

test("builds set activity and clear activity payloads", () => {
  const activity = buildActivity({ title: "Song" });

  assert.deepEqual(buildSetActivity(123, activity, "nonce"), {
    cmd: "SET_ACTIVITY",
    args: { pid: 123, activity },
    nonce: "nonce",
  });
  assert.deepEqual(buildSetActivity(123, null, "clear"), {
    cmd: "SET_ACTIVITY",
    args: { pid: 123, activity: null },
    nonce: "clear",
  });
});

test("encodes an RPC frame with the Discord little-endian header", () => {
  const frame = buildFrame(0, { v: 1, client_id: "client-id" });
  const payload = Buffer.from('{"v":1,"client_id":"client-id"}', "utf8");

  assert.equal(frame.readInt32LE(0), 0);
  assert.equal(frame.readInt32LE(4), payload.length);
  assert.equal(frame.subarray(8).toString("utf8"), payload.toString("utf8"));
});

test("lists Discord named pipes on Windows", () => {
  assert.deepEqual(getPipeNames("win32").slice(0, 2), [
    "\\\\?\\pipe\\discord-ipc-0",
    "\\\\?\\pipe\\discord-ipc-1",
  ]);
  assert.equal(getPipeNames("win32").length, 10);
});
