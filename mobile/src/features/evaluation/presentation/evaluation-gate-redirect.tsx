import { router, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useSession } from '@/features/authentication';
import { requiredAccessStep } from '@/features/authentication/application/access-gate';

import { useEvaluationGate } from '../application/evaluation-gate.store';

/**
 * Routes an account may open while it still owes the first-run evaluation.
 * The verification routes stay reachable; ADR-P041's own gate handles them.
 */
const EVALUATION_ROUTES: ReadonlySet<string> = new Set([
  'evaluation',
  'plan-building',
  'sign-in',
  'verify-email',
  'verify-pending',
]);

export function isRouteAllowedWhileEvaluationOwed(firstSegment: string | undefined): boolean {
  return firstSegment !== undefined && EVALUATION_ROUTES.has(firstSegment);
}

/**
 * The first-run step after email verification (v8 Block 2), mounted once in
 * the root layout next to `AccessGateRedirect`. A verified account without
 * its evaluation is sent to the Evaluación física from wherever it lands —
 * the launch redirect, a deep link or a restored back stack.
 */
export function EvaluationGateRedirect() {
  const { status, session } = useSession();
  const segments = useSegments();
  const firstSegment = segments[0];
  const gate = useEvaluationGate((s) => s.status);
  const check = useEvaluationGate((s) => s.check);
  const verified =
    status === 'authenticated' && session && requiredAccessStep(session.user) === 'app';

  useEffect(() => {
    if (verified && gate === 'unknown') void check();
  }, [verified, gate, check]);

  useEffect(() => {
    if (!verified || gate !== 'owed') return;
    if (!isRouteAllowedWhileEvaluationOwed(firstSegment)) router.replace('/evaluation');
  }, [verified, gate, firstSegment]);

  return null;
}
