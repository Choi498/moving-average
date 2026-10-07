/**
 * Warm-up-aware moving averages.
 *
 * The core idea: a moving average is only meaningful once it has seen enough
 * data. Before that, reporting a value is misleading. Rather than silently
 * returning a partial average, every `push` returns an object describing
 * whether the value is ready, and what the current (possibly partial) state is.
 *
 * All averages use incremental updates — O(1) per push — so they are safe to
 * feed unbounded streams.
 */

/**
 * Result of pushing a sample into a moving average.
 *
 * `ready` is true once the average has seen at least `period` samples. The
 * `value` field always carries the best current estimate: for an SMA it is the
 * mean of the samples seen so far (which becomes the true moving average once
 * `ready`); for an EMA it is the exponential average seeded with the first
 * sample.
 */
export class AverageResult {
  /**
   * @param {boolean} ready Whether the average has completed warm-up.
   * @param {number} value Current average (partial during warm-up).
   * @param {number} count Number of samples observed so far.
   */
  constructor(ready, value, count) {
    this.ready = ready;
    this.value = value;
    this.count = count;
  }
}

/**
 * Simple Moving Average with an explicit warm-up window.
 *
 * Uses a ring buffer so memory is bounded by `period` regardless of stream
 * length. Arithmetic is done incrementally by subtracting the outgoing sample
 * and adding the incoming one, then dividing by the current window size.
 *
 * During warm-up (fewer than `period` samples), the average is the mean of
 * everything seen so far. This is a deliberate choice: some callers want a
 * usable estimate immediately, others want silence. Exposing `ready` lets the
 * caller decide; returning the partial mean avoids forcing a second code path.
 */
export class SimpleMovingAverage {
  /**
   * @param {number} period Number of samples that constitute a full window.
   *   Must be an integer >= 1.
   */
  constructor(period) {
    if (!Number.isInteger(period) || period < 1) {
      throw new RangeError(`period must be a positive integer, got ${period}`);
    }
    this._period = period;
    this._buffer = new Array(period).fill(0);
    this._index = 0; // Next slot to overwrite.
    this._sum = 0;
    this._count = 0; // Samples pushed, capped at period for window sizing.
  }

  /**
   * Add a sample and return the updated average state.
   *
   * @param {number} sample A finite number.
   * @returns {AverageResult}
   */
  push(sample) {
    if (!Number.isFinite(sample)) {
      throw new RangeError(`sample must be finite, got ${sample}`);
    }

    const slot = this._index;
    const outgoing = this._buffer[slot];
    this._buffer[slot] = sample;
    this._index = (slot + 1) % this._period;

    this._sum += sample - outgoing;

    if (this._count < this._period) {
      this._count += 1;
    }

    const value = this._sum / this._count;
    return new AverageResult(this._count === this._period, value, this._count);
  }

  /** Reset to the post-construction state. */
  reset() {
    this._buffer.fill(0);
    this._index = 0;
    this._sum = 0;
    this._count = 0;
  }

  /** @returns {number} The configured period. */
  get period() {
    return this._period;
  }
}

/**
 * Exponential Moving Average with warm-up semantics.
 *
 * The standard EMA recurrence is `ema = alpha * sample + (1 - alpha) * ema`,
 * where `alpha = 2 / (period + 1)`. The awkward part is the seed: starting
 * from zero biases the early values downward. This implementation seeds the
 * EMA with the first observed sample, so after one push the EMA equals that
 * sample and evolves from there.
 *
 * `ready` becomes true once `count >= period`. This matches the SMA's notion
 * of a full window and gives callers a consistent contract across both types.
 */
export class ExponentialMovingAverage {
  /**
   * @param {number} period Smoothing window. Must be an integer >= 1.
   */
  constructor(period) {
    if (!Number.isInteger(period) || period < 1) {
      throw new RangeError(`period must be a positive integer, got ${period}`);
    }
    this._period = period;
    this._alpha = 2 / (period + 1);
    this._value = 0;
    this._count = 0;
    this._seeded = false;
  }

  /**
   * Incorporate a sample and return the updated state.
   *
   * @param {number} sample A finite number.
   * @returns {AverageResult}
   */
  push(sample) {
    if (!Number.isFinite(sample)) {
      throw new RangeError(`sample must be finite, got ${sample}`);
    }

    if (!this._seeded) {
      this._value = sample;
      this._seeded = true;
    } else {
      this._value = this._alpha * sample + (1 - this._alpha) * this._value;
    }

    this._count += 1;
    return new AverageResult(this._count >= this._period, this._value, this._count);
  }

  /** Reset to the post-construction state. */
  reset() {
    this._value = 0;
    this._count = 0;
    this._seeded = false;
  }

  /** @returns {number} The configured period. */
  get period() {
    return this._period;
  }

  /** @returns {number} The smoothing factor alpha = 2 / (period + 1). */
  get alpha() {
    return this._alpha;
  }
}
