import { create } from 'zustand';

import {
  bindStoreToSession,
  isSessionCurrent,
  requireSessionSnapshot,
  type SessionSnapshot,
} from '@/features/authentication';
import { isDatabaseUnsupportedOnWebError } from '@/shared/infrastructure/database/web-unsupported';
import { logError } from '@/shared/infrastructure/logging';

import type { Profile, ProfileInput } from '../domain/profile.types';
import { getMyProfile, saveMyProfile } from './profile.service';

/**
 * Profile screen orchestration (Phase 13). Holds load/save status for the
 * edit screen; delegates ALL persistence to the profile service
 * (local-first write + sync enqueue happen there — never here, never in
 * components; .ai/06_MOBILE.md). Mirrors the dashboard-store pattern.
 */

export type ProfileStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error' | 'web-unavailable';

export interface ProfileFormState {
  status: ProfileStatus;
  profile: Profile | null;
  error: string | null;
  load: () => Promise<void>;
  save: (input: ProfileInput) => Promise<boolean>;
}

const INITIAL = { status: 'idle' as ProfileStatus, profile: null, error: null };

export const useProfileStore = create<ProfileFormState>((set) => ({
  ...INITIAL,
  load: async () => {
    // Captured before the read; checked before every publish. A load started as
    // A must not paint A's profile onto B's screen (ADR-P030 C-1).
    let owner: SessionSnapshot | null = null;
    set({ status: 'loading', error: null });
    try {
      owner = requireSessionSnapshot();
      const profile = await getMyProfile();
      if (!isSessionCurrent(owner)) return;
      set({ profile, status: 'ready', error: null });
    } catch (error) {
      if (owner && !isSessionCurrent(owner)) return;
      if (isDatabaseUnsupportedOnWebError(error)) {
        // Web has no local database (ADR-P019): an expected, distinct state —
        // not logged as a runtime error and not auto-retried. Clear any loaded
        // profile so the screen renders no editable form or fabricated data.
        set({ status: 'web-unavailable', profile: null, error: null });
        return;
      }
      logError('profile.load', error);
      set({ status: 'error', error: 'Your profile could not be loaded right now.' });
    }
  },
  save: async (input) => {
    let owner: SessionSnapshot | null = null;
    set({ status: 'saving', error: null });
    try {
      owner = requireSessionSnapshot();
      // Local-first write; the repository enqueues the sync op in the same
      // transaction. Returns after the local commit — sync ships later.
      const profile = await saveMyProfile(input);
      if (!isSessionCurrent(owner)) return false;
      set({ profile, status: 'ready', error: null });
      return true;
    } catch (error) {
      logError('profile.save', error);
      if (owner && !isSessionCurrent(owner)) return false;
      set({ status: 'error', error: 'Your profile could not be saved. Please try again.' });
      return false;
    }
  },
}));

// Cached profile belongs to one account; a transition drops it immediately.
bindStoreToSession(() => useProfileStore.setState(INITIAL));
