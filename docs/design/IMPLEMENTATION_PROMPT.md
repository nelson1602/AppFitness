# Prompt: implement the AppFitnessRD redesign

Paste the block below into Claude Code (VS Code) with the AppFitness repository open.

```text
Goal: make the mobile app (mobile/, Expo + React Native) and the API (api/, NestJS + Prisma) match the approved AppFitnessRD redesign. The design is the source of truth; the code and data model must evolve to fit it.

Read first, in this order:
1. CLAUDE.md (follow every rule in it) and the .ai docs its reading order requires.
2. docs/design/README.md — product decisions and the screen-by-screen spec.
3. docs/design/appfitnessrd-prototipo.html — the interactive prototype. Its constants and functions (computePlan, adaptDish, blockedBy, mealFor, MEALS, SINGLE_FOODS, FOOD_GROUPS, INJURIES, POOLS, MOTIONS) document the intended behavior and sample data. Treat them as a spec, not as code to copy: rebuild it with the project's architecture (feature-first, repositories, offline-first SQLite, Zustand for orchestration only, design-system tokens, i18n).

Phase 0 — gap analysis (no code changes):
- Map every screen, component, rule and data field in the prototype to what exists today (mobile features, SQLite migrations, Prisma schema, i18n keys, theme tokens). Write the result to docs/design/GAP_ANALYSIS.md: what exists, what changes, what is new, per phase below.
- List the ADRs required by CLAUDE.md and draft them in .ai/12_DECISIONS.md as "Proposed". At least:
  a) Brand theme: the design is dark-first (navy + blue glow, glass cards); CLAUDE.md requires light and dark mode. Propose a dark brand theme plus a light variant derived from the same tokens.
  b) iCoach: deterministic engine computes calories, macros, weekly plan, injury adaptations, ingredient substitutions and recalculation. AI may only propose or explain within limits the engine validates, never override medical restrictions.
  c) New dependencies: expo-local-authentication (biometrics), expo-video (mascot exercise clips), Sora + Inter fonts, and the food data source (USDA FoodData Central / Open Food Facts import).
- Stop and show me the gap analysis and ADR drafts. Wait for my approval before Phase 1.

Then implement one phase per branch and per PR. Before each phase, show the plan and affected files; after it, run type check, lint and tests, and give me manual test steps.

Phase 1 — Design system and login:
- Theme tokens (colors, gradients, glass surfaces, radii, typography Sora/Inter), base components (Button with gradient, GlassCard, Chip, Ring, ProgressBar, animated heartbeat Pulse, Mascot images from mobile/assets/images/muneco.webp and muneco-solo.webp).
- Login exactly as the design: mascot art fading into the background with no dividing line, animated pulse, "Cada latido cuenta.", glass form, Español/English only, text "Podrás activar Face ID o Huella al iniciar sesión."
- Biometrics: after a password sign-in, offer to link Face ID or fingerprint depending on hardware; once linked, offer biometric sign-in. Secrets stay in secure storage.

Phase 2 — Navigation and shell:
- Tab navigation: Inicio, Entrenamientos, Nutrición, Progreso, Perfil (active tab shows its label, others icon only).
- Header with date, greeting and a notification bell with unread count; notification list that opens each item's screen and supports "mark all as read".
- Welcome screen "Tu meta te espera" after sign-in.

Phase 3 — Physical evaluation (6 steps):
- The user records the results of the evaluation with their doctor: measurements (BMI live), health conditions (Hipertensión, Diabetes, Asma, Condición cardíaca, Otros + free text), an Injuries dropdown (12 items + "Otra lesión" free text), blood pressure, resting pulse, medications; food exclusions as grouped dropdowns (10 groups from the README); lifestyle; goal; review step with iCoach preview.
- Reuse/extend MedicalEvaluation, MedicalRestriction and the existing features/medical screens. Health data encrypted and handled per .ai/05_SECURITY.md. Add migrations (never edit old ones).

Phase 4 — iCoach engine (deterministic, versioned, unit-tested):
- Calories/macros, weekly plan by available days, injury and condition adaptations, stress/sleep notes.
- Food exclusion removes only the marked food: swap the ingredient for one of the same role (protein, carb, fruit, dairy, fat, vegetable) that is not excluded, or drop it; dishes show "Ajustado por iCoach: X → Y". Medical restrictions (sodium, purines, added sugars, alcohol, caffeine, fried) exclude products carrying them.
- Recalculation from off-plan food: extra cardio on the next workout, lower next-day target, alcohol advice.
- Deterministic tests for every rule above.

Phase 5 — Nutrition:
- Dishes stored as recipes of individual foods (amount, kcal, macros, role); 15-day plan with a visible slider and arrows; dish ingredient breakdown.
- "Registrar comida": centered meal buttons; categories with a visible horizontal scrollbar (Frecuentes, Todos, Bebidas, Dulces, Comida rápida, Frituras, Básicos, Platos, Mis alimentos); search; servings; favorites (star); times logged; "¿No lo encuentras? Crear alimento" saving user foods (synced).
- Food database that can grow: import path for USDA/Open Food Facts, Dominican foods seed, user-created foods.

Phase 6 — Workouts, progress, profile:
- Weekly plan from the iCoach, per-set logging, 90 s rest timer, green weekly ring when complete, "Entrenamientos de esta semana completados" in the iCoach card.
- Exercise demos: map each exercise to mobile/assets/exercises/<slug>.mp4 (brand mascot clips, black background blended with "screen"); if the clip is missing, show a placeholder with the mascot and the 3 technique cues. Never map a clip to an exercise it does not show.
- Progress (weight chart with goal line, log weight, measurements, weekly summary) and Profile (evaluation summary + "Actualizar evaluación", goal, biometrics switch, "Próximamente" smartwatch for water and heart rate, sign out).

Rules for every phase: Spanish and English strings (no hardcoded text), accessibility labels and 44 px touch targets, offline-first, no hardcoded colors, keep the web build working or clearly marked unavailable, update .ai docs and the backlog when behavior changes, and never mark a phase done without passing checks.
```
