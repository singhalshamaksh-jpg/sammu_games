const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

io.engine.pingTimeout = 60000;
io.engine.pingInterval = 25000;

let players = [];
let hostId = null;
let hostUsername = null;
let sessionMemory = {};
let drawTimer = null, bombTimer = null, memoryTimer = null;
let spinnerEnded = false;

const ADMIN_SECRET_KEY = "#bhaicharaontop";

let botMemory = {
    lastWinner: null,
    winStreaks: {},
    playerPoints: {},
    trophies: {},
    activeQuiz: null,
    activeRiddle: null,
    activeTask: null,
    chatCount: 0
};
const gifLibrary = {
    fire: "🔥|ON FIRE!|pulse", gg: "🎉|GOOD GAME!|bounce", cry: "😭|CRYING HARD|shake",
    dance: "💃|VICTORY DANCE|spin", win: "🏆|CHAMPION!|bounce", clown: "🤡|CLOWN MOMENT|shake",
    sus: "👀|VERY SUS...|pulse", hype: "⚡|MAX HYPE!|bounce", savage: "😎|THUG LIFE SAVAGE|pulse",
    bye: "👋|BYE BYE!|shake", roast: "🧯|EMOTIONAL DAMAGE|shake", noob: "💀|TOTAL NOOB|spin",
    laugh: "😂|LMAOOO!|bounce", shock: "😱|WHAT?!|shake", love: "❤️|MUCH LOVE!|pulse",
    bro: "🤜|MY BRO!|bounce", chad: "🗿|GIGA CHAD|pulse", sigma: "🐺|SIGMA RULE|pulse",
    rip: "🪦|REST IN PEACE|shake", boom: "💥|KABOOM!|pulse", goat: "🐐|THE G.O.A.T|bounce",
    king: "👑|BOW TO THE KING|bounce", queen: "👸|SLAY QUEEN|bounce", flex: "💪|WEIRD FLEX|pulse",
    sleep: "😴|BORING... ZZZ|shake", hungry: "🍔|NEED FOOD NOW|bounce", party: "🥳|PARTY TIME!|spin",
    rich: "💸|PAISA HI PAISA|bounce", fast: "🏎️|TOO FAST!|pulse", slow: "🐢|SOOO SLOW|shake",
    brain: "🧠|BIG BRAIN TIME|pulse", dumb: "🤪|ZERO IQ MOMENT|spin", angry: "🤬|RAGE MODE!|shake",
    cool: "🧊|ICE COLD|pulse", facepalm: "🤦|BRO REALLY?!|shake", salute: "🫡|RESPECT!|bounce",
    magic: "🪄|PURE MAGIC|spin", ghost: "👻|BOO! GHOSTED|pulse", ninja: "🥷|STEALTH NINJA|spin",
    alien: "👽|OUT OF THIS WORLD|spin", lion: "🦁|KING OF JUNGLE|pulse", robot: "🤖|BEEP BOOP AI|bounce",
    pizza: "🍕|PIZZA PARTY|spin", trophy: "🏅|MVP WINNER|bounce", rocket: "🚀|TO THE MOON!|bounce",
    heart: "💖|DIL SE LOVE|pulse", star: "🌟|SUPERSTAR!|spin", lightning: "⚡|THUNDER STRIKE|pulse",
    peace: "✌️|PEACE OUT!|bounce", hello: "👋|NAMASTE BRO!|bounce"
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
    { text: "⚡ TASK: Name 3 ANIMALS starting with letter C! (e.g., Cat, Cow, Cheetah)", letter: "c", count: 3 },
    { text: "⚡ TASK: Name 4 COUNTRIES starting with letter A! (Separate with commas or spaces)", letter: "a", count: 4 },
    { text: "⚡ TASK: Name 4 COUNTRIES starting with letter I!", letter: "i", count: 4 },
    { text: "⚡ TASK: Name 3 ANIMALS starting with letter B!", letter: "b", count: 3 },
    { text: "⚡ TASK: Name 3 FRUITS starting with letter M!", letter: "m", count: 3 },
    { text: "⚡ TASK: Name 3 FRUITS starting with letter P!", letter: "p", count: 3 },
    { text: "⚡ TASK: Name 4 COLORS starting with letter B!", letter: "b", count: 4 },
    { text: "⚡ TASK: Name 3 CITIES starting with letter D!", letter: "d", count: 3 },
    { text: "⚡ TASK: Name 3 CITIES starting with letter M!", letter: "m", count: 3 },
    { text: "⚡ TASK: Name 5 MOBILE APPS you use! (Any letters, separate with commas/spaces)", letter: null, count: 5 },
    { text: "⚡ TASK: Name 4 ACTORS or ACTRESSES! (Any letters, separate with commas/spaces)", letter: null, count: 4 },
    { text: "⚡ TASK: Name 4 CRICKETERS or FOOTBALLERS! (Any letters)", letter: null, count: 4 },
    { text: "⚡ TASK: Name 4 MOVIES or WEB SERIES! (Any letters)", letter: null, count: 4 },
    { text: "⚡ TASK: Name 4 FOODS or SNACKS! (Any letters)", letter: null, count: 4 },
    { text: "⚡ TASK: Name 4 BOYS or GIRLS NAMES starting with letter R!", letter: "r", count: 4 }
];

const roastBank = [
    "bro plays like his Wi-Fi is running on a potato! 🥔📶",
    "even a blindfolded bot has better reflexes than you! 💀",
    "bro talks big in chat and loses in 2 seconds flat! 🤡",
    "is proof that participation trophies exist! 🏅😂",
    "needs a tutorial just to press the TAP button! 🔥"
];

const truthBank = [
    "TRUTH: Who in this lobby do you think is the easiest to beat? 👀",
    "TRUTH: What is the funniest excuse you ever gave after losing a game? 😂",
    "TRUTH: Have you ever rage-quit a game before? Be honest! 💀",
    "TRUTH: Who is your favorite teammate in this room right now? 🤝"
];

const dareBank = [
    "DARE: Send '/gif clown' in chat and type 'I am the lobby noob'! 🤡",
    "DARE: Type the next 3 chat messages in ALL CAPS! 📢",
    "DARE: Hype up the opposite team captain in chat right now! 🔥",
    "DARE: Challenge anyone in the room to a 1v1 in the next arena! ⚔️"
];
function awardTrophy(username, trophyLabel) {
    if (!username) return;
    if (!botMemory.trophies[username]) botMemory.trophies[username] = [];
    if (!botMemory.trophies[username].includes(trophyLabel)) {
        botMemory.trophies[username].push(trophyLabel);
        setTimeout(() => {
            io.emit('message', {
                username: "Sammu's Bot",
                text: `🎖️ **TROPHY UNLOCKED!** **${username}** just earned **${trophyLabel}**!`
            });
        }, 400);
    }
}

function addMVPPoints(username, pts) {
    if (!username) return;
    botMemory.playerPoints[username] = (botMemory.playerPoints[username] || 0) + pts;
    if (botMemory.playerPoints[username] >= 10) awardTrophy(username, "👑 Arena Legend");
    broadcastMVP();
}

function broadcastMVP() {
    const board = Object.entries(botMemory.playerPoints)
        .map(([name, pts]) => ({
            name,
            pts,
            trophies: (botMemory.trophies[name] || []).join(' ')
        }))
        .sort((a, b) => b.pts - a.pts);
    io.emit('updateMVP', { board, trophies: botMemory.trophies });
}

function checkTaskSubmission(msg, taskObj) {
    if (!taskObj) return false;
    const rawItems = msg.includes(',') ? msg.split(',') : msg.trim().split(/\s+/);
    const uniqueValid = new Set();
    rawItems.forEach(item => {
        const clean = item.toLowerCase().replace(/[^a-z]/g, '');
        if (clean.length >= 2) {
            if (!taskObj.letter || clean.startsWith(taskObj.letter)) {
                uniqueValid.add(clean);
            }
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
    const streak = botMemory.winStreaks[senderName] || 0;

    if (m.includes('flip') || m.includes('toss') || m.includes('coin')) {
        return `🪙 Flipping virtual coin... It landed on **${Math.random() < 0.5 ? 'HEADS 👑' : 'TAILS 🔥'}**!`;
    }
    if (m.includes('dice') || m.includes('roll')) {
        return `🎲 Rolled a **${Math.floor(Math.random() * 6) + 1}** for ${senderName}!`;
    }
    if (m.includes('joke') || m.includes('funny') || m.includes('hasao')) {
        return pick([
            `😂 Why did the gamer bring a ladder to the lobby? Because he wanted to reach the next level!`,
            `🤣 Ek player ne bola 'Main pro hoon', phir 1 second mein Bomb Pass mein phat gaya! 💣💀`
        ]);
    }
    if (m.includes('who am i') || m.includes('my stats') || m.includes('mera score')) {
        const tr = (botMemory.trophies[senderName] || []).join(', ') || 'None yet';
        return `📊 **${senderName}'s Profile:** ${pts} MVP pts | 🔥 Streak: ${streak} | 🏆 Trophies: ${tr}`;
    }
    if (m.includes('kaisa') || m.includes('haal') || m.includes('how are you') || m.includes('how r u') || m.includes('wassup') || m.includes('sup')) {
        const status = botMemory.lastWinner ? `Still hyped watching **${botMemory.lastWinner}** dominate earlier!` : `Ready to drop tasks, quizzes, or referee all 15 arenas!`;
        return `Mast ekdum ${senderName} bro! 😎⚡ ${status} Tum batao, aaj kaun jeetega?`;
    }
    if (m.includes('hi') || m.includes('hello') || m.includes('hey') || m.includes('namaste') || m.includes('yo') || m.includes('bro')) {
        return pick([
            `Yo ${senderName} bro! 👋 You've got ${pts} MVP pts. Try **!task**, **!quiz**, **!riddle**, **!roast**, or **/gif savage**! 🔥`,
            `Sup ${senderName}! 🤖 Sammu's AI Bot online! Ask me anything, type **!truth**, **!dare**, or **!gifs** for 50 GIFs!`
        ]);
    }
    if (m.includes('who is winning') || m.includes('score') || m.includes('winning') || m.includes('jeet')) {
        if (scores.teamA > scores.teamB) return `🔴 Team A is leading **${scores.teamA} - ${scores.teamB}**! Blue Team, comeback kab hoga? 👀`;
        if (scores.teamB > scores.teamA) return `🔵 Team B is ahead **${scores.teamB} - ${scores.teamA}**! Red Team, wake up bro! 🔥`;
        return `Tied at **${scores.teamA} - ${scores.teamB}**! Next match decides who's the real boss! ⚔️`;
    }
    if (m.includes('help') || m.includes('commands')) {
        return `🤖 **Bot Commands:** \`!task\`, \`!quiz\`, \`!riddle\`, \`!hint\`, \`!roast @name\`, \`!truth\`, \`!dare\`, \`!8ball\`, \`!trophies\`, \`!gifs\` (50 GIFs)!`;
    }
    return pick([
        `100% agree ${senderName} bro! 😎 With ${playerList.length} players in the lobby, let's run **!task** or **!quiz**!`,
        `Haha sahi bola ${senderName}! 🤖 Try **!roast**, **!truth**, **!dare**, or ask me **!8ball will I win?** 🎱`,
        `I'm watching everything in this chat, ${senderName}! 👀 Type **!trophies** to see who owns the Virtual Trophies! 🏆`
    ]);
}
let gameData = {
    captainA: null, captainB: null, teamA: [], teamB: [],
    fighterA: null, fighterB: null, tttBoard: Array(9).fill(null), tttTurn: null,
    sumoPosition: 50,
    spinner: { a: { x: 80, y: 130, vx: 0, vy: 0 }, b: { x: 180, y: 130, vx: 0, vy: 0 } },
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
        const finalizedName = (data && data.username && data.username.trim()) ? data.username.trim() : "Player_" + Math.floor(Math.random() * 900 + 100);
        const finalizedAvatar = (data && data.avatar) ? data.avatar : "🥷";
        const isReconnect = Boolean(data && data.isReconnect);
        const wasInRoom = players.some(p => p.username.toLowerCase() === finalizedName.toLowerCase());

        socket.username = finalizedName;
        socket.avatar = finalizedAvatar;
        sessionMemory[socket.id] = { username: finalizedName, avatar: finalizedAvatar };

        if (hostUsername && hostUsername.toLowerCase() === finalizedName.toLowerCase()) {
            hostId = socket.id;
        } else if (players.length === 0) {
            hostId = socket.id;
            hostUsername = finalizedName;
        }

        players = players.filter(p => p.id !== socket.id && p.username.toLowerCase() !== finalizedName.toLowerCase());
        const isHost = (socket.id === hostId);
        if (isHost) hostUsername = finalizedName;

        players.push({ id: socket.id, username: finalizedName, avatar: finalizedAvatar, isHost });

        socket.emit('initRole', { isHost, gameData });
        io.emit('updatePlayers', players);
        io.emit('syncGame', gameData);
        broadcastMVP();

        if (!isReconnect && !wasInRoom) {
            io.emit('message', { username: "Sammu's Bot", text: `✨ Yo ${finalizedAvatar} **${finalizedName}** joined! Type \`!task\`, \`!quiz\`, \`!riddle\`, \`!gifs\` (50 GIFs), or chat with me bro! 🤖` });
        }
    });

    socket.on('chatMessage', (payload) => {
        const rawText = (typeof payload === 'object' && payload !== null) ? payload.text : payload;
        const backupName = (typeof payload === 'object' && payload !== null && payload.username) ? payload.username.trim() : null;
        const backupAvatar = (typeof payload === 'object' && payload !== null && payload.avatar) ? payload.avatar : "🥷";

        if (!rawText || typeof rawText !== 'string') return;

        let senderName = (sessionMemory[socket.id] && sessionMemory[socket.id].username) || socket.username || backupName || "Player_" + socket.id.slice(0, 4);

        if (!sessionMemory[socket.id] || !players.some(p => p.id === socket.id)) {
            socket.username = senderName;
            socket.avatar = backupAvatar;
            sessionMemory[socket.id] = { username: senderName, avatar: backupAvatar };
            const isHost = (hostUsername && hostUsername.toLowerCase() === senderName.toLowerCase());
            if (isHost) hostId = socket.id;
            players = players.filter(p => p.id !== socket.id && p.username.toLowerCase() !== senderName.toLowerCase());
            players.push({ id: socket.id, username: senderName, avatar: backupAvatar, isHost });
            io.emit('updatePlayers', players);
        }

        const msg = rawText;
        const cleanMsg = msg.trim(), lowerMsg = cleanMsg.toLowerCase();

        if (cleanMsg === ADMIN_SECRET_KEY) {
            hostId = socket.id;
            hostUsername = senderName;
            players = players.map(p => ({ ...p, isHost: p.id === hostId }));
            socket.emit('initRole', { isHost: true, gameData });
            io.emit('updatePlayers', players); io.emit('syncGame', gameData);
            io.emit('message', { username: 'SYSTEM', text: `${senderName} has unlocked Host Admin Panel! 👑` });
            return;
        }

        if (lowerMsg.startsWith('/gif')) {
            const key = lowerMsg.replace('/gif', '').trim() || 'fire';
            const gifUrl = gifLibrary[key] || gifLibrary.fire;
            io.emit('message', { senderId: socket.id, username: senderName, text: key.toUpperCase(), gifUrl });
            return;
        }

        io.emit('message', { senderId: socket.id, username: senderName, text: msg });
        botMemory.chatCount++;
        const mathAns = solveAnyMath(cleanMsg);
        if (mathAns !== null) {
            setTimeout(() => {
                io.emit('message', { username: "Sammu's Bot", text: `🧮 Easy math, ${senderName}! **${cleanMsg} = ${mathAns}** ⚡` });
            }, 300);
            return;
        }

        if (botMemory.activeTask && checkTaskSubmission(cleanMsg, botMemory.activeTask)) {
            botMemory.activeTask = null;
            addMVPPoints(senderName, 2);
            awardTrophy(senderName, "⚡ Task King");
            if (gameData.captainA && gameData.captainA.username === senderName) { gameData.scores.teamA++; io.emit('syncGame', gameData); }
            else if (gameData.captainB && gameData.captainB.username === senderName) { gameData.scores.teamB++; io.emit('syncGame', gameData); }
            setTimeout(() => {
                io.emit('message', { username: "Sammu's Bot", text: `🔥 **TASK CRUSHED** by **${senderName}**! +2 MVP Points! 🏆` });
            }, 300);
            return;
        }

        if (botMemory.activeQuiz && lowerMsg.includes(botMemory.activeQuiz.a)) {
            const solvedAns = botMemory.activeQuiz.a.toUpperCase();
            botMemory.activeQuiz = null;
            addMVPPoints(senderName, 1);
            awardTrophy(senderName, "🧠 Quiz Master");
            setTimeout(() => {
                io.emit('message', { username: "Sammu's Bot", text: `🎉 **BINGO!** **${senderName}** solved it (**${solvedAns}**)! +1 MVP Point! 🏆` });
            }, 300);
            return;
        }

        if (botMemory.activeRiddle && lowerMsg.includes(botMemory.activeRiddle.a)) {
            const solvedAns = botMemory.activeRiddle.a.toUpperCase();
            botMemory.activeRiddle = null;
            addMVPPoints(senderName, 1);
            awardTrophy(senderName, "❓ Riddle Solver");
            setTimeout(() => {
                io.emit('message', { username: "Sammu's Bot", text: `🧠 **GENIUS!** **${senderName}** cracked the riddle (**${solvedAns}**)! +1 MVP Point! 🏆` });
            }, 300);
            return;
        }

        if (lowerMsg === '!task') {
            const chosen = botTasks[Math.floor(Math.random() * botTasks.length)];
            botMemory.activeTask = chosen;
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: chosen.text }), 300);
        } else if (lowerMsg === '!quiz') {
            const chosen = quizBank[Math.floor(Math.random() * quizBank.length)];
            botMemory.activeQuiz = chosen;
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `${chosen.q} *(Type the answer or \`!hint\`!)*` }), 300);
        } else if (lowerMsg === '!riddle') {
            const chosen = riddleBank[Math.floor(Math.random() * riddleBank.length)];
            botMemory.activeRiddle = chosen;
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `${chosen.q} *(Type the answer or \`!hint\`!)*` }), 300);
        } else if (lowerMsg === '!hint') {
            const active = botMemory.activeQuiz || botMemory.activeRiddle;
            const hintMsg = active ? `💡 **HINT:** Starts with **"${active.a[0].toUpperCase()}"** and has **${active.a.length} letters**!` : `💡 No active quiz or riddle right now! Type \`!quiz\` or \`!riddle\` first!`;
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: hintMsg }), 250);
        } else if (lowerMsg.startsWith('!roast')) {
            const target = cleanMsg.replace(/!roast/i, '').replace('@', '').trim() || senderName;
            const line = roastBank[Math.floor(Math.random() * roastBank.length)];
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `🔥 **${target}** ${line}` }), 300);
        } else if (lowerMsg === '!truth') {
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: truthBank[Math.floor(Math.random() * truthBank.length)] }), 300);
        } else if (lowerMsg === '!dare') {
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: dareBank[Math.floor(Math.random() * dareBank.length)] }), 300);
        } else if (lowerMsg.startsWith('!8ball')) {
            const answers = ["100% Pakka Yes! ✅", "Without a doubt bro! 🔥", "Ask again later... 🤔", "Sapne mat dekh 💀", "No chance! ❌", "Signs point to YES! 🎯"];
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `🎱 ${answers[Math.floor(Math.random() * answers.length)]}` }), 300);
        } else if (lowerMsg === '!gifs') {
            const list = Object.keys(gifLibrary).map(k => `/gif ${k}`).join(', ');
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `🎬 **50 Animated GIFs:** ${list}` }), 250);
        } else if (lowerMsg === '!trophies' || lowerMsg === '!mvp') {
            const top = Object.entries(botMemory.playerPoints).sort((a, b) => b[1] - a[1]).slice(0, 5);
            const summary = top.length ? top.map(([n, p], i) => `#${i + 1} **${n}** (${p} pts ${(botMemory.trophies[n] || []).join(' ')})`).join(' | ') : "No trophies yet! Win an arena or solve !quiz / !task!";
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `🏆 **TROPHY & MVP HALL:** ${summary}` }), 250);
        } else if (lowerMsg.includes('sammu') || lowerMsg.includes('bot') || lowerMsg.includes('bro') || lowerMsg.startsWith('ai ') || cleanMsg.endsWith('?')) {
            const reply = thinkAndReply(senderName, cleanMsg, gameData.scores, players);
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: reply }), 400);
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

    function recordWin(winnerName, icon, mvpUsername, customTrophy) {
        botMemory.lastWinner = winnerName;
        if (mvpUsername) {
            botMemory.winStreaks[mvpUsername] = (botMemory.winStreaks[mvpUsername] || 0) + 1;
            Object.keys(botMemory.winStreaks).forEach(k => { if (k !== mvpUsername) botMemory.winStreaks[k] = 0; });
            addMVPPoints(mvpUsername, 3);
            awardTrophy(mvpUsername, customTrophy || "🏆 Arena Champ");
            if (botMemory.winStreaks[mvpUsername] >= 3) awardTrophy(mvpUsername, "🔥 3x Win Streak");
        }
        io.emit('announceWinner', { winner: winnerName, icon });
        const streakNote = (mvpUsername && botMemory.winStreaks[mvpUsername] >= 2) ? ` (**${botMemory.winStreaks[mvpUsername]}x WIN STREAK!** 🔥)` : '';
        setTimeout(() => {
            io.emit('message', { username: "Sammu's Bot", text: `🏆 **${winnerName}** wins the match (+3 MVP pts)${streakNote}! Who wants the next smoke? 👀` });
        }, 500);
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
            recordWin(name, '⚔️', name, "⚔️ TTT Master"); gameData.gameState = 'lobby';
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
        if (gameData.sumoPosition <= 10) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (🔴 Team A)", '🏆', gameData.captainA.username, "🤼 Sumo King"); gameData.gameState = 'lobby'; }
        else if (gameData.sumoPosition >= 90) { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (🔵 Team B)", '🏆', gameData.captainB.username, "🤼 Sumo King"); gameData.gameState = 'lobby'; }
        io.emit('syncGame', gameData);
    });

    socket.on('launchSpinner', () => {
        if (socket.id !== hostId || !gameData.captainA || !gameData.captainB) return;
        clearAllTimers();
        spinnerEnded = false;
        gameData.gameState = 'spinner';
        gameData.spinner = { a: { x: 80, y: 130, vx: 0, vy: 0 }, b: { x: 180, y: 130, vx: 0, vy: 0 } };
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
            if (isA) { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Opponent fouled!)", '🤠', gameData.captainB.username, "🤠 Quick-Draw Ace"); }
            else { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Opponent fouled!)", '🤠', gameData.captainA.username, "🤠 Quick-Draw Ace"); }
        } else {
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Fastest Draw!)", '🔫', gameData.captainA.username, "🤠 Quick-Draw Ace"); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Fastest Draw!)", '🔫', gameData.captainB.username, "🤠 Quick-Draw Ace"); }
        }
        gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
    });

    socket.on('launchMath', () => { if (socket.id === hostId && gameData.captainA && gameData.captainB) { clearAllTimers(); gameData.gameState = 'math'; gameData.mathQ = generateMath(); io.emit('syncGame', gameData); } });
    socket.on('submitMath', (val) => {
        if (gameData.gameState !== 'math') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if ((isA || isB) && Number(val) === gameData.mathQ.answer) {
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (🔴 Team A)", '🧠', gameData.captainA.username, "🧮 Math Genius"); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (🔵 Team B)", '🧠', gameData.captainB.username, "🧮 Math Genius"); }
            gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
        }
    });

    socket.on('launchBomb', () => {
        if (socket.id !== hostId || !gameData.captainA || !gameData.captainB) return;
        clearAllTimers(); gameData.gameState = 'bomb'; gameData.bombHolder = Math.random() < 0.5 ? gameData.captainA.id : gameData.captainB.id; io.emit('syncGame', gameData);
        bombTimer = setTimeout(() => {
            if (gameData.gameState !== 'bomb') return;
            if (gameData.bombHolder === gameData.captainA.id) { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Bomb exploded on Red! 💥)", '💣', gameData.captainB.username, "💣 Bomb Survivor"); }
            else { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Bomb exploded on Blue! 💥)", '💣', gameData.captainA.username, "💣 Bomb Survivor"); }
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
        spinnerEnded = false;
        gameData = { captainA: null, captainB: null, teamA: [], teamB: [], fighterA: null, fighterB: null, tttBoard: Array(9).fill(null), tttTurn: null, sumoPosition: 50, spinner: { a: { x: 80, y: 130, vx: 0, vy: 0 }, b: { x: 180, y: 130, vx: 0, vy: 0 } }, drawReady: false, mathQ: { question: '', options: [], answer: 0 }, bombHolder: null, rpsChoices: { a: null, b: null }, memoryGrid: [], memoryTarget: '', memoryHidden: false, tugPosition: 50, colorTrap: null, scrambleWord: '', scrambleAnswer: '', diceRolls: { a: null, b: null }, penaltyPicks: { shooter: null, keeper: null }, typingPhrase: '', treasureGrid: [], scores: gameData.scores, gameState: 'lobby' };
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
    try {
        if (gameData.gameState !== 'spinner') {
            spinnerEnded = false;
            return;
        }
        if (spinnerEnded || !gameData.spinner || !gameData.spinner.a || !gameData.spinner.b) return;

        const a = gameData.spinner.a, b = gameData.spinner.b;
        a.x += a.vx; a.y += a.vy; a.vx *= 0.88; a.vy *= 0.88;
        b.x += b.vx; b.y += b.vy; b.vx *= 0.88; b.vy *= 0.88;

        const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
        if (dist < 40) {
            const nx = dist > 0 ? dx / dist : 1;
            const ny = dist > 0 ? dy / dist : 0;
            const overlap = 40 - dist;
            a.x -= nx * (overlap / 2); a.y -= ny * (overlap / 2);
            b.x += nx * (overlap / 2); b.y += ny * (overlap / 2);
            a.vx -= nx * 11; a.vy -= ny * 11;
            b.vx += nx * 11; b.vy += ny * 11;
        }

        const distA = Math.hypot(a.x - 130, a.y - 130);
        const distB = Math.hypot(b.x - 130, b.y - 130);

        if (distA >= 106 || distB >= 106) {
            spinnerEnded = true;
            gameData.gameState = 'lobby';
            const capAName = gameData.captainA ? gameData.captainA.username : "Red Spinner";
            const capBName = gameData.captainB ? gameData.captainB.username : "Blue Spinner";

            if (distA >= distB) {
                gameData.scores.teamB++;
                recordWin(capBName + " (🔵 Team B)", '🌀', capBName, "🌀 Spinner Pro");
            } else {
                gameData.scores.teamA++;
                recordWin(capAName + " (🔴 Team A)", '🌀', capAName, "🌀 Spinner Pro");
            }
            io.emit('syncGame', gameData);
        } else {
            io.emit('spinnerTick', gameData.spinner);
        }
    } catch (err) {
        console.error("Spinner tick error:", err);
        gameData.gameState = 'lobby';
        io.emit('syncGame', gameData);
    }
}, 33);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Sammu Games Running on Port ' + PORT));
