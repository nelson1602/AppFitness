import { CANONICAL_FOOD_CATALOG } from './food-catalog.canonical';
import manifestJson from './fdc-portion-manifest.json';

/**
 * ADR-P013 manifest gate. The FDC portion manifest is the auditable provenance
 * artifact for every non-gram food whose gram weight was sourced from the
 * pinned USDA-FDC archive (Batch 1: slice foods). This spec enforces the
 * acceptance-criteria gates: schema/provenance completeness, unit
 * compatibility, gram-weight bounds, macro reconciliation against the FDC
 * per-100 g values within the documented tolerance, and exact agreement
 * between the authored grams and the manifest derivation. It also locks the
 * manifest and the catalog together: every FDC-sourced food has exactly one
 * entry, and every unmatched food stays null/gated. Batch 1 covered `slice`
 * foods; Batch 2 adds accepted `tbsp` foods; the tsp semantics mini-slice adds
 * accepted `tsp` foods; Batch 3A adds reviewed `cup` grains/legumes/staples and
 * keeps rejected/ambiguous candidates unmatched.
 */

interface ManifestEntry {
  catalogKey: string;
  fdcId: number;
  fdcDataType: string;
  fdcDescription: string;
  portion: { portionRowId: number; amount: number; modifier: string; gramWeight: number };
  fdcPer100g: { kcal: number; proteinG: number; carbsG: number; fatG: number };
  derivedGramsPerServing: number;
  reviewNote: string;
}

interface Manifest {
  source: {
    dataset: string;
    releaseLabel: string;
    archiveUrl: string;
    archiveSha256: string;
    archiveBytes: number;
    downloadedAt: string;
    license: string;
  };
  tolerances: {
    caloriesAbsMin: number;
    caloriesPct: number;
    macroGramsAbsMin: number;
    macroGramsPct: number;
  };
  entries: ManifestEntry[];
  unmatched: { catalogKey: string; reason: string }[];
}

const manifest = manifestJson as Manifest;

const byKey = new Map(CANONICAL_FOOD_CATALOG.map((f) => [f.catalogKey, f]));

// Part-1 `piece` foods carry grams authored in the pre-4A data itself; the
// manifest covers the FDC-sourced foods (every other non-gram food with grams).
const fdcSourced = CANONICAL_FOOD_CATALOG.filter(
  (f) => f.servingUnit !== 'g' && f.servingUnit !== 'piece' && f.gramsPerServing != null,
);

describe('FDC portion manifest — pinned source provenance', () => {
  it('pins a specific release: label, url, sha256, size, download date, license', () => {
    const s = manifest.source;
    expect(s.dataset).toContain('USDA FoodData Central');
    expect(s.releaseLabel).toMatch(/^sr_legacy_food_csv_\d{4}-\d{2}$/);
    expect(s.archiveUrl).toMatch(/^https:\/\/fdc\.nal\.usda\.gov\/.+\.zip$/);
    expect(s.archiveSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(s.archiveBytes).toBeGreaterThan(0);
    expect(s.downloadedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(s.license.toLowerCase()).toContain('public domain');
  });

  it('every entry carries complete per-food provenance', () => {
    expect(manifest.entries.length).toBeGreaterThan(0);
    for (const e of manifest.entries) {
      expect(e.catalogKey).toMatch(/^food\.[a-z0-9_]+$/);
      expect(Number.isInteger(e.fdcId) && e.fdcId > 0).toBe(true);
      expect(e.fdcDataType.length).toBeGreaterThan(0);
      expect(e.fdcDescription.length).toBeGreaterThan(0);
      expect(Number.isInteger(e.portion.portionRowId) && e.portion.portionRowId > 0).toBe(true);
      expect(e.portion.modifier.length).toBeGreaterThan(0);
      expect(e.reviewNote.length).toBeGreaterThan(0);
    }
  });
});

describe('FDC portion manifest — gates', () => {
  it('gram weights are positive and within the plausible bound (0 < g <= 1000)', () => {
    for (const e of manifest.entries) {
      expect(e.portion.gramWeight).toBeGreaterThan(0);
      expect(e.portion.gramWeight).toBeLessThanOrEqual(1000);
      expect(e.derivedGramsPerServing).toBeGreaterThan(0);
      expect(e.derivedGramsPerServing).toBeLessThanOrEqual(1000);
    }
  });

  it('portion unit is compatible with the catalog serving unit', () => {
    for (const e of manifest.entries) {
      const food = byKey.get(e.catalogKey);
      expect(food).toBeDefined();
      expect(['slice', 'tbsp', 'tsp', 'cup']).toContain(food!.servingUnit);
      const label = e.portion.modifier.toLowerCase();
      if (food!.servingUnit === 'slice') expect(label).toContain('slice');
      else if (food!.servingUnit === 'tbsp') expect(label).toMatch(/\b(tbsp|tablespoon)\b/);
      else if (food!.servingUnit === 'tsp') expect(label).toMatch(/\b(tsp|teaspoon)\b/);
      else expect(label).toMatch(/\bcup\b/);
    }
  });

  it('derivedGramsPerServing follows from the portion and the catalog serving amount', () => {
    for (const e of manifest.entries) {
      const food = byKey.get(e.catalogKey)!;
      const derived = (e.portion.gramWeight / e.portion.amount) * food.servingAmount;
      expect(e.derivedGramsPerServing).toBeCloseTo(derived, 6);
    }
  });

  it('authored gramsPerServing equals the manifest derivation exactly', () => {
    for (const e of manifest.entries) {
      expect(byKey.get(e.catalogKey)!.gramsPerServing).toBe(e.derivedGramsPerServing);
    }
  });

  it('macro reconciliation: FDC per-100g scaled to the serving matches the authored macros', () => {
    const t = manifest.tolerances;
    const kcalTol = (target: number): number => Math.max(t.caloriesPct * target, t.caloriesAbsMin);
    const gTol = (target: number): number => Math.max(t.macroGramsPct * target, t.macroGramsAbsMin);
    for (const e of manifest.entries) {
      const food = byKey.get(e.catalogKey)!;
      const s = e.derivedGramsPerServing / 100;
      expect(Math.abs(e.fdcPer100g.kcal * s - food.caloriesPerServing)).toBeLessThanOrEqual(
        kcalTol(food.caloriesPerServing),
      );
      expect(Math.abs(e.fdcPer100g.proteinG * s - food.proteinPerServing)).toBeLessThanOrEqual(
        gTol(food.proteinPerServing),
      );
      expect(Math.abs(e.fdcPer100g.carbsG * s - food.carbsPerServing)).toBeLessThanOrEqual(
        gTol(food.carbsPerServing),
      );
      expect(Math.abs(e.fdcPer100g.fatG * s - food.fatPerServing)).toBeLessThanOrEqual(
        gTol(food.fatPerServing),
      );
    }
  });
});

describe('FDC portion manifest — catalog lock', () => {
  it('every FDC-sourced catalog food has exactly one manifest entry, and vice versa', () => {
    const entryKeys = manifest.entries.map((e) => e.catalogKey).sort();
    expect(new Set(entryKeys).size).toBe(entryKeys.length);
    expect(entryKeys).toEqual(fdcSourced.map((f) => f.catalogKey).sort());
  });

  it('unmatched foods carry a reason and stay null/gated at the base revision', () => {
    for (const u of manifest.unmatched) {
      expect(u.reason.length).toBeGreaterThan(0);
      const food = byKey.get(u.catalogKey);
      expect(food).toBeDefined();
      expect(food!.gramsPerServing).toBeNull();
      expect(food!.foodRevision).toBe(1);
    }
  });

  it('no manifest entry overlaps the unmatched list', () => {
    const matched = new Set(manifest.entries.map((e) => e.catalogKey));
    for (const u of manifest.unmatched) expect(matched.has(u.catalogKey)).toBe(false);
  });
});
