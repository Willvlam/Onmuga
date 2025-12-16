/*
Simple test client for Onmuga server.
Usage:
  node scripts/test_client.js [game] [serverUrl]
Examples:
  node scripts/test_client.js towerdef http://localhost:3000

Note: install socket.io-client if not present:
  npm install socket.io-client
*/

const game = process.argv[2] || 'towerdef';
const url = process.argv[3] || (process.env.URL || 'http://localhost:3000');

let io;
try {
  io = require('socket.io-client');
} catch (e) {
  console.error('Missing dependency socket.io-client. Install with: npm install socket.io-client');
  process.exit(1);
}

const socket = io(url, { transports: ['websocket'], reconnectionAttempts: 3 });

socket.on('connect', () => {
  console.log('connected ->', socket.id);
  console.log('creating room for game=', game);
  socket.emit('createRoom', { game });
});

let currentRoom = null;
socket.on('roomCreated', ({ roomId }) => {
  currentRoom = roomId;
  console.log('roomCreated', roomId);
});

socket.on('start', (data) => {
  console.log('start', data);
});

socket.on('update', ({ state }) => {
  console.log('update', JSON.stringify(state, null, 2));
});

socket.on('gameReset', (d) => console.log('gameReset', d));
socket.on('errorMsg', (m) => console.log('errorMsg', m));

socket.on('disconnect', (reason) => {
  console.log('disconnected', reason);
});

socket.on('connect_error', (err) => {
  console.error('connect_error', err.message || err);
});

// helper to send actions from console
process.stdin.setEncoding('utf8');
console.log('\nType commands: place <x> | start | replay | quit');
process.stdin.on('data', (raw) => {
  const line = raw.trim();
  if (!line) return;
  const parts = line.split(' ');
  const cmd = parts[0];
  if (cmd === 'place') {
    const x = Number(parts[1]) || 200;
    console.log('placing tower at', x);
    if (!currentRoom) { console.log('No room yet, cannot place'); } else socket.emit('makeMove', { roomId: currentRoom, move: { type: 'place', x } });
  } else if (cmd === 'start') {
    console.log('starting wave');
    if (!currentRoom) { console.log('No room yet, cannot start wave'); } else socket.emit('makeMove', { roomId: currentRoom, move: { type: 'startWave' } });
  } else if (cmd === 'replay') {
    console.log('replay');
    if (!currentRoom) { console.log('No room yet, cannot replay'); } else socket.emit('replayGame', { roomId: currentRoom });
  } else if (cmd === 'quit') {
    console.log('quitting'); process.exit(0);
  } else {
    console.log('unknown command', line);
  }
});
