import { registerApplier } from '@/shared/infrastructure/sync';

import {
  applyServerBodyMeasurement,
  applyServerBodyWeight,
  markBodyMeasurementConflict,
  markBodyWeightConflict,
} from './progress.repository';

/**
 * Pull-side appliers for the Progress Monitoring entities (ADR-P016 Slice 3b):
 * `body_weights` and `body_measurements`. Registered once by the app
 * composition root. `progress_snapshots` is NOT applied here — it is a
 * deterministic on-device rollup produced by the Slice 4 engine (D2).
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
}
