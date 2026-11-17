const fs = require('fs');
const path = require('path');

module.exports = function initServerAds(app, io) {
    const ADS_DB_FILE = path.join(__dirname, 'ads_db.json');

    // Keep Milly's & Zoro's servers strictly for their own main promos
    const PROTECTED_SERVERS = new Set(['srv_milly', 'srv_zoro']);

    // Default YouTube Cross-Promo banner for open servers
    const DEFAULT_COLLAB_OFFER = {
        active: true,
        tag: "🤝 YOUTUBE CROSS-PROMO SLOT",
        title: "Want Your YouTube Promoted Here?",
        desc: "Give a shoutout to Milly Didi or Yori Akiyama & get a FREE 7-day banner! Email: singhalshamaksh@gmail.com",
        btnText: "📩 Apply for Collab",
        url: "mailto:singhalshamaksh@gmail.com",
        color: "#facc15"
    };

    let serverAds = {};
    if (fs.existsSync(ADS_DB_FILE)) {
        try { serverAds = JSON.parse(fs.readFileSync(ADS_DB_FILE, 'utf8')); } catch (e) {}
    }

    function saveAds() {
        try { fs.writeFileSync(ADS_DB_FILE, JSON.stringify(serverAds, null, 2)); } catch (e) {}
    }

    const ENTRY_AD_SLOT_WIDGET = `
    <style>
      #lobbyCrossPromoBox {
        display: none; max-width: 340px; margin: 8px auto; padding: 10px 12px;
        background: linear-gradient(135deg, #0f172a, #1e1b4b);
        border: 1.5px solid #facc15; border-radius: 14px; color: #fff;
        text-align: center; box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      }
      #cpTag { font-size: 10px; font-weight: 900; letter-spacing: 0.5px; color: #facc15; }
      #cpTitle { font-size: 13px; font-weight: 900; margin: 2px 0; }
      #cpDesc { font-size: 11px; color: #cbd5e1; margin-bottom: 6px; line-height: 1.35; }
      #cpBtn {
        display: inline-block; padding: 5px 14px; border-radius: 18px;
        font-size: 11px; font-weight: 900; text-decoration: none; color: #090d16; background: #facc15;
      }
    </style>

    <div id="lobbyCrossPromoBox">
      <div id="cpTag">🤝 CROSS-PROMO</div>
      <div id="cpTitle"></div>
      <div id="cpDesc"></div>
      <a id="cpBtn" href="#" target="_blank" rel="noopener noreferrer">Open Link</a>
    </div>

    <script>
    (function() {
      var joinedArena = false;

      // Finds the existing ADVERTISEMENT slot right below ENTER LOBBY 🚀
      function mountInsideAdvertisementSlot() {
        var box = document.getElementById('lobbyCrossPromoBox');
        if (!box || box.dataset.mounted === '1') return;

        var adEl = Array.from(document.querySelectorAll('div, span, p, small, h3, h4')).find(function(el) {
          return el.children.length === 0 && /^advertisement$/i.test((el.textContent || '').trim());
        });

        if (adEl && adEl.parentNode) {
          adEl.parentNode.insertBefore(box, adEl.nextSibling);
          box.dataset.mounted = '1';
        }
      }

      window.hideLobbyPromo = function() {
        joinedArena = true;
        var box = document.getElementById('lobbyCrossPromoBox');
        if (box) box.style.setProperty('display', 'none', 'important');
      };

      function renderPromo(ad) {
        if (joinedArena) return;
        mountInsideAdvertisementSlot();
        var box = document.getElementById('lobbyCrossPromoBox');
        if (!box) return;
        if (!ad || !ad.active) { box.style.display = 'none'; return; }

        var col = ad.color || '#facc15';
        box.style.borderColor = col;
        document.getElementById('cpTag').style.color = col;
        document.getElementById('cpTag').textContent = ad.tag || '📢 FEATURED';
        document.getElementById('cpTitle').textContent = ad.title || '';
        document.getElementById('cpDesc').textContent = ad.desc || '';
        var btn = document.getElementById('cpBtn');
        btn.textContent = ad.btnText || '🔥 Check It Out';
        btn.href = ad.url || '#';
        btn.style.background = col;
        box.style.display = 'block';
      }

      setInterval(function() {
        mountInsideAdvertisementSlot();
        if (typeof socket === 'undefined' || window._cpBound) return;
        window._cpBound = true;

        var origEmit = socket.emit.bind(socket);
        socket.emit = function(ev) {
          if (ev === 'joinRoom') window.hideLobbyPromo();
          return origEmit.apply(this, arguments);
        };

        socket.on('serverAccessGranted', function(srv) {
          joinedArena = false;
          if (srv && srv.id) socket.emit('requestServerAd', srv.id);
        });

        socket.on('initRole', window.hideLobbyPromo);

        socket.on('updateServerAd', function(data) {
          if (!joinedArena && data && data.serverId === window.selectedServerId) {
            renderPromo(data.ad);
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
                body = body.replace('</body>', ENTRY_AD_SLOT_WIDGET + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });

    io.on('connection', (socket) => {
        socket.on('requestServerAd', (serverId) => {
            if (!serverId) return;
            if (PROTECTED_SERVERS.has(serverId)) {
                socket.emit('updateServerAd', { serverId, ad: null });
                return;
            }
            socket.emit('updateServerAd', { serverId, ad: serverAds[serverId] || DEFAULT_COLLAB_OFFER });
        });

        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload !== null) ? payload.text : payload;
            if (!raw || typeof raw !== 'string') return;
            const sender = (socket.username || (payload && payload.username) || '').trim().toLowerCase();
            if (sender !== 'samaksh' && sender !== 'sammu') return;

            const clean = raw.trim();

            // Set YouTube Collab OR Fashion/Beauty Affiliate Link per server:
            // /setcollab srv_heer | 💅 Nail Art Kits Under ₹199 | Cute press-on nails & lip glosses! | 🛍️ Shop Flipkart | https://flipkart.com...
            if (clean.toLowerCase().startsWith('/setcollab ')) {
                const [targetSrv, title, desc, btnText, url] = clean.slice(11).split('|').map(s => s.trim());
                if (!targetSrv || !title || !url || PROTECTED_SERVERS.has(targetSrv)) return;
                const isFashion = /flipkart|myntra|nykaa|shop|fashion|nail|makeup/i.test(title + desc + url);
                serverAds[targetSrv] = {
                    active: true,
                    tag: isFashion ? '💄 TRENDING FASHION & BEAUTY' : '🔥 FEATURED COLLAB CREATOR',
                    title,
                    desc: desc || '',
                    btnText: btnText || (isFashion ? '🛍️ View Deal' : '▶️ Subscribe'),
                    url: url.startsWith('http') ? url : 'https://' + url,
                    color: isFashion ? '#f472b6' : '#38bdf8'
                };
                saveAds();
                socket.emit('message', { username: 'SYSTEM', text: `✅ Entry Banner updated for **${targetSrv}**!`, _serverId: socket.activeServerId });
            }

            if (clean.toLowerCase().startsWith('/resetcollab ')) {
                const targetSrv = clean.slice(13).trim();
                delete serverAds[targetSrv];
                saveAds();
                socket.emit('message', { username: 'SYSTEM', text: `🔄 **${targetSrv}** reset to Collab Offer banner.`, _serverId: socket.activeServerId });
            }
        });
    });
};
