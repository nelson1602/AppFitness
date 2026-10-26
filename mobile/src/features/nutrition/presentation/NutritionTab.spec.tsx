import { fireEvent, render, screen } from '@testing-library/react-native';

import type { HomeSummary } from '@/features/dashboard/domain/home-summary';

import { NutritionTab } from './NutritionTab';

let mockLanguage: 'en' | 'es' = 'en';
let mockStatus = 'ready';
const mockLoadHomeData = jest.fn();

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
  useFoodLogStore: (select: (state: { status: string }) => unknown) =>
    select({ status: mockStatus }),
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

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = 'en';
  mockStatus = 'ready';
});

describe('NutritionTab (ADR-P039)', () => {
  it("shows today's calories and macros against the targets", async () => {
    mockLanguage = 'es';
    await render(<NutritionTab />);

    expect(mockLoadHomeData).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('header', { name: 'Hoy' })).toBeOnTheScreen();
    expect(screen.getByTestId('nutrition-calories')).toHaveTextContent('400 de 2776 kcal');
    expect(screen.getByTestId('nutrition-macro-protein')).toHaveTextContent('Proteína30 g');
    expect(screen.getByLabelText('Carbohidratos: 60 de 358 g hoy')).toBeOnTheScreen();
    expect(screen.getByTestId('nutrition-macro-fat')).toHaveTextContent('Grasa0 g');
  });

  it.each([
    ['nutrition-food-log', '/food-log'],
    ['nutrition-plan', '/nutrition-plan'],
    ['nutrition-targets', '/nutrition-targets'],
    ['nutrition-preferences', '/dietary-preferences'],
  ] as const)('%s opens %s', async (testID, href) => {
    await render(<NutritionTab />);
    await fireEvent.press(screen.getByTestId(testID));
    expect(push()).toHaveBeenCalledWith(href);
  });

  it('renders the honest Web state with no data and no actions (ADR-P019)', async () => {
    mockStatus = 'web-unavailable';
    await render(<NutritionTab />);

    expect(screen.queryByTestId('nutrition-today-card')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
