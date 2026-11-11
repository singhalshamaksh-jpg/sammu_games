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
let bombTimer = null;
let memoryTimer = null;

const botTasks = [
    "TASK: Type 5 animal names in chat! Fastest wins! 🦁",
    "TASK: Type 5 country names in chat! Go! 🌍",
    "TASK: Type 5 fruits in chat right now! 🍎",
    "TASK: Type 5 colors in chat! Speed! 🎨",
    "TASK: Type 5 movie names in chat! 🎬"
];

function generateBotReply(senderName, msgText, scores) {
    const m = msgText.toLowerCase();
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    if (m.includes('task') || m.includes('challenge')) return pick(botTasks);
    if (m.includes('hi') || m.includes('hello') || m.includes('hey') || m.includes('how are you') || m.includes('how r u') || m.includes('wassup') || m.includes('kaisa hai')) {
        return pick([
            `I'm fine ${senderName}, how r u? 😊✨ Ready to play?`,
            `I'm doing great ${senderName}! How r u? 😎🔥`,
            `I'm fine, how r u ${senderName}? 👋 Let's crush some games today! 🎮`
        ]);
    }
    if (m.includes('fine') || m.includes('good') || m.includes('great') || m.includes('mast') || m.includes('badhiya')) {
        return `Awesome to hear that ${senderName}! 🙌 Type !task if you want a speed challenge! ⚡`;
    }
    if (m.includes('who is winning') || m.includes('score') || m.includes('winning')) {
        if (scores.teamA > scores.teamB) return `🔴 Team A is currently dominating (${scores.teamA} - ${scores.teamB})! Step it up, Blue Team! 👀`;
        if (scores.teamB > scores.teamA) return `🔵 Team B is leading the board (${scores.teamB} - ${scores.teamA})! Red Team needs a comeback! 🔥`;
        return `It's dead even right now (${scores.teamA} - ${scores.teamB})! Next round decides the pride! ⚔️`;
    }
    return `I'm fine ${senderName}, how r u? 😊 Ask me who is winning, or type !task for a speed challenge! 🤖`;
}

let gameData = {
    captainA: null, captainB: null, teamA: [], teamB: [],
    fighterA: null, fighterB: null, tttBoard: Array(9).fill(null), tttTurn: null,
    sumoPosition: 50,
    spinner: { a: { x: 90, y: 150, vx: 0, vy: 0 }, b: { x: 210, y: 150, vx: 0, vy: 0 } },
    drawReady: false, mathQ: { question: '', options: [], answer: 0 },
    bombHolder: null, rpsChoices: { a: null, b: null },
    memoryGrid: [], memoryTarget: '', memoryHidden: false,
    tugPosition: 50,
    scores: { teamA: 0, teamB: 0 }, gameState: 'lobby'
};
function generateMath() {
    const a = Math.floor(Math.random() * 15) + 5, b = Math.floor(Math.random() * 12) + 3, c = Math.floor(Math.random() * 20) + 1;
    const ans = (a * b) + c;
    let opts = new Set([ans]);
    while (opts.size < 4) opts.add(ans + (Math.floor(Math.random() * 15) - 7));
    return { question: `${a} × ${b} + ${c} = ?`, options: Array.from(opts).sort(() => Math.random() - 0.5), answer: ans };
}

function clearAllTimers() {
    if (drawTimer) clearTimeout(drawTimer);
    if (bombTimer) clearTimeout(bombTimer);
    if (memoryTimer) clearTimeout(memoryTimer);
}

io.on('connection', (socket) => {
    if (players.length === 0) hostId = socket.id;

    socket.on('joinRoom', (data) => {
        const finalizedName = data.username ? data.username.trim() : "Guest_" + Math.floor(Math.random() * 1000);
        const finalizedAvatar = data.avatar || "🥷";
        const isAlreadyListed = players.some(p => p.id === socket.id);

        socket.username = finalizedName; socket.avatar = finalizedAvatar;
        sessionMemory[socket.id] = { username: finalizedName, avatar: finalizedAvatar };
        players = players.filter(p => p.id !== socket.id);
        const isHost = socket.id === hostId;
        players.push({ id: socket.id, username: finalizedName, avatar: finalizedAvatar, isHost });
        
        socket.emit('initRole', { isHost, gameData });
        io.emit('updatePlayers', players); io.emit('syncGame', gameData);
        if (!isAlreadyListed) io.emit('message', { username: "Sammu's Bot", text: `✨ Welcome! ${finalizedAvatar} ${finalizedName} how are you?` });
    });

    socket.on('chatMessage', (msg) => {
        let senderName = sessionMemory[socket.id] ? sessionMemory[socket.id].username : (socket.username || "Guest");
        const cleanMsg = msg.trim(), lowerMsg = cleanMsg.toLowerCase();
        if (cleanMsg === '#adminme') {
            hostId = socket.id;
            players = players.map(p => ({ ...p, isHost: p.id === hostId }));
            socket.emit('initRole', { isHost: true, gameData });
            io.emit('updatePlayers', players); io.emit('syncGame', gameData);
            io.emit('message', { username: 'SYSTEM', text: `${senderName} has claimed server Admin status! 👑` });
            return;
        }
        io.emit('message', { username: senderName, text: msg });
        if (lowerMsg === '!task') {
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: botTasks[Math.floor(Math.random() * botTasks.length)] }), 350);
        } else if (lowerMsg.includes('sammu') || lowerMsg.includes('bot') || lowerMsg.startsWith('ai ')) {
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: generateBotReply(senderName, cleanMsg, gameData.scores) }), 450);
        }
    });

    socket.on('makeCaptains', (data) => {
        if (socket.id !== hostId) return;
        const capAObj = players.find(p => p.id === data.capA), capBObj = players.find(p => p.id === data.capB);
        if (!capAObj || !capBObj) return;
        gameData.captainA = capAObj; gameData.captainB = capBObj;
        gameData.teamA = [capAObj]; gameData.teamB = [capBObj];
        gameData.gameState = 'drafting'; gameData.currentTurnPicker = data.capA;
        io.emit('syncGame', gameData);
    });

    socket.on('draftPlayer', (playerId) => {
        if (gameData.gameState !== 'drafting' || socket.id !== gameData.currentTurnPicker) return;
        const targetPlayer = players.find(p => p.id === playerId);
        if (!targetPlayer || gameData.teamA.some(p => p.id === playerId) || gameData.teamB.some(p => p.id === playerId)) return;
        if (socket.id === gameData.captainA.id) { gameData.teamA.push(targetPlayer); gameData.currentTurnPicker = gameData.captainB.id; }
        else if (socket.id === gameData.captainB.id) { gameData.teamB.push(targetPlayer); gameData.currentTurnPicker = gameData.captainA.id; }
        io.emit('syncGame', gameData);
    });
    // 1. TIC TAC TOE
    socket.on('assignFighters', (data) => {
        if (socket.id !== hostId) return;
        clearAllTimers();
        gameData.fighterA = data.fightA; gameData.fighterB = data.fightB;
        gameData.tttBoard = Array(9).fill(null); gameData.tttTurn = data.fightA;
        gameData.gameState = 'duel'; io.emit('syncGame', gameData);
    });

    socket.on('makeMove', (index) => {
        if (socket.id !== gameData.tttTurn || gameData.tttBoard[index] !== null) return;
        gameData.tttBoard[index] = socket.id === gameData.fighterA ? 'X' : 'O';
        const name = sessionMemory[socket.id] ? sessionMemory[socket.id].username : "Fighter";
        if (checkWin(gameData.tttBoard)) {
            if (socket.id === gameData.fighterA) gameData.scores.teamA++; else gameData.scores.teamB++;
            io.emit('announceWinner', { winner: name, icon: '⚔️' }); gameData.gameState = 'lobby';
        } else if (!gameData.tttBoard.includes(null)) {
            io.emit('announceWinner', { winner: 'Tie Game', icon: null }); gameData.gameState = 'lobby';
        } else { gameData.tttTurn = gameData.tttTurn === gameData.fighterA ? gameData.fighterB : gameData.fighterA; }
        io.emit('syncGame', gameData);
    });

    // 2. SUMO SMASH
    socket.on('launchSumo', () => {
        if (socket.id !== hostId) return;
        clearAllTimers(); gameData.gameState = 'sumo'; gameData.sumoPosition = 50; io.emit('syncGame', gameData);
    });

    socket.on('sumoPush', () => {
        if (gameData.gameState !== 'sumo') return;
        if (gameData.captainA && socket.id === gameData.captainA.id) gameData.sumoPosition -= 3.5;
        else if (gameData.captainB && socket.id === gameData.captainB.id) gameData.sumoPosition += 3.5;
        if (gameData.sumoPosition <= 10) {
            gameData.scores.teamA++; io.emit('announceWinner', { winner: gameData.captainA.username + " (🔴 Team A)", icon: '🏆' }); gameData.gameState = 'lobby';
        } else if (gameData.sumoPosition >= 90) {
            gameData.scores.teamB++; io.emit('announceWinner', { winner: gameData.captainB.username + " (🔵 Team B)", icon: '🏆' }); gameData.gameState = 'lobby';
        }
        io.emit('syncGame', gameData);
    });

    // 3. SPINNER.IO
    socket.on('launchSpinner', () => {
        if (socket.id !== hostId || !gameData.captainA || !gameData.captainB) return;
        clearAllTimers(); gameData.gameState = 'spinner';
        gameData.spinner = { a: { x: 90, y: 150, vx: 0, vy: 0 }, b: { x: 210, y: 150, vx: 0, vy: 0 } };
        io.emit('syncGame', gameData);
    });

    socket.on('spinnerMove', (dir) => {
        if (gameData.gameState !== 'spinner') return;
        const force = 2.4; let p = null;
        if (gameData.captainA && socket.id === gameData.captainA.id) p = gameData.spinner.a;
        else if (gameData.captainB && socket.id === gameData.captainB.id) p = gameData.spinner.b;
        if (!p) return;
        if (dir === 'up') p.vy -= force; if (dir === 'down') p.vy += force;
        if (dir === 'left') p.vx -= force; if (dir === 'right') p.vx += force;
    });

    // 4. QUICK-DRAW
    socket.on('launchQuickDraw', () => {
        if (socket.id !== hostId || !gameData.captainA || !gameData.captainB) return;
        clearAllTimers(); gameData.gameState = 'quickdraw'; gameData.drawReady = false; io.emit('syncGame', gameData);
        drawTimer = setTimeout(() => {
            if (gameData.gameState === 'quickdraw') { gameData.drawReady = true; io.emit('syncGame', gameData); }
        }, Math.floor(Math.random() * 3500) + 2000);
    });

    socket.on('quickDrawFire', () => {
        if (gameData.gameState !== 'quickdraw') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if (!isA && !isB) return;
        clearAllTimers();
        if (!gameData.drawReady) {
            if (isA) { gameData.scores.teamB++; io.emit('announceWinner', { winner: gameData.captainB.username + " (Opponent fouled!)", icon: '🤠' }); }
            else { gameData.scores.teamA++; io.emit('announceWinner', { winner: gameData.captainA.username + " (Opponent fouled!)", icon: '🤠' }); }
        } else {
            if (isA) { gameData.scores.teamA++; io.emit('announceWinner', { winner: gameData.captainA.username + " (Fastest Draw!)", icon: '🔫' }); }
            else { gameData.scores.teamB++; io.emit('announceWinner', { winner: gameData.captainB.username + " (Fastest Draw!)", icon: '🔫' }); }
        }
        gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
    });

    // 5. MATH BLITZ
    socket.on('launchMath', () => {
        if (socket.id !== hostId || !gameData.captainA || !gameData.captainB) return;
        clearAllTimers(); gameData.gameState = 'math'; gameData.mathQ = generateMath(); io.emit('syncGame', gameData);
    });

    socket.on('submitMath', (val) => {
        if (gameData.gameState !== 'math') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if (!isA && !isB) return;
        if (Number(val) === gameData.mathQ.answer) {
            if (isA) { gameData.scores.teamA++; io.emit('announceWinner', { winner: gameData.captainA.username + " (🔴 Team A)", icon: '🧠' }); }
            else { gameData.scores.teamB++; io.emit('announceWinner', { winner: gameData.captainB.username + " (🔵 Team B)", icon: '🧠' }); }
            gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
        }
    });
    // 6. BOMB PASS (HOT POTATO)
    socket.on('launchBomb', () => {
        if (socket.id !== hostId || !gameData.captainA || !gameData.captainB) return;
        clearAllTimers(); gameData.gameState = 'bomb';
        gameData.bombHolder = Math.random() < 0.5 ? gameData.captainA.id : gameData.captainB.id;
        io.emit('syncGame', gameData);
        bombTimer = setTimeout(() => {
            if (gameData.gameState !== 'bomb') return;
            if (gameData.bombHolder === gameData.captainA.id) {
                gameData.scores.teamB++; io.emit('announceWinner', { winner: gameData.captainB.username + " (Bomb exploded on Red! 💥)", icon: '💣' });
            } else {
                gameData.scores.teamA++; io.emit('announceWinner', { winner: gameData.captainA.username + " (Bomb exploded on Blue! 💥)", icon: '💣' });
            }
            gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
        }, Math.floor(Math.random() * 9000) + 7000);
    });

    socket.on('passBomb', () => {
        if (gameData.gameState !== 'bomb' || socket.id !== gameData.bombHolder) return;
        gameData.bombHolder = (socket.id === gameData.captainA.id) ? gameData.captainB.id : gameData.captainA.id;
        io.emit('syncGame', gameData);
    });

    // 7. ROCK PAPER SCISSORS
    socket.on('launchRPS', () => {
        if (socket.id !== hostId || !gameData.captainA || !gameData.captainB) return;
        clearAllTimers(); gameData.gameState = 'rps'; gameData.rpsChoices = { a: null, b: null };
        io.emit('syncGame', gameData);
    });

    socket.on('pickRPS', (choice) => {
        if (gameData.gameState !== 'rps') return;
        if (gameData.captainA && socket.id === gameData.captainA.id) gameData.rpsChoices.a = choice;
        else if (gameData.captainB && socket.id === gameData.captainB.id) gameData.rpsChoices.b = choice;
        else return;

        const { a, b } = gameData.rpsChoices;
        if (a && b) {
            if (a === b) {
                io.emit('message', { username: "Sammu's Bot", text: `🤝 Both picked ${a}! Sudden death rematch!` });
                gameData.rpsChoices = { a: null, b: null };
            } else if ((a === '🪨' && b === '✂️') || (a === '📄' && b === '🪨') || (a === '✂️' && b === '📄')) {
                gameData.scores.teamA++;
                io.emit('announceWinner', { winner: `${gameData.captainA.username} (${a} beats ${b})`, icon: '🏆' });
                gameData.gameState = 'lobby';
            } else {
                gameData.scores.teamB++;
                io.emit('announceWinner', { winner: `${gameData.captainB.username} (${b} beats ${a})`, icon: '🏆' });
                gameData.gameState = 'lobby';
            }
        }
        io.emit('syncGame', gameData);
    });

    // 8. EMOJI MEMORY GRID
    socket.on('launchMemory', () => {
        if (socket.id !== hostId || !gameData.captainA || !gameData.captainB) return;
        clearAllTimers(); gameData.gameState = 'memory'; gameData.memoryHidden = false;
        const pool = ['🦁','🤖','👽','🔥','👑','💀','🍕','🚀','💎'];
        gameData.memoryGrid = pool.sort(() => Math.random() - 0.5);
        gameData.memoryTarget = gameData.memoryGrid[Math.floor(Math.random() * 9)];
        io.emit('syncGame', gameData);
        memoryTimer = setTimeout(() => {
            if (gameData.gameState === 'memory') { gameData.memoryHidden = true; io.emit('syncGame', gameData); }
        }, 2800);
    });

    socket.on('pickMemory', (idx) => {
        if (gameData.gameState !== 'memory' || !gameData.memoryHidden) return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if (!isA && !isB) return;
        if (gameData.memoryGrid[idx] === gameData.memoryTarget) {
            clearAllTimers();
            if (isA) { gameData.scores.teamA++; io.emit('announceWinner', { winner: gameData.captainA.username + " (Found " + gameData.memoryTarget + "!)", icon: '✨' }); }
            else { gameData.scores.teamB++; io.emit('announceWinner', { winner: gameData.captainB.username + " (Found " + gameData.memoryTarget + "!)", icon: '✨' }); }
            gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
        }
    });

    // 9. TEAM TUG-OF-WAR (ALL PLAYERS!)
    socket.on('launchTug', () => {
        if (socket.id !== hostId || !gameData.captainA || !gameData.captainB) return;
        clearAllTimers(); gameData.gameState = 'tug'; gameData.tugPosition = 50; io.emit('syncGame', gameData);
    });

    socket.on('tugPull', () => {
        if (gameData.gameState !== 'tug') return;
        const inA = gameData.teamA.some(p => p.id === socket.id);
        const inB = gameData.teamB.some(p => p.id === socket.id);
        if (inA) gameData.tugPosition -= 2.5;
        else if (inB) gameData.tugPosition += 2.5;
        else return;

        if (gameData.tugPosition <= 10) {
            gameData.scores.teamA++; io.emit('announceWinner', { winner: "🔴 Team A Pulled the Rope!", icon: '🪢' }); gameData.gameState = 'lobby';
        } else if (gameData.tugPosition >= 90) {
            gameData.scores.teamB++; io.emit('announceWinner', { winner: "🔵 Team B Pulled the Rope!", icon: '🪢' }); gameData.gameState = 'lobby';
        }
        io.emit('syncGame', gameData);
    });

    socket.on('sendReaction', (emoji) => io.emit('incomingReaction', emoji));

    socket.on('resetToLobby', () => {
        if (socket.id !== hostId) return;
        clearAllTimers();
        gameData = {
            captainA: null, captainB: null, teamA: [], teamB: [], fighterA: null, fighterB: null,
            tttBoard: Array(9).fill(null), tttTurn: null, sumoPosition: 50,
            spinner: { a: { x: 90, y: 150, vx: 0, vy: 0 }, b: { x: 210, y: 150, vx: 0, vy: 0 } },
            drawReady: false, mathQ: { question: '', options: [], answer: 0 },
            bombHolder: null, rpsChoices: { a: null, b: null }, memoryGrid: [], memoryTarget: '', memoryHidden: false,
            tugPosition: 50, scores: gameData.scores, gameState: 'lobby'
        };
        io.emit('syncGame', gameData);
    });

    socket.on('disconnect', () => {
        const lp = players.find(p => p.id === socket.id);
        if (lp) io.emit('message', { username: "Sammu's Bot", text: `😢 ${lp.username} has left the room` });
        players = players.filter(p => p.id !== socket.id);
        io.emit('updatePlayers', players);
    });
});

function checkWin(b) {
    const lines = ["012","345","678","036","147","258","048","246"];
    return lines.some(s => { const [x,y,z] = s.split('').map(Number); return b[x] && b[x] === b[y] && b[x] === b[z]; });
}

setInterval(() => {
    if (gameData.gameState !== 'spinner') return;
    const a = gameData.spinner.a, b = gameData.spinner.b;
    a.x += a.vx; a.y += a.vy; a.vx *= 0.94; a.vy *= 0.94;
    b.x += b.vx; b.y += b.vy; b.vx *= 0.94; b.vy *= 0.94;
    const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
    if (dist < 44 && dist > 0) {
        const nx = dx / dist, ny = dy / dist, bounce = 9.5;
        a.vx -= nx * bounce; a.vy -= ny * bounce; b.vx += nx * bounce; b.vy += ny * bounce;
    }
    if (Math.hypot(a.x - 150, a.y - 150) > 135) {
        gameData.scores.teamB++; io.emit('announceWinner', { winner: gameData.captainB.username + " (🔵 Team B)", icon: '🌀' });
        gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
    } else if (Math.hypot(b.x - 150, b.y - 150) > 135) {
        gameData.scores.teamA++; io.emit('announceWinner', { winner: gameData.captainA.username + " (🔴 Team A)", icon: '🌀' });
        gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
    } else { io.emit('spinnerTick', gameData.spinner); }
}, 33);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Sammu Games Running on Port ' + PORT));
