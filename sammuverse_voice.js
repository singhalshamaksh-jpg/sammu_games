module.exports = function initSammuVerseVoice(app, io, helpers) {
    const { launchServerWordImposter } = helpers;
    const svMemory = new Map();

    async function fetchAllKnowingAnswer(query, sender, history) {
        const gemKey = (process.env.GEMINI_API_KEY || '').trim();
        if (gemKey) {
            try {
                const ctrl = new AbortController();
                const t = setTimeout(() => ctrl.abort(), 7000);
                const sys = "You are SammuVerse, the original all-knowing Hinglish & English voice assistant of SammuGames. Reply in 2-3 short, friendly sentences under 260 chars suitable for natural voice speech.";
                const contents = [...history, { role: 'user', parts: [{ text: `[${sender}]: ${query}` }] }];
                const res = await fetch(`https://googleapis.com{gemKey}`, {
                    method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents, generationConfig: { maxOutputTokens: 260, temperature: 0.75 } })
                });
                clearTimeout(t);
                if (res.ok) {
                    const data = await res.json();
                    const cand = Array.isArray(data && data.candidates) ? data.candidates.at(0) : null;
                    const part = Array.isArray(cand && cand.content && cand.content.parts) ? cand.content.parts.at(0) : null;
                    if (part && part.text && part.text.trim()) return part.text.replace(/[*#_`~]/g, '').trim();
                }
            } catch (e) {}
        }

        const topic = query
            .replace(/^(who is|who was|what is|what are|tell me about|explain|define|how to make|recipe of|kaun hai|kya hai|batao|ki recipe)\s+/i, '')
            .replace(/\s+(ki recipe|kya hai|kaun hai)$/i, '')
            .replace(/[?!.]+$/, '')
            .trim();

        try {
            const dRes = await fetch(`https://duckduckgo.com{encodeURIComponent(topic)}&format=json&no_html=1&skip_disambig=1`);
            if (dRes.ok) {
                const ddg = await dRes.json();
                if (ddg.AbstractText) return ddg.AbstractText.split('. ').slice(0, 2).join('. ') + '.';
                if (ddg.Answer) return String(ddg.Answer);
            }
        } catch (e) {}

        try {
            const sRes = await fetch(`https://wikipedia.org{encodeURIComponent(topic)}&format=json&srlimit=1`, {
                headers: { 'User-Agent': 'SammuGamesBot/1.0' }
            });
            if (sRes.ok) {
                const sData = await sRes.json();
                const hit = sData && sData.query && Array.isArray(sData.query.search) ? sData.query.search.at(0) : null;
                if (hit && hit.title) {
                    const sumRes = await fetch(`https://wikipedia.org{encodeURIComponent(hit.title)}`, {
                        headers: { 'User-Agent': 'SammuGamesBot/1.0' }
                    });
                    if (sumRes.ok) {
                        const sum = await sumRes.json();
                        if (sum && sum.extract) return sum.extract.split('. ').slice(0, 2).join('. ') + '.';
                    }
                }
            }
        } catch (e) {}

        return `Maine ${topic} ke baare mein search kiya—short mein bolun toh yeh ek interesting topic hai! Full AI chat ke liye dot env mein GEMINI_API_KEY add kar lo.`;
    }

    async function runSammuVerseCore(query, sender, srvId, socket) {
        const q = query.trim();
        const low = q.toLowerCase();

        const playMatch = q.match(/^(?:play|bajao|chalao|gaana|song)\s+(.+)/i);
        if (playMatch && playMatch.at(1)) {
            const songName = playMatch.at(1).trim();
            socket.emit('svPlayMusic', { query: songName, by: sender, _serverId: srvId });
            return { text: `🎵 Playing ${songName}`, speak: `Playing ${songName} for you, ${sender}` };
        }
        if (/^(stop song|stop music|pause music|gaana band)/i.test(low)) {
            socket.emit('svStopMusic', { _serverId: srvId });
            return { text: `⏹️ Music stopped`, speak: `Music stopped` };
        }
        if (/^(hi|hello|hlo|hey|namaste|kaise ho|kya haal|how are you|wassup|sup)\b/i.test(low)) {
            const reply = `Hello ${sender}! Main bilkul mast hoon! Batao kya help karoon—koi song bajaoon, game start karoon, ya koi sawaal puchna hai?`;
            return { text: `🔵 ${reply}`, speak: reply };
        }
        if (/\b(time|samay|baje)\b/.test(low)) {
            const t = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
            return { text: `⏰ Abhi India mein ${t} IST baj rahe hain`, speak: `Abhi India mein ${t} baj rahe hain, ${sender}` };
        }
        if (/^[0-9+\-*/().\s]+$/.test(q) && /[+\-*/]/.test(q)) {
            try {
                const ans = Function('"use strict";return (' + q + ')')();
                if (Number.isFinite(ans)) return { text: `🧮 ${q} = ${ans}`, speak: `The answer is ${ans}` };
            } catch (e) {}
        }
        if (low.includes('water')) { socket.emit('openWaterIo'); return { text: `💧 Opening Water.io`, speak: `Opening Water dot I O!` }; }
        if (low.includes('imposter')) { launchServerWordImposter(srvId); return { text: `🕵️ Starting Word Imposter`, speak: `Starting Word Imposter!` }; }
        if (low.includes('mafia')) { socket.onevent({ type: 2, nsp: '/', data: ['chatMessage', '!mafia'] }); return { text: `🔪 Starting Mafia Party`, speak: `Starting Mafia Party!` }; }
        if (low.includes('dragon') || low.includes('boss')) { socket.onevent({ type: 2, nsp: '/', data: ['chatMessage', '!boss'] }); return { text: `🐉 Summoning Dragon Raid`, speak: `Summoning Shadow Dragon Raid!` }; }
        if (low.includes('heist') || low.includes('bank')) { socket.onevent({ type: 2, nsp: '/', data: ['chatMessage', '!heist'] }); return { text: `🏦 Starting Bank Heist`, speak: `Starting Mega Bank Heist!` }; }

        if (!svMemory.has(srvId)) svMemory.set(srvId, []);
        const hist = svMemory.get(srvId);
        const knowledge = await fetchAllKnowingAnswer(q, sender, hist);
        hist.push({ role: 'user', parts: [{ text: q }] }, { role: 'model', parts: [{ text: knowledge }] });
        while (hist.length > 8) hist.shift();
        return { text: `🔵 ${knowledge}`, speak: knowledge };
    }

    const svMusicMiddleware = async (req, res, next) => {
        const cleanPath = (req.originalUrl || req.url || '').split('?').at(0).toLowerCase();
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
                const song = (j && j.data && Array.isArray(j.data.results) ? j.data.results.at(0) : null) || (j && Array.isArray(j.results) ? j.results.at(0) : null);
                const urls = Array.isArray(song && song.downloadUrl) ? song.downloadUrl : [];
                const best = urls.at(-1) || urls.at(0);
                const streamUrl = best && (best.url || best.link);
                if (streamUrl) return res.json({ url: streamUrl, title: song.name || q });
            } catch (e) {}
        }

        try {
            const itRes = await fetch(`https://apple.com{encodeURIComponent(q)}&media=music&limit=1`);
            if (itRes.ok) {
                const itData = await itRes.json();
                const track = Array.isArray(itData && itData.results) ? itData.results.at(0) : null;
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
        socket.on('svVoiceQuery', async (payload) => {
            const q = (payload && typeof payload.text === 'string') ? payload.text.trim() : '';
            if (!q) return;
            const sender = socket.username || 'Player';
            const room = (payload && payload.serverId) || socket.activeServerId || 'srv_samaksh';
            const cleanQ = q.replace(/^!?sammu\s*verse[\s,]*/i, '').trim() || 'hello';
            const res = await runSammuVerseCore(cleanQ, sender, room, socket);
            socket.emit('sammuVerseSpeak', { text: res.speak, subtitle: res.text, _serverId: room });
        });

        socket.on('chatMessage', async (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            if (typeof raw !== 'string') return;
            const sender = (typeof payload === 'object' && payload && payload.username) || socket.username || 'Player';
            const room = (typeof payload === 'object' && payload && payload.serverId) || socket.activeServerId || 'srv_samaksh';
            const svMatch = raw.trim().match(/^!?sammu\s*verse[\s,]+(.+)/i);
            if (svMatch && svMatch.at(1)) {
                const res = await runSammuVerseCore(svMatch.at(1), sender, room, socket);
                io.to(room).emit('message', { username: "🔵 SammuVerse", text: `**@${sender}:** ${res.text}`, _serverId: room });
                socket.emit('sammuVerseSpeak', { text: res.speak, subtitle: res.text, _serverId: room });
            }
        });
    });
};
