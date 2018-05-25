import io from 'socket.io-client';
import classes from './main.css';
import Recorder from './public/CrecorderCore';

let socket, audioContext;

export function EmitBuffer () {
    socket.emit('with-binary', 'hello!', { number: '4', buffer: new Buffer(6) });
};

export function Start () {
    socket = io('http://localhost:3000');
    audioContext = new AudioContext();

    socket.on('connect', () => {
        console.log('ws connected');
    });
    socket.on('Clientevent', (data) => {
        console.log(data);
    });
    socket.on('disconnect', () => { 
        console.log('ws closed');
    });

    window.navigator.mediaDevices.getUserMedia({
        audio: true
    }).then(function (mediaStream) {
        const mediaStreamSource = audioContext.createMediaStreamSource(mediaStream);   // 媒体流音频源
        audioRecorder = new Recorder(mediaStreamSource, { numChannels: 1, sampleBit: 8, sampleRate: 16 * 1000 });    // numChannels=1为单声道，sampleRate：采样率
        audioRecorder.start(socket);

        // 定时器模式
        // setInterval(() => {
        //     audioRecorder.exportWAV((audioBlob) => {
        //         audioSocket.send(audioBlob)
        //         audioRecorder.stop();
        //         audioRecorder.clear();
        //     });
        // }, 20);
    }).catch(function (error) {
        console.warn(error.name, error.code);
        if (window.location.protocol === 'http') {
            console.warn('网络环境不安全，推荐使用https');
            return;
        }
        switch (error.name || error.code) {
            case 'PERMISSION_DENIED':
            case 'PermissionDeniedError':
                console.warn('用户拒绝提供录音权限');
                break;
            case 'NOT_SUPPORTED_ERROR':
            case 'NotSupportedError':
                console.warn('浏览器不支持硬件设备。');
                break;
            case 'MANDATORY_UNSATISFIED_ERROR':
            case 'MandatoryUnsatisfiedError':
                console.warn('无法发现指定的硬件设备。');
                break;
            default:
                console.warn('无法打开麦克风，异常信息: ' + (error.name + ', error code: ' + error.code));
                break;
        }
    });
    // setTimeout(() => {
    //     console.log(audioRecorder);
    //     audioRecorder.exportWAV((audioBlob) => {
    //         audioRecorder.forceDownload(audioBlob);
    //     });
    //     audioRecorder.stop();
    //     this.setState({ gifShow: 'hidden' });
    // }, 3000);
};

export function Stop () {
    socket.close();
    audioRecorder.stop();
    audioRecorder.exportWAV((audioBlob) => {
        Recorder.forceDownload(audioBlob);  // download
    });
};