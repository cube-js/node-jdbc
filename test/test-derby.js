const { expect } = require('chai');
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

const derby = new JDBC({ url: 'jdbc:derby://localhost:1527/testdb;create=true' });
let testconn = null;

describe('JDBC Derby Tests', () => {
  before(async () => {
    testconn = await new Promise((resolve, reject) => {
      derby.reserve((err, conn) => (err ? reject(err) : resolve(conn)));
    });
  });

  it('should create table', async () => {
    const statement = await new Promise((resolve, reject) => {
      testconn.conn.createStatement((err, stmt) => (err ? reject(err) : resolve(stmt)));
    });
    const createQuery = `CREATE TABLE blah (id int, bi bigint, name varchar(10), date DATE, time TIME, timestamp TIMESTAMP, dollars NUMERIC(5,2))`;
    await new Promise((resolve, reject) => {
      statement.executeUpdate(createQuery, (err) => (err ? reject(err) : resolve()));
    });
  });

  it('should insert data', async () => {
    const statement = await new Promise((resolve, reject) => {
      testconn.conn.createStatement((err, stmt) => (err ? reject(err) : resolve(stmt)));
    });
    const insertQuery = `INSERT INTO blah VALUES (1, 9223372036854775807, 'Jason', CURRENT_DATE, CURRENT_TIME, CURRENT_TIMESTAMP, 12.01)`;
    await new Promise((resolve, reject) => {
      statement.executeUpdate(insertQuery, (err, result) => {
        if (err) return reject(err);
        expect(result).to.equal(1);
        resolve();
      });
    });
  });

  it('should select data', async () => {
    const statement = await new Promise((resolve, reject) => {
      testconn.conn.createStatement((err, stmt) => (err ? reject(err) : resolve(stmt)));
    });
    await new Promise((resolve, reject) => {
      statement.executeQuery('SELECT * FROM blah', (err, resultset) => {
        if (err) return reject(err);
        expect(resultset).to.exist;
        resultset.toObjArray((err, results) => {
          if (err) return reject(err);
          expect(results.length).to.equal(1);
          expect(results[0].NAME).to.equal('Jason');
          resolve();
        });
      });
    });
  });

  after(async () => {
    const statement = await new Promise((resolve, reject) => {
      testconn.conn.createStatement((err, stmt) => (err ? reject(err) : resolve(stmt)));
    });
    await new Promise((resolve, reject) => {
      statement.executeUpdate('DROP TABLE blah', (err) => (err ? reject(err) : resolve()));
    });
  });
});
