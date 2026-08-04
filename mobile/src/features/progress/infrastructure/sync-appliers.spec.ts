import { registerApplier } from '@/shared/infrastructure/sync';

import { registerProgressSyncAppliers } from './sync-appliers';

jest.mock('@/shared/infrastructure/sync', () => ({ registerApplier: jest.fn() }));

const mockRegister = jest.mocked(registerApplier);

describe('registerProgressSyncAppliers', () => {
  it('registers pull appliers for body_weights, body_measurements and progress_snapshots (idempotent)', () => {
    registerProgressSyncAppliers();
    // Second call is a no-op (module-level guard).
    registerProgressSyncAppliers();

    const entityTypes = mockRegister.mock.calls.map((c) => c[0].entityType);
    expect(entityTypes).toEqual(['body_weights', 'body_measurements', 'progress_snapshots']);
    for (const call of mockRegister.mock.calls) {
      expect(typeof call[0].applyServerChange).toBe('function');
      expect(typeof call[0].markConflict).toBe('function');
    }
  });
});
