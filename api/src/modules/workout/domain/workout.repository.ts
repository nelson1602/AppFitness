import type {
  RoutineCreateInput,
  RoutineExerciseCreateInput,
  RoutineExerciseUpdateInput,
  WorkoutLogCreateInput,
  WorkoutLogUpdateInput,
  WorkoutSetCreateInput,
  WorkoutSetUpdateInput,
} from './workout-payload';
import type {
  ExerciseRef,
  OwnedParent,
  RoutineExerciseRecord,
  RoutineRecord,
  WorkoutLogRecord,
  WorkoutSetRecord,
} from './workout.types';

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
  abstract findExercise(exerciseId: string): Promise<ExerciseRef | null>;

  // ── routines ────────────────────────────────────────────────────────────
  abstract findOwnedRoutine(
    userId: string,
    id: string,
  ): Promise<RoutineRecord | null>;
  abstract createRoutine(
    userId: string,
    id: string,
    data: RoutineCreateInput,
  ): Promise<RoutineRecord>;
  abstract updateRoutine(
    id: string,
    data: RoutineCreateInput,
    newVersion: number,
  ): Promise<void>;
  abstract softDeleteRoutine(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void>;
  abstract routinesChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<RoutineRecord[]>;
  /** Parent-routine ownership probe by id (null = not yet synced). */
  abstract findRoutineParent(routineId: string): Promise<OwnedParent | null>;

  // ── routine_exercises ─────────────────────────────────────────────────────
  abstract findOwnedRoutineExercise(
    userId: string,
    id: string,
  ): Promise<RoutineExerciseRecord | null>;
  abstract createRoutineExercise(
    userId: string,
    id: string,
    data: RoutineExerciseCreateInput,
  ): Promise<RoutineExerciseRecord>;
  abstract updateRoutineExercise(
    id: string,
    data: RoutineExerciseUpdateInput,
    newVersion: number,
  ): Promise<void>;
  abstract softDeleteRoutineExercise(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void>;
  abstract routineExercisesChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<RoutineExerciseRecord[]>;

  // ── workout_logs ──────────────────────────────────────────────────────────
  abstract findOwnedWorkoutLog(
    userId: string,
    id: string,
  ): Promise<WorkoutLogRecord | null>;
  abstract createWorkoutLog(
    userId: string,
    id: string,
    data: WorkoutLogCreateInput,
  ): Promise<WorkoutLogRecord>;
  abstract updateWorkoutLog(
    id: string,
    data: WorkoutLogUpdateInput,
    newVersion: number,
  ): Promise<void>;
  abstract softDeleteWorkoutLog(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void>;
  abstract workoutLogsChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<WorkoutLogRecord[]>;
  /** Parent-workout-log ownership probe by id (null = not yet synced). */
  abstract findWorkoutLogParent(
    workoutLogId: string,
  ): Promise<OwnedParent | null>;

  // ── workout_sets ──────────────────────────────────────────────────────────
  abstract findOwnedWorkoutSet(
    userId: string,
    id: string,
  ): Promise<WorkoutSetRecord | null>;
  abstract createWorkoutSet(
    userId: string,
    id: string,
    data: WorkoutSetCreateInput,
  ): Promise<WorkoutSetRecord>;
  abstract updateWorkoutSet(
    id: string,
    data: WorkoutSetUpdateInput,
    newVersion: number,
  ): Promise<void>;
  abstract softDeleteWorkoutSet(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void>;
  abstract workoutSetsChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<WorkoutSetRecord[]>;
}
