// Imports
const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const fs = require("node:fs");
const path = require("node:path");
const playlistStorage = require("./src/js/playlist-storage");
const { lookupLyrics } = require("./src/js/lyrics");
const { buildActivity, createDiscordPresence } = require("./src/js/discord-presence");

const appName = "EchoDeck";
app.setName(appName);

if (process.platform === 'win32') {
  app.setAppUserModelId('com.guilherme-schuch.echodeck');
}

// Global Variables
function loadEnvValue(name) {
  if (process.env[name]) return process.env[name];

  try {
    const envPath = path.join(__dirname, ".env");
    const line = fs.readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .find((entry) => new RegExp(`^\\s*${name}\\s*=`).test(entry));
    const value = line?.replace(new RegExp(`^\\s*${name}\\s*=`), "").trim();
    return value?.replace(/^(["'])(.*)\1$/, "$2") || "";
  } catch {
    return "";
  }
}

const configuredUserDataPath = app.getPath('userData');
const windowPositionPath = path.join(configuredUserDataPath, "window-position.json");
const legacyUserDataPath = path.join(app.getPath("appData"), "MP3 Player");
const hasLegacyData = ["config.json", "playlists.json"]
  .some((fileName) => fs.existsSync(path.join(legacyUserDataPath, fileName)));
const hasNewData = ["config.json", "playlists.json"]
  .some((fileName) => fs.existsSync(path.join(configuredUserDataPath, fileName)));
const userDataPath = hasLegacyData && !hasNewData
  ? legacyUserDataPath
  : configuredUserDataPath;
const configPath = path.join(userDataPath, "config.json");
const playlistsPath = path.join(userDataPath, "playlists.json");
const initialConfig = [{"name":"shuffle","text":"Aleatório","value":false},{"name":"language","text":"Idioma","value":"pt"},{"name":"songGains","text":"Ganhos por música","value":{}}]
const isDev = false;
const discordClientId = loadEnvValue("DISCORD_CLIENT_ID");
const discordPresence = discordClientId
  ? createDiscordPresence({
      clientId: discordClientId,
      logger: (message) => console.error(message),
    })
  : null;

// Check if configuration file exists
if(!fs.existsSync(configPath)) {
  fs.writeFile(configPath, JSON.stringify(initialConfig), err => {
    if(err) {
      console.error(err);
    }
  });
}

// Get user settings from config.json file
function loadConfig() {
  if(fs.existsSync(configPath)) {    
    const data = fs.readFileSync(configPath, 'utf-8');
    if(data) return JSON.parse(data);
  }
  return [];
}
ipcMain.handle("load-config", loadConfig);

// Save user settings into config.json file
ipcMain.handle("save-config", (event, newConfig) => {
  const volume = loadConfig().find(setting => setting.name === "volume");
  const settings = newConfig.filter(setting => setting.name !== "volume");
  if (volume) settings.push(volume);
  fs.writeFileSync(configPath, JSON.stringify(settings));
});

ipcMain.handle("save-volume", (_event, value) => {
  if (!Number.isFinite(value) || value < 0 || value > 1) return;
  const settings = loadConfig().filter(setting => setting.name !== "volume");
  settings.push({ name: "volume", value });
  fs.writeFileSync(configPath, JSON.stringify(settings));
});

ipcMain.handle("load-playlists", () => {
  return playlistStorage.loadPlaylists(playlistsPath, console.error);
});

ipcMain.handle("save-playlists", (event, document) => {
  playlistStorage.savePlaylists(playlistsPath, document);
});

ipcMain.handle("inspect-playlist-songs", (event, songs) => {
  return playlistStorage.inspectPlaylistSongs(songs);
});

ipcMain.handle("lookup-lyrics", (_event, songId, duration) => {
  const document = playlistStorage.loadPlaylists(playlistsPath);
  const playlist = document.playlists.find(item => item.id === document.activePlaylistId);
  const song = playlist?.songs.find(item => item.id === songId);
  if (!song || path.extname(song.path).toLowerCase() !== ".mp3" || !Number.isFinite(duration) || duration <= 0) {
    return { kind: "missing" };
  }
  return lookupLyrics(song.path, duration, path.join(configuredUserDataPath, "lyrics-cache"));
});

ipcMain.handle("update-discord-presence", async (event, activity) => {
  if (!discordPresence) return false;
  await discordPresence.setActivity(buildActivity(activity));
  return true;
});

ipcMain.handle("clear-discord-presence", async () => {
  if (!discordPresence) return false;
  await discordPresence.clearActivity();
  return true;
});

function loadWindowPosition(width) {
  let position;
  try {
    position = JSON.parse(fs.readFileSync(windowPositionPath, "utf8"));
  } catch {
    return {};
  }

  const { x, y } = position ?? {};
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return {};

  // Restore only if the middle of the title bar is on a connected display.
  const titleBarX = x + Math.floor(width / 2);
  const titleBarY = y + 16;
  const visible = screen.getAllDisplays().some(({ workArea }) =>
    titleBarX >= workArea.x && titleBarX < workArea.x + workArea.width &&
    titleBarY >= workArea.y && titleBarY < workArea.y + workArea.height
  );

  return visible ? { x, y } : {};
}

const createWindow = async () => {
  const width = isDev ? 1200 : 500;
  const win = new BrowserWindow({
    width,
    height: 700,
    ...loadWindowPosition(width),
    title: appName,
    fullscreen: false,
    resizable: false,
    icon: path.join(__dirname, "src/assets/icon.ico"),
    autoHideMenuBar: true,    
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    },
  })

  win.on("close", () => {
    const { x, y } = win.getNormalBounds();
    try {
      fs.mkdirSync(configuredUserDataPath, { recursive: true });
      fs.writeFileSync(windowPositionPath, JSON.stringify({ x, y }));
    } catch (error) {
      console.error("Unable to save window position:", error);
    }
  });

  // Play next song
  globalShortcut.register('CommandOrControl+num9', () => {
    win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'n'});
  });
  
  // Play/Pause current song
  globalShortcut.register('CommandOrControl+num8', () => {
    win.webContents.sendInputEvent({type: 'keyDown', keyCode: 't'});
  });

  // Play previous song
  globalShortcut.register('CommandOrControl+num7', () => {
    win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'p'});
  });

  // Forward 1 sec
  globalShortcut.register('CommandOrControl+num6', () => {
    win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'f'});
  });

  // Restart song
  globalShortcut.register('CommandOrControl+num5', () => {
    win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'r'});
  });

  // Go back 1 sec
  globalShortcut.register('CommandOrControl+num4', () => {
    win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'b'});
  });
  
  // Volume up
  globalShortcut.register('CommandOrControl+num3', () => {
    win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'u'});
  });

  // Mute
  globalShortcut.register('CommandOrControl+num2', () => {
    win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'm'});
  });

  // Vomule down
  globalShortcut.register('CommandOrControl+num1', () => {
    win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'd'});
  });

  globalShortcut.register('CommandOrControl+num0', () => {
    win.webContents.send('toggle-lyrics-view');
  });


  win.loadFile(path.join(__dirname, "src/index.html"));
  isDev && win.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();
})

app.on('will-quit', () => {
  discordPresence?.clearActivity();
  discordPresence?.disconnect();
  globalShortcut.unregisterAll();
});
