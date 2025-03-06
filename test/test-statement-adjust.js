const chai = require('chai');
const expect = chai.expect;
const jinst = require('../lib/jinst');
const JDBC = require('../lib/jdbc');
const async = require('async');

if (!jinst.isJvmCreated()) {
  jinst.addOption("-Xrs");
  jinst.setupClasspath([
    './drivers/hsqldb.jar',
    './drivers/derby.jar',
    './drivers/derbyclient.jar',
    './drivers/derbytools.jar'
  ]);
}

const derby = new JDBC({
  url: 'jdbc:derby://localhost:1527/testdb;create=true'
});

let testconn = null;

describe('JDBC Derby Multiple Inserts Tests', function() {
  beforeEach(function(done) {
    if (testconn === null && derby._pool.length > 0) {
      derby.reserve(function(err, conn) {
        if (err) return done(err);
        testconn = conn;
        done();
      });
    } else {
      done();
    }
  });

  afterEach(function(done) {
    if (testconn) {
      derby.release(testconn, function(err) {
        testconn = null;
        done(err);
      });
    } else {
      done();
    }
  });

  it('should initialize', function(done) {
    derby.initialize(function(err) {
      expect(err).to.be.null;
      done();
    });
  });

  it('should create table', function(done) {
    testconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      const create = "CREATE TABLE blahMax " +
        "(id int, name varchar(10), date DATE, time TIME, timestamp TIMESTAMP)";

      statement.executeUpdate(create, function(err) {
        expect(err).to.be.null;
        done();
      });
    });
  });

  it('should make MultipleInserts', function(done) {
    testconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      async.times(50, function(n, next) {
        const insert = "INSERT INTO blahMax VALUES " +
          `(${n}, 'Jason_${n}', CURRENT_DATE, CURRENT_TIME, CURRENT_TIMESTAMP)`;

        statement.executeUpdate(insert, function(err, result) {
          next(err, result);
        });
      }, function(err, results) {
        expect(err).to.be.null;
        expect(results).to.have.lengthOf(50);
        expect(results).to.exist;
        done();
      });
    });
  });

  it('should select', function(done) {
    testconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.executeQuery("SELECT * FROM blahMax", function(err, resultset) {
        expect(err).to.be.null;
        expect(resultset).to.exist;

        resultset.toObjArray(function(err, results) {
          expect(err).to.be.null;
          expect(results).to.have.lengthOf(50);
          expect(results[0].NAME).to.match(/^Jason/);
          expect(results[0].DATE).to.exist;
          expect(results[0].TIME).to.exist;
          expect(results[0].TIMESTAMP).to.exist;
          done();
        });
      });
    });
  });

  it('should selectWithMax10Rows', function(done) {
    testconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.setMaxRows(10, function(err) {
        if (err) return done(err);

        statement.executeQuery("SELECT * FROM blahMax", function(err, resultset) {
          expect(err).to.be.null;
          expect(resultset).to.exist;

          resultset.toObjArray(function(err, results) {
            expect(err).to.be.null;
            expect(results).to.have.lengthOf(10);
            expect(results[0].NAME).to.match(/^Jason/);
            done();
          });
        });
      });
    });
  });

  it('should selectWithMax70Rows', function(done) {
    testconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.setMaxRows(70, function(err) {
        if (err) return done(err);

        statement.executeQuery("SELECT * FROM blahMax", function(err, resultset) {
          expect(err).to.be.null;
          expect(resultset).to.exist;

          resultset.toObjArray(function(err, results) {
            expect(err).to.be.null;
            expect(results).to.have.lengthOf(50);
            expect(results[0].NAME).to.match(/^Jason/);
            done();
          });
        });
      });
    });
  });

  it('should drop table', function(done) {
    testconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.executeUpdate("DROP TABLE blahMax", function(err) {
        expect(err).to.be.null;
        done();
      });
    });
  });
});
