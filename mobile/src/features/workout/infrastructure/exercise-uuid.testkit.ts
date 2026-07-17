import { uuidv5 } from '@/features/nutrition/infrastructure/catalog/catalog-uuid.testkit';

import { WORKOUT_UUID_NAMESPACE } from '../domain/exercise-catalog';

/**
 * TEST-ONLY built-in exercise identity derivation (ADR-P015 exercise
 * identity/seed slice). Imported only by `*.spec.ts` — the app bundle ships
 * precomputed static ids and carries no UUID derivation at runtime (mirrors
 * the nutrition catalog-uuid testkit). Reuses that pure-JS RFC 4122 v5
 * implementation so mobile derivation is identical to the backend's Node-crypto
 * derivation under the shared `WORKOUT_UUID_NAMESPACE`.
 */
export function deriveExerciseId(key: string, revision: number): string {
  return uuidv5(`${key}:${revision}`, WORKOUT_UUID_NAMESPACE);
}
