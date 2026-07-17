import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  deriveExerciseId,
  EXERCISE_REVISION,
  WORKOUT_UUID_NAMESPACE,
  type BuiltInExerciseSeed,
} from './exercise-identity';

const CATALOG_PATH = join(
  __dirname,
  '../../../../prisma/seed/exercise-catalog.json',
);
const catalog = JSON.parse(
  readFileSync(CATALOG_PATH, 'utf8'),
) as BuiltInExerciseSeed[];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CATEGORIES = new Set(['STRENGTH', 'CARDIO', 'FLEXIBILITY', 'BODYWEIGHT']);

describe('built-in exercise identity (backend seed artifact)', () => {
  it('pins the workout UUIDv5 namespace (must match the mobile literal)', () => {
    expect(WORKOUT_UUID_NAMESPACE).toBe('a9d8c7b6-5e4f-5a3b-8c2d-1e0f9a8b7c6d');
    expect(EXERCISE_REVISION).toBe(1);
  });

  it('seeds a non-empty catalog', () => {
    expect(catalog.length).toBeGreaterThan(0);
  });

  it('every seed id === uuidv5(`key:revision`) — deterministic, mobile/backend parity', () => {
    for (const ex of catalog) {
      expect(ex.id).toBe(deriveExerciseId(ex.key, EXERCISE_REVISION));
      expect(ex.id).toMatch(UUID_RE);
    }
  });

  it('has unique ids and unique keys, and schema-valid categories', () => {
    const ids = catalog.map((e) => e.id);
    const keys = catalog.map((e) => e.key);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(keys).size).toBe(keys.length);
    for (const e of catalog) {
      expect(CATEGORIES.has(e.category)).toBe(true);
      expect(e.key).toMatch(/^exercise\.[a-z0-9_]+$/);
      expect(e.name.length).toBeGreaterThan(0);
      expect(e.muscleGroup.length).toBeGreaterThan(0);
    }
  });
});
