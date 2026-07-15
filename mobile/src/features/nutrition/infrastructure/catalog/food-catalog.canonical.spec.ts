import { CATALOG_VERSION } from '../../domain/food-catalog';
import { normalizeServing } from '../../domain/catalog-identity';
import { FOOD_CATALOG } from '../food-catalog.data';
import { CANONICAL_FOOD_CATALOG, CATALOG_CONTENT_HASH } from './food-catalog.canonical';
import { buildCanonicalCatalog, canonicalHash, deriveFoodId, uuidv5 } from './catalog-uuid.testkit';

/**
 * ADR-P012 Slice 4A — mobile catalog identity + mobile/server parity.
 *
 * The GOLDEN_IDS and EXPECTED_CATALOG_HASH literals below are identical to the
 * API suite (api/.../catalog/catalog-identity.spec.ts). Because both packages
 * derive ids from the same fixed namespace + `${key}:${revision}` input and
 * assert the SAME literals against the SAME committed data, matching in both
 * suites proves mobile and server derive byte-identical catalog ids and
 * per-serving snapshots. This also guards the committed artifact against drift
 * from the authored FOOD_CATALOG source of truth.
 */

// Cross-package golden anchors (key, immutable revision, derived id). egg_whole
// is a part-1 revision-2 anchor (TECHDEBT-004 risk 3 normalization) and
// rye_bread an ADR-P013 Batch-1 revision-2 anchor (FDC-sourced grams); the
// others are revision 1 — proving both packages derive rev-1 and rev-2 ids
// identically.
const GOLDEN = [
  { key: 'food.chicken_breast', revision: 1, id: '16cb6cd9-debe-55fd-b39e-aac043b8705e' },
  { key: 'food.egg_whole', revision: 2, id: 'ccd3b52a-5a8b-5ce9-b115-5f64b24b361e' },
  { key: 'food.rye_bread', revision: 2, id: 'f5997bf5-a983-5eea-86e0-71440ec899a1' },
  { key: 'food.hummus', revision: 2, id: '1a1f1b52-87db-5673-961a-5a042b9f004d' },
  { key: 'food.butter', revision: 2, id: 'e4fd7208-a77b-55dc-9b56-afcc3445597e' },
  { key: 'food.brown_rice', revision: 2, id: 'ca8102b8-1ef9-5672-8d29-8a8d307ee3b7' },
  { key: 'food.broccoli', revision: 2, id: '5dec7664-4730-51eb-b33d-8aeb68ac0b74' },
  { key: 'food.strawberries', revision: 2, id: '7f718148-11cc-5d5d-a0d7-6523dcc55336' },
  { key: 'food.olive_oil', revision: 2, id: '86cb6064-1102-5af0-80e3-b81ff49ee32a' },
  { key: 'food.milk_skim', revision: 2, id: '120ff999-602c-50fd-82c6-f934a7c7059b' },
  { key: 'food.green_tea', revision: 2, id: 'ad132750-29b2-531d-a02f-59bbb658b1a1' },
  { key: 'food.lemon_juice', revision: 2, id: 'cfbd1b33-00c0-5f80-a79c-9dd7c9a98df9' },
  { key: 'food.poppy_seeds', revision: 2, id: 'cd24d2e9-8b80-5986-9f28-458a2ff9f2e1' },
  { key: 'food.polenta', revision: 2, id: '3e81adb5-b68c-59bf-a16a-a8f9d6ac64b5' },
  { key: 'food.pesto', revision: 2, id: '554c9b45-140d-551c-84f1-ea42f9909f6d' },
  { key: 'food.tzatziki', revision: 2, id: 'a16f145a-1bd3-5329-a09f-c43ef8459006' },
  { key: 'food.sourdough_bread', revision: 2, id: '40d78a50-c12d-5690-a0ee-d4f1729963d9' },
];
const EXPECTED_CATALOG_HASH = '91c9899930ba60a288cfe3853216966a164157a2';

describe('uuidv5 derivation', () => {
  it('matches the RFC 4122 v5 reference vector', () => {
    expect(uuidv5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(
      '2ed6657d-e927-568b-95e1-2665a8aea6a2',
    );
  });

  it('derives the golden ids and is revision-scoped', () => {
    for (const g of GOLDEN) {
      expect(deriveFoodId(g.key, g.revision)).toBe(g.id);
    }
    expect(deriveFoodId('food.chicken_breast', 2)).not.toBe(
      GOLDEN.find((g) => g.key === 'food.chicken_breast')!.id,
    );
  });

  it('rejects a malformed namespace', () => {
    expect(() => uuidv5('x', 'nope')).toThrow(/Invalid UUID namespace/);
  });
});

describe('committed canonical artifact', () => {
  it('equals buildCanonicalCatalog(FOOD_CATALOG) — no drift from source of truth', () => {
    expect(CANONICAL_FOOD_CATALOG).toEqual(buildCanonicalCatalog(FOOD_CATALOG));
  });

  it('has one revision per authored food (300) with unique keys and ids', () => {
    expect(CANONICAL_FOOD_CATALOG).toHaveLength(FOOD_CATALOG.length);
    expect(CANONICAL_FOOD_CATALOG).toHaveLength(300);
    const keys = new Set(CANONICAL_FOOD_CATALOG.map((f) => `${f.catalogKey}:${f.foodRevision}`));
    const ids = new Set(CANONICAL_FOOD_CATALOG.map((f) => f.id));
    expect(keys.size).toBe(300);
    expect(ids.size).toBe(300);
  });

  it('every id equals uuidv5(catalog_key:food_revision)', () => {
    for (const food of CANONICAL_FOOD_CATALOG) {
      expect(food.id).toBe(deriveFoodId(food.catalogKey, food.foodRevision));
    }
  });

  it('matches the golden ids and the cross-package content hash', () => {
    for (const g of GOLDEN) {
      expect(CANONICAL_FOOD_CATALOG.find((f) => f.catalogKey === g.key)?.id).toBe(g.id);
    }
    expect(CATALOG_CONTENT_HASH).toBe(EXPECTED_CATALOG_HASH);
    expect(canonicalHash(CANONICAL_FOOD_CATALOG)).toBe(EXPECTED_CATALOG_HASH);
  });

  it('carries the current catalog version and stamps every food with it', () => {
    for (const food of CANONICAL_FOOD_CATALOG) {
      expect(food.catalogVersion).toBe(CATALOG_VERSION);
    }
  });
});

describe('serving normalization policy', () => {
  it('records grams_per_serving only where a valid gram conversion exists', () => {
    for (const food of CANONICAL_FOOD_CATALOG) {
      if (food.servingUnit === 'g') {
        // Gram serving: grams === the amount. Most are base revision; butter/ghee
        // are revision 2 because this mini-slice corrected their mislabeled
        // tsp(N grams) serving semantics to gram servings.
        expect(food.gramsPerServing).toBe(food.servingAmount);
      } else if (food.foodRevision === 2) {
        // Revision-2 count-unit food with a known gram weight — never
        // fabricated. Part 1: `piece` foods normalized to amount 1 (weight was
        // the pre-4A authored amount). ADR-P013 batches: `slice`/`tbsp` foods
        // keep their authored serving count; grams cover the FULL serving and
        // come from the pinned FDC manifest (fdc-portion-manifest.spec.ts gates).
        expect(['piece', 'slice', 'tbsp', 'tsp', 'cup', 'ml']).toContain(food.servingUnit);
        if (food.servingUnit === 'piece') expect(food.servingAmount).toBe(1);
        else expect(food.servingAmount).toBeGreaterThan(0);
        expect(food.gramsPerServing).toBeGreaterThan(0);
      } else {
        // Volumetric (cup/tbsp/tsp/ml) + still-unmatched slice foods stay gated.
        expect(food.gramsPerServing).toBeNull();
      }
    }
  });

  it('exactly 162 foods carry a non-gram gram weight, all at revision 2 (29 piece + 5 slice + 25 tbsp + 5 tsp + 83 cup + 15 ml)', () => {
    const withGrams = CANONICAL_FOOD_CATALOG.filter(
      (f) => f.servingUnit !== 'g' && f.gramsPerServing != null,
    );
    expect(withGrams).toHaveLength(162);
    expect(withGrams.every((f) => f.foodRevision === 2)).toBe(true);
    expect(withGrams.filter((f) => f.servingUnit === 'piece')).toHaveLength(29);
    expect(withGrams.filter((f) => f.servingUnit === 'slice')).toHaveLength(5);
    expect(withGrams.filter((f) => f.servingUnit === 'tbsp')).toHaveLength(25);
    expect(withGrams.filter((f) => f.servingUnit === 'tsp')).toHaveLength(5);
    expect(withGrams.filter((f) => f.servingUnit === 'cup')).toHaveLength(83);
    expect(withGrams.filter((f) => f.servingUnit === 'ml')).toHaveLength(15);
  });

  it('preserves an authored non-gram serving with no known weight (no fabrication)', () => {
    expect(normalizeServing({ amount: 182, unit: 'piece' })).toEqual({
      servingAmount: 182,
      servingUnit: 'piece',
      gramsPerServing: null,
    });
    expect(normalizeServing({ amount: 100, unit: 'g' })).toEqual({
      servingAmount: 100,
      servingUnit: 'g',
      gramsPerServing: 100,
    });
  });

  it('records an authored gram weight on a normalized one-piece serving', () => {
    expect(normalizeServing({ amount: 1, unit: 'piece', grams: 182 })).toEqual({
      servingAmount: 1,
      servingUnit: 'piece',
      gramsPerServing: 182,
    });
  });
});
