const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Очередь ожидания
let waitingPlayers = [];
let itemPosition = { x: 300, y: 200, angle: 0 }; // Позиция предмета

io.on('connection', (socket) => {
  console.log('Игрок подключился:', socket.id);

  // Отправляем начальное состояние предмета новому игроку
  socket.emit('itemPosition', itemPosition);

  socket.on('requestToPlay', () => {
    // Добавляем игрока в очередь
    waitingPlayers.push(socket.id);
    console.log('Игрок добавлен в очередь. Текущее количество:', waitingPlayers.length);

    // Если игроков двое — начинаем игру
    if (waitingPlayers.length === 2) {
      const player1Id = waitingPlayers.pop();
      const player2Id = waitingPlayers.pop();

      // Получаем объекты сокетов для каждого игрока
      const player1Socket = io.sockets.sockets.get(player1Id);
      const player2Socket = io.sockets.sockets.get(player2Id);

      // Создаём комнату для игры
      const roomId = `room-${Date.now()}`;

      // Игроки присоединяются к комнате
      player1Socket.join(roomId);
      player2Socket.join(roomId);

      // Уведомляем игроков о начале игры
      player1Socket.emit('startGame');
      player2Socket.emit('startGame');

      // Отправляем каждому его роль
      player1Socket.emit('setPlayerData', { id: player1Id, role: 'player1' });
      player2Socket.emit('setPlayerData', { id: player2Id, role: 'player2' });

      // Начинаем отслеживание игры
      setupGame(io, player1Socket, player2Socket, roomId);
    }
  });

  // Слушаем изменения позиции предмета
  socket.on('itemMoved', (data) => {
    itemPosition = { x: data.x, y: data.y, angle: data.angle };
    socket.to(data.roomId).emit('itemPosition', itemPosition);
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

  // Отправляем начальное состояние обоим игрокам
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

  // Обработка отключения одного из игроков
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
