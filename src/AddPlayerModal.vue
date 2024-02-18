<script setup lang="ts">
    import { computed, onMounted, ref } from 'vue'
    import { Player, playerTemplate, isValidGender, isValidRank } from './player_admin';
    import { type IModalBase } from './modal_base'

    const props = defineProps<{
        control : IModalBase,
        barcode : string|null,
    }>()
    const emits = defineEmits<{'add': [p : Player], 'cancel': []}>()

    const newPlayer = ref<Player>(Object.assign({}, playerTemplate));

    const validNewPlayer = computed<boolean>(() => {
        return (newPlayer.value.name.length > 0)
            && isValidGender(newPlayer.value.gender)
            && isValidRank(newPlayer.value.ranking);
    });

    const nameInput = ref<HTMLInputElement|null>(null);

    // Release reference to the new player and set newPlayer to a new default object
    function getPlayer() : Player
    {
        let p = newPlayer.value;
        newPlayer.value = Object.assign({}, playerTemplate);
        return p;
    }

    onMounted(() => {
        newPlayer.value.playerId = props.barcode || "";
        nameInput.value?.focus();
    })
</script>

<template>
    <div class="modal is-active">
        <div class="modal-background"></div>
        <div class="modal-card">
            <div class="modal-card-head">
                <h3>Welkom nieuwe speler!</h3>
            </div>
            <section class="modal-card-body">
                <form action="">
                    <div class="field">
                        <label class="label">Naam (+ achternaam)</label>
                        <div class="control">
                            <input ref="nameInput" class="input" type="text" placeholder="" v-model="newPlayer.name">
                        </div>
                    </div>

                    <div class="field">
                        <label class="label">geslacht</label>
                        <div class="control">
                            <div class="select">
                                <select v-model="newPlayer.gender">
                                    <option value="" disabled>maak een keuze</option>
                                    <option value="v">vrouw</option>
                                    <option value="m">man</option>
                                    <option value="g">genderneutraal</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="field">
                        <label class="label">Ranking (experimenteel)</label>
                        <div class="control">
                            <div class="select">
                                <select v-model="newPlayer.ranking">
                                    <option value="" disabled>Selecteer je ranking</option>
                                    <option value="1">Beginner</option>
                                    <option value="2">Gevorderd</option>
                                    <option value="3">Professioneel</option>
                                </select>
                            </div>
                        </div>
                    </div>

                </form>
            </section>
            <footer class="modal-card-foot">
                <button @click="props.control.show=false; $emit('add', getPlayer())" class="button is-success" :disabled="!validNewPlayer">Speler toevoegen</button>
                <button @click="props.control.show=false; $emit('cancel')" class="button">Cancel</button>
            </footer>
        </div>
        <button @click="props.control.show=false; $emit('cancel')" class="modal-close is-large" aria-label="close"></button>
    </div>
</template>
