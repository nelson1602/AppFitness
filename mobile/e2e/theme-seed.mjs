// Theme-verification seeder — gate 6, `.ai/23_THEME_SURFACE_VERIFICATION.md`.
//
// Populates the account states the first light/dark pass could not reach,
// so the theme-sensitive components that only render WITH data can be
// captured: populated rows, `TrendBars` (weight / muscle mass / volume),
// `WeeklySnapshotSummary`, and the complete profile baseline that
// `GeneratedWorkoutPlan` needs.
//
// Like `seed.mjs` and `c7-conflicts.mjs` it uses ONLY the public API/sync
// contracts the app itself uses — `POST /auth/register`, `POST /auth/login`,
// `PUT /users/me/profile`, `POST /sync/push`. There is no test-only endpoint,
// no privileged mode and no direct database access, so nothing it produces is
// a state the product could not reach on its own. The device then PULLS the
// rows through its own appliers by tapping the shipped "Sync now" control.
//
// Fake, synthetic, non-sensitive values against a disposable LOCAL database
// only. Output is counts and statuses; tokens, passwords and ids never print.
//
// Deterministic in what it writes: every value below is fixed and every date is
// derived from `--anchor` (default: today, UTC) in whole 7-day steps, so a FRESH
// account seeded with the same anchor receives the same dataset apart from the
// entity UUIDs, which are random per run. The anchor used is printed so a
// capture can be tied to the data it shows.
//
// Single-use, and NOT idempotent. Every operation it pushes is a `CREATE`, so a
// second run against an account that already holds this data would add a second
// copy of the weights, measurements, snapshots, routine and logs, and would
// collide on the singleton `wellness_safety_profiles` entity — a different
// dataset, not the same one. It therefore FAILS FAST when registration reports
// the account already exists: point `THEME_EMAIL` at a fresh disposable account,
// or reset the disposable local database, and seed it exactly once.
//
// Env / flags:
//   THEME_API_URL   (default http://127.0.0.1:3001)
//   THEME_EMAIL     (default theme@appfitness.local)
//   THEME_PASSWORD  (default password12345)
//   --anchor=YYYY-MM-DD

import { randomUUID } from 'node:crypto';

const API = process.env.THEME_API_URL ?? 'http://127.0.0.1:3001';
const EMAIL = process.env.THEME_EMAIL ?? 'theme@appfitness.local';
const PASSWORD = process.env.THEME_PASSWORD ?? 'password12345';

const args = Object.fromEntries(
  process.argv.slice(2).map((pair) => {
    const [key, ...value] = pair.replace(/^--/, '').split('=');
    return [key, value.join('=')];
  }),
);

const ANCHOR = args.anchor ?? new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(ANCHOR)) {
  throw new Error('--anchor must be YYYY-MM-DD');
}

/** The only channel to stdout: counts, statuses and synthetic labels only. */
function say(label, fields) {
  const safe = Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
  console.log(`[theme-seed] ${label} ${safe}`);
}

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
    // Status only — a body can echo the request back.
    const error = new Error(`${method} ${path} -> ${response.status}`);
    error.status = response.status;
    error.body = parsed;
    throw error;
  }
  return parsed;
}

/** `YYYY-MM-DD`, `days` before the anchor. */
function dayBefore(days) {
  const d = new Date(`${ANCHOR}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** The Monday-anchored week start `weeks` before the anchor's own week. */
function weekStart(weeks) {
  const d = new Date(`${ANCHOR}T00:00:00.000Z`);
  const isoDow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - isoDow - weeks * 7);
  return d.toISOString().slice(0, 10);
}

function isoAt(days, hour) {
  return `${dayBefore(days)}T${String(hour).padStart(2, '0')}:00:00.000Z`;
}

async function waitForHealth(attempts = 30) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      await request('GET', '/health');
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw new Error(`API at ${API} did not become healthy`);
}

/** The register DTO allows letters, digits and underscores only. */
function usernameFor(email) {
  return email
    .split('@')[0]
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .slice(0, 30);
}

/**
 * Registers the disposable account this run seeds. A 409 means the account is
 * already there, which makes the run non-equivalent to a first one, so it stops
 * here rather than layering a second dataset on top of an unknown first.
 */
async function createAccount() {
  try {
    await request('POST', '/auth/register', {
      email: EMAIL,
      username: usernameFor(EMAIL),
      password: PASSWORD,
    });
    say('register', { account: 'created' });
  } catch (error) {
    if (error.status === 409) {
      // No address, id or token in the message — only what to do about it.
      throw new Error(
        'the seed account already exists; this seeder is single-use. Set THEME_EMAIL to a fresh ' +
          'disposable address, or reset the disposable local database, then seed once.',
      );
    }
    throw error;
  }
  const { accessToken, user } = await request('POST', '/auth/login', {
    email: EMAIL,
    password: PASSWORD,
  });
  // `wellness_safety_profiles` is a singleton whose entity id IS the owner id
  // (the handler fails closed on any other value), so the seeder needs it.
  return { token: accessToken, userId: user.id };
}

/** One `/sync/push` batch; every op must be APPLIED or the seed is wrong. */
async function push(token, operations, label) {
  const result = await request('POST', '/sync/push', { operations }, token);
  const results = result.results ?? [];
  const applied = results.filter((r) => r.status === 'APPLIED').length;
  say(label, { ops: operations.length, applied });
  if (applied !== operations.length) {
    const failures = results
      .filter((r) => r.status !== 'APPLIED')
      .map((r) => `${r.status}:${r.errorCode ?? r.code ?? '?'}`)
      .join(',');
    throw new Error(`${label}: ${applied}/${operations.length} applied (${failures})`);
  }
}

function op(entityType, entityId, payload) {
  return {
    opId: randomUUID(),
    entityType,
    entityId,
    operation: 'CREATE',
    baseVersion: 0,
    payload,
  };
}

// ── The dataset ──────────────────────────────────────────────────────────────
// Six weekly body weights (a shallow downward trend, so the bars differ in
// height and the latest-point accent is distinguishable), six muscle-mass
// measurements, five weekly snapshots, one routine with two custom exercises,
// two workout logs with four sets, and two dietary exclusions.

const WEIGHTS = [84.2, 83.8, 83.1, 82.9, 82.4, 81.7];
const MUSCLE = [35.1, 35.2, 35.4, 35.5, 35.8, 36.0];
const WAIST = [88, 87.5, 87, 86.5, 86, 85.2];
const SNAPSHOTS = [
  { volume: 8600, calories: 2450, workouts: 3, deload: false },
  { volume: 9200, calories: 2510, workouts: 4, deload: false },
  { volume: 6100, calories: 2380, workouts: 2, deload: true },
  { volume: 9800, calories: 2560, workouts: 4, deload: false },
  { volume: 10400, calories: 2590, workouts: 4, deload: false },
];

await waitForHealth();
say('api', { healthy: 1, anchor: ANCHOR });

const { token, userId } = await createAccount();

// 1. Complete profile baseline — the prerequisite `GeneratedWorkoutPlan` and
//    the iCoach `ready` assessment both need (REST, same call `seed.mjs` uses).
await request(
  'PUT',
  '/users/me/profile',
  {
    birthDate: '1990-01-15',
    gender: 'MALE',
    heightCm: 178,
    fitnessLevel: 'INTERMEDIATE',
    yearsTraining: 2,
    activityLevel: 'MODERATE',
    sleepHoursBaseline: 7,
    stressLevelBaseline: 2,
    equipment: ['dumbbells', 'bench', 'barbell'],
    trainingDaysPerWeek: 4,
    sessionDurationMins: 55,
  },
  token,
);
say('profile', { saved: 1 });

// 2. Goal.
await push(
  token,
  [
    op('goals', randomUUID(), {
      goal_type: 'RECOMPOSITION',
      target_weight_kg: 78,
      target_date: `${ANCHOR.slice(0, 4)}-12-31`,
      is_active: 1,
      started_at: isoAt(40, 9),
      ended_at: null,
    }),
  ],
  'goals',
);

// 3. Wellness safety profile — completed, with two allow-listed area tokens so
//    the populated (not empty) rendering of that surface is reachable.
await push(
  token,
  [
    op('wellness_safety_profiles', userId, {
      evaluation_completed: true,
      evaluation_date: dayBefore(30),
      affected_areas: ['knee', 'lower_back'],
      movements_to_avoid: ['deep_squat', 'high_impact_cardio'],
    }),
  ],
  'wellness',
);

// 4. Body weights — six readings, one per week, oldest first.
await push(
  token,
  WEIGHTS.map((weight, index) =>
    op('body_weights', randomUUID(), {
      date: dayBefore((WEIGHTS.length - 1 - index) * 7),
      weight_kg: weight,
      notes: null,
    }),
  ),
  'body_weights',
);

// 5. Body measurements — muscle mass + waist on the same weekly cadence.
await push(
  token,
  MUSCLE.map((muscle, index) =>
    op('body_measurements', randomUUID(), {
      date: dayBefore((MUSCLE.length - 1 - index) * 7),
      body_fat_pct: 21 - index * 0.3,
      muscle_mass_kg: muscle,
      waist_cm: WAIST[index],
      hip_cm: null,
      chest_cm: null,
      left_arm_cm: null,
      right_arm_cm: null,
      neck_cm: null,
      notes: null,
    }),
  ),
  'body_measurements',
);

// 6. Weekly snapshots — five weeks, newest last. One is a deload week so the
//    text deload flag renders as "Yes" somewhere in the earlier-weeks list.
await push(
  token,
  SNAPSHOTS.map((snap, index) =>
    op('progress_snapshots', randomUUID(), {
      week_start: weekStart(SNAPSHOTS.length - 1 - index),
      avg_weight_kg: WEIGHTS[index + 1] ?? WEIGHTS[WEIGHTS.length - 1],
      total_volume_kg: snap.volume,
      avg_calories: snap.calories,
      workout_count: snap.workouts,
      is_deload_week: snap.deload,
      rule_version: 'icoach-rules@1.1.0',
    }),
  ),
  'progress_snapshots',
);

// 7. Custom exercises → routine → routine exercises → workout logs → sets.
//    Custom (user-owned) exercises are used deliberately: the built-in catalog
//    is device-side reference data with no server row to reference.
const pressId = randomUUID();
const rowId = randomUUID();
await push(
  token,
  [
    op('exercises', pressId, {
      name: 'Theme Bench Press',
      muscle_group: 'CHEST',
      category: 'STRENGTH',
      instructions: null,
    }),
    op('exercises', rowId, {
      name: 'Theme Barbell Row',
      muscle_group: 'BACK',
      category: 'STRENGTH',
      instructions: null,
    }),
  ],
  'exercises',
);

const routineId = randomUUID();
await push(
  token,
  [
    op('routines', routineId, {
      name: 'Theme Upper A',
      description: 'Synthetic routine for light/dark capture.',
    }),
  ],
  'routines',
);

await push(
  token,
  [
    op('routine_exercises', randomUUID(), {
      routine_id: routineId,
      exercise_id: pressId,
      order_index: 0,
      target_sets: 4,
      target_reps: 8,
      target_weight_kg: 60,
    }),
    op('routine_exercises', randomUUID(), {
      routine_id: routineId,
      exercise_id: rowId,
      order_index: 1,
      target_sets: 4,
      target_reps: 10,
      target_weight_kg: 50,
    }),
  ],
  'routine_exercises',
);

const finishedLogId = randomUUID();
const openLogId = randomUUID();
await push(
  token,
  [
    op('workout_logs', finishedLogId, {
      routine_id: routineId,
      name: 'Theme Upper A',
      notes: null,
      started_at: isoAt(7, 17),
      finished_at: isoAt(7, 18),
    }),
    op('workout_logs', openLogId, {
      routine_id: routineId,
      name: 'Theme Upper A',
      notes: null,
      started_at: isoAt(0, 17),
      finished_at: null,
    }),
  ],
  'workout_logs',
);

await push(
  token,
  [
    op('workout_sets', randomUUID(), {
      workout_log_id: finishedLogId,
      exercise_id: pressId,
      set_number: 1,
      reps: 8,
      weight_kg: 60,
      rpe: 7,
      completed: true,
      notes: null,
    }),
    op('workout_sets', randomUUID(), {
      workout_log_id: finishedLogId,
      exercise_id: pressId,
      set_number: 2,
      reps: 8,
      weight_kg: 62.5,
      rpe: 8,
      completed: true,
      notes: null,
    }),
    op('workout_sets', randomUUID(), {
      workout_log_id: finishedLogId,
      exercise_id: rowId,
      set_number: 1,
      reps: 10,
      weight_kg: 50,
      rpe: 7,
      completed: true,
      notes: null,
    }),
    op('workout_sets', randomUUID(), {
      workout_log_id: openLogId,
      exercise_id: pressId,
      set_number: 1,
      reps: 8,
      weight_kg: 62.5,
      rpe: 8,
      completed: true,
      notes: null,
    }),
  ],
  'workout_sets',
);

// 8. Dietary exclusions — one allergy, one preference, so both row kinds and
//    the populated (not empty) exclusion list render.
await push(
  token,
  [
    op('dietary_preferences', randomUUID(), {
      exclusion_type: 'avoid_tag',
      avoid_tag: 'nut_allergy',
      catalog_key: null,
      kind: 'allergy',
      note: null,
    }),
    op('dietary_preferences', randomUUID(), {
      exclusion_type: 'avoid_tag',
      avoid_tag: 'lactose_sensitive',
      catalog_key: null,
      kind: 'preference',
      note: null,
    }),
  ],
  'dietary_preferences',
);

say('done', { anchor: ANCHOR, note: 'sync-now-on-device-to-pull' });
