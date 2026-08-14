/**
 * Stable, non-sensitive error for local-database operations attempted on Web,
 * where the SQLite capability is dormant (ADR-P019).
 *
 * Platform-neutral (no `expo-sqlite` import) so it can be imported on both
 * native and Web — e.g. by cross-platform stores/screens in Slice 2B3B that
 * need to detect the dormant Web database and render an explicit
 * "unavailable on Web" state. The message and code are stable and carry no
 * user data, credentials, or other sensitive context.
 */

export const DATABASE_UNSUPPORTED_ON_WEB_CODE = 'DATABASE_UNSUPPORTED_ON_WEB';
export const DATABASE_UNSUPPORTED_ON_WEB_MESSAGE = 'The local database is unavailable on Web';

export class DatabaseUnsupportedOnWebError extends Error {
  readonly code = DATABASE_UNSUPPORTED_ON_WEB_CODE;

  constructor(message: string = DATABASE_UNSUPPORTED_ON_WEB_MESSAGE) {
    super(message);
    this.name = 'DatabaseUnsupportedOnWebError';
  }
}

/** Type guard so cross-platform callers can identify the dormant-DB failure. */
export function isDatabaseUnsupportedOnWebError(
  error: unknown,
): error is DatabaseUnsupportedOnWebError {
  return error instanceof DatabaseUnsupportedOnWebError;
}
