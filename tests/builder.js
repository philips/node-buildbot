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

var Buildbot = require('../buildbot').Buildbot;
var nock = require('nock');
var request = require('request');
var async = require('async');
var logmagic = require('logmagic');
var fs = require('fs');
var sprintf = require('sprintf').sprintf;

var base_url = "http://buildbot.example.com"

function setupTest() {
  var bb = new Buildbot(base_url);
  var builder = bb.builder('Linux', {'poll_interval': 0});
  return builder;
}

exports['test_buildbot_build_in_progress'] = function(test, assert) {
  var scope = nock(base_url)
                .get('/json/builders/Linux/builds/')
                .replyWithFile(200, __dirname + '/fixtures/in_progress.json');
  bb = setupTest();
  bb.start();
  bb.on('in_progress_build', function(build) {
    bb.stop();
    assert.equal(18529, build.number);
    scope.done();
    test.finish();
  });
}

exports['test_buildbot_build_finished'] = function(test, assert) {
  var scope = nock(base_url)
                .get('/json/builders/Linux/builds/')
                .replyWithFile(200, __dirname + '/fixtures/completed_build.json');
  bb = setupTest();
  bb.start();
  bb.on('new_build', function(build) {
    bb.stop();
    assert.equal(18529, build.number);
    scope.done();
    test.finish();
  });
}

exports['test_buildbot_builder_build'] = function(test, assert) {
  bb = setupTest();
  var revision = 'deadbeef';

  var body = 'username=philips&revision=deadbeef';
  var path = sprintf(bb._forceURL, 'Linux');
  var scope = nock(base_url)
                  .post(path, body)
                  .reply(201, 'OK');
  bb.build(revision, {name: 'philips'}, function(error, body) {
    scope.done();
    test.finish();
  });
}

exports['test_buildbot_builder_get_revision'] = function(test, assert) {
  var filename = __dirname + '/fixtures/completed_build.json';

  var builds = JSON.parse(fs.readFileSync(filename));
  var scope = nock(base_url)
                .get('/json/builders/Linux/builds/')
                .replyWithFile(200, filename);
  bb = setupTest();
  bb.getRevision('115044', function(error, build) {
    assert.equal(build['number'], builds['-1']['number']);
    scope.done();
    test.finish();
  });
}
