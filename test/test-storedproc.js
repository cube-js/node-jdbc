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
  url: 'jdbc:hsqldb:hsql://localhost/xdb',
  user: 'SA',
  password: ''
};

const hsqldb = new JDBC(config);
let testconn = null;

describe('JDBC HSQLDB Tests', function() {
  beforeEach(function(done) {
    if (testconn === null && hsqldb._pool.length > 0) {
      hsqldb.reserve(function(err, conn) {
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
      hsqldb.release(testconn, function(err) {
        testconn = null;
        done(err);
      });
    } else {
      done();
    }
  });

  it('should init', function(done) {
    hsqldb.initialize(function(err) {
      expect(err).to.be.null;
      done();
    });
  });

  it('should create table', function(done) {
    testconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.executeUpdate(
        "CREATE TABLE blah (id int, name varchar(10), date DATE, time TIME, timestamp TIMESTAMP);",
        function(err, result) {
          expect(err).to.be.null;
          expect(result).to.equal(0);
          done();
        }
      );
    });
  });

  it('should insert', function(done) {
    testconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.executeUpdate(
        "INSERT INTO blah VALUES (1, 'Jason', CURRENT_DATE, CURRENT_TIME, CURRENT_TIMESTAMP);",
        function(err, result) {
          expect(err).to.be.null;
          expect(result).to.equal(1);
          done();
        }
      );
    });
  });

  it('should create procedure', function(done) {
    testconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.executeUpdate(
        "CREATE PROCEDURE new_blah(id int, name varchar(10)) " +
        "MODIFIES SQL DATA " +
        "BEGIN ATOMIC " +
        "  INSERT INTO blah VALUES (id, name, CURRENT_DATE, CURRENT_TIME, CURRENT_TIMESTAMP); " +
        "END;",
        function(err, result) {
          expect(err).to.be.null;
          done();
        }
      );
    });
  });

  it('should call procedure', function(done) {
    testconn.conn.prepareCall("{ call new_blah(2, 'Another')}", function(err, callablestatement) {
      if (err) return done(err);

      callablestatement.execute(function(err, result) {
        expect(err).to.be.null;
        expect(result).to.equal(false);
        done();
      });
    });
  });

  it('should select after call', function(done) {
    testconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.executeQuery("SELECT * FROM blah;", function(err, resultset) {
        expect(err).to.be.null;
        expect(resultset).to.exist;

        resultset.toObjArray(function(err, results) {
          expect(err).to.be.null;
          expect(results).to.have.lengthOf(2);
          expect(results[0].NAME).to.equal('Jason');
          expect(results[0].DATE).to.exist;
          expect(results[0].TIME).to.exist;
          expect(results[0].TIMESTAMP).to.exist;
          done();
        });
      });
    });
  });

  it('should drop procedure', function(done) {
    testconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.executeUpdate(
        "DROP PROCEDURE IF EXISTS new_blah;",
        function(err, result) {
          expect(err).to.be.null;
          done();
        }
      );
    });
  });

  it('should drop table', function(done) {
    testconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.executeUpdate(
        "DROP TABLE blah;",
        function(err, result) {
          expect(err).to.be.null;
          expect(result).to.equal(0);
          done();
        }
      );
    });
  });
});
