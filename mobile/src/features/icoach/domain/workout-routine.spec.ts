import {
  normalizeTrainingEquipment,
  TRAINING_EQUIPMENT,
  WORKOUT_ROUTINE_CONTRACT_VERSION,
  type GeneratedWorkoutRoutine,
} from './workout-routine';

describe('workout routine public-v1 contract', () => {
  it('uses stable language-neutral version and equipment ids', () => {
    expect(WORKOUT_ROUTINE_CONTRACT_VERSION).toBe('workout-routine-contract@1.0.0');
    expect(TRAINING_EQUIPMENT).toEqual([
      'barbell',
      'dumbbell',
      'kettlebell',
      'machine',
      'cable',
      'bodyweight',
      'none',
    ]);
  });

  it('normalizes legacy English and Spanish equipment values deterministically', () => {
    const first = normalizeTrainingEquipment([
      ' Dumbbells ',
      'BARRA',
      'pesas rusas',
      'Máquinas',
      'Polea',
      'peso_corporal',
      'sin-equipo',
      'dumbbell',
    ]);
    const second = normalizeTrainingEquipment([
      ' Dumbbells ',
      'BARRA',
      'pesas rusas',
      'Máquinas',
      'Polea',
      'peso_corporal',
      'sin-equipo',
      'dumbbell',
    ]);

    expect(first).toEqual(second);
    expect(first).toEqual({ equipment: TRAINING_EQUIPMENT, unsupported: [] });
  });

  it('retains unsupported values without guessing or duplicating them', () => {
    expect(normalizeTrainingEquipment(['bench', '', ' resistance bands ', 'bench'])).toEqual({
      equipment: [],
      unsupported: ['bench', 'resistance bands'],
    });
  });

  it('can represent every required directly usable routine component', () => {
    const routine: GeneratedWorkoutRoutine = {
      contractVersion: WORKOUT_ROUTINE_CONTRACT_VERSION,
      ruleVersion: 'icoach-workout-rules@1.0.0',
      exerciseCatalogVersion: 'exercise-catalog@0.1.0',
      schedule: [
        { weekday: 'MONDAY', kind: 'TRAINING', sessionKey: 'session.full_body_a' },
        { weekday: 'TUESDAY', kind: 'RECOVERY', recovery: 'ACTIVE_RECOVERY' },
      ],
      sessions: [
        {
          key: 'session.full_body_a',
          focusKey: 'workout.focus.full_body',
          exercises: [
            {
              exerciseKey: 'exercise.goblet_squat',
              sets: 3,
              target: { kind: 'REPETITIONS', min: 8, max: 12 },
              restSeconds: 90,
              targetRpe: 7,
              substitutions: [
                {
                  exerciseKey: 'exercise.walking_lunge',
                  compatibleEquipment: ['bodyweight'],
                },
              ],
              explanationKeys: ['workout.explanation.goal_and_level'],
            },
          ],
        },
      ],
      progression: [
        {
          id: 'progression.double.full_body_a',
          strategy: 'DOUBLE_PROGRESSION',
          appliesToExerciseKeys: ['exercise.goblet_squat'],
          requiredSuccessfulSessions: 2,
          loadIncreasePct: 5,
          repetitionIncrease: null,
          durationIncreaseSeconds: null,
          explanationKey: 'workout.progression.double',
        },
      ],
      explanationKeys: ['workout.plan.goal.general_health'],
    };

    expect(routine.schedule).toContainEqual(
      expect.objectContaining({ kind: 'RECOVERY', recovery: 'ACTIVE_RECOVERY' }),
    );
    expect(routine.sessions[0]?.exercises[0]).toMatchObject({
      sets: 3,
      restSeconds: 90,
      targetRpe: 7,
      target: { kind: 'REPETITIONS', min: 8, max: 12 },
    });
    expect(routine.sessions[0]?.exercises[0]?.substitutions).toHaveLength(1);
    expect(routine.progression[0]?.strategy).toBe('DOUBLE_PROGRESSION');
  });
});
