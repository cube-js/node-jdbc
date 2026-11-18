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

describe('ResultSet toObjectBatchIter', function() {
  let testconn = null;

  const update = (sql, done) => {
    testconn.conn.createStatement((err, statement) => {
      if (err) return done(err);
      statement.executeUpdate(sql, (err) => done(err));
    });
  };

  const query = (sql, callback) => {
    testconn.conn.createStatement((err, statement) => {
      if (err) return callback(err);
      statement.executeQuery(sql, callback);
    });
  };

  const readBatches = (sql, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    query(sql, (err, resultset) => {
      if (err) return callback(err);
      resultset.toObjectBatchIter(options, (err, iter) => {
        if (err) return callback(err);

        const batches = [];
        const read = () => iter.next((err, rows) => {
          if (err) return callback(err);
          if (rows === null) return callback(null, batches, iter);
          batches.push(rows);
          read();
        });
        read();
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
          "CREATE TABLE batch (id int, b BOOLEAN, ti TINYINT, si SMALLINT, bi BIGINT, r REAL, d DOUBLE, " +
          "dec DECIMAL(10,2), s VARCHAR(40), dt DATE, tm TIME, ts TIMESTAMP, bin VARBINARY(8));",
          done
        );
      });
    });
  });

  after(function(done) {
    update("DROP TABLE batch;", (err) => {
      hsqldb.release(testconn, () => done(err));
    });
  });

  it('should insert', function(done) {
    update(
      "INSERT INTO batch VALUES " +
      "(1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL), " +
      "(2, FALSE, 0, 0, 0, 0, 0, 0, '', DATE '1970-01-01', TIME '00:00:00', TIMESTAMP '1970-01-01 00:00:00', X''), " +
      "(3, TRUE, 1, 2, 9007199254740993, 1.5, 2.5, 3.25, U&'q\"b\\005Cs\\000At\\0009\\0001\\00E9\\2028', " +
      "DATE '2024-01-02', TIME '03:04:05', TIMESTAMP '2024-01-02 03:04:05.123', X'00FF10');",
      done
    );
  });

  it('should return typed values', function(done) {
    readBatches("SELECT * FROM batch ORDER BY id;", (err, batches, iter) => {
      expect(err).to.be.null;
      expect(iter.labels).to.deep.equal(
        ['ID', 'B', 'TI', 'SI', 'BI', 'R', 'D', 'DEC', 'S', 'DT', 'TM', 'TS', 'BIN']
      );
      expect(iter.types).to.have.lengthOf(13);
      expect(batches).to.have.lengthOf(1);
      expect(batches[0]).to.deep.equal([
        {
          ID: 1, B: null, TI: null, SI: null, BI: null, R: null, D: null, DEC: null, S: null,
          DT: null, TM: null, TS: null, BIN: null
        },
        {
          ID: 2, B: false, TI: 0, SI: 0, BI: '0', R: 0, D: 0, DEC: 0, S: '',
          DT: '1970-01-01', TM: '00:00:00', TS: '1970-01-01 00:00:00.0', BIN: ''
        },
        {
          ID: 3, B: true, TI: 1, SI: 2, BI: '9007199254740993', R: 1.5, D: 2.5, DEC: 3.25,
          S: 'q"b\\s\nt\t\u0001é ',
          DT: '2024-01-02', TM: '03:04:05', TS: '2024-01-02 03:04:05.123', BIN: 'AP8Q'
        }
      ]);
      done();
    });
  });

  it('should match toObjArray', function(done) {
    const sql = "SELECT id, b, ti, si, bi, r, d, dec, s, dt, tm, ts FROM batch ORDER BY id;";
    readBatches(sql, (err, batches) => {
      expect(err).to.be.null;
      query(sql, (err, resultset) => {
        expect(err).to.be.null;
        resultset.toObjArray((err, rows) => {
          expect(err).to.be.null;
          expect(batches[0]).to.deep.equal(rows);
          done();
        });
      });
    });
  });

  it('should split rows by batchSize', function(done) {
    readBatches(
      "SELECT x.id * 10 + y.id AS n FROM batch x, batch y ORDER BY 1;",
      { batchSize: 4 },
      (err, batches) => {
        expect(err).to.be.null;
        expect(batches.map((rows) => rows.length)).to.deep.equal([4, 4, 1]);
        expect([].concat(...batches).map((row) => row.N)).to.deep.equal([11, 12, 13, 21, 22, 23, 31, 32, 33]);
        done();
      }
    );
  });

  it('should cut a batch by maxBatchChars', function(done) {
    readBatches("SELECT id FROM batch ORDER BY id;", { maxBatchChars: 1 }, (err, batches) => {
      expect(err).to.be.null;
      expect(batches).to.deep.equal([[{ ID: 1 }], [{ ID: 2 }], [{ ID: 3 }]]);
      done();
    });
  });

  it('should return null for an empty result set', function(done) {
    readBatches("SELECT * FROM batch WHERE id = -1;", (err, batches) => {
      expect(err).to.be.null;
      expect(batches).to.deep.equal([]);
      done();
    });
  });
});
