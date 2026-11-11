import type { CoachAssessment, EngineInput } from '@/features/icoach/domain/types';

// 'web-unavailable' is a distinct, non-error state: the local database is
// dormant on Web (ADR-P019), so dashboard data cannot be loaded there.
export type DashboardStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'web-unavailable';
export type SyncUiStatus = 'idle' | 'syncing' | 'offline' | 'error';

export interface DataRequirement {
  id: string;
  title: string;
  detail: string;
}

export interface DashboardAssessment {
  assessment: CoachAssessment;
  engineInput: EngineInput;
  notes: DataRequirement[];
}

/**
 * Why the last sync run ended without pushing (v8.1): the session could not
 * be renewed, the account cannot write, or something failed on the device.
 */
/** v10: `server` — the server answered with an error (never shown as offline). */
export type SyncProblem = 'session' | 'subscription' | 'server' | 'unexpected';

/** A queued change still waiting for the server, without its payload. */
export interface UnsyncedChange {
  entityType: string;
  operation: string;
  status: string;
  retryCount: number;
  lastError: string | null;
}

export interface SyncSummary {
  pending: number;
  inFlight: number;
  failed: number;
  conflicts: number;
  status: SyncUiStatus;
  lastSyncedAt: string | null;
  message: string | null;
  /** Set with `status: 'error'`: the reason shown instead of a generic error. */
  problem?: SyncProblem;
  /** The oldest unsynced changes, for the sync details on Perfil. */
  unsynced?: readonly UnsyncedChange[];
}

/**
 * The wellness consumption outcome behind this dashboard (ADR-P031
 * §Decision 8). `unavailable` is the canonical Error state: it is neither
 * `absent` nor Empty, and the store maps it to `status: 'error'` so no
 * surface can present a plan as respecting declarations it could not read.
 */
export type WellnessReadStatus = 'absent' | 'available' | 'unavailable';

export interface DashboardData {
  assessment: DashboardAssessment | null;
  missing: DataRequirement[];
  sync: SyncSummary;
  wellness: WellnessReadStatus;
}

export interface DashboardState {
  status: DashboardStatus;
  data: DashboardData | null;
  error: string | null;
  refresh: () => Promise<void>;
  syncNow: () => Promise<void>;
  loadSampleData: () => Promise<void>;
}
