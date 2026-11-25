 const fs = require('fs');
const path = require('path')
require('events').EventEmitter.defaultMaxListeners = 100;


module.exports = function initMultiServers(app, io) {
    const DB_FILE = path.join(__dirname, 'servers_db.json');

    const defaultServers = {
        srv_samaksh: { id: 'srv_samaksh', name: "💎 Samaksh's Arena",   owner: "samaksh", theme: "diamond", max: 20, type: "official" },
        srv_lounge:  { id: 'srv_lounge',  name: "🎲 Royal Board & Card Lounge", owner: "sammu", theme: "gold", max: 20, type: "official" },
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
        srv_antim:   { id: 'srv_antim',   name: "⚡ Antim's PokéArena", owner: "antim",   theme: "pokemon", max: 20, type: "official" },

        srv_diamond: { 
            id: 'srv_diamond', 
            name: "💠 DIAMOND SERVER (OG Hosts Only)", 
            owner: "sammu",
      
            theme: "diamond", 
            max: 20, 
            type: "secret", 
            password: "#bhaibahencharaontop" 
        },
        srv_topsecret: { id: 'srv_topsecret', name: "🕵️ TOP SECRET", owner: "sammu", theme: "diamond", max: 20, type: "secret", password: "#topsecretvault", allowedHosts: ["sammu", "samaksh", "zoro", "milly"] }
    };
    let serversDB = { ...defaultServers };
    let lockedOGSignatures = {};
    let millyPromoOn = false;
    let aiCommandQueue = [];

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
            if (Array.isArray(saved._aiCommandQueue)) {
                aiCommandQueue = saved._aiCommandQueue;
                delete saved._aiCommandQueue;
            }
            serversDB = { ...defaultServers, ...saved };
        } catch (e) {}
    }

    function saveDB() {
        try {
            fs.writeFileSync(DB_FILE, JSON.stringify({
                ...serversDB,
                _lockedOGSignatures: lockedOGSignatures,
                _millyPromoOn: millyPromoOn,
                _aiCommandQueue: aiCommandQueue
            }, null, 2));
        } catch (e) {}
    }
    saveDB();
    const activeCounts = {};
    const OG_HOSTS = new Set([
        "sammu", "samaksh", "zoro", "milly", "moon", "heer", "izzan", "ishika", "sus",
        "sarah", "advait", "ruwii", "zaira", "shubhi", "sid" , "antim"
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
            Object.keys(serversDB).forEach(id => {
                io.to(id).emit('toggleDidiPromo', millyPromoOn);
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
                max: s.max || 20, count: (io.sockets.adapter.rooms.get(s.id) ? io.sockets.adapter.rooms.get(s.id).size : 0), type: s.type,
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

      setInterval(() => {
        if (window.selectedServerId === 'srv_topsecret') {
          const exists = document.getElementById('aiConsoleFab');
          if (window.selectedServerId === 'srv_topsecret') {
            if (!exists) {
              const fab = document.createElement('button');
              fab.id = 'aiConsoleFab';
              fab.innerText = '🤖 AI Console';
              fab.style.cssText = 'position:fixed;bottom:18px;left:18px;z-index:99999999;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;border:2px solid #c4b5fd;border-radius:999px;padding:12px 18px;font-size:14px;font-weight:900;cursor:pointer';
              fab.onclick = function() { openAiConsole(); };
              document.body.appendChild(fab);
            }
            fab.style.display = 'block';
          } else {
            if (exists) exists.style.display = 'none';
          }
        }
      }, 800);

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
            .sort((a, b) => b.at(1) - a.at(1));

        const first = ranking.at(0) || null;
        const second = ranking.at(1) || null;
        const third = ranking.at(2) || null;

        let msg = `🎊 **15-GAME TOURNAMENT FINISHED! (${t.gamesPlayed}/${t.maxGames} Games Played)** 🎊\n`;
        if (first) msg += `🥇 **1st Place (TROPHY):** **${first.at(0)}** (${first.at(1)} Wins)\n`;
        if (second) msg += `🥈 **2nd Place (SILVER MEDAL):** **${second.at(0)}** (${second.at(1)} Wins)\n`;
        if (third) msg += `🥉 **3rd Place (BRONZE MEDAL):** **${third.at(0)}** (${third.at(1)} Wins)`;

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
        const pA = shuffled.at(0), pB = shuffled.at(1);

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
    app.get('/api/topsecret-commands', (req, res) => {
        if (req.query.key === 'topsecretvault') {
            return res.json(aiCommandQueue);
        }
        return res.status(403).json({ error: 'Forbidden' });
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

            if (!isHostBypass && (io.sockets.adapter.rooms.get(serverId)?.size || 0) >= (srv.max || 20)) {
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
            if (millyPromoOn) {
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

            // Handle !dev command for topsecret server only
            if (clean.toLowerCase().startsWith('!dev ') && socket.activeServerId === 'srv_topsecret') {
                const allowedDevs = ['sammu', 'samaksh', 'zoro', 'milly'];
                if (allowedDevs.includes(sender)) {
                    const task = clean.slice(5).trim(); // Remove '!dev '
                    if (task) {
                        aiCommandQueue.push({
                            id: 'ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
                            text: task,
                            done: false,
                            addedBy: sender,
                            addedAt: Date.now()
                        });
                        saveDB();
                        io.to('srv_topsecret').emit('aiCommandsSync', aiCommandQueue);
                        socket.emit('message', {
                            username: 'SYSTEM',
                            text: `🤖 Dev task added to AI Console: ${task}`,
                            _serverId: socket.activeServerId
                        });
                    }
                    return;
                }
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
                Object.keys(serversDB).forEach(id => {
                    io.to(id).emit('toggleDidiPromo', millyPromoOn);
                });
                socket.emit('message', {
                    username: 'SYSTEM',
                    text: `📢 Didi Promo Banner across **ALL SERVERS** is now **${millyPromoOn ? 'ON ✅' : 'OFF ❌'}**`,
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

        socket.on('getAiCommands', () => {
            if (socket.activeServerId !== 'srv_topsecret') return;
            socket.emit('aiCommandsSync', aiCommandQueue);
        });

        socket.on('addAiCommand', (data) => {
            if (socket.activeServerId !== 'srv_topsecret') return;
            const text = (data && typeof data.text === 'string') ? data.text.trim() : ((data && typeof data.cmd === 'string') ? data.cmd.trim() : '');
            if (!text) return;
            aiCommandQueue.push({
                id: 'ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
                text,
                done: false,
                addedBy: socket.username || 'unknown',
                addedAt: Date.now()
            });
            saveDB();
            io.to('srv_topsecret').emit('aiCommandsSync', aiCommandQueue);
        });

        socket.on('markAiDone', (id) => {
            if (socket.activeServerId !== 'srv_topsecret') return;
            const item = aiCommandQueue.find(c => c.id === id);
            if (item) {
                item.done = !item.done;
                saveDB();
                io.to('srv_topsecret').emit('aiCommandsSync', aiCommandQueue);
            }
        });

        socket.on('deleteAiCommand', (id) => {
            if (socket.activeServerId !== 'srv_topsecret') return;
            aiCommandQueue = aiCommandQueue.filter(c => c.id !== id);
            saveDB();
            io.to('srv_topsecret').emit('aiCommandsSync', aiCommandQueue);
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
        "SUPERHERO", "VOLCANO", "DRAGON", "SUBMARINE", "HOSPITAL", "YOUTUBE",
        "SAMOSA", "MANGO", "BURGER", "GOKU", "LUFFY", "BATMAN", "TITANIC",
        "TAJ MAHAL", "DUBAI", "ELEPHANT", "TIGER", "PENGUIN", "GUITAR", "HELICOPTER",
        "PYRAMID", "NINJA", "PIRATE", "WIZARD", "CINEMA", "AIRPORT", "BEACH",
        "MOUNTAIN", "RAINBOW", "LIGHTNING", "ROBOT", "ALIEN", "DINOSAUR", "SPIDERMAN",
        "ICE CREAM", "SUSHI", "TACO", "PANCAKE", "DONUT", "POPCORN", "NOODLES",
        "CHEESE", "WATERMELON", "STRAWBERRY", "COFFEE", "SUPERMAN", "IRONMAN",
        "AVENGERS", "JOKER", "HARRY POTTER", "STAR WARS", "JURASSIC PARK", "AVATAR",
        "INCEPTION", "MATRIX", "SHREK", "FROZEN", "PIKACHU", "SAITAMA", "LEVI",
        "EREN", "TANJIRO", "NEZUKO", "KAKASHI", "ICHIGO", "GON"
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
          <button class="dj-loop-btn" id="loopDrift" onclick="togglePhonkBeat('drift','🔥 Automotivo')">🔥 Automotivo</button>
          <button class="dj-loop-btn" id="loopBrazil" onclick="togglePhonkBeat('brazil','🇧🇷 No Batidão')">🇧🇷 No Batidão</button>
          <button class="dj-loop-btn" id="loopMurder" onclick="togglePhonkBeat('murder','👻 Kordhell Murder')">👻 Kordhell Murder</button>
          <button class="dj-loop-btn" id="loopSigma" onclick="togglePhonkBeat('sigma','🗿 Sigma GigaChad')">🗿 Sigma GigaChad</button>
          <button class="dj-loop-btn" id="loopMemphis" onclick="togglePhonkBeat('memphis','👹 Montagem Memphis')">👹 Montagem Memphis</button>
          <button class="dj-loop-btn" id="loopCyber" onclick="togglePhonkBeat('cyber','🚀 Euphoric Hardstyle')">🚀 Euphoric Hardstyle</button>
          <button class="dj-loop-btn" id="loopTokyo" onclick="togglePhonkBeat('tokyo','🏎️ Tokyo Drift')">🏎️ Tokyo Drift</button>
          <button class="dj-loop-btn" id="loopDemon" onclick="togglePhonkBeat('demon','🌌 Heavenly Jumpstyle')">🌌 Heavenly Jumpstyle</button>
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
              gain.gain.setValueAtTime(0.35, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
              osc.connect(gain); gain.connect(ctx.destination);
              osc.start(now); osc.stop(now + 0.22);
            });
          } else if (sound === 'bass808' || sound === 'kick') {
            const osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.type = 'sine';
            const startF = (sound === 'bass808') ? 170 : 185, endF = (sound === 'bass808') ? 28 : 40, dur = (sound === 'bass808') ? 0.55 : 0.22;
            osc.frequency.setValueAtTime(startF, now); osc.frequency.exponentialRampToValueAtTime(endF, now + dur);
            gain.gain.setValueAtTime(0.85, now); gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
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
          brazil:  { tempo: 115, seq: ['bass808', 'cowbell1', 'cowbell2', 'kick', 'cowbell1', 'cowbell2', 'kick', 'cowbell2'] },
          murder:  { tempo: 195, seq: ['bass808', 'cowbell3', 'cowbell1', 'cowbell2', 'kick', 'cowbell3', 'cowbell1', 'bass808'] },
          sigma:   { tempo: 225, seq: ['bass808', 'kick', 'cowbell1', 'cowbell1', 'bass808', 'cowbell2', 'cowbell3', 'kick'] },
          memphis: { tempo: 215, seq: ['bass808', 'cowbell2', 'scratch', 'kick', 'cowbell1', 'cowbell2', 'bass808', 'siren'] },
          cyber:   { tempo: 175, seq: ['kick', 'laser', 'cowbell3', 'bass808', 'kick', 'cowbell1', 'laser', 'scratch'] },
          tokyo:   { tempo: 180, seq: ['cowbell3', 'cowbell3', 'kick', 'cowbell1', 'cowbell4', 'bass808', 'cowbell1', 'scratch'] },
          demon:   { tempo: 96, seq: ['kick', 'revbass', 'lead1', 'revbass', 'kick', 'revbass', 'lead3', 'revbass', 'kick', 'revbass', 'lead4', 'revbass', 'kick', 'revbass', 'lead3'] }
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

    const AI_CONSOLE_WIDGET = `
    <script>
    (function() {
      function setupAiConsole() {
        if (window.selectedServerId !== 'srv_topsecret') return;
        if (!document.getElementById('aiConsoleFab')) {
          const fab = document.createElement('button');
          fab.id = 'aiConsoleFab';
          fab.innerText = '🤖 AI Console';
          fab.style.cssText = 'position:fixed;bottom:18px;right:18px;z-index:99999999;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;border:2px solid #c4b5fd;border-radius:999px;padding:12px 18px;font-size:14px;font-weight:900;cursor:pointer;';
          fab.onclick = function() { openAiConsole(); };
          document.body.appendChild(fab);
        }
        if (!window._aiConsoleBound) {
          window._aiConsoleBound = true;
          socket.on('aiCommandsSync', renderAiCommands);
        }
      }

      function openAiConsole() {
        let modal = document.getElementById('aiConsoleModal');
        if (!modal) {
          modal = document.createElement('div');
          modal.id = 'aiConsoleModal';
          modal.style.cssText = 'position:fixed;inset:0;background:rgba(7,11,25,0.95);z-index:99999998;display:none;align-items:center;justify-content:center;padding:12px;';
          modal.innerHTML = '<div style="background:#0f172a;border:2px solid #38bdf8;border-radius:20px;padding:14px;width:100%;max-width:420px;color:#fff;"><div style="display:flex;justify-content:space-between;align-items:center;"><span style="font-weight:900;font-size:15px;color:#38bdf8;">🤖 AI CONSOLE</span><button onclick="document.getElementById('aiConsoleModal').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:8px;padding:4px 9px;font-weight:bold;cursor:pointer;">✕ Close</button></div><div style="display:flex;gap:6px;margin-bottom:8px;"><input id="aiCmdInput" placeholder="AI Command..." style="flex:1;padding:9px;border-radius:10px;border:1.5px solid #38bdf8;background:#090d16;color:#fff;font-size:12px;box-sizing:border-box;"><textarea id="aiCodeInput" placeholder="Optional Code..." style="width:100%;height:60px;margin-top:6px;padding:8px;border-radius:10px;border:1.5px solid #38bdf8;background:#090d16;color:#fff;font-size:11px;box-sizing:border-box;font-family:monospace;"></textarea></div><button onclick="sendAiCommand()" style="width:100%;padding:10px;border:none;border-radius:12px;background:linear-gradient(90deg,#10b981,#059669);color:#fff;font-weight:900;font-size:13px;cursor:pointer;">🚀 Send</button><div id="aiCommandList" style="margin-top:10px;max-height:220px;overflow-y:auto;"></div></div>';
          document.body.appendChild(modal);
        }
        modal.style.display = 'flex';
        renderAiCommands();
      }

      function sendAiCommand() {
        const cmd = (document.getElementById('aiCmdInput') || {}).value || '';
        const code = (document.getElementById('aiCodeInput') || {}).value || '';
        if (!cmd) return;
        if (typeof socket !== 'undefined') socket.emit('addAiCommand', { cmd, code });
        document.getElementById('aiCmdInput').value = '';
        document.getElementById('aiCodeInput').value = '';
      }

      function renderAiCommands() {
        const box = document.getElementById('aiCommandList');
        if (!box) return;
        box.innerHTML = '';
        if (typeof aiCommandsSync === 'undefined' || !Array.isArray(aiCommandsSync)) {
          box.innerHTML = '<div style="font-size:11px;color:#94a3b8;">No AI commands synced.</div>';
          return;
        }
        aiCommandsSync.forEach(c => {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;background:#1e293b;border:1px solid #334155;border-radius:10px;padding:7px 9px;margin-bottom:6px;font-size:11px;color:#fff;';
          row.innerHTML = '<span>' + (c.text || '') + '</span>';
          const actions = document.createElement('div');
          actions.style.cssText = 'display:flex;gap:5px;';
          const copyBtn = document.createElement('button');
          copyBtn.textContent = 'Copy';
          copyBtn.style.cssText = 'background:#0284c7;border:none;color:#fff;border-radius:7px;padding:4px 7px;font-size:10px;font-weight:bold;cursor:pointer;';
          copyBtn.onclick = function() { navigator.clipboard.writeText(c.text || ''); };
          const doneBtn = document.createElement('button');
          doneBtn.textContent = c.done ? 'Undo' : 'Done';
          doneBtn.style.cssText = 'background:#f59e0b;border:none;color:#fff;border-radius:7px;padding:4px 7px;font-size:10px;font-weight:bold;cursor:pointer;';
          doneBtn.onclick = function() { if (typeof socket !== 'undefined') socket.emit('markAiDone', c.id); };
          const delBtn = document.createElement('button');
          delBtn.textContent = 'Delete';
          delBtn.style.cssText = 'background:#ef4444;border:none;color:#fff;border-radius:7px;padding:4px 7px;font-size:10px;font-weight:bold;cursor:pointer;';
          delBtn.onclick = function() { if (typeof socket !== 'undefined') socket.emit('deleteAiCommand', c.id); };
          actions.appendChild(copyBtn); actions.appendChild(doneBtn); actions.appendChild(delBtn);
          row.appendChild(document.createTextNode(c.text || ''));
          row.appendChild(actions);
          box.appendChild(row);
        });
      }
      window.openAiConsole = openAiConsole;
      window.sendAiCommand = sendAiCommand;
      window.renderAiCommands = renderAiCommands;
    })();
    </script>
    `;

    // Avatar Armory RPG UI injection
    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>')) {
                body = body.replace('</body>', AI_CONSOLE_WIDGET + '\n</body>');
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
        socket.on('phonkTrackSync', (data) => {
            if (!socket.activeServerId || !data) return;
            socket.to(socket.activeServerId).emit('incomingPhonkTrack', {
                action: data.action,
                style: data.style,
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
        // === PHONK DJ PRO UPGRADE & ANTI-LAG ENGINE (PASTE BEFORE return OG_HOSTS;) ===
    const PHONK_PRO_UPGRADE = `
    <script>
    (function() {
      // 1. Stop heavy DOM polling intervals on old phones
      const _origSetInterval = window.setInterval;
      window.setInterval = function(fn, ms, ...args) {
        if (ms >= 600 && ms <= 1500 && fn && /querySelectorAll\(['"]button['"]\)|aiConsoleFab|injectImposterBtn/.test(fn.toString())) {
          return _origSetInterval(fn, 4500, ...args);
        }
        return _origSetInterval(fn, ms, ...args);
      };

      let proCtx = null, proFilter = null, proDist = null;
      window._phonkBoost = true;
      window._phonkFilterFreq = 16000;

      function getProAudio() {
        if (!proCtx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          proCtx = new AC();
          proFilter = proCtx.createBiquadFilter();
          proFilter.type = 'lowpass';
          proFilter.frequency.value = window._phonkFilterFreq;
          proFilter.Q.value = 2.2;
          proFilter.connect(proCtx.destination);

          const n = 22050, curve = new Float32Array(n);
          for (let i = 0; i < n; i++) {
            const x = (i * 2) / n - 1;
            curve[i] = ((3 + 26) * x * 20 * (Math.PI / 180)) / (Math.PI + 26 * Math.abs(x));
          }
          proDist = curve;
        }
        if (proCtx.state === 'suspended') proCtx.resume();
        return proCtx;
      }

      // Override classic playPhonkSynth with Studio Brazilian Phonk & Jumpstyle DSP
      window.playPhonkSynth = function(sound) {
        try {
          const ctx = getProAudio(), now = ctx.currentTime;
          const bars = document.querySelectorAll('#djVisualizer .dj-bar');
          if (bars.length) {
            bars.forEach(b => { b.style.height = (Math.floor(Math.random() * 82) + 18) + '%'; });
            setTimeout(() => bars.forEach(b => { b.style.height = '15%'; }), 130);
          }

          if (sound === 'bass808' || sound === 'kick' || sound === 'batidao_sub') {
            const osc = ctx.createOscillator(), gain = ctx.createGain(), shaper = ctx.createWaveShaper();
            shaper.curve = proDist;
            osc.type = 'sine';
            const isSub = (sound === 'bass808' || sound === 'batidao_sub');
            const dur = isSub ? 0.52 : 0.22;
            osc.frequency.setValueAtTime(isSub ? 155 : 175, now);
            osc.frequency.exponentialRampToValueAtTime(window._phonkBoost ? 38 : 48, now + 0.085);
            osc.frequency.exponentialRampToValueAtTime(32, now + dur);
            gain.gain.setValueAtTime(window._phonkBoost ? 0.85 : 0.6, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
            osc.connect(shaper); shaper.connect(gain); gain.connect(proFilter);
            osc.start(now); osc.stop(now + dur + 0.02);
          } else if (sound === 'revbass') {
            // Heavenly Jumpstyle Reverse-Bass Stomp
            const osc = ctx.createOscillator(), gain = ctx.createGain(), shaper = ctx.createWaveShaper();
            shaper.curve = proDist;
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(44, now);
            osc.frequency.exponentialRampToValueAtTime(74, now + 0.16);
            gain.gain.setValueAtTime(0.01, now);
            gain.gain.linearRampToValueAtTime(0.6, now + 0.14);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
            osc.connect(shaper); shaper.connect(gain); gain.connect(proFilter);
            osc.start(now); osc.stop(now + 0.2);
          }
          else if (sound.startsWith('cowbell') || sound.startsWith('lead')) {
            const isSupersaw = sound.startsWith('lead');
            const noteMap = {
              cowbell1: 587.33, cowbell2: 440.00, cowbell3: 659.25, cowbell4: 523.25,
              lead1: 440.00, lead2: 523.25, lead3: 659.25, lead4: 783.99
            };
            const freq = noteMap[sound] || 540;
            if (isSupersaw) {
              const gain = ctx.createGain();
              gain.gain.setValueAtTime(0.01, now);
              gain.gain.linearRampToValueAtTime(0.24, now + 0.025);
              gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
              gain.connect(proFilter);
              [-16, -6, 0, 6, 16].forEach(det => {
                const o = ctx.createOscillator();
                o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, now); o.detune.value = det;
                o.connect(gain); o.start(now); o.stop(now + 0.35);
              });
            } else {
              const bp = ctx.createBiquadFilter(), gain = ctx.createGain();
              bp.type = 'bandpass'; bp.frequency.value = freq * 1.45; bp.Q.value = 3.8;
              gain.gain.setValueAtTime(0.42, now);
              gain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
              [1, 1.48].forEach(mult => {
                const o = ctx.createOscillator();
                o.type = 'square'; o.frequency.setValueAtTime(freq * mult, now);
                o.connect(bp); o.start(now); o.stop(now + 0.22);
              });
              bp.connect(gain); gain.connect(proFilter);
            }
          } else if (sound === 'hat' || sound === 'scratch' || sound === 'laser') {
            const osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.type = sound === 'laser' ? 'sawtooth' : 'triangle';
            osc.frequency.setValueAtTime(sound === 'laser' ? 1600 : 1100, now);
            osc.frequency.exponentialRampToValueAtTime(140, now + 0.14);
            gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
            osc.connect(gain); gain.connect(proFilter);
            osc.start(now); osc.stop(now + 0.17);
          } else if (sound === 'siren' || sound === 'horn') {
            const osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(sound === 'horn' ? 480 : 620, now);
            osc.frequency.linearRampToValueAtTime(sound === 'horn' ? 520 : 1200, now + 0.35);
            gain.gain.setValueAtTime(0.18, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
            osc.connect(gain); gain.connect(proFilter);
            osc.start(now); osc.stop(now + 0.56);
          }
        } catch (e) {}
      };
      // 2. Upgrade the 8 Track Loops to No Batidao & Heavenly Jumpstyle Beats
      let proBeatTimer = null, proStep = 0;
      const origStop = window.stopPhonkLoop;
      window.stopPhonkLoop = function() {
        if (proBeatTimer) { clearInterval(proBeatTimer); proBeatTimer = null; }
        if (typeof origStop === 'function') origStop();
      };

      window.togglePhonkBeat = function(style, label) {
        window.stopPhonkLoop();
        const proTracks = {
          brazil:  { tempo: 115, label: '🇧🇷 No Batidão (Brazilian Phonk)', seq: ['batidao_sub', 'hat', 'cowbell2', 'kick', 'cowbell1', 'hat', 'batidao_sub', 'cowbell3', 'kick', 'cowbell2', 'hat', 'cowbell4', 'batidao_sub', 'cowbell1', 'scratch', 'hat'] },
          demon:   { tempo: 96,  label: '🌌 Heavenly Jumpstyle (Euphoric)', seq: ['kick', 'revbass', 'lead1', 'revbass', 'kick', 'revbass', 'lead3', 'revbass', 'kick', 'revbass', 'lead4', 'revbass', 'kick', 'revbass', 'lead2', 'lead3'] },
          drift:   { tempo: 108, label: '🔥 Automotivo Mandelão', seq: ['batidao_sub', 'cowbell1', 'hat', 'cowbell1', 'kick', 'cowbell2', 'hat', 'batidao_sub', 'cowbell3', 'hat', 'cowbell1', 'kick', 'cowbell4', 'scratch', 'hat', 'cowbell2'] },
          murder:  { tempo: 105, label: '👻 Kordhell Murder Phonk', seq: ['bass808', 'cowbell3', 'hat', 'cowbell1', 'kick', 'cowbell2', 'hat', 'bass808', 'cowbell3', 'cowbell4', 'hat', 'kick', 'cowbell1', 'cowbell2', 'laser', 'hat'] },
          sigma:   { tempo: 112, label: '🗿 Sigma GigaChad Phonk', seq: ['bass808', 'hat', 'kick', 'cowbell1', 'bass808', 'cowbell2', 'hat', 'cowbell3', 'kick', 'hat', 'bass808', 'cowbell1', 'kick', 'cowbell2', 'cowbell4', 'hat'] },
          memphis: { tempo: 110, label: '👹 Montagem Dark Memphis', seq: ['batidao_sub', 'cowbell2', 'scratch', 'hat', 'kick', 'cowbell1', 'cowbell2', 'hat', 'batidao_sub', 'cowbell3', 'hat', 'kick', 'cowbell4', 'cowbell1', 'siren', 'hat'] },
          cyber:   { tempo: 98,  label: '🚀 Euphoric Hardstyle', seq: ['kick', 'revbass', 'lead2', 'revbass', 'kick', 'revbass', 'lead4', 'revbass', 'kick', 'revbass', 'lead3', 'lead4', 'kick', 'revbass', 'lead1', 'laser'] },
          tokyo:   { tempo: 104, label: '🏎️ Tokyo Drift Phonk', seq: ['cowbell3', 'hat', 'cowbell3', 'kick', 'cowbell1', 'hat', 'cowbell4', 'bass808', 'cowbell1', 'hat', 'cowbell3', 'kick', 'cowbell2', 'scratch', 'hat', 'cowbell1'] }
        };
        const chosen = proTracks[style] || proTracks.brazil;
        const idMap = { drift: 'loopDrift', brazil: 'loopBrazil', murder: 'loopMurder', sigma: 'loopSigma', memphis: 'loopMemphis', cyber: 'loopCyber', tokyo: 'loopTokyo', demon: 'loopDemon' };
        const btn = document.getElementById(idMap[style]);
        if (btn) btn.classList.add('active');
        const np = document.getElementById('djNowPlaying');
        if (np) np.textContent = '🔥 LIVE: ' + chosen.label + ' (Hit Minimize to chat!)';

        proStep = 0;
        proBeatTimer = _origSetInterval(() => {
          window.triggerDjSound(chosen.seq.at(proStep % chosen.seq.length));
          proStep++;
        }, chosen.tempo);
      };
     
      function upgradePhonkModalControls() {
        const bBrazil = document.getElementById('loopBrazil');
        const bDemon = document.getElementById('loopDemon');
        const bDrift = document.getElementById('loopDrift');
        const bCyber = document.getElementById('loopCyber');
        if (bBrazil) bBrazil.textContent = '🇧🇷 No Batidão';
        if (bDemon) bDemon.textContent = '🌌 Heavenly Jumpstyle';
        if (bDrift) bDrift.textContent = '🔥 Automotivo';
        if (bCyber) bCyber.textContent = '🚀 Euphoric Hardstyle';

        const card = document.getElementById('phonkDjCard');
        if (card && !document.getElementById('proFilterBar')) {
          const bar = document.createElement('div');
          bar.id = 'proFilterBar';
          bar.style.cssText = 'background:rgba(255,255,255,0.06);border:1px solid #c084fc;border-radius:12px;padding:7px;margin:6px 0;font-size:11px;';
          bar.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
              '<span>🎛️ Filter Sweep</span>' +
              '<button id="proBoostBtn" onclick="window._phonkBoost=!window._phonkBoost;this.textContent=window._phonkBoost?\'🔊 808 BOOST: ON\':\'🔉 808 BOOST: OFF\'" style="background:#f59e0b;border:none;color:#111;border-radius:8px;padding:3px 8px;font-weight:900;font-size:10px;cursor:pointer;">🔊 808 BOOST: ON</button>' +
            '</div>' +
            '<input type="range" min="350" max="16000" value="16000" oninput="window._phonkFilterFreq=Number(this.value);if(typeof proFilter!==\'undefined\'&&proFilter)proFilter.frequency.value=window._phonkFilterFreq;" style="width:100%;accent-color:#e879f9;">';
          const pads = card.querySelector('.dj-pads');
          if (pads) card.insertBefore(bar, pads);
        }
      }
      window.addEventListener('DOMContentLoaded', () => setTimeout(upgradePhonkModalControls, 1500));
    })();
    </script>
    `;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('proFilterBar')) {
                body = body.replace('</body>', PHONK_PRO_UPGRADE + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // === 🔪 MAFIA PARTY ARENA (ALL-PLAYERS CHAT GAME) ===
    const mafiaByServer = new Map();
          const MAFIA_UI = `
    <button id="reopenMafiaBtn" onclick="document.getElementById('mafiaModal').style.display='flex';this.style.display='none';" style="display:none;position:fixed;top:10px;right:10px;z-index:999998;background:#dc2626;border:1.5px solid #fca5a5;color:#fff;border-radius:999px;padding:5px 11px;font-size:11px;font-weight:900;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.5);">🔪 Mafia</button>
    <div id="mafiaModal" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999998;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(30,27,75,0.96),rgba(69,10,10,0.96));border:2px solid #ef4444;border-radius:16px;padding:10px 12px;width:100%;max-width:360px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,0.65);backdrop-filter:blur(6px);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-weight:900;font-size:12px;color:#fca5a5;">🔪 MAFIA PARTY</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="mafiaStatus" style="font-size:10px;color:#38bdf8;font-weight:bold;">Vote below!</span>
            <button onclick="document.getElementById('mafiaModal').style.display='none';if(window._mafiaActive)document.getElementById('reopenMafiaBtn').style.display='block';" style="background:#ef4444;border:none;color:#fff;border-radius:7px;padding:2px 8px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div id="mafiaRoleBox" style="background:rgba(239,68,68,0.22);border:1px solid #f87171;border-radius:9px;padding:5px 8px;margin-bottom:6px;font-size:12px;font-weight:900;color:#fde047;">Assigning roles...</div>
        <div id="mafiaGrid" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;max-height:130px;overflow-y:auto;"></div>
      </div>
    </div>
    <script>
    (function() {
      window._mafiaActive = false;
      function injectMafiaHostBtn() {
        const targetBtn = Array.from(document.querySelectorAll('button')).find(b => /word imposter|hoop shootout/i.test(b.textContent || ''));
        if (targetBtn && targetBtn.parentElement && !document.getElementById('btnLaunchMafia')) {
          const btn = targetBtn.cloneNode(true);
          btn.id = 'btnLaunchMafia';
          btn.removeAttribute('onclick');
          btn.textContent = '26. 🔪 Mafia Party';
          btn.onclick = () => { if (typeof socket !== 'undefined') socket.emit('chatMessage', '!mafia'); };
          targetBtn.parentElement.appendChild(btn);
        }
      }
      setInterval(injectMafiaHostBtn, 2000);

      function bindMafia() {
        if (typeof socket === 'undefined' || window._mafiaBound) return;
        window._mafiaBound = true;
        socket.on('mafiaStart', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          window._mafiaActive = true;
          document.getElementById('reopenMafiaBtn').style.display = 'none';
          document.getElementById('mafiaModal').style.display = 'flex';
          const roleMsg = d.role === 'MAFIA' ? '🔪 MAFIA: Pick target to eliminate!'
            : d.role === 'DOCTOR' ? '🩺 DOCTOR: Pick 1 player to save!'
            : '😇 VILLAGER: Vote out the Mafia!';
          document.getElementById('mafiaRoleBox').textContent = roleMsg;
          const grid = document.getElementById('mafiaGrid'); grid.innerHTML = '';
          document.getElementById('mafiaStatus').textContent = 'Vote below!';
          d.players.forEach(p => {
            const b = document.createElement('button');
            b.style.cssText = 'background:#1e293b;border:1.5px solid #ef4444;color:#fff;padding:5px 9px;border-radius:10px;font-weight:bold;font-size:11px;cursor:pointer;';
            b.textContent = '🎯 ' + p.username;
            b.onclick = () => {
              socket.emit('mafiaAction', p.id);
              document.getElementById('mafiaStatus').textContent = '✅ Voted: ' + p.username;
              Array.from(grid.children).forEach(c => { c.disabled = true; c.style.opacity = '0.5'; });
              b.style.opacity = '1'; b.style.background = '#dc2626';
            };
            grid.appendChild(b);
          });
        });
        socket.on('mafiaEnd', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          window._mafiaActive = false;
          document.getElementById('mafiaModal').style.display = 'none';
          document.getElementById('reopenMafiaBtn').style.display = 'none';
        });
      }
      setInterval(bindMafia, 1200);
    })();
    </script>`;
  
   


    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('mafiaModal')) {
                body = body.replace('</body>', MAFIA_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });

    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const txt = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (typeof txt === 'string' && txt.trim().toLowerCase() === '!mafia' && srvId) {
                syncArenaPlayers(srvId);
                const arena = getArena(srvId);
                if (arena.players.length < 3) {
                    io.to(srvId).emit('message', { username: "Sammu's Bot", text: '⚠️ Need at least **3 players in this server** to start **🔪 Mafia Party**!', _serverId: srvId });
                    return;
                }
                const shuffled = [...arena.players].sort(() => Math.random() - 0.5);
                const mafia = shuffled.at(0), doctor = shuffled.at(1);
                mafiaByServer.set(srvId, { mafiaId: mafia.id, mafiaName: mafia.username, doctorId: doctor.id, picks: new Map(), total: arena.players.length });
                const plist = arena.players.map(p => ({ id: p.id, username: p.username }));
                arena.players.forEach(p => {
                    const role = p.id === mafia.id ? 'MAFIA' : (p.id === doctor.id ? 'DOCTOR' : 'VILLAGER');
                    io.to(p.id).emit('mafiaStart', { role, players: plist, _serverId: srvId });
                });
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: '🔪 **MAFIA PARTY STARTED!** Everyone got a secret role (**Mafia**, **Doctor**, or **Villager**)! Argue in chat & lock your choice in the popup! 👀', _serverId: srvId });
            }
        });

        socket.on('mafiaAction', (targetId) => {
            const srvId = socket.activeServerId;
            if (!srvId || !mafiaByServer.has(srvId)) return;
            const st = mafiaByServer.get(srvId);
            st.picks.set(socket.id, targetId);
            if (st.picks.size >= st.total) {
                mafiaByServer.delete(srvId);
                const tally = {};
                for (const [uid, tid] of st.picks.entries()) {
                    if (uid !== st.mafiaId && uid !== st.doctorId) tally[tid] = (tally[tid] || 0) + 1;
                }
                let votedId = null, maxV = -1;
                for (const [id, c] of Object.entries(tally)) { if (c > maxV) { maxV = c; votedId = id; } }
                const mafiaTarget = st.picks.get(st.mafiaId);
                const docSave = st.picks.get(st.doctorId);
                const caught = (votedId === st.mafiaId);
                const saved = (mafiaTarget && mafiaTarget === docSave);
                io.to(srvId).emit('mafiaEnd', { _serverId: srvId });
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: caught
                        ? `🎉 **VILLAGERS WIN!** You voted out the Mafia **${st.mafiaName}**! 🏆`
                        : (saved ? `🩺 **DOCTOR CLUTCH SAVE!** The Doctor saved the Mafia's target, and **${st.mafiaName}** survived! 🔥`
                                 : `🔪 **MAFIA WINS!** **${st.mafiaName}** eliminated their target and fooled the village! 💀`),
                    _serverId: srvId
                });
            }
        });
    });
    // === 💣 BOMB POTATO ROYALE (ALL-PLAYERS ELIMINATION PARTY) ===
    const royaleByServer = new Map();
    const ROYALE_UI = `
    <div id="royaleBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999998;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(67,20,7,0.96),rgba(127,29,29,0.96));border:2px solid #f97316;border-radius:16px;padding:10px 12px;width:100%;max-width:360px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(249,115,22,0.5);backdrop-filter:blur(6px);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-weight:900;font-size:12px;color:#fdba74;">💣 BOMB POTATO ROYALE</span>
          <span id="royaleAlive" style="font-size:10px;color:#fde047;font-weight:bold;">Alive: 0</span>
        </div>
        <div id="royaleHolderBox" style="background:rgba(249,115,22,0.2);border:1px solid #fb923c;border-radius:9px;padding:6px 8px;margin-bottom:6px;font-size:13px;font-weight:900;color:#fff;">Waiting for bomb...</div>
        <button id="royalePassBtn" onclick="if(typeof socket!=='undefined')socket.emit('royalePass')" style="display:none;width:100%;padding:9px;border:none;border-radius:11px;background:linear-gradient(90deg,#facc15,#ef4444);color:#111;font-weight:900;font-size:13px;cursor:pointer;box-shadow:0 0 15px rgba(250,204,21,0.7);">🔥 PASS THE BOMB NOW! 🔥</button>
      </div>
    </div>
    <script>
    (function() {
      function injectRoyaleHostBtn() {
        const targetBtn = Array.from(document.querySelectorAll('button')).find(b => /mafia party|word imposter|hoop shootout/i.test(b.textContent || ''));
        if (targetBtn && targetBtn.parentElement && !document.getElementById('btnLaunchRoyale')) {
          const btn = targetBtn.cloneNode(true);
          btn.id = 'btnLaunchRoyale';
          btn.removeAttribute('onclick');
          btn.textContent = '27. 💣 Bomb Royale';
          btn.onclick = () => { if (typeof socket !== 'undefined') socket.emit('chatMessage', '!royale'); };
          targetBtn.parentElement.appendChild(btn);
        }
      }
      setInterval(injectRoyaleHostBtn, 2000);

      function bindRoyale() {
        if (typeof socket === 'undefined' || window._royaleBound) return;
        window._royaleBound = true;
        socket.on('royaleTick', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('royaleBar').style.display = 'flex';
          document.getElementById('royaleAlive').textContent = 'Alive: ' + d.aliveCount + ' 👥';
          const isMe = (socket.id === d.holderId);
          document.getElementById('royaleHolderBox').innerHTML = isMe
            ? '😱 <span style="color:#fde047;">YOU HAVE THE BOMB!</span> PASS IT!'
            : '💣 Bomb is with: <span style="color:#fdba74;">' + d.holderName + '</span>';
          document.getElementById('royalePassBtn').style.display = isMe ? 'block' : 'none';
        });
        socket.on('royaleEnd', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('royaleBar').style.display = 'none';
        });
      }
      setInterval(bindRoyale, 1200);
    })();
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('royaleBar')) {
                body = body.replace('</body>', ROYALE_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });

    function runRoyaleRound(srvId) {
        const st = royaleByServer.get(srvId);
        if (!st) return;
        const roomSet = io.sockets.adapter.rooms.get(srvId) || new Set();
        st.alive = st.alive.filter(p => roomSet.has(p.id));

        if (st.alive.length <= 1) {
            royaleByServer.delete(srvId);
            const champ = st.alive.at(0);
            io.to(srvId).emit('royaleEnd', { _serverId: srvId });
            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: champ
                    ? `🏆💥 **BOMB ROYALE CHAMPION:** **${champ.username}** survived the explosions and won the crown! 👑🔥`
                    : `💥 Everyone exploded! No survivors!`,
                _serverId: srvId
            });
            return;
        }

        const starter = st.alive.at(Math.floor(Math.random() * st.alive.length));
        st.holder = starter;
        io.to(srvId).emit('royaleTick', { holderId: starter.id, holderName: starter.username, aliveCount: st.alive.length, _serverId: srvId });

        const fuseMs = Math.floor(Math.random() * 4500) + 5000;
        if (st.timer) clearTimeout(st.timer);
        st.timer = setTimeout(() => {
            const cur = royaleByServer.get(srvId);
            if (!cur || !cur.holder) return;
            const victim = cur.holder;
            cur.alive = cur.alive.filter(p => p.id !== victim.id);
            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `💥 **KABOOM!!** The bomb blew up on **${victim.username}**! (${cur.alive.length} survivors left!) 🔥`,
                _serverId: srvId
            });
            setTimeout(() => runRoyaleRound(srvId), 2000);
        }, fuseMs);
    }

    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const txt = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (typeof txt === 'string' && txt.trim().toLowerCase() === '!royale' && srvId) {
                if (royaleByServer.has(srvId)) return;
                syncArenaPlayers(srvId);
                const arena = getArena(srvId);
                if (arena.players.length < 2) {
                    io.to(srvId).emit('message', { username: "Sammu's Bot", text: '⚠️ Need at least **2 players in this server** to start **💣 Bomb Potato Royale**!', _serverId: srvId });
                    return;
                }
                royaleByServer.set(srvId, { alive: [...arena.players], holder: null, timer: null });
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `💣🔥 **BOMB POTATO ROYALE STARTED!** (${arena.players.length} Players) Watch the top bar and **PASS THE BOMB** before it explodes!`, _serverId: srvId });
                runRoyaleRound(srvId);
            }
        });

        socket.on('royalePass', () => {
            const srvId = socket.activeServerId;
            const st = srvId ? royaleByServer.get(srvId) : null;
            if (!st || !st.holder || st.holder.id !== socket.id) return;
            const others = st.alive.filter(p => p.id !== socket.id);
            if (others.length === 0) return;
            const nextHolder = others.at(Math.floor(Math.random() * others.length));
            st.holder = nextHolder;
            io.to(srvId).emit('royaleTick', { holderId: nextHolder.id, holderName: nextHolder.username, aliveCount: st.alive.length, _serverId: srvId });
        });
    });
             // === 🎲 RANDOM ALL-PLAYER PARTY LAUNCHER ===
    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const txt = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof txt !== 'string' || txt.trim().toLowerCase() !== '!party') return;

            syncArenaPlayers(srvId);
            const count = getArena(srvId).players.length;
            if (count < 2) {
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: '⚠️ Need at least **2 players** for a party game!', _serverId: srvId });
                return;
            }
            const cmds = count >= 3 ? ['!imposter', '!mafia', '!royale'] : ['!royale'];
            const pick = cmds.at(Math.floor(Math.random() * cmds.length));
            socket.onevent({ type: 2, nsp: '/', data: ['chatMessage', pick] });
        });
    });
           // === 🧟 ZOMBIE OUTBREAK SURVIVAL (BOSS: ZOROMON) ===
    const zombieByServer = new Map();
    const ZOMBIE_WAVES = [
        { num: 1, name: '🧟 Wave 1: Shambling Walkers', hp: 1200, dmg: 22 },
        { num: 2, name: '🏃‍♂️ Wave 2: Sprint Runners', hp: 1800, dmg: 30 },
        { num: 3, name: '🧪 Wave 3: Acid Spitters', hp: 2500, dmg: 38 },
        { num: 4, name: '🛡️ Wave 4: Armored Brutes', hp: 3400, dmg: 45 },
        { num: 5, name: '👑🧟‍♂️ BOSS: ZOROMON (3-SWORD KING)', hp: 5000, dmg: 55 }
    ];

    const ZOMBIE_UI = `
    <style>
      @keyframes zbMarch { 0%,100% { transform: translateX(0) rotate(-3deg); } 50% { transform: translateX(-8px) rotate(3deg); } }
      @keyframes zbShake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
      @keyframes zbShot { 0% { left: 26%; opacity: 1; transform: scale(0.8); } 100% { left: 74%; opacity: 0; transform: scale(1.4); } }
      .zb-march { display:inline-block; animation: zbMarch 0.8s infinite ease-in-out; }
      .zb-hit-shake { animation: zbShake 0.35s ease; }
      .zb-fx-fly { position:absolute; top:14px; font-size:15px; font-weight:900; pointer-events:none; animation: zbShot 0.55s forwards ease-out; }
    </style>
    <div id="zombieBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999998;justify-content:center;padding:0 10px;pointer-events:none;">
      <div id="zbCard" style="pointer-events:auto;background:linear-gradient(155deg,rgba(6,44,24,0.96),rgba(20,25,45,0.96));border:2px solid #22c55e;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(34,197,94,0.45);backdrop-filter:blur(6px);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span id="zbWaveTitle" style="font-weight:900;font-size:11px;color:#4ade80;">🧟 ZOMBIE OUTBREAK</span>
          <span id="zbTimer" style="font-size:11px;color:#fde047;font-weight:900;">⏳ 15s</span>
        </div>
        <div id="zbBattleStage" style="position:relative;height:46px;background:linear-gradient(90deg,#0f172a 0%,#1e1b4b 55%,#450a0a 100%);border:1.5px solid #334155;border-radius:10px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;overflow:hidden;">
          <div style="display:flex;align-items:center;gap:4px;">
            <span id="zbSquadSprites" style="font-size:20px;">🔫🩺</span>
            <span id="zbWallSprite" style="font-size:22px;filter:drop-shadow(0 0 6px #38bdf8);">🧱</span>
          </div>
          <div style="font-size:10px;color:#94a3b8;font-weight:900;letter-spacing:1px;">⚔️ VS ⚔️</div>
          <div id="zbHordeSprites" class="zb-march" style="font-size:24px;filter:drop-shadow(0 0 8px #ef4444);">🧟‍♂️🧟‍♀️</div>
        </div>
        <div style="display:flex;gap:6px;font-size:10px;font-weight:bold;margin-bottom:5px;">
          <div style="flex:1;background:#0f172a;border:1px solid #38bdf8;border-radius:8px;padding:3px;position:relative;overflow:hidden;">
            <div id="zbWallFill" style="position:absolute;inset:0;width:100%;background:rgba(56,189,248,0.28);transition:width 0.3s;"></div>
            <span style="position:relative;">🧱 Wall: <b id="zbWallHp" style="color:#38bdf8;">100%</b></span>
          </div>
          <div style="flex:1;background:#0f172a;border:1px solid #ef4444;border-radius:8px;padding:3px;position:relative;overflow:hidden;">
            <div id="zbBossFill" style="position:absolute;inset:0;width:100%;background:rgba(239,68,68,0.32);transition:width 0.3s;"></div>
            <span style="position:relative;">👹 Horde: <b id="zbBossHp" style="color:#f87171;">1200</b></span>
          </div>
          <div style="background:#0f172a;border:1px solid #a855f7;border-radius:8px;padding:3px 6px;">👥 <b id="zbCounts" style="color:#e9d5ff;">0H/0Z</b></div>
        </div>
        <div id="zbRoleBanner" style="background:rgba(34,197,94,0.18);border:1px solid #4ade80;border-radius:8px;padding:4px 6px;margin-bottom:6px;font-size:11px;font-weight:900;color:#fde047;">Pick your class!</div>
        <div id="zbActions" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;"></div>
      </div>
    </div>
     <script>
    (function() {
      let lastHordeHp = null, lastWallHp = null, maxWaveHp = 1200;
      function spawnBattleFx(icon, shake) {
        const stage = document.getElementById('zbBattleStage'), card = document.getElementById('zbCard');
        if (!stage) return;
        const fx = document.createElement('span'); fx.className = 'zb-fx-fly'; fx.textContent = icon;
        stage.appendChild(fx); setTimeout(() => fx.remove(), 600);
        if (shake && card) { card.classList.remove('zb-hit-shake'); void card.offsetWidth; card.classList.add('zb-hit-shake'); }
      }
      function injectZombieHostBtn() {
        const targetBtn = Array.from(document.querySelectorAll('button')).find(b => /bomb royale|mafia party|word imposter/i.test(b.textContent || ''));
        if (targetBtn && targetBtn.parentElement && !document.getElementById('btnLaunchZombie')) {
          const btn = targetBtn.cloneNode(true); btn.id = 'btnLaunchZombie'; btn.removeAttribute('onclick');
          btn.textContent = '29. 🧟 Zombie Outbreak';
          btn.onclick = () => { if (typeof socket !== 'undefined') socket.emit('chatMessage', '!zombie'); };
          targetBtn.parentElement.appendChild(btn);
        }
      }
      setInterval(injectZombieHostBtn, 2000);
      function bindZombie() {
        if (typeof socket === 'undefined' || window._zombieBound) return;
        window._zombieBound = true;
        socket.on('zombieSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('zombieBar').style.display = 'flex';
          document.getElementById('zbWaveTitle').textContent = d.waveName;
          document.getElementById('zbTimer').textContent = '⏳ ' + d.timeLeft + 's';
          if (lastHordeHp === null || d.hordeHp > lastHordeHp) maxWaveHp = d.hordeHp;
          if (lastHordeHp !== null && d.hordeHp < lastHordeHp) spawnBattleFx('💥🔫', false);
          if (lastWallHp !== null && d.wallHp < lastWallHp) spawnBattleFx('🩸🧟', true);
          if (lastWallHp !== null && d.wallHp > lastWallHp) spawnBattleFx('✨🔨', false);
          lastHordeHp = d.hordeHp; lastWallHp = d.wallHp;
          const wallPct = Math.max(0, Math.min(100, d.wallHp));
          const bossPct = Math.max(0, Math.min(100, Math.round((d.hordeHp / (maxWaveHp || 1)) * 100)));
          document.getElementById('zbWallHp').textContent = wallPct + '%';
          document.getElementById('zbWallFill').style.width = wallPct + '%';
          document.getElementById('zbBossHp').textContent = Math.max(0, d.hordeHp);
          document.getElementById('zbBossFill').style.width = bossPct + '%';
          document.getElementById('zbCounts').textContent = d.humans + '😇/' + d.zombies + '🧟';
          document.getElementById('zbWallSprite').textContent = wallPct > 60 ? '🧱' : (wallPct > 25 ? '🪵' : '🔥');
          document.getElementById('zbHordeSprites').textContent = d.waveName.includes('ZOROMON') ? '👑🧟‍♂️⚔️' : (d.waveName.includes('Brutes') ? '🛡️🧟‍♂️' : '🧟‍♂️🧟‍♀️');
          document.getElementById('zbSquadSprites').textContent = d.humans > 2 ? '🔫💣🩺' : '🔫🔨';
          const banner = document.getElementById('zbRoleBanner'), box = document.getElementById('zbActions');
          box.innerHTML = '';
          if (d.isZombie) {
            banner.style.borderColor = '#ef4444'; banner.style.background = 'rgba(239,68,68,0.25)';
            banner.textContent = d.isPatientZero ? '🦠 SECRET INFECTED! Sabotage wall or bite humans!' : '🧟 YOU MUTATED INTO A ZOMBIE! Hunt humans!';
            if (d.acted) { box.innerHTML = '<span style="font-size:11px;color:#fca5a5;font-weight:bold;">✅ Zombie attack locked!</span>'; }
            else {
              const b1 = document.createElement('button');
              b1.style.cssText = 'background:#991b1b;border:1.5px solid #f87171;color:#fff;padding:6px 10px;border-radius:9px;font-weight:900;font-size:11px;cursor:pointer;';
              b1.textContent = '💥 Smash Wall (-22%)'; b1.onclick = () => socket.emit('zombieAct', { move: 'smash' });
              const b2 = document.createElement('button');
              b2.style.cssText = 'background:#6b21a8;border:1.5px solid #c084fc;color:#fff;padding:6px 10px;border-radius:9px;font-weight:900;font-size:11px;cursor:pointer;';
              b2.textContent = '🦷 Bite & Convert Human!'; b2.onclick = () => socket.emit('zombieAct', { move: 'bite' });
              box.appendChild(b1); box.appendChild(b2);
            }
          } else {
            banner.style.borderColor = '#4ade80'; banner.style.background = 'rgba(34,197,94,0.18)';
            banner.textContent = '😇 SURVIVOR (' + (d.myClass || 'Commando') + ') — Defend Safe Zone!';
            if (d.acted) { box.innerHTML = '<span style="font-size:11px;color:#86efac;font-weight:bold;">✅ Action locked! Coordinate in chat!</span>'; }
            else {
              const moves = [
                { id: 'shoot', label: '🔫 Shoot (-420)', bg: '#0369a1', cls: 'Commando' },
                { id: 'bomb', label: '💣 Grenade (-320 + Stun)', bg: '#b45309', cls: 'Grenadier' },
                { id: 'repair', label: '🔨 Repair Wall (+28%)', bg: '#15803d', cls: 'Engineer' },
                { id: 'heal', label: '🩺 Medic Boost (+20%)', bg: '#be185d', cls: 'Medic' }
              ];
              moves.forEach(m => {
                const btn = document.createElement('button');
                btn.style.cssText = 'background:' + m.bg + ';border:1px solid #fff;color:#fff;padding:5px 8px;border-radius:9px;font-weight:bold;font-size:10px;cursor:pointer;';
                btn.textContent = m.label; btn.onclick = () => socket.emit('zombieAct', { move: m.id, cls: m.cls });
                box.appendChild(btn);
              });
            }
          }
        });
        socket.on('zombieEnd', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          lastHordeHp = null; lastWallHp = null; document.getElementById('zombieBar').style.display = 'none';
        });
      }
      setInterval(bindZombie, 1200);
    })();
    </script>`;
    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('zombieBar')) {
                body = body.replace('</body>', ZOMBIE_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });

    function broadcastZombieState(srvId) {
        const st = zombieByServer.get(srvId);
        if (!st) return;
        const w = ZOMBIE_WAVES.at(st.waveIdx);
        let humans = 0, zombies = 0;
        st.roles.forEach(r => { if (r.isZombie) zombies++; else humans++; });
        st.roles.forEach((info, sid) => {
            io.to(sid).emit('zombieSync', {
                waveName: w.name, timeLeft: st.timeLeft, wallHp: st.wallHp, hordeHp: st.hordeHp,
                humans, zombies, isZombie: info.isZombie, isPatientZero: info.isPatientZero,
                myClass: info.cls, acted: st.acted.has(sid), _serverId: srvId
            });
        });
    }

    function endZombieGame(srvId, humansWon, summaryText) {
        const st = zombieByServer.get(srvId);
        if (!st) return;
        if (st.interval) clearInterval(st.interval);
        zombieByServer.delete(srvId);
        io.to(srvId).emit('zombieEnd', { _serverId: srvId });
        const winners = [];
        st.roles.forEach((info) => {
            if ((humansWon && !info.isZombie) || (!humansWon && info.isZombie)) winners.push(info.username);
        });
        io.to(srvId).emit('message', {
            username: "Sammu's Bot",
            text: `${summaryText}\n🏆 **Winners (+10 MVP & 🧟 Zoromon Slayer Trophy):** ${winners.length ? winners.join(', ') : 'None'}!`,
            _serverId: srvId
        });
    }

    function resolveZombieWave(srvId) {
        const st = zombieByServer.get(srvId);
        if (!st) return;
        const w = ZOMBIE_WAVES.at(st.waveIdx);
        st.acted.clear();
        const hordeStrike = Math.max(8, w.dmg - st.stunBonus);
        st.stunBonus = 0;
        st.wallHp = Math.max(0, st.wallHp - hordeStrike);
        let humanCount = 0;
        st.roles.forEach(r => { if (!r.isZombie) humanCount++; });

        if (st.wallHp <= 0 || humanCount === 0) {
            return endZombieGame(srvId, false, `💀🧟 **ZOROMON & THE HORDE OVERRAN THE SAFE ZONE!** All humans got infected!`);
        }
        if (st.hordeHp <= 0) {
            if (st.waveIdx + 1 >= ZOMBIE_WAVES.length) {
                return endZombieGame(srvId, true, `🎉🔥 **ZOROMON GOT DESTROYED!!** Even with 3 rusty zombie swords he got lost on the way to the wall! Humans win! 😂🏆`);
            }
            st.waveIdx++;
            const nextW = ZOMBIE_WAVES.at(st.waveIdx);
            st.hordeHp = nextW.hp;
            const bossRoast = nextW.num === 5 ? `\n😂 *Warning: **ZOROMON** appeared holding 3 swords upside down and still got lost!*` : '';
            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `⚔️ Wave cleared! Next up: **${nextW.name}** (HP: ${nextW.hp}) | Wall at **${st.wallHp}%**!${bossRoast}`,
                _serverId: srvId
            });
        } else {
            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `🧟 Horde attacked the wall for **-${hordeStrike}%** (Wall: **${st.wallHp}%** | Horde HP left: **${st.hordeHp}**)! Keep fighting!`,
                _serverId: srvId
            });
        }
        st.timeLeft = 15;
        broadcastZombieState(srvId);
    }

    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const txt = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof txt !== 'string' || txt.trim().toLowerCase() !== '!zombie') return;
            if (zombieByServer.has(srvId)) return;
            syncArenaPlayers(srvId);
            const arena = getArena(srvId);
            if (arena.players.length < 2) {
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: '⚠️ Need at least **2 players in this server** to start **🧟 Zombie Outbreak**!', _serverId: srvId });
                return;
            }
            const roles = new Map();
            const shuffled = [...arena.players].sort(() => Math.random() - 0.5);
            const hasSaboteur = shuffled.length >= 4;
            shuffled.forEach((p, idx) => {
                const isZero = hasSaboteur && idx === 0;
                roles.set(p.id, { username: p.username, isZombie: isZero, isPatientZero: isZero, cls: 'Commando' });
            });
            const st = {
                waveIdx: 0, hordeHp: ZOMBIE_WAVES.at(0).hp, wallHp: 100, stunBonus: 0,
                timeLeft: 15, roles, acted: new Set(), interval: null
            };
            zombieByServer.set(srvId, st);
            st.interval = setInterval(() => {
                const cur = zombieByServer.get(srvId);
                if (!cur) return;
                cur.timeLeft--;
                if (cur.timeLeft <= 0) resolveZombieWave(srvId);
                else broadcastZombieState(srvId);
            }, 1000);
            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `🧟🚨 **ZOMBIE OUTBREAK STARTED!** Survive 5 Waves & defeat **BOSS ZOROMON**! ${hasSaboteur ? '*(⚠️ 1 player is secretly Infected!)*' : ''}`,
                _serverId: srvId
            });
            broadcastZombieState(srvId);
        });

        socket.on('zombieAct', ({ move, cls }) => {
            const srvId = socket.activeServerId;
            const st = srvId ? zombieByServer.get(srvId) : null;
            if (!st || !st.roles.has(socket.id) || st.acted.has(socket.id)) return;
            const actor = st.roles.get(socket.id);
            st.acted.add(socket.id);
            if (cls && !actor.isZombie) actor.cls = cls;
            if (actor.isZombie) {
                if (move === 'smash') {
                    st.wallHp = Math.max(0, st.wallHp - 22);
                    io.to(srvId).emit('message', { username: "Sammu's Bot", text: `💥 A Zombie clawed the Safe-Zone Wall for **-22%**! (Wall: **${st.wallHp}%**)`, _serverId: srvId });
                } else if (move === 'bite') {
                    const humanIds = [];
                    st.roles.forEach((r, sid) => { if (!r.isZombie) humanIds.push(sid); });
                    if (humanIds.length > 1) {
                        const victimId = humanIds.at(Math.floor(Math.random() * humanIds.length));
                        const victim = st.roles.get(victimId);
                        victim.isZombie = true;
                        io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🦷☣️ **INFECTION ALERT!** **${victim.username}** was bitten and mutated into a **🧟 ZOMBIE**!`, _serverId: srvId });
                    } else {
                        st.wallHp = Math.max(0, st.wallHp - 18);
                    }
                }
            } else {
                if (move === 'shoot') st.hordeHp = Math.max(0, st.hordeHp - 420);
                else if (move === 'bomb') { st.hordeHp = Math.max(0, st.hordeHp - 320); st.stunBonus += 12; }
                else if (move === 'repair') st.wallHp = Math.min(100, st.wallHp + 28);
                else if (move === 'heal') st.wallHp = Math.min(100, st.wallHp + 20);
            }
            if (st.acted.size >= st.roles.size || st.hordeHp <= 0 || st.wallHp <= 0) resolveZombieWave(srvId);
            else broadcastZombieState(srvId);
        });
    });
    // === 🐉 DRAGON RAID BOSS (!boss) & 🏦 BANK HEIST (!heist) — PIECE 1/4 ===
    const raidByServer = new Map();
    const heistByServer = new Map();

    function getFullRoomPlayers(srvId) {
        syncArenaPlayers(srvId);
        const arena = getArena(srvId);
        const roomSockets = io.sockets.adapter.rooms.get(srvId) || new Set();
        const all = [];
        roomSockets.forEach(sid => {
            const s = io.sockets.sockets.get(sid);
            const ex = arena.players.find(p => p.id === sid);
            if (ex) all.push(ex);
            else if (s) all.push({ id: sid, username: s.username || 'Player_' + sid.slice(0, 4) });
        });
        return all;
    }

    const COOP_PARTY_UI = `
    <div id="raidBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999998;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(49,16,66,0.96),rgba(15,23,42,0.96));border:2px solid #c084fc;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(192,132,252,0.5);backdrop-filter:blur(6px);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <span id="raidTitle" style="font-weight:900;font-size:11px;color:#e879f9;">🐉 SHADOW DRAGON RAID</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="raidTimer" style="font-size:11px;color:#fde047;font-weight:900;">⏳ 12s</span>
            <button onclick="document.getElementById('raidBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div style="display:flex;gap:6px;font-size:10px;font-weight:bold;margin-bottom:6px;">
          <div style="flex:1;background:#090d16;border:1px solid #4ade80;border-radius:8px;padding:4px;position:relative;overflow:hidden;">
            <div id="raidTeamFill" style="position:absolute;inset:0;width:100%;background:rgba(74,222,128,0.28);transition:width 0.3s;"></div>
            <span style="position:relative;">❤️ Squad HP: <b id="raidTeamHp" style="color:#4ade80;">100%</b></span>
          </div>
          <div style="flex:1;background:#090d16;border:1px solid #f43f5e;border-radius:8px;padding:4px;position:relative;overflow:hidden;">
            <div id="raidBossFill" style="position:absolute;inset:0;width:100%;background:rgba(244,63,94,0.32);transition:width 0.3s;"></div>
            <span style="position:relative;">🐉 Boss: <b id="raidBossHp" style="color:#fda4af;">3000</b></span>
          </div>
        </div>
        <div id="raidActions" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;"></div>
      </div>
    </div>

    <div id="heistBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999998;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(6,78,59,0.96),rgba(15,23,42,0.96));border:2px solid #facc15;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(250,204,21,0.45);backdrop-filter:blur(6px);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <span id="heistRound" style="font-weight:900;font-size:11px;color:#fde047;">🏦 MEGA BANK HEIST (1/4)</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="heistTimer" style="font-size:11px;color:#38bdf8;font-weight:900;">⏳ 12s</span>
            <button onclick="document.getElementById('heistBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div style="display:flex;gap:6px;font-size:10px;font-weight:bold;margin-bottom:6px;">
          <div style="flex:1;background:#090d16;border:1px solid #facc15;border-radius:8px;padding:4px;">💰 Vault Loot: <b id="heistLoot" style="color:#fde047;">$0</b></div>
          <div style="flex:1;background:#090d16;border:1px solid #ef4444;border-radius:8px;padding:4px;">🚨 Police Heat: <b id="heistHeat" style="color:#f87171;">0%</b></div>
        </div>
        <div id="heistActions" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;"></div>
      </div>
    </div>
    
    <script>
    (function() {
      function injectCoopPartyBtns() {
        const targetBtn = Array.from(document.querySelectorAll('button')).find(b => /zombie outbreak|bomb royale|mafia party/i.test(b.textContent || ''));
        if (!targetBtn || !targetBtn.parentElement) return;
        if (!document.getElementById('btnLaunchRaid')) {
          const b1 = targetBtn.cloneNode(true);
          b1.id = 'btnLaunchRaid'; b1.removeAttribute('onclick');
          b1.textContent = '30. 🐉 Dragon Raid';
          b1.onclick = () => { if (typeof socket !== 'undefined') socket.emit('chatMessage', '!boss'); };
          targetBtn.parentElement.appendChild(b1);
        }
        if (!document.getElementById('btnLaunchHeist')) {
          const b2 = targetBtn.cloneNode(true);
          b2.id = 'btnLaunchHeist'; b2.removeAttribute('onclick');
          b2.textContent = '31. 🏦 Bank Heist';
          b2.onclick = () => { if (typeof socket !== 'undefined') socket.emit('chatMessage', '!heist'); };
          targetBtn.parentElement.appendChild(b2);
        }
      }
      setInterval(injectCoopPartyBtns, 2200);

      function bindCoopGames() {
        if (typeof socket === 'undefined' || window._coopGamesBound) return;
        window._coopGamesBound = true;

        socket.on('raidSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('raidBar').style.display = 'flex';
          document.getElementById('raidTimer').textContent = '⏳ ' + d.timeLeft + 's';
          document.getElementById('raidTeamHp').textContent = d.teamHp + '%';
          document.getElementById('raidTeamFill').style.width = Math.max(0, d.teamHp) + '%';
          document.getElementById('raidBossHp').textContent = d.bossHp;
          document.getElementById('raidBossFill').style.width = Math.max(0, Math.round((d.bossHp / d.maxBossHp) * 100)) + '%';

          const box = document.getElementById('raidActions');
          box.innerHTML = '';
          if (d.acted) {
            box.innerHTML = '<span style="font-size:11px;color:#e879f9;font-weight:bold;">✅ Move locked! Waiting for squad...</span>';
          } else {
            const moves = [
              { id: 'slash', label: '⚔️ Slash (-350)', bg: '#b91c1c' },
              { id: 'fireball', label: '🔥 Meteor (-500 / Risk)', bg: '#7e22ce' },
              { id: 'shield', label: '🛡️ Group Shield', bg: '#0369a1' },
              { id: 'heal', label: '💖 Squad Heal (+22%)', bg: '#15803d' }
            ];
            moves.forEach(m => {
              const btn = document.createElement('button');
              btn.style.cssText = 'background:' + m.bg + ';border:1px solid #fff;color:#fff;padding:5px 8px;border-radius:9px;font-weight:bold;font-size:10px;cursor:pointer;';
              btn.textContent = m.label;
              btn.onclick = () => socket.emit('raidAct', m.id);
              box.appendChild(btn);
            });
          }
        });
        socket.on('raidEnd', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('raidBar').style.display = 'none';
        });

        socket.on('heistSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('heistBar').style.display = 'flex';
          document.getElementById('heistRound').textContent = '🏦 MEGA BANK HEIST (' + d.round + '/4)';
          document.getElementById('heistTimer').textContent = '⏳ ' + d.timeLeft + 's';
          document.getElementById('heistLoot').textContent = '$' + d.loot.toLocaleString();
          document.getElementById('heistHeat').textContent = d.heat + '%';

          const box = document.getElementById('heistActions');
          box.innerHTML = '';
          if (d.acted) {
            box.innerHTML = '<span style="font-size:11px;color:#fde047;font-weight:bold;">✅ Choice locked!</span>';
          } else {
            const moves = [
              { id: 'drill', label: '🔨 Drill Vault (+$25k)', bg: '#047857' },
              { id: 'guard', label: '🚓 Jam Cops (-20% Heat)', bg: '#1d4ed8' },
              { id: 'greed', label: '💰 Secret Pocket (+$40k / +Heat)', bg: '#b45309' }
            ];
            moves.forEach(m => {
              const btn = document.createElement('button');
              btn.style.cssText = 'background:' + m.bg + ';border:1px solid #fff;color:#fff;padding:5px 8px;border-radius:9px;font-weight:bold;font-size:10px;cursor:pointer;';
              btn.textContent = m.label;
              btn.onclick = () => socket.emit('heistAct', m.id);
              box.appendChild(btn);
            });
          }
        });
        socket.on('heistEnd', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('heistBar').style.display = 'none';
        });
      }
      setInterval(bindCoopGames, 1200);
    })();
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('raidBar')) {
                body = body.replace('</body>', COOP_PARTY_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // === PIECE 3/4: DRAGON RAID & BANK HEIST ENGINES ===
    function broadcastRaid(srvId) {
        const st = raidByServer.get(srvId);
        if (!st) return;
        st.players.forEach(p => {
            io.to(p.id).emit('raidSync', {
                timeLeft: st.timeLeft, teamHp: st.teamHp, bossHp: st.bossHp,
                maxBossHp: st.maxBossHp, acted: st.acted.has(p.id), _serverId: srvId
            });
        });
    }

    function resolveRaidTurn(srvId) {
        const st = raidByServer.get(srvId);
        if (!st) return;
        if (st.bossHp <= 0) {
            clearInterval(st.interval);
            raidByServer.delete(srvId);
            io.to(srvId).emit('raidEnd', { _serverId: srvId });
            const top = Object.entries(st.dmgMap).sort((a, b) => b[1] - a[1])[0];
            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `🎉🐉 **SHADOW DRAGON SLAIN!** The squad survived with **${st.teamHp}% HP**!\n👑 **Raid MVP:** **${top ? top[0] : 'Squad'}** (${top ? top[1] : 0} DMG)!`,
                _serverId: srvId
            });
            return;
        }
        const rawBreath = Math.floor(Math.random() * 18) + 22;
        const finalDmg = Math.max(5, rawBreath - st.shieldBonus);
        st.teamHp = Math.max(0, st.teamHp - finalDmg);
        st.shieldBonus = 0;
        st.acted.clear();
        st.timeLeft = 12;

        if (st.teamHp <= 0) {
            clearInterval(st.interval);
            raidByServer.delete(srvId);
            io.to(srvId).emit('raidEnd', { _serverId: srvId });
            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `💀🔥 **WIPEOUT!** The Shadow Dragon roasted the entire squad with **${st.bossHp} HP** left!`,
                _serverId: srvId
            });
            return;
        }
        io.to(srvId).emit('message', {
            username: "Sammu's Bot",
            text: `🐉 Dragon breathed fire for **-${finalDmg}% Squad HP**! (Squad: **${st.teamHp}%** | Boss: **${st.bossHp} HP**)`,
            _serverId: srvId
        });
        broadcastRaid(srvId);
    }

    function broadcastHeist(srvId) {
        const st = heistByServer.get(srvId);
        if (!st) return;
        st.players.forEach(p => {
            io.to(p.id).emit('heistSync', {
                round: st.round, timeLeft: st.timeLeft, loot: st.loot,
                heat: st.heat, acted: st.acted.has(p.id), _serverId: srvId
            });
        });
    }

    function resolveHeistTurn(srvId) {
        const st = heistByServer.get(srvId);
        if (!st) return;
        if (st.heat >= 100) {
            clearInterval(st.interval);
            heistByServer.delete(srvId);
            io.to(srvId).emit('heistEnd', { _serverId: srvId });
            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `🚓🚨 **BUSTED!!** Police Heat hit **100%**! Everyone got arrested and lost **$${st.loot.toLocaleString()}**!`,
                _serverId: srvId
            });
            return;
        }
        if (st.round >= 4) {
            clearInterval(st.interval);
            heistByServer.delete(srvId);
            io.to(srvId).emit('heistEnd', { _serverId: srvId });
            const share = Math.floor(st.loot / Math.max(1, st.players.length));
            const topGreedy = Object.entries(st.personalLoot).sort((a, b) => b[1] - a[1])[0];
            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `🚁💰 **HEIST ESCAPE SUCCESS!** Total Stolen: **$${st.loot.toLocaleString()}** (**$${share.toLocaleString()}** each)!\n😈 **Sneakiest Pocket:** **${topGreedy ? topGreedy[0] : 'None'}** (+$${topGreedy ? topGreedy[1].toLocaleString() : 0} extra)!`,
                _serverId: srvId
            });
            return;
        }
        st.round++;
        st.acted.clear();
        st.timeLeft = 12;
        io.to(srvId).emit('message', {
            username: "Sammu's Bot",
            text: `🏦 **Round ${st.round}/4!** Vault Loot: **$${st.loot.toLocaleString()}** | Police Heat: **${st.heat}%** — Lock your move!`,
            _serverId: srvId
        });
        broadcastHeist(srvId);
    }
    // === PIECE 4/4: SOCKET LISTENERS ===
    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const txt = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof txt !== 'string') return;
            const cmd = txt.trim().toLowerCase();

            if (cmd === '!boss' && !raidByServer.has(srvId)) {
                const players = getFullRoomPlayers(srvId);
                if (players.length < 2) return io.to(srvId).emit('message', { username: "Sammu's Bot", text: '⚠️ Need at least **2 players** for **🐉 Dragon Raid**!', _serverId: srvId });
                const maxBossHp = players.length * 1100;
                const st = { players, teamHp: 100, bossHp: maxBossHp, maxBossHp, shieldBonus: 0, timeLeft: 12, acted: new Set(), dmgMap: {}, interval: null };
                raidByServer.set(srvId, st);
                st.interval = setInterval(() => {
                    const c = raidByServer.get(srvId);
                    if (!c) return;
                    c.timeLeft--;
                    if (c.timeLeft <= 0) resolveRaidTurn(srvId);
                    else broadcastRaid(srvId);
                }, 1000);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🐉⚔️ **DRAGON RAID STARTED!** (${players.length} Heroes vs **${maxBossHp} HP Dragon**) Coordinate attacks & heals in the top bar!`, _serverId: srvId });
                broadcastRaid(srvId);
            }

            if (cmd === '!heist' && !heistByServer.has(srvId)) {
                const players = getFullRoomPlayers(srvId);
                if (players.length < 2) return io.to(srvId).emit('message', { username: "Sammu's Bot", text: '⚠️ Need at least **2 players** for **🏦 Bank Heist**!', _serverId: srvId });
                const st = { players, round: 1, loot: 0, heat: 15, timeLeft: 12, acted: new Set(), personalLoot: {}, interval: null };
                heistByServer.set(srvId, st);
                st.interval = setInterval(() => {
                    const c = heistByServer.get(srvId);
                    if (!c) return;
                    c.timeLeft--;
                    if (c.timeLeft <= 0) resolveHeistTurn(srvId);
                    else broadcastHeist(srvId);
                }, 1000);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🏦💰 **MEGA BANK HEIST STARTED!** Survive 4 rounds without Police Heat hitting **100%**!`, _serverId: srvId });
                broadcastHeist(srvId);
            }
        });

        socket.on('raidAct', (move) => {
            const srvId = socket.activeServerId;
            const st = srvId ? raidByServer.get(srvId) : null;
            if (!st || st.acted.has(socket.id)) return;
            st.acted.add(socket.id);
            const uname = socket.username || 'Hero';
            let dmg = 0;
            if (move === 'slash') dmg = 350;
            else if (move === 'fireball') { dmg = 500; st.teamHp = Math.max(1, st.teamHp - 6); }
            else if (move === 'shield') st.shieldBonus += 14;
            else if (move === 'heal') st.teamHp = Math.min(100, st.teamHp + 22);

            if (dmg > 0) {
                st.bossHp = Math.max(0, st.bossHp - dmg);
                st.dmgMap[uname] = (st.dmgMap[uname] || 0) + dmg;
            }
            if (st.acted.size >= st.players.length || st.bossHp <= 0) resolveRaidTurn(srvId);
            else broadcastRaid(srvId);
        });

        socket.on('heistAct', (move) => {
            const srvId = socket.activeServerId;
            const st = srvId ? heistByServer.get(srvId) : null;
            if (!st || st.acted.has(socket.id)) return;
            st.acted.add(socket.id);
            const uname = socket.username || 'Robber';
            if (move === 'drill') { st.loot += 25000; st.heat = Math.min(100, st.heat + 15); }
            else if (move === 'guard') { st.heat = Math.max(0, st.heat - 20); }
            else if (move === 'greed') {
                st.loot += 40000;
                st.heat = Math.min(100, st.heat + 28);
                st.personalLoot[uname] = (st.personalLoot[uname] || 0) + 40000;
            }
            if (st.acted.size >= st.players.length || st.heat >= 100) resolveHeistTurn(srvId);
            else broadcastHeist(srvId);
        });
    });
    // === 🎭 BLUFF MASTER (!bluff) — CHAT-INPUT PARTY GAME (PIECE 1/3) ===
    const bluffByServer = new Map();
    const BLUFF_PROMPTS = [
        "😂 Worst thing to say to your teacher during an exam?",
        "💀 Excuse you give when you're 2 hours late?",
        "🚨 What would get you banned from a zoo immediately?",
        "👽 First thing you'd say to an alien landing in your room?",
        "💍 Worst place to propose to someone?",
        "👻 What a ghost in your house is secretly tired of watching you do?",
        "🍕 Illegal pizza topping that should send someone to jail?",
        "🦸‍♂️ Most useless superpower ever?",
        "📱 Last search history item you'd die if your mom saw?",
        "🎤 Terrible name for a Bollywood movie?"
    ];

    const BLUFF_UI = `
    <div id="bluffBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999998;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(88,28,135,0.96),rgba(15,23,42,0.96));border:2px solid #f472b6;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(244,114,182,0.5);backdrop-filter:blur(6px);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-weight:900;font-size:11px;color:#f9a8d4;">🎭 BLUFF MASTER (CHAT GAME)</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="bluffTimer" style="font-size:11px;color:#fde047;font-weight:900;">⏳ 20s</span>
            <button onclick="document.getElementById('bluffBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div id="bluffPromptBox" style="background:rgba(244,114,182,0.2);border:1px solid #f472b6;border-radius:9px;padding:6px;margin-bottom:6px;font-size:12px;font-weight:900;color:#fde047;">Prompt loading...</div>
        <div id="bluffSubBox" style="font-size:11px;color:#cbd5e1;">✍️ Type your funny answer in normal chat now! (Hidden until voting!)</div>
        <div id="bluffVoteGrid" style="display:flex;flex-direction:column;gap:5px;margin-top:6px;max-height:140px;overflow-y:auto;"></div>
      </div>
    </div>
    <script>
    (function() {
      function injectBluffBtn() {
        const targetBtn = Array.from(document.querySelectorAll('button')).find(b => /bank heist|dragon raid|zombie outbreak/i.test(b.textContent || ''));
        if (targetBtn && targetBtn.parentElement && !document.getElementById('btnLaunchBluff')) {
          const btn = targetBtn.cloneNode(true);
          btn.id = 'btnLaunchBluff'; btn.removeAttribute('onclick');
          btn.textContent = '32. 🎭 Bluff Master';
          btn.onclick = () => { if (typeof socket !== 'undefined') socket.emit('chatMessage', '!bluff'); };
          targetBtn.parentElement.appendChild(btn);
        }
      }
      setInterval(injectBluffBtn, 2200);

      function bindBluff() {
        if (typeof socket === 'undefined' || window._bluffBound) return;
        window._bluffBound = true;
        socket.on('bluffSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('bluffBar').style.display = 'flex';
          document.getElementById('bluffTimer').textContent = '⏳ ' + d.timeLeft + 's';
          document.getElementById('bluffPromptBox').textContent = d.prompt;
          const sub = document.getElementById('bluffSubBox');
          const grid = document.getElementById('bluffVoteGrid');
          grid.innerHTML = '';

          if (d.phase === 'write') {
            sub.innerHTML = d.submitted
              ? '<span style="color:#4ade80;font-weight:bold;">✅ Answer locked secretly! Waiting for others...</span>'
              : '✍️ <b>Type your answer in chat!</b> (Hidden from chat so nobody knows it is yours!)';
          } else {
            sub.innerHTML = '🗳️ <b>Tap the funniest answer!</b> (You can\'t vote for yourself)';
            d.entries.forEach((ent, idx) => {
              const btn = document.createElement('button');
              const isMine = (ent.authorId === socket.id);
              btn.disabled = isMine || d.voted;
              btn.style.cssText = 'background:' + (isMine ? '#334155' : '#1e1b4b') + ';border:1.5px solid #f472b6;color:#fff;padding:6px 8px;border-radius:9px;font-size:11px;font-weight:bold;cursor:pointer;text-align:left;';
              btn.textContent = (idx + 1) + '. "' + ent.text + '"' + (isMine ? ' (Yours)' : '');
              btn.onclick = () => socket.emit('bluffVote', ent.authorId);
              grid.appendChild(btn);
            });
          }
        });
        socket.on('bluffEnd', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('bluffBar').style.display = 'none';
        });
      }
      setInterval(bindBluff, 1200);
    })();
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('bluffBar')) {
                body = body.replace('</body>', BLUFF_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // === PIECE 2/3: BLUFF MASTER ENGINE & SECRET CHAT CAPTURE ===
    function broadcastBluff(srvId) {
        const st = bluffByServer.get(srvId);
        if (!st) return;
        const entries = Array.from(st.answers.entries()).map(([authorId, obj]) => ({ authorId, text: obj.text }));
        st.players.forEach(p => {
            io.to(p.id).emit('bluffSync', {
                phase: st.phase, timeLeft: st.timeLeft, prompt: st.prompt,
                submitted: st.answers.has(p.id), voted: st.votes.has(p.id),
                entries, _serverId: srvId
            });
        });
    }

    function startBluffVoting(srvId) {
        const st = bluffByServer.get(srvId);
        if (!st) return;
        if (st.answers.size < 2) {
            clearInterval(st.interval);
            bluffByServer.delete(srvId);
            io.to(srvId).emit('bluffEnd', { _serverId: srvId });
            io.to(srvId).emit('message', { username: "Sammu's Bot", text: '⚠️ Bluff Master cancelled—not enough answers typed in time!', _serverId: srvId });
            return;
        }
        st.phase = 'vote';
        st.timeLeft = 15;
        io.to(srvId).emit('message', { username: "Sammu's Bot", text: '🗳️ **TIME TO VOTE!** All answers are revealed in the top bar—vote for the funniest one!', _serverId: srvId });
        broadcastBluff(srvId);
    }

    function finishBluffGame(srvId) {
        const st = bluffByServer.get(srvId);
        if (!st) return;
        clearInterval(st.interval);
        bluffByServer.delete(srvId);
        io.to(srvId).emit('bluffEnd', { _serverId: srvId });

        const tally = {};
        for (const targetId of st.votes.values()) tally[targetId] = (tally[targetId] || 0) + 1;
        const results = Array.from(st.answers.entries()).map(([id, obj]) => ({
            name: obj.username, text: obj.text, votes: tally[id] || 0
        })).sort((a, b) => b.votes - a.votes);

        const lines = results.map((r, i) => `${i === 0 ? '👑' : '•'} **${r.name}** (${r.votes} votes): *"${r.text}"*`).join('\n');
        io.to(srvId).emit('message', {
            username: "Sammu's Bot",
            text: `🎭 **BLUFF MASTER RESULTS!**\nPrompt: *${st.prompt}*\n${lines}`,
            _serverId: srvId
        });
    }

    io.on('connection', (socket) => {
        // Intercept normal chat messages during Bluff writing phase so answers stay secret!
        socket.use((packet, next) => {
            if (packet && packet.at(0) === 'chatMessage' && socket.activeServerId) {
                const st = bluffByServer.get(socket.activeServerId);
                if (st && st.phase === 'write' && !st.answers.has(socket.id)) {
                    const raw = packet.at(1);
                    const txt = (typeof raw === 'object' && raw) ? raw.text : raw;
                    if (typeof txt === 'string' && !txt.trim().startsWith('!') && !txt.trim().startsWith('/')) {
                        st.answers.set(socket.id, { username: socket.username || 'Player', text: txt.trim().slice(0, 75) });
                        socket.emit('message', { username: 'SYSTEM', text: `🤫 Secret answer locked: *"${txt.trim().slice(0, 75)}"*`, _serverId: socket.activeServerId });
                        if (st.answers.size >= st.players.length) startBluffVoting(socket.activeServerId);
                        else broadcastBluff(socket.activeServerId);
                        return; // Hide message from public chat!
                    }
                }
            }
            next();
        });

        socket.on('chatMessage', (payload) => {
            const txt = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof txt !== 'string' || txt.trim().toLowerCase() !== '!bluff') return;
            if (bluffByServer.has(srvId)) return;

            const players = getFullRoomPlayers(srvId);
            if (players.length < 2) return io.to(srvId).emit('message', { username: "Sammu's Bot", text: '⚠️ Need at least **2 players** for **🎭 Bluff Master**!', _serverId: srvId });

            const prompt = BLUFF_PROMPTS[Math.floor(Math.random() * BLUFF_PROMPTS.length)];
            const st = { players, prompt, phase: 'write', timeLeft: 20, answers: new Map(), votes: new Map(), interval: null };
            bluffByServer.set(srvId, st);
            st.interval = setInterval(() => {
                const c = bluffByServer.get(srvId);
                if (!c) return;
                c.timeLeft--;
                if (c.timeLeft <= 0) {
                    if (c.phase === 'write') startBluffVoting(srvId);
                    else finishBluffGame(srvId);
                } else broadcastBluff(srvId);
            }, 1000);

            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `🎭 **BLUFF MASTER STARTED!**\nPrompt: **${prompt}**\n*(Type your funniest reply in chat within 20s—it stays hidden until voting!)*`,
                _serverId: srvId
            });
            broadcastBluff(srvId);
        });

        socket.on('bluffVote', (authorId) => {
            const srvId = socket.activeServerId;
            const st = srvId ? bluffByServer.get(srvId) : null;
            if (!st || st.phase !== 'vote' || st.votes.has(socket.id) || authorId === socket.id) return;
            st.votes.set(socket.id, authorId);
            if (st.votes.size >= st.answers.size) finishBluffGame(srvId);
            else broadcastBluff(srvId);
        });
    });
    // === 🏝️ CASTAWAY ISLAND (!island) — SOCIAL SURVIVAL GAME (PIECE 3/3) ===
    const islandByServer = new Map();
    const ISLAND_EVENTS = [
        { name: '⛈️ Monsoon Storm!', foodLoss: 15, fireLoss: 30 },
        { name: '🐒 Hungry Monkey Raid!', foodLoss: 30, fireLoss: 10 },
        { name: '🥶 Freezing Ocean Wind!', foodLoss: 10, fireLoss: 35 },
        { name: '🐍 Jungle Snake Panic!', foodLoss: 25, fireLoss: 20 }
    ];

    const ISLAND_UI = `
    <div id="islandBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999998;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(6,78,59,0.96),rgba(120,53,15,0.96));border:2px solid #34d399;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(52,211,153,0.45);backdrop-filter:blur(6px);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span id="islDay" style="font-weight:900;font-size:11px;color:#6ee7b7;">🏝️ CASTAWAY ISLAND (DAY 1/4)</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="islTimer" style="font-size:11px;color:#fde047;font-weight:900;">⏳ 14s</span>
            <button onclick="document.getElementById('islandBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div style="display:flex;gap:6px;font-size:10px;font-weight:bold;margin-bottom:6px;">
          <div style="flex:1;background:#090d16;border:1px solid #4ade80;border-radius:8px;padding:4px;">🥥 Food: <b id="islFood" style="color:#4ade80;">60%</b></div>
          <div style="flex:1;background:#090d16;border:1px solid #f97316;border-radius:8px;padding:4px;">🔥 Campfire: <b id="islFire" style="color:#fb923c;">60%</b></div>
        </div>
        <div id="islActions" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;"></div>
      </div>
    </div>
    <script>
    (function() {
      function injectIslandBtn() {
        const targetBtn = Array.from(document.querySelectorAll('button')).find(b => /bluff master|bank heist|zombie outbreak/i.test(b.textContent || ''));
        if (targetBtn && targetBtn.parentElement && !document.getElementById('btnLaunchIsland')) {
          const btn = targetBtn.cloneNode(true);
          btn.id = 'btnLaunchIsland'; btn.removeAttribute('onclick');
          btn.textContent = '33. 🏝️ Castaway Island';
          btn.onclick = () => { if (typeof socket !== 'undefined') socket.emit('chatMessage', '!island'); };
          targetBtn.parentElement.appendChild(btn);
        }
      }
      setInterval(injectIslandBtn, 2200);

      function bindIsland() {
        if (typeof socket === 'undefined' || window._islandBound) return;
        window._islandBound = true;
        socket.on('islandSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('islandBar').style.display = 'flex';
          document.getElementById('islDay').textContent = '🏝️ CASTAWAY ISLAND (DAY ' + d.day + '/4)';
          document.getElementById('islTimer').textContent = '⏳ ' + d.timeLeft + 's';
          document.getElementById('islFood').textContent = d.food + '%';
          document.getElementById('islFire').textContent = d.fire + '%';
          const box = document.getElementById('islActions');
          box.innerHTML = '';
          if (d.acted) {
            box.innerHTML = '<span style="font-size:11px;color:#6ee7b7;font-weight:bold;">✅ Choice locked! Discuss in chat!</span>';
          } else {
            const moves = [
              { id: 'forage', label: '🥥 Gather Food (+22%)', bg: '#15803d' },
              { id: 'fire', label: '🪵 Stoke Fire (+22%)', bg: '#c2410c' },
              { id: 'steal', label: '🐍 Hoard Rations (Greed)', bg: '#7e22ce' }
            ];
            moves.forEach(m => {
              const btn = document.createElement('button');
              btn.style.cssText = 'background:' + m.bg + ';border:1px solid #fff;color:#fff;padding:5px 8px;border-radius:9px;font-weight:bold;font-size:10px;cursor:pointer;';
              btn.textContent = m.label;
              btn.onclick = () => socket.emit('islandAct', m.id);
              box.appendChild(btn);
            });
          }
        });
        socket.on('islandEnd', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('islandBar').style.display = 'none';
        });
      }
      setInterval(bindIsland, 1200);
    })();
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('islandBar')) {
                body = body.replace('</body>', ISLAND_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });

    function broadcastIsland(srvId) {
        const st = islandByServer.get(srvId);
        if (!st) return;
        st.players.forEach(p => {
            io.to(p.id).emit('islandSync', {
                day: st.day, timeLeft: st.timeLeft, food: st.food, fire: st.fire,
                acted: st.acted.has(p.id), _serverId: srvId
            });
        });
    }

    function resolveIslandDay(srvId) {
        const st = islandByServer.get(srvId);
        if (!st) return;
        const ev = ISLAND_EVENTS[Math.floor(Math.random() * ISLAND_EVENTS.length)];
        st.food = Math.max(0, st.food - ev.foodLoss);
        st.fire = Math.max(0, st.fire - ev.fireLoss);
        st.acted.clear();

        if (st.food <= 0 || st.fire <= 0) {
            clearInterval(st.interval);
            islandByServer.delete(srvId);
            io.to(srvId).emit('islandEnd', { _serverId: srvId });
            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `💀🏝️ **ISLAND WIPEOUT!** **${ev.name}** hit and ${st.food <= 0 ? 'everyone starved!' : 'the campfire went out!'} (Too many people hoarded rations!)`,
                _serverId: srvId
            });
            return;
        }
        if (st.day >= 4) {
            clearInterval(st.interval);
            islandByServer.delete(srvId);
            io.to(srvId).emit('islandEnd', { _serverId: srvId });
            const rat = Object.entries(st.greedMap).sort((a, b) => b - a);
            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `🚁🎉 **RESCUE HELICOPTER ARRIVED!** The squad survived 4 days on Castaway Island!\n🐍 **Biggest Ration Hoarder:** **${rat ? rat : 'Nobody — Pure Teamwork!'}**`,
                _serverId: srvId
            });
            return;
        }
        st.day++;
        st.timeLeft = 14;
        io.to(srvId).emit('message', {
            username: "Sammu's Bot",
            text: `⚠️ **${ev.name}** struck! (-${ev.foodLoss}% Food, -${ev.fireLoss}% Fire) -> **Day ${st.day}/4** begins! Talk in chat so you don't run out!`,
            _serverId: srvId
        });
        broadcastIsland(srvId);
    }

    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const txt = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof txt !== 'string' || txt.trim().toLowerCase() !== '!island') return;
            if (islandByServer.has(srvId)) return;

            const players = getFullRoomPlayers(srvId);
            if (players.length < 2) return io.to(srvId).emit('message', { username: "Sammu's Bot", text: '⚠️ Need at least **2 players** for **🏝️ Castaway Island**!', _serverId: srvId });

            const st = { players, day: 1, food: 65, fire: 65, timeLeft: 14, acted: new Set(), greedMap: {}, interval: null };
            islandByServer.set(srvId, st);
            st.interval = setInterval(() => {
                const c = islandByServer.get(srvId);
                if (!c) return;
                c.timeLeft--;
                if (c.timeLeft <= 0) resolveIslandDay(srvId);
                else broadcastIsland(srvId);
            }, 1000);

            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `🏝️🔥 **CASTAWAY ISLAND STARTED!** Survive 4 Days! Coordinate in chat who gathers **🥥 Food** and who tends the **🔥 Fire**—watch out for ration hoarders!`,
                _serverId: srvId
            });
            broadcastIsland(srvId);
        });

        socket.on('islandAct', (move) => {
            const srvId = socket.activeServerId;
            const st = srvId ? islandByServer.get(srvId) : null;
            if (!st || st.acted.has(socket.id)) return;
            st.acted.add(socket.id);
            const uname = socket.username || 'Survivor';
            if (move === 'forage') st.food = Math.min(100, st.food + 22);
            else if (move === 'fire') st.fire = Math.min(100, st.fire + 22);
            else if (move === 'steal') {
                st.food = Math.max(0, st.food - 12);
                st.greedMap[uname] = (st.greedMap[uname] || 0) + 1;
            }
            if (st.acted.size >= st.players.length) resolveIslandDay(srvId);
            else broadcastIsland(srvId);
        });
    });
    const PARTY_ALL_IN_ONE_UI = `
    <div id="cleanRaidBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999999;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(49,16,66,0.97),rgba(15,23,42,0.97));border:2px solid #c084fc;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(192,132,252,0.5);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <span style="font-weight:900;font-size:11px;color:#e879f9;">🐉 SHADOW DRAGON RAID</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="cRaidTimer" style="font-size:11px;color:#fde047;font-weight:900;">⏳ 12s</span>
            <button onclick="document.getElementById('cleanRaidBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div style="display:flex;gap:6px;font-size:10px;font-weight:bold;margin-bottom:6px;">
          <div style="flex:1;background:#090d16;border:1px solid #4ade80;border-radius:8px;padding:4px;">❤️ Squad HP: <b id="cRaidTeamHp" style="color:#4ade80;">100%</b></div>
          <div style="flex:1;background:#090d16;border:1px solid #f43f5e;border-radius:8px;padding:4px;">🐉 Boss: <b id="cRaidBossHp" style="color:#fda4af;">3000</b></div>
        </div>
        <div id="cRaidActions" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;"></div>
      </div>
    </div>

    <div id="cleanHeistBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999999;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(6,78,59,0.97),rgba(15,23,42,0.97));border:2px solid #facc15;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(250,204,21,0.45);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <span id="cHeistRound" style="font-weight:900;font-size:11px;color:#fde047;">🏦 MEGA BANK HEIST (1/4)</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="cHeistTimer" style="font-size:11px;color:#38bdf8;font-weight:900;">⏳ 12s</span>
            <button onclick="document.getElementById('cleanHeistBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div style="display:flex;gap:6px;font-size:10px;font-weight:bold;margin-bottom:6px;">
          <div style="flex:1;background:#090d16;border:1px solid #facc15;border-radius:8px;padding:4px;">💰 Loot: <b id="cHeistLoot" style="color:#fde047;">$0</b></div>
          <div style="flex:1;background:#090d16;border:1px solid #ef4444;border-radius:8px;padding:4px;">🚨 Heat: <b id="cHeistHeat" style="color:#f87171;">0%</b></div>
        </div>
        <div id="cHeistActions" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;"></div>
      </div>
    </div>

    <div id="cleanBluffBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999999;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(88,28,135,0.97),rgba(15,23,42,0.97));border:2px solid #f472b6;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(244,114,182,0.5);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-weight:900;font-size:11px;color:#f9a8d4;">🎭 BLUFF MASTER</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="cBluffTimer" style="font-size:11px;color:#fde047;font-weight:900;">⏳ 20s</span>
            <button onclick="document.getElementById('cleanBluffBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div id="cBluffPrompt" style="background:rgba(244,114,182,0.2);border:1px solid #f472b6;border-radius:9px;padding:6px;margin-bottom:6px;font-size:12px;font-weight:900;color:#fde047;">Loading...</div>
        <div id="cBluffSub" style="font-size:11px;color:#cbd5e1;">✍️ Type your funny answer in normal chat now!</div>
        <div id="cBluffGrid" style="display:flex;flex-direction:column;gap:5px;margin-top:6px;max-height:140px;overflow-y:auto;"></div>
      </div>
    </div>

    <div id="cleanIslandBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999999;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(6,78,59,0.97),rgba(120,53,15,0.97));border:2px solid #34d399;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(52,211,153,0.45);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span id="cIslDay" style="font-weight:900;font-size:11px;color:#6ee7b7;">🏝️ CASTAWAY ISLAND (DAY 1/4)</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="cIslTimer" style="font-size:11px;color:#fde047;font-weight:900;">⏳ 14s</span>
            <button onclick="document.getElementById('cleanIslandBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div style="display:flex;gap:6px;font-size:10px;font-weight:bold;margin-bottom:6px;">
          <div style="flex:1;background:#090d16;border:1px solid #4ade80;border-radius:8px;padding:4px;">🥥 Food: <b id="cIslFood" style="color:#4ade80;">60%</b></div>
          <div style="flex:1;background:#090d16;border:1px solid #f97316;border-radius:8px;padding:4px;">🔥 Fire: <b id="cIslFire" style="color:#fb923c;">60%</b></div>
        </div>
        <div id="cIslActions" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;"></div>
      </div>
    </div>
    <script>
    (function() {
      function injectAllFourButtons() {
        const anchor = Array.from(document.querySelectorAll('button')).find(b => /hoop shootout|word imposter/i.test(b.textContent || ''));
        if (!anchor || !anchor.parentElement) return;
        const parent = anchor.parentElement;

        const oldIsl = document.getElementById('btnLaunchIsland');
        if (oldIsl) oldIsl.remove();

        const games = [
          { id: 'cBtn30', label: '30. 🐉 Dragon Raid', cmd: '!boss' },
          { id: 'cBtn31', label: '31. 🏦 Bank Heist', cmd: '!heist' },
          { id: 'cBtn32', label: '32. 🎭 Bluff Master', cmd: '!bluff' },
          { id: 'cBtn33', label: '33. 🏝️ Castaway Island', cmd: '!island' }
        ];

        games.forEach(g => {
          if (!document.getElementById(g.id)) {
            const btn = anchor.cloneNode(true);
            btn.id = g.id;
            btn.removeAttribute('onclick');
            btn.textContent = g.label;
            btn.onclick = function() {
              if (typeof socket !== 'undefined') socket.emit('chatMessage', g.cmd);
            };
            parent.appendChild(btn);
          }
        });
      }
      setInterval(injectAllFourButtons, 1500);

      function bindCleanPartySockets() {
        if (typeof socket === 'undefined' || window._cleanPartyBound) return;
        window._cleanPartyBound = true;

        socket.on('raidSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('cleanRaidBar').style.display = 'flex';
          document.getElementById('cRaidTimer').textContent = '⏳ ' + d.timeLeft + 's';
          document.getElementById('cRaidTeamHp').textContent = d.teamHp + '%';
          document.getElementById('cRaidBossHp').textContent = d.bossHp;
          const box = document.getElementById('cRaidActions');
          box.innerHTML = '';
          if (d.acted) {
            box.innerHTML = '<span style="font-size:11px;color:#e879f9;font-weight:bold;">✅ Move locked!</span>';
          } else {
            [
              { id: 'slash', label: '⚔️ Slash (-350)', bg: '#b91c1c' },
              { id: 'fireball', label: '🔥 Meteor (-500)', bg: '#7e22ce' },
              { id: 'shield', label: '🛡️ Shield', bg: '#0369a1' },
              { id: 'heal', label: '💖 Heal (+22%)', bg: '#15803d' }
            ].forEach(m => {
              const b = document.createElement('button');
              b.style.cssText = 'background:' + m.bg + ';border:1px solid #fff;color:#fff;padding:5px 8px;border-radius:9px;font-weight:bold;font-size:10px;cursor:pointer;';
              b.textContent = m.label;
              b.onclick = () => socket.emit('raidAct', m.id);
              box.appendChild(b);
            });
          }
        });
        socket.on('raidEnd', () => { document.getElementById('cleanRaidBar').style.display = 'none'; });

        socket.on('heistSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('cleanHeistBar').style.display = 'flex';
          document.getElementById('cHeistRound').textContent = '🏦 MEGA BANK HEIST (' + d.round + '/4)';
          document.getElementById('cHeistTimer').textContent = '⏳ ' + d.timeLeft + 's';
          document.getElementById('cHeistLoot').textContent = '$' + d.loot.toLocaleString();
          document.getElementById('cHeistHeat').textContent = d.heat + '%';
          const box = document.getElementById('cHeistActions');
          box.innerHTML = '';
          if (d.acted) {
            box.innerHTML = '<span style="font-size:11px;color:#fde047;font-weight:bold;">✅ Choice locked!</span>';
          } else {
            [
              { id: 'drill', label: '🔨 Drill (+$25k)', bg: '#047857' },
              { id: 'guard', label: '🚓 Jam Cops (-20%)', bg: '#1d4ed8' },
              { id: 'greed', label: '💰 Pocket (+$40k)', bg: '#b45309' }
            ].forEach(m => {
              const b = document.createElement('button');
              b.style.cssText = 'background:' + m.bg + ';border:1px solid #fff;color:#fff;padding:5px 8px;border-radius:9px;font-weight:bold;font-size:10px;cursor:pointer;';
              b.textContent = m.label;
              b.onclick = () => socket.emit('heistAct', m.id);
              box.appendChild(b);
            });
          }
        });
        socket.on('heistEnd', () => { document.getElementById('cleanHeistBar').style.display = 'none'; });

        socket.on('bluffSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('cleanBluffBar').style.display = 'flex';
          document.getElementById('cBluffTimer').textContent = '⏳ ' + d.timeLeft + 's';
          document.getElementById('cBluffPrompt').textContent = d.prompt;
          const sub = document.getElementById('cBluffSub');
          const grid = document.getElementById('cBluffGrid');
          grid.innerHTML = '';
          if (d.phase === 'write') {
            sub.innerHTML = d.submitted
              ? '<span style="color:#4ade80;font-weight:bold;">✅ Secret answer locked! Waiting for others...</span>'
              : '✍️ <b>Type your answer in normal chat!</b> (Hidden until voting)';
          } else {
            sub.innerHTML = '🗳️ <b>Tap the funniest answer!</b>';
            d.entries.forEach((ent, idx) => {
              const btn = document.createElement('button');
              const isMine = (ent.authorId === socket.id);
              btn.disabled = isMine || d.voted;
              btn.style.cssText = 'background:' + (isMine ? '#334155' : '#1e1b4b') + ';border:1.5px solid #f472b6;color:#fff;padding:6px 8px;border-radius:9px;font-size:11px;font-weight:bold;cursor:pointer;text-align:left;';
              btn.textContent = (idx + 1) + '. "' + ent.text + '"' + (isMine ? ' (Yours)' : '');
              btn.onclick = () => socket.emit('bluffVote', ent.authorId);
              grid.appendChild(btn);
            });
          }
        });
        socket.on('bluffEnd', () => { document.getElementById('cleanBluffBar').style.display = 'none'; });

        socket.on('islandSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('cleanIslandBar').style.display = 'flex';
          document.getElementById('cIslDay').textContent = '🏝️ CASTAWAY ISLAND (DAY ' + d.day + '/4)';
          document.getElementById('cIslTimer').textContent = '⏳ ' + d.timeLeft + 's';
          document.getElementById('cIslFood').textContent = d.food + '%';
          document.getElementById('cIslFire').textContent = d.fire + '%';
          const box = document.getElementById('cIslActions');
          box.innerHTML = '';
          if (d.acted) {
            box.innerHTML = '<span style="font-size:11px;color:#6ee7b7;font-weight:bold;">✅ Choice locked!</span>';
          } else {
            [
              { id: 'forage', label: '🥥 Gather Food (+22%)', bg: '#15803d' },
              { id: 'fire', label: '🪵 Stoke Fire (+22%)', bg: '#c2410c' },
              { id: 'steal', label: '🐍 Hoard Rations', bg: '#7e22ce' }
            ].forEach(m => {
              const b = document.createElement('button');
              b.style.cssText = 'background:' + m.bg + ';border:1px solid #fff;color:#fff;padding:5px 8px;border-radius:9px;font-weight:bold;font-size:10px;cursor:pointer;';
              b.textContent = m.label;
              b.onclick = () => socket.emit('islandAct', m.id);
              box.appendChild(b);
            });
          }
        });
        socket.on('islandEnd', () => { document.getElementById('cleanIslandBar').style.display = 'none'; });
      }
      setInterval(bindCleanPartySockets, 1200);
    })();
    </script>
    `;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('cleanRaidBar')) {
                body = body.replace('</body>', PARTY_ALL_IN_ONE_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // === GUARANTEED SOCKET-DELIVERED UI FOR #30, #31, #32, #33 (PIECE 1/2) ===
    const LIVE_PARTY_BUNDLE = `
    <div id="cleanRaidBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999999;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(49,16,66,0.97),rgba(15,23,42,0.97));border:2px solid #c084fc;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(192,132,252,0.5);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <span style="font-weight:900;font-size:11px;color:#e879f9;">🐉 SHADOW DRAGON RAID</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="cRaidTimer" style="font-size:11px;color:#fde047;font-weight:900;">⏳ 12s</span>
            <button onclick="document.getElementById('cleanRaidBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div style="display:flex;gap:6px;font-size:10px;font-weight:bold;margin-bottom:6px;">
          <div style="flex:1;background:#090d16;border:1px solid #4ade80;border-radius:8px;padding:4px;">❤️ Squad HP: <b id="cRaidTeamHp" style="color:#4ade80;">100%</b></div>
          <div style="flex:1;background:#090d16;border:1px solid #f43f5e;border-radius:8px;padding:4px;">🐉 Boss: <b id="cRaidBossHp" style="color:#fda4af;">3000</b></div>
        </div>
        <div id="cRaidActions" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;"></div>
      </div>
    </div>
    <div id="cleanHeistBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999999;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(6,78,59,0.97),rgba(15,23,42,0.97));border:2px solid #facc15;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(250,204,21,0.45);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <span id="cHeistRound" style="font-weight:900;font-size:11px;color:#fde047;">🏦 MEGA BANK HEIST (1/4)</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="cHeistTimer" style="font-size:11px;color:#38bdf8;font-weight:900;">⏳ 12s</span>
            <button onclick="document.getElementById('cleanHeistBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div style="display:flex;gap:6px;font-size:10px;font-weight:bold;margin-bottom:6px;">
          <div style="flex:1;background:#090d16;border:1px solid #facc15;border-radius:8px;padding:4px;">💰 Loot: <b id="cHeistLoot" style="color:#fde047;">$0</b></div>
          <div style="flex:1;background:#090d16;border:1px solid #ef4444;border-radius:8px;padding:4px;">🚨 Heat: <b id="cHeistHeat" style="color:#f87171;">0%</b></div>
        </div>
        <div id="cHeistActions" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;"></div>
      </div>
    </div>
    <div id="cleanBluffBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999999;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(88,28,135,0.97),rgba(15,23,42,0.97));border:2px solid #f472b6;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(244,114,182,0.5);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-weight:900;font-size:11px;color:#f9a8d4;">🎭 BLUFF MASTER</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="cBluffTimer" style="font-size:11px;color:#fde047;font-weight:900;">⏳ 20s</span>
            <button onclick="document.getElementById('cleanBluffBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div id="cBluffPrompt" style="background:rgba(244,114,182,0.2);border:1px solid #f472b6;border-radius:9px;padding:6px;margin-bottom:6px;font-size:12px;font-weight:900;color:#fde047;">Loading...</div>
        <div id="cBluffSub" style="font-size:11px;color:#cbd5e1;">✍️ Type your funny answer in normal chat now!</div>
        <div id="cBluffGrid" style="display:flex;flex-direction:column;gap:5px;margin-top:6px;max-height:140px;overflow-y:auto;"></div>
      </div>
    </div>
    <div id="cleanIslandBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999999;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(6,78,59,0.97),rgba(120,53,15,0.97));border:2px solid #34d399;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(52,211,153,0.45);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span id="cIslDay" style="font-weight:900;font-size:11px;color:#6ee7b7;">🏝️ CASTAWAY ISLAND (DAY 1/4)</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="cIslTimer" style="font-size:11px;color:#fde047;font-weight:900;">⏳ 14s</span>
            <button onclick="document.getElementById('cleanIslandBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div style="display:flex;gap:6px;font-size:10px;font-weight:bold;margin-bottom:6px;">
          <div style="flex:1;background:#090d16;border:1px solid #4ade80;border-radius:8px;padding:4px;">🥥 Food: <b id="cIslFood" style="color:#4ade80;">60%</b></div>
          <div style="flex:1;background:#090d16;border:1px solid #f97316;border-radius:8px;padding:4px;">🔥 Fire: <b id="cIslFire" style="color:#fb923c;">60%</b></div>
        </div>
        <div id="cIslActions" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;"></div>
      </div>
    </div>`;

    io.on('connection', (socket) => {
        socket.on('joinRoom', () => {
            setTimeout(() => {
                socket.emit('injectPartyBundle', LIVE_PARTY_BUNDLE);
            }, 700);
        });
    });
    // === GUARANTEED SOCKET-DELIVERED UI (PIECE 2/2) ===
    const SOCKET_UI_BOOT = `
    <script>
    (function() {
      function bootSocketPartyUI() {
        if (typeof socket === 'undefined' || window._partyBooted) return;
        window._partyBooted = true;

        socket.on('injectPartyBundle', (html) => {
          if (!document.getElementById('cleanRaidBar')) {
            const wrap = document.createElement('div');
            wrap.innerHTML = html;
            document.body.appendChild(wrap);
          }
          const anchor = Array.from(document.querySelectorAll('button')).find(b => /hoop shootout|word imposter|zombie outbreak/i.test(b.textContent || ''));
          if (anchor && anchor.parentElement) {
            const oldIsl = document.getElementById('btnLaunchIsland');
            if (oldIsl) oldIsl.remove();
            [
              { id: 'cBtn30', label: '30. 🐉 Dragon Raid', cmd: '!boss' },
              { id: 'cBtn31', label: '31. 🏦 Bank Heist', cmd: '!heist' },
              { id: 'cBtn32', label: '32. 🎭 Bluff Master', cmd: '!bluff' },
              { id: 'cBtn33', label: '33. 🏝️ Castaway Island', cmd: '!island' }
            ].forEach(g => {
              if (!document.getElementById(g.id)) {
                const btn = anchor.cloneNode(true);
                btn.id = g.id; btn.removeAttribute('onclick'); btn.textContent = g.label;
                btn.onclick = () => socket.emit('chatMessage', g.cmd);
                anchor.parentElement.appendChild(btn);
              }
            });
          }
        });

        socket.on('raidSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('cleanRaidBar').style.display = 'flex';
          document.getElementById('cRaidTimer').textContent = '⏳ ' + d.timeLeft + 's';
          document.getElementById('cRaidTeamHp').textContent = d.teamHp + '%';
          document.getElementById('cRaidBossHp').textContent = d.bossHp;
          const box = document.getElementById('cRaidActions'); box.innerHTML = '';
          if (d.acted) { box.innerHTML = '<span style="font-size:11px;color:#e879f9;font-weight:bold;">✅ Move locked!</span>'; return; }
          [
            { id: 'slash', label: '⚔️ Slash (-350)', bg: '#b91c1c' },
            { id: 'fireball', label: '🔥 Meteor (-500)', bg: '#7e22ce' },
            { id: 'shield', label: '🛡️ Shield', bg: '#0369a1' },
            { id: 'heal', label: '💖 Heal (+22%)', bg: '#15803d' }
          ].forEach(m => {
            const b = document.createElement('button');
            b.style.cssText = 'background:' + m.bg + ';border:1px solid #fff;color:#fff;padding:5px 8px;border-radius:9px;font-weight:bold;font-size:10px;cursor:pointer;';
            b.textContent = m.label; b.onclick = () => socket.emit('raidAct', m.id); box.appendChild(b);
          });
        });
        socket.on('raidEnd', () => { const el = document.getElementById('cleanRaidBar'); if (el) el.style.display = 'none'; });

        socket.on('heistSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('cleanHeistBar').style.display = 'flex';
          document.getElementById('cHeistRound').textContent = '🏦 MEGA BANK HEIST (' + d.round + '/4)';
          document.getElementById('cHeistTimer').textContent = '⏳ ' + d.timeLeft + 's';
          document.getElementById('cHeistLoot').textContent = '$' + d.loot.toLocaleString();
          document.getElementById('cHeistHeat').textContent = d.heat + '%';
          const box = document.getElementById('cHeistActions'); box.innerHTML = '';
          if (d.acted) { box.innerHTML = '<span style="font-size:11px;color:#fde047;font-weight:bold;">✅ Choice locked!</span>'; return; }
          [
            { id: 'drill', label: '🔨 Drill (+$25k)', bg: '#047857' },
            { id: 'guard', label: '🚓 Jam Cops (-20%)', bg: '#1d4ed8' },
            { id: 'greed', label: '💰 Pocket (+$40k)', bg: '#b45309' }
          ].forEach(m => {
            const b = document.createElement('button');
            b.style.cssText = 'background:' + m.bg + ';border:1px solid #fff;color:#fff;padding:5px 8px;border-radius:9px;font-weight:bold;font-size:10px;cursor:pointer;';
            b.textContent = m.label; b.onclick = () => socket.emit('heistAct', m.id); box.appendChild(b);
          });
        });
        socket.on('heistEnd', () => { const el = document.getElementById('cleanHeistBar'); if (el) el.style.display = 'none'; });

        socket.on('bluffSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('cleanBluffBar').style.display = 'flex';
          document.getElementById('cBluffTimer').textContent = '⏳ ' + d.timeLeft + 's';
          document.getElementById('cBluffPrompt').textContent = d.prompt;
          const sub = document.getElementById('cBluffSub'), grid = document.getElementById('cBluffGrid'); grid.innerHTML = '';
          if (d.phase === 'write') {
            sub.innerHTML = d.submitted ? '<span style="color:#4ade80;font-weight:bold;">✅ Answer locked secretly!</span>' : '✍️ <b>Type your answer in chat now!</b>';
          } else {
            sub.innerHTML = '🗳️ <b>Tap the funniest answer!</b>';
            d.entries.forEach((ent, idx) => {
              const btn = document.createElement('button');
              const isMine = (ent.authorId === socket.id);
              btn.disabled = isMine || d.voted;
              btn.style.cssText = 'background:' + (isMine ? '#334155' : '#1e1b4b') + ';border:1.5px solid #f472b6;color:#fff;padding:6px 8px;border-radius:9px;font-size:11px;font-weight:bold;cursor:pointer;text-align:left;';
              btn.textContent = (idx + 1) + '. "' + ent.text + '"' + (isMine ? ' (Yours)' : '');
              btn.onclick = () => socket.emit('bluffVote', ent.authorId);
              grid.appendChild(btn);
            });
          }
        });
        socket.on('bluffEnd', () => { const el = document.getElementById('cleanBluffBar'); if (el) el.style.display = 'none'; });

        socket.on('islandSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('cleanIslandBar').style.display = 'flex';
          document.getElementById('cIslDay').textContent = '🏝️ CASTAWAY ISLAND (DAY ' + d.day + '/4)';
          document.getElementById('cIslTimer').textContent = '⏳ ' + d.timeLeft + 's';
          document.getElementById('cIslFood').textContent = d.food + '%';
          document.getElementById('cIslFire').textContent = d.fire + '%';
          const box = document.getElementById('cIslActions'); box.innerHTML = '';
          if (d.acted) { box.innerHTML = '<span style="font-size:11px;color:#6ee7b7;font-weight:bold;">✅ Choice locked!</span>'; return; }
          [
            { id: 'forage', label: '🥥 Gather Food (+22%)', bg: '#15803d' },
            { id: 'fire', label: '🪵 Stoke Fire (+22%)', bg: '#c2410c' },
            { id: 'steal', label: '🐍 Hoard Rations', bg: '#7e22ce' }
          ].forEach(m => {
            const b = document.createElement('button');
            b.style.cssText = 'background:' + m.bg + ';border:1px solid #fff;color:#fff;padding:5px 8px;border-radius:9px;font-weight:bold;font-size:10px;cursor:pointer;';
            b.textContent = m.label; b.onclick = () => socket.emit('islandAct', m.id); box.appendChild(b);
          });
        });
        socket.on('islandEnd', () => { const el = document.getElementById('cleanIslandBar'); if (el) el.style.display = 'none'; });
      }
      window.addEventListener('DOMContentLoaded', () => { bootSocketPartyUI(); setTimeout(bootSocketPartyUI, 800); });
    })();
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('bootSocketPartyUI')) {
                body = body.replace('</body>', SOCKET_UI_BOOT + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
          if (global.OG_HOSTS) global.OG_HOSTS.add("antim");
    if (Array.isArray(global.AI_BLUFF_BANK)) {
        const p = global.AI_BLUFF_BANK.push.bind(global.AI_BLUFF_BANK);
        global.AI_BLUFF_BANK.forEach(x => { if (!BLUFF_PROMPTS.includes(x)) BLUFF_PROMPTS.push(x); });
        global.AI_BLUFF_BANK.push = (...a) => { a.forEach(x => { if (!BLUFF_PROMPTS.includes(x)) BLUFF_PROMPTS.push(x); }); return p(...a); };
    }
    if (Array.isArray(global.AI_IMPOSTER_BANK)) {
        const p = global.AI_IMPOSTER_BANK.push.bind(global.AI_IMPOSTER_BANK);
        global.AI_IMPOSTER_BANK.forEach(x => { if (!IMPOSTER_WORDS.includes(x)) IMPOSTER_WORDS.push(x); });
        global.AI_IMPOSTER_BANK.push = (...a) => { a.forEach(x => { if (!IMPOSTER_WORDS.includes(x)) IMPOSTER_WORDS.push(x); }); return p(...a); };
    }
    if (Array.isArray(global.AI_MULTI_ANIME_BANK)) {
        const p = global.AI_MULTI_ANIME_BANK.push.bind(global.AI_MULTI_ANIME_BANK);
        global.AI_MULTI_ANIME_BANK.forEach(x => EXTRA_ANIME_QUIZ.push(x));
        global.AI_MULTI_ANIME_BANK.push = (...a) => { a.forEach(x => EXTRA_ANIME_QUIZ.push(x)); return p(...a); };
    }

    const SERVER_WP_PACK = `
    <style>
      .srv-card.pokemon { border-color:#facc15; background:linear-gradient(90deg,rgba(220,38,38,0.35),rgba(250,204,21,0.25)); box-shadow:0 0 15px rgba(250,204,21,0.4); }
      body.wp-pokemon { background: radial-gradient(circle at 50% 18%, #dc2626 0%, #991b1b 32%, #f8fafc 33%, #f8fafc 36%, #1e293b 37%, #090d16 100%) !important; }
      body.wp-cute-babies { background: linear-gradient(160deg, #fbcfe8 0%, #ddd6fe 50%, #bae6fd 100%) !important; }
      body.wp-royal-queen { background: radial-gradient(circle at top, #831843 0%, #4c0519 45%, #1e1b4b 100%) !important; }
      body.wp-cyber-aurora { background: radial-gradient(circle at 20% 20%, #0e7490 0%, #1e1b4b 50%, #090d16 100%) !important; }
      body.wp-golden-empire { background: linear-gradient(155deg, #422006 0%, #713f12 45%, #0f172a 100%) !important; }
      body.wp-emerald-matrix { background: radial-gradient(circle at center, #064e3b 0%, #022c22 55%, #050a08 100%) !important; }
      body.wp-crimson-dragon { background: linear-gradient(160deg, #7f1d1d 0%, #450a0a 50%, #0f172a 100%) !important; }
      body.wp-diamond-frost { background: linear-gradient(145deg, #083344 0%, #1d4ed8 45%, #311042 100%) !important; }
      #wpFloatingBadge { position:fixed; bottom:54px; right:12px; z-index:99990; background:rgba(15,23,42,0.85); border:1.5px solid #38bdf8; color:#fff; padding:5px 10px; border-radius:999px; font-size:11px; font-weight:bold; pointer-events:none; display:none; }
    </style>
    <div id="wpFloatingBadge"></div>
    <script>
    (function() {
      const WP_CLASSES = ['wp-pokemon','wp-cute-babies','wp-royal-queen','wp-cyber-aurora','wp-golden-empire','wp-emerald-matrix','wp-crimson-dragon','wp-diamond-frost'];
      const MAP = {
        srv_antim:   { cls: 'wp-pokemon',        label: '⚡ Pokémon Arena WP' },
        srv_shubhi:  { cls: 'wp-cute-babies',    label: '🍼 Cute Babies Pastel WP' },
        srv_sus:     { cls: 'wp-royal-queen',    label: '👑 Royal Queen & Princess WP' },
        srv_samaksh: { cls: 'wp-diamond-frost',  label: '💎 Diamond Frost WP' },
        srv_advait:  { cls: 'wp-diamond-frost',  label: '⚡ Lightning Citadel WP' },
        srv_zoro:    { cls: 'wp-emerald-matrix', label: '⚔️ Dojo Emerald WP' },
        srv_milly:   { cls: 'wp-golden-empire',  label: '👑 Royal Gold Palace WP' },
        srv_ishika:  { cls: 'wp-golden-empire',  label: '✨ Golden Lounge WP' },
        srv_ruwii:   { cls: 'wp-golden-empire',  label: '🌺 Sunset Garden WP' },
        srv_sid:     { cls: 'wp-golden-empire',  label: '🦁 Lion Kingdom WP' },
        srv_moon:    { cls: 'wp-cyber-aurora',   label: '🌙 Cosmic Galaxy WP' },
        srv_sarah:   { cls: 'wp-cyber-aurora',   label: '🦋 Butterfly Aurora WP' },
        srv_zaira:   { cls: 'wp-cyber-aurora',   label: '🪐 Nebula Orbit WP' },
        srv_heer:    { cls: 'wp-crimson-dragon', label: '🌸 Cherry Crimson WP' },
        srv_izzan:   { cls: 'wp-crimson-dragon', label: '🔥 Infernal Fortress WP' }
      };
      let wpOn = false;
      function setSrvWp(on) {
        if (typeof on === 'boolean') wpOn = on;
        WP_CLASSES.forEach(c => document.body.classList.remove(c));
        const badge = document.getElementById('wpFloatingBadge');
        if (!wpOn) { if (badge) badge.style.display = 'none'; return; }
        const cfg = MAP[window.selectedServerId] || { cls: 'wp-cyber-aurora', label: '🌌 Cosmic Aurora WP' };
        document.body.classList.add(cfg.cls);
        if (badge) { badge.textContent = cfg.label; badge.style.display = 'block'; }
      }
      setInterval(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => /🌌\s*wp|\bwp\b/i.test(b.textContent || ''));
        if (btn && !btn.dataset.srvWp) {
          btn.dataset.srvWp = '1';
          btn.addEventListener('click', () => setSrvWp(!wpOn));
        }
      }, 2500);
      window.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
          if (typeof socket !== 'undefined') socket.on('serverAccessGranted', (s) => { window.selectedServerId = s.id; setSrvWp(true); });
        }, 800);
      });
    })();
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('wpFloatingBadge')) {
                body = body.replace('</body>', SERVER_WP_PACK + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // === 🃏 PIECE 1/2: TRADING CARD GACHA & BOUNTY HUNT CORE ===
    const CARD_POOL = [
        { name: "⚡ Pikachu Spark", tier: "COMMON", power: 72, c1: "#854d0e", c2: "#facc15", emoji: "⚡🐭" },
        { name: "🍥 Naruto Rasengan", tier: "COMMON", power: 78, c1: "#9a3412", c2: "#fb923c", emoji: "🍥🦊" },
        { name: "🔥 Charmander Blaze", tier: "COMMON", power: 74, c1: "#7f1d1d", c2: "#f87171", emoji: "🔥🦎" },
        { name: "🗡️ Tanjiro Water Slash", tier: "COMMON", power: 79, c1: "#065f46", c2: "#34d399", emoji: "🌊🗡️" },
        { name: "⚔️ 3-Sword Roronoa Zoro", tier: "EPIC", power: 91, c1: "#064e3b", c2: "#10b981", emoji: "⚔️🐉" },
        { name: "🤞 Gojo Unlimited Void", tier: "EPIC", power: 94, c1: "#1e1b4b", c2: "#38bdf8", emoji: "🤞🌌" },
        { name: "🐉 Mega Charizard X", tier: "EPIC", power: 93, c1: "#1e293b", c2: "#3b82f6", emoji: "🐉🔥" },
        { name: "👁️ Itachi Tsukuyomi", tier: "EPIC", power: 92, c1: "#450a0a", c2: "#ef4444", emoji: "👁️🦅" },
        { name: "👒 Gear 5 Sun God Luffy", tier: "MYTHIC", power: 99, c1: "#581c87", c2: "#facc15", emoji: "👒⚡" },
        { name: "👑 Shadow Monarch Jinwoo", tier: "MYTHIC", power: 98, c1: "#090d16", c2: "#a855f7", emoji: "👑🗡️" },
        { name: "⚡ Mewtwo Cosmic Psy", tier: "MYTHIC", power: 97, c1: "#311042", c2: "#f472b6", emoji: "🧬🔮" },
        { name: "💎 OG Host: Sammu Supreme", tier: "MYTHIC", power: 100, c1: "#083344", c2: "#67e8f9", emoji: "💎👑" },
        { name: "🌿 OG Host: Dr. Moon Vaidya", tier: "MYTHIC", power: 100, c1: "#064e3b", c2: "#fde047", emoji: "🌙🌿" },
        { name: "⚡ OG Host: Antim PokéKing", tier: "MYTHIC", power: 100, c1: "#7f1d1d", c2: "#facc15", emoji: "⚡🏆" }
    ];

    const playerWallet = new Map();
    const playerCards = new Map();
    const activeBounties = new Map();
    const serverWinStreaks = new Map();

    function getCoins(uname) {
        const k = uname.toLowerCase();
        if (!playerWallet.has(k)) playerWallet.set(k, 150);
        return playerWallet.get(k);
    }
    function addCoins(uname, amt) {
        const k = uname.toLowerCase();
        playerWallet.set(k, Math.max(0, getCoins(k) + amt));
        return playerWallet.get(k);
    }

    const GACHA_FLEX_SCRIPT = `
    <script>
    (function() {
      const waitGacha = setInterval(() => {
        if (typeof socket === 'undefined') return;
        clearInterval(waitGacha);
        socket.on('renderFlexCard', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          if (d.ownerSocket !== socket.id) return;
          const c = document.createElement('canvas');
          c.width = 300; c.height = 175;
          const ctx = c.getContext('2d');
          const g = ctx.createLinearGradient(0, 0, 300, 175);
          g.addColorStop(0, d.card.c1); g.addColorStop(1, d.card.c2);
          ctx.fillStyle = g; ctx.fillRect(0, 0, 300, 175);
          ctx.strokeStyle = d.card.tier === 'MYTHIC' ? '#fde047' : '#38bdf8';
          ctx.lineWidth = 5; ctx.strokeRect(4, 4, 292, 167);
          ctx.fillStyle = '#fde047'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('★ ' + d.card.tier + ' TRADING CARD ★', 150, 24);
          ctx.font = '42px serif'; ctx.fillText(d.card.emoji, 150, 74);
          ctx.fillStyle = '#ffffff'; ctx.font = '900 16px sans-serif';
          ctx.fillText(d.card.name, 150, 114);
          ctx.fillStyle = '#67e8f9'; ctx.font = 'bold 13px sans-serif';
          ctx.fillText('POWER: ' + d.card.power + '  |  OWNER: ' + d.ownerName.toUpperCase(), 150, 144);
          socket.emit('postArenaMeme', { image: c.toDataURL('image/jpeg', 0.85) });
        });
      }, 600);
    })();
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('renderFlexCard')) {
                body = body.replace('</body>', GACHA_FLEX_SCRIPT + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // === 🚨 PIECE 2/2: BOUNTY PAYOUTS & CHAT COMMANDS ===
    const _prevIoEmit = io.emit.bind(io);
    io.emit = function(event, ...args) {
        const payload = args.at(0);
        if (event === 'announceWinner' && payload && typeof payload === 'object' && payload.winner) {
            const srvId = payload._serverId || lastActiveServerId;
            const winRaw = String(payload.winner);
            const arena = srvId ? getArena(srvId) : null;
            const matchedPlayer = (arena && Array.isArray(arena.players))
                ? arena.players.find(p => winRaw.toLowerCase().includes(p.username.toLowerCase()))
                : null;
            if (matchedPlayer && srvId) {
                const wName = matchedPlayer.username;
                const wKey = wName.toLowerCase();
                const bal = addCoins(wName, 50);

                const opp = (arena.captainA && arena.captainA.username.toLowerCase() === wKey) ? arena.captainB : arena.captainA;
                if (opp && activeBounties.has(opp.username.toLowerCase())) {
                    const reward = activeBounties.get(opp.username.toLowerCase());
                    activeBounties.delete(opp.username.toLowerCase());
                    const newBal = addCoins(wName, reward);
                    setTimeout(() => {
                        io.to(srvId).emit('message', {
                            username: "Sammu's Bot",
                            text: `💀💰 **BOUNTY CLAIMED!!** **${wName}** defeated **${opp.username}** and stole the **+${reward}🪙 Bounty**! (Balance: **${newBal}🪙**)`,
                            _serverId: srvId
                        });
                    }, 600);
                }

                const st = (serverWinStreaks.get(wKey) || 0) + 1;
                serverWinStreaks.set(wKey, st);
                if (opp) serverWinStreaks.set(opp.username.toLowerCase(), 0);

                if (st === 3 && !activeBounties.has(wKey)) {
                    activeBounties.set(wKey, 200);
                    setTimeout(() => {
                        io.to(srvId).emit('message', {
                            username: "Sammu's Bot",
                            text: `🚨🔥 **AUTO-BOUNTY!** **${wName}** hit a **3x Win Streak**! **200🪙 Bounty** placed on their head!`,
                            _serverId: srvId
                        });
                    }, 800);
                } else {
                    setTimeout(() => {
                        io.to(srvId).emit('message', {
                            username: "Sammu's Bot",
                            text: `🪙 **${wName}** earned **+50 Coins** (Total: **${bal}🪙**)! Type \`!pack\` to open cards!`,
                            _serverId: srvId
                        });
                    }, 550);
                }
            }
        }
        return _prevIoEmit(event, ...args);
    };

    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof raw !== 'string') return;
            const clean = raw.trim();
            const low = clean.toLowerCase();
            const sender = socket.username || (payload && payload.username) || 'Player';
            const sKey = sender.toLowerCase();

            if (low === '!pack') {
                const bal = getCoins(sender);
                if (bal < 100) {
                    socket.emit('message', { username: "Sammu's Bot", text: `🪙 Need **100 Coins** (You have **${bal}🪙**). Win matches to earn +50🪙!`, _serverId: srvId });
                    return;
                }
                const left = addCoins(sender, -100);
                const roll = Math.random();
                const tier = roll < 0.14 ? 'MYTHIC' : (roll < 0.48 ? 'EPIC' : 'COMMON');
                const pool = CARD_POOL.filter(c => c.tier === tier);
                const pulled = pool[Math.floor(Math.random() * pool.length)];

                if (!playerCards.has(sKey)) playerCards.set(sKey, []);
                playerCards.get(sKey).push(pulled);

                const badge = tier === 'MYTHIC' ? '🌈✨ **MYTHIC PULL!!**' : (tier === 'EPIC' ? '💜🔥 **EPIC PULL!**' : '🃏 **Card Pulled:**');
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `${badge} **${sender}** unboxed **${pulled.emoji} ${pulled.name}** (PWR **${pulled.power}**)! (${left}🪙 left) — Type \`!flex\`!`,
                    _serverId: srvId
                });
            }

            if (low === '!cards') {
                const deck = playerCards.get(sKey) || [];
                const bal = getCoins(sender);
                if (deck.length === 0) {
                    socket.emit('message', { username: "Sammu's Bot", text: `🃏 **${sender}** has **0 cards** (${bal}🪙). Type \`!pack\` (100🪙)!`, _serverId: srvId });
                } else {
                    const list = deck.slice(-8).map(c => `${c.emoji} **${c.name}** [${c.tier}]`).join(' • ');
                    socket.emit('message', { username: "Sammu's Bot", text: `🃏 **${sender}'s Deck (${deck.length} | ${bal}🪙):**\n${list}\n*(Type \`!flex\` to show your best card!)*`, _serverId: srvId });
                }
            }

            if (low === '!flex') {
                const deck = playerCards.get(sKey) || [];
                if (deck.length === 0) {
                    socket.emit('message', { username: "Sammu's Bot", text: `⚠️ Open a pack with \`!pack\` first!`, _serverId: srvId });
                    return;
                }
                const best = [...deck].sort((a, b) => b.power - a.power)[0];
                io.to(srvId).emit('renderFlexCard', { card: best, ownerName: sender, ownerSocket: socket.id, _serverId: srvId });
            }

            if (low.startsWith('!bounty ')) {
                const parts = clean.slice(8).replace('@', '').trim().split(/\s+/);
                const targetName = parts[0];
                const amt = Math.max(50, Math.min(1000, parseInt(parts[1], 10) || 100));
                if (!targetName || targetName.toLowerCase() === sKey) return;
                if (getCoins(sender) < amt) {
                    socket.emit('message', { username: "Sammu's Bot", text: `🪙 Not enough coins! Balance: **${getCoins(sender)}🪙**.`, _serverId: srvId });
                    return;
                }
                addCoins(sender, -amt);
                const tKey = targetName.toLowerCase();
                const totalBounty = (activeBounties.get(tKey) || 0) + amt;
                activeBounties.set(tKey, totalBounty);
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `🚨💀 **BOUNTY PLACED!** **${sender}** put **${amt}🪙** on **${targetName}**! (Total: **${totalBounty}🪙**) Beat them in 1v1 to steal it!`,
                    _serverId: srvId
                });
            }

            if (low === '!bounties') {
                if (activeBounties.size === 0) {
                    socket.emit('message', { username: "Sammu's Bot", text: `📜 No active bounties! Type \`!bounty <name> 100\` to hunt someone!`, _serverId: srvId });
                } else {
                    const list = Array.from(activeBounties.entries()).map(([n, c]) => `💀 **${n.toUpperCase()}**: **${c}🪙**`).join(' | ');
                    io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🚨 **WANTED BOARD:** ${list}`, _serverId: srvId });
                }
            }
        });
    });
    // === 📅 PIECE 1/2: DAILY STREAK (!daily) & CARD DUEL (!duelcard) ===
    const dailyClaims = new Map();
    const pendingCardDuels = new Map();

    function resolveCardClash(srvId, p1Name, p2Name, bet) {
        const d1 = [...(playerCards.get(p1Name.toLowerCase()) || [])].sort((a, b) => b.power - a.power).slice(0, 3);
        const d2 = [...(playerCards.get(p2Name.toLowerCase()) || [])].sort((a, b) => b.power - a.power).slice(0, 3);

        let w1 = 0, w2 = 0;
        const lines = [];
        for (let i = 0; i < 3; i++) {
            const c1 = d1[i] || { emoji: "🃏", name: "Rookie Recruit", power: 50 };
            const c2 = d2[i] || { emoji: "🃏", name: "Rookie Recruit", power: 50 };
            const roll1 = c1.power + Math.floor(Math.random() * 14);
            const roll2 = c2.power + Math.floor(Math.random() * 14);
            if (roll1 >= roll2) {
                w1++;
                lines.push(`R${i + 1}: ${c1.emoji} **${c1.name}** (${roll1}) ⚔️ beats ${c2.emoji} ${c2.name} (${roll2})`);
            } else {
                w2++;
                lines.push(`R${i + 1}: ${c2.emoji} **${c2.name}** (${roll2}) ⚔️ beats ${c1.emoji} ${c1.name} (${roll1})`);
            }
        }

        const champ = w1 > w2 ? p1Name : p2Name;
        const totalPot = bet * 2;
        const newBal = addCoins(champ, totalPot);

        io.to(srvId).emit('message', {
            username: "Sammu's Bot",
            text: `🃏⚔️ **CARD BATTLE RESULTS (${p1Name} vs ${p2Name}):**\n${lines.join('\n')}\n🏆 **WINNER:** **${champ}** won **+${totalPot}🪙**! (Balance: **${newBal}🪙**)`,
            _serverId: srvId
        });
    }
      // === ⚔️ PIECE 2/2: DAILY & CARD BATTLE LISTENERS ===
    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof raw !== 'string') return;
            const clean = raw.trim();
            const low = clean.toLowerCase();
            const sender = socket.username || (payload && payload.username) || 'Player';
            const sKey = sender.toLowerCase();

            // 1. Daily Streak Reward (!daily)
            if (low === '!daily') {
                const now = Date.now();
                const dayMs = 24 * 60 * 60 * 1000;
                const rec = dailyClaims.get(sKey) || { last: 0, streak: 0 };

                if (now - rec.last < dayMs) {
                    const hrsLeft = Math.ceil((dayMs - (now - rec.last)) / (60 * 60 * 1000));
                    socket.emit('message', { username: "Sammu's Bot", text: `⏳ **${sender}**, you already claimed your Daily! Come back in **${hrsLeft}h** (Current Streak: **${rec.streak}🔥**).`, _serverId: srvId });
                    return;
                }

                const streak = (now - rec.last < dayMs * 2) ? (rec.streak % 7) + 1 : 1;
                dailyClaims.set(sKey, { last: now, streak });
                const reward = 100 + (streak * 25);
                const bal = addCoins(sender, reward);

                if (streak === 7) {
                    const mythics = CARD_POOL.filter(c => c.tier === 'MYTHIC');
                    const bonusCard = mythics[Math.floor(Math.random() * mythics.length)];
                    if (!playerCards.has(sKey)) playerCards.set(sKey, []);
                    playerCards.get(sKey).push(bonusCard);
                    io.to(srvId).emit('message', {
                        username: "Sammu's Bot",
                        text: `🎉🔥 **DAY 7 MEGA STREAK!!** **${sender}** claimed **+${reward}🪙** (${bal}🪙 total) PLUS a **FREE MYTHIC CARD: ${bonusCard.emoji} ${bonusCard.name}**! 🌈👑`,
                        _serverId: srvId
                    });
                } else {
                    io.to(srvId).emit('message', {
                        username: "Sammu's Bot",
                        text: `📅🔥 **DAILY REWARD (Day ${streak}/7)!** **${sender}** claimed **+${reward}🪙**! (Balance: **${bal}🪙** | Hit Day 7 for a FREE Mythic Card!)`,
                        _serverId: srvId
                    });
                }
            }

            // 2. Challenge Someone to a 3-Card Battle (!duelcard <name> [bet])
            if (low.startsWith('!duelcard ')) {
                const parts = clean.slice(10).replace('@', '').trim().split(/\s+/);
                const targetName = parts;
                const bet = Math.max(50, Math.min(500, parseInt(parts, 10) || 100));
                if (!targetName || targetName.toLowerCase() === sKey) return;

                if ((playerCards.get(sKey) || []).length === 0) {
                    socket.emit('message', { username: "Sammu's Bot", text: `⚠️ Open at least 1 pack with \`!pack\` before battling!`, _serverId: srvId });
                    return;
                }
                if (getCoins(sender) < bet) {
                    socket.emit('message', { username: "Sammu's Bot", text: `🪙 Need **${bet}🪙** to start this Card Duel (You have **${getCoins(sender)}🪙**).`, _serverId: srvId });
                    return;
                }

                pendingCardDuels.set(targetName.toLowerCase(), { challenger: sender, bet, srvId, expires: Date.now() + 45000 });
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `🃏⚔️ **CARD DUEL CHALLENGE!** **${sender}** challenged **${targetName}** to a 3-Round Deck Battle for **${bet}🪙**!\n👉 **${targetName}**, type \`!acceptcard\` within 45s to fight!`,
                    _serverId: srvId
                });
            }

            // 3. Accept Card Battle (!acceptcard)
            if (low === '!acceptcard') {
                const duel = pendingCardDuels.get(sKey);
                if (!duel || duel.srvId !== srvId || Date.now() > duel.expires) {
                    socket.emit('message', { username: "Sammu's Bot", text: `⚠️ No active Card Duel challenge for you right now!`, _serverId: srvId });
                    return;
                }
                if (getCoins(sender) < duel.bet || getCoins(duel.challenger) < duel.bet) {
                    pendingCardDuels.delete(sKey);
                    socket.emit('message', { username: "Sammu's Bot", text: `🪙 One of the players no longer has **${duel.bet}🪙** for the wager!`, _serverId: srvId });
                    return;
                }
                pendingCardDuels.delete(sKey);
                addCoins(duel.challenger, -duel.bet);
                addCoins(sender, -duel.bet);
                resolveCardClash(srvId, duel.challenger, sender, duel.bet);
            }
        });
    });
    // === ⚖️ #35 COURTROOM CHAOS — PART 1/2 (CASES & UI) ===
    const courtByServer = new Map();
    const COURT_CASES = [
        "stealing the Host's Wi-Fi and still blaming 'lag' after losing in 2 seconds!",
        "eating everyone's Biryani in the lobby and blaming Tommy the Dog!",
        "faking a low-battery disconnect right before losing a 1v1 duel!",
        "using a calculator during Math Blitz and still getting the wrong answer!",
        "camping in a corner during 3D Survive the Killer for 60 seconds straight!",
        "secretly simping in chat while pretending to be a Sigma Chad!",
        "putting a fake bounty on their own best friend just to start drama!",
        "stealing Mochi the Cat's golden crown and hiding it under the sofa!",
        "typing 'EZ' in chat after getting carried by their teammate!",
        "hoarding all the coconuts on Castaway Island while everyone starved!",
        "opening 5 Mystery Boxes and getting cursed with Clown Mode every time!",
        "claiming to be the Pro of the server with a 0% win streak!",
        "bribery of the Judge with a virtual samosa before the match started!",
        "forgetting to pass the bomb in Bomb Pass because they were busy flexing cards!",
        "starting a fake rumor in Word Imposter to get an innocent player voted out!"
    ];

    const COURT_UI = `
    <div id="courtBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999999;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(69,26,3,0.97),rgba(15,23,42,0.97));border:2px solid #f59e0b;border-radius:16px;padding:10px 12px;width:100%;max-width:385px;color:#fff;text-align:center;box-shadow:0 6px 26px rgba(245,158,11,0.55);backdrop-filter:blur(6px);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-weight:900;font-size:11px;color:#fbbf24;">⚖️ SAMMU SUPREME COURT</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="courtTimer" style="font-size:11px;color:#38bdf8;font-weight:900;">⏳ 30s</span>
            <button onclick="document.getElementById('courtBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div id="courtMatchup" style="font-size:11px;font-weight:bold;color:#fde047;margin-bottom:4px;">😈 Accused vs 🕵️ Prosecutor</div>
        <div id="courtCharge" style="background:rgba(245,158,11,0.18);border:1px solid #fbbf24;border-radius:8px;padding:5px 7px;margin-bottom:6px;font-size:11px;color:#fef3c7;">Charge loading...</div>
        <div id="courtControls" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;"></div>
      </div>
    </div>
    <script>
    (function() {
      function injectCourtBtn() {
        const anchor = Array.from(document.querySelectorAll('button')).find(b => /castaway island|bluff master|bank heist|hoop shootout/i.test(b.textContent || ''));
        if (anchor && anchor.parentElement && !document.getElementById('btnLaunchCourt35')) {
          const btn = anchor.cloneNode(true);
          btn.id = 'btnLaunchCourt35';
          btn.removeAttribute('onclick');
          btn.textContent = '35. ⚖️ Courtroom Chaos';
          btn.onclick = () => { if (typeof socket !== 'undefined') socket.emit('chatMessage', '!court'); };
          anchor.parentElement.appendChild(btn);
        }
      }
      setInterval(injectCourtBtn, 1800);

      function bindCourt() {
        if (typeof socket === 'undefined' || window._courtBound) return;
        window._courtBound = true;

        socket.on('courtSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('courtBar').style.display = 'flex';
          document.getElementById('courtTimer').textContent = (d.phase === 'debate' ? '🗣️ ' : '🗳️ ') + d.timeLeft + 's';
          document.getElementById('courtMatchup').innerHTML = '😈 <span style="color:#f87171;">' + d.accusedName + '</span> vs 🕵️ <span style="color:#38bdf8;">' + d.prosecutorName + '</span> | 👨‍⚖️ ' + d.judgeName;
          document.getElementById('courtCharge').textContent = '📜 CHARGE: ' + d.charge;

          const box = document.getElementById('courtControls');
          box.innerHTML = '';

          if (d.myRole === 'JUDGE') {
            if (d.phase === 'debate') {
              [
                { act: 'gavel', label: '🔨 ORDER! (+10s)', bg: '#b45309' },
                { act: 'objection', label: '🚨 OBJECTION! (-30🪙)', bg: '#dc2626' },
                { act: 'voteNow', label: '⚖️ Open Jury Vote', bg: '#15803d' }
              ].forEach(c => {
                const b = document.createElement('button');
                b.style.cssText = 'background:' + c.bg + ';border:1px solid #fff;color:#fff;padding:5px 8px;border-radius:8px;font-weight:900;font-size:10px;cursor:pointer;';
                b.textContent = c.label;
                b.onclick = () => socket.emit('judgeAction', c.act);
                box.appendChild(b);
              });
            } else {
              box.innerHTML = '<span style="font-size:11px;color:#fde047;font-weight:bold;">👨‍⚖️ Jury is voting (' + d.voteCount + ' votes cast)...</span>';
            }
          } else if (d.phase === 'debate') {
            if (d.myRole === 'ACCUSED') {
              box.innerHTML = '<span style="font-size:11px;color:#fca5a5;font-weight:bold;">😈 DEFEND YOURSELF IN CHAT NOW! Prove you are innocent!</span>';
            } else if (d.myRole === 'PROSECUTOR') {
              box.innerHTML = '<span style="font-size:11px;color:#7dd3fc;font-weight:bold;">🕵️ ROAST & EXPOSE THEM IN CHAT! Convince the Jury!</span>';
            } else {
              box.innerHTML = '<span style="font-size:11px;color:#cbd5e1;">👥 You are the JURY! Listen to both sides in chat before voting!</span>';
            }
          } else {
            if (d.myRole === 'ACCUSED' || d.myRole === 'PROSECUTOR') {
              box.innerHTML = '<span style="font-size:11px;color:#fde047;font-weight:bold;">⏳ Jury is deciding your fate...</span>';
            } else if (d.voted) {
              box.innerHTML = '<span style="font-size:11px;color:#4ade80;font-weight:bold;">✅ Verdict cast! Waiting for final count...</span>';
            } else {
              const bInn = document.createElement('button');
              bInn.style.cssText = 'background:#16a34a;border:1.5px solid #fff;color:#fff;padding:6px 12px;border-radius:9px;font-weight:900;font-size:11px;cursor:pointer;';
              bInn.textContent = '😇 INNOCENT';
              bInn.onclick = () => socket.emit('courtVote', 'INNOCENT');

              const bGui = document.createElement('button');
              bGui.style.cssText = 'background:#dc2626;border:1.5px solid #fff;color:#fff;padding:6px 12px;border-radius:9px;font-weight:900;font-size:11px;cursor:pointer;';
              bGui.textContent = '😈 GUILTY';
              bGui.onclick = () => socket.emit('courtVote', 'GUILTY');

              box.appendChild(bInn);
              box.appendChild(bGui);
            }
          }
        });

        socket.on('courtEnd', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('courtBar').style.display = 'none';
        });
      }
      setInterval(bindCourt, 1200);
    })();
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('courtBar')) {
                body = body.replace('</body>', COURT_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // === ⚖️ #35 COURTROOM CHAOS — PART 2/2 (ENGINE & SOCKET EVENTS) ===
    function broadcastCourt(srvId) {
        const st = courtByServer.get(srvId);
        if (!st) return;
        st.players.forEach(p => {
            let myRole = 'JURY';
            if (p.id === st.judge.id) myRole = 'JUDGE';
            else if (p.id === st.accused.id) myRole = 'ACCUSED';
            else if (p.id === st.prosecutor.id) myRole = 'PROSECUTOR';

            io.to(p.id).emit('courtSync', {
                phase: st.phase,
                timeLeft: st.timeLeft,
                charge: st.charge,
                judgeName: st.judge.username,
                accusedName: st.accused.username,
                prosecutorName: st.prosecutor.username,
                myRole,
                voted: st.votes.has(p.id),
                voteCount: st.votes.size,
                _serverId: srvId
            });
        });
    }

    function finishCourt(srvId) {
        const st = courtByServer.get(srvId);
        if (!st) return;
        clearInterval(st.interval);
        courtByServer.delete(srvId);
        io.to(srvId).emit('courtEnd', { _serverId: srvId });

        let guilty = 0, innocent = 0;
        for (const v of st.votes.values()) {
            if (v === 'GUILTY') guilty++;
            else innocent++;
        }

        const isGuilty = guilty > innocent;
        const winner = isGuilty ? st.prosecutor.username : st.accused.username;
        const newBal = addCoins(winner, 150);

        io.to(srvId).emit('message', {
            username: "Sammu's Bot",
            text: `🔨⚖️ **COURT VERDICT IS IN!** (Guilty: **${guilty}** vs Innocent: **${innocent}**)\n` +
                  (isGuilty
                      ? `🚨 **GUILTY!!** Prosecutor **${st.prosecutor.username}** destroyed **${st.accused.username}** in court and won **+150🪙** (Total: **${newBal}🪙**)! ⛓️😂`
                      : `😇 **NOT GUILTY!!** **${st.accused.username}** talked their way out of jail and won **+150🪙** (Total: **${newBal}🪙**)! 🏆🔥`),
            _serverId: srvId
        });
    }

    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const txt = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof txt !== 'string' || txt.trim().toLowerCase() !== '!court') return;
            if (courtByServer.has(srvId)) return;

            const roomPlayers = getFullRoomPlayers(srvId);
            if (roomPlayers.length < 3) {
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: '⚠️ Need at least **3 players** (Judge, Accused, Prosecutor/Jury) for **⚖️ Courtroom Chaos**!',
                    _serverId: srvId
                });
                return;
            }

            const arena = getArena(srvId);
            const judge = roomPlayers.find(p => p.id === arena.hostId || p.isHost) || roomPlayers[0];
            const others = roomPlayers.filter(p => p.id !== judge.id).sort(() => Math.random() - 0.5);
            const accused = others[0];
            const prosecutor = others[1];
            const charge = COURT_CASES[Math.floor(Math.random() * COURT_CASES.length)];

            const st = {
                players: roomPlayers,
                judge,
                accused,
                prosecutor,
                charge,
                phase: 'debate',
                timeLeft: 30,
                votes: new Map(),
                interval: null
            };
            courtByServer.set(srvId, st);

            st.interval = setInterval(() => {
                const c = courtByServer.get(srvId);
                if (!c) return;
                c.timeLeft--;
                if (c.timeLeft <= 0) {
                    if (c.phase === 'debate') {
                        c.phase = 'vote';
                        c.timeLeft = 15;
                        io.to(srvId).emit('message', {
                            username: "Sammu's Bot",
                            text: '🗳️ **DEBATE OVER! JURY VOTING OPEN!** Tap **😇 INNOCENT** or **😈 GUILTY** in the top bar!',
                            _serverId: srvId
                        });
                        broadcastCourt(srvId);
                    } else {
                        finishCourt(srvId);
                    }
                } else {
                    broadcastCourt(srvId);
                }
            }, 1000);

            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `⚖️🔨 **COURT IS IN SESSION!**\n👨‍⚖️ **Judge:** **${judge.username}**\n😈 **Accused:** **${accused.username}** (Charged with *${charge}*)\n🕵️ **Prosecutor:** **${prosecutor.username}**\n🗣️ Argue in chat for 30s—everyone else is the Jury!`,
                _serverId: srvId
            });
            broadcastCourt(srvId);
        });

        socket.on('judgeAction', (act) => {
            const srvId = socket.activeServerId;
            const st = srvId ? courtByServer.get(srvId) : null;
            if (!st || socket.id !== st.judge.id) return;

            if (act === 'gavel') {
                st.timeLeft += 10;
                io.to(srvId).emit('message', { username: "👨‍⚖️ Judge " + st.judge.username, text: '🔨 **ORDER IN THE COURT!** Judge added **+10 seconds** to the debate!', _serverId: srvId });
                broadcastCourt(srvId);
            } else if (act === 'objection') {
                const target = Math.random() < 0.5 ? st.accused : st.prosecutor;
                addCoins(target.username, -30);
                io.to(srvId).emit('message', { username: "👨‍⚖️ Judge " + st.judge.username, text: `🚨 **OBJECTION SUSTAINED!** **${target.username}** was fined **-30🪙** for Contempt of Court! 😂`, _serverId: srvId });
            } else if (act === 'voteNow' && st.phase === 'debate') {
                st.phase = 'vote';
                st.timeLeft = 15;
                io.to(srvId).emit('message', { username: "👨‍⚖️ Judge " + st.judge.username, text: '⚖️ **SILENCE!** Judge closed the debate early—**JURY VOTE NOW!**', _serverId: srvId });
                broadcastCourt(srvId);
            }
        });

        socket.on('courtVote', (choice) => {
            const srvId = socket.activeServerId;
            const st = srvId ? courtByServer.get(srvId) : null;
            if (!st || st.phase !== 'vote') return;
            if (socket.id === st.accused.id || socket.id === st.prosecutor.id) return;
            if (st.votes.has(socket.id)) return;

            st.votes.set(socket.id, choice === 'GUILTY' ? 'GUILTY' : 'INNOCENT');
            const eligibleVoters = st.players.filter(p => p.id !== st.accused.id && p.id !== st.prosecutor.id).length;
            if (st.votes.size >= eligibleVoters) {
                finishCourt(srvId);
            } else {
                broadcastCourt(srvId);
            }
        });
    });
                

                
       // ============================================================================
    // ⚔️ SAMMUVERSE V4 ENGINE — PIECE 1A/20: DB FILES, CLOUD SYNC & LINEAGES
    // ============================================================================
    const SV_LOG_FILE = path.join(__dirname, 'sammuverse_logs.json');
    const SV_STATS_FILE = path.join(__dirname, 'sammuverse_stats.json');
    const ECONOMY_DB_FILE = path.join(__dirname, 'sammu_economy.json');
    let svBattleLogs = [];
    let svPlayerStats = {};

    if (fs.existsSync(SV_LOG_FILE)) { try { svBattleLogs = JSON.parse(fs.readFileSync(SV_LOG_FILE, 'utf8')); } catch (e) {} }
    if (fs.existsSync(SV_STATS_FILE)) { try { svPlayerStats = JSON.parse(fs.readFileSync(SV_STATS_FILE, 'utf8')); } catch (e) {} }
    if (fs.existsSync(ECONOMY_DB_FILE)) {
        try {
            const savedEco = JSON.parse(fs.readFileSync(ECONOMY_DB_FILE, 'utf8'));
            if (savedEco.wallets) Object.entries(savedEco.wallets).forEach(([k, v]) => playerWallet.set(k, v));
            if (savedEco.cards) Object.entries(savedEco.cards).forEach(([k, v]) => playerCards.set(k, v));
        } catch (e) {}
    }

    const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/^UPSTASH_REDIS_REST_URL=/i, '').replace(/^["']|["']$/g, '').trim();
    const UPSTASH_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || '').replace(/^UPSTASH_REDIS_REST_TOKEN=/i, '').replace(/^["']|["']$/g, '').trim();

    async function upstashCmd(cmdArray) {
        if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
        try {
            const res = await fetch(UPSTASH_URL, {
                method: 'POST',
                headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(cmdArray)
            });
            const data = await res.json();
            return data ? data.result : null;
        } catch (e) { return null; }
    }

    function saveSvStats() {
        try { fs.writeFileSync(SV_STATS_FILE, JSON.stringify(svPlayerStats, null, 2)); } catch (e) {}
        if (UPSTASH_URL && UPSTASH_TOKEN) upstashCmd(['SET', 'sammu_sv_stats', JSON.stringify(svPlayerStats)]);
    }

    function saveEconomyDB() {
        try {
            fs.writeFileSync(ECONOMY_DB_FILE, JSON.stringify({
                wallets: Object.fromEntries(playerWallet),
                cards: Object.fromEntries(playerCards)
            }, null, 2));
        } catch (e) {}
        if (UPSTASH_URL && UPSTASH_TOKEN) {
            upstashCmd(['SET', 'sammu_economy', JSON.stringify({ wallets: Object.fromEntries(playerWallet), cards: Object.fromEntries(playerCards) })]);
        }
    }

    const _origAddCoinsV4 = addCoins;
    addCoins = function(uname, amt) {
        const res = _origAddCoinsV4(uname, amt);
        saveEconomyDB();
        return res;
    };

    const SV_LINEAGES = {
        human:     { icon: '🧑', name: 'Mortal Explorer',       stage3: '👑 Ascendant Hero',       hpTurn: 0,  dmgMult: 1.00, steal: 0,    absorb: 0,    stunImmune: false },
        slime:     { icon: '🟢', name: 'Primordial Void Slime', stage3: '🟢 Void Sovereign Slime', hpTurn: 14, dmgMult: 1.05, steal: 0,    absorb: 0.12, stunImmune: false },
        ape:       { icon: '🐵', name: 'Astral Ape Warrior',    stage3: '⚡ Super Astral God',     hpTurn: 0,  dmgMult: 1.22, steal: 0,    absorb: 0,    stunImmune: false },
        reaper:    { icon: '👻', name: 'Phantom Soul Reaper',   stage3: '⚔️ Eclipse Bankai',       hpTurn: 0,  dmgMult: 1.18, steal: 0.05, absorb: 0,    stunImmune: false },
        demon:     { icon: '😈', name: 'Infernal Demonkin',     stage3: '🔥 Abyssal Overlord',     hpTurn: 0,  dmgMult: 1.10, steal: 0.16, absorb: 0,    stunImmune: false },
        dragonkin: { icon: '🐉', name: 'Ancient Dragonkin',     stage3: '🐲 Cosmic Wyrm King',     hpTurn: 8,  dmgMult: 1.15, steal: 0,    absorb: 0.08, stunImmune: false },
        celestial: { icon: '🔱', name: 'Celestial Avatar',      stage3: '🔱 Supreme Cosmic Deity', hpTurn: 12, dmgMult: 1.25, steal: 0.10, absorb: 0.10, stunImmune: true  }
    };
                 
        // ============================================================================
    // ⚔️ SAMMUVERSE V4 ENGINE — PIECE 1B/20: TITLES, PROFILE LOADER & LOGGER
    // ============================================================================
    const SV_TITLES = [
        { id: 'rookie',     tag: '🌱 Rookie',           color: '#94a3b8', req: 'Default Starter Title' },
        { id: 'hunter',     tag: '⚔️ Bounty Hunter',    color: '#38bdf8', req: 'Reach 1.0M Bounty Honor' },
        { id: 'warlord',    tag: '🏴‍☠️ Warlord',          color: '#a855f7', req: 'Reach 2.5M Bounty Honor' },
        { id: 'emperor',    tag: '💀 Abyss Emperor',    color: '#f43f5e', req: 'Reach 10.0M Bounty Honor' },
        { id: 'sovereign',  tag: '👑 Sammu Sovereign',  color: '#facc15', req: 'Reach 30.0M Bounty Honor' },
        { id: 'v3god',      tag: '🔥 V3 Ascended',      color: '#fb923c', req: 'Reach 100 Wins on any Power (V3)' },
        { id: 'titanlord',  tag: '🌌 Colossal Titan',   color: '#f43f5e', req: 'Unlock Titan Crown Gear' },
        { id: 'omegagod',   tag: '⚡ Omega Awakened',   color: '#38bdf8', req: 'Unlock Omega Core Gear' },
        { id: 'adventurer', tag: '🗺️ Realm Conqueror',  color: '#4ade80', req: 'Clear Adventure Chapter 5' },
        { id: 'petmaster',  tag: '🐉 Ouroboros Tamer',  color: '#e879f9', req: 'Merge an Evolved Mega Pet' },
        { id: 'voidslime',  tag: '🟢 Void Slime King',  color: '#4ade80', req: 'Awaken Void Slime Stage 3' },
        { id: 'gymgod',     tag: '🏋️ Gym Sovereign',    color: '#fb923c', req: 'Reach Total Training Level 50' },
        { id: 'godly',      tag: '✨ Godly Enchanted',  color: '#67e8f9', req: 'Roll a Godly Enchantment' },
        { id: 'forger',     tag: '⚗️ Soul Forger',      color: '#e879f9', req: 'Forge a Custom Fusion Power' },
        { id: 'vishnu',     tag: '🔱 MahaVishnu',       color: '#fde047', req: 'Unlock MahaVishnu Power' },
        { id: 'lunaremp',   tag: '🌙 Lunar Empress',    color: '#fda4af', req: 'Unlock Dr. Moon Power' },
        { id: 'tower25',    tag: '🗼 Tower Climber',    color: '#38bdf8', req: 'Reach Floor 25 in Endless Tower' },
        { id: 'tower50',    tag: '♾️ Infinite Sovereign',color: '#e879f9', req: 'Reach Floor 50 in Endless Tower' },
        { id: 'tower100',   tag: '🌌 Floor 100 God',    color: '#facc15', req: 'Reach Floor 100 in Endless Tower' },
        { id: 'rich',       tag: '💎 Millionaire',      color: '#4ade80', req: 'Hold 100,000+ Coins' }
    ];

    function getSvProfile(uname) {
        const k = (uname || 'Player').toLowerCase().trim();
        if (!svPlayerStats[k]) {
            svPlayerStats[k] = {
                atkLv: 0, hpLv: 0, wins: 0, streak: 0, bounty: 10000, maxTowerFloor: 1, towerCheckpoint: 1,
                lineage: 'human', lineageStage: 1, activeTitle: 'rookie', unlockedTitles: ['rookie'],
                training: { fistLv: 0, bodyLv: 0, chiLv: 0, xp: 0 },
                gears: { omegaCore: false, titanCrown: false },
                adventure: { chapter: 1, stage: 1, cleared: false },
                petEssence: 0, lastDailySpin: 0,
                hasStone: false, unlockedPowers: [], ownedPets: [], activePet: null, activePet2: null,
                ownedRelics: [], activeRelic: null, enchants: {}, powerWins: {}, customPowers: [], redeemedCodes: []
            };
        }
        const p = svPlayerStats[k];
        if (!p.training) p.training = { fistLv: 0, bodyLv: 0, chiLv: 0, xp: 0 };
        if (!p.gears) p.gears = { omegaCore: false, titanCrown: false };
        if (!p.adventure) p.adventure = { chapter: 1, stage: 1, cleared: false };
        if (typeof p.petEssence !== 'number') p.petEssence = 0;
        if (typeof p.lastDailySpin !== 'number') p.lastDailySpin = 0;
        if (!Array.isArray(p.unlockedTitles)) p.unlockedTitles = ['rookie'];
        if (typeof p.bounty !== 'number') p.bounty = 10000;
        if (!p.lineage) p.lineage = 'human';
        if (!p.lineageStage) p.lineageStage = 1;
        if (!p.activeTitle) p.activeTitle = 'rookie';
        if (!p.powerWins) p.powerWins = {};
        if (!Array.isArray(p.customPowers)) p.customPowers = p.customPower ? [p.customPower] : [];
        p.coins = getCoins(uname);
        return p;
    }

    function syncPlayerTitlesAndBounty(uname) {
        if (!uname) return;
        const prof = getSvProfile(uname);
        const grant = (id) => { if (!prof.unlockedTitles.includes(id)) prof.unlockedTitles.push(id); };
        if (prof.bounty >= 1000000) grant('hunter');
        if (prof.bounty >= 2500000) grant('warlord');
        if (prof.bounty >= 10000000) grant('emperor');
        if (prof.bounty >= 30000000) grant('sovereign');
        if (Object.values(prof.powerWins || {}).some(w => w >= 100)) grant('v3god');
        if (prof.gears?.omegaCore) grant('omegagod');
        if (prof.gears?.titanCrown) grant('titanlord');
        if (prof.adventure?.cleared || (prof.adventure?.chapter || 1) > 5) grant('adventurer');
        if ((prof.ownedPets || []).includes('ouroboros') || (prof.ownedPets || []).includes('chimera')) grant('petmaster');
        if (prof.lineage === 'slime' && prof.lineageStage >= 3) grant('voidslime');
        const trTotal = (prof.training?.fistLv || 0) + (prof.training?.bodyLv || 0) + (prof.training?.chiLv || 0);
        if (trTotal >= 50) grant('gymgod');
        if (prof.enchants && Object.values(prof.enchants).some(e => e.id === 'godly')) grant('godly');
        if (prof.customPowers.length > 0) grant('forger');
        if ((prof.unlockedPowers || []).includes('mahavishnu')) grant('vishnu');
        if ((prof.unlockedPowers || []).includes('moon')) grant('lunaremp');
        if ((prof.maxTowerFloor || 1) >= 25) grant('tower25');
        if ((prof.maxTowerFloor || 1) >= 50) grant('tower50');
        if ((prof.maxTowerFloor || 1) >= 100) grant('tower100');
        if (getCoins(uname) >= 100000) grant('rich');
    }

    function recordSvLog(srvId, winner, winPower, loser, losePower) {
        svBattleLogs.unshift({ srvId, winner, winPower, loser, losePower, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) });
        if (svBattleLogs.length > 40) svBattleLogs.pop();
        try { fs.writeFileSync(SV_LOG_FILE, JSON.stringify(svBattleLogs, null, 2)); } catch (e) {}
        io.to(srvId).emit('svLogsUpdate', svBattleLogs.filter(l => l.srvId === srvId));
    }
  // ============================================================================
    // ⚔️ SAMMUVERSE V4 ENGINE — PIECE 2/20: STARTER, RARE & EPIC POWERS
    // ============================================================================
    const SV_DEFS = {
        fire: {
            icon: '🔥', name: 'Fire Inferno', hp: 200, strong: ['ice'],
            moves: [
                { label: 'Fireball (28 DMG)', dmg: 28 },
                { label: 'Flame Tornado (42 DMG)', dmg: 42 },
                { label: 'Heat Shield (Block 70%)', block: 0.70 },
                { label: '☀️ Solar Flare ULT (68 DMG)', dmg: 68, cut: { theme: 'fire', emoji: '☀️🔥', title: 'SOLAR FLARE!' } }
            ]
        },
        water: {
            icon: '🌊', name: 'Water Tsunami', hp: 200, strong: ['fire'],
            moves: [
                { label: 'Hydro Whip (26 DMG)', dmg: 26 },
                { label: 'Whirlpool Trap (35 DMG)', dmg: 35 },
                { label: 'Water Mirror (Reflect 50%)', block: 0.50, reflect: 0.50 },
                { label: '🌊 Abyssal Wave ULT (65 DMG)', dmg: 65, cut: { theme: 'water', emoji: '🌊🐉', title: 'ABYSSAL TSUNAMI!' } }
            ]
        },
        lightning: {
            icon: '⚡', name: 'Lightning Raijin', hp: 200, strong: ['water'],
            moves: [
                { label: 'Thunder Bolt (30 DMG)', dmg: 30 },
                { label: 'Speed Blitz (43 DMG)', dmg: 43 },
                { label: 'Static Armor (Block 65%)', block: 0.65 },
                { label: '🐉 Kirin Sky Dragon ULT (69 DMG)', dmg: 69, cut: { theme: 'lightning', emoji: '⚡🐉', title: 'KIRIN THUNDER DRAGON!' } }
            ]
        },
        ice: {
            icon: '❄️', name: 'Absolute Ice', hp: 200, strong: ['storm'],
            moves: [
                { label: 'Ice Lance (27 DMG)', dmg: 27 },
                { label: 'Frostbite (36 DMG)', dmg: 36 },
                { label: 'Glacier Wall (Block 80%)', block: 0.80 },
                { label: '🧊 Ice Age Freeze ULT (58 DMG + Stun)', dmg: 58, stun: true, cut: { theme: 'ice', emoji: '❄️🧊', title: 'ABSOLUTE ZERO ICE AGE!' } }
            ]
        },
        storm: {
            cost: 300, icon: '🌪️', name: 'Storm Dragon', hp: 205, strong: ['water'],
            moves: [
                { label: 'Gale Blade (29 DMG)', dmg: 29 },
                { label: 'Tornado Slam (43 DMG)', dmg: 43 },
                { label: 'Wind Wall (Block 75%)', block: 0.75 },
                { label: '⚡ Tempest Roar ULT (71 DMG)', dmg: 71, cut: { theme: 'lightning', emoji: '🌪️⚡', title: 'TEMPEST DRAGON ROAR!' } }
            ]
        },
        venom: {
            cost: 300, icon: '☠️', name: 'Venom Hydra', hp: 205, strong: ['water'],
            moves: [
                { label: 'Acid Spit (28 DMG)', dmg: 28 },
                { label: 'Toxic Fang (42 DMG)', dmg: 42 },
                { label: 'Shed Skin (+25 HP & Shield)', block: 0.50, heal: 25 },
                { label: '🐍 Hydra Plague ULT (69 DMG)', dmg: 69, cut: { theme: 'zoro', emoji: '☠️🐍', title: 'HYDRA VENOM APOCALYPSE!' } }
            ]
        },
        rubber: {
            cost: 300, icon: '👒', name: 'Rubber Gear 5', hp: 210, strong: ['lightning'],
            moves: [
                { label: 'Gum-Gum Pistol (29 DMG)', dmg: 29 },
                { label: 'Gatling Barrage (44 DMG)', dmg: 44 },
                { label: 'Elastic Bounce (Evade +15 HP)', evade: true, heal: 15 },
                { label: '👊 Bajrang Fist ULT (72 DMG)', dmg: 72, cut: { theme: 'lightning', emoji: '👒👊', title: 'GEAR 5: BAJRANG GUN!' } }
            ]
        },
        blood: {
            cost: 300, icon: '🩸', name: 'Blood Demon', hp: 205, strong: ['sun'],
            moves: [
                { label: 'Crimson Slash (29 DMG)', dmg: 29 },
                { label: 'Vampire Bite (34 DMG + 18 HP)', dmg: 34, heal: 18 },
                { label: 'Blood Mist (Evade Hit)', evade: true },
                { label: '🌕 Moonlit Massacre ULT (70 DMG)', dmg: 70, cut: { theme: 'moon', emoji: '🩸🌕', title: 'MOONLIT DEMON ART!' } }
            ]
        },
        gravity: {
            cost: 750, icon: '🪐', name: 'Gravity Force', hp: 210, strong: ['rubber'],
            moves: [
                { label: 'Crush Slam (31 DMG)', dmg: 31 },
                { label: 'Meteor Drop (46 DMG)', dmg: 46 },
                { label: 'Gravity Repulse (Block 75%)', block: 0.75 },
                { label: '☄️ Planetary Devastation ULT (74 DMG)', dmg: 74, cut: { theme: 'vishwaroopa', emoji: '☄️🪐', title: 'PLANETARY DEVASTATION!' } }
            ]
        },
        space: {
            cost: 750, icon: '🌌', name: 'Space Warp', hp: 210, strong: ['time'],
            moves: [
                { label: 'Spatial Slash (32 DMG)', dmg: 32 },
                { label: 'Void Rift (44 DMG)', dmg: 44 },
                { label: 'Teleport Dodge (Evade Hit)', evade: true },
                { label: '🌌 Dimension Collapse ULT (74 DMG)', dmg: 74, cut: { theme: 'vishwaroopa', emoji: '🌌💥', title: 'DIMENSION COLLAPSE!' } }
            ]
        },
        time: {
            cost: 750, icon: '⏳', name: 'Time Chrono', hp: 210, strong: ['space'],
            moves: [
                { label: 'Chrono Strike (28 DMG)', dmg: 28 },
                { label: 'Age Decay (40 DMG)', dmg: 40 },
                { label: 'Rewind Heal (+40 HP)', heal: 40 },
                { label: '⏸️ Time Stop ULT (62 DMG + Stun)', dmg: 62, stun: true, cut: { theme: 'chakra', emoji: '⏳⏸️', title: 'CHRONO TIME STOP!' } }
            ]
        },
        sun: {
            cost: 750, icon: '☀️', name: 'Sun God Nika', hp: 215, strong: ['shadow', 'ice'],
            moves: [
                { label: 'Dawn Whip (32 DMG)', dmg: 32 },
                { label: 'Sun Gatling (46 DMG)', dmg: 46 },
                { label: 'Drum Heartbeat (+35 HP)', heal: 35 },
                { label: '🔥 Bajrang Dawn ULT (78 DMG)', dmg: 78, cut: { theme: 'fire', emoji: '☀️🥁', title: 'DRUMS OF LIBERATION!' } }
            ]
        }
    };                                      
         // ============================================================================
    // ⚔️ SAMMUVERSE V4 ENGINE — PIECE 3/20: LEGENDARY, FUSIONS & MYTHICS
    // ============================================================================
    Object.assign(SV_DEFS, {
        shadow: {
            cost: 1500, icon: '🌑', name: 'Shadow Monarch', hp: 225, strong: ['blood'],
            moves: [
                { label: 'Shadow Dagger (35 DMG)', dmg: 35 },
                { label: 'Arise Army (49 DMG)', dmg: 49 },
                { label: 'Umbral Dodge (Evade Hit)', evade: true },
                { label: '👑 Monarch Domain ULT (82 DMG)', dmg: 82, cut: { theme: 'vishwaroopa', emoji: '🌑👑', title: 'ARISE: SHADOW DOMAIN!' } }
            ]
        },
        blackhole: {
            cost: 1500, icon: '🕳️', name: 'Black Hole', hp: 225, strong: ['antimatter', 'gravity'],
            moves: [
                { label: 'Dark Pull (33 DMG)', dmg: 33 },
                { label: 'Event Horizon (44 DMG + Drain)', dmg: 44, heal: 15 },
                { label: 'Matter Absorb (+30 HP & Shield)', block: 0.55, heal: 30 },
                { label: '🕳️ Supermassive Crunch ULT (82 DMG)', dmg: 82, cut: { theme: 'vishwaroopa', emoji: '🕳️🌌', title: 'SUPERMASSIVE SINGULARITY!' } }
            ]
        },
        antimatter: {
            cost: 1500, icon: '⚛️', name: 'Anti-Matter', hp: 220, strong: ['blackhole'],
            moves: [
                { label: 'Positron Beam (36 DMG)', dmg: 36 },
                { label: 'Chain Annihilation (52 DMG)', dmg: 52 },
                { label: 'Phase Shift (Evade Hit)', evade: true },
                { label: '💥 Big Bang Erasure ULT (86 DMG)', dmg: 86, cut: { theme: 'chakra', emoji: '⚛️💥', title: 'BIG BANG ERASURE!' } }
            ]
        },
        zoro: {
            cost: 2000, icon: '⚔️', name: 'Zoro (3-Sword King)', hp: 245, passiveRed: 0.12, strong: ['blood', 'venom'],
            moves: [
                { label: 'Oni Giri (40 DMG)', dmg: 40 },
                { label: 'Dragon Twister (56 DMG)', dmg: 56 },
                { label: 'King Haki Parry (Block 80%)', block: 0.80 },
                { label: '👹 Ashura 9-Sword ULT (94 DMG)', dmg: 94, cut: { theme: 'zoro', emoji: '👹⚔️', title: 'ASHURA: 9-SWORD STYLE!' } }
            ]
        },
        sus: {
            cost: 2000, icon: '👀', name: 'Sus (Shadow Imposter)', hp: 240, passiveRed: 0.12, strong: ['shadow'],
            moves: [
                { label: 'Vent Ambush (40 DMG)', dmg: 40 },
                { label: 'Sabotage Strike (54 DMG)', dmg: 54 },
                { label: 'Fake Task Evade (+35 HP)', evade: true, heal: 35 },
                { label: '🚨 Emergency Eject ULT (92 DMG + Stun)', dmg: 92, stun: true, cut: { theme: 'fire', emoji: '🚨👀', title: 'IMPOSTER EJECTION!' } }
            ]
        },
        moon: {
            cost: 4000, icon: '🌙', name: 'Dr. Moon (Lunar Empress)', hp: 270, passiveRed: 0.18, strong: ['blood', 'venom', 'shadow'],
            moves: [
                { label: '🌙 Lunar Scalpel (44 DMG)', dmg: 44 },
                { label: '🌿 Sanjeevani Surge (58 DMG + 18 HP)', dmg: 58, heal: 18 },
                { label: '🩺 Doctor Elixir (Evade +65 HP)', evade: true, heal: 65 },
                { label: '🌕 Full Moon Eclipse ULT (98 DMG + Stun)', dmg: 98, stun: true, cut: { theme: 'moon', emoji: '🌙🩺', title: 'DR. MOON: LUNAR ECLIPSE!' } }
            ]
        },
        plasma: {
            fused: true, icon: '⚛️🔥', name: 'Plasma Emperor', hp: 300, passiveRed: 0.18, strong: ['ice', 'shadow'],
            moves: [
                { label: 'Plasma Lance (48 DMG)', dmg: 48 },
                { label: 'Supernova Arc (64 DMG)', dmg: 64 },
                { label: 'Ion Barrier (Block 80%)', block: 0.80 },
                { label: '☀️ STAR COLLAPSE ULT (108 DMG)', dmg: 108, cut: { theme: 'fire', emoji: '⚛️🔥', title: 'PLASMA STAR COLLAPSE!' } }
            ]
        },
        leviathan: {
            fused: true, icon: '🐉🌊', name: 'Steam Leviathan', hp: 305, passiveRed: 0.20, strong: ['fire', 'gravity'],
            moves: [
                { label: 'Scalding Geyser (46 DMG)', dmg: 46 },
                { label: 'Boil Tsunami (62 DMG + 18 HP)', dmg: 62, heal: 18 },
                { label: 'Mist Mirage (Evade +28 HP)', evade: true, heal: 28 },
                { label: '🐉 OCEAN BOIL ULT (105 DMG)', dmg: 105, cut: { theme: 'water', emoji: '🐉💨', title: 'LEVIATHAN BOIL STORM!' } }
            ]
        },
        chronovoid: {
            fused: true, icon: '⏳🌌', name: 'Chrono Void God', hp: 295, passiveRed: 0.16, strong: ['antimatter', 'blackhole'],
            moves: [
                { label: 'Reality Tear (50 DMG)', dmg: 50 },
                { label: 'Paradox Loop (58 DMG + Stun)', dmg: 58, stunChance: 0.50 },
                { label: 'Time Rewind (Evade +50 HP)', evade: true, heal: 50 },
                { label: '🌌 BIG CRUNCH ULT (112 True DMG)', dmg: 112, trueDmg: true, cut: { theme: 'vishwaroopa', emoji: '⏳🌌', title: 'CHRONO VOID ERASURE!' } }
            ]
        },
        eclipsenika: {
            fused: true, icon: '🌑☀️', name: 'Eclipse Sun God', hp: 315, passiveRed: 0.22, strong: ['blood', 'venom', 'zoro'],
            moves: [
                { label: 'Dawn Eclipse Fist (52 DMG)', dmg: 52 },
                { label: 'Shadow Liberation (68 DMG)', dmg: 68 },
                { label: 'Drum Pulse (Block 70% + 35 HP)', block: 0.70, heal: 35 },
                { label: '🌑☀️ TOTAL ECLIPSE ULT (116 DMG + Stun)', dmg: 116, stun: true, cut: { theme: 'moon', emoji: '🌑☀️', title: 'TOTAL ECLIPSE LIBERATION!' } }
            ]
        },
        mahavishnu: {
            secret: true, icon: '🔱', name: 'Sammu/Samaksh (MahaVishnu)', hp: 420, passiveRed: 0.40, strong: ['blood', 'shadow', 'venom', 'antimatter'],
            moves: [
                { label: '🪈 Prem Bansuri (65 DMG + Stun)', dmg: 65, stunChance: 0.75, cut: { theme: 'bansuri', emoji: '🪈🦚', title: 'PREM BANSURI MELODY!', sfx: 'flute' } },
                { label: '☸️ Sudarshana Chakra (95 True DMG)', dmg: 95, trueDmg: true, cut: { theme: 'chakra', emoji: '☸️🔥', title: 'SUDARSHANA CHAKRA!' } },
                { label: '🛡️ Vaikuntha Kavach (Evade +80 HP)', evade: true, heal: 80 },
                { label: '🌌 Vishwaroopa ULT (160 True DMG + Stun)', dmg: 160, trueDmg: true, stun: true, cut: { theme: 'vishwaroopa', emoji: '🔱🌌', title: 'VISHWAROOPA SUPREME FORM!' } }
            ]
        },
        millyyt: {
            secret: true, icon: '🎬', name: 'Milly (YouTube Queen)', hp: 295, passiveRed: 0.22, strong: ['fire', 'lightning', 'space', 'time'],
            moves: [
                { label: '🔔 Subscribe Smash (46 DMG + Stun)', dmg: 46, stunChance: 0.50 },
                { label: '📈 10M Viral Surge (64 DMG + 20 HP)', dmg: 64, heal: 20 },
                { label: '💎 Diamond Shield (Evade +50 HP)', evade: true, heal: 50 },
                { label: '▶️ Golden Play Button ULT (115 True DMG)', dmg: 115, trueDmg: true, stun: true, cut: { theme: 'milly', emoji: '▶️👑', title: 'MILLY: GOLDEN PLAY BUTTON!' } }
            ]
        },
        ishikastar: {
            secret: true, icon: '✨', name: 'Ishika (Celestial Empress)', hp: 265, passiveRed: 0.18, strong: ['space', 'time'],
            moves: [
                { label: '💫 Starfall Beam (42 DMG)', dmg: 42 },
                { label: '💥 Supernova Burst (58 DMG)', dmg: 58 },
                { label: '🌸 Astral Blessing (Evade +45 HP)', evade: true, heal: 45 },
                { label: '🌠 Empress Meteor ULT (96 DMG)', dmg: 96, cut: { theme: 'vishwaroopa', emoji: '🌠✨', title: 'CELESTIAL EMPRESS METEOR!' } }
            ]
        },
        zoroking: {
            secret: true, icon: '⚔️', name: 'Zoro (King of Hell)', hp: 340, passiveRed: 0.25, strong: ['blood', 'venom', 'shadow'],
            moves: [
                { label: 'Enma Purgatory (52 DMG)', dmg: 52 },
                { label: 'Three-Sword Dragon (72 DMG)', dmg: 72 },
                { label: 'Conqueror Haki (Evade +45 HP)', evade: true, heal: 45 },
                { label: '👹 Dragon Damnation ULT (132 DMG)', dmg: 132, cut: { theme: 'zoro', emoji: '👹⚔️', title: 'KING OF HELL: DRAGON DAMNATION!' } }
            ]
        },
        antimpoke: {
            secret: true, icon: '⚡', name: 'Antim (Astral Sky Sovereign)', hp: 335, passiveRed: 0.24, strong: ['fire', 'water', 'storm'],
            moves: [
                { label: 'Dragon Ascent (50 DMG)', dmg: 50 },
                { label: 'Judgment Beam (70 True DMG)', dmg: 70, trueDmg: true },
                { label: 'Multitype Plate (Block 85%)', block: 0.85 },
                { label: '🐉 Sky Sovereign ULT (130 DMG)', dmg: 130, cut: { theme: 'lightning', emoji: '⚡🐉', title: 'ASTRAL SKY SOVEREIGN: ASCENT!' } }
            ]
        },
        mahadev: {
            secret: true, icon: '🔱', name: 'Mahadev (Tandava Destroyer)', hp: 360, passiveRed: 0.30, strong: ['shadow', 'blood', 'antimatter'],
            moves: [
                { label: 'Trishul Pierce (56 DMG)', dmg: 56 },
                { label: 'Damru Cosmic Beat (74 DMG + Stun)', dmg: 74, stunChance: 0.55 },
                { label: 'Kailash Meditation (+65 HP)', evade: true, heal: 65 },
                { label: '🔥 Third Eye Tandava ULT (140 True DMG)', dmg: 140, trueDmg: true, stun: true, cut: { theme: 'chakra', emoji: '🔱🔥', title: 'THIRD EYE: TANDAVA DESTRUCTION!' } }
            ]
        }
    });

    Object.values(svPlayerStats).forEach(st => {
        if (Array.isArray(st.customPowers)) {
            st.customPowers.forEach(cp => {
                if (cp && cp.id && cp.def) SV_DEFS[cp.id] = cp.def;
            });
        }
    });
         
        // ============================================================================
    // ⚔️ SAMMUVERSE V4 ENGINE — PIECE 4/20: ADVENTURE, TOWER, FIGHTERS & SYNC
    // ============================================================================
    const svBattles = new Map();
    const svPending = new Map();
    const activeDomainClashes = new Map();
    const activeTowerRuns = new Map();

    const ENCHANT_POOL = [
        { id: 'blazing',    name: '🔥 Blazing (+15% Burn DMG)',    mult: 1.15, red: 0,    heal: 0 },
        { id: 'vampiric',   name: '🧛 Vampiric (+15% Lifesteal)',  mult: 1.05, red: 0,    heal: 0.15 },
        { id: 'ironclad',   name: '🛡️ Ironclad (-15% DMG Taken)',  mult: 1.00, red: 0.15, heal: 0 },
        { id: 'thunderous', name: '⚡ Thunderous (+20% Shock DMG)', mult: 1.20, red: 0,    heal: 0 },
        { id: 'godly',      name: '✨ GODLY (+25% ALL STATS)',      mult: 1.25, red: 0.20, heal: 0.12 }
    ];

    const ADVENTURE_CHAPTERS = [
        { ch: 1, title: '🌲 Ch.1: Whispering Dojo',   stages: ['🥷 Rogue Disciple', '🐺 Shadow Wolf', '👹 Dojo Sensei Boss'],     pKey: 'rubber',     baseHp: 210, baseAtk: 6,  coins: 350,  xp: 200,  essence: 15 },
        { ch: 2, title: '🌋 Ch.2: Crimson Volcano',   stages: ['🦎 Magma Salamander', '🔥 Flame Knight', '🐉 Magma Wyrm Boss'],     pKey: 'fire',       baseHp: 340, baseAtk: 14, coins: 700,  xp: 450,  essence: 30 },
        { ch: 3, title: '🌊 Ch.3: Abyssal Trench',    stages: ['🦈 Depth Stalker', '🐙 Kraken Tentacle', '🌊 Leviathan Boss'],      pKey: 'water',      baseHp: 520, baseAtk: 22, coins: 1200, xp: 800,  essence: 50 },
        { ch: 4, title: '⚡ Ch.4: Celestial Citadel', stages: ['🦅 Sky Valkyrie', '⚡ Thunder Golem', '👑 Raijin Sovereign Boss'],  pKey: 'lightning',  baseHp: 780, baseAtk: 30, coins: 2200, xp: 1400, essence: 80 },
        { ch: 5, title: '🌌 Ch.5: Void Throne',       stages: ['🌑 Void Phantom', '🕳️ Singularity Knight', '🔱 Abyssal God Boss'],  pKey: 'antimatter', baseHp: 1150,baseAtk: 40, coins: 5000, xp: 3000, essence: 150 }
    ];

    const TOWER_BOSS_ROSTER = [
        { name: '🥷 Shadow Guardian',       pKey: 'shadow' },
        { name: '🔥 Inferno Warden',        pKey: 'fire' },
        { name: '⚡ Raijin Stormkeeper',    pKey: 'lightning' },
        { name: '❄️ Glacial Colossus',      pKey: 'ice' },
        { name: '🪐 Singularity Titan',     pKey: 'gravity' },
        { name: '⏳ Chronos Gatekeeper',    pKey: 'time' },
        { name: '⚛️ Antimatter Seraph',     pKey: 'antimatter' },
        { name: '👑 Abyssal Tower Monarch', pKey: 'mahavishnu' }
    ];

    function getTrainingBonuses(prof) {
        const tr = prof.training || { fistLv: 0, bodyLv: 0, chiLv: 0, xp: 0 };
        const fLv = Number(tr.fistLv) || 0;
        const bLv = Number(tr.bodyLv) || 0;
        const cLv = Number(tr.chiLv) || 0;
        return {
            bonusDmg: fLv >= 100000 ? Math.round(150 + Math.log10(fLv) * 45) : Math.min(350, fLv * 3),
            bonusHp: bLv >= 100000 ? Math.round(900 + Math.log10(bLv) * 250) : Math.min(2000, bLv * 20),
            ultMult: cLv >= 100000 ? 1.85 : Math.min(1.80, 1 + (cLv * 0.04)),
            critChance: cLv >= 100000 ? 0.50 : Math.min(0.45, cLv * 0.01)
        };
    }

    function getTowerFloorConfig(floor) {
        const template = TOWER_BOSS_ROSTER.at((floor - 1) % TOWER_BOSS_ROSTER.length);
        const isOvercharged = (floor % 5 === 0 && floor % 10 !== 0);
        const isCursed = (floor % 10 === 0);
        const hp = Math.round(180 + (floor * 34) + Math.pow(floor, 1.38) * 14);
        const atk = Math.round(6 + (floor * 1.4) + (isOvercharged ? 10 : 0));
        const red = Math.min(0.45, Number((floor * 0.004).toFixed(3)));
        const coinReward = Math.round((65 + floor * 18) * (isOvercharged ? 2 : 1));
        const modTag = isCursed ? '🩸 CURSED ARENA (50% Less Heal)' : (isOvercharged ? '⚡ OVERCHARGED (2x Coins)' : '⚔️ Standard Ascent');
        return { floor, name: `🗼 F${floor}: ${template.name}`, pKey: template.pKey, hp, atk, red, coinReward, isCursed, modTag };
    }

    function broadcastSvCutscene(battle, cutObj) {
        if (!battle || !cutObj) return;
        if (!battle.p1.isBot) io.to(battle.p1.id).emit('svCutscene', { ...cutObj, _serverId: battle.srvId });
        if (!battle.p2.isBot) io.to(battle.p2.id).emit('svCutscene', { ...cutObj, _serverId: battle.srvId });
    }

    function syncSvBattle(battle, sfx) {
        const sendView = (me, opp) => {
            if (me.isBot) return;
            const formBadge = me.titanTurns > 0 ? ' [🌌 TITAN]' : (me.omegaTurns > 0 ? ' [⚡ OMEGA]' : '');
            const verTag = (me.isV3 ? ' [V3 👑]' : (me.isV2 ? ' [V2]' : '')) + formBadge;
            const oppVerTag = (opp.isV3 ? ' [V3 👑]' : (opp.isV2 ? ' [V2]' : '')) + (opp.titanTurns > 0 ? ' [🌌 TITAN]' : (opp.omegaTurns > 0 ? ' [⚡ OMEGA]' : ''));
            io.to(me.id).emit('svBattleSync', {
                turn: battle.turn, timeLeft: battle.timeLeft, logText: battle.lastLog, sfx: sfx || null,
                me: {
                    name: me.name, icon: me.def.icon, powerName: me.def.name + verTag, powerKey: me.pKey,
                    hp: me.hp, maxHp: me.maxHp, ultCd: me.ultCd, awakened: me.awakened,
                    energy: me.energy || 0,
                    hasOmegaGear: Boolean(me.gears?.omegaCore), omegaUsed: Boolean(me.omegaUsed), omegaTurns: me.omegaTurns || 0,
                    hasTitanGear: Boolean(me.gears?.titanCrown), titanUsed: Boolean(me.titanUsed), titanTurns: me.titanTurns || 0,
                    locked: me.choice !== null, stunned: me.stunned, isBotOpp: opp.isBot,
                    skills: me.def.moves.map(m => m.label)
                },
                opp: {
                    name: opp.name, icon: opp.def.icon, powerName: opp.def.name + oppVerTag,
                    hp: opp.hp, maxHp: opp.maxHp, awakened: opp.awakened
                },
                _serverId: battle.srvId
            });
        };
        sendView(battle.p1, battle.p2);
        sendView(battle.p2, battle.p1);
    }

    function buildFighterObj(sockId, uname, powKey, customHp, customAtk, isBot = false, botId = null) {
        const def = SV_DEFS[powKey] || SV_DEFS.fire;
        if (isBot) {
            return {
                id: botId || 'BOT', name: uname, pKey: powKey, def, hp: customHp, maxHp: customHp, bonusAtk: customAtk,
                ultCd: 0, choice: Math.floor(Math.random() * 3), stunned: false, isBot: true,
                isV2: false, isV3: false, hasStone: false, awakened: false, energy: 0,
                gears: {}, omegaUsed: false, omegaTurns: 0, titanUsed: false, titanTurns: 0,
                pet: null, pet2: null, relic: null, enchant: null, lineageObj: SV_LINEAGES.human, lineageStage: 1,
                trainBonus: { ultMult: 1, critChance: 0 }, baseReward: 50
            };
        }
        const prof = getSvProfile(uname);
        const trB = getTrainingBonuses(prof);
        const isV2 = Boolean(prof.powerWins && prof.powerWins[powKey] >= 5);
        const isV3 = Boolean(prof.powerWins && prof.powerWins[powKey] >= 100);
        const maxHp = def.hp + ((prof.hpLv || 0) * 25) + trB.bonusHp + (isV3 ? 65 : 0);
        const bonusAtk = ((prof.atkLv || 0) * 5) + trB.bonusDmg + (isV3 ? 20 : 0);

        return {
            id: sockId, name: uname || 'Fighter', pKey: powKey, def, hp: maxHp, maxHp, bonusAtk,
            ultCd: 0, choice: null, stunned: false, isBot: false, isV2, isV3,
            hasStone: Boolean(prof.hasStone), awakened: false, energy: 50,
            gears: prof.gears || { omegaCore: false, titanCrown: false },
            omegaUsed: false, omegaTurns: 0, titanUsed: false, titanTurns: 0,
            pet: prof.activePet || null, pet2: prof.activePet2 || null,
            relic: prof.activeRelic || null, enchant: (prof.enchants && prof.enchants[powKey]) || null,
            lineageObj: SV_LINEAGES[prof.lineage || 'human'] || SV_LINEAGES.human, lineageStage: prof.lineageStage || 1,
            trainBonus: trB, baseReward: 150
        };
    }
        // ============================================================================
    // ⚔️ SAMMUVERSE V4 ENGINE — PIECE 5/20: COMBAT RESOLVER (OMEGA & TITAN FORMS)
    // ============================================================================
    function resolveSvTurn(battleId) {
        const b = svBattles.get(battleId);
        if (!b) return;

        // V3 Domain Clash when both V3 fighters unleash Ultimates simultaneously
        if (!b.p2.isBot && b.p1.isV3 && b.p2.isV3 && b.p1.choice === 3 && b.p2.choice === 3 && !b.clashResolved) {
            b.clashResolved = true;
            const clashData = { p1Taps: 0, p2Taps: 0, p1Id: b.p1.id, p2Id: b.p2.id };
            activeDomainClashes.set(battleId, clashData);
            io.to(b.p1.id).emit('svDomainClashStart', { oppName: b.p2.name, _serverId: b.srvId });
            io.to(b.p2.id).emit('svDomainClashStart', { oppName: b.p1.name, _serverId: b.srvId });

            setTimeout(() => {
                activeDomainClashes.delete(battleId);
                const cur = svBattles.get(battleId);
                if (!cur) return;
                const p1WonClash = clashData.p1Taps >= clashData.p2Taps;
                const winner = p1WonClash ? cur.p1 : cur.p2;
                const loser = p1WonClash ? cur.p2 : cur.p1;
                const clashDmg = 160 + winner.bonusAtk;
                loser.hp = Math.max(0, loser.hp - clashDmg);
                cur.p1.choice = 0; cur.p2.choice = 0; cur.clashResolved = false;

                io.to(cur.p1.id).emit('svDomainClashEnd', {});
                io.to(cur.p2.id).emit('svDomainClashEnd', {});
                io.to(cur.srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `⚡👑 **V3 DOMAIN CLASH!!** **${winner.name}** shattered **${loser.name}**'s domain (${Math.max(clashData.p1Taps, clashData.p2Taps)} Taps) for **-${clashDmg} COSMIC DMG**!`,
                    _serverId: cur.srvId
                });
                resolveSvTurn(battleId);
            }, 4000);
            return;
        }

        const pickAuto = (f) => {
            if (f.stunned) return null;
            if (f.choice !== null && f.choice >= 0) return f.choice;
            return f.ultCd === 0 && Math.random() < 0.35 ? 3 : Math.floor(Math.random() * 3);
        };

        const c1 = pickAuto(b.p1), c2 = pickAuto(b.p2);
        const m1 = c1 !== null ? b.p1.def.moves.at(c1) : null;
        const m2 = c2 !== null ? b.p2.def.moves.at(c2) : null;

        b.p1.stunned = false; b.p2.stunned = false;
        if (b.p1.ultCd > 0) b.p1.ultCd--;
        if (b.p2.ultCd > 0) b.p2.ultCd--;
        if (c1 === 3) b.p1.ultCd = 3;
        if (c2 === 3) b.p2.ultCd = 3;

        let turnSfx = 'atk', queuedCutscene = null;
        const logs = [];

        const applyClash = (atk, atkMove, isUlt, def, defMove) => {
            if (!atkMove) { logs.push(`❄️ <b>${atk.name}</b> was stunned and skipped!`); return; }
            if (atkMove.cut) queuedCutscene = { ...atkMove.cut, caption: `${atk.def.icon} ${atk.name.toUpperCase()} — ${atkMove.cut.title}` };
            if (atkMove.heal) {
                const healAmt = b.isCursed ? Math.round(atkMove.heal * 0.5) : atkMove.heal;
                atk.hp = Math.min(atk.maxHp, atk.hp + healAmt);
            }
            if (!atkMove.dmg) { turnSfx = 'shield'; logs.push(`${atk.def.icon} <b>${atk.name}</b> used <b>${atkMove.label.split(' (').at(0)}</b>!`); return; }

            let dmg = atkMove.dmg + atk.bonusAtk + Math.floor(Math.random() * 6);
            if (isUlt && atk.trainBonus?.ultMult) dmg = Math.round(dmg * atk.trainBonus.ultMult);
            if (atk.isV2) dmg = Math.round(dmg * 1.15);
            if (atk.isV3) dmg = Math.round(dmg * 1.20);
            if (atk.awakened) dmg = Math.round(dmg * 1.25);
            if (atk.omegaTurns > 0) dmg = Math.round(dmg * 1.40);
            if (atk.titanTurns > 0) dmg = Math.round(dmg * 1.55);
            if (atk.def.strong && atk.def.strong.includes(def.pKey)) dmg = Math.round(dmg * 1.22);

            const lin = atk.lineageObj;
            const stgMult = (atk.lineageStage || 1) >= 3 ? 1.0 : ((atk.lineageStage || 1) === 2 ? 0.65 : 0.4);
            if (lin && lin.dmgMult > 1) dmg = Math.round(dmg * (1 + (lin.dmgMult - 1) * stgMult));
            if (atk.enchant && atk.enchant.mult > 1) dmg = Math.round(dmg * atk.enchant.mult);

            const critRoll = (atk.relic === 'excalibur' ? 0.25 : 0) + (atk.trainBonus?.critChance || 0);
            let isCrit = false;
            if (critRoll > 0 && Math.random() < critRoll) { dmg = Math.round(dmg * 1.45); isCrit = true; }

            const bypassDodge = Boolean(atkMove.trueDmg || atk.titanTurns > 0);
            if (!bypassDodge && defMove && defMove.evade) {
                logs.push(`${atk.def.icon} <b>${atk.name}</b> used <b>${atkMove.label.split(' (').at(0)}</b>, but <b>${def.name}</b> EVADED! 💨`);
                return;
            }
            if (!bypassDodge && defMove && defMove.block) {
                const blocked = Math.round(dmg * defMove.block);
                dmg -= blocked;
                if (defMove.reflect) atk.hp = Math.max(0, atk.hp - Math.round(blocked * defMove.reflect));
            }

            if (def.omegaTurns > 0) dmg = Math.round(dmg * 0.70);
            if (def.titanTurns > 0) dmg = Math.round(dmg * 0.55);
            if (def.pet === 'sheshnag' || def.pet2 === 'sheshnag' || def.pet === 'ouroboros') dmg = Math.round(dmg * 0.82);
            if (def.relic === 'aegis') dmg = Math.round(dmg * 0.85);
            if (def.enchant && def.enchant.red > 0) dmg = Math.round(dmg * (1 - def.enchant.red));
            if (def.def.passiveRed) dmg = Math.round(dmg * (1 - def.def.passiveRed));

            def.hp = Math.max(0, def.hp - dmg);
            atk.energy = Math.min(100, (atk.energy || 0) + 25);

            const stealPct = (atk.relic === 'vampfang' ? 0.20 : 0) + (atk.enchant?.heal || 0) + (lin ? lin.steal * stgMult : 0);
            if (stealPct > 0 && atk.hp > 0) atk.hp = Math.min(atk.maxHp, atk.hp + Math.max(2, Math.round(dmg * stealPct)));
            if (def.lineageObj && def.lineageObj.absorb > 0 && def.hp > 0) {
                const dMult = (def.lineageStage || 1) >= 3 ? 1.0 : 0.5;
                def.hp = Math.min(def.maxHp, def.hp + Math.max(2, Math.round(dmg * def.lineageObj.absorb * dMult)));
            }

            if ((atkMove.stun || (atkMove.stunChance && Math.random() < atkMove.stunChance)) && def.hp > 0) {
                if (!(def.lineageObj && def.lineageObj.stunImmune) && !(def.titanTurns > 0)) def.stunned = true;
            }
            if (atkMove.trueDmg || atk.titanTurns > 0) turnSfx = 'ult';
            const formTag = atk.titanTurns > 0 ? ' 🌌[TITAN]' : (atk.omegaTurns > 0 ? ' ⚡[OMEGA]' : '');
            logs.push(`${atk.def.icon} <b>${atk.name}</b>${formTag} hit <b>${atkMove.label.split(' (').at(0)}</b>${isCrit ? ' 💥CRIT' : ''} for <b>-${dmg} HP</b>!`);
        };

        applyClash(b.p1, m1, c1 === 3, b.p2, m2);
        applyClash(b.p2, m2, c2 === 3, b.p1, m1);

        [[b.p1, b.p2], [b.p2, b.p1]].forEach(([me, opp]) => {
            if (me.hp <= 0) return;
            if (me.omegaTurns > 0) me.omegaTurns--;
            if (me.titanTurns > 0) me.titanTurns--;

            [me.pet, me.pet2].filter(Boolean).forEach((pt, idx) => {
                if (idx === 1 && pt === me.pet) return;
                if (pt === 'mochi' && opp.hp > 0) { opp.hp = Math.max(0, opp.hp - 10); logs.push(`🐱 Mochi scratched ${opp.name} (-10)!`); }
                if (pt === 'tommy') { me.hp = Math.min(me.maxHp, me.hp + 10); }
                if (pt === 'garuda' && opp.hp > 0) { opp.hp = Math.max(0, opp.hp - 22); logs.push(`🦅 Garuda struck ${opp.name} (-22)!`); }
                if (pt === 'sheshnag' && opp.hp > 0) { opp.hp = Math.max(0, opp.hp - 18); logs.push(`🐍 Sheshnag poisoned ${opp.name} (-18)!`); }
                if (pt === 'chimera' && opp.hp > 0) {
                    opp.hp = Math.max(0, opp.hp - 24);
                    me.hp = Math.min(me.maxHp, me.hp + 20);
                    logs.push(`🦁 Chimera Guardian slashed ${opp.name} (-24) & healed ${me.name} (+20 HP)!`);
                }
                if (pt === 'ouroboros' && opp.hp > 0) {
                    opp.hp = Math.max(0, opp.hp - 42);
                    me.hp = Math.min(me.maxHp, me.hp + 25);
                    logs.push(`🐉 Cosmic Ouroboros blasted ${opp.name} (-42) & healed ${me.name} (+25 HP)!`);
                }
            });

            if (me.lineageObj && me.lineageObj.hpTurn > 0) {
                const rMult = (me.lineageStage || 1) >= 3 ? 1.0 : 0.5;
                me.hp = Math.min(me.maxHp, me.hp + Math.max(3, Math.round(me.lineageObj.hpTurn * rMult)));
            }
            if (me.hasStone && !me.awakened && me.hp > 0 && me.hp <= Math.round(me.maxHp * 0.40)) {
                me.awakened = true;
                me.hp = Math.min(me.maxHp, me.hp + 40);
                turnSfx = 'awaken';
                queuedCutscene = { theme: 'awaken', emoji: '💎⚡', title: `${me.name} AWAKENED!!`, caption: `💎⚡ ${me.name.toUpperCase()} SHATTERED THEIR LIMITS! (+25% ATK & +40 HP)`, sfx: 'awaken' };
                logs.push(`⚡💎 <b>${me.name} AWAKENED THEIR STONE! (+25% ATK & +40 HP)</b>`);
            }
        });

        if (queuedCutscene) broadcastSvCutscene(b, queuedCutscene);
        b.lastLog = logs.join('<br>');

        if (b.p1.hp <= 0 || b.p2.hp <= 0) {
            return finishSvBattle(battleId, b);
        }

        b.turn++; b.timeLeft = 15;
        b.p1.choice = b.p1.stunned ? -1 : null;
        b.p2.choice = b.p2.isBot ? (b.p2.ultCd === 0 ? 3 : Math.floor(Math.random() * 3)) : (b.p2.stunned ? -1 : null);
        syncSvBattle(b, turnSfx);
    }
     // ============================================================================
    // ⚔️ SAMMUVERSE V4 ENGINE — PIECE 6/20: FINISHER, TOWER GEARS & ADVENTURE
    // ============================================================================
    function finishSvBattle(battleId, b) {
        clearInterval(b.interval);
        svBattles.delete(battleId);
        const p1Won = b.p1.hp > b.p2.hp;
        const winner = p1Won ? b.p1 : b.p2;
        const loser = p1Won ? b.p2 : b.p1;

        if (!b.p1.isBot) io.to(b.p1.id).emit('svBattleEnd', { won: p1Won, _serverId: b.srvId });
        if (!b.p2.isBot) io.to(b.p2.id).emit('svBattleEnd', { won: !p1Won, _serverId: b.srvId });

        // 1. ENDLESS TOWER PROGRESSION & FLOOR 50 GEAR UNLOCKS
        if (b.isTower) {
            const pSock = io.sockets.sockets.get(b.p1.id);
            if (!p1Won || !pSock) {
                activeTowerRuns.delete(b.p1.id);
                io.to(b.srvId).emit('message', { username: "Sammu's Bot", text: `💀🗼 **TOWER RUN ENDED!** **${b.p1.name}** fell on **Floor ${b.towerFloor}**!`, _serverId: b.srvId });
                return;
            }
            const prof = getSvProfile(b.p1.name);
            const nextFl = b.towerFloor + 1;
            if (nextFl > (prof.maxTowerFloor || 1)) {
                prof.maxTowerFloor = nextFl;
                prof.towerCheckpoint = Math.max(1, Math.floor(nextFl / 5) * 5);
            }
            addCoins(b.p1.name, b.p1.baseReward);
            prof.petEssence = (prof.petEssence || 0) + 5;

            if (b.towerFloor === 25) addCoins(b.p1.name, 10000);
            if (b.towerFloor === 50) {
                prof.freeFusionPasses = (prof.freeFusionPasses || 0) + 1;
                prof.gears.omegaCore = true;
                io.to(b.srvId).emit('message', { username: "Sammu's Bot", text: `⚡👑 **FLOOR 50 CONQUERED!** **${b.p1.name}** unlocked the **⚡ OMEGA CORE GEAR** + **Free Fusion Pass**!`, _serverId: b.srvId });
            }
            if (b.towerFloor === 75) {
                prof.gears.titanCrown = true;
                io.to(b.srvId).emit('message', { username: "Sammu's Bot", text: `🌌👑 **FLOOR 75 CONQUERED!** **${b.p1.name}** unlocked the **🌌 TITAN CROWN GEAR**!`, _serverId: b.srvId });
            }
            if (b.towerFloor === 100) addCoins(b.p1.name, 50000);

            syncPlayerTitlesAndBounty(b.p1.name);
            saveSvStats();
            pSock.emit('svStatsSync', getSvProfile(b.p1.name));
            io.to(b.p1.id).emit('message', { username: "Sammu's Bot", text: `🗼🔥 **FLOOR ${b.towerFloor} CLEARED!** (+${b.p1.baseReward.toLocaleString()}🪙 & +5🔮 Essence) Ascending to **Floor ${nextFl}** in 3s...`, _serverId: b.srvId });
            setTimeout(() => { if (io.sockets.sockets.has(b.p1.id)) launchEndlessTowerFloor(pSock, nextFl, b.p1.hp); }, 3000);
            return;
        }

        // 2. ADVENTURE STORY MODE PROGRESSION
        if (b.isAdventure) {
            const pSock = io.sockets.sockets.get(b.p1.id);
            if (!p1Won || !pSock) {
                io.to(b.srvId).emit('message', { username: "Sammu's Bot", text: `💀🗺️ **ADVENTURE DEFEAT!** **${b.p1.name}** was defeated in **${b.advTitle}**! Train harder & retry!`, _serverId: b.srvId });
                return;
            }
            const prof = getSvProfile(b.p1.name);
            const adv = prof.adventure || { chapter: 1, stage: 1, cleared: false };
            const chObj = ADVENTURE_CHAPTERS.find(c => c.ch === b.advChapter) || ADVENTURE_CHAPTERS.at(0);
            const isBossStage = b.advStage >= 3;
            const cGain = isBossStage ? chObj.coins : Math.round(chObj.coins * 0.4);
            const xpGain = isBossStage ? chObj.xp : Math.round(chObj.xp * 0.4);
            const essGain = isBossStage ? chObj.essence : Math.round(chObj.essence * 0.4);

            addCoins(b.p1.name, cGain);
            prof.training.xp = (prof.training.xp || 0) + xpGain;
            prof.petEssence = (prof.petEssence || 0) + essGain;

            if (adv.chapter === b.advChapter && adv.stage === b.advStage) {
                if (adv.stage < 3) {
                    adv.stage++;
                } else if (adv.chapter < 5) {
                    adv.chapter++;
                    adv.stage = 1;
                } else {
                    adv.cleared = true;
                }
            }
            syncPlayerTitlesAndBounty(b.p1.name);
            saveSvStats();
            pSock.emit('svStatsSync', getSvProfile(b.p1.name));
            io.to(b.srvId).emit('message', {
                username: "Sammu's Bot",
                text: `🗺️🏆 **STAGE CLEARED!** **${b.p1.name}** conquered **${b.p2.name}** in **${chObj.title}** and looted **+${cGain.toLocaleString()}🪙**, **+${xpGain}⚡ XP**, & **+${essGain}🔮 Pet Essence**!`,
                _serverId: b.srvId
            });
            return;
        }

        // 3. STANDARD ARENA / PVP REWARDS
        let reward = loser.baseReward || 150;
        if (!winner.isBot) {
            const wProf = getSvProfile(winner.name);
            wProf.wins = (wProf.wins || 0) + 1;
            wProf.streak = (wProf.streak || 0) + 1;
            wProf.petEssence = (wProf.petEssence || 0) + (loser.isBot ? 4 : 12);
            if (!wProf.powerWins) wProf.powerWins = {};
            wProf.powerWins[winner.pKey] = (wProf.powerWins[winner.pKey] || 0) + 1;
            if (wProf.powerWins[winner.pKey] === 5) {
                io.to(b.srvId).emit('message', { username: "Sammu's Bot", text: `🔥⚡ **V2 EVOLUTION!** **${winner.name}** mastered **${winner.def.name}** (5 Wins) -> **[V2 +15% DMG]**!`, _serverId: b.srvId });
            }
            if (wProf.powerWins[winner.pKey] === 100) {
                io.to(b.srvId).emit('message', { username: "Sammu's Bot", text: `👑🔥 **V3 ASCENSION!** **${winner.name}** hit **100 WINS** on **${winner.def.name}** -> **[V3 👑]**!`, _serverId: b.srvId });
            }
            wProf.bounty = Math.min(30000000, (wProf.bounty || 10000) + (loser.isBot ? 25000 : 120000));
            reward = Math.round(reward * (wProf.streak >= 5 ? 2 : (wProf.streak >= 3 ? 1.5 : 1)));
            addCoins(winner.name, reward);
            syncPlayerTitlesAndBounty(winner.name);
            saveSvStats();
        }
        if (!loser.isBot) { getSvProfile(loser.name).streak = 0; saveSvStats(); }

        recordSvLog(b.srvId, winner.name, `${winner.def.icon} ${winner.def.name}`, loser.name, `${loser.def.icon} ${loser.def.name}`);
        io.to(b.srvId).emit('message', { username: "Sammu's Bot", text: `⚔️🔥 **SAMMUVERSE:** **${winner.name}** (${winner.def.icon} ${winner.def.name}) defeated **${loser.name}** and won **+${reward}🪙**! 🏆`, _serverId: b.srvId });
    }
       // ============================================================================
    // ⚔️ SAMMUVERSE V4 ENGINE — PIECE 7/20: PVP, TOWER & ADVENTURE LAUNCHERS
    // ============================================================================
    function startSvMatch(srvId, sock1, pow1Key, sock2, pow2Key) {
        const p1 = buildFighterObj(sock1.id, sock1.username, pow1Key);
        let p2 = null;
        if (typeof sock2 === 'string') {
            const bots = {
                BOT_DUMMY:  { name: '🥊 Wooden Dummy',   hp: 150, atk: 0,  reward: 35,  pKey: 'rubber' },
                BOT_SENSEI: { name: '🤖 Bot Sensei',     hp: 230, atk: 8,  reward: 65,  pKey: 'lightning' },
                BOT_DEMON:  { name: '👹 Demon Overlord', hp: 380, atk: 16, reward: 140, pKey: 'blood' }
            };
            const cfg = bots[sock2] || bots.BOT_SENSEI;
            p2 = buildFighterObj(sock2, cfg.name, cfg.pKey, cfg.hp, cfg.atk, true, sock2);
            p2.baseReward = cfg.reward;
        } else {
            p2 = buildFighterObj(sock2.id, sock2.username, pow2Key);
        }

        const battleId = 'sv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const battle = { id: battleId, srvId, turn: 1, timeLeft: 15, lastLog: `⚔️ Battle started! Pick your skill!`, p1, p2, interval: null };
        svBattles.set(battleId, battle);
        battle.interval = setInterval(() => {
            const cur = svBattles.get(battleId);
            if (!cur) return;
            cur.timeLeft--;
            if (cur.timeLeft <= 0) resolveSvTurn(battleId);
            else syncSvBattle(cur, null);
        }, 1000);
        syncSvBattle(battle, 'atk');
    }

    function launchEndlessTowerFloor(socket, floorNum, carryHp) {
        const srvId = socket.activeServerId;
        const uname = socket.username || 'Climber';
        const prof = getSvProfile(uname);
        const cfg = getTowerFloorConfig(floorNum);
        const pKey = (prof.customPowers?.at(-1)?.id) || (prof.unlockedPowers?.at(-1)) || 'fire';

        const p1 = buildFighterObj(socket.id, uname, pKey);
        p1.hp = carryHp ? Math.min(p1.maxHp, carryHp + (cfg.isCursed ? 25 : 55)) : p1.maxHp;
        p1.baseReward = cfg.coinReward;

        const p2 = buildFighterObj('TOWER_BOSS', cfg.name, cfg.pKey, cfg.hp, cfg.atk, true, 'TOWER_BOSS');
        p2.def = { ...p2.def, passiveRed: cfg.red };
        p2.isV2 = floorNum >= 15; p2.isV3 = floorNum >= 40;

        const battleId = 'twr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const battle = {
            id: battleId, srvId, isTower: true, towerFloor: floorNum, isCursed: cfg.isCursed,
            turn: 1, timeLeft: 15, lastLog: `🗼 <b>FLOOR ${floorNum}</b> — ${cfg.modTag} (${cfg.hp.toLocaleString()} HP)`,
            p1, p2, interval: null
        };
        activeTowerRuns.set(socket.id, { floorNum, battleId });
        svBattles.set(battleId, battle);
        battle.interval = setInterval(() => {
            const cur = svBattles.get(battleId);
            if (!cur) return;
            cur.timeLeft--;
            if (cur.timeLeft <= 0) resolveSvTurn(battleId);
            else syncSvBattle(cur, null);
        }, 1000);
        syncSvBattle(battle, 'ult');
    }

    function launchAdventureStage(socket, chNum, stgNum, powKey) {
        const srvId = socket.activeServerId;
        const uname = socket.username || 'Hero';
        const chObj = ADVENTURE_CHAPTERS.find(c => c.ch === chNum) || ADVENTURE_CHAPTERS.at(0);
        const stageIdx = Math.max(0, Math.min(2, (stgNum || 1) - 1));
        const enemyName = chObj.stages.at(stageIdx);
        const mult = stageIdx === 2 ? 1.45 : (stageIdx === 1 ? 1.18 : 1.0);
        const hp = Math.round(chObj.baseHp * mult);
        const atk = Math.round(chObj.baseAtk * mult);

        const p1 = buildFighterObj(socket.id, uname, powKey || 'fire');
        const p2 = buildFighterObj('ADV_FOE', enemyName, chObj.pKey, hp, atk, true, 'ADV_FOE');
        p2.isV2 = chNum >= 3; p2.isV3 = chNum >= 5 && stageIdx === 2;

        const battleId = 'adv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const battle = {
            id: battleId, srvId, isAdventure: true, advChapter: chNum, advStage: stgNum, advTitle: chObj.title,
            turn: 1, timeLeft: 15, lastLog: `🗺️ <b>${chObj.title} (Stage ${stgNum}/3)</b> — <b>${enemyName}</b> blocks your path!`,
            p1, p2, interval: null
        };
        svBattles.set(battleId, battle);
        battle.interval = setInterval(() => {
            const cur = svBattles.get(battleId);
            if (!cur) return;
            cur.timeLeft--;
            if (cur.timeLeft <= 0) resolveSvTurn(battleId);
            else syncSvBattle(cur, null);
        }, 1000);
        syncSvBattle(battle, 'atk');
    }

    function findPlayerActiveSvBattle(socketId) {
        for (const [bId, b] of svBattles.entries()) {
            if (b.p1.id === socketId || b.p2.id === socketId) return { bId, b };
        }
        return null;
    }
       // ============================================================================
    // 🛡️ SAMMUVERSE V4 ENGINE — PIECE 8/20: STOCK, SECURITY & CHAT BADGES
    // ============================================================================
    let hourlyStock = { expiresAt: 0, items: [] };

    function getHourlyStock() {
        if (Date.now() > hourlyStock.expiresAt || hourlyStock.items.length === 0) {
            const pool = Object.entries(SV_DEFS)
                .filter(([, d]) => d.cost || d.fused)
                .map(([k, d]) => ({ key: k, icon: d.icon, name: d.name, price: d.cost || 2500 }));
            hourlyStock = { expiresAt: Date.now() + (60 * 60 * 1000), items: pool.sort(() => Math.random() - 0.5).slice(0, 3) };
        }
        return hourlyStock;
    }

    function verifyPlayerAccountOwnership(uname, socket, forceRelink = false) {
        if (!uname || !socket) return false;
        const devId = socket.trackedDeviceId || null;
        const prof = getSvProfile(uname);
        if (!devId) return true;
        if (!prof.ownerDevId || forceRelink) {
            prof.ownerDevId = devId;
            saveSvStats();
            return true;
        }
        return prof.ownerDevId === devId;
    }

    function ensureTrainingProfile(prof) {
        if (!prof.training) prof.training = { fistLv: 0, bodyLv: 0, chiLv: 0, xp: 0 };
        const totalLv = (prof.training.fistLv || 0) + (prof.training.bodyLv || 0) + (prof.training.chiLv || 0);
        if (totalLv >= 50 && !prof.unlockedTitles.includes('gymgod')) prof.unlockedTitles.push('gymgod');
        return prof.training;
    }

    const _prevIoToV4 = io.to.bind(io);
    io.to = function(room) {
        const broadcaster = _prevIoToV4(room);
        const origEmit = broadcaster.emit.bind(broadcaster);
        broadcaster.emit = function(ev, payload, ...rest) {
            if (ev === 'message' && payload && typeof payload === 'object' && payload.username) {
                const rawName = String(payload.username).replace(/^\[.*?\]\s*/, '');
                const k = rawName.toLowerCase().trim();
                if (svPlayerStats[k]) {
                    ensureTrainingProfile(svPlayerStats[k]);
                    syncPlayerTitlesAndBounty(rawName);
                    const tObj = SV_TITLES.find(t => t.id === svPlayerStats[k].activeTitle) || SV_TITLES.at(0);
                    if (tObj && !String(payload.username).startsWith('[')) {
                        payload = { ...payload, username: `[${tObj.tag}] ${rawName}`, _titleColor: tObj.color };
                    }
                }
            }
            return origEmit(ev, payload, ...rest);
        };
        return broadcaster;
    };
     // ============================================================================
    // 🎡 SAMMUVERSE V4 ENGINE — PIECE 9/20: DAILY WHEEL, PET MERGER & GEAR FORGE
    // ============================================================================
    io.on('connection', (socket) => {
        // 1. Daily Lucky Wheel Spin (Free every 24h OR Paid Spin for 500 Coins)
        socket.on('svDailyWheelSpin', ({ paid }) => {
            const uname = socket.username || 'Player';
            if (!verifyPlayerAccountOwnership(uname, socket, false)) return;
            const prof = getSvProfile(uname);
            const now = Date.now();
            const dayMs = 24 * 60 * 60 * 1000;

            if (!paid) {
                if (now - (prof.lastDailySpin || 0) < dayMs) {
                    const hrs = Math.ceil((dayMs - (now - prof.lastDailySpin)) / 3600000);
                    return socket.emit('svNotice', `⏳ Free Spin recharges in ${hrs}h! Or spin anytime for 500🪙!`);
                }
                prof.lastDailySpin = now;
            } else {
                if (getCoins(uname) < 500) return socket.emit('svNotice', '🪙 Need 500 Coins for a Cosmic Wheel Spin!');
                addCoins(uname, -500);
            }

            const r = Math.random();
            let prize = { idx: 0, label: '🪙 +600 Coins!', type: 'coins', val: 600 };
            if (r < 0.02) {
                prize = { idx: 5, label: '🌈 JACKPOT! +15,000 Coins & Free Fusion Pass!', type: 'jackpot' };
                addCoins(uname, 15000);
                prof.freeFusionPasses = (prof.freeFusionPasses || 0) + 1;
            } else if (r < 0.16) {
                prize = { idx: 4, label: '🔮 +40 Pet Essence!', type: 'essence', val: 40 };
                prof.petEssence = (prof.petEssence || 0) + 40;
            } else if (r < 0.36) {
                prize = { idx: 3, label: '⚡ +600 Training XP!', type: 'xp', val: 600 };
                prof.training.xp = (prof.training.xp || 0) + 600;
            } else if (r < 0.62) {
                prize = { idx: 2, label: '💰 +2,000 Coins!', type: 'coins', val: 2000 };
                addCoins(uname, 2000);
            } else if (r < 0.82) {
                prize = { idx: 1, label: '🔮 +20 Pet Essence & +400🪙!', type: 'combo' };
                prof.petEssence = (prof.petEssence || 0) + 20;
                addCoins(uname, 400);
            } else {
                addCoins(uname, 600);
            }

            syncPlayerTitlesAndBounty(uname);
            saveSvStats();
            socket.emit('svWheelResult', { prize, profile: getSvProfile(uname) });
        });

        // 2. Pet Merger & Evolution Lab (Fuse Pets + Essence + Coins -> Evolved Mega Pets)
        socket.on('svMergePet', (evoId) => {
            const uname = socket.username || 'Player';
            if (!verifyPlayerAccountOwnership(uname, socket, false)) return;
            const prof = getSvProfile(uname);

            if (evoId === 'chimera') {
                if (prof.ownedPets.includes('chimera')) return socket.emit('svNotice', '✅ You already evolved 🦁 Chimera Guardian!');
                if (!prof.ownedPets.includes('mochi') || !prof.ownedPets.includes('tommy')) {
                    return socket.emit('svNotice', '⚠️ Own BOTH 🐱 Mochi & 🐶 Tommy first to merge them!');
                }
                if ((prof.petEssence || 0) < 30 || getCoins(uname) < 1000) {
                    return socket.emit('svNotice', '🔮 Need 30 Pet Essence + 1,000🪙 to merge Chimera Guardian!');
                }
                prof.petEssence -= 30;
                addCoins(uname, -1000);
                prof.ownedPets.push('chimera');
                prof.activePet = 'chimera';
                syncPlayerTitlesAndBounty(uname);
                saveSvStats();
                socket.emit('svStatsSync', getSvProfile(uname));
                socket.emit('svNotice', '🦁⚡ PET EVOLUTION COMPLETE! Mochi + Tommy merged into 🦁 CHIMERA GUARDIAN (+24 DMG & +20 HP/turn)!');
            } else if (evoId === 'ouroboros') {
                if (prof.ownedPets.includes('ouroboros')) return socket.emit('svNotice', '✅ You already evolved 🐉 Cosmic Ouroboros!');
                if (!prof.ownedPets.includes('garuda') || !prof.ownedPets.includes('sheshnag')) {
                    return socket.emit('svNotice', '⚠️ Own BOTH 🦅 Garuda & 🐍 Sheshnag first to merge them!');
                }
                if ((prof.petEssence || 0) < 80 || getCoins(uname) < 4000) {
                    return socket.emit('svNotice', '🔮 Need 80 Pet Essence + 4,000🪙 to merge Cosmic Ouroboros!');
                }
                prof.petEssence -= 80;
                addCoins(uname, -4000);
                prof.ownedPets.push('ouroboros');
                prof.activePet = 'ouroboros';
                syncPlayerTitlesAndBounty(uname);
                saveSvStats();
                socket.emit('svStatsSync', getSvProfile(uname));
                socket.emit('svNotice', '🐉🌌 MYTHIC PET EVOLUTION! Garuda + Sheshnag merged into 🐉 COSMIC OUROBOROS (-18% DMG Taken, +42 DMG & +25 HP/turn)!');
            }
        });

        // 3. Gear Forge (Requires Tower Floor 50 Milestone + Coins!)
        socket.on('svCraftGear', (gearKey) => {
            const uname = socket.username || 'Player';
            if (!verifyPlayerAccountOwnership(uname, socket, false)) return;
            const prof = getSvProfile(uname);
            const bestFloor = prof.maxTowerFloor || 1;

            if (gearKey === 'omegaCore') {
                if (prof.gears.omegaCore) return socket.emit('svNotice', '✅ Omega Core Gear already forged!');
                if (bestFloor < 50) return socket.emit('svNotice', `🔒 Reach Endless Tower Floor 50 first! (Your Best: Floor ${bestFloor})`);
                if (getCoins(uname) < 10000) return socket.emit('svNotice', '🪙 Need 10,000 Coins to forge ⚡ Omega Core Gear!');
                addCoins(uname, -10000);
                prof.gears.omegaCore = true;
                syncPlayerTitlesAndBounty(uname);
                saveSvStats();
                socket.emit('svStatsSync', getSvProfile(uname));
                socket.emit('svNotice', '⚡👑 FORGED OMEGA CORE GEAR! You can now trigger ⚡ OMEGA EVOLUTION mid-battle!');
            } else if (gearKey === 'titanCrown') {
                if (prof.gears.titanCrown) return socket.emit('svNotice', '✅ Titan Crown Gear already forged!');
                if (bestFloor < 50) return socket.emit('svNotice', `🔒 Reach Endless Tower Floor 50 first! (Your Best: Floor ${bestFloor})`);
                if (getCoins(uname) < 25000) return socket.emit('svNotice', '🪙 Need 25,000 Coins to forge 🌌 Titan Crown Gear!');
                addCoins(uname, -25000);
                prof.gears.titanCrown = true;
                syncPlayerTitlesAndBounty(uname);
                saveSvStats();
                socket.emit('svStatsSync', getSvProfile(uname));
                socket.emit('svNotice', '🌌👑 FORGED TITAN CROWN GEAR! You can now unleash 🌌 COLOSSAL TITAN FORM mid-battle!');
            }
        });
    });
    // ============================================================================
    // ⚡ SAMMUVERSE V4 ENGINE — PIECE 10/20: OMEGA/TITAN TRANSFORM & SECRET CODES
    // ============================================================================
    io.on('connection', (socket) => {
        // Mid-Battle Transformation Handler (Omega Evolution OR Colossal Titan Form)
        socket.on('svTransform', (formType) => {
            const found = findPlayerActiveSvBattle(socket.id);
            if (!found) return;
            const { b } = found;
            const me = b.p1.id === socket.id ? b.p1 : b.p2;

            if (formType === 'omega') {
                if (!me.gears?.omegaCore) return socket.emit('svNotice', '🔒 Forge the ⚡ Omega Core Gear first (Tower Floor 50 + 10,000🪙)!');
                if (me.omegaUsed) return socket.emit('svNotice', '⚠️ Already used Omega Evolution in this battle!');
                if ((me.energy || 0) < 50) return socket.emit('svNotice', `⚡ Need 50% Battle Energy (Current: ${me.energy || 0}%)!`);

                me.omegaUsed = true;
                me.energy -= 50;
                me.omegaTurns = 3;
                me.hp = Math.min(me.maxHp, me.hp + 70);
                broadcastSvCutscene(b, {
                    theme: 'awaken',
                    emoji: '⚡🧬',
                    title: 'OMEGA EVOLUTION!',
                    caption: `⚡🧬 ${me.name.toUpperCase()} ASCENDED TO OMEGA FORM! (+40% ATK, +30% ARMOR & +70 HP for 3 Turns!)`,
                    sfx: 'awaken'
                });
                b.lastLog = `⚡🧬 <b>${me.name}</b> triggered <b>OMEGA EVOLUTION</b>! (+40% ATK, +30% Armor, +70 HP)<br>` + b.lastLog;
                syncSvBattle(b, 'awaken');
            } else if (formType === 'titan') {
                if (!me.gears?.titanCrown) return socket.emit('svNotice', '🔒 Forge the 🌌 Titan Crown Gear first (Tower Floor 50 + 25,000🪙)!');
                if (me.titanUsed) return socket.emit('svNotice', '⚠️ Already used Colossal Titan Form in this battle!');
                if ((me.energy || 0) < 75) return socket.emit('svNotice', `⚡ Need 75% Battle Energy (Current: ${me.energy || 0}%)!`);

                me.titanUsed = true;
                me.energy -= 75;
                me.titanTurns = 2;
                me.maxHp += 150;
                me.hp += 150;
                broadcastSvCutscene(b, {
                    theme: 'vishwaroopa',
                    emoji: '🌌👑',
                    title: 'COLOSSAL TITAN FORM!',
                    caption: `🌌👑 ${me.name.toUpperCase()} GREW INTO A COLOSSAL TITAN! (+150 HP, +55% DMG, UNSTOPPABLE!)`,
                    sfx: 'ult'
                });
                b.lastLog = `🌌👑 <b>${me.name}</b> unleashed <b>COLOSSAL TITAN FORM</b>! (+150 HP, +55% DMG, Evade-Break)<br>` + b.lastLog;
                syncSvBattle(b, 'ult');
            }
        });

        // Secret & Gift Codes (Brand-New Supreme Code #sammuomega999 + Fresh Gift Codes!)
        socket.on('svUnlockCode', (rawCode) => {
            const uname = socket.username || 'Player';
            const prof = getSvProfile(uname);
            const tr = ensureTrainingProfile(prof);
            const code = String(rawCode || '').trim().toLowerCase();

            // 👑 YOUR NEW SUPREME DEV CODE: #sammuomega999
            if (code === '#sammuomega999') {
                prof.unlockedPowers = Object.keys(SV_DEFS);
                prof.ownedPets = new Array('mochi', 'tommy', 'garuda', 'sheshnag', 'chimera', 'ouroboros');
                prof.activePet = 'ouroboros';
                prof.activePet2 = 'chimera';
                prof.ownedRelics = new Array('excalibur', 'aegis', 'vampfang');
                prof.activeRelic = 'excalibur';
                prof.gears = { omegaCore: true, titanCrown: true };
                prof.adventure = { chapter: 5, stage: 3, cleared: true };
                prof.petEssence = (prof.petEssence || 0) + 500;
                prof.hasStone = true;
                prof.atkLv = 15;
                prof.hpLv = 15;
                prof.powerMakerUnlocked = true;
                tr.fistLv = Math.max(333334, tr.fistLv || 0);
                tr.bodyLv = Math.max(333333, tr.bodyLv || 0);
                tr.chiLv  = Math.max(333333, tr.chiLv || 0);
                tr.xp     = Math.max(1000000, tr.xp || 0);

                if (!prof.powerWins) prof.powerWins = {};
                Object.keys(SV_DEFS).forEach(k => { prof.powerWins[k] = Math.max(100, prof.powerWins[k] || 0); });
                prof.unlockedTitles = SV_TITLES.map(t => t.id);
                prof.activeTitle = 'sovereign';
                prof.bounty = 30000000;
                prof.lineage = 'celestial';
                prof.lineageStage = 3;
                prof.maxTowerFloor = Math.max(100, prof.maxTowerFloor || 1);
                prof.towerCheckpoint = 100;
                addCoins(uname, 999999);
                saveSvStats();
                socket.emit('svStatsSync', getSvProfile(uname));
                socket.emit('svNotice', '👑🔱 SUPREME OMEGA UNLOCKED! All V3 Powers, Omega & Titan Gears, Evolved Pets, 1M Mastery & +999,999🪙!');
                return;
            }

            if (code === '#train1m') {
                tr.fistLv = 333334; tr.bodyLv = 333333; tr.chiLv = 333333; tr.xp = 1000000;
                ensureTrainingProfile(prof); syncPlayerTitlesAndBounty(uname); saveSvStats();
                socket.emit('svStatsSync', getSvProfile(uname));
                socket.emit('svNotice', '👽🔥 1,000,000 (1M) TRAINING MASTERY UNLOCKED!');
                return;
            }

            const secretMap = {
                '#mahavishnu': { key: 'mahavishnu', label: '🔱 Sammu/Samaksh (MahaVishnu)' },
                '#millyyt':    { key: 'millyyt',    label: '🎬 Milly (YouTube Queen)' },
                '#ishikastar': { key: 'ishikastar', label: '✨ Ishika (Celestial Empress)' },
                '#zoroking':   { key: 'zoroking',   label: '⚔️ Zoro (King of Hell)' },
                '#antimpoke':  { key: 'antimpoke',  label: '⚡ Antim (Astral Sky Sovereign)' },
                '#mahadev':    { key: 'mahadev',    label: '🔱 Mahadev (Tandava Destroyer)' }
            };
            if (secretMap[code]) {
                const s = secretMap[code];
                if (!prof.unlockedPowers.includes(s.key)) prof.unlockedPowers.push(s.key);
                syncPlayerTitlesAndBounty(uname); saveSvStats();
                socket.emit('svStatsSync', getSvProfile(uname));
                socket.emit('svNotice', `🌟 MYTHIC POWER UNLOCKED: ${s.label}!`);
                return;
            }

            // Fresh Public Gift Codes for Players!
            const giftCodes = {
                '#titan2026':    { coins: 3000, xp: 300, ess: 25, msg: '🌌 **TITAN 2026 PACK!** +3,000🪙, +300⚡ XP & +25🔮 Pet Essence!' },
                '#luckywheel':   { coins: 1500, xp: 150, ess: 15, msg: '🎡 **LUCKY WHEEL BONUS!** +1,500🪙 & +15🔮 Pet Essence!' },
                '#petfusion':    { coins: 2000, xp: 200, ess: 40, msg: '🐾 **PET MERGER GIFT!** +2,000🪙 & +40🔮 Pet Essence!' },
                '#adventure5k':  { coins: 5000, xp: 500, ess: 30, msg: '🗺️ **ADVENTURE HERO GIFT!** +5,000🪙 & +500⚡ XP!' },
                '#didi4000':     { coins: 4000, xp: 0,   ess: 0,  msg: '🌙💖 **DIDI ROYAL GIFT!** +4,000🪙 added!' },
                '#moondidi':     { coins: 4500, xp: 0,   ess: 0,  msg: '🌙🩺 **DR. MOON GIFT!** +4,500🪙 added!' }
            };
            if (giftCodes[code]) {
                if (prof.redeemedCodes.includes(code)) return socket.emit('svNotice', '⚠️ Already redeemed this code!');
                prof.redeemedCodes.push(code);
                const g = giftCodes[code];
                addCoins(uname, g.coins);
                prof.training.xp = (prof.training.xp || 0) + g.xp;
                prof.petEssence = (prof.petEssence || 0) + g.ess;
                syncPlayerTitlesAndBounty(uname); saveSvStats();
                socket.emit('svStatsSync', getSvProfile(uname));
                return socket.emit('svNotice', g.msg);
            }
            socket.emit('svNotice', '❌ Invalid Secret or Gift Code!');
        });
    });
    // ============================================================================
    // 🏋️ SAMMUVERSE V4 ENGINE — PIECE 11A/20: STATS, TRAINING & DOJO UPGRADES
    // ============================================================================
    io.on('connection', (socket) => {
        socket.on('joinRoom', (data) => {
            const uname = (data && data.username) ? data.username.trim() : (socket.username || '');
            if (!uname) return;
            socket.username = uname;
            if (!verifyPlayerAccountOwnership(uname, socket, false)) {
                socket.emit('message', { username: 'SYSTEM', text: `🛡️ **SECURITY ALERT:** **${uname}** is locked to another device!`, _serverId: socket.activeServerId });
            }
            const prof = getSvProfile(uname);
            ensureTrainingProfile(prof);
            socket.emit('svStatsSync', prof);
        });

        socket.on('svGetStats', () => {
            const prof = getSvProfile(socket.username || 'Player');
            ensureTrainingProfile(prof);
            socket.emit('svStatsSync', prof);
        });

        socket.on('svRequestLogs', () => {
            if (socket.activeServerId) socket.emit('svLogsUpdate', svBattleLogs.filter(l => l.srvId === socket.activeServerId));
        });

        socket.on('svTrainAction', ({ mode, stat }) => {
            const uname = socket.username || 'Player';
            if (!verifyPlayerAccountOwnership(uname, socket, false)) return;
            const prof = getSvProfile(uname);
            const tr = ensureTrainingProfile(prof);

            if (mode === 'grind_free') { tr.xp = (tr.xp || 0) + 25; addCoins(uname, 8); }
            else if (mode === 'grind_10x') {
                if (getCoins(uname) < 100) return socket.emit('svNotice', '🪙 Need 100 Coins!');
                addCoins(uname, -100); tr.xp = (tr.xp || 0) + 300;
            } else if (mode === 'grind_100x') {
                if (getCoins(uname) < 800) return socket.emit('svNotice', '🪙 Need 800 Coins!');
                addCoins(uname, -800); tr.xp = (tr.xp || 0) + 3000;
            } else if (mode === 'upgrade' && ['fistLv', 'bodyLv', 'chiLv'].includes(stat)) {
                const curLv = tr[stat] || 0;
                const xpCost = 100 + Math.floor(curLv * 25);
                if ((tr.xp || 0) < xpCost) return socket.emit('svNotice', `⚡ Need ${xpCost.toLocaleString()} Training XP!`);
                tr.xp -= xpCost; tr[stat] = curLv + 1;
            }
            ensureTrainingProfile(prof); syncPlayerTitlesAndBounty(uname); saveSvStats();
            socket.emit('svStatsSync', getSvProfile(uname));
        });

        socket.on('svBuyPower', (pKey) => {
            const uname = socket.username || 'Player';
            if (!verifyPlayerAccountOwnership(uname, socket, false)) return;
            const prof = getSvProfile(uname), def = SV_DEFS[pKey];
            if (!def || !def.cost || prof.unlockedPowers.includes(pKey)) return;
            if (getCoins(uname) < def.cost) return socket.emit('svNotice', `🪙 Need ${def.cost} Coins!`);
            addCoins(uname, -def.cost); prof.unlockedPowers.push(pKey);
            saveSvStats(); socket.emit('svStatsSync', getSvProfile(uname));
            socket.emit('svNotice', `🎉 Unlocked ${def.icon} ${def.name}!`);
        });

        socket.on('svUpgradeStat', (stat) => {
            const uname = socket.username || 'Player';
            if (!verifyPlayerAccountOwnership(uname, socket, false)) return;
            const prof = getSvProfile(uname);
            if (stat === 'atk' && prof.atkLv < 15 && getCoins(uname) >= 150) { addCoins(uname, -150); prof.atkLv++; }
            else if (stat === 'hp' && prof.hpLv < 15 && getCoins(uname) >= 150) { addCoins(uname, -150); prof.hpLv++; }
            else if (stat === 'stone' && !prof.hasStone && getCoins(uname) >= 1000) { addCoins(uname, -1000); prof.hasStone = true; }
            else return socket.emit('svNotice', '🪙 Not enough Coins or maxed!');
            saveSvStats(); socket.emit('svStatsSync', getSvProfile(uname));
        });
        // ========================================================================
        // 🏋️ SAMMUVERSE V4 ENGINE — PIECE 11B/20: LINEAGE, TITLES, ENCHANT & FUSION
        // ========================================================================
        socket.on('svPetAction', (petId) => {
            const uname = socket.username || 'Player';
            if (!verifyPlayerAccountOwnership(uname, socket, false)) return;
            const prof = getSvProfile(uname), costs = { mochi: 200, tommy: 200, garuda: 500, sheshnag: 2500 };
            if (prof.ownedPets.includes(petId)) { prof.activePet = prof.activePet === petId ? null : petId; }
            else if (costs[petId]) {
                if (getCoins(uname) < costs[petId]) return socket.emit('svNotice', `🪙 Need ${costs[petId]} Coins!`);
                addCoins(uname, -costs[petId]); prof.ownedPets.push(petId); prof.activePet = petId;
            }
            saveSvStats(); socket.emit('svStatsSync', getSvProfile(uname));
        });

        socket.on('svSpinLineage', () => {
            const uname = socket.username || 'Player';
            const prof = getSvProfile(uname);
            if (getCoins(uname) < 1000) return socket.emit('svNotice', '🪙 Need 1,000 Coins!');
            addCoins(uname, -1000);
            const r = Math.random();
            prof.lineage = r < 0.06 ? 'celestial' : (r < 0.20 ? 'slime' : (r < 0.38 ? 'dragonkin' : (r < 0.58 ? 'demon' : (r < 0.78 ? 'reaper' : 'ape'))));
            prof.lineageStage = 1;
            syncPlayerTitlesAndBounty(uname); saveSvStats(); socket.emit('svStatsSync', getSvProfile(uname));
        });

        socket.on('svEvolveLineage', () => {
            const uname = socket.username || 'Player';
            const prof = getSvProfile(uname), stg = prof.lineageStage || 1;
            if (stg >= 3) return;
            const cost = stg === 1 ? 2500 : 6000;
            if (getCoins(uname) < cost) return socket.emit('svNotice', `🪙 Need ${cost.toLocaleString()} Coins!`);
            addCoins(uname, -cost); prof.lineageStage = stg + 1;
            syncPlayerTitlesAndBounty(uname); saveSvStats(); socket.emit('svStatsSync', getSvProfile(uname));
        });

        socket.on('svEquipTitle', (titleId) => {
            const uname = socket.username || 'Player';
            const prof = getSvProfile(uname);
            syncPlayerTitlesAndBounty(uname);
            if (!prof.unlockedTitles.includes(titleId)) return socket.emit('svNotice', '🔒 Unlock this Title first!');
            prof.activeTitle = titleId; saveSvStats(); socket.emit('svStatsSync', getSvProfile(uname));
        });

        socket.on('svRollEnchant', (pKey) => {
            const uname = socket.username || 'Player';
            const prof = getSvProfile(uname);
            if (getCoins(uname) < 3000) return socket.emit('svNotice', '🪙 Need 3,000 Coins!');
            addCoins(uname, -3000);
            if (!prof.enchants) prof.enchants = {};
            const rolled = ENCHANT_POOL.at(Math.floor(Math.random() * ENCHANT_POOL.length));
            prof.enchants[pKey || 'fire'] = rolled;
            syncPlayerTitlesAndBounty(uname); saveSvStats(); socket.emit('svStatsSync', getSvProfile(uname));
            socket.emit('svNotice', `🔮 Enchanted with ${rolled.name}!`);
        });

        socket.on('svGetStock', () => {
            const st = getHourlyStock();
            socket.emit('svStockSync', { items: st.items, minsLeft: Math.max(1, Math.ceil((st.expiresAt - Date.now()) / 60000)) });
        });

        socket.on('svBuyStockItem', (pKey) => {
            const uname = socket.username || 'Player';
            const prof = getSvProfile(uname);
            const item = getHourlyStock().items.find(i => i.key === pKey);
            if (!item || prof.unlockedPowers.includes(pKey)) return;
            if (getCoins(uname) < item.price) return socket.emit('svNotice', `🪙 Need ${item.price.toLocaleString()} Coins!`);
            addCoins(uname, -item.price); prof.unlockedPowers.push(pKey);
            saveSvStats(); socket.emit('svStatsSync', getSvProfile(uname));
        });

        socket.on('svForgeCustomPower', ({ p1, p2, customName }) => {
            const uname = socket.username || 'Player';
            const prof = getSvProfile(uname);
            if (!p1 || !p2 || p1 === p2) return socket.emit('svNotice', '⚠️ Select 2 DIFFERENT powers!');
            const def1 = SV_DEFS[p1], def2 = SV_DEFS[p2];
            if (!def1 || !def2) return;
            const slotNum = prof.customPowers.length + 1;
            const tiers = new Array(50000, 250000, 750000, 1500000);
            const cost = prof.customPowers.length < tiers.length ? tiers.at(prof.customPowers.length) : (tiers.at(-1) + ((prof.customPowers.length - tiers.length + 1) * 1000000));
            const usePass = (prof.freeFusionPasses || 0) > 0;
            if (!usePass && getCoins(uname) < cost) return socket.emit('svNotice', `🪙 Fusion #${slotNum} requires ${cost.toLocaleString()} Coins!`);

            const title = (String(customName || '').trim() || `${def1.name.split(' ').at(0)} + ${def2.name.split(' ').at(0)}`).slice(0, 26);
            const cid = 'custom_' + uname.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + slotNum + '_' + Date.now().toString(36);
            const m1 = def1.moves.at(0), m2 = def2.moves.at(1) || def2.moves.at(0);
            const u1 = def1.moves.at(3) || m1, u2 = def2.moves.at(3) || m2;
            const scale = 1 + ((slotNum - 1) * 0.04);
            const avgHp = Math.min(600, Math.round((def1.hp + def2.hp) * 0.65 * scale));
            const d1 = Math.max(55, Math.round((m1.dmg || 45) * 1.15 * scale));
            const d2 = Math.max(60, Math.round((m2.dmg || 50) * 1.15 * scale));
            const uDmg = Math.min(230, Math.max(120, Math.round(((u1.dmg || 90) + (u2.dmg || 90)) * 0.65 * scale)));

            const newDef = {
                fused: true, icon: `${def1.icon}${def2.icon}`, name: `${title} [#${slotNum}]`, hp: avgHp,
                passiveRed: Math.min(0.50, Number((((def1.passiveRed || 0.1) + (def2.passiveRed || 0.1)) * 0.65).toFixed(2))),
                strong: Array.from(new Set(new Array().concat(def1.strong || new Array(), def2.strong || new Array()))),
                moves: new Array(
                    { label: `${m1.label.split(' (').at(0)} (${d1} DMG)`, dmg: d1, trueDmg: Boolean(m1.trueDmg) },
                    { label: `${m2.label.split(' (').at(0)} (${d2} DMG + Heal)`, dmg: d2, heal: 25 },
                    { label: `🌌 ${title} Domain (Evade +65 HP)`, evade: true, heal: 65 },
                    { label: `💥 ${title.toUpperCase()} ULT (${uDmg} True DMG + Stun)`, dmg: uDmg, trueDmg: true, stun: true, cut: { theme: 'vishwaroopa', emoji: `${def1.icon}${def2.icon}`, title: `${title.toUpperCase()}!` } }
                )
            };
            if (usePass) prof.freeFusionPasses--; else addCoins(uname, -cost);
            SV_DEFS[cid] = newDef; prof.unlockedPowers.push(cid); prof.customPowers.push({ id: cid, def: newDef });
            syncPlayerTitlesAndBounty(uname); saveSvStats();
            socket.emit('svStatsSync', getSvProfile(uname));
            socket.emit('svNotice', `⚗️👑 FORGED FUSION #${slotNum}: "${title}"!`);
        });
    });
    // ============================================================================
    // ⚔️ SAMMUVERSE V4 ENGINE — PIECE 12/20: PVP, ADVENTURE, TOWER & CLOUD BOOT
    // ============================================================================
    io.on('connection', (socket) => {
        socket.on('svChallenge', ({ targetId, power }) => {
            const srvId = socket.activeServerId;
            if (!srvId || findPlayerActiveSvBattle(socket.id)) return;
            if (['BOT_DUMMY', 'BOT_SENSEI', 'BOT_DEMON'].includes(targetId)) return startSvMatch(srvId, socket, power, targetId, null);
            const tSock = io.sockets.sockets.get(targetId);
            if (!tSock || tSock.activeServerId !== srvId) return socket.emit('svNotice', '⚠️ Opponent offline!');
            svPending.set(socket.id, { targetId, power, srvId, expires: Date.now() + 45000 });
            const def = SV_DEFS[power] || SV_DEFS.fire;
            io.to(targetId).emit('svIncomingChallenge', { fromId: socket.id, fromName: socket.username || 'Player', fromPowerLabel: `${def.icon} ${def.name}`, _serverId: srvId });
        });

        socket.on('svAccept', ({ challengerId, power }) => {
            const srvId = socket.activeServerId, req = svPending.get(challengerId);
            if (!srvId || !req || req.targetId !== socket.id || Date.now() > req.expires) return;
            svPending.delete(challengerId);
            const cSock = io.sockets.sockets.get(challengerId);
            if (cSock) startSvMatch(srvId, cSock, req.power, socket, power);
        });

        socket.on('svUseSkill', (idx) => {
            const found = findPlayerActiveSvBattle(socket.id);
            if (!found) return;
            const { bId, b } = found, fighter = b.p1.id === socket.id ? b.p1 : b.p2;
            if (fighter.choice !== null || fighter.stunned || (Number(idx) === 3 && fighter.ultCd > 0)) return;
            fighter.choice = Number(idx);
            if (b.p1.choice !== null && b.p2.choice !== null) resolveSvTurn(bId);
            else syncSvBattle(b, null);
        });

        socket.on('svDomainTap', () => {
            for (const [, cl] of activeDomainClashes.entries()) {
                if (cl.p1Id === socket.id) cl.p1Taps++;
                else if (cl.p2Id === socket.id) cl.p2Taps++;
            }
        });

        socket.on('svSurrenderToLove', () => {
            const found = findPlayerActiveSvBattle(socket.id);
            if (!found) return;
            const { bId, b } = found;
            const me = b.p1.id === socket.id ? b.p1 : b.p2;
            const opp = me === b.p1 ? b.p2 : b.p1;
            if (opp.isBot) return socket.emit('svNotice', '😂 Save Prem Samarpan for a real player!');
            clearInterval(b.interval); svBattles.delete(bId);
            broadcastSvCutscene(b, { theme: 'bansuri', emoji: '🪈💖', title: 'PREM SAMARPAN: SURRENDER TO LOVE!', caption: `💖 ${me.name.toUpperCase()} BOWED IN LOVE TO ${opp.name.toUpperCase()}!`, sfx: 'flute' });
            addCoins(opp.name, 250);
            io.to(me.id).emit('svBattleEnd', { won: false, _serverId: b.srvId });
            io.to(opp.id).emit('svBattleEnd', { won: true, _serverId: b.srvId });
            io.to(b.srvId).emit('message', { username: "Sammu's Bot", text: `💖🪈 **PREM SAMARPAN!** **${me.name}** surrendered out of love to **${opp.name}** (+250🪙)!`, _serverId: b.srvId });
        });

        socket.on('svStartAdventure', ({ ch, stg, power }) => {
            if (!socket.activeServerId || findPlayerActiveSvBattle(socket.id)) return socket.emit('svNotice', '⚠️ Finish your current battle first!');
            launchAdventureStage(socket, Number(ch) || 1, Number(stg) || 1, power || 'fire');
        });

        socket.on('svTowerEnter', ({ startFromCheckpoint }) => {
            if (!socket.activeServerId || findPlayerActiveSvBattle(socket.id)) return socket.emit('svNotice', '⚠️ Finish your current battle first!');
            const prof = getSvProfile(socket.username || 'Climber');
            launchEndlessTowerFloor(socket, startFromCheckpoint ? Math.max(1, prof.towerCheckpoint || 1) : 1, null);
        });

        socket.on('svGetTowerLeaderboard', () => {
            const top = Object.entries(svPlayerStats).map(([n, s]) => ({ name: n.toUpperCase(), floor: s.maxTowerFloor || 1 })).sort((a, b) => b.floor - a.floor).slice(0, 8);
            socket.emit('svTowerLeaderboardSync', top);
        });

        socket.on('chatMessage', async (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            if (typeof raw !== 'string' || !socket.activeServerId) return;
            if (raw.trim().toLowerCase() === '/cloudsave') {
                const r1 = await upstashCmd(['SET', 'sammu_sv_stats', JSON.stringify(svPlayerStats)]);
                const r2 = await upstashCmd(['SET', 'sammu_economy', JSON.stringify({ wallets: Object.fromEntries(playerWallet), cards: Object.fromEntries(playerCards) })]);
                socket.emit('message', { username: 'SYSTEM', text: (r1 && r2) ? `☁️✅ **CLOUD SAVED!** (${Object.keys(svPlayerStats).length} Profiles synced!)` : `❌ **Cloud Save Failed!**`, _serverId: socket.activeServerId });
            }
        });
    });

    (async function restoreCloudV4() {
        if (!UPSTASH_URL || !UPSTASH_TOKEN) return;
        const rawStats = await upstashCmd(['GET', 'sammu_sv_stats']);
        if (rawStats) {
            try {
                const parsed = JSON.parse(rawStats);
                Object.entries(parsed).forEach(([k, v]) => {
                    svPlayerStats[k.toLowerCase()] = v;
                    if (Array.isArray(v.customPowers)) v.customPowers.forEach(cp => { if (cp && cp.id) SV_DEFS[cp.id] = cp.def; });
                });
            } catch (e) {}
        }
        const rawEco = await upstashCmd(['GET', 'sammu_economy']);
        if (rawEco) {
            try {
                const eco = JSON.parse(rawEco);
                if (eco.wallets) Object.entries(eco.wallets).forEach(([k, v]) => playerWallet.set(k.toLowerCase(), Number(v)));
                if (eco.cards) Object.entries(eco.cards).forEach(([k, v]) => playerCards.set(k.toLowerCase(), v));
            } catch (e) {}
        }
    })();
    // ============================================================================
    // 🎨 SAMMUVERSE V4 ENGINE — PIECE 13/20: V4 STYLES & CINEMA CUTSCENE HTML
    // ============================================================================
    const SV_UI_HTML_PART1 = `
    <style>
      #svModal { display:none; position:fixed; inset:0; background:rgba(5,7,16,0.95); z-index:999995; align-items:center; justify-content:center; padding:10px; backdrop-filter:blur(10px); font-family:inherit; }
      #svCard { background:linear-gradient(155deg,#0f172a,#1e1b4b,#311042); border:2px solid #a855f7; border-radius:22px; padding:13px; width:100%; max-width:440px; max-height:93vh; overflow-y:auto; color:#fff; box-shadow:0 0 40px rgba(168,85,247,0.55); text-align:center; }
      .sv-tabs { display:grid; grid-template-columns:repeat(5,1fr); gap:4px; margin:8px 0; }
      .sv-tab { padding:7px 2px; border-radius:10px; border:1px solid #a855f7; background:#1e1b4b; color:#fff; font-weight:900; font-size:10px; cursor:pointer; }
      .sv-tab.active { background:#a855f7; color:#fff; box-shadow:0 0 10px rgba(168,85,247,0.6); }
      .sv-powers { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin:8px 0; max-height:185px; overflow-y:auto; }
      .sv-pwr-btn { background:rgba(255,255,255,0.07); border:1.5px solid #475569; border-radius:11px; padding:7px 6px; color:#fff; font-size:11px; font-weight:bold; cursor:pointer; text-align:left; }
      .sv-pwr-btn.selected { border-color:#facc15; background:rgba(250,204,21,0.22); }
      .sv-pwr-btn.locked-coin { border-color:#38bdf8; background:rgba(56,189,248,0.1); }
      .sv-hp-wrap { background:#090d16; border:1px solid #475569; border-radius:10px; padding:5px 6px; margin-bottom:5px; text-align:left; }
      .sv-hp-bar { height:9px; border-radius:6px; background:linear-gradient(90deg,#22c55e,#4ade80); transition:width 0.3s; }
      .sv-hp-bar.awakened { background:linear-gradient(90deg,#f59e0b,#facc15,#fef08a) !important; box-shadow:0 0 12px #facc15; }
      .sv-skills { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin-top:7px; }
      .sv-skill-btn { background:linear-gradient(145deg,#3b0764,#1e1b4b); border:1.5px solid #c084fc; border-radius:12px; padding:8px 7px; color:#fff; font-size:11px; font-weight:bold; cursor:pointer; text-align:left; }
      .sv-skill-btn:disabled { opacity:0.45; cursor:not-allowed; }
      .sv-skill-btn.ult { border-color:#facc15; background:linear-gradient(145deg,#713f12,#4c0519); }
      .sv-shop-card { background:rgba(255,255,255,0.06); border:1px solid #475569; border-radius:11px; padding:8px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; text-align:left; font-size:11px; }
      .sv-log-item { background:rgba(255,255,255,0.06); border-left:3px solid #facc15; border-radius:8px; padding:6px 8px; margin-bottom:5px; font-size:11px; text-align:left; }
      #svCutsceneOverlay { display:none; position:fixed; inset:0; z-index:9999999; background:rgba(3,5,12,0.95); backdrop-filter:blur(10px); align-items:center; justify-content:center; flex-direction:column; padding:12px; }
      #svCutsceneBox { position:relative; width:100%; max-width:430px; border:3px solid #facc15; border-radius:20px; overflow:hidden; background:#03050c; box-shadow:0 0 60px rgba(250,204,21,0.85); text-align:center; }
      #svCutsceneCanvas { width:100%; height:260px; display:block; }
      #svSkipCutsceneBtn { position:absolute; top:26px; right:10px; z-index:10; background:rgba(15,23,42,0.92); border:1.5px solid #facc15; color:#fde047; border-radius:999px; padding:5px 12px; font-size:11px; font-weight:900; cursor:pointer; }
    </style>

    <div id="svCutsceneOverlay" onclick="if(event.target===this)skipSvCutscene()">
      <div id="svCutsceneBox">
        <button id="svSkipCutsceneBtn" onclick="skipSvCutscene()">⏭️ Skip</button>
        <canvas id="svCutsceneCanvas" width="420" height="260"></canvas>
        <div id="svCutsceneCaption" style="padding:9px 10px;background:linear-gradient(90deg,#3b0764,#713f12);font-weight:900;font-size:13px;color:#fef08a;">ULTIMATE AWAKENING!</div>
      </div>
    </div>

    <div id="svSubModal" style="display:none;position:fixed;inset:0;background:rgba(5,7,18,0.93);z-index:9999996;align-items:center;justify-content:center;padding:12px;backdrop-filter:blur(8px);">
      <div style="background:linear-gradient(155deg,#0f172a,#1e1b4b);border:2px solid #38bdf8;border-radius:20px;padding:14px;width:100%;max-width:415px;max-height:86vh;overflow-y:auto;color:#fff;text-align:center;box-shadow:0 0 35px rgba(56,189,248,0.5);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span id="svSubTitle" style="font-weight:900;font-size:14px;color:#38bdf8;">✨ SAMMUVERSE MENU</span>
          <button onclick="document.getElementById('svSubModal').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:8px;padding:4px 10px;font-weight:bold;cursor:pointer;">✕ Close</button>
        </div>
        <div id="svSubBody"></div>
      </div>
    </div>

    <div id="svDomainClashModal" style="display:none;position:fixed;inset:0;background:rgba(9,5,20,0.95);z-index:9999998;align-items:center;justify-content:center;padding:14px;backdrop-filter:blur(10px);">
      <div style="background:linear-gradient(145deg,#3b0764,#7f1d1d);border:3px solid #facc15;border-radius:22px;padding:18px;width:100%;max-width:360px;color:#fff;text-align:center;box-shadow:0 0 45px rgba(250,204,21,0.8);">
        <div style="font-size:18px;font-weight:900;color:#fde047;margin-bottom:4px;">⚡👑 V3 DOMAIN CLASH!! ⚡</div>
        <div id="svClashSub" style="font-size:12px;color:#fecaca;margin-bottom:12px;">Rapidly tap below to overpower your rival!</div>
        <button onclick="if(typeof socket!=='undefined')socket.emit('svDomainTap');" style="width:100%;padding:22px;border:2px solid #fff;border-radius:16px;background:linear-gradient(90deg,#f59e0b,#ef4444);color:#fff;font-size:20px;font-weight:900;cursor:pointer;box-shadow:0 0 25px #f59e0b;">💥 TAP FAST! 💥</button>
      </div>
    </div>`;
  // ============================================================================
 // 🎨 SAMMUVERSE V4 ENGINE — PIECE 14A/20: MODAL HEADER, ARENA & STORY HTML
 // ============================================================================
 const SV_UI_HTML_PART2A = `
 <div id="svModal">
   <div id="svCard">
     <div style="display:flex;justify-content:space-between;align-items:center;">
       <span style="font-weight:900;font-size:15px;color:#e879f9;">⚔️ SAMMUVERSE V4 RPG</span>
       <div style="display:flex;gap:5px;align-items:center;">
         <span id="svHeaderCoins" style="background:#090d16;border:1px solid #facc15;color:#fde047;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:900;">🪙 150</span>
         <button id="svMuteBtn" onclick="toggleSvSfx()" style="background:#1e293b;border:1px solid #38bdf8;color:#fff;border-radius:8px;padding:3px 7px;font-size:11px;cursor:pointer;">🔊</button>
         <button onclick="document.getElementById('svModal').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:8px;padding:4px 9px;font-weight:bold;cursor:pointer;">✕</button>
       </div>
     </div>

     <div id="svLobbyView">
       <div class="sv-tabs">
         <button class="sv-tab active" id="svTabFight" onclick="switchSvTab('fight')">⚔️ Arena</button>
         <button class="sv-tab" id="svTabAdv" onclick="switchSvTab('adv')">🗺️ Story</button>
         <button class="sv-tab" id="svTabTrain" onclick="switchSvTab('train')">🏋️ Train</button>
         <button class="sv-tab" id="svTabDojo" onclick="switchSvTab('dojo')">💪 Dojo</button>
         <button class="sv-tab" id="svTabLogs" onclick="switchSvTab('logs')">📜 Logs</button>
       </div>

       <div id="svFightPanel">
         <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:3px;margin-bottom:6px;">
           <button type="button" onclick="openDailyWheelModal()" style="padding:6px 1px;border-radius:9px;border:1.5px solid #f43f5e;background:#4c0519;color:#fda4af;font-size:10px;font-weight:900;cursor:pointer;">🎡 Wheel</button>
           <button type="button" onclick="openSvSub('lineage')" style="padding:6px 1px;border-radius:9px;border:1.5px solid #4ade80;background:#064e3b;color:#86efac;font-size:10px;font-weight:900;cursor:pointer;">🧬 DNA</button>
           <button type="button" onclick="openSvSub('titles')" style="padding:6px 1px;border-radius:9px;border:1.5px solid #facc15;background:#311042;color:#fde047;font-size:10px;font-weight:900;cursor:pointer;">🏷️ Titles</button>
           <button type="button" onclick="openEndlessTowerModal()" style="padding:6px 1px;border-radius:9px;border:1.5px solid #38bdf8;background:#1e3a8a;color:#93c5fd;font-size:10px;font-weight:900;cursor:pointer;">♾️ Tower</button>
           <button type="button" onclick="openSvSub('stock')" style="padding:6px 1px;border-radius:9px;border:1.5px solid #38bdf8;background:#0c4a6e;color:#7dd3fc;font-size:10px;font-weight:900;cursor:pointer;">🎰 Stock</button>
           <button type="button" onclick="socket.emit('svRollEnchant',window._curSvPow||'fire')" style="padding:6px 1px;border-radius:9px;border:1.5px solid #c084fc;background:#3b0764;color:#e879f9;font-size:10px;font-weight:900;cursor:pointer;">🔮 Enchant</button>
         </div>

         <div style="display:flex;gap:5px;margin-bottom:6px;">
           <input id="svSecretCodeInput" placeholder="🔑 Enter Secret or Gift Code..." style="flex:1;padding:6px 8px;border-radius:9px;border:1.5px solid #f59e0b;background:#090d16;color:#fff;font-size:11px;">
           <button onclick="redeemSvSecretCode()" style="background:linear-gradient(90deg,#f59e0b,#d97706);border:none;color:#111;border-radius:9px;padding:6px 10px;font-weight:900;font-size:11px;cursor:pointer;">🔓 Redeem</button>
         </div>

         <div class="sv-powers" id="svPowerGrid"></div>
         <div id="svPowerPreview" style="background:rgba(168,85,247,0.16);border:1px solid #c084fc;border-radius:10px;padding:6px;font-size:11px;color:#fde047;margin-bottom:7px;">Select a power to inspect its 4 skills!</div>

         <div style="display:flex;gap:5px;margin-bottom:6px;">
           <select id="svOpponentSelect" style="flex:1;padding:7px;border-radius:10px;border:1.5px solid #38bdf8;background:#090d16;color:#fff;font-size:11px;">
             <option value="BOT_DUMMY">🥊 Wooden Dummy (+35🪙)</option>
           </select>
           <button onclick="sendSvChallenge()" style="padding:7px 14px;border:none;border-radius:10px;background:linear-gradient(90deg,#ec4899,#8b5cf6);color:#fff;font-weight:900;font-size:12px;cursor:pointer;">⚔️ FIGHT</button>
         </div>
         <div id="svIncomingBox" style="display:none;background:rgba(250,204,21,0.2);border:1.5px solid #facc15;border-radius:12px;padding:8px;margin-top:6px;"></div>
       </div>

       <div id="svAdvPanel" style="display:none;max-height:345px;overflow-y:auto;">
         <div style="background:linear-gradient(90deg,#064e3b,#1e3a8a);border:1.5px solid #4ade80;border-radius:12px;padding:8px;margin-bottom:8px;">
           <div style="font-size:13px;font-weight:900;color:#4ade80;">🗺️ REALM ADVENTURE CAMPAIGN</div>
           <div id="svAdvSummary" style="font-size:11px;color:#cbd5e1;margin-top:2px;">Chapter 1 — Stage 1/3 | Pet Essence: 0 🔮</div>
         </div>
         <div id="svAdventureChaptersList"></div>
       </div>`;

    // ============================================================================
    // 🎨 SAMMUVERSE V4 ENGINE — PIECE 14B/20: TRAIN, DOJO, MERGER & BATTLE HUD
    // ============================================================================
    const SV_UI_HTML_PART2B = `
          <div id="svTrainPanel" style="display:none;max-height:345px;overflow-y:auto;">
            <div style="background:linear-gradient(90deg,#1e3a8a,#3b0764);border:1.5px solid #38bdf8;border-radius:12px;padding:8px;margin-bottom:8px;">
              <div style="font-size:13px;font-weight:900;color:#fde047;">🏋️ COSMIC TRAINING ARENA</div>
              <div id="svTrainSummary" style="font-size:11px;color:#cbd5e1;margin-top:2px;">Total Mastery: 0 | Available XP: 0 ⚡</div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:8px;">
              <button onclick="socket.emit('svTrainAction',{mode:'grind_free'})" style="padding:9px 4px;border:1.5px solid #4ade80;border-radius:10px;background:#064e3b;color:#fff;font-weight:900;font-size:11px;cursor:pointer;">🥊 Sparring<br><span style="font-size:9px;color:#86efac;">+25 XP & +8🪙</span></button>
              <button onclick="socket.emit('svTrainAction',{mode:'grind_10x'})" style="padding:9px 4px;border:1.5px solid #38bdf8;border-radius:10px;background:#0c4a6e;color:#fff;font-weight:900;font-size:11px;cursor:pointer;">🌌 10x Gravity<br><span style="font-size:9px;color:#7dd3fc;">+300 XP (100🪙)</span></button>
              <button onclick="socket.emit('svTrainAction',{mode:'grind_100x'})" style="padding:9px 4px;border:1.5px solid #facc15;border-radius:10px;background:#713f12;color:#fff;font-weight:900;font-size:11px;cursor:pointer;">⏳ 100x Chamber<br><span style="font-size:9px;color:#fde047;">+3,000 XP (800🪙)</span></button>
            </div>
            <div class="sv-shop-card"><div><b style="color:#f87171;">👊 Fist Mastery</b><br><span id="svFistDesc" style="color:#cbd5e1;">Lv.0 (+0 Permanent DMG)</span></div><button id="svUpFistBtn" onclick="socket.emit('svTrainAction',{mode:'upgrade',stat:'fistLv'})" style="background:#dc2626;border:none;color:#fff;padding:6px 10px;border-radius:8px;font-weight:900;cursor:pointer;">100 XP</button></div>
            <div class="sv-shop-card"><div><b style="color:#4ade80;">🛡️ Body Temper</b><br><span id="svBodyDesc" style="color:#cbd5e1;">Lv.0 (+0 Permanent HP)</span></div><button id="svUpBodyBtn" onclick="socket.emit('svTrainAction',{mode:'upgrade',stat:'bodyLv'})" style="background:#16a34a;border:none;color:#fff;padding:6px 10px;border-radius:8px;font-weight:900;cursor:pointer;">100 XP</button></div>
            <div class="sv-shop-card"><div><b style="color:#38bdf8;">⚡ Chi Focus</b><br><span id="svChiDesc" style="color:#cbd5e1;">Lv.0 (+0% ULT & Crit)</span></div><button id="svUpChiBtn" onclick="socket.emit('svTrainAction',{mode:'upgrade',stat:'chiLv'})" style="background:#0284c7;border:none;color:#fff;padding:6px 10px;border-radius:8px;font-weight:900;cursor:pointer;">100 XP</button></div>
          </div>

          <div id="svDojoPanel" style="display:none;max-height:345px;overflow-y:auto;">
            <div id="svRankBanner" style="background:rgba(168,85,247,0.2);border:1px solid #c084fc;border-radius:10px;padding:6px;font-size:11px;font-weight:bold;color:#e879f9;margin-bottom:7px;">Wins: 0 | Essence: 0🔮</div>
            <div class="sv-shop-card" style="border-color:#38bdf8;"><div><b style="color:#38bdf8;">⚡ Omega Core Gear</b><br><span style="color:#cbd5e1;">Req: Tower Floor 50 | Unlocks ⚡ Omega Evolution!</span></div><button id="svGearOmegaBtn" onclick="socket.emit('svCraftGear','omegaCore')" style="background:#0284c7;border:none;color:#fff;padding:6px 9px;border-radius:8px;font-weight:900;cursor:pointer;">10,000🪙</button></div>
            <div class="sv-shop-card" style="border-color:#f43f5e;"><div><b style="color:#fda4af;">🌌 Titan Crown Gear</b><br><span style="color:#cbd5e1;">Req: Tower Floor 50 | Unlocks 🌌 Colossal Titan Form!</span></div><button id="svGearTitanBtn" onclick="socket.emit('svCraftGear','titanCrown')" style="background:#e11d48;border:none;color:#fff;padding:6px 9px;border-radius:8px;font-weight:900;cursor:pointer;">25,000🪙</button></div>
            <div class="sv-shop-card"><div><b style="color:#f87171;">⚔️ Attack Boost</b><br><span id="svAtkDesc" style="color:#cbd5e1;">Lv.0/15 (+0 DMG)</span></div><button id="svBuyAtkBtn" onclick="buySvItem('atk')" style="background:#dc2626;border:none;color:#fff;padding:6px 10px;border-radius:8px;font-weight:900;cursor:pointer;">150🪙</button></div>
            <div class="sv-shop-card"><div><b style="color:#4ade80;">❤️ Health Boost</b><br><span id="svHpDesc" style="color:#cbd5e1;">Lv.0/15 (+0 HP)</span></div><button id="svBuyHpBtn" onclick="buySvItem('hp')" style="background:#16a34a;border:none;color:#fff;padding:6px 10px;border-radius:8px;font-weight:900;cursor:pointer;">150🪙</button></div>
            <div class="sv-shop-card" style="border-color:#facc15;"><div><b style="color:#fde047;">💎 Awakening Stone</b><br><span style="color:#cbd5e1;">Below 40% HP: +25% ATK & +40 HP!</span></div><button id="svBuyStoneBtn" onclick="buySvItem('stone')" style="background:#d97706;border:none;color:#fff;padding:6px 10px;border-radius:8px;font-weight:900;cursor:pointer;">1000🪙</button></div>
            <div style="background:rgba(168,85,247,0.16);border:1.5px solid #e879f9;border-radius:12px;padding:8px;margin:7px 0;text-align:left;">
              <div style="font-size:11px;font-weight:900;color:#f0abfc;margin-bottom:5px;">⚗️ CUSTOM MULTI-FUSION LAB</div>
              <div style="display:flex;gap:5px;margin-bottom:5px;">
                <select id="svFuseP1" style="flex:1;padding:6px;border-radius:8px;background:#090d16;color:#fff;border:1px solid #a855f7;font-size:11px;"></select>
                <select id="svFuseP2" style="flex:1;padding:6px;border-radius:8px;background:#090d16;color:#fff;border:1px solid #a855f7;font-size:11px;"></select>
              </div>
              <input id="svFuseName" placeholder="Custom Fusion Name..." maxlength="24" style="width:100%;padding:6px;border-radius:8px;background:#090d16;color:#fff;border:1px solid #38bdf8;font-size:11px;margin-bottom:5px;box-sizing:border-box;">
              <button id="svForgeBtn" onclick="socket.emit('svForgeCustomPower',{p1:document.getElementById('svFuseP1').value,p2:document.getElementById('svFuseP2').value,customName:document.getElementById('svFuseName').value})" style="width:100%;padding:8px;border:none;border-radius:9px;background:linear-gradient(90deg,#ec4899,#8b5cf6);color:#fff;font-weight:900;font-size:11px;cursor:pointer;">⚗️ Forge Fusion #1 (50,000🪙)</button>
            </div>
            <div style="font-size:11px;font-weight:900;color:#f472b6;text-align:left;margin:6px 0 4px;">🧬 PET MERGER & EVOLUTION LAB:</div>
            <div class="sv-shop-card" style="border-color:#f59e0b;"><div><b style="color:#fde047;">🦁 Chimera Guardian</b><br><span style="color:#cbd5e1;">Merge 🐱 Mochi + 🐶 Tommy (30🔮 + 1,000🪙)</span></div><button id="svMergeChimeraBtn" onclick="socket.emit('svMergePet','chimera')" style="background:#d97706;border:none;color:#fff;padding:6px 9px;border-radius:8px;font-weight:900;cursor:pointer;">Merge</button></div>
            <div class="sv-shop-card" style="border-color:#a855f7;"><div><b style="color:#e879f9;">🐉 Cosmic Ouroboros</b><br><span style="color:#cbd5e1;">Merge 🦅 Garuda + 🐍 Sheshnag (80🔮 + 4,000🪙)</span></div><button id="svMergeOuroBtn" onclick="socket.emit('svMergePet','ouroboros')" style="background:#7c3aed;border:none;color:#fff;padding:6px 9px;border-radius:8px;font-weight:900;cursor:pointer;">Merge</button></div>
            <div style="font-size:11px;font-weight:900;color:#38bdf8;text-align:left;margin:6px 0 4px;">🐾 COMPANION SPIRITS:</div>
            <div id="svPetShopList"></div>
          </div>

          <div id="svLogsPanel" style="display:none;max-height:345px;overflow-y:auto;">
            <div id="svLogList" style="font-size:11px;color:#94a3b8;">Loading PvP Battle Register...</div>
          </div>
        </div>

        <div id="svBattleView" style="display:none;margin-top:6px;">
          <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:bold;color:#38bdf8;margin-bottom:4px;"><span id="svTurnBadge">Turn 1</span><span id="svBattleTimer" style="color:#fde047;">⏳ 15s</span></div>
          <div class="sv-hp-wrap"><div style="display:flex;justify-content:space-between;font-size:11px;font-weight:bold;margin-bottom:2px;"><span id="svOppLabel" style="color:#f87171;">Opponent</span><span id="svOppHpText">200 / 200 HP</span></div><div class="sv-hp-bar" id="svOppHpBar" style="width:100%;background:linear-gradient(90deg,#dc2626,#f87171);"></div></div>
          <div class="sv-hp-wrap"><div style="display:flex;justify-content:space-between;font-size:11px;font-weight:bold;margin-bottom:2px;"><span id="svMeLabel" style="color:#4ade80;">You</span><span id="svMeHpText">200 / 200 HP</span></div><div class="sv-hp-bar" id="svMeHpBar" style="width:100%;"></div></div>
          <div id="svTransformBar" style="display:flex;gap:5px;margin:5px 0;"></div>
          <div id="svCombatFeed" style="background:#090d16;border:1px solid #334155;border-radius:10px;padding:6px;font-size:11px;color:#e2e8f0;min-height:44px;margin:5px 0;">Choose your skill below!</div>
          <div class="sv-skills" id="svSkillButtons"></div>
        </div>
      </div>
    </div>`;
  const SV_FULL_BUNDLE = SV_UI_HTML_PART1 + '\n' + SV_UI_HTML_PART2A + '\n' + SV_UI_HTML_PART2B;


    // ============================================================================
    // 🎬 SAMMUVERSE V4 ENGINE — PIECE 15/20: CLIENT POWERS & ANIME SFX
    // ============================================================================
    const SV_CLIENT_JS_PART1 = `
      const SV_POWERS = {
        fire:       { icon: '🔥', name: 'Fire Inferno',     skills: ['Fireball (28 DMG)', 'Flame Tornado (42 DMG)', 'Heat Shield (Block 70%)', '☀️ Solar Flare ULT (68 DMG)'] },
        water:      { icon: '🌊', name: 'Water Tsunami',    skills: ['Hydro Whip (26 DMG)', 'Whirlpool Trap (35 DMG)', 'Water Mirror (Reflect 50%)', '🌊 Abyssal Wave ULT (65 DMG)'] },
        lightning:  { icon: '⚡', name: 'Lightning Raijin',  skills: ['Thunder Bolt (30 DMG)', 'Speed Blitz (43 DMG)', 'Static Armor (Block 65%)', '🐉 Kirin Sky Dragon ULT (69 DMG)'] },
        ice:        { icon: '❄️', name: 'Absolute Ice',     skills: ['Ice Lance (27 DMG)', 'Frostbite (36 DMG)', 'Glacier Wall (Block 80%)', '🧊 Ice Age Freeze ULT (58 DMG + Stun)'] },
        storm:      { cost: 300, icon: '🌪️', name: 'Storm Dragon',     skills: ['Gale Blade (29 DMG)', 'Tornado Slam (43 DMG)', 'Wind Wall (Block 75%)', '⚡ Tempest Roar ULT (71 DMG)'] },
        venom:      { cost: 300, icon: '☠️', name: 'Venom Hydra',      skills: ['Acid Spit (28 DMG)', 'Toxic Fang (42 DMG)', 'Shed Skin (+25 HP & Shield)', '🐍 Hydra Plague ULT (69 DMG)'] },
        rubber:     { cost: 300, icon: '👒', name: 'Rubber Gear 5',    skills: ['Gum-Gum Pistol (29 DMG)', 'Gatling Barrage (44 DMG)', 'Elastic Bounce (Dodge +15 HP)', '👊 Bajrang Fist ULT (72 DMG)'] },
        blood:      { cost: 300, icon: '🩸', name: 'Blood Demon',      skills: ['Crimson Slash (29 DMG)', 'Vampire Bite (34 DMG + 18 HP)', 'Blood Mist (Evade Hit)', '🌕 Moonlit Massacre ULT (70 DMG)'] },
        gravity:    { cost: 750, icon: '🪐', name: 'Gravity Force',    skills: ['Crush Slam (31 DMG)', 'Meteor Drop (46 DMG)', 'Gravity Repulse (Block 75%)', '☄️ Planetary Devastation ULT (74 DMG)'] },
        space:      { cost: 750, icon: '🌌', name: 'Space Warp',       skills: ['Spatial Slash (32 DMG)', 'Void Rift (44 DMG)', 'Teleport Dodge (Evade Hit)', '🌌 Dimension Collapse ULT (74 DMG)'] },
        time:       { cost: 750, icon: '⏳', name: 'Time Chrono',      skills: ['Chrono Strike (28 DMG)', 'Age Decay (40 DMG)', 'Rewind Heal (+40 HP)', '⏸️ Time Stop ULT (62 DMG + Stun)'] },
        sun:        { cost: 750, icon: '☀️', name: 'Sun God Nika',     skills: ['Dawn Whip (32 DMG)', 'Sun Gatling (46 DMG)', 'Drum Heartbeat (+35 HP)', '🔥 Bajrang Dawn ULT (78 DMG)'] },
        shadow:     { cost: 1500, icon: '🌑', name: 'Shadow Monarch',  skills: ['Shadow Dagger (35 DMG)', 'Arise Army (49 DMG)', 'Umbral Dodge (Evade Hit)', '👑 Monarch Domain ULT (82 DMG)'] },
        blackhole:  { cost: 1500, icon: '🕳️', name: 'Black Hole',      skills: ['Dark Pull (33 DMG)', 'Event Horizon (44 DMG + Drain)', 'Matter Absorb (+30 HP & Shield)', '🕳️ Supermassive Crunch ULT (82 DMG)'] },
        antimatter: { cost: 1500, icon: '⚛️', name: 'Anti-Matter',     skills: ['Positron Beam (36 DMG)', 'Chain Annihilation (52 DMG)', 'Phase Shift (Evade Hit)', '💥 Big Bang Erasure ULT (86 DMG)'] },
        zoro:       { cost: 2000, icon: '⚔️', name: 'Zoro (3-Sword King)',      skills: ['Oni Giri (40 DMG)', 'Dragon Twister (56 DMG)', 'King Haki Parry (Block 80%)', '👹 Ashura 9-Sword ULT (94 DMG)'] },
        sus:        { cost: 2000, icon: '👀', name: 'Sus (Shadow Imposter)',    skills: ['Vent Ambush (40 DMG)', 'Sabotage Strike (54 DMG)', 'Fake Task Evade (+35 HP)', '🚨 Emergency Eject ULT (92 DMG + Stun)'] },
        moon:       { cost: 4000, icon: '🌙', name: 'Dr. Moon (Lunar Empress)', skills: ['🌙 Lunar Scalpel (44 DMG)', '🌿 Sanjeevani Surge (58 DMG + 18 HP)', '🩺 Doctor Elixir (Evade +65 HP)', '🌕 Full Moon Eclipse ULT (98 DMG + Stun)'] },
        plasma:      { fused: true, icon: '⚛️🔥', name: 'Plasma Emperor',    skills: ['Plasma Lance (48 DMG)', 'Supernova Arc (64 DMG)', 'Ion Barrier (Block 80%)', '☀️ STAR COLLAPSE ULT (108 DMG)'] },
        leviathan:   { fused: true, icon: '🐉🌊', name: 'Steam Leviathan',   skills: ['Scalding Geyser (46 DMG)', 'Boil Tsunami (62 DMG + 18 HP)', 'Mist Mirage (Evade +28 HP)', '🐉 OCEAN BOIL ULT (105 DMG)'] },
        chronovoid:  { fused: true, icon: '⏳🌌', name: 'Chrono Void God',   skills: ['Reality Tear (50 DMG)', 'Paradox Loop (58 DMG + Stun)', 'Time Rewind (Evade +50 HP)', '🌌 BIG CRUNCH ULT (112 True DMG)'] },
        eclipsenika: { fused: true, icon: '🌑☀️', name: 'Eclipse Sun God',   skills: ['Dawn Eclipse Fist (52 DMG)', 'Shadow Liberation (68 DMG)', 'Drum Pulse (Block 70% + 35 HP)', '🌑☀️ TOTAL ECLIPSE ULT (116 DMG + Stun)'] },
        mahavishnu:  { secret: true, icon: '🔱', name: 'Sammu/Samaksh (MahaVishnu)', skills: ['🪈 Prem Bansuri (65 DMG + Stun)', '☸️ Sudarshana Chakra (95 True DMG)', '🛡️ Vaikuntha Kavach (Evade +80 HP)', '🌌 Vishwaroopa ULT (160 True DMG + Stun)'] },
        millyyt:     { secret: true, icon: '🎬', name: 'Milly (YouTube Queen)',     skills: ['🔔 Subscribe Smash (46 DMG + Stun)', '📈 10M Viral Surge (64 DMG + 20 HP)', '💎 Diamond Shield (Evade +50 HP)', '▶️ Golden Play Button ULT (115 True DMG)'] },
        ishikastar:  { secret: true, icon: '✨', name: 'Ishika (Celestial Empress)', skills: ['💫 Starfall Beam (42 DMG)', '💥 Supernova Burst (58 DMG)', '🌸 Astral Blessing (Evade +45 HP)', '🌠 Empress Meteor ULT (96 DMG)'] },
        zoroking:    { secret: true, icon: '⚔️', name: 'Zoro (King of Hell)',      skills: ['Enma Purgatory (52 DMG)', 'Three-Sword Dragon (72 DMG)', 'Conqueror Haki (Evade +45 HP)', '👹 Dragon Damnation ULT (132 DMG)'] },
        antimpoke:   { secret: true, icon: '⚡', name: 'Antim (Astral Sky Sovereign)', skills: ['Dragon Ascent (50 DMG)', 'Judgment Beam (70 True DMG)', 'Multitype Plate (Block 85%)', '🐉 Sky Sovereign ULT (130 DMG)'] },
        mahadev:     { secret: true, icon: '🔱', name: 'Mahadev (Tandava Destroyer)', skills: ['Trishul Pierce (56 DMG)', 'Damru Cosmic Beat (74 DMG + Stun)', 'Kailash Meditation (+65 HP)', '🔥 Third Eye Tandava ULT (140 True DMG)'] }
      };

      const SV_PETS = [
        { id: 'mochi', name: '🐱 Mochi Spirit', desc: 'Scratches foe for +10 DMG/turn', cost: 200 },
        { id: 'tommy', name: '🐶 Tommy Guardian', desc: 'Heals you for +10 HP/turn', cost: 200 },
        { id: 'garuda', name: '🦅 Garuda Eagle', desc: 'Strikes for +22 DMG/turn', cost: 500 },
        { id: 'sheshnag', name: '🐍 Sheshnag Serpent', desc: '15% Block + 18 Poison/turn', cost: 2500 },
        { id: 'chimera', name: '🦁 Chimera Guardian [EVOLVED]', desc: '+24 DMG & +20 HP/turn (Merge Mochi+Tommy)', evolved: true },
        { id: 'ouroboros', name: '🐉 Cosmic Ouroboros [MYTHIC]', desc: '-18% DMG Taken, +42 DMG & +25 HP/turn', evolved: true }
      ];

      let selectedPower = 'fire', latestPlayers = [], sfxMuted = false, svAudio = null, cutAnimId = null, cutTimeout = null;
      let myProfile = { coins: 150, atkLv: 0, hpLv: 0, wins: 0, streak: 0, petEssence: 0, gears: { omegaCore: false, titanCrown: false }, adventure: { chapter: 1, stage: 1 }, hasStone: false, unlockedPowers: [], ownedPets: [], activePet: null, powerWins: {}, training: { fistLv: 0, bodyLv: 0, chiLv: 0, xp: 0 } };

      window.toggleSvSfx = function() { sfxMuted = !sfxMuted; const b = document.getElementById('svMuteBtn'); if (b) b.textContent = sfxMuted ? '🔇' : '🔊'; };

      function playSvSfx(type) {
        if (sfxMuted) return;
        try {
          if (!svAudio) svAudio = new (window.AudioContext || window.webkitAudioContext)();
          if (svAudio.state === 'suspended') svAudio.resume();
          const now = svAudio.currentTime;
          if (type === 'flute') {
            [523.25, 587.33, 659.25, 783.99, 880.00].forEach((freq, i) => {
              const o = svAudio.createOscillator(), g = svAudio.createGain();
              o.type = 'sine'; o.frequency.setValueAtTime(freq, now + i * 0.09);
              g.gain.setValueAtTime(0.01, now + i * 0.09); g.gain.linearRampToValueAtTime(0.18, now + i * 0.09 + 0.03); g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.22);
              o.connect(g); g.connect(svAudio.destination); o.start(now + i * 0.09); o.stop(now + i * 0.09 + 0.23);
            });
          } else if (type === 'ult' || type === 'awaken') {
            const o = svAudio.createOscillator(), g = svAudio.createGain();
            o.type = 'sawtooth'; o.frequency.setValueAtTime(type === 'awaken' ? 220 : 150, now); o.frequency.exponentialRampToValueAtTime(type === 'awaken' ? 920 : 28, now + 0.72);
            g.gain.setValueAtTime(0.35, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
            o.connect(g); g.connect(svAudio.destination); o.start(now); o.stop(now + 0.76);
          } else if (type === 'win') {
            [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
              const o = svAudio.createOscillator(), g = svAudio.createGain();
              o.type = 'triangle'; o.frequency.setValueAtTime(f, now + i * 0.08);
              g.gain.setValueAtTime(0.2, now + i * 0.08); g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
              o.connect(g); g.connect(svAudio.destination); o.start(now + i * 0.08); o.stop(now + i * 0.08 + 0.26);
            });
          } else {
            const o = svAudio.createOscillator(), g = svAudio.createGain();
            o.type = 'square'; o.frequency.setValueAtTime(320, now); o.frequency.exponentialRampToValueAtTime(65, now + 0.16);
            g.gain.setValueAtTime(0.22, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            o.connect(g); g.connect(svAudio.destination); o.start(now); o.stop(now + 0.19);
          }
        } catch (e) {}
      }
    `;
    // ============================================================================
    // 🎬 SAMMUVERSE V4 ENGINE — PIECE 16/20: CINEMA-GRADE 6-PHASE CUTSCENES
    // ============================================================================
    const SV_CLIENT_JS_PART2 = `
      window.skipSvCutscene = function() {
        if (cutAnimId) { cancelAnimationFrame(cutAnimId); cutAnimId = null; }
        if (cutTimeout) { clearTimeout(cutTimeout); cutTimeout = null; }
        const box = document.getElementById('svCutsceneBox');
        if (box) box.style.transform = 'none';
        const ov = document.getElementById('svCutsceneOverlay');
        if (ov) ov.style.display = 'none';
      };

      function playBloxFruitCutscene(data) {
        window.skipSvCutscene();
        const ov = document.getElementById('svCutsceneOverlay');
        const box = document.getElementById('svCutsceneBox');
        const c = document.getElementById('svCutsceneCanvas');
        const cap = document.getElementById('svCutsceneCaption');
        if (!ov || !c) return;

        ov.style.display = 'flex';
        cap.textContent = data.caption || '⚡ ULTIMATE TECHNIQUE!';
        playSvSfx(data.sfx || 'ult');

        const ctx = c.getContext('2d');
        const theme = data.theme || 'vishwaroopa';
        const paletteMap = {
          fire:        { c1: '#450a0a', c2: '#ea580c', pCol: '#fbbf24', rune: '炎' },
          water:       { c1: '#082f49', c2: '#0284c7', pCol: '#7dd3fc', rune: '水' },
          lightning:   { c1: '#1e1b4b', c2: '#ca8a04', pCol: '#fef08a', rune: '雷' },
          ice:         { c1: '#083344', c2: '#06b6d4', pCol: '#cffafe', rune: '氷' },
          zoro:        { c1: '#022c22', c2: '#15803d', pCol: '#4ade80', rune: '鬼' },
          moon:        { c1: '#1e1b4b', c2: '#be123c', pCol: '#fda4af', rune: '月' },
          chakra:      { c1: '#1e1b4b', c2: '#b45309', pCol: '#fde047', rune: '神' },
          bansuri:     { c1: '#064e3b', c2: '#0369a1', pCol: '#6ee7b7', rune: '愛' },
          milly:       { c1: '#450a0a', c2: '#eab308', pCol: '#fef08a', rune: '王' },
          awaken:      { c1: '#422006', c2: '#dc2626', pCol: '#fde047', rune: '極' },
          vishwaroopa: { c1: '#090d16', c2: '#7e22ce', pCol: '#e879f9', rune: '宇宙' }
        };
        const pal = paletteMap[theme] || paletteMap.vishwaroopa;

        // 120 high-velocity physics particles + orbiting energy sparks
        const particles = Array.from({ length: 120 }, () => {
          const ang = Math.random() * Math.PI * 2;
          const spd = Math.random() * 7.2 + 1.8;
          return {
            x: 210, y: 130,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            r: Math.random() * 4.5 + 1.2,
            alpha: 1
          };
        });

        let frame = 0;
        function drawFrame() {
          frame++;
          ctx.clearRect(0, 0, 420, 260);

          // Phase 1 (Frames 1-8): Manga Black-and-White Impact Strobe
          if (frame <= 8) {
            ctx.fillStyle = frame % 2 === 0 ? '#ffffff' : '#03050c';
            ctx.fillRect(0, 0, 420, 260);
            ctx.strokeStyle = frame % 2 === 0 ? '#000000' : '#facc15';
            ctx.lineWidth = 5;
            for (let i = 0; i < 40; i++) {
              const a = (i * Math.PI) / 20;
              ctx.beginPath();
              ctx.moveTo(210 + Math.cos(a) * 20, 130 + Math.sin(a) * 20);
              ctx.lineTo(210 + Math.cos(a) * 260, 130 + Math.sin(a) * 260);
              ctx.stroke();
            }
          } else {
            // Phase 2: Swirling Dimensional Vortex & Dual Shockwave Rings
            const grad = ctx.createRadialGradient(210, 130, 8, 210, 130, 235);
            grad.addColorStop(0, pal.c1);
            grad.addColorStop(0.65, pal.c2);
            grad.addColorStop(1, '#02040a');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 420, 260);

            // Rotating Anime Speed Lines
            ctx.strokeStyle = 'rgba(255,255,255,0.26)';
            ctx.lineWidth = 2;
            for (let i = 0; i < 36; i++) {
              const ang = (i * Math.PI / 18) + (frame * 0.065);
              const inner = 38 + Math.sin(frame * 0.18) * 12;
              ctx.beginPath();
              ctx.moveTo(210 + Math.cos(ang) * inner, 130 + Math.sin(ang) * inner);
              ctx.lineTo(210 + Math.cos(ang) * 260, 130 + Math.sin(ang) * 260);
              ctx.stroke();
            }

            // Dual Expanding Shockwave Rings
            [0, 80].forEach(offset => {
              const ringR = (((frame * 8) + offset) % 200) + 18;
              ctx.strokeStyle = pal.pCol;
              ctx.lineWidth = 3.5;
              ctx.globalAlpha = Math.max(0, 1 - ringR / 215);
              ctx.beginPath();
              ctx.arc(210, 130, ringR, 0, Math.PI * 2);
              ctx.stroke();
            });
            ctx.globalAlpha = 1;

            // Phase 3: Floating Giant Anime Kanji Watermark
            ctx.save();
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.font = '900 135px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pal.rune, 210, 132);
            ctx.restore();

            // Custom Elemental Centerpiece VFX
            if (theme === 'chakra') {
              ctx.save();
              ctx.translate(210, 130);
              ctx.rotate(frame * 0.36);
              ctx.strokeStyle = '#fde047';
              ctx.lineWidth = 6;
              ctx.beginPath();
              ctx.arc(0, 0, 56, 0, Math.PI * 2);
              ctx.stroke();
              for (let k = 0; k < 18; k++) {
                const a = (k * Math.PI) / 9;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a) * 56, Math.sin(a) * 56);
                ctx.lineTo(Math.cos(a + 0.24) * 84, Math.sin(a + 0.24) * 84);
                ctx.stroke();
              }
              ctx.restore();
            } else if (theme === 'zoro') {
              ctx.strokeStyle = '#4ade80';
              ctx.lineWidth = 8;
              ctx.shadowColor = '#22c55e';
              ctx.shadowBlur = 18;
              ctx.beginPath(); ctx.moveTo(25, 30); ctx.lineTo(395, 225); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(395, 30); ctx.lineTo(25, 225); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(210, 15); ctx.lineTo(210, 240); ctx.stroke();
              ctx.shadowBlur = 0;
            } else if (theme === 'lightning') {
              ctx.strokeStyle = '#fef08a';
              ctx.lineWidth = 4;
              for (let b = 0; b < 5; b++) {
                ctx.beginPath();
                let lx = 60 + b * 75, ly = 0;
                ctx.moveTo(lx, ly);
                for (let s = 0; s < 6; s++) {
                  lx += (Math.random() - 0.5) * 50;
                  ly += 44;
                  ctx.lineTo(lx, ly);
                }
                ctx.stroke();
              }
            }

            // Center Emoji Zoom + Aura Halo
            ctx.font = '66px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const zoom = Math.min(1.35, 0.45 + frame * 0.035) + Math.sin(frame * 0.35) * 0.12;
            ctx.save();
            ctx.translate(210, 128);
            ctx.scale(zoom, zoom);
            ctx.fillText(data.emoji || '⚡', 0, 0);
            ctx.restore();

            // Phase 4: 120-Particle Physics Explosion (after frame 20)
            if (frame > 20) {
              particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.07;
                p.alpha = Math.max(0, p.alpha - 0.013);
                ctx.fillStyle = pal.pCol;
                ctx.globalAlpha = p.alpha;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
              });
              ctx.globalAlpha = 1;
            }
          }

          // Phase 5: Letterbox Cinema Bars
          const barH = Math.min(22, frame * 2);
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, 420, barH);
          ctx.fillRect(0, 260 - barH, 420, barH);

          // Phase 6: Camera Shake & Chromatic Flash on Impact (Frames 44-62)
          if (box && frame >= 44 && frame <= 62) {
            const dx = (Math.random() - 0.5) * 16;
            const dy = (Math.random() - 0.5) * 16;
            box.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
          } else if (box) {
            box.style.transform = 'none';
          }
          if (frame === 46 || frame === 47) {
            ctx.fillStyle = 'rgba(255,255,255,0.92)';
            ctx.fillRect(0, 0, 420, 260);
          }

          // Comic Title Slam Banner
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 5;
          ctx.font = '900 20px Impact, sans-serif';
          ctx.textAlign = 'center';
          const title = (data.title || 'COSMIC IMPACT!').toUpperCase();
          ctx.strokeText(title, 210, 232);
          ctx.fillText(title, 210, 232);

          cutAnimId = requestAnimationFrame(drawFrame);
        }

        drawFrame();
        cutTimeout = setTimeout(window.skipSvCutscene, 2700);
      }
    `;
    // ============================================================================
    // 🎮 SAMMUVERSE V4 ENGINE — PIECE 17A/20: TABS, STORY MAP & POWER GRID
    // ============================================================================
    const SV_CLIENT_JS_PART3A = `
      const ADV_CHAPTERS_UI = [
        { ch: 1, title: '🌲 Ch.1: Whispering Dojo',   stages: ['🥷 Rogue Disciple', '🐺 Shadow Wolf', '👹 Dojo Sensei Boss'],     reward: '350🪙 • 200⚡ • 15🔮' },
        { ch: 2, title: '🌋 Ch.2: Crimson Volcano',   stages: ['🦎 Magma Salamander', '🔥 Flame Knight', '🐉 Magma Wyrm Boss'],     reward: '700🪙 • 450⚡ • 30🔮' },
        { ch: 3, title: '🌊 Ch.3: Abyssal Trench',    stages: ['🦈 Depth Stalker', '🐙 Kraken Tentacle', '🌊 Leviathan Boss'],      reward: '1.2k🪙 • 800⚡ • 50🔮' },
        { ch: 4, title: '⚡ Ch.4: Celestial Citadel', stages: ['🦅 Sky Valkyrie', '⚡ Thunder Golem', '👑 Raijin Sovereign Boss'],  reward: '2.2k🪙 • 1.4k⚡ • 80🔮' },
        { ch: 5, title: '🌌 Ch.5: Void Throne',       stages: ['🌑 Void Phantom', '🕳️ Singularity Knight', '🔱 Abyssal God Boss'],  reward: '5.0k🪙 • 3.0k⚡ • 150🔮' }
      ];

      window.openSammuVerseModal = function() {
        const mod = document.getElementById('svModal');
        if (!mod) return;
        mod.style.display = 'flex';
        renderSvPowers();
        renderAdventureMap();
        renderTrainingPanel();
        renderDojoShop();
        refreshOpponentDropdown();
        if (typeof socket !== 'undefined') {
          socket.emit('svGetStats');
          socket.emit('svRequestLogs');
        }
      };

      window.switchSvTab = function(tab) {
        ['fight', 'adv', 'train', 'dojo', 'logs'].forEach(t => {
          const tabBtn = document.getElementById('svTab' + t.charAt(0).toUpperCase() + t.slice(1));
          const panel = document.getElementById('sv' + t.charAt(0).toUpperCase() + t.slice(1) + 'Panel');
          if (tabBtn) tabBtn.classList.toggle('active', tab === t);
          if (panel) panel.style.display = tab === t ? 'block' : 'none';
        });
        if (tab === 'logs' && typeof socket !== 'undefined') socket.emit('svRequestLogs');
        if (tab === 'adv') renderAdventureMap();
        if (tab === 'train') renderTrainingPanel();
        if (tab === 'dojo') renderDojoShop();
      };

      function renderAdventureMap() {
        const box = document.getElementById('svAdventureChaptersList');
        const sum = document.getElementById('svAdvSummary');
        if (!box) return;
        const adv = myProfile.adventure || { chapter: 1, stage: 1, cleared: false };
        if (sum) {
          sum.textContent = (adv.cleared ? '👑 ALL 5 CHAPTERS CLEARED!' : ('Progress: Chapter ' + adv.chapter + ' — Stage ' + adv.stage + '/3')) + ' | Pet Essence: ' + (myProfile.petEssence || 0) + ' 🔮';
        }
        box.innerHTML = ADV_CHAPTERS_UI.map(c => {
          const unlocked = adv.cleared || adv.chapter >= c.ch;
          const isCur = !adv.cleared && adv.chapter === c.ch;
          const curStg = isCur ? adv.stage : (adv.chapter > c.ch || adv.cleared ? 3 : 1);
          const foeName = c.stages.at(curStg - 1) || c.stages.at(0);
          return '<div class="sv-shop-card" style="border-color:' + (isCur ? '#4ade80' : (unlocked ? '#38bdf8' : '#334155')) + ';">' +
            '<div><b style="color:' + (unlocked ? '#fde047' : '#94a3b8') + ';">' + c.title + '</b><br>' +
            '<span style="color:#cbd5e1;">' + (unlocked ? ('Stage ' + curStg + '/3: ' + foeName + ' • ' + c.reward) : '🔒 Clear Chapter ' + (c.ch - 1) + ' first') + '</span></div>' +
            '<button ' + (unlocked ? '' : 'disabled') + ' onclick="socket.emit(\\'svStartAdventure\\',{ch:' + c.ch + ',stg:' + curStg + ',power:selectedPower})" style="background:' + (isCur ? '#16a34a' : (unlocked ? '#0284c7' : '#334155')) + ';border:none;color:#fff;padding:6px 10px;border-radius:8px;font-weight:900;cursor:pointer;">' + (unlocked ? '⚔️ Play' : '🔒') + '</button></div>';
        }).join('');
      }

      function renderSvPowers() {
        const grid = document.getElementById('svPowerGrid');
        if (!grid) return;
        grid.innerHTML = '';

        const unlocked = myProfile.unlockedPowers || [];
        const pWins = myProfile.powerWins || {};

        if (Array.isArray(myProfile.customPowers)) {
          myProfile.customPowers.forEach(cp => {
            if (cp && cp.id && cp.def && !SV_POWERS[cp.id]) {
              SV_POWERS[cp.id] = {
                fused: true, icon: cp.def.icon, name: cp.def.name,
                skills: (cp.def.moves || []).map(m => m.label)
              };
            }
          });
        }

        Object.entries(SV_POWERS).forEach(([key, p]) => {
          if (p.secret && !unlocked.includes(key)) return;
          const isCoinLocked = p.cost && !unlocked.includes(key);
          const wins = pWins[key] || 0;
          const isV3 = wins >= 100;
          const isV2 = wins >= 5 && !isV3;

          const b = document.createElement('button');
          b.className = 'sv-pwr-btn' + (selectedPower === key ? ' selected' : '') + (isCoinLocked ? ' locked-coin' : '');
          if (p.secret || isV2 || isV3) b.style.borderColor = '#facc15';
          if (isV3) b.style.boxShadow = '0 0 10px rgba(250,204,21,0.55)';

          const verBadge = isV3 ? ' [V3 👑]' : (isV2 ? ' [V2]' : '');
          b.textContent = isCoinLocked ? ('🔒 ' + p.icon + ' ' + p.name + ' (' + p.cost + '🪙)') : (p.icon + ' ' + p.name + verBadge);

          b.onclick = () => {
            if (isCoinLocked) {
              if (confirm('Unlock ' + p.icon + ' ' + p.name + ' for ' + p.cost + ' Coins?')) socket.emit('svBuyPower', key);
              return;
            }
            selectedPower = key; window._curSvPow = key; renderSvPowers();
          };
          grid.appendChild(b);
        });

        const cur = SV_POWERS[selectedPower] || SV_POWERS.fire;
        const curWins = pWins[selectedPower] || 0;
        const verDesc = curWins >= 100 ? ' 👑 [V3 ASCENDED]' : (curWins >= 5 ? (' 🔥 [V2] (' + curWins + '/100 to V3)') : (' (' + curWins + '/5 wins to V2)'));
        const prev = document.getElementById('svPowerPreview');
        if (prev) prev.innerHTML = '<b>' + cur.icon + ' ' + cur.name + verDesc + ':</b><br>' + cur.skills.join(' • ');
      }
    `;
    // ============================================================================
    // 🎮 SAMMUVERSE V4 ENGINE — PIECE 17B/20: TRAINING & DOJO SHOP RENDERERS
    // ============================================================================
    const SV_CLIENT_JS_PART3B = `
      function renderTrainingPanel() {
        const tr = myProfile.training || { fistLv: 0, bodyLv: 0, chiLv: 0, xp: 0 };
        const fLv = Number(tr.fistLv) || 0, bLv = Number(tr.bodyLv) || 0, cLv = Number(tr.chiLv) || 0;
        const sum = document.getElementById('svTrainSummary');
        if (sum) sum.textContent = 'Total Mastery: ' + (fLv + bLv + cLv).toLocaleString() + ' | Available XP: ' + (tr.xp || 0).toLocaleString() + ' ⚡';

        const bonusDmg = fLv >= 100000 ? Math.round(150 + Math.log10(fLv) * 45) : Math.min(350, fLv * 3);
        const bonusHp  = bLv >= 100000 ? Math.round(900 + Math.log10(bLv) * 250) : Math.min(2000, bLv * 20);
        const ultPct   = cLv >= 100000 ? 85 : Math.min(80, cLv * 4);
        const critPct  = cLv >= 100000 ? 50 : Math.min(45, cLv);

        const fd = document.getElementById('svFistDesc'); if (fd) fd.textContent = 'Lv.' + fLv.toLocaleString() + ' (+' + bonusDmg + ' Permanent DMG)';
        const bd = document.getElementById('svBodyDesc'); if (bd) bd.textContent = 'Lv.' + bLv.toLocaleString() + ' (+' + bonusHp + ' Permanent HP)';
        const cd = document.getElementById('svChiDesc');  if (cd) cd.textContent = 'Lv.' + cLv.toLocaleString() + ' (+' + ultPct + '% ULT & ' + critPct + '% Crit)';
        const fBtn = document.getElementById('svUpFistBtn'); if (fBtn) fBtn.textContent = (100 + Math.floor(fLv * 25)).toLocaleString() + ' XP';
        const bBtn = document.getElementById('svUpBodyBtn'); if (bBtn) bBtn.textContent = (100 + Math.floor(bLv * 25)).toLocaleString() + ' XP';
        const cBtn = document.getElementById('svUpChiBtn');  if (cBtn) cBtn.textContent = (100 + Math.floor(cLv * 25)).toLocaleString() + ' XP';
      }

      function renderDojoShop() {
        const hc = document.getElementById('svHeaderCoins');
        if (hc) hc.textContent = '🪙 ' + (myProfile.coins || 0).toLocaleString();
        const rb = document.getElementById('svRankBanner');
        if (rb) rb.textContent = 'Wins: ' + (myProfile.wins || 0) + ' | Pet Essence: ' + (myProfile.petEssence || 0) + '🔮 | Tower Best: F' + (myProfile.maxTowerFloor || 1);

        const omBtn = document.getElementById('svGearOmegaBtn');
        if (omBtn) { omBtn.textContent = myProfile.gears?.omegaCore ? 'FORGED ✅' : '10,000🪙'; omBtn.disabled = Boolean(myProfile.gears?.omegaCore); }
        const tiBtn = document.getElementById('svGearTitanBtn');
        if (tiBtn) { tiBtn.textContent = myProfile.gears?.titanCrown ? 'FORGED ✅' : '25,000🪙'; tiBtn.disabled = Boolean(myProfile.gears?.titanCrown); }

        document.getElementById('svAtkDesc').textContent = 'Lv.' + (myProfile.atkLv || 0) + '/15 (+' + ((myProfile.atkLv || 0) * 5) + ' Bonus DMG)';
        document.getElementById('svBuyAtkBtn').textContent = (myProfile.atkLv || 0) >= 15 ? 'MAX' : '150🪙';
        document.getElementById('svHpDesc').textContent = 'Lv.' + (myProfile.hpLv || 0) + '/15 (+' + ((myProfile.hpLv || 0) * 25) + ' Bonus HP)';
        document.getElementById('svBuyHpBtn').textContent = (myProfile.hpLv || 0) >= 15 ? 'MAX' : '150🪙';
        document.getElementById('svBuyStoneBtn').textContent = myProfile.hasStone ? 'OWNED ✅' : '1000🪙';
        document.getElementById('svBuyStoneBtn').disabled = Boolean(myProfile.hasStone);

        const list = Array.isArray(myProfile.customPowers) ? myProfile.customPowers : [];
        const tiers = new Array(50000, 250000, 750000, 1500000);
        const nextCost = list.length < tiers.length ? tiers.at(list.length) : (tiers.at(-1) + ((list.length - tiers.length + 1) * 1000000));
        const fBtn = document.getElementById('svForgeBtn');
        if (fBtn) {
          fBtn.textContent = (myProfile.freeFusionPasses || 0) > 0
            ? ('⚗️ Forge Fusion #' + (list.length + 1) + ' (FREE PASS ✅)')
            : ('⚗️ Forge Fusion #' + (list.length + 1) + ' (' + nextCost.toLocaleString() + '🪙)');
        }

        const s1 = document.getElementById('svFuseP1'), s2 = document.getElementById('svFuseP2');
        if (s1 && s2 && s1.options.length === 0) {
          const owned = new Set(['fire', 'water', 'lightning', 'ice', ...(myProfile.unlockedPowers || [])]);
          Object.entries(SV_POWERS).forEach(([k, v]) => {
            if (owned.has(k)) { s1.add(new Option(v.icon + ' ' + v.name, k)); s2.add(new Option(v.icon + ' ' + v.name, k)); }
          });
          if (s2.options.length > 1) s2.selectedIndex = 1;
        }

        const cBtn = document.getElementById('svMergeChimeraBtn');
        if (cBtn && (myProfile.ownedPets || []).includes('chimera')) { cBtn.textContent = 'EVOLVED ✅'; cBtn.disabled = true; }
        const oBtn = document.getElementById('svMergeOuroBtn');
        if (oBtn && (myProfile.ownedPets || []).includes('ouroboros')) { oBtn.textContent = 'EVOLVED ✅'; oBtn.disabled = true; }

        const petBox = document.getElementById('svPetShopList');
        if (!petBox) return;
        petBox.innerHTML = '';
        SV_PETS.forEach(pet => {
          const owned = (myProfile.ownedPets || []).includes(pet.id);
          if (pet.evolved && !owned) return;
          const active = myProfile.activePet === pet.id;
          const row = document.createElement('div');
          row.className = 'sv-shop-card';
          row.innerHTML = '<div><b>' + pet.name + '</b><br><span style="color:#cbd5e1;">' + pet.desc + '</span></div>';
          const btn = document.createElement('button');
          btn.style.cssText = 'background:' + (active ? '#16a34a' : (owned ? '#0284c7' : '#7c3aed')) + ';border:none;color:#fff;padding:6px 10px;border-radius:8px;font-weight:900;cursor:pointer;';
          btn.textContent = active ? 'EQUIPPED ✅' : (owned ? 'EQUIP' : pet.cost + '🪙');
          btn.onclick = () => socket.emit('svPetAction', pet.id);
          row.appendChild(btn);
          petBox.appendChild(row);
        });
      }
    `;
    // ============================================================================
    // 🎡 SAMMUVERSE V4 ENGINE — PIECE 18A/20: LINEAGES, TITLES & DAILY WHEEL UI
    // ============================================================================
    const SV_CLIENT_JS_PART4A = `
      const LINEAGE_UI_INFO = {
        human:     { icon: '🧑', name: 'Mortal Explorer',       stage3: '👑 Ascendant Hero',       perk: 'Balanced Starter' },
        slime:     { icon: '🟢', name: 'Primordial Void Slime', stage3: '🟢 Void Sovereign Slime', perk: '+14 HP/Turn Regen & 12% DMG Absorb' },
        ape:       { icon: '🐵', name: 'Astral Ape Warrior',    stage3: '⚡ Super Astral God',     perk: '+22% Surge Strike DMG' },
        reaper:    { icon: '👻', name: 'Phantom Soul Reaper',   stage3: '⚔️ Eclipse Bankai',       perk: '+18% Slash DMG & 5% Soul Drain' },
        demon:     { icon: '😈', name: 'Infernal Demonkin',     stage3: '🔥 Abyssal Overlord',     perk: '+10% DMG & 16% Lifesteal' },
        dragonkin: { icon: '🐉', name: 'Ancient Dragonkin',     stage3: '🐲 Cosmic Wyrm King',     perk: '+8 HP/Turn, +15% DMG & 8% Absorb' },
        celestial: { icon: '🔱', name: 'Celestial Avatar',      stage3: '🔱 Supreme Cosmic Deity', perk: '+25% DMG, +12 HP/Turn, Stun Immune' }
      };

      const TITLE_UI_LIST = [
        { id: 'rookie',     tag: '🌱 Rookie',           color: '#94a3b8', req: 'Default Starter' },
        { id: 'hunter',     tag: '⚔️ Bounty Hunter',    color: '#38bdf8', req: '1.0M Bounty' },
        { id: 'warlord',    tag: '🏴‍☠️ Warlord',          color: '#a855f7', req: '2.5M Bounty' },
        { id: 'emperor',    tag: '💀 Abyss Emperor',    color: '#f43f5e', req: '10.0M Bounty' },
        { id: 'sovereign',  tag: '👑 Sammu Sovereign',  color: '#facc15', req: '30.0M Bounty' },
        { id: 'v3god',      tag: '🔥 V3 Ascended',      color: '#fb923c', req: '100 Wins (V3)' },
        { id: 'omegagod',   tag: '⚡ Omega Awakened',   color: '#38bdf8', req: 'Omega Core Gear' },
        { id: 'titanlord',  tag: '🌌 Colossal Titan',   color: '#f43f5e', req: 'Titan Crown Gear' },
        { id: 'adventurer', tag: '🗺️ Realm Conqueror',  color: '#4ade80', req: 'Clear Story Ch.5' },
        { id: 'petmaster',  tag: '🐉 Ouroboros Tamer',  color: '#e879f9', req: 'Merge Evolved Pet' },
        { id: 'voidslime',  tag: '🟢 Void Slime King',  color: '#4ade80', req: 'Void Slime Stage 3' },
        { id: 'gymgod',     tag: '🏋️ Gym Sovereign',    color: '#fb923c', req: 'Training Level 50' },
        { id: 'godly',      tag: '✨ Godly Enchanted',  color: '#67e8f9', req: 'Godly Enchant' },
        { id: 'forger',     tag: '⚗️ Soul Forger',      color: '#e879f9', req: 'Custom Fusion' },
        { id: 'vishnu',     tag: '🔱 MahaVishnu',       color: '#fde047', req: 'MahaVishnu Power' },
        { id: 'lunaremp',   tag: '🌙 Lunar Empress',    color: '#fda4af', req: 'Dr. Moon Power' },
        { id: 'tower25',    tag: '🗼 Tower Climber',    color: '#38bdf8', req: 'Tower Floor 25' },
        { id: 'tower50',    tag: '♾️ Infinite Sovereign',color: '#e879f9', req: 'Tower Floor 50' },
        { id: 'tower100',   tag: '🌌 Floor 100 God',    color: '#facc15', req: 'Tower Floor 100' },
        { id: 'rich',       tag: '💎 Millionaire',      color: '#4ade80', req: '100,000+ Coins' }
      ];

      window._svLatestStock = { items: [], minsLeft: 60 };
      window._svTowerTop = [];

      window.openDailyWheelModal = function() {
        const modal = document.getElementById('svSubModal');
        const title = document.getElementById('svSubTitle');
        const body = document.getElementById('svSubBody');
        if (!modal) return;
        modal.style.display = 'flex';
        title.textContent = '🎡 COSMIC DAILY LUCKY WHEEL';
        const freeReady = (Date.now() - (myProfile.lastDailySpin || 0)) >= 86400000;
        body.innerHTML =
          '<div id="svWheelDisc" style="width:170px;height:170px;margin:6px auto 12px;border-radius:50%;border:5px solid #facc15;background:conic-gradient(#dc2626 0deg 60deg,#0284c7 60deg 120deg,#16a34a 120deg 180deg,#7c3aed 180deg 240deg,#d97706 240deg 300deg,#ec4899 300deg 360deg);display:flex;align-items:center;justify-content:center;font-size:38px;box-shadow:0 0 28px rgba(250,204,21,0.6);transition:transform 2.2s cubic-bezier(0.15,0.85,0.25,1);">🎡</div>' +
          '<div id="svWheelResultText" style="font-size:12px;font-weight:900;color:#fde047;margin-bottom:10px;">Win Coins, Training XP, Pet Essence, or 15,000🪙 Jackpot!</div>' +
          '<div style="display:flex;gap:6px;">' +
            '<button onclick="socket.emit(\\'svDailyWheelSpin\\',{paid:false})" style="flex:1;padding:10px;border:none;border-radius:10px;background:' + (freeReady ? '#16a34a' : '#334155') + ';color:#fff;font-weight:900;font-size:11px;cursor:pointer;">🎁 Free Daily Spin</button>' +
            '<button onclick="socket.emit(\\'svDailyWheelSpin\\',{paid:true})" style="flex:1;padding:10px;border:none;border-radius:10px;background:linear-gradient(90deg,#ec4899,#8b5cf6);color:#fff;font-weight:900;font-size:11px;cursor:pointer;">💎 Cosmic Spin (500🪙)</button>' +
          '</div>';
      };
    `;
    // ============================================================================
    // 🎡 SAMMUVERSE V4 ENGINE — PIECE 18B/20: SUB-MODALS, TOWER & HELPERS
    // ============================================================================
    const SV_CLIENT_JS_PART4B = `
      window.openSvSub = function(mode) {
        const modal = document.getElementById('svSubModal');
        const title = document.getElementById('svSubTitle');
        const body = document.getElementById('svSubBody');
        if (!modal) return;
        modal.style.display = 'flex';

        if (mode === 'lineage') {
          const lin = LINEAGE_UI_INFO[myProfile.lineage || 'human'] || LINEAGE_UI_INFO.human;
          const stg = myProfile.lineageStage || 1;
          const evoCost = stg === 1 ? '2,500🪙' : (stg === 2 ? '6,000🪙' : 'MAXED ✅');
          title.textContent = '🧬 GENETIC LINEAGE AWAKENING';
          body.innerHTML =
            '<div style="background:#1e293b;border:1.5px solid #4ade80;border-radius:12px;padding:10px;margin-bottom:8px;">' +
              '<div style="font-size:15px;font-weight:900;color:#4ade80;">' + (stg === 3 ? lin.stage3 : (lin.icon + ' ' + lin.name)) + ' (Stage ' + stg + '/3)</div>' +
              '<div style="font-size:11px;color:#fde047;margin-top:4px;">Passive: ' + lin.perk + '</div>' +
            '</div>' +
            '<div style="display:flex;gap:6px;">' +
              '<button onclick="socket.emit(\\'svSpinLineage\\')" style="flex:1;padding:9px;border:none;border-radius:10px;background:#7c3aed;color:#fff;font-weight:900;font-size:11px;cursor:pointer;">🎲 Reroll (1,000🪙)</button>' +
              '<button ' + (stg >= 3 ? 'disabled' : '') + ' onclick="socket.emit(\\'svEvolveLineage\\')" style="flex:1;padding:9px;border:none;border-radius:10px;background:#16a34a;color:#fff;font-weight:900;font-size:11px;cursor:pointer;">⚡ Evolve (' + evoCost + ')</button>' +
            '</div>';
        } else if (mode === 'titles') {
          const bFmt = (myProfile.bounty || 10000) >= 1000000 ? ((myProfile.bounty / 1000000).toFixed(2) + 'M') : (Math.round((myProfile.bounty || 10000) / 1000) + 'K');
          title.textContent = '🏷️ TITLES & BOUNTY: ' + bFmt;
          body.innerHTML = TITLE_UI_LIST.map(t => {
            const unlocked = (myProfile.unlockedTitles || ['rookie']).includes(t.id);
            const equipped = myProfile.activeTitle === t.id;
            return '<div style="display:flex;justify-content:space-between;align-items:center;background:#1e293b;border:1.5px solid ' + (equipped ? '#facc15' : '#334155') + ';border-radius:10px;padding:7px 9px;margin-bottom:6px;font-size:11px;">' +
              '<div style="text-align:left;"><b style="color:' + t.color + ';">[' + t.tag + ']</b><br><span style="color:#94a3b8;">' + t.req + '</span></div>' +
              '<button ' + (unlocked ? '' : 'disabled') + ' onclick="socket.emit(\\'svEquipTitle\\',\\'' + t.id + '\\');document.getElementById(\\'svSubModal\\').style.display=\\'none\\';" style="background:' + (equipped ? '#16a34a' : (unlocked ? '#0284c7' : '#334155')) + ';border:none;color:#fff;padding:5px 10px;border-radius:8px;font-weight:bold;cursor:pointer;">' + (equipped ? 'EQUIPPED' : (unlocked ? 'Equip' : '🔒')) + '</button></div>';
          }).join('');
        } else if (mode === 'stock') {
          const st = window._svLatestStock;
          title.textContent = '🎰 HOURLY STOCK (' + st.minsLeft + 'm left)';
          socket.emit('svGetStock');
          body.innerHTML = (st.items || []).map(it =>
            '<div style="display:flex;justify-content:space-between;align-items:center;background:#1e293b;border:1px solid #38bdf8;border-radius:10px;padding:8px;margin-bottom:6px;font-size:12px;">' +
            '<span><b>' + it.icon + ' ' + it.name + '</b></span>' +
            '<button onclick="socket.emit(\\'svBuyStockItem\\',\\'' + it.key + '\\')" style="background:#16a34a;border:none;color:#fff;padding:6px 10px;border-radius:8px;font-weight:900;cursor:pointer;">' + it.price.toLocaleString() + '🪙</button></div>'
          ).join('') || '<div style="font-size:12px;color:#94a3b8;">Loading stock...</div>';
        }
      };

      window.openEndlessTowerModal = function() {
        const modal = document.getElementById('svSubModal');
        const title = document.getElementById('svSubTitle');
        const body = document.getElementById('svSubBody');
        if (!modal) return;
        modal.style.display = 'flex';
        if (typeof socket !== 'undefined') socket.emit('svGetTowerLeaderboard');

        const best = myProfile.maxTowerFloor || 1;
        const chk = Math.max(1, myProfile.towerCheckpoint || 1);
        title.textContent = '♾️ ENDLESS ASCENSION TOWER';

        const boardHtml = (window._svTowerTop || []).map((r, i) =>
          '<div style="display:flex;justify-content:space-between;padding:4px 6px;border-bottom:1px solid #334155;">' +
            '<span>' + (i === 0 ? '👑 ' : '#' + (i + 1) + ' ') + r.name + '</span>' +
            '<b style="color:#38bdf8;">Floor ' + r.floor + '</b>' +
          '</div>'
        ).join('') || '<div style="color:#94a3b8;">Be the first to climb!</div>';

        body.innerHTML =
          '<div style="background:#1e293b;border:1.5px solid #38bdf8;border-radius:12px;padding:10px;margin-bottom:8px;">' +
            '<div style="font-size:14px;font-weight:900;color:#fde047;">🏆 Your Best: Floor ' + best + ' | 📍 Checkpoint: Floor ' + chk + '</div>' +
            '<div style="font-size:11px;color:#cbd5e1;margin-top:4px;">F25: +10k🪙 | F50: ⚡ Omega & Titan Gear Forge Unlocked! | F100: +50k🪙</div>' +
          '</div>' +
          '<div style="display:flex;gap:6px;margin-bottom:10px;">' +
            '<button onclick="document.getElementById(\\'svSubModal\\').style.display=\\'none\\';socket.emit(\\'svTowerEnter\\',{startFromCheckpoint:true});" style="flex:2;padding:10px;border:none;border-radius:10px;background:linear-gradient(90deg,#0284c7,#7c3aed);color:#fff;font-weight:900;font-size:12px;cursor:pointer;">🚀 Resume Floor ' + chk + '</button>' +
            '<button onclick="document.getElementById(\\'svSubModal\\').style.display=\\'none\\';socket.emit(\\'svTowerEnter\\',{startFromCheckpoint:false});" style="flex:1;padding:10px;border:1px solid #64748b;border-radius:10px;background:#0f172a;color:#fff;font-weight:bold;font-size:11px;cursor:pointer;">🔄 Floor 1</button>' +
          '</div>' +
          '<div style="background:#090d16;border:1px solid #475569;border-radius:10px;padding:8px;font-size:11px;text-align:left;">' +
            '<div style="font-weight:900;color:#facc15;margin-bottom:4px;">🏅 SERVER TOWER LEADERBOARD:</div>' + boardHtml +
          '</div>';
      };

      function refreshOpponentDropdown() {
        const sel = document.getElementById('svOpponentSelect');
        if (!sel) return;
        const prev = sel.value;
        sel.innerHTML = '<option value="BOT_DUMMY">🥊 Wooden Dummy (+35🪙)</option><option value="BOT_SENSEI">🤖 Bot Sensei (+65🪙)</option><option value="BOT_DEMON">👹 Demon Overlord (+140🪙)</option>';
        latestPlayers.forEach(p => {
          if (typeof socket !== 'undefined' && p.id !== socket.id) {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = '🥷 ' + p.username + ' (PvP +150🪙)';
            sel.appendChild(opt);
          }
        });
        if (Array.from(sel.options).some(o => o.value === prev)) sel.value = prev;
      }

      window.buySvItem = (item) => { if (typeof socket !== 'undefined') socket.emit('svUpgradeStat', item); };
      window.sendSvChallenge = () => { if (typeof socket !== 'undefined') socket.emit('svChallenge', { targetId: document.getElementById('svOpponentSelect').value, power: selectedPower }); };
      window.redeemSvSecretCode = () => {
        const inp = document.getElementById('svSecretCodeInput');
        if (inp && inp.value.trim() && typeof socket !== 'undefined') {
          socket.emit('svUnlockCode', inp.value.trim());
          inp.value = '';
        }
      };
    `;
    // ============================================================================
    // 🚀 SAMMUVERSE V4 ENGINE — PIECE 19/20: BATTLE HUD, WHEEL & TRANSFORM BUTTONS
    // ============================================================================
    const SV_CLIENT_JS_PART5 = `
      socket.on('svCutscene', (d) => {
        if (!d._serverId || !window.selectedServerId || d._serverId === window.selectedServerId) {
          playBloxFruitCutscene(d);
        }
      });

      socket.on('svStatsSync', (st) => {
        if (st) {
          myProfile = st;
          window._latestSvProf = st;
          renderSvPowers();
          renderAdventureMap();
          renderTrainingPanel();
          renderDojoShop();
        }
      });

      socket.on('svWheelResult', ({ prize, profile }) => {
        if (profile) { myProfile = profile; window._latestSvProf = profile; renderDojoShop(); }
        const disc = document.getElementById('svWheelDisc');
        const txt = document.getElementById('svWheelResultText');
        if (disc) disc.style.transform = 'rotate(' + (1440 + ((prize?.idx || 0) * 60)) + 'deg)';
        playSvSfx('win');
        setTimeout(() => {
          if (txt && prize) txt.textContent = '🎉 WON: ' + prize.label;
        }, 2200);
      });

      socket.on('svNotice', (msg) => { playSvSfx('win'); alert(msg); });
      socket.on('svStockSync', (st) => { if (st) window._svLatestStock = st; });
      socket.on('svTowerLeaderboardSync', (list) => { window._svTowerTop = list || []; });
      socket.on('updatePlayers', (list) => { if (Array.isArray(list)) { latestPlayers = list; refreshOpponentDropdown(); } });

      socket.on('svDomainClashStart', (d) => {
        const sub = document.getElementById('svClashSub');
        const mod = document.getElementById('svDomainClashModal');
        if (sub) sub.textContent = 'Clashing Ultimates against ' + (d.oppName || 'Rival') + '!';
        if (mod) mod.style.display = 'flex';
      });

      socket.on('svDomainClashEnd', () => {
        const mod = document.getElementById('svDomainClashModal');
        if (mod) mod.style.display = 'none';
      });

      socket.on('svIncomingChallenge', (d) => {
        if (d._serverId && window.selectedServerId && d._serverId !== window.selectedServerId) return;
        document.getElementById('svModal').style.display = 'flex';
        switchSvTab('fight');
        const box = document.getElementById('svIncomingBox');
        box.style.display = 'block';
        box.innerHTML = '<div style="font-size:12px;font-weight:900;color:#fde047;margin-bottom:6px;">⚔️ ' + d.fromName + ' (' + d.fromPowerLabel + ') challenged you!</div>' +
          '<button id="svAcceptBtnNow" style="background:#16a34a;border:none;color:#fff;padding:7px 14px;border-radius:9px;font-weight:900;font-size:12px;cursor:pointer;">🔥 Accept with Selected Power!</button>';
        document.getElementById('svAcceptBtnNow').onclick = () => {
          box.style.display = 'none';
          socket.emit('svAccept', { challengerId: d.fromId, power: selectedPower });
        };
      });

      socket.on('svBattleSync', (b) => {
        if (b._serverId && window.selectedServerId && b._serverId !== window.selectedServerId) return;
        if (b.sfx) playSvSfx(b.sfx);
        document.getElementById('svModal').style.display = 'flex';
        document.getElementById('svLobbyView').style.display = 'none';
        document.getElementById('svBattleView').style.display = 'block';

        document.getElementById('svTurnBadge').textContent = 'Turn ' + b.turn + ' • Energy: ' + (b.me.energy || 0) + '%⚡';
        document.getElementById('svBattleTimer').textContent = '⏳ ' + b.timeLeft + 's';
        document.getElementById('svMeLabel').textContent = b.me.icon + ' ' + b.me.name + ' (' + b.me.powerName + ')';
        document.getElementById('svMeHpText').textContent = b.me.hp + ' / ' + b.me.maxHp + ' HP';
        const meBar = document.getElementById('svMeHpBar');
        meBar.style.width = Math.max(0, Math.round((b.me.hp / b.me.maxHp) * 100)) + '%';
        meBar.classList.toggle('awakened', Boolean(b.me.awakened || b.me.omegaTurns > 0 || b.me.titanTurns > 0));

        document.getElementById('svOppLabel').textContent = b.opp.icon + ' ' + b.opp.name + ' (' + b.opp.powerName + ')';
        document.getElementById('svOppHpText').textContent = b.opp.hp + ' / ' + b.opp.maxHp + ' HP';
        const oppBar = document.getElementById('svOppHpBar');
        oppBar.style.width = Math.max(0, Math.round((b.opp.hp / b.opp.maxHp) * 100)) + '%';
        oppBar.classList.toggle('awakened', Boolean(b.opp.awakened));

        const tBar = document.getElementById('svTransformBar');
        if (tBar) {
          tBar.innerHTML = '';
          if (b.me.hasOmegaGear && !b.me.omegaUsed) {
            const oBtn = document.createElement('button');
            oBtn.disabled = (b.me.energy || 0) < 50;
            oBtn.style.cssText = 'flex:1;padding:6px;border:1.5px solid #38bdf8;border-radius:9px;background:linear-gradient(90deg,#0284c7,#6366f1);color:#fff;font-weight:900;font-size:10px;cursor:pointer;opacity:' + ((b.me.energy || 0) >= 50 ? '1' : '0.45') + ';';
            oBtn.textContent = '⚡ OMEGA EVOLVE (50%⚡)';
            oBtn.onclick = () => socket.emit('svTransform', 'omega');
            tBar.appendChild(oBtn);
          }
          if (b.me.hasTitanGear && !b.me.titanUsed) {
            const tiBtn = document.createElement('button');
            tiBtn.disabled = (b.me.energy || 0) < 75;
            tiBtn.style.cssText = 'flex:1;padding:6px;border:1.5px solid #facc15;border-radius:9px;background:linear-gradient(90deg,#dc2626,#9333ea);color:#fff;font-weight:900;font-size:10px;cursor:pointer;opacity:' + ((b.me.energy || 0) >= 75 ? '1' : '0.45') + ';';
            tiBtn.textContent = '🌌 TITAN FORM (75%⚡)';
            tiBtn.onclick = () => socket.emit('svTransform', 'titan');
            tBar.appendChild(tiBtn);
          }
        }

        document.getElementById('svCombatFeed').innerHTML = b.logText;
        const skBox = document.getElementById('svSkillButtons');
        skBox.innerHTML = '';

        b.me.skills.forEach((sk, idx) => {
          const btn = document.createElement('button');
          btn.className = 'sv-skill-btn' + (idx === 3 ? ' ult' : '');
          const onCd = (idx === 3 && b.me.ultCd > 0);
          btn.disabled = b.me.locked || b.me.stunned || onCd;
          btn.textContent = onCd ? (sk + ' [CD: ' + b.me.ultCd + 't]') : (b.me.stunned ? '❄️ STUNNED!' : sk);
          btn.onclick = () => {
            playSvSfx(idx === 3 ? 'ult' : (idx === 2 ? 'shield' : (b.me.powerKey === 'mahavishnu' && idx === 0 ? 'flute' : 'atk')));
            socket.emit('svUseSkill', idx);
          };
          skBox.appendChild(btn);
        });

        const isVishnu = b.me.powerKey === 'mahavishnu' || String(b.me.icon || '').includes('🔱');
        if (isVishnu && !b.me.isBotOpp) {
          const loveBtn = document.createElement('button');
          loveBtn.className = 'sv-skill-btn';
          loveBtn.style.cssText = 'grid-column:span 2;background:linear-gradient(90deg,#be185d,#9333ea);border:1.5px solid #f9a8d4;text-align:center;';
          loveBtn.textContent = '💖🪈 Prem Samarpan (Surrender to Love — Gift Sibling Win + 250🪙)';
          loveBtn.onclick = () => socket.emit('svSurrenderToLove');
          skBox.appendChild(loveBtn);
        }
      });

      socket.on('svBattleEnd', (res) => {
        if (res._serverId && window.selectedServerId && res._serverId !== window.selectedServerId) return;
        if (res.won) playSvSfx('win');
        document.getElementById('svBattleView').style.display = 'none';
        document.getElementById('svLobbyView').style.display = 'block';
        socket.emit('svGetStats');
        switchSvTab('logs');
      });

      socket.on('svLogsUpdate', (logs) => {
        const box = document.getElementById('svLogList');
        if (!box) return;
        if (!Array.isArray(logs) || logs.length === 0) {
          box.innerHTML = '<div style="padding:12px;color:#94a3b8;">No SammuVerse battles registered yet! ⚔️</div>';
          return;
        }
        box.innerHTML = logs.map(l => '<div class="sv-log-item">🏆 <b>' + l.winner + '</b> (' + l.winPower + ') defeated <b>' + l.loser + '</b> (' + l.losePower + ') <span style="color:#94a3b8;float:right;">' + l.time + '</span></div>').join('');
      });
    `;
    // ============================================================================
    // 🚀 SAMMUVERSE V4 ENGINE — PIECE 20/20: BOOTLOADER & SERVER BUNDLE DELIVERY
    // ============================================================================
    const SV_CLIENT_ALL_JS = [
        SV_CLIENT_JS_PART1,
        SV_CLIENT_JS_PART2,
        SV_CLIENT_JS_PART3A,
        SV_CLIENT_JS_PART3B,
        SV_CLIENT_JS_PART4A,
        SV_CLIENT_JS_PART4B,
        SV_CLIENT_JS_PART5
    ].join('\n');

    const SV_PAGE_BOOT_TAG = `
    <script>
    (function() {
      if (window._svBootLoaded) return;
      window._svBootLoaded = true;

      function initSvBoot() {
        if (typeof socket === 'undefined' || window._svBootSocketHooked) return;
        window._svBootSocketHooked = true;

        socket.on('svDeliverCleanV4', (bundle) => {
          if (bundle && bundle.html && !document.getElementById('svModal')) {
            const wrap = document.createElement('div');
            wrap.innerHTML = bundle.html;
            document.body.appendChild(wrap);
          }
          if (bundle && bundle.js && !window._svV4JsExecuted) {
            window._svV4JsExecuted = true;
            try {
              (new Function(bundle.js))();
            } catch (e) {
              console.error('SammuVerse V4 Boot Error:', e);
            }
          }
          ensureSvArenaBtn();
        });

        function triggerOpenSv() {
          if (typeof window.openSammuVerseModal === 'function') {
            window.openSammuVerseModal();
          } else {
            socket.emit('svRequestCleanV4');
            setTimeout(() => {
              if (typeof window.openSammuVerseModal === 'function') window.openSammuVerseModal();
            }, 350);
          }
        }

        function ensureSvArenaBtn() {
          const existingBanner = Array.from(document.querySelectorAll('div, button, a')).find(el =>
            el.children.length <= 2 && /sammuverse/i.test(el.textContent || '') && el.id !== 'svMainArenaBtn' && !el.closest('#svModal')
          );
          if (existingBanner) {
            if (!existingBanner.dataset.svV4Hooked) {
              existingBanner.dataset.svV4Hooked = '1';
              existingBanner.style.cursor = 'pointer';
              existingBanner.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                triggerOpenSv();
              };
            }
            const dup = document.getElementById('svMainArenaBtn');
            if (dup) dup.remove();
            return;
          }

          if (document.getElementById('svMainArenaBtn')) return;
          const anchor = Array.from(document.querySelectorAll('button')).find(b => /phonk dj|draw pad|disco mode/i.test(b.textContent || ''));
          if (anchor && anchor.parentElement) {
            const btn = anchor.cloneNode(true);
            btn.id = 'svMainArenaBtn';
            btn.removeAttribute('onclick');
            btn.textContent = '⚔️ SammuVerse';
            btn.style.background = 'linear-gradient(90deg, #9333ea, #ec4899)';
            btn.onclick = triggerOpenSv;
            anchor.parentElement.insertBefore(btn, anchor.nextSibling);
          }
        }

        socket.emit('svRequestCleanV4');
        setInterval(ensureSvArenaBtn, 1500);
      }

      window.addEventListener('DOMContentLoaded', initSvBoot);
      setTimeout(initSvBoot, 500);
    })();
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('_svBootLoaded')) {
                body = body.replace('</body>', SV_PAGE_BOOT_TAG + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });

    io.on('connection', (socket) => {
        const deliverV4 = () => {
            socket.emit('svDeliverCleanV4', {
                html: SV_FULL_BUNDLE,
                js: SV_CLIENT_ALL_JS
            });
        };
        socket.on('svRequestCleanV4', deliverV4);
        socket.on('joinRoom', () => setTimeout(deliverV4, 400));
    });
    // ============================================================================
    // ☁️ CLOUD SAVE PROTECTION + !RICHEST & !GIFTCARD RESTORE
    // ============================================================================
    let cloudRestoreCompleted = false;

    const _guardedSaveSvStats = saveSvStats;
    saveSvStats = function() {
        try { fs.writeFileSync(SV_STATS_FILE, JSON.stringify(svPlayerStats, null, 2)); } catch (e) {}
        if (cloudRestoreCompleted && UPSTASH_URL && UPSTASH_TOKEN) {
            upstashCmd(['SET', 'sammu_sv_stats', JSON.stringify(svPlayerStats)]);
        }
    };

    const _guardedSaveEco = saveEconomyDB;
    saveEconomyDB = function() {
        try {
            fs.writeFileSync(ECONOMY_DB_FILE, JSON.stringify({
                wallets: Object.fromEntries(playerWallet),
                cards: Object.fromEntries(playerCards)
            }, null, 2));
        } catch (e) {}
        if (cloudRestoreCompleted && UPSTASH_URL && UPSTASH_TOKEN) {
            upstashCmd(['SET', 'sammu_economy', JSON.stringify({
                wallets: Object.fromEntries(playerWallet),
                cards: Object.fromEntries(playerCards)
            })]);
        }
    };

    async function forcePullFromUpstash() {
        if (!UPSTASH_URL || !UPSTASH_TOKEN) return false;
        const rawStats = await upstashCmd(['GET', 'sammu_sv_stats']);
        if (rawStats) {
            try {
                const parsed = JSON.parse(rawStats);
                Object.entries(parsed).forEach(([k, v]) => {
                    svPlayerStats[k.toLowerCase()] = v;
                    if (Array.isArray(v.customPowers)) {
                        v.customPowers.forEach(cp => { if (cp && cp.id && cp.def) SV_DEFS[cp.id] = cp.def; });
                    }
                });
            } catch (e) {}
        }
        const rawEco = await upstashCmd(['GET', 'sammu_economy']);
        if (rawEco) {
            try {
                const eco = JSON.parse(rawEco);
                if (eco.wallets) Object.entries(eco.wallets).forEach(([k, v]) => playerWallet.set(k.toLowerCase(), Number(v)));
                if (eco.cards) Object.entries(eco.cards).forEach(([k, v]) => playerCards.set(k.toLowerCase(), v));
            } catch (e) {}
        }
        cloudRestoreCompleted = true;
        for (const [, s] of io.sockets.sockets) {
            if (s && s.username) s.emit('svStatsSync', getSvProfile(s.username));
        }
        return true;
    }

    forcePullFromUpstash();

    io.on('connection', (socket) => {
        socket.on('chatMessage', async (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof raw !== 'string') return;
            const clean = raw.trim();
            const low = clean.toLowerCase();
            const sender = socket.username || (payload && payload.username) || 'Player';
            const sKey = sender.toLowerCase();

            // Force reload from Upstash Cloud anytime
            if (low === '/cloudload') {
                const ok = await forcePullFromUpstash();
                socket.emit('message', {
                    username: 'SYSTEM',
                    text: ok
                        ? `☁️✅ **CLOUD RESTORED!** Loaded **${Object.keys(svPlayerStats).length} Profiles** & **${playerWallet.size} Wallets**!`
                        : `❌ **Cloud Load Failed!** Check Upstash env vars.`,
                    _serverId: srvId
                });
            }

            // Richest Players Leaderboard (!richest)
            if (low === '!richest') {
                const top = Array.from(playerWallet.entries())
                    .sort((a, b) => b.at(1) - a.at(1))
                    .slice(0, 5)
                    .map(([n, c], i) => `${i === 0 ? '👑' : `#${i + 1}`} **${n.toUpperCase()}**: **${Number(c).toLocaleString()}🪙**`)
                    .join(' | ');
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `💰 **RICHEST PLAYERS:** ${top || 'No wallets yet!'}`,
                    _serverId: srvId
                });
            }

            // Gift Trading Card (!giftcard @user)
            if (low.startsWith('!giftcard ')) {
                const targetName = clean.slice(10).replace('@', '').trim().split(/\s+/).at(0);
                if (!targetName || targetName.toLowerCase() === sKey) return;
                const deck = playerCards.get(sKey) || [];
                if (deck.length === 0) {
                    return socket.emit('message', { username: "Sammu's Bot", text: '🃏 You have no cards to gift! Type `!pack` first.', _serverId: srvId });
                }
                const gifted = deck.pop();
                playerCards.set(sKey, deck);
                const tKey = targetName.toLowerCase();
                if (!playerCards.has(tKey)) playerCards.set(tKey, []);
                playerCards.get(tKey).push(gifted);
                saveEconomyDB();
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `🎁🃏 **CARD GIFT!** **${sender}** gifted **${gifted.emoji} ${gifted.name}** [${gifted.tier}] to **${targetName}**!`,
                    _serverId: srvId
                });
            }
        });
    });
    // ============================================================================
    // 🏰 5-WAVE ABYSSAL DUNGEON GAUNTLET (!dungeon & BUTTON)
    // ============================================================================
    const DUNGEON_WAVES_V4 = [
        { num: 1, name: '💀 Wave 1/5: Shadow Assassin',     hp: 260,  atk: 12, pKey: 'shadow',     red: 0.05 },
        { num: 2, name: '🔥 Wave 2/5: Inferno Chimera',     hp: 380,  atk: 18, pKey: 'fire',       red: 0.10 },
        { num: 3, name: '⚡ Wave 3/5: Thunder Raijin Lord', hp: 520,  atk: 24, pKey: 'lightning',  red: 0.15 },
        { num: 4, name: '🌑 Wave 4/5: Void Eclipse Titan',  hp: 700,  atk: 30, pKey: 'blackhole',  red: 0.22 },
        { num: 5, name: '👹👑 BOSS 5/5: ABYSSAL OVERLORD',  hp: 1100, atk: 38, pKey: 'antimatter', red: 0.30 }
    ];

    function launchDungeonWaveV4(socket, waveIdx, carryHp) {
        const srvId = socket.activeServerId;
        const uname = socket.username || 'Hero';
        const prof = getSvProfile(uname);
        const w = DUNGEON_WAVES_V4.at(waveIdx);
        const pKey = (prof.customPowers?.at(-1)?.id) || (prof.unlockedPowers?.at(-1)) || 'fire';

        const p1 = buildFighterObj(socket.id, uname, pKey);
        p1.hp = carryHp ? Math.min(p1.maxHp, carryHp + 65) : p1.maxHp;

        const p2 = buildFighterObj('DNG_BOSS', w.name, w.pKey, w.hp, w.atk, true, 'DNG_BOSS');
        p2.def = { ...p2.def, passiveRed: w.red };
        p2.isV2 = waveIdx >= 2;
        p2.isV3 = waveIdx === 4;

        const battleId = 'dng_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const battle = {
            id: battleId, srvId, isDungeon: true, dungeonWave: waveIdx,
            turn: 1, timeLeft: 15,
            lastLog: `🏰 <b>${w.name}</b> appeared! Survive all 5 waves for <b>20,000🪙 + Free Fusion Pass</b>!`,
            p1, p2, interval: null
        };
        svBattles.set(battleId, battle);
        battle.interval = setInterval(() => {
            const cur = svBattles.get(battleId);
            if (!cur) return;
            cur.timeLeft--;
            if (cur.timeLeft <= 0) resolveSvTurn(battleId);
            else syncSvBattle(cur, null);
        }, 1000);
        syncSvBattle(battle, 'ult');
    }

    const _prevFinishSvBattleDng = finishSvBattle;
    finishSvBattle = function(battleId, b) {
        if (!b || !b.isDungeon) return _prevFinishSvBattleDng(battleId, b);

        clearInterval(b.interval);
        svBattles.delete(battleId);
        const p1Won = b.p1.hp > b.p2.hp;
        const pSock = io.sockets.sockets.get(b.p1.id);
        io.to(b.p1.id).emit('svBattleEnd', { won: p1Won, _serverId: b.srvId });

        if (!p1Won || !pSock) {
            io.to(b.srvId).emit('message', {
                username: "Sammu's Bot",
                text: `💀🏰 **DUNGEON DEFEAT!** **${b.p1.name}** fell on **${DUNGEON_WAVES_V4.at(b.dungeonWave).name}**!`,
                _serverId: b.srvId
            });
            return;
        }

        if (b.dungeonWave + 1 < DUNGEON_WAVES_V4.length) {
            const nextW = DUNGEON_WAVES_V4.at(b.dungeonWave + 1);
            io.to(b.p1.id).emit('message', {
                username: "Sammu's Bot",
                text: `⚔️🔥 **WAVE ${b.dungeonWave + 1}/5 CLEARED!** (+65 HP Campfire Heal) Next: **${nextW.name}** in 3s...`,
                _serverId: b.srvId
            });
            setTimeout(() => {
                if (io.sockets.sockets.has(b.p1.id)) launchDungeonWaveV4(pSock, b.dungeonWave + 1, b.p1.hp);
            }, 3000);
        } else {
            const prof = getSvProfile(b.p1.name);
            prof.freeFusionPasses = (prof.freeFusionPasses || 0) + 1;
            prof.petEssence = (prof.petEssence || 0) + 60;
            const bal = addCoins(b.p1.name, 20000);
            syncPlayerTitlesAndBounty(b.p1.name);
            saveSvStats();
            pSock.emit('svStatsSync', getSvProfile(b.p1.name));
            pSock.emit('svNotice', '🏆👹 ABYSSAL DUNGEON CONQUERED! Won +20,000🪙, +60🔮 Essence & 1x FREE FUSION PASS!');
            io.to(b.srvId).emit('message', {
                username: "Sammu's Bot",
                text: `🎊👑 **DUNGEON CONQUERED!!** **${b.p1.name}** slayed all 5 waves & **ABYSSAL OVERLORD**, winning **+20,000🪙** (Total: **${bal.toLocaleString()}🪙**) + **1x FREE FUSION PASS**!`,
                _serverId: b.srvId
            });
        }
    };

    io.on('connection', (socket) => {
        socket.on('svStartDungeon', () => {
            if (!socket.activeServerId || findPlayerActiveSvBattle(socket.id)) {
                return socket.emit('svNotice', '⚠️ Finish your current battle first!');
            }
            launchDungeonWaveV4(socket, 0, null);
        });

        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            if (typeof raw === 'string' && raw.trim().toLowerCase() === '!dungeon' && socket.activeServerId) {
                if (findPlayerActiveSvBattle(socket.id)) {
                    return socket.emit('message', { username: "Sammu's Bot", text: '⚠️ Finish your current SammuVerse fight first!', _serverId: socket.activeServerId });
                }
                launchDungeonWaveV4(socket, 0, null);
            }
        });
    });
    // ============================================================================
    // 💸 FIXED !PAY + 🐉 10-BOSS COSMIC WORLD RAID — PART 1/2
    // ============================================================================
    const WORLD_RAID_BOSSES_V4 = [
        { num: 1,  name: '💀 Boss 1/10: Shadow Stalker',       baseHp: 600,  dmg: 14 },
        { num: 2,  name: '🔥 Boss 2/10: Inferno Ifrit',        baseHp: 900,  dmg: 17 },
        { num: 3,  name: '❄️ Boss 3/10: Frost Leviathan',      baseHp: 1250, dmg: 20 },
        { num: 4,  name: '⚡ Boss 4/10: Raijin Thunder God',   baseHp: 1650, dmg: 23 },
        { num: 5,  name: '🩸 Boss 5/10: Crimson Demon King',   baseHp: 2100, dmg: 26 },
        { num: 6,  name: '🪐 Boss 6/10: Gravity Singularity',  baseHp: 2600, dmg: 29 },
        { num: 7,  name: '⏳ Boss 7/10: Chronos Time Reaper',  baseHp: 3200, dmg: 32 },
        { num: 8,  name: '🌑 Boss 8/10: Shadow Monarch',       baseHp: 3900, dmg: 35 },
        { num: 9,  name: '👹 Boss 9/10: Ten-Tails Jinchuriki', baseHp: 4700, dmg: 38 },
        { num: 10, name: '🌌👑 BOSS 10/10: OMEGA DESTROYER',   baseHp: 6000, dmg: 44 }
    ];

    const worldRaidsV4 = new Map();

    function getRaidDamageV4(uname, isUlt) {
        const prof = getSvProfile(uname);
        const trB = getTrainingBonuses(prof);
        const unlocked = Array.isArray(prof.unlockedPowers) ? prof.unlockedPowers : [];
        const pKey = (prof.customPowers?.at(-1)?.id) || unlocked.at(-1) || 'fire';
        const def = SV_DEFS[pKey] || SV_DEFS.fire;
        const mv = isUlt ? (def.moves.at(3) || def.moves.at(0)) : (def.moves.at(1) || def.moves.at(0));
        let dmg = (mv?.dmg || 55) + ((prof.atkLv || 0) * 8) + trB.bonusDmg + Math.floor(Math.random() * 20);
        if (prof.powerWins?.[pKey] >= 5) dmg = Math.round(dmg * 1.15);
        if (prof.powerWins?.[pKey] >= 100) dmg = Math.round(dmg * 1.25);
        if (prof.gears?.omegaCore) dmg = Math.round(dmg * 1.20);
        if (prof.gears?.titanCrown) dmg = Math.round(dmg * 1.25);
        return { dmg, icon: def.icon, pName: def.name };
    }

    function tickWorldRaidV4(srvId) {
        const raid = worldRaidsV4.get(srvId);
        if (!raid) return;
        const boss = WORLD_RAID_BOSSES_V4.at(raid.bossIdx);
        raid.actedThisTurn.clear();

        if (raid.bossHp <= 0) {
            if (raid.bossIdx + 1 >= WORLD_RAID_BOSSES_V4.length) {
                clearInterval(raid.interval);
                worldRaidsV4.delete(srvId);
                const heroes = Object.keys(raid.dmgMap);
                const sorted = Object.entries(raid.dmgMap).sort((a, b) => b.at(1) - a.at(1));
                const mvp = sorted.at(0);

                heroes.forEach(hName => {
                    const pr = getSvProfile(hName);
                    pr.freeFusionPasses = (pr.freeFusionPasses || 0) + 1;
                    pr.petEssence = (pr.petEssence || 0) + 80;
                    addCoins(hName, 25000);
                });
                if (mvp) addCoins(mvp.at(0), 10000);
                saveSvStats();

                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `🎊🌌 **10-BOSS WORLD RAID CONQUERED!!**\n` +
                          `🏆 **All ${heroes.length} Heroes** won **+25,000🪙**, **+80🔮 Essence**, & **1x Free Fusion Pass**!\n` +
                          `👑 **Raid MVP:** **${mvp ? mvp.at(0) : 'Squad'}** (${mvp ? mvp.at(1).toLocaleString() : 0} DMG | **+10,000🪙**)!`,
                    _serverId: srvId
                });
                return;
            }

            raid.bossIdx++;
            const nextB = WORLD_RAID_BOSSES_V4.at(raid.bossIdx);
            const scale = Math.max(1, getFullRoomPlayers(srvId).length * 0.65);
            raid.bossHp = Math.round(nextB.baseHp * scale);
            raid.squadHp = Math.min(100, raid.squadHp + 25);

            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `⚔️🔥 **BOSS DEFEATED!** (+25% Squad Heal) Next Up: **${nextB.name}** (**${raid.bossHp.toLocaleString()} HP**)! Type \`!attack\`, \`!ult\`, or \`!heal\`!`,
                _serverId: srvId
            });
            return;
        }

        const strike = Math.max(8, boss.dmg - Math.floor(Math.random() * 6));
        raid.squadHp = Math.max(0, raid.squadHp - strike);

        if (raid.squadHp <= 0) {
            clearInterval(raid.interval);
            worldRaidsV4.delete(srvId);
            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `💀🔥 **WORLD RAID WIPEOUT!** **${boss.name}** wiped out the squad with **${raid.bossHp.toLocaleString()} HP** left!`,
                _serverId: srvId
            });
            return;
        }

        io.to(srvId).emit('message', {
            username: "Sammu's Bot",
            text: `👹 **${boss.name}** struck the squad (**-${strike}% HP**)! | Squad: **${raid.squadHp}%** | Boss: **${raid.bossHp.toLocaleString()} HP**\n*(Type \`!attack\`, \`!ult\`, or \`!heal\`!)*`,
            _serverId: srvId
        });
    }
    // ============================================================================
    // 💸 FIXED !PAY + 🐉 10-BOSS COSMIC WORLD RAID — PART 2/2
    // ============================================================================
    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof raw !== 'string') return;
            const clean = raw.trim();
            const low = clean.toLowerCase();
            const sender = socket.username || (payload && payload.username) || 'Player';
            const sKey = sender.toLowerCase();

            // 1. Fixed !pay command (supports !pay @user 500 OR !pay user 500)
            if (low.startsWith('!pay ')) {
                const args = clean.slice(5).trim().split(/\s+/);
                const targetName = (args.at(0) || '').replace(/^@/, '').trim();
                const amt = Math.floor(Number(args.at(1)));

                if (!targetName || isNaN(amt) || amt < 10) {
                    return socket.emit('message', { username: "Sammu's Bot", text: '⚠️ Usage: `!pay @username 500` (Min 10🪙)', _serverId: srvId });
                }
                if (targetName.toLowerCase() === sKey) {
                    return socket.emit('message', { username: "Sammu's Bot", text: '😂 You cannot pay yourself!', _serverId: srvId });
                }
                if (!verifyPlayerAccountOwnership(sender, socket, false)) {
                    return socket.emit('message', { username: 'SYSTEM', text: `🛡️ **TRANSFER BLOCKED!** **${sender}** is locked to another device!`, _serverId: srvId });
                }
                const bal = getCoins(sender);
                if (bal < amt) {
                    return socket.emit('message', { username: "Sammu's Bot", text: `🪙 Not enough coins! Your balance: **${bal.toLocaleString()}🪙**`, _serverId: srvId });
                }

                const senderLeft = addCoins(sender, -amt);
                const targetNew = addCoins(targetName, amt);

                for (const [, s] of io.sockets.sockets) {
                    if (s && s.username && (s.username.toLowerCase() === sKey || s.username.toLowerCase() === targetName.toLowerCase())) {
                        s.emit('svStatsSync', getSvProfile(s.username));
                    }
                }

                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `💸🤝 **COIN TRANSFER!** **${sender}** sent **${amt.toLocaleString()}🪙** to **${targetName}**! (${sender}: **${senderLeft.toLocaleString()}🪙** | ${targetName}: **${targetNew.toLocaleString()}🪙**)`,
                    _serverId: srvId
                });
                return;
            }

            // 2. 10-Boss World Raid (!worldraid, !attack, !ult, !heal)
            if (low === '!worldraid') {
                if (worldRaidsV4.has(srvId)) {
                    const cur = worldRaidsV4.get(srvId);
                    const b = WORLD_RAID_BOSSES_V4.at(cur.bossIdx);
                    return socket.emit('message', { username: "Sammu's Bot", text: `🐉 World Raid already active! **${b.name}** (${cur.bossHp.toLocaleString()} HP) | Squad: **${cur.squadHp}%**`, _serverId: srvId });
                }
                const players = getFullRoomPlayers(srvId);
                const firstB = WORLD_RAID_BOSSES_V4.at(0);
                const startHp = Math.round(firstB.baseHp * Math.max(1, players.length * 0.65));
                const raid = {
                    bossIdx: 0, bossHp: startHp, squadHp: 100,
                    dmgMap: {}, actedThisTurn: new Set(), ultUsed: new Set(),
                    interval: setInterval(() => tickWorldRaidV4(srvId), 14000)
                };
                worldRaidsV4.set(srvId, raid);
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `🚨🐉 **10-BOSS COSMIC WORLD RAID STARTED!**\nCurrent: **${firstB.name}** (**${startHp.toLocaleString()} HP**)\n👉 Type \`!attack\`, \`!ult\` (1x per boss), or \`!heal\` in chat!`,
                    _serverId: srvId
                });
                return;
            }

            const raid = worldRaidsV4.get(srvId);
            if (!raid) return;

            if (low === '!attack' || low === '!strike' || low === '!ult') {
                if (raid.actedThisTurn.has(socket.id)) {
                    return socket.emit('message', { username: "Sammu's Bot", text: '⏳ Cooldown! Wait for the next boss strike (~14s).', _serverId: srvId });
                }
                const isUlt = (low === '!ult');
                const ultKey = `${raid.bossIdx}_${socket.id}`;
                if (isUlt && raid.ultUsed.has(ultKey)) {
                    return socket.emit('message', { username: "Sammu's Bot", text: '⚠️ Already used `!ult` on this boss! Type `!attack` or `!heal`.', _serverId: srvId });
                }
                raid.actedThisTurn.add(socket.id);
                if (isUlt) raid.ultUsed.add(ultKey);

                const hit = getRaidDamageV4(sender, isUlt);
                raid.bossHp = Math.max(0, raid.bossHp - hit.dmg);
                raid.dmgMap[sender] = (raid.dmgMap[sender] || 0) + hit.dmg;

                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `${hit.icon} **${sender}** (${hit.pName}) ${isUlt ? 'unleashed **ULTIMATE**' : 'attacked'} for **-${hit.dmg} DMG**! (Boss HP: **${raid.bossHp.toLocaleString()}**)`,
                    _serverId: srvId
                });
                if (raid.bossHp <= 0) tickWorldRaidV4(srvId);
            }

            if (low === '!heal') {
                if (raid.actedThisTurn.has(socket.id)) return;
                raid.actedThisTurn.add(socket.id);
                raid.squadHp = Math.min(100, raid.squadHp + 18);
                raid.dmgMap[sender] = (raid.dmgMap[sender] || 0) + 50;
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `💖🩺 **${sender}** healed the Raid Squad (**+18% HP** -> **${raid.squadHp}%**)!`,
                    _serverId: srvId
                });
            }
        });
    });
    // ============================================================================
    // 🐉 WORLD RAID LIVE HUD BAR + 🗺️ STORY MODE FIX — PART 1/2
    // ============================================================================
    const WORLD_RAID_HUD_UI = `
    <div id="svWorldRaidHud" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999999;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(49,16,66,0.97),rgba(15,23,42,0.97));border:2px solid #facc15;border-radius:16px;padding:10px 12px;width:100%;max-width:390px;color:#fff;text-align:center;box-shadow:0 6px 28px rgba(250,204,21,0.55);backdrop-filter:blur(8px);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <span id="wrHudTitle" style="font-weight:900;font-size:11px;color:#fde047;">🐉 COSMIC WORLD RAID (1/10)</span>
          <button onclick="document.getElementById('svWorldRaidHud').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
        </div>
        <div style="display:flex;gap:6px;font-size:10px;font-weight:bold;margin-bottom:7px;">
          <div style="flex:1;background:#090d16;border:1px solid #4ade80;border-radius:8px;padding:4px;position:relative;overflow:hidden;">
            <div id="wrHudSquadFill" style="position:absolute;inset:0;width:100%;background:rgba(74,222,128,0.28);transition:width 0.3s;"></div>
            <span style="position:relative;">❤️ Squad: <b id="wrHudSquadHp" style="color:#4ade80;">100%</b></span>
          </div>
          <div style="flex:1;background:#090d16;border:1px solid #f43f5e;border-radius:8px;padding:4px;position:relative;overflow:hidden;">
            <div id="wrHudBossFill" style="position:absolute;inset:0;width:100%;background:rgba(244,63,94,0.34);transition:width 0.3s;"></div>
            <span style="position:relative;">👹 Boss: <b id="wrHudBossHp" style="color:#fda4af;">600</b></span>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;">
          <button onclick="if(typeof socket!=='undefined')socket.emit('chatMessage','!attack')" style="padding:7px 4px;border:1.5px solid #f87171;border-radius:9px;background:#b91c1c;color:#fff;font-weight:900;font-size:11px;cursor:pointer;">⚔️ Attack</button>
          <button onclick="if(typeof socket!=='undefined')socket.emit('chatMessage','!ult')" style="padding:7px 4px;border:1.5px solid #facc15;border-radius:9px;background:linear-gradient(90deg,#7e22ce,#d97706);color:#fff;font-weight:900;font-size:11px;cursor:pointer;">💥 ULT (1x)</button>
          <button onclick="if(typeof socket!=='undefined')socket.emit('chatMessage','!heal')" style="padding:7px 4px;border:1.5px solid #4ade80;border-radius:9px;background:#15803d;color:#fff;font-weight:900;font-size:11px;cursor:pointer;">💖 Heal</button>
        </div>
      </div>
    </div>
    <script>
    (function() {
      const bootWrAndStory = setInterval(() => {
        if (typeof socket === 'undefined' || window._wrAndStoryFixed) return;
        window._wrAndStoryFixed = true;
        clearInterval(bootWrAndStory);

        socket.on('svWorldRaidHudSync', (d) => {
          if (d._serverId && window.selectedServerId && d._serverId !== window.selectedServerId) return;
          const hud = document.getElementById('svWorldRaidHud');
          if (!hud) return;
          hud.style.display = 'flex';
          document.getElementById('wrHudTitle').textContent = d.bossName;
          document.getElementById('wrHudSquadHp').textContent = d.squadHp + '%';
          document.getElementById('wrHudSquadFill').style.width = Math.max(0, d.squadHp) + '%';
          document.getElementById('wrHudBossHp').textContent = Number(d.bossHp).toLocaleString();
          const pct = Math.max(0, Math.min(100, Math.round((d.bossHp / (d.maxBossHp || 1)) * 100)));
          document.getElementById('wrHudBossFill').style.width = pct + '%';
        });

        socket.on('svWorldRaidHudEnd', () => {
          const hud = document.getElementById('svWorldRaidHud');
          if (hud) hud.style.display = 'none';
        });

        // Fix Story Mode buttons & add a World Raid launch button inside Story tab!
        setInterval(() => {
          const advPanel = document.getElementById('svAdvPanel');
          if (!advPanel) return;
          if (!document.getElementById('svLaunchWorldRaidBtn')) {
            const wrBtn = document.createElement('button');
            wrBtn.id = 'svLaunchWorldRaidBtn';
            wrBtn.style.cssText = 'width:100%;padding:9px;margin-bottom:8px;border:2px solid #facc15;border-radius:11px;background:linear-gradient(90deg,#7e22ce,#dc2626);color:#fff;font-weight:900;font-size:12px;cursor:pointer;';
            wrBtn.textContent = '🐉 LAUNCH 10-BOSS SERVER WORLD RAID!';
            wrBtn.onclick = () => {
              document.getElementById('svModal').style.display = 'none';
              socket.emit('chatMessage', '!worldraid');
            };
            advPanel.insertBefore(wrBtn, advPanel.firstChild);
          }

          advPanel.querySelectorAll('#svAdventureChaptersList button').forEach((btn, idx) => {
            if (btn.disabled || btn.dataset.storyFixed) return;
            btn.dataset.storyFixed = '1';
            const chNum = idx + 1;
            btn.removeAttribute('onclick');
            btn.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              const prof = window._latestSvProf || {};
              const adv = prof.adventure || { chapter: 1, stage: 1, cleared: false };
              const stgNum = (!adv.cleared && adv.chapter === chNum) ? (adv.stage || 1) : 1;
              socket.emit('svStartAdventure', { ch: chNum, stg: stgNum, power: window._curSvPow || 'fire' });
            };
          });
        }, 900);
      }, 600);
    })();
    </script>`;
    // ============================================================================
    // 🐉 WORLD RAID LIVE HUD BAR + 🗺️ STORY MODE FIX — PART 2/2
    // ============================================================================
    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('svWorldRaidHud')) {
                body = body.replace('</body>', WORLD_RAID_HUD_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });

    function emitWorldRaidHud(srvId) {
        const raid = worldRaidsV4.get(srvId);
        if (!raid) return io.to(srvId).emit('svWorldRaidHudEnd');
        const boss = WORLD_RAID_BOSSES_V4.at(raid.bossIdx) || WORLD_RAID_BOSSES_V4.at(0);
        if (!raid.maxBossHp || raid.bossHp > raid.maxBossHp) raid.maxBossHp = raid.bossHp;
        io.to(srvId).emit('svWorldRaidHudSync', {
            bossName: boss.name,
            bossHp: Math.max(0, raid.bossHp),
            maxBossHp: raid.maxBossHp,
            squadHp: Math.max(0, raid.squadHp),
            _serverId: srvId
        });
    }

    const _prevTickWrHud = tickWorldRaidV4;
    tickWorldRaidV4 = function(srvId) {
        _prevTickWrHud(srvId);
        emitWorldRaidHud(srvId);
    };

    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof raw !== 'string') return;
            const low = raw.trim().toLowerCase();
            if (low === '!worldraid' || low === '!attack' || low === '!strike' || low === '!ult' || low === '!heal') {
                setTimeout(() => emitWorldRaidHud(srvId), 120);
            }
        });
    });
    // ============================================================================
    // 🏆 GLOBAL SAMMUVERSE LEADERBOARD (!ranks / !leaderboard + 🏆 RANKS BUTTON)
    // ============================================================================
    function buildGlobalLeaderboardList() {
        return Object.entries(svPlayerStats)
            .map(([name, st]) => ({
                name: name.toUpperCase(),
                wins: st.wins || 0,
                bounty: st.bounty || 10000,
                floor: st.maxTowerFloor || 1,
                coins: getCoins(name)
            }))
            .sort((a, b) => b.wins - a.wins || b.bounty - a.bounty || b.coins - a.coins)
            .slice(0, 10);
    }

    io.on('connection', (socket) => {
        socket.on('svGetGlobalLeaderboard', () => {
            socket.emit('svGlobalLeaderboardSync', buildGlobalLeaderboardList());
        });

        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof raw !== 'string') return;
            const low = raw.trim().toLowerCase();

            if (low === '!ranks' || low === '!leaderboard' || low === '!lb') {
                const top = buildGlobalLeaderboardList().slice(0, 5);
                const msg = top.length
                    ? top.map((p, i) => `${i === 0 ? '👑' : `#${i + 1}`} **${p.name}** — ${p.wins}W | 🗼F${p.floor} | ${p.coins.toLocaleString()}🪙`).join('\n')
                    : 'No ranked fighters yet! Win a battle in SammuVerse!';
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `🏆 **SAMMUVERSE TOP FIGHTERS:**\n${msg}`,
                    _serverId: srvId
                });
            }
        });
    });

    const GLOBAL_LB_CLIENT_SCRIPT = `
    <script>
    (function() {
      const waitLbBoot = setInterval(() => {
        if (typeof socket === 'undefined' || window._svGlobalLbHooked) return;
        window._svGlobalLbHooked = true;
        clearInterval(waitLbBoot);

        window._svGlobalBoard = [];
        socket.on('svGlobalLeaderboardSync', (list) => {
          window._svGlobalBoard = Array.isArray(list) ? list : [];
          renderGlobalLbBody();
        });

        function renderGlobalLbBody() {
          const body = document.getElementById('svGlobalLbListBox');
          if (!body) return;
          if (!window._svGlobalBoard.length) {
            body.innerHTML = '<div style="color:#94a3b8;padding:12px;">No ranked battles yet! Fight in the Arena to claim #1! ⚔️</div>';
            return;
          }
          body.innerHTML = window._svGlobalBoard.map((p, i) => {
            const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : ('#' + (i + 1))));
            const bFmt = p.bounty >= 1000000 ? ((p.bounty / 1000000).toFixed(2) + 'M') : (Math.round(p.bounty / 1000) + 'K');
            return '<div style="display:flex;justify-content:space-between;align-items:center;background:#1e293b;border:1px solid ' + (i === 0 ? '#facc15' : '#334155') + ';border-radius:10px;padding:7px 9px;margin-bottom:5px;font-size:11px;">' +
              '<div style="text-align:left;"><b style="color:' + (i === 0 ? '#fde047' : '#fff') + ';">' + medal + ' ' + p.name + '</b><br><span style="color:#94a3b8;">🏴‍☠️ ' + bFmt + ' Bounty • 🗼 Floor ' + p.floor + '</span></div>' +
              '<div style="text-align:right;"><b style="color:#4ade80;">' + p.wins + ' Wins</b><br><span style="color:#fde047;">' + p.coins.toLocaleString() + '🪙</span></div>' +
            '</div>';
          }).join('');
        }

        window.openGlobalLeaderboardModal = function() {
          const modal = document.getElementById('svSubModal');
          const title = document.getElementById('svSubTitle');
          const body = document.getElementById('svSubBody');
          if (!modal) return;
          modal.style.display = 'flex';
          title.textContent = '🏆 GLOBAL SAMMUVERSE LEADERBOARD';
          body.innerHTML = '<div id="svGlobalLbListBox"><div style="color:#38bdf8;padding:12px;">Loading Top 10 Fighters... ⏳</div></div>';
          renderGlobalLbBody();
          socket.emit('svGetGlobalLeaderboard');
        };

        // Add "🏆 Ranks" button inside the SammuVerse Arena quick-bar
        setInterval(() => {
          const fightPanel = document.getElementById('svFightPanel');
          if (!fightPanel || document.getElementById('svGlobalRanksBtn')) return;
          const quickGrid = fightPanel.firstElementChild;
          if (quickGrid && quickGrid.tagName === 'DIV') {
            quickGrid.style.gridTemplateColumns = 'repeat(7, 1fr)';
            const rBtn = document.createElement('button');
            rBtn.id = 'svGlobalRanksBtn';
            rBtn.type = 'button';
            rBtn.style.cssText = 'padding:6px 1px;border-radius:9px;border:1.5px solid #facc15;background:#713f12;color:#fef08a;font-size:10px;font-weight:900;cursor:pointer;';
            rBtn.textContent = '🏆 Ranks';
            rBtn.onclick = () => window.openGlobalLeaderboardModal();
            quickGrid.appendChild(rBtn);
          }
        }, 1200);
      }, 600);
    })();
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('_svGlobalLbHooked')) {
                body = body.replace('</body>', GLOBAL_LB_CLIENT_SCRIPT + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // ============================================================================
    // 👑 SECRET ADMIN COMMANDS (#hazmolerangola UNLOCK -> /settrain, /givecoins, /setfloor)
    // ============================================================================
    const unlockedCommandAdmins = new Set();

    io.on('connection', (socket) => {
        // Intercept #hazmolerangola before it broadcasts to public chat
        socket.use((packet, next) => {
            if (packet && packet.at(0) === 'chatMessage' && socket.activeServerId) {
                const payload = packet.at(1);
                const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
                if (typeof raw === 'string' && raw.trim().toLowerCase() === '#hazmolerangola') {
                    const uname = (socket.username || (payload && payload.username) || '').toLowerCase().trim();
                    if (uname) unlockedCommandAdmins.add(uname);
                    socket.isHazmoleAdmin = true;
                    socket.emit('message', {
                        username: 'SYSTEM',
                        text: '🔓👑 **SECRET ADMIN MODE UNLOCKED!** You can now use `/settrain @user <lvl>`, `/givecoins @user <amt>`, and `/setfloor @user <floor>`!',
                        _serverId: socket.activeServerId
                    });
                    return; // Keeps #hazmolerangola secret from public chat!
                }
            }
            next();
        });

        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof raw !== 'string') return;
            const clean = raw.trim();
            const low = clean.toLowerCase();
            const sender = (socket.username || (payload && payload.username) || '').toLowerCase().trim();
            const hasAdminPower = Boolean(socket.isHazmoleAdmin || (sender && unlockedCommandAdmins.has(sender)));

            // 1. /settrain @username <totalLevels>
            if (low.startsWith('/settrain ')) {
                if (!hasAdminPower) return;
                const args = clean.slice(10).trim().split(/\s+/);
                const target = (args.at(0) || '').replace(/^@/, '').trim();
                const totalLv = Math.max(0, Math.floor(Number(args.at(1))));
                if (!target || isNaN(totalLv)) {
                    return socket.emit('message', { username: 'SYSTEM', text: '⚠️ Usage: `/settrain @username 1000000`', _serverId: srvId });
                }

                const prof = getSvProfile(target);
                const tr = ensureTrainingProfile(prof);
                const perStat = Math.floor(totalLv / 3);
                const rem = totalLv - (perStat * 3);
                tr.fistLv = perStat + rem;
                tr.bodyLv = perStat;
                tr.chiLv = perStat;
                tr.xp = Math.max(tr.xp || 0, totalLv);

                ensureTrainingProfile(prof);
                syncPlayerTitlesAndBounty(target);
                saveSvStats();

                for (const [, s] of io.sockets.sockets) {
                    if (s && s.username && s.username.toLowerCase() === target.toLowerCase()) {
                        s.emit('svStatsSync', getSvProfile(s.username));
                    }
                }

                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `🏋️👑 **ADMIN BOOST:** **${sender.toUpperCase()}** set **${target}**'s Training Mastery to **${totalLv.toLocaleString()}** (Fist: ${tr.fistLv.toLocaleString()} | Body: ${tr.bodyLv.toLocaleString()} | Chi: ${tr.chiLv.toLocaleString()})!`,
                    _serverId: srvId
                });
            }

            // 2. /givecoins @username <amount>
            if (low.startsWith('/givecoins ')) {
                if (!hasAdminPower) return;
                const args = clean.slice(11).trim().split(/\s+/);
                const target = (args.at(0) || '').replace(/^@/, '').trim();
                const amt = Math.floor(Number(args.at(1)));
                if (!target || isNaN(amt)) {
                    return socket.emit('message', { username: 'SYSTEM', text: '⚠️ Usage: `/givecoins @username 50000`', _serverId: srvId });
                }

                const newBal = addCoins(target, amt);
                for (const [, s] of io.sockets.sockets) {
                    if (s && s.username && s.username.toLowerCase() === target.toLowerCase()) {
                        s.emit('svStatsSync', getSvProfile(s.username));
                    }
                }
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `💰👑 **ADMIN GRANT:** **${sender.toUpperCase()}** gave **${amt.toLocaleString()}🪙** to **${target}** (New Balance: **${newBal.toLocaleString()}🪙**)!`,
                    _serverId: srvId
                });
            }

            // 3. /setfloor @username <floor>
            if (low.startsWith('/setfloor ')) {
                if (!hasAdminPower) return;
                const args = clean.slice(10).trim().split(/\s+/);
                const target = (args.at(0) || '').replace(/^@/, '').trim();
                const fl = Math.max(1, Math.floor(Number(args.at(1))));
                if (!target || isNaN(fl)) {
                    return socket.emit('message', { username: 'SYSTEM', text: '⚠️ Usage: `/setfloor @username 50`', _serverId: srvId });
                }

                const prof = getSvProfile(target);
                prof.maxTowerFloor = fl;
                prof.towerCheckpoint = Math.max(1, Math.floor(fl / 5) * 5);
                syncPlayerTitlesAndBounty(target);
                saveSvStats();

                for (const [, s] of io.sockets.sockets) {
                    if (s && s.username && s.username.toLowerCase() === target.toLowerCase()) {
                        s.emit('svStatsSync', getSvProfile(s.username));
                    }
                }
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `♾️👑 **ADMIN SET:** **${target}**'s Endless Tower progress set to **Floor ${fl}** (Checkpoint: **F${prof.towerCheckpoint}**)!`,
                    _serverId: srvId
                });
            }
        });
    });
    // ============================================================================
    // 🔊 GLOBAL SINGLE AUDIO ENGINE + CHAT POP SOUND RESTORE
    // ============================================================================
    const GLOBAL_CHAT_AND_GAME_AUDIO = `
    <script>
    (function() {
      if (window._globalAudioEngineInstalled) return;
      window._globalAudioEngineInstalled = true;

      const OrigAC = window.AudioContext || window.webkitAudioContext;
      if (OrigAC) {
        window._singletonAC = null;
        const SharedAC = function() {
          if (!window._singletonAC) window._singletonAC = new OrigAC();
          if (window._singletonAC.state === 'suspended') window._singletonAC.resume().catch(() => {});
          return window._singletonAC;
        };
        SharedAC.prototype = OrigAC.prototype;
        window.AudioContext = SharedAC;
        window.webkitAudioContext = SharedAC;
      }

      function wakeAllAudio() {
        try {
          if (!window._singletonAC && OrigAC) window._singletonAC = new OrigAC();
          if (window._singletonAC && window._singletonAC.state === 'suspended') {
            window._singletonAC.resume();
          }
        } catch (e) {}
      }

      ['touchstart', 'pointerdown', 'click', 'keydown'].forEach(ev => {
        window.addEventListener(ev, wakeAllAudio, { passive: true });
      });

      window.playChatPopSound = function() {
        try {
          wakeAllAudio();
          const ctx = window._singletonAC;
          if (!ctx || ctx.state !== 'running') return;
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(580, now);
          osc.frequency.exponentialRampToValueAtTime(920, now + 0.065);
          gain.gain.setValueAtTime(0.22, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.09);
        } catch (e) {}
      };

      const hookChatPopSock = setInterval(() => {
        if (typeof socket === 'undefined' || window._chatPopSocketBound) return;
        window._chatPopSocketBound = true;
        clearInterval(hookChatPopSock);

        socket.on('message', (msg) => {
          if (!msg) return;
          if (msg._serverId && window.selectedServerId && msg._serverId !== window.selectedServerId) return;
          window.playChatPopSound();
        });
      }, 500);
    })();
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('_globalAudioEngineInstalled')) {
                body = body.replace('</body>', GLOBAL_CHAT_AND_GAME_AUDIO + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // ============================================================================
    // 👑 EXPANDED #hazmolerangola ADMIN COMMANDS (POWERS, V3, PETS, GEARS & RESET)
    // ============================================================================
    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof raw !== 'string') return;
            const clean = raw.trim();
            const low = clean.toLowerCase();
            const sender = (socket.username || (payload && payload.username) || '').toLowerCase().trim();
            const hasAdminPower = Boolean(socket.isHazmoleAdmin || (sender && unlockedCommandAdmins.has(sender)));
            if (!hasAdminPower) return;

            const syncTargetLive = (targetName) => {
                syncPlayerTitlesAndBounty(targetName);
                saveSvStats();
                for (const [, s] of io.sockets.sockets) {
                    if (s && s.username && s.username.toLowerCase() === targetName.toLowerCase()) {
                        s.emit('svStatsSync', getSvProfile(s.username));
                    }
                }
            };

            // 1. /givepower @username <powerKey|all>
            if (low.startsWith('/givepower ')) {
                const args = clean.slice(11).trim().split(/\s+/);
                const target = (args.at(0) || '').replace(/^@/, '').trim();
                const pKey = (args.at(1) || '').toLowerCase().trim();
                if (!target || !pKey) {
                    return socket.emit('message', { username: 'SYSTEM', text: '⚠️ Usage: `/givepower @username mahavishnu` or `/givepower @username all`', _serverId: srvId });
                }
                const prof = getSvProfile(target);
                if (pKey === 'all') {
                    prof.unlockedPowers = Object.keys(SV_DEFS);
                    syncTargetLive(target);
                    return io.to(srvId).emit('message', { username: "Sammu's Bot", text: `⚡👑 **ADMIN GRANT:** **${target}** unlocked **ALL ${prof.unlockedPowers.length} POWERS**!`, _serverId: srvId });
                }
                if (!SV_DEFS[pKey]) {
                    return socket.emit('message', { username: 'SYSTEM', text: `❌ Unknown power \`${pKey}\`. Valid: ${Object.keys(SV_DEFS).slice(0, 12).join(', ')}...`, _serverId: srvId });
                }
                if (!prof.unlockedPowers.includes(pKey)) prof.unlockedPowers.push(pKey);
                syncTargetLive(target);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🌟👑 **ADMIN GRANT:** **${target}** unlocked **${SV_DEFS[pKey].icon} ${SV_DEFS[pKey].name}**!`, _serverId: srvId });
            }

            // 2. /setv3 @username <powerKey|all>
            if (low.startsWith('/setv3 ')) {
                const args = clean.slice(7).trim().split(/\s+/);
                const target = (args.at(0) || '').replace(/^@/, '').trim();
                const pKey = (args.at(1) || 'all').toLowerCase().trim();
                if (!target) return socket.emit('message', { username: 'SYSTEM', text: '⚠️ Usage: `/setv3 @username fire` or `/setv3 @username all`', _serverId: srvId });
                const prof = getSvProfile(target);
                if (!prof.powerWins) prof.powerWins = {};
                if (pKey === 'all') {
                    Object.keys(SV_DEFS).forEach(k => { prof.powerWins[k] = Math.max(100, prof.powerWins[k] || 0); });
                } else if (SV_DEFS[pKey]) {
                    prof.powerWins[pKey] = Math.max(100, prof.powerWins[pKey] || 0);
                } else {
                    return socket.emit('message', { username: 'SYSTEM', text: `❌ Unknown power \`${pKey}\`.`, _serverId: srvId });
                }
                syncTargetLive(target);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🔥👑 **V3 ASCENSION GRANTED:** **${target}** now has **100 Wins [V3 👑]** on **${pKey.toUpperCase()}**!`, _serverId: srvId });
            }

            // 3. /givepet @username <petId|all>
            if (low.startsWith('/givepet ')) {
                const args = clean.slice(9).trim().split(/\s+/);
                const target = (args.at(0) || '').replace(/^@/, '').trim();
                const petId = (args.at(1) || 'ouroboros').toLowerCase().trim();
                const allPets = ['mochi', 'tommy', 'garuda', 'sheshnag', 'chimera', 'ouroboros'];
                if (!target || (petId !== 'all' && !allPets.includes(petId))) {
                    return socket.emit('message', { username: 'SYSTEM', text: `⚠️ Usage: \`/givepet @username ouroboros\` (Options: ${allPets.join(', ')}, all)`, _serverId: srvId });
                }
                const prof = getSvProfile(target);
                if (petId === 'all') {
                    prof.ownedPets = [...allPets];
                    prof.activePet = 'ouroboros';
                    prof.activePet2 = 'chimera';
                } else {
                    if (!prof.ownedPets.includes(petId)) prof.ownedPets.push(petId);
                    prof.activePet = petId;
                }
                prof.petEssence = (prof.petEssence || 0) + 100;
                syncTargetLive(target);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🐉👑 **PET GRANT:** **${target}** received **${petId.toUpperCase()}** + **100🔮 Pet Essence**!`, _serverId: srvId });
            }

            // 4. /givegears @username
            if (low.startsWith('/givegears ')) {
                const target = clean.slice(11).replace(/^@/, '').trim().split(/\s+/).at(0);
                if (!target) return;
                const prof = getSvProfile(target);
                prof.gears = { omegaCore: true, titanCrown: true };
                prof.hasStone = true;
                prof.freeFusionPasses = (prof.freeFusionPasses || 0) + 1;
                syncTargetLive(target);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `⚡🌌 **GODLY GEARS GRANTED:** **${target}** unlocked **⚡ Omega Core**, **🌌 Titan Crown**, **💎 Awakening Stone**, & **1x Free Fusion Pass**!`, _serverId: srvId });
            }

            // 5. /setbounty @username <amount>
            if (low.startsWith('/setbounty ')) {
                const args = clean.slice(11).trim().split(/\s+/);
                const target = (args.at(0) || '').replace(/^@/, '').trim();
                const amt = Math.max(0, Math.floor(Number(args.at(1))));
                if (!target || isNaN(amt)) return socket.emit('message', { username: 'SYSTEM', text: '⚠️ Usage: `/setbounty @username 30000000`', _serverId: srvId });
                const prof = getSvProfile(target);
                prof.bounty = amt;
                syncTargetLive(target);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🏴‍☠️👑 **BOUNTY UPDATED:** **${target}**'s Bounty Honor is now **${amt.toLocaleString()}**!`, _serverId: srvId });
            }

            // 6. /resetuser @username
            if (low.startsWith('/resetuser ')) {
                const target = clean.slice(11).replace(/^@/, '').trim().split(/\s+/).at(0);
                if (!target) return;
                const k = target.toLowerCase();
                delete svPlayerStats[k];
                playerWallet.set(k, 150);
                saveEconomyDB();
                syncTargetLive(target);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🔄⚠️ **PROFILE RESET:** **${target}**'s stats and wallet were reset to starter defaults!`, _serverId: srvId });
            }
        });
    });
    // ============================================================================
    // 🔱 SUPREME HARIHARA SYNERGY & /godfusion ADMIN COMMAND
    // ============================================================================
    io.on('connection', (socket) => {
        // Auto-upgrade any existing HariHara / MahaVishnu+Mahadev fusion on login
        socket.on('svGetStats', () => {
            const uname = socket.username;
            if (!uname) return;
            const prof = getSvProfile(uname);
            let upgraded = false;
            (prof.customPowers || []).forEach(cp => {
                if (!cp || !cp.def) return;
                const isHariHara = /harihara/i.test(cp.def.name || '') || (cp.def.icon && cp.def.icon.includes('🔱🔱'));
                if (isHariHara && cp.def.hp < 950) {
                    cp.def.hp = 950;
                    cp.def.passiveRed = 0.55;
                    cp.def.moves = [
                        { label: '🪈🔱 HariHara Trishul-Bansuri (110 DMG + Stun)', dmg: 110, trueDmg: true, stunChance: 0.65 },
                        { label: '☸️🔥 Sudarshana Tandava (145 True DMG)', dmg: 145, trueDmg: true },
                        { label: '🌌🛡️ Kailash Vaikuntha Kavach (Evade +140 HP)', evade: true, heal: 140 },
                        { label: '🔱🌌 COSMIC HARIHARA PRALAYA ULT (295 True DMG + Stun)', dmg: 295, trueDmg: true, stun: true, cut: { theme: 'vishwaroopa', emoji: '🔱🌌🔥', title: 'SUPREME HARIHARA PRALAYA!' } }
                    ];
                    SV_DEFS[cp.id] = cp.def;
                    upgraded = true;
                }
            });
            if (upgraded) {
                saveSvStats();
                socket.emit('svStatsSync', prof);
            }
        });

        // /godfusion @username <FusionName> (Requires #hazmolerangola)
        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof raw !== 'string') return;
            const clean = raw.trim();
            const low = clean.toLowerCase();
            const sender = (socket.username || (payload && payload.username) || '').toLowerCase().trim();
            const hasAdminPower = Boolean(socket.isHazmoleAdmin || (sender && unlockedCommandAdmins.has(sender)));
            if (!hasAdminPower) return;

            if (low.startsWith('/godfusion ')) {
                const args = clean.slice(11).trim().split(/\s+/);
                const target = (args.shift() || '').replace(/^@/, '').trim();
                const title = (args.join(' ').trim() || 'HARIHARA SUPREME').slice(0, 26);
                if (!target) return;

                const prof = getSvProfile(target);
                const slotNum = (prof.customPowers?.length || 0) + 1;
                const cid = 'godfusion_' + target.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Date.now().toString(36);
                const godDef = {
                    fused: true,
                    icon: '🔱🌌',
                    name: `${title} [GOD #${slotNum}]`,
                    hp: 1000,
                    passiveRed: 0.58,
                    strong: Object.keys(SV_DEFS),
                    moves: [
                        { label: `⚡ ${title} Astral Strike (120 True DMG)`, dmg: 120, trueDmg: true },
                        { label: `🔥 ${title} Annihilation (155 True DMG + Stun)`, dmg: 155, trueDmg: true, stunChance: 0.60 },
                        { label: `🛡️ ${title} Absolute Domain (Evade +160 HP)`, evade: true, heal: 160 },
                        { label: `🌌👑 ${title.toUpperCase()} OMEGA ULT (320 True DMG + Stun)`, dmg: 320, trueDmg: true, stun: true, cut: { theme: 'vishwaroopa', emoji: '🔱👑🌌', title: `${title.toUpperCase()} SUPREME!` } }
                    ]
                };

                SV_DEFS[cid] = godDef;
                if (!Array.isArray(prof.unlockedPowers)) prof.unlockedPowers = [];
                if (!Array.isArray(prof.customPowers)) prof.customPowers = [];
                prof.unlockedPowers.push(cid);
                prof.customPowers.push({ id: cid, def: godDef });
                if (!prof.powerWins) prof.powerWins = {};
                prof.powerWins[cid] = 100; // Instant V3 Crown!

                syncPlayerTitlesAndBounty(target);
                saveSvStats();
                for (const [, s] of io.sockets.sockets) {
                    if (s && s.username && s.username.toLowerCase() === target.toLowerCase()) {
                        s.emit('svStatsSync', getSvProfile(s.username));
                    }
                }
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `🔱🌌 **GOD FUSION AWAKENED!** **${target}** forged **${godDef.name}** (1,000 HP | 58% Armor | 320 True DMG ULT)!`,
                    _serverId: srvId
                });
            }
        });
    });
    // ============================================================================
    // 👑 CREATOR-ONLY HK GOD CONSOLE — PART 1/3 (SERVER ENGINE A)
    // ============================================================================
    function isSupremeCreatorOnly(socket, unameHint) {
        if (!socket) return false;
        if (socket.isHazmoleAdmin) return true;
        const clean = (socket.username || unameHint || '').toLowerCase().trim();
        if (clean && unlockedCommandAdmins.has(clean)) return true;
        // Strictly creator usernames ('sammu' or 'samaksh') verified by device lock — NOT other OG hosts!
        if (clean === 'sammu' || clean === 'samaksh') {
            return verifyOGHostTripleLock(clean, socket, false);
        }
        return false;
    }

    io.on('connection', (socket) => {
        socket.on('hkCheckAccess', () => {
            if (isSupremeCreatorOnly(socket)) {
                socket.emit('hkAccessGranted', { ok: true });
            }
        });

        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            if (typeof raw === 'string' && raw.trim().toLowerCase() === '#hazmolerangola') {
                setTimeout(() => socket.emit('hkAccessGranted', { ok: true }), 150);
            }
        });

        socket.on('hkAdminExec', ({ action, target, value }) => {
            const srvId = socket.activeServerId;
            if (!srvId || !isSupremeCreatorOnly(socket)) return;

            const cleanTarget = String(target || '').replace(/^@/, '').trim();
            const syncLive = (tName) => {
                if (!tName) return;
                syncPlayerTitlesAndBounty(tName);
                saveSvStats();
                for (const [, s] of io.sockets.sockets) {
                    if (s && s.username && s.username.toLowerCase() === tName.toLowerCase()) {
                        s.emit('svStatsSync', getSvProfile(s.username));
                    }
                }
            };

            if (action === 'announce') {
                const msg = String(value || '').trim();
                if (!msg) return;
                return io.to(srvId).emit('message', { username: "Sammu's Bot", text: `📢👑 **CREATOR NOTICE:** ${msg}`, _serverId: srvId });
            }

            if (!cleanTarget) return socket.emit('svNotice', '⚠️ Enter or select a target username first!');

            if (action === 'godmode') {
                const prof = getSvProfile(cleanTarget);
                const tr = ensureTrainingProfile(prof);
                prof.unlockedPowers = Object.keys(SV_DEFS);
                prof.ownedPets = ['mochi', 'tommy', 'garuda', 'sheshnag', 'chimera', 'ouroboros'];
                prof.activePet = 'ouroboros'; prof.activePet2 = 'chimera';
                prof.ownedRelics = ['excalibur', 'aegis', 'vampfang']; prof.activeRelic = 'excalibur';
                prof.gears = { omegaCore: true, titanCrown: true };
                prof.adventure = { chapter: 5, stage: 3, cleared: true };
                prof.hasStone = true; prof.atkLv = 15; prof.hpLv = 15;
                prof.petEssence = (prof.petEssence || 0) + 500;
                prof.freeFusionPasses = (prof.freeFusionPasses || 0) + 3;
                prof.bounty = 30000000; prof.lineage = 'celestial'; prof.lineageStage = 3;
                prof.maxTowerFloor = Math.max(100, prof.maxTowerFloor || 1); prof.towerCheckpoint = 100;
                tr.fistLv = 333334; tr.bodyLv = 333333; tr.chiLv = 333333; tr.xp = 1000000;
                if (!prof.powerWins) prof.powerWins = {};
                Object.keys(SV_DEFS).forEach(k => { prof.powerWins[k] = Math.max(100, prof.powerWins[k] || 0); });
                addCoins(cleanTarget, 500000);
                syncLive(cleanTarget);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `👑🔱 **GOD MODE ACTIVATED** on **${cleanTarget}**!`, _serverId: srvId });
            } else if (action === 'godfusion') {
                const title = (String(value || '').trim() || 'HARIHARA SUPREME').slice(0, 26);
                const prof = getSvProfile(cleanTarget);
                const slotNum = (prof.customPowers?.length || 0) + 1;
                const cid = 'godfusion_' + cleanTarget.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Date.now().toString(36);
                const godDef = {
                    fused: true, icon: '🔱🌌', name: `${title} [GOD #${slotNum}]`, hp: 1000, passiveRed: 0.58,
                    strong: Object.keys(SV_DEFS),
                    moves: [
                        { label: `⚡ ${title} Astral Strike (120 True DMG)`, dmg: 120, trueDmg: true },
                        { label: `🔥 ${title} Annihilation (155 True DMG + Stun)`, dmg: 155, trueDmg: true, stunChance: 0.60 },
                        { label: `🛡️ ${title} Absolute Domain (Evade +160 HP)`, evade: true, heal: 160 },
                        { label: `🌌👑 ${title.toUpperCase()} OMEGA ULT (320 True DMG + Stun)`, dmg: 320, trueDmg: true, stun: true, cut: { theme: 'vishwaroopa', emoji: '🔱👑🌌', title: `${title.toUpperCase()} SUPREME!` } }
                    ]
                };
                SV_DEFS[cid] = godDef;
                if (!Array.isArray(prof.unlockedPowers)) prof.unlockedPowers = [];
                if (!Array.isArray(prof.customPowers)) prof.customPowers = [];
                prof.unlockedPowers.push(cid);
                prof.customPowers.push({ id: cid, def: godDef });
                if (!prof.powerWins) prof.powerWins = {};
                prof.powerWins[cid] = 100;
                syncLive(cleanTarget);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🔱🌌 **GOD FUSION:** **${cleanTarget}** forged **${godDef.name}**!`, _serverId: srvId });
            } else if (action === 'coins') {
                const amt = Math.floor(Number(value) || 50000);
                const bal = addCoins(cleanTarget, amt);
                syncLive(cleanTarget);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `💰👑 **${cleanTarget}** received **${amt >= 0 ? '+' : ''}${amt.toLocaleString()}🪙** (Balance: **${bal.toLocaleString()}🪙**)!`, _serverId: srvId });
            } else if (action === 'power') {
                const pKey = String(value || 'all').toLowerCase().trim();
                const prof = getSvProfile(cleanTarget);
                if (pKey === 'all') prof.unlockedPowers = Object.keys(SV_DEFS);
                else if (SV_DEFS[pKey] && !prof.unlockedPowers.includes(pKey)) prof.unlockedPowers.push(pKey);
                syncLive(cleanTarget);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🌟👑 **${cleanTarget}** unlocked **${pKey.toUpperCase()}**!`, _serverId: srvId });
            }
    // ============================================================================
    // 👑 CREATOR-ONLY HK GOD CONSOLE — PART 2/3 (SERVER ENGINE B)
    // ============================================================================
            else if (action === 'v3') {
                const pKey = String(value || 'all').toLowerCase().trim();
                const prof = getSvProfile(cleanTarget);
                if (!prof.powerWins) prof.powerWins = {};
                if (pKey === 'all') Object.keys(SV_DEFS).forEach(k => { prof.powerWins[k] = Math.max(100, prof.powerWins[k] || 0); });
                else if (SV_DEFS[pKey]) prof.powerWins[pKey] = Math.max(100, prof.powerWins[pKey] || 0);
                syncLive(cleanTarget);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🔥👑 **${cleanTarget}** achieved **[V3 👑]** on **${pKey.toUpperCase()}**!`, _serverId: srvId });
            } else if (action === 'train') {
                const totalLv = Math.max(0, Math.floor(Number(value) || 1000000));
                const prof = getSvProfile(cleanTarget);
                const tr = ensureTrainingProfile(prof);
                const per = Math.floor(totalLv / 3);
                tr.fistLv = per + (totalLv - per * 3); tr.bodyLv = per; tr.chiLv = per;
                tr.xp = Math.max(tr.xp || 0, totalLv);
                syncLive(cleanTarget);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🏋️👑 **${cleanTarget}**'s Training Mastery set to **${totalLv.toLocaleString()}**!`, _serverId: srvId });
            } else if (action === 'floor') {
                const fl = Math.max(1, Math.floor(Number(value) || 50));
                const prof = getSvProfile(cleanTarget);
                prof.maxTowerFloor = fl; prof.towerCheckpoint = Math.max(1, Math.floor(fl / 5) * 5);
                syncLive(cleanTarget);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `♾️👑 **${cleanTarget}**'s Endless Tower set to **Floor ${fl}**!`, _serverId: srvId });
            } else if (action === 'pet') {
                const petId = String(value || 'ouroboros').toLowerCase();
                const allPets = ['mochi', 'tommy', 'garuda', 'sheshnag', 'chimera', 'ouroboros'];
                const prof = getSvProfile(cleanTarget);
                if (petId === 'all') { prof.ownedPets = [...allPets]; prof.activePet = 'ouroboros'; prof.activePet2 = 'chimera'; }
                else if (allPets.includes(petId)) { if (!prof.ownedPets.includes(petId)) prof.ownedPets.push(petId); prof.activePet = petId; }
                prof.petEssence = (prof.petEssence || 0) + 150;
                syncLive(cleanTarget);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🐉👑 **${cleanTarget}** received **${petId.toUpperCase()}** + **150🔮 Essence**!`, _serverId: srvId });
            } else if (action === 'gears') {
                const prof = getSvProfile(cleanTarget);
                prof.gears = { omegaCore: true, titanCrown: true };
                prof.hasStone = true;
                prof.freeFusionPasses = (prof.freeFusionPasses || 0) + 2;
                syncLive(cleanTarget);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `⚡🌌 **${cleanTarget}** received **Omega Core, Titan Crown, Awakening Stone & +2 Fusion Passes**!`, _serverId: srvId });
            } else if (action === 'bounty') {
                const amt = Math.max(0, Math.floor(Number(value) || 30000000));
                const prof = getSvProfile(cleanTarget);
                prof.bounty = amt;
                syncLive(cleanTarget);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🏴‍☠️👑 **${cleanTarget}**'s Bounty Honor set to **${amt.toLocaleString()}**!`, _serverId: srvId });
            } else if (action === 'reset') {
                const k = cleanTarget.toLowerCase();
                delete svPlayerStats[k];
                playerWallet.set(k, 150);
                saveEconomyDB();
                syncLive(cleanTarget);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🔄⚠️ **${cleanTarget}**'s profile was reset to starter defaults!`, _serverId: srvId });
            }
        });
    });
    // ============================================================================
    // 👑 CREATOR-ONLY HK GOD CONSOLE — PIECE 3A/3 (BUTTON & MODAL HTML)
    // ============================================================================
    const HK_CREATOR_PANEL_HTML = `
    <button id="hkCreatorFab" onclick="openHkCreatorModal()" style="display:none;position:fixed;bottom:16px;right:14px;z-index:9999997;background:linear-gradient(135deg,#f59e0b,#dc2626,#7e22ce);border:2px solid #fde047;color:#fff;border-radius:999px;padding:9px 14px;font-size:12px;font-weight:900;cursor:pointer;box-shadow:0 0 22px rgba(250,204,21,0.75);">👑 HK</button>

    <div id="hkCreatorModal" style="display:none;position:fixed;inset:0;background:rgba(4,6,15,0.95);z-index:9999999;align-items:center;justify-content:center;padding:10px;backdrop-filter:blur(10px);font-family:inherit;">
      <div style="background:linear-gradient(155deg,#0f172a,#2e1065,#450a0a);border:2px solid #facc15;border-radius:20px;padding:13px;width:100%;max-width:410px;max-height:92vh;overflow-y:auto;color:#fff;box-shadow:0 0 40px rgba(250,204,21,0.6);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-weight:900;font-size:14px;color:#fde047;">👑 HK SUPREME CREATOR CONSOLE</span>
          <button onclick="document.getElementById('hkCreatorModal').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:8px;padding:4px 9px;font-weight:bold;cursor:pointer;">✕</button>
        </div>

        <div style="background:rgba(0,0,0,0.4);border:1px solid #facc15;border-radius:12px;padding:8px;margin-bottom:8px;">
          <div style="font-size:10px;color:#fde047;font-weight:bold;margin-bottom:4px;">🎯 TARGET PLAYER (Pick Live or Type Exact Name):</div>
          <div style="display:flex;gap:5px;">
            <select id="hkPlayerDropdown" onchange="if(this.value)document.getElementById('hkTargetInput').value=this.value" style="flex:1;padding:7px;border-radius:9px;border:1px solid #38bdf8;background:#090d16;color:#fff;font-size:11px;">
              <option value="">-- Live Players --</option>
            </select>
            <input id="hkTargetInput" placeholder="Username..." style="flex:1;padding:7px;border-radius:9px;border:1px solid #facc15;background:#090d16;color:#fff;font-size:11px;">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
          <button onclick="runHkCmd('godmode')" style="padding:9px 6px;border:1.5px solid #fde047;border-radius:10px;background:linear-gradient(90deg,#d97706,#9333ea);color:#fff;font-weight:900;font-size:11px;cursor:pointer;">🔱 GOD MODE (MAX ALL)</button>
          <button onclick="runHkCmd('gears')" style="padding:9px 6px;border:1.5px solid #38bdf8;border-radius:10px;background:#0369a1;color:#fff;font-weight:900;font-size:11px;cursor:pointer;">⚡ Omega + Titan Gears</button>
        </div>

        <div style="background:rgba(255,255,255,0.06);border:1px solid #475569;border-radius:11px;padding:7px;margin-bottom:6px;">
          <div style="font-size:10px;color:#e879f9;font-weight:900;margin-bottom:4px;">🔱 FORGE GOD FUSION (1,000 HP / 320 True DMG)</div>
          <div style="display:flex;gap:5px;">
            <input id="hkFusionName" value="HARIHARA" placeholder="Fusion Name..." style="flex:1;padding:6px;border-radius:8px;border:1px solid #c084fc;background:#090d16;color:#fff;font-size:11px;">
            <button onclick="runHkCmd('godfusion',document.getElementById('hkFusionName').value)" style="background:#9333ea;border:none;color:#fff;padding:6px 10px;border-radius:8px;font-weight:900;font-size:11px;cursor:pointer;">Forge</button>
          </div>
        </div>

        <div style="background:rgba(255,255,255,0.06);border:1px solid #475569;border-radius:11px;padding:7px;margin-bottom:6px;">
          <div style="font-size:10px;color:#fde047;font-weight:900;margin-bottom:4px;">🪙 COINS & BOUNTY</div>
          <div style="display:flex;gap:4px;">
            <input id="hkCoinsVal" type="number" value="100000" style="width:90px;padding:6px;border-radius:8px;border:1px solid #facc15;background:#090d16;color:#fff;font-size:11px;">
            <button onclick="runHkCmd('coins',document.getElementById('hkCoinsVal').value)" style="flex:1;background:#16a34a;border:none;color:#fff;padding:6px;border-radius:8px;font-weight:900;font-size:11px;cursor:pointer;">+Give Coins</button>
            <button onclick="runHkCmd('bounty',30000000)" style="flex:1;background:#b45309;border:none;color:#fff;padding:6px;border-radius:8px;font-weight:900;font-size:11px;cursor:pointer;">🏴‍☠️ 30M Bounty</button>
          </div>
        </div>

        <div style="background:rgba(255,255,255,0.06);border:1px solid #475569;border-radius:11px;padding:7px;margin-bottom:6px;">
          <div style="font-size:10px;color:#38bdf8;font-weight:900;margin-bottom:4px;">🌟 UNLOCK POWER / SET V3 (100 WINS)</div>
          <div style="display:flex;gap:4px;">
            <select id="hkPowerSelect" style="flex:1;padding:6px;border-radius:8px;border:1px solid #38bdf8;background:#090d16;color:#fff;font-size:11px;">
              <option value="all">🌟 ALL POWERS</option>
              <option value="mahavishnu">🔱 MahaVishnu</option>
              <option value="mahadev">🔱 Mahadev</option>
              <option value="zoroking">⚔️ Zoro King of Hell</option>
              <option value="millyyt">🎬 Milly YT Queen</option>
              <option value="ishikastar">✨ Ishika Empress</option>
              <option value="antimpoke">⚡ Antim Sky Sov</option>
              <option value="moon">🌙 Dr. Moon</option>
              <option value="zoro">⚔️ Zoro 3-Sword</option>
            </select>
            <button onclick="runHkCmd('power',document.getElementById('hkPowerSelect').value)" style="background:#0284c7;border:none;color:#fff;padding:6px 9px;border-radius:8px;font-weight:900;font-size:11px;cursor:pointer;">Unlock</button>
            <button onclick="runHkCmd('v3',document.getElementById('hkPowerSelect').value)" style="background:#dc2626;border:none;color:#fff;padding:6px 9px;border-radius:8px;font-weight:900;font-size:11px;cursor:pointer;">Set V3</button>
          </div>
        </div>

        <div style="background:rgba(255,255,255,0.06);border:1px solid #475569;border-radius:11px;padding:7px;margin-bottom:6px;">
          <div style="font-size:10px;color:#4ade80;font-weight:900;margin-bottom:4px;">🏋️ TRAINING, TOWER & PETS</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;">
            <button onclick="runHkCmd('train',1000000)" style="background:#15803d;border:none;color:#fff;padding:6px 3px;border-radius:8px;font-weight:900;font-size:10px;cursor:pointer;">🏋️ 1M Train</button>
            <button onclick="runHkCmd('floor',100)" style="background:#1d4ed8;border:none;color:#fff;padding:6px 3px;border-radius:8px;font-weight:900;font-size:10px;cursor:pointer;">♾️ Floor 100</button>
            <button onclick="runHkCmd('pet','all')" style="background:#7e22ce;border:none;color:#fff;padding:6px 3px;border-radius:8px;font-weight:900;font-size:10px;cursor:pointer;">🐉 All Pets</button>
          </div>
        </div>

        <div style="display:flex;gap:5px;">
          <input id="hkAnnounceInput" placeholder="Server Announcement..." style="flex:1;padding:6px;border-radius:8px;border:1px solid #38bdf8;background:#090d16;color:#fff;font-size:11px;">
          <button onclick="runHkCmd('announce',document.getElementById('hkAnnounceInput').value);document.getElementById('hkAnnounceInput').value='';" style="background:#f59e0b;border:none;color:#111;padding:6px 10px;border-radius:8px;font-weight:900;font-size:11px;cursor:pointer;">📢</button>
          <button onclick="if(confirm('Reset this user profile?'))runHkCmd('reset')" style="background:#991b1b;border:none;color:#fff;padding:6px 9px;border-radius:8px;font-weight:900;font-size:11px;cursor:pointer;">🔄 Reset</button>
        </div>
      </div>
    </div>`;
    // ============================================================================
    // 👑 CREATOR-ONLY HK GOD CONSOLE — PIECE 3B/3 (CLIENT SCRIPT & INJECTOR)
    // ============================================================================
    const HK_CREATOR_PANEL_SCRIPT = `
    <script>
    (function() {
      let hkLivePlayers = [];

      window.openHkCreatorModal = function() {
        const mod = document.getElementById('hkCreatorModal');
        if (!mod) return;
        mod.style.display = 'flex';
        const sel = document.getElementById('hkPlayerDropdown');
        if (sel) {
          sel.innerHTML = '<option value="">-- Live Players --</option>';
          hkLivePlayers.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.username;
            opt.textContent = p.username;
            sel.appendChild(opt);
          });
        }
      };

      window.runHkCmd = function(action, value) {
        if (typeof socket === 'undefined') return;
        const target = (document.getElementById('hkTargetInput')?.value || '').trim();
        socket.emit('hkAdminExec', { action, target, value });
      };

      const waitHkSock = setInterval(() => {
        if (typeof socket === 'undefined' || window._hkCreatorHooked) return;
        window._hkCreatorHooked = true;
        clearInterval(waitHkSock);

        socket.on('hkAccessGranted', () => {
          const fab = document.getElementById('hkCreatorFab');
          if (fab) fab.style.display = 'block';
        });

        socket.on('updatePlayers', (list) => {
          if (Array.isArray(list)) hkLivePlayers = list;
        });

        socket.on('joinRoom', () => setTimeout(() => socket.emit('hkCheckAccess'), 600));
        socket.emit('hkCheckAccess');
        setInterval(() => socket.emit('hkCheckAccess'), 5000);
      }, 600);
    })();
    </script>`;

    const HK_CREATOR_PANEL_UI = HK_CREATOR_PANEL_HTML + '\n' + HK_CREATOR_PANEL_SCRIPT;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('hkCreatorModal')) {
                body = body.replace('</body>', HK_CREATOR_PANEL_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // ============================================================================
    // ??? ALL-IN-ONE IN-APP BROWSER & MULTI-DEVICE PATCH (PASTE BEFORE return OG_HOSTS;)
    // ============================================================================
    verifyPlayerAccountOwnership = function(uname, socket, forceRelink = false) {
        if (!uname || !socket) return false;
        const clean = uname.trim().toLowerCase();
        // Never lock default fallback names
        if (clean === 'player' || clean === 'guest') return true;
 
        const devId = socket.trackedDeviceId || null;
        const prof = getSvProfile(uname);
        if (!devId) return true;
 
        if (!prof.ownerDevId || forceRelink) {
            prof.ownerDevId = devId;
            saveSvStats();
            return true;
        }
        if (prof.ownerDevId !== devId) {
            socket.emit('svNotice', '??? "' + uname + '" is already claimed on another device! Use a unique name.');
            return false;
        }
        return true;
    };
 
    io.on('connection', (socket) => {
        // Ensure socket.username is always saved immediately on join
        socket.on('joinRoom', (data) => {
            if (data && data.username && data.username.trim()) {
                socket.username = data.username.trim();
            }
        });
 
        // Allow buying powers by label for 2-tap mobile/in-app browser support
        socket.on('svBuyPowerByLabel', (rawLabel) => {
            const cleanLabel = String(rawLabel || '').toLowerCase();
            const foundEntry = Object.entries(SV_DEFS).find(([, def]) =>
                def && def.cost && cleanLabel.includes(def.name.toLowerCase())
            );
            if (!foundEntry) return;
            const [pKey, def] = foundEntry;
            const uname = socket.username || 'Player';
            if (!verifyPlayerAccountOwnership(uname, socket, false)) return;
            const prof = getSvProfile(uname);
            if (prof.unlockedPowers.includes(pKey)) return;
            if (getCoins(uname) < def.cost) return socket.emit('svNotice', `?? Need ${def.cost} Coins!`);
            addCoins(uname, -def.cost);
            prof.unlockedPowers.push(pKey);
            saveSvStats();
            socket.emit('svStatsSync', getSvProfile(uname));
            socket.emit('svNotice', `?? Unlocked ${def.icon} ${def.name}!`);
        });
    });
 
    const IN_APP_BROWSER_PATCH_UI = `
    <script>
    (function() {
      if (window._inAppPatchApplied) return;
      window._inAppPatchApplied = true;
 
      // 1. Floating Toast Banner (replaces blocked alert() in WhatsApp/Instagram browsers)
      window.showSvToast = function(msg) {
        let toast = document.getElementById('svGlobalToast');
        if (!toast) {
          toast = document.createElement('div');
          toast.id = 'svGlobalToast';
          toast.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:99999999;background:linear-gradient(90deg,#1e1b4b,#581c87);border:2px solid #facc15;color:#fef08a;padding:10px 16px;border-radius:14px;font-size:12px;font-weight:900;text-align:center;max-width:340px;box-shadow:0 8px 25px rgba(0,0,0,0.8);transition:opacity 0.25s;pointer-events:none;';
          document.body.appendChild(toast);
        }
        toast.textContent = String(msg || '');
        toast.style.opacity = '1';
        toast.style.display = 'block';
        clearTimeout(window._svToastTimer);
        window._svToastTimer = setTimeout(() => {
          toast.style.opacity = '0';
          setTimeout(() => { toast.style.display = 'none'; }, 250);
        }, 3400);
      };
 
      window.alert = function(msg) { window.showSvToast(msg); };
 
      // 2. Replace blocked confirm() on locked powers with a 2-Tap Buy button
      document.addEventListener('click', function(e) {
        const btn = e.target && e.target.closest ? e.target.closest('#svPowerGrid .sv-pwr-btn.locked-coin') : null;
        if (!btn) return;
        e.preventDefault();
        e.stopImmediatePropagation();
 
        if (btn.dataset.armed !== '1') {
          btn.dataset.origLabel = btn.textContent;
          btn.dataset.armed = '1';
          btn.style.borderColor = '#4ade80';
          btn.style.background = 'rgba(22,163,74,0.3)';
          btn.textContent = '? Tap Again to Confirm Buy!';
          setTimeout(() => {
            if (btn.dataset.armed === '1') {
              btn.dataset.armed = '';
              btn.textContent = btn.dataset.origLabel || btn.textContent;
              btn.style.borderColor = '';
              btn.style.background = '';
            }
          }, 3000);
        } else {
          btn.dataset.armed = '';
          const orig = btn.dataset.origLabel || '';
          btn.textContent = '? Unlocking...';
          if (typeof socket !== 'undefined') {
            socket.emit('svBuyPowerByLabel', orig);
          }
        }
      }, true);
 
      // 3. Ensure global socket reference for Daily Wheel & inline buttons
      const syncSockRef = setInterval(() => {
        if (typeof socket !== 'undefined') {
          window.socket = socket;
          clearInterval(syncSockRef);
        }
      }, 400);
    })();
    </script>`;
 
    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('_inAppPatchApplied')) {
                body = body.replace('</body>', IN_APP_BROWSER_PATCH_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // ============================================================================
    // ?? SAMMUVERSE V5 EXPANSION - PIECE 1/3 (DATA, GEAR, EMOJI CAP & REBIRTH)
    // ============================================================================
    function keepLastThreeEmojis(str) {
        const s = String(str || '?').trim();
        if (typeof Intl !== 'undefined' && Intl.Segmenter) {
            const segs = Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)).map(x => x.segment);
            return segs.slice(-3).join('');
        }
        return Array.from(s).slice(-3).join('');
    }
 
    Object.values(SV_DEFS).forEach(d => {
        if (d && d.fused && d.icon) d.icon = keepLastThreeEmojis(d.icon);
    });
    Object.values(svPlayerStats).forEach(st => {
        if (Array.isArray(st.customPowers)) {
            st.customPowers.forEach(cp => {
                if (cp && cp.def && cp.def.icon) {
                    cp.def.icon = keepLastThreeEmojis(cp.def.icon);
                    if (SV_DEFS[cp.id]) SV_DEFS[cp.id].icon = cp.def.icon;
                }
            });
        }
    });
 
    const V5_CHAPTERS = [
        { ch: 1, title: '?? Ch.1: Whispering Dojo', stages: ['?? Rogue Disciple', '?? Shadow Wolf', '?? Dojo Sensei Boss'], pKey: 'rubber', baseHp: 210, baseAtk: 6, coins: 350, xp: 200, ess: 15, drop: 'soul' },
        { ch: 2, title: '?? Ch.2: Crimson Volcano', stages: ['?? Magma Salamander', '?? Flame Knight', '?? Magma Wyrm Boss'], pKey: 'fire', baseHp: 340, baseAtk: 14, coins: 700, xp: 450, ess: 30, drop: 'core' },
        { ch: 3, title: '?? Ch.3: Abyssal Trench', stages: ['?? Depth Stalker', '?? Kraken Tentacle', '?? Leviathan Boss'], pKey: 'water', baseHp: 520, baseAtk: 22, coins: 1200, xp: 800, ess: 50, drop: 'soul' },
        { ch: 4, title: '? Ch.4: Celestial Citadel', stages: ['?? Sky Valkyrie', '? Thunder Golem', '?? Raijin Sovereign Boss'], pKey: 'lightning', baseHp: 780, baseAtk: 30, coins: 2200, xp: 1400, ess: 80, drop: 'core' },
        { ch: 5, title: '?? Ch.5: Void Throne', stages: ['?? Void Phantom', '??? Singularity Knight', '?? Abyssal God Boss'], pKey: 'antimatter', baseHp: 1150, baseAtk: 40, coins: 5000, xp: 3000, ess: 150, drop: 'soul' },
        { ch: 6, title: '?? Ch.6: Frostbite Glacier', stages: ['?? Ice Direwolf', '?? Frost Giant', '?? Absolute Zero Monarch'], pKey: 'ice', baseHp: 1650, baseAtk: 52, coins: 8500, xp: 4500, ess: 200, drop: 'core' },
        { ch: 7, title: '?? Ch.7: Crimson Moon Palace', stages: ['?? Blood Knight', '?? Eclipse Assassin', '?? Demon Progenitor'], pKey: 'blood', baseHp: 2300, baseAtk: 65, coins: 13000, xp: 6500, ess: 260, drop: 'soul' },
        { ch: 8, title: '? Ch.8: Chrono Paradox Rift', stages: ['? Time Warden', '?? Reality Glitch', '? Chronos Sovereign'], pKey: 'chronovoid', baseHp: 3100, baseAtk: 80, coins: 19000, xp: 9000, ess: 340, drop: 'core' },
        { ch: 9, title: '?? Ch.9: Asura Hell Arena', stages: ['??? Enma Spirit', '?? Oni Warlord', '?? King of Hell Zoro'], pKey: 'zoroking', baseHp: 4200, baseAtk: 98, coins: 28000, xp: 13000,ess: 450, drop: 'soul' },
        { ch: 10, title: '?? Ch.10: Omni-Creator Realm', stages: ['?? Astral Seraph', '?? Cosmic Avatar', '?? MahaVishnu Supreme'], pKey: 'mahavishnu', baseHp: 5800, baseAtk: 120,coins: 45000, xp: 20000,ess: 650, drop: 'core' }
    ];
 
    const V5_GEAR_CATALOG = {
        weapon: [
            { tier: 0, name: 'None', atk: 0, crit: 0, cost: 0, souls: 0 },
            { tier: 1, name: '??? Iron Katana [Common]', atk: 18, crit: 0.04, cost: 600, souls: 1 },
            { tier: 2, name: '? Raijin Blade [Rare]', atk: 42, crit: 0.09, cost: 2500, souls: 3 },
            { tier: 3, name: '?? Enma Hellblade [Epic]', atk: 85, crit: 0.15, cost: 9000, souls: 7 },
            { tier: 4, name: '?? Sudarshana Edge [Mythic]', atk: 165, crit: 0.25, cost: 28000, souls: 15 }
        ],
        armor: [
            { tier: 0, name: 'None', hp: 0, red: 0, cost: 0, cores: 0 },
            { tier: 1, name: '?? Dojo Gi [Common]', hp: 120, red: 0.04, cost: 600, cores: 1 },
            { tier: 2, name: '??? Aegis Plate [Rare]', hp: 300, red: 0.09, cost: 2500, cores: 3 },
            { tier: 3, name: '?? Shadow Cloak [Epic]', hp: 650, red: 0.15, cost: 9000, cores: 7 },
            { tier: 4, name: '?? Celestial Kavach [Mythic]', hp: 1350, red: 0.24, cost: 28000, cores: 15 }
        ],
        charm: [
            { tier: 0, name: 'None', steal: 0, energy: 0, cost: 0, souls: 0 },
            { tier: 1, name: '?? Spirit Bead [Common]', steal: 0.04, energy: 10, cost: 600, souls: 1 },
            { tier: 2, name: '?? Crimson Fang [Rare]', steal: 0.09, energy: 20, cost: 2500, souls: 3 },
            { tier: 3, name: '? Chrono Relic [Epic]', steal: 0.14, energy: 35, cost: 9000, souls: 7 },
            { tier: 4, name: '?? Omni Crown [Mythic]', steal: 0.22, energy: 50, cost: 28000, souls: 15 }
        ]
    };
 
    function ensureV5Profile(uname) {
        const prof = getSvProfile(uname);
        const today = new Date().toISOString().slice(0, 10);
        if (!prof.v5) {
            prof.v5 = {
                stars: {}, difficulty: 'normal', bossSouls: 0, elemCores: 0,
                equip: { weapon: 0, armor: 0, charm: 0 }, rebirths: 0,
                questDay: today, quests: { stages: 0, wins: 0, trains: 0, dmg: 0, claimed: false }
            };
        }
        if (prof.v5.questDay !== today) {
            prof.v5.questDay = today;
            prof.v5.quests = { stages: 0, wins: 0, trains: 0, dmg: 0, claimed: false };
        }
        (prof.customPowers || []).forEach(cp => {
            if (cp && cp.def && cp.def.icon) {
                cp.def.icon = keepLastThreeEmojis(cp.def.icon);
                if (SV_DEFS[cp.id]) SV_DEFS[cp.id].icon = cp.def.icon;
            }
        });
        return prof;
    }
 
    const _origGetSvProfileV5 = getSvProfile;
    getSvProfile = function(uname) {
        const p = _origGetSvProfileV5(uname);
        if (!p.v5) {
            p.v5 = {
                stars: {}, difficulty: 'normal', bossSouls: 0, elemCores: 0,
                equip: { weapon: 0, armor: 0, charm: 0 }, rebirths: 0,
                questDay: new Date().toISOString().slice(0, 10),
                quests: { stages: 0, wins: 0, trains: 0, dmg: 0, claimed: false }
            };
        }
        (p.customPowers || []).forEach(cp => {
            if (cp && cp.def && cp.def.icon) {
                cp.def.icon = keepLastThreeEmojis(cp.def.icon);
                if (SV_DEFS[cp.id]) SV_DEFS[cp.id].icon = cp.def.icon;
            }
        });
        return p;
    };
 
    const _origBuildFighterV5 = buildFighterObj;
    buildFighterObj = function(sockId, uname, powKey, customHp, customAtk, isBot = false, botId = null) {
        const f = _origBuildFighterV5(sockId, uname, powKey, customHp, customAtk, isBot, botId);
        if (isBot) return f;
        const prof = ensureV5Profile(uname);
        const v5 = prof.v5;
        const w = V5_GEAR_CATALOG.weapon[v5.equip.weapon || 0];
        const a = V5_GEAR_CATALOG.armor[v5.equip.armor || 0];
        const c = V5_GEAR_CATALOG.charm[v5.equip.charm || 0];
        const rebMult = 1 + ((v5.rebirths || 0) * 0.25);
 
        f.maxHp = Math.round((f.maxHp + a.hp) * rebMult);
        f.hp = f.maxHp;
        f.bonusAtk = Math.round((f.bonusAtk + w.atk) * rebMult);
        f.energy = Math.min(100, (f.energy || 50) + c.energy);
        f.trainBonus = { ...(f.trainBonus || {}), critChance: Math.min(0.75, (f.trainBonus?.critChance || 0) + w.crit) };
        if (a.red > 0) f.def = { ...f.def, passiveRed: Math.min(0.75, (f.def.passiveRed || 0) + a.red) };
        if (c.steal > 0) f.enchant = { ...(f.enchant || { mult: 1, red: 0, heal: 0 }), heal: (f.enchant?.heal || 0) + c.steal };
        return f;
    };
 
    const _prevIoToV5 = io.to.bind(io);
    io.to = function(room) {
        const bc = _prevIoToV5(room);
        const origEmit = bc.emit.bind(bc);
        bc.emit = function(ev, payload, ...rest) {
            if (ev === 'message' && payload && typeof payload === 'object' && payload.username) {
                const rawClean = String(payload.username).replace(/^\[.*?\]\s*/g, '');
                const st = svPlayerStats[rawClean.toLowerCase().trim()];
                if (st && st.v5 && st.v5.rebirths > 0 && !String(payload.username).includes('??R')) {
                    payload = { ...payload, username: `[??R${st.v5.rebirths}] ${payload.username}` };
                }
            }
            return origEmit(ev, payload, ...rest);
        };
        return bc;
 
  };
    // ============================================================================
    // ?? SAMMUVERSE V5 EXPANSION - PART A/3 (STAGE ENGINE & REWARDS)
    // ============================================================================
    function launchV5Stage(socket, chNum, stgNum, powKey, diff, coopPartnerName) {
        const srvId = socket.activeServerId;
        const uname = socket.username || 'Hero';
        const chObj = V5_CHAPTERS.find(c => c.ch === chNum) || V5_CHAPTERS.at(0);
        const stageIdx = Math.max(0, Math.min(2, (stgNum || 1) - 1));
        const enemyName = chObj.stages.at(stageIdx);
        const diffMode = ['normal', 'hard', 'nightmare'].includes(diff) ? diff : 'normal';
        const diffMult = diffMode === 'nightmare' ? 2.4 : (diffMode === 'hard' ? 1.55 : 1.0);
        const stgMult = stageIdx === 2 ? 1.45 : (stageIdx === 1 ? 1.18 : 1.0);
 
        const p1 = buildFighterObj(socket.id, uname, powKey || 'fire');
        if (coopPartnerName) {
            const partnerProf = ensureV5Profile(coopPartnerName);
            p1.maxHp += 180 + ((partnerProf.hpLv || 0) * 25) + ((partnerProf.v5?.rebirths || 0) * 150);
            p1.hp = p1.maxHp;
            p1.bonusAtk += 25 + ((partnerProf.atkLv || 0) * 5) + ((partnerProf.v5?.rebirths || 0) * 30);
            p1.name = `${uname} + ?? ${coopPartnerName}`;
        }
 
        const hp = Math.round(chObj.baseHp * stgMult * diffMult);
        const atk = Math.round(chObj.baseAtk * stgMult * diffMult);
        const p2 = buildFighterObj('ADV_FOE', `${enemyName} [${diffMode.toUpperCase()}]`, chObj.pKey, hp, atk, true, 'ADV_FOE');
        p2.isV2 = chNum >= 3 || diffMode !== 'normal';
        p2.isV3 = chNum >= 5 || diffMode === 'nightmare';
 
        const battleId = 'adv5_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const battle = {
            id: battleId, srvId, isAdventureV5: true,
            advChapter: chNum, advStage: stgNum, advDiff: diffMode, advTitle: chObj.title,
            coopPartner: coopPartnerName || null,
            turn: 1, timeLeft: 15,
            lastLog: `??? <b>${chObj.title} (${diffMode.toUpperCase()} • Stage ${stgNum}/3)</b> - <b>${enemyName}</b> blocks your path!`,
            p1, p2, interval: null
        };
        svBattles.set(battleId, battle);
        battle.interval = setInterval(() => {
            const cur = svBattles.get(battleId);
            if (!cur) return;
            cur.timeLeft--;
            if (cur.timeLeft <= 0) resolveSvTurn(battleId);
            else syncSvBattle(cur, null);
        }, 1000);
        syncSvBattle(battle, 'atk');
    }
 
    const _prevFinishSvBattleV5 = finishSvBattle;
    finishSvBattle = function(battleId, b) {
        if (!b) return;
        if (!b.p1.isBot && b.p1.hp > b.p2.hp) {
            const cleanP1 = b.p1.name.split(' + ?? ').at(0);
            const qp = ensureV5Profile(cleanP1);
            qp.v5.quests.wins = (qp.v5.quests.wins || 0) + 1;
            qp.v5.quests.dmg = (qp.v5.quests.dmg || 0) + b.p2.maxHp;
        }
 
        if (!b.isAdventureV5) return _prevFinishSvBattleV5(battleId, b);
 
        clearInterval(b.interval);
        svBattles.delete(battleId);
        const p1Won = b.p1.hp > b.p2.hp;
        const pSock = io.sockets.sockets.get(b.p1.id);
        io.to(b.p1.id).emit('svBattleEnd', { won: p1Won, _serverId: b.srvId });
 
        const cleanName = b.p1.name.split(' + ?? ').at(0);
        if (!p1Won || !pSock) {
            io.to(b.srvId).emit('message', {
                username: "Sammu's Bot",
                text: `????? **STAGE DEFEAT!** **${b.p1.name}** fell in **${b.advTitle}** (${b.advDiff.toUpperCase()})! Upgrade Gear or bring a Co-Op partner!`,
                _serverId: b.srvId
            });
            return;
        }
 
        const prof = ensureV5Profile(cleanName);
        const v5 = prof.v5;
        const chObj = V5_CHAPTERS.find(c => c.ch === b.advChapter) || V5_CHAPTERS.at(0);
        const isBoss = b.advStage >= 3;
        const diffMult = b.advDiff === 'nightmare' ? 2.5 : (b.advDiff === 'hard' ? 1.6 : 1.0);
 
        let starsEarned = 1;
        if (b.p1.hp >= Math.round(b.p1.maxHp * 0.5)) starsEarned = 2;
        if (b.p1.hp >= Math.round(b.p1.maxHp * 0.5) && b.turn <= 4) starsEarned = 3;
 
        const starKey = `${b.advChapter}_${b.advStage}_${b.advDiff}`;
        v5.stars[starKey] = Math.max(v5.stars[starKey] || 0, starsEarned);
 
        const cGain = Math.round((isBoss ? chObj.coins : chObj.coins * 0.45) * diffMult);
        const xpGain = Math.round((isBoss ? chObj.xp : chObj.xp * 0.45) * diffMult);
        const essGain = Math.round((isBoss ? chObj.ess : chObj.ess * 0.45) * diffMult);
 
        addCoins(cleanName, cGain);
        prof.training.xp = (prof.training.xp || 0) + xpGain;
        prof.petEssence = (prof.petEssence || 0) + essGain;
        v5.quests.stages = (v5.quests.stages || 0) + 1;
        v5.quests.wins = (v5.quests.wins || 0) + 1;
        v5.quests.dmg = (v5.quests.dmg || 0) + b.p2.maxHp;
 
        let dropText = '';
        if (isBoss || Math.random() < 0.45) {
            if (chObj.drop === 'soul') { v5.bossSouls = (v5.bossSouls || 0) + 1; dropText = ' + ?? **1x Boss Soul**'; }
            else { v5.elemCores = (v5.elemCores || 0) + 1; dropText = ' + ?? **1x Elemental Core**'; }
        }
        if (b.coopPartner) {
            addCoins(b.coopPartner, Math.round(cGain * 0.5));
            const pPartner = ensureV5Profile(b.coopPartner);
            pPartner.petEssence = (pPartner.petEssence || 0) + Math.round(essGain * 0.5);
        }
 
        const adv = prof.adventure || { chapter: 1, stage: 1, cleared: false };
        if (adv.chapter === b.advChapter && adv.stage === b.advStage) {
            if (adv.stage < 3) adv.stage++;
            else if (adv.chapter < 10) { adv.chapter++; adv.stage = 1; }
            else adv.cleared = true;
        }
 
        syncPlayerTitlesAndBounty(cleanName);
        saveSvStats();
        pSock.emit('svStatsSync', ensureV5Profile(cleanName));
        io.to(b.srvId).emit('message', {
            username: "Sammu's Bot",
            text: `???${'?'.repeat(starsEarned)} **STAGE CLEARED!** **${b.p1.name}** conquered **${b.p2.name}** (+
${cGain.toLocaleString()}??, +${xpGain}? XP, +${essGain}??${dropText})!`,
            _serverId: b.srvId
        });
    };
    // ============================================================================
    // ?? SAMMUVERSE V5 EXPANSION - PART B/3 (SOCKET LISTENERS)
    // ============================================================================
    io.on('connection', (socket) => {
        socket.on('svTrainAction', () => {
            const uname = socket.username;
            if (!uname) return;
            const prof = ensureV5Profile(uname);
            prof.v5.quests.trains = (prof.v5.quests.trains || 0) + 1;
            saveSvStats();
            socket.emit('svStatsSync', prof);
        });
 
        socket.on('svStartStageV5', ({ ch, stg, power, diff, coopPartner }) => {
            if (!socket.activeServerId || findPlayerActiveSvBattle(socket.id)) {
                return socket.emit('svNotice', '?? Finish your current battle first!');
            }
            launchV5Stage(socket, Number(ch) || 1, Number(stg) || 1, power || 'fire', diff || 'normal', coopPartner || '');
        });
 
        socket.on('svUpgradeGearV5', (slot) => {
            const uname = socket.username || 'Player';
            if (!verifyPlayerAccountOwnership(uname, socket, false) || !['weapon', 'armor', 'charm'].includes(slot)) return;
            const prof = ensureV5Profile(uname);
            const v5 = prof.v5;
            const curTier = v5.equip[slot] || 0;
            const nextItem = V5_GEAR_CATALOG[slot].at(curTier + 1);
            if (!nextItem) return socket.emit('svNotice', '?? Already at MYTHIC Max Tier!');
 
            if (getCoins(uname) < nextItem.cost) return socket.emit('svNotice', `?? Need ${nextItem.cost.toLocaleString()} Coins!`);
            if (nextItem.souls && (v5.bossSouls || 0) < nextItem.souls) return socket.emit('svNotice', `?? Need ${nextItem.souls} Boss Souls!`);
            if (nextItem.cores && (v5.elemCores || 0) < nextItem.cores) return socket.emit('svNotice', `?? Need ${nextItem.cores} Elemental Cores!`);
 
            addCoins(uname, -nextItem.cost);
            if (nextItem.souls) v5.bossSouls -= nextItem.souls;
            if (nextItem.cores) v5.elemCores -= nextItem.cores;
            v5.equip[slot] = curTier + 1;
 
            saveSvStats();
            socket.emit('svStatsSync', ensureV5Profile(uname));
            socket.emit('svNotice', `?? Upgraded ${slot.toUpperCase()} to ${nextItem.name}!`);
        });
 
        socket.on('svClaimDailyQuestV5', () => {
            const uname = socket.username || 'Player';
            const prof = ensureV5Profile(uname);
            const q = prof.v5.quests;
            if (q.claimed) return socket.emit('svNotice', '? Daily Mythic Crate already claimed today!');
            if ((q.stages || 0) < 2 || (q.wins || 0) < 1 || (q.trains || 0) < 3 || (q.dmg || 0) < 500) {
                return socket.emit('svNotice', '?? Complete all 4 Daily Quests first!');
            }
            q.claimed = true;
            addCoins(uname, 3000);
            prof.petEssence = (prof.petEssence || 0) + 50;
            prof.freeFusionPasses = (prof.freeFusionPasses || 0) + 1;
            saveSvStats();
            socket.emit('svStatsSync', ensureV5Profile(uname));
            socket.emit('svNotice', '???? DAILY MYTHIC CRATE OPENED! +3,000??, +50?? Essence & +1 Free Fusion Pass!');
        });
 
        socket.on('svRebirthV5', () => {
            const uname = socket.username || 'Player';
            if (!verifyPlayerAccountOwnership(uname, socket, false)) return;
            const prof = ensureV5Profile(uname);
            const canRebirth = (prof.maxTowerFloor || 1) >= 25 || (prof.adventure?.chapter || 1) >= 5 || prof.adventure?.cleared;
            if (!canRebirth) return socket.emit('svNotice', '?? Reach Tower Floor 25 or Adventure Chapter 5 to Rebirth!');
 
            prof.v5.rebirths = (prof.v5.rebirths || 0) + 1;
            prof.atkLv = 0;
            prof.hpLv = 0;
            prof.adventure = { chapter: 1, stage: 1, cleared: false };
            addCoins(uname, 5000);
            saveSvStats();
            socket.emit('svStatsSync', ensureV5Profile(uname));
            io.to(socket.activeServerId).emit('message', {
                username: "Sammu's Bot",
                text: `???? **REBIRTH ASCENSION!** **${uname}** reached **Rebirth ${prof.v5.rebirths}** (+${prof.v5.rebirths * 25}% Permanent All-Stats & Chat Badge)!`,
       
        _serverId: socket.activeServerId
            });
        });
    });
    // ============================================================================
    // ?? SAMMUVERSE V5 - PART C-1 (10-REALM STORY & CO-OP UI)
    // ============================================================================
    const V5_UI_C1 = `
    <script>
    (function() {
      if (window._svV5Installed) return;
      window._svV5Installed = true;
 
      const V5_CH_CLIENT = [
        { ch: 1, title: '?? Ch.1: Whispering Dojo', reward: '350?? • ?? Soul' },
        { ch: 2, title: '?? Ch.2: Crimson Volcano', reward: '700?? • ?? Core' },
        { ch: 3, title: '?? Ch.3: Abyssal Trench', reward: '1.2k?? • ?? Soul' },
        { ch: 4, title: '? Ch.4: Celestial Citadel', reward: '2.2k?? • ?? Core' },
        { ch: 5, title: '?? Ch.5: Void Throne', reward: '5.0k?? • ?? Soul' },
        { ch: 6, title: '?? Ch.6: Frostbite Glacier', reward: '8.5k?? • ?? Core' },
        { ch: 7, title: '?? Ch.7: Crimson Moon Palace', reward: '13k?? • ?? Soul' },
        { ch: 8, title: '? Ch.8: Chrono Paradox Rift', reward: '19k?? • ?? Core' },
        { ch: 9, title: '?? Ch.9: Asura Hell Arena', reward: '28k?? • ?? Soul' },
        { ch: 10, title: '?? Ch.10: Omni-Creator Realm', reward: '45k?? • ?? Core' }
      ];
 
      window._v5Diff = 'normal';
      window._v5Coop = '';
 
      function keep3EmojisClient(str) {
        const s = String(str || '?').trim();
        if (typeof Intl !== 'undefined' && Intl.Segmenter) {
          return Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)).map(x => x.segment).slice(-3).join('');
        }
        return Array.from(s).slice(-3).join('');
      }
 
      window.renderV5StoryMode = function() {
        const prof = window._latestSvProf || {};
        const v5 = prof.v5 || { stars: {}, bossSouls: 0, elemCores: 0 };
 
        document.querySelectorAll('#svPowerGrid .sv-pwr-btn').forEach(btn => {
          const txt = btn.textContent || '';
          if (txt.includes('[#')) {
                        let parts = txt.split(' ');
            const first = parts.at(0);
            if (first && Array.from(first).length > 4) {
              parts[0] = keep3EmojisClient(first);
              btn.textContent = parts.join(' ');
       
    }
          }
        });
 
        const advPanel = document.getElementById('svAdvPanel');
        const listBox = document.getElementById('svAdventureChaptersList');
        if (!advPanel || !listBox) return;
 
        let toolbar = document.getElementById('v5StoryToolbar');
        if (!toolbar) {
          toolbar = document.createElement('div');
          toolbar.id = 'v5StoryToolbar';
          toolbar.style.cssText = 'background:#090d16;border:1px solid #38bdf8;border-radius:11px;padding:7px;margin-bottom:8px;font-size:11px;';
          advPanel.insertBefore(toolbar, listBox);
        }
 
        const totalStars = Object.values(v5.stars || {}).reduce((a, b) => a + b, 0);
        const liveOpts = Array.from(document.querySelectorAll('#svOpponentSelect option'))
          .filter(o => !o.value.startsWith('BOT_'))
          .map(o => {
            const cleanN = o.textContent.split(' (').at(0).replace('?? ', '');
            return '<option value="' + cleanN + '"' + (window._v5Coop === cleanN ? ' selected' : '') + '>?? Co-Op: ' + cleanN + '</option>';
          }).join('');
 
        toolbar.innerHTML =
          '<div style="display:flex;justify-content:space-between;font-weight:900;color:#fde047;margin-bottom:5px;">' +
            '<span>? Stars: ' + totalStars + '/90</span>' +
            '<span>?? Souls: ' + (v5.bossSouls || 0) + ' | ?? Cores: ' + (v5.elemCores || 0) + '</span>' +
          '</div>' +
          '<div style="display:flex;gap:4px;margin-bottom:5px;">' +
            new Array('normal', 'hard', 'nightmare').map(d =>
              '<button onclick="window._v5Diff=\\'' + d + '\\';renderV5StoryMode()" style="flex:1;padding:5px;border-radius:8px;border:1px solid #facc15;background:' + (window._v5Diff === d ? '#d97706' : '#1e293b') + ';color:#fff;font-weight:900;font-size:10px;cursor:pointer;">' + d.toUpperCase() + '</button>'
            ).join('') +
          '</div>' +
          '<select onchange="window._v5Coop=this.value" style="width:100%;padding:5px;border-radius:8px;border:1px solid #4ade80;background:#1e293b;color:#fff;font-size:10px;">' +
            '<option value="">?? Solo Stage Run (Or Pick Co-Op Partner)</option>' + liveOpts +
          '</select>';
 
        const adv = prof.adventure || { chapter: 1, stage: 1, cleared: false };
        listBox.innerHTML = V5_CH_CLIENT.map(c => {
          const unlocked = adv.cleared || adv.chapter >= c.ch;
          const curStg = (!adv.cleared && adv.chapter === c.ch) ? (adv.stage || 1) : 3;
          const s1 = v5.stars?.[c.ch + '_1_' + window._v5Diff] || 0;
          const s2 = v5.stars?.[c.ch + '_2_' + window._v5Diff] || 0;
          const s3 = v5.stars?.[c.ch + '_3_' + window._v5Diff] || 0;
          const stageBtns = new Array(1, 2, 3).map(stNum => {
            const canPlay = adv.cleared || adv.chapter > c.ch || stNum <= curStg;
            const stStars = stNum === 1 ? s1 : (stNum === 2 ? s2 : s3);
            return '<button ' + (canPlay ? '' : 'disabled') + ' onclick="socket.emit(\\'svStartStageV5\\',{ch:' + c.ch + ',stg:' + stNum + ',power:window._curSvPow||\\'fire\\',diff:window._v5Diff,coopPartner:window._v5Coop})" style="padding:5px 2px;border:none;border-radius:7px;background:' + (canPlay ? '#16a34a' : '#334155') + ';color:#fff;font-size:10px;font-weight:bold;cursor:pointer;">' +
              (canPlay ? ('S' + stNum + ' ' + '?'.repeat(stStars)) : '?? S' + stNum) + '</button>';
          }).join('');
 
          return '<div class="sv-shop-card" style="border-color:' + (unlocked ? '#38bdf8' : '#334155') + ';flex-direction:column;align-items:stretch;gap:5px;">' +
            '<div style="display:flex;justify-content:space-between;">' +
              '<b style="color:' + (unlocked ? '#fde047' : '#94a3b8') + ';">' + c.title + '</b>' +
              '<span style="color:#4ade80;font-weight:bold;">' + c.reward + '</span>' +
            '</div>' +
            (unlocked ? '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;">' + stageBtns + '</div>' : '<div style="font-size:10px;color:#94a3b8;">?? Clear Chapter ' + (c.ch - 1) + ' first</
div>') +
          '</div>';
        }).join('');
      };
    `;
    // ============================================================================
    // ?? SAMMUVERSE V5 - PART C-2 (GEAR FORGE, DAILY QUESTS & REBIRTH UI)
    // ============================================================================
    const V5_UI_C2 = `
      const V5_GEAR_UI = {
        weapon: new Array('None', '??? Iron Katana (600??+1??)', '? Raijin Blade (2.5k??+3??)', '?? Enma Hellblade (9k??+7??)', '?? Sudarshana Edge (28k??+15??)'),
        armor: new Array('None', '?? Dojo Gi (600??+1??)', '??? Aegis Plate (2.5k??+3??)', '?? Shadow Cloak (9k??+7??)', '?? Celestial Kavach (28k??+15??)'),
        charm: new Array('None', '?? Spirit Bead (600??+1??)', '?? Crimson Fang (2.5k??+3??)', '? Chrono Relic (9k??+7??)', '?? Omni Crown (28k??+15??)')
      };
 
      window.renderV5DojoAndQuests = function() {
        const prof = window._latestSvProf || {};
        const v5 = prof.v5 || { bossSouls: 0, elemCores: 0, equip: { weapon: 0, armor: 0, charm: 0 }, rebirths: 0, quests: {} };
        const dojoPanel = document.getElementById('svDojoPanel');
        if (!dojoPanel) return;
 
        let v5Box = document.getElementById('v5DojoExpansionBox');
        if (!v5Box) {
          v5Box = document.createElement('div');
          v5Box.id = 'v5DojoExpansionBox';
          dojoPanel.insertBefore(v5Box, dojoPanel.children.at(1) || dojoPanel.firstChild);
        }
 
        const q = v5.quests || { stages: 0, wins: 0, trains: 0, dmg: 0, claimed: false };
        const wLv = v5.equip?.weapon || 0;
        const aLv = v5.equip?.armor || 0;
        const cLv = v5.equip?.charm || 0;
 
        v5Box.innerHTML =
          '<div style="background:rgba(56,189,248,0.12);border:1.5px solid #38bdf8;border-radius:11px;padding:8px;margin-bottom:7px;text-align:left;">' +
            '<div style="font-size:11px;font-weight:900;color:#7dd3fc;margin-bottom:5px;">?? 3-SLOT GEAR FORGE (??' + (v5.bossSouls || 0) + ' Souls | ??' + (v5.elemCores || 0) + ' Cores)</div>' +
            '<div class="sv-shop-card"><div><b>?? Weapon:</b> ' + V5_GEAR_UI.weapon.at(wLv) + '<br><span style="color:#fde047;">Next: ' + (V5_GEAR_UI.weapon.at(wLv + 1) || 'MAXED ??') + '</span></div><button ' + (wLv >= 4 ? 'disabled' : '') + ' onclick="socket.emit(\\'svUpgradeGearV5\\',\\'weapon\\')" style="background:#0284c7;border:none;color:#fff;padding:6px 8px;border-radius:8px;font-weight:900;cursor:pointer;">' + (wLv >= 4 ? 'MAX' : 'Forge') + '</button></div>' +
            '<div class="sv-shop-card"><div><b>??? Armor:</b> ' + V5_GEAR_UI.armor.at(aLv) + '<br><span style="color:#fde047;">Next: ' + (V5_GEAR_UI.armor.at(aLv + 1) || 'MAXED ??') + '</span></div><button ' + (aLv >= 4 ? 'disabled' : '') + ' onclick="socket.emit(\\'svUpgradeGearV5\\',\\'armor\\')" style="background:#0284c7;border:none;color:#fff;padding:6px 8px;border-radius:8px;font-weight:900;cursor:pointer;">' + (aLv >= 4 ? 'MAX' : 'Forge') + '</button></div>' +
            '<div class="sv-shop-card"><div><b>?? Charm:</b> ' + V5_GEAR_UI.charm.at(cLv) + '<br><span style="color:#fde047;">Next: ' + (V5_GEAR_UI.charm.at(cLv + 1) || 'MAXED ??') + '</span></div><button ' + (cLv >= 4 ? 'disabled' : '') + ' onclick="socket.emit(\\'svUpgradeGearV5\\',\\'charm\\')" style="background:#0284c7;border:none;color:#fff;padding:6px 8px;border-radius:8px;font-weight:900;cursor:pointer;">' + (cLv >= 4 ? 'MAX' : 'Forge') + '</button></div>' +
          '</div>' +
 
          '<div style="background:rgba(250,204,21,0.12);border:1.5px solid #facc15;border-radius:11px;padding:8px;margin-bottom:7px;text-align:left;">' +
            '<div style="font-size:11px;font-weight:900;color:#fde047;margin-bottom:4px;">?? DAILY QUESTS (Reward: 3,000?? + 50?? + Free Fusion)</div>' +
            '<div style="font-size:10px;color:#e2e8f0;line-height:1.5;">' +
              '• Clear 2 Stages: <b>' + Math.min(2, q.stages || 0) + '/2</b> ' + ((q.stages || 0) >= 2 ? '?' : '') + '<br>' +
              '• Win 1 Battle: <b>' + Math.min(1, q.wins || 0) + '/1</b> ' + ((q.wins || 0) >= 1 ? '?' : '') + '<br>' +
              '• Train 3 Times: <b>' + Math.min(3, q.trains || 0) + '/3</b> ' + ((q.trains || 0) >= 3 ? '?' : '') + '<br>' +
              '• Deal 500 DMG: <b>' + Math.min(500, q.dmg || 0) + '/500</b> ' + ((q.dmg || 0) >= 500 ? '?' : '') +
            '</div>' +
            '<button ' + (q.claimed ? 'disabled' : '') + ' onclick="socket.emit(\\'svClaimDailyQuestV5\\')" style="width:100%;margin-top:5px;padding:7px;border:none;border-radius:8px;background:' + (q.claimed ? '#334155' : 'linear-gradient(90deg,#f59e0b,#ec4899)') + ';color:#fff;font-weight:900;font-size:11px;cursor:pointer;">' + (q.claimed ? '? Daily Mythic Crate Claimed' : '?? Claim Daily Mythic Crate!') + '</button>' +
          '</div>' +
 
          '<div class="sv-shop-card" style="border-color:#e879f9;">' +
            '<div><b style="color:#f0abfc;">?? Rebirth Ascension (Rebirth ' + (v5.rebirths || 0) + ')</b><br><span style="color:#cbd5e1;">Permanent +' + (((v5.rebirths || 0) + 1) * 25) + '% All-Stats & [??R' + ((v5.rebirths || 0) + 1) + '] Badge</span></div>' +
            '<button onclick="socket.emit(\\'svRebirthV5\\')" style="background:#9333ea;border:none;color:#fff;padding:6px 10px;border-radius:8px;font-weight:900;cursor:pointer;">?? Rebirth</button>' +
          '</div>';
      };
 
      setInterval(() => {
        if (typeof window.renderV5StoryMode === 'function') window.renderV5StoryMode();
        if (typeof window.renderV5DojoAndQuests === 'function') window.renderV5DojoAndQuests();
      }, 1200);
    })();
    </script>`;
 
    const V5_EXPANSION_UI = V5_UI_C1 + '\n' + V5_UI_C2;
 
    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('_svV5Installed')) {
                body = body.replace('</body>', V5_EXPANSION_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
     // ============================================================================
    // ?? ADMIN /UNLOCKUSER COMMAND (UNLOCKS DEVICE LOCK WITHOUT WIPING STATS)
    // ============================================================================
    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof raw !== 'string') return;
            const clean = raw.trim();
            const low = clean.toLowerCase();
            const sender = (socket.username || (payload && payload.username) || '').toLowerCase().trim();
 
            // Auto-relink SammuVerse RPG lock when an OG Host uses a Master Key
            if (MASTER_KEYS.has(clean) && OG_HOSTS.has(sender)) {
                const prof = getSvProfile(sender);
                if (socket.trackedDeviceId) {
                    prof.ownerDevId = socket.trackedDeviceId;
                    saveSvStats();
                    socket.emit('svStatsSync', prof);
                }
                socket.emit('svNotice', `?? OG Host & RPG Account re-linked to this phone for ${sender}!`);
                return;
            }
 
            // Admin check (#hazmolerangola or Creators sammu/samaksh)
            const isAdmin = Boolean(
                socket.isHazmoleAdmin ||
                unlockedCommandAdmins.has(sender) ||
                sender === 'sammu' ||
                sender === 'samaksh'
            );
            if (!isAdmin) return;
 
            if (low.startsWith('/unlockuser ') || low.startsWith('/unlock ')) {
                const argStr = low.startsWith('/unlockuser ') ? clean.slice(12) : clean.slice(8);
                const target = argStr.replace(/^@/, '').trim().toLowerCase();
                if (!target) {
                    return socket.emit('message', { username: 'SYSTEM', text: '?? Usage: `/unlockuser @moon`', _serverId: srvId });
                }
 
                // 1. Clear OG Host Triple-Lock
                if (lockedOGSignatures[target]) {
                    delete lockedOGSignatures[target];
                    saveDB();
                }
 
                // 2. Clear SammuVerse RPG Device Lock (keeps all coins, powers & stats)
                const prof = getSvProfile(target);
                delete prof.ownerDevId;
                saveSvStats();
 
                // 3. Re-bind & notify immediately if the user is currently in the room
                for (const [, s] of io.sockets.sockets) {
                    if (s && s.username && s.username.toLowerCase().trim() === target) {
                        if (s.trackedDeviceId) {
                            prof.ownerDevId = s.trackedDeviceId;
                            saveSvStats();
                        }
                        s.emit('svStatsSync', prof);
                        s.emit('svNotice', ` Your account (${target}) was unlocked by Admin! You can spin & buy now!`);
                    }
                }
 
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: ` **USER UNLOCKED:** **${target}**'s device lock was cleared! All coins, powers & stats are safe.`,
                    _serverId: srvId
                });
            }
        });
    });
     // ============================================================================
    // 🌌 SAMMUVERSE V6 - CLEAN PIECE 1/4 (W2 POWERS, REALMS 11-15, RELICS & AURAS)
    // ============================================================================
    Object.assign(SV_DEFS, {
        voidsov: {
            w2only: true, cost: 35000, icon: '🕳️', name: 'Void Sovereign',
            moves: [
                { label: 'Void Erasure (75 DMG)', dmg: 75 },
                { label: 'Singularity Collapse (105 True DMG)', dmg: 105, trueDmg: true },
                { label: 'Null Dimension (Evade +90 HP)', evade: true, heal: 90 },
                { label: '🌌 ABSOLUTE VOID ULT (195 True DMG)', dmg: 195, trueDmg: true, ult: true }
            ]
        },
        astralshenron: {
            w2only: true, cost: 45000, icon: '🐉', name: 'Astral Shenron',
            moves: [
                { label: 'Cosmic Dragon Breath (80 DMG)', dmg: 80 },
                { label: 'Wish Fulfillment (+65 HP & 95 DMG)', dmg: 95, heal: 65 },
                { label: 'Celestial Scales (Block 85%)', block: 0.85 },
                { label: '✨ ETERNAL DRAGON ULT (205 True DMG)', dmg: 205, trueDmg: true, ult: true }
            ]
        },
        hypernova: {
            w2only: true, cost: 55000, icon: '💥', name: 'Hypernova Monarch',
            moves: [
                { label: 'Solar Flare Slash (85 DMG)', dmg: 85 },
                { label: 'Supernova Burst (115 True DMG)', dmg: 115, trueDmg: true },
                { label: 'Corona Shield (Block 80% + 50 HP)', block: 0.8, heal: 50 },
                { label: '☀️ BIG BANG CATACLYSM ULT (220 True DMG)', dmg: 220, trueDmg: true, ult: true }
            ]
        }
    });

    const V6_AURAS = {
        demonic:    { name: 'Demonic Aura',     icon: '😈', cost: 15000, shards: 3, desc: '+18% Lifesteal & +15% DMG/Lv' },
        soulreaper: { name: 'Soul Reaper Aura', icon: '👻', cost: 15000, shards: 3, desc: '+20% Crit & +18% DMG/Lv' },
        divine:     { name: 'Divine Aura',      icon: '🔱', cost: 25000, shards: 5, desc: '+16% All-Stats & Stun Immune' },
        dragonic:   { name: 'Dragonic Aura',    icon: '🐉', cost: 20000, shards: 4, desc: '+22% HP & +16% DMG/Lv' },
        voidwalker: { name: 'Void Walker Aura', icon: '🌌', cost: 30000, shards: 6, desc: '+20% DMG & +15% Armor/Lv' }
    };

    const V6_RELICS = {
        astralBlade:  { name: 'Astral Blade',  icon: '🗡️', coins: 40000, shards: 5, crystals: 2, desc: '+25% ATK & +10% True DMG/Lv' },
        voidArmor:    { name: 'Void Armor',    icon: '🛡️', coins: 40000, shards: 4, crystals: 3, desc: '+30% Max HP & +12% Block/Lv' },
        infinityRing: { name: 'Infinity Ring', icon: '💍', coins: 60000, shards: 6, crystals: 5, desc: '+20% All-Stats & +15% Crit/Lv' }
    };

    const W2_CHAPTERS = [
        { ch: 11, name: 'Astral Harbor',    coins: 75000,  drop: 'shard',   hp: 4500,  atk: 190 },
        { ch: 12, name: 'Dragon Nebula',    coins: 110000, drop: 'crystal', hp: 6500,  atk: 240 },
        { ch: 13, name: 'Hypernova Core',   coins: 150000, drop: 'shard',   hp: 9000,  atk: 300 },
        { ch: 14, name: 'Blade Dimension',  coins: 200000, drop: 'crystal', hp: 12000, atk: 370 },
        { ch: 15, name: 'Eternity Throne',  coins: 300000, drop: 'both',    hp: 16000, atk: 450 }
    ];

    function ensureV6Profile(uname) {
        const prof = getSvProfile(uname);
        if (!prof.v6 || typeof prof.v6 !== 'object') prof.v6 = {};
        const v6 = prof.v6;
        if (typeof v6.w2Unlocked !== 'boolean') v6.w2Unlocked = false;
        if (typeof v6.w2Cleared !== 'boolean') v6.w2Cleared = false;
        if (!v6.w2Chapter) v6.w2Chapter = 11;
        if (!v6.w2Stage) v6.w2Stage = 1;
        if (!v6.w2BossKills) v6.w2BossKills = 0;
        if (typeof v6.astralShards !== 'number') v6.astralShards = 0;
        if (typeof v6.voidCrystals !== 'number') v6.voidCrystals = 0;
        if (!Array.isArray(v6.unlockedAuras)) v6.unlockedAuras = [];
        if (!v6.auraClass) v6.auraClass = '';
        if (!v6.auraLv) v6.auraLv = 1;
        if (!Array.isArray(v6.v4Powers)) v6.v4Powers = [];
        if (!v6.relics || typeof v6.relics !== 'object') v6.relics = { astralBlade: 0, voidArmor: 0, infinityRing: 0 };
        if (!v6.stars || typeof v6.stars !== 'object') v6.stars = {};
        return prof;
    }

      // ============================================================================
    // 🌌 SAMMUVERSE V6 - CLEAN PIECE 2/5 (WORLD 2 BATTLES & S1->S2->S3 PROGRESSION)
    // ============================================================================
    const _prevFinishSvBattleV6 = typeof finishSvBattle === 'function' ? finishSvBattle : null;

    function applyV6BattleRewards(battleId, b) {
        if (!b || !b.isW2 || b._v6Rewarded) return;
        b._v6Rewarded = true;
        const cleanName = b.p1 && b.p1.name ? b.p1.name : '';
        if (!cleanName) return;

        const prof = ensureV6Profile(cleanName);
        const v6 = prof.v6;
        const chObj = W2_CHAPTERS.find(c => c.ch === b.w2Chapter) || W2_CHAPTERS;
        const diffMult = b.w2Diff === 'nightmare' ? 2.5 : (b.w2Diff === 'hard' ? 1.6 : 1.0);

        let stars = 1;
        if (b.p1.hp >= Math.round(b.p1.maxHp * 0.5)) stars = 2;
        if (b.p1.hp >= Math.round(b.p1.maxHp * 0.8) && b.turn <= 5) stars = 3;
        const starKey = b.w2Chapter + '_' + b.w2Stage;
        v6.stars[starKey] = Math.max(v6.stars[starKey] || 0, stars);

        const coinGain = Math.round((chObj.coins || 75000) * 0.45 * diffMult);
        const xpGain = Math.round((chObj.coins || 75000) * 0.02 * diffMult);
        addCoins(cleanName, coinGain);
        const tr = ensureTrainingProfile(prof);
        tr.xp = (tr.xp || 0) + xpGain;

        let dropTxt = '';
        if (b.w2Stage === 3) {
            v6.w2BossKills = (v6.w2BossKills || 0) + 1;
            if (chObj.drop === 'shard' || chObj.drop === 'both') {
                v6.astralShards += 2;
                dropTxt += ' + 🔷 2x Astral Shards';
            }
            if (chObj.drop === 'crystal' || chObj.drop === 'both') {
                v6.voidCrystals += 2;
                dropTxt += ' + 💎 2x Void Crystals';
            }
        } else {
            v6.astralShards += 1;
            dropTxt = ' + 🔷 1x Astral Shard';
        }

        // Advance Stage S1 -> S2 -> S3 -> Next Chapter cleanly!
        if (v6.w2Chapter === b.w2Chapter && v6.w2Stage === b.w2Stage) {
            if (v6.w2Stage < 3) {
                v6.w2Stage += 1;
            } else if (v6.w2Chapter < 15) {
                v6.w2Chapter += 1;
                v6.w2Stage = 1;
            } else {
                v6.w2Cleared = true;
            }
        }

        saveSvStats();
        const pSock = Array.from(io.sockets.sockets.values()).find(s => s.username === cleanName);
        if (pSock) pSock.emit('svStatsSync', ensureV6Profile(cleanName));
        if (b.srvId) {
            io.to(b.srvId).emit('message', {
                username: "Sammu's Bot",
                text: `🌌${'⭐'.repeat(stars)} **W2 CH.${b.w2Chapter}-S${b.w2Stage} CLEARED!** +${coinGain.toLocaleString()}🪙 +${xpGain.toLocaleString()} XP${dropTxt}!`,
                _serverId: b.srvId
            });
        }
    }

    io.on('connection', (socket) => {
        socket.on('svStartW2Gatekeeper', (powKey) => {
            const uname = socket.username || 'Player';
            if (!socket.activeServerId) return;
            const prof = ensureV6Profile(uname);
            if (prof.v6.w2Unlocked) return socket.emit('svNotice', '🌌 World 2 is already unlocked!');
            if (!prof.adventure || !prof.adventure.cleared) {
                return socket.emit('svNotice', '🔒 Clear World 1 (Chapter 5, Stage 3) first!');
            }
            if (getCoins(uname) < 25000) return socket.emit('svNotice', '🪙 Need 25,000 Coins to challenge Gatekeeper!');

            addCoins(uname, -25000);
            const p1 = buildFighterObj(socket.id, uname, powKey || 'fire');
            const p2 = buildFighterObj('W2_GATE', '🌌 ASTRAL GATEKEEPER', 'voidsov', 6500, 145, true, 'W2_GATE');
            p2.isV2 = true; p2.isV3 = true;

            const battleId = 'w2gate_' + Date.now();
            const battle = {
                id: battleId, srvId: socket.activeServerId, isW2Gatekeeper: true,
                p1, p2, turn: 1, timeLeft: 15, logs: []
            };
            svBattles.set(battleId, battle);
            battle.interval = setInterval(() => {
                const c = svBattles.get(battleId);
                if (!c) return;
                c.timeLeft -= 1;
                if (c.timeLeft <= 0) resolveSvTurn(battleId);
                else syncSvBattle(c, null);
            }, 1000);
            syncSvBattle(battle, '🌌 Astral Gatekeeper descends!');
        });

        socket.on('svStartW2Stage', (data) => {
            const { ch, stg, power, diff } = data || {};
            const uname = socket.username || 'Player';
            if (!socket.activeServerId) return;
            const prof = ensureV6Profile(uname);
            const v6 = prof.v6;
            if (!v6.w2Unlocked) return socket.emit('svNotice', '🔒 Defeat the Astral Gatekeeper to unlock World 2!');

            const chNum = Number(ch) || 11;
            const stgNum = Number(stg) || 1;
            const chObj = W2_CHAPTERS.find(c => c.ch === chNum);
            if (!chObj) return;

            const prevOk = stgNum === 1
                ? (chNum === 11 || v6.stars[(chNum - 1) + '_3'] > 0 || v6.w2Cleared || v6.w2Chapter >= chNum)
                : (v6.stars[chNum + '_' + (stgNum - 1)] > 0 || v6.w2Cleared || v6.w2Chapter > chNum || (v6.w2Chapter === chNum && v6.w2Stage >= stgNum));
            if (!prevOk) return socket.emit('svNotice', '🔒 Clear the previous stage first!');

            const mult = (diff === 'nightmare' ? 2.2 : (diff === 'hard' ? 1.5 : 1.0)) * (1 + (stgNum - 1) * 0.25);
            const bossHp = Math.round(chObj.hp * mult);
            const bossAtk = Math.round(chObj.atk * mult);
            const p1 = buildFighterObj(socket.id, uname, power || 'fire');
            const p2 = buildFighterObj('W2_BOSS', `🪐 ${chObj.name} (S${stgNum})`, 'astralshenron', bossHp, bossAtk, true, 'W2_BOSS');
            p2.isV2 = true; p2.isV3 = true;

            const battleId = 'w2stg_' + Date.now();
            const battle = {
                id: battleId, srvId: socket.activeServerId, isW2: true,
                w2Chapter: chNum, w2Stage: stgNum, w2Diff: diff || 'normal',
                p1, p2, turn: 1, timeLeft: 15, logs: []
            };
            svBattles.set(battleId, battle);
            battle.interval = setInterval(() => {
                const c = svBattles.get(battleId);
                if (!c) return;
                c.timeLeft -= 1;
                if (c.timeLeft <= 0) {
                    const snap = svBattles.get(battleId);
                    resolveSvTurn(battleId);
                    if (snap && snap.p2 && snap.p2.hp <= 0) applyV6BattleRewards(battleId, snap);
                } else {
                    syncSvBattle(c, null);
                }
            }, 1000);
            syncSvBattle(battle, `🪐 Entered ${chObj.name} Stage ${stgNum}!`);
        });
    });
                                          ;
       // ============================================================================
    // 🌌 SAMMUVERSE V6 - CLEAN PIECE 3/5 (AURAS, V4 TEMPLE, RELICS & #sammuv6god)
    // ============================================================================
    if (typeof finishSvBattle === 'function') {
        const _origFinishV6 = finishSvBattle;
        finishSvBattle = function(battleId, winnerSide) {
            const b = svBattles.get(battleId);
            if (b && winnerSide === 'p1') {
                if (b.isW2) applyV6BattleRewards(battleId, b);
                if (b.isW2Gatekeeper && b.p1 && b.p1.name) {
                    const prof = ensureV6Profile(b.p1.name);
                    prof.v6.w2Unlocked = true;
                    saveSvStats();
                    const pSock = Array.from(io.sockets.sockets.values()).find(s => s.username === b.p1.name);
                    if (pSock) {
                        pSock.emit('svStatsSync', ensureV6Profile(b.p1.name));
                        pSock.emit('svNotice', '🌌 ASTRAL GATEKEEPER DEFEATED! World 2 Unlocked!');
                    }
                }
                if (b.isV4Trial && b.p1 && b.p1.name && b.trialPow) {
                    const prof = ensureV6Profile(b.p1.name);
                    if (!prof.v6.v4Powers.includes(b.trialPow)) prof.v6.v4Powers.push(b.trialPow);
                    saveSvStats();
                    const pSock = Array.from(io.sockets.sockets.values()).find(s => s.username === b.p1.name);
                    if (pSock) {
                        pSock.emit('svStatsSync', ensureV6Profile(b.p1.name));
                        pSock.emit('svNotice', `🔥 V4 AWAKENING COMPLETE! ${b.trialPow.toUpperCase()} ascended to V4!`);
                    }
                }
            }
            return _origFinishV6.apply(this, arguments);
        };
    }

    function applyMasterGodUnlock(uname) {
        const prof = ensureV6Profile(uname);
        const tr = ensureTrainingProfile(prof);
        const v6 = prof.v6;

        prof.unlockedPowers = Object.keys(SV_DEFS);
        prof.ownedPets = ['mochi', 'tommy', 'garuda', 'sheshnag', 'chimera', 'ouroboros'];
        prof.activePet = 'ouroboros';
        prof.activePet2 = 'chimera';
        prof.gears = { omegaCore: true, titanCrown: true };
        prof.adventure = { chapter: 5, stage: 3, cleared: true };
        prof.hasStone = true;
        prof.atkLv = 15; prof.hpLv = 15;
        prof.bounty = 30000000;
        prof.lineage = 'celestial'; prof.lineageStage = 3;
        prof.maxTowerFloor = 100; prof.towerCheckpoint = 100;
        tr.fistLv = 333334; tr.bodyLv = 333333; tr.chiLv = 333333; tr.xp = 1000000;
        if (!prof.powerWins) prof.powerWins = {};
        Object.keys(SV_DEFS).forEach(k => { prof.powerWins[k] = 100; });

        v6.w2Unlocked = true;
        v6.w2Cleared = true;
        v6.w2Chapter = 15;
        v6.w2Stage = 3;
        v6.w2BossKills = 15;
        v6.astralShards = 9999;
        v6.voidCrystals = 9999;
        v6.unlockedAuras = Object.keys(V6_AURAS);
        v6.auraClass = 'divine';
        v6.auraLv = 10;
        v6.v4Powers = Object.keys(SV_DEFS);
        v6.relics = { astralBlade: 10, voidArmor: 10, infinityRing: 10 };
        for (let ch = 11; ch <= 15; ch++) {
            for (let st = 1; st <= 3; st++) v6.stars[ch + '_' + st] = 3;
        }

        addCoins(uname, 9999999);
        syncPlayerTitlesAndBounty(uname);
        saveSvStats();
        return ensureV6Profile(uname);
    }

    io.on('connection', (socket) => {
        // Intercept #sammuv6god cleanly before V4 code handler
        socket.use((packet, next) => {
            if (packet && packet.at(0) === 'svUnlockCode') {
                const code = String(packet.at(1) || '').trim().toLowerCase();
                if (code === '#sammuv6god') {
                    const uname = (socket.username || '').trim();
                    if (!uname) return;
                    const updated = applyMasterGodUnlock(uname);
                    socket.emit('svStatsSync', updated);
                    socket.emit('svNotice', '👑🌌 MASTER CODE #sammuv6god UNLOCKED EVERYTHING (V4, World 2, Divine Aura, Relics & 9999 Shards/Crystals)!');
                    return;
                }
            }
            next();
        });

        socket.on('svAuraAction', (auraKey) => {
            const uname = socket.username || 'Player';
            const prof = ensureV6Profile(uname);
            const v6 = prof.v6;
            const au = V6_AURAS[auraKey];
            if (!au) return;

            if (!v6.unlockedAuras.includes(auraKey)) {
                if (getCoins(uname) < au.cost || v6.astralShards < au.shards) {
                    return socket.emit('svNotice', `🔒 Need ${au.cost.toLocaleString()}🪙 + ${au.shards}🔷 Shards!`);
                }
                addCoins(uname, -au.cost);
                v6.astralShards -= au.shards;
                v6.unlockedAuras.push(auraKey);
                v6.auraClass = auraKey;
                v6.auraLv = 1;
                saveSvStats();
                socket.emit('svStatsSync', prof);
                return socket.emit('svNotice', `${au.icon} Unlocked & Equipped ${au.name}!`);
            }

            if (v6.auraClass !== auraKey) {
                v6.auraClass = auraKey;
                saveSvStats();
                socket.emit('svStatsSync', prof);
                return socket.emit('svNotice', `${au.icon} Equipped ${au.name}!`);
            }

            const upCost = 15000 * (v6.auraLv || 1);
            const upShards = 3 * (v6.auraLv || 1);
            if ((v6.auraLv || 1) >= 10) return socket.emit('svNotice', '✨ Aura is already MAX Lv.10!');
            if (getCoins(uname) < upCost || v6.astralShards < upShards) {
                return socket.emit('svNotice', `🔒 Upgrade needs ${upCost.toLocaleString()}🪙 + ${upShards}🔷 Shards!`);
            }
            addCoins(uname, -upCost);
            v6.astralShards -= upShards;
            v6.auraLv = (v6.auraLv || 1) + 1;
            saveSvStats();
            socket.emit('svStatsSync', prof);
            socket.emit('svNotice', `${au.icon} ${au.name} upgraded to Lv.${v6.auraLv}!`);
        });

        socket.on('svForgeRelic', (relicKey) => {
            const uname = socket.username || 'Player';
            const prof = ensureV6Profile(uname);
            const v6 = prof.v6;
            const rel = V6_RELICS[relicKey];
            if (!rel) return;

            const curLv = v6.relics[relicKey] || 0;
            if (curLv >= 10) return socket.emit('svNotice', `✨ ${rel.name} is already MAX Lv.10!`);
            const mult = curLv + 1;
            const cCost = rel.coins * mult;
            const sCost = rel.shards * mult;
            const crCost = rel.crystals * mult;

            if (getCoins(uname) < cCost || v6.astralShards < sCost || v6.voidCrystals < crCost) {
                return socket.emit('svNotice', `🔒 Need ${cCost.toLocaleString()}🪙 + ${sCost}🔷 + ${crCost}💎!`);
            }
            addCoins(uname, -cCost);
            v6.astralShards -= sCost;
            v6.voidCrystals -= crCost;
            v6.relics[relicKey] = curLv + 1;
            saveSvStats();
            socket.emit('svStatsSync', prof);
            socket.emit('svNotice', `${rel.icon} Forged ${rel.name} to Lv.${v6.relics[relicKey]}!`);
        });

        socket.on('svStartV4Trial', (powKey) => {
            const uname = socket.username || 'Player';
            if (!socket.activeServerId) return;
            const prof = ensureV6Profile(uname);
            const v6 = prof.v6;
            const pk = powKey || 'fire';
            if (v6.v4Powers.includes(pk)) return socket.emit('svNotice', '🔥 This power is already awakened to V4!');
            if (!v6.w2Unlocked) return socket.emit('svNotice', '🔒 Unlock World 2 first!');
            if (((prof.powerWins && prof.powerWins[pk]) || 0) < 100) {
                return socket.emit('svNotice', '🔒 Need 100 V3 Wins with this power first!');
            }

            const p1 = buildFighterObj(socket.id, uname, pk);
            const p2 = buildFighterObj('V4_MIRROR', `🔥 V4 SHADOW MIRROR (${pk.toUpperCase()})`, pk, 8500, 175, true, 'V4_MIRROR');
            p2.isV2 = true; p2.isV3 = true;

            const battleId = 'v4trial_' + Date.now();
            const battle = {
                id: battleId, srvId: socket.activeServerId, isV4Trial: true, trialPow: pk,
                p1, p2, turn: 1, timeLeft: 15, logs: []
            };
            svBattles.set(battleId, battle);
            battle.interval = setInterval(() => {
                const c = svBattles.get(battleId);
                if (!c) return;
                c.timeLeft -= 1;
                if (c.timeLeft <= 0) resolveSvTurn(battleId);
                else syncSvBattle(c, null);
            }, 1000);
            syncSvBattle(battle, '🔥 V4 Temple Awakening Trial started!');
        });
    });
    // ============================================================================
    // 🌌 SAMMUVERSE V6 - CLEAN PIECE 4/5 (WORLD 2, AURA, V4 TEMPLE & RELIC FORGE UI)
    // ============================================================================
    const V6_CLEAN_UI_PART1 = `
    <script id="sammuverseV6CleanUI">
    (function() {
      if (window._svV6CleanLoaded) return;
      window._svV6CleanLoaded = true;
      window._svW2Diff = 'normal';

      const W2_LIST = [
        { ch: 11, name: 'Astral Harbor',   coins: '75k',  drop: '🔷 Shard' },
        { ch: 12, name: 'Dragon Nebula',   coins: '110k', drop: '💎 Crystal' },
        { ch: 13, name: 'Hypernova Core',  coins: '150k', drop: '🔷 Shard' },
        { ch: 14, name: 'Blade Dimension', coins: '200k', drop: '💎 Crystal' },
        { ch: 15, name: 'Eternity Throne', coins: '300k', drop: '🔷+💎 Both' }
      ];

      const AURA_LIST = [
        { k: 'demonic',    name: 'Demonic Aura',     icon: '😈', cost: '15k🪙 + 3🔷', desc: '+18% Lifesteal & +15% DMG/Lv' },
        { k: 'soulreaper', name: 'Soul Reaper Aura', icon: '👻', cost: '15k🪙 + 3🔷', desc: '+20% Crit & +18% DMG/Lv' },
        { k: 'divine',     name: 'Divine Aura',      icon: '🔱', cost: '25k🪙 + 5🔷', desc: '+16% All-Stats & Stun Immune' },
        { k: 'dragonic',   name: 'Dragonic Aura',    icon: '🐉', cost: '20k🪙 + 4🔷', desc: '+22% HP & +16% DMG/Lv' },
        { k: 'voidwalker', name: 'Void Walker Aura', icon: '🌌', cost: '30k🪙 + 6🔷', desc: '+20% DMG & +15% Armor/Lv' }
      ];

      const RELIC_LIST = [
        { k: 'astralBlade',  name: 'Astral Blade',  icon: '🗡️', c: 40000, s: 5, cr: 2, desc: '+25% ATK & +10% True DMG/Lv' },
        { k: 'voidArmor',    name: 'Void Armor',    icon: '🛡️', c: 40000, s: 4, cr: 3, desc: '+30% Max HP & +12% Block/Lv' },
        { k: 'infinityRing', name: 'Infinity Ring', icon: '💍', c: 60000, s: 6, cr: 5, desc: '+20% All-Stats & +15% Crit/Lv' }
      ];

      window.setSvV6Tab = function(tab) {
        window._svV6ActiveTab = tab;
        const w1 = document.getElementById('svAdvList');
        const w2 = document.getElementById('svV6W2Box');
        const au = document.getElementById('svV6AuraBox');
        if (w1) w1.style.display = (tab === 'w1') ? 'block' : 'none';
        if (w2) w2.style.display = (tab === 'w2') ? 'block' : 'none';
        if (au) au.style.display = (tab === 'aura') ? 'block' : 'none';
        window.renderV6Panels();
      };

      window.renderV6Panels = function() {
        const advPanel = document.getElementById('svAdvPanel') || (document.getElementById('svAdvList') && document.getElementById('svAdvList').parentElement);
        if (!advPanel) return;

        let nav = document.getElementById('svV6NavBar');
        const prof = window._latestSvProf || {};
        const v6 = prof.v6 || {};
        const pow = window.selectedPower || 'fire';

        if (!nav) {
          nav = document.createElement('div');
          nav.id = 'svV6NavBar';
          nav.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:8px 0;';
          const advList = document.getElementById('svAdvList');
          if (advList) advPanel.insertBefore(nav, advList);
          else advPanel.appendChild(nav);
        }

        nav.innerHTML =
          '<button onclick="setSvV6Tab(\\'w1\\')" style="background:#0f172a;border:1px solid #38bdf8;color:#fff;padding:8px 4px;border-radius:10px;font-weight:900;font-size:11px;cursor:pointer;">🌍 World 1</button>' +
          '<button onclick="setSvV6Tab(\\'w2\\')" style="background:#581c87;border:1px solid #c084fc;color:#fff;padding:8px 4px;border-radius:10px;font-weight:900;font-size:11px;cursor:pointer;">🌌 World 2 ' + (v6.w2Unlocked ? '✅' : '🔒') + '</button>' +
          '<button onclick="setSvV6Tab(\\'aura\\')" style="background:#78350f;border:1px solid #facc15;color:#fde047;padding:8px 4px;border-radius:10px;font-weight:900;font-size:11px;cursor:pointer;">🔮 Aura / V4</button>';

        let w2Box = document.getElementById('svV6W2Box');
        if (!w2Box) {
          w2Box = document.createElement('div');
          w2Box.id = 'svV6W2Box';
          w2Box.style.display = 'none';
          advPanel.appendChild(w2Box);
        }

        let auraBox = document.getElementById('svV6AuraBox');
        if (!auraBox) {
          auraBox = document.createElement('div');
          auraBox.id = 'svV6AuraBox';
          auraBox.style.display = 'none';
          advPanel.appendChild(auraBox);
        }

        // Render World 2 Chapters 11-15 with working S1 -> S2 -> S3 buttons
        const stars = v6.stars || {};
        if (!v6.w2Unlocked) {
          w2Box.innerHTML =
            '<div style="background:rgba(88,28,135,0.28);border:1px solid #a855f7;border-radius:12px;padding:12px;text-align:center;margin-top:6px;">' +
              '<div style="font-weight:900;color:#e9d5ff;font-size:13px;">🌌 WORLD 2: ASTRAL REALMS (CH.11–15)</div>' +
              '<div style="font-size:11px;color:#cbd5e1;margin:6px 0;">Clear World 1 (Ch.5 S3) & defeat the Astral Gatekeeper (25,000🪙) to unlock!</div>' +
              '<button onclick="socket.emit(\\'svStartW2Gatekeeper\\', window.selectedPower || \\'fire\\')" style="background:linear-gradient(90deg,#9333ea,#ec4899);border:none;color:#fff;padding:9px 14px;border-radius:10px;font-weight:900;cursor:pointer;">⚔️ Challenge Astral Gatekeeper (25k🪙)</button>' +
            '</div>';
        } else {
          const diffBar =
            '<div style="display:flex;gap:6px;margin:6px 0;">' +
              ['normal', 'hard', 'nightmare'].map(d =>
                '<button onclick="window._svW2Diff=\\'' + d + '\\';renderV6Panels();" style="flex:1;padding:6px;border-radius:8px;border:1px solid ' + (window._svW2Diff === d ? '#facc15' : '#475569') + ';background:' + (window._svW2Diff === d ? '#713f12' : '#0f172a') + ';color:#fff;font-weight:800;font-size:10px;text-transform:uppercase;cursor:pointer;">' + d + '</button>'
              ).join('') +
            '</div>';

          w2Box.innerHTML = diffBar + W2_LIST.map(c => {
            const chUnlocked = v6.w2Cleared || (v6.w2Chapter || 11) >= c.ch || (stars[(c.ch - 1) + '_3'] || 0) > 0;
            const btns = [1, 2, 3].map(stgNum => {
              const prevCleared = stgNum === 1
                ? chUnlocked
                : ((stars[c.ch + '_' + (stgNum - 1)] || 0) > 0 || v6.w2Cleared || (v6.w2Chapter || 11) > c.ch || ((v6.w2Chapter || 11) === c.ch && (v6.w2Stage || 1) >= stgNum));
              const stCount = stars[c.ch + '_' + stgNum] || 0;
              const starStr = stCount > 0 ? ' ' + '⭐'.repeat(stCount) : '';
              return '<button ' + (prevCleared ? '' : 'disabled') +
                ' onclick="socket.emit(\\'svStartW2Stage\\',{ch:' + c.ch + ',stg:' + stgNum + ',power:(window.selectedPower||\\'fire\\'),diff:(window._svW2Diff||\\'normal\\')})"' +
                ' style="padding:7px 4px;border-radius:8px;border:none;font-weight:900;font-size:11px;cursor:' + (prevCleared ? 'pointer' : 'not-allowed') + ';background:' + (prevCleared ? '#7c3aed' : '#1e293b') + ';color:' + (prevCleared ? '#fff' : '#64748b') + ';">' +
                (prevCleared ? ('⚔️ S' + stgNum + starStr) : ('🔒 S' + stgNum)) + '</button>';
            }).join('');

            return '<div style="background:rgba(15,23,42,0.85);border:1px solid #4c1d95;border-radius:12px;padding:10px;margin-bottom:8px;">' +
              '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
                '<span style="font-weight:900;color:#f8fafc;font-size:12px;">🪐 Ch.' + c.ch + ': ' + c.name + '</span>' +
                '<span style="font-size:11px;color:#38bdf8;font-weight:800;">' + c.coins + '🪙 • ' + c.drop + '</span>' +
              '</div>' +
              (chUnlocked
                ? '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">' + btns + '</div>'
                : '<div style="font-size:11px;color:#94a3b8;">🔒 Clear Chapter ' + (c.ch - 1) + ' first</div>') +
            '</div>';
          }).join('');
        }
    `;
     // ============================================================================
    // 🌌 SAMMUVERSE V6 - CLEAN PIECE 5/5 (AURAS, RELICS & UNIFIED INJECTOR)
    // ============================================================================
    const V6_CLEAN_UI_PART2 = `
        const wins = (prof.powerWins && prof.powerWins[pow]) || 0;
        const isV4 = Array.isArray(v6.v4Powers) && v6.v4Powers.includes(pow);
        const unlockedAuras = Array.isArray(v6.unlockedAuras) ? v6.unlockedAuras : [];
        const relics = v6.relics || {};

        const v4Html =
          '<div style="background:rgba(127,29,29,0.3);border:1px solid #f87171;border-radius:12px;padding:10px;margin-bottom:10px;">' +
            '<div style="font-weight:900;color:#fca5a5;font-size:12px;margin-bottom:4px;">⛩️ V4 AWAKENING TEMPLE (' + pow.toUpperCase() + ')</div>' +
            '<div style="font-size:11px;color:#e2e8f0;">1. World 2 Unlocked: ' + (v6.w2Unlocked ? '✅' : '🔒') + '</div>' +
            '<div style="font-size:11px;color:#e2e8f0;">2. Power Mastery (100 V3 Wins): ' + wins + '/100 ' + (wins >= 100 ? '🔥' : '🔒') + '</div>' +
            '<div style="font-size:11px;color:#e2e8f0;margin-bottom:8px;">3. Status: ' + (isV4 ? '👑 V4 AWAKENED!' : 'Beat your V4 Shadow Mirror!') + '</div>' +
            '<button onclick="socket.emit(\\'svStartV4Trial\\', window.selectedPower || \\'fire\\')" style="width:100%;background:linear-gradient(90deg,#dc2626,#9333ea);border:none;color:#fff;padding:8px;border-radius:9px;font-weight:900;font-size:11px;cursor:pointer;">🔥 ENTER V4 TEMPLE TRIAL!</button>' +
          '</div>';

        const auraHtml =
          '<div style="font-weight:900;color:#38bdf8;font-size:12px;margin:6px 0;">🔮 AURA CLASSES (🔷 ' + (v6.astralShards || 0) + ' Shards | 💎 ' + (v6.voidCrystals || 0) + ' Crystals)</div>' +
          AURA_LIST.map(a => {
            const owned = unlockedAuras.includes(a.k);
            const active = v6.auraClass === a.k;
            const btnTxt = !owned ? a.cost : (active ? ('⬆️ Upgrade Lv.' + ((v6.auraLv || 1) + 1)) : '⚡ Equip');
            return '<div style="display:flex;justify-content:space-between;align-items:center;background:#0f172a;border:1px solid ' + (active ? '#facc15' : '#334155') + ';border-radius:10px;padding:8px;margin-bottom:6px;">' +
              '<div style="padding-right:6px;"><div style="font-weight:900;color:#fff;font-size:11px;">' + a.icon + ' ' + a.name + (active ? ' (Lv.' + (v6.auraLv || 1) + ')' : '') + '</div>' +
              '<div style="font-size:10px;color:#94a3b8;">' + a.desc + '</div></div>' +
              '<button onclick="socket.emit(\\'svAuraAction\\',\\'' + a.k + '\\')" style="background:#7c3aed;border:none;color:#fff;padding:7px 10px;border-radius:8px;font-weight:900;font-size:10px;white-space:nowrap;cursor:pointer;">' + btnTxt + '</button>' +
            '</div>';
          }).join('');

        const relicHtml =
          '<div style="font-weight:900;color:#facc15;font-size:12px;margin:10px 0 6px;">⚒️ V6 RELIC GEAR FORGE</div>' +
          RELIC_LIST.map(r => {
            const lv = relics[r.k] || 0;
            const m = lv + 1;
            const costTxt = lv >= 10 ? '✨ MAX Lv.10' : (Math.round((r.c * m) / 1000) + 'k🪙 + ' + (r.s * m) + '🔷 + ' + (r.cr * m) + '💎');
            return '<div style="display:flex;justify-content:space-between;align-items:center;background:#0f172a;border:1px solid #854d0e;border-radius:10px;padding:8px;margin-bottom:6px;">' +
              '<div style="padding-right:6px;"><div style="font-weight:900;color:#fef08a;font-size:11px;">' + r.icon + ' ' + r.name + ' (Lv.' + lv + '/10)</div>' +
              '<div style="font-size:10px;color:#cbd5e1;">' + r.desc + '</div></div>' +
              '<button onclick="socket.emit(\\'svForgeRelic\\',\\'' + r.k + '\\')" style="background:#b45309;border:none;color:#fff;padding:7px 10px;border-radius:8px;font-weight:900;font-size:10px;white-space:nowrap;cursor:pointer;">' + costTxt + '</button>' +
            '</div>';
          }).join('');

        auraBox.innerHTML = v4Html + auraHtml + relicHtml;
      };

      setInterval(function() {
        if (typeof window.renderV6Panels === 'function') window.renderV6Panels();
        var fab = document.getElementById('hkCreatorFab');
        if (fab) { fab.style.bottom = '68px'; fab.style.zIndex = '99999999'; }
      }, 1000);
    })();
    </script>`;

    const V6_COMPLETE_CLIENT_BUNDLE = V6_CLEAN_UI_PART1 + '\n' + V6_CLEAN_UI_PART2;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('sammuverseV6CleanUI')) {
                body = body.replace('</body>', V6_COMPLETE_CLIENT_BUNDLE + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // ============================================================================
    // 🌌 SAMMUVERSE V6 SOCKET LOADER & INSTANT FIGHT FIX
    // ============================================================================
    function clearPlayerStuckBattles(sockId) {
        for (const [bId, b] of svBattles.entries()) {
            if (b.p1.id === sockId || b.p2.id === sockId) {
                if (b.interval) clearInterval(b.interval);
                svBattles.delete(bId);
            }
        }
    }

    const _prevFinishBeforeV6Fix = finishSvBattle;
    finishSvBattle = function(battleId, b) {
        if (b && b.p1 && b.p2 && b.p1.hp > b.p2.hp) {
            if (b.isW2) applyV6BattleRewards(battleId, b);
            if (b.isW2Gatekeeper && b.p1.name) {
                const prof = ensureV6Profile(b.p1.name);
                prof.v6.w2Unlocked = true;
                saveSvStats();
                const pSock = io.sockets.sockets.get(b.p1.id);
                if (pSock) {
                    pSock.emit('svStatsSync', ensureV6Profile(b.p1.name));
                    pSock.emit('svNotice', '🌌 ASTRAL GATEKEEPER DEFEATED! World 2 Unlocked!');
                }
            }
            if (b.isV4Trial && b.p1.name && b.trialPow) {
                const prof = ensureV6Profile(b.p1.name);
                if (!prof.v6.v4Powers.includes(b.trialPow)) prof.v6.v4Powers.push(b.trialPow);
                saveSvStats();
                const pSock = io.sockets.sockets.get(b.p1.id);
                if (pSock) {
                    pSock.emit('svStatsSync', ensureV6Profile(b.p1.name));
                    pSock.emit('svNotice', '🔥 V4 AWAKENING COMPLETE! ' + b.trialPow.toUpperCase() + ' ascended to V4!');
                }
            }
        }
        return _prevFinishBeforeV6Fix(battleId, b);
    };

    io.on('connection', (socket) => {
        const ensureReady = () => {
            if (!socket.activeServerId) socket.activeServerId = lastActiveServerId || 'srv_samaksh';
            if (!socket.username) socket.username = 'Fighter_' + socket.id.slice(0, 4);
            clearPlayerStuckBattles(socket.id);
        };

        socket.prependListener('svChallenge', (d) => {
            if (!socket.activeServerId) socket.activeServerId = lastActiveServerId || 'srv_samaksh';
            if (!socket.username) socket.username = 'Fighter_' + socket.id.slice(0, 4);
            if (d && ['BOT_DUMMY', 'BOT_SENSEI', 'BOT_DEMON'].includes(d.targetId)) {
                clearPlayerStuckBattles(socket.id);
            }
        });
        socket.prependListener('svStartAdventure', ensureReady);
        socket.prependListener('svStartStageV5', ensureReady);
        socket.prependListener('svStartW2Gatekeeper', ensureReady);
        socket.prependListener('svStartW2Stage', ensureReady);
        socket.prependListener('svStartV4Trial', ensureReady);
        socket.prependListener('svTowerEnter', ensureReady);
        socket.prependListener('svStartDungeon', ensureReady);

        // Send V6 World 2 + Fight Patch directly via Socket.IO (immune to HTML script tag errors!)
        const pushV6ViaSocket = () => {
            const rawV6 = (typeof V6_COMPLETE_CLIENT_BUNDLE === 'string')
                ? V6_COMPLETE_CLIENT_BUNDLE.replace(/<\/?script[^>]*>/gi, '')
                : '';
            socket.emit('svApplyV6Patch', rawV6);
        };
        socket.on('svRequestCleanV4', pushV6ViaSocket);
        socket.on('joinRoom', () => setTimeout(pushV6ViaSocket, 550));
    });

    const V6_SOCKET_RECEIVER = `
    <script id="svV6SocketReceiver">
    (function() {
      if (window._svV6ReceiverBound) return;
      window._svV6ReceiverBound = true;

      const waitSock = setInterval(function() {
        if (typeof socket === 'undefined') return;
        clearInterval(waitSock);
        window.socket = socket;

        socket.on('svApplyV6Patch', function(codeStr) {
          if (codeStr && !window._svV6CodeEvaled) {
            window._svV6CodeEvaled = true;
            try { (new Function(codeStr))(); } catch (e) { console.error('V6 Eval:', e); }
          }

          window.setSvV6Tab = function(tab) {
            window._svV6ActiveTab = tab;
            const w1 = document.getElementById('svAdventureChaptersList');
            const w2 = document.getElementById('svV6W2Box');
            const au = document.getElementById('svV6AuraBox');
            if (w1) w1.style.display = (tab === 'w1') ? 'block' : 'none';
            if (w2) w2.style.display = (tab === 'w2') ? 'block' : 'none';
            if (au) au.style.display = (tab === 'aura') ? 'block' : 'none';
            if (typeof window.renderV6Panels === 'function') window.renderV6Panels();
          };
        });

        // Guarantee ⚔️ FIGHT button & World 2 tabs always stay wired
        setInterval(function() {
          window.socket = socket;
          window.selectedPower = window._curSvPow || window.selectedPower || 'fire';

          const advPanel = document.getElementById('svAdvPanel');
          const w1List = document.getElementById('svAdventureChaptersList');
          if (advPanel && w1List && !document.getElementById('svV6NavBar')) {
            const nav = document.createElement('div');
            nav.id = 'svV6NavBar';
            nav.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:8px 0;';
            advPanel.insertBefore(nav, w1List);
            if (typeof window.renderV6Panels === 'function') window.renderV6Panels();
          }

          // Backup direct click handler on ⚔️ FIGHT button in case inline onclick is blocked
          const fightBtn = Array.from(document.querySelectorAll('#svFightPanel button')).find(function(b) {
            return (b.textContent || '').includes('FIGHT');
          });
          if (fightBtn && !fightBtn.dataset.directFightWired) {
            fightBtn.dataset.directFightWired = '1';
            fightBtn.onclick = function(e) {
              e.preventDefault();
              e.stopPropagation();
              const sel = document.getElementById('svOpponentSelect');
              const targetId = sel ? sel.value : 'BOT_DUMMY';
              const pow = window._curSvPow || window.selectedPower || 'fire';
              socket.emit('svChallenge', { targetId: targetId, power: pow });
            };
          }
        }, 700);

        socket.emit('svRequestCleanV4');
      }, 400);
    })();
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('svV6SocketReceiver')) {
                body = body.replace('</body>', V6_SOCKET_RECEIVER + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // ============================================================================
    // ⚡ ANTI-LAG PERFORMANCE BOOSTER + 30-MIN AUTO-PROMO BOT
    // ============================================================================
    if (io && io.engine && io.engine.opts) {
        io.engine.opts.perMessageDeflate = { threshold: 256 };
    }

    // 1. Auto-Promo every 30 minutes across active rooms (only when players are online)
    if (!global._sammuAutoPromoStarted) {
        global._sammuAutoPromoStarted = true;
        setInterval(() => {
            Object.keys(serversDB).forEach((srvId) => {
                const room = io.sockets.adapter.rooms.get(srvId);
                if (room && room.size > 0) {
                    io.to(srvId).emit('message', {
                        username: "Sammu's Bot",
                        text: `🔥📢 **subscribe to verma_diary_18 ❤️** | Enjoying SammuVerse? Invite your squad & share the link! 🚀`,
                        _serverId: srvId
                    });
                }
            });
        }, 30 * 60 * 1000);
    }

    // 2. Client Anti-Lag Engine (Slows down heavy background DOM scanners & enables GPU smoothness)
    const ANTI_LAG_BOOSTER_UI = `
    <script id="sammuAntiLagBooster">
    (function() {
      if (window._antiLagApplied) return;
      window._antiLagApplied = true;

      // Throttle heavy background button-scanner intervals so mobile keyboards & chat never lag
      const _rawSetInterval = window.setInterval;
      window.setInterval = function(fn, ms, ...args) {
        const src = fn ? fn.toString() : '';
        const isHeavyDomScan = src.includes('querySelectorAll') || src.includes('renderV6Panels') || src.includes('renderV5StoryMode') || src.includes('diamondMicBtn');
        if (isHeavyDomScan && ms < 3500) {
          return _rawSetInterval(fn, 4000, ...args);
        }
        return _rawSetInterval(fn, ms, ...args);
      };

      // Pause background animations when tab/phone screen is minimized
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && typeof window.stopPhonkLoop === 'function') {
          window.stopPhonkLoop();
        }
      });
    })();
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('sammuAntiLagBooster')) {
                body = body.replace('</body>', ANTI_LAG_BOOSTER_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // ============================================================================
    // 🌌 V6 STAT & 30K+ HP RESTORE PATCH (PASTE RIGHT BEFORE return OG_HOSTS;)
    // ============================================================================
    const _prevBuildFighterV6Fix = buildFighterObj;
    buildFighterObj = function(sockId, uname, powKey, customHp, customAtk, isBot = false, botId = null) {
        const f = _prevBuildFighterV6Fix(sockId, uname, powKey, customHp, customAtk, isBot, botId);
        if (isBot) return f;

        const prof = ensureV6Profile(uname);
        const v6 = prof.v6 || {};
        const rel = v6.relics || {};
        const auraLv = v6.auraLv || 1;

        const voidArmorMult = 1 + ((rel.voidArmor || 0) * 0.30);
        const infRingMult   = 1 + ((rel.infinityRing || 0) * 0.20);
        const astralAtkMult = 1 + ((rel.astralBlade || 0) * 0.25);
        const auraHpMult    = v6.auraClass === 'divine' ? (1 + auraLv * 0.16) : (v6.auraClass === 'dragonic' ? (1 + auraLv * 0.22) : 1);
        const auraAtkMult   = v6.auraClass ? (1 + auraLv * 0.16) : 1;
        const v4Mult        = (Array.isArray(v6.v4Powers) && v6.v4Powers.includes(powKey)) ? 1.50 : 1.0;

        f.maxHp = Math.round(f.maxHp * voidArmorMult * infRingMult * auraHpMult * v4Mult);
        f.hp = f.maxHp;
        f.bonusAtk = Math.round(f.bonusAtk * astralAtkMult * infRingMult * auraAtkMult * v4Mult);
        return f;
    };

    const _prevMasterGodV6Fix = applyMasterGodUnlock;
    applyMasterGodUnlock = function(uname) {
        const prof = _prevMasterGodV6Fix(uname);
        if (prof && prof.v5) {
            prof.v5.equip = { weapon: 4, armor: 4, charm: 4 };
            prof.v5.rebirths = Math.max(5, prof.v5.rebirths || 0);
        }
        saveSvStats();
        return ensureV6Profile(uname);
    };
    
           // ============================================================================
    // 🃏 ROYAL LOUNGE BACKEND — PIECE 1/3 (10-PLAYER UNO + SMART BOTS)
    // ============================================================================
    const unoByServer = new Map();
    const UNO_COLORS = ['red', 'blue', 'green', 'yellow'];

    function buildUnoDeck() {
        const deck = [];
        for (let copy = 0; copy < 2; copy++) {
            UNO_COLORS.forEach(c => {
                deck.push({ c, v: '0' });
                ['1','2','3','4','5','6','7','8','9','SKIP','REV','+2'].forEach(v => {
                    deck.push({ c, v });
                    deck.push({ c, v });
                });
            });
            for (let i = 0; i < 4; i++) {
                deck.push({ c: 'wild', v: 'WILD' });
                deck.push({ c: 'wild', v: '+4' });
            }
        }
        return deck.sort(() => Math.random() - 0.5);
    }

    function drawUnoCards(st, count) {
        const out = [];
        for (let i = 0; i < count; i++) {
            if (st.deck.length === 0 && st.discard.length > 1) {
                const top = st.discard.pop();
                st.deck = st.discard.splice(0).map(x => ({
                    c: (x.v === 'WILD' || x.v === '+4') ? 'wild' : x.c,
                    v: x.v
                })).sort(() => Math.random() - 0.5);
                st.discard.push(top);
            }
            if (st.deck.length > 0) out.push(st.deck.pop());
        }
        return out;
    }

    function broadcastUno(srvId) {
        const st = unoByServer.get(srvId);
        if (!st) return;
        if (st.phase === 'lobby') {
            return io.to(srvId).emit('unoSync', {
                phase: 'lobby', timeLeft: st.timeLeft,
                players: st.players.map(p => ({ id: p.id, username: p.username, count: 0 })),
                _serverId: srvId
            });
        }
        const curPlayer = st.players[st.turnIdx];
        const summary = st.players.map((p, idx) => ({
            id: p.id, username: p.username, count: p.hand.length,
            isTurn: idx === st.turnIdx, saidUno: p.saidUno
        }));
        st.players.forEach(p => {
            if (p.isBot) return;
            io.to(p.id).emit('unoSync', {
                phase: 'play', timeLeft: st.timeLeft,
                topCard: st.discard[st.discard.length - 1], activeColor: st.activeColor,
                turnName: curPlayer ? curPlayer.username : '',
                isMyTurn: curPlayer && curPlayer.id === p.id,
                myHand: p.hand, saidUno: p.saidUno, players: summary, _serverId: srvId
            });
        });
    }

    function advanceUnoTurn(srvId, step = 1) {
        const st = unoByServer.get(srvId);
        if (!st || st.phase !== 'play') return;
        const n = st.players.length;
        st.turnIdx = ((st.turnIdx + (step * st.dir)) % n + n) % n;
        st.timeLeft = 20;
        broadcastUno(srvId);

        const cur = st.players[st.turnIdx];
        if (cur && cur.isBot) {
            setTimeout(() => {
                const live = unoByServer.get(srvId);
                if (!live || live.phase !== 'play') return;
                const bot = live.players[live.turnIdx];
                if (!bot || !bot.isBot) return;
                const top = live.discard[live.discard.length - 1];
                const vIdx = bot.hand.findIndex(c => c.c === 'wild' || c.c === live.activeColor || c.v === top.v);
                if (vIdx === -1) {
                    bot.hand.push(...drawUnoCards(live, 1));
                    return advanceUnoTurn(srvId, 1);
                }
                const [card] = bot.hand.splice(vIdx, 1);
                live.discard.push(card);
                live.activeColor = card.c === 'wild' ? UNO_COLORS[Math.floor(Math.random() * 4)] : card.c;
                if (bot.hand.length === 1) bot.saidUno = true;
                if (bot.hand.length === 0) {
                    clearInterval(live.interval);
                    unoByServer.delete(srvId);
                    io.to(srvId).emit('unoEnd', { _serverId: srvId });
                    return io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🤖🃏 **${bot.username}** won UNO!`, _serverId: srvId });
                }
                let s = 1;
                const np = live.players[((live.turnIdx + live.dir) % live.players.length + live.players.length) % live.players.length];
                if (card.v === 'REV') { if (live.players.length === 2) s = 2; else live.dir *= -1; }
                else if (card.v === 'SKIP') s = 2;
                else if (card.v === '+2' && np) { np.hand.push(...drawUnoCards(live, 2)); s = 2; }
                else if (card.v === '+4' && np) { np.hand.push(...drawUnoCards(live, 4)); s = 2; }
                advanceUnoTurn(srvId, s);
            }, 1000);
        }
    }

    function startUnoMatch(srvId) {
        const st = unoByServer.get(srvId);
        if (!st || st.phase !== 'lobby') return;
        if (st.players.length < 2) {
            clearInterval(st.interval);
            unoByServer.delete(srvId);
            io.to(srvId).emit('unoEnd', { _serverId: srvId });
            return io.to(srvId).emit('message', { username: "Sammu's Bot", text: '⚠️ Need at least 2 players (or +Bot) for UNO!', _serverId: srvId });
        }
        st.phase = 'play';
        st.deck = buildUnoDeck();
        st.players.forEach(p => { p.hand = drawUnoCards(st, 7); p.saidUno = false; });
                let first = drawUnoCards(st, 1)[0];
        while (first && first.c === 'wild') {
            st.deck.unshift(first);
            first = drawUnoCards(st, 1)[0];
        }
        st.discard = [first];
        st.activeColor = first.c;
        st.turnIdx = 0;
        st.dir = 1;
        st.timeLeft = 20;
        broadcastUno(srvId);
    }

     // ============================================================================
    // 🎲 ROYAL LOUNGE BACKEND — PIECE 2/3 (CHESS, CARROM, 6P LUDO, 6P SNAKES)
    // ============================================================================
    const loungeChessByServer  = new Map();
    const loungeCarromByServer = new Map();
    const loungeLudoByServer   = new Map();
    const loungeSnakesByServer = new Map();

    const LADDERS = { 4: 25, 13: 46, 33: 49, 42: 63, 50: 69, 62: 81, 74: 92 };
    const SNAKES  = { 27: 5, 40: 3, 43: 18, 54: 31, 66: 45, 76: 58, 89: 53, 99: 41 };

    function initChessBoard() {
        return [
            ['r','n','b','q','k','b','n','r'],
            ['p','p','p','p','p','p','p','p'],
            ['','','','','','','',''],['','','','','','','',''],
            ['','','','','','','',''],['','','','','','','',''],
            ['P','P','P','P','P','P','P','P'],
            ['R','N','B','Q','K','B','N','R']
        ];
    }

    function isValidChessMove(board, r1, c1, r2, c2, turnColor) {
        if (r1 === r2 && c1 === c2) return false;
        const p = board[r1]?.[c1], target = board[r2]?.[c2];
        if (!p) return false;
        const isWhite = p === p.toUpperCase();
        if ((turnColor === 'w') !== isWhite) return false;
        if (target && (target === target.toUpperCase()) === isWhite) return false;
        const dr = r2 - r1, dc = c2 - c1, adr = Math.abs(dr), adc = Math.abs(dc), type = p.toLowerCase();
        const clear = () => {
            const sr = Math.sign(dr), sc = Math.sign(dc);
            let r = r1 + sr, c = c1 + sc;
            while (r !== r2 || c !== c2) { if (board[r][c] !== '') return false; r += sr; c += sc; }
            return true;
        };
        if (type === 'p') {
            const dir = isWhite ? -1 : 1, start = isWhite ? 6 : 1;
            if (dc === 0 && target === '' && (dr === dir || (r1 === start && dr === 2 * dir && board[r1 + dir][c1] === ''))) return true;
            return adc === 1 && dr === dir && target !== '';
        }
        if (type === 'r') return (dr === 0 || dc === 0) && clear();
        if (type === 'b') return adr === adc && clear();
        if (type === 'q') return (dr === 0 || dc === 0 || adr === adc) && clear();
        if (type === 'n') return (adr === 2 && adc === 1) || (adr === 1 && adc === 2);
        if (type === 'k') return adr <= 1 && adc <= 1;
        return false;
    }
     // ============================================================================
    // 👑 ROYAL LOUNGE BACKEND — PIECE 3A/3 (UNO LISTENERS)
    // ============================================================================
    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof raw !== 'string' || raw.trim().toLowerCase() !== '!uno') return;
            if (unoByServer.has(srvId)) return broadcastUno(srvId);
            const st = {
                phase: 'lobby', timeLeft: 20,
                players: [{ id: socket.id, username: socket.username || 'Player', hand: [], saidUno: false }],
                deck: [], discard: [], activeColor: 'red', turnIdx: 0, dir: 1, interval: null
            };
            unoByServer.set(srvId, st);
            st.interval = setInterval(() => {
                const cur = unoByServer.get(srvId);
                if (!cur) return;
                cur.timeLeft--;
                if (cur.timeLeft <= 0) {
                    if (cur.phase === 'lobby') startUnoMatch(srvId);
                    else { const afk = cur.players[cur.turnIdx]; if (afk) afk.hand.push(...drawUnoCards(cur, 1)); advanceUnoTurn(srvId, 1); }
                } else broadcastUno(srvId);
            }, 1000);
            broadcastUno(srvId);
        });

        socket.on('unoJoin', () => {
            const st = unoByServer.get(socket.activeServerId);
            if (st && st.phase === 'lobby' && st.players.length < 10 && !st.players.some(p => p.id === socket.id)) {
                st.players.push({ id: socket.id, username: socket.username || 'Player', hand: [], saidUno: false });
                broadcastUno(socket.activeServerId);
            }
        });

        socket.on('unoAddBot', () => {
            const st = unoByServer.get(socket.activeServerId);
            if (st && st.phase === 'lobby' && st.players.length < 10) {
                const n = st.players.filter(p => p.isBot).length + 1;
                st.players.push({ id: 'BOT_' + n + '_' + Date.now(), username: `🤖 UNO Bot #${n}`, hand: [], saidUno: false, isBot: true });
                broadcastUno(socket.activeServerId);
            }
        });

        socket.on('unoForceStart', () => { startUnoMatch(socket.activeServerId); });

        socket.on('unoDrawCard', () => {
            const st = unoByServer.get(socket.activeServerId);
            const cur = st && st.players[st.turnIdx];
            if (st && st.phase === 'play' && cur && cur.id === socket.id) {
                cur.hand.push(...drawUnoCards(st, 1)); cur.saidUno = false;
                advanceUnoTurn(socket.activeServerId, 1);
            }
        });

        socket.on('unoCallShout', () => {
            const st = unoByServer.get(socket.activeServerId);
            const me = st && st.players.find(p => p.id === socket.id);
            if (me && me.hand.length <= 2) { me.saidUno = true; broadcastUno(socket.activeServerId); }
        });

        socket.on('unoPlayCard', ({ idx, chosenColor }) => {
            const srvId = socket.activeServerId, st = unoByServer.get(srvId);
            if (!st || st.phase !== 'play') return;
            const cur = st.players[st.turnIdx];
            if (!cur || cur.id !== socket.id) return;
            const card = cur.hand[idx], top = st.discard[st.discard.length - 1];
            if (!card || !(card.c === 'wild' || card.c === st.activeColor || card.v === top.v)) return;

            cur.hand.splice(idx, 1); st.discard.push(card);
            st.activeColor = (card.c === 'wild' && UNO_COLORS.includes(chosenColor)) ? chosenColor : card.c;
            if (cur.hand.length > 1) cur.saidUno = false;

            if (cur.hand.length === 0) {
                clearInterval(st.interval); unoByServer.delete(srvId);
                io.to(srvId).emit('unoEnd');
                addCoins(cur.username, 250);
                return io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🏆🃏 **UNO CHAMPION:** **${cur.username}** won **+250🪙**!`, _serverId: srvId });
            }
            let step = 1, n = st.players.length;
            const np = st.players[((st.turnIdx + st.dir) % n + n) % n];
            if (card.v === 'REV') { if (n === 2) step = 2; else st.dir *= -1; }
            else if (card.v === 'SKIP') step = 2;
            else if (card.v === '+2' && np) { np.hand.push(...drawUnoCards(st, 2)); step = 2; }
            else if (card.v === '+4' && np) { np.hand.push(...drawUnoCards(st, 4)); step = 2; }
            advanceUnoTurn(srvId, step);
        });
    });
      // ============================================================================
    // 👑 ROYAL LOUNGE BACKEND — PIECE 3B/3 (CHESS, CARROM, 6P LUDO, 6P SNAKES)
    // ============================================================================
    io.on('connection', (socket) => {
        // --- CHESS ---
        socket.on('loungeStartChess', () => {
            const srvId = socket.activeServerId, players = getFullRoomPlayers(srvId);
            const opp = players.find(p => p.id !== socket.id);
            if (!opp) return socket.emit('svNotice', '⚠️ Need 2 players in the Lounge for Chess!');
            const st = { board: initChessBoard(), turn: 'w', whiteId: socket.id, whiteName: socket.username || 'White', blackId: opp.id, blackName: opp.username, _serverId: srvId };
            loungeChessByServer.set(srvId, st); io.to(srvId).emit('chessSync', st);
        });

        socket.on('loungeChessMove', ({ r1, c1, r2, c2 }) => {
            const srvId = socket.activeServerId, st = loungeChessByServer.get(srvId);
            if (!st || ((st.turn === 'w' && socket.id !== st.whiteId) || (st.turn === 'b' && socket.id !== st.blackId))) return;
            if (!isValidChessMove(st.board, r1, c1, r2, c2, st.turn)) return;
            const cap = st.board[r2][c2]; st.board[r2][c2] = st.board[r1][c1]; st.board[r1][c1] = '';
            if (cap === 'k' || cap === 'K') {
                loungeChessByServer.delete(srvId); io.to(srvId).emit('chessEnd');
                const w = cap === 'k' ? st.whiteName : st.blackName; addCoins(w, 200);
                return io.to(srvId).emit('message', { username: "Sammu's Bot", text: `♟️👑 **CHECKMATE:** **${w}** won **+200🪙**!`, _serverId: srvId });
            }
            st.turn = st.turn === 'w' ? 'b' : 'w'; io.to(srvId).emit('chessSync', st);
        });

        // --- CARROM ---
        socket.on('loungeStartCarrom', () => {
            const srvId = socket.activeServerId, opp = getFullRoomPlayers(srvId).find(p => p.id !== socket.id);
            if (!opp) return socket.emit('svNotice', '⚠️ Need 2 players in the Lounge for Carrom!');
            const st = { p1: { id: socket.id, username: socket.username || 'P1', score: 0 }, p2: { id: opp.id, username: opp.username, score: 0 }, turnId: socket.id, coinsLeft: 9, queenOnBoard: true, lastShot: 'Aim striker!', _serverId: srvId };
            loungeCarromByServer.set(srvId, st); io.to(srvId).emit('carromSync', st);
        });

        socket.on('loungeCarromShoot', (shot) => {
            const srvId = socket.activeServerId, st = loungeCarromByServer.get(srvId);
            if (!st || st.turnId !== socket.id) return;
            const me = st.p1.id === socket.id ? st.p1 : st.p2;
            const hit = Math.random() < (shot === 'queen' ? 0.45 : 0.75);
            if (hit && shot === 'queen' && st.queenOnBoard) { st.queenOnBoard = false; me.score += 3; st.lastShot = `👑 ${me.username} pocketed the Queen (+3)!`; }
            else if (hit && st.coinsLeft > 0) { st.coinsLeft--; me.score += 1; st.lastShot = `🎯 ${me.username} pocketed a coin (+1)!`; }
            else { st.lastShot = `💨 ${me.username} missed!`; st.turnId = st.turnId === st.p1.id ? st.p2.id : st.p1.id; }
            if (st.coinsLeft <= 0 && !st.queenOnBoard) {
                loungeCarromByServer.delete(srvId); io.to(srvId).emit('carromEnd');
                const champ = st.p1.score >= st.p2.score ? st.p1 : st.p2; addCoins(champ.username, 200);
                return io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🎯🏆 **CARROM WINNER:** **${champ.username}** won **+200🪙**!`, _serverId: srvId });
            }
            io.to(srvId).emit('carromSync', st);
        });

        // --- 6-PLAYER LUDO ---
        socket.on('loungeStartLudo', () => {
            const srvId = socket.activeServerId, players = getFullRoomPlayers(srvId);
            if (players.length < 2) return socket.emit('svNotice', '⚠️ Need 2–6 players for Ludo!');
            const cols = ['🔴 RED', '🔵 BLUE', '🟢 GREEN', '🟡 YELLOW', '🟣 PURPLE', '🟠 ORANGE'];
            const st = { players: players.slice(0, 6).map((p, i) => ({ id: p.id, username: p.username, color: cols[i], tokens: [-1, -1] })), turnIdx: 0, lastDice: null, rolled: false, _serverId: srvId };
            loungeLudoByServer.set(srvId, st); io.to(srvId).emit('ludoSync', st);
        });

        socket.on('loungeLudoRoll', () => {
            const srvId = socket.activeServerId, st = loungeLudoByServer.get(srvId);
            if (!st || st.rolled || st.players[st.turnIdx]?.id !== socket.id) return;
            st.lastDice = Math.floor(Math.random() * 6) + 1; st.rolled = true; io.to(srvId).emit('ludoSync', st);
        });

        socket.on('loungeLudoMove', (tIdx) => {
            const srvId = socket.activeServerId, st = loungeLudoByServer.get(srvId);
            if (!st || !st.rolled || st.players[st.turnIdx]?.id !== socket.id) return;
            const cur = st.players[st.turnIdx], i = tIdx === 1 ? 1 : 0, d = st.lastDice;
            if (cur.tokens[i] === -1) { if (d === 6) cur.tokens[i] = 0; }
            else if (cur.tokens[i] < 24) cur.tokens[i] = Math.min(24, cur.tokens[i] + d);
            if (cur.tokens >= 24 && cur.tokens >= 24) {
                loungeLudoByServer.delete(srvId); io.to(srvId).emit('ludoEnd'); addCoins(cur.username, 250);
                return io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🎲👑 **LUDO CHAMPION:** **${cur.username}** won **+250🪙**!`, _serverId: srvId });
            }
            st.rolled = false; if (d !== 6) st.turnIdx = (st.turnIdx + 1) % st.players.length;
            io.to(srvId).emit('ludoSync', st);
        });

        // --- 6-PLAYER SNAKES & LADDERS ---
        socket.on('loungeStartSnakes', () => {
            const srvId = socket.activeServerId, players = getFullRoomPlayers(srvId);
            if (players.length < 2) return socket.emit('svNotice', '⚠️ Need 2–6 players for Snakes & Ladders!');
            const badges = ['🔴', '🔵', '🟢', '🟡', '🟣', '🟠'];
            const st = { players: players.slice(0, 6).map((p, i) => ({ id: p.id, username: p.username, badge: badges[i], pos: 1 })), turnIdx: 0, lastDice: null, lastNote: 'Race to Tile 100!', _serverId: srvId };
            loungeSnakesByServer.set(srvId, st); io.to(srvId).emit('snakesSync', st);
        });

        socket.on('loungeSnakesRoll', () => {
            const srvId = socket.activeServerId, st = loungeSnakesByServer.get(srvId);
            if (!st || st.players[st.turnIdx]?.id !== socket.id) return;
            const cur = st.players[st.turnIdx], dice = Math.floor(Math.random() * 6) + 1;
            st.lastDice = dice; let next = cur.pos + dice, note = `${cur.username} rolled ${dice}`;
            if (next > 100) { next = cur.pos; note += ' — needed exact roll!'; }
            else if (LADDERS[next]) { note += ` — 🪜 LADDER ${next}→${LADDERS[next]}!`; next = LADDERS[next]; }
            else if (SNAKES[next]) { note += ` — 🐍 SNAKE ${next}→${SNAKES[next]}!`; next = SNAKES[next]; }
            else note += ` → Tile ${next}`;
            cur.pos = next; st.lastNote = note;
            if (cur.pos === 100) {
                loungeSnakesByServer.delete(srvId); io.to(srvId).emit('snakesEnd'); addCoins(cur.username, 250);
                return io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🐍👑 **SNAKES & LADDERS WINNER:** **${cur.username}** hit 100 and won **+250🪙**!`, _serverId: srvId });
            }
            if (dice !== 6) st.turnIdx = (st.turnIdx + 1) % st.players.length;
            io.to(srvId).emit('snakesSync', st);
        });
    });
        // ============================================================================
    // ☁️ NATIVE HTTPS UPSTASH FIX (WORKS ON ALL NODE VERSIONS)
    // ============================================================================
    const https = require('https');
    upstashCmd = function(cmdArray) {
        return new Promise((resolve) => {
            if (!UPSTASH_URL || !UPSTASH_TOKEN) return resolve(null);
            try {
                const u = new URL(UPSTASH_URL);
                const body = JSON.stringify(cmdArray);
                const req = https.request({
                    hostname: u.hostname,
                    path: u.pathname === '/' ? '' : u.pathname,
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${UPSTASH_TOKEN}`,
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(body)
                    }
                }, (res) => {
                    let raw = '';
                    res.on('data', chunk => raw += chunk);
                    res.on('end', () => {
                        try {
                            const parsed = JSON.parse(raw);
                            if (parsed.error) console.error('Upstash Error:', parsed.error);
                            resolve(parsed && parsed.result !== undefined ? parsed.result : null);
                        } catch (e) { resolve(null); }
                    });
                });
                req.on('error', (err) => { console.error('Upstash Net Error:', err.message); resolve(null); });
                req.write(body);
                req.end();
            } catch (e) { resolve(null); }
        });
    };
    forcePullFromUpstash();
         // ============================================================================
    // 🚀 UPSTASH BANDWIDTH SAVER (CUTS 12GB -> <0.3GB/MONTH)
    // ============================================================================
    let _svDirty = false, _ecoDirty = false;
    const _rawSaveSvStats = saveSvStats;
    const _rawSaveEcoDB   = saveEconomyDB;

    saveSvStats = function() {
        try { fs.writeFileSync(SV_STATS_FILE, JSON.stringify(svPlayerStats, null, 2)); } catch (e) {}
        _svDirty = true;
    };

    saveEconomyDB = function() {
        try { fs.writeFileSync(ECO_DB_FILE, JSON.stringify(playerWallet, null, 2)); } catch (e) {}
        _ecoDirty = true;
    };

    setInterval(() => {
        if (!cloudRestoreCompleted) return;
        if (_svDirty) {
            _svDirty = false;
            upstashCmd(['SET', 'sammu_sv_stats', JSON.stringify(svPlayerStats)]);
        }
        if (_ecoDirty) {
            _ecoDirty = false;
            upstashCmd(['SET', 'sammu_economy', JSON.stringify(playerWallet)]);
        }
    }, 15000);
      // ============================================================================
    // 📺 /VERMAAD ON|OFF CREATOR COMMAND
    // ============================================================================
    let vermaAdEnabled = true;

    io.on('connection', (socket) => {
        socket.emit('vermaAdState', vermaAdEnabled);

        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            if (typeof raw !== 'string') return;
            const clean = raw.trim().toLowerCase();
            if (!clean.startsWith('/vermaad')) return;

            const u = (socket.username || '').toLowerCase();
            const isCreator = u.includes('samaksh') || u.includes('sammu') || (typeof verifiedCreators !== 'undefined' && verifiedCreators.has(u));
            if (!isCreator) return;

            const arg = clean.split(/\s+/)[1];
            if (arg === 'on') vermaAdEnabled = true;
            else if (arg === 'off') vermaAdEnabled = false;
            else vermaAdEnabled = !vermaAdEnabled;

            io.emit('vermaAdState', vermaAdEnabled);
            socket.emit('message', {
                username: "Sammu's Bot",
                text: `📺 **Verma Diary 18 Ad** is now **${vermaAdEnabled ? 'ON ✅' : 'OFF ❌'}** across all servers!`,
                _serverId: socket.activeServerId
            });
        });
    });
                   
          // ============================================================================
    // 🌊 WATER.IO V4 — PIECE 1/6: EVOLUTIONS, SPECIES & OCEAN HAZARDS
    // ============================================================================
    const WATER_WORLD_SIZE = 2800;
    const WATER_EVOLUTIONS = [
        { minMass: 0,    tier: 1, title: 'Hatchling',        iconOverride: null },
        { minMass: 120,  tier: 2, title: 'Reef Hunter',      iconOverride: '🐬' },
        { minMass: 300,  tier: 3, title: 'Apex Predator',    iconOverride: '🦈' },
        { minMass: 650,  tier: 4, title: 'Abyssal Kraken',   iconOverride: '🐙' },
        { minMass: 1200, tier: 5, title: 'Cosmic Leviathan', iconOverride: '🐉' }
    ];

    const WATER_FISH_SPECIES = {
        clownfish: { icon: '🐠', name: 'Clownfish',     color: '#fb923c', speed: 6.6, skill: 'shield' },
        shark:     { icon: '🦈', name: 'Great White',   color: '#38bdf8', speed: 6.2, skill: 'dash'   },
        orca:      { icon: '🐋', name: 'Shadow Orca',   color: '#a855f7', speed: 5.9, skill: 'blast'  },
        puffer:    { icon: '🐡', name: 'Spike Puffer',  color: '#facc15', speed: 6.3, skill: 'blast'  },
        octopus:   { icon: '🐙', name: 'Kraken Octo',   color: '#f43f5e', speed: 6.1, skill: 'blast'  },
        dolphin:   { icon: '🐬', name: 'Cyber Dolphin', color: '#2dd4bf', speed: 7.0, skill: 'dash'   }
    };

    const waterRoom = {
        players: new Map(),
        bots: new Map(),
        food: [],
        pearls: [],
        hazards: [
            { id: 'wp1', type: 'whirlpool', x: 650,  y: 650,  tx: 2150, ty: 2150, r: 58 },
            { id: 'wp2', type: 'whirlpool', x: 2150, y: 650,  tx: 650,  ty: 2150, r: 58 },
            { id: 'jf1', type: 'jelly',     x: 1400, y: 800,  r: 42 },
            { id: 'jf2', type: 'jelly',     x: 1400, y: 2000, r: 42 },
            { id: 'jf3', type: 'jelly',     x: 800,  y: 1400, r: 42 },
            { id: 'jf4', type: 'jelly',     x: 2000, y: 1400, r: 42 }
        ],
        foodDirty: false
    };

    function getWaterEvolution(mass, baseIcon) {
        let cur = WATER_EVOLUTIONS[0];
        for (let i = WATER_EVOLUTIONS.length - 1; i >= 0; i--) {
            if (mass >= WATER_EVOLUTIONS[i].minMass) { cur = WATER_EVOLUTIONS[i]; break; }
        }
        return { tier: cur.tier, title: cur.title, icon: cur.iconOverride || baseIcon };
    }

    function spawnWaterFoodAndPearls() {
        const colors = ['#4ade80', '#38bdf8', '#facc15', '#f472b6', '#c084fc', '#fb923c'];
        let changed = false;
        while (waterRoom.food.length < 150) {
            waterRoom.food.push({
                x: Math.floor(Math.random() * (WATER_WORLD_SIZE - 100)) + 50,
                y: Math.floor(Math.random() * (WATER_WORLD_SIZE - 100)) + 50,
                r: Math.random() < 0.18 ? 9 : 5,
                val: Math.random() < 0.18 ? 6 : 2,
                color: colors[Math.floor(Math.random() * colors.length)]
            });
            changed = true;
        }
        while (waterRoom.pearls.length < 4) {
            waterRoom.pearls.push({
                x: Math.floor(Math.random() * (WATER_WORLD_SIZE - 300)) + 150,
                y: Math.floor(Math.random() * (WATER_WORLD_SIZE - 300)) + 150,
                r: 18,
                val: 45
            });
            changed = true;
        }
        if (changed) waterRoom.foodDirty = true;
    }

    function ensureWaterBots() {
        const botNames = ['🤖 ReefBot', '🦈 JawsAI', '🐙 AbyssBot', '🐬 FinBot', '🐡 PuffyAI', '🐋 LeviathanAI', '🐉 HydraBot'];
        const speciesKeys = Object.keys(WATER_FISH_SPECIES);
        while (waterRoom.bots.size < 7) {
            const id = 'WBOT_' + Math.random().toString(36).slice(2, 7);
            const spKey = speciesKeys[Math.floor(Math.random() * speciesKeys.length)];
            const sp = WATER_FISH_SPECIES[spKey];
            waterRoom.bots.set(id, {
                id, username: botNames[waterRoom.bots.size % botNames.length],
                species: spKey, baseIcon: sp.icon, icon: sp.icon, color: sp.color,
                x: Math.floor(Math.random() * (WATER_WORLD_SIZE - 300)) + 150,
                y: Math.floor(Math.random() * (WATER_WORLD_SIZE - 300)) + 150,
                vx: (Math.random() - 0.5) * 4.5, vy: (Math.random() - 0.5) * 4.5,
                mass: Math.floor(Math.random() * 65) + 25,
                tier: 1, shieldUntil: 0, stunUntil: 0, tpCd: 0, isBot: true
            });
        }
    }

    function massToRadius(mass) {
        return Math.min(145, Math.max(18, Math.round(14 + Math.sqrt(mass) * 3.1)));
    }

    spawnWaterFoodAndPearls();
    ensureWaterBots();
    // ============================================================================
    // 🌊 WATER.IO V4 — PIECE 2/6: 85ms REAL-TIME SIMULATION LOOP
    // ============================================================================
    let waterTickCount = 0;
    setInterval(() => {
        if (waterRoom.players.size === 0) return;
        waterTickCount++;
        const now = Date.now();

        spawnWaterFoodAndPearls();
        ensureWaterBots();

        waterRoom.bots.forEach(bot => {
            if (bot.stunUntil > now) return;
            if (Math.random() < 0.05) {
                const ang = Math.random() * Math.PI * 2;
                bot.vx = Math.cos(ang) * 4.3;
                bot.vy = Math.sin(ang) * 4.3;
            }
            bot.x = Math.max(30, Math.min(WATER_WORLD_SIZE - 30, bot.x + bot.vx));
            bot.y = Math.max(30, Math.min(WATER_WORLD_SIZE - 30, bot.y + bot.vy));
            if (bot.x <= 35 || bot.x >= WATER_WORLD_SIZE - 35) bot.vx *= -1;
            if (bot.y <= 35 || bot.y >= WATER_WORLD_SIZE - 35) bot.vy *= -1;
        });

        const allEntities = [...waterRoom.players.values(), ...waterRoom.bots.values()];

        allEntities.forEach(ent => {
            if (!ent.isBot && ent.stunUntil <= now) {
                const sp = WATER_FISH_SPECIES[ent.species] || WATER_FISH_SPECIES.clownfish;
                const sizePenalty = Math.max(0.58, 1 - (ent.mass / 2200));
                const throttle = Math.min(1, Math.max(0, ent.throttle || 0));
                const isDashing = ent.dashUntil > now;
                const isBoosting = Boolean(ent.boost && ent.mass > 22);
                const mult = isDashing ? 3.2 : (isBoosting ? 2.1 : 1.0);
                const spd = sp.speed * 1.45 * sizePenalty * (isDashing ? 1 : throttle) * mult;

                if (isBoosting && !isDashing) ent.mass = Math.max(20, ent.mass - 0.16);
                ent.x = Math.max(25, Math.min(WATER_WORLD_SIZE - 25, ent.x + ent.dirX * spd));
                ent.y = Math.max(25, Math.min(WATER_WORLD_SIZE - 25, ent.y + ent.dirY * spd));
            }

            const evo = getWaterEvolution(ent.mass, ent.baseIcon);
            if (evo.tier > (ent.tier || 1)) {
                ent.tier = evo.tier;
                ent.icon = evo.icon;
                if (!ent.isBot) {
                    io.to(ent.id).emit('waterFxEvent', { type: 'evolve' });
                    io.to('waterio_ocean').emit('waterChatMsg', {
                        user: '✨ EVOLUTION',
                        text: `${evo.icon} ${ent.username} evolved into Tier ${evo.tier}: ${evo.title}!`
                    });
                }
            }

            waterRoom.hazards.forEach(hz => {
                const dist = Math.hypot(ent.x - hz.x, ent.y - hz.y);
                if (hz.type === 'whirlpool' && dist < hz.r && (ent.tpCd || 0) < now) {
                    ent.x = hz.tx + (Math.random() * 80 - 40);
                    ent.y = hz.ty + (Math.random() * 80 - 40);
                    ent.tpCd = now + 5000;
                    if (!ent.isBot) io.to(ent.id).emit('waterFxEvent', { type: 'warp' });
                } else if (hz.type === 'jelly' && dist < hz.r && (ent.shieldUntil || 0) < now && (ent.stunUntil || 0) < now) {
                    ent.stunUntil = now + 1500;
                    ent.mass = Math.max(20, ent.mass - 5);
                    if (!ent.isBot) io.to(ent.id).emit('waterFxEvent', { type: 'zap' });
                }
            });

            const r = massToRadius(ent.mass);
            for (let i = waterRoom.food.length - 1; i >= 0; i--) {
                const f = waterRoom.food[i];
                if ((ent.x - f.x) ** 2 + (ent.y - f.y) ** 2 <= (r + f.r) ** 2) {
                    ent.mass += f.val;
                    waterRoom.food.splice(i, 1);
                    waterRoom.foodDirty = true;
                }
            }
            for (let i = waterRoom.pearls.length - 1; i >= 0; i--) {
                const pr = waterRoom.pearls[i];
                if ((ent.x - pr.x) ** 2 + (ent.y - pr.y) ** 2 <= (r + pr.r) ** 2) {
                    ent.mass += pr.val;
                    waterRoom.pearls.splice(i, 1);
                    waterRoom.foodDirty = true;
                    if (!ent.isBot) {
                        addCoins(ent.username, 25);
                        io.to(ent.id).emit('waterFxEvent', { type: 'pearl' });
                    }
                }
            }
        });

        for (let i = 0; i < allEntities.length; i++) {
            const a = allEntities[i];
            if (!a || a.dead) continue;
            const ra = massToRadius(a.mass);
            for (let j = 0; j < allEntities.length; j++) {
                if (i === j) continue;
                const b = allEntities[j];
                if (!b || b.dead || (b.shieldUntil || 0) > now) continue;
                if (a.mass > b.mass * 1.15 && Math.hypot(a.x - b.x, a.y - b.y) < ra * 0.82) {
                    a.mass += Math.round(b.mass * 0.78);
                    a.kills = (a.kills || 0) + 1;
                    b.dead = true;
                    if (!a.isBot) io.to(a.id).emit('waterFxEvent', { type: 'chomp' });
                    if (b.isBot) {
                        waterRoom.bots.delete(b.id);
                    } else {
                        waterRoom.players.delete(b.id);
                        if (!a.isBot) addCoins(a.username, 100);
                        io.to(b.id).emit('waterEaten', { by: a.username, finalScore: Math.round(b.mass), kills: b.kills || 0 });
                        io.to('waterio_ocean').emit('waterChatMsg', {
                            user: '🦈 APEX FEED',
                            text: `${a.icon} ${a.username} devoured ${b.username} (${Math.round(b.mass)} mass)!`
                        });
                    }
                }
            }
        }

        const swimmers = [...waterRoom.players.values(), ...waterRoom.bots.values()]
            .filter(e => !e.dead)
            .map(e => ({
                id: e.id, name: e.username, icon: e.icon, color: e.color,
                x: Math.round(e.x), y: Math.round(e.y),
                r: massToRadius(e.mass), mass: Math.round(e.mass),
                tier: e.tier || 1, dirX: e.dirX || e.vx || 1,
                boost: Boolean((e.boost && e.mass > 22) || (e.dashUntil || 0) > now),
                shield: (e.shieldUntil || 0) > now,
                stun: (e.stunUntil || 0) > now
            }));

        const packet = { swimmers };
        if (waterRoom.foodDirty || waterTickCount % 16 === 0) {
            packet.food = waterRoom.food;
            packet.pearls = waterRoom.pearls;
            waterRoom.foodDirty = false;
        }
        if (waterTickCount % 5 === 0) {
            packet.leaderboard = [...waterRoom.players.values(), ...waterRoom.bots.values()]
                .filter(e => !e.dead)
                .sort((a, b) => b.mass - a.mass)
                .slice(0, 5)
                .map(e => ({ name: e.username, icon: e.icon, score: Math.round(e.mass) }));
        }
        io.to('waterio_ocean').emit('waterState', packet);
    }, 85);
    // ============================================================================
    // 🌊 WATER.IO V4 — PIECE 3/6: FULL-PAGE HTML & HUD LAYOUT
    // ============================================================================
    const WATER_IO_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>🌊 Water.io — Abyssal Evolution</title>
  <script src="/socket.io/socket.io.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; -webkit-user-select: none; }
    body { background: #020b18; color: #fff; font-family: system-ui, -apple-system, sans-serif; overflow: hidden; height: 100vh; width: 100vw; }
    canvas#oceanCanvas { display: block; width: 100vw; height: 100vh; touch-action: none; }
    #rblxChatBox { position: fixed; top: 10px; left: 10px; width: 255px; max-width: 56vw; z-index: 30; background: rgba(7, 16, 32, 0.56); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 12px; backdrop-filter: blur(6px); padding: 7px; display: flex; flex-direction: column; gap: 5px; }
    #rblxMessages { height: 96px; overflow-y: auto; font-size: 11px; line-height: 1.35; display: flex; flex-direction: column; gap: 3px; text-shadow: 0 1px 2px #000; }
    .rblx-line b { color: #38bdf8; }
    #rblxInputRow { display: flex; gap: 4px; }
    #rblxInput { flex: 1; background: rgba(15, 23, 42, 0.88); border: 1px solid #38bdf8; border-radius: 8px; color: #fff; padding: 5px 8px; font-size: 12px; outline: none; user-select: text; -webkit-user-select: text; }
    #rblxSendBtn { background: #0284c7; border: none; color: #fff; border-radius: 8px; padding: 0 9px; font-weight: 900; font-size: 11px; cursor: pointer; }
    #topRightHud { position: fixed; top: 10px; right: 10px; z-index: 30; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; pointer-events: none; }
    #top5Box { width: 165px; background: rgba(7, 16, 32, 0.65); border: 1px solid rgba(250, 204, 21, 0.45); border-radius: 12px; backdrop-filter: blur(6px); padding: 7px; font-size: 10px; }
    #top5Title { font-weight: 900; color: #fde047; text-align: center; margin-bottom: 4px; font-size: 11px; }
    .lb-row { display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
    #radarCanvas { width: 92px; height: 92px; border-radius: 50%; background: rgba(4, 18, 36, 0.78); border: 2px solid #38bdf8; box-shadow: 0 0 14px rgba(56, 189, 248, 0.4); }
    #evoBanner { position: fixed; top: 10px; left: 50%; transform: translateX(-50%); z-index: 25; background: rgba(7, 16, 32, 0.82); border: 1.5px solid #38bdf8; padding: 5px 14px; border-radius: 999px; font-weight: 900; font-size: 11px; color: #7dd3fc; pointer-events: none; white-space: nowrap; }
    #leftTouchArea { position: fixed; bottom: 0; left: 0; width: 52vw; height: 55vh; z-index: 26; touch-action: none; }
    #joyBase { position: fixed; bottom: 24px; left: 24px; width: 118px; height: 118px; border-radius: 50%; background: rgba(56, 189, 248, 0.14); border: 2px solid rgba(56, 189, 248, 0.42); pointer-events: none; display: flex; align-items: center; justify-content: center; }
    #joyKnob { width: 48px; height: 48px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, #7dd3fc, #0284c7); border: 2px solid #fff; box-shadow: 0 0 16px rgba(56, 189, 248, 0.8); }
    #rightActions { position: fixed; bottom: 22px; right: 18px; z-index: 28; display: flex; align-items: flex-end; gap: 12px; }
    #skillBtn { width: 70px; height: 70px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, #c084fc, #6d28d9); border: 2.5px solid #f3e8ff; color: #fff; font-weight: 900; font-size: 11px; box-shadow: 0 0 20px rgba(168, 85, 247, 0.65); cursor: pointer; touch-action: none; }
    #skillBtn:disabled { opacity: 0.45; filter: grayscale(0.7); }
    #boostBtn { width: 88px; height: 88px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, #fbbf24, #ef4444); border: 3px solid #fef08a; color: #fff; font-weight: 900; font-size: 13px; box-shadow: 0 0 24px rgba(245, 158, 11, 0.7); cursor: pointer; touch-action: none; }
    #boostBtn.active, #boostBtn:active { transform: scale(0.91); box-shadow: 0 0 38px #facc15; }
    #startOverlay { position: fixed; inset: 0; z-index: 50; background: radial-gradient(circle at top, rgba(14, 116, 144, 0.9), rgba(2, 11, 24, 0.97)); display: flex; align-items: center; justify-content: center; padding: 14px; backdrop-filter: blur(8px); }
    #startCard { background: rgba(15, 23, 42, 0.95); border: 2px solid #38bdf8; border-radius: 22px; padding: 16px; width: 100%; max-width: 410px; text-align: center; box-shadow: 0 0 45px rgba(56, 189, 248, 0.5); }
    .fish-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; margin: 10px 0; }
    .fish-card { background: #1e293b; border: 2px solid #334155; border-radius: 13px; padding: 8px 4px; cursor: pointer; transition: 0.15s; }
    .fish-card.selected { border-color: #facc15; background: rgba(250, 204, 21, 0.18); transform: translateY(-2px); box-shadow: 0 0 15px rgba(250, 204, 21, 0.4); }
    #playOceanBtn { width: 100%; padding: 13px; border: none; border-radius: 14px; background: linear-gradient(90deg, #06b6d4, #2563eb); color: #fff; font-size: 16px; font-weight: 900; cursor: pointer; box-shadow: 0 6px 22px rgba(6, 182, 212, 0.5); margin-top: 4px; }
  </style>
</head>
<body>
  <canvas id="oceanCanvas"></canvas>
  <div id="rblxChatBox">
    <div id="rblxMessages">
      <div class="rblx-line"><b>[SYSTEM]:</b> Eat plankton & smaller fish to evolve into a Cosmic Leviathan! 🐉🌊</div>
    </div>
    <div id="rblxInputRow">
      <input id="rblxInput" placeholder="Tap to chat..." maxlength="90" onkeydown="if(event.key==='Enter')sendOceanChat()">
      <button id="rblxSendBtn" onclick="sendOceanChat()">Send</button>
    </div>
  </div>
  <div id="evoBanner">🐠 Tier 1 Hatchling • Mass: 25</div>
  <div id="topRightHud">
    <div id="top5Box"><div id="top5Title">👑 TOP 5 OCEAN KINGS</div><div id="top5List"></div></div>
    <canvas id="radarCanvas" width="92" height="92"></canvas>
  </div>
  <div id="leftTouchArea"></div>
  <div id="joyBase"><div id="joyKnob"></div></div>
  <div id="rightActions">
    <button id="skillBtn" onclick="triggerOceanSkill()">🔥<br>SKILL</button>
    <button id="boostBtn">⚡<br>BOOST</button>
  </div>
  <div id="startOverlay">
    <div id="startCard">
      <div style="font-size:22px;font-weight:900;color:#38bdf8;">🌊 WATER.IO: ABYSSAL EVOLUTION</div>
      <div id="deathBanner" style="display:none;background:rgba(239,68,68,0.22);border:1px solid #f87171;border-radius:10px;padding:6px;margin-top:6px;font-size:12px;color:#fecaca;"></div>
      <input id="oceanNameInput" placeholder="Your Ocean Name..." maxlength="16" style="width:100%;margin-top:8px;padding:9px;border-radius:12px;border:1.5px solid #38bdf8;background:#090d16;color:#fff;font-size:14px;text-align:center;user-select:text;-webkit-user-select:text;">
      <div class="fish-grid" id="fishGrid">
        <div class="fish-card selected" data-sp="clownfish" onclick="pickFish(this)"><div style="font-size:28px;">🐠</div><div style="font-size:11px;font-weight:bold;">Clownfish</div><div style="font-size:9px;color:#38bdf8;">🛡️ Shield</div></div>
        <div class="fish-card" data-sp="shark" onclick="pickFish(this)"><div style="font-size:28px;">🦈</div><div style="font-size:11px;font-weight:bold;">Great White</div><div style="font-size:9px;color:#facc15;">⚡ Lunge</div></div>
        <div class="fish-card" data-sp="orca" onclick="pickFish(this)"><div style="font-size:28px;">🐋</div><div style="font-size:11px;font-weight:bold;">Shadow Orca</div><div style="font-size:9px;color:#c084fc;">🌊 Sonic</div></div>
        <div class="fish-card" data-sp="puffer" onclick="pickFish(this)"><div style="font-size:28px;">🐡</div><div style="font-size:11px;font-weight:bold;">Spike Puffer</div><div style="font-size:9px;color:#f87171;">💥 Nova</div></div>
        <div class="fish-card" data-sp="octopus" onclick="pickFish(this)"><div style="font-size:28px;">🐙</div><div style="font-size:11px;font-weight:bold;">Kraken Octo</div><div style="font-size:9px;color:#f472b6;">🖤 Ink</div></div>
        <div class="fish-card" data-sp="dolphin" onclick="pickFish(this)"><div style="font-size:28px;">🐬</div><div style="font-size:11px;font-weight:bold;">Cyber Dolphin</div><div style="font-size:9px;color:#2dd4bf;">🚀 Jet</div></div>
      </div>
      <button id="playOceanBtn" onclick="startPlayingOcean()">🌊 DIVE INTO OCEAN</button>
      <div style="margin-top:8px;"><a href="/" style="color:#94a3b8;font-size:12px;text-decoration:none;">⬅️ Back to SammuGames Chat Arena</a></div>
    </div>
  </div>`;
    // ============================================================================
    // 🌊 WATER.IO V4 — PIECE 4/6: FLOATING JOYSTICK, SKILL & AUDIO CONTROLS
    // ============================================================================
    const WATER_IO_CLIENT_JS_A = `
  <script>
    const socket = io({ transports: ['websocket', 'polling'] });
    const canvas = document.getElementById('oceanCanvas');
    const ctx = canvas.getContext('2d');
    const radar = document.getElementById('radarCanvas');
    const rctx = radar.getContext('2d');

    let selectedSpecies = 'clownfish';
    let foodList = [], pearlList = [], entityMap = new Map();
    let myId = null, boostActive = false, skillCooldownUntil = 0;
    let bubbles = [], shockwaves = [];
    let localDirX = 0, localDirY = 0, localThrottle = 0, lastEmitTime = 0, oceanAudio = null;

    const SPECIES_SPEED = { clownfish: 6.6, shark: 6.2, orca: 5.9, puffer: 6.3, octopus: 6.1, dolphin: 7.0 };
    const SPECIES_ICON  = { clownfish: '🐠', shark: '🦈', orca: '🐋', puffer: '🐡', octopus: '🐙', dolphin: '🐬' };
    const TIER_NAMES    = ['', 'Hatchling', 'Reef Hunter', 'Apex Predator', 'Abyssal Kraken', 'Cosmic Leviathan'];

    const savedUname = localStorage.getItem('sammu_username') || localStorage.getItem('username') || '';
    if (savedUname) document.getElementById('oceanNameInput').value = savedUname;

    function playOceanSfx(kind) {
      try {
        if (!oceanAudio) oceanAudio = new (window.AudioContext || window.webkitAudioContext)();
        if (oceanAudio.state === 'suspended') oceanAudio.resume();
        const now = oceanAudio.currentTime;
        const osc = oceanAudio.createOscillator(), gain = oceanAudio.createGain();
        if (kind === 'chomp' || kind === 'pearl') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(kind === 'pearl' ? 620 : 280, now);
          osc.frequency.exponentialRampToValueAtTime(kind === 'pearl' ? 1180 : 90, now + 0.18);
          gain.gain.setValueAtTime(0.28, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        } else if (kind === 'evolve') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.35);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        } else {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(520, now);
          osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);
          gain.gain.setValueAtTime(0.14, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        }
        osc.connect(gain); gain.connect(oceanAudio.destination);
        osc.start(now); osc.stop(now + 0.4);
      } catch (e) {}
    }

    function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    window.pickFish = function(el) {
      document.querySelectorAll('.fish-card').forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
      selectedSpecies = el.dataset.sp;
    };

    window.startPlayingOcean = function() {
      const uname = (document.getElementById('oceanNameInput').value || '').trim() || ('Fish_' + Math.floor(Math.random() * 900 + 100));
      localStorage.setItem('sammu_username', uname);
      document.getElementById('startOverlay').style.display = 'none';
      entityMap.set(myId, {
        id: myId, name: uname, icon: SPECIES_ICON[selectedSpecies] || '🐠',
        color: '#38bdf8', x: 1400, y: 1400, tx: 1400, ty: 1400, r: 22, mass: 25, tier: 1, dirX: 1, boost: false
      });
      socket.emit('waterSpawn', { username: uname, species: selectedSpecies });
      playOceanSfx('evolve');
    };

    function syncSteerToServer(force) {
      const now = performance.now();
      if (!force && now - lastEmitTime < 50) return;
      lastEmitTime = now;
      socket.emit('waterSteer', { dirX: localDirX, dirY: localDirY, throttle: localThrottle });
    }

    const leftTouch = document.getElementById('leftTouchArea');
    const joyBase = document.getElementById('joyBase');
    const joyKnob = document.getElementById('joyKnob');
    let joyPointerId = null, joyOriginX = 83, joyOriginY = window.innerHeight - 83;
    const maxRadius = 44;

    leftTouch.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      joyPointerId = e.pointerId;
      leftTouch.setPointerCapture(e.pointerId);
      joyOriginX = e.clientX; joyOriginY = e.clientY;
      joyBase.style.left = (joyOriginX - 59) + 'px';
      joyBase.style.top = (joyOriginY - 59) + 'px';
      joyBase.style.bottom = 'auto';
      joyKnob.style.transform = 'translate3d(0px, 0px, 0)';
    });

    leftTouch.addEventListener('pointermove', (e) => {
      if (e.pointerId !== joyPointerId) return;
      let dx = e.clientX - joyOriginX, dy = e.clientY - joyOriginY;
      const dist = Math.hypot(dx, dy);
      if (dist > maxRadius) { dx = (dx / dist) * maxRadius; dy = (dy / dist) * maxRadius; }
      joyKnob.style.transform = 'translate3d(' + dx + 'px, ' + dy + 'px, 0)';
      if (dist > 4) {
        localDirX = dx / dist; localDirY = dy / dist; localThrottle = Math.min(1, dist / maxRadius);
      } else {
        localDirX = 0; localDirY = 0; localThrottle = 0;
      }
      syncSteerToServer(false);
    });

    function resetFloatingJoy(e) {
      if (e && e.pointerId !== joyPointerId) return;
      joyPointerId = null;
      joyBase.style.left = '24px'; joyBase.style.top = 'auto'; joyBase.style.bottom = '24px';
      joyKnob.style.transform = 'translate3d(0px, 0px, 0)';
      localDirX = 0; localDirY = 0; localThrottle = 0;
      syncSteerToServer(true);
    }
    leftTouch.addEventListener('pointerup', resetFloatingJoy);
    leftTouch.addEventListener('pointercancel', resetFloatingJoy);

    const boostBtn = document.getElementById('boostBtn');
    function triggerBoost(state) {
      boostActive = Boolean(state);
      boostBtn.classList.toggle('active', boostActive);
      socket.emit('waterBoost', boostActive);
    }
    boostBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); triggerBoost(true); });
    boostBtn.addEventListener('pointerup', () => triggerBoost(false));
    boostBtn.addEventListener('pointercancel', () => triggerBoost(false));
    boostBtn.addEventListener('pointerleave', () => triggerBoost(false));

    window.triggerOceanSkill = function() {
      const now = Date.now();
      if (now  {
        left--;
        if (left <= 0) { clearInterval(cdTimer); sBtn.disabled = false; sBtn.innerHTML = '🔥<br>SKILL'; }
        else { sBtn.innerHTML = '⏳<br>' + left + 's'; }
      }, 1000);
    };`;
    // ============================================================================
    // 🌊 WATER.IO V4 — PIECE 5/6: 60FPS OCEAN RENDERER & SONAR RADAR
    // ============================================================================
    const WATER_IO_CLIENT_JS_B = `
    window.sendOceanChat = function() {
      const inp = document.getElementById('rblxInput');
      const txt = (inp.value || '').trim();
      if (!txt) return;
      const uname = (document.getElementById('oceanNameInput').value || 'Fish').trim();
      socket.emit('waterChatSend', { user: uname, text: txt });
      inp.value = '';
    };

    socket.on('connect', () => { myId = socket.id; socket.emit('waterJoinSpectate'); });

    socket.on('waterFxEvent', (ev) => {
      if (!ev) return;
      playOceanSfx(ev.type);
      const me = entityMap.get(myId);
      if (me && (ev.type === 'evolve' || ev.type === 'warp')) shockwaves.push({ x: me.x, y: me.y, r: me.r, alpha: 1 });
    });

    socket.on('waterState', (state) => {
      if (Array.isArray(state.food)) foodList = state.food;
      if (Array.isArray(state.pearls)) pearlList = state.pearls;

      if (Array.isArray(state.leaderboard)) {
        const lbBox = document.getElementById('top5List');
        lbBox.innerHTML = state.leaderboard.map((p, i) =>
          '<div class="lb-row"><span>' + (i === 0 ? '👑' : '#' + (i + 1)) + ' ' + p.icon + ' ' + p.name.slice(0, 9) + '</span><b>' + p.score + '</b></div>'
        ).join('');
      }

      const activeIds = new Set();
      (state.swimmers || []).forEach(s => {
        activeIds.add(s.id);
        const existing = entityMap.get(s.id);
        if (existing) {
          existing.tx = s.x; existing.ty = s.y; existing.r = s.r; existing.mass = s.mass;
          existing.tier = s.tier; existing.dirX = s.dirX; existing.boost = s.boost;
          existing.shield = s.shield; existing.stun = s.stun; existing.icon = s.icon; existing.name = s.name;
          if (Math.hypot(existing.x - s.x, existing.y - s.y) > 260) { existing.x = s.x; existing.y = s.y; }
        } else {
          entityMap.set(s.id, { ...s, tx: s.x, ty: s.y });
        }
      });

      for (const id of entityMap.keys()) { if (!activeIds.has(id)) entityMap.delete(id); }

      const me = entityMap.get(myId);
      if (me) {
        const tName = TIER_NAMES[me.tier || 1] || 'Hatchling';
        document.getElementById('evoBanner').textContent = me.icon + ' T' + (me.tier || 1) + ' ' + tName + ' • Mass: ' + me.mass;
      }
    });

    socket.on('waterChatMsg', (msg) => {
      const box = document.getElementById('rblxMessages');
      const div = document.createElement('div');
      div.className = 'rblx-line';
      div.innerHTML = '<b>' + msg.user + ':</b> ' + msg.text.replace(/</g, '&lt;');
      box.appendChild(div);
      while (box.children.length > 30) box.removeChild(box.firstElementChild);
      box.scrollTop = box.scrollHeight;
    });

    socket.on('waterEaten', ({ by, finalScore, kills }) => {
      triggerBoost(false);
      entityMap.delete(myId);
      const ov = document.getElementById('startOverlay');
      const ban = document.getElementById('deathBanner');
      ban.style.display = 'block';
      ban.innerHTML = '🦈 Eaten by <b>' + by + '</b>! Final Mass: <b>' + finalScore + '</b> • Kills: <b>' + (kills || 0) + '</b>';
      ov.style.display = 'flex';
    });

    function drawRadarMinimap(me) {
      rctx.clearRect(0, 0, 92, 92);
      const scale = 92 / 2800;
      rctx.fillStyle = '#fde047';
      pearlList.forEach(p => { rctx.beginPath(); rctx.arc(p.x * scale, p.y * scale, 2.5, 0, Math.PI * 2); rctx.fill(); });
      entityMap.forEach((s, id) => {
        rctx.fillStyle = id === myId ? '#ffffff' : (me && s.mass > me.mass * 1.15 ? '#ef4444' : '#38bdf8');
        rctx.beginPath(); rctx.arc(s.x * scale, s.y * scale, id === myId ? 3.5 : 2.2, 0, Math.PI * 2); rctx.fill();
      });
    }

    const CLIENT_HAZARDS = [
      { type: 'whirlpool', x: 650,  y: 650,  r: 58 }, { type: 'whirlpool', x: 2150, y: 650,  r: 58 },
      { type: 'jelly',     x: 1400, y: 800,  r: 42 }, { type: 'jelly',     x: 1400, y: 2000, r: 42 },
      { type: 'jelly',     x: 800,  y: 1400, r: 42 }, { type: 'jelly',     x: 2000, y: 1400, r: 42 }
    ];

    let lastFrame = performance.now();
    function renderLoop(now) {
      const dt = Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;

      entityMap.forEach((s, id) => {
        if (id === myId) {
          if (!s.stun) {
            const baseSpd = (SPECIES_SPEED[selectedSpecies] || 6.4) * 17.5;
            const sizePenalty = Math.max(0.58, 1 - (s.mass / 2200));
            const mult = (boostActive && s.mass > 22) ? 2.1 : 1.0;
            s.x = Math.max(25, Math.min(2775, s.x + localDirX * localThrottle * baseSpd * sizePenalty * mult * dt));
            s.y = Math.max(25, Math.min(2775, s.y + localDirY * localThrottle * baseSpd * sizePenalty * mult * dt));
          }
          s.x += (s.tx - s.x) * 0.2; s.y += (s.ty - s.y) * 0.2;
          if (localDirX !== 0) s.dirX = localDirX;
        } else {
          s.x += (s.tx - s.x) * 0.28; s.y += (s.ty - s.y) * 0.28;
        }
      });

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const me = entityMap.get(myId);
      const camX = me ? me.x : 1400, camY = me ? me.y : 1400;

      ctx.fillStyle = (me && boostActive) ? '#082f49' : '#031527';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2 - camX, canvas.height / 2 - camY);

      const startX = Math.max(0, Math.floor((camX - canvas.width / 2) / 140) * 140);
      const endX   = Math.min(2800, camX + canvas.width / 2 + 140);
      const startY = Math.max(0, Math.floor((camY - canvas.height / 2) / 140) * 140);
      const endY   = Math.min(2800, camY + canvas.height / 2 + 140);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = startX; x <= endX; x += 140) { ctx.moveTo(x, startY); ctx.lineTo(x, endY); }
      for (let y = startY; y <= endY; y += 140) { ctx.moveTo(startX, y); ctx.lineTo(endX, y); }
      ctx.stroke();

      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 10; ctx.strokeRect(0, 0, 2800, 2800);

      CLIENT_HAZARDS.forEach(hz => {
        ctx.font = hz.type === 'whirlpool' ? '32px serif' : '34px serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (hz.type === 'whirlpool') {
          ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(hz.x, hz.y, hz.r * (0.85 + Math.sin(now * 0.006) * 0.15), 0, Math.PI * 2); ctx.stroke();
          ctx.fillText('🌀', hz.x, hz.y);
        } else {
          ctx.fillText('🪼', hz.x, hz.y + Math.sin(now * 0.005) * 6);
        }
      });

      const halfW = canvas.width / 2 + 50, halfH = canvas.height / 2 + 50;
      for (let i = 0; i < foodList.length; i++) {
        const f = foodList[i];
        if (Math.abs(f.x - camX) > halfW || Math.abs(f.y - camY) > halfH) continue;
        ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
      }

      pearlList.forEach(pr => {
        ctx.fillStyle = 'rgba(250, 204, 21, 0.25)'; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r + 8, 0, Math.PI * 2); ctx.fill();
        ctx.font = '26px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🔮', pr.x, pr.y);
      });

      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i]; sw.r += 7; sw.alpha -= 0.035;
        if (sw.alpha  a.r - b.r).forEach(s => {
        const isBoostingNow = (s.id === myId) ? boostActive : s.boost;
        if (isBoostingNow && bubbles.length < 40) {
          bubbles.push({ x: s.x + (Math.random() - 0.5) * s.r, y: s.y + (Math.random() - 0.5) * s.r, r: Math.random() * 4 + 2, alpha: 0.85 });
        }
        ctx.fillStyle = s.shield ? 'rgba(56, 189, 248, 0.35)' : (isBoostingNow ? 'rgba(250, 204, 21, 0.25)' : (s.color + '33'));
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r + (s.shield ? 11 : 6), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = s.shield ? '#7dd3fc' : (isBoostingNow ? '#fde047' : (s.id === myId ? '#facc15' : s.color));
        ctx.lineWidth = s.shield || isBoostingNow ? 4 : 2; ctx.stroke();

        ctx.save(); ctx.translate(s.x, s.y);
        if (s.dirX > 0) ctx.scale(-1, 1);
        ctx.font = Math.round(s.r * 1.45) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(s.icon, 0, 2); ctx.restore();

        ctx.fillStyle = '#ffffff'; ctx.font = 'bold ' + Math.max(11, Math.round(s.r * 0.32)) + 'px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(s.name + ' (' + s.mass + ')' + (s.stun ? ' ⚡STUN' : ''), s.x, s.y - s.r - 9);
      });

      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i]; b.y -= 1.5; b.alpha -= 0.04;
        if (b.alpha <= 0) { bubbles.splice(i, 1); continue; }
        ctx.strokeStyle = 'rgba(186, 230, 253, ' + b.alpha + ')'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
      }

      ctx.restore();
      drawRadarMinimap(me);
      requestAnimationFrame(renderLoop);
    }
    requestAnimationFrame(renderLoop);
  </script>
</body>
</html>`;
    // ============================================================================
    // 🌊 WATER.IO V4 — PIECE 6/6: ROUTE, LOBBY BUTTON & SOCKET HANDLERS
    // ============================================================================
        // ============================================================================
    // 🌊 WATER.IO V4 — PRIORITY ROUTE FIX (BYPASSES SERVER.JS CATCH-ALL)
    // ============================================================================
    const serveWaterIoPage = (req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(WATER_IO_PAGE_HTML + '\n' + WATER_IO_CLIENT_JS_A + '\n' + WATER_IO_CLIENT_JS_B);
    };

    app.get('/waterio', serveWaterIoPage);
    app.get('/waterio/', serveWaterIoPage);

    // Move /waterio routes to the very top of Express stack before any '*' wildcard
    if (app._router && Array.isArray(app._router.stack)) {
        const stack = app._router.stack;
        const waterLayers = [];
        for (let i = stack.length - 1; i >= 0; i--) {
            if (stack[i].route && (stack[i].route.path === '/waterio' || stack[i].route.path === '/waterio/')) {
                waterLayers.unshift(stack.splice(i, 1));
            }
        }
        stack.unshift(...waterLayers);
    }

    const WATER_IO_LOBBY_BTN = `
    <script id="waterIoLobbyInjector">
    (function() {
      setInterval(function() {
        if (document.getElementById('openWaterIoPageBtn')) return;
        const anchor = Array.from(document.querySelectorAll('button')).find(b => /phonk dj|sammuverse|draw pad/i.test(b.textContent || ''));
        if (anchor && anchor.parentElement) {
          const btn = anchor.cloneNode(true);
          btn.id = 'openWaterIoPageBtn';
          btn.removeAttribute('onclick');
          btn.textContent = '🌊 Water.io';
          btn.style.background = 'linear-gradient(90deg, #0284c7, #06b6d4)';
          btn.onclick = function(e) {
            e.preventDefault();
            window.location.href = '/waterio';
          };
          anchor.parentElement.insertBefore(btn, anchor.nextSibling);
        }
      }, 1500);
    })();
    </script>`;

    app.use((req, res, next) => {
        if (req.path === '/waterio' || req.path === '/waterio/') return next();
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('waterIoLobbyInjector')) {
                body = body.replace('</body>', WATER_IO_LOBBY_BTN + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });


    io.on('connection', (socket) => {
        socket.on('waterJoinSpectate', () => {
            socket.join('waterio_ocean');
        });

        socket.on('waterSpawn', ({ username, species }) => {
            socket.join('waterio_ocean');
            const spKey = WATER_FISH_SPECIES[species] ? species : 'clownfish';
            const sp = WATER_FISH_SPECIES[spKey];
            const cleanName = String(username || 'Fish').trim().slice(0, 16) || 'Fish';
            socket.username = cleanName;

            waterRoom.players.set(socket.id, {
                id: socket.id, username: cleanName, species: spKey,
                baseIcon: sp.icon, icon: sp.icon, color: sp.color,
                x: Math.floor(Math.random() * (WATER_WORLD_SIZE - 400)) + 200,
                y: Math.floor(Math.random() * (WATER_WORLD_SIZE - 400)) + 200,
                dirX: 1, dirY: 0, throttle: 0,
                mass: 25, tier: 1, kills: 0,
                boost: false, dashUntil: 0, shieldUntil: 0, stunUntil: 0, skillCd: 0,
                isBot: false
            });

            io.to('waterio_ocean').emit('waterChatMsg', {
                user: '🌊 OCEAN',
                text: `${sp.icon} ${cleanName} entered the Abyssal Ocean!`
            });
        });

        socket.on('waterSteer', ({ dirX, dirY, throttle }) => {
            const p = waterRoom.players.get(socket.id);
            if (!p) return;
            p.dirX = Math.max(-1, Math.min(1, Number(dirX) || 0));
            p.dirY = Math.max(-1, Math.min(1, Number(dirY) || 0));
            p.throttle = Math.max(0, Math.min(1, Number(throttle) || 0));
        });

        socket.on('waterBoost', (on) => {
            const p = waterRoom.players.get(socket.id);
            if (p) p.boost = Boolean(on);
        });

        socket.on('waterUseSkill', () => {
            const p = waterRoom.players.get(socket.id);
            const now = Date.now();
            if (!p || now < (p.skillCd || 0)) return;
            p.skillCd = now + 5500;

            const sp = WATER_FISH_SPECIES[p.species] || WATER_FISH_SPECIES.clownfish;
            if (sp.skill === 'dash') {
                p.dashUntil = now + 650;
            } else if (sp.skill === 'shield') {
                p.shieldUntil = now + 4000;
            } else if (sp.skill === 'blast') {
                const all = [...waterRoom.players.values(), ...waterRoom.bots.values()];
                all.forEach(other => {
                    if (other.id === p.id) return;
                    const dx = other.x - p.x, dy = other.y - p.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist > 0 && dist < 240) {
                        other.x = Math.max(30, Math.min(WATER_WORLD_SIZE - 30, other.x + (dx / dist) * 110));
                        other.y = Math.max(30, Math.min(WATER_WORLD_SIZE - 30, other.y + (dy / dist) * 110));
                        other.stunUntil = now + 1400;
                    }
                });
            }
        });

        socket.on('waterChatSend', ({ user, text }) => {
            const cleanTxt = String(text || '').trim().slice(0, 90);
            const cleanUsr = String(user || socket.username || 'Fish').trim().slice(0, 16);
            if (!cleanTxt) return;
            io.to('waterio_ocean').emit('waterChatMsg', { user: cleanUsr, text: cleanTxt });
        });

        socket.on('disconnect', () => {
            waterRoom.players.delete(socket.id);
        });
    });

    // ============================================================================
    // 🃏 UNO RE-LAUNCH & STUCK-LOBBY FIX (PASTE BEFORE return OG_HOSTS;)
    // ============================================================================
    io.on('connection', (socket) => {
        socket.prependListener('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof raw !== 'string') return;
            const cmd = raw.trim().toLowerCase();

            // Allow stopping/resetting a stuck UNO game anytime
            if (cmd === '!stopuno' || cmd === '/stopuno') {
                const old = unoByServer.get(srvId);
                if (old && old.interval) clearInterval(old.interval);
                unoByServer.delete(srvId);
                io.to(srvId).emit('unoEnd', { _serverId: srvId });
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: '🛑🃏 **UNO table cleared!** Type `!uno` anytime to start a fresh match!',
                    _serverId: srvId
                });
                return;
            }

            if (cmd === '!uno') {
                const existing = unoByServer.get(srvId);
                if (existing) {
                    // Check if any human player in the UNO game is still connected
                    const anyHumanOnline = existing.players.some(p => !p.isBot && io.sockets.sockets.has(p.id));
                    if (!anyHumanOnline) {
                        if (existing.interval) clearInterval(existing.interval);
                        unoByServer.delete(srvId);
                    } else {
                        // Re-link current socket if player reconnected with same username
                        const uname = (socket.username || '').toLowerCase();
                        const match = existing.players.find(p => !p.isBot && p.username.toLowerCase() === uname);
                        if (match) match.id = socket.id;
                        else if (existing.phase === 'lobby' && existing.players.length < 10) {
                            existing.players.push({ id: socket.id, username: socket.username || 'Player', hand: [], saidUno: false });
                        }
                        broadcastUno(srvId);
                    }
                }
            }
        });

        socket.on('unoResetTable', () => {
            const srvId = socket.activeServerId;
            if (!srvId) return;
            const old = unoByServer.get(srvId);
            if (old && old.interval) clearInterval(old.interval);
            unoByServer.delete(srvId);
            io.to(srvId).emit('unoEnd', { _serverId: srvId });
        });
    });
    // ============================================================================
    // 🌊 WATER.IO V4 — BULLETPROOF ROUTE & POPUP OVERRIDE (FIXED .split('?')[0])
    // ============================================================================
    const waterIoHandler = (req, res, next) => {
        const cleanUrl = (req.originalUrl || req.url || '').split('?')[0].toLowerCase();
        if (cleanUrl === '/waterio' || cleanUrl === '/waterio/') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(WATER_IO_PAGE_HTML + '\n' + WATER_IO_CLIENT_JS_A + '\n' + WATER_IO_CLIENT_JS_B);
        }
        return next();
    };

    app.use(waterIoHandler);

    // Move waterIoHandler to index 0 of Express stack (Express 4 & Express 5 safe)
    const routerStack = (app._router && app._router.stack) || (app.router && app.router.stack);
    if (Array.isArray(routerStack)) {
        const idx = routerStack.findIndex(layer => layer && layer.handle === waterIoHandler);
        if (idx > 0) {
            const [movedLayer] = routerStack.splice(idx, 1);
            routerStack.unshift(movedLayer);
        }
    }

            // ============================================================================
    // 🌊 WATER.IO V4 — CLEAN DIVE BUTTON & EVOLUTION FIX (NO CONST REASSIGNMENT)
    // ============================================================================
    app.use((req, res, next) => {
        const cleanUrl = (req.originalUrl || req.url || '').split('?')[0].toLowerCase();
        if (cleanUrl === '/waterio' || cleanUrl === '/waterio/') {
            const diveFixScript = `
            <script>
            (function() {
              function bindDiveFix() {
                const btn = document.getElementById('playOceanBtn');
                const ov = document.getElementById('startOverlay');
                if (!btn || !ov || btn.dataset.diveFixed) return;
                btn.dataset.diveFixed = '1';
                btn.onclick = function(e) {
                  if (e) e.preventDefault();
                  const inp = document.getElementById('oceanNameInput');
                  const uname = (inp && inp.value ? inp.value.trim() : '') || ('Fish_' + Math.floor(Math.random() * 900 + 100));
                  localStorage.setItem('sammu_username', uname);
                  const selCard = document.querySelector('.fish-card.selected');
                  const sp = (selCard && selCard.dataset.sp) ? selCard.dataset.sp : 'clownfish';
                  ov.style.display = 'none';
                  if (typeof socket !== 'undefined') {
                    if (socket.id) myId = socket.id;
                    socket.emit('waterSpawn', { username: uname, species: sp });
                  }
                };
              }
              bindDiveFix();
              setInterval(bindDiveFix, 400);
            })();
            </script>`;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(
                WATER_IO_PAGE_HTML + '\n' +
                WATER_IO_CLIENT_JS_A + '\n' +
                WATER_IO_CLIENT_JS_B + '\n' +
                diveFixScript
            );
        }
        return next();
    });

    const stackRef = (app._router && app._router.stack) || (app.router && app.router.stack);
    if (Array.isArray(stackRef) && stackRef.length > 1) {
        const latestLayer = stackRef.pop();
        stackRef.unshift(latestLayer);
    }


    // ============================================================================
    // 🌊 WATER.IO V4 — VERIFIED CLIENT SCRIPT (PIECE 1/2)
    // ============================================================================
    const WATER_IO_VERIFIED_A = `
  <script>
  (function() {
    const socket = io({ transports: ['websocket', 'polling'] });
    const canvas = document.getElementById('oceanCanvas');
    const ctx = canvas.getContext('2d');
    const radar = document.getElementById('radarCanvas');
    const rctx = radar ? radar.getContext('2d') : null;

    let selectedSpecies = 'clownfish';
    let foodList = [], pearlList = [], entityMap = new Map();
    let myId = null, boostActive = false, skillCooldownUntil = 0;
    let bubbles = [], shockwaves = [];
    let localDirX = 0, localDirY = 0, localThrottle = 0, lastEmitTime = 0, oceanAudio = null;

    const SPECIES_SPEED = { clownfish: 6.6, shark: 6.2, orca: 5.9, puffer: 6.3, octopus: 6.1, dolphin: 7.0 };
    const SPECIES_ICON  = { clownfish: '🐠', shark: '🦈', orca: '🐋', puffer: '🐡', octopus: '🐙', dolphin: '🐬' };
    const TIER_NAMES    = ['', 'Hatchling', 'Reef Hunter', 'Apex Predator', 'Abyssal Kraken', 'Cosmic Leviathan'];

    const nameInp = document.getElementById('oceanNameInput');
    const savedUname = localStorage.getItem('sammu_username') || localStorage.getItem('username') || '';
    if (savedUname && nameInp) nameInp.value = savedUname;

    function playOceanSfx(kind) {
      try {
        if (!oceanAudio) oceanAudio = new (window.AudioContext || window.webkitAudioContext)();
        if (oceanAudio.state === 'suspended') oceanAudio.resume();
        const now = oceanAudio.currentTime;
        const osc = oceanAudio.createOscillator(), gain = oceanAudio.createGain();
        osc.type = (kind === 'chomp' || kind === 'pearl') ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(kind === 'evolve' ? 440 : 320, now);
        osc.frequency.exponentialRampToValueAtTime(kind === 'evolve' ? 880 : 120, now + 0.22);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain); gain.connect(oceanAudio.destination);
        osc.start(now); osc.stop(now + 0.26);
      } catch (e) {}
    }

    function resizeCanvas() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    window.pickFish = function(el) {
      document.querySelectorAll('.fish-card').forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
      selectedSpecies = el.dataset.sp || 'clownfish';
    };

    window.startPlayingOcean = function() {
      const uname = (nameInp && nameInp.value ? nameInp.value.trim() : '') || ('Fish_' + Math.floor(Math.random() * 900 + 100));
      localStorage.setItem('sammu_username', uname);
      const ov = document.getElementById('startOverlay');
      if (ov) ov.style.display = 'none';
      if (socket.id) myId = socket.id;
      entityMap.set(myId, {
        id: myId, name: uname, icon: SPECIES_ICON[selectedSpecies] || '🐠',
        color: '#38bdf8', x: 1400, y: 1400, tx: 1400, ty: 1400, r: 22, mass: 25, tier: 1, dirX: 1, boost: false
      });
      socket.emit('waterSpawn', { username: uname, species: selectedSpecies });
      playOceanSfx('evolve');
    };

    const playBtn = document.getElementById('playOceanBtn');
    if (playBtn) playBtn.onclick = window.startPlayingOcean;

    function syncSteerToServer(force) {
      const now = performance.now();
      if (!force && now - lastEmitTime < 50) return;
      lastEmitTime = now;
      socket.emit('waterSteer', { dirX: localDirX, dirY: localDirY, throttle: localThrottle });
    }

    const leftTouch = document.getElementById('leftTouchArea');
    const joyBase = document.getElementById('joyBase');
    const joyKnob = document.getElementById('joyKnob');
    let joyPointerId = null, joyOriginX = 83, joyOriginY = window.innerHeight - 83;
    const maxRadius = 44;

    if (leftTouch && joyBase && joyKnob) {
      leftTouch.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        joyPointerId = e.pointerId;
        leftTouch.setPointerCapture(e.pointerId);
        joyOriginX = e.clientX; joyOriginY = e.clientY;
        joyBase.style.left = (joyOriginX - 59) + 'px';
        joyBase.style.top = (joyOriginY - 59) + 'px';
        joyBase.style.bottom = 'auto';
        joyKnob.style.transform = 'translate3d(0px, 0px, 0)';
      });

      leftTouch.addEventListener('pointermove', (e) => {
        if (e.pointerId !== joyPointerId) return;
        let dx = e.clientX - joyOriginX, dy = e.clientY - joyOriginY;
        const dist = Math.hypot(dx, dy);
        if (dist > maxRadius) { dx = (dx / dist) * maxRadius; dy = (dy / dist) * maxRadius; }
        joyKnob.style.transform = 'translate3d(' + dx + 'px, ' + dy + 'px, 0)';
        if (dist > 4) {
          localDirX = dx / dist; localDirY = dy / dist; localThrottle = Math.min(1, dist / maxRadius);
        } else {
          localDirX = 0; localDirY = 0; localThrottle = 0;
        }
        syncSteerToServer(false);
      });

      function resetFloatingJoy(e) {
        if (e && e.pointerId !== joyPointerId) return;
        joyPointerId = null;
        joyBase.style.left = '24px'; joyBase.style.top = 'auto'; joyBase.style.bottom = '24px';
        joyKnob.style.transform = 'translate3d(0px, 0px, 0)';
        localDirX = 0; localDirY = 0; localThrottle = 0;
        syncSteerToServer(true);
      }
      leftTouch.addEventListener('pointerup', resetFloatingJoy);
      leftTouch.addEventListener('pointercancel', resetFloatingJoy);
    }

    const boostBtn = document.getElementById('boostBtn');
    function triggerBoost(state) {
      boostActive = Boolean(state);
      if (boostBtn) boostBtn.classList.toggle('active', boostActive);
      socket.emit('waterBoost', boostActive);
    }
    if (boostBtn) {
      boostBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); triggerBoost(true); });
      boostBtn.addEventListener('pointerup', () => triggerBoost(false));
      boostBtn.addEventListener('pointercancel', () => triggerBoost(false));
      boostBtn.addEventListener('pointerleave', () => triggerBoost(false));
    }

    window.triggerOceanSkill = function() {
      const now = Date.now();
      if (now  {
        left--;
        if (left <= 0) {
          clearInterval(cdTimer);
          sBtn.disabled = false;
          sBtn.innerHTML = '🔥<br>SKILL';
        } else {
          sBtn.innerHTML = '⏳<br>' + left + 's';
        }
      }, 1000);
    };

    window.sendOceanChat = function() {
      const inp = document.getElementById('rblxInput');
      const txt = (inp && inp.value ? inp.value.trim() : '');
      if (!txt) return;
      const uname = (nameInp && nameInp.value ? nameInp.value.trim() : '') || 'Fish';
      socket.emit('waterChatSend', { user: uname, text: txt });
      inp.value = '';
    };

    const sendBtn = document.getElementById('rblxSendBtn');
    if (sendBtn) sendBtn.onclick = window.sendOceanChat;`;
    // ============================================================================
    // 🌊 WATER.IO V4 — VERIFIED RENDERER & PRIORITY ROUTE (PIECE 2A)
    // ============================================================================
    const WATER_IO_VERIFIED_B = `
    socket.on('connect', () => {
      myId = socket.id;
      socket.emit('waterJoinSpectate');
    });

    socket.on('waterFxEvent', (ev) => {
      if (!ev) return;
      playOceanSfx(ev.type);
      const me = entityMap.get(myId);
      if (me && (ev.type === 'evolve' || ev.type === 'warp')) shockwaves.push({ x: me.x, y: me.y, r: me.r, alpha: 1 });
    });

    socket.on('waterState', (state) => {
      if (Array.isArray(state.food)) foodList = state.food;
      if (Array.isArray(state.pearls)) pearlList = state.pearls;

      if (Array.isArray(state.leaderboard)) {
        const lbBox = document.getElementById('top5List');
        if (lbBox) {
          lbBox.innerHTML = state.leaderboard.map((p, i) =>
            '<div class="lb-row"><span>' + (i === 0 ? '👑' : '#' + (i + 1)) + ' ' + p.icon + ' ' + p.name.slice(0, 9) + '</span><b>' + p.score + '</b></div>'
          ).join('');
        }
      }

      const activeIds = new Set();
      (state.swimmers || []).forEach(s => {
        activeIds.add(s.id);
        const existing = entityMap.get(s.id);
        if (existing) {
          existing.tx = s.x; existing.ty = s.y; existing.r = s.r; existing.mass = s.mass;
          existing.tier = s.tier; existing.dirX = s.dirX; existing.boost = s.boost;
          existing.shield = s.shield; existing.stun = s.stun; existing.icon = s.icon; existing.name = s.name;
          if (Math.hypot(existing.x - s.x, existing.y - s.y) > 260) { existing.x = s.x; existing.y = s.y; }
        } else {
          entityMap.set(s.id, { ...s, tx: s.x, ty: s.y });
        }
      });

      for (const id of entityMap.keys()) { if (!activeIds.has(id)) entityMap.delete(id); }

      const me = entityMap.get(myId);
      const evoBan = document.getElementById('evoBanner');
      if (me && evoBan) {
        const tName = TIER_NAMES[me.tier || 1] || 'Hatchling';
        evoBan.textContent = me.icon + ' T' + (me.tier || 1) + ' ' + tName + ' • Mass: ' + me.mass;
      }
    });

    socket.on('waterChatMsg', (msg) => {
      const box = document.getElementById('rblxMessages');
      if (!box) return;
      const div = document.createElement('div');
      div.className = 'rblx-line';
      div.innerHTML = '<b>' + msg.user + ':</b> ' + String(msg.text || '').replace(/</g, '&lt;');
      box.appendChild(div);
      while (box.children.length > 30) box.removeChild(box.firstElementChild);
      box.scrollTop = box.scrollHeight;
    });

    socket.on('waterEaten', ({ by, finalScore, kills }) => {
      triggerBoost(false);
      entityMap.delete(myId);
      const ov = document.getElementById('startOverlay');
      const ban = document.getElementById('deathBanner');
      if (ban) {
        ban.style.display = 'block';
        ban.innerHTML = '🦈 Eaten by <b>' + by + '</b>! Final Mass: <b>' + finalScore + '</b> • Kills: <b>' + (kills || 0) + '</b>';
      }
      if (ov) ov.style.display = 'flex';
    });

    function drawRadarMinimap(me) {
      if (!rctx) return;
      rctx.clearRect(0, 0, 92, 92);
      const scale = 92 / 2800;
      rctx.fillStyle = '#fde047';
      pearlList.forEach(p => { rctx.beginPath(); rctx.arc(p.x * scale, p.y * scale, 2.5, 0, Math.PI * 2); rctx.fill(); });
      entityMap.forEach((s, id) => {
        rctx.fillStyle = id === myId ? '#ffffff' : (me && s.mass > me.mass * 1.15 ? '#ef4444' : '#38bdf8');
        rctx.beginPath(); rctx.arc(s.x * scale, s.y * scale, id === myId ? 3.5 : 2.2, 0, Math.PI * 2); rctx.fill();
      });
    }`;
    // ============================================================================
    // 🌊 WATER.IO V4 — VERIFIED RENDERER & PRIORITY ROUTE (PIECE 2B)
    // ============================================================================
    const WATER_IO_VERIFIED_C = `
    const CLIENT_HAZARDS = [
      { type: 'whirlpool', x: 650,  y: 650,  r: 58 }, { type: 'whirlpool', x: 2150, y: 650,  r: 58 },
      { type: 'jelly',     x: 1400, y: 800,  r: 42 }, { type: 'jelly',     x: 1400, y: 2000, r: 42 },
      { type: 'jelly',     x: 800,  y: 1400, r: 42 }, { type: 'jelly',     x: 2000, y: 1400, r: 42 }
    ];

    let lastFrame = performance.now();
    function renderLoop(now) {
      const dt = Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;

      entityMap.forEach((s, id) => {
        if (id === myId) {
          if (!s.stun) {
            const baseSpd = (SPECIES_SPEED[selectedSpecies] || 6.4) * 17.5;
            const sizePenalty = Math.max(0.58, 1 - (s.mass / 2200));
            const mult = (boostActive && s.mass > 22) ? 2.1 : 1.0;
            s.x = Math.max(25, Math.min(2775, s.x + localDirX * localThrottle * baseSpd * sizePenalty * mult * dt));
            s.y = Math.max(25, Math.min(2775, s.y + localDirY * localThrottle * baseSpd * sizePenalty * mult * dt));
          }
          s.x += (s.tx - s.x) * 0.2; s.y += (s.ty - s.y) * 0.2;
          if (localDirX !== 0) s.dirX = localDirX;
        } else {
          s.x += (s.tx - s.x) * 0.28; s.y += (s.ty - s.y) * 0.28;
        }
      });

      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const me = entityMap.get(myId);
        const camX = me ? me.x : 1400, camY = me ? me.y : 1400;

        ctx.fillStyle = (me && boostActive) ? '#082f49' : '#031527';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width / 2 - camX, canvas.height / 2 - camY);

        const startX = Math.max(0, Math.floor((camX - canvas.width / 2) / 140) * 140);
        const endX   = Math.min(2800, camX + canvas.width / 2 + 140);
        const startY = Math.max(0, Math.floor((camY - canvas.height / 2) / 140) * 140);
        const endY   = Math.min(2800, camY + canvas.height / 2 + 140);

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = startX; x <= endX; x += 140) { ctx.moveTo(x, startY); ctx.lineTo(x, endY); }
        for (let y = startY; y <= endY; y += 140) { ctx.moveTo(startX, y); ctx.lineTo(endX, y); }
        ctx.stroke();

        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 10; ctx.strokeRect(0, 0, 2800, 2800);

        CLIENT_HAZARDS.forEach(hz => {
          ctx.font = hz.type === 'whirlpool' ? '32px serif' : '34px serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          if (hz.type === 'whirlpool') {
            ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(hz.x, hz.y, hz.r * (0.85 + Math.sin(now * 0.006) * 0.15), 0, Math.PI * 2); ctx.stroke();
            ctx.fillText('🌀', hz.x, hz.y);
          } else {
            ctx.fillText('🪼', hz.x, hz.y + Math.sin(now * 0.005) * 6);
          }
        });

        const halfW = canvas.width / 2 + 50, halfH = canvas.height / 2 + 50;
        for (let i = 0; i < foodList.length; i++) {
          const f = foodList[i];
          if (Math.abs(f.x - camX) > halfW || Math.abs(f.y - camY) > halfH) continue;
          ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
        }

        pearlList.forEach(pr => {
          ctx.fillStyle = 'rgba(250, 204, 21, 0.25)'; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r + 8, 0, Math.PI * 2); ctx.fill();
          ctx.font = '26px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🔮', pr.x, pr.y);
        });

        for (let i = shockwaves.length - 1; i >= 0; i--) {
          const sw = shockwaves[i]; sw.r += 7; sw.alpha -= 0.035;
          if (sw.alpha  a.r - b.r).forEach(s => {
          const isBoostingNow = (s.id === myId) ? boostActive : s.boost;
          if (isBoostingNow && bubbles.length < 40) {
            bubbles.push({ x: s.x + (Math.random() - 0.5) * s.r, y: s.y + (Math.random() - 0.5) * s.r, r: Math.random() * 4 + 2, alpha: 0.85 });
          }
          ctx.fillStyle = s.shield ? 'rgba(56, 189, 248, 0.35)' : (isBoostingNow ? 'rgba(250, 204, 21, 0.25)' : (s.color + '33'));
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r + (s.shield ? 11 : 6), 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = s.shield ? '#7dd3fc' : (isBoostingNow ? '#fde047' : (s.id === myId ? '#facc15' : s.color));
          ctx.lineWidth = s.shield || isBoostingNow ? 4 : 2; ctx.stroke();

          ctx.save(); ctx.translate(s.x, s.y);
          if (s.dirX > 0) ctx.scale(-1, 1);
          ctx.font = Math.round(s.r * 1.45) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(s.icon, 0, 2); ctx.restore();

          ctx.fillStyle = '#ffffff'; ctx.font = 'bold ' + Math.max(11, Math.round(s.r * 0.32)) + 'px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(s.name + ' (' + s.mass + ')' + (s.stun ? ' ⚡STUN' : ''), s.x, s.y - s.r - 9);
        });

        for (let i = bubbles.length - 1; i >= 0; i--) {
          const b = bubbles[i]; b.y -= 1.5; b.alpha -= 0.04;
          if (b.alpha <= 0) { bubbles.splice(i, 1); continue; }
          ctx.strokeStyle = 'rgba(186, 230, 253, ' + b.alpha + ')'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
        }

        ctx.restore();
        drawRadarMinimap(me);
      }
      requestAnimationFrame(renderLoop);
    }
    requestAnimationFrame(renderLoop);
  })();
  </script>
</body>
</html>`;

    const verifiedWaterRoute = (req, res, next) => {
        const cleanUrl = (req.originalUrl || req.url || '').split('?').toLowerCase();
        if (cleanUrl === '/waterio' || cleanUrl === '/waterio/') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(
                WATER_IO_PAGE_HTML + '\n' +
                WATER_IO_VERIFIED_A + '\n' +
                WATER_IO_VERIFIED_B + '\n' +
                WATER_IO_VERIFIED_C
            );
        }
        return next();
    };

    app.use(verifiedWaterRoute);
    const verifiedStack = (app._router && app._router.stack) || (app.router && app.router.stack);
    if (Array.isArray(verifiedStack)) {
        const idx = verifiedStack.findIndex(layer => layer && layer.handle === verifiedWaterRoute);
        if (idx > 0) {
            const [moved] = verifiedStack.splice(idx, 1);
            verifiedStack.unshift(moved);
        }
    }

 return OG_HOSTS;
};
