import * as SecureStore from 'expo-secure-store';

import { logError } from '../../../shared/infrastructure/logging';
import type { AuthUser, Session } from '../domain/session.types';

/**
 * Session persistence — SecureStore ONLY (.ai/05_SECURITY.md).
 * Tokens never touch SQLite, AsyncStorage, or plain files.
 *
 * ── One key, one write (ADR-P030 Decision 8 / C-1) ──────────────────────────
 * The session used to live in three independent keys, and rotation wrote only
 * the two token keys. That made a **mixed identity/token triple** reachable two
 * ways: a rotation landing after another account signed in left the new
 * account's `user` beside the old account's tokens, and a crash between the
 * writes persisted the same mismatch. A restore then rebuilt that mixed
 * session, and every user-scoped read (`sync_queue`, `sync_state`,
 * `sync_conflicts`) would faithfully act on the wrong owner.
 *
 * The whole session is now one versioned envelope under a single key, so a
 * write is atomic with respect to the identity it carries: the stored session
 * is always exactly one account's user *and* that same account's tokens, or
 * nothing. There is no partial-write state left to repair — which is why
 * `saveTokens` no longer exists: callers persist a complete `Session`.
 *
 * Reads are **fail-closed**: anything unparseable, of an unknown version, or
 * incomplete is erased and reported as "no session" rather than reconstructed,
 * so a half-written entry can never restore an unverifiable identity.
 *
 * ── Legacy keys are never migrated ──────────────────────────────────────────
 * A *complete* legacy triple is not evidence of a coherent session. The
 * implementation that wrote those keys could persist one account's tokens
 * beside another account's `user`, and the result is indistinguishable from a
 * genuine triple: all three values parse, and nothing in them ties the tokens
 * to the user. Migrating it would launder exactly the mixed identity this
 * design exists to eliminate.
 *
 * So: if there is no valid v1 envelope and **any** legacy key is present, every
 * session key is deleted and the user signs in again. One sign-in is a small
 * price for a session that is provably one account's.
 */

/** Single source of truth. Bump the suffix only alongside a migration below. */
const SESSION_KEY = 'auth.session.v1';
const ENVELOPE_VERSION = 1;

/**
 * Pre-C-1 layout. Read once, migrated to `SESSION_KEY`, then deleted — and
 * deleted by `clearSession` forever after, so no stale token outlives a
 * sign-out.
 */
const LEGACY_KEYS = {
  accessToken: 'auth.accessToken',
  refreshToken: 'auth.refreshToken',
  user: 'auth.user',
} as const;

interface SessionEnvelope {
  v: number;
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/**
 * Validates and **copies** the persisted user.
 *
 * Every field the app relies on is checked, not just the three the earlier
 * version looked at: a stored `role` of `"SUPERADMIN"`, or an `avatarUrl` that
 * is a number, would otherwise flow straight into RBAC checks and rendering.
 * The returned object is a fresh copy, so the parsed JSON cannot be aliased.
 */
function toAuthUser(value: unknown): AuthUser | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Partial<AuthUser>;

  if (!isNonEmptyString(candidate.id)) return null;
  if (!isNonEmptyString(candidate.email)) return null;
  if (!isNonEmptyString(candidate.username)) return null;
  if (candidate.role !== 'USER' && candidate.role !== 'ADMIN') return null;
  if (!isStringOrNull(candidate.phone)) return null;
  if (!isStringOrNull(candidate.avatarUrl)) return null;
  // Optional on the wire: absent reads as "not verified" (session.types.ts).
  if (candidate.emailVerifiedAt !== undefined && !isStringOrNull(candidate.emailVerifiedAt)) {
    return null;
  }

  const user: AuthUser = {
    id: candidate.id,
    email: candidate.email,
    username: candidate.username,
    role: candidate.role,
    phone: candidate.phone,
    avatarUrl: candidate.avatarUrl,
  };
  if (candidate.emailVerifiedAt !== undefined) user.emailVerifiedAt = candidate.emailVerifiedAt;
  return user;
}

/** Structural check — an envelope is trusted only if it is complete. */
function toSession(value: unknown): Session | null {
  if (typeof value !== 'object' || value === null) return null;
  const envelope = value as Partial<SessionEnvelope>;
  if (envelope.v !== ENVELOPE_VERSION) return null;
  if (!isNonEmptyString(envelope.accessToken)) return null;
  if (!isNonEmptyString(envelope.refreshToken)) return null;

  const user = toAuthUser(envelope.user);
  if (!user) return null;

  return {
    accessToken: envelope.accessToken,
    refreshToken: envelope.refreshToken,
    user,
  };
}

export async function saveSession(session: Session): Promise<void> {
  const envelope: SessionEnvelope = {
    v: ENVELOPE_VERSION,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    user: session.user,
  };
  // One key: the identity and the tokens it belongs to are written together,
  // or not at all.
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(envelope));
}

/**
 * Reads the persisted session, or `null`.
 *
 * A valid v1 envelope is authoritative; any legacy remnants beside it are
 * purged best-effort so old tokens are not retained. Everything else — corrupt
 * JSON, an unknown version, an incomplete envelope, or **any** legacy key
 * without a valid envelope — is erased and reported as no session.
 */
export async function loadSession(): Promise<Session | null> {
  let raw: string | null;
  try {
    raw = await SecureStore.getItemAsync(SESSION_KEY);
  } catch (error) {
    // Secure storage unavailable: report no session, never a partial one.
    logError('auth.loadSession.read', error);
    return null;
  }

  if (raw !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      logError('auth.loadSession.parse', error);
      await clearSession();
      return null;
    }
    const session = toSession(parsed);
    if (session) {
      // Authoritative. Drop any legacy leftovers so no old token lingers; a
      // failure here must not deny a valid session.
      await purgeLegacyKeys();
      return session;
    }
    // Present but unverifiable. Fail closed: erase and require sign-in.
    logError('auth.loadSession.invalid', new Error('stored session is not a valid v1 envelope'));
    await clearSession();
    return null;
  }

  return rejectLegacySession();
}

/**
 * No envelope. If any pre-C-1 key survives, erase everything.
 *
 * A *complete* legacy triple is deliberately **not** migrated. The code that
 * wrote those keys rotated tokens independently of the user record, so a
 * triple where the tokens belong to A and the user to B parses exactly like a
 * coherent one — nothing in the stored data ties them together. Trusting it
 * would launder the mixed identity C-1 exists to eliminate, and the only
 * honest resolution is a fresh sign-in.
 */
async function rejectLegacySession(): Promise<Session | null> {
  let legacy: [string | null, string | null, string | null];
  try {
    legacy = await Promise.all([
      SecureStore.getItemAsync(LEGACY_KEYS.accessToken),
      SecureStore.getItemAsync(LEGACY_KEYS.refreshToken),
      SecureStore.getItemAsync(LEGACY_KEYS.user),
    ]);
  } catch (error) {
    logError('auth.loadSession.legacyRead', error);
    return null;
  }

  const present = legacy.filter((value) => value !== null).length;
  if (present === 0) return null;

  // Complete or partial makes no difference: neither is verifiable.
  logError(
    'auth.loadSession.legacyRejected',
    new Error(`legacy session discarded (${present}/3 keys); re-authentication required`),
  );
  await clearSession();
  return null;
}

/** Best-effort removal of pre-C-1 keys beside a valid envelope. */
async function purgeLegacyKeys(): Promise<void> {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(LEGACY_KEYS.accessToken),
      SecureStore.deleteItemAsync(LEGACY_KEYS.refreshToken),
      SecureStore.deleteItemAsync(LEGACY_KEYS.user),
    ]);
  } catch (error) {
    // The envelope is valid and returned regardless: a stale remnant is worth
    // less than denying a good session.
    logError('auth.loadSession.legacyPurge', error);
  }
}

/** Removes the envelope AND any legacy remnant, so no token survives sign-out. */
export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(SESSION_KEY),
    SecureStore.deleteItemAsync(LEGACY_KEYS.accessToken),
    SecureStore.deleteItemAsync(LEGACY_KEYS.refreshToken),
    SecureStore.deleteItemAsync(LEGACY_KEYS.user),
  ]);
}
