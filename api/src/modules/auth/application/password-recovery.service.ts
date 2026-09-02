import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuditAction, UserStatus } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { MailDispatcher } from '../../mail/application/mail-dispatcher.service';
import { MailService } from '../../mail/application/mail.service';
import type { MailLocale } from '../../mail/domain/mail.types';
import {
  CLOCK,
  type Clock,
  remainingFloorMs,
} from '../infrastructure/clock.service';
import { PasswordService } from '../infrastructure/password.service';
import {
  PASSWORD_RESET_TTL_MINUTES,
  TokenService,
} from '../infrastructure/token.service';

/**
 * Password recovery (ADR-P026 Vertical 1).
 *
 * Kept out of `AuthService` on purpose: register/login/refresh/logout/me/
 * delete-account are shipped, audited behaviour, and recovery must not
 * reshape them. This service owns issuance, delivery and redemption; nothing
 * in the existing session lifecycle changes except that a completed reset
 * revokes refresh tokens through the same column the logout path already uses.
 *
 * Security posture:
 * - **No enumeration in the response.** `requestReset` resolves the same way
 *   for a known address, an unknown address, a suspended account and an
 *   account that hit its ceiling. The controller turns every one of those into
 *   an identical 202.
 * - **Timing is bounded, not constant.** An existing account genuinely does
 *   more database work than an unknown one (a row lock, a count, an
 *   invalidation sweep and an insert). That difference is masked — not
 *   eliminated — by holding every post-lookup outcome to a fixed minimum
 *   response duration (`RESPONSE_FLOOR_MS`), which is far longer than the
 *   spread between those paths. Provider latency is excluded from the request
 *   path entirely (see `MailDispatcher`), so the floor does not have to absorb
 *   it. This is a mitigation: it does not make the endpoint constant-time, and
 *   a determined attacker with enough samples may still measure a residual
 *   difference. The primary defences remain the identical 202 and the two
 *   abuse limits.
 * - **Fail closed.** When mail is globally disabled the caller is told the
 *   feature is unavailable *before* any account lookup, so a disabled mailer
 *   can neither leak account existence nor pretend a mail was sent.
 * - **Nothing sensitive is recorded.** Audit rows carry the user id and a
 *   coarse outcome. The address, the raw token and the rendered email never
 *   reach a log, an audit row, or Sentry (Decision 9).
 */

/** Per-account issuance ceiling, complementing the per-IP throttle (Decision 8). */
export const RESET_REQUESTS_PER_ACCOUNT = 5;

/** Window for the per-account ceiling. */
export const RESET_ACCOUNT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Minimum wall-clock duration of a `forgot-password` response, applied to every
 * post-lookup outcome. Chosen to sit comfortably above the cost of the
 * issuing path's database work while staying below the point where a user
 * would perceive the form as slow.
 */
export const RESPONSE_FLOOR_MS = 300;

/** What the issuing transaction decided. Internal — never surfaced to a caller. */
type IssueOutcome =
  | { kind: 'issued'; raw: string }
  | { kind: 'rate-limited' }
  | { kind: 'skipped' };

@Injectable()
export class PasswordRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly dispatcher: MailDispatcher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Issue a reset token and email it — if, and only if, the address belongs to
   * an account that may sign in. Every other case is a deliberate no-op.
   *
   * Returns void: the caller has no information to act on, by design.
   */
  async requestReset(input: {
    email: string;
    locale: MailLocale;
  }): Promise<void> {
    // Fail closed BEFORE touching the user table: with no transport there is
    // no honest outcome to report, and answering "202 accepted" would be a
    // lie. Checked first so the disabled response cannot vary by account, and
    // deliberately outside the floor below — it is a different status code on
    // every request, so it discloses nothing about any account.
    if (!this.mail.enabled) {
      throw new ServiceUnavailableException(
        'Password reset is temporarily unavailable',
      );
    }

    const startedAt = this.clock.now();
    try {
      await this.issueAndDispatch(input);
    } finally {
      // Every post-lookup outcome — issued, unknown address, suspended
      // account, ceiling reached, or an unexpected failure — leaves through
      // here, so none of them is distinguishable by a fast return.
      await this.clock.sleep(
        remainingFloorMs(this.clock.now() - startedAt, RESPONSE_FLOOR_MS),
      );
    }
  }

  private async issueAndDispatch(input: {
    email: string;
    locale: MailLocale;
  }): Promise<void> {
    const email = input.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, status: true, deletedAt: true },
    });

    // Unknown address, soft-deleted, or suspended: stop silently. A suspended
    // account must not be recoverable, and saying so would enumerate.
    if (!user || user.deletedAt !== null || user.status !== UserStatus.ACTIVE) {
      return;
    }

    const outcome = await this.issueToken(user.id);

    if (outcome.kind === 'rate-limited') {
      await this.audit.record({
        action: AuditAction.AUTH_FAILURE,
        userId: user.id,
        metadata: { reason: 'password_reset_rate_limited' },
      });
      return;
    }
    if (outcome.kind === 'skipped') return;

    // User id and outcome only — no address, no token.
    await this.audit.record({
      action: AuditAction.PASSWORD_RESET_REQUEST,
      userId: user.id,
    });

    // Out of the request path: see the class comment on timing, and
    // `MailDispatcher` on the delivery guarantees this does NOT provide.
    this.dispatcher.dispatch('auth.passwordReset', () =>
      this.mail.sendPasswordReset({
        to: user.email,
        locale: input.locale,
        rawToken: outcome.raw,
        expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
      }),
    );
  }

  /**
   * Count, invalidate and insert as one serialized unit.
   *
   * The transaction opens with `SELECT … FOR UPDATE` on the owning `users`
   * row, which is what makes the per-account ceiling and the
   * one-active-token-per-user rule actually hold. Without it, two concurrent
   * requests for the same address would both read the same count and both
   * insert — the check-then-act would be a classic TOCTOU, and five requests
   * fired together could mint five tokens past the cap while leaving several
   * of them simultaneously active.
   *
   * Concurrent callers for the SAME user serialize on that row lock and
   * re-read the count after the winner commits. Callers for DIFFERENT users
   * take different row locks and never contend.
   *
   * The partial unique index `uq_password_reset_tokens_one_active_per_user`
   * (see the migration) is the database-level backstop for the same rule: even
   * if this code were bypassed, a second simultaneously-active token for one
   * user cannot be inserted.
   */
  private async issueToken(userId: string): Promise<IssueOutcome> {
    const { raw, hash } = this.tokens.generatePasswordResetToken();

    return this.prisma.$transaction(async (tx): Promise<IssueOutcome> => {
      // Per-user row lock. Held until this transaction commits or rolls back.
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE
      `;
      // The account disappeared between the lookup and the lock.
      if (locked.length === 0) return { kind: 'skipped' };

      const now = new Date();

      // Counted INSIDE the lock, so the value cannot go stale before the
      // insert below acts on it.
      const recentIssuances = await tx.passwordResetToken.count({
        where: {
          userId,
          createdAt: { gt: new Date(now.getTime() - RESET_ACCOUNT_WINDOW_MS) },
        },
      });
      if (recentIssuances >= RESET_REQUESTS_PER_ACCOUNT) {
        return { kind: 'rate-limited' };
      }

      // A new issuance supersedes every still-active token for this user
      // (Decision 7). Invalidate-then-insert inside one transaction keeps the
      // partial unique index satisfied at every commit point.
      await tx.passwordResetToken.updateMany({
        where: { userId, consumedAt: null, invalidatedAt: null },
        data: { invalidatedAt: now },
      });
      await tx.passwordResetToken.create({
        data: {
          tokenHash: hash,
          userId,
          expiresAt: new Date(now.getTime() + this.tokens.passwordResetTtlMs()),
        },
      });

      return { kind: 'issued', raw };
    });
  }

  /**
   * Redeem a reset token: set the new password, burn the token, drop every
   * other live reset token for the user, and end every session.
   *
   * The whole redemption is one transaction whose first statement is a
   * conditional `UPDATE ... WHERE consumed_at IS NULL`. PostgreSQL row locks
   * make that the single point of truth for single-use: two concurrent
   * redemptions of the same token serialize on the row, and the loser sees
   * zero updated rows once the winner commits. Replay, expiry, invalidation
   * and an unknown token all collapse into the same generic rejection.
   */
  async resetPassword(input: {
    token: string;
    password: string;
  }): Promise<void> {
    const tokenHash = this.tokens.hashPasswordResetToken(input.token);
    // Hashed before the transaction: Argon2 is deliberately slow, and holding
    // row locks across it would serialize unrelated resets.
    const passwordHash = await this.passwords.hash(input.password);

    const userId = await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      const claimed = await tx.passwordResetToken.updateMany({
        where: {
          tokenHash,
          consumedAt: null,
          invalidatedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (claimed.count !== 1) {
        return null; // unknown, expired, superseded, or already used
      }

      const token = await tx.passwordResetToken.findUniqueOrThrow({
        where: { tokenHash },
        select: { userId: true },
      });
      const user = await tx.user.findUnique({
        where: { id: token.userId },
        select: { id: true, status: true, deletedAt: true },
      });
      // The token stays consumed even here: an account that became suspended
      // or deleted after issuance must not keep a live reset link.
      if (
        !user ||
        user.deletedAt !== null ||
        user.status !== UserStatus.ACTIVE
      ) {
        return null;
      }

      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      // Any sibling token issued before this one is now moot.
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, consumedAt: null, invalidatedAt: null },
        data: { invalidatedAt: now },
      });

      // A reset must end every session (Decision 7). Same column and shape as
      // the shipped logout / reuse-detection revocation path.
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      });

      return user.id;
    });

    if (userId === null) {
      // One generic rejection for every failure mode — an attacker learns
      // nothing about whether a token existed, expired, or was already used.
      throw new BadRequestException('Invalid or expired reset token');
    }

    await this.audit.record({
      action: AuditAction.PASSWORD_RESET_SUCCESS,
      userId,
    });
    // Also recorded as a credential change so existing password-change
    // monitoring sees resets without needing to learn a new action.
    await this.audit.record({
      action: AuditAction.PASSWORD_CHANGE,
      userId,
      metadata: { source: 'password_reset' },
    });
  }
}
