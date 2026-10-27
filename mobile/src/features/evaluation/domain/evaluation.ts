import type { DietaryPreference } from '@/features/nutrition/domain/dietary-preference';
import type { AvoidTag } from '@/features/nutrition/domain/food-catalog';
import type { Goal, GoalInput } from '@/features/profile/domain/goal.types';
import type { Profile, ProfileInput } from '@/features/profile/domain/profile.types';
import type { WellnessSafetyProfile } from '@/features/wellness/domain/wellness-safety-profile';
import type { WellnessSafetyProfileInput } from '@/features/wellness/domain/wellness-safety-profile.rules';
import type {
  ActivityLevel,
  DietaryPreferenceKind,
  GoalType,
} from '@/shared/infrastructure/database/types';

import { FOOD_ITEMS, WIZARD_AVOID_TAGS, WIZARD_CATALOG_KEYS } from './food-groups';

/**
 * The Evaluación física (design README "Evaluación física (6 pasos)").
 *
 * A draft is what the six steps edit. It maps onto the existing model — no
 * new entity: Medidas → profile + a weigh-in + the wellness evaluation date;
 * Salud → wellness affected areas; Alimentación → dietary preferences;
 * Estilo de vida → profile; Meta → the active goal. The design's medical
 * fields (conditions, blood pressure, pulse, medicines) stay out: public V1
 * does not collect clinical data (SECURITY-002, privacy policy).
 */

export const EVALUATION_STEPS = [
  'measures',
  'health',
  'food',
  'lifestyle',
  'goal',
  'review',
] as const;
export type EvaluationStep = (typeof EVALUATION_STEPS)[number];

/** The design's injury list, in its order; "Otra lesión" is out of v8. */
export const INJURY_OPTIONS = [
  'shoulder',
  'knee',
  'lower_back',
  'wrist',
  'elbow',
  'ankle',
  'hip',
  'neck',
  'muscle_tear',
  'shin_splints',
  'plantar_fasciitis',
] as const;
export type InjuryOption = (typeof INJURY_OPTIONS)[number];

export const ACTIVITY_OPTIONS: readonly ActivityLevel[] = [
  'SEDENTARY',
  'LIGHT',
  'MODERATE',
  'ACTIVE',
  'VERY_ACTIVE',
];

/** The design's seven goals; REHABILITATION is not offered. */
export const GOAL_OPTIONS: readonly GoalType[] = [
  'FAT_LOSS',
  'MUSCLE_GAIN',
  'RECOMPOSITION',
  'STRENGTH',
  'ENDURANCE',
  'GENERAL_HEALTH',
  'MAINTENANCE',
];

export const EQUIPMENT_OPTIONS = ['gym', 'dumbbell', 'band', 'bodyweight'] as const;
export type EquipmentOption = (typeof EQUIPMENT_OPTIONS)[number];

/** "Gimnasio completo" means every piece of equipment (owner decision 7). */
const GYM_EQUIPMENT = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'machine',
  'cable',
  'bodyweight',
  'band',
] as const;
const GYM_ONLY = new Set(['barbell', 'kettlebell', 'machine', 'cable']);

export const TRAINING_DAY_OPTIONS = [2, 3, 4, 5, 6] as const;
export const STRESS_OPTIONS = [1, 2, 3, 4, 5] as const;
export const SLEEP_MIN = 4;
export const SLEEP_MAX = 10;
export const SLEEP_STEP = 0.5;

/** Owner decision 6: new accounts start as beginners with 45-minute sessions. */
export const DEFAULT_FITNESS_LEVEL = 'BEGINNER' as const;
export const DEFAULT_SESSION_MINUTES = 45;

/** The engine's own input bounds (icoach/domain/engine.ts). */
export const BOUNDS = {
  weightKg: { min: 30, max: 400 },
  heightCm: { min: 100, max: 250 },
  age: { min: 13, max: 120 },
} as const;

export type FoodMark = DietaryPreferenceKind; // 'allergy' | 'preference'

export interface EvaluationDraft {
  weightKg: number | null;
  heightCm: number | null;
  birthDate: string | null;
  sex: 'FEMALE' | 'MALE' | null;
  evaluationDate: string;
  injuries: InjuryOption[];
  /** Item id (food-groups.ts) → how it is marked. */
  foods: Record<string, FoodMark>;
  activityLevel: ActivityLevel;
  stressLevel: number;
  sleepHours: number;
  trainingDays: number;
  equipment: EquipmentOption[];
  goalType: GoalType;
  targetWeightKg: number | null;
  targetDate: string | null;
}

export interface EvaluationSources {
  profile: Profile | null;
  goal: Goal | null;
  weightKg: number | null;
  wellness: WellnessSafetyProfile | null;
  preferences: readonly DietaryPreference[];
  today: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function equipmentFrom(stored: readonly string[]): EquipmentOption[] {
  if (stored.some((value) => GYM_ONLY.has(value))) return ['gym'];
  const picked = EQUIPMENT_OPTIONS.filter((option) => option !== 'gym' && stored.includes(option));
  return picked.length > 0 ? picked : ['bodyweight'];
}

/** Stored equipment for the chosen options, in the vocabulary's order. */
export function equipmentToStore(options: readonly EquipmentOption[]): string[] {
  if (options.includes('gym')) return [...GYM_EQUIPMENT];
  return GYM_EQUIPMENT.filter((value) => (options as readonly string[]).includes(value));
}

/** What each marked item needs, so reading back can tell a whole item from a partial one. */
function foodsFrom(preferences: readonly DietaryPreference[]): Record<string, FoodMark> {
  const byKey = new Map<string, FoodMark>();
  const byTag = new Map<string, FoodMark>();
  for (const preference of preferences) {
    if (preference.catalogKey) byKey.set(preference.catalogKey, preference.kind);
    if (preference.avoidTag) byTag.set(preference.avoidTag, preference.kind);
  }
  const foods: Record<string, FoodMark> = {};
  for (const [id, item] of FOOD_ITEMS) {
    if (item.target.kind === 'tag') {
      const mark = byTag.get(item.target.tag);
      if (mark) foods[id] = mark;
      continue;
    }
    // Marked only when every food the item names is excluded: an item whose
    // keys were partly excluded elsewhere (a shared mixed dish) stays unmarked.
    const marks = item.target.keys.map((key) => byKey.get(key));
    if (marks.every((mark) => mark !== undefined)) {
      foods[id] = marks.includes('allergy') ? 'allergy' : 'preference';
    }
  }
  return foods;
}

/** The wizard's starting point: the person's saved data, or the defaults. */
export function draftFromSources(sources: EvaluationSources): EvaluationDraft {
  const { profile, goal, wellness, today } = sources;
  const goalType = goal && GOAL_OPTIONS.includes(goal.goalType) ? goal.goalType : 'FAT_LOSS';
  return {
    weightKg: sources.weightKg,
    heightCm: profile?.heightCm ?? null,
    birthDate: profile?.birthDate ?? null,
    sex: profile?.gender === 'FEMALE' || profile?.gender === 'MALE' ? profile.gender : null,
    evaluationDate: wellness?.evaluationDate ?? today,
    injuries: INJURY_OPTIONS.filter((area) =>
      (wellness?.affectedAreas as readonly string[] | undefined)?.includes(area),
    ),
    foods: foodsFrom(sources.preferences),
    activityLevel: profile?.activityLevel ?? 'MODERATE',
    stressLevel: clamp(profile?.stressLevelBaseline ?? 3, 1, 5),
    sleepHours: clamp(profile?.sleepHoursBaseline ?? 7, SLEEP_MIN, SLEEP_MAX),
    trainingDays: clamp(profile?.trainingDaysPerWeek ?? 3, 2, 6),
    equipment: profile ? equipmentFrom(profile.equipment) : ['bodyweight'],
    goalType,
    targetWeightKg: goal?.targetWeightKg ?? null,
    targetDate: goal?.targetDate ?? null,
  };
}

/** Whole years between two `YYYY-MM-DD` dates. */
export function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

const inRange = (value: number | null, range: { min: number; max: number }) =>
  value !== null && Number.isFinite(value) && value >= range.min && value <= range.max;

export type StepIssue =
  | 'weight'
  | 'height'
  | 'birthDate'
  | 'evaluationDate'
  | 'equipment'
  | 'targetWeight'
  | 'targetDate';

/** What keeps a step from continuing; empty when it can. */
export function stepIssues(
  step: EvaluationStep,
  draft: EvaluationDraft,
  today: string,
): StepIssue[] {
  const issues: StepIssue[] = [];
  if (step === 'measures') {
    if (!inRange(draft.weightKg, BOUNDS.weightKg)) issues.push('weight');
    if (!inRange(draft.heightCm, BOUNDS.heightCm)) issues.push('height');
    if (!draft.birthDate || !inRange(ageOn(draft.birthDate, today), BOUNDS.age)) {
      issues.push('birthDate');
    }
    if (draft.evaluationDate > today) issues.push('evaluationDate');
  }
  if (step === 'lifestyle' && draft.equipment.length === 0) issues.push('equipment');
  if (step === 'goal') {
    if (!inRange(draft.targetWeightKg, BOUNDS.weightKg)) issues.push('targetWeight');
    if (!draft.targetDate || draft.targetDate <= today) issues.push('targetDate');
  }
  return issues;
}

/** A draft every step accepts. */
export function isDraftComplete(draft: EvaluationDraft, today: string): boolean {
  return EVALUATION_STEPS.every((step) => stepIssues(step, draft, today).length === 0);
}

/** BMI to one decimal, or null until weight and height are usable. */
export function draftBmi(draft: EvaluationDraft): number | null {
  if (!inRange(draft.weightKg, BOUNDS.weightKg) || !inRange(draft.heightCm, BOUNDS.heightCm)) {
    return null;
  }
  const meters = (draft.heightCm as number) / 100;
  return Math.round(((draft.weightKg as number) / (meters * meters)) * 10) / 10;
}

export function toProfileInput(draft: EvaluationDraft, existing: Profile | null): ProfileInput {
  return {
    birthDate: draft.birthDate,
    // A sex recorded elsewhere as OTHER/UNDISCLOSED is kept unless one is picked here.
    gender: draft.sex ?? existing?.gender ?? null,
    heightCm: draft.heightCm,
    fitnessLevel: existing?.fitnessLevel ?? DEFAULT_FITNESS_LEVEL,
    activityLevel: draft.activityLevel,
    sleepHoursBaseline: draft.sleepHours,
    stressLevelBaseline: draft.stressLevel,
    equipment: equipmentToStore(draft.equipment),
    trainingDaysPerWeek: draft.trainingDays,
    sessionDurationMins: existing?.sessionDurationMins || DEFAULT_SESSION_MINUTES,
  };
}

export function toGoalInput(draft: EvaluationDraft): GoalInput {
  return {
    goalType: draft.goalType,
    targetWeightKg: draft.targetWeightKg,
    targetDate: draft.targetDate,
  };
}

/** True when the goal row must change (a new goal closes the old one, ADR history). */
export function goalChanged(draft: EvaluationDraft, goal: Goal | null): boolean {
  return (
    !goal ||
    goal.goalType !== draft.goalType ||
    goal.targetWeightKg !== draft.targetWeightKg ||
    goal.targetDate !== draft.targetDate
  );
}

export function toWellnessInput(
  draft: EvaluationDraft,
  existing: WellnessSafetyProfile | null,
): WellnessSafetyProfileInput {
  // Areas the wizard does not offer (declared on the older screen) are kept.
  const offered = new Set<string>(INJURY_OPTIONS);
  const kept = (existing?.affectedAreas ?? []).filter((area) => !offered.has(area));
  return {
    evaluationCompleted: true,
    evaluationDate: draft.evaluationDate,
    affectedAreas: [...new Set([...kept, ...draft.injuries])].sort(),
    movementsToAvoid: existing?.movementsToAvoid ?? [],
  };
}

export interface DietaryChange {
  create: { catalogKey?: string; avoidTag?: AvoidTag; kind: FoodMark }[];
  remove: string[];
}

/**
 * The preference rows to add and remove so the saved exclusions equal the
 * draft's marks. A food shared by two items is excluded while either is
 * marked, as an allergy if either says so. Rows the wizard cannot write (other
 * keys and tags) are never touched.
 */
export function planDietaryChanges(
  draft: EvaluationDraft,
  existing: readonly DietaryPreference[],
): DietaryChange {
  const wantKeys = new Map<string, FoodMark>();
  const wantTags = new Map<AvoidTag, FoodMark>();
  const strongest = (a: FoodMark | undefined, b: FoodMark): FoodMark =>
    a === 'allergy' || b === 'allergy' ? 'allergy' : 'preference';

  for (const [id, mark] of Object.entries(draft.foods)) {
    const item = FOOD_ITEMS.get(id);
    if (!item) continue;
    if (item.target.kind === 'tag') {
      wantTags.set(item.target.tag, strongest(wantTags.get(item.target.tag), mark));
    } else {
      for (const key of item.target.keys) wantKeys.set(key, strongest(wantKeys.get(key), mark));
    }
  }

  const remove: string[] = [];
  const haveKeys = new Set<string>();
  const haveTags = new Set<string>();
  for (const preference of existing) {
    if (preference.catalogKey && WIZARD_CATALOG_KEYS.has(preference.catalogKey)) {
      const want = wantKeys.get(preference.catalogKey);
      if (want === preference.kind && !haveKeys.has(preference.catalogKey)) {
        haveKeys.add(preference.catalogKey);
      } else {
        remove.push(preference.id);
      }
    } else if (preference.avoidTag && WIZARD_AVOID_TAGS.has(preference.avoidTag)) {
      const want = wantTags.get(preference.avoidTag);
      if (want === preference.kind && !haveTags.has(preference.avoidTag)) {
        haveTags.add(preference.avoidTag);
      } else {
        remove.push(preference.id);
      }
    }
  }

  const create: DietaryChange['create'] = [];
  for (const [catalogKey, kind] of [...wantKeys].sort(([a], [b]) => a.localeCompare(b))) {
    if (!haveKeys.has(catalogKey)) create.push({ catalogKey, kind });
  }
  for (const [avoidTag, kind] of [...wantTags].sort(([a], [b]) => a.localeCompare(b))) {
    if (!haveTags.has(avoidTag)) create.push({ avoidTag, kind });
  }
  return { create, remove };
}

/**
 * Whether the first-run evaluation is still owed: the engine cannot plan
 * without birth date, height and a weigh-in, and the design asks every new
 * account for its goal and its injuries before the first plan.
 */
export function isEvaluationOwed(sources: {
  profile: Profile | null;
  goal: Goal | null;
  weightKg: number | null;
  wellness: WellnessSafetyProfile | null;
}): boolean {
  return (
    !sources.profile?.birthDate ||
    !sources.profile.heightCm ||
    !sources.weightKg ||
    !sources.goal ||
    !sources.wellness
  );
}

/** A typed decimal ("72,5" or "72.5"); null when empty or not a number. */
export function parseDecimal(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized) && !/^\d+\.$/.test(normalized)) return null;
  const value = Number(normalized.replace(/\.$/, ''));
  return Number.isFinite(value) ? value : null;
}

/** The draft value as a field shows it. */
export function decimalText(value: number | null): string {
  return value === null ? '' : String(value);
}
