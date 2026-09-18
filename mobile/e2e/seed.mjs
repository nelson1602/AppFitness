// ADR-P008 E2E seeder — uses PUBLIC API/sync contracts only, never
// test-only endpoints. Seeds the fixed synthetic dataset (same values as
// the __DEV__ sample seeder) for the user the registration flow created,
// so the dashboard-sync Maestro flow can pull a populated dashboard.
//
// Fake, non-sensitive data only. Never prints tokens.
//
// Env:
//   E2E_API_URL   (default http://127.0.0.1:3001)
//   E2E_EMAIL     (default demo@appfitness.local — must match the flow)
//   E2E_PASSWORD  (default password12345 — the dev prefill)
//
// Seeds profile + body weight + body composition + goal for the seeded-pull
// flow (dashboard-sync.yml). The device-side onboarding-loop flow needs no
// seed — it enters profile, weight and goal entirely on the device (Phase 14).

import { randomUUID } from 'node:crypto';

const API = process.env.E2E_API_URL ?? 'http://127.0.0.1:3001';
const EMAIL = process.env.E2E_EMAIL ?? 'demo@appfitness.local';
const PASSWORD = process.env.E2E_PASSWORD ?? 'password12345';

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
  if (!response.ok) {
    throw new Error(`${method} ${path} -> ${response.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : undefined;
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

const today = new Date().toISOString().slice(0, 10);
const nowIso = new Date().toISOString();

await waitForHealth();
console.log(`[seed] API healthy at ${API}`);

const { accessToken } = await request('POST', '/auth/login', {
  email: EMAIL,
  password: PASSWORD,
});
console.log(`[seed] logged in as ${EMAIL}`);

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
    equipment: ['dumbbells', 'bench'],
    trainingDaysPerWeek: 4,
    sessionDurationMins: 55,
  },
  accessToken,
);
console.log('[seed] profile saved');

// Weight, body composition and goals have no REST endpoint on the public API,
// so they are seeded by emulating a device push through the public sync
// contract (which doubles as a second-device sync test).
//
// Weight used to be seeded with `POST /medical/evaluations`. That route is
// unreachable in public V1 by design: ADR-P017 Decision 4 excludes
// `MedicalModule` from the composition root, so the medical domain is dormant
// and the path 404s. The public replacements are the ADR-P016 progress
// entities `body_weights` and `body_measurements`, whose values below mirror
// the __DEV__ sample seeder in `dashboard.service.ts`.
function createOp(entityType, payload) {
  return {
    opId: randomUUID(),
    entityType,
    entityId: randomUUID(),
    operation: 'CREATE',
    baseVersion: 0,
    payload,
  };
}

const goalId = randomUUID();
const operations = [
  createOp('body_weights', { date: today, weight_kg: 82 }),
  createOp('body_measurements', {
    date: today,
    body_fat_pct: 21,
    waist_cm: 84,
  }),
  {
    opId: randomUUID(),
    entityType: 'goals',
    entityId: goalId,
    operation: 'CREATE',
    baseVersion: 0,
    payload: {
      id: goalId,
      goal_type: 'RECOMPOSITION',
      target_weight_kg: 78,
      target_date: '2026-12-31',
      is_active: 1,
      started_at: nowIso,
      ended_at: null,
    },
  },
];

const push = await request('POST', '/sync/push', { operations }, accessToken);

// `results` is returned in operation order. Every entity must apply: a
// partially seeded account produces a dashboard that is neither the empty
// first-run state nor the populated one the flow asserts.
operations.forEach((operation, index) => {
  const result = push.results?.[index];
  if (result?.status !== 'APPLIED') {
    throw new Error(
      `${operation.entityType} sync push not applied: ${JSON.stringify(result)}`,
    );
  }
});
console.log(`[seed] ${operations.length} entities applied via /sync/push`);
console.log('[seed] done — dashboard data ready to pull');
