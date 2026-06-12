const asyncjs = require('async');
const Pool = require('../lib/pool');
const jinst = require('../lib/jinst');
const chai = require('chai');
const expect = chai.expect;

let testpool;

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
  password: '',
  minpoolsize: 2,
  maxpoolsize: 3
};

describe('Connection Pool Tests', function() {

  beforeEach(function(done) {
    testpool = new Pool(config);
    testpool.initialize(function(err) {
      done();
    });
  });

  afterEach(function(done) {
    testpool = null;
    done();
  });

  it('should report correct pool status after reserving', function(done) {
    testpool.reserve(function() {
      testpool.status(function(err, status) {
        expect(status.available).to.equal(1);
        expect(status.reserved).to.equal(1);
        done();
      });
    });
  });

  it('should reserve and release connection correctly', function(done) {
    testpool.reserve(function(err, conn) {
      testpool.release(conn, function(err) {
        expect(testpool._pool.length).to.equal(2);
        expect(testpool._reserved.length).to.equal(0);
        done();
      });
    });
  });

  it('should reserve up to min pool size', function(done) {
    asyncjs.times(3, function(n, next) {
      testpool.reserve(function(err, conn) {
        next(err, conn);
      });
    }, function(err, results) {
      expect(testpool._pool.length).to.equal(0);
      expect(testpool._reserved.length).to.equal(3);

      results.forEach(function(conn) {
        testpool.release(conn, function(err) {});
      });
      done();
    });
  });

  it('should not exceed max pool size', function(done) {
    asyncjs.times(4, function(n, next) {
      testpool.reserve(function(err, conn) {
        next(err, conn);
      });
    }, function(err, results) {
      expect(err).to.exist;
      expect(testpool._reserved.length).to.equal(3);
      expect(testpool._pool.length).to.equal(0);

      // asyncjs.times yields no results when it errors out
      (results || []).forEach(function(conn) {
        testpool.release(conn, function(err) {});
      });
      done();
    });
  });

  it('should purge the pool', function(done) {
    testpool.purge(function(err) {
      expect(testpool._pool.length).to.equal(0);
      expect(testpool._reserved.length).to.equal(0);
      done();
    });
  });
});
