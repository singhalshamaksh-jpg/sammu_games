(function () {
  let realPhonkAudio = null;
  let vizTimer = null;

  // Save original synth functions so Tokyo Drift keeps its original sound!
  const origTogglePhonkBeat = window.togglePhonkBeat;
  const origStopPhonkLoop = window.stopPhonkLoop;

  // Only list the tracks you want as Real MP3s (Tokyo is left out so it uses the original synth!)
    const MP3_TRACKS = {
    brazil:  { url: '/public_phonk_batidao.mp3',        label: '🇧🇷 No Batidão (Brazilian Phonk)' },
    demon:   { url: '/public_phonk_jumpstyle.mp3',      label: '🌌 Heavenly Jumpstyle' },
    drift:   { url: '/public_phonk_automotivo.mp3',     label: '🔥 Automotivo Mandelão' },
    murder:  { url: '/public_phonk_murder.mp3',         label: '👻 Kordhell Murder Phonk' },
    sigma:   { url: '/public_phonk_sigma.mp3__.mp3',    label: '🗿 Sigma GigaChad' },
    memphis: { url: '/public_phonk_memphis.mp3',        label: '👹 Montagem Memphis' },
    cyber:   { url: '/public_phonk_hardstyle.mp3',      label: '🚀 Euphoric Hardstyle' }
  };


  const BTN_MAP = {
    drift: 'loopDrift', brazil: 'loopBrazil', murder: 'loopMurder', sigma: 'loopSigma',
    memphis: 'loopMemphis', cyber: 'loopCyber', tokyo: 'loopTokyo', demon: 'loopDemon'
  };

  function bounceBars() {
    const bars = document.querySelectorAll('#djVisualizer .dj-bar');
    bars.forEach(b => { b.style.height = (Math.floor(Math.random() * 82) + 18) + '%'; });
    setTimeout(() => bars.forEach(b => { b.style.height = '15%'; }), 140);
  }

  function startTrack(style, djName) {
    if (vizTimer) { clearInterval(vizTimer); vizTimer = null; }
    if (realPhonkAudio) {
      realPhonkAudio.pause();
      realPhonkAudio.currentTime = 0;
    }

    // If it's Tokyo Drift (not in MP3_TRACKS), run the original synth!
    if (!MP3_TRACKS[style]) {
      if (typeof origTogglePhonkBeat === 'function') {
        origTogglePhonkBeat(style, '🏎️ Tokyo Drift');
      }
      return;
    }

    if (typeof origStopPhonkLoop === 'function') origStopPhonkLoop();
    document.querySelectorAll('.dj-loop-btn').forEach(b => b.classList.remove('active'));

    const chosen = MP3_TRACKS[style];
    window._activePhonkLabel = chosen.label;

    const btn = document.getElementById(BTN_MAP[style]);
    if (btn) btn.classList.add('active');

    const np = document.getElementById('djNowPlaying');
    if (np) np.textContent = (djName ? '🎧 DJ ' + djName + ': ' : '🔥 LIVE: ') + chosen.label;
    const miniLbl = document.getElementById('miniBarTrack');
    if (miniLbl) miniLbl.textContent = '🎧 ' + chosen.label;

    realPhonkAudio = new Audio(chosen.url);
    realPhonkAudio.loop = true;
    realPhonkAudio.volume = 0.85;
    realPhonkAudio.play().catch(() => {
      if (np) np.textContent = '⚠️ Upload ' + chosen.url + ' first!';
    });

    vizTimer = setInterval(bounceBars, 220);
  }

  window.stopPhonkLoop = function (fromRemote) {
    if (vizTimer) { clearInterval(vizTimer); vizTimer = null; }
    if (realPhonkAudio) {
      realPhonkAudio.pause();
      realPhonkAudio.currentTime = 0;
    }
    window._activePhonkLabel = null;
    if (typeof origStopPhonkLoop === 'function') origStopPhonkLoop();
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
})();
