(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.window = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var lib = require('../common/Lib');
var extend = require('extend');
var analyticsClient = require('../common/analytics/clientMixin');
var DeathQueue = require('./DeathQueue');
var ClientMessages = require('./ClientMessages');

var clientMessages = new ClientMessages();
var deathQueue = new DeathQueue();
var messageListeners = new Map();

analyticsClient(exports);

exports.getDisabledState = function (plugin, callback) {
  if (lib.isFunction(plugin)) {
    callback = plugin;
    plugin = 'core';
  } else {
    plugin = plugin || 'core';
  }

  exports.getConfigurationItem(plugin + '.disabled', false, callback);
};

exports.setDisabledState = function (plugin, value, callback) {
  if (lib.isFunction(value)) {
    callback = value;
    value = plugin;
    plugin = 'core';
  } else {
    plugin = plugin || 'core';
  }

  exports.setConfigurationItem(plugin + '.disabled', value, callback);
};

exports.toggleDisabledState = function (plugin, callback) {
  if (lib.isFunction(plugin)) {
    callback = plugin;
    plugin = 'core';
  } else {
    plugin = plugin || 'core';
  }

  exports.getDisabledState(plugin, function (value) {
    value = !value;
    exports.setDisabledState(plugin, value, callback);
  });
};

exports.getConfigurationItem = function (name, defaultValue, callback) {
  if (!name) {
    callback(defaultValue);
    return;
  }

  exports.sendMessage('sq.getConfigurationItem', name, callback);
};

exports.getConfiguration = function (callback) {
  exports.sendMessage('sq.getConfiguration', null, callback);
};

exports.getParameters = function (callback) {
  exports.sendMessage('sq.getParameters', null, callback);
};

exports.setParameters = function (data, callback) {
  exports.sendMessage('sq.setParameters', data, callback);
};

exports.setConfigurationItem = function (name, value, callback) {
  exports.sendMessage('sq.setConfigurationItem', {
    name: name,
    value: value
  }, callback);
};

exports.setConfiguration = function (data, callback) {
  exports.sendMessage('sq.setConfiguration', data, callback);
};

exports.hidePanel = function () {
  window.close();
};

exports.openTab = function (url, callback) {
  chrome.tabs.create({ url: url }, callback);
};

exports.openConfigurationWindow = function (panel, callback) {
  if (lib.isString(panel)) {
    exports.sendMessage('sq.openConfigurationWindow', { panel: panel }, callback);
  } else {
    exports.sendMessage('sq.openConfigurationWindow', panel);
  }
};

exports.closeConfigurationWindow = function (callback) {
  exports.sendMessage('sq.closeConfigurationWindow', callback);
};

exports.sendMessage = function (action, data, callback) {
  clientMessages.sendMessage(action, data, callback);
};

exports.addMessageListener = function (action, callback) {
  if (action === 'detach') {
    deathQueue.add(callback);
    return;
  }

  if (callback === undefined) {
    callback = defaultCallback;
  }

  messageListeners.set(callback, function (data, sender, sendResponse) {
    if (sender.tab || !data.hasOwnProperty('action') || !('timestamp' in data) || data.action !== action) {
      return;
    }

    return callback(data.payload, sendResponse);
  });

  chrome.runtime.onMessage.addListener(messageListeners.get(callback));
};

exports.removeMessageListener = function (action, callback) {
  if (messageListeners.has(callback)) {
    try {
      chrome.runtime.onMessage.removeListener(messageListeners.get(callback));
    } catch (e) {}

    messageListeners.delete(callback);
  }
};

exports.t = require('./clientTranslate');

exports.getAssetsUrl = function (callback) {
  callback(chrome.extension.getURL(''));
};

exports.getCurrentWindowUrl = function (callback) {
  if (lib.isFunction(callback)) {
    chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
      if (tabs.length > 0) {
        callback(tabs[0].url, tabs[0].status, tabs[0].id);
        return;
      }

      callback('');
    });
  } else {
    return new Promise(function (resolve, reject) {
      chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
        if (tabs.length > 0) {
          resolve({ url: tabs[0].url, status: tabs[0].status, id: tabs[0].id });
          return;
        }

        reject('Not found');
      });
    });
  }
};

exports.decode = function (value) {
  return exports.entities.decode(value);
};

exports.entities = require('../common/utils/entities')();

deathQueue.setSendMessage(exports.sendMessage);

function defaultCallback(data, sendResponse) {
  return sendResponse(data);
}

},{"../common/Lib":5,"../common/analytics/clientMixin":6,"../common/utils/entities":65,"./ClientMessages":2,"./DeathQueue":3,"./clientTranslate":4,"extend":76}],2:[function(require,module,exports){
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

},{"../common/lib/isFunction":55}],3:[function(require,module,exports){
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

var DeathQueue = function () {
  function DeathQueue() {
    _classCallCheck(this, DeathQueue);

    this._callbacks = new Set();
    this._running = false;
    this._sendMessage = function () {};

    this.processAlive = this._checkAlive.bind(this);
  }

  _createClass(DeathQueue, [{
    key: 'add',
    value: function add(callback) {
      if (!this._callbacks.has(callback)) {
        this._callbacks.add(callback);
      }

      if (!this._running) {
        this.run();
      }
    }
  }, {
    key: 'run',
    value: function run() {
      this._running = true;
      this._checkAlive();
    }
  }, {
    key: 'stop',
    value: function stop() {
      this._running = false;
    }
  }, {
    key: 'setSendMessage',
    value: function setSendMessage(callback) {
      this._sendMessage = callback;
    }
  }, {
    key: '_isAlive',
    value: function _isAlive() {
      var _this = this;

      return new Promise(function (resolve, reject) {
        _this._sendMessage('sq.alive', function () {
          if (arguments.length === 0 && chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    }
  }, {
    key: '_checkAlive',
    value: function _checkAlive() {
      var _this2 = this;

      if (this._running) {
        this._isAlive().then(function () {
          return setTimeout(_this2.processAlive, 1000);
        }).catch(function () {
          return _this2._processCallbacks();
        });
      }
    }
  }, {
    key: '_processCallbacks',
    value: function _processCallbacks() {
      this._running = false;
      this._callbacks.forEach(function (callback) {
        return callback();
      });
      this._callbacks.clear();
    }
  }]);

  return DeathQueue;
}();

module.exports = DeathQueue;

},{}],4:[function(require,module,exports){
'use strict';

var entities = require('../common/utils/entities')();

module.exports = function (messageId, setCallback) {
  setCallback(entities.decode(chrome.i18n.getMessage(messageId)));
};

},{"../common/utils/entities":65}],5:[function(require,module,exports){
'use strict';

var hexMd5 = require('./hex-md5');
var getGoogleChecksum = require('./googleChecksum');
var startsWith = require('./lib/startsWith.js');
var containsText = require('./lib/containsText.js');
var endsWith = require('./lib/endsWith.js');

exports.SEOQUAKE_MODE_ON_LOAD = 0;
exports.SEOQUAKE_MODE_BY_REQUEST = 1;

exports.SEOQUAKE_RESULT_ERROR = 'error';
exports.SEOQUAKE_RESULT_NO = 'no';
exports.SEOQUAKE_RESULT_NODATA = 'n/a';
exports.SEOQUAKE_RESULT_CAPTCHA = 'captcha';
exports.SEOQUAKE_RESULT_QUESTION = '?';
exports.SEOQUAKE_RESULT_WAIT = 'wait...';
exports.SEOQUAKE_RESULT_YES = 'yes';

exports.SEOQUAKE_SORT_ASC = 'asc';
exports.SEOQUAKE_SORT_DESC = 'desc';

exports.SEOQUAKE_TYPE_DATE = 1;
exports.SEOQUAKE_TYPE_INT = 2;
exports.SEOQUAKE_TYPE_STRING = 4;
exports.SEOQUAKE_TYPE_IP = 8;

exports.SEOQUAKE_ADBLOCK_URL = 'https://www.seoquake.com/seoadv.html?ver={seoquake_version}';

exports.SEOQUAKE_CSV_DELIMITER = ';';
exports.SEOQUAKE_NOTIFICATION_TIMEOUT = 5000;
exports.SEOQUAKE_MAX_HIGHLIGHT_SITES = 50;

exports.SEOQUAKE_PARAM_DELETE = 'deleted';
exports.SEOQUAKE_PARAM_FULLY_DELETE = 'fully_deleted';
exports.SEOQUAKE_PARAM_CUSTOM = 'custom';
exports.SEOQUAKE_PARAM_MODIFIED = 'modified';

exports.isEmpty = require('./lib/isEmpty');

exports.isFunction = function (obj) {
  return Object.prototype.toString.call(obj) === '[object Function]';
};

exports.isArray = require('./lib/isArray');

exports.isObject = require('./lib/isObject');

exports.isString = require('./lib/isString');

exports.$A = require('./lib/arrayFrom').$A;

exports.startsWith = startsWith;

exports.containsText = containsText;

exports.endsWith = endsWith;

exports.trim = function (string) {
  string = string || '';
  return string.trim();
};

exports.trimHash = require('./lib/trimHash');

exports.cleanString = function (string) {
  string = string.replace(/([,;!\+=#@\^&~\$\/:\?\(\)\[\]\\"\*\|•·“”<>%\{\}])/ig, ' ');
  string = string.replace(/'+/g, '\'').replace(/(\s'|'(\s|$))/g, ' ');
  string = string.replace(/([\n\t\r]+)/g, ' ').replace(/([ \u00A0]{2,})/g, ' ');
  string = exports.trim(string.toLocaleLowerCase());
  return string;
};

exports.stripTags = function (string) {
  string = string.replace(/&[#0-9a-z]+;/ig, ' ');
  return string.replace(/<\/?[^>]+>/gi, ' ');
};

exports.normalizeString = function (string, bLeaveCase) {
  string = string.replace(/([\.;\+=#@\^&~\$\/:\?'\(\)\[\]\\"\*\|•·“”<>%\{\}])/ig, ' ').replace(/([\-]+)/ig, ' ');
  string = string.replace(/([\n\t\r]+)/g, ' ').replace(/([ ]{2,})/g, ' ');
  if (!bLeaveCase) {
    string = string.toLocaleLowerCase();
  }

  return string;
};

exports.sanitizeString = function (string, bLeaveCase) {
  return exports.normalizeString(exports.stripTags(string), bLeaveCase);
};

exports.stripScripts = function (string) {
  return string.replace(new RegExp('(?:<script.*?>)((\n|\r|.)*?)(?:<\/script>)', 'img'), '');
};

exports.truncate = function (string, length, replace) {
  length = length || 80;
  replace = replace || '...';
  var curLength = length - replace.length;
  if (string.length - replace.length > length) {
    string = string.substr(0, curLength) + replace;
  }

  return string;
};

exports.valuesCompare = function (a, b) {
  if (exports.isArray(a) && exports.isArray(b)) {
    return exports.arraysCompare(a, b);
  } else {
    return a == b;
  }
};

exports.arraysCompare = function (a, b) {
  var i = void 0;
  var l = void 0;

  if (a.length !== b.length) {
    return false;
  } else {
    for (i = 0, l = a.length; i < l; i++) {
      if (b.indexOf(a[i]) === -1) {
        return false;
      }
    }
  }

  return true;
};

exports.parseUri = require('./lib/parseUri').parseUri;
exports.clearUri = require('./lib/parseUri').clearUri;
exports.parseArgs = require('./lib/parseArgs').parseArgs;

exports.shortHash = require('./lib/shortHash');

exports.createRequestUrl = function (template, uri, searchQuery, uPos) {
  return template.replace(/{([^{}]+)}/ig, function (match, tag) {
    var i = void 0;
    var l = void 0;
    var value = void 0;
    var searchQueryTmp = void 0;

    tag = tag.split('|');
    tag[0] = exports.trim(tag[0]);

    if (tag[0] in uri) {

      value = uri[tag[0]];

      for (i = 1, l = tag.length; i < l; i++) {
        if (exports.trim(tag[i]) === 'encode') {
          value = value.replace(/\/\/(.+:.+@)/i, '//');
          value = encodeURIComponent(value);
        } else if (exports.trim(tag[i]) === 'trimrslash') {
          if (exports.endsWith(value, '/')) {
            value = value.substring(0, value.length - 1);
          }
        } else if (exports.trim(tag[i]) === 'md5') {
          value = hexMd5(value);
        }
      }

      return value;
    } else if (tag[0].match(/^\d+$/)) {
      return '';
    } else {
      switch (tag[0]) {
        case 'keyword':
          if (searchQuery) {
            searchQueryTmp = searchQuery;
            for (i = 1, l = tag.length; i < l; i++) {
              if (exports.trim(tag[i]) === 'encode') {
                searchQueryTmp = encodeURIComponent(searchQuery);
              }
            }

            return searchQueryTmp;
          } else {
            return '';
          }

        case 'pos':
          if (uPos && uPos !== null) {
            uri.u_pos = uPos;
            return uri.u_pos;
          } else {
            return '0';
          }

        case 'localip':
        case 'installdate':
          return '';
        case 'gchecksum':
          return getGoogleChecksum('info:' + uri.url);
        default:
          return match;
      }
    }
  });
};

exports.countFields = function (object) {
  var result = 0;

  for (var key in object) {
    if (object.hasOwnProperty(key)) {
      result++;
    }
  }

  return result;
};

exports.hex_md5 = hexMd5;

exports.getVarValueFromURL = function (url, varName) {
  return exports.parseArgs(url).get(varName);
};

exports.ip2long = require('./lib/ip2long');

exports.getUUID = require('./lib/getUUID');

},{"./googleChecksum":34,"./hex-md5":46,"./lib/arrayFrom":47,"./lib/containsText.js":48,"./lib/endsWith.js":49,"./lib/getUUID":50,"./lib/ip2long":52,"./lib/isArray":53,"./lib/isEmpty":54,"./lib/isObject":56,"./lib/isString":57,"./lib/parseArgs":58,"./lib/parseUri":59,"./lib/shortHash":60,"./lib/startsWith.js":61,"./lib/trimHash":62}],6:[function(require,module,exports){
'use strict';

var isEmpty = require('../lib/isEmpty');

module.exports = function analyticsClientMixin(client) {
  client.registerEvent = function (category, action, label) {
    if (isEmpty(category) || isEmpty(action)) {
      return;
    }

    var data = {
      category: category,
      action: action
    };
    if (label) {
      data.label = label;
    }

    this.sendMessage('sq.analyticsEvent', data);
  };

  client.registerPage = function (page) {
    if (isEmpty(page)) {
      return;
    }

    this.sendMessage('sq.analyticsPage', { page: page });
  };
};

},{"../lib/isEmpty":54}],7:[function(require,module,exports){

module.exports = {
  "af": {
    "generic": {
      "full": "EEEE dd MMMM y G",
      "long": "dd MMMM y G",
      "medium": "dd MMM y G",
      "short": "GGGGG y-MM-dd"
    },
    "gregorian": {
      "full": "EEEE, dd MMMM y",
      "long": "dd MMMM y",
      "medium": "dd MMM y",
      "short": "y-MM-dd"
    }
  },
  "af_NA": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y"
    }
  },
  "agq": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM, y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM, y",
      "short": "d/M/y"
    }
  },
  "ak": {
    "generic": {
      "full": "EEEE, G y MMMM dd",
      "long": "G y MMMM d",
      "medium": "G y MMM d",
      "short": "GGGGG yy/MM/dd"
    },
    "gregorian": {
      "full": "EEEE, y MMMM dd",
      "long": "y MMMM d",
      "medium": "y MMM d",
      "short": "yy/MM/dd"
    }
  },
  "am": {
    "generic": {
      "full": "EEEE፣ d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE ፣d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "ar": {
    "generic": {
      "full": "EEEE، d MMMM، y G",
      "long": "d MMMM، y G",
      "medium": "dd‏/MM‏/y G",
      "short": "d‏/M‏/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE، d MMMM، y",
      "long": "d MMMM، y",
      "medium": "dd‏/MM‏/y",
      "short": "d‏/M‏/y"
    }
  },
  "as": {
    "generic": {
      "full": "EEEE, d MMMM, y G",
      "long": "d MMMM, y G",
      "medium": "dd-MM-y G",
      "short": "d-M-y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM, y",
      "long": "d MMMM, y",
      "medium": "dd-MM-y",
      "short": "d-M-y"
    }
  },
  "asa": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "ast": {
    "generic": {
      "full": "EEEE, dd MMMM 'de' y G",
      "long": "d MMMM 'de' y G",
      "medium": "d MMM y G",
      "short": "d/M/yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM 'de' y",
      "long": "d MMMM 'de' y",
      "medium": "d MMM y",
      "short": "d/M/yy"
    }
  },
  "az": {
    "generic": {
      "full": "G d MMMM y, EEEE",
      "long": "G d MMMM, y",
      "medium": "G d MMM y",
      "short": "GGGGG dd.MM.y"
    },
    "gregorian": {
      "full": "d MMMM y, EEEE",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd.MM.yy"
    }
  },
  "bas": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM, y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM, y",
      "short": "d/M/y"
    }
  },
  "bem": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "be": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d.M.y G",
      "short": "d.M.y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y 'г'.",
      "long": "d MMMM y 'г'.",
      "medium": "d.MM.y",
      "short": "d.MM.yy"
    }
  },
  "bez": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "bg": {
    "generic": {
      "full": "EEEE, d MMMM y 'г'. G",
      "long": "d MMMM y 'г'. G",
      "medium": "d.MM.y 'г'. G",
      "short": "d.MM.yy G"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y 'г'.",
      "long": "d MMMM y 'г'.",
      "medium": "d.MM.y 'г'.",
      "short": "d.MM.yy 'г'."
    }
  },
  "bm": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM, y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM, y",
      "short": "d/M/y"
    }
  },
  "bo": {
    "generic": {
      "long": "G སྤྱི་ལོ་y MMMMའི་ཚེས་d",
      "medium": "G y ལོའི་MMMཚེས་d"
    },
    "gregorian": {
      "full": "y MMMMའི་ཚེས་d, EEEE",
      "long": "སྤྱི་ལོ་y MMMMའི་ཚེས་d",
      "medium": "y ལོའི་MMMཚེས་d",
      "short": "y-MM-dd"
    }
  },
  "bn": {
    "generic": {
      "full": "EEEE, d MMMM, y G",
      "long": "d MMMM, y G",
      "medium": "d MMM, y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM, y",
      "long": "d MMMM, y",
      "medium": "d MMM, y",
      "short": "d/M/yy"
    }
  },
  "br": {
    "generic": {
      "full": "G y MMMM d, EEEE",
      "long": "G y MMMM d",
      "medium": "G y MMM d",
      "short": "GGGGG y-MM-dd"
    },
    "gregorian": {
      "full": "y MMMM d, EEEE",
      "long": "y MMMM d",
      "medium": "y MMM d",
      "short": "y-MM-dd"
    }
  },
  "brx": {
    "generic": {
      "full": "EEEE, MMMM d, y G",
      "long": "MMMM d, y G",
      "medium": "MMM d, y G",
      "short": "M/d/yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE, MMMM d, y",
      "long": "MMMM d, y",
      "medium": "MMM d, y",
      "short": "M/d/yy"
    }
  },
  "bs": {
    "generic": {
      "full": "EEEE, dd. MMMM y. G",
      "long": "dd. MMMM y. G",
      "medium": "dd.MM.y. G",
      "short": "d.M.y. GGGGG"
    },
    "gregorian": {
      "full": "EEEE, dd. MMMM y.",
      "long": "dd. MMMM y.",
      "medium": "dd.MM.y.",
      "short": "d.M.yy."
    }
  },
  "ca": {
    "generic": {
      "full": "EEEE d MMMM 'de' y G",
      "long": "d MMMM 'de' y G",
      "medium": "d/M/y G",
      "short": "d/M/yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM 'de' y",
      "long": "d MMMM 'de' y",
      "medium": "d MMM y",
      "short": "d/M/yy"
    }
  },
  "cgg": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "ckb": {
    "generic": {
      "full": "G y MMMM d, EEEE",
      "long": "dی MMMMی y G",
      "medium": "G y MMM d",
      "short": "GGGGG y-MM-dd"
    },
    "gregorian": {
      "full": "y MMMM d, EEEE",
      "long": "dی MMMMی y",
      "medium": "y MMM d",
      "short": "y-MM-dd"
    }
  },
  "chr": {
    "generic": {
      "full": "EEEE, MMMM d, y G",
      "long": "MMMM d, y G",
      "medium": "MMM d, y G",
      "short": "M/d/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, MMMM d, y",
      "long": "MMMM d, y",
      "medium": "MMM d, y",
      "short": "M/d/yy"
    }
  },
  "cu": {
    "generic": {
      "full": "G y MMMM d, EEEE",
      "long": "G y MMMM d",
      "medium": "G y MMM d",
      "short": "GGGGG y-MM-dd"
    },
    "gregorian": {
      "full": "EEEE, d MMMM 'л'. y.",
      "long": "y MMMM d",
      "medium": "y MMM d",
      "short": "y.MM.dd"
    }
  },
  "cs": {
    "generic": {
      "full": "EEEE d. MMMM y G",
      "long": "d. MMMM y G",
      "medium": "d. M. y G",
      "short": "dd.MM.yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE d. MMMM y",
      "long": "d. MMMM y",
      "medium": "d. M. y",
      "short": "dd.MM.yy"
    }
  },
  "cy": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/yy"
    }
  },
  "dav": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "da": {
    "generic": {
      "full": "EEEE d. MMMM y G",
      "long": "d. MMMM y G",
      "medium": "d. MMM y G",
      "short": "d/M/y"
    },
    "gregorian": {
      "full": "EEEE 'den' d. MMMM y",
      "long": "d. MMMM y",
      "medium": "d. MMM y",
      "short": "dd/MM/y"
    }
  },
  "de": {
    "generic": {
      "full": "EEEE, d. MMMM y G",
      "long": "d. MMMM y G",
      "medium": "dd.MM.y G",
      "short": "dd.MM.yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d. MMMM y",
      "long": "d. MMMM y",
      "medium": "dd.MM.y",
      "short": "dd.MM.yy"
    }
  },
  "dje": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM, y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM, y",
      "short": "d/M/y"
    }
  },
  "dua": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "d/M/y"
    }
  },
  "dyo": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "d/M/y"
    }
  },
  "dsb": {
    "generic": {
      "full": "EEEE, d. MMMM y G",
      "long": "d. MMMM y G",
      "medium": "d.M.y G",
      "short": "d.M.yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d. MMMM y",
      "long": "d. MMMM y",
      "medium": "d.M.y",
      "short": "d.M.yy"
    }
  },
  "dz": {
    "generic": {
      "full": "EEEE, G སྤྱི་ལོ་y MMMM ཚེས་dd",
      "long": "G སྤྱི་ལོ་y MMMM ཚེས་ dd",
      "medium": "G སྤྱི་ལོ་y ཟླ་MMM ཚེས་dd",
      "short": "GGGGG y-MM-dd"
    },
    "gregorian": {
      "full": "EEEE, སྤྱི་ལོ་y MMMM ཚེས་dd",
      "long": "སྤྱི་ལོ་y MMMM ཚེས་ dd",
      "medium": "སྤྱི་ལོ་y ཟླ་MMM ཚེས་dd",
      "short": "y-MM-dd"
    }
  },
  "ebu": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "ee": {
    "generic": {
      "full": "EEEE, MMMM d 'lia' y G",
      "long": "MMMM d 'lia' y G",
      "medium": "MMM d 'lia', y G",
      "short": "M/d/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, MMMM d 'lia' y",
      "long": "MMMM d 'lia' y",
      "medium": "MMM d 'lia', y",
      "short": "M/d/yy"
    }
  },
  "el": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "d/M/yy"
    }
  },
  "en_001": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "en": {
    "generic": {
      "full": "EEEE, MMMM d, y G",
      "long": "MMMM d, y G",
      "medium": "MMM d, y G",
      "short": "M/d/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, MMMM d, y",
      "long": "MMMM d, y",
      "medium": "MMM d, y",
      "short": "M/d/yy"
    }
  },
  "en_BE": {
    "generic": {
      "medium": "dd MMM y G"
    },
    "gregorian": {
      "medium": "dd MMM y",
      "short": "dd/MM/yy"
    }
  },
  "en_AU": {
    "gregorian": {
      "short": "d/M/yy"
    }
  },
  "en_BW": {
    "generic": {
      "full": "EEEE, dd MMMM y G",
      "long": "dd MMMM y G",
      "medium": "dd MMM y G"
    },
    "gregorian": {
      "full": "EEEE, dd MMMM y",
      "long": "dd MMMM y",
      "medium": "dd MMM y",
      "short": "dd/MM/yy"
    }
  },
  "en_BZ": {
    "generic": {
      "full": "EEEE, dd MMMM y G",
      "long": "dd MMMM y G",
      "medium": "dd-MMM-y G"
    },
    "gregorian": {
      "full": "EEEE, dd MMMM y",
      "long": "dd MMMM y",
      "medium": "dd-MMM-y",
      "short": "dd/MM/yy"
    }
  },
  "en_CA": {
    "generic": {
      "full": "EEEE, MMMM d, y G",
      "long": "MMMM d, y G",
      "medium": "MMM d, y G",
      "short": "GGGGG y-MM-dd"
    },
    "gregorian": {
      "full": "EEEE, MMMM d, y",
      "long": "MMMM d, y",
      "medium": "MMM d, y",
      "short": "y-MM-dd"
    }
  },
  "en_HK": {
    "generic": {
      "full": "EEEE, d MMMM, y G",
      "long": "d MMMM, y G",
      "medium": "d MMM, y G",
      "short": "d/M/yy GGGGG"
    },
    "gregorian": {
      "short": "d/M/y"
    }
  },
  "en_IE": {
    "generic": {
      "full": "EEEE d MMMM y G"
    },
    "gregorian": {
      "full": "EEEE d MMMM y"
    }
  },
  "en_IN": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "medium": "dd-MMM-y G"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "medium": "dd-MMM-y",
      "short": "dd/MM/yy"
    }
  },
  "en_JM": {
    "generic": {
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "short": "d/M/yy"
    }
  },
  "en_MT": {
    "generic": {
      "long": "dd MMMM y G",
      "medium": "dd MMM y G"
    },
    "gregorian": {
      "long": "dd MMMM y",
      "medium": "dd MMM y"
    }
  },
  "en_NZ": {
    "generic": {
      "medium": "d/MM/y G",
      "short": "d/MM/y GGGGG"
    },
    "gregorian": {
      "medium": "d/MM/y",
      "short": "d/MM/yy"
    }
  },
  "en_PK": {
    "generic": {
      "medium": "dd-MMM-y G"
    },
    "gregorian": {
      "medium": "dd-MMM-y"
    }
  },
  "en_SE": {
    "generic": {
      "short": "G y-MM-dd"
    },
    "gregorian": {
      "short": "y-MM-dd"
    }
  },
  "en_SG": {
    "generic": {
      "short": "d/M/yy GGGGG"
    },
    "gregorian": {
      "short": "d/M/yy"
    }
  },
  "en_ZA": {
    "generic": {
      "full": "EEEE, dd MMMM y G",
      "long": "dd MMMM y G",
      "medium": "dd MMM y G",
      "short": "GGGGG y/MM/dd"
    },
    "gregorian": {
      "full": "EEEE, dd MMMM y",
      "long": "dd MMMM y",
      "medium": "dd MMM y",
      "short": "y/MM/dd"
    }
  },
  "en_ZW": {
    "generic": {
      "full": "EEEE, dd MMMM y G",
      "long": "dd MMMM y G",
      "medium": "dd MMM,y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, dd MMMM y",
      "long": "dd MMMM y",
      "medium": "dd MMM,y",
      "short": "d/M/y"
    }
  },
  "eo": {
    "generic": {
      "full": "EEEE, d-'a' 'de' MMMM y G",
      "long": "G y-MMMM-dd",
      "medium": "G y-MMM-dd",
      "short": "GGGGG y-MM-dd"
    },
    "gregorian": {
      "full": "EEEE, d-'a' 'de' MMMM y",
      "long": "y-MMMM-dd",
      "medium": "y-MMM-dd",
      "short": "yy-MM-dd"
    }
  },
  "es_419": {
    "generic": {
      "short": "dd/MM/yy GGGGG"
    }
  },
  "es_BO": {
    "gregorian": {
      "medium": "d MMM 'de' y"
    }
  },
  "es": {
    "generic": {
      "full": "EEEE, d 'de' MMMM 'de' y G",
      "long": "d 'de' MMMM 'de' y G",
      "medium": "d/M/y G",
      "short": "d/M/yy G"
    },
    "gregorian": {
      "full": "EEEE, d 'de' MMMM 'de' y",
      "long": "d 'de' MMMM 'de' y",
      "medium": "d MMM y",
      "short": "d/M/yy"
    }
  },
  "es_CL": {
    "generic": {
      "medium": "dd-MM-y G",
      "short": "dd-MM-y GGGGG"
    },
    "gregorian": {
      "medium": "dd-MM-y",
      "short": "dd-MM-yy"
    }
  },
  "es_CO": {
    "generic": {
      "medium": "d/MM/y G",
      "short": "d/MM/yy GGGGG"
    },
    "gregorian": {
      "medium": "d/MM/y",
      "short": "d/MM/yy"
    }
  },
  "es_DO": {
    "generic": {
      "medium": "dd/MM/y G"
    }
  },
  "es_GT": {
    "generic": {
      "medium": "d/MM/y G",
      "short": "d/MM/yy GGGGG"
    },
    "gregorian": {
      "medium": "d/MM/y",
      "short": "d/MM/yy"
    }
  },
  "es_HN": {
    "generic": {
      "full": "EEEE dd 'de' MMMM 'de' y G",
      "long": "dd 'de' MMMM 'de' y G"
    },
    "gregorian": {
      "full": "EEEE dd 'de' MMMM 'de' y",
      "long": "dd 'de' MMMM 'de' y"
    }
  },
  "es_PA": {
    "generic": {
      "medium": "MM/dd/y G",
      "short": "MM/dd/yy GGGGG"
    },
    "gregorian": {
      "medium": "MM/dd/y",
      "short": "MM/dd/yy"
    }
  },
  "es_PE": {
    "generic": {
      "short": "d/MM/yy GGGGG"
    },
    "gregorian": {
      "short": "d/MM/yy"
    }
  },
  "es_MX": {
    "generic": {
      "medium": "d MMM, y G"
    },
    "gregorian": {
      "medium": "dd/MM/y",
      "short": "dd/MM/yy"
    }
  },
  "es_PR": {
    "generic": {
      "medium": "MM/dd/y G",
      "short": "MM/dd/yy GGGGG"
    },
    "gregorian": {
      "medium": "MM/dd/y",
      "short": "MM/dd/yy"
    }
  },
  "ewo": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "d/M/y"
    }
  },
  "et": {
    "generic": {
      "full": "EEEE, d. MMMM y G",
      "long": "d. MMMM y G",
      "medium": "dd.MM.y G",
      "short": "dd.MM.y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d. MMMM y",
      "long": "d. MMMM y",
      "medium": "d. MMM y",
      "short": "dd.MM.yy"
    }
  },
  "eu": {
    "generic": {
      "full": "G. 'aroko' y. 'urteko' MMMM d, EEEE",
      "long": "G. 'aroko' y. 'urteko' MMMM d",
      "medium": "G. 'aroko' y('e')'ko' MMM d",
      "short": "GGGGG y-MM-dd"
    },
    "gregorian": {
      "full": "y('e')'ko' MMMM d, EEEE",
      "long": "y('e')'ko' MMMM d",
      "medium": "y MMM d",
      "short": "yy/M/d"
    }
  },
  "ff": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM, y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM, y",
      "short": "d/M/y"
    }
  },
  "fa": {
    "generic": {
      "full": "G y MMMM d, EEEE",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "y/M/d G"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "y/M/d"
    }
  },
  "fi": {
    "generic": {
      "full": "cccc d. MMMM y G",
      "long": "d. MMMM y G",
      "medium": "d.M.y G",
      "short": "d.M.y GGGGG"
    },
    "gregorian": {
      "full": "cccc d. MMMM y",
      "long": "d. MMMM y",
      "medium": "d.M.y",
      "short": "d.M.y"
    }
  },
  "fil": {
    "generic": {
      "full": "EEEE, MMMM d, y G",
      "long": "MMMM d, y G",
      "medium": "MMM d, y G",
      "short": "M/d/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, MMMM d, y",
      "long": "MMMM d, y",
      "medium": "MMM d, y",
      "short": "M/d/yy"
    }
  },
  "fo": {
    "generic": {
      "full": "EEEE, dd. MMMM y G",
      "long": "d. MMMM y G",
      "medium": "d. MMM y G",
      "short": "dd.MM.y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d. MMMM y",
      "long": "d. MMMM y",
      "medium": "dd.MM.y",
      "short": "dd.MM.yy"
    }
  },
  "fr_BE": {
    "generic": {
      "short": "d/MM/yy GGGGG"
    },
    "gregorian": {
      "short": "d/MM/yy"
    }
  },
  "fr": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "fr_CA": {
    "generic": {
      "short": "yy-MM-dd GGGGG"
    },
    "gregorian": {
      "short": "yy-MM-dd"
    }
  },
  "fr_CH": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "short": "dd.MM.y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "short": "dd.MM.yy"
    }
  },
  "fur": {
    "generic": {
      "full": "EEEE d 'di' MMMM 'dal' y G",
      "long": "d 'di' MMMM 'dal' y G",
      "medium": "dd/MM/y G",
      "short": "dd/MM/yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE d 'di' MMMM 'dal' y",
      "long": "d 'di' MMMM 'dal' y",
      "medium": "dd/MM/y",
      "short": "dd/MM/yy"
    }
  },
  "fy": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd-MM-yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd-MM-yy"
    }
  },
  "ga": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "gd": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d'mh' MMMM y",
      "long": "d'mh' MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "gl": {
    "generic": {
      "full": "cccc, d 'de' MMMM 'de' Y G",
      "long": "d 'de' MMMM 'de' y G",
      "medium": "d 'de' MMM 'de' y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d 'de' MMMM 'de' y",
      "long": "d 'de' MMMM 'de' y",
      "medium": "d 'de' MMM 'de' y",
      "short": "dd/MM/yy"
    }
  },
  "gsw": {
    "generic": {
      "full": "EEEE, d. MMMM y G",
      "long": "d. MMMM y G",
      "medium": "dd.MM.y G",
      "short": "dd.MM.yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d. MMMM y",
      "long": "d. MMMM y",
      "medium": "dd.MM.y",
      "short": "dd.MM.yy"
    }
  },
  "guz": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "gv": {
    "generic": {
      "full": "EEEE dd MMMM y G",
      "long": "dd MMMM y G",
      "medium": "MMM dd, y G",
      "short": "dd/MM/yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE dd MMMM y",
      "long": "dd MMMM y",
      "medium": "MMM dd, y",
      "short": "dd/MM/yy"
    }
  },
  "gu": {
    "generic": {
      "full": "EEEE, d MMMM, G y",
      "long": "d MMMM, G y",
      "medium": "d MMM, G y",
      "short": "d-MM- GGGGG y"
    },
    "gregorian": {
      "full": "EEEE, d MMMM, y",
      "long": "d MMMM, y",
      "medium": "d MMM, y",
      "short": "d/M/yy"
    }
  },
  "ha": {
    "generic": {
      "full": "EEEE, d MMMM, y G",
      "long": "d MMMM, y G",
      "medium": "d MMM, y G",
      "short": "d/M/yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM, y",
      "long": "d MMMM, y",
      "medium": "d MMM, y",
      "short": "d/M/yy"
    }
  },
  "haw": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "d/M/yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "d/M/yy"
    }
  },
  "he": {
    "generic": {
      "full": "EEEE, d בMMMM y G",
      "long": "d בMMMM y G",
      "medium": "d בMMM y G",
      "short": "d.M.y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d בMMMM y",
      "long": "d בMMMM y",
      "medium": "d בMMM y",
      "short": "d.M.y"
    }
  },
  "hi": {
    "generic": {
      "full": "G EEEE, d MMMM y",
      "long": "G d MMMM y",
      "medium": "G d MMM y",
      "short": "G d/M/y"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "dd/MM/y",
      "short": "d/M/yy"
    }
  },
  "hr_BA": {
    "gregorian": {
      "short": "d. M. yy."
    }
  },
  "hr": {
    "generic": {
      "full": "EEEE, d. MMMM y. G",
      "long": "d. MMMM y. G",
      "medium": "d. MMM y. G",
      "short": "dd. MM. y. GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d. MMMM y.",
      "long": "d. MMMM y.",
      "medium": "d. MMM y.",
      "short": "dd. MM. y."
    }
  },
  "hsb": {
    "generic": {
      "full": "EEEE, d. MMMM y G",
      "long": "d. MMMM y G",
      "medium": "d.M.y G",
      "short": "d.M.yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d. MMMM y",
      "long": "d. MMMM y",
      "medium": "d.M.y",
      "short": "d.M.yy"
    }
  },
  "hu": {
    "generic": {
      "full": "G y. MMMM d., EEEE",
      "long": "G y. MMMM d.",
      "medium": "G y. MMM d.",
      "short": "GGGGG y. M. d."
    },
    "gregorian": {
      "full": "y. MMMM d., EEEE",
      "long": "y. MMMM d.",
      "medium": "y. MMM d.",
      "short": "y. MM. dd."
    }
  },
  "hy": {
    "generic": {
      "full": "d MMMM, y թ. G, EEEE",
      "long": "dd MMMM, y թ. G",
      "medium": "dd MMM, y թ. G",
      "short": "dd.MM.y GGGGG"
    },
    "gregorian": {
      "full": "y թ. MMMM d, EEEE",
      "long": "dd MMMM, y թ.",
      "medium": "dd MMM, y թ.",
      "short": "dd.MM.yy"
    }
  },
  "ig": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "id": {
    "generic": {
      "full": "EEEE, dd MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE, dd MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/yy"
    }
  },
  "ii": {
    "gregorian": {
      "full": "y MMMM d, EEEE",
      "long": "y MMMM d",
      "medium": "y MMM d",
      "short": "y-MM-dd"
    }
  },
  "it_CH": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd.MM.yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "medium": "d MMM y",
      "short": "dd.MM.yy"
    }
  },
  "is": {
    "generic": {
      "full": "EEEE, d. MMMM y G",
      "long": "d. MMMM y G",
      "medium": "d.M.y G",
      "short": "d.M.y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d. MMMM y",
      "long": "d. MMMM y",
      "medium": "d. MMM y",
      "short": "d.M.y"
    }
  },
  "it": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "dd MMMM y G",
      "medium": "dd MMM y G",
      "short": "dd/MM/yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "dd MMM y",
      "short": "dd/MM/yy"
    }
  },
  "ja": {
    "generic": {
      "full": "Gy年M月d日(EEEE)",
      "long": "Gy年M月d日",
      "medium": "Gy/MM/dd",
      "short": "Gy/M/d"
    },
    "gregorian": {
      "full": "y年M月d日EEEE",
      "long": "y年M月d日",
      "medium": "y/MM/dd",
      "short": "y/MM/dd"
    }
  },
  "jgo": {
    "generic": {
      "full": "EEEE, G y MMMM dd",
      "long": "G y MMMM d",
      "medium": "G y MMM d",
      "short": "GGGGG y-MM-dd"
    },
    "gregorian": {
      "full": "EEEE, y MMMM dd",
      "long": "y MMMM d",
      "medium": "y MMM d",
      "short": "y-MM-dd"
    }
  },
  "jmc": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "kab": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM, y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM, y",
      "short": "d/M/y"
    }
  },
  "kam": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "ka": {
    "generic": {
      "full": "EEEE, dd MMMM, y G",
      "long": "d MMMM, y G",
      "medium": "d MMM, y G",
      "short": "dd.MM.y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, dd MMMM, y",
      "long": "d MMMM, y",
      "medium": "d MMM. y",
      "short": "dd.MM.yy"
    }
  },
  "kde": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "kea": {
    "generic": {
      "full": "EEEE, d 'di' MMMM 'di' y G",
      "long": "d 'di' MMMM 'di' y G",
      "medium": "d MMM y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d 'di' MMMM 'di' y",
      "long": "d 'di' MMMM 'di' y",
      "medium": "d MMM y",
      "short": "d/M/y"
    }
  },
  "khq": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM, y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM, y",
      "short": "d/M/y"
    }
  },
  "ki": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "kkj": {
    "generic": {
      "full": "EEEE dd MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM y GGGGG"
    },
    "gregorian": {
      "full": "EEEE dd MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM y"
    }
  },
  "kk": {
    "generic": {
      "full": "G y 'ж'. d MMMM, EEEE",
      "long": "G y 'ж'. d MMMM",
      "medium": "G dd.MM.y",
      "short": "GGGGG dd.MM.y"
    },
    "gregorian": {
      "full": "y 'ж'. d MMMM, EEEE",
      "long": "y 'ж'. d MMMM",
      "medium": "y 'ж'. dd MMM",
      "short": "dd.MM.yy"
    }
  },
  "kln": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "kl": {
    "generic": {
      "full": "EEEE dd MMMM y G",
      "long": "dd MMMM y G",
      "medium": "MMM dd, y G",
      "short": "GGGGG y-MM-dd"
    },
    "gregorian": {
      "full": "EEEE dd MMMM y",
      "long": "dd MMMM y",
      "medium": "MMM dd, y",
      "short": "y-MM-dd"
    }
  },
  "km": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "d/M/yy"
    }
  },
  "kn": {
    "generic": {
      "full": "G y MMMM d, EEEE",
      "long": "G y MMMM d",
      "medium": "G y MMM d",
      "short": "GGGGG y-MM-dd"
    },
    "gregorian": {
      "full": "EEEE, MMMM d, y",
      "long": "MMMM d, y",
      "medium": "MMM d, y",
      "short": "d/M/yy"
    }
  },
  "kok": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "dd-MM-y G",
      "short": "d-M-y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "dd-MM-y",
      "short": "d-M-yy"
    }
  },
  "ko": {
    "generic": {
      "full": "G y년 M월 d일 EEEE",
      "long": "G y년 M월 d일",
      "medium": "G y. M. d.",
      "short": "G y. M. d."
    },
    "gregorian": {
      "full": "y년 M월 d일 EEEE",
      "long": "y년 M월 d일",
      "medium": "y. M. d.",
      "short": "yy. M. d."
    }
  },
  "ksb": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "ks": {
    "generic": {
      "full": "EEEE, MMMM d, Gy",
      "long": "MMMM d, Gy",
      "medium": "MMM d, Gy",
      "short": "M/d/Gy"
    },
    "gregorian": {
      "full": "EEEE, MMMM d, y",
      "long": "MMMM d, y",
      "medium": "MMM d, y",
      "short": "M/d/yy"
    }
  },
  "ksf": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "d/M/y"
    }
  },
  "kw": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "ksh": {
    "generic": {
      "full": "EEEE, 'dä' d. MMMM y G",
      "long": "d. MMMM y G",
      "medium": "d. MMM. y G",
      "short": "d. M. y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, 'dä' d. MMMM y",
      "long": "d. MMMM y",
      "medium": "d. MMM. y",
      "short": "d. M. y"
    }
  },
  "lag": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "ky": {
    "generic": {
      "full": "EEEE, G d-MMMM y-'ж'.",
      "long": "d-MMMM G y-'ж'.",
      "medium": "dd.MM.y G",
      "short": "dd.MM.y GGGGG"
    },
    "gregorian": {
      "full": "y-'ж'., d-MMMM, EEEE",
      "long": "y-'ж'., d-MMMM",
      "medium": "y-'ж'., d-MMM",
      "short": "d/M/yy"
    }
  },
  "lg": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "lkt": {
    "generic": {
      "full": "EEEE, MMMM d, y G",
      "long": "MMMM d, y G",
      "medium": "MMM d, y G",
      "short": "M/d/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, MMMM d, y",
      "long": "MMMM d, y",
      "medium": "MMM d, y",
      "short": "M/d/yy"
    }
  },
  "lb": {
    "generic": {
      "full": "EEEE, d. MMMM y G",
      "long": "d. MMMM y G",
      "medium": "dd.MM.y G",
      "short": "dd.MM.yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d. MMMM y",
      "long": "d. MMMM y",
      "medium": "d. MMM y",
      "short": "dd.MM.yy"
    }
  },
  "ln": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "d/M/y"
    }
  },
  "lrc": {
    "generic": {
      "full": "G y MMMM d, EEEE",
      "long": "G y MMMM d",
      "medium": "G y MMM d",
      "short": "GGGGG y-MM-dd"
    },
    "gregorian": {
      "full": "y MMMM d, EEEE",
      "long": "y MMMM d",
      "medium": "y MMM d",
      "short": "y-MM-dd"
    }
  },
  "lo": {
    "generic": {
      "full": "EEEEທີ d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE ທີ d MMMM G y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "d/M/y"
    }
  },
  "lu": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "d/M/y"
    }
  },
  "luo": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "luy": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "lt": {
    "generic": {
      "full": "y MMMM d G, EEEE",
      "long": "y MMMM d G",
      "medium": "y MMM d G",
      "short": "y-MM-dd G"
    },
    "gregorian": {
      "full": "y 'm'. MMMM d 'd'., EEEE",
      "long": "y 'm'. MMMM d 'd'.",
      "medium": "y-MM-dd",
      "short": "y-MM-dd"
    }
  },
  "mas": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "mfe": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM, y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM, y",
      "short": "d/M/y"
    }
  },
  "lv": {
    "generic": {
      "full": "EEEE, y. 'gada' d. MMMM G",
      "long": "y. 'gada' d. MMMM G",
      "medium": "y. 'gada' d. MMM G",
      "short": "dd.MM.y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, y. 'gada' d. MMMM",
      "long": "y. 'gada' d. MMMM",
      "medium": "y. 'gada' d. MMM",
      "short": "dd.MM.yy"
    }
  },
  "mer": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "mgh": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "mg": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM, y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "y MMM d",
      "short": "y-MM-dd"
    }
  },
  "mgo": {
    "generic": {
      "full": "EEEE, G y MMMM dd",
      "long": "G y MMMM d",
      "medium": "G y MMM d",
      "short": "GGGGG y-MM-dd"
    },
    "gregorian": {
      "full": "EEEE, y MMMM dd",
      "long": "y MMMM d",
      "medium": "y MMM d",
      "short": "y-MM-dd"
    }
  },
  "mk": {
    "generic": {
      "full": "EEEE, dd MMMM y 'г'. G",
      "long": "dd MMMM y 'г'. G",
      "medium": "dd.M.y G",
      "short": "dd.M.y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, dd MMMM y",
      "long": "dd MMMM y",
      "medium": "dd.M.y",
      "short": "dd.M.yy"
    }
  },
  "ml": {
    "generic": {
      "full": "G y, MMMM d, EEEE",
      "long": "G y, MMMM d",
      "medium": "G y, MMM d",
      "short": "GGGGG y-MM-dd"
    },
    "gregorian": {
      "full": "y, MMMM d, EEEE",
      "long": "y, MMMM d",
      "medium": "y, MMM d",
      "short": "d/M/yy"
    }
  },
  "mn": {
    "generic": {
      "full": "EEEE, y 'оны' MM 'сарын' dd",
      "long": "y 'оны' MM 'сарын' dd",
      "medium": "y MM d",
      "short": "y-MM-dd"
    },
    "gregorian": {
      "full": "EEEE, y 'оны' MM 'сарын' d",
      "long": "y'оны' MMMM'сарын' d'өдөр'",
      "medium": "y MMM d",
      "short": "y-MM-dd"
    }
  },
  "mr": {
    "generic": {
      "full": "EEEE, d MMMM, y G",
      "long": "d MMMM, y G",
      "medium": "d MMM, y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM, y",
      "long": "d MMMM, y",
      "medium": "d MMM, y",
      "short": "d/M/yy"
    }
  },
  "ms_BN": {
    "generic": {
      "full": "dd MMMM y G"
    },
    "gregorian": {
      "full": "dd MMMM y"
    }
  },
  "ms": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "dd/MM/y G",
      "short": "d/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "d/MM/yy"
    }
  },
  "mt": {
    "generic": {
      "full": "EEEE, d 'ta'’ MMMM y G",
      "long": "d 'ta'’ MMMM y G",
      "medium": "dd MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d 'ta'’ MMMM y",
      "long": "d 'ta'’ MMMM y",
      "medium": "dd MMM y",
      "short": "dd/MM/y"
    }
  },
  "mua": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "d/M/y"
    }
  },
  "my": {
    "generic": {
      "full": "EEEE G dd MMMM y",
      "long": "G dd MMMM y",
      "medium": "G d MMM y",
      "short": "GGGGG dd-MM-yy"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd-MM-yy"
    }
  },
  "naq": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "nd": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "nb": {
    "generic": {
      "full": "EEEE d. MMMM y G",
      "long": "d. MMMM y G",
      "medium": "d. MMM y G",
      "short": "d.M.y G"
    },
    "gregorian": {
      "full": "EEEE d. MMMM y",
      "long": "d. MMMM y",
      "medium": "d. MMM y",
      "short": "dd.MM.y"
    }
  },
  "nds": {
    "generic": {
      "full": "EEEE, 'de' d. MMMM y G",
      "long": "d. MMMM y G",
      "medium": "d. MMM y G",
      "short": "d.MM.yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE, 'de' d. MMMM y",
      "long": "d. MMMM y",
      "medium": "d. MMM y",
      "short": "d.MM.yy"
    }
  },
  "ne": {
    "generic": {
      "full": "G y MMMM d, EEEE",
      "long": "G y MMMM d",
      "medium": "G y MMM d",
      "short": "GGGGG y-MM-dd"
    },
    "gregorian": {
      "full": "y MMMM d, EEEE",
      "long": "y MMMM d",
      "medium": "y MMM d",
      "short": "y-MM-dd"
    }
  },
  "nl_BE": {
    "generic": {
      "short": "d/MM/yy GGGGG"
    },
    "gregorian": {
      "short": "d/MM/yy"
    }
  },
  "nl": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd-MM-yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd-MM-yy"
    }
  },
  "nmg": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "d/M/y"
    }
  },
  "nnh": {
    "generic": {
      "full": "EEEE , 'lyɛ'̌ʼ d 'na' MMMM, y G",
      "long": "'lyɛ'̌ʼ d 'na' MMMM, y G",
      "medium": "d MMM, y G",
      "short": "dd/MM/yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE , 'lyɛ'̌ʼ d 'na' MMMM, y",
      "long": "'lyɛ'̌ʼ d 'na' MMMM, y",
      "medium": "d MMM, y",
      "short": "dd/MM/yy"
    }
  },
  "nn": {
    "generic": {
      "full": "EEEE d. MMMM y G",
      "long": "d. MMMM y G",
      "medium": "d. MMM y G",
      "short": "d.M.y G"
    },
    "gregorian": {
      "full": "EEEE d. MMMM y",
      "long": "d. MMMM y",
      "medium": "d. MMM y",
      "short": "dd.MM.y"
    }
  },
  "nyn": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "nus": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "d/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "d/MM/y"
    }
  },
  "om": {
    "generic": {
      "full": "EEEE, MMMM d, y G",
      "long": "dd MMMM y G",
      "medium": "dd-MMM-y G",
      "short": "dd/MM/yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE, MMMM d, y",
      "long": "dd MMMM y",
      "medium": "dd-MMM-y",
      "short": "dd/MM/yy"
    }
  },
  "or": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "d-M-y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "d-M-yy"
    }
  },
  "os": {
    "generic": {
      "full": "EEEE, d MMMM, y 'аз' G",
      "long": "d MMMM, y 'аз' G",
      "medium": "dd MMM y 'аз' G",
      "short": "dd.MM.yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM, y 'аз'",
      "long": "d MMMM, y 'аз'",
      "medium": "dd MMM y 'аз'",
      "short": "dd.MM.yy"
    }
  },
  "pa": {
    "generic": {
      "full": "EEEE, dd MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "d/M/yy"
    }
  },
  "prg": {
    "generic": {
      "full": "EEEE, y 'mettas' d. MMMM G",
      "long": "y 'mettas' d. MMMM G",
      "medium": "dd.MM 'st'. y G",
      "short": "dd.MM.y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, y 'mettas' d. MMMM",
      "long": "y 'mettas' d. MMMM",
      "medium": "dd.MM 'st'. y",
      "short": "dd.MM.yy"
    }
  },
  "ps": {
    "generic": {
      "full": "EEEE د G y د MMMM d",
      "long": "د G y د MMMM d",
      "medium": "G y MMM d",
      "short": "GGGGG y/M/d"
    },
    "gregorian": {
      "full": "EEEE د y د MMMM d",
      "long": "د y د MMMM d",
      "medium": "y MMM d",
      "short": "y/M/d"
    }
  },
  "pl": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd.MM.y G"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd.MM.y"
    }
  },
  "pt": {
    "generic": {
      "full": "EEEE, d 'de' MMMM 'de' y G",
      "long": "d 'de' MMMM 'de' y G",
      "medium": "dd/MM/y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d 'de' MMMM 'de' y",
      "long": "d 'de' MMMM 'de' y",
      "medium": "d 'de' MMM 'de' y",
      "short": "dd/MM/y"
    }
  },
  "qu": {
    "gregorian": {
      "full": "EEEE, d MMMM, y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "pt_PT": {
    "generic": {
      "short": "d/M/y G"
    },
    "gregorian": {
      "medium": "dd/MM/y",
      "short": "dd/MM/yy"
    }
  },
  "rn": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "d/M/y"
    }
  },
  "rm": {
    "generic": {
      "full": "EEEE, 'ils' d 'da' MMMM y G",
      "long": "d 'da' MMMM y G",
      "medium": "dd-MM-y G",
      "short": "dd-MM-yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE, 'ils' d 'da' MMMM y",
      "long": "d 'da' MMMM y",
      "medium": "dd-MM-y",
      "short": "dd-MM-yy"
    }
  },
  "rof": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "ro": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "dd.MM.y G",
      "short": "dd.MM.y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd.MM.y"
    }
  },
  "root": {
    "generic": {
      "full": "G y MMMM d, EEEE",
      "long": "G y MMMM d",
      "medium": "G y MMM d",
      "short": "GGGGG y-MM-dd"
    },
    "gregorian": {
      "full": "y MMMM d, EEEE",
      "long": "y MMMM d",
      "medium": "y MMM d",
      "short": "y-MM-dd"
    }
  },
  "rw": {
    "generic": {
      "full": "EEEE, G y MMMM dd",
      "long": "G y MMMM d",
      "medium": "G y MMM d",
      "short": "GGGGG yy/MM/dd"
    },
    "gregorian": {
      "full": "y MMMM d, EEEE",
      "long": "y MMMM d",
      "medium": "y MMM d",
      "short": "y-MM-dd"
    }
  },
  "ru": {
    "generic": {
      "full": "EEEE, d MMMM y 'г'. G",
      "long": "d MMMM y 'г'. G",
      "medium": "d MMM y 'г'. G",
      "short": "dd.MM.y G"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y 'г'.",
      "long": "d MMMM y 'г'.",
      "medium": "d MMM y 'г'.",
      "short": "dd.MM.y"
    }
  },
  "rwk": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "sah": {
    "generic": {
      "full": "G y 'сыл' MMMM d 'күнэ', EEEE",
      "long": "G y, MMMM d",
      "medium": "G y, MMM d",
      "short": "GGGGG yy/M/d"
    },
    "gregorian": {
      "full": "y 'сыл' MMMM d 'күнэ', EEEE",
      "long": "y, MMMM d",
      "medium": "y, MMM d",
      "short": "yy/M/d"
    }
  },
  "saq": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "sbp": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "se": {
    "gregorian": {
      "full": "y MMMM d, EEEE",
      "long": "y MMMM d",
      "medium": "y MMM d",
      "short": "y-MM-dd"
    }
  },
  "seh": {
    "generic": {
      "full": "EEEE, d 'de' MMMM 'de' y G",
      "long": "d 'de' MMMM 'de' y G",
      "medium": "d 'de' MMM 'de' y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d 'de' MMMM 'de' y",
      "long": "d 'de' MMMM 'de' y",
      "medium": "d 'de' MMM 'de' y",
      "short": "d/M/y"
    }
  },
  "ses": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM, y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM, y",
      "short": "d/M/y"
    }
  },
  "sg": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM, y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM, y",
      "short": "d/M/y"
    }
  },
  "shi": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM, y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM, y",
      "short": "d/M/y"
    }
  },
  "si": {
    "generic": {
      "full": "G y MMMM d, EEEE",
      "long": "G y MMMM d",
      "medium": "G y MMM d",
      "short": "GGGGG y-MM-dd"
    },
    "gregorian": {
      "full": "y MMMM d, EEEE",
      "long": "y MMMM d",
      "medium": "y MMM d",
      "short": "y-MM-dd"
    }
  },
  "sk": {
    "generic": {
      "full": "EEEE, d. M. y G",
      "long": "d. M. y G",
      "medium": "d. M. y G",
      "short": "d.M.y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d. MMMM y",
      "long": "d. MMMM y",
      "medium": "d. M. y",
      "short": "d. M. y"
    }
  },
  "smn": {
    "generic": {
      "full": "cccc MMMM d. y G",
      "long": "MMMM d. y G",
      "medium": "d.M.y G",
      "short": "d.M.y GGGGG"
    },
    "gregorian": {
      "full": "cccc, MMMM d. y",
      "long": "MMMM d. y",
      "medium": "MMM d. y",
      "short": "d.M.y"
    }
  },
  "sl": {
    "generic": {
      "full": "EEEE, dd. MMMM y G",
      "long": "dd. MMMM y G",
      "medium": "d. MMM y G",
      "short": "d. MM. yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE, dd. MMMM y",
      "long": "dd. MMMM y",
      "medium": "d. MMM y",
      "short": "d. MM. yy"
    }
  },
  "sn": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "y MMMM d, EEEE",
      "long": "y MMMM d",
      "medium": "y MMM d",
      "short": "y-MM-dd"
    }
  },
  "so": {
    "generic": {
      "full": "EEEE, MMMM dd, y G",
      "long": "dd MMMM y G",
      "medium": "dd-MMM-y G",
      "short": "dd/MM/yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE, MMMM dd, y",
      "long": "dd MMMM y",
      "medium": "dd-MMM-y",
      "short": "dd/MM/yy"
    }
  },
  "sr": {
    "generic": {
      "full": "EEEE, d. MMMM y. G",
      "long": "d. MMMM y. G",
      "medium": "d.MM.y. G",
      "short": "d.M.y. GGGGG"
    },
    "gregorian": {
      "full": "EEEE, dd. MMMM y.",
      "long": "dd. MMMM y.",
      "medium": "dd.MM.y.",
      "short": "d.M.yy."
    }
  },
  "sv_FI": {
    "gregorian": {
      "short": "dd-MM-y"
    }
  },
  "sq": {
    "generic": {
      "full": "EEEE, d MMM y G",
      "long": "d MMM y G",
      "medium": "d MMM y G",
      "short": "d.M.y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "d.M.yy"
    }
  },
  "sw": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "teo": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "sv": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "G y-MM-dd"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "y-MM-dd"
    }
  },
  "ta": {
    "generic": {
      "full": "EEEE, d MMMM, y G",
      "long": "d MMMM, y G",
      "medium": "d MMM, y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM, y",
      "long": "d MMMM, y",
      "medium": "d MMM, y",
      "short": "d/M/yy"
    }
  },
  "ti": {
    "generic": {
      "full": "G y MMMM d, EEEE",
      "long": "dd MMMM y G",
      "medium": "dd-MMM-y G",
      "short": "dd/MM/yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE፣ dd MMMM መዓልቲ y G",
      "long": "dd MMMM y",
      "medium": "dd-MMM-y",
      "short": "dd/MM/yy"
    }
  },
  "ti_ER": {
    "generic": {
      "full": "EEEE፡ dd MMMM መዓልቲ y G"
    }
  },
  "tk": {
    "generic": {
      "full": "d MMMM y G EEEE",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd.MM.y GGGGG"
    },
    "gregorian": {
      "full": "d MMMM y EEEE",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd.MM.y"
    }
  },
  "te": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd-MM-y GGGGG"
    },
    "gregorian": {
      "full": "d, MMMM y, EEEE",
      "long": "d MMMM, y",
      "medium": "d MMM, y",
      "short": "dd-MM-yy"
    }
  },
  "twq": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "d/M/y"
    }
  },
  "tzm": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "th": {
    "generic": {
      "full": "EEEEที่ d MMMM G y",
      "long": "d MMMM G y",
      "medium": "d MMM G y",
      "short": "d/M/y G"
    },
    "gregorian": {
      "full": "EEEEที่ d MMMM G y",
      "long": "d MMMM G y",
      "medium": "d MMM y",
      "short": "d/M/yy"
    }
  },
  "to": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "d/M/yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "d/M/yy"
    }
  },
  "ug": {
    "generic": {
      "full": "EEEE، MMMM d، y G",
      "long": "MMMM d، y G",
      "medium": "MMM d، y G",
      "short": "M/d/y GGGGG"
    },
    "gregorian": {
      "full": "y d-MMMM، EEEE",
      "long": "d-MMMM، y",
      "medium": "d-MMM، y",
      "short": "y-MM-dd"
    }
  },
  "tr": {
    "generic": {
      "full": "G d MMMM y EEEE",
      "long": "G d MMMM y",
      "medium": "G d MMM y",
      "short": "GGGGG d.MM.y"
    },
    "gregorian": {
      "full": "d MMMM y EEEE",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "d.MM.y"
    }
  },
  "uz": {
    "generic": {
      "full": "EEEE, d-MMMM, y (G)",
      "long": "d-MMMM, y (G)",
      "medium": "d-MMM, y (G)",
      "short": "dd.MM.y (GGGGG)"
    },
    "gregorian": {
      "full": "EEEE, d-MMMM, y",
      "long": "d-MMMM, y",
      "medium": "d-MMM, y",
      "short": "dd/MM/yy"
    }
  },
  "ur": {
    "generic": {
      "full": "EEEE، d MMMM، y G",
      "long": "d MMMM، y G",
      "medium": "d MMM، y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE، d MMMM، y",
      "long": "d MMMM، y",
      "medium": "y MMM d",
      "short": "d/M/yy"
    }
  },
  "vai": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y G"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "vo": {
    "generic": {
      "full": "G y MMMM'a' 'd'. d'id'",
      "long": "G y MMMM d",
      "medium": "G y MMM. d",
      "short": "GGGGG y-MM-dd"
    },
    "gregorian": {
      "full": "y MMMM'a' 'd'. d'id'",
      "long": "y MMMM d",
      "medium": "y MMM. d",
      "short": "y-MM-dd"
    }
  },
  "uk": {
    "generic": {
      "full": "EEEE, d MMMM y 'р'. G",
      "long": "d MMMM y 'р'. G",
      "medium": "d MMM y G",
      "short": "dd.MM.yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y 'р'.",
      "long": "d MMMM y 'р'.",
      "medium": "d MMM y 'р'.",
      "short": "dd.MM.yy"
    }
  },
  "vun": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "xog": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "wae": {
    "generic": {
      "full": "EEEE, d. MMMM y G",
      "long": "d. MMMM y G",
      "medium": "d. MMM y G"
    },
    "gregorian": {
      "full": "EEEE, d. MMMM y",
      "long": "d. MMMM y",
      "medium": "d. MMM y"
    }
  },
  "yav": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "d/M/y"
    }
  },
  "yo": {
    "generic": {
      "full": "EEEE, d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM y",
      "short": "dd/MM/y"
    }
  },
  "yi": {
    "generic": {
      "full": "EEEE, d בMMMM y G",
      "long": "d בMMMM y G",
      "medium": "d בMMM y G",
      "short": "dd/MM/yy GGGGG"
    },
    "gregorian": {
      "full": "EEEE, dטן MMMM y",
      "long": "dטן MMMM y",
      "medium": "dטן MMM y",
      "short": "dd/MM/yy"
    }
  },
  "vi": {
    "generic": {
      "full": "EEEE, 'ngày' dd 'tháng' MM 'năm' y G",
      "long": "'Ngày' dd 'tháng' M 'năm' y G",
      "medium": "dd-MM-y G",
      "short": "dd/MM/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE, d MMMM, y",
      "long": "d MMMM, y",
      "medium": "d MMM, y",
      "short": "dd/MM/y"
    }
  },
  "zh_HK": {
    "generic": {
      "full": "Gy年M月d日EEEE",
      "long": "Gy年M月d日",
      "medium": "Gy年M月d日",
      "short": "Gy/M/d"
    },
    "gregorian": {
      "full": "y年M月d日EEEE",
      "short": "d/M/y"
    }
  },
  "zgh": {
    "generic": {
      "full": "EEEE d MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM, y G",
      "short": "d/M/y GGGGG"
    },
    "gregorian": {
      "full": "EEEE d MMMM y",
      "long": "d MMMM y",
      "medium": "d MMM, y",
      "short": "d/M/y"
    }
  },
  "zh_MO": {
    "generic": {
      "short": "d/M/yyGGGGG"
    },
    "gregorian": {
      "short": "d/M/yy"
    }
  },
  "zh_SG": {
    "generic": {
      "short": "dd/MM/yyGGGGG"
    },
    "gregorian": {
      "short": "dd/MM/yy"
    }
  },
  "yue": {
    "generic": {
      "full": "G y年M月d日 EEEE",
      "long": "G y年M月d日",
      "medium": "G y年M月d日",
      "short": "G y/M/d"
    },
    "gregorian": {
      "full": "y年M月d日 EEEE",
      "long": "y年M月d日",
      "medium": "y年M月d日",
      "short": "y/M/d"
    }
  },
  "zh": {
    "generic": {
      "full": "Gy年MM月d日EEEE",
      "long": "Gy年MM月d日",
      "medium": "Gy年MM月d日",
      "short": "Gy/M/d"
    },
    "gregorian": {
      "full": "y年M月d日EEEE",
      "long": "y年M月d日",
      "medium": "y年M月d日",
      "short": "y/M/d"
    }
  },
  "zu": {
    "generic": {
      "full": "EEEE dd MMMM y G",
      "long": "d MMMM y G",
      "medium": "d MMM y G",
      "short": "GGGGG y-MM-dd"
    },
    "gregorian": {
      "full": "EEEE, MMMM d, y",
      "long": "MMMM d, y",
      "medium": "MMM d, y",
      "short": "M/d/yy"
    }
  }
};

},{}],8:[function(require,module,exports){
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

var Chain = function () {
  function Chain(dom, element) {
    _classCallCheck(this, Chain);

    this._dom = dom;

    this._element = element;
  }

  _createClass(Chain, [{
    key: 'appendChild',
    value: function appendChild(child) {
      this._element.appendChild(child);
      return this;
    }
  }, {
    key: 'removeChild',
    value: function removeChild(child) {
      this._element.removeChild(child);
      return this;
    }
  }, {
    key: 'element',
    get: function get() {
      return this._element;
    }
  }]);

  return Chain;
}();

module.exports = Chain;

},{}],9:[function(require,module,exports){
'use strict';

function appendChild(parent, child) {
  if (child instanceof Array) {
    child.forEach(function (item) {
      return appendChild(parent, item);
    });
  } else if (child instanceof Node) {
    parent.appendChild(child);
  } else if (isFunction(child)) {
    appendChild(parent, child());
  } else if (child instanceof Promise) {
    var placeholder = document.createTextNode('');
    parent.appendChild(placeholder);
    child.then(function (msg) {
      return replaceChild(parent, placeholder, msg);
    });
  } else {
    parent.appendChild(document.createTextNode(child));
  }
}

function replaceChild(parent, what, child) {
  if (child instanceof Node) {
    parent.replaceChild(child, what);
  } else {
    var text = document.createTextNode(child);
    parent.replaceChild(text, what);
  }
}

function isFunction(obj) {
  return Object.prototype.toString.call(obj) === '[object Function]';
}

module.exports = {
  appendChild: appendChild,
  replaceChild: replaceChild
};

},{}],10:[function(require,module,exports){
'use strict';

module.exports = function appendText(element, text) {
  var newTextNode = document.createTextNode(text);
  element.appendChild(newTextNode);
};

},{}],11:[function(require,module,exports){
'use strict';

module.exports = function clearValue(element) {
  var form = document.createElement('form');
  var container = element.parentNode;
  container.replaceChild(form, element);
  form.appendChild(element);
  form.reset();
  container.replaceChild(element, form);
};

},{}],12:[function(require,module,exports){
'use strict';

var skipTags = ['script', 'meta', 'template'];

function correctZIndex(element, deep) {
  deep = deep || false;
  Array.from(element.children).forEach(function (child) {
    if (skipTags.indexOf(child.tagName) !== -1 || child.id === 'sqseobar2' || child.className.indexOf('sqmore-') !== -1 || child.className.indexOf('seoquake-') !== -1 || child.getAttribute('sq-z-fixed') === '1') {
      return;
    }

    var style = document.defaultView.getComputedStyle(child, null);
    if (style.zIndex !== 'auto') {
      try {
        var zIndex = parseInt(style.zIndex);
        if (zIndex - 100 > 0) {
          zIndex -= 100;
          child.style.zIndex = zIndex.toString();
          child.setAttribute('sq-z-fixed', '1');
        }
      } catch (ignore) {}
    }

    if (deep) {
      correctZIndex(child, deep);
    }
  });
}

module.exports = correctZIndex;

},{}],13:[function(require,module,exports){
'use strict';

var css = require('dom-element-css');

var _require = require('./_createElement'),
    appendChild = _require.appendChild,
    replaceChild = _require.replaceChild;

function isString(obj) {
  return typeof obj === 'string' || obj instanceof String;
}

function isFunction(obj) {
  return Object.prototype.toString.call(obj) === '[object Function]';
}

function createElement(tagName, attrs, content) {
  if (!tagName) {
    return null;
  }

  if (attrs === undefined) {
    attrs = {};
  }

  var element = document.createElement(tagName.toLowerCase());

  if (isString(attrs) || isFunction(attrs)) {
    content = attrs;
  } else {
    for (var attrName in attrs) {
      if (attrs.hasOwnProperty(attrName)) {
        if (attrName === 'className') {
          element.className = attrs[attrName];
        } else if (attrName === 'forId') {
          element.setAttribute('for', attrs[attrName]);
        } else if (attrName === 'style' && !isString(attrs[attrName])) {
          css(element, attrs[attrName]);
        } else {
          element.setAttribute(attrName, attrs[attrName]);
        }
      }
    }
  }

  if (content) {
    appendChild(element, content);
  }

  return element;
}

module.exports = createElement;

},{"./_createElement":9,"dom-element-css":71}],14:[function(require,module,exports){
'use strict';

module.exports = function emptyElement(anElem) {
  while (anElem.firstChild) {
    anElem.removeChild(anElem.firstChild);
  }

  return anElem;
};

},{}],15:[function(require,module,exports){
'use strict';

exports.parseTextNodes = function parseTextNodes(element) {
  var content = [];
  Array.from(element.childNodes).forEach(function (child) {
    var value = '';
    if (child.nodeType === Node.TEXT_NODE) {
      value = child.nodeValue;
    } else if (child.hasChildNodes()) {
      value = parseTextNodes(child);
    }

    if (value !== '') {
      content.push(value.trim());
    }
  });

  return content.join(' ');
};

},{}],16:[function(require,module,exports){
'use strict';

module.exports = function (elem, dontFixScroll) {
  if (!elem || !elem.ownerDocument) {
    return null;
  }

  dontFixScroll = dontFixScroll || false;

  var offsetParent = elem.offsetParent;
  var doc = elem.ownerDocument;
  var docElem = doc.documentElement;
  var body = doc.body;
  var defaultView = doc.defaultView;
  var prevComputedStyle = defaultView.getComputedStyle(elem, null);
  var top = elem.offsetTop;
  var left = elem.offsetLeft;

  while ((elem = elem.parentNode) && elem !== body && elem !== docElem) {
    if (prevComputedStyle.position === 'fixed') {
      break;
    }

    var computedStyle = defaultView.getComputedStyle(elem, null);
    top -= elem.scrollTop;
    left -= elem.scrollLeft;

    if (elem === offsetParent) {
      top += elem.offsetTop;
      left += elem.offsetLeft;

      top += parseFloat(computedStyle.borderTopWidth) || 0;
      left += parseFloat(computedStyle.borderLeftWidth) || 0;

      offsetParent = elem.offsetParent;
    }

    prevComputedStyle = computedStyle;
  }

  if (prevComputedStyle.position === 'relative' || prevComputedStyle.position === 'static') {
    top += body.offsetTop;
    left += body.offsetLeft;
  }

  if (prevComputedStyle.position === 'fixed' && !dontFixScroll) {
    top += Math.max(docElem.scrollTop, body.scrollTop);
    left += Math.max(docElem.scrollLeft, body.scrollLeft);
  }

  return { top: top, left: left };
};

},{}],17:[function(require,module,exports){
'use strict';

var toCamelCase = require('to-camel-case');

exports.hasAttribute = function hasAttribute(element, name) {
  name = toCamelCase(name === 'for' ? 'htmlFor' : name);
  return element.hasAttribute(name);
};

},{"to-camel-case":82}],18:[function(require,module,exports){
'use strict';

function hasClass(element, name) {
  return typeof element !== 'undefined' && typeof element.classList !== 'undefined' && element.classList.contains(name);
}

module.exports = hasClass;

},{}],19:[function(require,module,exports){
'use strict';

var bodyReadyPromise = null;
var bodyReadyRepeats = 0;
var MAX_BODY_WAITING = 10;

function processIsBodyReady(resolve, reject) {
  if (typeof document === 'undefined') {
    reject('NO_DOCUMENT');
    return;
  }

  if (window !== window.top) {
    reject('NOT_TOP');
    return;
  }

  if (!document.body || document.body === null || document.body === undefined) {
    bodyReadyRepeats++;
    if (bodyReadyRepeats < MAX_BODY_WAITING) {
      setTimeout(processIsBodyReady.bind(null, resolve, reject), 100);
    } else {
      reject('NO_BODY');
    }
  } else {
    resolve();
  }
}

function isBodyReady() {
  if (bodyReadyPromise === null) {
    bodyReadyPromise = new Promise(processIsBodyReady);
  }

  return bodyReadyPromise;
}

isBodyReady.reset = function () {
  bodyReadyPromise = null;
  bodyReadyRepeats = 0;
};

module.exports = isBodyReady;

},{}],20:[function(require,module,exports){
'use strict';

var isEmpty = require('../lib/isEmpty');

module.exports = function isChild(parent, child) {
  if (isEmpty(parent) || isEmpty(child)) {
    return false;
  }

  if (parent === child) {
    return true;
  }

  return Array.from(parent.childNodes).some(function (element) {
    return isChild(element, child);
  });
};

},{"../lib/isEmpty":54}],21:[function(require,module,exports){
'use strict';

var ignore = require('../lib/ignore');
var Chain = require('./Chain');
var domElement = require('dom-element');
var createElement = require('./createElement');
var parseMarkdown = require('./parseMarkdown');

createElement.attr = domElement.attr;
createElement.hasAttr = require('./hasAttribute').hasAttribute;
createElement.attrNS = domElement.attrNS;
createElement.prop = domElement.prop;
createElement.css = domElement.css;
createElement.type = domElement.type;
createElement.data = domElement.data;
createElement.value = domElement.value;
createElement.hasClass = require('./hasClass');
createElement.addClass = domElement.addClass;
createElement.removeClass = domElement.removeClass;
createElement.toggleClass = domElement.toggleClass;
createElement.createElement = createElement;
createElement.removeElement = require('./removeElement');
createElement.getOffset = require('./getOffset');
createElement.emptyElement = require('./emptyElement');
createElement.getText = require('./getElementText').parseTextNodes;
createElement.qualifyURL = require('./qualifyURL');
createElement.isChild = require('./isChild');
createElement.px = require('./pixelValue');
createElement.isBodyReady = require('./isBodyReady');
createElement.clearValue = require('./clearValue');
createElement.correctZIndex = require('./correctZIndex');

createElement.text = function (element, text) {
  if (arguments.length === 1) {
    return domElement.text(element);
  }

  if (Object.prototype.toString.call(text) === '[object Function]') {
    var result = text();
    if (result instanceof Promise) {
      text = result;
    } else {
      return domElement.text(element, result);
    }
  }

  if (text instanceof Promise) {
    text.then(function (msg) {
      return domElement.text(element, msg);
    }).catch(ignore);
  } else {
    return domElement.text(element, text);
  }
};

createElement.setText = require('./setText');
createElement.appendText = require('./appendText');
createElement.setContent = require('./setContent');

createElement.insertAfter = function (element, after) {
  if (after.nextElementSibling) {
    after.parentNode.insertBefore(element, after.nextElementSibling);
  } else {
    after.parentNode.appendChild(element);
  }
};

createElement.insertFirst = function (element, container) {
  if (container.firstElementChild) {
    container.insertBefore(element, container.firstElementChild);
  } else {
    container.appendChild(element);
  }
};

createElement.chain = function (element) {
  return new Chain(createElement, element);
};

createElement.find = function (selector) {
  return document.querySelector(selector);
};

createElement.findAll = function (selector) {
  return Array.from(document.querySelectorAll(selector));
};

createElement.parse = function (text, userConfig) {
  return parseMarkdown(createElement, text, userConfig);
};

module.exports = createElement;

},{"../lib/ignore":51,"./Chain":8,"./appendText":10,"./clearValue":11,"./correctZIndex":12,"./createElement":13,"./emptyElement":14,"./getElementText":15,"./getOffset":16,"./hasAttribute":17,"./hasClass":18,"./isBodyReady":19,"./isChild":20,"./parseMarkdown":22,"./pixelValue":23,"./qualifyURL":24,"./removeElement":25,"./setContent":26,"./setText":27,"dom-element":74}],22:[function(require,module,exports){
'use strict';

var extend = require('extend');

function parseMarkdown(dom, text, userConfig) {
  var config = userConfig !== undefined ? extend(true, {}, parseMarkdown.DEFAULT_CONFIG, userConfig) : parseMarkdown.DEFAULT_CONFIG;

  var container = document.createDocumentFragment();

  function processLinks(element, text) {
    var re = /\[(.+?)\]\((.+?)\)/;
    var elements = text.split(re);

    if (elements.length === 1) {
      dom.appendText(element, text);
      return element;
    }

    var isNextLink = false;
    var i = 0;
    while (i < elements.length) {
      var block = elements[i];

      if (isNextLink) {
        i++;
        element.appendChild(dom('a', { href: block, target: '_blank' }, elements[i]));
        isNextLink = false;
      } else {
        if (block !== '') {
          dom.appendText(element, block);
        }

        isNextLink = true;
      }

      i++;
    }

    return element;
  }

  function processBold(element, text) {
    var elements = text.split('*');

    if (elements.length === 1) {
      processLinks(element, text);
      return element;
    }

    var isNextBold = false;

    for (var i = 0; i < elements.length; i++) {
      var block = elements[i];

      if (isNextBold) {
        element.appendChild(processLinks(dom('b'), block));
        isNextBold = false;
      } else {
        if (block !== '') {
          processLinks(element, block);
        }

        isNextBold = true;
      }
    }

    return element;
  }

  function processLinebreak(element, text) {
    var lines = text.split('\n');
    lines.forEach(function (line, index) {
      processBold(element, line);
      if (index + 1 < lines.length) {
        element.appendChild(dom('br'));
      }
    });

    return element;
  }

  function processParagraphs(element, text) {
    var paragraphs = text.split('\n\n');
    paragraphs.forEach(function (content) {
      var headers = content.split('===');

      if (headers.length > 1) {
        element.appendChild(dom('h2', {}, headers[0]));
        if (headers[1] !== '') {
          element.appendChild(processLinebreak(dom('p'), headers[1]));
        }
      } else {
        element.appendChild(processLinebreak(dom('p'), content));
      }
    });
    return element;
  }

  if (config.lineBreak === 'p') {
    return processParagraphs(container, text);
  } else if (config.lineBreak === 'br') {
    return processLinebreak(container, text);
  } else {
    container.appendChild(document.createTextNode(text));
    return container;
  }
}

parseMarkdown.DEFAULT_CONFIG = {
  lineBreak: 'p'
};

module.exports = parseMarkdown;

},{"extend":76}],23:[function(require,module,exports){
'use strict';

module.exports = function pixelValue(value) {
  var result = 0;
  try {
    result = parseInt(value);

    if (isNaN(result)) {
      result = 0;
    }
  } catch (ignore) {
    result = 0;
  }

  return result;
};

},{}],24:[function(require,module,exports){
'use strict';

module.exports = function qualifyURL(url, returnNode) {
  var a = document.createElement('a');
  a.href = url;
  if (returnNode === true) {
    return a.cloneNode(false);
  } else {
    return a.cloneNode(false).href;
  }
};

},{}],25:[function(require,module,exports){
'use strict';

var isEmpty = require('../lib/isEmpty');

module.exports = function removeElement(element) {
  if (!(element instanceof Node)) {
    return;
  }

  if (isEmpty(element.parentNode)) {
    return;
  }

  element.parentNode.removeChild(element);
};

},{"../lib/isEmpty":54}],26:[function(require,module,exports){
'use strict';

var emptyElement = require('./emptyElement');

var _require = require('./_createElement'),
    appendChild = _require.appendChild,
    replaceChild = _require.replaceChild;

function setContent(element, content) {
  emptyElement(element);
  appendChild(element, content);
}

module.exports = setContent;

},{"./_createElement":9,"./emptyElement":14}],27:[function(require,module,exports){
'use strict';

module.exports = function setText(element, text) {
  if (text instanceof Promise) {
    text.then(function (msg) {
      return setText(element, msg);
    }).catch(function (reason) {
      return setText(element, reason);
    });
    return;
  }

  var textNode = null;
  var newTextNode = document.createTextNode(text);

  Array.from(element.childNodes).some(function (node) {
    return node.nodeType === Node.TEXT_NODE ? textNode = node : false;
  });

  if (textNode === null) {
    element.appendChild(newTextNode);
  } else {
    element.replaceChild(newTextNode, textNode);
  }
};

},{}],28:[function(require,module,exports){
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

var eventsMixin = require('../utils/eventsMixin');
var extend = require('extend');

var Draggable = function () {
  function Draggable(element, config) {
    _classCallCheck(this, Draggable);

    this._config = extend(true, {}, Draggable.DEFAULT_CONFIG, config);
    this._element = element;
    this._state = Draggable.STATE_NONE;
    this._lastCoord = {
      left: 0,
      top: 0
    };

    this._processMouseDown = this._handleMouseDown.bind(this);
    this._processMouseUp = this._handleMouseUp.bind(this);
    this._processMouseMove = this._handleMouseMove.bind(this);

    this._element.addEventListener('mousedown', this._processMouseDown);
    this._element.addEventListener('mouseup', this._processMouseUp);
  }

  _createClass(Draggable, [{
    key: '_handleMouseDown',
    value: function _handleMouseDown(event) {
      if (this._state !== Draggable.STATE_NONE) {
        return;
      }

      this._state = Draggable.STATE_DOWN;

      var body = this._element.ownerDocument.body;
      body.addEventListener('mousemove', this._processMouseMove);
      body.addEventListener('mouseup', this._processMouseUp);

      this._lastCoord.left = event.screenX;
      this._lastCoord.top = event.screenY;

      this.dispatchEvent('down');
    }
  }, {
    key: '_handleMouseUp',
    value: function _handleMouseUp(event) {
      if (this._state === Draggable.STATE_NONE) {
        return;
      }

      this._state = Draggable.STATE_NONE;

      var body = this._element.ownerDocument.body;
      body.removeEventListener('mousemove', this._processMouseMove);
      body.removeEventListener('mouseup', this._processMouseUp);

      this._lastCoord.left = event.screenX;
      this._lastCoord.top = event.screenY;

      this.dispatchEvent('up');
    }
  }, {
    key: '_handleMouseMove',
    value: function _handleMouseMove(event) {
      if (this._state === Draggable.STATE_NONE) {
        return;
      }

      this._state = Draggable.STATE_MOVE;

      var delta = {
        left: this._lastCoord.left - event.screenX,
        top: this._lastCoord.top - event.screenY
      };

      this._lastCoord.left = event.screenX;
      this._lastCoord.top = event.screenY;

      this.dispatchEvent('move', delta);
    }
  }, {
    key: 'remove',
    value: function remove() {
      this._element.removeEventListener('mousedown', this._processMouseDown);
      this._element.removeEventListener('mouseup', this._processMouseUp);

      if (this._state !== Draggable.STATE_NONE) {
        var body = this._element.ownerDocument.body;
        body.removeEventListener('mousemove', this._processMouseMove);
        body.removeEventListener('mouseup', this._processMouseUp);
      }

      this._state = Draggable.STATE_NONE;

      this.dispatchEvent('up');
    }
  }]);

  return Draggable;
}();

Draggable.DEFAULT_CONFIG = {
  button: 0,
  mouseUpBody: true
};

Draggable.STATE_NONE = 0;
Draggable.STATE_DOWN = 1;
Draggable.STATE_MOVE = 2;

eventsMixin(Draggable.prototype);

module.exports = Draggable;

},{"../utils/eventsMixin":66,"extend":76}],29:[function(require,module,exports){
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

var dom = require('../dom/main');
var extend = require('extend');

var Dropdown = function () {
  function Dropdown(container, config) {
    _classCallCheck(this, Dropdown);

    this._config = extend(true, {}, Dropdown.DEFAULT_CONFIG, config);

    if (!container) {
      throw new Error('container should be DOM Element');
    }

    this._container = container;
    this._visible = false;
    this._appended = false;
    this._items = new Map();
    this._body = null;

    this._containerClickListener = this.clickHandler.bind(this);
    this._bodyClickListener = this.bodyClickHandler.bind(this);
  }

  _createClass(Dropdown, [{
    key: 'init',
    value: function init() {
      this._container.addEventListener('click', this._containerClickListener);
      this._body = dom('div', { className: this.config.containerClass, style: 'display:none; position:absolute;' });
    }
  }, {
    key: 'clickHandler',
    value: function clickHandler(event) {
      if (event.button === Dropdown.MOUSE_BUTTONS[this.config.button]) {
        this.config.preventDefault && event.preventDefault();
        this.config.stopPropagation && event.stopPropagation();

        if (this.config.toggle) {
          if (this._visible) {
            this.hide();
          } else {
            this.show();
          }
        } else {
          if (!this._visible) {
            this.show();
          }
        }
      }
    }
  }, {
    key: 'bodyClickHandler',
    value: function bodyClickHandler(event) {
      if (!dom.isChild(this._container, event.target) && !dom.isChild(this._body, event.target)) {
        this.hide();
      }
    }
  }, {
    key: 'show',
    value: function show() {
      if (this._visible) {
        return;
      }

      if (!this._appended) {
        document.body.appendChild(this._body);
        this._appended = true;
      }

      dom.css(this._body, 'display', 'block');
      this.position();

      if (this.config.bodyClickHide) {
        document.body.addEventListener('click', this._bodyClickListener);
      }

      this._visible = true;
      this.dispatchEvent('show');
    }
  }, {
    key: 'position',
    value: function position() {
      var position = dom.getOffset(this._container, this.config.positionFixed);
      var width = this._body.offsetWidth;
      var maxWidth = document.body.clientWidth;
      var result = {
        left: 'auto',
        top: position.top + this._container.offsetHeight + this.config.positionCorrection.top + 'px'
      };

      if (position.left + width > maxWidth) {
        result.left = position.left + this.config.positionCorrection.left + this._container.offsetWidth - width + 'px';
      } else {
        result.left = position.left + this.config.positionCorrection.left + 'px';
      }

      if (dom.hasClass(this._body, 'seoquake-dropdown-container__up')) {
        result.top = position.top - this._body.offsetHeight - this.config.positionCorrection.top + 'px';
      }

      if (dom.hasClass(this._body, 'seoquake-dropdown-container__right')) {
        result.left = position.left - this._body.offsetWidth - this.config.positionCorrection.left + 'px';
      }

      dom.css(this._body, result);
    }
  }, {
    key: 'hide',
    value: function hide() {
      if (!this._visible) {
        return;
      }

      if (this.config.bodyClickHide) {
        document.body.removeEventListener('click', this._bodyClickListener);
      }

      dom.css(this._body, 'display', 'none');

      if (this._appended) {
        dom.removeElement(this._body);
        this._appended = false;
      }

      this._visible = false;
      this.dispatchEvent('hide');
    }
  }, {
    key: 'remove',
    value: function remove() {
      this.clearEvents();
      this.hide();
      this._container.removeEventListener('click', this._containerClickListener);
      dom.removeElement(this._body);
    }
  }, {
    key: 'config',
    get: function get() {
      return this._config;
    }
  }, {
    key: 'container',
    get: function get() {
      return this._container;
    }
  }, {
    key: 'body',
    get: function get() {
      return this._body;
    }
  }]);

  return Dropdown;
}();

Dropdown.DEFAULT_CONFIG = {
  button: 'left',
  preventDefault: true,
  stopPropagation: false,
  autoHide: true,
  bodyClickHide: true,
  toggle: false,
  containerClass: 'seoquake-dropdown-container',
  positionFixed: false,
  positionCorrection: {
    left: 0,
    top: 0,
    right: null,
    bottom: null
  }
};

Dropdown.MOUSE_BUTTONS = {
  left: 0,
  right: 2,
  middle: 1
};

require('../utils/eventsMixin')(Dropdown.prototype);

module.exports = Dropdown;

},{"../dom/main":21,"../utils/eventsMixin":66,"extend":76}],30:[function(require,module,exports){
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

var dom = require('../dom/main');
var extend = require('extend');

var HintBox = function () {
  function HintBox(element, config) {
    _classCallCheck(this, HintBox);

    this._owner = element;

    this._message = '';
    this._config = extend(true, {}, HintBox.DEFAULT_CONFIG, config);

    if (dom.hasAttr(this._owner, 'data-message')) {
      this._message = dom.attr(this._owner, 'data-message');
    } else if (this.config.message !== '') {
      this._message = this.config.message;
    }

    this.eventShowListener = this.eventShowHandler.bind(this);

    this.eventHideListener = this.eventHideHandler.bind(this);

    this._visible = false;

    this._element = null;

    this.event = this.config.event;
    this.deleteTimer = null;
  }

  _createClass(HintBox, [{
    key: '_removeCurrentListeners',
    value: function _removeCurrentListeners() {
      switch (this.config.event) {
        case 'click':
          this._owner.removeEventListener('click', this.eventShowListener);
          this._owner.removeEventListener('click', this.eventHideListener);
          break;
        case 'hover':
          this._owner.removeEventListener('mouseenter', this.eventShowListener);
          this._owner.removeEventListener('mouseleave', this.eventHideListener);
      }
    }
  }, {
    key: '_fillElementMessage',
    value: function _fillElementMessage() {
      if (this._message instanceof DocumentFragment) {
        var clone = this._message.cloneNode(true);
        dom.setContent(this._messageContainer, clone);
      } else {
        dom.setContent(this._messageContainer, this._message);
      }
    }
  }, {
    key: 'hide',
    value: function hide() {
      var _this = this;

      if (!this._visible || this._element === null || typeof this._element === 'undefined') {
        return;
      }

      dom.removeClass(this.element, 'seoquake-hintbox-visible');

      if (this.config.event === 'click') {
        this._owner.addEventListener('click', this.eventShowListener);
        this._owner.removeEventListener('click', this.eventHideListener);
        this._owner.ownerDocument.removeEventListener('click', this.eventHideListener);
      }

      this._visible = false;

      if (this.config.autoRemove) {
        this.deleteTimer = setTimeout(function () {
          return _this.removeHintElement();
        }, 100);
      }
    }
  }, {
    key: 'show',
    value: function show() {
      if (this._visible) {
        return;
      }

      this.reposition();

      if (this.config.event === 'click') {
        this._owner.removeEventListener('click', this.eventShowListener);
        this._owner.addEventListener('click', this.eventHideListener);
      }

      dom.css(this.element, 'visibility', 'visible');
      dom.addClass(this.element, 'seoquake-hintbox-visible');

      this._visible = true;
    }
  }, {
    key: 'reposition',
    value: function reposition() {
      var style = {
        position: 'absolute',
        visibility: 'hidden'
      };

      var _dom$getOffset = dom.getOffset(this._owner, this._config.positionFixed),
          top = _dom$getOffset.top,
          left = _dom$getOffset.left;

      var width = this._owner.offsetWidth;

      if (this._config.offset.left !== null) {
        left += this._config.offset.left;
      }

      if (this._config.offset.top !== null) {
        top += this._config.offset.top;
      }

      if (this.config.className.indexOf('seoquake-hintbox-bottom') !== -1) {
        top += this._owner.offsetHeight;
      }

      if (this.config.className.indexOf('seoquake-hintbox-side-') !== -1) {
        var leftSet = left;

        if (this.config.className.indexOf('seoquake-hintbox-side-right') !== -1) {
          leftSet += width + 5;
        }

        style.left = leftSet + 'px';
        style.top = top + 'px';

        dom.css(this.element, style);

        if (this.config.inline) {
          dom.css(this._messageContainer, {
            whiteSpace: 'nowrap',
            width: 'auto'
          });
        }

        if (this.config.className.indexOf('seoquake-hintbox-side-left') !== -1) {
          leftSet = left - this._messageContainer.offsetWidth;
          dom.css(this.element, 'left', leftSet + 'px');
        }

        if (leftSet + this._messageContainer.offsetWidth > document.body.clientWidth) {
          leftSet = left - this._messageContainer.offsetWidth;
          dom.css(this.element, 'left', leftSet + 'px');
          dom.addClass(this.element, 'seoquake-hintbox-side-left');
        }
      } else {
        var _leftSet = Math.min(left, left - (16 - width / 2));

        style.left = _leftSet + 'px';
        style.top = top + 'px';

        dom.css(this.element, style);

        if (this.config.inline) {
          dom.css(this._messageContainer, {
            whiteSpace: 'nowrap',
            width: 'auto'
          });
        }

        if (left + this._messageContainer.offsetWidth > document.body.clientWidth) {
          _leftSet = left - (this._messageContainer.offsetWidth - width) + 'px';
          dom.css(this.element, 'left', _leftSet);
          dom.addClass(this.element, 'seoquake-hintbox-right');
        }
      }
    }
  }, {
    key: 'eventShowHandler',
    value: function eventShowHandler(event) {
      event.stopPropagation();
      event.preventDefault();

      this.show();

      if (this.config.event === 'click') {
        var eventClone = new event.constructor(event.type, event);
        this._owner.ownerDocument.dispatchEvent(eventClone);
        this._owner.ownerDocument.addEventListener('click', this.eventHideListener, true);
      }
    }
  }, {
    key: 'eventHideHandler',
    value: function eventHideHandler(event) {
      event.stopPropagation();
      event.preventDefault();

      this.hide();
    }
  }, {
    key: 'removeHintElement',
    value: function removeHintElement() {
      this.deleteTimer = null;
      if (this._element === null) {
        return;
      }

      dom.removeElement(this._element);
      this._element = null;
    }
  }, {
    key: 'remove',
    value: function remove() {
      this.removeHintElement();
      this._removeCurrentListeners();
      this._owner = null;
    }
  }, {
    key: 'config',
    set: function set(value) {
      this._config = extend(true, {}, HintBox.DEFAULT_CONFIG, value);

      if (this._visible) {
        this.reposition();
      }
    },
    get: function get() {
      return extend(true, {}, this._config);
    }
  }, {
    key: 'deleteTimer',
    set: function set(value) {
      if (this._deleteTimer !== null) {
        clearTimeout(this._deleteTimer);
      }

      this._deleteTimer = value;
    },
    get: function get() {
      return this._deleteTimer;
    }
  }, {
    key: 'message',
    set: function set(value) {
      this._message = value;
      if (this._element !== null) {
        this._fillElementMessage();
      }
    },
    get: function get() {
      return this._message;
    }
  }, {
    key: 'event',
    set: function set(value) {
      this._removeCurrentListeners();

      switch (value) {
        case 'click':
          this._owner.addEventListener('click', this.eventShowListener);
          break;
        case 'hover':
          this._owner.addEventListener('mouseenter', this.eventShowListener);
          this._owner.addEventListener('mouseleave', this.eventHideListener);
      }
      this.config.event = value;
    }
  }, {
    key: 'element',
    get: function get() {
      this.deleteTimer = null;
      if (this._element === null) {
        this._element = dom('div', { className: this.config.className });
        this._messageContainer = dom('div', { className: this.config.innerClassName });
        this._element.appendChild(this._messageContainer);
        this._fillElementMessage();
        this._owner.ownerDocument.body.appendChild(this._element);
      }

      return this._element;
    }
  }]);

  return HintBox;
}();

HintBox.DEFAULT_CONFIG = {
  event: 'click',
  className: 'seoquake-hintbox',
  innerClassName: 'seoquake-hintbox-message',
  message: '',
  autoRemove: true,
  inline: false,
  positionFixed: false,
  offset: {
    left: null,
    top: null
  }
};

module.exports = HintBox;

},{"../dom/main":21,"extend":76}],31:[function(require,module,exports){
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

var _get = function get(object, property, receiver) {
  if (object === null) object = Function.prototype;var desc = Object.getOwnPropertyDescriptor(object, property);if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
    }
  } else if ("value" in desc) {
    return desc.value;
  } else {
    var getter = desc.get;if (getter === undefined) {
      return undefined;
    }return getter.call(receiver);
  }
};

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

function _possibleConstructorReturn(self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }return call && (typeof call === "object" || typeof call === "function") ? call : self;
}

function _inherits(subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } });if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
}

var Dropdown = require('./Dropdown');
var translateMixin = require('../utils/translateMixin');
var dom = require('../dom/main');
var extend = require('extend');
var ignore = require('../lib/ignore');

var OnboardingDropdown = function (_Dropdown) {
  _inherits(OnboardingDropdown, _Dropdown);

  function OnboardingDropdown(container, config) {
    _classCallCheck(this, OnboardingDropdown);

    config = config ? extend(true, {}, OnboardingDropdown.DEFAULT_CONFIG, config) : OnboardingDropdown.DEFAULT_CONFIG;

    var _this = _possibleConstructorReturn(this, (OnboardingDropdown.__proto__ || Object.getPrototypeOf(OnboardingDropdown)).call(this, container, config));

    _this._textBlock = null;
    _this._buttonOk = null;
    _this._buttonClose = null;
    _this._translateList = [];

    _this.processButtonOkClick = _this.handleButtonOkClick.bind(_this);
    _this.processButtonCancelClick = _this.handleButtonCancelClick.bind(_this);
    _this.processTranslate = _this.handleTranslate.bind(_this);
    return _this;
  }

  _createClass(OnboardingDropdown, [{
    key: 'init',
    value: function init() {
      _get(OnboardingDropdown.prototype.__proto__ || Object.getPrototypeOf(OnboardingDropdown.prototype), 'init', this).call(this);

      this._textBlock = document.createTextNode('');
      this._buttonOk = dom('button', { className: 'seoquake-button seoquake-button-primary' });
      this._buttonClose = dom('button', { className: 'seoquake-button' });

      this.body.appendChild(this._textBlock);
      this.body.appendChild(dom('div', { className: 'seoquake-google-keyword-difficulty-buttons' }, [this._buttonOk, this._buttonClose]));

      this._buttonOk.addEventListener('click', this.processButtonOkClick, true);
      this._buttonClose.addEventListener('click', this.processButtonCancelClick, true);

      this.translate();
    }
  }, {
    key: 'translate',
    value: function translate() {
      Promise.all(this._translateList).then(this.processTranslate).catch(ignore);
    }
  }, {
    key: 'remove',
    value: function remove() {
      this._buttonOk.removeEventListener('click', this.processButtonOkClick, true);
      this._buttonClose.removeEventListener('click', this.processButtonCancelClick, true);

      _get(OnboardingDropdown.prototype.__proto__ || Object.getPrototypeOf(OnboardingDropdown.prototype), 'remove', this).call(this);
    }
  }, {
    key: 'handleButtonOkClick',
    value: function handleButtonOkClick(e) {
      e.preventDefault();
      e.stopPropagation();

      this.dispatchEvent('okClick');
    }
  }, {
    key: 'handleButtonCancelClick',
    value: function handleButtonCancelClick(e) {
      e.preventDefault();
      e.stopPropagation();

      this.dispatchEvent('closeClick');
    }
  }, {
    key: 'handleTranslate',
    value: function handleTranslate(msgs) {
      if (msgs.length >= 3) {
        dom.css(this._body, { left: 0, visibility: 'hidden' });
        dom.text(this._buttonOk, msgs[0]);
        dom.text(this._buttonClose, msgs[1]);
        this.body.replaceChild(dom.parse(msgs[2], { lineBreak: 'br' }), this._textBlock);
        this.position();
        dom.css(this._body, { visibility: 'visible' });
      }
    }
  }]);

  return OnboardingDropdown;
}(Dropdown);

OnboardingDropdown.DEFAULT_CONFIG = {
  containerClass: 'seoquake-dropdown-container seoquake-google-keyword-difficulty-onboarding seoquake-google-keyword-difficulty-onboarding_inverse',
  positionCorrection: {
    left: -16,
    top: 8
  },
  bodyClickHide: false
};

translateMixin(OnboardingDropdown.prototype);

module.exports = OnboardingDropdown;

},{"../dom/main":21,"../lib/ignore":51,"../utils/translateMixin":70,"./Dropdown":29,"extend":76}],32:[function(require,module,exports){
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

var dom = require('../dom/main');
var extend = require('extend');
var ignore = require('../lib/ignore');
var Draggable = require('./Draggable');

var ScrollBlock = function () {
  function ScrollBlock(element, config) {
    _classCallCheck(this, ScrollBlock);

    if (!(element instanceof HTMLElement)) {
      throw new DOMError('element should be HTMLElement');
    }

    this._config = extend(true, {}, ScrollBlock.DEFAULT_CONFIG, config);
    this._element = element;
    this._scroll = null;
    this._container = null;
    this._bar = null;
    this._fadeTop = null;
    this._fadeBottom = null;
    this._observer = null;
    this._initialHeight = null;
    this._showScroll = false;
    this._isInit = false;

    this._barDrag = null;

    this._processElementChange = this._handleElementChange.bind(this);
    this._processElementMouseEnter = this._handleElementMouseEnter.bind(this);
    this._processElementMouseLeave = this._handleElementMouseLeave.bind(this);
    this._processElementMouseScroll = this._handleElementMouseScroll.bind(this);
    this._processDragMove = this._handleDragMove.bind(this);

    if (this._config.autoInit) {
      this.init();
    }
  }

  _createClass(ScrollBlock, [{
    key: 'init',
    value: function init() {
      var _this = this;

      if (dom.hasClass(this._element, this._config.classPrefix + 'content')) {
        this._container = this._element.querySelector('.' + this._config.classPrefix + 'container');
        this._scroll = this._element.querySelector('.' + this._config.classPrefix + 'scroll');
        this._bar = this._element.querySelector('.' + this._config.classPrefix + 'scroll-bar');
        this._initialHeight = dom.data(this._element, 'sqscrollheight');
      } else {
        dom.addClass(this._element, this._config.classPrefix + 'content');
        this._container = dom('div', { className: this._config.classPrefix + 'container' });
        Array.from(this._element.children).forEach(function (el) {
          return _this._container.appendChild(el);
        });
        this._element.appendChild(this._container);
        this._bar = dom('div', { className: this._config.classPrefix + 'scroll-bar' });
        this._scroll = dom('div', { className: this._config.classPrefix + 'scroll' }, this._bar);
        this._element.appendChild(this._scroll);
        this._initialHeight = this._element.offsetHeight;
        dom.data(this._element, 'sqscrollheight', this._initialHeight);
      }

      this._barDrag = new Draggable(this._bar);
      this._barDrag.addEventListener('down', function () {
        return dom.addClass(_this._element, _this._config.classPrefix + 'unselectable');
      });
      this._barDrag.addEventListener('move', this._processDragMove);
      this._barDrag.addEventListener('up', function () {
        return dom.removeClass(_this._element, _this._config.classPrefix + 'unselectable');
      });

      dom.css(this._element, 'height', this._initialHeight + 'px');
      this._element.addEventListener('mouseenter', this._processElementMouseEnter);
      this._element.addEventListener('mouseleave', this._processElementMouseLeave);
      this._element.addEventListener('wheel', this._processElementMouseScroll);

      this._observer = new MutationObserver(this._processElementChange);
      this._observer.observe(this._container, { childList: true, subtree: true });
      this._isInit = true;
    }
  }, {
    key: 'scroll',
    value: function scroll(delta) {
      var currentScroll = this._container.scrollTop;
      currentScroll = Math.min(currentScroll + delta, this._container.scrollHeight);
      this._container.scrollTop = currentScroll;
      this.renderScrollBar();
    }
  }, {
    key: 'scrollUp',
    value: function scrollUp() {
      this.scroll(-this._config.scrollStep);
    }
  }, {
    key: 'scrollDown',
    value: function scrollDown() {
      this.scroll(this._config.scrollStep);
    }
  }, {
    key: 'renderScrollBar',
    value: function renderScrollBar() {
      try {
        var contentHeight = this._container.scrollHeight;
        var containerHeight = this._container.clientHeight;
        if (contentHeight > containerHeight && containerHeight > 0 && contentHeight > 0) {
          this._showScroll = true;
          var style = window.getComputedStyle(this._bar);
          var barLength = containerHeight - dom.px(style.marginTop) - dom.px(style.marginBottom);
          var barHeight = Math.max(Math.round(containerHeight / contentHeight * barLength), dom.px(style.minHeight));
          var currentScroll = this._container.scrollTop;
          var barTop = Math.round(currentScroll / contentHeight * barLength);
          dom.css(this._bar, {
            height: barHeight + 'px',
            top: barTop + 'px'
          });
        } else {
          this._showScroll = false;
        }
      } catch (error) {
        ignore(error);
      }
    }
  }, {
    key: '_handleElementMouseEnter',
    value: function _handleElementMouseEnter(event) {
      if (!this._showScroll) {
        return;
      }

      dom.css(this._bar, 'visibility', 'visible');
    }
  }, {
    key: '_handleElementMouseLeave',
    value: function _handleElementMouseLeave(event) {
      dom.css(this._bar, 'visibility', 'hidden');
    }
  }, {
    key: '_handleElementChange',
    value: function _handleElementChange(mutations) {
      this.renderScrollBar();
    }
  }, {
    key: '_handleElementMouseScroll',
    value: function _handleElementMouseScroll(event) {
      if (!this._showScroll) {
        return;
      }

      if (event.deltaY > 0) {
        this.scrollDown();
      } else if (event.deltaY < 0) {
        this.scrollUp();
      }

      event.stopPropagation();
      event.preventDefault();
    }
  }, {
    key: '_handleDragMove',
    value: function _handleDragMove(delta) {
      try {
        var contentHeight = this._container.scrollHeight;
        var containerHeight = this._container.clientHeight;
        this.scroll(Math.round(-delta.top * contentHeight / containerHeight));
      } catch (error) {
        ignore(error);
      }
    }
  }, {
    key: 'remove',
    value: function remove() {
      var _this2 = this;

      if (!this._isInit) {
        return;
      }

      this._observer.disconnect();

      Array.from(this._container.children).forEach(function (el) {
        return _this2._element.appendChild(el);
      });

      this._element.removeEventListener('mouseenter', this._processElementMouseEnter);
      this._element.removeEventListener('mouseleave', this._processElementMouseLeave);

      dom.removeElement(this._container);
      this._container = null;

      this._barDrag.remove();
      dom.removeElement(this._bar);
      this._bar = null;
      dom.removeElement(this._scroll);
      this._scroll = null;

      dom.css(this._element, 'height', this._initialHeight + 'px');
      this._initialHeight = null;

      this._isInit = false;
    }
  }, {
    key: 'height',
    set: function set(value) {
      dom.css(this._element, 'height', value + 'px');
      this.renderScrollBar();
    },
    get: function get() {
      return parseInt(dom.css(this._element, 'height'));
    }
  }, {
    key: 'contentHeight',
    get: function get() {
      return this._container.scrollHeight;
    }
  }, {
    key: 'container',
    get: function get() {
      return this._container;
    }
  }]);

  return ScrollBlock;
}();

ScrollBlock.DEFAULT_CONFIG = {
  classPrefix: 'sqsll-',
  show: 'hover',
  scrollStep: 20,
  autoInit: true
};

module.exports = ScrollBlock;

},{"../dom/main":21,"../lib/ignore":51,"./Draggable":28,"extend":76}],33:[function(require,module,exports){
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

var eventsMixin = require('../utils/eventsMixin');
var extend = require('extend');
var isString = require('../lib/isString');
var dom = require('../dom/main');

var ToggleButton = function () {
  function ToggleButton(selector, config) {
    _classCallCheck(this, ToggleButton);

    config = extend(true, {}, ToggleButton.DEFAULT_CONFIG, config);

    this._config = config;

    this._element = null;
    this._clickListener = null;
    this._status = ToggleButton.STATUS_UNKNOWN;

    if (isString(selector)) {
      this.element = document.querySelector(selector);
    } else {
      this.element = selector;
    }

    this.setStatus(this._config.initialStatus, true);
  }

  _createClass(ToggleButton, [{
    key: '_clickHandler',
    value: function _clickHandler(event) {
      this.dispatchEvent('click');

      if (this._config.preventDefault) {
        event.preventDefault();
      }

      if (this._config.stopPropagation) {
        event.stopPropagation();
      }

      if (this.status === ToggleButton.STATUS_DOWN) {
        this.status = ToggleButton.STATUS_UP;
      } else {
        this.status = ToggleButton.STATUS_DOWN;
      }
    }
  }, {
    key: 'setStatus',
    value: function setStatus(value, skipEvents) {
      if (value === this._status) {
        return;
      }

      this._status = value;
      this._updateStatus(skipEvents);
    }
  }, {
    key: '_addClass',
    value: function _addClass(cls) {
      if (isString(cls) && cls !== '') {
        dom.addClass(this._element, cls);
      }
    }
  }, {
    key: '_remClass',
    value: function _remClass(cls) {
      if (isString(cls) && cls !== '') {
        dom.removeClass(this._element, cls);
      }
    }
  }, {
    key: '_updateStatus',
    value: function _updateStatus(skipEvents) {
      switch (this._status) {
        case ToggleButton.STATUS_DOWN:
          this._addClass(this._config.classActive);
          this._remClass(this._config.classInactive);
          if (!skipEvents) {
            this.dispatchEvent('down', this);
          }

          break;
        case ToggleButton.STATUS_UP:
          this._remClass(this._config.classActive);
          this._addClass(this._config.classInactive);
          if (!skipEvents) {
            this.dispatchEvent('up', this);
          }

          break;
        default:
          this._remClass(this._config.classActive);
          this._remClass(this._config.classInactive);
          if (!skipEvents) {
            this.dispatchEvent('unknown', this);
          }
      }
    }
  }, {
    key: 'remove',
    value: function remove() {
      this.element = null;
      this.clearEvents();
    }
  }, {
    key: 'clickListener',
    get: function get() {
      if (this._clickListener === null) {
        this._clickListener = this._clickHandler.bind(this);
      }

      return this._clickListener;
    }
  }, {
    key: 'status',
    set: function set(value) {
      if (value === this._status) {
        return;
      }

      this._status = value;
      this._updateStatus();
    },
    get: function get() {
      return this._status;
    }
  }, {
    key: 'element',
    set: function set(value) {
      if (this._element !== null) {
        this._element.removeEventListener('click', this.clickListener, true);
      }

      this._element = value;

      if (value !== null) {
        this._updateStatus();
        this._element.addEventListener('click', this.clickListener, true);
      }
    },
    get: function get() {
      return this._element;
    }
  }]);

  return ToggleButton;
}();

ToggleButton.STATUS_UNKNOWN = 0;
ToggleButton.STATUS_DOWN = 1;
ToggleButton.STATUS_UP = 2;

ToggleButton.DEFAULT_CONFIG = {
  classActive: 'active',
  classInactive: '',
  initialStatus: ToggleButton.STATUS_UP,
  preventDefault: true,
  stopPropagation: false
};

eventsMixin(ToggleButton.prototype);

module.exports = ToggleButton;

},{"../dom/main":21,"../lib/isString":57,"../utils/eventsMixin":66,"extend":76}],34:[function(require,module,exports){
'use strict';

module.exports = function googleChecksum(url) {
  function c32to8bit(arr32) {
    var arr8 = [];
    var i = void 0;
    var bitOrder = void 0;

    for (i = 0; i < arr32.length; i++) {
      for (bitOrder = i * 4; bitOrder <= i * 4 + 3; bitOrder++) {
        arr8[bitOrder] = arr32[i] & 255;
        arr32[i] = zeroFill(arr32[i], 8);
      }
    }

    return arr8;
  }

  function strord(string) {
    var result = [];
    var i = void 0;

    for (i = 0; i < string.length; i++) {
      result[i] = string[i].charCodeAt(0);
    }

    return result;
  }

  function googleChecksum(url) {
    var init = 0xE6359A60;
    var length = url.length;
    var a = 0x9E3779B9;
    var b = 0x9E3779B9;
    var c = 0xE6359A60;
    var k = 0;
    var len = length;
    var mixo = [];

    function mix(a, b, c) {
      a -= b;
      a -= c;
      a ^= zeroFill(c, 13);
      b -= c;
      b -= a;
      b ^= a << 8;
      c -= a;
      c -= b;
      c ^= zeroFill(b, 13);
      a -= b;
      a -= c;
      a ^= zeroFill(c, 12);
      b -= c;
      b -= a;
      b ^= a << 16;
      c -= a;
      c -= b;
      c ^= zeroFill(b, 5);
      a -= b;
      a -= c;
      a ^= zeroFill(c, 3);
      b -= c;
      b -= a;
      b ^= a << 10;
      c -= a;
      c -= b;
      c ^= zeroFill(b, 15);
      return [a, b, c];
    }

    while (len >= 12) {
      a += url[k] + (url[k + 1] << 8) + (url[k + 2] << 16) + (url[k + 3] << 24);
      b += url[k + 4] + (url[k + 5] << 8) + (url[k + 6] << 16) + (url[k + 7] << 24);
      c += url[k + 8] + (url[k + 9] << 8) + (url[k + 10] << 16) + (url[k + 11] << 24);
      mixo = mix(a, b, c);
      a = mixo[0];
      b = mixo[1];
      c = mixo[2];
      k += 12;
      len -= 12;
    }

    c += length;
    switch (len) {
      case 11:
        c += url[k + 10] << 24;

      case 10:
        c += url[k + 9] << 16;

      case 9:
        c += url[k + 8] << 8;

      case 8:
        b += url[k + 7] << 24;

      case 7:
        b += url[k + 6] << 16;

      case 6:
        b += url[k + 5] << 8;

      case 5:
        b += url[k + 4];

      case 4:
        a += url[k + 3] << 24;

      case 3:
        a += url[k + 2] << 16;

      case 2:
        a += url[k + 1] << 8;

      case 1:
        a += url[k];
    }

    mixo = mix(a, b, c);

    return mixo[2] < 0 ? 0x100000000 + mixo[2] : mixo[2];
  }

  function myfmod(x, y) {
    var i = Math.floor(x / y);
    return x - i * y;
  }

  function zeroFill(a, b) {
    var z = hexdec(80000000);

    if (z & a) {
      a = a >> 1;
      a &= ~z;
      a |= 0x40000000;
      a = a >> b - 1;
    } else {
      a = a >> b;
    }

    return a;
  }

  function hexdec(str) {
    return parseInt(str, 16);
  }

  function newGoogleChecksum(checksum) {
    var prbuf = [];
    var i = void 0;

    checksum = checksum / 7 << 2 | myfmod(checksum, 13) & 7;

    prbuf[0] = checksum;
    for (i = 1; i < 20; i++) {
      prbuf[i] = prbuf[i - 1] - 9;
    }

    checksum = googleChecksum(c32to8bit(prbuf), 80);

    return checksum;
  }

  return '6' + newGoogleChecksum(googleChecksum(strord(url)));
};

},{}],35:[function(require,module,exports){
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

var _get = function get(object, property, receiver) {
  if (object === null) object = Function.prototype;var desc = Object.getOwnPropertyDescriptor(object, property);if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
    }
  } else if ("value" in desc) {
    return desc.value;
  } else {
    var getter = desc.get;if (getter === undefined) {
      return undefined;
    }return getter.call(receiver);
  }
};

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

function _possibleConstructorReturn(self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }return call && (typeof call === "object" || typeof call === "function") ? call : self;
}

function _inherits(subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } });if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
}

var sanitize = require('sanitize-filename');
var dom = require('../dom/main');
var ignore = require('../lib/ignore');
var HintBox = require('../effects/HintBox');
var OnboardingGSCBacklinksScore = require('./OnboardingGSCBacklinksScore');
var GSCBase = require('./GSCBase');

var GSCBacklinksScore = function (_GSCBase) {
  _inherits(GSCBacklinksScore, _GSCBase);

  function GSCBacklinksScore() {
    _classCallCheck(this, GSCBacklinksScore);

    var _this = _possibleConstructorReturn(this, (GSCBacklinksScore.__proto__ || Object.getPrototypeOf(GSCBacklinksScore)).call(this));

    _this._analyticsAction = 'Links';
    _this._featureSwitchName = 'gsc.dsts';

    _this._table = null;
    _this._dataCells = new Map();
    _this._dsTooltip = null;
    _this._tsTooltip = null;
    _this._currentSort = null;

    _this.processBacklinksReady = _this.handleBacklinksReady.bind(_this);
    _this.processBacklinksError = _this.handleBacklinksError.bind(_this);
    _this.processSortClick = _this.handleSortClick.bind(_this);
    _this.processExportClick = _this.handleExportClick.bind(_this);
    _this.processDataReady = _this.handleDataReady.bind(_this);
    _this.processDataError = _this.handleDataError.bind(_this);
    return _this;
  }

  _createClass(GSCBacklinksScore, [{
    key: 'run',
    value: function run() {
      if (!this._isInit) {
        return;
      }

      this._table = document.getElementById('gxp-table').querySelector('table');

      if (!this._table) {
        return;
      }

      _get(GSCBacklinksScore.prototype.__proto__ || Object.getPrototypeOf(GSCBacklinksScore.prototype), 'run', this).call(this);
    }
  }, {
    key: 'loadData',
    value: function loadData() {
      var _this2 = this;

      var requests = [];
      this._dataCells.forEach(function (data, url) {
        return requests.push(_this2._api.getBacklinks('root_domain', url).then(_this2.processBacklinksReady).catch(_this2.processBacklinksError));
      });

      return Promise.all(requests);
    }
  }, {
    key: 'clear',
    value: function clear() {
      this._currentState = null;
      this._dataCells.clear();
      this._elements.forEach(function (element) {
        return dom.removeElement(element);
      });
      this._elements.splice(0, this._elements.length);

      if (this._dsTooltip !== null) {
        this._dsTooltip.remove();
        this._dsTooltip = null;
      }

      if (this._tsTooltip !== null) {
        this._tsTooltip.remove();
        this._tsTooltip = null;
      }

      dom.removeClass(this._table, 'sqgsc-table');
      _get(GSCBacklinksScore.prototype.__proto__ || Object.getPrototypeOf(GSCBacklinksScore.prototype), 'clear', this).call(this);
    }
  }, {
    key: 'createRowData',
    value: function createRowData(row) {
      var domainCell = row.cells[0].querySelector('a');
      if (!domainCell) {
        return;
      }

      var domain = dom.text(domainCell);

      if (domain !== '') {
        var dsCell = row.insertCell(1);
        dom.addClass(dsCell, 'sqgsc-cell-left');
        dom.addClass(dsCell, 'sqgsc-loading');
        dsCell.appendChild(dom('div', {}, dom('span', {}, '')));
        this._elements.push(dsCell);

        var tsCell = row.insertCell(2);
        dom.addClass(tsCell, 'sqgsc-cell-right');
        dom.addClass(tsCell, 'sqgsc-loading');
        tsCell.appendChild(dom('div', {}, dom('span', {}, '')));
        this._elements.push(tsCell);

        domain = domain.trim();

        this._dataCells.set(domain, [null, null, dsCell, tsCell]);
      }
    }
  }, {
    key: 'stateConnect',
    value: function stateConnect() {
      var _this3 = this;

      if (!this.beforeStateChange(GSCBase.STATE_CONNECT)) {
        return;
      }

      var thead = this._table.tHead;
      if (!thead) {
        return;
      }

      dom.removeClass(this._table.parentNode, 'no-th');
      dom.addClass(this._table, 'sqgsc-table');

      var semrushCell = dom('th', { className: 'sqgsc-header' });
      dom.insertAfter(semrushCell, thead.rows[0].firstElementChild);
      this._elements.push(semrushCell);

      var connectButton = dom('button', { className: 'sqgscbtn sqgscbtn-connect' }, this.t('sqGSC_connect'));
      connectButton.addEventListener('click', this.processConnectClick, true);
      this._elements.push(connectButton);
      semrushCell.appendChild(connectButton);

      var tbody = this._table.tBodies[0];
      var rows = Array.from(tbody.rows);
      rows.forEach(function (row) {
        var cell = row.insertCell(1);
        dom.addClass(cell, 'sqgsc-cell');
        dom.text(cell, '...');
        cell.addEventListener('click', _this3.processConnectClick, true);
        _this3._elements.push(cell);
      });

      this._currentState = GSCBase.STATE_CONNECT;
    }
  }, {
    key: 'stateRequest',
    value: function stateRequest() {
      var _this4 = this;

      if (!this.beforeStateChange(GSCBase.STATE_REQUEST)) {
        return;
      }

      var thead = this._table.tHead;

      dom.removeClass(this._table.parentNode, 'no-th');
      dom.addClass(this._table, 'sqgsc-table');

      var semrushCell = dom('th', { className: 'sqgsc-header', colspan: 2 }, dom('span', { className: 'sqgsc-header-logo' }, ''));
      this._elements.push(semrushCell);

      var dsItem = dom('span', { className: 'sqgsc-info' }, '');
      this._elements.push(dsItem);

      var tsItem = dom('span', { className: 'sqgsc-info' }, '');
      this._elements.push(tsItem);

      if (this._table.getAttribute('id') === 'firsttier') {
        var semrushRow = thead.insertRow(0);
        this._elements.push(semrushRow);

        semrushRow.appendChild(dom('th'));
        semrushRow.appendChild(semrushCell);
        semrushRow.appendChild(dom('th'));
        semrushRow.appendChild(dom('th'));

        var dsCell = dom('th', { className: 'sqgsc-sub-header sqgsc-sort-header sqgsc-sort-header-disabled', 'data-field': 'ds' }, ['DS', dsItem]);
        var tsCell = dom('th', { className: 'sqgsc-sub-header sqgsc-sort-header sqgsc-sort-header-disabled', 'data-field': 'ts' }, ['TS', tsItem]);
        thead.rows[1].insertBefore(dsCell, thead.rows[1].firstElementChild.nextElementSibling);
        thead.rows[1].insertBefore(tsCell, dsCell.nextElementSibling);

        this._elements.push(dsCell);
        this._elements.push(tsCell);

        var exportButton = dom('div', { id: 'sqgsc-export', disabled: true, role: 'button', className: 'goog-inline-block jfk-button jfk-button-standard sqgsc-button-seoquake sqgsc-button-seoquake-disabled', tabindex: '0' }, this.t('sqGSC_export'));
        this._elements.push(exportButton);

        var lastTooltipButton = document.getElementById('download-container-2');
        if (lastTooltipButton) {
          var span = dom('span', {}, exportButton);
          this._elements.push(span);
          lastTooltipButton.parentNode.appendChild(span);
        }
      } else {
        thead.rows[0].insertBefore(semrushCell, thead.rows[0].firstElementChild.nextElementSibling);

        var _semrushRow = thead.insertRow();
        this._elements.push(_semrushRow);

        var _dsCell = dom('th', { className: 'sqgsc-sub-header' }, ['DS', dsItem]);
        thead.rows[1].appendChild(dom('th'));
        thead.rows[1].appendChild(_dsCell);

        var _tsCell = dom('th', { className: 'sqgsc-sub-header' }, ['TS', tsItem]);
        thead.rows[1].appendChild(_tsCell);
        thead.rows[1].appendChild(dom('th'));

        this._elements.push(_dsCell);
        this._elements.push(_tsCell);
      }

      this._dsTooltip = new HintBox(dsItem, { event: 'hover' });
      this._tsTooltip = new HintBox(tsItem, { event: 'hover' });

      this.t('sqGSC_domain_score_tooltip').then(function (msg) {
        return _this4._dsTooltip.message = msg;
      }).catch(ignore);
      this.t('sqGSC_trust_score_tooltip').then(function (msg) {
        return _this4._tsTooltip.message = msg;
      }).catch(ignore);

      var tbody = this._table.tBodies[0];
      var rows = Array.from(tbody.rows);
      rows.forEach(function (row) {
        return _this4.createRowData(row);
      });

      this._currentState = GSCBase.STATE_REQUEST;

      this.loadData().then(this.processDataReady).catch(this.processDataError);
    }
  }, {
    key: 'stateReady',
    value: function stateReady() {
      if (this._currentState === GSCBase.STATE_DATA) {
        return;
      }

      if (this._table.getAttribute('id') === 'firsttier') {
        var dsCell = this._table.querySelector('th.sqgsc-sub-header[data-field="ds"]');
        if (dsCell) {
          dsCell.addEventListener('click', this.processSortClick);
          dom.removeClass(dsCell, 'sqgsc-sort-header-disabled');
        }

        var tsCell = this._table.querySelector('th.sqgsc-sub-header[data-field="ts"]');
        if (tsCell) {
          tsCell.addEventListener('click', this.processSortClick);
          dom.removeClass(tsCell, 'sqgsc-sort-header-disabled');
        }

        var exportButton = document.getElementById('sqgsc-export');
        if (exportButton) {
          exportButton.addEventListener('click', this.processExportClick);
          exportButton.addEventListener('mouseenter', GSCBacklinksScore.handleButtonHover);
          exportButton.addEventListener('mouseleave', GSCBacklinksScore.handleButtonUnhover);
          exportButton.removeAttribute('disabled');
          dom.removeClass(exportButton, 'sqgsc-button-seoquake-disabled');
        }
      }

      this._currentState = GSCBase.STATE_DATA;
    }
  }, {
    key: 'sort',
    value: function sort(field) {
      if (this._currentSort !== null) {
        var currentElement = this._table.querySelector('[data-field="' + this._currentSort.field + '"]');
        if (currentElement) {
          dom.removeClass(currentElement, 'sqgsc-' + this._currentSort.order);
        }

        if (this._currentSort.field === field) {
          this._currentSort.order = this._currentSort.order === 'asc' ? 'desc' : 'asc';
        } else {
          this._currentSort.field = field;
          this._currentSort.order = 'asc';
        }
      } else {
        this._currentSort = {
          field: field,
          order: 'asc'
        };
      }

      this.registerEvent('GSC', 'Sort ' + field.toUpperCase(), this._currentSort.order.toUpperCase());

      var element = this._table.querySelector('[data-field="' + this._currentSort.field);
      dom.addClass(element, 'sqgsc-' + this._currentSort.order);

      var tbody = this._table.tBodies[0];
      var rows = Array.from(tbody.rows);
      var newTBody = dom('tbody');
      if (this._currentSort.field === 'ts') {
        if (this._currentSort.order === 'asc') {
          rows.sort(GSCBacklinksScore.compareTSasc);
        } else {
          rows.sort(GSCBacklinksScore.compareTSdesc);
        }
      } else {
        if (this._currentSort.order === 'asc') {
          rows.sort(GSCBacklinksScore.compareDSasc);
        } else {
          rows.sort(GSCBacklinksScore.compareDSdesc);
        }
      }

      rows.forEach(function (item) {
        return newTBody.appendChild(item);
      });
      this._table.insertBefore(newTBody, tbody);
      dom.removeElement(tbody);
    }
  }, {
    key: 'getHeadersLine',
    value: function getHeadersLine() {
      var result = [];
      var cells = Array.from(this._table.tHead.rows[1].cells);
      cells.forEach(function (item) {
        return result.push(GSCBacklinksScore.textValue(dom.text(item)));
      });
      return result;
    }
  }, {
    key: 'getDataLines',
    value: function getDataLines() {
      var result = [];
      var rows = Array.from(this._table.tBodies[0].rows);
      rows.forEach(function (row) {
        var cells = Array.from(row.cells);
        var line = [];
        cells.forEach(function (cell) {
          return line.push(GSCBacklinksScore.textValue(dom.text(cell)));
        });
        result.push(line);
      });

      return result;
    }
  }, {
    key: 'createOnboarding',
    value: function createOnboarding(cell) {
      return new OnboardingGSCBacklinksScore(cell, {
        positionCorrection: {
          top: 10,
          left: 0
        }
      });
    }
  }, {
    key: 'handleConnected',
    value: function handleConnected() {
      this.stateRequest();
    }
  }, {
    key: 'handleDataReady',
    value: function handleDataReady() {
      this.stateReady();
    }
  }, {
    key: 'handleDataError',
    value: function handleDataError() {
      this.stateError();
    }
  }, {
    key: 'handleGSCConfiguration',
    value: function handleGSCConfiguration(gsc) {
      if (gsc !== undefined && typeof gsc.dsts !== 'undefined') {
        this.handleSwitchValue(!gsc.disabled && gsc.dsts);
      } else {
        this.handleSwitchValue(false);
      }
    }
  }, {
    key: 'handleBacklinksReady',
    value: function handleBacklinksReady(data) {
      if (typeof data.url === 'undefined' || !this._dataCells.has(data.url)) {
        return;
      }

      var item = this._dataCells.get(data.url);

      if (typeof data.error !== 'undefined' || typeof data.data.score === 'undefined' || typeof data.data.trust_score === 'undefined' || typeof data.data.total === 'undefined' || data.data.total === 0) {
        item[0] = '-';
        item[1] = '-';
      } else {
        item[0] = data.data.score;
        item[1] = data.data.trust_score;
      }

      dom.text(item[2], item[0]);
      dom.text(item[3], item[1]);
      dom.removeClass(item[2], 'sqgsc-loading');
      dom.removeClass(item[3], 'sqgsc-loading');
    }
  }, {
    key: 'handleBacklinksError',
    value: function handleBacklinksError(reason) {
      ignore(reason);
    }
  }, {
    key: 'handleSortClick',
    value: function handleSortClick(event) {
      event.preventDefault();
      event.stopPropagation();

      var field = event.currentTarget.getAttribute('data-field');

      if (field !== undefined && field !== '' && field !== null) {
        this.sort(field);
      }
    }
  }, {
    key: 'handleExportClick',
    value: function handleExportClick(event) {
      event.preventDefault();
      event.stopPropagation();

      var domain = this.domain;
      var filename = GSCBacklinksScore.createFileName(domain);
      var data = [this.getHeadersLine().join(';'), this.getDataLines().join('\n')].join('\n');

      var url = window.webkitURL || window.URL || window.mozURL || window.msURL;
      var a = document.createElement('a');
      a.download = filename;
      if ('chrome' === 'safari') {
        a.href = 'data:attachment/csv;charset=utf-8,' + encodeURIComponent(data);
      } else {
        a.href = url.createObjectURL(new Blob([data], { type: 'text/plain' }));
        a.dataset.downloadurl = ['csv', a.download, a.href].join(':');
      }

      var clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true
      });
      a.dispatchEvent(clickEvent);

      this.registerEvent('GSC', 'Export');
    }
  }], [{
    key: 'createFileName',
    value: function createFileName(domain) {
      var template = '%REPLACE% - %DATE% - %TIME%.csv';
      var now = new Date();
      var replaces = {
        '%REPLACE%': sanitize(domain),
        '%DATE%': sanitize(now.toLocaleDateString(), { replacement: '_' }),
        '%TIME%': sanitize(now.toLocaleTimeString(), { replacement: '_' })
      };
      return template.replace(/(%REPLACE%|%DATE%|%TIME%)/g, function (match, p1) {
        return replaces[p1];
      });
    }
  }, {
    key: 'compareDSasc',
    value: function compareDSasc(a, b) {
      var textA = dom.text(a.cells[1]);
      var textB = dom.text(b.cells[1]);
      if (textA === '-') {
        return -1;
      }

      if (textB === '-') {
        return 1;
      }

      if (textA === textB) {
        return 0;
      }

      var valueA = parseInt(textA, 10);
      var valueB = parseInt(textB, 10);

      return valueA - valueB;
    }
  }, {
    key: 'compareDSdesc',
    value: function compareDSdesc(a, b) {
      return -GSCBacklinksScore.compareDSasc(a, b);
    }
  }, {
    key: 'compareTSasc',
    value: function compareTSasc(a, b) {
      var textA = dom.text(a.cells[2]);
      var textB = dom.text(b.cells[2]);
      if (textA === '-') {
        return -1;
      }

      if (textB === '-') {
        return 1;
      }

      if (textA === textB) {
        return 0;
      }

      var valueA = parseInt(textA, 10);
      var valueB = parseInt(textB, 10);

      return valueA - valueB;
    }
  }, {
    key: 'compareTSdesc',
    value: function compareTSdesc(a, b) {
      return -GSCBacklinksScore.compareTSasc(a, b);
    }
  }, {
    key: 'handleButtonHover',
    value: function handleButtonHover(event) {
      dom.addClass(event.currentTarget, 'jfk-button-hover');
    }
  }, {
    key: 'handleButtonUnhover',
    value: function handleButtonUnhover(event) {
      dom.removeClass(event.currentTarget, 'jfk-button-hover');
    }
  }, {
    key: 'textValue',
    value: function textValue(name) {
      return '"' + name.split('\n')[0].replace(/"/g, '""') + '"';
    }
  }]);

  return GSCBacklinksScore;
}(GSCBase);

module.exports = GSCBacklinksScore;

},{"../dom/main":21,"../effects/HintBox":30,"../lib/ignore":51,"./GSCBase":36,"./OnboardingGSCBacklinksScore":43,"sanitize-filename":81}],36:[function(require,module,exports){
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

var ignore = require('../lib/ignore');
var dom = require('../dom/main');
var SemrushApi = require('../semrush/SemrushApi');
var messengerMixin = require('../utils/messengerMixin');
var messengerTranslateMixin = require('../utils/messengerTranslateMixin');
var parseArgs = require('../lib/parseArgs');
var OnboardingDropdown = require('../effects/OnboardingDropdown');

var GSCBase = function () {
  function GSCBase() {
    _classCallCheck(this, GSCBase);

    this._isInit = false;
    this._analyticsAction = 'base';
    this._onboarding = null;
    this._api = null;
    this._currentState = null;
    this._configuration = null;
    this._isEnabled = null;
    this._elements = [];
    this._onboardingSwitchName = 'gsc.onboarding';
    this._featureSwitchName = 'gsc.disabled';

    this.processDetach = this.handleDetach.bind(this);
    this.processUpdateConfiguration = this.handleUpdateConfiguration.bind(this);
    this.processConnectClick = this.handleConnectClick.bind(this);
    this.processConnected = this.handleConnected.bind(this);
    this.processNotConnected = this.handleNotConnected.bind(this);
    this.processShowOnboarding = this.handleShowOnboarding.bind(this);
    this.processOnboardingOkClick = this.handleOnboardingOkClick.bind(this);
    this.processOnboardingCloseClick = this.handleOnboardingCloseClick.bind(this);
  }

  _createClass(GSCBase, [{
    key: 'init',
    value: function init() {
      this.addMessageListener('detach', this.processDetach);
      this.addMessageListener('sq.updateConfiguration', this.processUpdateConfiguration);

      this._isInit = true;
      this.sendMessage('sq.getConfiguration').then(this.processUpdateConfiguration).catch(ignore);
    }
  }, {
    key: 'run',
    value: function run() {
      if (!this._isInit) {
        return;
      }

      this._api = new SemrushApi();
      this._api.setMessenger(this.getMessenger());
      this._api.getIsConnected().then(this.processConnected).catch(this.processNotConnected);

      this.showOnboarding();
    }
  }, {
    key: 'remove',
    value: function remove() {
      this._isInit = false;
      this.clear();
      this.removeMessageListener('detach', this.processDetach);
      this.removeMessageListener('sq.updateConfiguration', this.processUpdateConfiguration);
    }
  }, {
    key: 'clear',
    value: function clear() {
      this.hideOnboarding();
    }
  }, {
    key: 'createOnboarding',
    value: function createOnboarding(cell) {
      return new OnboardingDropdown(cell);
    }
  }, {
    key: 'showOnboarding',
    value: function showOnboarding() {
      if (!this._configuration.gsc.onboarding) {
        return;
      }

      setTimeout(this.processShowOnboarding, 300);
    }
  }, {
    key: 'hideOnboarding',
    value: function hideOnboarding() {
      if (this._onboarding) {
        this._onboarding.remove();
        this._onboarding = null;
      }
    }
  }, {
    key: 'repositionOnboarding',
    value: function repositionOnboarding() {
      if (this._onboarding) {
        this._onboarding.position();
      }
    }
  }, {
    key: 'beforeStateChange',
    value: function beforeStateChange(stateToCheck) {
      if (this._currentState === stateToCheck) {
        return null;
      }

      this.clear();

      return true;
    }
  }, {
    key: 'stateError',
    value: function stateError() {
      if (this._currentState === GSCBase.STATE_ERROR) {
        return;
      }

      this.clear();
      this._currentState = GSCBase.STATE_ERROR;
    }
  }, {
    key: 'stateConnect',
    value: function stateConnect() {
      if (!this.beforeStateChange(GSCBase.STATE_CONNECT)) {
        return;
      }

      this._currentState = GSCBase.STATE_CONNECT;
    }
  }, {
    key: 'handleDetach',
    value: function handleDetach() {
      this.remove();
    }
  }, {
    key: 'handleConnected',
    value: function handleConnected() {}
  }, {
    key: 'handleNotConnected',
    value: function handleNotConnected(reason) {
      if (reason instanceof Error && reason.message === 'No token provided') {
        this.stateConnect();
      } else {
        this.stateError();
      }
    }
  }, {
    key: 'handleGSCConfiguration',
    value: function handleGSCConfiguration(gscConfig) {
      this.handleSwitchValue(gscConfig !== undefined && !gscConfig.disabled);
    }
  }, {
    key: 'handleUpdateConfiguration',
    value: function handleUpdateConfiguration(configuration) {
      this._configuration = configuration;

      if (typeof configuration.core === 'undefined' || typeof configuration.gsc === 'undefined' || typeof configuration.core.disabled !== 'undefined' && configuration.core.disabled) {
        this.handleSwitchValue(false);
      } else if (typeof configuration.gsc.disabled !== 'undefined') {
        this.handleGSCConfiguration(configuration.gsc);
      }

      if (this._isEnabled) {
        this.run();
      }
    }
  }, {
    key: 'handleSwitchValue',
    value: function handleSwitchValue(gscEnabled) {
      if (this._isEnabled && !gscEnabled) {
        this.clear();
      }

      this._isEnabled = gscEnabled;
    }
  }, {
    key: 'handleConnectClick',
    value: function handleConnectClick(event) {
      event.preventDefault();
      event.stopPropagation();

      this.sendMessage('sq.openConfigurationWindow', { panel: 'integration' });
      this.registerEvent('GSC', 'Connect');
    }
  }, {
    key: 'handleShowOnboarding',
    value: function handleShowOnboarding(cell) {
      cell = cell || this._elements[0];
      if (cell) {
        this._onboarding = this.createOnboarding(cell);
        this._onboarding.setTranslateFunction(this.t.bind(this));
        this._onboarding.addEventListener('okClick', this.processOnboardingOkClick);
        this._onboarding.addEventListener('closeClick', this.processOnboardingCloseClick);
        this._onboarding.init();
        this._onboarding.show();
      }
    }
  }, {
    key: 'handleOnboardingOkClick',
    value: function handleOnboardingOkClick() {
      var _this = this;

      if (this._onboarding !== null) {
        var messages = [this.sendMessage('sq.setConfigurationItem', { name: this._onboardingSwitchName, value: false }), this.registerEvent('GSC', this._analyticsAction, 'Like')];

        Promise.all(messages).then(function () {
          return _this.sendMessage('sq.updateConfiguration');
        }).catch(ignore);

        this.hideOnboarding();
      }
    }
  }, {
    key: 'handleOnboardingCloseClick',
    value: function handleOnboardingCloseClick() {
      var _this2 = this;

      if (this._onboarding !== null) {
        var messages = [this.sendMessage('sq.setConfigurationItem', { name: this._onboardingSwitchName, value: false }), this.sendMessage('sq.setConfigurationItem', { name: this._featureSwitchName, value: false }), this.registerEvent('GSC', this._analyticsAction, 'Hate')];

        Promise.all(messages).then(function () {
          return _this2.sendMessage('sq.updateConfiguration');
        }).catch(ignore);

        this.hideOnboarding();
      }
    }
  }, {
    key: 'domain',
    get: function get() {
      var search = document.location.search;
      var params = parseArgs.parseArgs(search);
      if (params.has('siteUrl')) {
        return params.get('siteUrl').replace(/^http(s)?:\/\//i, '').replace(/\/$/i, '');
      }

      return 'no domain';
    }
  }, {
    key: 'configuration',
    get: function get() {
      return this._configuration;
    }
  }]);

  return GSCBase;
}();

GSCBase.STATE_CONNECT = 1;
GSCBase.STATE_REQUEST = 2;
GSCBase.STATE_ERROR = 3;
GSCBase.STATE_DATA = 4;
GSCBase.STATE_CONNECTED = 5;

messengerMixin(GSCBase.prototype);
messengerTranslateMixin(GSCBase.prototype);

module.exports = GSCBase;

},{"../dom/main":21,"../effects/OnboardingDropdown":31,"../lib/ignore":51,"../lib/parseArgs":58,"../semrush/SemrushApi":63,"../utils/messengerMixin":68,"../utils/messengerTranslateMixin":69}],37:[function(require,module,exports){
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

var _get = function get(object, property, receiver) {
  if (object === null) object = Function.prototype;var desc = Object.getOwnPropertyDescriptor(object, property);if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
    }
  } else if ("value" in desc) {
    return desc.value;
  } else {
    var getter = desc.get;if (getter === undefined) {
      return undefined;
    }return getter.call(receiver);
  }
};

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

function _possibleConstructorReturn(self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }return call && (typeof call === "object" || typeof call === "function") ? call : self;
}

function _inherits(subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } });if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
}

var dom = require('../dom/main');
var ignore = require('../lib/ignore');
var SemrushApi = require('../semrush/SemrushApi');
var HintBox = require('../effects/HintBox');
var OnboardingGSCNotes = require('./OnboardingGSCNotes');
var GSCBase = require('./GSCBase');
var ToggleButton = require('../effects/ToggleButton');
var GSCNotesConnectedUI = require('./GSCNotesConnectedUI');

var GSCNotes = function (_GSCBase) {
  _inherits(GSCNotes, _GSCBase);

  function GSCNotes() {
    _classCallCheck(this, GSCNotes);

    var _this = _possibleConstructorReturn(this, (GSCNotes.__proto__ || Object.getPrototypeOf(GSCNotes)).call(this));

    _this._analyticsAction = 'Notes';
    _this._featureSwitchName = 'gsc.notes';
    _this._onboardingSwitchName = 'gsc.onboarding_notes';

    _this._observer = null;
    _this._connectedUI = null;

    _this.processStateConnectDOMChange = _this.handleStateConnectDOMChange.bind(_this);
    _this.processStateConnectedDOMChange = _this.handleStateConnectedDOMChange.bind(_this);
    return _this;
  }

  _createClass(GSCNotes, [{
    key: 'run',
    value: function run() {
      if (!this._isInit) {
        return;
      }

      if (this._api === null) {
        this._api = new SemrushApi();
        this._api.setMessenger(this.getMessenger());
      }

      this._api.getIsConnected().then(this.processConnected).catch(this.processNotConnected);
    }
  }, {
    key: 'clear',
    value: function clear() {
      if (this._connectedUI !== null) {
        this._connectedUI.clear();
        this._connectedUI = null;
      }

      this._currentState = null;
      this._elements.forEach(function (element) {
        return dom.removeElement(element);
      });
      this._elements.splice(0, this._elements.length);

      if (this._observer !== null) {
        this._observer.disconnect();
        this._observer = null;
      }

      _get(GSCNotes.prototype.__proto__ || Object.getPrototypeOf(GSCNotes.prototype), 'clear', this).call(this);
    }
  }, {
    key: 'createOnboarding',
    value: function createOnboarding(cell) {
      return new OnboardingGSCNotes(cell, {
        positionCorrection: {
          top: 10,
          left: 0
        }
      });
    }
  }, {
    key: 'showOnboarding',
    value: function showOnboarding(cell) {
      if (this._onboarding) {
        this.hideOnboarding();
      }

      if (!this._configuration.gsc.onboarding_notes) {
        return;
      }

      setTimeout(this.handleShowOnboarding.bind(this, cell), 300);
    }
  }, {
    key: 'stateConnect',
    value: function stateConnect() {
      if (!this.beforeStateChange(GSCBase.STATE_CONNECT)) {
        return;
      }

      var rootElement = document.querySelector('#wmt-tsq');

      if (rootElement) {
        this._observer = new MutationObserver(this.processStateConnectDOMChange);
        this._observer.observe(rootElement, { childList: true, subtree: true });
        this.createConnectElements();
      }

      this._currentState = GSCBase.STATE_CONNECT;
    }
  }, {
    key: 'stateConnected',
    value: function stateConnected() {
      if (!this.beforeStateChange(GSCBase.STATE_CONNECTED)) {
        return;
      }

      var rootElement = document.querySelector('#wmt-tsq');

      if (rootElement) {
        this._observer = new MutationObserver(this.processStateConnectedDOMChange);
        this._observer.observe(rootElement, { childList: true, subtree: true });

        this.createConnectedElements();
      }

      this._currentState = GSCBase.STATE_CONNECTED;
    }
  }, {
    key: 'createConnectElements',
    value: function createConnectElements() {
      if (!this._configuration.gsc.notes) {
        return;
      }

      var rootElement = document.querySelector('#wmt-tsq');
      if (rootElement) {
        var buttonBefore = rootElement.querySelector('.legend-container');
        if (buttonBefore) {
          var buttonConnect = dom('button', {}, 'Some button');
          var container = dom('div', { className: 'sqgsc-notes-switch-container' }, ['Get Google updates with SEOquake - ', buttonConnect]);
          dom.insertAfter(container, buttonBefore);
          this._elements.push(buttonConnect);
          this._elements.push(container);

          dom.setText(container, this.t('sqGSC_notes_connect_message'));
          dom.setText(buttonConnect, this.t('sqGSC_notes_connect_button'));

          buttonConnect.addEventListener('click', this.processConnectClick, true);

          this.showOnboarding();
        }
      }
    }
  }, {
    key: 'createConnectedElements',
    value: function createConnectedElements() {
      if (this._connectedUI === null) {
        this._connectedUI = new GSCNotesConnectedUI(this);
      } else {
        this._connectedUI.clear();
      }

      this._connectedUI.draw();
    }
  }, {
    key: 'updateConnectedElements',
    value: function updateConnectedElements() {
      if (this._connectedUI === null) {
        this._connectedUI = new GSCNotesConnectedUI(this);
        this._connectedUI.draw();
      } else {
        this._connectedUI.update();
      }
    }
  }, {
    key: 'requestNotes',
    value: function requestNotes(dateFrom, dateTo) {
      return this._api.getNotesList(dateFrom, dateTo);
    }
  }, {
    key: 'handleConnected',
    value: function handleConnected() {
      if (this._currentState === GSCBase.STATE_CONNECTED) {
        this.updateConnectedElements();
      } else {
        this.stateConnected();
      }
    }
  }, {
    key: 'handleStateConnectDOMChange',
    value: function handleStateConnectDOMChange(changes) {
      var legendItems = changes.filter(function (record) {
        return dom.hasClass(record.target, 'legend-container');
      });
      if (legendItems.length === 0) {
        return;
      }

      this._elements.forEach(function (element) {
        return dom.removeElement(element);
      });
      this._elements.splice(0, this._elements.length);

      this.createConnectElements();
    }
  }, {
    key: 'handleStateConnectedDOMChange',
    value: function handleStateConnectedDOMChange(changes) {
      var tableItems = changes.filter(function (record) {
        return record.target.previousElementSibling !== null && record.target.previousElementSibling.tagName.toLowerCase() === 'svg' && Array.from(record.addedNodes).some(function (node) {
          return node.tagName.toLowerCase() === 'table';
        });
      });
      var legendItems = changes.filter(function (record) {
        return dom.hasClass(record.target, 'legend-container');
      });
      if (legendItems.length !== 0) {
        this.createConnectedElements();
      } else if (tableItems.length !== 0) {
        this.updateConnectedElements();
      }
    }
  }]);

  return GSCNotes;
}(GSCBase);

module.exports = GSCNotes;

},{"../dom/main":21,"../effects/HintBox":30,"../effects/ToggleButton":33,"../lib/ignore":51,"../semrush/SemrushApi":63,"./GSCBase":36,"./GSCNotesConnectedUI":39,"./OnboardingGSCNotes":44}],38:[function(require,module,exports){
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

var ignore = require('../lib/ignore');
var GSCNotesDropdown = require('./GSCNotesDropdown');

var GSCNotesChart = function () {
  function GSCNotesChart(svg, notes) {
    _classCallCheck(this, GSCNotesChart);

    this._notes = notes;
    this._svg = svg;
    this._minDate = null;
    this._maxDate = null;
    this._items = [];
    this._svgItems = [];
    this._dates = new Map();
    this._dropdown = null;

    this.processDataReceived = this.handleDataReceived.bind(this);
    this.processDataError = this.handleDataError.bind(this);
    this.processMarkClick = this.handleMarkClick.bind(this);
  }

  _createClass(GSCNotesChart, [{
    key: 'clear',
    value: function clear() {
      this._svgItems.forEach(function (element) {
        return GSCNotesChart.removeSVGElement(element);
      });

      if (this._dropdown !== null) {
        this._dropdown.remove();
        this._dropdown = null;
      }
    }
  }, {
    key: 'remove',
    value: function remove() {
      this.clear();
    }
  }, {
    key: 'getGraphCoordinates',
    value: function getGraphCoordinates() {
      var path = this._svg.querySelector('g > g > g > path');
      var result = [];
      if (path) {
        var pathString = path.getAttribute('d');
        var coordinates = pathString.split(/(M|L)/);
        if (coordinates.length > 1) {
          coordinates.forEach(function (coordLine) {
            var xy = coordLine.split(',');
            if (xy.length === 2) {
              result.push(Math.round(xy[0]));
            }
          });
        }
      }

      return result;
    }
  }, {
    key: 'draw',
    value: function draw() {
      var _this = this;

      if (this.notes.configuration.disabled || !this.notes.configuration.gsc.notes) {
        return;
      }

      var graphCoordinates = this.getGraphCoordinates();
      var localGroup = GSCNotesChart.createSVGElement('g');
      var height = this._svg.getAttribute('height') - 10;

      this._dates.forEach(function (item, key) {
        if (item.items.length === 0) {
          return;
        }

        if (graphCoordinates[item.index] !== undefined) {
          var line = GSCNotesChart.createLine(graphCoordinates[item.index], height);
          localGroup.appendChild(line);
          _this._svgItems.push(line);

          var mark = void 0;

          if (item.items.length === 1) {
            mark = GSCNotesChart.createSquare(graphCoordinates[item.index], height);
          } else {
            mark = GSCNotesChart.createFlag(graphCoordinates[item.index], height, item.items.length);
          }

          localGroup.appendChild(mark);
          _this._svgItems.push(mark);

          mark.setAttribute('data-date', key);
          mark.addEventListener('click', _this.processMarkClick, true);
        }
      });

      this._svg.appendChild(localGroup);
      this._svgItems.push(localGroup);
    }
  }, {
    key: 'showNotes',
    value: function showNotes(date, coord) {
      var _this2 = this;

      if (!this._dates.has(date)) {
        return;
      }

      var dateData = this._dates.get(date);
      if (dateData.items.length === 0) {
        return;
      }

      if (this._dropdown === null) {
        this._dropdown = new GSCNotesDropdown(this._svg.parentNode);
        this._dropdown.setTranslateFunction(this.notes.t.bind(this.notes));
        this._dropdown.addEventListener('close', function () {
          return _this2.notes.registerEvent('GSC', 'Notes - Close Popup');
        });
        this._dropdown.addEventListener('openLink', function () {
          return _this2.notes.registerEvent('GSC', 'Notes - Open Link');
        });
        this._dropdown.init();
      }

      this._dropdown.items = dateData.items;
      this._dropdown.show(coord);

      this.notes.registerEvent('GSC', 'Notes - Open Popup');
    }
  }, {
    key: 'handleRangeUpdate',
    value: function handleRangeUpdate() {
      if (this._minDate !== null && this._maxDate !== null) {
        this.notes.requestNotes(this._minDate, this._maxDate).then(this.processDataReceived).catch(this.processDataError);
      }
    }
  }, {
    key: 'handleDataError',
    value: function handleDataError(error) {
      ignore(error);
    }
  }, {
    key: 'handleDataReceived',
    value: function handleDataReceived(data) {
      var _this3 = this;

      this.clear();
      data.forEach(function (item) {
        var itemDate = GSCNotesChart.dateFormat(new Date(item.datetime));
        if (_this3._dates.has(itemDate)) {
          var day = _this3._dates.get(itemDate);
          day.items.push(item);
        }
      });
      this.draw();
    }
  }, {
    key: 'handleMarkClick',
    value: function handleMarkClick(event) {
      var mark = event.currentTarget;
      var date = mark.getAttribute('data-date');
      if (!this._dates.has(date)) {
        return;
      }

      var path = null;

      if (mark.tagName.toLowerCase() === 'g') {
        path = mark.firstChild;
      } else {
        path = mark;
      }

      var pathString = path.getAttribute('d');
      var coordinates = pathString.split(/(M|L)/i);
      if (coordinates.length > 2) {
        var firstCordXY = coordinates[2].split(',');
        if (firstCordXY.length === 2) {
          firstCordXY.forEach(function (item, index) {
            return firstCordXY[index] = parseFloat(item);
          });
          this.showNotes(date, firstCordXY);
        }
      }
    }
  }, {
    key: 'notes',
    get: function get() {
      return this._notes;
    }
  }, {
    key: 'minDate',
    get: function get() {
      return this._minDate;
    },
    set: function set(value) {
      this._minDate = value;
      this.handleRangeUpdate();
    }
  }, {
    key: 'maxDate',
    get: function get() {
      return this._maxDate;
    },
    set: function set(value) {
      this._maxDate = value;
      this.handleRangeUpdate();
    }
  }, {
    key: 'dates',
    set: function set(value) {
      var _this4 = this;

      this._dates.clear();
      value.forEach(function (date, index) {
        return _this4._dates.set(GSCNotesChart.dateFormat(date), {
          index: index,
          items: []
        });
      });
    }
  }], [{
    key: 'createSVGElement',
    value: function createSVGElement(tagName) {
      return document.createElementNS('http://www.w3.org/2000/svg', tagName);
    }
  }, {
    key: 'removeSVGElement',
    value: function removeSVGElement(element) {
      if (!element) {
        return;
      }

      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }
  }, {
    key: 'dateFormat',
    value: function dateFormat(date) {
      return date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();
    }
  }, {
    key: 'createLine',
    value: function createLine(x, height) {
      var line = GSCNotesChart.createSVGElement('rect');
      line.setAttribute('x', x);
      line.setAttribute('y', 0);
      line.setAttribute('width', 1);
      line.setAttribute('height', height);
      line.setAttribute('stroke', 'none');
      line.setAttribute('stroke-with', '0');
      line.setAttribute('fill', '#f39c9b');
      return line;
    }
  }, {
    key: 'createSquare',
    value: function createSquare(x, y) {
      var square = GSCNotesChart.createSVGElement('path');
      square.setAttribute('d', 'M' + (x - 7.5) + ',' + y + 'l8,-8l8,8l-8,8z');
      square.setAttribute('fill', '#ec1d25');
      square.setAttribute('stroke', 'none');
      square.setAttribute('stroke-with', '0');
      square.setAttribute('style', 'cursor:pointer');
      return square;
    }
  }, {
    key: 'createFlag',
    value: function createFlag(x, y, number) {
      var flag = GSCNotesChart.createSVGElement('g');
      var background = GSCNotesChart.createSVGElement('path');
      background.setAttribute('d', 'M' + (x - 9.5) + ',' + y + 'l2,0l8,-8l8,8l2,0l0,10l-1,1l-18,0l-1,-1z');
      background.setAttribute('fill', '#ec1d25');
      background.setAttribute('stroke', 'none');
      background.setAttribute('stroke-with', '0');
      var text = GSCNotesChart.createSVGElement('text');
      text.appendChild(document.createTextNode(number));
      text.setAttribute('x', x);
      text.setAttribute('y', y + 6);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('stroke', '#ffffff');
      text.setAttribute('font-size', '10');
      flag.appendChild(background);
      flag.appendChild(text);
      flag.setAttribute('style', 'cursor:pointer');
      return flag;
    }
  }]);

  return GSCNotesChart;
}();

module.exports = GSCNotesChart;

},{"../lib/ignore":51,"./GSCNotesDropdown":41}],39:[function(require,module,exports){
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

var dom = require('../dom/main');
var ToggleButton = require('../effects/ToggleButton');
var ignore = require('../lib/ignore');
var GSCNotesDateRange = require('./GSCNotesDateRange');
var GSCNotesChart = require('./GSCNotesChart');

var GSCNotesConnectedUI = function () {
  function GSCNotesConnectedUI(notes) {
    _classCallCheck(this, GSCNotesConnectedUI);

    this._notes = notes;
    this._toggleButton = null;
    this._elements = [];
    this._dateRangeDetector = null;
    this._chart = null;
    this._isDrawCalled = false;

    this.processToggleButtonUp = this.handleToggleButtonUp.bind(this);
    this.processToggleButtonDown = this.handleToggleButtonDown.bind(this);
  }

  _createClass(GSCNotesConnectedUI, [{
    key: 'clear',
    value: function clear() {
      if (this._toggleButton !== null) {
        this._toggleButton.remove();
        this._toggleButton = null;
      }

      if (this._chart !== null) {
        this._chart.remove();
        this._chart = null;
      }

      this._elements.forEach(function (element) {
        return dom.removeElement(element);
      });
      this._elements = [];
    }
  }, {
    key: 'updateChart',
    value: function updateChart() {
      var rootElement = document.querySelector('#wmt-tsq');
      if (rootElement) {
        var svgBaseDiv = rootElement.querySelector('svg + div');
        if (svgBaseDiv) {
          var svgBase = svgBaseDiv.previousElementSibling;
          this._chart = new GSCNotesChart(svgBase, this.notes);
        }
      }

      if (this._chart !== null) {
        var minDate = this._dateRangeDetector.getMinDate();
        var maxDate = this._dateRangeDetector.getMaxDate();
        if (minDate !== null && maxDate !== null) {
          this._chart.minDate = minDate;
          this._chart.maxDate = maxDate;
          this._chart.dates = this._dateRangeDetector.getDateRange();
        }
      }
    }
  }, {
    key: 'removeChart',
    value: function removeChart() {
      if (this._chart !== null) {
        this._chart.remove();
        this._chart = null;
      }
    }
  }, {
    key: 'draw',
    value: function draw() {
      if (this._dateRangeDetector === null) {
        this._dateRangeDetector = new GSCNotesDateRange();
      }

      var rootElement = document.querySelector('#wmt-tsq');
      if (rootElement) {
        var buttonBefore = rootElement.querySelector('.legend-container');
        if (buttonBefore) {
          var buttonSwitch = dom('button', { className: 'sqgsc-slider-button' }, 'Switch');

          var container = dom('div', { className: 'sqgsc-notes-switch-container' }, ['Get Google updates with SEOquake - ', buttonSwitch]);
          dom.insertAfter(container, buttonBefore);
          this._elements.push(buttonSwitch);
          this._elements.push(container);

          dom.setText(container, this.notes.t('sqGSC_notes_switch_message'));
          this._toggleButton = new ToggleButton(buttonSwitch);
          this._toggleButton.status = this.notes.configuration.gsc.notes ? ToggleButton.STATUS_DOWN : ToggleButton.STATUS_UP;
          this._toggleButton.addEventListener('down', this.processToggleButtonDown);
          this._toggleButton.addEventListener('up', this.processToggleButtonUp);

          this.notes.showOnboarding(this._elements[0]);
        }

        this.updateChart();
        this._isDrawCalled = true;
      }
    }
  }, {
    key: 'update',
    value: function update() {
      if (!this._isDrawCalled) {
        return;
      }

      if (this._toggleButton !== null) {
        this._toggleButton.setStatus(this.notes.configuration.gsc.notes ? ToggleButton.STATUS_DOWN : ToggleButton.STATUS_UP, true);
        this.notes.repositionOnboarding();
      }

      if (!this.notes.configuration.gsc.notes) {
        this.removeChart();
      } else {
        this.updateChart();
      }
    }
  }, {
    key: 'handleToggleButtonDown',
    value: function handleToggleButtonDown(event) {
      var _this = this;

      var messages = [this.notes.sendMessage('sq.setConfigurationItem', { name: 'gsc.notes', value: true }), this.notes.registerEvent('GSC Notes', 'Disable')];

      Promise.all(messages).then(function () {
        return _this.notes.sendMessage('sq.updateConfiguration');
      }).catch(ignore);
    }
  }, {
    key: 'handleToggleButtonUp',
    value: function handleToggleButtonUp(event) {
      var _this2 = this;

      var messages = [this.notes.sendMessage('sq.setConfigurationItem', { name: 'gsc.notes', value: false }), this.notes.registerEvent('GSC Notes', 'Enable')];

      Promise.all(messages).then(function () {
        return _this2.notes.sendMessage('sq.updateConfiguration');
      }).catch(ignore);
    }
  }, {
    key: 'notes',
    get: function get() {
      return this._notes;
    }
  }]);

  return GSCNotesConnectedUI;
}();

module.exports = GSCNotesConnectedUI;

},{"../dom/main":21,"../effects/ToggleButton":33,"../lib/ignore":51,"./GSCNotesChart":38,"./GSCNotesDateRange":40}],40:[function(require,module,exports){
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

var dateLocales = require('../defaults/locales.js');
var date = require('../utils/Date');
var dom = require('../dom/main');

var GSCNotesDateRange = function () {
  function GSCNotesDateRange() {
    var _this = this;

    _classCallCheck(this, GSCNotesDateRange);

    this._locale = 'root';

    var gwtProperties = Array.from(document.querySelectorAll('meta[name="gwt:property"]'));
    gwtProperties.forEach(function (element) {
      var value = element.hasAttribute('content') && element.getAttribute('content');
      var matches = /^locale=(.+)$/.exec(value);
      if (matches.length === 2) {
        _this._locale = matches[1];
      }
    });
  }

  _createClass(GSCNotesDateRange, [{
    key: 'parseDate',
    value: function parseDate(value) {
      if (typeof dateLocales[this._locale] !== 'undefined') {
        if (typeof dateLocales[this._locale].gregorian !== 'undefined') {
          var formats = dateLocales[this._locale].gregorian;
          for (var key in formats) {
            if (formats.hasOwnProperty(key)) {
              var _res = date.getDateFromFormat(value, formats[key]);
              if (_res !== 0) {
                return new Date(_res);
              }
            }
          }
        } else if (typeof dateLocales[this._locale].generic !== 'undefined') {
          var _formats = dateLocales[this._locale].generic;
          for (var _key in _formats) {
            if (_formats.hasOwnProperty(_key)) {
              var _res2 = date.getDateFromFormat(value, _formats[_key]);
              if (_res2 !== 0) {
                return new Date(_res2);
              }
            }
          }
        }
      }

      var res = date.parseDate(value);
      if (res !== 0) {
        return new Date(res);
      }

      return new Date();
    }
  }, {
    key: 'getMinDate',
    value: function getMinDate() {
      var result = null;

      var table = document.querySelector('svg + div > table');
      if (table) {
        var _date = dom.text(table.tBodies[0].rows[0].cells[0]);
        if (_date !== '') {
          result = this.parseDate(_date);
        }
      }

      return result;
    }
  }, {
    key: 'getMaxDate',
    value: function getMaxDate() {
      var result = null;

      var table = document.querySelector('svg + div > table');
      if (table) {
        var _date2 = dom.text(table.tBodies[0].lastElementChild.cells[0]);
        if (_date2 !== '') {
          result = this.parseDate(_date2);
        }
      }

      return result;
    }
  }, {
    key: 'getDateRange',
    value: function getDateRange() {
      var _this2 = this;

      var result = [];

      var table = document.querySelector('.overtime-gviz-chart svg + div > table');
      if (table) {
        Array.from(table.tBodies[0].rows).forEach(function (row) {
          var date = dom.text(row.cells[0]);
          if (date !== '') {
            result.push(_this2.parseDate(date));
          } else {
            result.push('');
          }
        });
      }

      return result;
    }
  }]);

  return GSCNotesDateRange;
}();

module.exports = GSCNotesDateRange;

},{"../defaults/locales.js":7,"../dom/main":21,"../utils/Date":64}],41:[function(require,module,exports){
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

var dom = require('../dom/main');
var ScrollBlock = require('../effects/ScrollBlock');
var translateMixin = require('../utils/translateMixin');
var eventsMixin = require('../utils/eventsMixin');

var GSCNotesDropdown = function () {
  function GSCNotesDropdown(svg) {
    _classCallCheck(this, GSCNotesDropdown);

    this._svg = svg;
    this._container = null;
    this._scrollBlock = null;
    this._closeButton = null;
    this._counter = null;
    this._dateField = null;
    this._items = [];

    this.processCloseClick = this.handleCloseClick.bind(this);
    this.processTitleClick = this.handleTitleClick.bind(this);
  }

  _createClass(GSCNotesDropdown, [{
    key: 'init',
    value: function init() {
      this._counter = dom('div', { className: 'sqgsc-notes-dropdown-counter' }, [dom('span'), '']);
      this._dateField = dom('div', { className: 'sqgsc-notes-dropdown-date' });
      this._closeButton = dom('button', { className: 'sqgsc-notes-dropdown-close' });
      var scrollContainer = dom('div', { className: 'sqgsc-notes-dropdown-content' });
      this._container = dom('div', { className: 'sqgsc-notes-dropdown sqgsc-notes-dropdown_hidden' }, [this._closeButton, this._counter, this._dateField, scrollContainer]);
      this._scrollBlock = new ScrollBlock(scrollContainer);
      document.body.appendChild(this._container);
      dom.setText(this._counter, this.t('sqGSC_notes_counter'));

      this._closeButton.addEventListener('click', this.processCloseClick, true);
    }
  }, {
    key: 'show',
    value: function show(coord) {
      var _this = this;

      var position = dom.getOffset(this._svg);

      dom.removeClass(this._container, 'sqgsc-notes-dropdown_hidden');
      dom.css(this._container, 'visibility', 'hidden');

      var contentHeight = 0;

      dom.text(this._counter.querySelector('span'), this._items.length);
      if (this._items.length === 1) {
        dom.setText(this._counter, this.t('sqGSC_notes_counter_one'));
      } else {
        dom.setText(this._counter, this.t('sqGSC_notes_counter'));
      }

      this._items.forEach(function (item) {
        var title = void 0;
        if (item.link !== null) {
          title = dom('a', { className: 'sqgsc-notes-dropdown-item-title', href: item.link, target: '_blank' }, item.title);
          title.addEventListener('click', _this.processTitleClick, true);
        } else {
          title = dom('div', { className: 'sqgsc-notes-dropdown-item-title' }, item.title);
        }

        var category = dom('div', { className: 'sqgsc-notes-dropdown-item-category', 'data-category': item.category }, _this.t('sqGSC_notes_' + item.category));
        var databases = dom('div', { className: 'sqgsc-notes-dropdown-databases' }, item.databases);
        var text = dom('div', { className: 'sqgsc-notes-dropdown-text' }, item.note);

        var itemElement = dom('div', { className: 'sqgsc-notes-dropdown-item' }, [title, dom('div', { className: 'sqgsc-notes-dropdown-row' }, [category, databases]), text]);

        _this._scrollBlock.container.appendChild(itemElement);
        contentHeight += itemElement.offsetHeight;

        var itemDate = new Date(item.datetime);

        dom.text(_this._dateField, itemDate.toLocaleDateString());
      });

      this._scrollBlock.height = Math.min(150, contentHeight);
      var left = position.left + coord[0] + 20;
      if (left + this._container.offsetWidth > document.body.clientWidth) {
        left -= this._container.offsetWidth + 20;
      }

      dom.css(this._container, {
        left: left + 'px',
        top: position.top + this._svg.offsetHeight - this._container.offsetHeight - 20 + 'px'
      });

      dom.css(this._container, 'visibility', 'visible');
    }
  }, {
    key: 'hide',
    value: function hide() {
      dom.addClass(this._container, 'sqgsc-notes-dropdown_hidden');
    }
  }, {
    key: 'remove',
    value: function remove() {
      this.hide();
      this._scrollBlock.remove();
      dom.removeElement(this._counter);
      dom.removeElement(this._dateField);
      dom.removeElement(this._closeButton);
      dom.removeElement(this._container);
      this._counter = null;
      this._dateField = null;
      this._closeButton = null;
      this._container = null;
      this._scrollBlock = null;
    }
  }, {
    key: 'handleCloseClick',
    value: function handleCloseClick(event) {
      event.preventDefault();
      event.stopPropagation();
      this.hide();
      this.dispatchEvent('close');
    }
  }, {
    key: 'handleTitleClick',
    value: function handleTitleClick() {
      this.dispatchEvent('openLink');
    }
  }, {
    key: 'items',
    set: function set(values) {
      this._items = values;
      dom.emptyElement(this._scrollBlock.container);
    }
  }]);

  return GSCNotesDropdown;
}();

translateMixin(GSCNotesDropdown.prototype);
eventsMixin(GSCNotesDropdown.prototype);

module.exports = GSCNotesDropdown;

},{"../dom/main":21,"../effects/ScrollBlock":32,"../utils/eventsMixin":66,"../utils/translateMixin":70}],42:[function(require,module,exports){
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

var _get = function get(object, property, receiver) {
  if (object === null) object = Function.prototype;var desc = Object.getOwnPropertyDescriptor(object, property);if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
    }
  } else if ("value" in desc) {
    return desc.value;
  } else {
    var getter = desc.get;if (getter === undefined) {
      return undefined;
    }return getter.call(receiver);
  }
};

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

function _possibleConstructorReturn(self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }return call && (typeof call === "object" || typeof call === "function") ? call : self;
}

function _inherits(subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } });if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
}

var isArray = require('../lib/isArray');
var dom = require('../dom/main');
var ignore = require('../lib/ignore');
var SemrushApi = require('../semrush/SemrushApi');
var HintBox = require('../effects/HintBox');
var OnboardingGSCNotes = require('./OnboardingGSCNotes');
var GSCBase = require('./GSCBase');
var ToggleButton = require('../effects/ToggleButton');
var GSCNotesConnectedUI = require('./GSCNotesConnectedUI');
var GSCNotesDateRange = require('./GSCNotesDateRange');

var GSCNotesSmall = function (_GSCBase) {
  _inherits(GSCNotesSmall, _GSCBase);

  function GSCNotesSmall() {
    _classCallCheck(this, GSCNotesSmall);

    var _this = _possibleConstructorReturn(this, (GSCNotesSmall.__proto__ || Object.getPrototypeOf(GSCNotesSmall)).call(this));

    _this._container = null;
    _this._counter = null;
    _this._message = null;
    _this._observer = null;
    _this._dateRangeDetector = null;

    _this.processStateConnectedDOMChange = _this.handleStateConnectedDOMChange.bind(_this);
    _this.processDataReceived = _this.handleDataReceived.bind(_this);
    _this.processDataError = _this.handleDataError.bind(_this);
    return _this;
  }

  _createClass(GSCNotesSmall, [{
    key: 'run',
    value: function run() {
      if (!this._isInit) {
        return;
      }

      if (this._api === null) {
        this._api = new SemrushApi();
        this._api.setMessenger(this.getMessenger());
      }

      this._api.getIsConnected().then(this.processConnected).catch(this.processNotConnected);
    }
  }, {
    key: 'clear',
    value: function clear() {
      this._currentState = null;
      this._elements.forEach(function (element) {
        return dom.removeElement(element);
      });
      this._elements.splice(0, this._elements.length);
      this._container = null;
      this._counter = null;
      this._message = null;

      if (this._observer !== null) {
        this._observer.disconnect();
        this._observer = null;
      }

      _get(GSCNotesSmall.prototype.__proto__ || Object.getPrototypeOf(GSCNotesSmall.prototype), 'clear', this).call(this);
    }
  }, {
    key: 'createOnboarding',
    value: function createOnboarding(cell) {
      return null;
    }
  }, {
    key: 'showOnboarding',
    value: function showOnboarding() {}
  }, {
    key: 'stateConnected',
    value: function stateConnected() {
      if (!this.beforeStateChange(GSCBase.STATE_CONNECTED)) {
        return;
      }

      var rootElement = document.querySelector('#wmx_gwt_feature_DASHBOARD');

      if (rootElement) {
        this._observer = new MutationObserver(this.processStateConnectedDOMChange);
        this._observer.observe(rootElement, { childList: true, subtree: true });

        this.createConnectedElements();
        this.updateConnectedElements();
      }

      this._currentState = GSCBase.STATE_CONNECTED;
    }
  }, {
    key: 'createConnectedElements',
    value: function createConnectedElements() {
      if (!this._configuration.gsc.notes) {
        return;
      }

      var rootElement = document.querySelector('#wmx_gwt_feature_DASHBOARD');
      if (rootElement) {
        var elementAfter = rootElement.querySelector('.JX0GPIC-ob-d');
        if (elementAfter) {
          this._counter = dom('div', { className: 'sqgsc-notes-counter' }, 'n/a');
          this._message = dom('div', { className: 'sqgsc-notes-message' }, 'Data not available');
          this._container = dom('div', { className: 'sqgsc-notes-dashboard' }, [this._counter, this._message]);

          elementAfter.parentNode.insertBefore(this._container, elementAfter);
          this._elements.push(this._counter);
          this._elements.push(this._message);
          this._elements.push(this._container);
        }
      }
    }
  }, {
    key: 'updateConnectedElements',
    value: function updateConnectedElements() {
      if (!this._configuration.gsc.notes) {
        return;
      }

      if (this._dateRangeDetector === null) {
        this._dateRangeDetector = new GSCNotesDateRange();
      }

      if (this._container === null) {
        this.createConnectedElements();
      }

      if (this._container !== null) {
        var minDate = this._dateRangeDetector.getMinDate();
        var maxDate = this._dateRangeDetector.getMaxDate();
        this.requestNotes(minDate, maxDate).then(this.processDataReceived).catch(this.processDataError);
      }
    }
  }, {
    key: 'requestNotes',
    value: function requestNotes(dateFrom, dateTo) {
      return this._api.getNotesList(dateFrom, dateTo);
    }
  }, {
    key: 'handleConnected',
    value: function handleConnected() {
      if (this._currentState === GSCBase.STATE_CONNECTED) {
        this.updateConnectedElements();
      } else {
        this.stateConnected();
      }
    }
  }, {
    key: 'handleDataError',
    value: function handleDataError(error) {
      console.log(error);
    }
  }, {
    key: 'handleDataReceived',
    value: function handleDataReceived(data) {
      if (this._container === null) {
        return;
      }

      if (isArray(data)) {
        dom.text(this._counter, data.length);
        if (data.length === 0) {
          dom.text(this._message, this.t('sqGSC_notes_dashboard_no_data'));
        } else {
          dom.text(this._message, this.t('sqGSC_notes_dashboard_message'));
        }
      }
    }
  }, {
    key: 'handleStateConnectedDOMChange',
    value: function handleStateConnectedDOMChange(changes) {
      var tableItems = changes.filter(function (record) {
        return record.target.previousElementSibling !== null && record.target.previousElementSibling.tagName.toLowerCase() === 'svg' && Array.from(record.addedNodes).some(function (node) {
          return node.tagName.toLowerCase() === 'table';
        });
      });
      var legendItems = changes.filter(function (record) {
        return dom.hasClass(record.target, 'legend-container');
      });
      if (legendItems.length !== 0) {
        this.createConnectedElements();
      } else if (tableItems.length !== 0) {
        this.updateConnectedElements();
      }
    }
  }]);

  return GSCNotesSmall;
}(GSCBase);

module.exports = GSCNotesSmall;

},{"../dom/main":21,"../effects/HintBox":30,"../effects/ToggleButton":33,"../lib/ignore":51,"../lib/isArray":53,"../semrush/SemrushApi":63,"./GSCBase":36,"./GSCNotesConnectedUI":39,"./GSCNotesDateRange":40,"./OnboardingGSCNotes":44}],43:[function(require,module,exports){
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

var _get = function get(object, property, receiver) {
  if (object === null) object = Function.prototype;var desc = Object.getOwnPropertyDescriptor(object, property);if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
    }
  } else if ("value" in desc) {
    return desc.value;
  } else {
    var getter = desc.get;if (getter === undefined) {
      return undefined;
    }return getter.call(receiver);
  }
};

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

function _possibleConstructorReturn(self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }return call && (typeof call === "object" || typeof call === "function") ? call : self;
}

function _inherits(subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } });if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
}

var OnboardingDropdown = require('../effects/OnboardingDropdown');

var OnboardingGSCBacklinksScore = function (_OnboardingDropdown) {
  _inherits(OnboardingGSCBacklinksScore, _OnboardingDropdown);

  function OnboardingGSCBacklinksScore() {
    _classCallCheck(this, OnboardingGSCBacklinksScore);

    return _possibleConstructorReturn(this, (OnboardingGSCBacklinksScore.__proto__ || Object.getPrototypeOf(OnboardingGSCBacklinksScore)).apply(this, arguments));
  }

  _createClass(OnboardingGSCBacklinksScore, [{
    key: 'init',
    value: function init() {
      this._translateList = [this.t('sqGSC_onboarding_ok'), this.t('sqGSC_onboarding_close'), this.t('sqGSC_onboarding_text')];
      this.config.containerClass += ' seoquake-dropdown-container__up';
      _get(OnboardingGSCBacklinksScore.prototype.__proto__ || Object.getPrototypeOf(OnboardingGSCBacklinksScore.prototype), 'init', this).call(this);
      this.body.setAttribute('data-role', 'onboarding-gsc');
    }
  }]);

  return OnboardingGSCBacklinksScore;
}(OnboardingDropdown);

module.exports = OnboardingGSCBacklinksScore;

},{"../effects/OnboardingDropdown":31}],44:[function(require,module,exports){
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

var _get = function get(object, property, receiver) {
  if (object === null) object = Function.prototype;var desc = Object.getOwnPropertyDescriptor(object, property);if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
    }
  } else if ("value" in desc) {
    return desc.value;
  } else {
    var getter = desc.get;if (getter === undefined) {
      return undefined;
    }return getter.call(receiver);
  }
};

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

function _possibleConstructorReturn(self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }return call && (typeof call === "object" || typeof call === "function") ? call : self;
}

function _inherits(subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } });if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
}

var OnboardingDropdown = require('../effects/OnboardingDropdown');

var OnboardingGSCNotes = function (_OnboardingDropdown) {
  _inherits(OnboardingGSCNotes, _OnboardingDropdown);

  function OnboardingGSCNotes() {
    _classCallCheck(this, OnboardingGSCNotes);

    return _possibleConstructorReturn(this, (OnboardingGSCNotes.__proto__ || Object.getPrototypeOf(OnboardingGSCNotes)).apply(this, arguments));
  }

  _createClass(OnboardingGSCNotes, [{
    key: 'init',
    value: function init() {
      this._translateList = [this.t('sqGSC_onboarding_ok'), this.t('sqGSC_onboarding_close'), this.t('sqGSC_onboarding_notes_text')];
      this.config.positionCorrection.left = -32;
      this.config.containerClass += ' seoquake-dropdown-container__right';
      _get(OnboardingGSCNotes.prototype.__proto__ || Object.getPrototypeOf(OnboardingGSCNotes.prototype), 'init', this).call(this);
      this.body.setAttribute('data-role', 'onboarding-gsc');
    }
  }]);

  return OnboardingGSCNotes;
}(OnboardingDropdown);

module.exports = OnboardingGSCNotes;

},{"../effects/OnboardingDropdown":31}],45:[function(require,module,exports){
'use strict';

function run() {
  var urlMatch = /^https:\/\/www\.google\.com\/webmasters\/tools\/(search-analytics|external-links|external-links-domain|dashboard)\?/ig;
  if (window.top !== window || document === undefined || document.location === undefined) {
    return;
  }

  var url = document.location.toString();
  var matches = urlMatch.exec(url);

  if (matches === null) {
    return;
  }

  var client = require('browser/Client');
  var GSCBackLinksScore = require('./GSCBacklinksScore');
  var GSCNotes = require('./GSCNotes');
  var GSCNotesSmall = require('./GSCNotesSmall');

  var report = null;

  if (matches.length === 2 && matches[1] === 'search-analytics') {
    report = new GSCNotes();
  } else if (matches.length === 2 && matches[1] === 'dashboard') {
    report = new GSCNotesSmall();
  } else {
    report = new GSCBackLinksScore();
  }

  report.setMessenger(client);
  report.init();
}

run();

},{"./GSCBacklinksScore":35,"./GSCNotes":37,"./GSCNotesSmall":42,"browser/Client":1}],46:[function(require,module,exports){
'use strict';

module.exports = function (string) {
  return hex_md5(string);
};

var hexcase = 0;function hex_md5(a) {
  return rstr2hex(rstr_md5(str2rstr_utf8(a)));
}function hex_hmac_md5(a, b) {
  return rstr2hex(rstr_hmac_md5(str2rstr_utf8(a), str2rstr_utf8(b)));
}function md5_vm_test() {
  return hex_md5("abc").toLowerCase() == "900150983cd24fb0d6963f7d28e17f72";
}function rstr_md5(a) {
  return binl2rstr(binl_md5(rstr2binl(a), a.length * 8));
}function rstr_hmac_md5(c, f) {
  var e = rstr2binl(c);if (e.length > 16) {
    e = binl_md5(e, c.length * 8);
  }var a = Array(16),
      d = Array(16);for (var b = 0; b < 16; b++) {
    a[b] = e[b] ^ 909522486;d[b] = e[b] ^ 1549556828;
  }var g = binl_md5(a.concat(rstr2binl(f)), 512 + f.length * 8);return binl2rstr(binl_md5(d.concat(g), 512 + 128));
}function rstr2hex(c) {
  try {
    hexcase;
  } catch (g) {
    hexcase = 0;
  }var f = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";var b = "";var a;for (var d = 0; d < c.length; d++) {
    a = c.charCodeAt(d);b += f.charAt(a >>> 4 & 15) + f.charAt(a & 15);
  }return b;
}function str2rstr_utf8(c) {
  var b = "";var d = -1;var a, e;while (++d < c.length) {
    a = c.charCodeAt(d);e = d + 1 < c.length ? c.charCodeAt(d + 1) : 0;if (55296 <= a && a <= 56319 && 56320 <= e && e <= 57343) {
      a = 65536 + ((a & 1023) << 10) + (e & 1023);d++;
    }if (a <= 127) {
      b += String.fromCharCode(a);
    } else {
      if (a <= 2047) {
        b += String.fromCharCode(192 | a >>> 6 & 31, 128 | a & 63);
      } else {
        if (a <= 65535) {
          b += String.fromCharCode(224 | a >>> 12 & 15, 128 | a >>> 6 & 63, 128 | a & 63);
        } else {
          if (a <= 2097151) {
            b += String.fromCharCode(240 | a >>> 18 & 7, 128 | a >>> 12 & 63, 128 | a >>> 6 & 63, 128 | a & 63);
          }
        }
      }
    }
  }return b;
}function rstr2binl(b) {
  var a = Array(b.length >> 2);for (var c = 0; c < a.length; c++) {
    a[c] = 0;
  }for (var c = 0; c < b.length * 8; c += 8) {
    a[c >> 5] |= (b.charCodeAt(c / 8) & 255) << c % 32;
  }return a;
}function binl2rstr(b) {
  var a = "";for (var c = 0; c < b.length * 32; c += 8) {
    a += String.fromCharCode(b[c >> 5] >>> c % 32 & 255);
  }return a;
}function binl_md5(p, k) {
  p[k >> 5] |= 128 << k % 32;p[(k + 64 >>> 9 << 4) + 14] = k;var o = 1732584193;var n = -271733879;var m = -1732584194;var l = 271733878;for (var g = 0; g < p.length; g += 16) {
    var j = o;var h = n;var f = m;var e = l;o = md5_ff(o, n, m, l, p[g + 0], 7, -680876936);l = md5_ff(l, o, n, m, p[g + 1], 12, -389564586);m = md5_ff(m, l, o, n, p[g + 2], 17, 606105819);n = md5_ff(n, m, l, o, p[g + 3], 22, -1044525330);o = md5_ff(o, n, m, l, p[g + 4], 7, -176418897);l = md5_ff(l, o, n, m, p[g + 5], 12, 1200080426);m = md5_ff(m, l, o, n, p[g + 6], 17, -1473231341);n = md5_ff(n, m, l, o, p[g + 7], 22, -45705983);o = md5_ff(o, n, m, l, p[g + 8], 7, 1770035416);l = md5_ff(l, o, n, m, p[g + 9], 12, -1958414417);m = md5_ff(m, l, o, n, p[g + 10], 17, -42063);n = md5_ff(n, m, l, o, p[g + 11], 22, -1990404162);o = md5_ff(o, n, m, l, p[g + 12], 7, 1804603682);l = md5_ff(l, o, n, m, p[g + 13], 12, -40341101);m = md5_ff(m, l, o, n, p[g + 14], 17, -1502002290);n = md5_ff(n, m, l, o, p[g + 15], 22, 1236535329);o = md5_gg(o, n, m, l, p[g + 1], 5, -165796510);l = md5_gg(l, o, n, m, p[g + 6], 9, -1069501632);m = md5_gg(m, l, o, n, p[g + 11], 14, 643717713);n = md5_gg(n, m, l, o, p[g + 0], 20, -373897302);o = md5_gg(o, n, m, l, p[g + 5], 5, -701558691);l = md5_gg(l, o, n, m, p[g + 10], 9, 38016083);m = md5_gg(m, l, o, n, p[g + 15], 14, -660478335);n = md5_gg(n, m, l, o, p[g + 4], 20, -405537848);o = md5_gg(o, n, m, l, p[g + 9], 5, 568446438);l = md5_gg(l, o, n, m, p[g + 14], 9, -1019803690);m = md5_gg(m, l, o, n, p[g + 3], 14, -187363961);n = md5_gg(n, m, l, o, p[g + 8], 20, 1163531501);o = md5_gg(o, n, m, l, p[g + 13], 5, -1444681467);l = md5_gg(l, o, n, m, p[g + 2], 9, -51403784);m = md5_gg(m, l, o, n, p[g + 7], 14, 1735328473);n = md5_gg(n, m, l, o, p[g + 12], 20, -1926607734);o = md5_hh(o, n, m, l, p[g + 5], 4, -378558);l = md5_hh(l, o, n, m, p[g + 8], 11, -2022574463);m = md5_hh(m, l, o, n, p[g + 11], 16, 1839030562);n = md5_hh(n, m, l, o, p[g + 14], 23, -35309556);o = md5_hh(o, n, m, l, p[g + 1], 4, -1530992060);l = md5_hh(l, o, n, m, p[g + 4], 11, 1272893353);m = md5_hh(m, l, o, n, p[g + 7], 16, -155497632);n = md5_hh(n, m, l, o, p[g + 10], 23, -1094730640);o = md5_hh(o, n, m, l, p[g + 13], 4, 681279174);l = md5_hh(l, o, n, m, p[g + 0], 11, -358537222);m = md5_hh(m, l, o, n, p[g + 3], 16, -722521979);n = md5_hh(n, m, l, o, p[g + 6], 23, 76029189);o = md5_hh(o, n, m, l, p[g + 9], 4, -640364487);l = md5_hh(l, o, n, m, p[g + 12], 11, -421815835);m = md5_hh(m, l, o, n, p[g + 15], 16, 530742520);n = md5_hh(n, m, l, o, p[g + 2], 23, -995338651);o = md5_ii(o, n, m, l, p[g + 0], 6, -198630844);l = md5_ii(l, o, n, m, p[g + 7], 10, 1126891415);m = md5_ii(m, l, o, n, p[g + 14], 15, -1416354905);n = md5_ii(n, m, l, o, p[g + 5], 21, -57434055);o = md5_ii(o, n, m, l, p[g + 12], 6, 1700485571);l = md5_ii(l, o, n, m, p[g + 3], 10, -1894986606);m = md5_ii(m, l, o, n, p[g + 10], 15, -1051523);n = md5_ii(n, m, l, o, p[g + 1], 21, -2054922799);o = md5_ii(o, n, m, l, p[g + 8], 6, 1873313359);l = md5_ii(l, o, n, m, p[g + 15], 10, -30611744);m = md5_ii(m, l, o, n, p[g + 6], 15, -1560198380);n = md5_ii(n, m, l, o, p[g + 13], 21, 1309151649);o = md5_ii(o, n, m, l, p[g + 4], 6, -145523070);l = md5_ii(l, o, n, m, p[g + 11], 10, -1120210379);m = md5_ii(m, l, o, n, p[g + 2], 15, 718787259);n = md5_ii(n, m, l, o, p[g + 9], 21, -343485551);o = safe_add(o, j);n = safe_add(n, h);m = safe_add(m, f);l = safe_add(l, e);
  }return Array(o, n, m, l);
}function md5_cmn(h, e, d, c, g, f) {
  return safe_add(bit_rol(safe_add(safe_add(e, h), safe_add(c, f)), g), d);
}function md5_ff(g, f, k, j, e, i, h) {
  return md5_cmn(f & k | ~f & j, g, f, e, i, h);
}function md5_gg(g, f, k, j, e, i, h) {
  return md5_cmn(f & j | k & ~j, g, f, e, i, h);
}function md5_hh(g, f, k, j, e, i, h) {
  return md5_cmn(f ^ k ^ j, g, f, e, i, h);
}function md5_ii(g, f, k, j, e, i, h) {
  return md5_cmn(k ^ (f | ~j), g, f, e, i, h);
}function safe_add(a, d) {
  var c = (a & 65535) + (d & 65535);var b = (a >> 16) + (d >> 16) + (c >> 16);return b << 16 | c & 65535;
}function bit_rol(a, b) {
  return a << b | a >>> 32 - b;
};

},{}],47:[function(require,module,exports){
'use strict';

exports.$A = function (iterable) {

  var results = [];
  if (!iterable) {
    return results;
  } else if (iterable.toArray) {
    return iterable.toArray();
  } else if (iterable.length) {
    for (var i = 0, l = iterable.length; i < l; i++) {
      results.push(iterable[i]);
    }
  } else {
    for (var key in iterable) {
      if (iterable.hasOwnProperty(key)) {
        results.push(iterable[key]);
      }
    }
  }

  return results;
};

if (!Array.from) {
  Array.from = exports.$A;
}

},{}],48:[function(require,module,exports){
'use strict';

var isArray = require('./isArray');

module.exports = function containsText(string, pattern) {
  if (string === undefined || string === null || !string.indexOf) {
    return false;
  }

  if (isArray(pattern)) {
    return pattern.some(function (pat) {
      return string.indexOf(pat) !== -1;
    });
  }

  return string.indexOf(pattern) !== -1;
};

},{"./isArray":53}],49:[function(require,module,exports){
'use strict';

module.exports = function endsWith(string, pattern) {
  if (string === undefined || string === null || !string.indexOf) {
    return false;
  }

  if (pattern === undefined || pattern === null || !pattern.indexOf) {
    return false;
  }

  var d = string.length - pattern.length;
  return d >= 0 && string.lastIndexOf(pattern) === d;
};

},{}],50:[function(require,module,exports){
(function (global){
'use strict';

module.exports = function getUUID() {
  var d = new Date().getTime();

  if (global.performance && typeof global.performance.now === 'function') {
    d += performance.now();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === 'x' ? r : r & 0x3 | 0x8).toString(16);
  });
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],51:[function(require,module,exports){
'use strict';

module.exports = function ignore(reason) {
  console.log(reason);
};

},{}],52:[function(require,module,exports){
'use strict';

module.exports = function ip2long(ip) {
  var ips = ip.split('.');
  var iplong = void 0;

  if (ips.length !== 4) {
    return null;
  }

  iplong = ips[0] * Math.pow(256, 3) + ips[1] * Math.pow(256, 2) + ips[2] * Math.pow(256, 1) + ips[3] * Math.pow(256, 0);

  return iplong;
};

},{}],53:[function(require,module,exports){
'use strict';

module.exports = function isArray(obj) {
  return Object.prototype.toString.call(obj) === '[object Array]';
};

},{}],54:[function(require,module,exports){
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

},{}],55:[function(require,module,exports){
'use strict';

module.exports = function isFunction(obj) {
  return Object.prototype.toString.call(obj) === '[object Function]';
};

},{}],56:[function(require,module,exports){
'use strict';

module.exports = function isObject(obj) {
  var key;

  if (!obj || Object.prototype.toString.call(obj) !== '[object Object]' || obj.nodeType || obj.setInterval) {
    return false;
  }

  if (obj.constructor && !hasOwnProperty.call(obj, 'constructor') && !hasOwnProperty.call(obj.constructor.prototype, 'isPrototypeOf')) {
    return false;
  }

  for (key in obj) {}

  return key === undefined || hasOwnProperty.call(obj, key);
};

},{}],57:[function(require,module,exports){
'use strict';

module.exports = function isString(value) {
  return value instanceof String || typeof value === 'string';
};

},{}],58:[function(require,module,exports){
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

},{}],59:[function(require,module,exports){
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

},{"./isEmpty":54}],60:[function(require,module,exports){
'use strict';

var hexMd5 = require('../hex-md5');

module.exports = function shortHash(input) {
  return hexMd5(input).substr(0, 8);
};

},{"../hex-md5":46}],61:[function(require,module,exports){
'use strict';

module.exports = function startsWith(string, pattern) {
  if (string === undefined || string === null || !string.indexOf) {
    return false;
  }

  return string.indexOf(pattern) === 0;
};

},{}],62:[function(require,module,exports){
'use strict';

module.exports = function trimHash(url) {
  var result = url;
  var hashPosition = url.indexOf('#');
  if (hashPosition !== -1) {
    result = url.substring(0, hashPosition);
  }

  return result;
};

},{}],63:[function(require,module,exports){
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

var isEmpty = require('../lib/isEmpty');

var SemrushApi = function () {
  function SemrushApi() {
    _classCallCheck(this, SemrushApi);
  }

  _createClass(SemrushApi, [{
    key: '_simpleRequest',
    value: function _simpleRequest(data) {
      return this.sendMessage('sq.semrushRequest', data).then(function (result) {
        if (!isEmpty(result, 'error')) {
          throw new Error(result.error);
        }

        if (!isEmpty(result, 'data')) {
          return result.data;
        }

        return true;
      });
    }
  }, {
    key: 'logout',
    value: function logout() {
      this.sendMessage('sq.semrushRequest', { action: 'logout' });
    }
  }, {
    key: 'getAccountData',
    value: function getAccountData() {
      return this._simpleRequest({ action: 'getUser' });
    }
  }, {
    key: 'getIsConnected',
    value: function getIsConnected() {
      return this._simpleRequest({ action: 'isConnected' });
    }
  }, {
    key: 'getBillingData',
    value: function getBillingData() {
      return this._simpleRequest({ action: 'getBillingData' });
    }
  }, {
    key: 'getProjectsList',
    value: function getProjectsList(cached) {
      var action = cached === undefined ? 'getCachedProjectsList' : 'getProjectsList';
      return this._simpleRequest({ action: action }).then(function (result) {
        if (!isEmpty(result, 'projects')) {
          return result.projects;
        } else {
          throw 'Wrong answer';
        }
      });
    }
  }, {
    key: 'getPageAudit',
    value: function getPageAudit(project, page) {
      return this._simpleRequest({ action: 'getPageAudit', project: project, page: page });
    }
  }, {
    key: 'getBacklinks',
    value: function getBacklinks(type, target) {
      return this.sendMessage('sq.semrushRequest', { action: 'getBacklinks', type: type, target: target }).then(function (result) {
        if (!isEmpty(result, 'error')) {
          result.url = target;
          return result;
        }

        if (!isEmpty(result, 'data')) {
          var answer = result.data;
          answer.url = target;
          return answer;
        }

        return true;
      });
    }
  }, {
    key: 'getDisplayAdvertising',
    value: function getDisplayAdvertising(target) {
      if (target === '' || target === undefined) {
        return Promise.reject(new Error('No required parameter'));
      }

      return this._simpleRequest({ action: 'getDisplayAdvertising', q: target });
    }
  }, {
    key: 'getTrafficAnalytics',
    value: function getTrafficAnalytics(target) {
      if (target === '' || target === undefined) {
        return Promise.reject(new Error('No required parameter'));
      }

      return this._simpleRequest({ action: 'getTrafficAnalytics', q: target });
    }
  }, {
    key: 'getNotesList',
    value: function getNotesList(dateFrom, dateTo) {
      if (!(dateFrom instanceof Date) || !(dateTo instanceof Date)) {
        return Promise.reject(new Error('Date range should be Date'));
      }

      return this._simpleRequest({ action: 'getNotesList', from: dateFrom.toISOString(), to: dateTo.toISOString() });
    }
  }]);

  return SemrushApi;
}();

require('../utils/messengerMixin')(SemrushApi.prototype);

module.exports = SemrushApi;

},{"../lib/isEmpty":54,"../utils/messengerMixin":68}],64:[function(require,module,exports){
'use strict';

exports.SEOQUAKE_MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

exports.SEOQUAKE_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

exports.isDate = function (value, format) {
    return exports.getDateFromFormat(value, format) !== 0;
};

exports.formatDate = function (date, format) {
    var day = addZero(date.getDate());
    var month = addZero(date.getMonth() + 1);
    var yearLong = addZero(date.getFullYear());
    var yearShort = addZero(date.getFullYear().toString().substring(3, 4));
    var year = format.indexOf("yyyy") > -1 ? yearLong : yearShort;
    var hour = addZero(date.getHours());
    var minute = addZero(date.getMinutes());
    var second = addZero(date.getSeconds());
    var dateString = format.replace(/dd/g, day).replace(/MM/g, month).replace(/y{1,4}/g, year);
    dateString = dateString.replace(/hh/g, hour).replace(/mm/g, minute).replace(/ss/g, second);
    return dateString;
};

function addZero(number) {
    return (number < 10 ? "0" : "") + number;
}

function isInteger(value) {
    return value.match(/^[\d]+$/);
}

function getInt(str, i, minlength, maxlength) {
    for (var x = maxlength; x >= minlength; x--) {
        var token = str.substring(i, i + x);
        if (token.length < minlength) {
            return null;
        }
        if (isInteger(token)) {
            return token;
        }
    }
    return null;
}

exports.getDateFromFormat = function (value, format) {
    var i_val = 0;
    var i_format = 0;
    var c = "";
    var token = "";
    var token2 = "";
    var x, y, i;

    var now = new Date();
    var year = now.getYear();
    var month = now.getMonth() + 1;
    var date = 1;
    var hh = now.getHours();
    var mm = now.getMinutes();
    var ss = now.getSeconds();
    var ampm = "";

    while (i_format < format.length) {
        c = format.charAt(i_format);
        token = "";
        while (format.charAt(i_format) === c && i_format < format.length) {
            token += format.charAt(i_format++);
        }

        if (token === "yyyy" || token === "yy" || token === "y") {
            if (token === "yyyy") {
                x = 4;y = 4;
            }
            if (token === "yy") {
                x = 2;y = 2;
            }
            if (token === "y") {
                x = 2;y = 4;
            }
            year = getInt(value, i_val, x, y);
            if (year === null) {
                return 0;
            }
            i_val += year.length;
            if (year.length === 2) {
                year = parseInt(year, 10) + (year > 70 ? 1900 : 2000);
            }
        } else if (token === "MMM" || token === "NNN") {
            month = 0;
            for (i = 0; i < exports.SEOQUAKE_MONTH_NAMES.length; i++) {
                var month_name = exports.SEOQUAKE_MONTH_NAMES[i];
                if (value.substring(i_val, i_val + month_name.length).toLowerCase() === month_name.toLowerCase()) {
                    if (token === "MMM" || token === "NNN" && i > 11) {
                        month = i + 1;
                        if (month > 12) {
                            month -= 12;
                        }
                        i_val += month_name.length;
                        break;
                    }
                }
            }
            if (month < 1 || month > 12) return 0;
        } else if (token === "EE" || token === "E") {
            for (i = 0; i < exports.SEOQUAKE_DAY_NAMES.length; i++) {
                var day_name = exports.SEOQUAKE_DAY_NAMES[i];
                if (value.substring(i_val, i_val + day_name.length).toLowerCase() == day_name.toLowerCase()) {
                    i_val += day_name.length;
                    break;
                }
            }
        } else if (token === "MM" || token === "M") {
            month = getInt(value, i_val, token.length, 2);
            if (month === null || month < 1 || month > 12) {
                return 0;
            }
            i_val += month.length;
        } else if (token === "dd" || token === "d") {
            date = getInt(value, i_val, token.length, 2);
            if (date === null || date < 1 || date > 31) {
                return 0;
            }
            i_val += date.length;
        } else if (token === "hh" || token === "h") {
            hh = getInt(value, i_val, token.length, 2);
            if (hh === null || hh < 1 || hh > 12) {
                return 0;
            }
            i_val += hh.length;
        } else if (token === "HH" || token === "H") {
            hh = getInt(value, i_val, token.length, 2);
            if (hh === null || hh < 0 || hh > 23) {
                return 0;
            }
            i_val += hh.length;
        } else if (token === "KK" || token === "K") {
            hh = getInt(value, i_val, token.length, 2);
            if (hh === null || hh < 0 || hh > 11) {
                return 0;
            }
            i_val += hh.length;
        } else if (token === "kk" || token === "k") {
            hh = getInt(value, i_val, token.length, 2);
            if (hh === null || hh < 1 || hh > 24) {
                return 0;
            }
            i_val += hh.length;
            hh--;
        } else if (token === "mm" || token === "m") {
            mm = getInt(value, i_val, token.length, 2);
            if (mm === null || mm < 0 || mm > 59) {
                return 0;
            }
            i_val += mm.length;
        } else if (token === "ss" || token === "s") {
            ss = getInt(value, i_val, token.length, 2);
            if (ss === null || ss < 0 || ss > 59) {
                return 0;
            }
            i_val += ss.length;
        } else if (token === "a") {
            if (value.substring(i_val, i_val + 2).toLowerCase() === "am") {
                ampm = "AM";
            } else if (value.substring(i_val, i_val + 2).toLowerCase() === "pm") {
                ampm = "PM";
            } else {
                return 0;
            }
            i_val += 2;
        } else {
            if (value.substring(i_val, i_val + token.length) !== token) {
                return 0;
            } else {
                i_val += token.length;
            }
        }
    }

    if (i_val !== value.length) {
        return 0;
    }

    if (month === 2) {
        if (year % 4 === 0 && year % 100 !== 0 || year % 400 === 0) {
            if (date > 29) {
                return 0;
            }
        } else {
            if (date > 28) {
                return 0;
            }
        }
    }
    if ((month === 4 || month === 6 || month === 9 || month === 11) && date > 30) {
        return 0;
    }

    if (hh < 12 && ampm === "PM") {
        hh += 12;
    } else if (hh > 11 && ampm === "AM") {
        hh -= 12;
    }

    var newdate = new Date(year, month - 1, date, hh, mm, ss);
    return newdate.getTime();
};

exports.parseDate = function (value) {
    var preferEuro = arguments.length === 2 ? arguments[1] : false;
    var generalFormats = new Array("y-M-d", "MMM d, y", "MMM d,y", "y-MMM-d", "d-MMM-y", "MMM d", "d MMM y");
    var monthFirst = new Array("M/d/y", "M-d-y", "M.d.y", "MMM-d", "M/d", "M-d");
    var dateFirst = new Array("d/M/y", "d-M-y", "d.M.y", "d-MMM", "d/M", "d-M");
    var checkList = new Array(generalFormats, preferEuro ? dateFirst : monthFirst, preferEuro ? monthFirst : dateFirst);
    var d = null;
    for (var i = 0; i < checkList.length; i++) {
        var l = checkList[i];
        for (var j = 0; j < l.length; j++) {
            d = exports.getDateFromFormat(value, l[j]);
            if (d !== 0) {
                return d;
            }
        }
    }
    return null;
};

},{}],65:[function(require,module,exports){
'use strict';

var Entities = require('html-entities').AllHtmlEntities;

var entities = null;

module.exports = function () {
  if (entities === null) {
    entities = new Entities();
  }

  return entities;
};

},{"html-entities":77}],66:[function(require,module,exports){
'use strict';

var isString = require('../lib/isString');
var isFunction = require('../lib/isFunction');

var EventsMixin = {
  _initHandlers: function _initHandlers() {
    if (!this.hasOwnProperty('_eventHandlers')) {
      this._eventHandlers = new Map();
    }

    if (!this.hasOwnProperty('_eventPromises')) {
      this._eventPromises = new Map();
    }
  },

  addEventListener: function addEventListener(event, callback, once) {
    if (!isString(event)) {
      throw new Error('Argument event should be string');
    }

    if (!isFunction(callback)) {
      throw new Error('Argument callback should be function');
    }

    this._initHandlers();

    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, []);
    }

    if (once) {
      callback._eventCalledOnce = true;
    }

    this._eventHandlers.get(event).push(callback);

    if (this._eventPromises.has(event)) {
      this._eventPromises.get(event).forEach(function (value) {
        return callback(value);
      });
      this._eventPromises.delete(event);
    }
  },

  removeEventListener: function removeEventListener(event, callback) {
    if (!isString(event)) {
      throw new Error('Argument event should be string');
    }

    if (!isFunction(callback)) {
      throw new Error('Argument callback should be function');
    }

    this._initHandlers();

    if (!this._eventHandlers.has(event)) {
      return;
    }

    var i = this._eventHandlers.get(event).indexOf(callback);
    if (i === -1) {
      return;
    }

    this._eventHandlers.get(event).splice(i, 1);
  },

  hasEventListener: function hasEventListener(event) {
    if (!isString(event)) {
      throw new Error('Argument event should be string');
    }

    this._initHandlers();

    return this._eventHandlers.has(event) && this._eventHandlers.get(event).length > 0;
  },

  dispatchEvent: function dispatchEvent(event, data, promise) {
    if (!isString(event)) {
      throw new Error('Argument event should be string');
    }

    this._initHandlers();

    promise = promise || false;
    data = data === undefined ? null : data;
    if (!this._eventHandlers.has(event)) {
      if (promise) {
        if (!this._eventPromises.has(event)) {
          this._eventPromises.set(event, []);
        }

        this._eventPromises.get(event).push(data);
      }

      return;
    }

    this._eventHandlers.get(event).forEach(function (callback) {
      return callback(data);
    });

    if (this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, this._eventHandlers.get(event).filter(function (callback) {
        return !callback.hasOwnProperty('_eventCalledOnce');
      }));
    }
  },

  clearEvents: function clearEvents() {
    this._initHandlers();
    this._eventHandlers.clear();
    this._eventPromises.clear();
  }
};

module.exports = function eventsMixin(obj) {
  for (var method in EventsMixin) {
    if (EventsMixin.hasOwnProperty(method)) {
      obj[method] = EventsMixin[method];
    }
  }
};

},{"../lib/isFunction":55,"../lib/isString":57}],67:[function(require,module,exports){
'use strict';

var isEmpty = require('../lib/isEmpty');

module.exports = function messengerBaseMixin(object) {
  if (typeof object.sendMessage !== 'function') {
    object.sendMessage = function (message, data) {
      return this._sendMessage(message, data);
    };
  }

  if (typeof object._sendMessage !== 'function') {
    object._sendMessage = function (message, data) {
      var _this = this;

      if (!this._messenger) {
        return Promise.reject('No messenger provided');
      }

      return new Promise(function (resolve) {
        return _this._messenger.sendMessage(message, data, function (result) {
          return resolve(result);
        });
      });
    };
  }

  if (typeof object.setMessenger !== 'function') {
    object.setMessenger = function (messenger) {
      if (isEmpty(messenger)) {
        this._messenger = null;
        return;
      }

      this._messenger = messenger;
    };
  }

  if (typeof object.addMessageListener !== 'function') {
    object.addMessageListener = function (action, callback) {
      if (!this._messenger) {
        throw new Error('No messenger provided');
      }

      this._messenger.addMessageListener(action, callback);
    };
  }

  if (typeof object.removeMessageListener !== 'function') {
    object.removeMessageListener = function (action, callback) {
      if (!this._messenger) {
        throw new Error('No messenger provided');
      }

      this._messenger.removeMessageListener(action, callback);
    };
  }

  if (typeof object.getMessenger !== 'function') {
    object.getMessenger = function () {
      if (!this._messenger) {
        throw new Error('No messenger provided');
      }

      return this._messenger;
    };
  }
};

},{"../lib/isEmpty":54}],68:[function(require,module,exports){
'use strict';

var messengerBaseMixin = require('./messengerBaseMixin');

module.exports = function messengerMixin(object) {
  messengerBaseMixin(object);

  object.getConfiguration = function () {
    return this.sendMessage('sq.getConfiguration', null);
  };

  object.getAssetsUrl = function () {
    var _this = this;

    if (!this._messenger) {
      return Promise.reject('No messenger provided');
    }

    return new Promise(function (resolve) {
      return _this._messenger.getAssetsUrl(resolve);
    });
  };

  object.setConfiguration = function (configuration) {
    return this._sendMessage('sq.setConfiguration', configuration);
  };

  object.setConfigurationItem = function (name, value) {
    return this._sendMessage('sq.setConfigurationItem', { name: name, value: value });
  };

  object.getConfigurationItem = function (name) {
    return this._sendMessage('sq.getConfigurationItem', name);
  };

  object.updateConfiguration = function () {
    return this._sendMessage('sq.updateConfiguration');
  };

  object.getCoreState = function () {
    return this.sendMessage('sq.getCoreState', null);
  };

  object.getConfigurationBrunch = function () {
    return this.sendMessage('sq.getConfigurationBranch', null);
  };

  object.getPluginParameters = function () {
    return this.sendMessage('sq.getPluginParameters', null);
  };

  object.getParameters = function () {
    return this.sendMessage('sq.getParameters', null);
  };

  object.setParameters = function (value) {
    return this._sendMessage('sq.setParameters', value);
  };

  object.setDisabledState = function (plugin, value) {
    var _this2 = this;

    if (!this._messenger) {
      return Promise.reject('No messenger provided');
    }

    return new Promise(function (resolve) {
      return _this2._messenger.setDisabledState(plugin, value, resolve);
    });
  };

  object.registerEvent = function (category, action, label) {
    if (!this._messenger) {
      throw new Error('No messenger provided');
    }

    return this._messenger.registerEvent(category, action, label);
  };

  object.registerPage = function (page) {
    if (!this._messenger) {
      throw new Error('No messenger provided');
    }

    return this._messenger.registerPage(page);
  };
};

},{"./messengerBaseMixin":67}],69:[function(require,module,exports){
'use strict';

var messengerBaseMixin = require('./messengerBaseMixin');

module.exports = function messengerTranslateMixin(object) {
  messengerBaseMixin(object);

  if (typeof object.t !== 'function') {
    object.t = function (message) {
      var _this = this;

      if (!this._messenger) {
        throw new Error('No messenger provided');
      }

      if (!this._messenger.hasOwnProperty('t')) {
        throw new Error('Messenger without translate');
      }

      return new Promise(function (resolve, reject) {
        try {
          _this._messenger.t(message, resolve);
        } catch (reason) {
          reject(reason);
        }
      });
    };
  }
};

},{"./messengerBaseMixin":67}],70:[function(require,module,exports){
'use strict';

var ignore = require('../lib/ignore');

function replaceTextPlaceholders(text, data) {
  if (data === undefined) {
    return text;
  }

  for (var key in data) {
    if (data.hasOwnProperty(key)) {
      var regexp = new RegExp('{' + key + '}', 'g');
      text = text.replace(regexp, data[key]);
    }
  }

  return text;
}

module.exports = function translateMixin(object) {
  object.t = function (message, data) {
    var _this = this;

    this.__tmInitTranslateCache();

    if (this.__tmTranslateCache.has(message)) {
      return Promise.resolve(replaceTextPlaceholders(this.__tmTranslateCache.get(message), data));
    }

    return this.getTranslateFunction()(message).then(function (text) {
      _this.__tmTranslateCache.set(message, text);
      return replaceTextPlaceholders(text, data);
    }).catch(ignore);
  };

  object.setTranslateFunction = function (handler) {
    this.__tmTranslateFunction = handler;
  };

  object.getTranslateFunction = function () {
    if (!this.hasOwnProperty('__tmTranslateFunction')) {
      this.__tmTranslateFunction = defaultTranslation;
    }

    return this.__tmTranslateFunction;
  };

  object.__tmInitTranslateCache = function () {
    if (!this.hasOwnProperty('__tmTranslateCache')) {
      this.__tmTranslateCache = new Map();
    }
  };
};

function defaultTranslation(message) {
  return Promise.resolve(message);
}

},{"../lib/ignore":51}],71:[function(require,module,exports){
var toCamelCase = require('to-camel-case');

/**
 * Gets/Sets a DOM element property.
 *
 * @param  Object        element A DOM element.
 * @param  String|Object name    The name of a property or an object of values to set.
 * @param  String        value   The value of the property to set, or none to get the current
 *                               property value.
 * @return String                The current/new property value.
 */
function css(element, name, value) {
  if (typeof name === 'object') {
    var style = name;
    for (name in style) {
      css(element, name, style[name]);
    }
    return style;
  }
  var attribute = toCamelCase((name === 'float') ? 'cssFloat' : name);
  if (arguments.length === 3) {
    element.style[name] = value || "";
    return value;
  }
  return element.style[name];
}

module.exports = css;

},{"to-camel-case":72}],72:[function(require,module,exports){

var toSpace = require('to-space-case');


/**
 * Expose `toCamelCase`.
 */

module.exports = toCamelCase;


/**
 * Convert a `string` to camel case.
 *
 * @param {String} string
 * @return {String}
 */


function toCamelCase (string) {
  return toSpace(string).replace(/\s(\w)/g, function (matches, letter) {
    return letter.toUpperCase();
  });
}
},{"to-space-case":86}],73:[function(require,module,exports){
/**
 * DOM element value Getter/Setter.
 */

/**
 * Gets/sets DOM element value.
 *
 * @param  Object element A DOM element
 * @param  Object val     The value to set or none to get the current value.
 * @return mixed          The new/current DOM element value.
 */
function value(element, val) {
  if (arguments.length === 1) {
    return get(element);
  }
  return set(element, val);
}

/**
 * Returns the type of a DOM element.
 *
 * @param  Object element A DOM element.
 * @return String         The DOM element type.
 */
value.type = function(element) {
  var name = element.nodeName.toLowerCase();
  if (name !== "input") {
    if (name === "select" && element.multiple) {
      return "select-multiple";
    }
    return name;
  }
  var type = element.getAttribute('type');
  if (!type) {
    return "text";
  }
  return type.toLowerCase();
}

/**
 * Gets DOM element value.
 *
 * @param  Object element A DOM element
 * @return mixed          The DOM element value
 */
function get(element) {
  var name = value.type(element);
  switch (name) {
    case "checkbox":
    case "radio":
      if (!element.checked) {
        return false;
      }
      var val = element.getAttribute('value');
      return val == null ? true : val;
    case "select":
    case "select-multiple":
      var options = element.options;
      var values = [];
      for (var i = 0, len = options.length; i < len; i++) {
        if (options[i].selected) {
          values.push(options[i].value);
        }
      }
      return name === "select-multiple" ? values : values[0];
    default:
      return element.value;
  }
}

/**
 * Sets a DOM element value.
 *
 * @param  Object element A DOM element
 * @param  Object val     The value to set.
 * @return mixed          The new DOM element value.
 */
function set(element, val) {
  var name = value.type(element);
  switch (name) {
    case "checkbox":
    case "radio":
      return element.checked = val ? true : false;
    case "select":
    case "select-multiple":
      var found;
      var options = element.options;
      var values = Array.isArray(val) ? val : [val];
      for (var i = 0, leni = options.length; i < leni; i++) {
        found = 0;
        for (var j = 0, lenj = values.length; j < lenj; j++) {
          found |= values[j] === options[i].value;
        }
        options[i].selected = (found === 1);
      }
      if (name === "select") {
        return val;
      }
      return Array.isArray(val) ? val: [val];
    default:
      return element.value = val;
  }
}

module.exports = value;

},{}],74:[function(require,module,exports){
var domElementValue = require('dom-element-value');
var domElementCss = require('dom-element-css');
var toCamelCase = require('to-camel-case');

/**
 * DOM element manipulation functions.
 */

/**
 * Gets/Sets a DOM element attribute (accept dashed attribute).
 *
 * @param  Object element A DOM element.
 * @param  String name    The name of an attribute.
 * @param  String value   The value of the attribute to set, `undefined` to remove it or none
 *                        to get the current attribute value.
 * @return String         The current/new attribute value or `undefined` when removed.
 */
function attr(element, name, value) {
  name = toCamelCase(name === 'for' ? 'htmlFor' : name);
  if (arguments.length === 2) {
    return element.getAttribute(name);
  }
  if (value == null) {
    return element.removeAttribute(name);
  }
  element.setAttribute(name, value);
  return value;
}

/**
 * Gets/Sets a DOM element attribute with a specified namespace (accept dashed attribute).
 *
 * @param  Object element A DOM element.
 * @param  String name    The name of an attribute.
 * @param  String value   The value of the attribute to set, `undefined` to remove it or none
 *                        to get the current attribute value.
 * @return String         The current/new attribute value or `undefined` when removed.
 */
function attrNS(element, ns, name, value) {
  name = toCamelCase(name);
  if (arguments.length === 3) {
    return element.getAttributeNS(ns, name);
  }
  if (value == null) {
    return element.removeAttributeNS(ns, name);
  }
  element.setAttributeNS(ns, name, value);
  return value;
}

/**
 * Gets/Sets a DOM element property.
 *
 * @param  Object element A DOM element.
 * @param  String name    The name of a property.
 * @param  String value   The value of the property to set, or none to get the current
 *                        property value.
 * @return String         The current/new property value.
 */
function prop(element, name, value){
  if (arguments.length === 2) {
    return element[name];
  }
  return element[name] = value;
}

/**
 * Gets/Sets a DOM element attribute.
 *
 * @param  Object element A DOM element.
 * @param  String name    The name of an attribute.
 * @param  String value   The value of the attribute to set, `null` to remove it or none
 *                        to get the current attribute value.
 * @return String         The current/new attribute value or `undefined` when removed.
 */
function data(element, name, value) {
  if (arguments.length === 3) {
    return attr(element, "data-" + name, value);
  }
  return attr(element, "data-" + name);
}

/**
 * Gets/Sets a DOM element text content.
 *
 * @param  Object element A DOM element.
 * @param  String value   The text value to set or none to get the current text content value.
 * @return String         The current/new text content.
 */
function text(element, value) {
  var text = (element.textContent !== undefined ? 'textContent' : 'innerText')

  if (arguments.length === 1) {
    return element[text];
  }
  return element[text] = value
}

/**
 * Checks if an element has a class.
 *
 * @param  Object  element A DOM element.
 * @param  String  name    A class name.
 * @return Boolean         Returns `true` if the element has the `name` class, `false` otherwise.
 */
function hasClass(element, name) {
  return element.classList.contains(name);
}

/**
 * Adds a class to an element.
 *
 * @param  Object  element A DOM element.
 * @param  String  name    The class to add.
 */
function addClass(element, name) {
  element.classList.add(name);
}

/**
 * Removes a class from an element.
 *
 * @param  Object  element A DOM element.
 * @param  String  name    The class to remove.
 */
function removeClass(element, name) {
  element.classList.remove(name);
}

/**
 * Toggles a class.
 *
 * @param  Object  element A DOM element.
 * @param  String  name    The class to toggle.
 */
function toggleClass(element, name) {
  var fn = hasClass(element, name) ? removeClass : addClass;
  fn(element, name);
}

module.exports = {
  attr: attr,
  attrNS: attrNS,
  prop: prop,
  css: domElementCss,
  type: domElementValue.type,
  data: data,
  text: text,
  value: domElementValue,
  hasClass: hasClass,
  addClass: addClass,
  removeClass: removeClass,
  toggleClass: toggleClass
};

},{"dom-element-css":71,"dom-element-value":73,"to-camel-case":75}],75:[function(require,module,exports){
arguments[4][72][0].apply(exports,arguments)
},{"dup":72,"to-space-case":86}],76:[function(require,module,exports){
'use strict';

var hasOwn = Object.prototype.hasOwnProperty;
var toStr = Object.prototype.toString;

var isArray = function isArray(arr) {
	if (typeof Array.isArray === 'function') {
		return Array.isArray(arr);
	}

	return toStr.call(arr) === '[object Array]';
};

var isPlainObject = function isPlainObject(obj) {
	if (!obj || toStr.call(obj) !== '[object Object]') {
		return false;
	}

	var hasOwnConstructor = hasOwn.call(obj, 'constructor');
	var hasIsPrototypeOf = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
	// Not own constructor property must be Object
	if (obj.constructor && !hasOwnConstructor && !hasIsPrototypeOf) {
		return false;
	}

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.
	var key;
	for (key in obj) {/**/}

	return typeof key === 'undefined' || hasOwn.call(obj, key);
};

module.exports = function extend() {
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0],
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if (typeof target === 'boolean') {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	} else if ((typeof target !== 'object' && typeof target !== 'function') || target == null) {
		target = {};
	}

	for (; i < length; ++i) {
		options = arguments[i];
		// Only deal with non-null/undefined values
		if (options != null) {
			// Extend the base object
			for (name in options) {
				src = target[name];
				copy = options[name];

				// Prevent never-ending loop
				if (target !== copy) {
					// Recurse if we're merging plain objects or arrays
					if (deep && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)))) {
						if (copyIsArray) {
							copyIsArray = false;
							clone = src && isArray(src) ? src : [];
						} else {
							clone = src && isPlainObject(src) ? src : {};
						}

						// Never move original objects, clone them
						target[name] = extend(deep, clone, copy);

					// Don't bring in undefined values
					} else if (typeof copy !== 'undefined') {
						target[name] = copy;
					}
				}
			}
		}
	}

	// Return the modified object
	return target;
};


},{}],77:[function(require,module,exports){
module.exports = {
  XmlEntities: require('./lib/xml-entities.js'),
  Html4Entities: require('./lib/html4-entities.js'),
  Html5Entities: require('./lib/html5-entities.js'),
  AllHtmlEntities: require('./lib/html5-entities.js')
};

},{"./lib/html4-entities.js":78,"./lib/html5-entities.js":79,"./lib/xml-entities.js":80}],78:[function(require,module,exports){
var HTML_ALPHA = ['apos', 'nbsp', 'iexcl', 'cent', 'pound', 'curren', 'yen', 'brvbar', 'sect', 'uml', 'copy', 'ordf', 'laquo', 'not', 'shy', 'reg', 'macr', 'deg', 'plusmn', 'sup2', 'sup3', 'acute', 'micro', 'para', 'middot', 'cedil', 'sup1', 'ordm', 'raquo', 'frac14', 'frac12', 'frac34', 'iquest', 'Agrave', 'Aacute', 'Acirc', 'Atilde', 'Auml', 'Aring', 'Aelig', 'Ccedil', 'Egrave', 'Eacute', 'Ecirc', 'Euml', 'Igrave', 'Iacute', 'Icirc', 'Iuml', 'ETH', 'Ntilde', 'Ograve', 'Oacute', 'Ocirc', 'Otilde', 'Ouml', 'times', 'Oslash', 'Ugrave', 'Uacute', 'Ucirc', 'Uuml', 'Yacute', 'THORN', 'szlig', 'agrave', 'aacute', 'acirc', 'atilde', 'auml', 'aring', 'aelig', 'ccedil', 'egrave', 'eacute', 'ecirc', 'euml', 'igrave', 'iacute', 'icirc', 'iuml', 'eth', 'ntilde', 'ograve', 'oacute', 'ocirc', 'otilde', 'ouml', 'divide', 'Oslash', 'ugrave', 'uacute', 'ucirc', 'uuml', 'yacute', 'thorn', 'yuml', 'quot', 'amp', 'lt', 'gt', 'oelig', 'oelig', 'scaron', 'scaron', 'yuml', 'circ', 'tilde', 'ensp', 'emsp', 'thinsp', 'zwnj', 'zwj', 'lrm', 'rlm', 'ndash', 'mdash', 'lsquo', 'rsquo', 'sbquo', 'ldquo', 'rdquo', 'bdquo', 'dagger', 'dagger', 'permil', 'lsaquo', 'rsaquo', 'euro', 'fnof', 'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega', 'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi', 'rho', 'sigmaf', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega', 'thetasym', 'upsih', 'piv', 'bull', 'hellip', 'prime', 'prime', 'oline', 'frasl', 'weierp', 'image', 'real', 'trade', 'alefsym', 'larr', 'uarr', 'rarr', 'darr', 'harr', 'crarr', 'larr', 'uarr', 'rarr', 'darr', 'harr', 'forall', 'part', 'exist', 'empty', 'nabla', 'isin', 'notin', 'ni', 'prod', 'sum', 'minus', 'lowast', 'radic', 'prop', 'infin', 'ang', 'and', 'or', 'cap', 'cup', 'int', 'there4', 'sim', 'cong', 'asymp', 'ne', 'equiv', 'le', 'ge', 'sub', 'sup', 'nsub', 'sube', 'supe', 'oplus', 'otimes', 'perp', 'sdot', 'lceil', 'rceil', 'lfloor', 'rfloor', 'lang', 'rang', 'loz', 'spades', 'clubs', 'hearts', 'diams'];
var HTML_CODES = [39, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, 255, 34, 38, 60, 62, 338, 339, 352, 353, 376, 710, 732, 8194, 8195, 8201, 8204, 8205, 8206, 8207, 8211, 8212, 8216, 8217, 8218, 8220, 8221, 8222, 8224, 8225, 8240, 8249, 8250, 8364, 402, 913, 914, 915, 916, 917, 918, 919, 920, 921, 922, 923, 924, 925, 926, 927, 928, 929, 931, 932, 933, 934, 935, 936, 937, 945, 946, 947, 948, 949, 950, 951, 952, 953, 954, 955, 956, 957, 958, 959, 960, 961, 962, 963, 964, 965, 966, 967, 968, 969, 977, 978, 982, 8226, 8230, 8242, 8243, 8254, 8260, 8472, 8465, 8476, 8482, 8501, 8592, 8593, 8594, 8595, 8596, 8629, 8656, 8657, 8658, 8659, 8660, 8704, 8706, 8707, 8709, 8711, 8712, 8713, 8715, 8719, 8721, 8722, 8727, 8730, 8733, 8734, 8736, 8743, 8744, 8745, 8746, 8747, 8756, 8764, 8773, 8776, 8800, 8801, 8804, 8805, 8834, 8835, 8836, 8838, 8839, 8853, 8855, 8869, 8901, 8968, 8969, 8970, 8971, 9001, 9002, 9674, 9824, 9827, 9829, 9830];

var alphaIndex = {};
var numIndex = {};

var i = 0;
var length = HTML_ALPHA.length;
while (i < length) {
    var a = HTML_ALPHA[i];
    var c = HTML_CODES[i];
    alphaIndex[a] = String.fromCharCode(c);
    numIndex[c] = a;
    i++;
}

/**
 * @constructor
 */
function Html4Entities() {}

/**
 * @param {String} str
 * @returns {String}
 */
Html4Entities.prototype.decode = function(str) {
    if (str.length === 0) {
        return '';
    }
    return str.replace(/&(#?[\w\d]+);?/g, function(s, entity) {
        var chr;
        if (entity.charAt(0) === "#") {
            var code = entity.charAt(1).toLowerCase() === 'x' ?
                parseInt(entity.substr(2), 16) :
                parseInt(entity.substr(1));

            if (!(isNaN(code) || code < -32768 || code > 65535)) {
                chr = String.fromCharCode(code);
            }
        } else {
            chr = alphaIndex[entity];
        }
        return chr || s;
    });
};

/**
 * @param {String} str
 * @returns {String}
 */
Html4Entities.decode = function(str) {
    return new Html4Entities().decode(str);
};

/**
 * @param {String} str
 * @returns {String}
 */
Html4Entities.prototype.encode = function(str) {
    var strLength = str.length;
    if (strLength === 0) {
        return '';
    }
    var result = '';
    var i = 0;
    while (i < strLength) {
        var alpha = numIndex[str.charCodeAt(i)];
        result += alpha ? "&" + alpha + ";" : str.charAt(i);
        i++;
    }
    return result;
};

/**
 * @param {String} str
 * @returns {String}
 */
Html4Entities.encode = function(str) {
    return new Html4Entities().encode(str);
};

/**
 * @param {String} str
 * @returns {String}
 */
Html4Entities.prototype.encodeNonUTF = function(str) {
    var strLength = str.length;
    if (strLength === 0) {
        return '';
    }
    var result = '';
    var i = 0;
    while (i < strLength) {
        var cc = str.charCodeAt(i);
        var alpha = numIndex[cc];
        if (alpha) {
            result += "&" + alpha + ";";
        } else if (cc < 32 || cc > 126) {
            result += "&#" + cc + ";";
        } else {
            result += str.charAt(i);
        }
        i++;
    }
    return result;
};

/**
 * @param {String} str
 * @returns {String}
 */
Html4Entities.encodeNonUTF = function(str) {
    return new Html4Entities().encodeNonUTF(str);
};

/**
 * @param {String} str
 * @returns {String}
 */
Html4Entities.prototype.encodeNonASCII = function(str) {
    var strLength = str.length;
    if (strLength === 0) {
        return '';
    }
    var result = '';
    var i = 0;
    while (i < strLength) {
        var c = str.charCodeAt(i);
        if (c <= 255) {
            result += str[i++];
            continue;
        }
        result += '&#' + c + ';';
        i++;
    }
    return result;
};

/**
 * @param {String} str
 * @returns {String}
 */
Html4Entities.encodeNonASCII = function(str) {
    return new Html4Entities().encodeNonASCII(str);
};

module.exports = Html4Entities;

},{}],79:[function(require,module,exports){
var ENTITIES = [['Aacute', [193]], ['aacute', [225]], ['Abreve', [258]], ['abreve', [259]], ['ac', [8766]], ['acd', [8767]], ['acE', [8766, 819]], ['Acirc', [194]], ['acirc', [226]], ['acute', [180]], ['Acy', [1040]], ['acy', [1072]], ['AElig', [198]], ['aelig', [230]], ['af', [8289]], ['Afr', [120068]], ['afr', [120094]], ['Agrave', [192]], ['agrave', [224]], ['alefsym', [8501]], ['aleph', [8501]], ['Alpha', [913]], ['alpha', [945]], ['Amacr', [256]], ['amacr', [257]], ['amalg', [10815]], ['amp', [38]], ['AMP', [38]], ['andand', [10837]], ['And', [10835]], ['and', [8743]], ['andd', [10844]], ['andslope', [10840]], ['andv', [10842]], ['ang', [8736]], ['ange', [10660]], ['angle', [8736]], ['angmsdaa', [10664]], ['angmsdab', [10665]], ['angmsdac', [10666]], ['angmsdad', [10667]], ['angmsdae', [10668]], ['angmsdaf', [10669]], ['angmsdag', [10670]], ['angmsdah', [10671]], ['angmsd', [8737]], ['angrt', [8735]], ['angrtvb', [8894]], ['angrtvbd', [10653]], ['angsph', [8738]], ['angst', [197]], ['angzarr', [9084]], ['Aogon', [260]], ['aogon', [261]], ['Aopf', [120120]], ['aopf', [120146]], ['apacir', [10863]], ['ap', [8776]], ['apE', [10864]], ['ape', [8778]], ['apid', [8779]], ['apos', [39]], ['ApplyFunction', [8289]], ['approx', [8776]], ['approxeq', [8778]], ['Aring', [197]], ['aring', [229]], ['Ascr', [119964]], ['ascr', [119990]], ['Assign', [8788]], ['ast', [42]], ['asymp', [8776]], ['asympeq', [8781]], ['Atilde', [195]], ['atilde', [227]], ['Auml', [196]], ['auml', [228]], ['awconint', [8755]], ['awint', [10769]], ['backcong', [8780]], ['backepsilon', [1014]], ['backprime', [8245]], ['backsim', [8765]], ['backsimeq', [8909]], ['Backslash', [8726]], ['Barv', [10983]], ['barvee', [8893]], ['barwed', [8965]], ['Barwed', [8966]], ['barwedge', [8965]], ['bbrk', [9141]], ['bbrktbrk', [9142]], ['bcong', [8780]], ['Bcy', [1041]], ['bcy', [1073]], ['bdquo', [8222]], ['becaus', [8757]], ['because', [8757]], ['Because', [8757]], ['bemptyv', [10672]], ['bepsi', [1014]], ['bernou', [8492]], ['Bernoullis', [8492]], ['Beta', [914]], ['beta', [946]], ['beth', [8502]], ['between', [8812]], ['Bfr', [120069]], ['bfr', [120095]], ['bigcap', [8898]], ['bigcirc', [9711]], ['bigcup', [8899]], ['bigodot', [10752]], ['bigoplus', [10753]], ['bigotimes', [10754]], ['bigsqcup', [10758]], ['bigstar', [9733]], ['bigtriangledown', [9661]], ['bigtriangleup', [9651]], ['biguplus', [10756]], ['bigvee', [8897]], ['bigwedge', [8896]], ['bkarow', [10509]], ['blacklozenge', [10731]], ['blacksquare', [9642]], ['blacktriangle', [9652]], ['blacktriangledown', [9662]], ['blacktriangleleft', [9666]], ['blacktriangleright', [9656]], ['blank', [9251]], ['blk12', [9618]], ['blk14', [9617]], ['blk34', [9619]], ['block', [9608]], ['bne', [61, 8421]], ['bnequiv', [8801, 8421]], ['bNot', [10989]], ['bnot', [8976]], ['Bopf', [120121]], ['bopf', [120147]], ['bot', [8869]], ['bottom', [8869]], ['bowtie', [8904]], ['boxbox', [10697]], ['boxdl', [9488]], ['boxdL', [9557]], ['boxDl', [9558]], ['boxDL', [9559]], ['boxdr', [9484]], ['boxdR', [9554]], ['boxDr', [9555]], ['boxDR', [9556]], ['boxh', [9472]], ['boxH', [9552]], ['boxhd', [9516]], ['boxHd', [9572]], ['boxhD', [9573]], ['boxHD', [9574]], ['boxhu', [9524]], ['boxHu', [9575]], ['boxhU', [9576]], ['boxHU', [9577]], ['boxminus', [8863]], ['boxplus', [8862]], ['boxtimes', [8864]], ['boxul', [9496]], ['boxuL', [9563]], ['boxUl', [9564]], ['boxUL', [9565]], ['boxur', [9492]], ['boxuR', [9560]], ['boxUr', [9561]], ['boxUR', [9562]], ['boxv', [9474]], ['boxV', [9553]], ['boxvh', [9532]], ['boxvH', [9578]], ['boxVh', [9579]], ['boxVH', [9580]], ['boxvl', [9508]], ['boxvL', [9569]], ['boxVl', [9570]], ['boxVL', [9571]], ['boxvr', [9500]], ['boxvR', [9566]], ['boxVr', [9567]], ['boxVR', [9568]], ['bprime', [8245]], ['breve', [728]], ['Breve', [728]], ['brvbar', [166]], ['bscr', [119991]], ['Bscr', [8492]], ['bsemi', [8271]], ['bsim', [8765]], ['bsime', [8909]], ['bsolb', [10693]], ['bsol', [92]], ['bsolhsub', [10184]], ['bull', [8226]], ['bullet', [8226]], ['bump', [8782]], ['bumpE', [10926]], ['bumpe', [8783]], ['Bumpeq', [8782]], ['bumpeq', [8783]], ['Cacute', [262]], ['cacute', [263]], ['capand', [10820]], ['capbrcup', [10825]], ['capcap', [10827]], ['cap', [8745]], ['Cap', [8914]], ['capcup', [10823]], ['capdot', [10816]], ['CapitalDifferentialD', [8517]], ['caps', [8745, 65024]], ['caret', [8257]], ['caron', [711]], ['Cayleys', [8493]], ['ccaps', [10829]], ['Ccaron', [268]], ['ccaron', [269]], ['Ccedil', [199]], ['ccedil', [231]], ['Ccirc', [264]], ['ccirc', [265]], ['Cconint', [8752]], ['ccups', [10828]], ['ccupssm', [10832]], ['Cdot', [266]], ['cdot', [267]], ['cedil', [184]], ['Cedilla', [184]], ['cemptyv', [10674]], ['cent', [162]], ['centerdot', [183]], ['CenterDot', [183]], ['cfr', [120096]], ['Cfr', [8493]], ['CHcy', [1063]], ['chcy', [1095]], ['check', [10003]], ['checkmark', [10003]], ['Chi', [935]], ['chi', [967]], ['circ', [710]], ['circeq', [8791]], ['circlearrowleft', [8634]], ['circlearrowright', [8635]], ['circledast', [8859]], ['circledcirc', [8858]], ['circleddash', [8861]], ['CircleDot', [8857]], ['circledR', [174]], ['circledS', [9416]], ['CircleMinus', [8854]], ['CirclePlus', [8853]], ['CircleTimes', [8855]], ['cir', [9675]], ['cirE', [10691]], ['cire', [8791]], ['cirfnint', [10768]], ['cirmid', [10991]], ['cirscir', [10690]], ['ClockwiseContourIntegral', [8754]], ['CloseCurlyDoubleQuote', [8221]], ['CloseCurlyQuote', [8217]], ['clubs', [9827]], ['clubsuit', [9827]], ['colon', [58]], ['Colon', [8759]], ['Colone', [10868]], ['colone', [8788]], ['coloneq', [8788]], ['comma', [44]], ['commat', [64]], ['comp', [8705]], ['compfn', [8728]], ['complement', [8705]], ['complexes', [8450]], ['cong', [8773]], ['congdot', [10861]], ['Congruent', [8801]], ['conint', [8750]], ['Conint', [8751]], ['ContourIntegral', [8750]], ['copf', [120148]], ['Copf', [8450]], ['coprod', [8720]], ['Coproduct', [8720]], ['copy', [169]], ['COPY', [169]], ['copysr', [8471]], ['CounterClockwiseContourIntegral', [8755]], ['crarr', [8629]], ['cross', [10007]], ['Cross', [10799]], ['Cscr', [119966]], ['cscr', [119992]], ['csub', [10959]], ['csube', [10961]], ['csup', [10960]], ['csupe', [10962]], ['ctdot', [8943]], ['cudarrl', [10552]], ['cudarrr', [10549]], ['cuepr', [8926]], ['cuesc', [8927]], ['cularr', [8630]], ['cularrp', [10557]], ['cupbrcap', [10824]], ['cupcap', [10822]], ['CupCap', [8781]], ['cup', [8746]], ['Cup', [8915]], ['cupcup', [10826]], ['cupdot', [8845]], ['cupor', [10821]], ['cups', [8746, 65024]], ['curarr', [8631]], ['curarrm', [10556]], ['curlyeqprec', [8926]], ['curlyeqsucc', [8927]], ['curlyvee', [8910]], ['curlywedge', [8911]], ['curren', [164]], ['curvearrowleft', [8630]], ['curvearrowright', [8631]], ['cuvee', [8910]], ['cuwed', [8911]], ['cwconint', [8754]], ['cwint', [8753]], ['cylcty', [9005]], ['dagger', [8224]], ['Dagger', [8225]], ['daleth', [8504]], ['darr', [8595]], ['Darr', [8609]], ['dArr', [8659]], ['dash', [8208]], ['Dashv', [10980]], ['dashv', [8867]], ['dbkarow', [10511]], ['dblac', [733]], ['Dcaron', [270]], ['dcaron', [271]], ['Dcy', [1044]], ['dcy', [1076]], ['ddagger', [8225]], ['ddarr', [8650]], ['DD', [8517]], ['dd', [8518]], ['DDotrahd', [10513]], ['ddotseq', [10871]], ['deg', [176]], ['Del', [8711]], ['Delta', [916]], ['delta', [948]], ['demptyv', [10673]], ['dfisht', [10623]], ['Dfr', [120071]], ['dfr', [120097]], ['dHar', [10597]], ['dharl', [8643]], ['dharr', [8642]], ['DiacriticalAcute', [180]], ['DiacriticalDot', [729]], ['DiacriticalDoubleAcute', [733]], ['DiacriticalGrave', [96]], ['DiacriticalTilde', [732]], ['diam', [8900]], ['diamond', [8900]], ['Diamond', [8900]], ['diamondsuit', [9830]], ['diams', [9830]], ['die', [168]], ['DifferentialD', [8518]], ['digamma', [989]], ['disin', [8946]], ['div', [247]], ['divide', [247]], ['divideontimes', [8903]], ['divonx', [8903]], ['DJcy', [1026]], ['djcy', [1106]], ['dlcorn', [8990]], ['dlcrop', [8973]], ['dollar', [36]], ['Dopf', [120123]], ['dopf', [120149]], ['Dot', [168]], ['dot', [729]], ['DotDot', [8412]], ['doteq', [8784]], ['doteqdot', [8785]], ['DotEqual', [8784]], ['dotminus', [8760]], ['dotplus', [8724]], ['dotsquare', [8865]], ['doublebarwedge', [8966]], ['DoubleContourIntegral', [8751]], ['DoubleDot', [168]], ['DoubleDownArrow', [8659]], ['DoubleLeftArrow', [8656]], ['DoubleLeftRightArrow', [8660]], ['DoubleLeftTee', [10980]], ['DoubleLongLeftArrow', [10232]], ['DoubleLongLeftRightArrow', [10234]], ['DoubleLongRightArrow', [10233]], ['DoubleRightArrow', [8658]], ['DoubleRightTee', [8872]], ['DoubleUpArrow', [8657]], ['DoubleUpDownArrow', [8661]], ['DoubleVerticalBar', [8741]], ['DownArrowBar', [10515]], ['downarrow', [8595]], ['DownArrow', [8595]], ['Downarrow', [8659]], ['DownArrowUpArrow', [8693]], ['DownBreve', [785]], ['downdownarrows', [8650]], ['downharpoonleft', [8643]], ['downharpoonright', [8642]], ['DownLeftRightVector', [10576]], ['DownLeftTeeVector', [10590]], ['DownLeftVectorBar', [10582]], ['DownLeftVector', [8637]], ['DownRightTeeVector', [10591]], ['DownRightVectorBar', [10583]], ['DownRightVector', [8641]], ['DownTeeArrow', [8615]], ['DownTee', [8868]], ['drbkarow', [10512]], ['drcorn', [8991]], ['drcrop', [8972]], ['Dscr', [119967]], ['dscr', [119993]], ['DScy', [1029]], ['dscy', [1109]], ['dsol', [10742]], ['Dstrok', [272]], ['dstrok', [273]], ['dtdot', [8945]], ['dtri', [9663]], ['dtrif', [9662]], ['duarr', [8693]], ['duhar', [10607]], ['dwangle', [10662]], ['DZcy', [1039]], ['dzcy', [1119]], ['dzigrarr', [10239]], ['Eacute', [201]], ['eacute', [233]], ['easter', [10862]], ['Ecaron', [282]], ['ecaron', [283]], ['Ecirc', [202]], ['ecirc', [234]], ['ecir', [8790]], ['ecolon', [8789]], ['Ecy', [1069]], ['ecy', [1101]], ['eDDot', [10871]], ['Edot', [278]], ['edot', [279]], ['eDot', [8785]], ['ee', [8519]], ['efDot', [8786]], ['Efr', [120072]], ['efr', [120098]], ['eg', [10906]], ['Egrave', [200]], ['egrave', [232]], ['egs', [10902]], ['egsdot', [10904]], ['el', [10905]], ['Element', [8712]], ['elinters', [9191]], ['ell', [8467]], ['els', [10901]], ['elsdot', [10903]], ['Emacr', [274]], ['emacr', [275]], ['empty', [8709]], ['emptyset', [8709]], ['EmptySmallSquare', [9723]], ['emptyv', [8709]], ['EmptyVerySmallSquare', [9643]], ['emsp13', [8196]], ['emsp14', [8197]], ['emsp', [8195]], ['ENG', [330]], ['eng', [331]], ['ensp', [8194]], ['Eogon', [280]], ['eogon', [281]], ['Eopf', [120124]], ['eopf', [120150]], ['epar', [8917]], ['eparsl', [10723]], ['eplus', [10865]], ['epsi', [949]], ['Epsilon', [917]], ['epsilon', [949]], ['epsiv', [1013]], ['eqcirc', [8790]], ['eqcolon', [8789]], ['eqsim', [8770]], ['eqslantgtr', [10902]], ['eqslantless', [10901]], ['Equal', [10869]], ['equals', [61]], ['EqualTilde', [8770]], ['equest', [8799]], ['Equilibrium', [8652]], ['equiv', [8801]], ['equivDD', [10872]], ['eqvparsl', [10725]], ['erarr', [10609]], ['erDot', [8787]], ['escr', [8495]], ['Escr', [8496]], ['esdot', [8784]], ['Esim', [10867]], ['esim', [8770]], ['Eta', [919]], ['eta', [951]], ['ETH', [208]], ['eth', [240]], ['Euml', [203]], ['euml', [235]], ['euro', [8364]], ['excl', [33]], ['exist', [8707]], ['Exists', [8707]], ['expectation', [8496]], ['exponentiale', [8519]], ['ExponentialE', [8519]], ['fallingdotseq', [8786]], ['Fcy', [1060]], ['fcy', [1092]], ['female', [9792]], ['ffilig', [64259]], ['fflig', [64256]], ['ffllig', [64260]], ['Ffr', [120073]], ['ffr', [120099]], ['filig', [64257]], ['FilledSmallSquare', [9724]], ['FilledVerySmallSquare', [9642]], ['fjlig', [102, 106]], ['flat', [9837]], ['fllig', [64258]], ['fltns', [9649]], ['fnof', [402]], ['Fopf', [120125]], ['fopf', [120151]], ['forall', [8704]], ['ForAll', [8704]], ['fork', [8916]], ['forkv', [10969]], ['Fouriertrf', [8497]], ['fpartint', [10765]], ['frac12', [189]], ['frac13', [8531]], ['frac14', [188]], ['frac15', [8533]], ['frac16', [8537]], ['frac18', [8539]], ['frac23', [8532]], ['frac25', [8534]], ['frac34', [190]], ['frac35', [8535]], ['frac38', [8540]], ['frac45', [8536]], ['frac56', [8538]], ['frac58', [8541]], ['frac78', [8542]], ['frasl', [8260]], ['frown', [8994]], ['fscr', [119995]], ['Fscr', [8497]], ['gacute', [501]], ['Gamma', [915]], ['gamma', [947]], ['Gammad', [988]], ['gammad', [989]], ['gap', [10886]], ['Gbreve', [286]], ['gbreve', [287]], ['Gcedil', [290]], ['Gcirc', [284]], ['gcirc', [285]], ['Gcy', [1043]], ['gcy', [1075]], ['Gdot', [288]], ['gdot', [289]], ['ge', [8805]], ['gE', [8807]], ['gEl', [10892]], ['gel', [8923]], ['geq', [8805]], ['geqq', [8807]], ['geqslant', [10878]], ['gescc', [10921]], ['ges', [10878]], ['gesdot', [10880]], ['gesdoto', [10882]], ['gesdotol', [10884]], ['gesl', [8923, 65024]], ['gesles', [10900]], ['Gfr', [120074]], ['gfr', [120100]], ['gg', [8811]], ['Gg', [8921]], ['ggg', [8921]], ['gimel', [8503]], ['GJcy', [1027]], ['gjcy', [1107]], ['gla', [10917]], ['gl', [8823]], ['glE', [10898]], ['glj', [10916]], ['gnap', [10890]], ['gnapprox', [10890]], ['gne', [10888]], ['gnE', [8809]], ['gneq', [10888]], ['gneqq', [8809]], ['gnsim', [8935]], ['Gopf', [120126]], ['gopf', [120152]], ['grave', [96]], ['GreaterEqual', [8805]], ['GreaterEqualLess', [8923]], ['GreaterFullEqual', [8807]], ['GreaterGreater', [10914]], ['GreaterLess', [8823]], ['GreaterSlantEqual', [10878]], ['GreaterTilde', [8819]], ['Gscr', [119970]], ['gscr', [8458]], ['gsim', [8819]], ['gsime', [10894]], ['gsiml', [10896]], ['gtcc', [10919]], ['gtcir', [10874]], ['gt', [62]], ['GT', [62]], ['Gt', [8811]], ['gtdot', [8919]], ['gtlPar', [10645]], ['gtquest', [10876]], ['gtrapprox', [10886]], ['gtrarr', [10616]], ['gtrdot', [8919]], ['gtreqless', [8923]], ['gtreqqless', [10892]], ['gtrless', [8823]], ['gtrsim', [8819]], ['gvertneqq', [8809, 65024]], ['gvnE', [8809, 65024]], ['Hacek', [711]], ['hairsp', [8202]], ['half', [189]], ['hamilt', [8459]], ['HARDcy', [1066]], ['hardcy', [1098]], ['harrcir', [10568]], ['harr', [8596]], ['hArr', [8660]], ['harrw', [8621]], ['Hat', [94]], ['hbar', [8463]], ['Hcirc', [292]], ['hcirc', [293]], ['hearts', [9829]], ['heartsuit', [9829]], ['hellip', [8230]], ['hercon', [8889]], ['hfr', [120101]], ['Hfr', [8460]], ['HilbertSpace', [8459]], ['hksearow', [10533]], ['hkswarow', [10534]], ['hoarr', [8703]], ['homtht', [8763]], ['hookleftarrow', [8617]], ['hookrightarrow', [8618]], ['hopf', [120153]], ['Hopf', [8461]], ['horbar', [8213]], ['HorizontalLine', [9472]], ['hscr', [119997]], ['Hscr', [8459]], ['hslash', [8463]], ['Hstrok', [294]], ['hstrok', [295]], ['HumpDownHump', [8782]], ['HumpEqual', [8783]], ['hybull', [8259]], ['hyphen', [8208]], ['Iacute', [205]], ['iacute', [237]], ['ic', [8291]], ['Icirc', [206]], ['icirc', [238]], ['Icy', [1048]], ['icy', [1080]], ['Idot', [304]], ['IEcy', [1045]], ['iecy', [1077]], ['iexcl', [161]], ['iff', [8660]], ['ifr', [120102]], ['Ifr', [8465]], ['Igrave', [204]], ['igrave', [236]], ['ii', [8520]], ['iiiint', [10764]], ['iiint', [8749]], ['iinfin', [10716]], ['iiota', [8489]], ['IJlig', [306]], ['ijlig', [307]], ['Imacr', [298]], ['imacr', [299]], ['image', [8465]], ['ImaginaryI', [8520]], ['imagline', [8464]], ['imagpart', [8465]], ['imath', [305]], ['Im', [8465]], ['imof', [8887]], ['imped', [437]], ['Implies', [8658]], ['incare', [8453]], ['in', [8712]], ['infin', [8734]], ['infintie', [10717]], ['inodot', [305]], ['intcal', [8890]], ['int', [8747]], ['Int', [8748]], ['integers', [8484]], ['Integral', [8747]], ['intercal', [8890]], ['Intersection', [8898]], ['intlarhk', [10775]], ['intprod', [10812]], ['InvisibleComma', [8291]], ['InvisibleTimes', [8290]], ['IOcy', [1025]], ['iocy', [1105]], ['Iogon', [302]], ['iogon', [303]], ['Iopf', [120128]], ['iopf', [120154]], ['Iota', [921]], ['iota', [953]], ['iprod', [10812]], ['iquest', [191]], ['iscr', [119998]], ['Iscr', [8464]], ['isin', [8712]], ['isindot', [8949]], ['isinE', [8953]], ['isins', [8948]], ['isinsv', [8947]], ['isinv', [8712]], ['it', [8290]], ['Itilde', [296]], ['itilde', [297]], ['Iukcy', [1030]], ['iukcy', [1110]], ['Iuml', [207]], ['iuml', [239]], ['Jcirc', [308]], ['jcirc', [309]], ['Jcy', [1049]], ['jcy', [1081]], ['Jfr', [120077]], ['jfr', [120103]], ['jmath', [567]], ['Jopf', [120129]], ['jopf', [120155]], ['Jscr', [119973]], ['jscr', [119999]], ['Jsercy', [1032]], ['jsercy', [1112]], ['Jukcy', [1028]], ['jukcy', [1108]], ['Kappa', [922]], ['kappa', [954]], ['kappav', [1008]], ['Kcedil', [310]], ['kcedil', [311]], ['Kcy', [1050]], ['kcy', [1082]], ['Kfr', [120078]], ['kfr', [120104]], ['kgreen', [312]], ['KHcy', [1061]], ['khcy', [1093]], ['KJcy', [1036]], ['kjcy', [1116]], ['Kopf', [120130]], ['kopf', [120156]], ['Kscr', [119974]], ['kscr', [120000]], ['lAarr', [8666]], ['Lacute', [313]], ['lacute', [314]], ['laemptyv', [10676]], ['lagran', [8466]], ['Lambda', [923]], ['lambda', [955]], ['lang', [10216]], ['Lang', [10218]], ['langd', [10641]], ['langle', [10216]], ['lap', [10885]], ['Laplacetrf', [8466]], ['laquo', [171]], ['larrb', [8676]], ['larrbfs', [10527]], ['larr', [8592]], ['Larr', [8606]], ['lArr', [8656]], ['larrfs', [10525]], ['larrhk', [8617]], ['larrlp', [8619]], ['larrpl', [10553]], ['larrsim', [10611]], ['larrtl', [8610]], ['latail', [10521]], ['lAtail', [10523]], ['lat', [10923]], ['late', [10925]], ['lates', [10925, 65024]], ['lbarr', [10508]], ['lBarr', [10510]], ['lbbrk', [10098]], ['lbrace', [123]], ['lbrack', [91]], ['lbrke', [10635]], ['lbrksld', [10639]], ['lbrkslu', [10637]], ['Lcaron', [317]], ['lcaron', [318]], ['Lcedil', [315]], ['lcedil', [316]], ['lceil', [8968]], ['lcub', [123]], ['Lcy', [1051]], ['lcy', [1083]], ['ldca', [10550]], ['ldquo', [8220]], ['ldquor', [8222]], ['ldrdhar', [10599]], ['ldrushar', [10571]], ['ldsh', [8626]], ['le', [8804]], ['lE', [8806]], ['LeftAngleBracket', [10216]], ['LeftArrowBar', [8676]], ['leftarrow', [8592]], ['LeftArrow', [8592]], ['Leftarrow', [8656]], ['LeftArrowRightArrow', [8646]], ['leftarrowtail', [8610]], ['LeftCeiling', [8968]], ['LeftDoubleBracket', [10214]], ['LeftDownTeeVector', [10593]], ['LeftDownVectorBar', [10585]], ['LeftDownVector', [8643]], ['LeftFloor', [8970]], ['leftharpoondown', [8637]], ['leftharpoonup', [8636]], ['leftleftarrows', [8647]], ['leftrightarrow', [8596]], ['LeftRightArrow', [8596]], ['Leftrightarrow', [8660]], ['leftrightarrows', [8646]], ['leftrightharpoons', [8651]], ['leftrightsquigarrow', [8621]], ['LeftRightVector', [10574]], ['LeftTeeArrow', [8612]], ['LeftTee', [8867]], ['LeftTeeVector', [10586]], ['leftthreetimes', [8907]], ['LeftTriangleBar', [10703]], ['LeftTriangle', [8882]], ['LeftTriangleEqual', [8884]], ['LeftUpDownVector', [10577]], ['LeftUpTeeVector', [10592]], ['LeftUpVectorBar', [10584]], ['LeftUpVector', [8639]], ['LeftVectorBar', [10578]], ['LeftVector', [8636]], ['lEg', [10891]], ['leg', [8922]], ['leq', [8804]], ['leqq', [8806]], ['leqslant', [10877]], ['lescc', [10920]], ['les', [10877]], ['lesdot', [10879]], ['lesdoto', [10881]], ['lesdotor', [10883]], ['lesg', [8922, 65024]], ['lesges', [10899]], ['lessapprox', [10885]], ['lessdot', [8918]], ['lesseqgtr', [8922]], ['lesseqqgtr', [10891]], ['LessEqualGreater', [8922]], ['LessFullEqual', [8806]], ['LessGreater', [8822]], ['lessgtr', [8822]], ['LessLess', [10913]], ['lesssim', [8818]], ['LessSlantEqual', [10877]], ['LessTilde', [8818]], ['lfisht', [10620]], ['lfloor', [8970]], ['Lfr', [120079]], ['lfr', [120105]], ['lg', [8822]], ['lgE', [10897]], ['lHar', [10594]], ['lhard', [8637]], ['lharu', [8636]], ['lharul', [10602]], ['lhblk', [9604]], ['LJcy', [1033]], ['ljcy', [1113]], ['llarr', [8647]], ['ll', [8810]], ['Ll', [8920]], ['llcorner', [8990]], ['Lleftarrow', [8666]], ['llhard', [10603]], ['lltri', [9722]], ['Lmidot', [319]], ['lmidot', [320]], ['lmoustache', [9136]], ['lmoust', [9136]], ['lnap', [10889]], ['lnapprox', [10889]], ['lne', [10887]], ['lnE', [8808]], ['lneq', [10887]], ['lneqq', [8808]], ['lnsim', [8934]], ['loang', [10220]], ['loarr', [8701]], ['lobrk', [10214]], ['longleftarrow', [10229]], ['LongLeftArrow', [10229]], ['Longleftarrow', [10232]], ['longleftrightarrow', [10231]], ['LongLeftRightArrow', [10231]], ['Longleftrightarrow', [10234]], ['longmapsto', [10236]], ['longrightarrow', [10230]], ['LongRightArrow', [10230]], ['Longrightarrow', [10233]], ['looparrowleft', [8619]], ['looparrowright', [8620]], ['lopar', [10629]], ['Lopf', [120131]], ['lopf', [120157]], ['loplus', [10797]], ['lotimes', [10804]], ['lowast', [8727]], ['lowbar', [95]], ['LowerLeftArrow', [8601]], ['LowerRightArrow', [8600]], ['loz', [9674]], ['lozenge', [9674]], ['lozf', [10731]], ['lpar', [40]], ['lparlt', [10643]], ['lrarr', [8646]], ['lrcorner', [8991]], ['lrhar', [8651]], ['lrhard', [10605]], ['lrm', [8206]], ['lrtri', [8895]], ['lsaquo', [8249]], ['lscr', [120001]], ['Lscr', [8466]], ['lsh', [8624]], ['Lsh', [8624]], ['lsim', [8818]], ['lsime', [10893]], ['lsimg', [10895]], ['lsqb', [91]], ['lsquo', [8216]], ['lsquor', [8218]], ['Lstrok', [321]], ['lstrok', [322]], ['ltcc', [10918]], ['ltcir', [10873]], ['lt', [60]], ['LT', [60]], ['Lt', [8810]], ['ltdot', [8918]], ['lthree', [8907]], ['ltimes', [8905]], ['ltlarr', [10614]], ['ltquest', [10875]], ['ltri', [9667]], ['ltrie', [8884]], ['ltrif', [9666]], ['ltrPar', [10646]], ['lurdshar', [10570]], ['luruhar', [10598]], ['lvertneqq', [8808, 65024]], ['lvnE', [8808, 65024]], ['macr', [175]], ['male', [9794]], ['malt', [10016]], ['maltese', [10016]], ['Map', [10501]], ['map', [8614]], ['mapsto', [8614]], ['mapstodown', [8615]], ['mapstoleft', [8612]], ['mapstoup', [8613]], ['marker', [9646]], ['mcomma', [10793]], ['Mcy', [1052]], ['mcy', [1084]], ['mdash', [8212]], ['mDDot', [8762]], ['measuredangle', [8737]], ['MediumSpace', [8287]], ['Mellintrf', [8499]], ['Mfr', [120080]], ['mfr', [120106]], ['mho', [8487]], ['micro', [181]], ['midast', [42]], ['midcir', [10992]], ['mid', [8739]], ['middot', [183]], ['minusb', [8863]], ['minus', [8722]], ['minusd', [8760]], ['minusdu', [10794]], ['MinusPlus', [8723]], ['mlcp', [10971]], ['mldr', [8230]], ['mnplus', [8723]], ['models', [8871]], ['Mopf', [120132]], ['mopf', [120158]], ['mp', [8723]], ['mscr', [120002]], ['Mscr', [8499]], ['mstpos', [8766]], ['Mu', [924]], ['mu', [956]], ['multimap', [8888]], ['mumap', [8888]], ['nabla', [8711]], ['Nacute', [323]], ['nacute', [324]], ['nang', [8736, 8402]], ['nap', [8777]], ['napE', [10864, 824]], ['napid', [8779, 824]], ['napos', [329]], ['napprox', [8777]], ['natural', [9838]], ['naturals', [8469]], ['natur', [9838]], ['nbsp', [160]], ['nbump', [8782, 824]], ['nbumpe', [8783, 824]], ['ncap', [10819]], ['Ncaron', [327]], ['ncaron', [328]], ['Ncedil', [325]], ['ncedil', [326]], ['ncong', [8775]], ['ncongdot', [10861, 824]], ['ncup', [10818]], ['Ncy', [1053]], ['ncy', [1085]], ['ndash', [8211]], ['nearhk', [10532]], ['nearr', [8599]], ['neArr', [8663]], ['nearrow', [8599]], ['ne', [8800]], ['nedot', [8784, 824]], ['NegativeMediumSpace', [8203]], ['NegativeThickSpace', [8203]], ['NegativeThinSpace', [8203]], ['NegativeVeryThinSpace', [8203]], ['nequiv', [8802]], ['nesear', [10536]], ['nesim', [8770, 824]], ['NestedGreaterGreater', [8811]], ['NestedLessLess', [8810]], ['nexist', [8708]], ['nexists', [8708]], ['Nfr', [120081]], ['nfr', [120107]], ['ngE', [8807, 824]], ['nge', [8817]], ['ngeq', [8817]], ['ngeqq', [8807, 824]], ['ngeqslant', [10878, 824]], ['nges', [10878, 824]], ['nGg', [8921, 824]], ['ngsim', [8821]], ['nGt', [8811, 8402]], ['ngt', [8815]], ['ngtr', [8815]], ['nGtv', [8811, 824]], ['nharr', [8622]], ['nhArr', [8654]], ['nhpar', [10994]], ['ni', [8715]], ['nis', [8956]], ['nisd', [8954]], ['niv', [8715]], ['NJcy', [1034]], ['njcy', [1114]], ['nlarr', [8602]], ['nlArr', [8653]], ['nldr', [8229]], ['nlE', [8806, 824]], ['nle', [8816]], ['nleftarrow', [8602]], ['nLeftarrow', [8653]], ['nleftrightarrow', [8622]], ['nLeftrightarrow', [8654]], ['nleq', [8816]], ['nleqq', [8806, 824]], ['nleqslant', [10877, 824]], ['nles', [10877, 824]], ['nless', [8814]], ['nLl', [8920, 824]], ['nlsim', [8820]], ['nLt', [8810, 8402]], ['nlt', [8814]], ['nltri', [8938]], ['nltrie', [8940]], ['nLtv', [8810, 824]], ['nmid', [8740]], ['NoBreak', [8288]], ['NonBreakingSpace', [160]], ['nopf', [120159]], ['Nopf', [8469]], ['Not', [10988]], ['not', [172]], ['NotCongruent', [8802]], ['NotCupCap', [8813]], ['NotDoubleVerticalBar', [8742]], ['NotElement', [8713]], ['NotEqual', [8800]], ['NotEqualTilde', [8770, 824]], ['NotExists', [8708]], ['NotGreater', [8815]], ['NotGreaterEqual', [8817]], ['NotGreaterFullEqual', [8807, 824]], ['NotGreaterGreater', [8811, 824]], ['NotGreaterLess', [8825]], ['NotGreaterSlantEqual', [10878, 824]], ['NotGreaterTilde', [8821]], ['NotHumpDownHump', [8782, 824]], ['NotHumpEqual', [8783, 824]], ['notin', [8713]], ['notindot', [8949, 824]], ['notinE', [8953, 824]], ['notinva', [8713]], ['notinvb', [8951]], ['notinvc', [8950]], ['NotLeftTriangleBar', [10703, 824]], ['NotLeftTriangle', [8938]], ['NotLeftTriangleEqual', [8940]], ['NotLess', [8814]], ['NotLessEqual', [8816]], ['NotLessGreater', [8824]], ['NotLessLess', [8810, 824]], ['NotLessSlantEqual', [10877, 824]], ['NotLessTilde', [8820]], ['NotNestedGreaterGreater', [10914, 824]], ['NotNestedLessLess', [10913, 824]], ['notni', [8716]], ['notniva', [8716]], ['notnivb', [8958]], ['notnivc', [8957]], ['NotPrecedes', [8832]], ['NotPrecedesEqual', [10927, 824]], ['NotPrecedesSlantEqual', [8928]], ['NotReverseElement', [8716]], ['NotRightTriangleBar', [10704, 824]], ['NotRightTriangle', [8939]], ['NotRightTriangleEqual', [8941]], ['NotSquareSubset', [8847, 824]], ['NotSquareSubsetEqual', [8930]], ['NotSquareSuperset', [8848, 824]], ['NotSquareSupersetEqual', [8931]], ['NotSubset', [8834, 8402]], ['NotSubsetEqual', [8840]], ['NotSucceeds', [8833]], ['NotSucceedsEqual', [10928, 824]], ['NotSucceedsSlantEqual', [8929]], ['NotSucceedsTilde', [8831, 824]], ['NotSuperset', [8835, 8402]], ['NotSupersetEqual', [8841]], ['NotTilde', [8769]], ['NotTildeEqual', [8772]], ['NotTildeFullEqual', [8775]], ['NotTildeTilde', [8777]], ['NotVerticalBar', [8740]], ['nparallel', [8742]], ['npar', [8742]], ['nparsl', [11005, 8421]], ['npart', [8706, 824]], ['npolint', [10772]], ['npr', [8832]], ['nprcue', [8928]], ['nprec', [8832]], ['npreceq', [10927, 824]], ['npre', [10927, 824]], ['nrarrc', [10547, 824]], ['nrarr', [8603]], ['nrArr', [8655]], ['nrarrw', [8605, 824]], ['nrightarrow', [8603]], ['nRightarrow', [8655]], ['nrtri', [8939]], ['nrtrie', [8941]], ['nsc', [8833]], ['nsccue', [8929]], ['nsce', [10928, 824]], ['Nscr', [119977]], ['nscr', [120003]], ['nshortmid', [8740]], ['nshortparallel', [8742]], ['nsim', [8769]], ['nsime', [8772]], ['nsimeq', [8772]], ['nsmid', [8740]], ['nspar', [8742]], ['nsqsube', [8930]], ['nsqsupe', [8931]], ['nsub', [8836]], ['nsubE', [10949, 824]], ['nsube', [8840]], ['nsubset', [8834, 8402]], ['nsubseteq', [8840]], ['nsubseteqq', [10949, 824]], ['nsucc', [8833]], ['nsucceq', [10928, 824]], ['nsup', [8837]], ['nsupE', [10950, 824]], ['nsupe', [8841]], ['nsupset', [8835, 8402]], ['nsupseteq', [8841]], ['nsupseteqq', [10950, 824]], ['ntgl', [8825]], ['Ntilde', [209]], ['ntilde', [241]], ['ntlg', [8824]], ['ntriangleleft', [8938]], ['ntrianglelefteq', [8940]], ['ntriangleright', [8939]], ['ntrianglerighteq', [8941]], ['Nu', [925]], ['nu', [957]], ['num', [35]], ['numero', [8470]], ['numsp', [8199]], ['nvap', [8781, 8402]], ['nvdash', [8876]], ['nvDash', [8877]], ['nVdash', [8878]], ['nVDash', [8879]], ['nvge', [8805, 8402]], ['nvgt', [62, 8402]], ['nvHarr', [10500]], ['nvinfin', [10718]], ['nvlArr', [10498]], ['nvle', [8804, 8402]], ['nvlt', [60, 8402]], ['nvltrie', [8884, 8402]], ['nvrArr', [10499]], ['nvrtrie', [8885, 8402]], ['nvsim', [8764, 8402]], ['nwarhk', [10531]], ['nwarr', [8598]], ['nwArr', [8662]], ['nwarrow', [8598]], ['nwnear', [10535]], ['Oacute', [211]], ['oacute', [243]], ['oast', [8859]], ['Ocirc', [212]], ['ocirc', [244]], ['ocir', [8858]], ['Ocy', [1054]], ['ocy', [1086]], ['odash', [8861]], ['Odblac', [336]], ['odblac', [337]], ['odiv', [10808]], ['odot', [8857]], ['odsold', [10684]], ['OElig', [338]], ['oelig', [339]], ['ofcir', [10687]], ['Ofr', [120082]], ['ofr', [120108]], ['ogon', [731]], ['Ograve', [210]], ['ograve', [242]], ['ogt', [10689]], ['ohbar', [10677]], ['ohm', [937]], ['oint', [8750]], ['olarr', [8634]], ['olcir', [10686]], ['olcross', [10683]], ['oline', [8254]], ['olt', [10688]], ['Omacr', [332]], ['omacr', [333]], ['Omega', [937]], ['omega', [969]], ['Omicron', [927]], ['omicron', [959]], ['omid', [10678]], ['ominus', [8854]], ['Oopf', [120134]], ['oopf', [120160]], ['opar', [10679]], ['OpenCurlyDoubleQuote', [8220]], ['OpenCurlyQuote', [8216]], ['operp', [10681]], ['oplus', [8853]], ['orarr', [8635]], ['Or', [10836]], ['or', [8744]], ['ord', [10845]], ['order', [8500]], ['orderof', [8500]], ['ordf', [170]], ['ordm', [186]], ['origof', [8886]], ['oror', [10838]], ['orslope', [10839]], ['orv', [10843]], ['oS', [9416]], ['Oscr', [119978]], ['oscr', [8500]], ['Oslash', [216]], ['oslash', [248]], ['osol', [8856]], ['Otilde', [213]], ['otilde', [245]], ['otimesas', [10806]], ['Otimes', [10807]], ['otimes', [8855]], ['Ouml', [214]], ['ouml', [246]], ['ovbar', [9021]], ['OverBar', [8254]], ['OverBrace', [9182]], ['OverBracket', [9140]], ['OverParenthesis', [9180]], ['para', [182]], ['parallel', [8741]], ['par', [8741]], ['parsim', [10995]], ['parsl', [11005]], ['part', [8706]], ['PartialD', [8706]], ['Pcy', [1055]], ['pcy', [1087]], ['percnt', [37]], ['period', [46]], ['permil', [8240]], ['perp', [8869]], ['pertenk', [8241]], ['Pfr', [120083]], ['pfr', [120109]], ['Phi', [934]], ['phi', [966]], ['phiv', [981]], ['phmmat', [8499]], ['phone', [9742]], ['Pi', [928]], ['pi', [960]], ['pitchfork', [8916]], ['piv', [982]], ['planck', [8463]], ['planckh', [8462]], ['plankv', [8463]], ['plusacir', [10787]], ['plusb', [8862]], ['pluscir', [10786]], ['plus', [43]], ['plusdo', [8724]], ['plusdu', [10789]], ['pluse', [10866]], ['PlusMinus', [177]], ['plusmn', [177]], ['plussim', [10790]], ['plustwo', [10791]], ['pm', [177]], ['Poincareplane', [8460]], ['pointint', [10773]], ['popf', [120161]], ['Popf', [8473]], ['pound', [163]], ['prap', [10935]], ['Pr', [10939]], ['pr', [8826]], ['prcue', [8828]], ['precapprox', [10935]], ['prec', [8826]], ['preccurlyeq', [8828]], ['Precedes', [8826]], ['PrecedesEqual', [10927]], ['PrecedesSlantEqual', [8828]], ['PrecedesTilde', [8830]], ['preceq', [10927]], ['precnapprox', [10937]], ['precneqq', [10933]], ['precnsim', [8936]], ['pre', [10927]], ['prE', [10931]], ['precsim', [8830]], ['prime', [8242]], ['Prime', [8243]], ['primes', [8473]], ['prnap', [10937]], ['prnE', [10933]], ['prnsim', [8936]], ['prod', [8719]], ['Product', [8719]], ['profalar', [9006]], ['profline', [8978]], ['profsurf', [8979]], ['prop', [8733]], ['Proportional', [8733]], ['Proportion', [8759]], ['propto', [8733]], ['prsim', [8830]], ['prurel', [8880]], ['Pscr', [119979]], ['pscr', [120005]], ['Psi', [936]], ['psi', [968]], ['puncsp', [8200]], ['Qfr', [120084]], ['qfr', [120110]], ['qint', [10764]], ['qopf', [120162]], ['Qopf', [8474]], ['qprime', [8279]], ['Qscr', [119980]], ['qscr', [120006]], ['quaternions', [8461]], ['quatint', [10774]], ['quest', [63]], ['questeq', [8799]], ['quot', [34]], ['QUOT', [34]], ['rAarr', [8667]], ['race', [8765, 817]], ['Racute', [340]], ['racute', [341]], ['radic', [8730]], ['raemptyv', [10675]], ['rang', [10217]], ['Rang', [10219]], ['rangd', [10642]], ['range', [10661]], ['rangle', [10217]], ['raquo', [187]], ['rarrap', [10613]], ['rarrb', [8677]], ['rarrbfs', [10528]], ['rarrc', [10547]], ['rarr', [8594]], ['Rarr', [8608]], ['rArr', [8658]], ['rarrfs', [10526]], ['rarrhk', [8618]], ['rarrlp', [8620]], ['rarrpl', [10565]], ['rarrsim', [10612]], ['Rarrtl', [10518]], ['rarrtl', [8611]], ['rarrw', [8605]], ['ratail', [10522]], ['rAtail', [10524]], ['ratio', [8758]], ['rationals', [8474]], ['rbarr', [10509]], ['rBarr', [10511]], ['RBarr', [10512]], ['rbbrk', [10099]], ['rbrace', [125]], ['rbrack', [93]], ['rbrke', [10636]], ['rbrksld', [10638]], ['rbrkslu', [10640]], ['Rcaron', [344]], ['rcaron', [345]], ['Rcedil', [342]], ['rcedil', [343]], ['rceil', [8969]], ['rcub', [125]], ['Rcy', [1056]], ['rcy', [1088]], ['rdca', [10551]], ['rdldhar', [10601]], ['rdquo', [8221]], ['rdquor', [8221]], ['rdsh', [8627]], ['real', [8476]], ['realine', [8475]], ['realpart', [8476]], ['reals', [8477]], ['Re', [8476]], ['rect', [9645]], ['reg', [174]], ['REG', [174]], ['ReverseElement', [8715]], ['ReverseEquilibrium', [8651]], ['ReverseUpEquilibrium', [10607]], ['rfisht', [10621]], ['rfloor', [8971]], ['rfr', [120111]], ['Rfr', [8476]], ['rHar', [10596]], ['rhard', [8641]], ['rharu', [8640]], ['rharul', [10604]], ['Rho', [929]], ['rho', [961]], ['rhov', [1009]], ['RightAngleBracket', [10217]], ['RightArrowBar', [8677]], ['rightarrow', [8594]], ['RightArrow', [8594]], ['Rightarrow', [8658]], ['RightArrowLeftArrow', [8644]], ['rightarrowtail', [8611]], ['RightCeiling', [8969]], ['RightDoubleBracket', [10215]], ['RightDownTeeVector', [10589]], ['RightDownVectorBar', [10581]], ['RightDownVector', [8642]], ['RightFloor', [8971]], ['rightharpoondown', [8641]], ['rightharpoonup', [8640]], ['rightleftarrows', [8644]], ['rightleftharpoons', [8652]], ['rightrightarrows', [8649]], ['rightsquigarrow', [8605]], ['RightTeeArrow', [8614]], ['RightTee', [8866]], ['RightTeeVector', [10587]], ['rightthreetimes', [8908]], ['RightTriangleBar', [10704]], ['RightTriangle', [8883]], ['RightTriangleEqual', [8885]], ['RightUpDownVector', [10575]], ['RightUpTeeVector', [10588]], ['RightUpVectorBar', [10580]], ['RightUpVector', [8638]], ['RightVectorBar', [10579]], ['RightVector', [8640]], ['ring', [730]], ['risingdotseq', [8787]], ['rlarr', [8644]], ['rlhar', [8652]], ['rlm', [8207]], ['rmoustache', [9137]], ['rmoust', [9137]], ['rnmid', [10990]], ['roang', [10221]], ['roarr', [8702]], ['robrk', [10215]], ['ropar', [10630]], ['ropf', [120163]], ['Ropf', [8477]], ['roplus', [10798]], ['rotimes', [10805]], ['RoundImplies', [10608]], ['rpar', [41]], ['rpargt', [10644]], ['rppolint', [10770]], ['rrarr', [8649]], ['Rrightarrow', [8667]], ['rsaquo', [8250]], ['rscr', [120007]], ['Rscr', [8475]], ['rsh', [8625]], ['Rsh', [8625]], ['rsqb', [93]], ['rsquo', [8217]], ['rsquor', [8217]], ['rthree', [8908]], ['rtimes', [8906]], ['rtri', [9657]], ['rtrie', [8885]], ['rtrif', [9656]], ['rtriltri', [10702]], ['RuleDelayed', [10740]], ['ruluhar', [10600]], ['rx', [8478]], ['Sacute', [346]], ['sacute', [347]], ['sbquo', [8218]], ['scap', [10936]], ['Scaron', [352]], ['scaron', [353]], ['Sc', [10940]], ['sc', [8827]], ['sccue', [8829]], ['sce', [10928]], ['scE', [10932]], ['Scedil', [350]], ['scedil', [351]], ['Scirc', [348]], ['scirc', [349]], ['scnap', [10938]], ['scnE', [10934]], ['scnsim', [8937]], ['scpolint', [10771]], ['scsim', [8831]], ['Scy', [1057]], ['scy', [1089]], ['sdotb', [8865]], ['sdot', [8901]], ['sdote', [10854]], ['searhk', [10533]], ['searr', [8600]], ['seArr', [8664]], ['searrow', [8600]], ['sect', [167]], ['semi', [59]], ['seswar', [10537]], ['setminus', [8726]], ['setmn', [8726]], ['sext', [10038]], ['Sfr', [120086]], ['sfr', [120112]], ['sfrown', [8994]], ['sharp', [9839]], ['SHCHcy', [1065]], ['shchcy', [1097]], ['SHcy', [1064]], ['shcy', [1096]], ['ShortDownArrow', [8595]], ['ShortLeftArrow', [8592]], ['shortmid', [8739]], ['shortparallel', [8741]], ['ShortRightArrow', [8594]], ['ShortUpArrow', [8593]], ['shy', [173]], ['Sigma', [931]], ['sigma', [963]], ['sigmaf', [962]], ['sigmav', [962]], ['sim', [8764]], ['simdot', [10858]], ['sime', [8771]], ['simeq', [8771]], ['simg', [10910]], ['simgE', [10912]], ['siml', [10909]], ['simlE', [10911]], ['simne', [8774]], ['simplus', [10788]], ['simrarr', [10610]], ['slarr', [8592]], ['SmallCircle', [8728]], ['smallsetminus', [8726]], ['smashp', [10803]], ['smeparsl', [10724]], ['smid', [8739]], ['smile', [8995]], ['smt', [10922]], ['smte', [10924]], ['smtes', [10924, 65024]], ['SOFTcy', [1068]], ['softcy', [1100]], ['solbar', [9023]], ['solb', [10692]], ['sol', [47]], ['Sopf', [120138]], ['sopf', [120164]], ['spades', [9824]], ['spadesuit', [9824]], ['spar', [8741]], ['sqcap', [8851]], ['sqcaps', [8851, 65024]], ['sqcup', [8852]], ['sqcups', [8852, 65024]], ['Sqrt', [8730]], ['sqsub', [8847]], ['sqsube', [8849]], ['sqsubset', [8847]], ['sqsubseteq', [8849]], ['sqsup', [8848]], ['sqsupe', [8850]], ['sqsupset', [8848]], ['sqsupseteq', [8850]], ['square', [9633]], ['Square', [9633]], ['SquareIntersection', [8851]], ['SquareSubset', [8847]], ['SquareSubsetEqual', [8849]], ['SquareSuperset', [8848]], ['SquareSupersetEqual', [8850]], ['SquareUnion', [8852]], ['squarf', [9642]], ['squ', [9633]], ['squf', [9642]], ['srarr', [8594]], ['Sscr', [119982]], ['sscr', [120008]], ['ssetmn', [8726]], ['ssmile', [8995]], ['sstarf', [8902]], ['Star', [8902]], ['star', [9734]], ['starf', [9733]], ['straightepsilon', [1013]], ['straightphi', [981]], ['strns', [175]], ['sub', [8834]], ['Sub', [8912]], ['subdot', [10941]], ['subE', [10949]], ['sube', [8838]], ['subedot', [10947]], ['submult', [10945]], ['subnE', [10955]], ['subne', [8842]], ['subplus', [10943]], ['subrarr', [10617]], ['subset', [8834]], ['Subset', [8912]], ['subseteq', [8838]], ['subseteqq', [10949]], ['SubsetEqual', [8838]], ['subsetneq', [8842]], ['subsetneqq', [10955]], ['subsim', [10951]], ['subsub', [10965]], ['subsup', [10963]], ['succapprox', [10936]], ['succ', [8827]], ['succcurlyeq', [8829]], ['Succeeds', [8827]], ['SucceedsEqual', [10928]], ['SucceedsSlantEqual', [8829]], ['SucceedsTilde', [8831]], ['succeq', [10928]], ['succnapprox', [10938]], ['succneqq', [10934]], ['succnsim', [8937]], ['succsim', [8831]], ['SuchThat', [8715]], ['sum', [8721]], ['Sum', [8721]], ['sung', [9834]], ['sup1', [185]], ['sup2', [178]], ['sup3', [179]], ['sup', [8835]], ['Sup', [8913]], ['supdot', [10942]], ['supdsub', [10968]], ['supE', [10950]], ['supe', [8839]], ['supedot', [10948]], ['Superset', [8835]], ['SupersetEqual', [8839]], ['suphsol', [10185]], ['suphsub', [10967]], ['suplarr', [10619]], ['supmult', [10946]], ['supnE', [10956]], ['supne', [8843]], ['supplus', [10944]], ['supset', [8835]], ['Supset', [8913]], ['supseteq', [8839]], ['supseteqq', [10950]], ['supsetneq', [8843]], ['supsetneqq', [10956]], ['supsim', [10952]], ['supsub', [10964]], ['supsup', [10966]], ['swarhk', [10534]], ['swarr', [8601]], ['swArr', [8665]], ['swarrow', [8601]], ['swnwar', [10538]], ['szlig', [223]], ['Tab', [9]], ['target', [8982]], ['Tau', [932]], ['tau', [964]], ['tbrk', [9140]], ['Tcaron', [356]], ['tcaron', [357]], ['Tcedil', [354]], ['tcedil', [355]], ['Tcy', [1058]], ['tcy', [1090]], ['tdot', [8411]], ['telrec', [8981]], ['Tfr', [120087]], ['tfr', [120113]], ['there4', [8756]], ['therefore', [8756]], ['Therefore', [8756]], ['Theta', [920]], ['theta', [952]], ['thetasym', [977]], ['thetav', [977]], ['thickapprox', [8776]], ['thicksim', [8764]], ['ThickSpace', [8287, 8202]], ['ThinSpace', [8201]], ['thinsp', [8201]], ['thkap', [8776]], ['thksim', [8764]], ['THORN', [222]], ['thorn', [254]], ['tilde', [732]], ['Tilde', [8764]], ['TildeEqual', [8771]], ['TildeFullEqual', [8773]], ['TildeTilde', [8776]], ['timesbar', [10801]], ['timesb', [8864]], ['times', [215]], ['timesd', [10800]], ['tint', [8749]], ['toea', [10536]], ['topbot', [9014]], ['topcir', [10993]], ['top', [8868]], ['Topf', [120139]], ['topf', [120165]], ['topfork', [10970]], ['tosa', [10537]], ['tprime', [8244]], ['trade', [8482]], ['TRADE', [8482]], ['triangle', [9653]], ['triangledown', [9663]], ['triangleleft', [9667]], ['trianglelefteq', [8884]], ['triangleq', [8796]], ['triangleright', [9657]], ['trianglerighteq', [8885]], ['tridot', [9708]], ['trie', [8796]], ['triminus', [10810]], ['TripleDot', [8411]], ['triplus', [10809]], ['trisb', [10701]], ['tritime', [10811]], ['trpezium', [9186]], ['Tscr', [119983]], ['tscr', [120009]], ['TScy', [1062]], ['tscy', [1094]], ['TSHcy', [1035]], ['tshcy', [1115]], ['Tstrok', [358]], ['tstrok', [359]], ['twixt', [8812]], ['twoheadleftarrow', [8606]], ['twoheadrightarrow', [8608]], ['Uacute', [218]], ['uacute', [250]], ['uarr', [8593]], ['Uarr', [8607]], ['uArr', [8657]], ['Uarrocir', [10569]], ['Ubrcy', [1038]], ['ubrcy', [1118]], ['Ubreve', [364]], ['ubreve', [365]], ['Ucirc', [219]], ['ucirc', [251]], ['Ucy', [1059]], ['ucy', [1091]], ['udarr', [8645]], ['Udblac', [368]], ['udblac', [369]], ['udhar', [10606]], ['ufisht', [10622]], ['Ufr', [120088]], ['ufr', [120114]], ['Ugrave', [217]], ['ugrave', [249]], ['uHar', [10595]], ['uharl', [8639]], ['uharr', [8638]], ['uhblk', [9600]], ['ulcorn', [8988]], ['ulcorner', [8988]], ['ulcrop', [8975]], ['ultri', [9720]], ['Umacr', [362]], ['umacr', [363]], ['uml', [168]], ['UnderBar', [95]], ['UnderBrace', [9183]], ['UnderBracket', [9141]], ['UnderParenthesis', [9181]], ['Union', [8899]], ['UnionPlus', [8846]], ['Uogon', [370]], ['uogon', [371]], ['Uopf', [120140]], ['uopf', [120166]], ['UpArrowBar', [10514]], ['uparrow', [8593]], ['UpArrow', [8593]], ['Uparrow', [8657]], ['UpArrowDownArrow', [8645]], ['updownarrow', [8597]], ['UpDownArrow', [8597]], ['Updownarrow', [8661]], ['UpEquilibrium', [10606]], ['upharpoonleft', [8639]], ['upharpoonright', [8638]], ['uplus', [8846]], ['UpperLeftArrow', [8598]], ['UpperRightArrow', [8599]], ['upsi', [965]], ['Upsi', [978]], ['upsih', [978]], ['Upsilon', [933]], ['upsilon', [965]], ['UpTeeArrow', [8613]], ['UpTee', [8869]], ['upuparrows', [8648]], ['urcorn', [8989]], ['urcorner', [8989]], ['urcrop', [8974]], ['Uring', [366]], ['uring', [367]], ['urtri', [9721]], ['Uscr', [119984]], ['uscr', [120010]], ['utdot', [8944]], ['Utilde', [360]], ['utilde', [361]], ['utri', [9653]], ['utrif', [9652]], ['uuarr', [8648]], ['Uuml', [220]], ['uuml', [252]], ['uwangle', [10663]], ['vangrt', [10652]], ['varepsilon', [1013]], ['varkappa', [1008]], ['varnothing', [8709]], ['varphi', [981]], ['varpi', [982]], ['varpropto', [8733]], ['varr', [8597]], ['vArr', [8661]], ['varrho', [1009]], ['varsigma', [962]], ['varsubsetneq', [8842, 65024]], ['varsubsetneqq', [10955, 65024]], ['varsupsetneq', [8843, 65024]], ['varsupsetneqq', [10956, 65024]], ['vartheta', [977]], ['vartriangleleft', [8882]], ['vartriangleright', [8883]], ['vBar', [10984]], ['Vbar', [10987]], ['vBarv', [10985]], ['Vcy', [1042]], ['vcy', [1074]], ['vdash', [8866]], ['vDash', [8872]], ['Vdash', [8873]], ['VDash', [8875]], ['Vdashl', [10982]], ['veebar', [8891]], ['vee', [8744]], ['Vee', [8897]], ['veeeq', [8794]], ['vellip', [8942]], ['verbar', [124]], ['Verbar', [8214]], ['vert', [124]], ['Vert', [8214]], ['VerticalBar', [8739]], ['VerticalLine', [124]], ['VerticalSeparator', [10072]], ['VerticalTilde', [8768]], ['VeryThinSpace', [8202]], ['Vfr', [120089]], ['vfr', [120115]], ['vltri', [8882]], ['vnsub', [8834, 8402]], ['vnsup', [8835, 8402]], ['Vopf', [120141]], ['vopf', [120167]], ['vprop', [8733]], ['vrtri', [8883]], ['Vscr', [119985]], ['vscr', [120011]], ['vsubnE', [10955, 65024]], ['vsubne', [8842, 65024]], ['vsupnE', [10956, 65024]], ['vsupne', [8843, 65024]], ['Vvdash', [8874]], ['vzigzag', [10650]], ['Wcirc', [372]], ['wcirc', [373]], ['wedbar', [10847]], ['wedge', [8743]], ['Wedge', [8896]], ['wedgeq', [8793]], ['weierp', [8472]], ['Wfr', [120090]], ['wfr', [120116]], ['Wopf', [120142]], ['wopf', [120168]], ['wp', [8472]], ['wr', [8768]], ['wreath', [8768]], ['Wscr', [119986]], ['wscr', [120012]], ['xcap', [8898]], ['xcirc', [9711]], ['xcup', [8899]], ['xdtri', [9661]], ['Xfr', [120091]], ['xfr', [120117]], ['xharr', [10231]], ['xhArr', [10234]], ['Xi', [926]], ['xi', [958]], ['xlarr', [10229]], ['xlArr', [10232]], ['xmap', [10236]], ['xnis', [8955]], ['xodot', [10752]], ['Xopf', [120143]], ['xopf', [120169]], ['xoplus', [10753]], ['xotime', [10754]], ['xrarr', [10230]], ['xrArr', [10233]], ['Xscr', [119987]], ['xscr', [120013]], ['xsqcup', [10758]], ['xuplus', [10756]], ['xutri', [9651]], ['xvee', [8897]], ['xwedge', [8896]], ['Yacute', [221]], ['yacute', [253]], ['YAcy', [1071]], ['yacy', [1103]], ['Ycirc', [374]], ['ycirc', [375]], ['Ycy', [1067]], ['ycy', [1099]], ['yen', [165]], ['Yfr', [120092]], ['yfr', [120118]], ['YIcy', [1031]], ['yicy', [1111]], ['Yopf', [120144]], ['yopf', [120170]], ['Yscr', [119988]], ['yscr', [120014]], ['YUcy', [1070]], ['yucy', [1102]], ['yuml', [255]], ['Yuml', [376]], ['Zacute', [377]], ['zacute', [378]], ['Zcaron', [381]], ['zcaron', [382]], ['Zcy', [1047]], ['zcy', [1079]], ['Zdot', [379]], ['zdot', [380]], ['zeetrf', [8488]], ['ZeroWidthSpace', [8203]], ['Zeta', [918]], ['zeta', [950]], ['zfr', [120119]], ['Zfr', [8488]], ['ZHcy', [1046]], ['zhcy', [1078]], ['zigrarr', [8669]], ['zopf', [120171]], ['Zopf', [8484]], ['Zscr', [119989]], ['zscr', [120015]], ['zwj', [8205]], ['zwnj', [8204]]];

var alphaIndex = {};
var charIndex = {};

createIndexes(alphaIndex, charIndex);

/**
 * @constructor
 */
function Html5Entities() {}

/**
 * @param {String} str
 * @returns {String}
 */
Html5Entities.prototype.decode = function(str) {
    if (str.length === 0) {
        return '';
    }
    return str.replace(/&(#?[\w\d]+);?/g, function(s, entity) {
        var chr;
        if (entity.charAt(0) === "#") {
            var code = entity.charAt(1) === 'x' ?
                parseInt(entity.substr(2).toLowerCase(), 16) :
                parseInt(entity.substr(1));

            if (!(isNaN(code) || code < -32768 || code > 65535)) {
                chr = String.fromCharCode(code);
            }
        } else {
            chr = alphaIndex[entity];
        }
        return chr || s;
    });
};

/**
 * @param {String} str
 * @returns {String}
 */
 Html5Entities.decode = function(str) {
    return new Html5Entities().decode(str);
 };

/**
 * @param {String} str
 * @returns {String}
 */
Html5Entities.prototype.encode = function(str) {
    var strLength = str.length;
    if (strLength === 0) {
        return '';
    }
    var result = '';
    var i = 0;
    while (i < strLength) {
        var charInfo = charIndex[str.charCodeAt(i)];
        if (charInfo) {
            var alpha = charInfo[str.charCodeAt(i + 1)];
            if (alpha) {
                i++;
            } else {
                alpha = charInfo[''];
            }
            if (alpha) {
                result += "&" + alpha + ";";
                i++;
                continue;
            }
        }
        result += str.charAt(i);
        i++;
    }
    return result;
};

/**
 * @param {String} str
 * @returns {String}
 */
 Html5Entities.encode = function(str) {
    return new Html5Entities().encode(str);
 };

/**
 * @param {String} str
 * @returns {String}
 */
Html5Entities.prototype.encodeNonUTF = function(str) {
    var strLength = str.length;
    if (strLength === 0) {
        return '';
    }
    var result = '';
    var i = 0;
    while (i < strLength) {
        var c = str.charCodeAt(i);
        var charInfo = charIndex[c];
        if (charInfo) {
            var alpha = charInfo[str.charCodeAt(i + 1)];
            if (alpha) {
                i++;
            } else {
                alpha = charInfo[''];
            }
            if (alpha) {
                result += "&" + alpha + ";";
                i++;
                continue;
            }
        }
        if (c < 32 || c > 126) {
            result += '&#' + c + ';';
        } else {
            result += str.charAt(i);
        }
        i++;
    }
    return result;
};

/**
 * @param {String} str
 * @returns {String}
 */
 Html5Entities.encodeNonUTF = function(str) {
    return new Html5Entities().encodeNonUTF(str);
 };

/**
 * @param {String} str
 * @returns {String}
 */
Html5Entities.prototype.encodeNonASCII = function(str) {
    var strLength = str.length;
    if (strLength === 0) {
        return '';
    }
    var result = '';
    var i = 0;
    while (i < strLength) {
        var c = str.charCodeAt(i);
        if (c <= 255) {
            result += str[i++];
            continue;
        }
        result += '&#' + c + ';';
        i++
    }
    return result;
};

/**
 * @param {String} str
 * @returns {String}
 */
 Html5Entities.encodeNonASCII = function(str) {
    return new Html5Entities().encodeNonASCII(str);
 };

/**
 * @param {Object} alphaIndex Passed by reference.
 * @param {Object} charIndex Passed by reference.
 */
function createIndexes(alphaIndex, charIndex) {
    var i = ENTITIES.length;
    var _results = [];
    while (i--) {
        var e = ENTITIES[i];
        var alpha = e[0];
        var chars = e[1];
        var chr = chars[0];
        var addChar = (chr < 32 || chr > 126) || chr === 62 || chr === 60 || chr === 38 || chr === 34 || chr === 39;
        var charInfo;
        if (addChar) {
            charInfo = charIndex[chr] = charIndex[chr] || {};
        }
        if (chars[1]) {
            var chr2 = chars[1];
            alphaIndex[alpha] = String.fromCharCode(chr) + String.fromCharCode(chr2);
            _results.push(addChar && (charInfo[chr2] = alpha));
        } else {
            alphaIndex[alpha] = String.fromCharCode(chr);
            _results.push(addChar && (charInfo[''] = alpha));
        }
    }
}

module.exports = Html5Entities;

},{}],80:[function(require,module,exports){
var ALPHA_INDEX = {
    '&lt': '<',
    '&gt': '>',
    '&quot': '"',
    '&apos': '\'',
    '&amp': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': '\'',
    '&amp;': '&'
};

var CHAR_INDEX = {
    60: 'lt',
    62: 'gt',
    34: 'quot',
    39: 'apos',
    38: 'amp'
};

var CHAR_S_INDEX = {
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&apos;',
    '&': '&amp;'
};

/**
 * @constructor
 */
function XmlEntities() {}

/**
 * @param {String} str
 * @returns {String}
 */
XmlEntities.prototype.encode = function(str) {
    if (str.length === 0) {
        return '';
    }
    return str.replace(/<|>|"|'|&/g, function(s) {
        return CHAR_S_INDEX[s];
    });
};

/**
 * @param {String} str
 * @returns {String}
 */
 XmlEntities.encode = function(str) {
    return new XmlEntities().encode(str);
 };

/**
 * @param {String} str
 * @returns {String}
 */
XmlEntities.prototype.decode = function(str) {
    if (str.length === 0) {
        return '';
    }
    return str.replace(/&#?[0-9a-zA-Z]+;?/g, function(s) {
        if (s.charAt(1) === '#') {
            var code = s.charAt(2).toLowerCase() === 'x' ?
                parseInt(s.substr(3), 16) :
                parseInt(s.substr(2));

            if (isNaN(code) || code < -32768 || code > 65535) {
                return '';
            }
            return String.fromCharCode(code);
        }
        return ALPHA_INDEX[s] || s;
    });
};

/**
 * @param {String} str
 * @returns {String}
 */
 XmlEntities.decode = function(str) {
    return new XmlEntities().decode(str);
 };

/**
 * @param {String} str
 * @returns {String}
 */
XmlEntities.prototype.encodeNonUTF = function(str) {
    var strLength = str.length;
    if (strLength === 0) {
        return '';
    }
    var result = '';
    var i = 0;
    while (i < strLength) {
        var c = str.charCodeAt(i);
        var alpha = CHAR_INDEX[c];
        if (alpha) {
            result += "&" + alpha + ";";
            i++;
            continue;
        }
        if (c < 32 || c > 126) {
            result += '&#' + c + ';';
        } else {
            result += str.charAt(i);
        }
        i++;
    }
    return result;
};

/**
 * @param {String} str
 * @returns {String}
 */
 XmlEntities.encodeNonUTF = function(str) {
    return new XmlEntities().encodeNonUTF(str);
 };

/**
 * @param {String} str
 * @returns {String}
 */
XmlEntities.prototype.encodeNonASCII = function(str) {
    var strLenght = str.length;
    if (strLenght === 0) {
        return '';
    }
    var result = '';
    var i = 0;
    while (i < strLenght) {
        var c = str.charCodeAt(i);
        if (c <= 255) {
            result += str[i++];
            continue;
        }
        result += '&#' + c + ';';
        i++;
    }
    return result;
};

/**
 * @param {String} str
 * @returns {String}
 */
 XmlEntities.encodeNonASCII = function(str) {
    return new XmlEntities().encodeNonASCII(str);
 };

module.exports = XmlEntities;

},{}],81:[function(require,module,exports){
/*jshint node:true*/
'use strict';

/**
 * Replaces characters in strings that are illegal/unsafe for filenames.
 * Unsafe characters are either removed or replaced by a substitute set
 * in the optional `options` object.
 *
 * Illegal Characters on Various Operating Systems
 * / ? < > \ : * | "
 * https://kb.acronis.com/content/39790
 *
 * Unicode Control codes
 * C0 0x00-0x1f & C1 (0x80-0x9f)
 * http://en.wikipedia.org/wiki/C0_and_C1_control_codes
 *
 * Reserved filenames on Unix-based systems (".", "..")
 * Reserved filenames in Windows ("CON", "PRN", "AUX", "NUL", "COM1",
 * "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
 * "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", and
 * "LPT9") case-insesitively and with or without filename extensions.
 *
 * Capped at 255 characters in length.
 * http://unix.stackexchange.com/questions/32795/what-is-the-maximum-allowed-filename-and-folder-size-with-ecryptfs
 *
 * @param  {String} input   Original filename
 * @param  {Object} options {replacement: String}
 * @return {String}         Sanitized filename
 */

var truncate = require("truncate-utf8-bytes");

var illegalRe = /[\/\?<>\\:\*\|":]/g;
var controlRe = /[\x00-\x1f\x80-\x9f]/g;
var reservedRe = /^\.+$/;
var windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
var windowsTrailingRe = /[\. ]+$/;

function sanitize(input, replacement) {
  var sanitized = input
    .replace(illegalRe, replacement)
    .replace(controlRe, replacement)
    .replace(reservedRe, replacement)
    .replace(windowsReservedRe, replacement)
    .replace(windowsTrailingRe, replacement);
  return truncate(sanitized, 255);
}

module.exports = function (input, options) {
  var replacement = (options && options.replacement) || '';
  var output = sanitize(input, replacement);
  if (replacement === '') {
    return output;
  }
  return sanitize(output, '');
};

},{"truncate-utf8-bytes":87}],82:[function(require,module,exports){

var space = require('to-space-case')

/**
 * Export.
 */

module.exports = toCamelCase

/**
 * Convert a `string` to camel case.
 *
 * @param {String} string
 * @return {String}
 */

function toCamelCase(string) {
  return space(string).replace(/\s(\w)/g, function (matches, letter) {
    return letter.toUpperCase()
  })
}

},{"to-space-case":84}],83:[function(require,module,exports){

/**
 * Export.
 */

module.exports = toNoCase

/**
 * Test whether a string is camel-case.
 */

var hasSpace = /\s/
var hasSeparator = /(_|-|\.|:)/
var hasCamel = /([a-z][A-Z]|[A-Z][a-z])/

/**
 * Remove any starting case from a `string`, like camel or snake, but keep
 * spaces and punctuation that may be important otherwise.
 *
 * @param {String} string
 * @return {String}
 */

function toNoCase(string) {
  if (hasSpace.test(string)) return string.toLowerCase()
  if (hasSeparator.test(string)) return (unseparate(string) || string).toLowerCase()
  if (hasCamel.test(string)) return uncamelize(string).toLowerCase()
  return string.toLowerCase()
}

/**
 * Separator splitter.
 */

var separatorSplitter = /[\W_]+(.|$)/g

/**
 * Un-separate a `string`.
 *
 * @param {String} string
 * @return {String}
 */

function unseparate(string) {
  return string.replace(separatorSplitter, function (m, next) {
    return next ? ' ' + next : ''
  })
}

/**
 * Camelcase splitter.
 */

var camelSplitter = /(.)([A-Z]+)/g

/**
 * Un-camelcase a `string`.
 *
 * @param {String} string
 * @return {String}
 */

function uncamelize(string) {
  return string.replace(camelSplitter, function (m, previous, uppers) {
    return previous + ' ' + uppers.toLowerCase().split('').join(' ')
  })
}

},{}],84:[function(require,module,exports){

var clean = require('to-no-case')

/**
 * Export.
 */

module.exports = toSpaceCase

/**
 * Convert a `string` to space case.
 *
 * @param {String} string
 * @return {String}
 */

function toSpaceCase(string) {
  return clean(string).replace(/[\W_]+(.|$)/g, function (matches, match) {
    return match ? ' ' + match : ''
  }).trim()
}

},{"to-no-case":83}],85:[function(require,module,exports){

/**
 * Expose `toNoCase`.
 */

module.exports = toNoCase;


/**
 * Test whether a string is camel-case.
 */

var hasSpace = /\s/;
var hasCamel = /[a-z][A-Z]/;
var hasSeparator = /[\W_]/;


/**
 * Remove any starting case from a `string`, like camel or snake, but keep
 * spaces and punctuation that may be important otherwise.
 *
 * @param {String} string
 * @return {String}
 */

function toNoCase (string) {
  if (hasSpace.test(string)) return string.toLowerCase();

  if (hasSeparator.test(string)) string = unseparate(string);
  if (hasCamel.test(string)) string = uncamelize(string);
  return string.toLowerCase();
}


/**
 * Separator splitter.
 */

var separatorSplitter = /[\W_]+(.|$)/g;


/**
 * Un-separate a `string`.
 *
 * @param {String} string
 * @return {String}
 */

function unseparate (string) {
  return string.replace(separatorSplitter, function (m, next) {
    return next ? ' ' + next : '';
  });
}


/**
 * Camelcase splitter.
 */

var camelSplitter = /(.)([A-Z]+)/g;


/**
 * Un-camelcase a `string`.
 *
 * @param {String} string
 * @return {String}
 */

function uncamelize (string) {
  return string.replace(camelSplitter, function (m, previous, uppers) {
    return previous + ' ' + uppers.toLowerCase().split('').join(' ');
  });
}
},{}],86:[function(require,module,exports){

var clean = require('to-no-case');


/**
 * Expose `toSpaceCase`.
 */

module.exports = toSpaceCase;


/**
 * Convert a `string` to space case.
 *
 * @param {String} string
 * @return {String}
 */


function toSpaceCase (string) {
  return clean(string).replace(/[\W_]+(.|$)/g, function (matches, match) {
    return match ? ' ' + match : '';
  });
}
},{"to-no-case":85}],87:[function(require,module,exports){
'use strict';

var truncate = require("./lib/truncate");
var getLength = require("utf8-byte-length/browser");
module.exports = truncate.bind(null, getLength);

},{"./lib/truncate":88,"utf8-byte-length/browser":89}],88:[function(require,module,exports){
'use strict';

function isHighSurrogate(codePoint) {
  return codePoint >= 0xd800 && codePoint <= 0xdbff;
}

function isLowSurrogate(codePoint) {
  return codePoint >= 0xdc00 && codePoint <= 0xdfff;
}

// Truncate string by size in bytes
module.exports = function truncate(getLength, string, byteLength) {
  if (typeof string !== "string") {
    throw new Error("Input must be string");
  }

  var charLength = string.length;
  var curByteLength = 0;
  var codePoint;
  var segment;

  for (var i = 0; i < charLength; i += 1) {
    codePoint = string.charCodeAt(i);
    segment = string[i];

    if (isHighSurrogate(codePoint) && isLowSurrogate(string.charCodeAt(i + 1))) {
      i += 1;
      segment += string[i];
    }

    curByteLength += getLength(segment);

    if (curByteLength === byteLength) {
      return string.slice(0, i + 1);
    }
    else if (curByteLength > byteLength) {
      return string.slice(0, i - segment.length + 1);
    }
  }

  return string;
};


},{}],89:[function(require,module,exports){
'use strict';

function isHighSurrogate(codePoint) {
  return codePoint >= 0xd800 && codePoint <= 0xdbff;
}

function isLowSurrogate(codePoint) {
  return codePoint >= 0xdc00 && codePoint <= 0xdfff;
}

// Truncate string by size in bytes
module.exports = function getByteLength(string) {
  if (typeof string !== "string") {
    throw new Error("Input must be string");
  }

  var charLength = string.length;
  var byteLength = 0;
  var codePoint = null;
  var prevCodePoint = null;
  for (var i = 0; i < charLength; i++) {
    codePoint = string.charCodeAt(i);
    // handle 4-byte non-BMP chars
    // low surrogate
    if (isLowSurrogate(codePoint)) {
      // when parsing previous hi-surrogate, 3 is added to byteLength
      if (prevCodePoint != null && isHighSurrogate(prevCodePoint)) {
        byteLength += 1;
      }
      else {
        byteLength += 3;
      }
    }
    else if (codePoint <= 0x7f ) {
      byteLength += 1;
    }
    else if (codePoint >= 0x80 && codePoint <= 0x7ff) {
      byteLength += 2;
    }
    else if (codePoint >= 0x800 && codePoint <= 0xffff) {
      byteLength += 3;
    }
    prevCodePoint = codePoint;
  }

  return byteLength;
};

},{}]},{},[45])(45)
});