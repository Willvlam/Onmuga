const assert = require('assert');
const { newTower, addBlock } = require('../server');

console.log('Running Tower tests...');

// fresh state
let s = newTower();
assert.strictEqual(s.blocks.length, 0);
let r = addBlock(s, 100);
assert.strictEqual(r.success, true);
assert.strictEqual(s.blocks.length, 1);

// overlapping block
r = addBlock(s, 110); // overlaps prev at 100..150
assert.strictEqual(r.success, true);
assert.strictEqual(s.blocks.length, 2);
assert.ok(s.blocks[1].width <= 50);
assert.ok(s.blocks[1].x >= s.blocks[0].x);

// non-overlapping block -> game over
s = newTower();
addBlock(s, 0);
const res = addBlock(s, 200); // no overlap
assert.strictEqual(res.success, false);
assert.strictEqual(s.gameOver, true);

console.log('All Tower tests passed.');
