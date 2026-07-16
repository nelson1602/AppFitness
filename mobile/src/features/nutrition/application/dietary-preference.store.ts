import { create } from 'zustand';

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

export type DietaryPreferenceStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

export interface DietaryPreferenceState {
  status: DietaryPreferenceStatus;
  preferences: DietaryPreference[];
  error: string | null;
  load: () => Promise<void>;
  add: (input: DietaryPreferenceInput) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
}

export const useDietaryPreferenceStore = create<DietaryPreferenceState>((set) => ({
  status: 'idle',
  preferences: [],
  error: null,
  load: async () => {
    set({ status: 'loading', error: null });
    try {
      const preferences = await getMyDietaryPreferences();
      set({ preferences, status: 'ready', error: null });
    } catch (error) {
      logError('dietaryPreference.load', error);
      set({ status: 'error', error: 'Your dietary preferences could not be loaded right now.' });
    }
  },
  add: async (input) => {
    set({ status: 'saving', error: null });
    try {
      const preference = await addDietaryPreference(input);
      set((state) => ({
        preferences: [...state.preferences, preference],
        status: 'ready',
        error: null,
      }));
      return true;
    } catch (error) {
      logError('dietaryPreference.add', error);
      set({ status: 'error', error: 'Your dietary preference could not be saved. Please try again.' });
      return false;
    }
  },
  remove: async (id) => {
    set({ status: 'saving', error: null });
    try {
      await removeDietaryPreference(id);
      const preferences = await getMyDietaryPreferences();
      set({ preferences, status: 'ready', error: null });
      return true;
    } catch (error) {
      logError('dietaryPreference.remove', error);
      set({ status: 'error', error: 'Your dietary preference could not be removed. Please try again.' });
      return false;
    }
  },
}));
