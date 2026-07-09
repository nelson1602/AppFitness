import { create } from 'zustand';

import { logError } from '@/shared/infrastructure/logging';

import type { Evaluation, EvaluationInput } from '../domain/medical.types';
import { getMyEvaluations, recordEvaluation, removeEvaluation } from './medical.service';

/**
 * Evaluation orchestration (Phase 14). Holds load/save status for the
 * evaluation entry screen (Slice 1) and the evaluation history screen
 * (Slice 2). Delegates ALL persistence to the medical service (local-first
 * write, field-level encryption of sensitive free-text, and sync enqueue
 * all happen in the repository — never here, never in components;
 * .ai/05_SECURITY.md, .ai/06_MOBILE.md). Mirrors the profile/goal store.
 *
 * Evaluations are append-only: `save` records a NEW evaluation, `remove`
 * soft-deletes one (corrections are new records or a soft-delete — no
 * edit-in-place). `latest` is the most recent record; `evaluations` is the
 * full history for the list screen.
 *
 * Errors are logged with a static tag and the error object only — never
 * the evaluation values (which may include sensitive medical free-text).
 */

export type EvaluationStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

export interface EvaluationFormState {
  status: EvaluationStatus;
  latest: Evaluation | null;
  evaluations: Evaluation[];
  error: string | null;
  load: () => Promise<void>;
  save: (input: EvaluationInput) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
}

export const useEvaluationStore = create<EvaluationFormState>((set) => ({
  status: 'idle',
  latest: null,
  evaluations: [],
  error: null,
  load: async () => {
    set({ status: 'loading', error: null });
    try {
      const evaluations = await getMyEvaluations();
      set({ evaluations, latest: evaluations[0] ?? null, status: 'ready', error: null });
    } catch (error) {
      logError('evaluation.load', error);
      set({ status: 'error', error: 'Your evaluations could not be loaded right now.' });
    }
  },
  save: async (input) => {
    set({ status: 'saving', error: null });
    try {
      // Local-first write; the repository encrypts sensitive free-text and
      // enqueues the sync op in the same transaction. Returns after the
      // local commit — sync ships later.
      const evaluation = await recordEvaluation(input);
      set((state) => ({
        evaluations: [evaluation, ...state.evaluations],
        latest: evaluation,
        status: 'ready',
        error: null,
      }));
      return true;
    } catch (error) {
      logError('evaluation.save', error);
      set({ status: 'error', error: 'Your evaluation could not be saved. Please try again.' });
      return false;
    }
  },
  remove: async (id) => {
    set({ status: 'saving', error: null });
    try {
      // Soft delete + sync enqueue in one transaction (repository).
      await removeEvaluation(id);
      const evaluations = await getMyEvaluations();
      set({ evaluations, latest: evaluations[0] ?? null, status: 'ready', error: null });
      return true;
    } catch (error) {
      logError('evaluation.remove', error);
      set({ status: 'error', error: 'Your evaluation could not be removed. Please try again.' });
      return false;
    }
  },
}));
