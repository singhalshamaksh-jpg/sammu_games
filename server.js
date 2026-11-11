const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

let players = [];
let hostId = null;
let sessionMemory = {};
let drawTimer = null;

let gameData = {
    captainA: null, captainB: null,
    teamA: [], teamB: [],
    fighterA: null, fighterB: null,
    tttBoard: Array(9).fill(null), tttTurn: null,
    sumoPosition: 50,
    spinner: {
        a: { x: 90, y: 150, vx: 0, vy: 0 },
        b: { x: 210, y: 150, vx: 0, vy: 0 }
    },
    drawReady: false,
    mathQ: { question: '', options: [], answer: 0 },
    scores: { teamA: 0, teamB: 0 },
    gameState: 'lobby'
};

function generateMath() {
    const a = Math.floor(Math.random() * 15) + 5;
    const b = Math.floor(Math.random() * 12) + 3;
    const c = Math.floor(Math.random() * 20) + 1;
    const ans = (a * b) + c;
    let opts = new Set([ans]);
    while (opts.size < 4) {
        opts.add(ans + (Math.floor(Math.random() * 15) - 7));
    }
    return {
        question: `${a} × ${b} + ${c} = ?`,
        options: Array.from(opts).sort(() => Math.random() - 0.5),
        answer: ans
    };
}

io.on('connection', (socket) => {
    if (players.length === 0) hostId = socket.id;

    socket.on('joinRoom', (data) => {
        const finalizedName = data.username ? data.username.trim() : "Guest_" + Math.floor(Math.random() * 1000);
        const finalizedAvatar = data.avatar || "🥷";

        socket.username = finalizedName;
        socket.avatar = finalizedAvatar;
        sessionMemory[socket.id] = { username: finalizedName, avatar: finalizedAvatar };

        players = players.filter(p => p.id !== socket.id);
        const isHost = socket.id === hostId;
        players.push({ id: socket.id, username: finalizedName, avatar: finalizedAvatar, isHost });
        
        socket.emit('initRole', { isHost, gameData });
        io.emit('updatePlayers', players);
        io.emit('syncGame', gameData);
    });

    socket.on('chatMessage', (msg) => {
        let senderName = sessionMemory[socket.id] ? sessionMemory[socket.id].username : (socket.username || "Guest");
        
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

    // ARENA 1: TIC TAC TOE
    socket.on('assignFighters', (data) => {
        if (socket.id !== hostId) return;
        gameData.fighterA = data.fightA;
        gameData.fighterB = data.fightB;
        gameData.tttBoard = Array(9).fill(null);
        gameData.tttTurn = data.fightA;
        gameData.gameState = 'duel';
        io.emit('syncGame', gameData);
    });

    socket.on('makeMove', (index) => {
        if (socket.id !== gameData.tttTurn || gameData.tttBoard[index] !== null) return;
        const icon = socket.id === gameData.fighterA ? 'X' : 'O';
        gameData.tttBoard[index] = icon;
        const currentFighterName = sessionMemory[socket.id] ? sessionMemory[socket.id].username : "Fighter";

        if (checkWin(gameData.tttBoard)) {
            if (socket.id === gameData.fighterA) gameData.scores.teamA++;
            else gameData.scores.teamB++;
            io.emit('announceWinner', { winner: currentFighterName, icon });
            gameData.gameState = 'lobby'; 
        } else if (!gameData.tttBoard.includes(null)) {
            io.emit('announceWinner', { winner: 'Tie Game', icon: null });
            gameData.gameState = 'lobby';
        } else {
            gameData.tttTurn = gameData.tttTurn === gameData.fighterA ? gameData.fighterB : gameData.fighterA;
        }
        io.emit('syncGame', gameData);
    });    // ARENA 2: SUMO SMASH
    socket.on('launchSumo', () => {
        if (socket.id !== hostId) return;
        gameData.gameState = 'sumo';
        gameData.sumoPosition = 50; 
        io.emit('syncGame', gameData);
    });

    socket.on('sumoPush', () => {
        if (gameData.gameState !== 'sumo') return;
        if (gameData.captainA && socket.id === gameData.captainA.id) gameData.sumoPosition -= 3.5;
        else if (gameData.captainB && socket.id === gameData.captainB.id) gameData.sumoPosition += 3.5;

        if (gameData.sumoPosition <= 10) {
            gameData.scores.teamA++;
            io.emit('announceWinner', { winner: gameData.captainA.username + " (🔴 Team A)", icon: '🏆' });
            gameData.gameState = 'lobby';
        } else if (gameData.sumoPosition >= 90) {
            gameData.scores.teamB++;
            io.emit('announceWinner', { winner: gameData.captainB.username + " (🔵 Team B)", icon: '🏆' });
            gameData.gameState = 'lobby';
        }
        io.emit('syncGame', gameData);
    });

    // ARENA 3: SPINNER.IO
    socket.on('launchSpinner', () => {
        if (socket.id !== hostId || !gameData.captainA || !gameData.captainB) return;
        gameData.gameState = 'spinner';
        gameData.spinner = {
            a: { x: 90, y: 150, vx: 0, vy: 0 },
            b: { x: 210, y: 150, vx: 0, vy: 0 }
        };
        io.emit('syncGame', gameData);
    });

    socket.on('spinnerMove', (dir) => {
        if (gameData.gameState !== 'spinner') return;
        const force = 2.4;
        let p = null;
        if (gameData.captainA && socket.id === gameData.captainA.id) p = gameData.spinner.a;
        else if (gameData.captainB && socket.id === gameData.captainB.id) p = gameData.spinner.b;
        if (!p) return;

        if (dir === 'up') p.vy -= force;
        if (dir === 'down') p.vy += force;
        if (dir === 'left') p.vx -= force;
        if (dir === 'right') p.vx += force;
    });

    // ARENA 4: QUICK-DRAW REFLEX DUEL
    socket.on('launchQuickDraw', () => {
        if (socket.id !== hostId || !gameData.captainA || !gameData.captainB) return;
        if (drawTimer) clearTimeout(drawTimer);
        gameData.gameState = 'quickdraw';
        gameData.drawReady = false;
        io.emit('syncGame', gameData);

        const randomDelay = Math.floor(Math.random() * 3500) + 2000;
        drawTimer = setTimeout(() => {
            if (gameData.gameState === 'quickdraw') {
                gameData.drawReady = true;
                io.emit('syncGame', gameData);
            }
        }, randomDelay);
    });

    socket.on('quickDrawFire', () => {
        if (gameData.gameState !== 'quickdraw') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id;
        const isB = gameData.captainB && socket.id === gameData.captainB.id;
        if (!isA && !isB) return;

        if (drawTimer) clearTimeout(drawTimer);
        if (!gameData.drawReady) {
            if (isA) {
                gameData.scores.teamB++;
                io.emit('announceWinner', { winner: gameData.captainB.username + " (Opponent fouled!)", icon: '🤠' });
            } else {
                gameData.scores.teamA++;
                io.emit('announceWinner', { winner: gameData.captainA.username + " (Opponent fouled!)", icon: '🤠' });
            }
        } else {
            if (isA) {
                gameData.scores.teamA++;
                io.emit('announceWinner', { winner: gameData.captainA.username + " (Fastest Draw!)", icon: '🔫' });
            } else {
                gameData.scores.teamB++;
                io.emit('announceWinner', { winner: gameData.captainB.username + " (Fastest Draw!)", icon: '🔫' });
            }
        }
        gameData.gameState = 'lobby';
        io.emit('syncGame', gameData);
    });

    // ARENA 5: MATH BLITZ SHOWDOWN
    socket.on('launchMath', () => {
        if (socket.id !== hostId || !gameData.captainA || !gameData.captainB) return;
        gameData.gameState = 'math';
        gameData.mathQ = generateMath();
        io.emit('syncGame', gameData);
    });

    socket.on('submitMath', (val) => {
        if (gameData.gameState !== 'math') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id;
        const isB = gameData.captainB && socket.id === gameData.captainB.id;
        if (!isA && !isB) return;

        if (Number(val) === gameData.mathQ.answer) {
            if (isA) {
                gameData.scores.teamA++;
                io.emit('announceWinner', { winner: gameData.captainA.username + " (🔴 Team A)", icon: '🧠' });
            } else {
                gameData.scores.teamB++;
                io.emit('announceWinner', { winner: gameData.captainB.username + " (🔵 Team B)", icon: '🧠' });
            }
            gameData.gameState = 'lobby';
            io.emit('syncGame', gameData);
        }
    });

    socket.on('sendReaction', (emoji) => { io.emit('incomingReaction', emoji); });

    socket.on('resetToLobby', () => {
        if (socket.id !== hostId) return;
        if (drawTimer) clearTimeout(drawTimer);
        gameData = {
            captainA: null, captainB: null, teamA: [], teamB: [],
            fighterA: null, fighterB: null, tttBoard: Array(9).fill(null), tttTurn: null,
            sumoPosition: 50,
            spinner: { a: { x: 90, y: 150, vx: 0, vy: 0 }, b: { x: 210, y: 150, vx: 0, vy: 0 } },
            drawReady: false, mathQ: { question: '', options: [], answer: 0 },
            scores: gameData.scores, gameState: 'lobby'
        };
        io.emit('syncGame', gameData);
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('updatePlayers', players);
    });
});

function checkWin(b) {
    const w = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    return w.some(p => b[p[0]] && b[p[0]] === b[p[1]] && b[p[0]] === b[p[2]]);
}

setInterval(() => {
    if (gameData.gameState !== 'spinner') return;
    const a = gameData.spinner.a;
    const b = gameData.spinner.b;

    a.x += a.vx; a.y += a.vy; a.vx *= 0.94; a.vy *= 0.94;
    b.x += b.vx; b.y += b.vy; b.vx *= 0.94; b.vy *= 0.94;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 44 && dist > 0) {
        const nx = dx / dist;
        const ny = dy / dist;
        const bounce = 9.5;
        a.vx -= nx * bounce; a.vy -= ny * bounce;
        b.vx += nx * bounce; b.vy += ny * bounce;
    }

    const distA = Math.hypot(a.x - 150, a.y - 150);
    const distB = Math.hypot(b.x - 150, b.y - 150);

    if (distA > 135) {
        gameData.scores.teamB++;
        io.emit('announceWinner', { winner: gameData.captainB.username + " (🔵 Team B)", icon: '🌀' });
        gameData.gameState = 'lobby';
        io.emit('syncGame', gameData);
    } else if (distB > 135) {
        gameData.scores.teamA++;
        io.emit('announceWinner', { winner: gameData.captainA.username + " (🔴 Team A)", icon: '🌀' });
        gameData.gameState = 'lobby';
        io.emit('syncGame', gameData);
    } else {
        io.emit('spinnerTick', gameData.spinner);
    }
}, 33);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => { console.log('Sammu Games Running on Port ' + PORT); });
                
