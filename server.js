const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Look for index.html in the main folder AND the public folder automatically
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

let players = [];

io.on('connection', (socket) => {
    socket.on('joinRoom', (data) => {
        socket.username = data.username;
        socket.avatar = data.avatar;
        players.push({ id: socket.id, username: data.username, avatar: data.avatar });
        io.emit('updatePlayers', players);
    });

    socket.on('chatMessage', (msg) => {
        io.emit('message', { username: socket.username, text: msg });
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('updatePlayers', players);
    });
});

// Use Render's assigned network port or fallback to 3000 local
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log('Game Server is running on port ' + PORT);
});
