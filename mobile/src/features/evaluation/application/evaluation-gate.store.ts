import { create } from 'zustand';

import {
  bindStoreToSession,
  isSessionCurrent,
  refreshTokens,
  requireSessionSnapshot,
  type SessionSnapshot,
} from '@/features/authentication';
import { isDatabaseUnsupportedOnWebError } from '@/shared/infrastructure/database/web-unsupported';
import { logError } from '@/shared/infrastructure/logging';
import { runSync } from '@/shared/infrastructure/sync';

import { checkEvaluationOwed } from './evaluation.service';

/**
 * The first-run evaluation step (v8 Block 2), after email verification.
 *
 * `unknown` until checked; `owed` sends the account to the Evaluación física;
 * `done` lets it into the app. A fresh install of a returning account has no
 * local rows yet, so before calling the evaluation owed the gate pulls once:
 * the person is not asked again for what they already declared on another
 * device. Offline, the local answer stands.
 */
export type EvaluationGateStatus = 'unknown' | 'checking' | 'owed' | 'done';

interface EvaluationGateState {
  status: EvaluationGateStatus;
  check: () => Promise<EvaluationGateStatus>;
  /** The wizard saved: the account may use the app. */
  markDone: () => void;
}

async function pullOnce(owner: SessionSnapshot): Promise<void> {
  const { userId, accessToken } = owner;
  const report = await runSync({ userId, getToken: () => accessToken });
  if (report.outcome !== 'unauthenticated' || !isSessionCurrent(owner)) return;
  const rotated = await refreshTokens();
  if (rotated && rotated.user.id === userId) {
    await runSync({ userId, getToken: () => rotated.accessToken });
  }
}

export const useEvaluationGate = create<EvaluationGateState>((set, get) => ({
  status: 'unknown',

  check: async () => {
    const current = get().status;
    if (current === 'checking' || current === 'done') return current;
    set({ status: 'checking' });
    let owner: SessionSnapshot | null = null;
    try {
      owner = requireSessionSnapshot();
      let owed = await checkEvaluationOwed();
      if (owed) {
        await pullOnce(owner).catch((error: unknown) => logError('evaluationGate.pull', error));
        if (!isSessionCurrent(owner)) return 'unknown';
        owed = await checkEvaluationOwed();
      }
      if (!isSessionCurrent(owner)) return 'unknown';
      const status = owed ? 'owed' : 'done';
      set({ status });
      return status;
    } catch (error) {
      // Web has no local database (ADR-P032): the Web app keeps its own flow.
      if (isDatabaseUnsupportedOnWebError(error)) {
        set({ status: 'done' });
        return 'done';
      }
      logError('evaluationGate.check', error);
      if (owner && !isSessionCurrent(owner)) return 'unknown';
      // An unreadable local store must not lock the person out of the app.
      set({ status: 'done' });
      return 'done';
    }
  },

  markDone: () => set({ status: 'done' }),
}));

bindStoreToSession(() => useEvaluationGate.setState({ status: 'unknown' }));
