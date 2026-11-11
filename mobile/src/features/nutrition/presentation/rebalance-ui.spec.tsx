import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { coachChangeText } from '@/features/weekly-plan/presentation/realtime-copy';

import { scaleFood, sumMacros } from '../application/meal-portions';
import { getById } from '../application/food-catalog.service';
import { rebalanceToday } from '../application/meal-rebalance.service';
import type { MealSlot } from '../domain/meal-plan';
import { MealPlanPanel, type PlanMeal, type ViewDay } from './meal-plan-day';
import { withRebalance } from './use-nutrition-plan-view';
import { rebalanceCoachChange, type TodayRebalance } from './use-today-rebalance';

let mockLanguage: 'en' | 'es' = 'es';

jest.mock('@/shared/localization', () => {
  const { en } = jest.requireActual('@/shared/localization/resources/en') as {
    en: Record<string, string>;
  };
  const { es } = jest.requireActual('@/shared/localization/resources/es') as {
    es: Record<string, string>;
  };
  const format = jest.requireActual('@/shared/localization/format');
  return {
    formatNumber: (value: number, language: 'en' | 'es') =>
      new Intl.NumberFormat(language === 'es' ? 'es' : 'en-US').format(value),
    formatQuantity: format.formatQuantity,
    formatKcal: format.formatKcal,
    formatKcalQuantity: format.formatKcalQuantity,
    formatDate: format.formatDate,
    interpolate: format.interpolate,
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: string) => (mockLanguage === 'es' ? es[key] : en[key]) ?? key,
    }),
  };
});

const TODAY = '2026-11-11';

function meal(slot: MealSlot, lines: [string, number][], dishId?: string): PlanMeal {
  const foods = lines.map(([key, servings]) => scaleFood(getById(`food.${key}`)!, servings));
  return { slot, ...(dishId ? { dishId } : {}), foods, totals: sumMacros(foods) };
}

const MEALS = [
  meal('BREAKFAST', [
    ['egg_whole', 2],
    ['plantain_boiled', 2],
    ['avocado_half', 1],
  ]),
  meal('LUNCH', [
    ['white_rice', 2],
    ['chicken_breast', 2],
    ['black_beans', 1],
    ['avocado_half', 1],
  ]),
  meal(
    'SNACK',
    [
      ['casabe', 1],
      ['avocado_half', 1],
    ],
    'casabe_aguacate',
  ),
  meal('DINNER', [
    ['cassava_cooked', 2],
    ['cod', 2],
    ['avocado_half', 1],
  ]),
];

const DAY: ViewDay = {
  index: 3,
  date: TODAY,
  preview: false,
  isToday: true,
  isFuture: false,
  meals: MEALS,
  targets: { calories: 2430, proteinG: 150, carbsG: 300, fatG: 70 },
  totals: sumMacros(MEALS.flatMap((m) => m.foods)),
  safetyFloorApplied: false,
};

/** The owner repro: three meals eaten (2.108) + Galleta de Soda (403). */
function repro(skipped: MealSlot[] = []): TodayRebalance {
  return {
    date: TODAY,
    rebalance: rebalanceToday({
      meals: MEALS,
      closedSlots: new Set<MealSlot>(['BREAKFAST', 'LUNCH', 'DINNER', ...skipped]),
      targetCalories: 2430,
      proteinTargetG: 150,
      consumed: { calories: 2511, proteinG: 120, carbsG: 250, fatG: 80 },
      country: 'DO',
      preferences: [],
    }),
    trigger: {
      id: 'galleta',
      mealType: 'SNACK',
      foodId: 'x',
      catalogKey: null,
      name: 'Galleta de Soda',
      servingCount: 1,
      serving: { amount: 100, unit: 'g' },
      consumed: { calories: 403, proteinG: 9, carbsG: 70, fatG: 10, fiberG: null },
      syncState: 'pending',
      planned: false,
      loggedAt: '2026-11-11T19:30:00.000Z',
    },
    skipped,
    eaten: {},
  };
}

const eaten = (slot: MealSlot) => slot !== 'SNACK';

describe('rebalance on screen (ADR-P040 v10-B)', () => {
  beforeEach(() => {
    mockLanguage = 'es';
  });

  it('the repro: the pending Merienda changes at once and the day plans 2.430, not 2.511', () => {
    const [today] = withRebalance([DAY], repro());
    expect(today.totals.calories).toBe(2430);
    expect(today.rebalance).toEqual({
      status: 'covered',
      consumedCalories: 2511,
      targetCalories: 2430,
    });
    const snack = today.meals.find((m) => m.slot === 'SNACK')!;
    expect(snack.rebalance?.status).toBe('covered');
    // Eaten meals are untouched.
    expect(today.meals.find((m) => m.slot === 'LUNCH')).toEqual(MEALS[1]);
  });

  it('shows "Ya cubriste…" with a light option and "Omitir" on the Merienda', async () => {
    const [today] = withRebalance([DAY], repro());
    const onLight = jest.fn();
    const onSkip = jest.fn();
    await render(
      <MealPlanPanel
        day={today}
        isDone={eaten}
        onEaten={jest.fn()}
        onLightOption={onLight}
        onSkip={onSkip}
      />,
    );

    expect(screen.getByTestId('plan-rebalance-day')).toHaveTextContent(
      'Llevas 2511 de 2430 kcal. Ya cubriste tus calorías de hoy.'.replace(/\d{4}/g, (n) =>
        new Intl.NumberFormat('es').format(Number(n)),
      ),
    );
    const covered = screen.getByTestId('plan-covered-3-SNACK');
    expect(within(covered).getByText('Ya cubriste tus calorías de hoy')).toBeOnTheScreen();
    // No "Lo comí" on a covered meal: the light option or skipping it.
    expect(screen.queryByTestId('plan-ate-3-SNACK')).toBeNull();
    await fireEvent.press(screen.getByTestId('plan-light-3-SNACK'));
    expect(onLight).toHaveBeenCalledWith('SNACK');
    await fireEvent.press(screen.getByTestId('plan-skip-3-SNACK'));
    expect(onSkip).toHaveBeenCalledWith('SNACK');
    expect(screen.queryByText(/médic|medical/i)).toBeNull();
  });

  it('marks a skipped meal "Omitida hoy" and offers nothing more on it', async () => {
    const [today] = withRebalance([DAY], repro(['SNACK']));
    await render(<MealPlanPanel day={today} isDone={eaten} onEaten={jest.fn()} />);
    expect(screen.getByTestId('plan-skipped-3-SNACK')).toHaveTextContent('Omitida hoy');
    expect(screen.queryByTestId('plan-covered-3-SNACK')).toBeNull();
  });

  it('labels a re-portioned meal with what it was before', async () => {
    const adjusted: TodayRebalance = {
      ...repro(),
      rebalance: rebalanceToday({
        meals: MEALS,
        closedSlots: new Set<MealSlot>(['BREAKFAST']),
        targetCalories: 2430,
        proteinTargetG: 150,
        consumed: { calories: MEALS[0].totals.calories + 403, proteinG: 30, carbsG: 0, fatG: 0 },
        country: 'DO',
        preferences: [],
      }),
    };
    const [today] = withRebalance([DAY], adjusted);
    await render(
      <MealPlanPanel day={today} isDone={(slot) => slot === 'BREAKFAST'} onEaten={jest.fn()} />,
    );
    expect(screen.getByTestId('plan-rebalance-3-LUNCH')).toHaveTextContent(
      /^Ajustada por el iCoach · antes /,
    );
    expect(screen.getByTestId('plan-rebalance-day')).toHaveTextContent(
      /El iCoach ajustó tus comidas pendientes\.$/,
    );
  });

  it('shows an eaten meal with the portions "Lo comí" logged, not the planned ones', () => {
    const logged = {
      foods: MEALS[1].foods.slice(0, 2),
      totals: { calories: 632, proteinG: 40, carbsG: 60, fatG: 20 },
    };
    const [today] = withRebalance([DAY], { ...repro(), eaten: { LUNCH: logged } });
    const lunch = today.meals.find((m) => m.slot === 'LUNCH')!;
    expect(lunch.totals.calories).toBe(632);
    expect(lunch.foods).toBe(logged.foods);
    expect(lunch.rebalance).toBeUndefined();
  });

  it('leaves other days alone', () => {
    const tomorrow = { ...DAY, index: 4, date: '2026-11-12', isToday: false, isFuture: true };
    const [, next] = withRebalance([DAY, tomorrow], repro());
    expect(next).toBe(tomorrow);
  });

  it('explains the change on Inicio in one sentence, ES and EN', () => {
    const change = rebalanceCoachChange(repro());
    expect(change).toMatchObject({ kind: 'mealsRebalanced', meals: ['SNACK'], covered: true });
    const es = jest.requireActual('@/shared/localization/resources/es').es as Record<
      string,
      string
    >;
    const en = jest.requireActual('@/shared/localization/resources/en').en as Record<
      string,
      string
    >;
    expect(coachChangeText(change!, (key) => es[key] ?? key, 'es')).toBe(
      'Con Galleta de Soda ya cubriste tus calorías de hoy; tu merienda queda ligera u opcional.',
    );
    expect(coachChangeText(change!, (key) => en[key] ?? key, 'en')).toBe(
      "With the Galleta de Soda you've covered today's calories; your snack is now light or optional.",
    );
    expect(rebalanceCoachChange(null)).toBeNull();
  });
});
