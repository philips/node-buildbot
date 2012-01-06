var util = require('util');
var EventEmitter = require('events').EventEmitter;
var log = require('logmagic').local('node-buildbot.Poller');

function Poller(name, options, interval) {
  EventEmitter.call(this);

  this._poller_name = name;
  this._options = options;
  this._interval = interval;

  this._pollCache = {};
  this._intervalId = null;
}

util.inherits(Poller, EventEmitter);

Poller.prototype.start = function(object, fun) {
  this._pollSetup();
};

Poller.prototype.stop = function() {
  clearInterval(this._interval);
};

Poller.prototype._initialize = function() {
  var self = this;
  log.infof('Poller ${name} initialized. Polling for changes every ${interval} ms',
           {'name': this._poller_name, 'interval': this._interval});

  if (this._interval !== 0) {
    this._intervalId = setInterval(function() {
      self._pollForChanges();
    }, this._interval);
  } else {
    self._pollForChanges();
  }
};

Poller.prototype._pollForChanges = function() {
  throw new Error('Not implemented');
};

exports.Poller = Poller;
