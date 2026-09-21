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
// Seeds profile + wellness progress + goal for the seeded-pull flow
// (dashboard-sync.yml). The device-side onboarding-loop flow needs no seed
// — it enters profile, weight, and goal entirely on the device
// (Phase 14).

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

// Wellness progress and goals have no REST endpoint — seed them by emulating
// a device push through the public sync contract (also a second-device sync
// test). Retained medical routes are deliberately dormant for public v1.
const weightId = randomUUID();
const measurementId = randomUUID();
const goalId = randomUUID();
const push = await request(
  'POST',
  '/sync/push',
  {
    operations: [
      {
        opId: randomUUID(),
        entityType: 'body_weights',
        entityId: weightId,
        operation: 'CREATE',
        baseVersion: 0,
        payload: {
          id: weightId,
          date: today,
          weight_kg: 82,
          notes: null,
        },
      },
      {
        opId: randomUUID(),
        entityType: 'body_measurements',
        entityId: measurementId,
        operation: 'CREATE',
        baseVersion: 0,
        payload: {
          id: measurementId,
          date: today,
          body_fat_pct: 21,
          muscle_mass_kg: 36,
          waist_cm: 84,
          hip_cm: null,
          chest_cm: null,
          left_arm_cm: null,
          right_arm_cm: null,
          neck_cm: null,
          notes: null,
        },
      },
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
    ],
  },
  accessToken,
);
const results = push.results ?? [];
if (results.length !== 3 || results.some((result) => result.status !== 'APPLIED')) {
  throw new Error(`wellness/goal sync push not applied: ${JSON.stringify(results)}`);
}
console.log('[seed] wellness progress and goal applied via /sync/push');
console.log('[seed] done — dashboard data ready to pull');
