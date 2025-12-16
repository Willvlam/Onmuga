const assert = require('assert');
const server = require('../server');
const { newTowerDef, startWave, updateRoomState } = server;

console.log('Running Tower Defense tests...');

let s = newTowerDef();
assert.strictEqual(s.towers.length, 0);
assert.strictEqual(s.enemies.length, 0);
assert.strictEqual(s.lives, 10);

// simulate a room wrapper like in server
const room = { state: s };
// attach to server rooms so updateRoomState can access it
server.rooms = server.rooms || {};
server.rooms['r1'] = room;

// start wave
startWave(room);
assert.ok(s.enemies.length >= 5);

// run a few ticks to ensure movement
for (let i=0;i<10;i++) updateRoomState(room);

// add a tower and ensure it damages enemies
s.towers.push({ x: 200, range: 200, rate: 1, damage: 10, cooldown: 0 });
const before = s.enemies.length;
for (let i=0;i<5;i++) updateRoomState('r1');
assert.ok(s.enemies.length < before || s.score > 0);

console.log('Tower Defense tests done. (Note: minimal smoke tests)');
