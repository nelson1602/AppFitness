import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

const DAY_MS = 24 * 60 * 60_000;
export const NEW_USERS_DAYS = 30;
export const ACTIVE_DAYS = 7;

/** UTC calendar date, YYYY-MM-DD. */
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Backoffice dashboard (ADR-P049): account counts only. "Active" means the
 * account signed in or synced in the last 7 days. Days are UTC.
 */
@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(nowMs = Date.now()) {
    const now = new Date(nowMs);
    const todayStart = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    const since = new Date(todayStart - (NEW_USERS_DAYS - 1) * DAY_MS);
    const activeSince = new Date(nowMs - ACTIVE_DAYS * DAY_MS);

    const [totalUsers, verifiedUsers, newRows, activeRows, proCount] =
      await Promise.all([
        this.prisma.user.count({ where: { deletedAt: null } }),
        this.prisma.user.count({
          where: { deletedAt: null, emailVerifiedAt: { not: null } },
        }),
        this.prisma.$queryRaw<{ day: Date; count: bigint }[]>`
          SELECT date_trunc('day', created_at AT TIME ZONE 'UTC') AS day,
                 COUNT(*)::bigint AS count
          FROM users
          WHERE deleted_at IS NULL AND created_at >= ${since}
          GROUP BY 1`,
        this.prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(DISTINCT u.id)::bigint AS count
          FROM users u
          WHERE u.deleted_at IS NULL AND (
            EXISTS (SELECT 1 FROM sync_operations s
                    WHERE s.user_id = u.id AND s.applied_at >= ${activeSince})
            OR EXISTS (SELECT 1 FROM audit_logs a
                       WHERE a.user_id = u.id
                         AND a.action = ${AuditAction.LOGIN}::"AuditAction"
                         AND a.created_at >= ${activeSince}))`,
        this.prisma.subscriptionEntitlement.count({
          where: {
            isActive: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            user: { deletedAt: null },
          },
        }),
      ]);

    const byDay = new Map(
      newRows.map((row) => [isoDay(new Date(row.day)), Number(row.count)]),
    );
    const newPerDay = Array.from({ length: NEW_USERS_DAYS }, (_, index) => {
      const date = isoDay(new Date(since.getTime() + index * DAY_MS));
      return { date, count: byDay.get(date) ?? 0 };
    });

    return {
      totalUsers,
      newPerDay,
      verifiedPct:
        totalUsers === 0
          ? 0
          : Math.round((verifiedUsers / totalUsers) * 1000) / 10,
      active7d: Number(activeRows[0]?.count ?? 0),
      proCount,
    };
  }
}
