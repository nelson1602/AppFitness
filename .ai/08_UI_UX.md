# AppFitness Design System Specification

Version: 1.4
Status: Active
Last Updated: 2026-08-24

---

# Purpose

This document defines the official Design System for AppFitness.

Its purpose is to ensure visual consistency, usability, accessibility, scalability, and maintainability across every screen, component, and interaction.

Every UI implementation must comply with this specification.

---

# Revision Scope (v1.2 — UX-1B1)

This revision records the **visual foundation** approved by **ADR-P022**
(`Confident Clarity`). It is documentation-only.

Included in v1.2:

- Visual direction, identity, and product personality
- Semantic colour-role usage and the energy-accent allowed/forbidden matrix
- Light/dark surface hierarchy and elevation behaviour
- Text and icon contrast requirements (WCAG 2.2 AA) with a reproducible audit
- Typography hierarchy, Inter delivery target, tabular figures for metrics
- Spanish/English length and reflow safety
- Spacing, radius, content measure, and density principles
- Motion semantics and reduced-motion requirements
- Icon visual rules (Material Symbols vocabulary; cross-platform React Native
  delivery mechanism unresolved and separately gated)
- Imagery policy
- Accessibility verification expectations

**Deferred to UX-1B2** (do not add here): component anatomy, variants, props, and
per-component contracts. UX-1B2 was subsequently split into three documentation
slices — **UX-1B2A** (canonical state patterns and the six state-component
contracts), **UX-1B2B** (form/input contracts: `AppTextInput`, `FormField`,
`FormSelect`), and **UX-1B2C** (reconciliation of the existing primitives
`Screen`, `Card`, `AppText`, `AppButton`, `Banner`). The existing component and
state sections below remain the **standing v1.1 requirements** until the slice
that owns each one replaces it.

## Evidence labels used in this document

Every statement about values or behaviour carries one of three labels. They are
not interchangeable.

| Label | Meaning |
|---|---|
| **SHIPPED** | Verified present in the `origin/main` Git tree, quoted from `mobile/src/`. v1.2 evidence was taken at `9dbe22588326530ee88ba575a86e1b5f99ad4504`; v1.3 evidence at `2692e5896af6b099e2f7cce6c934407d504340ef`. |
| **TARGET** | Approved behaviour that code must eventually satisfy. **Not implemented.** |
| **PROPOSED** | A candidate value or approach that is **not approved and not in code**. Requires its own decision before use. |

Nothing labelled TARGET or PROPOSED exists in the mobile application today.
Inter, icons, motion adoption, surface-tint elevation, navigation, and shared
components are **all** unimplemented as of this revision.

---

# Revision Scope (v1.3 — UX-1B2A)

This revision records the **canonical state patterns** and the **six state-component
contracts** that follow from them. It is documentation-only, authorized by
**ADR-P022** Decision 15 (the UX-1B2 rung); it introduces no new decision and
needs no new ADR.

Included in v1.3:

- §Canonical State Patterns — exactly **eight** evidenced states with cause,
  data trustworthiness, user action, recovery path, semantic tone, confusion
  boundaries, and native/Web applicability
- §State Component Contracts (UX-1B2A) — exactly **six** contracts: `StateView`,
  `LoadingState`, `EmptyState`, `ErrorState`, `WebUnavailableNotice`,
  `SyncStatusHint`
- Reconciliation notes for the shipped `SyncStatusBanner` and the two shipped
  data-gap components (documented, not redesigned)
- The evidence-backed link between the recorded light-theme contrast failures and
  today's state UI (§Contrast Requirements)

**Not** in v1.3, and explicitly deferred:

- Form and input contracts — `AppTextInput`, `FormField`, `FormSelect`
  (**UX-1B2B**)
- Contracts for the existing primitives `Screen`, `Card`, `AppText`, `AppButton`,
  and `Banner` — including `Banner`'s own complete contract (**UX-1B2C**)
- Any success-confirmation or permission-denied component. Both are named in
  §Canonical State Patterns only as **future flow needs with insufficient current
  evidence**; no API, anatomy, or placeholder contract is defined for either.
- Every runtime concern: no component implementation, no token value change, no
  localization key change, no dependency, asset, font, or icon package.

**Evidence baseline for v1.3.** Every SHIPPED count in the new sections was
reproduced from `origin/main` at `2692e589` with read-only `git grep` /
`git show` / `git ls-tree`.

---

# Revision Scope (v1.4 — UX-1B2B)

This revision records the **form and input contracts**. It is documentation-only,
authorized by **ADR-P022** Decision 15 (the UX-1B2 rung); it introduces no new
decision and needs no new ADR — the UX-1B2B scoping audit found no architectural
contradiction.

Included in v1.4:

- §Form and Input Contracts (UX-1B2B) — exactly **three** contracts:
  `AppTextInput`, `FormField`, `FormSelect`
- The shipped-evidence snapshot those contracts are frozen against
- The minimum implementable **non-colour redundancy** behaviour for input, field,
  and chip states
- The **validation-copy boundary** — what is SHIPPED versus TARGET for localized
  error copy, stated without overclaiming
- The FULL / REDUCED input style-family reconciliation, with migration assigned
  to UX-5
- The input-related frozen-hook register
- Two **usage-level** contrast findings, recorded separately from the original
  owner-gated token set (§Contrast Requirements)

**Not** in v1.4, and explicitly deferred:

- Contracts for the existing primitives `Screen`, `Card`, `AppText`, `AppButton`,
  and `Banner` (**UX-1B2C**)
- Any change to the six UX-1B2A state contracts, which remain as published in
  v1.3
- Every runtime concern: no component implementation, no input migration, no
  token value change, no localization key change, no dependency, asset, font, or
  icon package

**Evidence baseline for v1.4.** Every SHIPPED count and ratio in the new sections
was reproduced with read-only `git grep` / `git show` / `git ls-tree` against tree
`a4339be12215da705775a69fbdf81c6f5788a327` — the tree of merge commit
`6316f7826ea9fe9825ad5b484f5283fa38ddd1a1`.

---

# Design Philosophy

The design language follows five principles:

- Simplicity
- Consistency
- Accessibility
- Clarity
- Performance

Every interface should reduce cognitive load.

---

# Design Goals

The application should feel:

Professional

Modern

Fitness-focused

Friendly

Trustworthy

Fast

Native

Minimal

Data-driven

Energetic

Bilingual

Accessible

---

# Visual Direction — Confident Clarity

Approved by **ADR-P022**. `Confident Clarity` **extends** ADR-0010's Material
Design 3 foundation; it does not supersede it. The direction is expressed by
assigning meaning to MD3 semantic roles that already exist in the shipped theme,
never by replacing the role model or introducing raw colours.

## Identity

A restrained, data-trusting foundation with a **strictly bounded energy accent**.
The interface stays quiet so that the user's own numbers carry the colour and the
attention. Energy appears rarely, and only where it means something.

## Product personality

The product must feel: **modern, trustworthy, energetic, bilingual, accessible,
fitness-focused, data-driven.**

## What it must never be

The product must **not** look clinical, medical, sterile, or diagnostically
authoritative. Specifically forbidden:

- Chart-review or clinical-record aesthetics
- Diagnostic framing, risk scores, or severity gradings
- Any treatment implying medical authority, clearance, or supervision
- Sterility: an all-neutral screen with no point of energy anywhere

This restates ADR-P017's public-v1 wellness scope as a visual rule. Copy follows
the same posture (see §iCoach UI).

## Where trust comes from

Trust is earned by **explainability, typographic precision, and honest states** —
never by borrowing a clinical look. Every metric should be able to answer "why
this number", and every unavailable capability must say so plainly.

## Where distinctiveness comes from

V1 ships **no photographic or per-exercise illustration pipeline** (ADR-P022
Decision 12). Distinctiveness must therefore be carried by:

1. Typographic and numeric craft (hierarchy, tabular figures, hero metrics)
2. One recognisable data-visualization signature
3. The disciplined, rare use of the energy accent

Widening the accent, or adding imagery, is **not** an acceptable substitute for
craft in these three areas.

---

# Inspiration

The visual language is inspired by:

Material Design 3

Apple Human Interface Guidelines

Google Fit

Whoop

Garmin Connect

Notion

Linear

The design should avoid unnecessary visual complexity.

**Guardrails on the references above.** Draw on their restraint and data
seriousness, not their failure modes. Two are widely criticised for
data-density without hierarchy and for burying information behind many taps;
AppFitness must not reproduce that. Reference material informs foundations only —
it never justifies a clinical or spreadsheet-like presentation.

---

# Design Tokens

Every visual property must originate from design tokens.

Never hardcode:

Colors

Spacing

Typography

Border Radius

Elevation

Animation Duration

Opacity

---

# Color System

Semantic colors only.

Primary

Secondary

Tertiary

Background

Surface

Surface Variant

Primary Container

Success

Warning

Error

Info

Disabled

Outline

Divider

Accent

Never reference raw hex colors inside components.

## Semantic role usage

Each role has exactly one meaning. Choosing a role by appearance rather than by
meaning is a defect.

| Role | Meaning | Notes |
|---|---|---|
| `primary` / `onPrimary` | The single most important action on a surface | **The canonical pair for a filled primary CTA — background `primary`, label `onPrimary`.** One primary action per surface; everything else is secondary or text. `accent` never replaces this pair |
| `primaryContainer` / `onPrimaryContainer` | Quiet primary-tinted container | **SHIPPED but unused** — zero consumers in code |
| `secondary` / `onSecondary` | Supporting, non-competing actions and metadata | **SHIPPED but unused** — zero consumers in code |
| `tertiary` / `onTertiary` | Third-level differentiation | **SHIPPED but unused** — zero consumers in code |
| `background` / `onBackground` | The screen ground behind all surfaces | |
| `surface` / `onSurface` | Default content surface (cards, sheets) | |
| `surfaceVariant` / `onSurfaceVariant` | Recessed surface; muted/secondary text | Current home of input fills and muted copy |
| `success` / `onSuccess` | **Operation confirmed** — saved, synced, completed | Not achievement; see accent |
| `warning` / `onWarning` | Caution requiring attention, non-blocking | Accent forbidden here |
| `error` / `onError` | Failure or destructive consequence | Accent forbidden here |
| `info` / `onInfo` | Neutral informational state | Includes the "unavailable on Web" state |
| `disabled` / `onDisabled` | Inactive control | |
| `outline` | Meaningful boundary of an interactive element | Input borders, focus boundaries |
| `divider` | Purely decorative separation | Never the sole indicator of anything |
| `accent` | **The energy accent** — see the matrix below | Strictly bounded. **There is no shipped `onAccent` role**, so `accent` has no approved foreground pairing and cannot serve as a filled background for text |

**TARGET:** the energy accent of `Confident Clarity` is carried by the `accent`
role. No new colour role is introduced. `secondary`, `tertiary`, and
`primaryContainer` remain available for future differentiation and must not be
repurposed as a second accent.

**No `onAccent` token is introduced or approved by this revision.** The shipped
`ColorTokens` interface has 27 roles and `accent` is the only one without a
matching `on*` foreground. Any future foreground pairing for `accent` is a
separate token decision with its own contrast audit.

## Energy accent — allowed / forbidden matrix

Per **ADR-P022** Decisions 5 and 6. The accent is bounded by **meaning**, not by
component type.

| Context | Accent | Rule |
|---|---|---|
| Achievement (streak, personal record, goal reached) | **ALLOWED** | The moment of earned recognition |
| Positive progress delta (a metric moving the desired direction) | **ALLOWED** | Direction must also be stated in text or shape, never colour alone |
| The primary action on a surface | **ALLOWED as subordinate emphasis only — currently BLOCKED** | The CTA itself stays `primary` / `onPrimary`. Accent may add a non-exclusive emphasis signal alongside it, never become its background or its label. See §Accent and the primary action |
| Selected navigation | **ALLOWED** | Requires non-colour redundancy — see below |
| Neutral information | **FORBIDDEN** | Use `onSurfaceVariant` / `info` |
| Ordinary containers, cards, list rows, section headers | **FORBIDDEN** | Use `surface` / `surfaceVariant` |
| Warnings | **FORBIDDEN** | Use `warning` |
| Errors and destructive actions | **FORBIDDEN** | Use `error` |
| Operation confirmation (saved / synced) | **FORBIDDEN** | Use `success` — confirmation is not achievement |
| Pending-sync, offline, unavailable-on-Web states | **FORBIDDEN** | Use `info` / `onSurfaceVariant` |
| Charts and trend bars as a default series colour | **FORBIDDEN** | Accent may mark only an achievement or positive-delta datum, not the whole series |
| Decoration of any kind | **FORBIDDEN** | The accent is a signal, never styling |

**Collision rule.** Where the accent would land on the same element as a semantic
state, the **semantic state wins**. An errored primary action is `error`, not
accent.

**Frequency rule.** If more than one accent-coloured element is visible at rest on
a screen (excluding a selected navigation item), the screen is over-accented and
must be reviewed.

## Accent and the primary action

The owner-approved rule that the accent may emphasize the primary action stands,
but it is **subordinate and non-exclusive**, not a substitution. Without this
clarification, two roles would both claim the filled CTA and implementations
would diverge.

**Rules.**

1. **`primary` / `onPrimary` is the canonical semantic pair for a filled primary
   CTA** — `primary` as background, `onPrimary` as label. This is the only
   approved pairing for that component.
2. **`accent` never replaces `primary` / `onPrimary`.** Not the background, not
   the label, not the border, not the pressed state.
3. **`accent` must never become the CTA label colour or the filled CTA
   background merely because the action is primary.** "Primary" is a role
   assignment, not an accent trigger.
4. Any accent emphasis on a primary action is an **additional, subordinate
   signal** — and only with an explicitly approved, contrast-safe
   foreground/background pairing.
5. **The primary action must remain fully recognizable without any accent.**
   Remove the accent and the CTA must still read as the primary action, by role
   colour, prominence, position, and label.
6. **There is no shipped `onAccent` role**, so no approved foreground exists for
   an accent-filled surface. This revision neither introduces nor approves one.

**Status: BLOCKED in both themes.** Accent emphasis on primary actions is blocked
until *both* (a) the light-theme `accent` value is approved (it currently measures
2.998:1 on `surface`, failing even the 3:1 non-text threshold) and (b) an
accessible foreground/background pairing for accent is approved. The block applies
to **both** themes deliberately — even though the shipped dark `accent #4DD0D0`
measures 9.17:1 on `surface` — so that the same semantic rule holds in light and
dark and the two themes cannot drift apart. Achievements, positive progress
deltas, and selected navigation are unaffected by this particular block; they are
separately constrained by the light-theme accent value.

## Non-colour redundancy (mandatory)

Per **ADR-P022** Decision 7, `selected`, `success`, `warning`, and `error` must
**never** be conveyed by colour alone. Each requires at least one non-colour
signal from: shape, weight, border, position, icon fill, or text.

| State | Colour | Required non-colour signal (at least one) |
|---|---|---|
| Selected navigation | `accent` | Filled icon **and** heavier label weight |
| Selected option / chip | `primary` | Border change **and** `accessibilityState.selected` |
| Success | `success` | Confirming text; icon where one exists |
| Warning | `warning` | Explanatory text; icon where one exists |
| Error | `error` | Error text adjacent to the field or action it concerns |

This makes the standing anti-pattern "Depend on color alone" verifiable rather
than advisory.

## Shipped palette (SHIPPED)

Verified from `mobile/src/shared/theme/colors.ts` at `origin/main`
`9dbe2258`. 27 roles per theme (54 declared values in total).

Light: `primary #208AEF` · `onPrimary #FFFFFF` · `primaryContainer #D6E9FC` ·
`onPrimaryContainer #0A3D6B` · `secondary #4F6070` · `onSecondary #FFFFFF` ·
`tertiary #5E5A7D` · `onTertiary #FFFFFF` · `background #F8FAFC` ·
`onBackground #191C1F` · `surface #FFFFFF` · `onSurface #191C1F` ·
`surfaceVariant #EEF1F5` · `onSurfaceVariant #44474C` · `success #1B873F` ·
`onSuccess #FFFFFF` · `warning #B26A00` · `onWarning #FFFFFF` ·
`error #BA1A1A` · `onError #FFFFFF` · `info #0B6BCB` · `onInfo #FFFFFF` ·
`disabled #C4C7CC` · `onDisabled #75787D` · `outline #74777D` ·
`divider #E1E4E9` · `accent #00A6A6`

Dark: `primary #8FC5F7` · `onPrimary #06345C` · `primaryContainer #0F4C82` ·
`onPrimaryContainer #D6E9FC` · `secondary #B7C7D8` · `onSecondary #22323F` ·
`tertiary #C7C2E9` · `onTertiary #302C4C` · `background #101416` ·
`onBackground #E1E3E6` · `surface #191C1F` · `onSurface #E1E3E6` ·
`surfaceVariant #24282C` · `onSurfaceVariant #C4C7CC` · `success #6FD48E` ·
`onSuccess #003916` · `warning #FFB95C` · `onWarning #4A2800` ·
`error #FFB4AB` · `onError #690005` · `info #8FC5F7` · `onInfo #06345C` ·
`disabled #3A3E43` · `onDisabled #8A8D92` · `outline #8E9195` ·
`divider #2C3034` · `accent #4DD0D0`

---

# Contrast Requirements (WCAG 2.2 AA)

## Thresholds

| Content | Minimum ratio | Criterion |
|---|---|---|
| Normal-size text | 4.5 : 1 | 1.4.3 |
| Large text (≥ 18pt regular, or ≥ 14pt bold) | 3 : 1 | 1.4.3 |
| Icons and meaningful UI boundaries | 3 : 1 | 1.4.11 |
| Purely decorative graphics, and inactive/disabled controls | exempt | 1.4.3 / 1.4.11 exceptions |

**Large-text mapping against the SHIPPED type scale.** `display` (45px/400),
`headline` (28px/600), and `title` (20px/600) qualify as large text. `body`
(16px/400), `label` (14px/500), and `caption` (12px/400) **do not** — 14px at
weight 500 is not "14pt bold". Any tone applied at `body`, `label`, or `caption`
must therefore reach 4.5:1.

## Audit method (reproducible)

Relative luminance per WCAG 2.x: for each 8-bit channel `c`, `s = c / 255`;
`lin = s / 12.92` when `s <= 0.04045`, otherwise `lin = ((s + 0.055) / 1.055) ^
2.4`; `L = 0.2126·R + 0.7152·G + 0.0722·B`. Ratio =
`(max(L1, L2) + 0.05) / (min(L1, L2) + 0.05)`. Inputs are the SHIPPED hex values
above. Recomputing these numbers requires no repository access beyond
`git show origin/main:mobile/src/shared/theme/colors.ts`.

`0.04045` is the current sRGB linearization breakpoint and is the value used
throughout this document. **Every ratio below was recomputed with `0.04045`, and
every result is unchanged** — for 8-bit inputs the breakpoint falls between
channel values 10 and 11 either way, so no pair changes branch. Ratios are quoted
to two decimal places (`accent` on `surface` to three, because it sits on the
3:1 boundary).

## Audit result — SHIPPED palette

**Dark theme: passes.** Every text and UI pair listed below meets its threshold
(lowest measured text pair: `onPrimary #06345C` on `primary #8FC5F7` = 6.95:1;
`primary`, `success`, `warning`, `error`, `info`, and `accent` on
`surface #191C1F` all measure 9.1–10.1:1; `outline #8E9195` on
`surfaceVariant #24282C` = 4.69:1 against a 3:1 requirement).

**Light theme: five failing pairs across four semantic roles — `primary`,
`onPrimary`, `warning`, and `accent`.** The five pairs, in the order they appear
in the table below:

1. `warning` on `surface`
2. `primary` on `surface`
3. `onPrimary` on `primary`
4. `primary` on `surfaceVariant`
5. `accent` on `surface`

Four roles, five pairs — `primary` fails against two different backgrounds.

| Pair (light) | Ratio | Verdict |
|---|---|---|
| `onSurface #191C1F` on `surface #FFFFFF` | 17.11 : 1 | PASS |
| `onSurfaceVariant #44474C` on `surface #FFFFFF` | 9.33 : 1 | PASS |
| `onSurfaceVariant #44474C` on `surfaceVariant #EEF1F5` | 8.23 : 1 | PASS |
| `onBackground #191C1F` on `background #F8FAFC` | 16.35 : 1 | PASS |
| `error #BA1A1A` on `surface #FFFFFF` | 6.46 : 1 | PASS |
| `secondary #4F6070` on `surface #FFFFFF` | 6.48 : 1 | PASS |
| `tertiary #5E5A7D` on `surface #FFFFFF` | 6.49 : 1 | PASS |
| `info #0B6BCB` on `surface #FFFFFF` | 5.28 : 1 | PASS |
| `onPrimaryContainer #0A3D6B` on `primaryContainer #D6E9FC` | 8.94 : 1 | PASS |
| `outline #74777D` on `surfaceVariant #EEF1F5` | 3.96 : 1 | PASS (3:1) |
| `success #1B873F` on `surface #FFFFFF` | 4.58 : 1 | PASS (narrow margin) |
| `warning #B26A00` on `surface #FFFFFF` | 4.24 : 1 | **FAIL** at 4.5; passes large-text 3:1 |
| `primary #208AEF` on `surface #FFFFFF` | 3.53 : 1 | **FAIL** at 4.5; passes large-text 3:1 |
| `onPrimary #FFFFFF` on `primary #208AEF` | 3.53 : 1 | **FAIL** at 4.5; passes large-text 3:1 |
| `primary #208AEF` on `surfaceVariant #EEF1F5` | 3.12 : 1 | **FAIL** at 4.5; passes large-text 3:1 |
| `accent #00A6A6` on `surface #FFFFFF` | 2.998 : 1 | **FAIL** at 4.5 **and** below the 3:1 non-text threshold |
| `onDisabled #75787D` on `disabled #C4C7CC` | 2.61 : 1 | Exempt (inactive control) but poor |
| `divider #E1E4E9` on `surface #FFFFFF` | 1.27 : 1 | Exempt (decorative separator only) |

## Consequences of the light-theme failures (honest statement)

- Any text using the `primary` tone at `body`, `label`, or `caption` size fails
  AA in the light theme.
- A filled primary action fails AA in the light theme when its label is
  `label`-sized: `onPrimary` on `primary` measures 3.53:1. The fix is a
  `primary` value change — **not** substituting `accent`, which is never a valid
  CTA background or label (§Accent and the primary action).
- The `accent` role **cannot** be used in the light theme at any size, for text
  or for a meaningful graphical mark, without a value change. `Confident
  Clarity`'s energy accent is therefore **blocked in the light theme** for
  achievements, positive progress deltas, and selected navigation until a
  token-value decision is taken.
- Accent emphasis on primary actions is **blocked in both themes** — it needs the
  light-theme value *and* an approved, contrast-safe foreground/background
  pairing, and no `onAccent` role exists. See §Accent and the primary action.
- `success` passes with a narrow margin and must not be lightened.
- `divider` is exempt only while it remains decorative. If a divider ever becomes
  the sole boundary of an interactive element, it must meet 3:1 or an `outline`
  must be used instead.

## Impact on the canonical state UI (UX-1B2A)

The five failing pairs recorded above are not abstract — four of them land
directly on the state surfaces specified in §State Component Contracts (UX-1B2A).
This subsection adds only that evidence-backed connection; it approves no value
and changes no token.

| Failing pair (light) | Where it lands in today's state UI | Consequence |
|---|---|---|
| `primary` on `surfaceVariant` (3.12:1) | The shipped `Banner` renders an **info**-tone title in the `primary` tone at `label` size on a recessed ground. **18 of the 55 shipped banner usages are info-tone**, and that includes the Web-unavailable notice on **all 12** surfaces. | `WebUnavailableNotice`'s own title is a failing pair in the light theme today. Recorded, not worked around. |
| `onPrimary` on `primary` (3.53:1) | Any filled primary action at `label` size. | Blocks AA completion of `EmptyState`'s creation action and `ErrorState`'s retry. |
| `primary` on `surface` (3.53:1) | A text-style action or `primary`-toned link at `body`/`label`/`caption` size. | There is **no in-palette escape**: a text-style retry fails too, so the block cannot be avoided by changing button variant. |
| `warning` on `surface` (4.24:1) | `SyncStatusHint`'s **conflict** variant and the offline banner. | Conflict and offline are definable but cannot be claimed accessible in the light theme. |
| `accent` on `surface` (2.998:1) | **Nowhere in these contracts.** None of the eight states is an achievement, positive delta, primary action, or selected navigation, so no UX-1B2A contract uses the accent. | The accent failure and the accent block do **not** gate UX-1B2A. |

What is **not** blocked: the `error` role passes AA in both themes (6.46:1 light),
so the **copy-only** `ErrorState` is unblocked; `LoadingState` and `StateView` use
only passing roles; `EmptyState`'s and `WebUnavailableNotice`'s **body** copy uses
passing roles. The dark theme passes throughout.

The consequence for sequencing: **UX-1C may implement the copy-only forms, but no
action-bearing state form can be declared AA-complete in the light theme until the
owner-gated token-value decision lands.** No contract in this document claims
otherwise.

## Usage-level contrast findings (UX-1B2B)

These are **distinct from the five failing pairs above** and must never be folded
into that count. The five are the **original owner-gated token set**: five
light-theme pairs across four foreground roles, awaiting a token-value decision.
The findings here are **usage errors** — a component pairing roles incorrectly, or
using a role outside its intended purpose. They are corrected by changing the
*pairing*, not the token values.

Running total, stated precisely:

- **Original owner-gated token set:** five light-theme pairs across four
  foreground roles (unchanged, still unresolved, no candidate approved).
- **Additional usage findings:** **three** failing role/background pairings — two
  light-theme placeholder pairings and one dark-theme selected-chip pairing.

**No code is fixed in this documentation slice.**

### Finding 1 — selected-chip foreground misuse (dark theme)

Four shipped choice surfaces fill with the `primary` role but render their label
through the default text tone, which resolves to **`onSurface`**, not
`onPrimary`. Measured:

| Pairing | Light | Dark |
|---|---|---|
| `onSurface` on `primary` (as shipped) | **4.84:1 — passes** | **1.42:1 — fails** |
| `onPrimary` on `primary` (the canonical pair) | 3.53:1 — fails (already in the original five) | 6.95:1 — passes |

The affected surfaces are the shared `FormSelect` plus three feature choice rows;
the language selector and `AppButton` already pair `primary` with `onPrimary`
correctly, which is why the correct pairing is not in doubt.

This is a **semantic role-pairing defect, not a new token-value defect** — the
selected-chip direction remains `primary`, and `primary`/`onPrimary` is already
the recorded canonical filled pair (ADR-P022 Decision 5a). But correcting the
dark misuse moves the light theme onto `onPrimary` over `primary`, which is
**already one of the original five failures at 3.53:1**.

**Consequence:** the selected `FormSelect` state **cannot be declared AA-complete
in both themes** until the existing owner-gated `primary`/`onPrimary` decision is
resolved. This revision does **not** choose `primaryContainer`, another fill, or a
new token — that would be a token decision, which is out of scope here.

### Finding 2 — placeholder role misuse (light theme)

Placeholder text rendered through the `outline` role fails AA **as text** in the
light theme:

| Pairing | Measured | Threshold | Verdict |
|---|---|---|---|
| `outline` placeholder on `surfaceVariant` | 3.96:1 | 4.5:1 | **fails** |
| `outline` placeholder on `surface` | 4.49:1 | 4.5:1 | **fails** — WCAG ratios are not rounded upward |
| `onSurfaceVariant` placeholder on `surfaceVariant` | 8.23:1 | 4.5:1 | passes |

`outline` remains **valid for non-text borders** at the 3:1 threshold — the
failure is specific to using it as *text*. **`onSurfaceVariant` is the canonical
placeholder-text role**, and the `AppTextInput` contract requires it. Six of the
eight shipped placeholder sites use `outline`; two already use
`onSurfaceVariant`.

This is a **usage correction, not a token-value change**. Both findings are
tracked in **FEATURE-010**.

## Candidate remedies — PROPOSED, not approved, not in code

These are worked candidates only. **None is approved, and none exists in
`mobile/src`.** Selecting values requires its own decision (see §Change Control
and Slice Boundaries).

| Role (light) | Candidate | Measured on `#FFFFFF` |
|---|---|---|
| `primary` | `#0B6BCB` (equals the SHIPPED `info` value) | 5.28 : 1 |
| `primary` | `#0F62B8` | 6.07 : 1 |
| `warning` | `#A05F00` | 5.08 : 1 |
| `warning` | `#8F5500` | 6.06 : 1 |
| `accent` | `#00807F` | 4.78 : 1 |
| `accent` | `#007A79` | 5.17 : 1 |

Any adopted change must be re-audited for the *inverse* pair as well — e.g. a
darker `primary` also raises `onPrimary #FFFFFF` on `primary` to the same ratio,
which is how the filled-button failure is resolved.

## Verification requirement

**TARGET:** every text/background and icon/background pair used by a component
carries a recorded ratio and a pass/fail verdict, in **both** themes, before that
component is considered done. Failures are either fixed or recorded as accepted
exceptions with the exemption cited — never left unstated.

---

# Typography

Font Family

Inter

Scale

Display

Headline

Title

Body

Label

Caption

Numeric values should use tabular figures whenever possible.

## Hierarchy and intent

| Variant | SHIPPED value | Intent | Large text? |
|---|---|---|---|
| `display` | 45 / 52, weight 400 | A single hero metric | Yes |
| `headline` | 28 / 36, weight 600 | Screen title | Yes |
| `title` | 20 / 28, weight 600 | Section or card title | Yes |
| `body` | 16 / 24, weight 400 | Running copy, explanations | No |
| `label` | 14 / 20, weight 500 | Field labels, button labels, chips | No |
| `caption` | 12 / 16, weight 400 | Metadata, units, timestamps | No |

Verified from `mobile/src/shared/theme/typography.ts` at `origin/main`
`9dbe2258`. Values are `fontSize / lineHeight`.

**Rules.** One `headline` per screen. At most one `display` per screen, reserved
for the metric the screen exists to show. Never skip more than one level when
descending a hierarchy. Never express hierarchy with colour alone.

## Inter delivery (TARGET — not implemented)

Inter is the approved target typeface (ADR-P022 Decision 8; `02_TECH_STACK.md`
§Design System). **It is not bundled.** `typography.ts` states in its own header
comment that "Inter is not yet bundled — tokens use the platform default", and
there are **zero** matches for `useFonts` or `expo-font` anywhere in
`mobile/src`. The platform default face is what ships today.

The font-delivery slice is **separately authorized** and must decide, at minimum:
asset source and licence, static versus variable, the weight set (400/500/600 are
the weights the scale actually uses), subsetting, the `useFonts` load and
splash-gate strategy, the fallback stack, and the bundle-size budget. Until it
lands, no document, component, or review may state or imply that AppFitness
renders in Inter.

## Tabular figures for metrics (TARGET — not implemented)

Every numeric value that a user compares across readings — weights,
measurements, volumes, calories, macros, counts, durations — must use tabular
(fixed-width) figures so digits do not shift position between renders. Proportional
figures are acceptable only for numbers embedded in running prose.

**Not implemented:** the shipped `typography.ts` documents this intent but no code
sets it; `fontVariant` appears nowhere in `mobile/src`. The mechanism lands with
the font-delivery slice, since tabular figures depend on the chosen face.

## Dynamic-type safety (TARGET)

- Respect the OS text-size setting. `AppText` already sets `allowFontScaling`
  (SHIPPED); no component may disable it.
- Never truncate meaning to preserve layout. A metric, a label, or an error must
  remain fully readable at large scales, wrapping if needed.
- Containers that hold text must grow with it. Fixed heights on text-bearing
  elements are a defect: today input fields use a fixed `minHeight` derived from
  `spacing.x5l` (48), which is a floor and must not become a ceiling.
- Numbers must not be allowed to overflow their unit or their label.

---

# Bilingual Layout Safety (ES / EN)

Spanish and English are both first-class (`00_PROJECT.md`, `06_MOBILE.md`,
ADR-P017). Bilingual delivery is **SHIPPED**: `resources/en.ts` and
`resources/es.ts` each hold 696 entries with byte-identical sorted key sets, and
public-v1 UI contains no untranslated user-facing copy.

Layout must therefore treat length variance as a design constraint, not an
afterthought.

**Rules.**

- Assume Spanish strings run materially longer than their English source. A
  layout that only fits in English is broken.
- No layout may depend on a specific string length. No single-line assumption for
  labels, buttons, chips, banner titles, or tab labels.
- Buttons and chips wrap or grow; they never clip or ellipsize their label.
- Never build a sentence by concatenating fragments — grammar and word order
  differ. The **SHIPPED** convention is one key per complete phrase, with
  explicit singular/plural key pairs (`…One` / `…Many`); follow it.
- Numbers, dates, and decimal separators go through the shared localization
  formatters, never through string interpolation of raw values.
- Units are localized presentation, never baked into a translated sentence
  fragment.
- Reflow, dynamic type, and Spanish length must be checked **together** — the
  worst case is long Spanish copy at a large text scale on a small screen.

**TARGET:** every screen is reviewed in both languages, at default and at a large
text scale, before it is considered done.

---

# Spacing System

Use an 8-point grid.

Allowed spacing:

4

8

12

16

20

24

32

40

48

56

64

Avoid arbitrary spacing values.

## Shipped scale (SHIPPED)

`xs 4` · `sm 8` · `md 12` · `lg 16` · `xl 20` · `xxl 24` · `x3l 32` ·
`x4l 40` · `x5l 48` · `x6l 56` · `x7l 64` — from
`mobile/src/shared/theme/spacing.ts` at `origin/main` `9dbe2258`.

## Density principles

- **Group by meaning.** Space inside a group is always smaller than space between
  groups. Where these are equal, the grouping is not readable.
- **One rhythm per screen.** Screen padding and inter-section gap are chosen once
  and repeated. The shipped `Screen` primitive already applies `lg` (16) padding
  and an `lg` gap.
- **Breathe around numbers.** Hero metrics get more surrounding space than body
  copy, because whitespace is what makes a number read as important.
- **Density is not compression.** Fitting more on screen by shrinking gaps below
  the scale is forbidden; drop content or paginate instead.
- **Touch spacing.** Adjacent interactive targets keep at least `sm` (8) between
  their 44×44 hit areas so neighbouring taps are not mis-hit.

## Content measure (TARGET — not implemented)

Running text has a maximum comfortable measure; unbounded width harms
readability on tablets, foldables, and Web.

- **TARGET:** running copy is capped at a maximum measure and the content column
  is centred beyond that width; metrics, charts, and list rows may exceed it.
- **Not implemented:** there are **zero** matches for `maxWidth`,
  `useWindowDimensions`, or `Dimensions` in `mobile/src`. The `Screen` primitive
  is a single unbounded column today.
- The concrete measure value and breakpoints are **deferred** — they belong with
  the responsive rules, not this revision. Do not invent a number here.

---

# Corner Radius

Use predefined tokens.

Small

Medium

Large

Extra Large

Full

Never hardcode radius values.

## Shipped scale and usage

`small 4` · `medium 8` · `large 16` · `extraLarge 24` · `full 9999` — from
`mobile/src/shared/theme/radius.ts` at `origin/main` `9dbe2258`.

**TARGET usage mapping** (consistency rule, not new components): controls and
inputs use `medium`; content containers use `large`; full-bleed sheets and modal
surfaces use `extraLarge`; pills, avatars, and circular indicators use `full`;
`small` is reserved for small inline marks such as skeleton blocks and swatches.

Radius carries no state meaning. A change in radius must never be the way a
selected, error, or disabled state is communicated.

---

# Elevation

Elevation should communicate hierarchy.

Levels

0

1

2

3

4

5

Avoid excessive shadows.

## Surface hierarchy — Confident Clarity

Hierarchy is communicated **primarily by surface colour, border, and spacing**,
with shadow used sparingly (ADR-P022 Decision 10). Depth is a quiet signal; a
screen of floating cards is a defect.

**TARGET ordering, light theme:** `background` → `surface` → `surfaceVariant` for
recessed regions, with `divider`/`outline` for boundaries and at most `level1`
shadow on genuinely raised content. Reserve `level2`+ for transient overlays
(sheets, dialogs, menus) only.

## Shipped elevation (SHIPPED)

From `mobile/src/shared/theme/elevation.ts` at `origin/main` `9dbe2258`, each
level is a black shadow plus the Android `elevation` value:

`level0` 0 / opacity 0 · `level1` 1 / 0.08 / blur 2 / y 1 ·
`level2` 2 / 0.10 / 4 / 2 · `level3` 3 / 0.12 / 8 / 4 ·
`level4` 4 / 0.14 / 12 / 6 · `level5` 5 / 0.16 / 16 / 8.

`shadowColor` is `#000000` at every level.

## Dark-mode surface tint (TARGET — not implemented)

A black shadow at 8–16% opacity is effectively invisible against the shipped dark
surfaces `background #101416`, `surface #191C1F`, and `surfaceVariant #24282C`.
The shipped elevation scale therefore conveys **no** hierarchy in dark mode.

**TARGET:** in dark mode, elevation raises a surface by **lightening it**
(surface tint) rather than by casting a shadow. Higher elevation means a lighter
surface; borders carry the remaining separation. Light mode keeps the shadow
scale, used sparingly.

**Not implemented:** no change to `elevation.ts`, and no tint values are proposed
here. Defining the dark elevation ramp is a later, separately authorized
token-value decision.

---

# Icons

Material Symbols

Outlined by default.

Filled only for selected or active states.

Icons should always communicate meaning.

Avoid decorative icons.

## Icon visual contract (ADR-P022 Decision 9)

**The visual icon vocabulary is settled: Material Symbols.** It is named at the
top of this section, it is listed in `02_TECH_STACK.md` §Design System, and
ADR-P022 confirms it as the approved V1 icon family. No alternative visual
vocabulary is under consideration.

**What UX-1B1 does NOT decide: the cross-platform React Native delivery
mechanism.** It remains unresolved and separately gated. **UX-1B1 selects no
package, asset format, dependency, or per-platform mapping.** For the avoidance
of doubt, none of the following is selected, and each carries a constraint the
later slice must weigh (per official Expo and Google documentation):

- **`@expo/vector-icons`** — listed in `02_TECH_STACK.md`, but current official
  Expo documentation states it "will be deprecated and is not recommended". It
  bundles legacy/popular sets (Ionicons, FontAwesome, Glyphicons and similar) and
  **does not provide Material Symbols**. The `02_TECH_STACK.md` entry must
  therefore be **reconciled during the future icon-delivery slice, not silently
  treated as the selected solution**.
- **`expo-symbols`** — already installed in `mobile/package.json`, but **not
  automatically the selected solution**: it renders **SF Symbols on iOS** and
  **Material Symbols on Android and Web**, so it does **not** provide one
  identical Material Symbols family across every platform.
- **`@expo/ui` universal `Icon`, optionally with `@expo/material-symbols`** —
  platform-specific by design (SF Symbol on iOS, Material Symbol on Android) and
  documented as not rendering on Web. Must be evaluated in the later slice for
  Web support, stability, accessibility, tree-shaking, bundle size, and native
  parity.
- **Google's own Material Symbols distribution** — available as variable/static
  font, SVG, PNG, Android vector drawable, and Apple Symbols formats under the
  Apache License 2.0. Bundling or generating those assets is **not authorized by
  UX-1B1**.

**Current state:** there are **zero** icon imports and no icon runtime of any kind
in use anywhere in `mobile/src` at `origin/main` `9dbe2258`. The rules below
therefore constrain future work; nothing renders an icon today.

**Style.**

- Outlined by default; **filled only** to express selection or active state.
- One consistent stroke weight across the whole product; never mix weights on one
  screen.
- Geometric and plain. No gradients, no multi-colour marks, no skeuomorphism, no
  brand-like flourishes.
- Optically aligned with the text they accompany: an icon beside a `label` reads
  at the label's cap height, not at an arbitrary size.

**Meaning.**

- Every icon must communicate meaning. Decorative icons are forbidden.
- An icon that carries meaning needs an accessible text equivalent — a visible
  label, or an `accessibilityLabel` where no visible label exists.
- An icon that duplicates adjacent visible text is decorative for assistive
  technology and must be hidden from it, not labelled twice.
- Icon-only controls are permitted only where the meaning is unambiguous, and
  always with an `accessibilityLabel` and a 44×44 minimum target.

**Colour.**

- Icons inherit the semantic role of their context; they never introduce a colour.
- Meaningful icons meet the 3:1 non-text contrast threshold in both themes.
- The energy accent on an icon is permitted only in the allowed accent contexts
  (subject to their current blocks), and never as the sole indicator of
  selection. An icon inside a filled primary CTA takes `onPrimary`, never
  `accent`.

**Delivery remains separately gated.** The Material Symbols vocabulary is
approved; how it is delivered in React Native is not. The future icon-delivery
slice must: compare the currently supported Expo mechanisms; determine whether
AppFitness uses identical Material Symbols on every platform or platform-native
equivalents behind a shared semantic mapping; reconcile the `02_TECH_STACK.md`
icon entry; and request an ADR / technology update if the chosen mechanism falls
outside or supersedes the approved stack. Any dependency or asset that delivery
adds requires its own authorization.

---

# Layout

Every screen follows:

Header

↓

Content

↓

Primary Actions

↓

Secondary Actions

↓

Bottom Navigation (when applicable)

Avoid visual clutter.

---

# Component Hierarchy

Screen

↓

Section

↓

Card

↓

Reusable Component

↓

Primitive

Keep component trees shallow.

---

# Component States

Every interactive component must support:

Default

Hover

Pressed

Focused

Disabled

Loading

Error

Success

Selected

Empty

---

# Buttons

Variants

Primary

Secondary

Tertiary

Outlined

Text

Destructive

Loading

Disabled

Buttons should communicate priority.

---

# Inputs

> **UX-1B2B:** the normative input contracts are in §Form and Input Contracts
> (UX-1B2B). The aspirations below remain the standing v1.1 direction, narrowed
> where shipped evidence does not yet support them: **helper text, auto focus,
> and autofill have zero shipped occurrences** and are therefore **not** part of
> the evidence-frozen `AppTextInput` contract — autofill is recorded there as a
> named future requirement for the authentication verification and recovery flow.
> "Never rely solely on color for validation" is restated in that section as a
> testable requirement covering focus, error, required, selected, and disabled.

Support

Validation

Helper Text

Error Text

Success State

Loading

Disabled

Auto Focus

Auto Complete

Never rely solely on color for validation.

---

# Cards

Cards represent logical information groups.

Cards should never become containers for unrelated content.

---

# Lists

Support:

Lazy Loading

Pagination

Pull to Refresh

Empty States

Loading States

Error States

Skeletons

Virtualization

---

# Navigation

Navigation must remain predictable.

Avoid more than three navigation levels.

Deep linking should always work.

---

# Dashboard

Dashboard priorities

Today's Progress

Today's Workout

Today's Nutrition

Recovery

Goals

iCoach Insights

Quick Actions

Recent Activity

Important information appears first.

---

# iCoach UI

Recommendations should clearly indicate:

Priority

Reason

Evidence

Expected Outcome

User Action

Confidence Level

Never present AI suggestions as medical advice.

Public-v1 copy must use fitness and wellness language. It must not imply diagnosis, treatment, medical clearance, professional medical supervision, or a medical-device purpose.

---

# Localization

Public v1 must support Spanish and English.

Requirements:

- Select the device language when supported.
- Provide an in-app language selector.
- Use Spanish as a first-class product language and English as fallback.
- Keep user-facing strings out of components and domain-generated prose.
- Localize navigation, forms, validation, errors, accessibility labels, iCoach explanations, food names, exercise names, dates, decimal formats, and measurement units.
- Stable catalog identifiers and deterministic rule identifiers must not change when the display language changes.
- Identical domain inputs must produce identical structured outputs regardless of display language.

---

# Charts

Use only when they improve understanding.

Support

Accessibility

Tooltips

Legends

Animations

Responsive Layout

Avoid decorative charts.

---

# Motion Design

Animations should communicate:

State Changes

Navigation

Feedback

Hierarchy

Continuity

Animations must never delay user interaction.

## Functional motion only (ADR-P022 Decision 11)

V1 permits **functional motion only**. Every animation must serve one of the five
purposes listed above. Decorative motion — motion whose removal loses no
information — is **not permitted in V1**.

**Rules.**

- Motion never gates input. A control is interactive before, during, and after any
  transition.
- Motion never delays information. Content is present the moment it is known;
  motion may only change how it arrives.
- One transition per interaction. Simultaneous unrelated animations are a defect.
- Motion is not a state indicator. A pulse, bounce, or shimmer may accompany a
  state but must never be the only way to perceive it.
- Motion is subject to the same performance requirement as everything else
  (see §Performance): if an animation cannot hold frame rate, it is removed rather
  than degraded.

## Reduced-motion equivalence (mandatory)

Every animated affordance must have a **reduced-motion equivalent that conveys
the same information without movement** — typically an immediate state change, a
cross-fade, or a static indicator. "Reduced motion" means the information
survives, not that the feature disappears.

- Honour the OS reduce-motion setting.
- A reduced-motion path that loses information is a defect, not a fallback.
- Where a transition communicates spatial relationship (push, pop, expand), the
  reduced-motion path substitutes an instant change plus, where needed, a textual
  or positional cue.

**Not implemented.** There are **zero** matches for `AccessibilityInfo` or
reduce-motion detection anywhere in `mobile/src` at `origin/main` `9dbe2258`, and
`react-native-reanimated` — although present in `mobile/package.json` — has
**zero** consumers in `mobile/src`. Adopting motion is a later slice.

---

# Animation Timing

Fast

Normal

Slow

Use predefined motion tokens.

Avoid arbitrary durations.

## Shipped duration tokens (SHIPPED, currently unused)

`fast 150ms` · `normal 250ms` · `slow 400ms` — from
`mobile/src/shared/theme/motion.ts` at `origin/main` `9dbe2258`.

**These tokens have zero consumers in `mobile/src` today.** They are defined and
unused; no component animates anything.

**TARGET semantics** for when they are adopted: `fast` for state changes within a
component (press, selection, expand/collapse of a small region); `normal` for
navigation and for surfaces entering or leaving; `slow` only for a large surface
transition, and never for anything blocking input. Easing curves are **deferred** —
they belong with the motion-adoption slice and must not be invented here.

---

# Haptics

Use subtle haptic feedback for:

Success

Errors

Confirmation

Important Actions

Avoid excessive vibration.

---

# Canonical State Patterns

Approved by **ADR-P022** Decision 15 (UX-1B2). These are the **eight** states a
surface may be in. There are exactly eight; a ninth is not introduced by adding a
new tone or a new message.

Each state answers a different question. **Collapsing any two destroys information
the user needs**, so a generic "something is up" state is forbidden.

## The eight states

| State | Cause | Trustworthy data present? | User action | Recovery path | Semantic tone | Native / Web |
|---|---|---|---|---|---|---|
| **Loading** | A read is in flight | Not yet — unknown | Wait | The read completing | Neutral surface; no semantic tone | Both |
| **Empty** | The read **succeeded** and the collection is genuinely empty | Yes — an empty set is a true answer | Create the first item | The user adding content | Neutral / muted | Both |
| **Data-gap** | A prerequisite input is missing, so the feature **cannot compute output** | No — output is not derivable | Supply the **named** missing input, on the screen that owns it | The user completing that specific input elsewhere | `info`, with a per-gap action | Both |
| **Error** | An operation failed | Unknown or stale | Retry, or abandon | A retry succeeding, or the cause being fixed | `error` | Both |
| **Offline** | No connectivity; local SQLite is the primary operational source | **Yes, for continued offline operation** — locally available data is trustworthy to keep working from. **Remote freshness is unknown until synchronization resumes**, so no claim of globally complete, current, or server-reconciled data is made | **Nothing.** Keep working | Connectivity returning | `warning`, informational — never alarming | Native (offline-first). Web has no offline model |
| **Pending sync** | A local write is queued and **not lost** | **Yes** — the local write is fully stored on device | **Nothing.** Optionally sync now | The queue draining | `info` | Native only (Web has no local queue) |
| **Conflict** | Two versions diverged; the system **refuses to silently overwrite** | Yes, but **ambiguous** | **Review and choose** | An explicit user decision | `warning` — never `error` | Native only |
| **Web unavailable** | The capability is dormant on this platform **by decision** (ADR-P019 §4–5) | **None, and none will arrive** | Use the mobile app | **Nothing the user can do on this surface** | `info` | **Web only** |

## Non-negotiable distinctions

These are requirements, not guidance. Each is testable.

1. **Loading ≠ Empty.** A list that is still loading must never render as empty.
   The **SHIPPED** idiom `status === 'loading' && items.length === 0` exists in
   **six** screens — four of them public-v1, two in the dormant medical domain —
   precisely to prevent that flash; the contracts below make it explicit rather
   than leaving it to each screen to rediscover.
2. **Empty ≠ Data-gap.** Empty invites creation *here*. Data-gap names a *specific*
   missing prerequisite and routes *elsewhere*. The **37 SHIPPED `*.gap.*`
   localization keys** (19 `dashboard.gap.*` + 18 `nutrition.gap.*`, matched by 37
   in ES) exist because generic emptiness was not sufficient.
3. **Offline ≠ Error.** Offline is a **healthy** state: local SQLite is the primary
   operational data source and native operates offline for at least 48 hours
   (`00_PROJECT.md` §Offline First; ADR-0006). Rendering offline as `error`
   misrepresents the architecture to the user. Equally, offline copy must not
   over-promise: it may say the user can keep working from locally available data,
   but it must **not** claim the data is globally complete, current, or reconciled
   with the server — **remote freshness is unknown until synchronization
   resumes**. Queued local writes and diverged records are the separate
   **Pending sync** and **Conflict** states and must never be folded into Offline.
4. **Pending sync ≠ Error.** Pending means **safely stored**. Its copy must
   reassure, never alarm.
5. **Conflict ≠ Error.** A conflict is a *both-versions-preserved* outcome awaiting
   a decision, per the "historical records must never be silently overwritten"
   data philosophy (`00_PROJECT.md`; ADR-P016 D6). It is `warning`, not `error`.
6. **Web unavailable ≠ Error and ≠ Empty.** It is neither a failure nor an empty
   collection. It is a declared platform boundary.
7. **Web unavailable has no retry and never fabricates data.** Per ADR-P019 §5 it
   must "never crash, never silently no-op, never fabricate or sample data, and
   never imply full parity." No retry, refresh, sample-data, or
   continue-anyway affordance may exist on that surface — the **SHIPPED**
   `DashboardScreen` already records this intent in an inline comment.
8. **Raw store / error / exception text is never rendered directly.** The store's
   `error` field is a **discriminant**, not display copy; the presentation layer
   supplies localized title and body via `t()`. This is already the **SHIPPED**
   public-v1 pattern (the Progress screen comments that it must "never render the
   store's raw/internal error text"). It keeps business logic out of the UI
   (`06_MOBILE.md`) and prevents internal details reaching users
   (`08_UI_UX.md` §Error States: "Never expose technical errors").

## Current implementation evidence (SHIPPED at `2692e589`)

Reproducible with read-only `git grep` / `git show` against `origin/main`.

| Observation | Count |
|---|---|
| `<Banner >` JSX usages — the de-facto universal state container | **55**, across **21** consumer files |
| Banner tone distribution | `error` 26 · `info` 18 · `warning` 9 · `success` 2 |
| Presentation surfaces with a Web-unavailable branch | **12** |
| Web-unavailable layout shapes | **11** early-return + **1** inline conditional; of the early returns, one is a compact card |
| Web-unavailable localization keys | **23** = **11** `Title`/`Body` pairs + `progress.webUnavailableCard` |
| Specs asserting Web-unavailable behaviour | **19** |
| Route files importing `DashboardSkeleton` as their session loader | **12** |
| Row-level sync-hint implementations | **3** (two named local components + one inline) |
| Data-gap components | **2** |
| Retry-related localization keys | **0** — no retry affordance exists anywhere |
| Permission / denied localization keys | **0** — no permission state exists |
| `accessibilityLiveRegion` / `announceForAccessibility` occurrences | **0** — state changes and errors are never announced |
| `accessibilityState` occurrences | **8** (`selected` ×6, `disabled` ×2). **`busy`: 0** |
| `accessibilityHint` occurrences | **0** |

Two states in the table above therefore have **no implementation at all** today:
a retry affordance for **Error**, and any announcement of state change to
assistive technology.

## Future flow needs with insufficient current evidence

**Success confirmation** and **permission denied** are real future needs — the
first for verification and recovery flows, the second for notification
permissions — but the evidence does not yet justify a contract. Success has only
two shipped `saved*` keys and no confirmation pattern to generalise; permission
has **zero** keys, zero handling, and no owning flow. **No API, anatomy, variant,
or placeholder contract is defined for either in this revision.** They are named
here so a future slice does not mistake their absence for an oversight.

---

# State Component Contracts (UX-1B2A)

Exactly **six** contracts. All are **TARGET** — none is implemented. These are
specifications to build against, not descriptions of shipped code.

## Composition model

`Banner` remains the shipped atom; its own complete contract is **UX-1B2C**. The
duplication these contracts remove is the *layout* repeated around it and the
*status → tone + copy* mapping, not the banner itself.

```
Banner (SHIPPED atom)   AppText / Card / AppButton (SHIPPED)
        │
        └── StateView  (layout primitive: spacing + composition only)
                 ├── LoadingState
                 ├── EmptyState
                 ├── ErrorState
                 └── WebUnavailableNotice

SyncStatusHint  (separate inline row-level component — NOT a StateView wrapper)
```

**A single `<StateBlock kind="…">` god component is rejected.** The anatomies are
incompatible: Loading has no copy and no action; Pending sync is an inline row
chip with no title; Error needs a retry plus an announcement; Web unavailable must
make retry *structurally impossible*. One component with mutually exclusive props
per `kind` is the "God Component" that `06_MOBILE.md` §Anti-Patterns and
`03_CODING_STANDARDS.md` §Components forbid, and it would demote ADR-P019's
no-retry guarantee from a type-level guarantee to a convention.

## Rules common to all six contracts

- **Tokens:** semantic roles only (§Color System). No raw hex, no new role. **No
  contract here uses the energy accent** — none of the eight states is an
  achievement, a positive delta, a primary action, or selected navigation, so the
  accent rules and the accent's light-theme block do not gate this work.
- **Icons:** a contract may specify an icon **slot** and its meaning. It must not
  name a package: the Material Symbols vocabulary is approved, its cross-platform
  delivery is unresolved (§Icons).
- **EN/ES:** no single-line assumption; wrap, never clip, never truncate meaning.
  Budget from the measured **SHIPPED** catalogue: mean ES/EN length delta **+33.9%**
  across 696 keys, and worse in exactly these families — pending **+67%**
  (worst single key **+125%**), conflict **+65%**, empty **+59%**, offline **+52%**,
  data-gap **+28%**, Web-unavailable **+17%** (worst title **+38%**).
- **Dynamic type:** `allowFontScaling` inherited from `AppText`; no fixed heights
  on text-bearing containers.
- **Responsive:** single column, inheriting `Screen` padding. Content measure and
  breakpoints remain deferred (§Content measure).
- **Test hooks:** every new hook below is verified not to collide with any of the
  **76** distinct `testID` patterns already in `mobile/src` (40 static literals +
  36 template forms). **All existing consumer and Maestro `testID`s are frozen and
  unchanged by this revision** — including the **38** ids referenced by Maestro
  flows. No existing id is renamed, removed, or re-scoped.
- **Native / Web:** identical rendering unless a contract states otherwise.

---

## 1. `StateView`

| Aspect | Contract |
|---|---|
| **Responsibility** | Vertical layout for a full-surface state: an optional heading, an optional subheading, one content slot, and at most one action slot. It owns **spacing and composition only**. |
| **Non-responsibilities** | No `kind` or state discriminant. No tone selection or tone mapping. No localization keys or copy. No store or hook access. No router destination or navigation. No retry semantics. No loading, empty, error, or platform logic. No business behaviour of any kind. It must never become a god component. |
| **Anatomy** | `block`: outer block → optional [heading + subheading] group → content slot → optional action slot. `compact`: outer block → content slot → optional action slot (no heading group). |
| **Variants** | Exactly two: `block` (default, full surface) · `compact` (for use inside a card). The shape differs per variant — see below. |
| **Required props (conceptual)** | the content slot, in **both** variants. |
| **Optional props (conceptual)** | **Variant-specific, not generic:** `block` accepts an optional heading, an optional subheading, one optional action slot, and a test hook. `compact` accepts one optional action slot and a test hook only — **it does not accept a heading or a subheading**, and passing either must be inexpressible rather than silently ignored. |
| **State behavior** | Stateless and effect-free. Renders exactly what it is given. |
| **Semantic token roles** | Spacing scale only; all colour delegated to its children. |
| **Accessibility** | No role of its own — it must not announce itself as a region or summary. Children own their semantics. Reading order in `block` is heading → subheading → content → action; in `compact` it is content → action. |
| **EN/ES + dynamic type** | Height is content-driven; the heading and subheading wrap. No fixed heights. |
| **Responsive** | Single column; inherits `Screen` padding. |
| **Test hooks** | Pass-through only: it forwards a caller-supplied hook and defines none of its own. |
| **Unit / component regression** | `block`: renders with and without heading, subheading, and action. `compact`: renders content with and without an action, and **renders no heading or subheading** — the regression must not assert or imply that `compact` can render either. Both variants forward the test hook and render no tone and no copy of their own. |
| **Native / Web** | Identical. |
| **Blockers** | **None.** Layout and spacing only; every token it uses passes AA in both themes. |

---

## 2. `LoadingState`

| Aspect | Contract |
|---|---|
| **Responsibility** | Communicate that content is arriving, and announce that fact to assistive technology. |
| **Non-responsibilities** | No action of any kind. No error, empty, or gap copy. It never decides *what* is loading. It must **never imply that data is empty**. |
| **Anatomy** | `skeleton`: N placeholder blocks matching the shipped shape (a wider then a narrower bar inside a card). `text`: a single muted line. |
| **Variants** | `skeleton` · `text`. Only these two — they are the only forms evidenced in `mobile/src`. In-button spinners stay a concern of the button and are **not** a variant here. |
| **Required props (conceptual)** | a **localized** accessible loading description. There is deliberately **no default**. |
| **Optional props (conceptual)** | **Variant-specific, not generic:** `skeleton` accepts an optional block count (shipped default is 3), plus variant and test hook. `text` accepts variant and test hook only — **it does not accept a block count**, because it renders no placeholder blocks; passing one must be inexpressible rather than silently ignored. The localized accessible loading description is required by **both** variants. |
| **State behavior** | Renders only while a read is genuinely in flight. Callers must distinguish first load from refresh; the contract codifies the **SHIPPED** `loading && items.length === 0` idiom so a loading list never renders as an empty one. |
| **Semantic token roles** | Recessed surface for placeholder blocks, medium radius, spacing scale. No semantic state tone. |
| **Accessibility** | Requires a **localized** accessible description — this **replaces the hardcoded English `accessibilityLabel` on the shipped dashboard skeleton**, which is currently announced on **12** route surfaces regardless of the selected language and regardless of which feature is loading. Requires a **platform-appropriate busy contract**: the busy condition must be conveyed by the mechanism each platform actually honours (an accessibility state on the container, a live region, or a platform announcement API), chosen per platform at implementation time. **No single API is prescribed as universally correct for iOS, Android, and Web**; the requirement is that the busy condition is perceivable on each. `accessibilityState.busy` is unused in `mobile/src` today (**0** occurrences). |
| **EN/ES + dynamic type** | Loading copy runs **+23%** longer in ES on average (worst accessible label **+88%**). The text variant wraps; skeleton blocks are proportional, never fixed-pixel to a string. |
| **Responsive** | Placeholder widths are percentage-based, as shipped. |
| **Test hooks** | `state-loading` (new; no collision). |
| **Unit / component regression** | Both variants render. `skeleton`: the block count is honoured, including its default. `text`: renders the single line and **accepts no block count** — the regression must construct `text` without one and must not assert any block-count behaviour for it. Both: the localized description is announced, the busy condition is set, and the empty message is **never** rendered. |
| **Native / Web** | Identical rendering. The announcement mechanism may differ per platform by design. |
| **Blockers** | **None** — recessed-surface and muted-text roles pass AA in both themes. |

---

## 3. `EmptyState`

| Aspect | Contract |
|---|---|
| **Responsibility** | Explain that a **successfully loaded** collection is genuinely empty, and offer the action that creates the first item. |
| **Non-responsibilities** | Never represents a missing prerequisite (that is data-gap), a failure, an offline condition, or Web dormancy. Never renders while a read is in flight. No retry. No sync copy. |
| **Anatomy** | `block`: `StateView` (block) → title → body explaining **what the user can do next** → **zero or one** optional creation action. `inline`: a single muted message element, with **no** title/body pair and **no** action. In neither variant is there a second action, an action array, or an action group — consistent with `StateView`'s "at most one action slot" rule. |
| **Variants** | Exactly two: `block` (full surface) · `inline` (the shipped compact single-message form used inside a card or list). The shape differs per variant — see below. No additional variant is introduced for the action-bearing form; in `block` the action is a prop, not a variant. |
| **Required props (conceptual)** | **Variant-specific:** `block` requires a localized title **and** a localized body — the body is required because §Empty States mandates explaining what the user can do next, and an empty state with no next step is incomplete. `inline` requires **one** localized visible message and accepts no title/body pair. |
| **Optional props (conceptual)** | `block`: **one** optional creation action (handler + localized label), plus variant and test hook. `inline`: variant and test hook only — **it accepts no action at all**, and passing one must be inexpressible rather than silently ignored. |
| **State behavior** | Rendered only when a load has completed successfully **and** the collection is empty. |
| **Semantic token roles** | `block`: default surface and on-surface for the title; muted on-surface-variant for the body. `inline`: muted on-surface-variant for the single message. A filled action — possible only in `block` — uses the canonical **primary / on-primary** pair; the accent may never substitute for it. |
| **Accessibility** | `block`: title then body in reading order; an action, when present, carries the button role and meets the 44×44 minimum. `inline`: the single message is announced as text; nothing is focusable, because there is nothing to do. Never colour-only in either variant. |
| **EN/ES + dynamic type** | **The empty family is the second-worst measured: +59% mean, worst key +100%.** No fixed-height container, no single-line assumption, and no ellipsis — in **either** variant. The `inline` message must still explain the meaningful empty condition or the next step, so it **may wrap onto multiple lines and must never be constrained to one physical line** despite being the compact form. |
| **Responsive** | Single column in both variants; the `block` body and the `inline` message both wrap freely. |
| **Test hooks** | `state-empty` (new; no collision). |
| **Unit / component regression** | `block`: renders title and body; renders with **zero** and with **one** action; renders **no** second action in any configuration. `inline`: renders the single localized message, renders **no** title/body pair, and **renders no action** in any configuration; wraps rather than truncating. Both variants render in ES without clipping and are **not** rendered while loading. |
| **Native / Web** | Identical. |
| **Blockers** | **The action-bearing `block` form is blocked from AA completion.** A filled primary action fails AA in the light theme at the shipped token values (see §Contrast Requirements), and no in-palette button treatment currently passes. The **copy-only `block`** form and the whole **`inline`** variant are unblocked — `inline` carries no action by contract. The action-bearing form cannot be claimed accessible until the owner-gated light-theme action-token decision lands. |

---

## 4. `ErrorState`

| Aspect | Contract |
|---|---|
| **Responsibility** | Report that an operation failed, in localized public copy, and optionally offer a retry. |
| **Non-responsibilities** | **Never renders raw error, store, or exception text.** Never used for offline, pending sync, conflict, or Web unavailable. Never retries by itself — it invokes a caller-supplied handler. Never exposes a status code, stack, or internal identifier. |
| **Anatomy** | `Banner` in the error tone (title + body), optionally followed by **at most one** retry action. The `block` variant wraps that in `StateView`. |
| **Variants** | `banner` · `block` (full surface). **Exactly two.** There is deliberately no `banner-with-retry` variant: retry presence has **one** source of truth — the optional retry pair below — so it can never disagree with a variant name. |
| **Required props (conceptual)** | localized public title, localized public body. |
| **Optional props (conceptual)** | **one** optional retry pair — a caller-supplied retry handler **and** a localized retry label — plus variant and test hook. The pair is all-or-nothing: the implementation must make a partial pair invalid, so the retry is either fully supplied (**both** values) or fully absent (**neither**). A handler without a label, or a label without a handler, must not be expressible. |
| **State behavior** | **A retry action may be exposed only when retry is meaningful** — that is, when repeating the operation could plausibly succeed. Where it cannot (a validation failure, a declared platform boundary, an unrecoverable state), the retry must be absent rather than inert. **At most one retry action exists**, and the component **never retries automatically** — it only invokes the caller's handler on an explicit press. The store's `error` field is consumed as a **discriminant**; the copy always comes from the localization catalogue. |
| **Semantic token roles** | The error presentation consumes the existing **recessed** `Banner` atom, so: `surfaceVariant` for the recessed background; `error` for the banner's border and its title; `onSurfaceVariant` (the existing muted text role) for the body. `primary` / `onPrimary` are used **only** by the optional retry action. **`onError` is not used by this contract** — it applies only to content rendered on a filled `error` background, which this contract does not define. |
| **Accessibility** | **Requires error announcement.** The failure must be conveyed to assistive technology by a **platform-appropriate mechanism** — a live region, a platform announcement call, or focus movement to the message — selected per platform at implementation time. **No single API is prescribed as universally correct for iOS, Android, and Web.** This closes a real gap: there are **0** `accessibilityLiveRegion` / `announceForAccessibility` occurrences in `mobile/src` today, while `09_TESTING.md` §Accessibility Testing requires "Error announcement". Any retry carries the button role and the 44×44 minimum. |
| **EN/ES + dynamic type** | Error copy runs **+16%** longer in ES on average, worst title **+93%**. Titles wrap; the retry label wraps or grows and is never clipped. |
| **Responsive** | Single column; the action sits below the copy, never beside it at narrow widths. |
| **Test hooks** | `state-error`, `state-error-retry` (new; no collision). |
| **Unit / component regression** | Renders localized title and body; **renders no raw store string**; retry invoked exactly once per press and **never invoked automatically**; **at most one** retry action rendered; retry absent when the retry pair is absent; a partial retry pair is not expressible; the announcement path is exercised; **both** variants. |
| **Native / Web** | Identical rendering; the announcement mechanism differs per platform by design. |
| **Blockers** | **Retry implementation is blocked from AA completion.** Both a filled and a text-style retry fail AA in the light theme at the shipped token values (see §Contrast Requirements). The **copy-only** error form is unblocked — the error role itself passes AA in both themes. |

---

## 5. `WebUnavailableNotice`

| Aspect | Contract |
|---|---|
| **Responsibility** | Render the ADR-P019 §5 honest platform-dormancy state, consolidating **layout and structural guarantees only**. |
| **Non-responsibilities** | **Supplies no copy.** It owns **no** default, fallback, or generic message. Never an error or warning tone. **No retry, refresh, reload, sync, sample-data, or continue-anyway affordance — and no action prop exists in its shape at all.** No loading state. Never fabricates, samples, or infers data. Never implies parity with native. |
| **Anatomy** | `block`: `StateView` (optional heading, optional subheading) → `Banner` in the info tone (title + body). `compact`: card → muted label + body, with **no** heading group. `inline`: bare `Banner` in the info tone, with **no** heading group. |
| **Variants** | Exactly the **three shapes evidenced** in `mobile/src`: `block` (the repeated early-return form), `compact` (the dashboard summary-card form), `inline` (the conditional-banner form). No fourth variant. |
| **Required props (conceptual)** | **caller-supplied localized title and body, in all three variants.** Both are required specifically so a caller cannot fall back to a generic message. |
| **Optional props (conceptual)** | **Variant-specific, not generic:** `block` may accept an optional heading and an optional subheading, plus variant and test hook. `compact` and `inline` accept variant and test hook only — **neither accepts a heading or a subheading**, because neither renders a heading group; passing either must be inexpressible rather than silently ignored. All three accept the test hook, because all three render output. **There is deliberately no action, retry, handler, refresh, or sample-data prop in any variant, and no default or generic copy anywhere** — the ADR-P019 guarantee is enforced by the component's shape, not by reviewer vigilance. |
| **State behavior** | Rendered only when a store reports the dormant-Web condition. It performs no detection itself and holds no state. |
| **Semantic token roles** | Info role for the banner accent, recessed surface as ground, muted on-surface-variant for body. |
| **Accessibility** | Title and body are both announced; the banner keeps its summary semantics. Nothing focusable is rendered, because there is nothing to do. |
| **EN/ES + dynamic type** | **All 11 feature-specific EN/ES title/body pairs and `progress.webUnavailableCard` are preserved unchanged.** Component consolidation is **not** copy consolidation: per-feature wording is required by ADR-P019 §5 so the user learns *which* capability is unavailable; it is asserted by **19** existing specs; and ES titles already run up to **+38%** longer (one title reaches 58 characters), so a single generic title would be either vague or long in both languages. Titles must wrap. |
| **Responsive** | Single column in all three variants. |
| **Test hooks** | `state-web-unavailable` (new; no collision). |
| **Unit / component regression** | All three variants render, each with the caller's localized title and body. `block`: renders with and without a heading and subheading. `compact` and `inline`: **render no heading or subheading** and accept none — the regression must construct them without either. **No action, retry, or pressable element is rendered in any variant**; the absence of a retry prop is enforced at the type level; **all 19 existing Web-unavailable specs must remain green unchanged**. |
| **Native / Web** | Reachable only on Web by construction (native never reports the dormant condition). It renders identically if exercised in a native test. |
| **Blockers** | **The shipped `Banner` info tone renders its title in a role/size combination that fails AA in the light theme** (see §Contrast Requirements). This affects the notice's own title on every surface that uses it today. The contract is definable now; a fully AA-compliant light-theme rendering awaits the owner-gated token decision. Recorded, not worked around. |

---

## 6. `SyncStatusHint`

| Aspect | Contract |
|---|---|
| **Responsibility** | Convey **one row's** local sync condition inline: pending, conflict, or nothing. |
| **Non-responsibilities** | **Not a `StateView` wrapper** — it is an inline row-level element, not a block. No aggregate counts. No surface-level banner (that remains `SyncStatusBanner`). No retry. No error. No offline. No navigation. |
| **Anatomy** | A short caption-sized text element with an accessible description, rendered inside a list row. |
| **Variants** | `pending` · `conflict` · **`synced` → renders `null`**. The null case matches all three shipped implementations. |
| **Required props (conceptual)** | **Condition-specific, not generic.** `pending`: the condition plus a **localized** visible label and a **localized** accessible description. `conflict`: the condition plus a **localized** visible label and a **localized** accessible description. `synced`: the condition **only**. A caller must not be obliged to supply display copy that will never be shown. |
| **Optional props (conceptual)** | **Condition-specific:** `pending` and `conflict` accept a test hook. `synced` accepts **nothing beyond its condition** — no visible label, no accessible description, and **no test hook**, because it renders `null` and there is no node to hook, label, or announce. Passing any of them must be inexpressible rather than silently ignored. |
| **State behavior** | Pure projection of the row's condition. No effects, no store subscription, no polling. |
| **Semantic token roles** | Muted on-surface-variant for pending; the warning role for conflict. |
| **Accessibility** | **Pending and conflict always include text — never colour alone.** This satisfies the standing anti-pattern "Depend on color alone" and the non-colour redundancy rule (§Color System). **Each rendered variant — that is, `pending` and `conflict` — carries a localized accessible description.** `synced` renders nothing, so it has no accessible description and announces nothing. |
| **EN/ES + dynamic type** | **The highest overflow risk in the product: the shipped pending label is 12 characters in EN and 27 in ES (+125%).** The contract therefore forbids fixed-width chips, single-line assumptions, and truncation; the hint wraps or the row grows. |
| **Responsive** | Wraps within its row; never forces horizontal scrolling. |
| **Test hooks** | `sync-hint` (new, parameterizable by row; no collision) — available to the **rendered** conditions `pending` and `conflict` only. Existing row-level `testID`s are unchanged. |
| **Unit / component regression** | Renders for `pending` and for `conflict`, each with visible text alongside its colour and each reachable by its test hook. **`synced` is constructed with its condition alone — no label, no accessible description, no test hook — and renders `null`**, proving none of those props is required or consumed. ES label renders without clipping. |
| **Native / Web** | **Native-meaningful.** Absent on Web, where no local write queue exists (ADR-P019). It must not be shown on Web merely because a row rendered. |
| **Blockers** | The **conflict** variant uses the warning role, which is a recorded light-theme AA failure at the shipped value (see §Contrast Requirements). The pending variant is unblocked. The conflict variant is definable now and cannot be claimed accessible in the light theme until the token decision lands. |

---

## Reconciliation notes (documented, not redesigned)

- **`SyncStatusBanner` remains the surface / aggregate component.** It already
  centralises the syncing, offline, error, conflict-count, pending-count, and
  ready outcomes into the correct tones, and it is covered by its own spec. This
  slice **does not replace, redesign, wrap, or migrate it**. `SyncStatusHint` is
  its row-level counterpart, not its successor. A future reconciliation may share
  the status→tone mapping between them; that is not decided here.
- **The two data-gap components remain.** Both express the same semantics: name
  the specific missing prerequisite, explain why the feature is blocked, and offer
  a direct action that routes to the screen owning that input. They currently
  duplicate their gap-id → destination maps. This slice records the **shared
  semantics and the future need to reconcile them**; it does **not** invent a
  third component, choose a winner, or select a code migration.
- **`Banner` remains the underlying atom.** Its complete contract — variants,
  tones, title role, anatomy, and the light-theme title finding — is **UX-1B2C**.
  The contracts above consume it; they do not redefine it.

---

# Form and Input Contracts (UX-1B2B)

Exactly **three** contracts: `AppTextInput`, `FormField`, `FormSelect`. All are
**TARGET** — none is implemented. There is no fourth contract, and this section
introduces no runtime code.

## Shipped-evidence snapshot

Every figure below is reproducible from tree `a4339be1` with read-only `git grep`.
The contracts are frozen against this evidence; anything absent from it is
rejected or deferred, never invented.

| Observation | Count |
|---|---|
| Non-spec files containing raw `TextInput` | **7** |
| Raw `<TextInput>` occurrences | **11** |
| `FormField` consumer files / usages | **7** / **40** |
| `FormSelect` consumer files / usages | **5** / **8** |
| Input styling families | **2** — FULL and REDUCED |
| Radio-role selection implementations | **3** |
| Selected-state-only choice surfaces (no radio role) | **4** |
| Zod schema modules (validation lives here, never in a UI primitive) | **6**, plus **4** dedicated schema specs (10 files matching `*schema*`) |
| Localized validation keys | **20 EN / 20 ES** |
| Placeholder keys | **18 EN / 18 ES** |
| Spec files querying inputs by accessibility label | **19** |
| Spec files coupled to `field-` / `input-` / `option-` hooks | **10** |
| Maestro flows coupled to input-related ids | **9 of 12** |
| Password fields | **1**, with **no** visibility affordance |

**Zero shipped occurrences** of: multiline, `numberOfLines`, autofill
(`autoComplete` / `textContentType` / `importantForAutofill`), explicit
read-only (`editable` / `readOnly`), helper text, input masks, character
counters, leading/trailing icon slots, select search, multi-select, async or
remote options, and any native picker. Each is therefore rejected or deferred
below rather than specified.

## Rules common to the three contracts

- **Clean Architecture.** Business logic stays out of the UI. No primitive
  touches SQLite, a repository, a store, or navigation. Validation and
  transformation remain in the feature-owned Zod schemas.
- **No hardcoded copy, colour, spacing, or string.** Semantic roles only; light
  and dark both specified.
- **44×44 minimum** interactive target.
- **Never colour alone** for focus, error, required, selected, or disabled. The
  minimum implementable behaviour is specified in §Non-colour redundancy —
  minimum target behaviour below.
- **EN/ES reflow and dynamic type** required — the measured catalogue-wide ES/EN
  length delta is **+33.9%**. The wrapping rule applies to **surrounding text**,
  not to the text-entry control:
  - **Must wrap and reflow, and must never truncate meaning:** visible field
    labels, required indications, validation/error messages, select-option and
    chip labels, and helper copy if it is ever authorized.
  - **`AppTextInput` itself is intentionally single-line.** That is not a
    truncation-of-meaning exception: the control scrolls its own value
    horizontally as the platform does, and multiline has **zero shipped
    evidence** and is **deferred** (§1). Nothing here introduces multiline
    support.
  - The control's height is a floor that grows with the OS text scale, never a
    ceiling.
- **No icon may enter an input API.** Material Symbols is the approved vocabulary
  but its runtime delivery is unresolved (§Icons).
- **Test hooks:** `testID` is an **optional pass-through**, never globally
  mandatory. Every hook that exists today is frozen — see §Input frozen-hook
  register.

## Non-colour redundancy — minimum target behaviour

"Never colour alone" is only enforceable if the redundant signal is named. The
following is the **minimum** each state must carry. It introduces **no new token
and no icon dependency**.

| State | Required signals |
|---|---|
| **Default input border** | 1 px border. |
| **Focused input** | A border **visibly thicker than the default 1 px**, so focus is never a colour-role swap alone. |
| **Invalid text field** | The visual border treatment **plus** adjacent error copy **plus** programmatic invalid exposure. All three, not any one. |
| **Required field** | A visible required indicator **plus** programmatic required exposure. The indicator alone is insufficient — see §2. |
| **Disabled control or option** | Interaction is **prevented** (not merely styled), the disabled condition is **exposed programmatically**, and the visible treatment is **not solely a change of semantic colour role** (e.g. reduced opacity, as the shipped button already does). |
| **Selected radio chip** | Programmatic selected state **plus** a **visible geometric distinction** from the unselected 1 px chip border — for example a thicker border — so selection is not conveyed by fill colour alone. **BLOCKED detail:** the exact border role/width for the selected chip cannot be proven from the accepted token set, so it is **not specified here** and must not be invented. The selected-chip **foreground** contrast blocker stands unchanged (§Usage-level contrast findings). |

Thickness values beyond "thicker than 1 px" are deliberately unspecified: the
accepted token set contains no border-width scale, and inventing one would be a
token decision, which is out of scope for this slice.

## Validation-copy boundary — what is SHIPPED versus TARGET

Stated precisely, because the shipped inventory is **not** uniform:

- **SHIPPED:** `FormField` and `FormSelect` render whatever
  `fieldState.error.message` the field's validation produces — from the
  feature-owned Zod schema, or from an explicit React-Hook-Form `setError` call
  (the custom-exercise duplicate-name check uses the latter). That rendering path
  is preserved exactly.
- **SHIPPED, and narrower than it may appear:** localization of that copy is a
  **call-site** guarantee, not a schema-level one. Of the six schema modules,
  three accept an injected messages object (`profile`, `goal`, `progress`) and one
  accepts an injected required-message argument (`custom-exercise`) — and even
  those retain **English defaults/fallbacks** used when nothing is injected. The
  two dormant medical schemas (`evaluation`, `restriction`) have **no injection
  mechanism at all** and carry **hardcoded English** validation copy.
- **TARGET for public surfaces:** schemas provide user-safe **localized EN/ES**
  validation copy for every public-v1 field.
- **Always, both SHIPPED and TARGET:** raw store or repository exceptions, stack
  details, and technical failure text are **never** rendered as field validation
  copy.
- **Out of scope:** dormant medical localization remains outside this slice under
  **ADR-P017** and must be resolved before those surfaces are activated.
- **UX-1B2B performs no localization change and no runtime migration.**

---

## 1. `AppTextInput`

| Aspect | Contract |
|---|---|
| **Responsibility** | A theme-aware React Native text-control primitive. It owns the input node, value entry, the visual input states, its semantic tokens, its accessible name, and native `TextInput` behaviour. |
| **Non-responsibilities** | Owns **no** visible field label, **no** helper text, **no** validation message, **no** schema, **no** React Hook Form controller, **no** store or repository access, **no** navigation, and **no** business logic. |
| **Anatomy** | A single-line text control only. No surrounding label, no message row, no adornment slots. |
| **Control models (discriminated — never mixed)** | **Controlled:** requires `value` **and** a change callback; **does not accept** `defaultValue`. **Uncontrolled commit-on-end:** requires `defaultValue` **and** the end-edit commit callback; **does not accept** the controlled `value`/change pair. A partial or mixed pair must be **inexpressible**, not silently resolved. The uncontrolled shape exists only because one shipped consumer needs it (the per-set reps editor); it must not be widened into a general uncontrolled API. |
| **Evidenced optional configuration** | placeholder · secure text entry · auto-capitalization · auto-correction · `selectTextOnFocus` · blur and end-edit callbacks. Keyboard types: **default, numeric, decimal-pad, email-address** — these four only. |
| **States** | default · focused · populated · error/invalid · **disabled**. Disabled is a TARGET standard state and is **currently unexercised** — there are zero shipped `editable`/`readOnly` usages, so no consumer proves its behaviour yet. A distinct **read-only** state (non-editable but not de-emphasised) is **deferred**; it must not be treated as a synonym for disabled. |
| **Semantic token roles (FULL family is canonical)** | `surfaceVariant` fill · `onSurface` value text · **`onSurfaceVariant` placeholder text** · `outline` border at **1 px** by default · `error` border in the invalid state · a **thicker-than-default** border when focused (§Non-colour redundancy) · medium radius · `spacing.x5l` minimum height · horizontal `spacing.md` · body typography. **`outline` must not be used for placeholder text** — that pairing is a measured contrast failure (§Usage-level contrast findings). |
| **Semantic-state interface (explicit)** | The contract is small, but it must accept **enough semantic input to express**: (a) the **accessible name**; (b) the **required** state, when applicable; (c) the **invalid** state; (d) the **disabled** state; (e) an **optional `testID`**. These are the semantic inputs — not native prop names. The exact native mapping per condition stays **implementation-gated** and must be validated separately on iOS, Android, and Web. **No generic catch-all native-props surface** is added: the primitive does not spread arbitrary `TextInput` props, because that would silently reintroduce every API this contract rejects. |
| **Ownership chain** | `FormField` owns the **visible label**, the **required indication**, and the **error message**. It passes the **accessible-name, required, invalid, and disabled outcomes** into `AppTextInput`. `AppTextInput` owns the **native control** and is responsible for exposing those outcomes to assistive technology. Neither side duplicates the other's job: `AppTextInput` never renders a label or a message, and `FormField` never reaches into the native control's accessibility surface directly. |
| **Accessibility** | A meaningful accessible name is **conceptually required** on the control. 44×44 minimum. Focus, invalid, required, and disabled meaning must never rest on colour alone — see §Non-colour redundancy for the minimum signals. **Required and invalid conditions must be exposed programmatically as well as visibly.** This contract deliberately does **not** prescribe `accessibilityState.required`, `accessibilityState.invalid`, or any other single React Native prop, and does not claim one API works universally: the requirement is the **outcome** — that assistive technology on iOS, Android, and Web can perceive the required, invalid, and disabled conditions. The exact mechanism must be validated against the installed React Native / Expo version for each platform during implementation. Today there are **zero** occurrences of `accessibilityHint`, required exposure, and invalid exposure across `mobile/src`. |
| **EN/ES + dynamic type** | Labels and error copy live with the caller and must wrap; the control's own height is a floor, never a ceiling, so it grows with the OS text scale. 18 EN / 18 ES placeholder keys already exist and are unchanged. |
| **Responsive / Web** | Identical on all platforms. There is no Web-specific input variant today (`Platform.OS` has **zero** occurrences in any `.tsx`), and none is introduced. Only two shipped inputs render on Web at all; the rest sit behind `web-unavailable` gates or in the dormant medical domain. |
| **Test hooks** | `testID` is an **optional pass-through**. When supplied it must land on the **actual `TextInput` node**, alongside the accessible name and the `value` prop, because shipped specs assert `.props.value` on the node reached by that id. No new id is required where none exists today. |
| **Unit / component regression** | Controlled and uncontrolled shapes each render and commit correctly; a mixed pair is not expressible; each of the four keyboard types; secure entry masks; `selectTextOnFocus` honoured when opted in; the invalid state changes the border **and** is exposed programmatically; the disabled state is covered even though no consumer exercises it; ES rendering at a large text scale does not clip. |
| **Blockers** | None from tokens for the control itself — fill, value, placeholder (using `onSurfaceVariant`), border, and error border all pass AA in both themes. The **placeholder-via-`outline`** pairing used by six shipped inputs fails in light and must not be carried into the primitive. |

**Rejected from this contract** (zero shipped evidence): multiline ·
`numberOfLines` · `maxLength` · return-key and submit behaviour · clear button ·
autofocus · leading/trailing visual slots · password visibility toggle ·
character counters · input masks · autofill props · any broad catch-all prop
surface.

**Autofill is a named future requirement, not part of this contract.** The
authentication verification and recovery flows will need
password-manager-compatible configuration; there are **zero** such props today,
so specifying them now would be speculative. They belong to the slice that owns
those flows.

---

## 2. `FormField`

| Aspect | Contract |
|---|---|
| **Responsibility** | The React Hook Form adapter for a single text field: it owns `Controller`, the visible label, the required indication, and the **adjacent validation-error rendering**. It does **not** own localization — producing user-safe localized copy remains the responsibility of the feature schema and its call site for public-v1 surfaces (§Validation-copy boundary). |
| **Non-responsibilities** | No validation, no schema, no coercion, no persistence. It composes `AppTextInput`; **it is not replaced by it**. |
| **Preserved exactly** | `Controller` ownership · the `Control<T>` / `FieldPath<T>` generic surface, including the current `z.input`-as-`unknown` assignability that lets numeric schemas stay assignable to the shared field · label ownership · the `field-${name}` hook **on the actual `TextInput` node** · the accessibility-label query path (the label is passed through as the control's accessible name) · all **11** `selectTextOnFocus` call sites and its opt-in default-off semantics · the keyboard configuration its existing consumers rely on · the **`fieldState.error.message` rendering path** and the feature-owned validation boundary exactly as shipped (see §Validation-copy boundary — the copy's localization is a call-site guarantee today, not a schema-level one). |
| **Anatomy** | label (with required indication) → `AppTextInput` → adjacent error message when invalid. |
| **Required indication** | Keep the visible indication. **Add a platform-appropriate programmatic required contract** so assistive technology perceives it. Required must not rest on the asterisk glyph or on colour alone. Do not freeze an unsupported universal React Native prop — state the outcome and validate the mechanism per platform at implementation time. Today the asterisk is appended to the *visible* label only while the accessible name receives the raw label, so screen readers never hear it. |
| **Invalid / error behaviour** | `FormField` owns the adjacent error rendering; `AppTextInput` receives only the visual and programmatic invalid state, per the ownership chain in §1. The message must be **associated with its field** and **announced through a platform-appropriate mechanism**, and the invalid state must carry all three signals required by §Non-colour redundancy. **Raw store or repository exceptions, stack details, and technical failure text are never rendered as field validation copy.** Copy comes from the field's validation — the Zod schema or an explicit `setError` — and is **TARGET-localized for public surfaces**; see §Validation-copy boundary for what is and is not already localized. |
| **Helper text** | **No helper-text contract.** Zero shipped evidence. |
| **Control model** | Controlled through RHF only. The uncontrolled `AppTextInput` shape is not exposed here. |
| **Semantic token roles** | Label uses on-surface; the control uses the FULL family; the error message uses the error role at caption size on its surrounding ground. All pass AA in both themes. |
| **EN/ES + dynamic type** | Label, required indication, and error copy all wrap; no fixed heights on text. |
| **Test hooks** | `field-${name}` frozen, on the control node. |
| **Unit / component regression** | Renders label, control, and error; required is exposed both visibly and programmatically; **no raw store/repository exception or stack text is ever rendered as validation copy**; for a public-v1 surface the rendered message is the localized string its call site injected; focus renders a thicker-than-default border; `selectTextOnFocus` passes through; `Control` assignability holds for numeric schemas; every existing `field-*` id and label query still resolves. |
| **Blockers** | None from tokens. |

---

## 3. `FormSelect`

| Aspect | Contract |
|---|---|
| **Responsibility** | The React Hook Form adapter for single-choice enum selection, rendered as a wrapping row of pressable radio chips. |
| **Non-responsibilities** | No validation, no schema, no persistence, no navigation. No native picker and no new dependency. |
| **Preserved exactly** | `Controller` ownership · single-selection behaviour · label and visible required indication · the adjacent `fieldState.error.message` rendering path (rendering is preserved; localization of that copy is the schema/call-site responsibility described in §Validation-copy boundary) · the pressable radio-chip layout with wrapping · `accessibilityRole="radio"` · programmatic selected state · `${label}: ${option}` accessible labels · `option-${name}-${value}` hooks · the minimum interactive target. |
| **Selection models (both shipped)** | **Required single selection** — a value is always present (e.g. the profile fitness-level and activity-level fields default to a concrete enum member). **Optional single selection** — the field may **begin with no option selected**. The optional model is shipped evidence, not inference: `ProfileForm.gender`, `EvaluationForm.activityLevel`, and `RestrictionForm.severity` are each declared `.optional()` in their Zod schema, each initialise to `undefined` in their blank-values factory, and each map `undefined → null` on submit. The contract must therefore render a valid **initial unselected** state. |
| **Deliberately NOT inferred from the optional model** | No clear/deselect action once a choice is made · no synthetic "None" option · no placeholder UI · no null-option rendering · no modal or list picker. There is **no interaction evidence** for any of these, so each remains **deferred**. Optional means "may start empty", nothing more. |
| **Disabled options** | **TARGET**, supported by the shipped sibling radio-chip pattern in the language selector, which pairs `disabled` with a programmatic disabled state. Stated honestly: the current shared `FormSelect` option type is `{ label, value }` and **does not implement option-level disabled today**. When added, a disabled option must expose its state **programmatically and visibly** and must **not** invoke selection. This must **not** be generalised into a disabled-field or read-only API — no evidence supports either. |
| **Anatomy** | label (with required indication) → wrapping chip row → adjacent error message when invalid. |
| **Semantic token roles** | Unselected chip: `surfaceVariant` fill, `outline` border at **1 px**, muted on-surface-variant label — passes AA in both themes. Selected chip: `primary` fill **plus a visible geometric distinction from the 1 px unselected border** (§Non-colour redundancy); the exact selected border role/width is **BLOCKED** — it cannot be proven from the accepted token set and must not be invented here. The selected chip's **foreground pairing is also blocked** — see §Usage-level contrast findings. |
| **Accessibility — required outcomes** | Assistive technology must be able to perceive **all** of: (a) the **field/group label**; (b) that the options form **one single-choice group**; (c) **each option's name**; (d) each option's **selected** and, when implemented, **disabled** state; (e) the **required** and **invalid** state of the field/group; (f) the **relationship between the invalid group and its adjacent error message**. These are outcomes, not APIs: this contract does **not** prescribe a universal `radiogroup` role, any `aria-*` attribute, or any specific React Native prop, and none may be adopted without verification against the installed Expo / React Native versions on iOS, Android, and Web. The shipped component already provides the radio role per option, the programmatic selected state, and `${label}: ${option}` names; group identity, required, invalid, and the error relationship are the outcomes still to be satisfied. 44×44 minimum. Selection must never be conveyed by colour alone — see §Non-colour redundancy. |
| **EN/ES + dynamic type** | Chips wrap and grow; option labels are never clipped or ellipsized. |
| **Responsive / Web** | Identical on all platforms; **no Web-specific variant**. |
| **Test hooks** | `option-${name}-${value}` frozen, on the pressable node. |
| **Unit / component regression** | Required and optional models both render, the optional one with **no initial selection**; selecting sets the value once; the selected state is exposed programmatically **and** carries a visible geometric distinction; the six accessibility outcomes above are each asserted; **no raw store/repository exception is rendered as validation copy**; ES option labels wrap without clipping; when option-level disabled lands, a disabled option announces its state and cannot be selected. |
| **Blockers** | **The selected chip cannot be declared AA-complete in both themes** until the owner-gated `primary`/`onPrimary` token decision resolves — see §Usage-level contrast findings. The unselected chip is unblocked. |

**Explicitly rejected** (zero shipped evidence): search · multi-select ·
async/remote options · virtualization · icons · native picker · new package ·
Web-specific variant.

---

## Input style-family reconciliation

Two divergent families ship today.

| Family | Where | Shape |
|---|---|---|
| **FULL** — canonical TARGET | sign-in, delete-account, `FormField`, `FoodLogAddForm` | `surfaceVariant` fill · `minHeight: spacing.x5l` · horizontal `spacing.md` · body typography |
| **REDUCED** | 7 raw inputs across 3 files | `padding: spacing.sm` · **no fill, no minimum height, no typography token** |

The REDUCED family therefore sits **below the 44×44 floor** and **outside the type
scale**, and six of the eight shipped `placeholderTextColor` sites use the
`outline` role.

**FULL is the canonical target.** Sequencing is explicit:

- **UX-1C** may implement the shared primitives (`AppTextInput`, and `FormField` /
  `FormSelect` composing it) against these contracts.
- **Migrating the seven REDUCED feature consumers is UX-5 work**, requires
  separate per-feature authorization, and is a **behaviour-visible** change
  because those inputs gain a 48px floor and a type token.
- **No runtime migration occurs in UX-1B2B.**

---

## Input frozen-hook register

Every hook and query path below exists today and is **frozen**: none may be
renamed, removed, re-scoped, or moved onto a wrapper node. New components may
accept an optional pass-through hook; **no new id is required where none exists**.

| Hook / path | Where | Coupled to |
|---|---|---|
| `input-email`, `input-username`, `input-password` | sign-in | Maestro + route specs |
| `input-confirm-phrase` | delete-account | route spec (asserts the id on the labelled node) |
| `field-${name}` — incl. `field-birthDate`, `field-heightCm`, `field-weightKg`, `field-waistCm`, `field-name`, `field-muscleGroup`, `field-bodyArea` | `FormField` | Maestro + component specs |
| `option-${name}-${value}` — incl. `option-gender-MALE`, `option-goalType-FAT_LOSS` | `FormSelect` | Maestro + component specs |
| `food-search-input` | `FoodLogAddForm` | Maestro |
| `routine-name`, `workout-name`, `set-reps-input`, `set-weight-input` | workout surfaces | Maestro |
| `set-reps-${set.id}` | per-set reps editor (uncontrolled) | component spec |
| `dp-food-search`, `dp-note`, `dp-tag-${tag}`, `dp-add` | dietary preferences | Maestro (`dp-tag-*`, `dp-add`) + component specs |

Additional preservation requirements:

- **19** spec files resolve inputs through the **accessibility-label** query path;
  those labels must stay on the control node.
- **10** spec files query `field-` / `input-` / `option-` hooks, and several assert
  **`.props.value` directly on the node reached by that id** — so id, accessible
  name, and `value` must remain on the same native control.
- **9 of 12** Maestro flows depend on the ids above.

---

# Empty States

> **UX-1B2A:** the normative empty-state semantics and the `EmptyState` contract
> are in §Canonical State Patterns and §State Component Contracts (UX-1B2A). The
> requirements below remain in force, with one narrowing: the `EmptyState`
> **component** contract supports **zero or one** optional creation action, in
> line with `StateView`'s "at most one action slot" rule. A screen may still offer
> a further route elsewhere in its layout; the component itself renders no second
> action.

Every empty screen should explain:

Why it is empty

What the user can do next

Primary Action

Secondary Action (optional)

Never display blank screens.

---

# Loading States

> **UX-1B2A:** the normative loading semantics and the `LoadingState` contract are
> in §Canonical State Patterns and §State Component Contracts (UX-1B2A). The
> requirements below remain in force.

Use

Skeletons

Progress Indicators

Optimistic UI where appropriate

Avoid blocking the interface unnecessarily.

---

# Error States

> **UX-1B2A:** the normative error semantics and the `ErrorState` contract are in
> §Canonical State Patterns and §State Component Contracts (UX-1B2A) — including
> the rule that raw store, error, or exception text is never rendered. The
> requirements below remain in force.

Every error should include:

Clear message

Reason (when appropriate)

Recovery action

Retry option

Never expose technical errors.

---

# Accessibility

Target

WCAG 2.2 AA

Support

Screen Readers

VoiceOver

TalkBack

Dynamic Text

Reduced Motion

High Contrast

Minimum touch target:

44 x 44

Accessibility is mandatory.

## Verification expectations

Accessibility is verified, not asserted. WCAG 2.2 AA is the floor.

**Per-surface checks (TARGET).**

1. **Contrast** — every text/background and meaningful icon/background pair has a
   recorded ratio and pass/fail verdict in **both** themes, using the method in
   §Contrast Requirements. Exemptions are cited explicitly.
2. **Non-colour redundancy** — selected, success, warning, and error each carry at
   least one non-colour signal (§Color System).
3. **Screen reader** — the surface is navigated end to end with VoiceOver and
   TalkBack. Every interactive element announces a name, a role, and its state.
4. **Dynamic type** — the surface is checked at default and at a large OS text
   scale, in **both** Spanish and English, with no clipped or truncated meaning.
5. **Target size** — every interactive element meets 44×44, and adjacent targets
   keep at least `sm` (8) between hit areas.
6. **Reduced motion** — any animated affordance is checked with the OS
   reduce-motion setting on, and still conveys the same information.
7. **Keyboard / focus** — where a platform exposes focus (Web, external keyboard),
   focus order follows reading order and focus is visibly indicated.

**Current scaffolding (SHIPPED).** Verified at `origin/main` `9dbe2258` across
6,685 lines of non-spec UI: 142 `accessibilityLabel`, 18 `accessibilityRole`,
8 `accessibilityState`, **0** `accessibilityHint`. `AppText` sets
`allowFontScaling`; `AppButton` enforces the 44×44 minimum target.

**Known gaps (TARGET work, not yet implemented).** No reduce-motion detection, no
high-contrast handling, no manual theme override, and no responsive/reflow
handling exist in `mobile/src`; the light-theme contrast failures recorded in
§Contrast Requirements are open. These are stated so no reader mistakes the
current state for compliance.

---

# Dark Mode

Support

Light Theme

Dark Theme

Future Dynamic Themes

Themes must use semantic tokens.

## Light and dark are co-equal

Dark is a designed theme, not an inversion of light. Both themes are specified,
audited, and reviewed; neither is the "real" one.

- Every semantic role is defined in both themes (SHIPPED — 27 roles each).
- Every contrast pair is audited in both themes (§Contrast Requirements).
- Elevation behaves differently by theme: shadow in light, surface tint in dark
  (TARGET — §Elevation).
- The energy accent must be legible in both themes. It currently is not in light
  (2.998:1) — see §Contrast Requirements. Accent emphasis on primary actions is
  blocked in **both** themes so the semantic rule stays identical across them.

**SHIPPED behaviour:** the active theme resolves from the OS colour scheme only
(`mobile/src/shared/theme/use-theme.ts` reads `useColorScheme()`). There is **no**
in-app theme override and **no** persisted theme preference — `Appearance` and
`setColorScheme` have zero matches in `mobile/src`. An in-app theme control is
**not** part of this revision.

---

# Responsiveness

Layouts should adapt to:

Phones

Foldables

Tablets

Future Desktop

Avoid fixed dimensions whenever possible.

---

# Images

Images should:

Lazy load

Cache

Maintain aspect ratio

Provide placeholders

Support accessibility labels

## Imagery policy for V1 (ADR-P022 Decision 12)

**V1 ships no photographic and no per-exercise illustrative asset pipeline.**
There is no licensing path, no asset budget, and no bundle allowance for one.

- **Forbidden in V1:** photography, per-exercise artwork, decorative hero images,
  stock imagery, background textures, and gradient "energy" fills used as
  decoration.
- **Allowed:** the existing application icon, adaptive icon, splash, and favicon
  assets already present under `mobile/assets/` — these are platform identity, not
  product imagery.
- **Separately evaluated, not approved:** small empty-state illustrations. If they
  are ever adopted they need their own decision covering source, licence, bundle
  budget, dark-theme variants, localization neutrality, and an accessible text
  equivalent.
- **Consequence, accepted:** data and typography must carry the visual interest.
  This is the reason §Visual Direction makes typographic and numeric craft
  non-optional.

**Current state:** there are **zero** matches for `expo-image` or any `<Image`
usage in `mobile/src` at `origin/main` `9dbe2258`. The rules above therefore
constrain future work; they describe no removal.

The lazy-load / cache / aspect-ratio / placeholder / accessibility-label
requirements at the top of this section remain in force for any image that is
ever introduced.

---

# Notifications

Notifications should be:

Relevant

Actionable

Respectful

Configurable

Avoid notification fatigue.

---

# Forms

> **UX-1B2B:** the `FormField` and `FormSelect` contracts are in §Form and Input
> Contracts (UX-1B2B). Validation and transformation remain in the feature-owned
> Zod schemas — never in a UI primitive. Autofill and draft persistence have zero
> shipped implementation and are not specified by those contracts.

Forms should:

Reduce typing

Support autofill

Persist drafts

Validate instantly

Guide completion

---

# Microinteractions

Use subtle interactions for:

Success

Selection

Progress

Completion

Achievements

Navigation

Never distract the user.

---

# User Experience Principles

Every interaction should answer:

What happened?

Why?

What should I do next?

Users should never feel lost.

---

# Design Consistency

The same action should always produce the same visual response.

Consistency takes priority over novelty.

---

# Performance

Design decisions should never compromise:

Rendering

Battery

Memory

Responsiveness

Animations should remain smooth at 60 FPS.

---

# Anti-Patterns

Never

Hardcode colors

Hardcode spacing

Use inconsistent typography

Mix component styles

Create oversized dialogs

Overuse animations

Hide important actions

Depend on color alone

Ignore accessibility

---

# Design Review Checklist

Every screen must verify:

✓ Design Tokens

✓ Accessibility

✓ Responsive Layout

✓ Consistent Navigation

✓ Proper Hierarchy

✓ Empty States

✓ Loading States

✓ Error States

✓ Dark Mode

✓ Performance

✓ Native Feel

✓ Design System Compliance

## Visual-foundation additions (v1.2)

✓ Semantic roles chosen by meaning, not appearance

✓ Energy accent within the allowed/forbidden matrix, and rare

✓ Non-colour redundancy for selected / success / warning / error

✓ Contrast recorded with pass/fail in both themes

✓ Type hierarchy respected; metrics use the numeric treatment

✓ Checked in Spanish and English, at default and large text scale

✓ Spacing from the 8-point scale; grouping legible

✓ Functional motion only, with a reduced-motion equivalent

✓ Icons outlined by default, filled only when selected, never decorative

✓ No photography or exercise illustration

---

# Change Control and Slice Boundaries

## What v1.2 (UX-1B1), v1.3 (UX-1B2A), and v1.4 (UX-1B2B) authorize

Documentation only. v1.2 records the approved visual foundation; v1.3 records the
canonical state patterns and the six state-component contracts; v1.4 records the
three form and input contracts. None changes code, tokens, localization keys, or
dependencies.

## What v1.2, v1.3, and v1.4 explicitly do NOT authorize

No dependency addition, font asset, icon delivery mechanism or icon asset,
token-value change, component implementation, navigation or
information-architecture change, mockup, screen change, or any mobile / API /
schema / sync / CI / EAS / Railway / deployment change. See ADR-P022
Decision 14.

## Owner-gated decisions still open after this revision

Each requires its own authorization before any code:

1. Font delivery — Inter asset source, licence, static vs variable, weights,
   subsetting, load/splash-gate strategy, fallback stack, bundle budget, and the
   tabular-figures mechanism.
2. Material Symbols **cross-platform delivery mechanism** for React Native —
   comparing the currently supported Expo mechanisms; deciding identical Material
   Symbols everywhere versus platform-native equivalents behind a shared semantic
   mapping; whether a dependency, bundled assets, or both are needed, with a
   bundle budget; reconciling the `02_TECH_STACK.md` icon entry (its
   `@expo/vector-icons` reference is documented by Expo as deprecated / not
   recommended and does not provide Material Symbols); and an ADR / technology
   update if the chosen mechanism falls outside or supersedes the approved stack.
   The visual vocabulary itself is already approved and is not reopened.
3. Light-theme token-value remedies for the five failing pairs across four roles
   — `primary` (on `surface` and on `surfaceVariant`), `onPrimary`, `warning`,
   and `accent` (candidates in §Contrast Requirements are PROPOSED only). This
   decision also unblocks accent emphasis on primary actions, which additionally
   requires an approved, contrast-safe foreground/background pairing, **and it
   gates the selected `FormSelect` chip** (§Usage-level contrast findings). The
   two usage-level findings recorded in v1.4 are **not** part of this decision —
   they are pairing corrections, not token-value questions.
4. The dark-mode surface-tint elevation ramp.
5. Motion adoption, including easing curves and reduce-motion detection.
6. Responsive rules — breakpoints and the concrete content measure.
7. Whether small empty-state illustrations are adopted.
8. Navigation model and information architecture (the "selected navigation"
   accent role has no surface until then).
9. An in-app theme override, if ever wanted.

## Where the rest of the design system lands

UX-1B2 is delivered as three documentation slices:

- **UX-1B2A — canonical state patterns and the six state-component contracts.
  Delivered by this revision (v1.3).** The legacy state sections (Empty, Loading,
  Error) remain in force and now point to it.
- **UX-1B2B — form and input contracts** (`AppTextInput`, `FormField`,
  `FormSelect`). **Delivered by this revision (v1.4).** The legacy Inputs and
  Forms sections remain in force and now point to it. It is the direct
  prerequisite for UX-1C's first code slice.
- **UX-1B2C — reconciliation of the existing primitives** (`Screen`, `Card`,
  `AppText`, `AppButton`, `Banner`), including `Banner`'s complete contract and
  the 10-state matrix in §Component States. Not started. The component sections
  in this document (Buttons, Inputs, Cards, Lists) remain the standing v1.1
  requirements until then.
- **UX-1C** — shared component implementation against the frozen UX-1B2A/B/C
  contracts. Copy-only state forms may proceed; no action-bearing state form can
  be declared AA-complete in the light theme until the token-value decision lands
  (§Impact on the canonical state UI). UX-1C may implement the shared input
  primitives, but **migrating the seven REDUCED-family feature inputs is UX-5**
  and needs separate per-feature authorization.
- **UX-2 / UX-3** — low-fidelity flows, then high-fidelity specifications.
- **UX-4** — authentication / onboarding / dashboard pilot.
- **UX-5** — progressive feature migration.

Tracked as **FEATURE-010** in `.ai/11_BACKLOG.md`; decided by **ADR-P022** in
`.ai/12_DECISIONS.md`.

---

# AI Instructions

Every AI agent generating UI for AppFitness must strictly follow this Design System.

Never invent new styles when an existing pattern already exists.

Prioritize consistency over creativity.

Every new screen should feel as though it has always been part of the application.
