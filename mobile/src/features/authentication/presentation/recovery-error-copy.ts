import type { PasswordRecoveryErrorReason } from '../application/session-manager';

import type { TranslationKey } from '@/shared/localization';

/**
 * Reason → localized banner copy for the password-recovery screens
 * (ADR-P026 Vertical 1).
 *
 * Mirrors the sign-in map: distinct, honest, non-enumerating messages, and
 * never raw server text. Kept beside the screens rather than inside them so
 * both routes show identical copy for the same reason, and so exhaustiveness
 * over `PasswordRecoveryErrorReason` is checked in one place.
 */
export const RECOVERY_ERROR_COPY: Record<
  PasswordRecoveryErrorReason,
  { title: TranslationKey; body: TranslationKey }
> = {
  'mail-unavailable': {
    title: 'auth.error.mailUnavailableTitle',
    body: 'auth.error.mailUnavailableBody',
  },
  'invalid-reset-token': {
    title: 'auth.error.invalidResetTokenTitle',
    body: 'auth.error.invalidResetTokenBody',
  },
  'rate-limited': {
    title: 'auth.error.rateLimitedTitle',
    body: 'auth.error.rateLimitedBody',
  },
  connectivity: {
    title: 'auth.error.connectivityTitle',
    body: 'auth.error.connectivityBody',
  },
  server: { title: 'auth.error.serverTitle', body: 'auth.error.serverBody' },
  unexpected: {
    title: 'auth.error.unexpectedTitle',
    body: 'auth.error.unexpectedBody',
  },
  // Reachable only through the shared reason union, never from a recovery
  // response; mapped so the record stays total.
  'invalid-credentials': {
    title: 'auth.error.unexpectedTitle',
    body: 'auth.error.unexpectedBody',
  },
  'registration-unavailable': {
    title: 'auth.error.unexpectedTitle',
    body: 'auth.error.unexpectedBody',
  },
};
