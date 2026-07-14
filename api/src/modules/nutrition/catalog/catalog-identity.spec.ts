import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  canonicalHash,
  deriveFoodId,
  deriveServingSnapshot,
  uuidv5,
  type CanonicalFood,
} from './catalog-identity';

/**
 * ADR-P012 Slice 4A — server-side catalog identity + mobile/server parity.
 *
 * The golden UUID literals and CATALOG_CONTENT_HASH below are the cross-package
 * contract: the mobile suite asserts the SAME literals against the SAME data, so
 * matching here proves mobile and server derive byte-identical catalog ids and
 * per-serving snapshots. Any drift in either package's canonical data or
 * derivation flips one of these assertions.
 */

const CANONICAL_PATH = join(
  __dirname,
  '../../../../prisma/seed/food-catalog.canonical.json',
);
const CATALOG = JSON.parse(
  readFileSync(CANONICAL_PATH, 'utf8'),
) as readonly CanonicalFood[];

// Cross-package golden anchors (identical to the mobile suite): key, immutable
// revision, derived id. egg_whole is a revision-2 anchor (TECHDEBT-004 risk 3
// normalization); the others are revision 1.
const GOLDEN = [
  {
    key: 'food.chicken_breast',
    revision: 1,
    id: '16cb6cd9-debe-55fd-b39e-aac043b8705e',
  },
  {
    key: 'food.egg_whole',
    revision: 2,
    id: 'ccd3b52a-5a8b-5ce9-b115-5f64b24b361e',
  },
  {
    key: 'food.brown_rice',
    revision: 1,
    id: '6491c19f-e35b-556e-92ae-4703226b376a',
  },
];
const EXPECTED_CATALOG_HASH = 'd22651ec0f95c8224a4a9c334c7c79a91329e4f5';

describe('catalog identity (uuidv5)', () => {
  it('matches the RFC 4122 v5 reference vector', () => {
    expect(
      uuidv5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'),
    ).toBe('2ed6657d-e927-568b-95e1-2665a8aea6a2');
  });

  it('derives the golden ids from catalog_key:food_revision', () => {
    for (const g of GOLDEN) {
      expect(deriveFoodId(g.key, g.revision)).toBe(g.id);
    }
  });

  it('is revision-scoped — a new revision mints a different id', () => {
    expect(deriveFoodId('food.chicken_breast', 2)).not.toBe(
      deriveFoodId('food.chicken_breast', 1),
    );
  });

  it('rejects a malformed namespace', () => {
    expect(() => uuidv5('x', 'not-a-uuid')).toThrow(/Invalid UUID namespace/);
  });
});

describe('canonical catalog seed artifact', () => {
  it('contains 300 foods', () => {
    expect(CATALOG).toHaveLength(300);
  });

  it('every id equals uuidv5(catalog_key:food_revision) — server derivation', () => {
    for (const food of CATALOG) {
      expect(food.id).toBe(deriveFoodId(food.catalogKey, food.foodRevision));
    }
  });

  it('matches the golden ids and the cross-package content hash', () => {
    for (const g of GOLDEN) {
      expect(CATALOG.find((f) => f.catalogKey === g.key)?.id).toBe(g.id);
    }
    expect(canonicalHash(CATALOG)).toBe(EXPECTED_CATALOG_HASH);
  });

  it('has unique (catalog_key, food_revision) and unique ids', () => {
    const keys = new Set(
      CATALOG.map((f) => `${f.catalogKey}:${f.foodRevision}`),
    );
    const ids = new Set(CATALOG.map((f) => f.id));
    expect(keys.size).toBe(CATALOG.length);
    expect(ids.size).toBe(CATALOG.length);
  });

  it('records grams_per_serving only where a valid gram conversion exists', () => {
    for (const food of CATALOG) {
      if (food.servingUnit === 'g') {
        expect(food.gramsPerServing).toBe(food.servingAmount);
      } else if (food.foodRevision === 2) {
        // Normalized count-unit food (TECHDEBT-004 risk 3): 1 piece + an
        // authored, non-fabricated gram weight.
        expect(food.servingUnit).toBe('piece');
        expect(food.servingAmount).toBe(1);
        expect(food.gramsPerServing).toBeGreaterThan(0);
      } else {
        expect(food.gramsPerServing).toBeNull();
      }
    }
  });
});

describe('serving snapshot derivation (server)', () => {
  it('derives the immutable per-serving snapshot for a known food', () => {
    const chicken = CATALOG.find(
      (f) => f.catalogKey === 'food.chicken_breast',
    )!;
    expect(deriveServingSnapshot(chicken)).toEqual({
      foodNameSnapshot: 'Chicken breast, cooked',
      catalogKeySnapshot: 'food.chicken_breast',
      foodRevisionSnapshot: 1,
      catalogVersionSnapshot: 'food-catalog@1.1.0',
      servingAmountSnapshot: 100,
      servingUnitSnapshot: 'g',
      gramsPerServingSnapshot: 100,
      caloriesPerServingSnapshot: 160,
      proteinPerServingSnapshot: 31,
      carbsPerServingSnapshot: 0,
      fatPerServingSnapshot: 4,
      fiberPerServingSnapshot: null,
    });
  });
});
