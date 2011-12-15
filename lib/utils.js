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
