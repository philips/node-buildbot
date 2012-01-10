/*
 *  Copyright 2011 Rackspace
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

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
