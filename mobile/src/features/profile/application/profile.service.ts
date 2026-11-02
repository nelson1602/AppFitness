import { getSession } from '../../authentication';
import type { Profile, ProfileInput } from '../domain/profile.types';
import { getProfile, saveProfile } from '../infrastructure/profile.repository';
import {
  forgetSignupCountry,
  readSignupCountry,
  rememberSignupCountry,
} from '../infrastructure/signup-country.storage';

/**
 * Profile use cases. UI/hooks call these — never the repository or
 * SQLite directly (.ai/06_MOBILE.md). All writes are local-first; the
 * sync worker ships them to the server when connectivity allows.
 */

function requireUserId(): string {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

export function getMyProfile(): Promise<Profile | null> {
  return getProfile(requireUserId());
}

/**
 * Saves the profile. v8.1: when this save creates the profile and names no
 * country, the one picked on the sign-up form (on this device, for this
 * account) is used. After any successful save the sign-up choice is
 * forgotten: from then on the profile row is the only source.
 */
export function saveMyProfile(input: ProfileInput): Promise<Profile> {
  // Synchronous like before: no session throws here, not in a rejected promise.
  const userId = requireUserId();
  return saveWithSignupCountry(userId, input);
}

async function saveWithSignupCountry(userId: string, input: ProfileInput): Promise<Profile> {
  const pending = input.country === undefined ? await readSignupCountry() : null;
  const countryForNewProfile = pending?.userId === userId ? pending.country : undefined;
  const saved = await saveProfile(userId, input, undefined, { countryForNewProfile });
  if (pending) await forgetSignupCountry();
  return saved;
}

/** v8.1: keep the sign-up form's country on the device until the account's profile is created. */
export function rememberMySignupCountry(userId: string, country: string): Promise<void> {
  return rememberSignupCountry({ userId, country });
}
