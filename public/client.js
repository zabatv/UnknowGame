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
let lines = [];
let drawnPoints = [];
let projectiles = []; // === Анимированные иконки ===
let liquidDrops = []; // === Капли жидкости ===
let role = null;
let roomId = null;

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ РАБОТЫ С ЛИНИЕЙ ===
let selectedItem = null;
let tempSelectedPoints = [];

// === Загрузка изображения иконки ===
const itemIcon = new Image();
itemIcon.src = 'items/item1.png';

// === СТАРТЫЙ ЭКРАН ===
playBtn.addEventListener('click', () => {
    startScreen.classList.remove('active');
    loadingScreen.classList.add('active');
    const socket = io();
    socket.emit('requestToPlay');

    socket.on('gameStart', (data) => {
        role = data.role;
        roomId = data.roomId;
        playerId = socket.id;
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

    // === ПРИЁМ ЛИНИИ ОТ СЕРВЕРА ===
    socket.on('newLine', (lineData) => {
        lines.push({
            from: lineData.from,
            to: lineData.to,
            timestamp: Date.now()
        });
        drawnPoints.push(lineData.from, lineData.to);
        launchProjectile(lineData.from, lineData.to);
    });
});

// === ФУНКЦИЯ ЗАПУСКА АНИМИРОВАННОГО СНАРЯДА (с жидкостью) ===
function launchProjectile(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const flightDurationMs = distance * 10; // например, 10ms на пиксель
    const framesForFlight = flightDurationMs / (1000 / 60); // ~60 FPS
    const stepX = dx / framesForFlight;
    const stepY = dy / framesForFlight;

    projectiles.push({
        x: from.x,
        y: from.y,
        targetX: to.x,
        targetY: to.y,
        angle: Math.atan2(dy, dx),
        stepX,
        stepY,
        remainingSteps: framesForFlight,
        done: false,
        dropTimer: 0 // === Таймер для генерации капель ===
    });
}

// === ФУНКЦИЯ СОЗДАНИЯ КАПЛИ ===
function createDrop(x, y) {
    liquidDrops.push({
        x: x,
        y: y,
        vy: 0, // начальная скорость по Y
        gravity: 0.3, // ускорение свободного падения
        radius: Math.random() * 2 + 1, // случайный размер капли (1-3px)
        life: 1.0, // начальная "жизнь" (для alpha)
        decayRate: 0.01 // скорость уменьшения жизни
    });
}

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

        // === ОБНОВЛЕНИЕ ПОЗИЦИИ СНАРЯДОВ ===
        projectiles.forEach(proj => {
            if (proj.done) return;

            if (proj.remainingSteps <= 0) {
                proj.done = true;
            } else {
                proj.x += proj.stepX;
                proj.y += proj.stepY;
                proj.remainingSteps--;

                // === ГЕНЕРАЦИЯ КАПЕЛЬ ===
                proj.dropTimer++;
                if (proj.dropTimer >= 5) { // например, каждые 5 кадров
                    // Добавляем немного случайности к позиции капли относительно иконки
                    const offsetX = (Math.random() - 0.5) * 20; // от -10 до +10
                    const offsetY = (Math.random() - 0.5) * 20; // от -10 до +10
                    createDrop(proj.x + offsetX, proj.y + offsetY);
                    proj.dropTimer = 0;
                }
            }
        });

        // === ОБНОВЛЕНИЕ КАПЕЛЬ ===
        for (let i = liquidDrops.length - 1; i >= 0; i--) {
            const drop = liquidDrops[i];
            drop.vy += drop.gravity; // увеличиваем скорость падения
            drop.y += drop.vy;
            drop.life -= drop.decayRate; // уменьшаем жизнь

            if (drop.life <= 0) {
                liquidDrops.splice(i, 1); // удаляем каплю, если "умерла"
            }
        }

        draw();
    }

    // === ОБРАБОТКА КЛИКА НА CANVAS ===
    gameCanvas.addEventListener('click', (e) => {
        if (selectedItem !== 'item1') return;

        const rect = gameCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        tempSelectedPoints.push({ x, y });
        drawnPoints.push({ x, y });

        if (tempSelectedPoints.length === 2) {
            const lineData = { from: tempSelectedPoints[0], to: tempSelectedPoints[1], playerId };
            socket.emit('drawLine', lineData);
            console.log("Отправлено событие drawLine:", lineData);
            tempSelectedPoints = [];
        }
    });

    setInterval(update, 1000 / 60); // 60 FPS для отрисовки
}

// === ФУНКЦИЯ ОТРИСОВКИ ===
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
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.moveTo(line.from.x, line.from.y);
        ctx.lineTo(line.to.x, line.to.y);
        ctx.stroke();
    });

    // Рисуем точки
    drawnPoints.forEach(point => {
        ctx.beginPath();
        ctx.fillStyle = '#000000';
        ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
        ctx.fill();
    });

    // Рисуем капли (жидкость)
    liquidDrops.forEach(drop => {
        ctx.globalAlpha = drop.life; // прозрачность зависит от "жизни"
        ctx.fillStyle = '#0000FF'; // цвет капли
        ctx.beginPath();
        // Рисуем овал, имитирующий каплю (ширина чуть больше высоты)
        ctx.ellipse(drop.x, drop.y, drop.radius, drop.radius * 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
    });
    // Сбрасываем alpha
    ctx.globalAlpha = 1.0;

    // Рисуем снаряды (иконки)
    projectiles.forEach(proj => {
        if (!proj.done && itemIcon.complete) {
            ctx.save();
            ctx.translate(proj.x, proj.y);
            ctx.rotate(proj.angle);

            const iconSize = 30;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(
                itemIcon,
                -iconSize / 2,
                -iconSize,
                iconSize,
                iconSize
            );

            ctx.restore();
        }
    });
}

// === ФУНКЦИЯ ВЫБОРА ПРЕДМЕТА ===
function selectItem(element) {
    const itemId = element.dataset.itemId;
    selectedItem = itemId;

    if (itemId === 'item1') {
        console.log("Выбран предмет: item1 — режим выбора двух точек");
        tempSelectedPoints = [];
    } else {
        console.log("Выбран другой предмет:", itemId);
        selectedItem = null;
        tempSelectedPoints = [];
    }
}
