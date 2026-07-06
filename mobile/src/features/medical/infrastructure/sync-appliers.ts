import { registerApplier } from '../../../shared/infrastructure/sync/appliers';
import {
  applyServerEvaluation,
  applyServerRestriction,
  markEvaluationConflict,
  markRestrictionConflict,
} from './medical.repository';

let registered = false;

export function registerMedicalSyncAppliers(): void {
  if (registered) return;
  registered = true;

  registerApplier({
    entityType: 'medical_evaluations',
    applyServerChange: applyServerEvaluation,
    markConflict: markEvaluationConflict,
  });

  registerApplier({
    entityType: 'medical_restrictions',
    applyServerChange: applyServerRestriction,
    markConflict: markRestrictionConflict,
  });
}
