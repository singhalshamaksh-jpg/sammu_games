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
        host_milly: {
            id: 'host_milly', name: '👸💖 Princess Milly', tier: 'OG Empress', pool: 'code', code: '#millyqueen',
            fixedLevel: 750, baseHp: 85000, baseAtk: 8800, color: '#f472b6', icon: '💖',
            skills: [
                { name: 'Empress Heart Beam',     cd: 0, mult: 1.4,  type: 'dmg',    desc: 'Royal crystal strike' },
                { name: 'Rose Sovereign Waltz',   cd: 2, mult: 2.8,  type: 'dmg',    desc: 'Petal storm barrage' },
                { name: 'Imperial Blessing',      cd: 3, mult: 0.65, type: 'heal',   desc: 'Restores +65% Max HP' },
                { name: '★ Crown Dominion',       cd: 4, mult: 5.2,  type: 'dmg', sig: true, desc: 'SIGNATURE: Empress judgment' }
            ]
        },
        host_ishika: {
            id: 'host_ishika', name: '☀️✨ Empress Ishika', tier: 'OG Solar', pool: 'code', code: '#ishikagold',
            fixedLevel: 750, baseHp: 82000, baseAtk: 9000, color: '#facc15', icon: '☀️',
            skills: [
                { name: 'Sunbeam Lance',          cd: 0, mult: 1.4,  type: 'dmg',    desc: 'Piercing golden solar ray' },
                { name: 'Solar Flare Wave',       cd: 2, mult: 2.8,  type: 'dmg',    desc: 'Blinding starburst explosion' },
                { name: 'Golden Dawn Aura',       cd: 3, mult: 0.60, type: 'heal',   desc: 'Restores +60% Max HP' },
                { name: '★ Solar Eclipse',        cd: 4, mult: 5.3,  type: 'dmg', sig: true, desc: 'SIGNATURE: Twin-sun annihilation' }
            ]
        },
        host_moon: {
            id: 'host_moon', name: '🩺🌙 Dr. Moon (Medic)', tier: 'OG Host', pool: 'code', code: '#moongalaxy',
            fixedLevel: 500, baseHp: 50000, baseAtk: 5000, regenPct: 0.12, color: '#a855f7', icon: '🌙',
            skills: [
                { name: 'Lunar Scalpel',          cd: 0, mult: 1.2,  type: 'lifesteal', desc: 'Drains 20% DMG as HP' },
                { name: 'Eclipse Surge',          cd: 2, mult: 2.4,  type: 'dmg',       desc: 'Moonlight shockwave' },
                { name: 'Miracle Sanctuary',      cd: 3, mult: 0.60, type: 'heal',      desc: 'Restores +60% Max HP' },
                { name: '★ Celestial Diagnosis',  cd: 4, mult: 4.3,  type: 'dmg', sig: true, desc: 'SIGNATURE: Full moon beam' }
            ]
        },
        host_zoro: {
            id: 'host_zoro', name: '⚔️🐉 Zoro 3-Sword', tier: 'OG Host', pool: 'code', code: '#zorosword',
            fixedLevel: 500, baseHp: 50000, baseAtk: 5200, color: '#22c55e', icon: '⚔️',
            skills: [
                { name: 'Oni Giri',               cd: 0, mult: 1.25, type: 'dmg',    desc: '3-Sword Demon Slash' },
                { name: '1080 Pound Phoenix',     cd: 2, mult: 2.5,  type: 'dmg',    desc: 'Flying dragon wind cannon' },
                { name: 'Armament Haki',          cd: 3, mult: 0,    type: 'shield', desc: 'Blocks 85% next incoming hit' },
                { name: '★ Asura Nine-Blades',    cd: 4, mult: 4.5,  type: 'dmg', sig: true, desc: 'SIGNATURE: 9-Sword Demon God' }
            ]
        },
        host_sus: {
            id: 'host_sus', name: '👸💚 Princess Sus', tier: 'OG Host', pool: 'code', code: '#susshadow',
            fixedLevel: 500, baseHp: 50000, baseAtk: 5000, color: '#10b981', icon: '👸',
            skills: [
                { name: 'Emerald Charm',          cd: 0, mult: 1.2,  type: 'dmg',    desc: 'Enchanted fairy blade strike' },
                { name: 'Rose Petal Storm',       cd: 2, mult: 2.45, type: 'dmg',    desc: 'Razor emerald leaf vortex' },
                { name: 'Fairy Sanctuary',        cd: 3, mult: 0.52, type: 'heal',   desc: 'Restores +52% Max HP' },
                { name: '★ Queen Sovereign',      cd: 4, mult: 4.3,  type: 'dmg', sig: true, desc: 'SIGNATURE: Royal emerald burst' }
            ]
        },
        host_sid: {
            id: 'host_sid', name: '😎⚡ Sid Thunder', tier: 'OG Host', pool: 'code', code: '#sidbolt',
            fixedLevel: 500, baseHp: 50000, baseAtk: 5150, color: '#eab308', icon: '⚡',
            skills: [
                { name: 'Thunder Clap',           cd: 0, mult: 1.25, type: 'dmg',    desc: 'High-voltage lightning strike' },
                { name: 'Volt Rush',              cd: 2, mult: 2.5,  type: 'dmg',    desc: 'Supersonic thunder dash' },
                { name: 'Static Armor',           cd: 3, mult: 0,    type: 'shield', desc: 'Blocks 80% next hit' },
                { name: '★ Thunder God Wrath',    cd: 4, mult: 4.4,  type: 'dmg', sig: true, desc: 'SIGNATURE: Sky-splitting bolt' }
            ]
        },
        host_shubhi: {
            id: 'host_shubhi', name: '🌷 Shubhi Sakura', tier: 'OG Host', pool: 'code', code: '#shubhirose',
            fixedLevel: 500, baseHp: 50000, baseAtk: 5000, color: '#f472b6', icon: '🌷',
            skills: [
                { name: 'Petal Slice',            cd: 0, mult: 1.2,  type: 'dmg',    desc: 'Sharp cherry blossom slash' },
                { name: 'Crimson Bloom',          cd: 2, mult: 2.4,  type: 'dmg',    desc: 'Exploding floral wave' },
                { name: 'Spring Renewal',         cd: 3, mult: 0.55, type: 'heal',   desc: 'Restores +55% Max HP' },
                { name: '★ Sakura Blossom Storm', cd: 4, mult: 4.3,  type: 'dmg', sig: true, desc: 'SIGNATURE: Thousand petal storm' }
            ]
        },
        host_sarah: {
            id: 'host_sarah', name: '🦋 Sarah Valkyrie', tier: 'OG Host', pool: 'code', code: '#sarahfly',
            fixedLevel: 500, baseHp: 50000, baseAtk: 5050, color: '#38bdf8', icon: '🦋',
            skills: [
                { name: 'Sky Feather',            cd: 0, mult: 1.2,  type: 'dmg',    desc: 'Crystal wing projectile' },
                { name: 'Monarch Cyclone',        cd: 2, mult: 2.45, type: 'dmg',    desc: 'Twisting astral wind' },
                { name: 'Wind Barrier',           cd: 3, mult: 0,    type: 'shield', desc: 'Blocks 80% next hit' },
                { name: '★ Valkyrie Skyfall',     cd: 4, mult: 4.35, type: 'dmg', sig: true, desc: 'SIGNATURE: Celestial dive bomb' }
            ]
        },
        host_heer: {
            id: 'host_heer', name: '🌸 Heer Starlight', tier: 'OG Host', pool: 'code', code: '#heerstar',
            fixedLevel: 500, baseHp: 50000, baseAtk: 5050, color: '#fb7185', icon: '🌸',
            skills: [
                { name: 'Star Shard',             cd: 0, mult: 1.2,  type: 'dmg',    desc: 'Shooting star strike' },
                { name: 'Nebula Pulse',           cd: 2, mult: 2.45, type: 'dmg',    desc: 'Cosmic shockwave' },
                { name: 'Star Blessing',          cd: 3, mult: 0.52, type: 'heal',   desc: 'Restores +52% Max HP' },
                { name: '★ Starlight Supernova',  cd: 4, mult: 4.35, type: 'dmg', sig: true, desc: 'SIGNATURE: Collapsing star beam' }
            ]
        },
        host_izzan: {
            id: 'host_izzan', name: '🔥 Izzan Dragon', tier: 'OG Host', pool: 'code', code: '#izzanfire',
            fixedLevel: 500, baseHp: 50000, baseAtk: 5200, color: '#ef4444', icon: '🔥',
            skills: [
                { name: 'Magma Claw',             cd: 0, mult: 1.25, type: 'dmg',    desc: 'Molten dragon slash' },
                { name: 'Hellfire Roar',          cd: 2, mult: 2.5,  type: 'dmg',    desc: 'Scorching flame wave' },
                { name: 'Phoenix Rebirth',        cd: 3, mult: 0.48, type: 'heal',   desc: 'Restores +48% Max HP' },
                { name: '★ Dragon Breath Inferno',cd: 4, mult: 4.5,  type: 'dmg', sig: true, desc: 'SIGNATURE: Apocalyptic fire beam' }
            ]
        },
        host_zaira: {
            id: 'host_zaira', name: '🪐 Zaira Nova', tier: 'OG Host', pool: 'code', code: '#zairaorbit',
            fixedLevel: 500, baseHp: 50000, baseAtk: 5100, color: '#818cf8', icon: '🪐',
            skills: [
                { name: 'Meteor Toss',            cd: 0, mult: 1.2,  type: 'dmg',    desc: 'Hurls orbital asteroid' },
                { name: 'Saturn Ring Slash',      cd: 2, mult: 2.45, type: 'dmg',    desc: 'Razor planetary ring' },
                { name: 'Void Shield',            cd: 3, mult: 0,    type: 'shield', desc: 'Blocks 80% next hit' },
                { name: '★ Orbital Gravity Crush',cd: 4, mult: 4.4,  type: 'dmg', sig: true, desc: 'SIGNATURE: Black hole slam' }
            ]
        },
        host_advait: {
            id: 'host_advait', name: '⚡ Advait Titan', tier: 'OG Host', pool: 'code', code: '#advaitvolt',
            fixedLevel: 500, baseHp: 52000, baseAtk: 5000, color: '#2563eb', icon: '⚡',
            skills: [
                { name: 'Titan Punch',            cd: 0, mult: 1.2,  type: 'dmg',    desc: 'Heavy shockwave fist' },
                { name: 'Megavolt Slam',          cd: 2, mult: 2.45, type: 'dmg',    desc: 'Electrified ground smash' },
                { name: 'Iron Bastion',           cd: 3, mult: 0,    type: 'shield', desc: 'Blocks 85% next hit' },
                { name: '★ Titan Overdrive',      cd: 4, mult: 4.35, type: 'dmg', sig: true, desc: 'SIGNATURE: Colossal lightning surge' }
            ]
        },
        host_ruwii: {
            id: 'host_ruwii', name: '🌺 Ruwii Kitsune', tier: 'OG Host', pool: 'code', code: '#ruwiibloom',
            fixedLevel: 500, baseHp: 50000, baseAtk: 5050, color: '#fb923c', icon: '🌺',
            skills: [
                { name: 'Foxfire Orb',            cd: 0, mult: 1.2,  type: 'dmg',    desc: 'Spirit flame projectile' },
                { name: 'Mystic Tail Whip',       cd: 2, mult: 2.45, type: 'dmg',    desc: 'Nine-tail energy strike' },
                { name: 'Spirit Mend',            cd: 3, mult: 0.52, type: 'heal',   desc: 'Restores +52% Max HP' },
                { name: '★ Nine-Tail Illusion',   cd: 4, mult: 4.4,  type: 'dmg', sig: true, desc: 'SIGNATURE: Phantom foxfire storm' }
            ]
        },
        superhost: {
            id: 'superhost', name: '🦚👑 SAMAKSH (GOD OP++)', tier: 'SUPREME ∞', pool: 'code', code: '#sammuop',
            infinite: true, baseHp: 999999999, baseAtk: 999999999, fixedLevel: '∞', color: '#fde047', icon: '🦚',
            skills: [
                { name: 'Divine Bansuri Wave',    cd: 0, mult: 9999, type: 'dmg',    desc: '∞ 1-Shot Cosmic Resonance' },
                { name: 'Vaikuntha Immunity',     cd: 0, mult: 0,    type: 'shield', desc: '∞ 100% Absolute Invincibility' },
                { name: 'Creator Miracle',        cd: 0, mult: 1.0,  type: 'heal',   desc: '∞ Full Cosmic Restoration' },
                { name: '★ Sudarshan Oblivion',   cd: 0, mult: 9999, type: 'dmg', sig: true, desc: 'SIGNATURE: ∞ 3D Chakra Erasure' }
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
        socket.on('disconnect', () => {
            for (const [bId, duel] of livePvpBattles.entries()) {
                if (duel.p1.socketId === socket.id || duel.p2.socketId === socket.id) {
                    livePvpBattles.delete(bId);
                    const survivorId = duel.p1.socketId === socket.id ? duel.p2.socketId : duel.p1.socketId;
                    const winnerName = duel.p1.socketId === socket.id ? duel.p2.username : duel.p1.username;
                    io.to(survivorId).emit('rpgPvpEnd', { duel, winner: winnerName + ' (Opponent Left)' });
                }
            }
        });

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
                    atk: s1.infinite ? 999999999 : s1.atk, shield: 0, cds:new Array(0, 0, 0, 0)

                },
                p2: {
                    socketId: targetSock.id, username: targetSock.username,
                    fighter: s2.fighter, lvl: s2.lvl, infinite: s2.infinite,
                    hp: s2.infinite ? 999999999 : s2.maxHp, maxHp: s2.infinite ? 999999999 : s2.maxHp,
                    atk: s2.infinite ? 999999999 : s2.atk, shield: 0, cds:new Array(0, 0, 0, 0)

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
        socket.on('rpgPvpForfeit', ({ battleId }) => {
            const duel = livePvpBattles.get(battleId);
            if (!duel) return;
            livePvpBattles.delete(battleId);
            const isP1 = (duel.p1.socketId === socket.id);
            const winnerName = isP1 ? duel.p2.username : duel.p1.username;
            const oppSockId = isP1 ? duel.p2.socketId : duel.p1.socketId;
            io.to(oppSockId).emit('rpgPvpEnd', { duel, winner: winnerName + ' (Opponent Retreated)' });
            socket.emit('rpgPvpLeft');
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

      .v14-ring-samaksh { border: 2.5px solid #fde047 !important; animation: divineAuraRing 2.2s infinite !important; }
      .v14-ring-empress { border: 2.5px solid #fbcfe8 !important; animation: empressAuraRing 2.2s infinite !important; }
      .v14-ring-solar   { border: 2.5px solid #fef08a !important; animation: solarAuraRing 2.2s infinite !important; }
      .v14-ring-violet  { border: 2px solid #c084fc !important; box-shadow: 0 0 10px #9333ea !important; }
      .v14-ring-emerald { border: 2px solid #4ade80 !important; box-shadow: 0 0 10px #10b981 !important; }
      .v14-ring-gold    { border: 2px solid #fde047 !important; box-shadow: 0 0 9px #eab308 !important; }
      .v14-ring-ice     { border: 2px solid #38bdf8 !important; box-shadow: 0 0 9px #0284c7 !important; }
      .v14-ring-fire    { border: 2px solid #fb923c !important; box-shadow: 0 0 9px #ea580c !important; }

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
      const HERO_SPECS = {
        superhost:      { bg: ['#fef08a','#ea580c','#3b0764','#02040a'], skin: ['#e0f2fe','#0284c7','#1e3a8a'], hair: '#090d16', armor: ['#fef9c3','#eab308','#78350f'], eye: '#38bdf8', crown: 'divine', aura: '#fde047', motif: 'chakra' },
        host_milly:     { bg: ['#fdf2f8','#f472b6','#9d174d','#19041f'], skin: ['#fff1f2','#fecdd3','#fda4af'], hair: '#581c87', armor: ['#fbcfe8','#ec4899','#701a75'], eye: '#db2777', crown: 'tiara',  aura: '#f472b6', motif: 'hearts' },
        host_ishika:    { bg: ['#fef9c3','#f59e0b','#9a3412','#1c0a00'], skin: ['#ffedd5','#fed7aa','#fdba74'], hair: '#451a03', armor: ['#fef08a','#eab308','#854d0e'], eye: '#d97706', crown: 'tiara',  aura: '#facc15', motif: 'sun' },
        host_moon:      { bg: ['#e0e7ff','#7c3aed','#312e81','#090d16'], skin: ['#ffedd5','#fed7aa','#fdba74'], hair: '#1e1b4b', armor: ['#ffffff','#e2e8f0','#94a3b8'], eye: '#7c3aed', crown: 'none',   aura: '#38bdf8', motif: 'moon' },
        host_zoro:      { bg: ['#dcfce7','#16a34a','#052e16','#020617'], skin: ['#fed7aa','#fdba74','#fb923c'], hair: '#15803d', armor: ['#166534','#14532d','#052e16'], eye: '#22c55e', crown: 'band',   aura: '#4ade80', motif: 'swords' },
        host_sus:       { bg: ['#d1fae5','#10b981','#064e3b','#022c22'], skin: ['#fff1f2','#ffe4e6','#fecdd3'], hair: '#047857', armor: ['#34d399','#059669','#064e3b'], eye: '#10b981', crown: 'tiara',  aura: '#6ee7b7', motif: 'wings' },
        host_sid:       { bg: ['#fef08a','#eab308','#1e3a8a','#090d16'], skin: ['#ffedd5','#fed7aa','#fdba74'], hair: '#0f172a', armor: ['#3b82f6','#1d4ed8','#1e3a8a'], eye: '#facc15', crown: 'helm',   aura: '#fde047', motif: 'bolts' },
        host_shubhi:    { bg: ['#fce7f3','#f472b6','#831843','#1f0512'], skin: ['#fff1f2','#ffe4e6','#fecdd3'], hair: '#4a0e4e', armor: ['#f9a8d4','#db2777','#831843'], eye: '#ec4899', crown: 'tiara',  aura: '#f472b6', motif: 'petals' },
        host_sarah:     { bg: ['#e0f2fe','#38bdf8','#0c4a6e','#082f49'], skin: ['#fff1f2','#ffe4e6','#fecdd3'], hair: '#1e293b', armor: ['#7dd3fc','#0284c7','#0c4a6e'], eye: '#0ea5e9', crown: 'tiara',  aura: '#38bdf8', motif: 'wings' },
        host_heer:      { bg: ['#ffe4e6','#fb7185','#881337','#1f040d'], skin: ['#fff1f2','#ffe4e6','#fecdd3'], hair: '#3b0764', armor: ['#fda4af','#e11d48','#881337'], eye: '#f43f5e', crown: 'tiara',  aura: '#fda4af', motif: 'stars' },
        host_izzan:     { bg: ['#ffedd5','#f97316','#7f1d1d','#180404'], skin: ['#fed7aa','#fdba74','#fb923c'], hair: '#18181b', armor: ['#f87171','#dc2626','#7f1d1d'], eye: '#ef4444', crown: 'helm',   aura: '#fb923c', motif: 'flames' },
        host_zaira:     { bg: ['#e0e7ff','#818cf8','#1e1b4b','#050814'], skin: ['#ffedd5','#fed7aa','#fdba74'], hair: '#090d16', armor: ['#a5b4fc','#4f46e5','#1e1b4b'], eye: '#818cf8', crown: 'tiara',  aura: '#c084fc', motif: 'orbit' },
        host_advait:    { bg: ['#dbeafe','#3b82f6','#172554','#060b19'], skin: ['#fed7aa','#fdba74','#fb923c'], hair: '#0f172a', armor: ['#60a5fa','#1e40af','#172554'], eye: '#38bdf8', crown: 'helm',   aura: '#60a5fa', motif: 'bolts' },
        host_ruwii:     { bg: ['#fef3c7','#fb923c','#7c2d12','#1c0a00'], skin: ['#fff1f2','#ffe4e6','#fecdd3'], hair: '#451a03', armor: ['#fdba74','#ea580c','#7c2d12'], eye: '#f59e0b', crown: 'ears',   aura: '#fbbf24', motif: 'flames' },
        gunner:         { bg: ['#e0f2fe','#0284c7','#0f172a','#020617'], skin: ['#cbd5e1','#64748b','#334155'], hair: '#0284c7', armor: ['#38bdf8','#0369a1','#0f172a'], eye: '#38bdf8', crown: 'visor',  aura: '#38bdf8', motif: 'tech' },
        swordsman:      { bg: ['#f1f5f9','#64748b','#1e293b','#090d16'], skin: ['#ffedd5','#fed7aa','#fdba74'], hair: '#1e293b', armor: ['#94a3b8','#475569','#0f172a'], eye: '#cbd5e1', crown: 'band',   aura: '#94a3b8', motif: 'swords' },
        fire_mage:      { bg: ['#ffedd5','#f97316','#7c2d12','#1c0a00'], skin: ['#ffedd5','#fed7aa','#fdba74'], hair: '#9a3412', armor: ['#fb923c','#ea580c','#7c2d12'], eye: '#f97316', crown: 'none',   aura: '#fb923c', motif: 'flames' },
        water_bender:   { bg: ['#e0f2fe','#38bdf8','#0369a1','#082f49'], skin: ['#ffedd5','#fed7aa','#fdba74'], hair: '#0c4a6e', armor: ['#7dd3fc','#0284c7','#075985'], eye: '#38bdf8', crown: 'none',   aura: '#7dd3fc', motif: 'orbit' },
        lightning_lord: { bg: ['#fef9c3','#eab308','#713f12','#090d16'], skin: ['#ffedd5','#fed7aa','#fdba74'], hair: '#fef08a', armor: ['#facc15','#ca8a04','#713f12'], eye: '#fde047', crown: 'helm',   aura: '#fde047', motif: 'bolts' },
        rubber_hero:    { bg: ['#ffe4e6','#fb7185','#881337','#19040c'], skin: ['#fed7aa','#fdba74','#fb923c'], hair: '#090d16', armor: ['#fb7185','#e11d48','#881337'], eye: '#fb7185', crown: 'hat',    aura: '#fda4af', motif: 'stars' },
        spacetime_god:  { bg: ['#f3e8ff','#a855f7','#3b0764','#05020d'], skin: ['#e0e7ff','#a5b4fc','#6366f1'], hair: '#f8fafc', armor: ['#c084fc','#7e22ce','#3b0764'], eye: '#e879f9', crown: 'divine', aura: '#c084fc', motif: 'orbit' }
      };

      const generatedPngs = {};
      const imgCache = {};
      function paintRealisticPortrait(id) {
        if (generatedPngs[id]) return generatedPngs[id];
        const s = HERO_SPECS[id] || HERO_SPECS.gunner;
        const c = document.createElement('canvas');
        c.width = 256; c.height = 256;
        const ctx = c.getContext('2d');

        const bgGrad = ctx.createRadialGradient(128, 86, 12, 128, 128, 128);
        bgGrad.addColorStop(0, s.bg[0]);
        bgGrad.addColorStop(0.35, s.bg[1]);
        bgGrad.addColorStop(0.75, s.bg[2]);
        bgGrad.addColorStop(1, s.bg[3]);
        ctx.fillStyle = bgGrad;
        ctx.beginPath(); ctx.arc(128, 128, 126, 0, Math.PI * 2); ctx.fill();

        ctx.save();
        ctx.translate(128, 114);
        ctx.strokeStyle = s.aura;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.75;
        ctx.beginPath(); ctx.arc(0, 0, 102, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([10, 6]);
        ctx.beginPath(); ctx.arc(0, 0, 90, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);

        if (s.motif === 'chakra' || s.motif === 'sun' || s.motif === 'orbit') {
          for (let i = 0; i < 16; i++) {
            const ang = (i * Math.PI) / 8;
            ctx.beginPath();
            ctx.moveTo(Math.cos(ang) * 90, Math.sin(ang) * 90);
            ctx.lineTo(Math.cos(ang) * 112, Math.sin(ang) * 112);
            ctx.stroke();
          }
        } else if (s.motif === 'swords') {
          ctx.lineWidth = 7; ctx.strokeStyle = '#f8fafc';
          ctx.beginPath(); ctx.moveTo(-95, -75); ctx.lineTo(95, 95); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(95, -75); ctx.lineTo(-95, 95); ctx.stroke();
        } else if (s.motif === 'wings') {
          ctx.fillStyle = s.aura; ctx.globalAlpha = 0.45;
          ctx.beginPath(); ctx.moveTo(-20, 10); ctx.quadraticCurveTo(-125, -65, -105, 35); ctx.quadraticCurveTo(-55, 45, -20, 10); ctx.fill();
          ctx.beginPath(); ctx.moveTo(20, 10); ctx.quadraticCurveTo(125, -65, 105, 35); ctx.quadraticCurveTo(55, 45, 20, 10); ctx.fill();
        }
        ctx.restore();

        ctx.fillStyle = s.hair;
        ctx.beginPath();
        ctx.moveTo(48, 110);
        ctx.bezierCurveTo(32, 185, 44, 240, 64, 254);
        ctx.lineTo(192, 254);
        ctx.bezierCurveTo(212, 240, 224, 185, 208, 110);
        ctx.bezierCurveTo(208, 42, 48, 42, 48, 110);
        ctx.fill();

        const armGrad = ctx.createLinearGradient(50, 165, 206, 256);
        armGrad.addColorStop(0, s.armor[0]);
        armGrad.addColorStop(0.5, s.armor[1]);
        armGrad.addColorStop(1, s.armor[2]);
        ctx.fillStyle = armGrad;
        ctx.beginPath();
        ctx.moveTo(36, 256);
        ctx.bezierCurveTo(46, 185, 84, 168, 128, 168);
        ctx.bezierCurveTo(172, 168, 210, 185, 220, 256);
        ctx.fill();
        ctx.strokeStyle = s.aura; ctx.lineWidth = 3.5; ctx.stroke();

        const gemGrad = ctx.createRadialGradient(128, 204, 2, 128, 206, 18);
        gemGrad.addColorStop(0, '#ffffff');
        gemGrad.addColorStop(0.4, s.aura);
        gemGrad.addColorStop(1, s.armor[2]);
        ctx.fillStyle = gemGrad;
        ctx.beginPath();
        ctx.moveTo(128, 186); ctx.lineTo(143, 205); ctx.lineTo(128, 224); ctx.lineTo(113, 205);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();

        ctx.fillStyle = s.skin[2];
        ctx.fillRect(112, 152, 32, 26);

        const faceGrad = ctx.createRadialGradient(116, 114, 8, 128, 124, 56);
        faceGrad.addColorStop(0, s.skin[0]);
        faceGrad.addColorStop(0.65, s.skin[1]);
        faceGrad.addColorStop(1, s.skin[2]);
        ctx.fillStyle = faceGrad;
        ctx.beginPath();
        ctx.moveTo(84, 86);
        ctx.bezierCurveTo(84, 66, 172, 66, 172, 86);
        ctx.lineTo(169, 130);
        ctx.bezierCurveTo(166, 156, 144, 170, 128, 173);
        ctx.bezierCurveTo(112, 170, 90, 156, 87, 130);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(244, 63, 94, 0.18)';
        ctx.beginPath(); ctx.ellipse(101, 138, 11, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(155, 138, 11, 6, 0, 0, Math.PI * 2); ctx.fill();

        function drawEye(cx, cy) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.ellipse(cx, cy, 12, 9.5, 0, 0, Math.PI * 2); ctx.fill();
          const iris = ctx.createRadialGradient(cx, cy + 2, 1, cx, cy, 8);
          iris.addColorStop(0, '#090d16');
          iris.addColorStop(0.55, s.eye);
          iris.addColorStop(1, s.aura);
          ctx.fillStyle = iris;
          ctx.beginPath(); ctx.arc(cx, cy, 7.2, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#090d16'; ctx.lineWidth = 3.2;
          ctx.beginPath(); ctx.arc(cx, cy + 1, 12.5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(cx - 3, cy - 3, 2.8, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(cx + 3, cy + 2.5, 1.4, 0, Math.PI * 2); ctx.fill();
        }
        drawEye(105, 126);
        drawEye(151, 126);

        if (id === 'superhost') {
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(123, 92); ctx.lineTo(123, 111); ctx.quadraticCurveTo(128, 115, 133, 111); ctx.lineTo(133, 92); ctx.stroke();
          ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(128, 94); ctx.lineTo(128, 110); ctx.stroke();
        }

        ctx.strokeStyle = '#9f1239'; ctx.lineWidth = 2.8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(117, 153); ctx.quadraticCurveTo(128, 161, 139, 153); ctx.stroke();

        ctx.fillStyle = s.hair;
        ctx.beginPath();
        ctx.moveTo(68, 116);
        ctx.bezierCurveTo(66, 52, 190, 52, 188, 116);
        ctx.quadraticCurveTo(166, 86, 148, 106);
        ctx.quadraticCurveTo(128, 82, 108, 106);
        ctx.quadraticCurveTo(90, 86, 68, 116);
        ctx.fill();

        ctx.fillStyle = s.aura; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        if (s.crown === 'tiara' || s.crown === 'divine') {
          ctx.beginPath();
          ctx.moveTo(82, 66); ctx.lineTo(96, 36); ctx.lineTo(112, 54);
          ctx.lineTo(128, 22); ctx.lineTo(144, 54); ctx.lineTo(160, 36); ctx.lineTo(174, 66);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        if (id === 'superhost') {
          ctx.save(); ctx.translate(168, 32); ctx.rotate(0.35);
          ctx.fillStyle = '#10b981'; ctx.beginPath(); ctx.ellipse(0, 0, 14, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#1d4ed8'; ctx.beginPath(); ctx.ellipse(0, 2, 8, 12, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.arc(0, 3, 4, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        if (s.crown === 'ears') {
          ctx.fillStyle = '#ea580c';
          ctx.beginPath(); ctx.moveTo(76, 74); ctx.lineTo(66, 26); ctx.lineTo(104, 58); ctx.fill();
          ctx.beginPath(); ctx.moveTo(180, 74); ctx.lineTo(190, 26); ctx.lineTo(152, 58); ctx.fill();
        }

        for (let i = 0; i < 14; i++) {
          const px = 30 + ((i * 53) % 196);
          const py = 26 + ((i * 79) % 204);
          ctx.fillStyle = i % 2 === 0 ? '#ffffff' : s.aura;
          ctx.beginPath(); ctx.arc(px, py, (i % 3) + 1.5, 0, Math.PI * 2); ctx.fill();
        }

        const pngUrl = c.toDataURL('image/png');
        generatedPngs[id] = pngUrl;
        const im = new Image(); im.src = pngUrl; imgCache[id] = im;
        return pngUrl;
      }

      Object.keys(HERO_SPECS).forEach(paintRealisticPortrait);
      const AVATAR_ITEMS = [
        { id: 'superhost',      name: '🦚👑 SAMAKSH (GOD OP++)',    ring: 'v14-ring-samaksh', req: 'code', featured: true, img: paintRealisticPortrait('superhost') },
        { id: 'host_milly',     name: '👸💖 Princess Milly',        ring: 'v14-ring-empress', req: 'code', featured: true, img: paintRealisticPortrait('host_milly') },
        { id: 'host_ishika',    name: '☀️✨ Empress Ishika',        ring: 'v14-ring-solar',   req: 'code', featured: true, img: paintRealisticPortrait('host_ishika') },
        { id: 'host_moon',      name: '🩺🌙 Dr. Moon (Medic)',      ring: 'v14-ring-violet',  req: 'code', img: paintRealisticPortrait('host_moon') },
        { id: 'host_zoro',      name: '⚔️🐉 Zoro 3-Sword',          ring: 'v14-ring-emerald', req: 'code', img: paintRealisticPortrait('host_zoro') },
        { id: 'host_sus',       name: '👸💚 Princess Sus',          ring: 'v14-ring-emerald', req: 'code', img: paintRealisticPortrait('host_sus') },
        { id: 'host_sid',       name: '😎⚡ Sid Thunder',           ring: 'v14-ring-gold',    req: 'code', img: paintRealisticPortrait('host_sid') },
        { id: 'host_shubhi',    name: '🌷 Shubhi Sakura',           ring: 'v14-ring-empress', req: 'code', img: paintRealisticPortrait('host_shubhi') },
        { id: 'host_sarah',     name: '🦋 Sarah Valkyrie',          ring: 'v14-ring-ice',     req: 'code', img: paintRealisticPortrait('host_sarah') },
        { id: 'host_heer',      name: '🌸 Heer Starlight',          ring: 'v14-ring-empress', req: 'code', img: paintRealisticPortrait('host_heer') },
        { id: 'host_izzan',     name: '🔥 Izzan Dragon',            ring: 'v14-ring-fire',    req: 'code', img: paintRealisticPortrait('host_izzan') },
        { id: 'host_zaira',     name: '🪐 Zaira Nova',              ring: 'v14-ring-violet',  req: 'code', img: paintRealisticPortrait('host_zaira') },
        { id: 'host_advait',    name: '⚡ Advait Titan',            ring: 'v14-ring-ice',     req: 'code', img: paintRealisticPortrait('host_advait') },
        { id: 'host_ruwii',     name: '🌺 Ruwii Kitsune',           ring: 'v14-ring-gold',    req: 'code', img: paintRealisticPortrait('host_ruwii') },
        { id: 'gunner',         name: '🔫 Cyber Gunner',            ring: 'v14-ring-ice',     req: 'free', img: paintRealisticPortrait('gunner') },
        { id: 'swordsman',      name: '⚔️ Blade Swordsman',         ring: 'v14-ring-gold',    req: 'free', img: paintRealisticPortrait('swordsman') },
        { id: 'fire_mage',      name: '🔥 Inferno Pyromancer',      ring: 'v14-ring-fire',    req: 'free', img: paintRealisticPortrait('fire_mage') },
        { id: 'water_bender',   name: '🌊 Tidal Hydromancer',       ring: 'v14-ring-ice',     req: 'free', img: paintRealisticPortrait('water_bender') },
        { id: 'lightning_lord', name: '⚡ Raijin Storm Lord',       ring: 'v14-ring-gold',    req: 'free', img: paintRealisticPortrait('lightning_lord') },
        { id: 'rubber_hero',    name: '🥊 Gear Rubber Champion',    ring: 'v14-ring-fire',    req: 'free', img: paintRealisticPortrait('rubber_hero') },
        { id: 'spacetime_god',  name: '🌌 Chronos Space-Time',      ring: 'v14-ring-violet',  req: 'free', img: paintRealisticPortrait('spacetime_god') }
      ];

      const playersMap = {};
      let rpgData = null, curTab = 'pvp', grindState = null, livePvp = null, roomOpponents = [], animId = null;

      function startStageCanvas(leftId, rightId, rightEmoji) {
        if (animId) cancelAnimationFrame(animId);
        let t = 0;
        function draw() {
          const c = document.getElementById('rpgStageCanvas');
          const modal = document.getElementById('rpgArenaModal');
          if (!c || !modal || modal.style.display === 'none' || !document.body.contains(c)) {
            if (animId) cancelAnimationFrame(animId);
            animId = null;
            return;
          }
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

      window.switchRpgTab = function(t, btn) {
        curTab = t;
        document.querySelectorAll('.rpg-tab').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        if (t === 'pvp' && typeof socket !== 'undefined') socket.emit('rpgGetRoomPlayers');
        renderRpgBody();
      };

      window.leavePvpToLobby = function() {
        if (livePvp && !livePvp.finished && typeof socket !== 'undefined') {
          socket.emit('rpgPvpForfeit', { battleId: livePvp.id });
        }
        livePvp = null;
        if (typeof socket !== 'undefined') socket.emit('rpgGetRoomPlayers');
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
      window.renderRpgBody = function() {
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
              '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
                '<button onclick="window.leavePvpToLobby()" style="padding:4px 9px;border:1px solid #f43f5e;border-radius:7px;background:#1e293b;color:#fda4af;font-size:10px;font-weight:900;cursor:pointer;">⬅️ Back to PvP Lobby</button>' +
                '<span style="font-size:10px;color:#94a3b8;">Battle ID: ' + livePvp.id.slice(-4) + '</span>' +
              '</div>' +
              '<div style="display:flex;justify-content:space-between;font-size:11px;font-weight:900;">' +
                '<span style="color:#4ade80;">' + meObj.username + ' (❤️ ' + myHpTxt + ')</span>' +
                '<span style="color:#f87171;">' + oppObj.username + ' (❤️ ' + oppHpTxt + ')</span>' +
              '</div>' +
              '<div style="display:flex;gap:6px;margin:3px 0;"><div style="flex:1;height:7px;background:#1e293b;border-radius:4px;"><div style="width:' + myPct + '%;height:100%;background:#4ade80;border-radius:4px;"></div></div><div style="flex:1;height:7px;background:#1e293b;border-radius:4px;"><div style="width:' + oppPct + '%;height:100%;background:#ef4444;border-radius:4px;"></div></div></div>' +
              '<canvas id="rpgStageCanvas" width="400" height="175"></canvas>' +
              '<div style="font-size:11px;color:#fde047;text-align:center;font-weight:bold;margin:4px 0;">' + livePvp.log + '</div>' +
              (livePvp.finished
                ? '<button onclick="window.leavePvpToLobby()" style="width:100%;padding:10px;border:none;border-radius:10px;background:#10b981;color:#fff;font-weight:900;cursor:pointer;">🏆 Return to PvP Lobby</button>'
                : '<div style="text-align:center;font-size:11px;font-weight:900;color:' + (isMyTurn ? '#4ade80' : '#94a3b8') + ';margin-bottom:4px;">' + (isMyTurn ? '🔥 YOUR TURN! Pick a Skill:' : '⏳ Waiting for ' + oppObj.username + '...') + '</div>' +
                  '<div class="rpg-skill-grid">' + meObj.fighter.skills.map((s, i) => '<button class="rpg-skill-btn' + (s.sig ? ' sig' : '') + '" ' + (!isMyTurn || meObj.cds[i] > 0 ? 'disabled' : '') + ' onclick="socket.emit(\'rpgPvpUseSkill\',{battleId:\'' + livePvp.id + '\',skillIdx:' + i + '})">' + (i + 1) + '. ' + s.name + (meObj.cds[i] > 0 ? ' (' + meObj.cds[i] + 't)' : '') + '<br><span style="font-size:9px;color:#94a3b8;">' + s.desc + '</span></button>').join('') + '</div>');
            setTimeout(() => startStageCanvas(meObj.fighter.id, oppObj.fighter.id, oppObj.fighter.icon), 25);
          } else {
            body.innerHTML =
              '<div style="text-align:center;margin-bottom:8px;">' +
                '<div style="font-size:12px;font-weight:900;color:#38bdf8;">⚔️ CHALLENGE AN ONLINE PLAYER TO AVATAR PVP</div>' +
                '<div style="font-size:10px;color:#cbd5e1;">Your Stats: ❤️ <b>' + st.maxHp + '</b> | ⚔️ <b>' + st.atk + '</b></div>' +
                '<button onclick="socket.emit(\'rpgGetRoomPlayers\')" style="margin-top:5px;padding:4px 10px;border:1px solid #38bdf8;border-radius:8px;background:#0f172a;color:#38bdf8;font-size:10px;font-weight:bold;cursor:pointer;">🔄 Refresh Online Players</button>' +
              '</div>' +
              (roomOpponents.length === 0
                ? '<div style="text-align:center;color:#94a3b8;font-size:12px;padding:14px;">No other players in this server yet! Invite friends or grind levels in <b>🐺 Grind Lvl</b>!</div>'
                : roomOpponents.map(op =>
                    '<div style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.06);border:1px solid #f43f5e;border-radius:10px;padding:8px;margin-bottom:6px;">' +
                      '<div><div style="font-weight:900;font-size:12px;">' + op.username + '</div><div style="font-size:10px;color:#fde047;">' + op.fighterName + ' (Lvl ' + op.lvl + ')</div></div>' +
                      '<button onclick="socket.emit(\'rpgChallengePlayer\',{targetSocketId:\'' + op.id + '\'})" style="padding:6px 12px;border:none;border-radius:9px;background:linear-gradient(90deg,#ef4444,#ec4899);color:#fff;font-weight:900;font-size:11px;cursor:pointer;">⚔️ Fight!</button>' +
                    '</div>'
                  ).join(''));
          }
        } else if (curTab === 'grind') {
          if (!grindState) {
            body.innerHTML = '<div style="text-align:center;padding:10px;"><div style="font-weight:900;font-size:14px;">' + f.name + ' (' + f.tier + ')</div><div style="font-size:11px;color:#4ade80;margin:4px 0;">❤️ HP: ' + st.maxHp + ' | ⚔️ ATK: ' + st.atk + '</div><div style="display:flex;gap:8px;margin-top:8px;"><button onclick="startGrindBattle(\'mob\')" style="flex:1;padding:10px;border:none;border-radius:10px;background:#0284c7;color:#fff;font-weight:900;cursor:pointer;">🐺 Grind Mob (+70 XP)</button><button onclick="startGrindBattle(\'boss\')" style="flex:1;padding:10px;border:none;border-radius:10px;background:#dc2626;color:#fff;font-weight:900;cursor:pointer;">👹 Raid Boss (+210 XP)</button></div></div>';
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
                : '<div class="rpg-skill-grid">' + grindState.fighter.skills.map((s, i) => '<button class="rpg-skill-btn' + (s.sig ? ' sig' : '') + '" ' + (grindState.cds[i] > 0 ? 'disabled' : '') + ' onclick="useGrindSkill(' + i + ')">' + (i + 1) + '. ' + s.name + (grindState.cds[i] > 0 ? ' (' + grindState.cds[i] + 't)' : '') + '<br><span style="font-size:9px;color:#94a3b8;">' + s.desc + '</span></button>').join('') + '</div>');
            setTimeout(() => startStageCanvas(grindState.fighter.id, null, grindState.eIcon), 25);
          }
        }
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
              '<button onclick="socket.emit(\'rpgOpenBundle\',\'' + getMe() + '\')" style="width:100%;padding:10px;border:none;border-radius:12px;background:linear-gradient(90deg,#f59e0b,#ec4899);color:#fff;font-weight:900;cursor:pointer;">🎲 Roll Avatar Gacha (🪙 10 MVP)</button>' +
              '<div style="display:flex;gap:5px;margin-top:8px;">' +
                '<input id="rpgHostCodeInp" placeholder="Enter Host Code (#sammuop, #millyqueen, #ishikagold)..." style="flex:1;padding:6px;border-radius:8px;border:1px solid #38bdf8;background:#090d16;color:#fff;font-size:11px;">' +
                '<button onclick="socket.emit(\'rpgRedeemHostCode\',{username:\'' + getMe() + '\',code:document.getElementById(\'rpgHostCodeInp\').value})" style="padding:6px 10px;border:none;border-radius:8px;background:#2563eb;color:#fff;font-weight:bold;">Unlock</button>' +
              '</div>' +
            '</div>';
        } else if (curTab === 'heroes') {
          body.innerHTML = Object.keys(p.owned).map(id => {
            const hf = rpgData.fighters[id]; if (!hf) return '';
            const hst = calcStats(hf, p);
            return '<div onclick="socket.emit(\'rpgSelectFighter\',{username:\'' + getMe() + '\',fighterId:\'' + id + '\'})" style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.06);border:1.5px solid ' + hf.color + ';border-radius:10px;padding:7px;margin-bottom:5px;cursor:pointer;">' +
              '<div><b>' + hf.name + '</b> <span style="font-size:10px;color:' + hf.color + ';">[' + hf.tier + ' • Lvl ' + hst.lvl + ']</span><div style="font-size:10px;color:#94a3b8;">❤️ ' + hst.maxHp + ' HP | ⚔️ ' + hst.atk + ' ATK</div></div>' +
              '<span style="font-weight:900;font-size:11px;">' + (p.activeChar === id ? '✅ Equipped' : 'Equip') + '</span>' +
            '</div>';
          }).join('');
        } else if (curTab === 'shop') {
          body.innerHTML = (rpgData.accessories || []).map(a =>
            '<div style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.06);border:1px solid #38bdf8;border-radius:10px;padding:7px;margin-bottom:5px;">' +
              '<div><b>' + a.name + '</b><div style="font-size:10px;color:#4ade80;">+' + a.atkBonus + ' ATK | +' + a.hpBonus + ' HP</div></div>' +
              '<button onclick="socket.emit(\'rpgBuyAccessory\',{username:\'' + getMe() + '\',accId:\'' + a.id + '\'})" style="padding:5px 10px;border:none;border-radius:7px;background:#f59e0b;color:#090d16;font-weight:900;cursor:pointer;">💰 ' + a.cost + '</button>' +
            '</div>'
          ).join('');
        }
      };

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
            else if (av.id === 'host_ishika') msgBox.classList.add('v14-chat-solar');
            else msgBox.classList.add('v14-chat-host');
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
          '<button onclick="window.stDrawVault();document.getElementById(\'stVaultModal\').style.display=\'flex\'" style="background:linear-gradient(90deg,#7c3aed,#ec4899);border:1.5px solid #fde047;color:#fff;font-weight:900;font-size:11px;padding:6px 10px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.6);cursor:pointer;">👑 Avatars</button>' +
          '<button onclick="window.openRpgModalNow()" style="background:linear-gradient(90deg,#f59e0b,#dc2626);border:1.5px solid #fde047;color:#fff;font-weight:900;font-size:11px;padding:6px 10px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.6);cursor:pointer;">⚔️ Avatar PvP</button>';
        document.body.appendChild(bar);
      }

      function initArmory() {
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
          socket.on('rpgPvpLeft', () => { livePvp = null; socket.emit('rpgGetRoomPlayers'); renderRpgBody(); });
          socket.on('rpgPvpEnd', ({ duel, winner }) => {
            livePvp = { ...duel, finished: true, log: '🏆 ' + winner.toUpperCase() + ' WON THE AVATAR PVP DUEL!' };
            renderRpgBody();
          });
        }
        renderChatAvatars();
      }

      // Initial call on DOMContentLoaded
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initArmory);
      } else {
        initArmory();
      }

      // MutationObserver for chat updates
      function setupChatObserver() {
        const chatBox = document.getElementById('chatBox');
        const messages = document.getElementById('messages');
        const targets = [chatBox, messages].filter(Boolean);
        if (targets.length === 0) {
          // Retry after a short delay
          setTimeout(setupChatObserver, 500);
          return;
        }
        const observer = new MutationObserver(() => renderChatAvatars());
        targets.forEach(target => observer.observe(target, { childList: true, subtree: true }));
      }
      setupChatObserver();
    })();
    </script>
    `;

    // Inject COMBINED_UI into all HTML responses
    app.use((req, res, next) => {
        const originalSend = res.send;
        res.send = function (body) {
            if (typeof body === 'string' && body.includes('</body>')) {
                body = body.replace('</body>', COMBINED_UI + '</body>');
            }
            originalSend.call(this, body);
        };
        next();
    });

    app.locals.AVATAR_RPG_UI = COMBINED_UI;
};
