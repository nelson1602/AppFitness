import {
  createGoalFormSchema,
  goalToFormValues,
  toGoalInput,
} from '@/features/profile/presentation/goal-form.schema';
import {
  createProfileFormSchema,
  profileToFormValues,
  toProfileInput,
} from '@/features/profile/presentation/profile-form.schema';
import type { Goal } from '@/features/profile/domain/goal.types';
import type { Profile } from '@/features/profile/domain/profile.types';

import {
  createBodyMeasurementFormSchema,
  createBodyWeightFormSchema,
  toBodyMeasurementInput,
  toBodyWeightInput,
} from './progress-forms.schema';
import { parseTodayWeight } from './ProgressTabPanels';

/**
 * v10 Block C, item 9: every weight and length the person types in lb / in /
 * ft-in is stored in kg and cm, and the stored-unit limits still hold.
 */
describe('typed in lb / ft-in, stored in kg / cm', () => {
  it("records today's weight typed in lb as kg", () => {
    expect(parseTodayWeight('160', 'imperial')).toEqual({
      ok: true,
      weightKg: expect.closeTo(72.575, 3),
    });
    // The 1000 kg limit, in lb.
    expect(parseTodayWeight('2300', 'imperial')).toEqual({ ok: false, reason: 'tooLarge' });
    expect(parseTodayWeight('70,5')).toEqual({ ok: true, weightKg: 70.5 });
  });

  it('saves a body weight typed in lb as kg', () => {
    const values = createBodyWeightFormSchema(undefined, 'imperial').parse({
      date: '2026-11-10',
      weightKg: '176.4',
      notes: '',
    });
    expect(toBodyWeightInput(values, 'imperial').weightKg).toBeCloseTo(80.014, 3);
  });

  it('saves measurements typed in inches and lb as cm and kg', () => {
    const values = createBodyMeasurementFormSchema(undefined, 'imperial').parse({
      date: '2026-11-10',
      waistCm: '32',
      hipCm: '',
      chestCm: '',
      bodyFatPct: '18',
      muscleMassKg: '77',
      notes: '',
    });
    const input = toBodyMeasurementInput(values, 'imperial');
    expect(input.waistCm).toBeCloseTo(81.28, 2);
    expect(input.hipCm).toBeNull();
    expect(input.bodyFatPct).toBe(18);
    expect(input.muscleMassKg).toBeCloseTo(34.927, 3);
  });

  it('keeps the 500 cm limit for a length typed in inches', () => {
    const schema = createBodyMeasurementFormSchema(undefined, 'imperial');
    const base = { date: '2026-11-10', hipCm: '', chestCm: '', bodyFatPct: '', notes: '' };
    expect(schema.safeParse({ ...base, waistCm: '196', muscleMassKg: '' }).success).toBe(true);
    expect(schema.safeParse({ ...base, waistCm: '197', muscleMassKg: '' }).success).toBe(false);
  });

  it('edits the goal weight in lb and stores kg', () => {
    const goal = { goalType: 'FAT_LOSS', targetWeightKg: 68, targetDate: null } as unknown as Goal;
    expect(goalToFormValues(goal, 'imperial').targetWeightKg).toBe('149.9');
    const values = createGoalFormSchema(undefined, 'imperial').parse({
      goalType: 'FAT_LOSS',
      targetWeightKg: '150',
      targetDate: '',
    });
    expect(toGoalInput(values, 'imperial').targetWeightKg).toBeCloseTo(68.039, 3);
  });

  it('edits the height in feet and inches and stores cm', () => {
    const profile = { heightCm: 170, birthDate: '1990-01-15' } as unknown as Profile;
    const prefill = profileToFormValues(profile, 'imperial');
    expect([prefill.heightCm, prefill.heightIn]).toEqual(['5', '7']);
    const values = createProfileFormSchema(undefined, 'imperial').parse({
      ...profileToFormValues(profile, 'imperial'),
      fitnessLevel: 'INTERMEDIATE',
      activityLevel: 'MODERATE',
    });
    expect(toProfileInput(values, 'imperial').heightCm).toBeCloseTo(170.18, 2);
    // Metric is unchanged: the field holds centimetres.
    expect(profileToFormValues(profile).heightCm).toBe('170');
  });
});
