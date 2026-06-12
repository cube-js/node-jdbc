/* jshint node: true */
"use strict";
var jinst = require('./jinst');
var ResultSetMetaData = require('./resultsetmetadata');
var java = jinst.getInstance();
var winston = require('winston');

if (!jinst.isJvmCreated()) {
  jinst.addOption("-Xrs");
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
    typeNames[java.getStaticFieldValue("java.sql.Types", "NUMERIC")] = "BigDecimal";
    typeNames[java.getStaticFieldValue("java.sql.Types", "DECIMAL")] = "BigDecimal";
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
          if (typeName === 'BigDecimal') typeName = 'Double';
          colsmetadata.push({
            label: rsmd._rsmd.getColumnLabelSync(i),
            type: type,
            typeName: typeName,
            getter: 'get' + typeName + 'Sync'
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
                  // If the column is an integer and is null, set result to null and continue
                  if ((type === 'Int' || type === 'Double' || type === 'Boolean') && self._rs.getObjectSync(cmd.label) === null) {
                    result[cmd.label] = null;
                    continue;
                  }

                  result[cmd.label] = self._rs[getter](cmd.label);
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
