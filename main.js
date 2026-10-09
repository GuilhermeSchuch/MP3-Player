// Imports
const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const fs = require("node:fs");
const path = require("node:path");
const playlistStorage = require("./src/js/playlist-storage");
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
ipcMain.handle("load-config", () => {  
  if(fs.existsSync(configPath)) {    
    const data = fs.readFileSync(configPath, 'utf-8');
    if(data) return JSON.parse(data);
  }
  return [];
});

// Save user settings into config.json file
ipcMain.handle("save-config", (event, newConfig) => {
  fs.writeFileSync(configPath, JSON.stringify(newConfig));
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

const createWindow = async () => {
  const win = new BrowserWindow({
    width: isDev ? 1200 : 500,
    height: 700,
    title: appName,
    fullscreen: false,
    resizable: false,
    icon: path.join(__dirname, "src/assets/icon.ico"),
    autoHideMenuBar: true,    
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    },
  })

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
