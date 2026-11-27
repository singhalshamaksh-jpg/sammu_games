// === MULTI_SERVER_UI ===
try {
(function() {
      let currentTab = 'official', allServers = [];
      let isLockedHostDevice = false;
      window.selectedServerId = null;

      const urlParams = new URLSearchParams(window.location.search);
      const refOwner = urlParams.get('ref');
      if (refOwner) localStorage.setItem('sammu_pending_ref', refOwner.trim().toLowerCase());

      let devId = localStorage.getItem('sammu_dev_uid');
      if (!devId) {
        devId = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('sammu_dev_uid', devId);
      }

      const browserFp = [
        navigator.platform || '',
        screen.width + 'x' + screen.height + 'x' + screen.colorDepth,
        navigator.hardwareConcurrency || '',
        navigator.deviceMemory || '',
        Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        navigator.language || ''
      ].join('~');

      window.switchSrvTab = function(tab) {
        currentTab = tab;
        document.getElementById('tabOfficial').classList.toggle('active', tab === 'official');
        document.getElementById('tabCustom').classList.toggle('active', tab === 'custom');
        document.getElementById('createSrvSection').style.display = (tab === 'custom') ? 'block' : 'none';
        renderServerList();
      };

      window.copyMyRefLink = function(ownerName) {
        const link = window.location.origin + '/?ref=' + encodeURIComponent(ownerName.toLowerCase());
        if (navigator.clipboard) navigator.clipboard.writeText(link);
        alert('🔗 Referral Link Copied!\n' + link + '\n\nInvite 15 new players using this link for +7 DAYS FREE, or email an Amazon/Google Play Gift Code to singhalshamaksh@gmail.com for a PERMANENT server!');
      };

      function renderServerList() {
        const box = document.getElementById('srvListContainer');
        if (!box) return;
        box.innerHTML = '';
        const filtered = allServers.filter(s => currentTab === 'official' ? (s.type === 'official' || s.type === 'secret') : s.type === 'custom');
        if (filtered.length === 0) {
          box.innerHTML = '<div style="text-align:center;color:#94a3b8;font-size:12px;padding:14px;">No custom servers yet! Create your 7-day free trial below 👇</div>';
          return;
        }
        filtered.forEach(s => {
          const isFull = s.count >= s.max;
          const div = document.createElement('div');
          div.className = 'srv-card ' + (s.theme || '') + (isFull ? ' full' : '');
          let badge = s.count + '/' + s.max + ' 👥';
          let subLine = 'Host: ' + s.owner.toUpperCase();

          if (s.locked) badge = '🔐 OG PASS | ' + badge;
          else if (s.expired) {
            badge = '🔒 EXPIRED (' + s.refCount + '/15 Refs)';
            subLine = 'Bring ' + (15 - s.refCount) + ' more refs or email singhalshamaksh@gmail.com';
          } else if (s.type === 'custom' && !s.permanent) {
            badge = '⏳ ' + s.daysLeft + 'd | ' + badge;
            subLine = 'Host: ' + s.owner.toUpperCase() + ' | Refs: ' + s.refCount + '/15';
          } else if (s.permanent) {
            badge = '⭐ VIP | ' + badge;
          }

          div.innerHTML = '<div><div style="font-weight:bold;font-size:13px;">' + s.name + '</div><div style="font-size:11px;color:#94a3b8;">' + subLine + '</div></div><div class="srv-pill">' + badge + '</div>';
          div.onclick = () => selectAndEnterServer(s);
          box.appendChild(div);

          if (s.type === 'custom' && !s.permanent) {
            const refBtn = document.createElement('div');
            refBtn.style.cssText = 'text-align:right;margin:-4px 0 8px 0;';
            refBtn.innerHTML = '<button onclick="event.stopPropagation();copyMyRefLink(\'' + s.owner + '\')" style="background:#059669;border:none;color:#fff;font-size:11px;font-weight:bold;padding:3px 10px;border-radius:8px;cursor:pointer;">🔗 Copy Invite Link (' + s.refCount + '/15 for +7 Days)</button>';
            box.appendChild(refBtn);
          }
        });
      }
      function selectAndEnterServer(srv) {
        if (srv.expired && !isLockedHostDevice) {
          const link = window.location.origin + '/?ref=' + encodeURIComponent(srv.owner);
          alert('🔒 Your 7-Day Free Trial has ended!\n\nOption 1 (FREE): Share your link with ' + (15 - srv.refCount) + ' more friends to unlock +7 DAYS:\n' + link + '\n\nOption 2 (PERMANENT): Email an Amazon Pay or Google Play Gift Code (with your Server Name) to singhalshamaksh@gmail.com!');
          return;
        }
        let pass = '';
        if (srv.locked && !isLockedHostDevice) {
          pass = prompt('💠 PRIVATE SERVER\nEnter Secret Password:');
          if (!pass) return;
        }
        if (typeof socket !== 'undefined') {
          socket.emit('verifyServerAccess', { serverId: srv.id, password: pass, deviceId: devId, browserFp });
        }
      }

      window.createTrialServer = function() {
        const name = document.getElementById('newSrvName').value.trim();
        const owner = document.getElementById('newSrvOwner').value.trim();
        const theme = document.getElementById('newSrvTheme').value;
        if (!name || !owner) { alert('Please enter both Server Name and your Username!'); return; }
        if (typeof socket !== 'undefined') {
          socket.emit('createCustomServer', { name, owner, theme, deviceId: devId, browserFp });
        }
      };

      function updateDidiBannerVisibility(show) {
        const box = document.getElementById('didiPromoBox');
        if (!box) return;
        box.style.display = (show && window.selectedServerId === 'srv_milly') ? 'block' : 'none';
      }

      function upgradeHornToMemeMaker() {
        const btns = Array.from(document.querySelectorAll('button'));
        const hornBtn = btns.find(b => /horn|airhorn|📯|📢/i.test(b.textContent || '') || (b.getAttribute('onclick') || '').includes('airhorn'));
        if (hornBtn && !hornBtn.dataset.memeUpgraded) {
          hornBtn.dataset.memeUpgraded = 'true';
          hornBtn.innerHTML = '😂 Meme Studio';
          hornBtn.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
          hornBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            openMemeMakerModal();
          };
        }
      }

      const MEME_TEMPLATES = [
        { name: "🔥 Classic Drake Choice", bg1: "#1e293b", bg2: "#f59e0b", emoji: "🙅‍♂️ / 👉😎" },
        { name: "🐶 This Is Fine Fire", bg1: "#7f1d1d", bg2: "#ea580c", emoji: "🐶☕🔥🔥" },
        { name: "🤡 Clown Transformation", bg1: "#311042", bg2: "#ec4899", emoji: "🧑 ➡️ 🤡" },
        { name: "🧠 Galaxy Brain", bg1: "#090d16", bg2: "#38bdf8", emoji: "🧠⚡🌌" },
        { name: "💀 Skull Bruh Moment", bg1: "#111827", bg2: "#6b7280", emoji: "💀🗿" },
        { name: "🗿 Gigachad Sigma", bg1: "#18181b", bg2: "#a1a1aa", emoji: "🗿💪🔥" },
        { name: "👀 Side-Eye Monkey", bg1: "#422006", bg2: "#eab308", emoji: "🐒👀💦" },
        { name: "🚨 FBI Open Up", bg1: "#1e3a8a", bg2: "#dc2626", emoji: "🚓🚨🚪💥" },
        { name: "💸 Take My Money", bg1: "#064e3b", bg2: "#10b981", emoji: "Shut Up & 💵💵" },
        { name: "😭 Emotional Damage", bg1: "#4c0519", bg2: "#f43f5e", emoji: "💔😭👟" },
        { name: "👑 Host Power Abuse", bg1: "#3b0764", bg2: "#facc15", emoji: "👑😈🔨" },
        { name: "💣 Bomb Pass Panic", bg1: "#7c2d12", bg2: "#f97316", emoji: "😱💣⏱️💥" }
      ];

      window._memeStickers = [];
      window._memeTextColor = '#ffffff';
      window._memeFilter = 'none';
          window.openMemeMakerModal = function() {
        let modal = document.getElementById('arenaMemeModal');
        if (!modal) {
          modal = document.createElement('div');
          modal.id = 'arenaMemeModal';
          modal.style.cssText = 'position:fixed;inset:0;background:rgba(7,11,25,0.94);z-index:999998;display:flex;align-items:center;justify-content:center;padding:10px;backdrop-filter:blur(8px);';
          const opts = MEME_TEMPLATES.map((t, i) => '<option value="' + i + '">' + t.name + '</option>').join('');
          const stickers = ['😂','💀','🔥','🤡','👑','🧢','😭','🗿'].map(em => '<button onclick="addMemeSticker(\'' + em + '\')" style="background:#1e293b;border:1px solid #475569;border-radius:8px;padding:2px 6px;font-size:14px;cursor:pointer;">' + em + '</button>').join('');
          modal.innerHTML =
            '<div style="background:#0f172a;border:2px solid #f59e0b;border-radius:20px;padding:12px;width:100%;max-width:410px;color:#fff;text-align:center;box-shadow:0 0 30px rgba(245,158,11,0.4);max-height:94vh;overflow-y:auto;">' +
              '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
                '<span style="font-weight:900;font-size:15px;color:#fbbf24;">😂 PRO MEME STUDIO</span>' +
                '<button onclick="document.getElementById(\'arenaMemeModal\').style.display=\'none\'" style="background:#ef4444;border:none;color:#fff;border-radius:8px;padding:4px 10px;font-weight:bold;cursor:pointer;">✕ Close</button>' +
              '</div>' +
              '<div style="display:flex;gap:6px;margin-bottom:6px;">' +
                '<select id="memeTemplateSelect" onchange="window._memeCustomImg=null;renderMemeCanvas()" style="flex:1;padding:8px;border-radius:10px;border:1.5px solid #f59e0b;background:#1e293b;color:#fff;font-size:12px;">' + opts + '</select>' +
                '<button type="button" onclick="loadMemeFromUrl()" style="background:#0284c7;color:#fff;padding:8px 10px;border-radius:10px;font-size:11px;font-weight:bold;cursor:pointer;white-space:nowrap;border:1px solid #38bdf8;">🌐 Link</button>' +
                '<label style="background:#334155;color:#fff;padding:8px 10px;border-radius:10px;font-size:11px;font-weight:bold;cursor:pointer;white-space:nowrap;border:1px solid #64748b;display:inline-flex;align-items:center;">' +
                  '📸 Photo' +
                  '<input id="memeFileInput" type="file" accept="image/*" onchange="loadCustomMemePhoto(event)" style="width:1px;height:1px;opacity:0;position:absolute;">' +
                '</label>' +
              '</div>' +
              '<input id="memeTopText" oninput="renderMemeCanvas()" placeholder="TOP TEXT..." maxlength="40" style="width:100%;padding:7px;border-radius:10px;border:1.5px solid #38bdf8;background:#090d16;color:#fff;margin-bottom:5px;box-sizing:border-box;font-size:16px;">' +
              '<input id="memeBottomText" oninput="renderMemeCanvas()" placeholder="BOTTOM TEXT..." maxlength="40" style="width:100%;padding:7px;border-radius:10px;border:1.5px solid #38bdf8;background:#090d16;color:#fff;margin-bottom:6px;box-sizing:border-box;font-size:16px;">' +
              '<div style="display:flex;gap:6px;align-items:center;justify-content:space-between;margin-bottom:6px;background:#1e293b;padding:6px 8px;border-radius:10px;font-size:11px;">' +
                '<span>Size: <input id="memeFontSize" type="range" min="16" max="34" value="22" oninput="renderMemeCanvas()" style="width:65px;vertical-align:middle;"></span>' +
                '<span style="display:flex;gap:4px;">' +
                  '<button onclick="window._memeTextColor=\'#ffffff\';renderMemeCanvas()" style="width:18px;height:18px;border-radius:50%;background:#fff;border:1px solid #38bdf8;cursor:pointer;"></button>' +
                  '<button onclick="window._memeTextColor=\'#facc15\';renderMemeCanvas()" style="width:18px;height:18px;border-radius:50%;background:#facc15;border:1px solid #fff;cursor:pointer;"></button>' +
                  '<button onclick="window._memeTextColor=\'#ef4444\';renderMemeCanvas()" style="width:18px;height:18px;border-radius:50%;background:#ef4444;border:1px solid #fff;cursor:pointer;"></button>' +
                  '<button onclick="window._memeTextColor=\'#4ade80\';renderMemeCanvas()" style="width:18px;height:18px;border-radius:50%;background:#4ade80;border:1px solid #fff;cursor:pointer;"></button>' +
                '</span>' +
                '<select id="memeFilterSelect" onchange="window._memeFilter=this.value;renderMemeCanvas()" style="padding:3px;border-radius:6px;background:#0f172a;color:#fff;border:1px solid #38bdf8;font-size:11px;">' +
                  '<option value="none">🎨 Normal</option>' +
                  '<option value="contrast(220%) saturate(300%)">🔥 Deep-Fry</option>' +
                  '<option value="grayscale(100%)">🖤 B&W</option>' +
                  '<option value="invert(100%)">👾 Invert</option>' +
                  '<option value="sepia(90%)">📜 Vintage</option>' +
                '</select>' +
              '</div>' +
              '<div style="display:flex;gap:5px;justify-content:center;align-items:center;margin-bottom:6px;flex-wrap:wrap;"><span style="font-size:11px;color:#94a3b8;">Stickers:</span>' + stickers + '<button onclick="window._memeStickers.pop();renderMemeCanvas()" style="background:#dc2626;color:#fff;border:none;border-radius:8px;padding:3px 7px;font-size:10px;font-weight:bold;cursor:pointer;">Undo</button></div>' +
              '<canvas id="arenaMemeCanvas" width="340" height="250" onclick="moveLastSticker(event)" style="border:1.5px solid #fbbf24;border-radius:12px;max-width:100%;background:#090d16;cursor:pointer;"></canvas>' +
              '<div style="font-size:10px;color:#94a3b8;margin-top:3px;">Tap anywhere on canvas to move last sticker!</div>' +
              '<div style="display:flex;gap:6px;margin-top:8px;">' +
                '<button onclick="downloadMemeLocally()" style="flex:1;padding:9px;border:none;border-radius:12px;background:#334155;color:#fff;font-weight:bold;font-size:12px;cursor:pointer;">💾 Save</button>' +
                '<button onclick="postMemeToChat()" style="flex:2;padding:9px;border:none;border-radius:12px;background:linear-gradient(90deg,#10b981,#059669);color:#fff;font-weight:900;font-size:13px;cursor:pointer;">🚀 Post to Chat!</button>' +
              '</div>' +
            '</div>';
          document.body.appendChild(modal);
        }
        modal.style.display = 'flex';
        renderMemeCanvas();
      };

      window.loadMemeFromUrl = function() {
        var url = prompt('Paste any Image Link (JPG/PNG/GIF):');
        if (!url) return;
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
          var off = document.createElement('canvas');
          off.width = 340;
          off.height = 250;
          off.getContext('2d').drawImage(img, 0, 0, 340, 250);
          window._memeCustomImg = off;
          renderMemeCanvas();
        };
        img.onerror = function() {
          alert('That website blocks direct image loading—try another image link!');
        };
        img.src = url.trim();
      };

      window.addMemeSticker = function(emoji) {
        window._memeStickers.push({ emoji, x: 170 + (Math.random() * 40 - 20), y: 125 + (Math.random() * 40 - 20) });
        renderMemeCanvas();
      };

      window.moveLastSticker = function(e) {
        if (!window._memeStickers.length) return;
        const c = document.getElementById('arenaMemeCanvas');
        const rect = c.getBoundingClientRect();
        const last = window._memeStickers.at(-1);
        last.x = (e.clientX - rect.left) * (c.width / rect.width);
        last.y = (e.clientY - rect.top) * (c.height / rect.height);
        renderMemeCanvas();
      };
      window.loadCustomMemePhoto = function(e) {
        try {
          var input = e && e.target ? e.target : document.getElementById('memeFileInput');
          var file = (input && input.files && input.files.length > 0) ? input.files.item(0) : null;
          if (!file) return;
          var objUrl = URL.createObjectURL(file);
          var img = new Image();
          img.onload = function() {
            var off = document.createElement('canvas');
            off.width = 340;
            off.height = 250;
            off.getContext('2d').drawImage(img, 0, 0, 340, 250);
            window._memeCustomImg = off;
            URL.revokeObjectURL(objUrl);
            if (input) input.value = '';
            renderMemeCanvas();
          };
          img.onerror = function() {
            URL.revokeObjectURL(objUrl);
            alert('Could not load photo! Try a JPG or PNG.');
          };
          img.src = objUrl;
        } catch (err) {
          alert('Photo Error: ' + err.message);
        }
      };
      window.renderMemeCanvas = function() {
        const c = document.getElementById('arenaMemeCanvas');
        if (!c) return;
        const ctx = c.getContext('2d');
        const idx = parseInt(document.getElementById('memeTemplateSelect')?.value || '0', 10);
        const tpl = MEME_TEMPLATES.at(idx) || MEME_TEMPLATES.at(0);

        ctx.save();
        ctx.filter = window._memeFilter || 'none';
        if (window._memeCustomImg) {
          ctx.drawImage(window._memeCustomImg, 0, 0, c.width, c.height);
        } else {
          const grad = ctx.createLinearGradient(0, 0, c.width, c.height);
          grad.addColorStop(0, tpl.bg1);
          grad.addColorStop(1, tpl.bg2);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, c.width, c.height);

          ctx.font = '42px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(tpl.emoji, c.width / 2, c.height / 2);
        }
        ctx.restore();

        ctx.font = '34px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        window._memeStickers.forEach(s => ctx.fillText(s.emoji, s.x, s.y));

        const top = (document.getElementById('memeTopText')?.value || '').toUpperCase();
        const bot = (document.getElementById('memeBottomText')?.value || '').toUpperCase();
        const fSize = parseInt(document.getElementById('memeFontSize')?.value || '22', 10);

        ctx.font = '900 ' + fSize + 'px Impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#000';
        ctx.fillStyle = window._memeTextColor || '#fff';

        if (top) {
          ctx.strokeText(top, c.width / 2, 32, c.width - 16);
          ctx.fillText(top, c.width / 2, 32, c.width - 16);
        }
        if (bot) {
          ctx.strokeText(bot, c.width / 2, c.height - 16, c.width - 16);
          ctx.fillText(bot, c.width / 2, c.height - 16, c.width - 16);
        }
      };

      window.downloadMemeLocally = function() {
        const c = document.getElementById('arenaMemeCanvas');
        if (!c) return;
        const a = document.createElement('a');
        a.download = 'sammu-meme-' + Date.now() + '.jpg';
        a.href = c.toDataURL('image/jpeg', 0.85);
        a.click();
      };

      window.postMemeToChat = function() {
        const c = document.getElementById('arenaMemeCanvas');
        if (!c || typeof socket === 'undefined') return;
        const dataUrl = c.toDataURL('image/jpeg', 0.72);
        socket.emit('postArenaMeme', { image: dataUrl });
        document.getElementById('arenaMemeModal').style.display = 'none';
      };

      setInterval(upgradeHornToMemeMaker, 1000);

      setInterval(() => {
        if (window.selectedServerId === 'srv_topsecret') {
          let fab = document.getElementById('aiConsoleFab');
          if (window.selectedServerId === 'srv_topsecret') {
            if (!fab) {
              fab = document.createElement('button');
              fab.id = 'aiConsoleFab';
              fab.innerText = '🤖 AI Console';
              fab.style.cssText = 'position:fixed;bottom:18px;left:18px;z-index:99999999;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;border:2px solid #c4b5fd;border-radius:999px;padding:12px 18px;font-size:14px;font-weight:900;cursor:pointer';
              fab.onclick = function() { openAiConsole(); };
              document.body.appendChild(fab);
            }
            fab.style.display = 'block';
          } else {
            if (fab) fab.style.display = 'none';
          }
        }
      }, 800);

      function hookServerSocket() {
        if (typeof socket === 'undefined' || window._srvHooked) return;
        window._srvHooked = true;

        const origOnevent = socket.onevent;
        socket.onevent = function(packet) {
          const ev = packet && packet.data && packet.data.at(0);
          const payload = packet && packet.data && packet.data.at(1);
          const isolated = ['incomingMusicNote', 'playMemeSfx', 'message', 'syncGame', 'spinnerTick', 'announceWinner', 'openSkincareClinic'];

          if (!window.selectedServerId && isolated.includes(ev)) return;
          if (isolated.includes(ev) && payload && typeof payload === 'object') {
            if (payload._serverId && payload._serverId !== window.selectedServerId) return;
          }
          return origOnevent.apply(this, arguments);
        };

        socket.emit('checkOGSignature', { deviceId: devId, browserFp });
        socket.emit('requestServerList');

        const pendingRef = localStorage.getItem('sammu_pending_ref');
        if (pendingRef) {
          socket.emit('registerReferral', { refOwner: pendingRef, deviceId: devId });
          localStorage.removeItem('sammu_pending_ref');
        }

        socket.on('ogDeviceVerified', (ok) => { isLockedHostDevice = Boolean(ok); });
        socket.on('serverListUpdate', (list) => { allServers = list; renderServerList(); });
        socket.on('toggleDidiPromo', (show) => { updateDidiBannerVisibility(show); });
        socket.on('serverAccessGranted', (srv) => {
          window.selectedServerId = srv.id;
          document.getElementById('srvBrowserOverlay').style.display = 'none';
          updateDidiBannerVisibility(Boolean(srv.millyPromoOn));
        });
        socket.on('serverAccessDenied', (msg) => alert(msg));
      }
      window.addEventListener('DOMContentLoaded', () => { hookServerSocket(); setTimeout(hookServerSocket, 600); });
    })();
} catch (e) { console.error('Widget MULTI_SERVER_UI error:', e); }

// === WORD_IMPOSTER_WIDGET ===
try {
(function() {
      function injectImposterBtn() {
        const targetBtn = Array.from(document.querySelectorAll('button')).find(b => /hoop shootout|target sniper/i.test(b.textContent || ''));
        if (targetBtn && targetBtn.parentElement && !document.getElementById('btnLaunchImposter')) {
          const btn = targetBtn.cloneNode(true);
          btn.id = 'btnLaunchImposter';
          btn.removeAttribute('onclick');
          btn.textContent = '25. 🕵️ Word Imposter';
          btn.onclick = () => { if (typeof socket !== 'undefined') socket.emit('startWordImposter'); };
          targetBtn.parentElement.appendChild(btn);
        }
        const memeBtn = Array.from(document.querySelectorAll('button')).find(b => b.dataset && b.dataset.memeUpgraded);
        if (memeBtn && memeBtn.parentElement && !document.getElementById('reopenImpBtn')) {
          const rBtn = memeBtn.cloneNode(true);
          rBtn.id = 'reopenImpBtn';
          rBtn.style.display = 'none';
          rBtn.textContent = '🕵️ Vote';
          rBtn.onclick = () => { document.getElementById('imposterModal').style.display = 'flex'; };
          memeBtn.parentElement.insertBefore(rBtn, memeBtn.nextSibling);
        }
      }
      setInterval(injectImposterBtn, 1200);

      function bindImposterSockets() {
        if (typeof socket === 'undefined' || window._impBound) return;
        window._impBound = true;

        socket.on('imposterRoundStart', (data) => {
          if (data._serverId && data._serverId !== window.selectedServerId) return;
          document.getElementById('imposterModal').style.display = 'flex';
          const rBtn = document.getElementById('reopenImpBtn');
          if (rBtn) rBtn.style.display = 'inline-block';

          const roleBox = document.getElementById('impSecretRoleBox');
          if (data.isImposter) {
            roleBox.innerHTML = '😈 YOU ARE THE IMPOSTER!<br><span style="font-size:12px;color:#fda4af;">You have NO word! Read clues & blend in!</span>';
          } else {
            roleBox.innerHTML = '😇 CREWMATE SECRET WORD:<br><span style="font-size:20px;color:#4ade80;">' + data.word + '</span>';
          }

          const grid = document.getElementById('impVoteGrid');
          grid.innerHTML = '';
          document.getElementById('impVoteStatus').textContent = 'Cast your vote when ready!';
          data.players.forEach(p => {
            const vBtn = document.createElement('button');
            vBtn.style.cssText = 'background:#1e293b;border:1.5px solid #38bdf8;color:#fff;padding:8px;border-radius:12px;font-weight:bold;font-size:12px;cursor:pointer;';
            vBtn.textContent = '🗳️ ' + p.username;
            vBtn.onclick = () => {
              socket.emit('castImposterVote', p.id);
              document.getElementById('impVoteStatus').textContent = '✅ Voted for ' + p.username + '! Waiting for others...';
              Array.from(grid.children).forEach(c => c.disabled = true);
            };
            grid.appendChild(vBtn);
          });
        });

        socket.on('imposterRoundEnd', (data) => {
          if (data._serverId && data._serverId !== window.selectedServerId) return;
          document.getElementById('imposterModal').style.display = 'none';
          const rBtn = document.getElementById('reopenImpBtn');
          if (rBtn) rBtn.style.display = 'none';
        });
      }
      setInterval(bindImposterSockets, 800);
    })();
} catch (e) { console.error('Widget WORD_IMPOSTER_WIDGET error:', e); }

// === ZORO_ISOLATION_SCRIPT ===
try {
(function() {
      function updateZoroBanner(show) {
        let zBox = document.getElementById('zoroPromoBox');
        if (!zBox) {
          zBox = document.createElement('div');
          zBox.id = 'zoroPromoBox';
          zBox.style.cssText = 'display:none;background:linear-gradient(90deg,#14532d,#166534);border:2px solid #4ade80;border-radius:14px;padding:10px 14px;margin:8px auto;max-width:360px;text-align:center;color:#fff;box-shadow:0 0 20px rgba(74,222,128,0.35);position:relative;z-index:50;';
          zBox.innerHTML =
            '<div style="font-size:11px;color:#bbf7d0;font-weight:bold;">⚔️ ZORO\'S DOJO FEATURED CREATOR</div>' +
            '<div style="font-size:15px;font-weight:900;margin:2px 0;">✨ Yori Akiyama ✨</div>' +
            '<a href="https://youtube.com" target="_blank" rel="noopener noreferrer" ' +
            'style="display:inline-block;margin-top:4px;background:#ef4444;color:#fff;text-decoration:none;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:bold;">▶️ Subscribe on YouTube</a>';
          const didiBox = document.getElementById('didiPromoBox');
          if (didiBox && didiBox.parentNode) didiBox.parentNode.insertBefore(zBox, didiBox.nextSibling);
          else document.body.prepend(zBox);
        }
        if (show && window.selectedServerId === 'srv_zoro') {
          zBox.style.setProperty('display', 'block', 'important');
        } else {
          zBox.style.setProperty('display', 'none', 'important');
        }
      }

      // 2. Auto-Prune Old Chat Messages so mobile browsers never lag or freeze
      function startChatAntiFreeze() {
        const chatContainers = Array.from(document.querySelectorAll('#chatBox, #messages, .chat-messages, [id*="chat"]'))
          .filter(el => el.scrollHeight >= el.clientHeight && el.tagName === 'DIV');
        const box = chatContainers.at(0);
        if (!box || box.dataset.antiFreezeAttached) return;
        box.dataset.antiFreezeAttached = 'true';

        // Hardware GPU acceleration for butter-smooth mobile scrolling
        box.style.willChange = 'transform';
        box.style.webkitOverflowScrolling = 'touch';

        const observer = new MutationObserver(() => {
          // Keep only the latest 65 messages in DOM so low-RAM phones stay super fast
          while (box.children.length > 65) {
            box.removeChild(box.firstElementChild);
          }
          // Lazy-decode incoming images so chat text renders instantly first
          const imgs = box.querySelectorAll('img:not([decoding])');
          imgs.forEach(img => {
            img.setAttribute('loading', 'lazy');
            img.setAttribute('decoding', 'async');
          });
        });
        observer.observe(box, { childList: true });
      }

      // 3. Auto-Compress Large Outgoing Images on Slow Connections
      function wrapSocketForSlowNet() {
        if (typeof socket === 'undefined' || window._zoroAddonBound) return;
        window._zoroAddonBound = true;

        // Fast auto-reconnect on mobile signal drops
        if (socket.io && socket.io.opts) {
          socket.io.opts.reconnectionDelay = 500;
          socket.io.opts.reconnectionDelayMax = 3000;
        }

        const origEmit = socket.emit.bind(socket);
        socket.emit = function(ev, payload, ...rest) {
          // Compress chatImage / postArenaMeme if larger than 90KB so it doesn't clog slow internet
          if ((ev === 'chatImage' || ev === 'postArenaMeme') && payload && typeof payload.image === 'string' && payload.image.length > 95000) {
            const img = new Image();
            img.onload = () => {
              const c = document.createElement('canvas');
              const scale = Math.min(1, 280 / Math.max(img.width, img.height));
              c.width = Math.round(img.width * scale);
              c.height = Math.round(img.height * scale);
              c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
              payload.image = c.toDataURL('image/jpeg', 0.65);
              origEmit(ev, payload, ...rest);
            };
            img.src = payload.image;
            return socket;
          }
          return origEmit(ev, payload, ...rest);
        };

        const prevOnevent = socket.onevent;
        socket.onevent = function(packet) {
          const ev = packet && packet.data && packet.data.at(0);
          const payload = packet && packet.data && packet.data.at(1);
          const strictEvents = [
            'incomingMusicNote', 'playMemeSfx', 'incomingReaction', 'incomingGift',
            'message', 'syncGame', 'spinnerTick', 'announceWinner',
            'openSkincareClinic', 'closeSkincareClinic', 'updateMVP', 'updateGallery'
          ];
          if (!window.selectedServerId && strictEvents.includes(ev)) return;
          if (strictEvents.includes(ev) && payload && typeof payload === 'object') {
            if (payload._serverId && payload._serverId !== window.selectedServerId) return;
          }
          return prevOnevent.apply(this, arguments);
        };

        // Seamless auto-rejoin into the same server room if her mobile data briefly drops
        socket.on('connect', () => {
          if (window.selectedServerId) {
            origEmit('verifyServerAccess', {
              serverId: window.selectedServerId,
              deviceId: localStorage.getItem('sammu_dev_uid') || ''
            });
          }
        });

        socket.on('toggleZoroPromo', (data) => {
          const isShown = (typeof data === 'object' && data !== null) ? Boolean(data.show) : Boolean(data);
          updateZoroBanner(isShown);
        });
        socket.on('serverAccessGranted', (srv) => {
          window.selectedServerId = srv.id;
          updateZoroBanner(srv.id === 'srv_zoro' && Boolean(srv.zoroPromoOn));
          setTimeout(startChatAntiFreeze, 500);
        });
        socket.on('initRole', () => updateZoroBanner(false));
      }

      window.addEventListener('DOMContentLoaded', () => {
        wrapSocketForSlowNet();
        startChatAntiFreeze();
        setTimeout(() => { wrapSocketForSlowNet(); startChatAntiFreeze(); }, 800);
      });
    })();
} catch (e) { console.error('Widget ZORO_ISOLATION_SCRIPT error:', e); }

// === PHONK_DJ_WIDGET ===
try {
(function() {
      let audioCtx = null, beatTimer = null, beatStep = 0, activeTrackLabel = null, auraMode = 'bhai';

      window.setAuraMode = function(m) {
        auraMode = m;
        document.getElementById('modeBhai').classList.toggle('active', m === 'bhai');
        document.getElementById('modeRival').classList.toggle('active', m === 'rival');
        document.getElementById('modeVibe').classList.toggle('active', m === 'vibe');
      };

      function getAudio() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
      }

      function bounceVisualizer() {
        const bars = document.querySelectorAll('#djVisualizer .dj-bar');
        bars.forEach(b => { b.style.height = (Math.floor(Math.random() * 82) + 18) + '%'; });
        setTimeout(() => bars.forEach(b => { b.style.height = '15%'; }), 140);
      }

      window.minimizePhonkDeck = function() {
        document.getElementById('phonkDjModal').style.display = 'none';
        const bar = document.getElementById('phonkMiniBar');
        if (bar) {
          bar.style.display = activeTrackLabel ? 'flex' : 'none';
          const lbl = document.getElementById('miniBarTrack');
          if (lbl && activeTrackLabel) lbl.textContent = '🎧 ' + activeTrackLabel;
        }
      };

      window.playPhonkSynth = function(sound) {
        try {
          const ctx = getAudio(), now = ctx.currentTime;
          bounceVisualizer();

          if (sound === 'cowbell1' || sound === 'cowbell2' || sound === 'cowbell3' || sound === 'cowbell4') {
            const freqMap = { cowbell1: 540, cowbell2: 405, cowbell3: 640, cowbell4: 480 };
            const baseFreq = freqMap[sound] || 540;
            [baseFreq, baseFreq * 1.48].forEach(f => {
              const osc = ctx.createOscillator(), gain = ctx.createGain();
              osc.type = 'square'; osc.frequency.setValueAtTime(f, now);
              gain.gain.setValueAtTime(0.35, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
              osc.connect(gain); gain.connect(ctx.destination);
              osc.start(now); osc.stop(now + 0.22);
            });
          } else if (sound === 'bass808' || sound === 'kick') {
            const osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.type = 'sine';
            const startF = (sound === 'bass808') ? 170 : 185, endF = (sound === 'bass808') ? 28 : 40, dur = (sound === 'bass808') ? 0.55 : 0.22;
            osc.frequency.setValueAtTime(startF, now); osc.frequency.exponentialRampToValueAtTime(endF, now + dur);
            gain.gain.setValueAtTime(0.85, now); gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(now); osc.stop(now + dur + 0.02);
          } else if (sound === 'siren' || sound === 'horn') {
            const osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.type = 'sawtooth';
            if (sound === 'horn') {
              osc.frequency.setValueAtTime(470, now); osc.frequency.linearRampToValueAtTime(510, now + 0.4);
            } else {
              osc.frequency.setValueAtTime(600, now); osc.frequency.linearRampToValueAtTime(1150, now + 0.35); osc.frequency.linearRampToValueAtTime(520, now + 0.65);
            }
            gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.66);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(now); osc.stop(now + 0.68);
          } else if (sound === 'scratch' || sound === 'laser') {
            const osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.type = (sound === 'laser') ? 'sawtooth' : 'triangle';
            osc.frequency.setValueAtTime(sound === 'laser' ? 1400 : 900, now);
            osc.frequency.exponentialRampToValueAtTime(160, now + 0.18);
            gain.gain.setValueAtTime(0.22, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(now); osc.stop(now + 0.23);
          }
        } catch (e) {}
      };

      window.triggerDjSound = function(sound) {
        window.playPhonkSynth(sound);
        if (typeof socket !== 'undefined') socket.emit('phonkDjDrop', { sound });
      };

      window.stopPhonkLoop = function() {
        if (beatTimer) { clearInterval(beatTimer); beatTimer = null; }
        activeTrackLabel = null;
        document.querySelectorAll('.dj-loop-btn').forEach(b => b.classList.remove('active'));
        const bar = document.getElementById('phonkMiniBar');
        if (bar) bar.style.display = 'none';
      };

      window.togglePhonkBeat = function(style, label) {
        window.stopPhonkLoop();
        activeTrackLabel = label || style;
        const idMap = {
          drift: 'loopDrift', brazil: 'loopBrazil', murder: 'loopMurder', sigma: 'loopSigma',
          memphis: 'loopMemphis', cyber: 'loopCyber', tokyo: 'loopTokyo', demon: 'loopDemon'
        };
        const btn = document.getElementById(idMap[style]);
        if (btn) btn.classList.add('active');
        const np = document.getElementById('djNowPlaying');
        if (np) np.textContent = '🎶 Playing: ' + activeTrackLabel + ' (Hit Minimize to keep playing!)';

        const tracks = {
          drift:   { tempo: 205, seq: ['bass808', 'cowbell1', 'cowbell2', 'kick', 'cowbell1', 'cowbell1', 'bass808', 'cowbell2'] },
          brazil:  { tempo: 115, seq: ['bass808', 'cowbell1', 'cowbell2', 'kick', 'cowbell1', 'cowbell2', 'kick', 'cowbell2'] },
          murder:  { tempo: 195, seq: ['bass808', 'cowbell3', 'cowbell1', 'cowbell2', 'kick', 'cowbell3', 'cowbell1', 'bass808'] },
          sigma:   { tempo: 225, seq: ['bass808', 'kick', 'cowbell1', 'cowbell1', 'bass808', 'cowbell2', 'cowbell3', 'kick'] },
          memphis: { tempo: 215, seq: ['bass808', 'cowbell2', 'scratch', 'kick', 'cowbell1', 'cowbell2', 'bass808', 'siren'] },
          cyber:   { tempo: 175, seq: ['kick', 'laser', 'cowbell3', 'bass808', 'kick', 'cowbell1', 'laser', 'scratch'] },
          tokyo:   { tempo: 180, seq: ['cowbell3', 'cowbell3', 'kick', 'cowbell1', 'cowbell4', 'bass808', 'cowbell1', 'scratch'] },
          demon:   { tempo: 96, seq: ['kick', 'revbass', 'lead1', 'revbass', 'kick', 'revbass', 'lead3', 'revbass', 'kick', 'revbass', 'lead4', 'revbass', 'kick', 'revbass', 'lead3'] }
        };
        const chosen = tracks[style] || tracks.drift;
        beatStep = 0;
        beatTimer = setInterval(() => {
          window.triggerDjSound(chosen.seq.at(beatStep % chosen.seq.length));
          beatStep++;
        }, chosen.tempo);
      };
      window.scanAndDropAuraCard = function() {
        const myName = window._savedUname || localStorage.getItem('sammu_username') || localStorage.getItem('username') || 'Player';
        const p1 = ((document.getElementById('auraP1').value || '').trim() || myName).slice(0, 16);
        const p2 = (document.getElementById('auraP2').value || '').trim().slice(0, 16);

        const pct = Math.floor(Math.random() * 41) + 60;
        const tiers = [
          { score: "+999,999 ∞", rank: "🗿 GIGACHAD PHONK GODS", c1: "#3b0764", c2: "#be185d" },
          { score: "+88,500 ⚡", rank: "👑 SUPREME ARENA DUO", c1: "#0f172a", c2: "#0284c7" },
          { score: "+42,069 🔥", rank: "🥷 SHADOW NINJA SQUAD", c1: "#064e3b", c2: "#059669" },
          { score: "+19,400 ✨", rank: "🎧 CERTIFIED DRIFT VIBES", c1: "#312e81", c2: "#7c3aed" }
        ];
        const t = tiers.at(Math.floor(Math.random() * tiers.length));
        const modeLabels = { bhai: "🤝 BHAICHARA METER", rival: "⚔️ RIVALRY POWER", vibe: "💖 COSMIC VIBE SYNC" };

        const c = document.createElement('canvas');
        c.width = 320; c.height = 175;
        const ctx = c.getContext('2d');

        const grad = ctx.createLinearGradient(0, 0, 320, 175);
        grad.addColorStop(0, t.c1); grad.addColorStop(1, t.c2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 320, 175);

        ctx.strokeStyle = "#f472b6"; ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, 312, 167);

        ctx.fillStyle = "#fde047"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(p2 ? modeLabels[auraMode] : "🔮 SOLO PHONK AURA SCAN", 160, 26);

        ctx.fillStyle = "#ffffff"; ctx.font = "900 18px sans-serif";
        ctx.fillText(p2 ? (p1 + "  ⚡  " + p2) : p1, 160, 56);

        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(35, 72, 250, 18);
        ctx.fillStyle = "#4ade80";
        ctx.fillRect(35, 72, Math.round(2.5 * pct), 18);
        ctx.fillStyle = "#fff"; ctx.font = "bold 11px sans-serif";
        ctx.fillText(pct + "% SYNCED", 160, 85);

        ctx.fillStyle = "#67e8f9"; ctx.font = "900 16px sans-serif";
        ctx.fillText("AURA: " + t.score, 160, 118);

        ctx.fillStyle = "#fbcfe8"; ctx.font = "bold 13px sans-serif";
        ctx.fillText(t.rank, 160, 146);

        const cardImg = c.toDataURL('image/jpeg', 0.82);
        window.triggerDjSound('bass808');
        if (typeof socket !== 'undefined') {
          socket.emit('dropAuraCard', { image: cardImg, p1, p2, pct, rank: t.rank });
        }
        window.minimizePhonkDeck();
      };

      function setupPhonkDjAndAntiDrop() {
        if (!document.getElementById('openPhonkDjBtn')) {
          const anchor = document.getElementById('openChefBtn') || document.getElementById('openMakeupBtn') ||
            Array.from(document.querySelectorAll('button, a, div[onclick]')).find(el => el.children.length === 0 && /jam|🎹/i.test(el.textContent || ''));
          if (anchor && anchor.parentNode) {
            const btn = anchor.cloneNode(true);
            btn.id = 'openPhonkDjBtn'; btn.removeAttribute('onclick'); btn.textContent = '🎧 Phonk DJ';
            btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); document.getElementById('phonkDjModal').style.display = 'flex'; };
            anchor.parentNode.insertBefore(btn, anchor.nextSibling);
          }
        }

        if (typeof socket !== 'undefined' && !window._phonkSockBound) {
          window._phonkSockBound = true;

          if (socket.io && socket.io.opts) {
            socket.io.opts.reconnectionDelay = 400;
            socket.io.opts.reconnectionDelayMax = 2500;
          }

          const origEmit = socket.emit.bind(socket);
          socket.emit = function(ev, payload, ...rest) {
            if (ev === 'joinRoom' && payload && typeof payload === 'object') {
              if (payload.username) window._savedUname = payload.username;
              if (payload.avatar) window._savedAvatar = payload.avatar;
            }
            return origEmit(ev, payload, ...rest);
          };

          socket.on('connect', () => {
            if (window.selectedServerId) {
              origEmit('verifyServerAccess', {
                serverId: window.selectedServerId,
                deviceId: localStorage.getItem('sammu_dev_uid') || ''
              });
              const uname = window._savedUname || localStorage.getItem('sammu_username') || localStorage.getItem('username');
              const avatar = window._savedAvatar || localStorage.getItem('sammu_avatar') || localStorage.getItem('avatar') || '🥷';
              if (uname) {
                setTimeout(() => {
                  origEmit('joinRoom', {
                    username: uname, avatar: avatar,
                    deviceId: localStorage.getItem('sammu_dev_uid') || '', isReconnect: true
                  });
                }, 250);
              }
            }
          });

          socket.on('incomingPhonkDrop', (data) => {
            if (!data || !data.sound) return;
            if (data._serverId && window.selectedServerId && data._serverId !== window.selectedServerId) return;
            window.playPhonkSynth(data.sound);
            const label = document.getElementById('djNowPlaying');
            if (label && data.dj) label.textContent = '🎧 Live DJ: ' + data.dj + ' dropped ' + data.sound.toUpperCase() + '!';
          });
        }
      }

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && typeof socket !== 'undefined' && !socket.connected) socket.connect();
      });

      window.addEventListener('DOMContentLoaded', () => { setupPhonkDjAndAntiDrop(); setTimeout(setupPhonkDjAndAntiDrop, 1200); });
    })();
} catch (e) { console.error('Widget PHONK_DJ_WIDGET error:', e); }

// === AI_CONSOLE_WIDGET ===
try {
(function() {
      function setupAiConsole() {
        if (window.selectedServerId !== 'srv_topsecret') return;
        if (!document.getElementById('aiConsoleFab')) {
          const fab = document.createElement('button');
          fab.id = 'aiConsoleFab';
          fab.innerText = '🤖 AI Console';
          fab.style.cssText = 'position:fixed;bottom:18px;right:18px;z-index:99999999;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;border:2px solid #c4b5fd;border-radius:999px;padding:12px 18px;font-size:14px;font-weight:900;cursor:pointer;';
          fab.onclick = function() { openAiConsole(); };
          document.body.appendChild(fab);
        }
        if (!window._aiConsoleBound) {
          window._aiConsoleBound = true;
          socket.on('aiCommandsSync', renderAiCommands);
        }
      }

      function openAiConsole() {
        let modal = document.getElementById('aiConsoleModal');
        if (!modal) {
          modal = document.createElement('div');
          modal.id = 'aiConsoleModal';
          modal.style.cssText = 'position:fixed;inset:0;background:rgba(7,11,25,0.95);z-index:99999998;display:none;align-items:center;justify-content:center;padding:12px;';
          modal.innerHTML = '<div style="background:#0f172a;border:2px solid #38bdf8;border-radius:20px;padding:14px;width:100%;max-width:420px;color:#fff;"><div style="display:flex;justify-content:space-between;align-items:center;"><span style="font-weight:900;font-size:15px;color:#38bdf8;">🤖 AI CONSOLE</span><button onclick="document.getElementById('aiConsoleModal').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:8px;padding:4px 9px;font-weight:bold;cursor:pointer;">✕ Close</button></div><div style="display:flex;gap:6px;margin-bottom:8px;"><input id="aiCmdInput" placeholder="AI Command..." style="flex:1;padding:9px;border-radius:10px;border:1.5px solid #38bdf8;background:#090d16;color:#fff;font-size:12px;box-sizing:border-box;"><textarea id="aiCodeInput" placeholder="Optional Code..." style="width:100%;height:60px;margin-top:6px;padding:8px;border-radius:10px;border:1.5px solid #38bdf8;background:#090d16;color:#fff;font-size:11px;box-sizing:border-box;font-family:monospace;"></textarea></div><button onclick="sendAiCommand()" style="width:100%;padding:10px;border:none;border-radius:12px;background:linear-gradient(90deg,#10b981,#059669);color:#fff;font-weight:900;font-size:13px;cursor:pointer;">🚀 Send</button><div id="aiCommandList" style="margin-top:10px;max-height:220px;overflow-y:auto;"></div></div>';
          document.body.appendChild(modal);
        }
        modal.style.display = 'flex';
        renderAiCommands();
      }

      function sendAiCommand() {
        const cmd = (document.getElementById('aiCmdInput') || {}).value || '';
        const code = (document.getElementById('aiCodeInput') || {}).value || '';
        if (!cmd) return;
        if (typeof socket !== 'undefined') socket.emit('addAiCommand', { cmd, code });
        document.getElementById('aiCmdInput').value = '';
        document.getElementById('aiCodeInput').value = '';
      }

      function renderAiCommands() {
        const box = document.getElementById('aiCommandList');
        if (!box) return;
        box.innerHTML = '';
        if (typeof aiCommandsSync === 'undefined' || !Array.isArray(aiCommandsSync)) {
          box.innerHTML = '<div style="font-size:11px;color:#94a3b8;">No AI commands synced.</div>';
          return;
        }
        aiCommandsSync.forEach(c => {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;background:#1e293b;border:1px solid #334155;border-radius:10px;padding:7px 9px;margin-bottom:6px;font-size:11px;color:#fff;';
          row.innerHTML = '<span>' + (c.text || '') + '</span>';
          const actions = document.createElement('div');
          actions.style.cssText = 'display:flex;gap:5px;';
          const copyBtn = document.createElement('button');
          copyBtn.textContent = 'Copy';
          copyBtn.style.cssText = 'background:#0284c7;border:none;color:#fff;border-radius:7px;padding:4px 7px;font-size:10px;font-weight:bold;cursor:pointer;';
          copyBtn.onclick = function() { navigator.clipboard.writeText(c.text || ''); };
          const doneBtn = document.createElement('button');
          doneBtn.textContent = c.done ? 'Undo' : 'Done';
          doneBtn.style.cssText = 'background:#f59e0b;border:none;color:#fff;border-radius:7px;padding:4px 7px;font-size:10px;font-weight:bold;cursor:pointer;';
          doneBtn.onclick = function() { if (typeof socket !== 'undefined') socket.emit('markAiDone', c.id); };
          const delBtn = document.createElement('button');
          delBtn.textContent = 'Delete';
          delBtn.style.cssText = 'background:#ef4444;border:none;color:#fff;border-radius:7px;padding:4px 7px;font-size:10px;font-weight:bold;cursor:pointer;';
          delBtn.onclick = function() { if (typeof socket !== 'undefined') socket.emit('deleteAiCommand', c.id); };
          actions.appendChild(copyBtn); actions.appendChild(doneBtn); actions.appendChild(delBtn);
          row.appendChild(document.createTextNode(c.text || ''));
          row.appendChild(actions);
          box.appendChild(row);
        });
      }
      window.openAiConsole = openAiConsole;
      window.sendAiCommand = sendAiCommand;
      window.renderAiCommands = renderAiCommands;
    })();
} catch (e) { console.error('Widget AI_CONSOLE_WIDGET error:', e); }

// === PHONK_PRO_UPGRADE ===
try {
(function() {
      // 1. Stop heavy DOM polling intervals on old phones
      const _origSetInterval = window.setInterval;
      window.setInterval = function(fn, ms, ...args) {
        if (ms >= 600 && ms <= 1500 && fn && /querySelectorAll(['"]button['"])|aiConsoleFab|injectImposterBtn/.test(fn.toString())) {
          return _origSetInterval(fn, 4500, ...args);
        }
        return _origSetInterval(fn, ms, ...args);
      };

      let proCtx = null, proFilter = null, proDist = null;
      window._phonkBoost = true;
      window._phonkFilterFreq = 16000;

      function getProAudio() {
        if (!proCtx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          proCtx = new AC();
          proFilter = proCtx.createBiquadFilter();
          proFilter.type = 'lowpass';
          proFilter.frequency.value = window._phonkFilterFreq;
          proFilter.Q.value = 2.2;
          proFilter.connect(proCtx.destination);

          const n = 22050, curve = new Float32Array(n);
          for (let i = 0; i < n; i++) {
            const x = (i * 2) / n - 1;
            curve[i] = ((3 + 26) * x * 20 * (Math.PI / 180)) / (Math.PI + 26 * Math.abs(x));
          }
          proDist = curve;
        }
        if (proCtx.state === 'suspended') proCtx.resume();
        return proCtx;
      }

      // Override classic playPhonkSynth with Studio Brazilian Phonk & Jumpstyle DSP
      window.playPhonkSynth = function(sound) {
        try {
          const ctx = getProAudio(), now = ctx.currentTime;
          const bars = document.querySelectorAll('#djVisualizer .dj-bar');
          if (bars.length) {
            bars.forEach(b => { b.style.height = (Math.floor(Math.random() * 82) + 18) + '%'; });
            setTimeout(() => bars.forEach(b => { b.style.height = '15%'; }), 130);
          }

          if (sound === 'bass808' || sound === 'kick' || sound === 'batidao_sub') {
            const osc = ctx.createOscillator(), gain = ctx.createGain(), shaper = ctx.createWaveShaper();
            shaper.curve = proDist;
            osc.type = 'sine';
            const isSub = (sound === 'bass808' || sound === 'batidao_sub');
            const dur = isSub ? 0.52 : 0.22;
            osc.frequency.setValueAtTime(isSub ? 155 : 175, now);
            osc.frequency.exponentialRampToValueAtTime(window._phonkBoost ? 38 : 48, now + 0.085);
            osc.frequency.exponentialRampToValueAtTime(32, now + dur);
            gain.gain.setValueAtTime(window._phonkBoost ? 0.85 : 0.6, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
            osc.connect(shaper); shaper.connect(gain); gain.connect(proFilter);
            osc.start(now); osc.stop(now + dur + 0.02);
          } else if (sound === 'revbass') {
            // Heavenly Jumpstyle Reverse-Bass Stomp
            const osc = ctx.createOscillator(), gain = ctx.createGain(), shaper = ctx.createWaveShaper();
            shaper.curve = proDist;
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(44, now);
            osc.frequency.exponentialRampToValueAtTime(74, now + 0.16);
            gain.gain.setValueAtTime(0.01, now);
            gain.gain.linearRampToValueAtTime(0.6, now + 0.14);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
            osc.connect(shaper); shaper.connect(gain); gain.connect(proFilter);
            osc.start(now); osc.stop(now + 0.2);
          }
          else if (sound.startsWith('cowbell') || sound.startsWith('lead')) {
            const isSupersaw = sound.startsWith('lead');
            const noteMap = {
              cowbell1: 587.33, cowbell2: 440.00, cowbell3: 659.25, cowbell4: 523.25,
              lead1: 440.00, lead2: 523.25, lead3: 659.25, lead4: 783.99
            };
            const freq = noteMap[sound] || 540;
            if (isSupersaw) {
              const gain = ctx.createGain();
              gain.gain.setValueAtTime(0.01, now);
              gain.gain.linearRampToValueAtTime(0.24, now + 0.025);
              gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
              gain.connect(proFilter);
              [-16, -6, 0, 6, 16].forEach(det => {
                const o = ctx.createOscillator();
                o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, now); o.detune.value = det;
                o.connect(gain); o.start(now); o.stop(now + 0.35);
              });
            } else {
              const bp = ctx.createBiquadFilter(), gain = ctx.createGain();
              bp.type = 'bandpass'; bp.frequency.value = freq * 1.45; bp.Q.value = 3.8;
              gain.gain.setValueAtTime(0.42, now);
              gain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
              [1, 1.48].forEach(mult => {
                const o = ctx.createOscillator();
                o.type = 'square'; o.frequency.setValueAtTime(freq * mult, now);
                o.connect(bp); o.start(now); o.stop(now + 0.22);
              });
              bp.connect(gain); gain.connect(proFilter);
            }
          } else if (sound === 'hat' || sound === 'scratch' || sound === 'laser') {
            const osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.type = sound === 'laser' ? 'sawtooth' : 'triangle';
            osc.frequency.setValueAtTime(sound === 'laser' ? 1600 : 1100, now);
            osc.frequency.exponentialRampToValueAtTime(140, now + 0.14);
            gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
            osc.connect(gain); gain.connect(proFilter);
            osc.start(now); osc.stop(now + 0.17);
          } else if (sound === 'siren' || sound === 'horn') {
            const osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(sound === 'horn' ? 480 : 620, now);
            osc.frequency.linearRampToValueAtTime(sound === 'horn' ? 520 : 1200, now + 0.35);
            gain.gain.setValueAtTime(0.18, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
            osc.connect(gain); gain.connect(proFilter);
            osc.start(now); osc.stop(now + 0.56);
          }
        } catch (e) {}
      };
      // 2. Upgrade the 8 Track Loops to No Batidao & Heavenly Jumpstyle Beats
      let proBeatTimer = null, proStep = 0;
      const origStop = window.stopPhonkLoop;
      window.stopPhonkLoop = function() {
        if (proBeatTimer) { clearInterval(proBeatTimer); proBeatTimer = null; }
        if (typeof origStop === 'function') origStop();
      };

      window.togglePhonkBeat = function(style, label) {
        window.stopPhonkLoop();
        const proTracks = {
          brazil:  { tempo: 115, label: '🇧🇷 No Batidão (Brazilian Phonk)', seq: ['batidao_sub', 'hat', 'cowbell2', 'kick', 'cowbell1', 'hat', 'batidao_sub', 'cowbell3', 'kick', 'cowbell2', 'hat', 'cowbell4', 'batidao_sub', 'cowbell1', 'scratch', 'hat'] },
          demon:   { tempo: 96,  label: '🌌 Heavenly Jumpstyle (Euphoric)', seq: ['kick', 'revbass', 'lead1', 'revbass', 'kick', 'revbass', 'lead3', 'revbass', 'kick', 'revbass', 'lead4', 'revbass', 'kick', 'revbass', 'lead2', 'lead3'] },
          drift:   { tempo: 108, label: '🔥 Automotivo Mandelão', seq: ['batidao_sub', 'cowbell1', 'hat', 'cowbell1', 'kick', 'cowbell2', 'hat', 'batidao_sub', 'cowbell3', 'hat', 'cowbell1', 'kick', 'cowbell4', 'scratch', 'hat', 'cowbell2'] },
          murder:  { tempo: 105, label: '👻 Kordhell Murder Phonk', seq: ['bass808', 'cowbell3', 'hat', 'cowbell1', 'kick', 'cowbell2', 'hat', 'bass808', 'cowbell3', 'cowbell4', 'hat', 'kick', 'cowbell1', 'cowbell2', 'laser', 'hat'] },
          sigma:   { tempo: 112, label: '🗿 Sigma GigaChad Phonk', seq: ['bass808', 'hat', 'kick', 'cowbell1', 'bass808', 'cowbell2', 'hat', 'cowbell3', 'kick', 'hat', 'bass808', 'cowbell1', 'kick', 'cowbell2', 'cowbell4', 'hat'] },
          memphis: { tempo: 110, label: '👹 Montagem Dark Memphis', seq: ['batidao_sub', 'cowbell2', 'scratch', 'hat', 'kick', 'cowbell1', 'cowbell2', 'hat', 'batidao_sub', 'cowbell3', 'hat', 'kick', 'cowbell4', 'cowbell1', 'siren', 'hat'] },
          cyber:   { tempo: 98,  label: '🚀 Euphoric Hardstyle', seq: ['kick', 'revbass', 'lead2', 'revbass', 'kick', 'revbass', 'lead4', 'revbass', 'kick', 'revbass', 'lead3', 'lead4', 'kick', 'revbass', 'lead1', 'laser'] },
          tokyo:   { tempo: 104, label: '🏎️ Tokyo Drift Phonk', seq: ['cowbell3', 'hat', 'cowbell3', 'kick', 'cowbell1', 'hat', 'cowbell4', 'bass808', 'cowbell1', 'hat', 'cowbell3', 'kick', 'cowbell2', 'scratch', 'hat', 'cowbell1'] }
        };
        const chosen = proTracks[style] || proTracks.brazil;
        const idMap = { drift: 'loopDrift', brazil: 'loopBrazil', murder: 'loopMurder', sigma: 'loopSigma', memphis: 'loopMemphis', cyber: 'loopCyber', tokyo: 'loopTokyo', demon: 'loopDemon' };
        const btn = document.getElementById(idMap[style]);
        if (btn) btn.classList.add('active');
        const np = document.getElementById('djNowPlaying');
        if (np) np.textContent = '🔥 LIVE: ' + chosen.label + ' (Hit Minimize to chat!)';

        proStep = 0;
        proBeatTimer = _origSetInterval(() => {
          window.triggerDjSound(chosen.seq.at(proStep % chosen.seq.length));
          proStep++;
        }, chosen.tempo);
      };
     
      function upgradePhonkModalControls() {
        const bBrazil = document.getElementById('loopBrazil');
        const bDemon = document.getElementById('loopDemon');
        const bDrift = document.getElementById('loopDrift');
        const bCyber = document.getElementById('loopCyber');
        if (bBrazil) bBrazil.textContent = '🇧🇷 No Batidão';
        if (bDemon) bDemon.textContent = '🌌 Heavenly Jumpstyle';
        if (bDrift) bDrift.textContent = '🔥 Automotivo';
        if (bCyber) bCyber.textContent = '🚀 Euphoric Hardstyle';

        const card = document.getElementById('phonkDjCard');
        if (card && !document.getElementById('proFilterBar')) {
          const bar = document.createElement('div');
          bar.id = 'proFilterBar';
          bar.style.cssText = 'background:rgba(255,255,255,0.06);border:1px solid #c084fc;border-radius:12px;padding:7px;margin:6px 0;font-size:11px;';
          bar.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
              '<span>🎛️ Filter Sweep</span>' +
              '<button id="proBoostBtn" onclick="window._phonkBoost=!window._phonkBoost;this.textContent=window._phonkBoost?'🔊 808 BOOST: ON':'🔉 808 BOOST: OFF'" style="background:#f59e0b;border:none;color:#111;border-radius:8px;padding:3px 8px;font-weight:900;font-size:10px;cursor:pointer;">🔊 808 BOOST: ON</button>' +
            '</div>' +
            '<input type="range" min="350" max="16000" value="16000" oninput="window._phonkFilterFreq=Number(this.value);if(typeof proFilter!=='undefined'&&proFilter)proFilter.frequency.value=window._phonkFilterFreq;" style="width:100%;accent-color:#e879f9;">';
          const pads = card.querySelector('.dj-pads');
          if (pads) card.insertBefore(bar, pads);
        }
      }
      window.addEventListener('DOMContentLoaded', () => setTimeout(upgradePhonkModalControls, 1500));
    })();
} catch (e) { console.error('Widget PHONK_PRO_UPGRADE error:', e); }

// === MAFIA_UI ===
try {
(function() {
      window._mafiaActive = false;
      function injectMafiaHostBtn() {
        const targetBtn = Array.from(document.querySelectorAll('button')).find(b => /word imposter|hoop shootout/i.test(b.textContent || ''));
        if (targetBtn && targetBtn.parentElement && !document.getElementById('btnLaunchMafia')) {
          const btn = targetBtn.cloneNode(true);
          btn.id = 'btnLaunchMafia';
          btn.removeAttribute('onclick');
          btn.textContent = '26. 🔪 Mafia Party';
          btn.onclick = () => { if (typeof socket !== 'undefined') socket.emit('chatMessage', '!mafia'); };
          targetBtn.parentElement.appendChild(btn);
        }
      }
      setInterval(injectMafiaHostBtn, 2000);

      function bindMafia() {
        if (typeof socket === 'undefined' || window._mafiaBound) return;
        window._mafiaBound = true;
        socket.on('mafiaStart', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          window._mafiaActive = true;
          document.getElementById('reopenMafiaBtn').style.display = 'none';
          document.getElementById('mafiaModal').style.display = 'flex';
          const roleMsg = d.role === 'MAFIA' ? '🔪 MAFIA: Pick target to eliminate!'
            : d.role === 'DOCTOR' ? '🩺 DOCTOR: Pick 1 player to save!'
            : '😇 VILLAGER: Vote out the Mafia!';
          document.getElementById('mafiaRoleBox').textContent = roleMsg;
          const grid = document.getElementById('mafiaGrid'); grid.innerHTML = '';
          document.getElementById('mafiaStatus').textContent = 'Vote below!';
          d.players.forEach(p => {
            const b = document.createElement('button');
            b.style.cssText = 'background:#1e293b;border:1.5px solid #ef4444;color:#fff;padding:5px 9px;border-radius:10px;font-weight:bold;font-size:11px;cursor:pointer;';
            b.textContent = '🎯 ' + p.username;
            b.onclick = () => {
              socket.emit('mafiaAction', p.id);
              document.getElementById('mafiaStatus').textContent = '✅ Voted: ' + p.username;
              Array.from(grid.children).forEach(c => { c.disabled = true; c.style.opacity = '0.5'; });
              b.style.opacity = '1'; b.style.background = '#dc2626';
            };
            grid.appendChild(b);
          });
        });
        socket.on('mafiaEnd', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          window._mafiaActive = false;
          document.getElementById('mafiaModal').style.display = 'none';
          document.getElementById('reopenMafiaBtn').style.display = 'none';
        });
      }
      setInterval(bindMafia, 1200);
    })();
} catch (e) { console.error('Widget MAFIA_UI error:', e); }

// === ROYALE_UI ===
try {
(function() {
      function injectRoyaleHostBtn() {
        const targetBtn = Array.from(document.querySelectorAll('button')).find(b => /mafia party|word imposter|hoop shootout/i.test(b.textContent || ''));
        if (targetBtn && targetBtn.parentElement && !document.getElementById('btnLaunchRoyale')) {
          const btn = targetBtn.cloneNode(true);
          btn.id = 'btnLaunchRoyale';
          btn.removeAttribute('onclick');
          btn.textContent = '27. 💣 Bomb Royale';
          btn.onclick = () => { if (typeof socket !== 'undefined') socket.emit('chatMessage', '!royale'); };
          targetBtn.parentElement.appendChild(btn);
        }
      }
      setInterval(injectRoyaleHostBtn, 2000);

      function bindRoyale() {
        if (typeof socket === 'undefined' || window._royaleBound) return;
        window._royaleBound = true;
        socket.on('royaleTick', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('royaleBar').style.display = 'flex';
          document.getElementById('royaleAlive').textContent = 'Alive: ' + d.aliveCount + ' 👥';
          const isMe = (socket.id === d.holderId);
          document.getElementById('royaleHolderBox').innerHTML = isMe
            ? '😱 <span style="color:#fde047;">YOU HAVE THE BOMB!</span> PASS IT!'
            : '💣 Bomb is with: <span style="color:#fdba74;">' + d.holderName + '</span>';
          document.getElementById('royalePassBtn').style.display = isMe ? 'block' : 'none';
        });
        socket.on('royaleEnd', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('royaleBar').style.display = 'none';
        });
      }
      setInterval(bindRoyale, 1200);
    })();
} catch (e) { console.error('Widget ROYALE_UI error:', e); }

// === ZOMBIE_UI ===
try {
(function() {
      let lastHordeHp = null, lastWallHp = null, maxWaveHp = 1200;
      function spawnBattleFx(icon, shake) {
        const stage = document.getElementById('zbBattleStage'), card = document.getElementById('zbCard');
        if (!stage) return;
        const fx = document.createElement('span'); fx.className = 'zb-fx-fly'; fx.textContent = icon;
        stage.appendChild(fx); setTimeout(() => fx.remove(), 600);
        if (shake && card) { card.classList.remove('zb-hit-shake'); void card.offsetWidth; card.classList.add('zb-hit-shake'); }
      }
      function injectZombieHostBtn() {
        const targetBtn = Array.from(document.querySelectorAll('button')).find(b => /bomb royale|mafia party|word imposter/i.test(b.textContent || ''));
        if (targetBtn && targetBtn.parentElement && !document.getElementById('btnLaunchZombie')) {
          const btn = targetBtn.cloneNode(true); btn.id = 'btnLaunchZombie'; btn.removeAttribute('onclick');
          btn.textContent = '29. 🧟 Zombie Outbreak';
          btn.onclick = () => { if (typeof socket !== 'undefined') socket.emit('chatMessage', '!zombie'); };
          targetBtn.parentElement.appendChild(btn);
        }
      }
      setInterval(injectZombieHostBtn, 2000);
      function bindZombie() {
        if (typeof socket === 'undefined' || window._zombieBound) return;
        window._zombieBound = true;
        socket.on('zombieSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('zombieBar').style.display = 'flex';
          document.getElementById('zbWaveTitle').textContent = d.waveName;
          document.getElementById('zbTimer').textContent = '⏳ ' + d.timeLeft + 's';
          if (lastHordeHp === null || d.hordeHp > lastHordeHp) maxWaveHp = d.hordeHp;
          if (lastHordeHp !== null && d.hordeHp < lastHordeHp) spawnBattleFx('💥🔫', false);
          if (lastWallHp !== null && d.wallHp < lastWallHp) spawnBattleFx('🩸🧟', true);
          if (lastWallHp !== null && d.wallHp > lastWallHp) spawnBattleFx('✨🔨', false);
          lastHordeHp = d.hordeHp; lastWallHp = d.wallHp;
          const wallPct = Math.max(0, Math.min(100, d.wallHp));
          const bossPct = Math.max(0, Math.min(100, Math.round((d.hordeHp / (maxWaveHp || 1)) * 100)));
          document.getElementById('zbWallHp').textContent = wallPct + '%';
          document.getElementById('zbWallFill').style.width = wallPct + '%';
          document.getElementById('zbBossHp').textContent = Math.max(0, d.hordeHp);
          document.getElementById('zbBossFill').style.width = bossPct + '%';
          document.getElementById('zbCounts').textContent = d.humans + '😇/' + d.zombies + '🧟';
          document.getElementById('zbWallSprite').textContent = wallPct > 60 ? '🧱' : (wallPct > 25 ? '🪵' : '🔥');
          document.getElementById('zbHordeSprites').textContent = d.waveName.includes('ZOROMON') ? '👑🧟‍♂️⚔️' : (d.waveName.includes('Brutes') ? '🛡️🧟‍♂️' : '🧟‍♂️🧟‍♀️');
          document.getElementById('zbSquadSprites').textContent = d.humans > 2 ? '🔫💣🩺' : '🔫🔨';
          const banner = document.getElementById('zbRoleBanner'), box = document.getElementById('zbActions');
          box.innerHTML = '';
          if (d.isZombie) {
            banner.style.borderColor = '#ef4444'; banner.style.background = 'rgba(239,68,68,0.25)';
            banner.textContent = d.isPatientZero ? '🦠 SECRET INFECTED! Sabotage wall or bite humans!' : '🧟 YOU MUTATED INTO A ZOMBIE! Hunt humans!';
            if (d.acted) { box.innerHTML = '<span style="font-size:11px;color:#fca5a5;font-weight:bold;">✅ Zombie attack locked!</span>'; }
            else {
              const b1 = document.createElement('button');
              b1.style.cssText = 'background:#991b1b;border:1.5px solid #f87171;color:#fff;padding:6px 10px;border-radius:9px;font-weight:900;font-size:11px;cursor:pointer;';
              b1.textContent = '💥 Smash Wall (-22%)'; b1.onclick = () => socket.emit('zombieAct', { move: 'smash' });
              const b2 = document.createElement('button');
              b2.style.cssText = 'background:#6b21a8;border:1.5px solid #c084fc;color:#fff;padding:6px 10px;border-radius:9px;font-weight:900;font-size:11px;cursor:pointer;';
              b2.textContent = '🦷 Bite & Convert Human!'; b2.onclick = () => socket.emit('zombieAct', { move: 'bite' });
              box.appendChild(b1); box.appendChild(b2);
            }
          } else {
            banner.style.borderColor = '#4ade80'; banner.style.background = 'rgba(34,197,94,0.18)';
            banner.textContent = '😇 SURVIVOR (' + (d.myClass || 'Commando') + ') — Defend Safe Zone!';
            if (d.acted) { box.innerHTML = '<span style="font-size:11px;color:#86efac;font-weight:bold;">✅ Action locked! Coordinate in chat!</span>'; }
            else {
              const moves = [
                { id: 'shoot', label: '🔫 Shoot (-420)', bg: '#0369a1', cls: 'Commando' },
                { id: 'bomb', label: '💣 Grenade (-320 + Stun)', bg: '#b45309', cls: 'Grenadier' },
                { id: 'repair', label: '🔨 Repair Wall (+28%)', bg: '#15803d', cls: 'Engineer' },
                { id: 'heal', label: '🩺 Medic Boost (+20%)', bg: '#be185d', cls: 'Medic' }
              ];
              moves.forEach(m => {
                const btn = document.createElement('button');
                btn.style.cssText = 'background:' + m.bg + ';border:1px solid #fff;color:#fff;padding:5px 8px;border-radius:9px;font-weight:bold;font-size:10px;cursor:pointer;';
                btn.textContent = m.label; btn.onclick = () => socket.emit('zombieAct', { move: m.id, cls: m.cls });
                box.appendChild(btn);
              });
            }
          }
        });
        socket.on('zombieEnd', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          lastHordeHp = null; lastWallHp = null; document.getElementById('zombieBar').style.display = 'none';
        });
      }
      setInterval(bindZombie, 1200);
    })();
} catch (e) { console.error('Widget ZOMBIE_UI error:', e); }

// === COOP_PARTY_UI ===
try {
(function() {
      function injectCoopPartyBtns() {
        const targetBtn = Array.from(document.querySelectorAll('button')).find(b => /zombie outbreak|bomb royale|mafia party/i.test(b.textContent || ''));
        if (!targetBtn || !targetBtn.parentElement) return;
        if (!document.getElementById('btnLaunchRaid')) {
          const b1 = targetBtn.cloneNode(true);
          b1.id = 'btnLaunchRaid'; b1.removeAttribute('onclick');
          b1.textContent = '30. 🐉 Dragon Raid';
          b1.onclick = () => { if (typeof socket !== 'undefined') socket.emit('chatMessage', '!boss'); };
          targetBtn.parentElement.appendChild(b1);
        }
        if (!document.getElementById('btnLaunchHeist')) {
          const b2 = targetBtn.cloneNode(true);
          b2.id = 'btnLaunchHeist'; b2.removeAttribute('onclick');
          b2.textContent = '31. 🏦 Bank Heist';
          b2.onclick = () => { if (typeof socket !== 'undefined') socket.emit('chatMessage', '!heist'); };
          targetBtn.parentElement.appendChild(b2);
        }
      }
      setInterval(injectCoopPartyBtns, 2200);

      function bindCoopGames() {
        if (typeof socket === 'undefined' || window._coopGamesBound) return;
        window._coopGamesBound = true;

        socket.on('raidSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('raidBar').style.display = 'flex';
          document.getElementById('raidTimer').textContent = '⏳ ' + d.timeLeft + 's';
          document.getElementById('raidTeamHp').textContent = d.teamHp + '%';
          document.getElementById('raidTeamFill').style.width = Math.max(0, d.teamHp) + '%';
          document.getElementById('raidBossHp').textContent = d.bossHp;
          document.getElementById('raidBossFill').style.width = Math.max(0, Math.round((d.bossHp / d.maxBossHp) * 100)) + '%';

          const box = document.getElementById('raidActions');
          box.innerHTML = '';
          if (d.acted) {
            box.innerHTML = '<span style="font-size:11px;color:#e879f9;font-weight:bold;">✅ Move locked! Waiting for squad...</span>';
          } else {
            const moves = [
              { id: 'slash', label: '⚔️ Slash (-350)', bg: '#b91c1c' },
              { id: 'fireball', label: '🔥 Meteor (-500 / Risk)', bg: '#7e22ce' },
              { id: 'shield', label: '🛡️ Group Shield', bg: '#0369a1' },
              { id: 'heal', label: '💖 Squad Heal (+22%)', bg: '#15803d' }
            ];
            moves.forEach(m => {
              const btn = document.createElement('button');
              btn.style.cssText = 'background:' + m.bg + ';border:1px solid #fff;color:#fff;padding:5px 8px;border-radius:9px;font-weight:bold;font-size:10px;cursor:pointer;';
              btn.textContent = m.label;
              btn.onclick = () => socket.emit('raidAct', m.id);
              box.appendChild(btn);
            });
          }
        });
        socket.on('raidEnd', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('raidBar').style.display = 'none';
        });

        socket.on('heistSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('heistBar').style.display = 'flex';
          document.getElementById('heistRound').textContent = '🏦 MEGA BANK HEIST (' + d.round + '/4)';
          document.getElementById('heistTimer').textContent = '⏳ ' + d.timeLeft + 's';
          document.getElementById('heistLoot').textContent = '$' + d.loot.toLocaleString();
          document.getElementById('heistHeat').textContent = d.heat + '%';

          const box = document.getElementById('heistActions');
          box.innerHTML = '';
          if (d.acted) {
            box.innerHTML = '<span style="font-size:11px;color:#fde047;font-weight:bold;">✅ Choice locked!</span>';
          } else {
            const moves = [
              { id: 'drill', label: '🔨 Drill Vault (+$25k)', bg: '#047857' },
              { id: 'guard', label: '🚓 Jam Cops (-20% Heat)', bg: '#1d4ed8' },
              { id: 'greed', label: '💰 Secret Pocket (+$40k / +Heat)', bg: '#b45309' }
            ];
            moves.forEach(m => {
              const btn = document.createElement('button');
              btn.style.cssText = 'background:' + m.bg + ';border:1px solid #fff;color:#fff;padding:5px 8px;border-radius:9px;font-weight:bold;font-size:10px;cursor:pointer;';
              btn.textContent = m.label;
              btn.onclick = () => socket.emit('heistAct', m.id);
              box.appendChild(btn);
            });
          }
        });
        socket.on('heistEnd', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('heistBar').style.display = 'none';
        });
      }
      setInterval(bindCoopGames, 1200);
    })();
} catch (e) { console.error('Widget COOP_PARTY_UI error:', e); }

// === BLUFF_UI ===
try {
(function() {
      function injectBluffBtn() {
        const targetBtn = Array.from(document.querySelectorAll('button')).find(b => /bank heist|dragon raid|zombie outbreak/i.test(b.textContent || ''));
        if (targetBtn && targetBtn.parentElement && !document.getElementById('btnLaunchBluff')) {
          const btn = targetBtn.cloneNode(true);
          btn.id = 'btnLaunchBluff'; btn.removeAttribute('onclick');
          btn.textContent = '32. 🎭 Bluff Master';
          btn.onclick = () => { if (typeof socket !== 'undefined') socket.emit('chatMessage', '!bluff'); };
          targetBtn.parentElement.appendChild(btn);
        }
      }
      setInterval(injectBluffBtn, 2200);

      function bindBluff() {
        if (typeof socket === 'undefined' || window._bluffBound) return;
        window._bluffBound = true;
        socket.on('bluffSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('bluffBar').style.display = 'flex';
          document.getElementById('bluffTimer').textContent = '⏳ ' + d.timeLeft + 's';
          document.getElementById('bluffPromptBox').textContent = d.prompt;
          const sub = document.getElementById('bluffSubBox');
          const grid = document.getElementById('bluffVoteGrid');
          grid.innerHTML = '';

          if (d.phase === 'write') {
            sub.innerHTML = d.submitted
              ? '<span style="color:#4ade80;font-weight:bold;">✅ Answer locked secretly! Waiting for others...</span>'
              : '✍️ <b>Type your answer in chat!</b> (Hidden from chat so nobody knows it is yours!)';
          } else {
            sub.innerHTML = '🗳️ <b>Tap the funniest answer!</b> (You can't vote for yourself)';
            d.entries.forEach((ent, idx) => {
              const btn = document.createElement('button');
              const isMine = (ent.authorId === socket.id);
              btn.disabled = isMine || d.voted;
              btn.style.cssText = 'background:' + (isMine ? '#334155' : '#1e1b4b') + ';border:1.5px solid #f472b6;color:#fff;padding:6px 8px;border-radius:9px;font-size:11px;font-weight:bold;cursor:pointer;text-align:left;';
              btn.textContent = (idx + 1) + '. "' + ent.text + '"' + (isMine ? ' (Yours)' : '');
              btn.onclick = () => socket.emit('bluffVote', ent.authorId);
              grid.appendChild(btn);
            });
          }
        });
        socket.on('bluffEnd', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('bluffBar').style.display = 'none';
        });
      }
      setInterval(bindBluff, 1200);
    })();
} catch (e) { console.error('Widget BLUFF_UI error:', e); }

// === ISLAND_UI ===
try {
(function() {
      function injectIslandBtn() {
        const targetBtn = Array.from(document.querySelectorAll('button')).find(b => /bluff master|bank heist|zombie outbreak/i.test(b.textContent || ''));
        if (targetBtn && targetBtn.parentElement && !document.getElementById('btnLaunchIsland')) {
          const btn = targetBtn.cloneNode(true);
          btn.id = 'btnLaunchIsland'; btn.removeAttribute('onclick');
          btn.textContent = '33. 🏝️ Castaway Island';
          btn.onclick = () => { if (typeof socket !== 'undefined') socket.emit('chatMessage', '!island'); };
          targetBtn.parentElement.appendChild(btn);
        }
      }
      setInterval(injectIslandBtn, 2200);

      function bindIsland() {
        if (typeof socket === 'undefined' || window._islandBound) return;
        window._islandBound = true;
        socket.on('islandSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('islandBar').style.display = 'flex';
          document.getElementById('islDay').textContent = '🏝️ CASTAWAY ISLAND (DAY ' + d.day + '/4)';
          document.getElementById('islTimer').textContent = '⏳ ' + d.timeLeft + 's';
          document.getElementById('islFood').textContent = d.food + '%';
          document.getElementById('islFire').textContent = d.fire + '%';
          const box = document.getElementById('islActions');
          box.innerHTML = '';
          if (d.acted) {
            box.innerHTML = '<span style="font-size:11px;color:#6ee7b7;font-weight:bold;">✅ Choice locked! Discuss in chat!</span>';
          } else {
            const moves = [
              { id: 'forage', label: '🥥 Gather Food (+22%)', bg: '#15803d' },
              { id: 'fire', label: '🪵 Stoke Fire (+22%)', bg: '#c2410c' },
              { id: 'steal', label: '🐍 Hoard Rations (Greed)', bg: '#7e22ce' }
            ];
            moves.forEach(m => {
              const btn = document.createElement('button');
              btn.style.cssText = 'background:' + m.bg + ';border:1px solid #fff;color:#fff;padding:5px 8px;border-radius:9px;font-weight:bold;font-size:10px;cursor:pointer;';
              btn.textContent = m.label;
              btn.onclick = () => socket.emit('islandAct', m.id);
              box.appendChild(btn);
            });
          }
        });
        socket.on('islandEnd', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('islandBar').style.display = 'none';
        });
      }
      setInterval(bindIsland, 1200);
    })();
} catch (e) { console.error('Widget ISLAND_UI error:', e); }

// === PARTY_ALL_IN_ONE_UI ===
try {
(function() {
      function injectAllFourButtons() {
        const anchor = Array.from(document.querySelectorAll('button')).find(b => /hoop shootout|word imposter/i.test(b.textContent || ''));
        if (!anchor || !anchor.parentElement) return;
        const parent = anchor.parentElement;

        const oldIsl = document.getElementById('btnLaunchIsland');
        if (oldIsl) oldIsl.remove();

        const games = [
          { id: 'cBtn30', label: '30. 🐉 Dragon Raid', cmd: '!boss' },
          { id: 'cBtn31', label: '31. 🏦 Bank Heist', cmd: '!heist' },
          { id: 'cBtn32', label: '32. 🎭 Bluff Master', cmd: '!bluff' },
          { id: 'cBtn33', label: '33. 🏝️ Castaway Island', cmd: '!island' }
        ];

        games.forEach(g => {
          if (!document.getElementById(g.id)) {
            const btn = anchor.cloneNode(true);
            btn.id = g.id;
            btn.removeAttribute('onclick');
            btn.textContent = g.label;
            btn.onclick = function() {
              if (typeof socket !== 'undefined') socket.emit('chatMessage', g.cmd);
            };
            parent.appendChild(btn);
          }
        });
      }
      setInterval(injectAllFourButtons, 1500);

      function bindCleanPartySockets() {
        if (typeof socket === 'undefined' || window._cleanPartyBound) return;
        window._cleanPartyBound = true;

        socket.on('raidSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('cleanRaidBar').style.display = 'flex';
          document.getElementById('cRaidTimer').textContent = '⏳ ' + d.timeLeft + 's';
          document.getElementById('cRaidTeamHp').textContent = d.teamHp + '%';
          document.getElementById('cRaidBossHp').textContent = d.bossHp;
          const box = document.getElementById('cRaidActions');
          box.innerHTML = '';
          if (d.acted) {
            box.innerHTML = '<span style="font-size:11px;color:#e879f9;font-weight:bold;">✅ Move locked!</span>';
          } else {
            [
              { id: 'slash', label: '⚔️ Slash (-350)', bg: '#b91c1c' },
              { id: 'fireball', label: '🔥 Meteor (-500)', bg: '#7e22ce' },
              { id: 'shield', label: '🛡️ Shield', bg: '#0369a1' },
              { id: 'heal', label: '💖 Heal (+22%)', bg: '#15803d' }
            ].forEach(m => {
              const b = document.createElement('button');
              b.style.cssText = 'background:' + m.bg + ';border:1px solid #fff;color:#fff;padding:5px 8px;border-radius:9px;font-weight:bold;font-size:10px;cursor:pointer;';
              b.textContent = m.label;
              b.onclick = () => socket.emit('raidAct', m.id);
              box.appendChild(b);
            });
          }
        });
        socket.on('raidEnd', () => { document.getElementById('cleanRaidBar').style.display = 'none'; });

        socket.on('heistSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('cleanHeistBar').style.display = 'flex';
          document.getElementById('cHeistRound').textContent = '🏦 MEGA BANK HEIST (' + d.round + '/4)';
          document.getElementById('cHeistTimer').textContent = '⏳ ' + d.timeLeft + 's';
          document.getElementById('cHeistLoot').textContent = '$' + d.loot.toLocaleString();
          document.getElementById('cHeistHeat').textContent = d.heat + '%';
          const box = document.getElementById('cHeistActions');
          box.innerHTML = '';
          if (d.acted) {
            box.innerHTML = '<span style="font-size:11px;color:#fde047;font-weight:bold;">✅ Choice locked!</span>';
          } else {
            [
              { id: 'drill', label: '🔨 Drill (+$25k)', bg: '#047857' },
              { id: 'guard', label: '🚓 Jam Cops (-20%)', bg: '#1d4ed8' },
              { id: 'greed', label: '💰 Pocket (+$40k)', bg: '#b45309' }
            ].forEach(m => {
              const b = document.createElement('button');
              b.style.cssText = 'background:' + m.bg + ';border:1px solid #fff;color:#fff;padding:5px 8px;border-radius:9px;font-weight:bold;font-size:10px;cursor:pointer;';
              b.textContent = m.label;
              b.onclick = () => socket.emit('heistAct', m.id);
              box.appendChild(b);
            });
          }
        });
        socket.on('heistEnd', () => { document.getElementById('cleanHeistBar').style.display = 'none'; });

        socket.on('bluffSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('cleanBluffBar').style.display = 'flex';
          document.getElementById('cBluffTimer').textContent = '⏳ ' + d.timeLeft + 's';
          document.getElementById('cBluffPrompt').textContent = d.prompt;
          const sub = document.getElementById('cBluffSub');
          const grid = document.getElementById('cBluffGrid');
          grid.innerHTML = '';
          if (d.phase === 'write') {
            sub.innerHTML = d.submitted
              ? '<span style="color:#4ade80;font-weight:bold;">✅ Secret answer locked! Waiting for others...</span>'
              : '✍️ <b>Type your answer in normal chat!</b> (Hidden until voting)';
          } else {
            sub.innerHTML = '🗳️ <b>Tap the funniest answer!</b>';
            d.entries.forEach((ent, idx) => {
              const btn = document.createElement('button');
              const isMine = (ent.authorId === socket.id);
              btn.disabled = isMine || d.voted;
              btn.style.cssText = 'background:' + (isMine ? '#334155' : '#1e1b4b') + ';border:1.5px solid #f472b6;color:#fff;padding:6px 8px;border-radius:9px;font-size:11px;font-weight:bold;cursor:pointer;text-align:left;';
              btn.textContent = (idx + 1) + '. "' + ent.text + '"' + (isMine ? ' (Yours)' : '');
              btn.onclick = () => socket.emit('bluffVote', ent.authorId);
              grid.appendChild(btn);
            });
          }
        });
        socket.on('bluffEnd', () => { document.getElementById('cleanBluffBar').style.display = 'none'; });

        socket.on('islandSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('cleanIslandBar').style.display = 'flex';
          document.getElementById('cIslDay').textContent = '🏝️ CASTAWAY ISLAND (DAY ' + d.day + '/4)';
          document.getElementById('cIslTimer').textContent = '⏳ ' + d.timeLeft + 's';
          document.getElementById('cIslFood').textContent = d.food + '%';
          document.getElementById('cIslFire').textContent = d.fire + '%';
          const box = document.getElementById('cIslActions');
          box.innerHTML = '';
          if (d.acted) {
            box.innerHTML = '<span style="font-size:11px;color:#6ee7b7;font-weight:bold;">✅ Choice locked!</span>';
          } else {
            [
              { id: 'forage', label: '🥥 Gather Food (+22%)', bg: '#15803d' },
              { id: 'fire', label: '🪵 Stoke Fire (+22%)', bg: '#c2410c' },
              { id: 'steal', label: '🐍 Hoard Rations', bg: '#7e22ce' }
            ].forEach(m => {
              const b = document.createElement('button');
              b.style.cssText = 'background:' + m.bg + ';border:1px solid #fff;color:#fff;padding:5px 8px;border-radius:9px;font-weight:bold;font-size:10px;cursor:pointer;';
              b.textContent = m.label;
              b.onclick = () => socket.emit('islandAct', m.id);
              box.appendChild(b);
            });
          }
        });
        socket.on('islandEnd', () => { document.getElementById('cleanIslandBar').style.display = 'none'; });
      }
      setInterval(bindCleanPartySockets, 1200);
    })();
} catch (e) { console.error('Widget PARTY_ALL_IN_ONE_UI error:', e); }

// === SOCKET_UI_BOOT ===
try {
(function() {
      function bootSocketPartyUI() {
        if (typeof socket === 'undefined' || window._partyBooted) return;
        window._partyBooted = true;

        socket.on('injectPartyBundle', (html) => {
          if (!document.getElementById('cleanRaidBar')) {
            const wrap = document.createElement('div');
            wrap.innerHTML = html;
            document.body.appendChild(wrap);
          }
          const anchor = Array.from(document.querySelectorAll('button')).find(b => /hoop shootout|word imposter|zombie outbreak/i.test(b.textContent || ''));
          if (anchor && anchor.parentElement) {
            const oldIsl = document.getElementById('btnLaunchIsland');
            if (oldIsl) oldIsl.remove();
            [
              { id: 'cBtn30', label: '30. 🐉 Dragon Raid', cmd: '!boss' },
              { id: 'cBtn31', label: '31. 🏦 Bank Heist', cmd: '!heist' },
              { id: 'cBtn32', label: '32. 🎭 Bluff Master', cmd: '!bluff' },
              { id: 'cBtn33', label: '33. 🏝️ Castaway Island', cmd: '!island' }
            ].forEach(g => {
              if (!document.getElementById(g.id)) {
                const btn = anchor.cloneNode(true);
                btn.id = g.id; btn.removeAttribute('onclick'); btn.textContent = g.label;
                btn.onclick = () => socket.emit('chatMessage', g.cmd);
                anchor.parentElement.appendChild(btn);
              }
            });
          }
        });

        socket.on('raidSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('cleanRaidBar').style.display = 'flex';
          document.getElementById('cRaidTimer').textContent = '⏳ ' + d.timeLeft + 's';
          document.getElementById('cRaidTeamHp').textContent = d.teamHp + '%';
          document.getElementById('cRaidBossHp').textContent = d.bossHp;
          const box = document.getElementById('cRaidActions'); box.innerHTML = '';
          if (d.acted) { box.innerHTML = '<span style="font-size:11px;color:#e879f9;font-weight:bold;">✅ Move locked!</span>'; return; }
          [
            { id: 'slash', label: '⚔️ Slash (-350)', bg: '#b91c1c' },
            { id: 'fireball', label: '🔥 Meteor (-500)', bg: '#7e22ce' },
            { id: 'shield', label: '🛡️ Shield', bg: '#0369a1' },
            { id: 'heal', label: '💖 Heal (+22%)', bg: '#15803d' }
          ].forEach(m => {
            const b = document.createElement('button');
            b.style.cssText = 'background:' + m.bg + ';border:1px solid #fff;color:#fff;padding:5px 8px;border-radius:9px;font-weight:bold;font-size:10px;cursor:pointer;';
            b.textContent = m.label; b.onclick = () => socket.emit('raidAct', m.id); box.appendChild(b);
          });
        });
        socket.on('raidEnd', () => { const el = document.getElementById('cleanRaidBar'); if (el) el.style.display = 'none'; });

        socket.on('heistSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('cleanHeistBar').style.display = 'flex';
          document.getElementById('cHeistRound').textContent = '🏦 MEGA BANK HEIST (' + d.round + '/4)';
          document.getElementById('cHeistTimer').textContent = '⏳ ' + d.timeLeft + 's';
          document.getElementById('cHeistLoot').textContent = '$' + d.loot.toLocaleString();
          document.getElementById('cHeistHeat').textContent = d.heat + '%';
          const box = document.getElementById('cHeistActions'); box.innerHTML = '';
          if (d.acted) { box.innerHTML = '<span style="font-size:11px;color:#fde047;font-weight:bold;">✅ Choice locked!</span>'; return; }
          [
            { id: 'drill', label: '🔨 Drill (+$25k)', bg: '#047857' },
            { id: 'guard', label: '🚓 Jam Cops (-20%)', bg: '#1d4ed8' },
            { id: 'greed', label: '💰 Pocket (+$40k)', bg: '#b45309' }
          ].forEach(m => {
            const b = document.createElement('button');
            b.style.cssText = 'background:' + m.bg + ';border:1px solid #fff;color:#fff;padding:5px 8px;border-radius:9px;font-weight:bold;font-size:10px;cursor:pointer;';
            b.textContent = m.label; b.onclick = () => socket.emit('heistAct', m.id); box.appendChild(b);
          });
        });
        socket.on('heistEnd', () => { const el = document.getElementById('cleanHeistBar'); if (el) el.style.display = 'none'; });

        socket.on('bluffSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('cleanBluffBar').style.display = 'flex';
          document.getElementById('cBluffTimer').textContent = '⏳ ' + d.timeLeft + 's';
          document.getElementById('cBluffPrompt').textContent = d.prompt;
          const sub = document.getElementById('cBluffSub'), grid = document.getElementById('cBluffGrid'); grid.innerHTML = '';
          if (d.phase === 'write') {
            sub.innerHTML = d.submitted ? '<span style="color:#4ade80;font-weight:bold;">✅ Answer locked secretly!</span>' : '✍️ <b>Type your answer in chat now!</b>';
          } else {
            sub.innerHTML = '🗳️ <b>Tap the funniest answer!</b>';
            d.entries.forEach((ent, idx) => {
              const btn = document.createElement('button');
              const isMine = (ent.authorId === socket.id);
              btn.disabled = isMine || d.voted;
              btn.style.cssText = 'background:' + (isMine ? '#334155' : '#1e1b4b') + ';border:1.5px solid #f472b6;color:#fff;padding:6px 8px;border-radius:9px;font-size:11px;font-weight:bold;cursor:pointer;text-align:left;';
              btn.textContent = (idx + 1) + '. "' + ent.text + '"' + (isMine ? ' (Yours)' : '');
              btn.onclick = () => socket.emit('bluffVote', ent.authorId);
              grid.appendChild(btn);
            });
          }
        });
        socket.on('bluffEnd', () => { const el = document.getElementById('cleanBluffBar'); if (el) el.style.display = 'none'; });

        socket.on('islandSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('cleanIslandBar').style.display = 'flex';
          document.getElementById('cIslDay').textContent = '🏝️ CASTAWAY ISLAND (DAY ' + d.day + '/4)';
          document.getElementById('cIslTimer').textContent = '⏳ ' + d.timeLeft + 's';
          document.getElementById('cIslFood').textContent = d.food + '%';
          document.getElementById('cIslFire').textContent = d.fire + '%';
          const box = document.getElementById('cIslActions'); box.innerHTML = '';
          if (d.acted) { box.innerHTML = '<span style="font-size:11px;color:#6ee7b7;font-weight:bold;">✅ Choice locked!</span>'; return; }
          [
            { id: 'forage', label: '🥥 Gather Food (+22%)', bg: '#15803d' },
            { id: 'fire', label: '🪵 Stoke Fire (+22%)', bg: '#c2410c' },
            { id: 'steal', label: '🐍 Hoard Rations', bg: '#7e22ce' }
          ].forEach(m => {
            const b = document.createElement('button');
            b.style.cssText = 'background:' + m.bg + ';border:1px solid #fff;color:#fff;padding:5px 8px;border-radius:9px;font-weight:bold;font-size:10px;cursor:pointer;';
            b.textContent = m.label; b.onclick = () => socket.emit('islandAct', m.id); box.appendChild(b);
          });
        });
        socket.on('islandEnd', () => { const el = document.getElementById('cleanIslandBar'); if (el) el.style.display = 'none'; });
      }
      window.addEventListener('DOMContentLoaded', () => { bootSocketPartyUI(); setTimeout(bootSocketPartyUI, 800); });
    })();
} catch (e) { console.error('Widget SOCKET_UI_BOOT error:', e); }

// === SERVER_WP_PACK ===
try {
(function() {
      const WP_CLASSES = ['wp-pokemon','wp-cute-babies','wp-royal-queen','wp-cyber-aurora','wp-golden-empire','wp-emerald-matrix','wp-crimson-dragon','wp-diamond-frost'];
      const MAP = {
        srv_antim:   { cls: 'wp-pokemon',        label: '⚡ Pokémon Arena WP' },
        srv_shubhi:  { cls: 'wp-cute-babies',    label: '🍼 Cute Babies Pastel WP' },
        srv_sus:     { cls: 'wp-royal-queen',    label: '👑 Royal Queen & Princess WP' },
        srv_samaksh: { cls: 'wp-diamond-frost',  label: '💎 Diamond Frost WP' },
        srv_advait:  { cls: 'wp-diamond-frost',  label: '⚡ Lightning Citadel WP' },
        srv_zoro:    { cls: 'wp-emerald-matrix', label: '⚔️ Dojo Emerald WP' },
        srv_milly:   { cls: 'wp-golden-empire',  label: '👑 Royal Gold Palace WP' },
        srv_ishika:  { cls: 'wp-golden-empire',  label: '✨ Golden Lounge WP' },
        srv_ruwii:   { cls: 'wp-golden-empire',  label: '🌺 Sunset Garden WP' },
        srv_sid:     { cls: 'wp-golden-empire',  label: '🦁 Lion Kingdom WP' },
        srv_moon:    { cls: 'wp-cyber-aurora',   label: '🌙 Cosmic Galaxy WP' },
        srv_sarah:   { cls: 'wp-cyber-aurora',   label: '🦋 Butterfly Aurora WP' },
        srv_zaira:   { cls: 'wp-cyber-aurora',   label: '🪐 Nebula Orbit WP' },
        srv_heer:    { cls: 'wp-crimson-dragon', label: '🌸 Cherry Crimson WP' },
        srv_izzan:   { cls: 'wp-crimson-dragon', label: '🔥 Infernal Fortress WP' }
      };
      let wpOn = false;
      function setSrvWp(on) {
        if (typeof on === 'boolean') wpOn = on;
        WP_CLASSES.forEach(c => document.body.classList.remove(c));
        const badge = document.getElementById('wpFloatingBadge');
        if (!wpOn) { if (badge) badge.style.display = 'none'; return; }
        const cfg = MAP[window.selectedServerId] || { cls: 'wp-cyber-aurora', label: '🌌 Cosmic Aurora WP' };
        document.body.classList.add(cfg.cls);
        if (badge) { badge.textContent = cfg.label; badge.style.display = 'block'; }
      }
      setInterval(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => /🌌s*wp|wp/i.test(b.textContent || ''));
        if (btn && !btn.dataset.srvWp) {
          btn.dataset.srvWp = '1';
          btn.addEventListener('click', () => setSrvWp(!wpOn));
        }
      }, 2500);
      window.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
          if (typeof socket !== 'undefined') socket.on('serverAccessGranted', (s) => { window.selectedServerId = s.id; setSrvWp(true); });
        }, 800);
      });
    })();
} catch (e) { console.error('Widget SERVER_WP_PACK error:', e); }

// === GACHA_FLEX_SCRIPT ===
try {
(function() {
      const waitGacha = setInterval(() => {
        if (typeof socket === 'undefined') return;
        clearInterval(waitGacha);
        socket.on('renderFlexCard', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          if (d.ownerSocket !== socket.id) return;
          const c = document.createElement('canvas');
          c.width = 300; c.height = 175;
          const ctx = c.getContext('2d');
          const g = ctx.createLinearGradient(0, 0, 300, 175);
          g.addColorStop(0, d.card.c1); g.addColorStop(1, d.card.c2);
          ctx.fillStyle = g; ctx.fillRect(0, 0, 300, 175);
          ctx.strokeStyle = d.card.tier === 'MYTHIC' ? '#fde047' : '#38bdf8';
          ctx.lineWidth = 5; ctx.strokeRect(4, 4, 292, 167);
          ctx.fillStyle = '#fde047'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('★ ' + d.card.tier + ' TRADING CARD ★', 150, 24);
          ctx.font = '42px serif'; ctx.fillText(d.card.emoji, 150, 74);
          ctx.fillStyle = '#ffffff'; ctx.font = '900 16px sans-serif';
          ctx.fillText(d.card.name, 150, 114);
          ctx.fillStyle = '#67e8f9'; ctx.font = 'bold 13px sans-serif';
          ctx.fillText('POWER: ' + d.card.power + '  |  OWNER: ' + d.ownerName.toUpperCase(), 150, 144);
          socket.emit('postArenaMeme', { image: c.toDataURL('image/jpeg', 0.85) });
        });
      }, 600);
    })();
} catch (e) { console.error('Widget GACHA_FLEX_SCRIPT error:', e); }

// === COURT_UI ===
try {
(function() {
      function injectCourtBtn() {
        const anchor = Array.from(document.querySelectorAll('button')).find(b => /castaway island|bluff master|bank heist|hoop shootout/i.test(b.textContent || ''));
        if (anchor && anchor.parentElement && !document.getElementById('btnLaunchCourt35')) {
          const btn = anchor.cloneNode(true);
          btn.id = 'btnLaunchCourt35';
          btn.removeAttribute('onclick');
          btn.textContent = '35. ⚖️ Courtroom Chaos';
          btn.onclick = () => { if (typeof socket !== 'undefined') socket.emit('chatMessage', '!court'); };
          anchor.parentElement.appendChild(btn);
        }
      }
      setInterval(injectCourtBtn, 1800);

      function bindCourt() {
        if (typeof socket === 'undefined' || window._courtBound) return;
        window._courtBound = true;

        socket.on('courtSync', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('courtBar').style.display = 'flex';
          document.getElementById('courtTimer').textContent = (d.phase === 'debate' ? '🗣️ ' : '🗳️ ') + d.timeLeft + 's';
          document.getElementById('courtMatchup').innerHTML = '😈 <span style="color:#f87171;">' + d.accusedName + '</span> vs 🕵️ <span style="color:#38bdf8;">' + d.prosecutorName + '</span> | 👨‍⚖️ ' + d.judgeName;
          document.getElementById('courtCharge').textContent = '📜 CHARGE: ' + d.charge;

          const box = document.getElementById('courtControls');
          box.innerHTML = '';

          if (d.myRole === 'JUDGE') {
            if (d.phase === 'debate') {
              [
                { act: 'gavel', label: '🔨 ORDER! (+10s)', bg: '#b45309' },
                { act: 'objection', label: '🚨 OBJECTION! (-30🪙)', bg: '#dc2626' },
                { act: 'voteNow', label: '⚖️ Open Jury Vote', bg: '#15803d' }
              ].forEach(c => {
                const b = document.createElement('button');
                b.style.cssText = 'background:' + c.bg + ';border:1px solid #fff;color:#fff;padding:5px 8px;border-radius:8px;font-weight:900;font-size:10px;cursor:pointer;';
                b.textContent = c.label;
                b.onclick = () => socket.emit('judgeAction', c.act);
                box.appendChild(b);
              });
            } else {
              box.innerHTML = '<span style="font-size:11px;color:#fde047;font-weight:bold;">👨‍⚖️ Jury is voting (' + d.voteCount + ' votes cast)...</span>';
            }
          } else if (d.phase === 'debate') {
            if (d.myRole === 'ACCUSED') {
              box.innerHTML = '<span style="font-size:11px;color:#fca5a5;font-weight:bold;">😈 DEFEND YOURSELF IN CHAT NOW! Prove you are innocent!</span>';
            } else if (d.myRole === 'PROSECUTOR') {
              box.innerHTML = '<span style="font-size:11px;color:#7dd3fc;font-weight:bold;">🕵️ ROAST & EXPOSE THEM IN CHAT! Convince the Jury!</span>';
            } else {
              box.innerHTML = '<span style="font-size:11px;color:#cbd5e1;">👥 You are the JURY! Listen to both sides in chat before voting!</span>';
            }
          } else {
            if (d.myRole === 'ACCUSED' || d.myRole === 'PROSECUTOR') {
              box.innerHTML = '<span style="font-size:11px;color:#fde047;font-weight:bold;">⏳ Jury is deciding your fate...</span>';
            } else if (d.voted) {
              box.innerHTML = '<span style="font-size:11px;color:#4ade80;font-weight:bold;">✅ Verdict cast! Waiting for final count...</span>';
            } else {
              const bInn = document.createElement('button');
              bInn.style.cssText = 'background:#16a34a;border:1.5px solid #fff;color:#fff;padding:6px 12px;border-radius:9px;font-weight:900;font-size:11px;cursor:pointer;';
              bInn.textContent = '😇 INNOCENT';
              bInn.onclick = () => socket.emit('courtVote', 'INNOCENT');

              const bGui = document.createElement('button');
              bGui.style.cssText = 'background:#dc2626;border:1.5px solid #fff;color:#fff;padding:6px 12px;border-radius:9px;font-weight:900;font-size:11px;cursor:pointer;';
              bGui.textContent = '😈 GUILTY';
              bGui.onclick = () => socket.emit('courtVote', 'GUILTY');

              box.appendChild(bInn);
              box.appendChild(bGui);
            }
          }
        });

        socket.on('courtEnd', (d) => {
          if (d._serverId && d._serverId !== window.selectedServerId) return;
          document.getElementById('courtBar').style.display = 'none';
        });
      }
      setInterval(bindCourt, 1200);
    })();
} catch (e) { console.error('Widget COURT_UI error:', e); }

// === SV_PAGE_BOOT_TAG ===
try {
(function() {
      if (window._svBootLoaded) return;
      window._svBootLoaded = true;

      function initSvBoot() {
        if (typeof socket === 'undefined' || window._svBootSocketHooked) return;
        window._svBootSocketHooked = true;

        socket.on('svDeliverCleanV4', (bundle) => {
          if (bundle && bundle.html && !document.getElementById('svModal')) {
            const wrap = document.createElement('div');
            wrap.innerHTML = bundle.html;
            document.body.appendChild(wrap);
          }
          if (bundle && bundle.js && !window._svV4JsExecuted) {
            window._svV4JsExecuted = true;
            try {
              (new Function(bundle.js))();
            } catch (e) {
              console.error('SammuVerse V4 Boot Error:', e);
            }
          }
          ensureSvArenaBtn();
        });

        function triggerOpenSv() {
          if (typeof window.openSammuVerseModal === 'function') {
            window.openSammuVerseModal();
          } else {
            socket.emit('svRequestCleanV4');
            setTimeout(() => {
              if (typeof window.openSammuVerseModal === 'function') window.openSammuVerseModal();
            }, 350);
          }
        }

        function ensureSvArenaBtn() {
          const existingBanner = Array.from(document.querySelectorAll('div, button, a')).find(el =>
            el.children.length <= 2 && /sammuverse/i.test(el.textContent || '') && el.id !== 'svMainArenaBtn' && !el.closest('#svModal')
          );
          if (existingBanner) {
            if (!existingBanner.dataset.svV4Hooked) {
              existingBanner.dataset.svV4Hooked = '1';
              existingBanner.style.cursor = 'pointer';
              existingBanner.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                triggerOpenSv();
              };
            }
            const dup = document.getElementById('svMainArenaBtn');
            if (dup) dup.remove();
            return;
          }

          if (document.getElementById('svMainArenaBtn')) return;
          const anchor = Array.from(document.querySelectorAll('button')).find(b => /phonk dj|draw pad|disco mode/i.test(b.textContent || ''));
          if (anchor && anchor.parentElement) {
            const btn = anchor.cloneNode(true);
            btn.id = 'svMainArenaBtn';
            btn.removeAttribute('onclick');
            btn.textContent = '⚔️ SammuVerse';
            btn.style.background = 'linear-gradient(90deg, #9333ea, #ec4899)';
            btn.onclick = triggerOpenSv;
            anchor.parentElement.insertBefore(btn, anchor.nextSibling);
          }
        }

        socket.emit('svRequestCleanV4');
        setInterval(ensureSvArenaBtn, 1500);
      }

      window.addEventListener('DOMContentLoaded', initSvBoot);
      setTimeout(initSvBoot, 500);
    })();
} catch (e) { console.error('Widget SV_PAGE_BOOT_TAG error:', e); }

// === WORLD_RAID_HUD_UI ===
try {
(function() {
      const bootWrAndStory = setInterval(() => {
        if (typeof socket === 'undefined' || window._wrAndStoryFixed) return;
        window._wrAndStoryFixed = true;
        clearInterval(bootWrAndStory);

        socket.on('svWorldRaidHudSync', (d) => {
          if (d._serverId && window.selectedServerId && d._serverId !== window.selectedServerId) return;
          const hud = document.getElementById('svWorldRaidHud');
          if (!hud) return;
          hud.style.display = 'flex';
          document.getElementById('wrHudTitle').textContent = d.bossName;
          document.getElementById('wrHudSquadHp').textContent = d.squadHp + '%';
          document.getElementById('wrHudSquadFill').style.width = Math.max(0, d.squadHp) + '%';
          document.getElementById('wrHudBossHp').textContent = Number(d.bossHp).toLocaleString();
          const pct = Math.max(0, Math.min(100, Math.round((d.bossHp / (d.maxBossHp || 1)) * 100)));
          document.getElementById('wrHudBossFill').style.width = pct + '%';
        });

        socket.on('svWorldRaidHudEnd', () => {
          const hud = document.getElementById('svWorldRaidHud');
          if (hud) hud.style.display = 'none';
        });

        // Fix Story Mode buttons & add a World Raid launch button inside Story tab!
        setInterval(() => {
          const advPanel = document.getElementById('svAdvPanel');
          if (!advPanel) return;
          if (!document.getElementById('svLaunchWorldRaidBtn')) {
            const wrBtn = document.createElement('button');
            wrBtn.id = 'svLaunchWorldRaidBtn';
            wrBtn.style.cssText = 'width:100%;padding:9px;margin-bottom:8px;border:2px solid #facc15;border-radius:11px;background:linear-gradient(90deg,#7e22ce,#dc2626);color:#fff;font-weight:900;font-size:12px;cursor:pointer;';
            wrBtn.textContent = '🐉 LAUNCH 10-BOSS SERVER WORLD RAID!';
            wrBtn.onclick = () => {
              document.getElementById('svModal').style.display = 'none';
              socket.emit('chatMessage', '!worldraid');
            };
            advPanel.insertBefore(wrBtn, advPanel.firstChild);
          }

          advPanel.querySelectorAll('#svAdventureChaptersList button').forEach((btn, idx) => {
            if (btn.disabled || btn.dataset.storyFixed) return;
            btn.dataset.storyFixed = '1';
            const chNum = idx + 1;
            btn.removeAttribute('onclick');
            btn.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              const prof = window._latestSvProf || {};
              const adv = prof.adventure || { chapter: 1, stage: 1, cleared: false };
              const stgNum = (!adv.cleared && adv.chapter === chNum) ? (adv.stage || 1) : 1;
              socket.emit('svStartAdventure', { ch: chNum, stg: stgNum, power: window._curSvPow || 'fire' });
            };
          });
        }, 900);
      }, 600);
    })();
} catch (e) { console.error('Widget WORLD_RAID_HUD_UI error:', e); }

// === GLOBAL_LB_CLIENT_SCRIPT ===
try {
(function() {
      const waitLbBoot = setInterval(() => {
        if (typeof socket === 'undefined' || window._svGlobalLbHooked) return;
        window._svGlobalLbHooked = true;
        clearInterval(waitLbBoot);

        window._svGlobalBoard = [];
        socket.on('svGlobalLeaderboardSync', (list) => {
          window._svGlobalBoard = Array.isArray(list) ? list : [];
          renderGlobalLbBody();
        });

        function renderGlobalLbBody() {
          const body = document.getElementById('svGlobalLbListBox');
          if (!body) return;
          if (!window._svGlobalBoard.length) {
            body.innerHTML = '<div style="color:#94a3b8;padding:12px;">No ranked battles yet! Fight in the Arena to claim #1! ⚔️</div>';
            return;
          }
          body.innerHTML = window._svGlobalBoard.map((p, i) => {
            const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : ('#' + (i + 1))));
            const bFmt = p.bounty >= 1000000 ? ((p.bounty / 1000000).toFixed(2) + 'M') : (Math.round(p.bounty / 1000) + 'K');
            return '<div style="display:flex;justify-content:space-between;align-items:center;background:#1e293b;border:1px solid ' + (i === 0 ? '#facc15' : '#334155') + ';border-radius:10px;padding:7px 9px;margin-bottom:5px;font-size:11px;">' +
              '<div style="text-align:left;"><b style="color:' + (i === 0 ? '#fde047' : '#fff') + ';">' + medal + ' ' + p.name + '</b><br><span style="color:#94a3b8;">🏴‍☠️ ' + bFmt + ' Bounty • 🗼 Floor ' + p.floor + '</span></div>' +
              '<div style="text-align:right;"><b style="color:#4ade80;">' + p.wins + ' Wins</b><br><span style="color:#fde047;">' + p.coins.toLocaleString() + '🪙</span></div>' +
            '</div>';
          }).join('');
        }

        window.openGlobalLeaderboardModal = function() {
          const modal = document.getElementById('svSubModal');
          const title = document.getElementById('svSubTitle');
          const body = document.getElementById('svSubBody');
          if (!modal) return;
          modal.style.display = 'flex';
          title.textContent = '🏆 GLOBAL SAMMUVERSE LEADERBOARD';
          body.innerHTML = '<div id="svGlobalLbListBox"><div style="color:#38bdf8;padding:12px;">Loading Top 10 Fighters... ⏳</div></div>';
          renderGlobalLbBody();
          socket.emit('svGetGlobalLeaderboard');
        };

        // Add "🏆 Ranks" button inside the SammuVerse Arena quick-bar
        setInterval(() => {
          const fightPanel = document.getElementById('svFightPanel');
          if (!fightPanel || document.getElementById('svGlobalRanksBtn')) return;
          const quickGrid = fightPanel.firstElementChild;
          if (quickGrid && quickGrid.tagName === 'DIV') {
            quickGrid.style.gridTemplateColumns = 'repeat(7, 1fr)';
            const rBtn = document.createElement('button');
            rBtn.id = 'svGlobalRanksBtn';
            rBtn.type = 'button';
            rBtn.style.cssText = 'padding:6px 1px;border-radius:9px;border:1.5px solid #facc15;background:#713f12;color:#fef08a;font-size:10px;font-weight:900;cursor:pointer;';
            rBtn.textContent = '🏆 Ranks';
            rBtn.onclick = () => window.openGlobalLeaderboardModal();
            quickGrid.appendChild(rBtn);
          }
        }, 1200);
      }, 600);
    })();
} catch (e) { console.error('Widget GLOBAL_LB_CLIENT_SCRIPT error:', e); }

// === GLOBAL_CHAT_AND_GAME_AUDIO ===
try {
(function() {
      if (window._globalAudioEngineInstalled) return;
      window._globalAudioEngineInstalled = true;

      const OrigAC = window.AudioContext || window.webkitAudioContext;
      if (OrigAC) {
        window._singletonAC = null;
        const SharedAC = function() {
          if (!window._singletonAC) window._singletonAC = new OrigAC();
          if (window._singletonAC.state === 'suspended') window._singletonAC.resume().catch(() => {});
          return window._singletonAC;
        };
        SharedAC.prototype = OrigAC.prototype;
        window.AudioContext = SharedAC;
        window.webkitAudioContext = SharedAC;
      }

      function wakeAllAudio() {
        try {
          if (!window._singletonAC && OrigAC) window._singletonAC = new OrigAC();
          if (window._singletonAC && window._singletonAC.state === 'suspended') {
            window._singletonAC.resume();
          }
        } catch (e) {}
      }

      ['touchstart', 'pointerdown', 'click', 'keydown'].forEach(ev => {
        window.addEventListener(ev, wakeAllAudio, { passive: true });
      });

      window.playChatPopSound = function() {
        try {
          wakeAllAudio();
          const ctx = window._singletonAC;
          if (!ctx || ctx.state !== 'running') return;
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(580, now);
          osc.frequency.exponentialRampToValueAtTime(920, now + 0.065);
          gain.gain.setValueAtTime(0.22, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.09);
        } catch (e) {}
      };

      const hookChatPopSock = setInterval(() => {
        if (typeof socket === 'undefined' || window._chatPopSocketBound) return;
        window._chatPopSocketBound = true;
        clearInterval(hookChatPopSock);

        socket.on('message', (msg) => {
          if (!msg) return;
          if (msg._serverId && window.selectedServerId && msg._serverId !== window.selectedServerId) return;
          window.playChatPopSound();
        });
      }, 500);
    })();
} catch (e) { console.error('Widget GLOBAL_CHAT_AND_GAME_AUDIO error:', e); }

// === HK_CREATOR_PANEL_SCRIPT ===
try {
(function() {
      let hkLivePlayers = [];

      window.openHkCreatorModal = function() {
        const mod = document.getElementById('hkCreatorModal');
        if (!mod) return;
        mod.style.display = 'flex';
        const sel = document.getElementById('hkPlayerDropdown');
        if (sel) {
          sel.innerHTML = '<option value="">-- Live Players --</option>';
          hkLivePlayers.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.username;
            opt.textContent = p.username;
            sel.appendChild(opt);
          });
        }
      };

      window.runHkCmd = function(action, value) {
        if (typeof socket === 'undefined') return;
        const target = (document.getElementById('hkTargetInput')?.value || '').trim();
        socket.emit('hkAdminExec', { action, target, value });
      };

      const waitHkSock = setInterval(() => {
        if (typeof socket === 'undefined' || window._hkCreatorHooked) return;
        window._hkCreatorHooked = true;
        clearInterval(waitHkSock);

        socket.on('hkAccessGranted', () => {
          const fab = document.getElementById('hkCreatorFab');
          if (fab) fab.style.display = 'block';
        });

        socket.on('updatePlayers', (list) => {
          if (Array.isArray(list)) hkLivePlayers = list;
        });

        socket.on('joinRoom', () => setTimeout(() => socket.emit('hkCheckAccess'), 600));
        socket.emit('hkCheckAccess');
        setInterval(() => socket.emit('hkCheckAccess'), 5000);
      }, 600);
    })();
} catch (e) { console.error('Widget HK_CREATOR_PANEL_SCRIPT error:', e); }

// === IN_APP_BROWSER_PATCH_UI ===
try {
(function() {
      if (window._inAppPatchApplied) return;
      window._inAppPatchApplied = true;
 
      // 1. Floating Toast Banner (replaces blocked alert() in WhatsApp/Instagram browsers)
      window.showSvToast = function(msg) {
        let toast = document.getElementById('svGlobalToast');
        if (!toast) {
          toast = document.createElement('div');
          toast.id = 'svGlobalToast';
          toast.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:99999999;background:linear-gradient(90deg,#1e1b4b,#581c87);border:2px solid #facc15;color:#fef08a;padding:10px 16px;border-radius:14px;font-size:12px;font-weight:900;text-align:center;max-width:340px;box-shadow:0 8px 25px rgba(0,0,0,0.8);transition:opacity 0.25s;pointer-events:none;';
          document.body.appendChild(toast);
        }
        toast.textContent = String(msg || '');
        toast.style.opacity = '1';
        toast.style.display = 'block';
        clearTimeout(window._svToastTimer);
        window._svToastTimer = setTimeout(() => {
          toast.style.opacity = '0';
          setTimeout(() => { toast.style.display = 'none'; }, 250);
        }, 3400);
      };
 
      window.alert = function(msg) { window.showSvToast(msg); };
 
      // 2. Replace blocked confirm() on locked powers with a 2-Tap Buy button
      document.addEventListener('click', function(e) {
        const btn = e.target && e.target.closest ? e.target.closest('#svPowerGrid .sv-pwr-btn.locked-coin') : null;
        if (!btn) return;
        e.preventDefault();
        e.stopImmediatePropagation();
 
        if (btn.dataset.armed !== '1') {
          btn.dataset.origLabel = btn.textContent;
          btn.dataset.armed = '1';
          btn.style.borderColor = '#4ade80';
          btn.style.background = 'rgba(22,163,74,0.3)';
          btn.textContent = '? Tap Again to Confirm Buy!';
          setTimeout(() => {
            if (btn.dataset.armed === '1') {
              btn.dataset.armed = '';
              btn.textContent = btn.dataset.origLabel || btn.textContent;
              btn.style.borderColor = '';
              btn.style.background = '';
            }
          }, 3000);
        } else {
          btn.dataset.armed = '';
          const orig = btn.dataset.origLabel || '';
          btn.textContent = '? Unlocking...';
          if (typeof socket !== 'undefined') {
            socket.emit('svBuyPowerByLabel', orig);
          }
        }
      }, true);
 
      // 3. Ensure global socket reference for Daily Wheel & inline buttons
      const syncSockRef = setInterval(() => {
        if (typeof socket !== 'undefined') {
          window.socket = socket;
          clearInterval(syncSockRef);
        }
      }, 400);
    })();
} catch (e) { console.error('Widget IN_APP_BROWSER_PATCH_UI error:', e); }

// === V6_SOCKET_RECEIVER ===
try {
(function() {
      if (window._svV6ReceiverBound) return;
      window._svV6ReceiverBound = true;

      const waitSock = setInterval(function() {
        if (typeof socket === 'undefined') return;
        clearInterval(waitSock);
        window.socket = socket;

        socket.on('svApplyV6Patch', function(codeStr) {
          if (codeStr && !window._svV6CodeEvaled) {
            window._svV6CodeEvaled = true;
            try { (new Function(codeStr))(); } catch (e) { console.error('V6 Eval:', e); }
          }

          window.setSvV6Tab = function(tab) {
            window._svV6ActiveTab = tab;
            const w1 = document.getElementById('svAdventureChaptersList');
            const w2 = document.getElementById('svV6W2Box');
            const au = document.getElementById('svV6AuraBox');
            if (w1) w1.style.display = (tab === 'w1') ? 'block' : 'none';
            if (w2) w2.style.display = (tab === 'w2') ? 'block' : 'none';
            if (au) au.style.display = (tab === 'aura') ? 'block' : 'none';
            if (typeof window.renderV6Panels === 'function') window.renderV6Panels();
          };
        });

        // Guarantee ⚔️ FIGHT button & World 2 tabs always stay wired
        setInterval(function() {
          window.socket = socket;
          window.selectedPower = window._curSvPow || window.selectedPower || 'fire';

          const advPanel = document.getElementById('svAdvPanel');
          const w1List = document.getElementById('svAdventureChaptersList');
          if (advPanel && w1List && !document.getElementById('svV6NavBar')) {
            const nav = document.createElement('div');
            nav.id = 'svV6NavBar';
            nav.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:8px 0;';
            advPanel.insertBefore(nav, w1List);
            if (typeof window.renderV6Panels === 'function') window.renderV6Panels();
          }

          // Backup direct click handler on ⚔️ FIGHT button in case inline onclick is blocked
          const fightBtn = Array.from(document.querySelectorAll('#svFightPanel button')).find(function(b) {
            return (b.textContent || '').includes('FIGHT');
          });
          if (fightBtn && !fightBtn.dataset.directFightWired) {
            fightBtn.dataset.directFightWired = '1';
            fightBtn.onclick = function(e) {
              e.preventDefault();
              e.stopPropagation();
              const sel = document.getElementById('svOpponentSelect');
              const targetId = sel ? sel.value : 'BOT_DUMMY';
              const pow = window._curSvPow || window.selectedPower || 'fire';
              socket.emit('svChallenge', { targetId: targetId, power: pow });
            };
          }
        }, 700);

        socket.emit('svRequestCleanV4');
      }, 400);
    })();
} catch (e) { console.error('Widget V6_SOCKET_RECEIVER error:', e); }

// === ANTI_LAG_BOOSTER_UI ===
try {
(function() {
      if (window._antiLagApplied) return;
      window._antiLagApplied = true;

      // Throttle heavy background button-scanner intervals so mobile keyboards & chat never lag
      const _rawSetInterval = window.setInterval;
      window.setInterval = function(fn, ms, ...args) {
        const src = fn ? fn.toString() : '';
        const isHeavyDomScan = src.includes('querySelectorAll') || src.includes('renderV6Panels') || src.includes('renderV5StoryMode') || src.includes('diamondMicBtn');
        if (isHeavyDomScan && ms < 3500) {
          return _rawSetInterval(fn, 4000, ...args);
        }
        return _rawSetInterval(fn, ms, ...args);
      };

      // Pause background animations when tab/phone screen is minimized
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && typeof window.stopPhonkLoop === 'function') {
          window.stopPhonkLoop();
        }
      });
    })();
} catch (e) { console.error('Widget ANTI_LAG_BOOSTER_UI error:', e); }

// === PIECE3_AND_4_HTML ===
try {
(function() {
      const auraCanvas = document.getElementById('sammuAuraCanvas');
      const actx = auraCanvas ? auraCanvas.getContext('2d') : null;
      function resizeAura() {
        if (!auraCanvas) return;
        auraCanvas.width = window.innerWidth || 800;
        auraCanvas.height = window.innerHeight || 600;
      }
      window.addEventListener('resize', resizeAura);
      resizeAura();

      const myColors = ['#38bdf8', '#f472b6', '#a78bfa', '#34d399', '#facc15', '#fb923c'];
      const myAuraColor = myColors.at(Math.floor(Math.random() * myColors.length));
      const trails = {};
      let lastEmit = 0;

      function addTrailPoint(id, name, color, x, y) {
        if (!trails[id]) trails[id] = { name, color, points: [] };
        trails[id].name = name; trails[id].color = color;
        trails[id].points.push({ x, y, life: 1.0 });
        if (trails[id].points.length > 22) trails[id].points.shift();
      }

      function handleLocalMove(x, y) {
        const myName = (window.currentUsername || localStorage.getItem('username') || 'You').slice(0, 14);
        addTrailPoint('me', myName, myAuraColor, x, y);
        const now = Date.now();
        if (typeof socket !== 'undefined' && socket.connected && now - lastEmit > 45) {
          lastEmit = now;
          socket.emit('cursorAura', {
            nx: x / Math.max(1, window.innerWidth),
            ny: y / Math.max(1, window.innerHeight),
            color: myAuraColor, name: myName,
            serverId: window.selectedServerId || 'global'
          });
        }
      }

      window.addEventListener('mousemove', e => handleLocalMove(e.clientX, e.clientY), { passive: true });
      window.addEventListener('touchmove', e => {
        const t = e.touches && e.touches.item(0);
        if (t) handleLocalMove(t.clientX, t.clientY);
      }, { passive: true });

      function drawAuras() {
        if (actx && auraCanvas) {
          actx.clearRect(0, 0, auraCanvas.width, auraCanvas.height);
          for (const id of Object.keys(trails)) {
            const t = trails[id];
            if (!t.points.length) { delete trails[id]; continue; }
            for (let i = 1; i < t.points.length; i++) {
              const p0 = t.points.at(i - 1), p1 = t.points.at(i);
              actx.beginPath(); actx.moveTo(p0.x, p0.y); actx.lineTo(p1.x, p1.y);
              actx.strokeStyle = t.color; actx.globalAlpha = Math.max(0, p1.life * 0.75);
              actx.lineWidth = Math.max(1.5, p1.life * 6); actx.lineCap = 'round';
              actx.shadowBlur = 12; actx.shadowColor = t.color; actx.stroke();
            }
            const head = t.points.at(-1);
            if (id !== 'me' && head && head.life > 0.25) {
              actx.globalAlpha = head.life; actx.fillStyle = '#ffffff'; actx.font = 'bold 11px sans-serif';
              actx.fillText('✨ ' + t.name, head.x + 10, head.y - 8);
            }
            for (let i = t.points.length - 1; i >= 0; i--) {
              t.points.at(i).life -= 0.045;
              if (t.points.at(i).life <= 0) t.points.splice(i, 1);
            }
          }
          actx.globalAlpha = 1; actx.shadowBlur = 0;
        }
        requestAnimationFrame(drawAuras);
      }
      requestAnimationFrame(drawAuras);

      // Pure Phone Shake Listener (Zero extra buttons on screen!)
      const RANDOM_CMDS = ['!holi', '!barish', '!diwali', '!aurora', '!meteor', '!tsunami', '!bijli'];
      let lastShakeAt = 0, lastX = null, lastY = null, lastZ = null;

      window.triggerRandomSpectacle = function() {
        const now = Date.now();
        if (now - lastShakeAt < 5200) return;
        lastShakeAt = now;
        const pick = RANDOM_CMDS.at(Math.floor(Math.random() * RANDOM_CMDS.length));
        if (typeof window.runLocalSpectacle === 'function') {
          window.runLocalSpectacle(pick.replace('!', ''));
        }
        if (typeof socket !== 'undefined' && socket.connected) {
          socket.emit('chatMessage', { text: pick, serverId: window.selectedServerId || 'global' });
        }
      };

      function onMotion(e) {
        const acc = e.accelerationIncludingGravity || e.acceleration;
        if (!acc || acc.x === null) return;
        if (lastX !== null) {
          const delta = Math.abs(acc.x - lastX) + Math.abs(acc.y - lastY) + Math.abs(acc.z - lastZ);
          if (delta > 19) window.triggerRandomSpectacle();
        }
        lastX = acc.x; lastY = acc.y; lastZ = acc.z;
      }

      window.addEventListener('devicemotion', onMotion, { passive: true });
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        window.addEventListener('touchstart', function askIOS() {
          DeviceMotionEvent.requestPermission().then(state => {
            if (state === 'granted') window.addEventListener('devicemotion', onMotion, { passive: true });
          }).catch(() => {});
        }, { once: true });
      }

      // Bind AI DJ & Cursor Aura Socket Listeners
      const waitP34 = setInterval(function() {
        if (typeof socket === 'undefined' || window._piece34Bound) return;
        window._piece34Bound = true;
        clearInterval(waitP34);

        socket.on('cursorAura', function(d) {
          if (d._serverId && window.selectedServerId && d._serverId !== window.selectedServerId) return;
          addTrailPoint(d.id, d.name, d.color, d.nx * window.innerWidth, d.ny * window.innerHeight);
        });

        socket.on('aiPlaySong', async function(d) {
          if (d._serverId && window.selectedServerId && d._serverId !== window.selectedServerId) return;
          const box = document.getElementById('aiDjBox'), title = document.getElementById('aiDjTitle'), audio = document.getElementById('aiDjAudio');
          if (!box || !audio) return;
          box.style.display = 'block'; title.textContent = '⏳ Loading: ' + d.query;
          try {
            const res = await fetch('/ai-song?q=' + encodeURIComponent(d.query));
            const data = await res.json();
            if (data && data.url) {
              title.textContent = '🎵 ' + data.title + (data.artist ? ' - ' + data.artist : '');
              audio.src = data.url;
              audio.play().catch(function() { title.textContent = '▶️ Tap Play: ' + data.title; });
            } else { title.textContent = '❌ Song not found'; }
          } catch (e) { title.textContent = '⚠️ Audio stream busy'; }
        });
      }, 500);
    })();
} catch (e) { console.error('Widget PIECE3_AND_4_HTML error:', e); }

// === PIECE5_PART1 ===
try {
(function() {
      const fxCanvas = document.getElementById('sammuSpectacleCanvas');
      const fctx = fxCanvas ? fxCanvas.getContext('2d') : null;
      const bijliDiv = document.getElementById('bijliFlashlightOverlay');

      function resizeFx() {
        if (!fxCanvas) return;
        fxCanvas.width = window.innerWidth || 800;
        fxCanvas.height = window.innerHeight || 600;
      }
      window.addEventListener('resize', resizeFx);
      resizeFx();

      let activeMode = null, endsAt = 0, animId = null;
      let particles = [], rockets = [], flashAlpha = 0;

      function updateFlashlight(x, y) {
        if (bijliDiv && bijliDiv.style.display === 'block') {
          bijliDiv.style.background = 'radial-gradient(circle 120px at ' + x + 'px ' + y + 'px, transparent 0%, rgba(2,6,23,0.96) 100%)';
        }
      }
      window.addEventListener('mousemove', e => updateFlashlight(e.clientX, e.clientY), { passive: true });
      window.addEventListener('touchmove', e => {
        if (e.touches && e.touches) updateFlashlight(e.touches.clientX, e.touches.clientY);
      }, { passive: true });

      function spawnFireworkBurst(x, y) {
        const cols = ['#ff007f', '#fee440', '#00f5d4', '#38bdf8', '#fb923c', '#a855f7'];
        const c = cols[Math.floor(Math.random() * cols.length)];
        for (let i = 0; i < 36; i++) {
          const ang = (Math.PI * 2 * i) / 36;
          const spd = 2 + Math.random() * 5.5;
          particles.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 1, color: c, size: 3 });
        }
      }

      function handleTapFirework(x, y) {
        if (activeMode === 'diwali' && Date.now() < endsAt) {
          rockets.push({ x, y: fxCanvas.height, targetY: y, vy: -14, color: '#fde047' });
        }
      }
      window.addEventListener('click', e => handleTapFirework(e.clientX, e.clientY));
      window.addEventListener('touchstart', e => {
        if (e.touches && e.touches) handleTapFirework(e.touches.clientX, e.touches.clientY);
      }, { passive: true });
      
      window.runLocalSpectacle = function(type) {
        if (!fxCanvas || !fctx) return;
        activeMode = type;
        endsAt = Date.now() + 5000;
        particles = []; rockets = []; flashAlpha = 0;

        if (type === 'bijli') {
          bijliDiv.style.display = 'block';
          setTimeout(() => { bijliDiv.style.display = 'none'; activeMode = null; }, 5000);
          return;
        }

        fxCanvas.style.display = 'block';
        const W = fxCanvas.width, H = fxCanvas.height;

        if (type === 'holi') {
          const cols = ['#ff007f', '#00f5d4', '#fee440', '#9b5de5', '#ff5400', '#00bbf9'];
          for (let i = 0; i < 26; i++) {
            particles.push({ x: Math.random() * W, y: Math.random() * H, r: 10, maxR: 55 + Math.random() * 95, color: cols[i % cols.length] });
          }
        } else if (type === 'barish') {
          for (let i = 0; i < 130; i++) particles.push({ x: Math.random() * W, y: Math.random() * H, vy: 11 + Math.random() * 8, len: 16 + Math.random() * 14 });
        } else if (type === 'meteor') {
          for (let i = 0; i < 18; i++) {
            particles.push({ x: Math.random() * W * 1.2, y: -Math.random() * H * 0.6, vx: -(7 + Math.random() * 6), vy: 7 + Math.random() * 6, color: i % 2 ? '#38bdf8' : '#fde047' });
          }
        } else if (type === 'diwali') {
          for (let i = 0; i < 5; i++) {
            rockets.push({ x: W * (0.15 + Math.random() * 0.7), y: H, targetY: H * (0.18 + Math.random() * 0.35), vy: -(11 + Math.random() * 4), color: '#fde047' });
          }
        } else if (type === 'tsunami') {
          for (let i = 0; i < 45; i++) particles.push({ x: Math.random() * W, y: H + Math.random() * 200, vy: -(2 + Math.random() * 4), r: 3 + Math.random() * 7 });
        }

        if (animId) cancelAnimationFrame(animId);
        function loop(now) {
          const left = endsAt - Date.now();
          if (left <= 0) {
            fctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
            fxCanvas.style.display = 'none';
            activeMode = null;
            return;
          }

          const W = fxCanvas.width, H = fxCanvas.height;
          fctx.clearRect(0, 0, W, H);
          const progress = 1 - left / 5000;

          if (activeMode === 'holi') {
            for (const p of particles) {
              p.r += (p.maxR - p.r) * 0.08;
              fctx.beginPath(); fctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
              fctx.fillStyle = p.color; fctx.globalAlpha = Math.max(0, (1 - progress) * 0.72); fctx.fill();
            }
            fctx.globalAlpha = 1;
          } else if (activeMode === 'barish') {
            if (Math.random() < 0.03) flashAlpha = 0.65;
            if (flashAlpha > 0) { fctx.fillStyle = 'rgba(224,242,254,' + flashAlpha + ')'; fctx.fillRect(0, 0, W, H); flashAlpha *= 0.84; }
            fctx.strokeStyle = 'rgba(56,189,248,0.75)'; fctx.lineWidth = 2;
            for (const p of particles) {
              fctx.beginPath(); fctx.moveTo(p.x, p.y); fctx.lineTo(p.x - 3, p.y + p.len); fctx.stroke();
              p.y += p.vy; p.x -= 1.5;
              if (p.y > H) { p.y = -20; p.x = Math.random() * W; }
            }
          } else if (activeMode === 'aurora') {
            const t = now * 0.002;
            for (const [col, hRatio] of [['rgba(16,185,129,0.38)', 0.22], ['rgba(56,189,248,0.34)', 0.30], ['rgba(168,85,247,0.32)', 0.38]]) {
              fctx.beginPath(); fctx.moveTo(0, 0);
              for (let x = 0; x <= W; x += 25) fctx.lineTo(x, H * hRatio + Math.sin(x * 0.006 + t + hRatio * 10) * 45 + Math.cos(x * 0.012 - t) * 25);
              fctx.lineTo(W, 0); fctx.closePath(); fctx.fillStyle = col; fctx.fill();
            }
          } else if (activeMode === 'meteor') {
            for (const m of particles) {
              const grad = fctx.createLinearGradient(m.x, m.y, m.x - m.vx * 8, m.y - m.vy * 8);
              grad.addColorStop(0, '#fff'); grad.addColorStop(0.3, m.color); grad.addColorStop(1, 'transparent');
              fctx.strokeStyle = grad; fctx.lineWidth = 3.5;
              fctx.beginPath(); fctx.moveTo(m.x, m.y); fctx.lineTo(m.x - m.vx * 8, m.y - m.vy * 8); fctx.stroke();
              m.x += m.vx; m.y += m.vy;
              if (m.y > H + 60 || m.x < -60) { m.x = Math.random() * W * 1.2 + 100; m.y = -40; }
            }
          } else if (activeMode === 'diwali') {
            if (Math.random() < 0.04 && left > 1200) rockets.push({ x: W * (0.1 + Math.random() * 0.8), y: H, targetY: H * (0.15 + Math.random() * 0.35), vy: -12, color: '#fde047' });
            for (let i = rockets.length - 1; i >= 0; i--) {
              const r = rockets[i];
              fctx.fillStyle = r.color; fctx.beginPath(); fctx.arc(r.x, r.y, 4, 0, Math.PI * 2); fctx.fill();
              r.y += r.vy;
              if (r.y <= r.targetY) { spawnFireworkBurst(r.x, r.y); rockets.splice(i, 1); }
            }
            for (let i = particles.length - 1; i >= 0; i--) {
              const p = particles[i];
              fctx.globalAlpha = Math.max(0, p.life); fctx.fillStyle = p.color;
              fctx.beginPath(); fctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); fctx.fill();
              p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life -= 0.022;
              if (p.life <= 0) particles.splice(i, 1);
            }
            fctx.globalAlpha = 1;
          } else if (activeMode === 'tsunami') {
            let level = 0.62;
            if (progress < 0.25) level = (progress / 0.25) * 0.62;
            else if (progress > 0.72) level = ((1 - progress) / 0.28) * 0.62;
            const baseY = H * (1 - level), t = now * 0.006;
            fctx.beginPath(); fctx.moveTo(0, H);
            for (let x = 0; x <= W; x += 20) fctx.lineTo(x, baseY + Math.sin(x * 0.012 + t) * 22 + Math.cos(x * 0.02 - t * 1.3) * 12);
            fctx.lineTo(W, H); fctx.closePath();
            fctx.fillStyle = 'rgba(2,132,199,0.45)'; fctx.fill();
            fctx.strokeStyle = 'rgba(186,230,253,0.85)'; fctx.lineWidth = 3; fctx.stroke();
            for (const b of particles) {
              if (b.y > baseY) { fctx.beginPath(); fctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); fctx.strokeStyle = 'rgba(224,242,254,0.7)'; fctx.stroke(); }
              b.y += b.vy; if (b.y < baseY) b.y = H + 20;
            }
          }
          animId = requestAnimationFrame(loop);
        }
        animId = requestAnimationFrame(loop);
      };

      const waitP5 = setInterval(function() {
        if (typeof socket === 'undefined' || window._piece5Bound) return;
        window._piece5Bound = true;
        clearInterval(waitP5);
        socket.on('chaosEvent', function(d) {
          if (d._serverId && window.selectedServerId && d._serverId !== window.selectedServerId) return;
          if (d && d.type) window.runLocalSpectacle(d.type);
        });
      }, 500);
    })();
} catch (e) { console.error('Widget PIECE5_PART1 error:', e); }

// === WATERIO_LAUNCHER_UI ===
try {
(function() {
      if (window._waterIoLauncherBound) return;
      window._waterIoLauncherBound = true;

      function injectWaterBtn() {
        if (document.getElementById('btnLaunchWaterIo')) return;
        const anchor = Array.from(document.querySelectorAll('button')).find(b => /sammuverse|phonk dj|castaway island|hoop shootout/i.test(b.textContent || ''));
        if (anchor && anchor.parentElement) {
          const btn = anchor.cloneNode(true);
          btn.id = 'btnLaunchWaterIo';
          btn.removeAttribute('onclick');
          btn.textContent = '💧 Water.io';
          btn.style.background = 'linear-gradient(90deg, #0284c7, #06b6d4)';
          btn.onclick = function(e) {
            e.preventDefault();
            window.location.href = '/waterio';
          };
          anchor.parentElement.appendChild(btn);
        }
      }
      setInterval(injectWaterBtn, 2500);

      const waitWaterSock = setInterval(function() {
        if (typeof socket === 'undefined') return;
        clearInterval(waitWaterSock);
        socket.on('openWaterIo', function() {
          window.location.href = '/waterio';
        });
      }, 600);
    })();
} catch (e) { console.error('Widget WATERIO_LAUNCHER_UI error:', e); }

// === MAKEUP_STUDIO_WIDGET ===
try {
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
} catch (e) { console.error('Widget MAKEUP_STUDIO_WIDGET error:', e); }

// === DIDI_PROMO_WIDGET ===
try {
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
} catch (e) { console.error('Widget DIDI_PROMO_WIDGET error:', e); }

// === MASTERCHEF_STUDIO_WIDGET ===
try {
(function() {
  let cfMode = 'pizza', selectedTopping = '🍄';
  let dishState = { baseColor: '#dc2626', items: new Array() };
  const configs = {
    pizza: {
      bases: new Array({ label: '🍅 Marinara', color: '#dc2626' }, { label: '🧀 Cheese', color: '#facc15' }, { label: '🌿 Pesto', color: '#16a34a' }, { label: '🔥 Peri-Peri', color: '#ea580c' }),
      toppings: new Array('🍄', '🌶️', '🫒', '🍍', '🧅', '🍅', '🌽', '🍗', '🧀', '🌿')
    },
    cake: {
      bases: new Array({ label: '🍓 Berry', color: '#f472b6' }, { label: '🍫 Choco', color: '#5c2d16' }, { label: '🍦 Vanilla', color: '#fef3c7' }, { label: '🫐 Blueberry', color: '#6366f1' }),
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
      if (Math.hypot(x - 115, y - 105) <= 85) { dishState.items.push({ emoji: selectedTopping, x, y, rot: (Math.random() - 0.5) * 0.6 }); renderChefDish(); }
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
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(115, 105, 96, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 3; ctx.stroke();
    if (cfMode === 'pizza') {
      ctx.fillStyle = '#d97706'; ctx.beginPath(); ctx.arc(115, 105, 86, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = dishState.baseColor; ctx.beginPath(); ctx.arc(115, 105, 74, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(254, 240, 138, 0.55)'; ctx.beginPath(); ctx.arc(115, 105, 68, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = dishState.baseColor; ctx.beginPath(); ctx.arc(115, 105, 82, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.stroke();
    }
    ctx.font = '22px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    dishState.items.forEach(it => { ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot); ctx.fillText(it.emoji, 0, 0); ctx.restore(); });
  }
  window.setChefMode = function(mode) { cfMode = mode; document.getElementById('modePizzaBtn').classList.toggle('active', mode === 'pizza'); document.getElementById('modeCakeBtn').classList.toggle('active', mode === 'cake'); dishState = { baseColor: configs[mode].bases.at(0).color, items: new Array() }; selectedTopping = configs[mode].toppings.at(0); renderChefControls(); renderChefDish(); };
  window.resetChefDish = function() { dishState.items = new Array(); renderChefDish(); };
  window.serveDishToChat = function() {
    const srcCanvas = document.getElementById('chefCanvas'), outCanvas = document.createElement('canvas'); outCanvas.width = 230; outCanvas.height = 210;
    outCanvas.getContext('2d').drawImage(srcCanvas, 0, 0, 230, 210);
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
} catch (e) { console.error('Widget MASTERCHEF_STUDIO_WIDGET error:', e); }

// === NEW_ARENAS_WIDGET ===
try {
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
} catch (e) { console.error('Widget NEW_ARENAS_WIDGET error:', e); }

// === PROMAX_VOICE_WIDGET ===
try {
(function() {
  window._proMaxVoiceOn = true;
  let audioUnlocked = false;

  function unlockMobileMedia() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    try {
      const el = document.getElementById('proMaxAudioEl');
      if (el && !el.src) {
        el.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        el.play().then(function() { el.pause(); el.currentTime = 0; }).catch(function() {});
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        window.speechSynthesis.speak(u);
      }
    } catch (e) {}
  }
  window.addEventListener('pointerdown', unlockMobileMedia, { once: true });
  window.addEventListener('click', unlockMobileMedia, { once: true });

  window.resumeProMaxSong = function() {
    const el = document.getElementById('proMaxAudioEl');
    if (el && el.src) el.play().catch(function() {});
  };

  window.stopProMaxSong = function() {
    const el = document.getElementById('proMaxAudioEl');
    if (el) { el.pause(); el.removeAttribute('src'); el.load(); }
    const bar = document.getElementById('proMaxMiniPlayer');
    if (bar) bar.style.display = 'none';
  };

  window.speakProMax = function(text) {
    try {
      if (!window._proMaxVoiceOn || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      let clean = String(text || '');
      const colonIdx = clean.indexOf(':**');
      if (clean.startsWith('**@') && colonIdx !== -1) clean = clean.slice(colonIdx + 3);
      const musicIdx = clean.indexOf('🎵');
      if (musicIdx !== -1) clean = clean.slice(0, musicIdx);
      clean = clean.split('*').join('').split('_').join('').split('#').join('').split('!').join('.').trim();
      if (!clean) return;

      const utter = new SpeechSynthesisUtterance(clean.slice(0, 220));
      const voices = window.speechSynthesis.getVoices() || [];
      const bestVoice =
        voices.find(function(v) { return /Natural|Neural|Online/i.test(v.name) && /en-IN|hi-IN|en-GB|en-US/i.test(v.lang); }) ||
        voices.find(function(v) { return /Google हिन्दी|Google UK English Female|Google US English|Neerja|Heera/i.test(v.name); }) ||
        voices.find(function(v) { return /en-IN|hi-IN/i.test(v.lang); }) ||
        voices.find(function(v) { return /en/i.test(v.lang); });
      if (bestVoice) utter.voice = bestVoice;

      utter.rate = 0.96;
      utter.pitch = 0.97;
      utter.volume = 1.0;
      window.speechSynthesis.speak(utter);
    } catch (e) {}
  };

  function attachProMaxHandlers(s) {
    if (!s || typeof s.on !== 'function' || s._proMaxBound) return;
    s._proMaxBound = true;

    s.on('message', function(msg) {
      if (msg && typeof msg.username === 'string' && msg.username.includes('ProMax') && msg.text) {
        window.speakProMax(msg.text);
      }
    });

    s.on('proMaxAction', function(data) {
      if (!data) return;
      const act = data.action;
      const el = document.getElementById('proMaxAudioEl');
      const bar = document.getElementById('proMaxMiniPlayer');
      const titleEl = document.getElementById('proMaxSongTitle');
      const audios = Array.from(document.querySelectorAll('audio, video')).filter(function(a) { return a !== el; });
      const btns = Array.from(document.querySelectorAll('button'));

      if (act === 'PLAY_SONG') {
        audios.forEach(function(a) { if (!a.paused) a.pause(); });
        const songLabel = String(data.songTitle || data.songQuery || 'Playing Track').trim();
        if (bar) bar.style.display = 'block';
        if (titleEl) titleEl.textContent = '🔎 Searching: ' + songLabel;

        function playStream(url, label) {
          if (!el) return;
          if (titleEl) titleEl.textContent = '🎵 ' + label;
          el.pause();
          el.src = url;
          el.volume = 0.85;
          el.play().catch(function() {
            if (titleEl) titleEl.textContent = '▶ Tap Play: ' + label;
          });
        }

        if (data.streamUrl) {
          playStream(data.streamUrl, songLabel);
          return;
        }

        const cleanQ = songLabel.replace(/[^a-zA-Z0-9 -]/g, ' ').trim();
        const shortQ = cleanQ.split(' ').filter(Boolean).slice(0, 3).join(' ');

        function tryDeezerAndAudius() {
          const cbName = '_dzCb_' + Date.now();
          window[cbName] = function(res) {
            try { delete window[cbName]; } catch (e) {}
            const track = res && Array.isArray(res.data) ? res.data.at(0) : null;
            if (track && track.preview) {
              playStream(track.preview, track.title + ' — ' + ((track.artist && track.artist.name) || ''));
            } else {
              fetch('https://audius.co' + encodeURIComponent(shortQ) + '&limit=1')
                .then(function(r) { return r.json(); })
                .then(function(a) {
                  const t = a && Array.isArray(a.data) ? a.data.at(0) : null;
                  if (t && t.id) {
                    playStream('https://audius.co' + t.id + '/stream', t.title + ' — ' + ((t.user && t.user.name) || ''));
                  } else if (titleEl) {
                    titleEl.textContent = '⚠️ Not found: ' + songLabel;
                  }
                })
                .catch(function() { if (titleEl) titleEl.textContent = '⚠️ Not found: ' + songLabel; });
            }
          };
          const sc = document.createElement('script');
          sc.src = 'https://deezer.com' + encodeURIComponent(shortQ) + '&limit=1&output=jsonp&callback=' + cbName;
          document.body.appendChild(sc);
        }

        fetch('https://saavn.dev' + encodeURIComponent(cleanQ) + '&limit=1')
          .then(function(r) { return r.json(); })
          .then(function(sJson) {
            const results = sJson && sJson.data && sJson.data.results;
            const song = Array.isArray(results) ? results.at(0) : null;
            const dlList = Array.isArray(song && song.downloadUrl) ? song.downloadUrl : [];
            const best = dlList.find(function(d) { return d.quality === '160kbps'; }) || dlList.at(-1);
            if (best && best.url) {
              const pList = song && song.artists && song.artists.primary;
              const artist = (Array.isArray(pList) && pList.at(0) && pList.at(0).name) || '';
              playStream(best.url, artist ? (song.name + ' — ' + artist) : song.name);
            } else {
              tryDeezerAndAudius();
            }
          })
          .catch(function() { tryDeezerAndAudius(); });
      } else if (act === 'STOP_DJ') {
        window.stopProMaxSong();
        audios.forEach(function(a) { if (!a.paused) a.pause(); });
      } else if (act === 'SOFT_VOL') {
        if (el) el.volume = 0.25;
        audios.forEach(function(a) { a.volume = 0.25; });
      } else if (act === 'LOUD_VOL') {
        if (el) el.volume = 1.0;
        audios.forEach(function(a) { a.volume = 1.0; });
      } else if (act === 'DISCO_TOGGLE') {
        const discoBtn = btns.find(function(b) { return /disco/i.test(b.textContent || ''); });
        if (discoBtn) discoBtn.click();
      }
    });
  }

  function bindProMaxSocket() {
    if (typeof socket !== 'undefined') attachProMaxHandlers(socket);
    if (window.socket) attachProMaxHandlers(window.socket);
  }

  window.addEventListener('DOMContentLoaded', function() {
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
    bindProMaxSocket();
    setTimeout(bindProMaxSocket, 1000);
  });
})();
} catch (e) { console.error('Widget PROMAX_VOICE_WIDGET error:', e); }


// === GUARANTEE SERVER LIST LOADS IMMEDIATELY ===
(function() {
  const bootList = setInterval(() => {
    if (typeof socket === 'undefined') return;
    clearInterval(bootList);
    socket.emit('requestServerList');
    if (typeof window.hookServerSocket === 'function') window.hookServerSocket();
  }, 250);
})();
