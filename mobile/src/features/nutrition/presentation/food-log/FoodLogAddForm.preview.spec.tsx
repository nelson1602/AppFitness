import { fireEvent, render, screen } from '@testing-library/react-native';

import { localDateOf } from '@/features/weekly-plan/domain/week';

import { useFoodLogStore } from '../../application/food-log.store';
import { FoodLogAddForm } from './FoodLogAddForm';

let mockTargets: { calories: number; proteinG: number } | null = null;

jest.mock('@/features/dashboard/application/use-today-targets', () => ({
  useTodayTargets: () => mockTargets,
}));
jest.mock('@/shared/localization', () => {
  const { es } = jest.requireActual('@/shared/localization/resources/es') as {
    es: Record<string, string>;
  };
  return {
    ...jest.requireActual('@/shared/localization'),
    useLocalization: () => ({ language: 'es', t: (key: string) => es[key] ?? key }),
  };
});

const today = localDateOf(new Date().toISOString());

function consumedToday(calories: number, date = today) {
  useFoodLogStore.setState({
    date,
    totals: { calories, proteinG: 0, carbsG: 0, fatG: 0, fiberG: null },
  });
}

async function chooseChicken(): Promise<void> {
  await fireEvent.changeText(screen.getByTestId('food-search-input'), 'pollo');
  await fireEvent.press(await screen.findByText('Pechuga de pollo, cocida'));
}

/** ADR-P040 v10-B: a heads-up before saving a food that takes the day past its target. */
describe('FoodLogAddForm — over-target preview (v10-B)', () => {
  beforeEach(() => {
    mockTargets = { calories: 2430, proteinG: 150 };
  });

  it('previews the new total and that the iCoach will adjust, without blocking the save', async () => {
    consumedToday(2300);
    const onAdd = jest.fn();
    await render(<FoodLogAddForm onAdd={onAdd} />);
    await chooseChicken();

    expect(
      screen.getByText(
        // The thousands dot depends on the runtime's ICU grouping; the words do not.
        /^Con esto llegas a 2\.?\d{3} de 2\.?430\skcal\. El iCoach ajustará tus comidas pendientes\.$/,
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('food-log-add-submit'));
    expect(onAdd).toHaveBeenCalledWith('food.chicken_breast', 'BREAKFAST', 1);
  });

  it('says nothing while the day stays within its target', async () => {
    consumedToday(800);
    await render(<FoodLogAddForm onAdd={jest.fn()} />);
    await chooseChicken();
    expect(screen.queryByText(/Con esto llegas a/)).toBeNull();
  });

  it('counts the chosen servings', async () => {
    consumedToday(2300);
    await render(<FoodLogAddForm onAdd={jest.fn()} />);
    await chooseChicken();
    const once = screen.getByText(/Con esto llegas a/).props.children as string;
    await fireEvent.press(screen.getByTestId('add-serving-inc'));
    expect(screen.getByText(/Con esto llegas a/).props.children).not.toBe(once);
  });

  it('never previews against today for a log of another day', async () => {
    consumedToday(2300, '2026-01-01');
    await render(<FoodLogAddForm onAdd={jest.fn()} />);
    await chooseChicken();
    expect(screen.queryByText(/Con esto llegas a/)).toBeNull();
  });
});
