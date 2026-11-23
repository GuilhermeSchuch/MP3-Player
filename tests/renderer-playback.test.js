const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const playlistModel = require("../src/js/playlist-model");

const rendererPath = path.join(__dirname, "../src/js/renderer.js");
const source = fs.readFileSync(rendererPath, "utf8")
  .replace(/\ninitializeApp\(\);\s*$/, "\nappReady = initializeApp();");

async function openPlayer({ shuffle = false, missing = false, lookupLyrics, volumeStore = {} } = {}) {
  const plays = [];
  const scrolledSongs = [];
  const buttons = new Map();
  const listeners = new Map();
  let currentAudio = null;
  let toggleLyricsShortcut;

  function createElement(tag) {
    const classList = new Set();
    classList.remove = classList.delete;
    classList.toggle = (name, enabled) => enabled ? classList.add(name) : classList.delete(name);
    return {
      children: [],
      getBoundingClientRect() { return { top: 0, bottom: 100 }; },
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
      scrollIntoView() { if (this.dataset.songId) scrolledSongs.push(this.dataset.songId); },
      ...(tag === "audio" && {
        duration: 180,
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
    window: { matchMedia: () => ({ matches: false }), electronAPI: {
      lookupLyrics,
      onToggleLyricsView(callback) { toggleLyricsShortcut = callback; },
      loadConfig: async () => [{ name: "shuffle", value: shuffle }, { name: "volume", value: volumeStore.value }],
      saveVolume: async value => { volumeStore.value = value; },
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
  buttons.get("#dialogOverlay").hidden = true;

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
    scrolledSongs,
    toggleLyricsShortcut,
    lyricsView: buttons.get("#lyricsView"),
    slider: buttons.get("#volume"),
    audioVolume: () => currentAudio.volume,
    moveVolumeSlider: async value => {
      buttons.get("#volume").value = String(value);
      await dispatch(buttons.get("#volume"), "input");
    },
    shortcut: keyCode => dispatch(context.document, "keydown", { keyCode }),
    clickPlayback: () => dispatch(play.style.display === "none" ? pause : play, "click"),
    clickFirstSong: () => dispatch(playlist, "click", {
      target: { closest: (selector) => selector.startsWith("li") ? playlist.children[0] : null },
    }),
    endSong: () => dispatch(currentAudio, "ended"),
    openLyrics: () => dispatch(buttons.get("#lyricsViewBtn"), "click"),
    lyricLines: buttons.get("#lyricsLines"),
    seek: async time => {
      currentAudio.currentTime = time;
      await dispatch(currentAudio, "seeked");
    },
    rowsWithClass: (name) => playlist.children
      .filter((row) => row.classList.has(name))
      .map((row) => row.textContent),
  };
}

test("volume is restored on reopening, including mute and adjustments before playback", async () => {
  const volumeStore = {};
  const first = await openPlayer({ volumeStore });
  assert.equal(first.slider.value, 0.5);
  await first.moveVolumeSlider(0.37);
  const second = await openPlayer({ volumeStore });
  assert.equal(second.slider.value, 0.37);
  await second.clickPlayback();
  assert.equal(second.audioVolume(), 0.37);
  await second.shortcut(85);
  assert.equal(second.audioVolume(), 0.5);
  assert.equal(volumeStore.value, 0.5);
  await second.shortcut(77);
  const third = await openPlayer({ volumeStore });
  await third.clickPlayback();
  assert.equal(third.slider.value, 0);
  assert.equal(third.audioVolume(), 0);
});

test("opening Lyrics mid-song highlights the current line and follows backward seeks", async () => {
  let requests = 0;
  const player = await openPlayer({ lookupLyrics: async () => {
    requests++;
    return { kind: "synced", lines: [{ time: 2, text: "First" }, { time: 9, text: "Second" }] };
  } });
  await player.clickPlayback();
  await player.seek(12);
  assert.equal(requests, 0);
  await player.openLyrics();
  assert.equal(requests, 1);
  const [first, second] = player.lyricLines.children;
  assert.ok(second.classList.has("activeLyric"));
  await player.seek(3);
  assert.ok(first.classList.has("activeLyric"));
  assert.ok(!second.classList.has("activeLyric"));
  await player.seek(0);
  assert.ok(!first.classList.has("activeLyric"));
});

test("a late lookup cannot overwrite the next song's plain lyrics", async () => {
  let finish;
  const player = await openPlayer({ lookupLyrics: id => id === "0"
    ? new Promise(resolve => { finish = resolve; })
    : Promise.resolve({ kind: "plain", text: "Second song" }) });
  await player.clickPlayback();
  await player.openLyrics();
  await player.endSong();
  finish({ kind: "plain", text: "First song" });
  await new Promise(setImmediate);
  assert.equal(player.lyricLines.textContent, "Second song");
});

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

test("the view shortcut toggles before and during playback without restarting the track", async () => {
  const player = await openPlayer({ lookupLyrics: async () => ({ kind: "missing" }) });
  player.toggleLyricsShortcut();
  assert.equal(player.lyricsView.hidden, false);
  await player.clickPlayback();
  player.toggleLyricsShortcut();
  assert.equal(player.lyricsView.hidden, true);
  player.toggleLyricsShortcut();
  assert.equal(player.lyricsView.hidden, false);
  assert.equal(player.plays.length, 1);
});

test("shuffle scrolls once to the chosen song and catches up after Lyrics closes", async () => {
  const player = await openPlayer({ shuffle: true, lookupLyrics: async () => ({ kind: "missing" }) });
  await player.clickPlayback();
  await player.endSong();
  assert.deepEqual(player.scrolledSongs, ["1", "0"]);
  await player.openLyrics();
  await player.endSong();
  assert.deepEqual(player.scrolledSongs, ["1", "0"]);
  player.toggleLyricsShortcut();
  assert.deepEqual(player.scrolledSongs, ["1", "0", "1"]);
});
