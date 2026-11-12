import { logError } from '../logging/logger';
import { notifyEnqueued, onEnqueued } from './sync-events';

jest.mock('../logging/logger', () => ({ logError: jest.fn() }));

describe('sync events (BUG-049)', () => {
  it('a failing listener is logged and never stops the others', () => {
    const calls: string[] = [];
    const stopBad = onEnqueued(() => {
      throw new Error('boom');
    });
    const stopGood = onEnqueued((userId) => calls.push(userId));
    expect(() => notifyEnqueued('user-a')).not.toThrow();
    expect(calls).toEqual(['user-a']);
    expect(logError).toHaveBeenCalledWith('sync.onEnqueued', expect.any(Error));
    stopBad();
    stopGood();
  });
});
