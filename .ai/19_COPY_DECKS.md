# AppFitness EN/ES State Copy Decks (V1)

Version: 1.1
Status: Active
Last Updated: 2026-08-28

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
- **Not conflict resolution.** BUG-012 requires a separate flow and data
  decision. This deck specifies reporting copy only and defines no review
  action, choose-version, keep-mine or keep-server control.
- **Not the UX-3D specification.** `.ai/20_PROGRESS_NONVISUAL.md` owns the
  non-visual equivalent for `TrendBars` and `WeeklySnapshotSummary` — its
  structure, accessibility semantics, ordering and test contract, including the
  rule that no wrapper may be marked accessible. This deck owns only the
  **wording** of the seven keys that equivalent proposes, listed under §Progress.
- **Not password-recovery or verification copy.** Recovery remains outside
  `main` in PR #102; verification awaits ADR-P026 Vertical 2 authorization.
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

The route gate is a pre-screen phase rather than a canonical state. BUG-010 owns
the only missing bilingual string.

| Key | EN | ES | Status |
|---|---|---|---|
| `common.loadingContentAccessibility` | Loading content | Cargando contenido | **PROPOSED** — BUG-010 |

Implementation constraint: replace the hardcoded English label with this key;
do not claim when or how assistive technology announces it. Whether the label
belongs on one container or repeated placeholder blocks is UX-4C verification,
not a copy decision.

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
| `progress.card.errorTitle` | Progress unavailable | Progreso no disponible | **PROPOSED** — BUG-009 |
| `progress.card.errorBody` | We couldn't load your progress right now. | No pudimos cargar tu progreso en este momento. | **PROPOSED** — BUG-009 |

The proposed Error copy contains no false Empty claim and promises no retry
control. UX-4 implementation decides whether the existing card remains
pressable in Error.

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
| Conflict row — `workout.log.syncConflict` | Conflict | Conflicto | **PROPOSED** — BUG-011 |
| Conflict row label — `workout.log.syncConflictAccessibility` | Workout sync conflict | Conflicto de sincronización del entrenamiento | **PROPOSED** — BUG-011 |
| Web unavailable title — `workout.log.webUnavailableTitle` | Workout logging isn't available on the web | El registro de entrenamientos no está disponible en la web | **SHIPPED** |
| Web unavailable body — `workout.log.webUnavailableBody` | Use the AppFitness mobile app for the complete workout-logging experience. | Usa la app móvil de AppFitness para la experiencia completa de registro de entrenamientos. | **SHIPPED** |

The proposed Conflict hint reports the row state only. It adds no choose action
and must use `warning`, never `error`, when BUG-011 is implemented.

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
assigned to that cause. They must no longer carry a version conflict after
BUG-007 implementation.

| Key | EN | ES | Status |
|---|---|---|---|
| `nutrition.log.actionTitle` | Action needed | Acción necesaria | **SHIPPED — non-conformant while causes remain collapsed** |
| `nutrition.log.actionMessageOne` | item cannot sync because the food is not available on the server. Remove and re-add it to continue. | elemento no puede sincronizarse porque el alimento no está disponible en el servidor. Elimínalo y agrégalo nuevamente para continuar. | **SHIPPED** — catalog incompatibility only |
| `nutrition.log.actionMessageMany` | items cannot sync because the food is not available on the server. Remove and re-add them to continue. | elementos no pueden sincronizarse porque el alimento no está disponible en el servidor. Elimínalos y agrégalos nuevamente para continuar. | **SHIPPED** — catalog incompatibility only |
| `nutrition.log.actionShort` | Action needed | Acción necesaria | **SHIPPED — non-conformant while causes remain collapsed** |
| `nutrition.log.actionAccessibility` | Sync action required | Se requiere una acción de sincronización | **SHIPPED — non-conformant while causes remain collapsed** |
| `nutrition.log.conflictTitle` | Food log conflict | Conflicto en el registro de alimentos | **PROPOSED** — BUG-007 |
| `nutrition.log.conflictMessageOne` | food log item has changes from another device. Both versions are preserved. | elemento del registro tiene cambios de otro dispositivo. Ambas versiones se conservan. | **PROPOSED** — BUG-007 |
| `nutrition.log.conflictMessageMany` | food log items have changes from another device. Both versions are preserved. | elementos del registro tienen cambios de otro dispositivo. Ambas versiones se conservan. | **PROPOSED** — BUG-007 |
| `nutrition.log.conflictShort` | Conflict | Conflicto | **PROPOSED** — BUG-007 |
| `nutrition.log.conflictAccessibility` | Food log sync conflict | Conflicto de sincronización del registro de alimentos | **PROPOSED** — BUG-007 |

The banner prepends the localized count, matching the shipped `*One` / `*Many`
composition pattern. The Conflict copy is deliberately report-only. There is no
action sentence or resolution CTA because BUG-012 has no authorized resolution
flow.

### Write failures

These messages are separate from the shipped load failure and never render raw
store text.

| Key | EN | ES | Status |
|---|---|---|---|
| `nutrition.log.writeError.addTitle` | Couldn't add food | No se pudo agregar el alimento | **PROPOSED** — BUG-008 |
| `nutrition.log.writeError.addBody` | Your food wasn't added. Your selections are still here. Try again. | El alimento no se agregó. Tus selecciones siguen aquí. Inténtalo de nuevo. | **PROPOSED** — BUG-008 |
| `nutrition.log.writeError.servingsTitle` | Couldn't update servings | No se pudieron actualizar las porciones | **PROPOSED** — BUG-008 |
| `nutrition.log.writeError.servingsBody` | Your serving change wasn't saved. Try again. | El cambio de porciones no se guardó. Inténtalo de nuevo. | **PROPOSED** — BUG-008 |
| `nutrition.log.writeError.removeTitle` | Couldn't remove food | No se pudo eliminar el alimento | **PROPOSED** — BUG-008 |
| `nutrition.log.writeError.removeBody` | The food is still in your log. Try again. | El alimento sigue en tu registro. Inténtalo de nuevo. | **PROPOSED** — BUG-008 |

## Dietary Preferences

| Key | EN | ES | Status |
|---|---|---|---|
| `nutrition.preferences.loadingAccessibility` | Loading dietary preferences | Cargando preferencias alimentarias | **SHIPPED** |
| `nutrition.preferences.empty` | No exclusions yet. | Todavía no hay exclusiones. | **SHIPPED** |
| `nutrition.preferences.errorTitle` | Something went wrong | Algo salió mal | **SHIPPED** |
| `nutrition.preferences.errorMessage` | Your dietary preferences could not be loaded right now. | No se pudieron cargar tus preferencias alimentarias. | **SHIPPED** |
| `nutrition.preferences.webUnavailableTitle` | Dietary preferences aren't available on the web | Las preferencias alimentarias no están disponibles en la web | **SHIPPED** |
| `nutrition.preferences.webUnavailableBody` | Use the AppFitness mobile app to manage your allergies and food preferences. | Usa la app móvil de AppFitness para gestionar tus alergias y preferencias de alimentos. | **SHIPPED** |
| `nutrition.preferences.syncPending` | Saved on this device | Guardado en este dispositivo | **PROPOSED** — BUG-011 |
| `nutrition.preferences.syncPendingAccessibility` | Preference saved on this device; sync pending | Preferencia guardada en este dispositivo; sincronización pendiente | **PROPOSED** — BUG-011 |
| `nutrition.preferences.syncConflict` | Conflict | Conflicto | **PROPOSED** — BUG-011 |
| `nutrition.preferences.syncConflictAccessibility` | Dietary preference sync conflict | Conflicto de sincronización de la preferencia alimentaria | **PROPOSED** — BUG-011 |

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
| `progress.syncPending` | Saved on this device | Guardado en este dispositivo | **PROPOSED** — BUG-011 |
| `progress.syncPendingAccessibility` | Progress entry saved on this device; sync pending | Registro de progreso guardado en este dispositivo; sincronización pendiente | **PROPOSED** — BUG-011 |
| `progress.syncConflict` | Conflict | Conflicto | **PROPOSED** — BUG-011 |
| `progress.syncConflictAccessibility` | Progress entry sync conflict | Conflicto de sincronización del registro de progreso | **PROPOSED** — BUG-011 |

Pending and Conflict apply to listed weight, measurement and snapshot rows, not
to the aggregate dashboard card.

## Progress trends and weekly semantics (UX-3D)

Seven keys proposed by `.ai/20_PROGRESS_NONVISUAL.md`. That document owns
composition — where each string renders and whether it is visible, announced or
both; this table owns wording. All seven are absent from both 696-key catalogues
and carry EN/ES parity.

| Key | EN | ES | Status |
|---|---|---|---|
| `progress.trends.orderOldestFirst` | oldest to newest | de la más antigua a la más reciente | **PROPOSED** — UX-3D |
| `progress.trends.readingOne` | reading | lectura | **PROPOSED** — UX-3D |
| `progress.trends.readingMany` | readings | lecturas | **PROPOSED** — UX-3D |
| `progress.trends.windowNotice` | Showing only the most recent readings | Mostrando solo las lecturas más recientes | **PROPOSED** — UX-3D |
| `progress.trends.latestMarker` | latest | última | **PROPOSED** — UX-3D |
| `progress.weekly.notRecorded` | Not recorded | Sin registrar | **PROPOSED** — UX-3D |
| `progress.weekly.newestFirst` | newest first | de la más reciente a la más antigua | **PROPOSED** — UX-3D |

`progress.weekly.weekOf` ("Week of" / "Semana del") and
`progress.weekly.earlierWeeks` ("Earlier weeks" / "Semanas anteriores") are
**reused** and stay **SHIPPED** — no duplicate key is proposed for either.

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

# First-run checklist — approved shape, proposed copy

ADR-P027 approves an advisory dashboard checklist derived from the existing
Data-gap source. UX-3C specifies three copy-level steps by grouping the five
gap ids without changing their routing:

1. Profile basics — `profile`, `birth-date`, `height` → `/profile-edit`.
2. Goal — `default-goal` → `/goal-edit`.
3. First weight — `weight` → `/progress`.

| Key | EN | ES | Status |
|---|---|---|---|
| `dashboard.onboarding.accessibility` | Getting started checklist | Lista de primeros pasos | **PROPOSED** — UX-4B |
| `dashboard.onboarding.title` | Finish setting up AppFitness | Termina de configurar AppFitness | **PROPOSED** — UX-4B |
| `dashboard.onboarding.description` | Complete these steps at your pace. You can use the rest of the app now. | Completa estos pasos a tu ritmo. Ya puedes usar el resto de la app. | **PROPOSED** — UX-4B |
| `dashboard.onboarding.progress` | {completed} of {total} complete | {completed} de {total} completados | **PROPOSED** — UX-4B |
| `dashboard.onboarding.profile` | Add your profile basics | Agrega los datos básicos de tu perfil | **PROPOSED** — UX-4B |
| `dashboard.onboarding.goal` | Choose your goal | Elige tu objetivo | **PROPOSED** — UX-4B |
| `dashboard.onboarding.weight` | Record your first weight | Registra tu primer peso | **PROPOSED** — UX-4B |

`{completed}` and `{total}` are value placeholders. UX-4B must resolve them
with the repository's existing manual-replacement/local-formatter pattern; this
copy contract does not authorize a localization API change.

The checklist adds no “welcome”, “skip”, “dismiss” or completion-celebration
copy. ADR-P027 leaves persistence/dismissal semantics undecided, and UX-3C does
not decide behaviour through strings. The progress sentence supplies
non-visual intent only; its actual AT output remains a UX-4C gate.

---

# Direct Food Log dashboard shortcut — proposed copy

| Key | EN | ES | Status |
|---|---|---|---|
| `dashboard.foodLog` | Log food | Registrar alimentos | **PROPOSED** — UX-4A |
| `dashboard.foodLogAccessibility` | Open today's food log | Abrir el registro de alimentos de hoy | **PROPOSED** — UX-4A |

The shortcut is additive and routes directly to `/food-log`. It does not rename
Nutrition or remove the targets → plan → log path.

---

# Proposed-key handoff

The **33** proposed keys in this document form the complete UX-3C runtime
handoff. They belong to their existing owners rather than one broad migration:

| Owner | Keys | Purpose |
|---|---:|---|
| BUG-010 | 1 | Shared bilingual loading label |
| BUG-009 | 2 | Progress-card Error distinct from Empty |
| BUG-007 | 5 | Food Log Conflict distinct from catalog incompatibility |
| BUG-008 | 6 | Food Log add/edit/remove failures distinct from load failure |
| BUG-011 | 10 | Pending/Conflict row reporting across Workout, Preferences and Progress |
| UX-4B | 7 | Advisory first-run checklist |
| UX-4A | 2 | Direct Food Log dashboard shortcut |

Every implementation slice must add EN and ES entries together, preserve exact
key parity, add component/regression coverage, and keep raw technical messages
out of presentation. No owning slice may import all 33 keys merely because they
share this document.

---

# Deferred copy

| Area | Why no copy appears here |
|---|---|
| Password recovery | TARGET in PR #102, not on `main`; reconcile after merge against the effective implementation. |
| Email verification | ADR-P026 Vertical 2 is not authorized. |
| Conflict resolution actions/screens | BUG-012 needs a separately authorized flow and repository decision. |
| Trend-chart and weekly structure | Specified in `.ai/20_PROGRESS_NONVISUAL.md` (UX-3D). Its seven proposed keys are worded above; composition, accessibility structure and the no-nesting rule are not repeated here. |
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
