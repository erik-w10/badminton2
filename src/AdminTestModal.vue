<script setup lang="ts">
    import { onMounted, ref, reactive, computed } from 'vue';
    import { default as adm } from './player_admin';
    import { IAdminTest } from './admin_test';
    import { default as nfcCallbacks, NfcHandler } from './nfc_callbacks';

    const props = defineProps<{
        data : IAdminTest,
    }>()

    let oldNfcHandler : NfcHandler | null = null;
    let oldNfcErrorHandler : NfcHandler | null = null;
    const allowFocus = computed<number>(() => {
        return (props.data.displayed) ? 0 : -1;
    });
    const classObject = reactive({
        modal       : true,
        'is-active' : true,
        topModal    : props.data.displayed,
    });
    let success = false;
    const message = ref<string>("Scan de NFC-tag met admin rechten");

    onMounted(() => {
        success = false;
        oldNfcHandler = nfcCallbacks.setNfcHandler((uid : string) => {
            success = adm.trySetCurrentAdmin(uid);
            if (success) {
                doClose();
            }
            else {
                message.value = `${uid} heeft geen admin rechten`;
            }
        });
        oldNfcErrorHandler = nfcCallbacks.setNfcErrorHandler((_msg : string) => {
            message.value = `NFC-tag leesfout`;
        }); 
    })

    function doClose() {
        nfcCallbacks.setNfcHandler(oldNfcHandler);
        nfcCallbacks.setNfcErrorHandler(oldNfcErrorHandler);
        props.data.action(success);
    }
</script>

<template>
    <div :class="classObject">
        <div class="modal-background"></div>
        <div class="modal-card">
            <div class="modal-card-head">
                <h3 class="title">Admin identificatie vereist (NFC-tag)</h3>
            </div>
            <section class="modal-card-body">
                {{ message }}
            </section>
            <footer class="modal-card-foot">
                <button @click="doClose()" class="button" :tabindex="allowFocus">Cancel</button>
            </footer>
        </div>
        <button @click="doClose()" class="modal-close is-large" aria-label="close" :tabindex="allowFocus"></button>
    </div>
</template>
