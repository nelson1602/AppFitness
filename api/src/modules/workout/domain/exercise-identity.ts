import { createHash } from 'node:crypto';

/**
 * Deterministic built-in exercise identity (ADR-P015 exercise identity/seed
 * slice) — the backend mirror of the mobile
 * `features/workout/domain/exercise-catalog.ts` constants. Same namespace +
 * same RFC 4122 v5 (SHA-1) algorithm as the nutrition catalog, so mobile and
 * Postgres seed byte-identical exercise ids.
 *
 * The namespace literal MUST stay identical to the mobile
 * `WORKOUT_UUID_NAMESPACE`.
 */
export const WORKOUT_UUID_NAMESPACE = 'a9d8c7b6-5e4f-5a3b-8c2d-1e0f9a8b7c6d';

/** Base immutable revision of a built-in exercise (bump = new id). */
export const EXERCISE_REVISION = 1;

/** RFC 4122 v5 (SHA-1) UUID — mirrors the nutrition catalog derivation. */
export function uuidv5(name: string, namespace: string): string {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  if (ns.length !== 16) throw new Error(`Invalid UUID namespace: ${namespace}`);
  const hash = createHash('sha1');
  hash.update(ns);
  hash.update(Buffer.from(name, 'utf8'));
  const bytes = hash.digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Deterministic exercise id from stable catalog key + immutable revision. */
export function deriveExerciseId(
  exerciseKey: string,
  revision: number,
): string {
  return uuidv5(`${exerciseKey}:${revision}`, WORKOUT_UUID_NAMESPACE);
}

/** A built-in exercise seed record (mirror of the mobile bundled catalog). */
export interface BuiltInExerciseSeed {
  id: string;
  key: string;
  name: string;
  muscleGroup: string;
  category: 'STRENGTH' | 'CARDIO' | 'FLEXIBILITY' | 'BODYWEIGHT';
  instructions: string | null;
}
