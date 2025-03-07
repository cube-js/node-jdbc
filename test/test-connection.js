const { expect } = require('chai');
const jinst = require('../lib/jinst');
const dm = require('../lib/drivermanager');
const Connection = require('../lib/connection');
const ResultSet = require('../lib/resultset');
const java = jinst.getInstance();

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

let testconn = null;

describe('JDBC Connection Tests', function () {
  beforeEach(function (done) {
    if (testconn === null) {
      dm.getConnection(config.url, config.user, config.password, (err, conn) => {
        if (err) return done(err);
        testconn = new Connection(conn);
        done();
      });
    } else {
      done();
    }
  });

  it('should return NOT IMPLEMENTED error on abort', function (done) {
    testconn.abort(null, (err) => {
      expect(err).to.exist;
      expect(err.message).to.equal("NOT IMPLEMENTED");
      done();
    });
  });

  it('should clear warnings', function (done) {
    testconn.clearWarnings((err) => {
      expect(err).to.be.null;
      done();
    });
  });

  it('should close connection', function (done) {
    testconn.close((err) => {
      expect(err).to.be.null;
      testconn = null;
      done();
    });
  });

  it('should handle closing a null connection gracefully', function (done) {
    testconn._conn = null;
    testconn.close((err) => {
      expect(err).to.be.null;
      testconn = null;
      done();
    });
  });

  it('should commit without error', function (done) {
    testconn.commit((err) => {
      expect(err).to.be.null;
      done();
    });
  });

  it('should return NOT IMPLEMENTED error on createArrayOf', function (done) {
    testconn.createArrayOf(null, null, (err) => {
      expect(err).to.exist;
      expect(err.message).to.equal("NOT IMPLEMENTED");
      done();
    });
  });

  it('should return NOT IMPLEMENTED error on createBlob', function (done) {
    testconn.createBlob((err) => {
      expect(err).to.exist;
      expect(err.message).to.equal("NOT IMPLEMENTED");
      done();
    });
  });

  it('should create a statement', function (done) {
    testconn.createStatement((err, statement) => {
      expect(err).to.be.null;
      expect(statement).to.exist;
      done();
    });
  });

  it('should get auto commit status', function (done) {
    testconn.getAutoCommit((err, result) => {
      expect(err).to.be.null;
      expect(result).to.be.true;
      done();
    });
  });

  it('should get metadata', function (done) {
    testconn.getMetaData((err, metadata) => {
      expect(err).to.be.null;
      expect(metadata).to.exist;
      done();
    });
  });

  it('should check if connection is closed', function (done) {
    testconn.isClosed((err, closed) => {
      expect(err).to.be.null;
      expect(closed).to.be.false;
      done();
    });
  });
});
