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

const hsqldb = new JDBC({
  url: 'jdbc:hsqldb:hsql://localhost/xdb',
  drivername: 'org.hsqldb.jdbc.JDBCDriver',
  user: 'SA',
  password: '',
  minpoolsize: 1
});

const COLUMNS = ['B', 'TI', 'SI', 'I', 'BI', 'R', 'D', 'DEC', 'S'];

describe('ResultSet NULL handling', function() {
  let testconn = null;

  const update = (sql, done) => {
    testconn.conn.createStatement((err, statement) => {
      if (err) return done(err);
      statement.executeUpdate(sql, (err) => done(err));
    });
  };

  const select = (sql, callback) => {
    testconn.conn.createStatement((err, statement) => {
      if (err) return callback(err);
      statement.executeQuery(sql, (err, resultset) => {
        if (err) return callback(err);
        resultset.toObjArray(callback);
      });
    });
  };

  before(function(done) {
    hsqldb.initialize((err) => {
      if (err) return done(err);
      hsqldb.reserve((err, conn) => {
        if (err) return done(err);
        testconn = conn;
        update(
          "CREATE TABLE nulls (id int, b BOOLEAN, ti TINYINT, si SMALLINT, i INTEGER, bi BIGINT, " +
          "r REAL, d DOUBLE, dec DECIMAL(10,2), s VARCHAR(10));",
          done
        );
      });
    });
  });

  after(function(done) {
    update("DROP TABLE nulls;", (err) => {
      hsqldb.release(testconn, () => done(err));
    });
  });

  it('should insert', function(done) {
    update(
      "INSERT INTO nulls VALUES " +
      "(1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL), " +
      "(2, FALSE, 0, 0, 0, 0, 0, 0, 0, ''), " +
      "(3, TRUE, 1, 2, 3, 4, 1.5, 2.5, 3.25, 'x');",
      done
    );
  });

  it('should return null for NULL in every column type', function(done) {
    select("SELECT * FROM nulls WHERE id = 1;", (err, results) => {
      expect(err).to.be.null;
      expect(results).to.have.lengthOf(1);
      COLUMNS.forEach((column) => {
        expect(results[0][column], column).to.be.null;
      });
      done();
    });
  });

  it('should keep zero and false values', function(done) {
    select("SELECT * FROM nulls WHERE id = 2;", (err, results) => {
      expect(err).to.be.null;
      expect(results).to.have.lengthOf(1);
      expect(results[0]).to.deep.equal({
        ID: 2, B: false, TI: 0, SI: 0, I: 0, BI: '0', R: 0, D: 0, DEC: '0.00', S: ''
      });
      done();
    });
  });

  it('should return non-null values', function(done) {
    select("SELECT * FROM nulls WHERE id = 3;", (err, results) => {
      expect(err).to.be.null;
      expect(results).to.have.lengthOf(1);
      expect(results[0]).to.deep.equal({
        ID: 3, B: true, TI: 1, SI: 2, I: 3, BI: '4', R: 1.5, D: 2.5, DEC: '3.25', S: 'x'
      });
      done();
    });
  });
});
