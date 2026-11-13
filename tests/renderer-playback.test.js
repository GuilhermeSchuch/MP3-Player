const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const playlistModel = require("../src/js/playlist-model");

const rendererPath = path.join(__dirname, "../src/js/renderer.js");
const source = fs.readFileSync(rendererPath, "utf8")
  .replace(/\ninitializeApp\(\);\s*$/, "\nappReady = initializeApp();");

async function openPlayer({ shuffle = false, missing = false } = {}) {
  const plays = [];
  const buttons = new Map();
  const listeners = new Map();
  let currentAudio = null;

  function createElement(tag) {
    return {
      children: [],
      style: {},
      dataset: {},
      classList: new Set(),
      addEventListener(event, listener) { listeners.set(this, { ...listeners.get(this), [event]: listener }); },
      removeEventListener() {},
      appendChild(child) { this.children.push(child); },
      append(...children) { this.children.push(...children); },
      replaceChildren() { this.children = []; },
      setAttribute(name, value) { this[name] = String(value); },
      scrollIntoView() {},
      ...(tag === "audio" && {
        play() { plays.push(this.children[0].src); },
        pause() {},
      }),
    };
  }

  const songs = ["First", "Second"].map((name, index) => ({
    id: String(index),
    name: `${name}.mp3`,
    path: `C:/Music/${name}.mp3`,
  }));
  const context = {
    appReady: null,
    document: {
      documentElement: {},
      querySelector(selector) {
        if (selector.startsWith("[data-id=")) {
          return selector === `[data-id="${currentAudio?.["data-id"]}"]` ? currentAudio : null;
        }
        if (!buttons.has(selector)) buttons.set(selector, createElement());
        return buttons.get(selector);
      },
      querySelectorAll: () => [],
      addEventListener(event, listener) { listeners.set(this, { [event]: listener }); },
      createElement(tag) {
        const element = createElement(tag);
        if (tag === "audio") currentAudio = element;
        return element;
      },
    },
    window: { electronAPI: {
      loadConfig: async () => [{ name: "shuffle", value: shuffle }],
      loadPlaylists: async () => ({
        version: 1,
        activePlaylistId: "saved",
        playlists: [{ id: "saved", name: "Saved", songs }],
      }),
      inspectPlaylistSongs: async (records) => records.map((song, index) => ({
        ...song,
        exists: !missing || index !== 0,
        url: !missing || index !== 0 ? `file:///${song.path}` : null,
      })),
      clearDiscordPresence: async () => {},
      updateDiscordPresence: async () => {},
    } },
    navigator: {},
    playlistModel,
    Math: Object.assign(Object.create(Math), { random: () => 0.99 }),
    AudioContext: class {
      createMediaElementSource() { return { connect() {}, disconnect() {} }; }
      createGain() { return { gain: {}, connect() {}, disconnect() {} }; }
      resume() {}
    },
  };

  vm.runInNewContext(source, context, { filename: rendererPath });
  await context.appReady;

  const play = buttons.get("#playSongs");
  const pause = buttons.get("#togglePauseBtn");
  async function click(element, event = {}) {
    if (element.disabled) return;
    listeners.get(element)?.click?.(event);
    await new Promise(setImmediate);
  }
  return {
    plays,
    clickPlayback: () => click(play.style.display === "none" ? pause : play),
    clickFirstSong: () => {
      const playlist = buttons.get("#playlist");
      return click(playlist, {
        target: { closest: (selector) => selector.startsWith("li") ? playlist.children[0] : null },
      });
    },
  };
}

test("Play starts the first available song in a saved playlist", async () => {
  const player = await openPlayer({ missing: true });
  assert.deepEqual(player.plays, []);
  await player.clickPlayback();
  assert.deepEqual(player.plays, ["file:///C:/Music/Second.mp3"]);
});

test("Play honors shuffle on the first press", async () => {
  const player = await openPlayer({ shuffle: true });
  await player.clickPlayback();
  assert.deepEqual(player.plays, ["file:///C:/Music/Second.mp3"]);
});

test("clicking the first song starts playback before any audio is loaded", async () => {
  const player = await openPlayer();
  await player.clickFirstSong();
  assert.deepEqual(player.plays, ["file:///C:/Music/First.mp3"]);
});
