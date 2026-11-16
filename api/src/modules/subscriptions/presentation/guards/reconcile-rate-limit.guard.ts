import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../../../auth/domain/auth.types';

/** ADR-P046: reconciles per user per window. */
export const RECONCILE_LIMIT_PER_WINDOW = 5;
export const RECONCILE_WINDOW_MS = 60_000;

/**
 * Per-user limit on `/subscriptions/reconcile` (ADR-P046): 5 per minute.
 *
 * The global throttler keys on the client IP and runs before authentication,
 * so it cannot tell users apart behind one address, nor stop one account from
 * many addresses. This guard runs on the route itself, after the JWT guard,
 * and keys on the authenticated user. In memory: the API runs as one
 * instance; a restart only forgets the last minute.
 */
@Injectable()
export class ReconcileRateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, number[]>();

  /** The clock; tests override it. */
  protected now(): number {
    return Date.now();
  }

  canActivate(context: ExecutionContext): boolean {
    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    // The JWT guard already ran; without a user there is nothing to key on.
    if (!user) return true;

    const now = this.now();
    const windowStart = now - RECONCILE_WINDOW_MS;
    const recent = (this.hits.get(user.id) ?? []).filter(
      (t) => t > windowStart,
    );
    if (recent.length >= RECONCILE_LIMIT_PER_WINDOW) {
      this.hits.set(user.id, recent);
      throw new HttpException(
        'Too many reconcile requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.hits.set(user.id, recent);
    // Drop users with no hit in the window, so the map cannot grow unbounded.
    if (this.hits.size > 10_000) {
      for (const [id, times] of this.hits) {
        if (times.every((t) => t <= windowStart)) this.hits.delete(id);
      }
    }
    return true;
  }
}
