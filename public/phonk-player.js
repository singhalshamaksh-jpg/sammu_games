(function () {
  let vizTimer = null;

  const MP3_TRACKS = {
    brazil:    { url: '/public_phonk_batidao.mp3',                           label: '🇧🇷 No Batidão (Brazilian Phonk)' },
    demon:     { url: '/public_phonk_jumpstyle.mp3',                         label: '🌌 Heavenly Jumpstyle' },
    drift:     { url: '/public_phonk_automotivo.mp3',                        label: '🔥 Automotivo Mandelão' },
    murder:    { url: '/public_phonk_murder.mp3',                            label: '👻 Kordhell Murder Phonk' },
    sigma:     { url: '/public_phonk_sigma.mp3__.mp3',                       label: '🗿 Sigma GigaChad' },
    memphis:   { url: '/public_phonk_memphis.mp3',                           label: '👹 Montagem Memphis' },
    cyber:     { url: '/public_phonk_hardstyle.mp3',                         label: '🚀 Euphoric Hardstyle' },
    tokyo:     { url: '/public_phonk_bingbingboo.mp3',                       label: '👾 Bing Bing Boo' },
    supreme:   { url: '/public_phonk_supreme.mp3',                           label: '👑 Shubh - Supreme' },
    onelove:   { url: '/public_phonk_onelove.mp3',                           label: '💖 Shubh - One Love' },
    winning:   { url: '/public_phonk_winning.mp3',                           label: '🏆 Aujla - Winning Speech' },
    dopeshope: { url: '/Dope Shope International Villager 128 Kbps.mp3',     label: '🔥 Yo Yo - Dope Shope' },
    passo:     { url: '/ATLXS - PASSO BEM SOLTO.mp3',                        label: '👣 Passo Bem Solto' }
  };

  const BTN_MAP = {
    drift: 'loopDrift', brazil: 'loopBrazil', murder: 'loopMurder', sigma: 'loopSigma',
    memphis: 'loopMemphis', cyber: 'loopCyber', tokyo: 'loopTokyo', demon: 'loopDemon',
    supreme: 'loopSupreme', onelove: 'loopOneLove', winning: 'loopWinning',
    dopeshope: 'loopDopeShope', passo: 'loopPasso'
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

  function injectCustomButtons() {
    const tokyoBtn = document.getElementById('loopTokyo');
    if (tokyoBtn && tokyoBtn.textContent.includes('Tokyo')) {
      tokyoBtn.textContent = '👾 Bing Bing Boo';
    }
    const grid = document.querySelector('#phonkDjCard .dj-loops');
    if (!grid) return;

    const customButtons = [
      { id: 'loopSupreme',   key: 'supreme',   text: '👑 Shubh - Supreme',        color: '#facc15' },
      { id: 'loopOneLove',   key: 'onelove',   text: '💖 Shubh - One Love',       color: '#f472b6' },
      { id: 'loopWinning',   key: 'winning',   text: '🏆 Aujla - Winning Speech', color: '#38bdf8' },
      { id: 'loopDopeShope', key: 'dopeshope', text: '🔥 Yo Yo - Dope Shope',     color: '#fb923c' },
      { id: 'loopPasso',     key: 'passo',     text: '👣 Passo Bem Solto',        color: '#4ade80' }
    ];

    customButtons.forEach(item => {
      if (!document.getElementById(item.id)) {
        const btn = document.createElement('button');
        btn.id = item.id;
        btn.className = 'dj-loop-btn';
        btn.style.borderColor = item.color;
        btn.textContent = item.text;
        btn.onclick = () => window.togglePhonkBeat(item.key);
        grid.appendChild(btn);
      }
    });
  }

  function installMp3Override() {
    if (window._phonkPlayerVersion === 2) return;
    window._phonkPlayerVersion = 2;

    const origStopPhonkLoop = window.stopPhonkLoop;

    // Kill any built-in synth loop once on startup, without touching our MP3 player
    if (typeof origStopPhonkLoop === 'function') {
      try { origStopPhonkLoop(); } catch (e) {}
    }

    injectCustomButtons();
    setInterval(injectCustomButtons, 800);

    function startTrack(style, djName) {
      if (vizTimer) { clearInterval(vizTimer); vizTimer = null; }

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
      player.src = encodeURI(chosen.url);
      player.currentTime = 0;
      player.loop = true;
      player.volume = 0.85;

      const playPromise = player.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.error('MP3 error:', err);
          if (np) np.textContent = '⚠️ Tap screen once then retry: ' + chosen.url;
        });
      }

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

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(installMp3Override, 100);
  } else {
    window.addEventListener('DOMContentLoaded', () => setTimeout(installMp3Override, 100));
  }
})();
