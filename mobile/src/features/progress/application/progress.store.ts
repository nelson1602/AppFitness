import { create } from 'zustand';

import {
  bindStoreToSession,
  isSessionCurrent,
  requireSessionSnapshot,
  type SessionSnapshot,
} from '@/features/authentication';
import { isDatabaseUnsupportedOnWebError } from '@/shared/infrastructure/database/web-unsupported';
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

/**
 * Every action captures the owning account once (`requireSessionSnapshot`),
 * queries with that id, and re-checks before publishing (ADR-P030 C-1).
 * Re-reading the session per step let a load started as A resolve B as the
 * owner mid-flight, or paint A's metrics onto B's Progress screen.
 */

// Safe, generic user-facing messages (TECHDEBT-003 pattern): the underlying
// error is always logged via `logError` (no silent swallow), but raw
// SQLite/native/internal text is NEVER surfaced to the UI (Phase 20 B6 / BUG-005).
const LOAD_ERROR = 'Your progress could not be loaded right now.';
const SAVE_ERROR = 'We could not save your changes. Please try again.';

export type ProgressStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error' | 'web-unavailable';

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

const INITIAL = {
  status: 'idle' as ProgressStatus,
  bodyWeights: [] as BodyWeight[],
  bodyMeasurements: [] as BodyMeasurement[],
  snapshots: [] as ProgressSnapshot[],
  error: null,
};

export const useProgressStore = create<ProgressState>((set, get) => {
  /** Reads and publishes for `owner` only. */
  async function reload(owner: SessionSnapshot): Promise<void> {
    const [bodyWeights, bodyMeasurements, snapshots] = await Promise.all([
      listBodyWeights(owner.userId),
      listBodyMeasurements(owner.userId),
      listProgressSnapshots(owner.userId),
    ]);
    if (!isSessionCurrent(owner)) return;
    set({ status: 'ready', bodyWeights, bodyMeasurements, snapshots, error: null });
  }

  async function mutate(action: (userId: string) => Promise<void>): Promise<boolean> {
    let owner: SessionSnapshot | null = null;
    set({ status: 'saving', error: null });
    try {
      owner = requireSessionSnapshot();
      await action(owner.userId);
      await reload(owner);
      return isSessionCurrent(owner);
    } catch (err) {
      // A save failure must not wipe the Progress screen: keep the last-loaded
      // data visible (status → 'ready') and surface a safe, actionable banner.
      logError('progress.store mutation failed', err);
      if (owner && !isSessionCurrent(owner)) return false;
      set({ status: 'ready', error: SAVE_ERROR });
      return false;
    }
  }

  return {
    ...INITIAL,

    load: async () => {
      let owner: SessionSnapshot | null = null;
      set({ status: 'loading', error: null });
      try {
        owner = requireSessionSnapshot();
        await reload(owner);
      } catch (err) {
        if (owner && !isSessionCurrent(owner)) return;
        if (isDatabaseUnsupportedOnWebError(err)) {
          // Web has no local database (ADR-P019): an expected, distinct state —
          // not logged as a runtime error and not auto-retried. Clear all
          // Progress data so no stale/fabricated metrics, trends, or snapshots
          // render.
          set({
            status: 'web-unavailable',
            bodyWeights: [],
            bodyMeasurements: [],
            snapshots: [],
            error: null,
          });
          return;
        }
        logError('progress.store load failed', err);
        set({ status: 'error', error: LOAD_ERROR });
      }
    },

    loadSnapshots: async () => {
      let owner: SessionSnapshot | null = null;
      try {
        owner = requireSessionSnapshot();
        const snapshots = await listProgressSnapshots(owner.userId);
        if (!isSessionCurrent(owner)) return;
        set({ snapshots });
      } catch (err) {
        logError('progress.store loadSnapshots failed', err);
        if (owner && !isSessionCurrent(owner)) return;
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

// Weights, measurements and snapshots all belong to one account; a session
// transition drops them before the next account can render them.
bindStoreToSession(() => useProgressStore.setState(INITIAL));
