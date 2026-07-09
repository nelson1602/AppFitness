import { getSession } from '../../authentication';
import type { Goal, GoalInput } from '../domain/goal.types';
import { getActiveGoal, setGoal } from '../infrastructure/goal.repository';

/**
 * Goal use cases (Phase 13 Slice 2). UI/hooks call these — never the
 * repository or SQLite directly (.ai/06_MOBILE.md). Setting a goal is
 * local-first and history-preserving (the repository closes the previous
 * active goal and enqueues sync in one transaction); the sync worker
 * ships it to the server when connectivity allows. Mirrors
 * profile.service so the two edit surfaces share one shape.
 */

function requireUserId(): string {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

export function getMyActiveGoal(): Promise<Goal | null> {
  return getActiveGoal(requireUserId());
}

export function setMyGoal(input: GoalInput): Promise<Goal> {
  return setGoal(requireUserId(), input);
}
