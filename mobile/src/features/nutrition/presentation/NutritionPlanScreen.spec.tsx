import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { DashboardState } from '@/features/dashboard/domain/dashboard.types';

import type { MealMacros, MealPlan, MealPlanDay, MealSlot } from '../domain/meal-plan';
import type { MealPlanSelection } from '../application/meal-plan.service';
import type { DietaryPreferenceState } from '../application/dietary-preference.store';
import { NutritionPlanScreen } from './NutritionPlanScreen';

const refresh = jest.fn();
const loadPreferences = jest.fn();
let mockDash: DashboardState;
let mockSelection: MealPlanSelection;
let mockPrefs: DietaryPreferenceState;
let mockLanguage: 'en' | 'es' = 'en';

jest.mock('@/features/dashboard/application/dashboard.store', () => ({
  useDashboardStore: () => mockDash,
}));
jest.mock('@/features/authentication', () => ({
  getSession: () => ({ user: { id: 'user-1' } }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../application/meal-plan.service', () => ({
  selectMealPlan: (...args: unknown[]) => {
    lastSelectArgs = args;
    return mockSelection;
  },
}));
jest.mock('../application/dietary-preference.store', () => ({
  useDietaryPreferenceStore: () => mockPrefs,
}));
jest.mock('@/shared/localization', () => {
  const { en } = jest.requireActual('@/shared/localization/resources/en') as {
    en: Record<string, string>;
  };
  const { es } = jest.requireActual('@/shared/localization/resources/es') as {
    es: Record<string, string>;
  };
  return {
    formatNumber: (value: number, language: 'en' | 'es') =>
      new Intl.NumberFormat(language === 'es' ? 'es' : 'en-US').format(value),
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: string) => (mockLanguage === 'es' ? es[key] : en[key]) ?? key,
    }),
  };
});

let lastSelectArgs: unknown[] = [];

function setPrefs(partial: Partial<DietaryPreferenceState> = {}) {
  mockPrefs = {
    status: 'ready',
    preferences: [],
    error: null,
    load: loadPreferences,
    add: jest.fn(),
    remove: jest.fn(),
    ...partial,
  } as unknown as DietaryPreferenceState;
}

function macros(c: number, p: number, cb: number, f: number): MealMacros {
  return { calories: c, proteinG: p, carbsG: cb, fatG: f };
}

function day(n: number): MealPlanDay {
  const slots: MealSlot[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];
  return {
    day: n,
    targets: macros(2300, 130, 260, 76),
    totals: macros(2312, 128, 262, 74),
    rationale: {
      ruleVersion: 'meal-rules@1.0.0',
      summary: `Day ${n} targets 2300 kcal (130g protein, 260g carbs, 76g fat).`,
      safetyFloorApplied: false,
      notes: [],
    },
    meals: slots.map((slot) => ({
      slot,
      targets: macros(600, 34, 68, 20),
      totals: macros(590, 33, 66, 19),
      rationale: `${slot} rationale`,
      foods: [
        {
          foodId: `food.${slot.toLowerCase()}_item_${n}`,
          name: `${slot} food ${n}`,
          servings: 1.5,
          serving: { amount: 150, unit: 'g' },
          macros: macros(300, 20, 30, 8),
        },
      ],
    })),
  };
}

function plan(): MealPlan {
  return {
    ruleVersion: 'meal-rules@1.0.0',
    catalogVersion: 'food-catalog@1.0.0',
    goalType: 'MAINTENANCE',
    targets: macros(2300, 130, 260, 76),
    excludedAvoidTags: [],
    excludedCatalogKeys: [],
    days: [day(1), day(2), day(3)],
    rationale: 'Deterministic plan.',
  };
}

function setDash(partial: Partial<DashboardState>) {
  mockDash = {
    status: 'ready',
    data: { assessment: {}, missing: [], sync: {} },
    error: null,
    refresh,
    syncNow: jest.fn(),
    loadSampleData: jest.fn(),
    ...partial,
  } as unknown as DashboardState;
}

describe('NutritionPlanScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'en';
    setDash({});
    setPrefs({});
    lastSelectArgs = [];
    mockSelection = { status: 'ready', plan: plan() };
  });

  it('refreshes the assessment on mount', async () => {
    await render(<NutritionPlanScreen />);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it('loads active dietary preferences on mount and feeds them to plan selection', async () => {
    const preferences = [{ id: 'dp-1', avoidTag: 'nut_allergy' }];
    setPrefs({ status: 'ready', preferences: preferences as never });

    await render(<NutritionPlanScreen />);

    await waitFor(() => expect(loadPreferences).toHaveBeenCalledTimes(1));
    // selectMealPlan receives (assessment, userId, activePreferences).
    expect(lastSelectArgs[2]).toEqual(preferences);
  });

  it('shows the loading state until preferences finish loading', async () => {
    setPrefs({ status: 'loading', preferences: [] });
    await render(<NutritionPlanScreen />);
    expect(screen.getByLabelText('Loading meal plan')).toBeOnTheScreen();
  });

  it('still renders the plan (with no exclusions) when preference loading fails', async () => {
    setPrefs({ status: 'error', preferences: [], error: 'nope' });
    await render(<NutritionPlanScreen />);
    // Plan renders; preferences omitted (empty) → no exclusions card.
    expect(screen.getByText('Day 1')).toBeOnTheScreen();
    expect(lastSelectArgs[2]).toEqual([]);
    expect(screen.queryByLabelText('Applied dietary preferences')).toBeNull();
  });

  it('explains applied exclusions when the plan removed foods', async () => {
    mockSelection = {
      status: 'ready',
      plan: { ...plan(), excludedAvoidTags: ['nut_allergy'], excludedCatalogKeys: ['food.tofu'] },
    };
    await render(<NutritionPlanScreen />);
    expect(screen.getByLabelText('Applied dietary preferences')).toBeOnTheScreen();
    expect(screen.getByText(/Avoided categories: Nuts/)).toBeOnTheScreen();
    expect(screen.getByText(/Excluded foods:/)).toBeOnTheScreen();
  });

  it('renders no exclusions card when the plan excluded nothing (unchanged ready state)', async () => {
    await render(<NutritionPlanScreen />);
    expect(screen.getByText('Day 1')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Applied dietary preferences')).toBeNull();
  });

  it('renders day 1 with all four meal slots, foods, portions, calories and macros', async () => {
    await render(<NutritionPlanScreen />);

    expect(screen.getByText('Day 1')).toBeOnTheScreen();
    for (const label of ['Breakfast', 'Lunch', 'Dinner', 'Snack']) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
    expect(screen.getByText('BREAKFAST food 1')).toBeOnTheScreen();
    // portion + servings + calories + macros line (one per meal → 4)
    expect(
      screen.getAllByText(/150 g · 1\.5× · 300 kcal · Protein 20 g \/ Carbs 30 g \/ Fat 8 g/),
    ).toHaveLength(4);
  });

  it('renders day totals versus targets', async () => {
    await render(<NutritionPlanScreen />);
    expect(screen.getByText('Calories: 2,312 / 2,300 kcal')).toBeOnTheScreen();
    expect(
      screen.getByText('Protein 128 / 130 g · Carbs 262 / 260 g · Fat 74 / 76 g'),
    ).toBeOnTheScreen();
  });

  it('renders the day rationale and the non-medical disclaimer', async () => {
    await render(<NutritionPlanScreen />);
    expect(
      screen.getByText('Day 1 target: 2,300 kcal · Protein 130 g · Carbs 260 g · Fat 76 g.'),
    ).toBeOnTheScreen();
    expect(screen.getByText(/not medical or dietary advice/)).toBeOnTheScreen();
  });

  it('switches days when a day chip is tapped', async () => {
    await render(<NutritionPlanScreen />);
    expect(screen.getByText('Day 1')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('plan-day-3'));
    expect(screen.getByText('Day 3')).toBeOnTheScreen();
    expect(screen.queryByText('Day 1')).toBeNull();
  });

  it('shows a data-gap state and falls back to the dashboard when no specific gaps are known', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    setDash({ status: 'empty' });
    mockSelection = { status: 'gap' };

    await render(<NutritionPlanScreen />);
    expect(screen.getByText('Finish your baseline first')).toBeOnTheScreen();
    fireEvent.press(
      screen.getByRole('button', { name: 'Go to the dashboard to finish your baseline' }),
    );
    expect(router.push).toHaveBeenCalledWith('/dashboard');
  });

  it('offers direct actions for the specific baseline gaps (profile + weight)', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    setDash({
      status: 'empty',
      data: {
        assessment: null,
        missing: [
          { id: 'profile', title: 'Create your profile', detail: 'Profile is required.' },
          { id: 'weight', title: 'Record a weight measurement', detail: 'Weight is required.' },
        ],
        sync: {},
      } as unknown as DashboardState['data'],
    });
    mockSelection = { status: 'gap' };

    await render(<NutritionPlanScreen />);
    await fireEvent.press(screen.getByTestId('nutrition-gap-profile'));
    expect(router.push).toHaveBeenCalledWith('/profile-edit');
    await fireEvent.press(screen.getByTestId('nutrition-gap-weight'));
    expect(router.push).toHaveBeenCalledWith('/progress');
    expect(screen.queryByTestId('nutrition-gap-dashboard')).toBeNull();
  });

  it('renders a loading state', async () => {
    setDash({ status: 'loading' });
    await render(<NutritionPlanScreen />);
    expect(screen.getByLabelText('Loading meal plan')).toBeOnTheScreen();
  });

  it('surfaces a dashboard error', async () => {
    setDash({ status: 'error', error: 'The dashboard could not be loaded right now.' });
    await render(<NutritionPlanScreen />);
    expect(screen.getByText('Meal plan unavailable')).toBeOnTheScreen();
  });

  it('surfaces a meal-plan generation error', async () => {
    mockSelection = { status: 'error', message: 'Your meal plan could not be built right now.' };
    await render(<NutritionPlanScreen />);
    expect(screen.getByText('Meal plan unavailable')).toBeOnTheScreen();
    expect(
      screen.getByText('Your meal plan could not be built right now. Try again later.'),
    ).toBeOnTheScreen();
  });

  it('renders the structured meal-plan presentation in Spanish', async () => {
    mockLanguage = 'es';
    const localizedPlan = plan();
    localizedPlan.days[0].meals[0].foods[0] = {
      ...localizedPlan.days[0].meals[0].foods[0],
      foodId: 'food.chicken_breast',
      name: 'Chicken breast, cooked',
    };
    mockSelection = { status: 'ready', plan: localizedPlan };
    await render(<NutritionPlanScreen />);

    expect(screen.getByText('Plan alimentario de 15 días')).toBeOnTheScreen();
    expect(screen.getByText('Día 1')).toBeOnTheScreen();
    for (const label of ['Desayuno', 'Almuerzo', 'Cena', 'Merienda']) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
    expect(screen.getByText('Calorías: 2312 / 2300 kcal')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Día 1 objetivo: 2300 kcal · Proteína 130 g · Carbohidratos 260 g · Grasa 76 g.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Pechuga de pollo, cocida')).toBeOnTheScreen();
    expect(localizedPlan.days[0].meals[0].foods[0].foodId).toBe('food.chicken_breast');
    expect(screen.queryByText(day(1).rationale.summary)).toBeNull();
  });

  it('changes only presentation locale while preserving deterministic plan selection', async () => {
    const selectedPlan = plan();
    mockSelection = { status: 'ready', plan: selectedPlan };
    mockLanguage = 'es';
    await render(<NutritionPlanScreen />);

    expect(screen.getByText('BREAKFAST food 1')).toBeOnTheScreen();
    expect(lastSelectArgs[0]).toBe(mockDash.data?.assessment);
    expect(mockSelection).toEqual({ status: 'ready', plan: selectedPlan });
  });
});
