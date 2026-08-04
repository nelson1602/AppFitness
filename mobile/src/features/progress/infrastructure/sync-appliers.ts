import { registerApplier } from '@/shared/infrastructure/sync';

import {
  applyServerBodyMeasurement,
  applyServerBodyWeight,
  applyServerProgressSnapshot,
  markBodyMeasurementConflict,
  markBodyWeightConflict,
  markProgressSnapshotConflict,
} from './progress.repository';

/**
 * Pull-side appliers for the Progress Monitoring entities: `body_weights` and
 * `body_measurements` (Slice 3b) plus `progress_snapshots` (Slice 4c — the
 * on-device deterministic rollup, computed locally and synced; the server is
 * authoritative on pull after reconcile). Registered once by the app
 * composition root.
 */

let registered = false;

export function registerProgressSyncAppliers(): void {
  if (registered) return;
  registered = true;

  registerApplier({
    entityType: 'body_weights',
    applyServerChange: applyServerBodyWeight,
    markConflict: markBodyWeightConflict,
  });

  registerApplier({
    entityType: 'body_measurements',
    applyServerChange: applyServerBodyMeasurement,
    markConflict: markBodyMeasurementConflict,
  });

  registerApplier({
    entityType: 'progress_snapshots',
    applyServerChange: applyServerProgressSnapshot,
    markConflict: markProgressSnapshotConflict,
  });
}
