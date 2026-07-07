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

await request(
  'POST',
  '/medical/evaluations',
  {
    evaluationDate: today,
    weightKg: 82,
    bodyFatPct: 21,
    muscleMassKg: 36,
    bloodPressureSystolic: 122,
    bloodPressureDiastolic: 78,
    restingHeartRate: 62,
    sleepQuality: 4,
    stressLevel: 2,
    activityLevel: 'MODERATE',
  },
  accessToken,
);
console.log('[seed] evaluation recorded');

// Goals have no REST endpoint — seed by emulating a device push through
// the public sync contract (doubles as a second-device sync test).
const goalId = randomUUID();
const push = await request(
  'POST',
  '/sync/push',
  {
    operations: [
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
const goalResult = push.results?.[0];
if (goalResult?.status !== 'APPLIED') {
  throw new Error(`goal sync push not applied: ${JSON.stringify(goalResult)}`);
}
console.log('[seed] goal applied via /sync/push');
console.log('[seed] done — dashboard data ready to pull');
