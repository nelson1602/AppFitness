import { BUILT_IN_EXERCISES } from '../infrastructure/exercise-catalog.data';
import { SPANISH_EXERCISE_NAMES } from '../infrastructure/exercise-catalog.es';
import { exerciseDisplayName } from './exercise-display.service';

describe('exerciseDisplayName', () => {
  it('keeps the canonical English catalog label', () => {
    expect(exerciseDisplayName('exercise.back_squat', 'en')).toBe('Back squat');
  });

  it('uses the Spanish label without changing the stable key', () => {
    expect(exerciseDisplayName('exercise.back_squat', 'es')).toBe('Sentadilla trasera');
  });

  it('covers every built-in exercise in the current catalog', () => {
    expect(Object.keys(SPANISH_EXERCISE_NAMES).sort()).toEqual(
      BUILT_IN_EXERCISES.map(({ key }) => key).sort(),
    );
  });

  it('returns an unknown stable key as a safe diagnostic fallback', () => {
    expect(exerciseDisplayName('exercise.unknown', 'es')).toBe('exercise.unknown');
  });
});
