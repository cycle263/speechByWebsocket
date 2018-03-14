import InlineWorker from 'inline-worker';

// 修改采样率和采样数据
const interpolateArray = (data, newSampleRate, oldSampleRate) => {
    var fitCount = Math.round(data.length * (newSampleRate / oldSampleRate));
    var newData = new Array();
    var springFactor = new Number((data.length - 1) / (fitCount - 1));
    newData[0] = data[0]; // for new allocation
    for (var i = 1; i < fitCount - 1; i++) {
        var tmp = i * springFactor;
        var before = new Number(Math.floor(tmp)).toFixed();
        var after = new Number(Math.ceil(tmp)).toFixed();
        var atPoint = tmp - before;
        newData[i] = linearInterpolate(data[before], data[after], atPoint);
    }
    newData[fitCount - 1] = data[data.length - 1]; // for new allocation
    return newData;
};
const linearInterpolate = (before, after, atPoint) => {
    return before + (after - before) * atPoint;
};

export class Recorder {
    constructor(source, cfg) {
        this.config = {
            bufferLen: 4096,
            numChannels: 2,
            cfgRate: 16000,
            sampleBit: 16,
            mimeType: 'audio/wav'
        };
        this.recording = false;
        this.callbacks = {
            getBuffer: [],
            exportWAV: []
        };
        Object.assign(this.config, cfg);
        this.context = source.context;
        this.node = (this.context.createScriptProcessor ||
            this.context.createJavaScriptNode).call(this.context,
            this.config.bufferLen, this.config.numChannels, this.config.numChannels);

        this.node.onaudioprocess = (e) => {
            if (!this.recording) return;

            var buffer = [];
            for (var channel = 0; channel < this.config.numChannels; channel++) {
                buffer.push(e.inputBuffer.getChannelData(channel));
            }
            
            var newBuffer = interpolateArray(buffer, this.config.cfgRate, this.context.sampleRate);
            this.worker.postMessage({
                command: 'record',
                buffer: buffer
            });
            this.socket.emit('with-binary', {
                "actorId": "123456", // 小二id或者用户Id
                "actorType": "SERVER", //SERVER  CUSTOMER
                "appName": "hotline",
                "bizId": "123456", //acid
                "bizType": "hotline",
                "endTime": "1503846181691",
                "operationType": "asr", //暂时写死
                "startTime": "1503846181691"
            }, newBuffer);
        };

        source.connect(this.node);
        this.node.connect(this.context.destination);    //this should not be necessary

        let self = {};
        this.worker = new InlineWorker(function () {
            let recLength = 0,
                recBuffers = [],
                sampleRate,
                sampleBit,
                numChannels;

            this.onmessage = function (e) {
                switch (e.data.command) {
                    case 'init':
                        init(e.data.config);
                        break;
                    case 'record':
                        record(e.data.buffer);
                        break;
                    case 'exportWAV':
                        exportWAV(e.data.type);
                        break;
                    case 'getBuffer':
                        getBuffer();
                        break;
                    case 'clear':
                        clear();
                        break;
                }
            };

            function init(config) {
                sampleRate = config.sampleRate;
                numChannels = config.numChannels;
                sampleBit = config.sampleBit;
                cfgRate = config.cfgRate;
                initBuffers();
            }

            // 修改采样率和修正采样数据
            var interpolateArray = (data, newSampleRate, oldSampleRate) => {
                var fitCount = Math.round(data.length * (newSampleRate / oldSampleRate));
                var newData = new Array();
                var springFactor = new Number((data.length - 1) / (fitCount - 1));
                newData[0] = data[0]; // for new allocation
                for (var i = 1; i < fitCount - 1; i++) {
                    var tmp = i * springFactor;
                    var before = new Number(Math.floor(tmp)).toFixed();
                    var after = new Number(Math.ceil(tmp)).toFixed();
                    var atPoint = tmp - before;
                    newData[i] = linearInterpolate(data[before], data[after], atPoint);
                }
                newData[fitCount - 1] = data[data.length - 1]; // for new allocation
                return newData;
            };
            var linearInterpolate = (before, after, atPoint) => {
                return before + (after - before) * atPoint;
            };

            // other modife samplerate
            var modifeSampleRate = (data, newSampleRate, oldSampleRate) => {
                var compression = parseInt(oldSampleRate / newSampleRate);
                var length = data.length / compression;
                var result = new Float32Array(length);
                var index = 0, j = 0;
                while (index < length) {
                    result[index] = data[j];
                    j += compression;
                    index++;
                }
                return result;
            };

            function record(inputBuffer) {
                var tempBf = [];
                for (var channel = 0; channel < numChannels; channel++) {
                    recBuffers[channel].push(inputBuffer[channel]);
                }
                recLength += inputBuffer[0].length;
            }

            function exportWAV(type) {
                var buffers = [];
                for (var channel = 0; channel < numChannels; channel++) {
                    var buffer = mergeBuffers(recBuffers[channel], recLength);
                    buffer = modifeSampleRate(buffer, cfgRate, sampleRate);
                    buffers.push(buffer);
                }
                sampleRate = cfgRate;
                var interleaved = undefined;
                if (numChannels === 2) {
                    interleaved = interleave(buffers[0], buffers[1]);
                } else {
                    interleaved = buffers[0];
                }
                var dataview = encodeWAV(interleaved);
                var audioBlob = new Blob([dataview], { type: type });
                self.postMessage({ command: 'exportWAV', data: audioBlob });
            }

            function getBuffer() {
                var buffers = [];
                for (var channel = 0; channel < numChannels; channel++) {
                    var buffer = mergeBuffers(recBuffers[channel], recLength);
                    buffer = interpolateArray(buffer, cfgRate, sampleRate);
                    buffers.push(buffer);
                }
                var interleaved = undefined;
                if (numChannels === 2) {
                    interleaved = interleave(buffers[0], buffers[1]);
                } else {
                    interleaved = buffers[0];
                }
                self.postMessage({ command: 'getBuffer', data: interleaved });
            }

            function clear() {
                recLength = 0;
                recBuffers = [];
                initBuffers();
            }

            function initBuffers() {
                for (let channel = 0; channel < numChannels; channel++) {
                    recBuffers[channel] = [];
                }
            }

            function mergeBuffers(recBuffers, recLength) {
                let result = new Float32Array(recLength);
                let offset = 0;
                for (let i = 0; i < recBuffers.length; i++) {
                    result.set(recBuffers[i], offset);
                    offset += recBuffers[i].length;
                }
                return result;           
            }

            function interleave(inputL, inputR) {
                let length = inputL.length + inputR.length;
                let result = new Float32Array(length);

                let index = 0,
                    inputIndex = 0;

                while (index < length) {
                    result[index++] = inputL[inputIndex];
                    result[index++] = inputR[inputIndex];
                    inputIndex++;
                }
                return result;
            }

            function floatTo8BitPCM(output, offset, input) {
                for (var i = 0; i < input.length; i++ , offset++) {
                    var s = Math.max(-1, Math.min(1, input[i]));
                    var val = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    val = parseInt(255 / (65535 / (val + 32768)));
                    output.setInt8(offset, val, true);
                }
            }

            function floatTo16BitPCM(output, offset, input) {
                for (let i = 0; i < input.length; i++ , offset += 2) {
                    let s = Math.max(-1, Math.min(1, input[i]));
                    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                }
            }

            function writeString(view, offset, string) {
                for (let i = 0; i < string.length; i++) {
                    view.setUint8(offset + i, string.charCodeAt(i));
                }
            }

            function encodeWAV(samples) {
                const bitRate = sampleBit / 8;
                let buffer = new ArrayBuffer(44 + samples.length * bitRate);
                let view = new DataView(buffer);

                /* RIFF identifier */
                writeString(view, 0, 'RIFF');
                /* RIFF chunk length */
                view.setUint32(4, 36 + samples.length * bitRate, true);
                /* RIFF type */
                writeString(view, 8, 'WAVE');
                /* format chunk identifier */
                writeString(view, 12, 'fmt ');
                /* format chunk length */
                view.setUint32(16, 16, true);
                /* sample format (raw) */
                view.setUint16(20, 1, true);
                /* channel count */
                view.setUint16(22, numChannels, true);
                /* sample rate */
                view.setUint32(24, sampleRate, true);
                /* byte rate (sample rate * block align) */
                view.setUint32(28, sampleRate * numChannels * bitRate, true);
                /* block align (channel count * bytes per sample) */
                view.setUint16(32, numChannels * bitRate, true);
                /* bits per sample */
                view.setUint16(34, sampleBit, true);
                /* data chunk identifier */
                writeString(view, 36, 'data');
                /* data chunk length */
                view.setUint32(40, samples.length * 2, true);

                if (sampleBit === 8 || sampleBit === '8') {
                    floatTo8BitPCM(view, 44, samples);
                } else {
                    floatTo16BitPCM(view, 44, samples);
                }

                return view;
            }
        }, self);

        this.worker.postMessage({
            command: 'init',
            config: {
                sampleRate: this.context.sampleRate,
                sampleBit: this.config.sampleBit,
                numChannels: this.config.numChannels,
                cfgRate: this.config.sampleRate
            }
        });

        this.worker.onmessage = (e) => {
            let cb = this.callbacks[e.data.command].pop();
            if (typeof cb == 'function') {
                cb(e.data.data);
            }
        };
    }


    start(socket) {
        this.recording = true;
        this.socket = socket;
    }

    stop() {
        this.recording = false;
    }

    clear() {
        this.worker.postMessage({ command: 'clear' });
    }

    getBuffer(cb) {
        cb = cb || this.config.callback;
        if (!cb) throw new Error('Callback not set');

        this.callbacks.getBuffer.push(cb);

        this.worker.postMessage({ command: 'getBuffer' });
    }

    exportWAV(cb, mimeType) {
        mimeType = mimeType || this.config.mimeType;
        cb = cb || this.config.callback;
        if (!cb) throw new Error('Callback not set');

        this.callbacks.exportWAV.push(cb);

        this.worker.postMessage({
            command: 'exportWAV',
            type: mimeType
        });
    }

    static forceDownload(blob, filename, container) {
        let url = (window.URL || window.webkitURL).createObjectURL(blob);
        let link = window.document.createElement('a');
        link.href = url;
        link.download = filename || 'output.wav';
        link.text = filename ? 'download ' + filename : 'download output.wav';
        let c = container || document.body;
        c.append && c.append(link);
    }
}

export default Recorder;