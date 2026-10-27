import { Injectable } from '@nestjs/common';
import { Prisma, type WeeklyPlan } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import {
  isAlreadySatisfiedDelete,
  type SyncTx,
} from '../../sync/domain/sync.types';
import type {
  WeeklyPlanCreateInput,
  WeeklyPlanUpdateInput,
} from '../domain/weekly-plan-payload';
import type { WeeklyPlanRecord } from '../domain/weekly-plan.types';

/** ADR-P030 §Decision 3 resolution semantics, as in the progress module. */
export type WeeklyPlanResolution = {
  expectedVersion: number;
  expectedDeleted: boolean;
  resolvedBy: string;
} & (
  | { operation: 'CREATE'; data: WeeklyPlanCreateInput }
  | { operation: 'UPDATE'; data: WeeklyPlanUpdateInput }
  | { operation: 'DELETE' }
);

export function weeklyPlanRowToRecord(r: WeeklyPlan): WeeklyPlanRecord {
  return {
    id: r.id,
    userId: r.userId,
    weekStart: r.weekStart,
    revision: r.revision,
    effectiveFrom: r.effectiveFrom,
    generationTrigger: r.generationTrigger,
    loadStep: r.loadStep,
    inputsFingerprint: r.inputsFingerprint,
    ruleVersions: r.ruleVersions as Record<string, string>,
    plan: r.plan as Record<string, unknown>,
    notes: r.notes as unknown[],
    version: r.version,
    syncSeq: Number(r.syncSeq),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt,
  };
}

const dateOnly = (d: Date): string => d.toISOString().slice(0, 10);

/** Wire shape = the mobile SQLite row; JSON columns travel as JSON strings. */
export function weeklyPlanToWire(r: WeeklyPlanRecord): Record<string, unknown> {
  return {
    id: r.id,
    user_id: r.userId,
    week_start: dateOnly(r.weekStart),
    revision: r.revision,
    effective_from: dateOnly(r.effectiveFrom),
    generation_trigger: r.generationTrigger,
    load_step: r.loadStep,
    inputs_fingerprint: r.inputsFingerprint,
    rule_versions: JSON.stringify(r.ruleVersions),
    plan: JSON.stringify(r.plan),
    notes: JSON.stringify(r.notes),
    version: r.version,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
    deleted_at: r.deletedAt ? r.deletedAt.toISOString() : null,
  };
}

/**
 * Persistence for `weekly_plans` (ADR-P042) on the ADR-P030 C-2
 * transaction-aware contract. CREATE is raw `ON CONFLICT (id) DO NOTHING` for
 * the same reason as every other synced entity (see PrismaProgressRepository):
 * an existing id must report 0 rows without aborting the transaction. A second
 * live row for the same (user, week, revision) still THROWS on the partial
 * unique index — a business-rule violation, never a silent overwrite.
 */
@Injectable()
export class PrismaWeeklyPlanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOwned(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<WeeklyPlanRecord | null> {
    const r = await tx.weeklyPlan.findFirst({ where: { id, userId } });
    return r ? weeklyPlanRowToRecord(r) : null;
  }

  async create(
    tx: SyncTx,
    userId: string,
    id: string,
    data: WeeklyPlanCreateInput,
  ): Promise<number> {
    return tx.$executeRaw`
      INSERT INTO weekly_plans (
        id, user_id, week_start, revision, effective_from, generation_trigger,
        load_step, inputs_fingerprint, rule_versions, plan, notes, updated_at
      )
      VALUES (
        ${id}::uuid,
        ${userId}::uuid,
        ${dateOnly(data.weekStart)}::date,
        ${data.revision},
        ${dateOnly(data.effectiveFrom)}::date,
        ${data.generationTrigger},
        ${data.loadStep},
        ${data.inputsFingerprint},
        ${JSON.stringify(data.ruleVersions)}::jsonb,
        ${JSON.stringify(data.plan)}::jsonb,
        ${JSON.stringify(data.notes)}::jsonb,
        ${new Date()}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  async update(
    tx: SyncTx,
    userId: string,
    id: string,
    data: WeeklyPlanUpdateInput,
    expectedVersion: number,
  ): Promise<number> {
    const { count } = await tx.weeklyPlan.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: { ...fields(data), version: expectedVersion + 1 },
    });
    return count;
  }

  async softDelete(
    tx: SyncTx,
    userId: string,
    id: string,
    deletedBy: string,
    expectedVersion: number,
  ): Promise<number> {
    const { count } = await tx.weeklyPlan.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: { deletedAt: new Date(), deletedBy, version: expectedVersion + 1 },
    });
    return count;
  }

  async changedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<WeeklyPlanRecord[]> {
    const rows = await this.prisma.weeklyPlan.findMany({
      where: { userId, syncSeq: { gt: BigInt(sinceSeq) } },
      orderBy: { syncSeq: 'asc' },
      take: limit,
    });
    return rows.map(weeklyPlanRowToRecord);
  }

  async resolve(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: WeeklyPlanResolution,
  ): Promise<number> {
    if (isAlreadySatisfiedDelete(resolution)) return 0;

    const where: Prisma.WeeklyPlanWhereInput = {
      id,
      userId,
      version: resolution.expectedVersion,
      deletedAt: resolution.expectedDeleted ? { not: null } : null,
    };
    const { count } = await tx.weeklyPlan.updateMany({
      where,
      data: {
        ...(resolution.operation === 'DELETE' ? {} : fields(resolution.data)),
        ...(resolution.operation === 'DELETE'
          ? { deletedAt: new Date(), deletedBy: userId }
          : resolution.expectedDeleted
            ? { deletedAt: null, deletedBy: null }
            : {}),
        version: resolution.expectedVersion + 1,
      },
    });
    return count;
  }
}

function fields(data: WeeklyPlanCreateInput) {
  return {
    weekStart: data.weekStart,
    revision: data.revision,
    effectiveFrom: data.effectiveFrom,
    generationTrigger: data.generationTrigger,
    loadStep: data.loadStep,
    inputsFingerprint: data.inputsFingerprint,
    ruleVersions: data.ruleVersions as Prisma.InputJsonObject,
    plan: data.plan as Prisma.InputJsonObject,
    notes: data.notes as Prisma.InputJsonArray,
  };
}
