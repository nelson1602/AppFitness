import { refreshTokens } from '@/features/authentication';
import { DatabaseUnsupportedOnWebError } from '@/shared/infrastructure/database/web-unsupported';
import { logError } from '@/shared/infrastructure/logging';
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
    sync: { state: 'idle', pending: 0, actionRequired: 0, conflicts: 0 },
    error: null,
    writeError: null,
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

  // BUG-007: a diverged version is not a failure. It gets its own state and its
  // own count, and never borrows the catalog-incompatibility ones.
  it('summarises a version conflict separately from action_required (BUG-007)', async () => {
    mockList.mockResolvedValue([loggedItem({ syncState: 'conflict' })]);
    await useFoodLogStore.getState().load();

    const s = useFoodLogStore.getState().sync;
    expect(s.state).toBe('conflict');
    expect(s.conflicts).toBe(1);
    expect(s.actionRequired).toBe(0);
  });

  it('keeps both counts when a day holds a conflict and a catalog block (BUG-007)', async () => {
    mockList.mockResolvedValue([
      loggedItem({ id: 'i1', syncState: 'conflict' }),
      loggedItem({ id: 'i2', syncState: 'action_required' }),
      loggedItem({ id: 'i3', syncState: 'pending' }),
    ]);
    await useFoodLogStore.getState().load();

    const s = useFoodLogStore.getState().sync;
    // The actionable cause outranks the report-only one so it is not hidden,
    // but neither count is folded into the other.
    expect(s.state).toBe('action_required');
    expect(s.actionRequired).toBe(1);
    expect(s.conflicts).toBe(1);
    expect(s.pending).toBe(1);
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

  it('maps the dormant Web database error to a distinct web-unavailable state (ADR-P019)', async () => {
    // Seed a ready day so we can prove the fabricated content is cleared.
    useFoodLogStore.setState({
      status: 'ready',
      items: [loggedItem()],
      totals: { calories: 320, proteinG: 62, carbsG: 0, fatG: 8, fiberG: null },
      sync: { state: 'pending', pending: 1, actionRequired: 0, conflicts: 0 },
    });
    mockList.mockRejectedValue(new DatabaseUnsupportedOnWebError());

    await useFoodLogStore.getState().load();

    const s = useFoodLogStore.getState();
    // Distinct, expected state — not a generic error.
    expect(s.status).toBe('web-unavailable');
    expect(s.error).toBeNull();
    // No fabricated entries, totals, or pending sync left behind.
    expect(s.items).toEqual([]);
    expect(s.totals).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: null });
    expect(s.sync).toEqual({ state: 'idle', pending: 0, actionRequired: 0, conflicts: 0 });
    // Expected Web dormancy is not logged as a runtime error.
    expect(jest.mocked(logError)).not.toHaveBeenCalled();
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

  // BUG-008: a failed write must be reported distinctly from a failed read, and
  // must say WHICH write failed so the screen can tell the user what survived.
  it('records which write failed so the screen can report it (BUG-008)', async () => {
    mockList.mockResolvedValue([]);

    mockLog.mockRejectedValue(new Error('x'));
    await useFoodLogStore.getState().addFood('food.x', 'LUNCH', 1);
    expect(useFoodLogStore.getState().writeError).toBe('add');

    mockUpdate.mockRejectedValue(new Error('x'));
    await useFoodLogStore.getState().editServing('i1', 2);
    expect(useFoodLogStore.getState().writeError).toBe('servings');

    mockRemove.mockRejectedValue(new Error('x'));
    await useFoodLogStore.getState().removeItem('i1');
    expect(useFoodLogStore.getState().writeError).toBe('remove');
  });

  it('clears the write error when the next write attempt succeeds (BUG-008)', async () => {
    mockList.mockResolvedValue([]);
    mockLog.mockRejectedValueOnce(new Error('x'));

    await useFoodLogStore.getState().addFood('food.x', 'LUNCH', 1);
    expect(useFoodLogStore.getState().writeError).toBe('add');

    mockLog.mockResolvedValue(undefined as never);
    await useFoodLogStore.getState().addFood('food.x', 'LUNCH', 1);
    expect(useFoodLogStore.getState().writeError).toBeNull();
  });

  it('clears a stale write error once a read succeeds (BUG-008)', async () => {
    mockList.mockResolvedValue([]);
    mockRemove.mockRejectedValue(new Error('x'));

    await useFoodLogStore.getState().removeItem('i1');
    expect(useFoodLogStore.getState().writeError).toBe('remove');

    await useFoodLogStore.getState().load('2026-07-14');
    expect(useFoodLogStore.getState().writeError).toBeNull();
    expect(useFoodLogStore.getState().status).toBe('ready');
  });

  it('leaves the loaded day intact when a write fails (BUG-008)', async () => {
    mockList.mockResolvedValue([loggedItem()]);
    await useFoodLogStore.getState().load('2026-07-13');

    mockLog.mockRejectedValue(new Error('x'));
    await useFoodLogStore.getState().addFood('food.x', 'LUNCH', 1);

    const s = useFoodLogStore.getState();
    // The read succeeded; only the write failed. The day must still be on screen.
    expect(s.status).toBe('ready');
    expect(s.items).toHaveLength(1);
    expect(s.totals.calories).toBe(320);
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
