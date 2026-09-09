import { create } from 'zustand';

import {
  bindStoreToSession,
  isSessionCurrent,
  requireSessionSnapshot,
  type SessionSnapshot,
} from '@/features/authentication';
import { isDatabaseUnsupportedOnWebError } from '@/shared/infrastructure/database/web-unsupported';
import { logError, logWarn } from '@/shared/infrastructure/logging';

import type { WellnessSafetyProfile } from '../domain/wellness-safety-profile';
import {
  WellnessProfileInvalid,
  type WellnessSafetyProfileInput,
} from '../domain/wellness-safety-profile.rules';
import {
  deleteMyWellnessSafetyProfile,
  getMyWellnessSafetyProfile,
  saveMyWellnessSafetyProfile,
} from './wellness-safety-profile.service';
import {
  getWellnessSafetyProfileSyncState,
  type WellnessSafetyProfileSyncState,
} from './wellness-safety-profile.sync-state';

/**
 * Wellness Safety Profile orchestration (ADR-P017 **W-3**).
 *
 * Orchestration only: every read, write and delete goes through the shipped W-2
 * application boundary, which owns validation, normalization, the local-first
 * write and its sync enqueue. This layer holds status, and components hold
 * none of it — no component touches the service, the repository or SQLite
 * (`.ai/06_MOBILE.md`).
 *
 * ── `error` is a discriminant, never display copy ───────────────────────────
 * `.ai/08_UI_UX.md` distinction 8: the store's error field is a discriminant
 * and the presentation layer supplies localized title/body. So this store
 * carries a small closed union instead of the English sentences the older
 * stores keep, and there is no path by which a raw message, a decoder reason,
 * a rejected field or a token value can reach the screen.
 *
 * ── A corrupt stored row is refused, not repaired ───────────────────────────
 * W-2 decodes both inbound edges strictly and throws `WellnessProfileInvalid`
 * rather than returning a degraded profile — for a safety profile an empty
 * `movements_to_avoid` would read as "no limitations declared". That throw
 * lands here as the `invalid` discriminant, which the screen renders as safe
 * localized copy. **The stored row is left exactly as it is**: this store
 * issues no repair write, no delete and no overwrite in that path. The reason
 * and field are deliberately not logged either — a decoder detail is not
 * something to emit to a console or a crash reporter.
 */

export type WellnessSafetyProfileStatus =
  'idle' | 'loading' | 'ready' | 'saving' | 'error' | 'web-unavailable';

/**
 * Why the surface is in its Error state. `invalid` is the stored-row refusal
 * above; `invalidInput` is a domain rejection of a submitted answer (the form's
 * Zod schema mirrors the same rules, so it is defensive, not the usual path).
 */
export type WellnessSafetyProfileErrorKind =
  'load' | 'invalid' | 'save' | 'invalidInput' | 'remove';

/** The last completed write, for its confirmation. Not a canonical state. */
export type WellnessSafetyProfileOutcome = 'saved' | 'removed';

export interface WellnessSafetyProfileState {
  status: WellnessSafetyProfileStatus;
  profile: WellnessSafetyProfile | null;
  sync: WellnessSafetyProfileSyncState;
  error: WellnessSafetyProfileErrorKind | null;
  outcome: WellnessSafetyProfileOutcome | null;
  load: () => Promise<void>;
  save: (input: WellnessSafetyProfileInput, today?: string) => Promise<boolean>;
  remove: () => Promise<boolean>;
}

const INITIAL = {
  status: 'idle' as WellnessSafetyProfileStatus,
  profile: null as WellnessSafetyProfile | null,
  sync: 'synced' as WellnessSafetyProfileSyncState,
  error: null as WellnessSafetyProfileErrorKind | null,
  outcome: null as WellnessSafetyProfileOutcome | null,
};

/**
 * Web has no local database (ADR-P019). An expected platform boundary, so it is
 * not logged as a runtime error and is never retried; the profile is cleared so
 * the screen can render the informational state with no editable form.
 */
function isWebDormant(error: unknown): boolean {
  return isDatabaseUnsupportedOnWebError(error);
}

export const useWellnessSafetyProfileStore = create<WellnessSafetyProfileState>((set) => ({
  ...INITIAL,
  load: async () => {
    // A read started as one account must never publish onto another's screen
    // (ADR-P030 C-1): capture the owner, gate every publish.
    let owner: SessionSnapshot | null = null;
    set({ status: 'loading', error: null, outcome: null });
    try {
      owner = requireSessionSnapshot();
      const profile = await getMyWellnessSafetyProfile();
      const sync = await getWellnessSafetyProfileSyncState();
      if (!isSessionCurrent(owner)) return;
      set({ profile, sync, status: 'ready', error: null });
    } catch (error) {
      if (owner && !isSessionCurrent(owner)) return;
      if (isWebDormant(error)) {
        set({ ...INITIAL, status: 'web-unavailable' });
        return;
      }
      if (error instanceof WellnessProfileInvalid) {
        // Static message only: the reason and field are decoder details.
        logWarn('wellnessSafetyProfile.load', 'stored profile refused by the decoder');
        set({ status: 'error', error: 'invalid', profile: null });
        return;
      }
      logError('wellnessSafetyProfile.load', error);
      set({ status: 'error', error: 'load' });
    }
  },
  save: async (input, today) => {
    let owner: SessionSnapshot | null = null;
    set({ status: 'saving', error: null, outcome: null });
    try {
      owner = requireSessionSnapshot();
      const profile = await saveMyWellnessSafetyProfile(input, today);
      const sync = await getWellnessSafetyProfileSyncState();
      if (!isSessionCurrent(owner)) return false;
      set({ profile, sync, status: 'ready', error: null, outcome: 'saved' });
      return true;
    } catch (error) {
      if (owner && !isSessionCurrent(owner)) return false;
      if (isWebDormant(error)) {
        set({ ...INITIAL, status: 'web-unavailable' });
        return false;
      }
      if (error instanceof WellnessProfileInvalid) {
        logWarn('wellnessSafetyProfile.save', 'submitted answers refused by domain validation');
        set({ status: 'ready', error: 'invalidInput' });
        return false;
      }
      logError('wellnessSafetyProfile.save', error);
      set({ status: 'ready', error: 'save' });
      return false;
    }
  },
  remove: async () => {
    let owner: SessionSnapshot | null = null;
    set({ status: 'saving', error: null, outcome: null });
    try {
      owner = requireSessionSnapshot();
      await deleteMyWellnessSafetyProfile();
      const sync = await getWellnessSafetyProfileSyncState();
      if (!isSessionCurrent(owner)) return false;
      set({ profile: null, sync, status: 'ready', error: null, outcome: 'removed' });
      return true;
    } catch (error) {
      if (owner && !isSessionCurrent(owner)) return false;
      if (isWebDormant(error)) {
        set({ ...INITIAL, status: 'web-unavailable' });
        return false;
      }
      logError('wellnessSafetyProfile.remove', error);
      set({ status: 'ready', error: 'remove' });
      return false;
    }
  },
}));

// A cached profile belongs to one account; a session transition drops it
// immediately (ADR-P030 C-1).
bindStoreToSession(() => useWellnessSafetyProfileStore.setState(INITIAL));
