import { fireEvent, render, screen } from '@testing-library/react-native';

import type { HomeSummary } from '@/features/dashboard/domain/home-summary';

import { NutritionTab } from './NutritionTab';

let mockLanguage: 'en' | 'es' = 'en';
let mockStatus = 'ready';
let mockView: unknown;
let mockItems: unknown[] = [];
const mockLoadHomeData = jest.fn();
const mockPanelProps = jest.fn();

const SUMMARY: HomeSummary = {
  week: { done: 0, goal: null, complete: false },
  weight: null,
  today: { kind: 'unknown' },
  coach: 'no-plan',
  calories: { consumed: 400, target: 2776, share: 400 / 2776 },
};

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (effect: () => void) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => effect(), [effect]);
  },
}));
jest.mock('../application/food-log.store', () => ({
  useFoodLogStore: (select: (state: { status: string; items: unknown[] }) => unknown) =>
    select({ status: mockStatus, items: mockItems }),
}));
jest.mock('./use-nutrition-plan-view', () => ({
  useNutritionPlanView: () => mockView,
}));
jest.mock('./meal-plan-day', () => {
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    PlanDayStrip: () => <RN.Text>day-strip</RN.Text>,
    MealPlanPanel: (props: { footer?: React.ReactNode }) => {
      mockPanelProps(props);
      return (
        <RN.View>
          <RN.Text>meal-panel</RN.Text>
          {props.footer}
        </RN.View>
      );
    },
  };
});
jest.mock('@/features/weekly-plan/presentation/PlanChangePrompt', () => ({
  PlanChangePrompt: () => null,
}));
jest.mock('@/features/subscriptions/presentation/SubscriptionAccessNotice', () => ({
  SubscriptionAccessNotice: () => null,
}));
jest.mock('@/features/dashboard/application/use-home-data', () => ({
  loadHomeData: () => mockLoadHomeData(),
  useHomeData: () => ({
    summary: SUMMARY,
    evaluation: {
      bmi: 25.8,
      bmiCategory: 'OVERWEIGHT',
      macros: [
        { kind: 'protein', target: 163, consumed: 30 },
        { kind: 'carbs', target: 358, consumed: 60.2 },
        { kind: 'fat', target: 77, consumed: null },
      ],
    },
  }),
}));
jest.mock('@/shared/localization', () => {
  const actual = jest.requireActual('@/shared/localization');
  const { en } = jest.requireActual('@/shared/localization/resources/en');
  const { es } = jest.requireActual('@/shared/localization/resources/es');
  return {
    ...actual,
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: keyof typeof en) => (mockLanguage === 'es' ? es[key] : en[key]),
    }),
  };
});

function push() {
  return jest.requireMock<{ router: { push: jest.Mock } }>('expo-router').router.push;
}

const TODAY = {
  index: 1,
  date: '2026-11-02',
  preview: false,
  isToday: true,
  isFuture: false,
  meals: [
    {
      slot: 'LUNCH',
      foods: [],
      totals: { calories: 600, proteinG: 0, carbsG: 0, fatG: 0 },
      substitutions: [{ from: 'no-such-food-a', to: 'no-such-food-b' }],
    },
  ],
  targets: { calories: 2000, proteinG: 0, carbsG: 0, fatG: 0 },
  totals: { calories: 600, proteinG: 0, carbsG: 0, fatG: 0 },
  safetyFloorApplied: false,
};

function ready() {
  return {
    state: {
      kind: 'ready',
      plan: { excludedAvoidTags: ['shellfish_allergy'], excludedCatalogKeys: [] },
      days: [TODAY],
      todayIndex: 1,
      overlay: null,
      saved: true,
    },
    shownDay: TODAY,
    shownIndex: 1,
    selectDay: jest.fn(),
    isDone: () => false,
    onEaten: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = 'en';
  mockStatus = 'ready';
  mockItems = [];
  mockView = ready();
});

describe('NutritionTab (v8.1, prototype layout)', () => {
  it("shows today's calorie ring and the three macros against their targets", async () => {
    await render(<NutritionTab />);

    expect(mockLoadHomeData).toHaveBeenCalled();
    const hidden = { includeHiddenElements: true };
    expect(screen.getByTestId('nutrition-calories', hidden)).toHaveTextContent('400');
    expect(screen.getByText('of 2,776', hidden)).toBeTruthy();
    expect(screen.getByLabelText('400 of 2,776 kcal today')).toBeOnTheScreen();
    expect(screen.getByTestId('nutrition-macro-protein')).toHaveTextContent('30/163 g', {
      exact: false,
    });
    expect(screen.getByTestId('nutrition-macro-fat')).toHaveTextContent('0/77 g', {
      exact: false,
    });
  });

  it('lists the foods kept off the plan and what the iCoach adjusted', async () => {
    await render(<NutritionTab />);

    expect(screen.getByTestId('nutrition-excluded')).toHaveTextContent('Shellfish', {
      exact: false,
    });
    expect(screen.getByTestId('nutrition-adjusted')).toHaveTextContent(
      'iCoach adjusted your plan',
      { exact: false },
    );
  });

  it('shows the 15-day strip and the day panel with extras and "Registrar comida"', async () => {
    mockItems = [
      {
        id: 'extra-1',
        mealType: 'SNACK',
        name: 'Beer',
        servingCount: 1,
        consumed: { calories: 150.4 },
        planned: false,
      },
      {
        id: 'planned-1',
        mealType: 'LUNCH',
        name: 'Rice',
        servingCount: 1,
        consumed: { calories: 200 },
        planned: true,
      },
    ];
    await render(<NutritionTab />);

    expect(screen.getByText('day-strip')).toBeOnTheScreen();
    const props = mockPanelProps.mock.calls[0][0] as { extras: { id: string }[] };
    expect(props.extras).toEqual([
      expect.objectContaining({ id: 'extra-1', slot: 'SNACK', calories: 150 }),
    ]);
    await fireEvent.press(screen.getByTestId('nutrition-food-log'));
    expect(push()).toHaveBeenCalledWith('/food-log');
  });

  it('keeps targets and preferences one tap away below', async () => {
    await render(<NutritionTab />);

    await fireEvent.press(screen.getByTestId('nutrition-targets'));
    expect(push()).toHaveBeenCalledWith('/nutrition-targets');
    await fireEvent.press(screen.getByTestId('nutrition-preferences'));
    expect(push()).toHaveBeenCalledWith('/dietary-preferences');
  });

  it('renders in Spanish with Spanish copy', async () => {
    mockLanguage = 'es';
    await render(<NutritionTab />);

    expect(screen.getByText(/^de 2.?776$/, { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('Fuera de tu plan por tu evaluación:')).toBeOnTheScreen();
    expect(screen.getByText('iCoach ajustó tu plan')).toBeOnTheScreen();
  });

  it('shows the honest Web state', async () => {
    mockStatus = 'web-unavailable';
    await render(<NutritionTab />);

    expect(screen.queryByText('meal-panel')).toBeNull();
    expect(screen.queryByTestId('nutrition-rows')).toBeNull();
  });
});
