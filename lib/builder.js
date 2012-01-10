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

/* Build query string for the terrible buildbot negative
 * indice api */
BuildbotBuilder.prototype._selectQuery = function () {
  var i, selects = [];
  // That's bad but buildbot api is for limiting number of builds sucks.
  for (i = 1; i <= this._numBuilds; i++) {
    selects.push(sprintf('-%s', i));
  }
  return selects;
};

BuildbotBuilder.prototype._pollSetup = function() {
  var path = "";

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

/**
 * Initiate build on buildbot
 * @param {String} builder The builder to force the build on.
 * @param {String} revision The revision to build.
 * @param {Function} callback The completion callback(err).
 */
BuildbotBuilder.prototype.build = function(revision, user, callback) {
  var self = this;
  var force_url = self._buildbot.url(sprintf(self._forceURL, self._name));
  var reqOpts = {
        method: 'POST',
        uri: force_url,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: querystring.stringify({
          username: user.name,
          revision: revision
        })
      };

  log.debugf('forcing build of ${revision} on ${builder}', {
    builder: self._name,
    revision: revision
  });

  request(reqOpts, function(err, response, body) {
    if (err) {
      callback(err);
    } else if (response.statusCode !== 302) {
      callback(new Error(sprintf('Received %s from %s', response.statusCode, self._options.url)));
    } else {
      callback(null, body);
    }
  });
};

/**
 * Find the oldest build with a given revision.
 */
BuildbotBuilder.prototype._findOldestBuild = function(builds, revision) {
  var i, j, number, numbers, build, properties, retrybuild;

  // Get numbers of builds from oldest to newest
  numbers = Object.keys(builds).map(function(numstr) {
    return parseInt(numstr, 10);
  }).sort(function(a, b) {
    return a - b;
  });

  for (i = 0; i < numbers.length; i++) {
    number = numbers[i].toString();

    if (builds.hasOwnProperty(number)) {
      build = builds[number];
      properties = build.properties;

      if (!properties) {
        log.warnf('invalid build at ${index}: ${text}', {
          index: number,
          text: build.error
        });
        continue;
      }

      for (j = 0; j < properties.length; j++) {
        if (properties[j][0] === 'got_revision' && properties[j][1] === revision) {
          // If a build failed due to an exception, see if a subsequent one
          // can be used instead. (Also, "5" is apparently undocumented, but
          // seems to be the result code for "retry").
          if (build.results === 4 || build.results === 5) {
            retrybuild = build;
            continue;
          }

          return build;
        }
      }
    }
  }

  return retrybuild;
};

/**
 * Get a build for a specified revision.
 * @param {String} revision The revision to search for.
 * @param {Function} callback A callback fired with (err, build).
 */
BuildbotBuilder.prototype.getRevision = function(revision, callback) {
  var self = this;
  var status_url = self._buildbot.url(sprintf(self._statusURL, self._name));
  status_url.query = self._selectQuery();

  request.get({uri: status_url}, function(err, response, body) {
    if (err) {
      callback(err);
    } else {
      try {
        body = JSON.parse(body);
      } catch (e) {
        callback(e);
        return;
      }

      callback(null, self._findOldestBuild(body, revision));
    }
  });
};

BuildbotBuilder.prototype.ensureRevisionBuilt = function(revision, callback) {
  var self = this,
      attempts = 0;

  log.debugf('ensuring revision ${revision} on ${builder}', {
    revision: revision,
    builder: builder
  });

  function attempt(force) {
    attempts++;

    if (attempts > self._options.retries) {
      callback(new Error(sprintf('No build found after %s attempts', self._options.retries)));
      return;
    }

    self.getRevision(builder, revision, function(err, build) {
      if (err) {
        callback(err);
      } else if (!build) {
        if (force) {
          self.build(revision, function(err) {
            if (err) {
              callback(err);
            } else {
              setTimeout(attempt, self._options.delay);
            }
          });
        } else {
          // The build was already forced, but isn't showing up - it is
          // *probably* pending. Alternatively, maybe num_builds happened
          // and we missed it. Oops.
          self.log.infof('build of ${revision} on ${builder} is queued', {
            revision: revision,
            builder: builder
          });
          setTimeout(attempt, self._options.delay);
        }
      } else if (build.times[1] !== null) {
        self.log.infof('build ${number} on ${builder} finished: ${text}', {
          number: build.number,
          result_code: build.results || 0,
          builder: builder,
          text: build.text.join(' ')
        });
        // There is a Buildbot bug where build.results isn't included when it
        // is 0
        if ((build.results || 0) === 0) {
          callback(null, build);
        } else {
          callback(new Error(sprintf('Build %s of %s: %s', build.number, builder, build.text.join(' '))));
        }
      } else {
        self.log.infof('build ${number} on ${builder} ETA is ${eta}s', {
          number: build.number,
          builder: builder,
          eta: build.eta
        });
        // Try again in the greater of half of the ETA or the configured delay
        setTimeout(attempt, Math.max(build.eta * 500, self._options.delay));
      }
    });
  }

  attempt(true);
};

exports.Builder = BuildbotBuilder;
