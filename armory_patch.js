module.exports = function initArmoryPatch(app, io, helpers) {
    const verifyLock = (helpers && helpers.verifyOGHostTripleLock) || (() => true);

    io.on('connection', (socket) => {
        socket.use((packet, next) => {
            const [event, payload] = packet;
            const u = String(socket.verifiedOGUser || socket.username || '').trim().toLowerCase();
            const c = typeof payload === 'string' ? payload.trim().toLowerCase() : String((payload && payload.code) || '').trim().toLowerCase();
            const avId = payload && payload.avatarId;
            if ((c === '#sammuop' || avId === 'superhost') && (!['sammu', 'samaksh'].includes(u) || !verifyLock(u, socket, false))) {
                socket.emit('rpgToast', '🛡️ Locked to Samaksh only!');
                return;
            }
            if ((c === '#millyqueen' || avId === 'host_milly') && (u !== 'milly' || !verifyLock(u, socket, false))) {
                socket.emit('rpgToast', '🛡️ Locked to Princess Milly only!');
                return;
            }
            next();
        });
    });

    app.get('/armory-patch.js', (req, res) => {
        res.type('application/javascript');
        res.send(`
(function() {
  // 1. Tap-to-Zoom Avatar Modal
  const modal = document.createElement('div');
  modal.id = 'stZoomModal';
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(4,7,18,0.92);z-index:999999999;align-items:center;justify-content:center;';
  modal.innerHTML = '<div style="background:#0f172a;border:2px solid #f472b6;border-radius:22px;padding:24px;text-align:center;max-width:300px;width:88%;">' +
    '<div id="stZoomRing" style="width:140px;height:140px;margin:0 auto 14px;border-radius:50%;overflow:hidden;"><img id="stZoomImg" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"></div>' +
    '<div id="stZoomUser" style="color:#fff;font-weight:900;font-size:18px;margin-bottom:4px;"></div>' +
    '<div id="stZoomTitle" style="color:#f472b6;font-weight:800;font-size:13px;margin-bottom:16px;"></div>' +
    '<button onclick="document.getElementById(\\'stZoomModal\\').style.display=\\'none\\'" style="background:#ec4899;color:#fff;border:none;padding:8px 22px;border-radius:12px;font-weight:900;">Close</button>' +
    '</div>';
  // 2. Override openRpgModalNow so RPG Arena ALWAYS renders immediately
  let curTab = 'pvp';
  window.rpgTab = function(t) {
    curTab = t;
    ['pvp','grind','gacha','chars','gear'].forEach(x => {
      const b = document.getElementById('rtab_' + x);
      if (b) b.classList.toggle('active', x === t);
    });
    renderFallbackRpg();
  };

  function renderFallbackRpg() {
    const top = document.getElementById('rpgTopStats');
    const body = document.getElementById('rpgBody');
    if (!top || !body) return;
    const u = (window._savedUname || localStorage.getItem('sammu_username') || localStorage.getItem('username') || 'Samaksh').trim();
    const myAv = JSON.parse(localStorage.getItem('sammu_equipped_av') || 'null');
    const heroName = myAv ? myAv.name : '🔫 Cyber Gunner';
    const isGod = myAv && myAv.id === 'superhost';
    const hp = isGod ? '∞' : '2,500';
    const atk = isGod ? '∞' : '650';

    top.innerHTML =
      '<div class="rpg-stat-box"><span>HERO</span><b>' + heroName + '</b></div>' +
      '<div class="rpg-stat-box"><span>HP / ATK</span><b>' + hp + ' / ' + atk + '</b></div>' +
      '<div class="rpg-stat-box"><span>GOLD / MVP</span><b>500 🪙 / 30 ⭐</b></div>';

    if (curTab === 'pvp') {
      body.innerHTML = '<div class="rpg-card" style="text-align:center;">' +
        '<h4 style="color:#fde047;margin:0 0 8px;">⚔️ LIVE ARENA MATCHMAKING</h4>' +
        '<p style="color:#94a3b8;font-size:12px;margin-bottom:12px;">Active Fighter: <b style="color:#fff;">' + heroName + '</b> (' + u + ')</p>' +
        '<button class="rpg-btn rpg-btn-gold" style="width:100%;" onclick="if(window.socket)window.socket.emit(\\'rpgGetRoomPlayers\\');this.textContent=\\'🔄 Scanning Online Players...\\';">🔄 Scan Online Opponents</button>' +
        '<div id="rpgOppList" style="margin-top:10px;color:#cbd5e1;font-size:12px;">Tap Scan or jump into Grind Lvl to earn Gold & XP!</div>' +
        '</div>';
    } else if (curTab === 'grind') {
      body.innerHTML = '<div class="rpg-card">' +
        '<h4 style="color:#4ade80;margin:0 0 6px;">🐺 SOLO DUNGEON GRIND</h4>' +
        '<p style="color:#94a3b8;font-size:12px;margin-bottom:10px;">Battle mobs & bosses to level up your equipped avatar!</p>' +
        '<div style="display:flex;gap:8px;">' +
        '<button class="rpg-btn rpg-btn-green" style="flex:1;" onclick="alert(\\'⚔️ Defeated Shadow Wolf! +70 XP & +40 Gold!\\')">🐺 Grind Mob (+70 XP)</button>' +
        '<button class="rpg-btn rpg-btn-red" style="flex:1;" onclick="alert(\\'🔥 Defeated Crimson Dragon Boss! +210 XP & +120 Gold!\\')">👹 Raid Boss (+210 XP)</button>' +
        '</div></div>';
    } else if (curTab === 'gacha') {
      body.innerHTML = '<div class="rpg-card" style="text-align:center;">' +
        '<h4 style="color:#e879f9;margin:0 0 8px;">🎰 DIVINE HERO GACHA</h4>' +
        '<p style="color:#cbd5e1;font-size:12px;margin-bottom:12px;">Roll for Mythic & Host Fighters (10 MVP)</p>' +
        '<button class="rpg-btn rpg-btn-purple" style="width:100%;" onclick="alert(\\'🎲 Rolled Gacha! Open 👑 Avatars to equip your unlocked heroes!\\')">🎲 Roll Avatar Gacha (10 ⭐)</button>' +
        '</div>';
    } else if (curTab === 'chars') {
      body.innerHTML = '<div class="rpg-card" style="text-align:center;">' +
        '<h4 style="color:#38bdf8;margin:0 0 8px;">🦸 EQUIPPED FIGHTER</h4>' +
        '<p style="color:#fff;font-size:14px;font-weight:900;margin-bottom:10px;">' + heroName + '</p>' +
        '<button class="rpg-btn rpg-btn-gold" onclick="document.getElementById(\\'rpgArenaModal\\').style.display=\\'none\\';document.getElementById(\\'stVaultModal\\').style.display=\\'flex\\';">👑 Switch Hero in Armory</button>' +
        '</div>';
    } else if (curTab === 'gear') {
      body.innerHTML = '<div class="rpg-card">' +
        '<h4 style="color:#fbbf24;margin:0 0 8px;">🗡️ LEGENDARY GEAR SHOP</h4>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span>🐉 Dragon Greatsword (+950 ATK)</span><button class="rpg-btn rpg-btn-gold" onclick="alert(\\'✅ Equipped Dragon Greatsword!\\')">Equip</button></div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;"><span>👑 Sovereign Relic (+3000 HP)</span><button class="rpg-btn rpg-btn-gold" onclick="alert(\\'✅ Equipped Sovereign Relic!\\')">Equip</button></div>' +
        '</div>';
    }
  }

  window.openRpgModalNow = function() {
    const m = document.getElementById('rpgArenaModal');
    if (m) m.style.display = 'flex';
    renderFallbackRpg();
  };

  // 3. Save equipped avatar locally & paint Aura + Glow onto every chat message
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.st-card');
    if (card) {
      const img = card.querySelector('img');
      const nameEl = card.querySelector('div[style*="font-weight:900"]');
      const ringEl = card.querySelector('.st-ring');
      if (img && nameEl) {
        const ringCls = ringEl ? ringEl.className.replace('st-ring', '').trim() : 'v14-ring-gold';
        localStorage.setItem('sammu_equipped_av', JSON.stringify({
          name: nameEl.textContent.trim(),
          img: img.src,
          ring: ringCls,
          id: nameEl.textContent.includes('SAMAKSH') ? 'superhost' : 'hero'
        }));
      }
    }

    const bubble = e.target.closest('.v14-bubble');
    if (bubble) {
      const img = bubble.querySelector('img');
      const sender = bubble.getAttribute('data-user') || 'Player';
      if (img) document.getElementById('stZoomImg').src = img.src;
      document.getElementById('stZoomRing').className = bubble.className.replace('v14-bubble', '').trim();
      document.getElementById('stZoomUser').textContent = sender;
      document.getElementById('stZoomTitle').textContent = bubble.getAttribute('data-title') || 'Equipped Hero';
      modal.style.display = 'flex';
    }
  });

  setInterval(() => {
    ['stCodeInput', 'rpgHostCodeInp'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.placeholder !== 'Enter Secret Host Code...') el.placeholder = 'Enter Secret Host Code...';
    });

    const myAv = JSON.parse(localStorage.getItem('sammu_equipped_av') || 'null');
    if (!myAv) return;
    const myName = (window._savedUname || localStorage.getItem('sammu_username') || localStorage.getItem('username') || 'samaksh').trim().toLowerCase();

    document.querySelectorAll('#chatBox > div, #messages > div, .message, .msg').forEach(row => {
      if (row.dataset.avStyled) return;
      const txt = (row.textContent || '').toLowerCase();
      if (!myName || !txt.includes(myName)) return;
      row.dataset.avStyled = '1';
      row.classList.add(myAv.id === 'superhost' ? 'v14-chat-samaksh' : 'v14-chat-host');

      const badge = document.createElement('span');
      badge.className = 'v14-bubble ' + (myAv.ring || 'v14-ring-samaksh');
      badge.setAttribute('data-user', myName);
      badge.setAttribute('data-title', myAv.name);
      badge.style.cssText = 'display:inline-flex;width:28px;height:28px;vertical-align:middle;margin-right:6px;cursor:pointer;';
      badge.innerHTML = '<img src="' + myAv.img + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';

      const pill = document.createElement('span');
      pill.className = 'v14-title-pill';
      pill.textContent = myAv.name;

      row.insertBefore(pill, row.firstChild);
      row.insertBefore(badge, row.firstChild);
    });
  }, 600);
})();
        `);
    });
};
