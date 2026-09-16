# Light / Dark Per-Surface Visual Verification

Version: 1.0
Status: Active — **partial**; see §What is still unverified
Last Updated: 2026-09-16

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

# What is still unverified

Gate 6 is **not** discharged by this document. These were not reachable without
seeding data or a second device, and none has been visually verified in either
theme:

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

---

# Related documents

- `docs/RELEASE_READINESS.md` — Stage 2 gate 6
- `.ai/12_DECISIONS.md` — ADR-P022 and Addendum A
- `mobile/src/shared/theme/contrast.spec.ts` — the computed palette gate
- `mobile/src/shared/theme/colors.ts` — the token values measured above
