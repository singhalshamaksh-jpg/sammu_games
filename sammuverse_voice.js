module.exports = function initSammuVerseVoice(app, io, helpers) {
    const { launchServerWordImposter } = helpers;
    const svMemory = new Map();

    async function fetchAllKnowingAnswer(query, sender, history) {
        const gemKey = (process.env.GEMINI_API_KEY || '').trim();
        if (gemKey) {
            try {
                const ctrl = new AbortController();
                const t = setTimeout(() => ctrl.abort(), 7000);
                const sys = "You are SammuVerse, the original all-knowing Hinglish & English voice assistant of SammuGames. Reply in 2-3 short, friendly sentences under 280 chars.";
                const contents = [...history, { role: 'user', parts: [{ text: `[${sender}]: ${query}` }] }];
                const res = await fetch(`https://googleapis.com{gemKey}`, {
                    method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents, generationConfig: { maxOutputTokens: 280, temperature: 0.75 } })
                });
                clearTimeout(t);
                if (res.ok) {
                    const data = await res.json();
                    const ans = data?.candidates?.at(0)?.content?.parts?.at(0)?.text;
                    if (ans && ans.trim()) return ans.replace(/[*#_`~]/g, '').trim();
                }
            } catch (e) {}
        }

        try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 8000);
            const prompt = `You are SammuVerse, a smart Hinglish & English voice assistant. Answer "${query}" clearly in 2-3 short sentences (under 280 chars) with no markdown symbols.`;
            const pRes = await fetch(`https://pollinations.ai{encodeURIComponent(prompt)}`, { signal: ctrl.signal });
            clearTimeout(t);
            if (pRes.ok) {
                const txt = await pRes.text();
                if (txt && txt.trim() && !txt.includes('<!DOCTYPE')) return txt.replace(/[*#_`~]/g, '').trim().slice(0, 320);
            }
        } catch (e) {}

        const topic = query.replace(/^(who is|what is|tell me about|kaun hai|kya hai|batao)\s+/i, '').replace(/[?!.]+$/, '').trim();
        try {
            const sRes = await fetch(`https://wikipedia.org{encodeURIComponent(topic)}&format=json&srlimit=1`);
            if (sRes.ok) {
                const sData = await sRes.json();
                const hit = sData?.query?.search?.at(0);
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
        if (playMatch && playMatch.at(1)) {
            const songName = playMatch.at(1).trim();
            io.to(srvId).emit('svPlayMusic', { query: songName, by: sender, _serverId: srvId });
            return { text: `🎵 Playing **${songName}** for **${sender}**!`, speak: `Playing ${songName} for you, ${sender}` };
        }
        if (/^(stop song|stop music|pause music|gaana band)/i.test(low)) {
            io.to(srvId).emit('svStopMusic', { _serverId: srvId });
            return { text: `⏹️ Music stopped!`, speak: `Music stopped` };
        }
        if (/^(hi|hello|hlo|hey|namaste|kaise ho|kya haal|how are you|wassup|sup)\b/i.test(low)) {
            const reply = `Hello ${sender}! Main bilkul mast hoon! Batao kya help karoon—koi song bajaoon, game start karoon, ya koi sawaal puchna hai?`;
            return { text: `🔵 ${reply}`, speak: reply };
        }
        if (/\b(time|samay|baje)\b/.test(low)) {
            const t = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
            return { text: `⏰ Abhi India mein **${t} IST** baj rahe hain, ${sender}!`, speak: `Abhi India mein ${t} baj rahe hain, ${sender}` };
        }
        if (low.includes('water')) { socket.emit('openWaterIo'); return { text: `💧 Opening **Water.io**!`, speak: `Opening Water dot I O!` }; }
        if (low.includes('imposter')) { launchServerWordImposter(srvId); return { text: `🕵️ Launching **Word Imposter**!`, speak: `Launching Word Imposter!` }; }
        if (low.includes('mafia')) { socket.onevent({ type: 2, nsp: '/', data: ['chatMessage', '!mafia'] }); return { text: `🔪 Launching **Mafia Party**!`, speak: `Launching Mafia Party!` }; }
        if (low.includes('dragon') || low.includes('boss')) { socket.onevent({ type: 2, nsp: '/', data: ['chatMessage', '!boss'] }); return { text: `🐉 Summoning **Shadow Dragon Raid**!`, speak: `Summoning Shadow Dragon Raid!` }; }
        if (low.includes('heist') || low.includes('bank')) { socket.onevent({ type: 2, nsp: '/', data: ['chatMessage', '!heist'] }); return { text: `🏦 Launching **Mega Bank Heist**!`, speak: `Launching Mega Bank Heist!` }; }

        if (!svMemory.has(srvId)) svMemory.set(srvId, []);
        const hist = svMemory.get(srvId);
        const knowledge = await fetchAllKnowingAnswer(q, sender, hist);
        if (knowledge) {
            hist.push({ role: 'user', parts: [{ text: q }] }, { role: 'model', parts: [{ text: knowledge }] });
            while (hist.length > 8) hist.shift();
            return { text: `🔵 ${knowledge}`, speak: knowledge };
        }
        return { text: `🔵 **${sender}**, network thoda slow hai—ek baar phir pucho!`, speak: `${sender}, please ask again!` };
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
                const song = j?.data?.results?.at(0) || j?.results?.at(0);
                const urls = song?.downloadUrl || [];
                const best = urls.at(-1) || urls.at(0);
                const streamUrl = best?.url || best?.link;
                if (streamUrl) return res.json({ url: streamUrl, title: song?.name || q });
            } catch (e) {}
        }

        try {
            const itRes = await fetch(`https://apple.com{encodeURIComponent(q)}&media=music&limit=1`);
            if (itRes.ok) {
                const itData = await itRes.json();
                const track = itData?.results?.at(0);
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

    const VOICE_UI_PAYLOAD = `
    <div id="svMusicDock" style="display:none;position:fixed;top:58px;left:50%;transform:translateX(-50%);z-index:9999999;background:linear-gradient(135deg,rgba(15,23,42,0.97),rgba(30,27,75,0.97));border:2px solid #38bdf8;border-radius:16px;padding:8px 11px;width:280px;color:#fff;box-shadow:0 8px 25px rgba(56,189,248,0.5);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;font-size:11px;font-weight:900;">
        <span id="svMusicTitle" style="color:#7dd3fc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:215px;">🎵 SammuVerse DJ</span>
        <button onclick="var a=document.getElementById('svMusicAudio');a.pause();a.src='';document.getElementById('svMusicDock').style.display='none';" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 6px;cursor:pointer;">✕</button>
      </div>
      <audio id="svMusicAudio" controls autoplay playsinline style="width:100%;height:30px;border-radius:8px;"></audio>
    </div>
    <button id="svVoiceMicBtn" style="position:fixed;bottom:118px;right:14px;z-index:9999999;background:linear-gradient(135deg,#0284c7,#7c3aed);border:2px solid #7dd3fc;color:#fff;border-radius:999px;padding:10px 14px;font-size:12px;font-weight:900;cursor:pointer;box-shadow:0 0 20px rgba(56,189,248,0.75);">🔵🎙️ Voice</button>`;

    io.on('connection', (socket) => {
        socket.emit('svInjectVoiceUI', VOICE_UI_PAYLOAD);
        socket.on('joinRoom', () => setTimeout(() => socket.emit('svInjectVoiceUI', VOICE_UI_PAYLOAD), 500));

        socket.on('chatMessage', async (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            if (typeof raw !== 'string') return;
            const trimmed = raw.trim();
            const sender = (typeof payload === 'object' && payload?.username) || socket.username || 'Player';
            const room = (typeof payload === 'object' && payload?.serverId) || socket.activeServerId || 'srv_samaksh';

            const svMatch = trimmed.match(/^!?sammu\s*verse[\s,]+(.+)/i);
            if (svMatch && svMatch.at(1)) {
                const res = await runSammuVerseCore(svMatch.at(1), sender, room, socket);
                io.to(room).emit('message', { username: "🔵 SammuVerse", text: `**@${sender}:** ${res.text}`, _serverId: room });
                io.to(room).emit('sammuVerseSpeak', { text: res.speak, _serverId: room });
            }
        });
    });
};
