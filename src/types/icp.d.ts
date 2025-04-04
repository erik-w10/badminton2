
export interface EventDataCallback {
    (evt: Event, data : any[]) : void
}

export interface EventStringCallback {
    (evt: Event, data : string) : void
}

export interface FieldImageCallback {
    (evt: Event, data : ArrayBuffer, mimeType : string|null) : void
}

export interface VoidCallback {
    () : void
}

export interface IMyIpc {
    exportPlayers:      (jsonText : string) => void,
    importPlayers:      () => void,
    onImportData:       (callback : EventDataCallback) => void,
    onPlayerAdmin:      (callback : VoidCallback) => void,
    onRestoreSession:   (callback : VoidCallback) => void,
    onShowSettings:     (callback : VoidCallback) => void,
    onNfcCard:          (callback : EventStringCallback) => void,
    onNfcError:         (callback : EventStringCallback) => void,
    onFieldImage:       (callback : FieldImageCallback) => void,
}

