import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

let imageHandler : { (bytes : Uint8Array, mimeType : string|null) : void } | undefined;

function setImageHandler(handler? : { (bytes : Uint8Array, mimeType : string|null) : void})
{
    imageHandler = handler
}

const pngPattern = /.*\.png$/
const svgPattern = /.*\.svg$/

async function loadFieldImage()
{
    let dirPath = path.join(os.homedir(), '.badminton_field_images')
    console.log(`Will try to load field images from  "${dirPath}"`)
    try {
        const files = await readdir(dirPath)
        for (const file of files)
        {
            let mimeType : string
            if      (file.match(pngPattern)) mimeType = "image/png"
            else if (file.match(svgPattern)) mimeType = "image/svg+xml"
            else continue
            let imgPath = path.join(dirPath, file)
            try {
                let bytes = new Uint8Array(await readFile(imgPath))
                if ((bytes.length != 0) && imageHandler) imageHandler(bytes, mimeType)
            } catch (error) {
                console.log(`Could not read file "${file}"`)
            }
        }
        if (imageHandler) imageHandler(new Uint8Array, null)  // Mark the end of the images list
    } catch (error) {
        console.log(`Could not list directory "${dirPath}"`)
    }
}

export { loadFieldImage, setImageHandler}
