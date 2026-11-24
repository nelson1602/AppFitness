import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, StaffStatus } from '@prisma/client';

import { normalizeEmail } from '../../auth/application/login-throttle.service';
import { CLOCK, type Clock } from '../../auth/infrastructure/clock.service';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../../mail/application/mail.service';
import { ADMIN_CONFIG, type AdminConfig } from '../admin.config';
import {
  isStaffPermission,
  OWNER_ONLY_PERMISSIONS,
  SUPER_ADMIN_ROLE_ID,
  type StaffPermissionKey,
} from '../domain/permissions';
import {
  STAFF_BOOTSTRAP_INVITE_TTL_HOURS,
  STAFF_INVITE_TTL_HOURS,
  type StaffContext,
} from '../domain/staff.types';
import { StaffSecretsService } from '../infrastructure/staff-secrets.service';
import { StaffAuditService } from './staff-audit.service';

const HOUR_MS = 60 * 60_000;

const STAFF_SELECT = {
  id: true,
  email: true,
  displayName: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  role: { select: { id: true, key: true, name: true, isSystem: true } },
} satisfies Prisma.StaffUserSelect;

/**
 * Staff, roles and invites (ADR-P049). Only holders of staff.manage /
 * roles.manage reach here, and only the SUPER_ADMIN system role can hold
 * those (enforced again by a database trigger). The owner account is
 * immutable: not disabled, not demoted, not edited by anyone else.
 */
@Injectable()
export class StaffManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: StaffSecretsService,
    private readonly audit: StaffAuditService,
    private readonly mail: MailService,
    @Inject(ADMIN_CONFIG) private readonly config: AdminConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  inviteUrl(rawToken: string): string {
    if (!this.config.enabled) throw new ServiceUnavailableException();
    return `${this.config.publicUrl}/#/invitacion?token=${encodeURIComponent(rawToken)}`;
  }

  /** Invalidates any open invite and issues a new one. Returns the raw token. */
  private async issueInvite(
    tx: Prisma.TransactionClient,
    staffId: string,
    createdById: string | null,
    ttlHours: number,
  ): Promise<string> {
    const now = this.clock.now();
    await tx.staffInvite.updateMany({
      where: { staffId, consumedAt: null, invalidatedAt: null },
      data: { invalidatedAt: new Date(now) },
    });
    const { raw, hash } = this.secrets.newToken();
    await tx.staffInvite.create({
      data: {
        staffId,
        tokenHash: hash,
        expiresAt: new Date(now + ttlHours * HOUR_MS),
        createdById,
      },
    });
    return raw;
  }

  private requireMail(): void {
    if (!this.mail.enabled) {
      throw new ServiceUnavailableException(
        'Mail is not configured, so an invite cannot be sent',
      );
    }
  }

  // ─── Staff ────────────────────────────────────────────────────────────────

  listStaff() {
    return this.prisma.staffUser.findMany({
      select: STAFF_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  private async assignableRole(roleId: string) {
    const role = await this.prisma.staffRole.findUnique({
      where: { id: roleId },
    });
    if (!role) throw new BadRequestException('Unknown role');
    if (role.isSystem) {
      throw new ForbiddenException('A system role cannot be assigned');
    }
    return role;
  }

  private async mutableStaff(id: string, actor: StaffContext) {
    const target = await this.prisma.staffUser.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!target) throw new NotFoundException('Staff member not found');
    if (target.role.isSystem) {
      throw new ForbiddenException('The owner account cannot be changed');
    }
    if (target.id === actor.id) {
      throw new ForbiddenException('You cannot change your own account');
    }
    return target;
  }

  async createStaff(
    actor: StaffContext,
    input: { email: string; displayName?: string; roleId: string },
  ) {
    this.requireMail();
    const email = normalizeEmail(input.email);
    const role = await this.assignableRole(input.roleId);
    if (await this.prisma.staffUser.findUnique({ where: { email } })) {
      throw new ConflictException('A staff member with this email exists');
    }
    const { staff, raw } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.staffUser.create({
        data: {
          email,
          displayName: input.displayName?.trim() || null,
          roleId: role.id,
          status: StaffStatus.INVITED,
          createdById: actor.id,
        },
        select: STAFF_SELECT,
      });
      const token = await this.issueInvite(
        tx,
        created.id,
        actor.id,
        STAFF_INVITE_TTL_HOURS,
      );
      await this.audit.record(
        {
          action: 'staff.invite',
          staffId: actor.id,
          staffEmail: actor.email,
          targetType: 'staff',
          targetId: created.id,
          after: { email, roleKey: role.key, status: StaffStatus.INVITED },
          ip: actor.ip,
        },
        tx,
      );
      return { staff: created, raw: token };
    });
    await this.mail.sendStaffInvite({
      to: email,
      inviteUrl: this.inviteUrl(raw),
      expiresInHours: STAFF_INVITE_TTL_HOURS,
    });
    return staff;
  }

  async resendInvite(actor: StaffContext, id: string): Promise<void> {
    this.requireMail();
    const target = await this.mutableStaff(id, actor);
    if (target.status !== StaffStatus.INVITED) {
      throw new ConflictException('Only a pending invite can be resent');
    }
    const raw = await this.prisma.$transaction(async (tx) => {
      const token = await this.issueInvite(
        tx,
        target.id,
        actor.id,
        STAFF_INVITE_TTL_HOURS,
      );
      await this.audit.record(
        {
          action: 'staff.invite_resend',
          staffId: actor.id,
          staffEmail: actor.email,
          targetType: 'staff',
          targetId: target.id,
          ip: actor.ip,
        },
        tx,
      );
      return token;
    });
    await this.mail.sendStaffInvite({
      to: target.email,
      inviteUrl: this.inviteUrl(raw),
      expiresInHours: STAFF_INVITE_TTL_HOURS,
    });
  }

  async updateStaff(
    actor: StaffContext,
    id: string,
    input: { roleId?: string; displayName?: string | null },
  ) {
    const target = await this.mutableStaff(id, actor);
    const role = input.roleId
      ? await this.assignableRole(input.roleId)
      : target.role;
    const displayName =
      input.displayName === undefined
        ? target.displayName
        : input.displayName?.trim() || null;
    const roleChanged = role.id !== target.roleId;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.staffUser.update({
        where: { id: target.id },
        data: {
          roleId: role.id,
          displayName,
          // A new role ends every session: the next request signs in again.
          sessionVersion: roleChanged ? { increment: 1 } : undefined,
        },
        select: STAFF_SELECT,
      });
      await this.audit.record(
        {
          action: 'staff.update',
          staffId: actor.id,
          staffEmail: actor.email,
          targetType: 'staff',
          targetId: target.id,
          before: { roleKey: target.role.key, displayName: target.displayName },
          after: { roleKey: role.key, displayName },
          ip: actor.ip,
        },
        tx,
      );
      return updated;
    });
  }

  async disableStaff(actor: StaffContext, id: string) {
    const target = await this.mutableStaff(id, actor);
    if (target.status === StaffStatus.DISABLED) return;
    const now = new Date(this.clock.now());
    await this.prisma.$transaction(async (tx) => {
      await tx.staffUser.update({
        where: { id: target.id },
        data: {
          status: StaffStatus.DISABLED,
          sessionVersion: { increment: 1 },
        },
      });
      await tx.staffSession.updateMany({
        where: { staffId: target.id, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.staffInvite.updateMany({
        where: { staffId: target.id, consumedAt: null, invalidatedAt: null },
        data: { invalidatedAt: now },
      });
      await this.audit.record(
        {
          action: 'staff.disable',
          staffId: actor.id,
          staffEmail: actor.email,
          targetType: 'staff',
          targetId: target.id,
          before: { status: target.status },
          after: { status: StaffStatus.DISABLED },
          ip: actor.ip,
        },
        tx,
      );
    });
  }

  async enableStaff(actor: StaffContext, id: string) {
    const target = await this.mutableStaff(id, actor);
    if (target.status !== StaffStatus.DISABLED) return;
    // Never enrolled: back to INVITED, and a fresh invite is needed.
    const status =
      target.totpEnabledAt !== null ? StaffStatus.ACTIVE : StaffStatus.INVITED;
    await this.prisma.$transaction(async (tx) => {
      await tx.staffUser.update({
        where: { id: target.id },
        data: { status },
      });
      await this.audit.record(
        {
          action: 'staff.enable',
          staffId: actor.id,
          staffEmail: actor.email,
          targetType: 'staff',
          targetId: target.id,
          before: { status: StaffStatus.DISABLED },
          after: { status },
          ip: actor.ip,
        },
        tx,
      );
    });
  }

  // ─── Roles ────────────────────────────────────────────────────────────────

  listPermissions() {
    return this.prisma.staffPermission.findMany({ orderBy: { key: 'asc' } });
  }

  async listRoles() {
    const roles = await this.prisma.staffRole.findMany({
      include: {
        permissions: { select: { permissionKey: true } },
        _count: { select: { staff: true } },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    return roles.map((role) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.permissions.map((p) => p.permissionKey).sort(),
      staffCount: role._count.staff,
    }));
  }

  private grantable(keys: string[]): StaffPermissionKey[] {
    const unique = [...new Set(keys)];
    for (const key of unique) {
      if (!isStaffPermission(key)) {
        throw new BadRequestException(`Unknown permission ${key}`);
      }
      if (OWNER_ONLY_PERMISSIONS.includes(key)) {
        throw new ForbiddenException(`${key} is reserved for the owner`);
      }
    }
    return unique as StaffPermissionKey[];
  }

  private async customRole(id: string) {
    const role = await this.prisma.staffRole.findUnique({
      where: { id },
      include: { permissions: true },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) {
      throw new ForbiddenException('A system role cannot be changed');
    }
    return role;
  }

  private roleKey(name: string): string {
    const slug = name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
    return `ROLE_${slug || 'CUSTOM'}_${this.secrets.newToken().raw.slice(0, 6).toUpperCase()}`;
  }

  async createRole(
    actor: StaffContext,
    input: { name: string; description?: string; permissions: string[] },
  ) {
    const permissions = this.grantable(input.permissions);
    const name = input.name.trim();
    if (await this.prisma.staffRole.findUnique({ where: { name } })) {
      throw new ConflictException('A role with this name exists');
    }
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.staffRole.create({
        data: {
          key: this.roleKey(name),
          name,
          description: input.description?.trim() || null,
          permissions: {
            create: permissions.map((permissionKey) => ({ permissionKey })),
          },
        },
      });
      await this.audit.record(
        {
          action: 'role.create',
          staffId: actor.id,
          staffEmail: actor.email,
          targetType: 'role',
          targetId: role.id,
          after: { name, permissions },
          ip: actor.ip,
        },
        tx,
      );
      return role;
    });
  }

  async updateRole(
    actor: StaffContext,
    id: string,
    input: {
      name?: string;
      description?: string | null;
      permissions?: string[];
    },
  ) {
    const role = await this.customRole(id);
    const before = {
      name: role.name,
      description: role.description,
      permissions: role.permissions.map((p) => p.permissionKey).sort(),
    };
    const permissions =
      input.permissions === undefined
        ? before.permissions
        : this.grantable(input.permissions).sort();
    const name = input.name?.trim() || role.name;
    const description =
      input.description === undefined
        ? role.description
        : input.description?.trim() || null;
    if (name !== role.name) {
      const clash = await this.prisma.staffRole.findUnique({ where: { name } });
      if (clash) throw new ConflictException('A role with this name exists');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.staffRole.update({
        where: { id },
        data: { name, description },
      });
      if (input.permissions !== undefined) {
        await tx.staffRolePermission.deleteMany({ where: { roleId: id } });
        await tx.staffRolePermission.createMany({
          data: permissions.map((permissionKey) => ({
            roleId: id,
            permissionKey,
          })),
        });
      }
      await this.audit.record(
        {
          action: 'role.update',
          staffId: actor.id,
          staffEmail: actor.email,
          targetType: 'role',
          targetId: id,
          before,
          after: { name, description, permissions },
          ip: actor.ip,
        },
        tx,
      );
    });
  }

  async deleteRole(actor: StaffContext, id: string): Promise<void> {
    const role = await this.customRole(id);
    const assigned = await this.prisma.staffUser.count({
      where: { roleId: id },
    });
    if (assigned > 0) {
      throw new ConflictException('The role is still assigned to staff');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.staffRole.delete({ where: { id } });
      await this.audit.record(
        {
          action: 'role.delete',
          staffId: actor.id,
          staffEmail: actor.email,
          targetType: 'role',
          targetId: id,
          before: {
            name: role.name,
            permissions: role.permissions.map((p) => p.permissionKey).sort(),
          },
          ip: actor.ip,
        },
        tx,
      );
    });
  }

  // ─── Bootstrap ────────────────────────────────────────────────────────────

  /**
   * `npm run admin:bootstrap -- <email>`: creates the owner (SUPER_ADMIN) as
   * an invite. Refused once an owner has activated; re-issues the invite for
   * the same address before that. No password is ever set here.
   */
  async bootstrapOwner(rawEmail: string): Promise<{
    inviteUrl: string;
    emailed: boolean;
    expiresInHours: number;
  }> {
    const email = normalizeEmail(rawEmail);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('A valid email address is required');
    }
    const owners = await this.prisma.staffUser.findMany({
      where: { roleId: SUPER_ADMIN_ROLE_ID },
    });
    if (owners.some((owner) => owner.status !== StaffStatus.INVITED)) {
      throw new ConflictException('An owner account already exists');
    }
    if (owners.some((owner) => owner.email !== email)) {
      throw new ConflictException(
        'A pending owner invite exists for another address',
      );
    }
    const clash = await this.prisma.staffUser.findUnique({ where: { email } });
    if (clash && clash.roleId !== SUPER_ADMIN_ROLE_ID) {
      throw new ConflictException('This address belongs to another staff role');
    }
    const raw = await this.prisma.$transaction(async (tx) => {
      const owner =
        owners[0] ??
        (await tx.staffUser.create({
          data: {
            email,
            roleId: SUPER_ADMIN_ROLE_ID,
            status: StaffStatus.INVITED,
          },
        }));
      const token = await this.issueInvite(
        tx,
        owner.id,
        null,
        STAFF_BOOTSTRAP_INVITE_TTL_HOURS,
      );
      await this.audit.record(
        {
          action: 'staff.bootstrap',
          staffId: null,
          staffEmail: null,
          targetType: 'staff',
          targetId: owner.id,
          after: { email, roleKey: 'SUPER_ADMIN', status: StaffStatus.INVITED },
          ip: 'cli',
        },
        tx,
      );
      return token;
    });
    const inviteUrl = this.inviteUrl(raw);
    let emailed = false;
    if (this.mail.enabled) {
      await this.mail.sendStaffInvite({
        to: email,
        inviteUrl,
        expiresInHours: STAFF_BOOTSTRAP_INVITE_TTL_HOURS,
      });
      emailed = true;
    }
    return {
      inviteUrl,
      emailed,
      expiresInHours: STAFF_BOOTSTRAP_INVITE_TTL_HOURS,
    };
  }
}
