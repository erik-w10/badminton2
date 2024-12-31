import xlsxParser from 'xlsx-parse-json';
import { reactive } from 'vue';
import { Picker } from './picker';
import { Player, KnownPlayer } from './player';

enum UndoOption {
    DoNothing = 0,
    Make,
    Keep
}

const storageNames = { players: "participants", state: "state", oldState: "old_state" };

interface PlayerLookup {
    [key : string] : Player;
}
type Court = {
    courtNr:  number;
    isDouble: boolean;
    paused:   boolean;
    lastGame: boolean;
    players:  Player[];
}

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
    "Level":            "level"
};

// Compute the proper tag indicator (character) to show after the player name based on the player link field value specified as argument
function tagForLink(link : any) {
    if (link === undefined) return "";          // Not linked (no tag)
    if (link === 0) return "\u{25C4}";          // Selected in link assignment: left pointing triangle
    if (link > 20)  return "\u{1F517}";         // Link symbol
    return String.fromCodePoint(9311 + link);   // Digit 1..20 in a circle
}

function isValidGender(gen : any) {
    return (typeof(gen) === 'string') && (gen.length == 1) && "vmg".includes(gen);
}

function isValidLevel(level : number) {
    return (level >= 1) && (level <= 5) && (level == Math.trunc(level));
}

function mapImportFields(inp : any[]) : { plrs: Player[], warnings: string[] } {
    let out : Player[] = [];
    let warnings : string [] = [];
    let keyMap : { [key : string] : string }= {};
    let ignoredFields : { [key : string] : boolean } = {};
    let noPlayerCount = 0;
    inp.forEach( (e, idx) => {
        let o : { [key : string] : any }= {};
        for (let fld in e) {
            let field = fld.trim();
            if (labelMap[field] !== undefined) o[labelMap[field]] = e[field];
            else if (ignoredFields[field] === undefined) {
                console.log(`Ignoring field '${field}'`);
                ignoredFields[field] = true;
            }
        }
        if (!o.playerId) {
            ++noPlayerCount;
        }
        else {
            if (keyMap[<string>o.playerId] !== undefined) {
                warnings.push(`Regel ${idx}: DUPLICAAT (${o.name}) ${o.playerId} = '${keyMap[o.playerId]}'`);
            }
            else {
                if (o.name.trim() !== "")
                {
                    if (!isValidGender(o.gender)) o.gender = 'g';
                    o.level = Number.parseFloat(o.level);
                    if (!isValidLevel(o.level)) o.level = 1;
                    o.participating = false;
                    o.paused = false;
                    o.onCourt = 0;
                    out.push(new Player(o.playerId, o.name, o.gender, o.level));
                    keyMap[o.playerId] = o.name;
                }
            }
        }
    });
    if (noPlayerCount) warnings.push(`${noPlayerCount} regels bevatten geen spelernummer`);
    return {plrs: out, warnings: warnings};
}

function fixPlayerList(lookup : PlayerLookup, toFix : Player[]) {
    let stillThere = toFix.filter(p => (lookup[<string>p.playerId] !== undefined));
    return stillThere.map (e => {
        let updated = lookup[<string>e.playerId];
        updated.participating = e.participating;
        updated.paused        = e.paused;
        updated.onCourt       = e.onCourt;
        if (e.link !== undefined) updated.link = e.link;
        return updated;
    });
}

interface IAdminStorage {
    players  : string|null;
    state    : string|null;
    oldState : string|null;
}

class AdminStorage implements IAdminStorage {
    get players() : string|null {
        return localStorage.getItem(storageNames.players);
    }
    set players (value : string)
    {
        localStorage.setItem(storageNames.players, value);
    }

    get state() : string|null {
        return localStorage.getItem(storageNames.state);
    }
    set state (value : string)
    {
        localStorage.setItem(storageNames.state, value);
    }

    get oldState() : string|null {
        return localStorage.getItem(storageNames.oldState);
    }
    set oldState (value : string)
    {
        localStorage.setItem(storageNames.oldState, value);
    }
}


/** Player (state) administration object */
class Admin {
    /** All club members and guest pseudo players, present or not (stateless entries) */
    players : Player[] = [];
    /** Those players[] that are present and waiting to play */
    waiting : Player[] = [];
    /** Those players[] that are/were present but currently not playing */
    paused  : Player[] = [];
    /** List of courts containing the list of players[] that are playing on a particular court */
    courts  : Court[]  = [];
    /** Player links. Format: an entry is null (not used) or [ player1, player2 ] i.e. references to both players structures
        The array index + 1 is stored in the player `link` field and corresponds to a tag character (a digit in a circle starting at (1)) */
    playerLinks : (Player[] | null)[] = [];
    /** The first player selected in a linking operation, else null */
    xSelected = <null|Player>(null);
    /** Indication if the admin status can be reset to previous status ("undo" feature) */
    canUndo : boolean  = false;
    /** Encoded current admin status */
    stateString = "";
    /** Encoded previous admin status ("undo" state) */
    undoString = "";
    /** Object that assigns waiting player to courts using a particular strategy */
    picker = new Picker(false);
    /** Array of flags to indicate if a level can play (there are enough other compatible players), note that the array index should be level-1 */
    levelCanPlay = (Array(5).fill(false) as boolean[]);

    readonly storage : IAdminStorage;

    constructor(nrCourts : number, storage : IAdminStorage = new AdminStorage)
    {
        for (let nr = 1;  nr <= nrCourts; ++nr) {
            let court = {
                courtNr: nr,
                isDouble: true,
                paused: false,
                lastGame: false,
                players: []
            };
            this.courts.push(court);
        }
        this.storage = storage;
    }

    /** Link two players */
    createLink(player1 : Player, player2 : Player) {
        let idx = this.playerLinks.findIndex(e => e === null);
        if (idx < 0) {
            idx = this.playerLinks.length;
            this.playerLinks.push([player1, player2]);
        }
        else {
            this.playerLinks[idx] = [player1, player2];
        }
        player1.link = idx+1;
        player2.link = idx+1;
    }

    /** Break the link with the specified number (>= 1) */
    breakLink(linkNr : number) {
        if (linkNr < 1 || linkNr > this.playerLinks.length) throw new Error(`Unknown link number ${linkNr}`);
        let idx = linkNr-1;
        let l = this.playerLinks[idx];
        if (l !== null) {
            delete(l[0].link);
            delete(l[1].link);
            this.playerLinks[idx] = null;
        }
    }

    /** Rebuild playerLinks based on the recovered / reloaded / imported list of players */
    rebuildPlayerLinks()
    {
        let maxLink = this.players.reduce((max, p) => (((p.link || 0) <= max) ? max : <number>p.link ), 0);
        this.playerLinks = [];
        for (let idx = 0;  idx < maxLink;  ++idx) {
            let entry = null;
            let linked = this.players.filter(e => e.link === idx+1);
            if (linked.length > 2) throw new Error(`More than 2 players have link number ${idx+1}`);
            if (linked.length === 2) {
                entry = linked;
            }
            else {
                linked.forEach(e => delete(e.link));
                linked = [];
            }
            this.playerLinks.push(entry);
        }
    }

    /** Load players from persisted storage */
    loadPlayers()
    {
        if (!this.storage.players) {
            this.storage.players = "[]";
        }
        let readIn : any[] = [];
        try {
            readIn = JSON.parse(this.storage.players as string);
        }
        catch (error : any) {
            console.log(`Error decoding players list from local storage '${error}'`);
            readIn = [];
        }
        readIn.forEach( p => {
            let x = p as any;
            if (x.speelNummer !== undefined) { p.playerId = x.speelNummer; delete x.speelNummer; }
            if (x.ranking     !== undefined) delete x.ranking;
            if (x.level       === undefined) x.level = 1;
        });
        this.players = [];
        readIn.forEach(p => { this.players.push(new Player(p.playerId, p.name, p.gender, p.level)); } );
        this.countLevels();
    }

    /** Store the list of know players in persisted storage */
    playersToLocalStorage()
    {
        let r : KnownPlayer[] = [];
        this.players.forEach( p => r.push(p.identity()));
        this.storage.players = JSON.stringify(r);
    }

    /** Handle imported known player list data (a read-in spreadsheet file) */
    handleImportData(array : any, reporter: (warnings: string[]) => void )
    {
        this.xSelected = null;
        let file = new File([array], "some.xlsx");

        xlsxParser.onFileSelection(file)
        .then((data : any) => {
            let { plrs, warnings } = mapImportFields(Object.values(data)[0] as any[]);
            this.players = plrs;
            this.playersToLocalStorage();
            let knownPlayers : PlayerLookup = {}
            this.players.forEach(e => {knownPlayers[<string>e.playerId] = e});
            this.waiting = fixPlayerList(knownPlayers, this.waiting);
            this.paused  = fixPlayerList(knownPlayers, this.paused);
            this.courts.forEach(c => {
                c.players = fixPlayerList(knownPlayers, c.players);
            });
            this.rebuildPlayerLinks();
            if (warnings.length > 0) reporter(warnings);
            this.countLevels();
        });
    }

    /** Retrieve a JSON encoded list of known players */
    exportPlayers() : string|null {
        return this.storage.players;
    }

    /** Remove a player form the know players list */
    deletePlayer(player : Player) {
        if (player.link) this.breakLink(player.link);
        else if (player.link === 0) this.xSelected = null;
        let filter = (el : Player) => el.playerId !== player.playerId;
        this.waiting = this.waiting.filter(filter);
        this.paused = this.paused.filter(filter);
        this.courts.forEach( c => c.players = c.players.filter(filter) );
        this.players = this.players.filter(filter);
        this.playersToLocalStorage();
        this.countLevels();
    }

    /** Update the `level` of the `player` specified */
    updatePlayerLevel (player : Player, level : number) {
        if (!isValidLevel(level) || (player.level == level)) return;
        player.level = level;
        this.playersToLocalStorage();
        this.countLevels();
    }

    /** Toggle the present/absent status of the `player` specified */
    togglePlayerPresence(p : Player)
    {
        if (this.players.findIndex( p2 => p === p2 ) < 0) throw new Error("Onbekende speler ?");
        p.participating = !p.participating;
        if (!p.participating) {
            if (p.link) this.breakLink(p.link);
            else if (p.link === 0) this.xSelected = null;
            let filter = (el : Player) => el.playerId !== p.playerId;
            this.waiting = this.waiting.filter(filter);
            this.paused  = this.paused.filter(filter);
            // If onCourt then player is left on the screen until the court is cleared
        }
        else {
            // Note: when a player is on court, checks out and checks in again then this just undoes the check out
            p.paused = false;
            if (!p.onCourt) this.waiting.push(p);
        }
        this.updateSessionState();
    }

    /** Clear any "selected player" state as used to link players together */
    clearSelectedPlayer()
    {
        if (this.xSelected) {
            delete(this.xSelected.link);
            this.xSelected = null;
        }
    }

    /** When editing player links, a player on screen is clicked */
    linkUpdate(player : Player, alertHandler : (title: string, msg: string) => void) {
        if (player.link === undefined) {
            // Player not linked yet: Create a link / selection
            if (this.xSelected === null) {
                this.xSelected = player;
                player.link = 0;
            }
            else {
                this.createLink(this.xSelected, player);
                this.xSelected = null;
            }
        }
        else if (player.link === 0) {
            // Player is the "selected player", abort linking, clear selected player
            this.xSelected = null;
            delete(player.link);
        }
        else if (this.xSelected !== null) {
            // Trying to link a "selected player" to a player that is already linked: fail and produce a warning
            alertHandler("Fout", `Speler "${player.name}" heeft al een link`);
        }
        else {
            // Selecting a player that has a link already (first click), break the link
            this.breakLink(player.link);
        }
    }

    /** Return the player linked to the `player` specified or null if there is none */
    linkedPlayer(player : Player) {
        if (!player.link) return null;
        let link = this.playerLinks[player.link-1];
        if (!link || link.length != 2) throw new Error(`Link ${player.link} not found`);
        let idx = link.findIndex(e => e.playerId === player.playerId);
        if (idx < 0) throw new Error(`Linked player not found at link ${player.link}`);
        return link[1-idx];
    }

    /** Return the effective level of the `player` specified based on the level of this player and, if applicable, any linked player */
    currentLevel(player : Player) {
        let other = this.linkedPlayer(player);
        return other === null ? player.level : Math.min(player.level, other.level);
    }

    /** Make a participating player paused, whatever its current status is (paused already, waiting or on-court) */
    makePlayerPaused(player : Player) {
        if (player.onCourt != 0) {
            player.paused = true;
        }
        else if (this.paused.findIndex(e => e.playerId === player.playerId) < 0) {
            let idx = this.waiting.findIndex(e => e.playerId === player.playerId);
            if (idx >= 0) this.paused.push(this.waiting.splice(idx, 1)[0]);
        }
        this.countLevels();
    }

    /** Make a participating player active (non-paused), whatever it current status is (paused, already waiting or on court) */
    makePlayerActive(player : Player) {
        if (player.onCourt != 0) {
            player.paused = false;
        }
        else if (this.waiting.findIndex(e => e.playerId === player.playerId) < 0) {
            let idx = this.paused.findIndex(e => e.playerId === player.playerId);
            if (idx >= 0) this.waiting.push(this.paused.splice(idx, 1)[0]);
        }
        this.countLevels();
    }

    /** Update the JSON encoded current admin state and store it in persisted memory.
     *  This allows the state to be recovered after an incident (crash). */
    updateSessionState(undoOption : UndoOption = UndoOption.DoNothing) {
        type PlayerId = string | [ string, number ];
        type CourtPlayer = [ PlayerId, string ];
        type CourtState = { s: string, p: CourtPlayer[] };
        let state = {
            w: [] as PlayerId[],    // Waiting players
            p: [] as PlayerId[],    // Paused players
            c: [] as CourtState[],  // On court players (with to-be-paused/gone state)
        };
        this.waiting.forEach( e => state.w.push(e.link ? [e.playerId, e.link] : e.playerId));
        this.paused.forEach(  e => state.p.push(e.link ? [e.playerId, e.link] : e.playerId));
        // A court record consists of a state character ('p' paused, '2' or 'L' double, '1' or 'l' single, l/L encodes "last game"), followed by an array of 2-entry player arrays:
        // One player array consists of the player ID, followed by the state, 'g' gone, 'p' to-be-paused, '-' normal/active
        // If the player is linked then instead of a player ID string a 2-element array if player ID & link number is used
        this.courts.forEach( (c) => {
            let record = {
                s: c.paused ? 'p' : c.lastGame ? (c.isDouble ? 'L' : 'l') : (c.isDouble ? '2' : '1'),
                p: [] as CourtPlayer[]
            };
            c.players.forEach(p => record.p.push([p.link ? [p.playerId, p.link] : p.playerId, !p.participating ? 'g' : p.paused ? 'p' : '-']));
            state.c.push(record);
        });
        if (undoOption === UndoOption.DoNothing) {
            this.canUndo = false;
        }
        else if (undoOption == UndoOption.Make) {
            this.undoString = this.stateString;
            this.canUndo = true;
        }   // Third option "Keep" -> no action
        this.stateString = JSON.stringify(state);
        this.storage.state = this.stateString;
        this.countLevels();
    }

    /** Reset the admin state */
    resetSessionState() {
        this.xSelected = null;
        this.waiting = [];
        this.paused = [];
        this.courts.forEach(c => {
            c.isDouble = true;
            c.paused = false;
            c.lastGame = false;
            c.players = [];
        });
        this.players.forEach( p => { p.paused = false; p.participating = false; p.onCourt = 0; delete(p.link) } );
        this.playerLinks = [];
        this.countLevels();
    }

    /** Try to restore the admin state to a JSON encoded state recorded earlier ("undo" operation or crash recovery) */
    restoreSessionStateTo(stateString : string, alertHandler: (title : string, msg : string) => void) {
        this.resetSessionState();
        try {
            let oldState = JSON.parse(stateString);
            if (!oldState)                          throw new Error("Old state not found");
            let usedIds : {[key:  string] : boolean } = {};
            const getPlayerWithId = (x : any) => {
                let id = "";
                let link = undefined;
                if (typeof(x) == 'object') {
                    if (typeof(x[0]) != 'string')   throw new Error("ID name part is not 'string'");
                    if (typeof(x[1]) != 'number')   throw new Error("ID type link part not 'number'");
                    link = x[1];
                    id = x[0] as string;
                }
                else if (typeof(x) != 'string')     throw new Error("ID type is not 'string'");
                else id = x as string;

                if (usedIds[id] !== undefined)      throw new Error(`ID ${id} is used twice`);
                usedIds[id] = true;
                let p = this.players.find(e => e.playerId === id);
                if (p === undefined)                throw new Error(`ID ${id} is not a known player`);
                p.participating = true;
                if (link) p.link = link;
                return p;
            }
            oldState.w.forEach( (id : any) => this.waiting.push(getPlayerWithId(id)) );
            oldState.p.forEach( (id : any) => this.paused.push( getPlayerWithId(id)) );
            if (oldState.c.length != this.courts.length) throw new Error(`Nr of courts doesn't match`);
            oldState.c.forEach( (c : any, idx : number) => {
                let courtState = c.s;
                if ((courtState.length != 1) || !"p21lL".includes(courtState)) throw new Error(`Invalid court state '${courtState}'`);
                if ((courtState == 'p') && (c.p.length != 0)) throw new Error("Paused court contained players");
                this.courts[idx].paused = (courtState === 'p');
                this.courts[idx].isDouble = (courtState !== '1') && (courtState !== 'l');
                this.courts[idx].lastGame = (courtState === 'L') || (courtState === 'l');
                c.p.forEach( (rec : any) => {
                    if (rec.length != 2)        throw new Error("Player on court record length is not 2");
                    let [id, playerState] = rec;
                    if (typeof(playerState) != 'string') throw new Error("On-court player state type is not 'string'");
                    if ((playerState.length != 1) || !"gp-".includes(playerState)) throw new Error("Invalid on-court player state");
                    let p = getPlayerWithId(id);
                    this.courts[idx].players.push(p);
                    p.paused = (playerState === "p");
                    p.participating = (playerState !== "g");
                    p.onCourt = idx+1;
                });
            });
            this.rebuildPlayerLinks();
            console.log("Restored previous session state");
            this.updateSessionState();
        }
        catch (e) {
            this.resetSessionState();
            alertHandler('Probleem', `De vorige sessiestatus kon niet worden hersteld\n'${e}'`);
        }
    }

    undo(alertHandler: (title : string, msg : string) => void) {
        if (!this.canUndo || !this.undoString) return;
        this.restoreSessionStateTo(this.undoString, alertHandler);
    }

    /** Store the current admin state as persisted "old state" */
    preserveOldState() {
        let oldState = this.storage.state;
        if (oldState) {
            this.storage.oldState = oldState;
        }
    }

    /** Restore the admin state to that recorded in persisted memory as old state */
    restoreOldState(alertHandler: (title : string, msg : string) => void) {
        this.restoreSessionStateTo(this.storage.oldState || "", alertHandler);
    }

    /** Repair invariants on players in the player lists (e.g. after a drag operation) */
    repairPlayerLists() {
        this.waiting.forEach (p => { p.onCourt = 0; p.paused = false; });
        this.paused.forEach  (p => { p.onCourt = 0; p.paused = false; });
        this.courts.forEach((c, idx) => {
            c.players.forEach(p => p.onCourt = idx+1);
        });
    }

    /** Clear one court */
    clearCourt(c : Court) {
        for (let n = c.players.length; n > 0; --n) {
            let pick = Math.floor(n * Math.random());
            let p = c.players.splice(pick, 1)[0];
            if (p.participating) {
                if (p.paused) {
                    this.paused.push(p);
                }
                else {
                    this.waiting.push(p);
                }
            }
            p.paused = false;
            p.onCourt = 0;
        }
        c.players = [];
        if (c.lastGame) {
            c.paused = true;
            c.lastGame = false;
        }
    }

    /** Select the picker object appropriate for the selected field assignment strategy */
    levelBasedCourtAssignment(enable : boolean) {
        this.picker = new Picker(enable);
    }

    /** Try to fill the courts with participants
     *  @param  onCourtAssignment   Callback to call when a court assignment takes place.
    */
    assignParticipants(onCourtAssignment: (courtNr : number) => void) {
        let doUpdateState = false;
        this.courts.forEach((court) => {
            // Skip court if court is in training mode
            if (court.paused) return;
            // check if court is double or single
            let capacity = court.isDouble ? 4 : 2;
            if (court.players.length != capacity) {
                // First move any remaining players to the front of the waiting list
                while(court.players.length > 0) {
                    doUpdateState = true;
                    let last = court.players.pop() as Player;
                    last.onCourt = 0;
                    if (!last.participating) {
                        last.paused = false;
                    }
                    else {
                        if (last.paused) {
                            last.paused = false;
                            this.paused.push(last);
                        }
                        else {
                            this.waiting.unshift(last);
                        }
                    }
                }
                // Ensure that linked waiting players are adjacent in the waiting list and single linked players are removed to notYet[]
                let notYet = [];
                let ready = [];
                while(this.waiting.length > 0) {
                    let p = this.waiting.shift() as Player;
                    if (p.link) {
                        let idx = notYet.findIndex(e => e.link == p.link);
                        if (idx >= 0) {
                            ready.push(notYet.splice(idx, 1)[0]);       // Remove the peer and push it in the ready waiting list,
                            ready.push(p);                              // Then push the player after it
                        }
                        else {
                            notYet.push(p);                             // Linked player we have not seen the peer of (yet)
                        }
                    }
                    else {  // No link (or 0) pass the player along to the ready list
                        ready.push(p);
                    }
                }
                if (capacity <= ready.length) {
                    let requireLevel = this.currentLevel(ready[0]);
                    let gotSolution = false;

                    for (let require of [ requireLevel, null]) {
                        this.picker.start(!court.isDouble);
                        for (let i = 0;  !gotSolution && (i < ready.length);  ++i) {
                            const withBuddy = !!ready[i].link;
                            let level = this.currentLevel(ready[i]);
                            gotSolution = (this.picker.check(i, withBuddy, level, require));
                            if (withBuddy) ++i;
                        }
                        if (gotSolution) break;
                    }
                    if (gotSolution) {
                        let indices = this.picker.result();
                        court.players = ready.filter((_1, index) =>  indices.includes(index));
                        ready =         ready.filter((_1, index) => !indices.includes(index));
                        for (let p of court.players) {
                            p.onCourt = court.courtNr;
                            p.paused = false;
                        }
                        doUpdateState = true;
                        onCourtAssignment(court.courtNr);
                    }
                }
                this.waiting = ready.concat(notYet);

            }
        });
        if (doUpdateState) this.updateSessionState(UndoOption.Keep);
    }

    /** Count the number of players that are participating (and not paused) of each level and compute `levelCanPlay` data. */
    countLevels() {
        let levelCounts = (Array(5).fill(0) as number[]);
        this.waiting.forEach((p) => { ++levelCounts[this.currentLevel(p)-1]; });
        this.courts.forEach((c) => {
            c.players.forEach((p) => { if (p.participating && !p.paused) ++levelCounts[this.currentLevel(p)-1]; })
        });
        let levelGroupCounts = Array(3).fill(0);
        for (let l=0; l<3; ++l) levelGroupCounts[0] += levelCounts[l];
        for (let l=1; l<4; ++l) levelGroupCounts[1] += levelCounts[l];
        for (let l=2; l<5; ++l) levelGroupCounts[2] += levelCounts[l];
        let canSingle = this.courts.some((c) => !c.paused && !c.isDouble);
        let require = canSingle ? 2 : 4;
        let levelGroupCanPlay = Array(3).fill(false);
        for (let g = 0;  g < 3;  ++g) levelGroupCanPlay[g] = levelGroupCounts[g] >= require;
        if (this.picker.nrLevels() === 1) {
            let canPlay = levelCounts.reduce((acc : number, c) => acc + c) > require;
            this.levelCanPlay.fill(canPlay);
        }
        else {
            this.levelCanPlay[0] = levelGroupCanPlay[0];
            this.levelCanPlay[1] = levelGroupCanPlay[0] || levelGroupCanPlay[1];
            this.levelCanPlay[2] = levelGroupCanPlay[0] || levelGroupCanPlay[1] || levelGroupCanPlay[2];
            this.levelCanPlay[3] =                         levelGroupCanPlay[1] || levelGroupCanPlay[2];
            this.levelCanPlay[4] =                                                 levelGroupCanPlay[2];
        }
    }
}
/** Reactive player administration instance */
let adm  = reactive(new Admin(8));

export type {Player, Court, IAdminStorage}
export default adm;
export {UndoOption, Admin}
export {
    isValidGender,
    isValidLevel,
    tagForLink
}
