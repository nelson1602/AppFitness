# AppFitness EN/ES State Copy Decks (V1)

Version: 1.13
Status: Active
Last Updated: 2026-09-09

---

# Purpose

This document is the **UX-3C** high-fidelity copy specification named in
`.ai/11_BACKLOG.md` (FEATURE-010). It binds the state-bearing surfaces audited
by `.ai/18_SCREEN_STATE_MATRICES.md` to exact English and Spanish copy, and
defines the copy candidates needed by the already-recorded V1 conformance gaps.

It covers, in order:

1. the cross-cutting session-loading label;
2. the four live product areas — Dashboard, Workout Log, Nutrition and Progress;
3. the advisory first-run checklist approved by ADR-P027; and
4. the direct Food Log dashboard shortcut approved by ADR-P027.

This is a **documentation-only specification**. It changes no runtime,
localization catalogue, route, state machine, accessibility behaviour or
deployment. A `PROPOSED` row authorizes copy for a later owning slice; it does
not make the key or behaviour exist.

---

# What this document is not

- **Not a ninth state.** The eight ADR-P022 states remain Loading, Empty,
  Data-gap, Error, Offline, Pending sync, Conflict and Web unavailable.
- **Not implementation.** No key listed as `PROPOSED` exists until its owning
  runtime slice adds it to both catalogues and wires it through `t()`.
- **Not conflict resolution.** BUG-012's flow and data decision are now
  specified by **ADR-P030 (Accepted 2026-09-07)**, but acceptance authorizes the
  architecture only and **the copy slice C-5 is unauthorized**,
  so this deck still specifies reporting copy only and defines no review action,
  choose-version, keep-mine or keep-server control. The resolution copy families
  ADR-P030 names are worded in its own copy slice, not here — see
  §Deferred copy.
- **Not the UX-3D specification.** `.ai/20_PROGRESS_NONVISUAL.md` owns the
  non-visual equivalent for `TrendBars` and `WeeklySnapshotSummary` — its
  structure, accessibility semantics, ordering and test contract, including the
  rule that no wrapper may be marked accessible. This deck owns only the
  **wording** of the seven keys that equivalent proposes, listed under §Progress.
- **Not password-recovery or verification copy.** Both have since shipped —
  recovery merged in PR #102 (`724a18e7`, Production-validated 2026-09-02) and
  verification completed ADR-P026 Vertical 2 with both V2-E halves passing
  2026-09-04 — so this exclusion is now one of **ownership**, not of readiness:
  their copy is owned by FEATURE-011 and is not re-tabulated in this deck. The
  earlier wording ("Recovery remains outside `main` in PR #102; verification
  awaits ADR-P026 Vertical 2 authorization") is corrected. See §Deferred copy.
- **Not accessibility proof.** Labels are specified or exposed by source. Their
  VoiceOver, TalkBack and browser-AT behaviour remains unverified until UX-4C.

---

# Evidence baseline

Verified against `origin/main` at
`a24b4b69f477028cbc5022186773486b4f2f1a14` (PR #106 merge) on 2026-08-28.

- EN and ES catalogues contain **696 keys each** with identical sorted key sets.
- The ten state-bearing surfaces, their triggers and applicability were audited
  in `.ai/18_SCREEN_STATE_MATRICES.md` v1.1; this slice cross-links the deck in
  v1.2 without changing any state or applicability.
- `mobile/src/shared/localization/resources/{en,es}.ts` is the authority for
  every `SHIPPED` value below.
- Candidate key names were checked against both catalogues and do not exist.
- The shared `DashboardSkeleton` still carries the hardcoded English label
  `Loading dashboard section`; its bilingual replacement is `PROPOSED` under
  BUG-010.

Status vocabulary:

| Status | Meaning in this deck |
|---|---|
| **SHIPPED** | Exact key and value exist on the evidence baseline and are rendered by the cited surface. |
| **SHIPPED — non-conformant** | The copy exists, but the state/tone mapping is known to violate the accepted model. |
| **PROPOSED** | Exact future key and copy are specified, but neither the key nor its treatment exists on `main`. |

---

# Copy rules

1. **Fitness and wellness, never clinical authority.** Copy may explain a
   calculation or local-first condition; it must not diagnose, prescribe,
   promise medical safety or imply professional supervision.
2. **State names carry information.** Empty never substitutes for Error;
   Offline never reads as failure; Pending sync says the write is safe locally;
   Conflict reports divergence without pretending a resolution path exists;
   detailed new copy says both versions are preserved only where repository
   behaviour supports that statement.
3. **No raw errors.** Store, SQLite, HTTP, Prisma and stack text never reaches a
   user-facing string.
4. **Spanish carries the same intent, not English word order.** Both variants
   must fit the same treatment at maximum supported text scale; compact row
   hints stay short.
5. **Counts remain compositional.** Existing `*One` / `*Many` fragments are
   preserved because their components prepend a localized number.
6. **No unsupported action.** A message may report that a record needs review,
   or ask the user to repeat an operation they can actually repeat. It must not
   imply a dedicated review/retry destination, name a control, or promise a
   resolution path unless that affordance exists in the treatment.

---

# Cross-cutting session resolution

The route gate is a pre-screen phase rather than a canonical state. BUG-010 owned
the only missing bilingual string; it has shipped.

| Key | EN | ES | Status |
|---|---|---|---|
| `common.loadingContentAccessibility` | Loading content | Cargando contenido | **SHIPPED** |

**Shipped by BUG-010.** The hardcoded English label in `dashboard-skeleton.tsx`
is replaced by this key, and **no accessibility outcome is claimed** — when or
how assistive technology announces it remains UX-4C. Whether the label belongs on
one container or on repeated placeholder blocks is likewise UX-4C verification,
not a copy decision, and was left unchanged.

This key opens the `common.*` namespace, the first genuinely cross-cutting entry
in the catalogue.

---

# Dashboard

## Dashboard screen — Loading, Error and Web unavailable

Loading is visual skeleton treatment; apart from the cross-cutting candidate
above, it carries no visible sentence.

| Key | EN | ES | Status |
|---|---|---|---|
| `dashboard.unavailable` | Dashboard unavailable | Panel no disponible | **SHIPPED** |
| `dashboard.errorMessage` | Your dashboard could not be loaded right now. Please try again. | No se pudo cargar tu panel en este momento. Inténtalo de nuevo. | **SHIPPED** |
| `dashboard.webUnavailableTitle` | Dashboard isn't available on the web | El panel no está disponible en la web | **SHIPPED** |
| `dashboard.webUnavailableBody` | Your dashboard data lives on your device. Use the AppFitness mobile app for the full offline experience. | Los datos de tu panel se guardan en tu dispositivo. Usa la app móvil de AppFitness para la experiencia completa sin conexión. | **SHIPPED** |

The Web-unavailable treatment remains terminal and therefore gets no retry copy.

## Sync banner — Offline, Error, Pending sync and Conflict

The banner remains single-slot with the shipped priority
`syncing → offline → error → conflict → pending → ready`. Copy does not conceal
that Conflict can be masked by a higher-priority arm.

| Key | EN | ES | Status |
|---|---|---|---|
| `dashboard.sync.syncingTitle` | Syncing | Sincronizando | **SHIPPED** — transient, not a ninth state |
| `dashboard.sync.syncingMessage` | Sending local changes. | Enviando cambios locales. | **SHIPPED** |
| `dashboard.sync.offlineTitle` | Offline | Sin conexión | **SHIPPED** |
| `dashboard.sync.offlineMessage` | Showing local data. | Mostrando datos locales. | **SHIPPED** |
| `dashboard.sync.errorTitle` | Sync needs attention | La sincronización necesita atención | **SHIPPED** |
| `dashboard.sync.errorMessage` | Your local changes are safe. We will try again. | Tus cambios locales están seguros. Intentaremos sincronizarlos nuevamente. | **SHIPPED** |
| `dashboard.sync.conflictsTitle` | Conflicts pending | Conflictos pendientes | **SHIPPED** — reporting only |
| `dashboard.sync.conflictOne` | item needs review. | elemento necesita revisión. | **SHIPPED** — reporting only |
| `dashboard.sync.conflictMany` | items need review. | elementos necesitan revisión. | **SHIPPED** — reporting only |
| `dashboard.sync.pendingTitle` | Local changes pending | Cambios locales pendientes | **SHIPPED** |
| `dashboard.sync.pendingOne` / `dashboard.sync.pendingMany` | pending / pending | pendiente / pendientes | **SHIPPED** |
| `dashboard.sync.failedOne` / `dashboard.sync.failedMany` | failed retry. / failed retries. | reintento fallido. / reintentos fallidos. | **SHIPPED** |
| `dashboard.sync.readyTitle` | Local data ready | Datos locales disponibles | **SHIPPED** — success confirmation |
| `dashboard.sync.readyMessage` | Dashboard is available offline. | El panel está disponible sin conexión. | **SHIPPED** |

“Needs review” describes the unresolved record; it does not imply a review
destination exists. No resolution CTA is added under UX-3C.

## Data-gap card

The copy names the prerequisite and routes to its owner. Empty-language such as
“nothing here” is forbidden because the user must act elsewhere.

| Key | EN | ES | Status |
|---|---|---|---|
| `dashboard.gap.accessibility` | Dashboard setup requirements | Requisitos de configuración del panel | **SHIPPED** |
| `dashboard.gap.title` | Finish your baseline | Completa tus datos iniciales | **SHIPPED** |
| `dashboard.gap.description` | The dashboard runs entirely from local data. Add the basics below to unlock your first iCoach assessment. | El panel funciona completamente con datos locales. Agrega la información básica para obtener tu primera evaluación de iCoach. | **SHIPPED** |
| `dashboard.gap.profileTitle` | Create your profile | Crea tu perfil | **SHIPPED** |
| `dashboard.gap.profileDetail` | The dashboard needs your profile to calculate safe targets. | El panel necesita tu perfil para calcular objetivos seguros. | **SHIPPED** |
| `dashboard.gap.birthDateTitle` | Add your birth date | Agrega tu fecha de nacimiento | **SHIPPED** |
| `dashboard.gap.birthDateDetail` | Age is required for BMR and safety checks. | La edad es necesaria para calcular el metabolismo basal y aplicar controles de seguridad. | **SHIPPED** |
| `dashboard.gap.heightTitle` | Add your height | Agrega tu estatura | **SHIPPED** |
| `dashboard.gap.heightDetail` | Height is required for BMI and calorie calculations. | La estatura es necesaria para calcular el IMC y las calorías. | **SHIPPED** |
| `dashboard.gap.weightTitle` | Record a weight measurement | Registra una medición de peso | **SHIPPED** |
| `dashboard.gap.weightDetail` | Weight is required for body composition and nutrition targets. | El peso es necesario para calcular la composición corporal y los objetivos de nutrición. | **SHIPPED** |
| `dashboard.gap.goalTitle` | Using maintenance goal | Usando el objetivo de mantenimiento | **SHIPPED** |
| `dashboard.gap.goalDetail` | Set a goal to personalize calorie and training adjustments. | Define un objetivo para personalizar los ajustes de calorías y entrenamiento. | **SHIPPED** |
| `dashboard.gap.sexTitle` | Using undisclosed sex coefficients | Usando coeficientes sin sexo especificado | **SHIPPED** |
| `dashboard.gap.sexDetail` | Add sex in your profile to improve BMR precision. | Agrega el sexo en tu perfil para mejorar la precisión del metabolismo basal. | **SHIPPED** |
| `dashboard.gap.fixAccessibility` | Fix | Corregir | **SHIPPED** |
| `dashboard.gap.addNow` | Add now | Agregar ahora | **SHIPPED** |

The development-only sample-data action is not product copy and must not be
carried into the first-run checklist.

## Progress summary card

| Key | EN | ES | Status |
|---|---|---|---|
| `progress.card.loading` | Loading… | Cargando… | **SHIPPED** |
| `progress.card.noWeight` | No weight yet | Sin peso aún | **SHIPPED** |
| `progress.card.prompt` | Tap to record and track your progress. | Toca para registrar y seguir tu progreso. | **SHIPPED** |
| `progress.webUnavailableCard` | Not available on the web | No disponible en la web | **SHIPPED** |
| `progress.card.errorTitle` | Progress unavailable | Progreso no disponible | **SHIPPED** |
| `progress.card.errorBody` | We couldn't load your progress right now. | No pudimos cargar tu progreso en este momento. | **SHIPPED** |

**Shipped by BUG-009.** The Error copy contains no false Empty claim and
promises no retry control. The open question this deck left to implementation —
whether the card stays pressable in Error — was **decided: it stays pressable**,
matching its own Loading branch, because the owning Progress screen reports the
failure properly and is one tap away. Only Web unavailable removes the
`Pressable`, since there is nowhere useful to go.

---

# Workout Log

The mid-workout surface stays action-first and compact. Loading and Empty are
section-local; Error does not erase the working surface.

| State / key | EN | ES | Status |
|---|---|---|---|
| Loading — `workout.log.loading` | Loading… | Cargando… | **SHIPPED** |
| Loading label — `workout.log.loadingAccessibility` | Loading workouts | Cargando entrenamientos | **SHIPPED** |
| Empty open list — `workout.log.openEmpty` | No open workouts. | No hay entrenamientos abiertos. | **SHIPPED** |
| Empty custom list — `workout.log.customEmpty` | No custom exercises yet. | Todavía no hay ejercicios personalizados. | **SHIPPED** |
| Empty set list — `workout.log.setsEmpty` | No sets logged yet. | Todavía no hay series registradas. | **SHIPPED** |
| Error title — `workout.log.errorTitle` | Something went wrong | Algo salió mal | **SHIPPED** |
| Error body — `workout.log.errorMessage` | Your workouts could not be loaded right now. Try again. | Tus entrenamientos no se pudieron cargar en este momento. Inténtalo de nuevo. | **SHIPPED** |
| Pending workout — `workout.log.savedOnDevice` | Saved on this device | Guardado en este dispositivo | **SHIPPED** |
| Pending workout label — `workout.log.savedAccessibility` | Workout saved on this device | Entrenamiento guardado en este dispositivo | **SHIPPED** |
| Pending set — `workout.log.syncPending` | Pending sync | Pendiente de sincronización | **SHIPPED** |
| Pending set label — `workout.log.syncPendingAccessibility` | Sync pending | Sincronización pendiente | **SHIPPED** |
| Conflict row — `workout.log.syncConflict` | Conflict | Conflicto | **SHIPPED** |
| Conflict row label — `workout.log.syncConflictAccessibility` | Workout sync conflict | Conflicto de sincronización del entrenamiento | **SHIPPED** |
| Web unavailable title — `workout.log.webUnavailableTitle` | Workout logging isn't available on the web | El registro de entrenamientos no está disponible en la web | **SHIPPED** |
| Web unavailable body — `workout.log.webUnavailableBody` | Use the AppFitness mobile app for the complete workout-logging experience. | Usa la app móvil de AppFitness para la experiencia completa de registro de entrenamientos. | **SHIPPED** |

**Shipped** by the first BUG-011 feature slice. The Conflict hint reports the row
state only: it adds no choose action, and it uses `warning`, never `error`. One
pair serves both workout rows and set rows (`WorkoutLogScreen.tsx:55-67`).

---

# Nutrition

## Targets and Meal Plan

Targets and Plan share the dashboard read. Data-gap copy is shared, except that
Plan adds its suffix. A failed dietary-preference read must not cause copy to
claim exclusions were applied.

| Key | EN | ES | Status |
|---|---|---|---|
| `nutrition.plan.loading` | Loading… | Cargando… | **SHIPPED** |
| `nutrition.targets.loadingAccessibility` | Loading nutrition targets | Cargando objetivos nutricionales | **SHIPPED** |
| `nutrition.plan.loadingAccessibility` | Loading meal plan | Cargando el plan alimentario | **SHIPPED** |
| `nutrition.targets.unavailable` | Nutrition unavailable | Nutrición no disponible | **SHIPPED** |
| `nutrition.targets.errorMessage` | Your nutrition targets could not be loaded right now. | No se pudieron cargar tus objetivos nutricionales. | **SHIPPED** |
| `nutrition.plan.unavailable` | Meal plan unavailable | Plan alimentario no disponible | **SHIPPED** |
| `nutrition.plan.errorMessage` | Your meal plan could not be built right now. Try again later. | No se pudo crear tu plan alimentario en este momento. Inténtalo más tarde. | **SHIPPED** |
| `nutrition.targets.webUnavailableTitle` | Nutrition targets aren't available on the web | Los objetivos nutricionales no están disponibles en la web | **SHIPPED** |
| `nutrition.targets.webUnavailableBody` | Use the AppFitness mobile app to view your personalized calorie and macro targets. | Usa la app móvil de AppFitness para ver tus objetivos personalizados de calorías y macronutrientes. | **SHIPPED** |
| `nutrition.plan.webUnavailableTitle` | Your meal plan isn't available on the web | Tu plan alimentario no está disponible en la web | **SHIPPED** |
| `nutrition.plan.webUnavailableBody` | Use the AppFitness mobile app to view and follow your 15-day meal plan. | Usa la app móvil de AppFitness para ver y seguir tu plan alimentario de 15 días. | **SHIPPED** |

Shared Data-gap deck:

| Key | EN | ES | Status |
|---|---|---|---|
| `nutrition.gap.targetsAccessibility` | Nutrition needs more data | La nutrición necesita más datos | **SHIPPED** |
| `nutrition.gap.planAccessibility` | Meal plan needs more data | El plan alimentario necesita más datos | **SHIPPED** |
| `nutrition.gap.title` | Finish your baseline first | Completa primero tus datos básicos | **SHIPPED** |
| `nutrition.gap.description` | Nutrition targets need your profile (birth date and height) and a recent weight. | Los objetivos de nutrición necesitan tu perfil (fecha de nacimiento y estatura) y un peso reciente. | **SHIPPED** |
| `nutrition.gap.planSuffix` | Your 15-day meal plan builds on those targets. | Tu plan alimentario de 15 días se basa en esos objetivos. | **SHIPPED** |
| `nutrition.gap.profileTitle` | Add your profile details | Agrega los datos de tu perfil | **SHIPPED** |
| `nutrition.gap.profileDetail` | A profile is required. | Se requiere un perfil. | **SHIPPED** |
| `nutrition.gap.birthDateDetail` | Your birth date is required. | Se requiere tu fecha de nacimiento. | **SHIPPED** |
| `nutrition.gap.heightDetail` | Your height is required. | Se requiere tu estatura. | **SHIPPED** |
| `nutrition.gap.weightTitle` | Record a weight | Registra un peso | **SHIPPED** |
| `nutrition.gap.weightDetail` | A recent weight is required. | Se requiere un peso reciente. | **SHIPPED** |
| `nutrition.gap.profileButton` | Create or edit profile | Crear o editar perfil | **SHIPPED** |
| `nutrition.gap.profileAccessibility` | Create or edit your profile | Crear o editar tu perfil | **SHIPPED** |
| `nutrition.gap.weightButton` | Record weight | Registrar peso | **SHIPPED** |
| `nutrition.gap.weightAccessibility` | Record your body weight | Registrar tu peso corporal | **SHIPPED** |
| `nutrition.gap.dashboardButton` | Go to dashboard | Ir al panel | **SHIPPED** |
| `nutrition.gap.dashboardAccessibility` | Go to the dashboard to finish your baseline | Ir al panel para completar tus datos básicos | **SHIPPED** |
| `nutrition.gap.wellnessNotice` | AppFitness uses self-entered wellness data for these suggestions. It does not request diagnoses, prescriptions, doctor notes, or professional medical restrictions. | AppFitness usa datos de bienestar ingresados por ti para estas sugerencias. No solicita diagnósticos, recetas, notas médicas ni restricciones médicas profesionales. | **SHIPPED** |

## Food Log

### Shipped read, sync and Empty copy

| Key | EN | ES | Status |
|---|---|---|---|
| `nutrition.log.loadingAccessibility` | Loading food log | Cargando registro de alimentos | **SHIPPED** |
| `nutrition.log.unavailable` | Food log unavailable | Registro de alimentos no disponible | **SHIPPED** |
| `nutrition.log.errorMessage` | Your food log could not be loaded right now. Please try again. | No se pudo cargar tu registro de alimentos. Inténtalo de nuevo. | **SHIPPED** |
| `nutrition.log.emptyTitle` | Nothing logged yet | Todavía no has registrado alimentos | **SHIPPED** |
| `nutrition.log.emptyMessage` | Search the catalog above and add your first food to see your daily totals. | Busca en el catálogo y agrega tu primer alimento para ver los totales diarios. | **SHIPPED** |
| `nutrition.log.emptyAccessibility` | No food logged yet | Todavía no hay alimentos registrados | **SHIPPED** |
| `nutrition.log.syncingTitle` | Syncing | Sincronizando | **SHIPPED** — transient, not a ninth state |
| `nutrition.log.syncingMessage` | Sending your food log. | Enviando tu registro de alimentos. | **SHIPPED** |
| `nutrition.log.offlineTitle` | Offline | Sin conexión | **SHIPPED** |
| `nutrition.log.offlineMessage` | Your log is saved on this device and will sync later. | Tu registro está guardado en este dispositivo y se sincronizará más tarde. | **SHIPPED** |
| `nutrition.log.syncErrorTitle` | Sync needs attention | La sincronización necesita atención | **SHIPPED** |
| `nutrition.log.syncErrorMessage` | Your log is saved locally. We will try again. | Tu registro está guardado localmente. Lo intentaremos de nuevo. | **SHIPPED** |
| `nutrition.log.pendingTitle` | Changes pending | Cambios pendientes | **SHIPPED** |
| `nutrition.log.pendingMessageOne` / `nutrition.log.pendingMessageMany` | change is waiting to sync. / changes are waiting to sync. | cambio está en espera de sincronización. / cambios están en espera de sincronización. | **SHIPPED** |
| `nutrition.log.pendingShort` | Pending sync | Sincronización pendiente | **SHIPPED** |
| `nutrition.log.pendingAccessibility` | Sync pending | Sincronización pendiente | **SHIPPED** |
| `nutrition.log.syncedTitle` | Log up to date | Registro actualizado | **SHIPPED** — success confirmation |
| `nutrition.log.syncedMessage` | Your food log is saved and synced. | Tu registro de alimentos está guardado y sincronizado. | **SHIPPED** |
| `nutrition.log.webUnavailableTitle` | Food logging isn't available on the web | El registro de alimentos no está disponible en la web | **SHIPPED** |
| `nutrition.log.webUnavailableBody` | Use the AppFitness mobile app to log meals and track your daily nutrition. | Usa la app móvil de AppFitness para registrar tus comidas y seguir tu nutrición diaria. | **SHIPPED** |

### Catalog incompatibility versus Conflict

The existing `action*` keys describe a server-catalog incompatibility and stay
assigned to that cause. **BUG-007 shipped**, so they no longer carry a version
conflict: the repository separates the two causes at the read
(`food-log.repository.ts:205-215`, `:389`) and the screen renders the catalog
cause as `error` and the conflict as `warning`.

| Key | EN | ES | Status |
|---|---|---|---|
| `nutrition.log.actionTitle` | Action needed | Acción necesaria | **SHIPPED** — catalog incompatibility only, since BUG-007 |
| `nutrition.log.actionMessageOne` | item cannot sync because the food is not available on the server. Remove and re-add it to continue. | elemento no puede sincronizarse porque el alimento no está disponible en el servidor. Elimínalo y agrégalo nuevamente para continuar. | **SHIPPED** — catalog incompatibility only |
| `nutrition.log.actionMessageMany` | items cannot sync because the food is not available on the server. Remove and re-add them to continue. | elementos no pueden sincronizarse porque el alimento no está disponible en el servidor. Elimínalos y agrégalos nuevamente para continuar. | **SHIPPED** — catalog incompatibility only |
| `nutrition.log.actionShort` | Action needed | Acción necesaria | **SHIPPED** — catalog incompatibility only, since BUG-007 |
| `nutrition.log.actionAccessibility` | Sync action required | Se requiere una acción de sincronización | **SHIPPED** — catalog incompatibility only, since BUG-007 |
| `nutrition.log.conflictTitle` | Food log conflict | Conflicto en el registro de alimentos | SHIPPED |
| `nutrition.log.conflictMessageOne` | food log item has changes from another device. Both versions are preserved. | elemento del registro tiene cambios de otro dispositivo. Ambas versiones se conservan. | SHIPPED |
| `nutrition.log.conflictMessageMany` | food log items have changes from another device. Both versions are preserved. | elementos del registro tienen cambios de otro dispositivo. Ambas versiones se conservan. | SHIPPED |
| `nutrition.log.conflictShort` | Conflict | Conflicto | SHIPPED |
| `nutrition.log.conflictAccessibility` | Food log sync conflict | Conflicto de sincronización del registro de alimentos | SHIPPED |

The banner prepends the localized count, matching the shipped `*One` / `*Many`
composition pattern. The Conflict copy is deliberately report-only. There is no
action sentence or resolution CTA because BUG-012 has no authorized resolution
flow.

### Write failures

These messages are separate from the shipped load failure and never render raw
store text. **Shipped by BUG-008**: the store exposes a `FoodLogWriteOperation`
discriminant (`food-log.store.ts:30`) that the screen maps to one of the three
title/body pairs below (`FoodLogScreen.tsx:88-112`). The banner renders
**alongside** the log rather than in place of it, which is what lets the add
copy promise *"Your selections are still here."*

| Key | EN | ES | Status |
|---|---|---|---|
| `nutrition.log.writeError.addTitle` | Couldn't add food | No se pudo agregar el alimento | SHIPPED |
| `nutrition.log.writeError.addBody` | Your food wasn't added. Your selections are still here. Try again. | El alimento no se agregó. Tus selecciones siguen aquí. Inténtalo de nuevo. | SHIPPED |
| `nutrition.log.writeError.servingsTitle` | Couldn't update servings | No se pudieron actualizar las porciones | SHIPPED |
| `nutrition.log.writeError.servingsBody` | Your serving change wasn't saved. Try again. | El cambio de porciones no se guardó. Inténtalo de nuevo. | SHIPPED |
| `nutrition.log.writeError.removeTitle` | Couldn't remove food | No se pudo eliminar el alimento | SHIPPED |
| `nutrition.log.writeError.removeBody` | The food is still in your log. Try again. | El alimento sigue en tu registro. Inténtalo de nuevo. | SHIPPED |

## Dietary Preferences

| Key | EN | ES | Status |
|---|---|---|---|
| `nutrition.preferences.loadingAccessibility` | Loading dietary preferences | Cargando preferencias alimentarias | **SHIPPED** |
| `nutrition.preferences.empty` | No exclusions yet. | Todavía no hay exclusiones. | **SHIPPED** |
| `nutrition.preferences.errorTitle` | Something went wrong | Algo salió mal | **SHIPPED** |
| `nutrition.preferences.errorMessage` | Your dietary preferences could not be loaded right now. | No se pudieron cargar tus preferencias alimentarias. | **SHIPPED** |
| `nutrition.preferences.webUnavailableTitle` | Dietary preferences aren't available on the web | Las preferencias alimentarias no están disponibles en la web | **SHIPPED** |
| `nutrition.preferences.webUnavailableBody` | Use the AppFitness mobile app to manage your allergies and food preferences. | Usa la app móvil de AppFitness para gestionar tus alergias y preferencias de alimentos. | **SHIPPED** |
| `nutrition.preferences.syncPending` | Saved on this device | Guardado en este dispositivo | **SHIPPED** |
| `nutrition.preferences.syncPendingAccessibility` | Preference saved on this device; sync pending | Preferencia guardada en este dispositivo; sincronización pendiente | **SHIPPED** |
| `nutrition.preferences.syncConflict` | Conflict | Conflicto | **SHIPPED** |
| `nutrition.preferences.syncConflictAccessibility` | Dietary preference sync conflict | Conflicto de sincronización de la preferencia alimentaria | **SHIPPED** |

---

# Progress

The full screen keeps load and save failures distinct. Copy reports recency and
change without praise, diagnosis or instruction.

| Key | EN | ES | Status |
|---|---|---|---|
| `progress.screen.loading` | Loading… | Cargando… | **SHIPPED** |
| `progress.screen.loadingAccessibility` | Loading progress | Cargando progreso | **SHIPPED** |
| `progress.screen.loadErrorTitle` | Progress unavailable | Progreso no disponible | **SHIPPED** |
| `progress.screen.loadErrorBody` | Your progress could not be loaded right now. Please try again. | No se pudo cargar tu progreso en este momento. Inténtalo de nuevo. | **SHIPPED** |
| `progress.screen.saveErrorTitle` | Couldn’t save your changes | No se pudieron guardar tus cambios | **SHIPPED** |
| `progress.screen.saveErrorBody` | We could not save your changes. Please try again. | No se pudieron guardar tus cambios. Inténtalo de nuevo. | **SHIPPED** |
| `progress.screen.noWeight` | No weight recorded yet. | Aún no has registrado tu peso. | **SHIPPED** |
| `progress.webUnavailableTitle` | Progress isn't available on the web | El progreso no está disponible en la web | **SHIPPED** |
| `progress.webUnavailableBody` | Use the AppFitness mobile app to record and track your progress. | Usa la app móvil de AppFitness para registrar y seguir tu progreso. | **SHIPPED** |
| `progress.syncPending` | Saved on this device | Guardado en este dispositivo | **SHIPPED** |
| `progress.syncPendingAccessibility` | Progress entry saved on this device; sync pending | Registro de progreso guardado en este dispositivo; sincronización pendiente | **SHIPPED** |
| `progress.syncConflict` | Conflict | Conflicto | **SHIPPED** |
| `progress.syncConflictAccessibility` | Progress entry sync conflict | Conflicto de sincronización del registro de progreso | **SHIPPED** |

Pending and Conflict apply to listed rows, not to the aggregate dashboard card
(surface 4, whose Error gap is BUG-009's and is untouched here).

**Correction.** This section previously said "listed weight, measurement and
snapshot rows". Implementation found that **body measurements are never listed
individually** on the Progress screen — they reach the UI only as a count and as
an aggregated trend series. The four keys ship on the listed **weight** row and
the listed **snapshot** rows; there is no measurement row to attach them to.
The residual is recorded against BUG-011, which stays open.

## Progress trends and weekly semantics (UX-3D)

Seven keys from `.ai/20_PROGRESS_NONVISUAL.md`. That document owns
composition — where each string renders and whether it is visible, announced or
both; this table owns wording. **All seven landed 2026-09-07** at exactly these
values, in both catalogues, with EN/ES parity preserved. They were absent from
the 696-key catalogues when this section was written.

| Key | EN | ES | Status |
|---|---|---|---|
| `progress.trends.orderOldestFirst` | oldest to newest | de la más antigua a la más reciente | **SHIPPED** — UX-3D |
| `progress.trends.readingOne` | reading | lectura | **SHIPPED** — UX-3D |
| `progress.trends.readingMany` | readings | lecturas | **SHIPPED** — UX-3D |
| `progress.trends.windowNotice` | Showing only the most recent readings | Mostrando solo las lecturas más recientes | **SHIPPED** — UX-3D |
| `progress.trends.latestMarker` | latest | última | **SHIPPED** — UX-3D |
| `progress.weekly.notRecorded` | Not recorded | Sin registrar | **SHIPPED** — UX-3D |
| `progress.weekly.newestFirst` | newest first | de la más reciente a la más antigua | **SHIPPED** — UX-3D |

`progress.weekly.weekOf` ("Week of" / "Semana del") and
`progress.weekly.earlierWeeks` ("Earlier weeks" / "Semanas anteriores") are
**reused** and stay **SHIPPED** — no duplicate key was proposed for either, and
none was added. `earlierWeeks` now renders with the `newestFirst` suffix
appended after a separator; its own value is unchanged.

Copy notes:

- **Descriptive, never evaluative.** None of these strings characterises a trend
  as good, bad or expected (ADR-P017).
- **Five of the seven are visible text**, not accessibility-only. The window
  notice in particular is visible, because truncation misleads sighted users too.
  Only `latestMarker` (inside a bar label) and `notRecorded` (the accessible
  value where `—` is shown) are announced without being separately visible.
- **`latest` and the two order phrases are lower-case** in both languages
  because each is appended after a separator, never used as a heading.
- **ES gender.** `última` agrees with *lectura*, and both order phrases agree
  with *lectura* / *semana*; none may be rewritten to a masculine form without
  re-checking agreement against the noun it follows.
- **`notRecorded` is not "zero", "none" or "unknown".** The visible `—` means
  the value was never recorded; any other wording would be an invention.
- The window notice is deliberately unquantified — it states that truncation
  happened, while the descriptor beside it states how many readings are shown.

---

# First-run checklist — shipped copy

ADR-P027 approves an advisory dashboard checklist derived from the existing
Data-gap source. UX-3C specifies three copy-level steps by grouping the five
gap ids without changing their routing:

1. Profile basics — `profile`, `birth-date`, `height` → `/profile-edit`.
2. Goal — `default-goal` → `/goal-edit`.
3. First weight — `weight` → `/progress`.

| Key | EN | ES | Status |
|---|---|---|---|
| `dashboard.onboarding.accessibility` | Getting started checklist | Lista de primeros pasos | **SHIPPED** |
| `dashboard.onboarding.title` | Finish setting up AppFitness | Termina de configurar AppFitness | **SHIPPED** |
| `dashboard.onboarding.description` | Complete these steps at your pace. You can use the rest of the app now. | Completa estos pasos a tu ritmo. Ya puedes usar el resto de la app. | **SHIPPED** |
| `dashboard.onboarding.progress` | {completed} of {total} complete | {completed} de {total} completados | **SHIPPED** |
| `dashboard.onboarding.profile` | Add your profile basics | Agrega los datos básicos de tu perfil | **SHIPPED** |
| `dashboard.onboarding.goal` | Choose your goal | Elige tu objetivo | **SHIPPED** |
| `dashboard.onboarding.weight` | Record your first weight | Registra tu primer peso | **SHIPPED** |

`{completed}` and `{total}` are value placeholders. **UX-4B resolves them** with
the repository's existing manual-replacement pattern — a local `template()`
reducer over `String.replaceAll`, matching `recommendation-copy.ts`, with counts
formatted by `formatNumber` in the active language. **No localization API
changed.**

The checklist adds no “welcome”, “skip”, “dismiss” or completion-celebration
copy. ADR-P027 leaves persistence/dismissal semantics undecided, and UX-3C does
not decide behaviour through strings. The progress sentence supplies
non-visual intent only; its actual AT output remains a UX-4C gate.

**UX-4B implementation note.** Because no status word was approved, the shipped
card renders a row **only for an outstanding step**; a resolved step disappears
and is counted in the progress line instead. Adding a per-step “done” / “to do”
tag would require two further keys and is a **UX-3C** copy decision, not a UX-4B
one.

---

# Direct Food Log dashboard shortcut — shipped copy

| Key | EN | ES | Status |
|---|---|---|---|
| `dashboard.foodLog` | Log food | Registrar alimentos | **SHIPPED** |
| `dashboard.foodLogAccessibility` | Open today's food log | Abrir el registro de alimentos de hoy | **SHIPPED** |

The shortcut is additive and routes directly to `/food-log`. It does not rename
Nutrition or remove the targets → plan → log path.

**Shipped by UX-4A** in PR #110, merged at
`5643303a7d173690fba5921e4c97c737288e5f00` — 4 mobile files, +28/−0.

---

# Email verification — V2-B (ADR-P026 Vertical 2)

**PROPOSED. No key here exists on `main`**, and no runtime, schema or route is
authorized by this section. It freezes the copy and the state mapping so that
V2-C (backend) and V2-D (mobile/Web) implement against a fixed contract rather
than inventing copy mid-slice.

## Owner decisions applied

These four were ruled by the owner on 2026-09-02 and are the reason this section
can be written at all; every one of them was previously open:

1. **Reminder lifetime.** The dashboard reminder **persists until the address is
   verified**, but is **dismissible for the current session** and **returns in the
   next session**. This resolves the tension between ADR-P026 Decision 11
   ("persistent reminder") and `.ai/17_PRODUCT_FLOWS.md` §2.4
   ("dismissible-per-session"): both are honoured — persistent across sessions,
   dismissible within one.

   **"Dismissed for the current session" is defined precisely:** in-memory state
   tied to the authenticated session, **cleared on sign-out, on session loss, and
   on app restart**. It is **never written to SQLite** and **never sent to the
   server** — no column, no sync field, no preference row. A dismissal that
   survived a restart would be a persisted preference, which is a different
   feature and is not authorized here.
2. **Automatic issuance.** Registration issues the first verification email
   automatically. **A mail failure must not roll back registration**; the account
   is created and the user resends.
3. **Link host.** `https://account.appfitnessrd.com/verify-email#token=…` — a
   neutral account hostname, not the recovery host. **Live and in Production
   use since 2026-09-04.** Development builds its links from the separate
   `account-dev.appfitnessrd.com` host, so the two environments never share a
   link origin.
4. **Token cleanup.** V1 uses **per-user opportunistic cleanup during issuance
   and reissuance**. No scheduler is introduced (ADR-P026 Decision 12). Global
   scheduled purging is tracked as **post-V1 hardening**.

## Copy family — 23 keys, EN/ES parity

### Dashboard reminder

Tone is **`info`**, never `warning` or `error`: nothing is broken, and the body
says what verifying **enables** rather than what it withholds (§2.4 copy intent).

**The body claims only what is true.** It does **not** say verification keeps the
account recoverable: password recovery is shipped and works on an unverified
address — `forgot-password` looks up the account by email and never consults a
verification flag. Copy implying otherwise would misdescribe shipped behaviour
and pressure the user with a false risk.

| Key | EN | ES | Status |
|---|---|---|---|
| `auth.verify.reminderTitle` | Verify your email | Verifica tu correo | **PROPOSED** — V2-D |
| `auth.verify.reminderBody` | Verifying confirms this address belongs to you and enables email updates when they arrive. | Verificar confirma que esta dirección es tuya y habilita las novedades por correo cuando estén disponibles. | **PROPOSED** — V2-D |
| `auth.verify.reminderResend` | Send verification email | Enviar correo de verificación | **PROPOSED** — V2-D |
| `auth.verify.reminderDismiss` | Not now | Ahora no | **PROPOSED** — V2-D |
| `auth.verify.reminderDismissAccessibility` | Hide this reminder until your next session | Ocultar este recordatorio hasta tu próxima sesión | **PROPOSED** — V2-D |

### Resend outcome

| Key | EN | ES | Status |
|---|---|---|---|
| `auth.verify.resendSending` | Sending… | Enviando… | **PROPOSED** — V2-D |
| `auth.verify.resentTitle` | Check your email | Revisa tu correo | **PROPOSED** — V2-D |
| `auth.verify.resentBody` | If your address needs verifying, a link is on its way. It expires in 24 hours. | Si tu dirección necesita verificación, el enlace está en camino. Caduca en 24 horas. | **PROPOSED** — V2-D |
| `auth.verify.resendFailedTitle` | Couldn't send right now | No se pudo enviar en este momento | **PROPOSED** — V2-D |
| `auth.verify.resendFailedBody` | Your account is unaffected. Try again in a moment. | Tu cuenta no se ve afectada. Inténtalo de nuevo en un momento. | **PROPOSED** — V2-D |

**`resentBody` is the throttle-safe and enumeration-safe acknowledgement.** It is
the *same* string whether a mail was sent, the per-IP or per-account limit was
hit, the address was already verified, or no such account exists — matching the
identical `202` that ADR-P026 Decision 8 requires. Its conditional phrasing
("if your address needs verifying") is deliberate: it is true in every one of
those cases, so the UI never has to lie. **`resendFailedTitle/Body` is reserved
for a failure the client itself observed** — no network, or mail globally
disabled (a `503`) — never for a throttled or unknown-account response.

### Verification landing (`/verify-email`)

| Key | EN | ES | Status |
|---|---|---|---|
| `auth.verify.screenTitle` | Verify email | Verificar correo | **PROPOSED** — V2-D |
| `auth.verify.checkingTitle` | Verifying your email | Verificando tu correo | **PROPOSED** — V2-D |
| `auth.verify.checkingBody` | This only takes a moment. | Esto solo toma un momento. | **PROPOSED** — V2-D |
| `auth.verify.successTitle` | Email verified | Correo verificado | **PROPOSED** — V2-D |
| `auth.verify.successBody` | Thanks — your address is confirmed. You can close this page. | Gracias, tu dirección está confirmada. Puedes cerrar esta página. | **PROPOSED** — V2-D |
| `auth.verify.invalidTitle` | This link is no longer valid | Este enlace ya no es válido | **PROPOSED** — V2-D |
| `auth.verify.invalidBody` | Verification links expire after 24 hours and can be used once. Request another from your account. | Los enlaces de verificación caducan a las 24 horas y se usan una sola vez. Solicita otro desde tu cuenta. | **PROPOSED** — V2-D |
| `auth.verify.missingTokenTitle` | This link is incomplete | Este enlace está incompleto | **PROPOSED** — V2-D |
| `auth.verify.missingTokenBody` | Open the verification link from your email again, or return to your account to request another. | Abre de nuevo el enlace de verificación de tu correo o vuelve a tu cuenta para solicitar otro. | **PROPOSED** — V2-D |
| `auth.verify.errorTitle` | Something went wrong | Algo salió mal | **PROPOSED** — V2-D |
| `auth.verify.errorBody` | We couldn't verify your email right now. Try the link again in a moment. | No pudimos verificar tu correo en este momento. Inténtalo de nuevo en un momento. | **PROPOSED** — V2-D |
| `auth.verify.continue` | Continue | Continuar | **PROPOSED** — V2-D |
| `auth.verify.goToSignIn` | Go to sign in | Ir a iniciar sesión | **PROPOSED** — V2-D |

**One generic message covers expired, already-used and unrecognised tokens.**
*(**ADR-P029 (Accepted, implemented)** narrows "already-used": a replay of
the token that successfully verified an active account renders the
**success** copy instead, until its original expiry. The invalid copy still
covers expired, superseded, invalidated, unrecognised and
consumed-without-success tokens, and a claim on an account already verified
beforehand. **No key was added, removed or reworded.**)*
`invalidTitle`/`invalidBody` never disclose which of the three occurred — the
same discipline the shipped reset landing applies, and the behaviour Production
validation confirmed for recovery on 2026-09-02. `errorTitle`/`errorBody` is a
*different* fact: the request itself failed, so the token may still be good and
retrying the same link is the right advice.

**The landing cannot resend, and must not pretend it can.** It is Web-first and
**session-agnostic**: it may be opened with an authenticated session or without
one, on the registering device or another. It therefore **cannot rely on a
session or on account context**, and it holds **no email address** — the token
arrives in the fragment, not an identifier. **V2-B defines no email input and no
anonymous resend form**, so an action labelled "send a new link" would have
nothing to send to. **Resend happens only from the authenticated dashboard
reminder**, which does have an account context.

**Both failure bodies are worded to stay true in either session state.**
"Request another from your account" and "return to your account to request
another" describe *where* resend lives without asserting whether the reader is
currently signed in — so the same string is honest for a signed-in reader who is
one tap from the dashboard and for a signed-out reader who must sign in first.

**Failure-state navigation is conditional, not fixed.** When a session exists the
landing shows **`auth.verify.continue`** and navigates to the **dashboard**,
where the reminder can resend. When none exists it shows
**`auth.verify.goToSignIn`** and navigates to **sign-in**, after which the
authenticated dashboard reminder provides resend. Both keys are retained for this
reason; neither replaces the other.

**`auth.verify.continue` — frozen behaviour.** On success it navigates to the
**dashboard when an authenticated session already exists**, and to **sign-in
otherwise**. **Redeeming a verification token does not create, extend or restore
a session** — it sets `emailVerifiedAt` and nothing else. No copy may imply the
user has been signed in by following the link.

**No key promises a retry control on a failed verification** beyond re-opening
the link, and none claims a delivery guarantee — `MailDispatcher` is explicitly
best-effort with no persistence or retry.

## Copy this section deliberately does **not** define

The **email body** for the verification message (subject, greeting, button,
sign-off) belongs to the **V2-C** backend template alongside
`password-reset.template.ts`, not to this deck — exactly as Vertical 1's reset
email body lives in code rather than here. This section covers only in-app copy.

---

# Evaluation and limitations — W-3 (ADR-P017)

**Status: TARGET.** ADR-P017 **W-3** authors these **109** keys — **71**
surface strings, **18** affected-area labels, **18** movement labels and the
**2** dashboard navigation strings — in EN and ES with exact key parity. They
exist in the W-3 candidate and are rendered by it; per §AI Instructions rule 2
they are **not SHIPPED** until they reach `origin/main`, and TARGET is used
here with the meaning `.ai/17_PRODUCT_FLOWS.md` §Status vocabulary gives it —
decided and implemented, not yet on `main`.

**The product is named AppFitnessRD** in this family, per ADR-P028 §Decision.
Older copy elsewhere in this deck still reads "AppFitness"; that is historical
evidence and is deliberately left alone.

## What this copy family may and may not say

Beyond §Copy rules, four constraints are specific to a safety surface and are
enforced by a dedicated spec
(`mobile/src/features/wellness/presentation/wellness-safety-copy.spec.ts`),
not left to review:

1. **It positions the product, not the person.** AppFitnessRD is fitness and
   general-wellness software; it does not diagnose, treat, or decide whether
   exercise is safe for anyone, and it recommends a qualified professional.
2. **No string ever describes the user as safe, cleared, approved or medically
   fit.** Where those words appear at all, they appear only inside a denial —
   the spec requires a negation in the same string.
3. **It states what is never collected**: no provider identity, finding,
   diagnosis, condition, medication, treatment, rehabilitation instruction,
   document, clearance, severity, dosage, supplement or free text. There is no
   input in which any of them could be typed.
4. **An empty selection is a declaration, not a clearance.**
   `wellness.safety.nothingDeclared` says both halves explicitly, because the
   dangerous reading of an empty limitation list is "you are fine to train".

## Write outcomes are exhaustive over sync state

A write confirmation has **two** inputs, not one: what the user did, and where
that change currently stands. Treating "not pending" as "synchronized" put a
`success` "up to date" banner directly above the Conflict warning — a
contradiction, and a claim the repository cannot support. The deck therefore
words **six** confirmations, and the screen selects between them with a
`Record` keyed by both unions, so a missing pair fails `tsc`.

| Outcome | `synced` | `pending` | `conflict` |
|---|---|---|---|
| Save | `savedTitle` / `savedBody` — success wording is honest, the write reached the server | `savedPendingTitle` / `savedPendingBody` — `info`: stored on this device, waiting to synchronize | `savedConflictTitle` / `savedConflictBody` — `warning`: acknowledges the **local** action only and says the difference remains |
| Removal | `removedTitle` / `removedBody` | `removedPendingTitle` / `removedPendingBody` | `removedConflictTitle` / `removedConflictBody` |

The `conflict` wording **never** says complete, current everywhere, up to date
or resolved — a spec asserts that against all six `*Conflict*` keys in both
catalogs — and the separate report-only Conflict banner still renders beneath
the confirmation. **No resolution copy is added** (BUG-012), and the "both
versions preserved" claim is still withheld (BUG-014).

The standing Conflict banner (`syncConflictTitle` / `syncConflictBody`) was
also corrected: it previously ended "saving again records your current
answers", which reads as a remedy for the divergence and is not one. It now
reports only that the local and synchronized copies differ and that **this
screen cannot settle that difference**, which is exactly BUG-012's
report-only position. The local save and removal acknowledgements are
unaffected — they still confirm what happened on the device.

## Removal is from the active profile, not erasure

W-2 removal is a **soft delete**: `deleted_at` / `deleted_by` are set, the
version is bumped and the tombstone keeps synchronizing — the stored field
values are **not** blanked. Copy that promised "the app will stop keeping your
evaluation date and the limitations you declared" was therefore inaccurate and
is replaced. The wording now:

- says the details **stop being part of the active profile** and are no longer
  shown or used;
- says a **record of the removal stays on this device** and synchronizes to the
  user's other devices;
- describes **account deletion** the way ADR-P011 and
  `docs/legal/PRIVACY_POLICY.md` §6 do: it permanently removes the account and
  its data, **keeping only an anonymized security audit record** — the
  exception is stated rather than omitted, because the immutable audit trail
  is retained (de-identified) by decision;
- states **no retention period** and makes no other legal or regulatory
  promise;
- reflects synchronization status honestly in the pending and conflict arms.

A spec asserts the positive wording and rejects the erasure vocabulary ("stop
keeping", "permanently deleted", "erased from this device", "from every
device", and the ES equivalents) across the whole family.

## Pending copy is factual, not absolute

`savedPendingBody` previously opened with "Nothing is lost." — a guarantee the
product cannot make, because the queue lives on a device that can be lost
before it drains. It now states only what is true: the answers are stored on
this device and are waiting to synchronize. A spec rejects absolute wording
("nothing is lost", "no se pierde nada", "guaranteed", "safe forever" and
kin) anywhere in the family. Pending still **reassures** — distinction 4 is
about not alarming the user, not about promising the impossible.

Two further rules follow the existing deck:

- **Token labels are presentation only.** Each label maps one way, token →
  label. The stored value is always the language-neutral W-1 token, so
  switching language cannot change what is persisted.
- **No system vocabulary and no raw token** reaches a sentence, asserted for
  both catalogs.

**This deck opens the `wellness.*` namespace**, the second cross-cutting
family after `common.*`.

## Surface, state and action copy — 71 keys

| Key | EN | ES | Status |
|---|---|---|---|
| `wellness.safety.routeTitle` | Evaluation and limitations | Evaluación y limitaciones | **TARGET** |
| `wellness.safety.title` | Evaluation and limitations | Evaluación y limitaciones | **TARGET** |
| `wellness.safety.subtitle` | Optional details that help us keep your training conservative. | Datos opcionales que nos ayudan a mantener tu entrenamiento conservador. | **TARGET** |
| `wellness.safety.disclaimerTitle` | This is fitness software, not a medical opinion | Esto es software de fitness, no una opinión médica | **TARGET** |
| `wellness.safety.disclaimerBody` | AppFitnessRD is a fitness and general-wellness app. It does not diagnose, treat, or decide whether exercise is safe for you, and it never says that you are cleared or medically fit. Talk to a qualified professional about your health. | AppFitnessRD es una app de fitness y bienestar general. No diagnostica, no trata y no decide si el ejercicio es seguro para ti, y nunca dice que estés autorizado ni en condiciones médicas para entrenar. Consulta tu salud con un profesional cualificado. | **TARGET** |
| `wellness.safety.privacyNote` | We record only whether you completed an evaluation, its date, and the areas and movements you pick from the lists. We never ask who evaluated you or what was found, and we never ask about conditions, medications or treatments. There is nowhere here to write notes. | Solo registramos si completaste una evaluación, su fecha y las zonas y movimientos que eliges de las listas. Nunca preguntamos quién te evaluó ni qué se encontró, y nunca preguntamos por condiciones, medicamentos o tratamientos. Aquí no hay ningún lugar para escribir notas. | **TARGET** |
| `wellness.safety.empty` | You have not declared anything yet. | Todavía no has declarado nada. | **TARGET** |
| `wellness.safety.loading` | Loading… | Cargando… | **TARGET** |
| `wellness.safety.loadingAccessibility` | Loading your evaluation and limitations | Cargando tu evaluación y limitaciones | **TARGET** |
| `wellness.safety.errorTitle` | Something went wrong | Algo salió mal | **TARGET** |
| `wellness.safety.errorMessage` | Your evaluation and limitations could not be loaded right now. | No se pudieron cargar tu evaluación y limitaciones en este momento. | **TARGET** |
| `wellness.safety.retry` | Try again | Intentar de nuevo | **TARGET** |
| `wellness.safety.retryAccessibility` | Try loading your evaluation and limitations again | Volver a intentar cargar tu evaluación y limitaciones | **TARGET** |
| `wellness.safety.invalidTitle` | These details cannot be shown | No podemos mostrar estos datos | **TARGET** |
| `wellness.safety.invalidMessage` | The copy saved on this device cannot be read safely, so we left it exactly as it is. Fill in the form and save to replace it. | La copia guardada en este dispositivo no se puede leer de forma segura, así que la dejamos tal como está. Completa el formulario y guarda para reemplazarla. | **TARGET** |
| `wellness.safety.saveErrorTitle` | Not saved | No se guardó | **TARGET** |
| `wellness.safety.saveErrorMessage` | Your evaluation and limitations could not be saved. Please try again. | No se pudieron guardar tu evaluación y limitaciones. Inténtalo de nuevo. | **TARGET** |
| `wellness.safety.invalidInputTitle` | Check your answers | Revisa tus respuestas | **TARGET** |
| `wellness.safety.invalidInputMessage` | Some of what you entered could not be accepted. Review the date and your selections, then save again. | Algo de lo que ingresaste no se pudo aceptar. Revisa la fecha y tus selecciones, y vuelve a guardar. | **TARGET** |
| `wellness.safety.removeErrorTitle` | Not removed | No se eliminó | **TARGET** |
| `wellness.safety.removeErrorMessage` | Your evaluation and limitations could not be removed. Please try again. | No se pudieron eliminar tu evaluación y limitaciones. Inténtalo de nuevo. | **TARGET** |
| `wellness.safety.webUnavailableTitle` | Evaluation and limitations aren't available on the web | La evaluación y las limitaciones no están disponibles en la web | **TARGET** |
| `wellness.safety.webUnavailableBody` | Use the AppFitnessRD mobile app to add or change these details. | Usa la app móvil de AppFitnessRD para agregar o cambiar estos datos. | **TARGET** |
| `wellness.safety.evaluation.legend` | Have you completed a professional physical evaluation? | ¿Has completado una evaluación física profesional? | **TARGET** |
| `wellness.safety.evaluation.yes` | Yes | Sí | **TARGET** |
| `wellness.safety.evaluation.no` | Not yet | Todavía no | **TARGET** |
| `wellness.safety.evaluation.hint` | Either answer is fine. Nothing in the app is locked or unlocked by it. | Cualquier respuesta está bien. Nada en la app se bloquea ni se desbloquea por ella. | **TARGET** |
| `wellness.safety.evaluation.dateLabel` | Date of the evaluation | Fecha de la evaluación | **TARGET** |
| `wellness.safety.evaluation.datePlaceholder` | YYYY-MM-DD | AAAA-MM-DD | **TARGET** |
| `wellness.safety.evaluation.dateHint` | Just the date. We do not ask who performed it or what it found. | Solo la fecha. No preguntamos quién la realizó ni qué encontró. | **TARGET** |
| `wellness.safety.validation.dateRequired` | Add the date of the evaluation | Agrega la fecha de la evaluación | **TARGET** |
| `wellness.safety.validation.dateFormat` | Use the date format YYYY-MM-DD | Usa el formato de fecha AAAA-MM-DD | **TARGET** |
| `wellness.safety.validation.validDate` | Enter a real calendar date | Introduce una fecha real del calendario | **TARGET** |
| `wellness.safety.validation.dateNotFuture` | The date cannot be in the future | La fecha no puede estar en el futuro | **TARGET** |
| `wellness.safety.areas.legend` | Body areas to treat carefully | Zonas del cuerpo que debemos tratar con cuidado | **TARGET** |
| `wellness.safety.areas.hint` | Pick from the list. Areas of the body only — never a condition, a cause or how severe it is. | Elige de la lista. Solo zonas del cuerpo: nunca una condición, una causa ni su gravedad. | **TARGET** |
| `wellness.safety.movements.legend` | Movements you would rather avoid | Movimientos que prefieres evitar | **TARGET** |
| `wellness.safety.movements.hint` | Pick from the list. You can change this whenever you want. | Elige de la lista. Puedes cambiarlo cuando quieras. | **TARGET** |
| `wellness.safety.nothingDeclared` | Selecting nothing records that you declared no limitations. It does not mean you are cleared or medically fit to train. | No seleccionar nada registra que no declaraste limitaciones. No significa que estés autorizado ni en condiciones médicas para entrenar. | **TARGET** |
| `wellness.safety.save` | Save | Guardar | **TARGET** |
| `wellness.safety.saveAccessibility` | Save your evaluation and limitations | Guardar tu evaluación y limitaciones | **TARGET** |
| `wellness.safety.savedTitle` | Saved | Guardado | **TARGET** |
| `wellness.safety.savedBody` | Your evaluation and limitations are up to date. | Tu evaluación y limitaciones están actualizadas. | **TARGET** |
| `wellness.safety.savedPendingTitle` | Saved on this device | Guardado en este dispositivo | **TARGET** |
| `wellness.safety.savedPendingBody` | Your answers are stored on this device and are waiting to synchronize. | Tus respuestas están guardadas en este dispositivo y esperan sincronizarse. | **TARGET** |
| `wellness.safety.savedConflictTitle` | Saved here; a synchronization difference remains | Guardado aquí; la diferencia de sincronización sigue ahí | **TARGET** |
| `wellness.safety.savedConflictBody` | Your change is stored on this device. This record still differs from the synchronized copy, and saving does not change that difference. | Tu cambio está guardado en este dispositivo. Este registro sigue siendo distinto de la copia sincronizada, y guardar no cambia esa diferencia. | **TARGET** |
| `wellness.safety.syncPending` | Saved on this device | Guardado en este dispositivo | **TARGET** |
| `wellness.safety.syncPendingAccessibility` | Saved on this device; sync pending | Guardado en este dispositivo; sincronización pendiente | **TARGET** |
| `wellness.safety.syncConflictTitle` | These details need review | Estos datos necesitan revisión | **TARGET** |
| `wellness.safety.syncConflictBody` | What is saved on this device and what came back from the server no longer match, and this screen cannot settle that difference. You can keep using the app. | Lo guardado en este dispositivo y lo que llegó del servidor ya no coinciden, y esta pantalla no puede solucionar esa diferencia. Puedes seguir usando la app. | **TARGET** |
| `wellness.safety.remove` | Remove from my profile | Quitar de mi perfil | **TARGET** |
| `wellness.safety.removeAccessibility` | Remove your evaluation and limitations from your active profile | Quitar tu evaluación y limitaciones de tu perfil activo | **TARGET** |
| `wellness.safety.removeConfirmTitle` | Remove these details from your profile? | ¿Quitar estos datos de tu perfil? | **TARGET** |
| `wellness.safety.removeConfirmBody` | They stop being part of your active profile and the app no longer shows or uses them. A record of the removal stays on this device and synchronizes to your other devices. Deleting your account permanently removes the account and its data, keeping only an anonymized security audit record. | Dejarán de formar parte de tu perfil activo y la app ya no los muestra ni los usa. En este dispositivo queda un registro de la eliminación, que se sincroniza con tus otros dispositivos. Eliminar tu cuenta quita de forma permanente la cuenta y sus datos, y conserva solo un registro de seguridad anonimizado. | **TARGET** |
| `wellness.safety.removeConfirm` | Remove from profile | Quitar del perfil | **TARGET** |
| `wellness.safety.removeConfirmAccessibility` | Confirm removing your evaluation and limitations from your active profile | Confirmar que quitas tu evaluación y limitaciones de tu perfil activo | **TARGET** |
| `wellness.safety.removeCancel` | Keep them | Conservarlos | **TARGET** |
| `wellness.safety.removeCancelAccessibility` | Keep your evaluation and limitations | Conservar tu evaluación y limitaciones | **TARGET** |
| `wellness.safety.removedTitle` | Removed from your profile | Quitado de tu perfil | **TARGET** |
| `wellness.safety.removedBody` | Nothing is declared in your profile now. You can add these details again whenever you want. | Ahora no hay nada declarado en tu perfil. Puedes agregar estos datos de nuevo cuando quieras. | **TARGET** |
| `wellness.safety.removedPendingTitle` | Removed on this device | Quitado en este dispositivo | **TARGET** |
| `wellness.safety.removedPendingBody` | These details are no longer part of your active profile here. The removal is stored on this device and is waiting to synchronize. | Estos datos ya no forman parte de tu perfil activo aquí. La eliminación está guardada en este dispositivo y espera sincronizarse. | **TARGET** |
| `wellness.safety.removedConflictTitle` | Removed here; a synchronization difference remains | Quitado aquí; la diferencia de sincronización sigue ahí | **TARGET** |
| `wellness.safety.removedConflictBody` | These details are no longer part of your active profile on this device. This record still differs from the synchronized copy, and removing does not change that difference. | Estos datos ya no forman parte de tu perfil activo en este dispositivo. Este registro sigue siendo distinto de la copia sincronizada, y quitarlos no cambia esa diferencia. | **TARGET** |
| `wellness.safety.recommendation.accessibility` | Professional evaluation recommendation | Recomendación de evaluación profesional | **TARGET** |
| `wellness.safety.recommendation.title` | Consider a professional physical evaluation | Considera una evaluación física profesional | **TARGET** |
| `wellness.safety.recommendation.body` | A qualified professional can tell you what suits your body. AppFitnessRD is fitness and general-wellness software and cannot make that judgement for you. | Un profesional cualificado puede indicarte qué es adecuado para tu cuerpo. AppFitnessRD es software de fitness y bienestar general y no puede hacer ese juicio por ti. | **TARGET** |
| `wellness.safety.recommendation.optional` | This is a recommendation, not a requirement. Everything in the app stays available either way. | Es una recomendación, no un requisito. Todo en la app sigue disponible de cualquier manera. | **TARGET** |
| `wellness.safety.recommendation.cta` | Add these details | Agregar estos datos | **TARGET** |
| `wellness.safety.recommendation.ctaAccessibility` | Add your evaluation and limitations | Agregar tu evaluación y limitaciones | **TARGET** |

## Affected-area labels — 18 keys

Anatomical regions, never conditions, causes or severities. Chip order is
**token order**, identical in both languages. `head` is absent because W-1
deliberately excludes it.

| Key | EN | ES | Status |
|---|---|---|---|
| `wellness.safety.area.abdomen` | Abdomen | Abdomen | **TARGET** |
| `wellness.safety.area.ankle` | Ankle | Tobillo | **TARGET** |
| `wellness.safety.area.chest` | Chest | Pecho | **TARGET** |
| `wellness.safety.area.elbow` | Elbow | Codo | **TARGET** |
| `wellness.safety.area.foot` | Foot | Pie | **TARGET** |
| `wellness.safety.area.forearm` | Forearm | Antebrazo | **TARGET** |
| `wellness.safety.area.groin` | Groin | Ingle | **TARGET** |
| `wellness.safety.area.hand` | Hand | Mano | **TARGET** |
| `wellness.safety.area.hip` | Hip | Cadera | **TARGET** |
| `wellness.safety.area.knee` | Knee | Rodilla | **TARGET** |
| `wellness.safety.area.lowerBack` | Lower back | Espalda baja | **TARGET** |
| `wellness.safety.area.lowerLeg` | Lower leg | Pierna inferior | **TARGET** |
| `wellness.safety.area.neck` | Neck | Cuello | **TARGET** |
| `wellness.safety.area.shoulder` | Shoulder | Hombro | **TARGET** |
| `wellness.safety.area.thigh` | Thigh | Muslo | **TARGET** |
| `wellness.safety.area.upperArm` | Upper arm | Brazo superior | **TARGET** |
| `wellness.safety.area.upperBack` | Upper back | Espalda alta | **TARGET** |
| `wellness.safety.area.wrist` | Wrist | Muñeca | **TARGET** |

## Movement labels — 18 keys

Movement patterns drawn from the shipped exercise catalog (W-1).
`behind_neck_press` is absent because no shipped exercise declares it.

| Key | EN | ES | Status |
|---|---|---|---|
| `wellness.safety.movement.bridging` | Glute bridge | Puente de glúteos | **TARGET** |
| `wellness.safety.movement.deepSquat` | Deep squat | Sentadilla profunda | **TARGET** |
| `wellness.safety.movement.dips` | Dips | Fondos en paralelas | **TARGET** |
| `wellness.safety.movement.frontRackLoading` | Front-rack loading | Carga en rack frontal | **TARGET** |
| `wellness.safety.movement.goodMorning` | Barbell good morning | Flexión de tronco con barra | **TARGET** |
| `wellness.safety.movement.heavyHinge` | Heavy hip hinge | Bisagra de cadera con carga alta | **TARGET** |
| `wellness.safety.movement.heavyPressing` | Heavy pressing | Empujes con carga alta | **TARGET** |
| `wellness.safety.movement.highImpactCardio` | High-impact cardio | Cardio de alto impacto | **TARGET** |
| `wellness.safety.movement.jumping` | Jumping | Saltos | **TARGET** |
| `wellness.safety.movement.loadedCarries` | Loaded carries | Transportes con carga | **TARGET** |
| `wellness.safety.movement.loadedSpinalFlexion` | Loaded spinal flexion | Flexión de columna con carga | **TARGET** |
| `wellness.safety.movement.lunge` | Lunge | Zancada | **TARGET** |
| `wellness.safety.movement.maxEffortLifts` | Maximum-effort lifts | Levantamientos al máximo esfuerzo | **TARGET** |
| `wellness.safety.movement.overheadPress` | Overhead press | Press por encima de la cabeza | **TARGET** |
| `wellness.safety.movement.running` | Running | Correr | **TARGET** |
| `wellness.safety.movement.skullCrushers` | Lying triceps extension | Extensión de tríceps tumbado | **TARGET** |
| `wellness.safety.movement.sprinting` | Sprinting | Esprintar | **TARGET** |
| `wellness.safety.movement.valsalvaHeavyLifts` | Heavy lifts while holding your breath | Levantamientos pesados aguantando la respiración | **TARGET** |

## Dashboard navigation entry — 2 keys

The persistent way back into the surface, present whether or not a profile
exists. It is **not** a fourth first-run checklist step: the checklist keeps
its three steps and its `{completed} of {total}` line unchanged.

| Key | EN | ES | Status |
|---|---|---|---|
| `dashboard.wellnessSafety` | Evaluation and limitations | Evaluación y limitaciones | **TARGET** |
| `dashboard.wellnessSafetyAccessibility` | View or edit your evaluation and limitations | Ver o editar tu evaluación y limitaciones | **TARGET** |

## A first for this deck: a retry control

`wellness.safety.retry` / `retryAccessibility` are the **first**
retry-related keys in the product. `.ai/08_UI_UX.md` §Current implementation
evidence recorded "Retry-related localization keys: **0**" at `2692e589`, and
is reconciled in this change to record **2 (TARGET)**. The Error state has
always specified "retry, or abandon" as its user action; W-3 is the first
surface to implement the retry half. No other surface gains one, and the
Web-unavailable state still has **no** retry, by decision (ADR-P019 §5).

---
# Proposed-key handoff

UX-3C handed off **33** proposed keys. **All thirty-three have now shipped**,
leaving **none outstanding**:

> **Count correction.** The previous revision read "Thirty-two have since
> shipped, leaving **3 outstanding**" — arithmetically wrong in two ways: 33 − 32
> is 1, not 3, and the owner table below listed only one outstanding row. The
> stale "3" survived an edit that updated the shipped figure but not the
> remainder. Both are corrected here.

| Owner | Keys | Purpose | Status |
|---|---:|---|---|
| BUG-010 | 1 | Shared bilingual loading label | **SHIPPED** |
| BUG-009 | 2 | Progress-card Error distinct from Empty | **SHIPPED** |
| BUG-007 | 5 | Food Log Conflict distinct from catalog incompatibility | **SHIPPED** |
| BUG-008 | 6 | Food Log add/edit/remove failures distinct from load failure | **SHIPPED** |
| BUG-011 | 10 | Pending/Conflict row reporting across Workout, Preferences and Progress | **SHIPPED** — all 10 keys land; BUG-011 stays open on a measurement-listing residual, not on copy |
| UX-4B | 7 | Advisory first-run checklist | **SHIPPED** |
| UX-4A | 2 | Direct Food Log dashboard shortcut | **SHIPPED** |

Every implementation slice must add EN and ES entries together, preserve exact
key parity, add component/regression coverage, and keep raw technical messages
out of presentation. No owning slice may import the remaining keys merely
because they share this document.

**A second, separate handoff opens with V2-B**: the **23** `auth.verify.*` keys
above are PROPOSED and owned by **V2-D**. They are counted apart from the UX-3C
set on purpose — UX-3C's 33 are closed, and folding a new batch into that total
would erase the fact that it completed.

---

# Deferred copy

| Area | Why no copy appears here |
|---|---|
| Password recovery | **No longer deferred — shipped.** PR #102 merged as `724a18e7`: the `forgot-password` / `reset-password` endpoints (`auth.controller.ts:107`, `:133`), the `/forgot-password` and `/reset-password` routes, and the EN/ES copy are all on `main`, and Production validation on **2026-09-02** exercised a real delivery end to end. This row previously read "TARGET in PR #102, not on `main`"; that is corrected. The shipped recovery copy is not re-tabulated here — this deck's scope is state copy, and recovery's is owned by FEATURE-011 Vertical 1. |
| Email verification | **All 23 keys above are now in the catalogues** in EN and ES (`mobile/src/shared/localization/resources/`), imported by **V2-D** and rendered by the `/verify-email` route and the dashboard reminder. The EN/ES *email* copy is a separate surface owned by V2-C and lives in `api/src/modules/mail/domain/email-verification.template.ts`, not in this deck. **Verification email is now sent** — this row previously read "No verification email is sent yet (V2-E)", which is corrected: **both V2-E halves passed 2026-09-04** and Production now attempts verification delivery for registrations (issuance stays best-effort; a mail failure is non-blocking, with resend available). Users therefore **do** reach the landing from a real link. **Deep-link completion remains a separate open V1 gate** — an emailed link still opens the Web portal, not the app. |
| Conflict resolution actions/screens | **ADR-P030 (Accepted 2026-09-07)** now supplies the flow and repository decision BUG-012 was waiting on, and **names the key families** a resolution surface would need — screen title/empty/error, the two choice labels, chosen-but-unsettled, settlement-failed-retry, already-settled, **stale-comparison / review-again**, **not-resolvable-on-this-device**, offline notice, the withheld-field phrase, the unsupported-entity fallback, and the action-needed distinction. It deliberately **words none of them**: ADR-P030 assigns the wording to this deck, in slice **C-5** of its own sequence, which sits **after** the guard fix (BUG-014), per-user scoping, the transaction-aware write contract, the server resolve contract and the local resolution service. **No key is proposed here yet**, no status changes, and Conflict copy on the existing surfaces stays **reporting-only**. Chosen-but-unsettled will reuse the existing **Pending sync** tone rather than introducing a ninth state. **No owner decision in ADR-P030 remains open**, and the ADR is now **Accepted** — but acceptance authorizes the **architecture only**, and **slice C-5 is unauthorized**, so **no copy here is authorized yet**. |
| Trend-chart and weekly structure | Specified in `.ai/20_PROGRESS_NONVISUAL.md` (UX-3D), and implemented 2026-09-07. Its seven keys are worded above and are now **SHIPPED**; composition, accessibility structure and the no-nesting rule are not repeated here. |
| Bottom tabs | Deferred by ADR-P027; the non-binding map is not a copy target. |
| Dormant medical domain | Out of public V1 under ADR-P017. |

---

# Accessibility scope

This deck proves only that copy exists or has been specified.

- Existing `accessibilityLabel` and `accessibilityRole` props do not prove an
  announcement.
- Proposed `*Accessibility` strings are names, not verified screen-reader
  output.
- `aria-live="polite"` on FormField remains the limited ADR-P024 request; it
  does not apply automatically to state banners.
- Manual VoiceOver, TalkBack and browser-AT verification remains UX-4C and must
  be recorded per surface before any outcome is marked satisfied.

---

# Related documents

- `.ai/00_PROJECT.md` — wellness scope, bilingual delivery and decision order.
- `.ai/06_MOBILE.md` — localization, error handling and applicable-state rule.
- `.ai/08_UI_UX.md` — voice, bilingual layout, canonical states and component contracts.
- `.ai/11_BACKLOG.md` — FEATURE-010, BUG-007 through BUG-012.
- `.ai/12_DECISIONS.md` — ADR-P017, P019, P022–P027.
- `.ai/17_PRODUCT_FLOWS.md` — flow intent and UX-3 sequencing.
- `.ai/18_SCREEN_STATE_MATRICES.md` — authoritative state applicability and triggers.

---

# AI Instructions

1. Read `.ai/18_SCREEN_STATE_MATRICES.md` before adding state copy. Never add
   copy for a state marked `n/a` without first authorizing the source-state
   change.
2. Preserve the exact SHIPPED / PROPOSED distinction. A specified key does not
   exist until it is present on `origin/main` in both catalogues and wired by a
   reachable surface.
3. Never convert Conflict reporting into a resolution flow. BUG-012 owns that
   missing behaviour and requires a separate specification.
4. Add EN and ES keys in the same change and verify exact key-set parity.
5. Do not claim an accessibility outcome before the UX-4C manual AT record.
