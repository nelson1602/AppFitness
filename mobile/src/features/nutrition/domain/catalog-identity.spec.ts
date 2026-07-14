import {
  consumedTotals,
  deriveServingSnapshot,
  normalizeServing,
  type CanonicalFood,
} from './catalog-identity';

const APPLE: CanonicalFood = {
  id: '00000000-0000-0000-0000-000000000000',
  catalogKey: 'food.apple',
  foodRevision: 1,
  catalogVersion: 'food-catalog@1.0.0',
  name: 'Apple',
  category: 'fruit',
  servingAmount: 182,
  servingUnit: 'piece',
  gramsPerServing: null,
  caloriesPerServing: 95,
  proteinPerServing: 0.5,
  carbsPerServing: 25,
  fatPerServing: 0.3,
  fiberPerServing: 4.4,
};

describe('normalizeServing', () => {
  it('records grams_per_serving for gram servings', () => {
    expect(normalizeServing({ amount: 150, unit: 'g' })).toEqual({
      servingAmount: 150,
      servingUnit: 'g',
      gramsPerServing: 150,
    });
  });

  it('leaves grams_per_serving null for non-gram servings without a known weight', () => {
    for (const unit of ['ml', 'piece', 'cup', 'tbsp', 'tsp', 'slice'] as const) {
      expect(normalizeServing({ amount: 1, unit })).toEqual({
        servingAmount: 1,
        servingUnit: unit,
        gramsPerServing: null,
      });
    }
  });

  it('records an authored gram weight on a non-gram serving (TECHDEBT-004 risk 3)', () => {
    expect(normalizeServing({ amount: 1, unit: 'piece', grams: 50 })).toEqual({
      servingAmount: 1,
      servingUnit: 'piece',
      gramsPerServing: 50,
    });
  });
});

describe('deriveServingSnapshot', () => {
  it('maps the immutable per-serving snapshot from a canonical food', () => {
    expect(deriveServingSnapshot(APPLE)).toEqual({
      foodNameSnapshot: 'Apple',
      catalogKeySnapshot: 'food.apple',
      foodRevisionSnapshot: 1,
      catalogVersionSnapshot: 'food-catalog@1.0.0',
      servingAmountSnapshot: 182,
      servingUnitSnapshot: 'piece',
      gramsPerServingSnapshot: null,
      caloriesPerServingSnapshot: 95,
      proteinPerServingSnapshot: 0.5,
      carbsPerServingSnapshot: 25,
      fatPerServingSnapshot: 0.3,
      fiberPerServingSnapshot: 4.4,
    });
  });
});

describe('consumedTotals', () => {
  it('scales the snapshot by serving_count (fiber present)', () => {
    const snap = deriveServingSnapshot(APPLE);
    expect(consumedTotals(snap, 2)).toEqual({
      calories: 190,
      proteinG: 1,
      carbsG: 50,
      fatG: 0.6,
      fiberG: 8.8,
    });
  });

  it('returns null fiber when the snapshot has no fiber', () => {
    const snap = deriveServingSnapshot({ ...APPLE, fiberPerServing: null });
    expect(consumedTotals(snap, 1.5).fiberG).toBeNull();
    expect(consumedTotals(snap, 1.5).calories).toBe(143);
  });
});
