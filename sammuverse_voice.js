const fs = require('fs');
const path = require('path');
const https = require('https');

function getCleanEnv(keyName) {
    try {
        const envFile = path.join(__dirname, '.env');
        if (fs.existsSync(envFile)) {
            const lines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/);
            for (const line of lines) {
                const eq = line.indexOf('=');
                if (eq > 0 && line.slice(0, eq).trim() === keyName) {
                    return line.slice(eq + 1).trim().replace(/^["']|["']$/g, '').replace(new RegExp('^' + keyName + '='), '');
                }
            }
        }
    } catch (e) {}
    return (process.env[keyName] || '').trim().replace(/^["']|["']$/g, '');
}

function httpsReqJson(urlStr, method = 'GET', headers = {}, bodyObj = null, timeoutMs = 8500) {
    return new Promise((resolve) => {
        try {
            const u = new URL(urlStr);
            const payload = bodyObj ? JSON.stringify(bodyObj) : null;
            const reqHeaders = { 'User-Agent': 'Mozilla/5.0 SammuGames/1.0', ...headers };
            if (payload) {
                reqHeaders['Content-Type'] = 'application/json';
                reqHeaders['Content-Length'] = Buffer.byteLength(payload);
            }
            const req = https.request({
                hostname: u.hostname,
                path: u.pathname + u.search,
                method,
                headers: reqHeaders
            }, (res) => {
                let raw = '';
                res.on('data', c => raw += c);
                res.on('end', () => {
                    try { resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: JSON.parse(raw) }); }
                    catch (e) { resolve({ ok: false, status: res.statusCode, data: raw }); }
                });
            });
            req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ ok: false, status: 408 }); });
            req.on('error', () => resolve({ ok: false, status: 500 }));
            if (payload) req.write(payload);
            req.end();
        } catch (e) { resolve({ ok: false, status: 500 }); }
    });
}

module.exports = function initSammuVerseVoice(app, io, helpers) {
    const { launchServerWordImposter } = helpers;
    const svMemory = new Map();

    async function fetchAllKnowingAnswer(query, sender, history) {
        const sys = "You are SammuVerse, the original all-knowing Hinglish & English voice assistant of SammuGames. Reply in 2-3 crisp, natural sentences under 260 chars suitable for voice speech.";
        let debugErr = '';

        // 1. Try GEMINI_API_KEY
        const gemKey = getCleanEnv('GEMINI_API_KEY');
        if (gemKey) {
            const contents = [...history, { role: 'user', parts: [{ text: `[${sender}]: ${query}` }] }];
            for (const mdl of ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']) {
                const res = await httpsReqJson(
                    `https://googleapis.com{mdl}:generateContent?key=${gemKey}`,
                    'POST', {},
                    { systemInstruction: { parts: [{ text: sys }] }, contents, generationConfig: { maxOutputTokens: 280, temperature: 0.75 } }
                );
                if (res.ok && res.data && res.data.candidates && res.data.candidates.length > 0) {
                    const parts = res.data.candidates[0]?.content?.parts || [];
                    const txt = parts.map(p => p.text || '').join(' ').trim();
                    if (txt) return txt.replace(/[*#_`~]/g, '').trim();
                }
                debugErr = `Gem:${res.status}`;
            }
        }

        // 2. Try HACKCLUB_AI_KEY & HACKCLUB_AI_KEY_2
        const hcKeys = [getCleanEnv('HACKCLUB_AI_KEY'), getCleanEnv('HACKCLUB_AI_KEY_2')].filter(Boolean);
        for (const hKey of hcKeys) {
            const hcMsgs = [
                { role: 'system', content: sys },
                ...history.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: (m.parts && m.parts[0] && m.parts[0].text) || '' })),
                { role: 'user', content: `[${sender}]: ${query}` }
            ];
            for (const mdl of ['qwen/qwen3-32b', 'openai/gpt-4o-mini', 'meta-llama/llama-3.3-70b-instruct']) {
                const res = await httpsReqJson(
                    'https://hackclub.com',
                    'POST', { Authorization: `Bearer ${hKey}` },
                    { model: mdl, messages: hcMsgs, max_tokens: 280, temperature: 0.75 }
                );
                if (res.ok && res.data && res.data.choices && res.data.choices.length > 0) {
                    const txt = res.data.choices[0]?.message?.content || '';
                    if (txt.trim()) return txt.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/[*#_`~]/g, '').trim();
                }
                debugErr = `HC:${res.status}`;
            }
        }

        // 3. Guaranteed Wikipedia + DuckDuckGo Knowledge Fallback
        const topic = query.replace(/^(who is|what is|tell me about|how to make|recipe of|kaun hai|kya hai|batao|ki recipe)\s+/i, '').replace(/[?!.]+$/, '').trim();
        const wSearch = await httpsReqJson(`https://wikipedia.org{encodeURIComponent(topic)}&format=json&srlimit=1`);
        if (wSearch.ok && wSearch.data?.query?.search?.length > 0) {
            const title = wSearch.data.query.search[0].title;
            const wSum = await httpsReqJson(`https://wikipedia.org{encodeURIComponent(title)}`);
            if (wSum.ok && wSum.data?.extract) {
                return wSum.data.extract.split('. ').slice(0, 2).join('. ') + '.';
            }
        }

        return `Maine "${topic}" search kiya (${debugErr || 'NoKey'})—thoda aur clear pucho ya key check karo!`;
    }

    async function runSammuVerseCore(query, sender, srvId, socket) {
        const q = query.trim();
        const low = q.toLowerCase();

        const playMatch = q.match(/^(?:play|bajao|chalao|gaana|song)\s+(.+)/i);
        if (playMatch && playMatch[1]) {
            const songName = playMatch[1].trim();
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
        const cleanPath = (req.originalUrl || req.url || '').split('?')[0].toLowerCase();
        if (cleanPath !== '/sv-music') return next();
        const q = String(req.query.q || '').trim();
        if (!q) return res.json({ url: null });
        try {
            const songsDir = path.join(__dirname, 'public', 'songs');
            if (fs.existsSync(songsDir)) {
                const cleanQ = q.toLowerCase().replace(/[^a-z0-9]/g, '');
                const files = fs.readdirSync(songsDir);
                const match = files.find(fn => fn.toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanQ));
                if (match) return res.json({ url: '/songs/' + encodeURIComponent(match), title: match.replace(/\.[^.]+$/, '') });
            }
        } catch (e) {}

        for (const apiUrl of [
            `https://saavn.dev{encodeURIComponent(q)}&limit=1`,
            `https://vercel.app{encodeURIComponent(q)}&limit=1`
        ]) {
            const r = await httpsReqJson(apiUrl, 'GET', {}, null, 5000);
            if (r.ok && r.data) {
                const song = (r.data.data && Array.isArray(r.data.data.results) ? r.data.data.results[0] : null) || (Array.isArray(r.data.results) ? r.data.results[0] : null);
                const urls = Array.isArray(song && song.downloadUrl) ? song.downloadUrl : [];
                const best = urls[urls.length - 1] || urls[0];
                const streamUrl = best && (best.url || best.link);
                if (streamUrl) return res.json({ url: streamUrl, title: song.name || q });
            }
        }

        const itRes = await httpsReqJson(`https://apple.com{encodeURIComponent(q)}&media=music&limit=1`, 'GET', {}, null, 5000);
        if (itRes.ok && itRes.data && Array.isArray(itRes.data.results) && itRes.data.results[0]) {
            const track = itRes.data.results[0];
            if (track.previewUrl) return res.json({ url: track.previewUrl, title: `${track.trackName} - ${track.artistName}` });
        }
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
            const cleanQ = q.replace(/^!?(?:sammu|samu|sami|sammy|summer|some)\s*(?:verse|first|universe|worth)[\s,]*/i, '').trim() || 'hello';
            const res = await runSammuVerseCore(cleanQ, sender, room, socket);
            io.to(room).emit('message', { username: "🔵 SammuVerse", text: `**@${sender}:** ${res.text}`, _serverId: room });
            socket.emit('sammuVerseSpeak', { text: res.speak, subtitle: res.text, _serverId: room });
        });
    });
};
