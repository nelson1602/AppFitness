import { create } from 'zustand';

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

export const useProfileStore = create<ProfileFormState>((set) => ({
  status: 'idle',
  profile: null,
  error: null,
  load: async () => {
    set({ status: 'loading', error: null });
    try {
      const profile = await getMyProfile();
      set({ profile, status: 'ready', error: null });
    } catch (error) {
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
    set({ status: 'saving', error: null });
    try {
      // Local-first write; the repository enqueues the sync op in the same
      // transaction. Returns after the local commit — sync ships later.
      const profile = await saveMyProfile(input);
      set({ profile, status: 'ready', error: null });
      return true;
    } catch (error) {
      logError('profile.save', error);
      set({ status: 'error', error: 'Your profile could not be saved. Please try again.' });
      return false;
    }
  },
}));
