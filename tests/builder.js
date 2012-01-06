var Buildbot = require('../buildbot').Buildbot;
var nock = require('nock');
var request = require('request');
var async = require('async');
var logmagic = require('logmagic');
var sprintf = require('sprintf').sprintf;

var base_url = "http://buildbot.example.com"

function setupPollTest() {
  var bb = new Buildbot(base_url);
  var builder = bb.builder('Linux', {'poll_interval': 0});
  return builder;
}

exports['test_buildbot_in_progress'] = function(test, assert) {
  var scope = nock(base_url)
                .get('/json/builders/Linux/builds/')
                .replyWithFile(200, __dirname + '/fixtures/in_progress.json')
                .log(console.log);
  bb = setupPollTest();
  bb.start();
  bb.on('in_progress_build', function(build) {
    bb.stop();
    assert.equal(18529, build.number);
    scope.done();
    test.finish();
  });
}

exports['test_buildbot_finished'] = function(test, assert) {
  var scope = nock(base_url)
                .get('/json/builders/Linux/builds/')
                .replyWithFile(200, __dirname + '/fixtures/completed_build.json')
                .log(console.log);
  bb = setupPollTest();
  bb.start();
  bb.on('new_build', function(build) {
    bb.stop();
    assert.equal(18529, build.number);
    scope.done();
    test.finish();
  });
}


