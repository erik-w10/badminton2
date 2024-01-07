<template>
<div class="main">
    <div id="elasticMain" class="grid content">
        <div class="participants-section">
            <h4 class="title">Aangemelde spelers</h4>
            <input type="text" id="barcode" v-model="barcode" @keyup.enter="addNewPlayer" :tabindex="mainAllowFocus">
            <div class="participants">
                <draggable class="draggable-list" :list="waitingPlayers" group="participants" itemKey="playerId" ghostClass='ghost'
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
                <draggable class="draggable-list" :list="pausedPlayers" group="participants" itemKey="playerId" ghostClass='ghost'
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
                    <button class="button is-primary" @click="doUndo()" :disabled="disableUndo" :tabindex="mainAllowFocus">Herstel</button>
                    <button class="button is-primary" @click="toggleLinkMode()" v-html="linkMode ? 'Links klaar': 'Links bewerken'" :disabled="disableLinkMode" :tabindex="mainAllowFocus"></button>
                </div>
                <div id="nfc-error" :alarm="nfcAlarm">NFC error</div>
                <div id=timerArea>
                    <div id="timerText">Timer</div>
                    <div id="timerBar" class="timBar"></div>
                </div>
            </div>

            <div class="courts">
                <div  v-bind:key="court.courtNr" class="court" v-for="court in courts">
                    <div style="display: flex; justify-content: space-between">
                        <div @click="doCancelAnimations" :id="`courtTag_${court.courtNr}`" class="number">{{court.courtNr}}</div>
                        <div @click="toggleDouble(court)" class="type">{{court.isDouble ? "dubbel" : "enkel"}}</div>
                    </div>
                    <img :class="{inactive: court.paused}" @click="checkout(court)" src="~@/assets/court.png" alt="">
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
                            <div style="overflow:hidden" class="list-item" v-bind:key="player.playerId" v-for="player in players">
                                <b>{{player.name}}</b> ({{player.playerId}})
                            <span @click="deletePlayer(player)" style="float: right" class="button is-danger">verwijder</span>
                            </div>
                    </div>
                </section>

            </div>
            <button @click="hideParticipantList()" class="modal-close is-large" aria-label="close"></button>
        </div>

        <div class="modal" :class="{'is-active': alertData.show}">
            <div class="modal-background"></div>
            <div class="modal-card">
                <header class="modal-card-head">
                    <p class="modal-card-title">{{alertData.title}}</p>
                    <button @click="alertData.show=false" class="delete" aria-label="close"></button>
                </header>
                <section class="modal-card-body keep-ws">
                    {{alertData.msg}}
                </section>
                <footer class="modal-card-foot">
                    <button @click="alertData.show=false" class="button">OK</button>
                </footer>
            </div>
        </div>

        <div class="modal" :class="{'is-active': confirmData.show}">
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

        <div class="modal" :class="{'is-active': settingsData.show}">
            <div class="modal-background"></div>
            <div class="modal-card">
                <header class="modal-card-head">
                    <p class="modal-card-title">Instellingen</p>
                    <button @click="hideSettings()" class="delete" aria-label="close"></button>
                </header>
                <section class="modal-card-body">
                    <div class="field">
                        <div class="control">
                            <label class="checkbox"><input type="checkbox" v-model="settingsData.courtFlash"> Knipperend baannummer</label>
                        </div>
                    </div>
                    <div class="field">
                        <div class="control">
                            <label class="checkbox"><input type="checkbox" v-model="settingsData.messageBar"> Berichtenbalk</label>
                        </div>
                    </div>
                    <div class="field">
                        <label class="label">Berichtenlijst</label>
                        <div class="control">
                            <textarea id="txtBarMessages" class="textarea" placeholder="Berichten" rows="10"></textarea>
                        </div>
                    </div>
                    <div class="field">
                        <div class="control">
                            <label class="checkbox"><input type="checkbox" v-model="settingsData.newMessageEffect"> Bericht update effect</label>
                        </div>
                    </div>
                </section>
                <footer class="modal-card-foot">
                    <button @click="saveOptions()" class="button is-success">Ok</button>
                    <button @click="restoreOptions()" class="button">Cancel</button>
                </footer>
            </div>
        </div>
    </div>

    <div id="newsBar" :class="`${settingsData.messageBar ? 'barOn' : 'barOff'}`">
        <div id="newsBarShift">
            <!-- Some alternatives: star &#9733, badminton &#127992, megaphone &#128226  -->
            <div><div><span class="newsEmoji">&#128226;</span><span id="oldNews">(old news)</span></div></div>
            <div><div><span class="newsEmoji">&#128226;</span><span id="newNews">(new news)</span></div></div>
        </div>
    </div>
</div>
</template>

<script>
    import { nextTick } from 'process';
    import draggable from 'vuedraggable'
    import xlsxParser from 'xlsx-parse-json';

    const makeUndoPoint = 1;
    const keepUndoPoint = 2;

    const playerTemplate = {
        name: "",
        playerId: null,
        gender: "",
        ranking: "",
        // State (not persisted):
        participating: true,
        paused: false,
        onCourt: 0           // 0 => not on any court
        // Note: additionally a numeric "link" field may be present when the player is (being) linked to another,
        //       link is then the proper playerLinks[] index plus 1 or 0 when no second player is selected yet.
    };

    const labelMap = {
        "name":             "name",
        "Naam":             "name",
        "playerId":         "playerId",
        "speelNummer":      "playerId",
        "Spelernummer":     "playerId",
        "Speler nummer":    "playerId",
        "gender":           "gender",
        "Gender":           "gender",
        "ranking":          "ranking",
        "Ranking":          "ranking",
    }
    // Format: an entry is null (not used) or [ player1, player2 ] i.e. references to both players structures
    // The array index + 1 is stored in the player link field and corresponds to a tag character (a digit in a circle starting at (1))
    let playerLinks = []

    // Link two players
    function createLink(player1, player2) {
        let idx = playerLinks.findIndex(e => e === null)
        if (idx < 0) {
            idx = playerLinks.length
            playerLinks.push([player1, player2])
        }
        else {
            playerLinks[idx] = [player1, player2]
        }
        player1.link = idx+1
        player2.link = idx+1
    }

    // Compute the proper tag indicator (character) to show after the player name based on the player link field value specified as argument
    function tagForLink(link) {
        if (link === undefined) return ""           // Not linked (no tag)
        if (link === 0) return "\u{25C4}"           // Selected in link assigment: left pointing triangle
        if (link > 20)  return "\u{1F517}"          // Link symbol
        return String.fromCodePoint(9311 + link)    // Digit 1..20 in a circle
    }

    // Break the link with the specified number (>= 1).
    function breakLink(linkNr) {
        if (linkNr < 1 || linkNr > playerLinks.length) throw new Error(`Unknown link number ${linkNr}`)
        let idx = linkNr-1
        if (playerLinks[idx]) {
            delete(playerLinks[idx][0].link)
            delete(playerLinks[idx][1].link)
            playerLinks[idx] = null
        }
    }

    // Rebuild playerLinks based on the recovered / reloaded / imported list of players specified
    function rebuildPlayerLinks(players)
    {
        let maxLink = players.reduce((max, p) => (((p.link || 0) <= max) ? max : p.link ), 0)
        playerLinks = []
        for (let idx = 0; idx < maxLink; ++idx)
        {
            let entry = null
            let linked = players.filter(e => e.link === idx+1)
            if (linked.length > 2) throw new Error(`More than 2 players have link number ${idx+1}`)
            if (linked.length === 2) {
                entry = linked
            }
            else {
                linked.forEach(e => delete(e.link))
            }
            playerLinks.push(entry)
        }
    }

    function isValidGender(gen) {
        return (typeof(gen) === 'string') && (gen.length == 1) && "vmg".includes(gen);
    }
    function isValidRank(rank) {
        return (typeof(rank) === 'string') && (rank.length == 1) && "123".includes(rank);
    }

    let allNews = []
    let lastNews = ""
    let newsIndex = 0
    let newsTimer = null
    let updateEffect = false

    function startNews(lines, effectEnable) {
        if (newsTimer !== null) {
            clearInterval(newsTimer)
            newsTimer = null
        }
        allNews = lines
        lastNews = ""
        newsIndex = 0
        updateEffect = effectEnable
        if (allNews.length != 0) {
            newsTimer = setInterval(newsUpdate, 10000)
            newsUpdate(null)
        }
    }

    function newsUpdate() {
        let nbs = document.getElementById("newsBarShift")
        let on = document.getElementById("oldNews")
        let nn = document.getElementById("newNews")

        on.innerText = lastNews
        if (newsIndex >= allNews.length) newsIndex = 0
        lastNews = allNews[newsIndex++]
        nn.innerText = lastNews

        let keyFrames = {
            top: ["0%", "-100%"]
        }
        let options = {
            duration: 1000,
            iterations: "1",
            easing: "ease-in-out",
            fill:  "forwards",
        }
        let anim = nbs.animate(keyFrames, options)
        if (updateEffect) anim.onfinish = () => {
            let nn = document.getElementById("newNews")
            let color = "rgb(255,117,37)"
            let keyFrames = [
                {offset: 0.0, color: `red`, textShadow: `2px 2px 2px ${color}, -2px -2px 2px ${color}` },
                {offset: 0.1, color: "unset", textShadow: `2px 2px 2px ${color}, -2px -2px 2px ${color}` },
                {offset: 1, textShadow: `0px 0px 0px ${color}` }
            ]
            let options = {
                duration: 3000,
                iterations: "1",
                easing: "ease-in-out",
                fill:  "forwards",
            }
            nn.animate(keyFrames, options)
        }
    }

    export default {

    name : 'main-page',

    components: {
        draggable,
    },

    // when application starts
    mounted() {
        console.log('Starting');
        this.reloadSettings();
        // localStorage.setItem('participants', "[]");
        // gets the player from storage || sets a new storage item
        if (!localStorage.getItem('participants')) {
            localStorage.setItem('participants', "[]");
        }
        this.players = JSON.parse(localStorage.getItem('participants'));
        this.players.forEach( p => { if (p.speelNummer !== undefined) { p.playerId = p.speelNummer; delete p.speelNummer; }})
        this.players.forEach( p => { p.paused = false; p.participating = false; p.onCourt = 0; delete(p.link); } )
        window.electronIpc.onPlayerAdmin(() => {
            this.showParticipantList = true
            this.stopTimer()
        })
        window.electronIpc.onRestoreSession(() => {
            this.stopTimer()
            this.doConfirm("Herladen", "Status van vorige sessie herladen ?", (result) => {
                if (result === 1) {
                    this.restoreOldSessionState()
                }
                this.startTimer()
            })
        })
        window.electronIpc.onShowSettings(() => {
            this.settingsData.show = true
            this.stopTimer()
        })
        window.electronIpc.onNfcCard((_event, uid) => {
            if (this.showParticipantList) {
                this.doConfirm(
                    "ID naar clipboard",
                    `Gelezen NFC ID ${uid} naar het clipboard ?`,
                    (ok) => { if (ok === 1) window.navigator.clipboard.writeText(uid); }
                )
            }
            else {
                this.barcode = uid
                this.addNewPlayer()
            }
            this.nfcAlarm = "N"
        })
        window.electronIpc.onNfcError((_event, msg) => {
            this.handleNfcError(msg)
        })
        window.electronIpc.onImportData((_event, data) => {
            this.handleImportData(data)
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
            linkMode: false,
            players: [],            // All club members and guest pseudo players, present or not (stateless entries)
            waitingPlayers: [],     // Those players[] that are present and waiting to play
            pausedPlayers: [],      // Those players[] that are/were present but currently not playing

            courts: [],             // List of courts containing the list of players[] that are playing on a particular court
            barcode: null,
            selectedPlayer: null,   // The first player selected in a linking operation, else null

            // whether to show the modals
            showAddParticipant: false,
            showParticipantList: false,

            newPlayer: Object.assign({}, playerTemplate),
            sessionState: {},
            timerAni: null,
            nfcAlarm: "N",
            nfcAlarmTimerId: null,

            alertData:   { show: false, title: "", msg: "" },
            confirmData: { show: false, title: "", msg: "", action: () => {} },
            settingsData:{ show: false, courtFlash: false, messageBar: false, newMessageEffect: false, barMessages: [] },

            disableUndo: true,
            disableLinkMode: true,
            stateString: undefined,
            undoString:  undefined,
        }
    },
    computed: {
        // This provides the "tabindex" attribute for input elements in the main screen.  It is set to -1 when any modal is shown.
        mainAllowFocus() {
            return (this.showAddParticipant || this.showParticipantList) ? -1 : 0;
        },
        validNewPlayer() {
            return (this.newPlayer.name.length > 0) &&
                   isValidGender(this.newPlayer.gender) &&
                   isValidRank(this.newPlayer.ranking);
        }
    },

    // all the applications' functions.
    methods: {
        doAlert(title, msg) {
            this.alertData = { show: true, title: title, msg: msg }
        },

        doConfirm(title, msg, actionIn) {
            this.confirmData = { show: true, title: title, msg: msg, action: (result) => {
                this.confirmData.show = false
                actionIn(result)
            }}
        },

        togglePause() {
            this.paused = !this.paused
            if (!this.paused) {
                if (this.linkMode) this.toggleLinkMode()
            }
            this.disableLinkMode = !this.paused
            this.markStateChange()
        },

        toggleLinkMode() {
            this.linkMode = !this.linkMode
            if (this.selectedPlayer) {
                delete(this.selectedPlayer.link)
                this.selectedPlayer = null
            }
        },

        toggleDouble(court) {
            if (this.paused) court.isDouble = !court.isDouble;
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
            if (!this.paused) this.assignParticipants();
        },

        startTimer() {
            if (this.timerAni) {
                this.timerAni.removeEventListener('finish', this.timeoutHandler);
                this.timerAni.cancel();
            }

            let tba = document.getElementById("timerBar")
            let keyFrames = { width: ["100%", "0%"] }
            let options = { duration: 1500, iterations: "1" }
            this.timerAni = tba.animate(keyFrames, options)
            this.timerAni.addEventListener('finish', this.timeoutHandler);
        },

        stopTimer() {
            if (this.timerAni && (this.timerAni.playState === "running")) {
                this.timerAni.removeEventListener('finish', this.timeoutHandler);
                this.timerAni.cancel()
            }
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

        markStateChange(undoOption) {
            if (!this.showAddParticipant && !this.showParticipantList && !this.paused) {
                this.startTimer()
            }
            this.updateSessionState(undoOption)
            document.getElementById('barcode').focus()
        },

        addCourt() {
            let court = {
                courtNr: this.courts.length + 1,
                isDouble: true,
                paused: false,
                players: []
            }
            this.courts.push(court);
        },

        // clears one court
        clearCourt(c) {
            for (let n = c.players.length; n > 0; --n) {
                let pick = Math.floor(n * Math.random())
                let p = c.players.splice(pick, 1)[0]
                if (p.participating) {
                    if (p.paused) {
                        this.pausedPlayers.push(p);
                    }
                    else {
                        this.waitingPlayers.push(p);
                    }
                }
                p.paused = false;
                p.onCourt = 0;
            }
            c.players = [];
        },

        // checks out a court
        checkout(court) {
            if (!court.players.length) {
                court.paused = !court.paused
                this.markStateChange()
            }
            else {
                this.clearCourt(court)
                this.markStateChange(makeUndoPoint)
            }
        },

        playersToLocalStorage() {
            let r = [];
            this.players.forEach( p => r.push({
                // Note 'participating', 'paused,' 'onCourt' and link are left out
                name:        p.name,
                playerId:    p.playerId,
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
            let out = []
            let warnings = []
            let keyMap = {}
            let ignoredFields = {}
            let noPlayerCount = 0
            inp.forEach( (e, idx) => {
                let o = {};
                for (let fld in e) {
                    let field = fld.trim()
                    if (labelMap[field] !== undefined) o[labelMap[field]] = e[field]
                    else if (ignoredFields[field] === undefined) {
                        console.log(`Ignoring field '${field}'`)
                        ignoredFields[field] = true;
                    }
                }
                if (!o.playerId) {
                    ++noPlayerCount;
                }
                else {
                    if (keyMap[o.playerId] !== undefined) {
                        warnings.push(`Regel ${idx}: DUPLICAAT (${o.name}) ${o.playerId} = '${keyMap[o.playerId]}'`)
                    }
                    else {
                        if (o.name.trim() !== "")
                        {
                            if (!isValidGender(o.gender)) o.gender = 'g'
                            o.ranking = isValidRank(o.ranking) ? Number(o.ranking) : 0;
                            out.push(o)
                            keyMap[o.playerId] = o.name;
                        }
                    }
                }
            })
            if (noPlayerCount) warnings.push(`${noPlayerCount} regels bevatten geen spelernummer`)
            if (warnings.length) this.doAlert("Meldingen", warnings.join('\n'))
            return out
        },

        fixPlayerList(lookup, toFix) {
            let stillThere = toFix.filter(p => (lookup[p.playerId] !== undefined));
            return stillThere.map (e => {
                let updated = lookup[e.playerId]
                updated.participating = e.participating
                updated.paused        = e.paused
                updated.onCourt       = e.onCourt
                if (e.link !== undefined) updated.link = e.link
                return updated;
            });
        },

        importPlayers() {
            window.electronIpc.importPlayers()
        },

        handleImportData(array)
        {
            let file = new File([array], "some.xlsx")

            xlsxParser.onFileSelection(file)
            .then(data => {
                this.selectedPlayer = null
                this.players = this.mapImportFields(Object.values(data)[0])
                this.playersToLocalStorage();
                let knownPlayers = {}
                this.players.forEach(e => {knownPlayers[e.playerId] = e})
                this.waitingPlayers = this.fixPlayerList(knownPlayers, this.waitingPlayers)
                this.pausedPlayers  = this.fixPlayerList(knownPlayers, this.pausedPlayers)
                this.courts.forEach(c => {
                    c.players = this.fixPlayerList(knownPlayers, c.players)
                });
                rebuildPlayerLinks(this.players)
            });
        },

        // Toggle the pause-requested state of a player on a court
        togglePlayerPause(player, court) {
            if (player.onCourt != court.courtNr) console.log("togglePausePlayer invariant problem")
            if (player.paused)
            {
                this.makePlayerActive(player)
                let linked = this.linkedPlayer(player)
                if (linked) this.makePlayerActive(linked)
            }
            else
            {
                this.makePlayerPaused(player)
                let linked = this.linkedPlayer(player)
                if (linked) this.makePlayerPaused(linked)
            }
            this.updateSessionState()
            document.getElementById('barcode').focus()
        },

        // fills the courts with participants
        assignParticipants() {
            let doUpdateState = false
            this.courts.forEach((court) => {
                // check if court is in training mode
                if (!court.paused) {
                    // check if court is double or single
                    let capacity = court.isDouble ? 4 : 2
                    if (court.players.length != capacity) {
                        // First move any remainining players to the front of the waiting list
                        while(court.players.length > 0)
                        {
                            doUpdateState = true
                            let last = court.players.pop()
                            last.onCourt = 0
                            if (!last.participating) {
                                last.paused = false
                            }
                            else {
                                if (last.paused) {
                                    last.paused = false;
                                    this.pausedPlayers.push(last)
                                }
                                else {
                                    this.waitingPlayers.unshift(last)
                                }
                            }
                        }
                        // Ensure that linked waiting players are adjacent in the waiting list and single linked players are removed to notYet[]
                        let notYet = []
                        let ready = []
                        while(this.waitingPlayers.length > 0) {
                            let p = this.waitingPlayers.shift()
                            if (p.link) {
                                let idx = notYet.findIndex(e => e.link == p.link)
                                if (idx >= 0) {
                                    ready.push(notYet.splice(idx, 1)[0])        // Remove the peer and push it in the ready waiting list,
                                    ready.push(p)                               // Then push the player after it
                                }
                                else {
                                    notYet.push(p)                              // Linked player we have not seen the peer of (yet)
                                }
                            }
                            else {  // No link (or 0) pass the player along to the ready list
                                ready.push(p)
                            }
                        }
                        let playersNeeded = capacity
                        if (playersNeeded <= ready.length) {
                            // Assign pairs of linked or pairs of not-linked players
                            while (playersNeeded && playersNeeded <= ready.length) {
                                let toAdd = []
                                let p1 = ready.shift()      // first waiting player to consider
                                if (!p1.link) {
                                    // Not-linked player, find second not-linked player
                                    let idx = ready.findIndex(e => !e.link)
                                    if (idx < 0) {
                                        // Sadly there is no second not-linked player to make a pair, the not-linked player remains waiting
                                        notYet.unshift(p1)
                                    }
                                    else {
                                        // Hurray we can add two not-linked players to the field
                                        toAdd = [p1, ready.splice(idx, 1)[0]]
                                    }
                                }
                                else {
                                    if ((ready.length < 1) || (ready[0].link !== p1.link)) throw new Error('Dur zit een bug hier!')
                                    toAdd = [p1, ready.shift()]
                                }
                                toAdd.forEach( p => {
                                    p.onCourt = court.courtNr
                                    p.paused = false
                                    court.players.push(p)
                                    doUpdateState = true
                                    --playersNeeded
                                })
                            }
                            if (playersNeeded) {
                                console.log("Weird, this should not be possible ?")
                                this.clearCourt(court)
                            }
                            else if (this.settingsData.courtFlash) {
                                this.doFlashAnimation(document.getElementById(`courtTag_${court.courtNr}`))
                            }
                        }
                        this.waitingPlayers = ready.concat(notYet)
                    }
                }
            });
            if (doUpdateState) this.updateSessionState(keepUndoPoint)
        },

        // checks for new player and shows the new player modal
        addNewPlayer() {
            if (this.barcode !== null) {
                let player = this.players.find( p => p.playerId == this.barcode );
                if (!player) {
                    this.newPlayer.playerId = this.barcode;
                    document.getElementById('barcode').blur()
                    nextTick( () => document.getElementById('newPlayerName').focus() )
                    this.showAddParticipant = true;
                    this.stopTimer()
                }
                else {
                    this.changePlayerStatus(player);
                    this.markStateChange()
                }
            }
        },

        // permanently delete a player from the application
        deletePlayer(player) {
            this.doConfirm("", "Weet je zeker dat je deze speler wilt verwijderen?", (result) => {
                if (result === 1) {
                    if (player.link) breakLink(player.link)
                    else if (player.link === 0) this.selectedPlayer = null
                    let filter = el => el.playerId !== player.playerId;
                    this.waitingPlayers = this.waitingPlayers.filter(filter);
                    this.pausedPlayers = this.pausedPlayers.filter(filter);
                    this.courts.forEach( c => c.players = c.players.filter(filter) );
                    this.players = this.players.filter(filter);
                    this.playersToLocalStorage();
                }
            })
        },

        // checks in or checks out player
        changePlayerStatus(player) {
            let index = this.players.findIndex( p => player.playerId === p.playerId )
            if (index < 0) return;
            let p = this.players[index];
            p.participating = !p.participating;
            if (!p.participating)
            {
                if (p.link) breakLink(p.link)
                else if (p.link === 0) this.selectedPlayer = null
                let filter = el => el.playerId !== player.playerId;
                this.waitingPlayers = this.waitingPlayers.filter(filter);
                this.pausedPlayers = this.pausedPlayers.filter(filter);
                // If onCourt then player is left on the screen until the court is cleared
            }
            else
            {
                // Note: when a player is on court, checks out and checks in again then this just undoes the check out
                p.paused = false
                if (!p.onCourt) this.waitingPlayers.push(p)
            }
            this.updateSessionState()
            this.barcode = null;
        },

        // When editing player links a player on screen is clicked
        linkUpdate(player) {
            if (player.link === undefined) {
                // Player not linked yet: Create a link / selection
                if (this.selectedPlayer === null) {
                    this.selectedPlayer = player
                    player.link = 0
                }
                else {
                    createLink(this.selectedPlayer, player)
                    this.selectedPlayer = null
                }
            }
            else if (player.link === 0) {
                // Player is the "selected player", abort linking, clear selected player
                this.selectedPlayer = null;
                delete(player.link)
            }
            else if (this.selectedPlayer !== null) {
                // Trying to link a "selected player" to a player that is already linked: fail and produce a warning
                this.doAlert("Fout", `Speler "${player.name}" heeft al een link`)
            }
            else {
                // Selecting a player that has a link already (first click), break the link
                breakLink(player.link)
            }
        },

        waitingPlayerClick(player) {
            if (this.linkMode) {
                this.linkUpdate(player)
            }
            else {
                this.pausePlayer(player)
            }
        },

        pausedPlayerClick(player) {
            if (this.linkMode) {
                this.linkUpdate(player)
            }
            else {
                this.resumePlayer(player)
            }
        },

        playerOnCourtClick(player, court) {
            if (this.linkMode) {
                this.linkUpdate(player)
            }
            else {
                this.togglePlayerPause(player, court)
            }
        },

        // Get the link tag (or emtpy). Note that this function is accesible from Vue elements (tagForLink is not)
        playerTag(player) {
            return tagForLink(player.link)
        },

        // Return the linked player or null if there is none
        linkedPlayer(player) {
            if (!player.link) return null
            let link = playerLinks[player.link-1]
            if (!link || link.length != 2) throw new Error(`Link ${player.link} not found`)
            let idx = link.findIndex(e => e.playerId === player.playerId)
            if (idx < 0) throw new Error(`Linked player not found at link ${player.link}`)
            return link[1-idx]
        },

        // Make a paricipating player paused, whatever it current status is (paused already, waiting or on court)
        makePlayerPaused(player) {
            if (player.onCourt != 0) {
                player.paused = true
            }
            else if (this.pausedPlayers.findIndex(e => e.playerId === player.playerId) < 0)
            {
                let idx = this.waitingPlayers.findIndex(e => e.playerId === player.playerId)
                if (idx >= 0) this.pausedPlayers.push(this.waitingPlayers.splice(idx, 1)[0])
            }
        },

        // Make a paricipating player active (non-paused), whatever it current status is (paused, already waiting or on court)
        makePlayerActive(player) {
            if (player.onCourt != 0) {
                player.paused = false
            }
            else if (this.waitingPlayers.findIndex(e => e.playerId === player.playerId) < 0)
            {
                let idx = this.pausedPlayers.findIndex(e => e.playerId === player.playerId)
                if (idx >= 0) this.waitingPlayers.push(this.pausedPlayers.splice(idx, 1)[0])
            }
        },

        // Pause a player in the waitingPlayers list
        pausePlayer(player) {
            this.stopTimer();
            this.doConfirm('Pauzeren', `${player.name} pauze nemen?`, (result) => {
                if (result == 1) {
                    this.makePlayerPaused(player)
                    let linked = this.linkedPlayer(player)
                    if (linked) this.makePlayerPaused(linked)
                }
                this.markStateChange()
            })
        },

        // Resume a player in the pausedPlayers list
        resumePlayer(player) {
            this.makePlayerActive(player)
            let linked = this.linkedPlayer(player)
            if (linked) this.makePlayerActive(linked)
            this.markStateChange()
        },

        onDragStart() {
            this.stopTimer()
        },

        onDragEnd() {
            // List modifications by dragging can break the onCourt invariant so we always enforce it after a drag operation
            this.waitingPlayers.forEach (p => { p.onCourt = 0; p.paused = false })
            this.pausedPlayers.forEach  (p => { p.onCourt = 0; p.paused = false })
            this.courts.forEach((c, idx) => {
                c.players.forEach(p => p.onCourt = idx+1)
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

            this.players.push(this.newPlayer);
            this.playersToLocalStorage();
            this.waitingPlayers.push(this.newPlayer);
            this.hideAddParticipant()
        },

        playerClass(par, group) {
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

        hideSettings() {
            this.settingsData.show = false
            this.markStateChange()
        },

        updateSessionState(undoOption) {
            let state = {
                w: [],      // Waiting players
                p: [],      // Paused players
                c: [],      // On court players (with to-be-paused/gone state)
            }
            this.waitingPlayers.forEach( e => state.w.push(e.link ? [e.playerId, e.link] : e.playerId))
            this.pausedPlayers.forEach(  e => state.p.push(e.link ? [e.playerId, e.link] : e.playerId))
            // A court record consists of a state character ('p' paused, '2' double, '1' single), followed by an array of 2-entry player arrays:
            // One player array consists of the player ID, followed by the state, 'g' gone, 'p' to-be-paused, '-' normal/active
            // If the player is linked then instead of a player ID string a 2-element array if player ID & link number is used
            this.courts.forEach( (c) => {
                let record = { s: c.paused ? 'p' : c.isDouble ? '2' : '1', p: []};
                c.players.forEach(p => record.p.push([p.link ? [p.playerId, p.link] : p.playerId, !p.participating ? 'g' : p.paused ? 'p' : '-']))
                state.c.push(record)
            })
            if (undoOption === undefined) {
                this.disableUndo = true
            }
            else if (undoOption == makeUndoPoint) {
                this.undoString = this.stateString
                this.disableUndo = false
            }   // Third option keepUndoPoint -> no action
            this.stateString = JSON.stringify(state)
            localStorage.setItem('state', this.stateString)
        },

        resetSessionState() {
            this.selectedPlayer = null
            this.waitingPlayers = []
            this.pausedPlayers = []
            this.courts.forEach(c => {
                c.isDouble = true
                c.paused = false
                c.players = []
            })
            this.players.forEach( p => { p.paused = false; p.participating = false; p.onCourt = 0; delete(p.link) } )
            playerLinks = []
        },

        restoreSessionStateTo(stateString) {
            this.resetSessionState()
            try {
                let oldState = JSON.parse(stateString)
                if (!oldState)                      throw new Error("Old state not found");
                let usedIds = {};
                const getPlayerWithId = (id) => {
                    let link = undefined
                    if (typeof(id) == 'object') {
                        if (typeof(id[0]) != 'string') throw new Error("ID name part is not 'string'")
                        if (typeof(id[1]) != 'number') throw new Error("ID type link part not 'number'")
                        link = id[1]
                        id = id[0]
                    }
                    else if (typeof(id) != 'string')   throw new Error("ID type is not 'string'")
                    if (usedIds[id] !== undefined)  throw new Error(`ID ${id} is used twice`)
                    usedIds[id] = true
                    let p = this.players.find(e => e.playerId === id)
                    if (p === undefined)            throw new Error(`ID ${id} is not a known player`)
                    p.participating = true
                    if (link) p.link = link
                    return p
                }
                oldState.w.forEach( id => this.waitingPlayers.push(getPlayerWithId(id)) )
                oldState.p.forEach( id => this.pausedPlayers.push( getPlayerWithId(id)) )
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
                        if (typeof(playerState) != 'string') throw new Error("On-court player state type is not 'string'")
                        if ((playerState.length != 1) || !"gp-".includes(playerState)) throw new Error("Invalid on-court player state")
                        let p = getPlayerWithId(id)
                        this.courts[idx].players.push(p)
                        p.paused = (playerState === "p")
                        p.participating = (playerState !== "g")
                        p.onCourt = idx+1
                    })
                })
                rebuildPlayerLinks(this.players)
                console.log("Restored previous session state")
                this.updateSessionState()
            }
            catch (e)
            {
                this.doAlert('Probleem', `De vorige sessiestatus kon niet worden hersteld\n'${e}'`)
                this.resetSessionState()
            }
        },

        restoreOldSessionState() {
            this.restoreSessionStateTo(localStorage.getItem('old_state'))
        },

        doUndo() {
            if (this.disableUndo) return;
            this.restoreSessionStateTo(this.undoString)
            this.markStateChange();
        },

        reloadSettings() {
            try {
                let stringData = localStorage.getItem('settings')
                if (stringData === null)
                {
                    this.settingsData.courtFlash = false;
                    this.settingsData.messageBar = false;
                    this.settingsData.newMessageEffect = false;
                    this.settingsData.barMessages = [];
                    return;
                }
                let oldSettings = JSON.parse(stringData)
                if (typeof(oldSettings.courtFlash) == 'boolean') this.settingsData.courtFlash = oldSettings.courtFlash;
                if (typeof(oldSettings.messageBar) == 'boolean') this.settingsData.messageBar = oldSettings.messageBar;
                if (typeof(oldSettings.newMessageEffect) == 'boolean') this.settingsData.newMessageEffect = oldSettings.newMessageEffect;
                if (typeof(oldSettings.barMessages) == 'object' && typeof(oldSettings.barMessages.length) == 'number')
                {
                    this.settingsData.barMessages = oldSettings.barMessages;
                    document.getElementById("txtBarMessages").value = this.settingsData.barMessages.join('\n')
                }
                startNews(this.settingsData.messageBar ? this.settingsData.barMessages : "", this.settingsData.newMessageEffect)
                console.log("Restored settings")
            }
            catch (e)
            {
                this.doAlert('Probleem', `Kon oude instellingen niet teruglezen\n'${e}'`)
            }
        },

        restoreOptions() {
            this.hideSettings()
            this.reloadSettings()
        },

        saveOptions() {
            this.hideSettings()
            let lines = document.getElementById("txtBarMessages").value.split('\n')
            this.settingsData.barMessages = lines.map(x => x.trim()).filter((s) => s != "")
            localStorage.setItem('settings', JSON.stringify(this.settingsData))
            if (this.settingsData.barMessages.length == 0) this.settingsData.messageBar = false
            startNews(this.settingsData.messageBar ? this.settingsData.barMessages : "", this.settingsData.newMessageEffect)
        },

        doFlashAnimation(target) {
            for (let a of target.getAnimations()) a.cancel();
            let keyFrames = {
                backgroundColor: [ "whitesmoke", "whitesmoke", "gray", "gray"]
            }
            let options = {
                duration: 500,
                iterations: 360,    // 3 minutes 2*3*60
                direction: "alternate",
                easing: "ease-in-out",
                fill:  "forwards",
            }
            target.animate(keyFrames, options)
        },

        doCancelAnimations(evt) {
            for (let a of evt.target.getAnimations()) a.cancel();
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

    #newsBar.barOff {
        display: none;
    }

    #newsBar.barOn {
        /* flex child bit: */
        flex: 0 0 3rem;         /* Fixed height, elastic main appliciation section uses the remaining viewport height */
        width: 100vw;

        position: relative;     /* Box reference for embedded 'absolute' positioned child elements */
        overflow: hidden;       /* Clip anything that does not fit */
    }

    #newsBarShift {
        position: absolute;
        top: 0px;
        left: 0px;
        height: 200%;           /* Twice the height of the (clipping) parent div, we can "scroll" by moving this div up */
        width:  100%;
        background-color: rgb(220,220,220);
    }

    #newsBarShift > div {
        height: 50%;            /* There are two of these divs (old news and new news) */
        width: 100%;
        display: flex;              /* Now to center text in this box */
        flex-direction: column;
        justify-content: center;    /* Center content on main axis (note that grow must be 0 or there will be no space to divide up) */
        overflow: hidden;
    }

    #newsBarShift > div > div {
        width: 200vw;
        font-size: x-large;
        overflow: hidden;
        padding-left: 1em;
    }

    #newsBarShift > div > div span {
        display: inline;
    }
    span.newsEmoji {
        padding-right: 0.7em;
    }

</style>