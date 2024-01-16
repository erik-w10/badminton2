import { reactive } from 'vue'

interface SettingsData {
    courtFlash: boolean;
    messageBar: boolean;
    newMessageEffect: boolean;
    barMessages: string[];
}
let settingsData : SettingsData = reactive({ courtFlash: false, messageBar: false, newMessageEffect: false, barMessages: [] as string[] })

function reloadSettings(alertHandler: (title : string, msg : string) => void) {
    try {
        let stringData = localStorage.getItem('settings')
        if (stringData === null)
        {
            settingsData.courtFlash = false;
            settingsData.messageBar = false;
            settingsData.newMessageEffect = false;
            settingsData.barMessages = [];
            return;
        }
        let oldSettings = JSON.parse(stringData)
        if (typeof(oldSettings.courtFlash) == 'boolean') settingsData.courtFlash = oldSettings.courtFlash;
        if (typeof(oldSettings.messageBar) == 'boolean') settingsData.messageBar = oldSettings.messageBar;
        if (typeof(oldSettings.newMessageEffect) == 'boolean') settingsData.newMessageEffect = oldSettings.newMessageEffect;
        if (typeof(oldSettings.barMessages) == 'object' && typeof(oldSettings.barMessages.length) == 'number')
        {
            settingsData.barMessages = oldSettings.barMessages;
            (document.getElementById("txtBarMessages") as HTMLTextAreaElement).value = settingsData.barMessages.join('\n')
        }
        console.log("Restored settings")
    }
    catch (e)
    {
        alertHandler('Probleem', `Kon oude instellingen niet teruglezen\n'${e}'`)
    }
}

export type { SettingsData }
export { settingsData, reloadSettings }
