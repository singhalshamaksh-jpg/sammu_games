module.exports = function initFixButtons(app) {
    const TOOLBAR_FIX = `
    <style>
      #sammuFloatingArmoryBar { display: none !important; }
    </style>
    <script>
    setInterval(() => {
      const memeBtn = document.getElementById('memeHornBtn');
      if (!memeBtn || !memeBtn.parentElement) return;
      memeBtn.parentElement.style.flexWrap = 'wrap';

      if (!document.getElementById('toolbarAvatarsBtn')) {
        const avBtn = memeBtn.cloneNode(true);
        avBtn.id = 'toolbarAvatarsBtn';
        avBtn.removeAttribute('onclick');
        avBtn.textContent = '👑 Avatars';
        avBtn.style.background = 'linear-gradient(90deg, #7c3aed, #ec4899)';
        avBtn.onclick = (e) => {
          e.preventDefault();
          if (window.stDrawVault) window.stDrawVault();
          const m = document.getElementById('stVaultModal');
          if (m) m.style.display = 'flex';
        };
        memeBtn.parentNode.insertBefore(avBtn, memeBtn.nextSibling);
      }

      if (!document.getElementById('toolbarRpgBtn')) {
        const rpgBtn = memeBtn.cloneNode(true);
        rpgBtn.id = 'toolbarRpgBtn';
        rpgBtn.removeAttribute('onclick');
        rpgBtn.textContent = '⚔️ Avatar PvP';
        rpgBtn.style.background = 'linear-gradient(90deg, #f59e0b, #dc2626)';
        rpgBtn.onclick = (e) => {
          e.preventDefault();
          if (window.openRpgModalNow) window.openRpgModalNow();
        };
        const av = document.getElementById('toolbarAvatarsBtn') || memeBtn;
        av.parentNode.insertBefore(rpgBtn, av.nextSibling);
      }
    }, 700);
    </script>
    `;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>')) {
                body = body.replace('</body>', (app.locals.AVATAR_RPG_UI || '') + '\n' + TOOLBAR_FIX + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
};
