<template>
<div class="main">
    <div class="grid content">
        <div class="participants-section">
            <h4 class="title">Aangemelde spelers</h4>
            <input type="text" id="barcode" v-model="barcode" @keyup.enter="newParticipant" :tabindex="mainAllowFocus">
            <div class="participants">
                <draggable class="draggable-list" :list="waitingPlayers" group="participants" itemKey="speelNummer" ghostClass='ghost'
                @start="onDragStart" @end="onDragEnd" :move="checkListMove">
                    <template #item="{ element }">
                        <div :class="player_class(element, true)" @click="pausePlayer(element)">
                            {{element.name}}
                        </div>
                    </template>
                </draggable>
            </div>
            <!-- Note if you don't use the name 'element' then it won't work -->
            <div class="paused-section">
                <h4 class="title">Spelers in pauze</h4>
                <draggable class="draggable-list" :list="pausedPlayers" group="participants" itemKey="speelNummer" ghostClass='ghost'
                @start="onDragStart" @end="onDragEnd" :move="checkListMove">
                    <template #item="{ element }">
                        <div :class="player_class(element, true)" @click="resumePlayer(element)">
                            {{element.name}}
                        </div>
                    </template>
                </draggable>
            </div>
        </div>

        <div class="courts-section">
            <div class="bar" :alarm="nfcAlarm">
                <div class="buttons">
                    <button class="button is-primary" @click="togglePause()" v-html="paused ? 'Start rotatie': 'Pauzeer'" :tabindex="mainAllowFocus"></button>
                </div>
                <div id="nfc-error" :alarm="nfcAlarm">NFC error</div>
                <div id="timer-status">
                    Timer: {{timerStatus}}
                </div>
            </div>

            <div class="courts">
                <div  v-bind:key="court.baan" class="court" v-for="court in courts">
                    <div style="display: flex; justify-content: space-between">
                        <div class="number">{{court.baan}}</div>
                        <div @click="court.isDouble =! court.isDouble" class="type">{{court.isDouble ? "dubbel" : "enkel"}}</div>
                    </div>
                    <img :class="{inactive: court.paused}" @click="checkout(court)" src="~@/assets/court.png" alt="">
                    <div class="list" style="min-height: 210px">
                        <draggable class="draggable-court" :list="court.players" group="participants" itemKey="speelNummer" ghostClass='ghost'
                        :move="ifRotationPaused" @start="onDragStart" @end="onDragEnd" v-if="!court.paused">
                            <template #item="{ element }">
                                <div :class="player_class(element, false)" @click="checkoutPlayer(element, court)">
                                    {{element.name}}
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
                                <input class="input" type="text" placeholder="" v-model="newPlayer.name">
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
                    <button @click="addParticipant" class="button is-success">Speler toevoegen</button>
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
                            <div style="overflow:hidden" class="list-item" v-bind:key="participant.speelNummer" v-for="participant in players">
                                <b>{{participant.name}}</b> ({{participant.speelNummer}})
                            <span @click="deleteParticipant(participant)" style="float: right" class="button is-danger">verwijder</span>
                            </div>
                    </div>
                </section>

            </div>
            <button @click="hideParticipantList()" class="modal-close is-large" aria-label="close"></button>
        </div>

    </div>
</div>
</template>

<script>
    import draggable from 'vuedraggable'
    import xlsxParser from 'xlsx-parse-json';

    // for usage of selecting something from the file system.
    const fileDialog = require('file-dialog');

    const playerTemplate = {
        name: "",
        speelNummer: null,
        gender: "",
        ranking: "",
        // State (not persisted):
        participating: true,
        paused: false,
        onCourt: 0           // 0 => not on any court
    };

    const exportLabels = {
        name:           "Naam",
        speelNummer:    "Speler nummer",
        gender:         "Gender",
        ranking:        "Ranking"
    };

    export default {

    name : 'main-page',

    components: {
        draggable,
    },

    // when application starts
    mounted() {
       console.log('test');
        // localStorage.setItem('participants', "[]");

        // gets the participant from storage || sets a new storage item
        if (!localStorage.getItem('participants')) {
            localStorage.setItem('participants', "[]");
        }
        this.players = JSON.parse(localStorage.getItem('participants'));
        this.players.forEach( p => { p.paused = false; p.participating = false; p.onCourt = 0; } )
        window.electronIpc.onPlayerAdmin(() => {
            this.showParticipantList = true
            this.stopTimer()
        })
        window.electronIpc.onRestoreSession(() => {
            if (confirm("Status van vorige sessie herladen ?")) this.restoreOldSessionState()
            this.startTimer()
        })
        window.electronIpc.onNfcCard((_event, uid) => {
            this.barcode = uid
            this.newParticipant()
        })
        window.electronIpc.onNfcError((_event, msg) => {
            this.handleNfcError(msg)
        })
        for (let i = 0; i < this.amountOfCourts; i++) {
            this.addCourt();
        }
        let oldState = localStorage.getItem('state')
        if (oldState) {
            localStorage.setItem('old_state', oldState);
        }
        this.startTimer()
    },

    data() {
        // the used 'ingredients' for the application
        return {
            title: 'badminton princenhage',
            password: 'password',
            amountOfCourts: 8,
            paused: false,
            players: [],            // All all club members and guest pseudo players, present or not (stateless entries)
            waitingPlayers: [],     // Those players[] that are present and waiting to play
            pausedPlayers: [],      // Those players[] that are/were present but currently not playing

            courts: [],             // List of courts containing the list of players[] that are playing on a particular court
            barcode: null,

            // whether to show the modals
            showAddParticipant: false,
            showParticipantList: false,
            newPlayer: Object.assign({}, playerTemplate),

            timerId: null,
            sessionState: {},
            timerCounter: 5,
            nfcAlarm: "N",
            nfcAlarmTimerId: null,
        }
    },
    computed: {
        timerStatus() {
            return (this.timerCounter > 0) ? `${this.timerCounter}` : "-";
        },
        // This provides the "tabindex" attribute for input elements in the main screen.  It is set to -1 when any modal is shown.
        mainAllowFocus() {
            return (this.showAddParticipant || this.showParticipantList) ? -1 : 0;
        }
    },

    // all the applications' functions.
    methods: {

        togglePause() {
            this.paused = !this.paused
            this.markStateChange();
        },

        // Block move from court unless rotation is paused
        ifRotationPaused(evt) {
            return this.paused && evt.draggedContext.element.participating;
        },

        checkListMove(evt)
        {
            let to_court = evt.to.classList.contains('draggable-court')
            if ((!this.paused && to_court) || !evt.draggedContext.element.participating) return false;
            this.updateSessionState()
        },

        timeoutHandler()
        {
            document.getElementById('barcode').focus()
            if (--this.timerCounter > 0) {
                this.timerId = setTimeout(this.timeoutHandler.bind(this), 300)
            }
            else {
                if (!this.paused) this.assignParticipants();
            }
        },

        startTimer() {
            if (this.timerId !== null) clearTimeout(this.timerId)
            this.timerCounter = 5;
            this.timerId = setTimeout( this.timeoutHandler.bind(this), 300)
        },

        stopTimer() {
            if (this.timerId === null) return
            clearTimeout(this.timerId)
            this.timerId = null
        },

        handleNfcError(msg)
        {
            console.log(msg)
            this.nfcAlarm = "Y"
            if (this.nfcAlarmTimerId) clearTimeout(this.nfcAlarmTimerId)
            this.nfcAlarmTimerId = setTimeout(() => {
                 this.nfcAlarm = "N",
                 this.nfcAlarmTimerId = null
            }, 3000)
        },

        markStateChange() {
            if (!this.showAddParticipant && !this.showParticipantList && !this.paused) {
                this.startTimer()
            }
            this.updateSessionState()
            document.getElementById('barcode').focus()
        },

        addCourt() {
            let court = {
                baan: this.courts.length + 1,
                isDouble: true,
                paused: false,
                players: []
            }
            this.courts.push(court);
        },

        // clears one court
        clearCourt(c) {
            c.players.forEach(p => {
                if (p.participating) {
                    if (p.paused) {
                        p.paused = false;
                        this.pausedPlayers.push(p);
                    }
                    else {
                        this.waitingPlayers.push(p);
                    }
                }
                p.onCourt = 0;
            })
            c.players = [];
        },

        // checks out a court
        checkout(court) {
            if (!court.players.length) court.paused = !court.paused
            this.clearCourt(court)
            this.markStateChange()
        },

        playersToLocalStorage() {
            let r = [];
            this.players.forEach( p => r.push({
                // Note 'participating', 'paused' and 'onCourt' are left out
                name:        p.name,
                speelNummer: p.speelNummer,
                gender:      p.gender,
                ranking:     p.ranking
            }))
            localStorage.setItem('participants', JSON.stringify(r));
        },

        exportPlayers() {
            let playersJson = localStorage.getItem('participants');
            window.electronIpc.exportPlayers(playersJson)
        },

        mapImportFields(inp)
        {
            let xl = {};
            for(let l in exportLabels) { xl[l] = l; xl[exportLabels[l]] = l; }
            let out = []
            let warnings = []
            let keyMap = {}
            let ignoredFields = {}
            let noPlayerCount = 0
            inp.forEach( (e, idx) => {
                let o = {};
                for (let fld in e) {
                    let field = fld.trim()
                    if (xl[field] !== undefined) o[xl[field]] = e[field]
                    else if (ignoredFields[field] === undefined) {
                        console.log(`Ignoring field '${field}'`)
                        ignoredFields[field] = true;
                    }
                }
                if (!o.speelNummer) {
                    ++noPlayerCount;
                }
                else {
                    if (keyMap[o.speelNummer] !== undefined) {
                        warnings.push(`Regel ${idx}: DUPLICAAT (${o.name}) ${o.speelNummer} = '${keyMap[o.speelNummer]}'`)
                    }
                    else {
                        if (o.name.trim() !== "")
                        {
                            if (!"vmg".includes(o.gender)) o.gender = 'g'
                            let rank = Number(o.ranking)
                            if (!Number.isInteger(rank) || (rank < 1) || (rank > 3)) rank = 0
                            o.ranking = rank
                            out.push(o)
                            keyMap[o.speelNummer] = o.name;
                        }
                    }
                }
            })
            if (noPlayerCount) warnings.push(`${noPlayerCount} regels bevatten geen spelernummer`)
            if (warnings.length) alert(warnings.join('\n'))
            return out
        },

        importPlayers() {
            fileDialog()
                .then(files => {
                    xlsxParser
                    .onFileSelection(files[0])
                    .then(data => {
                        this.players = this.mapImportFields(Object.values(data)[0]);
                        this.playersToLocalStorage();
                    });
                });
        },

        // Toggle the pause-requested state of a player on a court
        checkoutPlayer(player, court) {
            let idx = court.players.findIndex( (par => par.speelNummer === player.speelNummer ));
            if (idx < 0) return;        // Should not occur (log?)
            court.players[idx].paused = !court.players[idx].paused
            this.updateSessionState()
        },

        // fills the courts with participants
        assignParticipants() {
            let doUpdateState = false
            this.courts.forEach((court) => {
                // check if court is in training mode
                if (!court.paused) {
                    // check if court is double or single
                    let capacity = court.isDouble ? 4 : 2
                    let nrNeeded = capacity - court.players.length
                    if (nrNeeded > this.waitingPlayers.length)
                    {
                        if (court.players.length)
                        {
                            doUpdateState = true
                            this.clearCourt(court)
                        }
                    }
                    else
                    {
                        for(let i=0; i< nrNeeded; ++i)
                        {
                            let p = this.waitingPlayers.shift()
                            p.onCourt = court.baan
                            p.paused = false
                            court.players.push(p)
                            doUpdateState = true
                        }
                    }
                }
            });
            if (doUpdateState) this.updateSessionState()
        },

        participantExists(participant) {
            return participant.speelNummer == this.barcode;
        },

        // checks for new participant and shows the new player modal
        newParticipant() {
            if (this.barcode !== null) {
                let participant = this.players.find(this.participantExists);
                if (!participant) {
                    this.newPlayer.speelNummer = this.barcode;
                    this.showAddParticipant = true;
                    this.stopTimer()
                }
                else {
                    this.changeParticipantStatus(participant);
                    this.markStateChange()
                }
            }
        },

        // permanently deletes a player from the application
        deleteParticipant(participant) {
            let confirm = window.confirm("Weet je zeker dat je deze speler wilt verwijderen?");
            if (confirm) {
                let filter = el => el.speelNummer !== participant.speelNummer;
                this.waitingPlayers = this.waitingPlayers.filter(filter);
                this.pausedPlayers = this.pausedPlayers.filter(filter);
                this.courts.forEach( c => c.players = c.players.filter(filter) );
                this.players = this.players.filter(filter);
                this.playersToLocalStorage();
            }
        },

        // checks in or checks out player
        changeParticipantStatus(participant) {
            let index = this.players.findIndex( (par) => {
                return participant.speelNummer === par.speelNummer;
            })
            if (index < 0) return;
            let p = this.players[index];
            p.participating = !p.participating;
            if (!p.participating)
            {
                let filter = el => el.speelNummer !== participant.speelNummer;
                this.waitingPlayers = this.waitingPlayers.filter(filter);
                this.pausedPlayers = this.pausedPlayers.filter(filter);
                // If onCourt then player is left on the screen until the court is cleared
            }
            else
            {
                // Note: when a player is on court, checks out and checks in again then this just undoes the check out
                if (!p.onCourt) this.waitingPlayers.push(p);
            }
            this.updateSessionState()
            this.barcode = null;
        },

        // Pause a player in the waitingPlayers list
        pausePlayer(player) {
            if ( !confirm(`${player.name} pauze nemen?`, 'Pauzeren') ) return
            let id = player.speelNummer
            let idx = this.waitingPlayers.findIndex(e => e.speelNummer === id)
            if (idx < 0) return
            this.waitingPlayers.splice(idx, 1)
            this.pausedPlayers.push(player)
            this.markStateChange()
        },

        // Resume a player in the pausedPlayers list
        resumePlayer(player) {
            let id = player.speelNummer
            let idx = this.pausedPlayers.findIndex(e => e.speelNummer === id)
            if (idx < 0) return;
            this.pausedPlayers.splice(idx, 1)
            this.waitingPlayers.push(player)
            this.markStateChange()
        },

        onDragStart() {
            this.stopTimer()
        },

        onDragEnd() {
            // List modifications by dragging can break the onCourt invariant so we always enforce it after a drag operation
            this.waitingPlayers.forEach (p => p.onCourt = 0)
            this.pausedPlayers.forEach  (p => p.onCourt = 0)
            this.courts.forEach((c, idx) => {
                c.players.forEach(p => p.onCourt = idx)
            })
            this.markStateChange()
        },

        hideAddParticipant() {
            this.showAddParticipant = false;
            this.barcode = null;
            this.newPlayer = Object.assign({}, playerTemplate)
            this.markStateChange()
        },

        // adds new player from the new player modal.
        addParticipant() {
            if (!this.newPlayer.name.length) return

            this.newPlayer.speelNummer = this.barcode;

            this.players.push(this.newPlayer);
            this.playersToLocalStorage();
            this.waitingPlayers.push(this.newPlayer);
            this.hideAddParticipant()
        },

        player_class(par, group) {
            let classes = ["list-item"]
            classes.push(group ? "list-item-players" : "on-court-players");
            if (par.gender == 'm') classes.push('male')
            if (par.gender == 'v') classes.push('female')
            if (par.gender == 'g') classes.push('nomail')
            if (!par.participating) classes.push('gone')
            else if (par.paused) classes.push('paused')
            return classes.join(' ')
        },

        hideParticipantList() {
            this.showParticipantList = false
            this.markStateChange()
        },

        updateSessionState() {
            let state = {
                w: [],      // Waiting players
                p: [],      // Paused players
                c: [],      // On court players (with to-be-paused/gone state)
            }
            this.waitingPlayers.forEach( e => state.w.push(e.speelNummer))
            this.pausedPlayers.forEach(  e => state.p.push(e.speelNummer))
            // A court record consists of a state character ('p' paused, '2' double, '1' single), followed by an array of 2-entry player arrays:
            // One player array consists of the player ID, followed by the state, 'g' gone, 'p' to-be-paused, '-' normal/active
            this.courts.forEach( (c) => {
                let record = { s: c.paused ? 'p' : c.isDouble ? '2' : '1', p: []};
                c.players.forEach(p => record.p.push([p.speelNummer, !p.participating ? 'g' : p.paused ? 'p' : '-']))
                state.c.push(record)
            })
            localStorage.setItem('state', JSON.stringify(state))
        },

        resetSessionState() {
            this.waitingPlayers = []
            this.pausedPlayers = []
            this.courts.forEach(c => {
                c.isDouble = true
                c.paused = false
                c.players = []
            })
            this.players.forEach( p => { p.paused = false; p.participating = false; p.onCourt = 0; } )
        },

        restoreOldSessionState() {
            this.resetSessionState()
            try {
                let usedIds = {};
                let oldState = JSON.parse(localStorage.getItem('old_state'))
                if (!oldState)                      throw new Error("Old state not found");
                oldState.w.forEach( id => {
                    if (typeof(id) != 'string')     throw new Error("ID type is not 'string'")
                    if (usedIds[id] !== undefined)  throw new Error(`ID ${id} is used twice`)
                    usedIds[id] = true;
                    let p = this.players.find(e => e.speelNummer === id)
                    if (p === undefined)            throw new Error(`ID ${id} is not a known participant`)
                    p.participating = true
                    this.waitingPlayers.push(p)
                })
                oldState.p.forEach( id => {
                    if (typeof(id) != 'string')     throw new Error("ID type is not 'string'")
                    if (usedIds[id] !== undefined)  throw new Error(`ID ${id} is used twice`)
                    usedIds[id] = true;
                    let p = this.players.find(e => e.speelNummer === id)
                    if (p === undefined)            throw new Error(`ID ${id} is not a known participant`)
                    p.participating = true
                    this.pausedPlayers.push(p)
                })
                if (oldState.c.length != this.courts.length) throw new Error(`Nr of courts doesn't match`)
                oldState.c.forEach( (c, idx) => {
                    let courtState = c.s;
                    if ((courtState.length != 1) || !"p21".includes(courtState)) throw new Error(`Invalid court state '${courtState}'`)
                    if ((courtState == 'p') && (c.p.length != 0)) throw new Error("Paused court contained players")
                    this.courts[idx].paused = (courtState === 'p')
                    this.courts[idx].isDouble = (courtState !== '1')
                    c.p.forEach( rec => {
                        if (rec.length != 2)        throw new Error("Player on court record length is not 2")
                        let id = rec[0]
                        let playerState = rec[1]
                        if (typeof(id) != 'string') throw new Error("ID type is not 'string'")
                        if (typeof(playerState) != 'string') throw new Error("On-court player state type is not 'string'")
                        if ((playerState.length != 1) || !"gp-".includes(playerState)) throw new Error("Invalid on-court player state")
                        if (usedIds[id] !== undefined) throw new Error(`ID ${id} is used twice`)
                        usedIds[id] = true;
                        let p = this.players.find(e => e.speelNummer === id)
                        if (p === undefined) throw new Error(`ID ${id} is not a known participant`)
                        this.courts[idx].players.push(p)
                        p.paused = (playerState === "p")
                        p.participating = (playerState !== "g")
                        p.onCourt = idx
                    })
                })
                console.log("Restored previous session state")
                this.updateSessionState()
            }
            catch (e)
            {
                alert(`De vorige sessie kon niet worden herladen\n'${e}'`)
                this.resetSessionState()
            }
        }
    }
}
</script>

<style>
    @import "@/assets/bulma.min.css"
</style>
<style>
  /* width */

    h1 {
        text-align: center;
    }

    .main {
        background: #ECE9E6;  /* fallback for old browsers */
        /*
        background: -webkit-linear-gradient(to top, #FFFFFF, #ECE9E6);  / * Chrome 10-25, Safari 5.1-6 * /
        background: linear-gradient(to top, #FFFFFF, #ECE9E6); / * W3C, IE 10+/ Edge, Firefox 16+, Chrome 26+, Opera 12+, Safari 7+ * /
        */
        min-height: 100vh;
    }

    .courts {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr;
        grid-gap: 80px;
    }

    .court img {
        width: 100%;
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

    .participants {
        height: 60vh;
        overflow-y: scroll;
    }

    .paused-section {
        height: 30vh;
        overflow-y: scroll;
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

    .draggable {
        min-height: 100px;
    }

    div.bar {
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
    }
    #timer-status {
        display: flex;
        margin-right: 10px;
        align-items: right;
        width: 60px
    }
    div.buttons {
        display: flex;
        justify-content: space-between;
    }

</style>