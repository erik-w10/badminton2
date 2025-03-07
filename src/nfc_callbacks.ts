
type NfcHandler      = ((uid : string) => void) | null;
type NfcErrorHandler = ((msg : string) => void) | null;

class NfcCallbacks {
    nfcHandler : NfcHandler = null;
    nfcErrorHandler : NfcErrorHandler = null;


    /** set the NFC handler and receive the previous handler back */
    setNfcHandler(handler : NfcHandler)
    {
        let old = this.nfcHandler;
        this.nfcHandler = handler;
        return old;
    }

    /** set the NFC error handler and receive the previous handler back */
    setNfcErrorHandler(handler : NfcErrorHandler)
    {
        let old = this.nfcErrorHandler;
        this.nfcErrorHandler = handler;
        return old;
    }

    onNfc(uid : string) {
        if (this.nfcHandler) this.nfcHandler(uid);
    }

    onNfcError(msg : string) {
        if (this.nfcErrorHandler) this.nfcErrorHandler(msg);
    }
};

let nfcCallbacks = new NfcCallbacks;

export default nfcCallbacks;
export type {NfcCallbacks, NfcHandler, NfcErrorHandler};
