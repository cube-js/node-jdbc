/* jshint node: true */
"use strict";
var jinst = require('./jinst');
var ResultSetMetaData = require('./resultsetmetadata');
var java = jinst.getInstance();
var winston = require('winston');

if (!jinst.isJvmCreated()) {
  jinst.addOption("-Xrs");
}

// Getters that return a Java primitive, which cannot represent SQL NULL.
var PRIMITIVE_TYPE_NAMES = ['Boolean', 'Short', 'Int', 'Float', 'Double'];

var ROW_BATCHER = 'dev.cube.jdbc.RowBatcher';
// RowBatcher.DOUBLE
var DOUBLE_KIND = 2;
var DEFAULT_BATCH_SIZE = 4096;
var DEFAULT_MAX_BATCH_CHARS = 8 * 1024 * 1024;

// V8 keeps at most 128 properties on a fast-mode object, a wider shape is a dictionary itself.
var MAX_OBJECT_SHAPE_COLUMNS = 127;

/**
 * Builds an object holding every column, to be cloned per row with the object spread. Filling a
 * clone overwrites existing fields instead of growing the object, which keeps the row in V8's
 * fast-properties mode: a fresh `{}` filled one property at a time turns into a dictionary past
 * ~19 properties and takes several times more memory.
 *
 * Only the spread clones the shape, `Object.assign({}, shape)` grows a fresh object. JSON.parse
 * returns a fast-mode object and defines a `__proto__` column as an own property.
 *
 * Returns null when cloning cannot pay off and rows should be built from a plain `{}`.
 */
function buildObjectShape(labels) {
  if (labels.length === 0 || labels.length > MAX_OBJECT_SHAPE_COLUMNS) {
    return null;
  }

  return JSON.parse('{' + labels.map(function (label) {
    return JSON.stringify(label) + ':null';
  }).join(',') + '}');
}

function callStatic() {
  var args = Array.prototype.slice.call(arguments);

  return new Promise(function (resolve, reject) {
    args.push(function (err, result) {
      if (err) return reject(err);
      resolve(result);
    });
    java.callStaticMethod.apply(java, args);
  });
}

function ResultSet(rs) {
  this._rs = rs;
  this._holdability = (function () {
    var h = [];

    h[java.getStaticFieldValue('java.sql.ResultSet', 'CLOSE_CURSORS_AT_COMMIT')] = 'CLOSE_CURSORS_AT_COMMIT';
    h[java.getStaticFieldValue('java.sql.ResultSet', 'HOLD_CURSORS_OVER_COMMIT')] = 'HOLD_CURSORS_OVER_COMMIT';

    return h;
  })();
  this._types = (function () {
    var typeNames = [];

    typeNames[java.getStaticFieldValue("java.sql.Types", "BIT")] = "Boolean";
    typeNames[java.getStaticFieldValue("java.sql.Types", "TINYINT")] = "Short";
    typeNames[java.getStaticFieldValue("java.sql.Types", "SMALLINT")] = "Short";
    typeNames[java.getStaticFieldValue("java.sql.Types", "INTEGER")] = "Int";
    typeNames[java.getStaticFieldValue("java.sql.Types", "BIGINT")] = "String";
    typeNames[java.getStaticFieldValue("java.sql.Types", "FLOAT")] = "Float";
    typeNames[java.getStaticFieldValue("java.sql.Types", "REAL")] = "Float";
    typeNames[java.getStaticFieldValue("java.sql.Types", "DOUBLE")] = "Double";
    typeNames[java.getStaticFieldValue("java.sql.Types", "NUMERIC")] = "String";
    typeNames[java.getStaticFieldValue("java.sql.Types", "DECIMAL")] = "String";
    typeNames[java.getStaticFieldValue("java.sql.Types", "CHAR")] = "String";
    typeNames[java.getStaticFieldValue("java.sql.Types", "VARCHAR")] = "String";
    typeNames[java.getStaticFieldValue("java.sql.Types", "LONGVARCHAR")] = "String";
    typeNames[java.getStaticFieldValue("java.sql.Types", "DATE")] = "Date";
    typeNames[java.getStaticFieldValue("java.sql.Types", "TIME")] = "Time";
    typeNames[java.getStaticFieldValue("java.sql.Types", "TIMESTAMP")] = "Timestamp";
    typeNames[java.getStaticFieldValue("java.sql.Types", "BOOLEAN")] = "Boolean";
    typeNames[java.getStaticFieldValue("java.sql.Types", "NCHAR")] = "String";
    typeNames[java.getStaticFieldValue("java.sql.Types", "NVARCHAR")] = "String";
    typeNames[java.getStaticFieldValue("java.sql.Types", "LONGNVARCHAR")] = "String";
    typeNames[java.getStaticFieldValue("java.sql.Types", "BINARY")] = "Bytes";
    typeNames[java.getStaticFieldValue("java.sql.Types", "VARBINARY")] = "Bytes";
    typeNames[java.getStaticFieldValue("java.sql.Types", "LONGVARBINARY")] = "Bytes";
    typeNames[java.getStaticFieldValue("java.sql.Types", "BLOB")] = "Bytes";

    return typeNames;
  })();
}

ResultSet.prototype.toObjArray = function (callback) {
  this.toObject(function (err, result) {
    if (err) return callback(err);
    callback(null, result.rows);
  });
};

ResultSet.prototype.toObject = function (callback) {
  this.toObjectIter(function (err, rs) {
    if (err) return callback(err);

    var rowIter = rs.rows;
    var rows = [];
    var row = rowIter.next();

    while (!row.done) {
      rows.push(row.value);
      row = rowIter.next();
    }

    rs.rows = rows;
    return callback(null, rs);
  });
};

ResultSet.prototype.toObjectIter = function (callback) {
  var self = this;

  self.getMetaData(function (err, rsmd) {
    if (err) {
      return callback(err);
    } else {
      var colsmetadata = [];

      rsmd.getColumnCount(function (err, colcount) {

        if (err)
          return callback(err);

        // Get some column metadata, resolving each column's getter once
        // here rather than for every row.
        for (var i = 1; i <= colcount; i++) {
          var type = rsmd._rsmd.getColumnTypeSync(i);
          var typeName = self._types[type] || 'String';
          colsmetadata.push({
            label: rsmd._rsmd.getColumnLabelSync(i),
            type: type,
            typeName: typeName,
            getter: 'get' + typeName + 'Sync',
            primitive: PRIMITIVE_TYPE_NAMES.indexOf(typeName) !== -1
          });
        }

        callback(null, {
          labels: colsmetadata.map(function (col) { return col.label; }),
          types: colsmetadata.map(function (col) { return col.type; }),
          rows: {
            next: function () {
              var nextRow;
              try {
                nextRow = self._rs.nextSync(); // this row can lead to Java RuntimeException - sould be cathced.
              }
              catch (error) {
                callback(error);
              }
              if (!nextRow) {
                return {
                  done: true
                };
              }

              var result = {};

              // loop through each column
              for (var i = 1; i <= colcount; i++) {
                var cmd = colsmetadata[i - 1];
                var type = cmd.typeName;
                var getter = cmd.getter;

                if (type === 'Date' || type === 'Time' || type === 'Timestamp') {
                  var dateVal = self._rs[getter](cmd.label);
                  result[cmd.label] = dateVal ? dateVal.toString() : null;
                } else {
                  var value = self._rs[getter](cmd.label);

                  // Primitive getters return 0 / false for SQL NULL, so only those values
                  // need a wasNull() round trip to the JVM.
                  if (cmd.primitive && !value && self._rs.wasNullSync()) {
                    value = null;
                  }

                  result[cmd.label] = value;
                }
              }

              return {
                value: result,
                done: false
              };
            }
          }
        });
      });
    }
  });
};

/**
 * Reads the result set in batches. Resolves to `{ labels, types, next }`, where every `next()`
 * call resolves to an array of row objects, or to null once the result set is exhausted. The
 * returned object is also an async iterable of batches.
 *
 * Rows are fetched and serialized inside the JVM on a worker thread, which costs one JNI round
 * trip per batch instead of one per cell and keeps the event loop free.
 *
 * Values match toObjectIter(), except that binary columns are returned as base64 strings.
 */
ResultSet.prototype.toObjectBatchIter = async function (options) {
  options = options || {};

  var rs = this._rs;
  var batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  var maxBatchChars = options.maxBatchChars || DEFAULT_MAX_BATCH_CHARS;

  var kinds = await callStatic(ROW_BATCHER, 'columnKinds', rs);
  var rsmd = rs.getMetaDataSync();

  var labels = [];
  var types = [];
  var doubleColumns = [];

  for (var i = 1; i <= kinds.length; i++) {
    labels.push(rsmd.getColumnLabelSync(i));
    types.push(rsmd.getColumnTypeSync(i));
    if (kinds[i - 1] === DOUBLE_KIND) {
      doubleColumns.push(i - 1);
    }
  }

  var javaKinds = java.newArray('int', Array.prototype.slice.call(kinds));
  var colcount = labels.length;
  var objectShape = buildObjectShape(labels);

  var next = async function () {
    var json = await callStatic(ROW_BATCHER, 'fetch', rs, javaKinds, batchSize, maxBatchChars);
    if (json === null || json === undefined) {
      return null;
    }

    var rows = JSON.parse(json);

    for (var r = 0; r < rows.length; r++) {
      var values = rows[r];

      // JSON has no NaN / Infinity, RowBatcher sends them as strings.
      for (var d = 0; d < doubleColumns.length; d++) {
        var index = doubleColumns[d];
        if (typeof values[index] === 'string') {
          values[index] = Number(values[index]);
        }
      }

      var row = objectShape === null ? {} : { ...objectShape };
      for (var c = 0; c < colcount; c++) {
        row[labels[c]] = values[c];
      }
      rows[r] = row;
    }

    return rows;
  };

  return {
    labels: labels,
    types: types,
    next: next,
    [Symbol.asyncIterator]: async function* () {
      for (var rows = await next(); rows !== null; rows = await next()) {
        yield rows;
      }
    }
  };
};

ResultSet.prototype.close = function (callback) {
  this._rs.close(function (err) {
    if (err) {
      return callback(err);
    } else {
      return callback(null);
    }
  });
};

ResultSet.prototype.getMetaData = function (callback) {
  this._rs.getMetaData(function (err, rsmd) {
    if (err) {
      return callback(err);
    } else {
      return callback(null, new ResultSetMetaData(rsmd));
    }
  });
};

module.exports = ResultSet;
