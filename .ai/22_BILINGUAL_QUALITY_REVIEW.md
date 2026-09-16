# AppFitness Bilingual Quality Review (public v1)

Version: 1.0
Status: Active
Last Updated: 2026-09-16

---

# Purpose

This document discharges **Stage 1 item 2** of the route to publication in
`docs/RELEASE_READINESS.md`: the *bilingual quality* review beyond coverage.

`.ai/21_BILINGUAL_SURFACE_AUDIT.md` (Stage 1 item 1) proved **where the words
come from** — that every reachable public-v1 surface resolves its text through
the bilingual catalogues. It said nothing about whether those words read
correctly, and it deliberately left every locale-formatting defect it found
uncorrected, in a §Handoff section written for this slice. This document is the
other half: **the numbers between the words**, and the wording defects that are
provable from the repository rather than a matter of taste.

Its §Handoff input is now discharged. The 43 inventoried user-facing numeric
renders go through the shared formatter, the three fractional sites that were
wrong in Spanish are right, and the calorie total that read `2,500` on one
screen and `2500` on another in English now reads the same on both.

---

# What this document is not

- **Not a native-speaker certification.** No such claim is made and none is
  supported. What is claimed is narrower and checkable: the defects listed in
  §Corrections applied are each provable from shipped evidence, and the items in
  §Recorded for owner review are each stated with the keys and counts that
  produce them.
- **Not a retranslation.** 1063 keys were read in both languages, side by side.
  **Three** values changed. Nothing was restyled, no register was harmonized,
  and no approved deck row was overridden — see §Why some real inconsistencies
  were not corrected.
- **Not a locale-mapping change.** `formatNumber` and `formatDate` still map
  `en` → `en-US` and `es` → generic `es`. Moving Spanish to a regional locale
  changes grouping and separators for every shipped Spanish number and is an
  owner decision with an ADR, not a review finding — **OBS-BQR-5**.
- **Not a change to the dormant medical domain**, to `TrainingPlanCard`, to the
  BUG-016 Web-shell architecture, to visual design or to payments. All are out
  of scope by instruction and untouched.
- **Not an accessibility outcome.** Accessibility *text* is in scope, and this
  slice adds the assertion that an announced number equals the visible one.
  Whether VoiceOver, TalkBack or a browser AT reads it correctly remains
  **UX-4C** and is not claimed.

---

# Evidence baseline

Reviewed against `origin/main`
`96c81df` on 2026-09-16, from the worktree branch
`codex/bilingual-quality-review`.

| Measure | Before | After |
|---|---|---|
| Catalogue size | 1063 EN / 1063 ES, exact parity | **1063 / 1063**, exact parity |
| Catalogue values changed | — | **3** (1 ES, 1 EN/ES token pair) |
| User-facing numeric renders bypassing `formatNumber` | **43** | **0** |
| Accepted non-display numeric bypasses on a surface | not separated | **1**, recorded by name |
| `Intl` constructed outside `shared/localization/format.ts` | 0 | **0** |
| Mobile suite | 195 suites / 2618 tests | **196 suites / 2631 tests** |

---

# Method

**Pass A — locale-sensitive values, by type.** The audit's Pass 5 was re-run
against `mobile/tsconfig.json`: every expression of a numeric type rendered as a
JSX child or interpolated into a template literal, minus the calls that already
go through `formatNumber` / `formatDate`. It reproduced the audit's inventory
**exactly** — the same 43 user-facing sites across the same 8 files, plus the
same seven internal uses (three `testID`s, two React keys, one ISO date
construction) and the two inside the unreachable `TrainingPlanCard`. That
agreement is what makes the inventory trustworthy as a work list.

The pass is no longer a script that was run once. It is
`mobile/src/shared/localization/localized-formatting.spec.ts`, and it runs on
every CI job — see §Regression guards.

**Pass B — the catalogues, read in both languages.** All 1063 key/value pairs
were read as EN/ES couples rather than as two files, which is the only way a
meaning mismatch is visible at all. Every candidate defect was then checked
against three things before being treated as one: the other catalogue values
that already ship the same idea, `.ai/19_COPY_DECKS.md`, and the behaviour the
code actually produces.

**Pass C — composition.** Values that are assembled at runtime were read as the
user receives them, not as they sit in the catalogue. This is where the
`{count}` defect below was found: both halves were correct on their own and the
sentence they produced was not.

**Pass D — dates, units and accessibility parity.** Every `formatDate` call site
and every `kcal` / `kg` literal was re-checked, and the announced value of each
migrated site was compared against its visible one.

---

# Corrections applied

Three catalogue values and nine presentation modules. Every change is either
mechanical (a value now passes through the shared formatter) or a defect that is
provable from evidence the repository already ships.

## The formatter migration

All **43** inventoried sites now resolve through `formatNumber`. Storage and
domain values are untouched — the change is at the presentation boundary only,
and every `testID` is byte-identical.

| File | Sites | What was raw |
|---|---|---|
| `dashboard/…/sync-status-banner.tsx` | 3 | conflict, pending and failed counts |
| `nutrition/…/FoodLogScreen.tsx` | 12 | sync counts, serving amount, consumed calories and macros, daily totals and target |
| `nutrition/…/NutritionPlanScreen.tsx` | 4 | day number, including one accessibility label |
| `nutrition/…/NutritionTargets.tsx` | 3 | adjustment %, macro grams, kcal |
| `nutrition/…/food-log/FoodLogAddForm.tsx` | 4 | serving amount and calories, search result and selection |
| `workout/…/ExerciseLibrary.tsx` | 1 | routine reference count |
| `workout/…/GeneratedWorkoutPlan.tsx` | 11 | session number, rep range, seconds, sets, rest, target RPE, progression rule |
| `workout/…/WorkoutLogScreen.tsx` | 5 | set number (visible and in four accessibility labels), weight |

`food-log/ServingStepper.tsx` is the ninth module: `formatServingCount` now
takes the language and delegates to `formatNumber`. Its hand-rolled
`Number.isInteger` special-case is gone, because `Intl` already drops trailing
zeros — `format.spec.ts` pins that, since the helper now depends on it.

**Three defects this closes**, each named by the audit:

1. **Fractional values were wrong in Spanish.** Serving counts step by `0.25`,
   so a fraction is the ordinary case rather than an edge one: `0.25` and `1.5`
   reached every Spanish reader unchanged, in the visible `×` label, in the
   stepper's announced value and in the logged row's accessibility label. Set
   weight had the same defect (`82.5 kg` for `82,5 kg`).
2. **The calorie total disagreed with itself in English.** `NutritionTargets`
   and the dashboard assessment card render `formatNumber(calories)` → `2,500`;
   the food log rendered the same datum raw → `2500`. One screen was right and
   the other was not, and which was which is not a matter of opinion: `Intl`
   groups four-digit numbers in `en-US`.
3. **`.ai/19_COPY_DECKS.md` §Copy rules rule 5 was contradicted by the code.**
   The rule states that the `*One` / `*Many` fragments "prepend a **localized**
   number"; the shipped components prepended a raw one. The rule was correct
   and the code was not, so the code changed. **The deck needed no edit.**

## `workout.plan.afterSessions` — the number was outside its own sentence

| | Before | After |
|---|---|---|
| Key (EN) | `After successful sessions` | `After {count} successful sessions` |
| Key (ES) | `Después de sesiones exitosas` | `Después de {count} sesiones exitosas` |
| Rendered (EN) | `After successful sessions 2: increase load by 2.5%` | `After 2 successful sessions: increase load by 2.5%` |
| Rendered (ES) | `Después de sesiones exitosas 2: aumenta la carga en 2,5%` | `Después de 2 sesiones exitosas: aumenta la carga en 2,5%` |

The component appended the count after the phrase instead of placing it inside,
which is ungrammatical **in both languages**. Not a wording change: every word
is the one that already shipped, in the same order, and the only thing that
moves is the number. The key is governed by no deck. Both specs that pinned the
old output are updated, and the count now goes through `formatNumber` like every
other migrated site.

## `auth.reset.successBody` (ES) — the Spanish said the devices closed

| | Value |
|---|---|
| EN | `Sign in with your new password. Every other device was signed out.` |
| ES before | `Inicia sesión con tu nueva contraseña. Los demás dispositivos se cerraron.` |
| ES after | `Inicia sesión con tu nueva contraseña. Se cerró la sesión en los demás dispositivos.` |

`los dispositivos se cerraron` says the devices themselves shut down. The fact
being reported is a security fact — the *sessions* ended — and the Spanish did
not report it. The replacement is not new wording: `auth.reset.subtitle` already
ships `cierra la sesión en todos los dispositivos` for the same fact, two keys
above it. Recovery copy is owned by FEATURE-011 and is deliberately not
tabulated in `.ai/19_COPY_DECKS.md`, so no deck row is affected.

## `progress.weight.weightPlaceholder` (ES) — investigated, deliberately unchanged

This one looked like the clearest correction in the catalogue and is recorded
here because it is not. The Spanish hint reads `p. ej., 80.5` — an English
decimal point, for the one field whose value the app renders back as `80,5`
(`ProgressScreen.spec.tsx`, `ProgressSummaryCard.spec.tsx` and
`TrendBars.spec.tsx` have each asserted that output for some time).

Changing the hint to `p. ej., 80,5` was drafted and then **reverted**, because
the field cannot accept what it would have asked for. `weightKg` is parsed by
`z.coerce.number()` (`progress-forms.schema.ts:66`), which is `Number('80,5')` —
`NaN` — so a Spanish user following the corrected hint would be told their
weight must be greater than 0. The hint as shipped describes the **input**
contract correctly; what is wrong is that the field accepts only a dot and
displays only a comma.

That asymmetry is the real defect, and closing it means a locale-aware numeric
parser — new input behaviour, not a copy change. Recorded as **OBS-BQR-6**.

## `interpolate` — one substitution path instead of three

`translate()` takes a key and nothing else, so every `{token}` value is composed
by its caller. Two callers had grown byte-identical private `template()`
helpers, and this slice needed a third. Rather than add one,
`shared/localization/format.ts` now exports `interpolate`, and
`recommendation-copy.ts` and `onboarding-checklist-card.tsx` use it in place of
their copies. Behaviour is unchanged — the specs that covered both were untouched
and still pass.

The contract is worth stating because it is what keeps a substituted number
correct: **`interpolate` places text and never formats it.** A number is passed
through `formatNumber` first. `format.spec.ts` asserts that.

`delete-account.tsx` keeps its single `.replace('{phrase}', …)`. Its token is an
English constant under an open product decision (**OBS-BSA-1**), not a localized
value, and folding it in would imply a decision this slice may not make.

---

# Dates, units and accessibility parity

**Dates.** Every public-v1 display date still goes through `formatDate`, at the
same call sites the audit traced. `Intl.DateTimeFormat` and
`Intl.NumberFormat` are constructed in exactly one module,
`shared/localization/format.ts`, and `toLocaleDateString` / `toLocaleString` /
`toLocaleTimeString` appear nowhere in `mobile/src`. Both facts are now
asserted. The only remaining `Date` arithmetic outside the formatter builds the
ISO `YYYY-MM-DD` storage key that seeds the entry forms; it is data, not
display, and it is the single recorded exemption.

**Units.** `kcal` and `kg` remain literals at their shipped sites. Both read
identically in English and Spanish, no catalogue key exists for either, and the
instruction was explicit: do not invent copy to wrap them. They are consistent
as they stand, and the migration did not add or remove one. The seven
`nutrition.unit.*` keys keep covering the units that *are* words.

**Accessibility parity.** Every migrated accessibility label now carries the
same formatted value as the element it describes, because both read the same
expression. Three assertions pin it where it is most load-bearing: the serving
stepper's announced value equals its visible `×` label (`1,5 porciones` against
`1,5×`), the logged row's own label carries the same count, and the set-weight
row renders `82,5 kg` with the stored `82.5` untouched.

---

# Recorded for owner review

None of the following is corrected here. Each is real and each needs a decision
this slice may not make — a glossary, a register, or an approved deck row.

## OBS-BQR-1 — two Spanish vocabularies for the same movement domain

`workout.movement.*` (rendered by `ExerciseExclusionNote`, reachable from
`RoutineBuilder`) and `wellness.safety.movement.*` (rendered by
`WellnessSafetyProfileForm`) name the same 18 shared movement tokens. **Twelve**
carry different Spanish. **Eight** of those twelve carry *identical* English,
so the divergence is Spanish-side only:

| Token | EN (both) | `workout.movement.*` | `wellness.safety.movement.*` |
|---|---|---|---|
| `running` | Running | carrera | Correr |
| `sprinting` | Sprinting | carrera de velocidad | Esprintar |
| `overheadPress` | Overhead press | press sobre la cabeza | Press por encima de la cabeza |
| `dips` | Dips | fondos | Fondos en paralelas |
| `heavyPressing` | Heavy pressing | press con carga alta | Empujes con carga alta |
| `frontRackLoading` | Front-rack loading | carga en posición frontal | Carga en rack frontal |
| `loadedCarries` | Loaded carries | caminatas con carga | Transportes con carga |
| `maxEffortLifts` | Maximum-effort lifts | levantamientos de esfuerzo máximo | Levantamientos al máximo esfuerzo |

Two of the remaining four are worth naming separately:

- `workout.movement.goodMorning` is **`buenos días`** — indistinguishable from
  the greeting when it appears in a comma-separated list of movements. The
  wellness catalogue calls the same movement `Flexión de tronco con barra`.
- `skullCrushers` differs only by `acostado` (workout) against `tumbado`
  (wellness); `tumbado` is peninsular.

Choosing one vocabulary is a glossary decision over safety-adjacent copy, and
the two namespaces render on different surfaces with deliberately different
English granularity. It is recorded, not resolved.

## OBS-BQR-2 — Spanish register is mixed, and English apostrophes are mixed

Two shipped forms of the same term, in a product whose stated audience is
Latin-American:

| Term | Latin-American form | Peninsular form |
|---|---|---|
| *qualified professional* | `calificado` — `nutrition.plan.disclaimer` | `cualificado` — `wellness.safety.disclaimerBody`, `wellness.safety.recommendation.body` |
| *Enter …* | `Ingresa` — 2 keys, both `progress.measurements.*` | `Introduce` — 12 keys across `auth`, `profile`, `goal`, `progress`, `wellness` |

The `cualificado` pair is **approved copy**: both rows are `SHIPPED` in
`.ai/19_COPY_DECKS.md` §Wellness safety, and
`wellness-safety-copy.spec.ts:60` asserts the exact phrase. The `Introduce`
majority would have to move toward `Ingresa`, not the other way, to serve the
register — which is 12 keys of churn for a preference. Both are one decision,
made once, for the whole catalogue.

Separately, English contractions are written with a typographic `’` in 6 keys
and a straight `'` in 50. Cosmetic, consistent within each cluster, and listed
here so a future style pass has the counts.

## OBS-BQR-3 — the conflict card names a field differently from the form that edits it

| Key | Spanish |
|---|---|
| `profile.fitnessLevel` — the label on the form the user edits | `Nivel de condición física` |
| `sync.conflicts.field.fitness_level` — the same field, in the conflict card | `Nivel de acondicionamiento` |

The English is `Fitness level` on both. A conflict card exists to name the field
the user changed, so naming it differently from the field itself is a real
defect — but `.ai/19_COPY_DECKS.md` is, in its own words, "the authority on this
wording" for the ADR-P030 C-5 family, and `conflict-catalogue.spec.ts` asserts
the catalogue matches the deck **exactly**. Correcting it means amending an
approved deck row, which is the deck owner's call. The same family renders
`Meta de calorías` against `Peso objetivo` for two targets on one card.

## OBS-BQR-4 — the `+N` progression instruction reads as an appended token

`add repetitions +2` / `agrega repeticiones +2`, and the same shape for seconds.
Unambiguous, but the number sits outside the phrase in the way
`workout.plan.afterSessions` did before this slice. Unlike that key, repairing
it needs wording nobody has approved (`add 2 repetitions` changes the sentence),
so it is recorded rather than changed.

## OBS-BQR-5 — Spanish is a generic locale, not a regional one

`formatNumber` maps `es` → `es`, so grouping and separators follow generic
Spanish CLDR data. That is what makes `2500` ungrouped in Spanish and `2,500`
grouped in English — correct for both, and a visible difference between the two
versions of the same screen. Choosing a regional locale (`es-DO`, `es-419`,
`es-MX`) changes every shipped Spanish number. Preserved deliberately; the
decision needs an owner and an ADR.

## OBS-BQR-6 — numeric input accepts only the English decimal separator

The app **renders** Spanish decimals with a comma (`82,5 kg`, `0,25×`, `1,5`)
and **accepts** only a dot: every numeric form field is parsed by
`z.coerce.number()`, which rejects `80,5`. The Spanish hints therefore show a
dot — correctly, for the field as it behaves — while the value the user reads
back a moment later shows a comma.

Making the two agree needs a locale-aware parse at the form boundary, which is
input behaviour and a product decision, not a copy fix. It is the one asymmetry
this slice found that it could not close. See §`progress.weight.weightPlaceholder`.

## Minor, recorded without an item

`progress.measurements.muscleMassRange` and `progress.measurements.atLeastOne`
are validation messages living in the `progress.measurements.*` namespace while
their eight siblings live in `progress.validation.*`. Already noted by the
audit; key-naming only, invisible to users.

---

# Why some real inconsistencies were not corrected

The instruction for this slice was to change only objectively provable defects
and to record everything else. Three lines were held:

1. **An approved deck row is not a review finding.** `.ai/19_COPY_DECKS.md`
   marks copy `SHIPPED` after a slice approved it. Where the deck and the
   catalogue agree, a third opinion does not make the catalogue wrong —
   **OBS-BQR-2**, **OBS-BQR-3**.
2. **Register is a decision, not a defect.** `Introduce` and `Ingresa` are both
   correct Spanish. Picking one across 14 keys is a product choice with a
   consistent answer; making it here would be churn with a review's signature
   on it.
3. **Reuse shipped wording or stop.** Both wording corrections replace a value
   with words the catalogue already ships for the same fact, two and three keys
   away. Where no shipped phrasing existed — **OBS-BQR-4** — the finding was
   recorded instead.

---

# Regression guards

`mobile/src/shared/localization/localized-formatting.spec.ts` is the enforcement
arm of this document, and the complement to `surface-coverage.spec.ts`: that one
proves the words come from the catalogues, this one proves the numbers come from
the formatter. It asks the **TypeScript compiler** which rendered expressions
are numeric, so a newly added `{someCount}` fails without anyone remembering to
list it.

- every numeric value rendered as a JSX child, or interpolated into a template
  literal, on a route entry point or in a feature presentation layer, resolves
  through `formatNumber` — asserted as a **set equality** against one documented
  exemption, so a new bypass and a stale exemption both fail;
- `Intl` is constructed only in `shared/localization/format.ts`, and
  `toLocale*String` nowhere;
- the four audited `formatDate` call sites still use it.

What it deliberately does not flag, and why:

| Not flagged | Why |
|---|---|
| `testID`, `key` and any other non-announced prop | identifiers, not display — decided structurally by the prop name, not by a list |
| The ISO `YYYY-MM-DD` storage key | data, not display — the single entry in `ACCEPTED_BYPASS`, named by file, function and expression |
| Counters used only for branching | never in a rendered position, so the compiler never sees them |
| `features/medical/**` | dormant under ADR-P017 |
| `TrainingPlanCard` | unreachable (F-12); `surface-coverage.spec.ts` fails if any production module imports it, which is what keeps this exclusion honest |
| `shared/presentation/**` | generic primitives whose `children` are caller-supplied `ReactNode`; the caller formats, and every caller is in the surface list |

The guard was negative-tested: reverting two `formatNumber` calls in
`WorkoutLogScreen` fails it, naming
`WorkoutLogScreen.tsx#SetList: set.weightKg` and
`…: set.setNumber`.

Four further assertions live with the surfaces they describe:

- `format.spec.ts` — thousands grouping per language, trailing-zero behaviour
  the serving helper now relies on, and the `interpolate` contract;
- `FoodLogScreen.spec.tsx` — `0,25×` in Spanish, announced value equal to the
  visible one, stored `servingCount` unchanged;
- `WorkoutLogScreen.spec.tsx` — `82,5 kg` in Spanish, stored `82.5` unchanged;
- `GeneratedWorkoutPlan.spec.tsx` — the count inside the phrase, in both
  languages.

---

# Verdict

**Locale formatting for public v1 is complete on mobile.** Every user-facing
number on every reachable public-v1 surface resolves through the shared
formatter, in both languages, in visible and announced text alike, and a
compiler-backed spec fails if that stops being true. Every public display date
was already on `formatDate` and still is.

**Wording is reviewed, not certified.** 1063 key pairs were read in both
languages. Three values changed, each against shipped evidence. Six items are
recorded for an owner, and every one of them is a decision — a glossary, a
register, an approved deck row, a sentence nobody has written, a locale, or an
input contract — not a defect a reviewer may settle alone.

**Web remains what BUG-016 says it is.** The document shell defects (F-4 … F-7)
are untouched and out of scope.

---

# Related documents

- `docs/RELEASE_READINESS.md` — Stage 1 items 1 and 2
- `.ai/21_BILINGUAL_SURFACE_AUDIT.md` — coverage, and the §Handoff this
  document discharges
- `.ai/19_COPY_DECKS.md` — the approved wording, unchanged by this slice
- `.ai/18_SCREEN_STATE_MATRICES.md` — which states each surface has
- `.ai/11_BACKLOG.md` — OBS-BQR-1 … OBS-BQR-6
- `.ai/12_DECISIONS.md` — ADR-P017 (dormancy), ADR-P019 (Web), ADR-P023 /
  ADR-P024 (input and error accessibility), ADR-P030 (conflicts), ADR-P031
  (wellness safety)

**No ADR is required by this slice.** It adds no technology, changes no
architecture, and preserves the accepted locale mapping. `interpolate` is a
shared helper replacing two identical private copies, not a new mechanism.

---

# AI Instructions

## 1. A number is not exempt because it looks the same today

`82.5` and `82,5` differ; `2,500` and `2500` differ. A value that renders
identically in both languages at today's magnitudes is one four-digit input away
from not doing so. Route it through `formatNumber` and let the locale decide.

## 2. Format first, then interpolate

`interpolate` places text. A number reaches it already localized. Passing a raw
number produces a string that is correct in English and wrong in Spanish, and
nothing downstream can recover it.

## 3. Approved copy is changed by its owner, not by a reviewer

If `.ai/19_COPY_DECKS.md` marks a row `SHIPPED` and the catalogue matches it,
the disagreement is with the deck. Record it and stop.

## 4. Reuse shipped wording or record the finding

A wording correction is admissible when the same product has already said the
same thing somewhere else. If the repair needs a sentence nobody has approved,
it is **OBS-BQR-4**-shaped: a backlog item, not an edit.

## 5. Check what the code does before correcting the copy that describes it

`progress.weight.weightPlaceholder` read as an obvious Spanish decimal defect
and was not one: the field rejects a comma, so the "corrected" hint would have
asked for input the form refuses. A placeholder describes an **input** contract;
a rendered value describes an **output** one. They are allowed to differ, and
when they do, the finding is about the code.

## 6. Register is one decision for the whole catalogue

Do not fix `Introduce` in one key. Either the owner picks a register and every
key follows, or nothing moves. Half a glossary is worse than either.

## 7. Status claims carry their evidence

A row here says what was verified, at which commit, by which pass, and which
spec keeps it true. A claim without that is a guess, and this document does not
carry guesses.
