import { SystemClock, remainingFloorMs } from './clock.service';

describe('remainingFloorMs', () => {
  it('returns the unspent remainder of the floor', () => {
    expect(remainingFloorMs(40, 300)).toBe(260);
    expect(remainingFloorMs(0, 300)).toBe(300);
  });

  it('returns zero once the floor is already met or exceeded', () => {
    expect(remainingFloorMs(300, 300)).toBe(0);
    expect(remainingFloorMs(1_000, 300)).toBe(0);
  });

  it('never returns a negative delay', () => {
    expect(remainingFloorMs(Number.MAX_SAFE_INTEGER, 300)).toBe(0);
  });

  it('falls back to the full floor for a nonsensical elapsed time', () => {
    // A clock that jumped backwards must not shorten the floor.
    expect(remainingFloorMs(-5, 300)).toBe(300);
    expect(remainingFloorMs(Number.NaN, 300)).toBe(300);
  });
});

describe('SystemClock', () => {
  it('reports a plausible current time', () => {
    const before = Date.now();
    const now = new SystemClock().now();
    expect(now).toBeGreaterThanOrEqual(before);
  });

  it('resolves immediately for a non-positive delay without scheduling a timer', async () => {
    jest.useFakeTimers();
    try {
      const clock = new SystemClock();
      // Would hang under fake timers if it scheduled a real timeout.
      await expect(clock.sleep(0)).resolves.toBeUndefined();
      await expect(clock.sleep(-10)).resolves.toBeUndefined();
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('schedules a timer for a positive delay', async () => {
    jest.useFakeTimers();
    try {
      const clock = new SystemClock();
      const pending = clock.sleep(300);
      expect(jest.getTimerCount()).toBe(1);
      jest.advanceTimersByTime(300);
      await expect(pending).resolves.toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });
});
