const config = require('./config');

const server = require('http').createServer();
const { promisify } = require("util");
const io = require('socket.io')(server);
const redis = require('redis')
const redisClient = redis.createClient(config.cacheServerPort, config.cacheServer);
const getAsync = promisify(redisClient.get).bind(redisClient);
const keysAsync = promisify(redisClient.keys).bind(redisClient);
const keyExists = promisify(redisClient.exists).bind(redisClient);
const serverPort = 8000;

server.listen(serverPort, function() {
    console.log(`App running in http://localhost:${serverPort}`);
});

redisClient.on('connect', function() {
    console.log('Redis client connected');
});

redisClient.on('error', function (err) {
    console.log('Something went wrong ' + err);
});

io.on('connection', function(socket) {
    console.log('Client connected');

    socket.on('generateRoom', async () => {
        const roomNames = await keysAsync('*');
        let roomName = Math.floor(Math.random()*(99999-10000+10000)+10000);
        while(roomNames.indexOf(roomName) != -1) {
            roomName = Math.floor(Math.random()*(99999-10000+10000)+10000);
        }
        redisClient.set(roomName, '');
        socket.emit('roomGenerated', roomName);
    });

    socket.on('getRoom', async (roomName) => {
        let exists = await keyExists(roomName);
        socket.emit('roomExists', { room: roomName, exists})
    });

    socket.on('join', async (data)  => {
        socket.join(data.roomName);
        let totalUsers = socket.adapter.rooms[data.roomName].length;
        let text =  await getAsync(data.roomName) || '';
        let initData = {
            text,
            totalUsers
        }
        io.sockets.to(data.roomName).emit('roomData', initData);
    });

    socket.on('leave', (data) => {
        socket.leave(data.roomName);
        let roomData = socket.adapter.rooms[data.roomName];
        let totalUsers = roomData ? roomData.length : 0;
        if(totalUsers > 0) {
            io.sockets.to(data.roomName).emit('total', totalUsers);
        }
    });

    socket.on('typing', (data) => {
        redisClient.set(data.roomName, data.text);
        socket.to(data.roomName).emit('update', data.text);
    });
});