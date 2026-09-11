import type { SyncTx } from '../../sync/domain/sync.types';
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
} from './workout-payload';
import type {
  CustomExerciseRecord,
  ExerciseRef,
  OwnedParent,
  RoutineExerciseRecord,
  RoutineRecord,
  WorkoutLogRecord,
  WorkoutSetRecord,
} from './workout.types';

export type WorkoutResolution<TCreate, TUpdate> = {
  expectedVersion: number;
  expectedDeleted: boolean;
  resolvedBy: string;
} & (
  | { operation: 'CREATE'; data: TCreate }
  | { operation: 'UPDATE'; data: TUpdate }
  | { operation: 'DELETE' }
);

/**
 * Repository port for the workout write entities (ADR-P015 Slice 3). One port
 * for the whole module; implementations own persistence only, handlers own
 * validation/ownership/dependency checks. All writes carry the client-minted
 * id and the pipeline-provided new version; ownership/version conflicts are
 * enforced by the sync pipeline via `findOwned*` + baseVersion.
 */
export abstract class WorkoutRepositoryPort {
  // ── shared reference/parent probes ──────────────────────────────────────
  /** Exercise existence probe (global built-in or a user's custom); null = absent. */
  abstract findExercise(
    tx: SyncTx,
    exerciseId: string,
  ): Promise<ExerciseRef | null>;

  // ── custom exercises (Slice 3B) ───────────────────────────────────────────
  /**
   * Owner-scoped fetch of a user's CUSTOM exercise (createdBy = userId). Returns
   * null for a built-in (createdBy null) or another user's exercise, so the sync
   * pipeline rejects UPDATE/DELETE of built-ins/foreign rows as NOT_FOUND.
   */
  abstract findOwnedExercise(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<CustomExerciseRecord | null>;
  abstract createExercise(
    tx: SyncTx,
    userId: string,
    id: string,
    data: ExerciseCreateInput,
  ): Promise<number>;
  /** Owner-scoped update (never touches a built-in or another user's row). */
  abstract updateExercise(
    tx: SyncTx,
    userId: string,
    id: string,
    data: ExerciseUpdateInput,
    expectedVersion: number,
  ): Promise<number>;
  /** Owner-scoped soft-delete tombstone (no deleted_by column on exercises). */
  abstract softDeleteExercise(
    tx: SyncTx,
    userId: string,
    id: string,
    expectedVersion: number,
  ): Promise<number>;
  abstract exercisesChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<CustomExerciseRecord[]>;
  abstract resolveExercise(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: WorkoutResolution<ExerciseCreateInput, ExerciseUpdateInput>,
  ): Promise<number>;

  // ── routines ────────────────────────────────────────────────────────────
  abstract findOwnedRoutine(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<RoutineRecord | null>;
  abstract createRoutine(
    tx: SyncTx,
    userId: string,
    id: string,
    data: RoutineCreateInput,
  ): Promise<number>;
  abstract updateRoutine(
    tx: SyncTx,
    userId: string,
    id: string,
    data: RoutineCreateInput,
    expectedVersion: number,
  ): Promise<number>;
  abstract softDeleteRoutine(
    tx: SyncTx,
    userId: string,
    id: string,
    deletedBy: string,
    expectedVersion: number,
  ): Promise<number>;
  abstract routinesChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<RoutineRecord[]>;
  /** Parent-routine ownership probe by id (null = not yet synced). */
  abstract findRoutineParent(
    tx: SyncTx,
    routineId: string,
  ): Promise<OwnedParent | null>;
  abstract resolveRoutine(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: WorkoutResolution<RoutineCreateInput, RoutineCreateInput>,
  ): Promise<number>;

  // ── routine_exercises ─────────────────────────────────────────────────────
  abstract findOwnedRoutineExercise(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<RoutineExerciseRecord | null>;
  abstract createRoutineExercise(
    tx: SyncTx,
    userId: string,
    id: string,
    data: RoutineExerciseCreateInput,
  ): Promise<number>;
  abstract updateRoutineExercise(
    tx: SyncTx,
    userId: string,
    id: string,
    data: RoutineExerciseUpdateInput,
    expectedVersion: number,
  ): Promise<number>;
  abstract softDeleteRoutineExercise(
    tx: SyncTx,
    userId: string,
    id: string,
    deletedBy: string,
    expectedVersion: number,
  ): Promise<number>;
  abstract routineExercisesChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<RoutineExerciseRecord[]>;
  abstract resolveRoutineExercise(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: WorkoutResolution<
      RoutineExerciseCreateInput,
      RoutineExerciseUpdateInput
    >,
  ): Promise<number>;

  // ── workout_logs ──────────────────────────────────────────────────────────
  abstract findOwnedWorkoutLog(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<WorkoutLogRecord | null>;
  abstract createWorkoutLog(
    tx: SyncTx,
    userId: string,
    id: string,
    data: WorkoutLogCreateInput,
  ): Promise<number>;
  abstract updateWorkoutLog(
    tx: SyncTx,
    userId: string,
    id: string,
    data: WorkoutLogUpdateInput,
    expectedVersion: number,
  ): Promise<number>;
  abstract softDeleteWorkoutLog(
    tx: SyncTx,
    userId: string,
    id: string,
    deletedBy: string,
    expectedVersion: number,
  ): Promise<number>;
  abstract workoutLogsChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<WorkoutLogRecord[]>;
  /** Parent-workout-log ownership probe by id (null = not yet synced). */
  abstract findWorkoutLogParent(
    tx: SyncTx,
    workoutLogId: string,
  ): Promise<OwnedParent | null>;
  abstract resolveWorkoutLog(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: WorkoutResolution<WorkoutLogCreateInput, WorkoutLogUpdateInput>,
  ): Promise<number>;

  // ── workout_sets ──────────────────────────────────────────────────────────
  abstract findOwnedWorkoutSet(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<WorkoutSetRecord | null>;
  abstract createWorkoutSet(
    tx: SyncTx,
    userId: string,
    id: string,
    data: WorkoutSetCreateInput,
  ): Promise<number>;
  abstract updateWorkoutSet(
    tx: SyncTx,
    userId: string,
    id: string,
    data: WorkoutSetUpdateInput,
    expectedVersion: number,
  ): Promise<number>;
  abstract softDeleteWorkoutSet(
    tx: SyncTx,
    userId: string,
    id: string,
    deletedBy: string,
    expectedVersion: number,
  ): Promise<number>;
  abstract workoutSetsChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<WorkoutSetRecord[]>;
  abstract resolveWorkoutSet(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: WorkoutResolution<WorkoutSetCreateInput, WorkoutSetUpdateInput>,
  ): Promise<number>;
}
