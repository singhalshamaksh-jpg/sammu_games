function patchClient() {
  function getMyUser() {
    var keys = ['sammu_username', 'username', 'playerName', 'user'];
    for (var i = 0; i < keys.length; i++) {
      var val = localStorage.getItem(keys[i]) || sessionStorage.getItem(keys[i]);
      if (val && val.trim()) return val.trim().toLowerCase();
    }
    var globalName = window._savedUname || window.myUsername || window.username || '';
    if (globalName && String(globalName).trim()) return String(globalName).trim().toLowerCase();
    var inp = document.querySelector('input[placeholder*="name" i], input[id*="name" i], input[id*="user" i]');
    return (inp && inp.value && inp.value.trim()) ? inp.value.trim().toLowerCase() : '';
  }

  // 1. Save equipped avatar when tapped in Armory Vault
  document.addEventListener('click', function (e) {
    var item = e.target.closest('.st-item');
    if (!item) return;
    var img = item.querySelector('img');
    var titleEl = item.querySelector('div[style*="font-weight:900"]');
    var ringEl = item.querySelector('.st-art');
    if (!img || !titleEl) return;

    var name = titleEl.textContent.trim();
    var idMap = {
      'SAMAKSH': 'superhost', 'Milly': 'host_milly', 'Ishika': 'host_ishika',
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
    localStorage.setItem('sammu_equipped_av_obj', JSON.stringify({ id: id, name: name, img: img.src, ring: ring }));
    window._avSynced = false;
  });

  // 2. Sync to Server & Paint Chat Auras + Portrait Bubbles
  setInterval(function () {
    var u = getMyUser();
    var av = JSON.parse(localStorage.getItem('sammu_equipped_av_obj') || 'null');
    if (!u || !av) return;

    if (typeof socket !== 'undefined' && !window._avSynced) {
      window._avSynced = true;
      socket.emit('equipAvatarFxV6', { username: u, avatarId: av.id, fx: av.ring, badge: av.name });
      socket.emit('rpgSelectFighter', { username: u, fighterId: av.id });
      socket.emit('rpgGetState', u);
    }

    document.querySelectorAll('#chatBox *, #messages *, [class*="chat"] *, [class*="msg"] *').forEach(function (el) {
      if (el.children.length > 0 || el.closest('#stVaultModal') || el.closest('#rpgArenaModal')) return;
      var txt = (el.textContent || '').trim().toLowerCase().replace(':', '');
      if (txt !== u) return;

      var row = el.parentElement;
      var box = row.closest('#chatBox > div, #messages > div, [class*="msg"]') || row;
      if (box && !box.dataset.auraApplied) {
        box.dataset.auraApplied = '1';
        box.style.padding = '7px 11px';
        box.style.marginBottom = '6px';
        var auraCls = av.id === 'superhost' ? 'v14-chat-samaksh' : (av.id === 'host_milly' ? 'v14-chat-empress' : (av.id === 'host_ishika' ? 'v14-chat-solar' : 'v14-chat-host'));
        box.classList.add(auraCls);
      }

      if (!row.querySelector('.v14-bubble')) {
        var b = document.createElement('span');
        b.className = 'v14-bubble ' + (av.ring || 'v14-ring-gold');
        b.innerHTML = '<img src="' + av.img + '">';
        el.insertAdjacentElement('beforebegin', b);
      }

      if (!row.querySelector('.v14-title-pill')) {
        var pill = document.createElement('span');
        pill.className = 'v14-title-pill';
        pill.textContent = av.name;
        el.insertAdjacentElement('afterend', pill);
      }
    });
  }, 800);
}

module.exports = function initArmoryPatch(app, io) {
  io.on('connection', function (socket) {
    socket.use(function (packet, next) {
      var ev = packet && packet[0];
      if (ev === 'rpgGetRoomPlayers') {
        var list = [];
        io.sockets.sockets.forEach(function (s, sid) {
          if (sid !== socket.id && (!socket.activeServerId || !s.activeServerId || s.activeServerId === socket.activeServerId)) {
            list.push({
              id: sid,
              username: s.username || ('Player_' + sid.slice(0, 4)),
              fighterName: '⚔️ Arena Fighter',
              fighterId: 'gunner',
              lvl: 1
            });
          }
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
