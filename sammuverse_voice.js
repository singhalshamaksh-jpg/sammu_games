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

    // === ⚡ SERVER ANTI-LAG & RAM GUARD ===
    if (io && io.engine && io.engine.opts) {
        io.engine.opts.perMessageDeflate = { threshold: 256 };
        io.engine.opts.httpCompression = { threshold: 256 };
    }
    if (!global._svMemGuardStarted) {
        global._svMemGuardStarted = true;
        setInterval(() => {
            if (svMemory.size > 30) svMemory.clear();
            if (typeof global.gc === 'function') global.gc();
        }, 10 * 60 * 1000);
    }


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
                    'https://://hackclub.com/proxy/v1/chat/completions',
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

        const wSearch2 = await httpsReqJson(`https://wikipedia.org{encodeURIComponent(topic)}&format=json&srlimit=1`);
        if (wSearch2.ok && wSearch2.data && wSearch2.data.query && Array.isArray(wSearch.data.query.search) && wSearch.data.query.search.length > 0) {
            const title = wSearch2.data.query.search.at(0).title;
            const wSum = await httpsReqJson(`https://wikipedia.org{encodeURIComponent(title)}`);
            if (wSum.ok && wSum.data && wSum.data.extract) {
                return wSum.data.extract.split('. ').slice(0, 2).join('. ') + '.';
            }
        }
        return `Haan ${sender}! Main SammuVerse hoon—mujhse time, games, shayari, ya koi bhi song play karne ko bolo!`;
    }

    async function runSammuVerseCore(query, sender, srvId, socket) {
        const q = query.trim();
        const low = q.toLowerCase();

                if (/\b(dj mode on|party mode|dj on|non stop|nonstop|club mode)\b/i.test(low)) {
            io.to(srvId).emit('svDjMode', { on: true, by: sender, _serverId: srvId });
            return { text: `🎧🔥 **AI DJ PARTY MODE ON!** Non-stop songs + neon club visuals activated!`, speak: `AI DJ Party Mode activated! Let's vibe, ${sender}!` };
        }
        if (/\b(dj mode off|party mode off|dj off|stop dj)\b/i.test(low)) {
            io.to(srvId).emit('svDjMode', { on: false, _serverId: srvId });
            return { text: `⏹️ **AI DJ Mode OFF!**`, speak: `DJ Mode turned off.` };
        }

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
                if (/\b(shayari|shayri|shairi|shayeri|shyri|shayiri|poetry|poem|sher|seedhe mauth)\b/i.test(low)) {
            const lines = [
                "Maina tu gaati reh, aasmaan tera hai—kohra chhantega zaroor, bas hausla rakhna!",
                "Hoshiyar rehna is duniya ki bheed mein, yahan har chehre ke peeche ek kahani chhupi hai!",
                "Pankh faila ke udna seekh mere dost, zameen par toh har koi chalta hai!",
                "Kalam chale toh duniya hilti hai—Seedhe Mauth style, seedha dil pe lagti hai!"
            ];
            const pick = lines[Math.floor(Math.random() * lines.length)];
            return { text: `🎙️✨ ${pick}`, speak: pick };
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
        const q = String(req.query.q || '').replace(/\b(?:song|songs|gaana|music|track|please|pls)\b/gi, '').trim();
        if (!q) return res.json({ url: null });

        // 1. Check local downloaded .opus/.mp3 files in public/songs/ first!
        try {
            const songsDir = path.join(__dirname, 'public', 'songs');
            if (fs.existsSync(songsDir)) {
                const audioFiles = fs.readdirSync(songsDir).filter(fn => /\.(opus|mp3|m4a|ogg)$/i.test(fn));
                if (audioFiles.length > 0) {
                    if (q.toLowerCase() === 'random') {
                        const pick = audioFiles[Math.floor(Math.random() * audioFiles.length)];
                        return res.json({ url: '/songs/' + encodeURIComponent(pick), title: pick.replace(/\.[^.]+$/, '') });
                    }
                    const words = q.toLowerCase().split(/\s+/).filter(w => w.length >= 2);
                    const match = audioFiles.find(fn => {
                        const lowFn = fn.toLowerCase();
                        return words.length > 0 && words.every(w => lowFn.includes(w));
                    }) || audioFiles.find(fn => fn.toLowerCase().includes(q.toLowerCase()));
                    if (match) {
                        return res.json({ url: '/songs/' + encodeURIComponent(match), title: match.replace(/\.[^.]+$/, '') });
                    }
                }
            }
        } catch (e) {}

        // 2. Fallback to iTunes Search API (reliable HTTPS)
        const itRes = await httpsReqJson(`https://apple.com{encodeURIComponent(q)}&media=music&limit=1`, 'GET', {}, null, 5500);
        if (itRes.ok && itRes.data && Array.isArray(itRes.data.results) && itRes.data.results.length > 0) {
            const track = itRes.data.results.at(0);
            if (track && track.previewUrl) {
                return res.json({ url: track.previewUrl, title: `${track.trackName} - ${track.artistName}` });
            }
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
            const cleanQ = q.replace(/^!?(?:sammu|samu|sami|sammy|summer|some|samo)\s*(?:verse|first|universe|worth|words|word|voice|bus|box)?[\s,]*/i, '').trim() || 'hello';
            const res = await runSammuVerseCore(cleanQ, sender, room, socket);
            io.to(room).emit('message', { username: "🔵 SammuVerse", text: `**@${sender}:** ${res.text}`, _serverId: room });
            socket.emit('sammuVerseSpeak', { text: res.speak, subtitle: res.text, _serverId: room });
        });
    });
};
