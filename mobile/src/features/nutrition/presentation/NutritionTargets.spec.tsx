import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { DashboardState } from '@/features/dashboard/domain/dashboard.types';

import { NutritionTargets } from './NutritionTargets';

const refresh = jest.fn();

let mockState: DashboardState;
let mockLanguage: 'en' | 'es' = 'en';

jest.mock('@/features/dashboard/application/dashboard.store', () => ({
  useDashboardStore: () => mockState,
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
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

function nutrition(overrides: Record<string, unknown> = {}) {
  return {
    calories: 2500,
    adjustmentPct: -20,
    proteinG: 164,
    carbsG: 280,
    fatG: 74,
    safetyFloorApplied: false,
    ...overrides,
  };
}

function readyData(nutritionOverrides: Record<string, unknown> = {}, goal = 'FAT_LOSS') {
  return {
    assessment: {
      assessment: { nutrition: nutrition(nutritionOverrides) },
      engineInput: { goal },
      notes: [],
    },
    missing: [],
    sync: {
      pending: 0,
      inFlight: 0,
      failed: 0,
      conflicts: 0,
      status: 'idle',
      lastSyncedAt: null,
      message: null,
    },
  };
}

function setStore(partial: Partial<DashboardState>) {
  mockState = {
    status: 'ready',
    data: null,
    error: null,
    refresh,
    syncNow: jest.fn(),
    loadSampleData: jest.fn(),
    ...partial,
  } as unknown as DashboardState;
}

describe('NutritionTargets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'en';
  });

  it('refreshes the assessment on mount', async () => {
    setStore({ status: 'loading' });
    await render(<NutritionTargets />);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it('links to the 15-day meal plan from the ready state', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    setStore({ status: 'ready', data: readyData() as unknown as DashboardState['data'] });

    await render(<NutritionTargets />);
    fireEvent.press(screen.getByRole('button', { name: 'View your 15-day meal plan' }));

    expect(router.push).toHaveBeenCalledWith('/nutrition-plan');
  });

  it('renders calories, macro breakdown (grams + kcal), and goal adjustment', async () => {
    setStore({ status: 'ready', data: readyData() as unknown as DashboardState['data'] });

    await render(<NutritionTargets />);

    expect(screen.getByText('2,500 kcal')).toBeOnTheScreen();
    expect(
      screen.getByText('Calories are set 20% below maintenance to support fat loss.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('164g · 656 kcal')).toBeOnTheScreen();
    expect(screen.getByText('280g · 1120 kcal')).toBeOnTheScreen();
    expect(screen.getByText('74g · 666 kcal')).toBeOnTheScreen();
    // Non-medical disclaimer always present.
    expect(screen.getByText(/not medical or dietary advice/)).toBeOnTheScreen();
  });

  it('shows the safety-floor explanation only when the floor was applied', async () => {
    setStore({
      status: 'ready',
      data: readyData({ safetyFloorApplied: true }) as unknown as DashboardState['data'],
    });
    await render(<NutritionTargets />);
    expect(screen.getByText('Safe minimum applied')).toBeOnTheScreen();
  });

  it('hides the safety-floor explanation when the floor was not applied', async () => {
    setStore({ status: 'ready', data: readyData() as unknown as DashboardState['data'] });
    await render(<NutritionTargets />);
    expect(screen.queryByText('Safe minimum applied')).toBeNull();
  });

  it('shows a data-gap state and falls back to the dashboard when no specific gaps are known', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    setStore({
      status: 'empty',
      data: { assessment: null, missing: [], sync: {} } as unknown as DashboardState['data'],
    });

    await render(<NutritionTargets />);

    expect(screen.getByText('Finish your baseline first')).toBeOnTheScreen();
    fireEvent.press(
      screen.getByRole('button', { name: 'Go to the dashboard to finish your baseline' }),
    );
    expect(router.push).toHaveBeenCalledWith('/dashboard');
  });

  it('offers direct actions for the specific baseline gaps (profile + weight)', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    setStore({
      status: 'empty',
      data: {
        assessment: null,
        missing: [
          { id: 'birth-date', title: 'Add your birth date', detail: 'Age is required.' },
          { id: 'height', title: 'Add your height', detail: 'Height is required.' },
          { id: 'weight', title: 'Record a weight measurement', detail: 'Weight is required.' },
        ],
        sync: {},
      } as unknown as DashboardState['data'],
    });

    await render(<NutritionTargets />);

    // Profile-side gaps route to profile-edit; the weight gap routes to
    // Progress. No vague "go to dashboard" fallback when actions exist.
    await fireEvent.press(screen.getByTestId('nutrition-gap-profile'));
    expect(router.push).toHaveBeenCalledWith('/profile-edit');
    await fireEvent.press(screen.getByTestId('nutrition-gap-weight'));
    expect(router.push).toHaveBeenCalledWith('/progress');
    expect(screen.queryByTestId('nutrition-gap-dashboard')).toBeNull();
  });

  it('renders a loading state', async () => {
    setStore({ status: 'loading' });
    await render(<NutritionTargets />);
    expect(screen.getByLabelText('Loading nutrition targets')).toBeOnTheScreen();
  });

  it('surfaces a safe error banner', async () => {
    setStore({ status: 'error', error: 'The dashboard could not be loaded right now.' });
    await render(<NutritionTargets />);
    expect(screen.getByText('Nutrition unavailable')).toBeOnTheScreen();
  });

  it('renders targets, goal explanation, and controls in Spanish', async () => {
    mockLanguage = 'es';
    setStore({ status: 'ready', data: readyData() as unknown as DashboardState['data'] });

    await render(<NutritionTargets />);

    expect(screen.getByText('Objetivos nutricionales')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Las calorías se establecen 20% por debajo del nivel de mantenimiento para apoyar la pérdida de grasa.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Ver tu plan alimentario de 15 días' }),
    ).toBeOnTheScreen();
  });

  it('renders a distinct web-unavailable state in English with no data, gap, error, or controls (ADR-P019)', async () => {
    setStore({ status: 'web-unavailable', data: null });
    await render(<NutritionTargets />);

    expect(screen.getByText("Nutrition targets aren't available on the web")).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Use the AppFitness mobile app to view your personalized calorie and macro targets.',
      ),
    ).toBeOnTheScreen();
    // Header preserved.
    expect(screen.getByText('Nutrition targets')).toBeOnTheScreen();
    // Not a generic error, no data-gap, no plan navigation, no disclaimer/content.
    expect(screen.queryByText('Nutrition unavailable')).toBeNull();
    expect(screen.queryByText('Finish your baseline first')).toBeNull();
    expect(screen.queryByRole('button', { name: 'View your 15-day meal plan' })).toBeNull();
    expect(screen.queryByText(/not medical or dietary advice/)).toBeNull();
  });

  it('renders the web-unavailable state in Spanish', async () => {
    mockLanguage = 'es';
    setStore({ status: 'web-unavailable', data: null });
    await render(<NutritionTargets />);

    expect(
      screen.getByText('Los objetivos nutricionales no están disponibles en la web'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Usa la app móvil de AppFitness para ver tus objetivos personalizados de calorías y macronutrientes.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Ver tu plan alimentario de 15 días' })).toBeNull();
  });
});
