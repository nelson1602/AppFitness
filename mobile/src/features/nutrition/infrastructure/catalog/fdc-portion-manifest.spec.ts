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
  /**
   * ADR-P013 Amendment A1: names the pinned secondary source (FNDDS) this
   * entry was derived from. Absent on SR Legacy entries (the primary pin).
   */
  sourceRef?: string;
  portion: { portionRowId: number; amount: number; modifier: string; gramWeight: number };
  /**
   * Present for density-derived entries (ADR-P013 Batch 5 ml foods; Batch 7
   * extended to volume-unit liquids like the tbsp-served lemon juice).
   * sourceVolumeMl is the total millilitres the portion row represents
   * (US customary: cup = 236.588 ml, fl oz = 29.5735 ml); gPerMl =
   * gramWeight / sourceVolumeMl. catalogServingMl is the catalog serving
   * expressed in ml — REQUIRED for non-`ml` foods (e.g. 1 tbsp = 14.7868 ml),
   * optional for `ml` foods where it must equal servingAmount. Never an
   * assumed 1 g/ml.
   */
  density?: { sourceVolumeMl: number; gPerMl: number; catalogServingMl?: number };
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
  /**
   * ADR-P013 Amendment A1: pinned secondary sources (FNDDS). Pin-only until a
   * matching batch lands; entries referencing a secondary source will carry a
   * `sourceRef` naming its pin.
   */
  secondarySources?: {
    sourceRef: string;
    dataset: string;
    releaseLabel: string;
    archiveUrl: string;
    archiveSha256: string;
    archiveBytes: number;
    downloadedAt: string;
    license: string;
  }[];
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

  it('every entry sourceRef names a pinned secondary source, and FNDDS entries carry the survey data type', () => {
    const pinned = new Set((manifest.secondarySources ?? []).map((s) => s.sourceRef));
    for (const e of manifest.entries) {
      if (e.sourceRef != null) {
        expect(pinned.has(e.sourceRef)).toBe(true);
        expect(e.fdcDataType).toBe('survey_fndds_food');
      } else {
        // Entries without a sourceRef are SR Legacy (the primary pin).
        expect(e.fdcDataType).toBe('sr_legacy_food');
      }
    }
  });

  it('each Amendment A1 secondary source pins a specific release: unique ref, label, url, sha256, size, download date, license', () => {
    const secondaries = manifest.secondarySources ?? [];
    const refs = secondaries.map((s) => s.sourceRef);
    expect(new Set(refs).size).toBe(refs.length);
    for (const s of secondaries) {
      expect(s.sourceRef.length).toBeGreaterThan(0);
      expect(s.dataset).toContain('USDA FoodData Central');
      expect(s.releaseLabel).toMatch(/^survey_food_csv_\d{4}-\d{2}-\d{2}$/);
      expect(s.archiveUrl).toMatch(/^https:\/\/fdc\.nal\.usda\.gov\/.+\.zip$/);
      expect(s.archiveSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(s.archiveBytes).toBeGreaterThan(0);
      expect(s.downloadedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.license.toLowerCase()).toContain('public domain');
    }
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
      expect(['slice', 'tbsp', 'tsp', 'cup', 'ml']).toContain(food!.servingUnit);
      const label = e.portion.modifier.toLowerCase();
      if (e.density || food!.servingUnit === 'ml')
        // Density derivation needs a volume-paired portion (cup / fl oz / ml)
        // regardless of the catalog serving unit (Batch 7: tbsp lemon juice
        // derives from the record's cup row).
        expect(label).toMatch(/\b(cup|fl oz|fluid ounce|ml|milliliter|tbsp|tablespoon|tsp|teaspoon)\b/);
      else if (food!.servingUnit === 'slice') expect(label).toContain('slice');
      else if (food!.servingUnit === 'tbsp') expect(label).toMatch(/\b(tbsp|tablespoon)\b/);
      else if (food!.servingUnit === 'tsp') expect(label).toMatch(/\b(tsp|teaspoon)\b/);
      else expect(label).toMatch(/\bcup\b/);
    }
  });

  it('density blocks: required for ml foods, volume-consistent for volume-unit liquids, never on count units', () => {
    // US customary millilitres per serving unit (matches the derivation notes).
    const UNIT_ML: Record<string, number> = { tbsp: 14.7868, tsp: 4.92892, cup: 236.588 };
    for (const e of manifest.entries) {
      const food = byKey.get(e.catalogKey)!;
      if (food.servingUnit === 'ml') {
        expect(e.density).toBeDefined();
        if (e.density!.catalogServingMl != null) {
          expect(e.density!.catalogServingMl).toBe(food.servingAmount);
        }
      } else if (e.density) {
        // Batch 7: a volume-unit liquid derived by density (e.g. tbsp lemon
        // juice). catalogServingMl is REQUIRED and must equal the serving
        // expressed in customary ml.
        expect(Object.keys(UNIT_ML)).toContain(food.servingUnit);
        expect(e.density.catalogServingMl).toBeDefined();
        expect(e.density.catalogServingMl!).toBeCloseTo(
          food.servingAmount * UNIT_ML[food.servingUnit],
          4,
        );
      }
      if (e.density) {
        expect(e.density.sourceVolumeMl).toBeGreaterThan(0);
        // Plausible liquid density; an assumed 1.000 g/ml exactly would be
        // suspicious but is not per-se invalid — the derivation check below
        // requires it to actually equal gramWeight / sourceVolumeMl.
        expect(e.density.gPerMl).toBeGreaterThanOrEqual(0.5);
        expect(e.density.gPerMl).toBeLessThanOrEqual(1.6);
      }
      if (food.servingUnit === 'piece' || food.servingUnit === 'slice') {
        expect(e.density).toBeUndefined();
      }
    }
  });

  it('derivedGramsPerServing follows from the portion and the catalog serving amount', () => {
    for (const e of manifest.entries) {
      const food = byKey.get(e.catalogKey)!;
      if (e.density) {
        // Density path: gPerMl = gramWeight / sourceVolumeMl and derived =
        // density * catalog serving in ml (rounded to 0.1 g). For ml foods the
        // serving ml IS servingAmount; volume-unit liquids carry an explicit
        // catalogServingMl (Batch 7).
        expect(e.density.gPerMl).toBeCloseTo(e.portion.gramWeight / e.density.sourceVolumeMl, 4);
        const servingMl = e.density.catalogServingMl ?? food.servingAmount;
        const derived = (e.portion.gramWeight / e.density.sourceVolumeMl) * servingMl;
        expect(Math.abs(e.derivedGramsPerServing - derived)).toBeLessThanOrEqual(0.05 + 1e-9);
      } else {
        const derived = (e.portion.gramWeight / e.portion.amount) * food.servingAmount;
        expect(e.derivedGramsPerServing).toBeCloseTo(derived, 6);
      }
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
