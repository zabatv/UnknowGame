// --- Matter.js ---
const Engine = Matter.Engine,
      Render = Matter.Render,
      Runner = Matter.Runner,
      Bodies = Matter.Bodies,
      World = Matter.World,
      Mouse = Matter.Mouse,
      MouseConstraint = Matter.MouseConstraint;

const startScreen = document.getElementById('start-screen');
const loadingScreen = document.getElementById('loading-screen');
const gameArea = document.getElementById('game-area');
const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');

// === Отключаем сглаживание для canvas ===
ctx.imageSmoothingEnabled = false;
ctx.webkitImageSmoothingEnabled = false;
ctx.mozImageSmoothingEnabled = false;
ctx.msImageSmoothingEnabled = false;

const playBtn = document.getElementById('play-btn');

let playerId;
let players = {};
let role = null;

// === Matter.js ===
let engine;
let render;
let world;
let item1Body;

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
  // === Инициализация физики ===
  engine = Engine.create();
  world = engine.world;

  // Создаём рендер (не используем его напрямую, а рисуем сами)
  render = Render.create({
    canvas: gameCanvas,
    engine: engine,
    options: {
      width: gameCanvas.width,
      height: gameCanvas.height,
      wireframes: false,
      background: 'white'
    }
  });

  // Добавляем границы
  const ground = Bodies.rectangle(gameCanvas.width / 2, gameCanvas.height + 10, gameCanvas.width, 20, { isStatic: true });
  const leftWall = Bodies.rectangle(-10, gameCanvas.height / 2, 20, gameCanvas.height, { isStatic: true });
  const rightWall = Bodies.rectangle(gameCanvas.width + 10, gameCanvas.height / 2, 20, gameCanvas.height, { isStatic: true });
  const ceiling = Bodies.rectangle(gameCanvas.width / 2, -10, gameCanvas.width, 20, { isStatic: true });

  World.add(world, [ground, leftWall, rightWall, ceiling]);

  // === Мышь для перетаскивания ===
  const mouse = Mouse.create(gameCanvas);
  const mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
      stiffness: 0.2,
      render: { visible: false }
    }
  });

  World.add(world, mouseConstraint);

  // === Загрузка изображения предмета ===
  const itemImg = new Image();
  itemImg.src = 'items/item1.png';

  // === Создание тела предмета ===
  item1Body = Bodies.rectangle(
    gameCanvas.width / 2,
    gameCanvas.height / 2,
    50,
    50,
    {
      density: 0.04,
      friction: 0.01,
      frictionAir: 0.01,
      restitution: 0.5,
      render: { sprite: { texture: itemImg.src, xScale: 0.1, yScale: 0.1 } }
    }
  );

  World.add(world, item1Body);

  // Запускаем движок и рендер
  Runner.run(engine);
  Render.run(render);

  // === Socket.io ===
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

    // Рисуем игроков
    for (const id in players) {
      const player = players[id];
      ctx.fillStyle = player.color;
      ctx.fillRect(player.x, player.y, 20, 20);
    }

    // Рисуем предмет с физикой
    ctx.save();
    ctx.translate(item1Body.position.x, item1Body.position.y);
    ctx.rotate(item1Body.angle);
    ctx.drawImage(itemImg, -25, -25, 50, 50);
    ctx.restore();
  }

  setInterval(update, 1000 / 60); // 60 FPS для отрисовки
}

// === Функция выбора предмета из инвентаря ===
function selectItem(element) {
  if (element.dataset.itemId === 'item1') {
    // Предмет уже на поле, можно добавить логику, например, подсветку
    console.log("Выбран предмет: item1");
  }
}
