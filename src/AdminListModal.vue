<script setup lang="ts">
    import { onMounted, onUnmounted, ref, reactive, computed } from 'vue';
    import { type IModalBase } from './modal_base';
    import { default as adm } from './player_admin';
    import { Player } from './player';

    const props = defineProps<{
        control : IModalBase,
    }>()

    let oldAdmins = [] as Player[];
    const newAdmins = ref<Player[]>([]);
    const notAdmins = ref<Player[]>([]);
    const selectedNot = ref<string>('');

    const allowFocus = computed<number>(() => {
        return (props.control.displayed) ? 0 : -1;
    });
    const classObject = reactive({
        modal       : true,
        'is-active' : true,
        topModal    : props.control.displayed,
    });

    const comparePlayers = (a : Player, b : Player)=> a.name < b.name ? -1 : a.name > b.name ? +1 : 0;

    function sortLists() {
        newAdmins.value = newAdmins.value.toSorted(comparePlayers);
        notAdmins.value = notAdmins.value.toSorted(comparePlayers);
        selectedNot.value = notAdmins.value.length > 0 ? notAdmins.value[0].playerId : '';
    }
    onMounted(() => {
        oldAdmins = adm.players.filter( p => adm.isAdmin(p.playerId) );
        newAdmins.value = oldAdmins;
        notAdmins.value = adm.players.filter( p => !adm.isAdmin(p.playerId) );
        sortLists();
    });
    onUnmounted(() => {
        adm.adminsToLocalStorage();
    })

    function addAdmin() {
        if (selectedNot.value)
        {
            let p = notAdmins.value.find( x => x.playerId == selectedNot.value );
            if (p !== undefined)
            {
                newAdmins.value.push(p);
                notAdmins.value = notAdmins.value.filter( x => x.playerId !== p.playerId );
                sortLists();
            }
        }
    }

    function removeAdminRights(a : Player) {
        notAdmins.value.push(a);
        newAdmins.value = newAdmins.value.filter( x => x.playerId !== a.playerId )
        sortLists();
    }

    function doUpdateAndClose() {
        oldAdmins.forEach( x => { adm.setAdmin(x.playerId, false) } );
        newAdmins.value.forEach( x => { adm.setAdmin(x.playerId, true) } ); 
        props.control.show = false;
    }

    function deleteDisableCheck(a : Player) {
        return (adm.currentAdmin?.playerId === a.playerId) && (newAdmins.value.length !== 1);
    }
</script>

<template>
    <div :class="classObject">
        <div class="modal-background"></div>
        <div class="modal-card">
            <div class="modal-card-head">
                <h3 class="title">Admin-lijst</h3>
            </div>
            <section class="modal-card-body">
                <div class="list">
                    <div style="overflow:hidden" class="list-item" :key="a.playerId" v-for="a in newAdmins">
                        <div class="listColumns">
                            <div class="listFlexColumn">
                                <span><b>{{a.name}}</b> ({{a.playerId}})</span>
                            </div>
                            <div class="listButtonColumn">
                                <button @click="removeAdminRights(a)" class="button is-danger" :disabled="deleteDisableCheck(a)">verwijder</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div>
                    <div class="columns">
                        <div class="column is-9">
                            <div class="select">
                                <select v-model="selectedNot">
                                    <option v-for="c in notAdmins" :value="c.playerId">{{ c.name }} ({{c.playerId}})</option>
                                </select>
                            </div>
                        </div>
                        <div class="column">
                            <span style="float:right">
                                <button @click="addAdmin()" class="button is-info">voeg toe</button>
                            </span>
                        </div>
                    </div>
                </div>
            </section>
            <footer class="modal-card-foot">
                <button @click=doUpdateAndClose class="button is-success" :tabindex="allowFocus">Ok</button>
                <button @click="props.control.show=false" class="button" :tabindex="allowFocus">Cancel</button>
            </footer>
        </div>
        <button @click="props.control.show=false" class="modal-close is-large" aria-label="close" :tabindex="allowFocus"></button>
    </div>
</template>
