import { create } from 'zustand';

import {
  bindStoreToSession,
  isSessionCurrent,
  requireSessionSnapshot,
  type SessionSnapshot,
} from '@/features/authentication';
import { isDatabaseUnsupportedOnWebError } from '@/shared/infrastructure/database/web-unsupported';
import { logError } from '@/shared/infrastructure/logging';

import type { DietaryPreference, DietaryPreferenceInput } from '../domain/dietary-preference';
import {
  addDietaryPreference,
  getMyDietaryPreferences,
  removeDietaryPreference,
} from './dietary-preference.service';

/**
 * Dietary-preferences orchestration (ADR-P014 Slice 2A). Holds load/save
 * status for the future preferences editor (Slice 2B). Delegates ALL
 * persistence to the service → repository (local-first write, field-level
 * note encryption, and sync enqueue all happen there — never here, never in
 * components; .ai/05_SECURITY.md, .ai/06_MOBILE.md). Mirrors the
 * evaluation/restriction stores. No UI binds to it yet.
 *
 * Errors are logged with a static tag + the error object only — never the
 * preference values (a note may be sensitive allergy free-text).
 */

export type DietaryPreferenceStatus =
  'idle' | 'loading' | 'ready' | 'saving' | 'error' | 'web-unavailable';

export interface DietaryPreferenceState {
  status: DietaryPreferenceStatus;
  preferences: DietaryPreference[];
  error: string | null;
  load: () => Promise<void>;
  add: (input: DietaryPreferenceInput) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
}

const INITIAL = {
  status: 'idle' as DietaryPreferenceStatus,
  preferences: [] as DietaryPreference[],
  error: null,
};

export const useDietaryPreferenceStore = create<DietaryPreferenceState>((set) => ({
  ...INITIAL,
  load: async () => {
    // A load or write started as one account must never publish onto another's
    // screen (ADR-P030 C-1): capture the owner, gate every publish.
    let owner: SessionSnapshot | null = null;
    set({ status: 'loading', error: null });
    try {
      owner = requireSessionSnapshot();
      const preferences = await getMyDietaryPreferences();
      if (!isSessionCurrent(owner)) return;
      set({ preferences, status: 'ready', error: null });
    } catch (error) {
      if (owner && !isSessionCurrent(owner)) return;
      if (isDatabaseUnsupportedOnWebError(error)) {
        // Web has no local database (ADR-P019): an expected, distinct state —
        // not logged as a runtime error and not auto-retried. Clear the list so
        // the screen renders no fabricated exclusions or editing controls.
        set({ status: 'web-unavailable', preferences: [], error: null });
        return;
      }
      logError('dietaryPreference.load', error);
      set({ status: 'error', error: 'Your dietary preferences could not be loaded right now.' });
    }
  },
  add: async (input) => {
    let owner: SessionSnapshot | null = null;
    set({ status: 'saving', error: null });
    try {
      owner = requireSessionSnapshot();
      const preference = await addDietaryPreference(input);
      if (!isSessionCurrent(owner)) return false;
      set((state) => ({
        preferences: [...state.preferences, preference],
        status: 'ready',
        error: null,
      }));
      return true;
    } catch (error) {
      logError('dietaryPreference.add', error);
      if (owner && !isSessionCurrent(owner)) return false;
      set({
        status: 'error',
        error: 'Your dietary preference could not be saved. Please try again.',
      });
      return false;
    }
  },
  remove: async (id) => {
    let owner: SessionSnapshot | null = null;
    set({ status: 'saving', error: null });
    try {
      owner = requireSessionSnapshot();
      await removeDietaryPreference(id);
      const preferences = await getMyDietaryPreferences();
      if (!isSessionCurrent(owner)) return false;
      set({ preferences, status: 'ready', error: null });
      return true;
    } catch (error) {
      logError('dietaryPreference.remove', error);
      if (owner && !isSessionCurrent(owner)) return false;
      set({
        status: 'error',
        error: 'Your dietary preference could not be removed. Please try again.',
      });
      return false;
    }
  },
}));

// Cached exclusions belong to one account; a transition drops them immediately.
bindStoreToSession(() => useDietaryPreferenceStore.setState(INITIAL));
