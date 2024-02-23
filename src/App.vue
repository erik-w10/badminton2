<script setup lang="ts">
    import { ref, onMounted, computed, reactive } from 'vue'
    import draggable from 'vuedraggable'
    import NewsBar from './NewsBar.vue'
    import PlayerTile from './PlayerTile.vue'
    import SettingsModal from './SettingsModal.vue'
    import AddPlayerModal from './AddPlayerModal.vue'
    import AlertModal from './AlertModal.vue'
    import ConfirmModal from './ConfirmModal.vue'
    import AllPlayersListModal from './AllPlayersList.vue'
    import { ModalBase } from './modal_base'
    import {type Player, type Court, repairPlayerLists, loadPlayers, playersToLocalStorage, handleImportData,
        togglePlayerPresence, clearSelectedPlayer, linkUpdate, linkedPlayer, makePlayerPaused, makePlayerActive, updateSessionState,
        undo, preserveOldState, restoreOldState, clearCourt, assignParticipants, UndoOption} from './player_admin'
    import adm from './player_admin'
    import { settings } from './settings'
    import { alert, doAlert, confirm, doConfirm } from './basic_modals'
    import { anyModals } from './modal_base'

    // when application starts
    onMounted(() => {
        console.log('Starting');
        settings.reload();
        loadPlayers();
        window.myIpc.onPlayerAdmin(() => {
            allPlayersList.show = true;
            stopTimer()
        })
        window.myIpc.onRestoreSession(() => {
            stopTimer()
            doConfirm("Herladen", "Status van vorige sessie herladen ?", (result : any) => {
                if (result === 1) {
                    restoreOldSessionState()
                }
                startTimer()
            })
        })
        window.myIpc.onShowSettings(() => {
            settings.show = true
            stopTimer()
        })
        window.myIpc.onNfcCard((_event : Event, uid : string) => {
            if (allPlayersList.show) {
                doConfirm(
                    "ID naar clipboard",
                    `Gelezen NFC ID ${uid} naar het clipboard ?`,
                    (ok) => { if (ok === 1) window.navigator.clipboard.writeText(uid); }
                )
            }
            else {
                barcode.value = uid
                checkBarcode()
            }
            nfcAlarm.value = "N"
        })
        window.myIpc.onNfcError((_event : Event, msg : string) => {
            handleNfcError(msg)
        })
        window.myIpc.onImportData((_event : Event, data : any[]) => {
            handleImportData(data, (warnings : string[]) => { doAlert("Meldingen", warnings.join('\n')) })
        })
        for (let i = 0; i < amountOfCourts; i++) {
            addCourt();
        }
        preserveOldState()
        startTimer()
    })

    // the used 'ingredients' for the application
    const title = ref('badminton princenhage')
    const amountOfCourts = 8
    const courtTags = ref<HTMLDivElement[]>([])
    const paused = ref(false)
    const linkMode = ref(false)
    const barcodeInput = ref<HTMLInputElement|null>(null)
    const barcode = ref<null|string>(null)
    const timerBar = ref<HTMLDivElement|null>(null)
    let timerAni : null|Animation = null
    const nfcAlarm = ref("N")
    let nfcAlarmTimerId : null|NodeJS.Timeout = null
    let allPlayersList = reactive(new ModalBase);
    let addPlayer = reactive(new ModalBase);
    
    const enableLinkMode = ref(false)

    // This provides the "tabindex" attribute for input elements in the main screen.  It is set to -1 when any modal is shown.
    const allowFocus = computed<number>(() => {
        return anyModals() ? -1 : 0;
    })
    const newsBarText = computed<string[]>(() => {
        return settings.messageBar ? settings.barMessages : [] as string[];
    })

    function togglePause() {
        paused.value = !paused.value
        if (!paused.value) {
            if (linkMode.value) toggleLinkMode()
        }
        enableLinkMode.value = paused.value
        markStateChange()
    }

    function toggleLinkMode() {
        linkMode.value = !linkMode.value
        clearSelectedPlayer();
    }

    function toggleDouble(court : Court) {
        if (paused.value) court.isDouble = !court.isDouble;
    }

    // Block move from court unless rotation is paused
    function ifRotationPaused(evt : any) {
        return paused.value && (evt.draggedContext.element as Player).participating;
    }

    function checkListMove(evt : any) : boolean {
        let to_court = (evt.to as HTMLElement).classList.contains('draggable-court')
        if ((!paused.value && to_court) || !evt.draggedContext.element.participating) return false;
        updateSessionState()
        return true;
    }

    function timeoutHandler()
    {
        barcodeInput.value?.focus()
        const courtAssignmentHandler = (courtNr : number) => {
                if (settings.courtFlash) doFlashAnimation(courtTags.value[courtNr-1])
            }
        if (!paused.value) assignParticipants(courtAssignmentHandler)
    }

    function startTimer() {
        if (timerAni) {
            timerAni.removeEventListener('finish', timeoutHandler);
            timerAni.cancel();
        }
        if (timerBar.value) {
            let keyFrames = { width: ["100%", "0%"] }
            let options : KeyframeAnimationOptions = { duration: 1500, iterations: 1 }
            timerAni = timerBar.value.animate(keyFrames, options)
            timerAni.addEventListener('finish', timeoutHandler);
        }
    }

    function stopTimer() {
        if (timerAni?.playState === "running") {
            timerAni.removeEventListener('finish', timeoutHandler);
            timerAni.cancel()
        }
    }

    function handleNfcError(msg : string)
    {
        console.log(msg)
        nfcAlarm.value = "Y"
        if (nfcAlarmTimerId) clearTimeout(nfcAlarmTimerId)
        nfcAlarmTimerId = setTimeout(() => {
            nfcAlarm.value = "N";
            nfcAlarmTimerId = null;
        }, 3000)
    }

    function markStateChange(undoOption : UndoOption = UndoOption.DoNothing) {
        if (!anyModals() && !paused.value) {
            startTimer()
        }
        updateSessionState(undoOption);
        barcodeInput.value?.focus();
    }

    function addCourt() {
        let court = {
            courtNr: adm.courts.length + 1,
            isDouble: true,
            paused: false,
            players: []
        }
        adm.courts.push(court);
    }

    // checks out a court
    function checkout(court : Court) {
        if (!court.players.length) {
            court.paused = !court.paused
            markStateChange()
        }
        else {
            clearCourt(court)
            markStateChange(UndoOption.Make)
        }
    }

    // Toggle the pause-requested state of a player on a court
    function togglePlayerPause(player : Player, court : Court) {
        if (player.onCourt != court.courtNr) console.log("togglePausePlayer invariant problem");
        let linked = linkedPlayer(player);
        if (player.paused)
        {
            makePlayerActive(player);
            if (linked) makePlayerActive(linked);
        }
        else
        {
            makePlayerPaused(player);
            if (linked) makePlayerPaused(linked);
        }
        updateSessionState();
        barcodeInput.value?.focus();
    }

    // checks for new player and shows the new player modal
    function checkBarcode() {
        if (barcode.value !== null) {
            let player = adm.players.find( p => p.playerId == barcode.value );
            if (!player) {
                barcodeInput.value?.blur();
                addPlayer.show = true;
                stopTimer();
            }
            else {
                changePlayerStatus(player);
                markStateChange();
            }
        }
    }

    // checks in or checks out player
    function changePlayerStatus(player : Player) {
        togglePlayerPresence(player)
        barcode.value = null;
    }

    function waitingPlayerClick(player : Player) {
        if (linkMode.value) {
            linkUpdate(player, doAlert)
        }
        else {
            pauseWaitingPlayer(player)
        }
    }

    function pausedPlayerClick(player : Player) {
        if (linkMode.value) {
            linkUpdate(player, doAlert)
        }
        else {
            resumePausedPlayer(player)
        }
    }

    function playerOnCourtClick(player : Player, court : Court) {
        if (linkMode.value) {
            linkUpdate(player, doAlert)
        }
        else {
            togglePlayerPause(player, court)
        }
    }

    // Pause a player in the waitingPlayers list
    function pauseWaitingPlayer(player : Player) {
        stopTimer();
        doConfirm('Pauzeren', `${player.name} pauze nemen?`, (result) => {
            if (result == 1) {
                makePlayerPaused(player)
                let linked = linkedPlayer(player)
                if (linked) makePlayerPaused(linked)
            }
            markStateChange()
        })
    }

    // Resume a player in the pausedPlayers list
    function resumePausedPlayer(player : Player) {
        makePlayerActive(player)
        let linked = linkedPlayer(player)
        if (linked) makePlayerActive(linked)
        markStateChange()
    }

    function onDragStart() {
        stopTimer()
    }

    function onDragEnd() {
        // List modifications by dragging can break the onCourt invariant so we always enforce it after a drag operation
        repairPlayerLists()
        markStateChange()
    }

    function resetBarcode() {
        barcode.value = null;
        markStateChange();
    }

    // Adds new player from the new player modal.
    function addNewPlayer(p : Player) {
        if (!p.name.length) return;
        
        adm.players.push(p);
        playersToLocalStorage();
        adm.waiting.push(p);
        resetBarcode();
    }

    function hideSettings() {
        markStateChange()
    }

    function restoreOldSessionState() {
        restoreOldState(doAlert)
    }

    function doUndo() {
        undo(doAlert);
        markStateChange();
    }

    function doFlashAnimation(target : HTMLElement) {
        for (let a of target.getAnimations()) a.cancel();
        let keyFrames = {
            backgroundColor: [ "whitesmoke", "whitesmoke", "gray", "gray"]
        }
        let options : KeyframeAnimationOptions = {
            duration: 500,
            iterations: 360,    // 3 minutes 2*3*60
            direction: "alternate",
            easing: "ease-in-out",
            fill:  "forwards",
        }
        target.animate(keyFrames, options)
    }
    
    function doCancelAnimations(evt : Event) {
        for (let a of (evt.target as HTMLElement).getAnimations()) a.cancel();
    }
</script>

<template>
    <div class="main">
        <div id="elasticMain" class="grid content">
            <div class="participants-section">
                <h4 class="title">Aangemelde spelers</h4>
                <input type="text" ref="barcodeInput" v-model="barcode" @keyup.enter="checkBarcode" :tabindex="allowFocus">
                <div class="waiting-section">
                    <draggable class="draggable-list" :list="adm.waiting" group="participants" itemKey="playerId" ghostClass='ghost'
                    @start="onDragStart" @end="onDragEnd" :move="checkListMove" handle=".dragHdl">
                        <template #item="{ element }">
                            <PlayerTile :player="element" @clicked="waitingPlayerClick(element)" :separator="true" />
                        </template>
                    </draggable>
                </div>
                <!-- Note if you don't use the name 'element' then it won't work -->
                <div class="paused-section">
                    <h4 class="title">Spelers in pauze</h4>
                    <draggable class="draggable-list" :list="adm.paused" group="participants" itemKey="playerId" ghostClass='ghost'
                    @start="onDragStart" @end="onDragEnd" :move="checkListMove" handle=".dragHdl">
                        <template #item="{ element }">
                            <PlayerTile :player="element" @clicked="pausedPlayerClick(element)" :separator="true" />
                        </template>
                    </draggable>
                </div>
            </div>
    
            <div class="courts-section">
                <div id="buttonBar" class="bar">
                    <div class="buttons">
                        <button class="button is-primary" @click="togglePause()" v-html="paused ? 'Start rotatie': 'Pauzeer'" :tabindex="allowFocus"></button>
                        <button class="button is-primary" @click="doUndo()" :disabled="!adm.canUndo" :tabindex="allowFocus">Herstel</button>
                        <button class="button is-primary" @click="toggleLinkMode()" v-html="linkMode ? 'Links klaar': 'Links bewerken'" v-if="enableLinkMode" :tabindex="allowFocus"></button>
                    </div>
                    <div id="nfc-error" :alarm="nfcAlarm">NFC error</div>
                    <div id=timerArea>
                        <div id="timerText">Timer</div>
                        <div ref="timerBar" class="timBar"></div>
                    </div>
                </div>
    
                <div class="courts">
                    <div  v-bind:key="court.courtNr" class="court" v-for="court in adm.courts">
                        <div style="display: flex; justify-content: space-between">
                            <div @click="doCancelAnimations" ref="courtTags" class="number">{{court.courtNr}}</div>
                            <div @click="toggleDouble(court)" class="type">{{court.isDouble ? "dubbel" : "enkel"}}</div>
                        </div>
                        <img :class="{inactive: court.paused}" @click="checkout(court)" src="./assets/court.png" alt="">
                        <div id="courtPlayers" class="list">
                            <draggable class="draggable-court" :list="court.players" group="participants" itemKey="playerId" ghostClass='ghost'
                            :move="ifRotationPaused" @start="onDragStart" @end="onDragEnd" handle=".dragHdl" :disabled="!paused" v-if="!court.paused">
                                <template #item="{ element }">
                                    <PlayerTile :player="element" @clicked="playerOnCourtClick(element, court)" :separator="false" />
                                </template>
                            </draggable>
                            <div class="list-item training" v-else>TRAININGSBAAN </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <NewsBar :text="newsBarText" :effect="settings.newMessageEffect" />
    </div>
    <AddPlayerModal v-if="addPlayer.show" :control="addPlayer" :barcode="barcode" @add="addNewPlayer" @cancel="resetBarcode" />
    <AllPlayersListModal v-if="allPlayersList.show" :control="allPlayersList" @closed="markStateChange"/>
    <AlertModal v-if=alert.show :data="alert" />
    <ConfirmModal v-if=confirm.show :data="confirm" />
    <SettingsModal v-if=settings.show :settings="settings" @close="hideSettings()"/>
</template>


<style>
    @import "./assets/bulma.min.css"
</style>
<style>
    /* width */

    h1 {
        text-align: center;
    }

    html {
        overflow: auto;
    }

    .main {
        user-select: none;
        background: #ECE9E6;
        /* min-height: 100vh; */

        display: flex;      /* parent of elastic main application & fixed height news bar (if enabled) */
        flex-direction: column;
        margin: 0px;
        height: 100vh;      /* divide up the entire screen height in vertical flex boxes */
    }

    #elasticMain {
        /* flex child bit: */
        flex: 1 1 auto;
        margin-bottom: 0px;
    }

    .participants-section {
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    .waiting-section {
        flex: 80 1 20%;
        overflow-y: scroll;
        border-top: 1px solid black;
        border-bottom: 1px solid black;
    }

    .paused-section {
        flex: 20 1 10%;
        overflow-y: scroll;
    }

    .courts-section {
        overflow-y: hidden;
        display: flex;
        flex-direction: column;
        padding-right: 8px;
    }

    .courts {
        /* Flex child bit */
        flex: 1 0 auto;
        overflow-y: hidden;

        user-select: none;
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr;
        grid-gap: 30px 60px;
    }

    .court img {
        width: 100%;
    }

    #courtPlayers {
        height: 13.13rem;
    }

    .grid {
        display: grid;
        grid-template-columns: 1fr 4fr;
        grid-gap: 15px;
    }

    .number {
        color: black;
        font-weight: bold;
        font-size: 1.5em;
    }

    .court {
        position: relative;
    }

    .inactive {
        filter: grayscale(100%);
    }

    .training {
        font-size: 1.4em;
        text-align:center;
        padding-top: 80px;
    }

    .court .dragClick {
        font-size:  1.3em;
        font-weight: bold;
        color: black;
    }

    .ghost {
        opacity: 0.5;
    }

    .draggable-list {
        min-height: 40px;
    }

    #buttonBar {
        /* Flex child bit */
        flex: 0 0 auto;
        overflow-y: hidden;

        /* Flex parent bit */
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
    }
    #nfc-error{
        display: None;
    }
    #nfc-error[alarm="Y"] {
        display: inline;
        justify-content: center;
        align-items: center;
        padding: 4px 120px;
        margin: 4px;
        border-radius: 8px;
        background-color: red;
        color: black;
    }
    div#timerArea {
        margin-right: 10px;
        margin-top: 4px;
        position: relative;     /* Box reference for embedded 'absolute' positioned child elements */
        width: 100px;
        height: 1.5em;
        display: flex;
        background-color: rgb(200, 200, 200);
        border-radius: 6px;
    }
    div#timerText {
        position: absolute;
        height: 100%;
        width: 100%;
        margin: 0px;
        text-align: center;
    }
    div.timBar {
        position: absolute;
        background-color: rgba(50, 50, 50, 0.5);
        border-radius: 6px;
        top: 0px;
        left: 0px;
        height: 100%;
        width: 0%;
        margin: 0px;
    }
    div.buttons {
        display: flex;
        justify-content: space-between;
    }
    .keep-ws {
        white-space: pre-wrap;
    }
    .dragHdl {
        flex: 1;
    }

</style>
