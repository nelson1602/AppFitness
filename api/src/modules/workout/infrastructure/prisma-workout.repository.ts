import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
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
import { WorkoutRepositoryPort } from '../domain/workout.repository';
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
  async findExercise(exerciseId: string): Promise<ExerciseRef | null> {
    const e = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
      select: { createdBy: true, deletedAt: true },
    });
    return e ? { createdBy: e.createdBy, deletedAt: e.deletedAt } : null;
  }

  // ── custom exercises (Slice 3B) ───────────────────────────────────────────
  async findOwnedExercise(
    userId: string,
    id: string,
  ): Promise<CustomExerciseRecord | null> {
    // createdBy scoping excludes built-ins (createdBy null) and foreign rows.
    const e = await this.prisma.exercise.findFirst({
      where: { id, createdBy: userId },
    });
    return e ? exerciseRowToRecord(e) : null;
  }

  async createExercise(
    userId: string,
    id: string,
    data: ExerciseCreateInput,
  ): Promise<CustomExerciseRecord> {
    // created_by is set server-side from the authenticated user, never trusted
    // from the payload — a client can only ever create its own custom exercise.
    const e = await this.prisma.exercise.create({
      data: {
        id,
        createdBy: userId,
        name: data.name,
        muscleGroup: data.muscleGroup,
        category: data.category,
        instructions: data.instructions,
      },
    });
    return exerciseRowToRecord(e);
  }

  async updateExercise(
    userId: string,
    id: string,
    data: ExerciseUpdateInput,
    newVersion: number,
  ): Promise<void> {
    // updateMany with createdBy scoping is defense-in-depth: even though the
    // pipeline only calls apply() after an owner-scoped getServerState, a
    // built-in (createdBy null) or another user's row can never be mutated.
    await this.prisma.exercise.updateMany({
      where: { id, createdBy: userId },
      data: {
        name: data.name,
        muscleGroup: data.muscleGroup,
        category: data.category,
        instructions: data.instructions,
        version: newVersion,
      },
    });
  }

  async softDeleteExercise(
    userId: string,
    id: string,
    newVersion: number,
  ): Promise<void> {
    await this.prisma.exercise.updateMany({
      where: { id, createdBy: userId },
      data: { deletedAt: new Date(), version: newVersion },
    });
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

  // ── routines ────────────────────────────────────────────────────────────
  async findOwnedRoutine(
    userId: string,
    id: string,
  ): Promise<RoutineRecord | null> {
    const r = await this.prisma.routine.findFirst({ where: { id, userId } });
    return r ? routineRowToRecord(r) : null;
  }

  async findRoutineParent(routineId: string): Promise<OwnedParent | null> {
    const r = await this.prisma.routine.findUnique({
      where: { id: routineId },
      select: { userId: true, deletedAt: true },
    });
    return r ? { userId: r.userId, deletedAt: r.deletedAt } : null;
  }

  async createRoutine(
    userId: string,
    id: string,
    data: RoutineCreateInput,
  ): Promise<RoutineRecord> {
    const r = await this.prisma.routine.create({
      data: { id, userId, name: data.name, description: data.description },
    });
    return routineRowToRecord(r);
  }

  async updateRoutine(
    id: string,
    data: RoutineCreateInput,
    newVersion: number,
  ): Promise<void> {
    await this.prisma.routine.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        version: newVersion,
      },
    });
  }

  async softDeleteRoutine(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void> {
    await this.prisma.routine.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy, version: newVersion },
    });
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

  // ── routine_exercises ─────────────────────────────────────────────────────
  async findOwnedRoutineExercise(
    userId: string,
    id: string,
  ): Promise<RoutineExerciseRecord | null> {
    const r = await this.prisma.routineExercise.findFirst({
      where: { id, userId },
    });
    return r ? routineExerciseRowToRecord(r) : null;
  }

  async createRoutineExercise(
    userId: string,
    id: string,
    data: RoutineExerciseCreateInput,
  ): Promise<RoutineExerciseRecord> {
    const r = await this.prisma.routineExercise.create({
      data: {
        id,
        userId,
        routineId: data.routineId,
        exerciseId: data.exerciseId,
        order: data.order,
        targetSets: data.targetSets,
        targetReps: data.targetReps,
        targetWeightKg: data.targetWeightKg,
      },
    });
    return routineExerciseRowToRecord(r);
  }

  async updateRoutineExercise(
    id: string,
    data: RoutineExerciseUpdateInput,
    newVersion: number,
  ): Promise<void> {
    await this.prisma.routineExercise.update({
      where: { id },
      data: {
        order: data.order,
        targetSets: data.targetSets,
        targetReps: data.targetReps,
        targetWeightKg: data.targetWeightKg,
        version: newVersion,
      },
    });
  }

  async softDeleteRoutineExercise(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void> {
    await this.prisma.routineExercise.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy, version: newVersion },
    });
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

  // ── workout_logs ──────────────────────────────────────────────────────────
  async findOwnedWorkoutLog(
    userId: string,
    id: string,
  ): Promise<WorkoutLogRecord | null> {
    const r = await this.prisma.workoutLog.findFirst({ where: { id, userId } });
    return r ? workoutLogRowToRecord(r) : null;
  }

  async findWorkoutLogParent(
    workoutLogId: string,
  ): Promise<OwnedParent | null> {
    const r = await this.prisma.workoutLog.findUnique({
      where: { id: workoutLogId },
      select: { userId: true, deletedAt: true },
    });
    return r ? { userId: r.userId, deletedAt: r.deletedAt } : null;
  }

  async createWorkoutLog(
    userId: string,
    id: string,
    data: WorkoutLogCreateInput,
  ): Promise<WorkoutLogRecord> {
    const r = await this.prisma.workoutLog.create({
      data: {
        id,
        userId,
        routineId: data.routineId,
        name: data.name,
        notes: data.notes,
        startedAt: data.startedAt,
        finishedAt: data.finishedAt,
      },
    });
    return workoutLogRowToRecord(r);
  }

  async updateWorkoutLog(
    id: string,
    data: WorkoutLogUpdateInput,
    newVersion: number,
  ): Promise<void> {
    await this.prisma.workoutLog.update({
      where: { id },
      data: {
        name: data.name,
        notes: data.notes,
        startedAt: data.startedAt,
        finishedAt: data.finishedAt,
        version: newVersion,
      },
    });
  }

  async softDeleteWorkoutLog(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void> {
    await this.prisma.workoutLog.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy, version: newVersion },
    });
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

  // ── workout_sets ──────────────────────────────────────────────────────────
  async findOwnedWorkoutSet(
    userId: string,
    id: string,
  ): Promise<WorkoutSetRecord | null> {
    const r = await this.prisma.workoutSet.findFirst({ where: { id, userId } });
    return r ? workoutSetRowToRecord(r) : null;
  }

  async createWorkoutSet(
    userId: string,
    id: string,
    data: WorkoutSetCreateInput,
  ): Promise<WorkoutSetRecord> {
    const r = await this.prisma.workoutSet.create({
      data: {
        id,
        userId,
        workoutLogId: data.workoutLogId,
        exerciseId: data.exerciseId,
        setNumber: data.setNumber,
        reps: data.reps,
        weightKg: data.weightKg,
        rpe: data.rpe,
        completed: data.completed,
        notes: data.notes,
      },
    });
    return workoutSetRowToRecord(r);
  }

  async updateWorkoutSet(
    id: string,
    data: WorkoutSetUpdateInput,
    newVersion: number,
  ): Promise<void> {
    await this.prisma.workoutSet.update({
      where: { id },
      data: {
        setNumber: data.setNumber,
        reps: data.reps,
        weightKg: data.weightKg,
        rpe: data.rpe,
        completed: data.completed,
        notes: data.notes,
        version: newVersion,
      },
    });
  }

  async softDeleteWorkoutSet(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void> {
    await this.prisma.workoutSet.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy, version: newVersion },
    });
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
}
