module.exports = function initSammuVerseVoice(app, io, helpers) {
    const { getCoins, launchServerWordImposter, triggerServerAnimeQuiz } = helpers;
    const svMemory = new Map();

    async function fetchAllKnowingAnswer(query, sender, history) {
        const gemKey = (process.env.GEMINI_API_KEY || '').trim();
        if (gemKey) {
            try {
                const ctrl = new AbortController();
                const t = setTimeout(() => ctrl.abort(), 7000);
                const sys = "You are SammuVerse, the original all-knowing Hinglish & English voice assistant of SammuGames. Reply in 1-3 short, friendly sentences under 240 chars suitable for voice speech.";
                const contents = [...history, { role: 'user', parts: [{ text: `[${sender}]: ${query}` }] }];
                const res = await fetch(`https://googleapis.com{gemKey}`, {
                    method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents, generationConfig: { maxOutputTokens: 250, temperature: 0.75 } })
                });
                clearTimeout(t);
                if (res.ok) {
                    const data = await res.json();
                    const ans = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (ans && ans.trim()) return ans.replace(/[*#_`~]/g, '').trim();
                }
            } catch (e) {}
        }

        const topic = query.replace(/^(who is|who was|what is|what are|tell me about|explain|define|kaun hai|kya hai|batao)\s+/i, '').replace(/[?!.]+$/, '').trim();
        try {
            const dRes = await fetch(`https://duckduckgo.com{encodeURIComponent(topic)}&format=json&no_html=1&skip_disambig=1`);
            if (dRes.ok) {
                const ddg = await dRes.json();
                if (ddg.AbstractText) return ddg.AbstractText.split('. ').slice(0, 2).join('. ') + '.';
                if (ddg.Answer) return String(ddg.Answer);
            }
        } catch (e) {}

        try {
            const sRes = await fetch(`https://wikipedia.org{encodeURIComponent(topic)}&format=json&srlimit=1`);
            if (sRes.ok) {
                const sData = await sRes.json();
                const hit = sData?.query?.search?.[0];
                if (hit && hit.title) {
                    const sumRes = await fetch(`https://wikipedia.org{encodeURIComponent(hit.title)}`);
                    if (sumRes.ok) {
                        const sum = await sumRes.json();
                        if (sum && sum.extract) return sum.extract.split('. ').slice(0, 2).join('. ') + '.';
                    }
                }
            }
        } catch (e) {}
        return null;
    }

    async function runSammuVerseCore(query, sender, srvId, socket) {
        const q = query.trim();
        const low = q.toLowerCase();

        const playMatch = q.match(/^(?:play|bajao|chalao|gaana|song)\s+(.+)/i);
        if (playMatch && playMatch[1]) {
            const songName = playMatch[1].trim();
            io.to(srvId).emit('svPlayMusic', { query: songName, by: sender, _serverId: srvId });
            return { text: `🎵 Playing **${songName}** for **${sender}**!`, speak: `Playing ${songName} for you, ${sender}` };
        }
        if (/^(stop song|stop music|pause music|gaana band)/i.test(low)) {
            io.to(srvId).emit('svStopMusic', { _serverId: srvId });
            return { text: `⏹️ Music stopped!`, speak: `Music stopped` };
        }
        if (/^(hi|hello|hlo|hey|namaste|kaise ho|kya haal|how are you|wassup|sup)\b/i.test(low)) {
            const reply = `Hello ${sender}! Main bilkul mast hoon! Batao aaj kya help karoon—koi song bajaoon, game start karoon, ya koi sawaal puchna hai?`;
            return { text: `🔵 ${reply}`, speak: reply };
        }
        if (/\b(who made you|tumhe kisne banaya|creator|owner)\b/i.test(low)) {
            return { text: `👑 Mujhe **Sammu & Samaksh** ne SammuGames Universe ke liye banaya hai!`, speak: `Mujhe Sammu aur Samaksh ne SammuGames Universe ke liye banaya hai!` };
        }
        if (/\b(time|samay|baje)\b/.test(low)) {
            const t = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
            return { text: `⏰ Abhi India mein **${t} IST** baj rahe hain, ${sender}!`, speak: `Abhi India mein ${t} baj rahe hain, ${sender}` };
        }
        if (/\b(date|day|tarikh|aaj)\b/.test(low)) {
            const d = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            return { text: `📅 Aaj **${d}** hai!`, speak: `Aaj ${d} hai` };
        }
        if (/^[0-9+\-*/().\s]+$/.test(q) && /[+\-*/]/.test(q)) {
            try {
                const ans = Function('"use strict";return (' + q + ')')();
                if (Number.isFinite(ans)) return { text: `🧮 **${q} = ${ans}**`, speak: `The answer is ${ans}` };
            } catch (e) {}
        }
        if (low.includes('water')) { socket.emit('openWaterIo'); return { text: `💧 Opening **Water.io**!`, speak: `Opening Water dot I O!` }; }
        if (low.includes('imposter')) { launchServerWordImposter(srvId); return { text: `🕵️ Launching **Word Imposter**!`, speak: `Launching Word Imposter!` }; }
        if (low.includes('mafia')) { socket.onevent({ type: 2, nsp: '/', data: ['chatMessage', '!mafia'] }); return { text: `🔪 Launching **Mafia Party**!`, speak: `Launching Mafia Party!` }; }
        if (low.includes('dragon') || low.includes('boss')) { socket.onevent({ type: 2, nsp: '/', data: ['chatMessage', '!boss'] }); return { text: `🐉 Summoning **Shadow Dragon Raid**!`, speak: `Summoning Shadow Dragon Raid!` }; }
        if (low.includes('heist') || low.includes('bank')) { socket.onevent({ type: 2, nsp: '/', data: ['chatMessage', '!heist'] }); return { text: `🏦 Launching **Mega Bank Heist**!`, speak: `Launching Mega Bank Heist!` }; }
        if (low.includes('coins') || low.includes('balance')) {
            const bal = getCoins(sender);
            return { text: `🪙 **${sender}**, tumhare paas **${bal.toLocaleString()} Coins** hain!`, speak: `${sender}, you have ${bal} coins.` };
        }

        if (!svMemory.has(srvId)) svMemory.set(srvId, []);
        const hist = svMemory.get(srvId);
        const knowledge = await fetchAllKnowingAnswer(q, sender, hist);
        if (knowledge) {
            hist.push({ role: 'user', parts: [{ text: q }] }, { role: 'model', parts: [{ text: knowledge }] });
            while (hist.length > 8) hist.shift();
            return { text: `🔵 ${knowledge}`, speak: knowledge };
        }
        return { text: `🔵 **${sender}**, bolo: *"SammuVerse play Kesariya"*, *"SammuVerse who is Goku"*, ya *"SammuVerse time kya hua hai"*!`, speak: `${sender}, ask me anything, or say SammuVerse play a song!` };
    }

    const svMusicMiddleware = async (req, res, next) => {
        const cleanPath = (req.originalUrl || req.url || '').split('?')[0].toLowerCase();
        if (cleanPath !== '/sv-music') return next();
        const q = String(req.query.q || '').trim();
        if (!q) return res.json({ url: null });

        for (const apiUrl of [
            `https://saavn.dev{encodeURIComponent(q)}&limit=1`,
            `https://vercel.app{encodeURIComponent(q)}&limit=1`
        ]) {
            try {
                const ctrl = new AbortController();
                const timer = setTimeout(() => ctrl.abort(), 4500);
                const r = await fetch(apiUrl, { signal: ctrl.signal });
                clearTimeout(timer);
                if (!r.ok) continue;
                const j = await r.json();
                const song = j?.data?.results?.[0] || j?.results?.[0];
                const urls = song?.downloadUrl || [];
                const best = urls[urls.length - 1] || urls[0];
                const streamUrl = best?.url || best?.link;
                if (streamUrl) return res.json({ url: streamUrl, title: song?.name || q });
            } catch (e) {}
        }

        try {
            const itRes = await fetch(`https://apple.com{encodeURIComponent(q)}&media=music&limit=1`);
            if (itRes.ok) {
                const itData = await itRes.json();
                const track = itData?.results?.[0];
                if (track && track.previewUrl) return res.json({ url: track.previewUrl, title: `${track.trackName} - ${track.artistName}` });
            }
        } catch (e) {}
        return res.json({ url: null });
    };

    app.use(svMusicMiddleware);
    const svMStack = (app._router && app._router.stack) || (app.router && app.router.stack);
    if (Array.isArray(svMStack)) {
        const idx = svMStack.findIndex(l => l && l.handle === svMusicMiddleware);
        if (idx > 0) { const [layer] = svMStack.splice(idx, 1); svMStack.unshift(layer); }
    }

    io.on('connection', (socket) => {
        socket.on('chatMessage', async (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            if (typeof raw !== 'string') return;
            const trimmed = raw.trim();
            const sender = (typeof payload === 'object' && payload?.username) || socket.username || 'Player';
            const room = (typeof payload === 'object' && payload?.serverId) || socket.activeServerId || 'srv_samaksh';

            const svMatch = trimmed.match(/^!?sammu\s*verse[\s,]+(.+)/i);
            if (svMatch && svMatch[1]) {
                const res = await runSammuVerseCore(svMatch[1], sender, room, socket);
                io.to(room).emit('message', { username: "🔵 SammuVerse", text: `**@${sender}:** ${res.text}`, _serverId: room });
                io.to(room).emit('sammuVerseSpeak', { text: res.speak, _serverId: room });
            }
        });
    });
};
