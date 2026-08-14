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

export interface SyncSummary {
  pending: number;
  inFlight: number;
  failed: number;
  conflicts: number;
  status: SyncUiStatus;
  lastSyncedAt: string | null;
  message: string | null;
}

export interface DashboardData {
  assessment: DashboardAssessment | null;
  missing: DataRequirement[];
  sync: SyncSummary;
}

export interface DashboardState {
  status: DashboardStatus;
  data: DashboardData | null;
  error: string | null;
  refresh: () => Promise<void>;
  syncNow: () => Promise<void>;
  loadSampleData: () => Promise<void>;
}
