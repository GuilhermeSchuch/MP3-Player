// Imports
const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const fs = require("node:fs");
const path = require("node:path");

// Global Variables
const configPath = path.join(__dirname, "config.json");
const isDev = false;

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

const createWindow = async () => {
  const win = new BrowserWindow({
    width: isDev ? 1200 : 500,
    height: 700,
    title: "MP3 Player",
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

  // Toggle Lyric
  globalShortcut.register('CommandOrControl+num0', () => {
    win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'l'});
  });

  win.loadFile(path.join(__dirname, "src/index.html"));
  isDev && win.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});