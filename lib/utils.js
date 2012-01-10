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

var crypto = require('crypto');

var sprintf = require('sprintf').sprintf;

function getAuthHeader(username, password) {
  var auth;

  if (!username || !password) {
    throw new Error('Missing username or password');
  }

  auth = 'Basic ' + new Buffer(username + ':' + password).toString('base64');
  return auth;
}

exports.getAuthHeader = getAuthHeader;
