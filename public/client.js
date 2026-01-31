const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const socket = io();

let playerId;
let players = {};

// Отслеживание клавиш
const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
});
document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Обработка входящих данных
socket.on('currentPlayers', (currentPlayers) => {
    players = currentPlayers;
});

socket.on('newPlayer', (newPlayer) => {
    players[newPlayer.id] = newPlayer;
});

socket.on('playerMoved', (movedPlayer) => {
    players[movedPlayer.id] = movedPlayer;
});

socket.on('playerDisconnected', (disconnectedPlayerId) => {
    delete players[disconnectedPlayerId];
});

// Отрисовка игры
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const id in players) {
        const player = players[id];
        ctx.fillStyle = player.color;
        ctx.fillRect(player.x, player.y, 20, 20); // Игроки рисуются квадратами
    }
}

// Обновление игрового состояния
function update() {
    if (players[playerId]) {
        const speed = 5;

        if (keys['ArrowUp']) players[playerId].y -= speed;
        if (keys['ArrowDown']) players[playerId].y += speed;
        if (keys['ArrowLeft']) players[playerId].x -= speed;
        if (keys['ArrowRight']) players[playerId].x += speed;

        // Отправка новых координат на сервер
        socket.emit('playerMove', { x: players[playerId].x, y: players[playerId].y });
    }
}

// Инициализация после получения ID игрока
socket.on('connect', () => {
    playerId = socket.id;
});

// Основной игровой цикл
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();
