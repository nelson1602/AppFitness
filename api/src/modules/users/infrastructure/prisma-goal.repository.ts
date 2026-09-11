import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import {
  isAlreadySatisfiedDelete,
  type SyncTx,
} from '../../sync/domain/sync.types';
import {
  GoalRepositoryPort,
  type GoalResolution,
} from '../domain/goal.repository';
import { GoalAttributes, GoalRecord } from '../domain/goal.types';
import { goalToDomain } from './goal.mapper';

function toPrismaData(
  attributes: Partial<GoalAttributes>,
): Prisma.GoalUpdateInput {
  const data: Prisma.GoalUpdateInput = {};
  if (attributes.goalType !== undefined) data.goalType = attributes.goalType;
  if (attributes.targetWeightKg !== undefined)
    data.targetWeightKg = attributes.targetWeightKg;
  if (attributes.targetDate !== undefined) {
    data.targetDate = attributes.targetDate
      ? new Date(`${attributes.targetDate}T00:00:00Z`)
      : null;
  }
  if (attributes.isActive !== undefined) data.isActive = attributes.isActive;
  if (attributes.startedAt !== undefined) data.startedAt = attributes.startedAt;
  if (attributes.endedAt !== undefined) data.endedAt = attributes.endedAt;
  return data;
}

/**
 * Persistence for `goals` on the ADR-P030 C-2 transaction-aware contract.
 *
 * The `CREATE` is a static, entity-owned tagged-template statement with
 * `ON CONFLICT (id) DO NOTHING` so an id collision reports `0` **without
 * raising**, leaving the transaction usable for the re-read and the conflict
 * row. Every value is a driver parameter; no identifier is dynamic.
 *
 * `goals` takes a `Partial<GoalAttributes>`, so the statement reproduces the
 * **application defaults** for keys the payload omits — `is_active` true and
 * `started_at` now, the same values the column defaults would have produced.
 * Columns the database owns are still omitted so their defaults apply:
 * `created_at`, `version`, and `sync_seq`, which the `assign_sync_seq()`
 * trigger assigns. `updated_at` is `NOT NULL` with no database default —
 * Prisma supplies it from `@updatedAt` — so it is written explicitly.
 * Equivalence with Prisma's own `create` is asserted in
 * `test/sync-raw-create-equivalence.e2e-spec.ts`.
 */
@Injectable()
export class PrismaGoalRepository extends GoalRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findOwned(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<GoalRecord | null> {
    const row = await tx.goal.findFirst({ where: { id, userId } });
    return row ? goalToDomain(row) : null;
  }

  async create(
    tx: SyncTx,
    userId: string,
    id: string,
    attributes: Partial<GoalAttributes>,
  ): Promise<number> {
    // `goalType` is required by the handler (`requireGoalType`) before this
    // runs. `user_id` is the authenticated owner, never the payload's.
    return tx.$executeRaw`
      INSERT INTO goals (
        id, user_id, goal_type, target_weight_kg, target_date, is_active,
        started_at, ended_at, updated_at
      )
      VALUES (
        ${id}::uuid,
        ${userId}::uuid,
        ${attributes.goalType}::"GoalType",
        ${attributes.targetWeightKg ?? null},
        ${attributes.targetDate ?? null}::date,
        ${attributes.isActive ?? true},
        ${attributes.startedAt ?? new Date()},
        ${attributes.endedAt ?? null},
        ${new Date()}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  async update(
    tx: SyncTx,
    userId: string,
    id: string,
    attributes: Partial<GoalAttributes>,
    expectedVersion: number,
  ): Promise<number> {
    // `toPrismaData` is key-presence driven, so an omitted attribute is left
    // untouched — the patch is never widened into a replace (A-15(d)).
    const { count } = await tx.goal.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: {
        ...(toPrismaData(attributes) as Prisma.GoalUpdateManyMutationInput),
        version: expectedVersion + 1,
      },
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
    const { count } = await tx.goal.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: {
        deletedAt: new Date(),
        deletedBy,
        version: expectedVersion + 1,
      },
    });
    return count;
  }

  async changedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<GoalRecord[]> {
    const rows = await this.prisma.goal.findMany({
      where: { userId, syncSeq: { gt: BigInt(sinceSeq) } },
      orderBy: { syncSeq: 'asc' },
      take: limit,
    });
    return rows.map(goalToDomain);
  }

  async resolve(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: GoalResolution,
  ): Promise<number> {
    if (isAlreadySatisfiedDelete(resolution)) return 0;

    const fields: Prisma.GoalUpdateManyMutationInput =
      resolution.operation === 'DELETE'
        ? { deletedAt: new Date(), deletedBy: resolution.resolvedBy }
        : {
            ...(toPrismaData(
              resolution.attributes,
            ) as Prisma.GoalUpdateManyMutationInput),
            // A reviewed tombstone kept by the client is an explicit restore.
            ...(resolution.expectedDeleted
              ? { deletedAt: null, deletedBy: null }
              : {}),
          };

    const { count } = await tx.goal.updateMany({
      where: {
        id,
        userId,
        version: resolution.expectedVersion,
        deletedAt: resolution.expectedDeleted ? { not: null } : null,
      },
      data: { ...fields, version: resolution.expectedVersion + 1 },
    });
    return count;
  }
}
