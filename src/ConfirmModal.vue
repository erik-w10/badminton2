<script setup lang="ts">
    import type { IConfirm } from './basic_modals'
    const props = defineProps<{
        data : IConfirm,
    }>()
</script>

<template>
    <div class="modal is-active">
        <div class="modal-background"></div>
        <div class="modal-card">
            <header class="modal-card-head">
                <p class="modal-card-title">{{data.title}}</p>
                <button @click="data.action(-1)" class="delete" aria-label="close"></button>
            </header>
            <section class="modal-card-body">
                {{data.msg}}
            </section>
            <footer class="modal-card-foot">
                <button @click="data.action(1)" class="button">Ja</button>
                <button @click="data.action(0)" class="button">Nee</button>
            </footer>
        </div>
    </div>
</template>
