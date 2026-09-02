# AppFitness Screen State Matrices (V1)

Version: 1.9
Status: Active
Last Updated: 2026-09-02

---

# Purpose

This document binds every **state-bearing** V1 surface — each actual screen and
each independently stateful embedded surface — to the exact subset of the eight
canonical states it can enter, with the trigger, the source state that produces
it, the treatment that renders, the exit condition, platform scope, and
code/test/localization evidence.

It is the **UX-3B** slice of the FEATURE-010 UX stream. It specifies nothing new.
Where runtime and documentation disagreed, the disagreement is recorded in
§Findings, and only the disagreements that are documentation errors were
reconciled.

## What this document is not

- **Not a state model.** The eight canonical states are fixed by
  `.ai/08_UI_UX.md` §Canonical State Patterns (authorized by ADR-P022
  Decision 15). This document introduces no ninth state and redefines none.
- **Not a component contract.** Anatomy, variants, props, tokens and test hooks
  live in `.ai/08_UI_UX.md` §State Component Contracts (UX-1B2A). Visual
  treatment is referenced here only as *which shipped component renders*, never
  restated.
- **Not copy.** EN/ES copy decks are delivered separately in
  `.ai/19_COPY_DECKS.md` (**UX-3C**).
- **Not an accessibility certification.** No outcome here is verified; see
  §Accessibility scope.
- **Not implementation.** Nothing here authorizes a code, localization,
  dependency, asset or test change.

---

# Evidence baseline

Every claim below was verified by read-only inspection of `origin/main` at
commit `fb02097593ff9a2735f54620d6350d880cf3a030` (the ADR-P027 merge).

Inspected: `mobile/src/app/` (15 files — 14 user-facing routes plus
`_layout.tsx`), the `dashboard`, `workout`, `nutrition` and `progress` feature
slices in full (`presentation/`, `application/`, `domain/`, `infrastructure/`),
their co-located `*.spec.tsx` suites, `mobile/src/shared/presentation/banner.tsx`,
and `mobile/src/shared/localization/resources/{en,es}.ts`.

Counts reproducible at this commit:

| Observation | Count |
|---|---|
| Localization keys, EN / ES | **696 / 696** — exact parity |
| `*webUnavailable*` keys | **23** |
| `*.gap.*` keys | **37** (19 `dashboard.gap.*` + 18 `nutrition.gap.*`) |
| `dashboard.sync.*` keys | **16** |
| Keys containing `offline` | **4** — two title/message pairs only |
| Keys containing `pending` | **10** |
| Keys containing `conflict` | **5** |
| Keys containing `[Rr]etry` | **0** — no retry affordance exists anywhere |
| Presentation files branching on `status === 'web-unavailable'` | **12** |
| Specs asserting Web-unavailable behaviour | **19** |
| Route files importing `DashboardSkeleton` as their session loader | **12** |
| Stores that call `runSync` | **2** — `dashboard.store.ts`, `food-log.store.ts` |
| `accessibilityLiveRegion` / `announceForAccessibility` occurrences | **0** |

---

# How to read a matrix

Each surface below carries one matrix. Columns are fixed:

| Column | Meaning |
|---|---|
| **State** | One of the eight canonical names, verbatim. Nothing else appears in this column. |
| **Trigger — source state** | The concrete condition, named against the store field or prop that produces it. |
| **Rendered treatment** | The shipped component or element that renders, and its scope (full-screen / banner / card-local / row-level). |
| **Exit** | The user action or system event that leaves the state. |
| **Platform** | Native, Web, or Both. |
| **Evidence** | File and line, spec title, and localization key family. |
| **Status** | See the taxonomy below. |

## Status taxonomy

Exactly four values. They are not interchangeable, and each is a claim about
evidence.

| Value | Meaning |
|---|---|
| **SHIPPED** | The treatment exists on `origin/main` and is cited. |
| **SHIPPED — non-conformant** | The treatment exists but violates a rule the state model already fixes. The governing rule and the owning bug are named. |
| **PROPOSED** | The state is **applicable** to this surface — the source state exists and reaches the surface — but no treatment is implemented. Every PROPOSED row names an **explicit backlog owner**. |
| **n/a** | The state is **genuinely not applicable**: the surface's data source cannot produce the condition. A justification is given in the row. |

**`n/a` is never a euphemism for a gap.** A state that is applicable and missing
is **PROPOSED with an owner**, never `n/a`.

**Applicability is proven, not assumed.** A surface can enter a canonical state
only where an **authoritative source for that state is exposed to it at the
audited commit**. Concretely: **Pending sync** requires accessible queued-write
state; **Offline** requires an authoritative connectivity or sync signal. Neither
may be inferred from the *kind* of surface — not from "it is a screen", and not
from "it is read-only". An embedded card likewise does **not** inherit its parent
screen's sync states.

Where this document records Offline as not applicable, it is recording **what the
surface receives today**, at `fb02097` — not a claim that it could never receive
such a signal. Wiring one in is a design change, and the record would change with
it.

## Scope of each canonical name in this document

The eight names are used exactly as `.ai/08_UI_UX.md` defines them. Two
boundaries matter most here and are applied consistently:

- **Empty** = the read **succeeded** and a collection is genuinely empty.
- **Data-gap** = a prerequisite input is missing, so output **cannot be
  computed**; it names the input and routes to the screen that owns it.

## What is deliberately not a canonical state

These appear in the runtime and are classified here so no future slice mistakes
them for a ninth state:

| Runtime thing | Correct classification |
|---|---|
| **`Ready` / `Synced` success banner** (`dashboard.sync.readyTitle`, `nutrition.log.syncedTitle`, tone `success`) | A **sync-status confirmation**, not a canonical state. `.ai/08_UI_UX.md` records success confirmation as a future need with insufficient evidence and defines **no** contract for it. It is the default arm of a sync banner, not a state a surface enters. |
| **Route-level session gate** (`status === 'unknown'` → `DashboardSkeleton`) | A **session-resolution phase** that happens *before* a screen mounts. See §Cross-cutting. |
| **`status === 'saving'`** (profile, goal, progress, workout, dietary preferences) | A **transient write sub-phase**, surfaced as a button `loading` prop. Not Loading — no read is in flight and the surface keeps rendering its data. |
| **Ordinary forms and content** (`FoodLogAddForm`, `BodyWeightForm`, day selectors, meal cards) | Ordinary content. Not a state. |
| **Validation errors on a form field** | Field-level validation, governed by ADR-P023 / ADR-P024. Not the canonical **Error** state, which is an operation failure. |
| **`__DEV__` sample-data action** in `DataGapCard` | Not a user-facing affordance at all: gated by `__DEV__` in both the component (`data-gap-card.tsx:73`) and the store (`dashboard.store.ts:85`). It must not be specified as product behaviour. |

---

# Cross-cutting — the session-resolution phase

**Not a state-bearing surface, and not counted as one.** It is documented here
because it renders the Loading *treatment* without being a Loading *state*, and
because it is the reason `DashboardSkeleton` reaches almost every route.

`mobile/src/app/dashboard.tsx` and eleven sibling routes resolve the session
*before* mounting a screen. At that point no screen read has started, so none of
the eight states applies.

| Phase | Trigger — source state | Rendered treatment | Exit | Platform |
|---|---|---|---|---|
| Session resolving | `useSession().status === 'unknown'` | `<Screen><DashboardSkeleton /></Screen>` | Session resolves | Both |
| Unauthenticated | `status !== 'authenticated'` | `<Redirect href="/sign-in" />` | — | Both |
| Authenticated | `status === 'authenticated'` | Mounts the screen | — | Both |

**Evidence:** `mobile/src/app/dashboard.tsx:11-26`; the identical gate in
`workout-log.tsx`, `nutrition.tsx`, `nutrition-plan.tsx`, `food-log.tsx`,
`dietary-preferences.tsx`, `progress.tsx`; **12** route files import
`DashboardSkeleton`.

Because this phase reaches 12 routes, a defect in `DashboardSkeleton` is a
product-wide defect rather than a dashboard one — which is why **BUG-010** is
scoped that way.

---

# Surface inventory

**Ten state-bearing surfaces: seven feature screens plus three independently
stateful embedded surfaces.** The embedded three are counted separately because
each resolves its own source state; the route gate above is **not** counted,
because it enters none of the eight states.

| # | Surface | Kind | Owning state source |
|---|---|---|---|
| 1 | Dashboard screen | Feature screen | `useDashboardStore` |
| 2 | Sync status banner | Embedded, single-slot banner | `data.sync` (`SyncSummary`) |
| 3 | Data-gap card | Embedded card | `data.missing` |
| 4 | Progress summary card | Embedded card, **own store** | `useProgressStore` |
| 5 | Workout Log | Feature screen | `useWorkoutStore` |
| 6 | Nutrition Targets | Feature screen | `useDashboardStore` (**shared**) |
| 7 | Nutrition Plan | Feature screen | `useDashboardStore` + `useDietaryPreferenceStore` |
| 8 | Food Log | Feature screen | `useFoodLogStore` (+ preference store) |
| 9 | Dietary Preferences | Feature screen | `useDietaryPreferenceStore` |
| 10 | Progress | Feature screen | `useProgressStore` |

**Food Log's sync banner and per-item chips are treatments inside surface 8**,
not a separately counted surface: they read the same `useFoodLogStore` the screen
does. The three counted embedded surfaces each read a source the parent screen
does not own — `data.sync`, `data.missing`, and a second store respectively.

**Architectural fact worth stating once:** Nutrition Targets and Nutrition Plan
do **not** own a nutrition store. Both read `useDashboardStore`
(`NutritionTargets.tsx:61`, `NutritionPlanScreen.tsx:211`), so their Loading,
Error, Data-gap and Web-unavailable states are the *dashboard's* states rendered
under a different heading. Anything that changes dashboard load behaviour changes
all three.

---

# 1 — Dashboard screen

**File:** `mobile/src/features/dashboard/presentation/DashboardScreen.tsx` (182
lines). **Store:** `useDashboardStore`, status union
`'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'web-unavailable'`
(`dashboard.types.ts:5`). **Status: SHIPPED.**

**Composition note.** The dashboard is **not** a single exclusive-state surface.
The header, the `ProgressSummaryCard` and the eight navigation/account buttons
render on **every** branch, including Loading and Web unavailable. Only the
skeleton, the banners and the assessment/gap content swap. Any UX-3C copy or
UX-4 layout work must treat dashboard states as **stacked regions**, not as
full-screen takeovers.

| State | Trigger — source state | Rendered treatment | Exit | Platform | Evidence | Status |
|---|---|---|---|---|---|---|
| **Loading** | `status === 'loading'` or `'idle'` | `<DashboardSkeleton />` — three placeholder `Card`s, **above** the always-rendered navigation | `refresh()` resolves | Both | `DashboardScreen.tsx:51`; spec *"refreshes on mount and renders the loading skeleton"* | SHIPPED |
| **Data-gap** | `status === 'empty'` — the read succeeded but `data.assessment` is `null` because prerequisites are missing | `<OnboardingChecklistCard gaps={data.missing} />` (UX-4B) — card-local, the five gap ids grouped into three named steps, each with a routing button, above a "{completed} of {total} complete" line. Advisory: nothing here gates any surface | User supplies the named input on the owning screen | Both | `dashboard.store.ts:19`; spec *"renders the first-run checklist and dev sample action on the empty state"*; `dashboard.onboarding.*` (7 keys) + `dashboard.gap.*` (19 keys) | SHIPPED |
| **Data-gap** (second site) | `status === 'ready'` **and** `data.missing.length > 0` — an assessment exists but notes remain | Second `<DataGapCard>` below the assessment summary | Same | Both | `DashboardScreen.tsx:96-98` | SHIPPED |
| **Error** | `error !== null` (set with `status === 'error'` by `refresh()` or `loadSampleData()`) | `<Banner tone="error">`, `dashboard.unavailable` / `dashboard.errorMessage`. **No retry control** — zero retry keys exist | Next successful `refresh()` | Both | `DashboardScreen.tsx:53-57`; `dashboard.store.ts:29`; spec *"surfaces dashboard and sync error states with safe copy"* | SHIPPED |
| **Web unavailable** | `status === 'web-unavailable'` — `isDatabaseUnsupportedOnWebError` on load (ADR-P019) | `<Banner tone="info">`, `dashboard.webUnavailableTitle/Body`. Not logged, not retried, no fabricated data | **None** — terminal for the data region | **Web only** | `DashboardScreen.tsx:60-66` and its inline ADR-P019 comment; `dashboard.store.ts:21-27`; specs *"renders a distinct web-unavailable state in English with no retry or fabricated data (ADR-P019)"*, *"…in Spanish"* | SHIPPED |
| **Offline** | Rendered by the embedded sync status banner — surface 2 | Banner, `warning` | Connectivity returns and the user syncs again | Native | Surface 2 | SHIPPED |
| **Pending sync** | Surface 2 | Banner, `info`, with counts | Queue drains | Native | Surface 2 | SHIPPED |
| **Conflict** | Surface 2 | Banner, `warning`, with count | Explicit user decision — **no resolution UI exists**, see BUG-012 | Native | Surface 2 | SHIPPED |
| **Empty** | — | — | — | — | The dashboard renders no user-owned collection: there is nothing that can *succeed and be empty*. A missing assessment is Data-gap, not Empty | **n/a** |

**Canonical-state count: seven of eight.** Counting the complete dashboard
composition — including the embedded sync banner and data-gap card, which are the
treatments that carry its sync and prerequisite states — the dashboard renders
Loading, Data-gap, Error, Offline, Pending sync, Conflict and Web unavailable.
**Empty is the only absent state.** This is the count now applied consistently
across `.ai/17_PRODUCT_FLOWS.md` §Flow 3 / §Flow 4 and **ADR-P027** Decision 3;
see **C-6**.

**Naming note.** The store's `'empty'` status is a **Data-gap**, not canonical
Empty. It is set when the assessment cannot be computed
(`dashboard.store.ts:19`), and it renders `DataGapCard`. The behaviour is
correct; only the identifier is misleading. Renaming it is runtime work and is
out of UX-3B scope.

---

# 2 — Sync status banner (embedded)

**File:**
`mobile/src/features/dashboard/presentation/components/sync-status-banner.tsx`
(53 lines). **Source:** `data.sync: SyncSummary`. **Status: SHIPPED.**
Native-relevant only — it renders only when `data` is non-null, and `data` is
always `null` on Web.

This is a **single-slot** banner: exactly one arm renders, chosen by a fixed
priority. That priority is a specification-relevant behaviour, not an
implementation detail, because it decides which state a user is allowed to see.

**Priority, highest first:** `syncing` → `offline` → sync `error` →
`conflicts > 0` → `pending > 0 || failed > 0` → **ready** (default).

| State | Trigger — source state | Rendered treatment | Exit | Platform | Evidence | Status |
|---|---|---|---|---|---|---|
| **Offline** | `sync.status === 'offline'` | `<Banner tone="warning">`, `dashboard.sync.offlineTitle/Message` | A later sync returning `success` | Native | `sync-status-banner.tsx:18-23`; specs *"prioritizes active sync and offline status messages"*, *"localizes offline and counted states in Spanish"* | SHIPPED |
| **Pending sync** | `sync.pending > 0` or `sync.failed > 0`, and nothing above it in the priority order | `<Banner tone="info">` with pending and failed counts, one/many pluralized | Queue drains | Native | `sync-status-banner.tsx:37-46`; spec *"shows conflict and pending summaries"* | SHIPPED |
| **Conflict** | `sync.conflicts > 0`, and nothing above it | `<Banner tone="warning">` with the conflict count — conformant tone | An explicit user decision — **no resolution surface exists in V1**, see BUG-012 | Native | `sync-status-banner.tsx:30-36`; `dashboard.service.ts:36` | SHIPPED |
| **Error** | `sync.status === 'error'` | `<Banner tone="error">`, `dashboard.sync.errorTitle/Message`. The store's raw message is never rendered | Next successful sync | Native | `sync-status-banner.tsx:24-29`; spec *"shows a safe generic error message"* | SHIPPED |
| **Loading** | — | — | — | — | The banner performs no read of its own; it summarizes data the screen already resolved | **n/a** |
| **Empty** | — | — | — | — | It summarizes counters, not a collection | **n/a** |
| **Data-gap** | — | — | — | — | It computes nothing from user prerequisites | **n/a** |
| **Web unavailable** | — | — | — | — | It never mounts on Web: `data` is `null` there, and the screen renders the banner only when `data` is non-null | **n/a** |

Two arms are **not canonical states**: `syncing` (`sync-status-banner.tsx:12-17`)
is a transient sub-phase of an explicit user action, and `ready`
(`:48-52`, tone `success`) is a success confirmation.

**Two behaviours UX-3C must specify around, not assume away:**

1. **Offline is not reachable on load.** `buildSyncSummary()` hard-codes
   `status: 'idle'` (`dashboard.service.ts:89`). `'offline'` is assigned only
   inside `syncNow()` (`dashboard.store.ts:52-57`). A user who opens the app with
   no connectivity sees the **ready** banner until they press *Sync now*.
   Pending sync and Conflict, by contrast, **are** derived on load from queue
   counts and conflict rows, so those two do appear passively.
2. **Higher-priority arms mask Conflict.** While `syncing`, `offline` or sync
   `error` is showing, an unresolved conflict is not displayed at all. Given that
   Conflict is the state the state model most insists must never be collapsed,
   this ordering is a copy and specification risk.

---

# 3 — Data-gap card (embedded)

**File:** `mobile/src/features/dashboard/presentation/components/data-gap-card.tsx`
(85 lines). **Source:** `data.missing: DataRequirement[]` plus a `resolveFix`
mapper supplied by the screen. **Status: SHIPPED.**

| State | Trigger — source state | Rendered treatment | Exit | Platform | Evidence | Status |
|---|---|---|---|---|---|---|
| **Data-gap** | Rendered by the dashboard whenever `data.missing` is non-empty, or the assessment is absent | `<Card>` with a title, description, and **one named row per gap** — label, detail, and a routing button when the gap is addressable | The user completes the named input on the owning screen | Both (mounted on native only, since `data` is `null` on Web) | `data-gap-card.tsx:41-84`; `DashboardScreen.tsx:24-32`; specs *"deep-links a profile data gap to the profile edit screen"*, *"…the weight data gap to the wellness progress screen"*, *"…the default-goal assessment note to the goal edit screen"*; `testID` `gap-fix-{id}` | SHIPPED |
| **Loading / Empty / Error / Offline / Pending sync / Conflict / Web unavailable** | — | — | — | — | The card is a pure projection of a prop. It performs no read, owns no collection, has no failure path, initiates no sync, holds no row-level `syncStatus`, and never mounts on Web | **n/a** |

**Routing map** (`DashboardScreen.tsx:24-32`) — the card never hard-codes it:

| Gap id | Routes to |
|---|---|
| `profile`, `birth-date`, `height` | `/profile-edit` |
| `default-goal` | `/goal-edit` |
| `weight` | `/progress` |

`GAP_COPY` additionally carries `default-sex` (`data-gap-card.tsx:33-36`), which
has **no** entry in `resolveGapFix`. If that gap is ever emitted it renders with
copy but **no action button** — a silent dead end. Recorded, not fixed.

---

# 4 — Progress summary card (embedded, own store)

**File:** `mobile/src/features/progress/presentation/ProgressSummaryCard.tsx`
(107 lines). **Store:** `useProgressStore` — **its own**, loaded on mount
independently of the dashboard store. **Status: SHIPPED.**

This is the clearest case of an embedded surface with independent state: it sits
inside the dashboard but resolves its own read, and can therefore be Loading
while the dashboard is ready, or Web-unavailable in its own compact shape.

| State | Trigger — source state | Rendered treatment | Exit | Platform | Evidence | Status |
|---|---|---|---|---|---|---|
| **Loading** | `status === 'loading'` or `'idle'` | `progress.card.loading` muted text inside the card; the card stays pressable | `load()` resolves | Both | `ProgressSummaryCard.tsx:67-68` | SHIPPED — no spec asserts it |
| **Empty** | Read succeeded, `bodyWeights[0]` absent → `progress.card.noWeight` in the headline slot; separately `snapshots[0]` absent → `progress.card.prompt` | Two independent card-local empties in one card | User records a first weigh-in / first workout week | Both | `ProgressSummaryCard.tsx:72-101`; specs *"renders the empty prompt when nothing is recorded"*, *"renders the Spanish empty prompt when nothing is recorded"* | SHIPPED |
| **Web unavailable** | `status === 'web-unavailable'` | A **distinct compact card variant**: `progress.card.label` + `progress.webUnavailableCard`, and the `Pressable` wrapper is **removed**, so the tap-to-open affordance does not exist | **None** — terminal | **Web only** | `ProgressSummaryCard.tsx:41-52`; specs *"renders a compact web-unavailable state in English with no metrics, prompt, or tap affordance (ADR-P019)"*, *"…in Spanish"* | SHIPPED |
| **Error** | `status === 'error'` — the union includes it (`progress.store.ts:47`) and the card's own read can fail | Distinct in-card treatment: `progress.card.errorTitle` in `tone="error"` plus a muted `progress.card.errorBody` caption. **No retry control**, and the card **stays pressable** — as it does while Loading — so the owning Progress screen, which reports the failure properly, is one tap away | Next successful load | Both | `ProgressSummaryCard.tsx:71-84`; specs *"renders a failed read as Error, never as \"nothing recorded\" (BUG-009)"*, *"keeps the card pressable in Error so the owning screen is reachable (BUG-009)"*, *"offers no retry control on the card in Error (BUG-009)"*, *"…in Spanish (BUG-009)"* | SHIPPED |
| **Data-gap** | — | — | — | — | The card displays recorded values; it computes nothing, so no prerequisite can be missing | **n/a** |
| **Offline** | — | — | — | — | **No Offline signal reaches this surface at `fb02097`.** `useProgressStore` receives no connectivity or sync outcome; the only two stores that obtain one are `dashboard.store.ts` and `food-log.store.ts`. This records what the card receives today, not a limit on what it could be given | **n/a** |
| **Pending sync / Conflict** | — | — | — | — | The card renders two aggregate values — a latest weight and a latest weekly snapshot — not the rows that carry `syncStatus`. Row-level sync state belongs to the surface that lists the rows, which is surface 10. An embedded preview does not duplicate its parent's or its sibling's row state | **n/a** |

---

# 5 — Workout Log

**File:** `mobile/src/features/workout/presentation/WorkoutLogScreen.tsx` (518
lines). **Store:** `useWorkoutStore`, status union
`'idle' | 'loading' | 'ready' | 'saving' | 'error' | 'web-unavailable'`
(`workout.store.ts:50`). **Status: SHIPPED.** Native-first; Web is terminal.

**Composition note.** Only Web unavailable is full-screen. Error is a banner that
coexists with the whole working surface, and Loading and Empty are **section
local** — the "start a workout" card renders regardless.

| State | Trigger — source state | Rendered treatment | Exit | Platform | Evidence | Status |
|---|---|---|---|---|---|---|
| **Web unavailable** | `status === 'web-unavailable'` | **Full-screen early return**: heading + `<Banner tone="info">`, `workout.log.webUnavailableTitle/Body`. No forms, data, editing controls or retry | **None** — terminal | **Web only** | `WorkoutLogScreen.tsx:117-131` and its ADR-P019 comment; specs *"renders a distinct web-unavailable state in English with no error copy or controls (ADR-P019)"*, *"…in Spanish"* | SHIPPED |
| **Loading** | `initialLoading = status === 'loading' && workoutLogs.length === 0` | `workout.log.loading` text, **scoped to the open-workouts section only** | `load()` resolves | Native | `WorkoutLogScreen.tsx:78`, `:196-199` | SHIPPED |
| **Empty** — open workouts | Read succeeded, `openLogs.length === 0` | `workout.log.openEmpty` muted text | User starts a workout | Native | `WorkoutLogScreen.tsx:200-201`; spec *"shows an empty message when there are no open workouts"* | SHIPPED |
| **Empty** — custom exercises | No custom exercises exist | `workout.log.customEmpty` muted text inside the set picker | User quick-creates a custom exercise | Native | `WorkoutLogScreen.tsx:323` | SHIPPED |
| **Empty** — sets | Selected workout has no sets | `workout.log.setsEmpty` muted text | User adds a set | Native | `WorkoutLogScreen.tsx:457` | SHIPPED |
| **Error** | `error !== null` — covers both the load failure and every write failure | `<Banner tone="error">`, `workout.log.errorTitle/Message`, above the working surface. No retry control | Next successful operation clears `error` | Native | `WorkoutLogScreen.tsx:140-144`; spec *"surfaces a safe error banner"* | SHIPPED |
| **Pending sync** — set rows | `set.syncStatus === 'pending'` | `PendingHint` component, **row-level** caption, `workout.log.syncPending` + `syncPendingAccessibility` | The queue drains and the row re-reads as `synced` | Native | `WorkoutLogScreen.tsx:32-43`; spec *"surfaces a pending-sync hint on locally-saved sets"* | SHIPPED |
| **Pending sync** — workout rows | `log.syncStatus === 'pending'` | Inline caption, `workout.log.savedOnDevice` + `savedAccessibility` | Same | Native | `WorkoutLogScreen.tsx:210-217` | SHIPPED |
| **Conflict** | `log.syncStatus === 'conflict'` or `set.syncStatus === 'conflict'` — `SyncStatus` is `'pending' \| 'synced' \| 'conflict'` (`database/types.ts:11`), the rows expose it (`workout.ts:57`, `:111`), and the sync appliers set it | `ConflictHint` component, **row-level** caption with `tone="warning"`, `workout.log.syncConflict` + `syncConflictAccessibility`, on **both** workout rows and set rows. **Report-only** — no choose action | **None on this surface** — no resolution UI exists anywhere, see BUG-012 | Native | `WorkoutLogScreen.tsx:55-67`, `:242`, `:497`; `workout/infrastructure/sync-appliers.ts:47`, `:59`; specs *"surfaces a conflict hint on a diverged workout row (BUG-011)"*, *"…on a diverged set row (BUG-011)"*, *"reports the conflict without offering a resolution (BUG-012 stays open)"* — the first two assert the rendered `warning` colour | SHIPPED |
| **Offline** | — | — | — | — | **No Offline signal reaches this surface at `fb02097`.** `useWorkoutStore` receives no connectivity or sync outcome, so there is nothing authoritative to render; today Offline is reported only on surfaces 1 and 8. This records what the screen receives, not a limit on what it could be given | **n/a** |
| **Data-gap** | — | — | — | — | Workout logging computes nothing from profile prerequisites; a user with an empty profile can still log | **n/a** |

**Three section-local surfaces** live inside this screen and are the reason
"Workout Log" is one screen with three Empty rows rather than three screens: the
open-workouts list, the exercise picker (built-in plus custom), and the
per-workout set list. Each has its own Empty; none has its own Loading or Error.

---

# 6 — Nutrition Targets (`/nutrition`)

**File:** `mobile/src/features/nutrition/presentation/NutritionTargets.tsx` (174
lines). **Store:** `useDashboardStore` — **shared with the dashboard**.
**Status: SHIPPED.** This is the reference Data-gap implementation in the
product.

| State | Trigger — source state | Rendered treatment | Exit | Platform | Evidence | Status |
|---|---|---|---|---|---|---|
| **Web unavailable** | `status === 'web-unavailable'` | **Full-screen early return**: heading + `<Banner tone="info">`, `nutrition.targets.webUnavailableTitle/Body`. No targets, data-gap, error or navigation | **None** — terminal | **Web only** | `NutritionTargets.tsx:69-82`; specs *"…with no data, gap, error, or controls (ADR-P019)"*, *"…in Spanish"* | SHIPPED |
| **Loading** | `status === 'loading'` or `'idle'` | `nutrition.plan.loading` text in the content slot, below the persistent heading | `refresh()` resolves | Both | `NutritionTargets.tsx:92-95`; spec *"renders a loading state"* | SHIPPED |
| **Error** | `error !== null` | `<Banner tone="error">`, `nutrition.targets.unavailable` / `errorMessage`. No retry | Next successful refresh | Both | `NutritionTargets.tsx:96-99`; spec *"surfaces a safe error banner"* | SHIPPED |
| **Data-gap** | Read succeeded and `assessment` is absent — targets are **computed**, so a missing prerequisite makes output underivable | `<NutritionDataGap missing={data.missing} context="targets" />` — groups gaps into profile-side and weight-side, each with its own routing button; falls back to a dashboard button when no specific gap is known | User supplies the named input on `/profile-edit` or `/progress` | Both | `NutritionTargets.tsx:100-101`; `NutritionDataGap.tsx:49-110`; specs *"shows a data-gap state and falls back to the dashboard when no specific gaps are known"*, *"offers direct actions for the specific baseline gaps (profile + weight)"*; `testID`s `nutrition-gap-profile`, `nutrition-gap-weight`, `nutrition-gap-dashboard`; `nutrition.gap.*` (18 keys) | SHIPPED |
| **Empty** | — | — | — | — | Targets are computed values, not a collection. The absence of inputs is Data-gap; there is no state in which the read succeeds and the result is legitimately empty | **n/a** |
| **Offline** | — | — | — | — | **No Offline signal reaches this surface at `fb02097`.** The shared dashboard store exposes its sync summary to the dashboard, not to this screen, so no authoritative connectivity signal is available here today | **n/a** |
| **Pending sync / Conflict** | — | — | — | — | No queued-write state is exposed here: this screen performs no local write, enqueues nothing, and renders no row carrying a `syncStatus`. The judgement is about what reaches *this* screen, not about projections in general | **n/a** |

---

# 7 — Nutrition Plan (`/nutrition-plan`)

**File:** `mobile/src/features/nutrition/presentation/NutritionPlanScreen.tsx`
(298 lines). **Stores:** `useDashboardStore` **and** `useDietaryPreferenceStore`.
**Status: SHIPPED.**

This surface composes **two** stores, so several of its states have two possible
sources. That is specification-relevant: the same rendered state can mean two
different things.

| State | Trigger — source state | Rendered treatment | Exit | Platform | Evidence | Status |
|---|---|---|---|---|---|---|
| **Web unavailable** | `status === 'web-unavailable'` **or** `prefStatus === 'web-unavailable'` — either store proves the local database is unreachable | **Full-screen early return**: heading + `<Banner tone="info">`, `nutrition.plan.webUnavailableTitle/Body`. No plan, day controls, food-log link, data-gap or error | **None** — terminal | **Web only** | `NutritionPlanScreen.tsx:237-249` and its ADR-P019 comment; specs *"…with no plan, gap, error, or controls (ADR-P019)"*, *"degrades to web-unavailable when the dietary-preference store is web-unavailable (ADR-P019)"*, *"…in Spanish"* | SHIPPED |
| **Loading** | `status === 'loading'` or `'idle'`, **or** `preferencesLoading` (`prefStatus === 'idle'` or `'loading'`) | `nutrition.plan.loading` text. Both reads must settle so the first rendered plan already reflects exclusions | Both reads resolve | Both | `NutritionPlanScreen.tsx:233`, `:267-270`; specs *"renders a loading state"*, *"shows the loading state until preferences finish loading"* | SHIPPED |
| **Error** — assessment | `error !== null` on the dashboard store | `<Banner tone="error">`, `nutrition.plan.unavailable` / `errorMessage` | Next successful refresh | Both | `NutritionPlanScreen.tsx:271-274`; spec *"surfaces a dashboard error"* | SHIPPED |
| **Error** — generation | `selection.status === 'error'` from `selectMealPlan` | Same banner and copy as above — the two causes are **visually indistinguishable** | Same | Both | `NutritionPlanScreen.tsx:275-278`; spec *"surfaces a meal-plan generation error"* | SHIPPED |
| **Data-gap** | `selection.status === 'gap'` | `<NutritionDataGap missing={data.missing} context="plan" />` — same component as Targets, with a plan-specific suffix | User supplies the named input | Both | `NutritionPlanScreen.tsx:279-280`; `NutritionDataGap.tsx:60-61`; specs *"shows a data-gap state and falls back to the dashboard…"*, *"offers direct actions for the specific baseline gaps (profile + weight)"* | SHIPPED |
| **Empty** | — | — | — | — | The plan is generated, and generates all its days or none. A non-generating plan is Data-gap or Error | **n/a** |
| **Offline** | — | — | — | — | **No Offline signal reaches this surface at `fb02097`.** Neither store it reads exposes a connectivity or sync outcome to this screen today | **n/a** |
| **Pending sync / Conflict** | — | — | — | — | No queued-write state is exposed here: this screen writes nothing, and lists no row carrying a `syncStatus` — the preference rows it consumes feed exclusion logic and are never rendered as rows. The judgement is about what reaches *this* screen | **n/a** |

**Degradation rule worth preserving.** A *failed* preference load does **not**
block the plan: `selectMealPlan` receives an empty exclusion list and the plan
renders with no exclusions (`NutritionPlanScreen.tsx:225`; spec *"still renders
the plan (with no exclusions) when preference loading fails"*). Only
*web-unavailable* preferences are terminal. UX-3C copy must not imply exclusions
were applied when the preference read failed.

---

# 8 — Food Log (`/food-log`)

**File:** `mobile/src/features/nutrition/presentation/FoodLogScreen.tsx` (330
lines). **Stores:** `useFoodLogStore`, plus `useDietaryPreferenceStore` and
`useDashboardStore` for target comparison. **Status: SHIPPED.**
Two status unions: `FoodLogUiStatus` (`food-log.store.ts:24`) for the read, and
`FoodLogSyncSummary.state` (`food-log.store.ts:26`) for sync.

**Composition note.** The sync banner and the per-item chips are **treatments
within this surface**, not a separate one: both read `useFoodLogStore`. The
banner renders **above** and independently of the content slot, so Food Log can
be simultaneously Loading in its content and Pending sync in its banner. This is
the richest state surface after the dashboard.

| State | Trigger — source state | Rendered treatment | Exit | Platform | Evidence | Status |
|---|---|---|---|---|---|---|
| **Web unavailable** | `status === 'web-unavailable'` **or** `prefStatus === 'web-unavailable'` | **Full-screen early return**: heading + `<Banner tone="info">`. No sync banner, add form, entries, sync control or write controls | **None** — terminal | **Web only** | `FoodLogScreen.tsx:259-273`; specs *"…with no sync, form, entries, or controls (ADR-P019)"*, *"degrades to web-unavailable when the dietary-preference store is web-unavailable (ADR-P019)"*, *"…in Spanish"* | SHIPPED |
| **Loading** | `status === 'loading'` or `'idle'` | `nutrition.log.loading` text in the content slot | `load()` resolves | Both | `FoodLogScreen.tsx:282-285`; spec *"renders a loading state"* | SHIPPED |
| **Empty** | Read succeeded, no items logged for the selected day | `<Card>` with `nutrition.log.emptyTitle` / `emptyMessage` | User logs the first item | Native | `FoodLogScreen.tsx:296-302`; spec *"renders the empty state when nothing is logged"* | SHIPPED |
| **Error** — load | `status === 'error'`, set **only** by `load()` | `<Banner tone="error">`, `nutrition.log.unavailable` / `errorMessage` | Next successful load | Both | `FoodLogScreen.tsx:286-289`; spec *"surfaces a load error"* | SHIPPED |
| **Error** — writes | `writeError` set to `add` / `servings` / `remove` by the write that failed | A **separate** `<Banner tone="error">` per operation — `nutrition.log.writeError.{add,servings,remove}{Title,Body}` — rendered **alongside** the log, which is not cleared | The next write attempt, or the next successful read | Native | `food-log.store.ts:30`, `:48`, `:129-160`; `FoodLogScreen.tsx:88-112`, `:321`; specs *"reports a failed add without hiding the log (BUG-008)"*, *"reports a failed serving change (BUG-008)"*, *"reports a failed removal and says the food is still logged (BUG-008)"*, *"localizes the write-failure banner in Spanish (BUG-008)"* | SHIPPED |
| **Error** — sync | `sync.state === 'error'` | `<Banner tone="error">`, `nutrition.log.syncErrorTitle/Message` | Next successful sync | Native | `FoodLogScreen.tsx:52-56` | SHIPPED |
| **Offline** | `sync.state === 'offline'` — set only by an explicit `syncNow()` | `<Banner tone="warning">`, `nutrition.log.offlineTitle/Message` | A later successful sync | Native | `FoodLogScreen.tsx:34-40`; `food-log.store.ts:163-164` | SHIPPED |
| **Pending sync** — banner | `sync.state === 'pending'`, derived on load from item states | `<Banner tone="info">` with a pending count, one/many pluralized | Queue drains | Native | `FoodLogScreen.tsx:57-68`; `food-log.store.ts:66-68`; spec *"shows a sync-pending banner and a per-item pending chip"* | SHIPPED |
| **Pending sync** — row chip | `item.syncState === 'pending'` | `ItemSyncChip`, muted caption, `nutrition.log.pendingShort` + `pendingAccessibility` | Same | Native | `FoodLogScreen.tsx:88-98` | SHIPPED |
| **Error** — catalog incompatibility | `item.syncState === 'action_required'`, i.e. the row is marked **and** its queue op is parked with `CATALOG_REVISION_UNSUPPORTED` | `<Banner tone="error">` plus a row chip with `tone="error"`, `nutrition.log.action*` — the food is not on the server, so the user is told to remove and re-add it | The user removing and re-adding the food | Native | `food-log.repository.ts:205-215`, `:389`; `FoodLogScreen.tsx:45-58`, `:132-144`; spec *"shows an action-required (failed) banner when a food is unsupported server-side"*, which also asserts the `error` colour | SHIPPED |
| **Conflict** | `item.syncState === 'conflict'`, i.e. `sync_status = 'conflict'` (`food-log.repository.ts:266`) with **no** parked catalog op | `<Banner tone="warning">` plus a row chip with `tone="warning"`, `nutrition.log.conflict*`. **Report-only**: both versions are preserved and no resolution is offered | **None on this surface** — no resolution UI exists anywhere, see BUG-012 | Native | `food-log.repository.ts:389`; `food-log.ts:26-45`; `FoodLogScreen.tsx:59-72`, `:146-158`; specs *"renders a sync conflict as warning, not error (BUG-007)"*, *"gives the conflict row chip its own label and warning tone (BUG-007)"*, *"reports the conflict without offering a resolution (BUG-012 stays open)"* | SHIPPED |
| **Data-gap** | — | — | — | — | Logging never blocks on a missing prerequisite. Targets shown for comparison come from the dashboard store and simply do not render when absent | **n/a** |

**Sync banner priority** (`FoodLogScreen.tsx:26-73`), highest first: `syncing` →
`offline` → `action_required` → sync `error` → `pending` → **synced** (default,
tone `success`, not a canonical state). As on the dashboard, the
conflict-derived arm is masked by `syncing` and `offline`.

---

# 9 — Dietary Preferences (`/dietary-preferences`)

**File:** `mobile/src/features/nutrition/presentation/DietaryPreferences.tsx`
(325 lines). **Store:** `useDietaryPreferenceStore`. **Status: SHIPPED.**

Unlike Nutrition Targets and Nutrition Plan, this screen **lists rows the user
wrote**, and those rows expose a `syncStatus` (`dietary-preference.ts:49`,
`:67`). That is what makes the two local-first row states applicable here and not
on the two read-only nutrition projections.

| State | Trigger — source state | Rendered treatment | Exit | Platform | Evidence | Status |
|---|---|---|---|---|---|---|
| **Web unavailable** | `status === 'web-unavailable'` | **Full-screen early return**: heading + `<Banner tone="info">`, `nutrition.preferences.webUnavailableTitle/Body`. No form, list or controls | **None** — terminal | **Web only** | `DietaryPreferences.tsx:128-140`; specs *"…with no form, list, or controls (ADR-P019)"*, *"…in Spanish"* | SHIPPED |
| **Loading** | `initialLoading = status === 'loading' && preferences.length === 0` | `nutrition.plan.loading` text, **scoped to the list section**; the add form renders regardless | `load()` resolves | Both | `DietaryPreferences.tsx:107`, `:285-288`; spec *"shows a loading indicator during the initial load"* | SHIPPED |
| **Empty** | Read succeeded, `preferences.length === 0` | `nutrition.preferences.empty` muted text in the list section | User adds an exclusion | Native | `DietaryPreferences.tsx:289-290`; spec *"shows an empty message when there are no exclusions"* | SHIPPED |
| **Error** | `error !== null` — covers **both** the load failure and save failures | `<Banner tone="error">`, `nutrition.preferences.errorTitle/Message`, above the form | Next successful operation | Both | `DietaryPreferences.tsx:149-153`; `dietary-preference.store.ts:55`, `:71-72`; spec *"surfaces a safe error banner"* | SHIPPED |
| **Pending sync** | `preference.syncStatus === 'pending'` — exclusions are local-first writes that enqueue, and the listed rows expose the field | `SyncHint` component, **row-level** caption with `tone="muted"`, `nutrition.preferences.syncPending` + `syncPendingAccessibility`. Reassures — the write is safely stored | Queue drains | Native | `DietaryPreferences.tsx:47-71`, `:347`; `dietary-preference.ts:49`, `:67`; spec *"reassures that a queued exclusion is safely stored (BUG-011)"* | SHIPPED |
| **Conflict** | `preference.syncStatus === 'conflict'`, set by `markDietaryPreferenceConflict` | Same `SyncHint`, caption with `tone="warning"`, `nutrition.preferences.syncConflict` + `syncConflictAccessibility`. **Report-only** — no choose action | **None on this surface** — no resolution UI exists anywhere, see BUG-012 | Native | `DietaryPreferences.tsx:47-71`, `:347`; `nutrition/infrastructure/sync-appliers.ts:32`; specs *"reports a diverged exclusion as warning, not error (BUG-011)"*, *"reports the conflict without offering a resolution (BUG-012 stays open)"* — the first asserts the rendered `warning` colour | SHIPPED |
| **Offline** | — | — | — | — | **No Offline signal reaches this surface at `fb02097`.** `useDietaryPreferenceStore` receives no connectivity or sync outcome. This records what the screen receives, not a limit on what it could be given | **n/a** |
| **Data-gap** | — | — | — | — | Preferences are user-entered, not computed; nothing is a prerequisite | **n/a** |

---

# 10 — Progress (`/progress`)

**File:** `mobile/src/features/progress/presentation/ProgressScreen.tsx` (229
lines). **Store:** `useProgressStore`, status union
`'idle' | 'loading' | 'ready' | 'saving' | 'error' | 'web-unavailable'`
(`progress.store.ts:47`). **Status: SHIPPED.**

This screen is the **reference for separating load failure from write failure**,
which is why the Food Log write-error gap is identifiable as a defect rather than
a house style.

| State | Trigger — source state | Rendered treatment | Exit | Platform | Evidence | Status |
|---|---|---|---|---|---|---|
| **Web unavailable** | `status === 'web-unavailable'` | **Full-screen early return**: heading + `<Banner tone="info">`, `progress.webUnavailableTitle/Body`. No forms, metrics, trends or recompute control | **None** — terminal | **Web only** | `ProgressScreen.tsx:74-84`; specs *"…with no forms, metrics, trends, or recompute (ADR-P019)"*, *"…in Spanish"* | SHIPPED |
| **Loading** | `status === 'loading'` or `'idle'` | Loading text in the content slot | `load()` resolves | Both | `ProgressScreen.tsx:125-128`; spec *"renders a loading state"* | SHIPPED |
| **Error** — load | `status === 'error'` | `<Banner tone="error">`, `progress.screen.loadErrorTitle`. The inline comment states the raw store string must never render | Next successful load | Both | `ProgressScreen.tsx:129-133`; spec *"surfaces a localized load error and never renders the raw store string"* | SHIPPED |
| **Error** — save | `error !== null` while otherwise ready | A **separate** `<Banner tone="error">`, `progress.screen.saveErrorTitle`, rendered inline **without wiping the forms** | Next successful save | Both | `ProgressScreen.tsx:136-140`; spec *"surfaces a localized save error inline (distinct from load) without wiping the forms"* | SHIPPED |
| **Empty** | Read succeeded, no entries recorded | `progress.screen.noWeight` muted text | User records a first entry | Native | `ProgressScreen.tsx:155`; spec *"renders the empty state when nothing is recorded"* | SHIPPED |
| **Pending sync** | `syncStatus === 'pending'` on a **listed** body weight or snapshot — every progress write lands as `pending` and the rows expose the field | Shared `SyncHint` component, **row-level** caption with `tone="muted"`, `progress.syncPending` + `syncPendingAccessibility`. Reassures — the write is safely stored | Queue drains | Native | `SyncHint.tsx`; `ProgressScreen.tsx:158` (latest weight); `WeeklySnapshotSummary.tsx:107`, `:127` (latest + earlier weeks); spec *"reassures that a queued body weight is safely stored (BUG-011)"* | SHIPPED³ |
| **Conflict** | `syncStatus === 'conflict'`, set by `markBodyWeightConflict`, `markBodyMeasurementConflict` or `markProgressSnapshotConflict` | Same `SyncHint`, caption with `tone="warning"`, `progress.syncConflict` + `syncConflictAccessibility`. **Report-only** — no choose action | **None on this surface** — no resolution UI exists anywhere, see BUG-012 | Native | `SyncHint.tsx`; `ProgressScreen.tsx:158`; `WeeklySnapshotSummary.tsx:107`, `:127`; specs *"reports a diverged body weight as warning, not error (BUG-011)"*, *"reports an earlier week that diverged (BUG-011)"*, *"reports the conflict without offering a resolution (BUG-012 stays open)"* | SHIPPED³ |
| **Offline** | — | — | — | — | **No Offline signal reaches this surface at `fb02097`.** `useProgressStore` receives no connectivity or sync outcome. Given how staleness-sensitive this screen is, wiring one in is a reasonable future design change — but it is a change, not a missing treatment | **n/a** |
| **Data-gap** | — | — | — | — | Progress records user-entered values; nothing is a prerequisite. The *dashboard* names a missing weight as a gap and routes **here**, which is the reverse relationship | **n/a** |

³ **Body measurements carry `syncStatus` but are never listed individually on
this screen.** `bodyMeasurements` reaches the UI only as a count
(`ProgressScreen.tsx:164`) and as the aggregated `muscleMassTrend` series
(`:110`) — there is no measurement row to annotate, so the shipped treatment
cannot reach them. This is an **absent surface, not an unimplemented treatment**,
which is why the rows above are SHIPPED rather than PROPOSED. It contradicts this
document's own earlier trigger wording and `.ai/19_COPY_DECKS.md` ("listed
weight, measurement and snapshot rows"), both of which assumed a measurement list
that does not exist. **BUG-011 stays open** carrying this residual; closing it
needs either a measurement list (a design change with no copy in the deck) or a
corrected acceptance criterion. **Not** absorbed into this slice.

`TrendBars` and `WeeklySnapshotSummary` are embedded **presentational**
components with no state source of their own; they render only when the screen
is in its ready arm. They are not separate surfaces for the purposes of this
document. Their non-visual equivalent is **UX-3D**, specified in
`.ai/20_PROGRESS_NONVISUAL.md` — which also records that the empty and
single-point series are **content conditions inside this screen's ready arm**,
not canonical states of their own.

---

# Coverage summary

Ten state-bearing surfaces. Legend: **S** SHIPPED · **S!** SHIPPED but
non-conformant · **P** PROPOSED, applicable and unimplemented, with a named
owner · **—** genuinely not applicable, justified in the matrix.

| # | Surface | Loading | Empty | Data-gap | Error | Offline | Pending | Conflict | Web unav. |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Dashboard screen | S | — | S | S | S² | S² | S² | S |
| 2 | Sync status banner | — | — | — | S | S | S | S | — |
| 3 | Data-gap card | — | — | S | — | — | — | — | — |
| 4 | Progress summary card | S | S | — | S | — | — | — | S |
| 5 | Workout Log | S | S | — | S | — | S | S | S |
| 6 | Nutrition Targets | S | — | S | S | — | — | — | S |
| 7 | Nutrition Plan | S | — | S | S | — | — | — | S |
| 8 | Food Log | S | S | — | S¹ | S | S | S | S |
| 9 | Dietary Preferences | S | S | — | S | — | S | S | S |
| 10 | Progress | S | S | — | S | — | S³ | S³ | S |

¹ load, write, sync and catalog-incompatibility errors are all SHIPPED. Write
errors ship as three separate per-operation treatments (BUG-008), each distinct
from the load error; catalog incompatibility is separate again and is no longer
folded into Conflict (BUG-007).
² rendered by the embedded sync status banner (surface 2), which is part of the
dashboard composition — the same treatments counted once at surface 2 and once
in the dashboard's seven-of-eight total.

**Totals.** **PROPOSED: none.** Every applicable state on every surface now has a
shipped treatment. Surface 8's Error — writes row shipped with BUG-008; BUG-011's
three feature slices shipped surface 5's Conflict row, surface 9's two rows and
surface 10's two rows; surface 4's Error row shipped with BUG-009.

**Two owners still have open work that this grid does not track**, and neither is
a missing treatment:

- **BUG-011** stays open on the measurement-listing residual recorded at surface
  10, footnote ³ — an **absent surface**, not an unimplemented treatment.
- **BUG-012** stays open: no conflict-**resolution** path exists anywhere. Every
  Conflict treatment in this grid is **report-only** by design.

**SHIPPED — non-conformant: none.** Food Log's Conflict tone was the only one
and has since shipped conformant (BUG-007): it renders `warning`, and the
catalog-incompatibility cause it used to absorb is now its own Error treatment.
Everything in the grid is either SHIPPED or justified `n/a`, and every `n/a`
carries its justification in the surface matrix.

**The one state present on every feature screen is Web unavailable** — 12
presentation files, 23 keys, 19 specs. It is the most consistently implemented
state in the product. **Offline is the narrowest**: two surfaces and four keys,
and the matrices show why — at this commit an authoritative connectivity signal
is exposed to only those two surfaces.

---

# Findings

**Eight findings, C-1 through C-8.** Four were documentation contradictions and
are **reconciled** in this change; four were **runtime defects** tracked in
`.ai/11_BACKLOG.md`. Of those four, **C-3 (BUG-007) and C-4 (BUG-008) have since
been fixed**, and **C-5 has since been fixed** (BUG-009); C-8 remains open.

| # | Finding | Kind | Disposition |
|---|---|---|---|
| **C-1** | Flow 5 claimed an Offline state Workout Log does not have | Documentation | **Reconciled** — `.ai/17_PRODUCT_FLOWS.md` v1.2 |
| **C-2** | Flow 7 claimed Offline and Pending sync that Progress does not render | Documentation | **Reconciled** — `.ai/17_PRODUCT_FLOWS.md` v1.2 |
| **C-3** | Food Log renders Conflict as `error` and merges it with an unrelated failure | Runtime defect | **BUG-007 — fixed**, see §C-3 |
| **C-4** | Food Log write failures are silent | Runtime defect | **BUG-008 — fixed**, see §C-4 |
| **C-5** | Progress summary card renders a failed read as Empty | Runtime defect | **BUG-009 — fixed**, see §C-5 |
| **C-6** | "six of the eight canonical states" undercounted the dashboard | Documentation | **Reconciled** — ADR-P027 + Flow 3 + Flow 4 |
| **C-7** | `06_MOBILE.md` §Error Handling listed non-canonical states | Documentation | **Reconciled** — `.ai/06_MOBILE.md` v1.1 |
| **C-8** | Shared loading skeleton carries a hardcoded English accessible label | Runtime defect | **BUG-010** |

**C-1 and C-2 are reconciled as documentation, not closed as behaviour.** The
incorrect *claims* are corrected. The **coverage gaps** they exposed are separate,
still open, and tracked as **BUG-011**: Workout Log renders no Conflict, and
Progress renders neither Pending sync nor Conflict, even though their rows carry
the field and their sync appliers set it. The Offline half of both findings is
**not** a coverage gap: no authoritative connectivity signal is exposed to those
surfaces at this commit, so there is nothing for them to render. The matrices
record that as `n/a` with the reason, and as a statement about what the surfaces
**currently receive** — not about what they could ever receive.

## C-1 — Flow 5 claimed an Offline state that Workout Log does not have

`.ai/17_PRODUCT_FLOWS.md` §Flow 5 §States listed Offline for workout logging.
`grep -rni "offline" mobile/src/features/workout/presentation` returns nothing,
and no `workout.*offline*` localization key exists. Workout Log has **Pending
sync** (two row-level hints) but no Offline treatment, and no authoritative
connectivity signal reaches it at this commit for one to render.
**Reconciled** in v1.2.

## C-2 — Flow 7 claimed Offline and Pending sync that Progress does not render

`.ai/17_PRODUCT_FLOWS.md` §Flow 7 §States listed both.
`mobile/src/features/progress/presentation/` contains no offline, pending or
conflict branch. The *data* exists — the repository writes
`sync_status = 'pending'` on every progress write and exposes three
`mark*Conflict` functions wired into `sync-appliers.ts` — but no progress surface
renders it. **Reconciled** in v1.2; the Pending-sync and Conflict coverage gaps
carry forward as **BUG-011**.

## C-3 — Food Log renders Conflict as `error`, and merges it with a different failure

`.ai/08_UI_UX.md` §Canonical State Patterns, distinction 5: *"Conflict ≠ Error. A
conflict is a both-versions-preserved outcome awaiting a decision … It is
`warning`, not `error`."*

`food-log.repository.ts:255` writes `sync_status = 'conflict'`; `:369` maps it to
`'action_required'`; `FoodLogScreen.tsx:41-51` renders that as
`<Banner tone="error">` and `:79-87` renders the row chip with `tone="error"`.

Two problems: the **wrong tone** — the two other conflict surfaces are conformant
(`sync-status-banner.tsx:32` and `ExerciseLibrary.tsx:46`, both `warning`) — and
**two causes collapsed into one state**, since `food-log.ts:33-37` documents
`action_required` as covering *"`CATALOG_REVISION_UNSUPPORTED` **or** a version
conflict"*.

**Runtime defect — BUG-007. Fixed.** No new ADR was required: the governing rule
already exists in ADR-P022's state model, so this was conformance work. The line
references above are as audited at the evidence baseline; the fix moved them.

The audit understated the second half. The two causes were not merely *rendered*
together — they were **indistinguishable in the data**: `sync-worker.ts` calls
the same applier `markConflict` for a `CONFLICT` result and for a `REJECTED` /
`CATALOG_REVISION_UNSUPPORTED` result, so both write `sync_status = 'conflict'`
on the entity row. Only the *queue* row separates them, and only the rejection
records its code there (`markActionRequired`). The fix therefore starts at the
read, not at the banner:

- `sync-queue.ts:151` adds a read-only `listParkedEntityIds(entityType, code)`.
- `food-log.repository.ts:205-215` consults it — only when a row is actually
  marked — and `:389` maps a marked row to `action_required` when parked by the
  catalog code and to the new `conflict` state otherwise. Absent evidence
  defaults to Conflict, which is report-only; the catalog copy is the one that
  tells the user to delete and re-add a food, so it must be earned.
- `food-log.ts:26-45` splits `MealItemSyncState`; `food-log.store.ts:78-96`
  counts the two separately and lets the actionable cause outrank the
  report-only one without folding the counts together.
- `FoodLogScreen.tsx:59-72` and `:146-158` render Conflict as `warning`, and the
  new specs assert the rendered colour, not the prop name.

**BUG-012 remains open and is unaffected.** The Conflict copy is deliberately
report-only: no resolution affordance exists on this surface or anywhere else,
and a spec asserts that the banner offers none.

## C-4 — Food Log write failures are silent

`food-log.store.ts` sets `error` on `addFood` (`:124-125`), `editServing`
(`:134-136`) and `removeItem` (`:145-147`). `FoodLogScreen.tsx` branches only on
`status === 'error'`, which `load()` alone sets (`:114`), and never reads the
`error` field. A failed add, serving edit or removal renders nothing.
`.ai/06_MOBILE.md` §Error Handling: *"Never leave users without feedback."*
`ProgressScreen` demonstrates the correct two-branch pattern.

**Runtime defect — BUG-008. Fixed.** The line references above are as audited at
the evidence baseline; the fix moved them. The store now carries a
`FoodLogWriteOperation` discriminant (`food-log.store.ts:30`, `:48`) set by each
failing write (`:129-160`) and cleared on the next write attempt or the next
successful read (`:98`). `FoodLogScreen.tsx` maps it to one of three localized
title/body pairs (`:88-112`) rendered **after** the sync banner and **above** the
content (`:321`), so a failed write no longer takes the day off the screen. Nine
regression specs cover the three operations, both cleared paths, the preserved
day, Spanish, and the no-banner case.

## C-5 — Progress summary card renders a read failure as Empty

`ProgressSummaryCard.tsx` has no `status === 'error'` branch, so a failed read
falls through to the ready arm and renders `progress.card.noWeight` /
`progress.card.prompt` over empty arrays — presenting a failure as a true answer,
which the Empty definition forbids.

**Runtime defect — BUG-009. Fixed.** The line references above are as audited at
the evidence baseline; the fix moved them. `ProgressSummaryCard.tsx:71-84` adds
the missing `status === 'error'` branch between Loading and the ready arm, so the
ready arm — and therefore Empty — is now reachable **only after a successful
read**, which is what the Empty definition requires. The copy is the frozen
UX-3C pair; no retry control is offered, and the card stays pressable exactly as
it does while Loading. Six regression specs cover the new branch **and** the
Loading branch, which the audit noted was untested; one is a guard asserting
Empty is still reached after a successful read.

## C-6 — "six of the eight canonical states" undercounted the dashboard

Three places put the figure at six: **ADR-P027** Decision 3, which enumerated
them; `.ai/17_PRODUCT_FLOWS.md` §Flow 4, a six-row table; and §Flow 3, the bare
figure. All three omitted **Data-gap**, which the dashboard renders on two
branches (`DashboardScreen.tsx:81-90` and `:96-98`), backed by 19
`dashboard.gap.*` keys and three deep-link specs — and §Flow 4 described Data-gap
in prose immediately beneath its own table.

**Reconciled.** Counting the complete dashboard composition consistently —
including the embedded treatments already counted for its sync states — the
dashboard reaches **seven of eight**; **Empty** is the only absent state. The
correction was applied to ADR-P027 Decision 3, §Flow 3 and §Flow 4.

**This is an evidence correction to supporting rationale, not a change to
ADR-P027's decision.** The count supports the dashboard's status role, and it
supports it at least as strongly at seven as at six. Hub-and-spoke is still
retained, bottom tabs are still deferred, and no revisit trigger is affected.

## C-7 — `06_MOBILE.md` listed states that are not canonical

`.ai/06_MOBILE.md` §Error Handling required every screen to handle *"Loading,
Empty, Offline, Success, Failure, Permission denied, Unexpected errors"*.
**Success** and **Permission denied** are not canonical states; `.ai/08_UI_UX.md`
records both as future needs with no contract, and permission has zero
localization keys and zero handling.

**Reconciled** — `.ai/06_MOBILE.md` v1.1 now requires each screen to handle its
**applicable subset** of the eight canonical states, points at `.ai/08_UI_UX.md`
and this document, and states explicitly that the subset is a property of the
screen's data source rather than a checklist. No new state was created, and no
screen is required to implement all eight.

## C-8 — the shared loading skeleton carries an unlocalized accessible label

`dashboard-skeleton.tsx:11` sets `accessibilityLabel="Loading dashboard section"`
as a hardcoded English literal. It is the only unlocalized user-exposed string
among the audited state surfaces, and it is **exposed to assistive technology on
every one of the 12 routes** that use the skeleton as their session loader,
including on a Spanish-locale device.

**Runtime defect — BUG-010.**

---

# Gaps for later slices

Not defects — specification work this document deliberately does not do.

| Gap | Owning slice |
|---|---|
| EN/ES copy for every state named above | **UX-3C — delivered as `.ai/19_COPY_DECKS.md` v1.0 documentation candidate** |
| Non-visual equivalent for `TrendBars` and `WeeklySnapshotSummary` | **UX-3D — delivered as `.ai/20_PROGRESS_NONVISUAL.md` v1.0 documentation candidate** |
| Whether a first-run checklist introduces a new state (it must not — `.ai/17_PRODUCT_FLOWS.md` §Flow 1 already requires this) | **UX-4B** |
| Manual VoiceOver / TalkBack / browser-AT verification of every state above | **UX-4C** |

---

# Residual risks

1. **Conflict is visible but not resolvable in public V1.** Three public-v1
   surfaces report conflicts (the dashboard sync banner, Food Log's banner and
   chip, and `ExerciseLibrary` at `/exercises`). **None offers a way to choose a
   version.** The state model's user action for Conflict is *"Review and
   choose"*, and no reachable surface implements the choosing. Tracked as
   **BUG-012**, whose flow, screens, behaviour and copy need a **separately
   authorized specification** before implementation — UX-3C may specify only the
   existing reporting copy. The dormant medical domain is out of scope and stays
   dormant (ADR-P017).
2. **Local-first row state is invisible on three surfaces.** Workout Log renders
   no Conflict; Dietary Preferences and Progress render neither Pending sync nor
   Conflict — while their rows carry the field and their sync appliers set it.
   Tracked as **BUG-011**.
3. **Offline is narrowly wired.** At this commit an authoritative connectivity
   signal is exposed to only two surfaces, and on the dashboard it additionally
   requires an explicit *Sync now* press. For a product whose constitution
   promises 48 hours of offline operation, the offline-first architecture is
   largely unexpressed in the UI. Exposing that signal more widely is a design
   change, not a conformance defect, and it has no owning slice.
4. **Priority ordering hides states.** Both sync banners are single-slot with a
   fixed priority, so Conflict can be masked by Offline or an in-flight sync.
5. **No retry affordance exists anywhere** — zero retry keys. For Web
   unavailable that is required by ADR-P019; for **Error** it is an unimplemented
   part of the state model, already recorded in `.ai/08_UI_UX.md`.
6. **Shared-store coupling.** Three surfaces (dashboard, Nutrition Targets,
   Nutrition Plan) render the same store's states under different headings, so a
   change to dashboard load behaviour silently changes all three.

---

# Accessibility scope

This document records **which state renders**, never how it is announced or
perceived.

What the audit established about the state banners, and nothing beyond it:

- The shared `Banner` component sets **`accessibilityRole="summary"`** on its
  container (`mobile/src/shared/presentation/banner.tsx:29`), so every banner
  cited in the matrices above carries that role.
- The audited state surfaces contain **no explicit live-region declaration and no
  imperative announcement**: `accessibilityLiveRegion` and
  `announceForAccessibility` occur **zero** times in `mobile/src`.
- What assistive technology does **automatically** when such a banner appears or
  changes — under VoiceOver, TalkBack, or a browser AT — is **unverified**. The
  absence of an explicit mechanism is an established fact; silence is not, and
  must not be asserted in either direction without manual proof.

Per `.ai/17_PRODUCT_FLOWS.md` §Accessibility posture and ADR-P023 / ADR-P024:

- No accessibility outcome here may be reported as satisfied on the strength of a
  unit or component test.
- `accessibilityLabel` values cited in the matrices are evidence that a label
  **exists** and is **exposed**, not that it is announced correctly.
- Verification is the **UX-4C** manual VoiceOver / TalkBack / browser-AT pass,
  recorded per surface. It is unscheduled, and it remains the gate for every
  accessibility claim in this document.

---

# Related documents

- `.ai/08_UI_UX.md` — §Canonical State Patterns (the eight states) and §State
  Component Contracts (UX-1B2A). The authority for anything visual.
- `.ai/17_PRODUCT_FLOWS.md` — flow-level state declarations that these matrices
  refine to the surface level.
- `.ai/19_COPY_DECKS.md` — exact EN/ES copy for the states and proposed gaps
  inventoried here.
- `.ai/06_MOBILE.md` — §Error Handling (the applicable-subset rule),
  offline-first, synchronization and screen principles.
- `.ai/12_DECISIONS.md` — ADR-P019 (Web dormancy), ADR-P022 (state model,
  Decision 15), ADR-P023 / ADR-P024 / ADR-P025 (accessibility staging),
  ADR-P027 (onboarding and navigation).
- `.ai/11_BACKLOG.md` — FEATURE-010 UX stream; UX-3B and BUG-007 … BUG-012.

---

# AI Instructions

Read this file before specifying, changing, or reviewing any state a V1 screen
can enter.

## 1. The eight states are fixed

Loading, Empty, Data-gap, Error, Offline, Pending sync, Conflict, Web
unavailable. Do not add a ninth. A new tone, a new message or a new sub-phase is
not a new state. If a runtime behaviour does not fit one of the eight, classify
it in §What is deliberately not a canonical state — do not invent a name.

## 2. Use the status taxonomy exactly

**SHIPPED**, **SHIPPED — non-conformant**, **PROPOSED**, **n/a**. `n/a` means
genuinely not applicable and always carries its justification. An applicable but
unimplemented treatment is **PROPOSED with a named backlog owner** — never `n/a`,
and never an unowned note.

## 3. Applicability is proven, not inherited

A surface carries a canonical state only where an **authoritative source for that
state is exposed to it at the audited commit**. Pending sync requires accessible
queued-write state; Offline requires an authoritative connectivity or sync
signal. Do not infer either from the kind of surface, and do not infer that an
embedded card inherits its parent screen's sync states. Prove it from the store,
the domain type and the sync wiring before adding a row — and when you record a
state as not applicable, say what the surface **currently receives**, not what it
could never receive.

## 4. Do not upgrade a finding into a fix

§Findings records eight items. Four are reconciled documentation corrections;
four were runtime defects owned by BUG-007 … BUG-010, and two further coverage
gaps are owned by BUG-011 and BUG-012. **BUG-007 and BUG-008 have since shipped**
and their rows carry SHIPPED evidence; BUG-009 … BUG-012 remain open. Do not
resolve any open item by editing this document.

## 5. Status claims require the same evidence as everywhere else

SHIPPED means the branch exists on `origin/main` and is cited. If you change this
document after a new commit, re-verify the evidence baseline first: the counts in
§Evidence baseline are commit-specific.

## Scope reminder

This document is UX-3B. Copy is the separate UX-3C deliverable
`.ai/19_COPY_DECKS.md`; the progress-chart non-visual equivalent is the UX-3D
deliverable `.ai/20_PROGRESS_NONVISUAL.md`; implementation is UX-4. None of them
is authorized by this file.
