var buildbot = require('../buildbot');
var builds = require('./fixtures/builds');
var http = require('http');
var async = require('async');
var logmagic = require('logmagic');

function setupPollTest(port, build) {
  var server = http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/json'});
    res.end(JSON.stringify(build) + "\n");
  })
  server.listen(port, "127.0.0.1");

  var bb = new buildbot.Buildbot({
    "host": "127.0.0.1",
    "port": port,
    "secure": false,
    "username": null,
    "password": null,
    "change_hook_path": "/change_hook/base",
    "category": "pull-requests",
    "builder_name": "Linux",
    "num_builds": 1,
    "poll_interval": 0
  });

  return {'bb': bb, 'server': server}
}

exports['test_buildbot_in_progress'] = function(test, assert) {
  s = setupPollTest(8000, builds.in_progress_build);
  bb = s['bb']
  server = s['server']
  bb.start();
  bb.on('in_progress_build', function(build) {
    bb.stop();
    server.close();
    assert.equal(18529, build.number);
    test.finish();
  });
}

exports['test_buildbot_finished'] = function(test, assert) {
  s = setupPollTest(8001, builds.finished_build);
  bb = s['bb']
  server = s['server']
  bb.start();
  bb.on('new_build', function(build) {
    bb.stop();
    server.close();
    assert.equal(18529, build.number);
    test.finish();
  });
}

exports['test_buildbot_change'] = function(test, assert) {
  var server = http.createServer(function (req, res) {
    req.on('data', function(chunk) {
      assert.equal(builds.query_string, chunk);
    });
    req.on('end', function() {
      assert.equal(req.method, 'POST');
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end("OK");
    });
  });
  server.listen(8003, "127.0.0.1");

  var bb = new buildbot.Buildbot({
    "host": "127.0.0.1",
    "port": "8003",
    "secure": false,
    "username": null,
    "password": null,
    "change_hook_path": "/change_hook/base",
    "category": "pull-requests",
    "builder_name": "Linux",
    "num_builds": 1,
    "poll_interval": 0
  });

  var callback = function(err, str) {
    server.close();
    test.finish();
  };

  var user = {"name": "Brandon Philips", "login": "philips", "email": "foo@example.com"};
  bb.sendChanges("pull_name", "36a4decad246250208d9d982b4a14987f36bc292",
    user, "node-github", "git@github.com:philips/node-buildbot.git",
    "foo", "master", callback);
}
