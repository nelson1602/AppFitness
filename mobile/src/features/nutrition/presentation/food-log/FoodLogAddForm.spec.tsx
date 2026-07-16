import { fireEvent, render, screen } from '@testing-library/react-native';

import type { DietaryPreference } from '../../domain/dietary-preference';
import { FoodLogAddForm } from './FoodLogAddForm';

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

/**
 * Component test for the add-food surface (Slice 4D). Uses the REAL bundled
 * catalog search (a pure function over committed data) — no mocks — so the
 * search → select → serving → submit path is exercised end to end. Also
 * covers the ServingStepper interaction and the no-results state.
 */
describe('FoodLogAddForm (Slice 4D)', () => {
  it('searches the catalog, adjusts servings, and logs the selected food', async () => {
    const onAdd = jest.fn();
    await render(<FoodLogAddForm onAdd={onAdd} />);

    await fireEvent.changeText(screen.getByTestId('food-search-input'), 'chicken');
    // Real catalog result.
    await fireEvent.press(await screen.findByText('Chicken breast, cooked'));

    // Fractional stepper: 1 → 1.25 (no fabricated grams).
    await fireEvent.press(await screen.findByTestId('add-serving-inc'));
    // Switch the target meal.
    await fireEvent.press(screen.getByTestId('meal-type-LUNCH'));

    await fireEvent.press(screen.getByTestId('food-log-add-submit'));

    expect(onAdd).toHaveBeenCalledWith('food.chicken_breast', 'LUNCH', 1.25);
  });

  it('shows a no-results message for an unmatched query', async () => {
    await render(<FoodLogAddForm onAdd={jest.fn()} />);
    await fireEvent.changeText(screen.getByTestId('food-search-input'), 'zzzznotafood');
    expect(await screen.findByTestId('food-search-no-results')).toBeOnTheScreen();
  });

  it('logs at the default meal + serving and resets after submit', async () => {
    const onAdd = jest.fn();
    await render(<FoodLogAddForm onAdd={onAdd} />);

    await fireEvent.changeText(screen.getByTestId('food-search-input'), 'chicken');
    await fireEvent.press(await screen.findByText('Chicken breast, cooked'));
    await fireEvent.press(screen.getByTestId('food-log-add-submit'));

    expect(onAdd).toHaveBeenCalledWith('food.chicken_breast', 'BREAKFAST', 1);
    // Selection cleared → the submit button is gone until another food is picked.
    expect(screen.queryByTestId('food-log-add-submit')).toBeNull();
  });
});

describe('FoodLogAddForm — dietary-preference warnings (ADR-P014 Slice 4)', () => {
  async function selectAlmonds(preferences: DietaryPreference[]) {
    await render(<FoodLogAddForm onAdd={jest.fn()} activePreferences={preferences} />);
    await fireEvent.changeText(screen.getByTestId('food-search-input'), 'almonds');
    await fireEvent.press(await screen.findByText('Almonds'));
  }

  it('warns when the selected food matches an active avoid-tag exclusion', async () => {
    await selectAlmonds([pref({ avoidTag: 'nut_allergy', kind: 'allergy' })]);
    expect(
      screen.getByText('Heads up — this matches an allergy or sensitivity'),
    ).toBeOnTheScreen();
    expect(screen.getByText(/Nuts/)).toBeOnTheScreen();
  });

  it('warns when the selected food matches an explicit catalog-key exclusion', async () => {
    const onAdd = jest.fn();
    await render(
      <FoodLogAddForm
        onAdd={onAdd}
        activePreferences={[
          pref({ exclusionType: 'catalog_key', avoidTag: null, catalogKey: 'food.chicken_breast' }),
        ]}
      />,
    );
    await fireEvent.changeText(screen.getByTestId('food-search-input'), 'chicken');
    await fireEvent.press(await screen.findByText('Chicken breast, cooked'));
    expect(screen.getByText(/a food you chose to avoid/)).toBeOnTheScreen();
  });

  it('uses stronger safety wording for an allergy/sensitivity, without emergency-advice claims', async () => {
    await selectAlmonds([pref({ avoidTag: 'nut_allergy', kind: 'allergy' })]);
    expect(
      screen.getByText('Heads up — this matches an allergy or sensitivity'),
    ).toBeOnTheScreen();
    expect(screen.getByText(/not emergency medical advice/i)).toBeOnTheScreen();
  });

  it('uses softer wording for a preference/dislike', async () => {
    await selectAlmonds([pref({ avoidTag: 'nut_allergy', kind: 'preference' })]);
    expect(screen.getByText('This is on your avoid list')).toBeOnTheScreen();
    expect(screen.queryByText('Heads up — this matches an allergy or sensitivity')).toBeNull();
  });

  it('never hard-blocks: the user can still log the food after a warning', async () => {
    const onAdd = jest.fn();
    await render(
      <FoodLogAddForm
        onAdd={onAdd}
        activePreferences={[pref({ avoidTag: 'nut_allergy', kind: 'allergy' })]}
      />,
    );
    await fireEvent.changeText(screen.getByTestId('food-search-input'), 'almonds');
    await fireEvent.press(await screen.findByText('Almonds'));
    // Warning is shown, but the submit control remains available and works.
    expect(
      screen.getByText('Heads up — this matches an allergy or sensitivity'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('food-log-add-submit'));
    expect(onAdd).toHaveBeenCalledWith('food.almonds', 'BREAKFAST', 1);
  });

  it('shows no warning when no active preference matches the selected food', async () => {
    await selectAlmonds([pref({ avoidTag: 'shellfish_allergy', kind: 'allergy' })]);
    expect(screen.queryByText('Heads up — this matches an allergy or sensitivity')).toBeNull();
    expect(screen.queryByText('This is on your avoid list')).toBeNull();
    // Existing behavior intact: submit still present.
    expect(screen.getByTestId('food-log-add-submit')).toBeOnTheScreen();
  });

  it('shows no warning when there are no active preferences (unchanged default behavior)', async () => {
    await selectAlmonds([]);
    expect(screen.queryByText('Heads up — this matches an allergy or sensitivity')).toBeNull();
    expect(screen.queryByText('This is on your avoid list')).toBeNull();
  });
});
