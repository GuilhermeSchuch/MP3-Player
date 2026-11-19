const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("versions", {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron
})

contextBridge.exposeInMainWorld("electronAPI", {
  loadConfig: async () => ipcRenderer.invoke("load-config"),
  saveVolume: (value) => ipcRenderer.invoke("save-volume", value),
  saveConfig: async (config) => ipcRenderer.invoke("save-config", config),
  loadPlaylists: async () => ipcRenderer.invoke("load-playlists"),
  lookupLyrics: (songId, duration) => ipcRenderer.invoke("lookup-lyrics", songId, duration),
  savePlaylists: async (document) => ipcRenderer.invoke("save-playlists", document),
  inspectPlaylistSongs: async (songs) => ipcRenderer.invoke("inspect-playlist-songs", songs),
  updateDiscordPresence: async (activity) => ipcRenderer.invoke("update-discord-presence", activity),
  clearDiscordPresence: async () => ipcRenderer.invoke("clear-discord-presence"),
  getFilePath: (file) => webUtils.getPathForFile(file),
});
