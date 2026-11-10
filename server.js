const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

let players = [];
let hostId = null;
let gameData = {
    captainA: null,
    captainB: null,
    fighterA: null,
    fighterB: null,
    tttBoard: Array(9).fill(null),
    tttTurn: null,
    scores: { teamA: 0, teamB: 0 },
    gameState: 'lobby'
};

io.on('connection', (socket) => {
    if (players.length === 0) hostId = socket.id;

    socket.on('joinRoom', (data) => {
        // Fix: Force fallback to avoid 'undefined' string values during reconnections
        socket.username = data.username || "Guest_" + Math.floor(Math.random() * 1000);
        socket.avatar = data.avatar || "🥷";
        
        // Clear any old disconnected entry with the same socket ID
        players = players.filter(p => p.id !== socket.id);
        
        const isHost = socket.id === hostId;
        players.push({ id: socket.id, username: socket.username, avatar: socket.avatar, isHost });
        
        socket.emit('initRole', { isHost, gameData });
        io.emit('updatePlayers', players);
        io.emit('syncGame', gameData);
    });

    socket.on('chatMessage', (msg) => {
        // Fallback guard to check if socket properties dropped
        const senderName = socket.username || "Anonymous";
        
        if (msg.trim() === '#adminme') {
            hostId = socket.id;
            players = players.map(p => ({ ...p, isHost: p.id === hostId }));
            socket.emit('initRole', { isHost: true, gameData });
            io.emit('updatePlayers', players);
            io.emit('syncGame', gameData);
            io.emit('message', { username: 'SYSTEM', text: `${senderName} has claimed server Admin status! 👑` });
            return;
        }
        io.emit('message', { username: senderName, text: msg });
    });

    // --- MANUAL CAPTAIN ASSIGNMENTS ---
    socket.on('makeCaptains', (data) => {
        if (socket.id !== hostId) return;
        gameData.captainA = data.capA; // Stores ID
        gameData.captainB = data.capB; // Stores ID
        gameData.gameState = 'drafting';
        io.emit('syncGame', gameData);
    });

    socket.on('assignFighters', (data) => {
        if (socket.id !== hostId) return;
        gameData.fighterA = data.fightA;
        gameData.fighterB = data.fightB;
        gameData.tttBoard = Array(9).fill(null);
        gameData.tttTurn = data.fightA;
        gameData.gameState = 'duel';
        io.emit('syncGame', gameData);
    });

    socket.on('resetToLobby', () => {
        if (socket.id !== hostId) return;
        gameData = {
            captainA: null, captainB: null,
            fighterA: null, fighterB: null, tttBoard: Array(9).fill(null), tttTurn: null,
            scores: { teamA: 0, teamB: 0 }, gameState: 'lobby'
        };
        io.emit('syncGame', gameData);
    });

    socket.on('makeMove', (index) => {
        if (socket.id !== gameData.tttTurn || gameData.tttBoard[index] !== null) return;
        const icon = socket.id === gameData.fighterA ? 'X' : 'O';
        gameData.tttBoard[index] = icon;

        if (checkWin(gameData.tttBoard)) {
            if (socket.id === gameData.fighterA) gameData.scores.teamA++;
            else gameData.scores.teamB++;
            io.emit('announceWinner', { winner: socket.username || "Champion", icon });
            gameData.gameState = 'lobby'; 
        } else if (!gameData.tttBoard.includes(null)) {
            io.emit('announceWinner', { winner: 'Tie Game', icon: null });
            gameData.gameState = 'lobby';
        } else {
            gameData.tttTurn = gameData.tttTurn === gameData.fighterA ? gameData.fighterB : gameData.fighterA;
        }
        io.emit('syncGame', gameData);
    });

    socket.on('sendReaction', (emoji) => { io.emit('incomingReaction', emoji); });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        if (socket.id === hostId && players.length > 0) {
            hostId = players[0].id;
            players[0].isHost = true;
        }
        io.emit('updatePlayers', players);
    });
});

function checkWin(board) {
    const wins = [, [3, 4, 5], [6, 7, 8], // Rows, [1, 4, 7], [2, 5, 8], // Columns, [2, 4, 6]             // Diagonals
    ];
    return wins.some(pattern => {
        const [a, b, c] = pattern;
        return board[a] && board[a] === board[b] && board[a] === board[c];
    });
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => { console.log('Sammu Games Running on Port ' + PORT); });
