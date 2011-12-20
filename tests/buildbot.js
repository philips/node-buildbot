var pollers = require('../lib/pollers');
var builds = require('./fixtures/builds');
var http = require('http');
var async = require('async');
var logmagic = require('logmagic');

exports['test_buildbot_in_progress'] = function(test, assert) {
  server = http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/json'});
    res.end(JSON.stringify(builds.in_progress_build) + "\n");
  })
  server.listen(8000, "127.0.0.1");

  poller = new pollers.BuildbotPoller({
    "host": "127.0.0.1",
    "port": "8000",
    "secure": false,
    "username": null,
    "password": null,
    "change_hook_path": "/change_hook/base",
    "category": "pull-requests",
    "builder_name": "Linux",
    "num_builds": 1
  }, 0);

  poller.start();
  poller.on('in_progress_build', function(build) {
    poller.stop();
    server.close();
    assert.equal(18529, build.number);
    test.finish();
  });
}
