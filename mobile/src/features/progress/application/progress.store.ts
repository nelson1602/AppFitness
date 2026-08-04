import { create } from 'zustand';

import { getSession } from '@/features/authentication';
import { logError } from '@/shared/infrastructure/logging';

import type {
  BodyMeasurement,
  BodyMeasurementInput,
  BodyWeight,
  BodyWeightInput,
} from '../domain/progress';
import {
  createBodyMeasurement,
  createBodyWeight,
  deleteBodyMeasurement,
  deleteBodyWeight,
  listBodyMeasurements,
  listBodyWeights,
  updateBodyMeasurement,
  updateBodyWeight,
} from '../infrastructure/progress.repository';

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

export type ProgressStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

export interface ProgressState {
  status: ProgressStatus;
  bodyWeights: BodyWeight[];
  bodyMeasurements: BodyMeasurement[];
  error: string | null;
  load: () => Promise<void>;
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
    const [bodyWeights, bodyMeasurements] = await Promise.all([
      listBodyWeights(userId),
      listBodyMeasurements(userId),
    ]);
    set({ status: 'ready', bodyWeights, bodyMeasurements, error: null });
  }

  async function mutate(action: (userId: string) => Promise<void>): Promise<boolean> {
    set({ status: 'saving', error: null });
    try {
      await action(requireUserId());
      await reload();
      return true;
    } catch (err) {
      logError('progress.store mutation failed', err);
      set({ status: 'error', error: err instanceof Error ? err.message : 'Unknown error' });
      return false;
    }
  }

  return {
    status: 'idle',
    bodyWeights: [],
    bodyMeasurements: [],
    error: null,

    load: async () => {
      set({ status: 'loading', error: null });
      try {
        await reload();
      } catch (err) {
        logError('progress.store load failed', err);
        set({ status: 'error', error: err instanceof Error ? err.message : 'Unknown error' });
      }
    },

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
