import type { ServingSnapshot } from './catalog-identity';
import { itemConsumed, sumDailyTotals, type LoggedMealItem } from './food-log';

/**
 * Daily totals are DERIVED from the logged entries' immutable snapshots ×
 * serving_count — never from the read-only nutrition plan.
 */

function snapshot(overrides: Partial<ServingSnapshot> = {}): ServingSnapshot {
  return {
    foodNameSnapshot: 'X',
    catalogKeySnapshot: 'food.x',
    foodRevisionSnapshot: 1,
    catalogVersionSnapshot: 'food-catalog@1.0.0',
    servingAmountSnapshot: 100,
    servingUnitSnapshot: 'g',
    gramsPerServingSnapshot: 100,
    caloriesPerServingSnapshot: 100,
    proteinPerServingSnapshot: 10,
    carbsPerServingSnapshot: 20,
    fatPerServingSnapshot: 5,
    fiberPerServingSnapshot: null,
    ...overrides,
  };
}

function item(consumed: LoggedMealItem['consumed']): LoggedMealItem {
  return {
    id: 'i',
    mealType: 'LUNCH',
    foodId: 'f',
    catalogKey: 'food.x',
    name: 'X',
    servingCount: 1,
    serving: { amount: 100, unit: 'g' },
    consumed,
    syncState: 'pending',
  };
}

describe('itemConsumed', () => {
  it('scales the per-serving snapshot by serving count', () => {
    expect(itemConsumed(snapshot(), 2)).toEqual({
      calories: 200,
      proteinG: 20,
      carbsG: 40,
      fatG: 10,
      fiberG: null,
    });
  });

  it('supports fractional servings without fabricating grams for non-gram foods', () => {
    const c = itemConsumed(
      snapshot({ servingUnitSnapshot: 'piece', gramsPerServingSnapshot: null }),
      0.5,
    );
    expect(c.calories).toBe(50);
    expect(c.proteinG).toBe(5);
  });
});

describe('sumDailyTotals', () => {
  it('sums consumed macros across entries and rounds deterministically', () => {
    const totals = sumDailyTotals([
      item({ calories: 320, proteinG: 62, carbsG: 0, fatG: 8, fiberG: null }),
      item({ calories: 155, proteinG: 5, carbsG: 27, fatG: 3, fiberG: 4 }),
    ]);
    expect(totals).toEqual({
      calories: 475,
      proteinG: 67,
      carbsG: 27,
      fatG: 11,
      fiberG: 4,
    });
  });

  it('keeps fiber null until at least one entry carries fiber', () => {
    expect(
      sumDailyTotals([item({ calories: 100, proteinG: 1, carbsG: 1, fatG: 1, fiberG: null })])
        .fiberG,
    ).toBeNull();
    expect(sumDailyTotals([]).fiberG).toBeNull();
  });

  it('is order-independent', () => {
    const a = item({ calories: 100, proteinG: 1, carbsG: 2, fatG: 3, fiberG: 1 });
    const b = item({ calories: 200, proteinG: 4, carbsG: 5, fatG: 6, fiberG: 2 });
    expect(sumDailyTotals([a, b])).toEqual(sumDailyTotals([b, a]));
  });
});
