const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

const rooms = {}; // roomId -> { game, players: [socket.id], state }

const DRAW_WORDS = [
  'cat', 'house', 'tree', 'car', 'guitar', 'pizza', 'robot', 'sun', 'dragon', 'bicycle'
];

// Tower Defense helpers
function newTowerDef() {
  return { towers: [], enemies: [], score: 0, lives: 10, gameOver: false, running: false };
}

function startWave(room) {
  const state = room.state;
  if (!state || state.gameOver) return;
  // spawn 5 enemies with varying hp and speed
  const baseX = 0;
  const count = 5 + Math.floor(state.score / 5);
  state.enemies = state.enemies || [];
  for (let i = 0; i < count; i++) {
    state.enemies.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2,6)}`, x: baseX - i * 40, y: 320, hp: 3 + Math.floor(state.score/10), speed: 1 + Math.random()*0.5 });
  }
  state.running = true;
}

function updateRoomState(roomOrId) {
  const room = typeof roomOrId === 'string' ? rooms[roomOrId] : roomOrId;
  if (!room) return;
  const state = room.state; if (!state || state.gameOver) return;
  // ensure arrays exist
  state.enemies = state.enemies || [];
  state.towers = state.towers || [];

  // move enemies
  for (const e of state.enemies) { e.x += e.speed; }

  // towers auto-shoot (simple instantaneous damage and cooldown)
  for (const t of state.towers) {
    t.cooldown = (t.cooldown || 0) - 1;
    if (t.cooldown <= 0) {
      // find closest enemy in range
      let target = null; let bestDist = Infinity;
      for (const e of state.enemies) {
        const dist = Math.abs((e.x+15) - t.x);
        if (dist <= t.range && dist < bestDist) { bestDist = dist; target = e; }
      }
      if (target) { target.hp -= t.damage; t.cooldown = t.rate; }
    }
  }

  // remove dead enemies
  const before = state.enemies.length;
  state.enemies = state.enemies.filter(e => {
    if (e.hp <= 0) { state.score += 1; return false; }
    return true;
  });

  // enemies reaching end reduce lives
  const reached = [];
  state.enemies = state.enemies.filter(e => {
    if (e.x >= 380) { reached.push(e); return false; }
    return true;
  });
  if (reached.length) {
    state.lives -= reached.length;
    if (state.lives <= 0) state.gameOver = true;
  }

  // stop running if no enemies remain
  if (state.enemies.length === 0) state.running = false;

  // determine roomId for emit
  let roomId = typeof roomOrId === 'string' ? roomOrId : Object.keys(rooms).find(k => rooms[k] === room);
  if (roomId) io.to(roomId).emit('update', { state: room.state });
}


function makeRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// Tic-Tac-Toe helpers
function newTicTacToe() {
  return { board: Array(9).fill(null), turn: 'X', winner: null };
}

function checkTicTacToeWinner(board) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (board.every(Boolean)) return 'draw';
  return null;
}

// Connect Four helpers
function newConnectFour() {
  const cols = 7, rows = 6;
  const board = Array.from({length: rows}, () => Array(cols).fill(null));
  return { board, turn: 'R', winner: null }; // R = red, Y = yellow
}

function dropPiece(board, col, piece) {
  for (let row = board.length - 1; row >= 0; row--) {
    if (!board[row][col]) {
      board[row][col] = piece;
      return { row, col };
    }
  }
  return null;
}

function checkConnectWinner(board) {
  const rows = board.length; const cols = board[0].length;
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (let r=0;r<rows;r++){
    for (let c=0;c<cols;c++){
      const p = board[r][c]; if (!p) continue;
      for (const [dr,dc] of dirs){
        let cnt=1, rr=r+dr, cc=c+dc;
        while (rr>=0 && rr<rows && cc>=0 && cc<cols && board[rr][cc]===p){ cnt++; rr+=dr; cc+=dc }
        if (cnt>=4) return p;
      }
    }
  }
  if (board.every(row => row.every(Boolean))) return 'draw';
  return null;
}

// Tower game helpers
function newTower() {
  return { blocks: [], score: 0, gameOver: false, direction: 1 };
}

function addBlock(state, x) {
  const blocks = state.blocks;
  const newBlock = { x, width: 50, y: 400 - (blocks.length * 20) };
  if (blocks.length > 0) {
    const prevBlock = blocks[blocks.length - 1];
    const overlap = Math.min(prevBlock.x + prevBlock.width, newBlock.x + newBlock.width) - Math.max(prevBlock.x, newBlock.x);
    if (overlap <= 0) {
      state.gameOver = true;
      return { success: false };
    }
    newBlock.width = overlap;
    newBlock.x = Math.max(prevBlock.x, newBlock.x);
  }
  blocks.push(newBlock);
  state.score = blocks.length;
  if (state.score > 20) state.gameOver = true;
  return { success: true, block: newBlock };
}


io.on('connection', socket => {
  socket.on('createRoom', ({ game }) => {
    console.log(`createRoom requested by ${socket.id}: ${game}`);
    const roomId = makeRoomId();
    let state = null;
    if (game === 'tictactoe') state = newTicTacToe();
    else if (game === 'connect4') state = newConnectFour();
    else if (game === 'draw') state = { strokes: [], currentDrawer: null, word: null, guesses: [], roundActive: false };
    else if (game === 'tower') state = newTower();
    else if (game === 'towerdef') state = newTowerDef();
    else state = {};
    rooms[roomId] = { game, players: [socket.id], state };
    socket.join(roomId);
    socket.emit('roomCreated', { roomId });
    // also send start/update directly to the creator socket for single-player games
    if (game === 'tower' || game === 'towerdef') {
      console.log(`Created single-player room ${roomId} for game ${game}`);
      socket.emit('start', { game, roles: ['Player'], players: [socket.id] });
      socket.emit('update', { state });
      console.log(`Emitted start/update to creator ${socket.id} for room ${roomId}`);
    }
    // Tower game is single-player, start immediately
    if (game === 'tower') {
      io.to(roomId).emit('start', { game, roles: ['Player'], players: [socket.id] });
      io.to(roomId).emit('update', { state });
    }
    if (game === 'towerdef') {
      io.to(roomId).emit('start', { game, roles: ['Player'], players: [socket.id] });
      io.to(roomId).emit('update', { state });
      // start periodic tick for this room
      rooms[roomId].tick = setInterval(()=> updateRoomState(roomId), 100);
    }
  });

  socket.on('joinRoom', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return socket.emit('errorMsg', 'Room not found');
    if (room.game === 'tower') return socket.emit('errorMsg', 'Tower is a single-player game');
    if (room.game === 'towerdef') return socket.emit('errorMsg', 'Tower Defense is a single-player game');
    const maxPlayers = room.game === 'draw' ? 8 : 2;
    if (room.players.length >= maxPlayers) return socket.emit('errorMsg', 'Room full');
    room.players.push(socket.id);
    socket.join(roomId);
    // notify both players
    const roles = room.game === 'tictactoe' ? ['X','O'] : ['R','Y'];
    io.to(roomId).emit('start', { game: room.game, roles, players: room.players });
    // special start for draw game when 2+ players
    if (room.game === 'draw' && room.players.length >= 2 && !room.state.roundActive) {
      // pick a drawer randomly
      const drawerIdx = Math.floor(Math.random() * room.players.length);
      const drawerId = room.players[drawerIdx];
      const word = DRAW_WORDS[Math.floor(Math.random() * DRAW_WORDS.length)];
      room.state.currentDrawer = drawerId;
      room.state.word = word;
      room.state.roundActive = true;
      room.state.strokes = [];
      room.state.guesses = [];
      // notify all of round start
      io.to(roomId).emit('drawRoundStart', { drawerId });
      // send the word only to the drawer
      io.to(drawerId).emit('yourWord', { word });
    }
    io.to(roomId).emit('update', { state: room.state });
  });

  socket.on('makeMove', ({ roomId, move }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.state.winner) return;
    if (room.game === 'tictactoe') {
      const { board, turn } = room.state;
      const idx = move;
      if (typeof idx !== 'number' || board[idx]) return;
      board[idx] = turn;
      room.state.winner = checkTicTacToeWinner(board);
      room.state.turn = room.state.turn === 'X' ? 'O' : 'X';
    } else if (room.game === 'connect4') {
      const col = move;
      const piece = room.state.turn;
      const pos = dropPiece(room.state.board, col, piece);
      if (!pos) return;
      room.state.winner = checkConnectWinner(room.state.board);
      room.state.turn = room.state.turn === 'R' ? 'Y' : 'R';
    } else if (room.game === 'tower') {
      const result = addBlock(room.state, move);
      if (!result.success) {
        room.state.gameOver = true;
      }
    } else if (room.game === 'towerdef') {
      // move should be an object describing action
      if (!move || typeof move !== 'object') return;
      if (move.type === 'place') {
        const x = move.x;
        // simple placement: fixed tower params
        if (room.state.gameOver) return;
        room.state.towers = room.state.towers || [];
        room.state.towers.push({ x, range: 80, rate: 10, damage: 1, cooldown: 0 });
      } else if (move.type === 'startWave') {
        startWave(room);
      }
    }
    io.to(roomId).emit('update', { state: room.state });
  });

  socket.on('replayGame', ({ roomId }) => {
    const room = rooms[roomId]; if (!room) return;
    if (room.game === 'tictactoe') {
      room.state = newTicTacToe();
    } else if (room.game === 'connect4') {
      room.state = newConnectFour();
    } else if (room.game === 'draw') {
      room.state = { strokes: [], currentDrawer: null, word: null, guesses: [], roundActive: false };
    } else if (room.game === 'tower') {
      room.state = newTower();
    } else if (room.game === 'towerdef') {
      room.state = newTowerDef();
      // clear and reattach ticker
      if (room.tick) clearInterval(room.tick);
      rooms[roomId].tick = setInterval(()=> updateRoomState(roomId), 100);
    }
    io.to(roomId).emit('gameReset', { game: room.game });
    io.to(roomId).emit('update', { state: room.state });
  });

  // Draw It Out: drawing and guessing events
  socket.on('drawData', ({ roomId, data }) => {
    const room = rooms[roomId]; if (!room) return;
    if (!room.state) return;
    // save strokes for new joiners
    room.state.strokes = room.state.strokes || [];
    room.state.strokes.push(data);
    socket.to(roomId).emit('drawData', data);
  });

  socket.on('makeGuess', ({ roomId, guess }) => {
    const room = rooms[roomId]; if (!room) return;
    room.state.guesses = room.state.guesses || [];
    room.state.guesses.push({ player: socket.id, text: guess });
    io.to(roomId).emit('guessMade', { player: socket.id, text: guess });
    if (room.state.word && guess && guess.trim().toLowerCase() === room.state.word.toLowerCase()) {
      // round ends
      room.state.roundActive = false;
      io.to(roomId).emit('roundEnd', { winner: socket.id, word: room.state.word });
    }
  });

  socket.on('newDrawRound', ({ roomId }) => {
    const room = rooms[roomId]; if (!room) return;
    if (!room.players || room.players.length === 0) return;
    const drawerIdx = room.players.indexOf(room.state.currentDrawer);
    const nextIdx = drawerIdx === -1 ? 0 : (drawerIdx + 1) % room.players.length;
    const drawerId = room.players[nextIdx];
    const word = DRAW_WORDS[Math.floor(Math.random() * DRAW_WORDS.length)];
    room.state.currentDrawer = drawerId;
    room.state.word = word;
    room.state.roundActive = true;
    room.state.strokes = [];
    room.state.guesses = [];
    io.to(roomId).emit('drawRoundStart', { drawerId });
    io.to(drawerId).emit('yourWord', { word });
    // ensure all clients receive the updated state (so UI can show new drawer)
    io.to(roomId).emit('update', { state: room.state });
  });

  socket.on('leaveRoom', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.players = room.players.filter(id => id !== socket.id);
    socket.leave(roomId);
    io.to(roomId).emit('playerLeft');
    if (room.players.length === 0) {
      if (room.tick) clearInterval(room.tick);
      delete rooms[roomId];
    }
  });

  socket.on('disconnect', () => {
    for (const [roomId, room] of Object.entries(rooms)) {
      if (room.players.includes(socket.id)) {
        room.players = room.players.filter(id => id !== socket.id);
        io.to(roomId).emit('playerLeft');
        if (room.players.length === 0) {
          if (room.tick) clearInterval(room.tick);
          delete rooms[roomId];
        }
      }
    }
  });
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the process listening on the port or run with a different PORT environment variable.`);
    console.error(`Find and kill process: lsof -i :${PORT} --pid -sTCP:LISTEN -t || fuser -k ${PORT}/tcp`);
    process.exit(1);
  }
  console.error('Server error:', err);
  process.exit(1);
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// export helpers for tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Object.assign(module.exports || {}, { newTower, addBlock, newTowerDef, startWave, updateRoomState });
}
// expose rooms map for testing
if (typeof module !== 'undefined' && module.exports) module.exports.rooms = rooms;
