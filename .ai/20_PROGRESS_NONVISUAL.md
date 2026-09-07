# AppFitness Progress Chart Non-Visual Equivalent (V1)

Version: 1.1
Status: Active
Last Updated: 2026-09-07

---

# Purpose

The Progress screen renders three trend charts and a weekly snapshot summary.
This document specifies the **non-visual equivalent** for them: the information a
user must be able to obtain without relying on colour, bar height, position or
shape, and the semantics that carry it.

It is the **UX-3D** slice of the FEATURE-010 UX stream, and the last UX-3 slice.

## Implementation status

**R-1 and R-2 shipped 2026-09-04 via BUG-013** (PR #133). **R-3 through R-14
shipped 2026-09-07**, so this specification is now implemented in full. The
composition, structural and copy rules below are therefore a **contract on
shipped code**, not a forward plan; §Implementation and test contract records
what landed, including two prop-level reconciliations.

**No accessibility outcome is implied by that.** Every claim here remains
structural, and VoiceOver, TalkBack, browser-AT, large-text and physical-device
verification stay **unrun** until **UX-4C**. See §Equivalent versus outcome.

## What this document is not

- **Not an accessibility outcome.** It specifies an *equivalent*. Whether
  VoiceOver, TalkBack or a browser AT actually announces it, in what order, and
  intelligibly, is **unverified** and stays that way until **UX-4C**. See
  §Equivalent versus outcome.
- **Not implementation.** No runtime code, test, localization catalogue entry,
  asset or configuration change was authorized *by this document*. The work has
  since been authorized and built separately — see §Implementation status.
- **Not a state model change.** The eight canonical states of
  `.ai/08_UI_UX.md` §Canonical State Patterns stand unchanged; this document
  introduces no ninth.
- **Not a chart redesign.** No charting library, SVG, new dependency, new route,
  persistence model or business calculation is proposed. The visual chart is
  unchanged.
- **Not clinical.** Nothing here interprets a trend, infers a cause, or
  recommends an action. ADR-P017 keeps V1 a wellness product.
- **Not copy.** The canonical EN/ES strings live in `.ai/19_COPY_DECKS.md`. This
  document specifies **composition** — which keys assemble into which string, in
  what order, and whether it is visible, announced, or both.

---

# Evidence baseline

Every repository claim below was verified by read-only inspection of
`origin/main` at commit `d41efc69df4a48c0b0fb4f4ca2ad8884c6e648b7`.

Inspected: `TrendBars.tsx` (121 lines), `WeeklySnapshotSummary.tsx` (129 lines),
their two spec suites, `ProgressScreen.tsx`, `progress.store.ts`,
`progress/infrastructure/progress.repository.ts`, `progress.gathering.ts`,
`progress.ts` (domain), `mobile/src/shared/theme/colors.ts`, and both
localization catalogues.

| Observation | Value |
|---|---|
| Trend charts on the Progress screen | **3** — weight, muscle mass, volume |
| Charting library or SVG | **none** — `View` / `Text` only (ADR-P016 D3) |
| `progress.trends.*` keys | **8**, EN/ES parity |
| `progress.weekly.*` keys | **14**, EN/ES parity |
| Catalogue totals, EN / ES | **696 / 696** — exact parity |
| `TrendBars` spec assertions | **11** |
| `WeeklySnapshotSummary` spec assertions | **8** |
| `theme.colors.accent` usages in `mobile/src` | **1** — `TrendBars.tsx:113` |
| Chart window (`maxBars` default) | **12** most-recent points |
| Existing `accessible` wrappers in the two components | **1** — the per-bar `View` (`TrendBars.tsx:107`) |

## Platform-behaviour source

One external source constrains the structure specified here, and it is cited
rather than paraphrased from memory:

> **React Native — Accessibility**, <https://reactnative.dev/docs/accessibility>

Two documented behaviours matter:

- Marking a `View` with `accessible` makes it a **single** accessibility element
  and **groups its children**, so the children stop being separately selectable.
- The documentation warns that **nesting** accessibility elements is not
  reliably supported — on iOS, VoiceOver may not reach accessible descendants of
  an accessible ancestor.

**This document therefore specifies no accessible ancestor around elements that
must remain independently traversable.** A metric row may intentionally group
only its own non-focusable label/value text into one leaf. See §The no-nesting
rule.

---

# What the charts communicate today

## The three trend charts

All three are the same component with different data
(`ProgressScreen.tsx:186-206`). Each is `<TrendBars title data unit testID />`.

| Chart | Source | Point label | Point value | Unit | Period |
|---|---|---|---|---|---|
| Weight | `bodyWeights` | `w.date` | `w.weightKg` | ` kg` | one reading per **day** |
| Muscle mass | `bodyMeasurements`, `muscleMassKg !== null` | `m.date` | `m.muscleMassKg` | ` kg` | one reading per **day** |
| Volume | `snapshots`, `totalVolumeKg !== null` | `s.weekStart` | `s.totalVolumeKg` | ` kg` | one value per **week** |

`ProgressScreen.tsx:103-117` builds all three by `.map().reverse()`, because the
store holds every list **newest-first** (`ORDER BY date DESC` /
`week_start DESC` — `progress/infrastructure/progress.repository.ts:116`, `:351`,
`:526`). Charts therefore read **oldest → newest, left to right**.

### What the visual encoding carries

| Visual channel | Meaning | Already available as text? |
|---|---|---|
| Bar **height** | value, min-normalized across the visible window (`TrendBars.tsx:104-106`) | Partly — only latest, min and max appear in the summary |
| Bar **horizontal position** | chronological order, oldest at the left | **No** |
| Bar **colour** — `accent` vs `primary` | which bar is the latest (`TrendBars.tsx:113`) | Yes — the summary names the latest value |
| **Count** of bars | how many readings are shown | **No** |
| Absence of bars | fewer than two points | Yes — `noData` / `oneReading` |

### The text summary that already exists

`TrendBars` is explicitly **not** visual-only. Above the bars it always renders
(`TrendBars.tsx:83-86`):

```
{Latest} {value}{unit} · {range} {min}–{max}{unit} · {direction} {|delta|}{unit}
```

from `progress.trends.latest`, `.range`, and one of `.directionUp` /
`.directionDown` / `.directionFlat`. `direction` compares the **first and last
visible points** (`TrendBars.tsx:75-78`), not adjacent points, so it is a net
change across the window, never a claim about trajectory.

Each bar additionally carries `accessible` plus
`accessibilityLabel={`${p.label}: ${value}${unit}`}` (`TrendBars.tsx:107-109`).

**So a partial non-visual equivalent is already SHIPPED.** UX-3D closes the gaps
below rather than starting from nothing.

## The weekly snapshot summary

`WeeklySnapshotSummary` is **text-first**: it carries no visual-only encoding.
It renders the latest week's five metrics as label/value rows, `—` for nulls, the
deload flag as **text** (`Yes` / `No`, never colour), and up to four earlier
weeks as sentences. Dates use `formatDate` in the active language
(`WeeklySnapshotSummary.tsx:44-46`).

**It needs no separate alternative rendering — but it is not semantically
complete.** Three refinements are required, specified in §Weekly snapshot
semantics:

1. A metric row whose value is `—` must not announce as "dash". `—` is a visual
   convention for *not recorded*; it needs localized semantics of its own.
2. The earlier-weeks list runs **newest-first**, the reverse of the trend charts,
   and nothing says so.
3. Each metric row should be one focus stop announcing label then value, which
   requires marking the **rows** accessible — never a parent around them.

## Empty, error and loading behaviour

The charts have no states of their own. They are rendered only inside the
Progress screen's ready arm, so Loading, Error and Web unavailable belong to
surface 10 in `.ai/18_SCREEN_STATE_MATRICES.md`. Within the ready arm:

| Series condition | Rendered | Key |
|---|---|---|
| 0 points | title + muted text, **no bars** | `progress.trends.noData` |
| 1 point | title + `1 reading: {value}{unit}`, **no bars** | `progress.trends.oneReading` |
| ≥2 points | title + summary + bars | — |
| ≥2 points, all equal | bars all full height (`range === 0` → `frac = 1`) | direction `flat` |

These are **content conditions inside the ready state**, not canonical states.
The empty series is not the canonical **Empty** state: the Progress screen's
Empty is `progress.screen.noWeight` at screen level.

## Platform

The two components use only `View`, `Text` and theme tokens, so the **component
contract is platform-neutral** — nothing in it is conditioned on `Platform.OS`,
and nothing should be.

The **product path is native-only**, for a separate reason: on Web the Progress
screen returns the terminal Web-unavailable state before any chart mounts
(ADR-P019; surface 10). So in public V1 no user reaches these charts on Web.

Those two statements are kept apart deliberately. The contract not branching by
platform is **not** a claim that the equivalent has been exercised on Web; it has
not been exercised anywhere.

---

# Findings

Two, both verifiable at `d41efc69`.

## F-1 — the per-point accessible label exposed a raw ISO date

**Fixed 2026-09-04 by BUG-013**; this section records the finding as audited.
At that audit `ProgressScreen.tsx:104`, `:108`, `:113` passed the stored
`YYYY-MM-DD` string straight through as `TrendPoint.label`, and
`TrendBars.tsx:108` rendered it verbatim inside the per-bar
`accessibilityLabel`. Point labels are now localized and weekly-volume points
carry the `weekOf` prefix, satisfying **R-1** and **R-2**. **R-3 through R-14
landed 2026-09-07** (§Implementation status), so no requirement in this
specification is outstanding.

Every other date on the screen is localized: the latest-weight line and
`WeeklySnapshotSummary` both call `formatDate` with the active language. The bar
label is the **only** date on the Progress surface exposed in raw storage format,
and it is exposed on a path that only assistive-technology users reach.

For the volume chart the same label is a **week start** presented as if it were a
point date, with nothing saying so.

Tracked as **BUG-013**. Fixing it is a precondition of this specification, not
part of it.

## F-2 — the `accent` role is in use, on this chart

`theme.colors.accent` has exactly **one** consumer in `mobile/src`:
`TrendBars.tsx:113`, which fills the latest bar with `accent` instead of
`primary`.

`.ai/12_DECISIONS.md` **ADR-P027** Consequences stated that the `accent` role
"remains unused". That clause is factually wrong at this commit and is corrected
there. `.ai/08_UI_UX.md:742` records `accent #00A6A6` on `surface #FFFFFF` at
**2.998 : 1 — FAIL at 4.5 and below the 3:1 non-text threshold**.

**What this document does and does not conclude.** It records the usage and
corrects the ADR's factual clause. It does **not** rule on whether this specific
usage requires 3:1 — the latest value is independently available in the summary
text, so the accent fill may be redundant rather than load-bearing, and deciding
that is part of ADR-P022's already-open accent question. **No new ADR is
required**; the decision gate already exists, and **ADR-P027's navigation
decision is unchanged** — hub-and-spoke retained, bottom tabs deferred.

The equivalent below removes any dependence on that colour distinction
regardless, by naming the latest point in text.

---

# The gaps UX-3D closes

Measured against the visual channels above, four pieces of information have no
non-visual carrier today:

| # | Missing information | Consequence without it |
|---|---|---|
| G-1 | **Ordering** — that points run oldest → newest | A user reading points one by one cannot know the direction of time |
| G-2 | **Count and window** — how many points are shown, and that older ones are dropped at 12 | `range` and `direction` describe a windowed subset while sounding absolute |
| G-3 | **Period type** — daily reading vs week-starting value | The volume chart's weeks read as days |
| G-4 | **Series identity at point level** — which chart a point belongs to | Three charts sit in one card; focusing a bar in isolation gives a date and a number in kilograms that could belong to any of them |

G-2 is the one that can mislead rather than merely omit, and it misleads
**sighted users too**: the screen reports the **full** entry count
(`progress.screen.weightEntryOne` / `…Many`) while the summary describes at most
the last **12** points, with nothing marking the difference. Its remedy is
therefore visible text, not an accessibility-only affordance — see §Window
honesty.

---

# The no-nesting rule

This rule governs every structural decision below and is stated once.

**No container that owns separately traversable descendants is marked
`accessible` or given an `accessibilityLabel`.** Per the React Native
accessibility documentation cited above, an accessible `View` groups its
children into one element and stops them being separately selectable, and
nesting accessibility elements is not reliably supported — VoiceOver may never
reach an accessible descendant of an accessible ancestor.

`MetricRow` is the deliberate exception in shape, not in rule: the row becomes
one accessible **leaf** whose label/value `Text` children are intentionally
combined and are explicitly `accessible={false}` so they are not separate focus
targets. It has no accessible ancestor and contains no descendant that must
remain independently selectable.

**An `accessibilityLabel` alone is enough to break the rule.** It makes the
container a named accessibility element competing with its leaves for the
accessible name, whether or not `accessible` is also set — so the rule bars both
props above an intended focus target, not just `accessible`.

Concretely, the specification **must not**:

- mark the bar row accessible while its bars stay individually accessible;
- mark the latest-week block accessible while its metric rows stay individually
  accessible;
- wrap the earlier-weeks list in an accessible container;
- leave an `accessibilityLabel` on any wrapper above a bar or a metric row —
  including the `Card`s the Progress screen puts around the two components
  (§The two wrapper labels).

Instead, meaning is carried by **document order** plus **ordinary text elements**
that are themselves in the traversal order, and by intentional accessible
leaves (individual bars and metric rows). Text that a screen reader must convey
is **visible text**, which is also the reason G-2's remedy works for everyone.

**No platform "group" is promised.** If a future slice wants an actual grouping
role — `accessibilityRole="summary"`, an iOS container, or anything else — it
must demonstrate that descendant traversal is preserved and record a manual
verification result. Until then, grouping is not part of this contract.

---

# Specification — trend series

## Structure

Each `TrendBars` instance renders, in document order, with **no accessible
wrapper at any level**:

| # | Element | Accessible? | Visible? |
|---|---|---|---|
| 1 | Series title — the existing `title` prop | default text | yes |
| 2 | **Series descriptor** — new line | default text | **yes** |
| 3 | Summary — the existing latest / range / direction line | default text | yes |
| 4 | **Window notice** — new line, conditional | default text | **yes** |
| 5 | Bar row | **not accessible**, no label — plain layout `View` | yes |
| 6 | Each bar | `accessible` + `accessibilityLabel` — unchanged pattern | yes |

Elements 1–4 are ordinary `AppText`. A screen reader reaches them because they
are text in the traversal order, not because anything groups them. Reading and
focus order is document order, which already matches oldest → newest for the
bars. No custom focus management, no `accessibilityViewIsModal`, no reordering.

## Series descriptor — element 2

Visible and announced, identical text:

```
{title} · {n} {progress.trends.readingOne | readingMany} · {progress.trends.orderOldestFirst}
```

`{n}` is the number of **shown** points via `formatNumber`. `{title}` is the
resolved series title, so the descriptor names the series even when read alone.

Rendered below two points, the descriptor does **not** render: the existing
`progress.trends.noData` / `progress.trends.oneReading` text already states the
condition, and a descriptor would add a count to a series that has no trend.

## Point label — element 6

Replaces `${label}: ${value}${unit}`. **Every point label begins with the
resolved series title**, closing G-4:

| Chart | Announced label shape |
|---|---|
| Weight, Muscle mass | `{title}, {localized date}: {value}{unit}` |
| Volume | `{title}, {progress.weekly.weekOf} {localized week-start date}: {value}{unit}` |
| Latest point, any chart | the above, then ` · {progress.trends.latestMarker}` |

- **Series identity is not optional and not inherited.** Because no accessible
  ancestor exists, a focused bar carries its own full identity or none at all.
- **Date format** is resolved by `ProgressScreen` before it passes each
  `TrendPoint`: `formatDate(parseLocalDate(iso), language, { year: 'numeric', month: 'short', day: 'numeric' })` — the exact call
  `WeeklySnapshotSummary.tsx:44-46` and `ProgressScreen.tsx:148-152` already use.
  `TrendBars` consumes the display-ready localized `label`; it does not import
  its parent screen or duplicate the calendar-date parser. Parsing stays
  `parseLocalDate`, so no UTC day shift is introduced (ADR-P016 D6).
- **Values** keep `formatNumber(value, language)`; the caller-supplied `unit`
  string is unchanged.
- `progress.weekly.weekOf` is **reused**, not duplicated — it already reads
  "Week of" / "Semana del".
- The latest marker is **additive text**. It does not replace the accent fill and
  makes no claim about it; it removes the need to perceive it.

## Window honesty — element 4

**Whenever the pre-window series is longer than the shown count, a visible line
renders below the summary**, announced identically because it is ordinary text
(the comparison is `data.length > points.length` — §Prop reconciliation):

```
{progress.trends.windowNotice}
```

It renders **only** when the series is actually truncated, so an unqualified
reading stays unqualified when the series is in fact complete.

Two consequences the implementation must honour:

1. **`range` and `direction` describe the visible window, always.** The summary
   is unchanged in wording, but the window notice beneath it is what qualifies
   it. When the notice is absent, the window is the whole series and the summary
   needs no qualifier.
2. **The count belongs to the descriptor, the truncation to the notice.** The
   descriptor says how many are shown; the notice says that more exist. Neither
   restates the other, and neither invents a total — no "12 of 47" is specified,
   because the pre-window total is available but the *dropped* rows are not
   otherwise surfaced anywhere on the screen.

## Units and values

Units are announced exactly as rendered: the caller passes ` kg` for all three
charts today. The specification adds **no** unit conversion, rounding change or
derived statistic. `range` remains min–max of the visible window; `direction` and
delta remain first-versus-last of the visible window. Nothing is inferred.

## Dynamic updates

Progress data changes only in response to an explicit user action — adding,
editing or deleting an entry, or pressing *Update weekly insights*
(`progress-recompute`). Those already re-render the whole ready arm.

**No live region and no imperative announcement is specified.** Adding one would
make every re-render speak, and `.ai/08_UI_UX.md` records **zero**
`accessibilityLiveRegion` / `announceForAccessibility` occurrences in the
codebase — introducing the first one on a chart is not this slice's call. Change
feedback belongs to the surrounding save/error states, which
`.ai/18_SCREEN_STATE_MATRICES.md` surface 10 already specifies.

## Maximum Spanish text scale

The equivalent is text, so it inherits the existing constraints rather than
creating new ones:

- `AppText` sets `allowFontScaling`, and **no consumer overrides it**
  (`.ai/08_UI_UX.md` §AppText). The descriptor, summary and window notice must
  remain plain `AppText`, so OS text scaling continues to apply.
- **No fixed height on any text-bearing container.** `CHART_HEIGHT = 64` bounds
  the **bar row only** and must not be extended to elements 1–4.
- ES budget: `.ai/08_UI_UX.md` records a mean **+33.9 %** ES/EN length delta. The
  longest strings here are the descriptor and the window notice, both of which
  must **wrap, never truncate and never clip**. No single-line assumption, no
  `numberOfLines`, no ellipsis.
- Adding two visible lines above the bars increases card height at large text
  sizes. That is accepted: the alternative is information only some users get.

---

# Specification — weekly snapshot semantics

Three refinements, none of which adds an alternative rendering and none of which
introduces an accessible parent.

## 1. Latest-week block

The week heading stays an ordinary text element reading
`{progress.weekly.weekOf} {localized week start}`. **The block around it is not
marked accessible.**

Each `MetricRow` becomes **one accessible leaf element** — the row itself, with
no accessible ancestor — intentionally combining its two text children and
announcing label then value. Those children are marked `accessible={false}`
**explicitly**, because React Native `Text` is an accessibility element by
default: left implicit, the row would be an accessible, labelled parent of two
further named elements, which is the nesting this document forbids. "Non-focusable"
is therefore a stated prop, not an assumption:

```
{metric label}, {value}
```

where `{value}` is the rendered value **except when the underlying value is
`null`**, in which case the announced value is `progress.weekly.notRecorded`.

**The visible `—` is unchanged.** It is a compact visual convention; the
accessible value is the localized phrase, because "dash" carries no meaning and
"zero", "none" or "unknown" would each be an invention. `—` means *not recorded*,
and that is what it must say.

The deload flag is unaffected: it already renders `progress.weekly.yes` /
`progress.weekly.no` as text, never colour, and is **informational**, never an
instruction (`.ai/17_PRODUCT_FLOWS.md` §Flow 7).

## 2. Earlier-weeks ordering

The earlier-weeks list is **newest-first** — the reverse of the trend charts —
because the store returns `week_start DESC` and the component does not reverse it
(`WeeklySnapshotSummary.tsx:88-90`). That inversion is real, and a user moving
between the charts and this list must not assume one order carries over.

The existing heading gains the order, as **visible** text:

```
{progress.weekly.earlierWeeks} · {progress.weekly.newestFirst}
```

`progress.weekly.earlierWeeks` is SHIPPED and unchanged; only the suffix is new.

## 3. No accessible parent

Neither the latest-week block, nor the earlier-weeks list, nor the component root
is marked accessible. The individual metric rows are the accessible elements; the
headings are ordinary text in the traversal order.

---

# Proposed copy

**Seven keys.** Canonical EN/ES values live in `.ai/19_COPY_DECKS.md` §Progress —
this document owns composition, that one owns wording.

| Key | Purpose | Visible? |
|---|---|---|
| `progress.trends.orderOldestFirst` | States oldest → newest ordering in the descriptor (G-1) | yes |
| `progress.trends.readingOne` | Singular count noun (G-2) | yes |
| `progress.trends.readingMany` | Plural count noun (G-2) | yes |
| `progress.trends.windowNotice` | States that older readings are not shown (G-2) | **yes** |
| `progress.trends.latestMarker` | Marks the latest point in text — removes accent dependence | announced only, inside the bar label |
| `progress.weekly.notRecorded` | Accessible value for a `null` metric, where `—` is shown | announced only |
| `progress.weekly.newestFirst` | States the earlier-weeks order | yes |

All seven are now **SHIPPED** in both catalogues with EN/ES parity, at the exact
values `.ai/19_COPY_DECKS.md` §Progress worded for them (they were **PROPOSED**
and absent from the 696-key catalogues when this document was written).
`progress.weekly.weekOf` and `progress.weekly.earlierWeeks` are **reused** and
stay **SHIPPED**. No key is renamed, re-scoped or removed.

**Three keys from an earlier draft of this slice were dropped rather than
carried as dead copy**, because the no-nesting rule removed their reason to
exist: a series-group label, a summary-line label, and a no-trend descriptor
replacement. Without accessible wrappers there is nothing to name, and the
existing `noData` / `oneReading` text already covers the below-two-points case.

---

# Implementation and test contract (for UX-4)

Written as a specification; **now a record of what shipped** (§Implementation
status). This document still authorizes nothing on its own.

## Component boundaries

**No new component and no new dependency.** The equivalent is delivered by
extending the two existing presentational components:

| Component | Change | Why not a new component |
|---|---|---|
| `TrendBars` | The descriptor line, the window-notice line, the series-title prefix and the latest marker on the caller-resolved point label. **No new prop** — see §Prop reconciliation | It already owns the summary and per-bar labels; splitting would duplicate the windowing logic |
| `WeeklySnapshotSummary` | Accessible metric rows, the `notRecorded` accessible value, and the order suffix on the earlier-weeks heading | Already text-first |
| `ProgressScreen` | Keeps the BUG-013 date formatting and the `weekOf` prefix unchanged, and **drops the `accessibilityLabel` from the Trends and Weekly `Card` wrappers** so no labelled ancestor sits above a bar or a metric row | It already owns the raw series, active language and their ordering; `TrendBars` must not duplicate or import the screen's date parser. The wrapper labels are the screen's own, so only the screen can remove them |

Both components stay **pure and presentational**: no store access, no SQLite, no
repository call, no business calculation — the caller supplies resolved points,
exactly as today (`.ai/06_MOBILE.md` §Screen Principles). **R-14** guards it.

### The two wrapper labels

The no-nesting rule names the containers *inside* the two components, but the
`Card`s the screen wraps them in were carrying `accessibilityLabel={t('progress.screen.trends')}`
and `…weekly`. A labelled ancestor is a named accessibility element competing
with the leaves beneath it for the accessible name, which is the same failure
mode the rule exists to prevent — so both labels are **removed**. Nothing is
lost: each `Card` already renders that exact string as a visible
`AppText variant="title"`, which is ordinary text in the traversal order.

Two boundaries held while doing it:

- **The Latest card keeps its label.** `progress.screen.latestAccessibility`
  wraps no independently traversable leaf, so the rule does not reach it.
- **The shared `Card` primitive is unchanged.** It never sets `accessible`; it
  only forwards the props it is given, so this is a call-site correction, not a
  design-system change.

**R-12** now walks **every** ancestor of every leaf and requires both
`accessible !== true` **and** `accessibilityLabel === undefined`, so a wrapper
label cannot return unnoticed.

## Expected data mapping

| Prop | Source | Note |
|---|---|---|
| `data` | the existing `.map().reverse()` of the newest-first store list, with each raw stored date converted to the display-ready localized `label` during the presentation mapping | values and ordering stay unchanged; date formatting remains presentation-only |
| `title` | unchanged — already passed | now also prefixes every point label |
| `unit` | unchanged — ` kg` for all three | no conversion |

## Prop reconciliation

An earlier revision of this section specified two new `TrendBars` props,
`totalCount: number` and `period: 'day' | 'week'`. **Neither shipped**, because
repository evidence made each a redundant second source of truth for a value the
code already holds. The **behaviour** both were specified to produce is
unchanged and is asserted by **R-2** and **R-6**.

| Prop | Why it was dropped |
|---|---|
| `totalCount` | `TrendBars` owns the windowing (`data.slice(-maxBars)`), so `data.length` **is** the pre-window length this section named as its source — the filtered series the caller maps. A prop that must always equal `data.length` could only ever disagree with it, and a disagreement would render a dishonest notice. The notice therefore compares `data.length` to the shown count. |
| `period` | Its only stated job was driving the `weekOf` prefix, and **BUG-013 already resolves that prefix at the mapping site** in `ProgressScreen`, before the label reaches the chart — the same place this section requires the localized date to be resolved. Adding the prop would either duplicate the prefix or move shipped R-2 behaviour for no gain. |

Both would have re-entered `.ai/03_CODING_STANDARDS.md`'s "no unnecessary
abstractions" and "no duplicated business logic" rules. Any future caller that
pre-windows `data` itself must reintroduce `totalCount` rather than let the
notice go quiet.

## Regression assertions

Additive to the existing 11 + 8; none of those may be weakened
(`.ai/09_TESTING.md` §Testing Principles).

**All fourteen now carry coverage** across `TrendBars.spec.tsx` (27 tests),
`WeeklySnapshotSummary.spec.tsx` (21) and `ProgressScreen.spec.tsx` (40) — 88 in
total, in **EN and ES**. Reverting all three implementation files while keeping
the specs fails **39** of them, so none passes vacuously. Two of the guards are
individually load-bearing: restoring either `Card` wrapper label, or dropping the
explicit `accessible={false}` from the metric-row children, each fails on its
own. The existing point-label assertions were made **stricter**, not weakened:
they now pin the series title and the latest marker alongside the localized date
they already pinned.

| # | Assertion |
|---|---|
| R-1 | `ProgressScreen` maps each raw stored date to a **localized** point label, not `YYYY-MM-DD`, asserted in EN and ES; `TrendBars` consumes that resolved label (closes BUG-013) |
| R-2 | For the weekly-volume series, the point label is prefixed with `progress.weekly.weekOf`, resolved **by the caller** into `TrendPoint.label` alongside the localized week-start date. There is no `period` prop — §Prop reconciliation |
| R-3 | **Every** point label begins with the resolved series title; two charts rendered together produce labels distinguishable by title alone (G-4) |
| R-4 | The latest point's label ends with `progress.trends.latestMarker`; no other point's does |
| R-5 | The series descriptor renders as **visible** text stating the shown count with correct one/many grammar and the ordering, in EN and ES |
| R-6 | `progress.trends.windowNotice` renders as **visible** text when `data.length > points.length`, and is **absent** when they are equal |
| R-7 | With 0 or 1 points, neither the descriptor nor the window notice renders; the existing `noData` / `oneReading` text stands |
| R-8 | Point order in the rendered tree is oldest → newest |
| R-9 | The `max === min` series still renders bars and announces `directionFlat` — existing behaviour preserved |
| R-10 | A weekly metric row with a `null` value shows `—` **and** announces `progress.weekly.notRecorded`; the two differ deliberately |
| R-11 | The earlier-weeks heading renders `progress.weekly.newestFirst` as visible text, and the listed weeks are in that order |
| R-12 | **No container swallows an intended focus target.** Asserted by walking **every** ancestor of every bar and metric row on the assembled screen — the screen's `Card` wrappers included — and requiring both `accessible !== true` **and** `accessibilityLabel === undefined`. The bar row, latest-week block, earlier-weeks list and both component roots satisfy it; individual bars remain separate leaves, while each metric row is one intentional accessible leaf whose two `Text` children are **explicitly** `accessible={false}`, since React Native `Text` is otherwise an accessibility element by default |
| R-13 | No `accessibilityLiveRegion` or `announceForAccessibility` is introduced |
| R-14 | No component reads a store, repository or SQLite — the existing "never accesses SQLite directly" spec pattern extended to the charts |

R-12 is the regression that protects the no-nesting rule from being undone by a
later refactor that "tidies up" the tree.

## Manual verification matrix — UX-4C

Component tests prove **structure**, never announcement
(`.ai/09_TESTING.md` §Accessibility Testing; ADR-P023 / ADR-P024). Each cell is
recorded pass/fail with the device, OS version and AT version.

| Case | VoiceOver (iOS) | TalkBack (Android) | Browser AT |
|---|---|---|---|
| Descriptor and window notice reached in document order | ☐ | ☐ | n/a |
| **Every bar is individually reachable** — no ancestor swallows them | ☐ | ☐ | n/a |
| A focused bar announces series title, date and value | ☐ | ☐ | n/a |
| Latest point distinguishable **without** colour | ☐ | ☐ | n/a |
| Week-period labels distinguishable from day labels | ☐ | ☐ | n/a |
| Window notice reached when the series is truncated | ☐ | ☐ | n/a |
| 0-point and 1-point series announce no trend and no count | ☐ | ☐ | n/a |
| **Every metric row is individually reachable**, announcing label then value | ☐ | ☐ | n/a |
| A `null` metric announces "not recorded", not "dash" | ☐ | ☐ | n/a |
| Earlier-weeks order stated and correct | ☐ | ☐ | n/a |
| ES at maximum OS text size: no clipping or truncation | ☐ | ☐ | n/a |
| EN at maximum OS text size: no clipping or truncation | ☐ | ☐ | n/a |

**The Browser-AT column is `n/a` for the product path**, because the Progress
screen never reaches its ready arm on Web (ADR-P019) — so there is nothing to
verify there in public V1. That is a statement about reachability, **not** a
claim that the equivalent works on Web or has been tried there.

---

# Equivalent versus outcome

This distinction is the point of the slice, so it is stated plainly.

- An **equivalent** is a structural property: the same meaningful information is
  available through a non-visual channel. That is what this document specifies,
  and a component test can verify it.
- An **outcome** is what a real user with a real assistive technology perceives.
  Nothing here establishes one.

Therefore: **no accessibility outcome may be claimed on the strength of this
document, or of any test written against it.** Announcement, traversal order,
intelligibility, and large-text and visual results remain **unverified** until
the **UX-4C** manual pass runs and is recorded per surface. ADR-P023 leaves
programmatic `required` / `invalid` unsolved on native; ADR-P024 leaves error
announcement unproven on every platform. Neither is changed here.

In particular, the no-nesting rule is a **risk-reduction** measure taken from
documented platform behaviour. It makes the unsafe pattern impossible; it does
not prove the safe one works.

---

# Preserved boundaries

| Boundary | Status |
|---|---|
| Eight canonical states | Unchanged; no ninth introduced |
| ADR-P016 D3 — no charting library or SVG | Preserved; the equivalent is text |
| ADR-P016 D5 — feed-not-override | Preserved; charts stay read-only projections |
| ADR-P016 D6 — no UTC day shift | Preserved; `parseLocalDate` retained |
| ADR-P017 — wellness, not medical | Preserved; no interpretation, no instruction |
| ADR-P019 — Web terminal-unavailable | Preserved; no platform branch added |
| ADR-P022 — accent question | **Still open**; see F-2. No new ADR required |
| ADR-P027 — navigation decision | **Unchanged**; only its factual accent clause is corrected |
| Business calculations | Untouched — no new statistic, no rounding change |

---

# Unresolved risks

1. **Two extra visible lines per chart.** The descriptor and the conditional
   window notice add height to a card that already holds three charts, most
   sharply at maximum text size in Spanish. Accepted deliberately: the
   alternative is information only some users receive.
2. **The accent decision is still open** (F-2), and the chart is now known to
   depend on it visually. The equivalent removes the *non-visual* dependence, not
   the visual contrast question.
3. **No announcement mechanism exists anywhere in the codebase** — zero live
   regions, zero imperative announcements. This document deliberately does not
   introduce the first one, so state changes on Progress stay silent to AT by
   default. Whether that is acceptable is a UX-4C finding, not a UX-3D claim.
4. **Per-bar traversal at 12 points is verbose.** Twelve focus stops per chart,
   three charts, each label now longer because it carries the series title. No
   summarization or skip affordance is specified, because every mechanism for one
   is a grouping mechanism — exactly what the no-nesting rule excludes until
   traversal is verified. UX-4C should record whether verbosity is a real problem
   before anything is added.
5. **Muscle mass has no dedicated empty copy.** A user with weights but no
   muscle-mass measurements sees `progress.trends.noData` under a
   `progress.trends.muscleMass` title, which is correct but terse. Out of scope
   here; a candidate for UX-4 polish.
6. **Nothing is verified with a real screen reader.** Every claim in this
   document is structural.

---

# Related documents

- `.ai/08_UI_UX.md` — canonical states, contrast evidence, `AppText` and dynamic
  type, bilingual layout safety.
- `.ai/09_TESTING.md` — §Accessibility Testing and the regression rules the test
  contract inherits.
- `.ai/17_PRODUCT_FLOWS.md` — §Flow 7, which named this equivalent as UX-3 work.
- `.ai/18_SCREEN_STATE_MATRICES.md` — surface 10 (Progress) and surface 4 (the
  dashboard summary card); the charts render only inside surface 10's ready arm.
- `.ai/19_COPY_DECKS.md` — canonical EN/ES values for the seven proposed keys.
- `.ai/11_BACKLOG.md` — FEATURE-010 UX stream; UX-3D and **BUG-013**.
- `.ai/12_DECISIONS.md` — ADR-P016, ADR-P017, ADR-P019, ADR-P022, ADR-P023,
  ADR-P024, ADR-P027.
- **React Native — Accessibility**, <https://reactnative.dev/docs/accessibility>
  — the grouping and nesting behaviour that the no-nesting rule follows.

---

# AI Instructions

Read this file before changing anything that renders Progress trends.

## 1. Never swallow an intended focus target

No component root, bar row, latest-week block, earlier-weeks list **or screen-level
`Card` wrapper** may be marked `accessible` or given an `accessibilityLabel`.
The label alone is disqualifying, not only `accessible`. Individual bars remain
separate leaves; each metric row is one intentional accessible leaf whose
label/value `Text` children are explicitly `accessible={false}`, because
React Native `Text` is otherwise an accessibility element by default. Everything
else is ordinary text in document order. A broader grouping role may be
introduced only with evidence that descendant traversal survives it, plus a
recorded manual verification.

Do not "restore" a wrapper label for tidiness. Each wrapper's meaning is already
a visible title inside it, and **R-12** walks every ancestor of every leaf on the
assembled screen and fails on either prop.

## 2. An equivalent is not an outcome

Never report an accessibility result on the strength of this document or a test
written against it. Structure is verifiable; announcement is not, until UX-4C.

## 3. Do not interpret the data

The equivalent reports values, dates, units, ordering and net change. It must not
characterise a trend as good, bad, expected, concerning or on-track, and must not
recommend an action. ADR-P017 governs.

## 4. Keep the window honest, visibly

Any statement about range or direction describes the **visible window**. When the
series is longer than the window, the window notice renders as **visible** text —
truncation misleads sighted users too, so its remedy is never accessibility-only.

## 5. Text carries the meaning; colour never does alone

Every distinction the chart makes visually — including which point is latest —
must exist in text. Do not reintroduce a colour-only, height-only or
position-only signal. Every point label carries its own series identity, because
no ancestor supplies it.

## 6. No new mechanism without its own authorization

No charting library, SVG, live region, imperative announcement, accessibility
grouping, route, dependency, persistence model or business calculation. If one
seems necessary, stop and raise it — do not add it under this document.
