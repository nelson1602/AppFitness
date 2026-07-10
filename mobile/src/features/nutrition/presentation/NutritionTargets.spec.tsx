import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { DashboardState } from '@/features/dashboard/domain/dashboard.types';

import { NutritionTargets } from './NutritionTargets';

const refresh = jest.fn();

let mockState: DashboardState;

jest.mock('@/features/dashboard/application/dashboard.store', () => ({
  useDashboardStore: () => mockState,
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

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

    expect(screen.getByText('2500 kcal')).toBeOnTheScreen();
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

  it('shows a data-gap state and routes to the dashboard when no assessment exists', async () => {
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
});
