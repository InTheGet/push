(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.window = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var _createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);
    }
  }return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;
  };
}();

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

var isFunction = require('../common/lib/isFunction');

var ClientMessages = function () {
  function ClientMessages() {
    _classCallCheck(this, ClientMessages);

    this._port = chrome.runtime.connect();
    this._counter = 0;
    this._port.onMessage.addListener(this.onMessageListener.bind(this));
    this._innerListeners = new Map();
    this._listeners = new Map();
  }

  _createClass(ClientMessages, [{
    key: 'sendMessage',
    value: function sendMessage(action, data, callback) {
      if (isFunction(data)) {
        callback = data;
        data = {};
      }

      var message = {
        payload: {
          action: action,
          data: data
        },
        timestamp: new Date().getTime() + '.' + this.counter
      };

      if (callback !== undefined) {
        this._innerListeners.set(message.timestamp, callback);
      }

      this.port.postMessage(message);
    }
  }, {
    key: 'getResponseFunction',
    value: function getResponseFunction(message) {
      var _this = this;

      return function (response) {
        var answer = {
          timestamp: message.timestamp,
          payload: response
        };
        _this.port.postMessage(answer);
      };
    }
  }, {
    key: 'onMessageListener',
    value: function onMessageListener(message) {
      var _this2 = this;

      if (!message || typeof message !== 'object' || !'timestamp' in message) {
        return;
      }

      if ('action' in message) {
        if (this._listeners.has(message.action)) {
          this._listeners.get(message.action).forEach(function (process) {
            return process(message.payload, _this2.getResponseFunction(message));
          });
        }

        return;
      }

      if (!this._innerListeners.has(message.timestamp)) {
        return;
      }

      this._innerListeners.get(message.timestamp)(message.payload);
      this._innerListeners.delete(message.timestamp);
    }
  }, {
    key: 'addMessageListener',
    value: function addMessageListener(action, callback) {
      if (!this._listeners.has(action)) {
        this._listeners.set(action, []);
      }

      this._listeners.get(action).push(callback);
    }
  }, {
    key: 'removeMessageListener',
    value: function removeMessageListener(action, callback) {
      if (!this._listeners.has(action)) {
        return;
      }

      var index = this._listeners.get(action).indexOf(callback);
      if (index !== -1) {
        this._listeners.get(action).splice(index, 1);
      }
    }
  }, {
    key: 'port',
    get: function get() {
      return this._port;
    }
  }, {
    key: 'counter',
    get: function get() {
      this._counter++;
      if (this._counter > 2000000) {
        this._counter = 0;
      }

      return this._counter;
    }
  }]);

  return ClientMessages;
}();

module.exports = ClientMessages;

},{"../common/lib/isFunction":4}],2:[function(require,module,exports){
'use strict';

var ClientMessages = require('./ClientMessages');
var clientMessages = new ClientMessages();

module.exports = function sendMessage(action, data, callback) {
  clientMessages.sendMessage(action, data, callback);
};

},{"./ClientMessages":1}],3:[function(require,module,exports){
'use strict';

module.exports = function isEmpty(value, key) {
  if (key !== undefined && typeof value === 'object') {
    if (isEmpty(value)) {
      return true;
    }

    if (!value.hasOwnProperty(key) && !(key in value)) {
      return true;
    }

    value = value[key];
  }

  if (value === null || value === undefined || value === '') {
    return true;
  }

  if (value.hasOwnProperty('length')) {
    return value.length === 0;
  }

  try {
    if (value instanceof Node) {
      return false;
    }
  } catch (e) {}

  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }

  return false;
};

},{}],4:[function(require,module,exports){
'use strict';

module.exports = function isFunction(obj) {
  return Object.prototype.toString.call(obj) === '[object Function]';
};

},{}],5:[function(require,module,exports){
'use strict';

var _slicedToArray = function () {
  function sliceIterator(arr, i) {
    var _arr = [];var _n = true;var _d = false;var _e = undefined;try {
      for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;_e = err;
    } finally {
      try {
        if (!_n && _i["return"]) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }return _arr;
  }return function (arr, i) {
    if (Array.isArray(arr)) {
      return arr;
    } else if (Symbol.iterator in Object(arr)) {
      return sliceIterator(arr, i);
    } else {
      throw new TypeError("Invalid attempt to destructure non-iterable instance");
    }
  };
}();

function parseArgs(str) {
  var result = new Map();

  if (str === '' || str === undefined || str === null) {
    return result;
  }

  str = str.replace(/^(\?|#)/, '');

  if (str === '') {
    return result;
  }

  var args = str.split('&');

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = args[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var element = _step.value;

      if (element.indexOf('=') !== -1) {
        var _element$split = element.split('='),
            _element$split2 = _slicedToArray(_element$split, 2),
            key = _element$split2[0],
            value = _element$split2[1];

        result.set(decodeURIComponent(key), decodeURIComponent(value));
      } else {
        result.set(element, null);
      }
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  return result;
}

function createArgs(args) {
  if (!(args instanceof Map)) {
    throw new Error('args should be instance of Map');
  }

  var result = [];
  args.forEach(function (value, key) {
    return result.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
  });
  return result.join('&');
}

exports.parseArgs = parseArgs;
exports.createArgs = createArgs;

},{}],6:[function(require,module,exports){
'use strict';

var isEmpty = require('./isEmpty');

function parseUri(string) {
  var o = void 0;
  var m = void 0;
  var uri = {};
  var l = void 0;
  var i = void 0;
  var match = void 0;
  var p = void 0;

  if (string.indexOf('@') >= 0) {
    string = string.split('//');
    if (string[1].indexOf('/') > 0) {
      string[1] = string[1].substr(0, string[1].indexOf('/')) + string[1].substr(string[1].indexOf('/')).replace('@', '%40');
    }

    string = string[0] + '//' + string[1];
  }

  o = parseUri.options;
  m = o.parser[o.strictMode ? 'strict' : 'loose'].exec(string);
  i = o.key.length;

  while (i--) {
    uri[o.key[i]] = m[i] || '';
  }

  uri.cache = 'https://webcache.googleusercontent.com/search?hl=en&ie=UTF-8&oe=UTF-8&q=cache:' + uri.url;
  uri.clean_domain = uri.domain.replace(/^www\./, '');

  uri.query = '?' + uri.query;

  match = uri.domain.match(/^.+\.{1}([a-z0-9\-]+\.{1}[a-z]+)$/i);
  uri.topdomain = match ? match[1] : uri.domain;

  p = uri.domain.split('.');
  p = p.reverse();
  for (i = 0, l = p.length; i < l; i++) {
    uri[(i + 1).toString()] = p[i];
  }

  if (isEmpty(uri, 'path')) {
    uri.path = '/';
  }

  return uri;
}

parseUri.options = {
  strictMode: false,
  key: ['url', 'scheme', 'authority', 'userInfo', 'user', 'password', 'domain', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'],
  q: {
    name: 'queryKey',
    parser: /(?:^|&)([^&=]*)=?([^&]*)/g
  },
  parser: {
    strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
    loose: /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
  }
};

function createUri(uriObject) {
  var result = uriObject.scheme + '://';

  if (!isEmpty(uriObject, 'user') || !isEmpty(uriObject, 'password')) {
    if (!isEmpty(uriObject, 'user')) {
      result += uriObject.user;
    }

    if (!isEmpty(uriObject, 'password')) {
      result += ':' + uriObject.password;
    }

    result += '@';
  }

  result += uriObject.domain;

  if (!isEmpty(uriObject, 'port')) {
    result += ':' + uriObject.port;
  }

  result += uriObject.path;

  if (!isEmpty(uriObject, 'query')) {
    var queryText = uriObject.query.replace(/^\?/, '');
    if (!isEmpty(queryText)) {
      result += '?' + queryText;
    }
  }

  if (!isEmpty(uriObject, 'anchor')) {
    result += '#' + uriObject.anchor;
  }

  return result;
}

function clearUri(uriString) {
  var uriObject = parseUri(uriString);
  uriObject.path = decodeURIComponent(uriObject.path.replace('+', ' '));
  return createUri(uriObject);
}

exports.parseUri = parseUri;
exports.createUri = createUri;
exports.clearUri = clearUri;

},{"./isEmpty":3}],7:[function(require,module,exports){
'use strict';

function run() {
  var urlMatch = /^http(s)?:\/\/(localhost:8000|auth\.rc\.semrush\.net|oauth\.semrush\.com)\/oauth2\/success/ig;
  if (window.top !== window || document === undefined || document.location === undefined || !urlMatch.test(document.location.toString())) {
    return;
  }

  var sendMessage = require('browser/clientSendMessage');
  var parseUri = require('../lib/parseUri');
  var parseArgs = require('../lib/parseArgs');

  var url = parseUri.parseUri(document.location.href);
  var args = parseArgs.parseArgs(url.query);

  if (args.has('code')) {
    var data = {
      code: args.get('code')
    };

    if (args.has('state')) {
      data.state = args.get('state');
    }

    sendMessage('sq.oauthCode', data, function () {
      sendMessage('sq.openConfigurationWindow', { panel: 'integration' }, function () {
        sendMessage('sq.closeTab');
      });
    });
  } else if (args.has('error')) {
    var _data = {
      error: args.get('error')
    };

    if (args.has('state')) {
      _data.state = args.get('state');
    }

    if (args.has('error_description')) {
      _data.error_description = args.get('error_description');
    }

    sendMessage('sq.oauthError', _data, function () {
      sendMessage('sq.openConfigurationWindow', { panel: 'integration' }, function () {
        sendMessage('sq.closeTab');
      });
    });
  }
}

run();

},{"../lib/parseArgs":5,"../lib/parseUri":6,"browser/clientSendMessage":2}]},{},[7])(7)
});