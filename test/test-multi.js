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

const configWithUserInUrl = {
  url: 'jdbc:hsqldb:hsql://localhost/xdb;user=SA;password='
};

const configderby = {
  url: 'jdbc:derby://localhost:1527/testdb;create=true'
};

const hsqldb = new JDBC(configWithUserInUrl);
const derby = new JDBC(configderby);
let hsqldbconn = null;
let derbyconn = null;

describe('JDBC HSQLDB Tests', function() {
  beforeEach(function(done) {
    if (hsqldbconn === null && hsqldb._pool.length > 0) {
      hsqldb.reserve(function(err, conn) {
        if (err) return done(err);
        hsqldbconn = conn;
        done();
      });
    } else {
      done();
    }
  });

  afterEach(function(done) {
    if (hsqldbconn) {
      hsqldb.release(hsqldbconn, function(err) {
        hsqldbconn = null;
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
    hsqldbconn.conn.createStatement(function(err, statement) {
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
    hsqldbconn.conn.createStatement(function(err, statement) {
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
    hsqldbconn.conn.createStatement(function(err, statement) {
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
    hsqldbconn.conn.createStatement(function(err, statement) {
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

  it('should select by execute', function(done) {
    hsqldbconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.execute("SELECT * FROM blah;", function(err, resultset) {
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

  it('should update by execute', function(done) {
    hsqldbconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.execute(
        "UPDATE blah SET id = 2 WHERE name = 'Jason';",
        function(err, result) {
          expect(err).to.be.null;
          expect(result).to.equal(1);
          done();
        }
      );
    });
  });

  it('should delete', function(done) {
    hsqldbconn.conn.createStatement(function(err, statement) {
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

  it('should drop table', function(done) {
    hsqldbconn.conn.createStatement(function(err, statement) {
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

describe('JDBC Derby Tests', function() {
  beforeEach(function(done) {
    if (derbyconn === null && derby._pool.length > 0) {
      derby.reserve(function(err, conn) {
        if (err) return done(err);
        derbyconn = conn;
        done();
      });
    } else {
      done();
    }
  });

  afterEach(function(done) {
    if (derbyconn) {
      derby.release(derbyconn, function(err) {
        derbyconn = null;
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
    derbyconn.conn.createStatement(function(err, statement) {
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
    derbyconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.executeUpdate(
        "INSERT INTO blah VALUES (1, 'Jason', CURRENT_DATE, CURRENT_TIME, CURRENT_TIMESTAMP)",
        function(err, result) {
          expect(err).to.be.null;
          expect(result).to.equal(1);
          done();
        }
      );
    });
  });

  it('should update', function(done) {
    derbyconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.executeUpdate(
        "UPDATE blah SET id = 2 WHERE name = 'Jason'",
        function(err, result) {
          expect(err).to.be.null;
          expect(result).to.equal(1);
          done();
        }
      );
    });
  });

  it('should select', function(done) {
    derbyconn.conn.createStatement(function(err, statement) {
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

  it('should select object', function(done) {
    derbyconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.executeQuery("SELECT * FROM blah", function(err, resultset) {
        expect(err).to.be.null;
        expect(resultset).to.exist;

        resultset.toObject(function(err, results) {
          expect(err).to.be.null;
          expect(results.rows).to.have.lengthOf(1);
          expect(results.rows[0].NAME).to.equal('Jason');
          expect(results.rows[0].DATE).to.exist;
          expect(results.rows[0].TIME).to.exist;
          expect(results.rows[0].TIMESTAMP).to.exist;

          expect(results.labels).to.have.lengthOf(5);
          expect(results.labels[0]).to.equal('ID');
          expect(results.labels[1]).to.equal('NAME');
          expect(results.labels[2]).to.equal('DATE');
          expect(results.labels[3]).to.equal('TIME');
          expect(results.labels[4]).to.equal('TIMESTAMP');
          done();
        });
      });
    });
  });

  it('should select zero', function(done) {
    derbyconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.executeQuery("SELECT * FROM blah WHERE id = 1000", function(err, resultset) {
        expect(err).to.be.null;
        expect(resultset).to.exist;

        resultset.toObject(function(err, results) {
          expect(err).to.be.null;
          expect(results.rows).to.have.lengthOf(0);
          expect(results.labels).to.have.lengthOf(5);
          expect(results.labels[0]).to.equal('ID');
          expect(results.labels[1]).to.equal('NAME');
          expect(results.labels[2]).to.equal('DATE');
          expect(results.labels[3]).to.equal('TIME');
          expect(results.labels[4]).to.equal('TIMESTAMP');
          done();
        });
      });
    });
  });

  it('should delete', function(done) {
    derbyconn.conn.createStatement(function(err, statement) {
      if (err) return done(err);

      statement.executeUpdate(
        "DELETE FROM blah WHERE id = 2",
        function(err, result) {
          expect(err).to.be.null;
          expect(result).to.equal(1);
          done();
        }
      );
    });
  });

  it('should drop table', function(done) {
    derbyconn.conn.createStatement(function(err, statement) {
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
