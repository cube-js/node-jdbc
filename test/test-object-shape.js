const chai = require('chai');
const expect = chai.expect;
const v8 = require('v8');
const vm = require('vm');
const { buildObjectShape, MAX_OBJECT_SHAPE_COLUMNS } = require('../lib/object-shape');

v8.setFlagsFromString('--allow-natives-syntax');
const hasFastProperties = vm.runInThisContext('(function (o) { return %HasFastProperties(o); })');

const names = (count) => Array.from({ length: count }, (_, i) => `c${i}`);

describe('buildObjectShape', function() {
  it('should hold every column with a null value, in order', function() {
    expect(buildObjectShape(['a', 'b'])).to.deep.equal({ a: null, b: null });
    expect(Object.keys(buildObjectShape(['b', 'a']))).to.deep.equal(['b', 'a']);
  });

  it('should return null when there is nothing to clone', function() {
    expect(buildObjectShape([])).to.be.null;
  });

  it('should return null above the fast-properties limit', function() {
    expect(buildObjectShape(names(MAX_OBJECT_SHAPE_COLUMNS))).to.not.be.null;
    expect(buildObjectShape(names(MAX_OBJECT_SHAPE_COLUMNS + 1))).to.be.null;
  });

  it('should keep a filled clone in fast-properties mode', function() {
    const columns = names(60);
    const shape = buildObjectShape(columns);
    const row = { ...shape };
    const plain = {};
    columns.forEach((name, i) => {
      row[name] = i;
      plain[name] = i;
    });

    // A plain `{}` filled the same way is a dictionary on recent V8, but not on every version.
    expect(hasFastProperties(row)).to.equal(true);
    expect(row).to.deep.equal(plain);
  });

  it('should define unsafe names as own properties', function() {
    const shape = buildObjectShape(['__proto__', 'a"b\\c\n']);
    const row = { ...shape };
    row['__proto__'] = 1;

    expect(Object.keys(shape)).to.deep.equal(['__proto__', 'a"b\\c\n']);
    expect(Object.getPrototypeOf(row)).to.equal(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(row, '__proto__').value).to.equal(1);
  });

  it('should collapse duplicate names', function() {
    expect(Object.keys(buildObjectShape(['a', 'b', 'a']))).to.deep.equal(['a', 'b']);
  });
});
