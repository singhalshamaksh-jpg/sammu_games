module.exports = function(ctx) {
    let { app, io, fs, path, serversDB, saveDB, OG_HOSTS, MASTER_KEYS, lockedOGSignatures, verifyOGHostTripleLock, arenas, getArena, syncArenaPlayers, IMPOSTER_WORDS, EXTRA_ANIME_QUIZ } = ctx;
    const getFullRoomPlayers = (srvId) => ctx.getFullRoomPlayers(srvId);
    const getCoins = (u) => ctx.getCoins(u);
    const addCoins = (u, a) => ctx.addCoins(u, a);
    const playerWallet = ctx.playerWallet;
    const playerCards = ctx.playerCards;

       // ==================== PIECE 1 & 2: WORKING AI + DJ + VISUAL FX ====================
    const aiRoomMemory = new Map();

    io.on('connection', (socket) => {
        socket.on('cursorAura', (data) => {
            if (!data || typeof data.nx !== 'number' || typeof data.ny !== 'number') return;
            const srvId = data.serverId || socket.activeServerId || 'global';
            socket.to(srvId).emit('cursorAura', {
                id: socket.id,
                name: String(data.name || socket.username || 'Player').slice(0, 14),
                nx: Math.max(0, Math.min(1, data.nx)),
                ny: Math.max(0, Math.min(1, data.ny)),
                color: String(data.color || '#38bdf8').slice(0, 20),
                _serverId: srvId
            });
        });

        socket.on('chatMessage', async (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            if (typeof raw !== 'string') return;
            const trimmed = raw.trim();
            const srvId = (typeof payload === 'object' && payload?.serverId) || socket.activeServerId || 'global';
            const sender = (typeof payload === 'object' && payload?.username) || socket.username || 'Player';
            const colors = ['#ff007f', '#00f5d4', '#fee440', '#9b5de5', '#ff5400', '#00bbf9'];

            // 1. Visual Spectacles (!holi, !barish, !diwali, !aurora, !meteor, !tsunami, !bijli)
            const holiMatch = trimmed.match(/^!(?:holi|rang|pichkari)(?:\s+(.*))?$/i);
            if (holiMatch) {
                const target = (holiMatch.at(1) || 'poore room').trim();
                io.to(srvId).emit('chaosEvent', { type: 'holi', from: sender, target, colors, _serverId: srvId });
                return io.to(srvId).emit('message', {
                    username: '🎨 Holi Rang Bot',
                    text: `💦🌈 **${sender}** ne **${target}** par neon gulal aur pichkari maar di! *Bura na mano Holi hai!*`,
                    _serverId: srvId
                });
            }

            const fxMatch = trimmed.match(/^!(barish|monsoon|diwali|patakha|aurora|meteor|tsunami|bijli|powercut)$/i);
            if (fxMatch) {
                const cmd = fxMatch.at(1).toLowerCase();
                const map = {
                    barish: ['barish', '🌧️ Mausam Bot', `⛈️☕ **${sender}** ne room mein **Monsoon Barish + Bijli** chalu kar di!`],
                    monsoon: ['barish', '🌧️ Mausam Bot', `⛈️☕ **${sender}** ne room mein **Monsoon Barish + Bijli** chalu kar di!`],
                    diwali: ['diwali', '🪔 Diwali Bot', `🎆💥 **${sender}** ne **Skyrocket Fireworks** chalu kar diye! Screen par tap karo rockets udane ke liye!`],
                    patakha: ['diwali', '🪔 Diwali Bot', `🎆💥 **${sender}** ne **Skyrocket Fireworks** chalu kar diye! Screen par tap karo rockets udane ke liye!`],
                    aurora: ['aurora', '🌌 Sky Bot', `✨🌌 **${sender}** ne aasman mein **Northern Lights (Aurora)** jala di!`],
                    meteor: ['meteor', '☄️ Space Bot', `🌠🔥 **${sender}** ne room mein **Meteor Shower** bula liya!`],
                    tsunami: ['tsunami', '🌊 Aqua Alert', `🌊📱 **${sender}** ne phone hila kar **5-Second Tsunami** laa di!`],
                    bijli: ['bijli', '⚡ Bijli Vibhag', `🕯️🔦 **${sender}** ne **BIJLI KAAT DI**! Ungli se flashlight chalao!`],
                    powercut: ['bijli', '⚡ Bijli Vibhag', `🕯️🔦 **${sender}** ne **BIJLI KAAT DI**! Ungli se flashlight chalao!`]
                };
                const entry = map[cmd];
                if (entry) {
                    const [fxType, botName, botMsg] = entry;
                    io.to(srvId).emit('chaosEvent', { type: fxType, from: sender, target: 'all', colors, _serverId: srvId });
                    return io.to(srvId).emit('message', { username: botName, text: botMsg, _serverId: srvId });
                }
            }

            // 2. SammuVerse AI (!ai <question>) — Dual Key + Working Models
            const aiMatch = trimmed.match(/^!ai\s+(.+)/i);
            if (!aiMatch) return;
            const question = aiMatch.at(1).trim();
            if (!aiRoomMemory.has(srvId)) aiRoomMemory.set(srvId, []);
            const history = aiRoomMemory.get(srvId);
            history.push({ role: 'user', content: `[${sender}]: ${question}` });
            while (history.length > 10) history.shift();

            const systemPrompt = `You are SammuVerse AI, a super fast, witty, slightly roasty Hinglish genius DJ & visual director on SammuGames.
Rules:
1. Reply in 5-12 punchy sentences STRICTLY under 2500 characters total.
2. Playful, funny roasts + 100% accurate facts.(science,history,trivia, general knowledge,coding astrology even etc)
3. Remember the last 10 room messages. Never output <think> tags.
4. MUSIC DJ: If user asks to play a song, append [PLAY:exact song name] at the end.
5. VISUAL FX: If user asks for rain, holi, fireworks, aurora, meteor, tsunami, or power cut, append ONE of [FX:holi], [FX:barish], [FX:diwali], [FX:aurora], [FX:meteor], [FX:tsunami], or [FX:bijli] at the end.`;

            try {
                const gemKey = process.env.GEMINI_API_KEY;
                let reply = '';
                let lastErr = '';

                if (gemKey) {
                    try {
                        const ctrl = new AbortController();
                        const timeout = setTimeout(() => ctrl.abort(), 9000);
                        const contents = history.map(m => ({
                            role: m.role === 'assistant' ? 'model' : 'user',
                            parts: [{ text: m.content }]
                        }));
                        const base = ['https:/', '://googleapis.com', 'v1beta', 'models', ''].join('/');
                        const url = base + 'gemini-2.5-flash:generateContent?key=' + gemKey;
                        const aiRes = await fetch(url, {
                            method: 'POST',
                            signal: ctrl.signal,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                systemInstruction: { parts: [{ text: systemPrompt }] },
                                contents,
                                generationConfig: { maxOutputTokens: 1200, temperature: 0.85 }
                            })
                        });
                        clearTimeout(timeout);
                        const aiData = await aiRes.json();
                        const cand = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (cand) reply = cand;
                        else lastErr = aiData?.error?.message || ('HTTP ' + aiRes.status);
                    } catch (e) {
                        lastErr = e.message || 'Timeout';
                    }
                }

                if (!reply) {
                    reply = !gemKey ? '⚠️ Add GEMINI_API_KEY in .env!' : ('⚠️ AI Busy (' + lastErr + ')');
                }

                reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/\s+/g, ' ').trim();

                const playTag = reply.match(/\[PLAY:([^\]]+)\]/i);
                if (playTag && playTag.at(1)) {
                    const songQuery = playTag.at(1).trim();
                    reply = reply.replace(/\[PLAY:[^\]]+\]/gi, '').trim();
                    io.to(srvId).emit('aiPlaySong', { query: songQuery, requestedBy: sender, _serverId: srvId });
                }

                const fxTag = reply.match(/\[FX:(holi|barish|diwali|aurora|meteor|tsunami|bijli)\]/i);
                if (fxTag && fxTag.at(1)) {
                    const fxType = fxTag.at(1).toLowerCase();
                    reply = reply.replace(/\[FX:[^\]]+\]/gi, '').trim();
                    io.to(srvId).emit('chaosEvent', { type: fxType, from: 'SammuVerse AI', target: sender, colors, _serverId: srvId });
                }

                if (reply.length > 2400) reply = reply.slice(0, 2397).trimEnd() + '...';
                history.push({ role: 'assistant', content: reply });
                while (history.length > 10) history.shift();

                io.to(srvId).emit('message', { username: '🌌 SammuVerse AI', text: `**@${sender}:** ${reply}`, _serverId: srvId });
            } catch (err) {
                io.to(srvId).emit('message', { username: '🌌 SammuVerse AI', text: `⚡ **@${sender}:** Server thoda tez bhaag gaya, 2 sec baad try kar!`, _serverId: srvId });
            }
        });
    });

    // 3. AI Song Stream Resolver (Safe .at(0) syntax)
    const aiSongMiddleware = async (req, res, next) => {
        const cleanPath = (req.originalUrl || req.url || '').split('?').at(0).toLowerCase();
        if (cleanPath !== '/ai-song') return next();

        const q = String(req.query.q || '').trim();
        if (!q) return res.json({ url: null });

        const mirrors = [
            `https://saavn.dev{encodeURIComponent(q)}&limit=1`,
            `https://vercel.app{encodeURIComponent(q)}&limit=1`
        ];

        for (const apiUrl of mirrors) {
            try {
                const ctrl = new AbortController();
                const timer = setTimeout(() => ctrl.abort(), 5000);
                const apiRes = await fetch(apiUrl, { signal: ctrl.signal });
                clearTimeout(timer);
                if (!apiRes.ok) continue;

                const json = await apiRes.json();
                const song = json?.data?.results?.at(0) || json?.results?.at(0);
                const urls = song?.downloadUrl || [];
                const best = urls.at(-1) || urls.at(0);
                const streamUrl = best?.url || best?.link || null;

                if (streamUrl) {
                    const artistNames = Array.isArray(song?.artists?.primary)
                        ? song.artists.primary.map(a => a.name).join(', ')
                        : (song?.primaryArtists || '');
                    return res.json({ url: streamUrl, title: song?.name || q, artist: artistNames });
                }
            } catch (e) {}
        }
        return res.json({ url: null });
    };

    app.use(aiSongMiddleware);
    const songStack = (app._router && app._router.stack) || (app.router && app.router.stack);
    if (Array.isArray(songStack)) {
        const idx = songStack.findIndex(l => l && l.handle === aiSongMiddleware);
        if (idx > 0) { const [layer] = songStack.splice(idx, 1); songStack.unshift(layer); }
    }
             
     // ==================== PIECE 3 & 4: AI DJ BAR + GLOW TRAILS + PURE PHONE SHAKE ====================
    const PIECE3_AND_4_HTML = `
    <div id="aiDjBox" style="display:none;position:fixed;bottom:76px;left:12px;z-index:999990;background:linear-gradient(135deg,rgba(15,23,42,0.95),rgba(49,16,66,0.95));backdrop-filter:blur(10px);border:2px solid #38bdf8;border-radius:16px;padding:8px 11px;width:270px;color:#fff;box-shadow:0 8px 28px rgba(56,189,248,0.45);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;font-size:11px;font-weight:900;">
        <span id="aiDjTitle" style="color:#fde047;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:195px;">🎧 AI DJ Ready</span>
        <div style="display:flex;gap:4px;">
          <button onclick="var a=document.getElementById('aiDjAudio');a.style.display=a.style.display==='none'?'block':'none';" style="background:#0284c7;border:none;color:#fff;border-radius:6px;padding:2px 6px;cursor:pointer;">_</button>
          <button onclick="var a=document.getElementById('aiDjAudio');a.pause();a.src='';document.getElementById('aiDjBox').style.display='none';" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 6px;cursor:pointer;">✕</button>
        </div>
      </div>
      <audio id="aiDjAudio" controls autoplay playsinline style="width:100%;height:32px;border-radius:8px;"></audio>
    </div>

    <canvas id="sammuAuraCanvas" style="pointer-events:none;position:fixed;inset:0;width:100vw;height:100vh;z-index:999985;"></canvas>

    <script id="piece3And4Boot">
    (function() {
      const auraCanvas = document.getElementById('sammuAuraCanvas');
      const actx = auraCanvas ? auraCanvas.getContext('2d') : null;
      function resizeAura() {
        if (!auraCanvas) return;
        auraCanvas.width = window.innerWidth || 800;
        auraCanvas.height = window.innerHeight || 600;
      }
      window.addEventListener('resize', resizeAura);
      resizeAura();

      const myColors = ['#38bdf8', '#f472b6', '#a78bfa', '#34d399', '#facc15', '#fb923c'];
      const myAuraColor = myColors.at(Math.floor(Math.random() * myColors.length));
      const trails = {};
      let lastEmit = 0;

      function addTrailPoint(id, name, color, x, y) {
        if (!trails[id]) trails[id] = { name, color, points: [] };
        trails[id].name = name; trails[id].color = color;
        trails[id].points.push({ x, y, life: 1.0 });
        if (trails[id].points.length > 22) trails[id].points.shift();
      }

      function handleLocalMove(x, y) {
        const myName = (window.currentUsername || localStorage.getItem('username') || 'You').slice(0, 14);
        addTrailPoint('me', myName, myAuraColor, x, y);
        const now = Date.now();
        if (typeof socket !== 'undefined' && socket.connected && now - lastEmit > 45) {
          lastEmit = now;
          socket.emit('cursorAura', {
            nx: x / Math.max(1, window.innerWidth),
            ny: y / Math.max(1, window.innerHeight),
            color: myAuraColor, name: myName,
            serverId: window.selectedServerId || 'global'
          });
        }
      }

      window.addEventListener('mousemove', e => handleLocalMove(e.clientX, e.clientY), { passive: true });
      window.addEventListener('touchmove', e => {
        const t = e.touches && e.touches.item(0);
        if (t) handleLocalMove(t.clientX, t.clientY);
      }, { passive: true });

      function drawAuras() {
        if (actx && auraCanvas) {
          actx.clearRect(0, 0, auraCanvas.width, auraCanvas.height);
          for (const id of Object.keys(trails)) {
            const t = trails[id];
            if (!t.points.length) { delete trails[id]; continue; }
            for (let i = 1; i < t.points.length; i++) {
              const p0 = t.points.at(i - 1), p1 = t.points.at(i);
              actx.beginPath(); actx.moveTo(p0.x, p0.y); actx.lineTo(p1.x, p1.y);
              actx.strokeStyle = t.color; actx.globalAlpha = Math.max(0, p1.life * 0.75);
              actx.lineWidth = Math.max(1.5, p1.life * 6); actx.lineCap = 'round';
              actx.shadowBlur = 12; actx.shadowColor = t.color; actx.stroke();
            }
            const head = t.points.at(-1);
            if (id !== 'me' && head && head.life > 0.25) {
              actx.globalAlpha = head.life; actx.fillStyle = '#ffffff'; actx.font = 'bold 11px sans-serif';
              actx.fillText('✨ ' + t.name, head.x + 10, head.y - 8);
            }
            for (let i = t.points.length - 1; i >= 0; i--) {
              t.points.at(i).life -= 0.045;
              if (t.points.at(i).life <= 0) t.points.splice(i, 1);
            }
          }
          actx.globalAlpha = 1; actx.shadowBlur = 0;
        }
        requestAnimationFrame(drawAuras);
      }
      requestAnimationFrame(drawAuras);

      // Pure Phone Shake Listener (Zero extra buttons on screen!)
      const RANDOM_CMDS = ['!holi', '!barish', '!diwali', '!aurora', '!meteor', '!tsunami', '!bijli'];
      let lastShakeAt = 0, lastX = null, lastY = null, lastZ = null;

      window.triggerRandomSpectacle = function() {
        const now = Date.now();
        if (now - lastShakeAt < 5200) return;
        lastShakeAt = now;
        const pick = RANDOM_CMDS.at(Math.floor(Math.random() * RANDOM_CMDS.length));
        if (typeof window.runLocalSpectacle === 'function') {
          window.runLocalSpectacle(pick.replace('!', ''));
        }
        if (typeof socket !== 'undefined' && socket.connected) {
          socket.emit('chatMessage', { text: pick, serverId: window.selectedServerId || 'global' });
        }
      };

      function onMotion(e) {
        const acc = e.accelerationIncludingGravity || e.acceleration;
        if (!acc || acc.x === null) return;
        if (lastX !== null) {
          const delta = Math.abs(acc.x - lastX) + Math.abs(acc.y - lastY) + Math.abs(acc.z - lastZ);
          if (delta > 19) window.triggerRandomSpectacle();
        }
        lastX = acc.x; lastY = acc.y; lastZ = acc.z;
      }

      window.addEventListener('devicemotion', onMotion, { passive: true });
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        window.addEventListener('touchstart', function askIOS() {
          DeviceMotionEvent.requestPermission().then(state => {
            if (state === 'granted') window.addEventListener('devicemotion', onMotion, { passive: true });
          }).catch(() => {});
        }, { once: true });
      }

      // Bind AI DJ & Cursor Aura Socket Listeners
      const waitP34 = setInterval(function() {
        if (typeof socket === 'undefined' || window._piece34Bound) return;
        window._piece34Bound = true;
        clearInterval(waitP34);

        socket.on('cursorAura', function(d) {
          if (d._serverId && window.selectedServerId && d._serverId !== window.selectedServerId) return;
          addTrailPoint(d.id, d.name, d.color, d.nx * window.innerWidth, d.ny * window.innerHeight);
        });

        socket.on('aiPlaySong', async function(d) {
          if (d._serverId && window.selectedServerId && d._serverId !== window.selectedServerId) return;
          const box = document.getElementById('aiDjBox'), title = document.getElementById('aiDjTitle'), audio = document.getElementById('aiDjAudio');
          if (!box || !audio) return;
          box.style.display = 'block'; title.textContent = '⏳ Loading: ' + d.query;
          try {
            const res = await fetch('/ai-song?q=' + encodeURIComponent(d.query));
            const data = await res.json();
            if (data && data.url) {
              title.textContent = '🎵 ' + data.title + (data.artist ? ' - ' + data.artist : '');
              audio.src = data.url;
              audio.play().catch(function() { title.textContent = '▶️ Tap Play: ' + data.title; });
            } else { title.textContent = '❌ Song not found'; }
          } catch (e) { title.textContent = '⚠️ Audio stream busy'; }
        });
      }, 500);
    })();
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (false && typeof body === 'string' && !body.includes('piece3And4Boot')) {
                body = body.replace('</body>', PIECE3_AND_4_HTML + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // ==================== END PIECE 3 & 4 ====================
           
    

    // ==================== PIECE 5A: SPECTACLE CANVAS & CORE SETUP ====================
    const PIECE5_PART1 = `
    <canvas id="sammuSpectacleCanvas" style="pointer-events:none;position:fixed;inset:0;width:100vw;height:100vh;z-index:999988;display:none;"></canvas>
    <div id="bijliFlashlightOverlay" style="pointer-events:none;position:fixed;inset:0;z-index:999989;display:none;background:radial-gradient(circle 115px at 50% 50%, transparent 0%, rgba(2,6,23,0.96) 100%);"></div>

    <script id="piece5FxBoot">
    (function() {
      const fxCanvas = document.getElementById('sammuSpectacleCanvas');
      const fctx = fxCanvas ? fxCanvas.getContext('2d') : null;
      const bijliDiv = document.getElementById('bijliFlashlightOverlay');

      function resizeFx() {
        if (!fxCanvas) return;
        fxCanvas.width = window.innerWidth || 800;
        fxCanvas.height = window.innerHeight || 600;
      }
      window.addEventListener('resize', resizeFx);
      resizeFx();

      let activeMode = null, endsAt = 0, animId = null;
      let particles = [], rockets = [], flashAlpha = 0;

      function updateFlashlight(x, y) {
        if (bijliDiv && bijliDiv.style.display === 'block') {
          bijliDiv.style.background = 'radial-gradient(circle 120px at ' + x + 'px ' + y + 'px, transparent 0%, rgba(2,6,23,0.96) 100%)';
        }
      }
      window.addEventListener('mousemove', e => updateFlashlight(e.clientX, e.clientY), { passive: true });
      window.addEventListener('touchmove', e => {
        if (e.touches && e.touches) updateFlashlight(e.touches.clientX, e.touches.clientY);
      }, { passive: true });

      function spawnFireworkBurst(x, y) {
        const cols = ['#ff007f', '#fee440', '#00f5d4', '#38bdf8', '#fb923c', '#a855f7'];
        const c = cols[Math.floor(Math.random() * cols.length)];
        for (let i = 0; i < 36; i++) {
          const ang = (Math.PI * 2 * i) / 36;
          const spd = 2 + Math.random() * 5.5;
          particles.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 1, color: c, size: 3 });
        }
      }

      function handleTapFirework(x, y) {
        if (activeMode === 'diwali' && Date.now() < endsAt) {
          rockets.push({ x, y: fxCanvas.height, targetY: y, vy: -14, color: '#fde047' });
        }
      }
      window.addEventListener('click', e => handleTapFirework(e.clientX, e.clientY));
      window.addEventListener('touchstart', e => {
        if (e.touches && e.touches) handleTapFirework(e.touches.clientX, e.touches.clientY);
      }, { passive: true });
      
      window.runLocalSpectacle = function(type) {
        if (!fxCanvas || !fctx) return;
        activeMode = type;
        endsAt = Date.now() + 5000;
        particles = []; rockets = []; flashAlpha = 0;

        if (type === 'bijli') {
          bijliDiv.style.display = 'block';
          setTimeout(() => { bijliDiv.style.display = 'none'; activeMode = null; }, 5000);
          return;
        }

        fxCanvas.style.display = 'block';
        const W = fxCanvas.width, H = fxCanvas.height;

        if (type === 'holi') {
          const cols = ['#ff007f', '#00f5d4', '#fee440', '#9b5de5', '#ff5400', '#00bbf9'];
          for (let i = 0; i < 26; i++) {
            particles.push({ x: Math.random() * W, y: Math.random() * H, r: 10, maxR: 55 + Math.random() * 95, color: cols[i % cols.length] });
          }
        } else if (type === 'barish') {
          for (let i = 0; i < 130; i++) particles.push({ x: Math.random() * W, y: Math.random() * H, vy: 11 + Math.random() * 8, len: 16 + Math.random() * 14 });
        } else if (type === 'meteor') {
          for (let i = 0; i < 18; i++) {
            particles.push({ x: Math.random() * W * 1.2, y: -Math.random() * H * 0.6, vx: -(7 + Math.random() * 6), vy: 7 + Math.random() * 6, color: i % 2 ? '#38bdf8' : '#fde047' });
          }
        } else if (type === 'diwali') {
          for (let i = 0; i < 5; i++) {
            rockets.push({ x: W * (0.15 + Math.random() * 0.7), y: H, targetY: H * (0.18 + Math.random() * 0.35), vy: -(11 + Math.random() * 4), color: '#fde047' });
          }
        } else if (type === 'tsunami') {
          for (let i = 0; i < 45; i++) particles.push({ x: Math.random() * W, y: H + Math.random() * 200, vy: -(2 + Math.random() * 4), r: 3 + Math.random() * 7 });
        }

        if (animId) cancelAnimationFrame(animId);
        function loop(now) {
          const left = endsAt - Date.now();
          if (left <= 0) {
            fctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
            fxCanvas.style.display = 'none';
            activeMode = null;
            return;
          }

          const W = fxCanvas.width, H = fxCanvas.height;
          fctx.clearRect(0, 0, W, H);
          const progress = 1 - left / 5000;

          if (activeMode === 'holi') {
            for (const p of particles) {
              p.r += (p.maxR - p.r) * 0.08;
              fctx.beginPath(); fctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
              fctx.fillStyle = p.color; fctx.globalAlpha = Math.max(0, (1 - progress) * 0.72); fctx.fill();
            }
            fctx.globalAlpha = 1;
          } else if (activeMode === 'barish') {
            if (Math.random() < 0.03) flashAlpha = 0.65;
            if (flashAlpha > 0) { fctx.fillStyle = 'rgba(224,242,254,' + flashAlpha + ')'; fctx.fillRect(0, 0, W, H); flashAlpha *= 0.84; }
            fctx.strokeStyle = 'rgba(56,189,248,0.75)'; fctx.lineWidth = 2;
            for (const p of particles) {
              fctx.beginPath(); fctx.moveTo(p.x, p.y); fctx.lineTo(p.x - 3, p.y + p.len); fctx.stroke();
              p.y += p.vy; p.x -= 1.5;
              if (p.y > H) { p.y = -20; p.x = Math.random() * W; }
            }
          } else if (activeMode === 'aurora') {
            const t = now * 0.002;
            for (const [col, hRatio] of [['rgba(16,185,129,0.38)', 0.22], ['rgba(56,189,248,0.34)', 0.30], ['rgba(168,85,247,0.32)', 0.38]]) {
              fctx.beginPath(); fctx.moveTo(0, 0);
              for (let x = 0; x <= W; x += 25) fctx.lineTo(x, H * hRatio + Math.sin(x * 0.006 + t + hRatio * 10) * 45 + Math.cos(x * 0.012 - t) * 25);
              fctx.lineTo(W, 0); fctx.closePath(); fctx.fillStyle = col; fctx.fill();
            }
          } else if (activeMode === 'meteor') {
            for (const m of particles) {
              const grad = fctx.createLinearGradient(m.x, m.y, m.x - m.vx * 8, m.y - m.vy * 8);
              grad.addColorStop(0, '#fff'); grad.addColorStop(0.3, m.color); grad.addColorStop(1, 'transparent');
              fctx.strokeStyle = grad; fctx.lineWidth = 3.5;
              fctx.beginPath(); fctx.moveTo(m.x, m.y); fctx.lineTo(m.x - m.vx * 8, m.y - m.vy * 8); fctx.stroke();
              m.x += m.vx; m.y += m.vy;
              if (m.y > H + 60 || m.x < -60) { m.x = Math.random() * W * 1.2 + 100; m.y = -40; }
            }
          } else if (activeMode === 'diwali') {
            if (Math.random() < 0.04 && left > 1200) rockets.push({ x: W * (0.1 + Math.random() * 0.8), y: H, targetY: H * (0.15 + Math.random() * 0.35), vy: -12, color: '#fde047' });
            for (let i = rockets.length - 1; i >= 0; i--) {
              const r = rockets[i];
              fctx.fillStyle = r.color; fctx.beginPath(); fctx.arc(r.x, r.y, 4, 0, Math.PI * 2); fctx.fill();
              r.y += r.vy;
              if (r.y <= r.targetY) { spawnFireworkBurst(r.x, r.y); rockets.splice(i, 1); }
            }
            for (let i = particles.length - 1; i >= 0; i--) {
              const p = particles[i];
              fctx.globalAlpha = Math.max(0, p.life); fctx.fillStyle = p.color;
              fctx.beginPath(); fctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); fctx.fill();
              p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life -= 0.022;
              if (p.life <= 0) particles.splice(i, 1);
            }
            fctx.globalAlpha = 1;
          } else if (activeMode === 'tsunami') {
            let level = 0.62;
            if (progress < 0.25) level = (progress / 0.25) * 0.62;
            else if (progress > 0.72) level = ((1 - progress) / 0.28) * 0.62;
            const baseY = H * (1 - level), t = now * 0.006;
            fctx.beginPath(); fctx.moveTo(0, H);
            for (let x = 0; x <= W; x += 20) fctx.lineTo(x, baseY + Math.sin(x * 0.012 + t) * 22 + Math.cos(x * 0.02 - t * 1.3) * 12);
            fctx.lineTo(W, H); fctx.closePath();
            fctx.fillStyle = 'rgba(2,132,199,0.45)'; fctx.fill();
            fctx.strokeStyle = 'rgba(186,230,253,0.85)'; fctx.lineWidth = 3; fctx.stroke();
            for (const b of particles) {
              if (b.y > baseY) { fctx.beginPath(); fctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); fctx.strokeStyle = 'rgba(224,242,254,0.7)'; fctx.stroke(); }
              b.y += b.vy; if (b.y < baseY) b.y = H + 20;
            }
          }
          animId = requestAnimationFrame(loop);
        }
        animId = requestAnimationFrame(loop);
      };

      const waitP5 = setInterval(function() {
        if (typeof socket === 'undefined' || window._piece5Bound) return;
        window._piece5Bound = true;
        clearInterval(waitP5);
        socket.on('chaosEvent', function(d) {
          if (d._serverId && window.selectedServerId && d._serverId !== window.selectedServerId) return;
          if (d && d.type) window.runLocalSpectacle(d.type);
        });
      }, 500);
    })();
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (false && typeof body === 'string' && !body.includes('piece5FxBoot')) {
                body = body.replace('</body>', PIECE5_PART1 + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // ==================== END PIECE 5 ====================


};
