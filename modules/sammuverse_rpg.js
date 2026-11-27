module.exports = function(ctx) {
    let { app, io, fs, path, serversDB, saveDB, OG_HOSTS, MASTER_KEYS, lockedOGSignatures, verifyOGHostTripleLock, arenas, getArena, syncArenaPlayers, IMPOSTER_WORDS, EXTRA_ANIME_QUIZ } = ctx;
    const getFullRoomPlayers = (srvId) => ctx.getFullRoomPlayers(srvId);
    const getCoins = (u) => ctx.getCoins(u);
    const addCoins = (u, a) => ctx.addCoins(u, a);
    const playerWallet = ctx.playerWallet;
    const playerCards = ctx.playerCards;

    // ⚔️ SAMMUVERSE V4 ENGINE — PIECE 1A/20: DB FILES, CLOUD SYNC & LINEAGES
    // ============================================================================
    const SV_LOG_FILE = path.join(__dirname, 'sammuverse_logs.json');
    const SV_STATS_FILE = path.join(__dirname, 'sammuverse_stats.json');
    const ECONOMY_DB_FILE = path.join(__dirname, 'sammu_economy.json');
    let svBattleLogs = [];
    let svPlayerStats = {};

    if (fs.existsSync(SV_LOG_FILE)) { try { svBattleLogs = JSON.parse(fs.readFileSync(SV_LOG_FILE, 'utf8')); } catch (e) {} }
    if (fs.existsSync(SV_STATS_FILE)) { try { svPlayerStats = JSON.parse(fs.readFileSync(SV_STATS_FILE, 'utf8')); } catch (e) {} }
    if (fs.existsSync(ECONOMY_DB_FILE)) {
        try {
            const savedEco = JSON.parse(fs.readFileSync(ECONOMY_DB_FILE, 'utf8'));
            if (savedEco.wallets) Object.entries(savedEco.wallets).forEach(([k, v]) => playerWallet.set(k, v));
            if (savedEco.cards) Object.entries(savedEco.cards).forEach(([k, v]) => playerCards.set(k, v));
        } catch (e) {}
    }

    const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/^UPSTASH_REDIS_REST_URL=/i, '').replace(/^["']|["']$/g, '').trim();
    const UPSTASH_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || '').replace(/^UPSTASH_REDIS_REST_TOKEN=/i, '').replace(/^["']|["']$/g, '').trim();

    async function upstashCmd(cmdArray) {
        if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
        try {
            const res = await fetch(UPSTASH_URL, {
                method: 'POST',
                headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(cmdArray)
            });
            const data = await res.json();
            return data ? data.result : null;
        } catch (e) { return null; }
    }

    function saveSvStats() {
        try { fs.writeFileSync(SV_STATS_FILE, JSON.stringify(svPlayerStats, null, 2)); } catch (e) {}
        if (UPSTASH_URL && UPSTASH_TOKEN) upstashCmd(['SET', 'sammu_sv_stats', JSON.stringify(svPlayerStats)]);
    }

    function saveEconomyDB() {
        try {
            fs.writeFileSync(ECONOMY_DB_FILE, JSON.stringify({
                wallets: Object.fromEntries(playerWallet),
                cards: Object.fromEntries(playerCards)
            }, null, 2));
        } catch (e) {}
        if (UPSTASH_URL && UPSTASH_TOKEN) {
            upstashCmd(['SET', 'sammu_economy', JSON.stringify({ wallets: Object.fromEntries(playerWallet), cards: Object.fromEntries(playerCards) })]);
        }
    }

    const _origAddCoinsV4 = addCoins;
    addCoins = function(uname, amt) {
        const res = _origAddCoinsV4(uname, amt);
        saveEconomyDB();
        return res;
    };

    const SV_LINEAGES = {
        human:     { icon: '🧑', name: 'Mortal Explorer',       stage3: '👑 Ascendant Hero',       hpTurn: 0,  dmgMult: 1.00, steal: 0,    absorb: 0,    stunImmune: false },
        slime:     { icon: '🟢', name: 'Primordial Void Slime', stage3: '🟢 Void Sovereign Slime', hpTurn: 14, dmgMult: 1.05, steal: 0,    absorb: 0.12, stunImmune: false },
        ape:       { icon: '🐵', name: 'Astral Ape Warrior',    stage3: '⚡ Super Astral God',     hpTurn: 0,  dmgMult: 1.22, steal: 0,    absorb: 0,    stunImmune: false },
        reaper:    { icon: '👻', name: 'Phantom Soul Reaper',   stage3: '⚔️ Eclipse Bankai',       hpTurn: 0,  dmgMult: 1.18, steal: 0.05, absorb: 0,    stunImmune: false },
        demon:     { icon: '😈', name: 'Infernal Demonkin',     stage3: '🔥 Abyssal Overlord',     hpTurn: 0,  dmgMult: 1.10, steal: 0.16, absorb: 0,    stunImmune: false },
        dragonkin: { icon: '🐉', name: 'Ancient Dragonkin',     stage3: '🐲 Cosmic Wyrm King',     hpTurn: 8,  dmgMult: 1.15, steal: 0,    absorb: 0.08, stunImmune: false },
        celestial: { icon: '🔱', name: 'Celestial Avatar',      stage3: '🔱 Supreme Cosmic Deity', hpTurn: 12, dmgMult: 1.25, steal: 0.10, absorb: 0.10, stunImmune: true  }
    };
                 
        // ============================================================================
    // ⚔️ SAMMUVERSE V4 ENGINE — PIECE 1B/20: TITLES, PROFILE LOADER & LOGGER
    // ============================================================================
    const SV_TITLES = [
        { id: 'rookie',     tag: '🌱 Rookie',           color: '#94a3b8', req: 'Default Starter Title' },
        { id: 'hunter',     tag: '⚔️ Bounty Hunter',    color: '#38bdf8', req: 'Reach 1.0M Bounty Honor' },
        { id: 'warlord',    tag: '🏴‍☠️ Warlord',          color: '#a855f7', req: 'Reach 2.5M Bounty Honor' },
        { id: 'emperor',    tag: '💀 Abyss Emperor',    color: '#f43f5e', req: 'Reach 10.0M Bounty Honor' },
        { id: 'sovereign',  tag: '👑 Sammu Sovereign',  color: '#facc15', req: 'Reach 30.0M Bounty Honor' },
        { id: 'v3god',      tag: '🔥 V3 Ascended',      color: '#fb923c', req: 'Reach 100 Wins on any Power (V3)' },
        { id: 'titanlord',  tag: '🌌 Colossal Titan',   color: '#f43f5e', req: 'Unlock Titan Crown Gear' },
        { id: 'omegagod',   tag: '⚡ Omega Awakened',   color: '#38bdf8', req: 'Unlock Omega Core Gear' },
        { id: 'adventurer', tag: '🗺️ Realm Conqueror',  color: '#4ade80', req: 'Clear Adventure Chapter 5' },
        { id: 'petmaster',  tag: '🐉 Ouroboros Tamer',  color: '#e879f9', req: 'Merge an Evolved Mega Pet' },
        { id: 'voidslime',  tag: '🟢 Void Slime King',  color: '#4ade80', req: 'Awaken Void Slime Stage 3' },
        { id: 'gymgod',     tag: '🏋️ Gym Sovereign',    color: '#fb923c', req: 'Reach Total Training Level 50' },
        { id: 'godly',      tag: '✨ Godly Enchanted',  color: '#67e8f9', req: 'Roll a Godly Enchantment' },
        { id: 'forger',     tag: '⚗️ Soul Forger',      color: '#e879f9', req: 'Forge a Custom Fusion Power' },
        { id: 'vishnu',     tag: '🔱 MahaVishnu',       color: '#fde047', req: 'Unlock MahaVishnu Power' },
        { id: 'lunaremp',   tag: '🌙 Lunar Empress',    color: '#fda4af', req: 'Unlock Dr. Moon Power' },
        { id: 'tower25',    tag: '🗼 Tower Climber',    color: '#38bdf8', req: 'Reach Floor 25 in Endless Tower' },
        { id: 'tower50',    tag: '♾️ Infinite Sovereign',color: '#e879f9', req: 'Reach Floor 50 in Endless Tower' },
        { id: 'tower100',   tag: '🌌 Floor 100 God',    color: '#facc15', req: 'Reach Floor 100 in Endless Tower' },
        { id: 'rich',       tag: '💎 Millionaire',      color: '#4ade80', req: 'Hold 100,000+ Coins' }
    ];

    function getSvProfile(uname) {
        const k = (uname || 'Player').toLowerCase().trim();
        if (!svPlayerStats[k]) {
            svPlayerStats[k] = {
                atkLv: 0, hpLv: 0, wins: 0, streak: 0, bounty: 10000, maxTowerFloor: 1, towerCheckpoint: 1,
                lineage: 'human', lineageStage: 1, activeTitle: 'rookie', unlockedTitles: ['rookie'],
                training: { fistLv: 0, bodyLv: 0, chiLv: 0, xp: 0 },
                gears: { omegaCore: false, titanCrown: false },
                adventure: { chapter: 1, stage: 1, cleared: false },
                petEssence: 0, lastDailySpin: 0,
                hasStone: false, unlockedPowers: [], ownedPets: [], activePet: null, activePet2: null,
                ownedRelics: [], activeRelic: null, enchants: {}, powerWins: {}, customPowers: [], redeemedCodes: []
            };
        }
        const p = svPlayerStats[k];
        if (!p.training) p.training = { fistLv: 0, bodyLv: 0, chiLv: 0, xp: 0 };
        if (!p.gears) p.gears = { omegaCore: false, titanCrown: false };
        if (!p.adventure) p.adventure = { chapter: 1, stage: 1, cleared: false };
        if (typeof p.petEssence !== 'number') p.petEssence = 0;
        if (typeof p.lastDailySpin !== 'number') p.lastDailySpin = 0;
        if (!Array.isArray(p.unlockedTitles)) p.unlockedTitles = ['rookie'];
        if (typeof p.bounty !== 'number') p.bounty = 10000;
        if (!p.lineage) p.lineage = 'human';
        if (!p.lineageStage) p.lineageStage = 1;
        if (!p.activeTitle) p.activeTitle = 'rookie';
        if (!p.powerWins) p.powerWins = {};
        if (!Array.isArray(p.customPowers)) p.customPowers = p.customPower ? [p.customPower] : [];
        p.coins = getCoins(uname);
        return p;
    }

    function syncPlayerTitlesAndBounty(uname) {
        if (!uname) return;
        const prof = getSvProfile(uname);
        const grant = (id) => { if (!prof.unlockedTitles.includes(id)) prof.unlockedTitles.push(id); };
        if (prof.bounty >= 1000000) grant('hunter');
        if (prof.bounty >= 2500000) grant('warlord');
        if (prof.bounty >= 10000000) grant('emperor');
        if (prof.bounty >= 30000000) grant('sovereign');
        if (Object.values(prof.powerWins || {}).some(w => w >= 100)) grant('v3god');
        if (prof.gears?.omegaCore) grant('omegagod');
        if (prof.gears?.titanCrown) grant('titanlord');
        if (prof.adventure?.cleared || (prof.adventure?.chapter || 1) > 5) grant('adventurer');
        if ((prof.ownedPets || []).includes('ouroboros') || (prof.ownedPets || []).includes('chimera')) grant('petmaster');
        if (prof.lineage === 'slime' && prof.lineageStage >= 3) grant('voidslime');
        const trTotal = (prof.training?.fistLv || 0) + (prof.training?.bodyLv || 0) + (prof.training?.chiLv || 0);
        if (trTotal >= 50) grant('gymgod');
        if (prof.enchants && Object.values(prof.enchants).some(e => e.id === 'godly')) grant('godly');
        if (prof.customPowers.length > 0) grant('forger');
        if ((prof.unlockedPowers || []).includes('mahavishnu')) grant('vishnu');
        if ((prof.unlockedPowers || []).includes('moon')) grant('lunaremp');
        if ((prof.maxTowerFloor || 1) >= 25) grant('tower25');
        if ((prof.maxTowerFloor || 1) >= 50) grant('tower50');
        if ((prof.maxTowerFloor || 1) >= 100) grant('tower100');
        if (getCoins(uname) >= 100000) grant('rich');
    }

    function recordSvLog(srvId, winner, winPower, loser, losePower) {
        svBattleLogs.unshift({ srvId, winner, winPower, loser, losePower, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) });
        if (svBattleLogs.length > 40) svBattleLogs.pop();
        try { fs.writeFileSync(SV_LOG_FILE, JSON.stringify(svBattleLogs, null, 2)); } catch (e) {}
        io.to(srvId).emit('svLogsUpdate', svBattleLogs.filter(l => l.srvId === srvId));
    }
  // ============================================================================
    // ⚔️ SAMMUVERSE V4 ENGINE — PIECE 2/20: STARTER, RARE & EPIC POWERS
    // ============================================================================
    const SV_DEFS = {
        fire: {
            icon: '🔥', name: 'Fire Inferno', hp: 200, strong: ['ice'],
            moves: [
                { label: 'Fireball (28 DMG)', dmg: 28 },
                { label: 'Flame Tornado (42 DMG)', dmg: 42 },
                { label: 'Heat Shield (Block 70%)', block: 0.70 },
                { label: '☀️ Solar Flare ULT (68 DMG)', dmg: 68, cut: { theme: 'fire', emoji: '☀️🔥', title: 'SOLAR FLARE!' } }
            ]
        },
        water: {
            icon: '🌊', name: 'Water Tsunami', hp: 200, strong: ['fire'],
            moves: [
                { label: 'Hydro Whip (26 DMG)', dmg: 26 },
                { label: 'Whirlpool Trap (35 DMG)', dmg: 35 },
                { label: 'Water Mirror (Reflect 50%)', block: 0.50, reflect: 0.50 },
                { label: '🌊 Abyssal Wave ULT (65 DMG)', dmg: 65, cut: { theme: 'water', emoji: '🌊🐉', title: 'ABYSSAL TSUNAMI!' } }
            ]
        },
        lightning: {
            icon: '⚡', name: 'Lightning Raijin', hp: 200, strong: ['water'],
            moves: [
                { label: 'Thunder Bolt (30 DMG)', dmg: 30 },
                { label: 'Speed Blitz (43 DMG)', dmg: 43 },
                { label: 'Static Armor (Block 65%)', block: 0.65 },
                { label: '🐉 Kirin Sky Dragon ULT (69 DMG)', dmg: 69, cut: { theme: 'lightning', emoji: '⚡🐉', title: 'KIRIN THUNDER DRAGON!' } }
            ]
        },
        ice: {
            icon: '❄️', name: 'Absolute Ice', hp: 200, strong: ['storm'],
            moves: [
                { label: 'Ice Lance (27 DMG)', dmg: 27 },
                { label: 'Frostbite (36 DMG)', dmg: 36 },
                { label: 'Glacier Wall (Block 80%)', block: 0.80 },
                { label: '🧊 Ice Age Freeze ULT (58 DMG + Stun)', dmg: 58, stun: true, cut: { theme: 'ice', emoji: '❄️🧊', title: 'ABSOLUTE ZERO ICE AGE!' } }
            ]
        },
        storm: {
            cost: 300, icon: '🌪️', name: 'Storm Dragon', hp: 205, strong: ['water'],
            moves: [
                { label: 'Gale Blade (29 DMG)', dmg: 29 },
                { label: 'Tornado Slam (43 DMG)', dmg: 43 },
                { label: 'Wind Wall (Block 75%)', block: 0.75 },
                { label: '⚡ Tempest Roar ULT (71 DMG)', dmg: 71, cut: { theme: 'lightning', emoji: '🌪️⚡', title: 'TEMPEST DRAGON ROAR!' } }
            ]
        },
        venom: {
            cost: 300, icon: '☠️', name: 'Venom Hydra', hp: 205, strong: ['water'],
            moves: [
                { label: 'Acid Spit (28 DMG)', dmg: 28 },
                { label: 'Toxic Fang (42 DMG)', dmg: 42 },
                { label: 'Shed Skin (+25 HP & Shield)', block: 0.50, heal: 25 },
                { label: '🐍 Hydra Plague ULT (69 DMG)', dmg: 69, cut: { theme: 'zoro', emoji: '☠️🐍', title: 'HYDRA VENOM APOCALYPSE!' } }
            ]
        },
        rubber: {
            cost: 300, icon: '👒', name: 'Rubber Gear 5', hp: 210, strong: ['lightning'],
            moves: [
                { label: 'Gum-Gum Pistol (29 DMG)', dmg: 29 },
                { label: 'Gatling Barrage (44 DMG)', dmg: 44 },
                { label: 'Elastic Bounce (Evade +15 HP)', evade: true, heal: 15 },
                { label: '👊 Bajrang Fist ULT (72 DMG)', dmg: 72, cut: { theme: 'lightning', emoji: '👒👊', title: 'GEAR 5: BAJRANG GUN!' } }
            ]
        },
        blood: {
            cost: 300, icon: '🩸', name: 'Blood Demon', hp: 205, strong: ['sun'],
            moves: [
                { label: 'Crimson Slash (29 DMG)', dmg: 29 },
                { label: 'Vampire Bite (34 DMG + 18 HP)', dmg: 34, heal: 18 },
                { label: 'Blood Mist (Evade Hit)', evade: true },
                { label: '🌕 Moonlit Massacre ULT (70 DMG)', dmg: 70, cut: { theme: 'moon', emoji: '🩸🌕', title: 'MOONLIT DEMON ART!' } }
            ]
        },
        gravity: {
            cost: 750, icon: '🪐', name: 'Gravity Force', hp: 210, strong: ['rubber'],
            moves: [
                { label: 'Crush Slam (31 DMG)', dmg: 31 },
                { label: 'Meteor Drop (46 DMG)', dmg: 46 },
                { label: 'Gravity Repulse (Block 75%)', block: 0.75 },
                { label: '☄️ Planetary Devastation ULT (74 DMG)', dmg: 74, cut: { theme: 'vishwaroopa', emoji: '☄️🪐', title: 'PLANETARY DEVASTATION!' } }
            ]
        },
        space: {
            cost: 750, icon: '🌌', name: 'Space Warp', hp: 210, strong: ['time'],
            moves: [
                { label: 'Spatial Slash (32 DMG)', dmg: 32 },
                { label: 'Void Rift (44 DMG)', dmg: 44 },
                { label: 'Teleport Dodge (Evade Hit)', evade: true },
                { label: '🌌 Dimension Collapse ULT (74 DMG)', dmg: 74, cut: { theme: 'vishwaroopa', emoji: '🌌💥', title: 'DIMENSION COLLAPSE!' } }
            ]
        },
        time: {
            cost: 750, icon: '⏳', name: 'Time Chrono', hp: 210, strong: ['space'],
            moves: [
                { label: 'Chrono Strike (28 DMG)', dmg: 28 },
                { label: 'Age Decay (40 DMG)', dmg: 40 },
                { label: 'Rewind Heal (+40 HP)', heal: 40 },
                { label: '⏸️ Time Stop ULT (62 DMG + Stun)', dmg: 62, stun: true, cut: { theme: 'chakra', emoji: '⏳⏸️', title: 'CHRONO TIME STOP!' } }
            ]
        },
        sun: {
            cost: 750, icon: '☀️', name: 'Sun God Nika', hp: 215, strong: ['shadow', 'ice'],
            moves: [
                { label: 'Dawn Whip (32 DMG)', dmg: 32 },
                { label: 'Sun Gatling (46 DMG)', dmg: 46 },
                { label: 'Drum Heartbeat (+35 HP)', heal: 35 },
                { label: '🔥 Bajrang Dawn ULT (78 DMG)', dmg: 78, cut: { theme: 'fire', emoji: '☀️🥁', title: 'DRUMS OF LIBERATION!' } }
            ]
        }
    };                                      
         // ============================================================================
    // ⚔️ SAMMUVERSE V4 ENGINE — PIECE 3/20: LEGENDARY, FUSIONS & MYTHICS
    // ============================================================================
    Object.assign(SV_DEFS, {
        shadow: {
            cost: 1500, icon: '🌑', name: 'Shadow Monarch', hp: 225, strong: ['blood'],
            moves: [
                { label: 'Shadow Dagger (35 DMG)', dmg: 35 },
                { label: 'Arise Army (49 DMG)', dmg: 49 },
                { label: 'Umbral Dodge (Evade Hit)', evade: true },
                { label: '👑 Monarch Domain ULT (82 DMG)', dmg: 82, cut: { theme: 'vishwaroopa', emoji: '🌑👑', title: 'ARISE: SHADOW DOMAIN!' } }
            ]
        },
        blackhole: {
            cost: 1500, icon: '🕳️', name: 'Black Hole', hp: 225, strong: ['antimatter', 'gravity'],
            moves: [
                { label: 'Dark Pull (33 DMG)', dmg: 33 },
                { label: 'Event Horizon (44 DMG + Drain)', dmg: 44, heal: 15 },
                { label: 'Matter Absorb (+30 HP & Shield)', block: 0.55, heal: 30 },
                { label: '🕳️ Supermassive Crunch ULT (82 DMG)', dmg: 82, cut: { theme: 'vishwaroopa', emoji: '🕳️🌌', title: 'SUPERMASSIVE SINGULARITY!' } }
            ]
        },
        antimatter: {
            cost: 1500, icon: '⚛️', name: 'Anti-Matter', hp: 220, strong: ['blackhole'],
            moves: [
                { label: 'Positron Beam (36 DMG)', dmg: 36 },
                { label: 'Chain Annihilation (52 DMG)', dmg: 52 },
                { label: 'Phase Shift (Evade Hit)', evade: true },
                { label: '💥 Big Bang Erasure ULT (86 DMG)', dmg: 86, cut: { theme: 'chakra', emoji: '⚛️💥', title: 'BIG BANG ERASURE!' } }
            ]
        },
        zoro: {
            cost: 2000, icon: '⚔️', name: 'Zoro (3-Sword King)', hp: 245, passiveRed: 0.12, strong: ['blood', 'venom'],
            moves: [
                { label: 'Oni Giri (40 DMG)', dmg: 40 },
                { label: 'Dragon Twister (56 DMG)', dmg: 56 },
                { label: 'King Haki Parry (Block 80%)', block: 0.80 },
                { label: '👹 Ashura 9-Sword ULT (94 DMG)', dmg: 94, cut: { theme: 'zoro', emoji: '👹⚔️', title: 'ASHURA: 9-SWORD STYLE!' } }
            ]
        },
        sus: {
            cost: 2000, icon: '👀', name: 'Sus (Shadow Imposter)', hp: 240, passiveRed: 0.12, strong: ['shadow'],
            moves: [
                { label: 'Vent Ambush (40 DMG)', dmg: 40 },
                { label: 'Sabotage Strike (54 DMG)', dmg: 54 },
                { label: 'Fake Task Evade (+35 HP)', evade: true, heal: 35 },
                { label: '🚨 Emergency Eject ULT (92 DMG + Stun)', dmg: 92, stun: true, cut: { theme: 'fire', emoji: '🚨👀', title: 'IMPOSTER EJECTION!' } }
            ]
        },
        moon: {
            cost: 4000, icon: '🌙', name: 'Dr. Moon (Lunar Empress)', hp: 270, passiveRed: 0.18, strong: ['blood', 'venom', 'shadow'],
            moves: [
                { label: '🌙 Lunar Scalpel (44 DMG)', dmg: 44 },
                { label: '🌿 Sanjeevani Surge (58 DMG + 18 HP)', dmg: 58, heal: 18 },
                { label: '🩺 Doctor Elixir (Evade +65 HP)', evade: true, heal: 65 },
                { label: '🌕 Full Moon Eclipse ULT (98 DMG + Stun)', dmg: 98, stun: true, cut: { theme: 'moon', emoji: '🌙🩺', title: 'DR. MOON: LUNAR ECLIPSE!' } }
            ]
        },
        plasma: {
            fused: true, icon: '⚛️🔥', name: 'Plasma Emperor', hp: 300, passiveRed: 0.18, strong: ['ice', 'shadow'],
            moves: [
                { label: 'Plasma Lance (48 DMG)', dmg: 48 },
                { label: 'Supernova Arc (64 DMG)', dmg: 64 },
                { label: 'Ion Barrier (Block 80%)', block: 0.80 },
                { label: '☀️ STAR COLLAPSE ULT (108 DMG)', dmg: 108, cut: { theme: 'fire', emoji: '⚛️🔥', title: 'PLASMA STAR COLLAPSE!' } }
            ]
        },
        leviathan: {
            fused: true, icon: '🐉🌊', name: 'Steam Leviathan', hp: 305, passiveRed: 0.20, strong: ['fire', 'gravity'],
            moves: [
                { label: 'Scalding Geyser (46 DMG)', dmg: 46 },
                { label: 'Boil Tsunami (62 DMG + 18 HP)', dmg: 62, heal: 18 },
                { label: 'Mist Mirage (Evade +28 HP)', evade: true, heal: 28 },
                { label: '🐉 OCEAN BOIL ULT (105 DMG)', dmg: 105, cut: { theme: 'water', emoji: '🐉💨', title: 'LEVIATHAN BOIL STORM!' } }
            ]
        },
        chronovoid: {
            fused: true, icon: '⏳🌌', name: 'Chrono Void God', hp: 295, passiveRed: 0.16, strong: ['antimatter', 'blackhole'],
            moves: [
                { label: 'Reality Tear (50 DMG)', dmg: 50 },
                { label: 'Paradox Loop (58 DMG + Stun)', dmg: 58, stunChance: 0.50 },
                { label: 'Time Rewind (Evade +50 HP)', evade: true, heal: 50 },
                { label: '🌌 BIG CRUNCH ULT (112 True DMG)', dmg: 112, trueDmg: true, cut: { theme: 'vishwaroopa', emoji: '⏳🌌', title: 'CHRONO VOID ERASURE!' } }
            ]
        },
        eclipsenika: {
            fused: true, icon: '🌑☀️', name: 'Eclipse Sun God', hp: 315, passiveRed: 0.22, strong: ['blood', 'venom', 'zoro'],
            moves: [
                { label: 'Dawn Eclipse Fist (52 DMG)', dmg: 52 },
                { label: 'Shadow Liberation (68 DMG)', dmg: 68 },
                { label: 'Drum Pulse (Block 70% + 35 HP)', block: 0.70, heal: 35 },
                { label: '🌑☀️ TOTAL ECLIPSE ULT (116 DMG + Stun)', dmg: 116, stun: true, cut: { theme: 'moon', emoji: '🌑☀️', title: 'TOTAL ECLIPSE LIBERATION!' } }
            ]
        },
        mahavishnu: {
            secret: true, icon: '🔱', name: 'Sammu/Samaksh (MahaVishnu)', hp: 420, passiveRed: 0.40, strong: ['blood', 'shadow', 'venom', 'antimatter'],
            moves: [
                { label: '🪈 Prem Bansuri (65 DMG + Stun)', dmg: 65, stunChance: 0.75, cut: { theme: 'bansuri', emoji: '🪈🦚', title: 'PREM BANSURI MELODY!', sfx: 'flute' } },
                { label: '☸️ Sudarshana Chakra (95 True DMG)', dmg: 95, trueDmg: true, cut: { theme: 'chakra', emoji: '☸️🔥', title: 'SUDARSHANA CHAKRA!' } },
                { label: '🛡️ Vaikuntha Kavach (Evade +80 HP)', evade: true, heal: 80 },
                { label: '🌌 Vishwaroopa ULT (160 True DMG + Stun)', dmg: 160, trueDmg: true, stun: true, cut: { theme: 'vishwaroopa', emoji: '🔱🌌', title: 'VISHWAROOPA SUPREME FORM!' } }
            ]
        },
        millyyt: {
            secret: true, icon: '🎬', name: 'Milly (YouTube Queen)', hp: 295, passiveRed: 0.22, strong: ['fire', 'lightning', 'space', 'time'],
            moves: [
                { label: '🔔 Subscribe Smash (46 DMG + Stun)', dmg: 46, stunChance: 0.50 },
                { label: '📈 10M Viral Surge (64 DMG + 20 HP)', dmg: 64, heal: 20 },
                { label: '💎 Diamond Shield (Evade +50 HP)', evade: true, heal: 50 },
                { label: '▶️ Golden Play Button ULT (115 True DMG)', dmg: 115, trueDmg: true, stun: true, cut: { theme: 'milly', emoji: '▶️👑', title: 'MILLY: GOLDEN PLAY BUTTON!' } }
            ]
        },
        ishikastar: {
            secret: true, icon: '✨', name: 'Ishika (Celestial Empress)', hp: 265, passiveRed: 0.18, strong: ['space', 'time'],
            moves: [
                { label: '💫 Starfall Beam (42 DMG)', dmg: 42 },
                { label: '💥 Supernova Burst (58 DMG)', dmg: 58 },
                { label: '🌸 Astral Blessing (Evade +45 HP)', evade: true, heal: 45 },
                { label: '🌠 Empress Meteor ULT (96 DMG)', dmg: 96, cut: { theme: 'vishwaroopa', emoji: '🌠✨', title: 'CELESTIAL EMPRESS METEOR!' } }
            ]
        },
        zoroking: {
            secret: true, icon: '⚔️', name: 'Zoro (King of Hell)', hp: 340, passiveRed: 0.25, strong: ['blood', 'venom', 'shadow'],
            moves: [
                { label: 'Enma Purgatory (52 DMG)', dmg: 52 },
                { label: 'Three-Sword Dragon (72 DMG)', dmg: 72 },
                { label: 'Conqueror Haki (Evade +45 HP)', evade: true, heal: 45 },
                { label: '👹 Dragon Damnation ULT (132 DMG)', dmg: 132, cut: { theme: 'zoro', emoji: '👹⚔️', title: 'KING OF HELL: DRAGON DAMNATION!' } }
            ]
        },
        antimpoke: {
            secret: true, icon: '⚡', name: 'Antim (Astral Sky Sovereign)', hp: 335, passiveRed: 0.24, strong: ['fire', 'water', 'storm'],
            moves: [
                { label: 'Dragon Ascent (50 DMG)', dmg: 50 },
                { label: 'Judgment Beam (70 True DMG)', dmg: 70, trueDmg: true },
                { label: 'Multitype Plate (Block 85%)', block: 0.85 },
                { label: '🐉 Sky Sovereign ULT (130 DMG)', dmg: 130, cut: { theme: 'lightning', emoji: '⚡🐉', title: 'ASTRAL SKY SOVEREIGN: ASCENT!' } }
            ]
        },
        mahadev: {
            secret: true, icon: '🔱', name: 'Mahadev (Tandava Destroyer)', hp: 360, passiveRed: 0.30, strong: ['shadow', 'blood', 'antimatter'],
            moves: [
                { label: 'Trishul Pierce (56 DMG)', dmg: 56 },
                { label: 'Damru Cosmic Beat (74 DMG + Stun)', dmg: 74, stunChance: 0.55 },
                { label: 'Kailash Meditation (+65 HP)', evade: true, heal: 65 },
                { label: '🔥 Third Eye Tandava ULT (140 True DMG)', dmg: 140, trueDmg: true, stun: true, cut: { theme: 'chakra', emoji: '🔱🔥', title: 'THIRD EYE: TANDAVA DESTRUCTION!' } }
            ]
        }
    });

    Object.values(svPlayerStats).forEach(st => {
        if (Array.isArray(st.customPowers)) {
            st.customPowers.forEach(cp => {
                if (cp && cp.id && cp.def) SV_DEFS[cp.id] = cp.def;
            });
        }
    });
         
        // ============================================================================
    // ⚔️ SAMMUVERSE V4 ENGINE — PIECE 4/20: ADVENTURE, TOWER, FIGHTERS & SYNC
    // ============================================================================
    const svBattles = new Map();
    const svPending = new Map();
    const activeDomainClashes = new Map();
    const activeTowerRuns = new Map();

    const ENCHANT_POOL = [
        { id: 'blazing',    name: '🔥 Blazing (+15% Burn DMG)',    mult: 1.15, red: 0,    heal: 0 },
        { id: 'vampiric',   name: '🧛 Vampiric (+15% Lifesteal)',  mult: 1.05, red: 0,    heal: 0.15 },
        { id: 'ironclad',   name: '🛡️ Ironclad (-15% DMG Taken)',  mult: 1.00, red: 0.15, heal: 0 },
        { id: 'thunderous', name: '⚡ Thunderous (+20% Shock DMG)', mult: 1.20, red: 0,    heal: 0 },
        { id: 'godly',      name: '✨ GODLY (+25% ALL STATS)',      mult: 1.25, red: 0.20, heal: 0.12 }
    ];

    const ADVENTURE_CHAPTERS = [
        { ch: 1, title: '🌲 Ch.1: Whispering Dojo',   stages: ['🥷 Rogue Disciple', '🐺 Shadow Wolf', '👹 Dojo Sensei Boss'],     pKey: 'rubber',     baseHp: 210, baseAtk: 6,  coins: 350,  xp: 200,  essence: 15 },
        { ch: 2, title: '🌋 Ch.2: Crimson Volcano',   stages: ['🦎 Magma Salamander', '🔥 Flame Knight', '🐉 Magma Wyrm Boss'],     pKey: 'fire',       baseHp: 340, baseAtk: 14, coins: 700,  xp: 450,  essence: 30 },
        { ch: 3, title: '🌊 Ch.3: Abyssal Trench',    stages: ['🦈 Depth Stalker', '🐙 Kraken Tentacle', '🌊 Leviathan Boss'],      pKey: 'water',      baseHp: 520, baseAtk: 22, coins: 1200, xp: 800,  essence: 50 },
        { ch: 4, title: '⚡ Ch.4: Celestial Citadel', stages: ['🦅 Sky Valkyrie', '⚡ Thunder Golem', '👑 Raijin Sovereign Boss'],  pKey: 'lightning',  baseHp: 780, baseAtk: 30, coins: 2200, xp: 1400, essence: 80 },
        { ch: 5, title: '🌌 Ch.5: Void Throne',       stages: ['🌑 Void Phantom', '🕳️ Singularity Knight', '🔱 Abyssal God Boss'],  pKey: 'antimatter', baseHp: 1150,baseAtk: 40, coins: 5000, xp: 3000, essence: 150 }
    ];

    const TOWER_BOSS_ROSTER = [
        { name: '🥷 Shadow Guardian',       pKey: 'shadow' },
        { name: '🔥 Inferno Warden',        pKey: 'fire' },
        { name: '⚡ Raijin Stormkeeper',    pKey: 'lightning' },
        { name: '❄️ Glacial Colossus',      pKey: 'ice' },
        { name: '🪐 Singularity Titan',     pKey: 'gravity' },
        { name: '⏳ Chronos Gatekeeper',    pKey: 'time' },
        { name: '⚛️ Antimatter Seraph',     pKey: 'antimatter' },
        { name: '👑 Abyssal Tower Monarch', pKey: 'mahavishnu' }
    ];

    function getTrainingBonuses(prof) {
        const tr = prof.training || { fistLv: 0, bodyLv: 0, chiLv: 0, xp: 0 };
        const fLv = Number(tr.fistLv) || 0;
        const bLv = Number(tr.bodyLv) || 0;
        const cLv = Number(tr.chiLv) || 0;
        return {
            bonusDmg: fLv >= 100000 ? Math.round(150 + Math.log10(fLv) * 45) : Math.min(350, fLv * 3),
            bonusHp: bLv >= 100000 ? Math.round(900 + Math.log10(bLv) * 250) : Math.min(2000, bLv * 20),
            ultMult: cLv >= 100000 ? 1.85 : Math.min(1.80, 1 + (cLv * 0.04)),
            critChance: cLv >= 100000 ? 0.50 : Math.min(0.45, cLv * 0.01)
        };
    }

    function getTowerFloorConfig(floor) {
        const template = TOWER_BOSS_ROSTER.at((floor - 1) % TOWER_BOSS_ROSTER.length);
        const isOvercharged = (floor % 5 === 0 && floor % 10 !== 0);
        const isCursed = (floor % 10 === 0);
        const hp = Math.round(180 + (floor * 34) + Math.pow(floor, 1.38) * 14);
        const atk = Math.round(6 + (floor * 1.4) + (isOvercharged ? 10 : 0));
        const red = Math.min(0.45, Number((floor * 0.004).toFixed(3)));
        const coinReward = Math.round((65 + floor * 18) * (isOvercharged ? 2 : 1));
        const modTag = isCursed ? '🩸 CURSED ARENA (50% Less Heal)' : (isOvercharged ? '⚡ OVERCHARGED (2x Coins)' : '⚔️ Standard Ascent');
        return { floor, name: `🗼 F${floor}: ${template.name}`, pKey: template.pKey, hp, atk, red, coinReward, isCursed, modTag };
    }

    function broadcastSvCutscene(battle, cutObj) {
        if (!battle || !cutObj) return;
        if (!battle.p1.isBot) io.to(battle.p1.id).emit('svCutscene', { ...cutObj, _serverId: battle.srvId });
        if (!battle.p2.isBot) io.to(battle.p2.id).emit('svCutscene', { ...cutObj, _serverId: battle.srvId });
    }

    function syncSvBattle(battle, sfx) {
        const sendView = (me, opp) => {
            if (me.isBot) return;
            const formBadge = me.titanTurns > 0 ? ' [🌌 TITAN]' : (me.omegaTurns > 0 ? ' [⚡ OMEGA]' : '');
            const verTag = (me.isV3 ? ' [V3 👑]' : (me.isV2 ? ' [V2]' : '')) + formBadge;
            const oppVerTag = (opp.isV3 ? ' [V3 👑]' : (opp.isV2 ? ' [V2]' : '')) + (opp.titanTurns > 0 ? ' [🌌 TITAN]' : (opp.omegaTurns > 0 ? ' [⚡ OMEGA]' : ''));
            io.to(me.id).emit('svBattleSync', {
                turn: battle.turn, timeLeft: battle.timeLeft, logText: battle.lastLog, sfx: sfx || null,
                me: {
                    name: me.name, icon: me.def.icon, powerName: me.def.name + verTag, powerKey: me.pKey,
                    hp: me.hp, maxHp: me.maxHp, ultCd: me.ultCd, awakened: me.awakened,
                    energy: me.energy || 0,
                    hasOmegaGear: Boolean(me.gears?.omegaCore), omegaUsed: Boolean(me.omegaUsed), omegaTurns: me.omegaTurns || 0,
                    hasTitanGear: Boolean(me.gears?.titanCrown), titanUsed: Boolean(me.titanUsed), titanTurns: me.titanTurns || 0,
                    locked: me.choice !== null, stunned: me.stunned, isBotOpp: opp.isBot,
                    skills: me.def.moves.map(m => m.label)
                },
                opp: {
                    name: opp.name, icon: opp.def.icon, powerName: opp.def.name + oppVerTag,
                    hp: opp.hp, maxHp: opp.maxHp, awakened: opp.awakened
                },
                _serverId: battle.srvId
            });
        };
        sendView(battle.p1, battle.p2);
        sendView(battle.p2, battle.p1);
    }

    function buildFighterObj(sockId, uname, powKey, customHp, customAtk, isBot = false, botId = null) {
        const def = SV_DEFS[powKey] || SV_DEFS.fire;
        if (isBot) {
            return {
                id: botId || 'BOT', name: uname, pKey: powKey, def, hp: customHp, maxHp: customHp, bonusAtk: customAtk,
                ultCd: 0, choice: Math.floor(Math.random() * 3), stunned: false, isBot: true,
                isV2: false, isV3: false, hasStone: false, awakened: false, energy: 0,
                gears: {}, omegaUsed: false, omegaTurns: 0, titanUsed: false, titanTurns: 0,
                pet: null, pet2: null, relic: null, enchant: null, lineageObj: SV_LINEAGES.human, lineageStage: 1,
                trainBonus: { ultMult: 1, critChance: 0 }, baseReward: 50
            };
        }
        const prof = getSvProfile(uname);
        const trB = getTrainingBonuses(prof);
        const isV2 = Boolean(prof.powerWins && prof.powerWins[powKey] >= 5);
        const isV3 = Boolean(prof.powerWins && prof.powerWins[powKey] >= 100);
        const maxHp = def.hp + ((prof.hpLv || 0) * 25) + trB.bonusHp + (isV3 ? 65 : 0);
        const bonusAtk = ((prof.atkLv || 0) * 5) + trB.bonusDmg + (isV3 ? 20 : 0);

        return {
            id: sockId, name: uname || 'Fighter', pKey: powKey, def, hp: maxHp, maxHp, bonusAtk,
            ultCd: 0, choice: null, stunned: false, isBot: false, isV2, isV3,
            hasStone: Boolean(prof.hasStone), awakened: false, energy: 50,
            gears: prof.gears || { omegaCore: false, titanCrown: false },
            omegaUsed: false, omegaTurns: 0, titanUsed: false, titanTurns: 0,
            pet: prof.activePet || null, pet2: prof.activePet2 || null,
            relic: prof.activeRelic || null, enchant: (prof.enchants && prof.enchants[powKey]) || null,
            lineageObj: SV_LINEAGES[prof.lineage || 'human'] || SV_LINEAGES.human, lineageStage: prof.lineageStage || 1,
            trainBonus: trB, baseReward: 150
        };
    }
        // ============================================================================
    // ⚔️ SAMMUVERSE V4 ENGINE — PIECE 5/20: COMBAT RESOLVER (OMEGA & TITAN FORMS)
    // ============================================================================
    function resolveSvTurn(battleId) {
        const b = svBattles.get(battleId);
        if (!b) return;

        // V3 Domain Clash when both V3 fighters unleash Ultimates simultaneously
        if (!b.p2.isBot && b.p1.isV3 && b.p2.isV3 && b.p1.choice === 3 && b.p2.choice === 3 && !b.clashResolved) {
            b.clashResolved = true;
            const clashData = { p1Taps: 0, p2Taps: 0, p1Id: b.p1.id, p2Id: b.p2.id };
            activeDomainClashes.set(battleId, clashData);
            io.to(b.p1.id).emit('svDomainClashStart', { oppName: b.p2.name, _serverId: b.srvId });
            io.to(b.p2.id).emit('svDomainClashStart', { oppName: b.p1.name, _serverId: b.srvId });

            setTimeout(() => {
                activeDomainClashes.delete(battleId);
                const cur = svBattles.get(battleId);
                if (!cur) return;
                const p1WonClash = clashData.p1Taps >= clashData.p2Taps;
                const winner = p1WonClash ? cur.p1 : cur.p2;
                const loser = p1WonClash ? cur.p2 : cur.p1;
                const clashDmg = 160 + winner.bonusAtk;
                loser.hp = Math.max(0, loser.hp - clashDmg);
                cur.p1.choice = 0; cur.p2.choice = 0; cur.clashResolved = false;

                io.to(cur.p1.id).emit('svDomainClashEnd', {});
                io.to(cur.p2.id).emit('svDomainClashEnd', {});
                io.to(cur.srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `⚡👑 **V3 DOMAIN CLASH!!** **${winner.name}** shattered **${loser.name}**'s domain (${Math.max(clashData.p1Taps, clashData.p2Taps)} Taps) for **-${clashDmg} COSMIC DMG**!`,
                    _serverId: cur.srvId
                });
                resolveSvTurn(battleId);
            }, 4000);
            return;
        }

        const pickAuto = (f) => {
            if (f.stunned) return null;
            if (f.choice !== null && f.choice >= 0) return f.choice;
            return f.ultCd === 0 && Math.random() < 0.35 ? 3 : Math.floor(Math.random() * 3);
        };

        const c1 = pickAuto(b.p1), c2 = pickAuto(b.p2);
        const m1 = c1 !== null ? b.p1.def.moves.at(c1) : null;
        const m2 = c2 !== null ? b.p2.def.moves.at(c2) : null;

        b.p1.stunned = false; b.p2.stunned = false;
        if (b.p1.ultCd > 0) b.p1.ultCd--;
        if (b.p2.ultCd > 0) b.p2.ultCd--;
        if (c1 === 3) b.p1.ultCd = 3;
        if (c2 === 3) b.p2.ultCd = 3;

        let turnSfx = 'atk', queuedCutscene = null;
        const logs = [];

        const applyClash = (atk, atkMove, isUlt, def, defMove) => {
            if (!atkMove) { logs.push(`❄️ <b>${atk.name}</b> was stunned and skipped!`); return; }
            if (atkMove.cut) queuedCutscene = { ...atkMove.cut, caption: `${atk.def.icon} ${atk.name.toUpperCase()} — ${atkMove.cut.title}` };
            if (atkMove.heal) {
                const healAmt = b.isCursed ? Math.round(atkMove.heal * 0.5) : atkMove.heal;
                atk.hp = Math.min(atk.maxHp, atk.hp + healAmt);
            }
            if (!atkMove.dmg) { turnSfx = 'shield'; logs.push(`${atk.def.icon} <b>${atk.name}</b> used <b>${atkMove.label.split(' (').at(0)}</b>!`); return; }

            let dmg = atkMove.dmg + atk.bonusAtk + Math.floor(Math.random() * 6);
            if (isUlt && atk.trainBonus?.ultMult) dmg = Math.round(dmg * atk.trainBonus.ultMult);
            if (atk.isV2) dmg = Math.round(dmg * 1.15);
            if (atk.isV3) dmg = Math.round(dmg * 1.20);
            if (atk.awakened) dmg = Math.round(dmg * 1.25);
            if (atk.omegaTurns > 0) dmg = Math.round(dmg * 1.40);
            if (atk.titanTurns > 0) dmg = Math.round(dmg * 1.55);
            if (atk.def.strong && atk.def.strong.includes(def.pKey)) dmg = Math.round(dmg * 1.22);

            const lin = atk.lineageObj;
            const stgMult = (atk.lineageStage || 1) >= 3 ? 1.0 : ((atk.lineageStage || 1) === 2 ? 0.65 : 0.4);
            if (lin && lin.dmgMult > 1) dmg = Math.round(dmg * (1 + (lin.dmgMult - 1) * stgMult));
            if (atk.enchant && atk.enchant.mult > 1) dmg = Math.round(dmg * atk.enchant.mult);

            const critRoll = (atk.relic === 'excalibur' ? 0.25 : 0) + (atk.trainBonus?.critChance || 0);
            let isCrit = false;
            if (critRoll > 0 && Math.random() < critRoll) { dmg = Math.round(dmg * 1.45); isCrit = true; }

            const bypassDodge = Boolean(atkMove.trueDmg || atk.titanTurns > 0);
            if (!bypassDodge && defMove && defMove.evade) {
                logs.push(`${atk.def.icon} <b>${atk.name}</b> used <b>${atkMove.label.split(' (').at(0)}</b>, but <b>${def.name}</b> EVADED! 💨`);
                return;
            }
            if (!bypassDodge && defMove && defMove.block) {
                const blocked = Math.round(dmg * defMove.block);
                dmg -= blocked;
                if (defMove.reflect) atk.hp = Math.max(0, atk.hp - Math.round(blocked * defMove.reflect));
            }

            if (def.omegaTurns > 0) dmg = Math.round(dmg * 0.70);
            if (def.titanTurns > 0) dmg = Math.round(dmg * 0.55);
            if (def.pet === 'sheshnag' || def.pet2 === 'sheshnag' || def.pet === 'ouroboros') dmg = Math.round(dmg * 0.82);
            if (def.relic === 'aegis') dmg = Math.round(dmg * 0.85);
            if (def.enchant && def.enchant.red > 0) dmg = Math.round(dmg * (1 - def.enchant.red));
            if (def.def.passiveRed) dmg = Math.round(dmg * (1 - def.def.passiveRed));

            def.hp = Math.max(0, def.hp - dmg);
            atk.energy = Math.min(100, (atk.energy || 0) + 25);

            const stealPct = (atk.relic === 'vampfang' ? 0.20 : 0) + (atk.enchant?.heal || 0) + (lin ? lin.steal * stgMult : 0);
            if (stealPct > 0 && atk.hp > 0) atk.hp = Math.min(atk.maxHp, atk.hp + Math.max(2, Math.round(dmg * stealPct)));
            if (def.lineageObj && def.lineageObj.absorb > 0 && def.hp > 0) {
                const dMult = (def.lineageStage || 1) >= 3 ? 1.0 : 0.5;
                def.hp = Math.min(def.maxHp, def.hp + Math.max(2, Math.round(dmg * def.lineageObj.absorb * dMult)));
            }

            if ((atkMove.stun || (atkMove.stunChance && Math.random() < atkMove.stunChance)) && def.hp > 0) {
                if (!(def.lineageObj && def.lineageObj.stunImmune) && !(def.titanTurns > 0)) def.stunned = true;
            }
            if (atkMove.trueDmg || atk.titanTurns > 0) turnSfx = 'ult';
            const formTag = atk.titanTurns > 0 ? ' 🌌[TITAN]' : (atk.omegaTurns > 0 ? ' ⚡[OMEGA]' : '');
            logs.push(`${atk.def.icon} <b>${atk.name}</b>${formTag} hit <b>${atkMove.label.split(' (').at(0)}</b>${isCrit ? ' 💥CRIT' : ''} for <b>-${dmg} HP</b>!`);
        };

        applyClash(b.p1, m1, c1 === 3, b.p2, m2);
        applyClash(b.p2, m2, c2 === 3, b.p1, m1);

        [[b.p1, b.p2], [b.p2, b.p1]].forEach(([me, opp]) => {
            if (me.hp <= 0) return;
            if (me.omegaTurns > 0) me.omegaTurns--;
            if (me.titanTurns > 0) me.titanTurns--;

            [me.pet, me.pet2].filter(Boolean).forEach((pt, idx) => {
                if (idx === 1 && pt === me.pet) return;
                if (pt === 'mochi' && opp.hp > 0) { opp.hp = Math.max(0, opp.hp - 10); logs.push(`🐱 Mochi scratched ${opp.name} (-10)!`); }
                if (pt === 'tommy') { me.hp = Math.min(me.maxHp, me.hp + 10); }
                if (pt === 'garuda' && opp.hp > 0) { opp.hp = Math.max(0, opp.hp - 22); logs.push(`🦅 Garuda struck ${opp.name} (-22)!`); }
                if (pt === 'sheshnag' && opp.hp > 0) { opp.hp = Math.max(0, opp.hp - 18); logs.push(`🐍 Sheshnag poisoned ${opp.name} (-18)!`); }
                if (pt === 'chimera' && opp.hp > 0) {
                    opp.hp = Math.max(0, opp.hp - 24);
                    me.hp = Math.min(me.maxHp, me.hp + 20);
                    logs.push(`🦁 Chimera Guardian slashed ${opp.name} (-24) & healed ${me.name} (+20 HP)!`);
                }
                if (pt === 'ouroboros' && opp.hp > 0) {
                    opp.hp = Math.max(0, opp.hp - 42);
                    me.hp = Math.min(me.maxHp, me.hp + 25);
                    logs.push(`🐉 Cosmic Ouroboros blasted ${opp.name} (-42) & healed ${me.name} (+25 HP)!`);
                }
            });

            if (me.lineageObj && me.lineageObj.hpTurn > 0) {
                const rMult = (me.lineageStage || 1) >= 3 ? 1.0 : 0.5;
                me.hp = Math.min(me.maxHp, me.hp + Math.max(3, Math.round(me.lineageObj.hpTurn * rMult)));
            }
            if (me.hasStone && !me.awakened && me.hp > 0 && me.hp <= Math.round(me.maxHp * 0.40)) {
                me.awakened = true;
                me.hp = Math.min(me.maxHp, me.hp + 40);
                turnSfx = 'awaken';
                queuedCutscene = { theme: 'awaken', emoji: '💎⚡', title: `${me.name} AWAKENED!!`, caption: `💎⚡ ${me.name.toUpperCase()} SHATTERED THEIR LIMITS! (+25% ATK & +40 HP)`, sfx: 'awaken' };
                logs.push(`⚡💎 <b>${me.name} AWAKENED THEIR STONE! (+25% ATK & +40 HP)</b>`);
            }
        });

        if (queuedCutscene) broadcastSvCutscene(b, queuedCutscene);
        b.lastLog = logs.join('<br>');

        if (b.p1.hp <= 0 || b.p2.hp <= 0) {
            return finishSvBattle(battleId, b);
        }

        b.turn++; b.timeLeft = 15;
        b.p1.choice = b.p1.stunned ? -1 : null;
        b.p2.choice = b.p2.isBot ? (b.p2.ultCd === 0 ? 3 : Math.floor(Math.random() * 3)) : (b.p2.stunned ? -1 : null);
        syncSvBattle(b, turnSfx);
    }
     // ============================================================================
    // ⚔️ SAMMUVERSE V4 ENGINE — PIECE 6/20: FINISHER, TOWER GEARS & ADVENTURE
    // ============================================================================
    function finishSvBattle(battleId, b) {
        clearInterval(b.interval);
        svBattles.delete(battleId);
        const p1Won = b.p1.hp > b.p2.hp;
        const winner = p1Won ? b.p1 : b.p2;
        const loser = p1Won ? b.p2 : b.p1;

        if (!b.p1.isBot) io.to(b.p1.id).emit('svBattleEnd', { won: p1Won, _serverId: b.srvId });
        if (!b.p2.isBot) io.to(b.p2.id).emit('svBattleEnd', { won: !p1Won, _serverId: b.srvId });

        // 1. ENDLESS TOWER PROGRESSION & FLOOR 50 GEAR UNLOCKS
        if (b.isTower) {
            const pSock = io.sockets.sockets.get(b.p1.id);
            if (!p1Won || !pSock) {
                activeTowerRuns.delete(b.p1.id);
                io.to(b.srvId).emit('message', { username: "Sammu's Bot", text: `💀🗼 **TOWER RUN ENDED!** **${b.p1.name}** fell on **Floor ${b.towerFloor}**!`, _serverId: b.srvId });
                return;
            }
            const prof = getSvProfile(b.p1.name);
            const nextFl = b.towerFloor + 1;
            if (nextFl > (prof.maxTowerFloor || 1)) {
                prof.maxTowerFloor = nextFl;
                prof.towerCheckpoint = Math.max(1, Math.floor(nextFl / 5) * 5);
            }
            addCoins(b.p1.name, b.p1.baseReward);
            prof.petEssence = (prof.petEssence || 0) + 5;

            if (b.towerFloor === 25) addCoins(b.p1.name, 10000);
            if (b.towerFloor === 50) {
                prof.freeFusionPasses = (prof.freeFusionPasses || 0) + 1;
                prof.gears.omegaCore = true;
                io.to(b.srvId).emit('message', { username: "Sammu's Bot", text: `⚡👑 **FLOOR 50 CONQUERED!** **${b.p1.name}** unlocked the **⚡ OMEGA CORE GEAR** + **Free Fusion Pass**!`, _serverId: b.srvId });
            }
            if (b.towerFloor === 75) {
                prof.gears.titanCrown = true;
                io.to(b.srvId).emit('message', { username: "Sammu's Bot", text: `🌌👑 **FLOOR 75 CONQUERED!** **${b.p1.name}** unlocked the **🌌 TITAN CROWN GEAR**!`, _serverId: b.srvId });
            }
            if (b.towerFloor === 100) addCoins(b.p1.name, 50000);

            syncPlayerTitlesAndBounty(b.p1.name);
            saveSvStats();
            pSock.emit('svStatsSync', getSvProfile(b.p1.name));
            io.to(b.p1.id).emit('message', { username: "Sammu's Bot", text: `🗼🔥 **FLOOR ${b.towerFloor} CLEARED!** (+${b.p1.baseReward.toLocaleString()}🪙 & +5🔮 Essence) Ascending to **Floor ${nextFl}** in 3s...`, _serverId: b.srvId });
            setTimeout(() => { if (io.sockets.sockets.has(b.p1.id)) launchEndlessTowerFloor(pSock, nextFl, b.p1.hp); }, 3000);
            return;
        }

        // 2. ADVENTURE STORY MODE PROGRESSION
        if (b.isAdventure) {
            const pSock = io.sockets.sockets.get(b.p1.id);
            if (!p1Won || !pSock) {
                io.to(b.srvId).emit('message', { username: "Sammu's Bot", text: `💀🗺️ **ADVENTURE DEFEAT!** **${b.p1.name}** was defeated in **${b.advTitle}**! Train harder & retry!`, _serverId: b.srvId });
                return;
            }
            const prof = getSvProfile(b.p1.name);
            const adv = prof.adventure || { chapter: 1, stage: 1, cleared: false };
            const chObj = ADVENTURE_CHAPTERS.find(c => c.ch === b.advChapter) || ADVENTURE_CHAPTERS.at(0);
            const isBossStage = b.advStage >= 3;
            const cGain = isBossStage ? chObj.coins : Math.round(chObj.coins * 0.4);
            const xpGain = isBossStage ? chObj.xp : Math.round(chObj.xp * 0.4);
            const essGain = isBossStage ? chObj.essence : Math.round(chObj.essence * 0.4);

            addCoins(b.p1.name, cGain);
            prof.training.xp = (prof.training.xp || 0) + xpGain;
            prof.petEssence = (prof.petEssence || 0) + essGain;

            if (adv.chapter === b.advChapter && adv.stage === b.advStage) {
                if (adv.stage < 3) {
                    adv.stage++;
                } else if (adv.chapter < 5) {
                    adv.chapter++;
                    adv.stage = 1;
                } else {
                    adv.cleared = true;
                }
            }
            syncPlayerTitlesAndBounty(b.p1.name);
            saveSvStats();
            pSock.emit('svStatsSync', getSvProfile(b.p1.name));
            io.to(b.srvId).emit('message', {
                username: "Sammu's Bot",
                text: `🗺️🏆 **STAGE CLEARED!** **${b.p1.name}** conquered **${b.p2.name}** in **${chObj.title}** and looted **+${cGain.toLocaleString()}🪙**, **+${xpGain}⚡ XP**, & **+${essGain}🔮 Pet Essence**!`,
                _serverId: b.srvId
            });
            return;
        }

        // 3. STANDARD ARENA / PVP REWARDS
        let reward = loser.baseReward || 150;
        if (!winner.isBot) {
            const wProf = getSvProfile(winner.name);
            wProf.wins = (wProf.wins || 0) + 1;
            wProf.streak = (wProf.streak || 0) + 1;
            wProf.petEssence = (wProf.petEssence || 0) + (loser.isBot ? 4 : 12);
            if (!wProf.powerWins) wProf.powerWins = {};
            wProf.powerWins[winner.pKey] = (wProf.powerWins[winner.pKey] || 0) + 1;
            if (wProf.powerWins[winner.pKey] === 5) {
                io.to(b.srvId).emit('message', { username: "Sammu's Bot", text: `🔥⚡ **V2 EVOLUTION!** **${winner.name}** mastered **${winner.def.name}** (5 Wins) -> **[V2 +15% DMG]**!`, _serverId: b.srvId });
            }
            if (wProf.powerWins[winner.pKey] === 100) {
                io.to(b.srvId).emit('message', { username: "Sammu's Bot", text: `👑🔥 **V3 ASCENSION!** **${winner.name}** hit **100 WINS** on **${winner.def.name}** -> **[V3 👑]**!`, _serverId: b.srvId });
            }
            wProf.bounty = Math.min(30000000, (wProf.bounty || 10000) + (loser.isBot ? 25000 : 120000));
            reward = Math.round(reward * (wProf.streak >= 5 ? 2 : (wProf.streak >= 3 ? 1.5 : 1)));
            addCoins(winner.name, reward);
            syncPlayerTitlesAndBounty(winner.name);
            saveSvStats();
        }
        if (!loser.isBot) { getSvProfile(loser.name).streak = 0; saveSvStats(); }

        recordSvLog(b.srvId, winner.name, `${winner.def.icon} ${winner.def.name}`, loser.name, `${loser.def.icon} ${loser.def.name}`);
        io.to(b.srvId).emit('message', { username: "Sammu's Bot", text: `⚔️🔥 **SAMMUVERSE:** **${winner.name}** (${winner.def.icon} ${winner.def.name}) defeated **${loser.name}** and won **+${reward}🪙**! 🏆`, _serverId: b.srvId });
    }
       // ============================================================================
    // ⚔️ SAMMUVERSE V4 ENGINE — PIECE 7/20: PVP, TOWER & ADVENTURE LAUNCHERS
    // ============================================================================
    function startSvMatch(srvId, sock1, pow1Key, sock2, pow2Key) {
        const p1 = buildFighterObj(sock1.id, sock1.username, pow1Key);
        let p2 = null;
        if (typeof sock2 === 'string') {
            const bots = {
                BOT_DUMMY:  { name: '🥊 Wooden Dummy',   hp: 150, atk: 0,  reward: 35,  pKey: 'rubber' },
                BOT_SENSEI: { name: '🤖 Bot Sensei',     hp: 230, atk: 8,  reward: 65,  pKey: 'lightning' },
                BOT_DEMON:  { name: '👹 Demon Overlord', hp: 380, atk: 16, reward: 140, pKey: 'blood' }
            };
            const cfg = bots[sock2] || bots.BOT_SENSEI;
            p2 = buildFighterObj(sock2, cfg.name, cfg.pKey, cfg.hp, cfg.atk, true, sock2);
            p2.baseReward = cfg.reward;
        } else {
            p2 = buildFighterObj(sock2.id, sock2.username, pow2Key);
        }

        const battleId = 'sv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const battle = { id: battleId, srvId, turn: 1, timeLeft: 15, lastLog: `⚔️ Battle started! Pick your skill!`, p1, p2, interval: null };
        svBattles.set(battleId, battle);
        battle.interval = setInterval(() => {
            const cur = svBattles.get(battleId);
            if (!cur) return;
            cur.timeLeft--;
            if (cur.timeLeft <= 0) resolveSvTurn(battleId);
            else syncSvBattle(cur, null);
        }, 1000);
        syncSvBattle(battle, 'atk');
    }

    function launchEndlessTowerFloor(socket, floorNum, carryHp) {
        const srvId = socket.activeServerId;
        const uname = socket.username || 'Climber';
        const prof = getSvProfile(uname);
        const cfg = getTowerFloorConfig(floorNum);
        const pKey = (prof.customPowers?.at(-1)?.id) || (prof.unlockedPowers?.at(-1)) || 'fire';

        const p1 = buildFighterObj(socket.id, uname, pKey);
        p1.hp = carryHp ? Math.min(p1.maxHp, carryHp + (cfg.isCursed ? 25 : 55)) : p1.maxHp;
        p1.baseReward = cfg.coinReward;

        const p2 = buildFighterObj('TOWER_BOSS', cfg.name, cfg.pKey, cfg.hp, cfg.atk, true, 'TOWER_BOSS');
        p2.def = { ...p2.def, passiveRed: cfg.red };
        p2.isV2 = floorNum >= 15; p2.isV3 = floorNum >= 40;

        const battleId = 'twr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const battle = {
            id: battleId, srvId, isTower: true, towerFloor: floorNum, isCursed: cfg.isCursed,
            turn: 1, timeLeft: 15, lastLog: `🗼 <b>FLOOR ${floorNum}</b> — ${cfg.modTag} (${cfg.hp.toLocaleString()} HP)`,
            p1, p2, interval: null
        };
        activeTowerRuns.set(socket.id, { floorNum, battleId });
        svBattles.set(battleId, battle);
        battle.interval = setInterval(() => {
            const cur = svBattles.get(battleId);
            if (!cur) return;
            cur.timeLeft--;
            if (cur.timeLeft <= 0) resolveSvTurn(battleId);
            else syncSvBattle(cur, null);
        }, 1000);
        syncSvBattle(battle, 'ult');
    }

    function launchAdventureStage(socket, chNum, stgNum, powKey) {
        const srvId = socket.activeServerId;
        const uname = socket.username || 'Hero';
        const chObj = ADVENTURE_CHAPTERS.find(c => c.ch === chNum) || ADVENTURE_CHAPTERS.at(0);
        const stageIdx = Math.max(0, Math.min(2, (stgNum || 1) - 1));
        const enemyName = chObj.stages.at(stageIdx);
        const mult = stageIdx === 2 ? 1.45 : (stageIdx === 1 ? 1.18 : 1.0);
        const hp = Math.round(chObj.baseHp * mult);
        const atk = Math.round(chObj.baseAtk * mult);

        const p1 = buildFighterObj(socket.id, uname, powKey || 'fire');
        const p2 = buildFighterObj('ADV_FOE', enemyName, chObj.pKey, hp, atk, true, 'ADV_FOE');
        p2.isV2 = chNum >= 3; p2.isV3 = chNum >= 5 && stageIdx === 2;

        const battleId = 'adv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const battle = {
            id: battleId, srvId, isAdventure: true, advChapter: chNum, advStage: stgNum, advTitle: chObj.title,
            turn: 1, timeLeft: 15, lastLog: `🗺️ <b>${chObj.title} (Stage ${stgNum}/3)</b> — <b>${enemyName}</b> blocks your path!`,
            p1, p2, interval: null
        };
        svBattles.set(battleId, battle);
        battle.interval = setInterval(() => {
            const cur = svBattles.get(battleId);
            if (!cur) return;
            cur.timeLeft--;
            if (cur.timeLeft <= 0) resolveSvTurn(battleId);
            else syncSvBattle(cur, null);
        }, 1000);
        syncSvBattle(battle, 'atk');
    }

    function findPlayerActiveSvBattle(socketId) {
        for (const [bId, b] of svBattles.entries()) {
            if (b.p1.id === socketId || b.p2.id === socketId) return { bId, b };
        }
        return null;
    }
       // ============================================================================
    // 🛡️ SAMMUVERSE V4 ENGINE — PIECE 8/20: STOCK, SECURITY & CHAT BADGES
    // ============================================================================
    let hourlyStock = { expiresAt: 0, items: [] };

    function getHourlyStock() {
        if (Date.now() > hourlyStock.expiresAt || hourlyStock.items.length === 0) {
            const pool = Object.entries(SV_DEFS)
                .filter(([, d]) => d.cost || d.fused)
                .map(([k, d]) => ({ key: k, icon: d.icon, name: d.name, price: d.cost || 2500 }));
            hourlyStock = { expiresAt: Date.now() + (60 * 60 * 1000), items: pool.sort(() => Math.random() - 0.5).slice(0, 3) };
        }
        return hourlyStock;
    }

    function verifyPlayerAccountOwnership(uname, socket, forceRelink = false) {
        if (!uname || !socket) return false;
        const devId = socket.trackedDeviceId || null;
        const prof = getSvProfile(uname);
        if (!devId) return true;
        if (!prof.ownerDevId || forceRelink) {
            prof.ownerDevId = devId;
            saveSvStats();
            return true;
        }
        return prof.ownerDevId === devId;
    }

    function ensureTrainingProfile(prof) {
        if (!prof.training) prof.training = { fistLv: 0, bodyLv: 0, chiLv: 0, xp: 0 };
        const totalLv = (prof.training.fistLv || 0) + (prof.training.bodyLv || 0) + (prof.training.chiLv || 0);
        if (totalLv >= 50 && !prof.unlockedTitles.includes('gymgod')) prof.unlockedTitles.push('gymgod');
        return prof.training;
    }

    const _prevIoToV4 = io.to.bind(io);
    io.to = function(room) {
        const broadcaster = _prevIoToV4(room);
        const origEmit = broadcaster.emit.bind(broadcaster);
        broadcaster.emit = function(ev, payload, ...rest) {
            if (ev === 'message' && payload && typeof payload === 'object' && payload.username) {
                const rawName = String(payload.username).replace(/^\[.*?\]\s*/, '');
                const k = rawName.toLowerCase().trim();
                if (svPlayerStats[k]) {
                    ensureTrainingProfile(svPlayerStats[k]);
                    syncPlayerTitlesAndBounty(rawName);
                    const tObj = SV_TITLES.find(t => t.id === svPlayerStats[k].activeTitle) || SV_TITLES.at(0);
                    if (tObj && !String(payload.username).startsWith('[')) {
                        payload = { ...payload, username: `[${tObj.tag}] ${rawName}`, _titleColor: tObj.color };
                    }
                }
            }
            return origEmit(ev, payload, ...rest);
        };
        return broadcaster;
    };
     // ============================================================================
    // 🎡 SAMMUVERSE V4 ENGINE — PIECE 9/20: DAILY WHEEL, PET MERGER & GEAR FORGE
    // ============================================================================
    io.on('connection', (socket) => {
        // 1. Daily Lucky Wheel Spin (Free every 24h OR Paid Spin for 500 Coins)
        socket.on('svDailyWheelSpin', ({ paid }) => {
            const uname = socket.username || 'Player';
            if (!verifyPlayerAccountOwnership(uname, socket, false)) return;
            const prof = getSvProfile(uname);
            const now = Date.now();
            const dayMs = 24 * 60 * 60 * 1000;

            if (!paid) {
                if (now - (prof.lastDailySpin || 0) < dayMs) {
                    const hrs = Math.ceil((dayMs - (now - prof.lastDailySpin)) / 3600000);
                    return socket.emit('svNotice', `⏳ Free Spin recharges in ${hrs}h! Or spin anytime for 500🪙!`);
                }
                prof.lastDailySpin = now;
            } else {
                if (getCoins(uname) < 500) return socket.emit('svNotice', '🪙 Need 500 Coins for a Cosmic Wheel Spin!');
                addCoins(uname, -500);
            }

            const r = Math.random();
            let prize = { idx: 0, label: '🪙 +600 Coins!', type: 'coins', val: 600 };
            if (r < 0.02) {
                prize = { idx: 5, label: '🌈 JACKPOT! +15,000 Coins & Free Fusion Pass!', type: 'jackpot' };
                addCoins(uname, 15000);
                prof.freeFusionPasses = (prof.freeFusionPasses || 0) + 1;
            } else if (r < 0.16) {
                prize = { idx: 4, label: '🔮 +40 Pet Essence!', type: 'essence', val: 40 };
                prof.petEssence = (prof.petEssence || 0) + 40;
            } else if (r < 0.36) {
                prize = { idx: 3, label: '⚡ +600 Training XP!', type: 'xp', val: 600 };
                prof.training.xp = (prof.training.xp || 0) + 600;
            } else if (r < 0.62) {
                prize = { idx: 2, label: '💰 +2,000 Coins!', type: 'coins', val: 2000 };
                addCoins(uname, 2000);
            } else if (r < 0.82) {
                prize = { idx: 1, label: '🔮 +20 Pet Essence & +400🪙!', type: 'combo' };
                prof.petEssence = (prof.petEssence || 0) + 20;
                addCoins(uname, 400);
            } else {
                addCoins(uname, 600);
            }

            syncPlayerTitlesAndBounty(uname);
            saveSvStats();
            socket.emit('svWheelResult', { prize, profile: getSvProfile(uname) });
        });

        // 2. Pet Merger & Evolution Lab (Fuse Pets + Essence + Coins -> Evolved Mega Pets)
        socket.on('svMergePet', (evoId) => {
            const uname = socket.username || 'Player';
            if (!verifyPlayerAccountOwnership(uname, socket, false)) return;
            const prof = getSvProfile(uname);

            if (evoId === 'chimera') {
                if (prof.ownedPets.includes('chimera')) return socket.emit('svNotice', '✅ You already evolved 🦁 Chimera Guardian!');
                if (!prof.ownedPets.includes('mochi') || !prof.ownedPets.includes('tommy')) {
                    return socket.emit('svNotice', '⚠️ Own BOTH 🐱 Mochi & 🐶 Tommy first to merge them!');
                }
                if ((prof.petEssence || 0) < 30 || getCoins(uname) < 1000) {
                    return socket.emit('svNotice', '🔮 Need 30 Pet Essence + 1,000🪙 to merge Chimera Guardian!');
                }
                prof.petEssence -= 30;
                addCoins(uname, -1000);
                prof.ownedPets.push('chimera');
                prof.activePet = 'chimera';
                syncPlayerTitlesAndBounty(uname);
                saveSvStats();
                socket.emit('svStatsSync', getSvProfile(uname));
                socket.emit('svNotice', '🦁⚡ PET EVOLUTION COMPLETE! Mochi + Tommy merged into 🦁 CHIMERA GUARDIAN (+24 DMG & +20 HP/turn)!');
            } else if (evoId === 'ouroboros') {
                if (prof.ownedPets.includes('ouroboros')) return socket.emit('svNotice', '✅ You already evolved 🐉 Cosmic Ouroboros!');
                if (!prof.ownedPets.includes('garuda') || !prof.ownedPets.includes('sheshnag')) {
                    return socket.emit('svNotice', '⚠️ Own BOTH 🦅 Garuda & 🐍 Sheshnag first to merge them!');
                }
                if ((prof.petEssence || 0) < 80 || getCoins(uname) < 4000) {
                    return socket.emit('svNotice', '🔮 Need 80 Pet Essence + 4,000🪙 to merge Cosmic Ouroboros!');
                }
                prof.petEssence -= 80;
                addCoins(uname, -4000);
                prof.ownedPets.push('ouroboros');
                prof.activePet = 'ouroboros';
                syncPlayerTitlesAndBounty(uname);
                saveSvStats();
                socket.emit('svStatsSync', getSvProfile(uname));
                socket.emit('svNotice', '🐉🌌 MYTHIC PET EVOLUTION! Garuda + Sheshnag merged into 🐉 COSMIC OUROBOROS (-18% DMG Taken, +42 DMG & +25 HP/turn)!');
            }
        });

        // 3. Gear Forge (Requires Tower Floor 50 Milestone + Coins!)
        socket.on('svCraftGear', (gearKey) => {
            const uname = socket.username || 'Player';
            if (!verifyPlayerAccountOwnership(uname, socket, false)) return;
            const prof = getSvProfile(uname);
            const bestFloor = prof.maxTowerFloor || 1;

            if (gearKey === 'omegaCore') {
                if (prof.gears.omegaCore) return socket.emit('svNotice', '✅ Omega Core Gear already forged!');
                if (bestFloor < 50) return socket.emit('svNotice', `🔒 Reach Endless Tower Floor 50 first! (Your Best: Floor ${bestFloor})`);
                if (getCoins(uname) < 10000) return socket.emit('svNotice', '🪙 Need 10,000 Coins to forge ⚡ Omega Core Gear!');
                addCoins(uname, -10000);
                prof.gears.omegaCore = true;
                syncPlayerTitlesAndBounty(uname);
                saveSvStats();
                socket.emit('svStatsSync', getSvProfile(uname));
                socket.emit('svNotice', '⚡👑 FORGED OMEGA CORE GEAR! You can now trigger ⚡ OMEGA EVOLUTION mid-battle!');
            } else if (gearKey === 'titanCrown') {
                if (prof.gears.titanCrown) return socket.emit('svNotice', '✅ Titan Crown Gear already forged!');
                if (bestFloor < 50) return socket.emit('svNotice', `🔒 Reach Endless Tower Floor 50 first! (Your Best: Floor ${bestFloor})`);
                if (getCoins(uname) < 25000) return socket.emit('svNotice', '🪙 Need 25,000 Coins to forge 🌌 Titan Crown Gear!');
                addCoins(uname, -25000);
                prof.gears.titanCrown = true;
                syncPlayerTitlesAndBounty(uname);
                saveSvStats();
                socket.emit('svStatsSync', getSvProfile(uname));
                socket.emit('svNotice', '🌌👑 FORGED TITAN CROWN GEAR! You can now unleash 🌌 COLOSSAL TITAN FORM mid-battle!');
            }
        });
    });
    // ============================================================================
    // ⚡ SAMMUVERSE V4 ENGINE — PIECE 10/20: OMEGA/TITAN TRANSFORM & SECRET CODES
    // ============================================================================
    io.on('connection', (socket) => {
        // Mid-Battle Transformation Handler (Omega Evolution OR Colossal Titan Form)
        socket.on('svTransform', (formType) => {
            const found = findPlayerActiveSvBattle(socket.id);
            if (!found) return;
            const { b } = found;
            const me = b.p1.id === socket.id ? b.p1 : b.p2;

            if (formType === 'omega') {
                if (!me.gears?.omegaCore) return socket.emit('svNotice', '🔒 Forge the ⚡ Omega Core Gear first (Tower Floor 50 + 10,000🪙)!');
                if (me.omegaUsed) return socket.emit('svNotice', '⚠️ Already used Omega Evolution in this battle!');
                if ((me.energy || 0) < 50) return socket.emit('svNotice', `⚡ Need 50% Battle Energy (Current: ${me.energy || 0}%)!`);

                me.omegaUsed = true;
                me.energy -= 50;
                me.omegaTurns = 3;
                me.hp = Math.min(me.maxHp, me.hp + 70);
                broadcastSvCutscene(b, {
                    theme: 'awaken',
                    emoji: '⚡🧬',
                    title: 'OMEGA EVOLUTION!',
                    caption: `⚡🧬 ${me.name.toUpperCase()} ASCENDED TO OMEGA FORM! (+40% ATK, +30% ARMOR & +70 HP for 3 Turns!)`,
                    sfx: 'awaken'
                });
                b.lastLog = `⚡🧬 <b>${me.name}</b> triggered <b>OMEGA EVOLUTION</b>! (+40% ATK, +30% Armor, +70 HP)<br>` + b.lastLog;
                syncSvBattle(b, 'awaken');
            } else if (formType === 'titan') {
                if (!me.gears?.titanCrown) return socket.emit('svNotice', '🔒 Forge the 🌌 Titan Crown Gear first (Tower Floor 50 + 25,000🪙)!');
                if (me.titanUsed) return socket.emit('svNotice', '⚠️ Already used Colossal Titan Form in this battle!');
                if ((me.energy || 0) < 75) return socket.emit('svNotice', `⚡ Need 75% Battle Energy (Current: ${me.energy || 0}%)!`);

                me.titanUsed = true;
                me.energy -= 75;
                me.titanTurns = 2;
                me.maxHp += 150;
                me.hp += 150;
                broadcastSvCutscene(b, {
                    theme: 'vishwaroopa',
                    emoji: '🌌👑',
                    title: 'COLOSSAL TITAN FORM!',
                    caption: `🌌👑 ${me.name.toUpperCase()} GREW INTO A COLOSSAL TITAN! (+150 HP, +55% DMG, UNSTOPPABLE!)`,
                    sfx: 'ult'
                });
                b.lastLog = `🌌👑 <b>${me.name}</b> unleashed <b>COLOSSAL TITAN FORM</b>! (+150 HP, +55% DMG, Evade-Break)<br>` + b.lastLog;
                syncSvBattle(b, 'ult');
            }
        });

        // Secret & Gift Codes (Brand-New Supreme Code #sammuomega999 + Fresh Gift Codes!)
        socket.on('svUnlockCode', (rawCode) => {
            const uname = socket.username || 'Player';
            const prof = getSvProfile(uname);
            const tr = ensureTrainingProfile(prof);
            const code = String(rawCode || '').trim().toLowerCase();

            // 👑 YOUR NEW SUPREME DEV CODE: #sammuomega999
            if (code === '#sammuomega999') {
                prof.unlockedPowers = Object.keys(SV_DEFS);
                prof.ownedPets = new Array('mochi', 'tommy', 'garuda', 'sheshnag', 'chimera', 'ouroboros');
                prof.activePet = 'ouroboros';
                prof.activePet2 = 'chimera';
                prof.ownedRelics = new Array('excalibur', 'aegis', 'vampfang');
                prof.activeRelic = 'excalibur';
                prof.gears = { omegaCore: true, titanCrown: true };
                prof.adventure = { chapter: 5, stage: 3, cleared: true };
                prof.petEssence = (prof.petEssence || 0) + 500;
                prof.hasStone = true;
                prof.atkLv = 15;
                prof.hpLv = 15;
                prof.powerMakerUnlocked = true;
                tr.fistLv = Math.max(333334, tr.fistLv || 0);
                tr.bodyLv = Math.max(333333, tr.bodyLv || 0);
                tr.chiLv  = Math.max(333333, tr.chiLv || 0);
                tr.xp     = Math.max(1000000, tr.xp || 0);

                if (!prof.powerWins) prof.powerWins = {};
                Object.keys(SV_DEFS).forEach(k => { prof.powerWins[k] = Math.max(100, prof.powerWins[k] || 0); });
                prof.unlockedTitles = SV_TITLES.map(t => t.id);
                prof.activeTitle = 'sovereign';
                prof.bounty = 30000000;
                prof.lineage = 'celestial';
                prof.lineageStage = 3;
                prof.maxTowerFloor = Math.max(100, prof.maxTowerFloor || 1);
                prof.towerCheckpoint = 100;
                addCoins(uname, 999999);
                saveSvStats();
                socket.emit('svStatsSync', getSvProfile(uname));
                socket.emit('svNotice', '👑🔱 SUPREME OMEGA UNLOCKED! All V3 Powers, Omega & Titan Gears, Evolved Pets, 1M Mastery & +999,999🪙!');
                return;
            }

            if (code === '#train1m') {
                tr.fistLv = 333334; tr.bodyLv = 333333; tr.chiLv = 333333; tr.xp = 1000000;
                ensureTrainingProfile(prof); syncPlayerTitlesAndBounty(uname); saveSvStats();
                socket.emit('svStatsSync', getSvProfile(uname));
                socket.emit('svNotice', '👽🔥 1,000,000 (1M) TRAINING MASTERY UNLOCKED!');
                return;
            }

            const secretMap = {
                '#mahavishnu': { key: 'mahavishnu', label: '🔱 Sammu/Samaksh (MahaVishnu)' },
                '#millyyt':    { key: 'millyyt',    label: '🎬 Milly (YouTube Queen)' },
                '#ishikastar': { key: 'ishikastar', label: '✨ Ishika (Celestial Empress)' },
                '#zoroking':   { key: 'zoroking',   label: '⚔️ Zoro (King of Hell)' },
                '#antimpoke':  { key: 'antimpoke',  label: '⚡ Antim (Astral Sky Sovereign)' },
                '#mahadev':    { key: 'mahadev',    label: '🔱 Mahadev (Tandava Destroyer)' }
            };
            if (secretMap[code]) {
                const s = secretMap[code];
                if (!prof.unlockedPowers.includes(s.key)) prof.unlockedPowers.push(s.key);
                syncPlayerTitlesAndBounty(uname); saveSvStats();
                socket.emit('svStatsSync', getSvProfile(uname));
                socket.emit('svNotice', `🌟 MYTHIC POWER UNLOCKED: ${s.label}!`);
                return;
            }

            // Fresh Public Gift Codes for Players!
            const giftCodes = {
                '#titan2026':    { coins: 3000, xp: 300, ess: 25, msg: '🌌 **TITAN 2026 PACK!** +3,000🪙, +300⚡ XP & +25🔮 Pet Essence!' },
                '#luckywheel':   { coins: 1500, xp: 150, ess: 15, msg: '🎡 **LUCKY WHEEL BONUS!** +1,500🪙 & +15🔮 Pet Essence!' },
                '#petfusion':    { coins: 2000, xp: 200, ess: 40, msg: '🐾 **PET MERGER GIFT!** +2,000🪙 & +40🔮 Pet Essence!' },
                '#adventure5k':  { coins: 5000, xp: 500, ess: 30, msg: '🗺️ **ADVENTURE HERO GIFT!** +5,000🪙 & +500⚡ XP!' },
                '#didi4000':     { coins: 4000, xp: 0,   ess: 0,  msg: '🌙💖 **DIDI ROYAL GIFT!** +4,000🪙 added!' },
                '#moondidi':     { coins: 4500, xp: 0,   ess: 0,  msg: '🌙🩺 **DR. MOON GIFT!** +4,500🪙 added!' }
            };
            if (giftCodes[code]) {
                if (prof.redeemedCodes.includes(code)) return socket.emit('svNotice', '⚠️ Already redeemed this code!');
                prof.redeemedCodes.push(code);
                const g = giftCodes[code];
                addCoins(uname, g.coins);
                prof.training.xp = (prof.training.xp || 0) + g.xp;
                prof.petEssence = (prof.petEssence || 0) + g.ess;
                syncPlayerTitlesAndBounty(uname); saveSvStats();
                socket.emit('svStatsSync', getSvProfile(uname));
                return socket.emit('svNotice', g.msg);
            }
            socket.emit('svNotice', '❌ Invalid Secret or Gift Code!');
        });
    });
    // ============================================================================
    // 🏋️ SAMMUVERSE V4 ENGINE — PIECE 11A/20: STATS, TRAINING & DOJO UPGRADES
    // ============================================================================
    io.on('connection', (socket) => {
        socket.on('joinRoom', (data) => {
            const uname = (data && data.username) ? data.username.trim() : (socket.username || '');
            if (!uname) return;
            socket.username = uname;
            if (!verifyPlayerAccountOwnership(uname, socket, false)) {
                socket.emit('message', { username: 'SYSTEM', text: `🛡️ **SECURITY ALERT:** **${uname}** is locked to another device!`, _serverId: socket.activeServerId });
            }
            const prof = getSvProfile(uname);
            ensureTrainingProfile(prof);
            socket.emit('svStatsSync', prof);
        });

        socket.on('svGetStats', () => {
            const prof = getSvProfile(socket.username || 'Player');
            ensureTrainingProfile(prof);
            socket.emit('svStatsSync', prof);
        });

        socket.on('svRequestLogs', () => {
            if (socket.activeServerId) socket.emit('svLogsUpdate', svBattleLogs.filter(l => l.srvId === socket.activeServerId));
        });

        socket.on('svTrainAction', ({ mode, stat }) => {
            const uname = socket.username || 'Player';
            if (!verifyPlayerAccountOwnership(uname, socket, false)) return;
            const prof = getSvProfile(uname);
            const tr = ensureTrainingProfile(prof);

            if (mode === 'grind_free') { tr.xp = (tr.xp || 0) + 25; addCoins(uname, 8); }
            else if (mode === 'grind_10x') {
                if (getCoins(uname) < 100) return socket.emit('svNotice', '🪙 Need 100 Coins!');
                addCoins(uname, -100); tr.xp = (tr.xp || 0) + 300;
            } else if (mode === 'grind_100x') {
                if (getCoins(uname) < 800) return socket.emit('svNotice', '🪙 Need 800 Coins!');
                addCoins(uname, -800); tr.xp = (tr.xp || 0) + 3000;
            } else if (mode === 'upgrade' && ['fistLv', 'bodyLv', 'chiLv'].includes(stat)) {
                const curLv = tr[stat] || 0;
                const xpCost = 100 + Math.floor(curLv * 25);
                if ((tr.xp || 0) < xpCost) return socket.emit('svNotice', `⚡ Need ${xpCost.toLocaleString()} Training XP!`);
                tr.xp -= xpCost; tr[stat] = curLv + 1;
            }
            ensureTrainingProfile(prof); syncPlayerTitlesAndBounty(uname); saveSvStats();
            socket.emit('svStatsSync', getSvProfile(uname));
        });

        socket.on('svBuyPower', (pKey) => {
            const uname = socket.username || 'Player';
            if (!verifyPlayerAccountOwnership(uname, socket, false)) return;
            const prof = getSvProfile(uname), def = SV_DEFS[pKey];
            if (!def || !def.cost || prof.unlockedPowers.includes(pKey)) return;
            if (getCoins(uname) < def.cost) return socket.emit('svNotice', `🪙 Need ${def.cost} Coins!`);
            addCoins(uname, -def.cost); prof.unlockedPowers.push(pKey);
            saveSvStats(); socket.emit('svStatsSync', getSvProfile(uname));
            socket.emit('svNotice', `🎉 Unlocked ${def.icon} ${def.name}!`);
        });

        socket.on('svUpgradeStat', (stat) => {
            const uname = socket.username || 'Player';
            if (!verifyPlayerAccountOwnership(uname, socket, false)) return;
            const prof = getSvProfile(uname);
            if (stat === 'atk' && prof.atkLv < 15 && getCoins(uname) >= 150) { addCoins(uname, -150); prof.atkLv++; }
            else if (stat === 'hp' && prof.hpLv < 15 && getCoins(uname) >= 150) { addCoins(uname, -150); prof.hpLv++; }
            else if (stat === 'stone' && !prof.hasStone && getCoins(uname) >= 1000) { addCoins(uname, -1000); prof.hasStone = true; }
            else return socket.emit('svNotice', '🪙 Not enough Coins or maxed!');
            saveSvStats(); socket.emit('svStatsSync', getSvProfile(uname));
        });
        // ========================================================================
        // 🏋️ SAMMUVERSE V4 ENGINE — PIECE 11B/20: LINEAGE, TITLES, ENCHANT & FUSION
        // ========================================================================
        socket.on('svPetAction', (petId) => {
            const uname = socket.username || 'Player';
            if (!verifyPlayerAccountOwnership(uname, socket, false)) return;
            const prof = getSvProfile(uname), costs = { mochi: 200, tommy: 200, garuda: 500, sheshnag: 2500 };
            if (prof.ownedPets.includes(petId)) { prof.activePet = prof.activePet === petId ? null : petId; }
            else if (costs[petId]) {
                if (getCoins(uname) < costs[petId]) return socket.emit('svNotice', `🪙 Need ${costs[petId]} Coins!`);
                addCoins(uname, -costs[petId]); prof.ownedPets.push(petId); prof.activePet = petId;
            }
            saveSvStats(); socket.emit('svStatsSync', getSvProfile(uname));
        });

        socket.on('svSpinLineage', () => {
            const uname = socket.username || 'Player';
            const prof = getSvProfile(uname);
            if (getCoins(uname) < 1000) return socket.emit('svNotice', '🪙 Need 1,000 Coins!');
            addCoins(uname, -1000);
            const r = Math.random();
            prof.lineage = r < 0.06 ? 'celestial' : (r < 0.20 ? 'slime' : (r < 0.38 ? 'dragonkin' : (r < 0.58 ? 'demon' : (r < 0.78 ? 'reaper' : 'ape'))));
            prof.lineageStage = 1;
            syncPlayerTitlesAndBounty(uname); saveSvStats(); socket.emit('svStatsSync', getSvProfile(uname));
        });

        socket.on('svEvolveLineage', () => {
            const uname = socket.username || 'Player';
            const prof = getSvProfile(uname), stg = prof.lineageStage || 1;
            if (stg >= 3) return;
            const cost = stg === 1 ? 2500 : 6000;
            if (getCoins(uname) < cost) return socket.emit('svNotice', `🪙 Need ${cost.toLocaleString()} Coins!`);
            addCoins(uname, -cost); prof.lineageStage = stg + 1;
            syncPlayerTitlesAndBounty(uname); saveSvStats(); socket.emit('svStatsSync', getSvProfile(uname));
        });

        socket.on('svEquipTitle', (titleId) => {
            const uname = socket.username || 'Player';
            const prof = getSvProfile(uname);
            syncPlayerTitlesAndBounty(uname);
            if (!prof.unlockedTitles.includes(titleId)) return socket.emit('svNotice', '🔒 Unlock this Title first!');
            prof.activeTitle = titleId; saveSvStats(); socket.emit('svStatsSync', getSvProfile(uname));
        });

        socket.on('svRollEnchant', (pKey) => {
            const uname = socket.username || 'Player';
            const prof = getSvProfile(uname);
            if (getCoins(uname) < 3000) return socket.emit('svNotice', '🪙 Need 3,000 Coins!');
            addCoins(uname, -3000);
            if (!prof.enchants) prof.enchants = {};
            const rolled = ENCHANT_POOL.at(Math.floor(Math.random() * ENCHANT_POOL.length));
            prof.enchants[pKey || 'fire'] = rolled;
            syncPlayerTitlesAndBounty(uname); saveSvStats(); socket.emit('svStatsSync', getSvProfile(uname));
            socket.emit('svNotice', `🔮 Enchanted with ${rolled.name}!`);
        });

        socket.on('svGetStock', () => {
            const st = getHourlyStock();
            socket.emit('svStockSync', { items: st.items, minsLeft: Math.max(1, Math.ceil((st.expiresAt - Date.now()) / 60000)) });
        });

        socket.on('svBuyStockItem', (pKey) => {
            const uname = socket.username || 'Player';
            const prof = getSvProfile(uname);
            const item = getHourlyStock().items.find(i => i.key === pKey);
            if (!item || prof.unlockedPowers.includes(pKey)) return;
            if (getCoins(uname) < item.price) return socket.emit('svNotice', `🪙 Need ${item.price.toLocaleString()} Coins!`);
            addCoins(uname, -item.price); prof.unlockedPowers.push(pKey);
            saveSvStats(); socket.emit('svStatsSync', getSvProfile(uname));
        });

        socket.on('svForgeCustomPower', ({ p1, p2, customName }) => {
            const uname = socket.username || 'Player';
            const prof = getSvProfile(uname);
            if (!p1 || !p2 || p1 === p2) return socket.emit('svNotice', '⚠️ Select 2 DIFFERENT powers!');
            const def1 = SV_DEFS[p1], def2 = SV_DEFS[p2];
            if (!def1 || !def2) return;
            const slotNum = prof.customPowers.length + 1;
            const tiers = new Array(50000, 250000, 750000, 1500000);
            const cost = prof.customPowers.length < tiers.length ? tiers.at(prof.customPowers.length) : (tiers.at(-1) + ((prof.customPowers.length - tiers.length + 1) * 1000000));
            const usePass = (prof.freeFusionPasses || 0) > 0;
            if (!usePass && getCoins(uname) < cost) return socket.emit('svNotice', `🪙 Fusion #${slotNum} requires ${cost.toLocaleString()} Coins!`);

            const title = (String(customName || '').trim() || `${def1.name.split(' ').at(0)} + ${def2.name.split(' ').at(0)}`).slice(0, 26);
            const cid = 'custom_' + uname.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + slotNum + '_' + Date.now().toString(36);
            const m1 = def1.moves.at(0), m2 = def2.moves.at(1) || def2.moves.at(0);
            const u1 = def1.moves.at(3) || m1, u2 = def2.moves.at(3) || m2;
            const scale = 1 + ((slotNum - 1) * 0.04);
            const avgHp = Math.min(600, Math.round((def1.hp + def2.hp) * 0.65 * scale));
            const d1 = Math.max(55, Math.round((m1.dmg || 45) * 1.15 * scale));
            const d2 = Math.max(60, Math.round((m2.dmg || 50) * 1.15 * scale));
            const uDmg = Math.min(230, Math.max(120, Math.round(((u1.dmg || 90) + (u2.dmg || 90)) * 0.65 * scale)));

            const newDef = {
                fused: true, icon: `${def1.icon}${def2.icon}`, name: `${title} [#${slotNum}]`, hp: avgHp,
                passiveRed: Math.min(0.50, Number((((def1.passiveRed || 0.1) + (def2.passiveRed || 0.1)) * 0.65).toFixed(2))),
                strong: Array.from(new Set(new Array().concat(def1.strong || new Array(), def2.strong || new Array()))),
                moves: new Array(
                    { label: `${m1.label.split(' (').at(0)} (${d1} DMG)`, dmg: d1, trueDmg: Boolean(m1.trueDmg) },
                    { label: `${m2.label.split(' (').at(0)} (${d2} DMG + Heal)`, dmg: d2, heal: 25 },
                    { label: `🌌 ${title} Domain (Evade +65 HP)`, evade: true, heal: 65 },
                    { label: `💥 ${title.toUpperCase()} ULT (${uDmg} True DMG + Stun)`, dmg: uDmg, trueDmg: true, stun: true, cut: { theme: 'vishwaroopa', emoji: `${def1.icon}${def2.icon}`, title: `${title.toUpperCase()}!` } }
                )
            };
            if (usePass) prof.freeFusionPasses--; else addCoins(uname, -cost);
            SV_DEFS[cid] = newDef; prof.unlockedPowers.push(cid); prof.customPowers.push({ id: cid, def: newDef });
            syncPlayerTitlesAndBounty(uname); saveSvStats();
            socket.emit('svStatsSync', getSvProfile(uname));
            socket.emit('svNotice', `⚗️👑 FORGED FUSION #${slotNum}: "${title}"!`);
        });
    });
    // ============================================================================
    // ⚔️ SAMMUVERSE V4 ENGINE — PIECE 12/20: PVP, ADVENTURE, TOWER & CLOUD BOOT
    // ============================================================================
    io.on('connection', (socket) => {
        socket.on('svChallenge', ({ targetId, power }) => {
            const srvId = socket.activeServerId;
            if (!srvId || findPlayerActiveSvBattle(socket.id)) return;
            if (['BOT_DUMMY', 'BOT_SENSEI', 'BOT_DEMON'].includes(targetId)) return startSvMatch(srvId, socket, power, targetId, null);
            const tSock = io.sockets.sockets.get(targetId);
            if (!tSock || tSock.activeServerId !== srvId) return socket.emit('svNotice', '⚠️ Opponent offline!');
            svPending.set(socket.id, { targetId, power, srvId, expires: Date.now() + 45000 });
            const def = SV_DEFS[power] || SV_DEFS.fire;
            io.to(targetId).emit('svIncomingChallenge', { fromId: socket.id, fromName: socket.username || 'Player', fromPowerLabel: `${def.icon} ${def.name}`, _serverId: srvId });
        });

        socket.on('svAccept', ({ challengerId, power }) => {
            const srvId = socket.activeServerId, req = svPending.get(challengerId);
            if (!srvId || !req || req.targetId !== socket.id || Date.now() > req.expires) return;
            svPending.delete(challengerId);
            const cSock = io.sockets.sockets.get(challengerId);
            if (cSock) startSvMatch(srvId, cSock, req.power, socket, power);
        });

        socket.on('svUseSkill', (idx) => {
            const found = findPlayerActiveSvBattle(socket.id);
            if (!found) return;
            const { bId, b } = found, fighter = b.p1.id === socket.id ? b.p1 : b.p2;
            if (fighter.choice !== null || fighter.stunned || (Number(idx) === 3 && fighter.ultCd > 0)) return;
            fighter.choice = Number(idx);
            if (b.p1.choice !== null && b.p2.choice !== null) resolveSvTurn(bId);
            else syncSvBattle(b, null);
        });

        socket.on('svDomainTap', () => {
            for (const [, cl] of activeDomainClashes.entries()) {
                if (cl.p1Id === socket.id) cl.p1Taps++;
                else if (cl.p2Id === socket.id) cl.p2Taps++;
            }
        });

        socket.on('svSurrenderToLove', () => {
            const found = findPlayerActiveSvBattle(socket.id);
            if (!found) return;
            const { bId, b } = found;
            const me = b.p1.id === socket.id ? b.p1 : b.p2;
            const opp = me === b.p1 ? b.p2 : b.p1;
            if (opp.isBot) return socket.emit('svNotice', '😂 Save Prem Samarpan for a real player!');
            clearInterval(b.interval); svBattles.delete(bId);
            broadcastSvCutscene(b, { theme: 'bansuri', emoji: '🪈💖', title: 'PREM SAMARPAN: SURRENDER TO LOVE!', caption: `💖 ${me.name.toUpperCase()} BOWED IN LOVE TO ${opp.name.toUpperCase()}!`, sfx: 'flute' });
            addCoins(opp.name, 250);
            io.to(me.id).emit('svBattleEnd', { won: false, _serverId: b.srvId });
            io.to(opp.id).emit('svBattleEnd', { won: true, _serverId: b.srvId });
            io.to(b.srvId).emit('message', { username: "Sammu's Bot", text: `💖🪈 **PREM SAMARPAN!** **${me.name}** surrendered out of love to **${opp.name}** (+250🪙)!`, _serverId: b.srvId });
        });

        socket.on('svStartAdventure', ({ ch, stg, power }) => {
            if (!socket.activeServerId || findPlayerActiveSvBattle(socket.id)) return socket.emit('svNotice', '⚠️ Finish your current battle first!');
            launchAdventureStage(socket, Number(ch) || 1, Number(stg) || 1, power || 'fire');
        });

        socket.on('svTowerEnter', ({ startFromCheckpoint }) => {
            if (!socket.activeServerId || findPlayerActiveSvBattle(socket.id)) return socket.emit('svNotice', '⚠️ Finish your current battle first!');
            const prof = getSvProfile(socket.username || 'Climber');
            launchEndlessTowerFloor(socket, startFromCheckpoint ? Math.max(1, prof.towerCheckpoint || 1) : 1, null);
        });

        socket.on('svGetTowerLeaderboard', () => {
            const top = Object.entries(svPlayerStats).map(([n, s]) => ({ name: n.toUpperCase(), floor: s.maxTowerFloor || 1 })).sort((a, b) => b.floor - a.floor).slice(0, 8);
            socket.emit('svTowerLeaderboardSync', top);
        });

        socket.on('chatMessage', async (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            if (typeof raw !== 'string' || !socket.activeServerId) return;
            if (raw.trim().toLowerCase() === '/cloudsave') {
                const r1 = await upstashCmd(['SET', 'sammu_sv_stats', JSON.stringify(svPlayerStats)]);
                const r2 = await upstashCmd(['SET', 'sammu_economy', JSON.stringify({ wallets: Object.fromEntries(playerWallet), cards: Object.fromEntries(playerCards) })]);
                socket.emit('message', { username: 'SYSTEM', text: (r1 && r2) ? `☁️✅ **CLOUD SAVED!** (${Object.keys(svPlayerStats).length} Profiles synced!)` : `❌ **Cloud Save Failed!**`, _serverId: socket.activeServerId });
            }
        });
    });

    (async function restoreCloudV4() {
        if (!UPSTASH_URL || !UPSTASH_TOKEN) return;
        const rawStats = await upstashCmd(['GET', 'sammu_sv_stats']);
        if (rawStats) {
            try {
                const parsed = JSON.parse(rawStats);
                Object.entries(parsed).forEach(([k, v]) => {
                    svPlayerStats[k.toLowerCase()] = v;
                    if (Array.isArray(v.customPowers)) v.customPowers.forEach(cp => { if (cp && cp.id) SV_DEFS[cp.id] = cp.def; });
                });
            } catch (e) {}
        }
        const rawEco = await upstashCmd(['GET', 'sammu_economy']);
        if (rawEco) {
            try {
                const eco = JSON.parse(rawEco);
                if (eco.wallets) Object.entries(eco.wallets).forEach(([k, v]) => playerWallet.set(k.toLowerCase(), Number(v)));
                if (eco.cards) Object.entries(eco.cards).forEach(([k, v]) => playerCards.set(k.toLowerCase(), v));
            } catch (e) {}
        }
    })();
    // ============================================================================
    // 🎨 SAMMUVERSE V4 ENGINE — PIECE 13/20: V4 STYLES & CINEMA CUTSCENE HTML
    // ============================================================================
    const SV_UI_HTML_PART1 = `
    <style>
      #svModal { display:none; position:fixed; inset:0; background:rgba(5,7,16,0.95); z-index:999995; align-items:center; justify-content:center; padding:10px; backdrop-filter:blur(10px); font-family:inherit; }
      #svCard { background:linear-gradient(155deg,#0f172a,#1e1b4b,#311042); border:2px solid #a855f7; border-radius:22px; padding:13px; width:100%; max-width:440px; max-height:93vh; overflow-y:auto; color:#fff; box-shadow:0 0 40px rgba(168,85,247,0.55); text-align:center; }
      .sv-tabs { display:grid; grid-template-columns:repeat(5,1fr); gap:4px; margin:8px 0; }
      .sv-tab { padding:7px 2px; border-radius:10px; border:1px solid #a855f7; background:#1e1b4b; color:#fff; font-weight:900; font-size:10px; cursor:pointer; }
      .sv-tab.active { background:#a855f7; color:#fff; box-shadow:0 0 10px rgba(168,85,247,0.6); }
      .sv-powers { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin:8px 0; max-height:185px; overflow-y:auto; }
      .sv-pwr-btn { background:rgba(255,255,255,0.07); border:1.5px solid #475569; border-radius:11px; padding:7px 6px; color:#fff; font-size:11px; font-weight:bold; cursor:pointer; text-align:left; }
      .sv-pwr-btn.selected { border-color:#facc15; background:rgba(250,204,21,0.22); }
      .sv-pwr-btn.locked-coin { border-color:#38bdf8; background:rgba(56,189,248,0.1); }
      .sv-hp-wrap { background:#090d16; border:1px solid #475569; border-radius:10px; padding:5px 6px; margin-bottom:5px; text-align:left; }
      .sv-hp-bar { height:9px; border-radius:6px; background:linear-gradient(90deg,#22c55e,#4ade80); transition:width 0.3s; }
      .sv-hp-bar.awakened { background:linear-gradient(90deg,#f59e0b,#facc15,#fef08a) !important; box-shadow:0 0 12px #facc15; }
      .sv-skills { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin-top:7px; }
      .sv-skill-btn { background:linear-gradient(145deg,#3b0764,#1e1b4b); border:1.5px solid #c084fc; border-radius:12px; padding:8px 7px; color:#fff; font-size:11px; font-weight:bold; cursor:pointer; text-align:left; }
      .sv-skill-btn:disabled { opacity:0.45; cursor:not-allowed; }
      .sv-skill-btn.ult { border-color:#facc15; background:linear-gradient(145deg,#713f12,#4c0519); }
      .sv-shop-card { background:rgba(255,255,255,0.06); border:1px solid #475569; border-radius:11px; padding:8px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; text-align:left; font-size:11px; }
      .sv-log-item { background:rgba(255,255,255,0.06); border-left:3px solid #facc15; border-radius:8px; padding:6px 8px; margin-bottom:5px; font-size:11px; text-align:left; }
      #svCutsceneOverlay { display:none; position:fixed; inset:0; z-index:9999999; background:rgba(3,5,12,0.95); backdrop-filter:blur(10px); align-items:center; justify-content:center; flex-direction:column; padding:12px; }
      #svCutsceneBox { position:relative; width:100%; max-width:430px; border:3px solid #facc15; border-radius:20px; overflow:hidden; background:#03050c; box-shadow:0 0 60px rgba(250,204,21,0.85); text-align:center; }
      #svCutsceneCanvas { width:100%; height:260px; display:block; }
      #svSkipCutsceneBtn { position:absolute; top:26px; right:10px; z-index:10; background:rgba(15,23,42,0.92); border:1.5px solid #facc15; color:#fde047; border-radius:999px; padding:5px 12px; font-size:11px; font-weight:900; cursor:pointer; }
    </style>

    <div id="svCutsceneOverlay" onclick="if(event.target===this)skipSvCutscene()">
      <div id="svCutsceneBox">
        <button id="svSkipCutsceneBtn" onclick="skipSvCutscene()">⏭️ Skip</button>
        <canvas id="svCutsceneCanvas" width="420" height="260"></canvas>
        <div id="svCutsceneCaption" style="padding:9px 10px;background:linear-gradient(90deg,#3b0764,#713f12);font-weight:900;font-size:13px;color:#fef08a;">ULTIMATE AWAKENING!</div>
      </div>
    </div>

    <div id="svSubModal" style="display:none;position:fixed;inset:0;background:rgba(5,7,18,0.93);z-index:9999996;align-items:center;justify-content:center;padding:12px;backdrop-filter:blur(8px);">
      <div style="background:linear-gradient(155deg,#0f172a,#1e1b4b);border:2px solid #38bdf8;border-radius:20px;padding:14px;width:100%;max-width:415px;max-height:86vh;overflow-y:auto;color:#fff;text-align:center;box-shadow:0 0 35px rgba(56,189,248,0.5);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span id="svSubTitle" style="font-weight:900;font-size:14px;color:#38bdf8;">✨ SAMMUVERSE MENU</span>
          <button onclick="document.getElementById('svSubModal').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:8px;padding:4px 10px;font-weight:bold;cursor:pointer;">✕ Close</button>
        </div>
        <div id="svSubBody"></div>
      </div>
    </div>

    <div id="svDomainClashModal" style="display:none;position:fixed;inset:0;background:rgba(9,5,20,0.95);z-index:9999998;align-items:center;justify-content:center;padding:14px;backdrop-filter:blur(10px);">
      <div style="background:linear-gradient(145deg,#3b0764,#7f1d1d);border:3px solid #facc15;border-radius:22px;padding:18px;width:100%;max-width:360px;color:#fff;text-align:center;box-shadow:0 0 45px rgba(250,204,21,0.8);">
        <div style="font-size:18px;font-weight:900;color:#fde047;margin-bottom:4px;">⚡👑 V3 DOMAIN CLASH!! ⚡</div>
        <div id="svClashSub" style="font-size:12px;color:#fecaca;margin-bottom:12px;">Rapidly tap below to overpower your rival!</div>
        <button onclick="if(typeof socket!=='undefined')socket.emit('svDomainTap');" style="width:100%;padding:22px;border:2px solid #fff;border-radius:16px;background:linear-gradient(90deg,#f59e0b,#ef4444);color:#fff;font-size:20px;font-weight:900;cursor:pointer;box-shadow:0 0 25px #f59e0b;">💥 TAP FAST! 💥</button>
      </div>
    </div>`;
  // ============================================================================
 // 🎨 SAMMUVERSE V4 ENGINE — PIECE 14A/20: MODAL HEADER, ARENA & STORY HTML
 // ============================================================================
 const SV_UI_HTML_PART2A = `
 <div id="svModal">
   <div id="svCard">
     <div style="display:flex;justify-content:space-between;align-items:center;">
       <span style="font-weight:900;font-size:15px;color:#e879f9;">⚔️ SAMMUVERSE V4 RPG</span>
       <div style="display:flex;gap:5px;align-items:center;">
         <span id="svHeaderCoins" style="background:#090d16;border:1px solid #facc15;color:#fde047;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:900;">🪙 150</span>
         <button id="svMuteBtn" onclick="toggleSvSfx()" style="background:#1e293b;border:1px solid #38bdf8;color:#fff;border-radius:8px;padding:3px 7px;font-size:11px;cursor:pointer;">🔊</button>
         <button onclick="document.getElementById('svModal').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:8px;padding:4px 9px;font-weight:bold;cursor:pointer;">✕</button>
       </div>
     </div>

     <div id="svLobbyView">
       <div class="sv-tabs">
         <button class="sv-tab active" id="svTabFight" onclick="switchSvTab('fight')">⚔️ Arena</button>
         <button class="sv-tab" id="svTabAdv" onclick="switchSvTab('adv')">🗺️ Story</button>
         <button class="sv-tab" id="svTabTrain" onclick="switchSvTab('train')">🏋️ Train</button>
         <button class="sv-tab" id="svTabDojo" onclick="switchSvTab('dojo')">💪 Dojo</button>
         <button class="sv-tab" id="svTabLogs" onclick="switchSvTab('logs')">📜 Logs</button>
       </div>

       <div id="svFightPanel">
         <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:3px;margin-bottom:6px;">
           <button type="button" onclick="openDailyWheelModal()" style="padding:6px 1px;border-radius:9px;border:1.5px solid #f43f5e;background:#4c0519;color:#fda4af;font-size:10px;font-weight:900;cursor:pointer;">🎡 Wheel</button>
           <button type="button" onclick="openSvSub('lineage')" style="padding:6px 1px;border-radius:9px;border:1.5px solid #4ade80;background:#064e3b;color:#86efac;font-size:10px;font-weight:900;cursor:pointer;">🧬 DNA</button>
           <button type="button" onclick="openSvSub('titles')" style="padding:6px 1px;border-radius:9px;border:1.5px solid #facc15;background:#311042;color:#fde047;font-size:10px;font-weight:900;cursor:pointer;">🏷️ Titles</button>
           <button type="button" onclick="openEndlessTowerModal()" style="padding:6px 1px;border-radius:9px;border:1.5px solid #38bdf8;background:#1e3a8a;color:#93c5fd;font-size:10px;font-weight:900;cursor:pointer;">♾️ Tower</button>
           <button type="button" onclick="openSvSub('stock')" style="padding:6px 1px;border-radius:9px;border:1.5px solid #38bdf8;background:#0c4a6e;color:#7dd3fc;font-size:10px;font-weight:900;cursor:pointer;">🎰 Stock</button>
           <button type="button" onclick="socket.emit('svRollEnchant',window._curSvPow||'fire')" style="padding:6px 1px;border-radius:9px;border:1.5px solid #c084fc;background:#3b0764;color:#e879f9;font-size:10px;font-weight:900;cursor:pointer;">🔮 Enchant</button>
         </div>

         <div style="display:flex;gap:5px;margin-bottom:6px;">
           <input id="svSecretCodeInput" placeholder="🔑 Enter Secret or Gift Code..." style="flex:1;padding:6px 8px;border-radius:9px;border:1.5px solid #f59e0b;background:#090d16;color:#fff;font-size:11px;">
           <button onclick="redeemSvSecretCode()" style="background:linear-gradient(90deg,#f59e0b,#d97706);border:none;color:#111;border-radius:9px;padding:6px 10px;font-weight:900;font-size:11px;cursor:pointer;">🔓 Redeem</button>
         </div>

         <div class="sv-powers" id="svPowerGrid"></div>
         <div id="svPowerPreview" style="background:rgba(168,85,247,0.16);border:1px solid #c084fc;border-radius:10px;padding:6px;font-size:11px;color:#fde047;margin-bottom:7px;">Select a power to inspect its 4 skills!</div>

         <div style="display:flex;gap:5px;margin-bottom:6px;">
           <select id="svOpponentSelect" style="flex:1;padding:7px;border-radius:10px;border:1.5px solid #38bdf8;background:#090d16;color:#fff;font-size:11px;">
             <option value="BOT_DUMMY">🥊 Wooden Dummy (+35🪙)</option>
           </select>
           <button onclick="sendSvChallenge()" style="padding:7px 14px;border:none;border-radius:10px;background:linear-gradient(90deg,#ec4899,#8b5cf6);color:#fff;font-weight:900;font-size:12px;cursor:pointer;">⚔️ FIGHT</button>
         </div>
         <div id="svIncomingBox" style="display:none;background:rgba(250,204,21,0.2);border:1.5px solid #facc15;border-radius:12px;padding:8px;margin-top:6px;"></div>
       </div>

       <div id="svAdvPanel" style="display:none;max-height:345px;overflow-y:auto;">
         <div style="background:linear-gradient(90deg,#064e3b,#1e3a8a);border:1.5px solid #4ade80;border-radius:12px;padding:8px;margin-bottom:8px;">
           <div style="font-size:13px;font-weight:900;color:#4ade80;">🗺️ REALM ADVENTURE CAMPAIGN</div>
           <div id="svAdvSummary" style="font-size:11px;color:#cbd5e1;margin-top:2px;">Chapter 1 — Stage 1/3 | Pet Essence: 0 🔮</div>
         </div>
         <div id="svAdventureChaptersList"></div>
       </div>`;

    // ============================================================================
    // 🎨 SAMMUVERSE V4 ENGINE — PIECE 14B/20: TRAIN, DOJO, MERGER & BATTLE HUD
    // ============================================================================
    const SV_UI_HTML_PART2B = `
          <div id="svTrainPanel" style="display:none;max-height:345px;overflow-y:auto;">
            <div style="background:linear-gradient(90deg,#1e3a8a,#3b0764);border:1.5px solid #38bdf8;border-radius:12px;padding:8px;margin-bottom:8px;">
              <div style="font-size:13px;font-weight:900;color:#fde047;">🏋️ COSMIC TRAINING ARENA</div>
              <div id="svTrainSummary" style="font-size:11px;color:#cbd5e1;margin-top:2px;">Total Mastery: 0 | Available XP: 0 ⚡</div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:8px;">
              <button onclick="socket.emit('svTrainAction',{mode:'grind_free'})" style="padding:9px 4px;border:1.5px solid #4ade80;border-radius:10px;background:#064e3b;color:#fff;font-weight:900;font-size:11px;cursor:pointer;">🥊 Sparring<br><span style="font-size:9px;color:#86efac;">+25 XP & +8🪙</span></button>
              <button onclick="socket.emit('svTrainAction',{mode:'grind_10x'})" style="padding:9px 4px;border:1.5px solid #38bdf8;border-radius:10px;background:#0c4a6e;color:#fff;font-weight:900;font-size:11px;cursor:pointer;">🌌 10x Gravity<br><span style="font-size:9px;color:#7dd3fc;">+300 XP (100🪙)</span></button>
              <button onclick="socket.emit('svTrainAction',{mode:'grind_100x'})" style="padding:9px 4px;border:1.5px solid #facc15;border-radius:10px;background:#713f12;color:#fff;font-weight:900;font-size:11px;cursor:pointer;">⏳ 100x Chamber<br><span style="font-size:9px;color:#fde047;">+3,000 XP (800🪙)</span></button>
            </div>
            <div class="sv-shop-card"><div><b style="color:#f87171;">👊 Fist Mastery</b><br><span id="svFistDesc" style="color:#cbd5e1;">Lv.0 (+0 Permanent DMG)</span></div><button id="svUpFistBtn" onclick="socket.emit('svTrainAction',{mode:'upgrade',stat:'fistLv'})" style="background:#dc2626;border:none;color:#fff;padding:6px 10px;border-radius:8px;font-weight:900;cursor:pointer;">100 XP</button></div>
            <div class="sv-shop-card"><div><b style="color:#4ade80;">🛡️ Body Temper</b><br><span id="svBodyDesc" style="color:#cbd5e1;">Lv.0 (+0 Permanent HP)</span></div><button id="svUpBodyBtn" onclick="socket.emit('svTrainAction',{mode:'upgrade',stat:'bodyLv'})" style="background:#16a34a;border:none;color:#fff;padding:6px 10px;border-radius:8px;font-weight:900;cursor:pointer;">100 XP</button></div>
            <div class="sv-shop-card"><div><b style="color:#38bdf8;">⚡ Chi Focus</b><br><span id="svChiDesc" style="color:#cbd5e1;">Lv.0 (+0% ULT & Crit)</span></div><button id="svUpChiBtn" onclick="socket.emit('svTrainAction',{mode:'upgrade',stat:'chiLv'})" style="background:#0284c7;border:none;color:#fff;padding:6px 10px;border-radius:8px;font-weight:900;cursor:pointer;">100 XP</button></div>
          </div>

          <div id="svDojoPanel" style="display:none;max-height:345px;overflow-y:auto;">
            <div id="svRankBanner" style="background:rgba(168,85,247,0.2);border:1px solid #c084fc;border-radius:10px;padding:6px;font-size:11px;font-weight:bold;color:#e879f9;margin-bottom:7px;">Wins: 0 | Essence: 0🔮</div>
            <div class="sv-shop-card" style="border-color:#38bdf8;"><div><b style="color:#38bdf8;">⚡ Omega Core Gear</b><br><span style="color:#cbd5e1;">Req: Tower Floor 50 | Unlocks ⚡ Omega Evolution!</span></div><button id="svGearOmegaBtn" onclick="socket.emit('svCraftGear','omegaCore')" style="background:#0284c7;border:none;color:#fff;padding:6px 9px;border-radius:8px;font-weight:900;cursor:pointer;">10,000🪙</button></div>
            <div class="sv-shop-card" style="border-color:#f43f5e;"><div><b style="color:#fda4af;">🌌 Titan Crown Gear</b><br><span style="color:#cbd5e1;">Req: Tower Floor 50 | Unlocks 🌌 Colossal Titan Form!</span></div><button id="svGearTitanBtn" onclick="socket.emit('svCraftGear','titanCrown')" style="background:#e11d48;border:none;color:#fff;padding:6px 9px;border-radius:8px;font-weight:900;cursor:pointer;">25,000🪙</button></div>
            <div class="sv-shop-card"><div><b style="color:#f87171;">⚔️ Attack Boost</b><br><span id="svAtkDesc" style="color:#cbd5e1;">Lv.0/15 (+0 DMG)</span></div><button id="svBuyAtkBtn" onclick="buySvItem('atk')" style="background:#dc2626;border:none;color:#fff;padding:6px 10px;border-radius:8px;font-weight:900;cursor:pointer;">150🪙</button></div>
            <div class="sv-shop-card"><div><b style="color:#4ade80;">❤️ Health Boost</b><br><span id="svHpDesc" style="color:#cbd5e1;">Lv.0/15 (+0 HP)</span></div><button id="svBuyHpBtn" onclick="buySvItem('hp')" style="background:#16a34a;border:none;color:#fff;padding:6px 10px;border-radius:8px;font-weight:900;cursor:pointer;">150🪙</button></div>
            <div class="sv-shop-card" style="border-color:#facc15;"><div><b style="color:#fde047;">💎 Awakening Stone</b><br><span style="color:#cbd5e1;">Below 40% HP: +25% ATK & +40 HP!</span></div><button id="svBuyStoneBtn" onclick="buySvItem('stone')" style="background:#d97706;border:none;color:#fff;padding:6px 10px;border-radius:8px;font-weight:900;cursor:pointer;">1000🪙</button></div>
            <div style="background:rgba(168,85,247,0.16);border:1.5px solid #e879f9;border-radius:12px;padding:8px;margin:7px 0;text-align:left;">
              <div style="font-size:11px;font-weight:900;color:#f0abfc;margin-bottom:5px;">⚗️ CUSTOM MULTI-FUSION LAB</div>
              <div style="display:flex;gap:5px;margin-bottom:5px;">
                <select id="svFuseP1" style="flex:1;padding:6px;border-radius:8px;background:#090d16;color:#fff;border:1px solid #a855f7;font-size:11px;"></select>
                <select id="svFuseP2" style="flex:1;padding:6px;border-radius:8px;background:#090d16;color:#fff;border:1px solid #a855f7;font-size:11px;"></select>
              </div>
              <input id="svFuseName" placeholder="Custom Fusion Name..." maxlength="24" style="width:100%;padding:6px;border-radius:8px;background:#090d16;color:#fff;border:1px solid #38bdf8;font-size:11px;margin-bottom:5px;box-sizing:border-box;">
              <button id="svForgeBtn" onclick="socket.emit('svForgeCustomPower',{p1:document.getElementById('svFuseP1').value,p2:document.getElementById('svFuseP2').value,customName:document.getElementById('svFuseName').value})" style="width:100%;padding:8px;border:none;border-radius:9px;background:linear-gradient(90deg,#ec4899,#8b5cf6);color:#fff;font-weight:900;font-size:11px;cursor:pointer;">⚗️ Forge Fusion #1 (50,000🪙)</button>
            </div>
            <div style="font-size:11px;font-weight:900;color:#f472b6;text-align:left;margin:6px 0 4px;">🧬 PET MERGER & EVOLUTION LAB:</div>
            <div class="sv-shop-card" style="border-color:#f59e0b;"><div><b style="color:#fde047;">🦁 Chimera Guardian</b><br><span style="color:#cbd5e1;">Merge 🐱 Mochi + 🐶 Tommy (30🔮 + 1,000🪙)</span></div><button id="svMergeChimeraBtn" onclick="socket.emit('svMergePet','chimera')" style="background:#d97706;border:none;color:#fff;padding:6px 9px;border-radius:8px;font-weight:900;cursor:pointer;">Merge</button></div>
            <div class="sv-shop-card" style="border-color:#a855f7;"><div><b style="color:#e879f9;">🐉 Cosmic Ouroboros</b><br><span style="color:#cbd5e1;">Merge 🦅 Garuda + 🐍 Sheshnag (80🔮 + 4,000🪙)</span></div><button id="svMergeOuroBtn" onclick="socket.emit('svMergePet','ouroboros')" style="background:#7c3aed;border:none;color:#fff;padding:6px 9px;border-radius:8px;font-weight:900;cursor:pointer;">Merge</button></div>
            <div style="font-size:11px;font-weight:900;color:#38bdf8;text-align:left;margin:6px 0 4px;">🐾 COMPANION SPIRITS:</div>
            <div id="svPetShopList"></div>
          </div>

          <div id="svLogsPanel" style="display:none;max-height:345px;overflow-y:auto;">
            <div id="svLogList" style="font-size:11px;color:#94a3b8;">Loading PvP Battle Register...</div>
          </div>
        </div>

        <div id="svBattleView" style="display:none;margin-top:6px;">
          <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:bold;color:#38bdf8;margin-bottom:4px;"><span id="svTurnBadge">Turn 1</span><span id="svBattleTimer" style="color:#fde047;">⏳ 15s</span></div>
          <div class="sv-hp-wrap"><div style="display:flex;justify-content:space-between;font-size:11px;font-weight:bold;margin-bottom:2px;"><span id="svOppLabel" style="color:#f87171;">Opponent</span><span id="svOppHpText">200 / 200 HP</span></div><div class="sv-hp-bar" id="svOppHpBar" style="width:100%;background:linear-gradient(90deg,#dc2626,#f87171);"></div></div>
          <div class="sv-hp-wrap"><div style="display:flex;justify-content:space-between;font-size:11px;font-weight:bold;margin-bottom:2px;"><span id="svMeLabel" style="color:#4ade80;">You</span><span id="svMeHpText">200 / 200 HP</span></div><div class="sv-hp-bar" id="svMeHpBar" style="width:100%;"></div></div>
          <div id="svTransformBar" style="display:flex;gap:5px;margin:5px 0;"></div>
          <div id="svCombatFeed" style="background:#090d16;border:1px solid #334155;border-radius:10px;padding:6px;font-size:11px;color:#e2e8f0;min-height:44px;margin:5px 0;">Choose your skill below!</div>
          <div class="sv-skills" id="svSkillButtons"></div>
        </div>
      </div>
    </div>`;
  const SV_FULL_BUNDLE = SV_UI_HTML_PART1 + '\n' + SV_UI_HTML_PART2A + '\n' + SV_UI_HTML_PART2B;


    // ============================================================================
    // 🎬 SAMMUVERSE V4 ENGINE — PIECE 15/20: CLIENT POWERS & ANIME SFX
    // ============================================================================
    const SV_CLIENT_JS_PART1 = `
      const SV_POWERS = {
        fire:       { icon: '🔥', name: 'Fire Inferno',     skills: ['Fireball (28 DMG)', 'Flame Tornado (42 DMG)', 'Heat Shield (Block 70%)', '☀️ Solar Flare ULT (68 DMG)'] },
        water:      { icon: '🌊', name: 'Water Tsunami',    skills: ['Hydro Whip (26 DMG)', 'Whirlpool Trap (35 DMG)', 'Water Mirror (Reflect 50%)', '🌊 Abyssal Wave ULT (65 DMG)'] },
        lightning:  { icon: '⚡', name: 'Lightning Raijin',  skills: ['Thunder Bolt (30 DMG)', 'Speed Blitz (43 DMG)', 'Static Armor (Block 65%)', '🐉 Kirin Sky Dragon ULT (69 DMG)'] },
        ice:        { icon: '❄️', name: 'Absolute Ice',     skills: ['Ice Lance (27 DMG)', 'Frostbite (36 DMG)', 'Glacier Wall (Block 80%)', '🧊 Ice Age Freeze ULT (58 DMG + Stun)'] },
        storm:      { cost: 300, icon: '🌪️', name: 'Storm Dragon',     skills: ['Gale Blade (29 DMG)', 'Tornado Slam (43 DMG)', 'Wind Wall (Block 75%)', '⚡ Tempest Roar ULT (71 DMG)'] },
        venom:      { cost: 300, icon: '☠️', name: 'Venom Hydra',      skills: ['Acid Spit (28 DMG)', 'Toxic Fang (42 DMG)', 'Shed Skin (+25 HP & Shield)', '🐍 Hydra Plague ULT (69 DMG)'] },
        rubber:     { cost: 300, icon: '👒', name: 'Rubber Gear 5',    skills: ['Gum-Gum Pistol (29 DMG)', 'Gatling Barrage (44 DMG)', 'Elastic Bounce (Dodge +15 HP)', '👊 Bajrang Fist ULT (72 DMG)'] },
        blood:      { cost: 300, icon: '🩸', name: 'Blood Demon',      skills: ['Crimson Slash (29 DMG)', 'Vampire Bite (34 DMG + 18 HP)', 'Blood Mist (Evade Hit)', '🌕 Moonlit Massacre ULT (70 DMG)'] },
        gravity:    { cost: 750, icon: '🪐', name: 'Gravity Force',    skills: ['Crush Slam (31 DMG)', 'Meteor Drop (46 DMG)', 'Gravity Repulse (Block 75%)', '☄️ Planetary Devastation ULT (74 DMG)'] },
        space:      { cost: 750, icon: '🌌', name: 'Space Warp',       skills: ['Spatial Slash (32 DMG)', 'Void Rift (44 DMG)', 'Teleport Dodge (Evade Hit)', '🌌 Dimension Collapse ULT (74 DMG)'] },
        time:       { cost: 750, icon: '⏳', name: 'Time Chrono',      skills: ['Chrono Strike (28 DMG)', 'Age Decay (40 DMG)', 'Rewind Heal (+40 HP)', '⏸️ Time Stop ULT (62 DMG + Stun)'] },
        sun:        { cost: 750, icon: '☀️', name: 'Sun God Nika',     skills: ['Dawn Whip (32 DMG)', 'Sun Gatling (46 DMG)', 'Drum Heartbeat (+35 HP)', '🔥 Bajrang Dawn ULT (78 DMG)'] },
        shadow:     { cost: 1500, icon: '🌑', name: 'Shadow Monarch',  skills: ['Shadow Dagger (35 DMG)', 'Arise Army (49 DMG)', 'Umbral Dodge (Evade Hit)', '👑 Monarch Domain ULT (82 DMG)'] },
        blackhole:  { cost: 1500, icon: '🕳️', name: 'Black Hole',      skills: ['Dark Pull (33 DMG)', 'Event Horizon (44 DMG + Drain)', 'Matter Absorb (+30 HP & Shield)', '🕳️ Supermassive Crunch ULT (82 DMG)'] },
        antimatter: { cost: 1500, icon: '⚛️', name: 'Anti-Matter',     skills: ['Positron Beam (36 DMG)', 'Chain Annihilation (52 DMG)', 'Phase Shift (Evade Hit)', '💥 Big Bang Erasure ULT (86 DMG)'] },
        zoro:       { cost: 2000, icon: '⚔️', name: 'Zoro (3-Sword King)',      skills: ['Oni Giri (40 DMG)', 'Dragon Twister (56 DMG)', 'King Haki Parry (Block 80%)', '👹 Ashura 9-Sword ULT (94 DMG)'] },
        sus:        { cost: 2000, icon: '👀', name: 'Sus (Shadow Imposter)',    skills: ['Vent Ambush (40 DMG)', 'Sabotage Strike (54 DMG)', 'Fake Task Evade (+35 HP)', '🚨 Emergency Eject ULT (92 DMG + Stun)'] },
        moon:       { cost: 4000, icon: '🌙', name: 'Dr. Moon (Lunar Empress)', skills: ['🌙 Lunar Scalpel (44 DMG)', '🌿 Sanjeevani Surge (58 DMG + 18 HP)', '🩺 Doctor Elixir (Evade +65 HP)', '🌕 Full Moon Eclipse ULT (98 DMG + Stun)'] },
        plasma:      { fused: true, icon: '⚛️🔥', name: 'Plasma Emperor',    skills: ['Plasma Lance (48 DMG)', 'Supernova Arc (64 DMG)', 'Ion Barrier (Block 80%)', '☀️ STAR COLLAPSE ULT (108 DMG)'] },
        leviathan:   { fused: true, icon: '🐉🌊', name: 'Steam Leviathan',   skills: ['Scalding Geyser (46 DMG)', 'Boil Tsunami (62 DMG + 18 HP)', 'Mist Mirage (Evade +28 HP)', '🐉 OCEAN BOIL ULT (105 DMG)'] },
        chronovoid:  { fused: true, icon: '⏳🌌', name: 'Chrono Void God',   skills: ['Reality Tear (50 DMG)', 'Paradox Loop (58 DMG + Stun)', 'Time Rewind (Evade +50 HP)', '🌌 BIG CRUNCH ULT (112 True DMG)'] },
        eclipsenika: { fused: true, icon: '🌑☀️', name: 'Eclipse Sun God',   skills: ['Dawn Eclipse Fist (52 DMG)', 'Shadow Liberation (68 DMG)', 'Drum Pulse (Block 70% + 35 HP)', '🌑☀️ TOTAL ECLIPSE ULT (116 DMG + Stun)'] },
        mahavishnu:  { secret: true, icon: '🔱', name: 'Sammu/Samaksh (MahaVishnu)', skills: ['🪈 Prem Bansuri (65 DMG + Stun)', '☸️ Sudarshana Chakra (95 True DMG)', '🛡️ Vaikuntha Kavach (Evade +80 HP)', '🌌 Vishwaroopa ULT (160 True DMG + Stun)'] },
        millyyt:     { secret: true, icon: '🎬', name: 'Milly (YouTube Queen)',     skills: ['🔔 Subscribe Smash (46 DMG + Stun)', '📈 10M Viral Surge (64 DMG + 20 HP)', '💎 Diamond Shield (Evade +50 HP)', '▶️ Golden Play Button ULT (115 True DMG)'] },
        ishikastar:  { secret: true, icon: '✨', name: 'Ishika (Celestial Empress)', skills: ['💫 Starfall Beam (42 DMG)', '💥 Supernova Burst (58 DMG)', '🌸 Astral Blessing (Evade +45 HP)', '🌠 Empress Meteor ULT (96 DMG)'] },
        zoroking:    { secret: true, icon: '⚔️', name: 'Zoro (King of Hell)',      skills: ['Enma Purgatory (52 DMG)', 'Three-Sword Dragon (72 DMG)', 'Conqueror Haki (Evade +45 HP)', '👹 Dragon Damnation ULT (132 DMG)'] },
        antimpoke:   { secret: true, icon: '⚡', name: 'Antim (Astral Sky Sovereign)', skills: ['Dragon Ascent (50 DMG)', 'Judgment Beam (70 True DMG)', 'Multitype Plate (Block 85%)', '🐉 Sky Sovereign ULT (130 DMG)'] },
        mahadev:     { secret: true, icon: '🔱', name: 'Mahadev (Tandava Destroyer)', skills: ['Trishul Pierce (56 DMG)', 'Damru Cosmic Beat (74 DMG + Stun)', 'Kailash Meditation (+65 HP)', '🔥 Third Eye Tandava ULT (140 True DMG)'] }
      };

      const SV_PETS = [
        { id: 'mochi', name: '🐱 Mochi Spirit', desc: 'Scratches foe for +10 DMG/turn', cost: 200 },
        { id: 'tommy', name: '🐶 Tommy Guardian', desc: 'Heals you for +10 HP/turn', cost: 200 },
        { id: 'garuda', name: '🦅 Garuda Eagle', desc: 'Strikes for +22 DMG/turn', cost: 500 },
        { id: 'sheshnag', name: '🐍 Sheshnag Serpent', desc: '15% Block + 18 Poison/turn', cost: 2500 },
        { id: 'chimera', name: '🦁 Chimera Guardian [EVOLVED]', desc: '+24 DMG & +20 HP/turn (Merge Mochi+Tommy)', evolved: true },
        { id: 'ouroboros', name: '🐉 Cosmic Ouroboros [MYTHIC]', desc: '-18% DMG Taken, +42 DMG & +25 HP/turn', evolved: true }
      ];

      let selectedPower = 'fire', latestPlayers = [], sfxMuted = false, svAudio = null, cutAnimId = null, cutTimeout = null;
      let myProfile = { coins: 150, atkLv: 0, hpLv: 0, wins: 0, streak: 0, petEssence: 0, gears: { omegaCore: false, titanCrown: false }, adventure: { chapter: 1, stage: 1 }, hasStone: false, unlockedPowers: [], ownedPets: [], activePet: null, powerWins: {}, training: { fistLv: 0, bodyLv: 0, chiLv: 0, xp: 0 } };

      window.toggleSvSfx = function() { sfxMuted = !sfxMuted; const b = document.getElementById('svMuteBtn'); if (b) b.textContent = sfxMuted ? '🔇' : '🔊'; };

      function playSvSfx(type) {
        if (sfxMuted) return;
        try {
          if (!svAudio) svAudio = new (window.AudioContext || window.webkitAudioContext)();
          if (svAudio.state === 'suspended') svAudio.resume();
          const now = svAudio.currentTime;
          if (type === 'flute') {
            [523.25, 587.33, 659.25, 783.99, 880.00].forEach((freq, i) => {
              const o = svAudio.createOscillator(), g = svAudio.createGain();
              o.type = 'sine'; o.frequency.setValueAtTime(freq, now + i * 0.09);
              g.gain.setValueAtTime(0.01, now + i * 0.09); g.gain.linearRampToValueAtTime(0.18, now + i * 0.09 + 0.03); g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.22);
              o.connect(g); g.connect(svAudio.destination); o.start(now + i * 0.09); o.stop(now + i * 0.09 + 0.23);
            });
          } else if (type === 'ult' || type === 'awaken') {
            const o = svAudio.createOscillator(), g = svAudio.createGain();
            o.type = 'sawtooth'; o.frequency.setValueAtTime(type === 'awaken' ? 220 : 150, now); o.frequency.exponentialRampToValueAtTime(type === 'awaken' ? 920 : 28, now + 0.72);
            g.gain.setValueAtTime(0.35, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
            o.connect(g); g.connect(svAudio.destination); o.start(now); o.stop(now + 0.76);
          } else if (type === 'win') {
            [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
              const o = svAudio.createOscillator(), g = svAudio.createGain();
              o.type = 'triangle'; o.frequency.setValueAtTime(f, now + i * 0.08);
              g.gain.setValueAtTime(0.2, now + i * 0.08); g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
              o.connect(g); g.connect(svAudio.destination); o.start(now + i * 0.08); o.stop(now + i * 0.08 + 0.26);
            });
          } else {
            const o = svAudio.createOscillator(), g = svAudio.createGain();
            o.type = 'square'; o.frequency.setValueAtTime(320, now); o.frequency.exponentialRampToValueAtTime(65, now + 0.16);
            g.gain.setValueAtTime(0.22, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            o.connect(g); g.connect(svAudio.destination); o.start(now); o.stop(now + 0.19);
          }
        } catch (e) {}
      }
    `;
    // ============================================================================
    // 🎬 SAMMUVERSE V4 ENGINE — PIECE 16/20: CINEMA-GRADE 6-PHASE CUTSCENES
    // ============================================================================
    const SV_CLIENT_JS_PART2 = `
      window.skipSvCutscene = function() {
        if (cutAnimId) { cancelAnimationFrame(cutAnimId); cutAnimId = null; }
        if (cutTimeout) { clearTimeout(cutTimeout); cutTimeout = null; }
        const box = document.getElementById('svCutsceneBox');
        if (box) box.style.transform = 'none';
        const ov = document.getElementById('svCutsceneOverlay');
        if (ov) ov.style.display = 'none';
      };

      function playBloxFruitCutscene(data) {
        window.skipSvCutscene();
        const ov = document.getElementById('svCutsceneOverlay');
        const box = document.getElementById('svCutsceneBox');
        const c = document.getElementById('svCutsceneCanvas');
        const cap = document.getElementById('svCutsceneCaption');
        if (!ov || !c) return;

        ov.style.display = 'flex';
        cap.textContent = data.caption || '⚡ ULTIMATE TECHNIQUE!';
        playSvSfx(data.sfx || 'ult');

        const ctx = c.getContext('2d');
        const theme = data.theme || 'vishwaroopa';
        const paletteMap = {
          fire:        { c1: '#450a0a', c2: '#ea580c', pCol: '#fbbf24', rune: '炎' },
          water:       { c1: '#082f49', c2: '#0284c7', pCol: '#7dd3fc', rune: '水' },
          lightning:   { c1: '#1e1b4b', c2: '#ca8a04', pCol: '#fef08a', rune: '雷' },
          ice:         { c1: '#083344', c2: '#06b6d4', pCol: '#cffafe', rune: '氷' },
          zoro:        { c1: '#022c22', c2: '#15803d', pCol: '#4ade80', rune: '鬼' },
          moon:        { c1: '#1e1b4b', c2: '#be123c', pCol: '#fda4af', rune: '月' },
          chakra:      { c1: '#1e1b4b', c2: '#b45309', pCol: '#fde047', rune: '神' },
          bansuri:     { c1: '#064e3b', c2: '#0369a1', pCol: '#6ee7b7', rune: '愛' },
          milly:       { c1: '#450a0a', c2: '#eab308', pCol: '#fef08a', rune: '王' },
          awaken:      { c1: '#422006', c2: '#dc2626', pCol: '#fde047', rune: '極' },
          vishwaroopa: { c1: '#090d16', c2: '#7e22ce', pCol: '#e879f9', rune: '宇宙' }
        };
        const pal = paletteMap[theme] || paletteMap.vishwaroopa;

        // 120 high-velocity physics particles + orbiting energy sparks
        const particles = Array.from({ length: 120 }, () => {
          const ang = Math.random() * Math.PI * 2;
          const spd = Math.random() * 7.2 + 1.8;
          return {
            x: 210, y: 130,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            r: Math.random() * 4.5 + 1.2,
            alpha: 1
          };
        });

        let frame = 0;
        function drawFrame() {
          frame++;
          ctx.clearRect(0, 0, 420, 260);

          // Phase 1 (Frames 1-8): Manga Black-and-White Impact Strobe
          if (frame <= 8) {
            ctx.fillStyle = frame % 2 === 0 ? '#ffffff' : '#03050c';
            ctx.fillRect(0, 0, 420, 260);
            ctx.strokeStyle = frame % 2 === 0 ? '#000000' : '#facc15';
            ctx.lineWidth = 5;
            for (let i = 0; i < 40; i++) {
              const a = (i * Math.PI) / 20;
              ctx.beginPath();
              ctx.moveTo(210 + Math.cos(a) * 20, 130 + Math.sin(a) * 20);
              ctx.lineTo(210 + Math.cos(a) * 260, 130 + Math.sin(a) * 260);
              ctx.stroke();
            }
          } else {
            // Phase 2: Swirling Dimensional Vortex & Dual Shockwave Rings
            const grad = ctx.createRadialGradient(210, 130, 8, 210, 130, 235);
            grad.addColorStop(0, pal.c1);
            grad.addColorStop(0.65, pal.c2);
            grad.addColorStop(1, '#02040a');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 420, 260);

            // Rotating Anime Speed Lines
            ctx.strokeStyle = 'rgba(255,255,255,0.26)';
            ctx.lineWidth = 2;
            for (let i = 0; i < 36; i++) {
              const ang = (i * Math.PI / 18) + (frame * 0.065);
              const inner = 38 + Math.sin(frame * 0.18) * 12;
              ctx.beginPath();
              ctx.moveTo(210 + Math.cos(ang) * inner, 130 + Math.sin(ang) * inner);
              ctx.lineTo(210 + Math.cos(ang) * 260, 130 + Math.sin(ang) * 260);
              ctx.stroke();
            }

            // Dual Expanding Shockwave Rings
            [0, 80].forEach(offset => {
              const ringR = (((frame * 8) + offset) % 200) + 18;
              ctx.strokeStyle = pal.pCol;
              ctx.lineWidth = 3.5;
              ctx.globalAlpha = Math.max(0, 1 - ringR / 215);
              ctx.beginPath();
              ctx.arc(210, 130, ringR, 0, Math.PI * 2);
              ctx.stroke();
            });
            ctx.globalAlpha = 1;

            // Phase 3: Floating Giant Anime Kanji Watermark
            ctx.save();
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.font = '900 135px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pal.rune, 210, 132);
            ctx.restore();

            // Custom Elemental Centerpiece VFX
            if (theme === 'chakra') {
              ctx.save();
              ctx.translate(210, 130);
              ctx.rotate(frame * 0.36);
              ctx.strokeStyle = '#fde047';
              ctx.lineWidth = 6;
              ctx.beginPath();
              ctx.arc(0, 0, 56, 0, Math.PI * 2);
              ctx.stroke();
              for (let k = 0; k < 18; k++) {
                const a = (k * Math.PI) / 9;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a) * 56, Math.sin(a) * 56);
                ctx.lineTo(Math.cos(a + 0.24) * 84, Math.sin(a + 0.24) * 84);
                ctx.stroke();
              }
              ctx.restore();
            } else if (theme === 'zoro') {
              ctx.strokeStyle = '#4ade80';
              ctx.lineWidth = 8;
              ctx.shadowColor = '#22c55e';
              ctx.shadowBlur = 18;
              ctx.beginPath(); ctx.moveTo(25, 30); ctx.lineTo(395, 225); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(395, 30); ctx.lineTo(25, 225); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(210, 15); ctx.lineTo(210, 240); ctx.stroke();
              ctx.shadowBlur = 0;
            } else if (theme === 'lightning') {
              ctx.strokeStyle = '#fef08a';
              ctx.lineWidth = 4;
              for (let b = 0; b < 5; b++) {
                ctx.beginPath();
                let lx = 60 + b * 75, ly = 0;
                ctx.moveTo(lx, ly);
                for (let s = 0; s < 6; s++) {
                  lx += (Math.random() - 0.5) * 50;
                  ly += 44;
                  ctx.lineTo(lx, ly);
                }
                ctx.stroke();
              }
            }

            // Center Emoji Zoom + Aura Halo
            ctx.font = '66px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const zoom = Math.min(1.35, 0.45 + frame * 0.035) + Math.sin(frame * 0.35) * 0.12;
            ctx.save();
            ctx.translate(210, 128);
            ctx.scale(zoom, zoom);
            ctx.fillText(data.emoji || '⚡', 0, 0);
            ctx.restore();

            // Phase 4: 120-Particle Physics Explosion (after frame 20)
            if (frame > 20) {
              particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.07;
                p.alpha = Math.max(0, p.alpha - 0.013);
                ctx.fillStyle = pal.pCol;
                ctx.globalAlpha = p.alpha;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
              });
              ctx.globalAlpha = 1;
            }
          }

          // Phase 5: Letterbox Cinema Bars
          const barH = Math.min(22, frame * 2);
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, 420, barH);
          ctx.fillRect(0, 260 - barH, 420, barH);

          // Phase 6: Camera Shake & Chromatic Flash on Impact (Frames 44-62)
          if (box && frame >= 44 && frame <= 62) {
            const dx = (Math.random() - 0.5) * 16;
            const dy = (Math.random() - 0.5) * 16;
            box.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
          } else if (box) {
            box.style.transform = 'none';
          }
          if (frame === 46 || frame === 47) {
            ctx.fillStyle = 'rgba(255,255,255,0.92)';
            ctx.fillRect(0, 0, 420, 260);
          }

          // Comic Title Slam Banner
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 5;
          ctx.font = '900 20px Impact, sans-serif';
          ctx.textAlign = 'center';
          const title = (data.title || 'COSMIC IMPACT!').toUpperCase();
          ctx.strokeText(title, 210, 232);
          ctx.fillText(title, 210, 232);

          cutAnimId = requestAnimationFrame(drawFrame);
        }

        drawFrame();
        cutTimeout = setTimeout(window.skipSvCutscene, 2700);
      }
    `;
    // ============================================================================
    // 🎮 SAMMUVERSE V4 ENGINE — PIECE 17A/20: TABS, STORY MAP & POWER GRID
    // ============================================================================
    const SV_CLIENT_JS_PART3A = `
      const ADV_CHAPTERS_UI = [
        { ch: 1, title: '🌲 Ch.1: Whispering Dojo',   stages: ['🥷 Rogue Disciple', '🐺 Shadow Wolf', '👹 Dojo Sensei Boss'],     reward: '350🪙 • 200⚡ • 15🔮' },
        { ch: 2, title: '🌋 Ch.2: Crimson Volcano',   stages: ['🦎 Magma Salamander', '🔥 Flame Knight', '🐉 Magma Wyrm Boss'],     reward: '700🪙 • 450⚡ • 30🔮' },
        { ch: 3, title: '🌊 Ch.3: Abyssal Trench',    stages: ['🦈 Depth Stalker', '🐙 Kraken Tentacle', '🌊 Leviathan Boss'],      reward: '1.2k🪙 • 800⚡ • 50🔮' },
        { ch: 4, title: '⚡ Ch.4: Celestial Citadel', stages: ['🦅 Sky Valkyrie', '⚡ Thunder Golem', '👑 Raijin Sovereign Boss'],  reward: '2.2k🪙 • 1.4k⚡ • 80🔮' },
        { ch: 5, title: '🌌 Ch.5: Void Throne',       stages: ['🌑 Void Phantom', '🕳️ Singularity Knight', '🔱 Abyssal God Boss'],  reward: '5.0k🪙 • 3.0k⚡ • 150🔮' }
      ];

      window.openSammuVerseModal = function() {
        const mod = document.getElementById('svModal');
        if (!mod) return;
        mod.style.display = 'flex';
        renderSvPowers();
        renderAdventureMap();
        renderTrainingPanel();
        renderDojoShop();
        refreshOpponentDropdown();
        if (typeof socket !== 'undefined') {
          socket.emit('svGetStats');
          socket.emit('svRequestLogs');
        }
      };

      window.switchSvTab = function(tab) {
        ['fight', 'adv', 'train', 'dojo', 'logs'].forEach(t => {
          const tabBtn = document.getElementById('svTab' + t.charAt(0).toUpperCase() + t.slice(1));
          const panel = document.getElementById('sv' + t.charAt(0).toUpperCase() + t.slice(1) + 'Panel');
          if (tabBtn) tabBtn.classList.toggle('active', tab === t);
          if (panel) panel.style.display = tab === t ? 'block' : 'none';
        });
        if (tab === 'logs' && typeof socket !== 'undefined') socket.emit('svRequestLogs');
        if (tab === 'adv') renderAdventureMap();
        if (tab === 'train') renderTrainingPanel();
        if (tab === 'dojo') renderDojoShop();
      };

      function renderAdventureMap() {
        const box = document.getElementById('svAdventureChaptersList');
        const sum = document.getElementById('svAdvSummary');
        if (!box) return;
        const adv = myProfile.adventure || { chapter: 1, stage: 1, cleared: false };
        if (sum) {
          sum.textContent = (adv.cleared ? '👑 ALL 5 CHAPTERS CLEARED!' : ('Progress: Chapter ' + adv.chapter + ' — Stage ' + adv.stage + '/3')) + ' | Pet Essence: ' + (myProfile.petEssence || 0) + ' 🔮';
        }
        box.innerHTML = ADV_CHAPTERS_UI.map(c => {
          const unlocked = adv.cleared || adv.chapter >= c.ch;
          const isCur = !adv.cleared && adv.chapter === c.ch;
          const curStg = isCur ? adv.stage : (adv.chapter > c.ch || adv.cleared ? 3 : 1);
          const foeName = c.stages.at(curStg - 1) || c.stages.at(0);
          return '<div class="sv-shop-card" style="border-color:' + (isCur ? '#4ade80' : (unlocked ? '#38bdf8' : '#334155')) + ';">' +
            '<div><b style="color:' + (unlocked ? '#fde047' : '#94a3b8') + ';">' + c.title + '</b><br>' +
            '<span style="color:#cbd5e1;">' + (unlocked ? ('Stage ' + curStg + '/3: ' + foeName + ' • ' + c.reward) : '🔒 Clear Chapter ' + (c.ch - 1) + ' first') + '</span></div>' +
            '<button ' + (unlocked ? '' : 'disabled') + ' onclick="socket.emit(\\'svStartAdventure\\',{ch:' + c.ch + ',stg:' + curStg + ',power:selectedPower})" style="background:' + (isCur ? '#16a34a' : (unlocked ? '#0284c7' : '#334155')) + ';border:none;color:#fff;padding:6px 10px;border-radius:8px;font-weight:900;cursor:pointer;">' + (unlocked ? '⚔️ Play' : '🔒') + '</button></div>';
        }).join('');
      }

      function renderSvPowers() {
        const grid = document.getElementById('svPowerGrid');
        if (!grid) return;
        grid.innerHTML = '';

        const unlocked = myProfile.unlockedPowers || [];
        const pWins = myProfile.powerWins || {};

        if (Array.isArray(myProfile.customPowers)) {
          myProfile.customPowers.forEach(cp => {
            if (cp && cp.id && cp.def && !SV_POWERS[cp.id]) {
              SV_POWERS[cp.id] = {
                fused: true, icon: cp.def.icon, name: cp.def.name,
                skills: (cp.def.moves || []).map(m => m.label)
              };
            }
          });
        }

        Object.entries(SV_POWERS).forEach(([key, p]) => {
          if (p.secret && !unlocked.includes(key)) return;
          const isCoinLocked = p.cost && !unlocked.includes(key);
          const wins = pWins[key] || 0;
          const isV3 = wins >= 100;
          const isV2 = wins >= 5 && !isV3;

          const b = document.createElement('button');
          b.className = 'sv-pwr-btn' + (selectedPower === key ? ' selected' : '') + (isCoinLocked ? ' locked-coin' : '');
          if (p.secret || isV2 || isV3) b.style.borderColor = '#facc15';
          if (isV3) b.style.boxShadow = '0 0 10px rgba(250,204,21,0.55)';

          const verBadge = isV3 ? ' [V3 👑]' : (isV2 ? ' [V2]' : '');
          b.textContent = isCoinLocked ? ('🔒 ' + p.icon + ' ' + p.name + ' (' + p.cost + '🪙)') : (p.icon + ' ' + p.name + verBadge);

          b.onclick = () => {
            if (isCoinLocked) {
              if (confirm('Unlock ' + p.icon + ' ' + p.name + ' for ' + p.cost + ' Coins?')) socket.emit('svBuyPower', key);
              return;
            }
            selectedPower = key; window._curSvPow = key; renderSvPowers();
          };
          grid.appendChild(b);
        });

        const cur = SV_POWERS[selectedPower] || SV_POWERS.fire;
        const curWins = pWins[selectedPower] || 0;
        const verDesc = curWins >= 100 ? ' 👑 [V3 ASCENDED]' : (curWins >= 5 ? (' 🔥 [V2] (' + curWins + '/100 to V3)') : (' (' + curWins + '/5 wins to V2)'));
        const prev = document.getElementById('svPowerPreview');
        if (prev) prev.innerHTML = '<b>' + cur.icon + ' ' + cur.name + verDesc + ':</b><br>' + cur.skills.join(' • ');
      }
    `;
    // ============================================================================
    // 🎮 SAMMUVERSE V4 ENGINE — PIECE 17B/20: TRAINING & DOJO SHOP RENDERERS
    // ============================================================================
    const SV_CLIENT_JS_PART3B = `
      function renderTrainingPanel() {
        const tr = myProfile.training || { fistLv: 0, bodyLv: 0, chiLv: 0, xp: 0 };
        const fLv = Number(tr.fistLv) || 0, bLv = Number(tr.bodyLv) || 0, cLv = Number(tr.chiLv) || 0;
        const sum = document.getElementById('svTrainSummary');
        if (sum) sum.textContent = 'Total Mastery: ' + (fLv + bLv + cLv).toLocaleString() + ' | Available XP: ' + (tr.xp || 0).toLocaleString() + ' ⚡';

        const bonusDmg = fLv >= 100000 ? Math.round(150 + Math.log10(fLv) * 45) : Math.min(350, fLv * 3);
        const bonusHp  = bLv >= 100000 ? Math.round(900 + Math.log10(bLv) * 250) : Math.min(2000, bLv * 20);
        const ultPct   = cLv >= 100000 ? 85 : Math.min(80, cLv * 4);
        const critPct  = cLv >= 100000 ? 50 : Math.min(45, cLv);

        const fd = document.getElementById('svFistDesc'); if (fd) fd.textContent = 'Lv.' + fLv.toLocaleString() + ' (+' + bonusDmg + ' Permanent DMG)';
        const bd = document.getElementById('svBodyDesc'); if (bd) bd.textContent = 'Lv.' + bLv.toLocaleString() + ' (+' + bonusHp + ' Permanent HP)';
        const cd = document.getElementById('svChiDesc');  if (cd) cd.textContent = 'Lv.' + cLv.toLocaleString() + ' (+' + ultPct + '% ULT & ' + critPct + '% Crit)';
        const fBtn = document.getElementById('svUpFistBtn'); if (fBtn) fBtn.textContent = (100 + Math.floor(fLv * 25)).toLocaleString() + ' XP';
        const bBtn = document.getElementById('svUpBodyBtn'); if (bBtn) bBtn.textContent = (100 + Math.floor(bLv * 25)).toLocaleString() + ' XP';
        const cBtn = document.getElementById('svUpChiBtn');  if (cBtn) cBtn.textContent = (100 + Math.floor(cLv * 25)).toLocaleString() + ' XP';
      }

      function renderDojoShop() {
        const hc = document.getElementById('svHeaderCoins');
        if (hc) hc.textContent = '🪙 ' + (myProfile.coins || 0).toLocaleString();
        const rb = document.getElementById('svRankBanner');
        if (rb) rb.textContent = 'Wins: ' + (myProfile.wins || 0) + ' | Pet Essence: ' + (myProfile.petEssence || 0) + '🔮 | Tower Best: F' + (myProfile.maxTowerFloor || 1);

        const omBtn = document.getElementById('svGearOmegaBtn');
        if (omBtn) { omBtn.textContent = myProfile.gears?.omegaCore ? 'FORGED ✅' : '10,000🪙'; omBtn.disabled = Boolean(myProfile.gears?.omegaCore); }
        const tiBtn = document.getElementById('svGearTitanBtn');
        if (tiBtn) { tiBtn.textContent = myProfile.gears?.titanCrown ? 'FORGED ✅' : '25,000🪙'; tiBtn.disabled = Boolean(myProfile.gears?.titanCrown); }

        document.getElementById('svAtkDesc').textContent = 'Lv.' + (myProfile.atkLv || 0) + '/15 (+' + ((myProfile.atkLv || 0) * 5) + ' Bonus DMG)';
        document.getElementById('svBuyAtkBtn').textContent = (myProfile.atkLv || 0) >= 15 ? 'MAX' : '150🪙';
        document.getElementById('svHpDesc').textContent = 'Lv.' + (myProfile.hpLv || 0) + '/15 (+' + ((myProfile.hpLv || 0) * 25) + ' Bonus HP)';
        document.getElementById('svBuyHpBtn').textContent = (myProfile.hpLv || 0) >= 15 ? 'MAX' : '150🪙';
        document.getElementById('svBuyStoneBtn').textContent = myProfile.hasStone ? 'OWNED ✅' : '1000🪙';
        document.getElementById('svBuyStoneBtn').disabled = Boolean(myProfile.hasStone);

        const list = Array.isArray(myProfile.customPowers) ? myProfile.customPowers : [];
        const tiers = new Array(50000, 250000, 750000, 1500000);
        const nextCost = list.length < tiers.length ? tiers.at(list.length) : (tiers.at(-1) + ((list.length - tiers.length + 1) * 1000000));
        const fBtn = document.getElementById('svForgeBtn');
        if (fBtn) {
          fBtn.textContent = (myProfile.freeFusionPasses || 0) > 0
            ? ('⚗️ Forge Fusion #' + (list.length + 1) + ' (FREE PASS ✅)')
            : ('⚗️ Forge Fusion #' + (list.length + 1) + ' (' + nextCost.toLocaleString() + '🪙)');
        }

        const s1 = document.getElementById('svFuseP1'), s2 = document.getElementById('svFuseP2');
        if (s1 && s2 && s1.options.length === 0) {
          const owned = new Set(['fire', 'water', 'lightning', 'ice', ...(myProfile.unlockedPowers || [])]);
          Object.entries(SV_POWERS).forEach(([k, v]) => {
            if (owned.has(k)) { s1.add(new Option(v.icon + ' ' + v.name, k)); s2.add(new Option(v.icon + ' ' + v.name, k)); }
          });
          if (s2.options.length > 1) s2.selectedIndex = 1;
        }

        const cBtn = document.getElementById('svMergeChimeraBtn');
        if (cBtn && (myProfile.ownedPets || []).includes('chimera')) { cBtn.textContent = 'EVOLVED ✅'; cBtn.disabled = true; }
        const oBtn = document.getElementById('svMergeOuroBtn');
        if (oBtn && (myProfile.ownedPets || []).includes('ouroboros')) { oBtn.textContent = 'EVOLVED ✅'; oBtn.disabled = true; }

        const petBox = document.getElementById('svPetShopList');
        if (!petBox) return;
        petBox.innerHTML = '';
        SV_PETS.forEach(pet => {
          const owned = (myProfile.ownedPets || []).includes(pet.id);
          if (pet.evolved && !owned) return;
          const active = myProfile.activePet === pet.id;
          const row = document.createElement('div');
          row.className = 'sv-shop-card';
          row.innerHTML = '<div><b>' + pet.name + '</b><br><span style="color:#cbd5e1;">' + pet.desc + '</span></div>';
          const btn = document.createElement('button');
          btn.style.cssText = 'background:' + (active ? '#16a34a' : (owned ? '#0284c7' : '#7c3aed')) + ';border:none;color:#fff;padding:6px 10px;border-radius:8px;font-weight:900;cursor:pointer;';
          btn.textContent = active ? 'EQUIPPED ✅' : (owned ? 'EQUIP' : pet.cost + '🪙');
          btn.onclick = () => socket.emit('svPetAction', pet.id);
          row.appendChild(btn);
          petBox.appendChild(row);
        });
      }
    `;
    // ============================================================================
    // 🎡 SAMMUVERSE V4 ENGINE — PIECE 18A/20: LINEAGES, TITLES & DAILY WHEEL UI
    // ============================================================================
    const SV_CLIENT_JS_PART4A = `
      const LINEAGE_UI_INFO = {
        human:     { icon: '🧑', name: 'Mortal Explorer',       stage3: '👑 Ascendant Hero',       perk: 'Balanced Starter' },
        slime:     { icon: '🟢', name: 'Primordial Void Slime', stage3: '🟢 Void Sovereign Slime', perk: '+14 HP/Turn Regen & 12% DMG Absorb' },
        ape:       { icon: '🐵', name: 'Astral Ape Warrior',    stage3: '⚡ Super Astral God',     perk: '+22% Surge Strike DMG' },
        reaper:    { icon: '👻', name: 'Phantom Soul Reaper',   stage3: '⚔️ Eclipse Bankai',       perk: '+18% Slash DMG & 5% Soul Drain' },
        demon:     { icon: '😈', name: 'Infernal Demonkin',     stage3: '🔥 Abyssal Overlord',     perk: '+10% DMG & 16% Lifesteal' },
        dragonkin: { icon: '🐉', name: 'Ancient Dragonkin',     stage3: '🐲 Cosmic Wyrm King',     perk: '+8 HP/Turn, +15% DMG & 8% Absorb' },
        celestial: { icon: '🔱', name: 'Celestial Avatar',      stage3: '🔱 Supreme Cosmic Deity', perk: '+25% DMG, +12 HP/Turn, Stun Immune' }
      };

      const TITLE_UI_LIST = [
        { id: 'rookie',     tag: '🌱 Rookie',           color: '#94a3b8', req: 'Default Starter' },
        { id: 'hunter',     tag: '⚔️ Bounty Hunter',    color: '#38bdf8', req: '1.0M Bounty' },
        { id: 'warlord',    tag: '🏴‍☠️ Warlord',          color: '#a855f7', req: '2.5M Bounty' },
        { id: 'emperor',    tag: '💀 Abyss Emperor',    color: '#f43f5e', req: '10.0M Bounty' },
        { id: 'sovereign',  tag: '👑 Sammu Sovereign',  color: '#facc15', req: '30.0M Bounty' },
        { id: 'v3god',      tag: '🔥 V3 Ascended',      color: '#fb923c', req: '100 Wins (V3)' },
        { id: 'omegagod',   tag: '⚡ Omega Awakened',   color: '#38bdf8', req: 'Omega Core Gear' },
        { id: 'titanlord',  tag: '🌌 Colossal Titan',   color: '#f43f5e', req: 'Titan Crown Gear' },
        { id: 'adventurer', tag: '🗺️ Realm Conqueror',  color: '#4ade80', req: 'Clear Story Ch.5' },
        { id: 'petmaster',  tag: '🐉 Ouroboros Tamer',  color: '#e879f9', req: 'Merge Evolved Pet' },
        { id: 'voidslime',  tag: '🟢 Void Slime King',  color: '#4ade80', req: 'Void Slime Stage 3' },
        { id: 'gymgod',     tag: '🏋️ Gym Sovereign',    color: '#fb923c', req: 'Training Level 50' },
        { id: 'godly',      tag: '✨ Godly Enchanted',  color: '#67e8f9', req: 'Godly Enchant' },
        { id: 'forger',     tag: '⚗️ Soul Forger',      color: '#e879f9', req: 'Custom Fusion' },
        { id: 'vishnu',     tag: '🔱 MahaVishnu',       color: '#fde047', req: 'MahaVishnu Power' },
        { id: 'lunaremp',   tag: '🌙 Lunar Empress',    color: '#fda4af', req: 'Dr. Moon Power' },
        { id: 'tower25',    tag: '🗼 Tower Climber',    color: '#38bdf8', req: 'Tower Floor 25' },
        { id: 'tower50',    tag: '♾️ Infinite Sovereign',color: '#e879f9', req: 'Tower Floor 50' },
        { id: 'tower100',   tag: '🌌 Floor 100 God',    color: '#facc15', req: 'Tower Floor 100' },
        { id: 'rich',       tag: '💎 Millionaire',      color: '#4ade80', req: '100,000+ Coins' }
      ];

      window._svLatestStock = { items: [], minsLeft: 60 };
      window._svTowerTop = [];

      window.openDailyWheelModal = function() {
        const modal = document.getElementById('svSubModal');
        const title = document.getElementById('svSubTitle');
        const body = document.getElementById('svSubBody');
        if (!modal) return;
        modal.style.display = 'flex';
        title.textContent = '🎡 COSMIC DAILY LUCKY WHEEL';
        const freeReady = (Date.now() - (myProfile.lastDailySpin || 0)) >= 86400000;
        body.innerHTML =
          '<div id="svWheelDisc" style="width:170px;height:170px;margin:6px auto 12px;border-radius:50%;border:5px solid #facc15;background:conic-gradient(#dc2626 0deg 60deg,#0284c7 60deg 120deg,#16a34a 120deg 180deg,#7c3aed 180deg 240deg,#d97706 240deg 300deg,#ec4899 300deg 360deg);display:flex;align-items:center;justify-content:center;font-size:38px;box-shadow:0 0 28px rgba(250,204,21,0.6);transition:transform 2.2s cubic-bezier(0.15,0.85,0.25,1);">🎡</div>' +
          '<div id="svWheelResultText" style="font-size:12px;font-weight:900;color:#fde047;margin-bottom:10px;">Win Coins, Training XP, Pet Essence, or 15,000🪙 Jackpot!</div>' +
          '<div style="display:flex;gap:6px;">' +
            '<button onclick="socket.emit(\\'svDailyWheelSpin\\',{paid:false})" style="flex:1;padding:10px;border:none;border-radius:10px;background:' + (freeReady ? '#16a34a' : '#334155') + ';color:#fff;font-weight:900;font-size:11px;cursor:pointer;">🎁 Free Daily Spin</button>' +
            '<button onclick="socket.emit(\\'svDailyWheelSpin\\',{paid:true})" style="flex:1;padding:10px;border:none;border-radius:10px;background:linear-gradient(90deg,#ec4899,#8b5cf6);color:#fff;font-weight:900;font-size:11px;cursor:pointer;">💎 Cosmic Spin (500🪙)</button>' +
          '</div>';
      };
    `;
    // ============================================================================
    // 🎡 SAMMUVERSE V4 ENGINE — PIECE 18B/20: SUB-MODALS, TOWER & HELPERS
    // ============================================================================
    const SV_CLIENT_JS_PART4B = `
      window.openSvSub = function(mode) {
        const modal = document.getElementById('svSubModal');
        const title = document.getElementById('svSubTitle');
        const body = document.getElementById('svSubBody');
        if (!modal) return;
        modal.style.display = 'flex';

        if (mode === 'lineage') {
          const lin = LINEAGE_UI_INFO[myProfile.lineage || 'human'] || LINEAGE_UI_INFO.human;
          const stg = myProfile.lineageStage || 1;
          const evoCost = stg === 1 ? '2,500🪙' : (stg === 2 ? '6,000🪙' : 'MAXED ✅');
          title.textContent = '🧬 GENETIC LINEAGE AWAKENING';
          body.innerHTML =
            '<div style="background:#1e293b;border:1.5px solid #4ade80;border-radius:12px;padding:10px;margin-bottom:8px;">' +
              '<div style="font-size:15px;font-weight:900;color:#4ade80;">' + (stg === 3 ? lin.stage3 : (lin.icon + ' ' + lin.name)) + ' (Stage ' + stg + '/3)</div>' +
              '<div style="font-size:11px;color:#fde047;margin-top:4px;">Passive: ' + lin.perk + '</div>' +
            '</div>' +
            '<div style="display:flex;gap:6px;">' +
              '<button onclick="socket.emit(\\'svSpinLineage\\')" style="flex:1;padding:9px;border:none;border-radius:10px;background:#7c3aed;color:#fff;font-weight:900;font-size:11px;cursor:pointer;">🎲 Reroll (1,000🪙)</button>' +
              '<button ' + (stg >= 3 ? 'disabled' : '') + ' onclick="socket.emit(\\'svEvolveLineage\\')" style="flex:1;padding:9px;border:none;border-radius:10px;background:#16a34a;color:#fff;font-weight:900;font-size:11px;cursor:pointer;">⚡ Evolve (' + evoCost + ')</button>' +
            '</div>';
        } else if (mode === 'titles') {
          const bFmt = (myProfile.bounty || 10000) >= 1000000 ? ((myProfile.bounty / 1000000).toFixed(2) + 'M') : (Math.round((myProfile.bounty || 10000) / 1000) + 'K');
          title.textContent = '🏷️ TITLES & BOUNTY: ' + bFmt;
          body.innerHTML = TITLE_UI_LIST.map(t => {
            const unlocked = (myProfile.unlockedTitles || ['rookie']).includes(t.id);
            const equipped = myProfile.activeTitle === t.id;
            return '<div style="display:flex;justify-content:space-between;align-items:center;background:#1e293b;border:1.5px solid ' + (equipped ? '#facc15' : '#334155') + ';border-radius:10px;padding:7px 9px;margin-bottom:6px;font-size:11px;">' +
              '<div style="text-align:left;"><b style="color:' + t.color + ';">[' + t.tag + ']</b><br><span style="color:#94a3b8;">' + t.req + '</span></div>' +
              '<button ' + (unlocked ? '' : 'disabled') + ' onclick="socket.emit(\\'svEquipTitle\\',\\'' + t.id + '\\');document.getElementById(\\'svSubModal\\').style.display=\\'none\\';" style="background:' + (equipped ? '#16a34a' : (unlocked ? '#0284c7' : '#334155')) + ';border:none;color:#fff;padding:5px 10px;border-radius:8px;font-weight:bold;cursor:pointer;">' + (equipped ? 'EQUIPPED' : (unlocked ? 'Equip' : '🔒')) + '</button></div>';
          }).join('');
        } else if (mode === 'stock') {
          const st = window._svLatestStock;
          title.textContent = '🎰 HOURLY STOCK (' + st.minsLeft + 'm left)';
          socket.emit('svGetStock');
          body.innerHTML = (st.items || []).map(it =>
            '<div style="display:flex;justify-content:space-between;align-items:center;background:#1e293b;border:1px solid #38bdf8;border-radius:10px;padding:8px;margin-bottom:6px;font-size:12px;">' +
            '<span><b>' + it.icon + ' ' + it.name + '</b></span>' +
            '<button onclick="socket.emit(\\'svBuyStockItem\\',\\'' + it.key + '\\')" style="background:#16a34a;border:none;color:#fff;padding:6px 10px;border-radius:8px;font-weight:900;cursor:pointer;">' + it.price.toLocaleString() + '🪙</button></div>'
          ).join('') || '<div style="font-size:12px;color:#94a3b8;">Loading stock...</div>';
        }
      };

      window.openEndlessTowerModal = function() {
        const modal = document.getElementById('svSubModal');
        const title = document.getElementById('svSubTitle');
        const body = document.getElementById('svSubBody');
        if (!modal) return;
        modal.style.display = 'flex';
        if (typeof socket !== 'undefined') socket.emit('svGetTowerLeaderboard');

        const best = myProfile.maxTowerFloor || 1;
        const chk = Math.max(1, myProfile.towerCheckpoint || 1);
        title.textContent = '♾️ ENDLESS ASCENSION TOWER';

        const boardHtml = (window._svTowerTop || []).map((r, i) =>
          '<div style="display:flex;justify-content:space-between;padding:4px 6px;border-bottom:1px solid #334155;">' +
            '<span>' + (i === 0 ? '👑 ' : '#' + (i + 1) + ' ') + r.name + '</span>' +
            '<b style="color:#38bdf8;">Floor ' + r.floor + '</b>' +
          '</div>'
        ).join('') || '<div style="color:#94a3b8;">Be the first to climb!</div>';

        body.innerHTML =
          '<div style="background:#1e293b;border:1.5px solid #38bdf8;border-radius:12px;padding:10px;margin-bottom:8px;">' +
            '<div style="font-size:14px;font-weight:900;color:#fde047;">🏆 Your Best: Floor ' + best + ' | 📍 Checkpoint: Floor ' + chk + '</div>' +
            '<div style="font-size:11px;color:#cbd5e1;margin-top:4px;">F25: +10k🪙 | F50: ⚡ Omega & Titan Gear Forge Unlocked! | F100: +50k🪙</div>' +
          '</div>' +
          '<div style="display:flex;gap:6px;margin-bottom:10px;">' +
            '<button onclick="document.getElementById(\\'svSubModal\\').style.display=\\'none\\';socket.emit(\\'svTowerEnter\\',{startFromCheckpoint:true});" style="flex:2;padding:10px;border:none;border-radius:10px;background:linear-gradient(90deg,#0284c7,#7c3aed);color:#fff;font-weight:900;font-size:12px;cursor:pointer;">🚀 Resume Floor ' + chk + '</button>' +
            '<button onclick="document.getElementById(\\'svSubModal\\').style.display=\\'none\\';socket.emit(\\'svTowerEnter\\',{startFromCheckpoint:false});" style="flex:1;padding:10px;border:1px solid #64748b;border-radius:10px;background:#0f172a;color:#fff;font-weight:bold;font-size:11px;cursor:pointer;">🔄 Floor 1</button>' +
          '</div>' +
          '<div style="background:#090d16;border:1px solid #475569;border-radius:10px;padding:8px;font-size:11px;text-align:left;">' +
            '<div style="font-weight:900;color:#facc15;margin-bottom:4px;">🏅 SERVER TOWER LEADERBOARD:</div>' + boardHtml +
          '</div>';
      };

      function refreshOpponentDropdown() {
        const sel = document.getElementById('svOpponentSelect');
        if (!sel) return;
        const prev = sel.value;
        sel.innerHTML = '<option value="BOT_DUMMY">🥊 Wooden Dummy (+35🪙)</option><option value="BOT_SENSEI">🤖 Bot Sensei (+65🪙)</option><option value="BOT_DEMON">👹 Demon Overlord (+140🪙)</option>';
        latestPlayers.forEach(p => {
          if (typeof socket !== 'undefined' && p.id !== socket.id) {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = '🥷 ' + p.username + ' (PvP +150🪙)';
            sel.appendChild(opt);
          }
        });
        if (Array.from(sel.options).some(o => o.value === prev)) sel.value = prev;
      }

      window.buySvItem = (item) => { if (typeof socket !== 'undefined') socket.emit('svUpgradeStat', item); };
      window.sendSvChallenge = () => { if (typeof socket !== 'undefined') socket.emit('svChallenge', { targetId: document.getElementById('svOpponentSelect').value, power: selectedPower }); };
      window.redeemSvSecretCode = () => {
        const inp = document.getElementById('svSecretCodeInput');
        if (inp && inp.value.trim() && typeof socket !== 'undefined') {
          socket.emit('svUnlockCode', inp.value.trim());
          inp.value = '';
        }
      };
    `;
    // ============================================================================
    // 🚀 SAMMUVERSE V4 ENGINE — PIECE 19/20: BATTLE HUD, WHEEL & TRANSFORM BUTTONS
    // ============================================================================
    const SV_CLIENT_JS_PART5 = `
      socket.on('svCutscene', (d) => {
        if (!d._serverId || !window.selectedServerId || d._serverId === window.selectedServerId) {
          playBloxFruitCutscene(d);
        }
      });

      socket.on('svStatsSync', (st) => {
        if (st) {
          myProfile = st;
          window._latestSvProf = st;
          renderSvPowers();
          renderAdventureMap();
          renderTrainingPanel();
          renderDojoShop();
        }
      });

      socket.on('svWheelResult', ({ prize, profile }) => {
        if (profile) { myProfile = profile; window._latestSvProf = profile; renderDojoShop(); }
        const disc = document.getElementById('svWheelDisc');
        const txt = document.getElementById('svWheelResultText');
        if (disc) disc.style.transform = 'rotate(' + (1440 + ((prize?.idx || 0) * 60)) + 'deg)';
        playSvSfx('win');
        setTimeout(() => {
          if (txt && prize) txt.textContent = '🎉 WON: ' + prize.label;
        }, 2200);
      });

      socket.on('svNotice', (msg) => { playSvSfx('win'); alert(msg); });
      socket.on('svStockSync', (st) => { if (st) window._svLatestStock = st; });
      socket.on('svTowerLeaderboardSync', (list) => { window._svTowerTop = list || []; });
      socket.on('updatePlayers', (list) => { if (Array.isArray(list)) { latestPlayers = list; refreshOpponentDropdown(); } });

      socket.on('svDomainClashStart', (d) => {
        const sub = document.getElementById('svClashSub');
        const mod = document.getElementById('svDomainClashModal');
        if (sub) sub.textContent = 'Clashing Ultimates against ' + (d.oppName || 'Rival') + '!';
        if (mod) mod.style.display = 'flex';
      });

      socket.on('svDomainClashEnd', () => {
        const mod = document.getElementById('svDomainClashModal');
        if (mod) mod.style.display = 'none';
      });

      socket.on('svIncomingChallenge', (d) => {
        if (d._serverId && window.selectedServerId && d._serverId !== window.selectedServerId) return;
        document.getElementById('svModal').style.display = 'flex';
        switchSvTab('fight');
        const box = document.getElementById('svIncomingBox');
        box.style.display = 'block';
        box.innerHTML = '<div style="font-size:12px;font-weight:900;color:#fde047;margin-bottom:6px;">⚔️ ' + d.fromName + ' (' + d.fromPowerLabel + ') challenged you!</div>' +
          '<button id="svAcceptBtnNow" style="background:#16a34a;border:none;color:#fff;padding:7px 14px;border-radius:9px;font-weight:900;font-size:12px;cursor:pointer;">🔥 Accept with Selected Power!</button>';
        document.getElementById('svAcceptBtnNow').onclick = () => {
          box.style.display = 'none';
          socket.emit('svAccept', { challengerId: d.fromId, power: selectedPower });
        };
      });

      socket.on('svBattleSync', (b) => {
        if (b._serverId && window.selectedServerId && b._serverId !== window.selectedServerId) return;
        if (b.sfx) playSvSfx(b.sfx);
        document.getElementById('svModal').style.display = 'flex';
        document.getElementById('svLobbyView').style.display = 'none';
        document.getElementById('svBattleView').style.display = 'block';

        document.getElementById('svTurnBadge').textContent = 'Turn ' + b.turn + ' • Energy: ' + (b.me.energy || 0) + '%⚡';
        document.getElementById('svBattleTimer').textContent = '⏳ ' + b.timeLeft + 's';
        document.getElementById('svMeLabel').textContent = b.me.icon + ' ' + b.me.name + ' (' + b.me.powerName + ')';
        document.getElementById('svMeHpText').textContent = b.me.hp + ' / ' + b.me.maxHp + ' HP';
        const meBar = document.getElementById('svMeHpBar');
        meBar.style.width = Math.max(0, Math.round((b.me.hp / b.me.maxHp) * 100)) + '%';
        meBar.classList.toggle('awakened', Boolean(b.me.awakened || b.me.omegaTurns > 0 || b.me.titanTurns > 0));

        document.getElementById('svOppLabel').textContent = b.opp.icon + ' ' + b.opp.name + ' (' + b.opp.powerName + ')';
        document.getElementById('svOppHpText').textContent = b.opp.hp + ' / ' + b.opp.maxHp + ' HP';
        const oppBar = document.getElementById('svOppHpBar');
        oppBar.style.width = Math.max(0, Math.round((b.opp.hp / b.opp.maxHp) * 100)) + '%';
        oppBar.classList.toggle('awakened', Boolean(b.opp.awakened));

        const tBar = document.getElementById('svTransformBar');
        if (tBar) {
          tBar.innerHTML = '';
          if (b.me.hasOmegaGear && !b.me.omegaUsed) {
            const oBtn = document.createElement('button');
            oBtn.disabled = (b.me.energy || 0) < 50;
            oBtn.style.cssText = 'flex:1;padding:6px;border:1.5px solid #38bdf8;border-radius:9px;background:linear-gradient(90deg,#0284c7,#6366f1);color:#fff;font-weight:900;font-size:10px;cursor:pointer;opacity:' + ((b.me.energy || 0) >= 50 ? '1' : '0.45') + ';';
            oBtn.textContent = '⚡ OMEGA EVOLVE (50%⚡)';
            oBtn.onclick = () => socket.emit('svTransform', 'omega');
            tBar.appendChild(oBtn);
          }
          if (b.me.hasTitanGear && !b.me.titanUsed) {
            const tiBtn = document.createElement('button');
            tiBtn.disabled = (b.me.energy || 0) < 75;
            tiBtn.style.cssText = 'flex:1;padding:6px;border:1.5px solid #facc15;border-radius:9px;background:linear-gradient(90deg,#dc2626,#9333ea);color:#fff;font-weight:900;font-size:10px;cursor:pointer;opacity:' + ((b.me.energy || 0) >= 75 ? '1' : '0.45') + ';';
            tiBtn.textContent = '🌌 TITAN FORM (75%⚡)';
            tiBtn.onclick = () => socket.emit('svTransform', 'titan');
            tBar.appendChild(tiBtn);
          }
        }

        document.getElementById('svCombatFeed').innerHTML = b.logText;
        const skBox = document.getElementById('svSkillButtons');
        skBox.innerHTML = '';

        b.me.skills.forEach((sk, idx) => {
          const btn = document.createElement('button');
          btn.className = 'sv-skill-btn' + (idx === 3 ? ' ult' : '');
          const onCd = (idx === 3 && b.me.ultCd > 0);
          btn.disabled = b.me.locked || b.me.stunned || onCd;
          btn.textContent = onCd ? (sk + ' [CD: ' + b.me.ultCd + 't]') : (b.me.stunned ? '❄️ STUNNED!' : sk);
          btn.onclick = () => {
            playSvSfx(idx === 3 ? 'ult' : (idx === 2 ? 'shield' : (b.me.powerKey === 'mahavishnu' && idx === 0 ? 'flute' : 'atk')));
            socket.emit('svUseSkill', idx);
          };
          skBox.appendChild(btn);
        });

        const isVishnu = b.me.powerKey === 'mahavishnu' || String(b.me.icon || '').includes('🔱');
        if (isVishnu && !b.me.isBotOpp) {
          const loveBtn = document.createElement('button');
          loveBtn.className = 'sv-skill-btn';
          loveBtn.style.cssText = 'grid-column:span 2;background:linear-gradient(90deg,#be185d,#9333ea);border:1.5px solid #f9a8d4;text-align:center;';
          loveBtn.textContent = '💖🪈 Prem Samarpan (Surrender to Love — Gift Sibling Win + 250🪙)';
          loveBtn.onclick = () => socket.emit('svSurrenderToLove');
          skBox.appendChild(loveBtn);
        }
      });

      socket.on('svBattleEnd', (res) => {
        if (res._serverId && window.selectedServerId && res._serverId !== window.selectedServerId) return;
        if (res.won) playSvSfx('win');
        document.getElementById('svBattleView').style.display = 'none';
        document.getElementById('svLobbyView').style.display = 'block';
        socket.emit('svGetStats');
        switchSvTab('logs');
      });

      socket.on('svLogsUpdate', (logs) => {
        const box = document.getElementById('svLogList');
        if (!box) return;
        if (!Array.isArray(logs) || logs.length === 0) {
          box.innerHTML = '<div style="padding:12px;color:#94a3b8;">No SammuVerse battles registered yet! ⚔️</div>';
          return;
        }
        box.innerHTML = logs.map(l => '<div class="sv-log-item">🏆 <b>' + l.winner + '</b> (' + l.winPower + ') defeated <b>' + l.loser + '</b> (' + l.losePower + ') <span style="color:#94a3b8;float:right;">' + l.time + '</span></div>').join('');
      });
    `;
    // ============================================================================
    // 🚀 SAMMUVERSE V4 ENGINE — PIECE 20/20: BOOTLOADER & SERVER BUNDLE DELIVERY
    // ============================================================================
    const SV_CLIENT_ALL_JS = [
        SV_CLIENT_JS_PART1,
        SV_CLIENT_JS_PART2,
        SV_CLIENT_JS_PART3A,
        SV_CLIENT_JS_PART3B,
        SV_CLIENT_JS_PART4A,
        SV_CLIENT_JS_PART4B,
        SV_CLIENT_JS_PART5
    ].join('\n');

    const SV_PAGE_BOOT_TAG = `
    <script>
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
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (false && typeof body === 'string' && !body.includes('_svBootLoaded')) {
                body = body.replace('</body>', SV_PAGE_BOOT_TAG + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });

    io.on('connection', (socket) => {
        const deliverV4 = () => {
            socket.emit('svDeliverCleanV4', {
                html: SV_FULL_BUNDLE,
                js: SV_CLIENT_ALL_JS
            });
        };
        socket.on('svRequestCleanV4', deliverV4);
        socket.on('joinRoom', () => setTimeout(deliverV4, 400));
    });
    // ============================================================================
    // ☁️ CLOUD SAVE PROTECTION + !RICHEST & !GIFTCARD RESTORE
    // ============================================================================
    let cloudRestoreCompleted = false;

    const _guardedSaveSvStats = saveSvStats;
    saveSvStats = function() {
        try { fs.writeFileSync(SV_STATS_FILE, JSON.stringify(svPlayerStats, null, 2)); } catch (e) {}
        if (cloudRestoreCompleted && UPSTASH_URL && UPSTASH_TOKEN) {
            upstashCmd(['SET', 'sammu_sv_stats', JSON.stringify(svPlayerStats)]);
        }
    };

    const _guardedSaveEco = saveEconomyDB;
    saveEconomyDB = function() {
        try {
            fs.writeFileSync(ECONOMY_DB_FILE, JSON.stringify({
                wallets: Object.fromEntries(playerWallet),
                cards: Object.fromEntries(playerCards)
            }, null, 2));
        } catch (e) {}
        if (cloudRestoreCompleted && UPSTASH_URL && UPSTASH_TOKEN) {
            upstashCmd(['SET', 'sammu_economy', JSON.stringify({
                wallets: Object.fromEntries(playerWallet),
                cards: Object.fromEntries(playerCards)
            })]);
        }
    };

    async function forcePullFromUpstash() {
        if (!UPSTASH_URL || !UPSTASH_TOKEN) return false;
        const rawStats = await upstashCmd(['GET', 'sammu_sv_stats']);
        if (rawStats) {
            try {
                const parsed = JSON.parse(rawStats);
                Object.entries(parsed).forEach(([k, v]) => {
                    svPlayerStats[k.toLowerCase()] = v;
                    if (Array.isArray(v.customPowers)) {
                        v.customPowers.forEach(cp => { if (cp && cp.id && cp.def) SV_DEFS[cp.id] = cp.def; });
                    }
                });
            } catch (e) {}
        }
        const rawEco = await upstashCmd(['GET', 'sammu_economy']);
        if (rawEco) {
            try {
                const eco = JSON.parse(rawEco);
                if (eco.wallets) Object.entries(eco.wallets).forEach(([k, v]) => playerWallet.set(k.toLowerCase(), Number(v)));
                if (eco.cards) Object.entries(eco.cards).forEach(([k, v]) => playerCards.set(k.toLowerCase(), v));
            } catch (e) {}
        }
        cloudRestoreCompleted = true;
        for (const [, s] of io.sockets.sockets) {
            if (s && s.username) s.emit('svStatsSync', getSvProfile(s.username));
        }
        return true;
    }

    forcePullFromUpstash();

    io.on('connection', (socket) => {
        socket.on('chatMessage', async (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof raw !== 'string') return;
            const clean = raw.trim();
            const low = clean.toLowerCase();
            const sender = socket.username || (payload && payload.username) || 'Player';
            const sKey = sender.toLowerCase();

            // Force reload from Upstash Cloud anytime
            if (low === '/cloudload') {
                const ok = await forcePullFromUpstash();
                socket.emit('message', {
                    username: 'SYSTEM',
                    text: ok
                        ? `☁️✅ **CLOUD RESTORED!** Loaded **${Object.keys(svPlayerStats).length} Profiles** & **${playerWallet.size} Wallets**!`
                        : `❌ **Cloud Load Failed!** Check Upstash env vars.`,
                    _serverId: srvId
                });
            }

            // Richest Players Leaderboard (!richest)
            if (low === '!richest') {
                const top = Array.from(playerWallet.entries())
                    .sort((a, b) => b.at(1) - a.at(1))
                    .slice(0, 5)
                    .map(([n, c], i) => `${i === 0 ? '👑' : `#${i + 1}`} **${n.toUpperCase()}**: **${Number(c).toLocaleString()}🪙**`)
                    .join(' | ');
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `💰 **RICHEST PLAYERS:** ${top || 'No wallets yet!'}`,
                    _serverId: srvId
                });
            }

            // Gift Trading Card (!giftcard @user)
            if (low.startsWith('!giftcard ')) {
                const targetName = clean.slice(10).replace('@', '').trim().split(/\s+/).at(0);
                if (!targetName || targetName.toLowerCase() === sKey) return;
                const deck = playerCards.get(sKey) || [];
                if (deck.length === 0) {
                    return socket.emit('message', { username: "Sammu's Bot", text: '🃏 You have no cards to gift! Type `!pack` first.', _serverId: srvId });
                }
                const gifted = deck.pop();
                playerCards.set(sKey, deck);
                const tKey = targetName.toLowerCase();
                if (!playerCards.has(tKey)) playerCards.set(tKey, []);
                playerCards.get(tKey).push(gifted);
                saveEconomyDB();
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `🎁🃏 **CARD GIFT!** **${sender}** gifted **${gifted.emoji} ${gifted.name}** [${gifted.tier}] to **${targetName}**!`,
                    _serverId: srvId
                });
            }
        });
    });
    // ============================================================================
    // 🏰 5-WAVE ABYSSAL DUNGEON GAUNTLET (!dungeon & BUTTON)
    // ============================================================================
    const DUNGEON_WAVES_V4 = [
        { num: 1, name: '💀 Wave 1/5: Shadow Assassin',     hp: 260,  atk: 12, pKey: 'shadow',     red: 0.05 },
        { num: 2, name: '🔥 Wave 2/5: Inferno Chimera',     hp: 380,  atk: 18, pKey: 'fire',       red: 0.10 },
        { num: 3, name: '⚡ Wave 3/5: Thunder Raijin Lord', hp: 520,  atk: 24, pKey: 'lightning',  red: 0.15 },
        { num: 4, name: '🌑 Wave 4/5: Void Eclipse Titan',  hp: 700,  atk: 30, pKey: 'blackhole',  red: 0.22 },
        { num: 5, name: '👹👑 BOSS 5/5: ABYSSAL OVERLORD',  hp: 1100, atk: 38, pKey: 'antimatter', red: 0.30 }
    ];

    function launchDungeonWaveV4(socket, waveIdx, carryHp) {
        const srvId = socket.activeServerId;
        const uname = socket.username || 'Hero';
        const prof = getSvProfile(uname);
        const w = DUNGEON_WAVES_V4.at(waveIdx);
        const pKey = (prof.customPowers?.at(-1)?.id) || (prof.unlockedPowers?.at(-1)) || 'fire';

        const p1 = buildFighterObj(socket.id, uname, pKey);
        p1.hp = carryHp ? Math.min(p1.maxHp, carryHp + 65) : p1.maxHp;

        const p2 = buildFighterObj('DNG_BOSS', w.name, w.pKey, w.hp, w.atk, true, 'DNG_BOSS');
        p2.def = { ...p2.def, passiveRed: w.red };
        p2.isV2 = waveIdx >= 2;
        p2.isV3 = waveIdx === 4;

        const battleId = 'dng_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const battle = {
            id: battleId, srvId, isDungeon: true, dungeonWave: waveIdx,
            turn: 1, timeLeft: 15,
            lastLog: `🏰 <b>${w.name}</b> appeared! Survive all 5 waves for <b>20,000🪙 + Free Fusion Pass</b>!`,
            p1, p2, interval: null
        };
        svBattles.set(battleId, battle);
        battle.interval = setInterval(() => {
            const cur = svBattles.get(battleId);
            if (!cur) return;
            cur.timeLeft--;
            if (cur.timeLeft <= 0) resolveSvTurn(battleId);
            else syncSvBattle(cur, null);
        }, 1000);
        syncSvBattle(battle, 'ult');
    }

    const _prevFinishSvBattleDng = finishSvBattle;
    finishSvBattle = function(battleId, b) {
        if (!b || !b.isDungeon) return _prevFinishSvBattleDng(battleId, b);

        clearInterval(b.interval);
        svBattles.delete(battleId);
        const p1Won = b.p1.hp > b.p2.hp;
        const pSock = io.sockets.sockets.get(b.p1.id);
        io.to(b.p1.id).emit('svBattleEnd', { won: p1Won, _serverId: b.srvId });

        if (!p1Won || !pSock) {
            io.to(b.srvId).emit('message', {
                username: "Sammu's Bot",
                text: `💀🏰 **DUNGEON DEFEAT!** **${b.p1.name}** fell on **${DUNGEON_WAVES_V4.at(b.dungeonWave).name}**!`,
                _serverId: b.srvId
            });
            return;
        }

        if (b.dungeonWave + 1 < DUNGEON_WAVES_V4.length) {
            const nextW = DUNGEON_WAVES_V4.at(b.dungeonWave + 1);
            io.to(b.p1.id).emit('message', {
                username: "Sammu's Bot",
                text: `⚔️🔥 **WAVE ${b.dungeonWave + 1}/5 CLEARED!** (+65 HP Campfire Heal) Next: **${nextW.name}** in 3s...`,
                _serverId: b.srvId
            });
            setTimeout(() => {
                if (io.sockets.sockets.has(b.p1.id)) launchDungeonWaveV4(pSock, b.dungeonWave + 1, b.p1.hp);
            }, 3000);
        } else {
            const prof = getSvProfile(b.p1.name);
            prof.freeFusionPasses = (prof.freeFusionPasses || 0) + 1;
            prof.petEssence = (prof.petEssence || 0) + 60;
            const bal = addCoins(b.p1.name, 20000);
            syncPlayerTitlesAndBounty(b.p1.name);
            saveSvStats();
            pSock.emit('svStatsSync', getSvProfile(b.p1.name));
            pSock.emit('svNotice', '🏆👹 ABYSSAL DUNGEON CONQUERED! Won +20,000🪙, +60🔮 Essence & 1x FREE FUSION PASS!');
            io.to(b.srvId).emit('message', {
                username: "Sammu's Bot",
                text: `🎊👑 **DUNGEON CONQUERED!!** **${b.p1.name}** slayed all 5 waves & **ABYSSAL OVERLORD**, winning **+20,000🪙** (Total: **${bal.toLocaleString()}🪙**) + **1x FREE FUSION PASS**!`,
                _serverId: b.srvId
            });
        }
    };

    io.on('connection', (socket) => {
        socket.on('svStartDungeon', () => {
            if (!socket.activeServerId || findPlayerActiveSvBattle(socket.id)) {
                return socket.emit('svNotice', '⚠️ Finish your current battle first!');
            }
            launchDungeonWaveV4(socket, 0, null);
        });

        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            if (typeof raw === 'string' && raw.trim().toLowerCase() === '!dungeon' && socket.activeServerId) {
                if (findPlayerActiveSvBattle(socket.id)) {
                    return socket.emit('message', { username: "Sammu's Bot", text: '⚠️ Finish your current SammuVerse fight first!', _serverId: socket.activeServerId });
                }
                launchDungeonWaveV4(socket, 0, null);
            }
        });
    });
    // ============================================================================
    // 💸 FIXED !PAY + 🐉 10-BOSS COSMIC WORLD RAID — PART 1/2
    // ============================================================================
    const WORLD_RAID_BOSSES_V4 = [
        { num: 1,  name: '💀 Boss 1/10: Shadow Stalker',       baseHp: 600,  dmg: 14 },
        { num: 2,  name: '🔥 Boss 2/10: Inferno Ifrit',        baseHp: 900,  dmg: 17 },
        { num: 3,  name: '❄️ Boss 3/10: Frost Leviathan',      baseHp: 1250, dmg: 20 },
        { num: 4,  name: '⚡ Boss 4/10: Raijin Thunder God',   baseHp: 1650, dmg: 23 },
        { num: 5,  name: '🩸 Boss 5/10: Crimson Demon King',   baseHp: 2100, dmg: 26 },
        { num: 6,  name: '🪐 Boss 6/10: Gravity Singularity',  baseHp: 2600, dmg: 29 },
        { num: 7,  name: '⏳ Boss 7/10: Chronos Time Reaper',  baseHp: 3200, dmg: 32 },
        { num: 8,  name: '🌑 Boss 8/10: Shadow Monarch',       baseHp: 3900, dmg: 35 },
        { num: 9,  name: '👹 Boss 9/10: Ten-Tails Jinchuriki', baseHp: 4700, dmg: 38 },
        { num: 10, name: '🌌👑 BOSS 10/10: OMEGA DESTROYER',   baseHp: 6000, dmg: 44 }
    ];

    const worldRaidsV4 = new Map();

    function getRaidDamageV4(uname, isUlt) {
        const prof = getSvProfile(uname);
        const trB = getTrainingBonuses(prof);
        const unlocked = Array.isArray(prof.unlockedPowers) ? prof.unlockedPowers : [];
        const pKey = (prof.customPowers?.at(-1)?.id) || unlocked.at(-1) || 'fire';
        const def = SV_DEFS[pKey] || SV_DEFS.fire;
        const mv = isUlt ? (def.moves.at(3) || def.moves.at(0)) : (def.moves.at(1) || def.moves.at(0));
        let dmg = (mv?.dmg || 55) + ((prof.atkLv || 0) * 8) + trB.bonusDmg + Math.floor(Math.random() * 20);
        if (prof.powerWins?.[pKey] >= 5) dmg = Math.round(dmg * 1.15);
        if (prof.powerWins?.[pKey] >= 100) dmg = Math.round(dmg * 1.25);
        if (prof.gears?.omegaCore) dmg = Math.round(dmg * 1.20);
        if (prof.gears?.titanCrown) dmg = Math.round(dmg * 1.25);
        return { dmg, icon: def.icon, pName: def.name };
    }

    function tickWorldRaidV4(srvId) {
        const raid = worldRaidsV4.get(srvId);
        if (!raid) return;
        const boss = WORLD_RAID_BOSSES_V4.at(raid.bossIdx);
        raid.actedThisTurn.clear();

        if (raid.bossHp <= 0) {
            if (raid.bossIdx + 1 >= WORLD_RAID_BOSSES_V4.length) {
                clearInterval(raid.interval);
                worldRaidsV4.delete(srvId);
                const heroes = Object.keys(raid.dmgMap);
                const sorted = Object.entries(raid.dmgMap).sort((a, b) => b.at(1) - a.at(1));
                const mvp = sorted.at(0);

                heroes.forEach(hName => {
                    const pr = getSvProfile(hName);
                    pr.freeFusionPasses = (pr.freeFusionPasses || 0) + 1;
                    pr.petEssence = (pr.petEssence || 0) + 80;
                    addCoins(hName, 25000);
                });
                if (mvp) addCoins(mvp.at(0), 10000);
                saveSvStats();

                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `🎊🌌 **10-BOSS WORLD RAID CONQUERED!!**\n` +
                          `🏆 **All ${heroes.length} Heroes** won **+25,000🪙**, **+80🔮 Essence**, & **1x Free Fusion Pass**!\n` +
                          `👑 **Raid MVP:** **${mvp ? mvp.at(0) : 'Squad'}** (${mvp ? mvp.at(1).toLocaleString() : 0} DMG | **+10,000🪙**)!`,
                    _serverId: srvId
                });
                return;
            }

            raid.bossIdx++;
            const nextB = WORLD_RAID_BOSSES_V4.at(raid.bossIdx);
            const scale = Math.max(1, getFullRoomPlayers(srvId).length * 0.65);
            raid.bossHp = Math.round(nextB.baseHp * scale);
            raid.squadHp = Math.min(100, raid.squadHp + 25);

            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `⚔️🔥 **BOSS DEFEATED!** (+25% Squad Heal) Next Up: **${nextB.name}** (**${raid.bossHp.toLocaleString()} HP**)! Type \`!attack\`, \`!ult\`, or \`!heal\`!`,
                _serverId: srvId
            });
            return;
        }

        const strike = Math.max(8, boss.dmg - Math.floor(Math.random() * 6));
        raid.squadHp = Math.max(0, raid.squadHp - strike);

        if (raid.squadHp <= 0) {
            clearInterval(raid.interval);
            worldRaidsV4.delete(srvId);
            io.to(srvId).emit('message', {
                username: "Sammu's Bot",
                text: `💀🔥 **WORLD RAID WIPEOUT!** **${boss.name}** wiped out the squad with **${raid.bossHp.toLocaleString()} HP** left!`,
                _serverId: srvId
            });
            return;
        }

        io.to(srvId).emit('message', {
            username: "Sammu's Bot",
            text: `👹 **${boss.name}** struck the squad (**-${strike}% HP**)! | Squad: **${raid.squadHp}%** | Boss: **${raid.bossHp.toLocaleString()} HP**\n*(Type \`!attack\`, \`!ult\`, or \`!heal\`!)*`,
            _serverId: srvId
        });
    }
    // ============================================================================
    // 💸 FIXED !PAY + 🐉 10-BOSS COSMIC WORLD RAID — PART 2/2
    // ============================================================================
    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof raw !== 'string') return;
            const clean = raw.trim();
            const low = clean.toLowerCase();
            const sender = socket.username || (payload && payload.username) || 'Player';
            const sKey = sender.toLowerCase();

            // 1. Fixed !pay command (supports !pay @user 500 OR !pay user 500)
            if (low.startsWith('!pay ')) {
                const args = clean.slice(5).trim().split(/\s+/);
                const targetName = (args.at(0) || '').replace(/^@/, '').trim();
                const amt = Math.floor(Number(args.at(1)));

                if (!targetName || isNaN(amt) || amt < 10) {
                    return socket.emit('message', { username: "Sammu's Bot", text: '⚠️ Usage: `!pay @username 500` (Min 10🪙)', _serverId: srvId });
                }
                if (targetName.toLowerCase() === sKey) {
                    return socket.emit('message', { username: "Sammu's Bot", text: '😂 You cannot pay yourself!', _serverId: srvId });
                }
                if (!verifyPlayerAccountOwnership(sender, socket, false)) {
                    return socket.emit('message', { username: 'SYSTEM', text: `🛡️ **TRANSFER BLOCKED!** **${sender}** is locked to another device!`, _serverId: srvId });
                }
                const bal = getCoins(sender);
                if (bal < amt) {
                    return socket.emit('message', { username: "Sammu's Bot", text: `🪙 Not enough coins! Your balance: **${bal.toLocaleString()}🪙**`, _serverId: srvId });
                }

                const senderLeft = addCoins(sender, -amt);
                const targetNew = addCoins(targetName, amt);

                for (const [, s] of io.sockets.sockets) {
                    if (s && s.username && (s.username.toLowerCase() === sKey || s.username.toLowerCase() === targetName.toLowerCase())) {
                        s.emit('svStatsSync', getSvProfile(s.username));
                    }
                }

                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `💸🤝 **COIN TRANSFER!** **${sender}** sent **${amt.toLocaleString()}🪙** to **${targetName}**! (${sender}: **${senderLeft.toLocaleString()}🪙** | ${targetName}: **${targetNew.toLocaleString()}🪙**)`,
                    _serverId: srvId
                });
                return;
            }

            // 2. 10-Boss World Raid (!worldraid, !attack, !ult, !heal)
            if (low === '!worldraid') {
                if (worldRaidsV4.has(srvId)) {
                    const cur = worldRaidsV4.get(srvId);
                    const b = WORLD_RAID_BOSSES_V4.at(cur.bossIdx);
                    return socket.emit('message', { username: "Sammu's Bot", text: `🐉 World Raid already active! **${b.name}** (${cur.bossHp.toLocaleString()} HP) | Squad: **${cur.squadHp}%**`, _serverId: srvId });
                }
                const players = getFullRoomPlayers(srvId);
                const firstB = WORLD_RAID_BOSSES_V4.at(0);
                const startHp = Math.round(firstB.baseHp * Math.max(1, players.length * 0.65));
                const raid = {
                    bossIdx: 0, bossHp: startHp, squadHp: 100,
                    dmgMap: {}, actedThisTurn: new Set(), ultUsed: new Set(),
                    interval: setInterval(() => tickWorldRaidV4(srvId), 14000)
                };
                worldRaidsV4.set(srvId, raid);
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `🚨🐉 **10-BOSS COSMIC WORLD RAID STARTED!**\nCurrent: **${firstB.name}** (**${startHp.toLocaleString()} HP**)\n👉 Type \`!attack\`, \`!ult\` (1x per boss), or \`!heal\` in chat!`,
                    _serverId: srvId
                });
                return;
            }

            const raid = worldRaidsV4.get(srvId);
            if (!raid) return;

            if (low === '!attack' || low === '!strike' || low === '!ult') {
                if (raid.actedThisTurn.has(socket.id)) {
                    return socket.emit('message', { username: "Sammu's Bot", text: '⏳ Cooldown! Wait for the next boss strike (~14s).', _serverId: srvId });
                }
                const isUlt = (low === '!ult');
                const ultKey = `${raid.bossIdx}_${socket.id}`;
                if (isUlt && raid.ultUsed.has(ultKey)) {
                    return socket.emit('message', { username: "Sammu's Bot", text: '⚠️ Already used `!ult` on this boss! Type `!attack` or `!heal`.', _serverId: srvId });
                }
                raid.actedThisTurn.add(socket.id);
                if (isUlt) raid.ultUsed.add(ultKey);

                const hit = getRaidDamageV4(sender, isUlt);
                raid.bossHp = Math.max(0, raid.bossHp - hit.dmg);
                raid.dmgMap[sender] = (raid.dmgMap[sender] || 0) + hit.dmg;

                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `${hit.icon} **${sender}** (${hit.pName}) ${isUlt ? 'unleashed **ULTIMATE**' : 'attacked'} for **-${hit.dmg} DMG**! (Boss HP: **${raid.bossHp.toLocaleString()}**)`,
                    _serverId: srvId
                });
                if (raid.bossHp <= 0) tickWorldRaidV4(srvId);
            }

            if (low === '!heal') {
                if (raid.actedThisTurn.has(socket.id)) return;
                raid.actedThisTurn.add(socket.id);
                raid.squadHp = Math.min(100, raid.squadHp + 18);
                raid.dmgMap[sender] = (raid.dmgMap[sender] || 0) + 50;
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `💖🩺 **${sender}** healed the Raid Squad (**+18% HP** -> **${raid.squadHp}%**)!`,
                    _serverId: srvId
                });
            }
        });
    });
    // ============================================================================
    // 🐉 WORLD RAID LIVE HUD BAR + 🗺️ STORY MODE FIX — PART 1/2
    // ============================================================================
    const WORLD_RAID_HUD_UI = `
    <div id="svWorldRaidHud" style="display:none;position:fixed;top:8px;left:0;right:0;z-index:999999;justify-content:center;padding:0 10px;pointer-events:none;">
      <div style="pointer-events:auto;background:linear-gradient(155deg,rgba(49,16,66,0.97),rgba(15,23,42,0.97));border:2px solid #facc15;border-radius:16px;padding:10px 12px;width:100%;max-width:390px;color:#fff;text-align:center;box-shadow:0 6px 28px rgba(250,204,21,0.55);backdrop-filter:blur(8px);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <span id="wrHudTitle" style="font-weight:900;font-size:11px;color:#fde047;">🐉 COSMIC WORLD RAID (1/10)</span>
          <button onclick="document.getElementById('svWorldRaidHud').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:bold;cursor:pointer;">✕ Hide</button>
        </div>
        <div style="display:flex;gap:6px;font-size:10px;font-weight:bold;margin-bottom:7px;">
          <div style="flex:1;background:#090d16;border:1px solid #4ade80;border-radius:8px;padding:4px;position:relative;overflow:hidden;">
            <div id="wrHudSquadFill" style="position:absolute;inset:0;width:100%;background:rgba(74,222,128,0.28);transition:width 0.3s;"></div>
            <span style="position:relative;">❤️ Squad: <b id="wrHudSquadHp" style="color:#4ade80;">100%</b></span>
          </div>
          <div style="flex:1;background:#090d16;border:1px solid #f43f5e;border-radius:8px;padding:4px;position:relative;overflow:hidden;">
            <div id="wrHudBossFill" style="position:absolute;inset:0;width:100%;background:rgba(244,63,94,0.34);transition:width 0.3s;"></div>
            <span style="position:relative;">👹 Boss: <b id="wrHudBossHp" style="color:#fda4af;">600</b></span>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;">
          <button onclick="if(typeof socket!=='undefined')socket.emit('chatMessage','!attack')" style="padding:7px 4px;border:1.5px solid #f87171;border-radius:9px;background:#b91c1c;color:#fff;font-weight:900;font-size:11px;cursor:pointer;">⚔️ Attack</button>
          <button onclick="if(typeof socket!=='undefined')socket.emit('chatMessage','!ult')" style="padding:7px 4px;border:1.5px solid #facc15;border-radius:9px;background:linear-gradient(90deg,#7e22ce,#d97706);color:#fff;font-weight:900;font-size:11px;cursor:pointer;">💥 ULT (1x)</button>
          <button onclick="if(typeof socket!=='undefined')socket.emit('chatMessage','!heal')" style="padding:7px 4px;border:1.5px solid #4ade80;border-radius:9px;background:#15803d;color:#fff;font-weight:900;font-size:11px;cursor:pointer;">💖 Heal</button>
        </div>
      </div>
    </div>
    <script>
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
    </script>`;
    // ============================================================================
    // 🐉 WORLD RAID LIVE HUD BAR + 🗺️ STORY MODE FIX — PART 2/2
    // ============================================================================
    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (false && typeof body === 'string' && !body.includes('svWorldRaidHud')) {
                body = body.replace('</body>', WORLD_RAID_HUD_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });

    function emitWorldRaidHud(srvId) {
        const raid = worldRaidsV4.get(srvId);
        if (!raid) return io.to(srvId).emit('svWorldRaidHudEnd');
        const boss = WORLD_RAID_BOSSES_V4.at(raid.bossIdx) || WORLD_RAID_BOSSES_V4.at(0);
        if (!raid.maxBossHp || raid.bossHp > raid.maxBossHp) raid.maxBossHp = raid.bossHp;
        io.to(srvId).emit('svWorldRaidHudSync', {
            bossName: boss.name,
            bossHp: Math.max(0, raid.bossHp),
            maxBossHp: raid.maxBossHp,
            squadHp: Math.max(0, raid.squadHp),
            _serverId: srvId
        });
    }

    const _prevTickWrHud = tickWorldRaidV4;
    tickWorldRaidV4 = function(srvId) {
        _prevTickWrHud(srvId);
        emitWorldRaidHud(srvId);
    };

    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof raw !== 'string') return;
            const low = raw.trim().toLowerCase();
            if (low === '!worldraid' || low === '!attack' || low === '!strike' || low === '!ult' || low === '!heal') {
                setTimeout(() => emitWorldRaidHud(srvId), 120);
            }
        });
    });
    // ============================================================================
    // 🏆 GLOBAL SAMMUVERSE LEADERBOARD (!ranks / !leaderboard + 🏆 RANKS BUTTON)
    // ============================================================================
    function buildGlobalLeaderboardList() {
        return Object.entries(svPlayerStats)
            .map(([name, st]) => ({
                name: name.toUpperCase(),
                wins: st.wins || 0,
                bounty: st.bounty || 10000,
                floor: st.maxTowerFloor || 1,
                coins: getCoins(name)
            }))
            .sort((a, b) => b.wins - a.wins || b.bounty - a.bounty || b.coins - a.coins)
            .slice(0, 10);
    }

    io.on('connection', (socket) => {
        socket.on('svGetGlobalLeaderboard', () => {
            socket.emit('svGlobalLeaderboardSync', buildGlobalLeaderboardList());
        });

        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof raw !== 'string') return;
            const low = raw.trim().toLowerCase();

            if (low === '!ranks' || low === '!leaderboard' || low === '!lb') {
                const top = buildGlobalLeaderboardList().slice(0, 5);
                const msg = top.length
                    ? top.map((p, i) => `${i === 0 ? '👑' : `#${i + 1}`} **${p.name}** — ${p.wins}W | 🗼F${p.floor} | ${p.coins.toLocaleString()}🪙`).join('\n')
                    : 'No ranked fighters yet! Win a battle in SammuVerse!';
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `🏆 **SAMMUVERSE TOP FIGHTERS:**\n${msg}`,
                    _serverId: srvId
                });
            }
        });
    });

    const GLOBAL_LB_CLIENT_SCRIPT = `
    <script>
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
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (false && typeof body === 'string' && !body.includes('_svGlobalLbHooked')) {
                body = body.replace('</body>', GLOBAL_LB_CLIENT_SCRIPT + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // ============================================================================
    // 👑 SECRET ADMIN COMMANDS (#hazmolerangola UNLOCK -> /settrain, /givecoins, /setfloor)
    // ============================================================================
    const unlockedCommandAdmins = new Set();

    io.on('connection', (socket) => {
        // Intercept #hazmolerangola before it broadcasts to public chat
        socket.use((packet, next) => {
            if (packet && packet.at(0) === 'chatMessage' && socket.activeServerId) {
                const payload = packet.at(1);
                const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
                if (typeof raw === 'string' && raw.trim().toLowerCase() === '#hazmolerangola') {
                    const uname = (socket.username || (payload && payload.username) || '').toLowerCase().trim();
                    if (uname) unlockedCommandAdmins.add(uname);
                    socket.isHazmoleAdmin = true;
                    socket.emit('message', {
                        username: 'SYSTEM',
                        text: '🔓👑 **SECRET ADMIN MODE UNLOCKED!** You can now use `/settrain @user <lvl>`, `/givecoins @user <amt>`, and `/setfloor @user <floor>`!',
                        _serverId: socket.activeServerId
                    });
                    return; // Keeps #hazmolerangola secret from public chat!
                }
            }
            next();
        });

        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof raw !== 'string') return;
            const clean = raw.trim();
            const low = clean.toLowerCase();
            const sender = (socket.username || (payload && payload.username) || '').toLowerCase().trim();
            const hasAdminPower = Boolean(socket.isHazmoleAdmin || (sender && unlockedCommandAdmins.has(sender)));

            // 1. /settrain @username <totalLevels>
            if (low.startsWith('/settrain ')) {
                if (!hasAdminPower) return;
                const args = clean.slice(10).trim().split(/\s+/);
                const target = (args.at(0) || '').replace(/^@/, '').trim();
                const totalLv = Math.max(0, Math.floor(Number(args.at(1))));
                if (!target || isNaN(totalLv)) {
                    return socket.emit('message', { username: 'SYSTEM', text: '⚠️ Usage: `/settrain @username 1000000`', _serverId: srvId });
                }

                const prof = getSvProfile(target);
                const tr = ensureTrainingProfile(prof);
                const perStat = Math.floor(totalLv / 3);
                const rem = totalLv - (perStat * 3);
                tr.fistLv = perStat + rem;
                tr.bodyLv = perStat;
                tr.chiLv = perStat;
                tr.xp = Math.max(tr.xp || 0, totalLv);

                ensureTrainingProfile(prof);
                syncPlayerTitlesAndBounty(target);
                saveSvStats();

                for (const [, s] of io.sockets.sockets) {
                    if (s && s.username && s.username.toLowerCase() === target.toLowerCase()) {
                        s.emit('svStatsSync', getSvProfile(s.username));
                    }
                }

                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `🏋️👑 **ADMIN BOOST:** **${sender.toUpperCase()}** set **${target}**'s Training Mastery to **${totalLv.toLocaleString()}** (Fist: ${tr.fistLv.toLocaleString()} | Body: ${tr.bodyLv.toLocaleString()} | Chi: ${tr.chiLv.toLocaleString()})!`,
                    _serverId: srvId
                });
            }

            // 2. /givecoins @username <amount>
            if (low.startsWith('/givecoins ')) {
                if (!hasAdminPower) return;
                const args = clean.slice(11).trim().split(/\s+/);
                const target = (args.at(0) || '').replace(/^@/, '').trim();
                const amt = Math.floor(Number(args.at(1)));
                if (!target || isNaN(amt)) {
                    return socket.emit('message', { username: 'SYSTEM', text: '⚠️ Usage: `/givecoins @username 50000`', _serverId: srvId });
                }

                const newBal = addCoins(target, amt);
                for (const [, s] of io.sockets.sockets) {
                    if (s && s.username && s.username.toLowerCase() === target.toLowerCase()) {
                        s.emit('svStatsSync', getSvProfile(s.username));
                    }
                }
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `💰👑 **ADMIN GRANT:** **${sender.toUpperCase()}** gave **${amt.toLocaleString()}🪙** to **${target}** (New Balance: **${newBal.toLocaleString()}🪙**)!`,
                    _serverId: srvId
                });
            }

            // 3. /setfloor @username <floor>
            if (low.startsWith('/setfloor ')) {
                if (!hasAdminPower) return;
                const args = clean.slice(10).trim().split(/\s+/);
                const target = (args.at(0) || '').replace(/^@/, '').trim();
                const fl = Math.max(1, Math.floor(Number(args.at(1))));
                if (!target || isNaN(fl)) {
                    return socket.emit('message', { username: 'SYSTEM', text: '⚠️ Usage: `/setfloor @username 50`', _serverId: srvId });
                }

                const prof = getSvProfile(target);
                prof.maxTowerFloor = fl;
                prof.towerCheckpoint = Math.max(1, Math.floor(fl / 5) * 5);
                syncPlayerTitlesAndBounty(target);
                saveSvStats();

                for (const [, s] of io.sockets.sockets) {
                    if (s && s.username && s.username.toLowerCase() === target.toLowerCase()) {
                        s.emit('svStatsSync', getSvProfile(s.username));
                    }
                }
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `♾️👑 **ADMIN SET:** **${target}**'s Endless Tower progress set to **Floor ${fl}** (Checkpoint: **F${prof.towerCheckpoint}**)!`,
                    _serverId: srvId
                });
            }
        });
    });
    // ============================================================================
    // 🔊 GLOBAL SINGLE AUDIO ENGINE + CHAT POP SOUND RESTORE
    // ============================================================================
    const GLOBAL_CHAT_AND_GAME_AUDIO = `
    <script>
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
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (false && typeof body === 'string' && !body.includes('_globalAudioEngineInstalled')) {
                body = body.replace('</body>', GLOBAL_CHAT_AND_GAME_AUDIO + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // ============================================================================
    // 👑 EXPANDED #hazmolerangola ADMIN COMMANDS (POWERS, V3, PETS, GEARS & RESET)
    // ============================================================================
    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof raw !== 'string') return;
            const clean = raw.trim();
            const low = clean.toLowerCase();
            const sender = (socket.username || (payload && payload.username) || '').toLowerCase().trim();
            const hasAdminPower = Boolean(socket.isHazmoleAdmin || (sender && unlockedCommandAdmins.has(sender)));
            if (!hasAdminPower) return;

            const syncTargetLive = (targetName) => {
                syncPlayerTitlesAndBounty(targetName);
                saveSvStats();
                for (const [, s] of io.sockets.sockets) {
                    if (s && s.username && s.username.toLowerCase() === targetName.toLowerCase()) {
                        s.emit('svStatsSync', getSvProfile(s.username));
                    }
                }
            };

            // 1. /givepower @username <powerKey|all>
            if (low.startsWith('/givepower ')) {
                const args = clean.slice(11).trim().split(/\s+/);
                const target = (args.at(0) || '').replace(/^@/, '').trim();
                const pKey = (args.at(1) || '').toLowerCase().trim();
                if (!target || !pKey) {
                    return socket.emit('message', { username: 'SYSTEM', text: '⚠️ Usage: `/givepower @username mahavishnu` or `/givepower @username all`', _serverId: srvId });
                }
                const prof = getSvProfile(target);
                if (pKey === 'all') {
                    prof.unlockedPowers = Object.keys(SV_DEFS);
                    syncTargetLive(target);
                    return io.to(srvId).emit('message', { username: "Sammu's Bot", text: `⚡👑 **ADMIN GRANT:** **${target}** unlocked **ALL ${prof.unlockedPowers.length} POWERS**!`, _serverId: srvId });
                }
                if (!SV_DEFS[pKey]) {
                    return socket.emit('message', { username: 'SYSTEM', text: `❌ Unknown power \`${pKey}\`. Valid: ${Object.keys(SV_DEFS).slice(0, 12).join(', ')}...`, _serverId: srvId });
                }
                if (!prof.unlockedPowers.includes(pKey)) prof.unlockedPowers.push(pKey);
                syncTargetLive(target);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🌟👑 **ADMIN GRANT:** **${target}** unlocked **${SV_DEFS[pKey].icon} ${SV_DEFS[pKey].name}**!`, _serverId: srvId });
            }

            // 2. /setv3 @username <powerKey|all>
            if (low.startsWith('/setv3 ')) {
                const args = clean.slice(7).trim().split(/\s+/);
                const target = (args.at(0) || '').replace(/^@/, '').trim();
                const pKey = (args.at(1) || 'all').toLowerCase().trim();
                if (!target) return socket.emit('message', { username: 'SYSTEM', text: '⚠️ Usage: `/setv3 @username fire` or `/setv3 @username all`', _serverId: srvId });
                const prof = getSvProfile(target);
                if (!prof.powerWins) prof.powerWins = {};
                if (pKey === 'all') {
                    Object.keys(SV_DEFS).forEach(k => { prof.powerWins[k] = Math.max(100, prof.powerWins[k] || 0); });
                } else if (SV_DEFS[pKey]) {
                    prof.powerWins[pKey] = Math.max(100, prof.powerWins[pKey] || 0);
                } else {
                    return socket.emit('message', { username: 'SYSTEM', text: `❌ Unknown power \`${pKey}\`.`, _serverId: srvId });
                }
                syncTargetLive(target);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🔥👑 **V3 ASCENSION GRANTED:** **${target}** now has **100 Wins [V3 👑]** on **${pKey.toUpperCase()}**!`, _serverId: srvId });
            }

            // 3. /givepet @username <petId|all>
            if (low.startsWith('/givepet ')) {
                const args = clean.slice(9).trim().split(/\s+/);
                const target = (args.at(0) || '').replace(/^@/, '').trim();
                const petId = (args.at(1) || 'ouroboros').toLowerCase().trim();
                const allPets = ['mochi', 'tommy', 'garuda', 'sheshnag', 'chimera', 'ouroboros'];
                if (!target || (petId !== 'all' && !allPets.includes(petId))) {
                    return socket.emit('message', { username: 'SYSTEM', text: `⚠️ Usage: \`/givepet @username ouroboros\` (Options: ${allPets.join(', ')}, all)`, _serverId: srvId });
                }
                const prof = getSvProfile(target);
                if (petId === 'all') {
                    prof.ownedPets = [...allPets];
                    prof.activePet = 'ouroboros';
                    prof.activePet2 = 'chimera';
                } else {
                    if (!prof.ownedPets.includes(petId)) prof.ownedPets.push(petId);
                    prof.activePet = petId;
                }
                prof.petEssence = (prof.petEssence || 0) + 100;
                syncTargetLive(target);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🐉👑 **PET GRANT:** **${target}** received **${petId.toUpperCase()}** + **100🔮 Pet Essence**!`, _serverId: srvId });
            }

            // 4. /givegears @username
            if (low.startsWith('/givegears ')) {
                const target = clean.slice(11).replace(/^@/, '').trim().split(/\s+/).at(0);
                if (!target) return;
                const prof = getSvProfile(target);
                prof.gears = { omegaCore: true, titanCrown: true };
                prof.hasStone = true;
                prof.freeFusionPasses = (prof.freeFusionPasses || 0) + 1;
                syncTargetLive(target);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `⚡🌌 **GODLY GEARS GRANTED:** **${target}** unlocked **⚡ Omega Core**, **🌌 Titan Crown**, **💎 Awakening Stone**, & **1x Free Fusion Pass**!`, _serverId: srvId });
            }

            // 5. /setbounty @username <amount>
            if (low.startsWith('/setbounty ')) {
                const args = clean.slice(11).trim().split(/\s+/);
                const target = (args.at(0) || '').replace(/^@/, '').trim();
                const amt = Math.max(0, Math.floor(Number(args.at(1))));
                if (!target || isNaN(amt)) return socket.emit('message', { username: 'SYSTEM', text: '⚠️ Usage: `/setbounty @username 30000000`', _serverId: srvId });
                const prof = getSvProfile(target);
                prof.bounty = amt;
                syncTargetLive(target);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🏴‍☠️👑 **BOUNTY UPDATED:** **${target}**'s Bounty Honor is now **${amt.toLocaleString()}**!`, _serverId: srvId });
            }

            // 6. /resetuser @username
            if (low.startsWith('/resetuser ')) {
                const target = clean.slice(11).replace(/^@/, '').trim().split(/\s+/).at(0);
                if (!target) return;
                const k = target.toLowerCase();
                delete svPlayerStats[k];
                playerWallet.set(k, 150);
                saveEconomyDB();
                syncTargetLive(target);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🔄⚠️ **PROFILE RESET:** **${target}**'s stats and wallet were reset to starter defaults!`, _serverId: srvId });
            }
        });
    });
    // ============================================================================
    // 🔱 SUPREME HARIHARA SYNERGY & /godfusion ADMIN COMMAND
    // ============================================================================
    io.on('connection', (socket) => {
        // Auto-upgrade any existing HariHara / MahaVishnu+Mahadev fusion on login
        socket.on('svGetStats', () => {
            const uname = socket.username;
            if (!uname) return;
            const prof = getSvProfile(uname);
            let upgraded = false;
            (prof.customPowers || []).forEach(cp => {
                if (!cp || !cp.def) return;
                const isHariHara = /harihara/i.test(cp.def.name || '') || (cp.def.icon && cp.def.icon.includes('🔱🔱'));
                if (isHariHara && cp.def.hp < 950) {
                    cp.def.hp = 950;
                    cp.def.passiveRed = 0.55;
                    cp.def.moves = [
                        { label: '🪈🔱 HariHara Trishul-Bansuri (110 DMG + Stun)', dmg: 110, trueDmg: true, stunChance: 0.65 },
                        { label: '☸️🔥 Sudarshana Tandava (145 True DMG)', dmg: 145, trueDmg: true },
                        { label: '🌌🛡️ Kailash Vaikuntha Kavach (Evade +140 HP)', evade: true, heal: 140 },
                        { label: '🔱🌌 COSMIC HARIHARA PRALAYA ULT (295 True DMG + Stun)', dmg: 295, trueDmg: true, stun: true, cut: { theme: 'vishwaroopa', emoji: '🔱🌌🔥', title: 'SUPREME HARIHARA PRALAYA!' } }
                    ];
                    SV_DEFS[cp.id] = cp.def;
                    upgraded = true;
                }
            });
            if (upgraded) {
                saveSvStats();
                socket.emit('svStatsSync', prof);
            }
        });

        // /godfusion @username <FusionName> (Requires #hazmolerangola)
        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof raw !== 'string') return;
            const clean = raw.trim();
            const low = clean.toLowerCase();
            const sender = (socket.username || (payload && payload.username) || '').toLowerCase().trim();
            const hasAdminPower = Boolean(socket.isHazmoleAdmin || (sender && unlockedCommandAdmins.has(sender)));
            if (!hasAdminPower) return;

            if (low.startsWith('/godfusion ')) {
                const args = clean.slice(11).trim().split(/\s+/);
                const target = (args.shift() || '').replace(/^@/, '').trim();
                const title = (args.join(' ').trim() || 'HARIHARA SUPREME').slice(0, 26);
                if (!target) return;

                const prof = getSvProfile(target);
                const slotNum = (prof.customPowers?.length || 0) + 1;
                const cid = 'godfusion_' + target.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Date.now().toString(36);
                const godDef = {
                    fused: true,
                    icon: '🔱🌌',
                    name: `${title} [GOD #${slotNum}]`,
                    hp: 1000,
                    passiveRed: 0.58,
                    strong: Object.keys(SV_DEFS),
                    moves: [
                        { label: `⚡ ${title} Astral Strike (120 True DMG)`, dmg: 120, trueDmg: true },
                        { label: `🔥 ${title} Annihilation (155 True DMG + Stun)`, dmg: 155, trueDmg: true, stunChance: 0.60 },
                        { label: `🛡️ ${title} Absolute Domain (Evade +160 HP)`, evade: true, heal: 160 },
                        { label: `🌌👑 ${title.toUpperCase()} OMEGA ULT (320 True DMG + Stun)`, dmg: 320, trueDmg: true, stun: true, cut: { theme: 'vishwaroopa', emoji: '🔱👑🌌', title: `${title.toUpperCase()} SUPREME!` } }
                    ]
                };

                SV_DEFS[cid] = godDef;
                if (!Array.isArray(prof.unlockedPowers)) prof.unlockedPowers = [];
                if (!Array.isArray(prof.customPowers)) prof.customPowers = [];
                prof.unlockedPowers.push(cid);
                prof.customPowers.push({ id: cid, def: godDef });
                if (!prof.powerWins) prof.powerWins = {};
                prof.powerWins[cid] = 100; // Instant V3 Crown!

                syncPlayerTitlesAndBounty(target);
                saveSvStats();
                for (const [, s] of io.sockets.sockets) {
                    if (s && s.username && s.username.toLowerCase() === target.toLowerCase()) {
                        s.emit('svStatsSync', getSvProfile(s.username));
                    }
                }
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: `🔱🌌 **GOD FUSION AWAKENED!** **${target}** forged **${godDef.name}** (1,000 HP | 58% Armor | 320 True DMG ULT)!`,
                    _serverId: srvId
                });
            }
        });
    });
    // ============================================================================
    // 👑 CREATOR-ONLY HK GOD CONSOLE — PART 1/3 (SERVER ENGINE A)
    // ============================================================================
    function isSupremeCreatorOnly(socket, unameHint) {
        if (!socket) return false;
        if (socket.isHazmoleAdmin) return true;
        const clean = (socket.username || unameHint || '').toLowerCase().trim();
        if (clean && unlockedCommandAdmins.has(clean)) return true;
        // Strictly creator usernames ('sammu' or 'samaksh') verified by device lock — NOT other OG hosts!
        if (clean === 'sammu' || clean === 'samaksh') {
            return verifyOGHostTripleLock(clean, socket, false);
        }
        return false;
    }

    io.on('connection', (socket) => {
        socket.on('hkCheckAccess', () => {
            if (isSupremeCreatorOnly(socket)) {
                socket.emit('hkAccessGranted', { ok: true });
            }
        });

        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            if (typeof raw === 'string' && raw.trim().toLowerCase() === '#hazmolerangola') {
                setTimeout(() => socket.emit('hkAccessGranted', { ok: true }), 150);
            }
        });

        socket.on('hkAdminExec', ({ action, target, value }) => {
            const srvId = socket.activeServerId;
            if (!srvId || !isSupremeCreatorOnly(socket)) return;

            const cleanTarget = String(target || '').replace(/^@/, '').trim();
            const syncLive = (tName) => {
                if (!tName) return;
                syncPlayerTitlesAndBounty(tName);
                saveSvStats();
                for (const [, s] of io.sockets.sockets) {
                    if (s && s.username && s.username.toLowerCase() === tName.toLowerCase()) {
                        s.emit('svStatsSync', getSvProfile(s.username));
                    }
                }
            };

            if (action === 'announce') {
                const msg = String(value || '').trim();
                if (!msg) return;
                return io.to(srvId).emit('message', { username: "Sammu's Bot", text: `📢👑 **CREATOR NOTICE:** ${msg}`, _serverId: srvId });
            }

            if (!cleanTarget) return socket.emit('svNotice', '⚠️ Enter or select a target username first!');

            if (action === 'godmode') {
                const prof = getSvProfile(cleanTarget);
                const tr = ensureTrainingProfile(prof);
                prof.unlockedPowers = Object.keys(SV_DEFS);
                prof.ownedPets = ['mochi', 'tommy', 'garuda', 'sheshnag', 'chimera', 'ouroboros'];
                prof.activePet = 'ouroboros'; prof.activePet2 = 'chimera';
                prof.ownedRelics = ['excalibur', 'aegis', 'vampfang']; prof.activeRelic = 'excalibur';
                prof.gears = { omegaCore: true, titanCrown: true };
                prof.adventure = { chapter: 5, stage: 3, cleared: true };
                prof.hasStone = true; prof.atkLv = 15; prof.hpLv = 15;
                prof.petEssence = (prof.petEssence || 0) + 500;
                prof.freeFusionPasses = (prof.freeFusionPasses || 0) + 3;
                prof.bounty = 30000000; prof.lineage = 'celestial'; prof.lineageStage = 3;
                prof.maxTowerFloor = Math.max(100, prof.maxTowerFloor || 1); prof.towerCheckpoint = 100;
                tr.fistLv = 333334; tr.bodyLv = 333333; tr.chiLv = 333333; tr.xp = 1000000;
                if (!prof.powerWins) prof.powerWins = {};
                Object.keys(SV_DEFS).forEach(k => { prof.powerWins[k] = Math.max(100, prof.powerWins[k] || 0); });
                addCoins(cleanTarget, 500000);
                syncLive(cleanTarget);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `👑🔱 **GOD MODE ACTIVATED** on **${cleanTarget}**!`, _serverId: srvId });
            } else if (action === 'godfusion') {
                const title = (String(value || '').trim() || 'HARIHARA SUPREME').slice(0, 26);
                const prof = getSvProfile(cleanTarget);
                const slotNum = (prof.customPowers?.length || 0) + 1;
                const cid = 'godfusion_' + cleanTarget.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Date.now().toString(36);
                const godDef = {
                    fused: true, icon: '🔱🌌', name: `${title} [GOD #${slotNum}]`, hp: 1000, passiveRed: 0.58,
                    strong: Object.keys(SV_DEFS),
                    moves: [
                        { label: `⚡ ${title} Astral Strike (120 True DMG)`, dmg: 120, trueDmg: true },
                        { label: `🔥 ${title} Annihilation (155 True DMG + Stun)`, dmg: 155, trueDmg: true, stunChance: 0.60 },
                        { label: `🛡️ ${title} Absolute Domain (Evade +160 HP)`, evade: true, heal: 160 },
                        { label: `🌌👑 ${title.toUpperCase()} OMEGA ULT (320 True DMG + Stun)`, dmg: 320, trueDmg: true, stun: true, cut: { theme: 'vishwaroopa', emoji: '🔱👑🌌', title: `${title.toUpperCase()} SUPREME!` } }
                    ]
                };
                SV_DEFS[cid] = godDef;
                if (!Array.isArray(prof.unlockedPowers)) prof.unlockedPowers = [];
                if (!Array.isArray(prof.customPowers)) prof.customPowers = [];
                prof.unlockedPowers.push(cid);
                prof.customPowers.push({ id: cid, def: godDef });
                if (!prof.powerWins) prof.powerWins = {};
                prof.powerWins[cid] = 100;
                syncLive(cleanTarget);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🔱🌌 **GOD FUSION:** **${cleanTarget}** forged **${godDef.name}**!`, _serverId: srvId });
            } else if (action === 'coins') {
                const amt = Math.floor(Number(value) || 50000);
                const bal = addCoins(cleanTarget, amt);
                syncLive(cleanTarget);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `💰👑 **${cleanTarget}** received **${amt >= 0 ? '+' : ''}${amt.toLocaleString()}🪙** (Balance: **${bal.toLocaleString()}🪙**)!`, _serverId: srvId });
            } else if (action === 'power') {
                const pKey = String(value || 'all').toLowerCase().trim();
                const prof = getSvProfile(cleanTarget);
                if (pKey === 'all') prof.unlockedPowers = Object.keys(SV_DEFS);
                else if (SV_DEFS[pKey] && !prof.unlockedPowers.includes(pKey)) prof.unlockedPowers.push(pKey);
                syncLive(cleanTarget);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🌟👑 **${cleanTarget}** unlocked **${pKey.toUpperCase()}**!`, _serverId: srvId });
            }
    // ============================================================================
    // 👑 CREATOR-ONLY HK GOD CONSOLE — PART 2/3 (SERVER ENGINE B)
    // ============================================================================
            else if (action === 'v3') {
                const pKey = String(value || 'all').toLowerCase().trim();
                const prof = getSvProfile(cleanTarget);
                if (!prof.powerWins) prof.powerWins = {};
                if (pKey === 'all') Object.keys(SV_DEFS).forEach(k => { prof.powerWins[k] = Math.max(100, prof.powerWins[k] || 0); });
                else if (SV_DEFS[pKey]) prof.powerWins[pKey] = Math.max(100, prof.powerWins[pKey] || 0);
                syncLive(cleanTarget);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🔥👑 **${cleanTarget}** achieved **[V3 👑]** on **${pKey.toUpperCase()}**!`, _serverId: srvId });
            } else if (action === 'train') {
                const totalLv = Math.max(0, Math.floor(Number(value) || 1000000));
                const prof = getSvProfile(cleanTarget);
                const tr = ensureTrainingProfile(prof);
                const per = Math.floor(totalLv / 3);
                tr.fistLv = per + (totalLv - per * 3); tr.bodyLv = per; tr.chiLv = per;
                tr.xp = Math.max(tr.xp || 0, totalLv);
                syncLive(cleanTarget);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🏋️👑 **${cleanTarget}**'s Training Mastery set to **${totalLv.toLocaleString()}**!`, _serverId: srvId });
            } else if (action === 'floor') {
                const fl = Math.max(1, Math.floor(Number(value) || 50));
                const prof = getSvProfile(cleanTarget);
                prof.maxTowerFloor = fl; prof.towerCheckpoint = Math.max(1, Math.floor(fl / 5) * 5);
                syncLive(cleanTarget);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `♾️👑 **${cleanTarget}**'s Endless Tower set to **Floor ${fl}**!`, _serverId: srvId });
            } else if (action === 'pet') {
                const petId = String(value || 'ouroboros').toLowerCase();
                const allPets = ['mochi', 'tommy', 'garuda', 'sheshnag', 'chimera', 'ouroboros'];
                const prof = getSvProfile(cleanTarget);
                if (petId === 'all') { prof.ownedPets = [...allPets]; prof.activePet = 'ouroboros'; prof.activePet2 = 'chimera'; }
                else if (allPets.includes(petId)) { if (!prof.ownedPets.includes(petId)) prof.ownedPets.push(petId); prof.activePet = petId; }
                prof.petEssence = (prof.petEssence || 0) + 150;
                syncLive(cleanTarget);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🐉👑 **${cleanTarget}** received **${petId.toUpperCase()}** + **150🔮 Essence**!`, _serverId: srvId });
            } else if (action === 'gears') {
                const prof = getSvProfile(cleanTarget);
                prof.gears = { omegaCore: true, titanCrown: true };
                prof.hasStone = true;
                prof.freeFusionPasses = (prof.freeFusionPasses || 0) + 2;
                syncLive(cleanTarget);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `⚡🌌 **${cleanTarget}** received **Omega Core, Titan Crown, Awakening Stone & +2 Fusion Passes**!`, _serverId: srvId });
            } else if (action === 'bounty') {
                const amt = Math.max(0, Math.floor(Number(value) || 30000000));
                const prof = getSvProfile(cleanTarget);
                prof.bounty = amt;
                syncLive(cleanTarget);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🏴‍☠️👑 **${cleanTarget}**'s Bounty Honor set to **${amt.toLocaleString()}**!`, _serverId: srvId });
            } else if (action === 'reset') {
                const k = cleanTarget.toLowerCase();
                delete svPlayerStats[k];
                playerWallet.set(k, 150);
                saveEconomyDB();
                syncLive(cleanTarget);
                io.to(srvId).emit('message', { username: "Sammu's Bot", text: `🔄⚠️ **${cleanTarget}**'s profile was reset to starter defaults!`, _serverId: srvId });
            }
        });
    });
    // ============================================================================
    // 👑 CREATOR-ONLY HK GOD CONSOLE — PIECE 3A/3 (BUTTON & MODAL HTML)
    // ============================================================================
    const HK_CREATOR_PANEL_HTML = `
    <button id="hkCreatorFab" onclick="openHkCreatorModal()" style="display:none;position:fixed;bottom:16px;right:14px;z-index:9999997;background:linear-gradient(135deg,#f59e0b,#dc2626,#7e22ce);border:2px solid #fde047;color:#fff;border-radius:999px;padding:9px 14px;font-size:12px;font-weight:900;cursor:pointer;box-shadow:0 0 22px rgba(250,204,21,0.75);">👑 HK</button>

    <div id="hkCreatorModal" style="display:none;position:fixed;inset:0;background:rgba(4,6,15,0.95);z-index:9999999;align-items:center;justify-content:center;padding:10px;backdrop-filter:blur(10px);font-family:inherit;">
      <div style="background:linear-gradient(155deg,#0f172a,#2e1065,#450a0a);border:2px solid #facc15;border-radius:20px;padding:13px;width:100%;max-width:410px;max-height:92vh;overflow-y:auto;color:#fff;box-shadow:0 0 40px rgba(250,204,21,0.6);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-weight:900;font-size:14px;color:#fde047;">👑 HK SUPREME CREATOR CONSOLE</span>
          <button onclick="document.getElementById('hkCreatorModal').style.display='none'" style="background:#ef4444;border:none;color:#fff;border-radius:8px;padding:4px 9px;font-weight:bold;cursor:pointer;">✕</button>
        </div>

        <div style="background:rgba(0,0,0,0.4);border:1px solid #facc15;border-radius:12px;padding:8px;margin-bottom:8px;">
          <div style="font-size:10px;color:#fde047;font-weight:bold;margin-bottom:4px;">🎯 TARGET PLAYER (Pick Live or Type Exact Name):</div>
          <div style="display:flex;gap:5px;">
            <select id="hkPlayerDropdown" onchange="if(this.value)document.getElementById('hkTargetInput').value=this.value" style="flex:1;padding:7px;border-radius:9px;border:1px solid #38bdf8;background:#090d16;color:#fff;font-size:11px;">
              <option value="">-- Live Players --</option>
            </select>
            <input id="hkTargetInput" placeholder="Username..." style="flex:1;padding:7px;border-radius:9px;border:1px solid #facc15;background:#090d16;color:#fff;font-size:11px;">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
          <button onclick="runHkCmd('godmode')" style="padding:9px 6px;border:1.5px solid #fde047;border-radius:10px;background:linear-gradient(90deg,#d97706,#9333ea);color:#fff;font-weight:900;font-size:11px;cursor:pointer;">🔱 GOD MODE (MAX ALL)</button>
          <button onclick="runHkCmd('gears')" style="padding:9px 6px;border:1.5px solid #38bdf8;border-radius:10px;background:#0369a1;color:#fff;font-weight:900;font-size:11px;cursor:pointer;">⚡ Omega + Titan Gears</button>
        </div>

        <div style="background:rgba(255,255,255,0.06);border:1px solid #475569;border-radius:11px;padding:7px;margin-bottom:6px;">
          <div style="font-size:10px;color:#e879f9;font-weight:900;margin-bottom:4px;">🔱 FORGE GOD FUSION (1,000 HP / 320 True DMG)</div>
          <div style="display:flex;gap:5px;">
            <input id="hkFusionName" value="HARIHARA" placeholder="Fusion Name..." style="flex:1;padding:6px;border-radius:8px;border:1px solid #c084fc;background:#090d16;color:#fff;font-size:11px;">
            <button onclick="runHkCmd('godfusion',document.getElementById('hkFusionName').value)" style="background:#9333ea;border:none;color:#fff;padding:6px 10px;border-radius:8px;font-weight:900;font-size:11px;cursor:pointer;">Forge</button>
          </div>
        </div>

        <div style="background:rgba(255,255,255,0.06);border:1px solid #475569;border-radius:11px;padding:7px;margin-bottom:6px;">
          <div style="font-size:10px;color:#fde047;font-weight:900;margin-bottom:4px;">🪙 COINS & BOUNTY</div>
          <div style="display:flex;gap:4px;">
            <input id="hkCoinsVal" type="number" value="100000" style="width:90px;padding:6px;border-radius:8px;border:1px solid #facc15;background:#090d16;color:#fff;font-size:11px;">
            <button onclick="runHkCmd('coins',document.getElementById('hkCoinsVal').value)" style="flex:1;background:#16a34a;border:none;color:#fff;padding:6px;border-radius:8px;font-weight:900;font-size:11px;cursor:pointer;">+Give Coins</button>
            <button onclick="runHkCmd('bounty',30000000)" style="flex:1;background:#b45309;border:none;color:#fff;padding:6px;border-radius:8px;font-weight:900;font-size:11px;cursor:pointer;">🏴‍☠️ 30M Bounty</button>
          </div>
        </div>

        <div style="background:rgba(255,255,255,0.06);border:1px solid #475569;border-radius:11px;padding:7px;margin-bottom:6px;">
          <div style="font-size:10px;color:#38bdf8;font-weight:900;margin-bottom:4px;">🌟 UNLOCK POWER / SET V3 (100 WINS)</div>
          <div style="display:flex;gap:4px;">
            <select id="hkPowerSelect" style="flex:1;padding:6px;border-radius:8px;border:1px solid #38bdf8;background:#090d16;color:#fff;font-size:11px;">
              <option value="all">🌟 ALL POWERS</option>
              <option value="mahavishnu">🔱 MahaVishnu</option>
              <option value="mahadev">🔱 Mahadev</option>
              <option value="zoroking">⚔️ Zoro King of Hell</option>
              <option value="millyyt">🎬 Milly YT Queen</option>
              <option value="ishikastar">✨ Ishika Empress</option>
              <option value="antimpoke">⚡ Antim Sky Sov</option>
              <option value="moon">🌙 Dr. Moon</option>
              <option value="zoro">⚔️ Zoro 3-Sword</option>
            </select>
            <button onclick="runHkCmd('power',document.getElementById('hkPowerSelect').value)" style="background:#0284c7;border:none;color:#fff;padding:6px 9px;border-radius:8px;font-weight:900;font-size:11px;cursor:pointer;">Unlock</button>
            <button onclick="runHkCmd('v3',document.getElementById('hkPowerSelect').value)" style="background:#dc2626;border:none;color:#fff;padding:6px 9px;border-radius:8px;font-weight:900;font-size:11px;cursor:pointer;">Set V3</button>
          </div>
        </div>

        <div style="background:rgba(255,255,255,0.06);border:1px solid #475569;border-radius:11px;padding:7px;margin-bottom:6px;">
          <div style="font-size:10px;color:#4ade80;font-weight:900;margin-bottom:4px;">🏋️ TRAINING, TOWER & PETS</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;">
            <button onclick="runHkCmd('train',1000000)" style="background:#15803d;border:none;color:#fff;padding:6px 3px;border-radius:8px;font-weight:900;font-size:10px;cursor:pointer;">🏋️ 1M Train</button>
            <button onclick="runHkCmd('floor',100)" style="background:#1d4ed8;border:none;color:#fff;padding:6px 3px;border-radius:8px;font-weight:900;font-size:10px;cursor:pointer;">♾️ Floor 100</button>
            <button onclick="runHkCmd('pet','all')" style="background:#7e22ce;border:none;color:#fff;padding:6px 3px;border-radius:8px;font-weight:900;font-size:10px;cursor:pointer;">🐉 All Pets</button>
          </div>
        </div>

        <div style="display:flex;gap:5px;">
          <input id="hkAnnounceInput" placeholder="Server Announcement..." style="flex:1;padding:6px;border-radius:8px;border:1px solid #38bdf8;background:#090d16;color:#fff;font-size:11px;">
          <button onclick="runHkCmd('announce',document.getElementById('hkAnnounceInput').value);document.getElementById('hkAnnounceInput').value='';" style="background:#f59e0b;border:none;color:#111;padding:6px 10px;border-radius:8px;font-weight:900;font-size:11px;cursor:pointer;">📢</button>
          <button onclick="if(confirm('Reset this user profile?'))runHkCmd('reset')" style="background:#991b1b;border:none;color:#fff;padding:6px 9px;border-radius:8px;font-weight:900;font-size:11px;cursor:pointer;">🔄 Reset</button>
        </div>
      </div>
    </div>`;
    // ============================================================================
    // 👑 CREATOR-ONLY HK GOD CONSOLE — PIECE 3B/3 (CLIENT SCRIPT & INJECTOR)
    // ============================================================================
    const HK_CREATOR_PANEL_SCRIPT = `
    <script>
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
    </script>`;

    const HK_CREATOR_PANEL_UI = HK_CREATOR_PANEL_HTML + '\n' + HK_CREATOR_PANEL_SCRIPT;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (false && typeof body === 'string' && !body.includes('hkCreatorModal')) {
                body = body.replace('</body>', HK_CREATOR_PANEL_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // ============================================================================
    // ??? ALL-IN-ONE IN-APP BROWSER & MULTI-DEVICE PATCH (PASTE BEFORE return OG_HOSTS;)
    // ============================================================================
    verifyPlayerAccountOwnership = function(uname, socket, forceRelink = false) {
        if (!uname || !socket) return false;
        const clean = uname.trim().toLowerCase();
        // Never lock default fallback names
        if (clean === 'player' || clean === 'guest') return true;
 
        const devId = socket.trackedDeviceId || null;
        const prof = getSvProfile(uname);
        if (!devId) return true;
 
        if (!prof.ownerDevId || forceRelink) {
            prof.ownerDevId = devId;
            saveSvStats();
            return true;
        }
        if (prof.ownerDevId !== devId) {
            socket.emit('svNotice', '??? "' + uname + '" is already claimed on another device! Use a unique name.');
            return false;
        }
        return true;
    };
 
    io.on('connection', (socket) => {
        // Ensure socket.username is always saved immediately on join
        socket.on('joinRoom', (data) => {
            if (data && data.username && data.username.trim()) {
                socket.username = data.username.trim();
            }
        });
 
        // Allow buying powers by label for 2-tap mobile/in-app browser support
        socket.on('svBuyPowerByLabel', (rawLabel) => {
            const cleanLabel = String(rawLabel || '').toLowerCase();
            const foundEntry = Object.entries(SV_DEFS).find(([, def]) =>
                def && def.cost && cleanLabel.includes(def.name.toLowerCase())
            );
            if (!foundEntry) return;
            const [pKey, def] = foundEntry;
            const uname = socket.username || 'Player';
            if (!verifyPlayerAccountOwnership(uname, socket, false)) return;
            const prof = getSvProfile(uname);
            if (prof.unlockedPowers.includes(pKey)) return;
            if (getCoins(uname) < def.cost) return socket.emit('svNotice', `?? Need ${def.cost} Coins!`);
            addCoins(uname, -def.cost);
            prof.unlockedPowers.push(pKey);
            saveSvStats();
            socket.emit('svStatsSync', getSvProfile(uname));
            socket.emit('svNotice', `?? Unlocked ${def.icon} ${def.name}!`);
        });
    });
 
    const IN_APP_BROWSER_PATCH_UI = `
    <script>
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
    </script>`;
 
    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (false && typeof body === 'string' && !body.includes('_inAppPatchApplied')) {
                body = body.replace('</body>', IN_APP_BROWSER_PATCH_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // ============================================================================
    // ?? SAMMUVERSE V5 EXPANSION - PIECE 1/3 (DATA, GEAR, EMOJI CAP & REBIRTH)
    // ============================================================================
    function keepLastThreeEmojis(str) {
        const s = String(str || '?').trim();
        if (typeof Intl !== 'undefined' && Intl.Segmenter) {
            const segs = Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)).map(x => x.segment);
            return segs.slice(-3).join('');
        }
        return Array.from(s).slice(-3).join('');
    }
 
    Object.values(SV_DEFS).forEach(d => {
        if (d && d.fused && d.icon) d.icon = keepLastThreeEmojis(d.icon);
    });
    Object.values(svPlayerStats).forEach(st => {
        if (Array.isArray(st.customPowers)) {
            st.customPowers.forEach(cp => {
                if (cp && cp.def && cp.def.icon) {
                    cp.def.icon = keepLastThreeEmojis(cp.def.icon);
                    if (SV_DEFS[cp.id]) SV_DEFS[cp.id].icon = cp.def.icon;
                }
            });
        }
    });
 
    const V5_CHAPTERS = [
        { ch: 1, title: '?? Ch.1: Whispering Dojo', stages: ['?? Rogue Disciple', '?? Shadow Wolf', '?? Dojo Sensei Boss'], pKey: 'rubber', baseHp: 210, baseAtk: 6, coins: 350, xp: 200, ess: 15, drop: 'soul' },
        { ch: 2, title: '?? Ch.2: Crimson Volcano', stages: ['?? Magma Salamander', '?? Flame Knight', '?? Magma Wyrm Boss'], pKey: 'fire', baseHp: 340, baseAtk: 14, coins: 700, xp: 450, ess: 30, drop: 'core' },
        { ch: 3, title: '?? Ch.3: Abyssal Trench', stages: ['?? Depth Stalker', '?? Kraken Tentacle', '?? Leviathan Boss'], pKey: 'water', baseHp: 520, baseAtk: 22, coins: 1200, xp: 800, ess: 50, drop: 'soul' },
        { ch: 4, title: '? Ch.4: Celestial Citadel', stages: ['?? Sky Valkyrie', '? Thunder Golem', '?? Raijin Sovereign Boss'], pKey: 'lightning', baseHp: 780, baseAtk: 30, coins: 2200, xp: 1400, ess: 80, drop: 'core' },
        { ch: 5, title: '?? Ch.5: Void Throne', stages: ['?? Void Phantom', '??? Singularity Knight', '?? Abyssal God Boss'], pKey: 'antimatter', baseHp: 1150, baseAtk: 40, coins: 5000, xp: 3000, ess: 150, drop: 'soul' },
        { ch: 6, title: '?? Ch.6: Frostbite Glacier', stages: ['?? Ice Direwolf', '?? Frost Giant', '?? Absolute Zero Monarch'], pKey: 'ice', baseHp: 1650, baseAtk: 52, coins: 8500, xp: 4500, ess: 200, drop: 'core' },
        { ch: 7, title: '?? Ch.7: Crimson Moon Palace', stages: ['?? Blood Knight', '?? Eclipse Assassin', '?? Demon Progenitor'], pKey: 'blood', baseHp: 2300, baseAtk: 65, coins: 13000, xp: 6500, ess: 260, drop: 'soul' },
        { ch: 8, title: '? Ch.8: Chrono Paradox Rift', stages: ['? Time Warden', '?? Reality Glitch', '? Chronos Sovereign'], pKey: 'chronovoid', baseHp: 3100, baseAtk: 80, coins: 19000, xp: 9000, ess: 340, drop: 'core' },
        { ch: 9, title: '?? Ch.9: Asura Hell Arena', stages: ['??? Enma Spirit', '?? Oni Warlord', '?? King of Hell Zoro'], pKey: 'zoroking', baseHp: 4200, baseAtk: 98, coins: 28000, xp: 13000,ess: 450, drop: 'soul' },
        { ch: 10, title: '?? Ch.10: Omni-Creator Realm', stages: ['?? Astral Seraph', '?? Cosmic Avatar', '?? MahaVishnu Supreme'], pKey: 'mahavishnu', baseHp: 5800, baseAtk: 120,coins: 45000, xp: 20000,ess: 650, drop: 'core' }
    ];
 
    const V5_GEAR_CATALOG = {
        weapon: [
            { tier: 0, name: 'None', atk: 0, crit: 0, cost: 0, souls: 0 },
            { tier: 1, name: '??? Iron Katana [Common]', atk: 18, crit: 0.04, cost: 600, souls: 1 },
            { tier: 2, name: '? Raijin Blade [Rare]', atk: 42, crit: 0.09, cost: 2500, souls: 3 },
            { tier: 3, name: '?? Enma Hellblade [Epic]', atk: 85, crit: 0.15, cost: 9000, souls: 7 },
            { tier: 4, name: '?? Sudarshana Edge [Mythic]', atk: 165, crit: 0.25, cost: 28000, souls: 15 }
        ],
        armor: [
            { tier: 0, name: 'None', hp: 0, red: 0, cost: 0, cores: 0 },
            { tier: 1, name: '?? Dojo Gi [Common]', hp: 120, red: 0.04, cost: 600, cores: 1 },
            { tier: 2, name: '??? Aegis Plate [Rare]', hp: 300, red: 0.09, cost: 2500, cores: 3 },
            { tier: 3, name: '?? Shadow Cloak [Epic]', hp: 650, red: 0.15, cost: 9000, cores: 7 },
            { tier: 4, name: '?? Celestial Kavach [Mythic]', hp: 1350, red: 0.24, cost: 28000, cores: 15 }
        ],
        charm: [
            { tier: 0, name: 'None', steal: 0, energy: 0, cost: 0, souls: 0 },
            { tier: 1, name: '?? Spirit Bead [Common]', steal: 0.04, energy: 10, cost: 600, souls: 1 },
            { tier: 2, name: '?? Crimson Fang [Rare]', steal: 0.09, energy: 20, cost: 2500, souls: 3 },
            { tier: 3, name: '? Chrono Relic [Epic]', steal: 0.14, energy: 35, cost: 9000, souls: 7 },
            { tier: 4, name: '?? Omni Crown [Mythic]', steal: 0.22, energy: 50, cost: 28000, souls: 15 }
        ]
    };
 
    function ensureV5Profile(uname) {
        const prof = getSvProfile(uname);
        const today = new Date().toISOString().slice(0, 10);
        if (!prof.v5) {
            prof.v5 = {
                stars: {}, difficulty: 'normal', bossSouls: 0, elemCores: 0,
                equip: { weapon: 0, armor: 0, charm: 0 }, rebirths: 0,
                questDay: today, quests: { stages: 0, wins: 0, trains: 0, dmg: 0, claimed: false }
            };
        }
        if (prof.v5.questDay !== today) {
            prof.v5.questDay = today;
            prof.v5.quests = { stages: 0, wins: 0, trains: 0, dmg: 0, claimed: false };
        }
        (prof.customPowers || []).forEach(cp => {
            if (cp && cp.def && cp.def.icon) {
                cp.def.icon = keepLastThreeEmojis(cp.def.icon);
                if (SV_DEFS[cp.id]) SV_DEFS[cp.id].icon = cp.def.icon;
            }
        });
        return prof;
    }
 
    const _origGetSvProfileV5 = getSvProfile;
    getSvProfile = function(uname) {
        const p = _origGetSvProfileV5(uname);
        if (!p.v5) {
            p.v5 = {
                stars: {}, difficulty: 'normal', bossSouls: 0, elemCores: 0,
                equip: { weapon: 0, armor: 0, charm: 0 }, rebirths: 0,
                questDay: new Date().toISOString().slice(0, 10),
                quests: { stages: 0, wins: 0, trains: 0, dmg: 0, claimed: false }
            };
        }
        (p.customPowers || []).forEach(cp => {
            if (cp && cp.def && cp.def.icon) {
                cp.def.icon = keepLastThreeEmojis(cp.def.icon);
                if (SV_DEFS[cp.id]) SV_DEFS[cp.id].icon = cp.def.icon;
            }
        });
        return p;
    };
 
    const _origBuildFighterV5 = buildFighterObj;
    buildFighterObj = function(sockId, uname, powKey, customHp, customAtk, isBot = false, botId = null) {
        const f = _origBuildFighterV5(sockId, uname, powKey, customHp, customAtk, isBot, botId);
        if (isBot) return f;
        const prof = ensureV5Profile(uname);
        const v5 = prof.v5;
        const w = V5_GEAR_CATALOG.weapon[v5.equip.weapon || 0];
        const a = V5_GEAR_CATALOG.armor[v5.equip.armor || 0];
        const c = V5_GEAR_CATALOG.charm[v5.equip.charm || 0];
        const rebMult = 1 + ((v5.rebirths || 0) * 0.25);
 
        f.maxHp = Math.round((f.maxHp + a.hp) * rebMult);
        f.hp = f.maxHp;
        f.bonusAtk = Math.round((f.bonusAtk + w.atk) * rebMult);
        f.energy = Math.min(100, (f.energy || 50) + c.energy);
        f.trainBonus = { ...(f.trainBonus || {}), critChance: Math.min(0.75, (f.trainBonus?.critChance || 0) + w.crit) };
        if (a.red > 0) f.def = { ...f.def, passiveRed: Math.min(0.75, (f.def.passiveRed || 0) + a.red) };
        if (c.steal > 0) f.enchant = { ...(f.enchant || { mult: 1, red: 0, heal: 0 }), heal: (f.enchant?.heal || 0) + c.steal };
        return f;
    };
 
    const _prevIoToV5 = io.to.bind(io);
    io.to = function(room) {
        const bc = _prevIoToV5(room);
        const origEmit = bc.emit.bind(bc);
        bc.emit = function(ev, payload, ...rest) {
            if (ev === 'message' && payload && typeof payload === 'object' && payload.username) {
                const rawClean = String(payload.username).replace(/^\[.*?\]\s*/g, '');
                const st = svPlayerStats[rawClean.toLowerCase().trim()];
                if (st && st.v5 && st.v5.rebirths > 0 && !String(payload.username).includes('??R')) {
                    payload = { ...payload, username: `[??R${st.v5.rebirths}] ${payload.username}` };
                }
            }
            return origEmit(ev, payload, ...rest);
        };
        return bc;
 
  };
    // ============================================================================
    // ?? SAMMUVERSE V5 EXPANSION - PART A/3 (STAGE ENGINE & REWARDS)
    // ============================================================================
    function launchV5Stage(socket, chNum, stgNum, powKey, diff, coopPartnerName) {
        const srvId = socket.activeServerId;
        const uname = socket.username || 'Hero';
        const chObj = V5_CHAPTERS.find(c => c.ch === chNum) || V5_CHAPTERS.at(0);
        const stageIdx = Math.max(0, Math.min(2, (stgNum || 1) - 1));
        const enemyName = chObj.stages.at(stageIdx);
        const diffMode = ['normal', 'hard', 'nightmare'].includes(diff) ? diff : 'normal';
        const diffMult = diffMode === 'nightmare' ? 2.4 : (diffMode === 'hard' ? 1.55 : 1.0);
        const stgMult = stageIdx === 2 ? 1.45 : (stageIdx === 1 ? 1.18 : 1.0);
 
        const p1 = buildFighterObj(socket.id, uname, powKey || 'fire');
        if (coopPartnerName) {
            const partnerProf = ensureV5Profile(coopPartnerName);
            p1.maxHp += 180 + ((partnerProf.hpLv || 0) * 25) + ((partnerProf.v5?.rebirths || 0) * 150);
            p1.hp = p1.maxHp;
            p1.bonusAtk += 25 + ((partnerProf.atkLv || 0) * 5) + ((partnerProf.v5?.rebirths || 0) * 30);
            p1.name = `${uname} + ?? ${coopPartnerName}`;
        }
 
        const hp = Math.round(chObj.baseHp * stgMult * diffMult);
        const atk = Math.round(chObj.baseAtk * stgMult * diffMult);
        const p2 = buildFighterObj('ADV_FOE', `${enemyName} [${diffMode.toUpperCase()}]`, chObj.pKey, hp, atk, true, 'ADV_FOE');
        p2.isV2 = chNum >= 3 || diffMode !== 'normal';
        p2.isV3 = chNum >= 5 || diffMode === 'nightmare';
 
        const battleId = 'adv5_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const battle = {
            id: battleId, srvId, isAdventureV5: true,
            advChapter: chNum, advStage: stgNum, advDiff: diffMode, advTitle: chObj.title,
            coopPartner: coopPartnerName || null,
            turn: 1, timeLeft: 15,
            lastLog: `??? <b>${chObj.title} (${diffMode.toUpperCase()} • Stage ${stgNum}/3)</b> - <b>${enemyName}</b> blocks your path!`,
            p1, p2, interval: null
        };
        svBattles.set(battleId, battle);
        battle.interval = setInterval(() => {
            const cur = svBattles.get(battleId);
            if (!cur) return;
            cur.timeLeft--;
            if (cur.timeLeft <= 0) resolveSvTurn(battleId);
            else syncSvBattle(cur, null);
        }, 1000);
        syncSvBattle(battle, 'atk');
    }
 
    const _prevFinishSvBattleV5 = finishSvBattle;
    finishSvBattle = function(battleId, b) {
        if (!b) return;
        if (!b.p1.isBot && b.p1.hp > b.p2.hp) {
            const cleanP1 = b.p1.name.split(' + ?? ').at(0);
            const qp = ensureV5Profile(cleanP1);
            qp.v5.quests.wins = (qp.v5.quests.wins || 0) + 1;
            qp.v5.quests.dmg = (qp.v5.quests.dmg || 0) + b.p2.maxHp;
        }
 
        if (!b.isAdventureV5) return _prevFinishSvBattleV5(battleId, b);
 
        clearInterval(b.interval);
        svBattles.delete(battleId);
        const p1Won = b.p1.hp > b.p2.hp;
        const pSock = io.sockets.sockets.get(b.p1.id);
        io.to(b.p1.id).emit('svBattleEnd', { won: p1Won, _serverId: b.srvId });
 
        const cleanName = b.p1.name.split(' + ?? ').at(0);
        if (!p1Won || !pSock) {
            io.to(b.srvId).emit('message', {
                username: "Sammu's Bot",
                text: `????? **STAGE DEFEAT!** **${b.p1.name}** fell in **${b.advTitle}** (${b.advDiff.toUpperCase()})! Upgrade Gear or bring a Co-Op partner!`,
                _serverId: b.srvId
            });
            return;
        }
 
        const prof = ensureV5Profile(cleanName);
        const v5 = prof.v5;
        const chObj = V5_CHAPTERS.find(c => c.ch === b.advChapter) || V5_CHAPTERS.at(0);
        const isBoss = b.advStage >= 3;
        const diffMult = b.advDiff === 'nightmare' ? 2.5 : (b.advDiff === 'hard' ? 1.6 : 1.0);
 
        let starsEarned = 1;
        if (b.p1.hp >= Math.round(b.p1.maxHp * 0.5)) starsEarned = 2;
        if (b.p1.hp >= Math.round(b.p1.maxHp * 0.5) && b.turn <= 4) starsEarned = 3;
 
        const starKey = `${b.advChapter}_${b.advStage}_${b.advDiff}`;
        v5.stars[starKey] = Math.max(v5.stars[starKey] || 0, starsEarned);
 
        const cGain = Math.round((isBoss ? chObj.coins : chObj.coins * 0.45) * diffMult);
        const xpGain = Math.round((isBoss ? chObj.xp : chObj.xp * 0.45) * diffMult);
        const essGain = Math.round((isBoss ? chObj.ess : chObj.ess * 0.45) * diffMult);
 
        addCoins(cleanName, cGain);
        prof.training.xp = (prof.training.xp || 0) + xpGain;
        prof.petEssence = (prof.petEssence || 0) + essGain;
        v5.quests.stages = (v5.quests.stages || 0) + 1;
        v5.quests.wins = (v5.quests.wins || 0) + 1;
        v5.quests.dmg = (v5.quests.dmg || 0) + b.p2.maxHp;
 
        let dropText = '';
        if (isBoss || Math.random() < 0.45) {
            if (chObj.drop === 'soul') { v5.bossSouls = (v5.bossSouls || 0) + 1; dropText = ' + ?? **1x Boss Soul**'; }
            else { v5.elemCores = (v5.elemCores || 0) + 1; dropText = ' + ?? **1x Elemental Core**'; }
        }
        if (b.coopPartner) {
            addCoins(b.coopPartner, Math.round(cGain * 0.5));
            const pPartner = ensureV5Profile(b.coopPartner);
            pPartner.petEssence = (pPartner.petEssence || 0) + Math.round(essGain * 0.5);
        }
 
        const adv = prof.adventure || { chapter: 1, stage: 1, cleared: false };
        if (adv.chapter === b.advChapter && adv.stage === b.advStage) {
            if (adv.stage < 3) adv.stage++;
            else if (adv.chapter < 10) { adv.chapter++; adv.stage = 1; }
            else adv.cleared = true;
        }
 
        syncPlayerTitlesAndBounty(cleanName);
        saveSvStats();
        pSock.emit('svStatsSync', ensureV5Profile(cleanName));
        io.to(b.srvId).emit('message', {
            username: "Sammu's Bot",
            text: `???${'?'.repeat(starsEarned)} **STAGE CLEARED!** **${b.p1.name}** conquered **${b.p2.name}** (+
${cGain.toLocaleString()}??, +${xpGain}? XP, +${essGain}??${dropText})!`,
            _serverId: b.srvId
        });
    };
    // ============================================================================
    // ?? SAMMUVERSE V5 EXPANSION - PART B/3 (SOCKET LISTENERS)
    // ============================================================================
    io.on('connection', (socket) => {
        socket.on('svTrainAction', () => {
            const uname = socket.username;
            if (!uname) return;
            const prof = ensureV5Profile(uname);
            prof.v5.quests.trains = (prof.v5.quests.trains || 0) + 1;
            saveSvStats();
            socket.emit('svStatsSync', prof);
        });
 
        socket.on('svStartStageV5', ({ ch, stg, power, diff, coopPartner }) => {
            if (!socket.activeServerId || findPlayerActiveSvBattle(socket.id)) {
                return socket.emit('svNotice', '?? Finish your current battle first!');
            }
            launchV5Stage(socket, Number(ch) || 1, Number(stg) || 1, power || 'fire', diff || 'normal', coopPartner || '');
        });
 
        socket.on('svUpgradeGearV5', (slot) => {
            const uname = socket.username || 'Player';
            if (!verifyPlayerAccountOwnership(uname, socket, false) || !['weapon', 'armor', 'charm'].includes(slot)) return;
            const prof = ensureV5Profile(uname);
            const v5 = prof.v5;
            const curTier = v5.equip[slot] || 0;
            const nextItem = V5_GEAR_CATALOG[slot].at(curTier + 1);
            if (!nextItem) return socket.emit('svNotice', '?? Already at MYTHIC Max Tier!');
 
            if (getCoins(uname) < nextItem.cost) return socket.emit('svNotice', `?? Need ${nextItem.cost.toLocaleString()} Coins!`);
            if (nextItem.souls && (v5.bossSouls || 0) < nextItem.souls) return socket.emit('svNotice', `?? Need ${nextItem.souls} Boss Souls!`);
            if (nextItem.cores && (v5.elemCores || 0) < nextItem.cores) return socket.emit('svNotice', `?? Need ${nextItem.cores} Elemental Cores!`);
 
            addCoins(uname, -nextItem.cost);
            if (nextItem.souls) v5.bossSouls -= nextItem.souls;
            if (nextItem.cores) v5.elemCores -= nextItem.cores;
            v5.equip[slot] = curTier + 1;
 
            saveSvStats();
            socket.emit('svStatsSync', ensureV5Profile(uname));
            socket.emit('svNotice', `?? Upgraded ${slot.toUpperCase()} to ${nextItem.name}!`);
        });
 
        socket.on('svClaimDailyQuestV5', () => {
            const uname = socket.username || 'Player';
            const prof = ensureV5Profile(uname);
            const q = prof.v5.quests;
            if (q.claimed) return socket.emit('svNotice', '? Daily Mythic Crate already claimed today!');
            if ((q.stages || 0) < 2 || (q.wins || 0) < 1 || (q.trains || 0) < 3 || (q.dmg || 0) < 500) {
                return socket.emit('svNotice', '?? Complete all 4 Daily Quests first!');
            }
            q.claimed = true;
            addCoins(uname, 3000);
            prof.petEssence = (prof.petEssence || 0) + 50;
            prof.freeFusionPasses = (prof.freeFusionPasses || 0) + 1;
            saveSvStats();
            socket.emit('svStatsSync', ensureV5Profile(uname));
            socket.emit('svNotice', '???? DAILY MYTHIC CRATE OPENED! +3,000??, +50?? Essence & +1 Free Fusion Pass!');
        });
 
        socket.on('svRebirthV5', () => {
            const uname = socket.username || 'Player';
            if (!verifyPlayerAccountOwnership(uname, socket, false)) return;
            const prof = ensureV5Profile(uname);
            const canRebirth = (prof.maxTowerFloor || 1) >= 25 || (prof.adventure?.chapter || 1) >= 5 || prof.adventure?.cleared;
            if (!canRebirth) return socket.emit('svNotice', '?? Reach Tower Floor 25 or Adventure Chapter 5 to Rebirth!');
 
            prof.v5.rebirths = (prof.v5.rebirths || 0) + 1;
            prof.atkLv = 0;
            prof.hpLv = 0;
            prof.adventure = { chapter: 1, stage: 1, cleared: false };
            addCoins(uname, 5000);
            saveSvStats();
            socket.emit('svStatsSync', ensureV5Profile(uname));
            io.to(socket.activeServerId).emit('message', {
                username: "Sammu's Bot",
                text: `???? **REBIRTH ASCENSION!** **${uname}** reached **Rebirth ${prof.v5.rebirths}** (+${prof.v5.rebirths * 25}% Permanent All-Stats & Chat Badge)!`,
       
        _serverId: socket.activeServerId
            });
        });
    });
    // ============================================================================
    // ?? SAMMUVERSE V5 - PART C-1 (10-REALM STORY & CO-OP UI)
    // ============================================================================
    const V5_UI_C1 = `
    <script>
    (function() {
      if (window._svV5Installed) return;
      window._svV5Installed = true;
 
      const V5_CH_CLIENT = [
        { ch: 1, title: '?? Ch.1: Whispering Dojo', reward: '350?? • ?? Soul' },
        { ch: 2, title: '?? Ch.2: Crimson Volcano', reward: '700?? • ?? Core' },
        { ch: 3, title: '?? Ch.3: Abyssal Trench', reward: '1.2k?? • ?? Soul' },
        { ch: 4, title: '? Ch.4: Celestial Citadel', reward: '2.2k?? • ?? Core' },
        { ch: 5, title: '?? Ch.5: Void Throne', reward: '5.0k?? • ?? Soul' },
        { ch: 6, title: '?? Ch.6: Frostbite Glacier', reward: '8.5k?? • ?? Core' },
        { ch: 7, title: '?? Ch.7: Crimson Moon Palace', reward: '13k?? • ?? Soul' },
        { ch: 8, title: '? Ch.8: Chrono Paradox Rift', reward: '19k?? • ?? Core' },
        { ch: 9, title: '?? Ch.9: Asura Hell Arena', reward: '28k?? • ?? Soul' },
        { ch: 10, title: '?? Ch.10: Omni-Creator Realm', reward: '45k?? • ?? Core' }
      ];
 
      window._v5Diff = 'normal';
      window._v5Coop = '';
 
      function keep3EmojisClient(str) {
        const s = String(str || '?').trim();
        if (typeof Intl !== 'undefined' && Intl.Segmenter) {
          return Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)).map(x => x.segment).slice(-3).join('');
        }
        return Array.from(s).slice(-3).join('');
      }
 
      window.renderV5StoryMode = function() {
        const prof = window._latestSvProf || {};
        const v5 = prof.v5 || { stars: {}, bossSouls: 0, elemCores: 0 };
 
        document.querySelectorAll('#svPowerGrid .sv-pwr-btn').forEach(btn => {
          const txt = btn.textContent || '';
          if (txt.includes('[#')) {
                        let parts = txt.split(' ');
            const first = parts.at(0);
            if (first && Array.from(first).length > 4) {
              parts[0] = keep3EmojisClient(first);
              btn.textContent = parts.join(' ');
       
    }
          }
        });
 
        const advPanel = document.getElementById('svAdvPanel');
        const listBox = document.getElementById('svAdventureChaptersList');
        if (!advPanel || !listBox) return;
 
        let toolbar = document.getElementById('v5StoryToolbar');
        if (!toolbar) {
          toolbar = document.createElement('div');
          toolbar.id = 'v5StoryToolbar';
          toolbar.style.cssText = 'background:#090d16;border:1px solid #38bdf8;border-radius:11px;padding:7px;margin-bottom:8px;font-size:11px;';
          advPanel.insertBefore(toolbar, listBox);
        }
 
        const totalStars = Object.values(v5.stars || {}).reduce((a, b) => a + b, 0);
        const liveOpts = Array.from(document.querySelectorAll('#svOpponentSelect option'))
          .filter(o => !o.value.startsWith('BOT_'))
          .map(o => {
            const cleanN = o.textContent.split(' (').at(0).replace('?? ', '');
            return '<option value="' + cleanN + '"' + (window._v5Coop === cleanN ? ' selected' : '') + '>?? Co-Op: ' + cleanN + '</option>';
          }).join('');
 
        toolbar.innerHTML =
          '<div style="display:flex;justify-content:space-between;font-weight:900;color:#fde047;margin-bottom:5px;">' +
            '<span>? Stars: ' + totalStars + '/90</span>' +
            '<span>?? Souls: ' + (v5.bossSouls || 0) + ' | ?? Cores: ' + (v5.elemCores || 0) + '</span>' +
          '</div>' +
          '<div style="display:flex;gap:4px;margin-bottom:5px;">' +
            new Array('normal', 'hard', 'nightmare').map(d =>
              '<button onclick="window._v5Diff=\\'' + d + '\\';renderV5StoryMode()" style="flex:1;padding:5px;border-radius:8px;border:1px solid #facc15;background:' + (window._v5Diff === d ? '#d97706' : '#1e293b') + ';color:#fff;font-weight:900;font-size:10px;cursor:pointer;">' + d.toUpperCase() + '</button>'
            ).join('') +
          '</div>' +
          '<select onchange="window._v5Coop=this.value" style="width:100%;padding:5px;border-radius:8px;border:1px solid #4ade80;background:#1e293b;color:#fff;font-size:10px;">' +
            '<option value="">?? Solo Stage Run (Or Pick Co-Op Partner)</option>' + liveOpts +
          '</select>';
 
        const adv = prof.adventure || { chapter: 1, stage: 1, cleared: false };
        listBox.innerHTML = V5_CH_CLIENT.map(c => {
          const unlocked = adv.cleared || adv.chapter >= c.ch;
          const curStg = (!adv.cleared && adv.chapter === c.ch) ? (adv.stage || 1) : 3;
          const s1 = v5.stars?.[c.ch + '_1_' + window._v5Diff] || 0;
          const s2 = v5.stars?.[c.ch + '_2_' + window._v5Diff] || 0;
          const s3 = v5.stars?.[c.ch + '_3_' + window._v5Diff] || 0;
          const stageBtns = new Array(1, 2, 3).map(stNum => {
            const canPlay = adv.cleared || adv.chapter > c.ch || stNum <= curStg;
            const stStars = stNum === 1 ? s1 : (stNum === 2 ? s2 : s3);
            return '<button ' + (canPlay ? '' : 'disabled') + ' onclick="socket.emit(\\'svStartStageV5\\',{ch:' + c.ch + ',stg:' + stNum + ',power:window._curSvPow||\\'fire\\',diff:window._v5Diff,coopPartner:window._v5Coop})" style="padding:5px 2px;border:none;border-radius:7px;background:' + (canPlay ? '#16a34a' : '#334155') + ';color:#fff;font-size:10px;font-weight:bold;cursor:pointer;">' +
              (canPlay ? ('S' + stNum + ' ' + '?'.repeat(stStars)) : '?? S' + stNum) + '</button>';
          }).join('');
 
          return '<div class="sv-shop-card" style="border-color:' + (unlocked ? '#38bdf8' : '#334155') + ';flex-direction:column;align-items:stretch;gap:5px;">' +
            '<div style="display:flex;justify-content:space-between;">' +
              '<b style="color:' + (unlocked ? '#fde047' : '#94a3b8') + ';">' + c.title + '</b>' +
              '<span style="color:#4ade80;font-weight:bold;">' + c.reward + '</span>' +
            '</div>' +
            (unlocked ? '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;">' + stageBtns + '</div>' : '<div style="font-size:10px;color:#94a3b8;">?? Clear Chapter ' + (c.ch - 1) + ' first</
div>') +
          '</div>';
        }).join('');
      };
    `;
    // ============================================================================
    // ?? SAMMUVERSE V5 - PART C-2 (GEAR FORGE, DAILY QUESTS & REBIRTH UI)
    // ============================================================================
    const V5_UI_C2 = `
      const V5_GEAR_UI = {
        weapon: new Array('None', '??? Iron Katana (600??+1??)', '? Raijin Blade (2.5k??+3??)', '?? Enma Hellblade (9k??+7??)', '?? Sudarshana Edge (28k??+15??)'),
        armor: new Array('None', '?? Dojo Gi (600??+1??)', '??? Aegis Plate (2.5k??+3??)', '?? Shadow Cloak (9k??+7??)', '?? Celestial Kavach (28k??+15??)'),
        charm: new Array('None', '?? Spirit Bead (600??+1??)', '?? Crimson Fang (2.5k??+3??)', '? Chrono Relic (9k??+7??)', '?? Omni Crown (28k??+15??)')
      };
 
      window.renderV5DojoAndQuests = function() {
        const prof = window._latestSvProf || {};
        const v5 = prof.v5 || { bossSouls: 0, elemCores: 0, equip: { weapon: 0, armor: 0, charm: 0 }, rebirths: 0, quests: {} };
        const dojoPanel = document.getElementById('svDojoPanel');
        if (!dojoPanel) return;
 
        let v5Box = document.getElementById('v5DojoExpansionBox');
        if (!v5Box) {
          v5Box = document.createElement('div');
          v5Box.id = 'v5DojoExpansionBox';
          dojoPanel.insertBefore(v5Box, dojoPanel.children.at(1) || dojoPanel.firstChild);
        }
 
        const q = v5.quests || { stages: 0, wins: 0, trains: 0, dmg: 0, claimed: false };
        const wLv = v5.equip?.weapon || 0;
        const aLv = v5.equip?.armor || 0;
        const cLv = v5.equip?.charm || 0;
 
        v5Box.innerHTML =
          '<div style="background:rgba(56,189,248,0.12);border:1.5px solid #38bdf8;border-radius:11px;padding:8px;margin-bottom:7px;text-align:left;">' +
            '<div style="font-size:11px;font-weight:900;color:#7dd3fc;margin-bottom:5px;">?? 3-SLOT GEAR FORGE (??' + (v5.bossSouls || 0) + ' Souls | ??' + (v5.elemCores || 0) + ' Cores)</div>' +
            '<div class="sv-shop-card"><div><b>?? Weapon:</b> ' + V5_GEAR_UI.weapon.at(wLv) + '<br><span style="color:#fde047;">Next: ' + (V5_GEAR_UI.weapon.at(wLv + 1) || 'MAXED ??') + '</span></div><button ' + (wLv >= 4 ? 'disabled' : '') + ' onclick="socket.emit(\\'svUpgradeGearV5\\',\\'weapon\\')" style="background:#0284c7;border:none;color:#fff;padding:6px 8px;border-radius:8px;font-weight:900;cursor:pointer;">' + (wLv >= 4 ? 'MAX' : 'Forge') + '</button></div>' +
            '<div class="sv-shop-card"><div><b>??? Armor:</b> ' + V5_GEAR_UI.armor.at(aLv) + '<br><span style="color:#fde047;">Next: ' + (V5_GEAR_UI.armor.at(aLv + 1) || 'MAXED ??') + '</span></div><button ' + (aLv >= 4 ? 'disabled' : '') + ' onclick="socket.emit(\\'svUpgradeGearV5\\',\\'armor\\')" style="background:#0284c7;border:none;color:#fff;padding:6px 8px;border-radius:8px;font-weight:900;cursor:pointer;">' + (aLv >= 4 ? 'MAX' : 'Forge') + '</button></div>' +
            '<div class="sv-shop-card"><div><b>?? Charm:</b> ' + V5_GEAR_UI.charm.at(cLv) + '<br><span style="color:#fde047;">Next: ' + (V5_GEAR_UI.charm.at(cLv + 1) || 'MAXED ??') + '</span></div><button ' + (cLv >= 4 ? 'disabled' : '') + ' onclick="socket.emit(\\'svUpgradeGearV5\\',\\'charm\\')" style="background:#0284c7;border:none;color:#fff;padding:6px 8px;border-radius:8px;font-weight:900;cursor:pointer;">' + (cLv >= 4 ? 'MAX' : 'Forge') + '</button></div>' +
          '</div>' +
 
          '<div style="background:rgba(250,204,21,0.12);border:1.5px solid #facc15;border-radius:11px;padding:8px;margin-bottom:7px;text-align:left;">' +
            '<div style="font-size:11px;font-weight:900;color:#fde047;margin-bottom:4px;">?? DAILY QUESTS (Reward: 3,000?? + 50?? + Free Fusion)</div>' +
            '<div style="font-size:10px;color:#e2e8f0;line-height:1.5;">' +
              '• Clear 2 Stages: <b>' + Math.min(2, q.stages || 0) + '/2</b> ' + ((q.stages || 0) >= 2 ? '?' : '') + '<br>' +
              '• Win 1 Battle: <b>' + Math.min(1, q.wins || 0) + '/1</b> ' + ((q.wins || 0) >= 1 ? '?' : '') + '<br>' +
              '• Train 3 Times: <b>' + Math.min(3, q.trains || 0) + '/3</b> ' + ((q.trains || 0) >= 3 ? '?' : '') + '<br>' +
              '• Deal 500 DMG: <b>' + Math.min(500, q.dmg || 0) + '/500</b> ' + ((q.dmg || 0) >= 500 ? '?' : '') +
            '</div>' +
            '<button ' + (q.claimed ? 'disabled' : '') + ' onclick="socket.emit(\\'svClaimDailyQuestV5\\')" style="width:100%;margin-top:5px;padding:7px;border:none;border-radius:8px;background:' + (q.claimed ? '#334155' : 'linear-gradient(90deg,#f59e0b,#ec4899)') + ';color:#fff;font-weight:900;font-size:11px;cursor:pointer;">' + (q.claimed ? '? Daily Mythic Crate Claimed' : '?? Claim Daily Mythic Crate!') + '</button>' +
          '</div>' +
 
          '<div class="sv-shop-card" style="border-color:#e879f9;">' +
            '<div><b style="color:#f0abfc;">?? Rebirth Ascension (Rebirth ' + (v5.rebirths || 0) + ')</b><br><span style="color:#cbd5e1;">Permanent +' + (((v5.rebirths || 0) + 1) * 25) + '% All-Stats & [??R' + ((v5.rebirths || 0) + 1) + '] Badge</span></div>' +
            '<button onclick="socket.emit(\\'svRebirthV5\\')" style="background:#9333ea;border:none;color:#fff;padding:6px 10px;border-radius:8px;font-weight:900;cursor:pointer;">?? Rebirth</button>' +
          '</div>';
      };
 
      setInterval(() => {
        if (typeof window.renderV5StoryMode === 'function') window.renderV5StoryMode();
        if (typeof window.renderV5DojoAndQuests === 'function') window.renderV5DojoAndQuests();
      }, 1200);
    })();
    </script>`;
 
    const V5_EXPANSION_UI = V5_UI_C1 + '\n' + V5_UI_C2;
 
    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (false && typeof body === 'string' && !body.includes('_svV5Installed')) {
                body = body.replace('</body>', V5_EXPANSION_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
     // ============================================================================
    // ?? ADMIN /UNLOCKUSER COMMAND (UNLOCKS DEVICE LOCK WITHOUT WIPING STATS)
    // ============================================================================
    io.on('connection', (socket) => {
        socket.on('chatMessage', (payload) => {
            const raw = (typeof payload === 'object' && payload) ? payload.text : payload;
            const srvId = socket.activeServerId;
            if (!srvId || typeof raw !== 'string') return;
            const clean = raw.trim();
            const low = clean.toLowerCase();
            const sender = (socket.username || (payload && payload.username) || '').toLowerCase().trim();
 
            // Auto-relink SammuVerse RPG lock when an OG Host uses a Master Key
            if (MASTER_KEYS.has(clean) && OG_HOSTS.has(sender)) {
                const prof = getSvProfile(sender);
                if (socket.trackedDeviceId) {
                    prof.ownerDevId = socket.trackedDeviceId;
                    saveSvStats();
                    socket.emit('svStatsSync', prof);
                }
                socket.emit('svNotice', `?? OG Host & RPG Account re-linked to this phone for ${sender}!`);
                return;
            }
 
            // Admin check (#hazmolerangola or Creators sammu/samaksh)
            const isAdmin = Boolean(
                socket.isHazmoleAdmin ||
                unlockedCommandAdmins.has(sender) ||
                sender === 'sammu' ||
                sender === 'samaksh'
            );
            if (!isAdmin) return;
 
            if (low.startsWith('/unlockuser ') || low.startsWith('/unlock ')) {
                const argStr = low.startsWith('/unlockuser ') ? clean.slice(12) : clean.slice(8);
                const target = argStr.replace(/^@/, '').trim().toLowerCase();
                if (!target) {
                    return socket.emit('message', { username: 'SYSTEM', text: '?? Usage: `/unlockuser @moon`', _serverId: srvId });
                }
 
                // 1. Clear OG Host Triple-Lock
                if (lockedOGSignatures[target]) {
                    delete lockedOGSignatures[target];
                    saveDB();
                }
 
                // 2. Clear SammuVerse RPG Device Lock (keeps all coins, powers & stats)
                const prof = getSvProfile(target);
                delete prof.ownerDevId;
                saveSvStats();
 
                // 3. Re-bind & notify immediately if the user is currently in the room
                for (const [, s] of io.sockets.sockets) {
                    if (s && s.username && s.username.toLowerCase().trim() === target) {
                        if (s.trackedDeviceId) {
                            prof.ownerDevId = s.trackedDeviceId;
                            saveSvStats();
                        }
                        s.emit('svStatsSync', prof);
                        s.emit('svNotice', ` Your account (${target}) was unlocked by Admin! You can spin & buy now!`);
                    }
                }
 
                io.to(srvId).emit('message', {
                    username: "Sammu's Bot",
                    text: ` **USER UNLOCKED:** **${target}**'s device lock was cleared! All coins, powers & stats are safe.`,
                    _serverId: srvId
                });
            }
        });
    });
     // ============================================================================
    // 🌌 SAMMUVERSE V6 - CLEAN PIECE 1/4 (W2 POWERS, REALMS 11-15, RELICS & AURAS)
    // ============================================================================
    Object.assign(SV_DEFS, {
        voidsov: {
            w2only: true, cost: 35000, icon: '🕳️', name: 'Void Sovereign',
            moves: [
                { label: 'Void Erasure (75 DMG)', dmg: 75 },
                { label: 'Singularity Collapse (105 True DMG)', dmg: 105, trueDmg: true },
                { label: 'Null Dimension (Evade +90 HP)', evade: true, heal: 90 },
                { label: '🌌 ABSOLUTE VOID ULT (195 True DMG)', dmg: 195, trueDmg: true, ult: true }
            ]
        },
        astralshenron: {
            w2only: true, cost: 45000, icon: '🐉', name: 'Astral Shenron',
            moves: [
                { label: 'Cosmic Dragon Breath (80 DMG)', dmg: 80 },
                { label: 'Wish Fulfillment (+65 HP & 95 DMG)', dmg: 95, heal: 65 },
                { label: 'Celestial Scales (Block 85%)', block: 0.85 },
                { label: '✨ ETERNAL DRAGON ULT (205 True DMG)', dmg: 205, trueDmg: true, ult: true }
            ]
        },
        hypernova: {
            w2only: true, cost: 55000, icon: '💥', name: 'Hypernova Monarch',
            moves: [
                { label: 'Solar Flare Slash (85 DMG)', dmg: 85 },
                { label: 'Supernova Burst (115 True DMG)', dmg: 115, trueDmg: true },
                { label: 'Corona Shield (Block 80% + 50 HP)', block: 0.8, heal: 50 },
                { label: '☀️ BIG BANG CATACLYSM ULT (220 True DMG)', dmg: 220, trueDmg: true, ult: true }
            ]
        }
    });

    const V6_AURAS = {
        demonic:    { name: 'Demonic Aura',     icon: '😈', cost: 15000, shards: 3, desc: '+18% Lifesteal & +15% DMG/Lv' },
        soulreaper: { name: 'Soul Reaper Aura', icon: '👻', cost: 15000, shards: 3, desc: '+20% Crit & +18% DMG/Lv' },
        divine:     { name: 'Divine Aura',      icon: '🔱', cost: 25000, shards: 5, desc: '+16% All-Stats & Stun Immune' },
        dragonic:   { name: 'Dragonic Aura',    icon: '🐉', cost: 20000, shards: 4, desc: '+22% HP & +16% DMG/Lv' },
        voidwalker: { name: 'Void Walker Aura', icon: '🌌', cost: 30000, shards: 6, desc: '+20% DMG & +15% Armor/Lv' }
    };

    const V6_RELICS = {
        astralBlade:  { name: 'Astral Blade',  icon: '🗡️', coins: 40000, shards: 5, crystals: 2, desc: '+25% ATK & +10% True DMG/Lv' },
        voidArmor:    { name: 'Void Armor',    icon: '🛡️', coins: 40000, shards: 4, crystals: 3, desc: '+30% Max HP & +12% Block/Lv' },
        infinityRing: { name: 'Infinity Ring', icon: '💍', coins: 60000, shards: 6, crystals: 5, desc: '+20% All-Stats & +15% Crit/Lv' }
    };

    const W2_CHAPTERS = [
        { ch: 11, name: 'Astral Harbor',    coins: 75000,  drop: 'shard',   hp: 4500,  atk: 190 },
        { ch: 12, name: 'Dragon Nebula',    coins: 110000, drop: 'crystal', hp: 6500,  atk: 240 },
        { ch: 13, name: 'Hypernova Core',   coins: 150000, drop: 'shard',   hp: 9000,  atk: 300 },
        { ch: 14, name: 'Blade Dimension',  coins: 200000, drop: 'crystal', hp: 12000, atk: 370 },
        { ch: 15, name: 'Eternity Throne',  coins: 300000, drop: 'both',    hp: 16000, atk: 450 }
    ];

    function ensureV6Profile(uname) {
        const prof = getSvProfile(uname);
        if (!prof.v6 || typeof prof.v6 !== 'object') prof.v6 = {};
        const v6 = prof.v6;
        if (typeof v6.w2Unlocked !== 'boolean') v6.w2Unlocked = false;
        if (typeof v6.w2Cleared !== 'boolean') v6.w2Cleared = false;
        if (!v6.w2Chapter) v6.w2Chapter = 11;
        if (!v6.w2Stage) v6.w2Stage = 1;
        if (!v6.w2BossKills) v6.w2BossKills = 0;
        if (typeof v6.astralShards !== 'number') v6.astralShards = 0;
        if (typeof v6.voidCrystals !== 'number') v6.voidCrystals = 0;
        if (!Array.isArray(v6.unlockedAuras)) v6.unlockedAuras = [];
        if (!v6.auraClass) v6.auraClass = '';
        if (!v6.auraLv) v6.auraLv = 1;
        if (!Array.isArray(v6.v4Powers)) v6.v4Powers = [];
        if (!v6.relics || typeof v6.relics !== 'object') v6.relics = { astralBlade: 0, voidArmor: 0, infinityRing: 0 };
        if (!v6.stars || typeof v6.stars !== 'object') v6.stars = {};
        return prof;
    }

      // ============================================================================
    // 🌌 SAMMUVERSE V6 - CLEAN PIECE 2/5 (WORLD 2 BATTLES & S1->S2->S3 PROGRESSION)
    // ============================================================================
    const _prevFinishSvBattleV6 = typeof finishSvBattle === 'function' ? finishSvBattle : null;

    function applyV6BattleRewards(battleId, b) {
        if (!b || !b.isW2 || b._v6Rewarded) return;
        b._v6Rewarded = true;
        const cleanName = b.p1 && b.p1.name ? b.p1.name : '';
        if (!cleanName) return;

        const prof = ensureV6Profile(cleanName);
        const v6 = prof.v6;
        const chObj = W2_CHAPTERS.find(c => c.ch === b.w2Chapter) || W2_CHAPTERS.at(0);
        const diffMult = b.w2Diff === 'nightmare' ? 2.5 : (b.w2Diff === 'hard' ? 1.6 : 1.0);

        let stars = 1;
        if (b.p1.hp >= Math.round(b.p1.maxHp * 0.5)) stars = 2;
        if (b.p1.hp >= Math.round(b.p1.maxHp * 0.8) && b.turn <= 5) stars = 3;
        const starKey = b.w2Chapter + '_' + b.w2Stage;
        v6.stars[starKey] = Math.max(v6.stars[starKey] || 0, stars);

        const coinGain = Math.round((chObj.coins || 75000) * 0.45 * diffMult);
        const xpGain = Math.round((chObj.coins || 75000) * 0.02 * diffMult);
        addCoins(cleanName, coinGain);
        const tr = ensureTrainingProfile(prof);
        tr.xp = (tr.xp || 0) + xpGain;

        let dropTxt = '';
        if (b.w2Stage === 3) {
            v6.w2BossKills = (v6.w2BossKills || 0) + 1;
            if (chObj.drop === 'shard' || chObj.drop === 'both') {
                v6.astralShards += 2;
                dropTxt += ' + 🔷 2x Astral Shards';
            }
            if (chObj.drop === 'crystal' || chObj.drop === 'both') {
                v6.voidCrystals += 2;
                dropTxt += ' + 💎 2x Void Crystals';
            }
        } else {
            v6.astralShards += 1;
            dropTxt = ' + 🔷 1x Astral Shard';
        }

        // Advance Stage S1 -> S2 -> S3 -> Next Chapter cleanly!
        if (v6.w2Chapter === b.w2Chapter && v6.w2Stage === b.w2Stage) {
            if (v6.w2Stage < 3) {
                v6.w2Stage += 1;
            } else if (v6.w2Chapter < 15) {
                v6.w2Chapter += 1;
                v6.w2Stage = 1;
            } else {
                v6.w2Cleared = true;
            }
        }

        saveSvStats();
        const pSock = Array.from(io.sockets.sockets.values()).find(s => s.username === cleanName);
        if (pSock) pSock.emit('svStatsSync', ensureV6Profile(cleanName));
        if (b.srvId) {
            io.to(b.srvId).emit('message', {
                username: "Sammu's Bot",
                text: `🌌${'⭐'.repeat(stars)} **W2 CH.${b.w2Chapter}-S${b.w2Stage} CLEARED!** +${coinGain.toLocaleString()}🪙 +${xpGain.toLocaleString()} XP${dropTxt}!`,
                _serverId: b.srvId
            });
        }
    }

    io.on('connection', (socket) => {
        socket.on('svStartW2Gatekeeper', (powKey) => {
            const uname = socket.username || 'Player';
            if (!socket.activeServerId) return;
            const prof = ensureV6Profile(uname);
            if (prof.v6.w2Unlocked) return socket.emit('svNotice', '🌌 World 2 is already unlocked!');
            if (!prof.adventure || !prof.adventure.cleared) {
                return socket.emit('svNotice', '🔒 Clear World 1 (Chapter 5, Stage 3) first!');
            }
            if (getCoins(uname) < 25000) return socket.emit('svNotice', '🪙 Need 25,000 Coins to challenge Gatekeeper!');

            addCoins(uname, -25000);
            const p1 = buildFighterObj(socket.id, uname, powKey || 'fire');
            const p2 = buildFighterObj('W2_GATE', '🌌 ASTRAL GATEKEEPER', 'voidsov', 6500, 145, true, 'W2_GATE');
            p2.isV2 = true; p2.isV3 = true;

            const battleId = 'w2gate_' + Date.now();
            const battle = {
                id: battleId, srvId: socket.activeServerId, isW2Gatekeeper: true,
                p1, p2, turn: 1, timeLeft: 15, logs: []
            };
            svBattles.set(battleId, battle);
            battle.interval = setInterval(() => {
                const c = svBattles.get(battleId);
                if (!c) return;
                c.timeLeft -= 1;
                if (c.timeLeft <= 0) resolveSvTurn(battleId);
                else syncSvBattle(c, null);
            }, 1000);
            syncSvBattle(battle, '🌌 Astral Gatekeeper descends!');
        });

        socket.on('svStartW2Stage', (data) => {
            const { ch, stg, power, diff } = data || {};
            const uname = socket.username || 'Player';
            if (!socket.activeServerId) return;
            const prof = ensureV6Profile(uname);
            const v6 = prof.v6;
            if (!v6.w2Unlocked) return socket.emit('svNotice', '🔒 Defeat the Astral Gatekeeper to unlock World 2!');

            const chNum = Number(ch) || 11;
            const stgNum = Number(stg) || 1;
            const chObj = W2_CHAPTERS.find(c => c.ch === chNum);
            if (!chObj) return;

            const prevOk = stgNum === 1
                ? (chNum === 11 || v6.stars[(chNum - 1) + '_3'] > 0 || v6.w2Cleared || v6.w2Chapter >= chNum)
                : (v6.stars[chNum + '_' + (stgNum - 1)] > 0 || v6.w2Cleared || v6.w2Chapter > chNum || (v6.w2Chapter === chNum && v6.w2Stage >= stgNum));
            if (!prevOk) return socket.emit('svNotice', '🔒 Clear the previous stage first!');

            const mult = (diff === 'nightmare' ? 2.2 : (diff === 'hard' ? 1.5 : 1.0)) * (1 + (stgNum - 1) * 0.25);
            const bossHp = Math.round(chObj.hp * mult);
            const bossAtk = Math.round(chObj.atk * mult);
            const p1 = buildFighterObj(socket.id, uname, power || 'fire');
            const p2 = buildFighterObj('W2_BOSS', `🪐 ${chObj.name} (S${stgNum})`, 'astralshenron', bossHp, bossAtk, true, 'W2_BOSS');
            p2.isV2 = true; p2.isV3 = true;

            const battleId = 'w2stg_' + Date.now();
            const battle = {
                id: battleId, srvId: socket.activeServerId, isW2: true,
                w2Chapter: chNum, w2Stage: stgNum, w2Diff: diff || 'normal',
                p1, p2, turn: 1, timeLeft: 15, logs: []
            };
            svBattles.set(battleId, battle);
            battle.interval = setInterval(() => {
                const c = svBattles.get(battleId);
                if (!c) return;
                c.timeLeft -= 1;
                if (c.timeLeft <= 0) {
                    const snap = svBattles.get(battleId);
                    resolveSvTurn(battleId);
                    if (snap && snap.p2 && snap.p2.hp <= 0) applyV6BattleRewards(battleId, snap);
                } else {
                    syncSvBattle(c, null);
                }
            }, 1000);
            syncSvBattle(battle, `🪐 Entered ${chObj.name} Stage ${stgNum}!`);
        });
    });
                                          ;
       // ============================================================================
    // 🌌 SAMMUVERSE V6 - CLEAN PIECE 3/5 (AURAS, V4 TEMPLE, RELICS & #sammuv6god)
    // ============================================================================
    if (typeof finishSvBattle === 'function') {
        const _origFinishV6 = finishSvBattle;
        finishSvBattle = function(battleId, winnerSide) {
            const b = svBattles.get(battleId);
            if (b && winnerSide === 'p1') {
                if (b.isW2) applyV6BattleRewards(battleId, b);
                if (b.isW2Gatekeeper && b.p1 && b.p1.name) {
                    const prof = ensureV6Profile(b.p1.name);
                    prof.v6.w2Unlocked = true;
                    saveSvStats();
                    const pSock = Array.from(io.sockets.sockets.values()).find(s => s.username === b.p1.name);
                    if (pSock) {
                        pSock.emit('svStatsSync', ensureV6Profile(b.p1.name));
                        pSock.emit('svNotice', '🌌 ASTRAL GATEKEEPER DEFEATED! World 2 Unlocked!');
                    }
                }
                if (b.isV4Trial && b.p1 && b.p1.name && b.trialPow) {
                    const prof = ensureV6Profile(b.p1.name);
                    if (!prof.v6.v4Powers.includes(b.trialPow)) prof.v6.v4Powers.push(b.trialPow);
                    saveSvStats();
                    const pSock = Array.from(io.sockets.sockets.values()).find(s => s.username === b.p1.name);
                    if (pSock) {
                        pSock.emit('svStatsSync', ensureV6Profile(b.p1.name));
                        pSock.emit('svNotice', `🔥 V4 AWAKENING COMPLETE! ${b.trialPow.toUpperCase()} ascended to V4!`);
                    }
                }
            }
            return _origFinishV6.apply(this, arguments);
        };
    }

    function applyMasterGodUnlock(uname) {
        const prof = ensureV6Profile(uname);
        const tr = ensureTrainingProfile(prof);
        const v6 = prof.v6;

        prof.unlockedPowers = Object.keys(SV_DEFS);
        prof.ownedPets = ['mochi', 'tommy', 'garuda', 'sheshnag', 'chimera', 'ouroboros'];
        prof.activePet = 'ouroboros';
        prof.activePet2 = 'chimera';
        prof.gears = { omegaCore: true, titanCrown: true };
        prof.adventure = { chapter: 5, stage: 3, cleared: true };
        prof.hasStone = true;
        prof.atkLv = 15; prof.hpLv = 15;
        prof.bounty = 30000000;
        prof.lineage = 'celestial'; prof.lineageStage = 3;
        prof.maxTowerFloor = 100; prof.towerCheckpoint = 100;
        tr.fistLv = 333334; tr.bodyLv = 333333; tr.chiLv = 333333; tr.xp = 1000000;
        if (!prof.powerWins) prof.powerWins = {};
        Object.keys(SV_DEFS).forEach(k => { prof.powerWins[k] = 100; });

        v6.w2Unlocked = true;
        v6.w2Cleared = true;
        v6.w2Chapter = 15;
        v6.w2Stage = 3;
        v6.w2BossKills = 15;
        v6.astralShards = 9999;
        v6.voidCrystals = 9999;
        v6.unlockedAuras = Object.keys(V6_AURAS);
        v6.auraClass = 'divine';
        v6.auraLv = 10;
        v6.v4Powers = Object.keys(SV_DEFS);
        v6.relics = { astralBlade: 10, voidArmor: 10, infinityRing: 10 };
        for (let ch = 11; ch <= 15; ch++) {
            for (let st = 1; st <= 3; st++) v6.stars[ch + '_' + st] = 3;
        }

        addCoins(uname, 9999999);
        syncPlayerTitlesAndBounty(uname);
        saveSvStats();
        return ensureV6Profile(uname);
    }

    io.on('connection', (socket) => {
        // Intercept #sammuv6god cleanly before V4 code handler
        socket.use((packet, next) => {
            if (packet && packet.at(0) === 'svUnlockCode') {
                const code = String(packet.at(1) || '').trim().toLowerCase();
                if (code === '#sammuv6god') {
                    const uname = (socket.username || '').trim();
                    if (!uname) return;
                    const updated = applyMasterGodUnlock(uname);
                    socket.emit('svStatsSync', updated);
                    socket.emit('svNotice', '👑🌌 MASTER CODE #sammuv6god UNLOCKED EVERYTHING (V4, World 2, Divine Aura, Relics & 9999 Shards/Crystals)!');
                    return;
                }
            }
            next();
        });

        socket.on('svAuraAction', (auraKey) => {
            const uname = socket.username || 'Player';
            const prof = ensureV6Profile(uname);
            const v6 = prof.v6;
            const au = V6_AURAS[auraKey];
            if (!au) return;

            if (!v6.unlockedAuras.includes(auraKey)) {
                if (getCoins(uname) < au.cost || v6.astralShards < au.shards) {
                    return socket.emit('svNotice', `🔒 Need ${au.cost.toLocaleString()}🪙 + ${au.shards}🔷 Shards!`);
                }
                addCoins(uname, -au.cost);
                v6.astralShards -= au.shards;
                v6.unlockedAuras.push(auraKey);
                v6.auraClass = auraKey;
                v6.auraLv = 1;
                saveSvStats();
                socket.emit('svStatsSync', prof);
                return socket.emit('svNotice', `${au.icon} Unlocked & Equipped ${au.name}!`);
            }

            if (v6.auraClass !== auraKey) {
                v6.auraClass = auraKey;
                saveSvStats();
                socket.emit('svStatsSync', prof);
                return socket.emit('svNotice', `${au.icon} Equipped ${au.name}!`);
            }

            const upCost = 15000 * (v6.auraLv || 1);
            const upShards = 3 * (v6.auraLv || 1);
            if ((v6.auraLv || 1) >= 10) return socket.emit('svNotice', '✨ Aura is already MAX Lv.10!');
            if (getCoins(uname) < upCost || v6.astralShards < upShards) {
                return socket.emit('svNotice', `🔒 Upgrade needs ${upCost.toLocaleString()}🪙 + ${upShards}🔷 Shards!`);
            }
            addCoins(uname, -upCost);
            v6.astralShards -= upShards;
            v6.auraLv = (v6.auraLv || 1) + 1;
            saveSvStats();
            socket.emit('svStatsSync', prof);
            socket.emit('svNotice', `${au.icon} ${au.name} upgraded to Lv.${v6.auraLv}!`);
        });

        socket.on('svForgeRelic', (relicKey) => {
            const uname = socket.username || 'Player';
            const prof = ensureV6Profile(uname);
            const v6 = prof.v6;
            const rel = V6_RELICS[relicKey];
            if (!rel) return;

            const curLv = v6.relics[relicKey] || 0;
            if (curLv >= 10) return socket.emit('svNotice', `✨ ${rel.name} is already MAX Lv.10!`);
            const mult = curLv + 1;
            const cCost = rel.coins * mult;
            const sCost = rel.shards * mult;
            const crCost = rel.crystals * mult;

            if (getCoins(uname) < cCost || v6.astralShards < sCost || v6.voidCrystals < crCost) {
                return socket.emit('svNotice', `🔒 Need ${cCost.toLocaleString()}🪙 + ${sCost}🔷 + ${crCost}💎!`);
            }
            addCoins(uname, -cCost);
            v6.astralShards -= sCost;
            v6.voidCrystals -= crCost;
            v6.relics[relicKey] = curLv + 1;
            saveSvStats();
            socket.emit('svStatsSync', prof);
            socket.emit('svNotice', `${rel.icon} Forged ${rel.name} to Lv.${v6.relics[relicKey]}!`);
        });

        socket.on('svStartV4Trial', (powKey) => {
            const uname = socket.username || 'Player';
            if (!socket.activeServerId) return;
            const prof = ensureV6Profile(uname);
            const v6 = prof.v6;
            const pk = powKey || 'fire';
            if (v6.v4Powers.includes(pk)) return socket.emit('svNotice', '🔥 This power is already awakened to V4!');
            if (!v6.w2Unlocked) return socket.emit('svNotice', '🔒 Unlock World 2 first!');
            if (((prof.powerWins && prof.powerWins[pk]) || 0) < 100) {
                return socket.emit('svNotice', '🔒 Need 100 V3 Wins with this power first!');
            }

            const p1 = buildFighterObj(socket.id, uname, pk);
            const p2 = buildFighterObj('V4_MIRROR', `🔥 V4 SHADOW MIRROR (${pk.toUpperCase()})`, pk, 8500, 175, true, 'V4_MIRROR');
            p2.isV2 = true; p2.isV3 = true;

            const battleId = 'v4trial_' + Date.now();
            const battle = {
                id: battleId, srvId: socket.activeServerId, isV4Trial: true, trialPow: pk,
                p1, p2, turn: 1, timeLeft: 15, logs: []
            };
            svBattles.set(battleId, battle);
            battle.interval = setInterval(() => {
                const c = svBattles.get(battleId);
                if (!c) return;
                c.timeLeft -= 1;
                if (c.timeLeft <= 0) resolveSvTurn(battleId);
                else syncSvBattle(c, null);
            }, 1000);
            syncSvBattle(battle, '🔥 V4 Temple Awakening Trial started!');
        });
    });
    // ============================================================================
    // 🌌 SAMMUVERSE V6 - CLEAN PIECE 4/5 (WORLD 2, AURA, V4 TEMPLE & RELIC FORGE UI)
    // ============================================================================
    const V6_CLEAN_UI_PART1 = `
    <script id="sammuverseV6CleanUI">
    (function() {
      if (window._svV6CleanLoaded) return;
      window._svV6CleanLoaded = true;
      window._svW2Diff = 'normal';

      const W2_LIST = [
        { ch: 11, name: 'Astral Harbor',   coins: '75k',  drop: '🔷 Shard' },
        { ch: 12, name: 'Dragon Nebula',   coins: '110k', drop: '💎 Crystal' },
        { ch: 13, name: 'Hypernova Core',  coins: '150k', drop: '🔷 Shard' },
        { ch: 14, name: 'Blade Dimension', coins: '200k', drop: '💎 Crystal' },
        { ch: 15, name: 'Eternity Throne', coins: '300k', drop: '🔷+💎 Both' }
      ];

      const AURA_LIST = [
        { k: 'demonic',    name: 'Demonic Aura',     icon: '😈', cost: '15k🪙 + 3🔷', desc: '+18% Lifesteal & +15% DMG/Lv' },
        { k: 'soulreaper', name: 'Soul Reaper Aura', icon: '👻', cost: '15k🪙 + 3🔷', desc: '+20% Crit & +18% DMG/Lv' },
        { k: 'divine',     name: 'Divine Aura',      icon: '🔱', cost: '25k🪙 + 5🔷', desc: '+16% All-Stats & Stun Immune' },
        { k: 'dragonic',   name: 'Dragonic Aura',    icon: '🐉', cost: '20k🪙 + 4🔷', desc: '+22% HP & +16% DMG/Lv' },
        { k: 'voidwalker', name: 'Void Walker Aura', icon: '🌌', cost: '30k🪙 + 6🔷', desc: '+20% DMG & +15% Armor/Lv' }
      ];

      const RELIC_LIST = [
        { k: 'astralBlade',  name: 'Astral Blade',  icon: '🗡️', c: 40000, s: 5, cr: 2, desc: '+25% ATK & +10% True DMG/Lv' },
        { k: 'voidArmor',    name: 'Void Armor',    icon: '🛡️', c: 40000, s: 4, cr: 3, desc: '+30% Max HP & +12% Block/Lv' },
        { k: 'infinityRing', name: 'Infinity Ring', icon: '💍', c: 60000, s: 6, cr: 5, desc: '+20% All-Stats & +15% Crit/Lv' }
      ];

      window.setSvV6Tab = function(tab) {
        window._svV6ActiveTab = tab;
        const w1 = document.getElementById('svAdvList');
        const w2 = document.getElementById('svV6W2Box');
        const au = document.getElementById('svV6AuraBox');
        if (w1) w1.style.display = (tab === 'w1') ? 'block' : 'none';
        if (w2) w2.style.display = (tab === 'w2') ? 'block' : 'none';
        if (au) au.style.display = (tab === 'aura') ? 'block' : 'none';
        window.renderV6Panels();
      };

      window.renderV6Panels = function() {
        const advPanel = document.getElementById('svAdvPanel') || (document.getElementById('svAdvList') && document.getElementById('svAdvList').parentElement);
        if (!advPanel) return;

        let nav = document.getElementById('svV6NavBar');
        const prof = window._latestSvProf || {};
        const v6 = prof.v6 || {};
        const pow = window.selectedPower || 'fire';

        if (!nav) {
          nav = document.createElement('div');
          nav.id = 'svV6NavBar';
          nav.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:8px 0;';
          const advList = document.getElementById('svAdvList');
          if (advList) advPanel.insertBefore(nav, advList);
          else advPanel.appendChild(nav);
        }

        nav.innerHTML =
          '<button onclick="setSvV6Tab(\\'w1\\')" style="background:#0f172a;border:1px solid #38bdf8;color:#fff;padding:8px 4px;border-radius:10px;font-weight:900;font-size:11px;cursor:pointer;">🌍 World 1</button>' +
          '<button onclick="setSvV6Tab(\\'w2\\')" style="background:#581c87;border:1px solid #c084fc;color:#fff;padding:8px 4px;border-radius:10px;font-weight:900;font-size:11px;cursor:pointer;">🌌 World 2 ' + (v6.w2Unlocked ? '✅' : '🔒') + '</button>' +
          '<button onclick="setSvV6Tab(\\'aura\\')" style="background:#78350f;border:1px solid #facc15;color:#fde047;padding:8px 4px;border-radius:10px;font-weight:900;font-size:11px;cursor:pointer;">🔮 Aura / V4</button>';

        let w2Box = document.getElementById('svV6W2Box');
        if (!w2Box) {
          w2Box = document.createElement('div');
          w2Box.id = 'svV6W2Box';
          w2Box.style.display = 'none';
          advPanel.appendChild(w2Box);
        }

        let auraBox = document.getElementById('svV6AuraBox');
        if (!auraBox) {
          auraBox = document.createElement('div');
          auraBox.id = 'svV6AuraBox';
          auraBox.style.display = 'none';
          advPanel.appendChild(auraBox);
        }

        // Render World 2 Chapters 11-15 with working S1 -> S2 -> S3 buttons
        const stars = v6.stars || {};
        if (!v6.w2Unlocked) {
          w2Box.innerHTML =
            '<div style="background:rgba(88,28,135,0.28);border:1px solid #a855f7;border-radius:12px;padding:12px;text-align:center;margin-top:6px;">' +
              '<div style="font-weight:900;color:#e9d5ff;font-size:13px;">🌌 WORLD 2: ASTRAL REALMS (CH.11–15)</div>' +
              '<div style="font-size:11px;color:#cbd5e1;margin:6px 0;">Clear World 1 (Ch.5 S3) & defeat the Astral Gatekeeper (25,000🪙) to unlock!</div>' +
              '<button onclick="socket.emit(\\'svStartW2Gatekeeper\\', window.selectedPower || \\'fire\\')" style="background:linear-gradient(90deg,#9333ea,#ec4899);border:none;color:#fff;padding:9px 14px;border-radius:10px;font-weight:900;cursor:pointer;">⚔️ Challenge Astral Gatekeeper (25k🪙)</button>' +
            '</div>';
        } else {
          const diffBar =
            '<div style="display:flex;gap:6px;margin:6px 0;">' +
              ['normal', 'hard', 'nightmare'].map(d =>
                '<button onclick="window._svW2Diff=\\'' + d + '\\';renderV6Panels();" style="flex:1;padding:6px;border-radius:8px;border:1px solid ' + (window._svW2Diff === d ? '#facc15' : '#475569') + ';background:' + (window._svW2Diff === d ? '#713f12' : '#0f172a') + ';color:#fff;font-weight:800;font-size:10px;text-transform:uppercase;cursor:pointer;">' + d + '</button>'
              ).join('') +
            '</div>';

          w2Box.innerHTML = diffBar + W2_LIST.map(c => {
            const chUnlocked = v6.w2Cleared || (v6.w2Chapter || 11) >= c.ch || (stars[(c.ch - 1) + '_3'] || 0) > 0;
            const btns = [1, 2, 3].map(stgNum => {
              const prevCleared = stgNum === 1
                ? chUnlocked
                : ((stars[c.ch + '_' + (stgNum - 1)] || 0) > 0 || v6.w2Cleared || (v6.w2Chapter || 11) > c.ch || ((v6.w2Chapter || 11) === c.ch && (v6.w2Stage || 1) >= stgNum));
              const stCount = stars[c.ch + '_' + stgNum] || 0;
              const starStr = stCount > 0 ? ' ' + '⭐'.repeat(stCount) : '';
              return '<button ' + (prevCleared ? '' : 'disabled') +
                ' onclick="socket.emit(\\'svStartW2Stage\\',{ch:' + c.ch + ',stg:' + stgNum + ',power:(window.selectedPower||\\'fire\\'),diff:(window._svW2Diff||\\'normal\\')})"' +
                ' style="padding:7px 4px;border-radius:8px;border:none;font-weight:900;font-size:11px;cursor:' + (prevCleared ? 'pointer' : 'not-allowed') + ';background:' + (prevCleared ? '#7c3aed' : '#1e293b') + ';color:' + (prevCleared ? '#fff' : '#64748b') + ';">' +
                (prevCleared ? ('⚔️ S' + stgNum + starStr) : ('🔒 S' + stgNum)) + '</button>';
            }).join('');

            return '<div style="background:rgba(15,23,42,0.85);border:1px solid #4c1d95;border-radius:12px;padding:10px;margin-bottom:8px;">' +
              '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
                '<span style="font-weight:900;color:#f8fafc;font-size:12px;">🪐 Ch.' + c.ch + ': ' + c.name + '</span>' +
                '<span style="font-size:11px;color:#38bdf8;font-weight:800;">' + c.coins + '🪙 • ' + c.drop + '</span>' +
              '</div>' +
              (chUnlocked
                ? '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">' + btns + '</div>'
                : '<div style="font-size:11px;color:#94a3b8;">🔒 Clear Chapter ' + (c.ch - 1) + ' first</div>') +
            '</div>';
          }).join('');
        }
    `;
     // ============================================================================
    // 🌌 SAMMUVERSE V6 - CLEAN PIECE 5/5 (AURAS, RELICS & UNIFIED INJECTOR)
    // ============================================================================
    const V6_CLEAN_UI_PART2 = `
        const wins = (prof.powerWins && prof.powerWins[pow]) || 0;
        const isV4 = Array.isArray(v6.v4Powers) && v6.v4Powers.includes(pow);
        const unlockedAuras = Array.isArray(v6.unlockedAuras) ? v6.unlockedAuras : [];
        const relics = v6.relics || {};

        const v4Html =
          '<div style="background:rgba(127,29,29,0.3);border:1px solid #f87171;border-radius:12px;padding:10px;margin-bottom:10px;">' +
            '<div style="font-weight:900;color:#fca5a5;font-size:12px;margin-bottom:4px;">⛩️ V4 AWAKENING TEMPLE (' + pow.toUpperCase() + ')</div>' +
            '<div style="font-size:11px;color:#e2e8f0;">1. World 2 Unlocked: ' + (v6.w2Unlocked ? '✅' : '🔒') + '</div>' +
            '<div style="font-size:11px;color:#e2e8f0;">2. Power Mastery (100 V3 Wins): ' + wins + '/100 ' + (wins >= 100 ? '🔥' : '🔒') + '</div>' +
            '<div style="font-size:11px;color:#e2e8f0;margin-bottom:8px;">3. Status: ' + (isV4 ? '👑 V4 AWAKENED!' : 'Beat your V4 Shadow Mirror!') + '</div>' +
            '<button onclick="socket.emit(\\'svStartV4Trial\\', window.selectedPower || \\'fire\\')" style="width:100%;background:linear-gradient(90deg,#dc2626,#9333ea);border:none;color:#fff;padding:8px;border-radius:9px;font-weight:900;font-size:11px;cursor:pointer;">🔥 ENTER V4 TEMPLE TRIAL!</button>' +
          '</div>';

        const auraHtml =
          '<div style="font-weight:900;color:#38bdf8;font-size:12px;margin:6px 0;">🔮 AURA CLASSES (🔷 ' + (v6.astralShards || 0) + ' Shards | 💎 ' + (v6.voidCrystals || 0) + ' Crystals)</div>' +
          AURA_LIST.map(a => {
            const owned = unlockedAuras.includes(a.k);
            const active = v6.auraClass === a.k;
            const btnTxt = !owned ? a.cost : (active ? ('⬆️ Upgrade Lv.' + ((v6.auraLv || 1) + 1)) : '⚡ Equip');
            return '<div style="display:flex;justify-content:space-between;align-items:center;background:#0f172a;border:1px solid ' + (active ? '#facc15' : '#334155') + ';border-radius:10px;padding:8px;margin-bottom:6px;">' +
              '<div style="padding-right:6px;"><div style="font-weight:900;color:#fff;font-size:11px;">' + a.icon + ' ' + a.name + (active ? ' (Lv.' + (v6.auraLv || 1) + ')' : '') + '</div>' +
              '<div style="font-size:10px;color:#94a3b8;">' + a.desc + '</div></div>' +
              '<button onclick="socket.emit(\\'svAuraAction\\',\\'' + a.k + '\\')" style="background:#7c3aed;border:none;color:#fff;padding:7px 10px;border-radius:8px;font-weight:900;font-size:10px;white-space:nowrap;cursor:pointer;">' + btnTxt + '</button>' +
            '</div>';
          }).join('');

        const relicHtml =
          '<div style="font-weight:900;color:#facc15;font-size:12px;margin:10px 0 6px;">⚒️ V6 RELIC GEAR FORGE</div>' +
          RELIC_LIST.map(r => {
            const lv = relics[r.k] || 0;
            const m = lv + 1;
            const costTxt = lv >= 10 ? '✨ MAX Lv.10' : (Math.round((r.c * m) / 1000) + 'k🪙 + ' + (r.s * m) + '🔷 + ' + (r.cr * m) + '💎');
            return '<div style="display:flex;justify-content:space-between;align-items:center;background:#0f172a;border:1px solid #854d0e;border-radius:10px;padding:8px;margin-bottom:6px;">' +
              '<div style="padding-right:6px;"><div style="font-weight:900;color:#fef08a;font-size:11px;">' + r.icon + ' ' + r.name + ' (Lv.' + lv + '/10)</div>' +
              '<div style="font-size:10px;color:#cbd5e1;">' + r.desc + '</div></div>' +
              '<button onclick="socket.emit(\\'svForgeRelic\\',\\'' + r.k + '\\')" style="background:#b45309;border:none;color:#fff;padding:7px 10px;border-radius:8px;font-weight:900;font-size:10px;white-space:nowrap;cursor:pointer;">' + costTxt + '</button>' +
            '</div>';
          }).join('');

        auraBox.innerHTML = v4Html + auraHtml + relicHtml;
      };

      setInterval(function() {
        if (typeof window.renderV6Panels === 'function') window.renderV6Panels();
        var fab = document.getElementById('hkCreatorFab');
        if (fab) { fab.style.bottom = '68px'; fab.style.zIndex = '99999999'; }
      }, 1000);
    })();
    </script>`;

    const V6_COMPLETE_CLIENT_BUNDLE = V6_CLEAN_UI_PART1 + '\n' + V6_CLEAN_UI_PART2;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (false && typeof body === 'string' && !body.includes('sammuverseV6CleanUI')) {
                body = body.replace('</body>', V6_COMPLETE_CLIENT_BUNDLE + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // ============================================================================
    // 🌌 SAMMUVERSE V6 SOCKET LOADER & INSTANT FIGHT FIX
    // ============================================================================
    function clearPlayerStuckBattles(sockId) {
        for (const [bId, b] of svBattles.entries()) {
            if (b.p1.id === sockId || b.p2.id === sockId) {
                if (b.interval) clearInterval(b.interval);
                svBattles.delete(bId);
            }
        }
    }

    const _prevFinishBeforeV6Fix = finishSvBattle;
    finishSvBattle = function(battleId, b) {
        if (b && b.p1 && b.p2 && b.p1.hp > b.p2.hp) {
            if (b.isW2) applyV6BattleRewards(battleId, b);
            if (b.isW2Gatekeeper && b.p1.name) {
                const prof = ensureV6Profile(b.p1.name);
                prof.v6.w2Unlocked = true;
                saveSvStats();
                const pSock = io.sockets.sockets.get(b.p1.id);
                if (pSock) {
                    pSock.emit('svStatsSync', ensureV6Profile(b.p1.name));
                    pSock.emit('svNotice', '🌌 ASTRAL GATEKEEPER DEFEATED! World 2 Unlocked!');
                }
            }
            if (b.isV4Trial && b.p1.name && b.trialPow) {
                const prof = ensureV6Profile(b.p1.name);
                if (!prof.v6.v4Powers.includes(b.trialPow)) prof.v6.v4Powers.push(b.trialPow);
                saveSvStats();
                const pSock = io.sockets.sockets.get(b.p1.id);
                if (pSock) {
                    pSock.emit('svStatsSync', ensureV6Profile(b.p1.name));
                    pSock.emit('svNotice', '🔥 V4 AWAKENING COMPLETE! ' + b.trialPow.toUpperCase() + ' ascended to V4!');
                }
            }
        }
        return _prevFinishBeforeV6Fix(battleId, b);
    };

    io.on('connection', (socket) => {
        const ensureReady = () => {
            if (!socket.activeServerId) socket.activeServerId = ctx.lastActiveServerId || 'srv_samaksh';
            if (!socket.username) socket.username = 'Fighter_' + socket.id.slice(0, 4);
            clearPlayerStuckBattles(socket.id);
        };

        socket.prependListener('svChallenge', (d) => {
            if (!socket.activeServerId) socket.activeServerId = ctx.lastActiveServerId || 'srv_samaksh';
            if (!socket.username) socket.username = 'Fighter_' + socket.id.slice(0, 4);
            if (d && ['BOT_DUMMY', 'BOT_SENSEI', 'BOT_DEMON'].includes(d.targetId)) {
                clearPlayerStuckBattles(socket.id);
            }
        });
        socket.prependListener('svStartAdventure', ensureReady);
        socket.prependListener('svStartStageV5', ensureReady);
        socket.prependListener('svStartW2Gatekeeper', ensureReady);
        socket.prependListener('svStartW2Stage', ensureReady);
        socket.prependListener('svStartV4Trial', ensureReady);
        socket.prependListener('svTowerEnter', ensureReady);
        socket.prependListener('svStartDungeon', ensureReady);

        // Send V6 World 2 + Fight Patch directly via Socket.IO (immune to HTML script tag errors!)
        const pushV6ViaSocket = () => {
            const rawV6 = (typeof V6_COMPLETE_CLIENT_BUNDLE === 'string')
                ? V6_COMPLETE_CLIENT_BUNDLE.replace(/<\/?script[^>]*>/gi, '')
                : '';
            socket.emit('svApplyV6Patch', rawV6);
        };
        socket.on('svRequestCleanV4', pushV6ViaSocket);
        socket.on('joinRoom', () => setTimeout(pushV6ViaSocket, 550));
    });

    const V6_SOCKET_RECEIVER = `
    <script id="svV6SocketReceiver">
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
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (false && typeof body === 'string' && !body.includes('svV6SocketReceiver')) {
                body = body.replace('</body>', V6_SOCKET_RECEIVER + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // ============================================================================
    // ⚡ ANTI-LAG PERFORMANCE BOOSTER + 30-MIN AUTO-PROMO BOT
    // ============================================================================
    if (io && io.engine && io.engine.opts) {
        io.engine.opts.perMessageDeflate = { threshold: 256 };
    }

    // 1. Auto-Promo every 30 minutes across active rooms (only when players are online)
    if (!global._sammuAutoPromoStarted) {
        global._sammuAutoPromoStarted = true;
        setInterval(() => {
            Object.keys(serversDB).forEach((srvId) => {
                const room = io.sockets.adapter.rooms.get(srvId);
                if (room && room.size > 0) {
                    io.to(srvId).emit('message', {
                        username: "Sammu's Bot",
                        text: `🔥📢 **subscribe to verma_diary_18 ❤️** | Enjoying SammuVerse? Invite your squad & share the link! 🚀`,
                        _serverId: srvId
                    });
                }
            });
        }, 30 * 60 * 1000);
    }

    // 2. Client Anti-Lag Engine (Slows down heavy background DOM scanners & enables GPU smoothness)
    const ANTI_LAG_BOOSTER_UI = `
    <script id="sammuAntiLagBooster">
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
    </script>`;

    app.use((req, res, next) => {
        const origSend = res.send;
        res.send = function(body) {
            if (false && typeof body === 'string' && !body.includes('sammuAntiLagBooster')) {
                body = body.replace('</body>', ANTI_LAG_BOOSTER_UI + '\n</body>');
            }
            return origSend.call(this, body);
        };
        next();
    });
    // ============================================================================
    // 🌌 V6 STAT & 30K+ HP RESTORE PATCH (PASTE RIGHT BEFORE return OG_HOSTS;)
    // ============================================================================
    const _prevBuildFighterV6Fix = buildFighterObj;
    buildFighterObj = function(sockId, uname, powKey, customHp, customAtk, isBot = false, botId = null) {
        const f = _prevBuildFighterV6Fix(sockId, uname, powKey, customHp, customAtk, isBot, botId);
        if (isBot) return f;

        const prof = ensureV6Profile(uname);
        const v6 = prof.v6 || {};
        const rel = v6.relics || {};
        const auraLv = v6.auraLv || 1;

        const voidArmorMult = 1 + ((rel.voidArmor || 0) * 0.30);
        const infRingMult   = 1 + ((rel.infinityRing || 0) * 0.20);
        const astralAtkMult = 1 + ((rel.astralBlade || 0) * 0.25);
        const auraHpMult    = v6.auraClass === 'divine' ? (1 + auraLv * 0.16) : (v6.auraClass === 'dragonic' ? (1 + auraLv * 0.22) : 1);
        const auraAtkMult   = v6.auraClass ? (1 + auraLv * 0.16) : 1;
        const v4Mult        = (Array.isArray(v6.v4Powers) && v6.v4Powers.includes(powKey)) ? 1.50 : 1.0;

        f.maxHp = Math.round(f.maxHp * voidArmorMult * infRingMult * auraHpMult * v4Mult);
        f.hp = f.maxHp;
        f.bonusAtk = Math.round(f.bonusAtk * astralAtkMult * infRingMult * auraAtkMult * v4Mult);
        return f;
    };

    const _prevMasterGodV6Fix = applyMasterGodUnlock;
    applyMasterGodUnlock = function(uname) {
        const prof = _prevMasterGodV6Fix(uname);
        if (prof && prof.v5) {
            prof.v5.equip = { weapon: 4, armor: 4, charm: 4 };
            prof.v5.rebirths = Math.max(5, prof.v5.rebirths || 0);
        }
        saveSvStats();
        return ensureV6Profile(uname);
    };
    
           // ============================================================================

};
