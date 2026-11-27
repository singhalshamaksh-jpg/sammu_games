module.exports = function(ctx) {
    let { app, io, fs, path, serversDB, saveDB, OG_HOSTS, MASTER_KEYS, lockedOGSignatures, verifyOGHostTripleLock, arenas, getArena, syncArenaPlayers, IMPOSTER_WORDS, EXTRA_ANIME_QUIZ } = ctx;
    const getFullRoomPlayers = (srvId) => ctx.getFullRoomPlayers(srvId);
    const getCoins = (u) => ctx.getCoins(u);
    const addCoins = (u, a) => ctx.addCoins(u, a);
    const playerWallet = ctx.playerWallet;
    const playerCards = ctx.playerCards;

         // ==================== PIECE 6: WATER.IO (SMOOTH EAT, GROW, PVP + 6 SMART BOTS) ====================
    const waterPlayers = new Map();
    const waterDrops = [];
    const WATER_ARENA = 2200;
    const BOT_NAMES = ['AquaKing', 'Tsunami', 'JalPari', 'NeerajOP', 'HydroBot', 'WaveRider', 'DropletPro', 'Monsoon'];

    function spawnWaterDrop() {
        return {
            x: Math.floor(Math.random() * (WATER_ARENA - 120)) + 60,
            y: Math.floor(Math.random() * (WATER_ARENA - 120)) + 60,
            r: Math.random() < 0.15 ? 13 : 8,
            color: ['#38bdf8', '#22d3ee', '#818cf8', '#34d399', '#facc15'][Math.floor(Math.random() * 5)]
        };
    }
    while (waterDrops.length < 110) waterDrops.push(spawnWaterDrop());

    function spawnWaterBot(index) {
        const id = 'bot_' + index;
        const colors = ['#0ea5e9', '#14b8a6', '#6366f1', '#ec4899', '#f59e0b'];
        waterPlayers.set(id, {
            id, isBot: true, name: BOT_NAMES[index % BOT_NAMES.length],
            x: Math.floor(Math.random() * (WATER_ARENA - 400)) + 200,
            y: Math.floor(Math.random() * (WATER_ARENA - 400)) + 200,
            tx: WATER_ARENA / 2, ty: WATER_ARENA / 2,
            r: 26 + Math.floor(Math.random() * 18), boost: false,
            color: colors[index % colors.length]
        });
    }
    for (let b = 0; b < 6; b++) spawnWaterBot(b);

    const WATERIO_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<title>💧 Water.io - SammuGames</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; -webkit-user-select: none; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #041326; font-family: system-ui, sans-serif; color: #fff; }
  canvas { display: block; width: 100vw; height: 100vh; touch-action: none; }
  #hud { position: fixed; top: 12px; left: 12px; z-index: 10; background: rgba(7, 25, 48, 0.85); border: 1px solid #38bdf8; border-radius: 12px; padding: 8px 14px; font-weight: 800; font-size: 13px; display: flex; gap: 10px; align-items: center; }
  #backBtn { color: #fde047; text-decoration: none; font-weight: 900; border-right: 1px solid rgba(56,189,248,0.4); padding-right: 10px; }
  #lb { position: fixed; top: 12px; right: 12px; z-index: 10; background: rgba(7, 25, 48, 0.85); border: 1px solid #38bdf8; border-radius: 12px; padding: 8px 12px; font-size: 12px; min-width: 145px; }
  #startOverlay { position: fixed; inset: 0; z-index: 20; background: radial-gradient(circle at center, #0c2d57 0%, #030d1a 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 20px; }
  #startOverlay h1 { font-size: 38px; color: #38bdf8; text-shadow: 0 0 20px rgba(56,189,248,0.7); }
  #nameInput { padding: 12px 16px; border-radius: 12px; border: 2px solid #38bdf8; background: #081e3a; color: #fff; font-size: 16px; font-weight: 700; text-align: center; width: 240px; }
  #playBtn { padding: 12px 32px; border-radius: 12px; border: none; background: linear-gradient(135deg, #0284c7, #38bdf8); color: #031525; font-size: 18px; font-weight: 900; cursor: pointer; }
  #boostBtn { position: fixed; bottom: 22px; right: 22px; z-index: 15; width: 68px; height: 68px; border-radius: 50%; border: 2px solid #fde047; background: rgba(2, 132, 199, 0.85); color: #fde047; font-weight: 900; font-size: 13px; display: none; }
</style>
</head>
<body>
<div id="hud"><a id="backBtn" href="/">← Chat</a><span>💧 Size: <span id="massVal">28</span></span><span>🌊 <span id="onlineVal">7</span></span></div>
<div id="lb"><b>🏆 Leaderboard</b><div id="lbList" style="margin-top:4px;">Loading...</div></div>
<button id="boostBtn">⚡ BOOST</button>
<div id="startOverlay">
  <h1>💧 WATER.IO</h1>
  <p id="statusMsg" style="color:#bae6fd;font-size:14px;text-align:center;">Eat water orbs, bots & smaller players to grow!</p>
  <input id="nameInput" maxlength="16" placeholder="Enter your name..." />
  <button id="playBtn">🌊 PLAY NOW</button>
</div>
<canvas id="game"></canvas>
<script src="/socket.io/socket.io.js"></script>
<script>
(function() {
  const canvas = document.getElementById('game'), ctx = canvas.getContext('2d'), ARENA = ${WATER_ARENA};
  function resize() { canvas.width = window.innerWidth || 800; canvas.height = window.innerHeight || 600; }
  window.addEventListener('resize', resize); resize();

  const socket = (typeof io !== 'undefined') ? io() : null;
  let myId = null, playing = false, targetX = ARENA / 2, targetY = ARENA / 2, boosting = false;
  const targetState = { players: {}, drops: [] }, smoothPlayers = {};

  document.getElementById('playBtn').onclick = function() {
    const rawName = (document.getElementById('nameInput').value || '').trim() || ('Drop#' + Math.floor(100 + Math.random() * 899));
    document.getElementById('startOverlay').style.display = 'none';
    document.getElementById('boostBtn').style.display = 'block';
    playing = true;
    if (socket) socket.emit('waterJoin', { name: rawName });
  };

  function updatePointer(clientX, clientY) {
    const me = (myId && smoothPlayers[myId]) ? smoothPlayers[myId] : { x: ARENA / 2, y: ARENA / 2 };
    targetX = Math.max(20, Math.min(ARENA - 20, me.x + (clientX - canvas.width / 2)));
    targetY = Math.max(20, Math.min(ARENA - 20, me.y + (clientY - canvas.height / 2)));
  }
  window.addEventListener('mousemove', e => { if (playing) updatePointer(e.clientX, e.clientY); });
  window.addEventListener('touchmove', e => { if (playing && e.touches) updatePointer(e.touches.clientX, e.touches.clientY); }, { passive: true });
  window.addEventListener('touchstart', e => { if (playing && e.touches) updatePointer(e.touches.clientX, e.touches.clientY); }, { passive: true });

  const boostBtn = document.getElementById('boostBtn');
  boostBtn.addEventListener('touchstart', e => { e.stopPropagation(); boosting = true; });
  boostBtn.addEventListener('touchend', () => { boosting = false; });
  window.addEventListener('keydown', e => { if (e.code === 'Space') boosting = true; });
  window.addEventListener('keyup', e => { if (e.code === 'Space') boosting = false; });
      if (socket) {
    socket.on('connect', () => { myId = socket.id; });
    socket.on('waterState', data => {
      targetState.players = data.players || {};
      targetState.drops = data.drops || [];
      for (const id of Object.keys(smoothPlayers)) { if (!targetState.players[id]) delete smoothPlayers[id]; }
      for (const [id, p] of Object.entries(targetState.players)) {
        if (!smoothPlayers[id]) smoothPlayers[id] = { ...p };
        else { smoothPlayers[id].name = p.name; smoothPlayers[id].color = p.color; }
      }
      if (myId && targetState.players[myId]) document.getElementById('massVal').textContent = Math.floor(targetState.players[myId].r);
      const list = Object.values(targetState.players).sort((a, b) => b.r - a.r);
      document.getElementById('onlineVal').textContent = list.length;
      document.getElementById('lbList').innerHTML = list.slice(0, 5).map((p, i) => '<div>' + (i + 1) + '. ' + p.name.replace(/</g, '&lt;') + ' (' + Math.floor(p.r) + ')</div>').join('');
    });
    socket.on('waterEaten', (byName) => {
      playing = false;
      document.getElementById('statusMsg').textContent = '💥 Absorbed by ' + (byName || 'a bigger wave') + '! Play again?';
      document.getElementById('startOverlay').style.display = 'flex';
      document.getElementById('boostBtn').style.display = 'none';
    });
  }

  setInterval(() => { if (playing && socket && socket.connected) socket.emit('waterInput', { tx: targetX, ty: targetY, boost: boosting }); }, 40);

  function render() {
    for (const [id, tp] of Object.entries(targetState.players)) {
      const sp = smoothPlayers[id];
      if (sp) { sp.x += (tp.x - sp.x) * 0.25; sp.y += (tp.y - sp.y) * 0.25; sp.r += (tp.r - sp.r) * 0.2; }
    }
    ctx.fillStyle = '#041326'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const me = (myId && smoothPlayers[myId]) ? smoothPlayers[myId] : { x: ARENA / 2, y: ARENA / 2 };
    const camX = me.x - canvas.width / 2, camY = me.y - canvas.height / 2;

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.11)'; ctx.lineWidth = 1;
    for (let x = -(camX % 80); x < canvas.width; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = -(camY % 80); y < canvas.height; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }

    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 5; ctx.strokeRect(-camX, -camY, ARENA, ARENA);
    for (const d of targetState.drops) { ctx.beginPath(); ctx.arc(d.x - camX, d.y - camY, d.r, 0, Math.PI * 2); ctx.fillStyle = d.color; ctx.fill(); }

    const all = Object.values(smoothPlayers).sort((a, b) => a.r - b.r);
    for (const p of all) {
      const sx = p.x - camX, sy = p.y - camY;
      ctx.beginPath(); ctx.arc(sx, sy, p.r, 0, Math.PI * 2); ctx.fillStyle = p.color || '#38bdf8'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#e0f2fe'; ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold ' + Math.max(12, Math.min(22, p.r * 0.42)) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.name, sx, sy);
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();
</script>
</body>
</html>`;

    const waterIoMiddleware = (req, res, next) => {
        const cleanPath = (req.originalUrl || req.url || '').split('?')[0].replace(/\/+$/, '').toLowerCase();
    if (cleanPath === '/waterio' || cleanPath === '/water.io') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            return res.status(200).send(WATERIO_HTML);
        }
        return next();
    };
    app.use(waterIoMiddleware);
    const wStack = (app._router && app._router.stack) || (app.router && app.router.stack);
    if (Array.isArray(wStack)) {
        const idx = wStack.findIndex(l => l && l.handle === waterIoMiddleware);
        if (idx > 0) { const [layer] = wStack.splice(idx, 1); wStack.unshift(layer); }
    }
       io.on('connection', (socket) => {
        socket.on('waterJoin', (data) => {
            const name = String(data?.name || 'Droplet').replace(/[<>&"']/g, '').slice(0, 16) || 'Droplet';
            const colors = ['#38bdf8', '#0ea5e9', '#22d3ee', '#6366f1', '#10b981', '#f43f5e'];
            waterPlayers.set(socket.id, {
                id: socket.id, isBot: false, name,
                x: Math.floor(Math.random() * (WATER_ARENA - 300)) + 150,
                y: Math.floor(Math.random() * (WATER_ARENA - 300)) + 150,
                tx: WATER_ARENA / 2, ty: WATER_ARENA / 2, r: 28, boost: false,
                color: colors[Math.floor(Math.random() * colors.length)]
            });
            socket.join('waterio_room');
        });

        socket.on('waterInput', (inp) => {
            const p = waterPlayers.get(socket.id);
            if (!p || !inp) return;
            if (typeof inp.tx === 'number') p.tx = Math.max(20, Math.min(WATER_ARENA - 20, inp.tx));
            if (typeof inp.ty === 'number') p.ty = Math.max(20, Math.min(WATER_ARENA - 20, inp.ty));
            p.boost = !!inp.boost;
        });

        socket.on('disconnect', () => { waterPlayers.delete(socket.id); });
    });

    if (!global._waterIoLoopStarted) {
        global._waterIoLoopStarted = true;
        setInterval(() => {
            for (let b = 0; b < 6; b++) { if (!waterPlayers.has('bot_' + b)) spawnWaterBot(b); }
            const list = Array.from(waterPlayers.values());
            if (!list.some(p => !p.isBot)) return;

            for (const p of list) {
                if (p.isBot) {
                    let bestTarget = null, bestDist = Infinity;
                    for (const other of list) {
                        if (other.id === p.id) continue;
                        const d = Math.hypot(other.x - p.x, other.y - p.y);
                        if (other.r > p.r * 1.15 && d < 260) { bestTarget = { x: p.x - (other.x - p.x), y: p.y - (other.y - p.y) }; bestDist = 0; break; }
                        if (p.r > other.r * 1.15 && d < 420 && d < bestDist) { bestTarget = other; bestDist = d; }
                    }
                    if (!bestTarget) {
                        for (const drop of waterDrops) {
                            const d = Math.hypot(drop.x - p.x, drop.y - p.y);
                            if (d < bestDist) { bestTarget = drop; bestDist = d; }
                        }
                    }
                    if (bestTarget) { p.tx = Math.max(40, Math.min(WATER_ARENA - 40, bestTarget.x)); p.ty = Math.max(40, Math.min(WATER_ARENA - 40, bestTarget.y)); }
                }

                const dx = p.tx - p.x, dy = p.ty - p.y, dist = Math.hypot(dx, dy);
                if (dist > 3) {
                    const canBoost = p.boost && p.r > 32;
                    const speed = (canBoost ? 1.6 : 1) * Math.max(2.6, 7.2 - p.r * 0.02);
                    p.x = Math.max(p.r, Math.min(WATER_ARENA - p.r, p.x + (dx / dist) * speed));
                    p.y = Math.max(p.r, Math.min(WATER_ARENA - p.r, p.y + (dy / dist) * speed));
                    if (canBoost) p.r = Math.max(28, p.r - 0.08);
                }

                for (let i = waterDrops.length - 1; i >= 0; i--) {
                    const d = waterDrops[i];
                    if (Math.hypot(p.x - d.x, p.y - d.y) < p.r + d.r * 0.4) {
                        p.r = Math.min(260, Math.hypot(p.r, d.r * 0.65));
                        waterDrops.splice(i, 1); waterDrops.push(spawnWaterDrop());
                    }
                }
            }

            for (let i = 0; i < list.length; i++) {
                for (let j = i + 1; j < list.length; j++) {
                    const a = list[i], b = list[j];
                    if (!waterPlayers.has(a.id) || !waterPlayers.has(b.id)) continue;
                    const dist = Math.hypot(a.x - b.x, a.y - b.y);
                    if (a.r > b.r * 1.15 && dist < a.r - b.r * 0.35) {
                        a.r = Math.min(260, Math.hypot(a.r, b.r * 0.85)); waterPlayers.delete(b.id);
                        if (!b.isBot) io.to(b.id).emit('waterEaten', a.name);
                    } else if (b.r > a.r * 1.15 && dist < b.r - a.r * 0.35) {
                        b.r = Math.min(260, Math.hypot(b.r, a.r * 0.85)); waterPlayers.delete(a.id);
                        if (!a.isBot) io.to(a.id).emit('waterEaten', b.name);
                    }
                }
            }

            const playersObj = {};
            for (const [id, p] of waterPlayers.entries()) playersObj[id] = p;
            io.to('waterio_room').emit('waterState', { players: playersObj, drops: waterDrops });
        }, 33);
    }
    // ==================== END PIECE 6 ====================
                    

    // === 💧 WATER.IO LOBBY BUTTON & !WATERIO CHAT LAUNCHER ===
    const WATERIO_LAUNCHER_UI = `
    <script id="waterIoLauncherUI">
    (function() {
      if (window._waterIoLauncherBound) return;
      window._waterIoLauncherBound = true;

      function injectWaterBtn() {
        if (document.getElementById('btnLaunchWaterIo')) return;
        const anchor = Array.from(document.querySelectorAll('button')).find(b => /sammuverse|phonk dj|castaway island|hoop shootout/i.test(b.textContent || ''));
        if (anchor && anchor.parentElement) {
          const btn = anchor.cloneNode(true);
          btn.id = 'btnLaunchWaterIo';
          btn.removeAttribute('onclick');
          btn.textContent = '💧 Water.io';
          btn.style.background = 'linear-gradient(90deg, #0284c7, #06b6d4)';
          btn.onclick = function(e) {
            e.preventDefault();
            window.location.href = '/waterio';
          };
          anchor.parentElement.appendChild(btn);
        }
      }
      setInterval(injectWaterBtn, 2500);

      const waitWaterSock = setInterval(function() {
        if (typeof socket === 'undefined') return;
        clearInterval(waitWaterSock);
        socket.on('openWaterIo', function() {
          window.location.href = '/waterio';
        });
      }, 600);
    })();
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (false && typeof body === 'string' && !body.includes('waterIoLauncherUI')) {
                body = body.replace('</body>', WATERIO_LAUNCHER_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });

    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            if (typeof raw === 'string' && /^!(waterio|water\.io)$/i.test(raw.trim())) {
                socket.emit('openWaterIo');
            }
        });
    });

   
    // === ⚡ SINGLE FAST HTML WIDGET INJECTOR (REPLACES 5 NESTED WRAPPERS) ===
    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (false && typeof body === 'string' && !body.includes('_sammuAllWidgetsInjected')) {
                const bundle = ['<!-- _sammuAllWidgetsInjected -->', MULTI_SERVER_UI, WORD_IMPOSTER_WIDGET, ZORO_ISOLATION_SCRIPT, PHONK_DJ_WIDGET, AI_CONSOLE_WIDGET].join('\n');
                body = body.replace('</body>', bundle + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });

};
