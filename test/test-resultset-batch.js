const chai = require('chai');
const expect = chai.expect;
const jinst = require('../lib/jinst');
const JDBC = require('../lib/jdbc');
const v8 = require('v8');
const vm = require('vm');

v8.setFlagsFromString('--allow-natives-syntax');
const hasFastProperties = vm.runInThisContext('(function (o) { return %HasFastProperties(o); })');

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
        ID: 2, B: false, TI: 0, SI: 0, BI: '0', R: 0, D: 0, DEC: '0.00', S: '',
        DT: '1970-01-01', TM: '00:00:00', TS: '1970-01-01 00:00:00.0', BIN: ''
      },
      {
        ID: 3, B: true, TI: 1, SI: 2, BI: '9007199254740993', R: 1.5, D: 2.5, DEC: '3.25',
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

  ['DECIMAL', 'NUMERIC'].forEach((type) => {
    it('should preserve ' + type + ' precision as strings in both readers', async function() {
      const sql = "SELECT CAST(9007199254740993.1234567890 AS " + type + "(30,10)) AS precise_value, " +
        "CAST(-0.0000000001 AS " + type + "(30,10)) AS small_value, " +
        "CAST(0 AS " + type + "(30,10)) AS zero_value, " +
        "CAST(NULL AS " + type + "(30,10)) AS null_value FROM batch WHERE id = 1;";
      const expected = [{
        PRECISE_VALUE: '9007199254740993.1234567890',
        SMALL_VALUE: '-0.0000000001',
        ZERO_VALUE: '0.0000000000',
        NULL_VALUE: null
      }];
      const { batches } = await readBatches(sql);
      expect(batches).to.deep.equal([expected]);

      const resultset = await execute(sql);
      const rows = await new Promise((resolve, reject) => {
        resultset.toObjArray((err, result) => (err ? reject(err) : resolve(result)));
      });
      expect(rows).to.deep.equal(expected);
    });
  });

  it('should split rows by batchSize', async function() {
    const { batches } = await readBatches(
      "SELECT x.id * 10 + y.id AS n FROM batch x, batch y ORDER BY 1;",
      { batchSize: 4 }
    );

    expect(batches.map((rows) => rows.length)).to.deep.equal([4, 4, 1]);
    expect([].concat(...batches).map((row) => row.N)).to.deep.equal(['11', '12', '13', '21', '22', '23', '31', '32', '33']);
  });

  it('should cut a batch by maxBatchChars', async function() {
    const { batches } = await readBatches("SELECT id FROM batch ORDER BY id;", { maxBatchChars: 1 });

    expect(batches).to.deep.equal([[{ ID: 1 }], [{ ID: 2 }], [{ ID: 3 }]]);
  });

  it('should return no batches for an empty result set', async function() {
    const { batches } = await readBatches("SELECT * FROM batch WHERE id = -1;");

    expect(batches).to.deep.equal([]);
  });

  it('should keep wide rows in fast-properties mode', async function() {
    const columns = Array.from({ length: 60 }, (_, i) => `CAST(id + ${i} AS INTEGER) AS c${i}`);
    const { batches } = await readBatches(`SELECT ${columns.join(', ')} FROM batch WHERE id = 1;`);
    const row = batches[0][0];

    expect(Object.keys(row)).to.deep.equal(columns.map((_, i) => `C${i}`));
    expect(row.C0).to.equal(1);
    expect(row.C59).to.equal(60);
    expect(hasFastProperties(row)).to.equal(true);
  });

  it('should return rows wider than the object shape limit', async function() {
    const columns = Array.from({ length: 130 }, (_, i) => `CAST(id + ${i} AS INTEGER) AS c${i}`);
    const { batches } = await readBatches(`SELECT ${columns.join(', ')} FROM batch WHERE id = 1;`);

    expect(Object.keys(batches[0][0])).to.have.lengthOf(130);
    expect(batches[0][0].C129).to.equal(130);
  });

  it('should return a __proto__ column and duplicate labels as plain cells', async function() {
    const { batches } = await readBatches('SELECT id AS "__proto__", id AS x, CAST(id + 1 AS INTEGER) AS x FROM batch WHERE id = 1;');
    const row = batches[0][0];

    expect(Object.getPrototypeOf(row)).to.equal(Object.prototype);
    expect(Object.keys(row)).to.deep.equal(['__proto__', 'X']);
    expect(Object.getOwnPropertyDescriptor(row, '__proto__').value).to.equal(1);
    // The first column of a label wins, as in toObjArray().
    expect(row.X).to.equal(1);
  });

  it('should return a __proto__ column of rows wider than the object shape limit', async function() {
    const columns = Array.from({ length: 130 }, (_, i) => `CAST(id + ${i} AS INTEGER) AS c${i}`);
    const { batches } = await readBatches(`SELECT id AS "__proto__", ${columns.join(', ')} FROM batch WHERE id = 1;`);
    const row = batches[0][0];

    expect(Object.getPrototypeOf(row)).to.equal(Object.prototype);
    expect(Object.keys(row)).to.have.lengthOf(131);
    expect(Object.keys(row)[0]).to.equal('__proto__');
    expect(Object.getOwnPropertyDescriptor(row, '__proto__').value).to.equal(1);
  });

  it('should take the first column of a duplicate label like toObjArray', async function() {
    const sql = 'SELECT id AS x, CAST(id + 1 AS INTEGER) AS x FROM batch WHERE id = 1;';
    const { batches } = await readBatches(sql);
    const resultset = await execute(sql);
    const expected = await new Promise((resolve, reject) => {
      resultset.toObjArray((err, rows) => (err ? reject(err) : resolve(rows)));
    });

    expect(batches[0]).to.deep.equal(expected);
  });

  describe('typeParsers', function() {
    const java = jinst.getInstance();
    const jdbcType = (name) => java.getStaticFieldValue('java.sql.Types', name);
    const sql = "SELECT id, bin, dt, ts, dec, s FROM batch ORDER BY id;";

    it('should convert values of the given JDBC types', async function() {
      const { batches } = await readBatches(sql, {
        typeParsers: {
          [jdbcType('VARBINARY')]: (value) => Buffer.from(value, 'base64'),
          [jdbcType('DATE')]: (value) => new Date(`${value}T00:00:00Z`),
          [jdbcType('DECIMAL')]: Number,
        }
      });
      const rows = batches[0];

      expect(Buffer.isBuffer(rows[2].BIN)).to.equal(true);
      expect(rows[2].BIN.equals(Buffer.from([0x00, 0xff, 0x10]))).to.equal(true);
      expect(rows[1].BIN.length).to.equal(0);
      expect(rows[2].DT).to.be.an.instanceof(Date);
      expect(rows[2].DT.toISOString()).to.equal('2024-01-02T00:00:00.000Z');
      expect(rows[2].DEC).to.equal(3.25);
      // types without a parser are left as they are
      expect(rows[2].ID).to.equal(3);
      expect(rows[2].TS).to.equal('2024-01-02 03:04:05.123');
      expect(rows[2].S).to.be.a('string');
    });

    it('should not call a parser for NULL', async function() {
      const seen = [];
      const { batches } = await readBatches(sql, {
        typeParsers: {
          [jdbcType('VARBINARY')]: (value) => { seen.push(value); return value; },
          [jdbcType('TIMESTAMP')]: (value) => { seen.push(value); return value; },
        }
      });

      expect(batches[0][0]).to.include({ BIN: null, TS: null });
      expect(seen).to.have.lengthOf(4);
      expect(seen).to.not.include(null);
    });

    it('should accept a parser for the result set of any batch', async function() {
      const { batches } = await readBatches("SELECT id FROM batch ORDER BY id;", {
        batchSize: 2,
        typeParsers: { [jdbcType('INTEGER')]: (value) => value * 10 }
      });

      expect(batches).to.deep.equal([[{ ID: 10 }, { ID: 20 }], [{ ID: 30 }]]);
    });

    it('should reject a parser that is not a function', async function() {
      let error = null;
      try {
        await readBatches(sql, { typeParsers: { [jdbcType('DATE')]: 'date' } });
      } catch (e) {
        error = e;
      }

      expect(error).to.be.an.instanceof(TypeError);
    });
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
