// ADR-P041 — marks a disposable E2E account's email as verified.
//
// Since ADR-P041 an unverified account can reach only the verification flow,
// and the seeded-local-API harness sends no real email (no MAIL_PROVIDER), so
// a test account cannot open a link. This is the one step the harness takes
// outside the public API: a single UPDATE on the LOCAL disposable database,
// equivalent to the user opening the link.
//
// Safety: refuses any DATABASE_URL whose host is not localhost / 127.0.0.1,
// so it can never touch Railway or any shared database. Prints no secrets.
//
// CLI:  DATABASE_URL=postgresql://…@localhost:5432/… node e2e/verify-email.mjs <email>
// API:  import { markEmailVerified } from './verify-email.mjs';

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function markEmailVerified(email, databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required (the local disposable database)');
  const host = new URL(databaseUrl).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`refusing to verify against a non-local database host (${host})`);
  }
  if (typeof email !== 'string' || !email.includes('@')) throw new Error('an email is required');

  const result = spawnSync(
    'psql',
    [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-v', `email=${email}`, '-tA'],
    {
      encoding: 'utf8',
      input:
        "UPDATE users SET email_verified_at = now() WHERE lower(email) = lower(:'email') RETURNING 1;\n",
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`psql failed: ${result.stderr.trim()}`);
  if (!result.stdout.includes('1')) throw new Error('no account matched that email');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    markEmailVerified(process.argv[2]);
    console.log('verify-email: account marked verified');
  } catch (error) {
    console.error(`verify-email: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
