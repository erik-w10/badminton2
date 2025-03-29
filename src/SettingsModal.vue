<script setup lang="ts">
    import { onMounted, ref, reactive } from 'vue';
    import { ISettings } from './settings';

    let scratchMessages = ref("");

    const props = defineProps<{
        /** The actual settings data to be presented */
        settings : ISettings;
    }>()
    const emits = defineEmits<{'close': []}>()
    const classObject = reactive({
        modal       : true,
        'is-active' : true,
        topModal    : props.settings.displayed,
    });

    function doSave() {
        props.settings.barMessages = scratchMessages.value.split('\n').map(x => x.trim()).filter((s) => s != "");
        props.settings.save();
        props.settings.show = false;
    }
    function doCancel() {
        props.settings.reload();
        props.settings.show = false;
    }

    onMounted(() => {
        scratchMessages.value = props.settings.barMessages.join('\n');
    });
</script>

<template>
    <div :class="classObject">
        <div class="modal-background"></div>
        <div class="modal-card">
            <header class="modal-card-head">
                <p class="modal-card-title">Instellingen</p>
                <button @click="doCancel();$emit('close')" class="delete" aria-label="close"></button>
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
                        <textarea id="txtBarMessages" class="textarea" placeholder="Berichten" v-model="scratchMessages" rows="10"></textarea>
                    </div>
                </div>
                <div class="field">
                    <div class="control">
                        <label class="checkbox"><input type="checkbox" v-model="props.settings.newMessageEffect"> Bericht update effect</label>
                    </div>
                </div>
                <div class="field">
                    <div class="control">
                        <label class="checkbox"><input type="checkbox" v-model="props.settings.levelSeparation"> Niveau-afhankelijke veldtoekenning</label>
                    </div>
                </div>
                <div class="field">
                    <div class="control">
                        <label class="checkbox"><input type="checkbox" v-model="props.settings.levelIndication"> Niveau-indicatie</label>
                    </div>
                </div>
            </section>
            <footer class="modal-card-foot">
                <button @click="doSave();$emit('close')" class="button is-success">Ok</button>
                <button @click="doCancel();$emit('close')" class="button">Cancel</button>
            </footer>
        </div>
    </div>
</template>

<style>
</style>
