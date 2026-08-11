/**
 * Progress Monitoring feature public surface (ADR-P016 Phase 17 Slice 3b/4c).
 * Local-first body-metric runtime + deterministic weekly snapshot recompute; no
 * UI yet.
 */
export { registerProgressSyncAppliers } from './infrastructure/sync-appliers';
export { ProgressScreen } from './presentation/ProgressScreen';
export { ProgressSummaryCard } from './presentation/ProgressSummaryCard';
export {
  useProgressStore,
  type ProgressState,
  type ProgressStatus,
} from './application/progress.store';
export { recomputeSnapshots, gatherProgressInputs } from './application/progress.gathering';
export {
  getMyLatestPhysicalAssessment,
  recordMyBodyMeasurement,
  recordMyBodyWeight,
  type PhysicalAssessmentMetrics,
} from './application/progress.service';
export type {
  BodyWeight,
  BodyWeightInput,
  BodyMeasurement,
  BodyMeasurementInput,
  ProgressSnapshot,
} from './domain/progress';
