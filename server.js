const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Очередь ожидания
let waitingPlayers = [];

io.on('connection', (socket) => {
    console.log('Игрок подключился:', socket.id);

    socket.on('requestToPlay', () => {
        waitingPlayers.push(socket.id);
        console.log('Игрок добавлен в очередь. Текущее количество:', waitingPlayers.length);

        if (waitingPlayers.length === 2) {
            const player1Id = waitingPlayers.pop();
            const player2Id = waitingPlayers.pop();

            const player1Socket = io.sockets.sockets.get(player1Id);
            const player2Socket = io.sockets.sockets.get(player2Id);

            // Создаём комнату
            const roomId = `room-${Date.now()}`;

            player1Socket.join(roomId);
            player2Socket.join(roomId);

            // Уведомляем игроков о роли
            player1Socket.emit('gameStart', { role: 'player1', roomId });
            player2Socket.emit('gameStart', { role: 'player2', roomId });

            setupGame(io, player1Socket, player2Socket, roomId);
        }
    });

    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
        const index = waitingPlayers.indexOf(socket.id);
        if (index !== -1) {
            waitingPlayers.splice(index, 1);
        }
    });
});

function setupGame(io, player1Socket, player2Socket, roomId) {
    const players = {
        [player1Socket.id]: { x: 100, y: 200, color: '#FF5722' },
        [player2Socket.id]: { x: 500, y: 200, color: '#2196F3' },
    };

    // Отправляем начальное состояние
    player1Socket.emit('currentPlayers', players);
    player2Socket.emit('currentPlayers', players);

    // Прослушиваем движения игроков
    player1Socket.on('playerMove', (data) => {
        if (players[data.id]) {
            players[data.id].x = data.x;
            players[data.id].y = data.y;
            io.to(roomId).emit('playerMoved', { id: data.id, ...data });
        }
    });

    player2Socket.on('playerMove', (data) => {
        if (players[data.id]) {
            players[data.id].x = data.x;
            players[data.id].y = data.y;
            io.to(roomId).emit('playerMoved', { id: data.id, ...data });
        }
    });

    // === НОВОЕ: обработка события рисования линии ===
    player1Socket.on('drawLine', (lineData) => {
        io.to(roomId).emit('newLine', lineData);
    });

    player2Socket.on('drawLine', (lineData) => {
        io.to(roomId).emit('newLine', lineData);
    });

    player1Socket.once('disconnect', () => {
        io.to(roomId).emit('opponentDisconnected');
    });

    player2Socket.once('disconnect', () => {
        io.to(roomId).emit('opponentDisconnected');
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
});
