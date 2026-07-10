import type { NutritionPlan } from '@/features/icoach';
import type {
  GoalType,
  RestrictionSeverity,
  RestrictionType,
} from '@/shared/infrastructure/database/types';

import type { AvoidTag, FoodId, FoodItem, ServingUnit } from './food-catalog';

/**
 * Deterministic 15-day meal routine types (Phase 15 Slice 3A).
 *
 * The engine's `NutritionPlan` is the authoritative calorie/macro source —
 * the generator only selects catalog foods and scales portions to
 * approximate it. Pure/deterministic: identical inputs → deep-equal
 * outputs. Descriptive, non-medical; no AI/LLM.
 */

export const MEAL_RULE_VERSION = 'meal-rules@1.0.0';

export type MealSlot = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';

export const MEAL_SLOTS: readonly MealSlot[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];

export interface MealMacros {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** A catalog food scaled to a serving multiple within a meal. */
export interface MealPlanFood {
  foodId: FoodId;
  name: string;
  /** Multiplier of the catalog serving (rounded to 0.25). */
  servings: number;
  /** Scaled portion (catalog serving amount × servings). */
  serving: { amount: number; unit: ServingUnit };
  /** Scaled macros contributed by this food. */
  macros: MealMacros;
}

export interface MealPlanMeal {
  slot: MealSlot;
  foods: MealPlanFood[];
  /** Slot sub-target (share of the daily target). */
  targets: MealMacros;
  totals: MealMacros;
  rationale: string;
}

export interface MealPlanRationale {
  ruleVersion: string;
  /** How the day's foods relate to the calorie/macro/goal targets. */
  summary: string;
  /** True when the engine raised calories to a safe minimum. */
  safetyFloorApplied: boolean;
  notes: string[];
}

export interface MealPlanDay {
  /** 1-based day index. */
  day: number;
  meals: MealPlanMeal[];
  targets: MealMacros;
  totals: MealMacros;
  rationale: MealPlanRationale;
}

/** Minimal restriction shape the generator reads (decoupled from features). */
export interface RestrictionRef {
  type: RestrictionType;
  bodyArea?: string | null;
  severity?: RestrictionSeverity | null;
}

export interface MealPlanInput {
  /** Authoritative calorie/macro targets from the iCoach engine. */
  nutritionPlan: NutritionPlan;
  goalType: GoalType;
  activeRestrictions: readonly RestrictionRef[];
  catalog: readonly FoodItem[];
  /** Stable seed — same seed + inputs → deep-equal plan. */
  seed: string;
  /** Plan length in days (default 15). */
  days?: number;
  /**
   * Explicit avoidFor exclusions (e.g., a future dietary-preference source
   * or tests). Unioned with any tags derived from `activeRestrictions`.
   */
  excludeAvoidTags?: readonly AvoidTag[];
}

export interface MealPlan {
  ruleVersion: string;
  catalogVersion: string;
  goalType: GoalType;
  /** Per-day target (identical each day — from the engine). */
  targets: MealMacros;
  /** avoidFor tags excluded from selection (restrictions + explicit). */
  excludedAvoidTags: AvoidTag[];
  days: MealPlanDay[];
  rationale: string;
}
