import { decryptFromBase64 } from '../crypto/field-cipher';
import { inTransaction } from '../database';
import type { OfferedResolution, SettlementStatus, SyncConflictRow } from '../database/types';
import { getApplier } from './appliers';
import { buildConflictReview, type ConflictReview } from './conflict-presenter';
import {
  armSettlementReplay,
  blockResolutionAndRearm,
  chooseResolution,
  claimSettlementAttempt,
  findOwnedConflict,
  listSettlementDue,
  listUnsettledConflicts,
  markConflictSettled,
  markSettlementFailed,
  refreshConflictComparison,
  releaseStuckSettlements,
  type ChosenConflictRow,
} from './sync-conflicts';
import { findParkedOperation, readQueuePayload, removeParkedOperation } from './sync-queue';
import {
  createSyncTransport,
  SyncHttpError,
  type ConflictResolutionChoice,
  type ResolveConflictRequest,
  type SyncTransport,
} from './sync-transport';

/**
 * Local conflict-resolution service — ADR-P030 slice C-4 (§Decisions 4, 6, 7,
 * 10). It owns every behaviour that reads or writes migration 006's dormant
 * resolution outbox, and it is the only way a surface reaches conflict state:
 * presentation calls this service, never SQLite (.ai/06_MOBILE.md).
 *
 * ── The lifecycle ───────────────────────────────────────────────────────────
 * **T1** records the choice locally and offline (Decision 7). **T2** is the
 * server's single resolution transaction, reached through
 * `POST /sync/conflicts/:id/resolve`. **T3** applies that answer locally, in
 * one transaction. **T1′** replaces T3 when the server answers
 * `RESTORE_UNSUPPORTED`.
 *
 * Nothing is ever re-enqueued: the server has already applied `CLIENT_WINS`
 * inside T2, so the row it returns *is* the applied result (Decision 3). A
 * replacement push could not report settlement and would re-open the conflict.
 *
 * ── What never happens here ─────────────────────────────────────────────────
 * - No server-authored prose reaches a caller. The endpoint answers stable
 *   codes, and only those codes and the authoritative row are read.
 * - A conflict is never settled by a *status*. An explicit resolved status is
 *   a trigger for the guaranteed replay, nothing more (Decision 9); absence is
 *   never interpreted at all.
 * - The authoritative `status` moves only inside T3, on a resolve response.
 *
 * ── Account isolation ───────────────────────────────────────────────────────
 * Every entry point takes the owner explicitly, and every mutating one also
 * takes `isCurrent()` — the caller's session-generation check (ADR-P030
 * Decision 8). It is re-evaluated after each await and before each write, so a
 * pass that started as one account abandons rather than writing anything once
 * another account (or a sign-out) has replaced it.
 */

const SETTLEMENT_BATCH_SIZE = 25;
/** The server bounds `ids` at 100 (`ListConflictsQueryDto`); match it exactly. */
const RECONCILE_ID_LIMIT = 100;

/** Server statuses that positively prove a conflict was resolved elsewhere. */
const RESOLVED_SERVER_STATUSES = ['RESOLVED_CLIENT_WINS', 'RESOLVED_SERVER_WINS'];

/** Why a listed conflict cannot be resolved on this device (Decisions 9, 12). */
export type ConflictBlocker = 'REMOTE_ORIGIN' | 'UNSUPPORTED_ENTITY' | 'ENCRYPTED_PAYLOAD';

/**
 * What a surface may know about one conflict. Codes and metadata only — no
 * payload, no free text, nothing server-authored. C-5/C-6 own the copy these
 * codes key, and the allow-listed payload presenter (Decision 2).
 */
export interface LocalConflictView {
  id: string;
  entityType: string;
  entityId: string;
  baseVersion: number;
  serverVersion: number;
  createdAt: string;
  chosenResolution: OfferedResolution | null;
  chosenAt: string | null;
  settlementStatus: SettlementStatus | null;
  settlementAttempts: number;
  nextAttemptAt: string | null;
  /** Stable code for the last blocking outcome (e.g. `RESTORE_UNSUPPORTED`). */
  lastFailureCode: string | null;
  /** A resolution the server refused for this conflict (T1′). */
  blockedResolution: OfferedResolution | null;
  /**
   * True when the account side under comparison is a deletion. §Decision 3
   * requires the user be told plainly that the record was deleted elsewhere
   * and that keeping their version **restores** it, so the fact has to reach
   * the surface; the payload it is read from never does.
   */
  serverDeleted: boolean;
  /** Null when resolvable here; otherwise why not. */
  notResolvableReason: ConflictBlocker | null;
  /** Empty whenever `notResolvableReason` is set, or once a choice stands. */
  availableResolutions: OfferedResolution[];
  /**
   * The allow-listed, copy-neutral review model (Decision 2): safe field
   * identifiers and resolved values only, never a raw payload.
   */
  review: ConflictReview;
}

export interface ConflictResolutionDeps {
  /** Owner whose conflicts this pass touches. Never read from a global. */
  userId: string;
  getToken(): string | null;
  /**
   * True while the captured session is still current. Required, not optional:
   * a defaulted guard is not a guard, and every write below depends on it.
   */
  isCurrent(): boolean;
  baseUrl?: string;
  now?(): string;
}

export type SettlementOutcome = 'success' | 'unauthenticated' | 'offline' | 'session-changed';

/**
 * What one pass did to one conflict.
 *
 * The counters below say *how many*; they cannot say *which*, and two of the
 * outcomes are indistinguishable afterwards from the stored row alone — a
 * committed settlement leaves the unsettled set entirely, and a decision taken
 * on another device is applied as an ordinary settlement. A surface that has to
 * tell the user what became of the conflict **they** just acted on therefore
 * needs the per-conflict fact, and this is the whole of it.
 *
 * Deliberately narrow: the conflict handle, the classification, and the
 * resolution that ended up standing. **No payload, no entity id, no owner, no
 * server prose and no error text** — the handle itself is an opaque key a
 * surface matches against, never something it renders.
 */
export type SettlementEventOutcome =
  /** T3 committed the choice this device recorded. */
  | 'SETTLED'
  /** First-choice-wins: another device decided first, and this one converged. */
  | 'ALREADY_DECIDED_ELSEWHERE'
  /** `STALE_COMPARISON`: comparison refreshed, re-review required. */
  | 'STALE'
  /** `RESTORE_UNSUPPORTED`: the refused resolution is now blocked. */
  | 'BLOCKED'
  /** Transport/5xx; the choice stands and becomes due again. */
  | 'FAILED'
  /** Not claimable, or holding no deliverable operation. */
  | 'SKIPPED';

export interface SettlementEvent {
  /** Opaque handle. Matched against, never rendered. */
  readonly conflictId: string;
  readonly outcome: SettlementEventOutcome;
  /** The resolution that stands, when this pass established one. */
  readonly standingResolution: OfferedResolution | null;
}

export interface SettlementReport {
  outcome: SettlementOutcome;
  /** T3 committed. */
  settled: number;
  /** Transport/5xx; the row keeps its choice and becomes due again. */
  failed: number;
  /** `STALE_COMPARISON`: comparison refreshed, re-review required. */
  staleRefreshed: number;
  /** `RESTORE_UNSUPPORTED`: T1′ ran, the refused choice is now blocked. */
  blocked: number;
  /** Not claimable, or holding no deliverable operation. */
  skipped: number;
  /** One entry per conflict this pass touched, in the order it touched them. */
  events: SettlementEvent[];
}

export interface ReconcileReport {
  outcome: SettlementOutcome;
  /** Ids the server positively reported as resolved, so a replay was armed. */
  replaysArmed: number;
  /** Locally-known ids the server said nothing about — absence proves nothing. */
  unreported: number;
}

export type ChoiceResult =
  | { status: 'RECORDED' }
  /** A choice already stands, or the conflict is not in a choosable state. */
  | { status: 'ALREADY_CHOSEN' }
  | { status: 'NOT_RESOLVABLE'; reason: ConflictBlocker }
  | { status: 'SESSION_CHANGED' };

// ── Vocabulary mapping (Decision 3: total, no third value either side) ───────

function toServerChoice(local: OfferedResolution): ConflictResolutionChoice {
  return local === 'RESOLVED_LOCAL_WINS' ? 'CLIENT_WINS' : 'SERVER_WINS';
}

function toLocalStatus(server: ConflictResolutionChoice): OfferedResolution {
  return server === 'CLIENT_WINS' ? 'RESOLVED_LOCAL_WINS' : 'RESOLVED_SERVER_WINS';
}

/**
 * The tombstone state the pending comparison is against. Read from the stored
 * server snapshot rather than remembered separately, so a `STALE_COMPARISON`
 * refresh updates the version, the row and `expectedDeleted` together and they
 * can never disagree.
 */
export function isDeletedSnapshot(payload: Record<string, unknown>): boolean {
  const deletedAt = payload['deleted_at'];
  return deletedAt !== null && deletedAt !== undefined;
}

function parsePayload(text: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(text);
  return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
}

/** Both sides of a conflict, decrypted, ready for the allow-list presenter. */
interface ConflictPayloads {
  readonly local: Record<string, unknown>;
  readonly server: Record<string, unknown>;
}

/**
 * Resolves a stored conflict payload. `dietary_preferences` and `meal_items`
 * enqueue as `sensitive`, so the push worker stored **both** of their payloads
 * as `{"__enc": …}` envelopes (A-4). They are decrypted here, in the
 * repository/application layer, so that everything above sees resolved values
 * and ciphertext never escapes (Decision 2).
 *
 * @returns null when a payload cannot be resolved — fail closed, never guess.
 */
async function decryptPayload(text: string): Promise<Record<string, unknown> | null> {
  const parsed = parsePayload(text);
  const envelope = parsed['__enc'];
  if (typeof envelope !== 'string') return parsed;
  try {
    const plain: unknown = JSON.parse(await decryptFromBase64(envelope));
    return typeof plain === 'object' && plain !== null ? (plain as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function readConflictPayloads(row: SyncConflictRow): Promise<ConflictPayloads | null> {
  const local = await decryptPayload(row.local_payload);
  const server = await decryptPayload(row.server_payload);
  return local && server ? { local, server } : null;
}

/**
 * Stable, client-authored diagnostics. A raw error message could carry
 * arbitrary text; only these codes are ever stored or surfaced.
 */
function describeFailure(error: unknown): string {
  return error instanceof SyncHttpError ? `http_${error.status}` : 'network_error';
}

// ── Reading ──────────────────────────────────────────────────────────────────

/**
 * Classifies one conflict without touching the network. A conflict is
 * resolvable here only when this device holds the retained operation, an
 * applier exists for the entity type, and neither payload is a sensitive
 * envelope.
 */
async function classify(
  userId: string,
  row: SyncConflictRow,
  payloads: ConflictPayloads | null,
): Promise<{ reason: ConflictBlocker | null }> {
  // Medical is dormant by construction: `registerMedicalSyncAppliers()` is
  // never invoked, so those entity types have no applier and can never be
  // resolved or replayed from here (ADR-P017 / Decision 12).
  if (!getApplier(row.entity_type)) return { reason: 'UNSUPPORTED_ENTITY' };
  // A payload that will not decrypt fails closed rather than being guessed at.
  if (!payloads) return { reason: 'ENCRYPTED_PAYLOAD' };
  const parked = await findParkedOperation(userId, row.entity_type, row.entity_id);
  // Remote-origin: the originating device holds the payload. Neither choice is
  // deliverable from here, so neither is offered (Decision 9).
  return { reason: parked ? null : 'REMOTE_ORIGIN' };
}

function toView(
  row: SyncConflictRow,
  reason: ConflictBlocker | null,
  review: ConflictReview,
  serverDeleted: boolean,
): LocalConflictView {
  const decided = row.chosen_resolution !== null;
  // A conflict the presenter refuses offers no choice either: an entity whose
  // fields cannot be shown safely must not be decided blind (Decision 12).
  const presentable = review.status === 'REVIEWABLE';
  const offered: OfferedResolution[] =
    reason !== null || decided || !presentable
      ? []
      : (['RESOLVED_LOCAL_WINS', 'RESOLVED_SERVER_WINS'] as const).filter(
          (choice) => choice !== row.blocked_resolution,
        );

  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    baseVersion: row.base_version,
    serverVersion: row.server_version,
    createdAt: row.created_at,
    chosenResolution: row.chosen_resolution,
    chosenAt: row.chosen_at,
    settlementStatus: row.settlement_status,
    settlementAttempts: row.settlement_attempts,
    nextAttemptAt: row.next_attempt_at,
    lastFailureCode: row.last_failure_code,
    blockedResolution: row.blocked_resolution,
    serverDeleted,
    notResolvableReason: reason,
    availableResolutions: offered,
    review,
  };
}

/**
 * Everything still owing this owner an outcome, oldest first — the set a
 * surface lists and counts. A recorded-but-unsettled choice stays in it, so
 * the number never drops before the round trip completes (Decision 6).
 */
export async function listConflictsForReview(userId: string): Promise<LocalConflictView[]> {
  const rows = await listUnsettledConflicts(userId);
  const views: LocalConflictView[] = [];
  for (const row of rows) {
    // Decryption happens HERE, below presentation (A-4 / Decision 2): the
    // presenter and everything above it see resolved values only, and
    // ciphertext never leaves this loop.
    const payloads = await readConflictPayloads(row);
    const { reason } = await classify(userId, row, payloads);
    const review = payloads
      ? buildConflictReview(row, payloads.local, payloads.server)
      : ({
          status: 'UNSUPPORTED',
          entityKind: row.entity_type,
          reason: 'MALFORMED_PAYLOAD',
        } as const);
    // Read from the decrypted snapshot, so a sensitive entity reports its
    // tombstone honestly rather than as `false` from an unread envelope.
    // A payload that could not be resolved claims nothing.
    views.push(toView(row, reason, review, payloads ? isDeletedSnapshot(payloads.server) : false));
  }
  return views;
}

// ── T1 ───────────────────────────────────────────────────────────────────────

/**
 * **T1** (Decisions 6, 7) — record the user's decision. Works offline: it
 * lands in the durable outbox and is settled later by
 * `settlePendingResolutions`.
 *
 * First choice wins. A double tap loses the guarded claim and is reported as
 * `ALREADY_CHOSEN` rather than replacing the standing choice.
 */
export async function chooseConflictResolution(
  deps: ConflictResolutionDeps,
  conflictId: string,
  choice: OfferedResolution,
): Promise<ChoiceResult> {
  const now = deps.now ?? ((): string => new Date().toISOString());

  const row = await findOwnedConflict(deps.userId, conflictId);
  if (!deps.isCurrent()) return { status: 'SESSION_CHANGED' };
  if (!row) return { status: 'ALREADY_CHOSEN' };

  const payloads = await readConflictPayloads(row);
  const { reason } = await classify(deps.userId, row, payloads);
  if (!deps.isCurrent()) return { status: 'SESSION_CHANGED' };
  if (reason) return { status: 'NOT_RESOLVABLE', reason };

  const recorded = await chooseResolution(deps.userId, conflictId, choice, now());
  return recorded ? { status: 'RECORDED' } : { status: 'ALREADY_CHOSEN' };
}

// ── T2 → T3 / T1′ ────────────────────────────────────────────────────────────

/**
 * Drains the resolution outbox: every chosen conflict whose attempt is due is
 * sent once, and its typed answer is applied locally.
 *
 * Restart recovery runs first — a process that died mid-attempt left
 * `IN_FLIGHT` behind, and that choice must stay retryable.
 */
export async function settlePendingResolutions(
  deps: ConflictResolutionDeps,
): Promise<SettlementReport> {
  const report: SettlementReport = {
    outcome: 'success',
    settled: 0,
    failed: 0,
    staleRefreshed: 0,
    blocked: 0,
    skipped: 0,
    events: [],
  };
  if (!deps.getToken()) return { ...report, outcome: 'unauthenticated' };

  const now = deps.now ?? ((): string => new Date().toISOString());
  const transport = createSyncTransport(deps.getToken, deps.baseUrl);

  await releaseStuckSettlements(deps.userId);
  if (!deps.isCurrent()) return { ...report, outcome: 'session-changed' };

  const due = await listSettlementDue(deps.userId, now(), SETTLEMENT_BATCH_SIZE);
  if (!deps.isCurrent()) return { ...report, outcome: 'session-changed' };

  for (const row of due) {
    const outcome = await settleOne(deps, transport, row, now, report);
    if (outcome !== 'success') return { ...report, outcome };
  }
  return report;
}

async function settleOne(
  deps: ConflictResolutionDeps,
  transport: SyncTransport,
  row: ChosenConflictRow,
  now: () => string,
  report: SettlementReport,
): Promise<SettlementOutcome> {
  const choice = row.chosen_resolution;

  /**
   * Records what this pass did to this conflict, alongside the counter it
   * already increments. The counters are unchanged: every existing increment
   * below still happens, in the same branch, for the same reason.
   */
  const note = (
    outcome: SettlementEventOutcome,
    standingResolution: OfferedResolution | null = null,
  ): void => {
    report.events.push({ conflictId: row.id, outcome, standingResolution });
  };

  const request = await buildRequest(deps.userId, row, choice);
  if (!deps.isCurrent()) return 'session-changed';
  if (!request) {
    // The retained operation is gone, so `CLIENT_WINS` is not deliverable.
    // Nothing is invented on the user's behalf; the row stays counted.
    report.skipped += 1;
    note('SKIPPED');
    return 'success';
  }

  if (!(await claimSettlementAttempt(deps.userId, row.id))) {
    report.skipped += 1;
    note('SKIPPED');
    return 'success';
  }
  if (!deps.isCurrent()) return 'session-changed';

  let answer;
  try {
    answer = await transport.resolveConflict(row.id, request);
  } catch (error) {
    if (!deps.isCurrent()) return 'session-changed';
    await markSettlementFailed(deps.userId, row.id, describeFailure(error), now());
    report.failed += 1;
    // The stable diagnostic code stays in the outbox; the event carries none.
    note('FAILED', choice);
    return error instanceof SyncHttpError && error.status === 401 ? 'unauthenticated' : 'offline';
  }
  if (!deps.isCurrent()) return 'session-changed';

  switch (answer.outcome) {
    case 'RESOLVED':
    case 'ALREADY_RESOLVED_SAME_CHOICE': {
      // The server settled this choice; the returned row is the applied result.
      const settled = await applySettlement(deps.userId, row, choice, answer.current, now());
      report[settled ? 'settled' : 'skipped'] += 1;
      note(settled ? 'SETTLED' : 'SKIPPED', settled ? choice : null);
      return 'success';
    }
    case 'ALREADY_RESOLVED_OPPOSITE_CHOICE': {
      // First-choice-wins is not overturned; this device converges to the
      // decision that won, using the authoritative row it carries.
      const standing = answer.resolution ? toLocalStatus(answer.resolution) : choice;
      const settled = await applySettlement(deps.userId, row, standing, answer.current, now());
      report[settled ? 'settled' : 'skipped'] += 1;
      // Distinguished from an ordinary settlement: the stored row afterwards
      // cannot say that a different device's decision is the one that stands.
      note(settled ? 'ALREADY_DECIDED_ELSEWHERE' : 'SKIPPED', settled ? standing : null);
      return 'success';
    }
    case 'STALE_COMPARISON': {
      // Refresh what the user is being asked about and require a new review.
      // Deliberately not a settlement: nothing was applied server-side.
      await refreshConflictComparison(
        deps.userId,
        row.id,
        answer.current.row,
        answer.current.version,
      );
      report.staleRefreshed += 1;
      note('STALE');
      return 'success';
    }
    case 'RESTORE_UNSUPPORTED': {
      await blockResolutionAndRearm(deps.userId, row.id, choice, answer.outcome);
      report.blocked += 1;
      note('BLOCKED');
      return 'success';
    }
  }
}

/**
 * Builds the resolve request. `CLIENT_WINS` carries the retained operation and
 * payload — read from the parked queue row, never from the server's redacted
 * snapshot — and `SERVER_WINS` carries neither, which the endpoint enforces.
 *
 * Returns null when a `CLIENT_WINS` settlement has no deliverable operation.
 */
async function buildRequest(
  userId: string,
  row: SyncConflictRow,
  choice: OfferedResolution,
): Promise<ResolveConflictRequest | null> {
  const base = {
    resolution: toServerChoice(choice),
    expectedServerVersion: row.server_version,
    expectedDeleted: isDeletedSnapshot(parsePayload(row.server_payload)),
  } satisfies ResolveConflictRequest;

  if (choice === 'RESOLVED_SERVER_WINS') return base;

  const parked = await findParkedOperation(userId, row.entity_type, row.entity_id);
  if (!parked) return null;
  // `readQueuePayload` decrypts a sensitive envelope, so the retained
  // operation travels as plaintext over TLS exactly as §Decision 3 requires
  // (A-4). Medical is excluded earlier, by having no registered applier.
  const { payload } = await readQueuePayload(parked);

  return { ...base, operation: parked.operation, payload };
}

/**
 * **T3** (Decision 6) — one owner-scoped local transaction: apply the
 * authoritative row through the entity's existing applier, drop the parked
 * operation, move the authoritative `status`, and mark the outbox `SETTLED`.
 *
 * All four or none. If the guarded conflict transition matches nothing — the
 * row moved under us — the transaction throws and rolls the applied row and
 * the removal back with it, leaving the conflict retryable rather than
 * half-settled.
 *
 * @returns true when the settlement committed.
 */
async function applySettlement(
  userId: string,
  row: SyncConflictRow,
  status: OfferedResolution,
  current: { row: Record<string, unknown>; deleted: boolean },
  nowIso: string,
): Promise<boolean> {
  const applier = getApplier(row.entity_type);
  // Unsupported entity: fail closed. Nothing is applied and nothing is marked
  // settled, so the conflict stays counted rather than silently disappearing.
  if (!applier) return false;

  try {
    // One executor for all three effects (BUG-015). `tx` is the exclusive
    // transaction's own connection: anything written through the root one
    // instead would commit independently and survive the rollback below.
    await inTransaction(async (tx) => {
      await applier.applyServerChange({
        data: current.row,
        deleted: current.deleted,
        userId,
        tx,
      });
      await removeParkedOperation(userId, row.entity_type, row.entity_id, tx);
      const settled = await markConflictSettled(userId, row.id, status, nowIso, tx);
      if (!settled) throw new SettlementRolledBack(row.id);
    });
  } catch (error) {
    if (error instanceof SettlementRolledBack) return false;
    throw error;
  }
  return true;
}

/** Internal: aborts T3 so SQLite rolls the whole settlement back. */
class SettlementRolledBack extends Error {
  constructor(conflictId: string) {
    super(`Settlement rolled back for ${conflictId}`);
    this.name = 'SettlementRolledBack';
  }
}

// ── Status reconciliation (Decision 9) ───────────────────────────────────────

/**
 * Asks the server for the status of locally-unsettled conflicts and arms a
 * replay for the ones it **explicitly** reports as resolved.
 *
 * This is a latency optimisation, not a recovery path. Absence proves nothing
 * and is never interpreted; an explicit status settles nothing and changes no
 * entity row. Only the resolve response plus T3 can do that, and a client that
 * never calls this still converges through the same-choice replay.
 */
export async function reconcileConflictStatuses(
  deps: ConflictResolutionDeps,
): Promise<ReconcileReport> {
  const report: ReconcileReport = { outcome: 'success', replaysArmed: 0, unreported: 0 };
  if (!deps.getToken()) return { ...report, outcome: 'unauthenticated' };

  const rows = await listUnsettledConflicts(deps.userId);
  if (!deps.isCurrent()) return { ...report, outcome: 'session-changed' };

  // Only conflicts carrying a recorded choice can be replayed, and the replay
  // is the only thing a status may trigger.
  const replayable = rows
    .filter((row) => row.chosen_resolution !== null && row.settlement_status !== 'SETTLED')
    .slice(0, RECONCILE_ID_LIMIT);
  if (replayable.length === 0) return report;

  const transport = createSyncTransport(deps.getToken, deps.baseUrl);
  let response;
  try {
    response = await transport.listConflicts({ ids: replayable.map((row) => row.id) });
  } catch (error) {
    return {
      ...report,
      outcome:
        error instanceof SyncHttpError && error.status === 401 ? 'unauthenticated' : 'offline',
    };
  }
  if (!deps.isCurrent()) return { ...report, outcome: 'session-changed' };

  const reported = new Map(response.statuses.map((entry) => [entry.id, entry.status]));
  for (const row of replayable) {
    const status = reported.get(row.id);
    if (status === undefined) {
      report.unreported += 1;
      continue;
    }
    if (!RESOLVED_SERVER_STATUSES.includes(status)) continue;
    if (await armSettlementReplay(deps.userId, row.id)) report.replaysArmed += 1;
    if (!deps.isCurrent()) return { ...report, outcome: 'session-changed' };
  }
  return report;
}
