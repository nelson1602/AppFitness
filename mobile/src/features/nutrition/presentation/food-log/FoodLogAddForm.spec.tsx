import { fireEvent, render, screen } from '@testing-library/react-native';

import { FoodLogAddForm } from './FoodLogAddForm';

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
