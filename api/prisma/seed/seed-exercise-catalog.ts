import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import {
  deriveExerciseId,
  EXERCISE_REVISION,
  type BuiltInExerciseSeed,
} from '../../src/modules/workout/domain/exercise-identity';

/**
 * ADR-P015 Phase 16 — built-in exercise catalog seed ARTIFACT.
 *
 * Distribution, not a user write path: seeds the global built-in exercises into
 * PostgreSQL with stable UUIDv5 ids, byte-identical to the mobile bundle, so
 * `routine_exercises`/`workout_sets` can reference `exercise_id` at runtime.
 * BUG-053 (2026-11-17): it runs on every deploy as part of the release step
 * `npm run db:deploy` (migrations, the food-catalog seed, then this seed
 * compiled to dist/), like the food catalog since v8.1. Until then it was run
 * by hand only, and Railway's `exercises` table was empty: every workout set
 * came back `DEPENDENCY_NOT_READY` and stayed queued on the phone.
 * `npm run db:seed:exercises:src` still runs it from source.
 *
 * Behaviour:
 *   - Verifies every id === uuidv5(`key:EXERCISE_REVISION`) before writing.
 *   - Insert-only (upsert with `update: {}`): an existing row is a NO-OP, so a
 *     built-in row is never mutated and a user's CUSTOM exercise (different id,
 *     `createdBy` set) is never overwritten.
 *   - Seeds global reference data only (`createdBy = null`).
 */

// From source (ts-node) the JSON sits beside this file; compiled, this file is
// dist/prisma/seed/ and the image keeps the JSON in prisma/seed/.
const CATALOG_PATH = [
  join(__dirname, 'exercise-catalog.json'),
  join(__dirname, '..', '..', '..', 'prisma', 'seed', 'exercise-catalog.json'),
].find((path) => existsSync(path)) as string;

async function main(): Promise<void> {
  const catalog = JSON.parse(
    readFileSync(CATALOG_PATH, 'utf8'),
  ) as BuiltInExerciseSeed[];

  // Integrity preflight — refuse to seed if any id is not the deterministic
  // UUIDv5 of its (exercise_key, revision).
  for (const ex of catalog) {
    const expected = deriveExerciseId(ex.key, EXERCISE_REVISION);
    if (ex.id !== expected) {
      throw new Error(
        `Exercise id mismatch for ${ex.key}: ${ex.id} !== ${expected}`,
      );
    }
  }

  const connectionString =
    process.env.DATABASE_URL ??
    'postgresql://placeholder:placeholder@localhost:5433/appfitness_dev';
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  const before = await prisma.exercise.count();
  try {
    for (const ex of catalog) {
      await prisma.exercise.upsert({
        where: { id: ex.id },
        update: {}, // never overwrite an existing (built-in or custom) row
        create: {
          id: ex.id,
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          category: ex.category,
          instructions: ex.instructions,
          createdBy: null, // global built-in catalog
        },
      });
    }
    const after = await prisma.exercise.count();

    console.log(
      `Seeded built-in exercises: ${after - before} inserted, ${catalog.length} total.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
