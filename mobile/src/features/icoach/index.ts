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
  WorkoutScheduleDay,
  WorkoutSessionPrescription,
} from './domain/workout-routine';
