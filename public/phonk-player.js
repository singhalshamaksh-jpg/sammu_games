(function () {
  let vizTimer = null;
  let userClickedStop = false;
  let currentStyle = null;
  let playToken = 0;

  let audioCtx = null;
  let gainNode = null;
  let activeSource = null;
  const decodedBuffers = {};

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

  function getAudioContext() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
      gainNode = audioCtx.createGain();
      gainNode.gain.value = 0.85;
      gainNode.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function stopCurrentBuffer() {
    if (activeSource) {
      try {
        activeSource.onended = null;
        activeSource.stop(0);
        activeSource.disconnect();
      } catch (e) {}
      activeSource = null;
    }
  }

  async function loadDecodedBuffer(rawUrl) {
    if (decodedBuffers[rawUrl]) return decodedBuffers[rawUrl];
    const ctx = getAudioContext();
    const res = await fetch(encodeURI(rawUrl));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const arrayBuf = await res.arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(arrayBuf);
    decodedBuffers[rawUrl] = audioBuf;
    return audioBuf;
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
      { id: 'loopPasso',     key: 'passo',     text: '👣 Passo Bem Solto',        color: '#4ade80' }
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

  // Keep AudioContext awake on any screen interaction
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

    // Unlock Web Audio immediately inside the tap gesture
    const ctx = getAudioContext();

    if (vizTimer) { clearInterval(vizTimer); vizTimer = null; }
    document.querySelectorAll('.dj-loop-btn').forEach(b => b.classList.remove('active'));

    const btn = document.getElementById(BTN_MAP[style]);
    if (btn) btn.classList.add('active');

    const np = document.getElementById('djNowPlaying');
    const miniLbl = document.getElementById('miniBarTrack');
    if (np) np.textContent = '⏳ Decoding: ' + chosen.label;

    stopCurrentBuffer();

    try {
      const buffer = await loadDecodedBuffer(chosen.url);
      if (myToken !== playToken || userClickedStop) return;

      if (ctx.state === 'suspended') await ctx.resume();

      stopCurrentBuffer();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gainNode);
      source.start(0);
      activeSource = source;

      window._activePhonkLabel = chosen.label;
      if (np) np.textContent = (djName ? '🎧 DJ ' + djName + ': ' : '🔥 LIVE: ') + chosen.label;
      if (miniLbl) miniLbl.textContent = '🎧 ' + chosen.label;

      vizTimer = setInterval(bounceBars, 220);
    } catch (err) {
      console.error('Audio decode error:', err);
      if (np) np.textContent = '❌ Error: ' + err.message;
    }
  }

  function customStop(fromRemote) {
    if (!fromRemote && !userClickedStop && currentStyle) return;

    playToken++;
    userClickedStop = true;
    currentStyle = null;
    if (vizTimer) { clearInterval(vizTimer); vizTimer = null; }

    stopCurrentBuffer();
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

  injectCustomButtons();
})();
