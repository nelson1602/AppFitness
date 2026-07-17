import { fireEvent, render, screen } from '@testing-library/react-native';

import type { FoodLogState } from '../application/food-log.store';
import type { DietaryPreferenceState } from '../application/dietary-preference.store';
import type { DietaryPreference } from '../domain/dietary-preference';
import type { LoggedMealItem } from '../domain/food-log';
import { FoodLogScreen } from './FoodLogScreen';

let mockState: FoodLogState;
let mockPrefs: DietaryPreferenceState;
let mockNutrition: { calories: number; proteinG: number; carbsG: number; fatG: number } | null;

const loadPreferences = jest.fn();

jest.mock('../application/food-log.store', () => ({
  useFoodLogStore: (selector?: (s: FoodLogState) => unknown) =>
    selector ? selector(mockState) : mockState,
}));
jest.mock('../application/dietary-preference.store', () => ({
  useDietaryPreferenceStore: (selector?: (s: DietaryPreferenceState) => unknown) =>
    selector ? selector(mockPrefs) : mockPrefs,
}));

function setPrefs(
  preferences: DietaryPreference[] = [],
  status: DietaryPreferenceState['status'] = 'ready',
): void {
  mockPrefs = {
    status,
    preferences,
    error: null,
    load: loadPreferences,
    add: jest.fn(),
    remove: jest.fn(),
  } as unknown as DietaryPreferenceState;
}
jest.mock('@/features/dashboard/application/dashboard.store', () => ({
  useDashboardStore: (
    selector?: (
      s: { data: { assessment: { assessment: { nutrition: unknown } } } | null } | unknown,
    ) => unknown,
  ) => {
    const s = {
      data: mockNutrition ? { assessment: { assessment: { nutrition: mockNutrition } } } : null,
    };
    return selector ? selector(s) : s;
  },
}));

function item(overrides: Partial<LoggedMealItem> = {}): LoggedMealItem {
  return {
    id: 'i1',
    mealType: 'LUNCH',
    foodId: 'f1',
    catalogKey: 'food.chicken_breast',
    name: 'Chicken breast, cooked',
    servingCount: 2,
    serving: { amount: 100, unit: 'g' },
    consumed: { calories: 320, proteinG: 62, carbsG: 0, fatG: 8, fiberG: null },
    syncState: 'pending',
    ...overrides,
  };
}

function setState(overrides: Partial<FoodLogState> = {}): void {
  mockState = {
    status: 'ready',
    date: '2026-07-13',
    items: [],
    totals: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: null },
    sync: { state: 'idle', pending: 0, actionRequired: 0 },
    error: null,
    load: jest.fn(),
    addFood: jest.fn(),
    editServing: jest.fn(),
    removeItem: jest.fn(),
    syncNow: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockNutrition = { calories: 2000, proteinG: 150, carbsG: 200, fatG: 60 };
  setState();
  setPrefs();
});

describe('FoodLogScreen (Slice 4C)', () => {
  it('loads the log on mount', async () => {
    await render(<FoodLogScreen />);
    expect(mockState.load).toHaveBeenCalledTimes(1);
  });

  it('loads active dietary preferences on mount (ADR-P014 Slice 4)', async () => {
    await render(<FoodLogScreen />);
    expect(loadPreferences).toHaveBeenCalledTimes(1);
  });

  it('surfaces a dietary-preference warning when a matching food is selected', async () => {
    setPrefs([
      {
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
      },
    ]);
    await render(<FoodLogScreen />);

    await fireEvent.changeText(screen.getByTestId('food-search-input'), 'almonds');
    await fireEvent.press(await screen.findByText('Almonds'));

    expect(screen.getByText('Heads up — this matches an allergy or sensitivity')).toBeOnTheScreen();
  });

  it('renders a loading state', async () => {
    setState({ status: 'loading' });
    await render(<FoodLogScreen />);
    expect(screen.getByLabelText('Loading food log')).toBeOnTheScreen();
  });

  it('renders the empty state when nothing is logged', async () => {
    await render(<FoodLogScreen />);
    expect(screen.getByText('Nothing logged yet')).toBeOnTheScreen();
  });

  it('renders logged entries with derived totals versus targets', async () => {
    setState({
      items: [item()],
      totals: { calories: 320, proteinG: 62, carbsG: 0, fatG: 8, fiberG: null },
      sync: { state: 'pending', pending: 1, actionRequired: 0 },
    });
    await render(<FoodLogScreen />);
    expect(screen.getByTestId('logged-item-i1')).toBeOnTheScreen();
    expect(screen.getByText('Chicken breast, cooked')).toBeOnTheScreen();
    expect(screen.getByText('320 / 2000 kcal')).toBeOnTheScreen();
  });

  it('edits a serving count via the stepper', async () => {
    setState({ items: [item({ servingCount: 2 })] });
    await render(<FoodLogScreen />);
    fireEvent.press(screen.getByTestId('edit-serving-i1-inc'));
    expect(mockState.editServing).toHaveBeenCalledWith('i1', 2.25);
  });

  it('removes an entry', async () => {
    setState({ items: [item()] });
    await render(<FoodLogScreen />);
    fireEvent.press(screen.getByTestId('remove-item-i1'));
    expect(mockState.removeItem).toHaveBeenCalledWith('i1');
  });

  it('shows a sync-pending banner and a per-item pending chip', async () => {
    setState({ items: [item()], sync: { state: 'pending', pending: 1, actionRequired: 0 } });
    await render(<FoodLogScreen />);
    expect(screen.getByText('Changes pending')).toBeOnTheScreen();
    expect(screen.getByLabelText('Sync pending')).toBeOnTheScreen();
  });

  it('shows an action-required (failed) banner when a food is unsupported server-side', async () => {
    setState({
      items: [item({ syncState: 'action_required' })],
      sync: { state: 'action_required', pending: 0, actionRequired: 1 },
    });
    await render(<FoodLogScreen />);
    expect(screen.getByText(/can’t sync because the food isn’t available/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Sync action required')).toBeOnTheScreen();
  });

  it('surfaces a load error', async () => {
    setState({ status: 'error', error: 'Your food log could not be loaded right now.' });
    await render(<FoodLogScreen />);
    expect(screen.getByText('Food log unavailable')).toBeOnTheScreen();
  });
});
