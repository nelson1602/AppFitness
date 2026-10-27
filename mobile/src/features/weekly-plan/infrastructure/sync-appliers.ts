import { registerApplier } from '@/shared/infrastructure/sync';

import {
  applyServerWeeklyPlan,
  markWeeklyPlanConflict,
  WEEKLY_PLAN_ENTITY,
} from './weekly-plan.repository';

let registered = false;

/** Pull-side applier for `weekly_plans` (ADR-P042). Registered once by the app root. */
export function registerWeeklyPlanSyncAppliers(): void {
  if (registered) return;
  registered = true;

  registerApplier({
    entityType: WEEKLY_PLAN_ENTITY,
    applyServerChange: ({ data, deleted, tx }) => applyServerWeeklyPlan(data, deleted, tx),
    markConflict: markWeeklyPlanConflict,
  });
}
