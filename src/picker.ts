class LevelPicker
{
    target : number;            // Number of players to collect (4 for a double field, 2 for a single field)
    minLevel : number;          // Lowest level accepted by this picker (inclusive)
    maxLevel : number;          // Highest level accepted by this picker (inclusive)
    indices : number[] = [];    // Indices collected so far

    constructor(target : number, minLevel : number, maxLevel : number)
    {
        this.target = target;
        this.minLevel = minLevel;
        this.maxLevel = maxLevel;
    }

    check(startIdx : number, withBuddy : boolean, level : number) : boolean
    {
        let space = this.target - this.indices.length;
        if ((space < 2) && withBuddy) return false;
        if ((level < this.minLevel) || (level > this.maxLevel)) return false;
        this.indices.push(startIdx);
        if (withBuddy) this.indices.push(startIdx+1);
        return this.indices.length == this.target;
    }
}

class Picker
{
    private threeLevel : boolean;
    private pickers : LevelPicker[] = [];
    private lastPicker : number;

    constructor(threeLevel : boolean)
    {
        this.threeLevel = threeLevel;
        this.lastPicker = threeLevel ? 2 : 0;
    }

    start(single : boolean)
    {
        const playersPerField = single ? 2 : 4;
        this.pickers = [];
        if (this.threeLevel) {
            this.pickers.push(new LevelPicker(playersPerField, 1, 3))
            this.pickers.push(new LevelPicker(playersPerField, 2, 4))
            this.pickers.push(new LevelPicker(playersPerField, 3, 5))
        }
        else {
            this.pickers.push(new LevelPicker(playersPerField, 1, 5))
        }
    }

    check(startIdx : number, withBuddy : boolean, level : number)
    {
        for (let i = 0;  i < this.pickers.length;  ++i) {
            let j = (i + this.lastPicker + 1) % this.pickers.length;   // Ensure pickers are filled round-robin
            if (this.pickers[j].check(startIdx, withBuddy, level)) {
                this.lastPicker = j;
                return true;
            }
        }
        return false;
    }

    result() : number[]
    {
        let winner = this.pickers[this.lastPicker];
        if (winner.indices.length != winner.target) throw new Error('Picker bug');
        return winner.indices;
    }

    nrLevels() : number
    {
        return this.threeLevel ? 3 : 1;
    }
}

export { Picker };