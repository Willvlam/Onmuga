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
  if (currentGame === 'draw') renderDraw(state);
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

function renderDraw(state) {
  const wrapper = document.createElement('div'); wrapper.className = 'drawArea';
  const canvasWrap = document.createElement('div'); canvasWrap.className = 'canvasWrap';
  const canvas = document.createElement('canvas'); canvas.width = 700; canvas.height = 400;
  canvas.style.width = '700px'; canvas.style.height = '400px';
  canvasWrap.appendChild(canvas);

  const controls = document.createElement('div'); controls.className = 'drawControls';
  const color = document.createElement('input'); color.type = 'color'; color.value = '#000000';
  const size = document.createElement('input'); size.type = 'range'; size.min = 1; size.max = 20; size.value = 4;
  const clearBtn = document.createElement('button'); clearBtn.textContent = 'Clear';
  controls.appendChild(color); controls.appendChild(size); controls.appendChild(clearBtn);

  const wordBox = document.createElement('div'); wordBox.className = 'wordBox'; wordBox.textContent = 'Word: —';
  const guessInput = document.createElement('input'); guessInput.placeholder = 'Type a guess and press Enter'; guessInput.style.width = '100%';
  const guesses = document.createElement('div'); guesses.className = 'guesses';
  const newRoundBtn = document.createElement('button'); newRoundBtn.textContent = 'New Round';

  wrapper.appendChild(canvasWrap); wrapper.appendChild(controls); wrapper.appendChild(wordBox); wrapper.appendChild(guessInput); wrapper.appendChild(guesses);
  wrapper.appendChild(newRoundBtn);
  gameArea.appendChild(wrapper);

  const ctx = canvas.getContext('2d'); ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // replay existing strokes
  if (state && state.strokes) {
    for (const s of state.strokes) drawStroke(ctx, s);
  }

  // display guesses
  if (state && state.guesses) {
    for (const g of state.guesses) {
      const d = document.createElement('div'); d.textContent = `${shortId(g.player)}: ${g.text}`; guesses.appendChild(d);
    }
  }

  let drawing = false;
  let last = null;

  function sendStrokeSegment(x,y,tool){
    socket.emit('drawData', { roomId: currentRoom, data: { x, y, color: color.value, size: +size.value, tool } });
  }

  function drawStroke(ctx, s){
    if (s.tool === 'begin') { ctx.beginPath(); ctx.strokeStyle = s.color; ctx.lineWidth = s.size; ctx.moveTo(s.x, s.y); }
    else if (s.tool === 'move') { ctx.strokeStyle = s.color; ctx.lineWidth = s.size; ctx.lineTo(s.x, s.y); ctx.stroke(); }
    else if (s.tool === 'end') { ctx.closePath(); }
    else if (s.tool === 'clear') { ctx.clearRect(0,0,canvas.width,canvas.height); }
  }

  // remote stroke
  socket.off('drawData');
  socket.on('drawData', (data) => {
    drawStroke(ctx, data);
  });

  // own inputs
  function getXY(e){
    const rect = canvas.getBoundingClientRect();
    const x = ((e.touches ? e.touches[0].clientX : e.clientX) - rect.left) * (canvas.width/rect.width);
    const y = ((e.touches ? e.touches[0].clientY : e.clientY) - rect.top) * (canvas.height/rect.height);
    return { x, y };
  }

  canvas.addEventListener('pointerdown', (e)=>{
    if (state && state.currentDrawer && state.currentDrawer !== socket.id) return; // only drawer can draw
    drawing = true; last = getXY(e);
    const s = { ...last, color: color.value, size: +size.value, tool: 'begin' };
    drawStroke(ctx, s); sendStrokeSegment(s.x,s.y,'begin');
  });
  canvas.addEventListener('pointermove', (e)=>{
    if (!drawing) return; const p = getXY(e); const s = { x: p.x, y: p.y, color: color.value, size: +size.value, tool: 'move' }; drawStroke(ctx,s); sendStrokeSegment(s.x,s.y,'move'); last = p;
  });
  canvas.addEventListener('pointerup', (e)=>{ if (!drawing) return; drawing = false; sendStrokeSegment(0,0,'end'); });
  clearBtn.onclick = ()=>{ ctx.clearRect(0,0,canvas.width,canvas.height); socket.emit('drawData', { roomId: currentRoom, data: { tool: 'clear' } }); };

  // guesses
  guessInput.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter' && guessInput.value.trim()){
      socket.emit('makeGuess', { roomId: currentRoom, guess: guessInput.value.trim() });
      guessInput.value = '';
    }
  });

  newRoundBtn.onclick = ()=>{ socket.emit('newDrawRound', { roomId: currentRoom }); };

  socket.off('guessMade');
  socket.on('guessMade', ({ player, text })=>{
    const d = document.createElement('div'); d.textContent = `${shortId(player)}: ${text}`; guesses.appendChild(d); guesses.scrollTop = guesses.scrollHeight;
  });

  socket.off('yourWord');
  socket.on('yourWord', ({ word }) => { wordBox.textContent = `Word: ${word}`; });
  socket.off('drawRoundStart');
  socket.on('drawRoundStart', ({ drawerId }) => {
    wordBox.textContent = drawerId === socket.id ? 'Word: (check your screen)' : 'Word: —';
    // clear canvas/guesses
    ctx.clearRect(0,0,canvas.width,canvas.height); guesses.innerHTML = '';
  });

  socket.off('roundEnd');
  socket.on('roundEnd', ({ winner, word }) => {
    const d = document.createElement('div'); d.textContent = `Round ended. Word: ${word}. Winner: ${shortId(winner)}`; guesses.appendChild(d);
  });
}

function shortId(id){ return id ? id.slice(0,6) : id; }
