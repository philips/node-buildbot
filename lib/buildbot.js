var util = require('util');
var http = require('http');
var https = require('https');
var querystring = require('querystring');

var sprintf = require('sprintf').sprintf;
var log = require('logmagic').local('node-buildbot.buildbot');

var utils = require('./utils');
var Poller = require('./poller').Poller;

function Buildbot(options) {
  this._options = options;

  this._interval = options['poll_interval'];
  if (this._interval >= 0) {
    Poller.call(this, 'buildbot', options, this._interval);
  }

  this._host = options['host'];
  this._port = options['port'];
  this._secure = options['secure'];
  this._username = options['username'];
  this._password = options['password'];
  if (this._username && this._password) {
    this._authHeader = utils.getAuthHeader(this._username, this._password);
  }
  this._numBuilds = options['num_builds'];
  this._changeHookPath = options['change_hook_path'];
  this._builderName = options['builder_name'];
  this._builderStatusURL = '/json/builders/%s/builds/';

  // Prepare objects which are used when making requests
  this._http = (this._secure) ? https : http;
}

util.inherits(Buildbot, Poller);

Buildbot.prototype._initialize = function() {
  // That's bad but buildbot api is for limiting number of builds sucks.
  var path = sprintf(this.builderStatusURL, this._options['builder_name']), i;

  for (i = 1; i < this._numBuilds; i++) {
    if (i === 1) {
      path += '?';
    } else {
      path += '&';
    }

    path += sprintf('select=-%d', i);
  }

  this._fetchBuildDataReqObj = this._reqObj(path, 'GET');

  Poller.prototype._initialize.call(this);
};

Buildbot.prototype._reqObj = function(path, method) {
  var reqObj = {
    'host': this._host,
    'port': this._port,
    'path': path,
    'method': method,
    'headers': {}
  };

  if (this._authHeader) {
    reqObj.headers.Authorization = this._authHeader;
  }
  return reqObj;
};

Buildbot.prototype._pollForChanges = function() {
  var self = this;

  var request = this._http.get(this._fetchBuildDataReqObj, function(res) {
    var body = '';

    function handleData(chunk) {
      body += chunk;
    }

    function handleEnd() {
      body = body.toString();
      try {
        body = JSON.parse(body);
      }
      catch (err) {
        log.errorf('Failed to parse buildbot response: ${err}',
                  {'err': err.toString()});
        return;
      }

      self._handleGotBody(body);
    }

    res.on('data', handleData);
    res.on('end', handleEnd);

    if (res.statusCode !== 200) {
      var err = new Error('Failed fetching builder status data, statusCode !== 200');
      res.removeAllListeners('data');
      res.removeAllListeners('end');
      log.errorf(err.message);
      return;
    }
  });

  request.on('error', function(err) {
    log.errorf(err.message);
  });
};

Buildbot.prototype._handleGotBody = function(body) {
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

Buildbot.prototype.sendChanges = function(pullId, revision, user, project,
                                          repository, category, branch,
                                          callback) {
  // Send changes which will trigger a build
  var name = user.name.replace(/[^a-zA-Z0-9-._~\s]/g, ''); // Buildbot doesn't like unicode
  var nickname = user.login;
  var who = sprintf('%s <%s>', name, user.email);

  var properties = {
    'pull-request-id': pullId,
    'github-nickname': nickname
  };

  var body = querystring.stringify({
    'project': project,
    'repository': repository,
    'revision': revision,
    'who': who,
    'branch': branch,
    'category': category,
    'comments': 'triggered build',
    'properties': JSON.stringify(properties)
  });

  var reqOptions = this._reqObj(this._options['change_hook_path'], 'POST');
  reqOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
  reqOptions.headers['Content-length'] = body.length;

  var req = this._http.request(reqOptions, function onResponse(res) {
    var data = '';

    function onData(chunk) {
      data += chunk;
    }

    function onEnd() {
      callback(null, data.toString());
    }

    res.on('data', onData);
    res.on('end', onEnd);
  });

  req.on('error', callback);

  req.end(body);
};

exports.Buildbot = Buildbot;
