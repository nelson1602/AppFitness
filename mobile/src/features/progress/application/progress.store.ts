import { create } from 'zustand';

import { getSession } from '@/features/authentication';
import { logError } from '@/shared/infrastructure/logging';

import type {
  BodyMeasurement,
  BodyMeasurementInput,
  BodyWeight,
  BodyWeightInput,
  ProgressSnapshot,
} from '../domain/progress';
import {
  createBodyMeasurement,
  createBodyWeight,
  deleteBodyMeasurement,
  deleteBodyWeight,
  listBodyMeasurements,
  listBodyWeights,
  listProgressSnapshots,
  updateBodyMeasurement,
  updateBodyWeight,
} from '../infrastructure/progress.repository';
import { recomputeSnapshots as gatherAndUpsertSnapshots } from './progress.gathering';

/**
 * Progress Monitoring orchestration (ADR-P016 Slice 3b). Holds UI/derived state
 * and delegates ALL persistence to the repository (local-first write + sync
 * enqueue happen there, in one transaction). No SQL and no business rules here.
 * The current user is resolved from the session — never passed by callers. No UI
 * binds to it yet.
 */

function requireUserId(): string {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

// Safe, generic user-facing messages (TECHDEBT-003 pattern): the underlying
// error is always logged via `logError` (no silent swallow), but raw
// SQLite/native/internal text is NEVER surfaced to the UI (Phase 20 B6 / BUG-005).
const LOAD_ERROR = 'Your progress could not be loaded right now.';
const SAVE_ERROR = 'We could not save your changes. Please try again.';

export type ProgressStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

export interface ProgressState {
  status: ProgressStatus;
  bodyWeights: BodyWeight[];
  bodyMeasurements: BodyMeasurement[];
  snapshots: ProgressSnapshot[];
  error: string | null;
  load: () => Promise<void>;
  loadSnapshots: () => Promise<void>;
  /** Deterministically recompute weekly snapshots from local data + upsert them. */
  recomputeSnapshots: () => Promise<boolean>;
  addBodyWeight: (input: BodyWeightInput) => Promise<boolean>;
  editBodyWeight: (id: string, input: BodyWeightInput) => Promise<boolean>;
  removeBodyWeight: (id: string) => Promise<boolean>;
  addBodyMeasurement: (input: BodyMeasurementInput) => Promise<boolean>;
  editBodyMeasurement: (id: string, input: BodyMeasurementInput) => Promise<boolean>;
  removeBodyMeasurement: (id: string) => Promise<boolean>;
}

export const useProgressStore = create<ProgressState>((set, get) => {
  async function reload(): Promise<void> {
    const userId = requireUserId();
    const [bodyWeights, bodyMeasurements, snapshots] = await Promise.all([
      listBodyWeights(userId),
      listBodyMeasurements(userId),
      listProgressSnapshots(userId),
    ]);
    set({ status: 'ready', bodyWeights, bodyMeasurements, snapshots, error: null });
  }

  async function mutate(action: (userId: string) => Promise<void>): Promise<boolean> {
    set({ status: 'saving', error: null });
    try {
      await action(requireUserId());
      await reload();
      return true;
    } catch (err) {
      // A save failure must not wipe the Progress screen: keep the last-loaded
      // data visible (status → 'ready') and surface a safe, actionable banner.
      logError('progress.store mutation failed', err);
      set({ status: 'ready', error: SAVE_ERROR });
      return false;
    }
  }

  return {
    status: 'idle',
    bodyWeights: [],
    bodyMeasurements: [],
    snapshots: [],
    error: null,

    load: async () => {
      set({ status: 'loading', error: null });
      try {
        await reload();
      } catch (err) {
        logError('progress.store load failed', err);
        set({ status: 'error', error: LOAD_ERROR });
      }
    },

    loadSnapshots: async () => {
      try {
        const snapshots = await listProgressSnapshots(requireUserId());
        set({ snapshots });
      } catch (err) {
        logError('progress.store loadSnapshots failed', err);
        set({ status: 'error', error: LOAD_ERROR });
      }
    },

    recomputeSnapshots: () =>
      mutate((userId) => gatherAndUpsertSnapshots(userId).then(() => undefined)),

    addBodyWeight: (input) =>
      mutate((userId) => createBodyWeight(userId, input).then(() => undefined)),
    editBodyWeight: (id, input) =>
      mutate((userId) => updateBodyWeight(userId, id, input).then(() => undefined)),
    removeBodyWeight: (id) => mutate((userId) => deleteBodyWeight(userId, id)),

    addBodyMeasurement: (input) =>
      mutate((userId) => createBodyMeasurement(userId, input).then(() => undefined)),
    editBodyMeasurement: (id, input) =>
      mutate((userId) => updateBodyMeasurement(userId, id, input).then(() => undefined)),
    removeBodyMeasurement: (id) => mutate((userId) => deleteBodyMeasurement(userId, id)),
  };
});
