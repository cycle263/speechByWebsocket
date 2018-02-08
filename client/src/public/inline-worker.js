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