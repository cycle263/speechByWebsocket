// import { setInterval, setTimeout } from 'timers';

var fs = require('fs');
var path = require('path');
var server = require('http').createServer();
var io = require('socket.io')(server);

io.on('connection', function (client) {
  var countNum = 0;

    client.on('init', function (data, fn) {
        console.log(data);
        fn && fn('初始化成功，开始录音吧');
    });

    client.on('with-binary', function (data, fn) {
      countNum++;
      if (countNum < 3) {
        io.emit('Clientevent', '正在获取到录音buffer...' + data);
      }
    });

    setTimeout(() => {
      const mp4 = path.resolve(__dirname, '../assets/aliyun.mp4');
      let readStream = fs.createReadStream(mp4);

      readStream.on('data', (chunk) => {
        console.log('readStream: ', chunk.length, chunk.byteLength);
        io.emit('Clientevent', chunk);
      })

      io.emit('Clientevent', {
        "success": true,
        "finish": false,
        "text": "请问你是不是遇到了花呗无法支付",
        "actorType": "SERVER or CUSTOMER",
        "bizId": "aaa",
        "index": 1
      });
    }, 2000);

    client.on('disconnect', function () { 
        console.log('ws disconnect');
    });
});

// 解析数据帧
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