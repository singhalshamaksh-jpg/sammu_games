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
let drawTimer = null, bombTimer = null, memoryTimer = null;

let botMemory = {
    lastWinner: null,
    playerPoints: {},
    activeQuiz: null,
    chatCount: 0
};

const quizBank = [
    { q: "🧠 RIDDLE: What has keys but can't open locks?", a: "piano" },
    { q: "🌍 GEOGRAPHY: Which country has the largest population in the world?", a: "india" },
    { q: "⚡ SCIENCE: What is the chemical symbol for Gold?", a: "au" },
    { q: "🎮 GAMING: Which block-building game features Creepers and Ender Dragons?", a: "minecraft" },
    { q: "🧠 RIDDLE: The more of me you take, the more you leave behind. What am I?", a: "footsteps" },
    { q: "🏏 CRICKET: Who is known as the 'God of Cricket'?", a: "sachin" },
    { q: "🚀 SPACE: Which planet is known as the Red Planet?", a: "mars" },
    { q: "🧠 RIDDLE: What gets wetter the more it dries?", a: "towel" }
];

const botTasks = [
    "TASK: Type 5 animal names in chat! Fastest wins! 🦁",
    "TASK: Type 5 Indian states in chat! Go! 🇮🇳",
    "TASK: Type 5 fruits in chat right now! 🍎",
    "TASK: Type 5 colors in chat! Speed! 🎨",
    "TASK: Type 5 movie names in chat! 🎬"
];

function solveAnyMath(text) {
    const pctMatch = text.toLowerCase().match(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/);
    if (pctMatch) {
        return Number(((parseFloat(pctMatch) / 100) * parseFloat(pctMatch)).toFixed(4));
    }
    const cleaned = text.replace(/×/g, '*').replace(/÷/g, '/').replace(/\^/g, '**').trim();
    if (/^[0-9\+\-\*\/\(\)\.\s]+$/.test(cleaned) && /[\+\-\*\/]/.test(cleaned) && /\d/.test(cleaned)) {
        try {
            const result = Function('"use strict";return (' + cleaned + ')')();
            if (typeof result === 'number' && isFinite(result)) {
                return Number(result.toFixed(4));
            }
        } catch (e) {
            return null;
        }
    }
    return null;
}

function thinkAndReply(senderName, msgText, scores, playerList) {
    const m = msgText.toLowerCase().trim();
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const pts = botMemory.playerPoints[senderName] || 0;

    if (m.includes('flip') || m.includes('toss') || m.includes('coin')) {
        return `🪙 Flipping virtual coin... It landed on **${Math.random() < 0.5 ? 'HEADS 👑' : 'TAILS 🔥'}**!`;
    }
    if (m.includes('dice') || m.includes('roll')) {
        return `🎲 Rolled a **${Math.floor(Math.random() * 6) + 1}** for ${senderName}!`;
    }
    if (m.includes('quiz') || m.includes('riddle') || m.includes('question')) {
        const chosen = pick(quizBank);
        botMemory.activeQuiz = chosen;
        return `${chosen.q} *(First to type the answer in chat gets +1 AI Point!)*`;
    }
    if (m.includes('task') || m.includes('challenge')) return pick(botTasks);

    if (m.includes('kaisa') || m.includes('haal') || m.includes('how are you') || m.includes('how r u') || m.includes('wassup') || m.includes('sup')) {
        const status = botMemory.lastWinner ? `Still hyped watching ${botMemory.lastWinner} dominate earlier!` : `Waiting for someone brave enough to start an arena match!`;
        return `Mast ekdum ${senderName}! 😎⚡ ${status} Tum sunao, kaise ho?`;
    }
    if (m.includes('hi') || m.includes('hello') || m.includes('hey') || m.includes('namaste') || m.includes('yo')) {
        return pick([
            `Yo ${senderName}! 👋 Welcome to the arena! You have ${pts} AI Points. Type !quiz to test your brain! 🧠`,
            `Hey ${senderName}! ✨ Sammu's Bot online! Type any math like 2+2, type !quiz, or flip a coin! 🤖`
        ]);
    }
    if (m.includes('bore') || m.includes('boring') || m.includes('akela') || m.includes('alone')) {
        return `Bore mat ho ${senderName}! 🔥 Type **!quiz** to battle my brain, or tell the Host to launch **Bomb Pass 💣**!`;
    }
    if (m.includes('who is winning') || m.includes('score') || m.includes('winning') || m.includes('jeet')) {
        if (scores.teamA > scores.teamB) return `🔴 Red Team is ruling the scoreboard (${scores.teamA} - ${scores.teamB})! Blue Team needs a miracle! 👀`;
        if (scores.teamB > scores.teamA) return `🔵 Blue Team is ahead (${scores.teamB} - ${scores.teamA})! Red Team, wake up! 🔥`;
        return `Score is locked at ${scores.teamA} - ${scores.teamB}! Next match decides who's the real boss! ⚔️`;
    }
    if (m.includes('noob') || m.includes('loser') || m.includes('bot') || m.includes('ez')) {
        return pick([
            `Big words from someone with only ${pts} AI Points, ${senderName}! 🤡 Prove it in the arena!`,
            `Careful ${senderName}, I remember everything! Don't cry when you lose in 3 seconds! 💀🔥`
        ]);
    }
    return pick([
        `Interesting thought, ${senderName}! 🤔 There are ${playerList.length} players online. Type **!quiz** for a riddle or type any math like **25*14**!`,
        `I hear you, ${senderName}! 🤖 Ask me to **flip a coin**, **roll a dice**, solve math, or type **!quiz**!`
    ]);
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
        if (!isAlreadyListed) io.emit('message', { username: "Sammu's Bot", text: `✨ Welcome! ${finalizedAvatar} ${finalizedName} how are you? Type !quiz, any math (like 2+2), or chat with me!` });
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
        botMemory.chatCount++;

        const mathAns = solveAnyMath(cleanMsg);
        if (mathAns !== null) {
            setTimeout(() => {
                io.emit('message', {
                    username: "Sammu's Bot",
                    text: `🧮 Easy math, ${senderName}! **${cleanMsg} = ${mathAns}** ⚡`
                });
            }, 300);
            return;
        }

        if (botMemory.activeQuiz && lowerMsg.includes(botMemory.activeQuiz.a)) {
            const solvedAns = botMemory.activeQuiz.a.toUpperCase();
            botMemory.activeQuiz = null;
            botMemory.playerPoints[senderName] = (botMemory.playerPoints[senderName] || 0) + 1;
            setTimeout(() => {
                io.emit('message', {
                    username: "Sammu's Bot",
                    text: `🎉 BINGO! **${senderName}** got it right (${solvedAns})! Total AI Points: **${botMemory.playerPoints[senderName]}** 🏆`
                });
            }, 300);
            return;
        }

        if (lowerMsg === '!task') {
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: botTasks[Math.floor(Math.random() * botTasks.length)] }), 350);
        } else if (lowerMsg === '!quiz') {
            const chosen = quizBank[Math.floor(Math.random() * quizBank.length)];
            botMemory.activeQuiz = chosen;
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `${chosen.q} *(Type the answer in chat!)*` }), 350);
        } else if (lowerMsg.includes('sammu') || lowerMsg.includes('bot') || lowerMsg.startsWith('ai ') || cleanMsg.endsWith('?')) {
            const reply = thinkAndReply(senderName, cleanMsg, gameData.scores, players);
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: reply }), 450);
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
    function recordWin(winnerName, icon) {
        botMemory.lastWinner = winnerName;
        io.emit('announceWinner', { winner: winnerName, icon });
        setTimeout(() => {
            io.emit('message', { username: "Sammu's Bot", text: `🔥 What a match! **${winnerName}** takes the crown! Who wants the next smoke? 👀` });
        }, 600);
    }

    socket.on('assignFighters', (data) => {
        if (socket.id !== hostId) return;
        clearAllTimers(); gameData.fighterA = data.fightA; gameData.fighterB = data.fightB;
        gameData.tttBoard = Array(9).fill(null); gameData.tttTurn = data.fightA;
        gameData.gameState = 'duel'; io.emit('syncGame', gameData);
    });

    socket.on('makeMove', (index) => {
        if (socket.id !== gameData.tttTurn || gameData.tttBoard[index] !== null) return;
        gameData.tttBoard[index] = socket.id === gameData.fighterA ? 'X' : 'O';
        const name = sessionMemory[socket.id] ? sessionMemory[socket.id].username : "Fighter";
        if (checkWin(gameData.tttBoard)) {
            if (socket.id === gameData.fighterA) gameData.scores.teamA++; else gameData.scores.teamB++;
            recordWin(name, '⚔️'); gameData.gameState = 'lobby';
        } else if (!gameData.tttBoard.includes(null)) {
            io.emit('announceWinner', { winner: 'Tie Game', icon: null }); gameData.gameState = 'lobby';
        } else { gameData.tttTurn = gameData.tttTurn === gameData.fighterA ? gameData.fighterB : gameData.fighterA; }
        io.emit('syncGame', gameData);
    });

    socket.on('launchSumo', () => { if (socket.id === hostId) { clearAllTimers(); gameData.gameState = 'sumo'; gameData.sumoPosition = 50; io.emit('syncGame', gameData); } });
    socket.on('sumoPush', () => {
        if (gameData.gameState !== 'sumo') return;
        if (gameData.captainA && socket.id === gameData.captainA.id) gameData.sumoPosition -= 3.5;
        else if (gameData.captainB && socket.id === gameData.captainB.id) gameData.sumoPosition += 3.5;
        if (gameData.sumoPosition <= 10) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (🔴 Team A)", '🏆'); gameData.gameState = 'lobby'; }
        else if (gameData.sumoPosition >= 90) { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (🔵 Team B)", '🏆'); gameData.gameState = 'lobby'; }
        io.emit('syncGame', gameData);
    });

    socket.on('launchSpinner', () => {
        if (socket.id !== hostId || !gameData.captainA || !gameData.captainB) return;
        clearAllTimers(); gameData.gameState = 'spinner';
        gameData.spinner = { a: { x: 90, y: 150, vx: 0, vy: 0 }, b: { x: 210, y: 150, vx: 0, vy: 0 } };
        io.emit('syncGame', gameData);
    });

    socket.on('spinnerMove', (data) => {
        if (gameData.gameState !== 'spinner') return;
        const force = 3.2;
        let p = null;
        if ((gameData.captainA && socket.id === gameData.captainA.id) || gameData.teamA.some(m => m.id === socket.id)) {
            p = gameData.spinner.a;
        } else if ((gameData.captainB && socket.id === gameData.captainB.id) || gameData.teamB.some(m => m.id === socket.id)) {
            p = gameData.spinner.b;
        }
        if (!p) return;

        if (typeof data === 'object' && data !== null) {
            p.vx += (Number(data.dx) || 0) * force;
            p.vy += (Number(data.dy) || 0) * force;
        } else {
            if (data === 'up') p.vy -= force;
            if (data === 'down') p.vy += force;
            if (data === 'left') p.vx -= force;
            if (data === 'right') p.vx += force;
        }
    });

    socket.on('launchQuickDraw', () => {
        if (socket.id !== hostId || !gameData.captainA || !gameData.captainB) return;
        clearAllTimers(); gameData.gameState = 'quickdraw'; gameData.drawReady = false; io.emit('syncGame', gameData);
        drawTimer = setTimeout(() => { if (gameData.gameState === 'quickdraw') { gameData.drawReady = true; io.emit('syncGame', gameData); } }, Math.floor(Math.random() * 3500) + 2000);
    });
    socket.on('quickDrawFire', () => {
        if (gameData.gameState !== 'quickdraw') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if (!isA && !isB) return;
        clearAllTimers();
        if (!gameData.drawReady) {
            if (isA) { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Opponent fouled!)", '🤠'); }
            else { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Opponent fouled!)", '🤠'); }
        } else {
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Fastest Draw!)", '🔫'); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Fastest Draw!)", '🔫'); }
        }
        gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
    });

    socket.on('launchMath', () => { if (socket.id === hostId && gameData.captainA && gameData.captainB) { clearAllTimers(); gameData.gameState = 'math'; gameData.mathQ = generateMath(); io.emit('syncGame', gameData); } });
    socket.on('submitMath', (val) => {
        if (gameData.gameState !== 'math') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if ((isA || isB) && Number(val) === gameData.mathQ.answer) {
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (🔴 Team A)", '🧠'); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (🔵 Team B)", '🧠'); }
            gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
        }
    });
    socket.on('launchBomb', () => {
        if (socket.id !== hostId || !gameData.captainA || !gameData.captainB) return;
        clearAllTimers(); gameData.gameState = 'bomb'; gameData.bombHolder = Math.random() < 0.5 ? gameData.captainA.id : gameData.captainB.id; io.emit('syncGame', gameData);
        bombTimer = setTimeout(() => {
            if (gameData.gameState !== 'bomb') return;
            if (gameData.bombHolder === gameData.captainA.id) { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Bomb exploded on Red! 💥)", '💣'); }
            else { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Bomb exploded on Blue! 💥)", '💣'); }
            gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
        }, Math.floor(Math.random() * 9000) + 7000);
    });
    socket.on('passBomb', () => { if (gameData.gameState === 'bomb' && socket.id === gameData.bombHolder) { gameData.bombHolder = (socket.id === gameData.captainA.id) ? gameData.captainB.id : gameData.captainA.id; io.emit('syncGame', gameData); } });

    socket.on('launchRPS', () => { if (socket.id === hostId && gameData.captainA && gameData.captainB) { clearAllTimers(); gameData.gameState = 'rps'; gameData.rpsChoices = { a: null, b: null }; io.emit('syncGame', gameData); } });
    socket.on('pickRPS', (choice) => {
        if (gameData.gameState !== 'rps') return;
        if (gameData.captainA && socket.id === gameData.captainA.id) gameData.rpsChoices.a = choice;
        else if (gameData.captainB && socket.id === gameData.captainB.id) gameData.rpsChoices.b = choice;
        else return;
        const { a, b } = gameData.rpsChoices;
        if (a && b) {
            if (a === b) { io.emit('message', { username: "Sammu's Bot", text: `🤝 Both picked ${a}! Rematch!` }); gameData.rpsChoices = { a: null, b: null }; }
            else if ((a === '🪨' && b === '✂️') || (a === '📄' && b === '🪨') || (a === '✂️' && b === '📄')) { gameData.scores.teamA++; recordWin(`${gameData.captainA.username} (${a} beats ${b})`, '🏆'); gameData.gameState = 'lobby'; }
            else { gameData.scores.teamB++; recordWin(`${gameData.captainB.username} (${b} beats ${a})`, '🏆'); gameData.gameState = 'lobby'; }
        }
        io.emit('syncGame', gameData);
    });

    socket.on('launchMemory', () => {
        if (socket.id !== hostId || !gameData.captainA || !gameData.captainB) return;
        clearAllTimers(); gameData.gameState = 'memory'; gameData.memoryHidden = false;
        gameData.memoryGrid = ['🦁','🤖','👽','🔥','👑','💀','🍕','🚀','💎'].sort(() => Math.random() - 0.5);
        gameData.memoryTarget = gameData.memoryGrid[Math.floor(Math.random() * 9)]; io.emit('syncGame', gameData);
        memoryTimer = setTimeout(() => { if (gameData.gameState === 'memory') { gameData.memoryHidden = true; io.emit('syncGame', gameData); } }, 2800);
    });
    socket.on('pickMemory', (idx) => {
        if (gameData.gameState !== 'memory' || !gameData.memoryHidden) return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if ((isA || isB) && gameData.memoryGrid[idx] === gameData.memoryTarget) {
            clearAllTimers();
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Found " + gameData.memoryTarget + "!)", '✨'); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Found " + gameData.memoryTarget + "!)", '✨'); }
            gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
        }
    });

    socket.on('launchTug', () => { if (socket.id === hostId && gameData.captainA && gameData.captainB) { clearAllTimers(); gameData.gameState = 'tug'; gameData.tugPosition = 50; io.emit('syncGame', gameData); } });
    socket.on('tugPull', () => {
        if (gameData.gameState !== 'tug') return;
        if (gameData.teamA.some(p => p.id === socket.id)) gameData.tugPosition -= 2.5;
        else if (gameData.teamB.some(p => p.id === socket.id)) gameData.tugPosition += 2.5;
        else return;
        if (gameData.tugPosition <= 10) { gameData.scores.teamA++; recordWin("🔴 Team A Pulled the Rope!", '🪢'); gameData.gameState = 'lobby'; }
        else if (gameData.tugPosition >= 90) { gameData.scores.teamB++; recordWin("🔵 Team B Pulled the Rope!", '🪢'); gameData.gameState = 'lobby'; }
        io.emit('syncGame', gameData);
    });

    socket.on('sendReaction', (emoji) => io.emit('incomingReaction', emoji));
    socket.on('resetToLobby', () => {
        if (socket.id !== hostId) return;
        clearAllTimers();
        gameData = { captainA: null, captainB: null, teamA: [], teamB: [], fighterA: null, fighterB: null, tttBoard: Array(9).fill(null), tttTurn: null, sumoPosition: 50, spinner: { a: { x: 90, y: 150, vx: 0, vy: 0 }, b: { x: 210, y: 150, vx: 0, vy: 0 } }, drawReady: false, mathQ: { question: '', options: [], answer: 0 }, bombHolder: null, rpsChoices: { a: null, b: null }, memoryGrid: [], memoryTarget: '', memoryHidden: false, tugPosition: 50, scores: gameData.scores, gameState: 'lobby' };
        io.emit('syncGame', gameData);
    });
    socket.on('disconnect', () => {
        const lp = players.find(p => p.id === socket.id);
        if (lp) io.emit('message', { username: "Sammu's Bot", text: `😢 ${lp.username} has left the room` });
        players = players.filter(p => p.id !== socket.id); io.emit('updatePlayers', players);
    });
});

function checkWin(b) {
    return ["012","345","678","036","147","258","048","246"].some(s => { const [x,y,z] = s.split('').map(Number); return b[x] && b[x] === b[y] && b[x] === b[z]; });
}

setInterval(() => {
    if (gameData.gameState !== 'spinner') return;
    const a = gameData.spinner.a, b = gameData.spinner.b;
    a.x += a.vx; a.y += a.vy; a.vx *= 0.92; a.vy *= 0.92;
    b.x += b.vx; b.y += b.vy; b.vx *= 0.92; b.vy *= 0.92;

    const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
    if (dist < 44 && dist > 0) {
        const nx = dx / dist, ny = dy / dist;
        a.vx -= nx * 10.5; a.vy -= ny * 10.5;
        b.vx += nx * 10.5; b.vy += ny * 10.5;
    }

    const distA = Math.hypot(a.x - 150, a.y - 150);
    const distB = Math.hypot(b.x - 150, b.y - 150);

    if (distA >= 126) {
        gameData.gameState = 'lobby';
        gameData.scores.teamB++;
        const winName = gameData.captainB ? gameData.captainB.username : "Blue Spinner";
        recordWin(winName + " (🔵 Team B)", '🌀');
        io.emit('syncGame', gameData);
    } else if (distB >= 126) {
        gameData.gameState = 'lobby';
        gameData.scores.teamA++;
        const winName = gameData.captainA ? gameData.captainA.username : "Red Spinner";
        recordWin(winName + " (🔴 Team A)", '🌀');
        io.emit('syncGame', gameData);
    } else {
        io.emit('spinnerTick', gameData.spinner);
    }
}, 33);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Sammu Games Running on Port ' + PORT));
