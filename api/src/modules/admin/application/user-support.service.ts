import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  Prisma,
  SyncOperationStatus,
  UserStatus,
} from '@prisma/client';

import { AuthService } from '../../auth/application/auth.service';
import { EmailVerificationService } from '../../auth/application/email-verification.service';
import {
  LoginThrottleService,
  normalizeEmail,
} from '../../auth/application/login-throttle.service';
import { PasswordRecoveryService } from '../../auth/application/password-recovery.service';
import { PrismaService } from '../../database/prisma.service';
import type { StaffContext } from '../domain/staff.types';
import { StaffAuditService } from './staff-audit.service';

/**
 * The ONLY columns the backoffice reads from `users` (ADR-P049). Account and
 * support fields; never the profile, goals, evaluations, meals, weights,
 * measurements, wellness answers or anything from Health Connect. A spec
 * pins this list and an e2e test proves seeded health values never appear.
 */
export const USER_ACCOUNT_SELECT = {
  id: true,
  email: true,
  username: true,
  status: true,
  emailVerifiedAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export interface UserSummary {
  id: string;
  email: string;
  username: string;
  createdAt: Date;
  emailVerified: boolean;
  status: UserStatus;
  lastLoginAt: Date | null;
  deviceCount: number;
  lastSyncAt: Date | null;
  isPro: boolean;
}

export const RECENT_FAILED_SYNC_LIMIT = 20;

/**
 * Backoffice user search and support actions (ADR-P049). Every action reuses
 * the app's own code path (verification resend, password-reset request,
 * throttle clear, log out everywhere, account erase), so staff can do nothing
 * the account owner's own flows could not, and staff never see or set a
 * password.
 */
@Injectable()
export class UserSupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly verification: EmailVerificationService,
    private readonly recovery: PasswordRecoveryService,
    private readonly throttle: LoginThrottleService,
    private readonly audit: StaffAuditService,
  ) {}

  async search(query: {
    q?: string;
    status?: UserStatus;
    page: number;
    pageSize: number;
  }) {
    const term = query.q?.trim();
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      status: query.status,
      OR: term
        ? [
            { email: { contains: term, mode: 'insensitive' } },
            { username: { contains: term, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_ACCOUNT_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: await this.summarize(rows),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Activity facts for a page of users, four grouped queries in total. */
  private async summarize(
    rows: Prisma.UserGetPayload<{ select: typeof USER_ACCOUNT_SELECT }>[],
  ): Promise<UserSummary[]> {
    const ids = rows.map((row) => row.id);
    if (ids.length === 0) return [];
    const now = new Date();
    const [logins, devices, syncs, pro] = await Promise.all([
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: { userId: { in: ids }, action: AuditAction.LOGIN },
        _max: { createdAt: true },
      }),
      this.prisma.device.groupBy({
        by: ['userId'],
        where: { userId: { in: ids }, revokedAt: null },
        _count: { _all: true },
      }),
      this.prisma.syncOperation.groupBy({
        by: ['userId'],
        where: { userId: { in: ids } },
        _max: { appliedAt: true },
      }),
      this.prisma.subscriptionEntitlement.findMany({
        where: {
          userId: { in: ids },
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { userId: true },
      }),
    ]);
    const lastLogin = new Map(logins.map((r) => [r.userId, r._max.createdAt]));
    const deviceCount = new Map(devices.map((r) => [r.userId, r._count._all]));
    const lastSync = new Map(syncs.map((r) => [r.userId, r._max.appliedAt]));
    const proUsers = new Set(pro.map((r) => r.userId));
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      username: row.username,
      createdAt: row.createdAt,
      emailVerified: row.emailVerifiedAt !== null,
      status: row.status,
      lastLoginAt: lastLogin.get(row.id) ?? null,
      deviceCount: deviceCount.get(row.id) ?? 0,
      lastSyncAt: lastSync.get(row.id) ?? null,
      isPro: proUsers.has(row.id),
    }));
  }

  private async account(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: USER_ACCOUNT_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async detail(id: string) {
    const user = await this.account(id);
    const [[summary], devices, throttle, failedOps] = await Promise.all([
      this.summarize([user]),
      this.prisma.device.findMany({
        where: { userId: id },
        select: {
          id: true,
          platform: true,
          name: true,
          lastSeenAt: true,
          revokedAt: true,
        },
        orderBy: { lastSeenAt: { sort: 'desc', nulls: 'last' } },
      }),
      this.prisma.loginAttempt.findUnique({
        where: { emailHash: this.throttle.keyOf(user.email) },
        select: { failures: true, lastFailedAt: true, lockedUntil: true },
      }),
      // Operation metadata only: what kind of row, which verb, why it failed.
      // The payload is never stored on this table and never read here.
      this.prisma.syncOperation.findMany({
        where: {
          userId: id,
          status: {
            in: [SyncOperationStatus.REJECTED, SyncOperationStatus.CONFLICT],
          },
        },
        select: {
          id: true,
          entityType: true,
          operation: true,
          status: true,
          errorCode: true,
          appliedAt: true,
        },
        orderBy: { appliedAt: 'desc' },
        take: RECENT_FAILED_SYNC_LIMIT,
      }),
    ]);
    return {
      ...summary,
      devices,
      throttle: throttle ?? null,
      recentFailedSyncOps: failedOps,
    };
  }

  private log(
    actor: StaffContext,
    action:
      | 'user.resend_verification'
      | 'user.send_password_reset'
      | 'user.clear_throttle'
      | 'user.logout_everywhere'
      | 'user.suspend'
      | 'user.reactivate'
      | 'user.delete',
    userId: string,
    before?: Record<string, unknown>,
    after?: Record<string, unknown>,
  ) {
    return this.audit.record({
      action,
      staffId: actor.id,
      staffEmail: actor.email,
      targetType: 'user',
      targetId: userId,
      before,
      after,
      ip: actor.ip,
    });
  }

  async resendVerification(actor: StaffContext, id: string): Promise<void> {
    const user = await this.account(id);
    if (user.emailVerifiedAt !== null) {
      throw new ConflictException('The email address is already verified');
    }
    await this.verification.resendVerification({ userId: id, locale: 'es' });
    await this.log(actor, 'user.resend_verification', id);
  }

  /** The person chooses the new password from the email; staff never do. */
  async sendPasswordReset(actor: StaffContext, id: string): Promise<void> {
    const user = await this.account(id);
    if (user.status !== UserStatus.ACTIVE) {
      throw new ConflictException('Only an active account can be reset');
    }
    await this.recovery.requestReset({ email: user.email, locale: 'es' });
    await this.log(actor, 'user.send_password_reset', id);
  }

  async clearThrottle(actor: StaffContext, id: string): Promise<void> {
    const user = await this.account(id);
    const row = await this.prisma.loginAttempt.findUnique({
      where: { emailHash: this.throttle.keyOf(user.email) },
      select: { failures: true, lockedUntil: true },
    });
    await this.throttle.recordSuccess(user.email);
    await this.log(
      actor,
      'user.clear_throttle',
      id,
      row
        ? { failures: row.failures, lockedUntil: row.lockedUntil }
        : { failures: 0 },
      { failures: 0 },
    );
  }

  async logoutEverywhere(actor: StaffContext, id: string): Promise<void> {
    await this.account(id);
    await this.auth.logoutAll(id);
    await this.log(actor, 'user.logout_everywhere', id);
  }

  async suspend(actor: StaffContext, id: string): Promise<void> {
    const user = await this.account(id);
    if (user.status !== UserStatus.ACTIVE) {
      throw new ConflictException('Only an active account can be suspended');
    }
    await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.SUSPENDED },
    });
    // Suspended accounts already fail the JWT guard; this also ends refresh.
    await this.auth.logoutAll(id);
    await this.log(
      actor,
      'user.suspend',
      id,
      { status: user.status },
      { status: UserStatus.SUSPENDED },
    );
  }

  async reactivate(actor: StaffContext, id: string): Promise<void> {
    const user = await this.account(id);
    if (user.status !== UserStatus.SUSPENDED) {
      throw new ConflictException(
        'Only a suspended account can be reactivated',
      );
    }
    await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.ACTIVE },
    });
    await this.log(
      actor,
      'user.reactivate',
      id,
      { status: user.status },
      { status: UserStatus.ACTIVE },
    );
  }

  /**
   * PERMANENT: the same erase as the person's own "delete account" (ADR-P011
   * cascade; RevenueCat customer first). There is no soft delete for accounts.
   * The staff member must type the account's email to confirm.
   */
  async deleteAccount(
    actor: StaffContext,
    id: string,
    confirmEmail: string,
  ): Promise<void> {
    const user = await this.account(id);
    if (normalizeEmail(confirmEmail) !== normalizeEmail(user.email)) {
      throw new BadRequestException('The typed email does not match');
    }
    // Audited first, so an erase can never happen unrecorded. If the erase
    // then fails, the account is still there for staff to see and retry.
    // Only the id and status go in the trail, never the address.
    await this.log(
      actor,
      'user.delete',
      id,
      { status: user.status },
      { erase: 'requested' },
    );
    await this.auth.eraseAccount(id, { by: 'staff' });
  }
}
