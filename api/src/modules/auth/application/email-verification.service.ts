import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuditAction, UserStatus } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { MailDispatcher } from '../../mail/application/mail-dispatcher.service';
import { MailService } from '../../mail/application/mail.service';
import type { MailLocale } from '../../mail/domain/mail.types';
import {
  EMAIL_VERIFICATION_TTL_HOURS,
  TokenService,
} from '../infrastructure/token.service';

/**
 * Email verification (ADR-P026 Vertical 2, V2-C — backend only).
 *
 * Kept out of `AuthService` for the same reason `PasswordRecoveryService` is:
 * register/login/refresh/logout/me/delete-account are shipped, audited
 * behaviour, and verification must not reshape them. Registration gains one
 * best-effort call that cannot alter its own outcome; nothing else changes.
 *
 * ── Token lifecycle vocabulary (load-bearing — do not conflate) ─────────────
 *
 *   REDEEMABLE  consumedAt IS NULL AND invalidatedAt IS NULL AND expiresAt > now
 *               What `verifyEmail` requires. Exactly the predicate it applies.
 *
 *   OPEN ROW    consumedAt IS NULL AND invalidatedAt IS NULL
 *               What the V2-A partial unique index
 *               `uq_email_verification_tokens_one_active_per_user` constrains.
 *               Its predicate INTENTIONALLY omits expiry, because `now()` is
 *               not immutable and PostgreSQL cannot use a time-varying
 *               expression in a partial index predicate.
 *
 * The gap between the two is the whole reason `issue()` is written the way it
 * is: **an expired row is no longer redeemable but is still open**, and still
 * occupies the user's single open slot. So a replacement issuance must
 * invalidate EVERY open row for the user — expired ones included — before
 * inserting. Filtering the invalidation sweep by `expiresAt` would leave an
 * expired-but-open row in place and the insert would fail with a unique
 * violation, breaking resend for exactly the users who waited longest.
 *
 * The index is a database BACKSTOP for that invariant, not a substitute for
 * this sequencing.
 *
 * ── Security posture ───────────────────────────────────────────────────────
 *
 * - **No enumeration surface on resend.** Unlike `forgot-password`, resend is
 *   AUTHENTICATED and takes no address: it acts on the caller's own account
 *   (V2-B froze resend to the authenticated dashboard reminder and defined no
 *   anonymous resend form). There is consequently no unknown-address branch to
 *   time-mask, so this service needs no response floor. Every ACCEPTED request
 *   still resolves to one identical generic 202 — dispatched, already
 *   verified, mail-failure and ceiling no-op alike — because an
 *   already-verified account must not be told it is special. Boundary statuses
 *   (400/401/429/503) are the controller's and vary by no account; see
 *   ADR-P026 §Clarifications (2026-09-03).
 * - **The per-account ceiling keys on the authenticated user ID** (the JWT
 *   `sub`), never on a submitted address — there is none to submit.
 * - **Redemption is generic on failure.** Unknown, expired, superseded and
 *   already-consumed tokens all collapse into one 400 with one message.
 * - **Verification never authenticates.** Redeeming sets `emailVerifiedAt` and
 *   nothing else — no session is created, extended, or restored.
 * - **Fail closed.** With no transport or no verification base, issuance is
 *   refused rather than minting a token whose link could never be delivered.
 * - **Nothing sensitive is recorded.** Audit rows carry the user id and a
 *   coarse outcome only — never the address, the raw token, or the rendered
 *   mail (Decision 9).
 */

/** Per-account issuance ceiling, complementing the per-IP throttle (Decision 8). */
export const VERIFICATION_REQUESTS_PER_ACCOUNT = 5;

/** Window for the per-account ceiling. */
export const VERIFICATION_ACCOUNT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Retention for terminal (consumed or invalidated) verification rows, swept
 * opportunistically for the acting user during issuance.
 *
 * ADR-P026 Decision 12 forbids a job runner, and the 2026-09-02 owner decision
 * fixed cleanup as "per-user opportunistic during issuance/reissuance; no
 * scheduler". Terminal rows are kept for a while because they are the only
 * evidence that a link was issued and used; they are not audit records, so
 * they need no indefinite retention. Open rows are NEVER deleted here —
 * superseding them is `issue()`'s job and is what the unique index checks.
 */
export const VERIFICATION_TERMINAL_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** What the issuing transaction decided. Internal — never surfaced to a caller. */
type IssueOutcome =
  | { kind: 'issued'; raw: string }
  | { kind: 'rate-limited' }
  | { kind: 'skipped' };

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly dispatcher: MailDispatcher,
  ) {}

  /**
   * Issue the first verification email as part of registration.
   *
   * **Never throws, never rolls anything back, never alters the registration
   * response** (ADR-P026 owner decision, 2026-09-02). The account is already
   * created and committed by the time this runs; a disabled mailer, a database
   * hiccup here, or a provider outage must all leave the caller with the same
   * successful registration. Failures are logged with a class name only, and
   * the user recovers via the dashboard resend affordance.
   */
  async issueOnRegistration(input: {
    userId: string;
    email: string;
    locale: MailLocale;
  }): Promise<void> {
    try {
      await this.issueAndDispatch(input);
    } catch (error) {
      const cause = error instanceof Error ? error.name : 'unknown error';
      this.logger.error(
        `Verification issuance failed at registration: ${cause}`,
      );
    }
  }

  /**
   * Resend a verification email to the AUTHENTICATED caller's own address.
   *
   * Returns void: the caller learns nothing beyond "accepted". An already
   * verified account, an account at its ceiling, and a freshly issued token
   * are indistinguishable in the response, so the reminder's generic
   * acknowledgement ("If your address needs verifying, a link is on its way")
   * stays truthful in every case.
   */
  async resendVerification(input: {
    userId: string;
    locale: MailLocale;
  }): Promise<void> {
    // Fail closed BEFORE any work: with no transport or no verification host
    // there is no honest outcome to report, and answering 202 would be a lie.
    // Uniform for every caller, so it discloses nothing about any account.
    if (!this.mail.verificationEnabled) {
      throw new ServiceUnavailableException(
        'Email verification is temporarily unavailable',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        email: true,
        status: true,
        deletedAt: true,
        emailVerifiedAt: true,
      },
    });

    // Already verified, suspended, soft-deleted, or vanished: no mail, same
    // response. Re-verifying a verified address is pure mailbomb surface.
    if (
      !user ||
      user.deletedAt !== null ||
      user.status !== UserStatus.ACTIVE ||
      user.emailVerifiedAt !== null
    ) {
      return;
    }

    await this.issueAndDispatch({
      userId: user.id,
      email: user.email,
      locale: input.locale,
    });
  }

  /** Shared issuance + dispatch path for registration and resend. */
  private async issueAndDispatch(input: {
    userId: string;
    email: string;
    locale: MailLocale;
  }): Promise<void> {
    if (!this.mail.verificationEnabled) {
      // Registration reaches here when verification mail is not configured.
      // Minting a token whose link cannot be built would leave an open row
      // blocking a later legitimate issuance, so do nothing at all.
      return;
    }

    const outcome = await this.issue(input.userId);

    if (outcome.kind === 'rate-limited') {
      await this.audit.record({
        action: AuditAction.AUTH_FAILURE,
        userId: input.userId,
        metadata: { reason: 'email_verification_rate_limited' },
      });
      return;
    }
    if (outcome.kind === 'skipped') return;

    // User id and outcome only — no address, no token.
    await this.audit.record({
      action: AuditAction.EMAIL_VERIFICATION_REQUEST,
      userId: input.userId,
    });

    // Out of the request path — see MailDispatcher on the (absent) delivery
    // guarantees. This is what keeps a provider failure from ever reaching the
    // registration or resend response.
    this.dispatcher.dispatch('auth.emailVerification', () =>
      this.mail.sendEmailVerification({
        to: input.email,
        locale: input.locale,
        rawToken: outcome.raw,
        expiresInHours: EMAIL_VERIFICATION_TTL_HOURS,
      }),
    );
  }

  /**
   * Count, sweep, supersede and insert as one serialized unit.
   *
   * Opens with `SELECT … FOR UPDATE` on the owning `users` row. Without that
   * lock, two concurrent resends for the same account would both read the same
   * count and both try to insert: a classic TOCTOU that would either exceed
   * the per-account ceiling or collide on the partial unique index. Concurrent
   * callers for the SAME user serialize here; callers for DIFFERENT users take
   * different locks and never contend.
   *
   * Ordering inside the transaction matters: the open-row sweep must commit in
   * the same transaction as the insert, so the index invariant (at most one
   * open row per user) holds at every commit point.
   */
  private async issue(userId: string): Promise<IssueOutcome> {
    const { raw, hash } = this.tokens.generateEmailVerificationToken();

    return this.prisma.$transaction(async (tx): Promise<IssueOutcome> => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE
      `;
      // The account disappeared between the lookup and the lock.
      if (locked.length === 0) return { kind: 'skipped' };

      const now = new Date();

      // Counted INSIDE the lock so the value cannot go stale before the insert.
      const recentIssuances = await tx.emailVerificationToken.count({
        where: {
          userId,
          createdAt: {
            gt: new Date(now.getTime() - VERIFICATION_ACCOUNT_WINDOW_MS),
          },
        },
      });
      if (recentIssuances >= VERIFICATION_REQUESTS_PER_ACCOUNT) {
        return { kind: 'rate-limited' };
      }

      // Opportunistic per-user cleanup (Decision 12 — no scheduler). Only
      // TERMINAL rows, and only aged ones: an open row is never deleted here,
      // because superseding it below is what the index actually requires.
      await tx.emailVerificationToken.deleteMany({
        where: {
          userId,
          NOT: { consumedAt: null, invalidatedAt: null },
          createdAt: {
            lt: new Date(now.getTime() - VERIFICATION_TERMINAL_RETENTION_MS),
          },
        },
      });

      // Supersede every OPEN row — deliberately NOT filtered by expiresAt.
      // An expired row is still open and still holds the user's single slot,
      // so omitting it here would make the insert below fail for any user
      // whose previous link had already lapsed. See the class comment.
      await tx.emailVerificationToken.updateMany({
        where: { userId, consumedAt: null, invalidatedAt: null },
        data: { invalidatedAt: now },
      });

      await tx.emailVerificationToken.create({
        data: {
          tokenHash: hash,
          userId,
          expiresAt: new Date(
            now.getTime() + this.tokens.emailVerificationTtlMs(),
          ),
        },
      });

      return { kind: 'issued', raw };
    });
  }

  /**
   * Redeem a verification token: mark the address verified and burn the token.
   *
   * One transaction whose first statement is a conditional
   * `UPDATE … WHERE consumed_at IS NULL AND invalidated_at IS NULL AND
   * expires_at > now` — the REDEEMABLE predicate. PostgreSQL row locks make
   * that the single point of truth for single-use: two concurrent redemptions
   * of the same token serialize on the row, and the loser sees zero updated
   * rows once the winner commits. Replay, expiry, supersession and an unknown
   * token all collapse into the same generic rejection.
   *
   * Creates NO session (V2-B: "Verification does not authenticate").
   */
  async verifyEmail(input: { token: string }): Promise<void> {
    const tokenHash = this.tokens.hashEmailVerificationToken(input.token);

    const userId = await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      const claimed = await tx.emailVerificationToken.updateMany({
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

      const token = await tx.emailVerificationToken.findUniqueOrThrow({
        where: { tokenHash },
        select: { userId: true },
      });
      const user = await tx.user.findUnique({
        where: { id: token.userId },
        select: {
          id: true,
          status: true,
          deletedAt: true,
          emailVerifiedAt: true,
        },
      });
      // The token stays consumed even here: an account suspended or deleted
      // after issuance must not keep a live verification link.
      if (
        !user ||
        user.deletedAt !== null ||
        user.status !== UserStatus.ACTIVE
      ) {
        return null;
      }

      // Idempotent: preserve the FIRST verification timestamp. A later
      // redemption must not rewrite when the address was actually confirmed.
      if (user.emailVerifiedAt === null) {
        await tx.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: now },
        });
      }

      // Any sibling open row is now moot — the address is verified, so no
      // other outstanding link should remain redeemable.
      await tx.emailVerificationToken.updateMany({
        where: { userId: user.id, consumedAt: null, invalidatedAt: null },
        data: { invalidatedAt: now },
      });

      return user.id;
    });

    if (userId === null) {
      // One generic rejection for every failure mode — an attacker learns
      // nothing about whether a token existed, expired, or was already used.
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.audit.record({
      action: AuditAction.EMAIL_VERIFICATION_SUCCESS,
      userId,
    });
  }
}
