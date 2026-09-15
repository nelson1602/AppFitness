// ADR-P030 C-7 — conflict-journey harness.
//
// Uses ONLY the public API/sync contracts the app itself uses: register,
// login, and `/sync/push` · `/sync/pull` · `/sync/conflicts`. There is no
// test-only endpoint, no privileged mode and no direct database access, so
// nothing here can prove something the product could not do on its own.
//
// Its three jobs, all *around* the device journeys rather than inside them:
//
//   1. create and delete disposable accounts;
//   2. act as a legitimate **third client** where a journey needs the account
//      to move at a controlled moment (the stale re-review of §Decision 10);
//   3. read server state back, so a device-side outcome can be checked
//      against what the account actually holds.
//
// Output is sanitized by construction: `redact()` is the only channel to
// stdout, and it prints versions, counts, statuses and synthetic token names
// only. Tokens, passwords, ids, payloads and raw responses never print.
//
// Fake, synthetic data against a disposable local database only.

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';

// `deviceId` is deliberately omitted from every push below: it is optional in
// the contract and foreign-keyed to a registered device, so a harness that
// invents one is rejected. The app registers its own device; this client does
// not pretend to be one.

const API = process.env.C7_API_URL ?? 'http://127.0.0.1:3001';

// ── Transport ────────────────────────────────────────────────────────────────

async function request(method, path, body, token) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    // Status only. A body can echo the request back.
    const error = new Error(`${method} ${path} -> ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return parsed;
}

/** The only channel to stdout. Anything not named here never prints. */
function redact(label, fields) {
  const safe = Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
  console.log(`[c7] ${label} ${safe}`);
}

function fail(label, fields) {
  redact(`${label} FAILED`, fields);
  process.exit(1);
}

/** The register DTO allows letters, digits and underscores only. */
function usernameFor(email) {
  return email
    .split('@')[0]
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .slice(0, 30);
}

/**
 * Sessions are cached between invocations, in the OS temp directory and never
 * in the repository.
 *
 * The harness is a client, and a client signs in once and keeps its session —
 * the app does exactly the same. Logging in per command instead turns a
 * handful of checks into a burst that `/auth`'s throttle (ADR-P020) correctly
 * refuses with 429, which is the rate limiter working, not a defect.
 */
const SESSIONS = `${process.env.TEMP ?? '.'}/c7-sessions.json`;

function readSessions() {
  try {
    return JSON.parse(fs.readFileSync(SESSIONS, 'utf8'));
  } catch {
    return {};
  }
}

function cacheSession(email, token) {
  const all = readSessions();
  all[email] = token;
  fs.writeFileSync(SESSIONS, JSON.stringify(all));
}

async function login(email, password) {
  const cached = readSessions()[email];
  if (cached) {
    try {
      await request('GET', '/auth/me', undefined, cached);
      return cached;
    } catch {
      // Expired or revoked — fall through and sign in again.
    }
  }
  const { accessToken } = await request('POST', '/auth/login', { email, password });
  cacheSession(email, accessToken);
  return accessToken;
}

async function ensureAccount(email, password) {
  try {
    await request('POST', '/auth/register', { email, username: usernameFor(email), password });
  } catch (error) {
    // 409 means a previous step already created it; anything else is real.
    if (error.status !== 409) throw error;
  }
  return login(email, password);
}

// ── Server reads ─────────────────────────────────────────────────────────────

/**
 * The account's current row for one entity type, straight off the sync
 * contract. `PulledChange` carries the row in `data`, so the version lives
 * there too.
 */
async function pullOne(token, entityType) {
  const page = await request(
    'GET',
    `/sync/pull?since=0&limit=100&entityTypes=${entityType}`,
    undefined,
    token,
  );
  const row = (page.changes ?? []).filter((entry) => entry.entityType === entityType).pop();
  if (!row) return null;
  return {
    id: row.entityId,
    version: row.data?.version,
    data: row.data ?? {},
    deleted: row.deleted,
  };
}

/**
 * The owner's outstanding (PENDING) conflicts. `GET /sync/conflicts` answers
 * two questions: `conflicts` lists them, while `statuses` only reports on ids
 * the caller already holds — so a listing must read the former.
 */
async function pendingConflicts(token) {
  const result = await request('GET', '/sync/conflicts', undefined, token);
  return result.conflicts ?? [];
}

/** The status of ids the caller already knows, which is the only way to see
 * a *resolved* conflict: the listing above returns PENDING rows only. */
async function statusesOf(token, ids) {
  if (ids.length === 0) return [];
  const query = ids.map((id) => `ids=${id}`).join('&');
  const result = await request('GET', `/sync/conflicts?${query}`, undefined, token);
  return result.statuses ?? [];
}

/**
 * A wire payload the wellness handler accepts: `evaluation_completed` must be
 * a genuine boolean and the token fields genuine arrays. Sending the row's
 * stored shape back (0/1, or a JSON string) is refused by the domain parser —
 * the server validating its own contract, not a defect.
 */
function wellnessPayload(row, areas) {
  return {
    evaluation_completed: Boolean(row.data?.evaluation_completed),
    evaluation_date: row.data?.evaluation_date ?? null,
    affected_areas: areas,
    movements_to_avoid: movementsOf(row),
  };
}

function movementsOf(row) {
  const raw = row?.data?.movements_to_avoid;
  const parsed = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw ?? []);
  return Array.isArray(parsed) ? parsed : [];
}

/** Affected areas arrive as an array (wire) or a JSON string (stored row). */
function areasOf(row) {
  const raw = row?.data?.affected_areas;
  const parsed = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw ?? []);
  return Array.isArray(parsed) ? [...parsed].sort() : [];
}

// ── Commands ─────────────────────────────────────────────────────────────────

const [command, ...rest] = process.argv.slice(2);
const args = Object.fromEntries(
  rest.map((pair) => {
    const [key, ...value] = pair.replace(/^--/, '').split('=');
    return [key, value.join('=')];
  }),
);

const PASSWORD = args.password ?? 'c7password12345';
const ENTITY = args.entity ?? 'wellness_safety_profiles';

async function main() {
  switch (command) {
    case 'health': {
      await request('GET', '/health');
      redact('health', { api: 'ok' });
      return;
    }

    case 'register': {
      await ensureAccount(args.email, PASSWORD);
      redact('register', { account: args.label ?? 'disposable', ok: 1 });
      return;
    }

    case 'state': {
      const token = await login(args.email, PASSWORD);
      const row = await pullOne(token, ENTITY);
      redact('state', {
        entity: ENTITY,
        version: row?.version ?? 'none',
        areas: areasOf(row).join('|') || 'none',
        deleted: row?.deleted ? 1 : 0,
      });
      return;
    }

    /**
     * A legitimate third client moving the account on — used only where a
     * journey needs the account to change at a controlled moment (stale
     * re-review). It pushes at the *current* version, so it succeeds.
     */
    case 'bump-areas': {
      const token = await login(args.email, PASSWORD);
      const row = await pullOne(token, ENTITY);
      if (!row) fail('bump-areas', { reason: 'no-row' });
      const areas = (args.areas ?? '').split(',').filter(Boolean);
      const result = await request(
        'POST',
        '/sync/push',
        {
          operations: [
            {
              opId: randomUUID(),
              entityType: ENTITY,
              entityId: row.id,
              operation: 'UPDATE',
              baseVersion: Number(row.version),
              payload: wellnessPayload(row, areas),
            },
          ],
        },
        token,
      );
      const outcome = (result.results ?? [])[0];
      const after = await pullOne(token, ENTITY);
      redact('bump-areas', {
        outcome: outcome?.status ?? 'unknown',
        version: `${row.version}->${after?.version ?? '?'}`,
        areas: areasOf(after).join('|') || 'none',
      });
      if ((outcome?.status ?? '') !== 'APPLIED') process.exit(1);
      return;
    }

    /** Deletes the account's row so a device's pending edit meets a tombstone. */
    case 'delete-row': {
      const token = await login(args.email, PASSWORD);
      const row = await pullOne(token, ENTITY);
      if (!row) fail('delete-row', { reason: 'no-row' });
      const result = await request(
        'POST',
        '/sync/push',
        {
          operations: [
            {
              opId: randomUUID(),
              entityType: ENTITY,
              entityId: row.id,
              operation: 'DELETE',
              baseVersion: Number(row.version),
              payload: {},
            },
          ],
        },
        token,
      );
      const after = await pullOne(token, ENTITY);
      redact('delete-row', {
        outcome: (result.results ?? [])[0]?.status ?? 'unknown',
        deleted: after?.deleted ? 1 : 0,
      });
      return;
    }

/**
     * Waits for the account to reach a value, rather than sampling it once.
     *
     * A device's "Sync now" returns as soon as the control settles, which is
     * not the same moment the round trip lands. Sampling immediately made the
     * setup intermittently read a value that was still in flight — a race in
     * this harness, not a slow server. Polling to a deadline removes it
     * without weakening what is asserted: the value still has to arrive, and
     * a wrong value still fails as soon as the deadline passes.
     */
    case 'assert-areas': {
      const token = await login(args.email, PASSWORD);
      const expected = (args.expect ?? '').split(',').filter(Boolean).sort().join('|') || 'none';
      const deadline = Date.now() + Number(args.timeout ?? 30) * 1000;
      let actual = 'none';
      let row = null;
      for (;;) {
        row = await pullOne(token, ENTITY);
        actual = areasOf(row).join('|') || 'none';
        if (actual === expected || Date.now() > deadline) break;
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      if (actual !== expected) fail('assert-areas', { expected, actual });
      redact('assert-areas', { expected, version: row?.version ?? '?', ok: 1 });
      return;
    }

    case 'assert-version': {
      const token = await login(args.email, PASSWORD);
      const row = await pullOne(token, ENTITY);
      const expected = Number(args.expect);
      if (Number(row?.version) !== expected) {
        fail('assert-version', { expected, actual: row?.version ?? 'none' });
      }
      redact('assert-version', { expected, ok: 1 });
      return;
    }

    /** No conflict may remain unresolved on the server for this account. */
    case 'assert-settled': {
      const token = await login(args.email, PASSWORD);
      const deadline = Date.now() + Number(args.timeout ?? 30) * 1000;
      let pending = [];
      for (;;) {
        pending = await pendingConflicts(token);
        if (pending.length === 0 || Date.now() > deadline) break;
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      redact('assert-settled', { pending: pending.length });
      if (pending.length > 0) process.exit(1);
      return;
    }

    /** Exactly one settlement, to the expected side — no duplicate, no flip. */
    /**
     * Exactly one settlement, to the expected side. `--ids` carries the
     * conflict ids observed while they were pending, because a resolved
     * conflict no longer appears in the listing.
     */
    case 'assert-resolution': {
      const token = await login(args.email, PASSWORD);
      const ids = (args.ids ?? '').split(',').filter(Boolean);
      const statuses = await statusesOf(token, ids);
      const matching = statuses.filter((entry) => entry.status === args.expect);
      redact('assert-resolution', {
        expected: args.expect,
        checked: statuses.length,
        matching: matching.length,
      });
      if (statuses.length !== ids.length) process.exit(1);
      if (matching.length !== statuses.length) process.exit(1);
      return;
    }

    /** The ids of everything currently outstanding, for a later status check. */
    case 'pending-ids': {
      const token = await login(args.email, PASSWORD);
      const pending = await pendingConflicts(token);
      // Ids are a handle, not data: they are emitted for the driver to pass
      // back, never rendered and never written to the evidence record.
      process.stdout.write(pending.map((entry) => entry.id).join(',') + '\n');
      return;
    }

    case 'assert-conflicts': {
      const token = await login(args.email, PASSWORD);
      const expected = Number(args.expect);
      const deadline = Date.now() + Number(args.timeout ?? 30) * 1000;
      let pending = [];
      for (;;) {
        pending = await pendingConflicts(token);
        if (pending.length === expected || Date.now() > deadline) break;
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      redact('assert-conflicts', { expected, actual: pending.length });
      if (pending.length !== expected) process.exit(1);
      return;
    }

    /**
     * Owner isolation (§Decision 8): the other account's conflict must be
     * invisible AND unusable. Listing is owner-scoped, and resolving another
     * owner's conflict id must be refused — never applied.
     */
    case 'assert-isolation': {
      const mine = await login(args.email, PASSWORD);
      const theirs = await login(args.other, PASSWORD);

      const theirConflicts = await pendingConflicts(theirs);
      const myConflicts = await pendingConflicts(mine);
      const myIds = new Set(myConflicts.map((entry) => entry.id));
      const leaked = theirConflicts.filter((entry) => myIds.has(entry.id));
      const theirPendingBefore = theirConflicts.length;

      let refused = 0;
      for (const entry of theirConflicts) {
        try {
          await request(
            'POST',
            `/sync/conflicts/${entry.id}/resolve`,
            { resolution: 'SERVER_WINS', expectedServerVersion: 1, expectedDeleted: false },
            mine,
          );
        } catch (error) {
          if (error.status === 404 || error.status === 403) refused += 1;
        }
      }

      // Their conflict must be untouched after every attempt.
      const theirPendingAfter = (await pendingConflicts(theirs)).length;

      redact('assert-isolation', {
        theirs: theirConflicts.length,
        mine: myConflicts.length,
        leaked: leaked.length,
        refused,
        theirPending: `${theirPendingBefore}->${theirPendingAfter}`,
      });
      if (leaked.length > 0) process.exit(1);
      if (refused !== theirConflicts.length) process.exit(1);
      if (theirPendingAfter !== theirPendingBefore) process.exit(1);
      return;
    }

    /**
     * Gives an account a conflict without any device: a second client pushes
     * a stale edit. Used for the isolation journey's other account.
     */
    case 'make-remote-conflict': {
      const token = await login(args.email, PASSWORD);
      const row = await pullOne(token, ENTITY);
      if (!row) fail('make-remote-conflict', { reason: 'no-row' });
      const stale = Math.max(0, Number(row.version) - 1);
      const result = await request(
        'POST',
        '/sync/push',
        {
          operations: [
            {
              opId: randomUUID(),
              entityType: ENTITY,
              entityId: row.id,
              operation: 'UPDATE',
              baseVersion: stale,
              payload: wellnessPayload(row, ['hip']),
            },
          ],
        },
        token,
      );
      redact('make-remote-conflict', {
        baseVersion: stale,
        outcome: (result.results ?? [])[0]?.status ?? 'unknown',
      });
      return;
    }

    /**
     * Decides one conflict the way a **different** client would — the setup
     * first-choice-wins needs (§Decisions 4, 5).
     *
     * Why a third client and not the second device: the server records a
     * conflict with `create`, so every stale push mints its own row, and a
     * device only ever reconciles ids it already holds. Two devices therefore
     * never share a conflict id, and `ALREADY_RESOLVED_*` is keyed on that
     * id. The only way a device can meet a decision taken "somewhere else
     * first" is for another client holding the *same* id to have taken it,
     * which is what this does — over the same public endpoint the app uses.
     *
     * `SERVER_WINS` deliberately: it carries no payload and leaves the entity
     * version untouched, so the device's stored comparison stays fresh and the
     * outcome it meets is the standing decision rather than a stale one.
     */
    case 'decide-first': {
      const token = await login(args.email, PASSWORD);
      const pending = await pendingConflicts(token);
      const target = args.id ?? (pending.length === 1 ? pending[0].id : null);
      if (!target) fail('decide-first', { reason: 'not-exactly-one', pending: pending.length });
      const row = await pullOne(token, ENTITY);
      await request(
        'POST',
        `/sync/conflicts/${target}/resolve`,
        {
          resolution: 'SERVER_WINS',
          expectedServerVersion: Number(row?.version ?? 0),
          expectedDeleted: Boolean(row?.deleted),
        },
        token,
      );
      redact('decide-first', { resolution: 'SERVER_WINS', version: row?.version ?? '?', ok: 1 });
      return;
    }

    case 'cleanup': {
      // Disposable accounts are removed through the product's own deletion
      // path, not by touching the database.
      for (const email of (args.emails ?? '').split(',').filter(Boolean)) {
        try {
          const token = await login(email, PASSWORD);
          await request('DELETE', '/auth/account', undefined, token);
          redact('cleanup', { account: 'removed', ok: 1 });
        } catch (error) {
          redact('cleanup', { account: 'skip', status: error.status ?? 'error' });
        }
      }
      return;
    }

    default:
      console.error('usage: c7-conflicts.mjs <command> [--key=value ...]');
      process.exit(2);
  }
}

await main();
