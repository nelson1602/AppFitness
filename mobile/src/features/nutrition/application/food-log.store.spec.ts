import { refreshTokens } from '@/features/authentication';
import { runSync } from '@/shared/infrastructure/sync';

import type { LoggedMealItem } from '../domain/food-log';
import {
  listLoggedItems,
  logFood,
  removeMealItem,
  updateServingCount,
} from '../infrastructure/food-log.repository';
import { generateMealPlan } from './meal-generator';
import { selectMealPlan } from './meal-plan.service';
import { useFoodLogStore } from './food-log.store';

jest.mock('@/features/authentication', () => ({
  getSession: () => ({ user: { id: 'user-1' } }),
  getAccessToken: () => 'token-1',
  refreshTokens: jest.fn(),
}));
jest.mock('@/shared/infrastructure/sync', () => ({ runSync: jest.fn() }));
jest.mock('@/shared/infrastructure/logging', () => ({ logError: jest.fn(), logWarn: jest.fn() }));
jest.mock('../infrastructure/food-log.repository', () => ({
  listLoggedItems: jest.fn(),
  logFood: jest.fn(),
  updateServingCount: jest.fn(),
  removeMealItem: jest.fn(),
}));
jest.mock('./meal-generator', () => ({ generateMealPlan: jest.fn() }));
jest.mock('./meal-plan.service', () => ({ selectMealPlan: jest.fn() }));

const mockList = jest.mocked(listLoggedItems);
const mockLog = jest.mocked(logFood);
const mockUpdate = jest.mocked(updateServingCount);
const mockRemove = jest.mocked(removeMealItem);
const mockRunSync = jest.mocked(runSync);
const mockRefresh = jest.mocked(refreshTokens);

const syncReport = (outcome: 'success' | 'offline' | 'unauthenticated') => ({
  outcome,
  pushedApplied: 0,
  conflicts: 0,
  rejected: 0,
  deferred: 0,
  actionRequired: 0,
  pulledApplied: 0,
  skippedPending: 0,
});

function loggedItem(overrides: Partial<LoggedMealItem> = {}): LoggedMealItem {
  return {
    id: 'i1',
    mealType: 'LUNCH',
    foodId: 'f1',
    catalogKey: 'food.x',
    name: 'X',
    servingCount: 2,
    serving: { amount: 100, unit: 'g' },
    consumed: { calories: 320, proteinG: 62, carbsG: 0, fatG: 8, fiberG: null },
    syncState: 'pending',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useFoodLogStore.setState({
    status: 'idle',
    date: '2026-07-13',
    items: [],
    totals: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: null },
    sync: { state: 'idle', pending: 0, actionRequired: 0 },
    error: null,
  });
});

describe('food-log store (Slice 4C)', () => {
  it('loads items and derives daily totals + a pending sync summary', async () => {
    mockList.mockResolvedValue([
      loggedItem(),
      loggedItem({
        id: 'i2',
        consumed: { calories: 100, proteinG: 5, carbsG: 20, fatG: 1, fiberG: 3 },
      }),
    ]);

    await useFoodLogStore.getState().load('2026-07-13');
    const state = useFoodLogStore.getState();

    expect(mockList).toHaveBeenCalledWith('user-1', '2026-07-13');
    expect(state.status).toBe('ready');
    expect(state.totals.calories).toBe(420);
    expect(state.sync.state).toBe('pending');
    expect(state.sync.pending).toBe(2);
  });

  it('flags action_required when an item needs the user', async () => {
    mockList.mockResolvedValue([loggedItem({ syncState: 'action_required' })]);
    await useFoodLogStore.getState().load();
    expect(useFoodLogStore.getState().sync.state).toBe('action_required');
    expect(useFoodLogStore.getState().sync.actionRequired).toBe(1);
  });

  it('addFood writes through the repository then reloads', async () => {
    mockList.mockResolvedValue([loggedItem()]);
    await useFoodLogStore.getState().addFood('food.chicken_breast', 'BREAKFAST', 1.5);
    expect(mockLog).toHaveBeenCalledWith('user-1', {
      date: '2026-07-13',
      mealType: 'BREAKFAST',
      catalogKey: 'food.chicken_breast',
      servingCount: 1.5,
    });
    expect(mockList).toHaveBeenCalled();
  });

  it('editServing and removeItem delegate to the repository and reload', async () => {
    mockList.mockResolvedValue([]);
    await useFoodLogStore.getState().editServing('i1', 3);
    expect(mockUpdate).toHaveBeenCalledWith('user-1', 'i1', 3);

    await useFoodLogStore.getState().removeItem('i1');
    expect(mockRemove).toHaveBeenCalledWith('user-1', 'i1');
  });

  it('syncNow runs sync and reflects an offline outcome', async () => {
    mockRunSync.mockResolvedValue({
      outcome: 'offline',
      pushedApplied: 0,
      conflicts: 0,
      rejected: 0,
      deferred: 0,
      actionRequired: 0,
      pulledApplied: 0,
      skippedPending: 0,
    });
    mockList.mockResolvedValue([]);
    await useFoodLogStore.getState().syncNow();
    expect(mockRunSync).toHaveBeenCalled();
    expect(useFoodLogStore.getState().sync.state).toBe('offline');
  });

  it('never recomputes or mutates the deterministic NutritionPlan / MealPlan', async () => {
    mockList.mockResolvedValue([loggedItem()]);
    await useFoodLogStore.getState().load();
    await useFoodLogStore.getState().addFood('food.chicken_breast', 'LUNCH', 1);
    await useFoodLogStore.getState().editServing('i1', 2);
    await useFoodLogStore.getState().removeItem('i1');
    expect(generateMealPlan).not.toHaveBeenCalled();
    expect(selectMealPlan).not.toHaveBeenCalled();
  });

  it('surfaces a load failure as a safe error state (no throw)', async () => {
    mockList.mockRejectedValue(new Error('db down'));
    await useFoodLogStore.getState().load();
    const s = useFoodLogStore.getState();
    expect(s.status).toBe('error');
    expect(s.error).toBe('Your food log could not be loaded right now.');
  });

  it('surfaces a safe error when a write fails (add / edit / remove)', async () => {
    mockLog.mockRejectedValue(new Error('x'));
    await useFoodLogStore.getState().addFood('food.x', 'LUNCH', 1);
    expect(useFoodLogStore.getState().error).toBe('That food could not be logged right now.');

    mockUpdate.mockRejectedValue(new Error('x'));
    await useFoodLogStore.getState().editServing('i1', 2);
    expect(useFoodLogStore.getState().error).toBe('That change could not be saved right now.');

    mockRemove.mockRejectedValue(new Error('x'));
    await useFoodLogStore.getState().removeItem('i1');
    expect(useFoodLogStore.getState().error).toBe('That item could not be removed right now.');
  });

  it('retries sync once after rotating an expired token', async () => {
    mockRefresh.mockResolvedValue({ accessToken: 'token-2' } as never);
    mockRunSync
      .mockResolvedValueOnce(syncReport('unauthenticated'))
      .mockResolvedValueOnce(syncReport('success'));
    mockList.mockResolvedValue([]);

    await useFoodLogStore.getState().syncNow();

    expect(mockRefresh).toHaveBeenCalled();
    expect(mockRunSync).toHaveBeenCalledTimes(2);
    expect(useFoodLogStore.getState().sync.state).toBe('idle');
  });

  it('reflects a sync error state when runSync throws', async () => {
    mockRunSync.mockRejectedValue(new Error('network'));
    await useFoodLogStore.getState().syncNow();
    expect(useFoodLogStore.getState().sync.state).toBe('error');
  });
});
