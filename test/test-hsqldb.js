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
  drivername: 'org.hsqldb.jdbc.JDBCDriver',
  user: 'SA',
  password: '',
  minpoolsize: 10
};

const hsqldb = new JDBC(config);
let testconn = null;
const testDate = Date.now();

describe('JDBC HSQLDB Prepared Statements Tests', function() {
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

  it('should initialize', function(done) {
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

          statement.close(function(err) {
            if (err) return done(err);
            done();
          });
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

  it('should update', function(done) {
    testconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.executeUpdate(
        "UPDATE blah SET id = 2 WHERE name = 'Jason';",
        function(err, result) {
          expect(err).to.be.null;
          expect(result).to.equal(1);
          done();
        }
      );
    });
  });

  it('should select', function(done) {
    testconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.executeQuery("SELECT * FROM blah;", function(err, resultset) {
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

  it('should use prepared select setint', function(done) {
    testconn.conn.prepareStatement("SELECT * FROM blah WHERE id=?", function(err, statement) {
      if (err) return done(err);

      statement.setInt(1, 2, function(err) {
        if (err) return done(err);

        statement.executeQuery(function(err, resultset) {
          expect(err).to.be.null;
          expect(resultset).to.exist;

          resultset.toObjArray(function(err, results) {
            expect(err).to.be.null;
            expect(results).to.have.lengthOf(1);
            done();
          });
        });
      });
    });
  });

  it('should use prepared select setstring', function(done) {
    testconn.conn.prepareStatement("SELECT * FROM blah WHERE name=?", function(err, statement) {
      if (err) return done(err);

      statement.setString(1, 'Jason', function(err) {
        if (err) return done(err);

        statement.executeQuery(function(err, resultset) {
          expect(err).to.be.null;
          expect(resultset).to.exist;

          resultset.toObjArray(function(err, results) {
            expect(err).to.be.null;
            expect(results).to.have.lengthOf(1);
            done();
          });
        });
      });
    });
  });

  it('should use prepared insert setdate', function(done) {
    const myjava = jinst.getInstance();
    testconn.conn.prepareStatement("INSERT INTO blah (id,name,date) VALUES (3,'should ',?)", function(err, statement) {
      if (err) return done(err);

      const sqlDate = myjava.newInstanceSync("java.sql.Date", myjava.newLong(testDate));
      statement.setDate(1, sqlDate, null, function(err) {
        if (err) return done(err);

        statement.executeUpdate(function(err, numrows) {
          expect(err).to.be.null;
          expect(numrows).to.equal(1);
          done();
        });
      });
    });
  });

  it('should use prepared select setdate', function(done) {
    const myjava = jinst.getInstance();
    testconn.conn.prepareStatement("SELECT * FROM blah WHERE id = 3 AND date = ?", function(err, statement) {
      if (err) return done(err);

      const sqlDate = myjava.newInstanceSync("java.sql.Date", myjava.newLong(testDate));
      statement.setDate(1, sqlDate, null, function(err) {
        if (err) return done(err);

        statement.executeQuery(function(err, resultset) {
          expect(err).to.be.null;
          expect(resultset).to.exist;

          resultset.toObjArray(function(err, results) {
            expect(err).to.be.null;
            expect(results).to.have.lengthOf(1);
            done();
          });
        });
      });
    });
  });

  it('should use prepared insert settimestamp', function(done) {
    const myjava = jinst.getInstance();
    testconn.conn.prepareStatement("INSERT INTO blah (id,name,timestamp) VALUES (4,'should ',?)", function(err, statement) {
      if (err) return done(err);

      const sqlTimestamp = myjava.newInstanceSync("java.sql.Timestamp", myjava.newLong(testDate));
      statement.setTimestamp(1, sqlTimestamp, null, function(err) {
        if (err) return done(err);

        statement.executeUpdate(function(err, numrows) {
          expect(err).to.be.null;
          expect(numrows).to.equal(1);
          done();
        });
      });
    });
  });

  it('should use prepared select settimestamp', function(done) {
    const myjava = jinst.getInstance();
    testconn.conn.prepareStatement("SELECT * FROM blah WHERE id = 4 AND timestamp = ?", function(err, statement) {
      if (err) return done(err);

      const sqlTimestamp = myjava.newInstanceSync("java.sql.Timestamp", myjava.newLong(testDate));
      statement.setTimestamp(1, sqlTimestamp, null, function(err) {
        if (err) return done(err);

        statement.executeQuery(function(err, resultset) {
          expect(err).to.be.null;
          expect(resultset).to.exist;

          resultset.toObjArray(function(err, results) {
            expect(err).to.be.null;
            expect(results).to.have.lengthOf(1);
            done();
          });
        });
      });
    });
  });

  it('should delete', function(done) {
    testconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.executeUpdate(
        "DELETE FROM blah WHERE id = 2;",
        function(err, result) {
          expect(err).to.be.null;
          expect(result).to.equal(1);
          done();
        }
      );
    });
  });

  it('should cancel', function(done) {
    testconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.cancel(function(err) {
        expect(err).to.be.null;
        done();
      });
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
