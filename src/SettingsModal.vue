<script setup lang="ts">
    import {SettingsData, reloadSettings} from './settings'

    const props = defineProps<{
        /** True if the settings modal must be shown */
        show : boolean
        /** The actual settings data to be presented */
        settings : SettingsData
        /** Method handler for alert messages */
        alertHandler : (title : string, msg : string) => void
    }>()
    const emits = defineEmits<{'hide-settings': []}>()

    function restoreOptions() {
        reloadSettings(props.alertHandler)
    }

    function saveOptions() {
        let lines = (document.getElementById("txtBarMessages") as HTMLTextAreaElement).value.split('\n')
        props.settings.barMessages = lines.map(x => x.trim()).filter((s) => s != "")
        if (props.settings.barMessages.length == 0) props.settings.messageBar = false
        localStorage.setItem('settings', JSON.stringify(props.settings))
    }

</script>

<template>
    <div class="modal" v-bind:class="{'is-active': props.show}">
        <div class="modal-background"></div>
        <div class="modal-card">
            <header class="modal-card-head">
                <p class="modal-card-title">Instellingen</p>
                <button @click="$emit('hide-settings')" class="delete" aria-label="close"></button>
            </header>
            <section class="modal-card-body">
                <div class="field">
                    <div class="control">
                        <label class="checkbox"><input type="checkbox" v-model="props.settings.courtFlash"> Knipperend baannummer</label>
                    </div>
                </div>
                <div class="field">
                    <div class="control">
                        <label class="checkbox"><input type="checkbox" v-model="props.settings.messageBar"> Berichtenbalk</label>
                    </div>
                </div>
                <div class="field">
                    <label class="label">Berichtenlijst</label>
                    <div class="control">
                        <textarea id="txtBarMessages" class="textarea" placeholder="Berichten" rows="10"></textarea>
                    </div>
                </div>
                <div class="field">
                    <div class="control">
                        <label class="checkbox"><input type="checkbox" v-model="props.settings.newMessageEffect"> Bericht update effect</label>
                    </div>
                </div>
            </section>
            <footer class="modal-card-foot">
                <button @click="saveOptions();$emit('hide-settings')" class="button is-success">Ok</button>
                <button @click="restoreOptions();$emit('hide-settings')" class="button">Cancel</button>
            </footer>
        </div>
    </div>
</template>

<style>
</style>
