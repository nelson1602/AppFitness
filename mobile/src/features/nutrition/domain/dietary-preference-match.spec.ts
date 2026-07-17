import type { DietaryPreference } from './dietary-preference';
import { matchFoodExclusion } from './dietary-preference-match';
import type { AvoidTag } from './food-catalog';

function pref(over: Partial<DietaryPreference> = {}): DietaryPreference {
  return {
    id: 'dp-1',
    userId: 'u1',
    exclusionType: 'avoid_tag',
    avoidTag: 'nut_allergy',
    catalogKey: null,
    kind: 'allergy',
    hasNote: false,
    version: 1,
    syncStatus: 'pending',
    updatedAt: '2026-07-16T00:00:00.000Z',
    ...over,
  };
}

const almonds = { id: 'food.almonds', avoidFor: ['nut_allergy'] as AvoidTag[] };
const chicken = { id: 'food.chicken_breast', avoidFor: undefined };

describe('matchFoodExclusion', () => {
  it('returns null when there are no preferences', () => {
    expect(matchFoodExclusion(almonds, [])).toBeNull();
  });

  it('returns null when no active preference matches the food', () => {
    expect(matchFoodExclusion(chicken, [pref({ avoidTag: 'shellfish_allergy' })])).toBeNull();
  });

  it('matches an avoid-tag exclusion via the food avoidFor tags', () => {
    const match = matchFoodExclusion(almonds, [pref({ avoidTag: 'nut_allergy' })]);
    expect(match).toEqual({ severity: 'allergy', avoidTags: ['nut_allergy'], byCatalogKey: false });
  });

  it('matches an explicit catalog-key exclusion', () => {
    const match = matchFoodExclusion(chicken, [
      pref({ exclusionType: 'catalog_key', avoidTag: null, catalogKey: 'food.chicken_breast' }),
    ]);
    expect(match).toEqual({ severity: 'allergy', avoidTags: [], byCatalogKey: true });
  });

  it('reports preference severity when only preference-kind entries match', () => {
    const match = matchFoodExclusion(almonds, [
      pref({ avoidTag: 'nut_allergy', kind: 'preference' }),
    ]);
    expect(match?.severity).toBe('preference');
  });

  it('reports allergy severity when ANY matching entry is an allergy (safety-first)', () => {
    const match = matchFoodExclusion(almonds, [
      pref({ id: 'a', avoidTag: 'nut_allergy', kind: 'preference' }),
      pref({ id: 'b', avoidTag: 'nut_allergy', kind: 'allergy' }),
    ]);
    expect(match?.severity).toBe('allergy');
  });

  it('does not match a preference whose avoidTag the food does not carry', () => {
    expect(matchFoodExclusion(almonds, [pref({ avoidTag: 'shellfish_allergy' })])).toBeNull();
  });
});
