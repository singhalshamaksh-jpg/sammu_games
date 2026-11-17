const fs = require('fs');
const path = require('path');

module.exports = function initAvatarArmory(app, io, helpers) {
    const { OG_HOSTS, verifyOGHostTripleLock } = helpers;
    OG_HOSTS.delete("Zaira");
    OG_HOSTS.add("zaira");

    const SECRET_CODES = {
        '#sammuop':    { avatarId: 'superhost',   name: '🦚👑 SAMAKSH (GOD OP++) 👑🦚' },
        '#millyqueen': { avatarId: 'host_milly',  name: '👸💖 Princess Milly (Empress)' },
        '#ishikagold': { avatarId: 'host_ishika', name: '☀️✨ Empress Ishika (Solar)' },
        '#moongalaxy': { avatarId: 'host_moon',   name: '🩺🌙 Dr. Moon (Medic)' },
        '#zorosword':  { avatarId: 'host_zoro',   name: '⚔️🐉 Zoro 3-Sword' },
        '#susshadow':  { avatarId: 'host_sus',    name: '👸💚 Princess Sus' },
        '#sidbolt':    { avatarId: 'host_sid',    name: '😎⚡ Sid Thunder' },
        '#shubhirose': { avatarId: 'host_shubhi', name: '🌷 Shubhi Sakura' },
        '#sarahfly':   { avatarId: 'host_sarah',  name: '🦋 Sarah Valkyrie' },
        '#heerstar':   { avatarId: 'host_heer',   name: '🌸 Heer Starlight' },
        '#izzanfire':  { avatarId: 'host_izzan',  name: '🔥 Izzan Dragon' },
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
        gunner: {
            id: 'gunner', name: '🔫 Cyber Gunner', tier: 'Common', pool: 'gacha', weight: 30,
            baseHp: 750, baseAtk: 100, color: '#94a3b8', icon: '🔫',
            skills: [
                { name: 'Quick Shot', cd: 0, mult: 1.0, type: 'dmg', desc: 'Rapid pistol shot' },
                { name: 'Double Tap', cd: 2, mult: 1.65, type: 'dmg', desc: 'Fires 2 armor rounds' },
                { name: 'Smoke Screen', cd: 3, mult: 0, type: 'shield', desc: 'Blocks 75% next hit' },
                { name: '★ Orbital Barrage', cd: 4, mult: 2.7, type: 'dmg', sig: true, desc: 'SIGNATURE: Satellite laser rain' }
            ]
        },
        swordsman: {
            id: 'swordsman', name: '⚔️ Blade Swordsman', tier: 'Common', pool: 'gacha', weight: 30,
            baseHp: 850, baseAtk: 90, color: '#cbd5e1', icon: '⚔️',
            skills: [
                { name: 'Swift Slash', cd: 0, mult: 1.0, type: 'dmg', desc: 'Clean katana strike' },
                { name: 'Cross Cut', cd: 2, mult: 1.7, type: 'dmg', desc: 'X-shaped blade wave' },
                { name: 'Parry Stance', cd: 3, mult: 0, type: 'shield', desc: 'Deflects 80% next hit' },
                { name: '★ Dragon Iaijutsu', cd: 4, mult: 2.8, type: 'dmg', sig: true, desc: 'SIGNATURE: Mach-speed draw slash' }
            ]
        },
        fire_mage: {
            id: 'fire_mage', name: '🔥 Inferno Pyromancer', tier: 'Rare', pool: 'gacha', weight: 13,
            baseHp: 1200, baseAtk: 180, color: '#f97316', icon: '🔥',
            skills: [
                { name: 'Fireball', cd: 0, mult: 1.05, type: 'dmg', desc: 'Hurls blazing orb' },
                { name: 'Flame Pillar', cd: 2, mult: 2.0, type: 'dmg', desc: 'Erupts magma below' },
                { name: 'Cauterize Heal', cd: 3, mult: 0.32, type: 'heal', desc: 'Restores 32% Max HP' },
                { name: '★ Supernova Cataclysm', cd: 4, mult: 3.5, type: 'dmg', sig: true, desc: 'SIGNATURE: Star-core fire explosion' }
            ]
        },
        water_bender: {
            id: 'water_bender', name: '🌊 Tidal Hydromancer', tier: 'Rare', pool: 'gacha', weight: 13,
            baseHp: 1350, baseAtk: 160, color: '#38bdf8', icon: '🌊',
            skills: [
                { name: 'Aqua Jet', cd: 0, mult: 1.0, type: 'dmg', desc: 'High-pressure stream' },
                { name: 'Tidal Wave', cd: 2, mult: 1.95, type: 'dmg', desc: 'Crashing ocean surge' },
                { name: 'Healing Spring', cd: 3, mult: 0.42, type: 'heal', desc: 'Heals 42% Max HP' },
                { name: '★ Leviathan Tsunami', cd: 4, mult: 3.3, type: 'dmg', sig: true, desc: 'SIGNATURE: Abyssal ocean crush' }
            ]
        },
        lightning_lord: {
            id: 'lightning_lord', name: '⚡ Raijin Storm Lord', tier: 'Legendary', pool: 'gacha', weight: 5,
            baseHp: 2200, baseAtk: 380, color: '#facc15', icon: '⚡',
            skills: [
                { name: 'Volt Strike', cd: 0, mult: 1.15, type: 'dmg', desc: 'Speed-of-light shock' },
                { name: 'Thunder Clap', cd: 2, mult: 2.4, type: 'dmg', desc: 'Chain lightning bolt' },
                { name: 'Static Barrier', cd: 3, mult: 0, type: 'shield', desc: 'Blocks 85% next hit' },
                { name: '★ Kirin Sky Judgment', cd: 4, mult: 4.6, type: 'dmg', sig: true, desc: 'SIGNATURE: Lightning dragon descent' }
            ]
        },
        rubber_hero: {
            id: 'rubber_hero', name: '🥊 Gear Rubber Champion', tier: 'Legendary', pool: 'gacha', weight: 5,
            baseHp: 2600, baseAtk: 350, color: '#fb7185', icon: '🥊',
            skills: [
                { name: 'Gum Pistol', cd: 0, mult: 1.15, type: 'dmg', desc: 'Elastic stretch punch' },
                { name: 'Jet Gatling', cd: 2, mult: 2.5, type: 'dmg', desc: '100 rapid fists' },
                { name: 'Balloon Guard', cd: 3, mult: 0, type: 'shield', desc: 'Bounces back 90% DMG' },
                { name: '★ Bajrang Sun Fist', cd: 4, mult: 4.8, type: 'dmg', sig: true, desc: 'SIGNATURE: Island-sized Haki punch' }
            ]
        },
        spacetime_god: {
            id: 'spacetime_god', name: '🌌 Chronos Space-Time', tier: 'Mythic', pool: 'gacha', weight: 4,
            baseHp: 4800, baseAtk: 780, color: '#c084fc', icon: '🌌',
            skills: [
                { name: 'Void Rift', cd: 0, mult: 1.25, type: 'dmg', desc: 'Tears space fabric' },
                { name: 'Black Hole Crush', cd: 2, mult: 3.1, type: 'dmg', desc: 'Gravity singularity' },
                { name: 'Time Rewind', cd: 3, mult: 0.55, type: 'heal', desc: 'Rewinds +55% Max HP' },
                { name: '★ Big Bang Erasure', cd: 4, mult: 6.0, type: 'dmg', sig: true, desc: 'SIGNATURE: Collapses timeline' }
            ]
        },
        // === PIECE 3: ISHIKA, ZORO, SUS, SID, SHUBHI, SARAH, HEER, IZZAN, ZAIRA, ADVAIT, RUWII & SAMAKSH ===
        host_ishika: {
            id: 'host_ishika', name: '☀️✨ Empress Ishika', tier: 'OG Host', pool: 'code', code: '#ishikagold',
            fixedLevel: 500, baseHp: 50000, baseAtk: 5100, color: '#facc15', icon: '☀️',
            skills: [
                { name: 'Sunbeam Lance',          cd: 0, mult: 1.25, type: 'dmg',    desc: 'Piercing golden solar ray' },
                { name: 'Solar Flare Wave',       cd: 2, mult: 2.5,  type: 'dmg',    desc: 'Blinding starburst explosion' },
                { name: 'Golden Dawn Aura',       cd: 3, mult: 0.50, type: 'heal',   desc: 'Restores +50% Max HP' },
                { name: 'Solar Eclipse Judgment', cd: 4, mult: 4.4,  type: 'dmg',    desc: 'Signature: Twin-sun annihilation' }
            ]
        },
        host_zoro: {
            id: 'host_zoro', name: '⚔️🐉 Zoro 3-Sword', tier: 'OG Host', pool: 'code', code: '#zorosword',
            fixedLevel: 500, baseHp: 50000, baseAtk: 5200, color: '#22c55e', icon: '⚔️',
            skills: [
                { name: 'Oni Giri',               cd: 0, mult: 1.25, type: 'dmg',    desc: '3-Sword Demon Slash' },
                { name: '1080 Pound Phoenix',     cd: 2, mult: 2.5,  type: 'dmg',    desc: 'Flying dragon wind cannon' },
                { name: 'Armament Haki',          cd: 3, mult: 0,    type: 'shield', desc: 'Blocks 85% next incoming hit' },
                { name: 'Asura Nine-Blades',      cd: 4, mult: 4.5,  type: 'dmg',    desc: 'Signature: 9-Sword Demon God' }
            ]
        },
        host_sus: {
            id: 'host_sus', name: '👸💚 Princess Sus', tier: 'OG Host', pool: 'code', code: '#susshadow',
            fixedLevel: 500, baseHp: 50000, baseAtk: 5000, color: '#10b981', icon: '👸',
            skills: [
                { name: 'Emerald Charm',          cd: 0, mult: 1.2,  type: 'dmg',    desc: 'Enchanted fairy blade strike' },
                { name: 'Rose Petal Storm',       cd: 2, mult: 2.45, type: 'dmg',    desc: 'Razor emerald leaf vortex' },
                { name: 'Fairy Sanctuary',        cd: 3, mult: 0.52, type: 'heal',   desc: 'Restores +52% Max HP' },
                { name: 'Queen Sovereign',        cd: 4, mult: 4.3,  type: 'dmg',    desc: 'Signature: Royal emerald burst' }
            ]
        },
        host_sid: {
            id: 'host_sid', name: '😎⚡ Sid Thunder', tier: 'OG Host', pool: 'code', code: '#sidbolt',
            fixedLevel: 500, baseHp: 50000, baseAtk: 5150, color: '#eab308', icon: '⚡',
            skills: [
                { name: 'Thunder Clap',           cd: 0, mult: 1.25, type: 'dmg',    desc: 'High-voltage lightning strike' },
                { name: 'Volt Rush',              cd: 2, mult: 2.5,  type: 'dmg',    desc: 'Supersonic thunder dash' },
                { name: 'Static Armor',           cd: 3, mult: 0,    type: 'shield', desc: 'Blocks 80% next hit' },
                { name: 'Thunder God Wrath',      cd: 4, mult: 4.4,  type: 'dmg',    desc: 'Signature: Sky-splitting bolt' }
            ]
        },
        host_shubhi: {
            id: 'host_shubhi', name: '🌷 Shubhi Sakura', tier: 'OG Host', pool: 'code', code: '#shubhirose',
            fixedLevel: 500, baseHp: 50000, baseAtk: 5000, color: '#f472b6', icon: '🌷',
            skills: [
                { name: 'Petal Slice',            cd: 0, mult: 1.2,  type: 'dmg',    desc: 'Sharp cherry blossom slash' },
                { name: 'Crimson Bloom',          cd: 2, mult: 2.4,  type: 'dmg',    desc: 'Exploding floral wave' },
                { name: 'Spring Renewal',         cd: 3, mult: 0.55, type: 'heal',   desc: 'Restores +55% Max HP' },
                { name: 'Sakura Blossom Storm',   cd: 4, mult: 4.3,  type: 'dmg',    desc: 'Signature: Thousand petal storm' }
            ]
        },
        host_sarah: {
            id: 'host_sarah', name: '🦋 Sarah Valkyrie', tier: 'OG Host', pool: 'code', code: '#sarahfly',
            fixedLevel: 500, baseHp: 50000, baseAtk: 5050, color: '#38bdf8', icon: '🦋',
            skills: [
                { name: 'Sky Feather',            cd: 0, mult: 1.2,  type: 'dmg',    desc: 'Crystal wing projectile' },
                { name: 'Monarch Cyclone',        cd: 2, mult: 2.45, type: 'dmg',    desc: 'Twisting astral wind' },
                { name: 'Wind Barrier',           cd: 3, mult: 0,    type: 'shield', desc: 'Blocks 80% next hit' },
                { name: 'Valkyrie Skyfall',       cd: 4, mult: 4.35, type: 'dmg',    desc: 'Signature: Celestial dive bomb' }
            ]
        },
        host_heer: {
            id: 'host_heer', name: '🌸 Heer Starlight', tier: 'OG Host', pool: 'code', code: '#heerstar',
            fixedLevel: 500, baseHp: 50000, baseAtk: 5050, color: '#fb7185', icon: '🌸',
            skills: [
                { name: 'Star Shard',             cd: 0, mult: 1.2,  type: 'dmg',    desc: 'Shooting star strike' },
                { name: 'Nebula Pulse',           cd: 2, mult: 2.45, type: 'dmg',    desc: 'Cosmic shockwave' },
                { name: 'Star Blessing',          cd: 3, mult: 0.52, type: 'heal',   desc: 'Restores +52% Max HP' },
                { name: 'Starlight Supernova',    cd: 4, mult: 4.35, type: 'dmg',    desc: 'Signature: Collapsing star beam' }
            ]
        },
        host_izzan: {
            id: 'host_izzan', name: '🔥 Izzan Dragon', tier: 'OG Host', pool: 'code', code: '#izzanfire',
            fixedLevel: 500, baseHp: 50000, baseAtk: 5200, color: '#ef4444', icon: '🔥',
            skills: [
                { name: 'Magma Claw',             cd: 0, mult: 1.25, type: 'dmg',    desc: 'Molten dragon slash' },
                { name: 'Hellfire Roar',          cd: 2, mult: 2.5,  type: 'dmg',    desc: 'Scorching flame wave' },
                { name: 'Phoenix Rebirth',        cd: 3, mult: 0.48, type: 'heal',   desc: 'Restores +48% Max HP' },
                { name: 'Dragon Breath Inferno',  cd: 4, mult: 4.5,  type: 'dmg',    desc: 'Signature: Apocalyptic fire beam' }
            ]
        },
        host_zaira: {
            id: 'host_zaira', name: '🪐 Zaira Nova', tier: 'OG Host', pool: 'code', code: '#zairaorbit',
            fixedLevel: 500, baseHp: 50000, baseAtk: 5100, color: '#818cf8', icon: '🪐',
            skills: [
                { name: 'Meteor Toss',            cd: 0, mult: 1.2,  type: 'dmg',    desc: 'Hurls orbital asteroid' },
                { name: 'Saturn Ring Slash',      cd: 2, mult: 2.45, type: 'dmg',    desc: 'Razor planetary ring' },
                { name: 'Void Shield',            cd: 3, mult: 0,    type: 'shield', desc: 'Blocks 80% next hit' },
                { name: 'Orbital Gravity Crush',  cd: 4, mult: 4.4,  type: 'dmg',    desc: 'Signature: Black hole slam' }
            ]
        },
        host_advait: {
            id: 'host_advait', name: '⚡ Advait Titan', tier: 'OG Host', pool: 'code', code: '#advaitvolt',
            fixedLevel: 500, baseHp: 52000, baseAtk: 5000, color: '#2563eb', icon: '⚡',
            skills: [
                { name: 'Titan Punch',            cd: 0, mult: 1.2,  type: 'dmg',    desc: 'Heavy shockwave fist' },
                { name: 'Megavolt Slam',          cd: 2, mult: 2.45, type: 'dmg',    desc: 'Electrified ground smash' },
                { name: 'Iron Bastion',           cd: 3, mult: 0,    type: 'shield', desc: 'Blocks 85% next hit' },
                { name: 'Titan Overdrive',        cd: 4, mult: 4.35, type: 'dmg',    desc: 'Signature: Colossal lightning surge' }
            ]
        },
        host_ruwii: {
            id: 'host_ruwii', name: '🌺 Ruwii Kitsune', tier: 'OG Host', pool: 'code', code: '#ruwiibloom',
            fixedLevel: 500, baseHp: 50000, baseAtk: 5050, color: '#fb923c', icon: '🌺',
            skills: [
                { name: 'Foxfire Orb',            cd: 0, mult: 1.2,  type: 'dmg',    desc: 'Spirit flame projectile' },
                { name: 'Mystic Tail Whip',       cd: 2, mult: 2.45, type: 'dmg',    desc: 'Nine-tail energy strike' },
                { name: 'Spirit Mend',            cd: 3, mult: 0.52, type: 'heal',   desc: 'Restores +52% Max HP' },
                { name: 'Nine-Tail Illusion',     cd: 4, mult: 4.4,  type: 'dmg',    desc: 'Signature: Phantom foxfire storm' }
            ]
        },
        superhost: {
            id: 'superhost', name: '🦚👑 SAMAKSH (GOD OP++)', tier: 'CREATOR GOD ∞', pool: 'code', code: '#sammuop',
            infinite: true, baseHp: 999999999, baseAtk: 999999999, fixedLevel: '∞', color: '#fde047', icon: '🦚',
            skills: [
                { name: 'Divine Bansuri Wave',    cd: 0, mult: 9999, type: 'dmg',    desc: '∞ 1-Shot Cosmic Resonance' },
                { name: 'Vaikuntha Immunity',     cd: 0, mult: 0,    type: 'shield', desc: '∞ 100% Absolute Invincibility' },
                { name: 'Creator Miracle',        cd: 0, mult: 1.0,  type: 'heal',   desc: '∞ Full Cosmic Restoration' },
                { name: 'Sudarshan Annihilation', cd: 0, mult: 9999, type: 'dmg',    desc: 'Signature: ∞ 3D Chakra Obliteration' }
            ]
        }
    };
    // === PIECE 4: ACCESSORIES, STATS CALCULATOR & GACHA ENGINE ===
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
            rpgDB[u] = {
                mvp: 30,
                gold: 200,
                owned: { gunner: { lvl: 1, xp: 0 }, swordsman: { lvl: 1, xp: 0 } },
                activeChar: 'gunner',
                weapon: null,
                relic: null
            };
            saveRpg();
        }
        return rpgDB[u];
    }

    function computeFighterStats(profile) {
        const f = RPG_FIGHTERS[profile.activeChar] || RPG_FIGHTERS.gunner;
        if (f.infinite) {
            return { fighter: f, lvl: '∞', maxHp: '∞', atk: '∞', infinite: true };
        }
        const st = (profile.owned && profile.owned[f.id]) || { lvl: f.fixedLevel || 1, xp: 0 };
        const lvl = f.fixedLevel || st.lvl || 1;
        const w = RPG_ACCESSORIES.find(x => x.id === profile.weapon);
        const r = RPG_ACCESSORIES.find(x => x.id === profile.relic);
        const maxHp = Math.round(f.baseHp * (1 + (lvl - 1) * 0.18)) + (w ? w.hpBonus : 0) + (r ? r.hpBonus : 0);
        const atk = Math.round(f.baseAtk * (1 + (lvl - 1) * 0.18)) + (w ? w.atkBonus : 0) + (r ? r.atkBonus : 0);
        return { fighter: f, lvl, maxHp, atk, infinite: false };
    }

    function rollGachaBundle() {
        const pool = Object.values(RPG_FIGHTERS).filter(f => f.pool === 'gacha');
        const total = pool.reduce((s, f) => s + f.weight, 0);
        let r = Math.random() * total;
        for (const f of pool) {
            if (r < f.weight) return f;
            r -= f.weight;
        }
        return pool.at(0);
    }

    const livePvpBattles = new Map();
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
            if (RPG_FIGHTERS[data.avatarId]) {
                const p = getPlayerRpg(cleanU);
                if (p) {
                    if (!p.owned[data.avatarId]) p.owned[data.avatarId] = { lvl: RPG_FIGHTERS[data.avatarId].fixedLevel || 1, xp: 0 };
                    p.activeChar = data.avatarId;
                    saveRpg();
                }
            }
            if (socket.activeServerId) io.to(socket.activeServerId).emit('avatarStatsDataV6', { avatarMap: equippedDB });
        });

        socket.on('getMyAvatarStatsV6', () => socket.emit('avatarStatsDataV6', { avatarMap: equippedDB }));

        socket.on('rpgGetState', (uname) => {
            const p = getPlayerRpg(uname);
            if (p) socket.emit('rpgStateSync', { profile: p, fighters: RPG_FIGHTERS, accessories: RPG_ACCESSORIES });
        });

        socket.on('rpgGetRoomPlayers', () => {
            const srvId = socket.activeServerId;
            const list = [];
            const sockets = srvId ? (io.sockets.adapter.rooms.get(srvId) || new Set()) : io.sockets.sockets.keys();
            for (const sid of sockets) {
                const s = io.sockets.sockets.get(sid);
                if (s && s.username && sid !== socket.id) {
                    const prof = getPlayerRpg(s.username);
                    const st = computeFighterStats(prof);
                    list.push({ id: sid, username: s.username, fighterName: st.fighter.name, fighterId: st.fighter.id, lvl: st.lvl });
                }
            }
            socket.emit('rpgRoomPlayersList', list);
        });
        socket.on('rpgChallengePlayer', ({ targetSocketId }) => {
            const targetSock = io.sockets.sockets.get(targetSocketId);
            if (!targetSock || !socket.username) return socket.emit('rpgToast', '⚠️ Player is offline!');

            const p1Prof = getPlayerRpg(socket.username);
            const p2Prof = getPlayerRpg(targetSock.username);
            const s1 = computeFighterStats(p1Prof);
            const s2 = computeFighterStats(p2Prof);

            const battleId = 'pvp_' + Date.now();
            const duel = {
                id: battleId,
                srvId: socket.activeServerId,
                turnSocketId: socket.id,
                lastSig: null,
                p1: {
                    socketId: socket.id, username: socket.username,
                    fighter: s1.fighter, lvl: s1.lvl, infinite: s1.infinite,
                    hp: s1.infinite ? 999999999 : s1.maxHp, maxHp: s1.infinite ? 999999999 : s1.maxHp,
                    atk: s1.infinite ? 999999999 : s1.atk, shield: 0, cds: new Array(0, 0, 0, 0)
                },
                p2: {
                    socketId: targetSock.id, username: targetSock.username,
                    fighter: s2.fighter, lvl: s2.lvl, infinite: s2.infinite,
                    hp: s2.infinite ? 999999999 : s2.maxHp, maxHp: s2.infinite ? 999999999 : s2.maxHp,
                    atk: s2.infinite ? 999999999 : s2.atk, shield: 0, cds: new Array(0, 0, 0, 0)
                },
                log: `⚔️ ${socket.username} (${s1.fighter.name}) vs ${targetSock.username} (${s2.fighter.name})! ${socket.username}'s turn!`
            };

            livePvpBattles.set(battleId, duel);
            io.to(socket.id).emit('rpgPvpStart', duel);
            io.to(targetSock.id).emit('rpgPvpStart', duel);

            if (socket.activeServerId) {
                io.to(socket.activeServerId).emit('message', {
                    username: "Sammu's Bot",
                    text: `⚔️🔥 **AVATAR PVP DUEL!** **${socket.username}** (${s1.fighter.name}) challenged **${targetSock.username}** (${s2.fighter.name})!`,
                    _serverId: socket.activeServerId
                });
            }
        });

        socket.on('rpgPvpUseSkill', ({ battleId, skillIdx }) => {
            const duel = livePvpBattles.get(battleId);
            if (!duel || duel.turnSocketId !== socket.id) return;

            const isP1 = (duel.p1.socketId === socket.id);
            const me = isP1 ? duel.p1 : duel.p2;
            const opp = isP1 ? duel.p2 : duel.p1;
            const sk = me.fighter.skills.at(skillIdx);
            if (!sk || me.cds.at(skillIdx) > 0) return;

            me.cds = me.cds.map(c => Math.max(0, c - 1));
            me.cds[skillIdx] = sk.cd;
            duel.lastSig = sk.sig ? { user: me.username, skill: sk.name, icon: me.fighter.icon, color: me.fighter.color } : null;

            if (me.infinite) {
                opp.hp = 0;
                duel.log = `🦚👑 ${me.username} unleashed ${sk.name} — ∞ ONE-SHOT ANNIHILATION!`;
            } else if (sk.type === 'dmg' || sk.type === 'lifesteal') {
                if (opp.infinite) {
                    duel.log = `🛡️ ${opp.username} has ∞ GOD IMMUNITY! 0 DMG taken!`;
                } else {
                    const rawDmg = Math.round(me.atk * sk.mult);
                    const finalDmg = Math.max(1, Math.round(rawDmg * (1 - opp.shield)));
                    opp.shield = 0;
                    opp.hp = Math.max(0, opp.hp - finalDmg);
                    let extraLog = '';
                    if (sk.type === 'lifesteal') {
                        const drain = Math.round(finalDmg * 0.20);
                        me.hp = Math.min(me.maxHp, me.hp + drain);
                        extraLog = ` & drained +${drain.toLocaleString()} HP!`;
                    }
                    duel.log = `${sk.sig ? '🌟 SIGNATURE! ' : ''}${me.fighter.icon} ${me.username} used ${sk.name} for ${finalDmg.toLocaleString()} DMG${extraLog}`;
                }
            } else if (sk.type === 'heal') {
                const healAmt = Math.round(me.maxHp * sk.mult);
                me.hp = Math.min(me.maxHp, me.hp + healAmt);
                duel.log = `${sk.sig ? '🌟 SIGNATURE! ' : '💚 '}${me.username} cast ${sk.name} and regained +${healAmt.toLocaleString()} HP!`;
            } else if (sk.type === 'shield') {
                me.shield = 0.85;
                duel.log = `🛡️ ${me.username} activated ${sk.name} (85% DMG Reduction)!`;
            }

            if (opp.hp > 0 && me.fighter.regenPct && !me.infinite && me.hp < me.maxHp) {
                const regenAmt = Math.round(me.maxHp * me.fighter.regenPct);
                me.hp = Math.min(me.maxHp, me.hp + regenAmt);
                duel.log += ` | 🌙 Medic Regen: +${regenAmt.toLocaleString()} HP!`;
            }

            if (opp.hp <= 0) {
                livePvpBattles.delete(battleId);
                const winProf = getPlayerRpg(me.username);
                if (winProf) {
                    winProf.gold += 150;
                    winProf.mvp += 3;
                    if (!me.infinite && !me.fighter.fixedLevel) {
                        const st = winProf.owned[me.fighter.id] || { lvl: 1, xp: 0 };
                        st.xp += 120;
                        while (st.xp >= st.lvl * 100) { st.xp -= st.lvl * 100; st.lvl += 1; }
                        winProf.owned[me.fighter.id] = st;
                    }
                    saveRpg();
                }
                io.to(duel.p1.socketId).emit('rpgPvpEnd', { duel, winner: me.username });
                io.to(duel.p2.socketId).emit('rpgPvpEnd', { duel, winner: me.username });
                if (duel.srvId) {
                    io.to(duel.srvId).emit('message', {
                        username: "Sammu's Bot",
                        text: `🏆⚔️ **PVP CHAMPION!** **${me.username}** (${me.fighter.name}) defeated **${opp.username}** and won **+150 Gold & +3 MVP**!`,
                        _serverId: duel.srvId
                    });
                }
                return;
            }

            duel.turnSocketId = opp.socketId;
            io.to(duel.p1.socketId).emit('rpgPvpUpdate', duel);
            io.to(duel.p2.socketId).emit('rpgPvpUpdate', duel);
        });
        socket.on('rpgOpenBundle', (uname) => {
            const p = getPlayerRpg(uname);
            if (!p) return;
            if (p.mvp < 10) return socket.emit('rpgToast', '❌ Need 10 MVP Points! Win PvP or Mini-Games!');
            p.mvp -= 10;
            const won = rollGachaBundle();
            let bonusText = '';
            if (p.owned[won.id]) {
                p.owned[won.id].xp += 120;
                p.gold += 80;
                bonusText = ' (Duplicate → +120 XP & +80 Gold!)';
            } else {
                p.owned[won.id] = { lvl: 1, xp: 0 };
                p.activeChar = won.id;
            }
            saveRpg();
            socket.emit('rpgBundleResult', { fighter: won, bonusText, profile: p });
            if ((won.tier === 'Legendary' || won.tier === 'Mythic') && socket.activeServerId) {
                io.to(socket.activeServerId).emit('message', {
                    username: "Sammu's Bot",
                    text: `🎰🔥 **GACHA JACKPOT!** **${uname}** pulled **[${won.tier.toUpperCase()}] ${won.name}**! 🎉`,
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
            if (p && p.owned[fighterId]) {
                p.activeChar = fighterId;
                saveRpg();
                socket.emit('rpgStateSync', { profile: p, fighters: RPG_FIGHTERS, accessories: RPG_ACCESSORIES });
            }
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
            const f = RPG_FIGHTERS[p.activeChar] || RPG_FIGHTERS.gunner;
            const mult = enemyTier === 'boss' ? 3 : 1;
            const xpGain = 70 * mult, goldGain = 80 * mult;
            p.gold += goldGain;
            if (!f.infinite && !f.fixedLevel) {
                const st = p.owned[f.id] || { lvl: 1, xp: 0 };
                st.xp += xpGain;
                while (st.xp >= st.lvl * 100) { st.xp -= st.lvl * 100; st.lvl += 1; }
                p.owned[f.id] = st;
            }
            saveRpg();
            socket.emit('rpgStateSync', { profile: p, fighters: RPG_FIGHTERS, accessories: RPG_ACCESSORIES });
            socket.emit('rpgToast', `🏆 Grind Victory! +${xpGain} XP & +${goldGain} Gold!`);
        });
    });
    const COMBINED_UI = `
    <style>
      @keyframes sudarshanSpin3D {
        0%   { transform: perspective(220px) rotateX(56deg) rotateY(-14deg) rotateZ(0deg); }
        50%  { transform: perspective(220px) rotateX(50deg) rotateY(14deg) rotateZ(180deg); }
        100% { transform: perspective(220px) rotateX(56deg) rotateY(-14deg) rotateZ(360deg); }
      }
      @keyframes chakraFirePulse {
        0%, 100% { filter: drop-shadow(0 0 6px #fde047) drop-shadow(0 0 14px #f97316); }
        50%      { filter: drop-shadow(0 0 12px #38bdf8) drop-shadow(0 0 22px #fde047); }
      }
      @keyframes divineAuraRing {
        0%, 100% { box-shadow: 0 0 12px #fde047, 0 0 24px #f97316; border-color: #fde047; }
        50%      { box-shadow: 0 0 18px #38bdf8, 0 0 32px #fde047; border-color: #38bdf8; }
      }
      @keyframes empressAuraRing {
        0%, 100% { box-shadow: 0 0 12px #f472b6, 0 0 22px #fbcfe8; border-color: #fbcfe8; }
        50%      { box-shadow: 0 0 18px #ec4899, 0 0 28px #fde047; border-color: #f472b6; }
      }
      @keyframes solarAuraRing {
        0%, 100% { box-shadow: 0 0 12px #facc15, 0 0 24px #f59e0b; border-color: #fef08a; }
        50%      { box-shadow: 0 0 20px #ea580c, 0 0 30px #fde047; border-color: #f59e0b; }
      }

      .sudarshan-3d-disc { transform-origin: 50px 44px; animation: sudarshanSpin3D 5s linear infinite, chakraFirePulse 2.2s ease-in-out infinite; }
      .v14-ring-samaksh { border: 2.5px solid #fde047 !important; animation: divineAuraRing 2.2s infinite !important; }
      .v14-ring-empress { border: 2.5px solid #fbcfe8 !important; animation: empressAuraRing 2.2s infinite !important; }
      .v14-ring-solar   { border: 2.5px solid #fef08a !important; animation: solarAuraRing 2.2s infinite !important; }
      .v14-ring-violet  { border: 2px solid #c084fc !important; box-shadow: 0 0 10px #9333ea !important; }
      .v14-ring-emerald { border: 2px solid #4ade80 !important; box-shadow: 0 0 10px #10b981 !important; }
      .v14-ring-gold    { border: 2px solid #fde047 !important; box-shadow: 0 0 9px #eab308 !important; }

      .v14-chat-samaksh { background: linear-gradient(125deg, rgba(253,224,71,0.32), rgba(249,115,22,0.24), rgba(56,189,248,0.28)) !important; border: 2px solid #fde047 !important; border-radius: 15px !important; box-shadow: 0 0 18px rgba(253,224,71,0.35) !important; color: #fff !important; font-weight: 800 !important; }
      .v14-chat-empress { background: linear-gradient(135deg, rgba(244,114,182,0.35), rgba(251,207,232,0.24), rgba(253,224,71,0.22)) !important; border: 2px solid #fbcfe8 !important; border-radius: 15px !important; color: #fff !important; font-weight: 800 !important; }
      .v14-chat-solar   { background: linear-gradient(135deg, rgba(250,204,21,0.32), rgba(234,88,12,0.25)) !important; border: 2px solid #fef08a !important; border-radius: 15px !important; color: #fff !important; font-weight: 800 !important; }
      .v14-chat-host    { background: rgba(30, 41, 59, 0.8) !important; border: 1.5px solid #38bdf8 !important; border-radius: 12px !important; }

      .v14-bubble { position:relative !important; display:inline-flex !important; width:46px !important; height:46px !important; border-radius:50% !important; overflow:hidden !important; vertical-align:middle !important; margin-right:7px !important; background:#050814 !important; flex-shrink:0 !important; cursor:pointer !important; }
      .v14-bubble img, .st-art img { width:100% !important; height:100% !important; object-fit:cover !important; border-radius:50% !important; }
      .v14-pin { position:absolute; bottom:-2px; right:-2px; font-size:13px; filter:drop-shadow(0 1px 2px #000); }
      .v14-title-pill { display:inline-block; font-size:9px; font-weight:900; padding:1px 6px; border-radius:8px; margin-left:5px; background:#1e1b4b; border:1px solid #fde047; color:#fde047; vertical-align:middle; }

      #stVaultModal, #rpgArenaModal { display:none; position:fixed; inset:0; background:rgba(4,7,18,0.96); z-index:999999998; align-items:center; justify-content:center; padding:8px; }
      #stVaultCard, #rpgCard { background:linear-gradient(160deg,#090d16,#1e1b4b); border:2px solid #fde047; border-radius:20px; padding:12px; width:100%; max-width:440px; color:#fff; max-height:92vh; overflow-y:auto; box-shadow:0 0 40px rgba(253,224,71,0.35); }
      .st-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:7px; margin:8px 0; }
      .st-item { background:rgba(255,255,255,0.08); border:1.5px solid rgba(56,189,248,0.45); border-radius:12px; padding:7px 4px; cursor:pointer; text-align:center; }
      .st-art { position:relative; width:66px; height:66px; margin:0 auto 4px auto; border-radius:50%; overflow:hidden; background:#090d16; }

      .rpg-tabs { display:flex; gap:4px; margin:8px 0; }
      .rpg-tab { flex:1; padding:6px 3px; border-radius:9px; border:1px solid #38bdf8; background:#1e293b; color:#fff; font-size:10px; font-weight:900; cursor:pointer; }
      .rpg-tab.active { background:linear-gradient(90deg,#f59e0b,#ec4899); border-color:#fde047; }
      .rpg-skill-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:8px; }
      .rpg-skill-btn { background:linear-gradient(145deg,#1e293b,#0f172a); border:1.5px solid #38bdf8; color:#fff; padding:8px 6px; border-radius:10px; font-size:11px; font-weight:800; cursor:pointer; text-align:left; }
      .rpg-skill-btn.sig { border-color:#fde047; background:linear-gradient(145deg,#451a03,#311042); box-shadow:0 0 10px rgba(253,224,71,0.3); }
      .rpg-skill-btn:disabled { opacity:0.4; cursor:not-allowed; }
      #rpgStageCanvas { width:100%; height:175px; border-radius:14px; border:2px solid #fde047; background:#050814; display:block; margin:6px 0; }
    </style>
    <div id="stVaultModal" onclick="if(event.target===this)this.style.display='none'">
      <div id="stVaultCard">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:900;font-size:15px;color:#38bdf8;">🦚 SAMMU DIVINE AVATAR ARMORY</span>
          <button onclick="document.getElementById('stVaultModal').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:8px;padding:4px 10px;font-weight:900;">✕</button>
        </div>
        <div class="st-grid" id="stGrid"></div>
        <div style="display:flex;gap:6px;margin-top:6px;">
          <input id="stCodeInput" placeholder="Code (#sammuop, #millyqueen, #ishikagold)..." style="flex:1;padding:8px;border-radius:10px;border:1.5px solid #c084fc;background:#090d16;color:#fff;font-size:12px;">
          <button onclick="stRedeemCode()" style="padding:8px 12px;background:linear-gradient(90deg,#a855f7,#ec4899);border:none;color:#fff;border-radius:10px;font-weight:bold;font-size:12px;">🔓 Unlock</button>
        </div>
      </div>
    </div>

    <div id="rpgArenaModal" onclick="if(event.target===this)this.style.display='none'">
      <div id="rpgCard">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:900;font-size:15px;color:#fde047;">⚔️ AVATAR PVP & SIGNATURE ARENA</span>
          <button onclick="document.getElementById('rpgArenaModal').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:8px;padding:4px 10px;font-weight:900;">✕</button>
        </div>
        <div id="rpgTopStats" style="display:flex;justify-content:space-between;background:rgba(255,255,255,0.07);padding:6px 10px;border-radius:10px;margin-top:6px;font-size:11px;font-weight:900;"></div>
        <div class="rpg-tabs">
          <button class="rpg-tab active" onclick="switchRpgTab('pvp',this)">⚔️ Live PvP</button>
          <button class="rpg-tab" onclick="switchRpgTab('grind',this)">🐺 Grind Lvl</button>
          <button class="rpg-tab" onclick="switchRpgTab('gacha',this)">🎰 Gacha</button>
          <button class="rpg-tab" onclick="switchRpgTab('heroes',this)">🦸 Classes</button>
          <button class="rpg-tab" onclick="switchRpgTab('shop',this)">🗡️ Gear</button>
        </div>
        <div id="rpgBody"></div>
      </div>
    </div>

    <script>
    (function() {
      // === PIECE 10: ULTRA PRO MAX SVG PORTRAITS (MILLY, ISHIKA, MOON, ZORO, SUS) ===
      const MILLY_EMPRESS_URI = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        '<svg xmlns="http://w3.org" viewBox="0 0 100 100">' +
          '<defs>' +
            '<radialGradient id="mlBg" cx="50%" cy="30%" r="74%"><stop offset="0%" stop-color="#fdf2f8"/><stop offset="35%" stop-color="#f472b6"/><stop offset="70%" stop-color="#9d174d"/><stop offset="100%" stop-color="#19041f"/></radialGradient>' +
            '<linearGradient id="mlDress" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fbcfe8"/><stop offset="45%" stop-color="#ec4899"/><stop offset="100%" stop-color="#701a75"/></linearGradient>' +
            '<linearGradient id="mlTiara" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#fef9c3"/><stop offset="50%" stop-color="#facc15"/><stop offset="100%" stop-color="#f472b6"/></linearGradient>' +
          '</defs>' +
          '<circle cx="50" cy="50" r="49" fill="url(#mlBg)"/>' +
          '<circle cx="50" cy="46" r="44" fill="none" stroke="#fbcfe8" stroke-width="2.2" stroke-dasharray="5 3"/>' +
          '<path d="M14,42 C8,72 14,95 23,99 L77,99 C86,95 92,72 86,42 C86,15 14,15 14,42 Z" fill="#4a0e4e"/>' +
          '<path d="M14,99 C18,72 32,65 50,65 C68,65 82,72 86,99 Z" fill="url(#mlDress)" stroke="#fdf2f8" stroke-width="1.6"/>' +
          '<polygon points="50,71 56,78 50,86 44,78" fill="#38bdf8" stroke="#fff" stroke-width="1.4"/>' +
          '<path d="M33,32 C33,25 67,25 67,32 L66,49 C65,59 56,65 50,66.5 C44,65 35,59 34,49 Z" fill="#ffe4e6"/>' +
          '<ellipse cx="41" cy="50" rx="4.4" ry="3.9" fill="#fff"/><circle cx="41" cy="50" r="2.7" fill="#db2777"/><circle cx="42.3" cy="48.7" r="1.3" fill="#fff"/>' +
          '<ellipse cx="59" cy="50" rx="4.4" ry="3.9" fill="#fff"/><circle cx="59" cy="50" r="2.7" fill="#db2777"/><circle cx="60.3" cy="48.7" r="1.3" fill="#fff"/>' +
          '<path d="M45,58.5 Q50,62.5 55,58.5" stroke="#be185d" stroke-width="2" fill="none" stroke-linecap="round"/>' +
          '<path d="M25,45 C25,19 75,19 75,45 C67,33 56,33 50,41 C44,33 33,33 25,45 Z" fill="#6b21a8"/>' +
          '<polygon points="29,24 35,10 42,18 50,4 58,18 65,10 71,24" fill="url(#mlTiara)" stroke="#fff" stroke-width="1.3"/>' +
          '<circle cx="50" cy="14" r="2.6" fill="#f43f5e"/>' +
        '</svg>'
      );

      const ISHIKA_SUN_URI = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        '<svg xmlns="http://w3.org" viewBox="0 0 100 100">' +
          '<defs>' +
            '<radialGradient id="isBg" cx="50%" cy="32%" r="74%"><stop offset="0%" stop-color="#fef9c3"/><stop offset="38%" stop-color="#f59e0b"/><stop offset="75%" stop-color="#9a3412"/><stop offset="100%" stop-color="#1c0a00"/></radialGradient>' +
            '<linearGradient id="isGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fef08a"/><stop offset="50%" stop-color="#eab308"/><stop offset="100%" stop-color="#854d0e"/></linearGradient>' +
          '</defs>' +
          '<circle cx="50" cy="50" r="49" fill="url(#isBg)"/>' +
          '<circle cx="50" cy="46" r="43" fill="none" stroke="#fef08a" stroke-width="2.5" stroke-dasharray="6 3"/>' +
          '<polygon points="50,2 53,10 47,10" fill="#fef08a"/><polygon points="18,14 24,20 19,23" fill="#fef08a"/><polygon points="82,14 76,20 81,23" fill="#fef08a"/>' +
          '<path d="M15,43 C9,72 15,95 24,99 L76,99 C85,95 91,72 85,43 C85,16 15,16 15,43 Z" fill="#451a03"/>' +
          '<path d="M15,99 C19,72 33,65 50,65 C67,65 81,72 85,99 Z" fill="url(#isGold)" stroke="#fef9c3" stroke-width="1.6"/>' +
          '<polygon points="50,71 56,78 50,86 44,78" fill="#f97316" stroke="#fff" stroke-width="1.3"/>' +
          '<path d="M33,32 C33,25 67,25 67,32 L66,49 C65,59 56,65 50,66.5 C44,65 35,59 34,49 Z" fill="#ffedd5"/>' +
          '<ellipse cx="41" cy="50" rx="4.3" ry="3.8" fill="#fff"/><circle cx="41" cy="50" r="2.6" fill="#d97706"/><circle cx="42.2" cy="48.8" r="1.2" fill="#fff"/>' +
          '<ellipse cx="59" cy="50" rx="4.3" ry="3.8" fill="#fff"/><circle cx="59" cy="50" r="2.6" fill="#d97706"/><circle cx="60.2" cy="48.8" r="1.2" fill="#fff"/>' +
          '<path d="M45,58.5 Q50,62.5 55,58.5" stroke="#b45309" stroke-width="2" fill="none" stroke-linecap="round"/>' +
          '<path d="M26,45 C26,20 74,20 74,45 C66,33 56,33 50,41 C44,33 34,33 26,45 Z" fill="#78350f"/>' +
          '<polygon points="31,24 38,11 45,19 50,6 55,19 62,11 69,24" fill="url(#isGold)" stroke="#fff" stroke-width="1.3"/>' +
        '</svg>'
      );

      const MOON_MEDIC_URI = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        '<svg xmlns="http://w3.org" viewBox="0 0 100 100">' +
          '<defs>' +
            '<radialGradient id="mnBg" cx="50%" cy="30%" r="72%"><stop offset="0%" stop-color="#e0e7ff"/><stop offset="40%" stop-color="#7c3aed"/><stop offset="100%" stop-color="#090d16"/></radialGradient>' +
            '<linearGradient id="mnCoat" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#cbd5e1"/></linearGradient>' +
          '</defs>' +
          '<circle cx="50" cy="50" r="49" fill="url(#mnBg)"/>' +
          '<path d="M68,14 A28,28 0 1,0 84,54 A22,22 0 1,1 68,14 Z" fill="#fde047" opacity="0.88"/>' +
          '<rect x="15" y="18" width="12" height="4" rx="1.5" fill="#4ade80"/><rect x="19" y="14" width="4" height="12" rx="1.5" fill="#4ade80"/>' +
          '<path d="M18,44 C12,72 17,95 25,99 L75,99 C83,95 88,72 82,44 C82,17 18,17 18,44 Z" fill="#1e1b4b"/>' +
          '<path d="M16,99 C20,73 33,66 50,66 C67,66 80,73 84,99 Z" fill="url(#mnCoat)" stroke="#38bdf8" stroke-width="1.5"/>' +
          '<path d="M36,68 Q36,86 50,86 Q64,86 64,68" fill="none" stroke="#0284c7" stroke-width="2.5"/>' +
          '<circle cx="50" cy="88" r="4" fill="#38bdf8" stroke="#fff" stroke-width="1.2"/>' +
          '<path d="M33,32 C33,25 67,25 67,32 L66,49 C65,59 56,65 50,66.5 C44,65 35,59 34,49 Z" fill="#ffedd5"/>' +
          '<ellipse cx="41" cy="50" rx="4.2" ry="3.6" fill="#fff"/><circle cx="41" cy="50" r="2.5" fill="#7c3aed"/><circle cx="42.2" cy="48.8" r="1.2" fill="#fff"/>' +
          '<ellipse cx="59" cy="50" rx="4.2" ry="3.6" fill="#fff"/><circle cx="59" cy="50" r="2.5" fill="#7c3aed"/><circle cx="60.2" cy="48.8" r="1.2" fill="#fff"/>' +
          '<path d="M45,58.5 Q50,62 55,58.5" stroke="#be185d" stroke-width="2" fill="none" stroke-linecap="round"/>' +
          '<path d="M26,45 C26,20 74,20 74,45 C66,33 56,33 50,41 C44,33 34,33 26,45 Z" fill="#312e81"/>' +
        '</svg>'
      );

      const ZORO_SWORD_URI = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        '<svg xmlns="http://w3.org" viewBox="0 0 100 100">' +
          '<circle cx="50" cy="50" r="49" fill="#052e16"/>' +
          '<line x1="8" y1="60" x2="92" y2="96" stroke="#f8fafc" stroke-width="4" stroke-linecap="round"/>' +
          '<line x1="92" y1="60" x2="8" y2="96" stroke="#4ade80" stroke-width="4" stroke-linecap="round"/>' +
          '<path d="M16,98 C19,73 33,66 50,66 C67,66 81,73 84,98 Z" fill="#14532d" stroke="#4ade80" stroke-width="1.5"/>' +
          '<path d="M32,31 C32,24 68,24 68,31 L67,48 C66,58 57,65 50,66.5 C43,65 34,58 33,48 Z" fill="#fcd3b2"/>' +
          '<polygon points="24,44 19,21 34,28 41,11 50,24 59,11 66,28 81,21 76,44 63,34 50,39 37,34" fill="#16a34a"/>' +
          '<rect x="30" y="30" width="40" height="5" rx="2" fill="#052e16" stroke="#4ade80" stroke-width="1.2"/>' +
          '<ellipse cx="41" cy="50" rx="4" ry="3.3" fill="#fff"/><circle cx="41" cy="50" r="2.2" fill="#15803d"/><line x1="38" y1="44" x2="43" y2="56" stroke="#991b1b" stroke-width="1.8"/>' +
          '<ellipse cx="59" cy="50" rx="4" ry="3.3" fill="#fff"/><circle cx="59" cy="50" r="2.2" fill="#15803d"/>' +
          '<path d="M44,59 Q50,62 56,58" stroke="#7f1d1d" stroke-width="2" fill="none"/>' +
        '</svg>'
      );

      const SUS_FAIRY_URI = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        '<svg xmlns="http://w3.org" viewBox="0 0 100 100">' +
          '<circle cx="50" cy="50" r="49" fill="#064e3b"/>' +
          '<path d="M8,40 Q20,14 38,42 Q18,54 8,40 Z M92,40 Q80,14 62,42 Q82,54 92,40 Z" fill="#a7f3d0" opacity="0.8" stroke="#fde047" stroke-width="1.2"/>' +
          '<path d="M15,44 C9,72 14,94 23,99 L77,99 C86,94 91,72 85,44 C85,17 15,17 15,44 Z" fill="#059669"/>' +
          '<path d="M16,98 C19,73 33,66 50,66 C67,66 81,73 84,98 Z" fill="#047857" stroke="#fde047" stroke-width="1.5"/>' +
          '<path d="M32,31 C32,24 68,24 68,31 L67,48 C66,58 57,65 50,66.5 C43,65 34,58 33,48 Z" fill="#fff1f2"/>' +
          '<ellipse cx="41" cy="50" rx="4.2" ry="3.8" fill="#fff"/><circle cx="41" cy="50" r="2.6" fill="#059669"/><circle cx="42.2" cy="48.8" r="1.2" fill="#fff"/>' +
          '<ellipse cx="59" cy="50" rx="4.2" ry="3.8" fill="#fff"/><circle cx="59" cy="50" r="2.6" fill="#059669"/><circle cx="60.2" cy="48.8" r="1.2" fill="#fff"/>' +
          '<path d="M45,58.5 Q50,63 55,58.5" stroke="#e11d48" stroke-width="2" fill="none" stroke-linecap="round"/>' +
          '<polygon points="31,24 37,10 44,19 50,5 56,19 63,10 69,24" fill="#fde047" stroke="#fff" stroke-width="1.3"/>' +
        '</svg>'
      );
      // === PIECE 11: CUSTOM SVG PORTRAITS FOR SID, SHUBHI, SARAH, HEER, IZZAN, ZAIRA, ADVAIT, RUWII ===
      function makeHostPortrait(bg1, bg2, hair, armor, accent, crownType) {
        return 'data:image/svg+xml;utf8,' + encodeURIComponent(
          '<svg xmlns="http://w3.org" viewBox="0 0 100 100">' +
            '<defs><radialGradient id="hg" cx="50%" cy="32%" r="72%"><stop offset="0%" stop-color="' + bg1 + '"/><stop offset="100%" stop-color="' + bg2 + '"/></radialGradient></defs>' +
            '<circle cx="50" cy="50" r="49" fill="url(#hg)"/>' +
            '<circle cx="50" cy="46" r="43" fill="none" stroke="' + accent + '" stroke-width="2.2" stroke-dasharray="5 3"/>' +
            '<path d="M16,98 C19,73 33,66 50,66 C67,66 81,73 84,98 Z" fill="' + armor + '" stroke="' + accent + '" stroke-width="1.5"/>' +
            '<polygon points="50,71 56,78 50,86 44,78" fill="' + accent + '" stroke="#fff" stroke-width="1.2"/>' +
            '<path d="M33,32 C33,25 67,25 67,32 L66,49 C65,59 56,65 50,66.5 C44,65 35,59 34,49 Z" fill="#ffedd5"/>' +
            '<path d="M26,44 C25,21 75,21 74,44 C66,33 56,33 50,40 C44,33 34,33 26,44 Z" fill="' + hair + '"/>' +
            (crownType === 'tiara'
              ? '<polygon points="31,24 38,11 45,19 50,6 55,19 62,11 69,24" fill="' + accent + '" stroke="#fff" stroke-width="1.2"/>'
              : '<polygon points="34,25 42,13 50,21 58,13 66,25" fill="' + accent + '" stroke="#fff" stroke-width="1.2"/>') +
            '<ellipse cx="41" cy="50" rx="4.2" ry="3.5" fill="#fff"/><circle cx="41" cy="50" r="2.4" fill="' + bg2 + '"/><circle cx="42" cy="49" r="1.1" fill="#fff"/>' +
            '<ellipse cx="59" cy="50" rx="4.2" ry="3.5" fill="#fff"/><circle cx="59" cy="50" r="2.4" fill="' + bg2 + '"/><circle cx="60" cy="49" r="1.1" fill="#fff"/>' +
            '<path d="M45,58.5 Q50,62 55,58.5" stroke="#7f1d1d" stroke-width="2" fill="none" stroke-linecap="round"/>' +
          '</svg>'
        );
      }

      const SID_THUNDER_URI  = makeHostPortrait('#fde047', '#1e3a8a', '#0f172a', '#1d4ed8', '#facc15', 'helm');
      const SHUBHI_ROSE_URI  = makeHostPortrait('#fbcfe8', '#831843', '#4a0e4e', '#db2777', '#f472b6', 'tiara');
      const SARAH_VALK_URI   = makeHostPortrait('#bae6fd', '#0c4a6e', '#1e293b', '#0284c7', '#38bdf8', 'tiara');
      const HEER_STAR_URI    = makeHostPortrait('#fecdd3', '#881337', '#3b0764', '#e11d48', '#fda4af', 'tiara');
      const IZZAN_DRAGON_URI = makeHostPortrait('#fed7aa', '#7f1d1d', '#18181b', '#dc2626', '#fb923c', 'helm');
      const ZAIRA_NOVA_URI   = makeHostPortrait('#c7d2fe', '#1e1b4b', '#090d16', '#4f46e5', '#818cf8', 'tiara');
      const ADVAIT_TITAN_URI = makeHostPortrait('#93c5fd', '#172554', '#0f172a', '#1e40af', '#60a5fa', 'helm');
      const RUWII_FOX_URI    = makeHostPortrait('#fde68a', '#7c2d12', '#451a03', '#ea580c', '#fbbf24', 'tiara');
      // === PIECE 12: COMPLETE AVATAR ROSTER & 2.5D BATTLE STAGE RENDERER ===
      function dbUrl(s, seed, bg) { return 'https://dicebear.com' + s + '/svg?seed=' + encodeURIComponent(seed) + '&backgroundColor=' + bg; }

      const AVATAR_ITEMS = [
        { id: 'superhost',      name: '🦚👑 SAMAKSH (GOD OP++)',    ring: 'v14-ring-samaksh', req: 'code', featured: true, img: KRISHNA_URI },
        { id: 'host_milly',     name: '👸💖 Princess Milly',        ring: 'v14-ring-empress', req: 'code', featured: true, img: MILLY_EMPRESS_URI },
        { id: 'host_ishika',    name: '☀️✨ Empress Ishika',        ring: 'v14-ring-gold',    req: 'code', featured: true, img: ISHIKA_SUN_URI },
        { id: 'host_moon',      name: '🩺🌙 Dr. Moon (Medic)',      ring: 'v14-ring-violet',  req: 'code', img: MOON_MEDIC_URI },
        { id: 'host_zoro',      name: '⚔️🐉 Zoro 3-Sword',          ring: 'v14-ring-emerald', req: 'code', img: ZORO_SWORD_URI },
        { id: 'host_sus',       name: '👸💚 Princess Sus',          ring: 'v14-ring-emerald', req: 'code', img: SUS_FAIRY_URI },
        { id: 'host_sid',       name: '😎⚡ Sid Thunder',           ring: 'v14-ring-gold',    req: 'code', img: SID_THUNDER_URI },
        { id: 'host_shubhi',    name: '🌷 Shubhi Sakura',           ring: 'v14-ring-empress', req: 'code', img: SHUBHI_ROSE_URI },
        { id: 'host_sarah',     name: '🦋 Sarah Valkyrie',          ring: 'v14-ring-ice',     req: 'code', img: SARAH_VALK_URI },
        { id: 'host_heer',      name: '🌸 Heer Starlight',          ring: 'v14-ring-empress', req: 'code', img: HEER_STAR_URI },
        { id: 'host_izzan',     name: '🔥 Izzan Dragon',            ring: 'v14-ring-fire',    req: 'code', img: IZZAN_DRAGON_URI },
        { id: 'host_zaira',     name: '🪐 Zaira Nova',              ring: 'v14-ring-violet',  req: 'code', img: ZAIRA_NOVA_URI },
        { id: 'host_advait',    name: '⚡ Advait Titan',            ring: 'v14-ring-ice',     req: 'code', img: ADVAIT_TITAN_URI },
        { id: 'host_ruwii',     name: '🌺 Ruwii Kitsune',           ring: 'v14-ring-gold',    req: 'code', img: RUWII_FOX_URI },
        // Normal Gacha Classes
        { id: 'gunner',         name: '🔫 Cyber Gunner',            ring: 'v14-ring-ice',     req: 'free', img: dbUrl('bottts-neutral','CyberGunner01','0284c7') },
        { id: 'swordsman',      name: '⚔️ Blade Swordsman',         ring: 'v14-ring-gold',    req: 'free', img: dbUrl('adventurer','BladeSwordsman02','475569') },
        { id: 'fire_mage',      name: '🔥 Inferno Pyromancer',      ring: 'v14-ring-fire',    req: 'free', img: dbUrl('adventurer','InfernoMage03','ea580c') },
        { id: 'water_bender',   name: '🌊 Tidal Hydromancer',       ring: 'v14-ring-ice',     req: 'free', img: dbUrl('lorelei','TidalWater04','0284c7') },
        { id: 'lightning_lord', name: '⚡ Raijin Storm Lord',       ring: 'v14-ring-gold',    req: 'free', img: dbUrl('adventurer','RaijinBolt05','eab308') },
        { id: 'rubber_hero',    name: '🥊 Gear Rubber Champion',    ring: 'v14-ring-fire',    req: 'free', img: dbUrl('adventurer','GearRubber06','e11d48') },
        { id: 'spacetime_god',  name: '🌌 Chronos Space-Time',      ring: 'v14-ring-violet',  req: 'free', img: dbUrl('lorelei','ChronosVoid07','6d28d9') }
      ];

      const imgCache = {};
      AVATAR_ITEMS.forEach(item => { const im = new Image(); im.src = item.img; imgCache[item.id] = im; });

      const playersMap = {};
      let rpgData = null, curTab = 'pvp', grindState = null, livePvp = null, roomOpponents = [], animId = null;

      function startStageCanvas(leftId, rightId, rightEmoji) {
        if (animId) cancelAnimationFrame(animId);
        let t = 0;
        function draw() {
          const c = document.getElementById('rpgStageCanvas');
          if (!c) return;
          const ctx = c.getContext('2d');
          t += 0.06;

          const grad = ctx.createLinearGradient(0, 0, 0, c.height);
          grad.addColorStop(0, '#090d16');
          grad.addColorStop(0.65, '#1e1b4b');
          grad.addColorStop(1, '#311042');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, c.width, c.height);

          ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
          ctx.lineWidth = 1;
          for (let i = 0; i <= 8; i++) {
            ctx.beginPath(); ctx.moveTo(i * 50, 115); ctx.lineTo((i - 4) * 95 + 200, 175); ctx.stroke();
          }

          // Left Pedestal & Avatar
          const ly = 90 + Math.sin(t) * 4;
          ctx.fillStyle = 'rgba(253, 224, 71, 0.28)';
          ctx.beginPath(); ctx.ellipse(90, 145, 44, 11, 0, 0, Math.PI * 2); ctx.fill();
          const lImg = imgCache[leftId] || imgCache['gunner'];
          ctx.save();
          ctx.strokeStyle = leftId === 'superhost' ? '#fde047' : (leftId === 'host_milly' ? '#f472b6' : '#38bdf8');
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(90, ly, 31, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(90, ly, 29, 0, Math.PI * 2); ctx.clip();
          if (lImg && lImg.complete) ctx.drawImage(lImg, 61, ly - 29, 58, 58);
          ctx.restore();

          // Right Pedestal & Opponent/Boss
          const ry = 90 + Math.cos(t * 1.1) * 4;
          ctx.fillStyle = 'rgba(244, 63, 94, 0.3)';
          ctx.beginPath(); ctx.ellipse(310, 145, 44, 11, 0, 0, Math.PI * 2); ctx.fill();
          if (rightId && imgCache[rightId]) {
            const rImg = imgCache[rightId];
            ctx.save();
            ctx.strokeStyle = rightId === 'superhost' ? '#fde047' : '#f43f5e';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(310, ry, 31, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(310, ry, 29, 0, Math.PI * 2); ctx.clip();
            if (rImg.complete) ctx.drawImage(rImg, 281, ry - 29, 58, 58);
            ctx.restore();
          } else {
            ctx.font = '50px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(rightEmoji || '👹', 310, ry);
          }

          ctx.fillStyle = '#fde047';
          ctx.font = '900 18px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('⚡ VS ⚡', 200, 88);

          animId = requestAnimationFrame(draw);
        }
        draw();
      }
      // === PIECE 13: USER IDENTITY HELPER, ARMORY VAULT & STATS CALCULATOR ===
      function getMe() {
        const s = window._savedUname || localStorage.getItem('sammu_username') || localStorage.getItem('username') || '';
        if (s && s.trim()) return s.trim().toLowerCase();
        const inp = document.querySelector('input[placeholder*="name" i], input[id*="name" i], input[id*="user" i]');
        return (inp && inp.value) ? inp.value.trim().toLowerCase() : 'player1';
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
            playersMap[me] = av;
            if (typeof socket !== 'undefined') {
              socket.emit('equipAvatarFxV6', { username: me, avatarId: av.id, fx: av.ring, badge: av.name });
              socket.emit('rpgSelectFighter', { username: me, fighterId: av.id });
            }
            document.getElementById('stVaultModal').style.display = 'none';
            renderChatAvatars();
          };
          grid.appendChild(d);
        });
      };

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
      // === PIECE 14: TAB SWITCHER & GRIND COMBAT ENGINE ===
      window.switchRpgTab = function(t, btn) {
        curTab = t;
        document.querySelectorAll('.rpg-tab').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        if (t === 'pvp' && typeof socket !== 'undefined') socket.emit('rpgGetRoomPlayers');
        renderRpgBody();
      };

      window.startGrindBattle = function(mode) {
        if (!rpgData) return;
        const p = rpgData.profile, f = rpgData.fighters[p.activeChar] || rpgData.fighters.gunner, st = calcStats(f, p), isBoss = mode === 'boss';
        grindState = {
          mode, fighter: f, pHp: st.maxHp, pMax: st.maxHp, pAtk: st.atk, shield: 0,
          cds: new Array(0, 0, 0, 0),
          eName: isBoss ? '👹 Abyssal Overlord' : '🐺 Shadow Wolf',
          eIcon: isBoss ? '👹' : '🐺',
          eHp: isBoss ? 3200 : 850, eMax: isBoss ? 3200 : 850, eAtk: isBoss ? 240 : 75,
          log: '⚔️ Choose one of your 4 unique skills!'
        };
        renderRpgBody();
      };

      window.useGrindSkill = function(idx) {
        if (!grindState || grindState.eHp <= 0) return;
        const b = grindState, sk = b.fighter.skills[idx];
        if (!sk || b.cds[idx] > 0) return;
        b.cds = b.cds.map(c => Math.max(0, c - 1));
        b.cds[idx] = sk.cd;

        if (b.fighter.infinite) {
          b.eHp = 0;
          b.log = '🦚👑 ' + sk.name + ' dealt ∞ ONE-SHOT DAMAGE!';
        } else if (sk.type === 'dmg' || sk.type === 'lifesteal') {
          const d = Math.round(b.pAtk * sk.mult);
          b.eHp = Math.max(0, b.eHp - d);
          let extra = '';
          if (sk.type === 'lifesteal' && b.pHp !== '∞') {
            const drain = Math.round(d * 0.20);
            b.pHp = Math.min(b.pMax, b.pHp + drain);
            extra = ' & drained +' + drain + ' HP!';
          }
          b.log = b.fighter.icon + ' ' + sk.name + ' hit for ' + d + ' DMG' + extra;
        } else if (sk.type === 'heal') {
          const h = Math.round(b.pMax * sk.mult);
          if (b.pHp !== '∞') b.pHp = Math.min(b.pMax, b.pHp + h);
          b.log = '💚 Regained +' + h + ' HP!';
        } else if (sk.type === 'shield') {
          b.shield = 0.80;
          b.log = '🛡️ 80% Damage Shield Active!';
        }

        if (b.eHp > 0 && b.fighter.regenPct && b.pHp !== '∞' && b.pHp < b.pMax) {
          const reg = Math.round(b.pMax * b.fighter.regenPct);
          b.pHp = Math.min(b.pMax, b.pHp + reg);
          b.log += ' | 🌙 Medic Regen +' + reg + ' HP!';
        }

        if (b.eHp <= 0) {
          if (typeof socket !== 'undefined') socket.emit('rpgClaimGrindWin', { username: getMe(), enemyTier: b.mode });
          renderRpgBody();
          return;
        }

        const ed = Math.round(b.eAtk * (1 - b.shield));
        b.shield = 0;
        if (b.pHp !== '∞') b.pHp = Math.max(0, b.pHp - ed);
        b.log += ' | Enemy hit for ' + ed + '!';
        renderRpgBody();
      };
      // === PART 1 OF 3: LIVE PVP & GRIND MODE UI RENDERER ===
      function renderRpgBody() {
        const body = document.getElementById('rpgBody'), top = document.getElementById('rpgTopStats');
        if (!body || !rpgData) return;
        const p = rpgData.profile, f = rpgData.fighters[p.activeChar] || rpgData.fighters.gunner, st = calcStats(f, p);
        top.innerHTML = '<span style="color:#fde047;">🪙 MVP: ' + p.mvp + '</span><span style="color:#fbbf24;">💰 Gold: ' + p.gold + '</span><span style="color:' + f.color + ';">' + f.name + ' (Lvl ' + st.lvl + ')</span>';

        if (curTab === 'pvp') {
          if (livePvp) {
            const isMyTurn = (typeof socket !== 'undefined' && livePvp.turnSocketId === socket.id);
            const meObj = (typeof socket !== 'undefined' && livePvp.p2.socketId === socket.id) ? livePvp.p2 : livePvp.p1;
            const oppObj = (meObj === livePvp.p1) ? livePvp.p2 : livePvp.p1;
            const myHpTxt = meObj.infinite ? '∞' : meObj.hp.toLocaleString();
            const oppHpTxt = oppObj.infinite ? '∞' : oppObj.hp.toLocaleString();
            const myPct = meObj.infinite ? 100 : Math.max(0, Math.round((meObj.hp / meObj.maxHp) * 100));
            const oppPct = oppObj.infinite ? 100 : Math.max(0, Math.round((oppObj.hp / oppObj.maxHp) * 100));

            body.innerHTML =
              '<div style="display:flex;justify-content:space-between;font-size:11px;font-weight:900;">' +
                '<span style="color:#4ade80;">' + meObj.username + ' (❤️ ' + myHpTxt + ')</span>' +
                '<span style="color:#f87171;">' + oppObj.username + ' (❤️ ' + oppHpTxt + ')</span>' +
              '</div>' +
              '<div style="display:flex;gap:6px;margin:3px 0;"><div style="flex:1;height:7px;background:#1e293b;border-radius:4px;"><div style="width:' + myPct + '%;height:100%;background:#4ade80;border-radius:4px;"></div></div><div style="flex:1;height:7px;background:#1e293b;border-radius:4px;"><div style="width:' + oppPct + '%;height:100%;background:#ef4444;border-radius:4px;"></div></div></div>' +
              '<canvas id="rpgStageCanvas" width="400" height="175"></canvas>' +
              '<div style="font-size:11px;color:#fde047;text-align:center;font-weight:bold;margin:4px 0;">' + livePvp.log + '</div>' +
              (livePvp.finished
                ? '<button onclick="livePvp=null;renderRpgBody()" style="width:100%;padding:10px;border:none;border-radius:10px;background:#10b981;color:#fff;font-weight:900;cursor:pointer;">🏆 Back to PvP Lobby</button>'
                : '<div style="text-align:center;font-size:11px;font-weight:900;color:' + (isMyTurn ? '#4ade80' : '#94a3b8') + ';margin-bottom:4px;">' + (isMyTurn ? '🔥 YOUR TURN! Pick a Skill:' : '⏳ Waiting for ' + oppObj.username + '...') + '</div>' +
                  '<div class="rpg-skill-grid">' + meObj.fighter.skills.map((s, i) => '<button class="rpg-skill-btn" ' + (!isMyTurn || meObj.cds[i] > 0 ? 'disabled' : '') + ' onclick="socket.emit(\\'rpgPvpUseSkill\\',{battleId:\\'' + livePvp.id + '\\',skillIdx:' + i + '})">' + (i + 1) + '. ' + s.name + (meObj.cds[i] > 0 ? ' (' + meObj.cds[i] + 't)' : '') + '<br><span style="font-size:9px;color:#94a3b8;">' + s.desc + '</span></button>').join('') + '</div>');
            setTimeout(() => startStageCanvas(meObj.fighter.id, oppObj.fighter.id, oppObj.fighter.icon), 25);
          } else {
            body.innerHTML =
              '<div style="text-align:center;margin-bottom:8px;">' +
                '<div style="font-size:12px;font-weight:900;color:#38bdf8;">⚔️ CHALLENGE AN ONLINE PLAYER TO AVATAR PVP</div>' +
                '<div style="font-size:10px;color:#cbd5e1;">Your Stats: ❤️ <b>' + st.maxHp + '</b> | ⚔️ <b>' + st.atk + '</b></div>' +
                '<button onclick="socket.emit(\\'rpgGetRoomPlayers\\')" style="margin-top:5px;padding:4px 10px;border:1px solid #38bdf8;border-radius:8px;background:#0f172a;color:#38bdf8;font-size:10px;font-weight:bold;cursor:pointer;">🔄 Refresh Online Players</button>' +
              '</div>' +
              (roomOpponents.length === 0
                ? '<div style="text-align:center;color:#94a3b8;font-size:12px;padding:14px;">No other players in this server yet! Invite friends or grind levels in <b>🐺 Grind Lvl</b>!</div>'
                : roomOpponents.map(op =>
                    '<div style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.06);border:1px solid #f43f5e;border-radius:10px;padding:8px;margin-bottom:6px;">' +
                      '<div><div style="font-weight:900;font-size:12px;">' + op.username + '</div><div style="font-size:10px;color:#fde047;">' + op.fighterName + ' (Lvl ' + op.lvl + ')</div></div>' +
                      '<button onclick="socket.emit(\\'rpgChallengePlayer\\',{targetSocketId:\\'' + op.id + '\\'})" style="padding:6px 12px;border:none;border-radius:9px;background:linear-gradient(90deg,#ef4444,#ec4899);color:#fff;font-weight:900;font-size:11px;cursor:pointer;">⚔️ Fight!</button>' +
                    '</div>'
                  ).join(''));
          }
        } else if (curTab === 'grind') {
          if (!grindState) {
            body.innerHTML = '<div style="text-align:center;padding:10px;"><div style="font-weight:900;font-size:14px;">' + f.name + ' (' + f.tier + ')</div><div style="font-size:11px;color:#4ade80;margin:4px 0;">❤️ HP: ' + st.maxHp + ' | ⚔️ ATK: ' + st.atk + '</div><div style="display:flex;gap:8px;margin-top:8px;"><button onclick="startGrindBattle(\\'mob\\')" style="flex:1;padding:10px;border:none;border-radius:10px;background:#0284c7;color:#fff;font-weight:900;cursor:pointer;">🐺 Grind Mob (+70 XP)</button><button onclick="startGrindBattle(\\'boss\\')" style="flex:1;padding:10px;border:none;border-radius:10px;background:#dc2626;color:#fff;font-weight:900;cursor:pointer;">👹 Raid Boss (+210 XP)</button></div></div>';
          } else {
            const ePct = Math.max(0, Math.round((grindState.eHp / grindState.eMax) * 100));
            const pPct = grindState.pHp === '∞' ? 100 : Math.max(0, Math.round((grindState.pHp / grindState.pMax) * 100));
            body.innerHTML =
              '<div style="display:flex;justify-content:space-between;font-size:11px;font-weight:900;"><span style="color:#4ade80;">You (❤️ ' + grindState.pHp + ')</span><span style="color:#f87171;">' + grindState.eName + ' (❤️ ' + grindState.eHp + ')</span></div>' +
              '<div style="display:flex;gap:6px;margin:3px 0;"><div style="flex:1;height:6px;background:#1e293b;border-radius:4px;"><div style="width:' + pPct + '%;height:100%;background:#4ade80;border-radius:4px;"></div></div><div style="flex:1;height:6px;background:#1e293b;border-radius:4px;"><div style="width:' + ePct + '%;height:100%;background:#ef4444;border-radius:4px;"></div></div></div>' +
              '<canvas id="rpgStageCanvas" width="400" height="175"></canvas>' +
              '<div style="font-size:11px;color:#fde047;text-align:center;font-weight:bold;">' + grindState.log + '</div>' +
              ((grindState.eHp <= 0 || (grindState.pHp !== '∞' && grindState.pHp <= 0))
                ? '<button onclick="grindState=null;renderRpgBody()" style="width:100%;padding:10px;margin-top:6px;border:none;border-radius:10px;background:#10b981;color:#fff;font-weight:900;cursor:pointer;">🏆 Collect XP & Gold</button>'
                : '<div class="rpg-skill-grid">' + grindState.fighter.skills.map((s, i) => '<button class="rpg-skill-btn" ' + (grindState.cds[i] > 0 ? 'disabled' : '') + ' onclick="useGrindSkill(' + i + ')">' + (i + 1) + '. ' + s.name + (grindState.cds[i] > 0 ? ' (' + grindState.cds[i] + 't)' : '') + '<br><span style="font-size:9px;color:#94a3b8;">' + s.desc + '</span></button>').join('') + '</div>');
            setTimeout(() => startStageCanvas(grindState.fighter.id, null, grindState.eIcon), 25);
          }
        }
        // === PART 2 OF 3: GACHA, CLASSES, GEAR SHOP & CHAT AVATAR STAMPER ===
        else if (curTab === 'gacha') {
          body.innerHTML =
            '<div style="text-align:center;padding:8px;">' +
              '<div style="font-size:32px;">🎰</div>' +
              '<div style="font-weight:900;color:#fde047;">AVATAR CLASS GACHA ROLL</div>' +
              '<div style="font-size:10px;color:#cbd5e1;margin:5px 0;line-height:1.4;">' +
                '⚪ <b>Common (60%):</b> Cyber Gunner, Blade Swordsman<br>' +
                '🔵 <b>Rare (26%):</b> Inferno Pyromancer, Tidal Hydromancer<br>' +
                '🟡 <b>Legendary (10%):</b> Raijin Storm Lord, Gear Rubber Champion<br>' +
                '🟣 <b>Mythic (4%):</b> Chronos Space-Time' +
              '</div>' +
              '<button onclick="socket.emit(\\'rpgOpenBundle\\',\\'' + getMe() + '\\')" style="width:100%;padding:10px;border:none;border-radius:12px;background:linear-gradient(90deg,#f59e0b,#ec4899);color:#fff;font-weight:900;cursor:pointer;">🎲 Roll Avatar Gacha (🪙 10 MVP)</button>' +
              '<div style="display:flex;gap:5px;margin-top:8px;">' +
                '<input id="rpgHostCodeInp" placeholder="Enter Host Code (#sammuop, #millyqueen, #ishikagold)..." style="flex:1;padding:6px;border-radius:8px;border:1px solid #38bdf8;background:#090d16;color:#fff;font-size:11px;">' +
                '<button onclick="socket.emit(\\'rpgRedeemHostCode\\',{username:\\'' + getMe() + '\\',code:document.getElementById(\\'rpgHostCodeInp\\').value})" style="padding:6px 10px;border:none;border-radius:8px;background:#2563eb;color:#fff;font-weight:bold;">Unlock</button>' +
              '</div>' +
            '</div>';
        } else if (curTab === 'heroes') {
          body.innerHTML = Object.keys(p.owned).map(id => {
            const hf = rpgData.fighters[id]; if (!hf) return '';
            const hst = calcStats(hf, p);
            return '<div onclick="socket.emit(\\'rpgSelectFighter\\',{username:\\'' + getMe() + '\\',fighterId:\\'' + id + '\\'})" style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.06);border:1.5px solid ' + hf.color + ';border-radius:10px;padding:7px;margin-bottom:5px;cursor:pointer;">' +
              '<div><b>' + hf.name + '</b> <span style="font-size:10px;color:' + hf.color + ';">[' + hf.tier + ' • Lvl ' + hst.lvl + ']</span><div style="font-size:10px;color:#94a3b8;">❤️ ' + hst.maxHp + ' HP | ⚔️ ' + hst.atk + ' ATK</div></div>' +
              '<span style="font-weight:900;font-size:11px;">' + (p.activeChar === id ? '✅ Equipped' : 'Equip') + '</span>' +
            '</div>';
          }).join('');
        } else if (curTab === 'shop') {
          body.innerHTML = (rpgData.accessories || []).map(a =>
            '<div style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.06);border:1px solid #38bdf8;border-radius:10px;padding:7px;margin-bottom:5px;">' +
              '<div><b>' + a.name + '</b><div style="font-size:10px;color:#4ade80;">+' + a.atkBonus + ' ATK | +' + a.hpBonus + ' HP</div></div>' +
              '<button onclick="socket.emit(\\'rpgBuyAccessory\\',{username:\\'' + getMe() + '\\',accId:\\'' + a.id + '\\'})" style="padding:5px 10px;border:none;border-radius:7px;background:#f59e0b;color:#090d16;font-weight:900;cursor:pointer;">💰 ' + a.cost + '</button>' +
            '</div>'
          ).join('');
        }
      }

      function renderChatAvatars() {
        const nodes = document.querySelectorAll('#chatBox b, #chatBox strong, #messages b, #messages strong, .msg-user');
        nodes.forEach(el => {
          if (el.closest('#stVaultModal') || el.closest('#rpgArenaModal')) return;
          const raw = (el.textContent || '').trim();
          const sender = raw.replace(/\s*(cap\s*[ab]|👑|creator)\s*/gi, '').trim().toLowerCase();
          const av = playersMap[sender];
          if (!av || !el.parentElement) return;

          const row = el.parentElement;
          if (!row.querySelector('.v14-title-pill')) {
            const pill = document.createElement('span');
            pill.className = 'v14-title-pill' + (av.id === 'host_milly' ? ' milly' : '');
            pill.textContent = av.badge || av.name;
            el.insertAdjacentElement('afterend', pill);
          }

          const msgBox = row.closest('div') || row;
          if (msgBox && !msgBox.dataset.v14Styled) {
            msgBox.dataset.v14Styled = av.id;
            msgBox.style.padding = '7px 11px';
            msgBox.style.marginBottom = '6px';
            if (av.id === 'superhost') msgBox.classList.add('v14-chat-samaksh');
            else if (av.id === 'host_milly') msgBox.classList.add('v14-chat-empress');
          }

          if (row.dataset.v14Stamp === av.id) return;
          const iconSpan = Array.from(row.children).find(
            c => c !== el && !c.classList.contains('v14-title-pill') && !c.querySelector('button') && (c.textContent || '').trim().length <= 4
          );
          if (iconSpan) {
            row.dataset.v14Stamp = av.id;
            const pin = av.id === 'superhost' ? '🦚' : (av.id === 'host_milly' ? '💖' : (av.id === 'host_ishika' ? '☀️' : '⚔️'));
            iconSpan.innerHTML =
              '<span class="v14-bubble ' + av.ring + '" title="' + av.name + '">' +
                '<img src="' + av.img + '">' +
                '<span class="v14-pin">' + pin + '</span>' +
              '</span>';
          }
        });
      }
      // === PART 3 OF 3: FLOATING HUD, SOCKET LISTENERS & EXPRESS INJECTOR ===
      window.openRpgModalNow = function() {
        const u = getMe();
        if (typeof socket !== 'undefined') {
          socket.emit('rpgGetState', u);
          socket.emit('rpgGetRoomPlayers');
        }
        document.getElementById('rpgArenaModal').style.display = 'flex';
        renderRpgBody();
      };

      function ensureFloatingArmoryBar() {
        if (document.getElementById('sammuFloatingArmoryBar')) return;
        const bar = document.createElement('div');
        bar.id = 'sammuFloatingArmoryBar';
        bar.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999999;display:flex;gap:6px;';
        bar.innerHTML =
          '<button onclick="window.stDrawVault();document.getElementById(\\'stVaultModal\\').style.display=\\'flex\\'" style="background:linear-gradient(90deg,#7c3aed,#ec4899);border:1.5px solid #fde047;color:#fff;font-weight:900;font-size:11px;padding:6px 10px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.6);cursor:pointer;">👑 Avatars</button>' +
          '<button onclick="window.openRpgModalNow()" style="background:linear-gradient(90deg,#f59e0b,#dc2626);border:1.5px solid #fde047;color:#fff;font-weight:900;font-size:11px;padding:6px 10px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.6);cursor:pointer;">⚔️ Avatar PvP</button>';
        document.body.appendChild(bar);
      }

      setInterval(() => {
        ensureFloatingArmoryBar();
        if (typeof socket !== 'undefined' && !window._allArmoryBound) {
          window._allArmoryBound = true;
          const u = getMe(); if (u) socket.emit('rpgGetState', u);
          socket.emit('getMyAvatarStatsV6');

          socket.on('avatarCodeResultV6', (res) => {
            if (res && res.ok) {
              const arr = JSON.parse(localStorage.getItem('sammu_unlocked_avatars') || '[]');
              if (!arr.includes(res.avatarId)) { arr.push(res.avatarId); localStorage.setItem('sammu_unlocked_avatars', JSON.stringify(arr)); }
              alert('🎉 Unlocked: ' + res.name + '!');
              window.stDrawVault();
            } else alert('❌ Invalid Code!');
          });

          socket.on('avatarStatsDataV6', (d) => {
            if (d && d.avatarMap) {
              Object.entries(d.avatarMap).forEach(([usr, info]) => {
                const f = AVATAR_ITEMS.find(x => x.id === info.avatarId);
                if (f) playersMap[usr] = { ...f, ring: info.fx || f.ring, badge: info.badge || f.name };
              });
              renderChatAvatars();
            }
          });

          socket.on('rpgStateSync', (d) => { rpgData = d; renderRpgBody(); });
          socket.on('rpgRoomPlayersList', (list) => { roomOpponents = list || []; if (curTab === 'pvp') renderRpgBody(); });
          socket.on('rpgToast', (m) => alert(m));
          socket.on('rpgBundleResult', (res) => { if (rpgData) rpgData.profile = res.profile; alert('🎰 Gacha Pull: [' + res.fighter.tier + '] ' + res.fighter.name + (res.bonusText || '')); renderRpgBody(); });

          socket.on('rpgPvpStart', (duel) => {
            livePvp = duel;
            curTab = 'pvp';
            document.getElementById('rpgArenaModal').style.display = 'flex';
            renderRpgBody();
          });
          socket.on('rpgPvpUpdate', (duel) => { livePvp = duel; renderRpgBody(); });
          socket.on('rpgPvpEnd', ({ duel, winner }) => {
            livePvp = { ...duel, finished: true, log: '🏆 ' + winner.toUpperCase() + ' WON THE AVATAR PVP DUEL!' };
            renderRpgBody();
          });
        }
        renderChatAvatars();
      }, 800);
    })();
    </script>
    `;

        // Fix Samaksh's Krishna portrait, SVG namespaces, DiceBear URLs, and pass UI to server.js
    const KRISHNA_FIXED = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        '<svg xmlns="http://w3.org" viewBox="0 0 100 100">' +
          '<defs><radialGradient id="uBg" cx="50%" cy="35%" r="72%"><stop offset="0%" stop-color="#fef08a"/><stop offset="28%" stop-color="#ea580c"/><stop offset="65%" stop-color="#3b0764"/><stop offset="100%" stop-color="#02040a"/></radialGradient><radialGradient id="uSkin" cx="40%" cy="28%" r="68%"><stop offset="0%" stop-color="#e0f2fe"/><stop offset="45%" stop-color="#0284c7"/><stop offset="100%" stop-color="#172554"/></radialGradient><linearGradient id="uGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fef9c3"/><stop offset="45%" stop-color="#facc15"/><stop offset="100%" stop-color="#78350f"/></linearGradient></defs>' +
          '<circle cx="50" cy="50" r="49" fill="url(#uBg)"/>' +
          '<g class="sudarshan-3d-disc"><circle cx="50" cy="44" r="42" fill="none" stroke="#f97316" stroke-width="2.2"/><circle cx="50" cy="44" r="38" fill="none" stroke="url(#uGold)" stroke-width="4.2"/><circle cx="50" cy="44" r="32" fill="none" stroke="#38bdf8" stroke-width="1.8" stroke-dasharray="4 2"/><polygon points="50,-1 54,8 46,8" fill="#fef08a"/><polygon points="50,89 54,80 46,80" fill="#fef08a"/><polygon points="5,44 14,40 14,48" fill="#fef08a"/><polygon points="95,44 86,40 86,48" fill="#fef08a"/></g>' +
          '<path d="M12,99 C15,72 31,64 50,64 C69,64 85,72 88,99 Z" fill="url(#uGold)" stroke="#fef08a" stroke-width="1.6"/>' +
          '<polygon points="50,72 56,79 50,87 44,79" fill="#ef4444" stroke="#fef08a" stroke-width="1.4"/>' +
          '<path d="M33,31 C33,24 67,24 67,31 L66,48 C65,58 56,65 50,66.8 C44,65 35,58 34,48 Z" fill="url(#uSkin)" stroke="#bae6fd" stroke-width="1.2"/>' +
          '<path d="M26,43 C24,25 36,19 50,19 C64,19 76,25 74,43 C65,33 56,34 50,39 C44,34 35,33 26,43 Z" fill="#090d16"/>' +
          '<path d="M64,22 Q71,9 68,3" stroke="#fde047" stroke-width="2" fill="none"/><ellipse cx="68" cy="9" rx="7.5" ry="10" fill="#10b981" stroke="#fde047" stroke-width="1.5"/><ellipse cx="68" cy="9" rx="4.2" ry="5.8" fill="#1d4ed8"/><circle cx="68" cy="9" r="2.1" fill="#fef08a"/>' +
          '<polygon points="33,23 38,10 44,18 50,4 56,18 62,10 67,23" fill="url(#uGold)" stroke="#fff" stroke-width="1.2"/>' +
          '<path d="M47.8,35 L47.8,42.5 Q50,44.5 52.2,42.5 L52.2,35" fill="none" stroke="#fff" stroke-width="1.9"/><line x1="50" y1="36" x2="50" y2="42.5" stroke="#ef4444" stroke-width="1.6"/>' +
          '<ellipse cx="41" cy="50" rx="4.4" ry="3.3" fill="#fff"/><circle cx="41" cy="50" r="2.4" fill="#0284c7"/><ellipse cx="59" cy="50" rx="4.4" ry="3.3" fill="#fff"/><circle cx="59" cy="50" r="2.4" fill="#0284c7"/>' +
          '<path d="M44.5,58.5 Q50,62.5 55.5,58.5" stroke="#1e3a8a" stroke-width="2" fill="none" stroke-linecap="round"/>' +
          '<line x1="16" y1="85" x2="84" y2="73" stroke="url(#uGold)" stroke-width="4.2" stroke-linecap="round"/>' +
        '</svg>'
    );

    app.locals.AVATAR_RPG_UI = COMBINED_UI
        .replace('img: KRISHNA_URI', 'img: "' + KRISHNA_FIXED + '"')
        .replace(/http:\/\/w3\.org/g, 'http://w3.org')
        .replace(/https:\/\/dicebear\.com/g, 'https://dicebear.com');
};
        
