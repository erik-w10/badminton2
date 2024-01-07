import { createApp } from 'vue'
import App from './App.vue'
import { IMyIpc } from "./types/icp"

declare global {
    interface Window {
        myIpc: IMyIpc
    }
}

createApp(App).mount('#app')
