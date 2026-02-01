const startScreen = document.getElementById('start-screen');
const loadingScreen = document.getElementById('loading-screen');
const gameArea = document.getElementById('game-area');
const gameCanvas = document.getElementById('gameCanvas');
const trailsCanvas = document.createElement('canvas'); // === ДИНАМИЧЕСКИ СОЗДАЁМ trailsCanvas ===
const gameCtx = gameCanvas.getContext('2d');
const trailsCtx = trailsCanvas.getContext('2d');

// === Отключаем сглаживание для canvas ===
gameCtx.imageSmoothingEnabled = false;
gameCtx.webkitImageSmoothingEnabled = false;
gameCtx.mozImageSmoothingEnabled = false;
gameCtx.msImageSmoothingEnabled = false;

trailsCtx.imageSmoothingEnabled = false;
trailsCtx.webkitImageSmoothingEnabled = false;
trailsCtx.mozImageSmoothingEnabled = false;
trailsCtx.msImageSmoothingEnabled = false;

const playBtn = document.getElementById('play-btn');
let playerId;
let players = {};
let lines = []; // === ХРАНИМ ЛИНИИ ===
let drawnPoints = []; // === ХРАНИМ ТОЧКИ ===
let projectiles = []; // === ХРАНИМ ИКОНКИ ===
let liquidDrops = []; // === ХРАНИМ КАПЛИ ===
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
        playerId = socket.id; // === УСТАНАВЛИВАЕМ ID ИГРОКА ===
        loadingScreen.classList.remove('active');
        gameArea.style.display = 'flex';
        gameCanvas.style.display = 'block';

        // === НАСТРАИВАЕМ trailsCanvas ===
        trailsCanvas.width = gameCanvas.width;
        trailsCanvas.height = gameCanvas.height;
        trailsCanvas.id = 'trailsCanvas';
        trailsCanvas.style.position = 'absolute';
        trailsCanvas.style.top = '0';
        trailsCanvas.style.left = '0';
        trailsCanvas.style.zIndex = '0'; // Под gameCanvas
        trailsCanvas.style.pointerEvents = 'none'; // Не мешает кликам
        trailsCanvas.style.backgroundColor = 'transparent'; // Прозрачный фон

        // === ВСТАВЛЯЕМ trailsCanvas ПЕРЕД gameCanvas ===
        gameCanvas.parentNode.insertBefore(trailsCanvas, gameCanvas);

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
        dropTimer: 0
    });
}

// === ФУНКЦИЯ СОЗДАНИЯ КАПЛИ ===
function createDrop(x, y) {
    // === НАЧАЛЬНАЯ СКОРОСТЬ КАПЛИ ===
    const initialSpeed = 1.0 + Math.random() * 2.0; // от 1.0 до 3.0
    const angleVariance = (Math.random() - 0.5) * 0.5; // небольшой разброс направления
    const dirAngle = Math.PI / 2 + angleVariance; // начинаем "падать" вниз (+/- угол)

    liquidDrops.push({
        x: x,
        y: y,
        vx: Math.cos(dirAngle) * initialSpeed, // начальная скорость по X
        vy: Math.sin(dirAngle) * initialSpeed, // начальная скорость по Y
        friction: 0.95, // коэффициент трения/замедления (меньше 1.0)
        radius: Math.random() * 2 + 1, // случайный размер капли (1-3px)
        life: 1.0, // начальная "жизнь" (для alpha)
        decayRate: 0.005 // скорость уменьшения жизни (медленнее)
    });
}

// === ИГРОВАЯ ЛОГИКА ===
function initGame(socket) {
    gameCanvas.width = gameCanvas.clientWidth;
    gameCanvas.height = gameCanvas.clientHeight;

    // === ОБНОВЛЯЕМ РАЗМЕР trailsCanvas ПРИ ИЗМЕНЕНИИ ===
    function handleResize() {
        gameCanvas.width = gameCanvas.clientWidth;
        gameCanvas.height = gameCanvas.clientHeight;
        trailsCanvas.width = gameCanvas.width;
        trailsCanvas.height = gameCanvas.height;
    }
    window.addEventListener('resize', handleResize);

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
                    const offsetX = (Math.random() - 0.5) * 20; // от -10 до +10
                    const offsetY = (Math.random() - 0.5) * 10 + 15; // от +10 до +20 (ниже центра иконки)
                    const cos = Math.cos(proj.angle);
                    const sin = Math.sin(proj.angle);
                    const rotatedOffsetX = offsetX * cos - offsetY * sin;
                    const rotatedOffsetY = offsetX * sin + offsetY * cos;

                    createDrop(proj.x + rotatedOffsetX, proj.y + rotatedOffsetY);
                    proj.dropTimer = 0;
                }
            }
        });

        // === ОБНОВЛЕНИЕ КАПЕЛЬ ===
        for (let i = liquidDrops.length - 1; i >= 0; i--) {
            const drop = liquidDrops[i];

            // === ЗАМЕДЛЕНИЕ КАПЛИ ===
            drop.vx *= drop.friction;
            drop.vy *= drop.friction;

            // === ДВИЖЕНИЕ КАПЛИ ===
            drop.x += drop.vx;
            drop.y += drop.vy;

            // === ПРОВЕРКА, НЕ ОСТАНОВИЛАСЬ ЛИ КАПЛЯ ===
            const speedSquared = drop.vx * drop.vx + drop.vy * drop.vy;
            if (speedSquared < 0.01) {
                drop.vx = 0;
                drop.vy = 0;
            }

            // === УМЕНЬШЕНИЕ ЖИЗНИ ===
            drop.life -= drop.decayRate;

            if (drop.life <= 0) {
                // === РИСУЕМ ОКОНЧАТЕЛЬНЫЙ СЛЕД ПОСЛЕ СМЕРТИ КАПЛИ ===
                trailsCtx.globalAlpha = 1.0; // Полностью непрозрачный след
                trailsCtx.fillStyle = '#0000FF'; // Цвет следа
                trailsCtx.beginPath();
                trailsCtx.ellipse(drop.x, drop.y, drop.radius, drop.radius * 1.5, 0, 0, Math.PI * 2);
                trailsCtx.fill();

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
    // === ОЧИСТКА ИГРОВОГО CANVAS ===
    gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

    // Рисуем игроков
    for (const id in players) {
        const player = players[id];
        gameCtx.fillStyle = player.color;
        gameCtx.fillRect(player.x, player.y, 20, 20);
    }

    // Рисуем линии
    lines.forEach((line) => {
        gameCtx.beginPath();
        gameCtx.strokeStyle = '#000000';
        gameCtx.lineWidth = 3;
        gameCtx.moveTo(line.from.x, line.from.y);
        gameCtx.lineTo(line.to.x, line.to.y);
        gameCtx.stroke();
    });

    // Рисуем точки
    drawnPoints.forEach(point => {
        gameCtx.beginPath();
        gameCtx.fillStyle = '#000000';
        gameCtx.arc(point.x, point.y, 5, 0, Math.PI * 2);
        gameCtx.fill();
    });

    // Рисуем снаряды (иконки)
    projectiles.forEach(proj => {
        if (!proj.done && itemIcon.complete) {
            gameCtx.save();
            gameCtx.translate(proj.x, proj.y);
            gameCtx.rotate(proj.angle);

            const iconSize = 30;
            gameCtx.imageSmoothingEnabled = false;
            gameCtx.drawImage(
                itemIcon,
                -iconSize / 2,
                -iconSize,
                iconSize,
                iconSize
            );

            gameCtx.restore();
        }
    });

    // === ОТРИСОВКА ТЕКУЩИХ КАПЕЛЬ (без очистки trailsCanvas) ===
    liquidDrops.forEach(drop => {
        // === РИСУЕМ САМУ КАПЛЮ НА gameCanvas ===
        gameCtx.globalAlpha = drop.life;
        gameCtx.fillStyle = '#0000FF'; // цвет капли
        gameCtx.beginPath();
        gameCtx.ellipse(drop.x, drop.y, drop.radius, drop.radius * 1.5, 0, 0, Math.PI * 2);
        gameCtx.fill();
    });

    // === СБРОС АЛЬФЫ ===
    gameCtx.globalAlpha = 1.0;
    // trailsCtx.globalAlpha НЕ СБРАСЫВАЕМ, потому что следы уже нарисованы и непрозрачны
}

// === ФУНКЦИЯ ВЫБОРА ПРЕДМЕТА (адаптирована под data-item-id) ===
function selectItem(element) {
    // === ИСПРАВЛЕНО: используем kebab-case ===
    const itemId = element.dataset.itemId; // или element.dataset['item-id']
    selectedItem = itemId;

    if (itemId === 'item1') {
        console.log("Выбран предмет: item1 — режим выбора двух точек");
        tempSelectedPoints = [];
        // alert("Кликните два раза на поле, чтобы провести линию."); // Убрано
    } else {
        console.log("Выбран другой предмет:", itemId);
        selectedItem = null;
        tempSelectedPoints = [];
    }
}
