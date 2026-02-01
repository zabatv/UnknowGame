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

    // === МАССИВ ДЛЯ ХРАНЕНИЯ КАПЕЛЬ ===
    let liquidDrops = [];

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
            decayRate: 0.005, // скорость уменьшения жизни (медленнее)
            trail: [] // === ИСТОРИЯ ПОЗИЦИЙ ДЛЯ СЛЕДА ===
        });
    }

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

        // === ОБНОВЛЕНИЕ КАПЕЛЬ И ИХ СЛЕДА ===
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
            if (speedSquared < 0.01) { // если скорость очень мала
                drop.vx = 0;
                drop.vy = 0;
            }

            // === ОБНОВЛЕНИЕ СЛЕДА ===
            drop.trail.push({ x: drop.x, y: drop.y });
            if (drop.trail.length > 5) { // ограничиваем длину следа
                drop.trail.shift();
            }

            // === УМЕНЬШЕНИЕ ЖИЗНИ ===
            drop.life -= drop.decayRate;

            if (drop.life <= 0) {
                liquidDrops.splice(i, 1); // удаляем каплю, если "умерла"
            }
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

        // Рисуем капли (жидкость) и их след
        liquidDrops.forEach(drop => {
            // === РИСУЕМ СЛЕД ===
            if (drop.trail.length > 1) {
                for (let j = 0; j < drop.trail.length; j++) {
                    const trailPoint = drop.trail[j];
                    // Прозрачность зависит от "возраста" точки следа (чем дальше, тем прозрачнее)
                    const trailAlpha = (j / drop.trail.length) * drop.life; // учитываем общую жизнь капли
                    ctx.globalAlpha = trailAlpha;
                    ctx.fillStyle = '#0000FF'; // цвет следа (тот же, что и капля)
                    ctx.beginPath();
                    // Рисуем точку следа как овал
                    ctx.ellipse(trailPoint.x, trailPoint.y, drop.radius * 0.8, drop.radius * 1.2, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // === РИСУЕМ САМУ КАПЛЮ ===
            ctx.globalAlpha = drop.life; // прозрачность капли зависит от её "жизни"
            ctx.fillStyle = '#0000FF'; // цвет капли
            ctx.beginPath();
            // Рисуем овал, имитирующий каплю (ширина чуть больше высоты)
            ctx.ellipse(drop.x, drop.y, drop.radius, drop.radius * 1.5, 0, 0, Math.PI * 2);
            ctx.fill();
        });
        // Сбрасываем alpha
        ctx.globalAlpha = 1.0;
    }

    setInterval(update, 1000 / 60); // 60 FPS для отрисовки
}

// === Функция выбора предмета из инвентаря ===
function selectItem(element) {
    const itemId = element.dataset.itemId;
    selectedItem = itemId;

    if (itemId === 'item1') {
        console.log("Выбран предмет: item1 — режим выбора двух точек");
        tempSelectedPoints = [];
        // Убираем alert
        // alert("Кликните два раза на поле, чтобы провести линию.");
    } else {
        console.log("Выбран другой предмет:", itemId);
        selectedItem = null;
        tempSelectedPoints = [];
    }
}
