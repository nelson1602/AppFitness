import { getSession } from '@/features/authentication';
import { loadDashboardData } from '@/features/dashboard/application/dashboard.service';
import type { DashboardAssessment } from '@/features/dashboard/domain/dashboard.types';
import { ENGINE_RULE_VERSION } from '@/features/icoach/domain/rule-versions';
import { INJURY_MAP_VERSION } from '@/features/icoach/domain/injury-movement-map';
import { absoluteCalorieFloor } from '@/features/icoach/domain/nutrition';
import type { GeneratedWorkoutRoutine } from '@/features/icoach/domain/workout-routine';
import { WORKOUT_ROUTINE_RULE_VERSION } from '@/features/icoach/domain/workout-routine-generator';
import { normalizeTrainingEquipment } from '@/features/icoach/domain/workout-routine';
import { listAll } from '@/features/nutrition/application/food-catalog.service';
import { generateMealPlan } from '@/features/nutrition/application/meal-generator';
import {
  buildMealSeed,
  toMealExclusions,
} from '@/features/nutrition/application/meal-plan.service';
import { CATALOG_VERSION, type FoodId } from '@/features/nutrition/domain/food-catalog';
import {
  MEAL_RULE_VERSION,
  type MealPlan,
  type RestrictionRef,
} from '@/features/nutrition/domain/meal-plan';
import { listActiveDietaryPreferences } from '@/features/nutrition/infrastructure/dietary-preference.repository';
import { getMyProfile } from '@/features/profile';
import { selectWorkoutRoutine } from '@/features/workout/application/workout-routine.service';
import { EXERCISE_CATALOG_VERSION } from '@/features/workout/domain/exercise-catalog';

import { ADHERENCE_RULE_VERSION } from '../domain/adherence';
import { OFF_PLAN_RULE_VERSION } from '../domain/off-plan';
import { PROGRESSION_RULE_VERSION } from '../domain/progression';
import {
  WEEKLY_PLAN_CONTRACT_VERSION,
  type PlanInputs,
  type PlanTargets,
} from '../domain/weekly-plan';

/** Days of meals the generator produces: 7 frozen + 8 preview (ADR-P042 D9). */
export const MEAL_PLAN_DAYS = 15;

export const PLAN_RULE_VERSIONS: Readonly<Record<string, string>> = {
  contract: WEEKLY_PLAN_CONTRACT_VERSION,
  engine: ENGINE_RULE_VERSION,
  workout: WORKOUT_ROUTINE_RULE_VERSION,
  meals: MEAL_RULE_VERSION,
  foodCatalog: CATALOG_VERSION,
  exerciseCatalog: EXERCISE_CATALOG_VERSION,
  injuryMap: INJURY_MAP_VERSION,
  progression: PROGRESSION_RULE_VERSION,
  adherence: ADHERENCE_RULE_VERSION,
  offPlan: OFF_PLAN_RULE_VERSION,
};

/** Everything a plan is built from, read once from the person's local data. */
export interface PlanContext {
  userId: string;
  assessment: DashboardAssessment;
  routine: GeneratedWorkoutRoutine;
  /** With the person's exclusions; 15 days. */
  mealPlan: MealPlan;
  /** Same seed, no exclusions — used only to name substitutions. */
  unrestrictedMealPlan: MealPlan | null;
  isExcluded: (foodId: FoodId) => boolean;
  targets: PlanTargets;
  inputs: PlanInputs;
}

export type PlanContextResult =
  | { status: 'ready'; context: PlanContext }
  | { status: 'gap' }
  | { status: 'error'; reason: 'routine' };

/**
 * Gather the plan's inputs from the same sources the dashboard uses: the
 * deterministic assessment, the profile, the person's food exclusions and
 * their wellness declaration. No clock beyond `now`, no randomness.
 */
export async function gatherPlanContext(now: Date): Promise<PlanContextResult> {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');
  const userId = session.user.id;

  const [data, profile, preferences] = await Promise.all([
    loadDashboardData(now),
    getMyProfile(),
    listActiveDietaryPreferences(userId),
  ]);
  const assessment = data.assessment;
  if (!assessment || !profile) return { status: 'gap' };

  const selection = selectWorkoutRoutine(assessment, {
    equipment: profile.equipment,
    sessionDurationMins: profile.sessionDurationMins,
    excludedMovements: assessment.assessment.training.excludedMovements,
  });
  if (selection.status !== 'ready') {
    return selection.status === 'gap' ? { status: 'gap' } : { status: 'error', reason: 'routine' };
  }

  const { engineInput } = assessment;
  const { avoidTags, catalogKeys } = toMealExclusions(preferences);
  const seed = buildMealSeed(
    userId,
    engineInput.goal,
    engineInput.subject.weightKg,
    avoidTags,
    catalogKeys,
  );
  const common = {
    nutritionPlan: assessment.assessment.nutrition,
    goalType: engineInput.goal,
    activeRestrictions: engineInput.restrictions as readonly RestrictionRef[],
    catalog: listAll(),
    seed,
    days: MEAL_PLAN_DAYS,
  };
  const mealPlan = generateMealPlan({
    ...common,
    excludeAvoidTags: avoidTags,
    excludeCatalogKeys: catalogKeys,
  });
  const anyExclusion = avoidTags.length > 0 || catalogKeys.length > 0;
  const unrestrictedMealPlan = anyExclusion ? generateMealPlan(common) : null;

  const foods = new Map(listAll().map((food) => [food.id, food]));
  const excludedKeys = new Set<string>(catalogKeys);
  const excludedTags = new Set<string>(avoidTags);
  const isExcluded = (foodId: FoodId): boolean =>
    excludedKeys.has(foodId) ||
    (foods.get(foodId)?.avoidFor ?? []).some((tag) => excludedTags.has(tag));

  const nutrition = assessment.assessment.nutrition;
  const targets: PlanTargets = {
    calories: nutrition.calories,
    proteinG: nutrition.proteinG,
    carbsG: nutrition.carbsG,
    fatG: nutrition.fatG,
    floorCalories: Math.max(
      absoluteCalorieFloor(engineInput.subject.sex),
      assessment.assessment.metabolics.bmr,
    ),
  };
  const inputs: PlanInputs = {
    goal: engineInput.goal,
    trainingDays: assessment.assessment.training.daysPerWeek,
    equipment: normalizeTrainingEquipment(profile.equipment).equipment,
    injuries: engineInput.wellness?.affectedAreas ?? [],
    movementsToAvoid: engineInput.wellness?.movementsToAvoid ?? [],
    excludedFoods: catalogKeys,
    excludedTags: avoidTags,
  };

  return {
    status: 'ready',
    context: {
      userId,
      assessment,
      routine: selection.routine,
      mealPlan,
      unrestrictedMealPlan,
      isExcluded,
      targets,
      inputs,
    },
  };
}
