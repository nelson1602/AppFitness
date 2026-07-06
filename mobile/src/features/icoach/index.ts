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
