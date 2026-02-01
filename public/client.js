const startScreen = document.getElementById('start-screen');
const loadingScreen = document.getElementById('loading-screen');
const gameArea = document.getElementById('game-area');
const statusText = document.getElementById('status');
const myCountEl = document.getElementById('my-count');
const otherCountEl = document.getElementById('other-count');
const cutSelfBtn = document.getElementById('cut-self');
const cutOtherBtn = document.getElementById('cut-other');

const playBtn = document.getElementById('play-btn');
let socket;
let role = null;
let gameState = {};

playBtn.addEventListener('click', () => {
    startScreen.classList.remove('active');
    loadingScreen.classList.add('active');

    socket = io();
    socket.emit('requestToPlay');

    socket.on('gameStart', (data) => {
        role = data.role;
        gameState = data.state;
        loadingScreen.classList.remove('active');
        gameArea.style.display = 'flex';

        updateUI();
    });

    socket.on('updateState', (state) => {
        gameState = state;
        updateUI();
    });

    socket.on('opponentDisconnected', () => {
        alert('Противник покинул игру!');
        window.location.reload();
    });
});

function updateUI() {
    if (role === 'player1') {
        myCountEl.textContent = gameState.player1.cuts;
        otherCountEl.textContent = gameState.player2.cuts;
    } else if (role === 'player2') {
        myCountEl.textContent = gameState.player2.cuts;
        otherCountEl.textContent = gameState.player1.cuts;
    }
}

cutSelfBtn.addEventListener('click', () => {
    socket.emit('cutDecision', { choice: 'self', roomId: gameState.roomId });
    statusText.textContent = 'Вы выбрали самопожертвование.';
});

cutOtherBtn.addEventListener('click', () => {
    socket.emit('cutDecision', { choice: 'other', roomId: gameState.roomId });
    statusText.textContent = 'Вы выбрали причинить боль другому.';
});
