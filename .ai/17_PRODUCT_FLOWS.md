# AppFitness Low-Fidelity Product Flows (V1)

Version: 1.3
Status: Active
Last Updated: 2026-08-28

---

# Purpose

This document is the **UX-2** deliverable named in `.ai/11_BACKLOG.md`
(FEATURE-010, UX stream item 4): the low-fidelity product-flow specification for
V1, covering onboarding; sign-in, verification and password recovery;
navigation and information architecture; the dashboard; workout logging;
nutrition logging; and progress.

It describes **flows** — the sequence of screens, the states each screen can be
in, what moves the user between them, and what the copy must mean. It is
deliberately **low fidelity**: no pixels, no measurements, no final strings, no
component APIs.

## What this document is not

- **Not a design system.** Tokens, contrast, components, motion and state
  *contracts* live in `.ai/08_UI_UX.md`. This document **references** them and
  must never restate or contradict them.
- **Not a copy deck.** It records **copy intent** — what a message must
  accomplish and what it must not claim. Final EN/ES strings are UX-3.
- **Not a backend specification.** No endpoint, payload, table or engine
  behaviour is invented here. Where a flow depends on backend behaviour, this
  document either cites what already exists or marks the flow PROPOSED.
- **Not an accessibility conformance claim.** See *Accessibility posture*.

---

# Status vocabulary

Every **product flow and user-facing surface** below carries exactly one status.
These are evidence-bound, not aspirational.

**Two things are deliberately outside this classification:**

- **Repository defects.** Code no user can reach is not a product flow. It is
  neither SHIPPED, TARGET nor PROPOSED — it is a defect, recorded as such and
  tracked in `.ai/11_BACKLOG.md`. See §"Known repository defect" (BUG-006).
- **Canonical state names.** Loading, Empty, Data-gap, Error, Offline, Pending
  sync, Conflict and Web unavailable are vocabulary from `.ai/08_UI_UX.md`
  §Canonical State Patterns, fixed by ADR-P022 Decision 15. The state model is
  not a deliverable this document ships, so the eight names carry no status.
  What *does* carry a status is a given surface's ability to enter a given
  state — that is a property of the flow, and it is stated per flow.

| Status | Meaning | Evidence rule |
|---|---|---|
| **SHIPPED** | Exists on `origin/main` today and is reachable by a user | A route, component and localization key exist on `main`. Cited. |
| **TARGET** | Decided and specified, implementation exists but is **not on `main`** | An accepted ADR **plus** an open PR or merged-elsewhere implementation. Cited. |
| **PROPOSED** | Decided in principle or sketched here; **no implementation exists** | An ADR decision, or a gap identified by this document. Never implies code. |

**A flow marked TARGET or PROPOSED must not be described as if a user can do it
today.** Where a TARGET flow's shape is already fixed by an accepted ADR, this
document specifies it so UX-3 can build on it — but the status stays TARGET
until it lands on `main`.

## Evidence baseline

Everything below was verified against `origin/main` at commit
`4c319e94bc06ba0f3224ea7ea8101f62c9919fe1`; TARGET evidence re-verified against
PR #102 head `a0af271` (52 files, +5566/−29, OPEN/CLEAN) on 2026-08-28.

**v1.1 (ADR-P027).** Flow 1 and Flow 3 were reconciled against `origin/main`
`74f684dfd0a51dca353cb747c550229630f72016` after the UX-3A decision audit. Only
those two flows changed; every other status in this document is unchanged.

**v1.2 (UX-3B).** The per-surface audit in `.ai/18_SCREEN_STATE_MATRICES.md`,
run against `origin/main` `fb02097593ff9a2735f54620d6350d880cf3a030`, corrected
**three** claims in this document, recorded there as **C-1**, **C-2** and
**C-6**:

- **§Flow 5 §States** asserted an **Offline** state that workout logging does not
  implement (**C-1**).
- **§Flow 7 §States** asserted **Offline** and **Pending sync** states that no
  progress surface renders (**C-2**).
- **§Flow 4 §States** and **§Flow 3** put the dashboard at **six** of the eight
  canonical states, omitting **Data-gap**; the correct figure is **seven**
  (**C-6**). §Flow 4's table gained a Data-gap row.

Four sections therefore changed in v1.2 — §Flow 3, §Flow 4, §Flow 5 and §Flow 7 —
plus this baseline note, §Related documents, and the UX-3 follow-up list. Every
other flow, status and claim is unchanged.

**v1.3 (UX-3C).** The UX-3 follow-up list and §Related documents now point to
the separate exact-copy specification in `.ai/19_COPY_DECKS.md`. No flow,
screen inventory, state applicability or SHIPPED / TARGET / PROPOSED status
changed in this revision.

Inspected: `mobile/src/app/` (15 files — 14 user-facing routes plus
`_layout.tsx`), `mobile/src/features/*`,
`mobile/src/shared/localization/resources/{en,es}.ts` (**696 keys each — full
parity**), `api/src/modules/*`, and ADR-P017 through ADR-P027.

Two facts that set the SHIPPED boundary and are easy to get wrong:

1. **Password recovery is not on `main`.** `main` has **zero** `auth.forgot.*` /
   `auth.reset.*` / verification localization keys and no
   `forgot-password` / `reset-password` route. The implementation exists in
   **PR #102** (ADR-P026 Vertical 1) and is therefore **TARGET**, not SHIPPED.
2. **Email verification has no implementation anywhere.** ADR-P026 Vertical 2 is
   accepted in principle only ⇒ **PROPOSED**.

---

# Global conventions

## The state model is already fixed

`.ai/08_UI_UX.md` §Canonical State Patterns defines **exactly eight** states —
Loading, Empty, Data-gap, Error, Offline, Pending sync, Conflict, Web
unavailable — approved by ADR-P022 Decision 15, each with a cause, a
data-trustworthiness answer, a user action, a recovery path and a platform
scope.

**This document does not introduce a ninth state and does not redefine the
eight.** Each flow below declares *which* of the eight it can enter and *what
triggers* each one. Where a flow cannot currently reach a state it logically
should, that is recorded as a gap.

The two distinctions this specification leans on hardest, because flows are
where they get blurred:

- **Empty ≠ Data-gap.** Empty invites creation *on this screen*. Data-gap names
  a *specific* missing prerequisite and routes the user *elsewhere* to supply it.
- **Offline ≠ Error.** Offline is `warning` and informational; locally available
  data stays trustworthy to work from, and remote freshness is simply unknown.
  It must never read as failure.

## Platform matrix (ADR-P018 / ADR-P019)

V1 ships one Expo codebase to **native (iOS/Android)** and **Web**, and they are
deliberately **not** feature-equivalent.

| Capability | Native | Web |
|---|---|---|
| Local SQLite / offline-first operation | SHIPPED | **Dormant by decision** |
| Sync queue, pending-sync, conflict states | SHIPPED | Not applicable |
| Dashboard, progress, nutrition, workout surfaces | SHIPPED | **Web-unavailable state** |
| Authentication (sign-in / register) | SHIPPED | SHIPPED |
| `reset-password` route | **TARGET** (PR #102) | **TARGET** (PR #102) |

The reset route is **TARGET on both platforms** — one Expo Router route that
builds for native and Web alike. What differs is **how a user arrives at it**:

- **Emailed HTTPS links open the Web route.** Native **Universal / App Links are
  not configured** (`app.json` declares no `intentFilters` /
  `associatedDomains`), so the operating system has no basis to hand an
  `https://` link to the app. Web is therefore the landing surface for email.
- **The native route is reachable, but through the custom scheme**
  (`appfitness://reset-password?token=…`), not through an emailed link. It is a
  real, built route — not dead code — and it is the path an in-app deep link
  takes.

So "email lands on Web" is a **link-routing** fact, not a statement that the
native route is absent. UX-3 copy must not promise "open in the app", and must
equally not describe the native route as missing.

On Web the dormant capabilities render the **Web unavailable** state: `info`
tone, honest about there being nothing to retry, no fabricated data, no retry
control. **SHIPPED** across dashboard, nutrition (log / plan / targets /
preferences), profile, goal, progress and workout (log / library / builder) —
**23** dedicated `*webUnavailable*` copy keys exist on `main` (distinct from the
generic `*.unavailable` error-state titles, which are a different state).

Implementation note for UX-3: the Web-unavailable condition is **not** a
`Platform.OS` check inside each screen. It arrives as a **store status**
(`status === 'web-unavailable'`) originating in the data layer, because the
local database module is dormant on Web. Flows should treat it as a data state,
not a rendering branch.

## Localization and copy intent

EN and ES are **co-equal**; ES is not a translation afterthought. `main` holds
**696 keys in each** with exact parity.

Copy intent in this document is expressed as **what the message must accomplish**
and **what it must not claim**. Two standing rules:

- **Never leak system vocabulary.** No status codes, token names, table names,
  or raw server text in user-facing copy.
- **ES must not be a literal transliteration.** Spanish copy carries the same
  intent with natural phrasing, and `.ai/08_UI_UX.md` §Bilingual Layout Safety
  governs the length differences that follow.

## Accessibility posture — stated honestly

This document specifies accessibility **intent**. It does **not** certify
outcomes, and UX-3 must not upgrade intent into a conformance claim.

Three constraints are already recorded and constrain every flow below:

- **ADR-P023** — programmatic **required** and **invalid** exposure has **no
  supported typed mechanism** on native iOS/Android in the current stack. It is
  staged, not solved, and is an explicit item at the **V1 accessibility
  release-review gate**. Programmatic **disabled** exposure *is* implemented.
- **ADR-P024** — validation errors request a **polite** announcement via
  `aria-live="polite"`, which React Native declares `@platform android` and
  react-native-web maps to the DOM. **iOS is unaffected**, and **no
  announcement is proven on any platform** until manual AT verification runs.
- **ADR-P025** — `FormField` keeps its raw-`TextInput` implementation for V1, so
  **two input style families persist through V1**. Flows must not assume a
  single unified input.

**No accessibility outcome in this document may be reported as satisfied on the
strength of a unit or component test.** Announced states require manual
VoiceOver, TalkBack and browser-AT verification, recorded per surface — that
verification is **PROPOSED** and unscheduled.

---

# Flow 1 — Onboarding

**Status: PROPOSED in its entirety.** No onboarding surface exists on `main`; a
repository-wide search for `onboarding` returns nothing.

**Shape decided by ADR-P027 (2026-08-28); implementation still PROPOSED.** The
decision settles *what* onboarding is — advisory, non-blocking, resumable, a
dashboard checklist reusing the existing Data-gap routing, with no onboarding
routes. It makes nothing reachable: no code exists, and the status stays
PROPOSED until UX-4B ships it.

## What happens today (SHIPPED)

There is no onboarding. A newly registered account lands directly on the
**dashboard**, which then renders **Data-gap** states because profile and goal
inputs are missing. The user is expected to infer, from those gaps, that they
should visit Profile and Goal. The gap states do name the missing input and
route correctly — that part works — but nothing sequences them.

This is a real V1 product gap, not merely a polish item: the first-run
experience is a dashboard mostly composed of prerequisites the user has not been
asked for yet.

## Decided shape — advisory dashboard checklist (ADR-P027)

**ADR-P027 (Accepted 2026-08-28) resolves the open UX-2 decision: onboarding is
ADVISORY, non-blocking and resumable, and its approved target shape is a
dashboard checklist that will reuse the existing Data-gap routing. There are no
onboarding routes.**

The decided shape is **not** the multi-screen sequence UX-2 sketched. That
sketch is superseded and is retained below only as a rejected alternative.

```
register success
      │
      ▼
  dashboard  ← reachable immediately; nothing gates it
      │
      ├─ [first-run checklist]   ← derived from the SAME Data-gap state
      │        │                    the dashboard already computes
      │        ├─ profile essentials ──► /profile-edit
      │        ├─ goal              ──► /goal-edit
      │        └─ first weigh-in    ──► /progress
      │
      └─ everything else remains usable throughout
```

Why this shape, in one line: the sequencing was the only thing missing —
`DashboardScreen.tsx` already maps `profile` / `birth-date` / `height` →
`/profile-edit`, `default-goal` → `/goal-edit`, and `weight` → `/progress`.

The three properties follow from that reuse rather than from new machinery:

- **Non-blocking** — the dashboard is reachable immediately; no step gates it.
- **Resumable** — the checklist will be derived from live Data-gap state, so an
  unresolved prerequisite simply remains listed. Nothing needs to be persisted
  to "remember where the user was".
- **Skippable** — dismissing or ignoring it never blocks any surface.

**Status: PROPOSED.** ADR-P027 approves the shape; **no implementation exists**,
and it stays PROPOSED until UX-4B ships it. Nothing here is reachable by a user
today.

**Left to UX-3 specification, deliberately not decided by ADR-P027:** the visual
treatment; dismissal semantics (per-session, persistent, or completion-only);
item ordering; and all EN/ES copy.

**States.** Loading (dashboard read in flight), plus the Data-gap state that
already drives the routing. The checklist will add no new state and must not
introduce a ninth — see §Global conventions.

**Accessibility intent.** Progress through the list should be conveyed
non-visually (for example "2 of 3 complete"), and each item should name the
prerequisite it resolves rather than relying on position. **Unverified intent**;
no outcome may be claimed before the UX-4C manual AT pass.

## Rejected alternative — blocking onboarding

Rejected by ADR-P027: it would build a second mechanism for a job the Data-gap
states already do, which `.ai/00_PROJECT.md` §Decision Hierarchy disfavours at
**#5 Maintainability**. No user-safety, data-integrity or security argument
(#1–#3) supports gating a wellness product (ADR-P017).

## Rejected alternative — the UX-2 four-screen sequence

The original sketch was a `welcome → profile essentials → goal → ready`
sequence between registration and the dashboard. Rejected by ADR-P027: it needs
at least three new routes and a new navigation surface to reach an outcome the
dashboard checklist reaches with none. Recorded here so the decision is
traceable, not to keep it on the table.

---

# Flow 2 — Sign-in, verification and password recovery

## 2.1 Entry and session gating — SHIPPED

The app entry route resolves session state before showing anything:

```
app launch
   │
   ├── status unknown ──────► dashboard skeleton (Loading)
   ├── status authenticated ► /dashboard
   └── otherwise ───────────► /sign-in
```

Session restore is offline-tolerant: a stored session survives network failure,
and **only an explicit 401 clears it**. That behaviour is SHIPPED and is what
makes the 48-hour offline expectation in `.ai/06_MOBILE.md` coherent.

## 2.2 Sign-in and registration — SHIPPED

One screen, two modes, toggled in place (sign-in ⇄ register). Fields start
**empty** — never prefilled credentials. Register adds a username field.

Failures surface through a **typed, safe reason enum**, never raw server text.
The five SHIPPED reasons and their copy intent:

| Reason | Copy must convey | Must not |
|---|---|---|
| `invalid-credentials` | The email or password is wrong; try again | Say *which* was wrong |
| `registration-unavailable` | Those details can't be used; try different ones | Reveal that an account already exists |
| `connectivity` | We couldn't reach AppFitness; check the connection | Imply the credentials were wrong |
| `server` | Something is wrong on our side; try shortly | Blame the user |
| `unexpected` | We couldn't finish signing in on this device | Read as a credential failure |

`registration-unavailable` is deliberately non-enumerating: a taken email and a
taken username produce the **same** message.

**States.** Loading (submit in flight, button shows a busy state), Error (banner
above the form, form stays populated and editable). No Empty, Data-gap, Offline,
Pending-sync or Conflict state applies. **Web: fully available** — sign-in is
one of the few surfaces not Web-gated.

## 2.3 Password recovery — TARGET (PR #102, ADR-P026 Vertical 1)

**Not on `main`.** Specified here because ADR-P026 is Accepted and the
implementation is complete and green in PR #102.

```
sign-in ──"Forgot your password?"──► [request reset]
                                          │ submit email
                                          ▼
                                    [check your email]   ← always this state
                                          ┆
                          (user opens emailed link)
                                          ┆
                                          ▼
                               [choose a new password] ──success──► sign-in
```

**The confirmation state is unconditional.** Whether or not the address belongs
to an account, the user sees the same screen. This is not a UX nicety — it is
the account-enumeration defence, and UX-3 must not "improve" it into a
differentiated message.

**Copy intent — request screen.** Ask for the account email; explain a link will
arrive. **Confirmation copy must be non-committal**: *"If an account exists for
that address, a reset link is on its way. The link expires in 30 minutes and can
be used once."* It must never confirm or deny that the account exists. The ES
copy carries the same hedge.

**Copy intent — reset screen.** New password plus confirmation. State plainly
that saving **signs out every device**, because that is what happens. On
success, direct the user to sign in with the new password.

**Failure copy intent** (three states beyond the shared five):

| Reason | Copy must convey |
|---|---|
| Link no longer valid | Links expire after 30 minutes and work once; request a new one |
| Too many attempts | Wait before trying again — no counts, no timers, no hints |
| Recovery unavailable | We can't send reset emails right now; try later |

The last one is the **fail-closed** state: when mail is not configured the
feature reports unavailability rather than pretending a message was sent. It is
a single generic response decided *before* any account lookup.

**Link handling and platform difference.** The emailed link is an **HTTPS link
carrying the token in the URL fragment** (`#token=…`), landing on the **Web**
reset page. A fragment never reaches a server or proxy log. The page reads the
token into memory and clears it from the address bar and history.

Native **Universal / App Links are not configured** (`app.json` declares no
`intentFilters` / `associatedDomains`), so **a tapped email link opens the Web
page, not the app** — that is the V1 behaviour, and UX-3 copy must not promise
"open in the app". The app's own `appfitness://` scheme handles in-app deep
links and is unaffected.

**Incomplete-link state.** If the landing page receives no usable token it must
show a distinct state — *this link is incomplete* — with a route back to request
a new one. Not an error banner, not a blank form.

**States.** Loading, Error (the three reasons above plus connectivity/server).
No Empty, Data-gap, Offline, Pending-sync or Conflict.

On Web the screen briefly renders a neutral pre-capture view while the token is
read after hydration. **This is a transient sub-phase of Loading, not a ninth
canonical state.** It exists because the Web build is prerendered and the token
cannot be read during the first render without causing a hydration mismatch; it
resolves on the first post-hydration render. UX-3 should specify it as a
Loading treatment, and must not promote it into the state model.

## 2.4 Email verification — PROPOSED (ADR-P026 Vertical 2)

**No implementation exists anywhere.** ADR-P026 fixes the policy, which
constrains the eventual flow:

- Verification is a **soft gate**. New and unverified users keep **core app
  access** and see a **persistent reminder** — never a lockout.
- Existing accounts are backfilled unverified and are **never locked out**.
- Verification becomes mandatory only **before** any future email-report or
  account-notification feature.
- `resend-verification` returns an **identical response** regardless of account
  existence, exactly like recovery.

**Copy intent.** The reminder must be persistent but not alarming — it is
`info`, never `warning` or `error`, because nothing is broken. It should say
what verifying unlocks, not what it withholds.

**Flow shape (proposed).** A dismissible-per-session reminder on the dashboard;
a resend action; a verification landing surface mirroring the reset landing
(fragment token, memory capture, URL scrub). UX-3 should not detail this until
Vertical 2 is authorized.

---

# Flow 3 — Navigation and information architecture

## Shipped shape — SHIPPED

V1 uses a **hub-and-spoke stack**, not tabs. There is no tab navigator on
`main`. The **dashboard is the hub**; every feature is a spoke reached by an
explicit push from it, and the back affordance returns to the hub.

```
                    ┌───────────────────────────────┐
                    │          DASHBOARD            │  ← hub
                    └───────────────────────────────┘
   profile-edit ─┐   ┌─ goal-edit      ┌─ progress
   nutrition ────┼───┤  nutrition-plan ├─ food-log
   routines ─────┤   │  dietary-prefs  │  exercises
   workout-log ──┘   └─ delete-account └─ sign-out
```

Spoke-to-spoke transitions exist where a task genuinely continues:
nutrition targets → nutrition plan → food log; nutrition data-gap →
profile-edit or progress; progress card → progress.

**Assessment.** Hub-and-spoke is defensible for V1: the hub carries seven
navigation actions plus two account actions, and the dashboard doubles as
status. Its weakness is depth on one loop.

**Correction to the original UX-2 assessment.** UX-2 named two deep daily loops.
Only one is deep. `DashboardScreen.tsx` already pushes `/workout-log`
directly, so **logging a workout is one tap**. Food logging is the outlier:

```
dashboard(L1) → nutrition(L2) → nutrition-plan(L3) → food-log(L4)
```

That is **three pushes / four levels**, which exceeds `.ai/08_UI_UX.md`
**"Avoid more than three navigation levels"** — the only documented information-
architecture violation in the product, and it sits on a daily task.

## Decided model — hub-and-spoke retained (ADR-P027)

**ADR-P027 (Accepted 2026-08-28) resolves the open UX-2 decision.**

- **V1 keeps hub-and-spoke. Status: SHIPPED** — this is the model running today
  and it is unchanged by the decision.
- **Workout Log stays one tap** — already true, no work required.
- **A direct `/food-log` dashboard shortcut. Status: SHIPPED** — delivered by
  UX-4A in PR #110, merged at `5643303a7d173690fba5921e4c97c737288e5f00`. It is
  additive: the existing targets → plan → food-log chain is preserved for users
  who arrive that way, and the daily food-logging loop is now one push rather
  than three.

## Bottom tabs — DEFERRED, not unavailable

Tabs are **technically available with no new dependency**. `expo-router@57`
resolves `build/layouts/Tabs.js`, `build/layouts/TabsClient.js`, and a
**vendored** `build/react-navigation/bottom-tabs`; `@react-navigation/bottom-tabs`
is neither declared in `mobile/package.json` nor separately installed. The
deferral is a design and cost decision, not a capability limit — UX-3 must not
record tabs as "impossible".

**`DEFERRED` is an ADR-P027 decision outcome, not a fourth product-flow
status.** The vocabulary of this document remains SHIPPED / TARGET / PROPOSED
(see §Status vocabulary), and **no tab-shell or tab-navigation implementation
carries any of them**: no tab navigator, no tab layout and no tab bar is
SHIPPED, TARGET or PROPOSED.

This says nothing about the destinations themselves. `dashboard`,
`workout-log`, `progress` and the other named routes **keep the statuses
documented for them elsewhere in this file**, and the deferral does not alter
any of them. The five-tab map below is **informational and non-binding**: it
groups already-statused routes to record evidence for a future decision, and it
assigns them **no tab-navigation status** of any kind.

Four reasons, per ADR-P027 Decision 3:

1. **Unresolved selected-navigation accent contrast.** `.ai/08_UI_UX.md` defines
   a **Selected navigation** contract (`accent` + filled icon + heavier label)
   that nothing currently uses, and records `accent` on `surface` at
   **2.998:1 — FAIL**, below even the 3:1 non-text threshold. Tabs would
   activate that role and land V1 on one of ADR-P022's five open AA pairs.
   Non-colour redundancy addresses colour-*alone* dependence; it does not make a
   2.998:1 indicator conformant.
2. **Nested-navigation and migration cost.** `.ai/06_MOBILE.md` — "Avoid nested
   navigation complexity". The tab shell anticipated below would add a
   tab/stack nesting layer over today's single `<Stack>`, since three of its
   five tabs own several routes each; that is a property of *this* anticipated
   design, not of tabs in general. **20 files** reference route paths and
   **16 route spec files** live in `features/navigation/`.
3. **Web dead destinations.** Under ADR-P019 four of five tabs would advertise
   surfaces that render **Web unavailable**.
4. **Dashboard status role.** The dashboard reaches **seven** of the eight
   canonical states — Empty is the only absent one (corrected in v1.2; see
   §Flow 4) — so tabs demote it to one peer of five.

### Non-binding future tab map

Recorded by ADR-P027 so a later decision starts from evidence. **Not approved,
not a target** — informational only.

| Tab (non-binding) | Would own |
|---|---|
| Home | `dashboard` (+ `index` redirect) |
| Workout | `routines`, `workout-log`, `exercises` |
| Nutrition | `nutrition`, `nutrition-plan`, `food-log`, `dietary-preferences` |
| Progress | `progress` |
| Profile | `profile-edit`, `goal-edit`, `delete-account` |

`sign-in` stays outside any tab shell. All twelve non-authentication routes map
without leftovers.

**Revisit triggers — all three required:** resolve the `accent` token decision
(or record an authorized exception covering selected navigation); decide Web tab
behaviour explicitly; and authorize the migration separately with the
20-file / 16-spec surface costed.

## Known repository defect — NOT a product flow (BUG-006)

**Status: none of SHIPPED / TARGET / PROPOSED.** This is a **dormant,
user-unreachable repository defect**, not behaviour. It is documented here so
UX-3 does not mistake it for an IA decision, and it is tracked as **BUG-006** in
`.ai/11_BACKLOG.md`.

`EvaluationHistory` (medical) is **exported but imported by no route**, and it
pushes to **`/evaluation-edit`, which does not exist** in `mobile/src/app/`.

Calling it "SHIPPED" would be wrong twice over: no user can reach it, and its
one navigation action would fail if they could. The medical domain is dormant
for public-v1 by **ADR-P017**, so nothing here is user-visible and nothing is
broken *for users* today — but it is a trap for whoever revives the domain,
because wiring the surface up without first adding the route would crash
navigation.

**ADR-P017 constrains the fix:** medical surfaces stay dormant for public-v1, so
the remedy is *not* to build `/evaluation-edit`. See BUG-006 for the accepted
resolution options.

---

# Flow 4 — Dashboard

**Status: SHIPPED**, and the richest state surface in the product.

## Composition

Header (product name, subtitle) → sync status → assessment/recommendation
content → navigation actions (progress, nutrition, preferences, routines,
workout log, exercises) → account actions (sign out, delete account).

## States

The dashboard can enter **seven** of the eight canonical states, which is why it
is the reference implementation for the state model. **Empty is the only state it
does not reach**: the dashboard renders no user-owned collection that can succeed
and be empty.

| State | Trigger | Behaviour |
|---|---|---|
| **Loading** | Read in flight (`loading` / `idle`) | Skeleton — never an empty-looking dashboard |
| **Data-gap** | A prerequisite input is missing, so the assessment cannot compute | `DataGapCard` **within** the content, naming the input and routing to the screen that owns it — not a dashboard-level banner |
| **Error** | Read failed | `error` banner, no fabricated content |
| **Web unavailable** | Local DB dormant on Web | `info` banner, **no retry control** |
| **Offline** | No connectivity, after an explicit sync attempt | `warning`, informational — keep working |
| **Pending sync** | Local writes queued | `info` with counts; data is safe on device |
| **Conflict** | Divergent versions | `warning`, never `error` — user chooses |

Plus a **Ready** confirmation (`success`) when the queue is drained. Ready is a
sync confirmation, not a ninth state.

**Corrected in v1.2: the count is seven, not six.** Earlier revisions said "six"
and gave a table with no **Data-gap** row, while the paragraph beneath it
described Data-gap anyway. The UX-3B audit resolved the inconsistency in favour
of the evidence — Data-gap renders on two dashboard branches — and the same
correction was applied to §Flow 3 and to **ADR-P027** Decision 3. It is an
**evidence correction to supporting rationale**; ADR-P027's navigation decision
is unchanged.

**Copy intent for sync.** Pending sync must reassure: the write **is** saved
locally and nothing is lost. Conflict must invite a decision, never imply
damage. Offline must never read as failure. These distinctions are the whole
point of having six states instead of one spinner.

**Accessibility intent.** Every action carries a dedicated accessibility label
(the `*.Accessibility` key family is SHIPPED and extensive). Banner regions
should be announced on change — **unverified**.

---

# Flow 5 — Workout logging

**Status: SHIPPED** (Phase 16 / FEATURE-007). Native only; Web shows
**Web unavailable** for log, library and builder.

## Inner loop

```
dashboard ──► [routines] ──► [routine builder]
    │              │
    │              └──start──► [workout log] ◄── dashboard (direct)
    │                              │
    │                    ┌─────────┴──────────┐
    │                    │  add exercise      │  ← built-in or custom
    │                    │  add set (reps/wt) │  ← repeated, the core loop
    │                    │  show / hide sets  │
    │                    └─────────┬──────────┘
    │                              ▼
    └───────────────────────── [finish] ──► summary / dashboard
```

The **set-entry step is the loop that matters** — it repeats many times per
session and is the most latency- and error-sensitive interaction in the product.
It is also the one surface using an **uncontrolled commit-on-end input** (the
per-set reps editor), which UX-5 is scheduled to migrate.

## States

Loading, Empty (no routines yet → invite creating one; no custom exercises →
`workout.log.customEmpty`), Error, Pending sync, Web unavailable.
Logging is **local-first**: a set is stored on device immediately and syncs
later. Copy must never suggest a set is "not saved" while it is merely queued.

**Corrected in v1.2: there is no Offline state here.** Earlier revisions listed
one. The UX-3B audit found no offline branch anywhere in
`mobile/src/features/workout/presentation/` and no `workout.*offline*`
localization key. Pending sync **is** present, as two row-level hints. The
absence is recorded as a gap (C-1), not as correct-by-design — but UX-3 must not
specify copy for a state the surface cannot enter.

**Copy intent.** Action-first and brief — this is used mid-set, often one-handed,
sometimes with a phone on a bench. ES must stay short here; `.ai/08_UI_UX.md`
§Bilingual Layout Safety applies most sharply to these controls.

**Accessibility intent.** Set controls need labels that identify *which* set and
exercise. Finish must be clearly distinguished from add-set. Both are
**unverified intent**; the per-set editor is additionally constrained by
ADR-P023 (no programmatic `required`/`invalid` on native).

---

# Flow 6 — Nutrition logging

**Status: SHIPPED** (ADR-P012 / FEATURE-006). Native only; Web shows
**Web unavailable** across targets, plan, log and preferences.

## Flow

```
dashboard ──► [nutrition targets] ──► [nutrition plan] ──► [food log]
    │                 │                                        │
    │                 ├─ data-gap ──► profile-edit / progress   │
    │                 │               (named prerequisite)      │
    └──► [dietary preferences] ───────────────────────────────► │
              (exclusions, allergies)                           ▼
                                                    add / adjust servings
```

Targets are **computed**, not entered, so when the inputs they need are missing
the screen shows **Data-gap** — naming the specific input and routing to the
screen that owns it (profile or progress). This is the canonical Data-gap
implementation in the product and UX-3 should treat it as the reference.

## States

Loading, Empty (nothing logged today → invite the first entry), **Data-gap**
(missing profile/weight inputs), Error, Offline, Pending sync, Web unavailable.

**Copy intent.** Targets copy must be **advisory, never prescriptive or
medical** — this is a wellness product (ADR-P017 public-v1 rebaseline), and
copy must not drift toward clinical instruction. Adjustment explanations should
state the reason in plain language. Food-log copy is quantity-oriented and
needs correct EN/ES pluralization (the `*One` / `*Many` key pattern is SHIPPED
and must be preserved).

**Accessibility intent.** Serving steppers need labels stating the food and the
resulting quantity, not just "increase". **Unverified.**

---

# Flow 7 — Progress

**Status: SHIPPED** (Phase 17 / FEATURE-008). Native only; Web shows
**Web unavailable**, including a dedicated card-level variant for the dashboard
summary.

## Flow

```
dashboard ──[progress summary card]──► [progress]
                                          │
                          ┌───────────────┼────────────────┐
                          │               │                │
                    body weight     measurements     weekly snapshot
                    (log / trend)   (log / trend)    (volume, workouts,
                                                      deload signal)
```

The **summary card on the dashboard** is a distinct surface with its own states
(loading, no-weight-yet prompt, as-of date) and is many users' only daily
contact with progress. It must degrade honestly: when there is no weight yet it
**prompts**, it does not show a zero.

## States

Loading, Empty (no entries → prompt the first weigh-in), Error, Web unavailable.

Two of those differ between the two progress surfaces, and the difference is
specification-relevant:

- **Web unavailable — SHIPPED on both**, in two shapes: the full-screen state on
  `/progress`, and a **distinct compact card variant** on the dashboard summary
  card, which also drops the tap-to-open affordance.
- **Error — SHIPPED full-screen only.** `/progress` renders a load error and a
  **separate** inline save error. The **summary card has no Error treatment**: a
  failed read falls through to the ready arm and renders as Empty. That card
  treatment is **PROPOSED**, owned by **BUG-009** — applicable, not implemented.

**Corrected in v1.2: Progress renders neither Offline nor Pending sync.** Earlier
revisions listed both. The progress *data layer* does produce them — every write
lands as `sync_status = 'pending'`, and three `mark*Conflict` helpers are wired
into `sync-appliers.ts` — but no progress presentation file renders a pending
hint, an offline banner or a conflict affordance. Pending sync and Conflict are
**PROPOSED** on `/progress` and owned by **BUG-011**. Offline is different: no
authoritative connectivity signal reaches either progress surface at this commit,
so there is nothing for them to render — that is recorded as not applicable
*today*, not as a permanent limit. See **C-2** and **C-5** in
`.ai/18_SCREEN_STATE_MATRICES.md`.

**Copy intent.** Trends are **descriptive, not evaluative** — report what
changed, never praise or admonish. The deload signal is **informational**, not
an instruction, and must not read as medical advice. Always state **as-of**
recency, because progress data is the most staleness-sensitive surface in the
app and the offline model means "current" cannot be claimed.

**Accessibility intent.** Charts and trend bars require a **non-visual
equivalent** — a text summary conveying the same trend, since colour and shape
alone are insufficient. Specifying that equivalent is **UX-3 work**; it is
**not** verified today.

---

# Cross-cutting transition rules

1. **Session loss is global, and signing out is not erasure.** An explicit 401
   clears the session and returns to sign-in from anywhere.
   **Sign-out preserves local user data** — it clears the stored session only.
   **Account deletion is the only whole-account erasure path**: it is the sole
   flow that wipes the local database outright, and it is irreversible
   (ADR-P011).
   This says nothing about item-level deletion, which **does** exist throughout
   the product — individual body weights, measurements, routines, workout logs,
   custom exercises and dietary preferences can each be deleted from their own
   surfaces. Those are ordinary destructive actions on single records; only the
   whole-account path is unique.
2. **Data-gap always routes to the owning screen**, never to a generic settings
   page, and always names the missing input.
3. **Web unavailable is terminal for that surface.** No retry, no fallback
   fetch, no partial render. The only forward path is the mobile app.
4. **Offline never blocks navigation — within the authenticated, local-first
   native surfaces.** Dashboard, workout logging, nutrition logging and progress
   read and write local SQLite first, so they stay reachable and usable offline;
   only remote freshness is unknown.
   **This rule does not extend to everything.** It does **not** cover:
   - **sign-in and registration**, which authenticate against the API and
     require connectivity — the SHIPPED `connectivity` reason exists precisely
     for this;
   - **password recovery** (TARGET), which requires a server round-trip to issue
     a token and another to redeem it;
   - any other **remote-only action**, which must surface Error with the
     `connectivity` reason rather than pretending to succeed.
   Web has no offline model at all (ADR-P019), so the rule is native-only.
5. **Account deletion requires typed confirmation.** SHIPPED: the user types a
   confirmation phrase, and the copy states plainly that deletion is
   irreversible (ADR-P011).
   **This is the only destructive-action confirmation verified on `main`.** No
   general "every destructive action confirms" guarantee exists, and UX-3 must
   not assume one — if another destructive action is introduced, its
   confirmation is new work, not an inherited behaviour.
6. **Successful password reset returns to sign-in**, never straight into an
   authenticated session — every session was just revoked. (TARGET.)

---

# Unresolved risks

1. **No onboarding exists.** First-run is a dashboard of Data-gap states. The
   gaps route correctly, but nothing sequences them. Highest-impact V1 UX gap
   identified by this specification.
2. **Dangling medical route — repository defect, tracked as BUG-006.**
   `EvaluationHistory` is imported by no route and pushes to the non-existent
   `/evaluation-edit`. **Not SHIPPED behaviour**: dormant and user-unreachable
   (ADR-P017), so no user is affected — but a crash waiting for whoever revives
   the domain.
3. **Daily loops are three taps deep.** Food logging sits behind
   dashboard → nutrition → plan → log. Acceptable for V1; a real cost for a
   daily-use product.
4. **Accessibility outcomes are unverified across every flow.** ADR-P023 leaves
   `required`/`invalid` unsolved on native; ADR-P024 leaves error announcement
   unproven on all platforms. No manual VoiceOver / TalkBack / browser-AT pass
   has been run or scheduled. This is an open **V1 release-review gate**, not a
   documentation gap.
5. **Two input style families persist through V1** (ADR-P025), so flows cannot
   assume one input behaviour — notably the uncontrolled per-set reps editor.
6. **Emailed reset links open the Web page, not the app.** Universal / App Links
   need domain ownership and a native rebuild. Copy must not promise otherwise.
7. **Recovery is TARGET, verification is PROPOSED.** Neither is on `main`.
   Recovery additionally depends on external prerequisites (domain, SPF/DKIM/
   DMARC, Postmark account and token, click tracking off) that no code change
   can satisfy.
8. **Five light-theme AA contrast pairs remain unresolved** (`.ai/08_UI_UX.md`,
   FEATURE-010). Flow-independent, but it lands on every screen here.

---

# Recommended UX-3 follow-up

UX-3 (high-fidelity specifications) should proceed in this order, because each
step de-risks the next:

1. **Blocking decisions — delivered as UX-3A.** ADR-P027 chooses advisory
   onboarding, retains hub-and-spoke and defers bottom tabs.
2. **Per-screen state matrices — delivered as UX-3B.**
   `.ai/18_SCREEN_STATE_MATRICES.md` covers **10** state-bearing surfaces and
   binds each to its applicable subset of the eight states.
3. **EN/ES copy decks — delivered as the UX-3C documentation candidate.**
   `.ai/19_COPY_DECKS.md` ratifies the shipped state copy and specifies the
   missing copy for the recorded conformance gaps, advisory checklist and Food
   Log shortcut. Recovery still follows PR #102's merge; verification copy
   still waits for ADR-P026 Vertical 2 authorization.
4. **Next: specify the non-visual equivalent for progress charts** — the largest
   unspecified accessibility surface in the product.
5. **Schedule the manual AT verification pass** (VoiceOver, TalkBack,
   browser-AT), recorded per surface. Until it runs, no accessibility outcome in
   UX-2 or UX-3 may be reported as satisfied. This is the item most likely to be
   quietly skipped and the one that closes a real release gate.
6. **Defer motion specification** until the flows and states are fixed; motion
   describes transitions between states that must exist first.

UX-3 must not restate the design system, must keep the SHIPPED/TARGET/PROPOSED
distinction intact, and must not promote intent into a verified outcome.

---

# Related documents

- `.ai/08_UI_UX.md` — design system, canonical state patterns, component and
  form contracts, contrast evidence
- `.ai/18_SCREEN_STATE_MATRICES.md` — the UX-3B per-surface refinement of the
  §States sections above, with triggers, treatments and evidence
- `.ai/19_COPY_DECKS.md` — the UX-3C exact EN/ES state copy and proposed-key
  handoff
- `.ai/11_BACKLOG.md` — FEATURE-010 (UX stream), FEATURE-011 (recovery)
- `.ai/12_DECISIONS.md` — ADR-P017 through ADR-P027
- `.ai/06_MOBILE.md` — offline-first expectations
- `.ai/00_PROJECT.md` — product scope and decision hierarchy

---

# AI Instructions

Every AI agent working on AppFitness product flows must read this file before
proposing, specifying, or implementing a user-facing flow. Three rules are
binding.

## 1. Status claims require evidence

Every flow, screen and state carries exactly one of **SHIPPED**, **TARGET**,
**PROPOSED**, under the evidence rules in §Status vocabulary.

- **SHIPPED** requires a route, a component and a localization key on
  `origin/main`. Cite them.
- **TARGET** requires an accepted ADR **plus** an existing implementation that
  is **not on `main`**. Cite the ADR and the PR.
- **PROPOSED** means **no implementation exists anywhere**. It never implies
  code.

Never describe a TARGET or PROPOSED flow as something a user can do today.
Never promote a status because a change was merged elsewhere, reviewed, or
"basically done" — re-verify against `main` and update the evidence baseline
commit when you do. A repository defect that no user can reach is **none of the
three**; record it as a defect and file a backlog bug.

## 2. The state model is fixed at eight states

`.ai/08_UI_UX.md` §Canonical State Patterns defines exactly eight states,
approved by **ADR-P022** Decision 15: Loading, Empty, Data-gap, Error, Offline,
Pending sync, Conflict, Web unavailable.

**Do not add a ninth.** A new tone, a new message, or a transient render phase
is not a new state. Transient phases — a pre-hydration render, a skeleton, an
optimistic flash — are **sub-phases of Loading** and must be specified as such.

Preserve the distinctions that carry information: **Empty ≠ Data-gap**
(create here vs supply a named prerequisite elsewhere), and **Offline ≠ Error**
(keep working vs something failed). Collapsing either into a generic "something
is up" state is forbidden.

## 3. No accessibility claim without manual AT proof

This document and its successors specify accessibility **intent only**.

An accessibility outcome may **never** be reported as satisfied on the strength
of a unit test, a component test, or the presence of a prop. Announced states,
focus behaviour and screen-reader output are proven only by **manual VoiceOver,
TalkBack and browser-AT verification, recorded per surface**.

Respect the recorded constraints rather than working around them: **ADR-P023**
(no supported typed `required` / `invalid` exposure on native), **ADR-P024**
(`aria-live="polite"` requested, announcement unproven on every platform),
**ADR-P025** (two input style families persist through V1). If a flow needs a
capability these ADRs say does not exist, that is an ADR question, not a
specification detail.

## Scope reminder

This file specifies **flows**. Tokens, contrast, components, motion and state
contracts belong to `.ai/08_UI_UX.md`; decisions belong to
`.ai/12_DECISIONS.md`; work items belong to `.ai/11_BACKLOG.md`. Do not restate
them here, and never contradict them. Do not invent backend behaviour — cite
what exists or mark it PROPOSED.
