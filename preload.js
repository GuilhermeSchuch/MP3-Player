const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("versions", {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron
})

contextBridge.exposeInMainWorld("electronAPI", {
  loadConfig: async () => ipcRenderer.invoke("load-config"),
  saveConfig: async (config) => ipcRenderer.invoke("save-config", config),
  loadPlaylists: async () => ipcRenderer.invoke("load-playlists"),
  savePlaylists: async (document) => ipcRenderer.invoke("save-playlists", document),
  inspectPlaylistSongs: async (songs) => ipcRenderer.invoke("inspect-playlist-songs", songs),
  getFilePath: (file) => webUtils.getPathForFile(file),
});
