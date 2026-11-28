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


    async function fetchAllKnowingAnswer(query, sender, history, imageBase64 = null) {
        const nowIST = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' });
        const sys = [
            "You are SammuVerse, a custom all-knowing AI assistant built exclusively to run the SammuVerse & SammuGames universe (created by Sammu & Samaksh).",
            `Current live date & time in India (IST): ${nowIST}.`,
            "Rules: You know everything—science, history, world facts, dates, anime, coding, and recipes.",
            "Speak in natural, witty Hinglish with a funny, playful roast vibe (lighthearted desi humor, no heavy abuse).",
            "Remember and use the previous 7 conversation turns naturally. Keep replies crisp (2-4 sentences, under 320 chars) with no markdown symbols so voice speech sounds smooth.",
            "If an image or outfit is shared, rate the outfit out of 10 with funny, honest Hinglish drip feedback!"
        ].join(" ");

        const hcKeys = [getCleanEnv('HACKCLUB_AI_KEY'), getCleanEnv('HACKCLUB_AI_KEY_2')].filter(Boolean);
        const hcHost = ['ai', 'hackclub', 'com'].join('.');
        const hcEndpoint = 'https://' + hcHost + '/proxy/v1/chat/completions';

        const models = imageBase64
            ? ['google/gemini-2.5-flash', 'openai/gpt-4o-mini', 'qwen/qwen2.5-vl-72b-instruct']
            : ['particle-ai/particle-1:free', 'qwen/qwen3-32b', 'google/gemini-2.5-flash'];

        const userContent = imageBase64
            ? [
                { type: 'text', text: `[${sender}]: ${query || 'Rate my outfit out of 10 with funny Hinglish drip feedback!'}` },
                { type: 'image_url', image_url: { url: imageBase64 } }
              ]
            : `[${sender}]: ${query}`;

        for (const hKey of hcKeys) {
            const hcMsgs = [
                { role: 'system', content: sys },
                ...history.slice(-14).map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: (m.parts && m.parts.at(0) && m.parts.at(0).text) || '' })),
                { role: 'user', content: userContent }
            ];
            for (const mdl of models) {
                const res = await httpsReqJson(
                    hcEndpoint,
                    'POST',
                    { Authorization: `Bearer ${hKey}` },
                    { model: mdl, messages: hcMsgs, max_tokens: 340, temperature: 0.8 },
                    12000
                );
                if (res.ok && res.data && Array.isArray(res.data.choices) && res.data.choices.length > 0) {
                    const txt = res.data.choices.at(0)?.message?.content || '';
                    if (txt.trim()) {
                        return txt.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/[*#_`~]/g, '').trim();
                    }
                }
            }
        }

        return `Arre ${sender}, abhi server pe thodi bheed hai—2 second baad phir pucho!`;
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
        while (hist.length > 14) hist.shift();
        return { text: `🔵 ${knowledge}`, speak: knowledge };
    }

    const svMusicMiddleware = async (req, res, next) => {
        const cleanPath = (req.originalUrl || req.url || '').split('?').at(0).toLowerCase();
        if (cleanPath === '/sv-songs') {
            try {
                const songsDir = path.join(__dirname, 'public', 'songs');
                if (!fs.existsSync(songsDir)) return res.json({ songs: [] });
                const list = fs.readdirSync(songsDir)
                    .filter(fn => /\.(opus|mp3|m4a|ogg)$/i.test(fn))
                    .map(fn => ({ file: fn, title: fn.replace(/\.[^.]+$/, ''), url: '/songs/' + encodeURIComponent(fn) }))
                    .sort((a, b) => a.title.localeCompare(b.title));
                return res.json({ songs: list });
            } catch (e) { return res.json({ songs: [] }); }
        }
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
        socket.on('svVisionQuery', async (payload) => {
            const img = payload && typeof payload.image === 'string' ? payload.image : '';
            if (!img) return;
            const q = (payload && typeof payload.text === 'string' && payload.text.trim()) || 'Rate my outfit out of 10 with funny Hinglish drip feedback!';
            const sender = socket.username || 'Player';
            const room = (payload && payload.serverId) || socket.activeServerId || 'srv_samaksh';
            const ans = await fetchAllKnowingAnswer(q, sender, [], img);
            io.to(room).emit('message', { username: "🔵 SammuVerse", text: `**@${sender} (Outfit/Vision):** 👕✨ ${ans}`, _serverId: room });
            socket.emit('sammuVerseSpeak', { text: ans, subtitle: ans, _serverId: room });
        });

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
