const { expect } = require('chai');
const jinst = require('../lib/jinst');
const dm = require('../lib/drivermanager.js');
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

describe('JDBC Connection Tests', function () {
  it('should get a connection', function (done) {
    dm.getConnection(`${config.url};user=${config.user};password=${config.password}`, (err, conn) => {
      expect(err).to.be.null;
      expect(conn).to.exist;
      done();
    });
  });

  it('should get a connection with properties', function (done) {
    const Properties = java.import('java.util.Properties');
    const props = new Properties();

    props.putSync('user', config.user);
    props.putSync('password', config.password);

    dm.getConnection(config.url, props, (err, conn) => {
      expect(err).to.be.null;
      expect(conn).to.exist;
      done();
    });
  });

  it('should get a connection with user and password parameters', function (done) {
    dm.getConnection(config.url, config.user, config.password, (err, conn) => {
      expect(err).to.be.null;
      expect(conn).to.exist;
      done();
    });
  });

  it('should set login timeout', function (done) {
    dm.setLoginTimeout(60, (err) => {
      expect(err).to.be.null;
      done();
    });
  });

  it('should get login timeout', function (done) {
    dm.getLoginTimeout((err, seconds) => {
      expect(err).to.be.null;
      expect(seconds).to.equal(60);
      done();
    });
  });
});
