
/** Player as persisted in local storage (without state) */
interface KnownPlayer {
    name:           string;
    playerId:       string;
    gender:         string;
    level:          number;
}

/** Player as used run-time to store identity & state */
interface IPlayer extends KnownPlayer {
    participating:  boolean;
    paused:         boolean;
    onCourt:        number;     // 0 => not on any court
    link?:          number;
}

/** Player object with identity and state */
class Player implements IPlayer {
    name     : string;
    playerId : string;
    gender   : string;
    level    : number;
    link     : number|undefined = undefined;

    participating = false;
    paused = false;
    onCourt = 0;

    constructor(id = "", name = "", gender = "g", level = 1)
    {
        this.name     = name;
        this.playerId = id;
        this.gender   = gender;
        this.level    = level;
    }

    /** Extract the identity record from this player */
    identity() : KnownPlayer {
        return {
            name:     this.name,
            playerId: this.playerId,
            gender:   this.gender,
            level:    this.level
        }
    }
}

export {type KnownPlayer, type IPlayer, Player}
