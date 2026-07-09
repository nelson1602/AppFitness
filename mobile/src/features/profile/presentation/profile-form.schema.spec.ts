import type { Profile } from '../domain/profile.types';
import {
  profileFormSchema,
  profileToFormValues,
  toProfileInput,
  type ProfileFormOutput,
} from './profile-form.schema';

/**
 * The schema is the single validation source of truth for the profile
 * form, and the two adapters bridge it to/from the domain shape. These
 * cover the required-field gates, the optional-blank handling that the UI
 * relies on (empty text inputs must not become NaN), and the round-trip
 * mapping used for edit prefill.
 */

const validValues = {
  birthDate: '1990-05-14',
  heightCm: '178',
  gender: 'MALE',
  fitnessLevel: 'INTERMEDIATE',
  activityLevel: 'MODERATE',
  yearsTraining: '',
  trainingDaysPerWeek: '',
  sessionDurationMins: '',
  sleepHoursBaseline: '',
  stressLevelBaseline: '',
  occupation: '',
  equipment: '',
};

describe('profileFormSchema', () => {
  it('accepts a minimal valid form and coerces height to a number', () => {
    const result = profileFormSchema.safeParse(validValues);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.heightCm).toBe(178);
      expect(typeof result.data.heightCm).toBe('number');
    }
  });

  it.each([
    ['1990-5-14', 'malformed date'],
    ['not-a-date', 'non-date string'],
    ['', 'empty date'],
  ])('rejects birthDate %p (%s)', (birthDate) => {
    const result = profileFormSchema.safeParse({ ...validValues, birthDate });
    expect(result.success).toBe(false);
  });

  it('rejects a syntactically valid but impossible date', () => {
    const result = profileFormSchema.safeParse({ ...validValues, birthDate: '2020-13-40' });
    expect(result.success).toBe(false);
  });

  it.each([
    ['0', 'zero'],
    ['-5', 'negative'],
    ['400', 'above max'],
    ['', 'blank'],
  ])('rejects heightCm %p (%s)', (heightCm) => {
    const result = profileFormSchema.safeParse({ ...validValues, heightCm });
    expect(result.success).toBe(false);
  });

  it('requires fitnessLevel and activityLevel', () => {
    const noFitness = profileFormSchema.safeParse({ ...validValues, fitnessLevel: undefined });
    const noActivity = profileFormSchema.safeParse({ ...validValues, activityLevel: undefined });
    expect(noFitness.success).toBe(false);
    expect(noActivity.success).toBe(false);
  });

  it('treats blank optional numbers as undefined rather than NaN', () => {
    const result = profileFormSchema.safeParse(validValues);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.yearsTraining).toBeUndefined();
      expect(result.data.trainingDaysPerWeek).toBeUndefined();
      expect(result.data.sleepHoursBaseline).toBeUndefined();
    }
  });

  it('validates optional numeric bounds when a value is present', () => {
    const tooManyDays = profileFormSchema.safeParse({ ...validValues, trainingDaysPerWeek: '8' });
    const badStress = profileFormSchema.safeParse({ ...validValues, stressLevelBaseline: '6' });
    expect(tooManyDays.success).toBe(false);
    expect(badStress.success).toBe(false);
  });
});

describe('toProfileInput', () => {
  const parsed = (overrides: Record<string, unknown> = {}): ProfileFormOutput => {
    const result = profileFormSchema.safeParse({ ...validValues, ...overrides });
    if (!result.success) throw new Error('fixture should parse');
    return result.data;
  };

  it('maps parsed output onto the domain ProfileInput shape', () => {
    const input = toProfileInput(parsed());
    expect(input.birthDate).toBe('1990-05-14');
    expect(input.heightCm).toBe(178);
    expect(input.gender).toBe('MALE');
    expect(input.fitnessLevel).toBe('INTERMEDIATE');
    expect(input.activityLevel).toBe('MODERATE');
  });

  it('splits comma-separated equipment into a trimmed, non-empty array', () => {
    const input = toProfileInput(parsed({ equipment: 'barbell, , dumbbell ,  ' }));
    expect(input.equipment).toEqual(['barbell', 'dumbbell']);
  });

  it('normalizes a blank occupation to null', () => {
    const input = toProfileInput(parsed({ occupation: '   ' }));
    expect(input.occupation).toBeNull();
  });

  it('maps an omitted gender to null', () => {
    const input = toProfileInput(parsed({ gender: undefined }));
    expect(input.gender).toBeNull();
  });
});

describe('profileToFormValues', () => {
  const profile: Profile = {
    id: 'p1',
    userId: 'u1',
    birthDate: '1988-01-02',
    gender: 'FEMALE',
    heightCm: 165,
    fitnessLevel: 'ADVANCED',
    yearsTraining: 6,
    activityLevel: 'ACTIVE',
    occupation: 'Nurse',
    sleepHoursBaseline: 7,
    stressLevelBaseline: 3,
    equipment: ['barbell', 'bands'],
    trainingDaysPerWeek: 5,
    sessionDurationMins: 60,
    targetCalories: null,
    targetProteinG: null,
    targetCarbsG: null,
    targetFatG: null,
    version: 2,
    syncStatus: 'synced',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };

  it('stringifies numeric fields for text inputs and joins equipment', () => {
    const values = profileToFormValues(profile);
    expect(values.birthDate).toBe('1988-01-02');
    expect(values.heightCm).toBe('165');
    expect(values.yearsTraining).toBe('6');
    expect(values.equipment).toBe('barbell, bands');
    expect(values.gender).toBe('FEMALE');
  });

  it('produces safe defaults for a null profile (create mode)', () => {
    const values = profileToFormValues(null);
    expect(values.birthDate).toBe('');
    expect(values.heightCm).toBe('');
    expect(values.fitnessLevel).toBe('INTERMEDIATE');
    expect(values.activityLevel).toBe('MODERATE');
    expect(values.equipment).toBe('');
  });

  it('round-trips a profile back through the schema without validation errors', () => {
    const values = profileToFormValues(profile);
    const result = profileFormSchema.safeParse(values);
    expect(result.success).toBe(true);
  });
});
