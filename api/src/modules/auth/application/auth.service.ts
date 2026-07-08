import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditAction, UserStatus } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { SAFE_USER_SELECT, SafeUser, TokenPair } from '../domain/auth.types';
import { PasswordService } from '../infrastructure/password.service';
import { TokenService } from '../infrastructure/token.service';

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult extends TokenPair {
  user: SafeUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = input.email.toLowerCase();

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username: input.username }] },
      select: { email: true },
    });
    if (existing) {
      throw new ConflictException(
        existing.email === email
          ? 'Email already in use'
          : 'Username already taken',
      );
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
    const pair = await this.issueTokenPair(user.id, user.role);
    return { user, ...pair };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const email = input.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    const valid =
      user !== null &&
      user.deletedAt === null &&
      user.status === UserStatus.ACTIVE &&
      (await this.passwords.verify(user.passwordHash, input.password));

    if (!valid) {
      await this.audit.record({
        action: AuditAction.AUTH_FAILURE,
        userId: user?.id ?? null,
        metadata: { reason: 'invalid_credentials' },
      });
      // Same message for every failure mode — no account enumeration.
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.audit.record({ action: AuditAction.LOGIN, userId: user.id });
    const pair = await this.issueTokenPair(user.id, user.role);
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

    if (stored.expiresAt < new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
    });
    if (!user || user.deletedAt !== null || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const pair = await this.issueTokenPair(user.id, user.role, stored.deviceId);
    const newHash = this.tokens.hashRefreshToken(pair.refreshToken);
    const newRow = await this.prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: newHash },
      select: { id: true },
    });
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedById: newRow.id },
    });

    return pair;
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
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt !== null) {
      throw new NotFoundException('User not found');
    }

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
      // Physical delete; user-owned children cascade, catalog stays.
      await tx.user.delete({ where: { id: userId } });
    });
  }

  private async issueTokenPair(
    userId: string,
    role: SafeUser['role'],
    deviceId: string | null = null,
  ): Promise<TokenPair> {
    const accessToken = await this.tokens.signAccessToken(userId, role);
    const { raw, hash } = this.tokens.generateRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: hash,
        userId,
        deviceId,
        expiresAt: new Date(Date.now() + this.tokens.refreshTokenTtlMs()),
      },
    });
    return { accessToken, refreshToken: raw };
  }
}
