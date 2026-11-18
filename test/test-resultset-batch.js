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

  const execute = (sql) => new Promise((resolve, reject) => {
    query(sql, (err, resultset) => (err ? reject(err) : resolve(resultset)));
  });

  const readBatches = async (sql, options) => {
    const iter = await (await execute(sql)).toObjectBatchIter(options);
    const batches = [];
    for await (const rows of iter) {
      batches.push(rows);
    }
    return { batches, iter };
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

  it('should return typed values', async function() {
    const { batches, iter } = await readBatches("SELECT * FROM batch ORDER BY id;");

    expect(iter.labels).to.deep.equal(
      ['ID', 'B', 'TI', 'SI', 'BI', 'R', 'D', 'DEC', 'S', 'DT', 'TM', 'TS', 'BIN']
    );
    expect(iter.types).to.have.lengthOf(13);
    expect(batches).to.deep.equal([[
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
        S: 'q"b\\s\nt\t\u0001\u00e9\u2028',
        DT: '2024-01-02', TM: '03:04:05', TS: '2024-01-02 03:04:05.123', BIN: 'AP8Q'
      }
    ]]);
  });

  it('should match toObjArray', async function() {
    const sql = "SELECT id, b, ti, si, bi, r, d, dec, s, dt, tm, ts FROM batch ORDER BY id;";
    const { batches } = await readBatches(sql);
    const resultset = await execute(sql);
    const rows = await new Promise((resolve, reject) => {
      resultset.toObjArray((err, result) => (err ? reject(err) : resolve(result)));
    });

    expect(batches[0]).to.deep.equal(rows);
  });

  it('should split rows by batchSize', async function() {
    const { batches } = await readBatches(
      "SELECT x.id * 10 + y.id AS n FROM batch x, batch y ORDER BY 1;",
      { batchSize: 4 }
    );

    expect(batches.map((rows) => rows.length)).to.deep.equal([4, 4, 1]);
    expect([].concat(...batches).map((row) => row.N)).to.deep.equal([11, 12, 13, 21, 22, 23, 31, 32, 33]);
  });

  it('should cut a batch by maxBatchChars', async function() {
    const { batches } = await readBatches("SELECT id FROM batch ORDER BY id;", { maxBatchChars: 1 });

    expect(batches).to.deep.equal([[{ ID: 1 }], [{ ID: 2 }], [{ ID: 3 }]]);
  });

  it('should return no batches for an empty result set', async function() {
    const { batches } = await readBatches("SELECT * FROM batch WHERE id = -1;");

    expect(batches).to.deep.equal([]);
  });

  it('should read batch by batch with next()', async function() {
    const iter = await (await execute("SELECT id FROM batch ORDER BY id;")).toObjectBatchIter({ batchSize: 2 });

    expect(await iter.next()).to.deep.equal([{ ID: 1 }, { ID: 2 }]);
    expect(await iter.next()).to.deep.equal([{ ID: 3 }]);
    expect(await iter.next()).to.be.null;
  });

  it('should reject when the result set is closed', async function() {
    const resultset = await execute("SELECT id FROM batch;");
    const iter = await resultset.toObjectBatchIter();
    await new Promise((resolve) => resultset.close(resolve));

    let error = null;
    try {
      await iter.next();
    } catch (e) {
      error = e;
    }
    expect(error).to.be.an('error');
  });
});
