const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronIpc', {
  exportPlayers:    (jsonText) => ipcRenderer.send('export-players', jsonText),
  onPlayerAdmin:    (callback) => ipcRenderer.on('player-admin', callback),
  onRestoreSession: (callback) => ipcRenderer.on('restore-session', callback),
  onNfcCard:        (callback) => ipcRenderer.on('nfc-card', callback),
  onNfcError:       (callback) => ipcRenderer.on('nfc-error', callback),
})
