import assert from 'node:assert';
import test from 'node:test';
import {Player} from '../src/player';

test('Player construction', ()=> {
    let p = new Player;
    assert.deepEqual(p.name, "");
});

test('Identity extraction', ()=> {
    let p = new Player("12345", "name", "g", 3);
    p.onCourt = 1;
    p.paused = false;
    assert.deepStrictEqual({name: "name", playerId: "12345", gender: "g", level: 3}, p.identity());
});
