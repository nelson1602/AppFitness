# AppFitness Bilingual Surface Audit (public v1)

Version: 1.2
Status: Active
Last Updated: 2026-09-16

---

# Purpose

> **Partial reconciliation, 2026-09-16.** Two things have been discharged since
> this audit was written, and both are annotated in place rather than removed —
> the inventory is the evidence that the work list was complete.
>
> 1. §Handoff to Stage 1 item 2, by `.ai/22_BILINGUAL_QUALITY_REVIEW.md`.
> 2. **Findings F-4 … F-7, the Web document shell, by `BUG-016` and
>    `ADR-P032`** (2026-09-16). F-4, F-5 and F-6 are **corrected**; **F-7 is
>    accepted and recorded** — a single-language static export cannot carry a
>    per-visitor language, so the prerendered body stays English until
>    hydration. The findings below still describe what was true at `051aecd`.
>
> Every other section still describes `051aecd` and is unchanged.

This document discharges **Stage 1 item 1** of the route to publication in
`docs/RELEASE_READINESS.md`: the *exhaustive bilingual surface audit*. It is the
surface-by-surface counterpart to `.ai/18_SCREEN_STATE_MATRICES.md` (which
states) and `.ai/19_COPY_DECKS.md` (which words). Those two say what a surface
must show and how it must read. This one says, for every user-reachable public-v1
surface, **whether the thing the user actually sees comes from the bilingual
catalogues at all**.

The distinction matters because the previously recorded evidence was a key
count. At the audited baseline the catalogues held **1061 EN / 1061 ES keys at
exact parity**. Parity is necessary and **not sufficient**: a key can exist in
both languages and never reach a screen, and a screen can render a stored
identifier, an English literal, or an English fallback while parity stays
perfect. This audit replaces the count with a reachability proof in both
directions — every key traced to a surface, and every surface traced back to the
catalogue.

---

# What this document is not

- **Not the bilingual quality review.** Stage 1 item 2 owns wording, tone, and
  the correct locale formatting of dates, numbers and units — it has since run,
  as `.ai/22_BILINGUAL_QUALITY_REVIEW.md`. Where this audit
  found a formatting call site that bypasses the shared formatter, it is
  **recorded here and handed to that slice** — it is not corrected here. §Handoff
  to Stage 1 item 2 is the complete list.
- **Not a copy deck.** No wording is proposed, retranslated or restyled. The two
  keys this audit added carry values **byte-identical** to placeholders the
  catalogues already shipped.
- **Not an accessibility outcome.** Accessibility *text* is in scope — whether a
  label, hint or state description resolves through `t()`. Whether VoiceOver,
  TalkBack or a browser AT announces it correctly remains **UX-4C** and is not
  claimed.
- **Not a Web-parity claim.** Web stays the capability-limited surface of
  ADR-P018 / ADR-P019. The audit covers the three shipped Web portals and the
  canonical Web-unavailable state; it authorizes no Web scope.
- **Not a change to the dormant medical domain.** `mobile/src/features/medical/**`
  keeps its hardcoded English under ADR-P017 and is excluded by design, not by
  omission. Its 53 literal strings are counted and then set aside.

---

# Evidence baseline

Audited against `origin/main`
`051aecd56806e430291a39c4c872860c15f10794` on 2026-09-15, from the worktree
branch `codex/bilingual-surface-audit`.

At that commit:

| Measure | Value |
|---|---|
| Catalogue size | **1061 EN / 1061 ES**, 0 keys on either side only |
| Route entry points (`mobile/src/app/*.tsx`) | **20** — 18 screens, one redirect (`/`), one layout |
| Production source files scanned | **246** `.ts`/`.tsx` under `mobile/src`, excluding `*.spec.*`, `tests/`, `testing/` and the two catalogues |
| Keys named literally by production source | **1044** |
| Keys built at runtime from a closed domain | **16** |
| Keys reachable by neither | **1** (`sync.conflicts.meta.record`) |
| Literal user-facing strings outside the dormant medical domain | **27** |
| ES values byte-identical to EN | **8**, every one a word that is the same in Spanish |
| Keys with an EN/ES substitution-token mismatch | **0** |
| Empty catalogue values | **0** |

After the corrections in §Corrections applied the catalogues hold **1063 EN /
1063 ES**, still at exact parity, and **1046** keys are named literally.

---

# Method

Five mechanical passes, each reproducible from the repository alone. Passes 2–5
use the TypeScript compiler API against `mobile/tsconfig.json`, so they see the
program the app actually builds rather than a text approximation.

**Pass 1 — catalogue integrity.** Parse both resource modules; compare key sets,
detect empty values, and compare `{token}` substitution placeholders side by
side.

**Pass 2 — key → surface.** For every catalogue key, search production source
for a quoted occurrence. This covers `t('key')`, the `Record<…, TranslationKey>`
lookup maps, and the typed copy tables alike. Keys with no occurrence are then
matched against the runtime-constructed families, whose domains are read from
their union type aliases.

**Pass 3 — surface → key.** From each of the 20 route entry points, walk the
import closure and union the catalogue keys each reached module names. This
over-approximates per-route ownership, because the feature barrels
(`@/features/*`) re-export widely — deliberately so: an over-approximation
cannot *miss* a reachable key, which is the direction the proof needs.

**Pass 4 — literal user-facing text.** Walk every JSX text node and every string
literal assigned to a rendered or announced prop (`accessibilityLabel`,
`accessibilityHint`, `accessibilityValue`, `placeholder`, `title`, `label`),
across all of `mobile/src`.

**Pass 5 — locale-sensitive values.** Use the type checker to find every
expression of a numeric type rendered as a JSX child or interpolated into a
template literal, and subtract the calls that go through `formatNumber` /
`formatDate`.

A sixth, non-static pass exported the static Web build
(`npx expo export -p web`) and inspected the emitted HTML for the three shipped
portals.

---

# Surface inventory

## Route entry points

Every route is `mobile/src/app/<name>.tsx`. "Title" records whether the route's
`Stack.Screen options.title` resolves through `t()`. "Web" records whether the
route is reachable in the static Web export.

| # | Route | Title | Web | Public v1 | Notes |
|---|---|---|---|---|---|
| 1 | `/` | n/a | yes | yes | redirect; renders only the shared loading skeleton |
| 2 | `/sign-in` | `t()` | yes | yes | account surface; works on Web |
| 3 | `/forgot-password` | `t()` | yes | yes | **recovery portal** |
| 4 | `/reset-password` | `t()` | yes | yes | **recovery portal** |
| 5 | `/verify-email` | `t()` | yes | yes | **verification portal** |
| 6 | `/dashboard` | `t()` | yes | yes | Web-unavailable state |
| 7 | `/delete-account` | `t()` | yes | yes | **no Web-unavailable state** — see F-13 |
| 8 | `/profile-edit` | `t()` | yes | yes | Web-unavailable state |
| 9 | `/goal-edit` | `t()` | yes | yes | Web-unavailable state |
| 10 | `/nutrition` | `t()` | yes | yes | Web-unavailable state |
| 11 | `/nutrition-plan` | `t()` | yes | yes | Web-unavailable state |
| 12 | `/food-log` | `t()` | yes | yes | Web-unavailable state |
| 13 | `/dietary-preferences` | `t()` | yes | yes | Web-unavailable state |
| 14 | `/progress` | `t()` | yes | yes | Web-unavailable state |
| 15 | `/routines` | `t()` | yes | yes | Web-unavailable state |
| 16 | `/workout-log` | `t()` | yes | yes | Web-unavailable state |
| 17 | `/exercises` | `t()` | yes | yes | Web-unavailable state |
| 18 | `/wellness-safety-profile` | `t()` | yes | yes | Web-unavailable state |
| 19 | `/sync-conflicts` | `t()` | yes | yes | Web-unavailable state |
| 20 | `_layout` | n/a | n/a | yes | composition root; no copy |

**18 of 18 route titles resolve through `t()`.** `/` and `_layout` render no
title of their own.

Two further Web documents are emitted that the repository does not author:
`+not-found.html` and `_sitemap.html`. See **F-4**.

> **Since corrected (BUG-016 / ADR-P032).** `app/+not-found.tsx` is now
> authored, so `+not-found.html` is a product document with EN/ES catalogue
> copy and no sitemap link. `_sitemap.html` is still framework-generated and
> still unauthored; it renders outside the app root layout, which is why it is
> the one document that keeps an empty title (ADR-P032 §Consequences).

## Embedded surfaces

Each renders inside one or more routes above and owns copy of its own.

| Surface | File | Copy source |
|---|---|---|
| Dashboard screen | `features/dashboard/presentation/DashboardScreen.tsx` | `t()`, plus the `AppFitness` brand literal |
| Verification reminder | `…/components/verification-reminder-card.tsx` | `t()` |
| Wellness-safety recommendation | `features/wellness/presentation/WellnessSafetyRecommendationCard.tsx` | `t()` |
| Loading skeleton | `…/components/dashboard-skeleton.tsx` | `t()` (`common.loadingContentAccessibility`) |
| Sync status banner | `…/components/sync-status-banner.tsx` | `t()` + prepended counts |
| Data-gap card | `…/components/data-gap-card.tsx` | `t()` via `GAP_COPY`, English fallback behind it |
| Onboarding checklist | `…/components/onboarding-checklist-card.tsx` | `t()` + `{completed}`/`{total}` |
| Assessment summary | `…/components/assessment-summary-card.tsx` | `t()` + two runtime-built keys |
| Recommendation card | `…/components/recommendation-card.tsx` | `t()` via `recommendation-copy.ts`, English fallback behind it |
| Progress summary card | `features/progress/presentation/ProgressSummaryCard.tsx` | `t()` |
| Progress screen, trends, weekly, forms | `features/progress/presentation/*` | `t()` |
| Nutrition targets / plan / data gap | `features/nutrition/presentation/*` | `t()` |
| Food log screen, add form, stepper | `features/nutrition/presentation/food-log/*` | `t()` |
| Dietary preferences | `features/nutrition/presentation/DietaryPreferences.tsx` | `t()` |
| Workout library, builder, plan, log | `features/workout/presentation/*` | `t()` |
| Wellness safety screen, form, tokens | `features/wellness/presentation/*` | `t()` |
| Conflict screen and card | `features/sync-conflicts/presentation/*` | `t()` |
| Auth text field, shared primitives | `features/authentication/presentation/*`, `shared/presentation/*` | caller-supplied, no copy of their own |
| **Training plan card** | `features/workout/presentation/TrainingPlanCard.tsx` | **hardcoded English — unreachable**, see F-12 |

## Non-catalogue bilingual data

Two content catalogues carry their own Spanish, outside `en.ts` / `es.ts`:

| Catalogue | Canonical | Spanish | Coverage |
|---|---|---|---|
| Food names | `nutrition/infrastructure/food-catalog.data.ts` (300) | `food-catalog.es.ts` (300) | **300 / 300**, 0 missing, 0 orphan. 9 values are identical to English — `Tempeh`, `Natto`, `Hummus`, `Mango`, `Papaya`, `Tahini`, `Guacamole`, `Ghee`, `Tzatziki` — all correct Spanish loanwords. |
| Exercise names | `workout/infrastructure/exercise-catalog.data.ts` (33) | `exercise-catalog.es.ts` (33) | **33 / 33**, 0 missing, 0 orphan, 0 identical. |

Both resolvers (`foodDisplayName`, `exerciseDisplayName`) carry an English
fallback (`?? food.name`, `?? exercise.name`). Both fallbacks are **currently
unreachable** because coverage is total; the integrity specs that own those
catalogues keep it that way.

---

# Coverage proof

## Key → surface

| Class | Count | Evidence |
|---|---|---|
| Named literally by production source | 1044 | quoted occurrence in one of the 246 files |
| Built from `BmiCategory` | 4 | `assessment-summary-card.tsx:18` |
| Built from `Intensity` | 3 | `assessment-summary-card.tsx:23`, `recommendation-copy.ts:63` |
| Built from `RecommendationCategory` | 5 | `recommendation-card.tsx:19` |
| Built from `RecommendationPriority` | 4 | `recommendation-card.tsx:22` |
| Reachable by neither | 1 | `sync.conflicts.meta.record` — **F-8** |

The four runtime-built families use an `as TranslationKey` cast, which the
compiler cannot check. Each was verified **total over its union**: 4 of 4, 3 of
3, 5 of 5, 4 of 4 members resolve to a key present in both catalogues. That
totality is now asserted by
`mobile/src/shared/localization/surface-coverage.spec.ts` rather than asserted
here only.

## Surface → key

All 20 route closures together reach **1044** distinct catalogue keys — the same
1044, which is the two-directional check: nothing is referenced that no route can
reach, and nothing reachable is unreferenced.

| Route | Modules in closure | Keys reached |
|---|---|---|
| `/dashboard` | 182 | 702 |
| `/sync-conflicts` | 181 | 771 |
| `/food-log`, `/nutrition`, `/nutrition-plan`, `/progress`, `/routines`, `/workout-log`, `/exercises` | 173 | 595 each |
| `/wellness-safety-profile` | 85 | 117 |
| `/dietary-preferences` | 77 | 50 |
| `/profile-edit` | 70 | 49 |
| `/goal-edit` | 70 | 37 |
| `/reset-password` | 53 | 32 |
| `/forgot-password` | 51 | 27 |
| `/verify-email` | 51 | 19 |
| `/sign-in` | 49 | 27 |
| `/delete-account` | 49 | 17 |
| `/` | 50 | 7 |

The seven 595-key routes share a number because each pulls a feature barrel that
re-exports the others; the closure is an upper bound on what a route can reach,
not a claim about what it renders.

## Literal user-facing text

Pass 4 found **80** literal strings in rendered or announced positions across
`mobile/src`.

| Where | Count | Disposition |
|---|---|---|
| `features/medical/**` | 53 | **excluded** — dormant under ADR-P017 |
| `TrainingPlanCard.tsx` | 10 | **unreachable** — F-12 |
| `"AppFitness"` brand | 2 | **accepted** — frozen identity, ADR-P028 |
| `kcal` | 11 | **accepted** — unit symbol, identical in both languages |
| `kg` | 2 | **accepted** — unit symbol, identical in both languages |
| `placeholder="YYYY-MM-DD"` | 2 | **defect — corrected**, F-2 / F-3 |

Nothing else. Every other visible string, validation message, operational error,
empty/loading/offline/Web-unavailable state, button, accessibility label and
state description on a public-v1 surface resolves through `t()`.

### Validation messages

All five Zod form schemas expose a required message object and every call site
supplies **every** field from `t()`:

| Form | Messages | Call site |
|---|---|---|
| Profile | 7 | `ProfileForm.tsx:33` |
| Goal | 4 | `GoalForm.tsx:34` |
| Body weight | 4 | `BodyWeightForm.tsx:36` |
| Body measurement | 10 | `BodyMeasurementForm.tsx:37` |
| Wellness safety | 4 | `WellnessSafetyProfileForm.tsx:68` |

The English `DEFAULT_MESSAGES` in each schema module are reachable only through
the `…FormSchema` default instances, which are consumed **only** by type
declarations and specs — never rendered.

### Operational errors

No surface renders store, SQLite, HTTP or Prisma text. Authentication, password
recovery and email verification each map a typed reason enum onto a
catalogue key pair (`ERROR_COPY`, `RECOVERY_ERROR_COPY`,
`resolveVerifyState`), and the food log maps a `FoodLogWriteOperation`
discriminant onto one of three title/body pairs.

### Web-unavailable state

**14** surfaces render the canonical informational state, all through `t()`:
dashboard, nutrition targets, nutrition plan, food log, dietary preferences,
profile, goal, progress screen, progress summary card, exercise library, routine
builder, workout log, wellness safety profile, and `/sync-conflicts`.
`/delete-account` renders none — **F-13**.

## The Web portals

The static export (`app.json` → `web.output: "static"`) emits **21** HTML
documents — one per route, plus `+not-found` and `_sitemap`. Every one of the three shipped portals renders its copy through
`t()`; the defects are in the document shell the framework produces, not in the
screens.

| Observation | Evidence |
|---|---|
| Copy fully localized | `forgot-password.tsx`, `reset-password.tsx`, `verify-email.tsx` — every string, error arm and button resolves through `t()`; `forgot-password` additionally sends `locale: language` so the email matches the UI |
| `<html lang="en">` on every page | emitted markup, **21 of 21** documents — **F-5** |
| `<title>` empty on every page | `<title data-rh="true"></title>`, **21 of 21** documents — **F-6** |
| Prerendered body is English only | `forgot-password.html` contains `Reset your password`, `Send reset link` — **F-7** |
| `+not-found` is framework English | `expo-router/build/views/Unmatched.js` — **F-4** |

> **Re-exported 2026-09-16 after `BUG-016`.** Still 21 documents. All 21 now
> carry the pre-hydration language correction; 20 of 21 carry a non-empty title
> (`_sitemap.html` excepted); `+not-found.html` carries the catalogue copy and
> no `/_sitemap` link. The three portal documents are byte-identical to this
> baseline apart from the added title text, the inline script and the
> bundle/CSS hashes — the token-capture and hydration behaviour is untouched.

---

# Findings

Ordered by whether they were correctable inside this slice.

## Corrected — provable coverage and wiring defects

### F-1 — the food log rendered the stored serving unit

`FoodLogScreen.tsx` rendered `{item.serving.unit}` directly, so a Spanish log
showed `piece`, `cup`, `tbsp`, `tsp` and `slice` in English. `g` and `ml` read
the same in both languages, which is why the defect was invisible on the common
case.

The vocabulary was already shipped (`nutrition.unit.*`, seven keys) and already
used for the identical datum by **both** sibling surfaces —
`FoodLogAddForm.tsx:173` and `NutritionPlanScreen.tsx:102` — each composing it
the same way: amount, space, `t(UNIT_KEY[unit])`. The logged row was the single
outlier. No product decision was needed; the correction adopts the in-domain
convention that already exists twice.

One detail differs from the two siblings: a logged row stores its unit as a
plain `string` rather than a `ServingUnit`, because it comes back from SQLite.
The lookup is therefore by string and **falls back to the stored form** for an
unrecognised unit — the same fail-safe shape as `DataGapCard`. The coverage
spec keeps the map total over `ServingUnit`, which is what makes that fallback
unreachable.

### F-2 / F-3 — two date fields hinted the English format only

`ProfileForm.tsx:125` (birth date) and `BodyMeasurementForm.tsx:74`
(measurement date) hardcoded `placeholder="YYYY-MM-DD"`, while the Spanish
validation message the *same field* produces reads
`Usa AAAA-MM-DD` and `Usa el formato de fecha AAAA-MM-DD` respectively. The
field contradicted its own error.

Three sibling date fields were already localized — `goal.targetDatePlaceholder`,
`progress.weight.datePlaceholder` and
`wellness.safety.evaluation.datePlaceholder`, each `YYYY-MM-DD` / `AAAA-MM-DD`.
The correction adds two keys carrying those **exact** values. No new wording
enters the product.

## Recorded — needs new copy or a product/UX decision

### F-4 — the not-found screen is framework English in both languages

The repository defines no `app/+not-found.tsx`, so Expo Router's built-in
`Unmatched` screen serves every unmatched route, rendering `Unmatched Route`,
`Page could not be found.`, `Go back` and `Sitemap` — untranslated, and
`Sitemap` is a development affordance. This is reachable in public v1: a
mistyped, truncated or expired portal URL lands there, which is exactly the
moment a recovery user is already confused. Closing it needs a not-found screen
and its copy — **a copy decision this slice may not make**.

> **Corrected 2026-09-16 (BUG-016 / ADR-P032 §Decision 5).** `app/+not-found.tsx`
> replaces the generated route, renders `notFound.title` / `notFound.body` /
> `notFound.action` from both catalogues, offers one action to `/`, and offers
> no `/_sitemap` affordance.

### F-5 — the Web portals declare `lang="en"` for Spanish content

Every exported document carries `<html lang="en">`. A Spanish visitor to
`recovery.appfitnessrd.com` reads Spanish inside a document tagged English:
screen readers select the wrong voice and pronunciation rules, and browser
translation offers to translate Spanish "from English". Correcting it needs an
`app/+html.tsx` and a decision about how a **statically prerendered** document
can carry a per-visitor language — an architecture decision, not a copy fix.

> **Corrected 2026-09-16 (BUG-016 / ADR-P032 §Decision 3).** `app/+html.tsx`
> keeps `lang="en"` as the deterministic prerender fallback and inlines one
> synchronous `<head>` script that corrects it **before the body is parsed**,
> from the ADR-P018 language preference and the browser language list only.

### F-6 — every exported page has an empty `<title>`

`Stack.Screen options.title` is a native header title; it does not reach the Web
document title. Browser tab, bookmark, history entry and the screen-reader page
announcement are all empty on all three portals. Closing it needs both a
mechanism and a decision about what the title should say (brand only, route
only, or both).

> **Corrected 2026-09-16 (BUG-016 / ADR-P032 §Decision 4).** The mechanism is
> `expo-router/head` — React Navigation’s document-title integration is
> switched off in `ExpoRoot`, and a `<title>` in `+html.tsx` would be spliced in
> *after* Helmet’s and ignored. The decision is **both**: the product title
> `AppFitnessRD` by default, and the portals’ own existing screen-title keys for
> the three portals, so no new copy entered the product.

### F-7 — the static prerender embeds English copy regardless of visitor

`forgot-password.html` ships `Reset your password` and `Send reset link` in its
markup. A Spanish visitor sees English until hydration replaces it. This follows
from a single-language static prerender and is the same architecture decision as
F-5: per-locale prerendering, or an accepted and documented flash.

> **Accepted, not corrected, 2026-09-16 (BUG-016 / ADR-P032 §Decision 2).** The
> decision is the documented flash. `web.output: "static"` prerenders every
> document once, in Node, with no visitor, so the build cannot know a visitor’s
> language; per-locale prerendering and edge routing were considered and
> deferred as infrastructure. The `lang` half — the half with the accessibility
> consequence — is corrected before first paint, and the residual is now tested
> as accepted rather than implied to be fixed.

### F-9 — the account-deletion confirmation phrase is untranslated

`delete-account.tsx:10` fixes `CONFIRM_PHRASE = 'DELETE'` and substitutes it into
`account.delete.confirmInstruction` (`Escribe {phrase} para confirmar`). A
Spanish user is asked, in Spanish, to type an English word. Whether the phrase
should be localized is a **product and safety decision** — a translated phrase
changes what the guard actually guards — so it is recorded, not changed.

## Recorded — documentation stale against code

### F-8 — `sync.conflicts.meta.record` is catalogued but never rendered

`.ai/19_COPY_DECKS.md` records the key as **SHIPPED**, sourced from
`entityKind`. `conflict-card.tsx` instead names the record by its kind in the
card title, via `recordLabel()` → `sync.conflicts.record.*`, and renders no
`Record:` metadata row. The key is reachable from no surface. Adding the row
would change the card's visual design, so the **deck row is corrected to
describe what ships** and the key is recorded as a deliberate orphan, pinned by
the new coverage spec.

## Recorded — verified safe, with a residual risk worth naming

### F-14 — the recommendation copy adapter falls back to raw English

`recommendation-copy.ts` maps six rule ids onto catalogue keys and falls through
to the engine's own `title` / `explanation` / `scientificBasis` — English
literals — for anything else. The engine can emit **eight** ids; the three
uncovered ones are `SAFETY:bp_crisis_block`, `SAFETY:medical_clearance` and
`SAFETY:movement_exclusions`. All three fire only from `restrictions` or
`bloodPressure`, and `icoach-adapter.ts:135` supplies `restrictions: []` with no
blood pressure at all, under ADR-P017 dormancy. **Unreachable in public v1**,
and now pinned by a spec so a future adapter change cannot silently make English
medical copy reachable.

### F-15 — the data-gap cards fall back to raw English

`DataGapCard` (`:51-52`) and `NutritionDataGap` (`:69`) fall back to the
requirement's own English `title` / `detail` for an unmapped id. `GAP_COPY`
covers all six ids `icoach-adapter.ts` emits, and `GAP_DETAIL_KEY` covers all
four the nutrition filter admits, so neither fallback fires today. Both existing
specs deliberately exercise the fallback, so the behaviour stays; the **totality
in front of it** is what the new spec pins.

### F-16 — four unchecked `as TranslationKey` casts

Listed under §Coverage proof. Total over their domains today; now asserted.

### F-12 — `TrainingPlanCard` is unreachable dead UI with medical framing

`features/workout/presentation/TrainingPlanCard.tsx` is imported by nothing but
its own spec. It carries ten hardcoded English strings including
`Training is on hold`, `Medical clearance recommended`, and
`Your iCoach assessment has paused training based on your medical information` —
framing that ADR-P017 and `00_PROJECT.md` §Non-Goals exclude from public v1. It
is **not deleted here**: removing a component and its spec is outside an audit's
mandate. It is instead recorded, exempted explicitly in the coverage spec, and
that spec now **fails if any production module imports it** — so it cannot reach
a user without the copy and scope questions being answered first.

### F-13 — `/delete-account` has no Web-unavailable state

The route is reachable on Web from the dashboard, and `deleteAccount()` wipes the
local database, which is dormant on Web. The failure is caught and surfaced as
the localized `account.delete.errorMessage`, so nothing untranslated reaches the
user — but the route presents a generic failure where every other
database-backed surface presents the canonical informational state. This is an
**ADR-P019 state-coverage** observation, not a copy defect, and
`docs/RELEASE_READINESS.md` §Web boundary does not list the route either way.

---

# Handoff to Stage 1 item 2 (bilingual quality)

> **Discharged 2026-09-16** by `.ai/22_BILINGUAL_QUALITY_REVIEW.md`. Every site
> below now resolves through `formatNumber`, and
> `mobile/src/shared/localization/localized-formatting.spec.ts` fails if one
> stops. The inventory is kept **exactly as the audit recorded it**, because it
> is the evidence that the work list was complete: re-running this pass against
> the quality slice reproduced these 43 sites and no others. Where a row
> described a defect that is now fixed, it says so inline — nothing is deleted.

Every locale-sensitive value that bypasses the shared formatter, found by type
rather than by name. **None of these is corrected here**: locale formatting of
dates, numbers and units is that slice's stated scope.

## Fractional values — wrong in Spanish today

**Fixed.** All three now go through `formatNumber`; `FoodLogScreen.spec.tsx` and
`WorkoutLogScreen.spec.tsx` pin `0,25×`, `1,5 porciones` and `82,5 kg`.

Spanish uses a comma as the decimal separator (`Intl` gives `25,9` and `0,25`),
so any fractional value rendered without `formatNumber` is wrong in Spanish now.

| Site | Value | Rendered |
|---|---|---|
| `food-log/ServingStepper.tsx:12` `formatServingCount` | serving count | `0.25`, `1.5` — in the visible `×` label **and** the accessibility label (`:70`, `:73`) |
| `FoodLogScreen.tsx:210` | serving count | same helper, in the row's accessibility label |
| `WorkoutLogScreen.tsx:514` | `set.weightKg` | `82.5 kg` rather than `82,5 kg` |

## Thousands grouping — inconsistent in English today

**Fixed.** The food log renders the same datum through the same formatter as
Nutrition targets and the assessment card.

`Intl` groups four-digit numbers in `en-US` (`2,500`) but not in `es` (`2500`).
Two shipped surfaces therefore disagree **in English** about the same datum:

- `NutritionTargets.tsx:139` renders `formatNumber(nutrition.calories)` → `2,500 kcal`
- `FoodLogScreen.tsx:298` renders `{nutrition.calories}` → `2500 kcal`

## Complete list of user-facing numeric renders without the formatter

**43 sites across 8 public-v1 presentation files.** Excluded from the count:
seven internal uses (`testID`, React keys, ISO date construction) and the two
inside the unreachable `TrainingPlanCard`.

| File | Sites | Values |
|---|---|---|
| `dashboard/…/sync-status-banner.tsx` | 3 | conflict, pending and failed counts |
| `nutrition/…/FoodLogScreen.tsx` | 12 | sync counts, serving amount, consumed calories and macros, daily totals and target |
| `nutrition/…/NutritionPlanScreen.tsx` | 4 | day number, including one accessibility label |
| `nutrition/…/NutritionTargets.tsx` | 3 | adjustment %, macro grams, kcal |
| `nutrition/…/food-log/FoodLogAddForm.tsx` | 4 | serving amount and calories, search result and selection |
| `workout/…/ExerciseLibrary.tsx` | 1 | routine reference count |
| `workout/…/GeneratedWorkoutPlan.tsx` | 11 | session number, rep range, seconds, sets, rest, target RPE, progression rule |
| `workout/…/WorkoutLogScreen.tsx` | 5 | set number (visible and in four accessibility labels), weight |

Note that `.ai/19_COPY_DECKS.md` §Copy rules rule 5 states that the `*One` /
`*Many` fragments "prepend a **localized** number". The shipped components
prepend a raw one. For the value ranges involved the two agree except where
noted above.

**Resolved 2026-09-16.** The rule was right and the code was wrong, so the code
changed; the deck row is unmodified.

## Date and instant formatting

Every date and instant on a public-v1 surface **does** go through `formatDate`:
`ProgressScreen.tsx:60`, `:183`, `ProgressSummaryCard.tsx:95`,
`WeeklySnapshotSummary.tsx:59`, `conflict-value.ts:102`, `:149`, `:156`. The only
`Date` arithmetic outside it builds an ISO `YYYY-MM-DD` storage string, which is
data, not display.

## Other items for the quality slice

- `formatNumber`'s Spanish locale is `'es'`, not a region — grouping and
  separators therefore follow the generic Spanish CLDR data rather than any
  target market's. Deliberate or not, it is unrecorded. **Now recorded** and
  deliberately preserved: `OBS-BQR-5`.
- `food-display.service.ts:21` calls `toLocaleLowerCase()` with no locale, so
  search normalization follows the runtime default. Harmless for `en`/`es`.
- `progress.measurements.muscleMassRange` and `progress.measurements.atLeastOne`
  are validation messages living in the `progress.measurements.*` namespace
  while their eight siblings live in `progress.validation.*`.
- `kcal` and `kg` are rendered as literals at 13 sites. Both are identical in
  both languages, and no catalogue key exists for either — unlike the seven
  `nutrition.unit.*` keys. Consistency, not correctness. **Kept as literals**:
  they are language-neutral and consistent, and inventing copy to wrap them was
  out of scope.

---

# Corrections applied

Three code corrections and one documentation correction. All four are provable
from shipped evidence, and all three code changes are **behavior-preserving in
English**.

| # | Change | Why it is safe |
|---|---|---|
| F-1 | `FoodLogScreen.tsx` resolves `item.serving.unit` through a `UNIT_KEY` map | The map is byte-identical to the two already in `FoodLogAddForm.tsx` and `NutritionPlanScreen.tsx`; the seven EN values equal the stored tokens, so **English output is unchanged** |
| F-2 | `profile.birthDatePlaceholder` added; `ProfileForm.tsx` uses it | Values identical to three shipped date placeholders; English output unchanged |
| F-3 | `progress.measurements.datePlaceholder` added; `BodyMeasurementForm.tsx` uses it | Same |
| F-8 | `.ai/19_COPY_DECKS.md` metadata row corrected | Documentation only |

Catalogues move from 1061/1061 to **1063/1063**, still at exact parity.

## Regression guards

`mobile/src/shared/localization/surface-coverage.spec.ts` (16 assertions) is the
enforcement arm of this document. It reads shipped source rather than a copy of
it, following `conflict-vocabulary.spec.ts`:

- key-set parity, no empty value, matching `{token}` sets;
- every key whose EN value is `YYYY-MM-DD` has the Spanish `AAAA-MM-DD`;
- every key is named literally **or** listed in a documented dynamic/orphan set
  — the assertion is set equality, so a new orphan and a stale exemption both
  fail;
- each of the four runtime-built families is total over its union;
- every `ServingUnit` resolves to a key in both languages;
- no public-v1 surface assigns a literal to a rendered or announced prop;
- `TrainingPlanCard` is imported by no production module;
- `FoodLogScreen` resolves the unit through the catalogue and never renders the
  stored token;
- `GAP_COPY` is total over the ids `icoach-adapter.ts` emits;
- the adapter still supplies `restrictions: []` and no blood pressure.

Plus four component assertions: the serving unit renders as `1 piece` / `1
unidad` (`FoodLogScreen.spec.tsx`) and the birth-date placeholder renders
`YYYY-MM-DD` / `AAAA-MM-DD` (`ProfileForm.spec.tsx`).

---

# Verdict

**Coverage for public v1 is complete on mobile and incomplete on Web.**

- **Mobile.** Every user-reachable public-v1 surface resolves its visible text,
  validation and operational errors, empty / loading / offline / data-gap /
  pending / conflict / Web-unavailable states, placeholders, buttons and
  accessibility labels through the bilingual catalogues. The three exceptions
  found are the frozen brand name, two unit symbols that are identical in both
  languages, and the two date placeholders corrected here.
- **Web.** The three shipped portals are fully localized **as screens**. The
  document shell was not: fixed `lang="en"` (F-5), empty `<title>` (F-6), an
  English-only prerender (F-7), and a framework-English not-found screen (F-4).
  None was correctable without new copy or an architecture decision — both of
  which `BUG-016` and **ADR-P032** have since supplied. **As of 2026-09-16 F-4,
  F-5 and F-6 are corrected and F-7 is accepted and recorded**; the paragraph
  above describes `051aecd` and is kept as the evidence baseline.

**This is not a translation-quality claim.** Wording, tone and locale formatting
remain Stage 1 item 2, and §Handoff is its input — **consumed on 2026-09-16** by
`.ai/22_BILINGUAL_QUALITY_REVIEW.md`.

---

# Related documents

- `.ai/22_BILINGUAL_QUALITY_REVIEW.md` — Stage 1 item 2, which discharges
  §Handoff above
- `.ai/12_DECISIONS.md` — **ADR-P032**, which settles F-4 … F-7
- `.ai/11_BACKLOG.md` — `BUG-016` (Done), `FEATURE-014`
- `docs/RELEASE_READINESS.md` — Stage 1 items 1 and 2
- `.ai/18_SCREEN_STATE_MATRICES.md` — which states each surface has
- `.ai/19_COPY_DECKS.md` — what each state says
- `.ai/20_PROGRESS_NONVISUAL.md` — the non-visual equivalent for Progress
- `.ai/12_DECISIONS.md` — ADR-P017 (dormancy), ADR-P018 / ADR-P019 (Web),
  ADR-P022 (states), ADR-P023 / ADR-P024 (input and error accessibility),
  ADR-P026 (recovery and verification), ADR-P028 (identity), ADR-P030 (conflicts)
- `.ai/11_BACKLOG.md` — the open items this audit recorded

---

# AI Instructions

## 1. Parity is not coverage

Never cite an EN/ES key count as evidence that a surface is bilingual. The
claim requires a path from a rendered element to a catalogue key. If you cannot
show the path, you do not have the claim.

## 2. Reuse shipped vocabulary; do not invent wording

A coverage defect may be corrected only when the intended meaning already exists
— in an accepted document or in a value the catalogues already ship. If the fix
needs a sentence nobody has approved, record it and stop.

## 3. An unreachable fallback is a finding, not a fix

Several surfaces fall back to English by design and are covered by their own
specs. Do not remove those fallbacks. Assert the **totality of the map in front
of them** instead, so the fallback stays unreachable.

## 4. Formatting is the other slice

A number, date or unit that bypasses `formatNumber` / `formatDate` belongs in
§Handoff. Do not correct it here, and do not treat "looks the same today" as
"is correct". That slice has since run: the rule it enforces now lives in
`mobile/src/shared/localization/localized-formatting.spec.ts`, so a new bypass
fails CI rather than waiting for an audit.

## 5. Dormant is excluded, not forgotten

`features/medical/**` keeps hardcoded English under ADR-P017. Count it, set it
aside, and never make it reachable. The same holds for `TrainingPlanCard` until
its scope question is answered.

## 6. Status claims carry their evidence

A row here says what was verified, at which commit, by which pass. A claim
without that is a guess, and this document does not carry guesses.
