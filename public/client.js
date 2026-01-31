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
let roomId = null;

// === Matter.js ===
let engine;
let render;
let world;
let player1Item;
let player2Item;
let mouseConstraint;

// === СТАРТЫЙ ЭКРАН ===
playBtn.addEventListener('click', () => {
  startScreen.classList.remove('active');
  loadingScreen.classList.add('active');

  const socket = io();
  socket.emit('requestToPlay');

  socket.on('startGame', (data) => {
    role = data.role;
    roomId = data.roomId;
    loadingScreen.classList.remove('active');
    gameArea.style.display = 'flex';
    gameCanvas.style.display = 'block';
    initGame(socket);
  });

  socket.on('opponentDisconnected', () => {
    alert('Противник покинул игру!');
    window.location.reload();
  });

  // Получаем начальные позиции предметов
  socket.on('initialItems', (data) => {
    Matter.Body.setPosition(player1Item, { x: data.player1Item.x, y: data.player1Item.y });
    Matter.Body.setAngle(player1Item, data.player1Item.angle);
    Matter.Body.setPosition(player2Item, { x: data.player2Item.x, y: data.player2Item.y });
    Matter.Body.setAngle(player2Item, data.player2Item.angle);
  });

  // Получаем обновления позиции предмета другого игрока
  socket.on('itemPosition', (data) => {
    if (data.id === 'player1' && role === 'player2') {
      Matter.Body.setPosition(player1Item, { x: data.pos.x, y: data.pos.y });
      Matter.Body.setAngle(player1Item, data.pos.angle);
    } else if (data.id === 'player2' && role === 'player1') {
      Matter.Body.setPosition(player2Item, { x: data.pos.x, y: data.pos.y });
      Matter.Body.setAngle(player2Item, data.pos.angle);
    }
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

  // === Загрузка изображения предмета ===
  const itemImg = new Image();
  itemImg.src = 'items/item1.png';

  // === Создание тел предметов ===
  player1Item = Bodies.rectangle(
    150, 200, 50, 50,
    {
      density: 0.04,
      friction: 0.01,
      frictionAir: 0.01,
      restitution: 0.5,
      angle: 0,
      angularStiffness: 1, // Отключаем вращение
      render: { sprite: { texture: itemImg.src, xScale: 0.1, yScale: 0.1 } }
    }
  );

  player2Item = Bodies.rectangle(
    450, 200, 50, 50,
    {
      density: 0.04,
      friction: 0.01,
      frictionAir: 0.01,
      restitution: 0.5,
      angle: 0,
      angularStiffness: 1, // Отключаем вращение
      render: { sprite: { texture: itemImg.src, xScale: 0.1, yScale: 0.1 } }
    }
  );

  World.add(world, [player1Item, player2Item]);

  // === Мышь для перетаскивания ===
  const mouse = Mouse.create(gameCanvas);
  mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
      stiffness: 0.2,
      render: { visible: false }
    }
  });

  // Добавляем проверку: можно двигать только свой предмет
  mouseConstraint.mouse.element.removeEventListener("mousedown", mouseConstraint.mouse._onMouseDown);
  mouseConstraint.mouse.element.addEventListener("mousedown", function(event) {
    const mousePos = mouseConstraint.mouse.absolute;
    if (role === 'player1') {
      if (Matter.Bounds.contains(player1Item.bounds, mousePos)) {
        mouseConstraint.constraint.body = player1Item;
      } else {
        mouseConstraint.constraint.body = null;
      }
    } else if (role === 'player2') {
      if (Matter.Bounds.contains(player2Item.bounds, mousePos)) {
        mouseConstraint.constraint.body = player2Item;
      } else {
        mouseConstraint.constraint.body = null;
      }
    }
  });

  World.add(world, mouseConstraint);

  // === Отправка позиции своего предмета на сервер ===
  setInterval(() => {
    if (role === 'player1') {
      socket.emit('itemMoved', {
        id: 'player1',
        pos: { x: player1Item.position.x, y: player1Item.position.y, angle: player1Item.angle },
        roomId: roomId
      });
    } else if (role === 'player2') {
      socket.emit('itemMoved', {
        id: 'player2',
        pos: { x: player2Item.position.x, y: player2Item.position.y, angle: player2Item.angle },
        roomId: roomId
      });
    }
  }, 1000 / 30); // 30 раз в секунду

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

    // Рисуем предметы
    ctx.save();
    ctx.translate(player1Item.position.x, player1Item.position.y);
    ctx.rotate(player1Item.angle);
    ctx.drawImage(itemImg, -25, -25, 50, 50);
    ctx.restore();

    ctx.save();
    ctx.translate(player2Item.position.x, player2Item.position.y);
    ctx.rotate(player2Item.angle);
    ctx.drawImage(itemImg, -25, -25, 50, 50);
    ctx.restore();
  }

  setInterval(update, 1000 / 60); // 60 FPS для отрисовки
}

// === Функция выбора предмета из инвентаря ===
function selectItem(element) {
  if (element.dataset.itemId === 'item1') {
    console.log("Выбран предмет: item1");
  }
}
