(function () {
  let vizTimer = null;
  let userClickedStop = false;
  let currentStyle = null;
  let playToken = 0;

  let audioCtx = null;
  let compressor = null;
  let gainNode = null;
  let activeAudio = null;
  const audioPool = {};

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
    passo:     { url: '/ATLXS - PASSO BEM SOLTO.mp3',                        label: '👣 Passo Bem Solto' },
    shayari:   { url: '/5_6069160660401398338.m4a',                        label: '✍️ Shayari' }
  };

  const BTN_MAP = {
    drift: 'loopDrift', brazil: 'loopBrazil', murder: 'loopMurder', sigma: 'loopSigma',
    memphis: 'loopMemphis', cyber: 'loopCyber', tokyo: 'loopTokyo', demon: 'loopDemon',
    supreme: 'loopSupreme', onelove: 'loopOneLove', winning: 'loopWinning',
    dopeshope: 'loopDopeShope', passo: 'loopPasso', shayari: 'loopShayari'
  };

  function getAudioContext() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();

      // Dynamic compressor keeps loudness balanced & punchy without clipping
      compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-18, audioCtx.currentTime);
      compressor.knee.setValueAtTime(24, audioCtx.currentTime);
      compressor.ratio.setValueAtTime(4, audioCtx.currentTime);
      compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
      compressor.release.setValueAtTime(0.25, audioCtx.currentTime);

      gainNode = audioCtx.createGain();
      gainNode.gain.value = 0.9;

      compressor.connect(gainNode);
      gainNode.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function getOrCreateAudio(style) {
    if (audioPool[style]) return audioPool[style];
    const track = MP3_TRACKS[style];
    const audio = new Audio();
    audio.src = encodeURI(track.url);
    audio.loop = true;
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';

    try {
      const ctx = getAudioContext();
      const source = ctx.createMediaElementSource(audio);
      source.connect(compressor);
    } catch (e) {
      // Fallback to native audio output if Web Audio routing is restricted
    }

    audioPool[style] = audio;
    return audio;
  }

  function stopCurrentAudio() {
    if (activeAudio) {
      try {
        activeAudio.pause();
        activeAudio.currentTime = 0;
        activeAudio.onwaiting = null;
        activeAudio.onplaying = null;
      } catch (e) {}
      activeAudio = null;
    }
  }

  function bounceBars() {
    const bars = document.querySelectorAll('#djVisualizer .dj-bar');
    bars.forEach(b => { b.style.height = (Math.floor(Math.random() * 82) + 18) + '%'; });
    setTimeout(() => bars.forEach(b => { b.style.height = '15%'; }), 140);
  }

  function injectCustomButtons() {
    const tokyoBtn = document.getElementById('loopTokyo');
    if (tokyoBtn && tokyoBtn.textContent.includes('Tokyo')) {
      tokyoBtn.textContent = '👾 Bing Bing Boo';
    }
    const grids = document.querySelectorAll('.dj-loops');
    if (!grids.length) return;

    const customButtons = [
      { id: 'loopSupreme',   key: 'supreme',   text: '👑 Shubh - Supreme',        color: '#facc15' },
      { id: 'loopOneLove',   key: 'onelove',   text: '💖 Shubh - One Love',       color: '#f472b6' },
      { id: 'loopWinning',   key: 'winning',   text: '🏆 Aujla - Winning Speech', color: '#38bdf8' },
      { id: 'loopDopeShope', key: 'dopeshope', text: '🔥 Yo Yo - Dope Shope',     color: '#fb923c' },
      { id: 'loopPasso',     key: 'passo',     text: '👣 Passo Bem Solto',        color: '#4ade80' },
      { id: 'loopShayari',   key: 'shayari',   text: '✍️ Shayari',                color: '#c084fc' }
    ];

    grids.forEach(grid => {
      customButtons.forEach(item => {
        if (!grid.querySelector('#' + item.id)) {
          const btn = document.createElement('button');
          btn.id = item.id;
          btn.className = 'dj-loop-btn';
          btn.style.borderColor = item.color;
          btn.textContent = item.text;
          btn.onclick = () => window.togglePhonkBeat(item.key);
          grid.appendChild(btn);
        }
      });
    });
  }

  document.addEventListener('pointerdown', (e) => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    const target = e.target.closest('button, [onclick]');
    if (!target) return;
    const txt = (target.textContent || '').toLowerCase();
    const fn = (target.getAttribute('onclick') || '').toLowerCase();
    if (txt.includes('stop') || fn.includes('stopphonkloop')) {
      userClickedStop = true;
    }
  }, true);

  async function startTrack(style, djName) {
    const chosen = MP3_TRACKS[style];
    if (!chosen) return;

    const myToken = ++playToken;
    userClickedStop = false;
    currentStyle = style;

    getAudioContext();

    if (vizTimer) { clearInterval(vizTimer); vizTimer = null; }
    document.querySelectorAll('.dj-loop-btn').forEach(b => b.classList.remove('active'));

    const btn = document.getElementById(BTN_MAP[style]);
    if (btn) btn.classList.add('active');

    const np = document.getElementById('djNowPlaying');
    const miniLbl = document.getElementById('miniBarTrack');
    if (np) np.textContent = '⏳ Loading: ' + chosen.label;

    stopCurrentAudio();

    try {
      const audio = getOrCreateAudio(style);
      activeAudio = audio;

      audio.onwaiting = () => {
        if (myToken === playToken && np) {
          np.textContent = '⏳ Buffering: ' + chosen.label;
        }
      };

      audio.onplaying = () => {
        if (myToken !== playToken) return;
        window._activePhonkLabel = chosen.label;
        if (np) np.textContent = (djName ? '🎧 DJ ' + djName + ': ' : '🔥 LIVE: ') + chosen.label;
        if (miniLbl) miniLbl.textContent = '🎧 ' + chosen.label;
        if (!vizTimer) vizTimer = setInterval(bounceBars, 220);
      };

      await audio.play();
    } catch (err) {
      console.error('Audio playback error:', err);
      if (np) np.textContent = '❌ Error: ' + err.message;
    }
  }

  function customStop(fromRemote) {
    if (!fromRemote && !userClickedStop && currentStyle) return;

    playToken++;
    userClickedStop = true;
    currentStyle = null;
    if (vizTimer) { clearInterval(vizTimer); vizTimer = null; }

    stopCurrentAudio();
    window._activePhonkLabel = null;
    document.querySelectorAll('.dj-loop-btn').forEach(b => b.classList.remove('active'));
    const bar = document.getElementById('phonkMiniBar');
    if (bar) bar.style.display = 'none';

    if (!fromRemote && typeof socket !== 'undefined') {
      socket.emit('phonkTrackSync', { action: 'stop' });
    }
  }

  function customToggle(style) {
    startTrack(style, null);
    if (typeof socket !== 'undefined') {
      socket.emit('phonkTrackSync', { action: 'play', style });
    }
  }

  try {
    Object.defineProperty(window, 'togglePhonkBeat', { value: customToggle, writable: false, configurable: true });
    Object.defineProperty(window, 'stopPhonkLoop',   { value: customStop,   writable: false, configurable: true });
  } catch (e) {
    window.togglePhonkBeat = customToggle;
    window.stopPhonkLoop = customStop;
  }

  setInterval(() => {
    if (window.togglePhonkBeat !== customToggle) window.togglePhonkBeat = customToggle;
    if (window.stopPhonkLoop !== customStop) window.stopPhonkLoop = customStop;
    injectCustomButtons();

    if (!userClickedStop && currentStyle && audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }, 800);

  const waitSock = setInterval(() => {
    if (typeof socket === 'undefined') return;
    clearInterval(waitSock);
    socket.on('incomingPhonkTrack', (d) => {
      if (!d || (d._serverId && d._serverId !== window.selectedServerId)) return;
      if (d.action === 'stop') customStop(true);
      else if (d.action === 'play' && d.style) startTrack(d.style, d.dj);
    });
  }, 500);

  // Pre-warm Shayari metadata & buffer slightly after page load so it starts fast
  setTimeout(() => { getOrCreateAudio('shayari'); }, 2000);

  injectCustomButtons();
})();
