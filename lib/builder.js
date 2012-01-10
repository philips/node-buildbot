var url = require('url');
var util = require('util');
var querystring = require('querystring');

var sprintf = require('sprintf').sprintf;
var log = require('logmagic').local('node-buildbot.builder');

var request = require('request');
var Poller = require('./poller').Poller;

function BuildbotBuilder(buildbot, name, options) {
  this._buildbot = buildbot;
  this._name = name;
  this._options = options || {};
  this._numBuilds = this._options['num_builds'] || 10;
  this._interval = this._options['poll_interval'];
  if (this._interval >= 0) {
    Poller.call(this, 'BuildbotBuilder', options, this._interval);
  }

  this._statusURL = '/json/builders/%s/builds/';
  this._forceURL = '/builders/%s/force';
}

util.inherits(BuildbotBuilder, Poller);

BuildbotBuilder.prototype._pollSetup = function() {
  var path = "";
  // That's bad but buildbot api is for limiting number of builds sucks.
  for (i = 1; i < this._numBuilds; i++) {
    if (i === 1) {
      path += '?';
    } else {
      path += '&';
    }

    path += sprintf('select=-%d', i);
  }

  Poller.prototype._initialize.call(this);
};

BuildbotBuilder.prototype._pollForChanges = function() {
  var self = this;
  var status_url = self._buildbot.url(sprintf(self._statusURL, self._name));

  request.get({url: status_url}, function(error, response, body) {
    if (error || response.statusCode !== 200) {
      if (!error) {
        var error = new Error('Failed fetching builder status data, statusCode !== 200');
      }
      log.error(error.message + "foobar");
      return;
    }

    try {
      body = JSON.parse(body);
    } catch (err) {
      log.errorf('Failed to parse buildbot response: ${err}',
                {'err': err.toString()});
      return;
    }

    self._handleGotBody(body);
  });
};

BuildbotBuilder.prototype._handleGotBody = function(body) {
  var self = this;
  var i, len, key, cache, cacheKey, build, temp = Object.keys(body), keys = [],
      steps, finished;

  for (i = 0, len = temp.length; i < len; i++) {
    keys.push(parseInt(temp[i], 10));
  }

  keys = keys.sort(function(a, b) { return a - b; }).reverse();
  // Always traverse the builds from the oldest to the newest one
  for (i = Math.min.apply(null, keys); i < 0; i++) {
    key = i.toString();

    if (body.hasOwnProperty(key)) {
      build = body[key];
      cacheKey = build.number || null;
      cache = self._pollCache[cacheKey];

      if (cache || build.hasOwnProperty('error')) {
        continue;
      }

      steps = build.steps || [];
      finished = steps[steps.length - 1].isFinished;

      if (!finished) {
        self.emit('in_progress_build', build);
        continue;
      }

      log.debug('Found a new finished build (${num}), emitting an event',
                {'num': cacheKey});
      self._pollCache[cacheKey] = build;
      self.emit('new_build', build);
    }
  }
};

exports.Builder = BuildbotBuilder;
