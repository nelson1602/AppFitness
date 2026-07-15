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
// revision, derived id. egg_whole is a part-1 revision-2 anchor (TECHDEBT-004
// risk 3 normalization), rye_bread an ADR-P013 Batch-1 revision-2 anchor
// (FDC-sourced grams), brown_rice an ADR-P013 Batch-3A cup-food anchor,
// broccoli an ADR-P013 Batch-3B cup-vegetable anchor, strawberries an
// ADR-P013 Batch-3C cup-fruit anchor, and olive_oil an ADR-P013 Batch-4
// tbsp-remainder anchor.
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
    key: 'food.rye_bread',
    revision: 2,
    id: 'f5997bf5-a983-5eea-86e0-71440ec899a1',
  },
  {
    key: 'food.hummus',
    revision: 2,
    id: '1a1f1b52-87db-5673-961a-5a042b9f004d',
  },
  {
    key: 'food.butter',
    revision: 2,
    id: 'e4fd7208-a77b-55dc-9b56-afcc3445597e',
  },
  {
    key: 'food.brown_rice',
    revision: 2,
    id: 'ca8102b8-1ef9-5672-8d29-8a8d307ee3b7',
  },
  {
    key: 'food.broccoli',
    revision: 2,
    id: '5dec7664-4730-51eb-b33d-8aeb68ac0b74',
  },
  {
    key: 'food.strawberries',
    revision: 2,
    id: '7f718148-11cc-5d5d-a0d7-6523dcc55336',
  },
  {
    key: 'food.olive_oil',
    revision: 2,
    id: '86cb6064-1102-5af0-80e3-b81ff49ee32a',
  },
  {
    key: 'food.milk_skim',
    revision: 2,
    id: '120ff999-602c-50fd-82c6-f934a7c7059b',
  },
  {
    key: 'food.green_tea',
    revision: 2,
    id: 'ad132750-29b2-531d-a02f-59bbb658b1a1',
  },
  {
    key: 'food.lemon_juice',
    revision: 2,
    id: 'cfbd1b33-00c0-5f80-a79c-9dd7c9a98df9',
  },
  {
    key: 'food.poppy_seeds',
    revision: 2,
    id: 'cd24d2e9-8b80-5986-9f28-458a2ff9f2e1',
  },
  {
    key: 'food.polenta',
    revision: 2,
    id: '3e81adb5-b68c-59bf-a16a-a8f9d6ac64b5',
  },
  {
    key: 'food.pesto',
    revision: 2,
    id: '554c9b45-140d-551c-84f1-ea42f9909f6d',
  },
  {
    key: 'food.tzatziki',
    revision: 2,
    id: 'a16f145a-1bd3-5329-a09f-c43ef8459006',
  },
  {
    key: 'food.sourdough_bread',
    revision: 2,
    id: '40d78a50-c12d-5690-a0ee-d4f1729963d9',
  },
  {
    key: 'food.onion',
    revision: 2,
    id: '5e52c0e4-aa09-53e7-be82-8805012a63eb',
  },
  {
    key: 'food.snow_peas',
    revision: 2,
    id: '879b2c10-96c7-56a9-b342-8a3d1490b3f1',
  },
  {
    key: 'food.leeks',
    revision: 2,
    id: '91800356-773c-52d7-bca1-f6966d1daee9',
  },
  {
    key: 'food.pomegranate',
    revision: 2,
    id: '764bf1c8-895c-5f30-bb18-922a6d29a7b9',
  },
];
const EXPECTED_CATALOG_HASH = 'b04436ddbd97ce716011d4778f62d1c82303bacc';

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
        // Revision-2 count-unit food with a known, non-fabricated gram weight:
        // part-1 `piece` foods (amount 1), ADR-P013 Batch-1/2/3A
        // `slice`/`tbsp`/`cup` foods, or tsp-semantics `tsp` foods (authored count kept;
        // FDC-sourced full-serving weight).
        expect(['piece', 'slice', 'tbsp', 'tsp', 'cup', 'ml']).toContain(
          food.servingUnit,
        );
        if (food.servingUnit === 'piece') expect(food.servingAmount).toBe(1);
        else expect(food.servingAmount).toBeGreaterThan(0);
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
      catalogVersionSnapshot: 'food-catalog@1.13.4',
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
