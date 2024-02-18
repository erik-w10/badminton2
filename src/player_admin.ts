import { xlsxParser } from './externals'
import { reactive } from 'vue'

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
let xSelected = <null|Player>(null)     // The first player selected in a linking operation, else null

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

interface Admin {
    players : Player []     // All club members and guest pseudo players, present or not (stateless entries)
    waiting : Player []     // Those players[] that are present and waiting to play
    paused  : Player []     // Those players[] that are/were present but currently not playing
    courts  : Court []      // List of courts containing the list of players[] that are playing on a particular court
    canUndo : boolean
}
let adm : Admin = reactive({players: [], waiting: [], paused: [], courts: [], canUndo: false })

function loadPlayers()
{
    if (!localStorage.getItem('participants')) {
        localStorage.setItem('participants', "[]");
    }
    adm.players = JSON.parse(localStorage.getItem('participants') as string);
    adm.players.forEach( p => { let x = p as any; if (x.speelNummer !== undefined) { p.playerId = x.speelNummer; delete x.speelNummer; }})
    adm.players.forEach( p => { p.paused = false; p.participating = false; p.onCourt = 0; delete(p.link); } )
}

function playersToLocalStorage() {
    let r : KnownPlayer[] = [];
    adm.players.forEach( p => r.push({
        // Note 'participating', 'paused,' 'onCourt' and link are left out
        name:        p.name,
        playerId:    p.playerId,
        gender:      p.gender,
        ranking:     p.ranking
    }))
    localStorage.setItem('participants', JSON.stringify(r));
}

function isValidGender(gen : any) {
    return (typeof(gen) === 'string') && (gen.length == 1) && "vmg".includes(gen);
}
function isValidRank(rank : any) {
    return (typeof(rank) === 'string') && (rank.length == 1) && "123".includes(rank);
}

function mapImportFields(inp : any[]) : { plrs: Player[], warnings: string[] }
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
    return {plrs: out, warnings: warnings}
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

function handleImportData(array : any, reporter: (warnings: string[]) => void )
{
    xSelected = null
    let file = new File([array], "some.xlsx")

    xlsxParser.onFileSelection(file)
    .then((data : any) => {
        let { plrs, warnings } = mapImportFields(Object.values(data)[0] as any[])
        adm.players = plrs;
        playersToLocalStorage();
        let knownPlayers : PlayerLookup = {}
        adm.players.forEach(e => {knownPlayers[<string>e.playerId] = e})
        adm.waiting = fixPlayerList(knownPlayers, adm.waiting)
        adm.paused  = fixPlayerList(knownPlayers, adm.paused)
        adm.courts.forEach(c => {
            c.players = fixPlayerList(knownPlayers, c.players)
        });
        rebuildPlayerLinks(adm.players)
        if (warnings.length > 0) reporter(warnings);
    });
}

function exportPlayers() {
    let playersJson = localStorage.getItem('participants');
    if (playersJson !== null) window.myIpc.exportPlayers(playersJson)
}

function deletePlayer (player : Player)
{
    if (player.link) breakLink(player.link)
    else if (player.link === 0) xSelected = null
    let filter = (el : Player) => el.playerId !== player.playerId;
    adm.waiting = adm.waiting.filter(filter);
    adm.paused = adm.paused.filter(filter);
    adm.courts.forEach( c => c.players = c.players.filter(filter) );
    adm.players = adm.players.filter(filter);
    playersToLocalStorage();
}

function togglePlayerPresence(p : Player) {
    if (adm.players.findIndex( p2 => p === p2 ) < 0) throw "Onbekende speler ?"
    p.participating = !p.participating;
    if (!p.participating)
    {
        if (p.link) breakLink(p.link)
        else if (p.link === 0) xSelected = null
        let filter = (el : Player) => el.playerId !== p.playerId;
        adm.waiting = adm.waiting.filter(filter);
        adm.paused  = adm.paused.filter(filter);
        // If onCourt then player is left on the screen until the court is cleared
    }
    else
    {
        // Note: when a player is on court, checks out and checks in again then this just undoes the check out
        p.paused = false
        if (!p.onCourt) adm.waiting.push(p)
    }
    updateSessionState()
    //barcode.value = null;
}

function clearSelectedPlayer()
{
    if (xSelected) {
        delete(xSelected.link)
        xSelected = null
    }
}

// When editing player links, a player on screen is clicked
function linkUpdate(player : Player, alertHandler : (title: string, msg: string) => void) {
    if (player.link === undefined) {
        // Player not linked yet: Create a link / selection
        if (xSelected === null) {
            xSelected = player
            player.link = 0
        }
        else {
            createLink(xSelected, player)
            xSelected = null
        }
    }
    else if (player.link === 0) {
        // Player is the "selected player", abort linking, clear selected player
        xSelected = null;
        delete(player.link)
    }
    else if (xSelected !== null) {
        // Trying to link a "selected player" to a player that is already linked: fail and produce a warning
        alertHandler("Fout", `Speler "${player.name}" heeft al een link`)
    }
    else {
        // Selecting a player that has a link already (first click), break the link
        breakLink(player.link)
    }
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
    else if (adm.paused.findIndex(e => e.playerId === player.playerId) < 0)
    {
        let idx = adm.waiting.findIndex(e => e.playerId === player.playerId)
        if (idx >= 0) adm.paused.push(adm.waiting.splice(idx, 1)[0])
    }
}

// Make a paricipating player active (non-paused), whatever it current status is (paused, already waiting or on court)
function makePlayerActive(player : Player) {
    if (player.onCourt != 0) {
        player.paused = false
    }
    else if (adm.waiting.findIndex(e => e.playerId === player.playerId) < 0)
    {
        let idx = adm.paused.findIndex(e => e.playerId === player.playerId)
        if (idx >= 0) adm.waiting.push(adm.paused.splice(idx, 1)[0])
    }
}

enum UndoOption {
    DoNothing = 0,
    Make,
    Keep
}
let stateString = ""
let undoString = ""

function updateSessionState(undoOption : UndoOption = UndoOption.DoNothing) {
    type PlayerId = string | [ string, number ]
    type CourtPlayer = [ PlayerId, string ]
    type CourtState = { s: string, p: CourtPlayer[] }
    let state = {
        w: [] as PlayerId[],    // Waiting players
        p: [] as PlayerId[],    // Paused players
        c: [] as CourtState[],  // On court players (with to-be-paused/gone state)
    }
    adm.waiting.forEach( e => state.w.push(e.link ? [e.playerId, e.link] : e.playerId))
    adm.paused.forEach(  e => state.p.push(e.link ? [e.playerId, e.link] : e.playerId))
    // A court record consists of a state character ('p' paused, '2' double, '1' single), followed by an array of 2-entry player arrays:
    // One player array consists of the player ID, followed by the state, 'g' gone, 'p' to-be-paused, '-' normal/active
    // If the player is linked then instead of a player ID string a 2-element array if player ID & link number is used
    adm.courts.forEach( (c) => {
        let record = { s: c.paused ? 'p' : c.isDouble ? '2' : '1', p: [] as CourtPlayer[] };
        c.players.forEach(p => record.p.push([p.link ? [p.playerId, p.link] : p.playerId, !p.participating ? 'g' : p.paused ? 'p' : '-']))
        state.c.push(record)
    })
    if (undoOption === UndoOption.DoNothing) {
        adm.canUndo = false
    }
    else if (undoOption == UndoOption.Make) {
        undoString = stateString
        adm.canUndo = true
    }   // Third option "Keep" -> no action
    stateString = JSON.stringify(state)
    localStorage.setItem('state', stateString)
}

function resetSessionState() {
    xSelected = null
    adm.waiting = []
    adm.paused = []
    adm.courts.forEach(c => {
        c.isDouble = true
        c.paused = false
        c.players = []
    })
    adm.players.forEach( p => { p.paused = false; p.participating = false; p.onCourt = 0; delete(p.link) } )
    playerLinks = []
}

function restoreSessionStateTo(stateString : string, alertHander: (title : string, msg : string) => void) {
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
            let p = adm.players.find(e => e.playerId === id)
            if (p === undefined)             throw new Error(`ID ${id} is not a known player`)
            p.participating = true
            if (link) p.link = link
            return p
        }
        oldState.w.forEach( (id : any) => adm.waiting.push(getPlayerWithId(id)) )
        oldState.p.forEach( (id : any) => adm.paused.push( getPlayerWithId(id)) )
        if (oldState.c.length != adm.courts.length) throw new Error(`Nr of courts doesn't match`)
        oldState.c.forEach( (c : any, idx : number) => {
            let courtState = c.s;
            if ((courtState.length != 1) || !"p21".includes(courtState)) throw new Error(`Invalid court state '${courtState}'`)
            if ((courtState == 'p') && (c.p.length != 0)) throw new Error("Paused court contained players")
            adm.courts[idx].paused = (courtState === 'p')
            adm.courts[idx].isDouble = (courtState !== '1')
            c.p.forEach( (rec : any) => {
                if (rec.length != 2)        throw new Error("Player on court record length is not 2")
                let id = rec[0]
                let playerState = rec[1]
                if (typeof(playerState) != 'string') throw new Error("On-court player state type is not 'string'")
                if ((playerState.length != 1) || !"gp-".includes(playerState)) throw new Error("Invalid on-court player state")
                let p = getPlayerWithId(id)
                adm.courts[idx].players.push(p)
                p.paused = (playerState === "p")
                p.participating = (playerState !== "g")
                p.onCourt = idx+1
            })
        })
        rebuildPlayerLinks(adm.players)
        console.log("Restored previous session state")
        updateSessionState()
    }
    catch (e)
    {
        resetSessionState()
        alertHander('Probleem', `De vorige sessiestatus kon niet worden hersteld\n'${e}'`)
    }
}

function undo(alertHander: (title : string, msg : string) => void) {
    if (!adm.canUndo || !undoString) return;
    restoreSessionStateTo(undoString, alertHander)
}

function preserveOldState()
{
    let oldState = localStorage.getItem('state')
    if (oldState) {
        localStorage.setItem('old_state', oldState);
    }
}

function restoreOldState(alertHander: (title : string, msg : string) => void)
{
    restoreSessionStateTo(localStorage.getItem('old_state') || "", alertHander)
}

function repairPlayerLists()
{
    adm.waiting.forEach (p => { p.onCourt = 0; p.paused = false })
    adm.paused.forEach  (p => { p.onCourt = 0; p.paused = false })
    adm.courts.forEach((c, idx) => {
        c.players.forEach(p => p.onCourt = idx+1)
    })
}

// clears one court
function clearCourt(c : Court) {
    for (let n = c.players.length; n > 0; --n) {
        let pick = Math.floor(n * Math.random())
        let p = c.players.splice(pick, 1)[0]
        if (p.participating) {
            if (p.paused) {
                adm.paused.push(p);
            }
            else {
                adm.waiting.push(p);
            }
        }
        p.paused = false;
        p.onCourt = 0;
    }
    c.players = [];
}

// fills the courts with participants
function assignParticipants(onCourtAssigment: (courtNr : number) => void) {
    let doUpdateState = false
    adm.courts.forEach((court) => {
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
                            adm.paused.push(last)
                        }
                        else {
                            adm.waiting.unshift(last)
                        }
                    }
                }
                // Ensure that linked waiting players are adjacent in the waiting list and single linked players are removed to notYet[]
                let notYet = []
                let ready = []
                while(adm.waiting.length > 0) {
                    let p = adm.waiting.shift() as Player
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
                    else
                    {
                        onCourtAssigment(court.courtNr)
                    }
                }
                adm.waiting = ready.concat(notYet)
            }
        }
    });
    if (doUpdateState) updateSessionState(UndoOption.Keep)
}


export type {Player, Court, Admin}
export default adm;
export {UndoOption}
export {
    playerTemplate,
    repairPlayerLists,
    loadPlayers,
    playersToLocalStorage,
    isValidGender, isValidRank,
    importPlayers, handleImportData,
    exportPlayers,
    deletePlayer,
    togglePlayerPresence,
    clearSelectedPlayer,
    linkUpdate,
    tagForLink,
    linkedPlayer,
    makePlayerPaused,
    makePlayerActive,
    updateSessionState,
    undo,
    preserveOldState,
    restoreOldState,
    clearCourt,
    assignParticipants
}