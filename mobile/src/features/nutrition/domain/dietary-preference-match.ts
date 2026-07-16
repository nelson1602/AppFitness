import type { DietaryPreference } from './dietary-preference';
import type { AvoidTag, FoodItem } from './food-catalog';

/**
 * Pure matcher between a catalog food and a user's active dietary preferences
 * (ADR-P014 Slice 4). Answers: does logging THIS food touch an active
 * exclusion, and how strongly should we warn?
 *
 * A food matches when either:
 *  - one of its catalog `avoidFor` tags is an active avoid-tag exclusion, or
 *  - its catalog id/key is an active explicit per-food exclusion.
 *
 * Severity is safety-first: `allergy` when ANY matching preference is an
 * allergy/sensitivity (`kind === 'allergy'`), otherwise `preference`. This is
 * advisory only — the caller NEVER hard-blocks logging (Slice 4 scope).
 *
 * No I/O, no Date.now/Math.random — deterministic over its inputs.
 */

export type ExclusionSeverity = 'allergy' | 'preference';

export interface ExclusionMatch {
  /** Strongest matching kind → drives warning wording. */
  severity: ExclusionSeverity;
  /** Matched avoid-tag categories (food.avoidFor ∩ active avoid tags), sorted. */
  avoidTags: AvoidTag[];
  /** True when the food's catalog key was explicitly excluded. */
  byCatalogKey: boolean;
}

export function matchFoodExclusion(
  food: Pick<FoodItem, 'id' | 'avoidFor'>,
  preferences: readonly DietaryPreference[],
): ExclusionMatch | null {
  const foodAvoid = new Set<AvoidTag>(food.avoidFor ?? []);
  const matched: DietaryPreference[] = [];
  const avoidTags = new Set<AvoidTag>();
  let byCatalogKey = false;

  for (const p of preferences) {
    if (p.avoidTag && foodAvoid.has(p.avoidTag)) {
      matched.push(p);
      avoidTags.add(p.avoidTag);
    } else if (p.catalogKey && p.catalogKey === food.id) {
      matched.push(p);
      byCatalogKey = true;
    }
  }

  if (matched.length === 0) return null;

  const severity: ExclusionSeverity = matched.some((p) => p.kind === 'allergy')
    ? 'allergy'
    : 'preference';
  return { severity, avoidTags: [...avoidTags].sort(), byCatalogKey };
}
