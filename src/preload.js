const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronIpc', {
  exportPlayers: (jsonText) => ipcRenderer.send('export-players', jsonText),
  onPlayerAdmin: (callback) => ipcRenderer.on('player-admin', callback),
  onNfcCard:     (callback) => ipcRenderer.on('nfc-card', callback),
})
