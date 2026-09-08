import { create } from 'zustand';

import {
  bindStoreToSession,
  isSessionCurrent,
  requireSessionSnapshot,
  type SessionSnapshot,
} from '@/features/authentication';
import { isDatabaseUnsupportedOnWebError } from '@/shared/infrastructure/database/web-unsupported';
import { logError } from '@/shared/infrastructure/logging';

import type { Goal, GoalInput } from '../domain/goal.types';
import { getMyActiveGoal, setMyGoal } from './goal.service';

/**
 * Goal screen orchestration (Phase 13 Slice 2). Holds load/save status for
 * the goal edit screen; delegates ALL persistence to the goal service
 * (local-first write + sync enqueue happen there — never here, never in
 * components; .ai/06_MOBILE.md). Mirrors the profile-store pattern.
 */

export type GoalStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error' | 'web-unavailable';

export interface GoalFormState {
  status: GoalStatus;
  goal: Goal | null;
  error: string | null;
  load: () => Promise<void>;
  save: (input: GoalInput) => Promise<boolean>;
}

const INITIAL = { status: 'idle' as GoalStatus, goal: null, error: null };

export const useGoalStore = create<GoalFormState>((set) => ({
  ...INITIAL,
  load: async () => {
    // A load or write started as one account must never publish onto another's
    // screen (ADR-P030 C-1): capture the owner, gate every publish.
    let owner: SessionSnapshot | null = null;
    set({ status: 'loading', error: null });
    try {
      owner = requireSessionSnapshot();
      const goal = await getMyActiveGoal();
      if (!isSessionCurrent(owner)) return;
      set({ goal, status: 'ready', error: null });
    } catch (error) {
      if (owner && !isSessionCurrent(owner)) return;
      if (isDatabaseUnsupportedOnWebError(error)) {
        // Web has no local database (ADR-P019): an expected, distinct state —
        // not logged as a runtime error and not auto-retried. Clear any loaded
        // goal so the screen renders no editable form or fabricated data.
        set({ status: 'web-unavailable', goal: null, error: null });
        return;
      }
      logError('goal.load', error);
      set({ status: 'error', error: 'Your goal could not be loaded right now.' });
    }
  },
  save: async (input) => {
    let owner: SessionSnapshot | null = null;
    set({ status: 'saving', error: null });
    try {
      owner = requireSessionSnapshot();
      // Local-first write; the repository closes the previous active goal
      // and enqueues both sync ops in the same transaction. Returns after
      // the local commit — sync ships later.
      const goal = await setMyGoal(input);
      if (!isSessionCurrent(owner)) return false;
      set({ goal, status: 'ready', error: null });
      return true;
    } catch (error) {
      logError('goal.save', error);
      if (owner && !isSessionCurrent(owner)) return false;
      set({ status: 'error', error: 'Your goal could not be saved. Please try again.' });
      return false;
    }
  },
}));

// The cached goal belongs to one account; a transition drops it immediately.
bindStoreToSession(() => useGoalStore.setState(INITIAL));
