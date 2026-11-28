const fs = require('fs');
const path = require('path');
const https = require('https');

function loadEnvVars() {
    try {
        const envFile = path.join(__dirname, '.env');
        if (fs.existsSync(envFile)) {
            fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(line => {
                const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
                if (m && !process.env[m]) process.env[m] = m.replace(/^["']|["']$/g, '').trim();
            });
        }
    } catch (e) {}
}
loadEnvVars();

function postJsonHttps(urlStr, headers, bodyObj, timeoutMs = 9000) {
    return new Promise((resolve) => {
        try {
            const u = new URL(urlStr);
            const payload = JSON.stringify(bodyObj);
            const req = https.request({
                hostname: u.hostname,
                path: u.pathname + u.search,
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            }, (res) => {
                let raw = '';
                res.on('data', c => raw += c);
                res.on('end', () => {
                    try { resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: JSON.parse(raw) }); }
                    catch (e) { resolve({ ok: false, status: res.statusCode, data: null }); }
                });
            });
            req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ ok: false, status: 408 }); });
            req.on('error', () => resolve({ ok: false, status: 500 }));
            req.write(payload);
            req.end();
        } catch (e) { resolve({ ok: false, status: 500 }); }
    });
}

module.exports = function initSammuVerseVoice(app, io, helpers) {
    const { launchServerWordImposter } = helpers;
    const svMemory = new Map();

    async function fetchAllKnowingAnswer(query, sender, history) {
        loadEnvVars();
        const sys = "You are SammuVerse, the all-knowing Hinglish & English voice assistant of SammuGames. Reply in 2-3 crisp, natural sentences under 260 chars suitable for voice speech.";

        const gemKey = (process.env.GEMINI_API_KEY || '').trim();
        if (gemKey) {
            const contents = [...history, { role: 'user', parts: [{ text: `[${sender}]: ${query}` }] }];
            for (const mdl of ['gemini-2.5-flash', 'gemini-2.0-flash']) {
                const res = await postJsonHttps(
                    `https://googleapis.com{mdl}:generateContent?key=${gemKey}`,
                    {},
                    { systemInstruction: { parts: [{ text: sys }] }, contents, generationConfig: { maxOutputTokens: 280, temperature: 0.75 } }
                );
                if (res.ok && res.data) {
                    const cand = Array.isArray(res.data.candidates) ? res.data.candidates.at(0) : null;
                    const part = Array.isArray(cand && cand.content && cand.content.parts) ? cand.content.parts.at(0) : null;
                    if (part && part.text && part.text.trim()) return part.text.replace(/[*#_`~]/g, '').trim();
                }
            }
        }

        const hcKeys = [process.env.HACKCLUB_AI_KEY, process.env.HACKCLUB_AI_KEY_2].map(k => (k || '').trim()).filter(Boolean);
        for (const hKey of hcKeys) {
            const hcMsgs = [
                { role: 'system', content: sys },
                ...history.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.parts?.at(0)?.text || '' })),
                { role: 'user', content: `[${sender}]: ${query}` }
            ];
            const res = await postJsonHttps(
                'https://hackclub.com',
                { Authorization: `Bearer ${hKey}` },
                { model: 'qwen/qwen3-32b', messages: hcMsgs, max_tokens: 280, temperature: 0.75 }
            );
            if (res.ok && res.data) {
                const choice = Array.isArray(res.data.choices) ? res.data.choices.at(0) : null;
                const txt = choice && choice.message && choice.message.content;
                if (txt && txt.trim()) return txt.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/[*#_`~]/g, '').trim();
            }
        }

        return `Haan ${sender}, maine suna "${query}"—ek second baad phir pucho!`;
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
    });
};
