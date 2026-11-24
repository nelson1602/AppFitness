import { BadRequestException, Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';

import {
  AppConfigService,
  type AppConfigInput,
  editableFields,
} from '../../app-config/app-config.service';
import { PrismaService } from '../../database/prisma.service';
import { SubscriptionService } from '../../subscriptions/application/subscription.service';
import type { PromotionalDuration } from '../../subscriptions/domain/subscription.types';
import type { StaffContext } from '../domain/staff.types';
import { StaffAuditService } from './staff-audit.service';
import { type UserSummary, UserSupportService } from './user-support.service';

const UTF8_BOM = String.fromCharCode(0xfeff);

/** Largest export in one file; past this, narrow the filter. */
export const EXPORT_MAX_ROWS = 50_000;
const EXPORT_PAGE = 500;

export const EXPORT_COLUMNS = [
  'id',
  'email',
  'username',
  'created_at',
  'email_verified',
  'status',
  'last_login_at',
  'device_count',
  'last_sync_at',
  'is_pro',
] as const;

/**
 * One CSV cell (RFC 4180). A value that a spreadsheet would run as a formula
 * (leading = + - @, tab or carriage return) gets a leading apostrophe, so an
 * email or username can never execute in Excel or Sheets (CSV injection).
 */
export function csvCell(value: string | number | boolean | null): string {
  if (value === null) return '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvRow(user: UserSummary): string {
  return [
    user.id,
    user.email,
    user.username,
    user.createdAt.toISOString(),
    user.emailVerified,
    user.status,
    user.lastLoginAt?.toISOString() ?? null,
    user.deviceCount,
    user.lastSyncAt?.toISOString() ?? null,
    user.isPro,
  ]
    .map(csvCell)
    .join(',');
}

/**
 * Backoffice app management (ADR-P049 amendment 1): app config, CSV export
 * of the user list, and RevenueCat promotional Pro. Every write is audited.
 */
@Injectable()
export class AppManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfigService,
    private readonly users: UserSupportService,
    private readonly subscriptions: SubscriptionService,
    private readonly audit: StaffAuditService,
  ) {}

  // ─── App config ───────────────────────────────────────────────────────────

  async getConfig(): Promise<AppConfigInput & { updatedAt: Date }> {
    const row = await this.appConfig.current();
    return { ...editableFields(row), updatedAt: row.updatedAt };
  }

  async updateConfig(actor: StaffContext, input: AppConfigInput) {
    const es = input.maintenanceMessageEs?.trim() || null;
    const en = input.maintenanceMessageEn?.trim() || null;
    if (input.maintenanceEnabled && (!es || !en)) {
      throw new BadRequestException(
        'The banner needs its Spanish and English text',
      );
    }
    const next: AppConfigInput = {
      maintenanceEnabled: input.maintenanceEnabled,
      maintenanceTone: input.maintenanceTone,
      maintenanceMessageEs: es,
      maintenanceMessageEn: en,
      minAndroidVersionCode: input.minAndroidVersionCode,
    };
    const before = editableFields(await this.appConfig.current());
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.appConfig.update({
        where: { id: 'global' },
        data: { ...next, updatedByStaffId: actor.id },
      });
      await this.audit.record(
        {
          action: 'config.update',
          staffId: actor.id,
          staffEmail: actor.email,
          targetType: 'config',
          targetId: 'global',
          before: { ...before },
          after: { ...next },
          ip: actor.ip,
        },
        tx,
      );
      return { ...editableFields(row), updatedAt: row.updatedAt };
    });
  }

  // ─── CSV export ───────────────────────────────────────────────────────────

  /**
   * The user list as CSV, with the same filter as the list screen. Account
   * and support fields only (the list's own columns): never health data.
   */
  async exportUsers(
    actor: StaffContext,
    filter: { q?: string; status?: UserStatus },
  ): Promise<{ csv: string; rows: number }> {
    const lines: string[] = [EXPORT_COLUMNS.join(',')];
    let rows = 0;
    for (let page = 1; rows < EXPORT_MAX_ROWS; page += 1) {
      const result = await this.users.search({
        ...filter,
        page,
        pageSize: EXPORT_PAGE,
      });
      for (const user of result.items) {
        if (rows >= EXPORT_MAX_ROWS) break;
        lines.push(csvRow(user));
        rows += 1;
      }
      if (result.items.length < EXPORT_PAGE) break;
    }
    await this.audit.record({
      action: 'user.export',
      staffId: actor.id,
      staffEmail: actor.email,
      // The filter and the count; never the rows themselves.
      after: { q: filter.q ?? null, status: filter.status ?? null, rows },
      ip: actor.ip,
    });
    // UTF-8 BOM so Excel opens accents (ñ, á) correctly.
    return { csv: `${UTF8_BOM}${lines.join('\r\n')}\r\n`, rows };
  }

  // ─── Subscriptions ────────────────────────────────────────────────────────

  async subscription(userId: string) {
    await this.users.detail(userId); // 404 for an unknown account
    const [mirror, provider] = await Promise.all([
      this.subscriptions.getStatus(userId),
      this.subscriptions.providerSnapshot(userId).then(
        (snapshot) => ({ available: true as const, snapshot }),
        () => ({ available: false as const, snapshot: null }),
      ),
    ]);
    return { mirror, provider };
  }

  async changePromotional(
    actor: StaffContext,
    userId: string,
    change: { grant: PromotionalDuration } | { revoke: true },
  ) {
    await this.users.detail(userId);
    const before = await this.subscriptions.getStatus(userId);
    const after = await this.subscriptions.staffChangePromotional(
      userId,
      change,
    );
    await this.audit.record({
      action:
        'grant' in change
          ? 'subscription.grant_promotional'
          : 'subscription.revoke_promotional',
      staffId: actor.id,
      staffEmail: actor.email,
      targetType: 'user',
      targetId: userId,
      before: { state: before.state, expiresAt: before.expiresAt },
      after: {
        state: after.state,
        expiresAt: after.expiresAt,
        ...('grant' in change ? { duration: change.grant } : {}),
      },
      ip: actor.ip,
    });
    return after;
  }
}
