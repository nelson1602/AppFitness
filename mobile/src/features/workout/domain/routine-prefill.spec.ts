import { routinePrefill } from './routine-prefill';
import type { RoutineExercise } from './workout';

const exercise = (o: Partial<RoutineExercise>): RoutineExercise => ({
  id: 're',
  userId: 'u1',
  routineId: 'r1',
  exerciseId: 'ex-1',
  order: 0,
  targetSets: 3,
  targetReps: 10,
  targetWeightKg: 40,
  version: 1,
  syncStatus: 'synced',
  createdAt: '',
  updatedAt: '',
  ...o,
});

describe('routinePrefill (v10 Block A: starting a saved routine)', () => {
  it('pre-fills one undone set per target set, in the routine order, with its targets', () => {
    const sets = routinePrefill([
      exercise({
        id: 'b',
        exerciseId: 'row',
        order: 1,
        targetSets: 1,
        targetReps: 12,
        targetWeightKg: null,
      }),
      exercise({ id: 'a', exerciseId: 'squat', order: 0, targetSets: 2 }),
    ]);
    expect(sets).toEqual([
      { exerciseId: 'squat', setNumber: 1, reps: 10, weightKg: 40, completed: false },
      { exerciseId: 'squat', setNumber: 2, reps: 10, weightKg: 40, completed: false },
      { exerciseId: 'row', setNumber: 3, reps: 12, weightKg: null, completed: false },
    ]);
  });

  it('gives an exercise without a target one set, and an empty routine nothing', () => {
    expect(routinePrefill([exercise({ targetSets: null })])).toHaveLength(1);
    expect(routinePrefill([])).toEqual([]);
  });
});
