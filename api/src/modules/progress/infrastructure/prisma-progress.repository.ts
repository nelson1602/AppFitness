import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import {
  isAlreadySatisfiedDelete,
  type SyncTx,
} from '../../sync/domain/sync.types';
import type {
  BodyMeasurementCreateInput,
  BodyMeasurementUpdateInput,
  BodyWeightCreateInput,
  BodyWeightUpdateInput,
  ProgressSnapshotCreateInput,
  ProgressSnapshotUpdateInput,
} from '../domain/progress-payload';
import {
  ProgressRepositoryPort,
  type ProgressResolution,
} from '../domain/progress.repository';
import type {
  BodyMeasurementRecord,
  BodyWeightRecord,
  ProgressSnapshotRecord,
} from '../domain/progress.types';
import {
  bodyMeasurementRowToRecord,
  bodyWeightRowToRecord,
  progressSnapshotRowToRecord,
} from './progress.mapper';

/**
 * Persistence for the Progress Monitoring write entities (ADR-P016 Slice 3a),
 * on the ADR-P030 C-2 transaction-aware contract.
 *
 * ── Why the CREATEs are raw ────────────────────────────────────────────────
 * `CREATE` must be able to report "the row already exists" **without raising**,
 * because on PostgreSQL any error inside a transaction aborts it and the caller
 * still has to re-read the row and write a `SyncConflict` on that same
 * transaction. `ON CONFLICT (id) DO NOTHING` gives an affected count of `0`
 * with the transaction intact.
 *
 * Each statement is **static, entity-owned, tagged-template SQL**: every value
 * is a driver parameter, no identifier is dynamic, and no fragment is spliced.
 * `createMany({ skipDuplicates })` is deliberately not used — it swallows every
 * unique violation, which would reclassify a business-constraint failure
 * (`UNIQUE(user_id, date)`) as an insertion race.
 *
 * The column list reproduces exactly what Prisma's `create` writes: every
 * application-supplied field, **including `updated_at`**, which is `NOT NULL`
 * with no database default and is supplied by Prisma's `@updatedAt` in
 * application code. Database-owned columns are omitted so their defaults and
 * triggers still apply — `created_at DEFAULT CURRENT_TIMESTAMP`,
 * `version DEFAULT 1`, and `sync_seq`, which the `BEFORE INSERT OR UPDATE`
 * trigger `assign_sync_seq()` assigns from `nextval('sync_seq_global')`, so
 * incremental-pull ordering is identical for raw and Prisma inserts.
 *
 * Date-only columns are passed as a `YYYY-MM-DD` string cast to `::date`, which
 * is what Prisma sends for `@db.Date`, so no session timezone can shift the
 * calendar day.
 */
@Injectable()
export class PrismaProgressRepository extends ProgressRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // ── body_weights ──────────────────────────────────────────────────────────
  async findOwnedBodyWeight(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<BodyWeightRecord | null> {
    const r = await tx.bodyWeight.findFirst({ where: { id, userId } });
    return r ? bodyWeightRowToRecord(r) : null;
  }

  async createBodyWeight(
    tx: SyncTx,
    userId: string,
    id: string,
    data: BodyWeightCreateInput,
  ): Promise<number> {
    // user_id is set server-side from the authenticated user, never trusted
    // from the payload. A duplicate (user_id, date) violates the DB unique
    // constraint and still THROWS — it is a business-rule violation, not an
    // insertion race, and must not become a conflict (ADR-P030 §Decision 3).
    return tx.$executeRaw`
      INSERT INTO body_weights (id, user_id, weight_kg, date, notes, updated_at)
      VALUES (
        ${id}::uuid,
        ${userId}::uuid,
        ${data.weightKg},
        ${dateOnly(data.date)}::date,
        ${data.notes},
        ${new Date()}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  async updateBodyWeight(
    tx: SyncTx,
    userId: string,
    id: string,
    data: BodyWeightUpdateInput,
    expectedVersion: number,
  ): Promise<number> {
    const { count } = await tx.bodyWeight.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: {
        weightKg: data.weightKg,
        date: data.date,
        notes: data.notes,
        version: expectedVersion + 1,
      },
    });
    return count;
  }

  async softDeleteBodyWeight(
    tx: SyncTx,
    userId: string,
    id: string,
    deletedBy: string,
    expectedVersion: number,
  ): Promise<number> {
    const { count } = await tx.bodyWeight.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: {
        deletedAt: new Date(),
        deletedBy,
        version: expectedVersion + 1,
      },
    });
    return count;
  }

  async bodyWeightsChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<BodyWeightRecord[]> {
    const rows = await this.prisma.bodyWeight.findMany({
      where: { userId, syncSeq: { gt: BigInt(sinceSeq) } },
      orderBy: { syncSeq: 'asc' },
      take: limit,
    });
    return rows.map(bodyWeightRowToRecord);
  }

  async resolveBodyWeight(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: ProgressResolution<
      BodyWeightCreateInput,
      BodyWeightUpdateInput
    >,
  ): Promise<number> {
    if (isAlreadySatisfiedDelete(resolution)) return 0;

    const { count } = await tx.bodyWeight.updateMany({
      where: whereReviewed(id, userId, resolution),
      data: {
        ...resolutionFields(resolution, (data) => ({
          weightKg: data.weightKg,
          date: data.date,
          notes: data.notes,
        })),
        ...tombstoneFields(resolution, userId),
        version: resolution.expectedVersion + 1,
      },
    });
    return count;
  }

  // ── body_measurements ───────────────────────────────────────────────────────
  async findOwnedBodyMeasurement(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<BodyMeasurementRecord | null> {
    const r = await tx.bodyMeasurement.findFirst({ where: { id, userId } });
    return r ? bodyMeasurementRowToRecord(r) : null;
  }

  async createBodyMeasurement(
    tx: SyncTx,
    userId: string,
    id: string,
    data: BodyMeasurementCreateInput,
  ): Promise<number> {
    return tx.$executeRaw`
      INSERT INTO body_measurements (
        id, user_id, date, body_fat_pct, muscle_mass_kg, waist_cm, hip_cm,
        chest_cm, left_arm_cm, right_arm_cm, neck_cm, notes, updated_at
      )
      VALUES (
        ${id}::uuid,
        ${userId}::uuid,
        ${dateOnly(data.date)}::date,
        ${data.bodyFatPct},
        ${data.muscleMassKg ?? null},
        ${data.waistCm},
        ${data.hipCm},
        ${data.chestCm},
        ${data.leftArmCm},
        ${data.rightArmCm},
        ${data.neckCm},
        ${data.notes},
        ${new Date()}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  async updateBodyMeasurement(
    tx: SyncTx,
    userId: string,
    id: string,
    data: BodyMeasurementUpdateInput,
    expectedVersion: number,
  ): Promise<number> {
    const { count } = await tx.bodyMeasurement.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: {
        date: data.date,
        bodyFatPct: data.bodyFatPct,
        // Key-presence driven: an absent muscleMassKg is left untouched, so the
        // patch is not widened into a replace (A-15(d)).
        ...(data.muscleMassKg !== undefined
          ? { muscleMassKg: data.muscleMassKg }
          : {}),
        waistCm: data.waistCm,
        hipCm: data.hipCm,
        chestCm: data.chestCm,
        leftArmCm: data.leftArmCm,
        rightArmCm: data.rightArmCm,
        neckCm: data.neckCm,
        notes: data.notes,
        version: expectedVersion + 1,
      },
    });
    return count;
  }

  async softDeleteBodyMeasurement(
    tx: SyncTx,
    userId: string,
    id: string,
    deletedBy: string,
    expectedVersion: number,
  ): Promise<number> {
    const { count } = await tx.bodyMeasurement.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: {
        deletedAt: new Date(),
        deletedBy,
        version: expectedVersion + 1,
      },
    });
    return count;
  }

  async bodyMeasurementsChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<BodyMeasurementRecord[]> {
    const rows = await this.prisma.bodyMeasurement.findMany({
      where: { userId, syncSeq: { gt: BigInt(sinceSeq) } },
      orderBy: { syncSeq: 'asc' },
      take: limit,
    });
    return rows.map(bodyMeasurementRowToRecord);
  }

  async resolveBodyMeasurement(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: ProgressResolution<
      BodyMeasurementCreateInput,
      BodyMeasurementUpdateInput
    >,
  ): Promise<number> {
    if (isAlreadySatisfiedDelete(resolution)) return 0;

    const { count } = await tx.bodyMeasurement.updateMany({
      where: whereReviewed(id, userId, resolution),
      data: {
        ...resolutionFields(resolution, (data) => ({
          date: data.date,
          bodyFatPct: data.bodyFatPct,
          ...(data.muscleMassKg !== undefined
            ? { muscleMassKg: data.muscleMassKg }
            : {}),
          waistCm: data.waistCm,
          hipCm: data.hipCm,
          chestCm: data.chestCm,
          leftArmCm: data.leftArmCm,
          rightArmCm: data.rightArmCm,
          neckCm: data.neckCm,
          notes: data.notes,
        })),
        ...tombstoneFields(resolution, userId),
        version: resolution.expectedVersion + 1,
      },
    });
    return count;
  }

  // ── progress_snapshots (Slice 4b) ─────────────────────────────────────────
  async findOwnedProgressSnapshot(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<ProgressSnapshotRecord | null> {
    const r = await tx.progressSnapshot.findFirst({ where: { id, userId } });
    return r ? progressSnapshotRowToRecord(r) : null;
  }

  async createProgressSnapshot(
    tx: SyncTx,
    userId: string,
    id: string,
    data: ProgressSnapshotCreateInput,
  ): Promise<number> {
    // The backend stores the client-computed values verbatim — it never
    // recomputes (ADR-P016 D2). A duplicate
    // (user_id, week_start, rule_version) is a business constraint and still
    // throws.
    return tx.$executeRaw`
      INSERT INTO progress_snapshots (
        id, user_id, week_start, avg_weight_kg, total_volume_kg, avg_calories,
        workout_count, is_deload_week, rule_version, updated_at
      )
      VALUES (
        ${id}::uuid,
        ${userId}::uuid,
        ${dateOnly(data.weekStart)}::date,
        ${data.avgWeightKg},
        ${data.totalVolumeKg},
        ${data.avgCalories},
        ${data.workoutCount},
        ${data.isDeloadWeek},
        ${data.ruleVersion},
        ${new Date()}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  async updateProgressSnapshot(
    tx: SyncTx,
    userId: string,
    id: string,
    data: ProgressSnapshotUpdateInput,
    expectedVersion: number,
  ): Promise<number> {
    const { count } = await tx.progressSnapshot.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: {
        weekStart: data.weekStart,
        avgWeightKg: data.avgWeightKg,
        totalVolumeKg: data.totalVolumeKg,
        avgCalories: data.avgCalories,
        workoutCount: data.workoutCount,
        isDeloadWeek: data.isDeloadWeek,
        ruleVersion: data.ruleVersion,
        version: expectedVersion + 1,
      },
    });
    return count;
  }

  async softDeleteProgressSnapshot(
    tx: SyncTx,
    userId: string,
    id: string,
    deletedBy: string,
    expectedVersion: number,
  ): Promise<number> {
    const { count } = await tx.progressSnapshot.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: {
        deletedAt: new Date(),
        deletedBy,
        version: expectedVersion + 1,
      },
    });
    return count;
  }

  async progressSnapshotsChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<ProgressSnapshotRecord[]> {
    const rows = await this.prisma.progressSnapshot.findMany({
      where: { userId, syncSeq: { gt: BigInt(sinceSeq) } },
      orderBy: { syncSeq: 'asc' },
      take: limit,
    });
    return rows.map(progressSnapshotRowToRecord);
  }

  async resolveProgressSnapshot(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: ProgressResolution<
      ProgressSnapshotCreateInput,
      ProgressSnapshotUpdateInput
    >,
  ): Promise<number> {
    if (isAlreadySatisfiedDelete(resolution)) return 0;

    const { count } = await tx.progressSnapshot.updateMany({
      where: whereReviewed(id, userId, resolution),
      data: {
        ...resolutionFields(resolution, (data) => ({
          weekStart: data.weekStart,
          avgWeightKg: data.avgWeightKg,
          totalVolumeKg: data.totalVolumeKg,
          avgCalories: data.avgCalories,
          workoutCount: data.workoutCount,
          isDeloadWeek: data.isDeloadWeek,
          ruleVersion: data.ruleVersion,
        })),
        ...tombstoneFields(resolution, userId),
        version: resolution.expectedVersion + 1,
      },
    });
    return count;
  }
}

/** `@db.Date` is sent as a calendar string, never a UTC instant (ADR-P016 D6). */
function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * The predicate every resolution mutation carries: owner, expected version and
 * the **state-specific** tombstone clause selected by what the user reviewed
 * (ADR-P030 §Decision 3).
 *
 * A universal `deleted_at IS NULL` would match zero rows forever against a
 * reviewed tombstone — the resolve would report stale, the re-read would return
 * the same tombstone at the same version, and the user would loop.
 */
function whereReviewed(
  id: string,
  userId: string,
  resolution: { expectedVersion: number; expectedDeleted: boolean },
): Prisma.BodyWeightWhereInput &
  Prisma.BodyMeasurementWhereInput &
  Prisma.ProgressSnapshotWhereInput {
  return {
    id,
    userId,
    version: resolution.expectedVersion,
    deletedAt: resolution.expectedDeleted ? { not: null } : null,
  };
}

/** `DELETE` writes no entity fields; its retained payload is empty by design. */
function resolutionFields<TCreate, TUpdate, TData>(
  resolution: ProgressResolution<TCreate, TUpdate>,
  project: (data: TCreate & TUpdate) => TData,
): TData | Record<string, never> {
  if (resolution.operation === 'DELETE') return {};
  return project(resolution.data as TCreate & TUpdate);
}

/**
 * `CLIENT_WINS` over a reviewed tombstone is an **explicit restore**: the
 * predicate matched a deleted row, so the resolution clears the tombstone as
 * well as applying the fields. `DELETE` sets one instead.
 */
function tombstoneFields(
  resolution: { operation: string; expectedDeleted: boolean },
  userId: string,
): { deletedAt?: Date | null; deletedBy?: string | null } {
  if (resolution.operation === 'DELETE') {
    return { deletedAt: new Date(), deletedBy: userId };
  }
  return resolution.expectedDeleted ? { deletedAt: null, deletedBy: null } : {};
}
