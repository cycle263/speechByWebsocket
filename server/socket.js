var server = require('http').createServer();
var io = require('socket.io')(server);
io.on('connection', function (client) {
    client.on('event', function (data) { 
        console.log('event', data);
    });
    client.on('with-binary', function (arg1, arg2) {
        io.emit('event', 'server emit');
    });
    client.on('disconnect', function () { });
});

server.listen(3000);
console.log('server listen on port 3000');