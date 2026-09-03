import {
  dismissReminder,
  dismissedUserSnapshot,
  isReminderDismissed,
  resetDismissal,
  subscribeToReminder,
} from './verification-reminder';

/**
 * Dismissal lifecycle (ADR-P026 V2-D).
 *
 * The whole contract is "memory only, this session only", so these assertions
 * are about what does NOT survive as much as what does.
 */
describe('verification reminder dismissal', () => {
  const USER = 'user-1';
  const OTHER = 'user-2';

  afterEach(() => resetDismissal());

  it('starts undismissed — a fresh module is a fresh app start', () => {
    expect(isReminderDismissed(USER)).toBe(false);
    expect(dismissedUserSnapshot()).toBeNull();
  });

  it('hides the reminder for the dismissing user', () => {
    dismissReminder(USER);
    expect(isReminderDismissed(USER)).toBe(true);
    expect(dismissedUserSnapshot()).toBe(USER);
  });

  it('does NOT hide it for a different account', () => {
    dismissReminder(USER);
    // Defence in depth: even if a session transition were missed, another
    // user's reminder must not inherit this dismissal.
    expect(isReminderDismissed(OTHER)).toBe(false);
  });

  it('is forgotten on reset — sign-out and session loss both call it', () => {
    dismissReminder(USER);
    resetDismissal();
    expect(isReminderDismissed(USER)).toBe(false);
    expect(dismissedUserSnapshot()).toBeNull();
  });

  it('notifies subscribers on dismissal and on reset', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToReminder(listener);

    dismissReminder(USER);
    expect(listener).toHaveBeenCalledTimes(1);

    resetDismissal();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    dismissReminder(USER);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('does not notify when nothing actually changes', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToReminder(listener);

    resetDismissal(); // already reset
    expect(listener).not.toHaveBeenCalled();

    dismissReminder(USER);
    dismissReminder(USER); // same user again
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('returns a stable primitive snapshot so useSyncExternalStore does not loop', () => {
    dismissReminder(USER);
    expect(dismissedUserSnapshot()).toBe(dismissedUserSnapshot());
  });
});
