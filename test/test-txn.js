const chai = require('chai');
const expect = chai.expect;
const jinst = require('../lib/jinst');
const JDBC = require('../lib/jdbc');

if (!jinst.isJvmCreated()) {
  jinst.addOption("-Xrs");
  jinst.setupClasspath([
    './drivers/hsqldb.jar',
    './drivers/derby.jar',
    './drivers/derbyclient.jar',
    './drivers/derbytools.jar'
  ]);
}

const config = {
  url: 'jdbc:derby://localhost:1527/testdb;create=true',
};

const derby = new JDBC(config);
let testconn = null;

describe('JDBC Derby Tests', function() {
  beforeEach(function(done) {
    if (testconn === null && derby._pool.length > 0) {
      derby.reserve(function(err, conn) {
        if (err) return done(err);
        testconn = conn;
        testconn.conn.setAutoCommit(false, function(err) {
          if (err) return done(err);
          done();
        });
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

      statement.executeUpdate(
        "CREATE TABLE blah (id int, name varchar(10), date DATE, time TIME, timestamp TIMESTAMP)",
        function(err, result) {
          expect(err).to.be.null;
          done();
        }
      );
    });
  });

  it('should insert', function(done) {
    testconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.executeUpdate(
        "INSERT INTO blah VALUES (1, 'Jason', CURRENT_DATE, CURRENT_TIME, CURRENT_TIMESTAMP)",
        function(err, result) {
          expect(err).to.be.null;
          expect(result).to.equal(1);

          testconn.conn.commit(function(err) {
            if (err) console.log(err);
            done();
          });
        }
      );
    });
  });

  it('should update', function(done) {
    testconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.executeUpdate(
        "UPDATE blah SET id = 2 WHERE name = 'Jason'",
        function(err, result) {
          expect(err).to.be.null;
          expect(result).to.equal(1);

          testconn.conn.commit(function(err) {
            if (err) console.log(err);
            done();
          });
        }
      );
    });
  });

  it('should select', function(done) {
    testconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.executeQuery("SELECT * FROM blah", function(err, resultset) {
        expect(err).to.be.null;
        expect(resultset).to.exist;

        resultset.toObjArray(function(err, results) {
          expect(err).to.be.null;
          expect(results).to.have.lengthOf(1);
          expect(results[0].NAME).to.equal('Jason');
          expect(results[0].DATE).to.exist;
          expect(results[0].TIME).to.exist;
          expect(results[0].TIMESTAMP).to.exist;
          done();
        });
      });
    });
  });

  it('should delete rollback', function(done) {
    testconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.executeUpdate(
        "DELETE FROM blah WHERE id = 2",
        function(err, result) {
          expect(err).to.be.null;
          expect(result).to.equal(1);

          testconn.conn.rollback(function(err) {
            if (err) console.log(err);
            done();
          });
        }
      );
    });
  });

  it('should select post rollback', function(done) {
    testconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.executeQuery("SELECT * FROM blah", function(err, resultset) {
        expect(err).to.be.null;
        expect(resultset).to.exist;

        resultset.toObjArray(function(err, results) {
          expect(err).to.be.null;
          expect(results).to.have.lengthOf(1);
          expect(results[0].NAME).to.equal('Jason');
          expect(results[0].DATE).to.exist;
          expect(results[0].TIME).to.exist;
          expect(results[0].TIMESTAMP).to.exist;
          done();
        });
      });
    });
  });

  it('should drop table', function(done) {
    testconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.executeUpdate(
        "DROP TABLE blah",
        function(err, result) {
          expect(err).to.be.null;
          done();
        }
      );
    });
  });
});
