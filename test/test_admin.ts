import assert from 'node:assert/strict';
import test from 'node:test';
import {Player} from '../src/player';
import {Admin, type IAdminStorage} from '../src/player_admin';

class TestStorage implements IAdminStorage {
    players:  string|null = null;
    state:    string|null = null;
    oldState: string|null = null;
};

function makeTestPlayers(admin : Admin)
{
    for(let level = 1;  level < 6;  ++level)
    {
        for (let i = 0; i < 10; ++i)
        {
            let id = 1000*level + i;
            admin.players.push(new Player(`${id}`, `player${id}`, (i % 2 == 0) ? "m" : "v", level));
        }
    }
}

test('Admin construction', ()=> {
    let storage = new TestStorage;
    let admin = new Admin(8, storage);
    makeTestPlayers(admin);
    assert.equal(admin.players.length, 50);
});

test('Single level court assignment', ()=> {
    let storage = new TestStorage;
    let admin = new Admin(2, storage);
    admin.levelBasedCourtAssignment(false);

    makeTestPlayers(admin);
    assert.equal(admin.players.length, 50);
    let add = ['1000', '2000', '3000', '5000'];

    add.forEach( (id) => {
        let player = admin.players.find( p => p.playerId == id );
        assert.ok(player);
        admin.togglePlayerPresence(player);
    });
    assert.equal(admin.waiting.length, 4);

    let court = 0;
    admin.assignParticipants(nr => court = nr);
    assert.equal(court, 1);
    assert.equal(admin.waiting.length, 0);
});

test('Three level court assignment', ()=> {
    let storage = new TestStorage;
    let admin = new Admin(3, storage);
    admin.levelBasedCourtAssignment(true);

    makeTestPlayers(admin);
    assert.equal(admin.players.length, 50);
    ['1000', '5000', '3000', '4000', '2000'].forEach( (id) => {
        let player = admin.players.find( p => p.playerId == id );
        assert.ok(player);
        admin.togglePlayerPresence(player);
    });
    assert.equal(admin.waiting.length, 5);

    let court = 0;
    admin.assignParticipants(nr => court = nr);
    assert.equal(court, 0);
    assert.equal(admin.waiting.length, 5);

    ['1001'].forEach( (id) => {
        let player = admin.players.find( p => p.playerId == id );
        assert.ok(player);
        admin.togglePlayerPresence(player);
    });
    admin.assignParticipants(nr => court = nr);
    assert.equal(court, 1);
    assert.deepEqual(admin.waiting.map(x => x.playerId), ['5000', '4000']);

    ['1002', '5002'].forEach( (id) => {
        let player = admin.players.find( p => p.playerId == id );
        assert.ok(player);
        admin.togglePlayerPresence(player);
    });

    court = 0;
    admin.assignParticipants(nr => court = nr);
    assert.equal(court, 0);

    ['4003'].forEach( (id) => {
        let player = admin.players.find( p => p.playerId == id );
        assert.ok(player);
        admin.togglePlayerPresence(player);
    });
    admin.assignParticipants(nr => court = nr);
    assert.equal(court, 2);
    assert.deepEqual(admin.waiting.map(x => x.playerId), ['1002']);

    ['4004', '2004', '5004', '3004'].forEach( (id) => {
        let player = admin.players.find( p => p.playerId == id );
        assert.ok(player);
        admin.togglePlayerPresence(player);
    });

    court = 0;
    admin.assignParticipants(nr => court = nr);
    assert.equal(court, 0);

    ['4005'].forEach( (id) => {
        let player = admin.players.find( p => p.playerId == id );
        assert.ok(player);
        admin.togglePlayerPresence(player);
    });
    // A game levels [2,3,4] and [3,4,5] are possible, [3,4,5] just happened, expecting [2,3,4] (round-robin)
    admin.assignParticipants(nr => court = nr);
    assert.equal(court, 3);
    assert.deepEqual(admin.waiting.map(x => x.playerId), ['1002', '5004']);
    let game1 = admin.courts[0].players.map(x => x.playerId);
    let game2 = admin.courts[1].players.map(x => x.playerId);
    let game3 = admin.courts[2].players.map(x => x.playerId);
    assert.deepEqual(game1, ['1000', '3000', '2000', '1001']);
    assert.deepEqual(game2, ['5000', '4000', '5002', '4003']);
    assert.deepEqual(game3, ['4004', '2004', '3004', '4005']);
});

test('Three level court assignment, prefer to include 1st player', ()=> {
    let storage = new TestStorage;
    let admin = new Admin(3, storage);
    admin.levelBasedCourtAssignment(true);

    makeTestPlayers(admin);
    assert.equal(admin.players.length, 50);
    ['1000', '4000', '4001', '4002', '3000', '3001', '3002'].forEach( (id) => {
        let player = admin.players.find( p => p.playerId == id );
        assert.ok(player);
        admin.togglePlayerPresence(player);
    });
    assert.equal(admin.waiting.length, 7);

    let court = 0;
    admin.assignParticipants(nr => court = nr);
    assert.equal(court, 1);
    assert.equal(admin.waiting.length, 3);
    assert.deepEqual(admin.waiting.map(x => x.playerId), ['4000', '4001', '4002']);
    let game1 = admin.courts[0].players.map(x => x.playerId);
    assert.deepEqual(game1, ['1000', '3000', '3001', '3002']);
});

test('Three level court assignment, prefer to include 1st player, but if not successful let others play', ()=> {
    let storage = new TestStorage;
    let admin = new Admin(3, storage);
    admin.levelBasedCourtAssignment(true);

    makeTestPlayers(admin);
    assert.equal(admin.players.length, 50);
    ['1000', '4000', '4001', '4002', '3000', '3001'].forEach( (id) => {
        let player = admin.players.find( p => p.playerId == id );
        assert.ok(player);
        admin.togglePlayerPresence(player);
    });
    assert.equal(admin.waiting.length, 6);

    let court = 0;
    admin.assignParticipants(nr => court = nr);
    assert.equal(court, 1);
    assert.equal(admin.waiting.length, 2);
    assert.deepEqual(admin.waiting.map(x => x.playerId), ['1000', '3001']);
    let game1 = admin.courts[0].players.map(x => x.playerId);
    assert.deepEqual(game1, ['4000', '4001', '4002', '3000']);
});

test('Mix players if active players mulitple of 4', ()=> {
    let storage = new TestStorage;
    let admin = new Admin(2, storage);
    admin.levelBasedCourtAssignment(false);

    makeTestPlayers(admin);
    assert.equal(admin.players.length, 50);
    let add = ['1000', '2000', '3000', '4000', '1001', '2001', '3001', '4001' ];

    add.forEach( (id) => {
        let player = admin.players.find( p => p.playerId === id );
        assert.ok(player);
        admin.togglePlayerPresence(player);
    });
    assert.equal(admin.waiting.length, 8);

    let courts : number[] = [];
    admin.assignParticipants(nr => courts.push(nr));
    assert.deepEqual(courts, [1,2]);
    assert.equal(admin.waiting.length, 0);

    assert(!admin.mixMore);
    admin.clearCourt(admin.courts[0]);
    assert(admin.mixMore);
    courts = [];
    admin.assignParticipants(nr => courts.push(nr));
    assert.deepEqual(courts, []);
    assert.equal(admin.waiting.length, 4);
    let Pair1 = admin.waiting.slice(0,2);
    let Pair2 = admin.waiting.slice(2,2);

    admin.clearCourt(admin.courts[1]);
    assert(!admin.mixMore);
    courts = [];
    admin.assignParticipants(nr => courts.push(nr));
    assert.equal(admin.waiting.length, 0);

    assert(Pair1.every(p => p.onCourt == 1));
    assert(Pair2.every(p => p.onCourt == 2));
});

test('Mix mode releases on player login/out and pause/activate', ()=> {
    let storage = new TestStorage;
    let admin = new Admin(2, storage);
    admin.levelBasedCourtAssignment(false);

    makeTestPlayers(admin);
    assert.equal(admin.players.length, 50);
    let add = ['1000', '2000', '3000', '4000' , '5000' ];

    add.forEach( (id) => {
        let player = admin.players.find( p => p.playerId == id );
        assert.ok(player);
        admin.togglePlayerPresence(player);
    });
    let p1000 = admin.players.find( p => p.playerId == '1000') as Player;
    assert.ok(p1000);
    let p5000 = admin.players.find( p => p.playerId == '5000') as Player;
    assert.ok(p5000);
    admin.makePlayerPaused(p5000)
    assert.equal(admin.waiting.length, 4);
    assert.equal(admin.paused.length, 1);

    let courts : number[] = [];
    admin.assignParticipants(nr => courts.push(nr));
    assert.deepEqual(courts, [1]);
    admin.clearCourt(admin.courts[0]);
    assert(admin.mixMore);

    let p1001 = admin.players.find( p => p.playerId == '1001' );
    assert.ok(p1001);
    admin.togglePlayerPresence(p1001);
    assert(!admin.mixMore);

    courts = [];
    admin.assignParticipants(nr => courts.push(nr));
    assert.deepEqual(courts, [1]);
    assert.equal(admin.waiting.length, 1);
    assert.equal(1, p1001.onCourt);
    admin.togglePlayerPresence(admin.waiting[0]);
    assert.equal(admin.waiting.length, 0);
    admin.togglePlayerPresence(p1001);
    admin.makePlayerActive(p5000);
    assert(!admin.mixMore);
    admin.clearCourt(admin.courts[0]);
    assert(!admin.mixMore);

    courts = [];
    admin.assignParticipants(nr => courts.push(nr));
    assert.deepEqual(courts, [1]);
    admin.clearCourt(admin.courts[0]);
    assert(admin.mixMore);
    courts = [];
    admin.assignParticipants(nr => courts.push(nr));
    assert.deepEqual(courts, []);
});

test('Players storage', ()=> {
    let storage = new TestStorage;
    let admin = new Admin(2, storage);
    admin.levelBasedCourtAssignment(true);

    admin.players.push(new Player('1000', 'Wasser Al', 'm', 1));
    admin.players.push(new Player('1001', 'Isser Ook', 'm', 1));
    let iden = admin.players[0].identity();
    assert.deepEqual(iden, { name: 'Wasser Al', playerId: '1000', gender: 'm', level: 1});
    admin.playersToLocalStorage();

    admin.players = [];
    assert.equal(admin.players.length, 0);

    admin.loadPlayers()
    assert.equal(admin.players.length, 2);
    assert.equal(admin.players[0].name, 'Wasser Al');
    assert.equal(admin.players[1].name, 'Isser Ook');
    iden = admin.players[0].identity();
    assert.deepEqual(iden, { name: 'Wasser Al', playerId: '1000', gender: 'm', level: 1});
});

