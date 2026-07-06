import { getSession } from '../../authentication';
import type {
  Evaluation,
  EvaluationInput,
  Restriction,
  RestrictionInput,
} from '../domain/medical.types';
import {
  addRestriction,
  createEvaluation,
  deactivateRestriction,
  deleteEvaluation,
  listActiveRestrictions,
  listEvaluations,
} from '../infrastructure/medical.repository';

/** Medical use cases — UI/hooks call these, never SQLite or crypto directly. */

function requireUserId(): string {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

export function recordEvaluation(input: EvaluationInput): Promise<Evaluation> {
  return createEvaluation(requireUserId(), input);
}

export function getMyEvaluations(): Promise<Evaluation[]> {
  return listEvaluations(requireUserId());
}

export function removeEvaluation(id: string): Promise<void> {
  return deleteEvaluation(requireUserId(), id);
}

export function recordRestriction(input: RestrictionInput): Promise<Restriction> {
  return addRestriction(requireUserId(), input);
}

export function getMyActiveRestrictions(): Promise<Restriction[]> {
  return listActiveRestrictions(requireUserId());
}

export function endRestriction(id: string): Promise<void> {
  return deactivateRestriction(requireUserId(), id);
}
