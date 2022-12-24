'use strict'

import { app, protocol, BrowserWindow, Menu, ipcMain } from 'electron'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
import installExtension, { VUEJS3_DEVTOOLS } from 'electron-devtools-installer'
//import { NFC } from 'nfc-pcsc'

const path = require('path')
const fs = require('fs')

const isDevelopment = process.env.NODE_ENV !== 'production'


// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { secure: true, standard: true } }
])

let nfcCardHandler;

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
    
    const menu = Menu.buildFromTemplate([
        {
            label: 'Menu',
            submenu: [
                {
                    label:'Spelersbeheer',
                    click() {
                        console.log('Spelersbeheer click');
                        win.webContents.send('player-admin');
                        // => Renderer that.showParticipantList = true;
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
    nfcCardHandler = (uid) => win.webContents.send('nfc-card', uid)   // Note asuming here there is only ever one window...
    win.on('close', () => { console.log('Closing main window'); nfcCardHandler = undefined; })
    
    if (process.env.WEBPACK_DEV_SERVER_URL) {
        // Load the url of the dev server if in development mode
        await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
        if (!process.env.IS_TEST) win.webContents.openDevTools()
    } else {
        createProtocol('app')
        // Load the index.html when not in development
        win.loadURL('app://./index.html')
    }
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

function exportPlayers(event, jsonText)
{
    fs.writeFile('players_export.json', jsonText, 'utf8', () =>{
        console.log(`Wrote "players_export.json", ${jsonText.length} characters`);
    });
    let players = JSON.parse(jsonText);
    let csvFile = ['"name","speelNummer","gender","ranking"'];
    csvFile = ['"Naam","Speler nummer","Gender","Ranking"'];
    for(const p of players)
    {
        csvFile.push(`"${p.name || ""}",${p.speelNummer || 0},"${p.gender || ""}",${p.ranking || 1}`)
    }
    fs.writeFile('players_export.csv', csvFile.join('\n') + '\n', 'utf8', () =>{
        console.log(`Wrote "players_export.csv", ${csvFile.length} lines`);
    });
}

// where all the nfc magic should happen...
// const nfc = new NFC();
// nfc.on('reader', reader => {
//     console.log(`${reader.reader}`)
//     console.log(`${reader.reader.name}  device attached`);
    
//     // enable when you want to auto-process ISO 14443-4 tags (standard=TAG_ISO_14443_4)
//     // when an ISO 14443-4 is detected, SELECT FILE command with the AID is issued
//     // the response is available as card.data in the card event
//     // you can set reader.aid to:
//     // 1. a HEX string (which will be parsed automatically to Buffer)
//     // reader.aid = 'F222222222';
//     // 2. an instance of Buffer containing the AID bytes
//     // reader.aid = Buffer.from('F222222222', 'hex');
//     // 3. a function which must return an instance of a Buffer when invoked with card object (containing standard and atr)
//     //    the function may generate AIDs dynamically based on the detected card
//     // reader.aid = ({ standard, atr }) => {
//     //
//     // 	return Buffer.from('F222222222', 'hex');
//     //
//     // };
    
//     reader.on('card', card => {
        
//         // card is object containing following data
//         // [always] String type: TAG_ISO_14443_3 (standard nfc tags like MIFARE) or TAG_ISO_14443_4 (Android HCE and others)
//         // [always] String standard: same as type
//         // [only TAG_ISO_14443_3] String uid: tag uid
//         // [only TAG_ISO_14443_4] Buffer data: raw data from select APDU response
        
//         // this should show the nfc uid... card would be the client data
//         console.log(`${reader.reader.name}  card detected`, card);
//         nfcCardHandler && nfcCardHandler(card.uid);
        
//         // if so, we could make use of the existing 'barcode'system by doing:
        
//         //this.barcode = card.uid  I guess?
//         //newParticipant()   // this triggers the participant checkin
//     });
    
//     reader.on('card.off', card => {
//         console.log(`${reader.reader.name}  card removed`, card);
//     });
    
//     reader.on('error', err => {
//         console.log(`${reader.reader.name}  an error occurred`, err);
//     });
    
//     reader.on('end', () => {
//         console.log(`${reader.reader.name}  device removed`);
//     });
// });
///////////////////////////////// pcsclite based ///////////////////////////

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
        console.log('Could not get card UID.');
        return;
    }
    
    // Device sends UID bytes LSB first
    // strip out the status code (the rest is UID)
    const uid = response.slice(0, -2).reverse().toString('hex');

    nfcCardHandler && nfcCardHandler(uid);
    console.log('card uid is', uid);
}

pcsc.on('reader', function(reader) {

    console.log('New reader detected', reader.name);

    reader.on('error', function(err) {
        console.log('Error(', this.name, '):', err.message);
    });

    reader.on('status', function(status) {
        console.log('Status(', this.name, '):', status);
        /* check what has changed */
        var changes = this.state ^ status.state;
        if (changes) {
            if ((changes & this.SCARD_STATE_EMPTY) && (status.state & this.SCARD_STATE_EMPTY)) {
                console.log("card removed");/* card removed */
                reader.disconnect(reader.SCARD_LEAVE_CARD, function(err) {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log('Disconnected');
                    }
                });
            } else if ((changes & this.SCARD_STATE_PRESENT) && (status.state & this.SCARD_STATE_PRESENT)) {
                console.log("card inserted");/* card inserted */
                reader.connect({ share_mode : this.SCARD_SHARE_SHARED }, function(err, protocol) {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log('Protocol(', reader.name, '):', protocol);
                        reader.transmit(apduCmdPacket, 12, handleApduCmdResponse);
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
