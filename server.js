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

const ADMIN_SECRET_KEY = "#bhaicharaontop";

let botMemory = {
    lastWinner: null,
    playerPoints: {},
    activeQuiz: null,
    activeRiddle: null,
    activeTask: null,
    chatCount: 0
};
const gifLibrary = {
    fire: "🔥|ON FIRE!|pulse",
    gg: "🎉|GOOD GAME!|bounce",
    cry: "😭|CRYING HARD|shake",
    dance: "💃|VICTORY DANCE|spin",
    win: "🏆|CHAMPION!|bounce",
    clown: "🤡|CLOWN MOMENT|shake",
    sus: "👀|VERY SUS...|pulse",
    hype: "⚡|MAX HYPE!|bounce",
    savage: "😎|THUG LIFE SAVAGE|pulse",
    bye: "👋|BYE BYE!|shake",
    roast: "🧯|EMOTIONAL DAMAGE|shake",
    noob: "💀|TOTAL NOOB|spin",
    laugh: "😂|LMAOOO!|bounce",
    shock: "😱|WHAT?!|shake"
};
const quizBank = [
    { q: "🌍 GEOGRAPHY: Which country has the largest population in the world?", a: "india" },
    { q: "⚡ SCIENCE: What is the chemical symbol for Gold?", a: "au" },
    { q: "🎮 GAMING: Which block-building game features Creepers and Ender Dragons?", a: "minecraft" },
    { q: "🏏 CRICKET: Who is known as the 'God of Cricket'?", a: "sachin" },
    { q: "🚀 SPACE: Which planet is known as the Red Planet?", a: "mars" },
    { q: "🌊 OCEAN: What is the largest ocean on Earth?", a: "pacific" },
    { q: "🦁 ANIMALS: What is the fastest land animal?", a: "cheetah" },
    { q: "🏛️ HISTORY: In which country are the Pyramids of Giza located?", a: "egypt" },
    { q: "💻 TECH: Who founded Microsoft?", a: "bill gates" },
    { q: "⚽ FOOTBALL: Which country won the 2022 FIFA World Cup?", a: "argentina" },
    { q: "🧪 SCIENCE: What gas do plants absorb from the atmosphere?", a: "carbon dioxide" },
    { q: "🎬 MOVIES: Who played Iron Man in the Marvel movies?", a: "robert downey" },
    { q: "🏔️ GEOGRAPHY: What is the tallest mountain in the world?", a: "everest" },
    { q: "🎵 MUSIC: How many strings does a standard guitar have?", a: "6" },
    { q: "🍕 FOOD: Which country invented Pizza?", a: "italy" },
    { q: "🦴 BIOLOGY: How many bones are in an adult human body?", a: "206" },
    { q: "🌌 SPACE: What is the closest star to Earth?", a: "sun" },
    { q: "♟️ GAMES: How many squares are on a standard chessboard?", a: "64" },
    { q: "🇮🇳 INDIA: What is the capital city of India?", a: "new delhi" },
    { q: "⚡ SCIENCE: What is H2O commonly known as?", a: "water" }
];
const riddleBank = [
    { q: "❓ RIDDLE: What has keys but can't open locks?", a: "piano" },
    { q: "❓ RIDDLE: The more of me you take, the more you leave behind. What am I?", a: "footsteps" },
    { q: "❓ RIDDLE: What gets wetter the more it dries?", a: "towel" },
    { q: "❓ RIDDLE: What has hands but cannot clap?", a: "clock" },
    { q: "❓ RIDDLE: What has to be broken before you can use it?", a: "egg" },
    { q: "❓ RIDDLE: I'm tall when I'm young, and I'm short when I'm old. What am I?", a: "candle" },
    { q: "❓ RIDDLE: What is full of holes but still holds water?", a: "sponge" },
    { q: "❓ RIDDLE: What goes up but never comes down?", a: "age" },
    { q: "❓ RIDDLE: What has one eye but can't see?", a: "needle" },
    { q: "❓ RIDDLE: What has many teeth but cannot bite?", a: "comb" },
    { q: "❓ RIDDLE: What has legs but doesn't walk?", a: "table" },
    { q: "❓ RIDDLE: What can you catch but never throw?", a: "cold" },
    { q: "❓ RIDDLE: What belongs to you, but other people use it more than you?", a: "name" },
    { q: "❓ RIDDLE: What has a neck without a head?", a: "bottle" },
    { q: "❓ RIDDLE: What travels around the world while staying in a corner?", a: "stamp" },
    { q: "❓ RIDDLE: What gets bigger the more you take away from it?", a: "hole" },
    { q: "❓ RIDDLE: What has words, but never speaks?", a: "book" },
    { q: "❓ RIDDLE: What runs all around a backyard, yet never moves?", a: "fence" },
    { q: "❓ RIDDLE: What has a thumb and four fingers, but is not alive?", a: "glove" },
    { q: "❓ RIDDLE: What can fill a room but takes up no space?", a: "light" }
];

const botTasks = [
    { text: "⚡ TASK: Type 5 COUNTRIES starting with letter A! (Separate with commas or spaces)", letter: "a", count: 5 },
    { text: "⚡ TASK: Type 5 COUNTRIES starting with letter I!", letter: "i", count: 5 },
    { text: "⚡ TASK: Type 5 COUNTRIES starting with letter S!", letter: "s", count: 5 },
    { text: "⚡ TASK: Type 5 ANIMALS starting with letter B!", letter: "b", count: 5 },
    { text: "⚡ TASK: Type 5 ANIMALS starting with letter C!", letter: "c", count: 5 },
    { text: "⚡ TASK: Type 5 FRUITS starting with letter M!", letter: "m", count: 5 },
    { text: "⚡ TASK: Type 5 FRUITS starting with letter P!", letter: "p", count: 5 },
    { text: "⚡ TASK: Type 5 COLORS starting with letter B!", letter: "b", count: 5 },
    { text: "⚡ TASK: Type 5 CITIES starting with letter D!", letter: "d", count: 5 },
    { text: "⚡ TASK: Type 5 CITIES starting with letter M!", letter: "m", count: 5 },
    { text: "⚡ TASK: Type 5 SPORTS starting with letter C!", letter: "c", count: 5 },
    { text: "⚡ TASK: Type 5 BOYS NAMES starting with letter R!", letter: "r", count: 5 },
    { text: "⚡ TASK: Type 5 GIRLS NAMES starting with letter S!", letter: "s", count: 5 },
    { text: "⚡ TASK: Type 5 FOODS starting with letter P!", letter: "p", count: 5 },
    { text: "⚡ TASK: Type 5 WORDS starting with letter T!", letter: "t", count: 5 }
];

function addMVPPoints(username, pts) {
    if (!username) return;
    botMemory.playerPoints[username] = (botMemory.playerPoints[username] || 0) + pts;
    broadcastMVP();
}

function broadcastMVP() {
    const board = Object.entries(botMemory.playerPoints)
        .map(([name, pts]) => ({ name, pts }))
        .sort((a, b) => b.pts - a.pts);
    io.emit('updateMVP', board);
}
function checkTaskSubmission(msg, taskObj) {
    if (!taskObj) return false;
    const rawItems = msg.includes(',') ? msg.split(',') : msg.trim().split(/\s+/);
    const uniqueValid = new Set();
    rawItems.forEach(item => {
        const clean = item.toLowerCase().replace(/[^a-z]/g, '');
        if (clean.length >= 2 && clean.startsWith(taskObj.letter)) {
            uniqueValid.add(clean);
        }
    });
    return uniqueValid.size >= taskObj.count;
}

function solveAnyMath(text) {
    const pctMatch = text.toLowerCase().match(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/);
    if (pctMatch) {
        return Number(((parseFloat(pctMatch[1]) / 100) * parseFloat(pctMatch[2])).toFixed(4));
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
    if (m.includes('riddle')) {
        const chosen = pick(riddleBank);
        botMemory.activeRiddle = chosen;
        return `${chosen.q} *(First to type the answer gets +1 MVP Point!)*`;
    }
    if (m.includes('quiz') || m.includes('question')) {
        const chosen = pick(quizBank);
        botMemory.activeQuiz = chosen;
        return `${chosen.q} *(First to type the answer gets +1 MVP Point!)*`;
    }
    if (m.includes('task') || m.includes('challenge')) {
        const chosen = pick(botTasks);
        botMemory.activeTask = chosen;
        return `${chosen.text} *(First to list 5 valid words gets +2 MVP Points!)*`;
    }
    if (m.includes('kaisa') || m.includes('haal') || m.includes('how are you') || m.includes('how r u') || m.includes('wassup') || m.includes('sup')) {
        const status = botMemory.lastWinner ? `Still hyped watching ${botMemory.lastWinner} dominate earlier!` : `Waiting for someone brave enough to start an arena match!`;
        return `Mast ekdum ${senderName}! 😎⚡ ${status} Tum sunao, kaise ho?`;
    }
    if (m.includes('hi') || m.includes('hello') || m.includes('hey') || m.includes('namaste') || m.includes('yo')) {
        return pick([
            `Yo ${senderName}! 👋 You have ${pts} MVP Points. Try **!quiz**, **!riddle**, **!task**, or **/gif savage**! 🧠`,
            `Hey ${senderName}! ✨ Sammu's Bot online! Type any math like 25*14, **!quiz**, **!riddle**, or **!gifs**! 🤖`
        ]);
    }
    if (m.includes('who is winning') || m.includes('score') || m.includes('winning') || m.includes('jeet')) {
        if (scores.teamA > scores.teamB) return `🔴 Red Team is ruling the scoreboard (${scores.teamA} - ${scores.teamB})! Blue Team needs a miracle! 👀`;
        if (scores.teamB > scores.teamA) return `🔵 Blue Team is ahead (${scores.teamB} - ${scores.teamA})! Red Team, wake up! 🔥`;
        return `Score is locked at ${scores.teamA} - ${scores.teamB}! Next match decides who's the real boss! ⚔️`;
    }
    return pick([
        `Interesting thought, ${senderName}! 🤔 There are ${playerList.length} players online. Type **!quiz**, **!riddle**, **!task**, or **!gifs**!`,
        `I hear you, ${senderName}! 🤖 Ask me to **flip a coin**, **roll a dice**, solve math, or type **!mvp**!`
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
    colorTrap: null,
    scrambleWord: '', scrambleAnswer: '',
    diceRolls: { a: null, b: null },
    penaltyPicks: { shooter: null, keeper: null },
    typingPhrase: '',
    treasureGrid: [],
    scores: { teamA: 0, teamB: 0 }, gameState: 'lobby'
};

function generateMath() {
    const a = Math.floor(Math.random() * 15) + 5, b = Math.floor(Math.random() * 12) + 3, c = Math.floor(Math.random() * 20) + 1;
    const ans = (a * b) + c;
    let opts = new Set([ans]);
    while (opts.size < 4) opts.add(ans + (Math.floor(Math.random() * 15) - 7));
    return { question: `${a} × ${b} + ${c} = ?`, options: Array.from(opts).sort(() => Math.random() - 0.5), answer: ans };
}

function generateColorTrap() {
    const colors = [
        { name: 'RED', hex: '#ef4444' },
        { name: 'BLUE', hex: '#3b82f6' },
        { name: 'GREEN', hex: '#10b981' },
        { name: 'YELLOW', hex: '#eab308' }
    ];
    const target = colors[Math.floor(Math.random() * colors.length)];
    const fake = colors[Math.floor(Math.random() * colors.length)];
    return {
        targetName: target.name,
        fakeHex: fake.hex,
        options: [...colors].sort(() => Math.random() - 0.5)
    };
}

function generateScramble() {
    const words = ['DRAGON', 'GALAXY', 'ROCKET', 'PLANET', 'NINJA', 'TROPHY', 'THUNDER', 'DIAMOND', 'VICTORY', 'ARENA'];
    const word = words[Math.floor(Math.random() * words.length)];
    let scrambled = word.split('').sort(() => Math.random() - 0.5).join('');
    if (scrambled === word) scrambled = word.split('').reverse().join('');
    return { scrambled, answer: word };
}

function generateTyping() {
    const phrases = [
        "Sammu Arena Champion!",
        "Fastest fingers win the crown!",
        "Red vs Blue ultimate showdown!",
        "Victory belongs to the bold!",
        "Never give up until the end!"
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
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
        broadcastMVP();
        if (!isAlreadyListed) io.emit('message', { username: "Sammu's Bot", text: `✨ Welcome ${finalizedAvatar} ${finalizedName}! Try !task, !quiz, !riddle, !mvp, or !gifs!` });
    });

    socket.on('chatMessage', (msg) => {
        let senderName = sessionMemory[socket.id] ? sessionMemory[socket.id].username : (socket.username || "Guest");
        const cleanMsg = msg.trim(), lowerMsg = cleanMsg.toLowerCase();

        if (cleanMsg === ADMIN_SECRET_KEY) {
            hostId = socket.id;
            players = players.map(p => ({ ...p, isHost: p.id === hostId }));
            socket.emit('initRole', { isHost: true, gameData });
            io.emit('updatePlayers', players); io.emit('syncGame', gameData);
            io.emit('message', { username: 'SYSTEM', text: `${senderName} has unlocked Host Admin Panel! 👑` });
            return;
        }

        if (lowerMsg.startsWith('/gif')) {
            const key = lowerMsg.replace('/gif', '').trim() || 'fire';
            const gifUrl = gifLibrary[key] || gifLibrary.fire;
            io.emit('message', { username: senderName, text: key.toUpperCase(), gifUrl });
            return;
        }

        io.emit('message', { username: senderName, text: msg });
        botMemory.chatCount++;

        const mathAns = solveAnyMath(cleanMsg);
        if (mathAns !== null) {
            setTimeout(() => {
                io.emit('message', { username: "Sammu's Bot", text: `🧮 Easy math, ${senderName}! **${cleanMsg} = ${mathAns}** ⚡` });
            }, 300);
            return;
        }

        if (botMemory.activeTask && checkTaskSubmission(cleanMsg, botMemory.activeTask)) {
            const completedLetter = botMemory.activeTask.letter.toUpperCase();
            botMemory.activeTask = null;
            addMVPPoints(senderName, 2);
            if (gameData.captainA && gameData.captainA.username === senderName) { gameData.scores.teamA++; io.emit('syncGame', gameData); }
            else if (gameData.captainB && gameData.captainB.username === senderName) { gameData.scores.teamB++; io.emit('syncGame', gameData); }
            setTimeout(() => {
                io.emit('message', { username: "Sammu's Bot", text: `🔥 TASK COMPLETED by **${senderName}** (5 words with **${completedLetter}**)! +2 MVP Points! 🏆` });
            }, 300);
            return;
        }

        if (botMemory.activeQuiz && lowerMsg.includes(botMemory.activeQuiz.a)) {
            const solvedAns = botMemory.activeQuiz.a.toUpperCase();
            botMemory.activeQuiz = null;
            addMVPPoints(senderName, 1);
            setTimeout(() => {
                io.emit('message', { username: "Sammu's Bot", text: `🎉 QUIZ SOLVED! **${senderName}** got **${solvedAns}**! +1 MVP Point! 🏆` });
            }, 300);
            return;
        }

        if (botMemory.activeRiddle && lowerMsg.includes(botMemory.activeRiddle.a)) {
            const solvedAns = botMemory.activeRiddle.a.toUpperCase();
            botMemory.activeRiddle = null;
            addMVPPoints(senderName, 1);
            setTimeout(() => {
                io.emit('message', { username: "Sammu's Bot", text: `🧠 RIDDLE CRACKED! **${senderName}** guessed **${solvedAns}**! +1 MVP Point! 🏆` });
            }, 300);
            return;
        }

        if (lowerMsg === '!task') {
            const chosen = botTasks[Math.floor(Math.random() * botTasks.length)];
            botMemory.activeTask = chosen;
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: chosen.text }), 350);
        } else if (lowerMsg === '!quiz') {
            const chosen = quizBank[Math.floor(Math.random() * quizBank.length)];
            botMemory.activeQuiz = chosen;
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `${chosen.q} *(Type the answer in chat!)*` }), 350);
        } else if (lowerMsg === '!riddle') {
            const chosen = riddleBank[Math.floor(Math.random() * riddleBank.length)];
            botMemory.activeRiddle = chosen;
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `${chosen.q} *(Type the answer in chat!)*` }), 350);
        } else if (lowerMsg === '!gifs') {
            const list = Object.keys(gifLibrary).map(k => `/gif ${k}`).join(', ');
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `🎬 Available GIFs (14): ${list}` }), 300);
        } else if (lowerMsg === '!mvp') {
            const top = Object.entries(botMemory.playerPoints).sort((a, b) => b[1] - a[1]).slice(0, 5);
            const summary = top.length ? top.map(([n, p], i) => `#${i + 1} ${n} (${p} pts)`).join(' | ') : "No MVP points yet! Win games or solve !quiz / !task!";
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `🏆 MVP LEADERBOARD: ${summary}` }), 300);
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

    function recordWin(winnerName, icon, mvpUsername) {
        botMemory.lastWinner = winnerName;
        if (mvpUsername) addMVPPoints(mvpUsername, 3);
        io.emit('announceWinner', { winner: winnerName, icon });
        setTimeout(() => {
            io.emit('message', { username: "Sammu's Bot", text: `🔥 What a match! **${winnerName}** takes the crown (+3 MVP pts)! Who wants the next smoke? 👀` });
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
            recordWin(name, '⚔️', name); gameData.gameState = 'lobby';
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
        if (gameData.sumoPosition <= 10) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (🔴 Team A)", '🏆', gameData.captainA.username); gameData.gameState = 'lobby'; }
        else if (gameData.sumoPosition >= 90) { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (🔵 Team B)", '🏆', gameData.captainB.username); gameData.gameState = 'lobby'; }
        io.emit('syncGame', gameData);
    });

    socket.on('launchSpinner', () => {
        if (socket.id !== hostId || !gameData.captainA || !gameData.captainB) return;
        clearAllTimers(); gameData.gameState = 'spinner';
        gameData.spinner = { a: { x: 95, y: 150, vx: 0, vy: 0 }, b: { x: 205, y: 150, vx: 0, vy: 0 } };
        io.emit('syncGame', gameData);
        io.emit('spinnerTick', gameData.spinner);
    });

    socket.on('spinnerMove', (data) => {
        if (gameData.gameState !== 'spinner') return;
        const force = 4.2;
        let p = null;
        if ((gameData.captainA && socket.id === gameData.captainA.id) || gameData.teamA.some(m => m.id === socket.id)) p = gameData.spinner.a;
        else if ((gameData.captainB && socket.id === gameData.captainB.id) || gameData.teamB.some(m => m.id === socket.id)) p = gameData.spinner.b;
        if (!p) return;
        if (data === 'up') p.vy = Math.max(-14, p.vy - force);
        if (data === 'down') p.vy = Math.min(14, p.vy + force);
        if (data === 'left') p.vx = Math.max(-14, p.vx - force);
        if (data === 'right') p.vx = Math.min(14, p.vx + force);
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
            if (isA) { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Opponent fouled!)", '🤠', gameData.captainB.username); }
            else { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Opponent fouled!)", '🤠', gameData.captainA.username); }
        } else {
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Fastest Draw!)", '🔫', gameData.captainA.username); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Fastest Draw!)", '🔫', gameData.captainB.username); }
        }
        gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
    });

    socket.on('launchMath', () => { if (socket.id === hostId && gameData.captainA && gameData.captainB) { clearAllTimers(); gameData.gameState = 'math'; gameData.mathQ = generateMath(); io.emit('syncGame', gameData); } });
    socket.on('submitMath', (val) => {
        if (gameData.gameState !== 'math') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if ((isA || isB) && Number(val) === gameData.mathQ.answer) {
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (🔴 Team A)", '🧠', gameData.captainA.username); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (🔵 Team B)", '🧠', gameData.captainB.username); }
            gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
        }
    });

    socket.on('launchBomb', () => {
        if (socket.id !== hostId || !gameData.captainA || !gameData.captainB) return;
        clearAllTimers(); gameData.gameState = 'bomb'; gameData.bombHolder = Math.random() < 0.5 ? gameData.captainA.id : gameData.captainB.id; io.emit('syncGame', gameData);
        bombTimer = setTimeout(() => {
            if (gameData.gameState !== 'bomb') return;
            if (gameData.bombHolder === gameData.captainA.id) { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Bomb exploded on Red! 💥)", '💣', gameData.captainB.username); }
            else { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Bomb exploded on Blue! 💥)", '💣', gameData.captainA.username); }
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
            else if ((a === '🪨' && b === '✂️') || (a === '📄' && b === '🪨') || (a === '✂️' && b === '📄')) { gameData.scores.teamA++; recordWin(`${gameData.captainA.username} (${a} beats ${b})`, '🏆', gameData.captainA.username); gameData.gameState = 'lobby'; }
            else { gameData.scores.teamB++; recordWin(`${gameData.captainB.username} (${b} beats ${a})`, '🏆', gameData.captainB.username); gameData.gameState = 'lobby'; }
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
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Found " + gameData.memoryTarget + "!)", '✨', gameData.captainA.username); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Found " + gameData.memoryTarget + "!)", '✨', gameData.captainB.username); }
            gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
        }
    });

    socket.on('launchTug', () => { if (socket.id === hostId && gameData.captainA && gameData.captainB) { clearAllTimers(); gameData.gameState = 'tug'; gameData.tugPosition = 50; io.emit('syncGame', gameData); } });
    socket.on('tugPull', () => {
        if (gameData.gameState !== 'tug') return;
        if (gameData.teamA.some(p => p.id === socket.id)) gameData.tugPosition -= 2.5;
        else if (gameData.teamB.some(p => p.id === socket.id)) gameData.tugPosition += 2.5;
        else return;
        if (gameData.tugPosition <= 10) { gameData.scores.teamA++; recordWin("🔴 Team A Pulled the Rope!", '🪢', gameData.captainA ? gameData.captainA.username : null); gameData.gameState = 'lobby'; }
        else if (gameData.tugPosition >= 90) { gameData.scores.teamB++; recordWin("🔵 Team B Pulled the Rope!", '🪢', gameData.captainB ? gameData.captainB.username : null); gameData.gameState = 'lobby'; }
        io.emit('syncGame', gameData);
    });

    socket.on('launchColorTrap', () => { if (socket.id === hostId && gameData.captainA && gameData.captainB) { clearAllTimers(); gameData.gameState = 'colortrap'; gameData.colorTrap = generateColorTrap(); io.emit('syncGame', gameData); } });
    socket.on('pickColorTrap', (colorName) => {
        if (gameData.gameState !== 'colortrap' || !gameData.colorTrap) return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if (!isA && !isB) return;
        if (colorName === gameData.colorTrap.targetName) {
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Fastest Reflex!)", '🎨', gameData.captainA.username); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Fastest Reflex!)", '🎨', gameData.captainB.username); }
        } else {
            if (isA) { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Red fell for Color Trap!)", '🎨', gameData.captainB.username); }
            else { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Blue fell for Color Trap!)", '🎨', gameData.captainA.username); }
        }
        gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
    });

    socket.on('launchScramble', () => {
        if (socket.id !== hostId || !gameData.captainA || !gameData.captainB) return;
        clearAllTimers(); const s = generateScramble();
        gameData.gameState = 'scramble'; gameData.scrambleWord = s.scrambled; gameData.scrambleAnswer = s.answer;
        io.emit('syncGame', gameData);
    });
    socket.on('submitScramble', (guess) => {
        if (gameData.gameState !== 'scramble') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if ((isA || isB) && guess.toUpperCase().trim() === gameData.scrambleAnswer) {
            if (isA) { gameData.scores.teamA++; recordWin(`${gameData.captainA.username} (${gameData.scrambleAnswer})`, '🔤', gameData.captainA.username); }
            else { gameData.scores.teamB++; recordWin(`${gameData.captainB.username} (${gameData.scrambleAnswer})`, '🔤', gameData.captainB.username); }
            gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
        }
    });

    socket.on('launchDice', () => { if (socket.id === hostId && gameData.captainA && gameData.captainB) { clearAllTimers(); gameData.gameState = 'dice'; gameData.diceRolls = { a: null, b: null }; io.emit('syncGame', gameData); } });
    socket.on('rollArenaDice', () => {
        if (gameData.gameState !== 'dice') return;
        if (gameData.captainA && socket.id === gameData.captainA.id && !gameData.diceRolls.a) gameData.diceRolls.a = Math.floor(Math.random() * 6) + 1;
        else if (gameData.captainB && socket.id === gameData.captainB.id && !gameData.diceRolls.b) gameData.diceRolls.b = Math.floor(Math.random() * 6) + 1;
        else return;
        const { a, b } = gameData.diceRolls;
        if (a && b) {
            if (a === b) { io.emit('message', { username: "Sammu's Bot", text: `🎲 Both rolled ${a}! Roll again!` }); gameData.diceRolls = { a: null, b: null }; }
            else if (a > b) { gameData.scores.teamA++; recordWin(`${gameData.captainA.username} (Rolled ${a} vs ${b})`, '🎲', gameData.captainA.username); gameData.gameState = 'lobby'; }
            else { gameData.scores.teamB++; recordWin(`${gameData.captainB.username} (Rolled ${b} vs ${a})`, '🎲', gameData.captainB.username); gameData.gameState = 'lobby'; }
        }
        io.emit('syncGame', gameData);
    });
    socket.on('launchPenalty', () => { if (socket.id === hostId && gameData.captainA && gameData.captainB) { clearAllTimers(); gameData.gameState = 'penalty'; gameData.penaltyPicks = { shooter: null, keeper: null }; io.emit('syncGame', gameData); } });
    socket.on('penaltyPick', (dir) => {
        if (gameData.gameState !== 'penalty') return;
        if (gameData.captainA && socket.id === gameData.captainA.id) gameData.penaltyPicks.shooter = dir;
        else if (gameData.captainB && socket.id === gameData.captainB.id) gameData.penaltyPicks.keeper = dir;
        else return;
        const { shooter, keeper } = gameData.penaltyPicks;
        if (shooter && keeper) {
            if (shooter === keeper) { gameData.scores.teamB++; recordWin(`${gameData.captainB.username} (SAVED ${shooter}! 🧤)`, '⚽', gameData.captainB.username); }
            else { gameData.scores.teamA++; recordWin(`${gameData.captainA.username} (GOAL ${shooter}! 🥅)`, '⚽', gameData.captainA.username); }
            gameData.gameState = 'lobby';
        }
        io.emit('syncGame', gameData);
    });

    socket.on('launchTyping', () => { if (socket.id === hostId && gameData.captainA && gameData.captainB) { clearAllTimers(); gameData.gameState = 'typing'; gameData.typingPhrase = generateTyping(); io.emit('syncGame', gameData); } });
    socket.on('submitTyping', (text) => {
        if (gameData.gameState !== 'typing') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if ((isA || isB) && text.trim().toLowerCase() === gameData.typingPhrase.toLowerCase()) {
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Speed Typer!)", '⌨️', gameData.captainA.username); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Speed Typer!)", '⌨️', gameData.captainB.username); }
            gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
        }
    });

    socket.on('launchTreasure', () => {
        if (socket.id !== hostId || !gameData.captainA || !gameData.captainB) return;
        clearAllTimers(); gameData.gameState = 'treasure';
        const items = ['💎', '💀', '🕸️', '🦴', '🪨', '🍂', '🐚', '🕷️', '🪙'].sort(() => Math.random() - 0.5);
        gameData.treasureGrid = items.map(icon => ({ icon, opened: false }));
        io.emit('syncGame', gameData);
    });
    socket.on('pickTreasure', (idx) => {
        if (gameData.gameState !== 'treasure' || !gameData.treasureGrid[idx] || gameData.treasureGrid[idx].opened) return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if (!isA && !isB) return;
        gameData.treasureGrid[idx].opened = true;
        if (gameData.treasureGrid[idx].icon === '💎') {
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Found the Diamond!)", '💎', gameData.captainA.username); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Found the Diamond!)", '💎', gameData.captainB.username); }
            gameData.gameState = 'lobby';
        }
        io.emit('syncGame', gameData);
    });

    socket.on('sendReaction', (emoji) => io.emit('incomingReaction', emoji));
    socket.on('resetToLobby', () => {
        if (socket.id !== hostId) return;
        clearAllTimers();
        gameData = { captainA: null, captainB: null, teamA: [], teamB: [], fighterA: null, fighterB: null, tttBoard: Array(9).fill(null), tttTurn: null, sumoPosition: 50, spinner: { a: { x: 90, y: 150, vx: 0, vy: 0 }, b: { x: 210, y: 150, vx: 0, vy: 0 } }, drawReady: false, mathQ: { question: '', options: [], answer: 0 }, bombHolder: null, rpsChoices: { a: null, b: null }, memoryGrid: [], memoryTarget: '', memoryHidden: false, tugPosition: 50, colorTrap: null, scrambleWord: '', scrambleAnswer: '', diceRolls: { a: null, b: null }, penaltyPicks: { shooter: null, keeper: null }, typingPhrase: '', treasureGrid: [], scores: gameData.scores, gameState: 'lobby' };
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
    a.x += a.vx; a.y += a.vy; a.vx *= 0.90; a.vy *= 0.90;
    b.x += b.vx; b.y += b.vy; b.vx *= 0.90; b.vy *= 0.90;

    const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
    if (dist < 44) {
        const nx = dist > 0 ? dx / dist : 1, ny = dist > 0 ? dy / dist : 0;
        const overlap = 44 - dist;
        a.x -= nx * (overlap / 2); a.y -= ny * (overlap / 2);
        b.x += nx * (overlap / 2); b.y += ny * (overlap / 2);
        a.vx -= nx * 11; a.vy -= ny * 11;
        b.vx += nx * 11; b.vy += ny * 11;
    }

    const distA = Math.hypot(a.x - 150, a.y - 150);
    const distB = Math.hypot(b.x - 150, b.y - 150);

    if (distA >= 128) {
        gameData.gameState = 'lobby';
        gameData.scores.teamB++;
        const winName = gameData.captainB ? gameData.captainB.username : "Blue Spinner";
        recordWin(winName + " (🔵 Team B)", '🌀', gameData.captainB ? gameData.captainB.username : null);
        io.emit('syncGame', gameData);
    } else if (distB >= 128) {
        gameData.gameState = 'lobby';
        gameData.scores.teamA++;
        const winName = gameData.captainA ? gameData.captainA.username : "Red Spinner";
        recordWin(winName + " (🔴 Team A)", '🌀', gameData.captainA ? gameData.captainA.username : null);
        io.emit('syncGame', gameData);
    } else {
        io.emit('spinnerTick', gameData.spinner);
    }
}, 33);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Sammu Games Running on Port ' + PORT));
