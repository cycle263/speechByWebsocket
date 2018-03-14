## 实时上传语音arraybuffer by websocket.io

* 支持采样率和声道数量配置

* 支持Blob和arraybuffer以及file方式上传

* 录音支持WAV和PCM语音文件，并支持下载

## 客户端实现思路

客户端使用HTML5的getUserMedia接口和AudioContext对象。

* 首先，通过AudioContext.createMediaStreamSource方法创建一个MediaStreamAudioSourceNode, 用于接受本地计算机麦克风的音频输入。

* 再通过AudioContext的createScriptProcessor方法创建一个ScriptProcessorNode，用于处理音频采集操作。

* 然后，通过connect方法将麦克风的音频输入和音频采集链接。通过监听audioprocess事件，将采集的音频数据保存在配置的固定长度的数组内。客户端不能直接发送数组数据给服务端，因此还需对数组数据进行合并和压缩，然后转换成wav或者pcm格式的二进制，服务端才能识别。

## [参照 - socket.io-client](https://github.com/socketio/socket.io-client)