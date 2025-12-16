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
const drawerDisplay = el('drawerDisplay');
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
  if (currentGame === 'tower') renderTower(state);
  if (currentGame === 'towerdef') renderTowerDef(state);
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
  const replay = document.createElement('button'); replay.textContent = 'Replay';
  replay.onclick = () => { if (!currentRoom) return; socket.emit('replayGame', { roomId: currentRoom }); };
  gameArea.appendChild(replay);
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
  const replay = document.createElement('button'); replay.textContent = 'Replay';
  replay.onclick = () => { if (!currentRoom) return; socket.emit('replayGame', { roomId: currentRoom }); };
  gameArea.appendChild(replay);
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

  const wordBox = document.createElement('div'); wordBox.className = 'wordBox';
  // show current drawer from state so UI stays in sync
  const currentDrawer = state && state.currentDrawer ? state.currentDrawer : null;
  if (drawerDisplay) drawerDisplay.textContent = currentDrawer ? shortId(currentDrawer) + (currentDrawer === socket.id ? ' (you)' : '') : '—';
  if (currentDrawer) {
    wordBox.textContent = currentDrawer === socket.id ? `Word: ${state && state.word ? state.word : '(check your screen)'}` : 'Word: —';
  } else {
    wordBox.textContent = 'Word: —';
  }
  const guessInput = document.createElement('input'); guessInput.placeholder = 'Type a guess and press Enter'; guessInput.style.width = '100%';
  const guesses = document.createElement('div'); guesses.className = 'guesses';
  const newRoundBtn = document.createElement('button'); newRoundBtn.textContent = 'New Round';

  wrapper.appendChild(canvasWrap); wrapper.appendChild(controls); wrapper.appendChild(wordBox); wrapper.appendChild(guessInput); wrapper.appendChild(guesses);
  wrapper.appendChild(newRoundBtn);
  const replayBtn = document.createElement('button'); replayBtn.textContent = 'Replay';
  replayBtn.onclick = () => { if (!currentRoom) return; socket.emit('replayGame', { roomId: currentRoom }); };
  wrapper.appendChild(replayBtn);
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
    // update room header drawer
    if (drawerDisplay) drawerDisplay.textContent = shortId(drawerId) + (drawerId === socket.id ? ' (you)' : '');
    // clear canvas/guesses
    ctx.clearRect(0,0,canvas.width,canvas.height); guesses.innerHTML = '';
  });

  socket.off('roundEnd');
  socket.on('roundEnd', ({ winner, word }) => {
    const d = document.createElement('div'); d.textContent = `Round ended. Word: ${word}. Winner: ${shortId(winner)}`; guesses.appendChild(d);
  });
  // show reset notification
  socket.off('gameReset');
  socket.on('gameReset', ({ game }) => {
    const n = document.createElement('div'); n.textContent = `${game} has been reset.`; n.style.marginTop = '6px'; guesses.appendChild(n);
  });
}

function renderTower(state) {
  const wrapper = document.createElement('div'); wrapper.className = 'towerArea';
  const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 500;
  canvas.className = 'towerCanvas';
  wrapper.appendChild(canvas);

  const score = document.createElement('div'); score.className = 'towerScore';
  const blocks = state ? state.blocks : [];
  const gameOver = state ? state.gameOver : false;
  score.textContent = `Blocks: ${blocks.length}`;
  wrapper.appendChild(score);

  const info = document.createElement('div'); info.className = 'towerInfo';
  info.textContent = gameOver ? 'Game Over! Click on blocks to stack them.' : 'Click on the moving block to drop it!';
  wrapper.appendChild(info);

  const replay = document.createElement('button'); replay.textContent = 'Replay';
  replay.onclick = () => { if (!currentRoom) return; socket.emit('replayGame', { roomId: currentRoom }); };
  wrapper.appendChild(replay);

  gameArea.appendChild(wrapper);

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#34495e';
  ctx.fillRect(0, 0, 400, 500);

  // draw blocks
  if (blocks) {
    blocks.forEach((block, idx) => {
      ctx.fillStyle = `hsl(${idx * 10}, 70%, 50%)`;
      ctx.fillRect(block.x, block.y, block.width, 20);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeRect(block.x, block.y, block.width, 20);
    });
  }

  // animate moving block at top
  let blockX = 175;
  let blockWidth = 50;
  let direction = 1;
  let animationId = null;

  function drawMovingBlock() {
    const imageData = ctx.getImageData(0, 0, 400, 100);
    ctx.fillStyle = '#34495e';
    ctx.fillRect(0, 0, 400, 100);
    ctx.putImageData(imageData, 0, 0);

    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(blockX, 10, blockWidth, 20);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(blockX, 10, blockWidth, 20);

    blockX += direction * 3;
    if (blockX <= 0 || blockX + blockWidth >= 400) direction *= -1;
  }

  function animate() {
    drawMovingBlock();
    if (!gameOver) animationId = requestAnimationFrame(animate);
  }

  if (!gameOver) animate();

  canvas.addEventListener('click', () => {
    if (animationId) cancelAnimationFrame(animationId);
    socket.emit('makeMove', { roomId: currentRoom, move: blockX });
  });
}

function shortId(id){ return id ? id.slice(0,6) : id; }

function renderTowerDef(state) {
  const wrapper = document.createElement('div'); wrapper.className = 'towerDefArea';
  const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 360; canvas.className = 'towerCanvas';
  wrapper.appendChild(canvas);

  const hud = document.createElement('div'); hud.style.display = 'flex'; hud.style.gap = '12px'; hud.style.alignItems = 'center';
  const score = document.createElement('div'); score.textContent = `Score: ${state ? state.score : 0}`; hud.appendChild(score);
  const lives = document.createElement('div'); lives.textContent = `Lives: ${state ? state.lives : 0}`; hud.appendChild(lives);
  const info = document.createElement('div'); info.style.color = '#94a3b8'; info.textContent = state && state.gameOver ? 'Game Over' : (state && state.running ? 'Wave in progress' : 'Click to place tower'); hud.appendChild(info);
  const startBtn = document.createElement('button'); startBtn.textContent = 'Start Wave'; startBtn.onclick = ()=>{ if (!currentRoom) return; socket.emit('makeMove', { roomId: currentRoom, move: { type: 'startWave' } }); };
  hud.appendChild(startBtn);
  const replayBtn = document.createElement('button'); replayBtn.textContent = 'Replay'; replayBtn.onclick = () => { if (!currentRoom) return; socket.emit('replayGame', { roomId: currentRoom }); };
  hud.appendChild(replayBtn);
  wrapper.appendChild(hud);

  gameArea.appendChild(wrapper);

  const ctx = canvas.getContext('2d');
  function draw() {
    ctx.fillStyle = '#2d3748'; ctx.fillRect(0,0,canvas.width,canvas.height);
    // towers
    if (state && state.towers) {
      for (const t of state.towers) {
        ctx.fillStyle = '#60a5fa'; ctx.fillRect(t.x-10, 240, 20, 40);
        ctx.strokeStyle = '#000'; ctx.strokeRect(t.x-10, 240, 20, 40);
      }
    }
    // enemies
    if (state && state.enemies) {
      for (const e of state.enemies) {
        ctx.fillStyle = '#f97316'; ctx.fillRect(e.x, e.y, 30, 30);
        ctx.fillStyle = '#fff'; ctx.fillRect(e.x, e.y-6, Math.max(0, 30 * (e.hp / 6)), 4);
      }
    }
    // overlay score/lives
    score.textContent = `Score: ${state ? state.score : 0}`;
    lives.textContent = `Lives: ${state ? state.lives : 0}`;
    info.textContent = state && state.gameOver ? 'Game Over' : (state && state.running ? 'Wave in progress' : 'Click to place tower');
    requestAnimationFrame(()=>{});
  }

  canvas.addEventListener('click', (e)=>{
    if (!currentRoom) return;
    if (state && state.gameOver) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * (canvas.width/rect.width));
    socket.emit('makeMove', { roomId: currentRoom, move: { type: 'place', x: Math.max(10, Math.min(390, Math.round(x))) } });
  });

  draw();
}
