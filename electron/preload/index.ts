const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('myIpc', {
  exportPlayers:    (jsonText) => ipcRenderer.send('export-players', jsonText),
  importPlayers:    ()         => ipcRenderer.send('import-players'),
  onImportData:     (callback) => ipcRenderer.on('import-data', callback),
  onPlayerAdmin:    (callback) => ipcRenderer.on('player-admin', callback),
  onRestoreSession: (callback) => ipcRenderer.on('restore-session', callback),
  onShowSettings:   (callback) => ipcRenderer.on('show-settings', callback),
  onNfcCard:        (callback) => ipcRenderer.on('nfc-card', callback),
  onNfcError:       (callback) => ipcRenderer.on('nfc-error', callback),
  onFieldImage:     (callback) => ipcRenderer.on('field-image', callback),
})
