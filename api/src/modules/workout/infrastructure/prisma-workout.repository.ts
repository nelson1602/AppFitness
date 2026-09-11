import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import {
  isAlreadySatisfiedDelete,
  type SyncTx,
} from '../../sync/domain/sync.types';
import type {
  ExerciseCreateInput,
  ExerciseUpdateInput,
  RoutineCreateInput,
  RoutineExerciseCreateInput,
  RoutineExerciseUpdateInput,
  WorkoutLogCreateInput,
  WorkoutLogUpdateInput,
  WorkoutSetCreateInput,
  WorkoutSetUpdateInput,
} from '../domain/workout-payload';
import {
  WorkoutRepositoryPort,
  type WorkoutResolution,
} from '../domain/workout.repository';
import type {
  CustomExerciseRecord,
  ExerciseRef,
  OwnedParent,
  RoutineExerciseRecord,
  RoutineRecord,
  WorkoutLogRecord,
  WorkoutSetRecord,
} from '../domain/workout.types';
import {
  exerciseRowToRecord,
  routineExerciseRowToRecord,
  routineRowToRecord,
  workoutLogRowToRecord,
  workoutSetRowToRecord,
} from './workout.mapper';

/** Persistence for the workout write entities (ADR-P015 Slice 3). */
@Injectable()
export class PrismaWorkoutRepository extends WorkoutRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // ── shared probes ─────────────────────────────────────────────────────────
  async findExercise(
    tx: SyncTx,
    exerciseId: string,
  ): Promise<ExerciseRef | null> {
    const e = await tx.exercise.findUnique({
      where: { id: exerciseId },
      select: { createdBy: true, deletedAt: true },
    });
    return e ? { createdBy: e.createdBy, deletedAt: e.deletedAt } : null;
  }

  // ── custom exercises (Slice 3B) ───────────────────────────────────────────
  async findOwnedExercise(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<CustomExerciseRecord | null> {
    // createdBy scoping excludes built-ins (createdBy null) and foreign rows.
    const e = await tx.exercise.findFirst({
      where: { id, createdBy: userId },
    });
    return e ? exerciseRowToRecord(e) : null;
  }

  async createExercise(
    tx: SyncTx,
    userId: string,
    id: string,
    data: ExerciseCreateInput,
  ): Promise<number> {
    // created_by is set server-side from the authenticated user, never trusted
    // from the payload — a client can only ever create its own custom exercise.
    return tx.$executeRaw`
      INSERT INTO exercises (
        id, name, muscle_group, category, instructions, created_by, updated_at
      )
      VALUES (
        ${id}::uuid, ${data.name}, ${data.muscleGroup},
        ${data.category}::"ExerciseCategory", ${data.instructions},
        ${userId}::uuid, ${new Date()}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  async updateExercise(
    tx: SyncTx,
    userId: string,
    id: string,
    data: ExerciseUpdateInput,
    expectedVersion: number,
  ): Promise<number> {
    // updateMany with createdBy scoping is defense-in-depth: even though the
    // pipeline only calls apply() after an owner-scoped getServerState, a
    // built-in (createdBy null) or another user's row can never be mutated.
    const { count } = await tx.exercise.updateMany({
      where: {
        id,
        createdBy: userId,
        version: expectedVersion,
        deletedAt: null,
      },
      data: {
        name: data.name,
        muscleGroup: data.muscleGroup,
        category: data.category,
        instructions: data.instructions,
        version: expectedVersion + 1,
      },
    });
    return count;
  }

  async softDeleteExercise(
    tx: SyncTx,
    userId: string,
    id: string,
    expectedVersion: number,
  ): Promise<number> {
    const { count } = await tx.exercise.updateMany({
      where: {
        id,
        createdBy: userId,
        version: expectedVersion,
        deletedAt: null,
      },
      data: { deletedAt: new Date(), version: expectedVersion + 1 },
    });
    return count;
  }

  async exercisesChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<CustomExerciseRecord[]> {
    const rows = await this.prisma.exercise.findMany({
      where: { createdBy: userId, syncSeq: { gt: BigInt(sinceSeq) } },
      orderBy: { syncSeq: 'asc' },
      take: limit,
    });
    return rows.map(exerciseRowToRecord);
  }

  async resolveExercise(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: WorkoutResolution<ExerciseCreateInput, ExerciseUpdateInput>,
  ): Promise<number> {
    if (isAlreadySatisfiedDelete(resolution)) return 0;

    const fields: Prisma.ExerciseUpdateManyMutationInput =
      resolution.operation === 'DELETE'
        ? { deletedAt: new Date() }
        : {
            name: resolution.data.name,
            muscleGroup: resolution.data.muscleGroup,
            category: resolution.data.category,
            instructions: resolution.data.instructions,
            ...(resolution.expectedDeleted ? { deletedAt: null } : {}),
          };
    const { count } = await tx.exercise.updateMany({
      where: {
        id,
        createdBy: userId,
        version: resolution.expectedVersion,
        deletedAt: resolution.expectedDeleted ? { not: null } : null,
      },
      data: { ...fields, version: resolution.expectedVersion + 1 },
    });
    return count;
  }

  // ── routines ────────────────────────────────────────────────────────────
  async findOwnedRoutine(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<RoutineRecord | null> {
    const r = await tx.routine.findFirst({ where: { id, userId } });
    return r ? routineRowToRecord(r) : null;
  }

  async findRoutineParent(
    tx: SyncTx,
    routineId: string,
  ): Promise<OwnedParent | null> {
    const r = await tx.routine.findUnique({
      where: { id: routineId },
      select: { userId: true, deletedAt: true },
    });
    return r ? { userId: r.userId, deletedAt: r.deletedAt } : null;
  }

  async createRoutine(
    tx: SyncTx,
    userId: string,
    id: string,
    data: RoutineCreateInput,
  ): Promise<number> {
    return tx.$executeRaw`
      INSERT INTO routines (id, user_id, name, description, updated_at)
      VALUES (
        ${id}::uuid, ${userId}::uuid, ${data.name}, ${data.description},
        ${new Date()}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  async updateRoutine(
    tx: SyncTx,
    userId: string,
    id: string,
    data: RoutineCreateInput,
    expectedVersion: number,
  ): Promise<number> {
    const { count } = await tx.routine.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: {
        name: data.name,
        description: data.description,
        version: expectedVersion + 1,
      },
    });
    return count;
  }

  async softDeleteRoutine(
    tx: SyncTx,
    userId: string,
    id: string,
    deletedBy: string,
    expectedVersion: number,
  ): Promise<number> {
    const { count } = await tx.routine.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: {
        deletedAt: new Date(),
        deletedBy,
        version: expectedVersion + 1,
      },
    });
    return count;
  }

  async routinesChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<RoutineRecord[]> {
    const rows = await this.prisma.routine.findMany({
      where: { userId, syncSeq: { gt: BigInt(sinceSeq) } },
      orderBy: { syncSeq: 'asc' },
      take: limit,
    });
    return rows.map(routineRowToRecord);
  }

  async resolveRoutine(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: WorkoutResolution<RoutineCreateInput, RoutineCreateInput>,
  ): Promise<number> {
    if (isAlreadySatisfiedDelete(resolution)) return 0;

    const { count } = await tx.routine.updateMany({
      where: reviewedWhere(id, userId, resolution),
      data: {
        ...(resolution.operation === 'DELETE'
          ? {}
          : {
              name: resolution.data.name,
              description: resolution.data.description,
            }),
        ...tombstoneFields(resolution, resolution.resolvedBy),
        version: resolution.expectedVersion + 1,
      },
    });
    return count;
  }

  // ── routine_exercises ─────────────────────────────────────────────────────
  async findOwnedRoutineExercise(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<RoutineExerciseRecord | null> {
    const r = await tx.routineExercise.findFirst({
      where: { id, userId },
    });
    return r ? routineExerciseRowToRecord(r) : null;
  }

  async createRoutineExercise(
    tx: SyncTx,
    userId: string,
    id: string,
    data: RoutineExerciseCreateInput,
  ): Promise<number> {
    return tx.$executeRaw`
      INSERT INTO routine_exercises (
        id, user_id, routine_id, exercise_id, "order", target_sets,
        target_reps, target_weight_kg, updated_at
      )
      VALUES (
        ${id}::uuid, ${userId}::uuid, ${data.routineId}::uuid,
        ${data.exerciseId}::uuid, ${data.order}, ${data.targetSets},
        ${data.targetReps}, ${data.targetWeightKg}, ${new Date()}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  async updateRoutineExercise(
    tx: SyncTx,
    userId: string,
    id: string,
    data: RoutineExerciseUpdateInput,
    expectedVersion: number,
  ): Promise<number> {
    const { count } = await tx.routineExercise.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: {
        order: data.order,
        targetSets: data.targetSets,
        targetReps: data.targetReps,
        targetWeightKg: data.targetWeightKg,
        version: expectedVersion + 1,
      },
    });
    return count;
  }

  async softDeleteRoutineExercise(
    tx: SyncTx,
    userId: string,
    id: string,
    deletedBy: string,
    expectedVersion: number,
  ): Promise<number> {
    const { count } = await tx.routineExercise.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: {
        deletedAt: new Date(),
        deletedBy,
        version: expectedVersion + 1,
      },
    });
    return count;
  }

  async routineExercisesChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<RoutineExerciseRecord[]> {
    const rows = await this.prisma.routineExercise.findMany({
      where: { userId, syncSeq: { gt: BigInt(sinceSeq) } },
      orderBy: { syncSeq: 'asc' },
      take: limit,
    });
    return rows.map(routineExerciseRowToRecord);
  }

  async resolveRoutineExercise(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: WorkoutResolution<
      RoutineExerciseCreateInput,
      RoutineExerciseUpdateInput
    >,
  ): Promise<number> {
    if (isAlreadySatisfiedDelete(resolution)) return 0;

    const { count } = await tx.routineExercise.updateMany({
      where: reviewedWhere(id, userId, resolution),
      data: {
        ...(resolution.operation === 'DELETE'
          ? {}
          : {
              ...(resolution.operation === 'CREATE'
                ? {
                    routineId: resolution.data.routineId,
                    exerciseId: resolution.data.exerciseId,
                  }
                : {}),
              order: resolution.data.order,
              targetSets: resolution.data.targetSets,
              targetReps: resolution.data.targetReps,
              targetWeightKg: resolution.data.targetWeightKg,
            }),
        ...tombstoneFields(resolution, resolution.resolvedBy),
        version: resolution.expectedVersion + 1,
      },
    });
    return count;
  }

  // ── workout_logs ──────────────────────────────────────────────────────────
  async findOwnedWorkoutLog(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<WorkoutLogRecord | null> {
    const r = await tx.workoutLog.findFirst({ where: { id, userId } });
    return r ? workoutLogRowToRecord(r) : null;
  }

  async findWorkoutLogParent(
    tx: SyncTx,
    workoutLogId: string,
  ): Promise<OwnedParent | null> {
    const r = await tx.workoutLog.findUnique({
      where: { id: workoutLogId },
      select: { userId: true, deletedAt: true },
    });
    return r ? { userId: r.userId, deletedAt: r.deletedAt } : null;
  }

  async createWorkoutLog(
    tx: SyncTx,
    userId: string,
    id: string,
    data: WorkoutLogCreateInput,
  ): Promise<number> {
    return tx.$executeRaw`
      INSERT INTO workout_logs (
        id, user_id, routine_id, name, notes, started_at, finished_at,
        updated_at
      )
      VALUES (
        ${id}::uuid, ${userId}::uuid, ${data.routineId}::uuid, ${data.name},
        ${data.notes}, ${data.startedAt}, ${data.finishedAt}, ${new Date()}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  async updateWorkoutLog(
    tx: SyncTx,
    userId: string,
    id: string,
    data: WorkoutLogUpdateInput,
    expectedVersion: number,
  ): Promise<number> {
    const { count } = await tx.workoutLog.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: {
        name: data.name,
        notes: data.notes,
        startedAt: data.startedAt,
        finishedAt: data.finishedAt,
        version: expectedVersion + 1,
      },
    });
    return count;
  }

  async softDeleteWorkoutLog(
    tx: SyncTx,
    userId: string,
    id: string,
    deletedBy: string,
    expectedVersion: number,
  ): Promise<number> {
    const { count } = await tx.workoutLog.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: {
        deletedAt: new Date(),
        deletedBy,
        version: expectedVersion + 1,
      },
    });
    return count;
  }

  async workoutLogsChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<WorkoutLogRecord[]> {
    const rows = await this.prisma.workoutLog.findMany({
      where: { userId, syncSeq: { gt: BigInt(sinceSeq) } },
      orderBy: { syncSeq: 'asc' },
      take: limit,
    });
    return rows.map(workoutLogRowToRecord);
  }

  async resolveWorkoutLog(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: WorkoutResolution<WorkoutLogCreateInput, WorkoutLogUpdateInput>,
  ): Promise<number> {
    if (isAlreadySatisfiedDelete(resolution)) return 0;

    const { count } = await tx.workoutLog.updateMany({
      where: reviewedWhere(id, userId, resolution),
      data: {
        ...(resolution.operation === 'DELETE'
          ? {}
          : {
              ...(resolution.operation === 'CREATE'
                ? { routineId: resolution.data.routineId }
                : {}),
              name: resolution.data.name,
              notes: resolution.data.notes,
              startedAt: resolution.data.startedAt,
              finishedAt: resolution.data.finishedAt,
            }),
        ...tombstoneFields(resolution, resolution.resolvedBy),
        version: resolution.expectedVersion + 1,
      },
    });
    return count;
  }

  // ── workout_sets ──────────────────────────────────────────────────────────
  async findOwnedWorkoutSet(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<WorkoutSetRecord | null> {
    const r = await tx.workoutSet.findFirst({ where: { id, userId } });
    return r ? workoutSetRowToRecord(r) : null;
  }

  async createWorkoutSet(
    tx: SyncTx,
    userId: string,
    id: string,
    data: WorkoutSetCreateInput,
  ): Promise<number> {
    return tx.$executeRaw`
      INSERT INTO workout_sets (
        id, user_id, workout_log_id, exercise_id, set_number, reps,
        weight_kg, rpe, completed, notes, updated_at
      )
      VALUES (
        ${id}::uuid, ${userId}::uuid, ${data.workoutLogId}::uuid,
        ${data.exerciseId}::uuid, ${data.setNumber}, ${data.reps},
        ${data.weightKg}, ${data.rpe}, ${data.completed}, ${data.notes},
        ${new Date()}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  async updateWorkoutSet(
    tx: SyncTx,
    userId: string,
    id: string,
    data: WorkoutSetUpdateInput,
    expectedVersion: number,
  ): Promise<number> {
    const { count } = await tx.workoutSet.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: {
        setNumber: data.setNumber,
        reps: data.reps,
        weightKg: data.weightKg,
        rpe: data.rpe,
        completed: data.completed,
        notes: data.notes,
        version: expectedVersion + 1,
      },
    });
    return count;
  }

  async softDeleteWorkoutSet(
    tx: SyncTx,
    userId: string,
    id: string,
    deletedBy: string,
    expectedVersion: number,
  ): Promise<number> {
    const { count } = await tx.workoutSet.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: {
        deletedAt: new Date(),
        deletedBy,
        version: expectedVersion + 1,
      },
    });
    return count;
  }

  async workoutSetsChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<WorkoutSetRecord[]> {
    const rows = await this.prisma.workoutSet.findMany({
      where: { userId, syncSeq: { gt: BigInt(sinceSeq) } },
      orderBy: { syncSeq: 'asc' },
      take: limit,
    });
    return rows.map(workoutSetRowToRecord);
  }

  async resolveWorkoutSet(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: WorkoutResolution<WorkoutSetCreateInput, WorkoutSetUpdateInput>,
  ): Promise<number> {
    if (isAlreadySatisfiedDelete(resolution)) return 0;

    const { count } = await tx.workoutSet.updateMany({
      where: reviewedWhere(id, userId, resolution),
      data: {
        ...(resolution.operation === 'DELETE'
          ? {}
          : {
              ...(resolution.operation === 'CREATE'
                ? {
                    workoutLogId: resolution.data.workoutLogId,
                    exerciseId: resolution.data.exerciseId,
                  }
                : {}),
              setNumber: resolution.data.setNumber,
              reps: resolution.data.reps,
              weightKg: resolution.data.weightKg,
              rpe: resolution.data.rpe,
              completed: resolution.data.completed,
              notes: resolution.data.notes,
            }),
        ...tombstoneFields(resolution, resolution.resolvedBy),
        version: resolution.expectedVersion + 1,
      },
    });
    return count;
  }
}

function reviewedWhere(
  id: string,
  userId: string,
  resolution: { expectedVersion: number; expectedDeleted: boolean },
): {
  id: string;
  userId: string;
  version: number;
  deletedAt: null | { not: null };
} {
  return {
    id,
    userId,
    version: resolution.expectedVersion,
    deletedAt: resolution.expectedDeleted ? { not: null } : null,
  };
}

function tombstoneFields(
  resolution: { operation: string; expectedDeleted: boolean },
  resolvedBy: string,
): { deletedAt?: Date | null; deletedBy?: string | null } {
  if (resolution.operation === 'DELETE') {
    return { deletedAt: new Date(), deletedBy: resolvedBy };
  }
  return resolution.expectedDeleted ? { deletedAt: null, deletedBy: null } : {};
}
