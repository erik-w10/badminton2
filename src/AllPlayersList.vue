<script setup lang="ts">
    import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
    import { ImportEventHandler, type Player, default as adm } from './player_admin';
    import { doConfirm } from './basic_modals';
    import { type IModalBase, ModalBase } from './modal_base';
    import EditPlayerModal from './EditPlayerModal.vue';
    import { default as nfcCallbacks, NfcHandler } from './nfc_callbacks'
    import { KnownPlayer } from './player';

    const props = defineProps<{
        control : IModalBase,
    }>()
    const emits = defineEmits<{'closed': []}>();

    const editPlayerInfo = reactive(new ModalBase);
    const allowFocus = computed<number>(() => {
        return (props.control.displayed) ? 0 : -1;
    });
    const editedInfo = ref<KnownPlayer>({ name: "", playerId: "", gender: "", level: 1});
    const sortedPlayers = ref<Player[]>(sortPlayers());
    let updatedPlayer : Player|null = null;

    // permanently delete a player from the application
    function askDeletePlayer(player : Player) {
        doConfirm("", "Weet je zeker dat je deze speler wilt verwijderen?", (result) => {
            if (result === 1) {
                adm.deletePlayer(player);
                sortedPlayers.value = sortPlayers();
            }
        })
    }

    function sortPlayers() {
        return adm.players.toSorted((a,b) => a.name < b.name ? -1 : a.name > b.name ? +1 : 0);
    }

    function editPlayer(player : Player) {
        updatedPlayer = player;
        editedInfo.value = player.identity();
        editPlayerInfo.show = true;
    }

    function updatePlayer(doUpdate : boolean) {
        if (doUpdate && (updatedPlayer !== null)) adm.updatePlayerInfo(updatedPlayer, editedInfo.value);
    }

    function doImport() {
        window.myIpc.importPlayers();
    }

    function doExport() {
        let playersJson = adm.exportPlayers();
        if (playersJson !== null) window.myIpc.exportPlayers(playersJson);
    }

    let oldNfcHandler : NfcHandler = null;
    let oldImportHandler : ImportEventHandler = null;
    onMounted(() => {
        oldNfcHandler = nfcCallbacks.setNfcHandler((uid : string) => {
            doConfirm(
                "ID naar clipboard",
                `Gelezen NFC ID ${uid} naar het clipboard ?`,
                (ok) => { if (ok === 1) window.navigator.clipboard.writeText(uid); }
            )
        });
        oldImportHandler = adm.setImportEventHandler(() => {
            sortedPlayers.value = sortPlayers();
        });
    })
    onUnmounted(() => {
        nfcCallbacks.setNfcHandler(oldNfcHandler);
        adm.setImportEventHandler(oldImportHandler);
    })
</script>

<template>
    <div class="modal" v-bind:class="{'is-active': true}">
        <div class="modal-background"></div>
        <div class="modal-card">
            <div class="modal-card-head">
                <h3>Spelerslijst</h3>
                <button @click="doExport" :tabindex="allowFocus">spelers exporteren</button>
                <button @click="doImport" :tabindex="allowFocus">spelers importeren</button>
            </div>
            <section class="modal-card-body">
                <div class="list">
                    <div style="overflow:hidden" class="list-item" :key="player.playerId" v-for="player in sortedPlayers">
                        <b>{{player.name}}</b> ({{player.playerId}})
                        <span style="float:right">
                            <span @click="editPlayer(player)" class="button">bewerken</span>
                            <span @click="askDeletePlayer(player)" class="button is-danger">verwijder</span>
                        </span>
                    </div>
                </div>
            </section>
        </div>
        <button @click="props.control.show=false; $emit('closed')" class="modal-close is-large" aria-label="close" :tabindex="allowFocus"></button>
    </div>
    <EditPlayerModal v-if=editPlayerInfo.show :control="editPlayerInfo" :player="editedInfo" @done="updatePlayer"/>
</template>
