<script setup lang="ts">
    import { ref } from 'vue'
    import { Player } from './player_admin';
    import { type IModalBase } from './modal_base'
    import LevelButtons from './LevelButtons.vue'

    const props = defineProps<{
        control : IModalBase,
        player : Player,
    }>()
    const emits = defineEmits<{'done': [levelOut : number]}>()

    let checkedLevel = (!Number.isInteger(props.player.level) || props.player.level < 1 || props.player.level > 5) ? 1 : props.player.level;
    const level = ref<number>(checkedLevel);
</script>

<template>
    <div class="modal is-active">
        <div class="modal-background"></div>
        <div class="modal-card">
            <div class="modal-card-head">
                <h3>Niveau keuze voor {{ player.name }}</h3>
            </div>
            <section class="modal-card-body">

                <div class="field">
                    <label class="label">Speelniveau</label>
                    <div class="control">
                        <LevelButtons :level="level" @set="(l) => level=l"/>
                    </div>
                </div>

            </section>
            <footer class="modal-card-foot">
                <button @click="props.control.show=false; $emit('done', level)" class="button is-success">Ok</button>
                <button @click="props.control.show=false; $emit('done', checkedLevel)" class="button">Cancel</button>
            </footer>
        </div>
        <button @click="props.control.show=false; $emit('done', checkedLevel)" class="modal-close is-large" aria-label="close"></button>
    </div>
</template>
