import { app, protocol, BrowserWindow, Menu, ipcMain, dialog, shell } from 'electron'
import { release } from 'node:os'
import { join } from 'node:path'
import { writeFile, readFileSync } from 'node:fs'

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
                        console.log('Spelersbeheer click');
                        win.webContents.send('player-admin');
                    }
                },
                {
                    label:'Herstel sessie',
                    click() {
                        console.log('Restore session click');
                        win.webContents.send('restore-session');
                    }
                },
                {
                    label:'Instellingen',
                    click() {
                        console.log('Settings click');
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
            // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
            // Consider using contextBridge.exposeInMainWorld
            // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
            //nodeIntegration: true,
            //contextIsolation: false,
        },
    })
    
    ipcMain.on('export-players', exportPlayers)
    ipcMain.on('import-players', importPlayers)
    
    installApplicationMenu(win);
    nfcCardHandler = (uid) => win.webContents.send('nfc-card', uid)     // Note asuming here there is only ever one window...
    nfcErrorHandler = (msg) => win.webContents.send('nfc-error', msg)
    importDataHandler = (data) => win.webContents.send('import-data', data)
    win.on('close', () => {
        console.log('Closing main window');
        nfcCardHandler = undefined;
        nfcErrorHandler = undefined;
        importDataHandler = undefined;
    })
    
    if (process.env.VITE_DEV_SERVER_URL) { // electron-vite-vue#298
        win.loadURL(url)
        // Open devTool if the app is not packaged
        win.webContents.openDevTools()
    } else {
        win.loadFile(indexHtml)
    }
    
    // Test actively push message to the Electron-Renderer TODO remove?
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', new Date().toLocaleString())
    })
    
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

let nfcCardHandler;
let nfcErrorHandler;
let importDataHandler;

async function exportPlayers(event, jsonText)
{
    let pathInfo = await dialog.showSaveDialog(
        {
            defaultPath: "players_export.csv"
        }
    )
    if (pathInfo.canceled) return;
    let players = JSON.parse(jsonText);
    let csvFile = ['"Naam","Spelernummer","Gender","Ranking"'];
    for(const p of players)
    {
        csvFile.push(`"${p.name || ""}",${p.playerId || 0},"${p.gender || ""}",${p.ranking || 0}`)
    }
    writeFile(pathInfo.filePath, csvFile.join('\n') + '\n', 'utf8', () =>{
        console.log(`Wrote "${pathInfo.filePath}", ${csvFile.length} lines`);
    });
}

async function importPlayers(event)
{
    let pathInfo = await dialog.showOpenDialog(
        {
            filters: [
                { name: "Excel", extensions: ['xls', 'xlsx'] },
                { name: "Alles", extensions: ['*'] }
            ],
            properties: ['openFile']
        }
    )
    if (pathInfo.canceled || (pathInfo.filePaths.length != 1)) return;
    let path = pathInfo.filePaths[0]
    let bytes = new Uint8Array(readFileSync(path))
    importDataHandler(bytes)
    console.log(`Read "${path}" got ${bytes.length} bytes`)
}

const pcsc = require('pcsclite')();

// APDU CMD: Get Data
const apduCmdPacket = Buffer.from([
    0xff, // Class
    0xca, // INS
    0x00, // P1: Get current card UID
    0x00, // P2
    0x00  // Le: Full Length of UID
]);

let handleApduCmdResponse = (err, response) => {

    if (err) {
        console.log(err);
        nfcErrorHandler && nfcErrorHandler(err.message || err.toString());
        return;
    }

    if (response.length < 2) {
        console.log(`Invalid response length ${response.length}. Expected minimal length was 2 bytes.`);
        return;
    }

    // last 2 bytes are the status code
    const statusCode = response.slice(-2).readUInt16BE(0);

    // an error occurred
    if (statusCode !== 0x9000) {
        let msg = 'Could not get card UID.'
        console.log(msg);
        nfcErrorHandler && nfcErrorHandler(msg);
        return;
    }

    // Device sends UID bytes LSB first.  We convert this to upper-case hex string as-is (numerically reversed).
    // strip out the status code (the rest is UID)
    const uid = response.slice(0, -2).toString('hex').toUpperCase();

    nfcCardHandler && nfcCardHandler(uid);
    console.log('Card UID is', uid);
}

pcsc.on('reader', function(reader) {

    console.log('New reader detected', reader.name);

    reader.on('error', function(err) {
        console.log('Error(', this.name, '):', err.message);
    });

    reader.on('status', function(status) {
        // console.log('Status(', this.name, '):', status);
        /* check what has changed */
        var changes = this.state ^ status.state;
        if (changes) {
            if ((changes & this.SCARD_STATE_EMPTY) && (status.state & this.SCARD_STATE_EMPTY)) {
                // console.log("card removed");/* card removed */
                reader.disconnect(reader.SCARD_LEAVE_CARD, function(err) {
                    if (err) {
                        console.log(err);
                    } else {
                        // console.log('Disconnected');
                    }
                });
            } else if ((changes & this.SCARD_STATE_PRESENT) && (status.state & this.SCARD_STATE_PRESENT)) {
                //console.log("card inserted");/* card inserted */
                reader.connect({ share_mode : this.SCARD_SHARE_SHARED }, function(err, protocol) {
                    if (err) {
                        console.log("connect error", err);
                        nfcErrorHandler && nfcErrorHandler("NFC connect error")
                    } else if (protocol === undefined) {
                        nfcErrorHandler && nfcErrorHandler("NFC connect undefined protocol argument")
                    } else {
                        // console.log('Protocol(', reader.name, '):', protocol);
                        reader.transmit(apduCmdPacket, 12, protocol, handleApduCmdResponse);
                    }
                });
            }
        }
    });

    reader.on('end', function() {
        console.log('Reader',  this.name, 'removed');
    });
});

pcsc.on('error', function(err) {
    console.log('PCSC error', err.message);
});
