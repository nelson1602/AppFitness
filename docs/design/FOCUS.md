# FOCUS — v10 (read this first, nothing else)

**Rule:** read only this file, the prototype line ranges in the "Prototype map" of the previous FOCUS, and the files you change. Work one block at a time. A block is finished only when its PR is merged with green CI and device screenshots. Never leave a block half done: if a block can't be finished, stop and report before starting anything else.

**Product principle (applies to every item):** AppFitnessRD recalculates in real time. Every action the user records (a set, a workout, an extra activity, a meal, a weigh-in, water, an evaluation change) must update every affected screen at once and feed the iCoach.
- The iCoach stays deterministic (ADR-P040): explicit rules, documented and tested. No AI deciding the plan.

---

## Block A — real time, sync and plan dates (first)
1. **Sync is stuck.** "Sincronizar" keeps loading and the owner's changes never reach the server (release build against the production API). Find the cause from device logs and the server response, fix it, and prove it with the server rows. Nothing else in this block counts until sync works.
2. **The plan starts on the sign-up date.**
   - The first week starts on the day the account was created.
   - Days before sign-up never appear as missed or pending, and never count in adherence or "Semanas anteriores".
   - Also fix existing accounts.
3. **Logging past days.** In Entrenamientos the user can open any earlier day of the current week (for example Monday) and mark its sets or session as done, with the true date. Adherence and "Semanas anteriores" update.
4. **"Lo comí"** updates the check, the calorie ring and the macro bars immediately (optimistic local write), without waiting for sync.
5. **Extra and custom workouts.**
   - A logged workout (for example "Correr 15 min" or "Levantamiento de pesas") shows in the Entrenamientos tab for that day, as "Actividad extra", with time, kcal and status.
   - It counts toward the week's progress.
   - A custom routine the user names is saved as a reusable routine.
6. **Real-time recalculation rules** (deterministic, added to ADR-P040, with tests):
   - Extra cardio adds its estimated kcal to the day's budget (shown as "+N kcal por actividad"), capped at a safe maximum.
   - Extra strength work on a muscle group: the next planned session that loads the same group within 48 h is lightened or swapped, with the iCoach explaining why.
   - A completed or skipped planned session updates the remaining week. A skipped key session can move to a free day, without going over the training days the user chose.
   - Weigh-ins and evaluation changes recompute the targets for the rest of the week, using the existing "¿Actualizar tu plan?" flow when the plan itself changes.
   - The iCoach card on Inicio shows the latest change in one sentence.

## Block B — food search and preferences
7. **Search beyond the local list.** When a food isn't in the catalogue, the server searches USDA FoodData Central (API key kept on the server only) and Open Food Facts. It returns Spanish-friendly results, and the chosen food is saved into the shared catalogue (the self-growing food base).
   - Offline: show only local results, with a clear message.
   - If nothing is found: let the user create a custom food (name, portion, kcal, protein, carbs, fat).
   - Example that must work: "Chicharrón de cerdo".
8. **Preferencias alimentarias, exclusion picker.**
   - Selecting a search result must add it to the excluded list as a chip in Spanish, with an X to remove it. Today the list just closes.
   - Remove the "Seleccionado: Soy milk, unsweetened" line.
   - Show Spanish food names whenever we have them.

## Block C — UX fixes
9. **Units.** Perfil → "Unidades": kg/cm or lb/ft-in. It applies to every input and display (evaluation, weight, measurements, charts, Progreso). Values are stored in metric. ES/EN.
10. **Rename "Alto en purinas" to "Ácido úrico alto"** (es.ts `evaluation.food.item.high_purine`); EN "High uric acid". Check that no other screen still uses "purinas".
11. **Animated figure for every exercise.**
    - List every library exercise without a figure, then add correct MOTIONS keyframes in the prototype's style.
    - Never show a motion that doesn't match the exercise.
    - Report the before/after count.
12. **Delete account.** Move it from the main Perfil list to Perfil → Cuenta y ajustes → "Privacidad y datos" → "Eliminar cuenta".
    - Before confirming, show a short retention step: what they'll lose, plus "Prefiero quedarme".
    - It must stay reachable inside the app. Google Play requires in-app deletion.
    - Keep the web deletion link working.
13. **Light mode.** Strengthen the blue glow and gradient so they read clearly on the light background, using the dark design's proportions. Show dark and light screenshots.

## Block D — water and heart rate (Android first, Apple later)
14. **Water.**
    - Manual logging: quick buttons for 250 and 500 ml plus a custom amount.
    - Daily goal of 35 ml per kg, raised on training days.
    - A card on Inicio and a history in Progreso.
15. **Health Connect (Android).**
    - Read Hydration, HeartRate, RestingHeartRate and ExerciseSession through a `HealthDataSource` interface, so Apple HealthKit can plug in later.
    - Permissions are asked only when the user taps "Conectar reloj" in Perfil; everything works without them.
    - The deterministic iCoach rule: if resting heart rate is 7 or more bpm above the user's 14-day baseline for 2 days in a row, the next session is lighter, with an explanation. It's not medical advice.
    - Replace the "Próximamente" card with the real connection.
16. **Compliance (report and prepare; the owner and the lawyer decide):**
    - Heart rate is health data. Draft the privacy-policy addition (ES/EN) and the Data Safety changes.
    - List the Play Console Health Connect permission declaration steps.
    - Do not ship Block D to any track until the owner confirms the policy is updated.

---

## Already approved — do not touch
The design (dark-first, the prototype tabs), swipe between tabs, the Dominican plan, País, the birth-date wheel, language switching, sync diagnostics, and biometrics (PR #233, which comes after Block C).

## Screenshots
- Device: release or internal build where possible.
- Spanish only (English where text changed).
- Save to `dist/v10-review/block-X/`.

---

## Prototype map (carried over from the v8.1 FOCUS, referenced by the rule above) (line numbers in the synced copy)
| What | Lines |
|---|---|
| Colors: HERO_BG, BTN_BG | 180–191 |
| Panel / Bar / Chip styles | 585–612 |
| Animated figure: MOTIONS, motionFor, ExerciseDemo | 894–990 |
| Dashboard background and header | 1217–1233 |
| Inicio tab | 1235–1326 |
| Entrenamientos tab | 1327–1389 |
| Nutrición tab | 1390–1462 |
| Progreso tab | 1463–1514 |
| Perfil tab | 1515–1565 |
