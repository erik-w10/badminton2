import { reactive } from "vue";
import { ModalBase } from "./modal_base";

interface IBasicModal {
    title : string,
    msg   : string,
    show  : boolean,
    hide  : () => void
};
class BasicModal extends ModalBase implements IBasicModal {
    title : string = "";
    msg   : string = "";
    hide() {
        this.show = false;
    }
};

interface IAlert extends IBasicModal {
    display : (title : string, msg : string) => void,
};
class AlertClass extends BasicModal implements IAlert {
    display(title : string, msg : string) {
        this.title = title;
        this.msg = msg;
        this.show = true;
    }
};
let alert = reactive(new AlertClass);
function doAlert(title : string, msg : string) { alert.display(title, msg); }

interface IConfirm extends IBasicModal {
    action  : { (result : number) : void },
    display : (title : string, msg : string, action : { (result : number) : void }) => void,
};
class ConfirmClass extends BasicModal implements IConfirm {
    action : { (result : number) : void } = () => {};
    display(title : string, msg : string, action : { (result : number) : void }) {
        this.title = title;
        this.msg = msg;
        this.action = (result : number) => {
            this.show = false;
            action(result);
        }
        this.show = true;
    }
};
let confirm = reactive(new ConfirmClass);
function doConfirm(title : string, msg : string, action : { (result : number) : void }) { confirm.display(title, msg, action); }

export { type IAlert, alert, doAlert, type IConfirm, confirm, doConfirm }
