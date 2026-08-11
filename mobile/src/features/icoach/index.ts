export { evaluate, validateEngineInput } from './domain/engine';
export { ENGINE_RULE_VERSION } from './domain/rule-versions';
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
