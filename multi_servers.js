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
    // === PREMIUM AVATAR VAULT v5 (27 HD SVG AVATARS - 11 OFFICIAL HOSTS ONLY) ===
    const PREMIUM_AVATAR_CSS_HTML = `
    <style>
      @keyframes discoPulse {
        0% { box-shadow: 0 0 12px #ff0080, inset 0 0 8px #ff0080; border-color: #ff0080; filter: hue-rotate(0deg); }
        50% { box-shadow: 0 0 20px #00f0ff, inset 0 0 10px #00f0ff; border-color: #00f0ff; filter: hue-rotate(180deg); }
        100% { box-shadow: 0 0 12px #ff0080, inset 0 0 8px #ff0080; border-color: #ff0080; filter: hue-rotate(360deg); }
      }
      @keyframes diamondShine {
        0%, 100% { box-shadow: 0 0 14px #38bdf8, 0 0 24px #bae6fd; border-color: #7dd3fc; transform: scale(1); }
        50% { box-shadow: 0 0 22px #ffffff, 0 0 32px #38bdf8; border-color: #ffffff; transform: scale(1.06); }
      }
      @keyframes girlGlamGlow {
        0%, 100% { box-shadow: 0 0 14px #f472b6, 0 0 24px #e879f9; border-color: #f9a8d4; transform: scale(1); }
        50% { box-shadow: 0 0 22px #fda4af, 0 0 32px #d946ef; border-color: #ffffff; transform: scale(1.06); }
      }
      @keyframes superHostAura {
        0% { box-shadow: 0 0 18px #fde047, 0 0 34px #f59e0b, 0 0 50px #ef4444, inset 0 0 12px #fef08a; border-color: #ffffff; transform: scale(1.04); }
        33% { box-shadow: 0 0 22px #38bdf8, 0 0 40px #a855f7, 0 0 58px #fde047, inset 0 0 14px #bae6fd; border-color: #fde047; transform: scale(1.1); }
        66% { box-shadow: 0 0 22px #f43f5e, 0 0 40px #fde047, 0 0 58px #38bdf8, inset 0 0 14px #fecdd3; border-color: #38bdf8; transform: scale(1.06); }
        100% { box-shadow: 0 0 18px #fde047, 0 0 34px #f59e0b, 0 0 50px #ef4444, inset 0 0 12px #fef08a; border-color: #ffffff; transform: scale(1.04); }
      }
      @keyframes samakshChatGlow {
        0% { background-position: 0% 50%; box-shadow: 0 0 18px rgba(250,204,21,0.9), 0 0 32px rgba(245,158,11,0.6), inset 0 0 14px rgba(254,240,138,0.45); border-color: #fde047; }
        50% { background-position: 100% 50%; box-shadow: 0 0 26px rgba(56,189,248,0.95), 0 0 42px rgba(236,72,153,0.75), inset 0 0 18px rgba(255,255,255,0.5); border-color: #ffffff; }
        100% { background-position: 0% 50%; box-shadow: 0 0 18px rgba(250,204,21,0.9), 0 0 32px rgba(245,158,11,0.6), inset 0 0 14px rgba(254,240,138,0.45); border-color: #fde047; }
      }

      .av-fx-disco { animation: discoPulse 2.2s linear infinite !important; border: 2px solid #ff0080 !important; border-radius: 50% !important; }
      .av-fx-diamond { animation: diamondShine 2s ease-in-out infinite !important; border: 2px solid #7dd3fc !important; border-radius: 50% !important; }
      .av-fx-girlglam { animation: girlGlamGlow 2s ease-in-out infinite !important; border: 2px solid #f9a8d4 !important; border-radius: 50% !important; }
      .av-fx-superhost { animation: superHostAura 1.3s ease-in-out infinite !important; border: 3px solid #ffffff !important; border-radius: 50% !important; z-index: 5; }
      .av-fx-host { box-shadow: 0 0 14px #a855f7 !important; border: 2px solid #c084fc !important; border-radius: 50% !important; }

      .chat-glow-samaksh {
        background: linear-gradient(120deg, rgba(250,204,21,0.34), rgba(239,68,68,0.30), rgba(168,85,247,0.32), rgba(56,189,248,0.34)) !important;
        background-size: 250% 250% !important;
        border: 2px solid #fde047 !important;
        border-radius: 16px !important;
        padding: 9px 13px !important;
        margin: 6px 0 !important;
        animation: samakshChatGlow 2s ease-in-out infinite !important;
        color: #ffffff !important;
        font-weight: 800 !important;
        text-shadow: 0 0 10px #fde047, 0 0 18px #f59e0b !important;
      }
      .chat-glow-samaksh * { color: #ffffff !important; text-shadow: 0 0 8px #fde047, 0 0 16px #38bdf8 !important; }
      .chat-glow-vip {
        background: linear-gradient(135deg, rgba(56,189,248,0.16), rgba(168,85,247,0.18)) !important;
        border: 1px solid #38bdf8 !important;
        border-radius: 12px !important;
        padding: 6px 10px !important;
        margin: 4px 0 !important;
        box-shadow: 0 0 12px rgba(56,189,248,0.35) !important;
      }

      #avatarVaultModal, #avatarPreviewModal { display:none; position:fixed; inset:0; background:rgba(5,8,20,0.92); z-index:999995; align-items:center; justify-content:center; backdrop-filter:blur(10px); font-family:inherit; padding:12px; }
      #avatarVaultCard, #avatarPreviewCard { background:linear-gradient(155deg,#0f172a,#1e1b4b); border:2px solid #38bdf8; border-radius:22px; padding:16px; width:100%; max-width:440px; color:#fff; text-align:center; box-shadow:0 0 35px rgba(56,189,248,0.45); max-height:90vh; overflow-y:auto; }
      .av-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin:10px 0; }
      .av-item { background:rgba(255,255,255,0.06); border:1.5px solid rgba(56,189,248,0.35); border-radius:14px; padding:8px 5px; cursor:pointer; transition:0.15s; }
      .av-item:hover { background:rgba(56,189,248,0.18); transform:translateY(-2px); }
      .av-item.locked { opacity:0.65; border-color:#64748b; }
      .av-art-circle { width:52px; height:52px; margin:0 auto 5px auto; display:flex; align-items:center; justify-content:center; border-radius:50%; background:radial-gradient(circle at 30% 30%, #1e293b, #020617); overflow:hidden; }
      .av-art-circle img { width:100%; height:100%; display:block; }
    </style>

    <div id="avatarVaultModal">
      <div id="avatarVaultCard">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:900;font-size:15px;color:#38bdf8;">👑 27 HD AVATAR VAULT</span>
          <button onclick="document.getElementById('avatarVaultModal').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:8px;padding:4px 10px;font-weight:bold;cursor:pointer;">✕</button>
        </div>
        <div id="avRefStats" style="font-size:11px;color:#fde047;margin:6px 0;font-weight:bold;">🔗 Your Referrals: 0 | Unlock HD Avatars at 3, 5 & 10 Refs!</div>
        <div class="av-grid" id="avVaultGrid"></div>
        <div style="display:flex;gap:6px;margin-top:8px;">
          <input id="avSecretCodeInput" placeholder="Enter Host Avatar Code..." style="flex:1;padding:8px;border-radius:10px;border:1.5px solid #c084fc;background:#090d16;color:#fff;font-size:12px;">
          <button onclick="redeemAvatarCode()" style="background:linear-gradient(90deg,#a855f7,#ec4899);border:none;color:#fff;border-radius:10px;padding:8px 12px;font-weight:bold;font-size:12px;cursor:pointer;">🔓 Unlock</button>
        </div>
        <button onclick="copyMyInviteForAvatars()" style="width:100%;margin-top:8px;padding:9px;border:none;border-radius:10px;background:linear-gradient(90deg,#059669,#10b981);color:#fff;font-weight:900;font-size:12px;cursor:pointer;">🔗 Copy My Referral Link (3, 5 & 10 Refs)</button>
      </div>
    </div>

    <div id="avatarPreviewModal" onclick="this.style.display='none'">
      <div id="avatarPreviewCard" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:900;font-size:14px;color:#7dd3fc;">🔍 PLAYER AVATAR PROFILE</span>
          <button onclick="document.getElementById('avatarPreviewModal').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:8px;padding:3px 9px;font-weight:bold;cursor:pointer;">✕</button>
        </div>
        <div id="avPreviewCircle" style="width:104px;height:104px;margin:14px auto;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#090d16;"></div>
        <div id="avPreviewName" style="font-size:18px;font-weight:900;color:#fff;">Player</div>
        <div id="avPreviewBadge" style="font-size:12px;color:#fde047;margin-top:4px;font-weight:bold;">Standard Member</div>
      </div>
    </div>
    <script>
    (function() {
      function makeSvgUri(innerSvg) {
        const full = '<svg xmlns="http://w3.org" viewBox="0 0 100 100">' + innerSvg + '</svg>';
        return 'data:image/svg+xml;utf8,' + encodeURIComponent(full);
      }

      const AVATAR_ART = {
        diamond: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#082f49"/><polygon points="50,14 82,38 50,86 18,38" fill="#38bdf8" stroke="#fff" stroke-width="2.5"/><polyline points="18,38 50,48 82,38" fill="none" stroke="#e0f2fe" stroke-width="2"/><line x1="50" y1="14" x2="50" y2="86" stroke="#bae6fd" stroke-width="1.8"/>'),
        samurai: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#1e1b4b"/><path d="M22,55 C22,28 78,28 78,55 L70,76 L30,76 Z" fill="#dc2626" stroke="#facc15" stroke-width="2.5"/><polygon points="50,14 56,30 74,24 60,36 50,32 40,36 26,24 44,30" fill="#facc15"/><rect x="32" y="48" width="36" height="8" rx="3" fill="#090d16"/><circle cx="40" cy="52" r="2.5" fill="#38bdf8"/><circle cx="60" cy="52" r="2.5" fill="#38bdf8"/>'),
        phoenix: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#450a0a"/><path d="M50,16 C65,30 82,34 76,58 C70,74 56,82 50,86 C44,82 30,74 24,58 C18,34 35,30 50,16 Z" fill="#f97316" stroke="#fde047" stroke-width="2"/><path d="M50,30 C60,42 66,52 50,74 C34,52 40,42 50,30 Z" fill="#facc15"/>'),
        ninja: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#090d16"/><circle cx="50" cy="52" r="30" fill="#1e293b" stroke="#64748b" stroke-width="2"/><rect x="24" y="42" width="52" height="14" rx="5" fill="#020617"/><polygon points="34,47 45,50 35,52" fill="#ef4444"/><polygon points="66,47 55,50 65,52" fill="#ef4444"/><path d="M74,46 L88,38 L84,50 L90,56 L74,52 Z" fill="#ef4444"/>'),
        astro: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#0f172a"/><circle cx="50" cy="52" r="32" fill="#e2e8f0" stroke="#38bdf8" stroke-width="3"/><rect x="30" y="38" width="40" height="24" rx="10" fill="#0284c7" stroke="#bae6fd" stroke-width="2"/><path d="M35,43 Q45,40 52,43" stroke="#fff" stroke-width="2.5" fill="none"/>'),
        disco: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#1e1b4b"/><circle cx="50" cy="52" r="32" fill="#ec4899" stroke="#f0abfc" stroke-width="2"/><path d="M22,52 H78 M26,38 H74 M26,66 H74 M50,20 V84 M35,23 V81 M65,23 V81" stroke="#fff" stroke-width="1.4" opacity="0.8"/><polygon points="50,6 54,16 64,16 56,22 59,31 50,25 41,31 44,22 36,16 46,16" fill="#fde047"/>'),
        girl_butterfly: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#2e1065"/><path d="M48,50 C25,18 10,35 24,54 C12,68 28,84 48,60 Z" fill="#f472b6" stroke="#fbcfe8" stroke-width="2"/><path d="M52,50 C75,18 90,35 76,54 C88,68 72,84 52,60 Z" fill="#a855f7" stroke="#fbcfe8" stroke-width="2"/><rect x="47" y="30" width="6" height="42" rx="3" fill="#fde047"/>'),
        kitsune: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#311042"/><polygon points="24,18 38,42 20,52" fill="#f8fafc" stroke="#f43f5e" stroke-width="2"/><polygon points="76,18 62,42 80,52" fill="#f8fafc" stroke="#f43f5e" stroke-width="2"/><polygon points="50,84 22,50 36,34 50,40 64,34 78,50" fill="#ffffff" stroke="#f43f5e" stroke-width="2.5"/><path d="M32,54 L44,58 M68,54 L56,58 M42,68 L50,74 L58,68" stroke="#f43f5e" stroke-width="2.5" fill="none"/>'),
        ref5: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#450a0a"/><polygon points="24,22 36,44 20,54" fill="#fb923c" stroke="#fde047" stroke-width="2"/><polygon points="76,22 64,44 80,54" fill="#fb923c" stroke="#fde047" stroke-width="2"/><polygon points="50,84 22,52 34,34 50,42 66,34 78,52" fill="#1f2937" stroke="#f97316" stroke-width="2.5"/><polygon points="36,52 44,56 38,60" fill="#facc15"/><polygon points="64,52 56,56 62,60" fill="#facc15"/>'),
        girl_blossom: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#4c0519"/><g fill="#f472b6" stroke="#fbcfe8" stroke-width="1.5"><ellipse cx="50" cy="26" rx="11" ry="18"/><ellipse cx="50" cy="74" rx="11" ry="18"/><ellipse cx="26" cy="50" rx="18" ry="11"/><ellipse cx="74" cy="50" rx="18" ry="11"/><ellipse cx="33" cy="33" rx="14" ry="14"/><ellipse cx="67" cy="67" rx="14" ry="14"/><ellipse cx="67" cy="33" rx="14" ry="14"/><ellipse cx="33" cy="67" rx="14" ry="14"/></g><circle cx="50" cy="50" r="13" fill="#fde047"/>'),
        skull: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#052e16"/><path d="M28,48 C28,24 72,24 72,48 C72,60 64,65 62,76 L38,76 C36,65 28,60 28,48 Z" fill="#4ade80" stroke="#bbf7d0" stroke-width="2"/><circle cx="39" cy="48" r="6" fill="#052e16"/><circle cx="61" cy="48" r="6" fill="#052e16"/><line x1="44" y1="68" x2="44" y2="76" stroke="#052e16" stroke-width="2.5"/><line x1="50" y1="68" x2="50" y2="76" stroke="#052e16" stroke-width="2.5"/><line x1="56" y1="68" x2="56" y2="76" stroke="#052e16" stroke-width="2.5"/>'),
        lion: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#422006"/><circle cx="50" cy="52" r="34" fill="#d97706" stroke="#fde047" stroke-width="2.5"/><polygon points="50,76 30,52 36,34 50,38 64,34 70,52" fill="#fef08a"/><polygon points="45,58 55,58 50,64" fill="#78350f"/><circle cx="41" cy="47" r="3" fill="#090d16"/><circle cx="59" cy="47" r="3" fill="#090d16"/>'),
        ref10: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#042f2e"/><path d="M25,70 C20,40 40,20 68,26 C55,34 54,44 74,48 C62,58 58,72 42,78 Z" fill="#34d399" stroke="#a7f3d0" stroke-width="2"/><circle cx="54" cy="34" r="3.5" fill="#fef08a"/><polygon points="28,26 42,32 34,40" fill="#fde047"/>'),
        girl_empress: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#3b0764"/><polygon points="20,68 24,34 38,50 50,24 62,50 76,34 80,68" fill="#fde047" stroke="#fff" stroke-width="2"/><rect x="20" y="68" width="60" height="10" rx="4" fill="#ec4899"/><circle cx="50" cy="52" r="5" fill="#38bdf8"/>'),
        reaper: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#090d16"/><path d="M26,76 C26,34 74,34 74,76 Z" fill="#1e293b" stroke="#94a3b8" stroke-width="2"/><ellipse cx="50" cy="54" rx="14" ry="18" fill="#020617"/><circle cx="45" cy="52" r="2.5" fill="#38bdf8"/><circle cx="55" cy="52" r="2.5" fill="#38bdf8"/><path d="M20,24 Q65,12 82,36" stroke="#e2e8f0" stroke-width="4" fill="none"/>'),
        unicorn: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#4a044e"/><polygon points="50,12 44,36 56,36" fill="#fde047" stroke="#fff" stroke-width="1.5"/><path d="M32,74 C28,46 42,32 62,38 C74,42 74,62 60,74 Z" fill="#f8fafc" stroke="#f472b6" stroke-width="2.5"/><circle cx="56" cy="48" r="3" fill="#a855f7"/>'),
        host_zoro: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#052e16"/><line x1="20" y1="80" x2="80" y2="20" stroke="#e2e8f0" stroke-width="6" stroke-linecap="round"/><line x1="20" y1="20" x2="80" y2="80" stroke="#4ade80" stroke-width="6" stroke-linecap="round"/><line x1="50" y1="14" x2="50" y2="86" stroke="#facc15" stroke-width="5" stroke-linecap="round"/><circle cx="50" cy="50" r="12" fill="#14532d" stroke="#4ade80" stroke-width="3"/>'),
        host_sarah: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#1e1b4b"/><path d="M48,50 C22,16 8,36 24,56 C10,70 28,86 48,60 Z" fill="#38bdf8" stroke="#e0f2fe" stroke-width="2"/><path d="M52,50 C78,16 92,36 76,56 C90,70 72,86 52,60 Z" fill="#c084fc" stroke="#f3e8ff" stroke-width="2"/><rect x="47" y="28" width="6" height="44" rx="3" fill="#fde047"/>'),
        host_milly: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#500724"/><path d="M50,80 C20,60 15,32 35,26 C44,24 50,33 50,33 C50,33 56,24 65,26 C85,32 80,60 50,80 Z" fill="#f43f5e" stroke="#fbcfe8" stroke-width="2.5"/><polygon points="36,22 43,12 50,20 57,12 64,22" fill="#fde047"/>'),
        host_heer: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#3b0764"/><circle cx="50" cy="50" r="26" fill="none" stroke="#f472b6" stroke-width="4" stroke-dasharray="10 6"/><polygon points="50,22 58,42 78,50 58,58 50,78 42,58 22,50 42,42" fill="#e879f9" stroke="#fff" stroke-width="2"/>'),
        host_ishika: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#422006"/><polygon points="50,16 58,38 82,38 62,52 70,76 50,62 30,76 38,52 18,38 42,38" fill="#facc15" stroke="#fff" stroke-width="2"/>'),
        host_izzan: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#450a0a"/><polygon points="50,16 74,56 58,56 66,84 28,46 44,46" fill="#ef4444" stroke="#fde047" stroke-width="2"/>'),
        host_sus: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#052e16"/><rect x="26" y="34" width="48" height="22" rx="11" fill="#4ade80" stroke="#bbf7d0" stroke-width="2"/><circle cx="38" cy="45" r="5" fill="#090d16"/><circle cx="62" cy="45" r="5" fill="#090d16"/><path d="M36,68 Q50,62 64,68" stroke="#4ade80" stroke-width="3" fill="none"/>'),
        host_ruwii: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#4c0519"/><g fill="#fb7185" stroke="#ffe4e6" stroke-width="1.5"><circle cx="50" cy="30" r="14"/><circle cx="69" cy="44" r="14"/><circle cx="62" cy="66" r="14"/><circle cx="38" cy="66" r="14"/><circle cx="31" cy="44" r="14"/></g><circle cx="50" cy="50" r="10" fill="#fde047"/>'),
        host_moon: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#090d16"/><path d="M62,20 A30,30 0 1,0 78,68 A24,24 0 1,1 62,20 Z" fill="#fde047" stroke="#fef9c3" stroke-width="2"/><circle cx="68" cy="34" r="3" fill="#38bdf8"/><circle cx="76" cy="48" r="2.5" fill="#c084fc"/>'),
        host_zaira: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#0f172a"/><circle cx="50" cy="50" r="20" fill="#a855f7" stroke="#e9d5ff" stroke-width="2"/><ellipse cx="50" cy="50" rx="38" ry="11" transform="rotate(-22 50 50)" fill="none" stroke="#38bdf8" stroke-width="3.5"/>'),
        superhost: makeSvgUri('<defs><radialGradient id="gHalo" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff"/><stop offset="45%" stop-color="#fde047"/><stop offset="80%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#090d16"/></radialGradient><linearGradient id="gCrown" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="40%" stop-color="#fde047"/><stop offset="100%" stop-color="#ef4444"/></linearGradient></defs><circle cx="50" cy="50" r="49" fill="url(#gHalo)" stroke="#ffffff" stroke-width="3"/><g stroke="#ffffff" stroke-width="1.5" opacity="0.85"><line x1="50" y1="2" x2="50" y2="98"/><line x1="2" y1="50" x2="98" y2="50"/><line x1="16" y1="16" x2="84" y2="84"/><line x1="84" y1="16" x2="16" y2="84"/></g><circle cx="50" cy="50" r="36" fill="#090d16" stroke="#fde047" stroke-width="2.5"/><path d="M12,48 Q22,30 32,46 Q20,56 12,48 Z M88,48 Q78,30 68,46 Q80,56 88,48 Z" fill="#38bdf8" stroke="#fff" stroke-width="1.5"/><polygon points="22,68 25,30 39,46 50,16 61,46 75,30 78,68" fill="url(#gCrown)" stroke="#ffffff" stroke-width="2.2"/><rect x="22" y="68" width="56" height="10" rx="4" fill="#fde047" stroke="#fff" stroke-width="1.5"/><polygon points="50,42 57,53 50,64 43,53" fill="#38bdf8" stroke="#ffffff" stroke-width="2"/><circle cx="50" cy="13" r="3.5" fill="#ffffff"/>')
      };
      const PREMIUM_AVATARS = [
        { id: 'diamond', img: AVATAR_ART.diamond, name: 'Cyber Diamond', fx: 'av-fx-diamond', req: 'free', badge: '💎 Pure Diamond VIP' },
        { id: 'samurai', img: AVATAR_ART.samurai, name: 'Neon Samurai', fx: 'av-fx-diamond', req: 'free', badge: '👹 Neon Samurai' },
        { id: 'phoenix', img: AVATAR_ART.phoenix, name: 'Phoenix Blaze', fx: 'av-fx-disco', req: 'free', badge: '🔥 Eternal Phoenix' },
        { id: 'ninja', img: AVATAR_ART.ninja, name: 'Void Shinobi', fx: 'av-fx-host', req: 'free', badge: '🥷 Shadow Shinobi' },
        { id: 'astro', img: AVATAR_ART.astro, name: 'Galaxy Astro', fx: 'av-fx-diamond', req: 'free', badge: '🚀 Cosmic Explorer' },
        { id: 'disco', img: AVATAR_ART.disco, name: 'Disco Orb (3 Refs)', fx: 'av-fx-disco', req: 'ref3', badge: '🪩 3-Ref Disco Star' },
        { id: 'girl_butterfly', img: AVATAR_ART.girl_butterfly, name: 'Monarch Queen (3 Refs)', fx: 'av-fx-girlglam', req: 'ref3', badge: '🦋 3-Ref Glam Queen' },
        { id: 'kitsune', img: AVATAR_ART.kitsune, name: 'Cyber Kitsune (3 Refs)', fx: 'av-fx-girlglam', req: 'ref3', badge: '🦊 3-Ref Spirit Fox' },
        { id: 'ref5', img: AVATAR_ART.ref5, name: 'Mecha-Wolf (5 Refs)', fx: 'av-fx-disco', req: 'ref5', badge: '🐺 5-Ref Alpha Wolf' },
        { id: 'girl_blossom', img: AVATAR_ART.girl_blossom, name: 'Sakura Lotus (5 Refs)', fx: 'av-fx-girlglam', req: 'ref5', badge: '🌸 5-Ref Goddess' },
        { id: 'skull', img: AVATAR_ART.skull, name: 'Toxic Reaper (5 Refs)', fx: 'av-fx-disco', req: 'ref5', badge: '💀 5-Ref Bio-Skull' },
        { id: 'lion', img: AVATAR_ART.lion, name: 'Golden Lion (5 Refs)', fx: 'av-fx-superhost', req: 'ref5', badge: '🦁 5-Ref King' },
        { id: 'ref10', img: AVATAR_ART.ref10, name: 'Sky Dragon (10 Refs)', fx: 'av-fx-diamond', req: 'ref10', badge: '🐉 10-Ref Mythic' },
        { id: 'girl_empress', img: AVATAR_ART.girl_empress, name: 'Tiara Empress (10 Refs)', fx: 'av-fx-girlglam', req: 'ref10', badge: '👸 10-Ref Empress' },
        { id: 'reaper', img: AVATAR_ART.reaper, name: 'Soul Scythe (10 Refs)', fx: 'av-fx-host', req: 'ref10', badge: '⚰️ 10-Ref Phantom' },
        { id: 'unicorn', img: AVATAR_ART.unicorn, name: 'Mystic Horn (10 Refs)', fx: 'av-fx-girlglam', req: 'ref10', badge: '🦄 10-Ref Legend' },
        { id: 'superhost', img: AVATAR_ART.superhost, name: 'SAMAKSH GOD', fx: 'av-fx-superhost', req: 'code', badge: '👑 SUPREME CREATOR & GOD-KING' },
        { id: 'host_zoro', img: AVATAR_ART.host_zoro, name: 'Zoro 3-Blade', fx: 'av-fx-host', req: 'code', badge: '⚔️ Official Host: Zoro' },
        { id: 'host_sarah', img: AVATAR_ART.host_sarah, name: 'Sarah Butterfly', fx: 'av-fx-girlglam', req: 'code', badge: '🦋 Official Host: Sarah' },
        { id: 'host_milly', img: AVATAR_ART.host_milly, name: 'Milly Diva', fx: 'av-fx-girlglam', req: 'code', badge: '💖 Official Host: Milly' },
        { id: 'host_heer', img: AVATAR_ART.host_heer, name: 'Heer Nova', fx: 'av-fx-girlglam', req: 'code', badge: '🌸 Official Host: Heer' },
        { id: 'host_ishika', img: AVATAR_ART.host_ishika, name: 'Ishika Star', fx: 'av-fx-girlglam', req: 'code', badge: '✨ Official Host: Ishika' },
        { id: 'host_izzan', img: AVATAR_ART.host_izzan, name: 'Izzan Inferno', fx: 'av-fx-disco', req: 'code', badge: '🔥 Official Host: Izzan' },
        { id: 'host_sus', img: AVATAR_ART.host_sus, name: 'Sus Shadow', fx: 'av-fx-host', req: 'code', badge: '👀 Official Host: Sus' },
        { id: 'host_ruwii', img: AVATAR_ART.host_ruwii, name: 'Ruwii Blossom', fx: 'av-fx-girlglam', req: 'code', badge: '🌺 Official Host: Ruwii' },
        { id: 'host_moon', img: AVATAR_ART.host_moon, name: 'Moon Eclipse', fx: 'av-fx-host', req: 'code', badge: '🌙 Official Host: Moon' },
        { id: 'host_zaira', img: AVATAR_ART.host_zaira, name: 'Zaira Orbit', fx: 'av-fx-diamond', req: 'code', badge: '🪐 Official Host: Zaira' }
      ];

      let myReferralCount = 0;
      let unlockedCodes = JSON.parse(localStorage.getItem('sammu_unlocked_avatars') || '[]');
      let playerAvatarMap = {};

      function getMyCleanName() {
        return (window._savedUname || localStorage.getItem('sammu_username') || localStorage.getItem('username') || '').trim().toLowerCase();
      }

      function isAvatarUnlocked(av) {
        if (av.req === 'free') return true;
        if (av.req === 'ref3') return myReferralCount >= 3;
        if (av.req === 'ref5') return myReferralCount >= 5;
        if (av.req === 'ref10') return myReferralCount >= 10;
        if (av.req === 'code') return unlockedCodes.includes(av.id);
        return false;
      }

      window.copyMyInviteForAvatars = function() {
        const uname = getMyCleanName() || 'player';
        const link = window.location.origin + '/?ref=' + encodeURIComponent(uname);
        if (navigator.clipboard) navigator.clipboard.writeText(link);
        alert('🔗 Referral Link Copied!\\n' + link + '\\n\\nInvite 3, 5, or 10 friends to unlock exclusive HD Avatars!');
      };

      window.redeemAvatarCode = function() {
        const code = (document.getElementById('avSecretCodeInput').value || '').trim();
        if (!code) return;
        if (typeof socket !== 'undefined') socket.emit('verifyAvatarCode', { code });
      };

      window.equipPremiumAvatar = function(av) {
        if (!isAvatarUnlocked(av)) {
          if (av.req === 'ref3') alert('🔒 Bring ' + (3 - myReferralCount) + ' more friends via your referral link!');
          else if (av.req === 'ref5') alert('🔒 Bring ' + (5 - myReferralCount) + ' more friends via your referral link!');
          else if (av.req === 'ref10') alert('🔒 Bring ' + (10 - myReferralCount) + ' more friends via your referral link!');
          else alert('🔐 Locked! Enter the secret Host Avatar code below.');
          return;
        }
        localStorage.setItem('sammu_avatar', av.img);
        localStorage.setItem('avatar', av.img);
        localStorage.setItem('sammu_avatar_fx', av.fx);
        window._savedAvatar = av.img;
        const uname = window._savedUname || localStorage.getItem('sammu_username') || localStorage.getItem('username') || 'Player';
        if (typeof socket !== 'undefined') {
          socket.emit('equipAvatarFx', { avatar: av.img, fx: av.fx, badge: av.badge });
          socket.emit('joinRoom', { username: uname, avatar: av.img, deviceId: localStorage.getItem('sammu_dev_uid') || '', isReconnect: true });
        }
        document.getElementById('avatarVaultModal').style.display = 'none';
      };

      window.renderAvatarVault = function() {
        const grid = document.getElementById('avVaultGrid');
        const stats = document.getElementById('avRefStats');
        if (stats) stats.textContent = '🔗 Referrals: ' + myReferralCount + ' | 27 HD Vector Avatars';
        if (!grid) return;
        grid.innerHTML = '';

        const ordered = [
          ...PREMIUM_AVATARS.filter(a => a.id === 'superhost'),
          ...PREMIUM_AVATARS.filter(a => a.id !== 'superhost')
        ];

        ordered.forEach(av => {
          const unlocked = isAvatarUnlocked(av);
          const isGod = av.id === 'superhost';
          const card = document.createElement('div');
          card.className = 'av-item' + (unlocked ? '' : ' locked');
          if (isGod) {
            card.style.cssText = 'grid-column: 1 / -1; background: linear-gradient(135deg, rgba(250,204,21,0.28), rgba(239,68,68,0.25), rgba(56,189,248,0.28)); border: 2px solid #fde047; box-shadow: 0 0 22px rgba(250,204,21,0.55); padding: 11px;';
          }
          card.innerHTML =
            '<div class="av-art-circle ' + av.fx + '" style="' + (isGod ? 'width:68px;height:68px;' : '') + '"><img src="' + av.img + '" alt="' + av.name + '"></div>' +
            '<div style="font-weight:900;font-size:' + (isGod ? '13px;color:#fde047;text-shadow:0 0 8px #f59e0b;' : '10px;') + '">' + (isGod ? '⚡👑 SAMAKSH MYTHIC GOD-KING 👑⚡' : av.name) + '</div>' +
            '<div style="font-size:10px;color:' + (unlocked ? '#4ade80' : '#f87171') + ';margin-top:2px;font-weight:bold;">' + (unlocked ? '✅ Tap to Equip' : '🔒 Locked') + '</div>';
          card.onclick = () => window.equipPremiumAvatar(av);
          grid.appendChild(card);
        });
      };

      window.openAvatarPreview = function(name, avatarHtml, fxClass, badgeText) {
        const circle = document.getElementById('avPreviewCircle');
        circle.className = fxClass || '';
        circle.innerHTML = avatarHtml || '🥷';
        document.getElementById('avPreviewName').textContent = name || 'Player';
        document.getElementById('avPreviewBadge').textContent = badgeText || '🎮 Arena Player';
        document.getElementById('avatarPreviewModal').style.display = 'flex';
      };
      function enhanceChatAndAvatars() {
        document.querySelectorAll('span, div, p, b, strong').forEach(el => {
          if (el.children.length === 0) {
            const t = (el.textContent || '').trim();
            if (t.startsWith('data:image/svg+xml') || t.startsWith('data:image/png') || t.startsWith('data:image/jpeg')) {
              el.innerHTML = '<img src="' + t + '" style="width:28px;height:28px;border-radius:50%;vertical-align:middle;object-fit:cover;">';
            }
          }
        });

        const chatBox = document.querySelector('#chatBox, #messages, .chat-messages, [id*="chat"]');
        if (chatBox) {
          Array.from(chatBox.children).forEach(msgEl => {
            if (msgEl.dataset.glowChecked) return;
            const rawTxt = (msgEl.textContent || '').toLowerCase();
            if (!rawTxt.trim()) return;
            msgEl.dataset.glowChecked = 'true';

            const isSamakshMsg = /\b(samaksh|sammu)\s*:/.test(rawTxt) ||
              rawTxt.startsWith('samaksh') || rawTxt.startsWith('sammu');

            if (isSamakshMsg) {
              msgEl.classList.add('chat-glow-samaksh');
            } else {
              const vipUser = Object.keys(playerAvatarMap).find(u => u.length >= 2 && rawTxt.includes(u + ':'));
              if (vipUser) msgEl.classList.add('chat-glow-vip');
            }
          });
        }

        document.querySelectorAll('img').forEach(el => {
          if (el.dataset.avEnhanced) return;
          if (el.src && el.src.startsWith('data:image') && el.offsetWidth >= 18 && el.offsetWidth <= 72) {
            el.dataset.avEnhanced = 'true';
            el.style.cursor = 'pointer';
            el.style.borderRadius = '50%';
            el.style.objectFit = 'cover';

            const parentText = (el.parentElement ? el.parentElement.textContent : '') || '';
            const matchedUser = Object.keys(playerAvatarMap).find(u => parentText.toLowerCase().includes(u));
            const info = matchedUser ? playerAvatarMap[matchedUser] : null;
            if (info && info.fx) el.classList.add(info.fx);
            else if (parentText.toLowerCase().includes('samaksh') || parentText.toLowerCase().includes('sammu')) {
              el.classList.add('av-fx-superhost');
            } else {
              el.classList.add('av-fx-diamond');
            }

            el.onclick = function(e) {
              e.stopPropagation();
              const html = '<img src="' + el.src + '" style="width:100px;height:100px;border-radius:50%;object-fit:cover;">';
              window.openAvatarPreview(info ? info.name : 'Arena Player', html, info ? info.fx : el.className, info ? info.badge : '✨ HD Vector Avatar');
            };
          }
        });
      }
      setInterval(enhanceChatAndAvatars, 450);

      function initAvatarVaultButton() {
        if (!document.getElementById('openAvatarVaultBtn')) {
          const anchor = document.getElementById('openPhonkDjBtn') || document.getElementById('openChefBtn') ||
            Array.from(document.querySelectorAll('button, a, div[onclick]')).find(el => el.children.length === 0 && /jam|🎹/i.test(el.textContent || ''));
          if (anchor && anchor.parentNode) {
            const btn = anchor.cloneNode(true);
            btn.id = 'openAvatarVaultBtn'; btn.removeAttribute('onclick'); btn.textContent = '👑 Avatars';
            btn.onclick = (e) => {
              e.preventDefault(); e.stopPropagation();
              if (typeof socket !== 'undefined') socket.emit('getMyAvatarStats', { username: getMyCleanName() });
              window.renderAvatarVault();
              document.getElementById('avatarVaultModal').style.display = 'flex';
            };
            anchor.parentNode.insertBefore(btn, anchor.nextSibling);
          }
        }
        if (typeof socket !== 'undefined' && !window._avVaultBound) {
          window._avVaultBound = true;
          socket.on('avatarStatsData', (d) => {
            if (d && typeof d.refs === 'number') myReferralCount = d.refs;
            if (d && d.avatarMap) playerAvatarMap = d.avatarMap;
            window.renderAvatarVault();
            enhanceChatAndAvatars();
          });
          socket.on('avatarCodeResult', (res) => {
            if (res && res.ok && res.avatarId) {
              if (!unlockedCodes.includes(res.avatarId)) {
                unlockedCodes.push(res.avatarId);
                localStorage.setItem('sammu_unlocked_avatars', JSON.stringify(unlockedCodes));
              }
              alert('🎉 Unlocked: ' + res.name + '!');
              window.renderAvatarVault();
            } else {
              alert('❌ Invalid Avatar Code!');
            }
          });
        }
      }

      window.addEventListener('DOMContentLoaded', () => { initAvatarVaultButton(); setTimeout(initAvatarVaultButton, 1200); });
    })();
    </script>
    `;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>')) {
                body = body.replace('</body>', PREMIUM_AVATAR_CSS_HTML + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });

    const HOST_AVATAR_CODES = {
        "#sammuadmin#bhaicharaontop": { id: "superhost", name: "👑 SAMAKSH MYTHIC GOD-KING" },
        "#zoro#pirateking":          { id: "host_zoro", name: "⚔️ Zoro 3-Blade" },
        "#sarah#butterfly":          { id: "host_sarah", name: "🦋 Sarah Butterfly" },
        "#milly#queen":              { id: "host_milly", name: "💖 Milly Diva" },
        "#heer#bloom":               { id: "host_heer", name: "🌸 Heer Nova" },
        "#ishika#star":              { id: "host_ishika", name: "✨ Ishika Star" },
        "#izzan#fire":               { id: "host_izzan", name: "🔥 Izzan Inferno" },
        "#sus#bunker":               { id: "host_sus", name: "👀 Sus Shadow" },
        "#ruwii#garden":             { id: "host_ruwii", name: "🌺 Ruwii Blossom" },
        "#moon#eclipse":             { id: "host_moon", name: "🌙 Moon Eclipse" },
        "#zaira#orbit":              { id: "host_zaira", name: "🪐 Zaira Orbit" }
    };

    const EXTRA_IMPOSTOR_WORDS = [
        "NARUTO", "GOKU", "LUFFY", "GOJO", "ITACHI", "ZORO", "PIKACHU", "SUKUNA", "LEVI", "TANJIRO",
        "MINECRAFT", "BGMI", "VALORANT", "ROBLOX", "FREE FIRE", "GTA", "CHESS", "LUDO", "CRICKET", "FOOTBALL",
        "BIRYANI", "MOMOS", "PANI PURI", "PIZZA", "BURGER", "SAMOSA", "MAGGI", "CHOCOLATE", "ICE CREAM", "MANGO",
        "IPHONE", "LAPTOP", "HEADPHONES", "SMARTWATCH", "PLAYSTATION", "CAMERA", "DRONE", "ROCKET", "SATELLITE", "ROBOT",
        "TAJ MAHAL", "EIFFEL TOWER", "MARS", "MOON", "EVEREST", "OCEAN", "VOLCANO", "PYRAMID", "JUNGLE", "DESERT",
        "SHAH RUKH KHAN", "VIRAT KOHLI", "MS DHONI", "RONALDO", "MESSI", "IRON MAN", "SPIDERMAN", "BATMAN", "THOR", "JOKER",
        "SHOLAY", "DANGAL", "BAHUBALI", "PUSHPA", "KGF", "3 IDIOTS", "STREE", "DHOOM", "KRRISH", "AVENGERS"
    ];

    const globalAvatarMap = {};
    const userReferralsDB = {};

    io.on('connection', (socket) => {
        socket.on('registerReferral', ({ refOwner, deviceId }) => {
            if (!refOwner || !deviceId) return;
            const cleanRef = refOwner.trim().toLowerCase();
            if (!userReferralsDB[cleanRef]) userReferralsDB[cleanRef] = new Set();
            userReferralsDB[cleanRef].add(String(deviceId));
        });

        socket.on('getMyAvatarStats', (data) => {
            const uname = ((data && data.username) || socket.username || '').trim().toLowerCase();
            let refs = userReferralsDB[uname] ? userReferralsDB[uname].size : 0;
            if (uname) {
                const srv = Object.values(serversDB).find(s => s.owner && s.owner.toLowerCase() === uname && Array.isArray(s.allTimeDevices));
                if (srv && srv.allTimeDevices.length > refs) refs = srv.allTimeDevices.length;
            }
            socket.emit('avatarStatsData', { refs, avatarMap: globalAvatarMap });
        });

        socket.on('verifyAvatarCode', (data) => {
            const code = ((data && data.code) || '').trim().toLowerCase();
            const found = HOST_AVATAR_CODES[code];
            if (found) {
                socket.emit('avatarCodeResult', { ok: true, avatarId: found.id, name: found.name });
            } else {
                socket.emit('avatarCodeResult', { ok: false });
            }
        });

        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload !== null) ? payload.text : payload;
            if (!raw || typeof raw !== 'string') return;
            const code = raw.trim().toLowerCase();
            const found = HOST_AVATAR_CODES[code];
            if (found) {
                socket.emit('avatarCodeResult', { ok: true, avatarId: found.id, name: found.name });
                socket.emit('message', {
                    username: 'SYSTEM',
                    text: `👑 **SECRET UNLOCKED:** **${found.name}** is now unlocked in your **👑 Avatars** Vault!`,
                    _serverId: socket.activeServerId
                });
            }
        });

        socket.on('equipAvatarFx', (data) => {
            const uname = (socket.username || '').trim().toLowerCase();
            if (!uname || !data) return;
            globalAvatarMap[uname] = { name: socket.username, fx: data.fx || '', badge: data.badge || '' };
            if (socket.activeServerId) {
                io.to(socket.activeServerId).emit('avatarStatsData', { avatarMap: globalAvatarMap });
            }
        });

        const origSocketEmit = socket.emit.bind(socket);
        socket.emit = function(ev, payload, ...rest) {
            if (payload && typeof payload === 'object') {
                if (typeof payload.impostorWord === 'string') {
                    payload.impostorWord = EXTRA_IMPOSTOR_WORDS.at(Math.floor(Math.random() * EXTRA_IMPOSTOR_WORDS.length));
                }
                if (typeof payload.secretWord === 'string' && ev.toLowerCase().includes('impostor')) {
                    payload.secretWord = EXTRA_IMPOSTOR_WORDS.at(Math.floor(Math.random() * EXTRA_IMPOSTOR_WORDS.length));
                }
            }
            return origSocketEmit(ev, payload, ...rest);
        };
    });
    // === END PREMIUM AVATAR VAULT v5 ===.
     // === SELF-OVERWRITING HD AVATAR VAULT v6 (PASTE AT VERY END BEFORE };) ===
    const AVATAR_VAULT_V6_HTML = `
    <style id="avVaultV6Style">
      @keyframes discoPulseV6 {
        0% { box-shadow: 0 0 12px #ff0080, inset 0 0 8px #ff0080; border-color: #ff0080; filter: hue-rotate(0deg); }
        50% { box-shadow: 0 0 20px #00f0ff, inset 0 0 10px #00f0ff; border-color: #00f0ff; filter: hue-rotate(180deg); }
        100% { box-shadow: 0 0 12px #ff0080, inset 0 0 8px #ff0080; border-color: #ff0080; filter: hue-rotate(360deg); }
      }
      @keyframes diamondShineV6 {
        0%, 100% { box-shadow: 0 0 14px #38bdf8, 0 0 24px #bae6fd; border-color: #7dd3fc; transform: scale(1); }
        50% { box-shadow: 0 0 22px #ffffff, 0 0 32px #38bdf8; border-color: #ffffff; transform: scale(1.06); }
      }
      @keyframes girlGlamGlowV6 {
        0%, 100% { box-shadow: 0 0 14px #f472b6, 0 0 24px #e879f9; border-color: #f9a8d4; transform: scale(1); }
        50% { box-shadow: 0 0 22px #fda4af, 0 0 32px #d946ef; border-color: #ffffff; transform: scale(1.06); }
      }
      @keyframes superHostAuraV6 {
        0% { box-shadow: 0 0 18px #fde047, 0 0 34px #f59e0b, 0 0 50px #ef4444, inset 0 0 12px #fef08a; border-color: #ffffff; transform: scale(1.04); }
        33% { box-shadow: 0 0 22px #38bdf8, 0 0 40px #a855f7, 0 0 58px #fde047, inset 0 0 14px #bae6fd; border-color: #fde047; transform: scale(1.1); }
        66% { box-shadow: 0 0 22px #f43f5e, 0 0 40px #fde047, 0 0 58px #38bdf8, inset 0 0 14px #fecdd3; border-color: #38bdf8; transform: scale(1.06); }
        100% { box-shadow: 0 0 18px #fde047, 0 0 34px #f59e0b, 0 0 50px #ef4444, inset 0 0 12px #fef08a; border-color: #ffffff; transform: scale(1.04); }
      }
      @keyframes samakshChatGlowV6 {
        0% { background-position: 0% 50%; box-shadow: 0 0 18px rgba(250,204,21,0.95), 0 0 34px rgba(245,158,11,0.65), inset 0 0 14px rgba(254,240,138,0.5); border-color: #fde047; }
        50% { background-position: 100% 50%; box-shadow: 0 0 28px rgba(56,189,248,0.98), 0 0 44px rgba(236,72,153,0.8), inset 0 0 18px rgba(255,255,255,0.55); border-color: #ffffff; }
        100% { background-position: 0% 50%; box-shadow: 0 0 18px rgba(250,204,21,0.95), 0 0 34px rgba(245,158,11,0.65), inset 0 0 14px rgba(254,240,138,0.5); border-color: #fde047; }
      }

      .av-fx-disco { animation: discoPulseV6 2.2s linear infinite !important; border: 2px solid #ff0080 !important; border-radius: 50% !important; }
      .av-fx-diamond { animation: diamondShineV6 2s ease-in-out infinite !important; border: 2px solid #7dd3fc !important; border-radius: 50% !important; }
      .av-fx-girlglam { animation: girlGlamGlowV6 2s ease-in-out infinite !important; border: 2px solid #f9a8d4 !important; border-radius: 50% !important; }
      .av-fx-superhost { animation: superHostAuraV6 1.2s ease-in-out infinite !important; border: 3px solid #ffffff !important; border-radius: 50% !important; z-index: 5; }
      .av-fx-host { box-shadow: 0 0 14px #a855f7 !important; border: 2px solid #c084fc !important; border-radius: 50% !important; }

      .chat-glow-samaksh {
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
        background: linear-gradient(120deg, rgba(250,204,21,0.38), rgba(239,68,68,0.34), rgba(168,85,247,0.36), rgba(56,189,248,0.38)) !important;
        background-size: 250% 250% !important;
        border: 2px solid #fde047 !important;
        border-radius: 16px !important;
        padding: 9px 13px !important;
        margin: 6px 0 !important;
        animation: samakshChatGlowV6 1.8s ease-in-out infinite !important;
        color: #ffffff !important;
        font-weight: 800 !important;
        text-shadow: 0 0 10px #fde047, 0 0 18px #f59e0b !important;
      }
      .chat-glow-samaksh * { color: #ffffff !important; text-shadow: 0 0 8px #fde047, 0 0 16px #38bdf8 !important; }
      .chat-glow-vip {
        background: linear-gradient(135deg, rgba(56,189,248,0.16), rgba(168,85,247,0.18)) !important;
        border: 1px solid #38bdf8 !important;
        border-radius: 12px !important;
        padding: 6px 10px !important;
        margin: 4px 0 !important;
        box-shadow: 0 0 12px rgba(56,189,248,0.35) !important;
      }

      #avatarVaultModalV6, #avatarPreviewModalV6 { display:none; position:fixed; inset:0; background:rgba(5,8,20,0.93); z-index:999999; align-items:center; justify-content:center; backdrop-filter:blur(10px); font-family:inherit; padding:12px; }
      #avatarVaultCardV6, #avatarPreviewCardV6 { background:linear-gradient(155deg,#0f172a,#1e1b4b); border:2px solid #38bdf8; border-radius:22px; padding:16px; width:100%; max-width:440px; color:#fff; text-align:center; box-shadow:0 0 35px rgba(56,189,248,0.45); max-height:90vh; overflow-y:auto; }
      .av-grid-v6 { display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin:10px 0; }
      .av-item-v6 { background:rgba(255,255,255,0.06); border:1.5px solid rgba(56,189,248,0.35); border-radius:14px; padding:8px 5px; cursor:pointer; transition:0.15s; }
      .av-item-v6:hover { background:rgba(56,189,248,0.18); transform:translateY(-2px); }
      .av-item-v6.locked { opacity:0.65; border-color:#64748b; }
      .av-art-circle-v6 { width:52px; height:52px; margin:0 auto 5px auto; display:flex; align-items:center; justify-content:center; border-radius:50%; background:radial-gradient(circle at 30% 30%, #1e293b, #020617); overflow:hidden; }
      .av-art-circle-v6 img { width:100%; height:100%; display:block; }
    </style>

    <div id="avatarVaultModalV6">
      <div id="avatarVaultCardV6">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:900;font-size:15px;color:#38bdf8;">👑 27 HD AVATAR VAULT</span>
          <button onclick="document.getElementById('avatarVaultModalV6').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:8px;padding:4px 10px;font-weight:bold;cursor:pointer;">✕</button>
        </div>
        <div id="avRefStatsV6" style="font-size:11px;color:#fde047;margin:6px 0;font-weight:bold;">🔗 Your Referrals: 0 | Unlock HD Avatars at 3, 5 & 10 Refs!</div>
        <div class="av-grid-v6" id="avVaultGridV6"></div>
        <div style="display:flex;gap:6px;margin-top:8px;">
          <input id="avSecretCodeInputV6" placeholder="Enter Host Avatar Code..." style="flex:1;padding:8px;border-radius:10px;border:1.5px solid #c084fc;background:#090d16;color:#fff;font-size:12px;">
          <button onclick="redeemAvatarCode()" style="background:linear-gradient(90deg,#a855f7,#ec4899);border:none;color:#fff;border-radius:10px;padding:8px 12px;font-weight:bold;font-size:12px;cursor:pointer;">🔓 Unlock</button>
        </div>
        <button onclick="copyMyInviteForAvatars()" style="width:100%;margin-top:8px;padding:9px;border:none;border-radius:10px;background:linear-gradient(90deg,#059669,#10b981);color:#fff;font-weight:900;font-size:12px;cursor:pointer;">🔗 Copy My Referral Link (3, 5 & 10 Refs)</button>
      </div>
    </div>

    <div id="avatarPreviewModalV6" onclick="this.style.display='none'">
      <div id="avatarPreviewCardV6" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:900;font-size:14px;color:#7dd3fc;">🔍 PLAYER AVATAR PROFILE</span>
          <button onclick="document.getElementById('avatarPreviewModalV6').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:8px;padding:3px 9px;font-weight:bold;cursor:pointer;">✕</button>
        </div>
        <div id="avPreviewCircleV6" style="width:104px;height:104px;margin:14px auto;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#090d16;"></div>
        <div id="avPreviewNameV6" style="font-size:18px;font-weight:900;color:#fff;">Player</div>
        <div id="avPreviewBadgeV6" style="font-size:12px;color:#fde047;margin-top:4px;font-weight:bold;">Standard Member</div>
      </div>
    </div>
    <script>
    (function() {
      ['avatarVaultModal', 'avatarPreviewModal'].forEach(oldId => {
        const oldEl = document.getElementById(oldId);
        if (oldEl) oldEl.remove();
      });

      function makeSvgUri(innerSvg) {
        const full = '<svg xmlns="http://w3.org" viewBox="0 0 100 100">' + innerSvg + '</svg>';
        return 'data:image/svg+xml;utf8,' + encodeURIComponent(full);
      }

      const AVATAR_ART = {
        diamond: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#082f49"/><polygon points="50,14 82,38 50,86 18,38" fill="#38bdf8" stroke="#fff" stroke-width="2.5"/><polyline points="18,38 50,48 82,38" fill="none" stroke="#e0f2fe" stroke-width="2"/><line x1="50" y1="14" x2="50" y2="86" stroke="#bae6fd" stroke-width="1.8"/>'),
        samurai: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#1e1b4b"/><path d="M22,55 C22,28 78,28 78,55 L70,76 L30,76 Z" fill="#dc2626" stroke="#facc15" stroke-width="2.5"/><polygon points="50,14 56,30 74,24 60,36 50,32 40,36 26,24 44,30" fill="#facc15"/><rect x="32" y="48" width="36" height="8" rx="3" fill="#090d16"/><circle cx="40" cy="52" r="2.5" fill="#38bdf8"/><circle cx="60" cy="52" r="2.5" fill="#38bdf8"/>'),
        phoenix: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#450a0a"/><path d="M50,16 C65,30 82,34 76,58 C70,74 56,82 50,86 C44,82 30,74 24,58 C18,34 35,30 50,16 Z" fill="#f97316" stroke="#fde047" stroke-width="2"/><path d="M50,30 C60,42 66,52 50,74 C34,52 40,42 50,30 Z" fill="#facc15"/>'),
        ninja: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#090d16"/><circle cx="50" cy="52" r="30" fill="#1e293b" stroke="#64748b" stroke-width="2"/><rect x="24" y="42" width="52" height="14" rx="5" fill="#020617"/><polygon points="34,47 45,50 35,52" fill="#ef4444"/><polygon points="66,47 55,50 65,52" fill="#ef4444"/><path d="M74,46 L88,38 L84,50 L90,56 L74,52 Z" fill="#ef4444"/>'),
        astro: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#0f172a"/><circle cx="50" cy="52" r="32" fill="#e2e8f0" stroke="#38bdf8" stroke-width="3"/><rect x="30" y="38" width="40" height="24" rx="10" fill="#0284c7" stroke="#bae6fd" stroke-width="2"/><path d="M35,43 Q45,40 52,43" stroke="#fff" stroke-width="2.5" fill="none"/>'),
        disco: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#1e1b4b"/><circle cx="50" cy="52" r="32" fill="#ec4899" stroke="#f0abfc" stroke-width="2"/><path d="M22,52 H78 M26,38 H74 M26,66 H74 M50,20 V84 M35,23 V81 M65,23 V81" stroke="#fff" stroke-width="1.4" opacity="0.8"/><polygon points="50,6 54,16 64,16 56,22 59,31 50,25 41,31 44,22 36,16 46,16" fill="#fde047"/>'),
        girl_butterfly: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#2e1065"/><path d="M48,50 C25,18 10,35 24,54 C12,68 28,84 48,60 Z" fill="#f472b6" stroke="#fbcfe8" stroke-width="2"/><path d="M52,50 C75,18 90,35 76,54 C88,68 72,84 52,60 Z" fill="#a855f7" stroke="#fbcfe8" stroke-width="2"/><rect x="47" y="30" width="6" height="42" rx="3" fill="#fde047"/>'),
        kitsune: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#311042"/><polygon points="24,18 38,42 20,52" fill="#f8fafc" stroke="#f43f5e" stroke-width="2"/><polygon points="76,18 62,42 80,52" fill="#f8fafc" stroke="#f43f5e" stroke-width="2"/><polygon points="50,84 22,50 36,34 50,40 64,34 78,50" fill="#ffffff" stroke="#f43f5e" stroke-width="2.5"/><path d="M32,54 L44,58 M68,54 L56,58 M42,68 L50,74 L58,68" stroke="#f43f5e" stroke-width="2.5" fill="none"/>'),
        ref5: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#450a0a"/><polygon points="24,22 36,44 20,54" fill="#fb923c" stroke="#fde047" stroke-width="2"/><polygon points="76,22 64,44 80,54" fill="#fb923c" stroke="#fde047" stroke-width="2"/><polygon points="50,84 22,52 34,34 50,42 66,34 78,52" fill="#1f2937" stroke="#f97316" stroke-width="2.5"/><polygon points="36,52 44,56 38,60" fill="#facc15"/><polygon points="64,52 56,56 62,60" fill="#facc15"/>'),
        girl_blossom: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#4c0519"/><g fill="#f472b6" stroke="#fbcfe8" stroke-width="1.5"><ellipse cx="50" cy="26" rx="11" ry="18"/><ellipse cx="50" cy="74" rx="11" ry="18"/><ellipse cx="26" cy="50" rx="18" ry="11"/><ellipse cx="74" cy="50" rx="18" ry="11"/><ellipse cx="33" cy="33" rx="14" ry="14"/><ellipse cx="67" cy="67" rx="14" ry="14"/><ellipse cx="67" cy="33" rx="14" ry="14"/><ellipse cx="33" cy="67" rx="14" ry="14"/></g><circle cx="50" cy="50" r="13" fill="#fde047"/>'),
        skull: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#052e16"/><path d="M28,48 C28,24 72,24 72,48 C72,60 64,65 62,76 L38,76 C36,65 28,60 28,48 Z" fill="#4ade80" stroke="#bbf7d0" stroke-width="2"/><circle cx="39" cy="48" r="6" fill="#052e16"/><circle cx="61" cy="48" r="6" fill="#052e16"/><line x1="44" y1="68" x2="44" y2="76" stroke="#052e16" stroke-width="2.5"/><line x1="50" y1="68" x2="50" y2="76" stroke="#052e16" stroke-width="2.5"/><line x1="56" y1="68" x2="56" y2="76" stroke="#052e16" stroke-width="2.5"/>'),
        lion: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#422006"/><circle cx="50" cy="52" r="34" fill="#d97706" stroke="#fde047" stroke-width="2.5"/><polygon points="50,76 30,52 36,34 50,38 64,34 70,52" fill="#fef08a"/><polygon points="45,58 55,58 50,64" fill="#78350f"/><circle cx="41" cy="47" r="3" fill="#090d16"/><circle cx="59" cy="47" r="3" fill="#090d16"/>'),
        ref10: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#042f2e"/><path d="M25,70 C20,40 40,20 68,26 C55,34 54,44 74,48 C62,58 58,72 42,78 Z" fill="#34d399" stroke="#a7f3d0" stroke-width="2"/><circle cx="54" cy="34" r="3.5" fill="#fef08a"/><polygon points="28,26 42,32 34,40" fill="#fde047"/>'),
        girl_empress: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#3b0764"/><polygon points="20,68 24,34 38,50 50,24 62,50 76,34 80,68" fill="#fde047" stroke="#fff" stroke-width="2"/><rect x="20" y="68" width="60" height="10" rx="4" fill="#ec4899"/><circle cx="50" cy="52" r="5" fill="#38bdf8"/>'),
        reaper: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#090d16"/><path d="M26,76 C26,34 74,34 74,76 Z" fill="#1e293b" stroke="#94a3b8" stroke-width="2"/><ellipse cx="50" cy="54" rx="14" ry="18" fill="#020617"/><circle cx="45" cy="52" r="2.5" fill="#38bdf8"/><circle cx="55" cy="52" r="2.5" fill="#38bdf8"/><path d="M20,24 Q65,12 82,36" stroke="#e2e8f0" stroke-width="4" fill="none"/>'),
        unicorn: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#4a044e"/><polygon points="50,12 44,36 56,36" fill="#fde047" stroke="#fff" stroke-width="1.5"/><path d="M32,74 C28,46 42,32 62,38 C74,42 74,62 60,74 Z" fill="#f8fafc" stroke="#f472b6" stroke-width="2.5"/><circle cx="56" cy="48" r="3" fill="#a855f7"/>'),
        host_zoro: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#052e16"/><line x1="20" y1="80" x2="80" y2="20" stroke="#e2e8f0" stroke-width="6" stroke-linecap="round"/><line x1="20" y1="20" x2="80" y2="80" stroke="#4ade80" stroke-width="6" stroke-linecap="round"/><line x1="50" y1="14" x2="50" y2="86" stroke="#facc15" stroke-width="5" stroke-linecap="round"/><circle cx="50" cy="50" r="12" fill="#14532d" stroke="#4ade80" stroke-width="3"/>'),
        host_sarah: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#1e1b4b"/><path d="M48,50 C22,16 8,36 24,56 C10,70 28,86 48,60 Z" fill="#38bdf8" stroke="#e0f2fe" stroke-width="2"/><path d="M52,50 C78,16 92,36 76,56 C90,70 72,86 52,60 Z" fill="#c084fc" stroke="#f3e8ff" stroke-width="2"/><rect x="47" y="28" width="6" height="44" rx="3" fill="#fde047"/>'),
        host_milly: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#500724"/><path d="M50,80 C20,60 15,32 35,26 C44,24 50,33 50,33 C50,33 56,24 65,26 C85,32 80,60 50,80 Z" fill="#f43f5e" stroke="#fbcfe8" stroke-width="2.5"/><polygon points="36,22 43,12 50,20 57,12 64,22" fill="#fde047"/>'),
        host_heer: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#3b0764"/><circle cx="50" cy="50" r="26" fill="none" stroke="#f472b6" stroke-width="4" stroke-dasharray="10 6"/><polygon points="50,22 58,42 78,50 58,58 50,78 42,58 22,50 42,42" fill="#e879f9" stroke="#fff" stroke-width="2"/>'),
        host_ishika: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#422006"/><polygon points="50,16 58,38 82,38 62,52 70,76 50,62 30,76 38,52 18,38 42,38" fill="#facc15" stroke="#fff" stroke-width="2"/>'),
        host_izzan: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#450a0a"/><polygon points="50,16 74,56 58,56 66,84 28,46 44,46" fill="#ef4444" stroke="#fde047" stroke-width="2"/>'),
        host_sus: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#052e16"/><rect x="26" y="34" width="48" height="22" rx="11" fill="#4ade80" stroke="#bbf7d0" stroke-width="2"/><circle cx="38" cy="45" r="5" fill="#090d16"/><circle cx="62" cy="45" r="5" fill="#090d16"/><path d="M36,68 Q50,62 64,68" stroke="#4ade80" stroke-width="3" fill="none"/>'),
        host_ruwii: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#4c0519"/><g fill="#fb7185" stroke="#ffe4e6" stroke-width="1.5"><circle cx="50" cy="30" r="14"/><circle cx="69" cy="44" r="14"/><circle cx="62" cy="66" r="14"/><circle cx="38" cy="66" r="14"/><circle cx="31" cy="44" r="14"/></g><circle cx="50" cy="50" r="10" fill="#fde047"/>'),
        host_moon: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#090d16"/><path d="M62,20 A30,30 0 1,0 78,68 A24,24 0 1,1 62,20 Z" fill="#fde047" stroke="#fef9c3" stroke-width="2"/><circle cx="68" cy="34" r="3" fill="#38bdf8"/><circle cx="76" cy="48" r="2.5" fill="#c084fc"/>'),
        host_zaira: makeSvgUri('<circle cx="50" cy="50" r="48" fill="#0f172a"/><circle cx="50" cy="50" r="20" fill="#a855f7" stroke="#e9d5ff" stroke-width="2"/><ellipse cx="50" cy="50" rx="38" ry="11" transform="rotate(-22 50 50)" fill="none" stroke="#38bdf8" stroke-width="3.5"/>'),
        superhost: makeSvgUri('<defs><radialGradient id="gHalo" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff"/><stop offset="45%" stop-color="#fde047"/><stop offset="80%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#090d16"/></radialGradient><linearGradient id="gCrown" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="40%" stop-color="#fde047"/><stop offset="100%" stop-color="#ef4444"/></linearGradient></defs><circle cx="50" cy="50" r="49" fill="url(#gHalo)" stroke="#ffffff" stroke-width="3"/><g stroke="#ffffff" stroke-width="1.5" opacity="0.85"><line x1="50" y1="2" x2="50" y2="98"/><line x1="2" y1="50" x2="98" y2="50"/><line x1="16" y1="16" x2="84" y2="84"/><line x1="84" y1="16" x2="16" y2="84"/></g><circle cx="50" cy="50" r="36" fill="#090d16" stroke="#fde047" stroke-width="2.5"/><path d="M12,48 Q22,30 32,46 Q20,56 12,48 Z M88,48 Q78,30 68,46 Q80,56 88,48 Z" fill="#38bdf8" stroke="#fff" stroke-width="1.5"/><polygon points="22,68 25,30 39,46 50,16 61,46 75,30 78,68" fill="url(#gCrown)" stroke="#ffffff" stroke-width="2.2"/><rect x="22" y="68" width="56" height="10" rx="4" fill="#fde047" stroke="#fff" stroke-width="1.5"/><polygon points="50,42 57,53 50,64 43,53" fill="#38bdf8" stroke="#ffffff" stroke-width="2"/><circle cx="50" cy="13" r="3.5" fill="#ffffff"/>')
      };
      const PREMIUM_AVATARS = [
        { id: 'diamond', img: AVATAR_ART.diamond, name: 'Cyber Diamond', fx: 'av-fx-diamond', req: 'free', badge: '💎 Pure Diamond VIP' },
        { id: 'samurai', img: AVATAR_ART.samurai, name: 'Neon Samurai', fx: 'av-fx-diamond', req: 'free', badge: '👹 Neon Samurai' },
        { id: 'phoenix', img: AVATAR_ART.phoenix, name: 'Phoenix Blaze', fx: 'av-fx-disco', req: 'free', badge: '🔥 Eternal Phoenix' },
        { id: 'ninja', img: AVATAR_ART.ninja, name: 'Void Shinobi', fx: 'av-fx-host', req: 'free', badge: '🥷 Shadow Shinobi' },
        { id: 'astro', img: AVATAR_ART.astro, name: 'Galaxy Astro', fx: 'av-fx-diamond', req: 'free', badge: '🚀 Cosmic Explorer' },
        { id: 'disco', img: AVATAR_ART.disco, name: 'Disco Orb (3 Refs)', fx: 'av-fx-disco', req: 'ref3', badge: '🪩 3-Ref Disco Star' },
        { id: 'girl_butterfly', img: AVATAR_ART.girl_butterfly, name: 'Monarch Queen (3 Refs)', fx: 'av-fx-girlglam', req: 'ref3', badge: '🦋 3-Ref Glam Queen' },
        { id: 'kitsune', img: AVATAR_ART.kitsune, name: 'Cyber Kitsune (3 Refs)', fx: 'av-fx-girlglam', req: 'ref3', badge: '🦊 3-Ref Spirit Fox' },
        { id: 'ref5', img: AVATAR_ART.ref5, name: 'Mecha-Wolf (5 Refs)', fx: 'av-fx-disco', req: 'ref5', badge: '🐺 5-Ref Alpha Wolf' },
        { id: 'girl_blossom', img: AVATAR_ART.girl_blossom, name: 'Sakura Lotus (5 Refs)', fx: 'av-fx-girlglam', req: 'ref5', badge: '🌸 5-Ref Goddess' },
        { id: 'skull', img: AVATAR_ART.skull, name: 'Toxic Reaper (5 Refs)', fx: 'av-fx-disco', req: 'ref5', badge: '💀 5-Ref Bio-Skull' },
        { id: 'lion', img: AVATAR_ART.lion, name: 'Golden Lion (5 Refs)', fx: 'av-fx-superhost', req: 'ref5', badge: '🦁 5-Ref King' },
        { id: 'ref10', img: AVATAR_ART.ref10, name: 'Sky Dragon (10 Refs)', fx: 'av-fx-diamond', req: 'ref10', badge: '🐉 10-Ref Mythic' },
        { id: 'girl_empress', img: AVATAR_ART.girl_empress, name: 'Tiara Empress (10 Refs)', fx: 'av-fx-girlglam', req: 'ref10', badge: '👸 10-Ref Empress' },
        { id: 'reaper', img: AVATAR_ART.reaper, name: 'Soul Scythe (10 Refs)', fx: 'av-fx-host', req: 'ref10', badge: '⚰️ 10-Ref Phantom' },
        { id: 'unicorn', img: AVATAR_ART.unicorn, name: 'Mystic Horn (10 Refs)', fx: 'av-fx-girlglam', req: 'ref10', badge: '🦄 10-Ref Legend' },
        { id: 'superhost', img: AVATAR_ART.superhost, name: 'SAMAKSH GOD', fx: 'av-fx-superhost', req: 'code', badge: '👑 SUPREME CREATOR & GOD-KING' },
        { id: 'host_zoro', img: AVATAR_ART.host_zoro, name: 'Zoro 3-Blade', fx: 'av-fx-host', req: 'code', badge: '⚔️ Official Host: Zoro' },
        { id: 'host_sarah', img: AVATAR_ART.host_sarah, name: 'Sarah Butterfly', fx: 'av-fx-girlglam', req: 'code', badge: '🦋 Official Host: Sarah' },
        { id: 'host_milly', img: AVATAR_ART.host_milly, name: 'Milly Diva', fx: 'av-fx-girlglam', req: 'code', badge: '💖 Official Host: Milly' },
        { id: 'host_heer', img: AVATAR_ART.host_heer, name: 'Heer Nova', fx: 'av-fx-girlglam', req: 'code', badge: '🌸 Official Host: Heer' },
        { id: 'host_ishika', img: AVATAR_ART.host_ishika, name: 'Ishika Star', fx: 'av-fx-girlglam', req: 'code', badge: '✨ Official Host: Ishika' },
        { id: 'host_izzan', img: AVATAR_ART.host_izzan, name: 'Izzan Inferno', fx: 'av-fx-disco', req: 'code', badge: '🔥 Official Host: Izzan' },
        { id: 'host_sus', img: AVATAR_ART.host_sus, name: 'Sus Shadow', fx: 'av-fx-host', req: 'code', badge: '👀 Official Host: Sus' },
        { id: 'host_ruwii', img: AVATAR_ART.host_ruwii, name: 'Ruwii Blossom', fx: 'av-fx-girlglam', req: 'code', badge: '🌺 Official Host: Ruwii' },
        { id: 'host_moon', img: AVATAR_ART.host_moon, name: 'Moon Eclipse', fx: 'av-fx-host', req: 'code', badge: '🌙 Official Host: Moon' },
        { id: 'host_zaira', img: AVATAR_ART.host_zaira, name: 'Zaira Orbit', fx: 'av-fx-diamond', req: 'code', badge: '🪐 Official Host: Zaira' }
      ];

      let myReferralCount = 0;
      let unlockedCodes = JSON.parse(localStorage.getItem('sammu_unlocked_avatars') || '[]');
      let playerAvatarMap = {};

      function getMyCleanName() {
        return (window._savedUname || localStorage.getItem('sammu_username') || localStorage.getItem('username') || '').trim().toLowerCase();
      }

      function isAvatarUnlocked(av) {
        if (av.req === 'free') return true;
        if (av.req === 'ref3') return myReferralCount >= 3;
        if (av.req === 'ref5') return myReferralCount >= 5;
        if (av.req === 'ref10') return myReferralCount >= 10;
        if (av.req === 'code') return unlockedCodes.includes(av.id);
        return false;
      }

      window.copyMyInviteForAvatars = function() {
        const uname = getMyCleanName() || 'player';
        const link = window.location.origin + '/?ref=' + encodeURIComponent(uname);
        if (navigator.clipboard) navigator.clipboard.writeText(link);
        alert('🔗 Referral Link Copied!\\n' + link + '\\n\\nInvite 3, 5, or 10 friends to unlock exclusive HD Avatars!');
      };

      window.redeemAvatarCode = function() {
        const code = (document.getElementById('avSecretCodeInputV6').value || '').trim();
        if (!code) return;
        if (typeof socket !== 'undefined') socket.emit('verifyAvatarCodeV6', { code });
      };

      window.equipPremiumAvatar = function(av) {
        if (!isAvatarUnlocked(av)) {
          if (av.req === 'ref3') alert('🔒 Bring ' + (3 - myReferralCount) + ' more friends via your referral link!');
          else if (av.req === 'ref5') alert('🔒 Bring ' + (5 - myReferralCount) + ' more friends via your referral link!');
          else if (av.req === 'ref10') alert('🔒 Bring ' + (10 - myReferralCount) + ' more friends via your referral link!');
          else alert('🔐 Locked! Enter the secret Host Avatar code below.');
          return;
        }
        localStorage.setItem('sammu_avatar', av.img);
        localStorage.setItem('avatar', av.img);
        localStorage.setItem('sammu_avatar_fx', av.fx);
        window._savedAvatar = av.img;
        const uname = window._savedUname || localStorage.getItem('sammu_username') || localStorage.getItem('username') || 'Player';
        if (typeof socket !== 'undefined') {
          socket.emit('equipAvatarFxV6', { avatar: av.img, fx: av.fx, badge: av.badge });
          socket.emit('joinRoom', { username: uname, avatar: av.img, deviceId: localStorage.getItem('sammu_dev_uid') || '', isReconnect: true });
        }
        document.getElementById('avatarVaultModalV6').style.display = 'none';
      };

      window.renderAvatarVault = function() {
        const grid = document.getElementById('avVaultGridV6');
        const stats = document.getElementById('avRefStatsV6');
        if (stats) stats.textContent = '🔗 Referrals: ' + myReferralCount + ' | 27 HD Vector Avatars';
        if (!grid) return;
        grid.innerHTML = '';

        const ordered = [
          ...PREMIUM_AVATARS.filter(a => a.id === 'superhost'),
          ...PREMIUM_AVATARS.filter(a => a.id !== 'superhost')
        ];

        ordered.forEach(av => {
          const unlocked = isAvatarUnlocked(av);
          const isGod = av.id === 'superhost';
          const card = document.createElement('div');
          card.className = 'av-item-v6' + (unlocked ? '' : ' locked');
          if (isGod) {
            card.style.cssText = 'grid-column: 1 / -1; background: linear-gradient(135deg, rgba(250,204,21,0.28), rgba(239,68,68,0.25), rgba(56,189,248,0.28)); border: 2px solid #fde047; box-shadow: 0 0 22px rgba(250,204,21,0.55); padding: 11px;';
          }
          card.innerHTML =
            '<div class="av-art-circle-v6 ' + av.fx + '" style="' + (isGod ? 'width:68px;height:68px;' : '') + '"><img src="' + av.img + '" alt="' + av.name + '"></div>' +
            '<div style="font-weight:900;font-size:' + (isGod ? '13px;color:#fde047;text-shadow:0 0 8px #f59e0b;' : '10px;') + '">' + (isGod ? '⚡👑 SAMAKSH MYTHIC GOD-KING 👑⚡' : av.name) + '</div>' +
            '<div style="font-size:10px;color:' + (unlocked ? '#4ade80' : '#f87171') + ';margin-top:2px;font-weight:bold;">' + (unlocked ? '✅ Tap to Equip' : '🔒 Locked') + '</div>';
          card.onclick = () => window.equipPremiumAvatar(av);
          grid.appendChild(card);
        });
      };

      window.openAvatarPreview = function(name, avatarHtml, fxClass, badgeText) {
        const circle = document.getElementById('avPreviewCircleV6');
        circle.className = fxClass || '';
        circle.innerHTML = avatarHtml || '🥷';
        document.getElementById('avPreviewNameV6').textContent = name || 'Player';
        document.getElementById('avPreviewBadgeV6').textContent = badgeText || '🎮 Arena Player';
        document.getElementById('avatarPreviewModalV6').style.display = 'flex';
      };
      function enhanceChatAndAvatarsV6() {
        document.querySelectorAll('span, div, p, b, strong, td').forEach(el => {
          if (el.children.length === 0) {
            const t = (el.textContent || '').trim();
            if (t.startsWith('data:image/svg+xml') || t.startsWith('data:image/png') || t.startsWith('data:image/jpeg')) {
              el.innerHTML = '<img src="' + t + '" style="width:30px;height:30px;border-radius:50%;vertical-align:middle;object-fit:cover;">';
            }
          }
        });

        const allContainers = document.querySelectorAll('#chatBox, #messages, .chat-messages, #chat-container, [id*="chat"], [class*="chat"]');
        allContainers.forEach(box => {
          if (box.scrollHeight < 60) return;
          Array.from(box.children).forEach(msgEl => {
            if (msgEl.tagName === 'SCRIPT' || msgEl.tagName === 'STYLE' || msgEl.tagName === 'INPUT') return;
            const rawTxt = (msgEl.textContent || '').toLowerCase().trim();
            if (!rawTxt || rawTxt.length > 600) return;

            const isSamakshMsg = /\b(samaksh|sammu)\b/.test(rawTxt) &&
              (rawTxt.includes(':') || rawTxt.startsWith('samaksh') || rawTxt.startsWith('sammu'));

            if (isSamakshMsg && !msgEl.classList.contains('chat-glow-samaksh')) {
              msgEl.classList.add('chat-glow-samaksh');
              const innerDiv = msgEl.querySelector('div, p, span');
              if (innerDiv && innerDiv.textContent.trim().length > 3) {
                innerDiv.classList.add('chat-glow-samaksh');
              }
            }
          });
        });

        document.querySelectorAll('img').forEach(el => {
          if (el.dataset.avEnhancedV6) return;
          if (el.src && el.src.startsWith('data:image') && el.offsetWidth >= 16 && el.offsetWidth <= 80) {
            el.dataset.avEnhancedV6 = 'true';
            el.style.cursor = 'pointer';
            el.style.borderRadius = '50%';
            el.style.objectFit = 'cover';

            const parentText = (el.parentElement ? el.parentElement.textContent : '') || '';
            const matchedUser = Object.keys(playerAvatarMap).find(u => parentText.toLowerCase().includes(u));
            const info = matchedUser ? playerAvatarMap[matchedUser] : null;
            if (info && info.fx) el.classList.add(info.fx);
            else if (parentText.toLowerCase().includes('samaksh') || parentText.toLowerCase().includes('sammu')) {
              el.classList.add('av-fx-superhost');
            } else {
              el.classList.add('av-fx-diamond');
            }

            el.onclick = function(e) {
              e.stopPropagation();
              const html = '<img src="' + el.src + '" style="width:100px;height:100px;border-radius:50%;object-fit:cover;">';
              window.openAvatarPreview(info ? info.name : 'Arena Player', html, info ? info.fx : el.className, info ? info.badge : '✨ HD Vector Avatar');
            };
          }
        });
      }
      setInterval(enhanceChatAndAvatarsV6, 350);

      function forceHookAvatarButtonV6() {
        let btn = document.getElementById('openAvatarVaultBtn');
        if (!btn) {
          const anchor = document.getElementById('openPhonkDjBtn') || document.getElementById('openChefBtn') ||
            Array.from(document.querySelectorAll('button, a, div[onclick]')).find(el => el.children.length === 0 && /jam|🎹/i.test(el.textContent || ''));
          if (anchor && anchor.parentNode) {
            btn = anchor.cloneNode(true);
            btn.id = 'openAvatarVaultBtn';
            anchor.parentNode.insertBefore(btn, anchor.nextSibling);
          }
        }
        if (btn && !btn.dataset.v6Bound) {
          btn.dataset.v6Bound = 'true';
          btn.removeAttribute('onclick');
          btn.textContent = '👑 Avatars';
          btn.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            if (typeof socket !== 'undefined') socket.emit('getMyAvatarStatsV6', { username: getMyCleanName() });
            window.renderAvatarVault();
            document.getElementById('avatarVaultModalV6').style.display = 'flex';
          };
        }
        if (typeof socket !== 'undefined' && !window._avVaultV6Bound) {
          window._avVaultV6Bound = true;
          socket.on('avatarStatsDataV6', (d) => {
            if (d && typeof d.refs === 'number') myReferralCount = d.refs;
            if (d && d.avatarMap) playerAvatarMap = d.avatarMap;
            window.renderAvatarVault();
            enhanceChatAndAvatarsV6();
          });
          socket.on('avatarCodeResultV6', (res) => {
            if (res && res.ok && res.avatarId) {
              if (!unlockedCodes.includes(res.avatarId)) {
                unlockedCodes.push(res.avatarId);
                localStorage.setItem('sammu_unlocked_avatars', JSON.stringify(unlockedCodes));
              }
              alert('🎉 Unlocked: ' + res.name + '!');
              window.renderAvatarVault();
            } else {
              alert('❌ Invalid Avatar Code!');
            }
          });
        }
      }
      setInterval(forceHookAvatarButtonV6, 600);
    })();
    </script>
    `;

    app.use((req, res, next) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>')) {
                body = body.replace('</body>', AVATAR_VAULT_V6_HTML + '\n</body>');
            }
            return origSend.call(this, body);
        };
        const origSendFile = res.sendFile;
        res.sendFile = function(filePath) {
            if (typeof filePath === 'string' && filePath.endsWith('.html')) {
                try {
                    let html = fs.readFileSync(filePath, 'utf8');
                    if (html.includes('</body>')) {
                        html = html.replace('</body>', AVATAR_VAULT_V6_HTML + '\n</body>');
                        res.setHeader('Content-Type', 'text/html; charset=utf-8');
                        return origSend.call(this, html);
                    }
                } catch (e) {}
            }
            return origSendFile.apply(this, arguments);
        };
        next();
    });

    const HOST_AVATAR_CODES_V6 = {
        "#sammuadmin#bhaicharaontop": { id: "superhost", name: "👑 SAMAKSH MYTHIC GOD-KING" },
        "#zoro#pirateking":          { id: "host_zoro", name: "⚔️ Zoro 3-Blade" },
        "#sarah#butterfly":          { id: "host_sarah", name: "🦋 Sarah Butterfly" },
        "#milly#queen":              { id: "host_milly", name: "💖 Milly Diva" },
        "#heer#bloom":               { id: "host_heer", name: "🌸 Heer Nova" },
        "#ishika#star":              { id: "host_ishika", name: "✨ Ishika Star" },
        "#izzan#fire":               { id: "host_izzan", name: "🔥 Izzan Inferno" },
        "#sus#bunker":               { id: "host_sus", name: "👀 Sus Shadow" },
        "#ruwii#garden":             { id: "host_ruwii", name: "🌺 Ruwii Blossom" },
        "#moon#eclipse":             { id: "host_moon", name: "🌙 Moon Eclipse" },
        "#zaira#orbit":              { id: "host_zaira", name: "🪐 Zaira Orbit" }
    };

    const globalAvatarMapV6 = {};
    const userReferralsDBV6 = {};

    io.on('connection', (socket) => {
        socket.on('registerReferral', ({ refOwner, deviceId }) => {
            if (!refOwner || !deviceId) return;
            const cleanRef = refOwner.trim().toLowerCase();
            if (!userReferralsDBV6[cleanRef]) userReferralsDBV6[cleanRef] = new Set();
            userReferralsDBV6[cleanRef].add(String(deviceId));
        });

        socket.on('getMyAvatarStatsV6', (data) => {
            const uname = ((data && data.username) || socket.username || '').trim().toLowerCase();
            let refs = userReferralsDBV6[uname] ? userReferralsDBV6[uname].size : 0;
            if (uname) {
                const srv = Object.values(serversDB).find(s => s.owner && s.owner.toLowerCase() === uname && Array.isArray(s.allTimeDevices));
                if (srv && srv.allTimeDevices.length > refs) refs = srv.allTimeDevices.length;
            }
            socket.emit('avatarStatsDataV6', { refs, avatarMap: globalAvatarMapV6 });
        });

        socket.on('verifyAvatarCodeV6', (data) => {
            const code = ((data && data.code) || '').trim().toLowerCase();
            const found = HOST_AVATAR_CODES_V6[code];
            socket.emit('avatarCodeResultV6', found ? { ok: true, avatarId: found.id, name: found.name } : { ok: false });
        });

        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload !== null) ? payload.text : payload;
            if (!raw || typeof raw !== 'string') return;
            const found = HOST_AVATAR_CODES_V6[raw.trim().toLowerCase()];
            if (found) {
                socket.emit('avatarCodeResultV6', { ok: true, avatarId: found.id, name: found.name });
                socket.emit('message', {
                    username: 'SYSTEM',
                    text: `👑 **SECRET UNLOCKED:** **${found.name}** is now unlocked in your **👑 Avatars** Vault!`,
                    _serverId: socket.activeServerId
                });
            }
        });

        socket.on('equipAvatarFxV6', (data) => {
            const uname = (socket.username || '').trim().toLowerCase();
            if (!uname || !data) return;
            globalAvatarMapV6[uname] = { name: socket.username, fx: data.fx || '', badge: data.badge || '' };
            if (socket.activeServerId) {
                io.to(socket.activeServerId).emit('avatarStatsDataV6', { avatarMap: globalAvatarMapV6 });
            }
        });
    });
    // === END SELF-OVERWRITING HD AVATAR VAULT v6 ===
    // === MOBILE-FRIENDLY MASTER OVERRIDE v7 (PASTE AT VERY BOTTOM BEFORE };) ===
    const MASTER_OVERRIDE_V7 = `
    <style id="v7OverrideCss">
      @keyframes v7SamakshGlow {
        0% { background-position: 0% 50%; box-shadow: 0 0 16px #fde047, 0 0 28px #f59e0b, inset 0 0 12px rgba(254,240,138,0.4); border-color: #fde047; }
        50% { background-position: 100% 50%; box-shadow: 0 0 24px #38bdf8, 0 0 38px #ec4899, inset 0 0 16px rgba(255,255,255,0.5); border-color: #ffffff; }
        100% { background-position: 0% 50%; box-shadow: 0 0 16px #fde047, 0 0 28px #f59e0b, inset 0 0 12px rgba(254,240,138,0.4); border-color: #fde047; }
      }
      .v7-samaksh-bubble {
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
        background: linear-gradient(120deg, rgba(250,204,21,0.38), rgba(239,68,68,0.34), rgba(168,85,247,0.36), rgba(56,189,248,0.38)) !important;
        background-size: 250% 250% !important;
        border: 2px solid #fde047 !important;
        border-radius: 15px !important;
        padding: 8px 12px !important;
        margin: 6px 0 !important;
        animation: v7SamakshGlow 1.8s ease-in-out infinite !important;
        color: #ffffff !important;
        font-weight: 800 !important;
        text-shadow: 0 0 8px #fde047, 0 0 16px #f59e0b !important;
      }
      .v7-samaksh-bubble * {
        color: #ffffff !important;
        text-shadow: 0 0 8px #fde047, 0 0 14px #38bdf8 !important;
      }
      #v7FloatingAvatarBtn {
        position: fixed !important;
        bottom: 76px !important;
        right: 12px !important;
        z-index: 999998 !important;
        background: linear-gradient(135deg, #f59e0b, #ec4899, #38bdf8) !important;
        color: #ffffff !important;
        border: 2px solid #fde047 !important;
        border-radius: 999px !important;
        padding: 9px 15px !important;
        font-weight: 900 !important;
        font-size: 13px !important;
        box-shadow: 0 0 20px rgba(250,204,21,0.85) !important;
        cursor: pointer !important;
      }
    </style>
    <script>
    (function() {
      // 1. Wipe any old broken avatar buttons so we have ONE clean button
      document.querySelectorAll('#openAvatarVaultBtn, #v7FloatingAvatarBtn').forEach(b => b.remove());

      window.openAvatarVaultGUI = function() {
        const myName = (window._savedUname || localStorage.getItem('sammu_username') || localStorage.getItem('username') || '').trim().toLowerCase();
        if (typeof socket !== 'undefined') socket.emit('getMyAvatarStatsV6', { username: myName });
        if (typeof window.renderAvatarVault === 'function') window.renderAvatarVault();
        const modal = document.getElementById('avatarVaultModalV6') || document.getElementById('avatarVaultModal');
        if (modal) modal.style.display = 'flex';
        else alert('⚠️ Please paste Piece 1 above this block so the Avatar Vault modal exists!');
      };

      // 2. Guaranteed Floating Button on Screen
      function ensureV7Button() {
        if (!document.body || document.getElementById('v7FloatingAvatarBtn')) return;
        const btn = document.createElement('button');
        btn.id = 'v7FloatingAvatarBtn';
        btn.textContent = '👑 Avatars';
        btn.onclick = function(e) {
          e.preventDefault();
          e.stopPropagation();
          window.openAvatarVaultGUI();
        };
        document.body.appendChild(btn);
      }

      // 3. Glow EVERY chat message from Samaksh or Sammu (text, emojis, links, everything)
      function applyV7SamakshGlow() {
        ensureV7Button();
        const boxes = document.querySelectorAll('#chatBox, #messages, .chat-messages, #chat-container, [id*="chat"], [class*="chat"]');
        boxes.forEach(box => {
          if (box.scrollHeight < 40) return;
          Array.from(box.children).forEach(row => {
            if (row.dataset.v7Checked) return;
            if (['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'BUTTON'].includes(row.tagName)) return;
            const txt = (row.textContent || '').toLowerCase().trim();
            if (!txt || txt.length > 900) return;

            const firstLine = txt.split('\\n').trim();
            const boldEl = row.querySelector('b, strong, [class*="name"], [class*="user"]');
            const boldTxt = boldEl ? (boldEl.textContent || '').toLowerCase() : '';

            const isSamaksh =
              firstLine.startsWith('samaksh') ||
              firstLine.startsWith('sammu') ||
              /\\b(samaksh|sammu)\\s*:/.test(txt) ||
              /\\b(samaksh|sammu)\\b/.test(boldTxt);

            if (isSamaksh) {
              row.dataset.v7Checked = 'true';
              row.classList.add('v7-samaksh-bubble');
              const inner = row.querySelector('div, p');
              if (inner && inner.textContent.trim().length > 0) inner.classList.add('v7-samaksh-bubble');
            }
          });
        });
      }

      // 4. Hook directly into incoming socket messages for instant zero-lag glow
      function bindV7Socket() {
        if (typeof socket === 'undefined' || window._v7SocketBound) return;
        window._v7SocketBound = true;

        const prevOnevent = socket.onevent;
        socket.onevent = function(packet) {
          const res = prevOnevent.apply(this, arguments);
          const ev = packet && packet.data && packet.data;
          const payload = packet && packet.data && packet.data;
          if (ev === 'message' && payload && typeof payload === 'object') {
            const u = (payload.username || '').toLowerCase().trim();
            if (u === 'samaksh' || u === 'sammu') {
              setTimeout(applyV7SamakshGlow, 30);
              setTimeout(applyV7SamakshGlow, 150);
            }
          }
          return res;
        };

        const origEmit = socket.emit.bind(socket);
        socket.emit = function(ev, payload, ...rest) {
          if (ev === 'chatMessage') {
            const txt = (typeof payload === 'object' && payload !== null) ? payload.text : payload;
            if (typeof txt === 'string' && txt.trim().toLowerCase() === '!avatars') {
              window.openAvatarVaultGUI();
              return socket;
            }
          }
          return origEmit(ev, payload, ...rest);
        };
      }

      setInterval(() => { applyV7SamakshGlow(); bindV7Socket(); }, 400);
      window.addEventListener('DOMContentLoaded', () => { ensureV7Button(); bindV7Socket(); });
    })();
    </script>
    `;

    app.use((req, res, next) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>')) {
                body = body.replace('</body>', MASTER_OVERRIDE_V7 + '\n</body>');
            }
            return origSend.call(this, body);
        };
        const origSendFile = res.sendFile;
        res.sendFile = function(filePath) {
            if (typeof filePath === 'string' && filePath.endsWith('.html')) {
                try {
                    let html = fs.readFileSync(filePath, 'utf8');
                    if (html.includes('</body>')) {
                        html = html.replace('</body>', MASTER_OVERRIDE_V7 + '\n</body>');
                        res.setHeader('Content-Type', 'text/html; charset=utf-8');
                        return origSend.call(this, html);
                    }
                } catch (e) {}
            }
            return origSendFile.apply(this, arguments);
        };
        next();
    });
    // === END MOBILE-FRIENDLY MASTER OVERRIDE v7 ===
    // === CLEAN ALL-IN-ONE AVATAR VAULT & SAMAKSH GLOW v8 ===
    const ALL_IN_ONE_V8 = `
    <style id="v8CleanCss">
      #v7FloatingAvatarBtn { display: none !important; }
      @keyframes v8GodAura {
        0% { box-shadow: 0 0 14px #fde047, 0 0 26px #f59e0b; border-color: #ffffff; }
        50% { box-shadow: 0 0 20px #38bdf8, 0 0 34px #ec4899; border-color: #fde047; }
        100% { box-shadow: 0 0 14px #fde047, 0 0 26px #f59e0b; border-color: #ffffff; }
      }
      @keyframes v8SamakshBubbleGlow {
        0% { box-shadow: 0 0 14px #fde047, 0 0 26px rgba(245,158,11,0.8), inset 0 0 10px rgba(255,255,255,0.35); border-color: #fde047; }
        50% { box-shadow: 0 0 20px #38bdf8, 0 0 34px rgba(236,72,153,0.85), inset 0 0 14px rgba(255,255,255,0.5); border-color: #ffffff; }
        100% { box-shadow: 0 0 14px #fde047, 0 0 26px rgba(245,158,11,0.8), inset 0 0 10px rgba(255,255,255,0.35); border-color: #fde047; }
      }
      .v8-samaksh-glow {
        background: linear-gradient(135deg, #f59e0b, #ec4899, #6366f1, #0ea5e9) !important;
        border: 2px solid #fde047 !important;
        animation: v8SamakshBubbleGlow 1.8s ease-in-out infinite !important;
        color: #ffffff !important;
        font-weight: 800 !important;
        text-shadow: 0 0 8px #fde047, 0 0 14px #000000 !important;
      }
      .v8-samaksh-glow * { color: #ffffff !important; text-shadow: 0 0 6px #fde047 !important; }
      .av-fx-disco { box-shadow: 0 0 14px #ff0080 !important; border: 2px solid #ff0080 !important; border-radius: 50% !important; }
      .av-fx-diamond { box-shadow: 0 0 14px #38bdf8 !important; border: 2px solid #7dd3fc !important; border-radius: 50% !important; }
      .av-fx-girlglam { box-shadow: 0 0 14px #f472b6 !important; border: 2px solid #f9a8d4 !important; border-radius: 50% !important; }
      .av-fx-host { box-shadow: 0 0 14px #a855f7 !important; border: 2px solid #c084fc !important; border-radius: 50% !important; }
      .av-fx-superhost { animation: v8GodAura 1.3s ease-in-out infinite !important; border: 2.5px solid #fde047 !important; border-radius: 50% !important; }
      #v8VaultModal { display:none; position:fixed; inset:0; background:rgba(5,8,20,0.94); z-index:999999; align-items:center; justify-content:center; backdrop-filter:blur(10px); padding:12px; }
      #v8VaultCard { background:linear-gradient(155deg,#0f172a,#1e1b4b); border:2px solid #38bdf8; border-radius:22px; padding:14px; width:100%; max-width:420px; color:#fff; text-align:center; box-shadow:0 0 35px rgba(56,189,248,0.45); max-height:88vh; overflow-y:auto; }
      .v8-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin:10px 0; }
      .v8-item { background:rgba(255,255,255,0.07); border:1.5px solid rgba(56,189,248,0.35); border-radius:14px; padding:8px 4px; cursor:pointer; }
      .v8-item.locked { opacity:0.62; border-color:#64748b; }
      .v8-art { width:50px; height:50px; margin:0 auto 5px auto; border-radius:50%; overflow:hidden; background:#020617; }
      .v8-art img { width:100%; height:100%; display:block; }
    </style>

    <div id="v8VaultModal" onclick="if(event.target===this)this.style.display='none'">
      <div id="v8VaultCard">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:900;font-size:15px;color:#38bdf8;">👑 27 HD AVATAR VAULT</span>
          <button onclick="document.getElementById('v8VaultModal').style.display='none'" style="width:auto!important;background:#ef4444;border:none;color:#fff;border-radius:8px;padding:4px 10px;font-weight:bold;cursor:pointer;">✕</button>
        </div>
        <div id="v8RefText" style="font-size:11px;color:#fde047;margin:6px 0;font-weight:bold;">🔗 Referrals: 0 | Unlock HD Avatars at 3, 5 & 10 Refs!</div>
        <div class="v8-grid" id="v8Grid"></div>
        <div style="display:flex;gap:6px;margin-top:8px;">
          <input id="v8CodeInput" placeholder="Enter Host Avatar Code..." style="flex:1;padding:8px;border-radius:10px;border:1.5px solid #c084fc;background:#090d16;color:#fff;font-size:12px;">
          <button onclick="v8RedeemCode()" style="width:auto!important;background:linear-gradient(90deg,#a855f7,#ec4899);border:none;color:#fff;border-radius:10px;padding:8px 12px;font-weight:bold;font-size:12px;cursor:pointer;">🔓 Unlock</button>
        </div>
        <button onclick="v8CopyRef()" style="width:100%;margin-top:8px;padding:9px;border:none;border-radius:10px;background:linear-gradient(90deg,#059669,#10b981);color:#fff;font-weight:900;font-size:12px;cursor:pointer;">🔗 Copy My Referral Link</button>
      </div>
    </div>
    <script>
    (function() {
      const oldFloat = document.getElementById('v7FloatingAvatarBtn');
      if (oldFloat) oldFloat.remove();

      function svgUri(s) {
        return 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://w3.org" viewBox="0 0 100 100">' + s + '</svg>');
      }

      const ART = {
        diamond: svgUri('<circle cx="50" cy="50" r="48" fill="#082f49"/><polygon points="50,14 82,38 50,86 18,38" fill="#38bdf8" stroke="#fff" stroke-width="2.5"/><polyline points="18,38 50,48 82,38" fill="none" stroke="#e0f2fe" stroke-width="2"/>'),
        samurai: svgUri('<circle cx="50" cy="50" r="48" fill="#1e1b4b"/><path d="M22,55 C22,28 78,28 78,55 L70,76 L30,76 Z" fill="#dc2626" stroke="#facc15" stroke-width="2.5"/><polygon points="50,14 56,30 74,24 60,36 50,32 40,36 26,24 44,30" fill="#facc15"/><rect x="32" y="48" width="36" height="8" rx="3" fill="#090d16"/>'),
        phoenix: svgUri('<circle cx="50" cy="50" r="48" fill="#450a0a"/><path d="M50,16 C65,30 82,34 76,58 C70,74 56,82 50,86 C44,82 30,74 24,58 C18,34 35,30 50,16 Z" fill="#f97316" stroke="#fde047" stroke-width="2"/><path d="M50,30 C60,42 66,52 50,74 C34,52 40,42 50,30 Z" fill="#facc15"/>'),
        ninja: svgUri('<circle cx="50" cy="50" r="48" fill="#090d16"/><circle cx="50" cy="52" r="30" fill="#1e293b" stroke="#64748b" stroke-width="2"/><rect x="24" y="42" width="52" height="14" rx="5" fill="#020617"/><polygon points="34,47 45,50 35,52" fill="#ef4444"/><polygon points="66,47 55,50 65,52" fill="#ef4444"/>'),
        astro: svgUri('<circle cx="50" cy="50" r="48" fill="#0f172a"/><circle cx="50" cy="52" r="32" fill="#e2e8f0" stroke="#38bdf8" stroke-width="3"/><rect x="30" y="38" width="40" height="24" rx="10" fill="#0284c7" stroke="#bae6fd" stroke-width="2"/>'),
        disco: svgUri('<circle cx="50" cy="50" r="48" fill="#1e1b4b"/><circle cx="50" cy="52" r="32" fill="#ec4899" stroke="#f0abfc" stroke-width="2"/><path d="M22,52 H78 M26,38 H74 M26,66 H74 M50,20 V84" stroke="#fff" stroke-width="1.5"/>'),
        butterfly: svgUri('<circle cx="50" cy="50" r="48" fill="#2e1065"/><path d="M48,50 C25,18 10,35 24,54 C12,68 28,84 48,60 Z" fill="#f472b6" stroke="#fbcfe8" stroke-width="2"/><path d="M52,50 C75,18 90,35 76,54 C88,68 72,84 52,60 Z" fill="#a855f7" stroke="#fbcfe8" stroke-width="2"/>'),
        kitsune: svgUri('<circle cx="50" cy="50" r="48" fill="#311042"/><polygon points="24,18 38,42 20,52" fill="#fff" stroke="#f43f5e" stroke-width="2"/><polygon points="76,18 62,42 80,52" fill="#fff" stroke="#f43f5e" stroke-width="2"/><polygon points="50,84 22,50 36,34 50,40 64,34 78,50" fill="#fff" stroke="#f43f5e" stroke-width="2.5"/>'),
        wolf: svgUri('<circle cx="50" cy="50" r="48" fill="#450a0a"/><polygon points="24,22 36,44 20,54" fill="#fb923c"/><polygon points="76,22 64,44 80,54" fill="#fb923c"/><polygon points="50,84 22,52 34,34 50,42 66,34 78,52" fill="#1f2937" stroke="#f97316" stroke-width="2.5"/>'),
        blossom: svgUri('<circle cx="50" cy="50" r="48" fill="#4c0519"/><g fill="#f472b6"><ellipse cx="50" cy="26" rx="11" ry="18"/><ellipse cx="50" cy="74" rx="11" ry="18"/><ellipse cx="26" cy="50" rx="18" ry="11"/><ellipse cx="74" cy="50" rx="18" ry="11"/></g><circle cx="50" cy="50" r="13" fill="#fde047"/>'),
        skull: svgUri('<circle cx="50" cy="50" r="48" fill="#052e16"/><path d="M28,48 C28,24 72,24 72,48 C72,60 64,65 62,76 L38,76 C36,65 28,60 28,48 Z" fill="#4ade80"/><circle cx="39" cy="48" r="6" fill="#052e16"/><circle cx="61" cy="48" r="6" fill="#052e16"/>'),
        lion: svgUri('<circle cx="50" cy="50" r="48" fill="#422006"/><circle cx="50" cy="52" r="34" fill="#d97706" stroke="#fde047" stroke-width="2.5"/><polygon points="50,76 30,52 36,34 50,38 64,34 70,52" fill="#fef08a"/>'),
        dragon: svgUri('<circle cx="50" cy="50" r="48" fill="#042f2e"/><path d="M25,70 C20,40 40,20 68,26 C55,34 54,44 74,48 C62,58 58,72 42,78 Z" fill="#34d399" stroke="#a7f3d0" stroke-width="2"/>'),
        empress: svgUri('<circle cx="50" cy="50" r="48" fill="#3b0764"/><polygon points="20,68 24,34 38,50 50,24 62,50 76,34 80,68" fill="#fde047" stroke="#fff" stroke-width="2"/><rect x="20" y="68" width="60" height="10" rx="4" fill="#ec4899"/>'),
        reaper: svgUri('<circle cx="50" cy="50" r="48" fill="#090d16"/><path d="M26,76 C26,34 74,34 74,76 Z" fill="#1e293b" stroke="#94a3b8" stroke-width="2"/><path d="M20,24 Q65,12 82,36" stroke="#e2e8f0" stroke-width="4" fill="none"/>'),
        unicorn: svgUri('<circle cx="50" cy="50" r="48" fill="#4a044e"/><polygon points="50,12 44,36 56,36" fill="#fde047"/><path d="M32,74 C28,46 42,32 62,38 C74,42 74,62 60,74 Z" fill="#f8fafc" stroke="#f472b6" stroke-width="2.5"/>'),
        zoro: svgUri('<circle cx="50" cy="50" r="48" fill="#052e16"/><line x1="20" y1="80" x2="80" y2="20" stroke="#e2e8f0" stroke-width="6"/><line x1="20" y1="20" x2="80" y2="80" stroke="#4ade80" stroke-width="6"/><line x1="50" y1="14" x2="50" y2="86" stroke="#facc15" stroke-width="5"/>'),
        sarah: svgUri('<circle cx="50" cy="50" r="48" fill="#1e1b4b"/><path d="M48,50 C22,16 8,36 24,56 C10,70 28,86 48,60 Z" fill="#38bdf8"/><path d="M52,50 C78,16 92,36 76,56 C90,70 72,86 52,60 Z" fill="#c084fc"/>'),
        milly: svgUri('<circle cx="50" cy="50" r="48" fill="#500724"/><path d="M50,80 C20,60 15,32 35,26 C44,24 50,33 50,33 C50,33 56,24 65,26 C85,32 80,60 50,80 Z" fill="#f43f5e"/><polygon points="36,22 43,12 50,20 57,12 64,22" fill="#fde047"/>'),
        heer: svgUri('<circle cx="50" cy="50" r="48" fill="#3b0764"/><polygon points="50,22 58,42 78,50 58,58 50,78 42,58 22,50 42,42" fill="#e879f9" stroke="#fff" stroke-width="2"/>'),
        ishika: svgUri('<circle cx="50" cy="50" r="48" fill="#422006"/><polygon points="50,16 58,38 82,38 62,52 70,76 50,62 30,76 38,52 18,38 42,38" fill="#facc15" stroke="#fff" stroke-width="2"/>'),
        izzan: svgUri('<circle cx="50" cy="50" r="48" fill="#450a0a"/><polygon points="50,16 74,56 58,56 66,84 28,46 44,46" fill="#ef4444" stroke="#fde047" stroke-width="2"/>'),
        sus: svgUri('<circle cx="50" cy="50" r="48" fill="#052e16"/><rect x="26" y="34" width="48" height="22" rx="11" fill="#4ade80"/><circle cx="38" cy="45" r="5" fill="#090d16"/><circle cx="62" cy="45" r="5" fill="#090d16"/>'),
        ruwii: svgUri('<circle cx="50" cy="50" r="48" fill="#4c0519"/><g fill="#fb7185"><circle cx="50" cy="30" r="14"/><circle cx="69" cy="44" r="14"/><circle cx="62" cy="66" r="14"/><circle cx="38" cy="66" r="14"/><circle cx="31" cy="44" r="14"/></g><circle cx="50" cy="50" r="10" fill="#fde047"/>'),
        moon: svgUri('<circle cx="50" cy="50" r="48" fill="#090d16"/><path d="M62,20 A30,30 0 1,0 78,68 A24,24 0 1,1 62,20 Z" fill="#fde047"/>'),
        zaira: svgUri('<circle cx="50" cy="50" r="48" fill="#0f172a"/><circle cx="50" cy="50" r="20" fill="#a855f7"/><ellipse cx="50" cy="50" rx="38" ry="11" transform="rotate(-22 50 50)" fill="none" stroke="#38bdf8" stroke-width="3.5"/>'),
        superhost: svgUri('<circle cx="50" cy="50" r="49" fill="#f59e0b" stroke="#fff" stroke-width="3"/><circle cx="50" cy="50" r="37" fill="#090d16" stroke="#fde047" stroke-width="2.5"/><path d="M12,48 Q22,30 32,46 Q20,56 12,48 Z M88,48 Q78,30 68,46 Q80,56 88,48 Z" fill="#38bdf8"/><polygon points="22,68 25,30 39,46 50,16 61,46 75,30 78,68" fill="#fde047" stroke="#fff" stroke-width="2"/><rect x="22" y="68" width="56" height="10" rx="4" fill="#f59e0b"/><polygon points="50,42 57,53 50,64 43,53" fill="#38bdf8" stroke="#fff" stroke-width="2"/>')
      };
      const LIST = [
        { id: 'superhost', img: ART.superhost, name: '⚡👑 SAMAKSH GOD-KING 👑⚡', fx: 'av-fx-superhost', req: 'code', god: true },
        { id: 'diamond', img: ART.diamond, name: 'Cyber Diamond', fx: 'av-fx-diamond', req: 'free' },
        { id: 'samurai', img: ART.samurai, name: 'Neon Samurai', fx: 'av-fx-diamond', req: 'free' },
        { id: 'phoenix', img: ART.phoenix, name: 'Phoenix Blaze', fx: 'av-fx-disco', req: 'free' },
        { id: 'ninja', img: ART.ninja, name: 'Void Shinobi', fx: 'av-fx-host', req: 'free' },
        { id: 'astro', img: ART.astro, name: 'Galaxy Astro', fx: 'av-fx-diamond', req: 'free' },
        { id: 'disco', img: ART.disco, name: 'Disco Orb (3 Refs)', fx: 'av-fx-disco', req: 'ref3' },
        { id: 'butterfly', img: ART.butterfly, name: 'Monarch Queen (3 Refs)', fx: 'av-fx-girlglam', req: 'ref3' },
        { id: 'kitsune', img: ART.kitsune, name: 'Cyber Kitsune (3 Refs)', fx: 'av-fx-girlglam', req: 'ref3' },
        { id: 'wolf', img: ART.wolf, name: 'Mecha-Wolf (5 Refs)', fx: 'av-fx-disco', req: 'ref5' },
        { id: 'blossom', img: ART.blossom, name: 'Sakura Lotus (5 Refs)', fx: 'av-fx-girlglam', req: 'ref5' },
        { id: 'skull', img: ART.skull, name: 'Toxic Reaper (5 Refs)', fx: 'av-fx-disco', req: 'ref5' },
        { id: 'lion', img: ART.lion, name: 'Golden Lion (5 Refs)', fx: 'av-fx-superhost', req: 'ref5' },
        { id: 'dragon', img: ART.dragon, name: 'Sky Dragon (10 Refs)', fx: 'av-fx-diamond', req: 'ref10' },
        { id: 'empress', img: ART.empress, name: 'Tiara Empress (10 Refs)', fx: 'av-fx-girlglam', req: 'ref10' },
        { id: 'reaper', img: ART.reaper, name: 'Soul Scythe (10 Refs)', fx: 'av-fx-host', req: 'ref10' },
        { id: 'unicorn', img: ART.unicorn, name: 'Mystic Horn (10 Refs)', fx: 'av-fx-girlglam', req: 'ref10' },
        { id: 'host_zoro', img: ART.zoro, name: 'Zoro 3-Blade', fx: 'av-fx-host', req: 'code' },
        { id: 'host_sarah', img: ART.sarah, name: 'Sarah Butterfly', fx: 'av-fx-girlglam', req: 'code' },
        { id: 'host_milly', img: ART.milly, name: 'Milly Diva', fx: 'av-fx-girlglam', req: 'code' },
        { id: 'host_heer', img: ART.heer, name: 'Heer Nova', fx: 'av-fx-girlglam', req: 'code' },
        { id: 'host_ishika', img: ART.ishika, name: 'Ishika Star', fx: 'av-fx-girlglam', req: 'code' },
        { id: 'host_izzan', img: ART.izzan, name: 'Izzan Inferno', fx: 'av-fx-disco', req: 'code' },
        { id: 'host_sus', img: ART.sus, name: 'Sus Shadow', fx: 'av-fx-host', req: 'code' },
        { id: 'host_ruwii', img: ART.ruwii, name: 'Ruwii Blossom', fx: 'av-fx-girlglam', req: 'code' },
        { id: 'host_moon', img: ART.moon, name: 'Moon Eclipse', fx: 'av-fx-host', req: 'code' },
        { id: 'host_zaira', img: ART.zaira, name: 'Zaira Orbit', fx: 'av-fx-diamond', req: 'code' }
      ];

      let refs = 0;
      let unlocked = JSON.parse(localStorage.getItem('sammu_unlocked_avatars') || '[]');
      const getUname = () => (window._savedUname || localStorage.getItem('sammu_username') || localStorage.getItem('username') || '').trim().toLowerCase();

      function canUse(av) {
        if (av.req === 'free') return true;
        if (av.req === 'ref3') return refs >= 3;
        if (av.req === 'ref5') return refs >= 5;
        if (av.req === 'ref10') return refs >= 10;
        if (av.req === 'code') return unlocked.includes(av.id);
        return false;
      }

      window.v8CopyRef = function() {
        const link = window.location.origin + '/?ref=' + encodeURIComponent(getUname() || 'player');
        if (navigator.clipboard) navigator.clipboard.writeText(link);
        alert('🔗 Referral Link Copied!\\n' + link);
      };

      window.v8RedeemCode = function() {
        const code = (document.getElementById('v8CodeInput').value || '').trim();
        if (code && typeof socket !== 'undefined') socket.emit('verifyAvatarCodeV6', { code });
      };
      window.v8RenderVault = function() {
        const grid = document.getElementById('v8Grid');
        const txt = document.getElementById('v8RefText');
        if (txt) txt.textContent = '🔗 Your Referrals: ' + refs + ' | 27 HD Avatars';
        if (!grid) return;
        grid.innerHTML = '';
        LIST.forEach(av => {
          const ok = canUse(av);
          const d = document.createElement('div');
          d.className = 'v8-item' + (ok ? '' : ' locked');
          if (av.god) d.style.cssText = 'grid-column:1/-1;background:linear-gradient(135deg,rgba(250,204,21,0.3),rgba(239,68,68,0.25),rgba(56,189,248,0.3));border:2px solid #fde047;padding:10px;';
          d.innerHTML =
            '<div class="v8-art ' + av.fx + '" style="' + (av.god ? 'width:64px;height:64px;' : '') + '"><img src="' + av.img + '"></div>' +
            '<div style="font-weight:900;font-size:' + (av.god ? '13px;color:#fde047;' : '10px;') + '">' + av.name + '</div>' +
            '<div style="font-size:10px;color:' + (ok ? '#4ade80' : '#f87171') + ';margin-top:2px;">' + (ok ? '✅ Tap to Equip' : '🔒 Locked') + '</div>';
          d.onclick = () => {
            if (!ok) { alert('🔒 Locked! Earn referrals or enter your Host Avatar code below.'); return; }
            localStorage.setItem('sammu_avatar', av.img);
            localStorage.setItem('avatar', av.img);
            window._savedAvatar = av.img;
            if (typeof socket !== 'undefined') {
              socket.emit('equipAvatarFxV6', { avatar: av.img, fx: av.fx, badge: av.name });
              socket.emit('joinRoom', { username: getUname() || 'Player', avatar: av.img, deviceId: localStorage.getItem('sammu_dev_uid') || '', isReconnect: true });
            }
            document.getElementById('v8VaultModal').style.display = 'none';
          };
          grid.appendChild(d);
        });
      };

      setInterval(() => {
        const fBtn = document.getElementById('v7FloatingAvatarBtn');
        if (fBtn) fBtn.remove();

        const avBtn = document.getElementById('openAvatarVaultBtn') ||
          Array.from(document.querySelectorAll('button')).find(b => b.id !== 'v7FloatingAvatarBtn' && /avatars/i.test(b.textContent || ''));
        if (avBtn && !avBtn.dataset.v8Hooked) {
          avBtn.dataset.v8Hooked = 'true';
          avBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof socket !== 'undefined') socket.emit('getMyAvatarStatsV6', { username: getUname() });
            window.v8RenderVault();
            document.getElementById('v8VaultModal').style.display = 'flex';
          };
        }

        document.querySelectorAll('span, div, p, b').forEach(el => {
          if (el.children.length === 0) {
            const t = (el.textContent || '').trim();
            if (t.startsWith('data:image/svg+xml')) {
              el.innerHTML = '<img src="' + t + '" style="width:26px;height:26px;border-radius:50%;vertical-align:middle;">';
            }
          }
        });

        document.querySelectorAll('div, span').forEach(el => {
          if (el.children.length === 0 && /^(samaksh|sammu)$/i.test((el.textContent || '').trim())) {
            const msgWrapper = el.closest('div[class*="msg"], div[class*="message"], div[style*="flex"]') || el.parentElement;
            if (msgWrapper) {
              msgWrapper.querySelectorAll('div').forEach(b => {
                if (b.textContent.trim().length > 0 && !/^(samaksh|sammu)$/i.test(b.textContent.trim())) {
                  b.classList.add('v8-samaksh-glow');
                }
              });
              if (msgWrapper.previousElementSibling && msgWrapper.previousElementSibling.textContent.trim().length > 0) {
                msgWrapper.previousElementSibling.classList.add('v8-samaksh-glow');
              }
            }
          }
        });
        if (typeof socket !== 'undefined' && !window._v8Sock) {
          window._v8Sock = true;
          socket.on('avatarStatsDataV6', (d) => {
            if (d && typeof d.refs === 'number') refs = d.refs;
            window.v8RenderVault();
          });
          socket.on('avatarCodeResultV6', (res) => {
            if (res && res.ok && res.avatarId) {
              if (!unlocked.includes(res.avatarId)) {
                unlocked.push(res.avatarId);
                localStorage.setItem('sammu_unlocked_avatars', JSON.stringify(unlocked));
              }
              alert('🎉 Unlocked: ' + res.name + '!');
              window.v8RenderVault();
            } else {
              alert('❌ Invalid Avatar Code!');
            }
          });
        }
      }, 350);
    })();
    </script>
    `;

    app.use((req, res, next) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>')) {
                body = body.replace('</body>', ALL_IN_ONE_V8 + '\n</body>');
            }
            return origSend.call(this, body);
        };
        const origSendFile = res.sendFile;
        res.sendFile = function(filePath) {
            if (typeof filePath === 'string' && filePath.endsWith('.html')) {
                try {
                    let html = fs.readFileSync(filePath, 'utf8');
                    if (html.includes('</body>')) {
                        html = html.replace('</body>', ALL_IN_ONE_V8 + '\n</body>');
                        res.setHeader('Content-Type', 'text/html; charset=utf-8');
                        return origSend.call(this, html);
                    }
                } catch (e) {}
            }
            return origSendFile.apply(this, arguments);
        };
        next();
    });
    // === END CLEAN ALL-IN-ONE AVATAR VAULT & SAMAKSH GLOW v8 ===

};
