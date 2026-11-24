import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { StaffAuditAction } from '../domain/permissions';

export interface StaffAuditEntry {
  action: StaffAuditAction;
  staffId?: string | null;
  staffEmail?: string | null;
  targetType?: 'staff' | 'role' | 'user';
  targetId?: string;
  /** Account and support fields only — never health data, never a secret. */
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string | null;
}

export interface StaffAuditQuery {
  staffId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}

/**
 * The staff audit trail (ADR-P049). Append-only: the table's trigger refuses
 * UPDATE, DELETE and TRUNCATE.
 *
 * Unlike the app's AuditService, a failed write is NOT swallowed: an
 * unaudited staff action is worse than a failed request, so the error
 * reaches the caller (500) and the staff member sees the action failed.
 */
@Injectable()
export class StaffAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    entry: StaffAuditEntry,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    await client.staffAuditLog.create({
      data: {
        action: entry.action,
        staffId: entry.staffId ?? null,
        staffEmail: entry.staffEmail ?? null,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        before: (entry.before ?? undefined) as
          Prisma.InputJsonValue | undefined,
        after: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: entry.ip ?? null,
      },
    });
  }

  async list(query: StaffAuditQuery) {
    const where: Prisma.StaffAuditLogWhereInput = {
      staffId: query.staffId,
      action: query.action,
      targetType: query.targetType,
      targetId: query.targetId,
      // `to` is a calendar day (the SPA sends YYYY-MM-DD) and includes all of
      // it: everything before the start of the next UTC day.
      createdAt:
        query.from || query.to
          ? {
              gte: query.from,
              lt: query.to
                ? new Date(query.to.getTime() + 24 * 60 * 60_000)
                : undefined,
            }
          : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.staffAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.staffAuditLog.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }
}
