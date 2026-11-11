import {
  AUTO_SYNC_READY_SLACK_MS,
  AUTO_SYNC_RETRY_MS,
  AUTO_SYNC_SAVE_DEBOUNCE_MS,
  createAutoSync,
  type AutoSyncResult,
} from './auto-sync';

jest.mock('@/shared/infrastructure/logging', () => ({ logError: jest.fn() }));

/**
 * BUG-049: the queue drains without "Sincronizar ahora" — on start, on return
 * to the foreground, after a save, and on a retry while offline.
 */
describe('automatic sync (BUG-049)', () => {
  let results: AutoSyncResult[];
  let sync: jest.Mock<Promise<AutoSyncResult>, []>;

  beforeEach(() => {
    jest.useFakeTimers();
    results = [];
    sync = jest.fn(() =>
      Promise.resolve(results.shift() ?? { outcome: 'success', pending: 0, nextRetryAt: null }),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs once at start', async () => {
    const auto = createAutoSync({ sync });
    auto.request('start');
    await jest.advanceTimersByTimeAsync(0);
    expect(sync).toHaveBeenCalledTimes(1);
    auto.dispose();
  });

  it('folds a burst of saves into one run after the debounce', async () => {
    const auto = createAutoSync({ sync });
    auto.request('save');
    auto.request('save');
    await jest.advanceTimersByTimeAsync(AUTO_SYNC_SAVE_DEBOUNCE_MS - 1);
    auto.request('save');
    await jest.advanceTimersByTimeAsync(AUTO_SYNC_SAVE_DEBOUNCE_MS - 1);
    expect(sync).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(sync).toHaveBeenCalledTimes(1);
    auto.dispose();
  });

  it('retries while offline with ops pending, and stops once the queue drains', async () => {
    results = [
      { outcome: 'offline', pending: 3, nextRetryAt: null },
      { outcome: 'offline', pending: 3, nextRetryAt: null },
      { outcome: 'success', pending: 0, nextRetryAt: null },
    ];
    const auto = createAutoSync({ sync });
    auto.request('start');
    await jest.advanceTimersByTimeAsync(0);
    expect(sync).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(AUTO_SYNC_RETRY_MS);
    expect(sync).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(AUTO_SYNC_RETRY_MS);
    expect(sync).toHaveBeenCalledTimes(3);
    await jest.advanceTimersByTimeAsync(AUTO_SYNC_RETRY_MS * 5);
    expect(sync).toHaveBeenCalledTimes(3);
    auto.dispose();
  });

  it('does not retry a session or subscription problem: it needs the person', async () => {
    results = [{ outcome: 'blocked', pending: 4, nextRetryAt: null }];
    const auto = createAutoSync({ sync });
    auto.request('start');
    await jest.advanceTimersByTimeAsync(AUTO_SYNC_RETRY_MS * 5);
    expect(sync).toHaveBeenCalledTimes(1);
    auto.dispose();
  });

  it('never runs in the background, and runs when the app returns to the foreground', async () => {
    results = [{ outcome: 'offline', pending: 1, nextRetryAt: null }];
    const auto = createAutoSync({ sync });
    auto.request('start');
    await jest.advanceTimersByTimeAsync(0);
    auto.setActive(false);
    auto.request('save');
    await jest.advanceTimersByTimeAsync(AUTO_SYNC_RETRY_MS * 3);
    expect(sync).toHaveBeenCalledTimes(1);
    auto.setActive(true);
    await jest.advanceTimersByTimeAsync(0);
    expect(sync).toHaveBeenCalledTimes(2);
    auto.dispose();
  });

  it('a save during a run gets one more run after it', async () => {
    let finish: (value: AutoSyncResult) => void = () => undefined;
    sync.mockImplementationOnce(
      () =>
        new Promise<AutoSyncResult>((resolve) => {
          finish = resolve;
        }),
    );
    const auto = createAutoSync({ sync });
    auto.request('start');
    await jest.advanceTimersByTimeAsync(0);
    auto.request('save');
    auto.request('save');
    finish({ outcome: 'success', pending: 0, nextRetryAt: null });
    await jest.advanceTimersByTimeAsync(AUTO_SYNC_SAVE_DEBOUNCE_MS);
    expect(sync).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(AUTO_SYNC_RETRY_MS * 3);
    expect(sync).toHaveBeenCalledTimes(2);
    auto.dispose();
  });

  it('a thrown sync is retried, and dispose stops everything', async () => {
    sync.mockRejectedValueOnce(new Error('boom'));
    const auto = createAutoSync({ sync });
    auto.request('start');
    await jest.advanceTimersByTimeAsync(0);
    expect(sync).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(AUTO_SYNC_RETRY_MS);
    expect(sync).toHaveBeenCalledTimes(2);
    auto.dispose();
    await jest.advanceTimersByTimeAsync(AUTO_SYNC_RETRY_MS * 3);
    auto.request('save');
    await jest.advanceTimersByTimeAsync(AUTO_SYNC_SAVE_DEBOUNCE_MS);
    expect(sync).toHaveBeenCalledTimes(2);
  });

  // Device run 2026-11-11: offline save -> FAILED, next_retry_at +60 s. The
  // 30 s retry pulled fine but could not push yet, called it success, and the
  // op waited for the next save or foreground. Now the run lands on the backoff.
  it('comes back when the backoff of a failed op ends, even after a run that pushed nothing', async () => {
    const at = (ms: number) => new Date(Date.now() + ms).toISOString();
    sync
      .mockImplementationOnce(() =>
        Promise.resolve({ outcome: 'offline', pending: 1, nextRetryAt: at(60_000) }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ outcome: 'success', pending: 0, nextRetryAt: null }),
      );
    const auto = createAutoSync({ sync });
    auto.request('save');
    await jest.advanceTimersByTimeAsync(AUTO_SYNC_SAVE_DEBOUNCE_MS);
    expect(sync).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(60_000 + AUTO_SYNC_READY_SLACK_MS - 1);
    expect(sync).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(sync).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(AUTO_SYNC_RETRY_MS * 5);
    expect(sync).toHaveBeenCalledTimes(2);
    auto.dispose();
  });

  it('a successful run that leaves a backing-off op still waits for it', async () => {
    const at = (ms: number) => new Date(Date.now() + ms).toISOString();
    sync
      .mockImplementationOnce(() =>
        Promise.resolve({ outcome: 'success', pending: 1, nextRetryAt: at(27_000) }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ outcome: 'success', pending: 0, nextRetryAt: null }),
      );
    const auto = createAutoSync({ sync });
    auto.request('start');
    await jest.advanceTimersByTimeAsync(27_000 + AUTO_SYNC_READY_SLACK_MS);
    expect(sync).toHaveBeenCalledTimes(2);
    auto.dispose();
  });

  it('never spins on an op that is ready but held by something else', async () => {
    sync.mockImplementation(() =>
      Promise.resolve({
        outcome: 'success',
        pending: 1,
        nextRetryAt: new Date(Date.now() - 1_000).toISOString(),
      }),
    );
    const auto = createAutoSync({ sync });
    auto.request('start');
    await jest.advanceTimersByTimeAsync(AUTO_SYNC_RETRY_MS * 5);
    expect(sync).toHaveBeenCalledTimes(1);
    auto.dispose();
  });
});
