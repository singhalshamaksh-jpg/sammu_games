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
