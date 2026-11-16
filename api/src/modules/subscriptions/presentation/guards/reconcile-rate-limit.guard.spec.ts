import type { ExecutionContext } from '@nestjs/common';

import {
  RECONCILE_LIMIT_PER_WINDOW,
  RECONCILE_WINDOW_MS,
  ReconcileRateLimitGuard,
} from './reconcile-rate-limit.guard';

/** ADR-P046: 5 reconciles per minute per authenticated account. */
class TestGuard extends ReconcileRateLimitGuard {
  t = 1_000_000;
  protected now(): number {
    return this.t;
  }
}

const ctx = (userId: string): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user: { id: userId } }) }),
  }) as unknown as ExecutionContext;

describe('ReconcileRateLimitGuard (ADR-P046)', () => {
  it('allows 5 per minute per user, then 429, then again after the window', () => {
    const guard = new TestGuard();
    for (let i = 0; i < RECONCILE_LIMIT_PER_WINDOW; i++) {
      expect(guard.canActivate(ctx('a'))).toBe(true);
    }
    expect(() => guard.canActivate(ctx('a'))).toThrow(
      'Too many reconcile requests',
    );
    // Another account is counted apart.
    expect(guard.canActivate(ctx('b'))).toBe(true);

    guard.t += RECONCILE_WINDOW_MS + 1;
    expect(guard.canActivate(ctx('a'))).toBe(true);
  });
});
