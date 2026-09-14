import { create } from 'zustand';

import {
  bindStoreToSession,
  getAccessToken,
  isSessionCurrent,
  requireSessionSnapshot,
  type SessionSnapshot,
} from '@/features/authentication';
import { isDatabaseUnsupportedOnWebError } from '@/shared/infrastructure/database/web-unsupported';
import { logError } from '@/shared/infrastructure/logging';
import {
  chooseConflictResolution,
  listConflictsForReview,
  settlePendingResolutions,
  type ConflictResolutionDeps,
  type LocalConflictView,
} from '@/shared/infrastructure/sync';

/**
 * Conflict review orchestration — ADR-P030 **C-6**.
 *
 * Orchestration only. Every read and write goes through the shipped C-4
 * application service (`listConflictsForReview`, `chooseConflictResolution`,
 * `settlePendingResolutions`); this store owns no settlement logic, touches no
 * SQLite, decrypts nothing, parses no payload and calls no transport
 * (`.ai/06_MOBILE.md` §Screen Principles). Components in turn touch none of
 * this except through the hook.
 *
 * ── Persistent state is the source of truth ─────────────────────────────────
 * Every action re-reads the whole owner-scoped list from the service afterwards
 * and republishes it. Nothing is patched in place, so a card can never show a
 * choice the outbox did not actually record, and a restart shows exactly what
 * the last committed transaction left behind.
 *
 * ── `error` and `notice` are discriminants, never copy ──────────────────────
 * `.ai/08_UI_UX.md` distinction 8: this store carries closed unions and the
 * presentation layer supplies localized copy. No store message, service code,
 * id or payload value can reach a screen through either field.
 *
 * ── The notice is a report of the user's own action ─────────────────────────
 * Some outcomes are events rather than row states, because the stored row keeps
 * no trace of them afterwards: a settlement that **committed** (the conflict
 * leaves the unsettled set entirely), a decision another device took **first**,
 * a **stale** comparison (C-4 returns the conflict to undecided against fresh
 * data), and being **offline** during the attempt. C-4 reports each of them
 * per-conflict in `SettlementReport.events`, so the notice is read from the
 * service's own answer rather than inferred — and it never substitutes for the
 * row state the cards render.
 */

/** One of the two resolutions C-4 may offer. Read off the service's model. */
export type ConflictChoice = LocalConflictView['availableResolutions'][number];

export type SyncConflictsStatus = 'idle' | 'loading' | 'ready' | 'error' | 'web-unavailable';

/** Why the surface is in its Error state. A discriminant, not display copy. */
export type SyncConflictsErrorKind = 'load' | 'choose';

/** The outcome of the last action, for its confirmation. Not a canonical state. */
export type SyncConflictsNotice =
  /** T3 committed for this conflict; it is gone from the unsettled set. */
  | { readonly kind: 'settled'; readonly conflictId: string }
  /**
   * First-choice-wins: this conflict was decided somewhere else first, and this
   * device converged to that decision. `standing` is the resolution that won,
   * so the surface can say plainly which side it was.
   */
  | {
      readonly kind: 'alreadyResolved';
      readonly conflictId: string;
      readonly standing: ConflictChoice;
    }
  /** The account moved on; C-4 refreshed the comparison and re-review is required. */
  | { readonly kind: 'stale'; readonly conflictId: string }
  /** The choice is stored on this device and the round trip finishes later. */
  | { readonly kind: 'offline'; readonly conflictId: string };

export interface SyncConflictsState {
  status: SyncConflictsStatus;
  conflicts: LocalConflictView[];
  error: SyncConflictsErrorKind | null;
  notice: SyncConflictsNotice | null;
  /** The conflict currently awaiting a service call, so its card can wait. */
  busyConflictId: string | null;
  refresh: () => Promise<void>;
  choose: (conflictId: string, choice: ConflictChoice) => Promise<void>;
  settle: (conflictId: string) => Promise<void>;
}

const INITIAL = {
  status: 'idle' as SyncConflictsStatus,
  conflicts: [] as LocalConflictView[],
  error: null as SyncConflictsErrorKind | null,
  notice: null as SyncConflictsNotice | null,
  busyConflictId: null as string | null,
};

function resolutionDeps(owner: SessionSnapshot): ConflictResolutionDeps {
  return {
    userId: owner.userId,
    getToken: () => getAccessToken(),
    // Re-evaluated by the service after every await, so a pass that started as
    // one account writes nothing once another replaced it (ADR-P030 C-1).
    isCurrent: () => isSessionCurrent(owner),
  };
}

export const useSyncConflictsStore = create<SyncConflictsState>((set, get) => {
  /**
   * Re-reads the owner's conflicts and publishes them, gated on the session.
   * Returns the fresh list so an action can compare against it.
   */
  async function republish(owner: SessionSnapshot): Promise<LocalConflictView[] | null> {
    const conflicts = await listConflictsForReview(owner.userId);
    if (!isSessionCurrent(owner)) return null;
    set({ conflicts, status: 'ready', error: null });
    return conflicts;
  }

  /**
   * Web has no local database (ADR-P019). An expected platform boundary, not a
   * runtime error: it is never logged and never retried, and the list is
   * cleared so the screen renders the terminal notice with no controls.
   */
  function handleFailure(kind: SyncConflictsErrorKind, error: unknown): void {
    if (isDatabaseUnsupportedOnWebError(error)) {
      set({ ...INITIAL, status: 'web-unavailable' });
      return;
    }
    logError(`syncConflicts.${kind}`, error);
    set({ status: 'error', error: kind, busyConflictId: null });
  }

  /**
   * Drains the resolution outbox once and reports what it meant for **this**
   * conflict, read from C-4's own per-conflict event rather than guessed at
   * from counters. A pass touches up to 25 rows, so a count can never say which
   * one a settlement, a stale refresh or a convergence belonged to.
   */
  async function settleAndReport(
    owner: SessionSnapshot,
    conflictId: string,
  ): Promise<SyncConflictsNotice | null> {
    const report = await settlePendingResolutions(resolutionDeps(owner));
    if (!isSessionCurrent(owner)) return null;

    // Persistent state is republished first and unconditionally: the notice is
    // a footnote to it, never a replacement for it.
    const conflicts = await republish(owner);
    if (!conflicts) return null;

    const offline =
      report.outcome === 'offline' ? ({ kind: 'offline', conflictId } as const) : null;
    const event = report.events.find((entry) => entry.conflictId === conflictId);
    if (!event) return offline;

    switch (event.outcome) {
      case 'SETTLED':
        return { kind: 'settled', conflictId };
      case 'ALREADY_DECIDED_ELSEWHERE':
        // Without the standing resolution there is nothing specific to say, so
        // the honest fallback is the ordinary completion.
        return event.standingResolution
          ? { kind: 'alreadyResolved', conflictId, standing: event.standingResolution }
          : { kind: 'settled', conflictId };
      case 'STALE':
        return { kind: 'stale', conflictId };
      case 'FAILED':
        return offline;
      // A blocked restore and a skipped row are both fully described by the
      // refreshed card; adding a notice would only repeat it.
      case 'BLOCKED':
      case 'SKIPPED':
        return null;
    }
  }

  return {
    ...INITIAL,
    refresh: async () => {
      let owner: SessionSnapshot | null = null;
      set({ status: 'loading', error: null, notice: null });
      try {
        owner = requireSessionSnapshot();
        await republish(owner);
      } catch (error) {
        if (owner && !isSessionCurrent(owner)) return;
        handleFailure('load', error);
      }
    },
    choose: async (conflictId, choice) => {
      if (get().busyConflictId !== null) return;
      let owner: SessionSnapshot | null = null;
      set({ busyConflictId: conflictId, error: null, notice: null });
      try {
        owner = requireSessionSnapshot();
        // First choice wins, and the guard lives in the outbox: a second call
        // matches no row and comes back `ALREADY_CHOSEN`. The refresh below
        // then shows whichever choice actually stands.
        const recorded = await chooseConflictResolution(resolutionDeps(owner), conflictId, choice);
        if (!isSessionCurrent(owner)) return;
        if (recorded.status === 'SESSION_CHANGED') return;

        let notice: SyncConflictsNotice | null = null;
        if (recorded.status === 'RECORDED') {
          notice = await settleAndReport(owner, conflictId);
        } else {
          // `ALREADY_CHOSEN` or `NOT_RESOLVABLE`: nothing was recorded by this
          // call, and the refreshed row states why on its own card.
          await republish(owner);
        }
        if (!isSessionCurrent(owner)) return;
        set({ notice, busyConflictId: null });
      } catch (error) {
        if (owner && !isSessionCurrent(owner)) return;
        handleFailure('choose', error);
      }
    },
    settle: async (conflictId) => {
      if (get().busyConflictId !== null) return;
      let owner: SessionSnapshot | null = null;
      set({ busyConflictId: conflictId, error: null, notice: null });
      try {
        owner = requireSessionSnapshot();
        const notice = await settleAndReport(owner, conflictId);
        if (!isSessionCurrent(owner)) return;
        set({ notice, busyConflictId: null });
      } catch (error) {
        if (owner && !isSessionCurrent(owner)) return;
        handleFailure('choose', error);
      }
    },
  };
});

// One account's conflicts must never survive into another's screen
// (ADR-P030 Decision 8 / C-1).
bindStoreToSession(() => useSyncConflictsStore.setState(INITIAL));
