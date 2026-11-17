const fs = require('fs');
const path = require('path');

module.exports = function initAvatarArmory(app, io, helpers) {
    const { OG_HOSTS, verifyOGHostTripleLock } = helpers;
    OG_HOSTS.delete("Zaira");
    OG_HOSTS.add("zaira");

    const SECRET_CODES = {
        '#sammuop':    { avatarId: 'superhost',   name: '🦚👑 SAMAKSH (KRISHNA OP++) 👑🦚' },
        '#millyqueen': { avatarId: 'host_milly',  name: '👸💖 Princess Milly' },
        '#moongalaxy': { avatarId: 'host_moon',   name: '🩺🌙 Dr. Moon' },
        '#ishikagold': { avatarId: 'host_ishika', name: '☀️✨ Empress Ishika' },
        '#zorosword':  { avatarId: 'host_zoro',   name: '⚔️🐉 Zoro 3-Sword' },
        '#sidbolt':    { avatarId: 'host_sid',    name: '😎⚡ Sid Thunder' },
        '#shubhirose': { avatarId: 'host_shubhi', name: '🌷 Shubhi Sakura' },
        '#sarahfly':   { avatarId: 'host_sarah',  name: '🦋 Sarah Valkyrie' },
        '#heerstar':   { avatarId: 'host_heer',   name: '🌸 Heer Starlight' },
        '#izzanfire':  { avatarId: 'host_izzan',  name: '🔥 Izzan Dragon' },
        '#susshadow':  { avatarId: 'host_sus',    name: '👸💚 Princess Sus' },
        '#zairaorbit': { avatarId: 'host_zaira',  name: '🪐 Zaira Nova' },
        '#advaitvolt': { avatarId: 'host_advait', name: '⚡ Advait Titan' },
        '#ruwiibloom': { avatarId: 'host_ruwii',  name: '🌺 Ruwii Kitsune' }
    };

    const equippedDB = {};
    const RPG_DB_FILE = path.join(__dirname, 'rpg_arena_db.json');
    let rpgDB = {};
    if (fs.existsSync(RPG_DB_FILE)) {
        try { rpgDB = JSON.parse(fs.readFileSync(RPG_DB_FILE, 'utf8')); } catch (e) {}
    }
    function saveRpg() {
        try { fs.writeFileSync(RPG_DB_FILE, JSON.stringify(rpgDB, null, 2)); } catch (e) {}
    }
    const RPG_FIGHTERS = {
        gunshooter: {
            id: 'gunshooter', name: '🔫 Gunshooter', tier: 'Common', pool: 'gacha', weight: 25,
            baseHp: 600, baseAtk: 85, color: '#94a3b8', icon: '🔫',
            skills: [
                { name: 'Quick Shot', cd: 0, mult: 1.0, type: 'dmg', desc: 'Fast pistol shot' },
                { name: 'Double Tap', cd: 2, mult: 1.65, type: 'dmg', desc: 'Fires two rounds' },
                { name: 'Smoke Cover', cd: 3, mult: 0, type: 'shield', desc: 'Blocks 75% next hit' },
                { name: 'Bullet Storm', cd: 4, mult: 2.4, type: 'dmg', desc: 'Unleashes full clip' }
            ]
        },
        wind_archer: {
            id: 'wind_archer', name: '🏹 Wind Archer', tier: 'Uncommon', pool: 'gacha', weight: 28,
            baseHp: 820, baseAtk: 115, color: '#4ade80', icon: '🏹',
            skills: [
                { name: 'Gale Arrow', cd: 0, mult: 1.0, type: 'dmg', desc: 'Swift wind arrow' },
                { name: 'Piercing Shot', cd: 2, mult: 1.75, type: 'dmg', desc: 'Ignores armor' },
                { name: 'Breeze Step', cd: 3, mult: 0.25, type: 'heal', desc: 'Heals 25% HP' },
                { name: 'Arrow Rain', cd: 4, mult: 2.6, type: 'dmg', desc: 'Skyfall of arrows' }
            ]
        },
        fire_swordsman: {
            id: 'fire_swordsman', name: '⚔️ Blazing Swordsman', tier: 'Rare', pool: 'gacha', weight: 8,
            baseHp: 1100, baseAtk: 165, color: '#38bdf8', icon: '⚔️',
            skills: [
                { name: 'Ember Slash', cd: 0, mult: 1.0, type: 'dmg', desc: 'Flame-coated blade' },
                { name: 'Flame Cross', cd: 2, mult: 1.9, type: 'dmg', desc: 'X-shaped fire wave' },
                { name: 'Blaze Aura', cd: 3, mult: 0.3, type: 'heal', desc: 'Fire spirit recovery' },
                { name: 'Inferno Cleave', cd: 4, mult: 3.1, type: 'dmg', desc: 'Scorching sword burst' }
            ]
        },
        fire_spirit: {
            id: 'fire_spirit', name: '🔥 Fire Spirit', tier: 'Rare', pool: 'gacha', weight: 7,
            baseHp: 1050, baseAtk: 185, color: '#38bdf8', icon: '🔥',
            skills: [
                { name: 'Fireball', cd: 0, mult: 1.05, type: 'dmg', desc: 'Hurls elemental flame' },
                { name: 'Hellfire Pillar', cd: 2, mult: 2.0, type: 'dmg', desc: 'Erupts magma below' },
                { name: 'Phoenix Rebirth', cd: 3, mult: 0.38, type: 'heal', desc: 'Heals 38% HP' },
                { name: 'Solar Flare', cd: 4, mult: 3.3, type: 'dmg', desc: 'Supernova flame blast' }
            ]
        },
        tornado_spinner: {
            id: 'tornado_spinner', name: '🌪️ Tornado Spinner', tier: 'Epic', pool: 'gacha', weight: 8,
            baseHp: 1450, baseAtk: 240, color: '#c084fc', icon: '🌪️',
            skills: [
                { name: 'Cyclone Kick', cd: 0, mult: 1.1, type: 'dmg', desc: 'Spinning wind strike' },
                { name: 'Twister Drill', cd: 2, mult: 2.2, type: 'dmg', desc: 'Vortex pierce' },
                { name: 'Wind Barrier', cd: 3, mult: 0, type: 'shield', desc: 'Deflects damage' },
                { name: 'Mega Hurricane', cd: 4, mult: 3.7, type: 'dmg', desc: 'Catastrophic storm spin' }
            ]
        },
        rubber_elastic: {
            id: 'rubber_elastic', name: '🥊 Elastic Rubber Hero', tier: 'Legendary', pool: 'gacha', weight: 3.99,
            baseHp: 2200, baseAtk: 360, color: '#facc15', icon: '🥊',
            skills: [
                { name: 'Elastic Pistol', cd: 0, mult: 1.15, type: 'dmg', desc: 'Stretch punch' },
                { name: 'Rubber Gatling', cd: 2, mult: 2.5, type: 'dmg', desc: '100 rapid fists' },
                { name: 'Balloon Bounce', cd: 3, mult: 0, type: 'shield', desc: 'Bounces back damage' },
                { name: 'Gear Colossal Fist', cd: 4, mult: 4.5, type: 'dmg', desc: 'Titan smash' }
            ]
        },
        spacetime_lord: {
            id: 'spacetime_lord', name: '🌌 Space-Time Sovereign', tier: 'Mythic', pool: 'gacha', weight: 0.01,
            baseHp: 4500, baseAtk: 750, color: '#f43f5e', icon: '🌌',
            skills: [
                { name: 'Void Rift', cd: 0, mult: 1.25, type: 'dmg', desc: 'Tears space fabric' },
                { name: 'Gravity Singularity', cd: 2, mult: 3.0, type: 'dmg', desc: 'Black hole crush' },
                { name: 'Time Rewind', cd: 3, mult: 0.55, type: 'heal', desc: 'Rewinds body +55% HP' },
                { name: 'Big Bang Erasure', cd: 4, mult: 5.8, type: 'dmg', desc: 'Erases timeline reality' }
            ]
        },
        host_moon: {
            id: 'host_moon', name: '🩺🌙 Dr. Moon (OG Host)', tier: 'Host Mythic', pool: 'code', code: '#moongalaxy',
            baseHp: 6000, baseAtk: 880, color: '#a855f7', icon: '🩺',
            skills: [
                { name: 'Lunar Scalpel', cd: 0, mult: 1.2, type: 'dmg', desc: 'Precision moonlight cut' },
                { name: 'Eclipse Miracle', cd: 2, mult: 0.75, type: 'heal', desc: 'Restores 75% Max HP' },
                { name: 'Astral Ward', cd: 3, mult: 0, type: 'shield', desc: 'Cosmic Protection' },
                { name: 'Supernova Rx', cd: 4, mult: 6.2, type: 'dmg', desc: 'Celestial eclipse beam' }
            ]
        },
        host_zoro: {
            id: 'host_zoro', name: '⚔️🐉 Zoro 3-Sword (OG)', tier: 'Host Mythic', pool: 'code', code: '#zorosword',
            baseHp: 6500, baseAtk: 950, color: '#22c55e', icon: '⚔️',
            skills: [
                { name: 'Oni Giri', cd: 0, mult: 1.3, type: 'dmg', desc: '3-Sword Demon Slash' },
                { name: '1080 Pound Phoenix', cd: 2, mult: 3.2, type: 'dmg', desc: 'Flying dragon cannon' },
                { name: 'Haki Hardening', cd: 3, mult: 0, type: 'shield', desc: 'Black blade armor' },
                { name: 'Asura Nine-Blades', cd: 4, mult: 6.8, type: 'dmg', desc: '9-Sword Demon God' }
            ]
        },
        host_sus: {
            id: 'host_sus', name: '👸💚 Princess Sus (OG)', tier: 'Host Mythic', pool: 'code', code: '#susshadow',
            baseHp: 6200, baseAtk: 910, color: '#10b981', icon: '👸',
            skills: [
                { name: 'Emerald Charm', cd: 0, mult: 1.25, type: 'dmg', desc: 'Enchanted fairy strike' },
                { name: 'Royal Rose Storm', cd: 2, mult: 3.1, type: 'dmg', desc: 'Razor emerald petals' },
                { name: 'Fairy Blessing', cd: 3, mult: 0.65, type: 'heal', desc: 'Heals 65% HP' },
                { name: 'Queen Sovereign', cd: 4, mult: 6.5, type: 'dmg', desc: 'Dazzling royal burst' }
            ]
        },
        host_milly: {
            id: 'host_milly', name: '👸💖 Princess Milly', tier: 'Empress', pool: 'code', code: '#millyqueen',
            baseHp: 999999, baseAtk: 99999, fixedLevel: 999, color: '#f472b6', icon: '👸',
            skills: [
                { name: 'Seraphim Grace', cd: 0, mult: 1.5, type: 'dmg', desc: 'Divine angelic strike' },
                { name: 'Empress Decree', cd: 1, mult: 3.5, type: 'dmg', desc: 'Overwhelming royal light' },
                { name: 'Crystal Sanctuary', cd: 2, mult: 1.0, type: 'heal', desc: 'Full 100% HP Restore' },
                { name: 'Celestial Crown Nova', cd: 3, mult: 9.9, type: 'dmg', desc: 'Annihilates non-god foes' }
            ]
        },
        superhost: {
            id: 'superhost', name: '🦚👑 SAMAKSH (KRISHNA OP++)', tier: 'GOD-TIER OP++', pool: 'code', code: '#sammuop',
            infinite: true, baseHp: 999999999, baseAtk: 999999999, fixedLevel: '∞', color: '#fde047', icon: '🦚',
            skills: [
                { name: 'Divine Bansuri Wave', cd: 0, mult: 999, type: 'dmg', desc: 'Infinite cosmic resonance' },
                { name: 'Vaikuntha Shield', cd: 0, mult: 0, type: 'shield', desc: '100% Absolute Immunity' },
                { name: 'Creator Miracle', cd: 0, mult: 1.0, type: 'heal', desc: 'Infinite HP Restoration' },
                { name: 'Sudarshan Annihilation', cd: 0, mult: 9999, type: 'dmg', desc: '∞ Instant Obliteration' }
            ]
        }
    };

    const RPG_ACCESSORIES = [
        { id: 'w_iron',   slot: 'weapon', name: '⚔️ Iron Katana',       cost: 150,  atkBonus: 120, hpBonus: 0 },
        { id: 'w_flame',  slot: 'weapon', name: '🔥 Flame Saber',       cost: 450,  atkBonus: 350, hpBonus: 150 },
        { id: 'w_dragon', slot: 'weapon', name: '🐉 Dragon Greatsword', cost: 1200, atkBonus: 950, hpBonus: 400 },
        { id: 'r_shield', slot: 'relic',  name: '🛡️ Aegis Shield',      cost: 200,  atkBonus: 0,   hpBonus: 650 },
        { id: 'r_medkit', slot: 'relic',  name: '🩺 Moon Clinic Kit',   cost: 500,  atkBonus: 120, hpBonus: 1400 },
        { id: 'r_crown',  slot: 'relic',  name: '👑 Sovereign Relic',   cost: 1500, atkBonus: 800, hpBonus: 3000 }
    ];
    function getPlayerRpg(uname) {
        const u = (uname || '').trim().toLowerCase();
        if (!u) return null;
        if (!rpgDB[u]) {
            rpgDB[u] = { mvp: 20, gold: 150, owned: { gunshooter: { lvl: 1, xp: 0 } }, activeChar: 'gunshooter', weapon: null, relic: null };
            saveRpg();
        }
        return rpgDB[u];
    }

    function rollGachaBundle() {
        const pool = Object.values(RPG_FIGHTERS).filter(f => f.pool === 'gacha');
        const total = pool.reduce((s, f) => s + f.weight, 0);
        let r = Math.random() * total;
        for (const f of pool) {
            if (r < f.weight) return f;
            r -= f.weight;
        }
        return pool;
    }

    io.on('connection', (socket) => {
        socket.on('verifyAvatarCodeV6', ({ code }) => {
            const match = SECRET_CODES[(code || '').trim().toLowerCase()];
            if (match) {
                socket.isCodeVerified = match.avatarId;
                socket.emit('avatarCodeResultV6', { ok: true, avatarId: match.avatarId, name: match.name });
            } else {
                socket.emit('avatarCodeResultV6', { ok: false });
            }
        });

        socket.on('equipAvatarFxV6', (data) => {
            if (!data || !data.username) return;
            const cleanU = data.username.trim().toLowerCase();
            const isCreator = (data.avatarId === 'superhost') && (verifyOGHostTripleLock(cleanU, socket, false) || socket.isCodeVerified === 'superhost');
            const isMilly = (data.avatarId === 'host_milly') && (verifyOGHostTripleLock(cleanU, socket, false) || socket.isCodeVerified === 'host_milly');
            if ((data.avatarId === 'superhost' && !isCreator) || (data.avatarId === 'host_milly' && !isMilly)) return;

            equippedDB[cleanU] = { avatarId: data.avatarId, fx: data.fx, badge: data.badge };
            if (socket.activeServerId) io.to(socket.activeServerId).emit('avatarStatsDataV6', { avatarMap: equippedDB });
        });

        socket.on('getMyAvatarStatsV6', () => socket.emit('avatarStatsDataV6', { avatarMap: equippedDB }));

        socket.on('rpgGetState', (uname) => {
            const p = getPlayerRpg(uname);
            if (p) socket.emit('rpgStateSync', { profile: p, fighters: RPG_FIGHTERS, accessories: RPG_ACCESSORIES });
        });

        socket.on('rpgSyncMvp', ({ username, pts }) => {
            const p = getPlayerRpg(username);
            if (p && Number(pts) > p.mvp) { p.mvp = Number(pts); saveRpg(); socket.emit('rpgStateSync', { profile: p, fighters: RPG_FIGHTERS, accessories: RPG_ACCESSORIES }); }
        });

        socket.on('rpgOpenBundle', (uname) => {
            const p = getPlayerRpg(uname);
            if (!p) return;
            if (p.mvp < 10) return socket.emit('rpgToast', '❌ Need 10 MVP Points! Win mini-games in chat!');
            p.mvp -= 10;
            const won = rollGachaBundle();
            let bonusText = '';
            if (p.owned[won.id]) { p.owned[won.id].xp += 120; p.gold += 80; bonusText = ' (Duplicate → +120 XP & +80 Gold!)'; }
            else { p.owned[won.id] = { lvl: 1, xp: 0 }; p.activeChar = won.id; }
            saveRpg();
            socket.emit('rpgBundleResult', { fighter: won, bonusText, profile: p });
            if ((won.tier === 'Legendary' || won.tier === 'Mythic') && socket.activeServerId) {
                io.to(socket.activeServerId).emit('message', {
                    username: "Sammu's Bot",
                    text: `🎰🔥 **INSANE GACHA PULL!** **${uname}** pulled **[${won.tier.toUpperCase()}] ${won.name}**! 🎉`,
                    _serverId: socket.activeServerId
                });
            }
        });

        socket.on('rpgRedeemHostCode', ({ username, code }) => {
            const p = getPlayerRpg(username);
            if (!p || !code) return;
            const found = Object.values(RPG_FIGHTERS).find(f => f.pool === 'code' && f.code === code.trim().toLowerCase());
            if (!found) return socket.emit('rpgToast', '❌ Invalid Host Code!');
            p.owned[found.id] = { lvl: found.fixedLevel || 1, xp: 0 };
            p.activeChar = found.id;
            saveRpg();
            socket.emit('rpgStateSync', { profile: p, fighters: RPG_FIGHTERS, accessories: RPG_ACCESSORIES });
            socket.emit('rpgToast', `👑 Unlocked & Equipped ${found.name}!`);
        });

        socket.on('rpgSelectFighter', ({ username, fighterId }) => {
            const p = getPlayerRpg(username);
            if (p && p.owned[fighterId]) { p.activeChar = fighterId; saveRpg(); socket.emit('rpgStateSync', { profile: p, fighters: RPG_FIGHTERS, accessories: RPG_ACCESSORIES }); }
        });

        socket.on('rpgBuyAccessory', ({ username, accId }) => {
            const p = getPlayerRpg(username);
            const item = RPG_ACCESSORIES.find(a => a.id === accId);
            if (!p || !item) return;
            if (p.gold < item.cost) return socket.emit('rpgToast', `❌ Need ${item.cost} Gold!`);
            p.gold -= item.cost;
            if (item.slot === 'weapon') p.weapon = item.id; else p.relic = item.id;
            saveRpg();
            socket.emit('rpgStateSync', { profile: p, fighters: RPG_FIGHTERS, accessories: RPG_ACCESSORIES });
            socket.emit('rpgToast', `⚔️ Equipped ${item.name}!`);
        });

        socket.on('rpgClaimGrindWin', ({ username, enemyTier }) => {
            const p = getPlayerRpg(username);
            if (!p) return;
            const f = RPG_FIGHTERS[p.activeChar] || RPG_FIGHTERS.gunshooter;
            const mult = enemyTier === 'boss' ? 3 : 1;
            const xpGain = 65 * mult, goldGain = 75 * mult;
            p.gold += goldGain;
            if (!f.infinite && !f.fixedLevel) {
                const st = p.owned[f.id] || { lvl: 1, xp: 0 };
                st.xp += xpGain;
                if (st.xp >= st.lvl * 100) { st.xp -= st.lvl * 100; st.lvl += 1; }
                p.owned[f.id] = st;
            }
            saveRpg();
            socket.emit('rpgStateSync', { profile: p, fighters: RPG_FIGHTERS, accessories: RPG_ACCESSORIES });
            socket.emit('rpgToast', `🏆 Victory! +${xpGain} XP & +${goldGain} Gold!`);
        });
    });
    const COMBINED_UI = `
    <style>
      .v14-ring-samaksh { border: 2.5px solid #fde047 !important; box-shadow: 0 0 12px #fde047 !important; }
      .v14-ring-empress { border: 2.5px solid #fbcfe8 !important; box-shadow: 0 0 10px #f472b6 !important; }
      .v14-ring-gold    { border: 2px solid #fde047 !important; box-shadow: 0 0 8px #eab308 !important; }
      .v14-bubble { position:relative !important; display:inline-flex !important; width:40px !important; height:40px !important; border-radius:50% !important; overflow:hidden !important; vertical-align:middle !important; margin-right:6px !important; background:#090d16 !important; flex-shrink:0 !important; cursor:pointer !important; }
      .v14-bubble img, .st-art img { width:100% !important; height:100% !important; object-fit:cover !important; display:block !important; border-radius:50% !important; }
      .v14-title-pill { display:inline-block; font-size:9px; font-weight:900; padding:1px 6px; border-radius:8px; margin-left:5px; background:#1e1b4b; border:1px solid #fde047; color:#fde047; vertical-align:middle; }
      #stVaultModal, #rpgArenaModal { display:none; position:fixed; inset:0; background:rgba(4,7,18,0.96); z-index:999999998; align-items:center; justify-content:center; padding:10px; }
      #stVaultCard, #rpgCard { background:linear-gradient(160deg,#090d16,#1e1b4b); border:2px solid #f59e0b; border-radius:20px; padding:12px; width:100%; max-width:420px; color:#fff; max-height:90vh; overflow-y:auto; }
      .st-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:7px; margin:8px 0; }
      .st-item { background:rgba(255,255,255,0.08); border:1.5px solid rgba(56,189,248,0.45); border-radius:12px; padding:7px 4px; cursor:pointer; text-align:center; }
      .st-art { position:relative; width:64px; height:64px; margin:0 auto 4px auto; border-radius:50%; overflow:hidden; background:#090d16; }
      .rpg-tabs { display:flex; gap:5px; margin:8px 0; }
      .rpg-tab { flex:1; padding:6px 4px; border-radius:9px; border:1px solid #38bdf8; background:#1e293b; color:#fff; font-size:11px; font-weight:900; cursor:pointer; }
      .rpg-tab.active { background:linear-gradient(90deg,#f59e0b,#ec4899); border-color:#fde047; }
      .rpg-logo { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:900; border:2px solid currentColor; flex-shrink:0; }
      .rpg-skill-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:8px; }
      .rpg-skill-btn { background:#1e293b; border:1.5px solid #38bdf8; color:#fff; padding:8px 6px; border-radius:10px; font-size:11px; font-weight:800; cursor:pointer; text-align:left; }
      .rpg-skill-btn:disabled { opacity:0.45; cursor:not-allowed; }
    </style>

    <div id="stVaultModal" onclick="if(event.target===this)this.style.display='none'">
      <div id="stVaultCard">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:900;font-size:15px;color:#38bdf8;">🦚 SAMMU AVATAR ARMORY</span>
          <button onclick="document.getElementById('stVaultModal').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:8px;padding:4px 10px;font-weight:900;">✕</button>
        </div>
        <div class="st-grid" id="stGrid"></div>
        <div style="display:flex;gap:6px;margin-top:6px;">
          <input id="stCodeInput" placeholder="Enter Code (#sammuop)..." style="flex:1;padding:8px;border-radius:10px;border:1.5px solid #c084fc;background:#090d16;color:#fff;font-size:12px;">
          <button onclick="stRedeemCode()" style="padding:8px 12px;background:linear-gradient(90deg,#a855f7,#ec4899);border:none;color:#fff;border-radius:10px;font-weight:bold;font-size:12px;">🔓 Unlock</button>
        </div>
      </div>
    </div>

    <div id="rpgArenaModal" onclick="if(event.target===this)this.style.display='none'">
      <div id="rpgCard">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:900;font-size:15px;color:#fde047;">⚔️ ANIME RPG & GACHA ARENA</span>
          <button onclick="document.getElementById('rpgArenaModal').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:8px;padding:4px 10px;font-weight:900;">✕</button>
        </div>
        <div id="rpgTopStats" style="display:flex;justify-content:space-between;background:rgba(255,255,255,0.06);padding:6px 10px;border-radius:10px;margin-top:6px;font-size:11px;font-weight:900;"></div>
        <div class="rpg-tabs">
          <button class="rpg-tab active" onclick="switchRpgTab('battle',this)">⚔️ Battle Grind</button>
          <button class="rpg-tab" onclick="switchRpgTab('gacha',this)">🎁 Gift Bundle</button>
          <button class="rpg-tab" onclick="switchRpgTab('heroes',this)">🦸 My Heroes</button>
          <button class="rpg-tab" onclick="switchRpgTab('shop',this)">🗡️ Gear Shop</button>
        </div>
        <div id="rpgBody"></div>
      </div>
    </div>
    <script>
    (function() {
      const KRISHNA_URI = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        '<svg xmlns="http://w3.org" viewBox="0 0 100 100">' +
          '<defs><radialGradient id="krBg" cx="50%" cy="32%" r="74%"><stop offset="0%" stop-color="#fde047"/><stop offset="38%" stop-color="#4c1d95"/><stop offset="100%" stop-color="#02040a"/></radialGradient>' +
          '<radialGradient id="krSkin" cx="42%" cy="28%" r="70%"><stop offset="0%" stop-color="#bae6fd"/><stop offset="48%" stop-color="#0284c7"/><stop offset="100%" stop-color="#1e3a8a"/></radialGradient>' +
          '<linearGradient id="krGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fef9c3"/><stop offset="50%" stop-color="#facc15"/><stop offset="100%" stop-color="#92400e"/></linearGradient></defs>' +
          '<circle cx="50" cy="50" r="49" fill="url(#krBg)"/>' +
          '<circle cx="50" cy="46" r="43" fill="none" stroke="url(#krGold)" stroke-width="2.5" stroke-dasharray="6 3"/>' +
          '<path d="M62,25 Q67,13 66,7" stroke="#fde047" stroke-width="1.6" fill="none"/><ellipse cx="66" cy="11" rx="6.5" ry="9" fill="#10b981" stroke="#fde047" stroke-width="1.5"/><ellipse cx="66" cy="11" rx="3.8" ry="5.2" fill="#1d4ed8"/><circle cx="66" cy="11" r="1.8" fill="#fef08a"/>' +
          '<path d="M16,98 C19,73 33,66 50,66 C67,66 81,73 84,98 Z" fill="url(#krGold)" stroke="#fef9c3" stroke-width="1.4"/>' +
          '<path d="M33,31 C33,24 67,24 67,31 L66,48 C65,58 56,65 50,66.8 C44,65 35,58 34,48 Z" fill="url(#krSkin)" stroke="#bae6fd" stroke-width="1.2"/>' +
          '<path d="M27,42 C25,26 36,20 50,20 C64,20 75,26 73,42 C65,33 56,34 50,39 C44,34 35,33 27,42 Z" fill="#0f172a"/>' +
          '<polygon points="34,23 39,12 45,19 50,7 55,19 61,12 66,23" fill="url(#krGold)" stroke="#fff" stroke-width="1.1"/>' +
          '<path d="M47.8,36 L47.8,43 Q50,45 52.2,43 L52.2,36" fill="none" stroke="#fff" stroke-width="1.8"/><line x1="50" y1="37" x2="50" y2="43" stroke="#ef4444" stroke-width="1.5"/>' +
          '<ellipse cx="41" cy="50" rx="4.2" ry="3.2" fill="#fff"/><circle cx="41" cy="50" r="2.3" fill="#0284c7"/><ellipse cx="59" cy="50" rx="4.2" ry="3.2" fill="#fff"/><circle cx="59" cy="50" r="2.3" fill="#0284c7"/>' +
          '<path d="M44.5,58.5 Q50,62 55.5,58.5" stroke="#1e3a8a" stroke-width="2" fill="none" stroke-linecap="round"/>' +
          '<line x1="22" y1="84" x2="78" y2="74" stroke="url(#krGold)" stroke-width="3.6" stroke-linecap="round"/>' +
        '</svg>'
      );

      function dbUrl(s, seed, bg) { return ['https://dicebear.com','9.x',s,'svg'].join('/') + '?seed=' + encodeURIComponent(seed) + '&backgroundColor=' + bg; }

      const AVATAR_ITEMS = [
        { id: 'superhost',   name: '🦚👑 SAMAKSH (KRISHNA OP++) 👑🦚', ring: 'v14-ring-samaksh', req: 'code', featured: true, img: KRISHNA_URI },
        { id: 'host_milly',  name: '👸💖 Princess Milly', ring: 'v14-ring-empress', req: 'code', featured: true, img: dbUrl('lorelei','PrincessMillyRoyal99','f43f5e,fbcfe8') },
        { id: 'host_moon',   name: '🩺🌙 Dr. Moon',       ring: 'v14-ring-gold',    req: 'code', img: dbUrl('lorelei','DrMoonClinicMD','7c3aed,38bdf8') },
        { id: 'host_zoro',   name: '⚔️🐉 Zoro 3-Sword',   ring: 'v14-ring-gold',    req: 'code', img: dbUrl('adventurer','RoronoaZoroDojo99','16a34a,052e16') },
        { id: 'host_sus',    name: '👸💚 Princess Sus',   ring: 'v14-ring-gold',    req: 'code', img: dbUrl('lorelei','PrincessSusCharming88','10b981,064e3b') },
        { id: 'diamond',     name: '🔫 Gunshooter',       ring: 'v14-ring-gold',    req: 'free', img: dbUrl('bottts-neutral','Gunshooter01','0284c7') },
        { id: 'fire_spirit', name: '🔥 Fire Spirit',      ring: 'v14-ring-gold',    req: 'free', img: dbUrl('adventurer','FireSpirit99','dc2626') },
        { id: 'spacetime',   name: '🌌 Space-Time Lord',  ring: 'v14-ring-gold',    req: 'free', img: dbUrl('lorelei','SpaceTimeLord','4c1d95') }
      ];

      const playersMap = {};
      let rpgData = null, curTab = 'battle', battleState = null;

      function getMe() {
        const s = window._savedUname || localStorage.getItem('sammu_username') || localStorage.getItem('username') || '';
        if (s && s.trim()) return s.trim().toLowerCase();
        const inp = document.querySelector('input[placeholder*="name" i], input[id*="name" i], input[id*="user" i]');
        return (inp && inp.value) ? inp.value.trim().toLowerCase() : '';
      }

      window.stRedeemCode = () => {
        const c = (document.getElementById('stCodeInput').value || '').trim();
        if (c && typeof socket !== 'undefined') socket.emit('verifyAvatarCodeV6', { code: c });
      };

      window.stDrawVault = function() {
        const grid = document.getElementById('stGrid');
        if (!grid) return;
        const unlocked = JSON.parse(localStorage.getItem('sammu_unlocked_avatars') || '[]');
        grid.innerHTML = '';
        AVATAR_ITEMS.forEach(av => {
          const ok = av.req === 'free' || unlocked.includes(av.id);
          const d = document.createElement('div');
          d.className = 'st-item';
          if (av.featured) d.style.cssText = 'grid-column:1/-1;border:2px solid #fde047;background:rgba(250,204,21,0.16);';
          d.innerHTML = '<div class="st-art ' + av.ring + '"><img src="' + av.img + '"></div><div style="font-weight:900;font-size:10px;">' + av.name + '</div><div style="font-size:9px;color:' + (ok ? '#4ade80' : '#fbbf24') + ';">' + (ok ? '✅ Tap to Equip' : '🔒 Secret Code') + '</div>';
          d.onclick = () => {
            const me = getMe();
            if (!ok) return alert('🔒 Enter secret code below to unlock!');
            if (!me) return alert('Enter your username and join a room first!');
            playersMap[me] = av;
            socket.emit('equipAvatarFxV6', { username: me, avatarId: av.id, fx: av.ring, badge: av.name });
            document.getElementById('stVaultModal').style.display = 'none';
            renderChatAvatars();
          };
          grid.appendChild(d);
        });
      };

      function renderChatAvatars() {
        document.querySelectorAll('#chatBox b, #chatBox strong, #messages b, #messages strong, .msg-user').forEach(el => {
          if (el.closest('#stVaultModal') || el.closest('#rpgArenaModal')) return;
          const raw = (el.textContent || '').trim();
          const sender = raw.replace(/\s*(cap\s*[ab]|👑|creator)\s*/gi, '').trim().toLowerCase();
          const av = playersMap[sender];
          if (!av || !el.parentElement) return;
          const row = el.parentElement;
          if (!row.querySelector('.v14-title-pill')) {
            const pill = document.createElement('span');
            pill.className = 'v14-title-pill';
            pill.textContent = av.badge || av.name;
            el.insertAdjacentElement('afterend', pill);
          }
          if (row.dataset.v14Stamp === av.id) return;
          const iconSpan = Array.from(row.children).find(c => c !== el && !c.classList.contains('v14-title-pill') && !c.querySelector('button') && (c.textContent || '').trim().length <= 4);
          if (iconSpan) {
            row.dataset.v14Stamp = av.id;
            iconSpan.innerHTML = '<span class="v14-bubble ' + av.ring + '"><img src="' + av.img + '"></span>';
          }
        });
      }
      function calcStats(f, profile) {
        if (f.infinite) return { lvl: '∞', hp: '∞', maxHp: '∞', atk: '∞' };
        const st = (profile.owned && profile.owned[f.id]) || { lvl: f.fixedLevel || 1, xp: 0 };
        const lvl = f.fixedLevel || st.lvl || 1;
        const w = (rpgData.accessories || []).find(x => x.id === profile.weapon);
        const r = (rpgData.accessories || []).find(x => x.id === profile.relic);
        const maxHp = Math.round(f.baseHp * (1 + (lvl - 1) * 0.18)) + (w ? w.hpBonus : 0) + (r ? r.hpBonus : 0);
        const atk = Math.round(f.baseAtk * (1 + (lvl - 1) * 0.18)) + (w ? w.atkBonus : 0) + (r ? r.atkBonus : 0);
        return { lvl, hp: maxHp, maxHp, atk };
      }

      window.switchRpgTab = function(t, btn) {
        curTab = t;
        document.querySelectorAll('.rpg-tab').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        renderRpgBody();
      };

      window.startGrindBattle = function(mode) {
        if (!rpgData) return;
        const p = rpgData.profile, f = rpgData.fighters[p.activeChar] || rpgData.fighters.gunshooter, st = calcStats(f, p), isBoss = mode === 'boss';
        battleState = { mode, fighter: f, pHp: st.maxHp, pMax: st.maxHp, pAtk: st.atk, shield: 0, cds:, eName: isBoss ? '👹 Abyssal Boss' : '🐺 Wild Beast', eHp: isBoss ? 3200 : 850, eAtk: isBoss ? 240 : 75, log: '⚔️ Choose a skill!' };
        renderRpgBody();
      };

      window.useRpgSkill = function(idx) {
        if (!battleState || battleState.eHp <= 0) return;
        const b = battleState, sk = b.fighter.skills[idx];
        if (!sk || b.cds[idx] > 0) return;
        b.cds = b.cds.map(c => Math.max(0, c - 1)); b.cds[idx] = sk.cd;
        if (b.fighter.infinite) { b.eHp = 0; b.log = '🦚 ' + sk.name + ' dealt ∞ COSMIC DAMAGE!'; }
        else if (sk.type === 'dmg') { const d = Math.round(b.pAtk * sk.mult); b.eHp = Math.max(0, b.eHp - d); b.log = b.fighter.icon + ' ' + sk.name + ' hit for ' + d + ' DMG!'; }
        else if (sk.type === 'heal') { const h = Math.round(b.pMax * sk.mult); b.pHp = Math.min(b.pMax, b.pHp + h); b.log = '💚 Healed +' + h + ' HP!'; }
        else if (sk.type === 'shield') { b.shield = 0.75; b.log = '🛡️ 75% Shield Active!'; }
        if (b.eHp <= 0) { socket.emit('rpgClaimGrindWin', { username: getMe(), enemyTier: b.mode }); renderRpgBody(); return; }
        const ed = Math.round(b.eAtk * (1 - b.shield)); b.shield = 0;
        if (b.pHp !== '∞') b.pHp = Math.max(0, b.pHp - ed);
        b.log += ' | Enemy hit for ' + ed + ' DMG!';
        renderRpgBody();
      };
      function renderRpgBody() {
        const body = document.getElementById('rpgBody'), top = document.getElementById('rpgTopStats');
        if (!body || !rpgData) return;
        const p = rpgData.profile, f = rpgData.fighters[p.activeChar] || rpgData.fighters.gunshooter, st = calcStats(f, p);
        top.innerHTML = '<span style="color:#fde047;">🪙 MVP: ' + p.mvp + '</span><span style="color:#fbbf24;">💰 Gold: ' + p.gold + '</span><span style="color:' + f.color + ';">' + f.icon + ' Lvl ' + st.lvl + '</span>';
        if (curTab === 'battle') {
          body.innerHTML = !battleState
            ? '<div style="text-align:center;padding:10px;"><div style="font-weight:900;font-size:14px;">' + f.name + ' (' + f.tier + ')</div><div style="font-size:11px;color:#4ade80;margin:4px 0;">❤️ HP: ' + st.maxHp + ' | ⚔️ ATK: ' + st.atk + '</div><div style="display:flex;gap:8px;margin-top:8px;"><button onclick="startGrindBattle(\\'mob\\')" style="flex:1;padding:9px;border:none;border-radius:10px;background:#0284c7;color:#fff;font-weight:900;">🐺 Grind Mob</button><button onclick="startGrindBattle(\\'boss\\')" style="flex:1;padding:9px;border:none;border-radius:10px;background:#dc2626;color:#fff;font-weight:900;">👹 Raid Boss</button></div></div>'
            : '<div style="padding:8px;"><div style="display:flex;justify-content:space-between;font-size:12px;font-weight:900;"><span>' + battleState.fighter.name + ' (❤️' + battleState.pHp + ')</span><span style="color:#f87171;">' + battleState.eName + ' (❤️' + battleState.eHp + ')</span></div><div style="font-size:11px;color:#fde047;margin:6px 0;">' + battleState.log + '</div>' + (battleState.eHp <= 0 || (battleState.pHp !== '∞' && battleState.pHp <= 0) ? '<button onclick="battleState=null;renderRpgBody()" style="width:100%;padding:9px;border:none;border-radius:10px;background:#10b981;color:#fff;font-weight:900;">Continue</button>' : '<div class="rpg-skill-grid">' + battleState.fighter.skills.map((s, i) => '<button class="rpg-skill-btn" ' + (battleState.cds[i] > 0 ? 'disabled' : '') + ' onclick="useRpgSkill(' + i + ')">' + (i + 1) + '. ' + s.name + '</button>').join('') + '</div>') + '</div>';
        } else if (curTab === 'gacha') {
          body.innerHTML = '<div style="text-align:center;padding:10px;"><div style="font-size:32px;">🎁</div><div style="font-weight:900;color:#fde047;">MYTHIC GIFT BUNDLE</div><div style="font-size:10px;color:#cbd5e1;margin:5px 0;">Common 25% • Uncommon 28% • Rare (Fire/Sword) 15% • Epic (Tornado) 8% • Legendary (Rubber) 3.99% • Mythic (🌌 Space-Time) 0.01%</div><button onclick="socket.emit(\\'rpgOpenBundle\\',\\'' + getMe() + '\\')" style="width:100%;padding:10px;border:none;border-radius:12px;background:linear-gradient(90deg,#f59e0b,#ec4899);color:#fff;font-weight:900;">🎰 Open Gift Bundle (🪙 10 MVP)</button><div style="display:flex;gap:5px;margin-top:8px;"><input id="rpgHostCodeInp" placeholder="Host Code (#sammuop)..." style="flex:1;padding:6px;border-radius:8px;border:1px solid #38bdf8;background:#090d16;color:#fff;font-size:11px;"><button onclick="socket.emit(\\'rpgRedeemHostCode\\',{username:\\'' + getMe() + '\\',code:document.getElementById(\\'rpgHostCodeInp\\').value})" style="padding:6px 10px;border:none;border-radius:8px;background:#2563eb;color:#fff;font-weight:bold;">Unlock</button></div></div>';
        } else if (curTab === 'heroes') {
          body.innerHTML = Object.keys(p.owned).map(id => { const hf = rpgData.fighters[id]; if (!hf) return ''; const hst = calcStats(hf, p); return '<div onclick="socket.emit(\\'rpgSelectFighter\\',{username:\\'' + getMe() + '\\',fighterId:\\'' + id + '\\'})" style="display:flex;justify-content:space-between;background:rgba(255,255,255,0.06);border:1px solid ' + hf.color + ';border-radius:10px;padding:7px;margin-bottom:5px;cursor:pointer;"><div><b>' + hf.name + '</b> (' + hf.tier + ' Lvl ' + hst.lvl + ')</div><span>' + (p.activeChar === id ? '✅' : 'Equip') + '</span></div>'; }).join('');
        } else if (curTab === 'shop') {
          body.innerHTML = (rpgData.accessories || []).map(a => '<div style="display:flex;justify-content:space-between;background:rgba(255,255,255,0.06);border:1px solid #38bdf8;border-radius:10px;padding:7px;margin-bottom:5px;"><div><b>' + a.name + '</b> (+' + a.atkBonus + ' ATK / +' + a.hpBonus + ' HP)</div><button onclick="socket.emit(\\'rpgBuyAccessory\\',{username:\\'' + getMe() + '\\',accId:\\'' + a.id + '\\'})" style="padding:4px 9px;border:none;border-radius:7px;background:#f59e0b;color:#090d16;font-weight:900;">💰 ' + a.cost + '</button></div>').join('');
        }
      }

      setInterval(() => {
        if (!document.getElementById('openAvatarVaultBtn')) {
          const anchor = document.getElementById('openPhonkDjBtn') || document.getElementById('openChefBtn') || Array.from(document.querySelectorAll('button, a, div[onclick]')).find(el => el.children.length === 0 && /jam|🎹|phonk/i.test(el.textContent || ''));
          if (anchor && anchor.parentNode) {
            const b1 = anchor.cloneNode(true); b1.id = 'openAvatarVaultBtn'; b1.removeAttribute('onclick'); b1.textContent = '👑 Avatars';
            b1.onclick = (e) => { e.preventDefault(); window.stDrawVault(); document.getElementById('stVaultModal').style.display = 'flex'; };
            const b2 = anchor.cloneNode(true); b2.id = 'openRpgArenaBtn'; b2.removeAttribute('onclick'); b2.textContent = '⚔️ RPG Arena';
            b2.onclick = (e) => { e.preventDefault(); const u = getMe(); if (u && typeof socket !== 'undefined') socket.emit('rpgGetState', u); document.getElementById('rpgArenaModal').style.display = 'flex'; };
            anchor.parentNode.insertBefore(b1, anchor.nextSibling);
            anchor.parentNode.insertBefore(b2, b1.nextSibling);
          }
        }
        if (typeof socket !== 'undefined' && !window._allArmoryBound) {
          window._allArmoryBound = true;
          const u = getMe(); if (u) socket.emit('rpgGetState', u);
          socket.emit('getMyAvatarStatsV6');
          socket.on('avatarCodeResultV6', (res) => { if (res && res.ok) { const arr = JSON.parse(localStorage.getItem('sammu_unlocked_avatars') || '[]'); if (!arr.includes(res.avatarId)) { arr.push(res.avatarId); localStorage.setItem('sammu_unlocked_avatars', JSON.stringify(arr)); } alert('🎉 Unlocked: ' + res.name + '!'); window.stDrawVault(); } else alert('❌ Invalid Code!'); });
          socket.on('avatarStatsDataV6', (d) => { if (d && d.avatarMap) { Object.entries(d.avatarMap).forEach(([usr, info]) => { const f = AVATAR_ITEMS.find(x => x.id === info.avatarId); if (f) playersMap[usr] = { ...f, ring: info.fx || f.ring, badge: info.badge || f.name }; }); renderChatAvatars(); } });
          socket.on('rpgStateSync', (d) => { rpgData = d; renderRpgBody(); });
          socket.on('rpgToast', (m) => alert(m));
          socket.on('rpgBundleResult', (res) => { if (rpgData) rpgData.profile = res.profile; alert('🎁 Pulled [' + res.fighter.tier + '] ' + res.fighter.name + (res.bonusText || '')); renderRpgBody(); });
          socket.on('updateMVP', (data) => { const cur = getMe(); if (cur && data && Array.isArray(data.board)) { const f = data.board.find(x => x.name && x.name.toLowerCase() === cur); if (f) socket.emit('rpgSyncMvp', { username: cur, pts: f.pts }); } });
        }
        renderChatAvatars();
      }, 900);
    })();
    </script>
    `;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (typeof body === 'string' && body.includes('</body>')) {
                body = body.replace('</body>', COMBINED_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
};
