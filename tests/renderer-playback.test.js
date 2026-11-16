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
    const classList = new Set();
    classList.remove = classList.delete;
    classList.toggle = (name, enabled) => enabled ? classList.add(name) : classList.delete(name);
    return {
      children: [],
      style: {},
      dataset: {},
      classList,
      addEventListener(event, listener) { listeners.set(this, { ...listeners.get(this), [event]: listener }); },
      removeEventListener(event) { delete listeners.get(this)?.[event]; },
      remove() {
        for (const parent of buttons.values()) {
          parent.children = parent.children.filter((child) => child !== this);
        }
      },
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
      querySelectorAll: (selector) => selector === "li" ? buttons.get("#playlist").children : [],
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
  const playlist = buttons.get("#playlist");
  async function dispatch(element, type, event = {}) {
    if (element.disabled) return;
    listeners.get(element)?.[type]?.(event);
    await new Promise(setImmediate);
  }
  return {
    plays,
    clickPlayback: () => dispatch(play.style.display === "none" ? pause : play, "click"),
    clickFirstSong: () => dispatch(playlist, "click", {
      target: { closest: (selector) => selector.startsWith("li") ? playlist.children[0] : null },
    }),
    endSong: () => dispatch(currentAudio, "ended"),
    rowsWithClass: (name) => playlist.children
      .filter((row) => row.classList.has(name))
      .map((row) => row.textContent),
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

test("ordered playback fades past songs and clears the marks on wrap", async () => {
  const player = await openPlayer();
  await player.clickPlayback();
  assert.deepEqual(player.rowsWithClass("songPlayed"), []);

  await player.endSong();
  assert.deepEqual(player.rowsWithClass("songPlayed"), ["First"]);
  assert.deepEqual(player.rowsWithClass("songPlaying"), ["Second"]);

  await player.endSong();
  assert.deepEqual(player.rowsWithClass("songPlayed"), []);
  assert.deepEqual(player.rowsWithClass("songPlaying"), ["First"]);
});

test("shuffle clears played marks only after every available song plays", async () => {
  const player = await openPlayer({ shuffle: true });
  await player.clickPlayback();
  assert.deepEqual(player.rowsWithClass("songPlaying"), ["Second"]);

  await player.endSong();
  assert.deepEqual(player.rowsWithClass("songPlayed"), ["Second"]);
  assert.deepEqual(player.rowsWithClass("songPlaying"), ["First"]);

  await player.endSong();
  assert.deepEqual(player.rowsWithClass("songPlayed"), []);
  assert.deepEqual(player.rowsWithClass("songPlaying"), ["Second"]);
});
