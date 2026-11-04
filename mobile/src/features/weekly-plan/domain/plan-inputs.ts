import type { PlanInputs, PlanTargets } from './weekly-plan';

/**
 * The plan's deciding inputs (ADR-P042 D3): normalized, fingerprinted, and
 * compared. Pure and deterministic.
 */

/** The changes that may regenerate the current week, once the person confirms. */
export type PlanInputChange =
  | 'goal'
  | 'trainingDays'
  | 'equipment'
  | 'injuries'
  | 'excludedFoods'
  | 'country'
  /** A plan saved before v8.1 can now use the Dominican dishes; nothing was changed. */
  | 'dishPlan';

/**
 * What the change prompt can offer: an input change, one more training day
 * (ADR-P040 D11), or new targets after a weigh-in or an evaluation change
 * (ADR-P040 Addendum v10-A R6).
 */
export type PlanChange = PlanInputChange | 'moreDays' | 'targets';

/** R6: a calorie target this far from the saved one is a change worth asking about. */
export const TARGETS_CHANGE_KCAL = 50;
/** R6: likewise for any macro target, in grams. */
export const TARGETS_CHANGE_GRAMS = 10;

/**
 * R6 (ADR-P040 Addendum v10-A): whether the targets recomputed from today's
 * data (latest weigh-in, evaluation) differ enough from the saved week's to
 * offer "¿Actualizar tu plan?". Smaller drifts are not worth a new revision.
 */
export function targetsChanged(saved: PlanTargets, now: PlanTargets): boolean {
  return (
    Math.abs(saved.calories - now.calories) >= TARGETS_CHANGE_KCAL ||
    Math.abs(saved.proteinG - now.proteinG) >= TARGETS_CHANGE_GRAMS ||
    Math.abs(saved.carbsG - now.carbsG) >= TARGETS_CHANGE_GRAMS ||
    Math.abs(saved.fatG - now.fatG) >= TARGETS_CHANGE_GRAMS
  );
}

export const PLAN_INPUT_CHANGES: readonly PlanInputChange[] = [
  'goal',
  'trainingDays',
  'equipment',
  'injuries',
  'excludedFoods',
  'country',
  'dishPlan',
];

const sorted = (values: readonly string[]): string[] => [...new Set(values)].sort();

/** Order-free, duplicate-free inputs, so equal choices always compare equal. */
export function normalizePlanInputs(inputs: PlanInputs): PlanInputs {
  return {
    goal: inputs.goal,
    trainingDays: inputs.trainingDays,
    equipment: sorted(inputs.equipment),
    injuries: sorted(inputs.injuries),
    movementsToAvoid: sorted(inputs.movementsToAvoid),
    excludedFoods: sorted(inputs.excludedFoods),
    excludedTags: sorted(inputs.excludedTags),
    // v8.1: present only when the plan recorded it, so older fingerprints and
    // comparisons are unchanged.
    ...(inputs.country !== undefined ? { country: inputs.country } : {}),
  };
}

/** FNV-1a 32-bit, hex — stable across platforms, no crypto dependency. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** A short fingerprint of the inputs plus the rule versions that read them. */
export function planInputsFingerprint(
  inputs: PlanInputs,
  ruleVersions: Readonly<Record<string, string>>,
): string {
  const versions = Object.keys(ruleVersions)
    .sort()
    .map((key) => `${key}=${ruleVersions[key]}`);
  return fnv1a(JSON.stringify({ inputs: normalizePlanInputs(inputs), versions }));
}

const same = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * Which important inputs differ (ADR-P042 D3). Movements declared directly
 * count as an injury change; excluded tags count as excluded foods.
 */
export function changedPlanInputs(before: PlanInputs, after: PlanInputs): PlanInputChange[] {
  const a = normalizePlanInputs(before);
  const b = normalizePlanInputs(after);
  const changes: PlanInputChange[] = [];
  if (a.goal !== b.goal) changes.push('goal');
  if (a.trainingDays !== b.trainingDays) changes.push('trainingDays');
  if (!same(a.equipment, b.equipment)) changes.push('equipment');
  if (!same(a.injuries, b.injuries) || !same(a.movementsToAvoid, b.movementsToAvoid)) {
    changes.push('injuries');
  }
  if (!same(a.excludedFoods, b.excludedFoods) || !same(a.excludedTags, b.excludedTags)) {
    changes.push('excludedFoods');
  }
  // v8.1: a plan saved before the country existed was food-based. When the
  // country now asks for the Dominican dish plan, that is offered as the new
  // dish plan — the person changed nothing (round 2, item 7). Any other
  // country keeps the food-based plan.
  if (a.country === undefined) {
    if (b.country === 'DO') changes.push('dishPlan');
  } else if (b.country !== undefined && a.country !== b.country) {
    changes.push('country');
  }
  return changes;
}
