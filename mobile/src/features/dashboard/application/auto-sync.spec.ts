import {
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
    sync = jest.fn(() => Promise.resolve(results.shift() ?? { outcome: 'success', pending: 0 }));
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
      { outcome: 'offline', pending: 3 },
      { outcome: 'offline', pending: 3 },
      { outcome: 'success', pending: 0 },
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
    results = [{ outcome: 'blocked', pending: 4 }];
    const auto = createAutoSync({ sync });
    auto.request('start');
    await jest.advanceTimersByTimeAsync(AUTO_SYNC_RETRY_MS * 5);
    expect(sync).toHaveBeenCalledTimes(1);
    auto.dispose();
  });

  it('never runs in the background, and runs when the app returns to the foreground', async () => {
    results = [{ outcome: 'offline', pending: 1 }];
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
    finish({ outcome: 'success', pending: 0 });
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
});
