import { Module, OnModuleInit } from '@nestjs/common';

import { SyncEntityRegistry } from '../sync/domain/sync-entity-registry';
import { SyncModule } from '../sync/sync.module';
import { WorkoutRepositoryPort } from './domain/workout.repository';
import { ExerciseSyncHandler } from './infrastructure/exercise-sync.handler';
import { PrismaWorkoutRepository } from './infrastructure/prisma-workout.repository';
import { RoutineExerciseSyncHandler } from './infrastructure/routine-exercise-sync.handler';
import { RoutineSyncHandler } from './infrastructure/routine-sync.handler';
import { WorkoutLogSyncHandler } from './infrastructure/workout-log-sync.handler';
import { WorkoutSetSyncHandler } from './infrastructure/workout-set-sync.handler';

/**
 * Workout module (ADR-P015 Phase 16 Slice 3 / 3B). Registers the user-owned
 * workout-write EntitySyncHandlers: custom `exercises` (Slice 3B), `routines`,
 * `routine_exercises`, `workout_logs`, `workout_sets`; no REST write endpoints
 * and no logging UI. Global/built-in exercises (`created_by = null`) are
 * reference/catalog data seeded server-side and are never user-mutated through
 * sync — only user CUSTOM exercises (`created_by = userId`) are writable.
 * Workout data is wellness — no field encryption.
 */
@Module({
  imports: [SyncModule],
  providers: [
    { provide: WorkoutRepositoryPort, useClass: PrismaWorkoutRepository },
    ExerciseSyncHandler,
    RoutineSyncHandler,
    RoutineExerciseSyncHandler,
    WorkoutLogSyncHandler,
    WorkoutSetSyncHandler,
  ],
})
export class WorkoutModule implements OnModuleInit {
  constructor(
    private readonly registry: SyncEntityRegistry,
    private readonly exerciseHandler: ExerciseSyncHandler,
    private readonly routineHandler: RoutineSyncHandler,
    private readonly routineExerciseHandler: RoutineExerciseSyncHandler,
    private readonly workoutLogHandler: WorkoutLogSyncHandler,
    private readonly workoutSetHandler: WorkoutSetSyncHandler,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.exerciseHandler);
    this.registry.register(this.routineHandler);
    this.registry.register(this.routineExerciseHandler);
    this.registry.register(this.workoutLogHandler);
    this.registry.register(this.workoutSetHandler);
  }
}
