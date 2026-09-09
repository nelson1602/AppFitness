import { getSession } from '@/features/authentication';

import type { WellnessSafetyProfile } from '../domain/wellness-safety-profile';
import {
  deviceToday,
  type WellnessSafetyProfileInput,
} from '../domain/wellness-safety-profile.rules';
import {
  getWellnessSafetyProfile,
  hasUnsyncedWellnessSafetyProfile,
  saveWellnessSafetyProfile,
  softDeleteWellnessSafetyProfile,
} from '../infrastructure/wellness-safety-profile.repository';

/**
 * Application boundary for the Wellness Safety Profile (ADR-P017 W-2).
 *
 * Resolves the authenticated user and passes it down; the repository owns SQL
 * and the domain owns validation. `today` is injectable so a caller (and a
 * test) can pin the device-local calendar date the future-date rule uses.
 *
 * No store, screen, copy or iCoach input is added here — W-3 owns the capture
 * surface and W-4 the deterministic consumption.
 */

function requireUserId(): string {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

export function getMyWellnessSafetyProfile(): Promise<WellnessSafetyProfile | null> {
  return getWellnessSafetyProfile(requireUserId());
}

export function saveMyWellnessSafetyProfile(
  input: WellnessSafetyProfileInput,
  today: string = deviceToday(),
): Promise<WellnessSafetyProfile> {
  return saveWellnessSafetyProfile(requireUserId(), input, new Date().toISOString(), today);
}

export function deleteMyWellnessSafetyProfile(): Promise<boolean> {
  return softDeleteWellnessSafetyProfile(requireUserId());
}

export function hasUnsyncedWellnessSafetyProfileChange(): Promise<boolean> {
  return hasUnsyncedWellnessSafetyProfile(requireUserId());
}
