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
      // 3. Relabel buttons in Phonk DJ Modal & add Bass Boost + Filter Sweep
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

    return OG_HOSTS;
      
};
 
                
