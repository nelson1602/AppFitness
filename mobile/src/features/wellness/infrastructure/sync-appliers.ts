import { registerApplier } from '@/shared/infrastructure/sync';

import {
  applyServerWellnessSafetyProfile,
  markWellnessSafetyProfileConflict,
} from './wellness-safety-profile.repository';
import { WELLNESS_SAFETY_PROFILE_ENTITY } from '../domain/wellness-safety-profile.rules';

/**
 * Pull-side applier for `wellness_safety_profiles` (ADR-P017 W-2).
 *
 * Registered exactly once by the app composition root. Both callbacks require
 * the active user id that the sync worker now passes, and verify the pulled
 * row's owner before writing anything.
 */

let registered = false;

export function registerWellnessSyncAppliers(): void {
  if (registered) return;
  registered = true;

  registerApplier({
    entityType: WELLNESS_SAFETY_PROFILE_ENTITY,
    applyServerChange: applyServerWellnessSafetyProfile,
    markConflict: markWellnessSafetyProfileConflict,
  });
}
