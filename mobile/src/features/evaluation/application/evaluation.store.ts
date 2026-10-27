import { create } from 'zustand';

import {
  bindStoreToSession,
  isSessionCurrent,
  requireSessionSnapshot,
  type SessionSnapshot,
} from '@/features/authentication';
import { logError } from '@/shared/infrastructure/logging';

import type { EvaluationDraft, EvaluationSources } from '../domain/evaluation';
import { loadEvaluationDraft, saveEvaluation } from './evaluation.service';

export type EvaluationMode = 'first-run' | 'update';

interface EvaluationState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  mode: EvaluationMode;
  sources: EvaluationSources | null;
  draft: EvaluationDraft | null;
  saving: boolean;
  saveFailed: boolean;
  start: (mode: EvaluationMode, now?: Date) => Promise<void>;
  update: (patch: Partial<EvaluationDraft>) => void;
  /** Writes the draft; true when everything was saved. */
  save: () => Promise<boolean>;
}

const INITIAL = {
  status: 'idle' as const,
  mode: 'first-run' as EvaluationMode,
  sources: null,
  draft: null,
  saving: false,
  saveFailed: false,
};

/**
 * The wizard's draft between steps. It is UI orchestration only: the draft
 * reaches storage through `saveEvaluation`, never from here (.ai/06_MOBILE.md).
 */
export const useEvaluationStore = create<EvaluationState>((set, get) => ({
  ...INITIAL,

  start: async (mode, now = new Date()) => {
    let owner: SessionSnapshot | null = null;
    set({ ...INITIAL, mode, status: 'loading' });
    try {
      owner = requireSessionSnapshot();
      const { sources, draft } = await loadEvaluationDraft(now);
      if (!isSessionCurrent(owner)) return;
      set({ status: 'ready', sources, draft });
    } catch (error) {
      logError('evaluation.start', error);
      if (owner && !isSessionCurrent(owner)) return;
      set({ status: 'error' });
    }
  },

  update: (patch) => {
    const draft = get().draft;
    if (draft) set({ draft: { ...draft, ...patch } });
  },

  save: async () => {
    const { draft, sources } = get();
    if (!draft || !sources) return false;
    let owner: SessionSnapshot | null = null;
    set({ saving: true, saveFailed: false });
    try {
      owner = requireSessionSnapshot();
      await saveEvaluation(draft, sources);
      if (!isSessionCurrent(owner)) return false;
      set({ saving: false });
      return true;
    } catch (error) {
      logError('evaluation.save', error);
      if (owner && !isSessionCurrent(owner)) return false;
      set({ saving: false, saveFailed: true });
      return false;
    }
  },
}));

bindStoreToSession(() => useEvaluationStore.setState(INITIAL));
