import { listAll } from '@/features/nutrition/application/food-catalog.service';
import { AVOID_TAGS } from '@/features/nutrition/domain/food-catalog';
import type { DietaryPreference } from '@/features/nutrition/domain/dietary-preference';
import type { Goal } from '@/features/profile/domain/goal.types';
import type { Profile } from '@/features/profile/domain/profile.types';
import type { WellnessSafetyProfile } from '@/features/wellness/domain/wellness-safety-profile';
import { WELLNESS_AFFECTED_AREAS } from '@/features/wellness/domain/wellness-safety-profile';

import {
  ageOn,
  decimalText,
  draftBmi,
  draftFromSources,
  equipmentToStore,
  goalChanged,
  INJURY_OPTIONS,
  isDraftComplete,
  isEvaluationOwed,
  parseDecimal,
  planDietaryChanges,
  stepIssues,
  toProfileInput,
  toWellnessInput,
  type EvaluationDraft,
  type EvaluationSources,
} from './evaluation';
import { FOOD_GROUPS, FOOD_ITEMS } from './food-groups';

const TODAY = '2026-10-28';

const profile = (over: Partial<Profile> = {}): Profile =>
  ({
    id: 'p',
    userId: 'u',
    birthDate: '1990-05-10',
    gender: 'FEMALE',
    heightCm: 165,
    fitnessLevel: 'INTERMEDIATE',
    yearsTraining: 1,
    activityLevel: 'LIGHT',
    occupation: null,
    sleepHoursBaseline: 6.5,
    stressLevelBaseline: 4,
    equipment: ['dumbbell', 'band'],
    trainingDaysPerWeek: 4,
    sessionDurationMins: 60,
    targetCalories: null,
    targetProteinG: null,
    targetCarbsG: null,
    targetFatG: null,
    version: 1,
    syncStatus: 'synced',
    updatedAt: '',
    ...over,
  }) as Profile;

const pref = (over: Partial<DietaryPreference>): DietaryPreference => ({
  id: 'x',
  userId: 'u',
  exclusionType: 'catalog_key',
  avoidTag: null,
  catalogKey: null,
  kind: 'allergy',
  hasNote: false,
  version: 1,
  syncStatus: 'synced',
  updatedAt: '',
  ...over,
});

const sources = (over: Partial<EvaluationSources> = {}): EvaluationSources => ({
  profile: null,
  goal: null,
  weightKg: null,
  wellness: null,
  preferences: [],
  today: TODAY,
  ...over,
});

const complete = (over: Partial<EvaluationDraft> = {}): EvaluationDraft => ({
  ...draftFromSources(sources()),
  weightKg: 80,
  heightCm: 175,
  birthDate: '1990-01-15',
  sex: 'MALE',
  targetWeightKg: 75,
  targetDate: '2027-03-01',
  ...over,
});

describe('food groups (ADR-P040 D3)', () => {
  it('names only foods the bundled catalog ships', () => {
    const ids = new Set(listAll().map((food) => food.id as string));
    const missing = FOOD_GROUPS.flatMap((group) =>
      group.items.flatMap((item) =>
        item.target.kind === 'catalog' ? item.target.keys.filter((key) => !ids.has(key)) : [],
      ),
    );
    expect(missing).toEqual([]);
  });

  it('uses only shipped avoid tags for "Otras restricciones"', () => {
    const other = FOOD_GROUPS.find((group) => group.id === 'other');
    expect(other?.items.map((item) => item.target)).toEqual(
      ['high_sodium_sensitive', 'high_purine', 'added_sugar', 'alcohol', 'caffeine', 'fried'].map(
        (tag) => ({ kind: 'tag', tag }),
      ),
    );
    for (const item of other?.items ?? []) {
      if (item.target.kind === 'tag') expect(AVOID_TAGS).toContain(item.target.tag);
    }
  });

  it("keeps the design's ten groups and unique item ids", () => {
    expect(FOOD_GROUPS).toHaveLength(10);
    const ids = FOOD_GROUPS.flatMap((group) => group.items.map((item) => item.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(FOOD_ITEMS.size).toBe(75);
  });
});

describe('draftFromSources', () => {
  it('starts a new account on the defaults (owner decision 6 lives in the profile input)', () => {
    const draft = draftFromSources(sources());
    expect(draft).toMatchObject({
      weightKg: null,
      evaluationDate: TODAY,
      injuries: [],
      foods: {},
      activityLevel: 'MODERATE',
      stressLevel: 3,
      sleepHours: 7,
      trainingDays: 3,
      equipment: ['bodyweight'],
      goalType: 'FAT_LOSS',
    });
    expect(toProfileInput(draft, null)).toMatchObject({
      fitnessLevel: 'BEGINNER',
      sessionDurationMins: 45,
    });
  });

  it('opens on the saved evaluation', () => {
    const wellness = {
      evaluationDate: '2026-10-01',
      affectedAreas: ['chest', 'knee'],
      movementsToAvoid: ['running'],
    } as unknown as WellnessSafetyProfile;
    const goal = {
      goalType: 'STRENGTH',
      targetWeightKg: 70,
      targetDate: '2027-01-01',
    } as Goal;
    const draft = draftFromSources(
      sources({
        profile: profile(),
        goal,
        weightKg: 68,
        wellness,
        preferences: [
          pref({ catalogKey: 'food.shrimp', kind: 'preference' }),
          pref({ exclusionType: 'avoid_tag', avoidTag: 'caffeine', kind: 'allergy' }),
        ],
      }),
    );
    expect(draft).toMatchObject({
      weightKg: 68,
      heightCm: 165,
      birthDate: '1990-05-10',
      sex: 'FEMALE',
      evaluationDate: '2026-10-01',
      injuries: ['knee'],
      foods: { shrimp: 'preference', caffeine: 'allergy' },
      activityLevel: 'LIGHT',
      stressLevel: 4,
      sleepHours: 6.5,
      trainingDays: 4,
      equipment: ['dumbbell', 'band'],
      goalType: 'STRENGTH',
      targetWeightKg: 70,
    });
  });

  it('reads a gym profile back as "Gimnasio completo"', () => {
    const draft = draftFromSources(sources({ profile: profile({ equipment: ['barbell'] }) }));
    expect(draft.equipment).toEqual(['gym']);
  });

  it('marks an item only when every food it names is excluded', () => {
    const draft = draftFromSources(
      sources({ preferences: [pref({ catalogKey: 'food.mixed_nuts' })] }),
    );
    expect(draft.foods).toEqual({});
  });
});

describe('equipment (owner decision 7)', () => {
  it('"Gimnasio completo" stores every piece of equipment', () => {
    expect(equipmentToStore(['gym'])).toEqual([
      'barbell',
      'dumbbell',
      'kettlebell',
      'machine',
      'cable',
      'bodyweight',
      'band',
    ]);
  });

  it('stores the chosen pieces in a stable order', () => {
    expect(equipmentToStore(['band', 'dumbbell'])).toEqual(['dumbbell', 'band']);
  });
});

describe('step validation', () => {
  it('asks for usable measurements within the engine bounds', () => {
    const draft = complete({ weightKg: 25, heightCm: null, birthDate: '2020-01-01' });
    expect(stepIssues('measures', draft, TODAY)).toEqual(['weight', 'height', 'birthDate']);
  });

  it('refuses a future assessment date and a past target date', () => {
    expect(stepIssues('measures', complete({ evaluationDate: '2026-10-29' }), TODAY)).toEqual([
      'evaluationDate',
    ]);
    expect(stepIssues('goal', complete({ targetDate: TODAY }), TODAY)).toEqual(['targetDate']);
  });

  it('needs at least one piece of equipment', () => {
    expect(stepIssues('lifestyle', complete({ equipment: [] }), TODAY)).toEqual(['equipment']);
  });

  it('accepts a complete draft', () => {
    expect(isDraftComplete(complete(), TODAY)).toBe(true);
  });

  it('computes age and BMI deterministically', () => {
    expect(ageOn('1990-10-29', TODAY)).toBe(35);
    expect(ageOn('1990-10-28', TODAY)).toBe(36);
    expect(draftBmi(complete({ weightKg: 80, heightCm: 175 }))).toBe(26.1);
    expect(draftBmi(complete({ heightCm: null }))).toBeNull();
  });

  it('parses decimals with a comma or a point', () => {
    expect(parseDecimal('72,5')).toBe(72.5);
    expect(parseDecimal('72.5')).toBe(72.5);
    expect(parseDecimal('72.')).toBe(72);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('7a')).toBeNull();
  });
});

describe('saving onto the existing model', () => {
  it('keeps areas the wizard does not offer and the declared movements', () => {
    const existing = {
      affectedAreas: ['chest', 'knee'],
      movementsToAvoid: ['running'],
    } as unknown as WellnessSafetyProfile;
    expect(toWellnessInput(complete({ injuries: ['shoulder'] }), existing)).toEqual({
      evaluationCompleted: true,
      evaluationDate: TODAY,
      affectedAreas: ['chest', 'shoulder'],
      movementsToAvoid: ['running'],
    });
  });

  it('offers only stored wellness areas', () => {
    for (const injury of INJURY_OPTIONS) {
      expect(WELLNESS_AFFECTED_AREAS as readonly string[]).toContain(injury);
    }
  });

  it('replaces the goal only when it changed', () => {
    const goal = { goalType: 'FAT_LOSS', targetWeightKg: 75, targetDate: '2027-03-01' } as Goal;
    expect(goalChanged(complete({ goalType: 'FAT_LOSS' }), goal)).toBe(false);
    expect(goalChanged(complete({ targetWeightKg: 74 }), goal)).toBe(true);
    expect(goalChanged(complete(), null)).toBe(true);
  });

  it('keeps an OTHER/UNDISCLOSED sex unless one is picked', () => {
    const existing = profile({ gender: 'UNDISCLOSED' });
    expect(toProfileInput(complete({ sex: null }), existing).gender).toBe('UNDISCLOSED');
    expect(toProfileInput(complete({ sex: 'MALE' }), existing).gender).toBe('MALE');
  });
});

describe('planDietaryChanges (ADR-P040 D4)', () => {
  it('adds one row per food an item names', () => {
    const change = planDietaryChanges(complete({ foods: { clams_mussels: 'allergy' } }), []);
    expect(change).toEqual({
      create: [
        { catalogKey: 'food.clams', kind: 'allergy' },
        { catalogKey: 'food.mussels', kind: 'allergy' },
      ],
      remove: [],
    });
  });

  it('excludes a shared food as an allergy when either item says so', () => {
    const change = planDietaryChanges(
      complete({ foods: { almonds: 'preference', pistachios: 'allergy' } }),
      [],
    );
    expect(change.create).toContainEqual({ catalogKey: 'food.mixed_nuts', kind: 'allergy' });
  });

  it('writes tags for "Otras restricciones"', () => {
    expect(planDietaryChanges(complete({ foods: { fried: 'preference' } }), []).create).toEqual([
      { avoidTag: 'fried', kind: 'preference' },
    ]);
  });

  it('keeps rows that already match, removes unmarked ones and recreates a changed kind', () => {
    const existing = [
      pref({ id: 'keep', catalogKey: 'food.shrimp', kind: 'allergy' }),
      pref({ id: 'drop', catalogKey: 'food.crab', kind: 'allergy' }),
      pref({ id: 'kind', catalogKey: 'food.lobster', kind: 'allergy' }),
    ];
    const change = planDietaryChanges(
      complete({ foods: { shrimp: 'allergy', lobster: 'preference' } }),
      existing,
    );
    expect(change).toEqual({
      create: [{ catalogKey: 'food.lobster', kind: 'preference' }],
      remove: ['drop', 'kind'],
    });
  });

  it('never touches rows the wizard cannot write', () => {
    const existing = [
      pref({ id: 'scallops', catalogKey: 'food.scallops' }),
      pref({ id: 'nuts', exclusionType: 'avoid_tag', avoidTag: 'nut_allergy' }),
    ];
    expect(planDietaryChanges(complete({ foods: {} }), existing)).toEqual({
      create: [],
      remove: [],
    });
  });

  it('is deterministic for identical input', () => {
    const draft = complete({ foods: { egg: 'allergy', rice: 'preference', fried: 'allergy' } });
    expect(planDietaryChanges(draft, [])).toEqual(planDietaryChanges(draft, []));
  });
});

describe('isEvaluationOwed', () => {
  const owedWith = (over: Parameters<typeof isEvaluationOwed>[0]) => isEvaluationOwed(over);
  const full = {
    profile: profile(),
    goal: {} as Goal,
    weightKg: 70,
    wellness: {} as WellnessSafetyProfile,
  };

  it('is owed until birth date, height, a weigh-in, a goal and a wellness profile exist', () => {
    expect(owedWith(full)).toBe(false);
    expect(owedWith({ ...full, profile: profile({ birthDate: null }) })).toBe(true);
    expect(owedWith({ ...full, profile: profile({ heightCm: null }) })).toBe(true);
    expect(owedWith({ ...full, weightKg: null })).toBe(true);
    expect(owedWith({ ...full, goal: null })).toBe(true);
    expect(owedWith({ ...full, wellness: null })).toBe(true);
  });
});

describe('decimalText', () => {
  it('shows a decimal comma in Spanish and a point in English', () => {
    expect(decimalText(82.5, 'es')).toBe('82,5');
    expect(decimalText(82.5, 'en')).toBe('82.5');
    expect(decimalText(null, 'es')).toBe('');
  });
});
