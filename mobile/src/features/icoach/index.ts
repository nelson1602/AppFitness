export { evaluate, validateEngineInput } from './domain/engine';
export { ENGINE_RULE_VERSION, PROGRESS_SNAPSHOT_RULE_VERSION } from './domain/rule-versions';
// ADR-P031 W-4B: exported for tests and for the W-4C/W-4D activation slice.
// Nothing in a production path calls it yet.
export {
  analyzeWellnessSafety,
  isWellnessAffectedArea,
  isWellnessMovementToAvoid,
  WELLNESS_PLAN_EXPLANATION_KEY,
  WELLNESS_REASON_MOVEMENT_DECLARED,
  WELLNESS_RULE_MOVEMENT_EXCLUSIONS,
  WellnessSafetyInputInvalid,
} from './domain/wellness-safety';
export type {
  WellnessExclusionReason,
  WellnessSafetyAnalysis,
  WellnessSafetyInput,
  WellnessSafetyInputField,
  WellnessSafetyInputInvalidReason,
} from './domain/wellness-safety';
export type {
  CoachAssessment,
  EngineInput,
  Recommendation,
  Subject,
  TrainingPlan,
  NutritionPlan,
} from './domain/types';
export { InvalidEngineInputError } from './domain/types';
export {
  normalizeTrainingEquipment,
  TRAINING_EQUIPMENT,
  WORKOUT_ROUTINE_CONTRACT_VERSION,
  WORKOUT_TRAINING_PATTERNS,
} from './domain/workout-routine';
export type {
  EquipmentNormalizationResult,
  ExerciseTarget,
  GeneratedWorkoutRoutine,
  TrainingEquipment,
  Weekday,
  WorkoutExercisePrescription,
  WorkoutExerciseSubstitution,
  WorkoutProgressionRule,
  WorkoutRoutineRequest,
  WorkoutRoutineCatalog,
  WorkoutRoutineExerciseCandidate,
  WorkoutScheduleDay,
  WorkoutSessionPrescription,
  WorkoutTrainingPattern,
} from './domain/workout-routine';
export {
  generateWorkoutRoutine,
  WORKOUT_ROUTINE_RULE_VERSION,
  WorkoutRoutineGenerationError,
} from './domain/workout-routine-generator';
export type { WorkoutRoutineGenerationErrorCode } from './domain/workout-routine-generator';
