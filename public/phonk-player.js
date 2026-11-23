(function () {
  let vizTimer = null;

  const MP3_TRACKS = {
    brazil:  { url: '/public_phonk_batidao.mp3',      label: '🇧🇷 No Batidão (Brazilian Phonk)' },
    demon:   { url: '/public_phonk_jumpstyle.mp3',    label: '🌌 Heavenly Jumpstyle' },
    drift:   { url: '/public_phonk_automotivo.mp3',   label: '🔥 Automotivo Mandelão' },
    murder:  { url: '/public_phonk_murder.mp3',       label: '👻 Kordhell Murder Phonk' },
    sigma:   { url: '/public_phonk_sigma.mp3__.mp3',  label: '🗿 Sigma GigaChad' },
    memphis: { url: '/public_phonk_memphis.mp3',      label: '👹 Montagem Memphis' },
    cyber:   { url: '/public_phonk_hardstyle.mp3',    label: '🚀 Euphoric Hardstyle' },
    tokyo:   { url: '/public_phonk_bingbingboo.mp3',  label: '👾 Bing Bing Boo' },
    supreme: { url: '/public_phonk_supreme.mp3',      label: '👑 Shubh - Supreme' },
    onelove: { url: '/public_phonk_onelove.mp3',      label: '💖 Shubh - One Love' }
  };

  const BTN_MAP = {
    drift: 'loopDrift', brazil: 'loopBrazil', murder: 'loopMurder', sigma: 'loopSigma',
    memphis: 'loopMemphis', cyber: 'loopCyber', tokyo: 'loopTokyo', demon: 'loopDemon',
    supreme: 'loopSupreme', onelove: 'loopOneLove'
  };

  function bounceBars() {
    const bars = document.querySelectorAll('#djVisualizer .dj-bar');
    bars.forEach(b => { b.style.height = (Math.floor(Math.random() * 82) + 18) + '%'; });
    setTimeout(() => bars.forEach(b => { b.style.height = '15%'; }), 140);
  }

  function getPersistentAudio() {
    if (!window._sharedPhonkPlayer) {
      const a = document.createElement('audio');
      a.id = 'sharedPhonkAudioEl';
      a.loop = true;
      a.preload = 'auto';
      a.setAttribute('playsinline', '');
      document.body.appendChild(a);
      window._sharedPhonkPlayer = a;
    }
    return window._sharedPhonkPlayer;
  }

  function installMp3Override() {
    if (window._mp3OverrideInstalled) return;
    window._mp3OverrideInstalled = true;

    const origStopPhonkLoop = window.stopPhonkLoop;

    // Rename Tokyo button & inject "👑 Shubh - Supreme" + "💖 Shubh - One Love"
    setInterval(() => {
      const tokyoBtn = document.getElementById('loopTokyo');
      if (tokyoBtn && tokyoBtn.textContent.includes('Tokyo')) {
        tokyoBtn.textContent = '👾 Bing Bing Boo';
      }
      const grid = document.querySelector('#phonkDjCard .dj-loops');
      if (grid) {
        if (!document.getElementById('loopSupreme')) {
          const supBtn = document.createElement('button');
          supBtn.id = 'loopSupreme';
          supBtn.className = 'dj-loop-btn';
          supBtn.style.borderColor = '#facc15';
          supBtn.textContent = '👑 Shubh - Supreme';
          supBtn.onclick = () => window.togglePhonkBeat('supreme');
          grid.appendChild(supBtn);
        }
        if (!document.getElementById('loopOneLove')) {
          const loveBtn = document.createElement('button');
          loveBtn.id = 'loopOneLove';
          loveBtn.className = 'dj-loop-btn';
          loveBtn.style.borderColor = '#f472b6';
          loveBtn.textContent = '💖 Shubh - One Love';
          loveBtn.onclick = () => window.togglePhonkBeat('onelove');
          grid.appendChild(loveBtn);
        }
      }
    }, 1000);

    function startTrack(style, djName) {
      if (vizTimer) { clearInterval(vizTimer); vizTimer = null; }

      if (typeof origStopPhonkLoop === 'function') {
        try { origStopPhonkLoop(); } catch (e) {}
      }
      document.querySelectorAll('.dj-loop-btn').forEach(b => b.classList.remove('active'));

      const chosen = MP3_TRACKS[style];
      if (!chosen) return;

      window._activePhonkLabel = chosen.label;

      const btn = document.getElementById(BTN_MAP[style]);
      if (btn) btn.classList.add('active');

      const np = document.getElementById('djNowPlaying');
      if (np) np.textContent = (djName ? '🎧 DJ ' + djName + ': ' : '🔥 LIVE: ') + chosen.label;
      const miniLbl = document.getElementById('miniBarTrack');
      if (miniLbl) miniLbl.textContent = '🎧 ' + chosen.label;

      const player = getPersistentAudio();
      player.pause();
      player.src = chosen.url;
      player.currentTime = 0;
      player.loop = true;
      player.volume = 0.85;
      player.play().catch((err) => {
        console.error('MP3 error:', err);
        if (np) np.textContent = '⚠️ Tap screen once then retry: ' + chosen.url;
      });

      vizTimer = setInterval(bounceBars, 220);
    }

    window.stopPhonkLoop = function (fromRemote) {
      if (vizTimer) { clearInterval(vizTimer); vizTimer = null; }
      const player = window._sharedPhonkPlayer;
      if (player) {
        player.pause();
        player.currentTime = 0;
      }
      window._activePhonkLabel = null;
      document.querySelectorAll('.dj-loop-btn').forEach(b => b.classList.remove('active'));
      const bar = document.getElementById('phonkMiniBar');
      if (bar) bar.style.display = 'none';
      if (typeof origStopPhonkLoop === 'function') {
        try { origStopPhonkLoop(); } catch (e) {}
      }
      if (!fromRemote && typeof socket !== 'undefined') {
        socket.emit('phonkTrackSync', { action: 'stop' });
      }
    };

    window.togglePhonkBeat = function (style) {
      startTrack(style, null);
      if (typeof socket !== 'undefined') {
        socket.emit('phonkTrackSync', { action: 'play', style });
      }
    };

    const waitSock = setInterval(() => {
      if (typeof socket === 'undefined') return;
      clearInterval(waitSock);
      socket.on('incomingPhonkTrack', (d) => {
        if (!d || (d._serverId && d._serverId !== window.selectedServerId)) return;
        if (d.action === 'stop') window.stopPhonkLoop(true);
        else if (d.action === 'play' && d.style) startTrack(d.style, d.dj);
      });
    }, 800);
  }

  window.addEventListener('load', () => setTimeout(installMp3Override, 300));
})();
