const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname + '/public'));

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

http.listen(3000, () => {
    console.log('Game Server is running on port 3000!');
});
