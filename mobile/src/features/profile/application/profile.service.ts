import { getSession } from '../../authentication';
import type { Profile, ProfileInput } from '../domain/profile.types';
import { getProfile, saveProfile } from '../infrastructure/profile.repository';

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

export function saveMyProfile(input: ProfileInput): Promise<Profile> {
  return saveProfile(requireUserId(), input);
}
