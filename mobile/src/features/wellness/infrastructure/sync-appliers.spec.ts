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

  it('wires the owner-verifying repository callbacks', () => {
    registerWellnessSyncAppliers();
    const applier = getApplier('wellness_safety_profiles');

    expect(applier).toBeDefined();
    // The applier delegates to the repository functions that require the active
    // user id — not to an inline closure that could drop it.
    expect(applier?.applyServerChange).toBe(applyServerWellnessSafetyProfile);
    expect(applier?.markConflict).toBe(markWellnessSafetyProfileConflict);
  });

  it('registers no other entity type', () => {
    registerWellnessSyncAppliers();
    expect(allAppliers().map((applier) => applier.entityType)).toEqual([
      'wellness_safety_profiles',
    ]);
  });
});
