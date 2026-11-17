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
        srv_Zaira:  { id: 'srv_zaira',  name: "🪐 zaira's Orbit",    owner: "zaira",  theme: "cyber",   max: 20, type: "official" },
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
        "sarah", "advait", "ruwii", "Zaira", "shubhi", "sid"
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
    // === END PHONK DJ v4 ===
      // === STUDIO ILLUSTRATED AVATARS + RAINBOW HOST AURA ===
    const STUDIO_AVATAR_OVERRIDE = `
    <style id="studioAvCss">
      #v7FloatingAvatarBtn, #avatarVaultModal, #avatarVaultModalV6, #v8VaultModal,
      #v9Modal, #v10Modal, #v11Modal, #v12Modal, #v14Modal, #v15Modal, #v16Modal, #v17Modal, #v20Modal, #v22Modal, #v22ZoomModal {
        display: none !important;
      }

      @keyframes stRainbowPrism {
        0%   { border-color: #ff0055 !important; box-shadow: 0 0 10px #ffffff, 0 0 18px #ff0055 !important; }
        25%  { border-color: #fde047 !important; box-shadow: 0 0 12px #ffffff, 0 0 20px #fde047 !important; }
        50%  { border-color: #00f0ff !important; box-shadow: 0 0 12px #ffffff, 0 0 20px #00f0ff !important; }
        75%  { border-color: #c084fc !important; box-shadow: 0 0 10px #ffffff, 0 0 18px #c084fc !important; }
        100% { border-color: #ff0055 !important; box-shadow: 0 0 10px #ffffff, 0 0 18px #ff0055 !important; }
      }

      @keyframes stRainbowChat {
        0%   { border-color: #ff0055 !important; box-shadow: 0 0 12px rgba(255,0,85,0.75) !important; }
        33%  { border-color: #fde047 !important; box-shadow: 0 0 14px rgba(253,224,71,0.75) !important; }
        66%  { border-color: #00f0ff !important; box-shadow: 0 0 14px rgba(0,240,255,0.75) !important; }
        100% { border-color: #ff0055 !important; box-shadow: 0 0 12px rgba(255,0,85,0.75) !important; }
      }

      @keyframes stMillyGlitter {
        0%, 100% { border-color: #ffffff !important; box-shadow: 0 0 12px #ffffff, 0 0 22px #f472b6 !important; }
        50%      { border-color: #ffe4e6 !important; box-shadow: 0 0 16px #ffffff, 0 0 28px #e879f9 !important; }
      }

      @keyframes stChakraSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes stFeatherSway { 0%, 100% { transform: rotate(20deg); } 50% { transform: rotate(28deg); } }
      @keyframes stTwinkle { 0%, 100% { opacity: 0.3; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.2); } }

      .st-spin-chakra { transform-origin: 50px 44px; animation: stChakraSpin 14s linear infinite; will-change: transform; }
      .st-sway-feather { transform-origin: 62px 27px; animation: stFeatherSway 2.8s ease-in-out infinite; will-change: transform; }
      .st-sparkle { transform-box: fill-box; transform-origin: center; animation: stTwinkle 1.8s ease-in-out infinite; }
      body .st-aura-samaksh, div.st-aura-samaksh, span.st-aura-samaksh {
        border: 2.5px solid #ffffff !important; animation: stRainbowPrism 2.2s linear infinite !important;
      }
      body .st-chat-rainbow, div.st-chat-rainbow, p.st-chat-rainbow, span.st-chat-rainbow {
        background: linear-gradient(135deg, rgba(255,0,85,0.32), rgba(253,224,71,0.26), rgba(0,240,255,0.32), rgba(168,85,247,0.32)) !important;
        border: 2px solid #ffffff !important; border-radius: 14px !important;
        animation: stRainbowChat 2.4s linear infinite !important; color: #ffffff !important;
        font-weight: 800 !important; text-shadow: 0 1px 4px #000000 !important;
      }
      .st-chat-rainbow * { color: #ffffff !important; }

      body .st-aura-empress, div.st-aura-empress, span.st-aura-empress {
        border: 2.5px solid #ffffff !important; animation: stMillyGlitter 1.8s ease-in-out infinite !important;
      }
      body .st-chat-milly, div.st-chat-milly {
        background: linear-gradient(135deg, rgba(255,255,255,0.22), rgba(244,114,182,0.28), rgba(232,121,249,0.22)) !important;
        border: 2px solid #ffffff !important; border-radius: 14px !important;
        animation: stMillyGlitter 1.8s ease-in-out infinite !important; color: #ffffff !important; font-weight: 700 !important;
      }

      .st-aura-sid     { border: 2px solid #38bdf8 !important; box-shadow: 0 0 10px #38bdf8 !important; }
      .st-aura-shubhi  { border: 2px solid #f472b6 !important; box-shadow: 0 0 10px #f472b6 !important; }
      .st-aura-ice     { border: 2px solid #38bdf8 !important; box-shadow: 0 0 10px #38bdf8 !important; }
      .st-aura-fire    { border: 2px solid #f97316 !important; box-shadow: 0 0 10px #f97316 !important; }
      .st-aura-crimson { border: 2px solid #ef4444 !important; box-shadow: 0 0 10px #ef4444 !important; }
      .st-aura-toxic   { border: 2px solid #4ade80 !important; box-shadow: 0 0 10px #4ade80 !important; }
      .st-aura-pink    { border: 2px solid #f472b6 !important; box-shadow: 0 0 10px #f472b6 !important; }
      .st-aura-violet  { border: 2px solid #a855f7 !important; box-shadow: 0 0 10px #a855f7 !important; }
      .st-aura-emerald { border: 2px solid #10b981 !important; box-shadow: 0 0 10px #10b981 !important; }
      .st-aura-gold    { border: 2px solid #facc15 !important; box-shadow: 0 0 10px #facc15 !important; }
      .st-aura-disco   { border: 2px solid #ff0080 !important; box-shadow: 0 0 10px #00f0ff !important; }

      .st-live-bubble {
        display: inline-flex !important; align-items: center !important; justify-content: center !important;
        width: 35px !important; height: 35px !important; border-radius: 50% !important;
        overflow: hidden !important; vertical-align: middle !important; margin-right: 6px !important;
        flex-shrink: 0 !important; cursor: pointer !important; background: #090d16 !important;
      }
      .st-live-bubble svg { width: 100% !important; height: 100% !important; display: block !important; }

      #stVaultModal, #stZoomModal {
        display: none; position: fixed; inset: 0; background: rgba(5,8,20,0.94);
        z-index: 999999999; align-items: center; justify-content: center; padding: 12px;
      }
      #stVaultCard, #stZoomCard {
        background: linear-gradient(155deg,#0f172a,#1e1b4b); border: 2px solid #38bdf8;
        border-radius: 20px; padding: 14px; width: 100%; max-width: 415px;
        color: #fff; text-align: center; max-height: 88vh; overflow-y: auto;
        -webkit-overflow-scrolling: touch;
      }
      #stZoomCard {
        max-width: 300px; padding: 20px; transition: transform 0.12s ease-out;
        transform-style: preserve-3d; touch-action: none;
      }
      .st-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0; }
      .st-item { background: rgba(255,255,255,0.08); border: 1.5px solid rgba(56,189,248,0.4); border-radius: 14px; padding: 8px 4px; cursor: pointer; }
      .st-item.locked { opacity: 0.65; border-color: #64748b; }
      .st-art { width: 62px; height: 62px; margin: 0 auto 5px auto; border-radius: 50%; overflow: hidden; background: #020617; display: flex; align-items: center; justify-content: center; }
      .st-art svg { width: 100%; height: 100%; display: block; }
      #stZoomRing { width: 146px; height: 146px; margin: 12px auto; border-radius: 50%; overflow: hidden; background: #020617; display: flex; align-items: center; justify-content: center; }
      #stZoomRing svg { width: 100%; height: 100%; display: block; }
    </style>

    <div id="stVaultModal" onclick="if(event.target===this)this.style.display='none'">
      <div id="stVaultCard">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <span style="font-weight:900;font-size:15px;color:#38bdf8;">✨ ILLUSTRATED AVATAR VAULT</span>
          <button onclick="document.getElementById('stVaultModal').style.display='none'" style="width:36px!important;min-width:36px!important;height:32px!important;padding:0!important;background:#ef4444;border:none;color:#fff;border-radius:8px;font-weight:900;cursor:pointer;">✕</button>
        </div>
        <div id="stRefText" style="font-size:11px;color:#fde047;margin:6px 0;font-weight:bold;">🔗 Referrals: 0 | Tap Any Player's Avatar Bubble to Zoom!</div>
        <div class="st-grid" id="stGrid"></div>
        <div style="display:flex;gap:6px;margin-top:8px;">
          <input id="stCodeInput" placeholder="Enter Host Avatar Code..." style="flex:1;padding:8px;border-radius:10px;border:1.5px solid #c084fc;background:#090d16;color:#fff;font-size:12px;">
          <button onclick="stRedeemCode()" style="width:auto!important;padding:8px 12px!important;background:linear-gradient(90deg,#a855f7,#ec4899);border:none;color:#fff;border-radius:10px;font-weight:bold;font-size:12px;cursor:pointer;">🔓 Unlock</button>
        </div>
        <button onclick="stCopyRef()" style="width:100%!important;margin-top:8px;padding:9px;border:none;border-radius:10px;background:linear-gradient(90deg,#059669,#10b981);color:#fff;font-weight:900;font-size:12px;cursor:pointer;">🔗 Copy My Referral Link</button>
      </div>
    </div>

    <div id="stZoomModal" onclick="this.style.display='none'">
      <div id="stZoomCard" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:900;font-size:13px;color:#7dd3fc;">🔍 3D HOLO CARD (Drag to Tilt!)</span>
          <button onclick="document.getElementById('stZoomModal').style.display='none'" style="width:32px!important;min-width:32px!important;height:28px!important;padding:0!important;background:#ef4444;border:none;color:#fff;border-radius:8px;font-weight:900;cursor:pointer;">✕</button>
        </div>
        <div id="stZoomRing"></div>
        <div id="stZoomUser" style="font-size:18px;font-weight:900;color:#fff;margin-top:4px;">Player</div>
        <div id="stZoomTitle" style="font-size:12px;color:#fde047;margin-top:3px;font-weight:bold;">Illustrated Character</div>
        <button id="stHypeBtn" style="width:100%!important;margin-top:11px;padding:9px;border:none;border-radius:12px;background:linear-gradient(90deg,#f59e0b,#ec4899);color:#fff;font-weight:900;font-size:13px;cursor:pointer;">🔥 Hype Avatar in Chat!</button>
      </div>
    </div>
    <script>
    (function() {
      const KSHATRIYA_ST_SVG = '<svg xmlns="http://w3.org" viewBox="0 0 100 100">' +
        '<defs>' +
          '<radialGradient id="kkBgSt" cx="50%" cy="35%" r="72%"><stop offset="0%" stop-color="#f59e0b"/><stop offset="42%" stop-color="#1e3a8a"/><stop offset="100%" stop-color="#040712"/></radialGradient>' +
          '<radialGradient id="kkSkinSt" cx="42%" cy="32%" r="68%"><stop offset="0%" stop-color="#bae6fd"/><stop offset="50%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#1e40af"/></radialGradient>' +
          '<linearGradient id="kkGoldSt" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fef9c3"/><stop offset="30%" stop-color="#facc15"/><stop offset="68%" stop-color="#d97706"/><stop offset="100%" stop-color="#78350f"/></linearGradient>' +
          '<linearGradient id="kkHairSt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#334155"/><stop offset="45%" stop-color="#0f172a"/><stop offset="100%" stop-color="#020617"/></linearGradient>' +
        '</defs>' +
        '<circle cx="50" cy="50" r="49" fill="url(#kkBgSt)"/>' +
        '<g class="st-spin-chakra">' +
          '<circle cx="50" cy="44" r="37" fill="rgba(253,224,71,0.10)" stroke="#fde047" stroke-width="1.8" stroke-dasharray="5 3"/>' +
          '<circle cx="50" cy="44" r="30" fill="none" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="3 4"/>' +
          '<polygon points="50,5 52,10 48,10" fill="#fde047"/><polygon points="50,83 52,78 48,78" fill="#fde047"/>' +
          '<polygon points="11,44 16,42 16,46" fill="#fde047"/><polygon points="89,44 84,42 84,46" fill="#fde047"/>' +
        '</g>' +
        '<path d="M15,19 Q6,50 15,81" fill="none" stroke="url(#kkGoldSt)" stroke-width="3.2" stroke-linecap="round"/>' +
        '<line x1="15" y1="19" x2="15" y2="81" stroke="#ffffff" stroke-width="0.9" opacity="0.85"/>' +
        '<line x1="85" y1="17" x2="66" y2="76" stroke="url(#kkGoldSt)" stroke-width="3.2" stroke-linecap="round"/>' +
        '<polygon points="86,14 77,21 86,24" fill="#ffffff"/>' +
        '<path d="M24,42 C18,62 22,76 29,84 L71,84 C78,76 82,62 76,42 Z" fill="url(#kkHairSt)"/>' +
        '<path d="M15,98 C18,74 33,67 50,67 C67,67 82,74 85,98 Z" fill="url(#kkGoldSt)" stroke="#ffffff" stroke-width="1.4"/>' +
        '<path d="M14,84 Q23,70 34,76 L28,92 Z" fill="url(#kkGoldSt)" stroke="#fef08a" stroke-width="1.2"/>' +
        '<path d="M86,84 Q77,70 66,76 L72,92 Z" fill="url(#kkGoldSt)" stroke="#fef08a" stroke-width="1.2"/>' +
        '<path d="M25,73 L50,91 L75,73" fill="none" stroke="#dc2626" stroke-width="4" stroke-linecap="round"/>' +
        '<path d="M28,75 L50,93 L72,75" fill="none" stroke="#fef08a" stroke-width="1.4" stroke-dasharray="2 3"/>' +
        '<polygon points="50,71 56,78.5 50,86 44,78.5" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5"/>' +
        '<path d="M44,59 L44,69 Q50,72 56,69 L56,59 Z" fill="#1d4ed8"/>' +
        '<path d="M33,31 C33,24 67,24 67,31 L66,48 C65,58 56,65 50,66.5 C44,65 35,58 34,48 Z" fill="url(#kkSkinSt)" stroke="#bae6fd" stroke-width="1.3"/>' +
        '<path d="M49.5,49 L48.5,54.5 L50.8,55" fill="none" stroke="#1e3a8a" stroke-width="1.2" stroke-linecap="round"/>' +
        '<circle cx="31.5" cy="52" r="3.2" fill="url(#kkGoldSt)" stroke="#fff" stroke-width="0.8"/><circle cx="68.5" cy="52" r="3.2" fill="url(#kkGoldSt)" stroke="#fff" stroke-width="0.8"/>' +
        '<path d="M29,40 L33,24 L41,32 L50,21 L59,32 L67,24 L71,40 C65,33 56,34 50,38 C44,34 35,33 29,40 Z" fill="url(#kkHairSt)"/>' +
        '<path d="M36,28 Q50,22 64,28" fill="none" stroke="#60a5fa" stroke-width="1.4" opacity="0.85"/>' +
        '<rect x="31" y="30.5" width="38" height="5.5" rx="2.7" fill="#dc2626" stroke="url(#kkGoldSt)" stroke-width="1.5"/>' +
        '<circle cx="50" cy="33.2" r="2.2" fill="#fde047"/>' +
        '<g class="st-sway-feather">' +
          '<ellipse cx="64" cy="15" rx="6.2" ry="9" fill="#10b981" stroke="#fde047" stroke-width="1.5"/>' +
          '<ellipse cx="64" cy="15" rx="3.4" ry="4.8" fill="#1d4ed8"/>' +
          '<circle cx="64" cy="15" r="1.7" fill="#fef08a"/>' +
        '</g>' +
        '<path d="M47.8,37 L47.8,43.5 Q50,45.5 52.2,43.5 L52.2,37" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>' +
        '<line x1="50" y1="38" x2="50" y2="43.5" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M35.5,45.5 L44.5,47.5 M64.5,45.5 L55.5,47.5" stroke="#020617" stroke-width="2" stroke-linecap="round"/>' +
        '<ellipse cx="41" cy="50.5" rx="3.9" ry="2.8" fill="#ffffff"/>' +
        '<circle cx="41" cy="50.5" r="2.1" fill="#0284c7"/><circle cx="41" cy="50.5" r="1" fill="#090d16"/>' +
        '<circle cx="42" cy="49.5" r="0.9" fill="#ffffff"/>' +
        '<ellipse cx="59" cy="50.5" rx="3.9" ry="2.8" fill="#ffffff"/>' +
        '<circle cx="59" cy="50.5" r="2.1" fill="#0284c7"/><circle cx="59" cy="50.5" r="1" fill="#090d16"/>' +
        '<circle cx="60" cy="49.5" r="0.9" fill="#ffffff"/>' +
        '<path d="M44.5,58.5 Q50,62 56,57.5" stroke="#1e3a8a" stroke-width="2.1" fill="none" stroke-linecap="round"/>' +
        '<polygon class="st-sparkle" points="14,15 16,19 20,21 16,23 14,27 12,23 8,21 12,19" fill="#ffffff"/>' +
        '<polygon class="st-sparkle" points="86,15 88,19 92,21 88,23 86,27 84,23 80,21 84,19" fill="#bae6fd"/>' +
      '</svg>';
                                                    
      let svgCounter = 0;
      function makeStudioPortrait(opts) {
        svgCounter++;
        const bg1 = opts.bg1 || '#1e1b4b';
        const bg2 = opts.bg2 || '#060914';
        const skinLight = opts.skinLight || '#fff1eb';
        const skinMid = opts.skin || '#fcd3b2';
        const skinDark = opts.skinDark || '#d49470';
        const hairLight = opts.hairLight || '#94a3b8';
        const hair = opts.hair || '#1e293b';
        const outfitLight = opts.outfitLight || '#60a5fa';
        const outfit = opts.outfit || '#1d4ed8';
        const accent = opts.accent || '#fde047';
        const eye = opts.eye || '#38bdf8';
        const isGirl = opts.gender === 'girl';
        const id = 'stArt_' + svgCounter;

        let backLayer = '<circle cx="50" cy="47" r="38" fill="none" stroke="' + eye + '" stroke-width="1.2" opacity="0.35" stroke-dasharray="6 4"/>';
        if (opts.backProp === 'swords') {
          backLayer += '<line x1="18" y1="20" x2="82" y2="82" stroke="#e2e8f0" stroke-width="4" stroke-linecap="round"/>' +
                       '<line x1="82" y1="20" x2="18" y2="82" stroke="#4ade80" stroke-width="4" stroke-linecap="round"/>' +
                       '<line x1="50" y1="12" x2="50" y2="88" stroke="#fde047" stroke-width="3.5" stroke-linecap="round"/>';
        } else if (opts.backProp === 'lightning') {
          backLayer += '<polyline points="18,22 26,38 16,44 25,62" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>' +
                       '<polyline points="82,22 74,38 84,44 75,62" fill="none" stroke="#fde047" stroke-width="2.5" stroke-linecap="round"/>';
        } else if (opts.backProp === 'wings') {
          backLayer += '<path d="M12,48 Q22,24 38,44 Q24,58 12,48 Z M88,48 Q78,24 62,44 Q76,58 88,48 Z" fill="' + eye + '" opacity="0.65" stroke="#fff" stroke-width="1.2"/>';
        }

        let hairBack = '';
        let hairFront = '';
        if (isGirl) {
          hairBack = '<path d="M16,44 C11,72 15,93 24,99 L76,99 C85,93 89,72 84,44 C84,18 16,18 16,44 Z" fill="url(#' + id + '_h)"/>';
          hairFront = '<path d="M26,46 C26,21 74,21 74,46 C67,33 56,33 50,42 C44,33 33,33 26,46 Z" fill="url(#' + id + '_h)"/>' +
                      '<path d="M26,43 Q22,68 29,86 L34,86 Q29,63 31,45 Z" fill="url(#' + id + '_h)"/>' +
                      '<path d="M74,43 Q78,68 71,86 L66,86 Q71,63 69,45 Z" fill="url(#' + id + '_h)"/>' +
                      '<path d="M33,30 Q50,23 67,30" fill="none" stroke="#ffffff" stroke-width="2.2" opacity="0.5" stroke-linecap="round"/>';
        } else if (opts.spiky) {
          hairFront = '<polygon points="24,45 19,24 34,30 41,13 50,26 59,13 66,30 81,24 76,45 63,35 50,40 37,35" fill="url(#' + id + '_h)"/>' +
                      '<polyline points="34,28 41,17 50,28 59,17 66,28" fill="none" stroke="#ffffff" stroke-width="1.4" opacity="0.5"/>';
        } else {
          hairFront = '<path d="M26,45 C24,20 76,20 74,45 C65,30 35,30 26,45 Z" fill="url(#' + id + '_h)"/>' +
                      '<path d="M34,27 Q50,21 66,27" fill="none" stroke="#ffffff" stroke-width="1.8" opacity="0.45" stroke-linecap="round"/>';
        }

        let acc = '';
        if (opts.acc === 'thunderVisor') {
          acc = '<rect x="30" y="44" width="40" height="10.5" rx="5" fill="#0ea5e9" stroke="#fde047" stroke-width="1.6"/>' +
                '<line x1="34" y1="47" x2="64" y2="47" stroke="#ffffff" stroke-width="1.5" opacity="0.8"/>' +
                '<polygon points="48,9 56,21 49,21 54,30 43,19 50,19" fill="#fde047" stroke="#fff" stroke-width="0.9"/>';
        } else if (opts.acc === 'tiara') {
          acc = '<polygon points="31,26 37,12 44,21 50,8 56,21 63,12 69,26" fill="#fde047" stroke="#ffffff" stroke-width="1.5"/>' +
                '<polygon points="50,14 53,19 50,24 47,19" fill="#f43f5e" stroke="#fff" stroke-width="0.8"/>' +
                '<circle cx="39" cy="21" r="2" fill="#38bdf8"/><circle cx="61" cy="21" r="2" fill="#38bdf8"/>';
        } else if (opts.acc === 'visor') {
          acc = '<rect x="30" y="45" width="40" height="10.5" rx="5" fill="' + eye + '" opacity="0.9" stroke="#ffffff" stroke-width="1.5"/>' +
                '<line x1="35" y1="48" x2="62" y2="48" stroke="#ffffff" stroke-width="1.6" opacity="0.85"/>';
        } else if (opts.acc === 'catEars') {
          acc = '<polygon points="25,32 30,10 44,26" fill="url(#' + id + '_h)" stroke="' + eye + '" stroke-width="1.6"/>' +
                '<polygon points="75,32 70,10 56,26" fill="url(#' + id + '_h)" stroke="' + eye + '" stroke-width="1.6"/>';
        } else if (opts.acc === 'halo') {
          acc = '<ellipse cx="50" cy="12" rx="20" ry="5" fill="none" stroke="#fde047" stroke-width="3"/>' +
                '<ellipse cx="50" cy="12" rx="20" ry="5" fill="none" stroke="#ffffff" stroke-width="1.1" opacity="0.85"/>';
        } else if (opts.acc === 'bandana') {
          acc = '<rect x="28" y="33.5" width="44" height="7.5" rx="3.5" fill="' + eye + '" stroke="#fff" stroke-width="1.1"/>' +
                '<path d="M72,36 L87,28 L82,41 Z" fill="' + eye + '"/>';
        } else if (opts.acc === 'horns') {
          acc = '<path d="M30,28 Q19,11 34,9 Q36,21 38,26 Z M70,28 Q81,11 66,9 Q64,21 62,26 Z" fill="#ef4444" stroke="#fde047" stroke-width="1.3"/>';
        } else if (opts.acc === 'flowerPin') {
          acc = '<circle cx="68" cy="30" r="6.5" fill="#fb7185" stroke="#ffffff" stroke-width="1.5"/><circle cx="68" cy="30" r="2.5" fill="#fde047"/>';
        }
        const faceShape = isGirl
          ? '<path d="M33,31 C33,24 67,24 67,31 L66,49 C65,59 56,65.5 50,66.5 C44,65.5 35,59 34,49 Z" fill="url(#' + id + '_s)"/>'
          : '<path d="M32,31 C32,24 68,24 68,31 L67,48 C66,58 57,65 50,66.8 C43,65 34,58 33,48 Z" fill="url(#' + id + '_s)"/>';

        const eyesAndFace = isGirl
          ? '<path d="M34.5,47.5 L38.5,45 M65.5,47.5 L61.5,45" stroke="#1e1b4b" stroke-width="2.2" stroke-linecap="round"/>' +
            '<ellipse cx="41" cy="50.5" rx="4.1" ry="4.3" fill="#ffffff"/>' +
            '<circle cx="41" cy="50.8" r="2.9" fill="' + eye + '"/><circle cx="41" cy="50.8" r="1.4" fill="#090d16"/>' +
            '<circle cx="42.2" cy="49.2" r="1.3" fill="#ffffff"/>' +
            '<ellipse cx="59" cy="50.5" rx="4.1" ry="4.3" fill="#ffffff"/>' +
            '<circle cx="59" cy="50.8" r="2.9" fill="' + eye + '"/><circle cx="59" cy="50.8" r="1.4" fill="#090d16"/>' +
            '<circle cx="60.2" cy="49.2" r="1.3" fill="#ffffff"/>' +
            '<circle cx="50" cy="54.8" r="0.9" fill="' + skinDark + '"/>' +
            '<ellipse cx="35.5" cy="56" rx="3.6" ry="1.8" fill="#fb7185" opacity="0.6"/><ellipse cx="64.5" cy="56" rx="3.6" ry="1.8" fill="#fb7185" opacity="0.6"/>' +
            '<path d="M45,60 Q50,64 55,60" stroke="#e11d48" stroke-width="2.1" fill="none" stroke-linecap="round"/>'
          : '<path d="M35.5,46 L44,47.5 M64.5,46 L56,47.5" stroke="#090d16" stroke-width="1.9" stroke-linecap="round"/>' +
            '<ellipse cx="41" cy="50.5" rx="3.9" ry="3.3" fill="#ffffff"/>' +
            '<circle cx="41" cy="50.5" r="2.3" fill="' + eye + '"/><circle cx="41" cy="50.5" r="1.1" fill="#090d16"/>' +
            '<circle cx="42" cy="49.3" r="1" fill="#ffffff"/>' +
            '<ellipse cx="59" cy="50.5" rx="3.9" ry="3.3" fill="#ffffff"/>' +
            '<circle cx="59" cy="50.5" r="2.3" fill="' + eye + '"/><circle cx="59" cy="50.5" r="1.1" fill="#090d16"/>' +
            '<circle cx="60" cy="49.3" r="1" fill="#ffffff"/>' +
            '<path d="M49.5,49.5 L48.8,54.5 L50.8,55" fill="none" stroke="' + skinDark + '" stroke-width="1.2" stroke-linecap="round"/>' +
            (opts.masked
              ? '<path d="M30,52 L70,52 L66,69 Q50,75 34,69 Z" fill="#0f172a" stroke="' + eye + '" stroke-width="1.6"/>' +
                '<line x1="36" y1="58" x2="64" y2="58" stroke="' + eye + '" stroke-width="1.1" opacity="0.7"/>'
              : '<path d="M44,59.5 Q50,63.5 56,59" stroke="#78350f" stroke-width="2.2" fill="none" stroke-linecap="round"/>');

        const neckAndOutfit = isGirl
          ? '<path d="M22,98 C24,75 36,68 50,68 C64,68 76,75 78,98 Z" fill="url(#' + id + '_o)" stroke="rgba(255,255,255,0.6)" stroke-width="1.5"/>' +
            '<path d="M35,72 L50,86 L65,72" fill="none" stroke="' + accent + '" stroke-width="2.2"/>' +
            '<path d="M45,60 L45,70 Q50,72 55,70 L55,60 Z" fill="' + skinDark + '"/>' +
            '<rect x="44" y="65" width="12" height="3.2" rx="1.6" fill="' + accent + '"/>'
          : '<path d="M18,98 C20,74 34,67 50,67 C66,67 80,74 82,98 Z" fill="url(#' + id + '_o)" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>' +
            '<path d="M32,71 L50,88 L68,71" fill="none" stroke="' + accent + '" stroke-width="2.5"/>' +
            '<path d="M43,60 L43,70 Q50,72 57,70 L57,60 Z" fill="' + skinDark + '"/>';

        const sparkles = opts.glitter
          ? '<polygon class="st-sparkle" points="18,22 20,26 24,28 20,30 18,34 16,30 12,28 16,26" fill="#ffffff"/>' +
            '<polygon class="st-sparkle" points="82,20 84,24 88,26 84,28 82,32 80,28 76,26 80,24" fill="#fde047"/>'
          : '';

        return '<svg xmlns="http://w3.org" viewBox="0 0 100 100">' +
          '<defs>' +
            '<radialGradient id="' + id + '_bg" cx="35%" cy="25%" r="75%"><stop offset="0%" stop-color="' + bg1 + '"/><stop offset="100%" stop-color="' + bg2 + '"/></radialGradient>' +
            '<radialGradient id="' + id + '_s" cx="40%" cy="32%" r="68%"><stop offset="0%" stop-color="' + skinLight + '"/><stop offset="55%" stop-color="' + skinMid + '"/><stop offset="100%" stop-color="' + skinDark + '"/></radialGradient>' +
            '<linearGradient id="' + id + '_h" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + hairLight + '"/><stop offset="100%" stop-color="' + hair + '"/></linearGradient>' +
            '<linearGradient id="' + id + '_o" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="' + outfitLight + '"/><stop offset="100%" stop-color="' + outfit + '"/></linearGradient>' +
          '</defs>' +
          '<circle cx="50" cy="50" r="49" fill="url(#' + id + '_bg)"/>' +
          backLayer +
          hairBack + neckAndOutfit + faceShape +
          eyesAndFace + hairFront + acc + sparkles +
          '</svg>';
      }
      const MILLY_EMPRESS_ST_SVG = makeStudioPortrait({
        gender: 'girl', bg1: '#f43f5e', bg2: '#4c0519',
        skinLight: '#ffffff', skin: '#fff1f2', skinDark: '#fecdd3',
        hairLight: '#ffe4e6', hair: '#fb7185',
        outfitLight: '#fb7185', outfit: '#be123c',
        accent: '#fde047', eye: '#e11d48', acc: 'tiara', backProp: 'wings', glitter: true
      });

      const ITEMS = [
        { id: 'superhost', emoji: '🪷', name: '🪷👑 SAMAKSH 👑🪷', aura: 'st-aura-samaksh', req: 'code', featured: true, svg: KSHATRIYA_ST_SVG },

        { id: 'diamond', emoji: '💎', name: 'Cyber Striker', aura: 'st-aura-ice', req: 'free',
          svg: makeStudioPortrait({ gender: 'boy', bg1: '#0284c7', bg2: '#090d16', hairLight: '#7dd3fc', hair: '#0284c7', outfitLight: '#38bdf8', outfit: '#0f172a', accent: '#38bdf8', eye: '#38bdf8', spiky: true, acc: 'visor' }) },
        { id: 'samurai', emoji: '👹', name: 'Crimson Ronin', aura: 'st-aura-crimson', req: 'free',
          svg: makeStudioPortrait({ gender: 'boy', bg1: '#dc2626', bg2: '#090d16', hairLight: '#475569', hair: '#0f172a', outfitLight: '#ef4444', outfit: '#7f1d1d', accent: '#facc15', eye: '#facc15', spiky: true, acc: 'bandana', backProp: 'swords' }) },
        { id: 'phoenix', emoji: '🔥', name: 'Blaze Queen', aura: 'st-aura-fire', req: 'free',
          svg: makeStudioPortrait({ gender: 'girl', bg1: '#ea580c', bg2: '#1c1917', hairLight: '#fdba74', hair: '#ea580c', outfitLight: '#f97316', outfit: '#7c2d12', accent: '#fde047', eye: '#fde047', acc: 'flowerPin', backProp: 'wings' }) },
        { id: 'ninja', emoji: '🥷', name: 'Shadow Shinobi', aura: 'st-aura-violet', req: 'free',
          svg: makeStudioPortrait({ gender: 'boy', bg1: '#6d28d9', bg2: '#090d16', hairLight: '#334155', hair: '#090d16', outfitLight: '#7c3aed', outfit: '#1e1b4b', accent: '#c084fc', eye: '#c084fc', masked: true, acc: 'bandana' }) },
        { id: 'astro', emoji: '🚀', name: 'Starlight Girl', aura: 'st-aura-ice', req: 'free',
          svg: makeStudioPortrait({ gender: 'girl', bg1: '#2563eb', bg2: '#020617', hairLight: '#ffffff', hair: '#cbd5e1', outfitLight: '#60a5fa', outfit: '#1d4ed8', accent: '#38bdf8', eye: '#38bdf8', acc: 'halo' }) },

        { id: 'disco', emoji: '🪩', name: 'Neon DJ (3 Refs)', aura: 'st-aura-disco', req: 'ref3',
          svg: makeStudioPortrait({ gender: 'girl', bg1: '#ec4899', bg2: '#1e1b4b', hairLight: '#fbcfe8', hair: '#ec4899', outfitLight: '#e879f9', outfit: '#701a75', accent: '#00f0ff', eye: '#00f0ff', acc: 'visor' }) },
        { id: 'butterfly', emoji: '🦋', name: 'Butterfly Muse (3 Refs)', aura: 'st-aura-pink', req: 'ref3',
          svg: makeStudioPortrait({ gender: 'girl', bg1: '#d946ef', bg2: '#2e1065', hairLight: '#e9d5ff', hair: '#a855f7', outfitLight: '#d946ef', outfit: '#86198f', accent: '#fde047', eye: '#f472b6', acc: 'tiara', backProp: 'wings' }) },
        { id: 'kitsune', emoji: '🦊', name: 'Kitsune Girl (3 Refs)', aura: 'st-aura-fire', req: 'ref3',
          svg: makeStudioPortrait({ gender: 'girl', bg1: '#f43f5e', bg2: '#1f2937', hairLight: '#ffffff', hair: '#e2e8f0', outfitLight: '#fb7185', outfit: '#be123c', accent: '#fde047', eye: '#fb7185', acc: 'catEars' }) },

        { id: 'wolf', emoji: '🐺', name: 'Alpha Wolf (5 Refs)', aura: 'st-aura-fire', req: 'ref5',
          svg: makeStudioPortrait({ gender: 'boy', bg1: '#b91c1c', bg2: '#090d16', hairLight: '#94a3b8', hair: '#334155', outfitLight: '#475569', outfit: '#0f172a', accent: '#f97316', eye: '#f97316', spiky: true, acc: 'catEars' }) },
        { id: 'blossom', emoji: '🌸', name: 'Sakura Princess (5 Refs)', aura: 'st-aura-pink', req: 'ref5',
          svg: makeStudioPortrait({ gender: 'girl', bg1: '#f472b6', bg2: '#4c0519', hairLight: '#ffe4e6', hair: '#f472b6', outfitLight: '#f472b6', outfit: '#9d174d', accent: '#fde047', eye: '#f43f5e', acc: 'flowerPin', glitter: true }) },
        { id: 'skull', emoji: '💀', name: 'Toxic Hacker (5 Refs)', aura: 'st-aura-toxic', req: 'ref5',
          svg: makeStudioPortrait({ gender: 'boy', bg1: '#16a34a', bg2: '#052e16', hairLight: '#86efac', hair: '#16a34a', outfitLight: '#22c55e', outfit: '#064e3b', accent: '#4ade80', eye: '#4ade80', masked: true, acc: 'visor' }) },
        { id: 'lion', emoji: '🦁', name: 'Solar Prince (5 Refs)', aura: 'st-aura-gold', req: 'ref5',
          svg: makeStudioPortrait({ gender: 'boy', bg1: '#d97706', bg2: '#422006', hairLight: '#fef08a', hair: '#eab308', outfitLight: '#f59e0b', outfit: '#78350f', accent: '#ffffff', eye: '#fde047', spiky: true, acc: 'halo' }) },

        { id: 'dragon', emoji: '🐉', name: 'Jade Dragon (10 Refs)', aura: 'st-aura-emerald', req: 'ref10',
          svg: makeStudioPortrait({ gender: 'boy', bg1: '#059669', bg2: '#022c22', hairLight: '#6ee7b7', hair: '#059669', outfitLight: '#10b981', outfit: '#064e3b', accent: '#fde047', eye: '#6ee7b7', spiky: true, acc: 'horns' }) },
        { id: 'empress', emoji: '👸', name: 'Celestial Queen (10 Refs)', aura: 'st-aura-gold', req: 'ref10',
          svg: makeStudioPortrait({ gender: 'girl', bg1: '#9333ea', bg2: '#3b0764', hairLight: '#fef08a', hair: '#eab308', outfitLight: '#a855f7', outfit: '#581c87', accent: '#fde047', eye: '#38bdf8', acc: 'tiara', glitter: true }) },
        { id: 'reaper', emoji: '⚰️', name: 'Abyss Lord (10 Refs)', aura: 'st-aura-violet', req: 'ref10',
          svg: makeStudioPortrait({ gender: 'boy', bg1: '#4c1d95', bg2: '#090d16', hairLight: '#cbd5e1', hair: '#475569', outfitLight: '#334155', outfit: '#020617', accent: '#ef4444', eye: '#ef4444', masked: true, acc: 'horns' }) },
        { id: 'unicorn', emoji: '🦄', name: 'Pastel Angel (10 Refs)', aura: 'st-aura-pink', req: 'ref10',
          svg: makeStudioPortrait({ gender: 'girl', bg1: '#e879f9', bg2: '#311042', hairLight: '#fae8ff', hair: '#d946ef', outfitLight: '#e879f9', outfit: '#86198f', accent: '#fde047', eye: '#ec4899', acc: 'halo', backProp: 'wings', glitter: true }) },

        { id: 'host_shubhi', emoji: '🌷', name: '🌷 Shubhi', aura: 'st-aura-shubhi', req: 'code',
          svg: makeStudioPortrait({ gender: 'girl', bg1: '#f472b6', bg2: '#3b0764', hairLight: '#fae8ff', hair: '#e879f9', outfitLight: '#f472b6', outfit: '#be185d', accent: '#fde047', eye: '#ec4899', acc: 'flowerPin', glitter: true }) },
        { id: 'host_sid', emoji: '⚡', name: '⚡ Sid', aura: 'st-aura-sid', req: 'code',
          svg: makeStudioPortrait({ gender: 'boy', bg1: '#2563eb', bg2: '#090d16', hairLight: '#7dd3fc', hair: '#0284c7', outfitLight: '#3b82f6', outfit: '#1e3a8a', accent: '#fde047', eye: '#fde047', spiky: true, acc: 'thunderVisor', backProp: 'lightning' }) },
        { id: 'host_zoro', emoji: '⚔️', name: 'Zoro', aura: 'st-aura-emerald', req: 'code',
          svg: makeStudioPortrait({ gender: 'boy', bg1: '#15803d', bg2: '#052e16', hairLight: '#86efac', hair: '#16a34a', outfitLight: '#22c55e', outfit: '#14532d', accent: '#fde047', eye: '#4ade80', spiky: true, acc: 'bandana', backProp: 'swords' }) },
        { id: 'host_sarah', emoji: '🦋', name: 'Sarah', aura: 'st-aura-ice', req: 'code',
          svg: makeStudioPortrait({ gender: 'girl', bg1: '#0284c7', bg2: '#1e1b4b', hairLight: '#bae6fd', hair: '#38bdf8', outfitLight: '#38bdf8', outfit: '#1e3a8a', accent: '#fde047', eye: '#0284c7', acc: 'tiara', backProp: 'wings' }) },
        { id: 'host_milly', emoji: '💖', name: '💖 Milly Empress', aura: 'st-aura-empress', req: 'code', svg: MILLY_EMPRESS_ST_SVG },
        { id: 'host_heer', emoji: '🌸', name: 'Heer', aura: 'st-aura-pink', req: 'code',
          svg: makeStudioPortrait({ gender: 'girl', bg1: '#ec4899', bg2: '#3b0764', hairLight: '#fbcfe8', hair: '#f472b6', outfitLight: '#f472b6', outfit: '#831843', accent: '#fde047', eye: '#db2777', acc: 'flowerPin' }) },
        { id: 'host_ishika', emoji: '✨', name: 'Ishika', aura: 'st-aura-gold', req: 'code',
          svg: makeStudioPortrait({ gender: 'girl', bg1: '#eab308', bg2: '#422006', hairLight: '#fef9c3', hair: '#facc15', outfitLight: '#facc15', outfit: '#713f12', accent: '#ffffff', eye: '#d97706', acc: 'halo', glitter: true }) },
        { id: 'host_izzan', emoji: '🔥', name: 'Izzan', aura: 'st-aura-fire', req: 'code',
          svg: makeStudioPortrait({ gender: 'boy', bg1: '#dc2626', bg2: '#450a0a', hairLight: '#fca5a5', hair: '#dc2626', outfitLight: '#ef4444', outfit: '#7f1d1d', accent: '#fde047', eye: '#fde047', spiky: true, acc: 'horns' }) },
        { id: 'host_sus', emoji: '👀', name: 'Sus', aura: 'st-aura-toxic', req: 'code',
          svg: makeStudioPortrait({ gender: 'boy', bg1: '#16a34a', bg2: '#090d16', hairLight: '#86efac', hair: '#15803d', outfitLight: '#1e293b', outfit: '#020617', accent: '#4ade80', eye: '#4ade80', masked: true }) },
        { id: 'host_ruwii', emoji: '🌺', name: 'Ruwii', aura: 'st-aura-pink', req: 'code',
          svg: makeStudioPortrait({ gender: 'girl', bg1: '#e11d48', bg2: '#4c0519', hairLight: '#fecdd3', hair: '#f43f5e', outfitLight: '#fb7185', outfit: '#881337', accent: '#fde047', eye: '#be123c', acc: 'catEars' }) },
        { id: 'host_moon', emoji: '🌙', name: 'Moon', aura: 'st-aura-gold', req: 'code',
          svg: makeStudioPortrait({ gender: 'girl', bg1: '#4f46e5', bg2: '#090d16', hairLight: '#e0e7ff', hair: '#818cf8', outfitLight: '#6366f1', outfit: '#312e81', accent: '#fde047', eye: '#6366f1', acc: 'halo' }) },
        { id: 'host_zaira', emoji: '🪐', name: 'Zaira', aura: 'st-aura-violet', req: 'code',
          svg: makeStudioPortrait({ gender: 'girl', bg1: '#7c3aed', bg2: '#0f172a', hairLight: '#e9d5ff', hair: '#a855f7', outfitLight: '#9333ea', outfit: '#4c1d95', accent: '#38bdf8', eye: '#9333ea', acc: 'flowerPin' }) }
      ];
      let refs = 0;
      let unlocked = JSON.parse(localStorage.getItem('sammu_unlocked_avatars') || '[]');
      let playerAuraMap = {};
      let playerPortraitMap = {};
      let playerBadgeMap = {};

      const getUname = () => (window._savedUname || localStorage.getItem('sammu_username') || localStorage.getItem('username') || '').trim().toLowerCase();

      function hydrateLocalPlayer() {
        const me = getUname();
        if (!me) return;
        if (me === 'samaksh' || me === 'sammu') {
          playerAuraMap[me] = 'st-aura-samaksh';
          playerPortraitMap[me] = KSHATRIYA_ST_SVG;
          playerBadgeMap[me] = '🪷👑 SAMAKSH 👑🪷';
        } else if (me === 'milly') {
          playerAuraMap[me] = 'st-aura-empress';
          playerPortraitMap[me] = MILLY_EMPRESS_ST_SVG;
          playerBadgeMap[me] = '💖 Milly Empress';
        }
        const savedMyAvId = localStorage.getItem('sammu_my_av_id');
        if (savedMyAvId) {
          const foundAv = ITEMS.find(x => x.id === savedMyAvId);
          if (foundAv) {
            playerAuraMap[me] = foundAv.aura;
            playerPortraitMap[me] = foundAv.svg;
            playerBadgeMap[me] = foundAv.name;
          }
        }
      }
      hydrateLocalPlayer();

      function canUse(av) {
        if (av.req === 'free') return true;
        if (av.req === 'ref3') return refs >= 3;
        if (av.req === 'ref5') return refs >= 5;
        if (av.req === 'ref10') return refs >= 10;
        if (av.req === 'code') return unlocked.includes(av.id);
        return false;
      }

      window.stCopyRef = function() {
        const link = window.location.origin + '/?ref=' + encodeURIComponent(getUname() || 'player');
        if (navigator.clipboard) navigator.clipboard.writeText(link);
        alert('🔗 Referral Link Copied!\\n' + link);
      };

      window.stRedeemCode = function() {
        const code = (document.getElementById('stCodeInput').value || '').trim();
        if (code && typeof socket !== 'undefined') {
          socket.emit('verifyAvatarCodeV6', { username: getUname(), code });
        }
      };

      const zCard = document.getElementById('stZoomCard');
      if (zCard) {
        const handleTilt = (clientX, clientY) => {
          const r = zCard.getBoundingClientRect();
          const dx = (clientX - (r.left + r.width / 2)) / (r.width / 2);
          const dy = (clientY - (r.top + r.height / 2)) / (r.height / 2);
          zCard.style.transform = 'perspective(500px) rotateY(' + (dx * 14).toFixed(1) + 'deg) rotateX(' + (-dy * 14).toFixed(1) + 'deg)';
        };
        zCard.addEventListener('touchmove', (e) => {
          if (e.touches && e.touches.length) handleTilt(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });
        zCard.addEventListener('mousemove', (e) => handleTilt(e.clientX, e.clientY));
        zCard.addEventListener('touchend', () => { zCard.style.transform = 'none'; });
        zCard.addEventListener('mouseleave', () => { zCard.style.transform = 'none'; });
      }

      window.stOpenZoom = function(displayName, svgHtml, auraCls, titleText) {
        const ring = document.getElementById('stZoomRing');
        if (zCard) zCard.style.transform = 'none';
        ring.className = auraCls || '';
        ring.innerHTML = svgHtml || '';
        document.getElementById('stZoomUser').textContent = displayName || 'Player';
        document.getElementById('stZoomTitle').textContent = titleText || 'Illustrated Character';

        const hypeBtn = document.getElementById('stHypeBtn');
        if (hypeBtn) {
          hypeBtn.onclick = function() {
            document.getElementById('stZoomModal').style.display = 'none';
            if (typeof socket !== 'undefined') {
              const me = window._savedUname || localStorage.getItem('sammu_username') || 'Someone';
              socket.emit('chatMessage', {
                username: me,
                text: '🔥✨ ' + me + ' hyped ' + (displayName || 'this') + '\\'s Avatar! (' + (titleText || 'Character') + ')'
              });
            }
          };
        }
        document.getElementById('stZoomModal').style.display = 'flex';
      };

      window.stDrawVault = function() {
        const grid = document.getElementById('stGrid');
        const txt = document.getElementById('stRefText');
        if (txt) txt.textContent = '🔗 Referrals: ' + refs + ' | Tap Any Player Avatar Bubble to Zoom!';
        if (!grid) return;
        grid.innerHTML = '';

        ITEMS.forEach(av => {
          const ok = canUse(av);
          const d = document.createElement('div');
          d.className = 'st-item' + (ok ? '' : ' locked');

          if (av.featured) {
            d.style.cssText = 'grid-column:1/-1;background:linear-gradient(135deg,rgba(29,78,216,0.38),rgba(250,204,21,0.32));border:2px solid #fde047;padding:9px;';
          } else if (av.id === 'host_shubhi') {
            d.style.cssText = 'background:linear-gradient(135deg,rgba(244,114,182,0.28),rgba(253,224,71,0.22));border:1.5px solid #f472b6;';
          } else if (av.id === 'host_milly') {
            d.style.cssText = 'background:linear-gradient(135deg,rgba(244,63,94,0.28),rgba(232,121,249,0.25));border:1.5px solid #fb7185;';
          } else if (av.id === 'host_sid') {
            d.style.cssText = 'background:linear-gradient(135deg,rgba(37,99,235,0.28),rgba(56,189,248,0.25));border:1.5px solid #38bdf8;';
          }

          d.innerHTML =
            '<div class="st-art ' + av.aura + '" style="' + (av.featured ? 'width:72px;height:72px;' : '') + '">' + av.svg + '</div>' +
            '<div style="font-weight:900;font-size:' + (av.featured ? '13px;color:#fde047;' : '10px;') + '">' + av.name + '</div>' +
            '<div style="font-size:10px;color:' + (ok ? '#4ade80' : '#f87171') + ';margin-top:2px;">' + (ok ? '✅ Tap to Equip' : '🔒 Locked') + '</div>';

          d.onclick = () => {
            if (!ok) {
              alert('🔒 Locked! Earn referrals or enter your Host Avatar code below.');
              return;
            }
            const me = getUname();
            if (me) {
              playerAuraMap[me] = av.aura;
              playerPortraitMap[me] = av.svg;
              playerBadgeMap[me] = av.name;
            }
            localStorage.setItem('sammu_my_aura', av.aura);
            localStorage.setItem('sammu_my_av_id', av.id);
            localStorage.setItem('sammu_avatar', av.emoji);
            localStorage.setItem('avatar', av.emoji);
            window._savedAvatar = av.emoji;

            if (typeof socket !== 'undefined') {
              socket.emit('equipAvatarFxV6', {
                username: me,
                avatar: av.emoji,
                avatarId: av.id,
                fx: av.aura,
                badge: av.name
              });
              socket.emit('joinRoom', {
                username: me || 'Player',
                avatar: av.emoji,
                deviceId: localStorage.getItem('sammu_dev_uid') || '',
                isReconnect: true
              });
            }
            document.getElementById('stVaultModal').style.display = 'none';
            renderStudioBubbles(true);
          };
          grid.appendChild(d);
        });
      };
      document.addEventListener('click', function(e) {
        const bubble = e.target.closest('.st-live-bubble, .v22-av-bubble');
        if (bubble) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          const sender = bubble.getAttribute('data-zoom-sender') || '';
          const displayName = bubble.getAttribute('data-zoom-user') || sender || 'Player';
          const svgHtml = bubble.innerHTML;
          const auraCls = playerAuraMap[sender] || '';
          const titleText = playerBadgeMap[sender] || 'Illustrated Character';
          window.stOpenZoom(displayName, svgHtml, auraCls, titleText);
          return;
        }

        const btn = e.target.closest('button, a, div[onclick]');
        if (!btn) return;
        if (btn.id === 'openAvatarVaultBtn' || /avatars/i.test((btn.textContent || '').trim())) {
          if (btn.closest('#stVaultModal')) return;
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          hydrateLocalPlayer();
          if (typeof socket !== 'undefined') socket.emit('getMyAvatarStatsV6', { username: getUname() });
          window.stDrawVault();
          document.getElementById('stVaultModal').style.display = 'flex';
        }
      }, true);

      function renderStudioBubbles(forceRefresh) {
        hydrateLocalPlayer();

        document.querySelectorAll('div, span, b, strong').forEach(el => {
          if (el.closest('#stVaultModal') || el.closest('#stZoomModal')) return;
          if (el.children.length > 0) return;

          const raw = (el.textContent || '').trim();
          const sender = raw.replace(/\s*(cap\s*[ab]|👑|creator)\s*/gi, '').trim().toLowerCase();
          if (!sender || sender.length > 25) return;

          let auraClass = playerAuraMap[sender];
          let portraitSvg = playerPortraitMap[sender];

          if ((sender === 'samaksh' || sender === 'sammu') && !portraitSvg) {
            auraClass = 'st-aura-samaksh';
            portraitSvg = KSHATRIYA_ST_SVG;
          } else if (sender === 'milly' && !portraitSvg) {
            auraClass = 'st-aura-empress';
            portraitSvg = MILLY_EMPRESS_ST_SVG;
          }

          const container = el.parentElement;
          if (!container) return;

          if (container.offsetWidth > 60 && container.offsetWidth < 300 && container.offsetHeight < 70 && /cap\s*[ab]|👑|creator/i.test(container.textContent || '')) {
            if (auraClass === 'st-aura-samaksh' || auraClass === 'st-aura-empress') {
              container.classList.add(auraClass);
            }
          }

          if (sender === 'samaksh' || sender === 'sammu' || sender === 'milly') {
            const chatGlowCls = (sender === 'milly') ? 'st-chat-milly' : 'st-chat-rainbow';
            let headerRow = el.parentElement;
            while (headerRow && headerRow.parentElement && headerRow.parentElement.children.length <= 2) {
              if (headerRow.nextElementSibling) break;
              headerRow = headerRow.parentElement;
            }
            if (headerRow && headerRow.nextElementSibling && !headerRow.nextElementSibling.querySelector('input, button')) {
              headerRow.nextElementSibling.classList.add(chatGlowCls);
            }
          }

          if (!portraitSvg) return;

          const stamp = sender + ':' + (auraClass || '');
          if (!forceRefresh && container.dataset.stCleanStamp === stamp) return;

          const iconSpan = Array.from(container.children).find(c =>
            c !== el && !c.querySelector('button') &&
            ((c.textContent || '').trim().length <= 4 || c.querySelector('.st-live-bubble, .v22-av-bubble')) &&
            !/cap\s*[ab]|creator/i.test(c.textContent || '')
          );

          if (iconSpan) {
            container.dataset.stCleanStamp = stamp;
            iconSpan.innerHTML = '<span class="st-live-bubble ' + (auraClass || '') + '" data-zoom-user="' + raw.replace(/"/g, '&quot;') + '" data-zoom-sender="' + sender + '">' + portraitSvg + '</span>';
          }
        });
      }

      function bindStudioSocket() {
        if (typeof socket === 'undefined' || window._stStudioSock) return;
        window._stStudioSock = true;

        socket.emit('getMyAvatarStatsV6', { username: getUname() });

        socket.on('avatarStatsDataV6', (d) => {
          if (d && typeof d.refs === 'number') refs = d.refs;
          if (d && d.avatarMap) {
            Object.entries(d.avatarMap).forEach(([u, info]) => {
              const key = u.toLowerCase();
              if (info && info.avatarId) {
                const found = ITEMS.find(x => x.id === info.avatarId);
                if (found) {
                  playerAuraMap[key] = found.aura;
                  playerPortraitMap[key] = found.svg;
                  playerBadgeMap[key] = found.name;
                }
              }
            });
          }
          window.stDrawVault();
          renderStudioBubbles(true);
        });

        socket.on('avatarCodeResultV6', (res) => {
          if (res && res.ok && res.avatarId) {
            if (!unlocked.includes(res.avatarId)) {
              unlocked.push(res.avatarId);
              localStorage.setItem('sammu_unlocked_avatars', JSON.stringify(unlocked));
            }
            alert('🎉 Unlocked: ' + res.name + '!');
            window.stDrawVault();
          } else {
            alert('❌ Invalid Avatar Code!');
          }
        });
      }

      window.stDrawVault();
      renderStudioBubbles(true);
      setInterval(() => {
        bindStudioSocket();
        renderStudioBubbles(false);
      }, 650);
    })();
    </script>
    `;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>')) {
                body = body.replace('</body>', STUDIO_AVATAR_OVERRIDE + '\n</body>');
            }
            return origSend.call(this, body);
        };
        const origSendFile = res.sendFile;
        res.sendFile = function(filePath) {
            if (typeof filePath === 'string' && filePath.endsWith('.html')) {
                try {
                    let html = fs.readFileSync(filePath, 'utf8');
                    if (html.includes('</body>')) {
                        html = html.replace('</body>', STUDIO_AVATAR_OVERRIDE + '\n</body>');
                        res.setHeader('Content-Type', 'text/html; charset=utf-8');
                        return origSend.call(this, html);
                    }
                } catch (e) {}
            }
            return origSendFile.apply(this, arguments);
        };
        next();
    });
    // === END STUDIO ILLUSTRATED AVATARS + RAINBOW HOST AURA ===
       // === AVATAR BUTTON INJECTOR ===
    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>')) {
                body = body.replace('</body>', `<script>
                setInterval(() => {
                  if (document.getElementById('openAvatarVaultBtn')) return;
                  const anchor = document.getElementById('openPhonkDjBtn') || document.getElementById('openChefBtn') ||
                    Array.from(document.querySelectorAll('button, a, div[onclick]')).find(el => el.children.length === 0 && /jam|🎹|phonk/i.test(el.textContent || ''));
                  if (anchor && anchor.parentNode) {
                    const btn = anchor.cloneNode(true);
                    btn.id = 'openAvatarVaultBtn';
                    btn.removeAttribute('onclick');
                    btn.textContent = '👑 Avatars';
                    anchor.parentNode.insertBefore(btn, anchor.nextSibling);
                  }
                }, 800);
                </script>\n</body>`);
            }
            return origSend.call(this, body);
        };
        next();
    });
    // === 60FPS MOBILE LAG REDUCER & CRYSTAL AUDIO ENGINE (DROP-IN) ===
    const MOBILE_TURBO_AUDIO_BOOSTER = `
    <style id="turboBoostCss">
      /* Pause infinite glow/spin animations when tab is hidden or turbo-paused to save battery & CPU */
      body.turbo-paused *, body.turbo-paused *::before, body.turbo-paused *::after {
        animation-play-state: paused !important;
      }
      /* GPU layer promotion & layout containment for smooth mobile scrolling */
      #chatBox, #messages, .chat-messages {
        contain: content;
        transform: translateZ(0);
        -webkit-overflow-scrolling: touch;
      }
      /* Strip heavy blur filters globally on older mobile GPUs */
      * {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }
    </style>
    <script>
    (function() {
      if (window._mobileTurboInstalled) return;
      window._mobileTurboInstalled = true;

      /* 1. CRYSTAL-CLEAR ANTI-GLITCH WEB AUDIO COMPRESSOR & LIMITER */
      const NativeAudioCtx = window.AudioContext || window.webkitAudioContext;
      if (NativeAudioCtx) {
        const masterMap = new WeakMap();

        function getCleanMaster(ctx) {
          if (masterMap.has(ctx)) return masterMap.get(ctx);
          try {
            const compressor = ctx.createDynamicsCompressor();
            compressor.threshold.setValueAtTime(-14, ctx.currentTime);
            compressor.knee.setValueAtTime(18, ctx.currentTime);
            compressor.ratio.setValueAtTime(12, ctx.currentTime);
            compressor.attack.setValueAtTime(0.003, ctx.currentTime);
            compressor.release.setValueAtTime(0.15, ctx.currentTime);

            const limiterGain = ctx.createGain();
            limiterGain.gain.setValueAtTime(0.82, ctx.currentTime);

            compressor.connect(limiterGain);
            limiterGain.connect(ctx.destination);
            masterMap.set(ctx, compressor);

            /* Silent 1Hz keep-alive oscillator prevents mobile hardware audio sleep/clicks */
            const keepAliveOsc = ctx.createOscillator();
            const silentGain = ctx.createGain();
            silentGain.gain.setValueAtTime(0.00001, ctx.currentTime);
            keepAliveOsc.frequency.setValueAtTime(1, ctx.currentTime);
            keepAliveOsc.connect(silentGain);
            silentGain.connect(ctx.destination);
            keepAliveOsc.start();

            return compressor;
          } catch (e) {
            return ctx.destination;
          }
        }

        /* Route gain nodes connected to ctx.destination through our anti-clip compressor */
        const origConnect = AudioNode.prototype.connect;
        AudioNode.prototype.connect = function(dest, ...args) {
          if (dest && this.context && dest === this.context.destination && this._isCleanMaster !== true) {
            const cleanBus = getCleanMaster(this.context);
            if (cleanBus && cleanBus !== dest) {
              cleanBus._isCleanMaster = true;
              return origConnect.call(this, cleanBus, ...args);
            }
          }
          return origConnect.call(this, dest, ...args);
        };

        /* Auto-unlock suspended audio on any mobile tap */
        const activeContexts = new Set();
        const PatchedAudioCtx = function(...args) {
          const ctx = new NativeAudioCtx(...args);
          activeContexts.add(ctx);
          return ctx;
        };
        PatchedAudioCtx.prototype = NativeAudioCtx.prototype;
        window.AudioContext = PatchedAudioCtx;
        if (window.webkitAudioContext) window.webkitAudioContext = PatchedAudioCtx;

        const unlockMobileAudio = () => {
          activeContexts.forEach(ctx => {
            if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
          });
        };
        document.addEventListener('touchstart', unlockMobileAudio, { passive: true });
        document.addEventListener('click', unlockMobileAudio, { passive: true });
      }

      /* 2. PAUSE ANIMATIONS WHEN APP IS BACKGROUNDED (SAVES RAM & PREVENTS AUDIO STUTTER) */
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          document.body.classList.add('turbo-paused');
        } else {
          document.body.classList.remove('turbo-paused');
        }
      });

      /* 3. RAM & DOM GARBAGE COLLECTOR FOR OLD PHONES */
      function cleanHeavyDom() {
        const boxes = document.querySelectorAll('#chatBox, #messages, .chat-messages');
        boxes.forEach(box => {
          while (box.children.length > 55) {
            box.removeChild(box.firstElementChild);
          }
          box.querySelectorAll('img:not([data-opt])').forEach(img => {
            img.setAttribute('data-opt', '1');
            img.loading = 'lazy';
            img.decoding = 'async';
          });
        });
      }

      setInterval(cleanHeavyDom, 3000);
    })();
    </script>
    `;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>')) {
                body = body.replace('</body>', MOBILE_TURBO_AUDIO_BOOSTER + '\n</body>');
            }
            return origSend.call(this, body);
        };
        const origSendFile = res.sendFile;
        res.sendFile = function(filePath) {
            if (typeof filePath === 'string' && filePath.endsWith('.html')) {
                try {
                    let html = fs.readFileSync(filePath, 'utf8');
                    if (html.includes('</body>')) {
                        html = html.replace('</body>', MOBILE_TURBO_AUDIO_BOOSTER + '\n</body>');
                        res.setHeader('Content-Type', 'text/html; charset=utf-8');
                        return origSend.call(this, html);
                    }
                } catch (e) {}
            }
            return origSendFile.apply(this, arguments);
        };
        next();
    });
    // === END 60FPS MOBILE LAG REDUCER & CRYSTAL AUDIO ENGINE ===
   

};
