<script setup lang="ts">
    import { onMounted, onUnmounted, ref, computed } from 'vue';
    import { type IModalBase } from './modal_base';
    import LevelButtons from './LevelButtons.vue';
    import { KnownPlayer } from './player';
    import { default as adm } from './player_admin';
    import { doAlert } from './basic_modals';
    import { default as nfcCallbacks, NfcHandler } from './nfc_callbacks';

    const props = defineProps<{
        control : IModalBase,
        player : KnownPlayer,
    }>()
    const emits = defineEmits<{'done': [doUpdate : boolean]}>()

    props.player.level = (!Number.isInteger(props.player.level) || props.player.level < 1 || props.player.level > 5) ? 1 : props.player.level;
    let oldNfcHandler : NfcHandler = null;
    const oldPlayerId = props.player.playerId;
    const newPlayerId = ref<string>(oldPlayerId);
    const allowFocus = computed<number>(() => {
        return (props.control.displayed) ? 0 : -1;
    });

    onMounted(() => {
        oldNfcHandler = nfcCallbacks.setNfcHandler((uid : string) => {
            newPlayerId.value = uid;
            checkPlayerId();
        });
    })
    onUnmounted(() => {
        oldNfcHandler = nfcCallbacks.setNfcHandler(oldNfcHandler);
    })

    function checkPlayerId() {
        if (newPlayerId.value == oldPlayerId) return;
        let found = adm.players.find((p) => p.playerId == newPlayerId.value);
        if (found !== undefined) {
            doAlert("Ongeldig ID", `Id ${found.playerId} is al in gebruik voor ${found.name}`);
            newPlayerId.value = oldPlayerId;
        }
        else {
            props.player.playerId = newPlayerId.value;
        }
    }

</script>

<template>
    <div class="modal is-active">
        <div class="modal-background"></div>
        <div class="modal-card">
            <div class="modal-card-head">
                <h3>Speler: {{ player.playerId }} {{ player.name }}</h3>
            </div>
            <section class="modal-card-body">
                <div class="field">
                    <label class="label">Naam (+ achternaam)</label>
                    <div class="control">
                        <input ref="nameInput" class="input" type="text" placeholder="" v-model="player.name" :tabindex="allowFocus">
                    </div>
                </div>
                <div class="field">
                    <label class="label">Speler ID</label>
                    <div class="control">
                        <input ref="nameInput" class="input" type="text" placeholder="" v-model="newPlayerId" @keyup.enter="checkPlayerId" @blur="checkPlayerId" :tabindex="allowFocus">
                    </div>
                </div>
                <div class="field">
                    <label class="label">geslacht</label>
                    <div class="control">
                        <div class="select">
                            <select v-model="player.gender" :tabindex="allowFocus">
                                <option value="" disabled>maak een keuze</option>
                                <option value="v">vrouw</option>
                                <option value="m">man</option>
                                <option value="g">genderneutraal</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="field">
                    <label class="label">Speelniveau</label>
                    <div class="control">
                        <LevelButtons :level="player.level" :allow-focus="allowFocus" @set="(l) => player.level=l"/>
                    </div>
                </div>
            </section>
            <footer class="modal-card-foot">
                <button @click="props.control.show=false; $emit('done', true)" class="button is-success" :tabindex="allowFocus">Ok</button>
                <button @click="props.control.show=false; $emit('done', false)" class="button" :tabindex="allowFocus">Cancel</button>
            </footer>
        </div>
        <button @click="props.control.show=false; $emit('done', false)" class="modal-close is-large" aria-label="close" :tabindex="allowFocus"></button>
    </div>
</template>
