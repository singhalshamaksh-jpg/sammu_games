module.exports = function initFixButtons(app) {
    app.get('/avatar-rpg-html', (req, res) => {
        res.type('text/html');
        res.send((app.locals.AVATAR_RPG_UI || '').replace(/<script>[\s\S]*?<\/script>/gi, ''));
    });

    app.get('/avatar-rpg-script.js', (req, res) => {
        res.type('application/javascript');
        const rawHtml = app.locals.AVATAR_RPG_UI || '';
        const startIdx = rawHtml.indexOf('<script>');
        const endIdx = rawHtml.lastIndexOf('</script>');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            const scriptContent = rawHtml.substring(startIdx + '<script>'.length, endIdx);
            res.send(scriptContent);
        } else {
            res.send('');
        }
    });

    app.get('/armory-patch.js', (req, res) => {
        res.type('application/javascript');
        res.send(`
(function() {
    // 1. Change placeholders
    const stCodeInput = document.getElementById('stCodeInput');
    const rpgHostCodeInp = document.getElementById('rpgHostCodeInp');
    if (stCodeInput) stCodeInput.placeholder = 'Enter Secret Host Code...';
    if (rpgHostCodeInp) rpgHostCodeInp.placeholder = 'Enter Secret Host Code...';

    // Helper to render RPG content immediately
    function renderRpgContent() {
        const rpgTopStats = document.getElementById('rpgTopStats');
        const rpgBody = document.getElementById('rpgBody');
        if (!rpgTopStats || !rpgBody) return;

        // Get equipped avatar from localStorage
        let equipped = null;
        try {
            const saved = localStorage.getItem('equippedAvatar');
            if (saved) equipped = JSON.parse(saved);
        } catch (e) {}

        // Default avatar if none saved
        const avatar = equipped || { name: 'Hero', img: 'default_hero.png', ring: 'gold' };

        // Render Top Stats
        rpgTopStats.innerHTML = `
            <div class="rpg-top-stats-container">
                <img src="${avatar.img}" alt="${avatar.name}" class="rpg-avatar-img" style="border: 2px solid ${avatar.ring}; border-radius: 50%; width: 60px; height: 60px; object-fit: cover;">
                <div class="rpg-stats-info">
                    <h3>${avatar.name}</h3>
                    <p>ATK: 100 | DEF: 50 | HP: 1000</p>
                </div>
            </div>
        `;

        // Render Body with Tabs Content
        rpgBody.innerHTML = `
            <div class="rpg-tabs-content">
                <div class="rpg-tab-pane" id="pane-pvp">
                    <h4>⚔️ Avatar PvP</h4>
                    <p>Ready for battle?</p>
                </div>
                <div class="rpg-tab-pane" id="pane-grind">
                    <h4>🏰 Solo Dungeon Grind</h4>
                    <button class="btn-grind">Start Grind</button>
                </div>
                <div class="rpg-tab-pane" id="pane-gacha">
                    <h4>🎰 Gacha</h4>
                    <button class="btn-gacha">Pull Gacha</button>
                </div>
                <div class="rpg-tab-pane" id="pane-chars">
                    <h4>👥 Characters</h4>
                    <p>Manage your roster.</p>
                </div>
                <div class="rpg-tab-pane" id="pane-gear">
                    <h4>🛡️ Gear Shop</h4>
                    <p>Buy equipment.</p>
                </div>
            </div>
        `;
    }

    // 2. Override window.openRpgModalNow and window.rpgTab
    const originalOpenRpgModalNow = window.openRpgModalNow;
    window.openRpgModalNow = function() {
        if (originalOpenRpgModalNow) originalOpenRpgModalNow.apply(this, arguments);
        renderRpgContent();
    };

    const originalRpgTab = window.rpgTab;
    window.rpgTab = function(tabId) {
        if (originalRpgTab) originalRpgTab.apply(this, arguments);
        renderRpgContent();
        // Ensure the correct tab pane is visible if needed
        const panes = document.querySelectorAll('.rpg-tab-pane');
        panes.forEach(p => p.style.display = 'none');
        const activePane = document.getElementById('pane-' + tabId);
        if (activePane) activePane.style.display = 'block';
    };

    // 3. Handle .st-card clicks
    document.addEventListener('click', function(e) {
        const card = e.target.closest('.st-card');
        if (card) {
            // Extract avatar data
            const nameEl = card.querySelector('.st-name, h3, h4');
            const imgEl = card.querySelector('img');
            const ringEl = card.querySelector('.st-ring, .ring');
            
            const name = nameEl ? nameEl.textContent.trim() : 'Unknown';
            const img = imgEl ? imgEl.src : 'default_hero.png';
            const ring = ringEl ? (ringEl.style.borderColor || ringEl.dataset.ring || 'gold') : 'gold';

            const avatarData = { name, img, ring };
            localStorage.setItem('equippedAvatar', JSON.stringify(avatarData));

            // Stamp glow onto chat messages
            const chatMessages = document.querySelectorAll('.chat-message, .message');
            chatMessages.forEach(msg => {
                // Add glowing portrait badge
                if (!msg.querySelector('.equipped-badge')) {
                    const badge = document.createElement('img');
                    badge.src = img;
                    badge.className = 'equipped-badge';
                    badge.style.cssText = 'width: 20px; height: 20px; border-radius: 50%; border: 2px solid ' + ring + '; box-shadow: 0 0 10px ' + ring + '; margin-right: 5px; vertical-align: middle;';
                    msg.insertBefore(badge, msg.firstChild);
                }

                // Add glow to title pill
                const titlePill = msg.querySelector('.v14-title-pill');
                if (titlePill) {
                    titlePill.style.boxShadow = '0 0 10px ' + ring;
                    titlePill.style.borderColor = ring;
                }

                // Add glow to chat samaksh
                const samaksh = msg.querySelector('.v14-chat-samaksh');
                if (samaksh) {
                    samaksh.style.boxShadow = '0 0 10px ' + ring;
                }
            });

            // Open #stZoomModal portrait popup
            const zoomModal = document.getElementById('stZoomModal');
            if (zoomModal) {
                const modalImg = zoomModal.querySelector('img');
                if (modalImg) {
                    modalImg.src = img;
                    modalImg.style.border = '3px solid ' + ring;
                    modalImg.style.boxShadow = '0 0 20px ' + ring;
                }
                zoomModal.style.display = 'flex';
                zoomModal.style.zIndex = '9999';
            }
        }
    });
})();
`);
    });
};
