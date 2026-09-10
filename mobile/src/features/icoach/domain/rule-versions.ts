/**
 * Rule versioning (.ai/07_ICOACH.md): rules are never overwritten — a
 * behavioral change to any calculation REQUIRES bumping the version here
 * and keeping historical recommendations traceable to the version that
 * produced them.
 *
 * The two families are versioned **independently** (ADR-P031 Decision 11,
 * policy V-2). They used to share one constant, which meant an assessment
 * change also restamped every weekly progress snapshot — and because
 * `progress_snapshots` is unique on `(user_id, week_start, rule_version)`,
 * that added a duplicate row per week whose values were numerically
 * identical, purely because the string changed.
 */

/**
 * The deterministic assessment engine: body composition, metabolics,
 * nutrition, training and recommendations.
 *
 * `1.2.0` adds the wellness-safety rule (ADR-P031 W-4B): a declared movement
 * becomes a `TrainingPlan.excludedMovements` entry. Minor, not major — inputs
 * and output shape are additive.
 */
export const ENGINE_RULE_VERSION = 'icoach-rules@1.2.0';

/**
 * The weekly progress-snapshot engine (`progress-analysis.ts`, ADR-P016
 * Slice 4a).
 *
 * Deliberately **frozen at the value snapshots already carry**: that engine
 * consumes no wellness data, so its outputs did not change and its stored rows
 * must keep their identity. Bump this only when a weekly-snapshot rule itself
 * changes — the uniqueness key then regenerates history without clobbering it.
 */
export const PROGRESS_SNAPSHOT_RULE_VERSION = 'icoach-rules@1.1.0';
