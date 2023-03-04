'use strict'

import { app, protocol, BrowserWindow, Menu, ipcMain, dialog } from 'electron'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
import installExtension, { VUEJS3_DEVTOOLS } from 'electron-devtools-installer'

const path = require('path')
const fs = require('fs')

const isDevelopment = process.env.NODE_ENV !== 'production'


// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { secure: true, standard: true } }
])

let nfcCardHandler;
let nfcErrorHandler;
let importDataHandler;

async function createWindow() {
    // Create the browser window.
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            // Use pluginOptions.nodeIntegration, leave this alone
            // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
            nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
            contextIsolation: !process.env.ELECTRON_NODE_INTEGRATION,

            preload: path.join(__dirname, 'preload.js'),
        }
    })

    ipcMain.on('export-players', exportPlayers)
    ipcMain.on('import-players', importPlayers)

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
                        win.openDevTools();
                    }
                },
            ]
        }
    ])
    Menu.setApplicationMenu(menu);
    nfcCardHandler = (uid) => win.webContents.send('nfc-card', uid)     // Note asuming here there is only ever one window...
    nfcErrorHandler = (msg) => win.webContents.send('nfc-error', msg)
    importDataHandler = (data) => win.webContents.send('import-data', data)
    win.on('close', () => { console.log('Closing main window'); nfcCardHandler = undefined; nfcErrorHandler = undefined; })

    if (process.env.WEBPACK_DEV_SERVER_URL) {
        // Load the url of the dev server if in development mode
        await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
        if (!process.env.IS_TEST) win.webContents.openDevTools()
    } else {
        createProtocol('app')
        // Load the index.html when not in development
        win.loadURL('app://./index.html')
    }
    win.maximize();
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
    if (isDevelopment && !process.env.IS_TEST) {
        // Install Vue Devtools
        try {
            await installExtension(VUEJS3_DEVTOOLS)
        } catch (e) {
            console.error('Vue Devtools failed to install:', e.toString())
        }
    }
    createWindow()
})

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
    if (process.platform === 'win32') {
        process.on('message', (data) => {
            if (data === 'graceful-exit') {
                app.quit()
            }
        })
    } else {
        process.on('SIGTERM', () => {
            app.quit()
        })
    }
}


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
    fs.writeFile(pathInfo.filePath, csvFile.join('\n') + '\n', 'utf8', () =>{
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
    let bytes = new Uint8Array(fs.readFileSync(path))
    importDataHandler(bytes)
    console.log(`Read "${path}" got ${bytes.length} bytes`)
}

const pcsc = require('pcsclite')();

// APDU CMD: Get Data
const apduCmdPacket = new Buffer.from([
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
