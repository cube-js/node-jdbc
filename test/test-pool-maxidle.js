const lolex = require("lolex");
const Pool = require('../lib/pool');
const chai = require('chai');
const expect = chai.expect;
const jinst = require('../lib/jinst');

if (!jinst.isJvmCreated()) {
  jinst.addOption("-Xrs");
  jinst.setupClasspath(['./drivers/hsqldb.jar',
                        './drivers/derby.jar',
                        './drivers/derbyclient.jar',
                        './drivers/derbytools.jar']);
}

const config = {
  url: 'jdbc:hsqldb:hsql://localhost/xdb',
  user: 'SA',
  password: '',
  minpoolsize: 1,
  maxpoolsize: 1
};

const configWithMaxIdle = {
  url: 'jdbc:hsqldb:hsql://localhost/xdb',
  user: 'SA',
  password: '',
  minpoolsize: 1,
  maxpoolsize: 1,
  maxidle: 20 * 60 * 1000 // 20 minutes
};

const configWithMaxIdleAndKeepAlive = {
  url: 'jdbc:hsqldb:hsql://localhost/xdb',
  user: 'SA',
  password: '',
  minpoolsize: 1,
  maxpoolsize: 1,
  maxidle: 20 * 60 * 1000,
  keepalive: {
    interval: 45 * 60 * 1000,
    query: 'select 1',
    enabled: true
  }
};

let testpool = null;
let conn1Uuid = null;
let clock = null;

describe('Pool Tests', function() {

  describe('Group 1: Normal Reservation', function () {
    beforeEach(function (done) {
      clock = lolex.install();
      testpool = new Pool(config);

      testpool.reserve(function (err, conn) {
        if (err) {
          console.log(err);
          done(err);
        } else {
          conn1Uuid = conn.uuid;
          testpool.release(conn, function (releaseErr) {
            if (releaseErr) {
              console.log(releaseErr);
              done(releaseErr);
            } else {
              done();
            }
          });
        }
      });
    });

    afterEach(function() {
      clock.uninstall();
      testpool = null;
    });

    it('should return the same connection', function(done) {
      clock.tick("20:00");
      testpool.reserve(function(err, conn) {
        if (err) {
          console.log(err);
        } else {
          expect(conn.uuid).to.equal(conn1Uuid);
          expect(err).to.be.null;
          expect(testpool._pool.length).to.equal(0);
          expect(testpool._reserved.length).to.equal(1);
        }
        done();
      });
    });
  });

  describe('Group 2: Max Idle Reservation', function() {
    beforeEach(function (done) {
      clock = lolex.install();
      testpool = new Pool(configWithMaxIdle);

      testpool.reserve(function (err, conn) {
        if (err) {
          console.log(err);
          done(err);
        } else {
          conn1Uuid = conn.uuid;
          testpool.release(conn, function (releaseErr) {
            if (releaseErr) {
              console.log(releaseErr);
              done(releaseErr);
            } else {
              done();
            }
          });
        }
      });
    });

    afterEach(function() {
      clock.uninstall();
    });

    it('should return a new connection after max idle time', function(done) {
      clock.tick("40:00");
      testpool.reserve(function(err, conn) {
        if (err) {
          console.log(err);
        } else {
          expect(conn.uuid).to.not.equal(conn1Uuid);
          expect(err).to.be.null;
          expect(testpool._pool.length).to.equal(0);
          expect(testpool._reserved.length).to.equal(1);
        }
        done();
      });
    });
  });

  describe('Group 3: Max Idle with Keep Alive', function() {
    beforeEach(function (done) {
      clock = lolex.install();
      testpool = new Pool(configWithMaxIdleAndKeepAlive);

      testpool.reserve(function (err, conn) {
        if (err) {
          console.log(err);
          done(err);
        } else {
          conn1Uuid = conn.uuid;
          testpool.release(conn, function (releaseErr) {
            if (releaseErr) {
              console.log(releaseErr);
              done(releaseErr);
            } else {
              done();
            }
          });
        }
      });
    });

    afterEach(function() {
      clock.uninstall();
    });

    it('should return the same connection after max idle time with keep alive', function(done) {
      clock.tick("40:00");
      testpool.reserve(function(err, conn) {
        if (err) {
          console.log(err);
        } else {
          expect(conn.uuid).to.equal(conn1Uuid);
          expect(err).to.be.null;
          expect(testpool._pool.length).to.equal(0);
          expect(testpool._reserved.length).to.equal(1);
        }
        done();
      });
    });
  });
});
