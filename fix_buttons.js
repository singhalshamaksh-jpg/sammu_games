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

    app.get('/armory-patch.js', (req, res) => res.sendFile(require('path').join(__dirname, 'armory_client.js')));
};
