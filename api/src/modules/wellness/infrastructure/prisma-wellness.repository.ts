import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import {
  isAlreadySatisfiedDelete,
  type SyncTx,
} from '../../sync/domain/sync.types';
import type { WellnessSafetyProfileWriteInput } from '../domain/wellness-payload';
import {
  WellnessRepositoryPort,
  type WellnessResolution,
} from '../domain/wellness.repository';
import type { WellnessSafetyProfileRecord } from '../domain/wellness.types';
import { wellnessRowToRecord } from './wellness.mapper';

/**
 * Persistence for the Wellness Safety Profile (ADR-P017 W-2).
 *
 * Every statement is owner-scoped. Mutations use `updateMany` with
 * `{ id, userId }` rather than `update({ where: { id } })`: an id-only write
 * would succeed against another account's row, and the `count` it returns is
 * what lets the handler treat "not yours" as a failure instead of a no-op.
 * `userId` is always the authenticated user the pipeline passes in — a
 * client-supplied owner never reaches this layer.
 */
@Injectable()
export class PrismaWellnessRepository extends WellnessRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findOwned(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<WellnessSafetyProfileRecord | null> {
    const row = await tx.wellnessSafetyProfile.findFirst({
      where: { id, userId },
    });
    return row ? wellnessRowToRecord(row) : null;
  }

  async create(
    tx: SyncTx,
    userId: string,
    id: string,
    data: WellnessSafetyProfileWriteInput,
  ): Promise<number> {
    return tx.$executeRaw`
      INSERT INTO wellness_safety_profiles (
        id, user_id, evaluation_completed, evaluation_date, affected_areas,
        movements_to_avoid, updated_at
      )
      VALUES (
        ${id}::uuid, ${userId}::uuid, ${data.evaluationCompleted},
        ${dateOnly(data.evaluationDate)}::date, ${data.affectedAreas},
        ${data.movementsToAvoid}, ${new Date()}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  async update(
    tx: SyncTx,
    userId: string,
    id: string,
    data: WellnessSafetyProfileWriteInput,
    expectedVersion: number,
  ): Promise<number> {
    // No `deletedAt: null` filter: an UPDATE over a tombstone is the revive
    // path for this singleton, and the pipeline has already matched versions.
    const { count } = await tx.wellnessSafetyProfile.updateMany({
      where: { id, userId, version: expectedVersion },
      data: {
        evaluationCompleted: data.evaluationCompleted,
        evaluationDate: data.evaluationDate,
        affectedAreas: data.affectedAreas,
        movementsToAvoid: data.movementsToAvoid,
        version: expectedVersion + 1,
        deletedAt: null,
        deletedBy: null,
      },
    });
    return count;
  }

  async softDelete(
    tx: SyncTx,
    userId: string,
    id: string,
    expectedVersion: number,
    deletedAt: Date,
  ): Promise<number> {
    // `deletedAt` comes from the handler's single clock reading — this layer
    // never calls `new Date()`.
    const { count } = await tx.wellnessSafetyProfile.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: {
        deletedAt,
        deletedBy: userId,
        version: expectedVersion + 1,
      },
    });
    return count;
  }

  async changedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<WellnessSafetyProfileRecord[]> {
    const rows = await this.prisma.wellnessSafetyProfile.findMany({
      where: { userId, syncSeq: { gt: BigInt(sinceSeq) } },
      orderBy: { syncSeq: 'asc' },
      take: limit,
    });
    return rows.map(wellnessRowToRecord);
  }

  async resolve(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: WellnessResolution,
  ): Promise<number> {
    if (isAlreadySatisfiedDelete(resolution)) return 0;

    const { count } = await tx.wellnessSafetyProfile.updateMany({
      where: {
        id,
        userId,
        version: resolution.expectedVersion,
        deletedAt: resolution.expectedDeleted ? { not: null } : null,
      },
      data: {
        ...(resolution.operation === 'DELETE'
          ? {}
          : {
              evaluationCompleted: resolution.data.evaluationCompleted,
              evaluationDate: resolution.data.evaluationDate,
              affectedAreas: resolution.data.affectedAreas,
              movementsToAvoid: resolution.data.movementsToAvoid,
            }),
        ...(resolution.operation === 'DELETE'
          ? { deletedAt: new Date(), deletedBy: resolution.resolvedBy }
          : resolution.expectedDeleted
            ? { deletedAt: null, deletedBy: null }
            : {}),
        version: resolution.expectedVersion + 1,
      },
    });
    return count;
  }
}

function dateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}
