import { inertExecutor } from '@/shared/infrastructure/database/testing/fake-executor';
import { allAppliers, getApplier } from '@/shared/infrastructure/sync';

import {
  applyServerWellnessSafetyProfile,
  markWellnessSafetyProfileConflict,
} from './wellness-safety-profile.repository';
import { registerWellnessSyncAppliers } from './sync-appliers';

/**
 * ADR-P017 **W-2** applier registration.
 *
 * The registry throws on a duplicate entity type, so "registered exactly once"
 * has to survive a composition root that runs twice (fast refresh, a re-import
 * in a test). The wellness registration is idempotent for that reason.
 */

jest.mock('./wellness-safety-profile.repository', () => ({
  applyServerWellnessSafetyProfile: jest.fn(),
  markWellnessSafetyProfileConflict: jest.fn(),
}));

describe('wellness sync applier registration', () => {
  it('registers wellness_safety_profiles exactly once, idempotently', () => {
    registerWellnessSyncAppliers();
    registerWellnessSyncAppliers();
    registerWellnessSyncAppliers();

    const wellness = allAppliers().filter(
      (applier) => applier.entityType === 'wellness_safety_profiles',
    );
    expect(wellness).toHaveLength(1);
  });

  it('wires the owner-verifying repository callbacks', async () => {
    registerWellnessSyncAppliers();
    const applier = getApplier('wellness_safety_profiles');

    expect(applier).toBeDefined();
    expect(applier?.markConflict).toBe(markWellnessSafetyProfileConflict);

    // The registration adapts the object contract to the repository's
    // positional signature (BUG-015), so identity no longer proves the wiring.
    // Delegation does: the owner AND the transaction executor must both reach
    // the repository, since dropping either is the failure this guards.
    const tx = inertExecutor('wellness');
    const data = { id: 'wsp-1' };
    await applier?.applyServerChange({ data, deleted: true, userId: 'user-1', tx });

    expect(applyServerWellnessSafetyProfile).toHaveBeenCalledWith(data, true, 'user-1', tx);
  });

  it('registers no other entity type', () => {
    registerWellnessSyncAppliers();
    expect(allAppliers().map((applier) => applier.entityType)).toEqual([
      'wellness_safety_profiles',
    ]);
  });
});
