import type {
  WorkoutExercisePrescription,
  WorkoutSessionAdjustment,
} from '@/features/icoach/domain/workout-routine';
import type { FoodId } from '@/features/nutrition/domain/food-catalog';
import type { MealMacros, MealPlanFood, MealSlot } from '@/features/nutrition/domain/meal-plan';
import type { SyncStatus } from '@/shared/infrastructure/database/types';

/**
 * ADR-P042 — the saved weekly iCoach plan. Domain types only: no I/O, no clock.
 *
 * A plan revision freezes the 7 days of one week (Monday first): each day's
 * workout with its full prescription (load step applied) and its meals with
 * their ingredient lines. Logging never changes it; only a new revision does.
 */
export const WEEKLY_PLAN_CONTRACT_VERSION = 'weekly-plan@1';

/** How many load steps progression may add (ADR-P042 D4). */
export const MAX_LOAD_STEP = 4;

export type PlanTrigger = 'FIRST_RUN' | 'WEEKLY' | 'CHANGE';

export interface PlanTargets {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** The engine's calorie safety floor; the off-plan overlay never goes below it. */
  floorCalories: number;
}

export type PlannedWorkout =
  | {
      kind: 'TRAINING';
      sessionKey: string;
      focusKey: string;
      exercises: readonly WorkoutExercisePrescription[];
      adjustments?: readonly WorkoutSessionAdjustment[];
    }
  | { kind: 'RECOVERY'; recovery: 'FULL_REST' | 'ACTIVE_RECOVERY' };

/** "Ajustado por iCoach: X → Y" — an excluded ingredient and its replacement (or none). */
export interface IngredientSubstitution {
  from: FoodId;
  to: FoodId | null;
}

export interface PlannedMeal {
  slot: MealSlot;
  foods: readonly MealPlanFood[];
  totals: MealMacros;
  substitutions?: readonly IngredientSubstitution[];
}

export interface PlanDay {
  /** YYYY-MM-DD */
  date: string;
  workout: PlannedWorkout;
  meals: readonly PlannedMeal[];
}

/**
 * The inputs that decide a plan and that, when changed, may regenerate it
 * mid-week (ADR-P042 D3). Stored with the plan so a later change can be named.
 */
export interface PlanInputs {
  goal: string;
  trainingDays: number;
  equipment: readonly string[];
  injuries: readonly string[];
  movementsToAvoid: readonly string[];
  excludedFoods: readonly string[];
  excludedTags: readonly string[];
}

export interface WeeklyPlanContent {
  contractVersion: typeof WEEKLY_PLAN_CONTRACT_VERSION;
  targets: PlanTargets;
  inputs: PlanInputs;
  days: readonly PlanDay[];
}

/** A language-neutral reason code, rendered only at the presentation boundary. */
export interface PlanNote {
  code: string;
  params?: Readonly<Record<string, string | number>>;
}

export interface WeeklyPlan {
  id: string;
  userId: string;
  weekStart: string;
  revision: number;
  effectiveFrom: string;
  trigger: PlanTrigger;
  loadStep: number;
  inputsFingerprint: string;
  ruleVersions: Readonly<Record<string, string>>;
  plan: WeeklyPlanContent;
  notes: readonly PlanNote[];
  version: number;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}
