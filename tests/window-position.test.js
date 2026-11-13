const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const mainPath = path.join(__dirname, "..", "main.js");
const mainSource = fs.readFileSync(mainPath, "utf8");
const requireFromMain = createRequire(mainPath);
const primary = { workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
const secondary = { workArea: { x: -1920, y: 0, width: 1920, height: 1040 } };

function createUserData(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "echodeck-window-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, "config.json"), "[]");
  return directory;
}

async function launch(userData, displays) {
  let window;
  const electron = {
    app: {
      setName() {},
      setAppUserModelId() {},
      getPath: () => userData,
      whenReady: async () => {},
      on() {},
    },
    BrowserWindow: class extends EventEmitter {
      constructor(options) {
        super();
        this.position = [options.x, options.y];
        this.normalBounds = { x: 710, y: 170, width: 500, height: 700 };
        window = this;
      }
      getNormalBounds() { return this.normalBounds; }
      loadFile() {}
    },
    globalShortcut: { register() {} },
    ipcMain: { handle() {} },
    screen: { getAllDisplays: () => displays },
  };

  vm.runInNewContext(mainSource, {
    __dirname: path.dirname(mainPath),
    require: (name) => name === "electron" ? electron : requireFromMain(name),
    process: { platform: "win32", env: { DISCORD_CLIENT_ID: "test" } },
    console,
  }, { filename: mainPath });
  await Promise.resolve();
  return window;
}

test("reopens at the last position on a monitor left of the primary display", async (t) => {
  const userData = createUserData(t);
  const firstWindow = await launch(userData, [primary, secondary]);
  assert.deepEqual(firstWindow.position, [undefined, undefined]);

  firstWindow.normalBounds = { x: -1500, y: 85, width: 500, height: 700 };
  firstWindow.emit("close");

  const reopenedWindow = await launch(userData, [primary, secondary]);
  assert.deepEqual(reopenedWindow.position, [-1500, 85]);
});

test("uses default placement when the saved monitor is disconnected", async (t) => {
  const userData = createUserData(t);
  fs.writeFileSync(path.join(userData, "window-position.json"), '{"x":-1500,"y":85}');

  const reopenedWindow = await launch(userData, [primary]);
  assert.deepEqual(reopenedWindow.position, [undefined, undefined]);
});

test("uses default placement when the saved position is unreadable", async (t) => {
  const userData = createUserData(t);
  fs.writeFileSync(path.join(userData, "window-position.json"), "{");

  const reopenedWindow = await launch(userData, [primary, secondary]);
  assert.deepEqual(reopenedWindow.position, [undefined, undefined]);
});
