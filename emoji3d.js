const fs = require('fs');

const EMOJI_3D_HTML = `
<style id="e3dStandaloneCss">
  #e3dOpenBtn {
    width: auto !important;
    min-width: 48px !important;
    padding: 6px 10px !important;
    margin-left: 5px !important;
    border-radius: 10px !important;
    border: 1.5px solid #38bdf8 !important;
    background: linear-gradient(135deg, #1e1b4b, #0284c7) !important;
    color: #ffffff !important;
    font-weight: 900 !important;
    font-size: 13px !important;
    cursor: pointer !important;
    flex-shrink: 0 !important;
  }
  #e3dDrawer {
    display: none;
    position: fixed;
    bottom: 70px;
    left: 50%;
    transform: translateX(-50%);
    width: 95%;
    max-width: 400px;
    max-height: 52vh;
    overflow-y: auto;
    background: linear-gradient(155deg, #0f172a, #1e1b4b);
    border: 2px solid #38bdf8;
    border-radius: 18px;
    padding: 12px;
    z-index: 99999999;
    box-shadow: 0 0 28px rgba(56, 189, 248, 0.55);
    will-change: transform;
  }
  .e3d-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-top: 8px; }
  .e3d-card {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(56, 189, 248, 0.35);
    border-radius: 12px;
    padding: 6px 4px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .e3d-card svg { width: 40px; height: 40px; display: block; }
  .e3d-chat-sticker { width: 54px !important; height: 54px !important; display: inline-block !important; vertical-align: middle !important; }
</style>

<div id="e3dDrawer">
  <div style="display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:#0f172a;padding:4px 0;z-index:2;">
    <span style="font-weight:900;font-size:13px;color:#fde047;">✨ 56 3D EMOJIS (TAP TO SEND)</span>
    <button onclick="document.getElementById('e3dDrawer').style.display='none'" style="width:28px!important;min-width:28px!important;height:26px!important;padding:0!important;background:#ef4444;border:none;color:#fff;border-radius:7px;font-weight:900;cursor:pointer;">✕</button>
  </div>
  <div class="e3d-grid" id="e3dGrid"></div>
</div>

<script>
(function() {
  // === 1. AUDIO SMOOTHNESS & ANTI-BREAK GUARD ===
  const activeContexts = [];
  if (window.AudioContext || window.webkitAudioContext) {
    const OrigAC = window.AudioContext || window.webkitAudioContext;
    window.AudioContext = window.webkitAudioContext = function(...args) {
      const ctx = new OrigAC(...args);
      activeContexts.push(ctx);
      return ctx;
    };
  }

  function unlockAndSmoothAudio() {
    activeContexts.forEach(ctx => {
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    });
    document.querySelectorAll('audio').forEach(a => {
      if (a.preload !== 'auto') a.preload = 'auto';
      if (a.paused && a.dataset.keepPlaying === '1') {
        a.play().catch(() => {});
      }
    });
  }
  ['touchstart', 'click', 'keydown'].forEach(ev => {
    window.addEventListener(ev, unlockAndSmoothAudio, { passive: true });
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) unlockAndSmoothAudio();
  });
  // === 2. 56 GLOSSY 3D EMOJIS ===
  let gId = 0;
  function orb(c1, c2, inner) {
    gId++;
    const id = 'e3d_g_' + gId;
    return '<svg xmlns="http://w3.org" viewBox="0 0 100 100">' +
      '<defs><radialGradient id="' + id + '" cx="32%" cy="28%" r="72%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/><stop offset="22%" stop-color="' + c1 + '"/><stop offset="100%" stop-color="' + c2 + '"/></radialGradient></defs>' +
      '<circle cx="50" cy="52" r="44" fill="rgba(0,0,0,0.45)"/>' +
      '<circle cx="50" cy="48" r="44" fill="url(#' + id + ')"/>' +
      '<ellipse cx="36" cy="24" rx="14" ry="7" transform="rotate(-25 36 24)" fill="#ffffff" opacity="0.45"/>' +
      inner + '</svg>';
  }

  const LIST = [
    ['lol', 'LOL', '#fde047', '#d97706', '<path d="M30,42 L42,46 L30,50 M70,42 L58,46 L70,50" stroke="#451a03" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M30,58 Q50,82 70,58 Z" fill="#7f1d1d"/><ellipse cx="20" cy="54" rx="5" ry="9" fill="#38bdf8"/><ellipse cx="80" cy="54" rx="5" ry="9" fill="#38bdf8"/>'],
    ['rofl', 'ROFL', '#facc15', '#b45309', '<path d="M28,44 L42,42 L32,52 M72,44 L58,42 L68,52" stroke="#451a03" stroke-width="4" fill="none"/><path d="M32,58 Q54,84 72,54 Z" fill="#7f1d1d"/>'],
    ['cool', 'Boss', '#facc15', '#b45309', '<rect x="22" y="38" width="24" height="14" rx="4" fill="#090d16"/><rect x="54" y="38" width="24" height="14" rx="4" fill="#090d16"/><line x1="46" y1="43" x2="54" y2="43" stroke="#090d16" stroke-width="4"/><path d="M38,64 Q52,72 64,61" stroke="#451a03" stroke-width="4" fill="none"/>'],
    ['wink', 'Wink', '#fde047', '#ca8a04', '<circle cx="38" cy="44" r="5" fill="#451a03"/><path d="M56,44 Q64,38 70,44" stroke="#451a03" stroke-width="4" fill="none"/><path d="M36,60 Q50,74 64,60" stroke="#451a03" stroke-width="4" fill="none"/>'],
    ['love', 'HeartEyes', '#fde047', '#d97706', '<path d="M36,48 C28,40 28,32 36,36 C44,32 44,40 36,48 Z" fill="#ef4444"/><path d="M64,48 C56,40 56,32 64,36 C72,32 72,40 64,48 Z" fill="#ef4444"/><path d="M34,60 Q50,78 66,60 Z" fill="#7f1d1d"/>'],
    ['kiss', 'Kiss', '#fde047', '#d97706', '<circle cx="38" cy="44" r="5" fill="#451a03"/><path d="M56,44 Q64,39 70,44" stroke="#451a03" stroke-width="4" fill="none"/><path d="M48,58 Q56,62 48,65 Q56,68 48,72" stroke="#451a03" stroke-width="3.5" fill="none"/><circle cx="74" cy="64" r="6" fill="#f43f5e"/>'],
    ['shock', 'OMG', '#fde047', '#b45309', '<circle cx="37" cy="42" r="6" fill="#fff"/><circle cx="37" cy="42" r="3" fill="#090d16"/><circle cx="63" cy="42" r="6" fill="#fff"/><circle cx="63" cy="42" r="3" fill="#090d16"/><ellipse cx="50" cy="66" rx="9" ry="12" fill="#7f1d1d"/>'],
    ['cry', 'Cry', '#fde047', '#ca8a04', '<path d="M32,44 Q38,39 44,44 M56,44 Q62,39 68,44" stroke="#451a03" stroke-width="3.5" fill="none"/><rect x="33" y="48" width="7" height="24" rx="3" fill="#38bdf8"/><rect x="60" y="48" width="7" height="24" rx="3" fill="#38bdf8"/><path d="M38,68 Q50,58 62,68" stroke="#451a03" stroke-width="4" fill="none"/>'],
    ['rage', 'Rage', '#ef4444', '#7f1d1d', '<path d="M28,36 L44,44 M72,36 L56,44" stroke="#fff" stroke-width="4"/><circle cx="38" cy="48" r="4.5" fill="#fde047"/><circle cx="62" cy="48" r="4.5" fill="#fde047"/><rect x="34" y="62" width="32" height="10" rx="4" fill="#fff"/>'],
    ['smirk', 'Smirk', '#fde047', '#b45309', '<circle cx="38" cy="44" r="5" fill="#451a03"/><circle cx="62" cy="44" r="5" fill="#451a03"/><path d="M40,63 Q54,66 66,57" stroke="#451a03" stroke-width="4" fill="none"/>'],
    ['sleep', 'Zzz', '#93c5fd', '#1e3a8a', '<path d="M32,46 Q38,51 44,46 M56,46 Q62,51 68,46" stroke="#fff" stroke-width="3.5" fill="none"/><circle cx="50" cy="64" r="6" fill="#090d16"/><text x="64" y="30" fill="#fde047" font-size="16" font-weight="bold">Z</text>'],
    ['clown', 'Clown', '#fef08a', '#d97706', '<circle cx="50" cy="52" r="9" fill="#ef4444"/><circle cx="36" cy="40" r="4.5" fill="#090d16"/><circle cx="64" cy="40" r="4.5" fill="#090d16"/><path d="M30,62 Q50,82 70,62" stroke="#ef4444" stroke-width="5" fill="none"/>'],
    ['skull', 'Dead', '#c084fc', '#4c1d95', '<path d="M30,48 C30,26 70,26 70,48 C70,58 62,64 60,74 L40,74 C38,64 30,58 30,48 Z" fill="#f8fafc"/><circle cx="40" cy="48" r="6" fill="#4c1d95"/><circle cx="60" cy="48" r="6" fill="#4c1d95"/>'],
    ['devil', 'SusDevil', '#a855f7', '#3b0764', '<polygon points="26,24 22,10 38,20" fill="#f43f5e"/><polygon points="74,24 78,10 62,20" fill="#f43f5e"/><circle cx="38" cy="46" r="5" fill="#fde047"/><circle cx="62" cy="46" r="5" fill="#fde047"/><path d="M36,64 Q50,74 64,64" stroke="#fde047" stroke-width="4" fill="none"/>'],
    ['angel', 'Angel', '#bae6fd', '#0284c7', '<ellipse cx="50" cy="14" rx="22" ry="5" fill="none" stroke="#fde047" stroke-width="4"/><path d="M32,46 Q38,40 44,46 M56,46 Q62,40 68,46" stroke="#0f172a" stroke-width="3.5" fill="none"/><path d="M38,60 Q50,72 62,60" stroke="#0f172a" stroke-width="3.5" fill="none"/>'],
    ['alien', 'Alien', '#4ade80', '#065f46', '<ellipse cx="36" cy="46" rx="8" ry="12" transform="rotate(-20 36 46)" fill="#090d16"/><ellipse cx="64" cy="46" rx="8" ry="12" transform="rotate(20 64 46)" fill="#090d16"/><path d="M42,68 Q50,73 58,68" stroke="#090d16" stroke-width="3.5" fill="none"/>'],
    ['robot', 'Bot', '#94a3b8', '#1e293b', '<rect x="26" y="34" width="48" height="34" rx="8" fill="#0f172a" stroke="#38bdf8" stroke-width="2.5"/><circle cx="39" cy="48" r="5" fill="#38bdf8"/><circle cx="61" cy="48" r="5" fill="#38bdf8"/><line x1="38" y1="60" x2="62" y2="60" stroke="#4ade80" stroke-width="3.5"/>'],
    ['ghost', 'Ghost', '#f8fafc', '#64748b', '<path d="M30,74 L30,44 C30,24 70,24 70,44 L70,74 L60,66 L50,74 L40,66 Z" fill="#ffffff"/><circle cx="42" cy="46" r="4.5" fill="#090d16"/><circle cx="58" cy="46" r="4.5" fill="#090d16"/>'],
    ['fire', 'Fire', '#f97316', '#991b1b', '<path d="M50,16 C68,34 80,48 70,70 C62,82 38,82 30,70 C20,48 32,34 50,16 Z" fill="#fde047"/><path d="M50,36 C60,48 64,58 50,74 C36,58 40,48 50,36 Z" fill="#ffffff"/>'],
    ['heart', 'RedHeart', '#f43f5e', '#881337', '<path d="M50,78 C22,58 18,34 34,28 C43,25 50,34 50,34 C50,34 57,25 66,28 C82,34 78,58 50,78 Z" fill="#ffe4e6"/>'],
    ['pheart', 'PinkHeart', '#f472b6', '#831843', '<path d="M50,78 C22,58 18,34 34,28 C43,25 50,34 50,34 C50,34 57,25 66,28 C82,34 78,58 50,78 Z" fill="#fbcfe8"/>'],
    ['bheart', 'Broken', '#e11d48', '#4c0519', '<path d="M48,76 C22,58 18,34 34,28 C42,25 48,33 48,33 L44,48 L52,58 Z" fill="#ffe4e6"/><path d="M54,76 C78,58 82,34 66,28 C58,25 53,33 53,33 L49,48 L56,58 Z" fill="#fecdd3"/>'],
    ['crown', 'Crown', '#f59e0b', '#78350f', '<polygon points="22,66 26,32 40,46 50,22 60,46 74,32 78,66" fill="#fef08a" stroke="#fff" stroke-width="2"/><rect x="22" y="66" width="56" height="10" rx="4" fill="#fde047"/>'],
    ['diamond', 'Diamond', '#38bdf8', '#1e3a8a', '<polygon points="50,18 78,40 50,82 22,40" fill="#e0f2fe" stroke="#0284c7" stroke-width="2.5"/><line x1="22" y1="40" x2="78" y2="40" stroke="#0284c7" stroke-width="2"/>'],
    ['bolt', 'Thunder', '#0ea5e9', '#1e1b4b', '<polygon points="54,16 30,52 48,52 42,82 70,44 52,44" fill="#fde047" stroke="#fff" stroke-width="2"/>'],
    ['star', 'GoldStar', '#facc15', '#854d0e', '<polygon points="50,16 59,38 82,38 63,52 70,76 50,62 30,76 37,52 18,38 41,38" fill="#fef08a" stroke="#fff" stroke-width="2"/>'],
    ['rocket', 'Rocket', '#10b981', '#064e3b', '<path d="M50,16 C64,32 66,54 58,70 L42,70 C34,54 36,32 50,16 Z" fill="#f8fafc"/><circle cx="50" cy="44" r="7" fill="#38bdf8"/><polygon points="42,70 50,86 58,70" fill="#f97316"/>'],
    ['party', 'Party', '#ec4899', '#831843', '<polygon points="50,14 34,36 66,36" fill="#38bdf8"/><circle cx="38" cy="48" r="4.5" fill="#fff"/><circle cx="62" cy="48" r="4.5" fill="#fff"/><path d="M38,62 Q50,74 62,62" stroke="#fde047" stroke-width="4" fill="none"/>'],
          ['namaste', 'Namaste', '#fb923c', '#7c2d12', '<path d="M48,24 L36,68 L48,68 Z" fill="#fef3c7" stroke="#d97706" stroke-width="2"/><path d="M52,24 L64,68 L52,68 Z" fill="#fde68a" stroke="#d97706" stroke-width="2"/>'],
    ['chakra', 'Chakra', '#2563eb', '#090d16', '<circle cx="50" cy="48" r="24" fill="none" stroke="#fde047" stroke-width="5" stroke-dasharray="6 4"/><circle cx="50" cy="48" r="8" fill="#38bdf8"/>'],
    ['trishul', 'Trishul', '#dc2626', '#1e1b4b', '<line x1="50" y1="18" x2="50" y2="82" stroke="#fde047" stroke-width="5"/><path d="M34,26 Q34,44 50,44 Q66,44 66,26" fill="none" stroke="#fde047" stroke-width="4.5"/>'],
    ['lotus', 'Lotus', '#f472b6', '#4c0519', '<ellipse cx="50" cy="44" rx="10" ry="24" fill="#fbcfe8"/><ellipse cx="36" cy="50" rx="9" ry="20" transform="rotate(-28 36 50)" fill="#f9a8d4"/><ellipse cx="64" cy="50" rx="9" ry="20" transform="rotate(28 64 50)" fill="#f9a8d4"/>'],
    ['peacock', 'MorPankh', '#059669', '#022c22', '<ellipse cx="50" cy="46" rx="18" ry="26" fill="#34d399" stroke="#fde047" stroke-width="2.5"/><ellipse cx="50" cy="46" rx="10" ry="15" fill="#1d4ed8"/><circle cx="50" cy="46" r="5" fill="#fde047"/>'],
    ['thumbsup', 'GG', '#fde047', '#b45309', '<rect x="34" y="44" width="32" height="26" rx="6" fill="#fff"/><path d="M44,44 L44,28 Q52,24 52,34 L52,44" fill="#fde047" stroke="#090d16" stroke-width="2"/>'],
    ['peace', 'Victory', '#38bdf8', '#1e3a8a', '<rect x="36" y="48" width="28" height="24" rx="7" fill="#fff"/><rect x="38" y="24" width="8" height="26" rx="4" transform="rotate(-12 38 24)" fill="#fde047"/><rect x="54" y="24" width="8" height="26" rx="4" transform="rotate(12 54 24)" fill="#fde047"/>'],
    ['clap', 'Clap', '#facc15', '#92400e', '<ellipse cx="42" cy="52" rx="11" ry="20" transform="rotate(-20 42 52)" fill="#fef3c7"/><ellipse cx="58" cy="52" rx="11" ry="20" transform="rotate(20 58 52)" fill="#fde68a"/>'],
    ['muscle', 'Power', '#f97316', '#7c2d12', '<path d="M28,64 Q26,38 44,38 Q56,38 56,50 L72,50 Q76,66 56,68 L34,68 Z" fill="#fde68a" stroke="#b45309" stroke-width="2"/>'],
    ['trophy', 'Winner', '#eab308', '#422006', '<path d="M32,26 H68 L62,52 H38 Z" fill="#fef08a"/><rect x="46" y="52" width="8" height="14" fill="#fde047"/><rect x="34" y="66" width="32" height="8" rx="3" fill="#fff"/>'],
    ['sword', 'Blade', '#10b981', '#064e3b', '<polygon points="68,20 74,26 40,60 34,54" fill="#f8fafc"/><line x1="28" y1="50" x2="44" y2="66" stroke="#fde047" stroke-width="5"/>'],
    ['shield', 'Shield', '#3b82f6', '#0f172a', '<path d="M30,26 H70 V48 C70,64 50,76 50,76 C50,76 30,64 30,48 Z" fill="#fde047" stroke="#fff" stroke-width="2.5"/>'],
    ['bomb', 'Boom', '#475569', '#090d16', '<circle cx="48" cy="54" r="20" fill="#0f172a" stroke="#fff" stroke-width="2"/><path d="M60,38 Q68,26 76,28" stroke="#fde047" stroke-width="3" fill="none"/><circle cx="77" cy="28" r="4" fill="#ef4444"/>'],
    ['money', 'Rich', '#22c55e', '#052e16', '<rect x="24" y="34" width="52" height="28" rx="5" fill="#bbf7d0" stroke="#15803d" stroke-width="2.5"/><circle cx="50" cy="48" r="7" fill="#16a34a"/>'],
    ['lion', 'Lion', '#d97706', '#451a03', '<circle cx="50" cy="50" r="26" fill="#92400e"/><circle cx="50" cy="50" r="18" fill="#fde047"/><circle cx="44" cy="46" r="2.5" fill="#090d16"/><circle cx="56" cy="46" r="2.5" fill="#090d16"/>'],
    ['dragon', 'Dragon', '#059669', '#022c22', '<path d="M30,64 Q26,34 54,28 Q74,34 68,62 Z" fill="#34d399"/><circle cx="44" cy="44" r="3.5" fill="#fde047"/><circle cx="60" cy="44" r="3.5" fill="#fde047"/>'],
    ['fox', 'Kitsune', '#f43f5e', '#1f2937', '<polygon points="28,24 40,42 26,50" fill="#fff"/><polygon points="72,24 60,42 74,50" fill="#fff"/><polygon points="50,74 28,48 50,38 72,48" fill="#ffffff"/>'],
    ['cat', 'Kitty', '#f472b6', '#311042', '<polygon points="30,26 42,40 28,46" fill="#fbcfe8"/><polygon points="70,26 58,40 72,46" fill="#fbcfe8"/><circle cx="50" cy="52" r="20" fill="#fff"/>'],
    ['wolf', 'Wolf', '#dc2626', '#090d16', '<polygon points="30,24 42,42 28,50" fill="#94a3b8"/><polygon points="70,24 58,42 72,50" fill="#94a3b8"/><polygon points="50,74 28,48 50,38 72,48" fill="#475569"/>'],
    ['butterfly', 'Butterfly', '#a855f7', '#1e1b4b', '<path d="M48,48 C26,22 16,38 28,52 C18,64 30,76 48,56 Z" fill="#38bdf8"/><path d="M52,48 C74,22 84,38 72,52 C82,64 70,76 52,56 Z" fill="#f472b6"/>'],
    ['rose', 'Rose', '#e11d48', '#4c0519', '<circle cx="50" cy="44" r="18" fill="#fb7185"/><circle cx="50" cy="44" r="10" fill="#be123c"/><rect x="48" y="62" width="4" height="18" fill="#22c55e"/>'],
    ['moon', 'Moon', '#4f46e5', '#090d16', '<path d="M58,24 A24,24 0 1,0 72,64 A19,19 0 1,1 58,24 Z" fill="#fde047"/>'],
    ['sun', 'Sun', '#f59e0b', '#7c2d12', '<circle cx="50" cy="48" r="18" fill="#fef08a"/><circle cx="50" cy="48" r="25" fill="none" stroke="#fde047" stroke-width="4" stroke-dasharray="5 5"/>'],
    ['rainbow', 'Rainbow', '#ec4899', '#1e1b4b', '<path d="M24,62 A26,26 0 0,1 76,62" fill="none" stroke="#ef4444" stroke-width="5"/><path d="M30,62 A20,20 0 0,1 70,62" fill="none" stroke="#fde047" stroke-width="5"/><path d="M36,62 A14,14 0 0,1 64,62" fill="none" stroke="#38bdf8" stroke-width="5"/>'],
    ['music', 'Vibe', '#8b5cf6', '#090d16', '<circle cx="38" cy="62" r="7" fill="#38bdf8"/><circle cx="62" cy="56" r="7" fill="#f472b6"/><path d="M44,62 V30 L68,24 V56" fill="none" stroke="#fde047" stroke-width="4"/>'],
    ['game', 'Gamer', '#0284c7', '#090d16', '<rect x="24" y="36" width="52" height="26" rx="12" fill="#f8fafc"/><circle cx="38" cy="49" r="5" fill="#0f172a"/><circle cx="62" cy="46" r="3" fill="#ef4444"/><circle cx="66" cy="52" r="3" fill="#22c55e"/>'],
    ['pizza', 'Pizza', '#f97316', '#451a03', '<polygon points="50,22 74,70 26,70" fill="#fde047" stroke="#b45309" stroke-width="3"/><circle cx="50" cy="48" r="4" fill="#ef4444"/><circle cx="42" cy="60" r="4" fill="#ef4444"/><circle cx="58" cy="60" r="4" fill="#ef4444"/>'],
    ['chai', 'Chai', '#d97706', '#451a03', '<path d="M34,38 H66 L62,72 H38 Z" fill="#fef3c7" stroke="#92400e" stroke-width="2.5"/><path d="M42,26 Q44,20 42,16 M56,26 Q58,20 56,16" stroke="#fff" stroke-width="2.5" fill="none"/>']
  ];

  const STICKERS = LIST.map(item => ({
    code: ':3d_' + item[0] + ':',
    label: item[1],
    svg: orb(item[2], item[3], item[4])
  }));

  function sendStickerToChat(stickerCode) {
    const input = document.querySelector('#chatInput, input[placeholder*="message" i], input[placeholder*="chat" i], input[type="text"]:not(#v22CodeInput)');
    if (input) {
      input.value = stickerCode;
      input.dispatchEvent(new Event('input', { bubbles: true }));

      const sendBtn = input.parentElement && Array.from(input.parentElement.querySelectorAll('button')).find(b =>
        b.id !== 'e3dOpenBtn' && b.id !== 'v27EmojiBtn' && (/send|➤|▶/i.test(b.textContent || '') || b.type === 'submit')
      );
      if (sendBtn) {
        sendBtn.click();
        return;
      }

      if (input.form) {
        input.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        return;
      }

      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      if (input.value === stickerCode) input.value = '';
    }

    if (typeof socket !== 'undefined') {
      socket.emit('chatMessage', { text: stickerCode });
    }
  }
    const grid = document.getElementById('e3dGrid');
  if (grid) {
    const frag = document.createDocumentFragment();
    STICKERS.forEach(st => {
      const card = document.createElement('div');
      card.className = 'e3d-card';
      card.innerHTML = st.svg + '<span style="font-size:9px;color:#e2e8f0;font-weight:bold;margin-top:2px;">' + st.label + '</span>';
      card.onclick = function() {
        document.getElementById('e3dDrawer').style.display = 'none';
        sendStickerToChat(st.code);
      };
      frag.appendChild(card);
    });
    grid.appendChild(frag);
  }

  // === 3. ZERO-LAG OBSERVER & CHAT AUTO-TRIM ===
  function renderChatStickers(rootNode) {
    const scope = (rootNode && rootNode.querySelectorAll) ? rootNode : document;
    scope.querySelectorAll('div, span, p').forEach(el => {
      if (el.children.length === 0 && el.textContent && el.textContent.includes(':3d_')) {
        let html = el.textContent;
        let changed = false;
        STICKERS.forEach(st => {
          if (html.includes(st.code)) {
            html = html.split(st.code).join('<span class="e3d-chat-sticker">' + st.svg + '</span>');
            changed = true;
          }
        });
        if (changed) el.innerHTML = html;
      }
    });

    const chatBox = document.querySelector('#chatMessages, #messages, .chat-messages');
    if (chatBox && chatBox.children.length > 90) {
      while (chatBox.children.length > 90) {
        chatBox.removeChild(chatBox.firstElementChild);
      }
    }
  }

  function ensure3DButton() {
    ['v27EmojiBtn', 'v27EmojiDrawer'].forEach(id => {
      const old = document.getElementById(id);
      if (old) old.style.display = 'none';
    });

    if (!document.getElementById('e3dOpenBtn')) {
      const input = document.querySelector('#chatInput, input[placeholder*="message" i], input[placeholder*="chat" i]');
      if (input && input.parentElement) {
        const btn = document.createElement('button');
        btn.id = 'e3dOpenBtn';
        btn.type = 'button';
        btn.textContent = '😎 3D';
        btn.onclick = function(e) {
          e.preventDefault();
          e.stopPropagation();
          const d = document.getElementById('e3dDrawer');
          d.style.display = d.style.display === 'block' ? 'none' : 'block';
        };
        input.parentElement.appendChild(btn);
      }
    }
  }

  const chatObserver = new MutationObserver((mutations) => {
    ensure3DButton();
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType === 1) renderChatStickers(node);
      });
    });
  });

  if (document.body) {
    ensure3DButton();
    renderChatStickers(document);
    chatObserver.observe(document.body, { childList: true, subtree: true });
  }
})();
</script>
`;

module.exports = function attach3DEmojiPack(app) {
  app.use((req, res, next) => {
    const origSend = res.send;
    res.send = function(body) {
      if (typeof body === 'string' && body.includes('</body>')) {
        body = body.replace('</body>', EMOJI_3D_HTML + '\n</body>');
      }
      return origSend.call(this, body);
    };
    const origSendFile = res.sendFile;
    res.sendFile = function(filePath) {
      if (typeof filePath === 'string' && filePath.endsWith('.html')) {
        try {
          let html = fs.readFileSync(filePath, 'utf8');
          if (html.includes('</body>')) {
            html = html.replace('</body>', EMOJI_3D_HTML + '\n</body>');
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return origSend.call(this, html);
          }
        } catch (e) {}
      }
      return origSendFile.apply(this, arguments);
    };
    next();
  });
  // === DROP-IN CHAT TARGETING & USERNAME PROTECTION OVERRIDE ===
const E3D_BOTTOM_FIX = `
<script>
(function() {
  function getSafeChatInput() {
    const all = Array.from(document.querySelectorAll('input[type="text"], input:not([type]), textarea')).filter(el => {
      if (!el.offsetParent) return false;
      if (el.closest('#e3dDrawer') || el.closest('#v22Modal')) return false;
      const hint = ((el.placeholder || '') + ' ' + (el.id || '') + ' ' + (el.name || '')).toLowerCase();
      if (/user|name|nick|room|code|pass|search/.test(hint)) return false;
      return true;
    });
    return all.find(el => /msg|message|chat|say|type|send/i.test((el.placeholder || '') + ' ' + (el.id || ''))) ||
           all.find(el => el.getBoundingClientRect().top > window.innerHeight * 0.45) ||
           null;
  }

  function fix3DButtonAndCards() {
    // 1. Remove any misplaced 3D button attached to a username/room input
    const badBtn = document.getElementById('e3dOpenBtn');
    const realInput = getSafeChatInput();
    if (badBtn && realInput && badBtn.parentElement !== realInput.parentElement) {
      badBtn.remove();
    }
    if (realInput && realInput.parentElement && !document.getElementById('e3dOpenBtn')) {
      const btn = document.createElement('button');
      btn.id = 'e3dOpenBtn';
      btn.type = 'button';
      btn.textContent = '😎 3D';
      btn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        const d = document.getElementById('e3dDrawer');
        if (d) d.style.display = d.style.display === 'block' ? 'none' : 'block';
      };
      realInput.parentElement.appendChild(btn);
    }

    // 2. Override every 3D sticker card click so it sends ONLY to the bottom chat bar
    document.querySelectorAll('.e3d-card').forEach(card => {
      if (card.dataset.e3dFixed === '1') return;
      card.dataset.e3dFixed = '1';
      const label = (card.textContent || '').trim().toLowerCase();
      const code = ':3d_' + label + ':';

      card.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        const drawer = document.getElementById('e3dDrawer');
        if (drawer) drawer.style.display = 'none';

        const chatBox = getSafeChatInput();
        if (chatBox) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (setter) setter.call(chatBox, code);
          else chatBox.value = code;

          chatBox.dispatchEvent(new Event('input', { bubbles: true }));
          chatBox.dispatchEvent(new Event('change', { bubbles: true }));

          const bar = chatBox.parentElement?.parentElement || chatBox.parentElement;
          const sendBtn = bar && Array.from(bar.querySelectorAll('button')).find(b =>
            b.id !== 'e3dOpenBtn' && b.offsetParent !== null &&
            (/send|➤|▶|🚀|post/i.test((b.textContent || '') + ' ' + (b.id || '') + ' ' + (b.className || '')) || b.type === 'submit')
          );
          if (sendBtn) {
            sendBtn.click();
            return;
          }
          if (chatBox.form) {
            chatBox.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            return;
          }
          chatBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        }
      };
    });
  }

  setInterval(fix3DButtonAndCards, 600);
})();
</script>
`;

const prevExport = module.exports;
module.exports = function(app) {
  if (typeof prevExport === 'function') prevExport(app);
  app.use((req, res, next) => {
    const origSend = res.send;
    res.send = function(body) {
      if (typeof body === 'string' && body.includes('</body>')) {
        body = body.replace('</body>', E3D_BOTTOM_FIX + '\n</body>');
      }
      return origSend.call(this, body);
    };
    const origSendFile = res.sendFile;
    res.sendFile = function(filePath) {
      if (typeof filePath === 'string' && filePath.endsWith('.html')) {
        try {
          let html = fs.readFileSync(filePath, 'utf8');
          if (html.includes('</body>')) {
            html = html.replace('</body>', E3D_BOTTOM_FIX + '\n</body>');
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return origSend.call(this, html);
          }
        } catch (e) {}
      }
      return origSendFile.apply(this, arguments);
    };
    next();
  });
};
// === END DROP-IN CHAT TARGETING OVERRIDE ===
  
};
  
