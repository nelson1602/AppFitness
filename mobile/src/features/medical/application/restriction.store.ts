import { create } from 'zustand';

import { logError } from '@/shared/infrastructure/logging';

import type { Restriction, RestrictionInput } from '../domain/medical.types';
import { endRestriction, getMyActiveRestrictions, recordRestriction } from './medical.service';

/**
 * Restriction/injury orchestration (Phase 14 Slice 2). Holds load/save/
 * deactivate status for the restrictions screen. Delegates ALL persistence
 * to the medical service — the repository encrypts the sensitive free-text
 * `notes` field before SQLite and enqueues sync in the same transaction
 * (.ai/05_SECURITY.md, .ai/06_MOBILE.md). Mirrors the profile/goal/
 * evaluation store pattern.
 *
 * Errors are logged with a static tag and the error object only — never
 * the restriction values (notes may be sensitive medical free-text).
 */

export type RestrictionStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

export interface RestrictionFormState {
  status: RestrictionStatus;
  restrictions: Restriction[];
  error: string | null;
  load: () => Promise<void>;
  save: (input: RestrictionInput) => Promise<boolean>;
  deactivate: (id: string) => Promise<boolean>;
}

export const useRestrictionStore = create<RestrictionFormState>((set) => ({
  status: 'idle',
  restrictions: [],
  error: null,
  load: async () => {
    set({ status: 'loading', error: null });
    try {
      const restrictions = await getMyActiveRestrictions();
      set({ restrictions, status: 'ready', error: null });
    } catch (error) {
      logError('restriction.load', error);
      set({ status: 'error', error: 'Your restrictions could not be loaded right now.' });
    }
  },
  save: async (input) => {
    set({ status: 'saving', error: null });
    try {
      const restriction = await recordRestriction(input);
      set((state) => ({
        restrictions: [...state.restrictions, restriction],
        status: 'ready',
        error: null,
      }));
      return true;
    } catch (error) {
      logError('restriction.save', error);
      set({ status: 'error', error: 'Your restriction could not be saved. Please try again.' });
      return false;
    }
  },
  deactivate: async (id) => {
    set({ status: 'saving', error: null });
    try {
      await endRestriction(id);
      const restrictions = await getMyActiveRestrictions();
      set({ restrictions, status: 'ready', error: null });
      return true;
    } catch (error) {
      logError('restriction.deactivate', error);
      set({ status: 'error', error: 'Your restriction could not be ended. Please try again.' });
      return false;
    }
  },
}));
