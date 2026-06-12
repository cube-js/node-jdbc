/* jshint node: true */
"use strict";
var jinst = require("./jinst.js");
var java = jinst.getInstance();

var DM = 'java.sql.DriverManager';

// args is [url, propsoruser, password]; url must be given, and the
// credentials must be absent, a user/password string pair, or a
// properties object on its own
function isValidConnectionArgs(args) {
  return args[0] && (
    // args[1] (propsoruser) and args[2] (password) can both be falsey
    ! (args[1] || args[2]) ||

    // args[1] (propsoruser) and args[2] (password) can both be strings
    (typeof args[1] === 'string' && typeof args[2] === 'string') ||

    // args[1] (propsoruser) can be an object if args[2] (password) is falsey
    (typeof args[1] === 'object' && args[1] !== null && ! args[2])
  );
}

module.exports = {
  getConnection: function(url, propsoruser, password, callback) {
    // Get arguments as an array
    var args = Array.prototype.slice.call(arguments);

    // Pull the callback off the end of the arguments
    callback = args.pop();

    // Check arguments for validity, and return error if invalid
    if(! isValidConnectionArgs(args)) {
      return callback(new Error("INVALID ARGUMENTS"));
    }

    // Push a callback handler onto the arguments
    args.push(function(err, conn) {
      if (err) {
        return callback(err);
      } else {
        return callback(null, conn);
      }
    });

    // Add DM and 'getConnection' string onto beginning of args
    // (unshift in reverse order of desired order)
    args.unshift('getConnection');
    args.unshift(DM);

    // Forward modified arguments to java.callStaticMethod
    java.callStaticMethod.apply(java, args);
  },
  getConnectionSync: function(url, propsoruser, password) {
    // Get arguments as an array
    var args = Array.prototype.slice.call(arguments);

    // Check arguments for validity, and return error if invalid
    if(! isValidConnectionArgs(args)) {
      return new Error("INVALID ARGUMENTS");
    }

    // Add DM and 'getConnection' string onto beginning of args
    // (unshift in reverse order of desired order)
    args.unshift('getConnection');
    args.unshift(DM);

    // Forward modified arguments to java.callStaticMethod
    return java.callStaticMethodSync.apply(java, args);
  },
  getLoginTimeout: function(callback) {
    java.callStaticMethod(DM, 'getLoginTimeout', function(err, seconds) {
      if (err) {
        return callback(err);
      } else {
        return callback(null, seconds);
      }
    });
  },
  registerDriver: function(driver, callback) {
    java.callStaticMethod(DM, 'registerDriver', driver, function(err) {
      if (err) {
        return callback(err);
      } else {
        return callback(null);
      }
    });
  },
  setLoginTimeout: function(seconds, callback) {
    java.callStaticMethod(DM, 'setLoginTimeout', seconds, function(err) {
      if (err) {
        return callback(err);
      } else {
        return callback(null, true);
      }
    });
  },
};
