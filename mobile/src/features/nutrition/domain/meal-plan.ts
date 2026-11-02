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

/**
 * `1.2.0` (v8, owner decision 2026-10-27): realistic portions. Oils, nuts,
 * seeds and nut butters stay at one catalog serving; the snack at two; in
 * breakfast, lunch and dinner no food carries more than ~40 % of the meal;
 * lunch and dinner have four foods.
 *
 * `1.3.0` (v8 Block 3, owner decision 2026-10-27): a snack is at least
 * 100 kcal. When the day cannot fit that under its ceiling (1.05× the
 * target), the snack is dropped and the main meals take its calories.
 *
 * `1.4.0` (v8 Block 3, owner decision 2026-10-27): a vegetable never goes
 * above three servings in any pass, so it is never the day's filler.
 *
 * `1.5.0` (v8.1, owner decision 2026-11-02): a person whose country is the
 * Dominican Republic gets named Dominican dishes (`dominican-dishes.ts`) with
 * household portions, scaled to each meal's target under the same portion
 * rules; an excluded ingredient is swapped for one of the same role or left
 * out ("Ajustado por iCoach"). A multi-food snack grows on its smallest food
 * to reach the snack minimum. Every other country keeps the food-based plan.
 */
export const MEAL_RULE_VERSION = 'meal-rules@1.5.0';

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
  /**
   * v8.1 (meal-rules@1.5.0), dish plans only: the dish's own ingredient this
   * food replaced because the person excluded it — rendered as "(cambio del
   * iCoach)". Absent on an unchanged line and on every food-based plan.
   */
  swappedFrom?: FoodId;
}

/** "Ajustado por iCoach: X → Y" — an excluded dish ingredient and its replacement, or null when left out. */
export interface MealAdjustment {
  from: FoodId;
  to: FoodId | null;
}

export interface MealPlanMeal {
  slot: MealSlot;
  /**
   * v8.1 (meal-rules@1.5.0), dish plans only: the Dominican dish this meal is
   * (`dominican-dishes.ts` id) and its catalogue name key
   * (`nutrition.dish.<id>`, ES/EN). Absent on food-based plans and on plans
   * saved before v8.1.
   */
  dishId?: string;
  dishNameKey?: string;
  /** Dish plans only: what the iCoach swapped or left out, in dish order. */
  adjustments?: MealAdjustment[];
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
   * Explicit avoidFor exclusions (dietary-preference/allergy source — ADR-P014
   * Slice 3 — or tests). Unioned with any tags derived from
   * `activeRestrictions`.
   */
  excludeAvoidTags?: readonly AvoidTag[];
  /**
   * Explicit per-food exclusions by catalog key/id (dietary-preference source,
   * ADR-P014 Slice 3). Any food whose catalog id is listed is removed from
   * every selection pool.
   */
  excludeCatalogKeys?: readonly FoodId[];
  /**
   * v8.1: the person's country (ISO 3166-1 alpha-2). 'DO' selects the
   * Dominican dish plan; anything else, or absent, the food-based plan.
   */
  country?: string;
}

export interface MealPlan {
  ruleVersion: string;
  catalogVersion: string;
  goalType: GoalType;
  /** Per-day target (identical each day — from the engine). */
  targets: MealMacros;
  /** avoidFor tags excluded from selection (restrictions + explicit). */
  excludedAvoidTags: AvoidTag[];
  /** Catalog keys/ids of foods excluded explicitly (per-food preferences). */
  excludedCatalogKeys: FoodId[];
  days: MealPlanDay[];
  rationale: string;
}
