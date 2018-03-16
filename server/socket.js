var server = require('http').createServer();
var io = require('socket.io')(server);
io.on('connection', function (client) {
    client.on('event', function (data) { 
        console.log('event', data);
    });
    client.on('with-binary', function (config, arg) {
        // io.emit('Clientevent', '获取到录音buffer...');
    });
    client.on('disconnect', function () { });
});

function decodeDataFrame(e) {
    var i = 0, j, s, frame = {
        //解析前两个字节的基本数据
        FIN: e[i] >> 7, Opcode: e[i++] & 15, Mask: e[i] >> 7,
        PayloadLength: e[i++] & 0x7F
    };
    //处理特殊长度126和127
    if (frame.PayloadLength == 126)
        frame.length = (e[i++] << 8) + e[i++];
    if (frame.PayloadLength == 127)
        frame.length = (e[i++] << 24) + (e[i++] << 16) + (e[i++] << 8) + e[i++];
    //判断是否使用掩码
    if (frame.Mask) {
        //获取掩码实体
        frame.MaskingKey = [e[i++], e[i++], e[i++], e[i++]];
        //对数据和掩码做异或运算
        for (j = 0, s = []; j < frame.PayloadLength; j++)
            s.push(e[i + j] ^ frame.MaskingKey[j % 4]);
    } else s = e.slice(i, frame.PayloadLength); //否则直接使用数据
    //数组转换成缓冲区来使用
    s = new Buffer(s);
    //如果有必要则把缓冲区转换成字符串来使用
    if (frame.Opcode == 1) s = s.toString();
    //设置上数据部分
    frame.PayloadData = s;
    //返回数据帧
    return frame;
};

server.listen(3000);
console.log('server listen on port 3000');