import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import {
  isAlreadySatisfiedDelete,
  type SyncTx,
} from '../../sync/domain/sync.types';
import {
  ProfileRepositoryPort,
  type ProfileResolution,
} from '../domain/profile.repository';
import { ProfileAttributes, ProfileRecord } from '../domain/profile.types';
import { toDomain } from './profile.mapper';

function toPrismaData(
  attributes: Partial<ProfileAttributes>,
): Prisma.UserProfileUpdateInput {
  const data: Prisma.UserProfileUpdateInput = {};
  if (attributes.birthDate !== undefined) {
    data.birthDate = attributes.birthDate
      ? new Date(`${attributes.birthDate}T00:00:00Z`)
      : null;
  }
  if (attributes.gender !== undefined) data.gender = attributes.gender;
  if (attributes.heightCm !== undefined) data.heightCm = attributes.heightCm;
  if (attributes.fitnessLevel !== undefined)
    data.fitnessLevel = attributes.fitnessLevel;
  if (attributes.yearsTraining !== undefined)
    data.yearsTraining = attributes.yearsTraining;
  if (attributes.activityLevel !== undefined)
    data.activityLevel = attributes.activityLevel;
  if (attributes.occupation !== undefined)
    data.occupation = attributes.occupation;
  if (attributes.sleepHoursBaseline !== undefined)
    data.sleepHoursBaseline = attributes.sleepHoursBaseline;
  if (attributes.stressLevelBaseline !== undefined)
    data.stressLevelBaseline = attributes.stressLevelBaseline;
  if (attributes.equipment !== undefined) data.equipment = attributes.equipment;
  if (attributes.trainingDaysPerWeek !== undefined)
    data.trainingDaysPerWeek = attributes.trainingDaysPerWeek;
  if (attributes.sessionDurationMins !== undefined)
    data.sessionDurationMins = attributes.sessionDurationMins;
  if (attributes.targetCalories !== undefined)
    data.targetCalories = attributes.targetCalories;
  if (attributes.targetProteinG !== undefined)
    data.targetProteinG = attributes.targetProteinG;
  if (attributes.targetCarbsG !== undefined)
    data.targetCarbsG = attributes.targetCarbsG;
  if (attributes.targetFatG !== undefined)
    data.targetFatG = attributes.targetFatG;
  return data;
}

@Injectable()
export class PrismaProfileRepository extends ProfileRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByUserId(userId: string): Promise<ProfileRecord | null> {
    const row = await this.prisma.userProfile.findFirst({
      where: { userId, deletedAt: null },
    });
    return row ? toDomain(row) : null;
  }

  async findOwned(userId: string, id: string): Promise<ProfileRecord | null> {
    const row = await this.prisma.userProfile.findFirst({
      where: { id, userId },
    });
    return row ? toDomain(row) : null;
  }

  async create(
    userId: string,
    attributes: Partial<ProfileAttributes>,
    id?: string,
  ): Promise<ProfileRecord> {
    const row = await this.prisma.userProfile.create({
      data: {
        ...(toPrismaData(attributes) as Prisma.UserProfileUncheckedCreateInput),
        ...(id ? { id } : {}),
        userId, // last: the authenticated owner always wins over any payload
      },
    });
    return toDomain(row);
  }

  async update(
    id: string,
    attributes: Partial<ProfileAttributes>,
    newVersion: number,
  ): Promise<ProfileRecord> {
    const row = await this.prisma.userProfile.update({
      where: { id },
      data: { ...toPrismaData(attributes), version: newVersion },
    });
    return toDomain(row);
  }

  async softDelete(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void> {
    await this.prisma.userProfile.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy, version: newVersion },
    });
  }

  async changedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<ProfileRecord[]> {
    const rows = await this.prisma.userProfile.findMany({
      where: { userId, syncSeq: { gt: BigInt(sinceSeq) } },
      orderBy: { syncSeq: 'asc' },
      take: limit,
    });
    return rows.map(toDomain);
  }

  // ── Sync path — ADR-P030 C-2 ──────────────────────────────────────────────
  // Separate from the REST methods above, which keep their current semantics:
  // `upsertMyProfile` has no expected version to assert and must not acquire
  // one.

  async findOwnedForSync(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<ProfileRecord | null> {
    const row = await tx.userProfile.findFirst({ where: { id, userId } });
    return row ? toDomain(row) : null;
  }

  /**
   * Static, entity-owned insert with `ON CONFLICT (id) DO NOTHING`, so an id
   * collision reports `0` without raising and leaves the transaction usable.
   *
   * The handler merges `PROFILE_DEFAULTS` before calling, so `attributes` is a
   * **complete** `ProfileAttributes` and no default has to be re-derived here.
   * Database-owned columns (`created_at`, `version`, `sync_seq`) are omitted so
   * their defaults and the `assign_sync_seq()` trigger still apply;
   * `updated_at` is `NOT NULL` with no database default and is written
   * explicitly, exactly as Prisma's `@updatedAt` does.
   */
  async createForSync(
    tx: SyncTx,
    userId: string,
    id: string,
    attributes: ProfileAttributes,
  ): Promise<number> {
    return tx.$executeRaw`
      INSERT INTO user_profiles (
        id, user_id, birth_date, gender, height_cm, fitness_level,
        years_training, activity_level, occupation, sleep_hours_baseline,
        stress_level_baseline, equipment, training_days_per_week,
        session_duration_mins, target_calories, target_protein_g,
        target_carbs_g, target_fat_g, updated_at
      )
      VALUES (
        ${id}::uuid,
        ${userId}::uuid,
        ${attributes.birthDate}::date,
        ${attributes.gender}::"Gender",
        ${attributes.heightCm},
        ${attributes.fitnessLevel}::"FitnessLevel",
        ${attributes.yearsTraining},
        ${attributes.activityLevel}::"ActivityLevel",
        ${attributes.occupation},
        ${attributes.sleepHoursBaseline},
        ${attributes.stressLevelBaseline},
        ${JSON.stringify(attributes.equipment)}::jsonb,
        ${attributes.trainingDaysPerWeek},
        ${attributes.sessionDurationMins},
        ${attributes.targetCalories},
        ${attributes.targetProteinG},
        ${attributes.targetCarbsG},
        ${attributes.targetFatG},
        ${new Date()}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  async updateForSync(
    tx: SyncTx,
    userId: string,
    id: string,
    attributes: Partial<ProfileAttributes>,
    expectedVersion: number,
  ): Promise<number> {
    // Key-presence driven: an omitted attribute stays untouched, so a patch is
    // never widened into a replace (A-15(d)).
    const { count } = await tx.userProfile.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: {
        ...(toPrismaData(
          attributes,
        ) as Prisma.UserProfileUpdateManyMutationInput),
        version: expectedVersion + 1,
      },
    });
    return count;
  }

  async softDeleteForSync(
    tx: SyncTx,
    userId: string,
    id: string,
    deletedBy: string,
    expectedVersion: number,
  ): Promise<number> {
    const { count } = await tx.userProfile.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: {
        deletedAt: new Date(),
        deletedBy,
        version: expectedVersion + 1,
      },
    });
    return count;
  }

  async resolveForSync(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: ProfileResolution,
  ): Promise<number> {
    if (isAlreadySatisfiedDelete(resolution)) return 0;

    const fields: Prisma.UserProfileUpdateManyMutationInput =
      resolution.operation === 'DELETE'
        ? { deletedAt: new Date(), deletedBy: resolution.resolvedBy }
        : {
            ...(toPrismaData(
              resolution.attributes,
            ) as Prisma.UserProfileUpdateManyMutationInput),
            ...(resolution.expectedDeleted
              ? { deletedAt: null, deletedBy: null }
              : {}),
          };

    const { count } = await tx.userProfile.updateMany({
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
