import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SimpleMovingAverage, ExponentialMovingAverage } from '../src/index.js';

// Floats from incremental arithmetic can drift; compare with a tolerance
// rather than ===. Keep the tolerance loose enough to survive reordered
// summation but tight enough to catch real bugs.
const approx = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

test('SMA rejects non-positive or non-integer periods', () => {
  assert.throws(() => new SimpleMovingAverage(0), RangeError);
  assert.throws(() => new SimpleMovingAverage(-1), RangeError);
  assert.throws(() => new SimpleMovingAverage(2.5), RangeError);
  assert.throws(() => new SimpleMovingAverage('3'), RangeError);
});

test('SMA rejects non-finite samples', () => {
  const sma = new SimpleMovingAverage(3);
  assert.throws(() => sma.push(NaN), RangeError);
  assert.throws(() => sma.push(Infinity), RangeError);
  assert.throws(() => sma.push(-Infinity), RangeError);
});

test('SMA reports not ready during warm-up and the partial mean', () => {
  const sma = new SimpleMovingAverage(3);
  let r;

  r = sma.push(2);
  assert.equal(r.ready, false);
  assert.equal(r.count, 1);
  assert.ok(approx(r.value, 2));

  r = sma.push(4);
  assert.equal(r.ready, false);
  assert.equal(r.count, 2);
  assert.ok(approx(r.value, 3));
});

test('SMA becomes ready exactly at period and computes the windowed mean', () => {
  const sma = new SimpleMovingAverage(3);
  sma.push(2);
  sma.push(4);
  const r = sma.push(6);
  assert.equal(r.ready, true);
  assert.equal(r.count, 3);
  assert.ok(approx(r.value, 4));
});

test('SMA slides the window: outgoing sample is removed', () => {
  const sma = new SimpleMovingAverage(3);
  sma.push(2); // window: [2]
  sma.push(4); // window: [2, 4]
  sma.push(6); // window: [2, 4, 6] -> mean 4
  const r = sma.push(8); // window: [4, 6, 8] -> mean 6
  assert.equal(r.ready, true);
  assert.equal(r.count, 3);
  assert.ok(approx(r.value, 6));
});

test('SMA handles negative samples in the window', () => {
  const sma = new SimpleMovingAverage(2);
  sma.push(-5);
  const r = sma.push(5);
  assert.equal(r.ready, true);
  assert.ok(approx(r.value, 0));
});

test('SMA with period 1 echoes the latest sample and is ready immediately', () => {
  const sma = new SimpleMovingAverage(1);
  const r = sma.push(42);
  assert.equal(r.ready, true);
  assert.equal(r.count, 1);
  assert.ok(approx(r.value, 42));
});

test('SMA reset returns to the initial state', () => {
  const sma = new SimpleMovingAverage(3);
  sma.push(1);
  sma.push(2);
  sma.reset();
  const r = sma.push(10);
  assert.equal(r.ready, false);
  assert.equal(r.count, 1);
  assert.ok(approx(r.value, 10));
});

test('SMA period getter returns the configured value', () => {
  const sma = new SimpleMovingAverage(7);
  assert.equal(sma.period, 7);
});

test('EMA rejects invalid periods', () => {
  assert.throws(() => new ExponentialMovingAverage(0), RangeError);
  assert.throws(() => new ExponentialMovingAverage(-3), RangeError);
  assert.throws(() => new ExponentialMovingAverage(1.1), RangeError);
});

test('EMA seeds with the first sample', () => {
  const ema = new ExponentialMovingAverage(3);
  const r = ema.push(10);
  assert.equal(r.ready, false);
  assert.equal(r.count, 1);
  assert.ok(approx(r.value, 10));
});

test('EMA applies the recurrence alpha = 2 / (period + 1)', () => {
  const ema = new ExponentialMovingAverage(3);
  // alpha = 0.5
  assert.ok(approx(ema.alpha, 0.5));

  ema.push(10); // seed: 10
  const r = ema.push(20); // 0.5*20 + 0.5*10 = 15
  assert.ok(approx(r.value, 15));
  assert.equal(r.count, 2);
});

test('EMA becomes ready once count reaches period', () => {
  const ema = new ExponentialMovingAverage(3);
  ema.push(10);
  ema.push(20);
  const r = ema.push(30);
  assert.equal(r.ready, true);
  assert.equal(r.count, 3);
  // 0.5*30 + 0.5*15 = 22.5
  assert.ok(approx(r.value, 22.5));
});

test('EMA continues smoothing after warm-up', () => {
  const ema = new ExponentialMovingAverage(2); // alpha = 2/3
  ema.push(0);   // seed: 0
  ema.push(6);   // (2/3)*6 + (1/3)*0 = 4
  const r = ema.push(6); // (2/3)*6 + (1/3)*4 = 16/3
  assert.equal(r.ready, true);
  assert.ok(approx(r.value, 16 / 3));
});

test('EMA reset clears the seed so the next push re-seeds', () => {
  const ema = new ExponentialMovingAverage(3);
  ema.push(100);
  ema.push(200);
  ema.reset();
  const r = ema.push(7);
  assert.equal(r.ready, false);
  assert.equal(r.count, 1);
  assert.ok(approx(r.value, 7));
});

test('EMA with period 1 is ready immediately and tracks the sample', () => {
  const ema = new ExponentialMovingAverage(1);
  assert.ok(approx(ema.alpha, 1));
  const r = ema.push(9);
  assert.equal(r.ready, true);
  assert.ok(approx(r.value, 9));
});
