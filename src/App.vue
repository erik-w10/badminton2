<script setup lang="ts">
    import { ref, onMounted, reactive, computed, nextTick } from 'vue'
    import draggable from 'vuedraggable'
    import { xlsxParser } from './externals'
    import NewsBar from './NewsBar.vue'

    const makeUndoPoint = 1;
    const keepUndoPoint = 2;
    enum UndoOption {
        DoNothing = 0,
        Make,
        Keep
    }

    // Player as persisted in local storage (without state)
    interface KnownPlayer {
        name:           string;
        playerId:       string;
        gender:         string;
        ranking:        string;
    }
    // Player as used run-time to store identity & state
    interface Player extends KnownPlayer {
        participating:  boolean;
        paused:         boolean;
        onCourt:        number;     // 0 => not on any court
        link?:          number;
    }
    interface PlayerLookup {
        [key : string] : Player;
    }
    type Court = {
        courtNr:  number;
        isDouble: boolean;
        paused:   boolean;
        players:  Player[];
    }


    const playerTemplate : Player = {
        name: "",
        playerId: "",
        gender: "",
        ranking: "",
        // State (not persisted):
        participating: true,
        paused: false,
        onCourt: 0           // 0 => not on any court
        // Note: additionally a numeric "link" field may be present when the player is (being) linked to another,
        //       link is then the proper playerLinks[] index plus 1 or 0 when no second player is selected yet.
    };

    interface LabelMap {
        [key: string] : string;
    }
    const labelMap : LabelMap = {
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
    let playerLinks : (Player[] | null)[] = []

    // Link two players
    function createLink(player1 : Player, player2 : Player) {
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
    function tagForLink(link : any) {
        if (link === undefined) return ""           // Not linked (no tag)
        if (link === 0) return "\u{25C4}"           // Selected in link assigment: left pointing triangle
        if (link > 20)  return "\u{1F517}"          // Link symbol
        return String.fromCodePoint(9311 + link)    // Digit 1..20 in a circle
    }

    // Break the link with the specified number (>= 1).
    function breakLink(linkNr : number) {
        if (linkNr < 1 || linkNr > playerLinks.length) throw new Error(`Unknown link number ${linkNr}`)
        let idx = linkNr-1
        let l = playerLinks[idx]
        if (l !== null) {
            delete(l[0].link)
            delete(l[1].link)
            playerLinks[idx] = null
        }
    }

    // Rebuild playerLinks based on the recovered / reloaded / imported list of players specified
    function rebuildPlayerLinks(players : Player[])
    {
        let maxLink = players.reduce((max, p) => (((p.link || 0) <= max) ? max : <number>p.link ), 0)
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

    function isValidGender(gen : any) {
        return (typeof(gen) === 'string') && (gen.length == 1) && "vmg".includes(gen);
    }
    function isValidRank(rank : any) {
        return (typeof(rank) === 'string') && (rank.length == 1) && "123".includes(rank);
    }

    // when application starts
    onMounted(() => {
        console.log('Starting');
        reloadSettings();
        // localStorage.setItem('participants', "[]");
        // gets the player from storage || sets a new storage item
        if (!localStorage.getItem('participants')) {
            localStorage.setItem('participants', "[]");
        }
        players = JSON.parse(localStorage.getItem('participants') as string);
        players.forEach( p => { let x = p as any; if (x.speelNummer !== undefined) { p.playerId = x.speelNummer; delete x.speelNummer; }})
        players.forEach( p => { p.paused = false; p.participating = false; p.onCourt = 0; delete(p.link); } )
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
            handleImportData(data)
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
    let players = [] as Player[]                // All club members and guest pseudo players, present or not (stateless entries)
    const waitingPlayers = ref([] as Player[])  // Those players[] that are present and waiting to play
    const pausedPlayers = ref([] as Player[])   // Those players[] that are/were present but currently not playing
    
    const courts = ref([] as Court[])           // List of courts containing the list of players[] that are playing on a particular court
    const barcode = ref<null|string>(null)
    const selectedPlayer = ref<null|Player>(null)   // The first player selected in a linking operation, else null
    
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
    let settingsData = reactive({ courtFlash: false, messageBar: false, newMessageEffect: false, barMessages: [] as string[] })
    const showSettings = ref(false)
    
    const disableUndo = ref(true)
    const disableLinkMode = ref(true)
    let stateString : undefined|string = undefined
    let undoString  : undefined|string= undefined

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
        disableLinkMode.value = !paused.value
        markStateChange()
    }

    function toggleLinkMode() {
        linkMode.value = !linkMode.value
        if (selectedPlayer.value) {
            delete(selectedPlayer.value.link)
            selectedPlayer.value = null
        }
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
        if (!paused.value) assignParticipants();
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
            courtNr: courts.value.length + 1,
            isDouble: true,
            paused: false,
            players: []
        }
        courts.value.push(court);
    }

    // clears one court
    function clearCourt(c : Court) {
        for (let n = c.players.length; n > 0; --n) {
            let pick = Math.floor(n * Math.random())
            let p = c.players.splice(pick, 1)[0]
            if (p.participating) {
                if (p.paused) {
                    pausedPlayers.value.push(p);
                }
                else {
                    waitingPlayers.value.push(p);
                }
            }
            p.paused = false;
            p.onCourt = 0;
        }
        c.players = [];
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

    function playersToLocalStorage() {
        let r : KnownPlayer[] = [];
        players.forEach( p => r.push({
            // Note 'participating', 'paused,' 'onCourt' and link are left out
            name:        p.name,
            playerId:    p.playerId,
            gender:      p.gender,
            ranking:     p.ranking
        }))
        localStorage.setItem('participants', JSON.stringify(r));
    }

    function exportPlayers() {
        let playersJson = localStorage.getItem('participants');
        if (playersJson !== null) window.myIpc.exportPlayers(playersJson)
    }

    function mapImportFields(inp : any[]) : Player[]
    {
        let out : Player[] = []
        let warnings : string [] = []
        let keyMap : { [key : string] : string }= {}
        let ignoredFields : { [key : string] : boolean } = {}
        let noPlayerCount = 0
        inp.forEach( (e, idx) => {
            let o : { [key : string] : any }= {};
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
                if (keyMap[<string>o.playerId] !== undefined) {
                    warnings.push(`Regel ${idx}: DUPLICAAT (${o.name}) ${o.playerId} = '${keyMap[o.playerId]}'`)
                }
                else {
                    if (o.name.trim() !== "")
                    {
                        if (!isValidGender(o.gender)) o.gender = 'g'
                        o.ranking = isValidRank(o.ranking) ? Number(o.ranking) : 0;
                        o.participating = false;
                        o.paused = false;
                        o.onCourt = 0;
                        out.push(o as Player)
                        keyMap[o.playerId] = o.name;
                    }
                }
            }
        })
        if (noPlayerCount) warnings.push(`${noPlayerCount} regels bevatten geen spelernummer`)
        if (warnings.length) doAlert("Meldingen", warnings.join('\n'))
        return out
    }

    function fixPlayerList(lookup : PlayerLookup, toFix : Player[]) {
        let stillThere = toFix.filter(p => (lookup[<string>p.playerId] !== undefined));
        return stillThere.map (e => {
            let updated = lookup[<string>e.playerId]
            updated.participating = e.participating
            updated.paused        = e.paused
            updated.onCourt       = e.onCourt
            if (e.link !== undefined) updated.link = e.link
            return updated;
        });
    }

    function importPlayers() {
        window.myIpc.importPlayers()
    }

    function handleImportData(array : any)
    {
        let file = new File([array], "some.xlsx")

        xlsxParser.onFileSelection(file)
        .then((data : any) => {
            selectedPlayer.value = null
            players = mapImportFields(Object.values(data)[0] as any[])
            playersToLocalStorage();
            let knownPlayers : { [key : string]: Player } = {}
            players.forEach(e => {knownPlayers[<string>e.playerId] = e})
            waitingPlayers.value = fixPlayerList(knownPlayers, waitingPlayers.value)
            pausedPlayers.value  = fixPlayerList(knownPlayers, pausedPlayers.value)
            courts.value.forEach(c => {
                c.players = fixPlayerList(knownPlayers, c.players)
            });
            rebuildPlayerLinks(players)
        });
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

    // fills the courts with participants
    function assignParticipants() {
        let doUpdateState = false
        courts.value.forEach((court) => {
            // check if court is in training mode
            if (!court.paused) {
                // check if court is double or single
                let capacity = court.isDouble ? 4 : 2
                if (court.players.length != capacity) {
                    // First move any remainining players to the front of the waiting list
                    while(court.players.length > 0)
                    {
                        doUpdateState = true
                        let last = court.players.pop() as Player
                        last.onCourt = 0
                        if (!last.participating) {
                            last.paused = false
                        }
                        else {
                            if (last.paused) {
                                last.paused = false;
                                pausedPlayers.value.push(last)
                            }
                            else {
                                waitingPlayers.value.unshift(last)
                            }
                        }
                    }
                    // Ensure that linked waiting players are adjacent in the waiting list and single linked players are removed to notYet[]
                    let notYet = []
                    let ready = []
                    while(waitingPlayers.value.length > 0) {
                        let p = waitingPlayers.value.shift() as Player
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
                            let toAdd : Player[] = []
                            let p1 = ready.shift() as Player      // first waiting player to consider
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
                                toAdd = [p1, ready.shift() as Player]
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
                            clearCourt(court)
                        }
                        else if (settingsData.courtFlash) {
                            doFlashAnimation(document.getElementById(`courtTag_${court.courtNr}`) as HTMLDivElement)
                        }
                    }
                    waitingPlayers.value = ready.concat(notYet)
                }
            }
        });
        if (doUpdateState) updateSessionState(UndoOption.Keep)
    }

    // checks for new player and shows the new player modal
    function addNewPlayer() {
        if (barcode.value !== null) {
            let player = players.find( p => p.playerId == barcode.value );
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
    function deletePlayer(player : Player) {
        doConfirm("", "Weet je zeker dat je deze speler wilt verwijderen?", (result) => {
            if (result === 1) {
                if (player.link) breakLink(player.link)
                else if (player.link === 0) selectedPlayer.value = null
                let filter = (el : Player) => el.playerId !== player.playerId;
                waitingPlayers.value = waitingPlayers.value.filter(filter);
                pausedPlayers.value = pausedPlayers.value.filter(filter);
                courts.value.forEach( c => c.players = c.players.filter(filter) );
                players = players.filter(filter);
                playersToLocalStorage();
            }
        })
    }

    // checks in or checks out player
    function changePlayerStatus(player : Player) {
        let index = players.findIndex( p => player.playerId === p.playerId )
        if (index < 0) return;
        let p = players[index];
        p.participating = !p.participating;
        if (!p.participating)
        {
            if (p.link) breakLink(p.link)
            else if (p.link === 0) selectedPlayer.value = null
            let filter = (el : Player) => el.playerId !== player.playerId;
            waitingPlayers.value = waitingPlayers.value.filter(filter);
            pausedPlayers.value = pausedPlayers.value.filter(filter);
            // If onCourt then player is left on the screen until the court is cleared
        }
        else
        {
            // Note: when a player is on court, checks out and checks in again then this just undoes the check out
            p.paused = false
            if (!p.onCourt) waitingPlayers.value.push(p)
        }
        updateSessionState()
        barcode.value = null;
    }

    // When editing player links, a player on screen is clicked
    function linkUpdate(player : Player) {
        if (player.link === undefined) {
            // Player not linked yet: Create a link / selection
            if (selectedPlayer.value === null) {
                selectedPlayer.value = player
                player.link = 0
            }
            else {
                createLink(selectedPlayer.value, player)
                selectedPlayer.value = null
            }
        }
        else if (player.link === 0) {
            // Player is the "selected player", abort linking, clear selected player
            selectedPlayer.value = null;
            delete(player.link)
        }
        else if (selectedPlayer.value !== null) {
            // Trying to link a "selected player" to a player that is already linked: fail and produce a warning
            doAlert("Fout", `Speler "${player.name}" heeft al een link`)
        }
        else {
            // Selecting a player that has a link already (first click), break the link
            breakLink(player.link)
        }
    }

    function waitingPlayerClick(player : Player) {
        if (linkMode.value) {
            linkUpdate(player)
        }
        else {
            pausePlayer(player)
        }
    }

    function pausedPlayerClick(player : Player) {
        if (linkMode.value) {
            linkUpdate(player)
        }
        else {
            resumePlayer(player)
        }
    }

    function playerOnCourtClick(player : Player, court : Court) {
        if (linkMode.value) {
            linkUpdate(player)
        }
        else {
            togglePlayerPause(player, court)
        }
    }

    // Get the link tag (or emtpy). Note that this function is accesible from Vue elements (tagForLink is not)
    function playerTag(player : Player) {
        return tagForLink(player.link)
    }

    // Return the linked player or null if there is none
    function linkedPlayer(player : Player) {
        if (!player.link) return null
        let link = playerLinks[player.link-1]
        if (!link || link.length != 2) throw new Error(`Link ${player.link} not found`)
        let idx = link.findIndex(e => e.playerId === player.playerId)
        if (idx < 0) throw new Error(`Linked player not found at link ${player.link}`)
        return link[1-idx]
    }

    // Make a paricipating player paused, whatever it current status is (paused already, waiting or on court)
    function makePlayerPaused(player : Player) {
        if (player.onCourt != 0) {
            player.paused = true
        }
        else if (pausedPlayers.value.findIndex(e => e.playerId === player.playerId) < 0)
        {
            let idx = waitingPlayers.value.findIndex(e => e.playerId === player.playerId)
            if (idx >= 0) pausedPlayers.value.push(waitingPlayers.value.splice(idx, 1)[0])
        }
    }

    // Make a paricipating player active (non-paused), whatever it current status is (paused, already waiting or on court)
    function makePlayerActive(player : Player) {
        if (player.onCourt != 0) {
            player.paused = false
        }
        else if (waitingPlayers.value.findIndex(e => e.playerId === player.playerId) < 0)
        {
            let idx = pausedPlayers.value.findIndex(e => e.playerId === player.playerId)
            if (idx >= 0) waitingPlayers.value.push(pausedPlayers.value.splice(idx, 1)[0])
        }
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
        waitingPlayers.value.forEach (p => { p.onCourt = 0; p.paused = false })
        pausedPlayers.value.forEach  (p => { p.onCourt = 0; p.paused = false })
        courts.value.forEach((c, idx) => {
            c.players.forEach(p => p.onCourt = idx+1)
        })
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
        
        players.push(newPlayer.value);
        playersToLocalStorage();
        waitingPlayers.value.push(newPlayer.value);
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

    function updateSessionState(undoOption : UndoOption = UndoOption.DoNothing) {
        type PlayerId = string | [ string, number ]
        type CourtPlayer = [ PlayerId, string ]
        type CourtState = { s: string, p: CourtPlayer[] }
        let state = {
            w: [] as PlayerId[],    // Waiting players
            p: [] as PlayerId[],    // Paused players
            c: [] as CourtState[],  // On court players (with to-be-paused/gone state)
        }
        waitingPlayers.value.forEach( e => state.w.push(e.link ? [e.playerId, e.link] : e.playerId))
        pausedPlayers.value.forEach(  e => state.p.push(e.link ? [e.playerId, e.link] : e.playerId))
        // A court record consists of a state character ('p' paused, '2' double, '1' single), followed by an array of 2-entry player arrays:
        // One player array consists of the player ID, followed by the state, 'g' gone, 'p' to-be-paused, '-' normal/active
        // If the player is linked then instead of a player ID string a 2-element array if player ID & link number is used
        courts.value.forEach( (c) => {
            let record = { s: c.paused ? 'p' : c.isDouble ? '2' : '1', p: [] as CourtPlayer[] };
            c.players.forEach(p => record.p.push([p.link ? [p.playerId, p.link] : p.playerId, !p.participating ? 'g' : p.paused ? 'p' : '-']))
            state.c.push(record)
        })
        if (undoOption === UndoOption.DoNothing) {
            disableUndo.value = true
        }
        else if (undoOption == UndoOption.Make) {
            undoString = stateString
            disableUndo.value = false
        }   // Third option "Keep" -> no action
        stateString = JSON.stringify(state)
        localStorage.setItem('state', stateString)
    }

    function resetSessionState() {
        selectedPlayer.value = null
        waitingPlayers.value = []
        pausedPlayers.value = []
        courts.value.forEach(c => {
            c.isDouble = true
            c.paused = false
            c.players = []
        })
        players.forEach( p => { p.paused = false; p.participating = false; p.onCourt = 0; delete(p.link) } )
        playerLinks = []
    }

    function restoreSessionStateTo(stateString : string) {
        resetSessionState()
        try {
            let oldState = JSON.parse(stateString)
            if (!oldState)                        throw new Error("Old state not found");
            let usedIds : {[key:  string] : boolean } = {};
            const getPlayerWithId = (x : any) => {
                let id = ""
                let link = undefined
                if (typeof(x) == 'object') {
                    if (typeof(x[0]) != 'string') throw new Error("ID name part is not 'string'")
                    if (typeof(x[1]) != 'number') throw new Error("ID type link part not 'number'")
                    link = x[1]
                    id = x[0] as string
                }
                else if (typeof(x) != 'string')   throw new Error("ID type is not 'string'")
                else id = x as string

                if (usedIds[id] !== undefined)   throw new Error(`ID ${id} is used twice`)
                usedIds[id] = true
                let p = players.find(e => e.playerId === id)
                if (p === undefined)             throw new Error(`ID ${id} is not a known player`)
                p.participating = true
                if (link) p.link = link
                return p
            }
            oldState.w.forEach( (id : any) => waitingPlayers.value.push(getPlayerWithId(id)) )
            oldState.p.forEach( (id : any) => pausedPlayers.value.push( getPlayerWithId(id)) )
            if (oldState.c.length != courts.value.length) throw new Error(`Nr of courts doesn't match`)
            oldState.c.forEach( (c : any, idx : number) => {
                let courtState = c.s;
                if ((courtState.length != 1) || !"p21".includes(courtState)) throw new Error(`Invalid court state '${courtState}'`)
                if ((courtState == 'p') && (c.p.length != 0)) throw new Error("Paused court contained players")
                courts.value[idx].paused = (courtState === 'p')
                courts.value[idx].isDouble = (courtState !== '1')
                c.p.forEach( (rec : any) => {
                    if (rec.length != 2)        throw new Error("Player on court record length is not 2")
                    let id = rec[0]
                    let playerState = rec[1]
                    if (typeof(playerState) != 'string') throw new Error("On-court player state type is not 'string'")
                    if ((playerState.length != 1) || !"gp-".includes(playerState)) throw new Error("Invalid on-court player state")
                    let p = getPlayerWithId(id)
                    courts.value[idx].players.push(p)
                    p.paused = (playerState === "p")
                    p.participating = (playerState !== "g")
                    p.onCourt = idx+1
                })
            })
            rebuildPlayerLinks(players)
            console.log("Restored previous session state")
            updateSessionState()
        }
        catch (e)
        {
            doAlert('Probleem', `De vorige sessiestatus kon niet worden hersteld\n'${e}'`)
            resetSessionState()
        }
    }

    function restoreOldSessionState() {
        restoreSessionStateTo(localStorage.getItem('old_state') || "")
    }

    function doUndo() {
        if (disableUndo.value) return;
        if (undoString) restoreSessionStateTo(undoString)
        markStateChange();
    }

    function reloadSettings() {
        try {
            let stringData = localStorage.getItem('settings')
            if (stringData === null)
            {
                settingsData.courtFlash = false;
                settingsData.messageBar = false;
                settingsData.newMessageEffect = false;
                settingsData.barMessages = [];
                return;
            }
            let oldSettings = JSON.parse(stringData)
            if (typeof(oldSettings.courtFlash) == 'boolean') settingsData.courtFlash = oldSettings.courtFlash;
            if (typeof(oldSettings.messageBar) == 'boolean') settingsData.messageBar = oldSettings.messageBar;
            if (typeof(oldSettings.newMessageEffect) == 'boolean') settingsData.newMessageEffect = oldSettings.newMessageEffect;
            if (typeof(oldSettings.barMessages) == 'object' && typeof(oldSettings.barMessages.length) == 'number')
            {
                settingsData.barMessages = oldSettings.barMessages;
                (document.getElementById("txtBarMessages") as HTMLTextAreaElement).value = settingsData.barMessages.join('\n')
            }
            console.log("Restored settings")
        }
        catch (e)
        {
            doAlert('Probleem', `Kon oude instellingen niet teruglezen\n'${e}'`)
        }
    }

    function restoreOptions() {
        hideSettings()
        reloadSettings()
    }

    function saveOptions() {
        hideSettings()
        let lines = (document.getElementById("txtBarMessages") as HTMLTextAreaElement).value.split('\n')
        settingsData.barMessages = lines.map(x => x.trim()).filter((s) => s != "")
        localStorage.setItem('settings', JSON.stringify(settingsData))
        if (settingsData.barMessages.length == 0) settingsData.messageBar = false
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
                                <div style="overflow:hidden" class="list-item" v-bind:key="player.playerId" v-for="player in players">
                                    <b>{{player.name}}</b> ({{player.playerId}})
                                <span @click="deletePlayer(player)" style="float: right" class="button is-danger">verwijder</span>
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
    
            <div class="modal" :class="{'is-active': showSettings}">
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
