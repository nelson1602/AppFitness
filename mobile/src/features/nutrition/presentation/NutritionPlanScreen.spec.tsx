import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { lightTheme } from '@/shared/theme';

import type { DashboardState } from '@/features/dashboard/domain/dashboard.types';

import type { MealMacros, MealPlan, MealPlanDay, MealSlot } from '../domain/meal-plan';
import type { MealPlanSelection } from '../application/meal-plan.service';
import type { DietaryPreferenceState } from '../application/dietary-preference.store';
import { NutritionPlanScreen } from './NutritionPlanScreen';
import {
  beginEntitlementCheck,
  configureEntitlementEnforcement,
  setEntitlementAccess,
} from '@/shared/application/entitlement-access';

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
  bindStoreToSession: jest.fn(),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../application/meal-plan.service', () => ({
  selectMealPlan: (...args: unknown[]) => {
    lastSelectArgs = args;
    return mockSelection;
  },
}));
const mockMarkMealEaten = jest.fn();
let mockPlanState: Record<string, unknown> = {};
jest.mock('@/features/weekly-plan/application/weekly-plan.store', () => ({
  useWeeklyPlanStore: Object.assign(() => mockPlanState, { getState: () => ({ load: jest.fn() }) }),
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
    // The real joiner, so the value–unit separator under test is the shipped one.
    formatQuantity: jest.requireActual('@/shared/localization/format').formatQuantity,
    formatDate: jest.requireActual('@/shared/localization/format').formatDate,
    interpolate: jest.requireActual('@/shared/localization/format').interpolate,
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: string) => (mockLanguage === 'es' ? es[key] : en[key]) ?? key,
    }),
  };
});

let lastSelectArgs: unknown[] = [];

/** v8 Block 3: a meal's ingredients show once it is opened. */
async function openAllMeals(day: number) {
  for (const slot of ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']) {
    await fireEvent.press(screen.getByTestId(`plan-meal-toggle-${day}-${slot}`));
  }
}

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
    mockPlanState = {
      current: null,
      revisions: [],
      mealSlotsDone: [],
      overlay: null,
      markMealEaten: mockMarkMealEaten,
    };
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
    expect(screen.getByText('Meal plan · day 1')).toBeOnTheScreen();
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
    expect(screen.getByText('Meal plan · day 1')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Applied dietary preferences')).toBeNull();
  });

  it('renders day 1 with all four meal slots, foods, portions, calories and macros', async () => {
    await render(<NutritionPlanScreen />);

    expect(screen.getByText('Meal plan · day 1')).toBeOnTheScreen();
    for (const label of ['Breakfast', 'Lunch', 'Dinner', 'Snack']) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
    // v8 Block 3: each meal names its foods and opens to its ingredients.
    expect(screen.getByText('BREAKFAST food 1')).toBeOnTheScreen();
    expect(screen.getAllByText('590 kcal · 1 ingredient')).toHaveLength(4);
    await openAllMeals(1);
    expect(screen.getAllByText(/^[A-Z]+ food 1 · 150 g$/)).toHaveLength(4);
    expect(screen.getAllByText('300 kcal')).toHaveLength(4);
    expect(screen.getAllByText('Protein 33 g · Carbs 66 g · Fat 19 g')).toHaveLength(4);
    // v8: no "1.5×" multiplier.
    expect(screen.queryByText(/×/)).toBeNull();
  });

  it("opens and closes a meal's ingredients", async () => {
    await render(<NutritionPlanScreen />);
    expect(screen.queryByTestId('plan-ingredients-1-LUNCH')).toBeNull();

    await fireEvent.press(screen.getByTestId('plan-meal-toggle-1-LUNCH'));
    expect(screen.getByTestId('plan-ingredients-1-LUNCH')).toBeOnTheScreen();
    expect(screen.getByText('590 kcal · Hide ingredients')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('plan-meal-toggle-1-LUNCH'));
    expect(screen.queryByTestId('plan-ingredients-1-LUNCH')).toBeNull();
  });

  it('renders day totals versus targets', async () => {
    await render(<NutritionPlanScreen />);
    expect(screen.getByText('Calories: 2,312 / 2,300 kcal')).toBeOnTheScreen();
    expect(
      screen.getByText('Protein 128 / 130 g · Carbs 262 / 260 g · Fat 74 / 76 g'),
    ).toBeOnTheScreen();
  });

  /**
   * BUG-028. The plan joined each value to its unit with a plain space, so at
   * large text a line could break inside "Carbohidratos 36 g". The raw text
   * (no whitespace normalizer) must join every value and unit with U+00A0 in
   * English and Spanish, leave no breakable value–unit space, and leave the
   * accessibility labels untouched.
   */
  describe('keeps every value joined to its unit (BUG-028)', () => {
    const raw = { normalizer: (text: string) => text };
    const N = '\u00A0';

    it.each([
      [
        'en',
        new RegExp(`^Protein 33${N}g · Carbs 66${N}g · Fat 19${N}g$`),
        `Calories: 2,312 / 2,300${N}kcal`,
        `Protein 128 / 130${N}g · Carbs 262 / 260${N}g · Fat 74 / 76${N}g`,
        `Day 1 target: 2,300${N}kcal · Protein 130${N}g · Carbs 260${N}g · Fat 76${N}g.`,
      ],
      [
        'es',
        new RegExp(`^Proteína 33${N}g · Carbohidratos 66${N}g · Grasa 19${N}g$`),
        `Calorías: 2312 / 2300${N}kcal`,
        `Proteína 128 / 130${N}g · Carbohidratos 262 / 260${N}g · Grasa 74 / 76${N}g`,
        `Día 1 objetivo: 2300${N}kcal · Proteína 130${N}g · Carbohidratos 260${N}g · Grasa 76${N}g.`,
      ],
    ] as const)(
      'joins values and units in %s',
      async (language, foodLine, calories, macros, summary) => {
        mockLanguage = language;
        await render(<NutritionPlanScreen />);

        await openAllMeals(1);
        expect(screen.getAllByText(foodLine, raw)).toHaveLength(4);
        expect(screen.getAllByText(new RegExp(`^590${N}kcal · `), raw)).toHaveLength(4);
        expect(screen.getByText(calories, raw)).toBeOnTheScreen();
        expect(screen.getByText(macros, raw)).toBeOnTheScreen();
        expect(screen.getByText(summary, raw)).toBeOnTheScreen();
        expect(screen.queryAllByText(/\d (g|kcal)\b/, raw)).toEqual([]);

        const root = screen.root;
        if (root === null) throw new Error('NutritionPlanScreen rendered no root');
        const labelsWithNbsp = root.queryAll(
          (node) =>
            typeof node.props.accessibilityLabel === 'string' &&
            node.props.accessibilityLabel.includes(N),
        );
        expect(labelsWithNbsp).toEqual([]);
      },
    );
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
    expect(screen.getByText('Meal plan · day 1')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('plan-day-3'));
    expect(screen.getByText('Meal plan · day 3')).toBeOnTheScreen();
    expect(screen.queryByText('Meal plan · day 1')).toBeNull();
  });

  it('moves between days with the arrows and says which day of how many', async () => {
    await render(<NutritionPlanScreen />);
    expect(screen.getByText('Day 1 of 3')).toBeOnTheScreen();
    expect(screen.getByTestId('plan-day-previous')).toBeDisabled();

    await fireEvent.press(screen.getByTestId('plan-day-next'));
    expect(screen.getByText('Meal plan · day 2')).toBeOnTheScreen();
    expect(screen.getByText('Day 2 of 3')).toBeOnTheScreen();
  });

  /**
   * ADR-P022 Addendum A carried into the redesign: the selected chip is the
   * prototype's cyan, labelled with the dark stage ink, never a light tone.
   */
  it('labels the selected day chip dark on cyan, the others light on glass', async () => {
    await render(<NutritionPlanScreen />);

    const colorOf = (text: string) =>
      StyleSheet.flatten(screen.getByText(text).props.style as StyleProp<TextStyle>)?.color;

    expect(colorOf('1')).toBe(lightTheme.colors.stageDeep);
    expect(colorOf('3')).toBe(lightTheme.colors.onStage);

    await fireEvent.press(screen.getByTestId('plan-day-3'));

    expect(colorOf('3')).toBe(lightTheme.colors.stageDeep);
    expect(colorOf('1')).toBe(lightTheme.colors.onStage);
  });

  it('shows a data-gap state and falls back to the dashboard when no specific gaps are known', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    setDash({ status: 'empty' });
    mockSelection = { status: 'gap' };

    await render(<NutritionPlanScreen />);
    expect(screen.getByText('Complete your basic info first')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Go to Home to complete your basic info' }));
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

    expect(screen.getByText('Plan de 15 días')).toBeOnTheScreen();
    expect(screen.getByText('Plan de comidas · día 1')).toBeOnTheScreen();
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

  it('renders a distinct web-unavailable state in English with no plan, gap, error, or controls (ADR-P019)', async () => {
    setDash({ status: 'web-unavailable', data: null });
    await render(<NutritionPlanScreen />);

    expect(screen.getByText("Your meal plan isn't available on the web")).toBeOnTheScreen();
    expect(
      screen.getByText('Use the AppFitnessRD mobile app to view and follow your 15-day meal plan.'),
    ).toBeOnTheScreen();
    // v8 Block 3: the stack header names the screen; the intro stays.
    expect(screen.getByText(/meal plan built from your iCoach targets/i)).toBeOnTheScreen();
    // No food-log link, no plan/day content, no gap, no error, no disclaimer.
    expect(screen.queryByTestId('open-food-log')).toBeNull();
    expect(screen.queryByText('Meal plan · day 1')).toBeNull();
    expect(screen.queryByText('Meal plan unavailable')).toBeNull();
    expect(screen.queryByText('Complete your basic info first')).toBeNull();
    expect(screen.queryByText(/not medical or dietary advice/)).toBeNull();
  });

  it('degrades to web-unavailable when the dietary-preference store is web-unavailable (ADR-P019)', async () => {
    // Dashboard ready but the preference store is dormant on Web: still degrade,
    // never render a plan built from a half-available local database.
    setDash({ status: 'ready' });
    setPrefs({ status: 'web-unavailable', preferences: [] });
    await render(<NutritionPlanScreen />);

    expect(screen.getByText("Your meal plan isn't available on the web")).toBeOnTheScreen();
    expect(screen.queryByText('Meal plan · day 1')).toBeNull();
    expect(screen.queryByTestId('open-food-log')).toBeNull();
  });

  it('renders the web-unavailable state in Spanish', async () => {
    mockLanguage = 'es';
    setDash({ status: 'web-unavailable', data: null });
    await render(<NutritionPlanScreen />);

    expect(screen.getByText('Tu plan alimentario no está disponible en la web')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Usa la app móvil de AppFitnessRD para ver y seguir tu plan alimentario de 15 días.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('open-food-log')).toBeNull();
    expect(screen.queryByText('Plan de comidas · día 1')).toBeNull();
  });
});

describe('S-4 read-only: no new iCoach meal-plan generation', () => {
  beforeEach(() => {
    // Same baseline as the main suite: a ready, native, English dashboard.
    jest.clearAllMocks();
    mockLanguage = 'en';
    setDash({});
    setPrefs({});
  });

  afterEach(async () => {
    // Restore the default disabled projection through the production API,
    // inside act: the still-mounted screen re-renders on the publication.
    await act(async () => {
      configureEntitlementEnforcement(false);
    });
  });

  it.each([
    ['read-only', false],
    ['checking', null],
  ] as const)(
    'shows the access notice and never generates a plan while %s',
    async (_mode, active) => {
      configureEntitlementEnforcement(true);
      beginEntitlementCheck('user-1');
      if (active !== null) setEntitlementAccess('user-1', active);
      mockSelection = { status: 'ready', plan: plan() };
      lastSelectArgs = [];

      await render(<NutritionPlanScreen />);

      expect(screen.getByTestId('subscription-access-notice')).toBeOnTheScreen();
      expect(lastSelectArgs).toEqual([]);
    },
  );

  it('generates normally once the entitlement is active', async () => {
    configureEntitlementEnforcement(true);
    beginEntitlementCheck('user-1');
    setEntitlementAccess('user-1', true);
    mockSelection = { status: 'ready', plan: plan() };
    lastSelectArgs = [];

    await render(<NutritionPlanScreen />);

    expect(screen.queryByTestId('subscription-access-notice')).toBeNull();
    expect(lastSelectArgs.length).toBeGreaterThan(0);
  });
});

describe('NutritionPlanScreen — saved week (ADR-P042 D9)', () => {
  const today = new Date();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekStart = iso(monday);
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return iso(d);
  });

  function savedPlan() {
    const days = dates.map((date, i) => ({
      date,
      workout: { kind: 'RECOVERY', recovery: 'FULL_REST' },
      meals: day(i + 1).meals.map((meal) => ({
        slot: meal.slot,
        foods: meal.foods,
        totals: meal.totals,
      })),
    }));
    days[0].meals[0] = {
      ...days[0].meals[0],
      substitutions: [{ from: 'food.egg_whole', to: 'food.chicken_breast' }],
    } as never;
    return {
      id: 'p1',
      userId: 'user-1',
      weekStart,
      revision: 1,
      effectiveFrom: weekStart,
      trigger: 'WEEKLY',
      loadStep: 0,
      inputsFingerprint: 'x',
      ruleVersions: {},
      plan: {
        contractVersion: 'weekly-plan@1',
        targets: { calories: 2300, proteinG: 130, carbsG: 260, fatG: 76, floorCalories: 1500 },
        inputs: {},
        days,
      },
      notes: [],
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'en';
    setDash({});
    setPrefs({});
    const fifteen = { ...plan(), days: Array.from({ length: 15 }, (_, i) => day(i + 1)) };
    mockSelection = { status: 'ready', plan: fifteen };
    const saved = savedPlan();
    mockPlanState = {
      current: saved,
      revisions: [saved],
      mealSlotsDone: [`${dates[0]}|LUNCH`],
      overlay: null,
      markMealEaten: mockMarkMealEaten,
    };
  });

  it('opens on today, labels the saved week and offers "I ate it" up to today', async () => {
    await render(<NutritionPlanScreen />);
    expect(screen.getByTestId('plan-saved-week')).toHaveTextContent(
      "This week's plan. It renews on Monday.",
    );
    const todayIndex = ((today.getDay() + 6) % 7) + 1;
    await fireEvent.press(screen.getByTestId(`plan-ate-${todayIndex}-BREAKFAST`));
    expect(mockMarkMealEaten).toHaveBeenCalledWith(dates[todayIndex - 1], 'BREAKFAST');
  });

  it('shows eaten slots and the iCoach substitution on Monday', async () => {
    await render(<NutritionPlanScreen />);
    await fireEvent.press(screen.getByTestId('plan-day-1'));
    expect(screen.getByTestId('plan-eaten-1-LUNCH')).toBeOnTheScreen();
    expect(screen.queryByTestId('plan-ate-1-LUNCH')).toBeNull();
    expect(screen.getByText(/Adjusted by iCoach:/)).toBeOnTheScreen();
  });

  it('labels days 8–15 as a preview that may change on Monday, without "I ate it"', async () => {
    await render(<NutritionPlanScreen />);
    await fireEvent.press(screen.getByTestId('plan-day-8'));
    expect(screen.getByTestId('plan-preview-badge')).toHaveTextContent('May change on Monday');
    expect(screen.queryByTestId('plan-ate-8-BREAKFAST')).toBeNull();
  });

  it("explains today's off-plan adjustment", async () => {
    mockPlanState = {
      ...mockPlanState,
      overlay: {
        todayCalories: 2050,
        reducedBy: 250,
        extraCardioMinutes: 25,
        avoidIntenseTraining: true,
      },
    };
    await render(<NutritionPlanScreen />);
    expect(screen.getByTestId('plan-overlay')).toHaveTextContent(/2,050 kcal \(250 less\)/);
    expect(screen.getByTestId('plan-overlay')).toHaveTextContent(/25 min of cardio/);
    expect(screen.getByTestId('plan-overlay')).toHaveTextContent(/avoid intense training/);
  });
});
