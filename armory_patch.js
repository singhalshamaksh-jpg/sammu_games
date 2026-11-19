function patchClient() {
  function getMyUser() {
    var keys = ['sammu_username', 'username', 'playerName', 'user'];
    for (var i = 0; i < keys.length; i++) {
      var val = localStorage.getItem(keys.at(i)) || sessionStorage.getItem(keys.at(i));
      if (val && val.trim()) return val.trim().toLowerCase();
    }
    var globalName = window._savedUname || window.myUsername || window.username || '';
    if (globalName && String(globalName).trim()) return String(globalName).trim().toLowerCase();
    var inp = document.querySelector('input[placeholder*="name" i], input[id*="name" i], input[id*="user" i]');
    return (inp && inp.value && inp.value.trim()) ? inp.value.trim().toLowerCase() : '';
  }

  function ensureZoomModal() {
    if (document.getElementById('stZoomModal')) return;
    var modal = document.createElement('div');
    modal.id = 'stZoomModal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(4,7,18,0.92);z-index:2147483647;align-items:center;justify-content:center;backdrop-filter:blur(8px);';
    modal.onclick = function (e) { if (e.target === modal) modal.style.display = 'none'; };
    modal.innerHTML =
      '<div style="background:#0f172a;border:2px solid #fde047;border-radius:22px;padding:22px;text-align:center;max-width:290px;width:86%;box-shadow:0 0 35px rgba(253,224,71,0.4);">' +
        '<div id="stZoomRing" style="width:150px;height:150px;margin:0 auto 14px;border-radius:50%;overflow:hidden;"><img id="stZoomImg" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"></div>' +
        '<div id="stZoomUser" style="color:#fff;font-weight:900;font-size:18px;margin-bottom:4px;"></div>' +
        '<div id="stZoomTitle" style="color:#fde047;font-weight:800;font-size:12px;margin-bottom:16px;"></div>' +
        '<button onclick="document.getElementById(\'stZoomModal\').style.display=\'none\'" style="background:#ec4899;color:#fff;border:none;padding:8px 24px;border-radius:12px;font-weight:900;cursor:pointer;">Close</button>' +
      '</div>';
    document.body.appendChild(modal);
  }

  document.addEventListener('click', function (e) {
    var bubble = e.target.closest('.v14-bubble');
    if (bubble) {
      e.preventDefault();
      e.stopPropagation();
      ensureZoomModal();
      var bImg = bubble.querySelector('img');
      if (bImg) document.getElementById('stZoomImg').src = bImg.src;
      document.getElementById('stZoomRing').className = bubble.className.replace('v14-bubble', '').trim();
      document.getElementById('stZoomUser').textContent = (bubble.getAttribute('data-user') || 'Player').toUpperCase();
      document.getElementById('stZoomTitle').textContent = bubble.getAttribute('data-title') || 'Equipped Avatar';
      document.getElementById('stZoomModal').style.display = 'flex';
      return;
    }

    var item = e.target.closest('.st-item');
    if (!item) return;
    var img = item.querySelector('img');
    var titleEl = item.querySelector('div[style*="font-weight:900"]');
    var ringEl = item.querySelector('.st-art');
    if (!img || !titleEl) return;

    var name = titleEl.textContent.replace(/SAMAKSH\s*\(GOD OP\+\+\)\s*👑🦚?/gi, 'SAMMU').replace(/SAMAKSH/gi, 'SAMMU').trim();
    var idMap = {
      'SAMMU': 'superhost', 'SAMAKSH': 'superhost', 'Krishna': 'superhost', 'Milly': 'host_milly', 'Ishika': 'host_ishika',
      'Moon': 'host_moon', 'Zoro': 'host_zoro', 'Sus': 'host_sus',
      'Sid': 'host_sid', 'Shubhi': 'host_shubhi', 'Sarah': 'host_sarah',
      'Heer': 'host_heer', 'Izzan': 'host_izzan', 'Zaira': 'host_zaira',
      'Advait': 'host_advait', 'Ruwii': 'host_ruwii', 'Gunner': 'gunner',
      'Swordsman': 'swordsman', 'Pyromancer': 'fire_mage', 'Hydromancer': 'water_bender',
      'Raijin': 'lightning_lord', 'Rubber': 'rubber_hero', 'Chronos': 'spacetime_god'
    };
    var id = 'gunner';
    for (var k in idMap) {
      if (name.indexOf(k) !== -1) { id = idMap[k]; break; }
    }
    var ring = ringEl ? ringEl.className.replace('st-art', '').trim() : 'v14-ring-gold';
    var avObj = { id: id, name: name, img: img.src, ring: ring };
    localStorage.setItem('sammu_equipped_av_obj', JSON.stringify(avObj));
    window._allAvatarsMap = window._allAvatarsMap || {};
    var me = getMyUser();
    if (me) window._allAvatarsMap[me] = avObj;
    window._avSynced = false;
  });
  setInterval(function () {
    ensureZoomModal();

    document.querySelectorAll('#stGrid div, #rpgBody div, #rpgTopStats span, .v14-title-pill').forEach(function (el) {
      if (el.children.length === 0 && (el.textContent.indexOf('GOD OP++') !== -1 || el.textContent.indexOf('SAMAKSH') !== -1)) {
        el.textContent = el.textContent.replace(/SAMAKSH\s*\(GOD OP\+\+\)\s*👑🦚?/gi, 'SAMMU').replace(/SAMAKSH/gi, 'SAMMU').trim();
      }
    });

    var u = getMyUser();
    var av = JSON.parse(localStorage.getItem('sammu_equipped_av_obj') || 'null');
    window._allAvatarsMap = window._allAvatarsMap || {};
    if (u && av) window._allAvatarsMap[u] = av;

    if (typeof socket !== 'undefined') {
      if (!window._patchNetBound) {
        window._patchNetBound = true;
        socket.on('avatarBroadcastPatch', function (data) {
          if (data && data.username && data.av) {
            window._allAvatarsMap[data.username.toLowerCase()] = data.av;
          }
        });
      }
      if (u && av && !window._avSynced) {
        window._avSynced = true;
        socket.emit('equipAvatarFxV6', { username: u, avatarId: av.id, fx: av.ring, badge: av.name });
        socket.emit('rpgSelectFighter', { username: u, fighterId: av.id });
        socket.emit('rpgGetState', u);
        socket.emit('broadcastMyAvatarPatch', { username: u, av: av });
      }
    }

    document.querySelectorAll('#chatBox *, #messages *, [class*="chat"] *, [class*="msg"] *, #playerList *, .player-item *').forEach(function (el) {
      if (el.children.length > 0 || el.closest('#stVaultModal') || el.closest('#rpgArenaModal') || el.closest('#stZoomModal')) return;
      var txt = (el.textContent || '').trim().toLowerCase().replace(':', '');
      var userAv = window._allAvatarsMap[txt];
      if (!userAv) return;

      var row = el.parentElement;
      var box = row.closest('#chatBox > div, #messages > div, [class*="msg"]') || row;

      if (box && !box.closest('#playerList') && box.dataset.auraApplied !== userAv.id) {
        box.dataset.auraApplied = userAv.id;
        box.style.padding = '7px 11px';
        box.style.marginBottom = '6px';
        box.classList.remove('v14-chat-samaksh', 'v14-chat-empress', 'v14-chat-solar', 'v14-chat-host');
        var auraCls = userAv.id === 'superhost' ? 'v14-chat-samaksh' : (userAv.id === 'host_milly' ? 'v14-chat-empress' : (userAv.id === 'host_ishika' ? 'v14-chat-solar' : 'v14-chat-host'));
        box.classList.add(auraCls);
      }

      var existingBubble = row.querySelector('.v14-bubble');
      if (!existingBubble) {
        var ninjaSlot = Array.from(row.children).find(function (c) {
          return c !== el && !c.classList.contains('v14-title-pill') && (c.textContent || '').trim().length <= 4;
        });
        var b = document.createElement('span');
        b.className = 'v14-bubble ' + (userAv.ring || 'v14-ring-gold');
        b.setAttribute('data-user', txt);
        b.setAttribute('data-title', userAv.name);
        b.style.cssText = 'display:inline-flex;width:34px;height:34px;vertical-align:middle;margin-right:6px;cursor:pointer;';
        b.innerHTML = '<img src="' + userAv.img + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';
        if (ninjaSlot) {
          ninjaSlot.innerHTML = '';
          ninjaSlot.appendChild(b);
        } else {
          el.insertAdjacentElement('beforebegin', b);
        }
      } else {
        var bImg = existingBubble.querySelector('img');
        if (bImg && bImg.src !== userAv.img) bImg.src = userAv.img;
      }

      if (!row.querySelector('.v14-title-pill') && !box.closest('#playerList')) {
        var pill = document.createElement('span');
        pill.className = 'v14-title-pill';
        pill.textContent = userAv.name;
        el.insertAdjacentElement('afterend', pill);
      }
    });
  }, 600);
}

module.exports = function initArmoryPatch(app, io) {
  var savedAvatarsByUser = {};

  io.on('connection', function (socket) {
    socket.emit('avatarBroadcastBatch', savedAvatarsByUser);

    socket.on('broadcastMyAvatarPatch', function (data) {
      if (data && data.username && data.av) {
        savedAvatarsByUser[data.username.toLowerCase()] = data.av;
        io.emit('avatarBroadcastPatch', data);
      }
    });

    socket.use(function (packet, next) {
      var ev = Array.isArray(packet) ? packet.at(0) : packet;
      var payload = Array.isArray(packet) ? packet.at(1) : null;

      if (ev === 'joinRoom' && payload && payload.username) {
        socket.username = payload.username.trim();
      }
      if (ev === 'chatMessage' && payload && payload.username) {
        socket.username = payload.username.trim();
      }
      if (ev === 'rpgSelectFighter' && payload && payload.username && payload.fighterId) {
        socket.username = payload.username.trim();
        socket.equippedFighterId = payload.fighterId;
      }
      if (ev === 'rpgGetState' && typeof payload === 'string') {
        socket.username = payload.trim();
      }

      if (ev === 'rpgGetRoomPlayers') {
        var list = [];
        var srvId = socket.activeServerId;
        io.sockets.sockets.forEach(function (s, sid) {
          if (sid === socket.id) return;
          if (srvId && s.activeServerId && s.activeServerId !== srvId) return;
          var uname = s.username || ('Player_' + sid.slice(0, 4));
          var fId = s.equippedFighterId || (uname.toLowerCase() === 'zoro' ? 'host_zoro' : (['sammu', 'samaksh'].indexOf(uname.toLowerCase()) !== -1 ? 'superhost' : 'gunner'));
          var fName = fId === 'superhost' ? '🦚👑 SAMMU' : (fId === 'host_zoro' ? '⚔️🐉 Zoro 3-Sword' : (fId === 'host_milly' ? '👸💖 Princess Milly' : '⚔️ Arena Fighter'));
          list.push({
            id: sid,
            username: uname,
            fighterName: fName,
            fighterId: fId,
            lvl: fId === 'superhost' ? '∞' : (fId.indexOf('host_') === 0 ? 500 : 1)
          });
        });
        socket.emit('rpgRoomPlayersList', list);
        return;
      }
      next();
    });
  });

  app.get('/armory-patch.js', function (req, res) {
    res.type('application/javascript');
    res.send('(' + patchClient.toString() + ')();');
  });
};
