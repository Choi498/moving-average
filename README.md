# Moving Average

Warm-up-aware simple and exponential moving averages for streaming data. Every
`push` returns an object saying whether the average has seen enough samples to
be trustworthy, along with the current value (partial during warm-up).

## Usage

```js
import { SimpleMovingAverage, ExponentialMovingAverage } from 'moving-average';

const sma = new SimpleMovingAverage(3);
sma.push(2); // { ready: false, value: 2,    count: 1 }
sma.push(4); // { ready: false, value: 3,    count: 2 }
sma.push(6); // { ready: true,  value: 4,    count: 3 }
sma.push(8); // { ready: true,  value: 6,    count: 3 }  // window slid

const ema = new ExponentialMovingAverage(3);
ema.push(10); // { ready: false, value: 10,   count: 1 }
ema.push(20); // { ready: false, value: 15,   count: 2 }
ema.push(30); // { ready: true,  value: 22.5, count: 3 }
```

Exports: `SimpleMovingAverage`, `ExponentialMovingAverage`. Each constructor
takes a positive integer `period`. `push(sample)` returns
`{ ready: boolean, value: number, count: number }`. `reset()` clears internal
state. `SimpleMovingAverage` exposes `period`; `ExponentialMovingAverage`
exposes `period` and `alpha`.

## Why

Most EMA implementations seed from zero, which biases the first several values
downward for no reason. This library seeds the EMA with the first observed
sample, so the average is meaningful from the first push and evolves from there.
The SMA uses a ring buffer with incremental sum updates, so cost per push is
O(1) and memory is bounded by `period`.

The trade-off: during warm-up the returned `value` is a partial mean (SMA) or a
lightly-smoothed estimate (EMA), not a fully-formed windowed average. Callers
that want to suppress output until warm-up completes should check `ready` and
ignore `value` otherwise. The library does not try to guess which behavior you
want; it gives you both pieces and lets you decide.

## Edge cases

Non-finite samples (`NaN`, `Infinity`, `-Infinity`) throw `RangeError`, because
they poison incremental sums and the recurrence. Non-integer or non-positive
periods throw `RangeError` at construction. Period 1 is allowed: the SMA echoes
the latest sample, the EMA tracks it with `alpha = 1`.

Float comparisons in your own code should use a tolerance — incremental
arithmetic and the EMA recurrence both accumulate rounding error. The tests in
this repo use a relative tolerance of `1e-9`.

## Design notes

The window stores values eagerly rather than keeping running aggregates. Running
sums drift with floating point over long streams, and recomputing from a small
buffer is cheap enough that the drift is not worth the speed.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

## Limitations

Values are coerced to floats, so very large integers lose precision. If you need
exact integer aggregates over a window, this is the wrong tool.

