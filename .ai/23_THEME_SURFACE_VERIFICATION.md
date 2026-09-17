# Light / Dark Per-Surface Visual Verification

Version: 1.1
Status: Active — **partial**; see §What is still unverified
Last Updated: 2026-09-17

> **Pass 2 (2026-09-17, from `ef8b181`)** closes the five native gaps this
> document left open — populated rows, `TrendBars`, `WeeklySnapshotSummary`,
> `GeneratedWorkoutPlan` and the conflict **card** — and covers the three public
> Web portals at four viewport widths. It found **T-2**, a Web defect: with
> `prefers-color-scheme: dark` the exported portals render **light or mixed**,
> never dark. Everything pass 2 added is in §Pass 2 onward; pass 1's method,
> coverage, result and finding T-1 are unchanged below.

---

# Purpose

Discharge part of **Stage 2 gate 6** of the route to publication in
`docs/RELEASE_READINESS.md`: *"Light and dark mode verified across every shipped
surface."*

ADR-P022 Addendum A added `contrast.spec.ts`, which measures every approved
token pairing in both themes on every test run. That is **computed evidence
about the palette**. This document is the other half: **what a person actually
sees**, captured from a running build.

**This does not mark gate 6 done.** It records what was verified, what was
found, and what remains — see §What is still unverified.

---

# Method

- **Build:** release APK built from `origin/main` `5dee02b`, the first build
  that contains ADR-P022 Addendum A. The previously installed APK predated every
  Addendum A colour change, so verifying against it would have tested the wrong
  code. Sentry source-map upload was disabled by environment variable for the
  local build only; nothing in the repository was changed to produce it.
- **Device:** `appfitness-c7-a` emulator, Android 15 / API 35, Pixel 7 profile.
- **Theme control:** the app has no in-app theme switch — `useTheme()` reads
  `useColorScheme()`, so the theme is the OS setting. Each pass sets it with
  `adb shell cmd uimode night yes|no`, which is the same signal a user's system
  toggle produces. Night mode was confirmed applied (`Night mode: yes`) rather
  than assumed.
- **Navigation:** each route opened by its own deep link, screenshotted after
  the surface settled.
- **Review:** every capture was **looked at**, not diffed by file size. An early
  observation based on file size alone was wrong and was discarded.

---

# Coverage

**18 of the 19 reachable routes, in both themes — 36 captures.**

| Route | Light | Dark | State captured |
|---|---|---|---|
| `/sign-in` | ✓ | ✓ | signed out, with language selector |
| `/forgot-password` | ✓ | ✓ | empty form |
| `/reset-password` | ✓ | ✓ | incomplete-link state |
| `/verify-email` | ✓ | ✓ | incomplete-link state |
| `/dashboard` | ✓ | ✓ | verification reminder, wellness recommendation, sync banner |
| `/delete-account` | ✓ | ✓ | confirmation form, destructive button disabled |
| `/profile-edit` | ✓ | ✓ | empty form, chip groups |
| `/goal-edit` | ✓ | ✓ | goal chips, empty fields |
| `/nutrition` | ✓ | ✓ | data-gap card |
| `/nutrition-plan` | ✓ | ✓ | data-gap card, disclaimer |
| `/food-log` | ✓ | ✓ | sync banner, meal chips, empty log |
| `/dietary-preferences` | ✓ | ✓ | chip groups, disabled submit |
| `/progress` | ✓ | ✓ | empty summary, two entry forms |
| `/routines` | ✓ | ✓ | baseline warning, disabled submit |
| `/workout-log` | ✓ | ✓ | start form, empty list |
| `/exercises` | ✓ | ✓ | custom-exercise form, category chips |
| `/wellness-safety-profile` | ✓ | ✓ | disclaimer, yes/no, token multi-selects |
| `/sync-conflicts` | ✓ | ✓ | empty state |

`/` is a redirect that renders only the shared loading skeleton and was not
captured as a distinct surface.

---

# Result — no dark-mode rendering failure was found

Across all 36 captures:

- every text string was legible against its ground in both themes;
- no surface failed to adapt — there was no light-on-light or dark-on-dark
  region, and no card, banner, field or chip kept a light-theme ground while the
  page was dark;
- **selected** chips render a light fill with a dark label in dark theme
  (`primary` / `onPrimary`) and the inverse in light — correct in both;
- **enabled** filled buttons are correct in both themes, including the
  `secondary` and `text` button labels that Addendum A fixed. The defect it
  describes — labels rendering as untinted black at 1.13–1.42:1 on dark grounds
  — is **not present in this build**;
- banner accents (`info` blue, `success` green, `warning` amber, `error`
  salmon) all read clearly against the dark surface.

---

# Finding T-1 — disabled filled buttons fall below 4.5:1 in **both** themes

**Severity:** low. Not a WCAG failure. A legibility observation.

`AppButton` renders its disabled state as `opacity: 0.56` over the whole
control, which composites **both** the fill and the label toward the page
ground. Measured label-vs-fill contrast:

| Button | Enabled | Disabled |
|---|---|---|
| Primary, light | 6.07:1 | **2.52:1** |
| Primary, dark | 6.95:1 | **3.35:1** |
| Destructive, light | 6.46:1 | **2.89:1** |
| Destructive, dark | 7.72:1 | **3.75:1** |

Observed on `/delete-account` ("Delete my account"), `/dietary-preferences`
("Add exclusion") and `/routines` ("Create routine").

**Why the automated gate cannot see this.** `contrast.spec.ts` measures the
declared token pairings — `onPrimary` on `primary`, `onError` on `error` — which
are the **enabled** values, and they pass comfortably. The disabled appearance
is produced at render time by an opacity composite, not by a token pair. WCAG
2.2 §1.4.3 also **exempts** inactive controls, so this is conformant.

**Correction worth recording.** On first inspection this looked like a
*dark-specific* defect, because a dark label on a mid-tone fill sitting on a
dark ground reads as muddy. Computing the composite showed the opposite: **light
is worse than dark at every measurement**. The visual impression was wrong and
the arithmetic settled it. No fix is proposed here; if one is wanted, the honest
options are a dedicated disabled token pair rather than a blanket opacity, or
accepting it as an exempt state.

---

# What pass 1 left unverified

Gate 6 was **not** discharged by pass 1. These were not reachable without
seeding data or a second device:

1. **Populated list and data states.** Every signed-in surface was captured in
   its empty or data-gap state. Rows carrying pending-sync and conflict hints,
   logged food with totals, saved exclusions, routines and workout sets are all
   unverified.
2. **`TrendBars` and `WeeklySnapshotSummary`.** These draw their own marks and
   are the most theme-sensitive components in the product. They render only with
   recorded weights and snapshots, so **neither was exercised**.
3. **`GeneratedWorkoutPlan`.** It renders only once the profile baseline is
   complete; `/routines` showed the baseline warning instead.
4. **The conflict card.** `/sync-conflicts` was captured empty. The card, its
   field comparison, both choice controls and the settled/retrying treatments
   are unverified.
5. **The three Web portals.** Verified on native only.
6. **Large-text, screen-reader and keyboard behaviour.** Out of scope here and
   still owned by gate 7 (UX-4C).

**Items 1–5 are closed by pass 2 below. Item 6 stays open** and is not this
document's to close.

---

# Pass 2 — 2026-09-17

## What pass 2 did

Seeded the account states pass 1 could not reach, captured them on the same
device in both themes, and captured the three public Web portals at four
viewport widths in both colour schemes — **64 new captures** (40 native, 24
Web). Every one was **looked at**; the light/dark pairs were additionally
compared by SHA-256, which is how the Web finding below was first noticed.

## Method — native

- **Build: unchanged and re-verified.** The APK installed on the emulator was
  pulled back and hashed: `sha256
  bd7fc7dd25b37474a86cbad708463ce97bdf15e45d5f75c7031834970d2cdcc9`,
  `com.appfitness.mobile` 1.0.0, installed 2026-09-16 15:01:54. It is
  **byte-identical** to the build output still on disk at
  `mobile/android/app/build/outputs/apk/release/app-release.apk` (written
  2026-09-16 15:01) — pass 1's artifact, by hash and by timestamp.
  `git diff --name-only 5dee02b..ef8b181 -- mobile/src` is **empty**: no mobile
  source changed between the build commit and this baseline, so the installed
  build still describes `main`. Rebuilding would have produced the same UI and
  discarded a verified artifact.
  For the record, that APK is the **`e2e`-variant** release build, not the plain
  `release` profile: its manifest carries `android:usesCleartextTraffic=true`
  and its bundle contains `http://127.0.0.1:3001` and **no** Railway host. Pass 1
  called it "release APK"; the variant is the accurate description, and it is the
  reason the device can only ever reach a local API.
- **Device:** `appfitness-c7-a` emulator (`EMULATOR36X6X11X0`), Android 15 /
  API 35, Pixel 7 profile, animations disabled.
- **Backend: local and disposable.** `api/docker-compose.yml` Postgres on 5433
  with all 16 migrations applied, the NestJS API on 127.0.0.1:3001 reached from
  the device through `adb reverse`. Throwaway local secrets generated for the
  run and never written into the repository. **No hosted environment was
  contacted at any point.**
- **Data: synthetic, through public contracts only.** `mobile/e2e/theme-seed.mjs`
  (new, test-only) registers a **fresh** disposable account — it stops on a 409
  rather than seeding one that already holds data — and pushes a fixed dataset
  over `PUT /users/me/profile` and `POST /sync/push`, the same endpoints the app
  uses. The device then **pulled** it through its own appliers by tapping the
  shipped "Sync now" control. Six weekly body weights, six measurements, five
  weekly snapshots, a goal, a completed wellness profile, two custom exercises,
  a routine with two exercises, two workout logs with four sets and two dietary
  exclusions. Nothing was written into the device database behind the app's back.
- **Food log staged through the UI.** A meal has no server row, so the sync
  contract cannot seed one; `mobile/.maestro/theme-stage-food-log.yml` (new,
  test-only, asserts nothing) logs a catalog food through search → serving
  stepper → add. It was run three times, so the captured log holds three rows.
- **Conflict staged with the shipped C-7 tooling.** `e2e/c7-conflicts.mjs
  bump-areas` moved the account on as a legitimate third client (v1 → v2), then
  `conflict-areas-swap.yml` made the device's stale edit and
  `conflict-sync-now.yml` drained the queue; the server confirmed exactly one
  pending conflict. `conflict-offline-choice.yml` with the loopback dropped
  produced the **retrying** treatment, and `conflict-reconnect-settle.yml` after
  the backoff produced the **settled** one.
- **Capture:** `mobile/e2e/theme-capture.mjs` (new, test-only) drives `adb`
  only. For each target it opens the route by deep link, applies a fixed number
  of identical swipes, captures light, **then toggles `cmd uimode night` while
  the surface sits still** and captures dark. Both images of a target are
  therefore the same route at the same scroll offset, differing only by theme.
  The applied night state is read back, never assumed, and every capture is
  checked for a PNG header before it is written.

## Method — Web

- **Local static export only.** `npx expo export --platform web` from `ef8b181`
  with `EXPO_PUBLIC_API_URL=http://127.0.0.1:3001`, served from 127.0.0.1 by the
  harness's own Node server. **The hosted portals were not contacted**, so what
  follows describes the export of `main`, not `account.appfitnessrd.com`,
  `account-dev.appfitnessrd.com` or `recovery.appfitnessrd.com`.
- **`mobile/e2e/theme-web-capture.mjs`** (new, test-only) drives a local
  headless Chrome over the DevTools protocol using Node's built-in `WebSocket`
  and `http` — **no dependency was added and neither lockfile was touched**.
  Theme is emulated with `Emulation.setEmulatedMedia`
  (`prefers-color-scheme`), which is what `useColorScheme()` reads through
  react-native-web, and each capture **asserts in-page** that
  `matchMedia('(prefers-color-scheme: dark)').matches` and `innerWidth` are what
  it claims before the screenshot is taken.
- **Harness self-check.** Before T-2 was called a product defect, a control page
  whose only styling is a `prefers-color-scheme` media query was served through
  the same harness: it reported `rgb(255,255,255)` in light and `rgb(16,20,24)`
  in dark. The emulation reaches CSS; what does not adapt is the app.
- **Widths:** 360, 414, 768 and 1280 CSS px at DPR 1 — a small phone, a large
  phone, a tablet and a desktop window.

## Coverage — native populated states

19 harness targets plus the settled conflict treatment, each in both themes —
**40 files**, indexed with byte length and SHA-256 in `inventory.json`. All 20
pairs were compared: **not one light/dark pair is identical**, so every native
surface demonstrably changed with the theme rather than merely appearing to.

| Target | Route | State captured |
|---|---|---|
| `dashboard-populated` | `/dashboard` | conflict banner, assessment card, filled + outlined buttons |
| `dashboard-populated-lower` | `/dashboard` | recommendation cards, populated Progress summary card |
| `progress-summary` | `/progress` | latest weight, 6 weight + 6 measurement entries |
| `progress-trends` | `/progress` | **`TrendBars`** — body weight and muscle mass, 6 bars each |
| `progress-weekly` | `/progress` | **`TrendBars`** volume + **`WeeklySnapshotSummary`** latest week and four earlier weeks |
| `routines-plan` | `/routines` | **`GeneratedWorkoutPlan`** header, equipment warning, weekly schedule |
| `routines-plan-lower` | `/routines` | plan sessions, per-exercise prescriptions and substitutions |
| `routines-rows` | `/routines` | progression rules, disabled create control, populated routine row |
| `workout-log-rows` | `/workout-log` | open workout with actions, finished workout row |
| `exercises-rows` | `/exercises` | custom-exercise row with its safety note, built-in list |
| `dietary-preferences-rows` | `/dietary-preferences` | selected chips, two exclusion rows (allergy + preference) |
| `food-log-rows` | `/food-log` | daily totals against target, three rows with steppers and **pending-sync hints** |
| `nutrition-populated` | `/nutrition` | computed targets and macro rows |
| `nutrition-plan-populated` | `/nutrition-plan` | three populated meal cards with per-item macros |
| `wellness-profile-populated` | `/wellness-safety-profile` | selected area and movement tokens among unselected ones |
| `sync-conflicts-card` | `/sync-conflicts` | **conflict card**, status, versions, four-field comparison |
| `sync-conflicts-card-lower` | `/sync-conflicts` | the same card's **both choice controls** and their consequences |
| `sync-conflicts-retrying` | `/sync-conflicts` | **retrying** treatment: offline banner + "We'll try again shortly" |
| `sync-conflicts-retrying-lower` | `/sync-conflicts` | retrying treatment with the "Try now" control |
| `sync-conflicts-settled` | `/sync-conflicts` | **settled**: "All set" + "Nothing to review" |

## Result — native: no theme defect found

Across all 40 native captures:

- every string was legible against its ground in both themes; no light-on-light
  or dark-on-dark region and no surface that kept one theme's ground while the
  page was in the other;
- **`TrendBars`** adapts: it fills bars from `primary` and the latest bar from
  `accent` (source), and in the captures both render as distinct, clearly
  separated fills against the card in each theme — deep blue / dark green in
  light, pale blue / teal in dark — with the descriptor, summary and per-bar
  text legible as muted text in both. Pixel values were not sampled; this is a
  visual reading, and the token arithmetic is `contrast.spec.ts`'s job;
- **`WeeklySnapshotSummary`** is text-first and adapts wholly — metric rows, the
  text deload flag and the newest-first earlier-weeks list;
- **`GeneratedWorkoutPlan`** adapts wholly, including the amber `warning` accent
  on its equipment notice;
- **the conflict card** adapts in all three staged treatments; the `Different`
  marker renders `warning` in both themes and the "Same on both" markers render
  muted, so the comparison never depends on colour alone;
- **populated rows** adapt, including the `Pending sync` hints, the destructive
  `Remove` affordances and the serving steppers;
- selected chips are correct in both themes in both of their forms — the filled
  `primary`/`onPrimary` chip on `/dietary-preferences` and `/food-log`, and the
  `primaryContainer` token chip on `/wellness-safety-profile`.

**T-1 is reconfirmed, and so is its direction.** The disabled "Create routine"
and "Add exclusion" controls show the opacity composite in both themes, and the
light capture is the harder one to read — as pass 1's arithmetic said.

## Finding T-2 — the three Web portals do not adapt to dark mode

**Severity: medium.** A visible defect on a public, deployed surface. It is not
a data, safety or security issue, and it does not block the **native** V1
product, but it contradicts the "responsive, polished bilingual portal"
ADR-P032 records as the public V1 Web boundary.

With `prefers-color-scheme: dark` confirmed inside the page, the exported
portals never render the dark theme:

| Route | 360 | 414 | 768 | 1280 | Dark rendering |
|---|---|---|---|---|---|
| `/forgot-password` | ✓ | ✓ | ✓ | ✓ | **pixel-identical to light** — no adaptation at all |
| `/reset-password` | ✓ | ✓ | ✓ | ✓ | **mixed** — light page/card, dark banner and button |
| `/verify-email` | ✓ | ✓ | ✓ | ✓ | **mixed** — light page/card, dark banner and button |

Sampled computed backgrounds with dark requested (identical at 1.5 s, 4 s and
9 s after load — this is a stable end state, not a hydration race):

- `/forgot-password` → `#F8FAFC` (light `background`) ×4, `#FFFFFF` (light
  `surface`) ×2, `#EEF1F5` (light `surfaceVariant`), `#0F62B8` (light
  `primary`). No dark token present.
- `/reset-password`, `/verify-email` → `#F8FAFC` ×4 and `#FFFFFF` **plus**
  `#24282C` (dark `surfaceVariant`) and `#8FC5F7` (dark `primary`): two themes
  on one page.

**Why — what is observed, and what is inferred.** Directly observed in the
artifact: the prerendered `forgot-password.html` hard-codes the light values
(`rgba(248,250,252…)`), carries **no** dark token, and the export contains **no
`prefers-color-scheme` rule anywhere**. The rest is the explanation that fits:
static rendering runs in Node, where `useColorScheme()` has no media query to
read, so the shipped HTML is light by construction; hydration reuses that tree,
the media query never *changes*, so nothing forces a global re-render, and only
subtrees that re-render for their own reasons — which is what distinguishes the
two link-consuming portals from `/forgot-password` — pick the dark values up.
That last step is a reading of the evidence, not something this pass proved by
instrumenting the render. Native is unaffected either way: it has no prerender.

**Legibility.** In the captured states every element is internally consistent,
so nothing was illegible. One adjacent scenario is worse and is recorded rather
than claimed: when the OS theme is switched **while a portal is open**, the
input adopts the dark `surfaceVariant` while its card stays white, leaving the
`Email` label as dark-theme muted text on a white card. That is a low-contrast
pairing, observed once, on a page that is already rendering two themes.

**No fix is proposed here, and none was made.** The plausible directions — a
`color-scheme`/media-query-driven shell, a per-locale-style themed prerender, or
forcing a post-hydration re-render from `Appearance` — all change product
behaviour on a deployed surface and belong to an owner decision. Tracked as
`BUG-017`.

## Observations (not defects)

- **OBS-T2-1 — the latest `TrendBars` bar can collapse to a 4 px sliver.** When
  the newest reading is the series minimum (the body-weight series here), min
  normalization gives it `MIN_BAR` height, so the `accent` "latest" cue is
  barely visible. Identical in both themes, so it is not a theme defect, and the
  component already names the latest point in text and never relies on colour
  alone (UX-3D R-4). Recorded because a chart whose newest value is its smallest
  is an ordinary case.
- **OBS-T2-2 — the Web portals have no maximum content width.** At 1280 px the
  card and its submit control span the full viewport. Legible and functional at
  every width tested; "polished" at desktop width is a design judgement.
- **OBS-T2-3 — the seeded `equipment` value `bench` is not in the iCoach
  vocabulary,** so `GeneratedWorkoutPlan` renders "Equipment not recognized …
  bench". This is *not* a fixture mistake invented here: `mobile/e2e/seed.mjs`
  and the `__DEV__` `loadSampleDashboardData` seeder both seed the same value,
  so the shipped dev sample produces the same notice. It was kept, because it
  exercises the plan card's `warning` treatment in both themes.
- **OBS-T2-4 — two shipped Maestro journeys assert copy the product no longer
  renders on first run.** `registration.yml` and `onboarding-loop.yml` wait for
  `dashboard.gap.title` ("Finish your baseline"), but ADR-P027 made the
  first-run `empty` state render `OnboardingChecklistCard` ("Finish setting up
  AppFitness") instead; `DataGapCard` now renders only in the `ready` state.
  Both flows fail at that assertion on this emulator. This matches the already
  recorded staleness of the E2E evidence (gate E1) and was **not** fixed here —
  it is outside a verification slice.

## What pass 2 did not do

- **No hosted or Production surface was touched.** The Web result describes a
  local export of `main`. Whether the deployed Worker serves the same artifact
  was not checked and is not claimed.
- **No accessibility outcome is claimed.** No screen reader, no keyboard, no
  large-text pass. Gate 7 (UX-4C) is untouched.
- **No physical device.** One emulator, one profile, one density.
- **Contrast was not re-measured** for the new states; `contrast.spec.ts`
  remains the arithmetic gate and it passes.
- **Spanish was not re-captured.** Both passes are English; the bilingual
  evidence is `.ai/21` and `.ai/22`.

## Reproducing pass 2

```bash
# 1. local disposable backend
cd api && docker compose up -d
DATABASE_URL="postgresql://appfitness:localdev@localhost:5433/appfitness_dev" npx prisma migrate deploy
#    start the API on 127.0.0.1:3001 with local throwaway secrets

# 2. device + data
adb reverse tcp:3001 tcp:3001
cd ../mobile
THEME_EMAIL=<fresh disposable> node e2e/theme-seed.mjs  # single-use; then tap "Sync now"
maestro test .maestro/theme-stage-food-log.yml          # once per food-log row wanted

# 3. native captures (both themes, same scroll offset)
node e2e/theme-capture.mjs --out=<evidence-dir>/native

# 4. web captures (four widths, both schemes)
EXPO_PUBLIC_API_URL=http://127.0.0.1:3001 npx expo export --platform web --output-dir <dist>
node e2e/theme-web-capture.mjs --dist=<dist> --out=<evidence-dir>/web
```

Captures are written outside the repository and are **not** committed; each
directory carries an `inventory.json` with per-file byte length and SHA-256.
Pass 2's evidence is at
`C:\Users\NelsonDeschamps\appfitness-theme-gate6-2026-09-17\` (`native/`, 40
files; `web/`, 24 files).

**One honest gap in that index.** The first version of `theme-capture.mjs`
*replaced* `inventory.json` on every run, so a later `--only` run for a staged
conflict treatment overwrote the sweep's per-target metadata. The harness was
corrected to merge, and to rebuild `files` from what is on disk — so the
**`files` index is complete for all 40 captures** (name, bytes, SHA-256) and
that is what the pair comparison above uses, while the richer `targets` array
retains entries only for the two targets captured after the fix. Nothing was
lost that the evidence depends on, and the flaw cannot recur.

---

# Related documents

- `docs/RELEASE_READINESS.md` — Stage 2 gate 6
- `.ai/12_DECISIONS.md` — ADR-P022 and Addendum A; ADR-P032 (Web boundary);
  ADR-P027 (onboarding checklist); ADR-P030 (conflict resolution)
- `.ai/11_BACKLOG.md` — `OBS-T1`, `BUG-017`, `OBS-T2-1 … OBS-T2-4`
- `mobile/src/shared/theme/contrast.spec.ts` — the computed palette gate
- `mobile/src/shared/theme/colors.ts` — the token values measured above
- `mobile/e2e/README.md` — the harnesses and the staging flow
