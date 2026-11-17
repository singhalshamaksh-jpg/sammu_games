const fs = require('fs');
const path = require('path');

module.exports = function initServerAds(app, io) {
    const ADS_DB_FILE = path.join(__dirname, 'ads_db.json');

    // Never show network ads in Milly's or Zoro's servers
    const PROTECTED_SERVERS = new Set(['srv_milly', 'srv_zoro']);

    // 1. PASTE YOUR CPM AD SCRIPTS PER SERVER HERE (Shows ONLY before joining the room!)
    const NETWORK_SCRIPTS = {
        srv_samaksh: `<!-- Paste Adsterra 320x50 Banner for Samaksh's Arena -->`,
        srv_moon:    `<!-- Paste Adsterra 320x50 Banner for Moon's Galaxy -->`,
        srv_advait:  `<!-- Paste Adsterra 320x50 Banner for Advait's Citadel -->`,
        srv_diamond: `<!-- Paste Adsterra Social Bar for Diamond Server -->`,
        srv_heer:    `<!-- Paste Monetag In-Page Push for Heer's Haven -->`,
        srv_izzan:   `<!-- Paste Monetag In-Page Push for Izzan's Fortress -->`,
        srv_shubhi:  `<!-- Paste Monetag Vignette for Shubhi's Castle -->`,
        srv_sid:     `<!-- Paste Monetag In-Page Push for Sid's Kingdom -->`,
        srv_ishika:  `<!-- Paste HilltopAds 300x50 Banner for Ishika's Lounge -->`,
        srv_sus:     `<!-- Paste HilltopAds 300x50 Banner for Sus Bunker -->`,
        srv_sarah:   `<!-- Paste HilltopAds 300x50 Banner for Sarah's Sanctuary -->`,
        srv_ruwii:   `<!-- Paste HilltopAds 300x50 Banner for Ruwii's Garden -->`,
        srv_zaira:   `<!-- Paste Direct Sponsor / Ad Script for Zaira's Orbit -->`
    };

    // 2. CUSTOM DIRECT SPONSOR BANNERS (Controlled live via /setad)
    let serverAds = {};
    if (fs.existsSync(ADS_DB_FILE)) {
        try { serverAds = JSON.parse(fs.readFileSync(ADS_DB_FILE, 'utf8')); } catch (e) {}
    }

    function saveAds() {
        try { fs.writeFileSync(ADS_DB_FILE, JSON.stringify(serverAds, null, 2)); } catch (e) {}
    }

    const LOBBY_ONLY_AD_WIDGET = `
    <style>
      #lobbyOnlyAdWrapper {
        display: none; max-width: 360px; margin: 8px auto; text-align: center;
        position: relative; z-index: 48;
      }
      #srvSponsorBanner {
        display: none; padding: 8px 12px; margin-bottom: 6px;
        background: linear-gradient(135deg, #0f172a, #1e1b4b);
        border: 1.5px solid #38bdf8; border-radius: 14px; color: #fff;
      }
      #srvCpmSlot {
        display: none; max-width: 340px; min-height: 50px; margin: 0 auto;
        overflow: hidden; border-radius: 10px;
      }
      #srvSponsorTag { font-size: 10px; font-weight: 900; color: #38bdf8; }
      #srvSponsorTitle { font-size: 13px; font-weight: 900; margin: 2px 0; }
      #srvSponsorDesc { font-size: 11px; color: #cbd5e1; margin-bottom: 5px; }
      #srvSponsorBtn {
        display: inline-block; padding: 4px 12px; border-radius: 18px;
        font-size: 11px; font-weight: 900; text-decoration: none; color: #090d16; background: #38bdf8;
      }
    </style>

    <div id="lobbyOnlyAdWrapper">
      <div id="srvSponsorBanner">
        <div id="srvSponsorTag">📢 SPONSORED</div>
        <div id="srvSponsorTitle"></div>
        <div id="srvSponsorDesc"></div>
        <a id="srvSponsorBtn" href="#" target="_blank" rel="noopener noreferrer">Open</a>
      </div>
      <div id="srvCpmSlot"></div>
    </div>

    <script>
    (function() {
      var hasJoinedArena = false;

      // Place the ad container right where Zoro & Milly's lobby promo banners appear
      function mountInLobby() {
        var wrap = document.getElementById('lobbyOnlyAdWrapper');
        if (!wrap || wrap.dataset.mounted === '1') return;
        var anchor = document.getElementById('zoroPromoBox') || document.getElementById('didiPromoBox');
        if (anchor && anchor.parentNode) {
          anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
          wrap.dataset.mounted = '1';
        }
      }

      // Completely hide & wipe ads once the player joins the arena!
      window.hideLobbyAdsForever = function() {
        hasJoinedArena = true;
        var wrap = document.getElementById('lobbyOnlyAdWrapper');
        var cpm = document.getElementById('srvCpmSlot');
        if (cpm) { cpm.innerHTML = ''; cpm.style.display = 'none'; }
        if (wrap) { wrap.style.setProperty('display', 'none', 'important'); }
      };

      function showLobbyAd(data) {
        if (hasJoinedArena) return;
        mountInLobby();

        var wrap = document.getElementById('lobbyOnlyAdWrapper');
        var box = document.getElementById('srvSponsorBanner');
        var slot = document.getElementById('srvCpmSlot');
        if (!wrap || !box || !slot) return;

        var hasCustom = data.ad && data.ad.active;
        var hasCpm = data.cpmHtml && data.cpmHtml.indexOf('<!--') !== 0 && data.cpmHtml.trim().length > 0;

        if (!hasCustom && !hasCpm) {
          wrap.style.display = 'none';
          return;
        }

        wrap.style.display = 'block';

        if (hasCustom) {
          document.getElementById('srvSponsorTitle').textContent = data.ad.title || '';
          document.getElementById('srvSponsorDesc').textContent = data.ad.desc || '';
          var btn = document.getElementById('srvSponsorBtn');
          btn.textContent = data.ad.btnText || '🔥 Visit';
          btn.href = data.ad.url || '#';
          box.style.display = 'block';
        } else {
          box.style.display = 'none';
        }

        slot.innerHTML = '';
        if (hasCpm) {
          slot.style.display = 'block';
          var temp = document.createElement('div');
          temp.innerHTML = data.cpmHtml;
          Array.from(temp.childNodes).forEach(function(node) {
            if (node.tagName === 'SCRIPT') {
              var s = document.createElement('script');
              if (node.src) s.src = node.src;
              else s.textContent = node.textContent;
              s.async = true;
              slot.appendChild(s);
            } else {
              slot.appendChild(node.cloneNode(true));
            }
          });
        } else {
          slot.style.display = 'none';
        }
      }

      setInterval(function() {
        if (typeof socket === 'undefined' || window._lobbyAdsBound) return;
        window._lobbyAdsBound = true;

        // 1. Intercept joinRoom emit so ads vanish the instant user clicks Join!
        var origEmit = socket.emit.bind(socket);
        socket.emit = function(ev, payload) {
          if (ev === 'joinRoom') {
            window.hideLobbyAdsForever();
          }
          return origEmit.apply(this, arguments);
        };

        // 2. Fetch lobby ad right when server is selected (before joining arena)
        socket.on('serverAccessGranted', function(srv) {
          hasJoinedArena = false;
          if (srv && srv.id) socket.emit('requestServerAd', srv.id);
        });

        // 3. Also hide on initRole / updatePlayers just in case
        socket.on('initRole', window.hideLobbyAdsForever);

        socket.on('updateServerAd', function(data) {
          if (!hasJoinedArena && data && data.serverId === window.selectedServerId) {
            showLobbyAd(data);
          }
        });
      }, 800);
    })();
    </script>
    `;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>')) {
                body = body.replace('</body>', LOBBY_ONLY_AD_WIDGET + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });

    io.on('connection', (socket) => {
        socket.on('requestServerAd', (serverId) => {
            if (!serverId) return;
            const cpmHtml = PROTECTED_SERVERS.has(serverId) ? '' : (NETWORK_SCRIPTS[serverId] || '');
            socket.emit('updateServerAd', {
                serverId,
                ad: serverAds[serverId] || null,
                cpmHtml
            });
        });

        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload !== null) ? payload.text : payload;
            if (!raw || typeof raw !== 'string') return;
            const sender = (socket.username || (payload && payload.username) || '').trim().toLowerCase();
            if (sender !== 'samaksh' && sender !== 'sammu') return;

            const clean = raw.trim();
            if (clean.toLowerCase().startsWith('/setad ')) {
                const [targetSrv, title, desc, btnText, url] = clean.slice(7).split('|').map(s => s.trim());
                if (!targetSrv || !title || !url || PROTECTED_SERVERS.has(targetSrv)) return;
                serverAds[targetSrv] = {
                    active: true, title, desc: desc || '', btnText: btnText || '🚀 Open',
                    url: url.startsWith('http') ? url : 'https://' + url
                };
                saveAds();
                socket.emit('message', { username: 'SYSTEM', text: `✅ Lobby-Only Ad saved for **${targetSrv}**!`, _serverId: socket.activeServerId });
            }
        });
    });
};
