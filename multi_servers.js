 const fs = require('fs');
const path = require('path');

module.exports = function initMultiServers(app, io) {
    const DB_FILE = path.join(__dirname, 'servers_db.json');

    const defaultServers = {
        srv_samaksh: { id: 'srv_samaksh', name: "💎 Samaksh's Arena",   owner: "samaksh", theme: "diamond", max: 20, type: "official" },
        srv_zoro:    { id: 'srv_zoro',    name: "⚔️ Zoro's Dojo",       owner: "zoro",    theme: "matrix",  max: 20, type: "official" },
        srv_milly:   { id: 'srv_milly',   name: "👑 Milly's Palace",    owner: "milly",   theme: "gold",    max: 20, type: "official" },
        srv_moon:    { id: 'srv_moon',    name: "🌙 Moon's Galaxy",     owner: "moon",    theme: "cyber",   max: 20, type: "official" },
        srv_heer:    { id: 'srv_heer',    name: "🌸 Heer's Haven",      owner: "heer",    theme: "crimson", max: 20, type: "official" },
        srv_izzan:   { id: 'srv_izzan',   name: "🔥 Izzan's Fortress",  owner: "izzan",   theme: "crimson", max: 20, type: "official" },
        srv_ishika:  { id: 'srv_ishika',  name: "✨ Ishika's Lounge",   owner: "ishika",  theme: "gold",    max: 20, type: "official" },
        srv_sus:     { id: 'srv_sus',     name: "👀 Sus Bunker",        owner: "sus",     theme: "matrix",  max: 20, type: "official" },
        srv_sarah:   { id: 'srv_sarah',   name: "🦋 Sarah's Sanctuary", owner: "sarah",   theme: "cyber",   max: 20, type: "official" },
        srv_advait:  { id: 'srv_advait',  name: "⚡ Advait's Citadel",  owner: "advait",  theme: "diamond", max: 20, type: "official" },
        srv_ruwii:   { id: 'srv_ruwii',   name: "🌺 Ruwii's Garden",    owner: "ruwii",   theme: "gold",    max: 20, type: "official" },
        srv_zaira:  { id: 'srv_zaira',  name: "🪐 zaira's Orbit",    owner: "zaira",  theme: "cyber",   max: 20, type: "official" },
        srv_shubhi:  { id: 'srv_shubhi',  name: "💖 Shubhi's Castle",   owner: "shubhi",  theme: "crimson", max: 20, type: "official" },
        srv_sid:     { id: 'srv_sid',     name: "🦁 Sid's Kingdom",     owner: "sid",     theme: "gold",    max: 20, type: "official" },
        srv_diamond: { 
            id: 'srv_diamond', 
            name: "💠 DIAMOND SERVER (OG Hosts Only)", 
            owner: "sammu", 
            theme: "diamond", 
            max: 20, 
            type: "secret", 
            password: "#bhaibahencharaontop" 
        }
    };
    let serversDB = { ...defaultServers };
    let lockedOGSignatures = {};
    let millyPromoOn = false;

    if (fs.existsSync(DB_FILE)) {
        try {
            const saved = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            delete saved.srv_bonus;
            if (saved._lockedOGSignatures) {
                lockedOGSignatures = saved._lockedOGSignatures;
                delete saved._lockedOGSignatures;
            }
            if (typeof saved._millyPromoOn === 'boolean') {
                millyPromoOn = saved._millyPromoOn;
                delete saved._millyPromoOn;
            }
            serversDB = { ...defaultServers, ...saved };
        } catch (e) {}
    }

    function saveDB() {
        try {
            fs.writeFileSync(DB_FILE, JSON.stringify({
                ...serversDB,
                _lockedOGSignatures: lockedOGSignatures,
                _millyPromoOn: millyPromoOn
            }, null, 2));
        } catch (e) {}
    }
    saveDB();
    const activeCounts = {};
    const OG_HOSTS = new Set([
        "sammu", "samaksh", "zoro", "milly", "moon", "heer", "izzan", "ishika", "sus",
        "sarah", "advait", "ruwii", "zaira", "shubhi", "sid"
    ]);
    const MASTER_KEYS = new Set(["#bhaibahencharaontop", "#universalbrother"]);
    const arenas = new Map();

    function getArena(serverId) {
        if (!arenas.has(serverId)) {
            arenas.set(serverId, {
                id: serverId,
                players: [],
                hostId: null,
                captainA: null,
                captainB: null,
                scores: { teamA: 0, teamB: 0 },
                gameState: 'lobby',
                tourney: {
                    active: false, round: 0, maxGames: 15, gamesPlayed: 0,
                    queue: [], nextRound: [], eliminated: [],
                    matchScores: {}, currentPair: null, timer: null
                }
            });
        }
        return arenas.get(serverId);
    }

    function syncArenaPlayers(serverId) {
        const arena = getArena(serverId);
        const roomSockets = io.sockets.adapter.rooms.get(serverId) || new Set();
        arena.players = arena.players.filter(p => roomSockets.has(p.id));
        io.to(serverId).emit('updatePlayers', arena.players);
    }

    const origIoEmit = io.emit.bind(io);
    const playerServerMap = new Map();
    let lastActiveServerId = null;

    function getSocketServerId(socketId) {
        const s = io.sockets.sockets.get(socketId);
        return s ? s.activeServerId : null;
    }

    function findServerForPayload(payload) {
        if (!payload || typeof payload !== 'object') return null;
        if (payload._serverId) return payload._serverId;
        if (payload.senderId) {
            const byId = getSocketServerId(payload.senderId);
            if (byId) return byId;
        }
        if (payload.captainA && payload.captainA.id) {
            const byA = getSocketServerId(payload.captainA.id);
            if (byA) return byA;
        }
        if (payload.captainB && payload.captainB.id) {
            const byB = getSocketServerId(payload.captainB.id);
            if (byB) return byB;
        }
                if (payload.username) {
            const rawU = payload.username.toLowerCase().trim();
            if (playerServerMap.has(rawU)) return playerServerMap.get(rawU);
            const strippedU = rawU.replace(/[^a-z0-9_]/g, '');
            for (const [uname, srvId] of playerServerMap.entries()) {
                if (uname.replace(/[^a-z0-9_]/g, '') === strippedU && strippedU.length > 0) {
                    return srvId;
                }
            }
        }
        return null;

        if (typeof payload.text === 'string') {
            const lower = payload.text.toLowerCase();
            for (const [uname, srvId] of playerServerMap.entries()) {
                if (uname.length >= 2 && lower.includes(uname)) return srvId;
            }
        }
        return null;
    }
    io.emit = function(event, ...args) {
        if (event === 'serverListUpdate') {
            return origIoEmit(event, ...args);
        }
        if (event === 'toggleDidiPromo') {
            millyPromoOn = Boolean(args.at(0));
            saveDB();
            io.to('srv_milly').emit('toggleDidiPromo', millyPromoOn);
            Object.keys(serversDB).forEach(id => {
                if (id !== 'srv_milly') io.to(id).emit('toggleDidiPromo', false);
            });
            return true;
        }
        if (event === 'updatePlayers' && Array.isArray(args.at(0))) {
            Object.keys(serversDB).forEach(srvId => syncArenaPlayers(srvId));
            return true;
        }
                const payload = args.at(0);
        const targetSrv = findServerForPayload(payload) || lastActiveServerId;
        if (targetSrv) {
            const arena = getArena(targetSrv);
            if (event === 'announceWinner' && payload && typeof payload === 'object') {
                handleArenaTourneyMatchEnd(targetSrv, payload.winner);
            }
            if (event === 'syncGame' && payload && typeof payload === 'object') {
                const prevState = arena.gameState;
                arena.gameState = payload.gameState || 'lobby';
                arena.scores = payload.scores || arena.scores;
                if (payload.captainA) arena.captainA = payload.captainA;
                if (payload.captainB) arena.captainB = payload.captainB;

                if (prevState !== 'lobby' && arena.gameState === 'lobby' && arena.tourney.active && arena.tourney.awaitingResult) {
                    handleArenaTourneyMatchEnd(targetSrv, '');
                }
            }
            const stamped = (payload && typeof payload === 'object' && !Array.isArray(payload))
                ? { ...payload, _serverId: targetSrv }
                : payload;
            return io.to(targetSrv).emit(event, stamped);
        }

        return true;
    };

    function getRealIP(socket) {
        const fwd = socket.handshake && socket.handshake.headers && socket.handshake.headers['x-forwarded-for'];
        if (fwd && typeof fwd === 'string') return fwd.split(',').at(0).trim();
        return (socket.handshake && socket.handshake.address) || null;
    }

    function getBrowserSig(socket, clientBrowserFp) {
        const ua = (socket.handshake && socket.handshake.headers && socket.handshake.headers['user-agent']) || '';
        return `${ua}|${clientBrowserFp || ''}`.trim();
    }

    function attachTracking(socket, data) {
        if (data && data.deviceId) socket.trackedDeviceId = String(data.deviceId);
        if (data && data.browserFp) socket.trackedBrowserFp = String(data.browserFp);
        socket.trackedIP = getRealIP(socket);
        socket.trackedBrowser = getBrowserSig(socket, socket.trackedBrowserFp);
        if (socket.username && socket.activeServerId) {
            playerServerMap.set(socket.username.toLowerCase(), socket.activeServerId);
        }
        if (socket.activeServerId) {
            lastActiveServerId = socket.activeServerId;
        }
    }
    function verifyOGHostTripleLock(uname, socket, secretKeyProvided) {
        const clean = (uname || '').trim().toLowerCase();
        if (!clean || !OG_HOSTS.has(clean)) return false;

        const devId = socket.trackedDeviceId || null;
        const ip = socket.trackedIP || getRealIP(socket);
        const browser = socket.trackedBrowser || getBrowserSig(socket, socket.trackedBrowserFp);

        const existing = lockedOGSignatures[clean];
        if (!existing || secretKeyProvided) {
            lockedOGSignatures[clean] = { deviceId: devId, ip: ip, browser: browser };
            saveDB();
            return true;
        }

        const devMatch = devId && existing.deviceId && devId === existing.deviceId;
        const ipMatch = ip && existing.ip && ip === existing.ip;
        const browserMatch = browser && existing.browser && browser === existing.browser;

        if (devMatch || (ipMatch && browserMatch)) {
            if (devId && !existing.deviceId) existing.deviceId = devId;
            if (ip && existing.ip !== ip && devMatch) existing.ip = ip;
            if (devId && existing.deviceId !== devId && (ipMatch && browserMatch)) existing.deviceId = devId;
            saveDB();
            return true;
        }
        return false;
    }

    function isAnyLockedOGSignature(socket) {
        const devId = socket.trackedDeviceId || null;
        const ip = socket.trackedIP || getRealIP(socket);
        const browser = socket.trackedBrowser || getBrowserSig(socket, socket.trackedBrowserFp);

        return Object.values(lockedOGSignatures).some(sig => {
            if (!sig) return false;
            const devMatch = devId && sig.deviceId && devId === sig.deviceId;
            const ipMatch = ip && sig.ip && ip === sig.ip;
            const browserMatch = browser && sig.browser && browser === sig.browser;
            return devMatch || (ipMatch && browserMatch);
        });
    }

    function getPublicServerList() {
        const now = Date.now();
        return Object.values(serversDB).map(s => {
            const expired = (s.type === 'custom' && !s.permanent && s.expiresAt && now > s.expiresAt);
            const daysLeft = (s.type === 'custom' && !s.permanent && s.expiresAt) 
                ? Math.max(0, Math.ceil((s.expiresAt - now) / (1000 * 60 * 60 * 24))) 
                : null;
            const refCount = Array.isArray(s.referrals) ? s.referrals.length : 0;
            return {
                id: s.id, name: s.name, owner: s.owner, theme: s.theme,
                max: s.max || 20, count: activeCounts[s.id] || 0, type: s.type,
                locked: s.type === 'secret' || Boolean(s.password), expired, permanent: Boolean(s.permanent),
                daysLeft, refCount
            };
        });
    }
    const MULTI_SERVER_UI = `
    <style>
      #srvBrowserOverlay { position:fixed; inset:0; background:rgba(7,11,25,0.96); z-index:999999; display:flex; align-items:center; justify-content:center; padding:12px; font-family:inherit; backdrop-filter:blur(12px); }
      #srvBrowserBox { background:linear-gradient(160deg,#0f172a,#1e1b4b); border:2px solid #38bdf8; border-radius:22px; padding:16px; width:100%; max-width:440px; max-height:92vh; overflow-y:auto; color:#fff; box-shadow:0 0 40px rgba(56,189,248,0.4); }
      .srv-card { background:rgba(255,255,255,0.07); border:1.5px solid rgba(56,189,248,0.4); border-radius:14px; padding:10px 12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition:0.2s; }
      .srv-card:hover { background:rgba(56,189,248,0.2); transform:translateY(-1px); }
      .srv-card.diamond { border-color:#67e8f9; background:linear-gradient(90deg,rgba(6,182,212,0.25),rgba(168,85,247,0.25)); box-shadow:0 0 15px rgba(103,232,249,0.3); }
      .srv-card.gold { border-color:#facc15; }
      .srv-card.full { opacity:0.55; pointer-events:none; }
      .srv-pill { font-size:11px; font-weight:bold; padding:4px 9px; border-radius:12px; background:#0284c7; color:#fff; text-align:right; }
      .srv-tabs { display:flex; gap:6px; margin:10px 0; }
      .srv-tab { flex:1; padding:8px; border-radius:12px; border:1px solid #38bdf8; background:#1e293b; color:#fff; font-weight:bold; font-size:12px; cursor:pointer; }
      .srv-tab.active { background:#38bdf8; color:#090d16; }
      .srv-input { width:100%; padding:10px; border-radius:12px; border:1.5px solid #38bdf8; background:#0f172a; color:#fff; margin-bottom:8px; box-sizing:border-box; font-size:13px; }
    </style>
    <div id="srvBrowserOverlay">
      <div id="srvBrowserBox">
        <div style="text-align:center;margin-bottom:8px;">
          <div style="font-size:19px;font-weight:900;color:#38bdf8;">🌐 SAMMU GAMES UNIVERSE</div>
          <div style="font-size:12px;color:#cbd5e1;">Select a Server (Max 20 Players Each)</div>
        </div>
        <div class="srv-tabs">
          <button class="srv-tab active" id="tabOfficial" onclick="switchSrvTab('official')">🏟️ 15 Official Servers</button>
          <button class="srv-tab" id="tabCustom" onclick="switchSrvTab('custom')">✨ Custom / Trial Servers</button>
        </div>
        <div id="srvListContainer"></div>
        <div id="createSrvSection" style="display:none;margin-top:10px;border-top:1px solid rgba(255,255,255,0.15);padding-top:10px;">
          <div style="font-weight:bold;font-size:13px;color:#fde047;margin-bottom:6px;">🎁 Create Your Own Server (7-Day FREE Trial!)</div>
          <input id="newSrvName" class="srv-input" placeholder="Server Name (e.g. Aarav's Squad)" maxlength="24">
          <input id="newSrvOwner" class="srv-input" placeholder="Your Exact Username (Gets Host Commands)" maxlength="20">
          <select id="newSrvTheme" class="srv-input">
            <option value="cyber">🌌 Cyber Theme</option>
            <option value="diamond">💎 Diamond Theme</option>
            <option value="gold">👑 Royal Gold Theme</option>
            <option value="matrix">🟢 Matrix Theme</option>
            <option value="crimson">🔥 Crimson Theme</option>
          </select>
          <button onclick="createTrialServer()" style="width:100%;padding:10px;border:none;border-radius:12px;background:linear-gradient(90deg,#10b981,#059669);color:#fff;font-weight:900;cursor:pointer;">🚀 Launch 7-Day Free Trial Server</button>
          <div style="font-size:11px;color:#94a3b8;margin-top:6px;text-align:center;line-height:1.4;">
            🔗 <b>Extend Free:</b> Bring <b>15 new players</b> via your referral link = <b>+1 Extra Week FREE!</b><br>
            💎 <b>Permanent VIP Server:</b> Email an Amazon Pay or Google Play Gift Code to <b style="color:#38bdf8;">singhalshamaksh@gmail.com</b>
          </div>
        </div>
      </div>
    </div>
    <script>
    (function() {
      let currentTab = 'official', allServers = [];
      let isLockedHostDevice = false;
      window.selectedServerId = null;

      const urlParams = new URLSearchParams(window.location.search);
      const refOwner = urlParams.get('ref');
      if (refOwner) localStorage.setItem('sammu_pending_ref', refOwner.trim().toLowerCase());

      let devId = localStorage.getItem('sammu_dev_uid');
      if (!devId) {
        devId = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('sammu_dev_uid', devId);
      }

      const browserFp = [
        navigator.platform || '',
        screen.width + 'x' + screen.height + 'x' + screen.colorDepth,
        navigator.hardwareConcurrency || '',
        navigator.deviceMemory || '',
        Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        navigator.language || ''
      ].join('~');

      window.switchSrvTab = function(tab) {
        currentTab = tab;
        document.getElementById('tabOfficial').classList.toggle('active', tab === 'official');
        document.getElementById('tabCustom').classList.toggle('active', tab === 'custom');
        document.getElementById('createSrvSection').style.display = (tab === 'custom') ? 'block' : 'none';
        renderServerList();
      };

      window.copyMyRefLink = function(ownerName) {
        const link = window.location.origin + '/?ref=' + encodeURIComponent(ownerName.toLowerCase());
        if (navigator.clipboard) navigator.clipboard.writeText(link);
        alert('🔗 Referral Link Copied!\\n' + link + '\\n\\nInvite 15 new players using this link for +7 DAYS FREE, or email an Amazon/Google Play Gift Code to singhalshamaksh@gmail.com for a PERMANENT server!');
      };

      function renderServerList() {
        const box = document.getElementById('srvListContainer');
        if (!box) return;
        box.innerHTML = '';
        const filtered = allServers.filter(s => currentTab === 'official' ? (s.type === 'official' || s.type === 'secret') : s.type === 'custom');
        if (filtered.length === 0) {
          box.innerHTML = '<div style="text-align:center;color:#94a3b8;font-size:12px;padding:14px;">No custom servers yet! Create your 7-day free trial below 👇</div>';
          return;
        }
        filtered.forEach(s => {
          const isFull = s.count >= s.max;
          const div = document.createElement('div');
          div.className = 'srv-card ' + (s.theme || '') + (isFull ? ' full' : '');
          let badge = s.count + '/' + s.max + ' 👥';
          let subLine = 'Host: ' + s.owner.toUpperCase();

          if (s.locked) badge = '🔐 OG PASS | ' + badge;
          else if (s.expired) {
            badge = '🔒 EXPIRED (' + s.refCount + '/15 Refs)';
            subLine = 'Bring ' + (15 - s.refCount) + ' more refs or email singhalshamaksh@gmail.com';
          } else if (s.type === 'custom' && !s.permanent) {
            badge = '⏳ ' + s.daysLeft + 'd | ' + badge;
            subLine = 'Host: ' + s.owner.toUpperCase() + ' | Refs: ' + s.refCount + '/15';
          } else if (s.permanent) {
            badge = '⭐ VIP | ' + badge;
          }

          div.innerHTML = '<div><div style="font-weight:bold;font-size:13px;">' + s.name + '</div><div style="font-size:11px;color:#94a3b8;">' + subLine + '</div></div><div class="srv-pill">' + badge + '</div>';
          div.onclick = () => selectAndEnterServer(s);
          box.appendChild(div);

          if (s.type === 'custom' && !s.permanent) {
            const refBtn = document.createElement('div');
            refBtn.style.cssText = 'text-align:right;margin:-4px 0 8px 0;';
            refBtn.innerHTML = '<button onclick="event.stopPropagation();copyMyRefLink(\\'' + s.owner + '\\')" style="background:#059669;border:none;color:#fff;font-size:11px;font-weight:bold;padding:3px 10px;border-radius:8px;cursor:pointer;">🔗 Copy Invite Link (' + s.refCount + '/15 for +7 Days)</button>';
            box.appendChild(refBtn);
          }
        });
      }
      function selectAndEnterServer(srv) {
        if (srv.expired && !isLockedHostDevice) {
          const link = window.location.origin + '/?ref=' + encodeURIComponent(srv.owner);
          alert('🔒 Your 7-Day Free Trial has ended!\\n\\nOption 1 (FREE): Share your link with ' + (15 - srv.refCount) + ' more friends to unlock +7 DAYS:\\n' + link + '\\n\\nOption 2 (PERMANENT): Email an Amazon Pay or Google Play Gift Code (with your Server Name) to singhalshamaksh@gmail.com!');
          return;
        }
        let pass = '';
        if (srv.locked && !isLockedHostDevice) {
          pass = prompt('💠 PRIVATE SERVER\\nEnter Secret Password:');
          if (!pass) return;
        }
        if (typeof socket !== 'undefined') {
          socket.emit('verifyServerAccess', { serverId: srv.id, password: pass, deviceId: devId, browserFp });
        }
      }

      window.createTrialServer = function() {
        const name = document.getElementById('newSrvName').value.trim();
        const owner = document.getElementById('newSrvOwner').value.trim();
        const theme = document.getElementById('newSrvTheme').value;
        if (!name || !owner) { alert('Please enter both Server Name and your Username!'); return; }
        if (typeof socket !== 'undefined') {
          socket.emit('createCustomServer', { name, owner, theme, deviceId: devId, browserFp });
        }
      };

      function updateDidiBannerVisibility(show) {
        const box = document.getElementById('didiPromoBox');
        if (!box) return;
        box.style.display = (show && window.selectedServerId === 'srv_milly') ? 'block' : 'none';
      }

      function upgradeHornToMemeMaker() {
        const btns = Array.from(document.querySelectorAll('button'));
        const hornBtn = btns.find(b => /horn|airhorn|📯|📢/i.test(b.textContent || '') || (b.getAttribute('onclick') || '').includes('airhorn'));
        if (hornBtn && !hornBtn.dataset.memeUpgraded) {
          hornBtn.dataset.memeUpgraded = 'true';
          hornBtn.innerHTML = '😂 Meme Studio';
          hornBtn.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
          hornBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            openMemeMakerModal();
          };
        }
      }

      const MEME_TEMPLATES = [
        { name: "🔥 Classic Drake Choice", bg1: "#1e293b", bg2: "#f59e0b", emoji: "🙅‍♂️ / 👉😎" },
        { name: "🐶 This Is Fine Fire", bg1: "#7f1d1d", bg2: "#ea580c", emoji: "🐶☕🔥🔥" },
        { name: "🤡 Clown Transformation", bg1: "#311042", bg2: "#ec4899", emoji: "🧑 ➡️ 🤡" },
        { name: "🧠 Galaxy Brain", bg1: "#090d16", bg2: "#38bdf8", emoji: "🧠⚡🌌" },
        { name: "💀 Skull Bruh Moment", bg1: "#111827", bg2: "#6b7280", emoji: "💀🗿" },
        { name: "🗿 Gigachad Sigma", bg1: "#18181b", bg2: "#a1a1aa", emoji: "🗿💪🔥" },
        { name: "👀 Side-Eye Monkey", bg1: "#422006", bg2: "#eab308", emoji: "🐒👀💦" },
        { name: "🚨 FBI Open Up", bg1: "#1e3a8a", bg2: "#dc2626", emoji: "🚓🚨🚪💥" },
        { name: "💸 Take My Money", bg1: "#064e3b", bg2: "#10b981", emoji: "Shut Up & 💵💵" },
        { name: "😭 Emotional Damage", bg1: "#4c0519", bg2: "#f43f5e", emoji: "💔😭👟" },
        { name: "👑 Host Power Abuse", bg1: "#3b0764", bg2: "#facc15", emoji: "👑😈🔨" },
        { name: "💣 Bomb Pass Panic", bg1: "#7c2d12", bg2: "#f97316", emoji: "😱💣⏱️💥" }
      ];

      window._memeStickers = [];
      window._memeTextColor = '#ffffff';
      window._memeFilter = 'none';
          window.openMemeMakerModal = function() {
        let modal = document.getElementById('arenaMemeModal');
        if (!modal) {
          modal = document.createElement('div');
          modal.id = 'arenaMemeModal';
          modal.style.cssText = 'position:fixed;inset:0;background:rgba(7,11,25,0.94);z-index:999998;display:flex;align-items:center;justify-content:center;padding:10px;backdrop-filter:blur(8px);';
          const opts = MEME_TEMPLATES.map((t, i) => '<option value="' + i + '">' + t.name + '</option>').join('');
          const stickers = ['😂','💀','🔥','🤡','👑','🧢','😭','🗿'].map(em => '<button onclick="addMemeSticker(\\'' + em + '\\')" style="background:#1e293b;border:1px solid #475569;border-radius:8px;padding:2px 6px;font-size:14px;cursor:pointer;">' + em + '</button>').join('');
          modal.innerHTML =
            '<div style="background:#0f172a;border:2px solid #f59e0b;border-radius:20px;padding:12px;width:100%;max-width:410px;color:#fff;text-align:center;box-shadow:0 0 30px rgba(245,158,11,0.4);max-height:94vh;overflow-y:auto;">' +
              '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
                '<span style="font-weight:900;font-size:15px;color:#fbbf24;">😂 PRO MEME STUDIO</span>' +
                '<button onclick="document.getElementById(\\'arenaMemeModal\\').style.display=\\'none\\'" style="background:#ef4444;border:none;color:#fff;border-radius:8px;padding:4px 10px;font-weight:bold;cursor:pointer;">✕ Close</button>' +
              '</div>' +
              '<div style="display:flex;gap:6px;margin-bottom:6px;">' +
                '<select id="memeTemplateSelect" onchange="window._memeCustomImg=null;renderMemeCanvas()" style="flex:1;padding:8px;border-radius:10px;border:1.5px solid #f59e0b;background:#1e293b;color:#fff;font-size:12px;">' + opts + '</select>' +
                '<button type="button" onclick="loadMemeFromUrl()" style="background:#0284c7;color:#fff;padding:8px 10px;border-radius:10px;font-size:11px;font-weight:bold;cursor:pointer;white-space:nowrap;border:1px solid #38bdf8;">🌐 Link</button>' +
                '<label style="background:#334155;color:#fff;padding:8px 10px;border-radius:10px;font-size:11px;font-weight:bold;cursor:pointer;white-space:nowrap;border:1px solid #64748b;display:inline-flex;align-items:center;">' +
                  '📸 Photo' +
                  '<input id="memeFileInput" type="file" accept="image/*" onchange="loadCustomMemePhoto(event)" style="width:1px;height:1px;opacity:0;position:absolute;">' +
                '</label>' +
              '</div>' +
              '<input id="memeTopText" oninput="renderMemeCanvas()" placeholder="TOP TEXT..." maxlength="40" style="width:100%;padding:7px;border-radius:10px;border:1.5px solid #38bdf8;background:#090d16;color:#fff;margin-bottom:5px;box-sizing:border-box;font-size:16px;">' +
              '<input id="memeBottomText" oninput="renderMemeCanvas()" placeholder="BOTTOM TEXT..." maxlength="40" style="width:100%;padding:7px;border-radius:10px;border:1.5px solid #38bdf8;background:#090d16;color:#fff;margin-bottom:6px;box-sizing:border-box;font-size:16px;">' +
              '<div style="display:flex;gap:6px;align-items:center;justify-content:space-between;margin-bottom:6px;background:#1e293b;padding:6px 8px;border-radius:10px;font-size:11px;">' +
                '<span>Size: <input id="memeFontSize" type="range" min="16" max="34" value="22" oninput="renderMemeCanvas()" style="width:65px;vertical-align:middle;"></span>' +
                '<span style="display:flex;gap:4px;">' +
                  '<button onclick="window._memeTextColor=\\'#ffffff\\';renderMemeCanvas()" style="width:18px;height:18px;border-radius:50%;background:#fff;border:1px solid #38bdf8;cursor:pointer;"></button>' +
                  '<button onclick="window._memeTextColor=\\'#facc15\\';renderMemeCanvas()" style="width:18px;height:18px;border-radius:50%;background:#facc15;border:1px solid #fff;cursor:pointer;"></button>' +
                  '<button onclick="window._memeTextColor=\\'#ef4444\\';renderMemeCanvas()" style="width:18px;height:18px;border-radius:50%;background:#ef4444;border:1px solid #fff;cursor:pointer;"></button>' +
                  '<button onclick="window._memeTextColor=\\'#4ade80\\';renderMemeCanvas()" style="width:18px;height:18px;border-radius:50%;background:#4ade80;border:1px solid #fff;cursor:pointer;"></button>' +
                '</span>' +
                '<select id="memeFilterSelect" onchange="window._memeFilter=this.value;renderMemeCanvas()" style="padding:3px;border-radius:6px;background:#0f172a;color:#fff;border:1px solid #38bdf8;font-size:11px;">' +
                  '<option value="none">🎨 Normal</option>' +
                  '<option value="contrast(220%) saturate(300%)">🔥 Deep-Fry</option>' +
                  '<option value="grayscale(100%)">🖤 B&W</option>' +
                  '<option value="invert(100%)">👾 Invert</option>' +
                  '<option value="sepia(90%)">📜 Vintage</option>' +
                '</select>' +
              '</div>' +
              '<div style="display:flex;gap:5px;justify-content:center;align-items:center;margin-bottom:6px;flex-wrap:wrap;"><span style="font-size:11px;color:#94a3b8;">Stickers:</span>' + stickers + '<button onclick="window._memeStickers.pop();renderMemeCanvas()" style="background:#dc2626;color:#fff;border:none;border-radius:8px;padding:3px 7px;font-size:10px;font-weight:bold;cursor:pointer;">Undo</button></div>' +
              '<canvas id="arenaMemeCanvas" width="340" height="250" onclick="moveLastSticker(event)" style="border:1.5px solid #fbbf24;border-radius:12px;max-width:100%;background:#090d16;cursor:pointer;"></canvas>' +
              '<div style="font-size:10px;color:#94a3b8;margin-top:3px;">Tap anywhere on canvas to move last sticker!</div>' +
              '<div style="display:flex;gap:6px;margin-top:8px;">' +
                '<button onclick="downloadMemeLocally()" style="flex:1;padding:9px;border:none;border-radius:12px;background:#334155;color:#fff;font-weight:bold;font-size:12px;cursor:pointer;">💾 Save</button>' +
                '<button onclick="postMemeToChat()" style="flex:2;padding:9px;border:none;border-radius:12px;background:linear-gradient(90deg,#10b981,#059669);color:#fff;font-weight:900;font-size:13px;cursor:pointer;">🚀 Post to Chat!</button>' +
              '</div>' +
            '</div>';
          document.body.appendChild(modal);
        }
        modal.style.display = 'flex';
        renderMemeCanvas();
      };

      window.loadMemeFromUrl = function() {
        var url = prompt('Paste any Image Link (JPG/PNG/GIF):');
        if (!url) return;
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
          var off = document.createElement('canvas');
          off.width = 340;
          off.height = 250;
          off.getContext('2d').drawImage(img, 0, 0, 340, 250);
          window._memeCustomImg = off;
          renderMemeCanvas();
        };
        img.onerror = function() {
          alert('That website blocks direct image loading—try another image link!');
        };
        img.src = url.trim();
      };

      window.addMemeSticker = function(emoji) {
        window._memeStickers.push({ emoji, x: 170 + (Math.random() * 40 - 20), y: 125 + (Math.random() * 40 - 20) });
        renderMemeCanvas();
      };

      window.moveLastSticker = function(e) {
        if (!window._memeStickers.length) return;
        const c = document.getElementById('arenaMemeCanvas');
        const rect = c.getBoundingClientRect();
        const last = window._memeStickers.at(-1);
        last.x = (e.clientX - rect.left) * (c.width / rect.width);
        last.y = (e.clientY - rect.top) * (c.height / rect.height);
        renderMemeCanvas();
      };
      window.loadCustomMemePhoto = function(e) {
        try {
          var input = e && e.target ? e.target : document.getElementById('memeFileInput');
          var file = (input && input.files && input.files.length > 0) ? input.files.item(0) : null;
          if (!file) return;
          var objUrl = URL.createObjectURL(file);
          var img = new Image();
          img.onload = function() {
            var off = document.createElement('canvas');
            off.width = 340;
            off.height = 250;
            off.getContext('2d').drawImage(img, 0, 0, 340, 250);
            window._memeCustomImg = off;
            URL.revokeObjectURL(objUrl);
            if (input) input.value = '';
            renderMemeCanvas();
          };
          img.onerror = function() {
            URL.revokeObjectURL(objUrl);
            alert('Could not load photo! Try a JPG or PNG.');
          };
          img.src = objUrl;
        } catch (err) {
          alert('Photo Error: ' + err.message);
        }
      };
      window.renderMemeCanvas = function() {
        const c = document.getElementById('arenaMemeCanvas');
        if (!c) return;
        const ctx = c.getContext('2d');
        const idx = parseInt(document.getElementById('memeTemplateSelect')?.value || '0', 10);
        const tpl = MEME_TEMPLATES.at(idx) || MEME_TEMPLATES.at(0);

        ctx.save();
        ctx.filter = window._memeFilter || 'none';
        if (window._memeCustomImg) {
          ctx.drawImage(window._memeCustomImg, 0, 0, c.width, c.height);
        } else {
          const grad = ctx.createLinearGradient(0, 0, c.width, c.height);
          grad.addColorStop(0, tpl.bg1);
          grad.addColorStop(1, tpl.bg2);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, c.width, c.height);

          ctx.font = '42px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(tpl.emoji, c.width / 2, c.height / 2);
        }
        ctx.restore();

        ctx.font = '34px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        window._memeStickers.forEach(s => ctx.fillText(s.emoji, s.x, s.y));

        const top = (document.getElementById('memeTopText')?.value || '').toUpperCase();
        const bot = (document.getElementById('memeBottomText')?.value || '').toUpperCase();
        const fSize = parseInt(document.getElementById('memeFontSize')?.value || '22', 10);

        ctx.font = '900 ' + fSize + 'px Impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#000';
        ctx.fillStyle = window._memeTextColor || '#fff';

        if (top) {
          ctx.strokeText(top, c.width / 2, 32, c.width - 16);
          ctx.fillText(top, c.width / 2, 32, c.width - 16);
        }
        if (bot) {
          ctx.strokeText(bot, c.width / 2, c.height - 16, c.width - 16);
          ctx.fillText(bot, c.width / 2, c.height - 16, c.width - 16);
        }
      };

      window.downloadMemeLocally = function() {
        const c = document.getElementById('arenaMemeCanvas');
        if (!c) return;
        const a = document.createElement('a');
        a.download = 'sammu-meme-' + Date.now() + '.jpg';
        a.href = c.toDataURL('image/jpeg', 0.85);
        a.click();
      };

      window.postMemeToChat = function() {
        const c = document.getElementById('arenaMemeCanvas');
        if (!c || typeof socket === 'undefined') return;
        const dataUrl = c.toDataURL('image/jpeg', 0.72);
        socket.emit('postArenaMeme', { image: dataUrl });
        document.getElementById('arenaMemeModal').style.display = 'none';
      };

      setInterval(upgradeHornToMemeMaker, 1000);

      function hookServerSocket() {
        if (typeof socket === 'undefined' || window._srvHooked) return;
        window._srvHooked = true;

        const origOnevent = socket.onevent;
        socket.onevent = function(packet) {
          const ev = packet && packet.data && packet.data.at(0);
          const payload = packet && packet.data && packet.data.at(1);
          const isolated = ['incomingMusicNote', 'playMemeSfx', 'message', 'syncGame', 'spinnerTick', 'announceWinner', 'openSkincareClinic'];

          if (!window.selectedServerId && isolated.includes(ev)) return;
          if (isolated.includes(ev) && payload && typeof payload === 'object') {
            if (payload._serverId && payload._serverId !== window.selectedServerId) return;
          }
          return origOnevent.apply(this, arguments);
        };

        socket.emit('checkOGSignature', { deviceId: devId, browserFp });
        socket.emit('requestServerList');

        const pendingRef = localStorage.getItem('sammu_pending_ref');
        if (pendingRef) {
          socket.emit('registerReferral', { refOwner: pendingRef, deviceId: devId });
          localStorage.removeItem('sammu_pending_ref');
        }

        socket.on('ogDeviceVerified', (ok) => { isLockedHostDevice = Boolean(ok); });
        socket.on('serverListUpdate', (list) => { allServers = list; renderServerList(); });
        socket.on('toggleDidiPromo', (show) => { updateDidiBannerVisibility(show); });
        socket.on('serverAccessGranted', (srv) => {
          window.selectedServerId = srv.id;
          document.getElementById('srvBrowserOverlay').style.display = 'none';
          updateDidiBannerVisibility(Boolean(srv.millyPromoOn));
        });
        socket.on('serverAccessDenied', (msg) => alert(msg));
      }
      window.addEventListener('DOMContentLoaded', () => { hookServerSocket(); setTimeout(hookServerSocket, 600); });
    })();
    </script>
    `;
    const EXTRA_ANIME_QUIZ = [
        { q: "🌸 ANIME: What is the name of Naruto's nine-tailed fox?", a: ["kurama", "kyuubi", "nine tails"] },
        { q: "🏴‍☠️ ANIME: Who is the navigator of the Straw Hat Pirates?", a: ["nami"] },
        { q: "⚔️ ANIME: What is the name of Tanjiro Kamado's sister in Demon Slayer?", a: ["nezuko", "nezuko kamado"] },
        { q: "📓 ANIME: Which Shinigami dropped the Death Note into the human world?", a: ["ryuk"] },
        { q: "🐉 ANIME: What planet was Goku originally born on?", a: ["vegeta", "planet vegeta"] },
        { q: "🤞 ANIME: What is Satoru Gojo's Domain Expansion called?", a: ["unlimited void", "infinite void"] },
        { q: "🧱 ANIME: Which Titan power does Eren Yeager inherit first?", a: ["attack titan", "founding titan"] },
        { q: "⚗️ ANIME: What is the name of Edward Elric's younger brother in Fullmetal Alchemist?", a: ["alphonse", "alphonse elric", "al"] },
        { q: "🦸 ANIME: What is Izuku Midoriya's hero name in My Hero Academia?", a: ["deku"] },
        { q: "⛓️ ANIME: What kind of devil is Pochita in Chainsaw Man?", a: ["chainsaw", "chainsaw devil"] },
        { q: "🕵️ ANIME: What is Loid Forger's spy codename in Spy x Family?", a: ["twilight"] },
        { q: "🏐 ANIME: What position does Shoyo Hinata play in Haikyuu?", a: ["middle blocker"] },
        { q: "⚔️ ANIME: What is Kirito's dual-wielding black sword called in Sword Art Online?", a: ["elucidator"] },
        { q: "👊 ANIME: How many push-ups a day did Saitama do to get his strength?", a: ["100", "one hundred"] },
        { q: "👁️ ANIME: What is the name of Kakashi's signature lightning jutsu?", a: ["chidori", "raikiri", "lightning blade"] },
        { q: "👒 ANIME: Who gave Luffy his iconic straw hat?", a: ["shanks", "red haired shanks"] },
        { q: "🔥 ANIME: Which Hashira is known as the Flame Hashira in Demon Slayer?", a: ["rengoku", "kyojuro rengoku"] },
        { q: "👻 ANIME: What is Ichigo Kurosaki's Zanpakuto called in Bleach?", a: ["zangetsu"] },
        { q: "🃏 ANIME: What is Gon Freecss's Nen type in Hunter x Hunter?", a: ["enhancer", "enhancement"] },
        { q: "♟️ ANIME: What is Lelouch's alter-ego name in Code Geass?", a: ["zero"] },
        { q: "🧪 ANIME: What is Senku Ishigami's catchphrase percentage in Dr. Stone?", a: ["10 billion", "ten billion", "10 billion percent"] },
        { q: "⚽ ANIME: What is the name of the striker training facility in Blue Lock?", a: ["blue lock"] },
        { q: "🐺 ANIME: Who is the main protagonist of Berserk?", a: ["guts"] },
        { q: "🌀 ANIME: What is the name of Naruto's signature spinning chakra sphere?", a: ["rasengan"] },
        { q: "🐍 ANIME: Who is one of the Legendary Sannin obsessed with snakes?", a: ["orochimaru"] },
        { q: "⚡ ANIME: What is Zenitsu's Breathing Style in Demon Slayer?", a: ["thunder", "thunder breathing"] },
        { q: "🍖 ANIME: What Devil Fruit did Monkey D. Luffy eat?", a: ["gomu gomu", "gum gum", "hito hito"] },
        { q: "🩸 ANIME: What is Kaneki Ken's ghoul nickname in Tokyo Ghoul?", a: ["eyepatch", "centipede"] },
        { q: "📖 ANIME: What type of grimoire does Asta receive in Black Clover?", a: ["five leaf", "5 leaf", "five leaf clover"] },
        { q: "🔮 ANIME: Who is the main telepath child in Spy x Family?", a: ["anya", "anya forger"] },
        { q: "🌌 ANIME: What is the name of the ship in Cowboy Bebop?", a: ["bebop"] },
        { q: "⏳ ANIME: What microwave gadget sends text messages to the past in Steins;Gate?", a: ["phonewave", "phone microwave"] },
        { q: "🗡️ ANIME: Who is humanity's strongest soldier in Attack on Titan?", a: ["levi", "levi ackerman"] },
        { q: "🌊 ANIME: What is Giyu Tomioka's Breathing Style in Demon Slayer?", a: ["water", "water breathing"] },
        { q: "👹 ANIME: Who is the King of Curses inside Yuji Itadori?", a: ["sukuna", "ryomen sukuna"] },
        { q: "🐉 ANIME: How many Dragon Balls are needed to summon Shenron?", a: ["7", "seven"] },
        { q: "🕶️ ANIME: What percentage does Mob reach when his emotions explode in Mob Psycho 100?", a: ["100", "100%", "one hundred"] },
        { q: "🎻 ANIME: What instrument does Kaori Miyazono play in Your Lie in April?", a: ["violin"] },
        { q: "🍎 ANIME: What fruit does Ryuk love eating in Death Note?", a: ["apple", "apples"] },
        { q: "🦊 ANIME: Who is the 4th Hokage of the Hidden Leaf Village?", a: ["minato", "minato namikaze"] },
        { q: "⚔️ ANIME: How many swords does Roronoa Zoro use in his signature style?", a: ["3", "three", "santoryu"] },
        { q: "🔥 ANIME: What is Ace's Devil Fruit power in One Piece?", a: ["mera mera", "flame", "fire"] },
        { q: "👑 ANIME: Who is the main shadow monarch in Solo Leveling?", a: ["sung jinwoo", "jinwoo", "sung jin woo"] },
        { q: "💥 ANIME: What is Katsuki Bakugo's Quirk in My Hero Academia?", a: ["explosion"] },
        { q: "🧊 ANIME: What are Shoto Todoroki's two Quirk elements?", a: ["fire and ice", "ice and fire", "half cold half hot"] },
        { q: "🎭 ANIME: What organization wears black cloaks with red clouds in Naruto?", a: ["akatsuki"] },
        { q: "🦋 ANIME: Who is the Insect Hashira in Demon Slayer?", a: ["shinobu", "shinobu kocho"] },
        { q: "🏀 ANIME: Who is the phantom sixth man in Kuroko's Basketball?", a: ["kuroko", "tetsuya kuroko"] },
        { q: "🗡️ ANIME: What is Meliodas's sin title in The Seven Deadly Sins?", a: ["wrath", "dragon sin of wrath"] },
        { q: "🌟 ANIME: What is the name of the guild Natsu Dragneel belongs to?", a: ["fairy tail"] }
    ];

    const activeAnimeQuizByServer = new Map();

    function triggerServerAnimeQuiz(serverId) {
        const picked = EXTRA_ANIME_QUIZ.at(Math.floor(Math.random() * EXTRA_ANIME_QUIZ.length));
        if (!picked) return;
        const old = activeAnimeQuizByServer.get(serverId);
        if (old && old.timer) clearTimeout(old.timer);

        const timer = setTimeout(() => {
            if (activeAnimeQuizByServer.has(serverId)) {
                activeAnimeQuizByServer.delete(serverId);
                io.to(serverId).emit('message', {
                    username: "Sammu's Bot",
                    text: `⏰ **Time's Up!** Answer was: **${picked.a.at(0).toUpperCase()}**`,
                    _serverId: serverId
                });
            }
        }, 25000);

        activeAnimeQuizByServer.set(serverId, { answers: picked.a, timer });
        io.to(serverId).emit('message', {
            username: "Sammu's Bot",
            text: `${picked.q}\n*(Type your answer in chat within 25s!)*`,
            _serverId: serverId
        });
    }
    const ARENA_TOURNEY_GAMES = [
        { name: "⚔️ Tic-Tac-Toe Duel", ev: "assignFighters" },
        { name: "🤼 Sumo Push", ev: "launchSumo" },
        { name: "🌀 Spinner Clash", ev: "launchSpinner" },
        { name: "🤠 Quick-Draw", ev: "launchQuickDraw" },
        { name: "🧮 Math Blitz", ev: "launchMath" },
        { name: "💣 Bomb Pass", ev: "launchBomb" },
        { name: "🪨 Rock Paper Scissors", ev: "launchRPS" },
        { name: "🧠 Emoji Memory", ev: "launchMemory" },
        { name: "🪢 Tug of War", ev: "launchTug" },
        { name: "🎨 Color Trap", ev: "launchColorTrap" },
        { name: "🔤 Word Scramble", ev: "launchScramble" },
        { name: "🎲 High Dice", ev: "launchDice" },
        { name: "⚽ Penalty Kick", ev: "launchPenalty" },
        { name: "⌨️ Typing Race", ev: "launchTyping" },
        { name: "💎 Treasure Hunt", ev: "launchTreasure" },
        { name: "🚨 Simon Says", ev: "launchSimon" },
        { name: "🃏 Higher or Lower", ev: "launchCards" },
        { name: "✂️ Wire Defusal", ev: "launchDefuse" },
        { name: "🔢 Number Guess", ev: "launchGuess" },
        { name: "🎯 Target Sniper", ev: "launchTarget" },
        { name: "🗡️ Fruit Slash", ev: "launchFruit" },
        { name: "⚡ Lightning Reflex", ev: "launchReflex" },
        { name: "🏀 Hoop Shootout", ev: "launchHoop" }
    ];

    function finishArenaTournament(serverId) {
        const arena = getArena(serverId);
        const t = arena.tourney;
        t.active = false;
        if (t.timer) clearTimeout(t.timer);

        const ranking = Object.entries(t.matchScores || {})
            .sort((a, b) => b - a);

        const first = ranking || null;
        const second = ranking || null;
        const third = ranking || null;

        let msg = `🎊 **15-GAME TOURNAMENT FINISHED! (${t.gamesPlayed}/${t.maxGames} Games Played)** 🎊\n`;
        if (first) msg += `🥇 **1st Place (TROPHY):** **${first}** (${first} Wins)\n`;
        if (second) msg += `🥈 **2nd Place (SILVER MEDAL):** **${second}** (${second} Wins)\n`;
        if (third) msg += `🥉 **3rd Place (BRONZE MEDAL):** **${third}** (${third} Wins)`;

        t.currentPair = null;
        io.to(serverId).emit('message', {
            username: "Sammu's Bot",
            text: msg,
            _serverId: serverId
        });
    }

    function startArenaTournament(serverId, hostSocket) {
        const arena = getArena(serverId);
        syncArenaPlayers(serverId);
        const contestants = arena.players.filter(p => p.id !== hostSocket.id);
        if (contestants.length < 2) {
            io.to(serverId).emit('message', {
                username: "Sammu's Bot",
                text: `⚠️ Need at least **2 non-host players inside this server** to start a Tournament!`,
                _serverId: serverId
            });
            return;
        }
        if (arena.tourney.timer) clearTimeout(arena.tourney.timer);
        arena.tourney = {
            active: true,
            round: 1,
            maxGames: 15,
            gamesPlayed: 0,
            hostSocketId: hostSocket.id,
            matchScores: {},
            currentPair: null,
            awaitingResult: false,
            timer: null
        };
        contestants.forEach(p => { arena.tourney.matchScores[p.username] = 0; });
        io.to(serverId).emit('message', {
            username: "Sammu's Bot",
            text: `🏆 **COMPULSORY 15-GAME TOURNAMENT STARTED!** (${contestants.length} Players | All 15 Mini-Games will be played!)\n🥇 1st: **Trophy** | 🥈 2nd: **Silver** | 🥉 3rd: **Bronze**`,
            _serverId: serverId
        });
        advanceArenaTournament(serverId, hostSocket);
    }

    function advanceArenaTournament(serverId, hostSocket) {
        const arena = getArena(serverId);
        const t = arena.tourney;
        if (!t.active) return;

        if (t.gamesPlayed >= t.maxGames) {
            finishArenaTournament(serverId);
            return;
        }

        const activeHost = (hostSocket && hostSocket.connected)
            ? hostSocket
            : io.sockets.sockets.get(t.hostSocketId || arena.hostId);

        syncArenaPlayers(serverId);
        const contestants = arena.players.filter(p => !p.isHost && (!activeHost || p.id !== activeHost.id));

        if (contestants.length < 2) {
            io.to(serverId).emit('message', {
                username: "Sammu's Bot",
                text: `⚠️ Tournament ended early because fewer than 2 players remain in this server.`,
                _serverId: serverId
            });
            finishArenaTournament(serverId);
            return;
        }

        contestants.forEach(p => {
            if (t.matchScores[p.username] === undefined) {
                t.matchScores[p.username] = 0;
            }
        });

        const shuffled = [...contestants].sort(() => Math.random() - 0.5);
        const pA = shuffled, pB = shuffled;

        t.gamesPlayed++;
        t.currentPair = { pA, pB };
        t.awaitingResult = true;
        arena.captainA = pA;
        arena.captainB = pB;

        const chosen = ARENA_TOURNEY_GAMES.at(Math.floor(Math.random() * ARENA_TOURNEY_GAMES.length));
        io.to(serverId).emit('message', {
            username: "Sammu's Bot",
            text: `🏟️ **TOURNEY MATCH #${t.gamesPlayed}/${t.maxGames}**\n⚔️ 🔴 **${pA.username}** vs 🔵 **${pB.username}**\n🎮 Game: **${chosen.name}**!`,
            _serverId: serverId
        });

        if (activeHost && activeHost.connected) {
            activeHost.onevent({ type: 2, nsp: '/', data: ['makeCaptains', { capA: pA.id, capB: pB.id }] });
            setTimeout(() => {
                if (activeHost.connected && t.active) {
                    activeHost.onevent({ type: 2, nsp: '/', data: [chosen.ev, { fightA: pA.id, fightB: pB.id }] });
                }
            }, 300);
        }
    }

    function handleArenaTourneyMatchEnd(serverId, winnerText) {
        const arena = getArena(serverId);
        const t = arena.tourney;
        if (!t.active || !t.awaitingResult || !t.currentPair) return;

        t.awaitingResult = false;
        const { pA, pB } = t.currentPair;
        const cleanWin = (winnerText || '').toLowerCase();

        let winnerObj = pA;
        if (pB && cleanWin.includes(pB.username.toLowerCase())) {
            winnerObj = pB;
        }

        t.matchScores[winnerObj.username] = (t.matchScores[winnerObj.username] || 0) + 1;

        if (t.gamesPlayed >= t.maxGames) {
            finishArenaTournament(serverId);
            return;
        }

        const wins = t.matchScores[winnerObj.username];
        io.to(serverId).emit('message', {
            username: "Sammu's Bot",
            text: `✅ **${winnerObj.username}** won Match #${t.gamesPlayed} (Total Wins: **${wins}**)! Match #${t.gamesPlayed + 1}/15 starts in 4s... ⏳`,
            _serverId: serverId
        });

        if (t.timer) clearTimeout(t.timer);
        t.timer = setTimeout(() => {
            advanceArenaTournament(serverId, null);
        }, 4000);
    }

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function (body) {
            if (typeof body === 'string' && body.includes('</body>')) {
                body = body.replace('</body>', MULTI_SERVER_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    io.on('connection', (socket) => {
        attachTracking(socket, null);

        socket.use((packet, next) => {
            if (socket.activeServerId) lastActiveServerId = socket.activeServerId;
            const evName = packet && packet.at(0);

            if (evName === 'chatMessage') {
                const payload = packet.at(1);
                const rawText = (typeof payload === 'object' && payload !== null) ? payload.text : payload;
                if (typeof rawText === 'string') {
                    const low = rawText.trim().toLowerCase();
                    if (low === '!anime' || low === '!animequiz') {
                        if (socket.activeServerId) triggerServerAnimeQuiz(socket.activeServerId);
                        return;
                    }
                    if (socket.activeServerId && activeAnimeQuizByServer.has(socket.activeServerId)) {
                        const qState = activeAnimeQuizByServer.get(socket.activeServerId);
                        if (qState.answers.some(ans => low === ans || low.includes(ans))) {
                            clearTimeout(qState.timer);
                            activeAnimeQuizByServer.delete(socket.activeServerId);
                            const winnerName = (typeof payload === 'object' && payload.username) ? payload.username : (socket.username || 'Player');
                            setTimeout(() => {
                                io.to(socket.activeServerId).emit('message', {
                                    username: "Sammu's Bot",
                                    text: `🎉🎌 **${winnerName}** nailed the Anime Quiz! Answer: **${qState.answers.at(0).toUpperCase()}** (+100 Vibe Pts!)`,
                                    _serverId: socket.activeServerId
                                });
                            }, 150);
                        }
                    }
                    if (low === '/tournament' || low === '/tournamnet' || low === '/tourney') {
                        if (socket.activeServerId) startArenaTournament(socket.activeServerId, socket);
                        return;
                    }
                    if (low === '/stoptournament' || low === '/stoptourney') {
                        if (socket.activeServerId) {
                            const arena = getArena(socket.activeServerId);
                            arena.tourney.active = false;
                            if (arena.tourney.timer) clearTimeout(arena.tourney.timer);
                            io.to(socket.activeServerId).emit('message', {
                                username: "Sammu's Bot",
                                text: `🛑 Tournament stopped in this arena.`,
                                _serverId: socket.activeServerId
                            });
                        }
                        return;
                    }
                }
            }

            const gameEvents = new Set([
                'assignFighters', 'makeMove', 'launchSumo', 'sumoPush', 'launchSpinner', 'spinnerMove',
                'launchQuickDraw', 'quickDrawFire', 'launchMath', 'submitMath', 'launchBomb', 'passBomb',
                'launchRPS', 'pickRPS', 'launchMemory', 'pickMemory', 'launchTug', 'tugPull',
                'launchColorTrap', 'pickColorTrap', 'launchScramble', 'submitScramble', 'launchDice',
                'rollArenaDice', 'launchPenalty', 'penaltyPick', 'launchTyping', 'submitTyping',
                'launchTreasure', 'pickTreasure', 'launchSimon', 'tapSimon', 'launchCards', 'pickCard',
                'launchDefuse', 'cutWire', 'launchGuess', 'submitGuess', 'launchTarget', 'hitTarget',
                'launchFruit', 'fruitScoreTick', 'launchReflex', 'reflexTap', 'launchHoop', 'hoopShoot',
                'launchSTK', 'skincareStepComplete', 'resetToLobby', 'makeCaptains', 'draftPlayer', 'awardTeamPoint'
            ]);

            if (gameEvents.has(evName)) {
                if (!socket.activeServerId) return;
                const arena = getArena(socket.activeServerId);

                if (evName === 'makeCaptains' || evName === 'assignFighters') {
                    const d = packet.at(1);
                    if (d && typeof d === 'object') {
                        const pA = arena.players.find(p => p.id === (d.capA || d.fightA));
                        const pB = arena.players.find(p => p.id === (d.capB || d.fightB));
                        if (pA && pB && pA.id !== pB.id) {
                            arena.captainA = pA;
                            arena.captainB = pB;
                        }
                    }
                }

                if (evName.startsWith('launch') || evName === 'assignFighters') {
                    syncArenaPlayers(socket.activeServerId);
                    if (arena.players.length < 2) {
                        socket.emit('message', {
                            username: "Sammu's Bot",
                            text: `⚠️ Need at least **2 players inside THIS server** to start a game!`,
                            _serverId: socket.activeServerId
                        });
                        return;
                    }
                    if (!arena.captainA || !arena.captainB ||
                        !arena.players.some(p => p.id === arena.captainA.id) ||
                        !arena.players.some(p => p.id === arena.captainB.id)) {
                        const nonHost = arena.players.filter(p => p.id !== socket.id);
                        const pool = nonHost.length >= 2 ? nonHost : arena.players;
                        arena.captainA = pool.at(0);
                        arena.captainB = pool.at(1);
                    }
                }
            }
            next();
        });
        socket.on('checkOGSignature', (data) => {
            attachTracking(socket, data);
            socket.emit('ogDeviceVerified', isAnyLockedOGSignature(socket));
        });

        socket.on('requestServerList', () => {
            socket.emit('serverListUpdate', getPublicServerList());
        });

        socket.on('registerReferral', ({ refOwner, deviceId }) => {
            if (!refOwner || !deviceId) return;
            const cleanRef = refOwner.trim().toLowerCase();
            const srv = Object.values(serversDB).find(s => s.type === 'custom' && s.owner.toLowerCase() === cleanRef);
            if (!srv) return;

            if (!Array.isArray(srv.referrals)) srv.referrals = [];
            if (!Array.isArray(srv.allTimeDevices)) srv.allTimeDevices = [];
            if (srv.allTimeDevices.includes(deviceId)) return;

            srv.allTimeDevices.push(deviceId);
            srv.referrals.push(deviceId);

            if (srv.referrals.length >= 15) {
                const baseTime = Math.max(Date.now(), srv.expiresAt || Date.now());
                srv.expiresAt = baseTime + (7 * 24 * 60 * 60 * 1000);
                srv.referrals = [];
                io.to(srv.id).emit('message', {
                    username: "Sammu's Bot",
                    text: `🎉🔥 **15 REFERRALS REACHED!** **${srv.name}** (Host: **${srv.owner}**) has been automatically extended for **+7 MORE DAYS**! 🚀`,
                    _serverId: srv.id
                });
            }
            saveDB();
            origIoEmit('serverListUpdate', getPublicServerList());
        });

        socket.on('verifyServerAccess', (data) => {
            const { serverId, password } = data || {};
            attachTracking(socket, data);
            const srv = serversDB[serverId];
            if (!srv) return socket.emit('serverAccessDenied', 'Server not found!');

            const isCreatorSignature = srv.ownerSig && (
                (socket.trackedDeviceId && srv.ownerSig.deviceId === socket.trackedDeviceId) ||
                (socket.trackedIP && socket.trackedBrowser && srv.ownerSig.ip === socket.trackedIP && srv.ownerSig.browser === socket.trackedBrowser)
            );
            const isHostBypass = isAnyLockedOGSignature(socket) || isCreatorSignature;

            if (!isHostBypass && (activeCounts[serverId] || 0) >= (srv.max || 20)) {
                return socket.emit('serverAccessDenied', 'Server is full (20/20)! Pick another server.');
            }
            if ((srv.type === 'secret' || srv.password) && !isHostBypass && password !== srv.password) {
                return socket.emit('serverAccessDenied', '❌ Wrong Password for Private Server!');
            }
            if (srv.type === 'custom' && !srv.permanent && !isHostBypass && Date.now() > srv.expiresAt) {
                const refCount = Array.isArray(srv.referrals) ? srv.referrals.length : 0;
                return socket.emit('serverAccessDenied', `🔒 Trial Expired! (${refCount}/15 referrals). Invite ${15 - refCount} more friends via ?ref=${srv.owner} or email singhalshamaksh@gmail.com!`);
            }

            if (socket.activeServerId && activeCounts[socket.activeServerId]) {
                const oldSrv = socket.activeServerId;
                socket.leave(oldSrv);
                activeCounts[oldSrv] = Math.max(0, activeCounts[oldSrv] - 1);
                syncArenaPlayers(oldSrv);
            }
            socket.activeServerId = serverId;
            lastActiveServerId = serverId;
            socket.join(serverId);
            activeCounts[serverId] = (activeCounts[serverId] || 0) + 1;
            origIoEmit('serverListUpdate', getPublicServerList());
            socket.emit('serverAccessGranted', { ...srv, millyPromoOn });
        });

        socket.on('createCustomServer', (data) => {
            const { name, owner, theme } = data || {};
            attachTracking(socket, data);
            const cleanId = 'custom_' + Date.now();
            const cleanOwner = owner.trim().toLowerCase();

            if (OG_HOSTS.has(cleanOwner) && !verifyOGHostTripleLock(cleanOwner, socket, false)) {
                return socket.emit('serverAccessDenied', `🛡️ "${owner}" is locked to the real host's device, IP & browser!`);
            }

            serversDB[cleanId] = {
                id: cleanId, name: '✨ ' + name.trim(), owner: cleanOwner,
                ownerSig: { deviceId: socket.trackedDeviceId, ip: socket.trackedIP, browser: socket.trackedBrowser },
                theme: theme || 'cyber', max: 20, type: 'custom',
                createdAt: Date.now(), expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000),
                permanent: false, referrals: [], allTimeDevices: []
            };
            saveDB();
            origIoEmit('serverListUpdate', getPublicServerList());
            socket.emit('serverAccessDenied', '✅ Custom Server "' + name + '" created with 7-Day FREE Trial!\nShare /?ref=' + cleanOwner + ' with 15 friends for +7 days, or email a gift code to singhalshamaksh@gmail.com for permanent access!');
        });
        socket.on('joinRoom', (data) => {
            attachTracking(socket, data);
            const srv = serversDB[socket.activeServerId];
            const uname = (data && data.username) ? data.username.trim() : '';
            const cleanU = uname.toLowerCase();
            if (cleanU && socket.activeServerId) {
                playerServerMap.set(cleanU, socket.activeServerId);
                const arena = getArena(socket.activeServerId);
                arena.players = arena.players.filter(p => p.id !== socket.id && p.username.toLowerCase() !== cleanU);
                const isCustomOwner = (srv && srv.owner && cleanU === srv.owner.toLowerCase() && !OG_HOSTS.has(cleanU)) && (
                    !srv.ownerSig ||
                    (socket.trackedDeviceId && srv.ownerSig.deviceId === socket.trackedDeviceId) ||
                    (socket.trackedIP && socket.trackedBrowser && srv.ownerSig.ip === socket.trackedIP && srv.ownerSig.browser === socket.trackedBrowser)
                );
                const isVerifiedOG = verifyOGHostTripleLock(cleanU, socket, false);
                if (isVerifiedOG) socket.emit('ogDeviceVerified', true);

                const isHost = Boolean(isCustomOwner || isVerifiedOG);
                if (isHost) arena.hostId = socket.id;
                arena.players.push({ id: socket.id, username: uname || 'Player', avatar: (data && data.avatar) || '🥷', isHost });
                syncArenaPlayers(socket.activeServerId);

                if (srv && isHost) {
                    setTimeout(() => {
                        socket.emit('initRole', { isHost: true });
                        socket.emit('message', {
                            username: "Sammu's Bot",
                            text: `👑 Welcome to **${srv.name}**, **${uname}**! Super-Host Admin Panel unlocked!`,
                            _serverId: srv.id
                        });
                    }, 500);
                } else if (srv && OG_HOSTS.has(cleanU)) {
                    socket.emit('message', {
                        username: 'SYSTEM',
                        text: `🛡️ **${uname}** is device/IP/browser-locked to the real host! Host powers blocked.`,
                        _serverId: srv.id
                    });
                }
            }
            if (socket.activeServerId === 'srv_milly' && millyPromoOn) {
                setTimeout(() => socket.emit('toggleDidiPromo', true), 600);
            }
        });

        
        socket.on('postArenaMeme', (data) => {
            if (!socket.activeServerId || !data || !data.image) return;
            const senderName = socket.username || 'Player';
            const senderAvatar = socket.avatar || '😂';
            io.to(socket.activeServerId).emit('message', {
                senderId: socket.id,
                username: senderName,
                avatar: senderAvatar,
                text: `😂 **${senderName}** dropped a fresh meme!`,
                imageUrl: data.image,
                _serverId: socket.activeServerId
            });
        });

        socket.on('chatMessage', (payload) => {
            const text = (typeof payload === 'object' && payload !== null) ? payload.text : payload;
            if (!text || typeof text !== 'string') return;
            const clean = text.trim();
                     if (payload && payload.username) socket.username = payload.username.trim();

            const sender = (socket.username || (payload && payload.username) || '').toLowerCase();
            if (sender && socket.activeServerId) {
                playerServerMap.set(sender, socket.activeServerId);
            }

            if (MASTER_KEYS.has(clean) && OG_HOSTS.has(sender)) {
                verifyOGHostTripleLock(sender, socket, true);
                socket.emit('ogDeviceVerified', true);
                return;
            }

            if (!OG_HOSTS.has(sender) || !verifyOGHostTripleLock(sender, socket, false)) return;

            if (clean.toLowerCase() === '/promo on' || clean.toLowerCase() === '/promo off') {
                millyPromoOn = (clean.toLowerCase() === '/promo on');
                saveDB();
                io.to('srv_milly').emit('toggleDidiPromo', millyPromoOn);
                Object.keys(serversDB).forEach(id => {
                    if (id !== 'srv_milly') io.to(id).emit('toggleDidiPromo', false);
                });
                socket.emit('message', {
                    username: 'SYSTEM',
                    text: `📢 Didi Promo Banner inside **👑 Milly's Palace** is now **${millyPromoOn ? 'ON ✅' : 'OFF ❌'}**`,
                    _serverId: socket.activeServerId
                });
            }
            if (clean.toLowerCase() === '/listservers') {
                const customs = Object.values(serversDB).filter(s => s.type === 'custom');
                if (customs.length === 0) {
                    socket.emit('message', { username: 'SYSTEM', text: '📋 No custom servers exist right now.', _serverId: socket.activeServerId });
                } else {
                    const summary = customs.map(s => {
                        const status = s.permanent ? '⭐ VIP PERM' : `${Math.max(0, Math.ceil((s.expiresAt - Date.now()) / 86400000))}d left`;
                        return `• **${s.name}** | Owner: \`${s.owner}\` | ${status} | Refs: ${Array.isArray(s.referrals) ? s.referrals.length : 0}/15`;
                    }).join('\n');
                    socket.emit('message', { username: 'SYSTEM', text: `📋 **CUSTOM SERVERS:**\n${summary}\n\nCommands: \`/permserver <owner>\` | \`/deleteserver <owner>\` | \`/extendserver <owner> <days>\``, _serverId: socket.activeServerId });
                }
            }

            if (clean.toLowerCase().startsWith('/renameserver ')) {
                const parts = clean.slice(14).trim().split(/\s+/);
                const targetId = parts.shift();
                const newName = parts.join(' ');
                if (serversDB[targetId] && newName) {
                    serversDB[targetId].name = newName;
                    saveDB();
                    origIoEmit('serverListUpdate', getPublicServerList());
                    socket.emit('message', { username: 'SYSTEM', text: `✅ Renamed **${targetId}** to **${newName}**!`, _serverId: socket.activeServerId });
                } else {
                    const ids = Object.keys(serversDB).join(', ');
                    socket.emit('message', { username: 'SYSTEM', text: `⚠️ Usage: \`/renameserver <id> <New Name>\`\nValid IDs: ${ids}`, _serverId: socket.activeServerId });
                }
            }

            if (clean.toLowerCase().startsWith('/permserver ')) {
                const ownerTarget = clean.slice(12).trim().toLowerCase();
                const found = Object.values(serversDB).find(s => s.owner.toLowerCase() === ownerTarget && s.type === 'custom');
                if (found) {
                    found.permanent = true;
                    saveDB();
                    origIoEmit('serverListUpdate', getPublicServerList());
                    io.to(socket.activeServerId).emit('message', { username: "Sammu's Bot", text: `💎 **VIP UNLOCKED!** **${found.name}** (Owner: **${found.owner}**) is now a **PERMANENT SERVER**! 🎉`, _serverId: socket.activeServerId });
                } else {
                    socket.emit('message', { username: 'SYSTEM', text: `⚠️ No custom server found for owner \`${ownerTarget}\`. Type \`/listservers\` to check exact owner names.`, _serverId: socket.activeServerId });
                }
            }

            if (clean.toLowerCase().startsWith('/deleteserver ')) {
                const ownerTarget = clean.slice(14).trim().toLowerCase();
                const found = Object.values(serversDB).find(s => s.owner.toLowerCase() === ownerTarget && s.type === 'custom');
                if (found) {
                    const delName = found.name;
                    delete serversDB[found.id];
                    delete activeCounts[found.id];
                    arenas.delete(found.id);
                    saveDB();
                    origIoEmit('serverListUpdate', getPublicServerList());
                    io.to(socket.activeServerId).emit('message', { username: "Sammu's Bot", text: `🗑️ **SERVER DELETED:** **${delName}** (Owner: **${ownerTarget}**) was permanently removed!`, _serverId: socket.activeServerId });
                } else {
                    socket.emit('message', { username: 'SYSTEM', text: `⚠️ No custom server found for owner \`${ownerTarget}\`. Type \`/listservers\` to check exact owner names.`, _serverId: socket.activeServerId });
                }
            }

            if (clean.toLowerCase().startsWith('/extendserver ')) {
                const [ownerTarget, daysStr] = clean.slice(14).trim().split(/\s+/);
                const days = parseInt(daysStr) || 7;
                const found = Object.values(serversDB).find(s => s.owner.toLowerCase() === (ownerTarget || '').toLowerCase() && s.type === 'custom');
                if (found) {
                    const baseTime = Math.max(Date.now(), found.expiresAt || Date.now());
                    found.expiresAt = baseTime + (days * 24 * 60 * 60 * 1000);
                    saveDB();
                    origIoEmit('serverListUpdate', getPublicServerList());
                    io.to(socket.activeServerId).emit('message', { username: "Sammu's Bot", text: `⏳ **EXTENDED!** **${found.name}** unlocked for **+${days} days**! 🔥`, _serverId: socket.activeServerId });
                }
            }
        });

        socket.on('disconnect', () => {
            if (socket.activeServerId && activeCounts[socket.activeServerId]) {
                const srvId = socket.activeServerId;
                activeCounts[srvId] = Math.max(0, activeCounts[srvId] - 1);
                syncArenaPlayers(srvId);
                origIoEmit('serverListUpdate', getPublicServerList());
            }
        });
    });
     // ================= 🕵️ WORD IMPOSTER ARENA (#25 - SINGLE BLOCK) =================
    const IMPOSTER_WORDS = [
        "PIZZA", "MINECRAFT", "CRICKET", "NARUTO", "IPHONE", "GHOST", "DIAMOND",
        "BIRYANI", "ZOMBIE", "PIANO", "ASTRONAUT", "SHARK", "CHOCOLATE", "VAMPIRE",
        "SUPERHERO", "VOLCANO", "DRAGON", "SUBMARINE", "HOSPITAL", "YOUTUBE"
    ];
    const imposterGameByServer = new Map();

    const WORD_IMPOSTER_WIDGET = `
    <div id="imposterModal" style="display:none;position:fixed;inset:0;background:rgba(7,11,25,0.94);z-index:999997;align-items:center;justify-content:center;padding:12px;backdrop-filter:blur(10px);">
      <div style="background:linear-gradient(155deg,#1e1b4b,#311042);border:2px solid #f43f5e;border-radius:22px;padding:16px;width:100%;max-width:390px;color:#fff;text-align:center;box-shadow:0 0 35px rgba(244,63,94,0.45);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:900;font-size:15px;color:#fda4af;">🕵️ WORD IMPOSTER ARENA</span>
          <button onclick="document.getElementById('imposterModal').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:8px;padding:4px 9px;font-weight:bold;cursor:pointer;">Hide</button>
        </div>
        <div id="impSecretRoleBox" style="background:rgba(244,63,94,0.2);border:1.5px solid #fb7185;border-radius:14px;padding:10px;margin:10px 0;font-size:15px;font-weight:900;color:#fde047;">Waiting for word...</div>
        <div style="font-size:12px;color:#cbd5e1;margin-bottom:8px;">1️⃣ Type a <b>1-word clue</b> in chat.<br>2️⃣ Tap who you vote as the <b>IMPOSTER</b>:</div>
        <div id="impVoteGrid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;"></div>
        <div id="impVoteStatus" style="font-size:12px;color:#38bdf8;font-weight:bold;"></div>
      </div>
    </div>
    <script>
    (function() {
      function injectImposterBtn() {
        const targetBtn = Array.from(document.querySelectorAll('button')).find(b => /hoop shootout|target sniper/i.test(b.textContent || ''));
        if (targetBtn && targetBtn.parentElement && !document.getElementById('btnLaunchImposter')) {
          const btn = targetBtn.cloneNode(true);
          btn.id = 'btnLaunchImposter';
          btn.removeAttribute('onclick');
          btn.textContent = '25. 🕵️ Word Imposter';
          btn.onclick = () => { if (typeof socket !== 'undefined') socket.emit('startWordImposter'); };
          targetBtn.parentElement.appendChild(btn);
        }
        const memeBtn = Array.from(document.querySelectorAll('button')).find(b => b.dataset && b.dataset.memeUpgraded);
        if (memeBtn && memeBtn.parentElement && !document.getElementById('reopenImpBtn')) {
          const rBtn = memeBtn.cloneNode(true);
          rBtn.id = 'reopenImpBtn';
          rBtn.style.display = 'none';
          rBtn.textContent = '🕵️ Vote';
          rBtn.onclick = () => { document.getElementById('imposterModal').style.display = 'flex'; };
          memeBtn.parentElement.insertBefore(rBtn, memeBtn.nextSibling);
        }
      }
      setInterval(injectImposterBtn, 1200);

      function bindImposterSockets() {
        if (typeof socket === 'undefined' || window._impBound) return;
        window._impBound = true;

        socket.on('imposterRoundStart', (data) => {
          if (data._serverId && data._serverId !== window.selectedServerId) return;
          document.getElementById('imposterModal').style.display = 'flex';
          const rBtn = document.getElementById('reopenImpBtn');
          if (rBtn) rBtn.style.display = 'inline-block';

          const roleBox = document.getElementById('impSecretRoleBox');
          if (data.isImposter) {
            roleBox.innerHTML = '😈 YOU ARE THE IMPOSTER!<br><span style="font-size:12px;color:#fda4af;">You have NO word! Read clues & blend in!</span>';
          } else {
            roleBox.innerHTML = '😇 CREWMATE SECRET WORD:<br><span style="font-size:20px;color:#4ade80;">' + data.word + '</span>';
          }

          const grid = document.getElementById('impVoteGrid');
          grid.innerHTML = '';
          document.getElementById('impVoteStatus').textContent = 'Cast your vote when ready!';
          data.players.forEach(p => {
            const vBtn = document.createElement('button');
            vBtn.style.cssText = 'background:#1e293b;border:1.5px solid #38bdf8;color:#fff;padding:8px;border-radius:12px;font-weight:bold;font-size:12px;cursor:pointer;';
            vBtn.textContent = '🗳️ ' + p.username;
            vBtn.onclick = () => {
              socket.emit('castImposterVote', p.id);
              document.getElementById('impVoteStatus').textContent = '✅ Voted for ' + p.username + '! Waiting for others...';
              Array.from(grid.children).forEach(c => c.disabled = true);
            };
            grid.appendChild(vBtn);
          });
        });

        socket.on('imposterRoundEnd', (data) => {
          if (data._serverId && data._serverId !== window.selectedServerId) return;
          document.getElementById('imposterModal').style.display = 'none';
          const rBtn = document.getElementById('reopenImpBtn');
          if (rBtn) rBtn.style.display = 'none';
        });
      }
      setInterval(bindImposterSockets, 800);
    })();
    </script>
    `;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function (body) {
            if (typeof body === 'string' && body.includes('</body>')) {
                body = body.replace('</body>', WORD_IMPOSTER_WIDGET + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });

    function launchServerWordImposter(serverId) {
        syncArenaPlayers(serverId);
        const arena = getArena(serverId);
        if (arena.players.length < 3) {
            io.to(serverId).emit('message', {
                username: "Sammu's Bot",
                text: `⚠️ Need at least **3 players in this server** to play **🕵️ Word Imposter**!`,
                _serverId: serverId
            });
            return;
        }
        const secretWord = IMPOSTER_WORDS[Math.floor(Math.random() * IMPOSTER_WORDS.length)];
        const imposter = arena.players[Math.floor(Math.random() * arena.players.length)];
        imposterGameByServer.set(serverId, {
            word: secretWord,
            imposterId: imposter.id,
            imposterName: imposter.username,
            votes: new Map(),
            totalPlayers: arena.players.length
        });

        const playerList = arena.players.map(p => ({ id: p.id, username: p.username }));
        arena.players.forEach(p => {
            io.to(p.id).emit('imposterRoundStart', {
                isImposter: p.id === imposter.id,
                word: p.id === imposter.id ? null : secretWord,
                players: playerList,
                _serverId: serverId
            });
        });

        io.to(serverId).emit('message', {
            username: "Sammu's Bot",
            text: `🕵️ **WORD IMPOSTER STARTED!** Everyone got a secret word EXCEPT **1 IMPOSTER**! Drop a 1-word clue in chat and vote in the popup! 👀`,
            _serverId: serverId
        });
    }

    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const text = (typeof payload === 'object' && payload !== null) ? payload.text : payload;
            if (typeof text === 'string' && text.trim().toLowerCase() === '!imposter' && socket.activeServerId) {
                launchServerWordImposter(socket.activeServerId);
            }
        });

        socket.on('startWordImposter', () => {
            if (socket.activeServerId) launchServerWordImposter(socket.activeServerId);
        });

        socket.on('castImposterVote', (targetId) => {
            const srvId = socket.activeServerId;
            if (!srvId || !imposterGameByServer.has(srvId)) return;
            const state = imposterGameByServer.get(srvId);
            state.votes.set(socket.id, targetId);

            if (state.votes.size >= state.totalPlayers) {
                imposterGameByServer.delete(srvId);
                const tally = {};
                for (const votedId of state.votes.values()) tally[votedId] = (tally[votedId] || 0) + 1;

                let topId = null, maxVotes = -1;
                for (const [id, count] of Object.entries(tally)) {
                    if (count > maxVotes) { maxVotes = count; topId = id; }
                }

                const caught = (topId === state.imposterId);
                io.to(srvId).emit('imposterRoundEnd', { _serverId: srvId });
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: caught
                        ? `🎉 **CREWMATES WIN!** You caught the Imposter **${state.imposterName}**! Secret Word was **${state.word}**! 🏆`
                        : `😈 **IMPOSTER WINS!** **${state.imposterName}** fooled everyone! Secret Word was **${state.word}**! 💀`,
                    _serverId: srvId
                });
            }
        });
    });
       // === ZORO / YORI AKIYAMA, ISOLATION & SLOW-NETWORK SMOOTH CHAT ADD-ON ===
    let zoroPromoOn = true;

    // 1. Enable Socket.IO Per-Message Compression (shrinks text & JSON packets by ~70% on slow networks)
    if (io && io.engine && io.engine.opts) {
        io.engine.opts.perMessageDeflate = { threshold: 256 };
    }

    const ZORO_ISOLATION_SCRIPT = `
    <script>
    (function() {
      function updateZoroBanner(show) {
        let zBox = document.getElementById('zoroPromoBox');
        if (!zBox) {
          zBox = document.createElement('div');
          zBox.id = 'zoroPromoBox';
          zBox.style.cssText = 'display:none;background:linear-gradient(90deg,#14532d,#166534);border:2px solid #4ade80;border-radius:14px;padding:10px 14px;margin:8px auto;max-width:360px;text-align:center;color:#fff;box-shadow:0 0 20px rgba(74,222,128,0.35);position:relative;z-index:50;';
          zBox.innerHTML =
            '<div style="font-size:11px;color:#bbf7d0;font-weight:bold;">⚔️ ZORO\\'S DOJO FEATURED CREATOR</div>' +
            '<div style="font-size:15px;font-weight:900;margin:2px 0;">✨ Yori Akiyama ✨</div>' +
            '<a href="https://youtube.com" target="_blank" rel="noopener noreferrer" ' +
            'style="display:inline-block;margin-top:4px;background:#ef4444;color:#fff;text-decoration:none;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:bold;">▶️ Subscribe on YouTube</a>';
          const didiBox = document.getElementById('didiPromoBox');
          if (didiBox && didiBox.parentNode) didiBox.parentNode.insertBefore(zBox, didiBox.nextSibling);
          else document.body.prepend(zBox);
        }
        if (show && window.selectedServerId === 'srv_zoro') {
          zBox.style.setProperty('display', 'block', 'important');
        } else {
          zBox.style.setProperty('display', 'none', 'important');
        }
      }

      // 2. Auto-Prune Old Chat Messages so mobile browsers never lag or freeze
      function startChatAntiFreeze() {
        const chatContainers = Array.from(document.querySelectorAll('#chatBox, #messages, .chat-messages, [id*="chat"]'))
          .filter(el => el.scrollHeight >= el.clientHeight && el.tagName === 'DIV');
        const box = chatContainers.at(0);
        if (!box || box.dataset.antiFreezeAttached) return;
        box.dataset.antiFreezeAttached = 'true';

        // Hardware GPU acceleration for butter-smooth mobile scrolling
        box.style.willChange = 'transform';
        box.style.webkitOverflowScrolling = 'touch';

        const observer = new MutationObserver(() => {
          // Keep only the latest 65 messages in DOM so low-RAM phones stay super fast
          while (box.children.length > 65) {
            box.removeChild(box.firstElementChild);
          }
          // Lazy-decode incoming images so chat text renders instantly first
          const imgs = box.querySelectorAll('img:not([decoding])');
          imgs.forEach(img => {
            img.setAttribute('loading', 'lazy');
            img.setAttribute('decoding', 'async');
          });
        });
        observer.observe(box, { childList: true });
      }

      // 3. Auto-Compress Large Outgoing Images on Slow Connections
      function wrapSocketForSlowNet() {
        if (typeof socket === 'undefined' || window._zoroAddonBound) return;
        window._zoroAddonBound = true;

        // Fast auto-reconnect on mobile signal drops
        if (socket.io && socket.io.opts) {
          socket.io.opts.reconnectionDelay = 500;
          socket.io.opts.reconnectionDelayMax = 3000;
        }

        const origEmit = socket.emit.bind(socket);
        socket.emit = function(ev, payload, ...rest) {
          // Compress chatImage / postArenaMeme if larger than 90KB so it doesn't clog slow internet
          if ((ev === 'chatImage' || ev === 'postArenaMeme') && payload && typeof payload.image === 'string' && payload.image.length > 95000) {
            const img = new Image();
            img.onload = () => {
              const c = document.createElement('canvas');
              const scale = Math.min(1, 280 / Math.max(img.width, img.height));
              c.width = Math.round(img.width * scale);
              c.height = Math.round(img.height * scale);
              c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
              payload.image = c.toDataURL('image/jpeg', 0.65);
              origEmit(ev, payload, ...rest);
            };
            img.src = payload.image;
            return socket;
          }
          return origEmit(ev, payload, ...rest);
        };

        const prevOnevent = socket.onevent;
        socket.onevent = function(packet) {
          const ev = packet && packet.data && packet.data.at(0);
          const payload = packet && packet.data && packet.data.at(1);
          const strictEvents = [
            'incomingMusicNote', 'playMemeSfx', 'incomingReaction', 'incomingGift',
            'message', 'syncGame', 'spinnerTick', 'announceWinner',
            'openSkincareClinic', 'closeSkincareClinic', 'updateMVP', 'updateGallery'
          ];
          if (!window.selectedServerId && strictEvents.includes(ev)) return;
          if (strictEvents.includes(ev) && payload && typeof payload === 'object') {
            if (payload._serverId && payload._serverId !== window.selectedServerId) return;
          }
          return prevOnevent.apply(this, arguments);
        };

        // Seamless auto-rejoin into the same server room if her mobile data briefly drops
        socket.on('connect', () => {
          if (window.selectedServerId) {
            origEmit('verifyServerAccess', {
              serverId: window.selectedServerId,
              deviceId: localStorage.getItem('sammu_dev_uid') || ''
            });
          }
        });

        socket.on('toggleZoroPromo', (data) => {
          const isShown = (typeof data === 'object' && data !== null) ? Boolean(data.show) : Boolean(data);
          updateZoroBanner(isShown);
        });
        socket.on('serverAccessGranted', (srv) => {
          window.selectedServerId = srv.id;
          updateZoroBanner(srv.id === 'srv_zoro' && Boolean(srv.zoroPromoOn));
          setTimeout(startChatAntiFreeze, 500);
        });
        socket.on('initRole', () => updateZoroBanner(false));
      }

      window.addEventListener('DOMContentLoaded', () => {
        wrapSocketForSlowNet();
        startChatAntiFreeze();
        setTimeout(() => { wrapSocketForSlowNet(); startChatAntiFreeze(); }, 800);
      });
    })();
    </script>
    `;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>')) {
                body = body.replace('</body>', ZORO_ISOLATION_SCRIPT + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });

    io.on('connection', (socket) => {
        socket.on('verifyServerAccess', (data) => {
            if (data && data.serverId === 'srv_zoro') {
                setTimeout(() => socket.emit('toggleZoroPromo', { show: zoroPromoOn, _serverId: 'srv_zoro' }), 150);
            }
        });

        socket.on('joinRoom', () => {
            if (socket.activeServerId === 'srv_zoro') {
                setTimeout(() => socket.emit('toggleZoroPromo', { show: zoroPromoOn, _serverId: 'srv_zoro' }), 650);
            }
        });

        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload !== null) ? payload.text : payload;
            if (!raw || typeof raw !== 'string' || !socket.activeServerId) return;
            const cmd = raw.trim().toLowerCase();
            const srvId = socket.activeServerId;

            if (cmd === '!zoro') {
                setTimeout(() => {
                    io.to(srvId).emit('message', {
                        username: "⚔️ Zoro",
                        text: `🔥 Subscribe to **Yori Akiyama** on YouTube! 👉 https://youtube.com ❤️`,
                        _serverId: srvId
                    });
                }, 200);
            } else if (cmd === '/zoro on' || cmd === '/zoro off') {
                zoroPromoOn = (cmd === '/zoro on');
                io.to('srv_zoro').emit('toggleZoroPromo', { show: zoroPromoOn, _serverId: 'srv_zoro' });
                socket.emit('message', {
                    username: 'SYSTEM',
                    text: `⚔️ Yori Akiyama Banner inside **⚔️ Zoro's Dojo** is now **${zoroPromoOn ? 'ON ✅' : 'OFF ❌'}**`,
                    _serverId: srvId
                });
            }
        });
    });
    // === END ZORO, ISOLATION & SLOW-NETWORK ADD-ON ===
     // === PHONK DJ v4 (8 PHONK TRACKS, 8 PADS, BACKGROUND PLAY, DUO AURA & 25s ANTI-DROP) ===
    if (io && io.engine && io.engine.opts) {
        io.engine.opts.pingTimeout = 150000;
        io.engine.opts.pingInterval = 25000;
        io.engine.opts.perMessageDeflate = { threshold: 256 };
    }

    const djPendingReconnects = new Map();

    const PHONK_DJ_WIDGET = `
    <style>
      #phonkDjModal { display:none; position:fixed; inset:0; background:rgba(5,5,15,0.88); z-index:99999; align-items:center; justify-content:center; backdrop-filter:blur(8px); font-family:inherit; padding:10px; }
      #phonkDjCard { background:linear-gradient(155deg,#120724,#240b36,#0f172a); border:2px solid #c084fc; border-radius:22px; padding:14px; width:100%; max-width:415px; color:#fff; box-shadow:0 0 35px rgba(192,132,252,0.5); text-align:center; max-height:92vh; overflow-y:auto; }
      .dj-viz { display:flex; align-items:flex-end; justify-content:center; gap:5px; height:36px; background:rgba(0,0,0,0.45); border-radius:12px; padding:6px 12px; margin:7px 0; border:1px solid rgba(192,132,252,0.3); }
      .dj-bar { flex:1; background:linear-gradient(to top,#ec4899,#a855f7,#38bdf8); border-radius:4px; height:15%; transition:height 0.08s ease; }
      .dj-loops { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin:7px 0; }
      .dj-loop-btn { background:#1e1b4b; border:1.5px solid #818cf8; color:#fff; padding:7px 4px; border-radius:10px; font-size:11px; font-weight:bold; cursor:pointer; }
      .dj-loop-btn.active { background:#ec4899; border-color:#fbcfe8; box-shadow:0 0 12px #ec4899; }
      .dj-pads { display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; margin:7px 0; }
      .dj-pad { background:linear-gradient(145deg,#3b0764,#581c87); border:1.5px solid #e879f9; color:#fff; padding:9px 3px; border-radius:12px; font-size:11px; font-weight:900; cursor:pointer; user-select:none; transition:transform 0.06s; }
      .dj-pad:active { transform:scale(0.93); background:#d946ef; }
      .aura-box { background:rgba(56,189,248,0.12); border:1.5px solid #38bdf8; border-radius:14px; padding:9px; margin-top:8px; }
      .aura-modes { display:flex; gap:5px; margin-bottom:6px; }
      .aura-mode-btn { flex:1; padding:5px; border-radius:8px; border:1px solid #38bdf8; background:#0f172a; color:#fff; font-size:10px; font-weight:bold; cursor:pointer; }
      .aura-mode-btn.active { background:#38bdf8; color:#090d16; }
      #phonkMiniBar { display:none; position:fixed; top:8px; left:50%; transform:translateX(-50%); z-index:99998; background:linear-gradient(90deg,#3b0764,#be185d); border:1.5px solid #f472b6; border-radius:999px; padding:5px 12px; color:#fff; font-size:11px; font-weight:bold; align-items:center; gap:8px; box-shadow:0 4px 18px rgba(236,72,153,0.5); white-space:nowrap; }
    </style>

    <div id="phonkMiniBar">
      <span id="miniBarTrack">🎧 Phonk Beat Live</span>
      <button onclick="document.getElementById('phonkDjModal').style.display='flex'" style="background:#38bdf8;border:none;color:#090d16;border-radius:10px;padding:2px 8px;font-weight:900;font-size:10px;cursor:pointer;">🎛️ Deck</button>
      <button onclick="stopPhonkLoop()" style="background:#ef4444;border:none;color:#fff;border-radius:10px;padding:2px 8px;font-weight:900;font-size:10px;cursor:pointer;">⏹️ Stop</button>
    </div>

    <div id="phonkDjModal">
      <div id="phonkDjCard">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:900;font-size:15px;color:#e879f9;">🎧 PHONK DJ v4 & DUO SCANNER</span>
          <div style="display:flex;gap:5px;">
            <button onclick="minimizePhonkDeck()" style="background:#0284c7;border:none;color:#fff;border-radius:8px;padding:4px 9px;cursor:pointer;font-weight:bold;font-size:11px;">💬 Minimize</button>
            <button onclick="stopPhonkLoop();minimizePhonkDeck()" style="background:#ef4444;border:none;color:#fff;border-radius:8px;padding:4px 9px;cursor:pointer;font-weight:bold;font-size:11px;">✕</button>
          </div>
        </div>
        <div id="djNowPlaying" style="font-size:11px;color:#67e8f9;margin-top:4px;font-weight:bold;">🎛️ 8 Phonk Beats + 8 Live Pads! Hit Minimize to chat while playing!</div>
        <div class="dj-viz" id="djVisualizer">
          <div class="dj-bar"></div><div class="dj-bar"></div><div class="dj-bar"></div><div class="dj-bar"></div>
          <div class="dj-bar"></div><div class="dj-bar"></div><div class="dj-bar"></div><div class="dj-bar"></div>
          <div class="dj-bar"></div><div class="dj-bar"></div><div class="dj-bar"></div><div class="dj-bar"></div>
        </div>
        <div class="dj-loops">
          <button class="dj-loop-btn" id="loopDrift" onclick="togglePhonkBeat('drift','🔥 Drift Phonk')">🔥 Drift Phonk</button>
          <button class="dj-loop-btn" id="loopBrazil" onclick="togglePhonkBeat('brazil','🇧🇷 Brazilian Phonk')">🇧🇷 Brazilian Phonk</button>
          <button class="dj-loop-btn" id="loopMurder" onclick="togglePhonkBeat('murder','👻 Kordhell Murder')">👻 Kordhell Murder</button>
          <button class="dj-loop-btn" id="loopSigma" onclick="togglePhonkBeat('sigma','🗿 Sigma GigaChad')">🗿 Sigma GigaChad</button>
          <button class="dj-loop-btn" id="loopMemphis" onclick="togglePhonkBeat('memphis','👹 Dark Memphis')">👹 Dark Memphis</button>
          <button class="dj-loop-btn" id="loopCyber" onclick="togglePhonkBeat('cyber','🚀 Neon Cyberpunk')">🚀 Neon Cyberpunk</button>
          <button class="dj-loop-btn" id="loopTokyo" onclick="togglePhonkBeat('tokyo','🏎️ Tokyo Drift')">🏎️ Tokyo Drift</button>
          <button class="dj-loop-btn" id="loopDemon" onclick="togglePhonkBeat('demon','⚔️ Demon Slayer Phonk')">⚔️ Demon Slayer</button>
        </div>
        <button onclick="stopPhonkLoop()" style="width:100%;padding:5px;border:1px solid #f87171;border-radius:10px;background:rgba(239,68,68,0.2);color:#fecaca;font-weight:bold;font-size:11px;cursor:pointer;margin-bottom:6px;">⏹️ Stop Active Beat Loop</button>
        <div class="dj-pads">
          <button class="dj-pad" onclick="triggerDjSound('cowbell1')">🔔 Bell Hi</button>
          <button class="dj-pad" onclick="triggerDjSound('cowbell2')">🔔 Bell Lo</button>
          <button class="dj-pad" onclick="triggerDjSound('bass808')">💥 808 DROP</button>
          <button class="dj-pad" onclick="triggerDjSound('kick')">🥁 Kick</button>
          <button class="dj-pad" onclick="triggerDjSound('siren')">🚨 Siren</button>
          <button class="dj-pad" onclick="triggerDjSound('scratch')">💿 Scratch</button>
          <button class="dj-pad" onclick="triggerDjSound('laser')">⚡ Laser</button>
          <button class="dj-pad" onclick="triggerDjSound('horn')">📯 Horn</button>
        </div>
        <div class="aura-box">
          <div style="font-size:11px;font-weight:bold;color:#7dd3fc;margin-bottom:5px;">🔮 VISUAL DUO & AURA CARD DROPPER</div>
          <div class="aura-modes">
            <button class="aura-mode-btn active" id="modeBhai" onclick="setAuraMode('bhai')">🤝 Bhaichara</button>
            <button class="aura-mode-btn" id="modeRival" onclick="setAuraMode('rival')">⚔️ Rivalry</button>
            <button class="aura-mode-btn" id="modeVibe" onclick="setAuraMode('vibe')">💖 Vibe Match</button>
          </div>
          <div style="display:flex;gap:5px;margin-bottom:6px;">
            <input id="auraP1" placeholder="Player 1 (or You)" style="flex:1;padding:6px;border-radius:8px;border:1px solid #38bdf8;background:#090d16;color:#fff;font-size:11px;">
            <input id="auraP2" placeholder="Player 2 (Duo Partner)" style="flex:1;padding:6px;border-radius:8px;border:1px solid #38bdf8;background:#090d16;color:#fff;font-size:11px;">
          </div>
          <button onclick="scanAndDropAuraCard()" style="width:100%;padding:8px;border:none;border-radius:10px;background:linear-gradient(90deg,#ec4899,#8b5cf6,#06b6d4);color:#fff;font-weight:900;font-size:12px;cursor:pointer;">🎴 Generate & Drop Aura Card in Chat!</button>
        </div>
      </div>
    </div>
    <script>
    (function() {
      let audioCtx = null, beatTimer = null, beatStep = 0, activeTrackLabel = null, auraMode = 'bhai';

      window.setAuraMode = function(m) {
        auraMode = m;
        document.getElementById('modeBhai').classList.toggle('active', m === 'bhai');
        document.getElementById('modeRival').classList.toggle('active', m === 'rival');
        document.getElementById('modeVibe').classList.toggle('active', m === 'vibe');
      };

      function getAudio() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
      }

      function bounceVisualizer() {
        const bars = document.querySelectorAll('#djVisualizer .dj-bar');
        bars.forEach(b => { b.style.height = (Math.floor(Math.random() * 82) + 18) + '%'; });
        setTimeout(() => bars.forEach(b => { b.style.height = '15%'; }), 140);
      }

      window.minimizePhonkDeck = function() {
        document.getElementById('phonkDjModal').style.display = 'none';
        const bar = document.getElementById('phonkMiniBar');
        if (bar) {
          bar.style.display = activeTrackLabel ? 'flex' : 'none';
          const lbl = document.getElementById('miniBarTrack');
          if (lbl && activeTrackLabel) lbl.textContent = '🎧 ' + activeTrackLabel;
        }
      };

      window.playPhonkSynth = function(sound) {
        try {
          const ctx = getAudio(), now = ctx.currentTime;
          bounceVisualizer();

          if (sound === 'cowbell1' || sound === 'cowbell2' || sound === 'cowbell3' || sound === 'cowbell4') {
            const freqMap = { cowbell1: 540, cowbell2: 405, cowbell3: 640, cowbell4: 480 };
            const baseFreq = freqMap[sound] || 540;
            [baseFreq, baseFreq * 1.48].forEach(f => {
              const osc = ctx.createOscillator(), gain = ctx.createGain();
              osc.type = 'square'; osc.frequency.setValueAtTime(f, now);
              gain.gain.setValueAtTime(0.16, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
              osc.connect(gain); gain.connect(ctx.destination);
              osc.start(now); osc.stop(now + 0.22);
            });
          } else if (sound === 'bass808' || sound === 'kick') {
            const osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.type = 'sine';
            const startF = (sound === 'bass808') ? 135 : 165, endF = (sound === 'bass808') ? 35 : 45, dur = (sound === 'bass808') ? 0.62 : 0.24;
            osc.frequency.setValueAtTime(startF, now); osc.frequency.exponentialRampToValueAtTime(endF, now + dur);
            gain.gain.setValueAtTime(0.45, now); gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(now); osc.stop(now + dur + 0.02);
          } else if (sound === 'siren' || sound === 'horn') {
            const osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.type = 'sawtooth';
            if (sound === 'horn') {
              osc.frequency.setValueAtTime(470, now); osc.frequency.linearRampToValueAtTime(510, now + 0.4);
            } else {
              osc.frequency.setValueAtTime(600, now); osc.frequency.linearRampToValueAtTime(1150, now + 0.35); osc.frequency.linearRampToValueAtTime(520, now + 0.65);
            }
            gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.66);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(now); osc.stop(now + 0.68);
          } else if (sound === 'scratch' || sound === 'laser') {
            const osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.type = (sound === 'laser') ? 'sawtooth' : 'triangle';
            osc.frequency.setValueAtTime(sound === 'laser' ? 1400 : 900, now);
            osc.frequency.exponentialRampToValueAtTime(160, now + 0.18);
            gain.gain.setValueAtTime(0.22, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(now); osc.stop(now + 0.23);
          }
        } catch (e) {}
      };

      window.triggerDjSound = function(sound) {
        window.playPhonkSynth(sound);
        if (typeof socket !== 'undefined') socket.emit('phonkDjDrop', { sound });
      };

      window.stopPhonkLoop = function() {
        if (beatTimer) { clearInterval(beatTimer); beatTimer = null; }
        activeTrackLabel = null;
        document.querySelectorAll('.dj-loop-btn').forEach(b => b.classList.remove('active'));
        const bar = document.getElementById('phonkMiniBar');
        if (bar) bar.style.display = 'none';
      };

      window.togglePhonkBeat = function(style, label) {
        window.stopPhonkLoop();
        activeTrackLabel = label || style;
        const idMap = {
          drift: 'loopDrift', brazil: 'loopBrazil', murder: 'loopMurder', sigma: 'loopSigma',
          memphis: 'loopMemphis', cyber: 'loopCyber', tokyo: 'loopTokyo', demon: 'loopDemon'
        };
        const btn = document.getElementById(idMap[style]);
        if (btn) btn.classList.add('active');
        const np = document.getElementById('djNowPlaying');
        if (np) np.textContent = '🎶 Playing: ' + activeTrackLabel + ' (Hit Minimize to keep playing!)';

        const tracks = {
          drift:   { tempo: 205, seq: ['bass808', 'cowbell1', 'cowbell2', 'kick', 'cowbell1', 'cowbell1', 'bass808', 'cowbell2'] },
          brazil:  { tempo: 185, seq: ['kick', 'cowbell2', 'kick', 'cowbell1', 'bass808', 'cowbell1', 'cowbell2', 'scratch'] },
          murder:  { tempo: 195, seq: ['bass808', 'cowbell3', 'cowbell1', 'cowbell2', 'kick', 'cowbell3', 'cowbell1', 'bass808'] },
          sigma:   { tempo: 225, seq: ['bass808', 'kick', 'cowbell1', 'cowbell1', 'bass808', 'cowbell2', 'cowbell3', 'kick'] },
          memphis: { tempo: 215, seq: ['bass808', 'cowbell2', 'scratch', 'kick', 'cowbell1', 'cowbell2', 'bass808', 'siren'] },
          cyber:   { tempo: 175, seq: ['kick', 'laser', 'cowbell3', 'bass808', 'kick', 'cowbell1', 'laser', 'scratch'] },
          tokyo:   { tempo: 180, seq: ['cowbell3', 'cowbell3', 'kick', 'cowbell1', 'cowbell4', 'bass808', 'cowbell1', 'scratch'] },
          demon:   { tempo: 190, seq: ['bass808', 'cowbell4', 'cowbell1', 'cowbell3', 'kick', 'cowbell2', 'cowbell4', 'bass808'] }
        };
        const chosen = tracks[style] || tracks.drift;
        beatStep = 0;
        beatTimer = setInterval(() => {
          window.triggerDjSound(chosen.seq.at(beatStep % chosen.seq.length));
          beatStep++;
        }, chosen.tempo);
      };
      window.scanAndDropAuraCard = function() {
        const myName = window._savedUname || localStorage.getItem('sammu_username') || localStorage.getItem('username') || 'Player';
        const p1 = ((document.getElementById('auraP1').value || '').trim() || myName).slice(0, 16);
        const p2 = (document.getElementById('auraP2').value || '').trim().slice(0, 16);

        const pct = Math.floor(Math.random() * 41) + 60;
        const tiers = [
          { score: "+999,999 ∞", rank: "🗿 GIGACHAD PHONK GODS", c1: "#3b0764", c2: "#be185d" },
          { score: "+88,500 ⚡", rank: "👑 SUPREME ARENA DUO", c1: "#0f172a", c2: "#0284c7" },
          { score: "+42,069 🔥", rank: "🥷 SHADOW NINJA SQUAD", c1: "#064e3b", c2: "#059669" },
          { score: "+19,400 ✨", rank: "🎧 CERTIFIED DRIFT VIBES", c1: "#312e81", c2: "#7c3aed" }
        ];
        const t = tiers.at(Math.floor(Math.random() * tiers.length));
        const modeLabels = { bhai: "🤝 BHAICHARA METER", rival: "⚔️ RIVALRY POWER", vibe: "💖 COSMIC VIBE SYNC" };

        const c = document.createElement('canvas');
        c.width = 320; c.height = 175;
        const ctx = c.getContext('2d');

        const grad = ctx.createLinearGradient(0, 0, 320, 175);
        grad.addColorStop(0, t.c1); grad.addColorStop(1, t.c2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 320, 175);

        ctx.strokeStyle = "#f472b6"; ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, 312, 167);

        ctx.fillStyle = "#fde047"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(p2 ? modeLabels[auraMode] : "🔮 SOLO PHONK AURA SCAN", 160, 26);

        ctx.fillStyle = "#ffffff"; ctx.font = "900 18px sans-serif";
        ctx.fillText(p2 ? (p1 + "  ⚡  " + p2) : p1, 160, 56);

        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(35, 72, 250, 18);
        ctx.fillStyle = "#4ade80";
        ctx.fillRect(35, 72, Math.round(2.5 * pct), 18);
        ctx.fillStyle = "#fff"; ctx.font = "bold 11px sans-serif";
        ctx.fillText(pct + "% SYNCED", 160, 85);

        ctx.fillStyle = "#67e8f9"; ctx.font = "900 16px sans-serif";
        ctx.fillText("AURA: " + t.score, 160, 118);

        ctx.fillStyle = "#fbcfe8"; ctx.font = "bold 13px sans-serif";
        ctx.fillText(t.rank, 160, 146);

        const cardImg = c.toDataURL('image/jpeg', 0.82);
        window.triggerDjSound('bass808');
        if (typeof socket !== 'undefined') {
          socket.emit('dropAuraCard', { image: cardImg, p1, p2, pct, rank: t.rank });
        }
        window.minimizePhonkDeck();
      };

      function setupPhonkDjAndAntiDrop() {
        if (!document.getElementById('openPhonkDjBtn')) {
          const anchor = document.getElementById('openChefBtn') || document.getElementById('openMakeupBtn') ||
            Array.from(document.querySelectorAll('button, a, div[onclick]')).find(el => el.children.length === 0 && /jam|🎹/i.test(el.textContent || ''));
          if (anchor && anchor.parentNode) {
            const btn = anchor.cloneNode(true);
            btn.id = 'openPhonkDjBtn'; btn.removeAttribute('onclick'); btn.textContent = '🎧 Phonk DJ';
            btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); document.getElementById('phonkDjModal').style.display = 'flex'; };
            anchor.parentNode.insertBefore(btn, anchor.nextSibling);
          }
        }

        if (typeof socket !== 'undefined' && !window._phonkSockBound) {
          window._phonkSockBound = true;

          if (socket.io && socket.io.opts) {
            socket.io.opts.reconnectionDelay = 400;
            socket.io.opts.reconnectionDelayMax = 2500;
          }

          const origEmit = socket.emit.bind(socket);
          socket.emit = function(ev, payload, ...rest) {
            if (ev === 'joinRoom' && payload && typeof payload === 'object') {
              if (payload.username) window._savedUname = payload.username;
              if (payload.avatar) window._savedAvatar = payload.avatar;
            }
            return origEmit(ev, payload, ...rest);
          };

          socket.on('connect', () => {
            if (window.selectedServerId) {
              origEmit('verifyServerAccess', {
                serverId: window.selectedServerId,
                deviceId: localStorage.getItem('sammu_dev_uid') || ''
              });
              const uname = window._savedUname || localStorage.getItem('sammu_username') || localStorage.getItem('username');
              const avatar = window._savedAvatar || localStorage.getItem('sammu_avatar') || localStorage.getItem('avatar') || '🥷';
              if (uname) {
                setTimeout(() => {
                  origEmit('joinRoom', {
                    username: uname, avatar: avatar,
                    deviceId: localStorage.getItem('sammu_dev_uid') || '', isReconnect: true
                  });
                }, 250);
              }
            }
          });

          socket.on('incomingPhonkDrop', (data) => {
            if (!data || !data.sound) return;
            if (data._serverId && window.selectedServerId && data._serverId !== window.selectedServerId) return;
            window.playPhonkSynth(data.sound);
            const label = document.getElementById('djNowPlaying');
            if (label && data.dj) label.textContent = '🎧 Live DJ: ' + data.dj + ' dropped ' + data.sound.toUpperCase() + '!';
          });
        }
      }

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && typeof socket !== 'undefined' && !socket.connected) socket.connect();
      });

      window.addEventListener('DOMContentLoaded', () => { setupPhonkDjAndAntiDrop(); setTimeout(setupPhonkDjAndAntiDrop, 1200); });
    })();
    </script>
    `;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>')) {
                body = body.replace('</body>', PHONK_DJ_WIDGET + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });

    io.on('connection', (socket) => {
        setImmediate(() => {
            const listeners = socket.listeners('disconnect');
            if (listeners.length > 1) {
                const serverJsDisconnect = listeners.at(-1);
                socket.removeListener('disconnect', serverJsDisconnect);

                socket.on('disconnect', () => {
                    const srvId = socket.activeServerId;
                    const rawName = (socket.username || '').trim();
                    const uname = rawName.toLowerCase();
                    if (!srvId || !uname) return;

                    if (djPendingReconnects.has(uname)) clearTimeout(djPendingReconnects.get(uname).timer);
                    const timer = setTimeout(() => {
                        djPendingReconnects.delete(uname);
                        const roomSet = io.sockets.adapter.rooms.get(srvId) || new Set();
                        let stillOnline = false;
                        for (const sid of roomSet) {
                            const s = io.sockets.sockets.get(sid);
                            if (s && s.username && s.username.trim().toLowerCase() === uname) {
                                stillOnline = true; break;
                            }
                        }
                        if (!stillOnline) {
                            io.to(srvId).emit('message', {
                                username: "Sammu's Bot",
                                text: `😢 ${rawName} has left the room`,
                                _serverId: srvId
                            });
                            syncArenaPlayers(srvId);
                        }
                    }, 25000);
                    djPendingReconnects.set(uname, { srvId, timer });
                });
            }
        });

        socket.on('joinRoom', (data) => {
            const uname = (data && data.username) ? data.username.trim().toLowerCase() : (socket.username || '').toLowerCase();
            if (uname && djPendingReconnects.has(uname)) {
                clearTimeout(djPendingReconnects.get(uname).timer);
                djPendingReconnects.delete(uname);
            }
        });

        socket.on('phonkDjDrop', (data) => {
            if (!socket.activeServerId || !data || !data.sound) return;
            socket.to(socket.activeServerId).emit('incomingPhonkDrop', {
                sound: data.sound,
                dj: socket.username || 'DJ',
                _serverId: socket.activeServerId
            });
        });

        socket.on('dropAuraCard', (data) => {
            if (!socket.activeServerId || !data || !data.image) return;
            const caption = data.p2
                ? `🔮 **${data.p1}** & **${data.p2}** — **${data.pct}%** (${data.rank})`
                : `🔮 **${data.p1}**'s Phonk Aura — ${data.rank}`;
            io.to(socket.activeServerId).emit('message', {
                senderId: socket.id,
                username: "🎧 Phonk Aura DJ",
                avatar: "🔮",
                text: caption,
                imageUrl: data.image,
                _serverId: socket.activeServerId
            });
        });
    });
    // === END phonk======  //       
     // === V14 COMPLETE ARMORY & ECONOMY - PIECE 1 ===
    OG_HOSTS.delete("Zaira");
    OG_HOSTS.add("zaira");

    const V14_SECRET_CODES = {
        '#sammuop':    { avatarId: 'superhost',   name: '🪷👑 SAMAKSH 👑🪷' },
        '#millyqueen': { avatarId: 'host_milly',  name: '👸💖 Princess Milly' },
        '#moongalaxy': { avatarId: 'host_moon',   name: '🩺🌙 Dr. Moon' },
        '#ishikagold': { avatarId: 'host_ishika', name: '☀️✨ Empress Ishika' },
        '#zorosword':  { avatarId: 'host_zoro',   name: '⚔️🐉 Zoro 3-Sword' },
        '#sidbolt':    { avatarId: 'host_sid',    name: '😎⚡ Sid Thunder' },
        '#shubhirose': { avatarId: 'host_shubhi', name: '🌷 Shubhi Sakura' },
        '#sarahfly':   { avatarId: 'host_sarah',  name: '🦋 Sarah Valkyrie' },
        '#heerstar':   { avatarId: 'host_heer',   name: '🌸 Heer Starlight' },
        '#izzanfire':  { avatarId: 'host_izzan',  name: '🔥 Izzan Dragon' },
        '#susshadow':  { avatarId: 'host_sus',    name: '👸💚 Princess Sus' },
        '#zairaorbit': { avatarId: 'host_zaira',  name: '🪐 Zaira Nova' },
        '#advaitvolt': { avatarId: 'host_advait', name: '⚡ Advait Titan' },
        '#ruwiibloom': { avatarId: 'host_ruwii',  name: '🌺 Ruwii Kitsune' }
    };

    const v14EquippedDB = {};
    const AV_REFS_FILE = path.join(__dirname, 'avatar_refs_db.json');
    const ECON_DB_FILE = path.join(__dirname, 'player_economy_db.json');
    let avatarRefsDB = {};
    let econDB = {};

    if (fs.existsSync(AV_REFS_FILE)) { try { avatarRefsDB = JSON.parse(fs.readFileSync(AV_REFS_FILE, 'utf8')); } catch (e) {} }
    if (fs.existsSync(ECON_DB_FILE)) { try { econDB = JSON.parse(fs.readFileSync(ECON_DB_FILE, 'utf8')); } catch (e) {} }

    function saveAvRefs() { try { fs.writeFileSync(AV_REFS_FILE, JSON.stringify(avatarRefsDB, null, 2)); } catch (e) {} }
    function saveEcon()   { try { fs.writeFileSync(ECON_DB_FILE, JSON.stringify(econDB, null, 2)); } catch (e) {} }
    function getOrCreateEcon(u) {
        const c = (u || '').trim().toLowerCase();
        if (!c) return null;
        if (!econDB[c]) econDB[c] = { mvp: 0, streak: 0, lastDay: '', unlocked: [], customTitle: '' };
        return econDB[c];
    }
      // === V14 COMPLETE ARMORY & ECONOMY - PIECE 2 ===
    io.on('connection', (socket) => {
        socket.on('joinRoom', (data) => {
            const uname = (data && data.username) ? data.username.trim().toLowerCase() : '';
            if (!uname) return;
            const rec = getOrCreateEcon(uname);
            const today = new Date().toISOString().slice(0, 10);
            const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

            if (rec.lastDay !== today) {
                rec.streak = (rec.lastDay === yesterday) ? (rec.streak + 1) : 1;
                rec.lastDay = today;
                if (rec.streak >= 10 && !rec.unlocked.includes('streak_10_phoenix')) {
                    rec.unlocked.push('streak_10_phoenix');
                    setTimeout(() => {
                        socket.emit('message', {
                            username: "Sammu's Bot",
                            text: `🔥🎉 **10-DAY STREAK COMPLETE!** **${data.username}** unlocked **🔥 Phoenix Warlord** in the Guild Armory! 🏆`,
                            _serverId: socket.activeServerId
                        });
                    }, 1200);
                }
                saveEcon();
            }
            socket.emit('v14EconSync', rec);
        });

        socket.on('verifyAvatarCodeV6', ({ code }) => {
            const match = V14_SECRET_CODES[(code || '').trim().toLowerCase()];
            if (match) {
                socket.isCodeVerified = match.avatarId;
                socket.emit('avatarCodeResultV6', { ok: true, avatarId: match.avatarId, name: match.name });
            } else {
                socket.emit('avatarCodeResultV6', { ok: false });
            }
        });

        socket.on('equipAvatarFxV6', (data) => {
            if (!data || !data.username) return;
            const cleanU = data.username.trim().toLowerCase();
            const isCreator = (data.avatarId === 'superhost') && (verifyOGHostTripleLock(cleanU, socket, false) || socket.isCodeVerified === 'superhost');
            const isMilly = (data.avatarId === 'host_milly') && (verifyOGHostTripleLock(cleanU, socket, false) || socket.isCodeVerified === 'host_milly');
            if ((data.avatarId === 'superhost' && !isCreator) || (data.avatarId === 'host_milly' && !isMilly)) return;

            v14EquippedDB[cleanU] = { avatarId: data.avatarId, fx: data.fx, badge: data.badge };
            if (socket.activeServerId) {
                io.to(socket.activeServerId).emit('avatarStatsDataV6', { avatarMap: v14EquippedDB });
                if (data.avatarId === 'superhost' || data.avatarId.startsWith('host_')) {
                    io.to(socket.activeServerId).emit('v14BossArrival', { player: data.username, title: data.badge, _serverId: socket.activeServerId });
                }
            }
        });

        socket.on('getMyAvatarStatsV6', () => socket.emit('avatarStatsDataV6', { avatarMap: v14EquippedDB }));
        socket.on('getV14Econ', (u) => { const r = getOrCreateEcon(u); if (r) socket.emit('v14EconSync', r); });
        socket.on('syncEarnedMvp', ({ username, pts }) => {
            const r = getOrCreateEcon(username);
            if (r) { r.mvp = Math.max(r.mvp, Number(pts) || 0); saveEcon(); socket.emit('v14EconSync', r); }
        });

        socket.on('buyV14ShopItem', ({ username, itemType, itemId, cost, label }) => {
            const r = getOrCreateEcon(username);
            const price = Number(cost) || 0;
            if (!r || r.mvp < price) return socket.emit('v14ShopResult', { ok: false, msg: `❌ Need ${price} MVP Points! (You have ${r ? r.mvp : 0})` });
            if (itemType === 'avatar') {
                if (r.unlocked.includes(itemId)) return;
                r.mvp -= price; r.unlocked.push(itemId);
            } else if (itemType === 'title') {
                r.mvp -= price; r.customTitle = label;
                if (v14EquippedDB[username.toLowerCase()]) v14EquippedDB[username.toLowerCase()].badge = label;
                else v14EquippedDB[username.toLowerCase()] = { avatarId: 'diamond', fx: 'v14-ring-gold', badge: label };
                if (socket.activeServerId) io.to(socket.activeServerId).emit('avatarStatsDataV6', { avatarMap: v14EquippedDB });
            }
            saveEcon();
            socket.emit('v14EconSync', r);
            socket.emit('v14ShopResult', { ok: true, msg: `🎉 Unlocked ${label}!` });
        });

        socket.on('registerAvatarRef', ({ refUser, deviceId }) => {
            const c = (refUser || '').trim().toLowerCase();
            if (!c || !deviceId) return;
            if (!avatarRefsDB[c]) avatarRefsDB[c] = [];
            if (!avatarRefsDB[c].includes(deviceId)) { avatarRefsDB[c].push(deviceId); saveAvRefs(); io.emit('avatarRefCountUpdate', { username: c, count: avatarRefsDB[c].length }); }
        });

        socket.on('getMyAvatarRefCount', (u) => {
            const c = (u || '').trim().toLowerCase();
            socket.emit('avatarRefCountUpdate', { username: c, count: (c && avatarRefsDB[c]) ? avatarRefsDB[c].length : 0 });
        });

        socket.on('creatorOpAction', (data) => {
            if (!socket.activeServerId || !data || !data.type) return;
            const c = (socket.username || '').trim().toLowerCase();
            if (!(v14EquippedDB[c] && v14EquippedDB[c].avatarId === 'superhost') && !verifyOGHostTripleLock(c, socket, false)) return;
            io.to(socket.activeServerId).emit('triggerCreatorFx', { type: data.type, text: data.text || '', _serverId: socket.activeServerId });
        });
    });
    // === V14 COMPLETE ARMORY & ECONOMY - PIECE 3 ===
    const V14_CLIENT_BUNDLE = `
    <style>
      @keyframes v14Chakra3D { 0% { transform: perspective(260px) rotateX(58deg) rotateY(-12deg) rotateZ(0deg); } 50% { transform: perspective(260px) rotateX(52deg) rotateY(12deg) rotateZ(180deg); } 100% { transform: perspective(260px) rotateX(58deg) rotateY(-12deg) rotateZ(360deg); } }
      @keyframes v14PrismGlow { 0%, 100% { box-shadow: 0 0 10px #fde047; border-color: #fde047; } 50% { box-shadow: 0 0 12px #38bdf8; border-color: #38bdf8; } }
      @keyframes v14BossIn { 0% { transform: translate(-50%,-50%) scale(0.7); opacity: 0; } 15% { transform: translate(-50%,-50%) scale(1.03); opacity: 1; } 85% { transform: translate(-50%,-50%) scale(1); opacity: 1; } 100% { transform: translate(-50%,-50%) scale(1.1); opacity: 0; } }

      .v14-chakra-3d { transform-origin: 50px 48px; animation: v14Chakra3D 8s linear infinite; }
      .v14-ring-samaksh { border: 2.5px solid #fde047 !important; animation: v14PrismGlow 2.6s ease-in-out infinite !important; }
      .v14-ring-empress { border: 2.5px solid #fbcfe8 !important; box-shadow: 0 0 10px #f472b6 !important; }
      .v14-ring-ice     { border: 2px solid #38bdf8 !important; box-shadow: 0 0 8px #0284c7 !important; }
      .v14-ring-fire    { border: 2px solid #fb923c !important; box-shadow: 0 0 8px #ea580c !important; }
      .v14-ring-pink    { border: 2px solid #f472b6 !important; box-shadow: 0 0 8px #ec4899 !important; }
      .v14-ring-emerald { border: 2px solid #4ade80 !important; box-shadow: 0 0 8px #10b981 !important; }
      .v14-ring-gold    { border: 2px solid #fde047 !important; box-shadow: 0 0 8px #eab308 !important; }
      .v14-ring-violet  { border: 2px solid #c084fc !important; box-shadow: 0 0 8px #9333ea !important; }

      .v14-chat-samaksh { background: linear-gradient(120deg, rgba(255,0,85,0.34), rgba(253,224,71,0.26), rgba(0,240,255,0.34)) !important; border: 2px solid #fde047 !important; border-radius: 14px !important; color: #fff !important; font-weight: 800 !important; }
      .v14-chat-empress { background: linear-gradient(135deg, rgba(244,114,182,0.36), rgba(251,207,232,0.22)) !important; border: 2px solid #fbcfe8 !important; border-radius: 14px !important; color: #fff !important; font-weight: 800 !important; }
      .v14-chat-ice     { background: linear-gradient(135deg, rgba(2,132,199,0.32), rgba(56,189,248,0.18)) !important; border: 1.5px solid #38bdf8 !important; border-radius: 14px !important; color: #fff !important; }
      .v14-chat-fire    { background: linear-gradient(135deg, rgba(220,38,38,0.32), rgba(249,115,22,0.2)) !important; border: 1.5px solid #fb923c !important; border-radius: 14px !important; color: #fff !important; }
      .v14-chat-pink    { background: linear-gradient(135deg, rgba(219,39,119,0.3), rgba(244,114,182,0.18)) !important; border: 1.5px solid #f472b6 !important; border-radius: 14px !important; color: #fff !important; }
      .v14-chat-emerald { background: linear-gradient(135deg, rgba(5,150,105,0.32), rgba(74,222,128,0.18)) !important; border: 1.5px solid #4ade80 !important; border-radius: 14px !important; color: #fff !important; }
      .v14-chat-gold    { background: linear-gradient(135deg, rgba(217,119,6,0.32), rgba(253,224,71,0.2)) !important; border: 1.5px solid #fde047 !important; border-radius: 14px !important; color: #fff !important; }
      .v14-chat-violet  { background: linear-gradient(135deg, rgba(124,58,237,0.32), rgba(192,132,252,0.2)) !important; border: 1.5px solid #c084fc !important; border-radius: 14px !important; color: #fff !important; }

      .v14-bubble { position:relative !important; display:inline-flex !important; width:40px !important; height:40px !important; border-radius:50% !important; overflow:hidden !important; vertical-align:middle !important; margin-right:6px !important; background:#090d16 !important; flex-shrink:0 !important; cursor:pointer !important; }
      .v14-bubble img, .st-art img, #stZoomRing img { width:100% !important; height:100% !important; object-fit:cover !important; display:block !important; border-radius:50% !important; }
      .v14-pin { position:absolute; bottom:-1px; right:-1px; font-size:12px; filter:drop-shadow(0 1px 2px #000); }
      .v14-title-pill { display:inline-block; font-size:9px; font-weight:900; padding:1px 6px; border-radius:8px; margin-left:5px; background:#1e1b4b; border:1px solid #fde047; color:#fde047; vertical-align:middle; }
       /* === V14 COMPLETE ARMORY & ECONOMY - PIECE 4 === */
      #v14BossSlash { display:none; position:fixed; top:25%; left:50%; z-index:99999999; background:linear-gradient(90deg,#090d16,#311042,#7c2d12,#090d16); border-top:2px solid #fde047; border-bottom:2px solid #38bdf8; padding:10px 22px; text-align:center; color:#fff; min-width:260px; pointer-events:none; animation:v14BossIn 3.1s ease-in-out forwards; }
      #opCreatorDock { display:none; position:fixed; bottom:68px; right:10px; z-index:999998; background:#0f172a; border:2px solid #fde047; border-radius:14px; padding:8px; flex-direction:column; gap:5px; width:150px; }
      .op-dock-btn { background:#2563eb; border:1px solid #38bdf8; color:#fff; font-weight:800; font-size:11px; padding:6px; border-radius:8px; }
      #opGiantBanner { display:none; position:fixed; top:18%; left:50%; transform:translateX(-50%); z-index:9999999; background:#090d16; border:2.5px solid #fde047; padding:12px; border-radius:14px; text-align:center; width:85%; max-width:340px; color:#fff; }
      #stVaultModal, #stZoomModal { display:none; position:fixed; inset:0; background:rgba(4,7,18,0.95); z-index:999999999; align-items:center; justify-content:center; padding:10px; }
      #stVaultCard { background:linear-gradient(160deg,#0f172a,#1e1b4b); border:2px solid #38bdf8; border-radius:18px; padding:12px; width:100%; max-width:410px; color:#fff; text-align:center; max-height:88vh; overflow-y:auto; }
      #stZoomCard { background:linear-gradient(160deg,#090d16,#1e1b4b); border:2.5px solid #fde047; border-radius:22px; padding:18px; width:100%; max-width:290px; color:#fff; text-align:center; }
      .st-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:7px; margin:8px 0; }
      .st-item { background:rgba(255,255,255,0.08); border:1.5px solid rgba(56,189,248,0.45); border-radius:12px; padding:7px 4px; cursor:pointer; }
      .st-item.locked { opacity:0.62; border-color:#64748b; }
      .st-art { position:relative; width:64px; height:64px; margin:0 auto 4px auto; border-radius:50%; overflow:hidden; background:#090d16; }
      #stZoomRing { position:relative; width:155px; height:155px; margin:12px auto; border-radius:50%; overflow:hidden; background:#090d16; }
      .v14-dot { width:20px; height:20px; border-radius:50%; border:2px solid #fff; cursor:pointer; }
    </style>

    <div id="v14BossSlash"><div style="font-size:10px;letter-spacing:1.5px;color:#fde047;font-weight:900;">⚡ MYTHIC CHALLENGER APPEARED ⚡</div><div id="v14BossName" style="font-size:18px;font-weight:900;"></div><div id="v14BossTitle" style="font-size:12px;color:#38bdf8;font-weight:800;"></div></div>
    <div id="opGiantBanner"><div style="font-size:10px;color:#fde047;font-weight:900;">⚡ CREATOR BROADCAST ⚡</div><div id="opBannerText" style="font-size:16px;font-weight:900;margin-top:3px;"></div></div>
    <div id="opCreatorDock">
      <div style="display:flex;justify-content:space-between;color:#fde047;font-size:10px;font-weight:900;"><span>⚡ ROYAL POWERS</span><button onclick="document.getElementById('opCreatorDock').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:4px;padding:0 5px;">✕</button></div>
      <button class="op-dock-btn" onclick="socket.emit('creatorOpAction',{type:'shake'})">🌋 Screen Shake</button>
      <button class="op-dock-btn" onclick="socket.emit('creatorOpAction',{type:'confetti'})">🎊 Party Drop</button>
      <button class="op-dock-btn" onclick="const m=prompt('Banner Text:');if(m)socket.emit('creatorOpAction',{type:'banner',text:m})">📢 Big Banner</button>
    </div>

    <div id="stVaultModal" onclick="if(event.target===this)this.style.display='none'">
      <div id="stVaultCard">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:900;font-size:15px;color:#38bdf8;">⚔️ SAMMU GUILD ARMORY</span>
          <button onclick="document.getElementById('stVaultModal').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:8px;padding:4px 10px;font-weight:900;">✕</button>
        </div>
        <div id="v14WalletTop" style="margin-top:6px;"></div>
        <div class="st-grid" id="stGrid"></div>
        <div style="display:flex;gap:6px;margin-top:6px;">
          <input id="stCodeInput" placeholder="Enter Secret Code..." style="flex:1;padding:8px;border-radius:10px;border:1.5px solid #c084fc;background:#090d16;color:#fff;font-size:12px;">
          <button onclick="stRedeemCode()" style="padding:8px 12px;background:linear-gradient(90deg,#a855f7,#ec4899);border:none;color:#fff;border-radius:10px;font-weight:bold;font-size:12px;">🔓 Unlock</button>
        </div>
        <div style="display:flex;gap:7px;justify-content:center;align-items:center;margin-top:8px;padding:6px;background:rgba(255,255,255,0.05);border-radius:12px;">
          <span style="font-size:10px;font-weight:900;color:#cbd5e1;">Aura:</span>
          <div class="v14-dot" style="background:linear-gradient(45deg,#fde047,#38bdf8,#f43f5e);" onclick="switchMyAura('v14-ring-samaksh')"></div>
          <div class="v14-dot" style="background:#f472b6;" onclick="switchMyAura('v14-ring-empress')"></div>
          <div class="v14-dot" style="background:#38bdf8;" onclick="switchMyAura('v14-ring-ice')"></div>
          <div class="v14-dot" style="background:#fb923c;" onclick="switchMyAura('v14-ring-fire')"></div>
          <div class="v14-dot" style="background:#4ade80;" onclick="switchMyAura('v14-ring-emerald')"></div>
          <div class="v14-dot" style="background:#fde047;" onclick="switchMyAura('v14-ring-gold')"></div>
        </div>
      </div>
    </div>

    <div id="stZoomModal" onclick="this.style.display='none'">
      <div id="stZoomCard" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:900;font-size:12px;color:#7dd3fc;">✨ CHARACTER SHOWCASE</span>
          <button onclick="document.getElementById('stZoomModal').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 8px;font-weight:900;">✕</button>
        </div>
        <div id="stZoomRing"></div>
        <div id="stZoomUser" style="font-size:18px;font-weight:900;color:#fff;">Player</div>
        <div id="stZoomTitle" style="font-size:12px;color:#fde047;margin-top:3px;font-weight:bold;">Character</div>
      </div>
    </div>
     <script>
    // === V14 COMPLETE ARMORY & ECONOMY - PIECE 5 ===
    (function() {
      const urlP = new URLSearchParams(window.location.search);
      if (urlP.get('avref')) localStorage.setItem('sammu_pending_avref', urlP.get('avref').trim().toLowerCase());
      let myRefCount = parseInt(localStorage.getItem('sammu_my_avref_count') || '0', 10);
      let myEcon = { mvp: 0, streak: 1, unlocked: [], customTitle: '' };

      const SAMAKSH_3D_URI = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        '<svg xmlns="http://w3.org" viewBox="0 0 100 100">' +
        '<defs><radialGradient id="sBg" cx="50%" cy="32%" r="74%"><stop offset="0%" stop-color="#fde047"/><stop offset="35%" stop-color="#6d28d9"/><stop offset="100%" stop-color="#02040a"/></radialGradient>' +
        '<linearGradient id="sGd" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fef9c3"/><stop offset="50%" stop-color="#facc15"/><stop offset="100%" stop-color="#78350f"/></linearGradient>' +
        '<radialGradient id="sSk" cx="42%" cy="30%" r="68%"><stop offset="0%" stop-color="#e0f2fe"/><stop offset="50%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#1e3a8a"/></radialGradient></defs>' +
        '<circle cx="50" cy="50" r="49" fill="url(#sBg)"/>' +
        '<g class="v14-chakra-3d"><circle cx="50" cy="48" r="44" fill="none" stroke="url(#sGd)" stroke-width="4.2"/><circle cx="50" cy="48" r="38" fill="none" stroke="#38bdf8" stroke-width="1.6" stroke-dasharray="4 3"/>' +
        '<polygon points="50,0 54,8 46,8" fill="#fde047"/><polygon points="50,96 54,88 46,88" fill="#fde047"/><polygon points="2,48 10,44 10,52" fill="#fde047"/><polygon points="98,48 90,44 90,52" fill="#fde047"/>' +
        '<polygon points="15,13 23,17 19,22" fill="#38bdf8"/><polygon points="85,13 77,17 81,22" fill="#38bdf8"/><polygon points="15,83 23,79 19,74" fill="#38bdf8"/><polygon points="85,83 77,79 81,74" fill="#38bdf8"/></g>' +
        '<path d="M16,98 C19,73 33,66 50,66 C67,66 81,73 84,98 Z" fill="url(#sGd)" stroke="#fef9c3" stroke-width="1.4"/>' +
        '<path d="M31,70 L50,89 L69,70" fill="none" stroke="#dc2626" stroke-width="4"/><polygon points="50,72 56,79 50,86 44,79" fill="#38bdf8" stroke="#fff" stroke-width="1.3"/>' +
        '<path d="M33,31 C33,24 67,24 67,31 L66,48 C65,58 56,65 50,66.8 C44,65 35,58 34,48 Z" fill="url(#sSk)" stroke="#bae6fd" stroke-width="1.2"/>' +
        '<path d="M27,42 L32,22 L41,30 L50,18 L59,30 L68,22 L73,42 C64,33 56,34 50,39 C44,34 36,33 27,42 Z" fill="#0f172a"/>' +
        '<polygon points="33,21 38,9 44,17 50,4 56,17 62,9 67,21" fill="url(#sGd)" stroke="#fff" stroke-width="1.1"/>' +
        '<path d="M47.8,37 L47.8,43.5 Q50,45.5 52.2,43.5 L52.2,37" fill="none" stroke="#fff" stroke-width="1.8"/><line x1="50" y1="38" x2="50" y2="43.5" stroke="#ef4444" stroke-width="1.5"/>' +
        '<ellipse cx="41" cy="50.5" rx="4.2" ry="3.2" fill="#fff"/><circle cx="41" cy="50.5" r="2.3" fill="#0284c7"/><circle cx="41" cy="50.5" r="1.1" fill="#fde047"/>' +
        '<ellipse cx="59" cy="50.5" rx="4.2" ry="3.2" fill="#fff"/><circle cx="59" cy="50.5" r="2.3" fill="#0284c7"/><circle cx="59" cy="50.5" r="1.1" fill="#fde047"/>' +
        '<path d="M44,58.5 Q50,62 56,57.5" stroke="#1e3a8a" stroke-width="2" fill="none" stroke-linecap="round"/></svg>'
      );

      const ZORO_FIXED_URI = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        '<svg xmlns="http://w3.org" viewBox="0 0 100 100">' +
        '<circle cx="50" cy="50" r="49" fill="#064e3b"/>' +
        '<line x1="8" y1="60" x2="92" y2="96" stroke="#f8fafc" stroke-width="4" stroke-linecap="round"/><line x1="92" y1="60" x2="8" y2="96" stroke="#4ade80" stroke-width="4" stroke-linecap="round"/>' +
        '<circle cx="15" cy="63" r="3.4" fill="#fde047"/><circle cx="85" cy="63" r="3.4" fill="#fde047"/>' +
        '<path d="M16,98 C19,73 33,66 50,66 C67,66 81,73 84,98 Z" fill="#14532d" stroke="#4ade80" stroke-width="1.5"/>' +
        '<path d="M32,31 C32,24 68,24 68,31 L67,48 C66,58 57,65 50,66.5 C43,65 34,58 33,48 Z" fill="#fcd3b2"/>' +
        '<line x1="30" y1="51" x2="30" y2="57" stroke="#fde047" stroke-width="2" stroke-dasharray="1.5 1"/>' +
        '<polygon points="24,44 19,21 34,28 41,11 50,24 59,11 66,28 81,21 76,44 63,34 50,39 37,34" fill="#16a34a"/>' +
        '<rect x="30" y="30" width="40" height="5" rx="2" fill="#052e16" stroke="#4ade80" stroke-width="1.2"/>' +
        '<ellipse cx="41" cy="50" rx="4" ry="3.3" fill="#fff"/><circle cx="41" cy="50" r="2.2" fill="#15803d"/><line x1="38" y1="44" x2="43" y2="56" stroke="#991b1b" stroke-width="1.8"/>' +
        '<ellipse cx="59" cy="50" rx="4" ry="3.3" fill="#fff"/><circle cx="59" cy="50" r="2.2" fill="#15803d"/>' +
        '<path d="M44,59 Q50,62 56,58" stroke="#7f1d1d" stroke-width="2" fill="none"/></svg>'
      );

      const SUS_PRINCESS_URI = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        '<svg xmlns="http://w3.org" viewBox="0 0 100 100">' +
        '<circle cx="50" cy="50" r="49" fill="#065f46"/>' +
        '<path d="M8,40 Q20,14 38,42 Q18,54 8,40 Z M92,40 Q80,14 62,42 Q82,54 92,40 Z" fill="#d1fae5" opacity="0.78" stroke="#fde047" stroke-width="1.2"/>' +
        '<path d="M15,44 C9,72 14,94 23,99 L77,99 C86,94 91,72 85,44 C85,17 15,17 15,44 Z" fill="#10b981"/>' +
        '<path d="M16,98 C19,73 33,66 50,66 C67,66 81,73 84,98 Z" fill="#047857" stroke="#fde047" stroke-width="1.5"/>' +
        '<circle cx="50" cy="79" r="3.5" fill="#f43f5e" stroke="#fde047" stroke-width="1.2"/>' +
        '<path d="M32,31 C32,24 68,24 68,31 L67,48 C66,58 57,65 50,66.5 C43,65 34,58 33,48 Z" fill="#fff1f2"/>' +
        '<ellipse cx="36" cy="55" rx="4.2" ry="2.4" fill="#fb7185" opacity="0.45"/><ellipse cx="64" cy="55" rx="4.2" ry="2.4" fill="#fb7185" opacity="0.45"/>' +
        '<ellipse cx="41" cy="50" rx="4.2" ry="3.8" fill="#fff"/><circle cx="41" cy="50" r="2.6" fill="#059669"/><circle cx="42.2" cy="48.8" r="1.2" fill="#fff"/>' +
        '<ellipse cx="59" cy="50" rx="4.2" ry="3.8" fill="#fff"/><circle cx="59" cy="50" r="2.6" fill="#059669"/><circle cx="60.2" cy="48.8" r="1.2" fill="#fff"/>' +
        '<path d="M45,58.5 Q50,63 55,58.5" stroke="#e11d48" stroke-width="2" fill="none" stroke-linecap="round"/>' +
        '<path d="M25,46 C25,20 75,20 75,46 C67,33 56,33 50,42 C44,33 33,33 25,46 Z" fill="#34d399"/>' +
        '<polygon points="31,24 37,10 44,19 50,5 56,19 63,10 69,24" fill="#fde047" stroke="#fff" stroke-width="1.3"/></svg>'
      );
       // === V14 COMPLETE ARMORY & ECONOMY - PIECE 6 ===
      const db = (s, seed, bg) => 'https://dicebear.com' + s + '/svg?seed=' + encodeURIComponent(seed) + '&backgroundColor=' + bg;

      const V14_ITEMS = [
        { id: 'superhost',         pin: '👑', name: '🪷👑 SAMAKSH 👑🪷',     ring: 'v14-ring-samaksh', req: 'code', featured: true, img: SAMAKSH_3D_URI },
        { id: 'host_milly',        pin: '👸', name: '👸💖 Princess Milly',   ring: 'v14-ring-empress', req: 'code', featured: true, img: db('lorelei', 'PrincessMillyRoyal', 'f43f5e,fbcfe8') },
        { id: 'diamond',           pin: '💎', name: 'Cyber Striker',         ring: 'v14-ring-ice',     req: 'free', img: db('bottts-neutral', 'CyberStriker77', '0284c7') },
        { id: 'samurai',           pin: '👹', name: 'Crimson Ronin',         ring: 'v14-ring-fire',    req: 'free', img: db('adventurer', 'CrimsonRoninX', 'dc2626') },
        { id: 'phoenix',           pin: '🔥', name: 'Blaze Valkyrie',        ring: 'v14-ring-fire',    req: 'free', img: db('lorelei', 'BlazeValkyrie', 'ea580c') },
        { id: 'ninja',             pin: '🥷', name: 'Shadow Shinobi',        ring: 'v14-ring-violet',  req: 'free', img: db('adventurer-neutral', 'ShadowShinobi', '6d28d9') },
        { id: 'host_sus',          pin: '👸', name: '👸💚 Princess Sus',     ring: 'v14-ring-emerald', req: 'code', img: SUS_PRINCESS_URI },
        { id: 'host_zoro',         pin: '⚔️', name: '⚔️🐉 Zoro 3-Sword',     ring: 'v14-ring-emerald', req: 'code', img: ZORO_FIXED_URI },
        { id: 'host_moon',         pin: '🩺', name: '🩺🌙 Dr. Moon',         ring: 'v14-ring-violet',  req: 'code', img: db('lorelei', 'DrMoonClinicMD', '7c3aed,38bdf8') },
        { id: 'host_ishika',       pin: '☀️', name: '☀️✨ Empress Ishika',   ring: 'v14-ring-gold',    req: 'code', img: db('lorelei', 'EmpressIshikaSun', 'f59e0b,fde047') },
        { id: 'host_sid',          pin: '😎', name: '😎⚡ Sid Thunder',      ring: 'v14-ring-gold',    req: 'code', img: db('adventurer', 'SidThunderShades', 'eab308,1e3a8a') },
        { id: 'host_ruwii',        pin: '🌺', name: '🌺 Ruwii Kitsune',      ring: 'v14-ring-gold',    req: 'code', img: db('lorelei', 'RuwiiKitsuneFox', 'e11d48,f59e0b') },
        { id: 'host_zaira',        pin: '🪐', name: '🪐 Zaira Nova',         ring: 'v14-ring-ice',     req: 'code', img: db('lorelei', 'ZairaCosmicOrbit', '0ea5e9,1e1b4b') },
        { id: 'host_sarah',        pin: '🦋', name: '🦋 Sarah Valkyrie',     ring: 'v14-ring-ice',     req: 'code', img: db('lorelei', 'SarahButterfly9', '0284c7,38bdf8') },
        { id: 'host_shubhi',       pin: '🌷', name: '🌷 Shubhi Sakura',      ring: 'v14-ring-pink',    req: 'code', img: db('lorelei', 'ShubhiBlossom99', 'ec4899,fbcfe8') },
        { id: 'host_heer',         pin: '🌸', name: '🌸 Heer Starlight',     ring: 'v14-ring-pink',    req: 'code', img: db('lorelei', 'HeerStarlight88', 'f472b6,881337') },
        { id: 'host_izzan',        pin: '🔥', name: '🔥 Izzan Dragon',       ring: 'v14-ring-fire',    req: 'code', img: db('adventurer', 'IzzanDragonLord', 'dc2626,7f1d1d') },
        { id: 'host_advait',       pin: '⚡', name: '⚡ Advait Titan',       ring: 'v14-ring-ice',     req: 'code', img: db('adventurer', 'AdvaitCitadelBolt', '2563eb,090d16') },
        { id: 'streak_10_phoenix', pin: '🔥', name: '🔥 Phoenix (10d Streak)', ring: 'v14-ring-fire',  req: 'streak', reqDays: 10, img: db('adventurer', 'PhoenixWarlord10', 'ea580c,7f1d1d') },
        { id: 'shop_reaper',       pin: '💀', name: '💀 Soul Reaper',        ring: 'v14-ring-violet',  req: 'shop', cost: 15, img: db('bottts-neutral', 'SoulReaper15', '4c1d95') },
        { id: 'shop_valkyrie',     pin: '⚔️', name: '⚔️ Frost Valkyrie',     ring: 'v14-ring-ice',     req: 'shop', cost: 25, img: db('lorelei', 'FrostValkyrie25', '0284c7,bae6fd') },
        { id: 'shop_emperor',      pin: '👑', name: '👑 Golden Emperor',     ring: 'v14-ring-gold',    req: 'shop', cost: 40, img: db('adventurer', 'GoldenEmperor40', 'f59e0b,78350f') },
        { id: 'ref_wolf',          pin: '🐺', name: '🐺 Cyber-Wolf (1 Ref)', ring: 'v14-ring-ice',     req: 'ref', reqRefs: 1, img: db('adventurer', 'CyberWolfAlpha1', '0284c7,0f172a') },
        { id: 'ref_kitsune',       pin: '🦊', name: '🦊 Astral Fox (3 Refs)',ring: 'v14-ring-violet',  req: 'ref', reqRefs: 3, img: db('lorelei', 'AstralFoxKitsune3', '7c3aed,1e1b4b') },
        { id: 'ref_sovereign',     pin: '🐉', name: '🐉 Gold Sovereign (5)', ring: 'v14-ring-gold',    req: 'ref', reqRefs: 5, img: db('adventurer', 'GoldSovereign5', 'f59e0b,451a03') }
      ];

      const SHOP_TITLES = [
        { label: '💀 Lobby Demon', cost: 10 },
        { label: '⚡ Clutch God', cost: 20 },
        { label: '👑 Arena King', cost: 35 }
      ];
           // === V14 COMPLETE ARMORY & ECONOMY - PIECE 7 ===
      const v14Players = {};
      const ringToChat = {
        'v14-ring-samaksh': 'v14-chat-samaksh', 'v14-ring-empress': 'v14-chat-empress',
        'v14-ring-ice': 'v14-chat-ice', 'v14-ring-fire': 'v14-chat-fire',
        'v14-ring-pink': 'v14-chat-pink', 'v14-ring-emerald': 'v14-chat-emerald',
        'v14-ring-gold': 'v14-chat-gold', 'v14-ring-violet': 'v14-chat-violet'
      };
      const getMe = () => (window._savedUname || localStorage.getItem('sammu_username') || localStorage.getItem('username') || '').trim().toLowerCase();

      window.stRedeemCode = () => { const c = (document.getElementById('stCodeInput').value || '').trim(); if (c && typeof socket !== 'undefined') socket.emit('verifyAvatarCodeV6', { code: c }); };
      window.buyShopTitle = (cost, label) => { if (typeof socket !== 'undefined') socket.emit('buyV14ShopItem', { username: getMe(), itemType: 'title', itemId: label, cost, label }); };
      window.copyAvatarRefLink = () => {
        const me = getMe(); if (!me) return alert('Join a room first!');
        const link = window.location.origin + '/?avref=' + encodeURIComponent(me);
        if (navigator.clipboard) navigator.clipboard.writeText(link);
        alert('🔗 Avatar Invite Link Copied!\\n' + link + '\\n\\n1 Ref = Cyber-Wolf | 3 Refs = Astral Fox | 5 Refs = Gold Sovereign');
      };

      window.switchMyAura = function(ringClass) {
        const me = getMe(); if (!me || typeof socket === 'undefined' || !v14Players[me]) return alert('Equip a Hero Avatar first!');
        v14Players[me] = { ...v14Players[me], ring: ringClass };
        socket.emit('equipAvatarFxV6', { username: me, avatarId: v14Players[me].id, fx: ringClass, badge: v14Players[me].badge || v14Players[me].name });
      };

      window.stDrawVault = function() {
        const grid = document.getElementById('stGrid');
        const walletTop = document.getElementById('v14WalletTop');
        if (!grid) return;
        const codeUnlocked = JSON.parse(localStorage.getItem('sammu_unlocked_avatars') || '[]');
        const pct = Math.min(100, Math.round((myEcon.streak / 10) * 100));

        if (walletTop) {
          walletTop.innerHTML =
            '<div style="background:rgba(253,224,71,0.12);border:1px solid rgba(253,224,71,0.4);border-radius:10px;padding:6px 10px;font-size:11px;font-weight:900;">' +
              '<div style="display:flex;justify-content:space-between;"><span style="color:#fde047;">🪙 MVP: ' + myEcon.mvp + ' Pts</span><span style="color:#38bdf8;">🔥 Streak: ' + myEcon.streak + '/10d</span><span style="color:#4ade80;">🔗 Refs: ' + myRefCount + '/5</span></div>' +
              '<div style="width:100%;height:5px;background:#090d16;border-radius:5px;margin-top:4px;overflow:hidden;"><div style="width:' + pct + '%;height:100%;background:linear-gradient(90deg,#f59e0b,#10b981);"></div></div>' +
              '<button onclick="copyAvatarRefLink()" style="margin-top:5px;padding:3px 10px;border:none;border-radius:8px;background:#10b981;color:#fff;font-size:10px;font-weight:900;cursor:pointer;">🔗 Copy Invite Link</button>' +
            '</div>';
        }

        grid.innerHTML = '';
        V14_ITEMS.forEach(av => {
          const ok = av.req === 'free' || (av.req === 'code' && codeUnlocked.includes(av.id)) ||
                     (av.req === 'streak' && (myEcon.streak >= av.reqDays || myEcon.unlocked.includes(av.id))) ||
                     (av.req === 'shop' && myEcon.unlocked.includes(av.id)) ||
                     (av.req === 'ref' && myRefCount >= av.reqRefs);

          let statusTxt = ok ? '✅ Tap to Equip' : (av.req === 'streak' ? ('🔒 Day ' + myEcon.streak + '/10') : (av.req === 'shop' ? ('🪙 Buy (' + av.cost + ' Pts)') : (av.req === 'ref' ? ('🔒 ' + av.reqRefs + ' Refs') : '🔒 Secret Code')));
          const d = document.createElement('div');
          d.className = 'st-item' + (ok ? '' : ' locked');
          if (av.featured) d.style.cssText = 'grid-column:1/-1;border:2px solid #fde047;background:rgba(250,204,21,0.16);';
          d.innerHTML = '<div class="st-art ' + av.ring + '"><img src="' + av.img + '" loading="lazy"><span class="v14-pin">' + av.pin + '</span></div><div style="font-weight:900;font-size:10px;">' + av.name + '</div><div style="font-size:9px;color:' + (ok ? '#4ade80' : '#fbbf24') + ';">' + statusTxt + '</div>';

          d.onclick = () => {
            if (!ok) {
              if (av.req === 'shop') socket.emit('buyV14ShopItem', { username: getMe(), itemType: 'avatar', itemId: av.id, cost: av.cost, label: av.name });
              else if (av.req === 'ref') copyAvatarRefLink();
              else if (av.req === 'streak') alert('🔥 Come back for ' + (10 - myEcon.streak) + ' more day(s) to unlock!');
              else alert('🔒 Enter secret code below to unlock!');
              return;
            }
            const me = getMe();
            v14Players[me] = av;
            if (av.id === 'superhost') document.getElementById('opCreatorDock').style.display = 'flex';
            if (typeof socket !== 'undefined') socket.emit('equipAvatarFxV6', { username: me, avatarId: av.id, fx: av.ring, badge: myEcon.customTitle || av.name });
            document.getElementById('stVaultModal').style.display = 'none';
          };
          grid.appendChild(d);
        });

        const titleRow = document.createElement('div');
        titleRow.style.cssText = 'grid-column:1/-1;background:rgba(168,85,247,0.15);border:1px solid #c084fc;border-radius:10px;padding:6px;margin-top:4px;';
        titleRow.innerHTML = '<div style="font-size:10px;font-weight:900;color:#e879f9;margin-bottom:4px;">🏷️ BUY CHAT TITLES</div>' +
          SHOP_TITLES.map(t => '<button onclick="buyShopTitle(' + t.cost + ',\\'' + t.label + '\\')" style="margin:2px;background:#1e1b4b;border:1px solid #fde047;color:#fff;font-size:10px;font-weight:bold;padding:3px 7px;border-radius:7px;cursor:pointer;">' + t.label + ' (🪙' + t.cost + ')</button>').join('');
        grid.appendChild(titleRow);
      };
         // === V14 COMPLETE ARMORY & ECONOMY - PIECE 8A ===
      function renderV14Chat() {
        const nodes = document.querySelectorAll('#chatBox b, #chatBox strong, #messages b, #messages strong');
        nodes.forEach(el => {
          if (el.closest('#stVaultModal') || el.closest('#stZoomModal')) return;
          const raw = (el.textContent || '').trim();
          const sender = raw.replace(/\s*(cap\s*[ab]|👑|creator)\s*/gi, '').trim().toLowerCase();
          const av = v14Players[sender];
          if (!av) return;

          const row = el.parentElement;
          if (!row) return;
          if (!row.querySelector('.v14-title-pill')) {
            const pill = document.createElement('span');
            pill.className = 'v14-title-pill';
            pill.textContent = av.badge || av.name;
            el.insertAdjacentElement('afterend', pill);
          }

          const chatCls = ringToChat[av.ring];
          const msgBubble = (row.nextElementSibling && !row.nextElementSibling.querySelector('input, button')) ? row.nextElementSibling : row.closest('div');
          if (msgBubble && chatCls && !msgBubble.dataset.v14Glow) {
            msgBubble.dataset.v14Glow = chatCls;
            msgBubble.classList.add(chatCls);
            msgBubble.style.padding = msgBubble.style.padding || '6px 10px';
          }

          if (row.dataset.v14Stamp === av.id) return;
          const iconSpan = Array.from(row.children).find(c => c !== el && !c.classList.contains('v14-title-pill') && !c.querySelector('button') && ((c.textContent || '').trim().length <= 4 || c.querySelector('.v14-bubble')));
          if (iconSpan) {
            row.dataset.v14Stamp = av.id;
            iconSpan.innerHTML = '<span class="v14-bubble ' + av.ring + '" data-user="' + raw.replace(/"/g,'') + '" data-sender="' + sender + '"><img src="' + av.img + '"><span class="v14-pin">' + av.pin + '</span></span>';
          }
        });
      }

      document.addEventListener('click', (e) => {
        const b = e.target.closest('.v14-bubble');
        if (b) {
          e.preventDefault(); e.stopPropagation();
          const s = b.getAttribute('data-sender') || '';
          const av = v14Players[s]; if (!av) return;
          const ring = document.getElementById('stZoomRing');
          ring.className = av.ring;
          ring.innerHTML = '<img src="' + av.img + '">';
          document.getElementById('stZoomUser').textContent = b.getAttribute('data-user') || s;
          document.getElementById('stZoomTitle').textContent = av.badge || av.name;
          document.getElementById('stZoomModal').style.display = 'flex';
          return;
        }
        const btn = e.target.closest('button, a, div[onclick]');
        if (btn && (btn.id === 'openAvatarVaultBtn' || /avatars/i.test((btn.textContent || '').trim()))) {
          if (btn.closest('#stVaultModal')) return;
          e.preventDefault(); e.stopPropagation();
          window.stDrawVault();
          document.getElementById('stVaultModal').style.display = 'flex';
        }
      }, true);
       // === V14 COMPLETE ARMORY & ECONOMY - PIECE 8B ===
      setInterval(() => {
        if (!document.getElementById('openAvatarVaultBtn')) {
          const anchor = document.getElementById('openPhonkDjBtn') || document.getElementById('openChefBtn') || Array.from(document.querySelectorAll('button, a, div[onclick]')).find(el => el.children.length === 0 && /jam|🎹|phonk/i.test(el.textContent || ''));
          if (anchor && anchor.parentNode) { const btn = anchor.cloneNode(true); btn.id = 'openAvatarVaultBtn'; btn.removeAttribute('onclick'); btn.textContent = '👑 Avatars'; anchor.parentNode.insertBefore(btn, anchor.nextSibling); }
        }
        if (typeof socket !== 'undefined' && !window._v14Bound) {
          window._v14Bound = true;
          const devId = localStorage.getItem('sammu_dev_uid') || ('dev_' + Math.random().toString(36).slice(2));
          const pending = localStorage.getItem('sammu_pending_avref');
          if (pending) { socket.emit('registerAvatarRef', { refUser: pending, deviceId: devId }); localStorage.removeItem('sammu_pending_avref'); }
          const me = getMe();
          if (me) { socket.emit('getMyAvatarRefCount', me); socket.emit('getV14Econ', me); }
          socket.emit('getMyAvatarStatsV6');

          socket.on('avatarRefCountUpdate', (d) => { if (d && d.username === getMe()) { myRefCount = d.count || 0; localStorage.setItem('sammu_my_avref_count', String(myRefCount)); } });
          socket.on('v14EconSync', (r) => { if (r) { myEcon = r; if (document.getElementById('stVaultModal')?.style.display === 'flex') window.stDrawVault(); } });
          socket.on('v14ShopResult', (res) => { if (res && res.msg) alert(res.msg); if (res && res.ok && document.getElementById('stVaultModal')?.style.display === 'flex') window.stDrawVault(); });
          socket.on('updateMVP', (data) => { const cur = getMe(); if (cur && data && Array.isArray(data.board)) { const f = data.board.find(x => x.name && x.name.toLowerCase() === cur); if (f && f.pts > myEcon.mvp) socket.emit('syncEarnedMvp', { username: cur, pts: f.pts }); } });
          socket.on('avatarCodeResultV6', (res) => {
            if (res && res.ok && res.avatarId) {
              const u = JSON.parse(localStorage.getItem('sammu_unlocked_avatars') || '[]');
              if (!u.includes(res.avatarId)) { u.push(res.avatarId); localStorage.setItem('sammu_unlocked_avatars', JSON.stringify(u)); }
              if (res.avatarId === 'superhost') document.getElementById('opCreatorDock').style.display = 'flex';
              alert('🎉 Unlocked: ' + res.name + '!'); window.stDrawVault();
            } else alert('❌ Invalid Secret Code!');
          });
          socket.on('avatarStatsDataV6', (d) => {
            if (d && d.avatarMap) { Object.entries(d.avatarMap).forEach(([u, info]) => { const f = V14_ITEMS.find(x => x.id === info.avatarId); if (f) v14Players[u] = { ...f, ring: info.fx || f.ring, badge: info.badge || f.name }; }); renderV14Chat(); }
          });
          socket.on('v14BossArrival', (d) => {
            if (!d || (d._serverId && d._serverId !== window.selectedServerId)) return;
            const s = document.getElementById('v14BossSlash');
            document.getElementById('v14BossName').textContent = d.player.toUpperCase();
            document.getElementById('v14BossTitle').textContent = d.title;
            s.style.display = 'none'; void s.offsetWidth; s.style.display = 'block';
            setTimeout(() => { s.style.display = 'none'; }, 3100);
          });
          socket.on('triggerCreatorFx', (fx) => {
            if (fx._serverId && fx._serverId !== window.selectedServerId) return;
            if (fx.type === 'shake') { document.body.style.transform = 'translateX(-6px)'; setTimeout(() => document.body.style.transform = 'translateX(6px)', 80); setTimeout(() => document.body.style.transform = '', 160); }
            else if (fx.type === 'banner') { const b = document.getElementById('opGiantBanner'); document.getElementById('opBannerText').textContent = fx.text; b.style.display = 'block'; setTimeout(() => { b.style.display = 'none'; }, 4500); }
            else if (fx.type === 'confetti') { const box = document.createElement('div'); box.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999999;display:flex;justify-content:space-around;font-size:28px;padding-top:25px;'; box.innerHTML = '<span>🎉</span><span>💎</span><span>👑</span><span>🔥</span><span>✨</span>'; document.body.appendChild(box); setTimeout(() => box.remove(), 2000); }
          });
        }
        renderV14Chat();
      }, 900);
    })();
    </script>
    `;
                                             });
    // === V14 COMPLETE ARMORY & ECONOMY - PIECE 9 (MOBILE ANTI-LAG BOOSTER) ===
    const V14_MOBILE_ANTILAG = `
    <style>
      @media (max-width: 768px) {
        * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
      }
    </style>
    <script>
    (function() {
      document.addEventListener('error', function(e) {
        const el = e.target;
        if (el && el.tagName === 'IMG' && (el.closest('.v14-bubble') || el.closest('.st-art') || el.closest('#stZoomRing')) && !el.dataset.fbDone) {
          el.dataset.fbDone = '1';
          el.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(
            '<svg xmlns="http://w3.org" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#1e1b4b"/><text x="50" y="64" font-size="44" font-family="sans-serif" font-weight="900" fill="#fde047" text-anchor="middle">★</text></svg>'
          );
        }
      }, true);

      setInterval(() => {
        if (document.hidden) return;
        const box = document.getElementById('chatBox') || document.getElementById('messages');
        if (box) {
          while (box.children.length > 45) box.removeChild(box.firstElementChild);
        }
      }, 2500);
    })();
    </script>
    `;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>')) {
                body = body.replace('</body>', V14_CLIENT_BUNDLE + '\n' + V14_MOBILE_ANTILAG + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // === END V14 COMPLETE ARMORY & ECONOMY ===
};
          

            



