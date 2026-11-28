const fs = require('fs');
const path = require('path');
const https = require('https');

function loadEnvVars() {
    try {
        const envFile = path.join(__dirname, '.env');
        if (fs.existsSync(envFile)) {
            fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(line => {
                const eq = line.indexOf('=');
                if (eq > 0) {
                    const k = line.slice(0, eq).trim();
                    const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
                    if (k && v) process.env[k] = v;
                }
            });
        }
    } catch (e) {}
}
loadEnvVars();

function httpsReqJson(urlStr, method = 'GET', headers = {}, bodyObj = null, timeoutMs = 9000) {
    return new Promise((resolve) => {
        try {
            const u = new URL(urlStr);
            const payload = bodyObj ? JSON.stringify(bodyObj) : null;
            const reqHeaders = { 'User-Agent': 'SammuGames/1.0', ...headers };
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
                    catch (e) { resolve({ ok: false, status: res.statusCode, data: null }); }
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
        loadEnvVars();
        const sys = "You are SammuVerse, the original all-knowing Hinglish & English voice assistant of SammuGames. Reply in 2-3 crisp, natural sentences under 260 chars suitable for voice speech.";

        const gemKey = (process.env.GEMINI_API_KEY || '').trim();
        if (gemKey) {
            const contents = [...history, { role: 'user', parts: [{ text: `[${sender}]: ${query}` }] }];
            for (const mdl of ['gemini-2.5-flash', 'gemini-2.0-flash']) {
                const res = await httpsReqJson(
                    `https://googleapis.com{mdl}:generateContent?key=${gemKey}`,
                    'POST', {},
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
            const res = await httpsReqJson(
                'https://hackclub.com',
                'POST', { Authorization: `Bearer ${hKey}` },
                { model: 'qwen/qwen3-32b', messages: hcMsgs, max_tokens: 280, temperature: 0.75 }
            );
            if (res.ok && res.data) {
                const choice = Array.isArray(res.data.choices) ? res.data.choices.at(0) : null;
                const txt = choice && choice.message && choice.message.content;
                if (txt && txt.trim()) return txt.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/[*#_`~]/g, '').trim();
            }
        }

        return `Haan ${sender}, maine suna "${query}"—API keys check ho rahi hain, 2 second baad try karo!`;
    }
