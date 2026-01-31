const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Хранилище состояний игроков
const players = {};

// Отправка статических файлов
app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Игрок подключился:', socket.id);

    // Добавление нового игрока
    players[socket.id] = {
        x: Math.floor(Math.random() * 400), // Случайные начальные координаты
        y: Math.floor(Math.random() * 400),
        color: `hsl(${Math.random() * 360}, 100%, 50%)` // Случайный цвет
    };

    // Отправка текущего состояния всех игроков новому игроку
    socket.emit('currentPlayers', players);

    // Уведомление других игроков о новом игроке
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // Обработка движения игрока
    socket.on('playerMove', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            socket.broadcast.emit('playerMoved', { id: socket.id, ...data });
        }
    });

    // Обработка отключения игрока
    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
        delete players[socket.id];
        socket.broadcast.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
