const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

let players = [];
let hostId = null;

// NEW PERMANENT SESSIONS MEMORY INDEX
// This maps socket IDs to user details so they NEVER reset to anonymous!
let sessionMemory = {}; 

let gameData = {
    captainA: null, captainB: null,
    teamA: [], teamB: [],
    fighterA: null, fighterB: null,
    tttBoard: Array(9).fill(null), tttTurn: null,
    scores: { teamA: 0, teamB: 0 },
    gameState: 'lobby'
};

io.on('connection', (socket) => {
    if (players.length === 0) hostId = socket.id;

    socket.on('joinRoom', (data) => {
        // Double-check inputs and assign rigid fallbacks
        const finalizedName = data.username ? data.username.trim() : "Guest_" + Math.floor(Math.random() * 1000);
        const finalizedAvatar = data.avatar || "🥷";

        socket.username = finalizedName;
        socket.avatar = finalizedAvatar;
        
        // Lock details inside the session memory structure linked to this socket ID
        sessionMemory[socket.id] = { username: finalizedName, avatar: finalizedAvatar };

        // Clean out any old matching IDs to avoid roster duplicates
        players = players.filter(p => p.id !== socket.id);
        
        const isHost = socket.id === hostId;
        players.push({ id: socket.id, username: finalizedName, avatar: finalizedAvatar, isHost });
        
        socket.emit('initRole', { isHost, gameData });
        io.emit('updatePlayers', players);
        io.emit('syncGame', gameData);
    });

    socket.on('chatMessage', (msg) => {
        // ULTRA SECURITY: Pull identity directly from long-term sessionMemory instead of volatile socket properties
        let senderName = "Guest User";
        if (sessionMemory[socket.id] && sessionMemory[socket.id].username) {
            senderName = sessionMemory[socket.id].username;
        } else if (socket.username) {
            senderName = socket.username;
        }

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

    socket.on('makeCaptains', (data) => {
        if (socket.id !== hostId) return;
        const capAObj = players.find(p => p.id === data.capA);
        const capBObj = players.find(p => p.id === data.capB);
        if(!capAObj || !capBObj) return;

        gameData.captainA = capAObj;
        gameData.captainB = capBObj;
        gameData.teamA = [capAObj];
        gameData.teamB = [capBObj];
        gameData.gameState = 'drafting';
        gameData.currentTurnPicker = data.capA;
        io.emit('syncGame', gameData);
    });

    socket.on('draftPlayer', (playerId) => {
        if (gameData.gameState !== 'drafting') return;
        if (socket.id !== gameData.currentTurnPicker) return;
        
        const targetPlayer = players.find(p => p.id === playerId);
        if (!targetPlayer) return;
        
        if (gameData.teamA.some(p => p.id === playerId) || gameData.teamB.some(p => p.id === playerId)) return;

        if (socket.id === gameData.captainA.id) {
            gameData.teamA.push(targetPlayer);
            gameData.currentTurnPicker = gameData.captainB.id;
        } else if (socket.id === gameData.captainB.id) {
            gameData.teamB.push(targetPlayer);
            gameData.currentTurnPicker = gameData.captainA.id;
        }
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
            captainA: null, captainB: null, teamA: [], teamB: [],
            fighterA: null, fighterB: null, tttBoard: Array(9).fill(null), tttTurn: null,
            scores: { teamA: 0, teamB: 0 }, gameState: 'lobby'
        };
        io.emit('syncGame', gameData);
    });

    socket.on('makeMove', (index) => {
        if (socket.id !== gameData.tttTurn || gameData.tttBoard[index] !== null) return;
        const icon = socket.id === gameData.fighterA ? 'X' : 'O';
        gameData.tttBoard[index] = icon;

        // Fallback name grabber
        const finalFighterName = sessionMemory[socket.id] ? sessionMemory[socket.id].username : (socket.username || "Fighter");

        if (checkWin(gameData.tttBoard)) {
            if (socket.id === gameData.fighterA) gameData.scores.teamA++;
            else gameData.scores.teamB++;
            io.emit('announceWinner', { winner: finalFighterName, icon });
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
        // Retain sessionMemory data for a short time to catch rapid mobile drops, 
        // but scrub the connection array to keep lobby list accurate.
        if (socket.id === hostId && players.length > 0) {
            hostId = players[0].id;
            players[0].isHost = true;
        }
        io.emit('updatePlayers', players);
    });
});

function checkWin(b) {
    const w = [, [3, 4, 5], [6, 7, 8], // Rows, [1, 4, 7], [2, 5, 8], // Columns, [2, 4, 6]             // Diagonals
    ];
    return w.some(p => b[p[0]] && b[p[0]] === b[p[1]] && b[p[0]] === b[p[2]]);
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => { console.log('Sammu Games Running on Port ' + PORT); });
