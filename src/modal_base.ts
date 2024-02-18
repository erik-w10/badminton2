import { ref } from "vue";

interface IModalBase {
    show:   boolean,
    displayed: boolean,
};
class ModalBase implements IModalBase {
    private _show : boolean = false;
    set show(x : boolean) {
        if (x) {
            this.lastModal = ModalBase.activeModal.value;
            ModalBase.activeModal.value = this.thisModal;
            let e = document.activeElement;
            if (e && ( e instanceof HTMLElement)) (e as HTMLElement).blur();
        }
        else {
            ModalBase.activeModal.value = this.lastModal;
        }
        this._show = x;
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
