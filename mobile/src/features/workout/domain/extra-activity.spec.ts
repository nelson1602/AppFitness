import {
  ACTIVITY_MET,
  activityKcal,
  activityMinutes,
  activityTypeFromName,
  describeActivity,
  EXTRA_ACTIVITY_RULE_VERSION,
  FULL_BODY,
  MAX_ACTIVITY_MINUTES,
  minutesFromName,
  type ActivityLogInput,
} from './extra-activity';

const log = (overrides: Partial<ActivityLogInput> = {}): ActivityLogInput => ({
  id: 'w1',
  name: 'Correr 15 min',
  startedAt: '2026-11-04T12:00:00.000Z',
  finishedAt: '2026-11-04T12:00:10.000Z',
  localDate: '2026-11-04',
  ...overrides,
});

describe('extra activity (ADR-P040 Addendum v10-A, extra-activity@1.0.0)', () => {
  it('is versioned', () => {
    expect(EXTRA_ACTIVITY_RULE_VERSION).toBe('extra-activity@1.0.0');
  });

  it('reads the type from whole words of the name, accents and case ignored', () => {
    expect(activityTypeFromName('Correr 15 min')).toBe('running');
    expect(activityTypeFromName('Caminata en el malecón')).toBe('walking');
    expect(activityTypeFromName('BICICLETA estática')).toBe('cycling');
    expect(activityTypeFromName('Natación')).toBe('swimming');
    expect(activityTypeFromName('Levantamiento de pesas')).toBe('strength');
    expect(activityTypeFromName('Yoga')).toBe('flexibility');
    expect(activityTypeFromName('Corredor de fondo')).toBe('other');
    expect(activityTypeFromName('Mi entrenamiento')).toBe('other');
  });

  it('reads minutes written in the name, in minutes or hours', () => {
    expect(minutesFromName('Correr 15 min')).toBe(15);
    expect(minutesFromName('Bici 40 minutos')).toBe(40);
    expect(minutesFromName('Nadar 1 hora')).toBe(60);
    expect(minutesFromName('Pesas')).toBeNull();
  });

  it('prefers named minutes, then elapsed time, then 2 minutes per set; clamps 1–240', () => {
    expect(activityMinutes(log(), 0)).toBe(15);
    expect(activityMinutes(log({ name: 'Pesas', finishedAt: '2026-11-04T12:31:00.000Z' }), 4)).toBe(
      31,
    );
    expect(activityMinutes(log({ name: 'Pesas' }), 6)).toBe(12);
    expect(activityMinutes(log({ name: 'Pesas', finishedAt: null }), 0)).toBeNull();
    expect(activityMinutes(log({ name: 'Correr 900 min' }), 0)).toBe(MAX_ACTIVITY_MINUTES);
  });

  it('computes NET kcal = (MET − 1) × kg × hours, rounded', () => {
    // Running 15 min at 70 kg: (8 − 1) × 70 × 0.25 = 122.5 → 123.
    expect(activityKcal('running', 15, 70)).toBe(123);
    expect(activityKcal('strength', 60, 80)).toBe(Math.round((ACTIVITY_MET.strength - 1) * 80));
    expect(activityKcal('other', 30, 70)).toBe(0);
    expect(activityKcal('running', null, 70)).toBeNull();
    expect(activityKcal('running', 15, null)).toBeNull();
  });

  it('lets the logged sets decide the type and muscle groups over the name', () => {
    const activity = describeActivity(
      log({ name: 'Correr' }),
      [
        { category: 'STRENGTH', muscleGroup: 'quadriceps' },
        { category: 'STRENGTH', muscleGroup: 'glutes' },
        { category: 'CARDIO', muscleGroup: 'full_body' },
      ],
      70,
    );
    expect(activity.type).toBe('strength');
    expect(activity.kind).toBe('strength');
    expect(activity.muscleGroups).toEqual(['glutes', 'quadriceps']);
  });

  it('assumes the whole body for strength with no named muscle and no sets', () => {
    expect(describeActivity(log({ name: 'Levantamiento de pesas' }), [], 70).muscleGroups).toEqual([
      FULL_BODY,
    ]);
    expect(describeActivity(log({ name: 'Pesas de piernas' }), [], 70).muscleGroups).toEqual([
      'glutes',
      'hamstrings',
      'quadriceps',
    ]);
  });

  it('describes "Correr 15 min" as a done cardio activity with time and kcal', () => {
    expect(describeActivity(log(), [], 70)).toEqual({
      id: 'w1',
      name: 'Correr 15 min',
      date: '2026-11-04',
      startedAt: '2026-11-04T12:00:00.000Z',
      finishedAt: '2026-11-04T12:00:10.000Z',
      status: 'done',
      type: 'running',
      kind: 'cardio',
      muscleGroups: [],
      minutes: 15,
      kcal: 123,
    });
    expect(describeActivity(log({ finishedAt: null }), [], 70).status).toBe('in_progress');
  });

  it('is deterministic: identical inputs give identical activities', () => {
    expect(describeActivity(log(), [], 70)).toEqual(describeActivity(log(), [], 70));
  });
});
