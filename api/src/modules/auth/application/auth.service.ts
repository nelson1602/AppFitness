import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditAction, Prisma, UserStatus } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { resolveMailLocale } from '../../mail/domain/mail.types';
import { SubscriptionService } from '../../subscriptions/application/subscription.service';
import { SAFE_USER_SELECT, SafeUser, TokenPair } from '../domain/auth.types';
import { PasswordService } from '../infrastructure/password.service';
import {
  SESSION_ABSOLUTE_LIFETIME_MS,
  TokenService,
} from '../infrastructure/token.service';
import { EmailVerificationService } from './email-verification.service';
import { LoginThrottleService, normalizeEmail } from './login-throttle.service';

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
  /** Language hint for the verification email; unknown values fall back to English. */
  locale?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult extends TokenPair {
  user: SafeUser;
}

/** ADR-P046: one answer for a taken email or username — no enumeration. */
export const REGISTER_CONFLICT_MESSAGE =
  'An account with these details already exists';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly emailVerification: EmailVerificationService,
    private readonly subscriptions: SubscriptionService,
    private readonly loginThrottle: LoginThrottleService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = normalizeEmail(input.email);

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username: input.username }] },
      select: { id: true },
    });
    if (existing) {
      // ADR-P046: the same message whether the email or the username is taken.
      throw new ConflictException(REGISTER_CONFLICT_MESSAGE);
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        username: input.username,
        passwordHash: await this.passwords.hash(input.password),
      },
      select: SAFE_USER_SELECT,
    });

    await this.audit.record({
      action: AuditAction.ACCOUNT_REGISTER,
      userId: user.id,
    });

    // Automatic first verification email (ADR-P026 owner decision 2026-09-02).
    // Deliberately awaited but non-throwing: the service swallows every
    // failure internally, so the account stays created and this response is
    // byte-identical whether the provider succeeded, failed, or — while
    // MAIL_VERIFICATION_BASE_URL is unset — was never reached at all. The
    // delivery outcome can never alter or roll back registration.
    await this.emailVerification.issueOnRegistration({
      userId: user.id,
      email: user.email,
      locale: resolveMailLocale(input.locale),
    });

    const pair = await this.issueTokenPair(user.id, user.role, 0);
    return { user, ...pair };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const email = normalizeEmail(input.email);
    // ADR-P046: per-account backoff first — a locked address costs no Argon2.
    await this.loginThrottle.assertNotLocked(email);

    const user = await this.prisma.user.findUnique({ where: { email } });
    // ADR-P046: an unknown email still pays for one Argon2 verification, so
    // response time does not reveal which addresses have accounts.
    const passwordOk = user
      ? await this.passwords.verify(user.passwordHash, input.password)
      : await this.passwords.verifyDummy(input.password);
    const valid =
      user !== null &&
      passwordOk &&
      user.deletedAt === null &&
      user.status === UserStatus.ACTIVE;

    if (!valid) {
      await this.loginThrottle.recordFailure(email);
      await this.audit.record({
        action: AuditAction.AUTH_FAILURE,
        userId: user?.id ?? null,
        metadata: { reason: 'invalid_credentials' },
      });
      // Same message for every failure mode — no account enumeration.
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.loginThrottle.recordSuccess(email);
    await this.audit.record({ action: AuditAction.LOGIN, userId: user.id });
    const pair = await this.issueTokenPair(
      user.id,
      user.role,
      user.tokenVersion,
    );
    const safeUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: SAFE_USER_SELECT,
    });
    return { user: safeUser, ...pair };
  }

  /**
   * Refresh rotation: each refresh token is single-use. Presenting an
   * already-rotated (revoked) token is treated as theft — the whole
   * session family for that user is revoked (.ai/05_SECURITY.md).
   *
   * ADR-P046:
   * - The rotation is atomic: the old token is revoked by a conditional
   *   update that must match exactly one still-active row, and the new token
   *   is created in the same transaction. Two concurrent presentations of one
   *   token cannot both receive a new pair.
   * - A session ends 30 days after the sign-in that started it, however
   *   often it is refreshed (`session_started_at` travels with the chain).
   */
  async refresh(rawRefreshToken: string): Promise<TokenPair> {
    const tokenHash = this.tokens.hashRefreshToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revokedAt !== null) {
      // Reuse detected: revoke every active refresh token for this user.
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record({
        action: AuditAction.AUTH_FAILURE,
        userId: stored.userId,
        metadata: { reason: 'refresh_token_reuse' },
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    const now = new Date();
    const sessionEnd = new Date(
      stored.sessionStartedAt.getTime() + SESSION_ABSOLUTE_LIFETIME_MS,
    );
    if (stored.expiresAt < now || sessionEnd <= now) {
      await this.prisma.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: now },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
    });
    if (!user || user.deletedAt !== null || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const { raw, hash } = this.tokens.generateRefreshToken();
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: now },
      });
      if (claimed.count !== 1) {
        // Another request rotated this token first; throwing rolls back.
        throw new UnauthorizedException('Invalid refresh token');
      }
      const created = await this.createRefreshRow(
        tx,
        user.id,
        hash,
        stored.deviceId,
        stored.sessionStartedAt,
      );
      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { replacedById: created.id },
      });
    });

    const accessToken = await this.tokens.signAccessToken(
      user.id,
      user.role,
      user.tokenVersion,
    );
    return { accessToken, refreshToken: raw };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.tokens.hashRefreshToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (stored && stored.revokedAt === null) {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      await this.audit.record({
        action: AuditAction.LOGOUT,
        userId: stored.userId,
      });
    }
    // Unknown/already-revoked tokens: logout is idempotent, nothing to do.
  }

  /**
   * ADR-P046 "log out everywhere": every refresh token of the account is
   * revoked and the token version moves on, so every outstanding access token
   * stops working on its next request instead of when it expires.
   */
  async logoutAll(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      });
    });
    await this.audit.record({
      action: AuditAction.LOGOUT,
      userId,
      metadata: { scope: 'all_sessions' },
    });
  }

  async me(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: SAFE_USER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Permanently deletes the account and ALL user-owned data (ADR-P011).
   * User-owned rows are removed by database `ON DELETE CASCADE`; shared
   * catalog data (exercises/foods/achievements) is untouched. The
   * immutable audit trail is retained but de-identified: the user's audit
   * rows have `user_id` severed (the only mutation the audit trigger
   * permits). Irreversible.
   *
   * ADR-P046:
   * - The current password is required: a stolen access token alone cannot
   *   destroy the account. A wrong password counts as a sign-in failure.
   * - The person's own foods and exercises (`created_by` = this user) are
   *   removed too. `created_by` has no foreign key, so the cascade never
   *   reached them; any that another row still uses is anonymized instead.
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt !== null) {
      throw new NotFoundException('User not found');
    }
    await this.loginThrottle.assertNotLocked(user.email);
    if (!(await this.passwords.verify(user.passwordHash, password))) {
      await this.loginThrottle.recordFailure(user.email);
      await this.audit.record({
        action: AuditAction.AUTH_FAILURE,
        userId,
        metadata: { reason: 'delete_account_wrong_password' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Provider deletion is intentionally first. If it fails, keep the local
    // account/session reachable so the user can retry; deleting locally first
    // would strand the external customer with no authenticated retry path.
    await this.subscriptions.deleteProviderCustomer(userId);

    // Record the completed-deletion event while the user still exists; it
    // is de-linked below along with the user's other audit rows.
    await this.audit.record({ action: AuditAction.ACCOUNT_DELETE, userId });

    await this.prisma.$transaction(async (tx) => {
      // Sever the personal link on the immutable audit rows (ADR-P011
      // trigger permits ONLY user_id -> NULL). Content is preserved.
      await tx.auditLog.updateMany({
        where: { userId },
        data: { userId: null },
      });
      // Physical delete; user-owned children cascade, catalog stays. The
      // person's meal items, routines and workout sets go with it, which
      // releases their own foods and exercises below.
      await tx.user.delete({ where: { id: userId } });
      await this.removeOwnCatalogRows(tx, userId);
    });
  }

  /**
   * ADR-P046: deletes the account's own foods and exercises. A row another
   * account still references (not expected: custom rows are private, ADR-P045)
   * cannot be deleted, so its personal content is blanked instead.
   */
  private async removeOwnCatalogRows(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<void> {
    const foodsInUse = await tx.mealItem.findMany({
      where: { food: { createdBy: userId } },
      select: { foodId: true },
      distinct: ['foodId'],
    });
    const keptFoods = foodsInUse.map((row) => row.foodId);
    await tx.food.deleteMany({
      where: { createdBy: userId, id: { notIn: keptFoods } },
    });
    if (keptFoods.length > 0) {
      await tx.food.updateMany({
        where: { id: { in: keptFoods } },
        data: { name: 'Deleted food', brand: null },
      });
    }

    const [inRoutines, inSets] = await Promise.all([
      tx.routineExercise.findMany({
        where: { exercise: { createdBy: userId } },
        select: { exerciseId: true },
        distinct: ['exerciseId'],
      }),
      tx.workoutSet.findMany({
        where: { exercise: { createdBy: userId } },
        select: { exerciseId: true },
        distinct: ['exerciseId'],
      }),
    ]);
    const keptExercises = [
      ...new Set([...inRoutines, ...inSets].map((row) => row.exerciseId)),
    ];
    await tx.exercise.deleteMany({
      where: { createdBy: userId, id: { notIn: keptExercises } },
    });
    for (const id of keptExercises) {
      // (created_by, name) is unique, so each kept row gets its own blank name.
      await tx.exercise.update({
        where: { id },
        data: { name: `Deleted exercise ${id.slice(0, 8)}` },
      });
    }
  }

  private async issueTokenPair(
    userId: string,
    role: SafeUser['role'],
    tokenVersion: number,
  ): Promise<TokenPair> {
    const accessToken = await this.tokens.signAccessToken(
      userId,
      role,
      tokenVersion,
    );
    const { raw, hash } = this.tokens.generateRefreshToken();
    await this.createRefreshRow(this.prisma, userId, hash, null, new Date());
    return { accessToken, refreshToken: raw };
  }

  /** A refresh row that never outlives its session's 30-day limit. */
  private createRefreshRow(
    client: Prisma.TransactionClient | PrismaService,
    userId: string,
    tokenHash: string,
    deviceId: string | null,
    sessionStartedAt: Date,
  ): Promise<{ id: string }> {
    const expiresAt = Math.min(
      Date.now() + this.tokens.refreshTokenTtlMs(),
      sessionStartedAt.getTime() + SESSION_ABSOLUTE_LIFETIME_MS,
    );
    return client.refreshToken.create({
      data: {
        tokenHash,
        userId,
        deviceId,
        sessionStartedAt,
        expiresAt: new Date(expiresAt),
      },
      select: { id: true },
    });
  }
}
