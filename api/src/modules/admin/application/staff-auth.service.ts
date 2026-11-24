import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { StaffSessionStage, StaffStatus } from '@prisma/client';

import {
  LoginThrottleService,
  normalizeEmail,
} from '../../auth/application/login-throttle.service';
import { CLOCK, type Clock } from '../../auth/infrastructure/clock.service';
import { PasswordService } from '../../auth/infrastructure/password.service';
import { PrismaService } from '../../database/prisma.service';
import { isStaffPermission } from '../domain/permissions';
import {
  meetsStaffPasswordPolicy,
  STAFF_MFA_MAX_FAILURES,
  STAFF_MFA_PENDING_MS,
  STAFF_PASSWORD_MIN,
  STAFF_SESSION_ABSOLUTE_MS,
  STAFF_SESSION_IDLE_MS,
  STAFF_SESSION_TOUCH_MS,
  type StaffContext,
} from '../domain/staff.types';
import { generateTotpSecret, otpauthUri, verifyTotp } from '../domain/totp';
import { StaffSecretsService } from '../infrastructure/staff-secrets.service';
import { StaffAuditService } from './staff-audit.service';

/** Same answer for every sign-in failure: nothing about which part failed. */
const INVALID = 'Invalid credentials';
const INVALID_INVITE = 'Invalid or expired invite';

/** Throttle keys live beside the app's, so they get a prefix of their own. */
const throttleKey = (email: string) => `staff:${normalizeEmail(email)}`;

/**
 * Staff sign-in, sessions and invite acceptance (ADR-P049).
 *
 * Sign-in is two steps: email + password opens a short MFA-pending session;
 * a valid TOTP code replaces it with a fresh ACTIVE session (the token rotates,
 * so a pending token never becomes a full one). Sessions are opaque random
 * tokens; only their HMAC is stored. A session dies on logout, after 15 min
 * idle, 8 h after sign-in, or when the staff member's session version moves
 * (disable, role change).
 */
@Injectable()
export class StaffAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly throttle: LoginThrottleService,
    private readonly secrets: StaffSecretsService,
    private readonly audit: StaffAuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Step 1. Returns the raw MFA-pending token for the cookie. */
  async login(input: {
    email: string;
    password: string;
    ip: string | null;
  }): Promise<{ token: string; maxAgeMs: number }> {
    const email = normalizeEmail(input.email);
    await this.throttle.assertNotLocked(throttleKey(email));

    const staff = await this.prisma.staffUser.findUnique({ where: { email } });
    // Unknown address or no password yet: still pay for one Argon2 run.
    const passwordOk = staff?.passwordHash
      ? await this.passwords.verify(staff.passwordHash, input.password)
      : await this.passwords.verifyDummy(input.password);
    const ok =
      staff !== null &&
      passwordOk &&
      staff.status === StaffStatus.ACTIVE &&
      staff.totpEnabledAt !== null;

    if (!ok) {
      await this.throttle.recordFailure(throttleKey(email));
      await this.audit.record({
        action: 'auth.login_failed',
        staffId: staff?.id ?? null,
        staffEmail: staff?.email ?? null,
        after: { step: 'password' },
        ip: input.ip,
      });
      throw new UnauthorizedException(INVALID);
    }

    const now = this.clock.now();
    const { raw, hash } = this.secrets.newToken();
    await this.prisma.staffSession.create({
      data: {
        staffId: staff.id,
        tokenHash: hash,
        stage: StaffSessionStage.MFA_PENDING,
        sessionVersion: staff.sessionVersion,
        ip: input.ip,
        createdAt: new Date(now),
        lastSeenAt: new Date(now),
        expiresAt: new Date(now + STAFF_MFA_PENDING_MS),
      },
    });
    return { token: raw, maxAgeMs: STAFF_MFA_PENDING_MS };
  }

  /** Step 2. Returns the new ACTIVE session token. */
  async verifyTotp(input: {
    pendingToken: string | null;
    code: string;
    ip: string | null;
  }): Promise<{ token: string; maxAgeMs: number; staffId: string }> {
    if (!input.pendingToken) throw new UnauthorizedException(INVALID);
    const now = this.clock.now();
    const session = await this.prisma.staffSession.findUnique({
      where: { tokenHash: this.secrets.hashToken(input.pendingToken) },
      include: { staff: true },
    });
    if (
      !session ||
      session.stage !== StaffSessionStage.MFA_PENDING ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= now ||
      session.staff.status !== StaffStatus.ACTIVE ||
      session.staff.totpSecretEnc === null ||
      session.sessionVersion !== session.staff.sessionVersion
    ) {
      throw new UnauthorizedException(INVALID);
    }
    const staff = session.staff;
    await this.throttle.assertNotLocked(throttleKey(staff.email));

    const secret = this.secrets.decryptTotpSecret(staff.totpSecretEnc!);
    const step = verifyTotp(
      secret,
      input.code,
      now,
      staff.totpLastStep === null ? null : Number(staff.totpLastStep),
    );
    if (step === null) {
      const failures = session.mfaFailures + 1;
      await this.prisma.staffSession.update({
        where: { id: session.id },
        data: {
          mfaFailures: failures,
          revokedAt: failures >= STAFF_MFA_MAX_FAILURES ? new Date(now) : null,
        },
      });
      await this.throttle.recordFailure(throttleKey(staff.email));
      await this.audit.record({
        action: 'auth.login_failed',
        staffId: staff.id,
        staffEmail: staff.email,
        after: { step: 'totp' },
        ip: input.ip,
      });
      throw new UnauthorizedException(INVALID);
    }

    const { raw, hash } = this.secrets.newToken();
    await this.prisma.$transaction(async (tx) => {
      // Single use: only the request that revokes the pending row proceeds.
      const claimed = await tx.staffSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date(now) },
      });
      if (claimed.count !== 1) throw new UnauthorizedException(INVALID);
      await tx.staffUser.update({
        where: { id: staff.id },
        data: { totpLastStep: BigInt(step), lastLoginAt: new Date(now) },
      });
      await tx.staffSession.create({
        data: {
          staffId: staff.id,
          tokenHash: hash,
          stage: StaffSessionStage.ACTIVE,
          sessionVersion: staff.sessionVersion,
          ip: input.ip,
          createdAt: new Date(now),
          lastSeenAt: new Date(now),
          expiresAt: new Date(now + STAFF_SESSION_ABSOLUTE_MS),
        },
      });
      await this.audit.record(
        {
          action: 'auth.login',
          staffId: staff.id,
          staffEmail: staff.email,
          ip: input.ip,
        },
        tx,
      );
    });
    await this.throttle.recordSuccess(throttleKey(staff.email));
    return {
      token: raw,
      maxAgeMs: STAFF_SESSION_ABSOLUTE_MS,
      staffId: staff.id,
    };
  }

  /**
   * The staff member behind an ACTIVE session token, or null. Reads the role
   * and permissions from the database on every request, so a change applies
   * at once.
   */
  async resolveSession(
    token: string | null,
    ip: string | null,
  ): Promise<StaffContext | null> {
    if (!token) return null;
    const now = this.clock.now();
    const session = await this.prisma.staffSession.findUnique({
      where: { tokenHash: this.secrets.hashToken(token) },
      include: {
        staff: {
          include: { role: { include: { permissions: true } } },
        },
      },
    });
    if (
      !session ||
      session.stage !== StaffSessionStage.ACTIVE ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= now ||
      now - session.lastSeenAt.getTime() > STAFF_SESSION_IDLE_MS ||
      session.staff.status !== StaffStatus.ACTIVE ||
      session.staff.totpEnabledAt === null ||
      session.sessionVersion !== session.staff.sessionVersion
    ) {
      return null;
    }
    if (now - session.lastSeenAt.getTime() > STAFF_SESSION_TOUCH_MS) {
      await this.prisma.staffSession.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(now) },
      });
    }
    const { staff } = session;
    return {
      id: staff.id,
      email: staff.email,
      displayName: staff.displayName,
      role: {
        id: staff.role.id,
        key: staff.role.key,
        name: staff.role.name,
        isSystem: staff.role.isSystem,
      },
      permissions: staff.role.permissions
        .map((row) => row.permissionKey)
        .filter(isStaffPermission)
        .sort(),
      sessionId: session.id,
      ip,
    };
  }

  async logout(staff: StaffContext): Promise<void> {
    await this.prisma.staffSession.updateMany({
      where: { id: staff.sessionId, revokedAt: null },
      data: { revokedAt: new Date(this.clock.now()) },
    });
    await this.audit.record({
      action: 'auth.logout',
      staffId: staff.id,
      staffEmail: staff.email,
      ip: staff.ip,
    });
  }

  // ─── Invites ──────────────────────────────────────────────────────────────

  private async openInvite(token: string) {
    const invite = await this.prisma.staffInvite.findUnique({
      where: { tokenHash: this.secrets.hashToken(token) },
      include: { staff: true },
    });
    if (
      !invite ||
      invite.consumedAt !== null ||
      invite.invalidatedAt !== null ||
      invite.expiresAt.getTime() <= this.clock.now() ||
      invite.staff.status !== StaffStatus.INVITED
    ) {
      throw new BadRequestException(INVALID_INVITE);
    }
    return invite;
  }

  async inspectInvite(token: string): Promise<{ email: string }> {
    const invite = await this.openInvite(token);
    return { email: invite.staff.email };
  }

  /**
   * Sets the password and a NEW TOTP secret (pending until confirmed). Can be
   * repeated before confirming; each call replaces the secret.
   */
  async acceptInvite(input: {
    token: string;
    password: string;
  }): Promise<{ totpSecret: string; otpauthUri: string }> {
    const invite = await this.openInvite(input.token);
    if (!meetsStaffPasswordPolicy(input.password, invite.staff.email)) {
      throw new BadRequestException(
        `Password must be ${STAFF_PASSWORD_MIN}+ characters and not your email`,
      );
    }
    const secret = generateTotpSecret();
    await this.prisma.staffUser.update({
      where: { id: invite.staffId },
      data: {
        passwordHash: await this.passwords.hash(input.password),
        totpSecretEnc: this.secrets.encryptTotpSecret(secret),
        totpEnabledAt: null,
        totpLastStep: null,
      },
    });
    return {
      totpSecret: secret,
      otpauthUri: otpauthUri(secret, invite.staff.email),
    };
  }

  /** A correct code activates the account and spends the invite. */
  async confirmInvite(input: {
    token: string;
    code: string;
    ip: string | null;
  }): Promise<void> {
    const invite = await this.openInvite(input.token);
    const staff = invite.staff;
    if (!staff.passwordHash || !staff.totpSecretEnc) {
      throw new BadRequestException(INVALID_INVITE);
    }
    const now = this.clock.now();
    const step = verifyTotp(
      this.secrets.decryptTotpSecret(staff.totpSecretEnc),
      input.code,
      now,
      null,
    );
    if (step === null) throw new BadRequestException('Invalid code');

    await this.prisma.$transaction(async (tx) => {
      const spent = await tx.staffInvite.updateMany({
        where: { id: invite.id, consumedAt: null, invalidatedAt: null },
        data: { consumedAt: new Date(now) },
      });
      if (spent.count !== 1) throw new BadRequestException(INVALID_INVITE);
      await tx.staffUser.update({
        where: { id: staff.id },
        data: {
          status: StaffStatus.ACTIVE,
          totpEnabledAt: new Date(now),
          totpLastStep: BigInt(step),
        },
      });
      await this.audit.record(
        {
          action: 'staff.invite_accepted',
          staffId: staff.id,
          staffEmail: staff.email,
          targetType: 'staff',
          targetId: staff.id,
          before: { status: StaffStatus.INVITED },
          after: { status: StaffStatus.ACTIVE },
          ip: input.ip,
        },
        tx,
      );
    });
  }
}
