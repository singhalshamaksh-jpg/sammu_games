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
