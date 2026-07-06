import { analyzeRestrictions } from './restrictions';
import { planTraining } from './training';

const noRestrictions = analyzeRestrictions([]);

describe('training plan', () => {
  it('bases intensity and day caps on fitness level', () => {
    expect(planTraining('BEGINNER', 'GENERAL_HEALTH', noRestrictions)).toMatchObject({
      intensity: 'LOW',
      rpeCap: 6,
      daysPerWeek: 3,
    });
    expect(planTraining('INTERMEDIATE', 'GENERAL_HEALTH', noRestrictions)).toMatchObject({
      intensity: 'MODERATE',
      rpeCap: 8,
      daysPerWeek: 5,
    });
    expect(planTraining('ADVANCED', 'STRENGTH', noRestrictions)).toMatchObject({
      intensity: 'HIGH',
      rpeCap: 9,
      daysPerWeek: 6,
    });
  });

  it('caps preferred days at the level maximum, never raising them', () => {
    expect(planTraining('BEGINNER', 'STRENGTH', noRestrictions, undefined, 7).daysPerWeek).toBe(3);
    expect(planTraining('ADVANCED', 'STRENGTH', noRestrictions, undefined, 2).daysPerWeek).toBe(2);
  });

  it('REHABILITATION always trains LOW regardless of level', () => {
    expect(planTraining('ADVANCED', 'REHABILITATION', noRestrictions).intensity).toBe('LOW');
  });

  it('reduces intensity one step for poor sleep and again for high stress', () => {
    const advanced = planTraining('ADVANCED', 'STRENGTH', noRestrictions, { sleepHours: 5 });
    expect(advanced.intensity).toBe('MODERATE');

    const both = planTraining('ADVANCED', 'STRENGTH', noRestrictions, {
      sleepHours: 5,
      stressLevel: 5,
    });
    expect(both.intensity).toBe('LOW');

    const beginner = planTraining('BEGINNER', 'STRENGTH', noRestrictions, { sleepHours: 4 });
    expect(beginner.intensity).toBe('LOW'); // cannot go below LOW
  });

  it('MEDICAL OVERRIDE: restriction caps beat level and goal', () => {
    const severe = analyzeRestrictions([{ type: 'INJURY', severity: 'SEVERE' }]);
    const plan = planTraining('ADVANCED', 'STRENGTH', severe);
    expect(plan.intensity).toBe('LOW');
    expect(plan.rpeCap).toBe(6);
    expect(plan.requiresMedicalClearance).toBe(true);
  });

  it('MEDICAL OVERRIDE: a BP block zeroes the plan', () => {
    const blocked = analyzeRestrictions([], { systolic: 185, diastolic: 112 });
    const plan = planTraining('ADVANCED', 'STRENGTH', blocked);
    expect(plan.blocked).toBe(true);
    expect(plan.daysPerWeek).toBe(0);
    expect(plan.rpeCap).toBe(0);
  });

  it('propagates movement exclusions into the plan', () => {
    const knee = analyzeRestrictions([{ type: 'INJURY', bodyArea: 'knee', severity: 'MILD' }]);
    expect(planTraining('INTERMEDIATE', 'FAT_LOSS', knee).excludedMovements).toContain(
      'deep_squat',
    );
  });
});
