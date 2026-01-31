const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Очередь ожидания
const waitingPlayers = [];

io.on('connection', (socket) => {
  console.log('Игрок подключился:', socket.id);

  // Игрок нажал Play
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
      setupGame(io, roomId, player1Id, player2Id);
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

function setupGame(io, roomId, player1Id, player2Id) {
  const players = {
    [player1Id]: { x: 100, y: 200, color: '#FF5722' },
    [player2Id]: { x: 500, y: 200, color: '#2196F3' },
  };

  // Отправляем начальное состояние обоим игрокам
  io.to(roomId).emit('currentPlayers', players);

  // Слушаем движения игроков
  io.to(roomId).on('playerMove', (data) => {
    if (players[data.id]) {
      players[data.id].x = data.x;
      players[data.id].y = data.y;
      io.to(roomId).emit('playerMoved', { id: data.id, ...data });
    }
  });

  // Обработка отключения одного из игроков
  io.sockets.sockets.get(player1Id)?.once('disconnect', () => {
    io.to(roomId).emit('opponentDisconnected');
  });
  io.sockets.sockets.get(player2Id)?.once('disconnect', () => {
    io.to(roomId).emit('opponentDisconnected');
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
});
