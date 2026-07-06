import { run } from '../../../shared/infrastructure/database';
import { registerApplier } from '../../../shared/infrastructure/sync/appliers';
import { applyServerGoal, markGoalConflict } from './goal.repository';
import { applyServerProfile } from './profile.repository';

/**
 * Pull-side appliers for the entities this feature owns. Registered once
 * by the app composition root (src/app/_layout.tsx).
 */

let registered = false;

export function registerProfileSyncAppliers(): void {
  if (registered) return;
  registered = true;

  registerApplier({
    entityType: 'user_profiles',
    applyServerChange: applyServerProfile,
    markConflict: async (entityId, nowIso) => {
      await run(
        `UPDATE user_profiles SET sync_status = 'conflict', updated_at = ? WHERE id = ?`,
        [nowIso, entityId],
      );
    },
  });

  registerApplier({
    entityType: 'goals',
    applyServerChange: applyServerGoal,
    markConflict: markGoalConflict,
  });
}
