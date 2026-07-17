import { deriveExerciseId } from '../infrastructure/exercise-uuid.testkit';
import { BUILT_IN_EXERCISES, getBuiltInExerciseById } from '../infrastructure/exercise-catalog.data';
import { EXERCISE_REVISION, WORKOUT_UUID_NAMESPACE } from './exercise-catalog';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('built-in exercise identity', () => {
  it('pins the workout UUIDv5 namespace (must match the backend literal)', () => {
    // Locks mobile/backend parity: both derive ids under this same namespace.
    expect(WORKOUT_UUID_NAMESPACE).toBe('a9d8c7b6-5e4f-5a3b-8c2d-1e0f9a8b7c6d');
    expect(EXERCISE_REVISION).toBe(1);
  });

  it("every built-in id === uuidv5(`key:revision`) — deterministic + runtime-safe", () => {
    for (const e of BUILT_IN_EXERCISES) {
      expect(e.id).toBe(deriveExerciseId(e.key, EXERCISE_REVISION));
      expect(e.id).toMatch(UUID_RE); // RFC 4122 v5 shape
    }
  });

  it('has unique ids and unique keys (no collisions)', () => {
    const ids = BUILT_IN_EXERCISES.map((e) => e.id);
    const keys = BUILT_IN_EXERCISES.map((e) => e.key);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('resolves a built-in by its durable id', () => {
    const first = BUILT_IN_EXERCISES[0];
    expect(getBuiltInExerciseById(first.id)?.key).toBe(first.key);
    expect(getBuiltInExerciseById('00000000-0000-5000-8000-000000000000')).toBeUndefined();
  });
});
