<script setup lang="ts">
    import { reactive } from 'vue'
    import type { IAlert } from './basic_modals'
    const props = defineProps<{
        data : IAlert,
    }>()
    const classObject = reactive({
        modal       : true,
        'is-active' : true,
        topModal    : props.data.displayed,
    });
</script>

<template>
    <div :class="classObject">
        <div class="modal-background"></div>
        <div class="modal-card">
            <header class="modal-card-head">
                <p class="modal-card-title">{{data.title}}</p>
                <button @click="data.hide()" class="delete" aria-label="close"></button>
            </header>
            <section class="modal-card-body keep-ws">
                {{ data.msg }}
            </section>
            <footer class="modal-card-foot">
                <button @click="data.hide()" class="button">OK</button>
            </footer>
        </div>
    </div>
</template>
