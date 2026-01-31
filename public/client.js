const startScreen = document.getElementById('start-screen');
const loadingScreen = document.getElementById('loading-screen');
const gameArea = document.getElementById('game-area');
const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');

// === Устанавливаем резкие пиксели на canvas ===
ctx.imageSmoothingEnabled = false;
ctx.webkitImageSmoothingEnabled = false;
ctx.mozImageSmoothingEnabled = false;
ctx.msImageSmoothingEnabled = false;

const playBtn = document.getElementById('play-btn');

let playerId;
let players = {};
let role = null;

// === СТАРТЫЙ ЭКРАН ===
playBtn.addEventListener('click', () => {
  startScreen.classList.remove('active');
  loadingScreen.classList.add('active');

  const socket = io();
  socket.emit('requestToPlay');

  socket.on('startGame', () => {
    loadingScreen.classList.remove('active');
    gameArea.style.display = 'flex';
    gameCanvas.style.display = 'block';
    initGame(socket);
  });

  socket.on('setPlayerData', (data) => {
    playerId = data.id;
    role = data.role;
    console.log('Вы —', role);
  });

  socket.on('opponentDisconnected', () => {
    alert('Противник покинул игру!');
    window.location.reload();
  });
});

// === ИГРОВАЯ ЛОГИКА ===
function initGame(socket) {
  socket.on('currentPlayers', (currentPlayers) => {
    players = currentPlayers;
    draw();
  });

  socket.on('playerMoved', (movedPlayer) => {
    if (movedPlayer.id !== playerId) {
      players[movedPlayer.id] = movedPlayer;
    }
    draw();
  });

  // Клавиши
  const keys = {};
  window.addEventListener('keydown', (e) => keys[e.key] = true);
  window.addEventListener('keyup', (e) => keys[e.key] = false);

  let lastSentTime = 0;
  const sendInterval = 1000 / 30; // 30 раз в секунду

  function update() {
    if (!players[playerId]) return;

    const speed = 5;
    const p = players[playerId];

    let moved = false;

    if (keys['ArrowUp'] && p.y > 0) {
      p.y -= speed;
      moved = true;
    }
    if (keys['ArrowDown'] && p.y < gameCanvas.height - 20) {
      p.y += speed;
      moved = true;
    }
    if (keys['ArrowLeft'] && p.x > 0) {
      p.x -= speed;
      moved = true;
    }
    if (keys['ArrowRight'] && p.x < gameCanvas.width - 20) {
      p.x += speed;
      moved = true;
    }

    // Отправляем позицию на сервер с интервалом
    const now = Date.now();
    if (moved && now - lastSentTime >= sendInterval) {
      socket.emit('playerMove', { x: p.x, y: p.y, id: playerId });
      lastSentTime = now;
    }

    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
    for (const id in players) {
      const player = players[id];
      ctx.fillStyle = player.color;
      ctx.fillRect(player.x, player.y, 20, 20);
    }
  }

  setInterval(update, 1000 / 60); // 60 FPS для отрисовки
}
