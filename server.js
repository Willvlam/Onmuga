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

io.on('connection', socket => {
  socket.on('createRoom', ({ game }) => {
    const roomId = makeRoomId();
    let state = null;
    if (game === 'tictactoe') state = newTicTacToe();
    else if (game === 'connect4') state = newConnectFour();
    else if (game === 'draw') state = { strokes: [], currentDrawer: null, word: null, guesses: [], roundActive: false };
    else state = {};
    rooms[roomId] = { game, players: [socket.id], state };
    socket.join(roomId);
    socket.emit('roomCreated', { roomId });
  });

  socket.on('joinRoom', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return socket.emit('errorMsg', 'Room not found');
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
    }
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
  });

  socket.on('leaveRoom', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.players = room.players.filter(id => id !== socket.id);
    socket.leave(roomId);
    io.to(roomId).emit('playerLeft');
    if (room.players.length === 0) delete rooms[roomId];
  });

  socket.on('disconnect', () => {
    for (const [roomId, room] of Object.entries(rooms)) {
      if (room.players.includes(socket.id)) {
        room.players = room.players.filter(id => id !== socket.id);
        io.to(roomId).emit('playerLeft');
        if (room.players.length === 0) delete rooms[roomId];
      }
    }
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
