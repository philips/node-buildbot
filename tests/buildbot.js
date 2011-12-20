var buildbot = require('../buildbot');
var builds = require('./fixtures/builds');
var http = require('http');
var async = require('async');
var logmagic = require('logmagic');

function setupPollTest(build) {
  var server = http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/json'});
    res.end(JSON.stringify(build) + "\n");
  })
  server.listen(8000, "127.0.0.1");

  var bb = new buildbot.Buildbot({
    "host": "127.0.0.1",
    "port": "8000",
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
  s = setupPollTest(builds.in_progress_build);
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
  s = setupPollTest(builds.finished_build);
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
