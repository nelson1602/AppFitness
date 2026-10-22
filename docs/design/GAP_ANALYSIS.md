# AppFitnessRD redesign — gap analysis (Phase 0)

Status: Reviewed by the owner 2026-10-22 — ADR-P035 and ADR-P037 accepted; order Phase 1 → P036 → P039 → P040 (non-medical) → P038; medical fields gated by SECURITY-002; Open Food Facts dropped
Baseline: `main` @ `7e99e18` (PR #227 Addendum C pilot, PR #228 Play internal profile and PR #229 design source of truth all merged)
Design inputs: `docs/design/README.md` and `docs/design/appfitnessrd-prototipo.html` (as committed by PR #229, `132cde9`; demo credentials are not prefilled), plus `muneco.webp` and `muneco-solo.webp`

This document maps the prototype onto the repository as it is today. It changes no code. Every "New" or "Changes" row that conflicts with an accepted decision points to the **Proposed** ADR that would authorize it (`.ai/12_DECISIONS.md`, ADR-P035 to ADR-P040). **Nothing below can be implemented until the owner accepts the ADR it depends on.**

Legend:
- **E** = exists and can be reused
- **C** = exists but changes
- **N** = new
- **B** = blocked by an accepted decision until a Proposed ADR is accepted

---

## 0. Findings that affect every phase

1. **The design reverses the accepted public-v1 health scope.** ADR-P017 D3 (`12_DECISIONS.md:6341`) excludes the following from public v1, "without exception":
   - doctor notes, medications, medical conditions;
   - blood pressure;
   - evaluation results.

   The prototype's evaluation step 2 collects all of them. Reactivation has a defined gate (P017 D9, `:6365`; Slice 0, `:6638`): a new accepted ADR, owner authorization, legal, privacy, consent and security review, and full release validation. The legal drafts would all have to be rewritten and the store answers redeclared: the privacy policy, Play Data Safety, health disclaimer, data inventory and store matrix. → **ADR-P038**.
2. **The design reverses ADR-P022 Addendum C, accepted yesterday.** Addendum C's "Unchanged" list (`:8635`) explicitly excludes all of these:
   - gradient CTAs, glass cards and heartbeat motion;
   - Sora/Inter fonts;
   - bottom navigation;
   - biometrics, notifications and wearables.

   → **ADR-P035, P037, P039**.
3. **The prototype is not a complete specification.**
   - Only Login is bilingual. Every other screen is Spanish only, so the English copy has to be authored.
   - Nothing persists.
   - Several medical inputs are collected but never used: blood pressure, resting pulse, medications, asthma and equipment.
   - The diabetes, heart, stress and sleep rules only produce notes.
   - "Mañana tu meta será…" is display text only; the next day's target never changes.
   - The dish tags Gluten, Lactosa, Frutos secos and Mariscos can never match a selection.
   - Plain substring matching produces false positives: "pan" matches "Empanada", "huevo" matches "Claras de huevo".
   - Off-plan alcohol is detected by the names Cerveza and Ron, not by tag.

   The phases below keep the prototype's **intent** and record these as defects to fix, not behavior to copy.
4. **Web.** ADR-P019 and ADR-P032 keep the database dormant on Web. Every database-backed tab must render the bilingual "unavailable on Web" state, and biometrics are native only.
5. **Assets that do not exist yet.**
   - `mobile/assets/images/muneco.webp` and `muneco-solo.webp` are committed (PR #229) but not yet referenced by code.
   - There is no `mobile/assets/exercises/` folder and no font files.

---

## Phase 1 — Design system and login

| Prototype element | Today | Gap | Needs |
|---|---|---|---|
| Colour palette: navy `#0B1530`, deep `#0A3FA8`, sky `#38B6F5`, ice `#9BEBFF`, energy `#FF5A36`, cyan `#22D3EE`/`#67E8F9`, macro colours | **C** 32 semantic roles in light and dark (`colors.ts`), WCAG-gated by `contrast.spec.ts`. Brand roles are confined to `BrandHero`. | **N** A dark-first brand theme, with light derived from the same tokens: new surface, glass, accent-orange, cyan, macro and chart roles. Every pairing measured. | ADR-P035 |
| Gradients: HERO_BG, BLEND_BG with 4 layers, BTN_BG | **C** One identity gradient through native `experimental_backgroundImage` and Web CSS `backgroundImage`, with a solid fallback (Addendum C) | **N** Layered radial backgrounds, plus a gradient CTA that keeps a contrast-safe label. The radial layers need a renderer check on Android, iOS and Web. | ADR-P035 (replaces D5a for the CTA) |
| Glass cards (`rgba(255,255,255,.07)` + blur 22px) | **E** `Card` is solid | **N** A `GlassCard` with no blur dependency (translucent fill plus border), or `expo-glass-effect` (already installed, unused). Text on glass must be gated against its worst-case background. | ADR-P035 |
| Fonts: Sora (display) and Inter (body) | System font; `expo-font` installed but unused; Inter is the "target" (P022 D8) | **N** Font assets (OFL), `useFonts` loading at the root, and a type-scale remap that survives dynamic type in ES and EN | ADR-P037 |
| Icons (39 inline SVG paths) | No icon runtime; delivery undecided (ADR-P033 / PR #181) | **N** An icon set. Options: `expo-symbols`, already installed but platform-specific, or adding `react-native-svg`. | ADR-P037 (and ADR-P033 resolution) |
| Base components: Button with gradient, GlassCard, Chip, Ring, ProgressBar | **C** `AppButton`, `Card`, `Banner`, `AppText`, `AppTextInput`, `FormField`/`FormSelect`. There is no Chip, Ring or ProgressBar. `TrendBars` is View-only. | **N** Chip, Ring and ProgressBar. A Ring needs SVG, or a View-based arc approximation. | ADR-P035, P037 (svg) |
| Animated heartbeat Pulse; mascot bob, idle and wave animations | No animation (P022 D11: no decorative motion) | **N** A Pulse built with Reanimated (installed) plus an SVG path, honouring reduced motion. The prototype's own CSS does not cover `.fade-in`, `.spin` or `.auto-progress`. | ADR-P035 (amends D11), P037 |
| Mascot art (`muneco.webp`, `muneco-solo.webp`) | `BrandHero` uses `mark-v1.png`. The `.webp` files are committed in `mobile/assets/images/` (PR #229) but unused. | **N** Use the committed mascot assets. The login art fades into the background through a mask (`.art-hero`). React Native has no CSS mask, so this needs a pre-composited faded asset (no dependency). | ADR-P035 (amends D12 beyond the header) |
| Login: "Cada latido cuenta.", subtitle, glass form, show/hide password, "¿La olvidaste?", "Crea una cuenta", ES/EN | **C** `sign-in.tsx`: `BrandHero`, form card, recovery link, separate "Create Account", two-language radio card | **C** New copy in ES and EN. Show/hide password is a new control with an accessibility label. The prototype uses an `aria-pressed` language toggle; keep the proven radio semantics (BUG-039). "Crea una cuenta" vs. the owner-approved "Crear cuenta / Create Account" needs a decision. | Copy approval |
| Biometric hint "Podrás activar Face ID o Huella al iniciar sesión." | — | **N** Copy for native only; hidden on Web and on devices without biometric hardware | ADR-P036 |
| Biometric link sheet → scan → OK; biometric sign-in once linked | No biometrics; the session is the SecureStore envelope `auth.session.v1` | **N** `expo-local-authentication` (in the approved stack at `02_TECH_STACK.md:89`, but not installed). Design: the refresh token stays in SecureStore under an access-control flag that requires biometrics, and the biometric unlock releases it. Biometric data never leaves the device. iOS needs a Face ID usage string; app config changes are under ADR-P028. Sign-out and account deletion clear the link. | ADR-P036 |

Not reproduced: the prototype pre-fills demo credentials (forbidden by `10_DEPLOYMENT.md`), the 900 ms fake spinner, and the simulated scan timings.

## Phase 2 — Navigation and shell

| Prototype element | Today | Gap | Needs |
|---|---|---|---|
| Five bottom tabs (Inicio, Entrenamientos, Nutrición, Progreso, Perfil); the active tab is a gradient pill with a label, the others are icons only | Flat root Stack, hub-and-spoke from `/dashboard` (ADR-P027: tabs deferred). The five-tab map is already recorded as non-binding (P027 D4). | **N** expo-router route group `(tabs)` with no new dependency (P027 capability note). P027's three revisit triggers must be met: (1) a selected-navigation colour decision, (2) the Web behaviour of the tabs, (3) costing the migration of about 20 files and 16 specs. Icon-only inactive tabs need accessibility labels. | ADR-P039 |
| Header with date, "Hola, {name}" and a bell with unread count | Stack header titles only | **N** Header component with the date localized for es-DO and en | ADR-P039 |
| Notification list: routes to each item's screen, "Marcar todo como leído" | `notifications` table in SQLite and Prisma, unused; `features/notifications` is empty; ADR-P004 Proposed/Pending | **N** Local-first in-app notifications only, derived deterministically from engine state (plan created, today's training, weigh-in reminder, evaluation update, plan adjusted). No push. Read state is persisted locally; sync is optional. Privacy policy and Data Safety updates are needed if this is persisted or synced. | ADR-P039 |
| Welcome "Tu meta te espera" after sign-in: weekly ring, 5 s auto-continue | — | **N** Screen built from real weekly data, not the prototype's hard-coded "Hoy: Fuerza…". The auto-continue must be pausable and skippable (WCAG 2.2.1) and must not auto-advance under reduced motion. | ADR-P039 |
| Flow: Login → link biometrics → Evaluation → iCoach builds plan → Welcome → Panel | Login → Dashboard, with an advisory onboarding checklist (ADR-P027 D1/D2) | **C** ADR-P027 made onboarding advisory and non-blocking. The design gates the panel behind the evaluation, so P027's advisory rule has to be revisited. | ADR-P039 |

## Phase 3 — Physical evaluation (6 steps)

| Step / field | Today | Gap | Needs |
|---|---|---|---|
| 1. Weight, height, age, sex, evaluation date, live BMI | **E/C** `ProfileForm` (birthDate, gender, heightCm…), `BodyWeight`, engine BMI (`engine.ts`); `WellnessSafetyProfile.evaluationDate` | **C** Wizard step that writes to profile, body weight and the evaluation date. Age is derived from birth date; the prototype asks for age. | Wizard UX only |
| 2a. Conditions (Hipertensión, Diabetes, Asma, Condición cardíaca, Otros + free text) | **B** Dormant medical domain: `medical_evaluations.medical_conditions_enc` (SQLite and Prisma), `MedicalModule` not imported, `app.module.spec` enforces dormancy | **N** Reactivation of the medical domain | **ADR-P038 (supersedes P017 D3)** |
| 2b. Injuries dropdown (12 + "Otra lesión" free text) | **C** `wellness_safety_profiles`: closed 18-token `affected_areas` plus 18 `movements_to_avoid`, no free text (P017 W-1/W-3) | **C** Map the 12 injury names onto the closed area tokens. Muscle tear, tibial periostitis and plantar fasciitis need new tokens or a mapping. "Otra lesión" free text is **B** (W-3: no free text), unless it is stored encrypted under ADR-P038. | ADR-P038 / P040 |
| 2c. Systolic and diastolic BP, resting pulse | **B** `medical_evaluations.blood_pressure_*` and `resting_heart_rate`, stored as **plaintext** ints | **N** Reactivation. Encrypting these at rest should be decided too, since today only free text is encrypted. The prototype uses none of these values in any rule. | ADR-P038 |
| 2d. Medications (free text) | **B** `medications_enc` (encrypted) | **N** Reactivation | ADR-P038 |
| 3. Food exclusions: 10 groups, 79 items, plus 6 "medical restrictions" | **C** `dietary_preferences`: `avoid_tag` (6 tags: nut, shellfish, gluten, lactose, high_sodium, high_purine) or `catalog_key`; `kind` is allergy or preference | **C** The 79 items map to catalog keys or to new avoid tags. Sodium and purines already exist. Added sugars, alcohol, caffeine and fried are new tags and need a `CATALOG_VERSION` bump with tagged foods. The "medical restrictions" framing and the "lo que indicó tu médico" copy are **B** under P022 D4 and P017, unless ADR-P038 is accepted. | ADR-P038, P040 |
| 4. Activity (5), stress (5), sleep, training days 2–6, equipment | **E** `user_profiles`: activity_level, stress_level_baseline, sleep_hours_baseline, training_days_per_week, equipment | **C** Map onto the enums. The prototype ignores equipment; keep the engine's existing equipment substitutions. | — |
| 5. Goal (7), target weight, target date | **E** `goals`: GoalType has 8 values, including REHABILITATION, which the prototype drops (and it is clinical) | **C** Map the 7 labels | — |
| 6. Review with pencil edits and an iCoach preview | **E** `AssessmentSummaryCard`, engine | **N** Review step | — |
| Encryption and security | **E** AES-256-GCM in `field-cipher` on the device and `FieldCipherService` on the server (ADR-P006/P001); medical writes audited; append-only evaluations; no conflict resolution for medical rows (ADR-P030 D12) | **C** If reactivated: consent screen, retention, export, and deletion already covered by the account cascade. Medical rows stay append-only and are never silently overwritten (CLAUDE.md). | ADR-P038 |
| Migrations | SQLite migrations v1–v7; Prisma has 17 migrations | **N** New migrations only. The medical tables already exist; wellness and dietary vocabularies are extended by trigger and CHECK rebuilds in new migrations. | per ADR |

## Phase 4 — iCoach engine

| Rule | Today | Gap | Needs |
|---|---|---|---|
| Calories: Mifflin-St Jeor × activity ± goal, floor 1200 kcal | **E** `engine.ts` / `planNutrition` (Mifflin or Katch-McArdle, TDEE, adjustmentPct, safety floor), `icoach-rules@1.2.0` | **C** The prototype uses fixed goal offsets (−400 … +250 kcal). The engine uses percentages. One must be chosen, versioned and tested. | ADR-P040 |
| Macros: protein 2.0 or 1.6 g/kg, fat 0.9 g/kg, carbs = remainder | **E** engine macros | **C** Reconcile the constants and bump the version | ADR-P040 |
| Weekly plan by available days; patterns for 2 to 6 days; sup/inf/cardio/full | **E** `workout-routine-generator` `icoach-workout-rules@1.1.0` (schedule, prescriptions, rest seconds, RPE, progression) | **C** Keep the engine's generator, which is richer than the prototype. Adopt the prototype's day patterns only if the owner prefers them. | ADR-P040 |
| Injury adaptations: knee (no jumps or deep squat), back (no heavy spinal load), shoulder (overhead press → band external rotation), ankle/periostitis/fasciitis (jogging → bike), others (lighter loads) | **C** `movementsToAvoid` excludes tokens verbatim; `affectedAreas` produces **zero** automatic exclusions (P031 D4) | **N** An area → movement mapping. P031 D4 requires "a separately accepted ADR revision … qualified exercise-domain review". "Lighter loads" lowers workload, which is **B** under P031 D5. | ADR-P040 (+ P031 revision) |
| Condition rules: hypertension or cardiac → moderate intensity; diabetes → spread carbs | **B** P031 D5 (no intensity changes) and D13 (`planNutrition` takes no restriction input) | **N** Depends on ADR-P038. Must be framed as conservative wellness adjustments, never as treatment. | ADR-P038 + P040 |
| Stress ≥ 4 → breathing; sleep < 7 h → longer rests | **C** Engine has stress and sleep inputs from the profile | **C** As notes, compatible. As real changes (rest +30 s, added cooldown), versioned and tested. | ADR-P040 |
| Food exclusion swaps only the marked ingredient by role; medical tags exclude whole products; "Ajustado por iCoach: X → Y" | **C** `meal-generator` `meal-rules@1.0.0` excludes by avoid_tag or catalog_key at **food** level; no recipe or ingredient model | **N** Dishes as recipes of catalog foods with roles; deterministic substitution from same-role pools by catalog key (not substring); explanation codes in ES and EN | ADR-P040 (+ Phase 5 model) |
| Off-plan recalculation: extra cardio (10–30 min) on the next workout, lower next-day target (≤ 300 kcal), alcohol advice | **B** P012 intro: "no recomputation of the deterministic plan" | **N** A versioned adjustment layer over the plan, not a mutation of it. The next-day reduction must respect the calorie safety floor. The alcohol rule keys off a tag. | ADR-P040 |
| AI only proposes or explains | **E** ADR-0007; `07_ICOACH.md:530`; ADR-P002 (AI provider) Proposed/Pending | — no AI provider in this redesign | ADR-P040 restates the boundary |
| Deterministic tests for every rule | **E** 12 engine specs, coverage thresholds 95/95/95/90 | **N** Golden-input tests per rule and version | per phase |

## Phase 5 — Nutrition

| Element | Today | Gap | Needs |
|---|---|---|---|
| Daily calories, macro ring and bars | **E** `NutritionTargets`, `listDailyCalorieTotals` | **C** Ring needs SVG (P037) or a View arc | P035/P037 |
| 15-day plan with slider, arrows and visible scroll chip row | **E** `meal-generator` `DEFAULT_DAYS = 15`; day selector in `NutritionPlanScreen` | **C** UI only. A slider has no core RN primitive: use arrows plus a chip row, or add `@react-native-community/slider` (dependency). | P037 if slider |
| Dishes as recipes of individual foods (amount, kcal, macros, role) | **C** Plan meals are made of catalog foods with serving counts; no named dishes | **N** A recipe model (dish → catalog food lines with role), bundled and versioned. P013 A1 forbids "synthesized" catalog **foods**, so recipes must be plan groupings, not catalog rows. | ADR-P040 |
| Registrar comida: slots, categories (Frecuentes, Todos, Bebidas, Dulces, Comida rápida, Frituras, Básicos, Platos, Mis alimentos), search, servings, favorites, times logged | **C** `FoodLogScreen` / `FoodLogAddForm` / `ServingStepper`; meal types BREAKFAST, LUNCH, DINNER, SNACK; no favorites; no categories in the UI (the catalog has 12 internal categories) | **N** Favorites and usage counts (local entities, synced or local-only); category mapping; Dominican fast food and fried items need catalog entries with a source | ADR-P040 |
| "¿No lo encuentras? Crear alimento" (name, portion, kcal) | **B** P012 D3: "defer custom foods"; `foods.catalog_key NULL` is reserved for custom foods; no foods sync handler; server never trusts client macros (P012 D5) | **N** User foods as a distinct, user-scoped, synced entity with a trust model (user-entered values labelled as such, never merged into the catalog) | ADR-P040 |
| Food DB growth: USDA FDC, Dominican foods, user foods (Open Food Facts **dropped** by owner decision 2026-10-22) | **C** 300 foods, `food-catalog@1.13.6`, USDA-based, with pinned FDC portion gram weights; build-time only (P013) | **N** More USDA FDC rows through the existing build-time pipeline; a Dominican foods seed with a documented source per item and ES/EN labels; user-created foods (Phase 5). Runtime import stays out (P013 "no runtime network dependency"). | ADR-P040 (amends P012/P013) |
| Blocked-food message "Tu evaluación física lo excluye" | **E** P014: logging an excluded food is ALLOWED but flagged | **C** The prototype hard-blocks logging, while P014 says warn. One must be chosen. | ADR-P040 |

## Phase 6 — Workouts, progress, profile

| Element | Today | Gap | Needs |
|---|---|---|---|
| Weekly plan from iCoach with a day picker | **E** generated routine, `GeneratedWorkoutPlan`, `use-training-plan` | **C** New presentation | P035 |
| Per-set logging with "Serie n" buttons | **E** `WorkoutLogScreen`: sets, reps, weight; RPE in schema, not captured | **C** Tap-to-complete sets against the prescription | — |
| 90 s rest timer | **C** `restSeconds` exists in the engine prescription | **N** Timer UI using the **engine's** rest value (P015: never recompute the plan), with an accessible announcement and no background dependency | — |
| Green weekly ring at completion; "Entrenamientos de esta semana completados" | **C** `progress-analysis` weekly snapshots | **N** Completion logic from logs, not the prototype's "past days count as done" | P035 (Ring) |
| Exercise demos: `mobile/assets/exercises/<slug>.mp4` played with "screen" blending; placeholder with mascot and 3 cues; never map the wrong clip | **B** P022 D12: "no … per-exercise illustrative asset pipeline"; no `expo-video`; no exercise media field; no `assets/exercises/` | **N** `expo-video`, a slug ↔ clip manifest with a reviewed flag, the placeholder, and reduced-motion handling (no autoplay; pause control). React Native has no "screen" blend mode, so clips should be exported with the background pre-composited or with alpha. The prototype's SVG figure animation (MOTIONS) needs `react-native-svg` and Reanimated. | ADR-P035 (D12), P037 |
| Progress: weight chart with goal line, log weight, measurements, weekly summary | **E** `BodyWeightForm`, `BodyMeasurementForm`, `TrendBars` (View-only), `WeeklySnapshotSummary`; no goal line | **C** Goal line; a line chart needs SVG (P016 D3: in-house primitives only, no chart library; `02_TECH_STACK.md:65` lists Victory Native XL, which contradicts P016, so it should not be used). The prototype's measurements and volume figures are hard-coded; use real data. | P037 (svg) |
| Profile: evaluation summary + "Actualizar evaluación", goal, biometrics switch, "Próximamente" smartwatch for water and heart rate, sign out | **C** No profile screen (dashboard hub); `ProfileForm`, `GoalForm` | **N** Profile tab. The BP and pulse display is **B** under ADR-P038. The biometrics switch depends on ADR-P036 and must re-authenticate, not just flip a flag as the prototype does. A "Próximamente" teaser is fine; nothing is declared until built (P017 D11). | P036, P038, P039 |

## Cross-cutting rules (every phase)

- **i18n.** About 1,258 keys in `resources/en.ts` and `resources/es.ts`. All new prototype copy needs English authored, since the prototype has English only for Login. Also enforce "Entrenamientos", never "Entrenos".
- **Accessibility.**
  - Touch targets ≥ 44 px; the prototype's 48 px tabs comply.
  - Icon-only tabs need labels.
  - Gradient and glass text must be contrast-gated against every ground it can appear on.
  - Every animation needs a reduced-motion equivalent.
  - The Welcome auto-continue needs pause or skip.
- **Offline-first.** Every new user entity (favorites, user foods, notifications state, evaluation) goes through repositories, SQLite migrations and the sync queue (ADR-0005/0006). Zustand is for orchestration only.
- **Subscriptions.** New writes respect paid-write gating (ADR-P034).
- **Web.** Database-backed tabs render the bilingual unavailable state. Biometrics and video are native only.
- **Docs and legal.** Update `.ai/00_PROJECT.md`, `05_SECURITY.md`, `07_ICOACH.md`, `08_UI_UX.md`, `02_TECH_STACK.md`, `11_BACKLOG.md` and `docs/legal/*` as each ADR is accepted and implemented.

## Recommended order

1. **Phase 1A** — theme and components, under ADR-P035 + P037 (fonts, svg). No health-scope change.
2. **Phase 1B** — biometrics, under ADR-P036.
3. **Phase 2** — shell and navigation, under ADR-P039.
4. **Phases 4/5/6, the parts that need no medical data** — injury mapping, substitution, recipes, user foods, timer, demos, under ADR-P040.
5. **Phase 3 medical inputs and the condition rules** — **last**, only after ADR-P038 **and** the legal, consent and store gates are complete. Until then, Phase 3 ships only the wellness subset: measurements, injuries as closed tokens, food exclusions, lifestyle and goal.
