import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import {
  deriveFoodId,
  type CanonicalFood,
} from '../../src/modules/nutrition/catalog/catalog-identity';

/**
 * ADR-P012 Slice 4A — nutrition catalog seed ARTIFACT.
 *
 * Distribution, not a user write path: it seeds the global bundled catalog into
 * PostgreSQL, byte-identical to the mobile bundle (food-catalog.canonical.json).
 * It is NOT wired into any auto-run hook — a human runs `npm run db:seed`
 * against a real database deliberately. Behaviour:
 *   - Verifies every id === uuidv5(catalog_key:food_revision) before writing.
 *   - Insert-new-revisions-only: on an existing id it is a NO-OP, so an existing
 *     immutable catalog revision is never overwritten (ADR-P012).
 *   - Never deletes and never edits historical revisions.
 */

const CANONICAL_PATH = join(__dirname, 'food-catalog.canonical.json');

async function main(): Promise<void> {
  const catalog = JSON.parse(
    readFileSync(CANONICAL_PATH, 'utf8'),
  ) as CanonicalFood[];

  // Integrity preflight — refuse to seed if any id is not the deterministic
  // UUIDv5 of its (catalog_key, food_revision).
  for (const food of catalog) {
    const expected = deriveFoodId(food.catalogKey, food.foodRevision);
    if (food.id !== expected) {
      throw new Error(
        `Canonical id mismatch for ${food.catalogKey}@${food.foodRevision}: ${food.id} !== ${expected}`,
      );
    }
  }

  const connectionString =
    process.env.DATABASE_URL ??
    'postgresql://placeholder:placeholder@localhost:5433/appfitness_dev';
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  const before = await prisma.food.count();
  try {
    for (const food of catalog) {
      await prisma.food.upsert({
        where: { id: food.id },
        // Immutable revision: do nothing if the revision already exists.
        update: {},
        create: {
          id: food.id,
          catalogKey: food.catalogKey,
          foodRevision: food.foodRevision,
          catalogVersion: food.catalogVersion,
          name: food.name,
          servingAmount: food.servingAmount,
          servingUnit: food.servingUnit,
          gramsPerServing: food.gramsPerServing,
          caloriesPerServing: food.caloriesPerServing,
          proteinPerServing: food.proteinPerServing,
          carbsPerServing: food.carbsPerServing,
          fatPerServing: food.fatPerServing,
          fiberPerServing: food.fiberPerServing,
          isVerified: true,
        },
      });
    }
    // Accurate insert count via row-count delta (upsert with update:{} is a
    // no-op on an existing immutable revision, so it cannot be inferred from
    // per-row timestamps).
    const inserted = (await prisma.food.count()) - before;
    // eslint-disable-next-line no-console
    console.log(
      `Seeded catalog: ${catalog.length} revisions processed, ${inserted} newly inserted.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
