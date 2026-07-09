import { create } from 'zustand';

import { logError } from '@/shared/infrastructure/logging';

import type { Goal, GoalInput } from '../domain/goal.types';
import { getMyActiveGoal, setMyGoal } from './goal.service';

/**
 * Goal screen orchestration (Phase 13 Slice 2). Holds load/save status for
 * the goal edit screen; delegates ALL persistence to the goal service
 * (local-first write + sync enqueue happen there — never here, never in
 * components; .ai/06_MOBILE.md). Mirrors the profile-store pattern.
 */

export type GoalStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

export interface GoalFormState {
  status: GoalStatus;
  goal: Goal | null;
  error: string | null;
  load: () => Promise<void>;
  save: (input: GoalInput) => Promise<boolean>;
}

export const useGoalStore = create<GoalFormState>((set) => ({
  status: 'idle',
  goal: null,
  error: null,
  load: async () => {
    set({ status: 'loading', error: null });
    try {
      const goal = await getMyActiveGoal();
      set({ goal, status: 'ready', error: null });
    } catch (error) {
      logError('goal.load', error);
      set({ status: 'error', error: 'Your goal could not be loaded right now.' });
    }
  },
  save: async (input) => {
    set({ status: 'saving', error: null });
    try {
      // Local-first write; the repository closes the previous active goal
      // and enqueues both sync ops in the same transaction. Returns after
      // the local commit — sync ships later.
      const goal = await setMyGoal(input);
      set({ goal, status: 'ready', error: null });
      return true;
    } catch (error) {
      logError('goal.save', error);
      set({ status: 'error', error: 'Your goal could not be saved. Please try again.' });
      return false;
    }
  },
}));
