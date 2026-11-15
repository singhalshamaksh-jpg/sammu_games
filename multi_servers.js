const fs = require('fs');
const path = require('path');

module.exports = function initMultiServers(app, io) {
    // 🔒 AUTOMATIC ROOM ISOLATOR: Keeps chat, player lists & mini-games 100% separate per server!
    let currentEventRoom = null;
    const globalEvents = new Set(['serverListUpdate', 'toggleDidiPromo']);
    const origIoEmit = io.emit.bind(io);

    io.emit = function (ev, ...args) {
        if (globalEvents.has(ev)) {
            return origIoEmit(ev, ...args);
        }
        if (currentEventRoom) {
            return io.to(currentEventRoom).emit(ev, ...args);
        }
        return origIoEmit(ev, ...args);
    };

    io.on('connection', (socket) => {
        socket.use((packet, next) => {
            currentEventRoom = socket.activeServerId || 'srv_samaksh';
            next();
        });

        const origSocketEmit = socket.emit.bind(socket);
        socket.emit = function (ev, ...args) {
            const prevRoom = currentEventRoom;
            const res = origSocketEmit(ev, ...args);
            currentEventRoom = prevRoom;
            return res;
        };
    });
    const DB_FILE = path.join(__dirname, 'servers_db.json');
    const OG_CLAIM_SECRET = "#bhaibahencharaontop";

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
        srv_saeron:  { id: 'srv_saeron',  name: "🪐 Saeron's Orbit",    owner: "saeron",  theme: "cyber",   max: 20, type: "official" },
        srv_shubhi:  { id: 'srv_shubhi',  name: "💖 Shubhi's Castle",   owner: "shubhi",  theme: "crimson", max: 20, type: "official" },
        srv_sid:     { id: 'srv_sid',     name: "🦁 Sid's Kingdom",     owner: "sid",     theme: "gold",    max: 20, type: "official" },
        srv_diamond: { 
            id: 'srv_diamond', 
            name: "💠 DIAMOND SERVER (OG Hosts Only)", 
            owner: "sammu", 
            theme: "diamond", 
            max: 20, 
            type: "secret"
        }
    };

    let serversDB = { ...defaultServers };
    let verifiedHostDevices = {};
    let superAdminDevices = new Set();

    if (fs.existsSync(DB_FILE)) {
        try {
            const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            const savedServers = raw.servers || raw;
            delete savedServers.srv_bonus;
            serversDB = { ...defaultServers, ...savedServers };
            if (raw.verifiedHostDevices) verifiedHostDevices = raw.verifiedHostDevices;
            if (Array.isArray(raw.superAdminDevices)) superAdminDevices = new Set(raw.superAdminDevices);
        } catch (e) {}
    }

    function saveDB() {
        try {
            fs.writeFileSync(DB_FILE, JSON.stringify({
                servers: serversDB,
                verifiedHostDevices,
                superAdminDevices: Array.from(superAdminDevices)
            }, null, 2));
        } catch (e) {}
    }
    saveDB();
    const activeCounts = {};
    const OG_HOSTS = new Set([
        "sammu", "samaksh", "zoro", "milly", "moon", "heer", "izzan", "ishika", "sus",
        "sarah", "advait", "ruwii", "saeron", "shubhi", "sid"
    ]);

    function isVerifiedOG(username, deviceId) {
        if (!username || !deviceId) return false;
        const clean = username.trim().toLowerCase();
        if (!OG_HOSTS.has(clean)) return false;
        const list = verifiedHostDevices[clean] || [];
        return list.includes(deviceId);
    }

    function isAnyVerifiedOGDevice(deviceId) {
        if (!deviceId) return false;
        return Object.values(verifiedHostDevices).some(list => Array.isArray(list) && list.includes(deviceId));
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
                id: s.id, name: s.name, owner: s.owner, ownerDevice: s.ownerDevice || null,
                theme: s.theme, max: s.max || 20, count: activeCounts[s.id] || 0, type: s.type,
                locked: Boolean(s.password) || s.type === 'secret', expired, permanent: Boolean(s.permanent),
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
          <button class="srv-tab" id="tabCustom" onclick="switchSrvTab('custom')">✨ Private / Custom Servers</button>
        </div>
        <div id="srvListContainer"></div>
        <div id="createSrvSection" style="display:none;margin-top:10px;border-top:1px solid rgba(255,255,255,0.15);padding-top:10px;">
          <div style="font-weight:bold;font-size:13px;color:#fde047;margin-bottom:6px;">🎁 Create Private Server (7-Day FREE Trial!)</div>
          <input id="newSrvName" class="srv-input" placeholder="Private Server Name (e.g. Aarav's Squad)" maxlength="24">
          <input id="newSrvOwner" class="srv-input" placeholder="Your Exact Username (Gets Host Commands)" maxlength="20">
          <input id="newSrvPass" class="srv-input" placeholder="Set Room Password (Leave empty for Open)" maxlength="20">
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
            💎 <b>Permanent VIP Server:</b> Email any Gift Card Code (Google Play, Amazon, Flipkart) to <b style="color:#38bdf8;">singhalshamaksh@gmail.com</b>
          </div>
        </div>
      </div>
    </div>
    <div id="activeSrvTopBar" style="display:none;position:fixed;top:6px;left:50%;transform:translateX(-50%);z-index:99990;background:rgba(15,23,42,0.88);border:1.5px solid #38bdf8;color:#fff;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:900;box-shadow:0 4px 15px rgba(0,0,0,0.5);backdrop-filter:blur(6px);pointer-events:none;">
      🌐 <span id="activeSrvTopName">Sammu Games</span>
    </div>
    <script>
    (function() {
      let currentTab = 'official';
      window.selectedServerId = 'srv_samaksh';
      let allServers = ${JSON.stringify(getPublicServerList())};

      const urlParams = new URLSearchParams(window.location.search);
      const refOwner = urlParams.get('ref');
      if (refOwner) localStorage.setItem('sammu_pending_ref', refOwner.trim().toLowerCase());

      let devId = localStorage.getItem('sammu_dev_uid');
      if (!devId) {
        devId = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('sammu_dev_uid', devId);
      }

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
        alert('🔗 Referral Link Copied!\\n' + link + '\\n\\nInvite 15 new players using this link for +7 DAYS FREE, or email any Gift Card Code to singhalshamaksh@gmail.com for a PERMANENT server!');
      };

      window.deleteMyPrivateServer = function(serverId, serverName) {
        if (!confirm('🗑️ Are you sure you want to permanently DELETE "' + serverName + '"?')) return;
        if (typeof socket !== 'undefined') {
          socket.emit('deleteOwnCustomServer', { serverId: serverId, deviceId: devId });
        }
      };

      function renderServerList() {
        const box = document.getElementById('srvListContainer');
        if (!box) return;
        box.innerHTML = '';
        const filtered = allServers.filter(s => currentTab === 'official' ? (s.type === 'official' || s.type === 'secret') : s.type === 'custom');
        if (filtered.length === 0) {
          box.innerHTML = '<div style="text-align:center;color:#94a3b8;font-size:12px;padding:14px;">No private servers yet! Create your 7-day free trial below 👇</div>';
          return;
        }
        filtered.forEach(s => {
          const isFull = s.count >= s.max;
          const div = document.createElement('div');
          div.className = 'srv-card ' + (s.theme || '') + (isFull ? ' full' : '');
          let badge = (s.locked ? '🔐 ' : '') + s.count + '/' + s.max + ' 👥';
          let subLine = 'Host: ' + s.owner.toUpperCase();

          if (s.type === 'secret') badge = '🔐 OG DEVICE | ' + s.count + '/' + s.max + ' 👥';
          else if (s.expired) {
            badge = '🔒 EXPIRED (' + (s.refCount || 0) + '/15 Refs)';
            subLine = 'Bring ' + (15 - (s.refCount || 0)) + ' more refs or email singhalshamaksh@gmail.com';
          } else if (s.type === 'custom' && !s.permanent) {
            badge = (s.locked ? '🔐 ' : '') + '⏳ ' + (s.daysLeft || 7) + 'd | ' + s.count + '/' + s.max + ' 👥';
            subLine = 'Host: ' + s.owner.toUpperCase() + ' | Refs: ' + (s.refCount || 0) + '/15';
          } else if (s.permanent) {
            badge = (s.locked ? '🔐 ' : '') + '⭐ VIP | ' + s.count + '/' + s.max + ' 👥';
          }

          div.innerHTML = '<div><div style="font-weight:bold;font-size:13px;">' + s.name + '</div><div style="font-size:11px;color:#94a3b8;">' + subLine + '</div></div><div class="srv-pill">' + badge + '</div>';
          div.onclick = () => selectAndEnterServer(s);
          box.appendChild(div);

          if (s.type === 'custom') {
            const actionRow = document.createElement('div');
            actionRow.style.cssText = 'display:flex;justify-content:flex-end;gap:6px;margin:-4px 0 8px 0;';
            if (!s.permanent) {
              actionRow.innerHTML += '<button onclick="event.stopPropagation();copyMyRefLink(\\'' + s.owner + '\\')" style="background:#059669;border:none;color:#fff;font-size:11px;font-weight:bold;padding:3px 10px;border-radius:8px;cursor:pointer;">🔗 Copy Link (' + (s.refCount || 0) + '/15)</button>';
            }
            if (s.ownerDevice && s.ownerDevice === devId) {
              actionRow.innerHTML += '<button onclick="event.stopPropagation();deleteMyPrivateServer(\\'' + s.id + '\\', \\'' + s.name.replace(/'/g, '') + '\\')" style="background:#dc2626;border:none;color:#fff;font-size:11px;font-weight:bold;padding:3px 10px;border-radius:8px;cursor:pointer;">🗑️ Delete</button>';
            }
            if (actionRow.innerHTML) box.appendChild(actionRow);
          }
        });
      }

      function selectAndEnterServer(srv) {
        if (srv.expired) {
          const link = window.location.origin + '/?ref=' + encodeURIComponent(srv.owner);
          alert('🔒 Your 7-Day Free Trial has ended!\\n\\nOption 1 (FREE): Share your link with ' + (15 - (srv.refCount || 0)) + ' more friends to unlock +7 DAYS:\\n' + link + '\\n\\nOption 2 (PERMANENT): Email any Gift Card Code (with your Server Name) to singhalshamaksh@gmail.com!');
          return;
        }
        let pass = '';
        if (srv.locked && srv.type !== 'secret' && !(srv.ownerDevice && srv.ownerDevice === devId)) {
          pass = prompt('🔐 Enter Password for ' + srv.name + ':');
          if (!pass) return;
        }
        if (typeof socket !== 'undefined') {
          socket.emit('verifyServerAccess', { serverId: srv.id, password: pass, deviceId: devId });
        } else {
          window.selectedServerId = srv.id;
          document.getElementById('srvBrowserOverlay').style.display = 'none';
          document.getElementById('activeSrvTopName').textContent = srv.name;
          document.getElementById('activeSrvTopBar').style.display = 'block';
        }
      }

      window.createTrialServer = function() {
        const name = document.getElementById('newSrvName').value.trim();
        const owner = document.getElementById('newSrvOwner').value.trim();
        const password = document.getElementById('newSrvPass').value.trim();
        const theme = document.getElementById('newSrvTheme').value;
        if (!name || !owner) { alert('Please enter both Server Name and your Username!'); return; }
        if (typeof socket !== 'undefined') socket.emit('createCustomServer', { name, owner, password, theme, deviceId: devId });
      };

      renderServerList();
      const socketWatcher = setInterval(() => {
        if (typeof socket !== 'undefined' && !window._srvHooked) {
          window._srvHooked = true;
          clearInterval(socketWatcher);
          socket.emit('requestServerList');
          socket.emit('registerClientDevice', devId);

          const pendingRef = localStorage.getItem('sammu_pending_ref');
          if (pendingRef) {
            socket.emit('registerReferral', { refOwner: pendingRef, deviceId: devId });
            localStorage.removeItem('sammu_pending_ref');
          }

          socket.on('serverListUpdate', (list) => { allServers = list; renderServerList(); });
          socket.on('serverAccessGranted', (srv) => {
            window.selectedServerId = srv.id;
            document.getElementById('srvBrowserOverlay').style.display = 'none';
            document.getElementById('activeSrvTopName').textContent = srv.name;
            document.getElementById('activeSrvTopBar').style.display = 'block';
          });
          socket.on('serverAccessDenied', (msg) => alert(msg));
        }
      }, 300);
    })();
    </script>
    `;
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

    function broadcastRoomPlayers(roomId) {
        if (!roomId) return;
        const roomSockets = io.sockets.adapter.rooms.get(roomId) || new Set();
        const roomPlayers = [];
        roomSockets.forEach(sid => {
            const s = io.sockets.sockets.get(sid);
            if (s && s.username) {
                roomPlayers.push({ id: s.id, username: s.username, avatar: s.avatar || '🥷', isHost: Boolean(s.isRoomHost) });
            }
        });
        io.to(roomId).emit('updatePlayers', roomPlayers);
    }

    io.on('connection', (socket) => {
        socket.on('registerClientDevice', (devId) => {
            if (devId) socket.clientDeviceId = String(devId);
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
                    text: `🎉🔥 **15 REFERRALS REACHED!** **${srv.name}** has been automatically extended for **+7 MORE DAYS**! 🚀`
                });
            }
            saveDB();
            origIoEmit('serverListUpdate', getPublicServerList());
        });

        socket.on('verifyServerAccess', ({ serverId, password, deviceId }) => {
            if (deviceId) socket.clientDeviceId = String(deviceId);
            const srv = serversDB[serverId];
            if (!srv) return socket.emit('serverAccessDenied', 'Server not found!');
            if ((activeCounts[serverId] || 0) >= (srv.max || 20)) {
                return socket.emit('serverAccessDenied', 'Server is full (20/20)! Pick another server.');
            }

            if (srv.type === 'secret') {
                if (!isAnyVerifiedOGDevice(socket.clientDeviceId)) {
                    return socket.emit('serverAccessDenied', '💠 Diamond Server is locked to Verified OG Host devices only! Claim your phone in any Official Server first using /claimhost.');
                }
            } else {
                const isCreatorDevice = (srv.ownerDevice && socket.clientDeviceId === srv.ownerDevice);
                if (srv.password && !isCreatorDevice && password !== srv.password) {
                    return socket.emit('serverAccessDenied', '❌ Wrong Password for ' + srv.name + '!');
                }
            }

            if (srv.type === 'custom' && !srv.permanent && Date.now() > srv.expiresAt) {
                const refCount = Array.isArray(srv.referrals) ? srv.referrals.length : 0;
                return socket.emit('serverAccessDenied', `🔒 Trial Expired! (${refCount}/15 referrals). Invite ${15 - refCount} more friends via ?ref=${srv.owner} or email singhalshamaksh@gmail.com!`);
            }

            if (socket.activeServerId && activeCounts[socket.activeServerId]) {
                socket.leave(socket.activeServerId);
                activeCounts[socket.activeServerId] = Math.max(0, activeCounts[socket.activeServerId] - 1);
                broadcastRoomPlayers(socket.activeServerId);
            }
            socket.activeServerId = serverId;
            socket.join(serverId);
            activeCounts[serverId] = (activeCounts[serverId] || 0) + 1;
            origIoEmit('serverListUpdate', getPublicServerList());
            socket.emit('serverAccessGranted', srv);
            broadcastRoomPlayers(serverId);
        });

        socket.on('createCustomServer', ({ name, owner, password, theme, deviceId }) => {
            if (deviceId) socket.clientDeviceId = String(deviceId);
            const cleanId = 'custom_' + Date.now();
            const cleanOwner = owner.trim().toLowerCase();
            serversDB[cleanId] = {
                id: cleanId, name: '✨ ' + name.trim(), owner: cleanOwner,
                ownerDevice: socket.clientDeviceId || null,
                password: password ? password.trim() : '',
                theme: theme || 'cyber', max: 20, type: 'custom',
                createdAt: Date.now(), expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000),
                permanent: false, referrals: [], allTimeDevices: []
            };
            saveDB();
            origIoEmit('serverListUpdate', getPublicServerList());
            socket.emit('serverAccessDenied', '✅ Private Server "' + name + '" created! ' + (password ? '(Password Protected 🔐)\n' : '') + 'Share /?ref=' + cleanOwner + ' with 15 friends for +7 days, or email a gift card code to singhalshamaksh@gmail.com for permanent access!');
        });

        socket.on('deleteOwnCustomServer', ({ serverId, deviceId }) => {
            const srv = serversDB[serverId];
            if (!srv || srv.type !== 'custom') return;
            if ((srv.ownerDevice && srv.ownerDevice === deviceId) || superAdminDevices.has(deviceId)) {
                delete serversDB[serverId];
                saveDB();
                origIoEmit('serverListUpdate', getPublicServerList());
                socket.emit('serverAccessDenied', '🗑️ Private Server "' + srv.name + '" has been deleted!');
            } else {
                socket.emit('serverAccessDenied', '❌ Only the device that created this server can delete it!');
            }
        });
        socket.on('joinRoom', (data) => {
            if (data && data.deviceId) socket.clientDeviceId = String(data.deviceId);
            if (!socket.activeServerId) {
                socket.activeServerId = 'srv_samaksh';
                socket.join('srv_samaksh');
                activeCounts['srv_samaksh'] = (activeCounts['srv_samaksh'] || 0) + 1;
                origIoEmit('serverListUpdate', getPublicServerList());
            }
            const srv = serversDB[socket.activeServerId];
            const uname = (data && data.username) ? data.username.trim().toLowerCase() : '';
            const dev = socket.clientDeviceId;

            if (srv && uname) {
                const isCustomOwner = (srv.type === 'custom' && uname === srv.owner.toLowerCase() && (!srv.ownerDevice || srv.ownerDevice === dev));
                const isVerifiedOfficialOwner = (srv.type === 'official' && uname === srv.owner.toLowerCase() && isVerifiedOG(uname, dev));
                const isVerifiedDiamondOG = (srv.id === 'srv_diamond' && isVerifiedOG(uname, dev));

                if (isCustomOwner || isVerifiedOfficialOwner || isVerifiedDiamondOG) {
                    socket.isRoomHost = true;
                    setTimeout(() => {
                        socket.emit('initRole', { isHost: true });
                        socket.emit('message', {
                            username: "Sammu's Bot",
                            text: `👑 Device Verified! Welcome to **${srv.name}**, **${data.username}**! Your Host Admin Panel is unlocked!`
                        });
                    }, 500);
                } else if (OG_HOSTS.has(uname) && !isVerifiedOG(uname, dev)) {
                    setTimeout(() => {
                        socket.emit('message', {
                            username: "Sammu's Bot",
                            text: `🔐 **${data.username}**, if this is your real phone, type \`/claimhost #bhaibahencharaontop\` once to lock your Host powers to this device!`
                        });
                    }, 600);
                }
            }
            setTimeout(() => broadcastRoomPlayers(socket.activeServerId), 300);
        });

        socket.on('chatMessage', (payload) => {
            const text = (typeof payload === 'object' && payload !== null) ? payload.text : payload;
            if (!text || typeof text !== 'string') return;
            const clean = text.trim();
            const sender = (socket.username || (payload && payload.username) || '').toLowerCase();
            const dev = socket.clientDeviceId;

            // 1. Strict 1-Phone Device Claim (#bhaibahencharaontop is ONLY used here!)
            if (clean === '/claimhost ' + OG_CLAIM_SECRET) {
                if (!OG_HOSTS.has(sender) || !dev) {
                    socket.emit('message', { username: 'SYSTEM', text: `❌ Your username **${sender}** is not on the OG Host list!` });
                    return;
                }
                if (!Array.isArray(verifiedHostDevices[sender])) verifiedHostDevices[sender] = [];

                // Block if ANOTHER phone has already claimed this username!
                if (verifiedHostDevices[sender].length >= 1 && !verifiedHostDevices[sender].includes(dev)) {
                    socket.emit('message', { username: 'SYSTEM', text: `🚫 **ACCESS DENIED!** **${sender}** is already locked to another phone!` });
                    return;
                }

                if (!verifiedHostDevices[sender].includes(dev)) verifiedHostDevices[sender].push(dev);
                if (sender === 'sammu' || sender === 'samaksh') superAdminDevices.add(dev);
                saveDB();

                socket.isRoomHost = true;
                socket.emit('initRole', { isHost: true });
                socket.emit('message', {
                    username: "Sammu's Bot",
                    text: `✅ **DEVICE LOCKED!** **${sender}** is now permanently bound to THIS phone only! 👑`
                });
                return;
            }

            // 2. Super-Admin Commands (Locked strictly to Sammu/Samaksh's verified phone!)
            if (!superAdminDevices.has(dev)) return;

            if (clean.toLowerCase().startsWith('/resetdevice ')) {
                const targetUser = clean.slice(13).trim().toLowerCase();
                if (verifiedHostDevices[targetUser]) {
                    delete verifiedHostDevices[targetUser];
                    saveDB();
                    socket.emit('message', { username: 'SYSTEM', text: `🔄 Device lock reset for **${targetUser}**! They can now claim a new phone.` });
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
                    socket.emit('message', { username: 'SYSTEM', text: `✅ Renamed **${targetId}** to **${newName}**!` });
                } else {
                    const ids = Object.keys(serversDB).join(', ');
                    socket.emit('message', { username: 'SYSTEM', text: `⚠️ Usage: \`/renameserver <id> <New Name>\`\nValid IDs: ${ids}` });
                }
            }

            if (clean.toLowerCase().startsWith('/permserver ')) {
                const ownerTarget = clean.slice(12).trim().toLowerCase();
                const found = Object.values(serversDB).find(s => s.owner.toLowerCase() === ownerTarget && s.type === 'custom');
                if (found) {
                    found.permanent = true;
                    saveDB();
                    origIoEmit('serverListUpdate', getPublicServerList());
                    socket.emit('message', { username: "Sammu's Bot", text: `💎 **VIP UNLOCKED!** **${found.name}** is now a **PERMANENT SERVER**! 🎉` });
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
                    socket.emit('message', { username: "Sammu's Bot", text: `⏳ **EXTENDED!** **${found.name}** unlocked for **+${days} days**! 🔥` });
                }
            }

            if (clean.toLowerCase().startsWith('/deleteserver ')) {
                const ownerTarget = clean.slice(14).trim().toLowerCase();
                const foundEntry = Object.entries(serversDB).find(([id, s]) => s.owner.toLowerCase() === ownerTarget && s.type === 'custom');
                if (foundEntry) {
                    const [srvId, srvObj] = foundEntry;
                    delete serversDB[srvId];
                    saveDB();
                    origIoEmit('serverListUpdate', getPublicServerList());
                    socket.emit('message', { username: 'SYSTEM', text: `🗑️ Deleted custom server **${srvObj.name}** (Owner: **${ownerTarget}**)!` });
                }
            }
        });

        socket.on('disconnect', () => {
            if (socket.activeServerId && activeCounts[socket.activeServerId]) {
                const prevId = socket.activeServerId;
                activeCounts[prevId] = Math.max(0, activeCounts[prevId] - 1);
                origIoEmit('serverListUpdate', getPublicServerList());
                setTimeout(() => broadcastRoomPlayers(prevId), 200);
            }
        });
    });
};
