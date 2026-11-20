const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const assert = require("node:assert/strict");

function createElement() {
  return {
    children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    dataset: {},
    style: {},
    addEventListener() {},
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren(...children) { this.children = children; },
    remove() {},
  };
}

function loadRendererScrollHelper() {
  const rendererPath = path.join(__dirname, "src", "js", "renderer.js");
  const rendererSource = fs.readFileSync(rendererPath, "utf8");
  const startupCall = /\ninitializeApp\(\);\s*$/;
  assert.match(rendererSource, startupCall, "renderer startup call should be at the end of the script");

  const elements = new Map();
  const playlist = createElement();
  elements.set("#playlist", playlist);
  const document = {
    documentElement: {},
    querySelector(selector) {
      if (selector.startsWith("[data-id=")) return null;
      if (!elements.has(selector)) elements.set(selector, createElement());
      return elements.get(selector);
    },
    querySelectorAll() { return []; },
    createElement() { return createElement(); },
    addEventListener() {},
  };

  const context = {
    document,
    window: { electronAPI: { onToggleLyricsView() {} } },
    navigator: {},
    playlistModel: require("./src/js/playlist-model"),
    console,
  };

  vm.createContext(context);
  const testSource = rendererSource.replace(startupCall, "") + `
    globalThis.__scrollTest = {
      scrollToCurrentSong,
      audioObj,
      playlist,
      setCurrentAudioIndex(index) { currentAudioIndex = index; },
    };
  `;
  vm.runInContext(testSource, context, { filename: rendererPath });
  return context.__scrollTest;
}

test("scrolls the currently playing song to the top of the playlist", () => {
  const renderer = loadRendererScrollHelper();
  const scrollRequests = [];
  const activeRow = {
    dataset: { songId: "active-song" },
    scrollIntoView(options) { scrollRequests.push(options); },
  };

  renderer.audioObj.audioFiles = [{ id: "active-song" }];
  renderer.setCurrentAudioIndex(0);
  renderer.playlist.children = [activeRow];
  renderer.scrollToCurrentSong();

  assert.equal(scrollRequests.length, 1);
  assert.equal(scrollRequests[0].block, "start");
});
