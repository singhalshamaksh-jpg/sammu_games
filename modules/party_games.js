module.exports = function(ctx) {
    let { app, io, fs, path, serversDB, saveDB, OG_HOSTS, MASTER_KEYS, lockedOGSignatures, verifyOGHostTripleLock, arenas, getArena, syncArenaPlayers, IMPOSTER_WORDS, EXTRA_ANIME_QUIZ } = ctx;

           // === 🧟 ZOMBIE OUTBREAK SURVIVAL (BOSS: ZOROMON) ===
    const zombieByServer = new Map();
    const ZOMBIE_WAVES = [
        { num: 1, name: '🧟 Wave 1: Shambling Walkers', hp: 1200, dmg: 22 },
        { num: 2, name: '🏃‍♂️ Wave 2: Sprint Runners', hp: 1800, dmg: 30 },
        { num: 3, name: '🧪 Wave 3: Acid Spitters', hp: 2500, dmg: 38 },
        { num: 4, name: '🛡️ Wave 4: Armored Brutes', hp: 3400, dmg: 45 },
        { num: 5, name: '👑🧟‍♂️ BOSS: ZOROMON (3-SWORD KING)', hp: 5000, dmg: 55 }
    ];

    const ZOMBIE_UI = `
    <style>
      @keyframes zbMarch { 0%,100% { transform: translateX(0) rotate(-3deg); } 50% { transform: translateX(-8px) rotate(3deg); } }
      @keyframes zbShake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
      @keyframes zbShot { 0% { left: 26%; opacity: 1; transform: scale(0.8); } 100% { left: 74%; opacity: 0; transform: scale(1.4); } }
      .zb-march { display:inline-block; animation: zbMarch 0.8s infinite ease-in-out; }
      .zb-hit-shake { animation: zbShake 0.35s ease; }
      .zb-fx-fly { position:absolute; top:14px; font-size:15px; font-weight:900; pointer-events:none; animation: zbShot 0.55s forwards ease-out; }
    </style>
    <div id="zombieBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999998;justify-content:center;padding:0 10px;pointer-events:none;">
      <div id="zbCard" style="pointer-events:auto;background:linear-gradient(155deg,rgba(6,44,24,0.96),rgba(20,25,45,0.96));border:2px solid #22c55e;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(34,197,94,0.45);backdrop-filter:blur(6px);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span id="zbWaveTitle" style="font-weight:900;font-size:11px;color:#4ade80;">🧟 ZOMBIE OUTBREAK</span>
          <span id="zbTimer" style="font-size:11px;color:#fde047;font-weight:900;">⏳ 15s</span>
        </div>
        <div id="zbBattleStage" style="position:relative;height:46px;background:linear-gradient(90deg,#0f172a 0%,#1e1b4b 55%,#450a0a 100%);border:1.5px solid #334155;border-radius:10px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;overflow:hidden;">
          <div style="display:flex;align-items:center;gap:4px;">
            <span id="zbSquadSprites" style="font-size:20px;">🔫🩺</span>
            <span id="zbWallSprite" style="font-size:22px;filter:drop-shadow(0 0 6px #38bdf8);">🧱</span>
          </div>
          <div style="font-size:10px;color:#94a3b8;font-weight:900;letter-spacing:1px;">⚔️ VS ⚔️</div>
          <div id="zbHordeSprites" class="zb-march" style="font-size:24px;filter:drop-shadow(0 0 8px #ef4444);">🧟‍♂️🧟‍♀️</div>
        </div>
        <div style="display:flex;gap:6px;font-size:10px;font-weight:bold;margin-bottom:5px;">
          <div style="flex:1;background:#0f172a;border:1px solid #38bdf8;border-radius:8px;padding:3px;position:relative;overflow:hidden;">
            <div id="zbWallFill" style="position:absolute;inset:0;width:100%;background:rgba(56,189,248,0.28);transition:width 0.3s;"></div>
            <span style="position:relative;">🧱 Wall: <b id="zbWallHp" style="color:#38bdf8;">100%</b></span>
          </div>
          <div style="flex:1;background:#0f172a;border:1px solid #ef4444;border-radius:8px;padding:3px;position:relative;overflow:hidden;">
            <div id="zbBossFill" style="position:absolute;inset:0;width:100%;background:rgba(239,68,68,0.32);transition:width 0.3s;"></div>
            <span style="position:relative;">👹 Horde: <b id="zbBossHp" style="color:#f87171;">1200</b></span>
          </div>
          <div style="background:#0f172a;border:1px solid #a855f7;border-radius:8px;padding:3px 6px;">👥 <b id="zbCounts" style="color:#e9d5ff;">0H/0Z</b></div>
        </div>
        <div id="zbRoleBanner" style="background:rgba(34,197,94,0.18);border:1px solid #4ade80;border-radius:8px;padding:4px 6px;margin-bottom:6px;font-size:11px;font-weight:900;color:#fde047;">Pick your class!</div>
        <div id="zbActions" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;"></div>
      </div>
    </div>
     <script>
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
    </script>`;
    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('zombieBar')) {
                body = body.replace('</body>', ZOMBIE_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });

    function broadcastZombieState(srvId) {
        const st = zombieByServer.get(srvId);
        if (!st) return;
        const w = ZOMBIE_WAVES.at(st.waveIdx);
        let humans = 0, zombies = 0;
        st.roles.forEach(r => { if (r.isZombie) zombies++; else humans++; });
        st.roles.forEach((info, sid) => {
            io.to(sid).emit('zombieSync', {
                waveName: w.name, timeLeft: st.timeLeft, wallHp: st.wallHp, hordeHp: st.hordeHp,
                humans, zombies, isZombie: info.isZombie, isPatientZero: info.isPatientZero,
                myClass: info.cls, acted: st.acted.has(sid), _serverId: srvId
            });
        });
    }

    function endZombieGame(srvId, humansWon, summaryText) {
        const st = zombieByServer.get(srvId);
        if (!st) return;
        if (st.interval) clearInterval(st.interval);
        zombieByServer.delete(srvId);
        io.to(srvId).emit('zombieEnd', { _serverId: srvId });
        const winners = [];
        st.roles.forEach((info) => {
            if ((humansWon && !info.isZombie) || (!humansWon && info.isZombie)) winners.push(info.username);
        });
        io.to(srvId).emit('message', {
            username: "Sammu's Bot",
            text: `${summaryText}\n🏆 **Winners (+10 MVP & 🧟 Zoromon Slayer Trophy):** ${winners.length ? winners.join(', ') : 'None'}!`,
            _serverId: srvId
        });
    }

    function resolveZombieWave(srvId) {
        const st = zombieByServer.get(srvId);
        if (!st) return;
        const w = ZOMBIE_WAVES.at(st.waveIdx);
        st.acted.clear();
        const hordeStrike = Math.max(8, w.dmg - st.stunBonus);
        st.stunBonus = 0;
        st.wallHp = Math.max(0, st.wallHp - hordeStrike);
        let humanCount = 0;
        st.roles.forEach(r => { if (!r.isZombie) humanCount++; });

        if (st.wallHp <= 0 || humanCount === 0) {
            return endZombieGame(srvId, false, `💀🧟 **ZOROMON & THE HORDE OVERRAN THE SAFE ZONE!** All humans got infected!`);
        }
        if (st.hordeHp <= 0) {
            if (st.waveIdx + 1 >= ZOMBIE_WAVES.length) {
                return endZombieGame(srvId, true, `🎉🔥 **ZOROMON GOT DESTROYED!!** Even with 3 rusty zombie swords he got lost on the way to the wall! Humans win! 😂🏆`);
            }
            st.waveIdx++;
            const nextW = ZOMBIE_WAVES.at(st.waveIdx);
            st.hordeHp = nextW.hp;
            const bossRoast = nextW.num === 5 ? `\n😂 *Warning: **ZOROMON** appeared holding 3 swords upside down and still got lost!*` : '';
            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `⚔️ Wave cleared! Next up: **${nextW.name}** (HP: ${nextW.hp}) | Wall at **${st.wallHp}%**!${bossRoast}`,
                _serverId: srvId
            });
        } else {
            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `🧟 Horde attacked the wall for **-${hordeStrike}%** (Wall: **${st.wallHp}%** | Horde HP left: **${st.hordeHp}**)! Keep fighting!`,
                _serverId: srvId
            });
        }
        st.timeLeft = 15;
        broadcastZombieState(srvId);
    }

    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const txt = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof txt !== 'string' || txt.trim().toLowerCase() !== '!zombie') return;
            if (zombieByServer.has(srvId)) return;
            syncArenaPlayers(srvId);
            const arena = getArena(srvId);
            if (arena.players.length < 2) {
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: '⚠️ Need at least **2 players in this server** to start **🧟 Zombie Outbreak**!', _serverId: srvId });
                return;
            }
            const roles = new Map();
            const shuffled = [...arena.players].sort(() => Math.random() - 0.5);
            const hasSaboteur = shuffled.length >= 4;
            shuffled.forEach((p, idx) => {
                const isZero = hasSaboteur && idx === 0;
                roles.set(p.id, { username: p.username, isZombie: isZero, isPatientZero: isZero, cls: 'Commando' });
            });
            const st = {
                waveIdx: 0, hordeHp: ZOMBIE_WAVES.at(0).hp, wallHp: 100, stunBonus: 0,
                timeLeft: 15, roles, acted: new Set(), interval: null
            };
            zombieByServer.set(srvId, st);
            st.interval = setInterval(() => {
                const cur = zombieByServer.get(srvId);
                if (!cur) return;
                cur.timeLeft--;
                if (cur.timeLeft <= 0) resolveZombieWave(srvId);
                else broadcastZombieState(srvId);
            }, 1000);
            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `🧟🚨 **ZOMBIE OUTBREAK STARTED!** Survive 5 Waves & defeat **BOSS ZOROMON**! ${hasSaboteur ? '*(⚠️ 1 player is secretly Infected!)*' : ''}`,
                _serverId: srvId
            });
            broadcastZombieState(srvId);
        });

        socket.on('zombieAct', ({ move, cls }) => {
            const srvId = socket.activeServerId;
            const st = srvId ? zombieByServer.get(srvId) : null;
            if (!st || !st.roles.has(socket.id) || st.acted.has(socket.id)) return;
            const actor = st.roles.get(socket.id);
            st.acted.add(socket.id);
            if (cls && !actor.isZombie) actor.cls = cls;
            if (actor.isZombie) {
                if (move === 'smash') {
                    st.wallHp = Math.max(0, st.wallHp - 22);
                    io.to(srvId).emit('message', { username: "Sammu's Bot", text: `💥 A Zombie clawed the Safe-Zone Wall for **-22%**! (Wall: **${st.wallHp}%**)`, _serverId: srvId });
                } else if (move === 'bite') {
                    const humanIds = [];
                    st.roles.forEach((r, sid) => { if (!r.isZombie) humanIds.push(sid); });
                    if (humanIds.length > 1) {
                        const victimId = humanIds.at(Math.floor(Math.random() * humanIds.length));
                        const victim = st.roles.get(victimId);
                        victim.isZombie = true;
                        io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🦷☣️ **INFECTION ALERT!** **${victim.username}** was bitten and mutated into a **🧟 ZOMBIE**!`, _serverId: srvId });
                    } else {
                        st.wallHp = Math.max(0, st.wallHp - 18);
                    }
                }
            } else {
                if (move === 'shoot') st.hordeHp = Math.max(0, st.hordeHp - 420);
                else if (move === 'bomb') { st.hordeHp = Math.max(0, st.hordeHp - 320); st.stunBonus += 12; }
                else if (move === 'repair') st.wallHp = Math.min(100, st.wallHp + 28);
                else if (move === 'heal') st.wallHp = Math.min(100, st.wallHp + 20);
            }
            if (st.acted.size >= st.roles.size || st.hordeHp <= 0 || st.wallHp <= 0) resolveZombieWave(srvId);
            else broadcastZombieState(srvId);
        });
    });
    // === 🐉 DRAGON RAID BOSS (!boss) & 🏦 BANK HEIST (!heist) — PIECE 1/4 ===
    const raidByServer = new Map();
    const heistByServer = new Map();

    function getFullRoomPlayers(srvId) {
        syncArenaPlayers(srvId);
        const arena = getArena(srvId);
        const roomSockets = io.sockets.adapter.rooms.get(srvId) || new Set();
        const all = [];
        roomSockets.forEach(sid => {
            const s = io.sockets.sockets.get(sid);
            const ex = arena.players.find(p => p.id === sid);
            if (ex) all.push(ex);
            else if (s) all.push({ id: sid, username: s.username || 'Player_' + sid.slice(0, 4) });
        });
        return all;
    }

    const COOP_PARTY_UI = `
    <div id="raidBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999998;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(49,16,66,0.96),rgba(15,23,42,0.96));border:2px solid #c084fc;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(192,132,252,0.5);backdrop-filter:blur(6px);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <span id="raidTitle" style="font-weight:900;font-size:11px;color:#e879f9;">🐉 SHADOW DRAGON RAID</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="raidTimer" style="font-size:11px;color:#fde047;font-weight:900;">⏳ 12s</span>
            <button onclick="document.getElementById('raidBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div style="display:flex;gap:6px;font-size:10px;font-weight:bold;margin-bottom:6px;">
          <div style="flex:1;background:#090d16;border:1px solid #4ade80;border-radius:8px;padding:4px;position:relative;overflow:hidden;">
            <div id="raidTeamFill" style="position:absolute;inset:0;width:100%;background:rgba(74,222,128,0.28);transition:width 0.3s;"></div>
            <span style="position:relative;">❤️ Squad HP: <b id="raidTeamHp" style="color:#4ade80;">100%</b></span>
          </div>
          <div style="flex:1;background:#090d16;border:1px solid #f43f5e;border-radius:8px;padding:4px;position:relative;overflow:hidden;">
            <div id="raidBossFill" style="position:absolute;inset:0;width:100%;background:rgba(244,63,94,0.32);transition:width 0.3s;"></div>
            <span style="position:relative;">🐉 Boss: <b id="raidBossHp" style="color:#fda4af;">3000</b></span>
          </div>
        </div>
        <div id="raidActions" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;"></div>
      </div>
    </div>

    <div id="heistBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999998;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(6,78,59,0.96),rgba(15,23,42,0.96));border:2px solid #facc15;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(250,204,21,0.45);backdrop-filter:blur(6px);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <span id="heistRound" style="font-weight:900;font-size:11px;color:#fde047;">🏦 MEGA BANK HEIST (1/4)</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="heistTimer" style="font-size:11px;color:#38bdf8;font-weight:900;">⏳ 12s</span>
            <button onclick="document.getElementById('heistBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div style="display:flex;gap:6px;font-size:10px;font-weight:bold;margin-bottom:6px;">
          <div style="flex:1;background:#090d16;border:1px solid #facc15;border-radius:8px;padding:4px;">💰 Vault Loot: <b id="heistLoot" style="color:#fde047;">$0</b></div>
          <div style="flex:1;background:#090d16;border:1px solid #ef4444;border-radius:8px;padding:4px;">🚨 Police Heat: <b id="heistHeat" style="color:#f87171;">0%</b></div>
        </div>
        <div id="heistActions" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;"></div>
      </div>
    </div>
    
    <script>
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
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('raidBar')) {
                body = body.replace('</body>', COOP_PARTY_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // === PIECE 3/4: DRAGON RAID & BANK HEIST ENGINES ===
    function broadcastRaid(srvId) {
        const st = raidByServer.get(srvId);
        if (!st) return;
        st.players.forEach(p => {
            io.to(p.id).emit('raidSync', {
                timeLeft: st.timeLeft, teamHp: st.teamHp, bossHp: st.bossHp,
                maxBossHp: st.maxBossHp, acted: st.acted.has(p.id), _serverId: srvId
            });
        });
    }

    function resolveRaidTurn(srvId) {
        const st = raidByServer.get(srvId);
        if (!st) return;
        if (st.bossHp <= 0) {
            clearInterval(st.interval);
            raidByServer.delete(srvId);
            io.to(srvId).emit('raidEnd', { _serverId: srvId });
            const top = Object.entries(st.dmgMap).sort((a, b) => b[1] - a[1])[0];
            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `🎉🐉 **SHADOW DRAGON SLAIN!** The squad survived with **${st.teamHp}% HP**!\n👑 **Raid MVP:** **${top ? top[0] : 'Squad'}** (${top ? top[1] : 0} DMG)!`,
                _serverId: srvId
            });
            return;
        }
        const rawBreath = Math.floor(Math.random() * 18) + 22;
        const finalDmg = Math.max(5, rawBreath - st.shieldBonus);
        st.teamHp = Math.max(0, st.teamHp - finalDmg);
        st.shieldBonus = 0;
        st.acted.clear();
        st.timeLeft = 12;

        if (st.teamHp <= 0) {
            clearInterval(st.interval);
            raidByServer.delete(srvId);
            io.to(srvId).emit('raidEnd', { _serverId: srvId });
            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `💀🔥 **WIPEOUT!** The Shadow Dragon roasted the entire squad with **${st.bossHp} HP** left!`,
                _serverId: srvId
            });
            return;
        }
        io.to(srvId).emit('message', {
            username: "Sammu's Bot",
            text: `🐉 Dragon breathed fire for **-${finalDmg}% Squad HP**! (Squad: **${st.teamHp}%** | Boss: **${st.bossHp} HP**)`,
            _serverId: srvId
        });
        broadcastRaid(srvId);
    }

    function broadcastHeist(srvId) {
        const st = heistByServer.get(srvId);
        if (!st) return;
        st.players.forEach(p => {
            io.to(p.id).emit('heistSync', {
                round: st.round, timeLeft: st.timeLeft, loot: st.loot,
                heat: st.heat, acted: st.acted.has(p.id), _serverId: srvId
            });
        });
    }

    function resolveHeistTurn(srvId) {
        const st = heistByServer.get(srvId);
        if (!st) return;
        if (st.heat >= 100) {
            clearInterval(st.interval);
            heistByServer.delete(srvId);
            io.to(srvId).emit('heistEnd', { _serverId: srvId });
            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `🚓🚨 **BUSTED!!** Police Heat hit **100%**! Everyone got arrested and lost **$${st.loot.toLocaleString()}**!`,
                _serverId: srvId
            });
            return;
        }
        if (st.round >= 4) {
            clearInterval(st.interval);
            heistByServer.delete(srvId);
            io.to(srvId).emit('heistEnd', { _serverId: srvId });
            const share = Math.floor(st.loot / Math.max(1, st.players.length));
            const topGreedy = Object.entries(st.personalLoot).sort((a, b) => b[1] - a[1])[0];
            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `🚁💰 **HEIST ESCAPE SUCCESS!** Total Stolen: **$${st.loot.toLocaleString()}** (**$${share.toLocaleString()}** each)!\n😈 **Sneakiest Pocket:** **${topGreedy ? topGreedy[0] : 'None'}** (+$${topGreedy ? topGreedy[1].toLocaleString() : 0} extra)!`,
                _serverId: srvId
            });
            return;
        }
        st.round++;
        st.acted.clear();
        st.timeLeft = 12;
        io.to(srvId).emit('message', {
            username: "Sammu's Bot",
            text: `🏦 **Round ${st.round}/4!** Vault Loot: **$${st.loot.toLocaleString()}** | Police Heat: **${st.heat}%** — Lock your move!`,
            _serverId: srvId
        });
        broadcastHeist(srvId);
    }
    // === PIECE 4/4: SOCKET LISTENERS ===
    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const txt = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof txt !== 'string') return;
            const cmd = txt.trim().toLowerCase();

            if (cmd === '!boss' && !raidByServer.has(srvId)) {
                const players = getFullRoomPlayers(srvId);
                if (players.length < 2) return io.to(srvId).emit('message', { username: "Sammu's Bot", text: '⚠️ Need at least **2 players** for **🐉 Dragon Raid**!', _serverId: srvId });
                const maxBossHp = players.length * 1100;
                const st = { players, teamHp: 100, bossHp: maxBossHp, maxBossHp, shieldBonus: 0, timeLeft: 12, acted: new Set(), dmgMap: {}, interval: null };
                raidByServer.set(srvId, st);
                st.interval = setInterval(() => {
                    const c = raidByServer.get(srvId);
                    if (!c) return;
                    c.timeLeft--;
                    if (c.timeLeft <= 0) resolveRaidTurn(srvId);
                    else broadcastRaid(srvId);
                }, 1000);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🐉⚔️ **DRAGON RAID STARTED!** (${players.length} Heroes vs **${maxBossHp} HP Dragon**) Coordinate attacks & heals in the top bar!`, _serverId: srvId });
                broadcastRaid(srvId);
            }

            if (cmd === '!heist' && !heistByServer.has(srvId)) {
                const players = getFullRoomPlayers(srvId);
                if (players.length < 2) return io.to(srvId).emit('message', { username: "Sammu's Bot", text: '⚠️ Need at least **2 players** for **🏦 Bank Heist**!', _serverId: srvId });
                const st = { players, round: 1, loot: 0, heat: 15, timeLeft: 12, acted: new Set(), personalLoot: {}, interval: null };
                heistByServer.set(srvId, st);
                st.interval = setInterval(() => {
                    const c = heistByServer.get(srvId);
                    if (!c) return;
                    c.timeLeft--;
                    if (c.timeLeft <= 0) resolveHeistTurn(srvId);
                    else broadcastHeist(srvId);
                }, 1000);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🏦💰 **MEGA BANK HEIST STARTED!** Survive 4 rounds without Police Heat hitting **100%**!`, _serverId: srvId });
                broadcastHeist(srvId);
            }
        });

        socket.on('raidAct', (move) => {
            const srvId = socket.activeServerId;
            const st = srvId ? raidByServer.get(srvId) : null;
            if (!st || st.acted.has(socket.id)) return;
            st.acted.add(socket.id);
            const uname = socket.username || 'Hero';
            let dmg = 0;
            if (move === 'slash') dmg = 350;
            else if (move === 'fireball') { dmg = 500; st.teamHp = Math.max(1, st.teamHp - 6); }
            else if (move === 'shield') st.shieldBonus += 14;
            else if (move === 'heal') st.teamHp = Math.min(100, st.teamHp + 22);

            if (dmg > 0) {
                st.bossHp = Math.max(0, st.bossHp - dmg);
                st.dmgMap[uname] = (st.dmgMap[uname] || 0) + dmg;
            }
            if (st.acted.size >= st.players.length || st.bossHp <= 0) resolveRaidTurn(srvId);
            else broadcastRaid(srvId);
        });

        socket.on('heistAct', (move) => {
            const srvId = socket.activeServerId;
            const st = srvId ? heistByServer.get(srvId) : null;
            if (!st || st.acted.has(socket.id)) return;
            st.acted.add(socket.id);
            const uname = socket.username || 'Robber';
            if (move === 'drill') { st.loot += 25000; st.heat = Math.min(100, st.heat + 15); }
            else if (move === 'guard') { st.heat = Math.max(0, st.heat - 20); }
            else if (move === 'greed') {
                st.loot += 40000;
                st.heat = Math.min(100, st.heat + 28);
                st.personalLoot[uname] = (st.personalLoot[uname] || 0) + 40000;
            }
            if (st.acted.size >= st.players.length || st.heat >= 100) resolveHeistTurn(srvId);
            else broadcastHeist(srvId);
        });
    });
    // === 🎭 BLUFF MASTER (!bluff) — CHAT-INPUT PARTY GAME (PIECE 1/3) ===
    const bluffByServer = new Map();
    const BLUFF_PROMPTS = [
        "😂 Worst thing to say to your teacher during an exam?",
        "💀 Excuse you give when you're 2 hours late?",
        "🚨 What would get you banned from a zoo immediately?",
        "👽 First thing you'd say to an alien landing in your room?",
        "💍 Worst place to propose to someone?",
        "👻 What a ghost in your house is secretly tired of watching you do?",
        "🍕 Illegal pizza topping that should send someone to jail?",
        "🦸‍♂️ Most useless superpower ever?",
        "📱 Last search history item you'd die if your mom saw?",
        "🎤 Terrible name for a Bollywood movie?"
    ];

    const BLUFF_UI = `
    <div id="bluffBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999998;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(88,28,135,0.96),rgba(15,23,42,0.96));border:2px solid #f472b6;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(244,114,182,0.5);backdrop-filter:blur(6px);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-weight:900;font-size:11px;color:#f9a8d4;">🎭 BLUFF MASTER (CHAT GAME)</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="bluffTimer" style="font-size:11px;color:#fde047;font-weight:900;">⏳ 20s</span>
            <button onclick="document.getElementById('bluffBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div id="bluffPromptBox" style="background:rgba(244,114,182,0.2);border:1px solid #f472b6;border-radius:9px;padding:6px;margin-bottom:6px;font-size:12px;font-weight:900;color:#fde047;">Prompt loading...</div>
        <div id="bluffSubBox" style="font-size:11px;color:#cbd5e1;">✍️ Type your funny answer in normal chat now! (Hidden until voting!)</div>
        <div id="bluffVoteGrid" style="display:flex;flex-direction:column;gap:5px;margin-top:6px;max-height:140px;overflow-y:auto;"></div>
      </div>
    </div>
    <script>
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
            sub.innerHTML = '🗳️ <b>Tap the funniest answer!</b> (You can\'t vote for yourself)';
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
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('bluffBar')) {
                body = body.replace('</body>', BLUFF_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // === PIECE 2/3: BLUFF MASTER ENGINE & SECRET CHAT CAPTURE ===
    function broadcastBluff(srvId) {
        const st = bluffByServer.get(srvId);
        if (!st) return;
        const entries = Array.from(st.answers.entries()).map(([authorId, obj]) => ({ authorId, text: obj.text }));
        st.players.forEach(p => {
            io.to(p.id).emit('bluffSync', {
                phase: st.phase, timeLeft: st.timeLeft, prompt: st.prompt,
                submitted: st.answers.has(p.id), voted: st.votes.has(p.id),
                entries, _serverId: srvId
            });
        });
    }

    function startBluffVoting(srvId) {
        const st = bluffByServer.get(srvId);
        if (!st) return;
        if (st.answers.size < 2) {
            clearInterval(st.interval);
            bluffByServer.delete(srvId);
            io.to(srvId).emit('bluffEnd', { _serverId: srvId });
            io.to(srvId).emit('message', { username: "Sammu's Bot", text: '⚠️ Bluff Master cancelled—not enough answers typed in time!', _serverId: srvId });
            return;
        }
        st.phase = 'vote';
        st.timeLeft = 15;
        io.to(srvId).emit('message', { username: "Sammu's Bot", text: '🗳️ **TIME TO VOTE!** All answers are revealed in the top bar—vote for the funniest one!', _serverId: srvId });
        broadcastBluff(srvId);
    }

    function finishBluffGame(srvId) {
        const st = bluffByServer.get(srvId);
        if (!st) return;
        clearInterval(st.interval);
        bluffByServer.delete(srvId);
        io.to(srvId).emit('bluffEnd', { _serverId: srvId });

        const tally = {};
        for (const targetId of st.votes.values()) tally[targetId] = (tally[targetId] || 0) + 1;
        const results = Array.from(st.answers.entries()).map(([id, obj]) => ({
            name: obj.username, text: obj.text, votes: tally[id] || 0
        })).sort((a, b) => b.votes - a.votes);

        const lines = results.map((r, i) => `${i === 0 ? '👑' : '•'} **${r.name}** (${r.votes} votes): *"${r.text}"*`).join('\n');
        io.to(srvId).emit('message', {
            username: "Sammu's Bot",
            text: `🎭 **BLUFF MASTER RESULTS!**\nPrompt: *${st.prompt}*\n${lines}`,
            _serverId: srvId
        });
    }

    io.on('connection', (socket) => {
        // Intercept normal chat messages during Bluff writing phase so answers stay secret!
        socket.use((packet, next) => {
            if (packet && packet.at(0) === 'chatMessage' && socket.activeServerId) {
                const st = bluffByServer.get(socket.activeServerId);
                if (st && st.phase === 'write' && !st.answers.has(socket.id)) {
                    const raw = packet.at(1);
                    const txt = (typeof raw === 'object' && raw) ? raw.text : raw;
                    if (typeof txt === 'string' && !txt.trim().startsWith('!') && !txt.trim().startsWith('/')) {
                        st.answers.set(socket.id, { username: socket.username || 'Player', text: txt.trim().slice(0, 75) });
                        socket.emit('message', { username: 'SYSTEM', text: `🤫 Secret answer locked: *"${txt.trim().slice(0, 75)}"*`, _serverId: socket.activeServerId });
                        if (st.answers.size >= st.players.length) startBluffVoting(socket.activeServerId);
                        else broadcastBluff(socket.activeServerId);
                        return; // Hide message from public chat!
                    }
                }
            }
            next();
        });

        socket.on('chatMessage', (payload) => {
            const txt = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof txt !== 'string' || txt.trim().toLowerCase() !== '!bluff') return;
            if (bluffByServer.has(srvId)) return;

            const players = getFullRoomPlayers(srvId);
            if (players.length < 2) return io.to(srvId).emit('message', { username: "Sammu's Bot", text: '⚠️ Need at least **2 players** for **🎭 Bluff Master**!', _serverId: srvId });

            const prompt = BLUFF_PROMPTS[Math.floor(Math.random() * BLUFF_PROMPTS.length)];
            const st = { players, prompt, phase: 'write', timeLeft: 20, answers: new Map(), votes: new Map(), interval: null };
            bluffByServer.set(srvId, st);
            st.interval = setInterval(() => {
                const c = bluffByServer.get(srvId);
                if (!c) return;
                c.timeLeft--;
                if (c.timeLeft <= 0) {
                    if (c.phase === 'write') startBluffVoting(srvId);
                    else finishBluffGame(srvId);
                } else broadcastBluff(srvId);
            }, 1000);

            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `🎭 **BLUFF MASTER STARTED!**\nPrompt: **${prompt}**\n*(Type your funniest reply in chat within 20s—it stays hidden until voting!)*`,
                _serverId: srvId
            });
            broadcastBluff(srvId);
        });

        socket.on('bluffVote', (authorId) => {
            const srvId = socket.activeServerId;
            const st = srvId ? bluffByServer.get(srvId) : null;
            if (!st || st.phase !== 'vote' || st.votes.has(socket.id) || authorId === socket.id) return;
            st.votes.set(socket.id, authorId);
            if (st.votes.size >= st.answers.size) finishBluffGame(srvId);
            else broadcastBluff(srvId);
        });
    });
    // === 🏝️ CASTAWAY ISLAND (!island) — SOCIAL SURVIVAL GAME (PIECE 3/3) ===
    const islandByServer = new Map();
    const ISLAND_EVENTS = [
        { name: '⛈️ Monsoon Storm!', foodLoss: 15, fireLoss: 30 },
        { name: '🐒 Hungry Monkey Raid!', foodLoss: 30, fireLoss: 10 },
        { name: '🥶 Freezing Ocean Wind!', foodLoss: 10, fireLoss: 35 },
        { name: '🐍 Jungle Snake Panic!', foodLoss: 25, fireLoss: 20 }
    ];

    const ISLAND_UI = `
    <div id="islandBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999998;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(6,78,59,0.96),rgba(120,53,15,0.96));border:2px solid #34d399;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(52,211,153,0.45);backdrop-filter:blur(6px);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span id="islDay" style="font-weight:900;font-size:11px;color:#6ee7b7;">🏝️ CASTAWAY ISLAND (DAY 1/4)</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="islTimer" style="font-size:11px;color:#fde047;font-weight:900;">⏳ 14s</span>
            <button onclick="document.getElementById('islandBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div style="display:flex;gap:6px;font-size:10px;font-weight:bold;margin-bottom:6px;">
          <div style="flex:1;background:#090d16;border:1px solid #4ade80;border-radius:8px;padding:4px;">🥥 Food: <b id="islFood" style="color:#4ade80;">60%</b></div>
          <div style="flex:1;background:#090d16;border:1px solid #f97316;border-radius:8px;padding:4px;">🔥 Campfire: <b id="islFire" style="color:#fb923c;">60%</b></div>
        </div>
        <div id="islActions" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;"></div>
      </div>
    </div>
    <script>
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
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('islandBar')) {
                body = body.replace('</body>', ISLAND_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });

    function broadcastIsland(srvId) {
        const st = islandByServer.get(srvId);
        if (!st) return;
        st.players.forEach(p => {
            io.to(p.id).emit('islandSync', {
                day: st.day, timeLeft: st.timeLeft, food: st.food, fire: st.fire,
                acted: st.acted.has(p.id), _serverId: srvId
            });
        });
    }

    function resolveIslandDay(srvId) {
        const st = islandByServer.get(srvId);
        if (!st) return;
        const ev = ISLAND_EVENTS[Math.floor(Math.random() * ISLAND_EVENTS.length)];
        st.food = Math.max(0, st.food - ev.foodLoss);
        st.fire = Math.max(0, st.fire - ev.fireLoss);
        st.acted.clear();

        if (st.food <= 0 || st.fire <= 0) {
            clearInterval(st.interval);
            islandByServer.delete(srvId);
            io.to(srvId).emit('islandEnd', { _serverId: srvId });
            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `💀🏝️ **ISLAND WIPEOUT!** **${ev.name}** hit and ${st.food <= 0 ? 'everyone starved!' : 'the campfire went out!'} (Too many people hoarded rations!)`,
                _serverId: srvId
            });
            return;
        }
        if (st.day >= 4) {
            clearInterval(st.interval);
            islandByServer.delete(srvId);
            io.to(srvId).emit('islandEnd', { _serverId: srvId });
            const rat = Object.entries(st.greedMap).sort((a, b) => b - a);
            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `🚁🎉 **RESCUE HELICOPTER ARRIVED!** The squad survived 4 days on Castaway Island!\n🐍 **Biggest Ration Hoarder:** **${rat ? rat : 'Nobody — Pure Teamwork!'}**`,
                _serverId: srvId
            });
            return;
        }
        st.day++;
        st.timeLeft = 14;
        io.to(srvId).emit('message', {
            username: "Sammu's Bot",
            text: `⚠️ **${ev.name}** struck! (-${ev.foodLoss}% Food, -${ev.fireLoss}% Fire) -> **Day ${st.day}/4** begins! Talk in chat so you don't run out!`,
            _serverId: srvId
        });
        broadcastIsland(srvId);
    }

    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const txt = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof txt !== 'string' || txt.trim().toLowerCase() !== '!island') return;
            if (islandByServer.has(srvId)) return;

            const players = getFullRoomPlayers(srvId);
            if (players.length < 2) return io.to(srvId).emit('message', { username: "Sammu's Bot", text: '⚠️ Need at least **2 players** for **🏝️ Castaway Island**!', _serverId: srvId });

            const st = { players, day: 1, food: 65, fire: 65, timeLeft: 14, acted: new Set(), greedMap: {}, interval: null };
            islandByServer.set(srvId, st);
            st.interval = setInterval(() => {
                const c = islandByServer.get(srvId);
                if (!c) return;
                c.timeLeft--;
                if (c.timeLeft <= 0) resolveIslandDay(srvId);
                else broadcastIsland(srvId);
            }, 1000);

            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `🏝️🔥 **CASTAWAY ISLAND STARTED!** Survive 4 Days! Coordinate in chat who gathers **🥥 Food** and who tends the **🔥 Fire**—watch out for ration hoarders!`,
                _serverId: srvId
            });
            broadcastIsland(srvId);
        });

        socket.on('islandAct', (move) => {
            const srvId = socket.activeServerId;
            const st = srvId ? islandByServer.get(srvId) : null;
            if (!st || st.acted.has(socket.id)) return;
            st.acted.add(socket.id);
            const uname = socket.username || 'Survivor';
            if (move === 'forage') st.food = Math.min(100, st.food + 22);
            else if (move === 'fire') st.fire = Math.min(100, st.fire + 22);
            else if (move === 'steal') {
                st.food = Math.max(0, st.food - 12);
                st.greedMap[uname] = (st.greedMap[uname] || 0) + 1;
            }
            if (st.acted.size >= st.players.length) resolveIslandDay(srvId);
            else broadcastIsland(srvId);
        });
    });
    const PARTY_ALL_IN_ONE_UI = `
    <div id="cleanRaidBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999999;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(49,16,66,0.97),rgba(15,23,42,0.97));border:2px solid #c084fc;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(192,132,252,0.5);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <span style="font-weight:900;font-size:11px;color:#e879f9;">🐉 SHADOW DRAGON RAID</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="cRaidTimer" style="font-size:11px;color:#fde047;font-weight:900;">⏳ 12s</span>
            <button onclick="document.getElementById('cleanRaidBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div style="display:flex;gap:6px;font-size:10px;font-weight:bold;margin-bottom:6px;">
          <div style="flex:1;background:#090d16;border:1px solid #4ade80;border-radius:8px;padding:4px;">❤️ Squad HP: <b id="cRaidTeamHp" style="color:#4ade80;">100%</b></div>
          <div style="flex:1;background:#090d16;border:1px solid #f43f5e;border-radius:8px;padding:4px;">🐉 Boss: <b id="cRaidBossHp" style="color:#fda4af;">3000</b></div>
        </div>
        <div id="cRaidActions" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;"></div>
      </div>
    </div>

    <div id="cleanHeistBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999999;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(6,78,59,0.97),rgba(15,23,42,0.97));border:2px solid #facc15;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(250,204,21,0.45);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <span id="cHeistRound" style="font-weight:900;font-size:11px;color:#fde047;">🏦 MEGA BANK HEIST (1/4)</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="cHeistTimer" style="font-size:11px;color:#38bdf8;font-weight:900;">⏳ 12s</span>
            <button onclick="document.getElementById('cleanHeistBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div style="display:flex;gap:6px;font-size:10px;font-weight:bold;margin-bottom:6px;">
          <div style="flex:1;background:#090d16;border:1px solid #facc15;border-radius:8px;padding:4px;">💰 Loot: <b id="cHeistLoot" style="color:#fde047;">$0</b></div>
          <div style="flex:1;background:#090d16;border:1px solid #ef4444;border-radius:8px;padding:4px;">🚨 Heat: <b id="cHeistHeat" style="color:#f87171;">0%</b></div>
        </div>
        <div id="cHeistActions" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;"></div>
      </div>
    </div>

    <div id="cleanBluffBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999999;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(88,28,135,0.97),rgba(15,23,42,0.97));border:2px solid #f472b6;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(244,114,182,0.5);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-weight:900;font-size:11px;color:#f9a8d4;">🎭 BLUFF MASTER</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="cBluffTimer" style="font-size:11px;color:#fde047;font-weight:900;">⏳ 20s</span>
            <button onclick="document.getElementById('cleanBluffBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div id="cBluffPrompt" style="background:rgba(244,114,182,0.2);border:1px solid #f472b6;border-radius:9px;padding:6px;margin-bottom:6px;font-size:12px;font-weight:900;color:#fde047;">Loading...</div>
        <div id="cBluffSub" style="font-size:11px;color:#cbd5e1;">✍️ Type your funny answer in normal chat now!</div>
        <div id="cBluffGrid" style="display:flex;flex-direction:column;gap:5px;margin-top:6px;max-height:140px;overflow-y:auto;"></div>
      </div>
    </div>

    <div id="cleanIslandBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999999;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(6,78,59,0.97),rgba(120,53,15,0.97));border:2px solid #34d399;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(52,211,153,0.45);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span id="cIslDay" style="font-weight:900;font-size:11px;color:#6ee7b7;">🏝️ CASTAWAY ISLAND (DAY 1/4)</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="cIslTimer" style="font-size:11px;color:#fde047;font-weight:900;">⏳ 14s</span>
            <button onclick="document.getElementById('cleanIslandBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div style="display:flex;gap:6px;font-size:10px;font-weight:bold;margin-bottom:6px;">
          <div style="flex:1;background:#090d16;border:1px solid #4ade80;border-radius:8px;padding:4px;">🥥 Food: <b id="cIslFood" style="color:#4ade80;">60%</b></div>
          <div style="flex:1;background:#090d16;border:1px solid #f97316;border-radius:8px;padding:4px;">🔥 Fire: <b id="cIslFire" style="color:#fb923c;">60%</b></div>
        </div>
        <div id="cIslActions" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;"></div>
      </div>
    </div>
    <script>
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
    </script>
    `;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('cleanRaidBar')) {
                body = body.replace('</body>', PARTY_ALL_IN_ONE_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // === GUARANTEED SOCKET-DELIVERED UI FOR #30, #31, #32, #33 (PIECE 1/2) ===
    const LIVE_PARTY_BUNDLE = `
    <div id="cleanRaidBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999999;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(49,16,66,0.97),rgba(15,23,42,0.97));border:2px solid #c084fc;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(192,132,252,0.5);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <span style="font-weight:900;font-size:11px;color:#e879f9;">🐉 SHADOW DRAGON RAID</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="cRaidTimer" style="font-size:11px;color:#fde047;font-weight:900;">⏳ 12s</span>
            <button onclick="document.getElementById('cleanRaidBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div style="display:flex;gap:6px;font-size:10px;font-weight:bold;margin-bottom:6px;">
          <div style="flex:1;background:#090d16;border:1px solid #4ade80;border-radius:8px;padding:4px;">❤️ Squad HP: <b id="cRaidTeamHp" style="color:#4ade80;">100%</b></div>
          <div style="flex:1;background:#090d16;border:1px solid #f43f5e;border-radius:8px;padding:4px;">🐉 Boss: <b id="cRaidBossHp" style="color:#fda4af;">3000</b></div>
        </div>
        <div id="cRaidActions" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;"></div>
      </div>
    </div>
    <div id="cleanHeistBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999999;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(6,78,59,0.97),rgba(15,23,42,0.97));border:2px solid #facc15;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(250,204,21,0.45);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <span id="cHeistRound" style="font-weight:900;font-size:11px;color:#fde047;">🏦 MEGA BANK HEIST (1/4)</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="cHeistTimer" style="font-size:11px;color:#38bdf8;font-weight:900;">⏳ 12s</span>
            <button onclick="document.getElementById('cleanHeistBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div style="display:flex;gap:6px;font-size:10px;font-weight:bold;margin-bottom:6px;">
          <div style="flex:1;background:#090d16;border:1px solid #facc15;border-radius:8px;padding:4px;">💰 Loot: <b id="cHeistLoot" style="color:#fde047;">$0</b></div>
          <div style="flex:1;background:#090d16;border:1px solid #ef4444;border-radius:8px;padding:4px;">🚨 Heat: <b id="cHeistHeat" style="color:#f87171;">0%</b></div>
        </div>
        <div id="cHeistActions" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;"></div>
      </div>
    </div>
    <div id="cleanBluffBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999999;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(88,28,135,0.97),rgba(15,23,42,0.97));border:2px solid #f472b6;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(244,114,182,0.5);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-weight:900;font-size:11px;color:#f9a8d4;">🎭 BLUFF MASTER</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="cBluffTimer" style="font-size:11px;color:#fde047;font-weight:900;">⏳ 20s</span>
            <button onclick="document.getElementById('cleanBluffBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div id="cBluffPrompt" style="background:rgba(244,114,182,0.2);border:1px solid #f472b6;border-radius:9px;padding:6px;margin-bottom:6px;font-size:12px;font-weight:900;color:#fde047;">Loading...</div>
        <div id="cBluffSub" style="font-size:11px;color:#cbd5e1;">✍️ Type your funny answer in normal chat now!</div>
        <div id="cBluffGrid" style="display:flex;flex-direction:column;gap:5px;margin-top:6px;max-height:140px;overflow-y:auto;"></div>
      </div>
    </div>
    <div id="cleanIslandBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999999;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(6,78,59,0.97),rgba(120,53,15,0.97));border:2px solid #34d399;border-radius:16px;padding:10px 12px;width:100%;max-width:375px;color:#fff;text-align:center;box-shadow:0 6px 24px rgba(52,211,153,0.45);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span id="cIslDay" style="font-weight:900;font-size:11px;color:#6ee7b7;">🏝️ CASTAWAY ISLAND (DAY 1/4)</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="cIslTimer" style="font-size:11px;color:#fde047;font-weight:900;">⏳ 14s</span>
            <button onclick="document.getElementById('cleanIslandBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div style="display:flex;gap:6px;font-size:10px;font-weight:bold;margin-bottom:6px;">
          <div style="flex:1;background:#090d16;border:1px solid #4ade80;border-radius:8px;padding:4px;">🥥 Food: <b id="cIslFood" style="color:#4ade80;">60%</b></div>
          <div style="flex:1;background:#090d16;border:1px solid #f97316;border-radius:8px;padding:4px;">🔥 Fire: <b id="cIslFire" style="color:#fb923c;">60%</b></div>
        </div>
        <div id="cIslActions" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;"></div>
      </div>
    </div>`;

    io.on('connection', (socket) => {
        socket.on('joinRoom', () => {
            setTimeout(() => {
                socket.emit('injectPartyBundle', LIVE_PARTY_BUNDLE);
            }, 700);
        });
    });
    // === GUARANTEED SOCKET-DELIVERED UI (PIECE 2/2) ===
    const SOCKET_UI_BOOT = `
    <script>
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
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('bootSocketPartyUI')) {
                body = body.replace('</body>', SOCKET_UI_BOOT + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
          if (global.OG_HOSTS) global.OG_HOSTS.add("antim");
    if (Array.isArray(global.AI_BLUFF_BANK)) {
        const p = global.AI_BLUFF_BANK.push.bind(global.AI_BLUFF_BANK);
        global.AI_BLUFF_BANK.forEach(x => { if (!BLUFF_PROMPTS.includes(x)) BLUFF_PROMPTS.push(x); });
        global.AI_BLUFF_BANK.push = (...a) => { a.forEach(x => { if (!BLUFF_PROMPTS.includes(x)) BLUFF_PROMPTS.push(x); }); return p(...a); };
    }
    if (Array.isArray(global.AI_IMPOSTER_BANK)) {
        const p = global.AI_IMPOSTER_BANK.push.bind(global.AI_IMPOSTER_BANK);
        global.AI_IMPOSTER_BANK.forEach(x => { if (!IMPOSTER_WORDS.includes(x)) IMPOSTER_WORDS.push(x); });
        global.AI_IMPOSTER_BANK.push = (...a) => { a.forEach(x => { if (!IMPOSTER_WORDS.includes(x)) IMPOSTER_WORDS.push(x); }); return p(...a); };
    }
    if (Array.isArray(global.AI_MULTI_ANIME_BANK)) {
        const p = global.AI_MULTI_ANIME_BANK.push.bind(global.AI_MULTI_ANIME_BANK);
        global.AI_MULTI_ANIME_BANK.forEach(x => EXTRA_ANIME_QUIZ.push(x));
        global.AI_MULTI_ANIME_BANK.push = (...a) => { a.forEach(x => EXTRA_ANIME_QUIZ.push(x)); return p(...a); };
    }

    const SERVER_WP_PACK = `
    <style>
      .srv-card.pokemon { border-color:#facc15; background:linear-gradient(90deg,rgba(220,38,38,0.35),rgba(250,204,21,0.25)); box-shadow:0 0 15px rgba(250,204,21,0.4); }
      body.wp-pokemon { background: radial-gradient(circle at 50% 18%, #dc2626 0%, #991b1b 32%, #f8fafc 33%, #f8fafc 36%, #1e293b 37%, #090d16 100%) !important; }
      body.wp-cute-babies { background: linear-gradient(160deg, #fbcfe8 0%, #ddd6fe 50%, #bae6fd 100%) !important; }
      body.wp-royal-queen { background: radial-gradient(circle at top, #831843 0%, #4c0519 45%, #1e1b4b 100%) !important; }
      body.wp-cyber-aurora { background: radial-gradient(circle at 20% 20%, #0e7490 0%, #1e1b4b 50%, #090d16 100%) !important; }
      body.wp-golden-empire { background: linear-gradient(155deg, #422006 0%, #713f12 45%, #0f172a 100%) !important; }
      body.wp-emerald-matrix { background: radial-gradient(circle at center, #064e3b 0%, #022c22 55%, #050a08 100%) !important; }
      body.wp-crimson-dragon { background: linear-gradient(160deg, #7f1d1d 0%, #450a0a 50%, #0f172a 100%) !important; }
      body.wp-diamond-frost { background: linear-gradient(145deg, #083344 0%, #1d4ed8 45%, #311042 100%) !important; }
      #wpFloatingBadge { position:fixed; bottom:54px; right:12px; z-index:99990; background:rgba(15,23,42,0.85); border:1.5px solid #38bdf8; color:#fff; padding:5px 10px; border-radius:999px; font-size:11px; font-weight:bold; pointer-events:none; display:none; }
    </style>
    <div id="wpFloatingBadge"></div>
    <script>
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
        const btn = Array.from(document.querySelectorAll('button')).find(b => /🌌\s*wp|\bwp\b/i.test(b.textContent || ''));
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
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('wpFloatingBadge')) {
                body = body.replace('</body>', SERVER_WP_PACK + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // === 🃏 PIECE 1/2: TRADING CARD GACHA & BOUNTY HUNT CORE ===
    const CARD_POOL = [
        { name: "⚡ Pikachu Spark", tier: "COMMON", power: 72, c1: "#854d0e", c2: "#facc15", emoji: "⚡🐭" },
        { name: "🍥 Naruto Rasengan", tier: "COMMON", power: 78, c1: "#9a3412", c2: "#fb923c", emoji: "🍥🦊" },
        { name: "🔥 Charmander Blaze", tier: "COMMON", power: 74, c1: "#7f1d1d", c2: "#f87171", emoji: "🔥🦎" },
        { name: "🗡️ Tanjiro Water Slash", tier: "COMMON", power: 79, c1: "#065f46", c2: "#34d399", emoji: "🌊🗡️" },
        { name: "⚔️ 3-Sword Roronoa Zoro", tier: "EPIC", power: 91, c1: "#064e3b", c2: "#10b981", emoji: "⚔️🐉" },
        { name: "🤞 Gojo Unlimited Void", tier: "EPIC", power: 94, c1: "#1e1b4b", c2: "#38bdf8", emoji: "🤞🌌" },
        { name: "🐉 Mega Charizard X", tier: "EPIC", power: 93, c1: "#1e293b", c2: "#3b82f6", emoji: "🐉🔥" },
        { name: "👁️ Itachi Tsukuyomi", tier: "EPIC", power: 92, c1: "#450a0a", c2: "#ef4444", emoji: "👁️🦅" },
        { name: "👒 Gear 5 Sun God Luffy", tier: "MYTHIC", power: 99, c1: "#581c87", c2: "#facc15", emoji: "👒⚡" },
        { name: "👑 Shadow Monarch Jinwoo", tier: "MYTHIC", power: 98, c1: "#090d16", c2: "#a855f7", emoji: "👑🗡️" },
        { name: "⚡ Mewtwo Cosmic Psy", tier: "MYTHIC", power: 97, c1: "#311042", c2: "#f472b6", emoji: "🧬🔮" },
        { name: "💎 OG Host: Sammu Supreme", tier: "MYTHIC", power: 100, c1: "#083344", c2: "#67e8f9", emoji: "💎👑" },
        { name: "🌿 OG Host: Dr. Moon Vaidya", tier: "MYTHIC", power: 100, c1: "#064e3b", c2: "#fde047", emoji: "🌙🌿" },
        { name: "⚡ OG Host: Antim PokéKing", tier: "MYTHIC", power: 100, c1: "#7f1d1d", c2: "#facc15", emoji: "⚡🏆" }
    ];

    const playerWallet = new Map();
    const playerCards = new Map();
    const activeBounties = new Map();
    const serverWinStreaks = new Map();

    function getCoins(uname) {
        const k = uname.toLowerCase();
        if (!playerWallet.has(k)) playerWallet.set(k, 150);
        return playerWallet.get(k);
    }
    function addCoins(uname, amt) {
        const k = uname.toLowerCase();
        playerWallet.set(k, Math.max(0, getCoins(k) + amt));
        return playerWallet.get(k);
    }

    const GACHA_FLEX_SCRIPT = `
    <script>
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
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('renderFlexCard')) {
                body = body.replace('</body>', GACHA_FLEX_SCRIPT + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // === 🚨 PIECE 2/2: BOUNTY PAYOUTS & CHAT COMMANDS ===
    const _prevIoEmit = io.emit.bind(io);
    io.emit = function(event, ...args) {
        const payload = args.at(0);
        if (event === 'announceWinner' && payload && typeof payload === 'object' && payload.winner) {
            const srvId = payload._serverId || ctx.lastActiveServerId;
            const winRaw = String(payload.winner);
            const arena = srvId ? getArena(srvId) : null;
            const matchedPlayer = (arena && Array.isArray(arena.players))
                ? arena.players.find(p => winRaw.toLowerCase().includes(p.username.toLowerCase()))
                : null;
            if (matchedPlayer && srvId) {
                const wName = matchedPlayer.username;
                const wKey = wName.toLowerCase();
                const bal = addCoins(wName, 50);

                const opp = (arena.captainA && arena.captainA.username.toLowerCase() === wKey) ? arena.captainB : arena.captainA;
                if (opp && activeBounties.has(opp.username.toLowerCase())) {
                    const reward = activeBounties.get(opp.username.toLowerCase());
                    activeBounties.delete(opp.username.toLowerCase());
                    const newBal = addCoins(wName, reward);
                    setTimeout(() => {
                        io.to(srvId).emit('message', {
                            username: "Sammu's Bot",
                            text: `💀💰 **BOUNTY CLAIMED!!** **${wName}** defeated **${opp.username}** and stole the **+${reward}🪙 Bounty**! (Balance: **${newBal}🪙**)`,
                            _serverId: srvId
                        });
                    }, 600);
                }

                const st = (serverWinStreaks.get(wKey) || 0) + 1;
                serverWinStreaks.set(wKey, st);
                if (opp) serverWinStreaks.set(opp.username.toLowerCase(), 0);

                if (st === 3 && !activeBounties.has(wKey)) {
                    activeBounties.set(wKey, 200);
                    setTimeout(() => {
                        io.to(srvId).emit('message', {
                            username: "Sammu's Bot",
                            text: `🚨🔥 **AUTO-BOUNTY!** **${wName}** hit a **3x Win Streak**! **200🪙 Bounty** placed on their head!`,
                            _serverId: srvId
                        });
                    }, 800);
                } else {
                    setTimeout(() => {
                        io.to(srvId).emit('message', {
                            username: "Sammu's Bot",
                            text: `🪙 **${wName}** earned **+50 Coins** (Total: **${bal}🪙**)! Type \`!pack\` to open cards!`,
                            _serverId: srvId
                        });
                    }, 550);
                }
            }
        }
        return _prevIoEmit(event, ...args);
    };

    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof raw !== 'string') return;
            const clean = raw.trim();
            const low = clean.toLowerCase();
            const sender = socket.username || (payload && payload.username) || 'Player';
            const sKey = sender.toLowerCase();

            if (low === '!pack') {
                const bal = getCoins(sender);
                if (bal < 100) {
                    socket.emit('message', { username: "Sammu's Bot", text: `🪙 Need **100 Coins** (You have **${bal}🪙**). Win matches to earn +50🪙!`, _serverId: srvId });
                    return;
                }
                const left = addCoins(sender, -100);
                const roll = Math.random();
                const tier = roll < 0.14 ? 'MYTHIC' : (roll < 0.48 ? 'EPIC' : 'COMMON');
                const pool = CARD_POOL.filter(c => c.tier === tier);
                const pulled = pool[Math.floor(Math.random() * pool.length)];

                if (!playerCards.has(sKey)) playerCards.set(sKey, []);
                playerCards.get(sKey).push(pulled);

                const badge = tier === 'MYTHIC' ? '🌈✨ **MYTHIC PULL!!**' : (tier === 'EPIC' ? '💜🔥 **EPIC PULL!**' : '🃏 **Card Pulled:**');
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `${badge} **${sender}** unboxed **${pulled.emoji} ${pulled.name}** (PWR **${pulled.power}**)! (${left}🪙 left) — Type \`!flex\`!`,
                    _serverId: srvId
                });
            }

            if (low === '!cards') {
                const deck = playerCards.get(sKey) || [];
                const bal = getCoins(sender);
                if (deck.length === 0) {
                    socket.emit('message', { username: "Sammu's Bot", text: `🃏 **${sender}** has **0 cards** (${bal}🪙). Type \`!pack\` (100🪙)!`, _serverId: srvId });
                } else {
                    const list = deck.slice(-8).map(c => `${c.emoji} **${c.name}** [${c.tier}]`).join(' • ');
                    socket.emit('message', { username: "Sammu's Bot", text: `🃏 **${sender}'s Deck (${deck.length} | ${bal}🪙):**\n${list}\n*(Type \`!flex\` to show your best card!)*`, _serverId: srvId });
                }
            }

            if (low === '!flex') {
                const deck = playerCards.get(sKey) || [];
                if (deck.length === 0) {
                    socket.emit('message', { username: "Sammu's Bot", text: `⚠️ Open a pack with \`!pack\` first!`, _serverId: srvId });
                    return;
                }
                const best = [...deck].sort((a, b) => b.power - a.power)[0];
                io.to(srvId).emit('renderFlexCard', { card: best, ownerName: sender, ownerSocket: socket.id, _serverId: srvId });
            }

            if (low.startsWith('!bounty ')) {
                const parts = clean.slice(8).replace('@', '').trim().split(/\s+/);
                const targetName = parts[0];
                const amt = Math.max(50, Math.min(1000, parseInt(parts[1], 10) || 100));
                if (!targetName || targetName.toLowerCase() === sKey) return;
                if (getCoins(sender) < amt) {
                    socket.emit('message', { username: "Sammu's Bot", text: `🪙 Not enough coins! Balance: **${getCoins(sender)}🪙**.`, _serverId: srvId });
                    return;
                }
                addCoins(sender, -amt);
                const tKey = targetName.toLowerCase();
                const totalBounty = (activeBounties.get(tKey) || 0) + amt;
                activeBounties.set(tKey, totalBounty);
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `🚨💀 **BOUNTY PLACED!** **${sender}** put **${amt}🪙** on **${targetName}**! (Total: **${totalBounty}🪙**) Beat them in 1v1 to steal it!`,
                    _serverId: srvId
                });
            }

            if (low === '!bounties') {
                if (activeBounties.size === 0) {
                    socket.emit('message', { username: "Sammu's Bot", text: `📜 No active bounties! Type \`!bounty <name> 100\` to hunt someone!`, _serverId: srvId });
                } else {
                    const list = Array.from(activeBounties.entries()).map(([n, c]) => `💀 **${n.toUpperCase()}**: **${c}🪙**`).join(' | ');
                    io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🚨 **WANTED BOARD:** ${list}`, _serverId: srvId });
                }
            }
        });
    });
    // === 📅 PIECE 1/2: DAILY STREAK (!daily) & CARD DUEL (!duelcard) ===
    const dailyClaims = new Map();
    const pendingCardDuels = new Map();

    function resolveCardClash(srvId, p1Name, p2Name, bet) {
        const d1 = [...(playerCards.get(p1Name.toLowerCase()) || [])].sort((a, b) => b.power - a.power).slice(0, 3);
        const d2 = [...(playerCards.get(p2Name.toLowerCase()) || [])].sort((a, b) => b.power - a.power).slice(0, 3);

        let w1 = 0, w2 = 0;
        const lines = [];
        for (let i = 0; i < 3; i++) {
            const c1 = d1[i] || { emoji: "🃏", name: "Rookie Recruit", power: 50 };
            const c2 = d2[i] || { emoji: "🃏", name: "Rookie Recruit", power: 50 };
            const roll1 = c1.power + Math.floor(Math.random() * 14);
            const roll2 = c2.power + Math.floor(Math.random() * 14);
            if (roll1 >= roll2) {
                w1++;
                lines.push(`R${i + 1}: ${c1.emoji} **${c1.name}** (${roll1}) ⚔️ beats ${c2.emoji} ${c2.name} (${roll2})`);
            } else {
                w2++;
                lines.push(`R${i + 1}: ${c2.emoji} **${c2.name}** (${roll2}) ⚔️ beats ${c1.emoji} ${c1.name} (${roll1})`);
            }
        }

        const champ = w1 > w2 ? p1Name : p2Name;
        const totalPot = bet * 2;
        const newBal = addCoins(champ, totalPot);

        io.to(srvId).emit('message', {
            username: "Sammu's Bot",
            text: `🃏⚔️ **CARD BATTLE RESULTS (${p1Name} vs ${p2Name}):**\n${lines.join('\n')}\n🏆 **WINNER:** **${champ}** won **+${totalPot}🪙**! (Balance: **${newBal}🪙**)`,
            _serverId: srvId
        });
    }
      // === ⚔️ PIECE 2/2: DAILY & CARD BATTLE LISTENERS ===
    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof raw !== 'string') return;
            const clean = raw.trim();
            const low = clean.toLowerCase();
            const sender = socket.username || (payload && payload.username) || 'Player';
            const sKey = sender.toLowerCase();

            // 1. Daily Streak Reward (!daily)
            if (low === '!daily') {
                const now = Date.now();
                const dayMs = 24 * 60 * 60 * 1000;
                const rec = dailyClaims.get(sKey) || { last: 0, streak: 0 };

                if (now - rec.last < dayMs) {
                    const hrsLeft = Math.ceil((dayMs - (now - rec.last)) / (60 * 60 * 1000));
                    socket.emit('message', { username: "Sammu's Bot", text: `⏳ **${sender}**, you already claimed your Daily! Come back in **${hrsLeft}h** (Current Streak: **${rec.streak}🔥**).`, _serverId: srvId });
                    return;
                }

                const streak = (now - rec.last < dayMs * 2) ? (rec.streak % 7) + 1 : 1;
                dailyClaims.set(sKey, { last: now, streak });
                const reward = 100 + (streak * 25);
                const bal = addCoins(sender, reward);

                if (streak === 7) {
                    const mythics = CARD_POOL.filter(c => c.tier === 'MYTHIC');
                    const bonusCard = mythics[Math.floor(Math.random() * mythics.length)];
                    if (!playerCards.has(sKey)) playerCards.set(sKey, []);
                    playerCards.get(sKey).push(bonusCard);
                    io.to(srvId).emit('message', {
                        username: "Sammu's Bot",
                        text: `🎉🔥 **DAY 7 MEGA STREAK!!** **${sender}** claimed **+${reward}🪙** (${bal}🪙 total) PLUS a **FREE MYTHIC CARD: ${bonusCard.emoji} ${bonusCard.name}**! 🌈👑`,
                        _serverId: srvId
                    });
                } else {
                    io.to(srvId).emit('message', {
                        username: "Sammu's Bot",
                        text: `📅🔥 **DAILY REWARD (Day ${streak}/7)!** **${sender}** claimed **+${reward}🪙**! (Balance: **${bal}🪙** | Hit Day 7 for a FREE Mythic Card!)`,
                        _serverId: srvId
                    });
                }
            }

            // 2. Challenge Someone to a 3-Card Battle (!duelcard <name> [bet])
            if (low.startsWith('!duelcard ')) {
                const parts = clean.slice(10).replace('@', '').trim().split(/\s+/);
                const targetName = parts;
                const bet = Math.max(50, Math.min(500, parseInt(parts, 10) || 100));
                if (!targetName || targetName.toLowerCase() === sKey) return;

                if ((playerCards.get(sKey) || []).length === 0) {
                    socket.emit('message', { username: "Sammu's Bot", text: `⚠️ Open at least 1 pack with \`!pack\` before battling!`, _serverId: srvId });
                    return;
                }
                if (getCoins(sender) < bet) {
                    socket.emit('message', { username: "Sammu's Bot", text: `🪙 Need **${bet}🪙** to start this Card Duel (You have **${getCoins(sender)}🪙**).`, _serverId: srvId });
                    return;
                }

                pendingCardDuels.set(targetName.toLowerCase(), { challenger: sender, bet, srvId, expires: Date.now() + 45000 });
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `🃏⚔️ **CARD DUEL CHALLENGE!** **${sender}** challenged **${targetName}** to a 3-Round Deck Battle for **${bet}🪙**!\n👉 **${targetName}**, type \`!acceptcard\` within 45s to fight!`,
                    _serverId: srvId
                });
            }

            // 3. Accept Card Battle (!acceptcard)
            if (low === '!acceptcard') {
                const duel = pendingCardDuels.get(sKey);
                if (!duel || duel.srvId !== srvId || Date.now() > duel.expires) {
                    socket.emit('message', { username: "Sammu's Bot", text: `⚠️ No active Card Duel challenge for you right now!`, _serverId: srvId });
                    return;
                }
                if (getCoins(sender) < duel.bet || getCoins(duel.challenger) < duel.bet) {
                    pendingCardDuels.delete(sKey);
                    socket.emit('message', { username: "Sammu's Bot", text: `🪙 One of the players no longer has **${duel.bet}🪙** for the wager!`, _serverId: srvId });
                    return;
                }
                pendingCardDuels.delete(sKey);
                addCoins(duel.challenger, -duel.bet);
                addCoins(sender, -duel.bet);
                resolveCardClash(srvId, duel.challenger, sender, duel.bet);
            }
        });
    });
    // === ⚖️ #35 COURTROOM CHAOS — PART 1/2 (CASES & UI) ===
    const courtByServer = new Map();
    const COURT_CASES = [
        "stealing the Host's Wi-Fi and still blaming 'lag' after losing in 2 seconds!",
        "eating everyone's Biryani in the lobby and blaming Tommy the Dog!",
        "faking a low-battery disconnect right before losing a 1v1 duel!",
        "using a calculator during Math Blitz and still getting the wrong answer!",
        "camping in a corner during 3D Survive the Killer for 60 seconds straight!",
        "secretly simping in chat while pretending to be a Sigma Chad!",
        "putting a fake bounty on their own best friend just to start drama!",
        "stealing Mochi the Cat's golden crown and hiding it under the sofa!",
        "typing 'EZ' in chat after getting carried by their teammate!",
        "hoarding all the coconuts on Castaway Island while everyone starved!",
        "opening 5 Mystery Boxes and getting cursed with Clown Mode every time!",
        "claiming to be the Pro of the server with a 0% win streak!",
        "bribery of the Judge with a virtual samosa before the match started!",
        "forgetting to pass the bomb in Bomb Pass because they were busy flexing cards!",
        "starting a fake rumor in Word Imposter to get an innocent player voted out!"
    ];

    const COURT_UI = `
    <div id="courtBar" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999999;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(69,26,3,0.97),rgba(15,23,42,0.97));border:2px solid #f59e0b;border-radius:16px;padding:10px 12px;width:100%;max-width:385px;color:#fff;text-align:center;box-shadow:0 6px 26px rgba(245,158,11,0.55);backdrop-filter:blur(6px);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-weight:900;font-size:11px;color:#fbbf24;">⚖️ SAMMU SUPREME COURT</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="courtTimer" style="font-size:11px;color:#38bdf8;font-weight:900;">⏳ 30s</span>
            <button onclick="document.getElementById('courtBar').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
          </div>
        </div>
        <div id="courtMatchup" style="font-size:11px;font-weight:bold;color:#fde047;margin-bottom:4px;">😈 Accused vs 🕵️ Prosecutor</div>
        <div id="courtCharge" style="background:rgba(245,158,11,0.18);border:1px solid #fbbf24;border-radius:8px;padding:5px 7px;margin-bottom:6px;font-size:11px;color:#fef3c7;">Charge loading...</div>
        <div id="courtControls" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;"></div>
      </div>
    </div>
    <script>
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
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('courtBar')) {
                body = body.replace('</body>', COURT_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // === ⚖️ #35 COURTROOM CHAOS — PART 2/2 (ENGINE & SOCKET EVENTS) ===
    function broadcastCourt(srvId) {
        const st = courtByServer.get(srvId);
        if (!st) return;
        st.players.forEach(p => {
            let myRole = 'JURY';
            if (p.id === st.judge.id) myRole = 'JUDGE';
            else if (p.id === st.accused.id) myRole = 'ACCUSED';
            else if (p.id === st.prosecutor.id) myRole = 'PROSECUTOR';

            io.to(p.id).emit('courtSync', {
                phase: st.phase,
                timeLeft: st.timeLeft,
                charge: st.charge,
                judgeName: st.judge.username,
                accusedName: st.accused.username,
                prosecutorName: st.prosecutor.username,
                myRole,
                voted: st.votes.has(p.id),
                voteCount: st.votes.size,
                _serverId: srvId
            });
        });
    }

    function finishCourt(srvId) {
        const st = courtByServer.get(srvId);
        if (!st) return;
        clearInterval(st.interval);
        courtByServer.delete(srvId);
        io.to(srvId).emit('courtEnd', { _serverId: srvId });

        let guilty = 0, innocent = 0;
        for (const v of st.votes.values()) {
            if (v === 'GUILTY') guilty++;
            else innocent++;
        }

        const isGuilty = guilty > innocent;
        const winner = isGuilty ? st.prosecutor.username : st.accused.username;
        const newBal = addCoins(winner, 150);

        io.to(srvId).emit('message', {
            username: "Sammu's Bot",
            text: `🔨⚖️ **COURT VERDICT IS IN!** (Guilty: **${guilty}** vs Innocent: **${innocent}**)\n` +
                  (isGuilty
                      ? `🚨 **GUILTY!!** Prosecutor **${st.prosecutor.username}** destroyed **${st.accused.username}** in court and won **+150🪙** (Total: **${newBal}🪙**)! ⛓️😂`
                      : `😇 **NOT GUILTY!!** **${st.accused.username}** talked their way out of jail and won **+150🪙** (Total: **${newBal}🪙**)! 🏆🔥`),
            _serverId: srvId
        });
    }

    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const txt = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof txt !== 'string' || txt.trim().toLowerCase() !== '!court') return;
            if (courtByServer.has(srvId)) return;

            const roomPlayers = getFullRoomPlayers(srvId);
            if (roomPlayers.length < 3) {
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: '⚠️ Need at least **3 players** (Judge, Accused, Prosecutor/Jury) for **⚖️ Courtroom Chaos**!',
                    _serverId: srvId
                });
                return;
            }

            const arena = getArena(srvId);
            const judge = roomPlayers.find(p => p.id === arena.hostId || p.isHost) || roomPlayers[0];
            const others = roomPlayers.filter(p => p.id !== judge.id).sort(() => Math.random() - 0.5);
            const accused = others[0];
            const prosecutor = others[1];
            const charge = COURT_CASES[Math.floor(Math.random() * COURT_CASES.length)];

            const st = {
                players: roomPlayers,
                judge,
                accused,
                prosecutor,
                charge,
                phase: 'debate',
                timeLeft: 30,
                votes: new Map(),
                interval: null
            };
            courtByServer.set(srvId, st);

            st.interval = setInterval(() => {
                const c = courtByServer.get(srvId);
                if (!c) return;
                c.timeLeft--;
                if (c.timeLeft <= 0) {
                    if (c.phase === 'debate') {
                        c.phase = 'vote';
                        c.timeLeft = 15;
                        io.to(srvId).emit('message', {
                            username: "Sammu's Bot",
                            text: '🗳️ **DEBATE OVER! JURY VOTING OPEN!** Tap **😇 INNOCENT** or **😈 GUILTY** in the top bar!',
                            _serverId: srvId
                        });
                        broadcastCourt(srvId);
                    } else {
                        finishCourt(srvId);
                    }
                } else {
                    broadcastCourt(srvId);
                }
            }, 1000);

            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `⚖️🔨 **COURT IS IN SESSION!**\n👨‍⚖️ **Judge:** **${judge.username}**\n😈 **Accused:** **${accused.username}** (Charged with *${charge}*)\n🕵️ **Prosecutor:** **${prosecutor.username}**\n🗣️ Argue in chat for 30s—everyone else is the Jury!`,
                _serverId: srvId
            });
            broadcastCourt(srvId);
        });

        socket.on('judgeAction', (act) => {
            const srvId = socket.activeServerId;
            const st = srvId ? courtByServer.get(srvId) : null;
            if (!st || socket.id !== st.judge.id) return;

            if (act === 'gavel') {
                st.timeLeft += 10;
                io.to(srvId).emit('message', { username: "👨‍⚖️ Judge " + st.judge.username, text: '🔨 **ORDER IN THE COURT!** Judge added **+10 seconds** to the debate!', _serverId: srvId });
                broadcastCourt(srvId);
            } else if (act === 'objection') {
                const target = Math.random() < 0.5 ? st.accused : st.prosecutor;
                addCoins(target.username, -30);
                io.to(srvId).emit('message', { username: "👨‍⚖️ Judge " + st.judge.username, text: `🚨 **OBJECTION SUSTAINED!** **${target.username}** was fined **-30🪙** for Contempt of Court! 😂`, _serverId: srvId });
            } else if (act === 'voteNow' && st.phase === 'debate') {
                st.phase = 'vote';
                st.timeLeft = 15;
                io.to(srvId).emit('message', { username: "👨‍⚖️ Judge " + st.judge.username, text: '⚖️ **SILENCE!** Judge closed the debate early—**JURY VOTE NOW!**', _serverId: srvId });
                broadcastCourt(srvId);
            }
        });

        socket.on('courtVote', (choice) => {
            const srvId = socket.activeServerId;
            const st = srvId ? courtByServer.get(srvId) : null;
            if (!st || st.phase !== 'vote') return;
            if (socket.id === st.accused.id || socket.id === st.prosecutor.id) return;
            if (st.votes.has(socket.id)) return;

            st.votes.set(socket.id, choice === 'GUILTY' ? 'GUILTY' : 'INNOCENT');
            const eligibleVoters = st.players.filter(p => p.id !== st.accused.id && p.id !== st.prosecutor.id).length;
            if (st.votes.size >= eligibleVoters) {
                finishCourt(srvId);
            } else {
                broadcastCourt(srvId);
            }
        });
    });
                

                
       // ============================================================================

    Object.assign(ctx, { getFullRoomPlayers, getCoins, addCoins, playerWallet, playerCards });
};
