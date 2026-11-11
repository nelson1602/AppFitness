import { useSkippedMealsStore } from './skipped-meals.store';
import { listSkippedMeals, skipMeal } from '../infrastructure/skipped-meals.repository';

const mockMeta = new Map<string, string>();
let mockUser = 'user-a';
let mockCurrent = true;

jest.mock('@/shared/infrastructure/database', () => ({
  queryFirst: jest.fn((_sql: string, [key]: string[]) =>
    Promise.resolve(mockMeta.has(key) ? { value: mockMeta.get(key) } : null),
  ),
  run: jest.fn((_sql: string, [key, value]: string[]) => {
    mockMeta.set(key, value);
    return Promise.resolve({ changes: 1, lastInsertRowId: 0 });
  }),
}));
jest.mock('@/features/authentication', () => ({
  requireSessionSnapshot: () => ({ userId: mockUser }),
  isSessionCurrent: () => mockCurrent,
}));
jest.mock('@/shared/infrastructure/logging', () => ({ logError: jest.fn() }));

const DAY = '2026-11-11';

beforeEach(() => {
  mockMeta.clear();
  mockUser = 'user-a';
  mockCurrent = true;
  useSkippedMealsStore.setState({ key: null, slots: [] });
});

/** "Omitir" (ADR-P040 v10-B): a per-account, per-day device preference. */
describe('skipped meals', () => {
  it('keeps the skipped slots per account and day, in meal order, once each', async () => {
    await skipMeal('user-a', DAY, 'DINNER');
    await skipMeal('user-a', DAY, 'SNACK');
    await skipMeal('user-a', DAY, 'SNACK');

    await expect(listSkippedMeals('user-a', DAY)).resolves.toEqual(['SNACK', 'DINNER']);
    await expect(listSkippedMeals('user-b', DAY)).resolves.toEqual([]);
    await expect(listSkippedMeals('user-a', '2026-11-12')).resolves.toEqual([]);
  });

  it('reads a damaged value as nothing skipped', async () => {
    mockMeta.set(`meal-skipped:user-a:${DAY}`, 'not json');
    await expect(listSkippedMeals('user-a', DAY)).resolves.toEqual([]);
    mockMeta.set(`meal-skipped:user-a:${DAY}`, '{"SNACK":true}');
    await expect(listSkippedMeals('user-a', DAY)).resolves.toEqual([]);
  });

  it('shows a skip at once and keeps it after a reload', async () => {
    await useSkippedMealsStore.getState().skip(DAY, 'SNACK');
    expect(useSkippedMealsStore.getState()).toMatchObject({
      key: `user-a|${DAY}`,
      slots: ['SNACK'],
    });

    useSkippedMealsStore.setState({ key: null, slots: [] });
    await useSkippedMealsStore.getState().load(DAY);
    expect(useSkippedMealsStore.getState().slots).toEqual(['SNACK']);
  });

  it('does not publish another account’s skips after a session change', async () => {
    await skipMeal('user-a', DAY, 'LUNCH');
    mockCurrent = false;
    await useSkippedMealsStore.getState().load(DAY);
    expect(useSkippedMealsStore.getState().slots).toEqual([]);
  });

  it('logs and carries on when there is no session', async () => {
    const { logError } = jest.requireMock('@/shared/infrastructure/logging');
    jest.requireMock('@/features/authentication').requireSessionSnapshot = () => {
      throw new Error('no session');
    };
    await useSkippedMealsStore.getState().load(DAY);
    await useSkippedMealsStore.getState().skip(DAY, 'SNACK');
    expect(logError).toHaveBeenCalledWith('nutrition.skippedMeals.load', expect.any(Error));
    expect(logError).toHaveBeenCalledWith('nutrition.skippedMeals.skip', expect.any(Error));
  });
});
