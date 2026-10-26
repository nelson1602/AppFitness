import { router, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { isRouteAllowedFor, requiredAccessStep } from '../application/access-gate';
import { useSession } from './use-session';

/**
 * App-wide enforcement of the access steps (ADR-P041 D2), mounted once in the
 * root layout.
 *
 * Sign-in, sign-up and the launch redirect already send an unverified account
 * straight to `/verify-pending`; this catches every other way in — a deep
 * link, a restored back stack, a Web URL typed by hand — so no data screen
 * stays open for an account that still owes a step. The server refuses the
 * same account's data calls with `403 EMAIL_NOT_VERIFIED` regardless.
 */
export function AccessGateRedirect() {
  const { status, session } = useSession();
  const segments = useSegments();
  const firstSegment = segments[0];

  useEffect(() => {
    if (status !== 'authenticated' || !session) return;
    const step = requiredAccessStep(session.user);
    if (!isRouteAllowedFor(step, firstSegment)) router.replace('/verify-pending');
  }, [status, session, firstSegment]);

  return null;
}
