#!/usr/bin/env bash
# ADR-P008 — the mobile-e2e Maestro sequence, shared by CI and local runs.
#
# Run from mobile/ with the e2e APK installed, `adb reverse tcp:3001 tcp:3001`,
# the api on 127.0.0.1:3001 against a FRESH disposable database, and
# DATABASE_URL pointing at that local database (verify-email.mjs refuses any
# non-local host). The flows build on each other's state, so they run in this
# order and stop at the first failure.
#
# On failure, logcat and any tombstones are saved to $E2E_DEBUG_DIR (default
# /tmp/e2e-debug) for the workflow's debug artifact (TEST-007).
#
# Usage: e2e/run-flows.sh [first-step] [last-step]   (1-based; default: all)
set -uo pipefail

DEBUG_DIR=${E2E_DEBUG_DIR:-/tmp/e2e-debug}
M=(maestro test)
if [ -n "${MAESTRO_DEVICE:-}" ]; then M=(maestro --device "$MAESTRO_DEVICE" test); fi
PW=Password-12345

steps=(
  # Auth surface (no API needed).
  "maestro .maestro/smoke-auth-surface.yml"
  # Journey A — seeded server → device pull.
  "maestro -e E2E_EMAIL=demo@appfitness.local -e E2E_USERNAME=demo -e E2E_PASSWORD=$PW .maestro/registration.yml"
  # ADR-P041: verify on the local disposable DB, then continue into the app.
  "node e2e/verify-email.mjs demo@appfitness.local"
  "maestro .maestro/registration-verified.yml"
  "node e2e/seed.mjs"
  "maestro .maestro/dashboard-sync.yml"
  # Journey B — device-side onboarding loop, food logging, workouts, progress
  # (Phases 14–17). A distinct synthetic user keeps its device-entered data
  # separate from Journey A's server-seeded dataset.
  "maestro -e E2E_EMAIL=onboard@appfitness.local -e E2E_USERNAME=onboard -e E2E_PASSWORD=$PW .maestro/registration.yml"
  "node e2e/verify-email.mjs onboard@appfitness.local"
  "maestro .maestro/registration-verified.yml"
  "maestro -e E2E_EMAIL=onboard@appfitness.local -e E2E_PASSWORD=$PW .maestro/onboarding-loop.yml"
  "maestro .maestro/food-log.yml"
  "maestro .maestro/food-log-exclusion-warning.yml"
  "maestro .maestro/workout-training-plan.yml"
  "maestro .maestro/workout-custom-exercise.yml"
  "maestro .maestro/progress-monitoring.yml"
  # Phase 14.5 — offline data entry. Register online, then DROP the
  # adb-reverse loopback to simulate offline (airplane mode does not sever
  # it); restore it and confirm the queued change syncs.
  "maestro -e E2E_EMAIL=offline@appfitness.local -e E2E_USERNAME=offline -e E2E_PASSWORD=$PW .maestro/registration.yml"
  "node e2e/verify-email.mjs offline@appfitness.local"
  "maestro .maestro/registration-verified.yml"
  "adb reverse --remove tcp:3001"
  "maestro .maestro/offline-entry.yml"
  "adb reverse tcp:3001 tcp:3001"
  "maestro .maestro/reconnect-sync.yml"
)

capture_debug() {
  mkdir -p "$DEBUG_DIR"
  adb logcat -d -b all > "$DEBUG_DIR/logcat.txt" 2>&1 || true
  # google_apis images allow adb root; tombstones hold native crash stacks.
  if adb root >/dev/null 2>&1; then
    sleep 3
    adb wait-for-device
    adb pull /data/tombstones "$DEBUG_DIR/tombstones" >/dev/null 2>&1 || true
  fi
}

first=${1:-1}
last=${2:-${#steps[@]}}
for ((i = first; i <= last; i++)); do
  step=${steps[$((i - 1))]}
  echo "::group::step $i: $step"
  read -r -a words <<< "$step"
  if [ "${words[0]}" = maestro ]; then
    "${M[@]}" "${words[@]:1}"
  else
    "${words[@]}"
  fi
  rc=$?
  echo "::endgroup::"
  if [ $rc -ne 0 ]; then
    echo "e2e step $i failed (exit $rc): $step"
    capture_debug
    exit $rc
  fi
done
echo "e2e steps $first..$last passed"
