var url = require('url');
var util = require('util');
var request = require('request');
var querystring = require('querystring');
var sprintf = require('sprintf').sprintf;
var log = require('logmagic').local('node-buildbot.buildbot');

var utils = require('./utils');
var Builder = require('./builder').Builder;

function Buildbot(base_url, options) {
  this._url = url.parse(base_url);
  options = options || {};
  this._changeHookURL = options['change_hook_path'] || "/change_hook/base";
  this._options = options;
}

Buildbot.prototype.builder = function(name, options) {
  return new Builder(this, name, options);
};

Buildbot.prototype.url = function() {
  return this._url;
};

Buildbot.prototype._sendChangesBody = function(options, user) {
  var name = user.name.replace(/[^a-zA-Z0-9-._~\s]/g, ''); // Buildbot doesn't like unicode

  var properties = {
    'pull-request-id': options['pull_id'],
    'github-nickname': user.login
  };

  var body = {
    'project': options['project'],
    'repository': options['repository'],
    'revision': options['revision'],
    'branch': options['branch'],
    'category': options['category'],
    'who': sprintf('%s <%s>', name, user.email),
    'comments': 'triggered build',
    'properties': JSON.stringify(properties)
  };

  return body;
};

Buildbot.prototype.sendChanges = function(options, user, callback) {
  var body = this._sendChangesBody(options, user);
  var base_url = this.url();
  base_url.pathname = this._changeHookURL;
  request.post({url:url.format(base_url), form:body}, function (error, response, body) {
    callback(error, response, body);
  });
};

exports.Buildbot = Buildbot;
