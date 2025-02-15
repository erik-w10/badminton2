import { dialog } from 'electron'
import { writeFile, readFileSync } from 'node:fs'

let importDataHandler : { (bytes : Uint8Array) : void };

async function exportPlayers(event, jsonText)
{
    let pathInfo = await dialog.showSaveDialog(
        {
            title: "Spelers exporteren",
            defaultPath: "players_export.csv"
        }
    )
    if (pathInfo.canceled) return;
    let players = JSON.parse(jsonText);
    let csvFile = ['"Naam","Spelernummer","Gender","Level"'];
    for(const p of players)
    {
        csvFile.push(`"${p.name || ""}",${p.playerId || 0},"${p.gender || ""}",${p.level || 1}`)
    }
    const bom = "\uFEFF";
    writeFile(pathInfo.filePath, bom + csvFile.join('\n') + '\n', 'utf8', () =>{
        console.log(`Wrote "${pathInfo.filePath}", ${csvFile.length} lines`);
    });
}

async function importPlayers(event)
{
    let pathInfo = await dialog.showOpenDialog(
        {
            title: "Spelers importeren",
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
    importDataHandler && importDataHandler(bytes)
    console.log(`Read "${path}" got ${bytes.length} bytes`)
}

function setImportDataHandler(handler? : { (bytes : Uint8Array) : void})
{
    importDataHandler = handler
}

export { setImportDataHandler, exportPlayers, importPlayers }
