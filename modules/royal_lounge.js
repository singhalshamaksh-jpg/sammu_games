module.exports = function(ctx) {
    let { app, io, fs, path, serversDB, saveDB, OG_HOSTS, MASTER_KEYS, lockedOGSignatures, verifyOGHostTripleLock, arenas, getArena, syncArenaPlayers, IMPOSTER_WORDS, EXTRA_ANIME_QUIZ } = ctx;
    const getFullRoomPlayers = (srvId) => ctx.getFullRoomPlayers(srvId);
    const getCoins = (u) => ctx.getCoins(u);
    const addCoins = (u, a) => ctx.addCoins(u, a);
    const playerWallet = ctx.playerWallet;
    const playerCards = ctx.playerCards;

    // 🃏 ROYAL LOUNGE BACKEND — PIECE 1/3 (10-PLAYER UNO + SMART BOTS)
    // ============================================================================
    const unoByServer = new Map();
    const UNO_COLORS = ['red', 'blue', 'green', 'yellow'];

    function buildUnoDeck() {
        const deck = [];
        for (let copy = 0; copy < 2; copy++) {
            UNO_COLORS.forEach(c => {
                deck.push({ c, v: '0' });
                ['1','2','3','4','5','6','7','8','9','SKIP','REV','+2'].forEach(v => {
                    deck.push({ c, v });
                    deck.push({ c, v });
                });
            });
            for (let i = 0; i < 4; i++) {
                deck.push({ c: 'wild', v: 'WILD' });
                deck.push({ c: 'wild', v: '+4' });
            }
        }
        return deck.sort(() => Math.random() - 0.5);
    }

    function drawUnoCards(st, count) {
        const out = [];
        for (let i = 0; i < count; i++) {
            if (st.deck.length === 0 && st.discard.length > 1) {
                const top = st.discard.pop();
                st.deck = st.discard.splice(0).map(x => ({
                    c: (x.v === 'WILD' || x.v === '+4') ? 'wild' : x.c,
                    v: x.v
                })).sort(() => Math.random() - 0.5);
                st.discard.push(top);
            }
            if (st.deck.length > 0) out.push(st.deck.pop());
        }
        return out;
    }

    function broadcastUno(srvId) {
        const st = unoByServer.get(srvId);
        if (!st) return;
        if (st.phase === 'lobby') {
            return io.to(srvId).emit('unoSync', {
                phase: 'lobby', timeLeft: st.timeLeft,
                players: st.players.map(p => ({ id: p.id, username: p.username, count: 0 })),
                _serverId: srvId
            });
        }
        const curPlayer = st.players[st.turnIdx];
        const summary = st.players.map((p, idx) => ({
            id: p.id, username: p.username, count: p.hand.length,
            isTurn: idx === st.turnIdx, saidUno: p.saidUno
        }));
        st.players.forEach(p => {
            if (p.isBot) return;
            io.to(p.id).emit('unoSync', {
                phase: 'play', timeLeft: st.timeLeft,
                topCard: st.discard[st.discard.length - 1], activeColor: st.activeColor,
                turnName: curPlayer ? curPlayer.username : '',
                isMyTurn: curPlayer && curPlayer.id === p.id,
                myHand: p.hand, saidUno: p.saidUno, players: summary, _serverId: srvId
            });
        });
    }

    function advanceUnoTurn(srvId, step = 1) {
        const st = unoByServer.get(srvId);
        if (!st || st.phase !== 'play') return;
        const n = st.players.length;
        st.turnIdx = ((st.turnIdx + (step * st.dir)) % n + n) % n;
        st.timeLeft = 20;
        broadcastUno(srvId);

        const cur = st.players[st.turnIdx];
        if (cur && cur.isBot) {
            setTimeout(() => {
                const live = unoByServer.get(srvId);
                if (!live || live.phase !== 'play') return;
                const bot = live.players[live.turnIdx];
                if (!bot || !bot.isBot) return;
                const top = live.discard[live.discard.length - 1];
                const vIdx = bot.hand.findIndex(c => c.c === 'wild' || c.c === live.activeColor || c.v === top.v);
                if (vIdx === -1) {
                    bot.hand.push(...drawUnoCards(live, 1));
                    return advanceUnoTurn(srvId, 1);
                }
                const [card] = bot.hand.splice(vIdx, 1);
                live.discard.push(card);
                live.activeColor = card.c === 'wild' ? UNO_COLORS[Math.floor(Math.random() * 4)] : card.c;
                if (bot.hand.length === 1) bot.saidUno = true;
                if (bot.hand.length === 0) {
                    clearInterval(live.interval);
                    unoByServer.delete(srvId);
                    io.to(srvId).emit('unoEnd', { _serverId: srvId });
                    return io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🤖🃏 **${bot.username}** won UNO!`, _serverId: srvId });
                }
                let s = 1;
                const np = live.players[((live.turnIdx + live.dir) % live.players.length + live.players.length) % live.players.length];
                if (card.v === 'REV') { if (live.players.length === 2) s = 2; else live.dir *= -1; }
                else if (card.v === 'SKIP') s = 2;
                else if (card.v === '+2' && np) { np.hand.push(...drawUnoCards(live, 2)); s = 2; }
                else if (card.v === '+4' && np) { np.hand.push(...drawUnoCards(live, 4)); s = 2; }
                advanceUnoTurn(srvId, s);
            }, 1000);
        }
    }

    function startUnoMatch(srvId) {
        const st = unoByServer.get(srvId);
        if (!st || st.phase !== 'lobby') return;
        if (st.players.length < 2) {
            clearInterval(st.interval);
            unoByServer.delete(srvId);
            io.to(srvId).emit('unoEnd', { _serverId: srvId });
            return io.to(srvId).emit('message', { username: "Sammu's Bot", text: '⚠️ Need at least 2 players (or +Bot) for UNO!', _serverId: srvId });
        }
        st.phase = 'play';
        st.deck = buildUnoDeck();
        st.players.forEach(p => { p.hand = drawUnoCards(st, 7); p.saidUno = false; });
                let first = drawUnoCards(st, 1)[0];
        while (first && first.c === 'wild') {
            st.deck.unshift(first);
            first = drawUnoCards(st, 1)[0];
        }
        st.discard = [first];
        st.activeColor = first.c;
        st.turnIdx = 0;
        st.dir = 1;
        st.timeLeft = 20;
        broadcastUno(srvId);
    }

     // ============================================================================
    // 🎲 ROYAL LOUNGE BACKEND — PIECE 2/3 (CHESS, CARROM, 6P LUDO, 6P SNAKES)
    // ============================================================================
    const loungeChessByServer  = new Map();
    const loungeCarromByServer = new Map();
    const loungeLudoByServer   = new Map();
    const loungeSnakesByServer = new Map();

    const LADDERS = { 4: 25, 13: 46, 33: 49, 42: 63, 50: 69, 62: 81, 74: 92 };
    const SNAKES  = { 27: 5, 40: 3, 43: 18, 54: 31, 66: 45, 76: 58, 89: 53, 99: 41 };

    function initChessBoard() {
        return [
            ['r','n','b','q','k','b','n','r'],
            ['p','p','p','p','p','p','p','p'],
            ['','','','','','','',''],['','','','','','','',''],
            ['','','','','','','',''],['','','','','','','',''],
            ['P','P','P','P','P','P','P','P'],
            ['R','N','B','Q','K','B','N','R']
        ];
    }

    function isValidChessMove(board, r1, c1, r2, c2, turnColor) {
        if (r1 === r2 && c1 === c2) return false;
        const p = board[r1]?.[c1], target = board[r2]?.[c2];
        if (!p) return false;
        const isWhite = p === p.toUpperCase();
        if ((turnColor === 'w') !== isWhite) return false;
        if (target && (target === target.toUpperCase()) === isWhite) return false;
        const dr = r2 - r1, dc = c2 - c1, adr = Math.abs(dr), adc = Math.abs(dc), type = p.toLowerCase();
        const clear = () => {
            const sr = Math.sign(dr), sc = Math.sign(dc);
            let r = r1 + sr, c = c1 + sc;
            while (r !== r2 || c !== c2) { if (board[r][c] !== '') return false; r += sr; c += sc; }
            return true;
        };
        if (type === 'p') {
            const dir = isWhite ? -1 : 1, start = isWhite ? 6 : 1;
            if (dc === 0 && target === '' && (dr === dir || (r1 === start && dr === 2 * dir && board[r1 + dir][c1] === ''))) return true;
            return adc === 1 && dr === dir && target !== '';
        }
        if (type === 'r') return (dr === 0 || dc === 0) && clear();
        if (type === 'b') return adr === adc && clear();
        if (type === 'q') return (dr === 0 || dc === 0 || adr === adc) && clear();
        if (type === 'n') return (adr === 2 && adc === 1) || (adr === 1 && adc === 2);
        if (type === 'k') return adr <= 1 && adc <= 1;
        return false;
    }
     // ============================================================================
    // 👑 ROYAL LOUNGE BACKEND — PIECE 3A/3 (UNO LISTENERS)
    // ============================================================================
    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof raw !== 'string' || raw.trim().toLowerCase() !== '!uno') return;
            if (unoByServer.has(srvId)) return broadcastUno(srvId);
            const st = {
                phase: 'lobby', timeLeft: 20,
                players: [{ id: socket.id, username: socket.username || 'Player', hand: [], saidUno: false }],
                deck: [], discard: [], activeColor: 'red', turnIdx: 0, dir: 1, interval: null
            };
            unoByServer.set(srvId, st);
            st.interval = setInterval(() => {
                const cur = unoByServer.get(srvId);
                if (!cur) return;
                cur.timeLeft--;
                if (cur.timeLeft <= 0) {
                    if (cur.phase === 'lobby') startUnoMatch(srvId);
                    else { const afk = cur.players[cur.turnIdx]; if (afk) afk.hand.push(...drawUnoCards(cur, 1)); advanceUnoTurn(srvId, 1); }
                } else broadcastUno(srvId);
            }, 1000);
            broadcastUno(srvId);
        });

        socket.on('unoJoin', () => {
            const st = unoByServer.get(socket.activeServerId);
            if (st && st.phase === 'lobby' && st.players.length < 10 && !st.players.some(p => p.id === socket.id)) {
                st.players.push({ id: socket.id, username: socket.username || 'Player', hand: [], saidUno: false });
                broadcastUno(socket.activeServerId);
            }
        });

        socket.on('unoAddBot', () => {
            const st = unoByServer.get(socket.activeServerId);
            if (st && st.phase === 'lobby' && st.players.length < 10) {
                const n = st.players.filter(p => p.isBot).length + 1;
                st.players.push({ id: 'BOT_' + n + '_' + Date.now(), username: `🤖 UNO Bot #${n}`, hand: [], saidUno: false, isBot: true });
                broadcastUno(socket.activeServerId);
            }
        });

        socket.on('unoForceStart', () => { startUnoMatch(socket.activeServerId); });

        socket.on('unoDrawCard', () => {
            const st = unoByServer.get(socket.activeServerId);
            const cur = st && st.players[st.turnIdx];
            if (st && st.phase === 'play' && cur && cur.id === socket.id) {
                cur.hand.push(...drawUnoCards(st, 1)); cur.saidUno = false;
                advanceUnoTurn(socket.activeServerId, 1);
            }
        });

        socket.on('unoCallShout', () => {
            const st = unoByServer.get(socket.activeServerId);
            const me = st && st.players.find(p => p.id === socket.id);
            if (me && me.hand.length <= 2) { me.saidUno = true; broadcastUno(socket.activeServerId); }
        });

        socket.on('unoPlayCard', ({ idx, chosenColor }) => {
            const srvId = socket.activeServerId, st = unoByServer.get(srvId);
            if (!st || st.phase !== 'play') return;
            const cur = st.players[st.turnIdx];
            if (!cur || cur.id !== socket.id) return;
            const card = cur.hand[idx], top = st.discard[st.discard.length - 1];
            if (!card || !(card.c === 'wild' || card.c === st.activeColor || card.v === top.v)) return;

            cur.hand.splice(idx, 1); st.discard.push(card);
            st.activeColor = (card.c === 'wild' && UNO_COLORS.includes(chosenColor)) ? chosenColor : card.c;
            if (cur.hand.length > 1) cur.saidUno = false;

            if (cur.hand.length === 0) {
                clearInterval(st.interval); unoByServer.delete(srvId);
                io.to(srvId).emit('unoEnd');
                addCoins(cur.username, 250);
                return io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🏆🃏 **UNO CHAMPION:** **${cur.username}** won **+250🪙**!`, _serverId: srvId });
            }
            let step = 1, n = st.players.length;
            const np = st.players[((st.turnIdx + st.dir) % n + n) % n];
            if (card.v === 'REV') { if (n === 2) step = 2; else st.dir *= -1; }
            else if (card.v === 'SKIP') step = 2;
            else if (card.v === '+2' && np) { np.hand.push(...drawUnoCards(st, 2)); step = 2; }
            else if (card.v === '+4' && np) { np.hand.push(...drawUnoCards(st, 4)); step = 2; }
            advanceUnoTurn(srvId, step);
        });
    });
      
        
           io.on('connection', (socket) => {
        // --- 6-PLAYER SNAKES & LADDERS ---
        socket.on('loungeStartSnakes', () => {
            const srvId = socket.activeServerId, players = getFullRoomPlayers(srvId);
            if (players.length < 2) return socket.emit('svNotice', '⚠️ Need 2–6 players for Snakes & Ladders!');
            const badges = ['🔴', '🔵', '🟢', '🟡', '🟣', '🟠'];
            const st = { players: players.slice(0, 6).map((p, i) => ({ id: p.id, username: p.username, badge: badges[i], pos: 1 })), turnIdx: 0, lastDice: null, lastNote: 'Race to Tile 100!', _serverId: srvId };
            loungeSnakesByServer.set(srvId, st); io.to(srvId).emit('snakesSync', st);
        });

        socket.on('loungeSnakesRoll', () => {
            const srvId = socket.activeServerId, st = loungeSnakesByServer.get(srvId);
            if (!st || st.players[st.turnIdx]?.id !== socket.id) return;
            const cur = st.players[st.turnIdx], dice = Math.floor(Math.random() * 6) + 1;
            st.lastDice = dice; let next = cur.pos + dice, note = `${cur.username} rolled ${dice}`;
            if (next > 100) { next = cur.pos; note += ' — needed exact roll!'; }
            else if (LADDERS[next]) { note += ` — 🪜 LADDER ${next}→${LADDERS[next]}!`; next = LADDERS[next]; }
            else if (SNAKES[next]) { note += ` — 🐍 SNAKE ${next}→${SNAKES[next]}!`; next = SNAKES[next]; }
            else note += ` → Tile ${next}`;
            cur.pos = next; st.lastNote = note;
            if (cur.pos === 100) {
                loungeSnakesByServer.delete(srvId); io.to(srvId).emit('snakesEnd'); addCoins(cur.username, 250);
                return io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🐍👑 **SNAKES & LADDERS WINNER:** **${cur.username}** hit 100 and won **+250🪙**!`, _serverId: srvId });
            }
            if (dice !== 6) st.turnIdx = (st.turnIdx + 1) % st.players.length;
            io.to(srvId).emit('snakesSync', st);
        });
    });
        // ============================================================================
    // ☁️ NATIVE HTTPS UPSTASH FIX (WORKS ON ALL NODE VERSIONS)
    // ============================================================================
    const https = require('https');
    upstashCmd = function(cmdArray) {
        return new Promise((resolve) => {
            if (!UPSTASH_URL || !UPSTASH_TOKEN) return resolve(null);
            try {
                const u = new URL(UPSTASH_URL);
                const body = JSON.stringify(cmdArray);
                const req = https.request({
                    hostname: u.hostname,
                    path: u.pathname === '/' ? '' : u.pathname,
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${UPSTASH_TOKEN}`,
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(body)
                    }
                }, (res) => {
                    let raw = '';
                    res.on('data', chunk => raw += chunk);
                    res.on('end', () => {
                        try {
                            const parsed = JSON.parse(raw);
                            if (parsed.error) console.error('Upstash Error:', parsed.error);
                            resolve(parsed && parsed.result !== undefined ? parsed.result : null);
                        } catch (e) { resolve(null); }
                    });
                });
                req.on('error', (err) => { console.error('Upstash Net Error:', err.message); resolve(null); });
                req.write(body);
                req.end();
            } catch (e) { resolve(null); }
        });
    };
    forcePullFromUpstash();
         // ============================================================================
    // 🚀 UPSTASH BANDWIDTH SAVER (CUTS 12GB -> <0.3GB/MONTH)
    // ============================================================================
    let _svDirty = false, _ecoDirty = false;
    const _rawSaveSvStats = saveSvStats;
    const _rawSaveEcoDB   = saveEconomyDB;

    saveSvStats = function() {
        try { fs.writeFileSync(SV_STATS_FILE, JSON.stringify(svPlayerStats, null, 2)); } catch (e) {}
        _svDirty = true;
    };

    saveEconomyDB = function() {
        try { fs.writeFileSync(ECONOMY_DB_FILE, JSON.stringify({ wallets: Object.fromEntries(playerWallet), cards: Object.fromEntries(playerCards) }, null, 2)); } catch (e) {}
        _ecoDirty = true;
    };

    setInterval(() => {
        if (!cloudRestoreCompleted) return;
        if (_svDirty) {
            _svDirty = false;
            upstashCmd(['SET', 'sammu_sv_stats', JSON.stringify(svPlayerStats)]);
        }
        if (_ecoDirty) {
            _ecoDirty = false;
            upstashCmd(['SET', 'sammu_economy', JSON.stringify({ wallets: Object.fromEntries(playerWallet), cards: Object.fromEntries(playerCards) })]);
        }
    }, 15000);
      // ============================================================================
    // 📺 /VERMAAD ON|OFF CREATOR COMMAND
    // ============================================================================
    let vermaAdEnabled = true;

    io.on('connection', (socket) => {
        socket.emit('vermaAdState', vermaAdEnabled);

        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            if (typeof raw !== 'string') return;
            const clean = raw.trim().toLowerCase();
            if (!clean.startsWith('/vermaad')) return;

            const u = (socket.username || '').toLowerCase();
            const isCreator = u.includes('samaksh') || u.includes('sammu') || (typeof verifiedCreators !== 'undefined' && verifiedCreators.has(u));
            if (!isCreator) return;

            const arg = clean.split(/\s+/)[1];
            if (arg === 'on') vermaAdEnabled = true;
            else if (arg === 'off') vermaAdEnabled = false;
            else vermaAdEnabled = !vermaAdEnabled;

            io.emit('vermaAdState', vermaAdEnabled);
            socket.emit('message', {
                username: "Sammu's Bot",
                text: `📺 **Verma Diary 18 Ad** is now **${vermaAdEnabled ? 'ON ✅' : 'OFF ❌'}** across all servers!`,
                _serverId: socket.activeServerId
            });
        });
    });
                   

};
