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
  const modal = document.createElement('div');
  modal.id = 'stZoomModal';
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(4,7,18,0.92);z-index:999999999;align-items:center;justify-content:center;';
  modal.innerHTML = '<div style="background:#0f172a;border:2px solid #f472b6;border-radius:22px;padding:24px;text-align:center;max-width:300px;width:88%;">' +
    '<div id="stZoomRing" style="width:140px;height:140px;margin:0 auto 14px;border-radius:50%;overflow:hidden;"><img id="stZoomImg" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"></div>' +
    '<div id="stZoomUser" style="color:#fff;font-weight:900;font-size:18px;margin-bottom:4px;"></div>' +
    '<div id="stZoomTitle" style="color:#f472b6;font-weight:800;font-size:13px;margin-bottom:16px;"></div>' +
    '<button onclick="document.getElementById(\\'stZoomModal\\').style.display=\\'none\\'" style="background:#ec4899;color:#fff;border:none;padding:8px 22px;border-radius:12px;font-weight:900;">Close</button>' +
    '</div>';
  document.body.appendChild(modal);

  let hooked = false;
  setInterval(() => {
    ['stCodeInput', 'rpgHostCodeInp'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.placeholder !== 'Enter Secret Host Code...') el.placeholder = 'Enter Secret Host Code...';
    });

    const s = window.socket;
    if (s && !hooked) {
      hooked = true;
      window.socket = s;
      const u = (window._savedUname || localStorage.getItem('sammu_username') || localStorage.getItem('username') || '').trim().toLowerCase();
      if (u) s.emit('rpgGetState', u);
      s.emit('getMyAvatarStatsV6');
    }

    const rpgModal = document.getElementById('rpgArenaModal');
    const rpgBody = document.getElementById('rpgBody');
    if (rpgModal && rpgModal.style.display === 'flex' && rpgBody && !rpgBody.innerHTML.trim() && s) {
      const u = (window._savedUname || localStorage.getItem('sammu_username') || localStorage.getItem('username') || 'samaksh').trim().toLowerCase();
      s.emit('rpgGetState', u);
      if (window.renderRpgBody) window.renderRpgBody();
    }
  }, 600);

  document.addEventListener('click', (e) => {
    const bubble = e.target.closest('.v14-bubble');
    if (!bubble) return;
    const img = bubble.querySelector('img');
    const sender = bubble.getAttribute('data-user') || bubble.getAttribute('data-sender') || 'Player';
    const titleEl = bubble.parentElement && bubble.parentElement.querySelector('.v14-title-pill');
    if (img) document.getElementById('stZoomImg').src = img.src;
    document.getElementById('stZoomRing').className = bubble.className.replace('v14-bubble', '').trim();
    document.getElementById('stZoomUser').textContent = sender;
    document.getElementById('stZoomTitle').textContent = titleEl ? titleEl.textContent : 'Equipped Hero';
    modal.style.display = 'flex';
  });
})();
        `);
    });
};
