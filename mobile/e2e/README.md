# Mobile E2E — Seeded Local API (ADR-P008)

End-to-end flows run a **real release APK** against the **real NestJS
api/** with disposable PostgreSQL, colocated with the Android emulator.
Fake, synthetic data only. The e2e build pins `EXPO_PUBLIC_API_URL` to
`http://127.0.0.1:3001`; `adb reverse` maps the device's 127.0.0.1:3001
to the host, so the app can only ever reach a local backend.

Android blocks cleartext `http://` in release builds by default, so the
e2e build profile sets `APP_VARIANT=e2e`, which makes `app.config.js`
load the local `plugins/with-e2e-cleartext.js` config plugin
(`usesCleartextTraffic=true`). **E2E builds only** — production and all
other variants never load the plugin and keep cleartext blocked.

## Flows (`mobile/.maestro/`)

| Flow | Needs API? | What it proves |
|---|---|---|
| `smoke-auth-surface.yml` | no | launch, routing, auth surface, `__DEV__` gate |
| `registration.yml` | yes | register → empty dashboard (data-gap state) |
| `dashboard-sync.yml` | yes (after seed) | session restore → Sync now → populated dashboard via real pull |

Run order for the full suite: registration → `node e2e/seed.mjs` →
dashboard-sync. Registration creates the device session; the seeder adds
profile/evaluation (REST) and a goal (`/sync/push`, public contract);
the sync flow pulls it all through the real appliers.

**Isolation model:** a fresh disposable database per run (exactly what
CI's service container provides). The registration flow submits the
prefilled dev identity (`demo@appfitness.local`) without typing —
replacing prefilled RN TextInput text via tap+erase proved
cursor-position-flaky, so the flows type nothing. The seed script's
`E2E_EMAIL`/`E2E_PASSWORD` env overrides exist for non-default setups.

## Local run

```bash
# 1. Backend with a FRESH disposable DB (down -v is the documented
#    teardown; the dev DB is disposable by design — api/docker-compose.yml)
cd api && docker compose down -v && docker compose up -d
DATABASE_URL="postgresql://appfitness:localdev@localhost:5433/appfitness_dev" npx prisma migrate deploy
npm run start:dev   # port 3001; api/.env supplies dev-only config

# 2. APK — download the latest EAS e2e build (or trigger a new one)
cd ../mobile
npx eas-cli build:list --platform android --profile e2e --limit 1 --json
#   -> download applicationArchiveUrl, or: npx eas-cli build -p android --profile e2e

# 3. Emulator + install + wire API
emulator -avd <your-avd> &
adb install -r <downloaded>.apk
adb reverse tcp:3001 tcp:3001

# 4. Flows
maestro test .maestro/registration.yml
node e2e/seed.mjs
maestro test .maestro/dashboard-sync.yml
```

Maestro install (no admin): unzip the GitHub release
(`mobile-dev-inc/maestro` → `maestro.zip`) and run `bin/maestro` with a
JDK 17+ on PATH.

## CI

`.github/workflows/mobile-e2e.yml` (manual `workflow_dispatch`) runs the
same sequence on one runner: Postgres service → api → Android emulator →
Maestro. It downloads the latest FINISHED EAS `e2e` APK and therefore
requires an **`EXPO_TOKEN`** repository secret (Expo access token from
https://expo.dev/accounts/[account]/settings/access-tokens). Without the
secret the workflow fails fast with a clear message.

## Boundaries

- Public API/sync contracts only — no test-only backend endpoints.
- No production services or data; CI credentials are throwaway values.
- EAS *cloud* Maestro runs stay blocked on billing (ADR-P007/P008); when
  Phase 12 provides a hosted test API, only the e2e profile URL changes.
