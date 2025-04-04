import { app, protocol, BrowserWindow, Menu, ipcMain, dialog, shell } from 'electron'
import { release } from 'node:os'
import { join } from 'node:path'
import { setNfcCardHandler, setNfcErrorHandler } from './nfc'
import { setImportDataHandler, exportPlayers, importPlayers } from "./players_io"
import { loadFieldImage, setImageHandler } from "./load_image"


// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.js    > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.DIST_ELECTRON = join(__dirname, '..')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, '../public')
  : process.env.DIST

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { secure: true, standard: true } }
])

// Remove electron security warnings
// This warning only shows in development mode
// Read more on https://www.electronjs.org/docs/latest/tutorial/security
// process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

let win: BrowserWindow | null = null
// Here, you can also use other preload
const preload = join(__dirname, '../preload/index.js')
const url = process.env.VITE_DEV_SERVER_URL
const indexHtml = join(process.env.DIST, 'index.html')

function installApplicationMenu(win : BrowserWindow) : void {
    const menu = Menu.buildFromTemplate([
        {
            label: 'Menu',
            submenu: [
                {
                    label:'Spelersbeheer',
                    click() {
                        win.webContents.send('player-admin');
                    }
                },
                {
                    label:'Herstel sessie',
                    click() {
                        win.webContents.send('restore-session');
                    }
                },
                {
                    label:'Instellingen',
                    click() {
                        win.webContents.send('show-settings');
                    }
                },
                {
                    label:'Dev-tools',
                    click() {
                        win.webContents.openDevTools()
                    }
                },
            ]
        }
    ])
    Menu.setApplicationMenu(menu);
}

async function createWindow() {
    win = new BrowserWindow({
        title: 'Main window',
        icon: join(process.env.VITE_PUBLIC, 'favicon.ico'),
        webPreferences: {
            preload,
        },
    })

    ipcMain.on('export-players', exportPlayers)
    ipcMain.on('import-players', importPlayers)

    installApplicationMenu(win);

    setNfcCardHandler(   (uid)            => win.webContents.send('nfc-card', uid))     // Note asuming here there is only ever one window...
    setNfcErrorHandler(  (msg)            => win.webContents.send('nfc-error', msg))
    setImportDataHandler((data)           => win.webContents.send('import-data', data))
    setImageHandler(     (data, mimeType) => win.webContents.send('field-image', data, mimeType))

    win.on('close', () => {
        console.log('Closing main window')
        setNfcCardHandler()
        setNfcErrorHandler()
        setImportDataHandler()
        setImageHandler()
    })
    
    if (process.env.VITE_DEV_SERVER_URL) { // electron-vite-vue#298
        win.loadURL(url)
        // Open devTool if the app is not packaged
        win.webContents.openDevTools()
    } else {
        win.loadFile(indexHtml)
    }
    
    win.webContents.on('did-finish-load', loadFieldImage)
    
    // Make all links open with the browser, not with the application TODO remove?
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https:')) shell.openExternal(url)
        return { action: 'deny' }
    })
    // win.webContents.on('will-navigate', (event, url) => { }) #344
    win.maximize();
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      //nodeIntegration: true,
      //contextIsolation: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${url}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})
