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
