import {
  addDietaryPreference,
  removeDietaryPreference,
} from '@/features/nutrition/application/dietary-preference.service';
import type { DietaryPreference } from '@/features/nutrition/domain/dietary-preference';
import { saveMyProfile, setMyGoal } from '@/features/profile';
import type { Goal } from '@/features/profile/domain/goal.types';
import { recordMyBodyWeight } from '@/features/progress';
import { saveMyWellnessSafetyProfile } from '@/features/wellness/application/wellness-safety-profile.service';

import {
  draftFromSources,
  type EvaluationDraft,
  type EvaluationSources,
} from '../domain/evaluation';
import { previewEvaluation, saveEvaluation } from './evaluation.service';

jest.mock('@/features/authentication', () => ({
  getSession: () => ({ user: { id: 'u1' } }),
  bindStoreToSession: jest.fn(),
}));
jest.mock('@/features/profile', () => ({
  getMyProfile: jest.fn(),
  getMyActiveGoal: jest.fn(),
  saveMyProfile: jest.fn(),
  setMyGoal: jest.fn(),
}));
jest.mock('@/features/progress', () => ({
  getMyLatestPhysicalAssessment: jest.fn(),
  recordMyBodyWeight: jest.fn(),
}));
jest.mock('@/features/wellness/application/wellness-safety-profile.service', () => ({
  getMyWellnessSafetyProfile: jest.fn(),
  saveMyWellnessSafetyProfile: jest.fn(),
}));
jest.mock('@/features/nutrition/application/dietary-preference.service', () => ({
  addDietaryPreference: jest.fn(),
  getMyDietaryPreferences: jest.fn(),
  removeDietaryPreference: jest.fn(),
}));

const TODAY = '2026-10-28';

const sources = (over: Partial<EvaluationSources> = {}): EvaluationSources => ({
  profile: null,
  goal: null,
  weightKg: null,
  wellness: null,
  preferences: [],
  today: TODAY,
  ...over,
});

const draft = (over: Partial<EvaluationDraft> = {}): EvaluationDraft => ({
  ...draftFromSources(sources()),
  weightKg: 80,
  heightCm: 175,
  birthDate: '1990-01-15',
  sex: 'MALE',
  targetWeightKg: 75,
  targetDate: '2027-03-01',
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe('saveEvaluation', () => {
  it('writes the profile, a weigh-in, the goal, the wellness profile and the exclusions', async () => {
    const order: string[] = [];
    jest.mocked(saveMyProfile).mockImplementation(async () => {
      order.push('profile');
      return {} as never;
    });
    jest.mocked(recordMyBodyWeight).mockImplementation(async () => {
      order.push('weight');
      return {} as never;
    });
    jest.mocked(setMyGoal).mockImplementation(async () => {
      order.push('goal');
      return {} as never;
    });
    jest.mocked(saveMyWellnessSafetyProfile).mockImplementation(async () => {
      order.push('wellness');
      return {} as never;
    });
    jest.mocked(removeDietaryPreference).mockImplementation(async () => {
      order.push('remove');
    });
    jest.mocked(addDietaryPreference).mockImplementation(async () => {
      order.push('add');
      return {} as never;
    });

    const existing = [
      { id: 'old', catalogKey: 'food.crab', avoidTag: null, kind: 'allergy' },
    ] as DietaryPreference[];
    await saveEvaluation(
      draft({ injuries: ['knee'], foods: { shrimp: 'allergy', caffeine: 'preference' } }),
      sources({ preferences: existing }),
    );

    expect(order).toEqual(['profile', 'weight', 'goal', 'wellness', 'remove', 'add', 'add']);
    expect(saveMyProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        birthDate: '1990-01-15',
        heightCm: 175,
        fitnessLevel: 'BEGINNER',
        sessionDurationMins: 45,
        equipment: ['bodyweight'],
      }),
    );
    expect(recordMyBodyWeight).toHaveBeenCalledWith({ date: TODAY, weightKg: 80 });
    expect(setMyGoal).toHaveBeenCalledWith({
      goalType: 'FAT_LOSS',
      targetWeightKg: 75,
      targetDate: '2027-03-01',
    });
    expect(saveMyWellnessSafetyProfile).toHaveBeenCalledWith(
      {
        evaluationCompleted: true,
        evaluationDate: TODAY,
        affectedAreas: ['knee'],
        movementsToAvoid: [],
      },
      TODAY,
    );
    expect(removeDietaryPreference).toHaveBeenCalledWith('old');
    expect(addDietaryPreference).toHaveBeenCalledWith({
      exclusionType: 'catalog_key',
      catalogKey: 'food.shrimp',
      kind: 'allergy',
    });
    expect(addDietaryPreference).toHaveBeenCalledWith({
      exclusionType: 'avoid_tag',
      avoidTag: 'caffeine',
      kind: 'preference',
    });
  });

  it('adds no weigh-in and keeps the goal row when neither changed', async () => {
    const goal = { goalType: 'FAT_LOSS', targetWeightKg: 75, targetDate: '2027-03-01' } as Goal;
    await saveEvaluation(draft(), sources({ weightKg: 80, goal }));
    expect(recordMyBodyWeight).not.toHaveBeenCalled();
    expect(setMyGoal).not.toHaveBeenCalled();
  });
});

describe('previewEvaluation (Revisión)', () => {
  it('runs the deterministic engine on the unsaved draft', () => {
    const preview = previewEvaluation(draft(), sources());
    expect(preview).not.toBeNull();
    expect(preview?.calories).toBeGreaterThan(1200);
    expect(preview?.trainingDays).toBe(3);
    expect(preview?.healthAdjustments).toBe(0);
    // Identical inputs, identical output.
    expect(previewEvaluation(draft(), sources())).toEqual(preview);
  });

  it('counts the movements left out for a declared injury', () => {
    const preview = previewEvaluation(draft({ injuries: ['knee'] }), sources());
    expect(preview?.healthAdjustments).toBeGreaterThan(0);
  });

  it('is unavailable while the draft cannot be assessed', () => {
    expect(previewEvaluation(draft({ heightCm: null }), sources())).toBeNull();
  });
});
