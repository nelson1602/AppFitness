import { parseDietaryPreferenceUpdate } from '../../nutrition/domain/dietary-preference-payload';
import { parseBodyWeightCreate } from '../../progress/domain/progress-payload';
import {
  parseExerciseCreate,
  parseRoutineCreate,
} from '../../workout/domain/workout-payload';

/**
 * ADR-P046: every text field a sync payload carries has a maximum length, so
 * a client cannot store unbounded text through an entity handler.
 */
describe('sync payload text limits (ADR-P046)', () => {
  it('workout names and texts', () => {
    expect(() =>
      parseRoutineCreate({ name: 'x'.repeat(201), description: null }),
    ).toThrow('at most 200');
    expect(() =>
      parseRoutineCreate({ name: 'Rutina', description: 'x'.repeat(2001) }),
    ).toThrow('at most 2000');
    expect(() =>
      parseExerciseCreate({
        name: 'Sentadilla',
        muscle_group: 'x'.repeat(201),
        category: 'STRENGTH',
        instructions: null,
      }),
    ).toThrow('at most 200');
    expect(
      parseRoutineCreate({ name: 'Rutina', description: 'ok' }),
    ).toMatchObject({
      name: 'Rutina',
    });
  });

  it('progress notes', () => {
    expect(() =>
      parseBodyWeightCreate({
        date: '2026-11-16',
        weight_kg: 80,
        notes: 'x'.repeat(2001),
      }),
    ).toThrow('at most 2000');
  });

  it('dietary-preference notes', () => {
    expect(() =>
      parseDietaryPreferenceUpdate({
        kind: 'preference',
        note: 'x'.repeat(1001),
      }),
    ).toThrow('at most 1000');
  });
});
