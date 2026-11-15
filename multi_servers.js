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
        srv_saeron:  { id: 'srv_saeron',  name: "🪐 Saeron's Orbit",    owner: "saeron",  theme: "cyber",   max: 20, type: "official" },
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
    if (fs.existsSync(DB_FILE)) {
        try {
            const saved = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            Object.keys(defaultServers).forEach(k => {
                if (saved[k] && saved[k].name) serversDB[k].name = saved[k].name;
            });
        } catch (e) {}
    }

    function saveDB() {
        try { fs.writeFileSync(DB_FILE, JSON.stringify(serversDB, null, 2)); } catch (e) {}
    }
    saveDB();
    const activeCounts = {};
    const OG_HOSTS = new Set([
        "sammu", "samaksh", "zoro", "milly", "moon", "heer", "izzan", "ishika", "sus",
        "sarah", "advait", "ruwii", "saeron", "shubhi", "sid"
    ]);

    function getPublicServerList() {
        return Object.values(serversDB).map(s => ({
            id: s.id,
            name: s.name,
            owner: s.owner,
            theme: s.theme,
            max: s.max || 20,
            count: activeCounts[s.id] || 0,
            type: s.type,
            locked: s.type === 'secret'
        }));
    }

    const MULTI_SERVER_UI = `
    <style>
      #srvBrowserOverlay { position:fixed; inset:0; background:rgba(7,11,25,0.96); z-index:999999; display:flex; align-items:center; justify-content:center; padding:12px; font-family:inherit; backdrop-filter:blur(12px); }
      #srvBrowserBox { background:linear-gradient(160deg,#0f172a,#1e1b4b); border:2px solid #38bdf8; border-radius:22px; padding:16px; width:100%; max-width:440px; max-height:90vh; overflow-y:auto; color:#fff; box-shadow:0 0 40px rgba(56,189,248,0.4); }
      .srv-card { background:rgba(255,255,255,0.07); border:1.5px solid rgba(56,189,248,0.4); border-radius:14px; padding:10px 12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition:0.2s; }
      .srv-card:hover { background:rgba(56,189,248,0.2); transform:translateY(-1px); }
      .srv-card.diamond { border-color:#67e8f9; background:linear-gradient(90deg,rgba(6,182,212,0.25),rgba(168,85,247,0.25)); box-shadow:0 0 15px rgba(103,232,249,0.3); }
      .srv-card.gold { border-color:#facc15; }
      .srv-card.full { opacity:0.55; pointer-events:none; }
      .srv-pill { font-size:11px; font-weight:bold; padding:4px 9px; border-radius:12px; background:#0284c7; color:#fff; }
    </style>
    <div id="srvBrowserOverlay">
      <div id="srvBrowserBox">
        <div style="text-align:center;margin-bottom:12px;">
          <div style="font-size:19px;font-weight:900;color:#38bdf8;">🌐 SAMMU GAMES OFFICIAL SERVERS</div>
          <div style="font-size:12px;color:#cbd5e1;">Select an Official Server (Max 20 Players Each)</div>
        </div>
        <div id="srvListContainer"></div>
      </div>
    </div>
    <div id="activeSrvTopBar" style="display:none;position:fixed;top:6px;left:50%;transform:translateX(-50%);z-index:99990;background:rgba(15,23,42,0.88);border:1.5px solid #38bdf8;color:#fff;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:900;box-shadow:0 4px 15px rgba(0,0,0,0.5);backdrop-filter:blur(6px);pointer-events:none;">
      🌐 <span id="activeSrvTopName">Sammu Games</span>
    </div>
    <script>
    (function() {
      window.selectedServerId = 'srv_samaksh';
      let allServers = ${JSON.stringify(getPublicServerList())};

      function renderServerList() {
        const box = document.getElementById('srvListContainer');
        if (!box) return;
        box.innerHTML = '';
        allServers.forEach(s => {
          const isFull = s.count >= s.max;
          const div = document.createElement('div');
          div.className = 'srv-card ' + (s.theme || '') + (isFull ? ' full' : '');
          const badge = (s.locked ? '🔐 OG PASS | ' : '') + s.count + '/' + s.max + ' 👥';
          div.innerHTML = '<div><div style="font-weight:bold;font-size:13px;">' + s.name + '</div><div style="font-size:11px;color:#94a3b8;">Host: ' + s.owner.toUpperCase() + '</div></div><div class="srv-pill">' + badge + '</div>';
          div.onclick = () => selectAndEnterServer(s);
          box.appendChild(div);
        });
      }

      function selectAndEnterServer(srv) {
        let pass = '';
        if (srv.locked) {
          pass = prompt('💠 DIAMOND SERVER (OG Hosts Sanctuary)\\nEnter Secret Password:');
          if (!pass) return;
        }
        if (typeof socket !== 'undefined') {
          socket.emit('verifyServerAccess', { serverId: srv.id, password: pass });
        } else {
          window.selectedServerId = srv.id;
          document.getElementById('srvBrowserOverlay').style.display = 'none';
          document.getElementById('activeSrvTopName').textContent = srv.name;
          document.getElementById('activeSrvTopBar').style.display = 'block';
        }
      }

      renderServerList();
      const socketWatcher = setInterval(() => {
        if (typeof socket !== 'undefined' && !window._srvHooked) {
          window._srvHooked = true;
          clearInterval(socketWatcher);
          socket.emit('requestServerList');
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

    io.on('connection', (socket) => {
        socket.on('requestServerList', () => {
            socket.emit('serverListUpdate', getPublicServerList());
        });

        socket.on('verifyServerAccess', ({ serverId, password }) => {
            const srv = serversDB[serverId];
            if (!srv) return socket.emit('serverAccessDenied', 'Server not found!');
            if ((activeCounts[serverId] || 0) >= (srv.max || 20)) {
                return socket.emit('serverAccessDenied', 'Server is full (20/20)! Pick another server.');
            }
            if (srv.type === 'secret' && password !== srv.password) {
                return socket.emit('serverAccessDenied', '❌ Wrong Password for Diamond Server!');
            }

            if (socket.activeServerId && activeCounts[socket.activeServerId]) {
                activeCounts[socket.activeServerId] = Math.max(0, activeCounts[socket.activeServerId] - 1);
            }
            socket.activeServerId = serverId;
            socket.join(serverId);
            activeCounts[serverId] = (activeCounts[serverId] || 0) + 1;
            io.emit('serverListUpdate', getPublicServerList());
            socket.emit('serverAccessGranted', srv);
        });

        socket.on('joinRoom', (data) => {
            const srv = serversDB[socket.activeServerId];
            const uname = (data && data.username) ? data.username.trim().toLowerCase() : '';
            if (srv && uname) {
                const isOwner = (srv.owner && uname === srv.owner.toLowerCase());
                const isDiamondOG = (srv.id === 'srv_diamond' && OG_HOSTS.has(uname));
                if (isOwner || isDiamondOG) {
                    setTimeout(() => {
                        socket.emit('initRole', { isHost: true });
                        socket.emit('message', {
                            username: "Sammu's Bot",
                            text: `👑 Welcome to **${srv.name}**, **${data.username}**! Your Host Admin Panel is unlocked!`
                        });
                    }, 500);
                }
            }
        });

        socket.on('chatMessage', (payload) => {
            const text = (typeof payload === 'object' && payload !== null) ? payload.text : payload;
            if (!text || typeof text !== 'string') return;
            const clean = text.trim();
            const sender = (socket.username || (payload && payload.username) || '').toLowerCase();
            if (!OG_HOSTS.has(sender)) return;

            if (clean.toLowerCase().startsWith('/renameserver ')) {
                const parts = clean.slice(14).trim().split(/\s+/);
                const targetId = parts.shift();
                const newName = parts.join(' ');
                if (serversDB[targetId] && newName) {
                    serversDB[targetId].name = newName;
                    saveDB();
                    io.emit('serverListUpdate', getPublicServerList());
                    socket.emit('message', { username: 'SYSTEM', text: `✅ Renamed **${targetId}** to **${newName}**!` });
                } else {
                    const ids = Object.keys(serversDB).join(', ');
                    socket.emit('message', { username: 'SYSTEM', text: `⚠️ Usage: \`/renameserver <id> <New Name>\`\nValid IDs: ${ids}` });
                }
            }
        });

        socket.on('disconnect', () => {
            if (socket.activeServerId && activeCounts[socket.activeServerId]) {
                activeCounts[socket.activeServerId] = Math.max(0, activeCounts[socket.activeServerId] - 1);
                io.emit('serverListUpdate', getPublicServerList());
            }
        });
    });
};
