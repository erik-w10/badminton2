import { ref } from "vue";

interface IModalBase {
    show:   boolean,
    readonly displayed: boolean,
};

class ModalBase implements IModalBase {
    private readonly name;

    constructor(name : string)
    {
        this.name = name;
    }
    private _show : boolean = false;
    set show(x : boolean) {
        if (x === this._show) {
            console.log(`Modal ${this.name} is alrealy shown ${x ? 'shown' : 'hidden'}`);
        }
        else {
            this._show = x;
            if (x) {
                if (this.thisModal === ModalBase.activeModal.value) {
                    throw 'ModalBase invariant error';
                }
                this.lastModal = ModalBase.activeModal.value;
                ModalBase.activeModal.value = this.thisModal;
                let e = document.activeElement;
                if (e && ( e instanceof HTMLElement)) (e as HTMLElement).blur();
            }
            else {
                ModalBase.activeModal.value = this.lastModal;
            }
        }
    }
    get show() {
        return this._show;
    }
    get displayed() {
        return this.thisModal == ModalBase.activeModal.value;
    }
    private readonly thisModal = Symbol();
    private lastModal : Symbol|null = null;

    private static activeModal = ref<Symbol|null>(null);
    public static modalsActive() : boolean {
        return ModalBase.activeModal.value !== null;
    }
}

function anyModals() {
    return ModalBase.modalsActive();
}

export { type IModalBase, ModalBase, anyModals }
