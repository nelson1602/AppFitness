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
// is a revision-2 anchor (TECHDEBT-004 risk 3 normalization); the others are
// revision 1 — proving both packages derive rev-1 and rev-2 ids identically.
const GOLDEN = [
  { key: 'food.chicken_breast', revision: 1, id: '16cb6cd9-debe-55fd-b39e-aac043b8705e' },
  { key: 'food.egg_whole', revision: 2, id: 'ccd3b52a-5a8b-5ce9-b115-5f64b24b361e' },
  { key: 'food.brown_rice', revision: 1, id: '6491c19f-e35b-556e-92ae-4703226b376a' },
];
const EXPECTED_CATALOG_HASH = 'd22651ec0f95c8224a4a9c334c7c79a91329e4f5';

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
        // Gram serving: grams === the amount, base revision.
        expect(food.gramsPerServing).toBe(food.servingAmount);
        expect(food.foodRevision).toBe(1);
      } else if (food.foodRevision === 2) {
        // Normalized count-unit food (TECHDEBT-004 risk 3): 1 piece + a known,
        // authored gram weight — never fabricated.
        expect(food.servingUnit).toBe('piece');
        expect(food.servingAmount).toBe(1);
        expect(food.gramsPerServing).toBeGreaterThan(0);
      } else {
        // Volumetric (cup/tbsp/tsp/ml) + genuine slice counts stay gated.
        expect(food.gramsPerServing).toBeNull();
      }
    }
  });

  it('exactly the 29 normalized foods carry a non-gram gram weight at revision 2', () => {
    const normalized = CANONICAL_FOOD_CATALOG.filter(
      (f) => f.servingUnit !== 'g' && f.gramsPerServing != null,
    );
    expect(normalized).toHaveLength(29);
    expect(normalized.every((f) => f.foodRevision === 2 && f.servingAmount === 1)).toBe(true);
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
