<script setup lang="ts">
    import { ref, onMounted, reactive, computed, nextTick } from 'vue'
    import draggable from 'vuedraggable'
    import NewsBar from './NewsBar.vue'
    import SettingsModal from './SettingsModal.vue'
    import {Player, Court } from './player_admin'
    import {playerTemplate, repairPlayerLists, loadPlayers, playersToLocalStorage, isValidGender, isValidRank, importPlayers, exportPlayers, handleImportData,
        deletePlayer, togglePlayerPresence, clearSelectedPlayer, linkUpdate, tagForLink, linkedPlayer, makePlayerPaused, makePlayerActive, updateSessionState,
        undo, restoreOldState, clearCourt, assignParticipants, UndoOption} from './player_admin'
    import adm from './player_admin'
    import { settingsData, reloadSettings } from './settings'


    // when application starts
    onMounted(() => {
        console.log('Starting');
        reloadSettings(doAlert);
        loadPlayers();
        window.myIpc.onPlayerAdmin(() => {
            showParticipantList.value = true
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
            showSettings.value = true
            stopTimer()
        })
        window.myIpc.onNfcCard((_event : Event, uid : string) => {
            if (showParticipantList.value) {
                doConfirm(
                    "ID naar clipboard",
                    `Gelezen NFC ID ${uid} naar het clipboard ?`,
                    (ok) => { if (ok === 1) window.navigator.clipboard.writeText(uid); }
                )
            }
            else {
                barcode.value = uid
                addNewPlayer()
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
        let oldState = localStorage.getItem('state')
        if (oldState) {
            localStorage.setItem('old_state', oldState);
        }
        startTimer()
    })

    // the used 'ingredients' for the application
    const title = ref('badminton princenhage')
    const amountOfCourts = 8
    const paused = ref(false)
    const linkMode = ref(false)
    const barcode = ref<null|string>(null)

    // whether to show the modals
    const showAddParticipant  = ref(false)
    const showParticipantList = ref(false)
    
    const newPlayer = ref<Player>(Object.assign({}, playerTemplate))
    let timerAni : null|Animation = null
    const nfcAlarm = ref("N")
    let nfcAlarmTimerId : null|NodeJS.Timeout = null
    
    let alertData =    reactive({ title: "", msg: "" })
    const showAlert = ref(false)
    let confirmData =  reactive({ title: "", msg: "", action: (result : number) => {} })
    const showConfirm = ref(false)
    const showSettings = ref(false)

    const enableLinkMode = ref(false)

    // This provides the "tabindex" attribute for input elements in the main screen.  It is set to -1 when any modal is shown.
    const mainAllowFocus = computed<number>(() => {
        return (showAddParticipant || showParticipantList) ? -1 : 0;
    })
    const newsBarText = computed<string[]>(() => {
        return settingsData.messageBar ? settingsData.barMessages : [] as string[];
    })

    const validNewPlayer = computed<boolean>(() => {
        return (newPlayer.value.name.length > 0) &&
        isValidGender(newPlayer.value.gender) &&
        isValidRank(newPlayer.value.ranking);
    });

    // all the applications' functions.
    function doAlert(title : string, msg : string) {
        alertData = { title: title, msg: msg }
        showAlert.value = true
    }

    function doConfirm(title : string, msg : string, actionIn : { (result : number): void } ) {
        confirmData = { title: title, msg: msg, action: (result : number) => {
            showConfirm.value = false
            actionIn(result)
        }}
        showConfirm.value = true
    }

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

    function checkListMove(evt : any) {
        let to_court = (evt.to as HTMLElement).classList.contains('draggable-court')
        if ((!paused.value && to_court) || !evt.draggedContext.element.participating) return false;
        updateSessionState()
    }

    function timeoutHandler()
    {
        (document.getElementById('barcode') as HTMLInputElement).focus()
        const onCourtAssignment = (courtNr : number) => {
                if (settingsData.courtFlash) doFlashAnimation(document.getElementById(`courtTag_${courtNr}`) as HTMLDivElement)
        }
        if (!paused.value) assignParticipants(onCourtAssignment)
    }

    function startTimer() {
        if (timerAni) {
            timerAni.removeEventListener('finish', timeoutHandler);
            timerAni.cancel();
        }
        
        let tba = document.getElementById("timerBar") as HTMLElement
        let keyFrames = { width: ["100%", "0%"] }
        let options : KeyframeAnimationOptions = { duration: 1500, iterations: 1 }
        timerAni = tba.animate(keyFrames, options)
        timerAni.addEventListener('finish', timeoutHandler);
    }

    function stopTimer() {
        if (timerAni && (timerAni.playState === "running")) {
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
            nfcAlarm.value = "N",
            nfcAlarmTimerId = null
        }, 3000)
    }

    function markStateChange(undoOption : UndoOption = UndoOption.DoNothing) {
        if (!showAddParticipant.value && !showParticipantList.value && !paused.value) {
            startTimer()
        }
        updateSessionState(undoOption);
        (document.getElementById('barcode') as HTMLInputElement).focus()
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
        if (player.onCourt != court.courtNr) console.log("togglePausePlayer invariant problem")
        if (player.paused)
        {
            makePlayerActive(player)
            let linked = linkedPlayer(player)
            if (linked) makePlayerActive(linked)
        }
        else
        {
            makePlayerPaused(player)
            let linked = linkedPlayer(player)
            if (linked) makePlayerPaused(linked)
        }
        updateSessionState();
        (document.getElementById('barcode') as HTMLInputElement).focus()
    }

    // checks for new player and shows the new player modal
    function addNewPlayer() {
        if (barcode.value !== null) {
            let player = adm.players.find( p => p.playerId == barcode.value );
            if (!player) {
                newPlayer.value.playerId = barcode.value;
                (document.getElementById('barcode') as HTMLInputElement).blur()
                nextTick( () => (document.getElementById('newPlayerName') as HTMLInputElement).focus() )
                showAddParticipant.value = true;
                stopTimer()
            }
            else {
                changePlayerStatus(player);
                markStateChange()
            }
        }
    }

    // permanently delete a player from the application
    function askDeletePlayer(player : Player) {
        doConfirm("", "Weet je zeker dat je deze speler wilt verwijderen?", (result) => {
            if (result === 1) {
                deletePlayer(player);
            }
        })
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
            pausePlayer(player)
        }
    }

    function pausedPlayerClick(player : Player) {
        if (linkMode.value) {
            linkUpdate(player, doAlert)
        }
        else {
            resumePlayer(player)
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

    // Get the link tag (or emtpy). Note that this function is accesible from Vue elements (tagForLink is not)
    function playerTag(player : Player) {
        return tagForLink(player.link)
    }

    // Pause a player in the waitingPlayers list
    function pausePlayer(player : Player) {
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
    function resumePlayer(player : Player) {
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

    function hideAddParticipant() {
        showAddParticipant.value = false;
        barcode.value = null;
        newPlayer.value = Object.assign({}, playerTemplate)
        markStateChange()
    }

    // adds new player from the new player modal.
    function addParticipant() {
        if (!newPlayer.value.name.length) return
        
        adm.players.push(newPlayer.value);
        playersToLocalStorage();
        adm.waiting.push(newPlayer.value);
        hideAddParticipant()
    }

    function playerClass(player : Player, inList : boolean) {
        let classes = ["list-item"]
        classes.push(inList ? "list-item-players" : "on-court-players");
        if (player.gender == 'm') classes.push('male')
        if (player.gender == 'v') classes.push('female')
        if (player.gender == 'g') classes.push('nomail')
        if (!player.participating) classes.push('gone')
        else if (player.paused) classes.push('paused')
        return classes.join(' ')
    }

    function hideParticipantList() {
        showParticipantList.value = false
        markStateChange()
    }
        
    function hideSettings() {
        showSettings.value = false
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
                <input type="text" id="barcode" v-model="barcode" @keyup.enter="addNewPlayer" :tabindex="mainAllowFocus">
                <div class="participants">
                    <draggable class="draggable-list" :list="adm.waiting" group="participants" itemKey="playerId" ghostClass='ghost'
                    @start="onDragStart" @end="onDragEnd" :move="checkListMove" handle=".dragHdl">
                        <template #item="{ element }">
                            <div class="dragClick" :class="playerClass(element, true)">
                                <div class="labelParts">
                                    <div>{{element.name}}</div>
                                    <div>{{playerTag(element)}}</div>
                                </div>
                                <div class=clickParts>
                                    <div class="dragHdl"></div>
                                    <div class="clickBtn" @click="waitingPlayerClick(element)"></div>
                                    <div class="dragHdl"></div>
                                </div>
                            </div>
                        </template>
                    </draggable>
                </div>
                <!-- Note if you don't use the name 'element' then it won't work -->
                <div class="paused-section">
                    <h4 class="title">Spelers in pauze</h4>
                    <draggable class="draggable-list" :list="adm.paused" group="participants" itemKey="playerId" ghostClass='ghost'
                    @start="onDragStart" @end="onDragEnd" :move="checkListMove" handle=".dragHdl">
                        <template #item="{ element }">
                            <div class="dragClick" :class="playerClass(element, true)">
                                <div class="labelParts">
                                    <div>{{element.name}}</div>
                                    <div>{{playerTag(element)}}</div>
                                </div>
                                <div class=clickParts>
                                    <div class="dragHdl"></div>
                                    <div class="clickBtn" @click.stop="pausedPlayerClick(element)"></div>
                                    <div class="dragHdl"></div>
                                </div>
                            </div>
                        </template>
                    </draggable>
                </div>
            </div>
    
            <div class="courts-section">
                <div id="buttonBar" class="bar" :alarm="nfcAlarm">
                    <div class="buttons">
                        <button class="button is-primary" @click="togglePause()" v-html="paused ? 'Start rotatie': 'Pauzeer'" :tabindex="mainAllowFocus"></button>
                        <button class="button is-primary" @click="doUndo()" :disabled="!adm.canUndo" :tabindex="mainAllowFocus">Herstel</button>
                        <button class="button is-primary" @click="toggleLinkMode()" v-html="linkMode ? 'Links klaar': 'Links bewerken'" v-if="enableLinkMode" :tabindex="mainAllowFocus"></button>
                    </div>
                    <div id="nfc-error" :alarm="nfcAlarm">NFC error</div>
                    <div id=timerArea>
                        <div id="timerText">Timer</div>
                        <div id="timerBar" class="timBar"></div>
                    </div>
                </div>
    
                <div class="courts">
                    <div  v-bind:key="court.courtNr" class="court" v-for="court in adm.courts">
                        <div style="display: flex; justify-content: space-between">
                            <div @click="doCancelAnimations" :id="`courtTag_${court.courtNr}`" class="number">{{court.courtNr}}</div>
                            <div @click="toggleDouble(court)" class="type">{{court.isDouble ? "dubbel" : "enkel"}}</div>
                        </div>
                        <img :class="{inactive: court.paused}" @click="checkout(court)" src="./assets/court.png" alt="">
                        <div id="courtPlayers" class="list">
                            <draggable class="draggable-court" :list="court.players" group="participants" itemKey="playerId" ghostClass='ghost'
                            :move="ifRotationPaused" @start="onDragStart" @end="onDragEnd" handle=".dragHdl" :disabled="!paused" v-if="!court.paused">
                                <template #item="{ element }">
                                    <div class="dragClick" :class="playerClass(element, false)">
                                        <div class="labelParts">
                                            <div>{{element.name}}</div>
                                            <div class="player-tag">{{playerTag(element)}}</div>
                                        </div>
                                        <div class=clickParts>
                                            <div class="dragHdl"></div>
                                            <div class="clickBtn" @click="playerOnCourtClick(element, court)"></div>
                                            <div class="dragHdl"></div>
                                        </div>
                                    </div>
                                </template>
                            </draggable>
                            <div class="list-item training" v-else>TRAININGSBAAN </div>
                        </div>
                    </div>
                </div>
            </div>
    
            <div class="modal" v-bind:class="{'is-active': showAddParticipant}">
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
                                    <input id="newPlayerName" class="input" type="text" placeholder="" v-model="newPlayer.name">
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
                        <button @click="addParticipant" class="button is-success" :disabled="!validNewPlayer">Speler toevoegen</button>
                        <button @click="hideAddParticipant()" class="button">Cancel</button>
                    </footer>
                </div>
                <button @click="hideAddParticipant()" class="modal-close is-large" aria-label="close"></button>
            </div>
    
             <div class="modal" v-bind:class="{'is-active': showParticipantList}">
                <div class="modal-background"></div>
                <div class="modal-card">
                    <div class="modal-card-head">
                        <h3>Spelerslijst</h3>
                        <button @click="exportPlayers">spelers exporteren</button>
                        <button @click="importPlayers">spelers importeren</button>
                    </div>
                    <section class="modal-card-body">
                        <div class="list">
                                <div style="overflow:hidden" class="list-item" v-bind:key="player.playerId" v-for="player in adm.players">
                                    <b>{{player.name}}</b> ({{player.playerId}})
                                <span @click="askDeletePlayer(player)" style="float: right" class="button is-danger">verwijder</span>
                                </div>
                        </div>
                    </section>
    
                </div>
                <button @click="hideParticipantList()" class="modal-close is-large" aria-label="close"></button>
            </div>
    
            <div class="modal" :class="{'is-active': showAlert}">
                <div class="modal-background"></div>
                <div class="modal-card">
                    <header class="modal-card-head">
                        <p class="modal-card-title">{{alertData.title}}</p>
                        <button @click="showAlert=false" class="delete" aria-label="close"></button>
                    </header>
                    <section class="modal-card-body keep-ws">
                        {{alertData.msg}}
                    </section>
                    <footer class="modal-card-foot">
                        <button @click="showAlert=false" class="button">OK</button>
                    </footer>
                </div>
            </div>
    
            <div class="modal" :class="{'is-active': showConfirm }">
                <div class="modal-background"></div>
                <div class="modal-card">
                    <header class="modal-card-head">
                        <p class="modal-card-title">{{confirmData.title}}</p>
                        <button @click="confirmData.action(-1)" class="delete" aria-label="close"></button>
                    </header>
                    <section class="modal-card-body">
                        {{confirmData.msg}}
                    </section>
                    <footer class="modal-card-foot">
                        <button @click="confirmData.action(1)" class="button">Ja</button>
                        <button @click="confirmData.action(0)" class="button">Nee</button>
                    </footer>
                </div>
            </div>
        </div>
        <SettingsModal :show="showSettings" :settings="settingsData" :alert-handler="doAlert" @hide-settings="showSettings=false"/>
        <NewsBar :text="newsBarText" :effect="settingsData.newMessageEffect" />
    </div>
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

    .participants {
        flex: 80 1 20%;
        overflow-y: scroll;
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

    /*
    .list-item-players:hover {
        background: #209cee;
    }
    */

    .male {
        background: #80cee1;
    }

    .female {
        background: #fbccd1;
    }

    .nomail {
        background: #B0C0B0;
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

    .list-item-players:nth-child(4n) {
        border-bottom: 3px solid black;
        margin-bottom: 10px;
        padding-bottom: 10px;
    }

    .on-court-players {
        font-size:  1.3em;
        font-weight: bold;
    }

    .court .list-item {
        color: black;
    }

    .participants {
        border-top: 1px solid black;
        border-bottom: 1px solid black;
    }

    .list-item.gone {
        text-decoration: line-through;
    }

    .list-item.paused {
        font-style: italic;
        color: gray;
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
        Display: None;
    }
    #nfc-error[alarm="Y"] {
        Display: inline;
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
    div#timerBar {
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
    .dragClick {
        position: relative; /* Use as reference for absolute positioning*/
    }
    .labelParts {
        padding: 0px;
        display: flex;
        justify-content: space-between;
    }
    .labelParts .player-tag {
        font-weight: normal;
    }
    .clickParts {
        position: absolute; /* Overlap with the entire parent div*/
        top: 0px;
        left: 0px;
        height: 100%;
        width: 100%;
        padding: 0px;
        display: flex;          /* Make child div centered*/
    }
    .dragHdl {
        flex: 1;
    }
    .clickBtn {
        flex: 3;
    }
    .clickBtn:hover {
        border: 6px solid rgba(255,255,255,.25);
        border-radius: 6px;
    }

</style>
