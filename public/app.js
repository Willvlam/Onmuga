const socket = io();

let currentRoom = null;
let myRole = null;
let currentGame = null;

const el = id => document.getElementById(id);
const status = el('status');
const lobby = el('lobby');
const gameSection = el('game');
const gameArea = el('gameArea');
const roomIdDisplay = el('roomIdDisplay');
const roleDisplay = el('roleDisplay');
const gameStatus = el('gameStatus');

el('createBtn').onclick = () => {
  const game = el('gameSelect').value;
  socket.emit('createRoom', { game });
  status.textContent = 'Room created, waiting for player to join...';
};

el('joinBtn').onclick = () => {
  const roomId = el('roomInput').value.trim().toUpperCase();
  if (!roomId) return;
  currentRoom = roomId;
  socket.emit('joinRoom', { roomId });
  lobby.classList.add('hidden');
  gameSection.classList.remove('hidden');
  roomIdDisplay.textContent = roomId;
  roleDisplay.textContent = 'Joining...';
  gameStatus.textContent = 'Joining room...';
};

el('leaveBtn').onclick = () => {
  if (currentRoom) socket.emit('leaveRoom', { roomId: currentRoom });
  resetToLobby('Left the room');
};

socket.on('roomCreated', ({ roomId }) => {
  currentRoom = roomId;
  roomIdDisplay.textContent = roomId;
  lobby.classList.add('hidden');
  gameSection.classList.remove('hidden');
  roleDisplay.textContent = 'Waiting...';
  gameStatus.textContent = 'Waiting for another player to join';
});

socket.on('errorMsg', msg => { status.textContent = msg; });

socket.on('start', ({ game, roles, players }) => {
  currentGame = game;
  // find my role based on socket id
  const idx = players.indexOf(socket.id);
  myRole = roles[idx] || roles[0];
  roleDisplay.textContent = myRole;
  roomIdDisplay.textContent = currentRoom || players.join('-');
  gameStatus.textContent = '';
  renderState(null);
});

socket.on('update', ({ state }) => {
  renderState(state);
});

socket.on('playerLeft', () => {
  gameStatus.textContent = 'Other player left the room';
});

function resetToLobby(msg) {
  currentRoom = null; myRole = null; currentGame = null;
  lobby.classList.remove('hidden');
  gameSection.classList.add('hidden');
  status.textContent = msg || '';
  gameArea.innerHTML = '';
}

function renderState(state) {
  gameArea.innerHTML = '';
  if (!currentGame) return;
  if (currentGame === 'tictactoe') renderTicTacToe(state);
  if (currentGame === 'connect4') renderConnect4(state);
}

function renderTicTacToe(state) {
  const board = state ? state.board : Array(9).fill(null);
  const turn = state ? state.turn : null;
  const winner = state ? state.winner : null;
  const grid = document.createElement('div'); grid.className = 'ttt';
  board.forEach((v,i) => {
    const c = document.createElement('div'); c.className = 'cell'; c.textContent = v || '';
    c.onclick = () => {
      if (!currentRoom) return;
      if (winner) return;
      if ((turn === 'X' && myRole !== 'X') || (turn === 'O' && myRole !== 'O')) return;
      if (v) return;
      socket.emit('makeMove', { roomId: currentRoom, move: i });
    };
    grid.appendChild(c);
  });
  gameArea.appendChild(grid);
  if (winner) {
    gameStatus.textContent = winner === 'draw' ? 'Draw!' : `Winner: ${winner}`;
  } else if (turn) {
    gameStatus.textContent = `Turn: ${turn} ${turn === myRole ? '(your turn)' : ''}`;
  }
}

function renderConnect4(state) {
  const b = state ? state.board : Array.from({length:6}, () => Array(7).fill(null));
  const turn = state ? state.turn : null;
  const winner = state ? state.winner : null;
  const grid = document.createElement('div'); grid.className = 'connect4';
  // allow clicking on columns by replacing first row slots with buttons
  for (let c=0;c<7;c++){
    const colBtn = document.createElement('div'); colBtn.className = 'slot'; colBtn.style.cursor = 'pointer';
    colBtn.textContent = '▼';
    colBtn.onclick = () => {
      if (!currentRoom) return;
      if (winner) return;
      if ((turn === 'R' && myRole !== 'R') || (turn === 'Y' && myRole !== 'Y')) return;
      socket.emit('makeMove', { roomId: currentRoom, move: c });
    };
    grid.appendChild(colBtn);
  }
  for (let r=0;r<6;r++){
    for (let c=0;c<7;c++){
      const s = document.createElement('div'); s.className = 'slot';
      const v = b[r][c];
      if (v === 'R') s.style.background = 'radial-gradient(circle at 30% 35%, #ff7b7b, #cc0000)';
      else if (v === 'Y') s.style.background = 'radial-gradient(circle at 30% 35%, #fff2a8, #d4b200)';
      grid.appendChild(s);
    }
  }
  gameArea.appendChild(grid);
  if (winner) {
    gameStatus.textContent = winner === 'draw' ? 'Draw!' : `Winner: ${winner}`;
  } else if (turn) {
    gameStatus.textContent = `Turn: ${turn} ${turn === myRole ? '(your turn)' : ''}`;
  }
}
