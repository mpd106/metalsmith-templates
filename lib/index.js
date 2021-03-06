
var consolidate = require('consolidate');
var debug = require('debug')('metalsmith-templates');
var each = require('async').each;
var extend = require('extend');
var match = require('multimatch');
var omit = require('lodash.omit');
var path = require('path');
var fs = require('fs');

/**
 * Expose `plugin`.
 */

module.exports = plugin;

/**
 * Settings.
 */

var settings = ['engine', 'directory', 'pattern', 'inPlace', 'default'];

function readPartials(templatesPath, options, fn) {
  if (!options.partials) return fn();
  var partials = options.partials;
  var keys = Object.keys(partials);

  function next(index) {
    if (index == keys.length) return fn(null);
    var key = keys[index];
    var file = path.join(path.dirname(templatesPath), partials[key]);
    read(file, options, function(err, str){
      if (err) return fn(err);
      options.partials[key] = str;
      next(++index);
    });
  }

  next(0);
}

function read(path, options, fn) {
  fs.readFile(path, 'utf8', function(err, str){
    if (err) return fn(err);
    // remove extraneous utf8 BOM marker
    str = str.replace(/^\uFEFF/, '');
    fn(null, str);
  });
}

/**
 * Metalsmith plugin to run files through any template in a template `dir`.
 *
 * @param {String or Object} options
 *   @property {String} default (optional)
 *   @property {String} directory (optional)
 *   @property {String} engine
 *   @property {String} inPlace (optional)
 *   @property {String} pattern (optional)
 * @return {Function}
 */

function plugin(opts){
  opts = opts || {};
  if ('string' == typeof opts) opts = { engine: opts };
  if (!opts.engine) throw new Error('"engine" option required');

  var engine = opts.engine;
  var dir = opts.directory || 'templates';
  var pattern = opts.pattern;
  var inPlace = opts.inPlace;
  var def = opts.default;
  var params = omit(opts, settings);

  return function(files, metalsmith, done){
    var metadata = metalsmith.metadata();

    function check(file){
      var data = files[file];
      var tmpl = data.template || def;
      if (pattern && !match(file, pattern)[0]) return false;
      if (!inPlace && !tmpl) return false;
      return true;
    }

    Object.keys(files).forEach(function(file){
      if (!check(file)) return;
      debug('stringifying file: %s', file);
      var data = files[file];
      data.contents = data.contents.toString();
    });

    each(Object.keys(files), convert, done);

    function convert(file, done){
      if (!check(file)) return done();
      debug('converting file: %s', file);
      var data = files[file];
      var clonedParams = extend(true, {}, params);
      var clone = extend({}, clonedParams, metadata, data);
      var str;
      var render;

      if (inPlace) {
        str = clone.contents;
        render = consolidate[engine].render;
        readPartials(metalsmith.path(dir), clone, function(err) {
          render(str, clone, function(err, str){
            if (err) return done(err);
            data.contents = new Buffer(str);
            debug('converted file: %s', file);
            done();
          });
        });
      } else {
        str = metalsmith.path(dir, data.template || def);
        render = consolidate[engine];
        render(str, clone, function(err, str){
          if (err) return done(err);
          data.contents = new Buffer(str);
          debug('converted file: %s', file);
          done();
        });
      }
    }
  };
}
