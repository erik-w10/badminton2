<script setup lang="ts">
    import { computed } from 'vue';
    import { type Player, importPlayers, exportPlayers, deletePlayer } from './player_admin';
    import adm from './player_admin'
    import { doConfirm } from './basic_modals';
    import { type IModalBase } from './modal_base';

    const props = defineProps<{
        control : IModalBase,
    }>()
    const emits = defineEmits<{'closed': []}>();
    const allowFocus = computed<number>(() => {
        return (props.control.displayed) ? 0 : -1;
    })

    // permanently delete a player from the application
    function askDeletePlayer(player : Player) {
        doConfirm("", "Weet je zeker dat je deze speler wilt verwijderen?", (result) => {
            if (result === 1) {
                deletePlayer(player);
            }
        })
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
                    <span @click="askDeletePlayer(player)" style="float: right" class="button is-danger">verwijder</span>
                    </div>
                </div>
            </section>
        </div>
        <button @click="props.control.show=false; $emit('closed')" class="modal-close is-large" aria-label="close" :tabindex="allowFocus"></button>
    </div>
</template>
