// 可自定义采样率和采样位数，中文注释
(function (f) { if (typeof exports === "object" && typeof module !== "undefined") { module.exports = f() } else if (typeof define === "function" && define.amd) { define([], f) } else { var g; if (typeof window !== "undefined") { g = window } else if (typeof global !== "undefined") { g = global } else if (typeof self !== "undefined") { g = self } else { g = this } g.Recorder = f() } })(function () {
    var define, module, exports; return (function e(t, n, r) { function s(o, u) { if (!n[o]) { if (!t[o]) { var a = typeof require == "function" && require; if (!u && a) return a(o, !0); if (i) return i(o, !0); var f = new Error("Cannot find module '" + o + "'"); throw f.code = "MODULE_NOT_FOUND", f } var l = n[o] = { exports: {} }; t[o][0].call(l.exports, function (e) { var n = t[o][1][e]; return s(n ? n : e) }, l, l.exports, e, t, n, r) } return n[o].exports } var i = typeof require == "function" && require; for (var o = 0; o < r.length; o++)s(r[o]); return s })({
        1: [function (require, module, exports) {
            "use strict";

            module.exports = require("./recorder").Recorder;

        }, { "./recorder": 2 }], 2: [function (require, module, exports) {
            'use strict';

            var _createClass = (function () {
                function defineProperties(target, props) {
                    for (var i = 0; i < props.length; i++) {
                        var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor);
                    }
                } return function (Constructor, protoProps, staticProps) {
                    if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor;
                };
            })();

            Object.defineProperty(exports, "__esModule", {
                value: true
            });
            exports.Recorder = undefined;

            var _inlineWorker = require('inline-worker');

            var _inlineWorker2 = _interopRequireDefault(_inlineWorker);

            function _interopRequireDefault(obj) {
                return obj && obj.__esModule ? obj : { default: obj };
            }

            function _classCallCheck(instance, Constructor) {
                if (!(instance instanceof Constructor)) {
                    throw new TypeError("Cannot call a class as a function");
                }
            }

            // 修改采样率和采样数据
            function interpolateArray(data, newSampleRate, oldSampleRate) {
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
            function linearInterpolate(before, after, atPoint) {
                return before + (after - before) * atPoint;
            };

            function mergeCustomBuffers(recBuffers, recLength) {
                var result = new Float32Array(recLength);
                var l = result.length;
                // result.set([l >> 24 & 0xff, l >> 16 & 0xff, l >> 8 & 0xff, l & 0xff], 0);
                var offset = 0;
                for (var i = 0; i < recBuffers.length; i++) {
                    result.set([recBuffers[i]], offset);
                    offset += recBuffers[i].length;
                }
                return result;
            }
            function floatTo16BitPCM(output, offset, input) {
                for (var i = 0; i < input.length; i++ , offset += 2) {
                    var s = Math.max(-1, Math.min(1, input[i]));
                    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                }
            }

            var Recorder = exports.Recorder = (function () {
                function Recorder(source, cfg) {
                    var _this = this;

                    function compress(buffer, len) { //合并压缩
                        var data = new Float32Array(len);
                        var offset = 0;
                        for (var i = 0; i < buffer.length; i++) {
                            data.set([buffer[i]], offset);
                            offset += 1;
                        }
                        //压缩
                        var compression = parseInt(_this.context.sampleRate / _this.config.sampleRate);
                        var length = data.length / compression;
                        var result = new Float32Array(length);
                        var index = 0, j = 0;
                        while (index < length) {
                            result[index] = data[j];
                            j += compression;
                            index++;
                        }
                        return result;
                    }

                    _classCallCheck(this, Recorder);

                    this.config = {
                        bufferLen: 1024,
                        cfgRate: 16000,
                        numChannels: 2,
                        mimeType: 'audio/wav'
                    };
                    this.recording = false;
                    this.callbacks = {
                        getBuffer: [],
                        exportWAV: []
                    };
                    this.encodeDataView = function(samples) {
                        var l = samples.length * 2;
                        var sampleBit = 16;         // 默认采样数据位数，不建议修改, 噪音大
                        var bitRatio = sampleBit / 8;
                        var buffer = new ArrayBuffer(4 + samples.length * bitRatio);
                        var view = new DataView(buffer);

                        view.setUint8(0, l >> 24 & 0xff);
                        view.setUint8(1, l >> 16 & 0xff);
                        view.setUint8(2, l >> 8 & 0xff);
                        view.setUint8(3, l & 0xff);
                        floatTo16BitPCM(view, 4, samples);

                        return view;
                    }

                    Object.assign(this.config, cfg);
                    this.context = source.context;
                    this.node = (this.context.createScriptProcessor || this.context.createJavaScriptNode).call(this.context, this.config.bufferLen, this.config.numChannels, this.config.numChannels);

                    this.node.onaudioprocess = function (e) {
                        if (!_this.recording) return;

                        var buffer = [];
                        for (var channel = 0; channel < _this.config.numChannels; channel++) {
                            buffer.push(e.inputBuffer.getChannelData(channel));
                        }
                        // var newArray = interpolateArray(buffer[0], _this.config.cfgRate, this.context.sampleRate);
                        _this.worker.postMessage({
                            command: 'record',
                            buffer: buffer
                        });
                        var l = _this.config.bufferLen;
                        var customBuffer1 = compress(buffer[0], buffer[0].length);
                        // var customBuffer = mergeCustomBuffers(buffer[0], buffer[0].length);
                        // var customArray = interpolateArray(customBuffer, _this.config.cfgRate, this.context.sampleRate);

                        var dataview = _this.encodeDataView(customBuffer1);
                        // console.log(customBuffer1, dataview);
                        var audioBlob = new Blob([dataview], { type: 'audio/wav' });
                        var blobUrl = window.URL.createObjectURL(audioBlob);
                       
                        _this.socket.send(audioBlob);
                    };

                    source.connect(this.node);
                    this.node.connect(this.context.destination); //this should not be necessary

                    var self = {};
                    this.worker = new _inlineWorker2.default(function () {
                        var recLength = 0,
                            recBuffers = [],
                            sampleRate = undefined,
                            numChannels = undefined;

                        self.onmessage = function (e) {
                            switch (e.data.command) {
                                case 'init':
                                    init(e.data.config);
                                    break;
                                case 'record':
                                    record(e.data.buffer);
                                    break;
                                case 'exportWAV ':
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
                            cfgRate = config.cfgRate;
                            initBuffers();
                        }

                        function record(inputBuffer) {
                            for (var channel = 0; channel < numChannels; channel++) {
                                recBuffers[channel].push(inputBuffer[channel]);
                            }
                            recLength += inputBuffer[0].length;
                        }

                        // 修改采样率和采样数据
                        function interpolateArray(data, newSampleRate, oldSampleRate) {
                            var fitCount = Math.round(data.length*(newSampleRate/oldSampleRate));
                            var newData = new Array();
                            var springFactor = new Number((data.length - 1) / (fitCount - 1));
                            newData[0] = data[0]; // for new allocation
                            for ( var i = 1; i < fitCount - 1; i++) {
                                var tmp = i * springFactor;
                                var before = new Number(Math.floor(tmp)).toFixed();
                                var after = new Number(Math.ceil(tmp)).toFixed();
                                var atPoint = tmp - before;
                                newData[i] = this.linearInterpolate(data[before], data[after], atPoint);
                            }
                            newData[fitCount - 1] = data[data.length - 1]; // for new allocation
                            return newData;
                        };
                        function linearInterpolate(before, after, atPoint) {
                            return before + (after - before) * atPoint;
                        };

                        function exportWAV(type) {
                            var buffers = [];
                            for (var channel = 0; channel < numChannels; channel++){
                                var buffer = mergeBuffers(recBuffers[channel], recLength);
                                buffer = interpolateArray(buffer, cfgRate, sampleRate);
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
                                buffers.push(mergeBuffers(recBuffers[channel], recLength));
                            }
                            self.postMessage({ command: 'getBuffer', data: buffers });
                        }

                        function clear() {
                            recLength = 0;
                            recBuffers = [];
                            initBuffers();
                        }

                        function initBuffers() {
                            for (var channel = 0; channel < numChannels; channel++) {
                                recBuffers[channel] = [];
                            }
                        }

                        function mergeBuffers(recBuffers, recLength) {
                            var result = new Float32Array(recLength);
                            var offset = 0;
                            for (var i = 0; i < recBuffers.length; i++) {
                                result.set(recBuffers[i], offset);
                                offset += recBuffers[i].length;
                            }
                            return result;
                        }

                        function interleave(inputL, inputR) {
                            var length = inputL.length + inputR.length;
                            var result = new Float32Array(length);

                            var index = 0,
                                inputIndex = 0;

                            while (index < length) {
                                result[index++] = inputL[inputIndex];
                                result[index++] = inputR[inputIndex];
                                inputIndex++;
                            }
                            return result;
                        }

                        function floatTo16BitPCM(output, offset, input) {
                            for (var i = 0; i < input.length; i++ , offset += 2) {
                                var s = Math.max(-1, Math.min(1, input[i]));
                                output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                            }
                        }

                        function writeString(view, offset, string) {
                            for (var i = 0; i < string.length; i++) {
                                view.setUint8(offset + i, string.charCodeAt(i));
                            }
                        }

                        function encodeWAV(samples) {
                            var sampleBit = 16;         // 默认采样数据位数，不建议修改, 噪音大
                            var bitRatio = sampleBit / 8;
                            var buffer = new ArrayBuffer(44 + samples.length * bitRatio);
                            var view = new DataView(buffer);

                            /* RIFF 标志 */
                            writeString(view, 0, 'RIFF');
                            /* RIFF 文件长度 */
                            view.setUint32(4, 36 + samples.length * bitRatio, true);
                            /* WAVE 标志 */
                            writeString(view, 8, 'WAVE');
                            /* fmt 格式化块标志 */
                            writeString(view, 12, 'fmt ');
                            /* 格式化块长度 */
                            view.setUint32(16, 16, true);
                            /* 采样格式类别，1为PCM形式的声音数据 */
                            view.setUint16(20, 1, true);
                            /* 通道数，1为单声道，2为双声道 */
                            view.setUint16(22, numChannels, true);
                            /* 采样率，表示每个通道的播放速度，即每秒数据位数 */
                            view.setUint32(24, sampleRate, true);
                            /* 音频数据传送速率 (采样率 * 通道数 * 每采样数据位数 / 8（1字节8位)) */
                            view.setUint32(28, sampleRate * numChannels * bitRatio, true);
                            /* 数据块调整数 (通道数 * 每采样数据位数 / 8（1字节8位)) */
                            view.setUint16(32, numChannels * bitRatio, true);
                            /* 每个采样数据位数，多声道样本大小一样，一般为8或者16 */
                            view.setUint16(34, 16, true);
                            /* 数据块标记data */
                            writeString(view, 36, 'data');
                            /* 语音数据的长度 */
                            view.setUint32(40, samples.length * bitRatio, true);

                            floatTo16BitPCM(view, 44, samples);

                            return view;
                        }
                    }, self);

                    this.worker.postMessage({
                        command: 'init',
                        config: {
                            sampleRate: this.context.sampleRate,
                            numChannels: this.config.numChannels,
                            cfgRate: this.config.sampleRate,
                        }
                    });

                    this.worker.onmessage = function (e) {
                        var cb = _this.callbacks[e.data.command].pop();
                        if (typeof cb == 'function') {
                            cb(e.data.data);
                        }
                    };
                }

                _createClass(Recorder, [{
                    key: 'record',
                    value: function record(socket) {
                        this.recording = true;
                        this.socket = socket;
                    }
                }, {
                    key: 'stop',
                    value: function stop() {
                        this.recording = false;
                    }
                }, {
                    key: 'clear',
                    value: function clear() {
                        this.worker.postMessage({ command: 'clear' });
                    }
                }, {
                    key: 'getBuffer',
                    value: function getBuffer(cb) {
                        cb = cb || this.config.callback;
                        if (!cb) throw new Error('Callback not set');

                        this.callbacks.getBuffer.push(cb);

                        this.worker.postMessage({ command: 'getBuffer' });
                    }
                }, {
                    key: 'exportWAV',
                    value: function exportWAV(cb, mimeType) {
                        mimeType = mimeType || this.config.mimeType;
                        cb = cb || this.config.callback;
                        if (!cb) throw new Error('Callback not set');

                        this.callbacks.exportWAV.push(cb);

                        this.worker.postMessage({
                            command: 'exportWAV',
                            type: mimeType
                        });
                    }
                }, {
                    key: 'forceDownload',
                    value: function forceDownload(blob, filename) {
                        var url = (window.URL || window.webkitURL).createObjectURL(blob);
                        var link = window.document.createElement('a');
                        link.href = url;
                        link.text = '语音文件下载';
                        link.download = filename || 'output.wav';
                        link.style = "display: block; position: fixed; top: 30px; left: 680px;font-size: 24px;"
                        document.body.appendChild(link);
                    }
                }]);

                return Recorder;
            })();

            exports.default = Recorder;

        }, { "inline-worker": 3 }], 3: [function (require, module, exports) {
            "use strict";

            module.exports = require("./inline-worker");
        }, { "./inline-worker": 4 }], 4: [function (require, module, exports) {
            (function (global) {
                "use strict";

                var _createClass = (function () { function defineProperties(target, props) { for (var key in props) { var prop = props[key]; prop.configurable = true; if (prop.value) prop.writable = true; } Object.defineProperties(target, props); } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

                var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

                var WORKER_ENABLED = !!(global === global.window && global.URL && global.Blob && global.Worker);

                var InlineWorker = (function () {
                    function InlineWorker(func, self) {
                        var _this = this;

                        _classCallCheck(this, InlineWorker);

                        if (WORKER_ENABLED) {
                            var functionBody = func.toString().trim().match(/^function\s*\w*\s*\([\w\s,]*\)\s*{([\w\W]*?)}$/)[1];
                            var url = global.URL.createObjectURL(new global.Blob([functionBody], { type: "text/javascript" }));

                            return new global.Worker(url);
                        }

                        this.self = self;
                        this.self.postMessage = function (data) {
                            setTimeout(function () {
                                _this.onmessage({ data: data });
                            }, 0);
                        };

                        setTimeout(function () {
                            func.call(self);
                        }, 0);
                    }

                    _createClass(InlineWorker, {
                        postMessage: {
                            value: function postMessage(data) {
                                var _this = this;

                                setTimeout(function () {
                                    _this.self.onmessage({ data: data });
                                }, 0);
                            }
                        }
                    });

                    return InlineWorker;
                })();

                module.exports = InlineWorker;
            }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
        }, {}]
    }, {}, [1])(1)
});