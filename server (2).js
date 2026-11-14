const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { maxHttpBufferSize: 5e6 });
const path = require('path');
const fs = require('fs');

const MAKEUP_STUDIO_WIDGET = `
<style>
  #makeupModal { display:none; position:fixed; inset:0; background:rgba(10,10,20,0.9); z-index:99999; align-items:center; justify-content:center; backdrop-filter:blur(10px); font-family:inherit; }
  #makeupCard { background:linear-gradient(155deg,#231433,#381c4a); border:2px solid #ff75d8; border-radius:22px; padding:16px; width:94%; max-width:410px; color:#fff; box-shadow:0 0 35px rgba(255,117,216,0.45); text-align:center; }
  .mk-tabs { display:flex; gap:6px; justify-content:center; margin:8px 0; flex-wrap:wrap; }
  .mk-btn { background:#432259; border:1px solid #ff75d8; color:#fff; padding:6px 11px; border-radius:12px; cursor:pointer; font-size:12px; font-weight:bold; transition:0.2s; }
  .mk-btn.active, .mk-btn:hover { background:#ff75d8; color:#1b0d26; }
  #makeupCanvas { background:radial-gradient(circle at 50% 35%, #fff8fc, #ffe4f2); border-radius:18px; border:2px solid #ffb8e6; cursor:pointer; max-width:100%; box-shadow:inset 0 0 18px rgba(255,117,216,0.2); }
  .mk-zone-banner { background:rgba(255,117,216,0.18); border:1px solid rgba(255,117,216,0.4); border-radius:10px; padding:5px 10px; font-size:12px; font-weight:bold; color:#ffb8e6; margin:8px 0; }
  .mk-colors { display:flex; gap:7px; flex-wrap:wrap; justify-content:center; margin:8px 0; min-height:28px; }
  .mk-swatch { width:26px; height:26px; border-radius:50%; border:2px solid #fff; cursor:pointer; transition:transform 0.15s; box-shadow:0 2px 6px rgba(0,0,0,0.3); }
  .mk-swatch:hover { transform:scale(1.2); }
  .mk-pill { background:#542970; border:1px solid #ff9de2; color:#fff; padding:4px 10px; border-radius:20px; font-size:11px; cursor:pointer; font-weight:bold; }
  .mk-pill:hover { background:#ff75d8; color:#1b0d26; }
  #skincareModal { display:none; position:fixed; inset:0; background:rgba(8,18,28,0.92); z-index:99999; align-items:center; justify-content:center; backdrop-filter:blur(10px); font-family:inherit; }
  #skincareCard { background:linear-gradient(155deg,#0f2942,#163d5c); border:2px solid #38bdf8; border-radius:22px; padding:16px; width:94%; max-width:410px; color:#fff; box-shadow:0 0 35px rgba(56,189,248,0.45); text-align:center; }
  #skincareCanvas { background:radial-gradient(circle at 50% 40%, #f0f9ff, #bae6fd); border-radius:18px; border:2px solid #7dd3fc; max-width:100%; margin:8px 0; }
  .sk-bottles { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px; }
  .sk-bottle-btn { background:rgba(255,255,255,0.12); border:1.5px solid #7dd3fc; color:#fff; padding:9px 8px; border-radius:14px; cursor:pointer; font-size:12px; font-weight:bold; transition:0.2s; display:flex; align-items:center; justify-content:center; gap:6px; }
  .sk-bottle-btn:hover { background:#38bdf8; color:#082032; transform:translateY(-2px); }
  .sk-bottle-btn.done { background:#10b981; border-color:#6ee7b7; color:#fff; pointer-events:none; opacity:0.85; }
</style>
<div id="makeupModal">
  <div id="makeupCard">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span style="font-weight:bold;font-size:16px;color:#ff9de2;">💄 Interactive Doll & Nail Salon</span>
      <button onclick="document.getElementById('makeupModal').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:8px;padding:4px 10px;cursor:pointer;font-weight:bold;">✕</button>
    </div>
    <div class="mk-tabs">
      <button class="mk-btn active" id="modeDollBtn" onclick="setMakeupMode('doll')">👩 Doll Makeover</button>
      <button class="mk-btn" id="modeNailBtn" onclick="setMakeupMode('nails')">💅 Nail Art Salon</button>
    </div>
    <div class="mk-zone-banner" id="zonePrompt">👆 Tap Hair, Brows, Eyes, Cheeks, Lips, or Head on the Doll!</div>
    <canvas id="makeupCanvas" width="320" height="330"></canvas>
    <div class="mk-colors" id="zoneOptions"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;">
      <button class="mk-btn" onclick="resetMakeupState()">🔄 Reset</button>
      <button class="mk-btn" style="background:linear-gradient(90deg,#ff6ec7,#a855f7);border:none;padding:7px 14px;" onclick="postMakeupToChat()">📤 Upload to Chat</button>
    </div>
  </div>
</div>
<div id="skincareModal">
  <div id="skincareCard">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span style="font-weight:bold;font-size:16px;color:#7dd3fc;">🩺 Doctor Skincare Clinic</span>
      <button onclick="document.getElementById('skincareModal').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:8px;padding:4px 10px;cursor:pointer;font-weight:bold;">✕</button>
    </div>
    <div id="skDiagnosisBanner" style="background:rgba(56,189,248,0.18);border:1px solid rgba(56,189,248,0.4);border-radius:10px;padding:6px 10px;font-size:12px;color:#e0f2fe;margin-top:8px;">Waiting for Dr. Skincare...</div>
    <canvas id="skincareCanvas" width="280" height="220"></canvas>
    <div id="skStepStatus" style="font-size:12px;font-weight:bold;color:#fde047;margin-bottom:4px;">Tap the bottles in order (Step 1/4)</div>
    <div class="sk-bottles" id="skBottleGrid"></div>
  </div>
</div>
<script>
(function() {
  let mkMode = 'doll', activeZone = 'lips', selectedNail = 0;
  const defaultDoll = {
    hairColor: '#2d1b2e', browColor: '#2d1b2e', eyeshadow: null,
    mascara: false, eyeColor: '#4c1d95', blush: null,
    lipColor: '#f48fb1', lipGloss: true, accessory: null
  };
  const defaultNails = {
    colors: new Array('#fff0f5', '#fff0f5', '#fff0f5', '#fff0f5', '#fff0f5'),
    glitter: new Array(false, false, false, false, false),
    gem: new Array(false, false, false, false, false)
  };
  let doll = JSON.parse(JSON.stringify(defaultDoll));
  let nails = JSON.parse(JSON.stringify(defaultNails));

  const zoneConfigs = {
    hair: { label: '💇‍♀️ Hair Color Studio:', colors: new Array('#2d1b2e', '#6d28d9', '#ec4899', '#f59e0b', '#dc2626', '#92400e', '#ffffff', '#06b6d4') },
    brows: { label: '🤨 Eyebrow Tint:', colors: new Array('#1f2937', '#451a03', '#78350f', '#9a3412', '#6b7280') },
    eyes: {
      label: '👁️ Eye Glam:',
      colors: new Array('#d946ef', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#ffffff'),
      extras: new Array(
        { text: '✨ Toggle Mascara', action: () => { doll.mascara = !doll.mascara; renderStudio(); } },
        { text: '👀 Switch Lens', action: () => {
          const lenses = new Array('#4c1d95', '#0284c7', '#059669', '#92400e', '#db2777');
          doll.eyeColor = lenses.at((lenses.indexOf(doll.eyeColor) + 1) % lenses.length);
          renderStudio();
        }}
      )
    },
    cheeks: { label: '🌸 Cheek Blush:', colors: new Array('#fb7185', '#f472b6', '#fda4af', '#fb923c', '#e879f9') },
    lips: {
      label: '💋 Lipstick Bar:',
      colors: new Array('#e11d48', '#db2777', '#ff4d6d', '#9d174d', '#f97316', '#c026d3', '#be123c', '#f48fb1'),
      extras: new Array({ text: '✨ Toggle Gloss', action: () => { doll.lipGloss = !doll.lipGloss; renderStudio(); } })
    },
    head: {
      label: '👑 Accessories:', colors: new Array(),
      extras: new Array(
        { text: '👑 Tiara', action: () => { doll.accessory = '👑'; renderStudio(); } },
        { text: '🌸 Flower', action: () => { doll.accessory = '🌸'; renderStudio(); } },
        { text: '🐱 Cat Ears', action: () => { doll.accessory = '🐱'; renderStudio(); } },
        { text: '🎀 Bow', action: () => { doll.accessory = '🎀'; renderStudio(); } },
        { text: '❌ None', action: () => { doll.accessory = null; renderStudio(); } }
      )
    }
  };
  function injectWhiteIntoDrawPad() {
    if (document.getElementById('drawWhiteSwatch')) return;
    const onclickSwatches = Array.from(document.querySelectorAll('[onclick*="Color"], [onclick*="color"], [onclick*="brush"], [onclick*="Brush"]'));
    let lastSwatch = onclickSwatches.at(-1);
    if (!lastSwatch) {
      const candidates = Array.from(document.querySelectorAll('div, span, button')).filter(el => {
        const bg = el.style && (el.style.background || el.style.backgroundColor);
        return bg && bg !== 'transparent' && el.parentElement && el.parentElement.children.length >= 15 && el.parentElement.children.length <= 25;
      });
      if (candidates.length > 0) lastSwatch = candidates.at(-1);
    }
    if (lastSwatch && lastSwatch.parentElement) {
      const whiteBtn = lastSwatch.cloneNode(true);
      whiteBtn.id = 'drawWhiteSwatch';
      whiteBtn.style.background = '#ffffff'; whiteBtn.style.backgroundColor = '#ffffff';
      whiteBtn.style.border = '2px solid #9ca3af'; whiteBtn.title = 'White (#ffffff)';
      const oc = lastSwatch.getAttribute('onclick') || '';
      if (oc) {
        const fnMatch = oc.match(/^([a-zA-Z0-9_$.]+)/);
        whiteBtn.setAttribute('onclick', fnMatch ? fnMatch.at(1) + "('#ffffff', this)" : "setColor('#ffffff', this)");
      }
      whiteBtn.addEventListener('click', () => {
        if (typeof window.setDrawColor === 'function') window.setDrawColor('#ffffff', whiteBtn);
        else if (typeof window.setColor === 'function') window.setColor('#ffffff', whiteBtn);
        else if (typeof window.changeColor === 'function') window.changeColor('#ffffff', whiteBtn);
        if ('currentColor' in window) window.currentColor = '#ffffff';
        if ('drawColor' in window) window.drawColor = '#ffffff';
        if ('brushColor' in window) window.brushColor = '#ffffff';
      });
      lastSwatch.parentElement.appendChild(whiteBtn);
    }
  }

  function initMakeupButton() {
    injectWhiteIntoDrawPad();
    const allBtns = Array.from(document.querySelectorAll('button, a, div[onclick]'));
    const jamBtn = allBtns.find(el => el.children.length === 0 && /jam|🎹/i.test(el.textContent || ''));
    if (jamBtn && !document.getElementById('openMakeupBtn')) {
      const mkBtn = jamBtn.cloneNode(true);
      mkBtn.id = 'openMakeupBtn'; mkBtn.removeAttribute('onclick'); mkBtn.textContent = '💄 Makeup';
      mkBtn.onclick = function(e) {
        e.preventDefault(); e.stopPropagation();
        document.getElementById('makeupModal').style.display = 'flex';
        if (!window._mkReady) { setupInteractiveSalon(); window._mkReady = true; }
      };
      jamBtn.parentNode.insertBefore(mkBtn, jamBtn.nextSibling);
    }
  }

  window.addEventListener('DOMContentLoaded', () => { initMakeupButton(); setTimeout(initMakeupButton, 1200); setTimeout(injectWhiteIntoDrawPad, 2000); });

  function setupInteractiveSalon() {
    const canvas = document.getElementById('makeupCanvas');
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      if (mkMode === 'doll') {
        if (y < 95) selectDollZone('head');
        else if (x < 95 || x > 225) selectDollZone('hair');
        else if (y >= 122 && y <= 145) selectDollZone('brows');
        else if (y > 145 && y <= 172) selectDollZone('eyes');
        else if (y > 172 && y <= 194 && (x < 145 || x > 175)) selectDollZone('cheeks');
        else if (y > 192 && y <= 225) selectDollZone('lips');
        else selectDollZone('hair');
      } else {
        const nailXs = new Array(52, 106, 160, 214, 268);
        let closest = 0, minDist = 999;
        nailXs.forEach((nx, i) => { const d = Math.abs(x - nx); if (d < minDist) { minDist = d; closest = i; } });
        selectedNail = closest; renderNailControls(); renderStudio();
      }
    });
    selectDollZone('lips'); renderStudio();
  }
  function selectDollZone(zone) {
    activeZone = zone; const cfg = zoneConfigs[zone];
    document.getElementById('zonePrompt').textContent = cfg.label;
    const box = document.getElementById('zoneOptions'); box.innerHTML = '';
    cfg.colors.forEach(hex => {
      const s = document.createElement('div'); s.className = 'mk-swatch'; s.style.background = hex;
      s.onclick = () => {
        if (zone === 'hair') doll.hairColor = hex; if (zone === 'brows') doll.browColor = hex;
        if (zone === 'eyes') doll.eyeshadow = hex; if (zone === 'cheeks') doll.blush = hex;
        if (zone === 'lips') doll.lipColor = hex; renderStudio();
      };
      box.appendChild(s);
    });
    if (cfg.extras) cfg.extras.forEach(ex => {
      const b = document.createElement('button'); b.className = 'mk-pill'; b.textContent = ex.text; b.onclick = ex.action; box.appendChild(b);
    });
  }

  function renderNailControls() {
    const names = new Array('Pinky Nail', 'Ring Finger', 'Middle Finger', 'Index Finger', 'Thumb Nail');
    document.getElementById('zonePrompt').textContent = '💅 Painting: ' + names.at(selectedNail);
    const box = document.getElementById('zoneOptions'); box.innerHTML = '';
    const nailColors = new Array('#ff1e56', '#ff75d8', '#a855f7', '#3b82f6', '#06b6d4', '#10b981', '#fbbf24', '#111827', '#ffffff');
    nailColors.forEach(hex => {
      const s = document.createElement('div'); s.className = 'mk-swatch'; s.style.background = hex;
      s.onclick = () => { nails.colors[selectedNail] = hex; renderStudio(); }; box.appendChild(s);
    });
    const glitterBtn = document.createElement('button'); glitterBtn.className = 'mk-pill'; glitterBtn.textContent = '✨ Glitter';
    glitterBtn.onclick = () => { nails.glitter[selectedNail] = !nails.glitter[selectedNail]; renderStudio(); }; box.appendChild(glitterBtn);
    const gemBtn = document.createElement('button'); gemBtn.className = 'mk-pill'; gemBtn.textContent = '💎 Gem';
    gemBtn.onclick = () => { nails.gem[selectedNail] = !nails.gem[selectedNail]; renderStudio(); }; box.appendChild(gemBtn);
    const allBtn = document.createElement('button'); allBtn.className = 'mk-pill'; allBtn.textContent = '🎨 All 5';
    allBtn.onclick = () => { const c = nails.colors.at(selectedNail); nails.colors = new Array(c, c, c, c, c); renderStudio(); }; box.appendChild(allBtn);
  }

  function renderStudio() {
    const canvas = document.getElementById('makeupCanvas'), ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#ffeaf5'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (mkMode === 'doll') {
      ctx.fillStyle = doll.hairColor; ctx.beginPath(); ctx.ellipse(160, 175, 96, 120, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fdd5b1'; ctx.fillRect(138, 232, 44, 48);
      ctx.fillStyle = '#ff6ec7'; ctx.beginPath(); ctx.ellipse(160, 305, 88, 40, 0, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe2c8'; ctx.beginPath(); ctx.ellipse(160, 165, 66, 80, 0, 0, Math.PI * 2); ctx.fill();
      if (doll.blush) { ctx.save(); ctx.globalAlpha = 0.38; ctx.fillStyle = doll.blush; ctx.beginPath(); ctx.ellipse(122, 182, 16, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(198, 182, 16, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      if (doll.eyeshadow) { ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = doll.eyeshadow; ctx.beginPath(); ctx.ellipse(134, 152, 18, 11, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(186, 152, 18, 11, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.restore(); }
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(134, 156, 14, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(186, 156, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = doll.eyeColor; ctx.beginPath(); ctx.arc(134, 156, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(186, 156, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.arc(134, 156, 3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(186, 156, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(131.5, 153.5, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(183.5, 153.5, 2.2, 0, Math.PI * 2); ctx.fill();
      if (doll.mascara) {
        ctx.strokeStyle = '#111827'; ctx.lineWidth = 2.4;
        const eyeXs = new Array(134, 186);
        eyeXs.forEach((ex, side) => {
          ctx.beginPath(); ctx.ellipse(ex, 156, 14.5, 9.2, 0, Math.PI, Math.PI * 2); ctx.stroke();
          for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(ex + i * 4, 147); ctx.lineTo(ex + i * 5.5 + (side === 0 ? -2 : 2), 141); ctx.stroke(); }
        });
      }
      ctx.strokeStyle = doll.browColor; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(118, 138); ctx.quadraticCurveTo(134, 131, 149, 138); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(171, 138); ctx.quadraticCurveTo(186, 131, 202, 138); ctx.stroke();
      ctx.strokeStyle = '#d49a73'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(160, 164); ctx.lineTo(157, 179); ctx.lineTo(163, 181); ctx.stroke();
      ctx.fillStyle = doll.lipColor; ctx.beginPath(); ctx.moveTo(143, 204); ctx.quadraticCurveTo(153, 196, 160, 200); ctx.quadraticCurveTo(167, 196, 177, 204); ctx.quadraticCurveTo(160, 216, 143, 204); ctx.fill();
      if (doll.lipGloss) { ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.beginPath(); ctx.ellipse(156, 206, 6, 2, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = doll.hairColor; ctx.beginPath(); ctx.arc(160, 126, 68, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
      if (doll.accessory) { ctx.font = '42px serif'; ctx.textAlign = 'center'; ctx.fillText(doll.accessory, 160, 72); }
    } else {
      ctx.fillStyle = '#ffe2c8'; ctx.beginPath(); ctx.roundRect(35, 180, 250, 150, 45); ctx.fill();
      const fingers = new Array({ x: 52, y: 118, h: 92 }, { x: 106, y: 86, h: 118 }, { x: 160, y: 72, h: 128 }, { x: 214, y: 88, h: 115 }, { x: 268, y: 122, h: 88 });
      fingers.forEach((f, idx) => {
        ctx.fillStyle = '#ffe2c8'; ctx.beginPath(); ctx.roundRect(f.x - 18, f.y, 36, f.h, 18); ctx.fill();
        ctx.fillStyle = nails.colors.at(idx); ctx.strokeStyle = idx === selectedNail ? '#ff1e56' : '#f9a8d4'; ctx.lineWidth = idx === selectedNail ? 3 : 1.5;
        ctx.beginPath(); ctx.roundRect(f.x - 12, f.y + 6, 24, 36, 12); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(f.x - 5, f.y + 18, 2.5, 8, 0.2, 0, Math.PI * 2); ctx.fill();
        if (nails.glitter.at(idx)) { ctx.font = '12px serif'; ctx.textAlign = 'center'; ctx.fillText('✨', f.x + 2, f.y + 28); }
        if (nails.gem.at(idx)) { ctx.font = '13px serif'; ctx.textAlign = 'center'; ctx.fillText('💎', f.x, f.y + 34); }
      });
    }
  }
  window.setMakeupMode = function(mode) { mkMode = mode; document.getElementById('modeDollBtn').classList.toggle('active', mode === 'doll'); document.getElementById('modeNailBtn').classList.toggle('active', mode === 'nails'); if (mode === 'doll') selectDollZone(activeZone); else renderNailControls(); renderStudio(); };
  window.resetMakeupState = function() { doll = JSON.parse(JSON.stringify(defaultDoll)); nails = JSON.parse(JSON.stringify(defaultNails)); setMakeupMode(mkMode); };
  window.postMakeupToChat = function() {
    const srcCanvas = document.getElementById('makeupCanvas'), outCanvas = document.createElement('canvas'); outCanvas.width = 300; outCanvas.height = 310;
    outCanvas.getContext('2d').drawImage(srcCanvas, 0, 0, 300, 310);
    const imgData = outCanvas.toDataURL('image/jpeg', 0.85);
    const storedName = localStorage.getItem('sammu_username') || localStorage.getItem('username') || '';
    const storedAvatar = localStorage.getItem('sammu_avatar') || localStorage.getItem('avatar') || '💄';
    if (typeof socket !== 'undefined') {
      socket.emit('chatImage', { image: imgData, caption: mkMode === 'nails' ? '💅 My Nail Salon Art!' : '💄 My Doll Makeover Look!', username: storedName, avatar: storedAvatar });
      socket.emit('makeupCompleted', { mode: mkMode });
    }
    document.getElementById('makeupModal').style.display = 'none';
  };
})();
(function() {
  let skData = null, myStep = 0;
  function renderPatientFace(cleanLevel, skinType) {
    const canvas = document.getElementById('skincareCanvas'); if (!canvas) return;
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#3b2314'; ctx.beginPath(); ctx.ellipse(140, 115, 72, 85, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fdd5b1'; ctx.fillRect(122, 165, 36, 35);
    ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.ellipse(140, 215, 68, 28, 0, Math.PI, Math.PI * 2); ctx.fill();
    const tones = new Array('#e5b592', '#f1c6a7', '#fad7bd', '#ffe4cf', '#fff0e5');
    ctx.fillStyle = tones.at(Math.min(4, cleanLevel)); ctx.beginPath(); ctx.ellipse(140, 112, 52, 64, 0, 0, Math.PI * 2); ctx.fill();
    if (cleanLevel < 4) {
      ctx.save(); ctx.globalAlpha = 1 - (cleanLevel * 0.25);
      if (skinType.includes('Oily')) {
        ctx.fillStyle = '#ef4444';
        const spots = new Array({ x: 115, y: 118 }, { x: 165, y: 118 }, { x: 140, y: 92 }, { x: 125, y: 136 }, { x: 155, y: 136 });
        spots.forEach(pt => { ctx.beginPath(); ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2); ctx.fill(); });
      }
      else if (skinType.includes('Dry')) { ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(108, 122); ctx.lineTo(118, 128); ctx.moveTo(162, 122); ctx.lineTo(172, 128); ctx.stroke(); }
      else { ctx.fillStyle = 'rgba(146, 64, 14, 0.25)'; ctx.beginPath(); ctx.ellipse(140, 115, 42, 50, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.arc(120, 106, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(160, 106, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#be123c'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(140, 134, 12, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    if (cleanLevel >= 4) { ctx.font = '20px serif'; ctx.fillText('✨', 85, 75); ctx.fillText('✨', 180, 75); ctx.fillText('💖', 132, 42); }
  }
  function bindSkincareSocket() {
    if (typeof socket === 'undefined' || window._skBound) return; window._skBound = true;
    socket.on('openSkincareClinic', (data) => {
      skData = data; myStep = 0; document.getElementById('skincareModal').style.display = 'flex';
      document.getElementById('skDiagnosisBanner').innerHTML = '🩺 <b>Dr. ' + data.doctor + '</b> | Diagnosis: <b>' + data.skinType + '</b><br>Order: ' + data.steps.join(' ➔ ');
      document.getElementById('skStepStatus').textContent = 'Tap Bottle #1: ' + data.steps.at(0);
      const grid = document.getElementById('skBottleGrid'); grid.innerHTML = '';
      const icons = new Array('🫧', '💧', '🧴', '☀️');
      data.steps.map((name, idx) => ({ name, idx, icon: icons.at(idx) })).sort(() => Math.random() - 0.5).forEach(item => {
        const btn = document.createElement('button'); btn.className = 'sk-bottle-btn'; btn.innerHTML = item.icon + ' ' + item.name;
        btn.onclick = () => {
          if (!skData || item.idx !== myStep) { document.getElementById('skStepStatus').textContent = '❌ Wrong order! Need: ' + skData.steps.at(myStep); return; }
          myStep++; btn.classList.add('done'); renderPatientFace(myStep, skData.skinType);
          if (myStep >= 4) { document.getElementById('skStepStatus').textContent = '✨ GLASS SKIN ACHIEVED! Claiming Trophy...'; socket.emit('skincareStepComplete', { step: 4 }); }
          else { document.getElementById('skStepStatus').textContent = '✅ Applied! Next: ' + skData.steps.at(myStep); }
        };
        grid.appendChild(btn);
      });
      renderPatientFace(0, data.skinType);
    });
    socket.on('closeSkincareClinic', () => { document.getElementById('skincareModal').style.display = 'none'; });
  }
  window.addEventListener('DOMContentLoaded', () => { bindSkincareSocket(); setTimeout(bindSkincareSocket, 1000); });
})();
</script>
`;
const DIDI_PROMO_WIDGET = `
<script>
(function() {
  let inArena = false;
  function bindPromoSocket() {
    if (typeof socket === 'undefined' || window._promoBound) return;
    window._promoBound = true;
    socket.on('toggleDidiPromo', (show) => {
      const box = document.getElementById('didiPromoBox');
      if (box && !inArena) box.style.display = show ? 'block' : 'none';
    });
    socket.on('initRole', () => {
      inArena = true;
      const box = document.getElementById('didiPromoBox');
      if (box) box.style.display = 'none';
    });
  }
  window.addEventListener('DOMContentLoaded', () => { bindPromoSocket(); setTimeout(bindPromoSocket, 800); });
})();
</script>
`;
const MASTERCHEF_STUDIO_WIDGET = `
<style>
  #chefModal { display:none; position:fixed; inset:0; background:rgba(15,10,5,0.92); z-index:99999; align-items:center; justify-content:center; backdrop-filter:blur(10px); font-family:inherit; }
  #chefCard { background:linear-gradient(155deg,#2b1608,#4a250d); border:2px solid #f59e0b; border-radius:22px; padding:16px; width:94%; max-width:410px; color:#fff; box-shadow:0 0 35px rgba(245,158,11,0.45); text-align:center; }
  .cf-tabs { display:flex; gap:6px; justify-content:center; margin:8px 0; flex-wrap:wrap; }
  .cf-btn { background:#5c2d0c; border:1px solid #f59e0b; color:#fff; padding:6px 11px; border-radius:12px; cursor:pointer; font-size:12px; font-weight:bold; transition:0.2s; }
  .cf-btn.active, .cf-btn:hover { background:#f59e0b; color:#1f0d02; }
  #chefCanvas { background:radial-gradient(circle at 50% 45%, #fffbeb, #fde68a); border-radius:18px; border:2px solid #fcd34d; cursor:crosshair; max-width:100%; box-shadow:inset 0 0 18px rgba(245,158,11,0.25); }
  .cf-banner { background:rgba(245,158,11,0.18); border:1px solid rgba(245,158,11,0.4); border-radius:10px; padding:5px 10px; font-size:12px; font-weight:bold; color:#fde68a; margin:8px 0; }
  .cf-row { display:flex; gap:6px; flex-wrap:wrap; justify-content:center; margin:7px 0; }
  .cf-pill { background:#6e3610; border:1px solid #fbbf24; color:#fff; padding:5px 10px; border-radius:18px; font-size:12px; cursor:pointer; font-weight:bold; transition:0.15s; }
  .cf-pill.selected, .cf-pill:hover { background:#fbbf24; color:#1f0d02; transform:scale(1.08); }
</style>
<div id="chefModal">
  <div id="chefCard">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span style="font-weight:bold;font-size:16px;color:#fbbf24;">👨‍🍳 MasterChef Kitchen Studio</span>
      <button onclick="document.getElementById('chefModal').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:8px;padding:4px 10px;cursor:pointer;font-weight:bold;">✕</button>
    </div>
    <div class="cf-tabs">
      <button class="cf-btn active" id="modePizzaBtn" onclick="setChefMode('pizza')">🍕 Pizza Maker</button>
      <button class="cf-btn" id="modeCakeBtn" onclick="setChefMode('cake')">🎂 Cake Bakery</button>
    </div>
    <div class="cf-banner">👆 Pick a sauce/frosting, then tap anywhere on the dish to add toppings!</div>
    <canvas id="chefCanvas" width="310" height="290"></canvas>
    <div class="cf-row" id="chefBaseRow"></div>
    <div class="cf-row" id="chefToppingRow"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;">
      <button class="cf-btn" onclick="resetChefDish()">🔄 Clear Dish</button>
      <button class="cf-btn" style="background:linear-gradient(90deg,#f59e0b,#ef4444);border:none;padding:7px 14px;color:#fff;" onclick="serveDishToChat()">🍽️ Serve to Chat</button>
    </div>
  </div>
</div>
<script>
(function() {
  let cfMode = 'pizza', selectedTopping = '🍄';
  let dishState = { baseColor: '#dc2626', items: new Array() };
  const configs = {
    pizza: {
      bases: new Array({ label: '🍅 Marinara', color: '#dc2626' }, { label: '🧀 Extra Cheese', color: '#facc15' }, { label: '🌿 Pesto', color: '#16a34a' }, { label: '🔥 Peri-Peri', color: '#ea580c' }),
      toppings: new Array('🍄', '🌶️', '🫒', '🍍', '🧅', '🍅', '🌽', '🍗', '🧀', '🌿')
    },
    cake: {
      bases: new Array({ label: '🍓 Strawberry', color: '#f472b6' }, { label: '🍫 Chocolate', color: '#5c2d16' }, { label: '🍦 Vanilla', color: '#fef3c7' }, { label: '🫐 Blueberry', color: '#6366f1' }),
      toppings: new Array('🍓', '🍒', '🍫', '🍪', '🕯️', '✨', '💖', '🍬', '🥭', '🌸')
    }
  };
  function initChefButton() {
    const allBtns = Array.from(document.querySelectorAll('button, a, div[onclick]'));
    const anchorBtn = allBtns.find(el => el.id === 'openMakeupBtn') || allBtns.find(el => el.children.length === 0 && /jam|🎹/i.test(el.textContent || ''));
    if (anchorBtn && !document.getElementById('openChefBtn')) {
      const cfBtn = anchorBtn.cloneNode(true); cfBtn.id = 'openChefBtn'; cfBtn.removeAttribute('onclick'); cfBtn.textContent = '🍕 Cook';
      cfBtn.onclick = function(e) { e.preventDefault(); e.stopPropagation(); document.getElementById('chefModal').style.display = 'flex'; if (!window._cfReady) { setupChefCanvas(); window._cfReady = true; } };
      anchorBtn.parentNode.insertBefore(cfBtn, anchorBtn.nextSibling);
    }
  }
  function setupChefCanvas() {
    const canvas = document.getElementById('chefCanvas');
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width), y = (e.clientY - rect.top) * (canvas.height / rect.height);
      if (Math.hypot(x - 155, y - 145) <= 105) { dishState.items.push({ emoji: selectedTopping, x, y, rot: (Math.random() - 0.5) * 0.6 }); renderChefDish(); }
    });
    setChefMode('pizza');
  }
  function renderChefControls() {
    const cfg = configs[cfMode], baseRow = document.getElementById('chefBaseRow'), topRow = document.getElementById('chefToppingRow');
    baseRow.innerHTML = ''; topRow.innerHTML = '';
    cfg.bases.forEach(b => {
      const btn = document.createElement('button'); btn.className = 'cf-pill' + (dishState.baseColor === b.color ? ' selected' : ''); btn.textContent = b.label;
      btn.onclick = () => { dishState.baseColor = b.color; renderChefControls(); renderChefDish(); }; baseRow.appendChild(btn);
    });
    cfg.toppings.forEach(emoji => {
      const btn = document.createElement('button'); btn.className = 'cf-pill' + (selectedTopping === emoji ? ' selected' : ''); btn.textContent = emoji;
      btn.onclick = () => { selectedTopping = emoji; renderChefControls(); }; topRow.appendChild(btn);
    });
  }
  function renderChefDish() {
    const canvas = document.getElementById('chefCanvas'), ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(155, 145, 132, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 4; ctx.stroke();
    if (cfMode === 'pizza') {
      ctx.fillStyle = '#d97706'; ctx.beginPath(); ctx.arc(155, 145, 118, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = dishState.baseColor; ctx.beginPath(); ctx.arc(155, 145, 102, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(254, 240, 138, 0.55)'; ctx.beginPath(); ctx.arc(155, 145, 95, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = dishState.baseColor; ctx.beginPath(); ctx.arc(155, 145, 114, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.stroke();
    }
    ctx.font = '26px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    dishState.items.forEach(it => { ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot); ctx.fillText(it.emoji, 0, 0); ctx.restore(); });
  }
  window.setChefMode = function(mode) { cfMode = mode; document.getElementById('modePizzaBtn').classList.toggle('active', mode === 'pizza'); document.getElementById('modeCakeBtn').classList.toggle('active', mode === 'cake'); dishState = { baseColor: configs[mode].bases.at(0).color, items: new Array() }; selectedTopping = configs[mode].toppings.at(0); renderChefControls(); renderChefDish(); };
  window.resetChefDish = function() { dishState.items = new Array(); renderChefDish(); };
  window.serveDishToChat = function() {
    const srcCanvas = document.getElementById('chefCanvas'), outCanvas = document.createElement('canvas'); outCanvas.width = 300; outCanvas.height = 280;
    outCanvas.getContext('2d').drawImage(srcCanvas, 0, 0, 300, 280);
    const imgData = outCanvas.toDataURL('image/jpeg', 0.85);
    const storedName = localStorage.getItem('sammu_username') || localStorage.getItem('username') || '';
    const storedAvatar = localStorage.getItem('sammu_avatar') || localStorage.getItem('avatar') || '👨‍🍳';
    if (typeof socket !== 'undefined') {
      socket.emit('chatImage', { image: imgData, caption: cfMode === 'cake' ? '🎂 Freshly Baked Custom Cake!' : '🍕 Hot Custom MasterChef Pizza!', username: storedName, avatar: storedAvatar });
      socket.emit('dishCompleted', { mode: cfMode, count: dishState.items.length });
    }
    document.getElementById('chefModal').style.display = 'none';
  };
  window.addEventListener('DOMContentLoaded', () => { initChefButton(); setTimeout(initChefButton, 1400); });
})();
</script>
`;
const NEW_ARENAS_WIDGET = `
<style>
  .mega-modal { display:none; position:fixed; inset:0; background:rgba(8,10,20,0.92); z-index:99998; align-items:center; justify-content:center; backdrop-filter:blur(10px); font-family:inherit; }
  .mega-card { background:linear-gradient(155deg,#131b36,#1e293b); border:2px solid #38bdf8; border-radius:22px; padding:18px; width:94%; max-width:420px; color:#fff; box-shadow:0 0 35px rgba(56,189,248,0.45); text-align:center; }
  #fruitCanvas { background:radial-gradient(circle at 50% 30%, #1e293b, #0f172a); border-radius:16px; border:2px solid #38bdf8; cursor:pointer; max-width:100%; touch-action:manipulation; }
  #reflexBox { width:100%; height:190px; border-radius:18px; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:900; cursor:pointer; user-select:none; margin:12px 0; transition:0.1s; border:3px solid rgba(255,255,255,0.2); }
  #hoopTrack { width:100%; height:36px; background:#0f172a; border-radius:18px; border:2px solid #f97316; position:relative; overflow:hidden; margin:14px 0; }
  #hoopZone { position:absolute; left:42%; width:16%; height:100%; background:#22c55e; box-shadow:0 0 15px #22c55e; }
  #hoopCursor { position:absolute; left:0%; width:14px; height:100%; background:#fbbf24; border-radius:6px; box-shadow:0 0 10px #fbbf24; }
</style>
<div id="fruitModal" class="mega-modal"><div class="mega-card" style="border-color:#22c55e;"><div style="font-weight:900;font-size:17px;color:#4ade80;">🗡️ 22. FRUIT NINJA BLITZ</div><div id="fruitScoreBar" style="font-size:13px;font-weight:bold;margin:6px 0;color:#fde047;">Tap fruits! Avoid 💣 Bombs!</div><canvas id="fruitCanvas" width="320" height="280"></canvas></div></div>
<div id="reflexModal" class="mega-modal"><div class="mega-card" style="border-color:#eab308;"><div style="font-weight:900;font-size:17px;color:#facc15;">⚡ 23. LIGHTNING REFLEX DUEL</div><div style="font-size:12px;color:#cbd5e1;margin-top:4px;">Wait for GREEN, then TAP immediately!</div><div id="reflexBox" style="background:#dc2626;" onclick="tapReflexBox()">WAIT FOR GREEN... 🛑</div></div></div>
<div id="hoopModal" class="mega-modal"><div class="mega-card" style="border-color:#f97316;"><div style="font-weight:900;font-size:17px;color:#fb923c;">🏀 24. HOOP SHOOTOUT</div><div style="font-size:12px;color:#fde047;margin-top:4px;">Stop the bar inside the GREEN zone!</div><div style="font-size:48px;margin:8px 0;">🏀 ➔ 🥅</div><div id="hoopTrack"><div id="hoopZone"></div><div id="hoopCursor"></div></div><button onclick="shootHoopBtn()" style="background:linear-gradient(90deg,#f97316,#ef4444);border:none;color:#fff;font-weight:900;font-size:16px;padding:12px 28px;border-radius:16px;cursor:pointer;width:100%;">🔥 SHOOT BALL!</button></div></div>
<script>
(function() {
  let fruitItems = new Array(), fruitLoop = null, myFruitScore = 0, hoopPos = 0, hoopDir = 1, hoopAnimId = null;
  function playMemeSfx(type) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)(), osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination); const now = ctx.currentTime;
      if (type === 'airhorn') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(480, now); osc.frequency.exponentialRampToValueAtTime(520, now + 0.45); gain.gain.setValueAtTime(0.25, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5); osc.start(now); osc.stop(now + 0.5); }
      else { osc.type = 'triangle'; osc.frequency.setValueAtTime(160, now); osc.frequency.exponentialRampToValueAtTime(75, now + 0.55); gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6); osc.start(now); osc.stop(now + 0.6); }
    } catch (e) {}
  }
  function injectHostGamesAndSfx() {
    const allBtns = Array.from(document.querySelectorAll('button'));
    const targetSniperBtn = allBtns.find(b => /target sniper/i.test(b.textContent || ''));
    if (targetSniperBtn && targetSniperBtn.parentElement && !document.getElementById('btnLaunchFruit')) {
      const parent = targetSniperBtn.parentElement;
      const newGames = new Array({ id: 'btnLaunchFruit', label: '22. 🗡️ Fruit Slash', ev: 'launchFruit' }, { id: 'btnLaunchReflex', label: '23. ⚡ Lightning Reflex', ev: 'launchReflex' }, { id: 'btnLaunchHoop', label: '24. 🏀 Hoop Shootout', ev: 'launchHoop' });
      newGames.forEach(g => {
        const clone = targetSniperBtn.cloneNode(true); clone.id = g.id; clone.removeAttribute('onclick'); clone.textContent = g.label;
        clone.onclick = () => { if (typeof socket !== 'undefined') socket.emit(g.ev); }; parent.appendChild(clone);
      });
    }
    const chefBtn = document.getElementById('openChefBtn') || document.getElementById('openMakeupBtn');
    if (chefBtn && chefBtn.parentElement && !document.getElementById('memeHornBtn')) {
      const hornBtn = chefBtn.cloneNode(true); hornBtn.id = 'memeHornBtn'; hornBtn.removeAttribute('onclick'); hornBtn.textContent = '📯 Horn';
      hornBtn.onclick = () => { if (typeof socket !== 'undefined') socket.emit('triggerMemeSfx', 'airhorn'); };
      chefBtn.parentElement.insertBefore(hornBtn, chefBtn.nextSibling);
    }
  }
  function startFruitLoop() {
    const canvas = document.getElementById('fruitCanvas'), ctx = canvas.getContext('2d'), pool = new Array('🍉', '🍎', '🍍', '🍓', '🍊', '💣');
    fruitItems = new Array(); myFruitScore = 0; if (fruitLoop) clearInterval(fruitLoop);
    fruitLoop = setInterval(() => {
      if (Math.random() < 0.22) { const icon = pool.at(Math.floor(Math.random() * pool.length)); fruitItems.push({ icon, x: Math.random() * 250 + 35, y: 290, vx: (Math.random() - 0.5) * 3.5, vy: -(Math.random() * 4 + 7.5), g: 0.24 }); }
      ctx.clearRect(0, 0, 320, 280); ctx.font = '34px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      fruitItems.forEach(it => { it.x += it.vx; it.y += it.vy; it.vy += it.g; ctx.fillText(it.icon, it.x, it.y); });
      fruitItems = fruitItems.filter(it => it.y < 310);
    }, 30);
    canvas.onclick = (e) => {
      const rect = canvas.getBoundingClientRect(), cx = (e.clientX - rect.left) * (320 / rect.width), cy = (e.clientY - rect.top) * (280 / rect.height);
      for (let i = fruitItems.length - 1; i >= 0; i--) {
        const it = fruitItems.at(i);
        if (Math.hypot(cx - it.x, cy - it.y) < 34) {
          fruitItems.splice(i, 1);
          if (it.icon === '💣') { myFruitScore = Math.max(0, myFruitScore - 3); playMemeSfx('bruh'); } else { myFruitScore++; }
          document.getElementById('fruitScoreBar').textContent = 'Your Score: ' + myFruitScore + ' pts! (First to 10 wins!)';
          if (typeof socket !== 'undefined') socket.emit('fruitScoreTick', myFruitScore); break;
        }
      }
    };
  }
  window.tapReflexBox = function() { if (typeof socket !== 'undefined') socket.emit('reflexTap'); };
  window.shootHoopBtn = function() { if (typeof socket !== 'undefined') socket.emit('hoopShoot', hoopPos); };
  function bindMegaSockets() {
    if (typeof socket === 'undefined' || window._megaBound) return; window._megaBound = true;
    socket.on('playMemeSfx', (type) => playMemeSfx(type));
    socket.on('syncGame', (gd) => {
      document.getElementById('fruitModal').style.display = (gd.gameState === 'fruit') ? 'flex' : 'none';
      document.getElementById('reflexModal').style.display = (gd.gameState === 'reflex') ? 'flex' : 'none';
      document.getElementById('hoopModal').style.display = (gd.gameState === 'hoop') ? 'flex' : 'none';
      if (gd.gameState === 'fruit' && !fruitLoop) startFruitLoop();
      if (gd.gameState !== 'fruit' && fruitLoop) { clearInterval(fruitLoop); fruitLoop = null; }
      if (gd.gameState === 'reflex') {
        const box = document.getElementById('reflexBox');
        box.style.background = gd.reflexGreen ? '#16a34a' : '#dc2626';
        box.textContent = gd.reflexGreen ? '⚡ TAP NOW!! ⚡' : 'WAIT FOR GREEN... 🛑';
      }
      if (gd.gameState === 'hoop' && !hoopAnimId) {
        hoopPos = 0; hoopDir = 1;
        hoopAnimId = setInterval(() => {
          hoopPos += hoopDir * 3.4; if (hoopPos >= 95) { hoopPos = 95; hoopDir = -1; } if (hoopPos <= 0) { hoopPos = 0; hoopDir = 1; }
          const cur = document.getElementById('hoopCursor'); if (cur) cur.style.left = hoopPos + '%';
        }, 25);
      } else if (gd.gameState !== 'hoop' && hoopAnimId) { clearInterval(hoopAnimId); hoopAnimId = null; }
    });
  }
  window.addEventListener('DOMContentLoaded', () => { injectHostGamesAndSfx(); bindMegaSockets(); setTimeout(() => { injectHostGamesAndSfx(); bindMegaSockets(); }, 1300); });
})();
</script>
`;
let botMemory = {
    lastWinner: null,
    winStreaks: {},
    playerPoints: {},
    trophies: {},
    activeQuiz: null,
    activeRiddle: null,
    activeTask: null,
    activeMovie: null,
    activeUnscramble: null,
    activeWordChain: null,
    customTask: null,
    ayurvedaPatients: new Set(),
    legendaryGallery: new Array(),
    chatCount: 0
};

let tourneyState = {
    active: false,
    round: 0,
    maxGames: 15,
    gamesPlayed: 0,
    queue: new Array(),
    nextRound: new Array(),
    eliminated: new Array(),
    matchScores: {},
    currentPair: null
};
let activeMysteryBox = null;
let mysteryBoxTimer = null;

function generateBoxCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
}

function dropMysteryBox() {
    if (players.length === 0) return;
    const code = generateBoxCode();
    activeMysteryBox = { code };
    io.emit('message', {
        username: "Sammu's Bot",
        text: `🎁✨ **MYSTERY BOX DROPPED!** ✨🎁\nFirst person to type the secret code **` + code + `** in chat wins a surprise reward (or curse)! 👀⚡`
    });
}

function scheduleNextMysteryBox() {
    if (mysteryBoxTimer) clearTimeout(mysteryBoxTimer);
    const delay = Math.floor(Math.random() * (1200000 - 900000 + 1)) + 900000;
    mysteryBoxTimer = setTimeout(() => { dropMysteryBox(); scheduleNextMysteryBox(); }, delay);
}
scheduleNextMysteryBox();
const gifLibrary = {
    fire: "🔥|ON FIRE!|pulse", gg: "🎉|GOOD GAME!|bounce", cry: "😭|CRYING HARD|shake",
    dance: "💃|VICTORY DANCE|spin", win: "🏆|CHAMPION!|bounce", clown: "🤡|CLOWN MOMENT|shake",
    sus: "👀|VERY SUS...|pulse", hype: "⚡|MAX HYPE!|bounce", savage: "😎|THUG LIFE SAVAGE|pulse",
    bye: "👋|BYE BYE!|shake", roast: "🧯|EMOTIONAL DAMAGE|shake", noob: "💀|TOTAL NOOB|spin",
    laugh: "😂|LMAOOO!|bounce", shock: "😱|WHAT?!|shake", love: "❤️|MUCH LOVE!|pulse",
    bro: "🤜|MY BRO!|bounce", chad: "🗿|GIGA CHAD|pulse", sigma: "🐺|SIGMA RULE|pulse",
    rip: "🪦|REST IN PEACE|shake", boom: "💥|KABOOM!|pulse", goat: "🐐|THE G.O.A.T|bounce",
    king: "👑|BOW TO THE KING|bounce", queen: "👸|SLAY QUEEN|bounce", flex: "💪|WEIRD FLEX|pulse",
    sleep: "😴|BORING... ZZZ|shake", hungry: "🍔|NEED FOOD NOW|bounce", party: "🥳|PARTY TIME!|spin",
    rich: "💸|PAISA HI PAISA|bounce", fast: "🏎️|TOO FAST!|pulse", slow: "🐢|SOOO SLOW|shake",
    brain: "🧠|BIG BRAIN TIME|pulse", dumb: "🤪|ZERO IQ MOMENT|spin", angry: "🤬|RAGE MODE!|shake",
    cool: "🧊|ICE COLD|pulse", facepalm: "🤦|BRO REALLY?!|shake", salute: "🫡|RESPECT!|bounce",
    magic: "🪄|PURE MAGIC|spin", ghost: "👻|BOO! GHOSTED|pulse", ninja: "🥷|STEALTH NINJA|spin",
    alien: "👽|OUT OF THIS WORLD|spin", lion: "🦁|KING OF JUNGLE|pulse", robot: "🤖|BEEP BOOP AI|bounce",
    pizza: "🍕|PIZZA PARTY|spin", trophy: "🏅|MVP WINNER|bounce", rocket: "🚀|TO THE MOON!|bounce",
    heart: "💖|DIL SE LOVE|pulse", star: "🌟|SUPERSTAR!|spin", lightning: "⚡|THUNDER STRIKE|pulse",
    peace: "✌️|PEACE OUT!|bounce", hello: "👋|NAMASTE BRO!|bounce"
};

const ayurvedaRemedies = [
    {
        keys: ["headache", "head", "migraine", "sir dard", "sar dard"],
        remedy: "🌿 **Dr. Milly & Moon's Prescription (Headache):** Apply a drop of **Peppermint / Eucalyptus oil** on your temples, sip warm **Ginger-Tulsi tea**, and rest your eyes away from screens for 15 mins! 🍵✨"
    },
    {
        keys: ["fever", "bukhar", "temperature", "chills", "flu"],
        remedy: "🌿 **Dr. Milly & Moon's Prescription (Fever):** Drink warm **Giloy & Tulsi Kadha** with a pinch of black pepper and honey, stay hydrated with warm water, and place a cool wet cloth on your forehead! 🫖🌡️"
    },
    {
        keys: ["restless", "restlessness", "anxiety", "stress", "tension", "panic", "overthinking", "bechaini"],
        remedy: "🌿 **Dr. Milly & Moon's Prescription (Restlessness & Stress):** Drink a warm cup of **Ashwagandha or Chamomile milk** with a pinch of nutmeg (jaiphal), and practice 5 minutes of **Anulom-Vilom (deep breathing)**! 🧘‍♀️🌙"
    },
    {
        keys: ["cold", "cough", "sore throat", "zukam", "khansi", "throat", "sneeze"],
        remedy: "🌿 **Dr. Milly & Moon's Prescription (Cold & Cough):** Take **1 tsp Honey + Ginger juice + pinch of Turmeric (Haldi)**, and gargle with warm salt water before bed! 🍯🔥"
    },
    {
        keys: ["stomach", "acidity", "gas", "indigestion", "pet dard", "tummy"],
        remedy: "🌿 **Dr. Milly & Moon's Prescription (Stomach & Acidity):** Chew **1 tsp roasted Ajwain (carom seeds) & Jeera (cumin)** with a pinch of black salt and wash it down with lukewarm water! 🌾💧"
    },
    {
        keys: ["sleep", "insomnia", "neend", "tired", "weakness", "fatigue", "thakan"],
        remedy: "🌿 **Dr. Milly & Moon's Prescription (Sleep & Fatigue):** Massage warm **Sesame or Coconut oil** on the soles of your feet before sleeping and drink warm **Haldi-Doodh (Golden Milk)**! 🥛✨"
    }
];

function handleAyurvedaClinic(senderName, lowerMsg) {
    if (lowerMsg === '!emergency' || lowerMsg === '!clinic' || lowerMsg === '!doctor') {
        botMemory.ayurvedaPatients.add(senderName.toLowerCase());
        setTimeout(() => {
            io.emit('message', {
                username: "🩺 Dr. Milly & Moon",
                text: `🌿✨ **Welcome to Dr. Milly & Moon's Ayurvedic Clinic, ${senderName}!** ✨🌿\nTell us your symptom or disease (e.g. **headache, fever, restlessness, cold, stress, stomach ache, tiredness**) and we will give you an Ayurvedic remedy! *(For fun & general wellness only)* 🫖`
            });
        }, 300);
        return true;
    }

    if (botMemory.ayurvedaPatients.has(senderName.toLowerCase())) {
        const match = ayurvedaRemedies.find(r => r.keys.some(k => lowerMsg.includes(k)));
        if (match) {
            botMemory.ayurvedaPatients.delete(senderName.toLowerCase());
            awardTrophy(senderName, "🌿 Ayurveda Patient");
            setTimeout(() => {
                io.emit('message', {
                    username: "🩺 Dr. Milly & Moon",
                    text: `${match.remedy}\n💚 Take care **${senderName}**! Type \`!emergency\` anytime if you need another checkup!`
                });
            }, 350);
            return true;
        }
    }
    return false;
}
const quizBank = [
    { q: "🌍 GEOGRAPHY: Which country has the largest population in the world?", a: "india" },
    { q: "⚡ SCIENCE: What is the chemical symbol for Gold?", a: "au" },
    { q: "🎮 GAMING: Which block-building game features Creepers and Ender Dragons?", a: "minecraft" },
    { q: "🏏 CRICKET: Who is known as the 'God of Cricket'?", a: "sachin" },
    { q: "🚀 SPACE: Which planet is known as the Red Planet?", a: "mars" },
    { q: "🌊 OCEAN: What is the largest ocean on Earth?", a: "pacific" },
    { q: "🦁 ANIMALS: What is the fastest land animal?", a: "cheetah" },
    { q: "🏛️ HISTORY: In which country are the Pyramids of Giza located?", a: "egypt" },
    { q: "💻 TECH: Who founded Microsoft?", a: "bill gates" },
    { q: "⚽ FOOTBALL: Which country won the 2022 FIFA World Cup?", a: "argentina" },
    { q: "🧪 SCIENCE: What gas do plants absorb from the atmosphere?", a: "carbon dioxide" },
    { q: "🎬 MOVIES: Who played Iron Man in the Marvel movies?", a: "robert downey" },
    { q: "🏔️ GEOGRAPHY: What is the tallest mountain in the world?", a: "everest" },
    { q: "🎵 MUSIC: How many strings does a standard guitar have?", a: "6" },
    { q: "🍕 FOOD: Which country invented Pizza?", a: "italy" },
    { q: "🦴 BIOLOGY: How many bones are in an adult human body?", a: "206" },
    { q: "🌌 SPACE: What is the closest star to Earth?", a: "sun" },
    { q: "♟️ GAMES: How many squares are on a standard chessboard?", a: "64" },
    { q: "🇮🇳 INDIA: What is the capital city of India?", a: "new delhi" },
    { q: "⚡ SCIENCE: What is H2O commonly known as?", a: "water" },
    { q: "🏏 IPL: Which IPL team is known as the 'Yellow Army'?", a: "csk" },
    { q: "🌍 GEOGRAPHY: Which is the longest river in the world?", a: "nile" },
    { q: "🎬 BOLLYWOOD: Who is known as the 'King Khan' of Bollywood?", a: "shah rukh khan" },
    { q: "⚡ TECH: What does 'CPU' stand for in a computer?", a: "central processing unit" },
    { q: "🪐 SPACE: Which planet in our solar system has the most prominent rings?", a: "saturn" },
    { q: "🏏 CRICKET: Who is nicknamed 'Captain Cool' in Indian cricket?", a: "dhoni" },
    { q: "🌍 GEOGRAPHY: Which is the largest desert in the world?", a: "sahara" },
    { q: "🦸 MARVEL: What is Thor's enchanted hammer called?", a: "mjolnir" },
    { q: "🎮 GAMING: In which battle royale game do players drop onto Erangel?", a: "bgmi" },
    { q: "🧪 SCIENCE: What is the hardest natural substance on Earth?", a: "diamond" },
    { q: "🇮🇳 INDIA: Which city is known as the 'Pink City' of India?", a: "jaipur" },
    { q: "⚽ FOOTBALL: Which player is famously known as 'CR7'?", a: "ronaldo" },
    { q: "🚀 SPACE: Who was the first person to walk on the Moon?", a: "neil armstrong" },
    { q: "🦁 ANIMALS: Which is the largest mammal on Earth?", a: "blue whale" },
    { q: "💻 TECH: Which company makes the iPhone?", a: "apple" },
    { q: "🎬 BOLLYWOOD: Which movie features the iconic character 'Gabbar Singh'?", a: "sholay" },
    { q: "🌍 GEOGRAPHY: Which country is known as the Land of the Rising Sun?", a: "japan" },
    { q: "⚡ SCIENCE: What planet is closest to the Sun?", a: "mercury" },
    { q: "🏏 CRICKET: How many players are on a cricket team on the field?", a: "11" },
    { q: "🎵 MUSIC: Who sang the global hit 'Shape of You'?", a: "ed sheeran" },
    { q: "🇮🇳 INDIA: Which monument in Agra is one of the Seven Wonders of the World?", a: "taj mahal" },
    { q: "🎮 GAMING: What is the name of Mario's brother in Nintendo games?", a: "luigi" },
    { q: "🧪 SCIENCE: Which vitamin do we get mainly from sunlight?", a: "vitamin d" },
    { q: "🌍 GEOGRAPHY: Which is the smallest country in the world by area?", a: "vatican city" },
    { q: "⚽ FOOTBALL: How many minutes are in a standard football match?", a: "90" },
    { q: "🎬 MOVIES: Who directed the movie 'Inception' and 'Oppenheimer'?", a: "christopher nolan" },
    { q: "🦁 ANIMALS: How many legs does a spider have?", a: "8" },
    { q: "🇮🇳 INDIA: Which river is considered the holiest river in India?", a: "ganga" },
    { q: "⚡ TECH: What does 'Wi-Fi' help devices connect to wirelessly?", a: "internet" },
    { q: "🪐 SPACE: How many planets are in our solar system?", a: "8" }
];
const animeQuizBank = [
    { q: "🍥 ANIME: What is the name of Naruto Uzumaki's signature shadow clone jutsu?", a: "kage bunshin" },
    { q: "🏴‍☠️ ANIME: Who is the captain of the Straw Hat Pirates in One Piece?", a: "luffy" },
    { q: "🐉 ANIME: What is Goku's Saiyan birth name in Dragon Ball Z?", a: "kakarot" },
    { q: "📓 ANIME: What is the name of the Shinigami who dropped the Death Note?", a: "ryuk" },
    { q: "⚔️ ANIME: Who is humanity's strongest soldier in Attack on Titan?", a: "levi" },
    { q: "👹 ANIME: What is the name of Tanjiro's sister in Demon Slayer?", a: "nezuko" },
    { q: "🤞 ANIME: Who is the strongest jujutsu sorcerer with white hair and blindfold?", a: "gojo" },
    { q: "⚡ ANIME: What is Ash Ketchum's first Pokemon?", a: "pikachu" },
    { q: "👊 ANIME: Who can defeat any enemy with a single punch?", a: "saitama" },
    { q: "🕵️ ANIME: Who is the genius detective trying to catch Kira in Death Note?", a: "l" },
    { q: "🔥 ANIME: What is the name of Luffy's flame-powered older brother?", a: "ace" },
    { q: "🗡️ ANIME: Which three-sword style swordsman wants to be the world's greatest?", a: "zoro" },
    { q: "👁️ ANIME: What red eye dojutsu belongs to the Uchiha clan?", a: "sharingan" },
    { q: "🦸 ANIME: What is Deku's real name in My Hero Academia?", a: "izuku midoriya" },
    { q: "⛓️ ANIME: Who turns into the Chainsaw Devil in Chainsaw Man?", a: "denji" },
    { q: "🏐 ANIME: What high school volleyball team does Hinata Shoyo play for?", a: "karasuno" },
    { q: "⚗️ ANIME: What is the name of the short blonde alchemist in Fullmetal Alchemist?", a: "edward elric" },
    { q: "👻 ANIME: Who becomes a Substitute Soul Reaper in Bleach?", a: "ichigo" },
    { q: "🕵️‍♀️ ANIME: What is the name of the telepathic pink-haired girl in Spy x Family?", a: "anya" },
    { q: "⚽ ANIME: What is the name of the intense striker training facility in Blue Lock?", a: "blue lock" },
    { q: "🕶️ ANIME: Who is the E-Rank hunter who becomes the Shadow Monarch in Solo Leveling?", a: "sung jinwoo" },
    { q: "👑 ANIME: What is Sukuna's title in Jujutsu Kaisen?", a: "king of curses" },
    { q: "🦊 ANIME: What is the name of the Nine-Tailed Fox sealed inside Naruto?", a: "kurama" },
    { q: "🌊 ANIME: Who is the Water Hashira who spared Nezuko in Demon Slayer?", a: "giyu" },
    { q: "👒 ANIME: Who gave Luffy his iconic Straw Hat?", a: "shanks" },
    { q: "🧠 ANIME: What is Light Yagami's secret alias when using the Death Note?", a: "kira" },
    { q: "🧱 ANIME: Who holds the Founding Titan and Attack Titan in Attack on Titan?", a: "eren" },
    { q: "🍀 ANIME: Who wields the five-leaf clover grimoire with Anti-Magic in Black Clover?", a: "asta" },
    { q: "🎣 ANIME: What is the name of Gon's white-haired assassin best friend in Hunter x Hunter?", a: "killua" },
    { q: "🎭 ANIME: Who is the main half-ghoul protagonist of Tokyo Ghoul?", a: "kaneki" },
    { q: "🔥 ANIME: Who is the Flame Hashira in Demon Slayer Mugen Train?", a: "rengoku" },
    { q: "💥 ANIME: What is Bakugo's hero name in My Hero Academia?", a: "dynamight" },
    { q: "🌀 ANIME: Who was Naruto's teacher and the Sixth Hokage with the Sharingan?", a: "kakashi" },
    { q: "🐉 ANIME: What is Vegeta's title as a Saiyan?", a: "prince of all saiyans" },
    { q: "🍖 ANIME: Who is the cook of the Straw Hat Pirates in One Piece?", a: "sanji" },
    { q: "🗡️ ANIME: What is Ichigo Kurosaki's Zanpakuto sword called?", a: "zangetsu" },
    { q: "👁️ ANIME: Which Uchiha member wiped out his clan to protect Konoha?", a: "itachi" },
    { q: "⚡ ANIME: Which Demon Slayer uses Thunder Breathing First Form?", a: "zenitsu" },
    { q: "🐗 ANIME: Which Demon Slayer wears a boar's head mask?", a: "inosuke" },
    { q: "💎 ANIME: What is the name of the rubber-like Devil Fruit Luffy ate?", a: "gomu gomu" },
    { q: "🏀 ANIME: Who is the invisible 'Phantom Sixth Man' in Kuroko's Basketball?", a: "kuroko" },
    { q: "🧪 ANIME: Who is the genius scientist rebuilding civilization in Dr. Stone?", a: "senku" },
    { q: "⚔️ ANIME: Who is known as the 'Black Swordsman' in Sword Art Online?", a: "kirito" },
    { q: "🐺 ANIME: Who is the White Fang of the Leaf and Kakashi's father?", a: "sakumo" },
    { q: "🌟 ANIME: What are the 7 magical orbs called that summon Shenron?", a: "dragon balls" }
];
const riddleBank = [
    { q: "❓ RIDDLE: What has keys but can't open locks?", a: "piano" },
    { q: "❓ RIDDLE: The more of me you take, the more you leave behind. What am I?", a: "footsteps" },
    { q: "❓ RIDDLE: What gets wetter the more it dries?", a: "towel" },
    { q: "❓ RIDDLE: What has hands but cannot clap?", a: "clock" },
    { q: "❓ RIDDLE: What has to be broken before you can use it?", a: "egg" },
    { q: "❓ RIDDLE: I'm tall when I'm young, and I'm short when I'm old. What am I?", a: "candle" },
    { q: "❓ RIDDLE: What is full of holes but still holds water?", a: "sponge" },
    { q: "❓ RIDDLE: What goes up but never comes down?", a: "age" },
    { q: "❓ RIDDLE: What has one eye but can't see?", a: "needle" },
    { q: "❓ RIDDLE: What has many teeth but cannot bite?", a: "comb" },
    { q: "❓ RIDDLE: What has legs but doesn't walk?", a: "table" },
    { q: "❓ RIDDLE: What can you catch but never throw?", a: "cold" },
    { q: "❓ RIDDLE: What belongs to you, but other people use it more than you?", a: "name" },
    { q: "❓ RIDDLE: What has a neck without a head?", a: "bottle" },
    { q: "❓ RIDDLE: What travels around the world while staying in a corner?", a: "stamp" },
    { q: "❓ RIDDLE: What gets bigger the more you take away from it?", a: "hole" },
    { q: "❓ RIDDLE: What has words, but never speaks?", a: "book" },
    { q: "❓ RIDDLE: What runs all around a backyard, yet never moves?", a: "fence" },
    { q: "❓ RIDDLE: What has a thumb and four fingers, but is not alive?", a: "glove" },
    { q: "❓ RIDDLE: What can fill a room but takes up no space?", a: "light" },
    { q: "❓ RIDDLE: What is always in front of you but can't be seen?", a: "future" },
    { q: "❓ RIDDLE: What goes through cities and fields, but never moves?", a: "road" },
    { q: "❓ RIDDLE: I have branches, but no fruit, trunk, or leaves. What am I?", a: "bank" },
    { q: "❓ RIDDLE: What can you break, even if you never pick it up or touch it?", a: "promise" },
    { q: "❓ RIDDLE: What has a head and a tail, but no body?", a: "coin" },
    { q: "❓ RIDDLE: What building has the most stories?", a: "library" },
    { q: "❓ RIDDLE: What can travel faster than anything else in the universe?", a: "light" },
    { q: "❓ RIDDLE: What begins with T, ends with T, and has T in it?", a: "teapot" },
    { q: "❓ RIDDLE: What is black when it is clean and white when it is dirty?", a: "blackboard" },
    { q: "❓ RIDDLE: I speak without a mouth and hear without ears. What am I?", a: "echo" },
    { q: "❓ RIDDLE: What has 88 keys, but cannot open a single door?", a: "piano" },
    { q: "❓ RIDDLE: What has a bottom at the top?", a: "legs" },
    { q: "❓ RIDDLE: What goes up when rain comes down?", a: "umbrella" },
    { q: "❓ RIDDLE: What is full of keys but opens no doors?", a: "keyboard" },
    { q: "❓ RIDDLE: What has a face and two hands, but no arms or legs?", a: "clock" },
    { q: "❓ RIDDLE: What kind of band never plays music?", a: "rubber band" },
    { q: "❓ RIDDLE: What has many rings, but no fingers?", a: "telephone" },
    { q: "❓ RIDDLE: What can you hold in your left hand, but never in your right hand?", a: "right elbow" },
    { q: "❓ RIDDLE: What gets sharper the more you use it?", a: "brain" },
    { q: "❓ RIDDLE: Where does today come before yesterday?", a: "dictionary" },
    { q: "❓ RIDDLE: What has a ring, but no finger?", a: "phone" },
    { q: "❓ RIDDLE: What has four wheels and flies?", a: "garbage truck" },
    { q: "❓ RIDDLE: What kind of tree can you carry in your hand?", a: "palm" },
    { q: "❓ RIDDLE: What has an eye, but cannot see?", a: "storm" },
    { q: "❓ RIDDLE: What gets caught, but never thrown?", a: "fish" },
    { q: "❓ RIDDLE: What is full of holes, yet holds weight?", a: "net" },
    { q: "❓ RIDDLE: What has a bed, but never sleeps?", a: "river" },
    { q: "❓ RIDDLE: What goes around the house, but never goes inside?", a: "wall" },
    { q: "❓ RIDDLE: What has a tongue, cannot talk, and gets around a lot?", a: "shoe" },
    { q: "❓ RIDDLE: What has cities, but no houses; forests, but no trees; and water, but no fish?", a: "map" }
];
const validDictionary = {
    animals_c: ["cat","cow","cheetah","camel","crocodile","crab","crow","chimpanzee","chameleon","cobra","cougar","coyote","crane","cricket","chicken"],
    countries_a: ["australia","argentina","afghanistan","algeria","angola","armenia","austria","azerbaijan","albania","andorra"],
    countries_i: ["india","italy","indonesia","iran","iraq","ireland","israel","iceland"],
    animals_b: ["bear","bat","buffalo","baboon","badger","beaver","bee","beetle","bison","boar","butterfly","bull"],
    animals_s: ["snake","shark","sheep","spider","squirrel","swan","seal","scorpion","sloth","sparrow","starfish","stingray"],
    fruits_m: ["mango","melon","mulberry","mandarin","mangosteen"],
    fruits_p: ["papaya","pineapple","peach","pear","plum","pomegranate","passionfruit","persimmon"],
    colors_b: ["blue","black","brown","beige","bronze","burgundy","maroon"],
    cities_d: ["delhi","dubai","dallas","denver","dhaka","doha","dublin","dehradun","durgapur"],
    cities_m: ["mumbai","madrid","moscow","melbourne","miami","manila","montreal","munich","mysore","meerut"],
    cities_b: ["bangalore","bengaluru","berlin","boston","bangkok","beijing","bhopal","barcelona","brussels"],
    names_r: ["rahul","rohan","rohit","ravi","raj","riya","rashmi","ritika","ranveer","ranbir","ramesh","rajesh","rekha","radha"],
    names_a: ["aman","amit","arjun","ananya","aarav","aditya","akash","ankit","ayush","riya","anjali","arohi","aryan"]
};

const botTasks = [
    { text: "⚡ TASK: Name 3 ANIMALS starting with letter C! (e.g., Cat, Cow, Cheetah)", letter: "c", count: 3, dict: "animals_c" },
    { text: "⚡ TASK: Name 4 COUNTRIES starting with letter A! (Separate with commas or spaces)", letter: "a", count: 4, dict: "countries_a" },
    { text: "⚡ TASK: Name 4 COUNTRIES starting with letter I!", letter: "i", count: 4, dict: "countries_i" },
    { text: "⚡ TASK: Name 3 ANIMALS starting with letter B!", letter: "b", count: 3, dict: "animals_b" },
    { text: "⚡ TASK: Name 4 ANIMALS starting with letter S!", letter: "s", count: 4, dict: "animals_s" },
    { text: "⚡ TASK: Name 3 FRUITS starting with letter M!", letter: "m", count: 3, dict: "fruits_m" },
    { text: "⚡ TASK: Name 3 FRUITS starting with letter P!", letter: "p", count: 3, dict: "fruits_p" },
    { text: "⚡ TASK: Name 4 COLORS starting with letter B!", letter: "b", count: 4, dict: "colors_b" },
    { text: "⚡ TASK: Name 3 CITIES starting with letter D!", letter: "d", count: 3, dict: "cities_d" },
    { text: "⚡ TASK: Name 3 CITIES starting with letter M!", letter: "m", count: 3, dict: "cities_m" },
    { text: "⚡ TASK: Name 3 CITIES starting with letter B!", letter: "b", count: 3, dict: "cities_b" },
    { text: "⚡ TASK: Name 5 MOBILE APPS you use! (Any letters, separate with commas/spaces)", letter: null, count: 5 },
    { text: "⚡ TASK: Name 4 ACTORS or ACTRESSES! (Any letters, separate with commas/spaces)", letter: null, count: 4 },
    { text: "⚡ TASK: Name 4 CRICKETERS or FOOTBALLERS! (Any letters)", letter: null, count: 4 },
    { text: "⚡ TASK: Name 4 MOVIES or WEB SERIES! (Any letters)", letter: null, count: 4 },
    { text: "⚡ TASK: Name 4 FOODS or SNACKS! (Any letters)", letter: null, count: 4 },
    { text: "⚡ TASK: Name 4 VIDEO GAMES! (Any letters)", letter: null, count: 4 },
    { text: "⚡ TASK: Name 4 CAR or BIKE BRANDS! (Any letters)", letter: null, count: 4 },
    { text: "⚡ TASK: Name 4 ANIME CHARACTERS! (Any letters)", letter: null, count: 4 },
    { text: "⚡ TASK: Name 4 SUPERHEROES! (Any letters)", letter: null, count: 4 },
    { text: "⚡ TASK: Name 4 BOYS or GIRLS NAMES starting with letter R!", letter: "r", count: 4, dict: "names_r" },
    { text: "⚡ TASK: Name 4 BOYS or GIRLS NAMES starting with letter A!", letter: "a", count: 4, dict: "names_a" }
];

const songWords = [
    "dupatta", "chanda", "baarish", "dil", "naina", "ishq", "pyaar", "mohabbat", "raat", "sapna",
    "zindagi", "dosti", "yaari", "sawan", "badal", "sitare", "aasmaan", "duniya", "khuda", "rab",
    "sanam", "mehboob", "jaanu", "deewana", "mast", "junoon", "nasha", "khamoshi", "muskurahat", "aankhein",
    "hawa", "khushboo", "phool", "gulab", "rang", "holi", "diwali", "shaadi", "mehndi", "choodi",
    "payal", "bindiya", "kajal", "zulf", "chehra", "dharkan", "saans", "dard", "intezar", "alvida"
];

songWords.forEach(word => {
    botTasks.push({
        text: `🎵 SONG TASK: Type lyrics/name of a Hindi/Bollywood song containing the word **"${word.toUpperCase()}"**! (Minimum 3 words)`,
        songKeyword: word
    });
});

const hindiMovieBank = [
    { emojis: "🚂❤️👰", a: "ddlj", alt: "dilwale dulhania le jayenge" },
    { emojis: "3️⃣🤪🎓", a: "3 idiots", alt: "three idiots" },
    { emojis: "👻🏰💃", a: "bhool bhulaiyaa", alt: "bhool bhulaiya" },
    { emojis: "🕶️🦁🚓", a: "singham", alt: "singham" },
    { emojis: "🥊🤼‍♀️🏅", a: "dangal", alt: "dangal" },
    { emojis: "🚀🌕🇮🇳", a: "mission mangal", alt: "mission mangal" },
    { emojis: "🎸💔🎤", a: "rockstar", alt: "rockstar" },
    { emojis: "👑⚔️🏰", a: "bahubali", alt: "baahubali" },
    { emojis: "👽📻🌎", a: "pk", alt: "pk" },
    { emojis: "👨‍🦯🎹🎶", a: "andhadhun", alt: "andhadhun" },
    { emojis: "🧳🇪🇸🚗", a: "znmd", alt: "zindagi na milegi dobara" },
    { emojis: "🐍🏜️🔫", a: "sholay", alt: "sholay" },
    { emojis: "🐅🕵️‍♂️🇮🇳", a: "ek tha tiger", alt: "tiger" },
    { emojis: "🏏🏆🇮🇳", a: "ms dhoni", alt: "83" },
    { emojis: "👰‍♀️🕺🍻", a: "yeh jawaani hai deewani", alt: "yjhd" },
    { emojis: "🪓🌲🔥", a: "pushpa", alt: "pushpa" },
    { emojis: "💰🏦🏍️", a: "dhoom", alt: "dhoom" },
    { emojis: "👓⚡🦸‍♂️", a: "krrish", alt: "krrish" },
    { emojis: "👻🧵🏘️", a: "stree", alt: "stree" },
    { emojis: "🐶❤️👨‍👩‍👦", a: "hum aapke hain koun", alt: "hum aapke hain kaun" }
];
const shayariBank = [
    "🌹 *Arz kiya hai:* Dil ki dhadkan aur meri sadaa hai tu, meri pehli aur aakhiri wafa hai tu! ❤️✨",
    "💫 *Shayari:* Khuda ne jab fursat mein tujhe banaya hoga, ek suroor sa uske dil pe bhi chhaya hoga! 😍🌙",
    "🔥 *Savage Shayari:* Humse jalne wale bhi kamaal karte hain, mehfil khud ki hoti hai aur charcha humara karte hain! 😎👑",
    "🌙 *Raat Shayari:* Chandni raat mein jab teri yaad aati hai, sitaron ki mehfil bhi muskurati hai! ✨💖",
    "💔 *Dard Shayari:* Kuch is tarah se usne meri zindagi ko aasaan kar diya, kisi se maafi maang li aur kisi ko maaf kar diya! 🥀",
    "⚔️ *Arena Shayari:* Jeet ki aadat hai humein haar se hum darte nahi, Sammu Arena ke sher kisi ke baap se darte nahi! 🦁🔥",
    "🌸 *Cute Shayari:* Muskurahat teri sabse pyaari lagti hai, jab tu lobby mein aaye toh mehfil saari sajti hai! 😊💕",
    "🥂 *Dosti Shayari:* Dosti woh nahi jo jaan deti hai, dosti woh hai jo gaming mein revive bhi deti hai! 🤝😂",
    "⚡ *Attitude Shayari:* Waqt aane do jawab bhi denge aur hisaab bhi lenge, abhi toh sirf shuruat hai! 🕶️💥",
    "🦋 *Ishq Shayari:* Aankhon mein nami aur honton pe hansi hai, tere bina yeh mehfil bhi adhoori si lagi hai! ❤️🌹",
    "👑 *Bhaichara Shayari:* Naam aur pehchan bhale hi chhoti ho, par bhaichara hamesha top par hona chahiye! 🤝🔥",
    "💎 *Royal Shayari:* Hum badshah hain apni hi duniya ke, humein kisi ke taaj ki zaroorat nahi! 🦁👑",
    "🌧️ *Baarish Shayari:* Pehli baarish ki boondein aur teri yaad, dono hi dil ko sukoon de jaati hain! ☔💙",
    "🎭 *Mehfil Shayari:* Mehfil mein aaye ho toh kuch kamaal kar jao, jeeto ya haaro par sabke dil mein misaal kar jao! 🏆✨",
    "🌌 *Sitaare Shayari:* Aasmaan mein hazaron sitare hain par chand jaisa koi nahi, is lobby mein hazaron khiladi hain par tum jaisa koi nahi! 🌙💫",
    "🔥 *Swag Shayari:* Zubaan kadwi hai par dil saaf rakhte hain, kaun kab badla sabka hisaab rakhte hain! 😎⚡",
    "💌 *Mohabbat Shayari:* Lafzon mein kya bayaan karein apni chahat ko, tumhari ek muskurahat hi kaafi hai dil jeetne ke liye! 💖🌸",
    "🐺 *Sigma Shayari:* Sher apni taqat se raja kehlata hai, jungle mein kabhi chunav nahi hote! 🦁🔥",
    "🎶 *Dil Shayari:* Dhadkanon ko bhi raasta mil gaya, jab se is mehfil mein tera saath mil gaya! 💓✨",
    "🥀 *Bewafa Shayari:* Bharosa kaanch jaisa hota hai, ek baar toot jaye toh judne par bhi daraar reh jaati hai! 💔🕯️",
    "🚀 *Jeet Shayari:* Manzil unhi ko milti hai jinke sapnon mein jaan hoti hai, pankhon se kuch nahi hota hauslon se udaan hoti hai! 🦅🏆",
    "☕ *Chai Shayari:* Ek cup garma-garam chai aur doston ki yaari, bas itni si hi toh hai zindagi humari! 😊🫶",
    "🌟 *Kismat Shayari:* Lakeeron pe bharosa mat kar ae dost, kismat toh unki bhi hoti hai jinke haath nahi hote! 💪✨",
    "💐 *Tareef Shayari:* Phoolon ki khushboo aur chand ki chandni bhi fiki pad jaye, jab tu muskurakar is chat mein aaye! 😍🌹",
    "🛡️ *Yaari Shayari:* Yaar woh nahi jo sirf khushi mein saath de, yaar woh hai jo mushkil mein sabse aage khada rahe! 🤝❤️",
    "⚡ *Toofan Shayari:* Samundar ki khamoshi ko kamzori mat samajhna, jitni gehrai andar hai utna hi bada toofan aayega! 🌊💥",
    "🕊️ *Sukoon Shayari:* Hazaron khwahishon ke beech bas ek hi sukoon chahiye, apno ki muskurahat aur bhaichare ka junoon chahiye! ✨🙏",
    "🎯 *Lakshya Shayari:* Haar kar jeetne wale ko baazigar kehte hain, aur har match jeetne wale ko Sammu Arena ka legend kehte hain! 🏅🔥",
    "🌙 *Khwaab Shayari:* Neend bhi ab khwaabon se darti hai, kyunki har khwaab mein bas teri hi tasveer ubharti hai! 💭💕",
    "🎉 *Jashn Shayari:* Aaj ki shaam doston ke naam, hansi mazaak aur jeet ke jaam! 🥳🥂"
];
const roastBank = [
    "bro plays like his Wi-Fi is running on a potato! 🥔📶",
    "even a blindfolded bot has better reflexes than you! 💀",
    "bro talks big in chat and loses in 2 seconds flat! 🤡",
    "is proof that participation trophies exist! 🏅😂",
    "needs a tutorial just to press the TAP button! 🔥",
    "tereko dekh ke lagta hai keyboard bhi sharma gaya! 😭⌨️",
    "has the reaction speed of a sleepy tortoise! 🐢💤",
    "bro's gameplay should come with a comedy warning label! ⚠️😂",
    "even Internet Explorer loads faster than your brain in Math Blitz! 🧠🐌",
    "is carrying the whole enemy team to victory! 🏆🤡",
    "bhai tu game khel raha hai ya sightseeing kar raha hai? 👀🤣",
    "missed the target so bad even the wall felt sorry! 🎯💀",
    "bro's strategy is 100% panic and 0% skill! 🔥😅",
    "types slower than my grandma on a Nokia 3310! 📱👴",
    "if losing was an Olympic sport, you'd have 10 gold medals! 🥇🤡",
    "bhai thoda paani pi le, itna jaldi kaun out hota hai? 💧😂",
    "brought a wooden spoon to a laser fight! 🥄⚡",
    "even the Bomb Pass timer felt bad exploding on you! 💣😭",
    "bro's Wi-Fi ping is higher than his IQ score! 📶🤪",
    "is the reason Sammu's Bot added a 'Noob' GIF! 💀🎬",
    "bhai tu Captain mat ban, team wale resign kar denge! 🚩😂",
    "got outplayed by a random number generator! 🎲🤡",
    "plays like he's using his elbows instead of thumbs! 💪🤣",
    "bro's comeback is still buffering at 1%... 🔄💀",
    "should stick to watching from the spectator bench! 🪑🔥",
    "bhai itna confidence kahan se laate ho haarne ke baad bhi? 😎😂",
    "makes every 1v1 look like a charity donation! 💸🤡",
    "couldn't find the Diamond even with X-Ray vision! 💎👀",
    "bro's thumbs went on vacation mid-match! 🏖️💀",
    "is officially the CEO of Choking at the Last Second! 🏆😭",
    "bhai tere se fast toh snail marathon bhaag leta hai! 🐌🏃",
    "has 99 problems and winning a match isn't one of them! 📉😂",
    "fell for the Color Trap even when the answer was written on screen! 🎨🤡",
    "bhai tu practice mode mein bhi bot se haar jayega! 🤖💀",
    "pressed the wrong wire in Bomb Defusal on purpose just to leave early! ✂️💥",
    "types with one finger like he's defusing a real nuclear bomb! ☝️😅",
    "bhai teri kismat aur tere reflexes dono off-duty hain aaj! 🛌🤣",
    "got caught by the Killer in 3 seconds flat! 🔪🏃‍♂️",
    "is the only player who can lose a single-player Drawing Pad session! 🎨😭",
    "bhai retire ho ja, lobby ke baaki log bhi hass rahe hain! 👏😂",
    "has a K/D ratio lower than winter temperature in Siberia! 🥶📉",
    "even Tommy the Dog could tap faster with his paw! 🐶🐾",
    "bhai tera gameplay dekh ke Mochi billi bhi so gayi! 🐱😴",
    "could trip over a wireless connection! 📶🤡",
    "is the human equivalent of a '404 Skill Not Found' error! 💻💀",
    "bhai tu 1v1 mein bhi apni hi team ko harwa deta hai! 🤦‍♂️😂",
    "needs GPS just to find the TAP button! 🗺️🔥",
    "plays like his screen is covered in butter! 🧈📱",
    "even a traffic cone dodges better than you in Spinner Clash! 🚧🌀",
    "bhai teri speed dekh ke kachua bhi bolta hai 'tez chal bro'! 🐢💨",
    "is sponsored by the 'Defeat' screen! 🏆❌",
    "lost Rock Paper Scissors against a mirror! 🪨🪞",
    "bhai tu math blitz mein 2+2 bhi calculator pe check karta hai! 🧮🤣",
    "has the aim of a Stormtrooper with blurry glasses! 👓🎯",
    "even the Penalty Goalkeeper took a nap and still saved your shot! 🧤💤",
    "bhai teri typing speed se fast toh post office ki chithi pahunchti hai! ✉️🐌",
    "is proof that luck doesn't always favor the brave! 🍀💀",
    "got bamboozled by Simon Says when Simon didn't even say anything! 🚨🤡",
    "bhai tu tug of war mein rassi khud ki taraf kheench ke bhi haar jayega! 🪢😂",
    "makes every opponent look like an Esports World Champion! 🎮👑",
    "even Google couldn't find your win streak! 🔍📉",
    "bhai tu lobby mein sirf spectator seats garam karne aaya hai! 🪑🔥",
    "pressed every button except the right one! 🎛️🤪",
    "is the only person who gets dizzy watching Sumo Push! 🤼💫",
    "bhai tera dimaag airplane mode pe chalta hai kya? ✈️🧠",
    "lost a Number Guess game between 1 and 2! 🔢💀",
    "even Mochi knocked your crown off the table! 😼👑",
    "bhai agle janam mein pro player ban ke aana! 🙏😂",
    "has reflexes slower than a Windows XP shutdown! 🖥️⏳",
    "is officially the mascot of Team Defeat! 🚩🤡"
];
const truthBank = [
    "TRUTH: Who in this lobby do you think is the easiest to beat? 👀",
    "TRUTH: What is the funniest excuse you ever gave after losing a game? 😂",
    "TRUTH: Have you ever rage-quit a game before? Be honest! 💀",
    "TRUTH: Who is your favorite teammate in this room right now? 🤝",
    "TRUTH: Which mini-game are you secretly the worst at? 🤡",
    "TRUTH: Have you ever blamed 'lag' when you actually just missed? 📶😂",
    "TRUTH: Who in this chat talks the most trash before losing? 🔥",
    "TRUTH: If you could ban one person in this room for 5 minutes just for fun, who would it be? 🔨👀",
    "TRUTH: What is the most embarrassing song you secretly love listening to? 🎵😳",
    "TRUTH: Have you ever copied someone else's answer during !task or !quiz? 🧠😅",
    "TRUTH: Who in this lobby would survive the longest in a real zombie apocalypse? 🧟",
    "TRUTH: Who in this room would get caught FIRST in Survive the Killer? 🔪😂",
    "TRUTH: What is your weirdest habit while gaming on your phone? 📱",
    "TRUTH: Have you ever pretended your battery was dying to leave a losing match? 🪫💀",
    "TRUTH: Who is the funniest person in this lobby right now? 😂",
    "TRUTH: Which player here do you never want as your opposing Captain? ⚔️",
    "TRUTH: Have you ever laughed so hard at a roast in chat that you dropped your phone? 🤣",
    "TRUTH: What is one secret talent you have that nobody in this lobby knows about? 🌟",
    "TRUTH: If you had to swap avatars with someone here, whose would you pick? 🥷",
    "TRUTH: Have you ever cheated in rock-paper-scissors in real life? 🪨📄✂️",
    "TRUTH: Who in this lobby takes mini-games way too seriously? 🏆😅",
    "TRUTH: What is the longest winning streak you've ever had in any game? 🔥",
    "TRUTH: Have you ever accidentally sent a message to the wrong chat? 💬😱",
    "TRUTH: Who is the best Captain in Sammu Games right now? 👑",
    "TRUTH: Be honest—did you use a calculator during Math Blitz? 🧮👀"
];

const dareBank = [
    "DARE: Send '/gif clown' in chat and type 'I am the lobby noob'! 🤡",
    "DARE: Type the next 3 chat messages in ALL CAPS! 📢",
    "DARE: Hype up the opposite team captain in chat right now! 🔥",
    "DARE: Challenge anyone in the room to a 1v1 in the next arena! ⚔️",
    "DARE: Send '/gif dance' and praise Sammu's Bot in chat! 💃🤖",
    "DARE: Draw a funny portrait of the Host in the Drawing Pad and post it! 🎨",
    "DARE: Type a 2-line Bollywood shayari for the lobby right now! 🌹🎤",
    "DARE: Send '/gif cry' and beg the Host for 1 free MVP point! 😭🏅",
    "DARE: Speak only in emojis for your next 3 chat messages! 😎🔥🚀",
    "DARE: Type your next message backwards! 🔄🧠",
    "DARE: Roast yourself in chat before Sammu's Bot does! 🧯😂",
    "DARE: Send '/gif king' and declare yourself the ruler of Sammu Arena! 👑",
    "DARE: Sing/type the chorus of your favorite Hindi song in chat! 🎶",
    "DARE: Draw a cute cat or alien in the Drawing Pad and share it! 🐱👽",
    "DARE: Compliment the person directly above your message in chat! ❤️",
    "DARE: Type 'SAMMU BOT IS THE GREATEST AI' 3 times fast in chat! 🤖⚡",
    "DARE: Send '/gif noob' and admit which mini-game scares you most! 💀",
    "DARE: Ask Sammu's Bot '!8ball' a funny question about your future! 🎱",
    "DARE: Use '/gif savage' after winning—or losing—your very next match! 😎",
    "DARE: Write a funny nickname for every player currently in the lobby! 🏷️😂",
    "DARE: Let the opposing Captain choose your next chat message! 🎭",
    "DARE: Send '/gif party' and start a hype chain in the chat! 🥳🎉",
    "DARE: Draw a trophy in the Drawing Pad and dedicate it to your teammate! 🏆🎨",
    "DARE: Type a tongue twister in chat without any spelling mistakes! 👅⚡",
    "DARE: Tell a joke in chat—if nobody laughs, send '/gif facepalm'! 🤦😂"
];
function awardTrophy(username, trophyLabel) {
    if (!username) return;
    if (!botMemory.trophies[username]) botMemory.trophies[username] = [];
    if (!botMemory.trophies[username].includes(trophyLabel)) {
        botMemory.trophies[username].push(trophyLabel);
        setTimeout(() => {
            io.emit('message', {
                username: "Sammu's Bot",
                text: `🎖️ **TROPHY UNLOCKED!** **${username}** just earned **${trophyLabel}**!`
            });
        }, 400);
    }
}

function addMVPPoints(username, pts) {
    if (!username) return;
    botMemory.playerPoints[username] = (botMemory.playerPoints[username] || 0) + pts;
    if (botMemory.playerPoints[username] >= 10) awardTrophy(username, "👑 Arena Legend");
    broadcastMVP();
}

function broadcastMVP() {
    const board = Object.entries(botMemory.playerPoints)
        .map(([name, pts]) => ({
            name,
            pts,
            trophies: (botMemory.trophies[name] || []).join(' ')
        }))
        .sort((a, b) => b.pts - a.pts);
    io.emit('updateMVP', { board, trophies: botMemory.trophies });
}

function handlePetBots(senderName, lowerMsg) {
    const pick = (arr) => arr.at(Math.floor(Math.random() * arr.length));

    if (lowerMsg === '!petcat' || lowerMsg === '!feedcat') {
        const catRewards = new Array(
            `*purrs loudly and rubs against ${senderName}'s ankles* 🐱💕 Meoww~ thank you for the treats! 🐟✨`,
            `*rolls over for belly rubs and gives ${senderName} a tiny paw high-five* 🐾😻 Meow!`,
            `*happy cat zoomies around ${senderName}* 🐱💖 Purrrrrrr~ you are Mochi's favorite human!`
        );
        setTimeout(() => io.emit('message', { username: "🐱 Mochi (Cat)", text: pick(catRewards) }), 350);
        return;
    }

    if (/\b(meow|purr|cat|kitty|billi|pspsps|cute)\b/.test(lowerMsg)) {
        const catLines = new Array(
            `Meoww~ 🐱✨ *curls up on ${senderName}'s lap and purrs softly* 🐾💕`,
            `*ears perk up* Pspsps?! Did someone call Mochi? Meow! 😻🐟`,
            `*knocks a virtual trophy off the table and stares at ${senderName}* 😼🐾 Meow!`,
            `Purrrrr~ 🐱🌸 *blinks slowly at ${senderName} with sparkly eyes* 💖`
        );
        setTimeout(() => io.emit('message', { username: "🐱 Mochi (Cat)", text: pick(catLines) }), 400);
    }

    if (lowerMsg === '!petdog' || lowerMsg === '!fetch') {
        const fetchedItems = new Array(
            `*sprints across the arena and brings back a Golden Bone for ${senderName}!* 🦴🐕 Woof woof!`,
            `*zoomies at 100mph and drops a tennis ball at ${senderName}'s feet!* 🎾🐶 *wags tail furiously*`,
            `*accidentally fetched the ticking bomb from Bomb Pass for ${senderName}!* 💣🐕 Woof?! 😅`
        );
        setTimeout(() => io.emit('message', { username: "🐶 Tommy (Dog)", text: pick(fetchedItems) }), 350);
        return;
    }

    if (/\b(tommy|dog|woof|bark|puppy|kutta|good boy)\b/.test(lowerMsg)) {
        const dogLines = new Array(
            `Woof woof! 🐶🦴 *wags tail at 100mph and jumps happily around ${senderName}!* 🎾`,
            `*happy barks!* 🐕🔥 Tommy is on duty guarding ${senderName}! Woof!`,
            `*tilts head adorably and offers a paw to ${senderName}* 🐾🐶 Arf arf!`,
            `*spins in circles with excitement* 🐶💨 Good boy Tommy reporting for fun! 🦴`
        );
        setTimeout(() => io.emit('message', { username: "🐶 Tommy (Dog)", text: pick(dogLines) }), 400);
    }
}
function checkTaskSubmission(msg, taskObj) {
    if (!taskObj) return false;
    const cleanText = msg.toLowerCase().trim();
    if (taskObj.songKeyword) {
        const words = cleanText.split(/\s+/).filter(w => w.replace(/[^a-z]/g, '').length > 0);
        const hasKeyword = words.some(w => w.replace(/[^a-z]/g, '').includes(taskObj.songKeyword));
        return hasKeyword && words.length >= 3;
    }
    const rawItems = msg.includes(',') ? msg.split(',') : msg.trim().split(/\s+/);
    const uniqueValid = new Set();
    const dictList = taskObj.dict ? validDictionary[taskObj.dict] : null;
    rawItems.forEach(item => {
        const clean = item.toLowerCase().replace(/[^a-z]/g, '');
        if (clean.length >= 2) {
            if (dictList) {
                if (dictList.includes(clean)) uniqueValid.add(clean);
            } else if (!taskObj.letter || clean.startsWith(taskObj.letter)) {
                uniqueValid.add(clean);
            }
        }
    });
    return uniqueValid.size >= taskObj.count;
}

function solveAnyMath(text) {
    const pctMatch = text.toLowerCase().match(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/);
    if (pctMatch) {
        return Number(((parseFloat(pctMatch.at(1)) / 100) * parseFloat(pctMatch.at(2))).toFixed(4));
    }
    const cleaned = text.replace(/×/g, '*').replace(/÷/g, '/').replace(/\^/g, '**').trim();
    if (/^[0-9\+\-\*\/\(\)\.\s]+$/.test(cleaned) && /[\+\-\*\/]/.test(cleaned) && /\d/.test(cleaned)) {
        try {
            const result = Function('"use strict";return (' + cleaned + ')')();
            if (typeof result === 'number' && isFinite(result)) return Number(result.toFixed(4));
        } catch (e) { return null; }
    }
    return null;
}

function thinkAndReply(senderName, msgText, scores, playerList) {
    const m = msgText.toLowerCase().trim();
    const pick = (arr) => arr.at(Math.floor(Math.random() * arr.length));
    const pts = botMemory.playerPoints[senderName] || 0;
    const streak = botMemory.winStreaks[senderName] || 0;

    if (m.includes('flip') || m.includes('toss') || m.includes('coin')) return `🪙 Flipping virtual coin... It landed on **${Math.random() < 0.5 ? 'HEADS 👑' : 'TAILS 🔥'}**!`;
    if (m.includes('dice') || m.includes('roll')) return `🎲 Rolled a **${Math.floor(Math.random() * 6) + 1}** for ${senderName}!`;
    if (m.includes('joke') || m.includes('funny') || m.includes('hasao')) {
        return pick(new Array(
            `😂 Why did the gamer bring a ladder to the lobby? Because he wanted to reach the next level!`,
            `🤣 Ek player ne bola 'Main pro hoon', phir 1 second mein Bomb Pass mein phat gaya! 💣💀`
        ));
    }
    if (m.includes('who am i') || m.includes('my stats') || m.includes('mera score')) {
        const tr = (botMemory.trophies[senderName] || []).join(', ') || 'None yet';
        return `📊 **${senderName}'s Profile:** ${pts} MVP pts | 🔥 Streak: ${streak} | 🏆 Trophies: ${tr}`;
    }
    if (m.includes('kaisa') || m.includes('haal') || m.includes('how are you') || m.includes('how r u') || m.includes('wassup') || m.includes('sup')) {
        const status = botMemory.lastWinner ? `Still hyped watching **${botMemory.lastWinner}** dominate earlier!` : `Ready to drop tasks, quizzes, or referee all 24 arenas!`;
        return `Mast ekdum ${senderName} bro! 😎⚡ ${status} Tum batao, aaj kaun jeetega?`;
    }
    if (m.includes('hi') || m.includes('hello') || m.includes('hey') || m.includes('namaste') || m.includes('yo') || m.includes('bro')) {
        return pick(new Array(
            `Yo ${senderName} bro! 👋 Try **!task**, **!song**, **!quiz**, **!anime**, **!movie**, **!shayari**, **!emergency**, or **!spin**! 🔥`,
            `Sup ${senderName}! 🤖 Try **!unscramble**, **!word**, **!petcat**, **!petdog**, or **!promote**! 🐾`
        ));
    }
    if (m.includes('who is winning') || m.includes('score') || m.includes('winning') || m.includes('jeet')) {
        if (scores.teamA > scores.teamB) return `🔴 Team A is leading **${scores.teamA} - ${scores.teamB}**! Blue Team, comeback kab hoga? 👀`;
        if (scores.teamB > scores.teamA) return `🔵 Team B is ahead **${scores.teamB} - ${scores.teamA}**! Red Team, wake up bro! 🔥`;
        return `Tied at **${scores.teamA} - ${scores.teamB}**! Next match decides who's the real boss! ⚔️`;
    }
    if (m.includes('help') || m.includes('commands')) {
        return `🤖 **Commands:** \`!emergency\`, \`!spin\`, \`!task\`, \`!song\`, \`!quiz\`, \`!anime\`, \`!movie\`, \`!riddle\`, \`!shayari\`, \`!roast\`, \`!truth\`, \`!dare\`, \`!unscramble\`, \`!word\`, \`!petcat\`, \`!petdog\`, \`!promote\`, \`!trophies\` | **Host:** \`/cap A B\`, \`/random\`, \`/tournament\`, \`/mysterybox\`, \`/win a|b\``;
    }
    return pick(new Array(
        `100% agree ${senderName} bro! 😎 With ${playerList.length} players in the lobby, let's run **!anime**, **!shayari**, or **!spin**!`,
        `Haha sahi bola ${senderName}! 🤖 Need a checkup? Type **!emergency** for **🩺 Dr. Milly & Moon**! 🌿`,
        `I'm watching everything in this chat, ${senderName}! 👀 Type **!trophies** to see the Leaderboard! 🏆`
    ));
}
let gameData = {
    captainA: null, captainB: null, teamA: [], teamB: [],
    fighterA: null, fighterB: null, tttBoard: Array(9).fill(null), tttTurn: null,
    sumoPosition: 50,
    spinner: { a: { x: 80, y: 130, vx: 0, vy: 0 }, b: { x: 180, y: 130, vx: 0, vy: 0 } },
    drawReady: false, mathQ: { question: '', options: [], answer: 0 },
    bombHolder: null, rpsChoices: { a: null, b: null },
    memoryGrid: [], memoryTarget: '', memoryHidden: false,
    tugPosition: 50, colorTrap: null, scrambleWord: '', scrambleAnswer: '',
    diceRolls: { a: null, b: null }, penaltyPicks: { shooter: null, keeper: null },
    typingPhrase: '', treasureGrid: [],
    simonCommand: '', simonIsValid: false, cardCurrent: 7, cardNext: 0,
    defuseWires: [], defuseTurn: null, guessSecret: 50, guessHint: 'Guess 1 - 100!',
    targetPos: { x: 50, y: 50 }, stkState: null,
    reflexGreen: false,
    scores: { teamA: 0, teamB: 0 }, gameState: 'lobby'
};

function generateMath() {
    const a = Math.floor(Math.random() * 15) + 5, b = Math.floor(Math.random() * 12) + 3, c = Math.floor(Math.random() * 20) + 1;
    const ans = (a * b) + c;
    let opts = new Set([ans]);
    while (opts.size < 4) opts.add(ans + (Math.floor(Math.random() * 15) - 7));
    return { question: `${a} × ${b} + ${c} = ?`, options: Array.from(opts).sort(() => Math.random() - 0.5), answer: ans };
}

function generateColorTrap() {
    const colors = new Array(
        { name: 'RED', hex: '#ef4444' },
        { name: 'BLUE', hex: '#3b82f6' },
        { name: 'GREEN', hex: '#10b981' },
        { name: 'YELLOW', hex: '#eab308' }
    );
    const target = colors.at(Math.floor(Math.random() * colors.length));
    const fake = colors.at(Math.floor(Math.random() * colors.length));
    return { targetName: target.name, fakeHex: fake.hex, options: [...colors].sort(() => Math.random() - 0.5) };
}

function generateScramble() {
    const words = new Array(
        'DRAGON', 'GALAXY', 'ROCKET', 'PLANET', 'NINJA',
        'TROPHY', 'THUNDER', 'DIAMOND', 'VICTORY', 'ARENA',
        'CHAMPION', 'PHANTOM', 'VOLCANO', 'WARRIOR', 'MYSTERY',
        'KINGDOM', 'TORNADO', 'CYBORG', 'LEGEND', 'EMERALD'
    );
    const word = words.at(Math.floor(Math.random() * words.length));
    let scrambled = word.split('').sort(() => Math.random() - 0.5).join('');
    if (scrambled === word) scrambled = word.split('').reverse().join('');
    return { scrambled, answer: word };
}

function generateTyping() {
    const phrases = new Array(
        "Sammu Arena Champion!",
        "Fastest fingers win the crown!",
        "Red vs Blue ultimate showdown!",
        "Victory belongs to the bold!",
        "Never give up until the end!",
        "Bhaichara on top forever!",
        "Makeover queen of the lobby!",
        "Legends never back down from a duel!",
        "Speed and accuracy bring the trophy!",
        "One team one dream one victory!"
    );
    return phrases.at(Math.floor(Math.random() * phrases.length));
}
function clearAllTimers() {
    if (drawTimer) clearTimeout(drawTimer);
    if (bombTimer) clearTimeout(bombTimer);
    if (memoryTimer) clearTimeout(memoryTimer);
    if (simonTimer) clearTimeout(simonTimer);
    if (reflexTimer) clearTimeout(reflexTimer);
}

function getRealIP(socket) {
    const fwd = socket.handshake.headers['x-forwarded-for'];
    if (fwd && typeof fwd === 'string') return fwd.split(',').at(0).trim();
    return null;
}

function resolvePlayerIdentity(socket, payload) {
    const backupName = (payload && typeof payload === 'object' && payload.username && payload.username.trim()) ? payload.username.trim() : null;
    const backupAvatar = (payload && typeof payload === 'object' && payload.avatar) ? payload.avatar : null;

    const name = (sessionMemory[socket.id] && sessionMemory[socket.id].username) || socket.username || backupName || ("Player_" + socket.id.slice(0, 4));
    const avatar = (sessionMemory[socket.id] && sessionMemory[socket.id].avatar) || socket.avatar || backupAvatar || "🥷";

    socket.username = name;
    socket.avatar = avatar;
    sessionMemory[socket.id] = { username: name, avatar: avatar };
    return { name, avatar };
}

function ensureCaptains() {
    if (gameData.captainA && gameData.captainA.username) {
        const freshA = players.find(p => p.username.toLowerCase() === gameData.captainA.username.toLowerCase());
        gameData.captainA = freshA || null;
    } else {
        gameData.captainA = null;
    }

    if (gameData.captainB && gameData.captainB.username) {
        const freshB = players.find(p => p.username.toLowerCase() === gameData.captainB.username.toLowerCase());
        gameData.captainB = freshB || null;
    } else {
        gameData.captainB = null;
    }

    const nonHosts = players.filter(p => p.id !== hostId);
    const pool = nonHosts.length >= 2 ? nonHosts : players;

    if (!gameData.captainA && pool.length > 0) {
        gameData.captainA = pool.at(0);
        gameData.teamA = [pool.at(0)];
    }
    if (!gameData.captainB && pool.length > 1) {
        const second = pool.find(p => p.id !== gameData.captainA.id) || pool.at(1);
        gameData.captainB = second;
        gameData.teamB = [second];
    } else if (!gameData.captainB && pool.length > 0) {
        gameData.captainB = pool.at(0);
        gameData.teamB = [pool.at(0)];
    }
}

function announceMatchup(gameTitle) {
    const pA = gameData.captainA ? gameData.captainA.username : "Player A";
    const pB = gameData.captainB ? gameData.captainB.username : "Player B";
    io.emit('message', {
        username: "Sammu's Bot",
        text: `⚔️ **MATCHUP (${gameTitle}):** 🔴 **${pA}** vs 🔵 **${pB}**! Good luck! 🔥`
    });
}
const TOURNEY_GAME_POOL = [
    { name: "⚔️ Tic-Tac-Toe Duel", start: (pA, pB) => {
        clearAllTimers();
        gameData.fighterA = pA.id; gameData.fighterB = pB.id;
        gameData.tttBoard = Array(9).fill(null); gameData.tttTurn = pA.id;
        gameData.gameState = 'duel'; io.emit('syncGame', gameData);
    }},
    { name: "🤼 Sumo Push", start: () => {
        clearAllTimers(); gameData.gameState = 'sumo'; gameData.sumoPosition = 50; io.emit('syncGame', gameData);
    }},
    { name: "🌀 Spinner Clash", start: () => {
        clearAllTimers(); spinnerEnded = false; gameData.gameState = 'spinner';
        gameData.spinner = { a: { x: 80, y: 130, vx: 0, vy: 0 }, b: { x: 180, y: 130, vx: 0, vy: 0 } };
        io.emit('syncGame', gameData); io.emit('spinnerTick', gameData.spinner);
    }},
    { name: "🤠 Quick-Draw", start: () => {
        clearAllTimers(); gameData.gameState = 'quickdraw'; gameData.drawReady = false; io.emit('syncGame', gameData);
        drawTimer = setTimeout(() => { if (gameData.gameState === 'quickdraw') { gameData.drawReady = true; io.emit('syncGame', gameData); } }, Math.floor(Math.random() * 3500) + 2000);
    }},
    { name: "🧮 Math Blitz", start: () => {
        clearAllTimers(); gameData.gameState = 'math'; gameData.mathQ = generateMath(); io.emit('syncGame', gameData);
    }},
    { name: "💣 Bomb Pass", start: (pA, pB) => {
        clearAllTimers(); gameData.gameState = 'bomb'; gameData.bombHolder = Math.random() < 0.5 ? pA.id : pB.id; io.emit('syncGame', gameData);
        bombTimer = setTimeout(() => {
            if (gameData.gameState !== 'bomb') return;
            if (gameData.bombHolder === gameData.captainA.id) { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Bomb exploded on Red! 💥)", '💣', gameData.captainB.username, "💣 Bomb Survivor"); }
            else { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Bomb exploded on Blue! 💥)", '💣', gameData.captainA.username, "💣 Bomb Survivor"); }
            gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
        }, Math.floor(Math.random() * 9000) + 7000);
    }},
    { name: "🪨 Rock Paper Scissors", start: () => {
        clearAllTimers(); gameData.gameState = 'rps'; gameData.rpsChoices = { a: null, b: null }; io.emit('syncGame', gameData);
    }},
    { name: "🧠 Emoji Memory", start: () => {
        clearAllTimers(); gameData.gameState = 'memory'; gameData.memoryHidden = false;
        gameData.memoryGrid = new Array('🦁','🤖','👽','🔥','👑','💀','🍕','🚀','💎').sort(() => Math.random() - 0.5);
        gameData.memoryTarget = gameData.memoryGrid.at(Math.floor(Math.random() * 9)); io.emit('syncGame', gameData);
        memoryTimer = setTimeout(() => { if (gameData.gameState === 'memory') { gameData.memoryHidden = true; io.emit('syncGame', gameData); } }, 2800);
    }},
    { name: "🪢 Tug of War", start: () => {
        clearAllTimers(); gameData.gameState = 'tug'; gameData.tugPosition = 50; io.emit('syncGame', gameData);
    }},
    { name: "🎨 Color Trap", start: () => {
        clearAllTimers(); gameData.gameState = 'colortrap'; gameData.colorTrap = generateColorTrap(); io.emit('syncGame', gameData);
    }},
    { name: "🔤 Word Scramble", start: () => {
        clearAllTimers(); const s = generateScramble();
        gameData.gameState = 'scramble'; gameData.scrambleWord = s.scrambled; gameData.scrambleAnswer = s.answer;
        io.emit('syncGame', gameData);
    }},
    { name: "🎲 High Dice", start: () => {
        clearAllTimers(); gameData.gameState = 'dice'; gameData.diceRolls = { a: null, b: null }; io.emit('syncGame', gameData);
    }},
    { name: "⚽ Penalty Kick", start: () => {
        clearAllTimers(); gameData.gameState = 'penalty'; gameData.penaltyPicks = { shooter: null, keeper: null }; io.emit('syncGame', gameData);
    }},
    { name: "⌨️ Typing Race", start: () => {
        clearAllTimers(); gameData.gameState = 'typing'; gameData.typingPhrase = generateTyping(); io.emit('syncGame', gameData);
    }},
    { name: "💎 Treasure Hunt", start: () => {
        clearAllTimers(); gameData.gameState = 'treasure';
        const items = new Array('💎', '💀', '🕸️', '🦴', '🪨', '🍂', '🐚', '🕷️', '🪙').sort(() => Math.random() - 0.5);
        gameData.treasureGrid = items.map(icon => ({ icon, opened: false }));
        io.emit('syncGame', gameData);
    }},
    { name: "🚨 Simon Says", start: () => {
        clearAllTimers(); gameData.gameState = 'simon'; gameData.simonCommand = "WAIT FOR SIMON..."; gameData.simonIsValid = false;
        io.emit('syncGame', gameData);
        const isValid = Math.random() < 0.65;
        simonTimer = setTimeout(() => {
            if (gameData.gameState !== 'simon') return;
            gameData.simonIsValid = isValid;
            gameData.simonCommand = isValid ? "🚨 SIMON SAYS: TAP NOW!" : "⚠️ TAP NOW! (FAKE!)";
            io.emit('syncGame', gameData);
        }, Math.floor(Math.random() * 2500) + 1500);
    }},
    { name: "🃏 Higher or Lower", start: () => {
        clearAllTimers(); gameData.gameState = 'cards';
        const cur = Math.floor(Math.random() * 9) + 3;
        let nxt = Math.floor(Math.random() * 13) + 1;
        while (nxt === cur) nxt = Math.floor(Math.random() * 13) + 1;
        gameData.cardCurrent = cur; gameData.cardNext = nxt;
        io.emit('syncGame', gameData);
    }},
    { name: "✂️ Wire Defusal", start: (pA) => {
        clearAllTimers(); gameData.gameState = 'defuse';
        const types = new Array('SAFE', 'SAFE', 'DEFUSE', 'BOOM').sort(() => Math.random() - 0.5);
        const colors = new Array('🔴 RED WIRE', '🔵 BLUE WIRE', '🟢 GREEN WIRE', '🟡 YELLOW WIRE');
        gameData.defuseWires = colors.map((label, i) => ({ label, type: types.at(i), cut: false }));
        gameData.defuseTurn = pA.id;
        io.emit('syncGame', gameData);
    }},
    { name: "🔢 Number Guess", start: () => {
        clearAllTimers(); gameData.gameState = 'guess';
        gameData.guessSecret = Math.floor(Math.random() * 100) + 1;
        gameData.guessHint = 'Guess a number between 1 and 100!';
        io.emit('syncGame', gameData);
    }},
    { name: "🎯 Target Sniper", start: () => {
        clearAllTimers(); gameData.gameState = 'target';
        gameData.targetPos = { x: Math.floor(Math.random() * 70) + 15, y: Math.floor(Math.random() * 70) + 15 };
        io.emit('syncGame', gameData);
    }},
    { name: "🗡️ Fruit Slash", start: () => {
        clearAllTimers(); gameData.gameState = 'fruit'; io.emit('syncGame', gameData);
    }},
    { name: "⚡ Lightning Reflex", start: () => {
        clearAllTimers(); gameData.gameState = 'reflex'; gameData.reflexGreen = false; io.emit('syncGame', gameData);
        reflexTimer = setTimeout(() => {
            if (gameData.gameState === 'reflex') { gameData.reflexGreen = true; io.emit('syncGame', gameData); }
        }, Math.floor(Math.random() * 3500) + 2000);
    }},
    { name: "🏀 Hoop Shootout", start: () => {
        clearAllTimers(); gameData.gameState = 'hoop'; io.emit('syncGame', gameData);
    }}
];
function startTournament() {
    const contestants = players.filter(p => p.id !== hostId).sort(() => Math.random() - 0.5);
    if (contestants.length < 2) {
        io.emit('message', { username: "Sammu's Bot", text: `⚠️ Need at least **2 non-host players** in the lobby to start a Tournament!` });
        return;
    }
    if (tourneyTimer) clearTimeout(tourneyTimer);
    tourneyState = {
        active: true, round: 1, maxGames: 15, gamesPlayed: 0,
        queue: [...contestants], nextRound: new Array(), eliminated: new Array(),
        matchScores: {}, currentPair: null
    };
    contestants.forEach(p => { tourneyState.matchScores[p.username] = 0; });
    io.emit('message', {
        username: "Sammu's Bot",
        text: `🏆 **15-GAME GRAND TOURNAMENT STARTED!** (${contestants.length} Players | 23 Mini-Games Pool)\n🥇 1st: **Trophy** | 🥈 2nd: **Silver Medal** | 🥉 3rd: **Bronze Medal**!`
    });
    advanceTournament();
}

function finishTournament() {
    tourneyState.active = false;
    if (tourneyTimer) clearTimeout(tourneyTimer);
    const ranking = new Array();
    const seen = new Set();
    const addRank = (name) => { if (name && !seen.has(name)) { seen.add(name); ranking.push(name); } };

    if (tourneyState.currentPair) { addRank(tourneyState.currentPair.winner); addRank(tourneyState.currentPair.loser); }
    [...tourneyState.nextRound].reverse().forEach(p => addRank(p.username));
    [...tourneyState.eliminated].reverse().forEach(name => addRank(name));
    Object.entries(tourneyState.matchScores).sort((a, b) => b.at(1) - a.at(1)).forEach((entry) => addRank(entry.at(0)));

    const first = ranking.at(0) || null, second = ranking.at(1) || null, third = ranking.at(2) || null;
    let podiumMsg = `🎊 **TOURNAMENT FINISHED! (${tourneyState.gamesPlayed}/${tourneyState.maxGames} Games Played)** 🎊\n`;
    if (first) { addMVPPoints(first, 10); awardTrophy(first, "🏆 Tournament Champion"); podiumMsg += `🥇 **1st Place (TROPHY):** **${first}** (+10 MVP pts)\n`; }
    if (second) { addMVPPoints(second, 6); awardTrophy(second, "🥈 Silver Medal"); podiumMsg += `🥈 **2nd Place (SILVER MEDAL):** **${second}** (+6 MVP pts)\n`; }
    if (third) { addMVPPoints(third, 4); awardTrophy(third, "🥉 Bronze Medal"); podiumMsg += `🥉 **3rd Place (BRONZE MEDAL):** **${third}** (+4 MVP pts)`; }

    tourneyState.currentPair = null;
    io.emit('message', { username: "Sammu's Bot", text: podiumMsg });
}

function advanceTournament() {
    if (!tourneyState.active) return;
    if (tourneyState.gamesPlayed >= tourneyState.maxGames) { finishTournament(); return; }

    tourneyState.queue = tourneyState.queue.map(qp => players.find(p => p.username.toLowerCase() === qp.username.toLowerCase())).filter(Boolean);
    tourneyState.nextRound = tourneyState.nextRound.map(np => players.find(p => p.username.toLowerCase() === np.username.toLowerCase())).filter(Boolean);

    if (tourneyState.queue.length === 1) {
        const byePlayer = tourneyState.queue.pop();
        tourneyState.nextRound.push(byePlayer);
        io.emit('message', { username: "Sammu's Bot", text: `🍀 **${byePlayer.username}** gets a lucky bye to Round ${tourneyState.round + 1}!` });
    }

    if (tourneyState.queue.length === 0) {
        if (tourneyState.nextRound.length <= 1) {
            if (tourneyState.nextRound.length === 1) tourneyState.currentPair = { winner: tourneyState.nextRound.at(0).username, loser: null };
            finishTournament(); return;
        }
        tourneyState.round++;
        tourneyState.queue = [...tourneyState.nextRound].sort(() => Math.random() - 0.5);
        tourneyState.nextRound = new Array();
        io.emit('message', { username: "Sammu's Bot", text: `🔥 **TOURNAMENT ROUND ${tourneyState.round}** begins with ${tourneyState.queue.length} players!` });
    }

    const pA = tourneyState.queue.shift(), pB = tourneyState.queue.shift();
    if (!pA || !pB) { finishTournament(); return; }

    tourneyState.gamesPlayed++;
    tourneyState.currentPair = { pA, pB, winner: null, loser: null };
    gameData.captainA = pA; gameData.captainB = pB;
    gameData.fighterA = pA.id; gameData.fighterB = pB.id;
    gameData.teamA = [pA]; gameData.teamB = [pB];

    const chosenGame = TOURNEY_GAME_POOL.at(Math.floor(Math.random() * TOURNEY_GAME_POOL.length));
    io.emit('message', {
        username: "Sammu's Bot",
        text: `🏟️ **TOURNEY MATCH #${tourneyState.gamesPlayed}/${tourneyState.maxGames}** (Round ${tourneyState.round})\n⚔️ 🔴 **${pA.username}** vs 🔵 **${pB.username}**\n🎮 Bot Selected: **${chosenGame.name}**!`
    });
    chosenGame.start(pA, pB);
}

function handleTournamentMatchEnd(winnerUsername) {
    if (!tourneyState.active || !tourneyState.currentPair) return;
    const { pA, pB } = tourneyState.currentPair;
    const cleanWin = (winnerUsername || "").toLowerCase();
    let winnerObj = pA, loserObj = pB;
    if (pB && cleanWin.includes(pB.username.toLowerCase())) { winnerObj = pB; loserObj = pA; }

    tourneyState.currentPair.winner = winnerObj.username;
    tourneyState.currentPair.loser = loserObj ? loserObj.username : null;
    tourneyState.matchScores[winnerObj.username] = (tourneyState.matchScores[winnerObj.username] || 0) + 1;
    if (loserObj && !tourneyState.eliminated.includes(loserObj.username)) tourneyState.eliminated.push(loserObj.username);

    const freshWinner = players.find(p => p.username.toLowerCase() === winnerObj.username.toLowerCase()) || winnerObj;
    tourneyState.nextRound.push(freshWinner);

    io.emit('message', { username: "Sammu's Bot", text: `✅ **${winnerObj.username}** advances in the Tournament! Next match starting in 4 seconds... ⏳` });
    tourneyTimer = setTimeout(() => { advanceTournament(); }, 4000);
}
io.on('connection', (socket) => {
    if (players.length === 0) hostId = socket.id;

    socket.on('joinRoom', (data) => {
        const finalizedName = (data && data.username && data.username.trim())
            ? data.username.trim()
            : ((sessionMemory[socket.id] && sessionMemory[socket.id].username) || "Player_" + Math.floor(Math.random() * 900 + 100));

        const devId = (data && data.deviceId) ? String(data.deviceId) : null;
        if (devId) socket.deviceId = devId;
        const realIp = getRealIP(socket);

        const isBanned = bannedUsers.has(finalizedName.toLowerCase()) ||
                         (devId && bannedDevices.has(devId)) ||
                         (realIp && bannedRealIPs.has(realIp));

        if (isBanned && !isWhitelisted(finalizedName)) {
            socket.emit('bannedNotice', 'You are permanently banned from this arena by the Host.');
            socket.disconnect(true);
            return;
        }

        const finalizedAvatar = (data && data.avatar) ? data.avatar : "🥷";
        const isReconnect = Boolean(data && data.isReconnect);

        socket.username = finalizedName;
        socket.avatar = finalizedAvatar;
        sessionMemory[socket.id] = { username: finalizedName, avatar: finalizedAvatar };

        if (hostUsername && hostUsername.toLowerCase() === finalizedName.toLowerCase()) {
            hostId = socket.id;
        } else if (players.length === 0) {
            hostId = socket.id;
            hostUsername = finalizedName;
        }

        const oldPlayer = players.find(p => p.username.toLowerCase() === finalizedName.toLowerCase());
        const oldId = oldPlayer ? oldPlayer.id : null;

        players = players.filter(p => p.id !== socket.id && p.username.toLowerCase() !== finalizedName.toLowerCase());
        const isHost = (socket.id === hostId);
        if (isHost) hostUsername = finalizedName;

        const newPlayerObj = { id: socket.id, username: finalizedName, avatar: finalizedAvatar, isHost };
        players.push(newPlayerObj);

        if (gameData.captainA && gameData.captainA.username.toLowerCase() === finalizedName.toLowerCase()) {
            gameData.captainA = newPlayerObj;
            if (oldId && gameData.fighterA === oldId) gameData.fighterA = socket.id;
            if (oldId && gameData.tttTurn === oldId) gameData.tttTurn = socket.id;
            if (oldId && gameData.bombHolder === oldId) gameData.bombHolder = socket.id;
            if (oldId && gameData.defuseTurn === oldId) gameData.defuseTurn = socket.id;
        }
        if (gameData.captainB && gameData.captainB.username.toLowerCase() === finalizedName.toLowerCase()) {
            gameData.captainB = newPlayerObj;
            if (oldId && gameData.fighterB === oldId) gameData.fighterB = socket.id;
            if (oldId && gameData.tttTurn === oldId) gameData.tttTurn = socket.id;
            if (oldId && gameData.bombHolder === oldId) gameData.bombHolder = socket.id;
            if (oldId && gameData.defuseTurn === oldId) gameData.defuseTurn = socket.id;
        }
        gameData.teamA = gameData.teamA.map(m => m.username.toLowerCase() === finalizedName.toLowerCase() ? newPlayerObj : m);
        gameData.teamB = gameData.teamB.map(m => m.username.toLowerCase() === finalizedName.toLowerCase() ? newPlayerObj : m);

        socket.emit('initRole', { isHost, gameData });
        io.emit('updatePlayers', players);
        io.emit('syncGame', gameData);
        broadcastMVP();
        socket.emit('updateGallery', botMemory.legendaryGallery);

        if (!isReconnect) {
            const avatarDisplay = finalizedAvatar.startsWith('data:image') ? '📸' : finalizedAvatar;
            io.emit('message', { username: "Sammu's Bot", text: `✨ Yo ${avatarDisplay} **${finalizedName}** joined! Type \`!emergency\`, \`!spin\`, \`!task\`, \`!anime\`, \`!shayari\`, or pet **🐱 Mochi** & **🐶 Tommy**! 🤖` });
        }
    });

    socket.emit('toggleDidiPromo', didiPromoActive);

    socket.on('chatImage', (payload) => {
        if (!payload || !payload.image || typeof payload.image !== 'string') return;
        const { name, avatar } = resolvePlayerIdentity(socket, payload);
        io.emit('message', { senderId: socket.id, username: name, avatar: avatar, text: payload.caption || '', imageUrl: payload.image });
    });

    socket.on('makeupCompleted', (data) => {
        const { name } = resolvePlayerIdentity(socket, data);
        addMVPPoints(name, 2);
        awardTrophy(name, "💄 Glam Artist");
        io.emit('message', {
            username: "Sammu's Bot",
            text: `✨💅 **SLAY QUEEN!** **${name}** uploaded a gorgeous **${data && data.mode === 'nails' ? 'Nail Salon' : 'Doll Makeover'}** look! (+2 MVP pts) 💖`
        });
    });

    socket.on('dishCompleted', (data) => {
        const { name } = resolvePlayerIdentity(socket, data);
        addMVPPoints(name, 2);
        awardTrophy(name, "👨‍🍳 MasterChef");
        const dishType = (data && data.mode === 'cake') ? 'Custom Cake 🎂' : 'MasterChef Pizza 🍕';
        io.emit('message', {
            username: "Sammu's Bot",
            text: `🍽️🔥 **ORDER UP!** Chef **${name}** just served a **${dishType}** to the lobby! (+2 MVP pts) 👨‍🍳✨`
        });
        setTimeout(() => {
            io.emit('message', {
                username: "🐶 Tommy (Dog)",
                text: `Woof woof!! 🐶🤤 *sniffs **${name}**'s ${dishType} and wags tail begging for a slice!* 🐾`
            });
        }, 500);
    });

    socket.on('triggerMemeSfx', (type) => {
        io.emit('playMemeSfx', type || 'airhorn');
    });

    socket.on('addToLegendaryGallery', (artObj) => {
        if (socket.id !== hostId || !artObj || !artObj.imageUrl) return;
        const entry = { id: Date.now().toString(), artist: artObj.artist || 'Unknown Artist', imageUrl: artObj.imageUrl };
        botMemory.legendaryGallery.unshift(entry);
        if (botMemory.legendaryGallery.length > 8) botMemory.legendaryGallery.pop();
        io.emit('updateGallery', botMemory.legendaryGallery);
        io.emit('message', { username: "Sammu's Bot", text: `🏛️ **HALL OF LEGENDARIES!** Host featured **${entry.artist}**'s masterpiece in the gallery! 🎨👑` });
    });

    socket.on('removeFromLegendaryGallery', (artId) => {
        if (socket.id !== hostId) return;
        botMemory.legendaryGallery = botMemory.legendaryGallery.filter(item => item.id !== artId);
        io.emit('updateGallery', botMemory.legendaryGallery);
    });

    socket.on('playMusicNote', (noteData) => {
        const { name } = resolvePlayerIdentity(socket, noteData);
        io.emit('incomingMusicNote', { type: noteData.type, freq: noteData.freq, label: noteData.label, player: name });
    });
    socket.on('chatMessage', (payload) => {
        const rawText = (typeof payload === 'object' && payload !== null) ? payload.text : payload;
        if (!rawText || typeof rawText !== 'string') return;

        const { name: senderName, avatar: senderAvatar } = resolvePlayerIdentity(socket, payload);
        const msg = rawText;
        const cleanMsg = msg.trim(), lowerMsg = cleanMsg.toLowerCase();

        const muteUntil = mutedUsers.get(senderName.toLowerCase());
        if (muteUntil && Date.now() < muteUntil) {
            const minsLeft = Math.ceil((muteUntil - Date.now()) / 60000);
            socket.emit('message', {
                username: "Sammu's Bot",
                text: `🤐 **${senderName}**, you are cursed by the Mystery Box! Chat mute ends in **${minsLeft} min(s)**.`
            });
            return;
        } else if (muteUntil) {
            mutedUsers.delete(senderName.toLowerCase());
        }

        if (cleanMsg === ADMIN_SECRET_KEY) {
            hostId = socket.id;
            hostUsername = senderName;
            players = players.map(p => ({ ...p, isHost: p.id === hostId }));
            socket.emit('initRole', { isHost: true, gameData });
            io.emit('updatePlayers', players); io.emit('syncGame', gameData);
            io.emit('message', { username: 'SYSTEM', text: `${senderName} has unlocked Host Admin Panel! 👑` });
            return;
        }

        if (socket.id === hostId && lowerMsg === '/mysterybox') {
            dropMysteryBox();
            return;
        }

        if (activeMysteryBox && cleanMsg.toUpperCase() === activeMysteryBox.code) {
            activeMysteryBox = null;
            io.emit('message', { senderId: socket.id, username: senderName, avatar: senderAvatar, text: msg });

            const roll = Math.floor(Math.random() * 7);
            setTimeout(() => {
                if (roll === 0) {
                    addMVPPoints(senderName, 3);
                    io.emit('message', { username: "Sammu's Bot", text: `🎉 **MYSTERY BOX OPENED!** **${senderName}** found **+3 MVP POINTS**! 🏆✨` });
                } else if (roll === 1) {
                    addMVPPoints(senderName, 5);
                    awardTrophy(senderName, "🎁 Mystery Hunter");
                    io.emit('message', { username: "Sammu's Bot", text: `💎 **MEGA JACKPOT!** **${senderName}** unlocked **+5 MVP POINTS** & the **Mystery Hunter** Trophy! 👑` });
                } else if (roll === 2) {
                    mutedUsers.set(senderName.toLowerCase(), Date.now() + 10 * 60 * 1000);
                    io.emit('message', { username: "Sammu's Bot", text: `🤐 **CURSED BOX!** **${senderName}** got hit with a **10-MINUTE CHAT BAN**! Silence in the lobby! 😂🔒` });
                } else if (roll === 3) {
                    io.emit('message', { senderId: socket.id, username: senderName, avatar: senderAvatar, text: "CLOWN", gifUrl: gifLibrary.clown });
                    io.emit('message', { username: "Sammu's Bot", text: `🤡 **CLOWN BOX!** **${senderName}** opened the box and turned into the lobby clown! 🎪😂` });
                } else if (roll === 4) {
                    const savage = roastBank.at(Math.floor(Math.random() * roastBank.length));
                    io.emit('message', { username: "Sammu's Bot", text: `🔥 **SAVAGE ROAST BOX!** **${senderName}** ${savage}` });
                } else if (roll === 5) {
                    const dare = dareBank.at(Math.floor(Math.random() * dareBank.length));
                    io.emit('message', { username: "Sammu's Bot", text: `🎭 **DARE BOX!** **${senderName}** must complete: **${dare}**` });
                } else {
                    addMVPPoints(senderName, 2);
                    io.emit('message', { username: "🐱 Mochi (Cat)", text: `Meoww~ 🐱💖 **${senderName}** found Mochi & Tommy's Golden Treat! **+2 MVP Points** & endless purrs! 🐶🦴` });
                }
            }, 300);
            return;
        }

        if (socket.id === hostId && lowerMsg.startsWith('/cap ')) {
            const parts = cleanMsg.slice(5).replace(/vs/i, ' ').trim().split(/\s+/);
            if (parts.length >= 2) {
                const pA = players.find(p => p.username.toLowerCase() === parts.at(0).toLowerCase());
                const pB = players.find(p => p.username.toLowerCase() === parts.at(1).toLowerCase());
                if (pA && pB && pA.id !== pB.id) {
                    gameData.captainA = pA; gameData.captainB = pB;
                    gameData.fighterA = pA.id; gameData.fighterB = pB.id;
                    gameData.teamA = [pA]; gameData.teamB = [pB];
                    gameData.gameState = 'lobby';
                    io.emit('syncGame', gameData);
                    io.emit('message', { username: "Sammu's Bot", text: `👑 **CAPTAINS LOCKED:** 🔴 **${pA.username}** vs 🔵 **${pB.username}**!` });
                } else {
                    socket.emit('message', { username: "Sammu's Bot", text: `⚠️ Could not find both players! Check exact names in the lobby.` });
                }
            }
            return;
        }
        if (socket.id === hostId && lowerMsg === '/random') {
            const nonHosts = players.filter(p => p.id !== hostId);
            if (nonHosts.length < 2) {
                socket.emit('message', { username: "Sammu's Bot", text: `⚠️ Need at least **2 non-host players** in the lobby to pick a random 1v1!` });
                return;
            }
            const shuffled = [...nonHosts].sort(() => Math.random() - 0.5);
            const pA = shuffled.at(0), pB = shuffled.at(1);
            gameData.captainA = pA; gameData.captainB = pB;
            gameData.fighterA = pA.id; gameData.fighterB = pB.id;
            gameData.teamA = [pA]; gameData.teamB = [pB];
            io.emit('syncGame', gameData);
            io.emit('message', {
                username: "Sammu's Bot",
                text: `🎲 **RANDOM 1v1 SELECTED!** 🔴 **${pA.username}** vs 🔵 **${pB.username}**! Host, launch any mini-game now! ⚔️`
            });
            return;
        }

        if (socket.id === hostId && (lowerMsg === '/tournament' || lowerMsg === '/tournamnet' || lowerMsg === '/tourney')) {
            startTournament();
            return;
        }
        if (socket.id === hostId && (lowerMsg === '/stoptournament' || lowerMsg === '/stoptourney')) {
            tourneyState.active = false;
            if (tourneyTimer) clearTimeout(tourneyTimer);
            io.emit('message', { username: "Sammu's Bot", text: `🛑 Host stopped the Tournament.` });
            return;
        }
        if (socket.id === hostId && (lowerMsg === '/promo on' || lowerMsg === '/promo off')) {
            didiPromoActive = (lowerMsg === '/promo on');
            io.emit('toggleDidiPromo', didiPromoActive);
            socket.emit('message', { username: 'SYSTEM', text: `📢 Entry Screen Didi Banner is now **${didiPromoActive ? 'ON ✅' : 'OFF ❌'}**` });
            return;
        }

        if (socket.id === hostId && lowerMsg.startsWith('/ban ')) {
            const targetName = cleanMsg.slice(5).replace('@', '').trim();
            if (!targetName) return;
            if (isWhitelisted(targetName)) {
                socket.emit('message', { username: 'SYSTEM', text: `🛡️ **${targetName}** is VIP Whitelisted and cannot be banned!` });
                return;
            }
            const targetPlayer = players.find(p => p.username.toLowerCase() === targetName.toLowerCase());
            bannedUsers.add(targetName.toLowerCase());
            if (targetPlayer) {
                const targetSocket = io.sockets.sockets.get(targetPlayer.id);
                if (targetSocket) {
                    if (targetSocket.deviceId) bannedDevices.add(targetSocket.deviceId);
                    const realIp = getRealIP(targetSocket);
                    if (realIp && realIp !== getRealIP(socket)) bannedRealIPs.add(realIp);
                    targetSocket.emit('bannedNotice', 'You were permanently banned from this arena by the Host.');
                    targetSocket.disconnect(true);
                }
            }
            io.emit('message', { username: 'SYSTEM', text: `🔨 Host banned **${targetName}** from the arena!` });
            return;
        }

        if (socket.id === hostId && lowerMsg.startsWith('/unban ')) {
            const targetName = cleanMsg.slice(7).replace('@', '').trim();
            bannedUsers.delete(targetName.toLowerCase());
            bannedDevices.clear();
            bannedRealIPs.clear();
            io.emit('message', { username: 'SYSTEM', text: `✅ Host unbanned **${targetName}**!` });
            return;
        }

        if (socket.id === hostId && lowerMsg.startsWith('/songtask ')) {
            const kw = cleanMsg.slice(10).trim().toLowerCase();
            if (kw) {
                botMemory.customTask = { keyword: kw, prompt: `🎵 CAPTAIN SONG CHALLENGE: Type a Hindi/Bollywood song with the word **"${kw.toUpperCase()}"**!` };
                io.emit('message', { username: "Sammu's Bot", text: botMemory.customTask.prompt });
            }
            return;
        }

        if (socket.id === hostId && lowerMsg.startsWith('/settask ')) {
            const promptText = cleanMsg.slice(9).trim();
            if (promptText) {
                botMemory.customTask = { keyword: null, prompt: `👑 HOST CAPTAIN TASK: **${promptText}** *(Host types \`/win a\` or \`/win b\` to award point!)*` };
                io.emit('message', { username: "Sammu's Bot", text: botMemory.customTask.prompt });
            }
            return;
        }

        if (socket.id === hostId && (lowerMsg === '/win a' || lowerMsg === '/win b')) {
            botMemory.customTask = null;
            if (lowerMsg === '/win a') {
                gameData.scores.teamA++;
                const capName = gameData.captainA ? gameData.captainA.username : "🔴 Team A";
                recordWin(capName, '👑', gameData.captainA ? gameData.captainA.username : null, "🎵 Task Champion");
            } else {
                gameData.scores.teamB++;
                const capName = gameData.captainB ? gameData.captainB.username : "🔵 Team B";
                recordWin(capName, '👑', gameData.captainB ? gameData.captainB.username : null, "🎵 Task Champion");
            }
            io.emit('syncGame', gameData);
            return;
        }

        if (lowerMsg.startsWith('/gif')) {
            const key = lowerMsg.replace('/gif', '').trim() || 'fire';
            const gifUrl = gifLibrary[key] || gifLibrary.fire;
            io.emit('message', { senderId: socket.id, username: senderName, avatar: senderAvatar, text: key.toUpperCase(), gifUrl });
            return;
        }
        io.emit('message', { senderId: socket.id, username: senderName, avatar: senderAvatar, text: msg });
        botMemory.chatCount++;

        if (handleAyurvedaClinic(senderName, lowerMsg)) return;
        handlePetBots(senderName, lowerMsg);

        if (lowerMsg === '!promote') {
            setTimeout(() => {
                io.emit('message', { username: "Sammu's Bot", text: `subscribe to verma_diary_18 ❤️` });
            }, 250);
            return;
        }

        if (lowerMsg === '!spin' || lowerMsg === '!slots') {
            const reels = new Array('💎', '👑', '🔥', '🐱', '💣');
            const r1 = reels.at(Math.floor(Math.random() * reels.length));
            const r2 = reels.at(Math.floor(Math.random() * reels.length));
            const r3 = reels.at(Math.floor(Math.random() * reels.length));
            setTimeout(() => {
                if (r1 === r2 && r2 === r3 && r1 !== '💣') {
                    addMVPPoints(senderName, 5);
                    awardTrophy(senderName, "🎰 High Roller");
                    io.emit('message', { username: "Sammu's Bot", text: `🎰 **[ ${r1} | ${r2} | ${r3} ]** — **JACKPOT!!** **${senderName}** hit triple ${r1} and won **+5 MVP Points**! 🏆🔥` });
                } else if (r1 === '💣' && r2 === '💣' && r3 === '💣') {
                    io.emit('message', { username: "Sammu's Bot", text: `🎰 **[ 💣 | 💣 | 💣 ]** — **KABOOM!** **${senderName}** blew up the slot machine! 💀😂` });
                } else if (r1 === r2 || r2 === r3 || r1 === r3) {
                    addMVPPoints(senderName, 1);
                    io.emit('message', { username: "Sammu's Bot", text: `🎰 **[ ${r1} | ${r2} | ${r3} ]** — Double match for **${senderName}**! **+1 MVP Point**! ✨` });
                } else {
                    io.emit('message', { username: "Sammu's Bot", text: `🎰 **[ ${r1} | ${r2} | ${r3} ]** — No match for **${senderName}**, try again! 🎲` });
                }
            }, 300);
            return;
        }

        if (botMemory.customTask && botMemory.customTask.keyword) {
            const words = lowerMsg.split(/\s+/).filter(w => w.replace(/[^a-z]/g, '').length > 0);
            const matched = words.some(w => w.replace(/[^a-z]/g, '').includes(botMemory.customTask.keyword)) && words.length >= 3;
            if (matched) {
                botMemory.customTask = null;
                addMVPPoints(senderName, 2);
                awardTrophy(senderName, "🎵 Bollywood Star");
                if (gameData.captainA && gameData.captainA.username === senderName) { gameData.scores.teamA++; io.emit('syncGame', gameData); }
                else if (gameData.captainB && gameData.captainB.username === senderName) { gameData.scores.teamB++; io.emit('syncGame', gameData); }
                setTimeout(() => { io.emit('message', { username: "Sammu's Bot", text: `🎶 **NAILED IT!** **${senderName}** dropped the song! +2 MVP Points! 🏆` }); }, 300);
                return;
            }
        }

        const mathAns = solveAnyMath(cleanMsg);
        if (mathAns !== null) {
            setTimeout(() => { io.emit('message', { username: "Sammu's Bot", text: `🧮 Easy math, ${senderName}! **${cleanMsg} = ${mathAns}** ⚡` }); }, 300);
            return;
        }

        if (botMemory.activeTask && checkTaskSubmission(cleanMsg, botMemory.activeTask)) {
            const isSong = Boolean(botMemory.activeTask.songKeyword);
            botMemory.activeTask = null;
            addMVPPoints(senderName, 2);
            awardTrophy(senderName, isSong ? "🎵 Bollywood Star" : "⚡ Task King");
            if (gameData.captainA && gameData.captainA.username === senderName) { gameData.scores.teamA++; io.emit('syncGame', gameData); }
            else if (gameData.captainB && gameData.captainB.username === senderName) { gameData.scores.teamB++; io.emit('syncGame', gameData); }
            setTimeout(() => { io.emit('message', { username: "Sammu's Bot", text: `🔥 **TASK CRUSHED** by **${senderName}**! +2 MVP Points! 🏆` }); }, 300);
            return;
        }
        if (botMemory.activeQuiz && lowerMsg.includes(botMemory.activeQuiz.a)) {
            const solvedAns = botMemory.activeQuiz.a.toUpperCase();
            botMemory.activeQuiz = null;
            addMVPPoints(senderName, 1);
            awardTrophy(senderName, "🧠 Quiz Master");
            setTimeout(() => { io.emit('message', { username: "Sammu's Bot", text: `🎉 **BINGO!** **${senderName}** solved it (**${solvedAns}**)! +1 MVP Point! 🏆` }); }, 300);
            return;
        }

        if (botMemory.activeRiddle && lowerMsg.includes(botMemory.activeRiddle.a)) {
            const solvedAns = botMemory.activeRiddle.a.toUpperCase();
            botMemory.activeRiddle = null;
            addMVPPoints(senderName, 1);
            awardTrophy(senderName, "❓ Riddle Solver");
            setTimeout(() => { io.emit('message', { username: "Sammu's Bot", text: `🧠 **GENIUS!** **${senderName}** cracked the riddle (**${solvedAns}**)! +1 MVP Point! 🏆` }); }, 300);
            return;
        }

        if (botMemory.activeMovie && (lowerMsg.includes(botMemory.activeMovie.a) || lowerMsg.includes(botMemory.activeMovie.alt))) {
            const movieTitle = botMemory.activeMovie.alt.toUpperCase();
            botMemory.activeMovie = null;
            addMVPPoints(senderName, 2);
            awardTrophy(senderName, "🎬 Bollywood Buff");
            setTimeout(() => { io.emit('message', { username: "Sammu's Bot", text: `🎬 **BLOCKBUSTER GUESS!** **${senderName}** guessed **${movieTitle}**! +2 MVP Points! 🏆` }); }, 300);
            return;
        }

        if (botMemory.activeUnscramble && lowerMsg === botMemory.activeUnscramble.toLowerCase()) {
            const solvedWord = botMemory.activeUnscramble.toUpperCase();
            botMemory.activeUnscramble = null;
            addMVPPoints(senderName, 1);
            setTimeout(() => { io.emit('message', { username: "Sammu's Bot", text: `🔤 **FASTEST FINGERS!** **${senderName}** unscrambled **${solvedWord}**! +1 MVP Point! ⚡` }); }, 250);
            return;
        }

        if (botMemory.activeWordChain && !lowerMsg.startsWith('!') && !lowerMsg.startsWith('/')) {
            const cleanWord = lowerMsg.replace(/[^a-z]/g, '');
            const reqLetter = botMemory.activeWordChain.lastLetter;
            if (cleanWord.length >= 3 && cleanWord.startsWith(reqLetter) && !botMemory.activeWordChain.used.has(cleanWord)) {
                botMemory.activeWordChain.used.add(cleanWord);
                const nextLetter = cleanWord.at(-1);
                botMemory.activeWordChain.lastLetter = nextLetter;
                botMemory.activeWordChain.count++;
                addMVPPoints(senderName, 1);
                setTimeout(() => {
                    io.emit('message', {
                        username: "Sammu's Bot",
                        text: `🔗 **${senderName}** chained **${cleanWord.toUpperCase()}** (+1 pt)! Next word must start with **"${nextLetter.toUpperCase()}"**! (Chain: ${botMemory.activeWordChain.count})`
                    });
                }, 250);
                return;
            }
        }

        if (lowerMsg === '!task') {
            const chosen = botTasks.at(Math.floor(Math.random() * botTasks.length));
            botMemory.activeTask = chosen;
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: chosen.text }), 300);
        } else if (lowerMsg === '!song') {
            const songTasks = botTasks.filter(t => t.songKeyword);
            const chosen = songTasks.at(Math.floor(Math.random() * songTasks.length));
            botMemory.activeTask = chosen;
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: chosen.text }), 300);
        } else if (lowerMsg === '!quiz') {
            const chosen = quizBank.at(Math.floor(Math.random() * quizBank.length));
            botMemory.activeQuiz = chosen;
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `${chosen.q} *(Type the answer or \`!hint\`!)*` }), 300);
        } else if (lowerMsg === '!anime') {
            const chosen = animeQuizBank.at(Math.floor(Math.random() * animeQuizBank.length));
            botMemory.activeQuiz = chosen;
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `${chosen.q} *(Type the answer or \`!hint\`!)*` }), 300);
        } else if (lowerMsg === '!movie') {
            const chosen = hindiMovieBank.at(Math.floor(Math.random() * hindiMovieBank.length));
            botMemory.activeMovie = chosen;
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `🎬 **GUESS THE HINDI MOVIE:** ${chosen.emojis} *(Type the movie name in chat!)*` }), 300);
        } else if (lowerMsg === '!shayari') {
            const chosen = shayariBank.at(Math.floor(Math.random() * shayariBank.length));
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: chosen }), 300);
        } else if (lowerMsg === '!unscramble') {
            const s = generateScramble();
            botMemory.activeUnscramble = s.answer;
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `🔤 **UNSCRAMBLE BLITZ:** Unscramble **[ ${s.scrambled} ]** in chat for +1 MVP Point! ⚡` }), 250);
        } else if (lowerMsg === '!word' || lowerMsg === '!wordchain') {
            const starters = new Array("arena", "dragon", "sammu", "trophy", "rocket", "ninja", "music");
            const firstWord = starters.at(Math.floor(Math.random() * starters.length));
            const nextLetter = firstWord.at(-1);
            botMemory.activeWordChain = { lastLetter: nextLetter, used: new Set([firstWord]), count: 1 };
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `🔗 **WORD CHAIN STARTED!** Starting word: **${firstWord.toUpperCase()}** -> Type any 3+ letter word starting with **"${nextLetter.toUpperCase()}"**! (Type \`!stopword\` to end)` }), 250);
        } else if (lowerMsg === '!stopword') {
            botMemory.activeWordChain = null;
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `🛑 Word Chain ended!` }), 200);
        } else if (lowerMsg === '!riddle') {
            const chosen = riddleBank.at(Math.floor(Math.random() * riddleBank.length));
            botMemory.activeRiddle = chosen;
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `${chosen.q} *(Type the answer or \`!hint\`!)*` }), 300);
        } else if (lowerMsg === '!hint') {
            const active = botMemory.activeQuiz || botMemory.activeRiddle;
            const hintMsg = active ? `💡 **HINT:** Starts with **"${active.a.at(0).toUpperCase()}"** and has **${active.a.length} letters**!` : `💡 No active quiz or riddle right now! Type \`!quiz\`, \`!anime\`, or \`!riddle\` first!`;
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: hintMsg }), 250);
        } else if (lowerMsg.startsWith('!roast')) {
            const target = cleanMsg.replace(/!roast/i, '').replace('@', '').trim() || senderName;
            const line = roastBank.at(Math.floor(Math.random() * roastBank.length));
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `🔥 **${target}** ${line}` }), 300);
        } else if (lowerMsg === '!truth') {
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: truthBank.at(Math.floor(Math.random() * truthBank.length)) }), 300);
        } else if (lowerMsg === '!dare') {
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: dareBank.at(Math.floor(Math.random() * dareBank.length)) }), 300);
        } else if (lowerMsg.startsWith('!8ball')) {
            const answers = new Array("100% Pakka Yes! ✅", "Without a doubt bro! 🔥", "Ask again later... 🤔", "Sapne mat dekh 💀", "No chance! ❌", "Signs point to YES! 🎯");
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `🎱 ${answers.at(Math.floor(Math.random() * answers.length))}` }), 300);
        } else if (lowerMsg === '!gifs') {
            const list = Object.keys(gifLibrary).map(k => `/gif ${k}`).join(', ');
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `🎬 **50 Animated GIFs:** ${list}` }), 250);
        } else if (lowerMsg === '!trophies' || lowerMsg === '!mvp') {
            const top = Object.entries(botMemory.playerPoints).sort((a, b) => b.at(1) - a.at(1)).slice(0, 5);
            const summary = top.length ? top.map((entry, i) => `#${i + 1} **${entry.at(0)}** (${entry.at(1)} pts ${(botMemory.trophies[entry.at(0)] || []).join(' ')})`).join(' | ') : "No trophies yet! Win an arena or solve !quiz / !task!";
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `🏆 **TROPHY & MVP HALL:** ${summary}` }), 250);
        } else if (lowerMsg.includes('sammu') || lowerMsg.includes('bot') || lowerMsg.includes('bro') || lowerMsg.startsWith('ai ') || cleanMsg.endsWith('?')) {
            const reply = thinkAndReply(senderName, cleanMsg, gameData.scores, players);
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: reply }), 400);
        }
    });
    socket.on('banPlayer', (targetId) => {
        if (socket.id !== hostId) return;
        const targetPlayer = players.find(p => p.id === targetId);
        if (!targetPlayer || targetPlayer.id === hostId) return;
        if (isWhitelisted(targetPlayer.username)) {
            socket.emit('message', { username: 'SYSTEM', text: `🛡️ **${targetPlayer.username}** is VIP Whitelisted and cannot be banned!` });
            return;
        }
        bannedUsers.add(targetPlayer.username.toLowerCase());
        const targetSocket = io.sockets.sockets.get(targetId);
        if (targetSocket) {
            if (targetSocket.deviceId) bannedDevices.add(targetSocket.deviceId);
            const realIp = getRealIP(targetSocket);
            if (realIp && realIp !== getRealIP(socket)) bannedRealIPs.add(realIp);
            targetSocket.emit('bannedNotice', 'You were permanently banned from this arena by the Host.');
            targetSocket.disconnect(true);
        }
        io.emit('message', { username: 'SYSTEM', text: `🔨 Host banned **${targetPlayer.username}** from the arena!` });
    });

    socket.on('awardTeamPoint', (team) => {
        if (socket.id !== hostId) return;
        botMemory.customTask = null;
        if (team === 'A') {
            gameData.scores.teamA++;
            const name = gameData.captainA ? gameData.captainA.username : "🔴 Team A";
            recordWin(name, '👑', gameData.captainA ? gameData.captainA.username : null, "🎵 Task Champion");
        } else if (team === 'B') {
            gameData.scores.teamB++;
            const name = gameData.captainB ? gameData.captainB.username : "🔵 Team B";
            recordWin(name, '👑', gameData.captainB ? gameData.captainB.username : null, "🎵 Task Champion");
        }
        io.emit('syncGame', gameData);
    });

    socket.on('makeCaptains', (data) => {
        if (socket.id !== hostId) return;
        const capAObj = players.find(p => p.id === data.capA || p.username.toLowerCase() === String(data.capA).toLowerCase());
        const capBObj = players.find(p => p.id === data.capB || p.username.toLowerCase() === String(data.capB).toLowerCase());
        if (!capAObj || !capBObj) return;
        if (capAObj.id === capBObj.id) {
            socket.emit('message', { username: "Sammu's Bot", text: `⚠️ Pick two **different** players for Captain A and Captain B!` });
            return;
        }
        gameData.captainA = capAObj;
        gameData.captainB = capBObj;
        gameData.fighterA = capAObj.id;
        gameData.fighterB = capBObj.id;
        gameData.teamA = [capAObj];
        gameData.teamB = [capBObj];
        gameData.gameState = 'lobby';
        io.emit('syncGame', gameData);
        io.emit('message', {
            username: "Sammu's Bot",
            text: `👑 **CAPTAINS LOCKED BY HOST:** 🔴 **${capAObj.username}** vs 🔵 **${capBObj.username}**! Launch any mini-game now! ⚔️`
        });
    });

    socket.on('draftPlayer', (playerId) => {
        if (gameData.gameState !== 'drafting' || socket.id !== gameData.currentTurnPicker) return;
        const targetPlayer = players.find(p => p.id === playerId);
        if (!targetPlayer || gameData.teamA.some(p => p.id === playerId) || gameData.teamB.some(p => p.id === playerId)) return;
        if (socket.id === gameData.captainA.id) { gameData.teamA.push(targetPlayer); gameData.currentTurnPicker = gameData.captainB.id; }
        else if (socket.id === gameData.captainB.id) { gameData.teamB.push(targetPlayer); gameData.currentTurnPicker = gameData.captainA.id; }
        io.emit('syncGame', gameData);
    });

    function recordWin(winnerName, icon, mvpUsername, customTrophy) {
        botMemory.lastWinner = winnerName;
        if (mvpUsername) {
            botMemory.winStreaks[mvpUsername] = (botMemory.winStreaks[mvpUsername] || 0) + 1;
            Object.keys(botMemory.winStreaks).forEach(k => { if (k !== mvpUsername) botMemory.winStreaks[k] = 0; });
            addMVPPoints(mvpUsername, 3);
            awardTrophy(mvpUsername, customTrophy || "🏆 Arena Champ");
            if (botMemory.winStreaks[mvpUsername] >= 3) awardTrophy(mvpUsername, "🔥 3x Win Streak");
        }
        io.emit('announceWinner', { winner: winnerName, icon });
        const streakNote = (mvpUsername && botMemory.winStreaks[mvpUsername] >= 2) ? ` (**${botMemory.winStreaks[mvpUsername]}x WIN STREAK!** 🔥)` : '';
        setTimeout(() => {
            io.emit('message', { username: "Sammu's Bot", text: `🏆 **${winnerName}** wins the match (+3 MVP pts)${streakNote}! Who wants the next smoke? 👀` });
        }, 500);

        if (tourneyState.active) {
            handleTournamentMatchEnd(mvpUsername || winnerName);
        }
    }
    socket.on('assignFighters', (data) => {
        if (socket.id !== hostId) return;
        clearAllTimers();
        ensureCaptains();

        const fA = (data && data.fightA ? players.find(p => p.id === data.fightA) : null) || gameData.captainA;
        const fB = (data && data.fightB ? players.find(p => p.id === data.fightB) : null) || gameData.captainB;

        if (!fA || !fB) {
            socket.emit('message', { username: "Sammu's Bot", text: `⚠️ Need at least **2 players** in the lobby to start Tic-Tac-Toe!` });
            return;
        }

        gameData.fighterA = fA.id;
        gameData.fighterB = fB.id;
        gameData.captainA = fA;
        gameData.captainB = fB;
        if (!gameData.teamA.some(p => p.id === fA.id)) gameData.teamA = [fA];
        if (!gameData.teamB.some(p => p.id === fB.id)) gameData.teamB = [fB];

        gameData.tttBoard = Array(9).fill(null);
        gameData.tttTurn = fA.id;
        gameData.gameState = 'duel';
        io.emit('syncGame', gameData);
        io.emit('message', { username: "Sammu's Bot", text: `⚔️ **MATCHUP (Tic-Tac-Toe Duel):** ❌ **${fA.username}** vs ⭕ **${fB.username}**! ❌ goes first!` });
    });

    socket.on('makeMove', (index) => {
        if (gameData.gameState !== 'duel') return;
        const idx = Number(index);
        if (isNaN(idx) || idx < 0 || idx > 8 || gameData.tttBoard[idx] !== null) return;

        const isFighterA = (socket.id === gameData.fighterA) || (gameData.captainA && socket.id === gameData.captainA.id);
        const isFighterB = (socket.id === gameData.fighterB) || (gameData.captainB && socket.id === gameData.captainB.id);

        if (socket.id !== gameData.tttTurn) {
            if (!(isFighterA && gameData.tttTurn === gameData.fighterA) && !(isFighterB && gameData.tttTurn === gameData.fighterB)) {
                return;
            }
        }

        gameData.tttBoard[idx] = isFighterA ? 'X' : 'O';
        const name = sessionMemory[socket.id] ? sessionMemory[socket.id].username : "Fighter";

        if (checkWin(gameData.tttBoard)) {
            if (isFighterA) gameData.scores.teamA++; else gameData.scores.teamB++;
            recordWin(name, '⚔️', name, "⚔️ TTT Master");
            gameData.gameState = 'lobby';
        } else if (!gameData.tttBoard.includes(null)) {
            io.emit('announceWinner', { winner: 'Tie Game', icon: null });
            gameData.gameState = 'lobby';
            if (tourneyState.active) {
                const tieWinner = gameData.captainA ? gameData.captainA.username : "Player A";
                handleTournamentMatchEnd(tieWinner);
            }
        } else {
            gameData.tttTurn = isFighterA ? gameData.fighterB : gameData.fighterA;
        }
        io.emit('syncGame', gameData);
    });

    socket.on('launchSumo', () => {
        if (socket.id === hostId) {
            ensureCaptains(); clearAllTimers();
            gameData.gameState = 'sumo'; gameData.sumoPosition = 50;
            io.emit('syncGame', gameData);
            announceMatchup("🤼 Sumo Push");
        }
    });
    socket.on('sumoPush', () => {
        if (gameData.gameState !== 'sumo') return;
        if (gameData.captainA && socket.id === gameData.captainA.id) gameData.sumoPosition -= 3.5;
        else if (gameData.captainB && socket.id === gameData.captainB.id) gameData.sumoPosition += 3.5;
        if (gameData.sumoPosition <= 10) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (🔴 Team A)", '🏆', gameData.captainA.username, "🤼 Sumo King"); gameData.gameState = 'lobby'; }
        else if (gameData.sumoPosition >= 90) { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (🔵 Team B)", '🏆', gameData.captainB.username, "🤼 Sumo King"); gameData.gameState = 'lobby'; }
        io.emit('syncGame', gameData);
    });

    socket.on('launchSpinner', () => {
        if (socket.id !== hostId) return;
        ensureCaptains(); if (!gameData.captainA) return;
        clearAllTimers(); spinnerEnded = false; gameData.gameState = 'spinner';
        gameData.spinner = { a: { x: 80, y: 130, vx: 0, vy: 0 }, b: { x: 180, y: 130, vx: 0, vy: 0 } };
        io.emit('syncGame', gameData); io.emit('spinnerTick', gameData.spinner);
        announceMatchup("🌀 Spinner Clash");
    });

    socket.on('spinnerMove', (data) => {
        if (gameData.gameState !== 'spinner') return;
        const force = 4.2;
        let p = null;
        if ((gameData.captainA && socket.id === gameData.captainA.id) || gameData.teamA.some(m => m.id === socket.id)) p = gameData.spinner.a;
        else if ((gameData.captainB && socket.id === gameData.captainB.id) || gameData.teamB.some(m => m.id === socket.id)) p = gameData.spinner.b;
        if (!p) return;
        if (data === 'up') p.vy = Math.max(-14, p.vy - force);
        if (data === 'down') p.vy = Math.min(14, p.vy + force);
        if (data === 'left') p.vx = Math.max(-14, p.vx - force);
        if (data === 'right') p.vx = Math.min(14, p.vx + force);
    });

    socket.on('launchQuickDraw', () => {
        if (socket.id !== hostId) return;
        ensureCaptains(); if (!gameData.captainA) return;
        clearAllTimers(); gameData.gameState = 'quickdraw'; gameData.drawReady = false; io.emit('syncGame', gameData);
        announceMatchup("🤠 Quick-Draw");
        drawTimer = setTimeout(() => { if (gameData.gameState === 'quickdraw') { gameData.drawReady = true; io.emit('syncGame', gameData); } }, Math.floor(Math.random() * 3500) + 2000);
    });
    socket.on('quickDrawFire', () => {
        if (gameData.gameState !== 'quickdraw') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if (!isA && !isB) return;
        clearAllTimers();
        if (!gameData.drawReady) {
            if (isA) { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Opponent fouled!)", '🤠', gameData.captainB.username, "🤠 Quick-Draw Ace"); }
            else { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Opponent fouled!)", '🤠', gameData.captainA.username, "🤠 Quick-Draw Ace"); }
        } else {
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Fastest Draw!)", '🔫', gameData.captainA.username, "🤠 Quick-Draw Ace"); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Fastest Draw!)", '🔫', gameData.captainB.username, "🤠 Quick-Draw Ace"); }
        }
        gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
    });

    socket.on('launchMath', () => {
        if (socket.id === hostId) {
            ensureCaptains(); clearAllTimers();
            gameData.gameState = 'math'; gameData.mathQ = generateMath();
            io.emit('syncGame', gameData);
            announceMatchup("🧮 Math Blitz");
        }
    });
    socket.on('submitMath', (val) => {
        if (gameData.gameState !== 'math') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if ((isA || isB) && Number(val) === gameData.mathQ.answer) {
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (🔴 Team A)", '🧠', gameData.captainA.username, "🧮 Math Genius"); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (🔵 Team B)", '🧠', gameData.captainB.username, "🧮 Math Genius"); }
            gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
        }
    });
    socket.on('launchBomb', () => {
        if (socket.id !== hostId) return;
        ensureCaptains(); if (!gameData.captainA) return;
        clearAllTimers(); gameData.gameState = 'bomb'; gameData.bombHolder = Math.random() < 0.5 ? gameData.captainA.id : gameData.captainB.id; io.emit('syncGame', gameData);
        announceMatchup("💣 Bomb Pass");
        bombTimer = setTimeout(() => {
            if (gameData.gameState !== 'bomb') return;
            if (gameData.bombHolder === gameData.captainA.id) { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Bomb exploded on Red! 💥)", '💣', gameData.captainB.username, "💣 Bomb Survivor"); }
            else { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Bomb exploded on Blue! 💥)", '💣', gameData.captainA.username, "💣 Bomb Survivor"); }
            gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
        }, Math.floor(Math.random() * 9000) + 7000);
    });
    socket.on('passBomb', () => { if (gameData.gameState === 'bomb' && socket.id === gameData.bombHolder) { gameData.bombHolder = (socket.id === gameData.captainA.id) ? gameData.captainB.id : gameData.captainA.id; io.emit('syncGame', gameData); } });

    socket.on('launchRPS', () => {
        if (socket.id === hostId) {
            ensureCaptains(); clearAllTimers();
            gameData.gameState = 'rps'; gameData.rpsChoices = { a: null, b: null };
            io.emit('syncGame', gameData);
            announceMatchup("🪨 Rock Paper Scissors");
        }
    });
    socket.on('pickRPS', (choice) => {
        if (gameData.gameState !== 'rps') return;
        if (gameData.captainA && socket.id === gameData.captainA.id) gameData.rpsChoices.a = choice;
        else if (gameData.captainB && socket.id === gameData.captainB.id) gameData.rpsChoices.b = choice;
        else return;
        const { a, b } = gameData.rpsChoices;
        if (a && b) {
            if (a === b) { io.emit('message', { username: "Sammu's Bot", text: `🤝 Both picked ${a}! Rematch!` }); gameData.rpsChoices = { a: null, b: null }; }
            else if ((a === '🪨' && b === '✂️') || (a === '📄' && b === '🪨') || (a === '✂️' && b === '📄')) { gameData.scores.teamA++; recordWin(`${gameData.captainA.username} (${a} beats ${b})`, '🏆', gameData.captainA.username); gameData.gameState = 'lobby'; }
            else { gameData.scores.teamB++; recordWin(`${gameData.captainB.username} (${b} beats ${a})`, '🏆', gameData.captainB.username); gameData.gameState = 'lobby'; }
        }
        io.emit('syncGame', gameData);
    });

    socket.on('launchMemory', () => {
        if (socket.id !== hostId) return;
        ensureCaptains(); clearAllTimers(); gameData.gameState = 'memory'; gameData.memoryHidden = false;
        gameData.memoryGrid = new Array('🦁','🤖','👽','🔥','👑','💀','🍕','🚀','💎').sort(() => Math.random() - 0.5);
        gameData.memoryTarget = gameData.memoryGrid.at(Math.floor(Math.random() * 9)); io.emit('syncGame', gameData);
        announceMatchup("🧠 Emoji Memory");
        memoryTimer = setTimeout(() => { if (gameData.gameState === 'memory') { gameData.memoryHidden = true; io.emit('syncGame', gameData); } }, 2800);
    });
    socket.on('pickMemory', (idx) => {
        if (gameData.gameState !== 'memory' || !gameData.memoryHidden) return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if ((isA || isB) && gameData.memoryGrid.at(idx) === gameData.memoryTarget) {
            clearAllTimers();
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Found " + gameData.memoryTarget + "!)", '✨', gameData.captainA.username); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Found " + gameData.memoryTarget + "!)", '✨', gameData.captainB.username); }
            gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
        }
    });

    socket.on('launchTug', () => {
        if (socket.id === hostId) {
            ensureCaptains(); clearAllTimers();
            gameData.gameState = 'tug'; gameData.tugPosition = 50;
            io.emit('syncGame', gameData);
            announceMatchup("🪢 Team Tug of War");
        }
    });
    socket.on('tugPull', () => {
        if (gameData.gameState !== 'tug') return;
        if (gameData.teamA.some(p => p.id === socket.id)) gameData.tugPosition -= 2.5;
        else if (gameData.teamB.some(p => p.id === socket.id)) gameData.tugPosition += 2.5;
        else return;
        if (gameData.tugPosition <= 10) { gameData.scores.teamA++; recordWin("🔴 Team A Pulled the Rope!", '🪢', gameData.captainA ? gameData.captainA.username : null); gameData.gameState = 'lobby'; }
        else if (gameData.tugPosition >= 90) { gameData.scores.teamB++; recordWin("🔵 Team B Pulled the Rope!", '🪢', gameData.captainB ? gameData.captainB.username : null); gameData.gameState = 'lobby'; }
        io.emit('syncGame', gameData);
    });

    socket.on('launchColorTrap', () => {
        if (socket.id === hostId) {
            ensureCaptains(); clearAllTimers();
            gameData.gameState = 'colortrap'; gameData.colorTrap = generateColorTrap();
            io.emit('syncGame', gameData);
            announceMatchup("🎨 Color Trap");
        }
    });
    socket.on('pickColorTrap', (colorName) => {
        if (gameData.gameState !== 'colortrap' || !gameData.colorTrap) return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if (!isA && !isB) return;
        if (colorName === gameData.colorTrap.targetName) {
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Fastest Reflex!)", '🎨', gameData.captainA.username); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Fastest Reflex!)", '🎨', gameData.captainB.username); }
        } else {
            if (isA) { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Red fell for Color Trap!)", '🎨', gameData.captainB.username); }
            else { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Blue fell for Color Trap!)", '🎨', gameData.captainA.username); }
        }
        gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
    });
    socket.on('launchScramble', () => {
        if (socket.id !== hostId) return;
        ensureCaptains(); clearAllTimers(); const s = generateScramble();
        gameData.gameState = 'scramble'; gameData.scrambleWord = s.scrambled; gameData.scrambleAnswer = s.answer;
        io.emit('syncGame', gameData);
        announceMatchup("🔤 Word Scramble");
    });
    socket.on('submitScramble', (guess) => {
        if (gameData.gameState !== 'scramble') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if ((isA || isB) && guess.toUpperCase().trim() === gameData.scrambleAnswer) {
            if (isA) { gameData.scores.teamA++; recordWin(`${gameData.captainA.username} (${gameData.scrambleAnswer})`, '🔤', gameData.captainA.username); }
            else { gameData.scores.teamB++; recordWin(`${gameData.captainB.username} (${gameData.scrambleAnswer})`, '🔤', gameData.captainB.username); }
            gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
        }
    });

    socket.on('launchDice', () => {
        if (socket.id === hostId) {
            ensureCaptains(); clearAllTimers();
            gameData.gameState = 'dice'; gameData.diceRolls = { a: null, b: null };
            io.emit('syncGame', gameData);
            announceMatchup("🎲 High Dice Duel");
        }
    });
    socket.on('rollArenaDice', () => {
        if (gameData.gameState !== 'dice') return;
        if (gameData.captainA && socket.id === gameData.captainA.id && !gameData.diceRolls.a) gameData.diceRolls.a = Math.floor(Math.random() * 6) + 1;
        else if (gameData.captainB && socket.id === gameData.captainB.id && !gameData.diceRolls.b) gameData.diceRolls.b = Math.floor(Math.random() * 6) + 1;
        else return;
        const { a, b } = gameData.diceRolls;
        if (a && b) {
            if (a === b) { io.emit('message', { username: "Sammu's Bot", text: `🎲 Both rolled ${a}! Roll again!` }); gameData.diceRolls = { a: null, b: null }; }
            else if (a > b) { gameData.scores.teamA++; recordWin(`${gameData.captainA.username} (Rolled ${a} vs ${b})`, '🎲', gameData.captainA.username); gameData.gameState = 'lobby'; }
            else { gameData.scores.teamB++; recordWin(`${gameData.captainB.username} (Rolled ${b} vs ${a})`, '🎲', gameData.captainB.username); gameData.gameState = 'lobby'; }
        }
        io.emit('syncGame', gameData);
    });

    socket.on('launchPenalty', () => {
        if (socket.id === hostId) {
            ensureCaptains(); clearAllTimers();
            gameData.gameState = 'penalty'; gameData.penaltyPicks = { shooter: null, keeper: null };
            io.emit('syncGame', gameData);
            announceMatchup("⚽ Penalty Shootout");
        }
    });
    socket.on('penaltyPick', (dir) => {
        if (gameData.gameState !== 'penalty') return;
        if (gameData.captainA && socket.id === gameData.captainA.id) gameData.penaltyPicks.shooter = dir;
        else if (gameData.captainB && socket.id === gameData.captainB.id) gameData.penaltyPicks.keeper = dir;
        else return;
        const { shooter, keeper } = gameData.penaltyPicks;
        if (shooter && keeper) {
            if (shooter === keeper) { gameData.scores.teamB++; recordWin(`${gameData.captainB.username} (SAVED ${shooter}! 🧤)`, '⚽', gameData.captainB.username); }
            else { gameData.scores.teamA++; recordWin(`${gameData.captainA.username} (GOAL ${shooter}! 🥅)`, '⚽', gameData.captainA.username); }
            gameData.gameState = 'lobby';
        }
        io.emit('syncGame', gameData);
    });

    socket.on('launchTyping', () => {
        if (socket.id === hostId) {
            ensureCaptains(); clearAllTimers();
            gameData.gameState = 'typing'; gameData.typingPhrase = generateTyping();
            io.emit('syncGame', gameData);
            announceMatchup("⌨️ Speed Typing Race");
        }
    });
    socket.on('submitTyping', (text) => {
        if (gameData.gameState !== 'typing') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if ((isA || isB) && text.trim().toLowerCase() === gameData.typingPhrase.toLowerCase()) {
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Speed Typer!)", '⌨️', gameData.captainA.username); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Speed Typer!)", '⌨️', gameData.captainB.username); }
            gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
        }
    });

    socket.on('launchTreasure', () => {
        if (socket.id !== hostId) return;
        ensureCaptains(); clearAllTimers(); gameData.gameState = 'treasure';
        const items = new Array('💎', '💀', '🕸️', '🦴', '🪨', '🍂', '🐚', '🕷️', '🪙').sort(() => Math.random() - 0.5);
        gameData.treasureGrid = items.map(icon => ({ icon, opened: false }));
        io.emit('syncGame', gameData);
        announceMatchup("💎 Treasure Hunt");
    });
    socket.on('pickTreasure', (idx) => {
        if (gameData.gameState !== 'treasure' || !gameData.treasureGrid.at(idx) || gameData.treasureGrid.at(idx).opened) return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if (!isA && !isB) return;
        gameData.treasureGrid.at(idx).opened = true;
        if (gameData.treasureGrid.at(idx).icon === '💎') {
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Found the Diamond!)", '💎', gameData.captainA.username); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Found the Diamond!)", '💎', gameData.captainB.username); }
            gameData.gameState = 'lobby';
        }
        io.emit('syncGame', gameData);
    });
    socket.on('launchSimon', () => {
        if (socket.id !== hostId) return;
        ensureCaptains(); clearAllTimers();
        gameData.gameState = 'simon'; gameData.simonCommand = "WAIT FOR SIMON..."; gameData.simonIsValid = false;
        io.emit('syncGame', gameData);
        announceMatchup("🚨 Simon Says");
        const isValid = Math.random() < 0.65;
        simonTimer = setTimeout(() => {
            if (gameData.gameState !== 'simon') return;
            gameData.simonIsValid = isValid;
            gameData.simonCommand = isValid ? "🚨 SIMON SAYS: TAP NOW!" : "⚠️ TAP NOW! (FAKE!)";
            io.emit('syncGame', gameData);
        }, Math.floor(Math.random() * 2500) + 1500);
    });
    socket.on('tapSimon', () => {
        if (gameData.gameState !== 'simon') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if (!isA && !isB) return;
        clearAllTimers();
        if (gameData.simonIsValid) {
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Followed Simon!)", '🚨', gameData.captainA.username, "🚨 Simon Master"); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Followed Simon!)", '🚨', gameData.captainB.username, "🚨 Simon Master"); }
        } else {
            if (isA) { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Red tapped fake command!)", '🚨', gameData.captainB.username); }
            else { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Blue tapped fake command!)", '🚨', gameData.captainA.username); }
        }
        gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
    });

    socket.on('launchCards', () => {
        if (socket.id !== hostId) return;
        ensureCaptains(); clearAllTimers(); gameData.gameState = 'cards';
        const cur = Math.floor(Math.random() * 9) + 3;
        let nxt = Math.floor(Math.random() * 13) + 1;
        while (nxt === cur) nxt = Math.floor(Math.random() * 13) + 1;
        gameData.cardCurrent = cur; gameData.cardNext = nxt;
        io.emit('syncGame', gameData);
        announceMatchup("🃏 Higher or Lower");
    });
    socket.on('pickCard', (dir) => {
        if (gameData.gameState !== 'cards') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if (!isA && !isB) return;
        const won = (dir === 'higher' && gameData.cardNext > gameData.cardCurrent) || (dir === 'lower' && gameData.cardNext < gameData.cardCurrent);
        if (won) {
            if (isA) { gameData.scores.teamA++; recordWin(`${gameData.captainA.username} (Next card was ${gameData.cardNext}!)`, '🃏', gameData.captainA.username, "🃏 Card Shark"); }
            else { gameData.scores.teamB++; recordWin(`${gameData.captainB.username} (Next card was ${gameData.cardNext}!)`, '🃏', gameData.captainB.username, "🃏 Card Shark"); }
        } else {
            if (isA) { gameData.scores.teamB++; recordWin(`${gameData.captainB.username} (Red guessed wrong: ${gameData.cardNext})`, '🃏', gameData.captainB.username); }
            else { gameData.scores.teamA++; recordWin(`${gameData.captainA.username} (Blue guessed wrong: ${gameData.cardNext})`, '🃏', gameData.captainA.username); }
        }
        gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
    });

    socket.on('launchDefuse', () => {
        if (socket.id !== hostId) return;
        ensureCaptains(); clearAllTimers(); gameData.gameState = 'defuse';
        const types = new Array('SAFE', 'SAFE', 'DEFUSE', 'BOOM').sort(() => Math.random() - 0.5);
        const colors = new Array('🔴 RED WIRE', '🔵 BLUE WIRE', '🟢 GREEN WIRE', '🟡 YELLOW WIRE');
        gameData.defuseWires = colors.map((label, i) => ({ label, type: types.at(i), cut: false }));
        gameData.defuseTurn = gameData.captainA.id;
        io.emit('syncGame', gameData);
        announceMatchup("✂️ Wire Cut Defusal");
    });
    socket.on('cutWire', (idx) => {
        if (gameData.gameState !== 'defuse' || socket.id !== gameData.defuseTurn) return;
        const wire = gameData.defuseWires.at(idx);
        if (!wire || wire.cut) return;
        wire.cut = true;
        const isA = socket.id === gameData.captainA.id;
        if (wire.type === 'DEFUSE') {
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Defused the Bomb! ✂️)", '💣', gameData.captainA.username, "💣 Bomb Defuser"); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Defused the Bomb! ✂️)", '💣', gameData.captainB.username, "💣 Bomb Defuser"); }
            gameData.gameState = 'lobby';
        } else if (wire.type === 'BOOM') {
            if (isA) { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Red cut the BOOM wire! 💥)", '💥', gameData.captainB.username); }
            else { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Blue cut the BOOM wire! 💥)", '💥', gameData.captainA.username); }
            gameData.gameState = 'lobby';
        } else {
            gameData.defuseTurn = isA ? gameData.captainB.id : gameData.captainA.id;
        }
        io.emit('syncGame', gameData);
    });

    socket.on('launchGuess', () => {
        if (socket.id !== hostId) return;
        ensureCaptains(); clearAllTimers(); gameData.gameState = 'guess';
        gameData.guessSecret = Math.floor(Math.random() * 100) + 1;
        gameData.guessHint = 'Guess a number between 1 and 100!';
        io.emit('syncGame', gameData);
        announceMatchup("🔢 Number Guess Blitz");
    });
    socket.on('submitGuess', (num) => {
        if (gameData.gameState !== 'guess') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if (!isA && !isB) return;
        const g = Number(num);
        if (g === gameData.guessSecret) {
            if (isA) { gameData.scores.teamA++; recordWin(`${gameData.captainA.username} (Nailed ${g}!)`, '🔢', gameData.captainA.username, "🔢 Mind Reader"); }
            else { gameData.scores.teamB++; recordWin(`${gameData.captainB.username} (Nailed ${g}!)`, '🔢', gameData.captainB.username, "🔢 Mind Reader"); }
            gameData.gameState = 'lobby';
        } else if (g < gameData.guessSecret) {
            gameData.guessHint = `📈 ${g} is TOO LOW! Go Higher!`;
        } else {
            gameData.guessHint = `📉 ${g} is TOO HIGH! Go Lower!`;
        }
        io.emit('syncGame', gameData);
    });

    socket.on('launchTarget', () => {
        if (socket.id !== hostId) return;
        ensureCaptains(); clearAllTimers(); gameData.gameState = 'target';
        gameData.targetPos = { x: Math.floor(Math.random() * 70) + 15, y: Math.floor(Math.random() * 70) + 15 };
        io.emit('syncGame', gameData);
        announceMatchup("🎯 Target Sniper");
    });
    socket.on('hitTarget', () => {
        if (gameData.gameState !== 'target') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if (!isA && !isB) return;
        if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Bullseye Sniper!)", '🎯', gameData.captainA.username, "🎯 Sharp Sniper"); }
        else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Bullseye Sniper!)", '🎯', gameData.captainB.username, "🎯 Sharp Sniper"); }
        gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
    });
    socket.on('launchFruit', () => {
        if (socket.id !== hostId) return;
        ensureCaptains(); clearAllTimers(); gameData.gameState = 'fruit';
        io.emit('syncGame', gameData);
        announceMatchup("🗡️ Fruit Slash Blitz");
    });
        socket.on('fruitScoreTick', (pts) => {
        if (gameData.gameState !== 'fruit' || !(Number(pts) >= 10)) return;
        const { name } = resolvePlayerIdentity(socket, null);
        const isB = gameData.captainB && socket.id === gameData.captainB.id;
        if (isB) { gameData.scores.teamB++; } else { gameData.scores.teamA++; }
        recordWin(name + " (Fruit Ninja Master!)", '🗡️', name, "🗡️ Fruit Ninja");
        gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
    });

    socket.on('launchReflex', () => {
        if (socket.id !== hostId) return;
        ensureCaptains(); clearAllTimers(); gameData.gameState = 'reflex'; gameData.reflexGreen = false;
        io.emit('syncGame', gameData);
        announceMatchup("⚡ Lightning Reflex Duel");
        reflexTimer = setTimeout(() => {
            if (gameData.gameState === 'reflex') { gameData.reflexGreen = true; io.emit('syncGame', gameData); }
        }, Math.floor(Math.random() * 3500) + 2000);
    });
    socket.on('reflexTap', () => {
        if (gameData.gameState !== 'reflex') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if (!isA && !isB) return;
        clearAllTimers();
        if (!gameData.reflexGreen) {
            if (isA) { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Red tapped early!)", '⚡', gameData.captainB.username); }
            else { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Blue tapped early!)", '⚡', gameData.captainA.username); }
        } else {
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Lightning Reflexes!)", '⚡', gameData.captainA.username, "⚡ Flash Speed"); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Lightning Reflexes!)", '⚡', gameData.captainB.username, "⚡ Flash Speed"); }
        }
        gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
    });

    socket.on('launchHoop', () => {
        if (socket.id !== hostId) return;
        ensureCaptains(); clearAllTimers(); gameData.gameState = 'hoop';
        io.emit('syncGame', gameData);
        announceMatchup("🏀 Hoop Shootout");
    });
    socket.on('hoopShoot', (pos) => {
        if (gameData.gameState !== 'hoop') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if (!isA && !isB) return;
        const p = Number(pos);
        if (p >= 40 && p <= 60) {
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (SWISH 3-POINTER! 🏀)", '🏀', gameData.captainA.username, "🏀 Hoop Star"); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (SWISH 3-POINTER! 🏀)", '🏀', gameData.captainB.username, "🏀 Hoop Star"); }
            gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
        } else {
            socket.emit('message', { username: "Sammu's Bot", text: `🧱 **BRICK!** Missed the green zone—shoot again! 🏀` });
        }
    });

    socket.on('launchSTK', (doctorId) => {
        if (socket.id !== hostId || players.length < 1) return;
        clearAllTimers();
        gameData.stkState = null;
        const chosenDoc = players.find(p => p.id === doctorId) || players.at(0);
        const routines = new Array(
            { skinType: "Oily & Acne-Prone Skin", steps: new Array("Salicylic Cleanser", "Niacinamide Serum", "Oil-Free Gel", "Matte Sunscreen") },
            { skinType: "Dry & Flaky Skin", steps: new Array("Cream Cleanser", "Hyaluronic Serum", "Ceramide Cream", "Dewy Sunscreen") },
            { skinType: "Dull & Tanned Skin", steps: new Array("Foam Face Wash", "Vitamin C Serum", "Glow Lotion", "SPF 50 Sunscreen") }
        );
        const chosenRoutine = routines.at(Math.floor(Math.random() * routines.length));
        skincareSession = { active: true, doctor: chosenDoc.username, routine: chosenRoutine };
        gameData.gameState = 'lobby';
        io.emit('syncGame', gameData);
        io.emit('openSkincareClinic', { doctor: chosenDoc.username, skinType: chosenRoutine.skinType, steps: chosenRoutine.steps });
        io.emit('message', {
            username: "Sammu's Bot",
            text: `🩺✨ **DOCTOR SKINCARE CLINIC OPEN!** **Dr. ${chosenDoc.username}** opened the visual clinic for **${chosenRoutine.skinType}**! Tap the 4 bottles in order! 🧴`
        });
    });

    socket.on('skincareStepComplete', (data) => {
        if (!skincareSession || !skincareSession.active) return;
        if (data && data.step === 4) {
            skincareSession.active = false;
            const { name } = resolvePlayerIdentity(socket, data);
            addMVPPoints(name, 4);
            awardTrophy(name, "✨ Glass Skin Guru");
            io.emit('closeSkincareClinic');
            io.emit('message', {
                username: "Sammu's Bot",
                text: `🧴💖 **GLASS SKIN ACHIEVED!** **${name}** completed Dr. ${skincareSession.doctor}'s skincare routine first! **+4 MVP Points** & **✨ Glass Skin Guru** Trophy! 🏆`
            });
        }
    });
    socket.on('sendGift', (giftData) => {
        if (!giftData) return;
        const { name: senderName, avatar: senderAvatar } = resolvePlayerIdentity(socket, giftData);
        const giftIcon = giftData.gift || giftData.emoji || giftData.icon || '🎁';
        const giftName = giftData.name || giftData.giftName || 'Special Gift';
        const targetName = giftData.to || giftData.target || giftData.receiver || 'Everyone';

        io.emit('incomingGift', { senderId: socket.id, sender: senderName, avatar: senderAvatar, to: targetName, gift: giftIcon, name: giftName });
        addMVPPoints(senderName, 1);
        io.emit('message', { username: "Sammu's Bot", text: `🎁 **GIFT ALERT!** **${senderName}** sent ${giftIcon} **${giftName}** to **${targetName}**! (+1 MVP pt) 💖✨` });
    });

    socket.on('sendReaction', (emoji) => io.emit('incomingReaction', emoji));

    socket.on('resetToLobby', () => {
        if (socket.id !== hostId) return;
        clearAllTimers(); spinnerEnded = false;
        skincareSession = null;
        io.emit('closeSkincareClinic');
        gameData = {
            captainA: gameData.captainA, captainB: gameData.captainB,
            teamA: gameData.teamA, teamB: gameData.teamB,
            fighterA: gameData.captainA ? gameData.captainA.id : null,
            fighterB: gameData.captainB ? gameData.captainB.id : null,
            tttBoard: Array(9).fill(null), tttTurn: null,
            sumoPosition: 50,
            spinner: { a: { x: 80, y: 130, vx: 0, vy: 0 }, b: { x: 180, y: 130, vx: 0, vy: 0 } },
            drawReady: false, mathQ: { question: '', options: [], answer: 0 },
            bombHolder: null, rpsChoices: { a: null, b: null },
            memoryGrid: [], memoryTarget: '', memoryHidden: false,
            tugPosition: 50, colorTrap: null, scrambleWord: '', scrambleAnswer: '',
            diceRolls: { a: null, b: null }, penaltyPicks: { shooter: null, keeper: null },
            typingPhrase: '', treasureGrid: [],
            simonCommand: '', simonIsValid: false, cardCurrent: 7, cardNext: 0,
            defuseWires: [], defuseTurn: null, guessSecret: 50, guessHint: 'Guess 1 - 100!',
            targetPos: { x: 50, y: 50 }, stkState: null,
            reflexGreen: false,
            scores: gameData.scores, gameState: 'lobby'
        };
        io.emit('syncGame', gameData);
    });

    socket.on('disconnect', () => {
        const lp = players.find(p => p.id === socket.id);
        if (lp) io.emit('message', { username: "Sammu's Bot", text: `😢 ${lp.username} has left the room` });
        players = players.filter(p => p.id !== socket.id);
        io.emit('updatePlayers', players);
    });
});

function checkWin(b) {
    return new Array("012","345","678","036","147","258","048","246").some(s => {
        const coords = s.split('').map(Number);
        const x = coords.at(0), y = coords.at(1), z = coords.at(2);
        return b.at(x) && b.at(x) === b.at(y) && b.at(x) === b.at(z);
    });
}

setInterval(() => {
    try {
        if (gameData.gameState !== 'spinner') { spinnerEnded = false; return; }
        if (spinnerEnded || !gameData.spinner || !gameData.spinner.a || !gameData.spinner.b) return;

        const a = gameData.spinner.a, b = gameData.spinner.b;
        a.x += a.vx; a.y += a.vy; a.vx *= 0.88; a.vy *= 0.88;
        b.x += b.vx; b.y += b.vy; b.vx *= 0.88; b.vy *= 0.88;

        const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
        if (dist < 40) {
            const nx = dist > 0 ? dx / dist : 1, ny = dist > 0 ? dy / dist : 0, overlap = 40 - dist;
            a.x -= nx * (overlap / 2); a.y -= ny * (overlap / 2);
            b.x += nx * (overlap / 2); b.y += ny * (overlap / 2);
            a.vx -= nx * 11; a.vy -= ny * 11; b.vx += nx * 11; b.vy += ny * 11;
        }

        const distA = Math.hypot(a.x - 130, a.y - 130), distB = Math.hypot(b.x - 130, b.y - 130);
        if (distA >= 106 || distB >= 106) {
            spinnerEnded = true; gameData.gameState = 'lobby';
            const capAName = gameData.captainA ? gameData.captainA.username : "Red Spinner";
            const capBName = gameData.captainB ? gameData.captainB.username : "Blue Spinner";
            if (distA >= distB) {
                gameData.scores.teamB++;
                recordWin(capBName + " (🔵 Team B)", '🌀', capBName, "🌀 Spinner Pro");
            } else {
                gameData.scores.teamA++;
                recordWin(capAName + " (🔴 Team A)", '🌀', capAName, "🌀 Spinner Pro");
            }
            io.emit('syncGame', gameData);
        } else {
            io.emit('spinnerTick', gameData.spinner);
        }
    } catch (err) {
        gameData.gameState = 'lobby';
        io.emit('syncGame', gameData);
    }
}, 33);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Sammu Games Running on Port ' + PORT));
