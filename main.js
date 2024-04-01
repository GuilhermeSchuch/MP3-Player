const { app, BrowserWindow } = require('electron');
const path = require('node:path');

const isDev = false;

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
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  win.loadFile(path.join(__dirname, "src/index.html"));
  isDev && win.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();
})