# AppFitness — Mobile Startup Performance Baseline

First measured: **2026-09-21** · Backlog: `PERF-001` · Release queue: item 12
(*"Produce performance evidence — at minimum a startup baseline on the
candidate build"*).

This is a **baseline**, not a target. No optimization was performed, and none
should be until a measurement justifies it — `PERF-001`'s last acceptance
criterion.

## What was measured, and what was not

`PERF-001` asks for four measurements. Two are recorded here directly, one is
derived, and one is **not measured** — stated plainly rather than approximated
into the table.

| Criterion | Status |
|---|---|
| Cold start measured | **Yes** — `am start -W`, ActivityManager's own instrumentation |
| SQLite initialization time measured | **Derived, not instrumented** — the first-run / steady-state difference (see below) |
| Dashboard render time measured | **No** — see *What this does not tell you* |
| Performance bottlenecks documented | **Partly** — one identified; see *Findings* |
| No optimization performed without measurements | **Yes** — nothing was changed |

## Method

`am start -W` reports `TotalTime`: the interval from the launch request to the
activity's **first frame**. It is the platform's own measurement, so it needs no
instrumentation in the app — which is why it is available on the current build
and the other two criteria are not.

Two phases, so that the one-time database cost separates from the recurring one:

- **Phase A — first-run cold start (n=5).** `pm clear` before each launch, so
  every run creates the local database and runs migrations from empty.
- **Phase B — steady-state cold start (n=10).** `pm clear` once and prime, then
  `am force-stop` before each launch, so the process is cold but the database is
  already present and migrated.

Three seconds of settle time before each measurement and two to three after.

## Environment

| | |
|---|---|
| Build | `app-release.apk`, SHA-256 `a2d9158a9dbf47bcf3f70e496ec08c323f3c4ef07be76b77425f20c343f6d545`, 117,308,521 bytes; embedded `assets/index.android.bundle` 4,996,080 bytes |
| Built from | `1f893c8` |
| Device | Android **15** (SDK 35), **x86_64** emulator (`ro.kernel.qemu=1`), AVD `appfitness-c7-a` |
| AVD resources | 4 cores, 2 GB RAM, `android-35/google_apis/x86_64` |
| GPU | `swiftshader_indirect` — **software rendering** |

### Why this APK is the candidate build

The APK predates current `main`, so the equivalence is stated rather than
assumed. Between `1f893c8` and `main` the only changes under `mobile/src` are
**two spec files**:

    mobile/src/features/dashboard/application/e2e-seed-contract.spec.ts
    mobile/src/shared/localization/maestro-flow-copy.spec.ts

No production file imports either (0 matches), and `.spec.` files are not
reachable from the Expo Router entry, so they are not in the bundle. The shipped
JavaScript is therefore unchanged. This is the same argument the gate-6 pass-2
captures used, applied to source rather than to an artifact hash — the artifact
cannot be hash-matched to `main` without a rebuild.

## Results

All values are `TotalTime`, milliseconds.

### Phase A — first-run cold start (database created, migrations run)

    4028, 2274, 2380, 2286, 2353

| | n | min | median | max | mean |
|---|---|---|---|---|---|
| All runs | 5 | 2274 | 2353 | 4028 | 2664 |
| **Excluding A1** | 4 | 2274 | **2320** | 2380 | 2323 |

**A1 (4028 ms) is the first launch after installation** and is reported
separately rather than dropped quietly: it carries one-time dex optimization and
is ~1.7× the other first-run launches. It is a real user cost — it happens once,
on the very first open after install — but it is not the first-run figure.

### Phase B — steady-state cold start (database present)

    1715, 1684, 1655, 1695, 1747, 2659, 1730, 1660, 1813, 1917

| | n | min | median | max | mean |
|---|---|---|---|---|---|
| All runs | 10 | 1655 | 1723 | 2659 | 1828 |
| **Excluding the 2659 outlier** | 9 | 1655 | **1715** | 1917 | 1735 |

The 2659 ms reading is reported, not hidden. Nine of ten runs fall in a
262 ms band (1655–1917); that one sits 742 ms above the next highest, which is
emulator scheduling noise rather than a distribution the app produces. Median is
used throughout for this reason.

### Findings

**Steady-state cold start ≈ 1.7 s; first run ≈ 2.3 s; first-ever launch ≈ 4.0 s.**

**Derived one-time database cost ≈ 605 ms** — the difference between the Phase A
and Phase B medians (2320 − 1715). It is the only bottleneck these measurements
identify, and it is paid **once per install**, not per launch. It is a
*derived* figure: it bounds the combined cost of database creation plus
migrations plus any first-run work, and it does not isolate SQLite from the rest
of that path. Calling it "SQLite initialization time" would overstate what the
method can support.

## What this does not tell you

- **It is not a device number.** A software-rendered x86_64 emulator on a
  developer host is not a phone. It may flatter the app on CPU-bound work and
  penalise it on anything GPU-bound. Treat these as a *baseline to compare
  against itself* across builds, not as a figure to quote to a user or a store.
- **`TotalTime` is time to first frame, not time to a usable dashboard.** The
  first frame may be a splash or an empty shell. The dashboard performs an async
  local read before it renders content, and that is *not* included here.
- **Dashboard render time and true SQLite initialization are unmeasured.** The
  app has no timing instrumentation — no `performance.now()` or `Date.now()`
  spans around database open, migrations or the dashboard read, and the shared
  logger emits no timing events. Measuring them means adding instrumentation to
  runtime code and rebuilding, which is a separate change and was not made for a
  measurement task.

## Reproducing

    adb install -r mobile/android/app/build/outputs/apk/release/app-release.apk

    # steady-state cold start
    adb shell am force-stop com.appfitness.mobile
    adb shell am start -W -n com.appfitness.mobile/.MainActivity

    # first-run cold start
    adb shell pm clear com.appfitness.mobile
    adb shell am start -W -n com.appfitness.mobile/.MainActivity

Read `TotalTime`. Repeat; use the median.

## Next

Closing `PERF-001` fully needs instrumentation for the dashboard read and the
database open/migrate path, and a re-measurement on **physical** hardware
(release-queue item 15 already calls for physical-device validation). Neither is
a prerequisite for the startup baseline item 12 asked for.
