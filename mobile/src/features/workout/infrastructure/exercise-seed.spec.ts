import { run } from '@/shared/infrastructure/database';

import { BUILT_IN_EXERCISES } from './exercise-catalog.data';
import { ensureBuiltInExerciseSeeded, seedBuiltInExercises } from './exercise-seed';

jest.mock('@/shared/infrastructure/database', () => ({ run: jest.fn() }));

const mockRun = jest.mocked(run);
const NOW = '2026-07-17T12:00:00.000Z';

beforeEach(() => jest.clearAllMocks());

describe('built-in exercise seed', () => {
  it('seeds every built-in as a synced, global (created_by NULL) reference row', async () => {
    await seedBuiltInExercises(NOW);
    expect(mockRun).toHaveBeenCalledTimes(BUILT_IN_EXERCISES.length);

    for (const call of mockRun.mock.calls) {
      const [sql] = call as unknown as [string, unknown[]];
      // Idempotent + non-destructive: never overwrites an existing row.
      expect(sql).toContain('INSERT OR IGNORE INTO exercises');
      expect(sql).toContain(`'synced'`);
      // created_by is a literal NULL in the SQL (global catalog), not a param.
      expect(sql).toMatch(/created_by\)/);
    }
    // First row carries the back-squat identity + attributes.
    const [, firstParams] = mockRun.mock.calls[0] as unknown as [string, unknown[]];
    expect(firstParams[0]).toBe(BUILT_IN_EXERCISES[0].id);
    expect(firstParams).toContain(BUILT_IN_EXERCISES[0].name);
  });

  it('ensureBuiltInExerciseSeeded inserts a known built-in by id', async () => {
    const target = BUILT_IN_EXERCISES[2];
    const done = await ensureBuiltInExerciseSeeded(target.id, NOW);
    expect(done).toBe(true);
    expect(mockRun).toHaveBeenCalledTimes(1);
    const [, params] = mockRun.mock.calls[0] as unknown as [string, unknown[]];
    expect(params[0]).toBe(target.id);
  });

  it('ensureBuiltInExerciseSeeded is a no-op for a non-built-in id (custom exercise path)', async () => {
    const done = await ensureBuiltInExerciseSeeded('11111111-1111-5111-8111-111111111111', NOW);
    expect(done).toBe(false);
    expect(mockRun).not.toHaveBeenCalled();
  });
});
