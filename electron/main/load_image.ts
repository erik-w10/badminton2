import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

let imageHandler : { (bytes : Uint8Array) : void } | undefined;

function setImageHandler(handler? : { (bytes : Uint8Array) : void})
{
    imageHandler = handler
}

async function loadFieldImage()
{
    let dirPath = path.join(os.homedir(), '.badminton_field_images')
    console.log(`Will try to load field images from  "${dirPath}"`)
    try {
        const files = await readdir(dirPath)
        for (const file of files)
        {
            let imgPath = path.join(dirPath, file)
            try {
                let bytes = new Uint8Array(await readFile(imgPath))
                if ((bytes.length != 0) && imageHandler) imageHandler(bytes)
            } catch (error) {
                console.log(`Could not read file "${file}"`)
            }
        }
        if (imageHandler) imageHandler(new Uint8Array)  // Empty image marks the end of the images list
    } catch (error) {
        console.log(`Could not list directory "${dirPath}"`)
    }
}

export { loadFieldImage, setImageHandler}
