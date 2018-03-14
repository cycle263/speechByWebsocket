var server = require('http').createServer();
var io = require('socket.io')(server);
io.on('connection', function (client) {
    client.on('event', function (data) { 
        console.log('event', data);
    });
    client.on('with-binary', function (config, arg) {
        console.log(config);
        io.emit('Clientevent', '获取到录音buffer...');
    });
    client.on('disconnect', function () { });
});

server.listen(3000);
console.log('server listen on port 3000');