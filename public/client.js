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
let lines = []; // === НОВОЕ: массив для хранения линий ===
let role = null;
let roomId = null;

// === СТАРТЫЙ ЭКРАН ===
playBtn.addEventListener('click', () => {
    startScreen.classList.remove('active');
    loadingScreen.classList.add('active');
    const socket = io();
    socket.emit('requestToPlay');

    socket.on('gameStart', (data) => {
        role = data.role;
        roomId = data.roomId;
        playerId = socket.id; // === ВАЖНО: устанавливаем ID игрока ===
        loadingScreen.classList.remove('active');
        gameArea.style.display = 'flex';
        gameCanvas.style.display = 'block';
        initGame(socket);
    });

    socket.on('opponentDisconnected', () => {
        alert('Противник покинул игру!');
        window.location.reload();
    });

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

    // === НОВОЕ: получение линии от сервера ===
    socket.on('newLine', (lineData) => {
        lines.push(lineData);
        draw();
    });
});

// === ИГРОВАЯ ЛОГИКА ===
function initGame(socket) {
    gameCanvas.width = gameCanvas.clientWidth;
    gameCanvas.height = gameCanvas.clientHeight;

    // Клавиши
    const keys = {};
    window.addEventListener('keydown', (e) => keys[e.key] = true);
    window.addEventListener('keyup', (e) => keys[e.key] = false);

    let lastSentTime = 0;
    const sendInterval = 1000 / 30; // 30 раз в секунду

    // === НОВОЕ: переменные для работы с линией ===
    let selectedItem = null;
    let selectedPoints = [];

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

    // === НОВОЕ: обработка клика на canvas ===
    gameCanvas.addEventListener('click', (e) => {
        if (selectedItem !== 'item1') return;

        const rect = gameCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        selectedPoints.push({ x, y });

        if (selectedPoints.length === 2) {
            const lineData = { from: selectedPoints[0], to: selectedPoints[1], playerId };
            socket.emit('drawLine', lineData); // === ОТПРАВКА НА СЕРВЕР ===
            selectedPoints = []; // сброс точек
        }
    });

    setInterval(update, 1000 / 60); // 60 FPS для отрисовки
}

// === НОВОЕ: функция draw вынесена из initGame ===
function draw() {
    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

    // Рисуем игроков
    for (const id in players) {
        const player = players[id];
        ctx.fillStyle = player.color;
        ctx.fillRect(player.x, player.y, 20, 20);
    }

    // Рисуем линии
    lines.forEach((line) => {
        ctx.beginPath();
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 3;
        ctx.moveTo(line.from.x, line.from.y);
        ctx.lineTo(line.to.x, line.to.y);
        ctx.stroke();
    });
}

// === Функция выбора предмета из инвентаря ===
function selectItem(element) {
    const itemId = element.dataset.itemId;
    selectedItem = itemId;

    if (itemId === 'item1') {
        console.log("Выбран предмет: item1 — режим выбора двух точек");
        selectedPoints = [];
        alert("Кликните два раза на поле, чтобы провести линию.");
    } else {
        console.log("Выбран другой предмет:", itemId);
        selectedItem = null;
        selectedPoints = [];
    }
}
