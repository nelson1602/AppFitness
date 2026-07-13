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

const GOLDEN_IDS: Record<string, string> = {
  'food.chicken_breast': '16cb6cd9-debe-55fd-b39e-aac043b8705e',
  'food.egg_whole': '298cb837-2dc6-550d-bf11-9f3654920d5e',
  'food.brown_rice': '6491c19f-e35b-556e-92ae-4703226b376a',
};
const EXPECTED_CATALOG_HASH = '295245c602366d241171fde3aa61aadb80859b62';

describe('uuidv5 derivation', () => {
  it('matches the RFC 4122 v5 reference vector', () => {
    expect(uuidv5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(
      '2ed6657d-e927-568b-95e1-2665a8aea6a2',
    );
  });

  it('derives the golden ids and is revision-scoped', () => {
    for (const [key, id] of Object.entries(GOLDEN_IDS)) {
      expect(deriveFoodId(key, 1)).toBe(id);
    }
    expect(deriveFoodId('food.chicken_breast', 2)).not.toBe(GOLDEN_IDS['food.chicken_breast']);
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
    for (const [key, id] of Object.entries(GOLDEN_IDS)) {
      expect(CANONICAL_FOOD_CATALOG.find((f) => f.catalogKey === key)?.id).toBe(id);
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
  it('records grams_per_serving only for gram servings (no fabricated conversions)', () => {
    for (const food of CANONICAL_FOOD_CATALOG) {
      if (food.servingUnit === 'g') {
        expect(food.gramsPerServing).toBe(food.servingAmount);
      } else {
        expect(food.gramsPerServing).toBeNull();
      }
    }
  });

  it('preserves the authored serving amount/unit exactly', () => {
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
});
