module.exports = function initFixButtons(app) {
    app.get('/avatar-armory-bundle.js', (req, res) => {
        res.type('application/javascript');
        const rawHtml = (app.locals.AVATAR_RPG_UI || '');
        const scriptMatch = rawHtml.match(/<script>([\s\S]*?)<\/script>/i);
        res.send(scriptMatch ? scriptMatch[1] : '');
    });

    app.get('/avatar-armory-style.css', (req, res) => {
        res.type('text/css');
        const rawHtml = (app.locals.AVATAR_RPG_UI || '');
        const styleMatch = rawHtml.match(/<style>([\s\S]*?)<\/style>/i);
        res.send((styleMatch ? styleMatch[1] : '') + '\n#sammuFloatingArmoryBar{display:none!important;}');
    });

    app.get('/avatar-armory-modals.html', (req, res) => {
        res.type('text/html');
        const rawHtml = (app.locals.AVATAR_RPG_UI || '')
            .replace(/<style>[\s\S]*?<\/style>/gi, '')
            .replace(/<script>[\s\S]*?<\/script>/gi, '');
        res.send(rawHtml);
    });
};
