import {
  AVOID_TAGS,
  CATALOG_VERSION,
  FOOD_CATEGORIES,
  FOOD_TAGS,
  SERVING_UNITS,
} from '../domain/food-catalog';
import { FOOD_CATALOG } from './food-catalog.data';

/**
 * Integrity contract for the bundled catalog. Guards the hand-authored data
 * against miscounts, typos, out-of-vocabulary values, missing provenance,
 * and macro/calorie inconsistency.
 */
describe('food catalog integrity', () => {
  it('has a stable version tag', () => {
    expect(CATALOG_VERSION).toMatch(/^food-catalog@\d+\.\d+\.\d+$/);
  });

  it('contains exactly 300 items', () => {
    expect(FOOD_CATALOG).toHaveLength(300);
  });

  it('has unique ids following the food.<slug> convention', () => {
    const ids = FOOD_CATALOG.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^food\.[a-z0-9_]+$/);
  });

  it('has no duplicate normalized names', () => {
    const names = FOOD_CATALOG.map((f) => f.name.trim().toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('uses only the closed category vocabulary and spans all categories', () => {
    const used = new Set<string>();
    for (const f of FOOD_CATALOG) {
      expect(FOOD_CATEGORIES).toContain(f.category);
      used.add(f.category);
    }
    expect(used.size).toBe(FOOD_CATEGORIES.length);
  });

  it('uses only the closed tag vocabulary (at least one tag each)', () => {
    for (const f of FOOD_CATALOG) {
      expect(f.tags.length).toBeGreaterThan(0);
      for (const t of f.tags) expect(FOOD_TAGS).toContain(t);
    }
  });

  it('uses only the closed avoidFor vocabulary', () => {
    for (const f of FOOD_CATALOG) {
      for (const a of f.avoidFor ?? []) expect(AVOID_TAGS).toContain(a);
    }
  });

  it('has provenance (source.ref) on every item', () => {
    for (const f of FOOD_CATALOG) {
      expect(typeof f.source.ref).toBe('string');
      expect(f.source.ref.length).toBeGreaterThan(0);
    }
  });

  it('has valid serving data', () => {
    for (const f of FOOD_CATALOG) {
      expect(f.servingSize.amount).toBeGreaterThan(0);
      expect(SERVING_UNITS).toContain(f.servingSize.unit);
    }
  });

  it('records an authored gram weight only on known non-gram servings (no fabrication)', () => {
    // TECHDEBT-004 risk 3: the only non-gram foods carrying a known gram
    // weight are the 29 part-1 normalized `piece` foods (amount: 1, weight was
    // the pre-4A authored amount), the 4 ADR-P013 Batch-1 `slice` foods, the
    // 13 ADR-P013 Batch-2 `tbsp` foods, the 4 tsp-semantics `tsp` foods, the
    // 26 ADR-P013 Batch-3A `cup` grains/legumes/staples, the 42 ADR-P013
    // Batch-3B `cup` vegetables, the 14 ADR-P013 Batch-3C `cup` fruits, the 8
    // ADR-P013 Batch-4 remaining `tbsp` foods, and the 11 ADR-P013 Batch-5
    // `ml` foods (density-derived from volume-paired portions).
    // FDC-sourced full-serving weights
    // are gated by catalog/fdc-portion-manifest.spec.ts. Remaining volumetric
    // foods must NOT carry a fabricated gram weight.
    // Batch 6 adds the 5 zero-macro foods after the owner resolved that
    // policy (4 ml beverages + apple_cider_vinegar).
    // Batch 7 adds lemon_juice (density-derived tbsp liquid).
    const withGrams = FOOD_CATALOG.filter((f) => f.servingSize.grams != null);
    expect(withGrams).toHaveLength(157);
    for (const f of withGrams) {
      expect(['piece', 'slice', 'tbsp', 'tsp', 'cup', 'ml']).toContain(f.servingSize.unit);
      if (f.servingSize.unit === 'piece') expect(f.servingSize.amount).toBe(1);
      else expect(f.servingSize.amount).toBeGreaterThan(0);
      expect(f.servingSize.grams).toBeGreaterThan(0);
    }
    expect(
      withGrams
        .filter((f) => f.servingSize.unit === 'slice')
        .map((f) => f.id)
        .sort(),
    ).toEqual([
      'food.canadian_bacon',
      'food.ezekiel_bread',
      'food.rye_bread',
      'food.whole_wheat_bread',
    ]);
    expect(withGrams.filter((f) => f.servingSize.unit === 'tbsp')).toHaveLength(23);
    expect(withGrams.filter((f) => f.servingSize.unit === 'tsp')).toHaveLength(4);
    expect(withGrams.filter((f) => f.servingSize.unit === 'cup')).toHaveLength(82);
    expect(withGrams.filter((f) => f.servingSize.unit === 'ml')).toHaveLength(15);
  });

  it('has finite, non-negative calories and macros; fiber within carbs', () => {
    for (const f of FOOD_CATALOG) {
      for (const v of [f.calories, f.proteinG, f.carbsG, f.fatG]) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
      if (f.fiberG != null) {
        expect(f.fiberG).toBeGreaterThanOrEqual(0);
        expect(f.fiberG).toBeLessThanOrEqual(f.carbsG + 0.001);
      }
    }
  });

  it('keeps macro calories within a practical tolerance of stated calories', () => {
    for (const f of FOOD_CATALOG) {
      const atwater = 4 * f.proteinG + 4 * f.carbsG + 9 * f.fatG;
      // Practical tolerance: fiber, rounding, and DB values differ in general.
      const tolerance = Math.max(25, f.calories * 0.15);
      expect(Math.abs(f.calories - atwater)).toBeLessThanOrEqual(tolerance);
    }
  });
});
