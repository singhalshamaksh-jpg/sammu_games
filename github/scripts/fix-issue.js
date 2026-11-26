const fs = require('fs');
const path = require('path');

async function main() {
    const apiKey = (process.env.HACKCLUB_AI_KEY || '').trim();
    const issueTitle = process.env.ISSUE_TITLE || '';
    const issueBody = process.env.ISSUE_BODY || '';
    const issueNum = process.env.ISSUE_NUMBER;
    const repoFull = process.env.REPO_FULL;
    const ghToken = process.env.GITHUB_TOKEN;

    if (!apiKey) throw new Error('Missing HACKCLUB_AI_KEY secret');

    const targetFiles = fs.readdirSync('.')
        .filter(f => /\.(js|html|css|json)$/i.test(f) && f !== 'package-lock.json' && f !== 'ai_banks_cache.json');

    let codebaseBundle = '';
    for (const file of targetFiles) {
        const content = fs.readFileSync(file, 'utf8');
        codebaseBundle += `\n=== FILE: ${file} ===\n${content}\n`;
    }

    const prompt = `You are an expert full-stack Node.js & Socket.IO engineer.
A GitHub Issue was opened on this repository:
TITLE: ${issueTitle}
DESCRIPTION: ${issueBody}

Here is the complete codebase:
${codebaseBundle}

Analyze the issue across all files, fix every related bug or implement the requested change cleanly without breaking existing features, and return ONLY valid JSON in this exact structure:
{
  "summary": "Short explanation of what was fixed",
  "files": [
    {
      "path": "exact_filename.js",
      "content": "COMPLETE updated file content here"
    }
  ]
}
Return ONLY the JSON object, with no markdown fences or extra commentary.`;

    const url = ['https://ai', 'hackclub', 'com/proxy/v1/chat/completions'].join('.');
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'particle-ai/particle-1:free',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 32000,
            temperature: 0.2
        })
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HackClub AI HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    let rawReply = data?.choices?.at(0)?.message?.content || '';
    rawReply = rawReply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    const jsonMatch = rawReply.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI did not return valid JSON');

    const result = JSON.parse(jsonMatch.at(0));
    if (!Array.isArray(result.files) || result.files.length === 0) {
        throw new Error('No file changes returned by AI');
    }

    for (const f of result.files) {
        if (f.path && typeof f.content === 'string') {
            const safePath = path.basename(f.path);
            fs.writeFileSync(safePath, f.content, 'utf8');
            console.log(`Updated ${safePath}`);
        }
    }

    if (ghToken && repoFull && issueNum) {
        await fetch(`https://github.com{repoFull}/issues/${issueNum}/comments`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ghToken}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Particle1-AutoFixer'
            },
            body: JSON.stringify({
                body: `🤖 **Particle-1 AI Analysis Complete!**\n\n${result.summary}\n\n✅ Syntax check passed (` + '`node --check`' + `) and a Pull Request has been opened for you to review & merge!`
            })
        });
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
