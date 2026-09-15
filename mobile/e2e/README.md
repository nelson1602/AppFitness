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
| `dashboard-sync.yml` | yes (after full seed) | session restore → Sync now → populated dashboard via real pull |
| `onboarding-loop.yml` | yes (no seed) | full device-side profile + evaluation/weight + goal entry via gap actions → iCoach ready from local data → nutrition targets + 15-day meal plan render → sync clears pending → sign out & back in |
| `food-log.yml` | yes (no seed) | open the food log from the meal-plan entry point, log a catalog food, see daily totals update, confirm a sync attempt keeps the (pending) entry, soft-delete it (runs after onboarding-loop, same session) |
| `food-log-exclusion-warning.yml` | yes (no seed) | add a "Nuts" allergy via the dietary-preferences surface, then confirm selecting a nut food on the food log shows the non-blocking allergy/sensitivity warning and can still be logged (ADR-P014 Slice 4). Wired into `mobile-e2e.yml` after `food-log.yml` (same onboard session). **PENDING a first green run**: it needs an EAS `e2e` APK built from the Slice 4 commit (878af06) or later — an older APK predating the warning UI fails the assertions. Until that run, Slice 4 is verified by unit/component tests. |
| `medical-management.yml` | yes (no seed) | add/list/end a restriction; open evaluation history, see the recorded weight, two-step soft-delete it (runs after onboarding-loop, same session) |
| `offline-entry.yml` | API unreachable | with the adb-reverse loopback dropped: enter a profile locally (save works offline) → sync shows "Local changes pending" |
| `reconnect-sync.yml` | yes | with the loopback restored: the offline-queued change syncs to "Local data ready" |

Two journeys run against the same disposable DB with distinct synthetic
users:

- **Journey A (seeded pull):** `registration.yml` (demo user) →
  `node e2e/seed.mjs` (full: profile/evaluation REST + goal via
  `/sync/push`) → `dashboard-sync.yml` pulls it all through the real
  appliers.
- **Journey B (full device onboarding + medical management):**
  `registration.yml` (onboard user) → `onboarding-loop.yml` enters the
  profile, physical evaluation (weight), and goal entirely on the device
  through the dashboard gap actions. The iCoach assessment reaches `ready`
  from purely local data (no server seed), then local changes sync until
  pending clears, and the account signs out and back in with data intact.
  → `food-log.yml` then logs a catalog food from the meal-plan entry
  point, confirms the daily totals update and the entry survives a sync
  attempt as pending (the local parent meal is not yet server-synced, so
  the `meal_items` op returns `DEPENDENCY_NOT_READY` and stays queued —
  never data loss), then soft-deletes it. → `medical-management.yml` then
  adds/lists/ends a restriction and soft-deletes the recorded evaluation
  from the history screen.

- **Journey C (offline data entry, Phase 14.5):** `registration.yml`
  (offline user, online) → `adb reverse --remove tcp:3001` (simulate
  offline) → `offline-entry.yml` (profile saves locally, banner shows
  "Local changes pending") → `adb reverse tcp:3001 tcp:3001` (restore) →
  `reconnect-sync.yml` (queued change syncs to "Local data ready"). We do
  not attempt a sync while offline — a failed op enters a 60s retry backoff
  that would make the immediate reconnect flaky.

**Offline simulation — note:** the app reaches the runner-local API over
`adb reverse` (a USB/loopback forward), which is NOT severed by the
emulator's airplane mode/radio. Offline is therefore simulated by dropping
the loopback forward (`adb reverse --remove tcp:3001`) around the offline
flow, not by toggling the device radio.

**Isolation model:** a fresh disposable database per run (exactly what
CI's service container provides). Since the release product gate, the
sign-in surface ships with EMPTY fields — the registration flow types
the disposable identity into `testID`-addressed inputs and REQUIRES
`-e E2E_EMAIL/-e E2E_USERNAME/-e E2E_PASSWORD` (no flow-level env
defaults: they shadow `-e` overrides). Values must match the seed
script's defaults unless both are overridden. The dashboard-sync flow
ends by signing out and asserting the return to the auth surface.

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

# 4. Flows — Journey A (seeded pull)
maestro test -e E2E_EMAIL=demo@appfitness.local -e E2E_USERNAME=demo \
  -e E2E_PASSWORD=password12345 .maestro/registration.yml
node e2e/seed.mjs
maestro test .maestro/dashboard-sync.yml

# 5. Flows — Journey B (full device onboarding loop; no seed)
maestro test -e E2E_EMAIL=onboard@appfitness.local -e E2E_USERNAME=onboard \
  -e E2E_PASSWORD=password12345 .maestro/registration.yml
maestro test -e E2E_EMAIL=onboard@appfitness.local \
  -e E2E_PASSWORD=password12345 .maestro/onboarding-loop.yml
maestro test .maestro/food-log.yml
```

Maestro install (no admin): unzip the GitHub release
(`mobile-dev-inc/maestro` → `maestro.zip`) and run `bin/maestro` with a
JDK 17+ on PATH.

## Conflict resolution — ADR-P030 C-7

The conflict journeys are the one part of this suite that needs **two
devices**: a conflict is by definition two clients disagreeing about the same
record, and no single-device run can produce one honestly.

**One journey is the exception, and it is not a shortcut.**
`conflict-loser-standing` is a **concurrent public-client race**, not a second
app device. The server records every conflict with `create`, so each stale push
mints its own id, and a client only ever reconciles ids it already holds
(`listConflicts({ ids })`). Two app devices therefore **cannot** share one
conflict id, while `ALREADY_RESOLVED_*` is keyed on exactly that id. Staged
with a second device the journey would produce a stale comparison or a plain
successful claim — never the standing-decision outcome it exists to prove. It
is staged instead with another client of the **same owner**, over the same
public endpoint, deciding that device's own conflict id first.

```
maestro --device <A> test -e E2E_EMAIL=… -e E2E_PASSWORD=… .maestro/conflict-signin.yml
maestro --device <B> test -e E2E_EMAIL=… -e E2E_PASSWORD=… .maestro/conflict-signin.yml
```

Both emulators need `adb reverse tcp:3001 tcp:3001`, and it must be
**re-applied before each flow**: Maestro resets port forwarding for the device
it drives, and a device that silently loses the loopback simply queues its
writes instead of failing, which looks like a product bug and is not one.

| Flow | What it proves |
|---|---|
| `conflict-signin` | Signs a disposable account in on one device, from a cleared state |
| `conflict-areas-first` | Creates the account's wellness safety profile on a device |
| `conflict-areas-swap` | Moves one allow-listed **tokens** value, so a divergence renders as localized labels |
| `conflict-sync-now` | Drains the queue through the shipped "Sync now" control |
| `conflict-review-open` | Dashboard entry + the review surface: record kind, field label, both sides in text, no identifiers |
| `conflict-choose` | Records either resolution and settles it |
| `conflict-offline-choice` | A choice with no connectivity: stored here, finished later |
| `conflict-reconnect-settle` | The stored choice settles on reconnect without being re-entered |
| `conflict-restart-recovery` | A settlement outstanding across a process force-stop |
| `conflict-stale` | The account moved after the review: refused, refreshed, re-reviewed |
| `conflict-loser-standing` | First choice wins through the public-client race above, and the losing device is told which side stands |
| `conflict-deleted-elsewhere` | The deletion disclosure, and the **one** restore outcome this entity actually produces |
| `conflict-isolation-device` | One account's surface shows nothing of another's |
| `conflict-route-guard` | `/sync-conflicts` redirects a signed-out visitor |

### Ordering: the offline, restart and reconnect triple

These three run back to back on the same device, in this order, and the order
is part of what they prove:

1. `conflict-offline-choice` — loopback dropped first. The choice is recorded
   and the immediate drain fails, leaving it retryable.
2. `conflict-restart-recovery` — **still offline.** It issues an explicit
   `stopApp` so the process death is caused by the test rather than inherited
   from `launchApp`'s implicit stop, then asserts the choice survived in the
   local database and is not offered again.
3. **Let the settlement backoff elapse (~60s), then** `conflict-reconnect-settle`
   — loopback restored, and **no `launchApp`**, so
   it runs in the process the previous flow left alive. That keeps the
   in-process reconnect distinct from the restart above; `openLink` brings the
   running app forward without stopping it.

The backoff wait is not padding. The resolution outbox uses the shipped
exponential schedule (`backoff.ts`: 30s × 2^attempts), so the single failed
offline attempt puts that row roughly a minute out. Draining it earlier is a
legitimate no-op — `listSettlementDue` returns no due row, the card is
unchanged and no notice appears — so tapping into that window would be testing
the retry policy rather than the reconnect.

A single combined flow cannot prove both: whichever one it restarts for, the
other is left unproven. (An earlier `conflict-retry-settle` tried to carry both
and proved neither honestly; it is replaced by the two flows above.) There is
no background drain on reconnect either — the resolution outbox is drained by
the review surface's own retry control, because the dashboard's "Sync now"
drives the entity sync queue, not the conflict outbox.

### Why the restore outcome is asserted exactly

`conflict-deleted-elsewhere` asserts that the record **comes back**, and fails
if it does not. That is not a guess between two acceptable endings:
`WellnessSafetyProfileRepository.resolve` matches the existing singleton row
with `deletedAt: { not: null }` and writes `deletedAt: null, deletedBy: null`
for a non-`DELETE` resolution. The restore is an `updateMany` over a row that
is already present — no insert — so the unique-constraint path that raises
`RESTORE_UNSUPPORTED` is unreachable for `wellness_safety_profiles`. Accepting
"either outcome" here would let a silently broken restore pass.

### The harness

`e2e/c7-conflicts.mjs` sits *around* the journeys, never inside them. It uses
the same public contracts the app does — register, login, `/sync/push`,
`/sync/pull`, `/sync/conflicts` — to create disposable accounts, act as a
legitimate **third client** where a journey needs the account to move at a
controlled moment, and read server state back so a device-side outcome can be
checked against what the account actually holds.

Its `decide-first` command is the third client for the race above: it resolves
one conflict id as `SERVER_WINS`, which carries no payload and leaves the entity
version untouched, so the device's stored comparison stays fresh and the
outcome it meets is the standing decision rather than a stale one.

Two things it deliberately does not do. It never sends a `deviceId`: that
column is foreign-keyed to a registered device, and a harness that invents one
is rejected — the app registers its own. And it never prints a token, password,
payload or raw response: `redact()` is the only channel to stdout, and it emits
versions, counts, statuses and synthetic token names only.

It caches its session in the OS temp directory between invocations, because a
client signs in once and keeps its session. Logging in per command turns a
handful of checks into a burst that `/auth`'s throttle (120 / 15 min,
ADR-P020) correctly refuses — the rate limiter working, not a defect.

### Why the wellness safety profile

These journeys diverge `wellness_safety_profiles`. It is reachable from the
dashboard on every run, holds exactly one row per account, and its
`affected_areas` is an allow-listed **tokens** field — so the comparison
exercises C-6's localization vocabulary as well as its field rendering. The
profile and goal surfaces are reachable only through a first-run data gap,
which closes once answered, so neither can be edited repeatedly.

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
