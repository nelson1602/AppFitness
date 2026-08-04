/**
 * Progress Monitoring feature public surface (ADR-P016 Phase 17 Slice 3b).
 * Local-first body-metric runtime; no UI yet. `progress_snapshots` is deferred
 * to Slice 4 (D2).
 */
export { registerProgressSyncAppliers } from './infrastructure/sync-appliers';
export {
  useProgressStore,
  type ProgressState,
  type ProgressStatus,
} from './application/progress.store';
export type {
  BodyWeight,
  BodyWeightInput,
  BodyMeasurement,
  BodyMeasurementInput,
} from './domain/progress';
