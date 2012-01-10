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
var fs = require('fs');
var logmagic = require('logmagic');
var querystring = require('querystring');

var base_url = "http://buildbot.example.com"

exports['test_buildbot_change'] = function(test, assert) {
  var bb = new Buildbot(base_url);
  var user = {"name": "Brandon Philips", "login": "philips", "email": "foo@example.com"};
  var options = {
    project: "node-github",
    repository: "git@github.com:philips/node-buildbot.git",
    revision: "36a4decad246250208d9d982b4a14987f36bc292",
    pull_id: "pull_name",
    category: "foo",
    branch: "master"
  };
  var body = querystring.stringify(bb._sendChangesBody(options, user));
  var scope = nock(base_url)
                  .post(bb._changeHookURL, body)
                  .reply(201, 'OK');
  bb.sendChanges(options, user, function(error, response, body) {
    scope.done();
    test.finish();
  });
}
