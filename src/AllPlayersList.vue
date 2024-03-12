<script setup lang="ts">
    import { computed, reactive, ref } from 'vue';
    import { type Player, importPlayers, exportPlayers, deletePlayer, updatePlayerLevel } from './player_admin';
    import adm from './player_admin'
    import { doConfirm } from './basic_modals';
    import { type IModalBase } from './modal_base';
    import SetLevelModal from './SetLevelModal.vue';
    import {ModalBase} from './modal_base';
    let setLevelInfo = reactive(new ModalBase);

    const props = defineProps<{
        control : IModalBase,
    }>()
    const emits = defineEmits<{'closed': []}>();
    const allowFocus = computed<number>(() => {
        return (props.control.displayed) ? 0 : -1;
    });
    const updatedPlayer = ref<Player|null>(null);

    // permanently delete a player from the application
    function askDeletePlayer(player : Player) {
        doConfirm("", "Weet je zeker dat je deze speler wilt verwijderen?", (result) => {
            if (result === 1) {
                deletePlayer(player);
            }
        })
    }

    function setLevel(player : Player) {
        updatedPlayer.value = player;
        setLevelInfo.show = true;
    }

    function updateLevel(newLevel : number) {
        updatePlayerLevel(updatedPlayer.value as Player, newLevel);
    }
</script>

<template>
    <div class="modal" v-bind:class="{'is-active': true}">
        <div class="modal-background"></div>
        <div class="modal-card">
            <div class="modal-card-head">
                <h3>Spelerslijst</h3>
                <button @click="exportPlayers" :tabindex="allowFocus">spelers exporteren</button>
                <button @click="importPlayers" :tabindex="allowFocus">spelers importeren</button>
            </div>
            <section class="modal-card-body">
                <div class="list">
                    <div style="overflow:hidden" class="list-item" :key="player.playerId" v-for="player in adm.players">
                        <b>{{player.name}}</b> ({{player.playerId}})
                        <span style="float:right">
                            <span @click="setLevel(player)" class="button">set level ({{player.level}})</span>
                            <span @click="askDeletePlayer(player)" class="button is-danger">verwijder</span>
                        </span>
                    </div>
                </div>
            </section>
        </div>
        <button @click="props.control.show=false; $emit('closed')" class="modal-close is-large" aria-label="close" :tabindex="allowFocus"></button>
    </div>
    <SetLevelModal v-if=setLevelInfo.show :control="setLevelInfo" :player="(updatedPlayer as Player)" @done="updateLevel"/>
</template>
