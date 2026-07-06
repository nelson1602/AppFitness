import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';

export interface AuditEntry {
  action: AuditAction;
  userId?: string | null;
  deviceId?: string | null;
  entityType?: string;
  entityId?: string;
  /** Operational metadata only — NEVER medical/PII values (.ai/05_SECURITY.md). */
  metadata?: Record<string, unknown>;
}

/**
 * Immutable audit trail writer (audit_logs is DB-enforced insert-only).
 * Audit failures are logged loudly but never break the business operation
 * — losing one audit row is preferable to blocking a login.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          userId: entry.userId ?? null,
          deviceId: entry.deviceId ?? null,
          entityType: entry.entityType,
          entityId: entry.entityId,
          metadata: (entry.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit entry for ${entry.action}`,
        error,
      );
    }
  }
}
