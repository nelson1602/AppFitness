import * as crypto from 'node:crypto';

import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/modules/database/prisma.service';
import { DietaryPreferenceRepositoryPort } from './../src/modules/nutrition/domain/dietary-preference.repository';
import { MealItemRepositoryPort } from './../src/modules/nutrition/domain/meal-item.repository';
import { ProgressRepositoryPort } from './../src/modules/progress/domain/progress.repository';
import { GoalRepositoryPort } from './../src/modules/users/domain/goal.repository';
import { ProfileRepositoryPort } from './../src/modules/users/domain/profile.repository';
import { PROFILE_DEFAULTS } from './../src/modules/users/domain/profile.types';
import { WellnessRepositoryPort } from './../src/modules/wellness/domain/wellness.repository';
import { WorkoutRepositoryPort } from './../src/modules/workout/domain/workout.repository';

/**
 * ADR-P030 **C-2**, regression 7 — the raw `CREATE` and Prisma's `create` must
 * produce **field-equivalent** rows.
 *
 * `CREATE` had to move to `tx.$executeRaw ... ON CONFLICT (id) DO NOTHING` so an
 * id collision reports `STALE` **without raising**, leaving the transaction
 * usable for the re-read and the conflict row. Raw SQL means a hand-written
 * column list, and a hand-written column list can drift from the Prisma model.
 * This suite is the guard: for every entity it inserts one row through the
 * repository's raw statement and one through Prisma's own `create` with the same
 * input, then compares **every column**.
 *
 * Three things it specifically proves, because each is a way the raw path can
 * silently differ:
 *
 * - **`updated_at`** is `NOT NULL` with **no database default** — Prisma fills it
 *   from `@updatedAt` in application code, so a raw insert that omitted it would
 *   fail or drift. Both rows must carry it.
 * - **Database-owned defaults** (`created_at`, `version`) must still apply, which
 *   only happens if the raw statement omits those columns.
 * - **`sync_seq`** is assigned by the `assign_sync_seq()` BEFORE INSERT trigger
 *   from `nextval('sync_seq_global')`. Both rows must receive a non-zero,
 *   strictly increasing value, or incremental-pull ordering breaks.
 *
 * Requires a live PostgreSQL (the disposable container / the api-ci e2e job).
 */

/** Columns whose values are expected to differ between two distinct rows. */
const IDENTITY_COLUMNS = ['id'] as const;
/** Columns that are time- or sequence-valued: compared structurally, not by value. */
const GENERATED_COLUMNS = [
  'createdAt',
  'updatedAt',
  'syncSeq',
  'date',
  'weekStart',
] as const;

function comparableColumns(
  row: Record<string, unknown>,
  alsoExcluded: readonly string[] = [],
): string[] {
  return Object.keys(row).filter(
    (k) =>
      !(IDENTITY_COLUMNS as readonly string[]).includes(k) &&
      !(GENERATED_COLUMNS as readonly string[]).includes(k) &&
      !alsoExcluded.includes(k),
  );
}

/** Compares every non-generated column of the two rows, naming the mismatch. */
function expectColumnsEqual(
  raw: Record<string, unknown>,
  viaPrisma: Record<string, unknown>,
  alsoExcluded: readonly string[] = [],
): void {
  // Same column set — a missing or extra column in the raw statement fails here.
  expect(Object.keys(raw).sort()).toEqual(Object.keys(viaPrisma).sort());
  for (const column of comparableColumns(raw, alsoExcluded)) {
    expect({ column, value: raw[column] }).toEqual({
      column,
      value: viaPrisma[column],
    });
  }
}

describe('ADR-P030 C-2 — raw CREATE vs Prisma create field equivalence', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let repo: ProgressRepositoryPort;
  let profiles: ProfileRepositoryPort;
  let goals: GoalRepositoryPort;
  let preferences: DietaryPreferenceRepositoryPort;
  let mealItems: MealItemRepositoryPort;
  let wellness: WellnessRepositoryPort;
  let workout: WorkoutRepositoryPort;
  let userId: string;
  /**
   * `user_profiles.user_id` is UNIQUE, so the raw row and the Prisma row cannot
   * share an owner — the second user exists only to hold the Prisma-side
   * profile for that one comparison.
   */
  let otherUserId: string;

  async function createUser(): Promise<string> {
    const id = crypto.randomUUID();
    await prisma.user.create({
      data: {
        id,
        email: `c2-equiv-${id}@example.test`,
        username: `c2equiv${id.slice(0, 8)}`,
        passwordHash: 'x'.repeat(60),
      },
    });
    return id;
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    repo = moduleRef.get(ProgressRepositoryPort);
    profiles = moduleRef.get(ProfileRepositoryPort);
    goals = moduleRef.get(GoalRepositoryPort);
    preferences = moduleRef.get(DietaryPreferenceRepositoryPort);
    mealItems = moduleRef.get(MealItemRepositoryPort);
    wellness = moduleRef.get(WellnessRepositoryPort);
    workout = moduleRef.get(WorkoutRepositoryPort);

    userId = await createUser();
    otherUserId = await createUser();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [userId, otherUserId] } },
    });
    await prisma.exercise.deleteMany({
      where: { createdBy: { in: [userId, otherUserId] } },
    });
    await moduleRef.close();
  });

  describe('workout entities', () => {
    let exerciseId: string;
    let routineId: string;
    let otherRoutineId: string;
    let workoutLogId: string;

    beforeAll(async () => {
      exerciseId = crypto.randomUUID();
      await prisma.exercise.create({
        data: {
          id: exerciseId,
          createdBy: userId,
          name: `C2 dependency ${exerciseId.slice(0, 8)}`,
          muscleGroup: 'legs',
          category: 'STRENGTH',
        },
      });
      routineId = crypto.randomUUID();
      otherRoutineId = crypto.randomUUID();
      await prisma.routine.createMany({
        data: [
          { id: routineId, userId, name: 'C2 routine A' },
          { id: otherRoutineId, userId, name: 'C2 routine B' },
        ],
      });
      workoutLogId = crypto.randomUUID();
      await prisma.workoutLog.create({
        data: {
          id: workoutLogId,
          userId,
          name: 'C2 dependency log',
          startedAt: new Date('2026-03-01T08:00:00.000Z'),
        },
      });
    });

    it('exercises: raw and Prisma creates are field-equivalent', async () => {
      const rawId = crypto.randomUUID();
      const prismaId = crypto.randomUUID();
      const input = {
        name: `C2 raw exercise ${rawId.slice(0, 8)}`,
        muscleGroup: 'chest',
        category: 'STRENGTH' as const,
        instructions: 'Controlled tempo',
      };
      expect(
        await prisma.$transaction((tx) =>
          workout.createExercise(tx, userId, rawId, input),
        ),
      ).toBe(1);
      await prisma.exercise.create({
        data: {
          id: prismaId,
          createdBy: otherUserId,
          ...input,
        },
      });
      const raw = await prisma.exercise.findUniqueOrThrow({
        where: { id: rawId },
      });
      const viaPrisma = await prisma.exercise.findUniqueOrThrow({
        where: { id: prismaId },
      });
      expectColumnsEqual(raw, viaPrisma, ['createdBy']);
      expect(raw.version).toBe(1);
      expect(raw.syncSeq).toBeGreaterThan(0n);
      expect(viaPrisma.syncSeq).toBeGreaterThan(raw.syncSeq);
    });

    it('routines: raw and Prisma creates are field-equivalent', async () => {
      const rawId = crypto.randomUUID();
      const prismaId = crypto.randomUUID();
      const input = { name: 'C2 equivalent routine', description: 'Probe' };
      expect(
        await prisma.$transaction((tx) =>
          workout.createRoutine(tx, userId, rawId, input),
        ),
      ).toBe(1);
      await prisma.routine.create({ data: { id: prismaId, userId, ...input } });
      const raw = await prisma.routine.findUniqueOrThrow({
        where: { id: rawId },
      });
      const viaPrisma = await prisma.routine.findUniqueOrThrow({
        where: { id: prismaId },
      });
      expectColumnsEqual(raw, viaPrisma);
    });

    it('routine_exercises: raw and Prisma creates are field-equivalent', async () => {
      const rawId = crypto.randomUUID();
      const prismaId = crypto.randomUUID();
      const input = {
        routineId,
        exerciseId,
        order: 4,
        targetSets: 3,
        targetReps: 8,
        targetWeightKg: 72.5,
      };
      expect(
        await prisma.$transaction((tx) =>
          workout.createRoutineExercise(tx, userId, rawId, input),
        ),
      ).toBe(1);
      await prisma.routineExercise.create({
        data: { id: prismaId, userId, ...input, routineId: otherRoutineId },
      });
      const raw = await prisma.routineExercise.findUniqueOrThrow({
        where: { id: rawId },
      });
      const viaPrisma = await prisma.routineExercise.findUniqueOrThrow({
        where: { id: prismaId },
      });
      expectColumnsEqual(raw, viaPrisma, ['routineId']);
    });

    it('workout_logs: nullable UUIDs and timestamps match Prisma', async () => {
      const rawId = crypto.randomUUID();
      const prismaId = crypto.randomUUID();
      const input = {
        routineId: null,
        name: 'C2 equivalent workout',
        notes: null,
        startedAt: new Date('2026-04-02T10:00:00.000Z'),
        finishedAt: new Date('2026-04-02T11:00:00.000Z'),
      };
      expect(
        await prisma.$transaction((tx) =>
          workout.createWorkoutLog(tx, userId, rawId, input),
        ),
      ).toBe(1);
      await prisma.workoutLog.create({
        data: { id: prismaId, userId, ...input },
      });
      const raw = await prisma.workoutLog.findUniqueOrThrow({
        where: { id: rawId },
      });
      const viaPrisma = await prisma.workoutLog.findUniqueOrThrow({
        where: { id: prismaId },
      });
      expectColumnsEqual(raw, viaPrisma);
    });

    it('workout_sets: raw and Prisma creates are field-equivalent', async () => {
      const rawId = crypto.randomUUID();
      const prismaId = crypto.randomUUID();
      const input = {
        workoutLogId,
        exerciseId,
        setNumber: 2,
        reps: 10,
        weightKg: 55.5,
        rpe: 7.5,
        completed: true,
        notes: 'C2 set',
      };
      expect(
        await prisma.$transaction((tx) =>
          workout.createWorkoutSet(tx, userId, rawId, input),
        ),
      ).toBe(1);
      await prisma.workoutSet.create({
        data: { id: prismaId, userId, ...input },
      });
      const raw = await prisma.workoutSet.findUniqueOrThrow({
        where: { id: rawId },
      });
      const viaPrisma = await prisma.workoutSet.findUniqueOrThrow({
        where: { id: prismaId },
      });
      expectColumnsEqual(raw, viaPrisma);
    });

    it('keeps PK collision distinct from a business-unique collision', async () => {
      const id = crypto.randomUUID();
      const name = `C2 collision ${id.slice(0, 8)}`;
      expect(
        await prisma.$transaction((tx) =>
          workout.createExercise(tx, userId, id, {
            name,
            muscleGroup: 'legs',
            category: 'STRENGTH',
            instructions: null,
          }),
        ),
      ).toBe(1);
      await expect(
        prisma.$transaction((tx) =>
          workout.createExercise(tx, userId, crypto.randomUUID(), {
            name,
            muscleGroup: 'legs',
            category: 'STRENGTH',
            instructions: null,
          }),
        ),
      ).rejects.toThrow();
      await expect(
        prisma.$transaction((tx) =>
          workout.createExercise(tx, userId, id, {
            name: 'losing value',
            muscleGroup: 'arms',
            category: 'STRENGTH',
            instructions: null,
          }),
        ),
      ).resolves.toBe(0);
    });
  });

  describe('wellness_safety_profiles', () => {
    it('writes the same fields, arrays, date and generated values as Prisma', async () => {
      const input = {
        evaluationCompleted: true,
        evaluationDate: new Date('2026-02-03T00:00:00.000Z'),
        affectedAreas: ['knee', 'shoulder'],
        movementsToAvoid: ['jumping'],
      };
      expect(
        await prisma.$transaction((tx) =>
          wellness.create(tx, userId, userId, input),
        ),
      ).toBe(1);
      await prisma.wellnessSafetyProfile.create({
        data: { id: otherUserId, userId: otherUserId, ...input },
      });
      const raw = await prisma.wellnessSafetyProfile.findUniqueOrThrow({
        where: { id: userId },
      });
      const viaPrisma = await prisma.wellnessSafetyProfile.findUniqueOrThrow({
        where: { id: otherUserId },
      });
      expectColumnsEqual(raw, viaPrisma, ['userId']);
      expect(raw.evaluationDate?.toISOString().slice(0, 10)).toBe('2026-02-03');
      expect(raw.version).toBe(1);
      expect(raw.syncSeq).toBeGreaterThan(0n);
      expect(viaPrisma.syncSeq).toBeGreaterThan(raw.syncSeq);
    });
  });

  describe('body_weights', () => {
    it('writes the same columns, defaults and trigger values as Prisma', async () => {
      const rawId = crypto.randomUUID();
      const prismaId = crypto.randomUUID();
      const input = {
        weightKg: 81.5,
        notes: 'equivalence probe',
      };

      const affected = await prisma.$transaction((tx) =>
        repo.createBodyWeight(tx, userId, rawId, {
          ...input,
          date: new Date('2026-03-01T00:00:00.000Z'),
        }),
      );
      expect(affected).toBe(1);

      await prisma.bodyWeight.create({
        data: {
          id: prismaId,
          userId,
          weightKg: input.weightKg,
          date: new Date('2026-03-02T00:00:00.000Z'),
          notes: input.notes,
        },
      });

      const raw = await prisma.bodyWeight.findUniqueOrThrow({
        where: { id: rawId },
      });
      const viaPrisma = await prisma.bodyWeight.findUniqueOrThrow({
        where: { id: prismaId },
      });

      // Same column set — a missing or extra column in the raw statement fails here.
      expect(Object.keys(raw).sort()).toEqual(Object.keys(viaPrisma).sort());

      for (const column of comparableColumns(raw)) {
        expect({ column, value: raw[column as keyof typeof raw] }).toEqual({
          column,
          value: viaPrisma[column as keyof typeof viaPrisma],
        });
      }

      // Database-owned defaults applied to BOTH, which only happens because the
      // raw statement omits them.
      expect(raw.version).toBe(1);
      expect(viaPrisma.version).toBe(1);
      expect(raw.createdAt).toBeInstanceOf(Date);

      // `updated_at` is NOT NULL with no database default: the raw statement
      // must supply it explicitly, exactly as Prisma's @updatedAt does.
      expect(raw.updatedAt).toBeInstanceOf(Date);
      expect(Number.isNaN(raw.updatedAt.getTime())).toBe(false);

      // The date-only column keeps the calendar day it was given, with no
      // session-timezone shift.
      expect(raw.date.toISOString().slice(0, 10)).toBe('2026-03-01');

      // `sync_seq` comes from the trigger, never from application code, and is
      // strictly increasing — so incremental pull ordering is unaffected.
      expect(raw.syncSeq).toBeGreaterThan(0n);
      expect(viaPrisma.syncSeq).toBeGreaterThan(raw.syncSeq);
    });

    it('reports 0 for a primary-key collision without raising', async () => {
      const id = crypto.randomUUID();
      const first = await prisma.$transaction((tx) =>
        repo.createBodyWeight(tx, userId, id, {
          date: new Date('2026-04-01T00:00:00.000Z'),
          weightKg: 80,
          notes: null,
        }),
      );
      expect(first).toBe(1);

      // Same id, different business key: only the PK collides.
      const second = await prisma.$transaction((tx) =>
        repo.createBodyWeight(tx, userId, id, {
          date: new Date('2026-04-02T00:00:00.000Z'),
          weightKg: 90,
          notes: null,
        }),
      );
      expect(second).toBe(0);

      // The losing insert changed nothing.
      const row = await prisma.bodyWeight.findUniqueOrThrow({ where: { id } });
      expect(row.weightKg).toBe(80);
    });

    it('still THROWS on a business unique violation, which is not a conflict', async () => {
      const date = new Date('2026-05-01T00:00:00.000Z');
      await prisma.$transaction((tx) =>
        repo.createBodyWeight(tx, userId, crypto.randomUUID(), {
          date,
          weightKg: 70,
          notes: null,
        }),
      );

      // A different id on the same (user_id, date) is a business-rule
      // violation, not an insertion race: `ON CONFLICT (id)` does not cover it,
      // so it must still raise and roll the transaction back.
      await expect(
        prisma.$transaction((tx) =>
          repo.createBodyWeight(tx, userId, crypto.randomUUID(), {
            date,
            weightKg: 71,
            notes: null,
          }),
        ),
      ).rejects.toThrow();
    });

    it('does not rewrite or version-bump an already-deleted row', async () => {
      const id = crypto.randomUUID();
      const deletedAt = new Date('2026-05-02T12:00:00.000Z');
      await prisma.bodyWeight.create({
        data: {
          id,
          userId,
          date: new Date('2026-05-02T00:00:00.000Z'),
          weightKg: 72,
          version: 7,
          deletedAt,
          deletedBy: userId,
        },
      });

      const affected = await prisma.$transaction((tx) =>
        repo.resolveBodyWeight(tx, userId, id, {
          operation: 'DELETE',
          expectedVersion: 7,
          expectedDeleted: true,
          resolvedBy: userId,
        }),
      );
      expect(affected).toBe(0);

      const row = await prisma.bodyWeight.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({
        version: 7,
        deletedAt,
        deletedBy: userId,
        weightKg: 72,
      });
    });
  });

  describe('body_measurements', () => {
    it('writes the same columns, defaults and trigger values as Prisma', async () => {
      const rawId = crypto.randomUUID();
      const prismaId = crypto.randomUUID();
      const shared = {
        bodyFatPct: 18.5,
        muscleMassKg: 35.25,
        waistCm: 82,
        hipCm: 96,
        chestCm: 101,
        leftArmCm: 34,
        rightArmCm: 34.5,
        neckCm: 38,
        notes: 'equivalence probe',
      };

      const affected = await prisma.$transaction((tx) =>
        repo.createBodyMeasurement(tx, userId, rawId, {
          ...shared,
          date: new Date('2026-03-01T00:00:00.000Z'),
        }),
      );
      expect(affected).toBe(1);

      await prisma.bodyMeasurement.create({
        data: {
          id: prismaId,
          userId,
          date: new Date('2026-03-02T00:00:00.000Z'),
          ...shared,
        },
      });

      const raw = await prisma.bodyMeasurement.findUniqueOrThrow({
        where: { id: rawId },
      });
      const viaPrisma = await prisma.bodyMeasurement.findUniqueOrThrow({
        where: { id: prismaId },
      });

      expect(Object.keys(raw).sort()).toEqual(Object.keys(viaPrisma).sort());
      for (const column of comparableColumns(raw)) {
        expect({ column, value: raw[column as keyof typeof raw] }).toEqual({
          column,
          value: viaPrisma[column as keyof typeof viaPrisma],
        });
      }
      expect(raw.version).toBe(1);
      expect(raw.updatedAt).toBeInstanceOf(Date);
      expect(raw.date.toISOString().slice(0, 10)).toBe('2026-03-01');
      expect(raw.syncSeq).toBeGreaterThan(0n);
      expect(viaPrisma.syncSeq).toBeGreaterThan(raw.syncSeq);
    });

    it('omits an absent optional column rather than writing null over a default', async () => {
      // `muscleMassKg` is the one key-presence-driven field on this entity
      // (ADR-P016 / migration 20260811120000). Absent means untouched.
      const id = crypto.randomUUID();
      await prisma.$transaction((tx) =>
        repo.createBodyMeasurement(tx, userId, id, {
          date: new Date('2026-06-01T00:00:00.000Z'),
          bodyFatPct: null,
          muscleMassKg: null,
          waistCm: null,
          hipCm: null,
          chestCm: null,
          leftArmCm: null,
          rightArmCm: null,
          neckCm: null,
          notes: null,
        }),
      );
      const row = await prisma.bodyMeasurement.findUniqueOrThrow({
        where: { id },
      });
      expect(row.muscleMassKg).toBeNull();
      expect(row.version).toBe(1);
    });
  });

  describe('progress_snapshots', () => {
    it('writes the same columns, defaults and trigger values as Prisma', async () => {
      const rawId = crypto.randomUUID();
      const prismaId = crypto.randomUUID();
      const shared = {
        avgWeightKg: 80.2,
        totalVolumeKg: 12500,
        avgCalories: 2350,
        workoutCount: 4,
        isDeloadWeek: false,
        ruleVersion: 'icoach-rules@1.1.0',
      };

      const affected = await prisma.$transaction((tx) =>
        repo.createProgressSnapshot(tx, userId, rawId, {
          ...shared,
          weekStart: new Date('2026-03-02T00:00:00.000Z'),
        }),
      );
      expect(affected).toBe(1);

      await prisma.progressSnapshot.create({
        data: {
          id: prismaId,
          userId,
          weekStart: new Date('2026-03-09T00:00:00.000Z'),
          ...shared,
        },
      });

      const raw = await prisma.progressSnapshot.findUniqueOrThrow({
        where: { id: rawId },
      });
      const viaPrisma = await prisma.progressSnapshot.findUniqueOrThrow({
        where: { id: prismaId },
      });

      expect(Object.keys(raw).sort()).toEqual(Object.keys(viaPrisma).sort());
      for (const column of comparableColumns(raw)) {
        expect({ column, value: raw[column as keyof typeof raw] }).toEqual({
          column,
          value: viaPrisma[column as keyof typeof viaPrisma],
        });
      }
      expect(raw.version).toBe(1);
      expect(raw.updatedAt).toBeInstanceOf(Date);
      expect(raw.weekStart.toISOString().slice(0, 10)).toBe('2026-03-02');
      expect(raw.syncSeq).toBeGreaterThan(0n);
      expect(viaPrisma.syncSeq).toBeGreaterThan(raw.syncSeq);
    });
  });

  describe('user_profiles', () => {
    const attributes = {
      ...PROFILE_DEFAULTS,
      birthDate: '1990-01-15',
      gender: 'FEMALE' as const,
      heightCm: 168,
      fitnessLevel: 'ADVANCED' as const,
      yearsTraining: 6,
      activityLevel: 'VERY_ACTIVE' as const,
      occupation: 'nurse',
      sleepHoursBaseline: 7.5,
      stressLevelBaseline: 3,
      equipment: ['dumbbells', 'bands'],
      trainingDaysPerWeek: 5,
      sessionDurationMins: 75,
      targetCalories: 2200,
      targetProteinG: 140,
      targetCarbsG: 230,
      targetFatG: 70,
    };

    it('writes the same columns, defaults and trigger values as Prisma', async () => {
      const rawId = crypto.randomUUID();
      const prismaId = crypto.randomUUID();

      const affected = await prisma.$transaction((tx) =>
        profiles.createForSync(tx, userId, rawId, attributes),
      );
      expect(affected).toBe(1);

      await prisma.userProfile.create({
        data: {
          id: prismaId,
          userId: otherUserId, // user_id is UNIQUE on this table
          birthDate: new Date('1990-01-15T00:00:00.000Z'),
          gender: attributes.gender,
          heightCm: attributes.heightCm,
          fitnessLevel: attributes.fitnessLevel,
          yearsTraining: attributes.yearsTraining,
          activityLevel: attributes.activityLevel,
          occupation: attributes.occupation,
          sleepHoursBaseline: attributes.sleepHoursBaseline,
          stressLevelBaseline: attributes.stressLevelBaseline,
          equipment: attributes.equipment,
          trainingDaysPerWeek: attributes.trainingDaysPerWeek,
          sessionDurationMins: attributes.sessionDurationMins,
          targetCalories: attributes.targetCalories,
          targetProteinG: attributes.targetProteinG,
          targetCarbsG: attributes.targetCarbsG,
          targetFatG: attributes.targetFatG,
        },
      });

      const raw = await prisma.userProfile.findUniqueOrThrow({
        where: { id: rawId },
      });
      const viaPrisma = await prisma.userProfile.findUniqueOrThrow({
        where: { id: prismaId },
      });

      // `userId` differs only because the column is UNIQUE here.
      expectColumnsEqual(raw, viaPrisma, ['userId']);
      expect(raw.version).toBe(1);
      expect(viaPrisma.version).toBe(1);
      expect(raw.createdAt).toBeInstanceOf(Date);
      expect(raw.updatedAt).toBeInstanceOf(Date);
      expect(Number.isNaN(raw.updatedAt.getTime())).toBe(false);

      // The date-only column keeps its calendar day on both paths.
      expect(raw.birthDate?.toISOString().slice(0, 10)).toBe('1990-01-15');
      expect(viaPrisma.birthDate?.toISOString().slice(0, 10)).toBe(
        '1990-01-15',
      );

      expect(raw.syncSeq).toBeGreaterThan(0n);
      expect(viaPrisma.syncSeq).toBeGreaterThan(raw.syncSeq);
    });

    it('applies the database-owned defaults when the handler passes PROFILE_DEFAULTS', async () => {
      const id = crypto.randomUUID();
      const owner = await createUser();

      await prisma.$transaction((tx) =>
        profiles.createForSync(tx, owner, id, PROFILE_DEFAULTS),
      );

      const row = await prisma.userProfile.findUniqueOrThrow({ where: { id } });
      expect(row.birthDate).toBeNull();
      expect(row.gender).toBeNull();
      expect(row.fitnessLevel).toBe('INTERMEDIATE');
      expect(row.activityLevel).toBe('MODERATE');
      expect(row.equipment).toEqual([]);
      expect(row.trainingDaysPerWeek).toBe(3);
      expect(row.sessionDurationMins).toBe(60);
      expect(row.version).toBe(1);

      await prisma.user.deleteMany({ where: { id: owner } });
    });

    it('reports 0 for a primary-key collision without raising', async () => {
      const id = crypto.randomUUID();
      const owner = await createUser();

      const first = await prisma.$transaction((tx) =>
        profiles.createForSync(tx, owner, id, {
          ...PROFILE_DEFAULTS,
          heightCm: 170,
        }),
      );
      expect(first).toBe(1);

      const second = await prisma.$transaction((tx) =>
        profiles.createForSync(tx, owner, id, {
          ...PROFILE_DEFAULTS,
          heightCm: 190,
        }),
      );
      expect(second).toBe(0);

      const row = await prisma.userProfile.findUniqueOrThrow({ where: { id } });
      expect(row.heightCm).toBe(170); // the losing insert changed nothing

      await prisma.user.deleteMany({ where: { id: owner } });
    });

    it('still THROWS on the UNIQUE(user_id) business constraint, which is not a conflict', async () => {
      const owner = await createUser();
      await prisma.$transaction((tx) =>
        profiles.createForSync(
          tx,
          owner,
          crypto.randomUUID(),
          PROFILE_DEFAULTS,
        ),
      );

      // A different id for the same owner violates uq_user_profiles_user:
      // `ON CONFLICT (id)` does not cover it, so it must raise and roll back.
      await expect(
        prisma.$transaction((tx) =>
          profiles.createForSync(
            tx,
            owner,
            crypto.randomUUID(),
            PROFILE_DEFAULTS,
          ),
        ),
      ).rejects.toThrow();

      await prisma.user.deleteMany({ where: { id: owner } });
    });
  });

  describe('goals', () => {
    it('writes the same columns, defaults and trigger values as Prisma', async () => {
      const rawId = crypto.randomUUID();
      const prismaId = crypto.randomUUID();
      const startedAt = new Date('2026-03-01T08:00:00.000Z');

      const affected = await prisma.$transaction((tx) =>
        goals.create(tx, userId, rawId, {
          goalType: 'MUSCLE_GAIN',
          targetWeightKg: 82.5,
          targetDate: '2026-12-31',
          isActive: true,
          startedAt,
          endedAt: null,
        }),
      );
      expect(affected).toBe(1);

      await prisma.goal.create({
        data: {
          id: prismaId,
          userId,
          goalType: 'MUSCLE_GAIN',
          targetWeightKg: 82.5,
          targetDate: new Date('2026-12-31T00:00:00.000Z'),
          isActive: true,
          startedAt,
          endedAt: null,
        },
      });

      const raw = await prisma.goal.findUniqueOrThrow({ where: { id: rawId } });
      const viaPrisma = await prisma.goal.findUniqueOrThrow({
        where: { id: prismaId },
      });

      expectColumnsEqual(raw, viaPrisma);
      expect(raw.version).toBe(1);
      expect(viaPrisma.version).toBe(1);
      expect(raw.createdAt).toBeInstanceOf(Date);
      expect(raw.updatedAt).toBeInstanceOf(Date);
      expect(Number.isNaN(raw.updatedAt.getTime())).toBe(false);

      // The date-only column keeps its calendar day on both paths.
      expect(raw.targetDate?.toISOString().slice(0, 10)).toBe('2026-12-31');
      expect(viaPrisma.targetDate?.toISOString().slice(0, 10)).toBe(
        '2026-12-31',
      );

      expect(raw.syncSeq).toBeGreaterThan(0n);
      expect(viaPrisma.syncSeq).toBeGreaterThan(raw.syncSeq);
    });

    it('reproduces the application defaults for the keys a partial payload omits', async () => {
      const id = crypto.randomUUID();
      const before = new Date();

      // Only the required goal type is supplied — is_active and started_at must
      // still match what the column defaults would have produced.
      await prisma.$transaction((tx) =>
        goals.create(tx, userId, id, { goalType: 'ENDURANCE' }),
      );

      const row = await prisma.goal.findUniqueOrThrow({ where: { id } });
      expect(row.isActive).toBe(true);
      expect(row.startedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime() - 1000,
      );
      expect(row.targetWeightKg).toBeNull();
      expect(row.targetDate).toBeNull();
      expect(row.endedAt).toBeNull();
      expect(row.version).toBe(1);
    });

    it('reports 0 for a primary-key collision without raising', async () => {
      const id = crypto.randomUUID();

      const first = await prisma.$transaction((tx) =>
        goals.create(tx, userId, id, {
          goalType: 'FAT_LOSS',
          targetWeightKg: 75,
        }),
      );
      expect(first).toBe(1);

      const second = await prisma.$transaction((tx) =>
        goals.create(tx, userId, id, {
          goalType: 'STRENGTH',
          targetWeightKg: 95,
        }),
      );
      expect(second).toBe(0);

      const row = await prisma.goal.findUniqueOrThrow({ where: { id } });
      expect(row.goalType).toBe('FAT_LOSS');
      expect(row.targetWeightKg).toBe(75);
    });

    it('still THROWS on the target-weight CHECK, which is not a conflict', async () => {
      await expect(
        prisma.$transaction((tx) =>
          goals.create(tx, userId, crypto.randomUUID(), {
            goalType: 'FAT_LOSS',
            // chk_goals_target_weight: target_weight_kg IS NULL OR > 0
            targetWeightKg: 0,
          }),
        ),
      ).rejects.toThrow();
    });
  });

  describe('dietary_preferences', () => {
    it('writes the same columns, defaults and trigger values as Prisma', async () => {
      const rawId = crypto.randomUUID();
      const prismaId = crypto.randomUUID();

      // The note is compared separately: AES-256-GCM uses a fresh IV per call,
      // so two encryptions of the same plaintext are never byte-equal.
      const affected = await prisma.$transaction((tx) =>
        preferences.create(tx, userId, rawId, {
          exclusionType: 'avoid_tag',
          avoidTag: 'nut_allergy',
          catalogKey: null,
          kind: 'allergy',
          note: null,
        }),
      );
      expect(affected).toBe(1);

      await prisma.dietaryPreference.create({
        data: {
          id: prismaId,
          userId,
          exclusionType: 'avoid_tag',
          avoidTag: 'nut_allergy',
          catalogKey: null,
          kind: 'allergy',
          noteEnc: null,
          encKeyId: null,
        },
      });

      const raw = await prisma.dietaryPreference.findUniqueOrThrow({
        where: { id: rawId },
      });
      const viaPrisma = await prisma.dietaryPreference.findUniqueOrThrow({
        where: { id: prismaId },
      });

      expectColumnsEqual(raw, viaPrisma);
      expect(raw.version).toBe(1);
      expect(viaPrisma.version).toBe(1);
      expect(raw.createdAt).toBeInstanceOf(Date);
      expect(raw.updatedAt).toBeInstanceOf(Date);
      expect(Number.isNaN(raw.updatedAt.getTime())).toBe(false);
      expect(raw.syncSeq).toBeGreaterThan(0n);
      expect(viaPrisma.syncSeq).toBeGreaterThan(raw.syncSeq);
    });

    it('stores the note as ciphertext with its key id and round-trips it', async () => {
      const id = crypto.randomUUID();
      const note = 'severe — carry epipen';

      await prisma.$transaction((tx) =>
        preferences.create(tx, userId, id, {
          exclusionType: 'catalog_key',
          avoidTag: null,
          catalogKey: 'food.peanut',
          kind: 'allergy',
          note,
        }),
      );

      const row = await prisma.dietaryPreference.findUniqueOrThrow({
        where: { id },
      });
      expect(row.noteEnc).not.toBeNull();
      expect(row.encKeyId).not.toBeNull();
      // Never stored as plaintext.
      expect(Buffer.from(row.noteEnc as Uint8Array).toString()).not.toContain(
        'epipen',
      );

      const decrypted = await prisma.$transaction((tx) =>
        preferences.findOwned(tx, userId, id),
      );
      expect(decrypted?.note).toBe(note);
    });

    it('reports 0 for a primary-key collision without raising', async () => {
      const id = crypto.randomUUID();

      const first = await prisma.$transaction((tx) =>
        preferences.create(tx, userId, id, {
          exclusionType: 'avoid_tag',
          avoidTag: 'gluten',
          catalogKey: null,
          kind: 'preference',
          note: null,
        }),
      );
      expect(first).toBe(1);

      const second = await prisma.$transaction((tx) =>
        preferences.create(tx, userId, id, {
          exclusionType: 'avoid_tag',
          avoidTag: 'lactose',
          catalogKey: null,
          kind: 'allergy',
          note: null,
        }),
      );
      expect(second).toBe(0);

      const row = await prisma.dietaryPreference.findUniqueOrThrow({
        where: { id },
      });
      expect(row.avoidTag).toBe('gluten');
      expect(row.kind).toBe('preference');
    });

    it('still THROWS on the exclusion-target CHECK, which is not a conflict', async () => {
      await expect(
        prisma.$transaction((tx) =>
          preferences.create(tx, userId, crypto.randomUUID(), {
            // chk_dietary_preferences_target: exactly one target, matching type
            exclusionType: 'avoid_tag',
            avoidTag: null,
            catalogKey: 'food.peanut',
            kind: 'allergy',
            note: null,
          }),
        ),
      ).rejects.toThrow();
    });
  });

  describe('meal_items', () => {
    let mealId: string;
    let foodId: string;

    const snapshot = {
      foodNameSnapshot: 'Chicken breast, cooked',
      catalogKeySnapshot: 'food.chicken_breast',
      foodRevisionSnapshot: 1,
      catalogVersionSnapshot: 'food-catalog@1.0.0',
      servingAmountSnapshot: 100,
      servingUnitSnapshot: 'g',
      gramsPerServingSnapshot: 100,
      caloriesPerServingSnapshot: 160,
      proteinPerServingSnapshot: 31,
      carbsPerServingSnapshot: 0,
      fatPerServingSnapshot: 4,
      fiberPerServingSnapshot: null,
    };

    beforeAll(async () => {
      foodId = crypto.randomUUID();
      await prisma.food.create({
        data: {
          id: foodId,
          catalogKey: `food.c2equiv.${foodId.slice(0, 8)}`,
          foodRevision: 1,
          catalogVersion: 'food-catalog@1.0.0',
          name: 'Chicken breast, cooked',
          servingAmount: 100,
          servingUnit: 'g',
          gramsPerServing: 100,
          caloriesPerServing: 160,
          proteinPerServing: 31,
          carbsPerServing: 0,
          fatPerServing: 4,
          fiberPerServing: null,
        },
      });

      const logId = crypto.randomUUID();
      await prisma.nutritionLog.create({
        data: { id: logId, userId, date: new Date('2026-03-01T00:00:00.000Z') },
      });
      mealId = crypto.randomUUID();
      await prisma.meal.create({
        data: { id: mealId, userId, nutritionLogId: logId, type: 'LUNCH' },
      });
    });

    afterAll(async () => {
      // The food FK is ON DELETE RESTRICT, so its referencing rows go first.
      await prisma.mealItem.deleteMany({ where: { foodId } });
      await prisma.food.deleteMany({ where: { id: foodId } });
    });

    it('writes the same columns, defaults and trigger values as Prisma', async () => {
      const rawId = crypto.randomUUID();
      const prismaId = crypto.randomUUID();

      const affected = await prisma.$transaction((tx) =>
        mealItems.create(tx, userId, {
          id: rawId,
          mealId,
          foodId,
          servingCount: 2,
          snapshot,
        }),
      );
      expect(affected).toBe(1);

      await prisma.mealItem.create({
        data: {
          id: prismaId,
          userId,
          mealId,
          foodId,
          servingCount: 2,
          ...snapshot,
        },
      });

      const raw = await prisma.mealItem.findUniqueOrThrow({
        where: { id: rawId },
      });
      const viaPrisma = await prisma.mealItem.findUniqueOrThrow({
        where: { id: prismaId },
      });

      expectColumnsEqual(raw, viaPrisma);
      expect(raw.version).toBe(1);
      expect(viaPrisma.version).toBe(1);
      expect(raw.createdAt).toBeInstanceOf(Date);
      expect(raw.updatedAt).toBeInstanceOf(Date);
      expect(Number.isNaN(raw.updatedAt.getTime())).toBe(false);
      expect(raw.syncSeq).toBeGreaterThan(0n);
      expect(viaPrisma.syncSeq).toBeGreaterThan(raw.syncSeq);
    });

    it('preserves the nullable snapshot columns exactly as given', async () => {
      const id = crypto.randomUUID();

      await prisma.$transaction((tx) =>
        mealItems.create(tx, userId, {
          id,
          mealId,
          foodId,
          servingCount: 1.5,
          snapshot: {
            ...snapshot,
            catalogKeySnapshot: null,
            foodRevisionSnapshot: null,
            catalogVersionSnapshot: null,
            gramsPerServingSnapshot: null,
            fiberPerServingSnapshot: null,
          },
        }),
      );

      const row = await prisma.mealItem.findUniqueOrThrow({ where: { id } });
      expect(row.catalogKeySnapshot).toBeNull();
      expect(row.foodRevisionSnapshot).toBeNull();
      expect(row.catalogVersionSnapshot).toBeNull();
      expect(row.gramsPerServingSnapshot).toBeNull();
      expect(row.fiberPerServingSnapshot).toBeNull();
      expect(row.servingCount).toBe(1.5);
    });

    it('reports 0 for a primary-key collision without raising', async () => {
      const id = crypto.randomUUID();

      const first = await prisma.$transaction((tx) =>
        mealItems.create(tx, userId, {
          id,
          mealId,
          foodId,
          servingCount: 1,
          snapshot,
        }),
      );
      expect(first).toBe(1);

      const second = await prisma.$transaction((tx) =>
        mealItems.create(tx, userId, {
          id,
          mealId,
          foodId,
          servingCount: 9,
          snapshot,
        }),
      );
      expect(second).toBe(0);

      const row = await prisma.mealItem.findUniqueOrThrow({ where: { id } });
      expect(row.servingCount).toBe(1); // the losing insert changed nothing
    });

    it('still THROWS on the serving-count CHECK, which is not a conflict', async () => {
      await expect(
        prisma.$transaction((tx) =>
          mealItems.create(tx, userId, {
            id: crypto.randomUUID(),
            mealId,
            foodId,
            // chk_meal_items_serving_count: serving_count > 0
            servingCount: 0,
            snapshot,
          }),
        ),
      ).rejects.toThrow();
    });

    it('still THROWS when the parent meal foreign key does not exist', async () => {
      await expect(
        prisma.$transaction((tx) =>
          mealItems.create(tx, userId, {
            id: crypto.randomUUID(),
            mealId: crypto.randomUUID(), // no such meal
            foodId,
            servingCount: 1,
            snapshot,
          }),
        ),
      ).rejects.toThrow();
    });
  });

  describe('pull ordering is unaffected by the raw path', () => {
    it('returns raw- and Prisma-created rows in one ascending sync_seq stream', async () => {
      const a = crypto.randomUUID();
      const b = crypto.randomUUID();
      const c = crypto.randomUUID();

      await prisma.$transaction((tx) =>
        repo.createBodyWeight(tx, userId, a, {
          date: new Date('2026-07-01T00:00:00.000Z'),
          weightKg: 79,
          notes: null,
        }),
      );
      await prisma.bodyWeight.create({
        data: {
          id: b,
          userId,
          weightKg: 79.5,
          date: new Date('2026-07-02T00:00:00.000Z'),
          notes: null,
        },
      });
      await prisma.$transaction((tx) =>
        repo.createBodyWeight(tx, userId, c, {
          date: new Date('2026-07-03T00:00:00.000Z'),
          weightKg: 80,
          notes: null,
        }),
      );

      const page = await repo.bodyWeightsChangedSince(userId, 0, 500);
      const ids: string[] = [a, b, c];
      const seen = page.filter((r) => ids.includes(r.id));
      expect(seen.map((r) => r.id)).toEqual([a, b, c]);
      expect(seen.map((r) => r.syncSeq)).toEqual(
        [...seen.map((r) => r.syncSeq)].sort((x, y) => x - y),
      );
    });
  });
});
