import type { SyncOperationInput } from '../../sync/domain/sync.types';
import {
  parseMealCreate,
  parseNutritionLogCreate,
} from '../domain/nutrition-container-payload';
import {
  MealSyncHandler,
  NutritionLogSyncHandler,
} from './nutrition-container-sync.handlers';
import type { PrismaNutritionContainerRepository } from './prisma-nutrition-container.repository';

const LOG = '6b8f6a8e-2c1f-5a3d-9b1e-0f8a7c6d5e4f';
const repo = {} as PrismaNutritionContainerRepository;

const op = (payload: Record<string, unknown>): SyncOperationInput => ({
  opId: 'o',
  entityType: 'x',
  entityId: 'e',
  operation: 'CREATE',
  baseVersion: 0,
  payload,
});

describe('food-log parent payloads (BUG-044)', () => {
  it('reads a calendar day and rejects anything else', () => {
    expect(
      parseNutritionLogCreate({ date: '2026-10-20' }).date.toISOString(),
    ).toBe('2026-10-20T00:00:00.000Z');
    expect(() => parseNutritionLogCreate({ date: '2026-02-31' })).toThrow();
    expect(() => parseNutritionLogCreate({ date: 20261020 })).toThrow();
  });

  it('reads a meal slot under a parent log', () => {
    expect(
      parseMealCreate({ nutrition_log_id: LOG, type: 'SNACK', order_index: 3 }),
    ).toEqual({ nutritionLogId: LOG, type: 'SNACK', order: 3 });
    expect(() =>
      parseMealCreate({ nutrition_log_id: 'x', type: 'SNACK' }),
    ).toThrow();
    expect(() =>
      parseMealCreate({ nutrition_log_id: LOG, type: 'BRUNCH' }),
    ).toThrow();
  });
});

describe('idempotent CREATE of a deterministic container', () => {
  const logs = new NutritionLogSyncHandler(repo);
  const meals = new MealSyncHandler(repo);
  const liveLog = {
    version: 1,
    snapshot: { date: '2026-10-20', deleted_at: null },
  };
  const liveMeal = {
    version: 1,
    snapshot: { nutrition_log_id: LOG, type: 'LUNCH', deleted_at: null },
  };

  it('is satisfied by the same live day or slot', () => {
    expect(logs.isEquivalentCreate(liveLog, op({ date: '2026-10-20' }))).toBe(
      true,
    );
    expect(
      meals.isEquivalentCreate(
        liveMeal,
        op({ nutrition_log_id: LOG, type: 'LUNCH' }),
      ),
    ).toBe(true);
  });

  it('is not satisfied by another day, another slot or a tombstone', () => {
    expect(logs.isEquivalentCreate(liveLog, op({ date: '2026-10-21' }))).toBe(
      false,
    );
    expect(
      meals.isEquivalentCreate(
        liveMeal,
        op({ nutrition_log_id: LOG, type: 'DINNER' }),
      ),
    ).toBe(false);
    expect(
      logs.isEquivalentCreate(
        {
          version: 2,
          snapshot: { date: '2026-10-20', deleted_at: '2026-10-21T00:00:00Z' },
        },
        op({ date: '2026-10-20' }),
      ),
    ).toBe(false);
  });

  it('never throws on a malformed payload', () => {
    expect(logs.isEquivalentCreate(liveLog, op({ date: 'nope' }))).toBe(false);
    expect(meals.isEquivalentCreate(liveMeal, op({}))).toBe(false);
  });

  it('keeps notes out of a conflict snapshot', () => {
    expect(logs.redactForConflict({ date: '2026-10-20', notes: 'x' })).toEqual({
      date: '2026-10-20',
    });
  });
});
