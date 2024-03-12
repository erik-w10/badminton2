import { reactive } from 'vue';
import { ModalBase } from './modal_base';
import { doAlert } from './basic_modals';

interface ISettings {
    show :              boolean,
    courtFlash :        boolean,
    messageBar :        boolean,
    newMessageEffect :  boolean,
    levelSeparation:    boolean,
    levelIndication:    boolean,
    barMessages :       string[],
    reload :    { () : void },
    save :      { () : void },
};
class Settings extends ModalBase implements ISettings{
    courtFlash : boolean = false;
    messageBar : boolean = false;
    newMessageEffect : boolean = false;
    levelSeparation: boolean = false;
    levelIndication: boolean = false;
    barMessages : string[] = [];

    reload() : void {
        try {
            let stringData = localStorage.getItem('settings');
            if (stringData === null)
            {
                this.courtFlash = false;
                this.messageBar = false;
                this.newMessageEffect = false;
                this.barMessages = [];
                return;
            }
            let oldSettings = JSON.parse(stringData);
            if (typeof(oldSettings.courtFlash) == 'boolean') this.courtFlash = oldSettings.courtFlash;
            if (typeof(oldSettings.messageBar) == 'boolean') this.messageBar = oldSettings.messageBar;
            if (typeof(oldSettings.newMessageEffect) == 'boolean') this.newMessageEffect = oldSettings.newMessageEffect;
            if (typeof(oldSettings.levelSeparation) == 'boolean') this.levelSeparation = oldSettings.levelSeparation;
            if (typeof(oldSettings.levelIndication) == 'boolean') this.levelIndication = oldSettings.levelIndication;
            if (typeof(oldSettings.barMessages) == 'object' && typeof(this.barMessages.length) == 'number') this.barMessages = oldSettings.barMessages;
            console.log("Restored settings");
        }
        catch (e)
        {
            doAlert('Probleem', `Kon oude instellingen niet teruglezen\n'${e}'`);
        }
    }
    save() : void {
        if (this.barMessages.length == 0) this.messageBar = false;
        let toSave = {
            courtFlash       : this.courtFlash,
            messageBar       : this.messageBar,
            newMessageEffect : this.newMessageEffect,
            levelSeparation  : this.levelSeparation,
            levelIndication  : this.levelIndication,
            barMessages      : this.barMessages
        };
        localStorage.setItem('settings', JSON.stringify(toSave));
    }
};

let settings = reactive(new Settings);

export { type ISettings, settings }
