import {
  MAX_LOAD_STEP,
  PLAN_GENERATION_TRIGGERS,
  type PlanGenerationTrigger,
} from './weekly-plan.types';

/**
 * `weekly_plans` payload validation (ADR-P042). Only client-controlled fields
 * are read; server-controlled columns (version, sync_seq, timestamps, user_id)
 * are never trusted. Wire fields are snake_case and match the mobile SQLite
 * row, where the three JSON columns travel as JSON strings.
 *
 * The plan content is the engine's own output, so it is checked for shape and
 * size, not re-derived. Free text is not part of it: notes are reason codes.
 */

/** Upper bound on one stored plan revision, as serialized JSON. */
export const MAX_PLAN_JSON_BYTES = 256 * 1024;

function requireCalendarDate(value: unknown, field: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} must be a YYYY-MM-DD calendar date`);
  }
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new Error(`${field} must be a valid calendar date`);
  }
  return d;
}

function requireInteger(
  value: unknown,
  field: string,
  min: number,
  max: number,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new Error(`${field} must be an integer between ${min} and ${max}`);
  }
  return value;
}

/** A JSON column arrives as a JSON string (SQLite TEXT) or as the value itself. */
function jsonValue(value: unknown, field: string): unknown {
  if (typeof value !== 'string') return value;
  if (value.length > MAX_PLAN_JSON_BYTES)
    throw new Error(`${field} is too large`);
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`${field} must be valid JSON`);
  }
}

function requireObject(value: unknown, field: string): Record<string, unknown> {
  const parsed = jsonValue(value, field);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${field} must be a JSON object`);
  }
  if (JSON.stringify(parsed).length > MAX_PLAN_JSON_BYTES)
    throw new Error(`${field} is too large`);
  return parsed as Record<string, unknown>;
}

function requireRuleVersions(value: unknown): Record<string, string> {
  const versions = requireObject(value, 'rule_versions');
  for (const [key, version] of Object.entries(versions)) {
    if (
      typeof version !== 'string' ||
      version.length === 0 ||
      version.length > 64
    ) {
      throw new Error(`rule_versions.${key} must be a version string`);
    }
  }
  return versions as Record<string, string>;
}

/** Notes are reason codes with optional scalar parameters — never free text. */
function requireNotes(value: unknown): unknown[] {
  const parsed = jsonValue(value ?? '[]', 'notes');
  if (!Array.isArray(parsed) || parsed.length > 64)
    throw new Error('notes must be a short array');
  for (const note of parsed) {
    const ok =
      typeof note === 'object' &&
      note !== null &&
      typeof (note as { code?: unknown }).code === 'string' &&
      /^[a-z][a-zA-Z0-9.]{0,80}$/.test((note as { code: string }).code);
    if (!ok) throw new Error('notes must be reason codes');
    const params = (note as { params?: unknown }).params;
    if (params !== undefined) {
      if (
        typeof params !== 'object' ||
        params === null ||
        Array.isArray(params)
      ) {
        throw new Error('note params must be an object');
      }
      for (const v of Object.values(params)) {
        if (
          typeof v !== 'number' &&
          !(typeof v === 'string' && v.length <= 64)
        ) {
          throw new Error('note params must be short scalars');
        }
      }
    }
  }
  return parsed;
}

function requirePlan(value: unknown): Record<string, unknown> {
  const plan = requireObject(value, 'plan');
  if (!Array.isArray(plan.days) || plan.days.length !== 7) {
    throw new Error('plan.days must hold the 7 days of the week');
  }
  if (typeof plan.targets !== 'object' || plan.targets === null) {
    throw new Error('plan.targets is required');
  }
  return plan;
}

export interface WeeklyPlanCreateInput {
  weekStart: Date;
  revision: number;
  effectiveFrom: Date;
  generationTrigger: PlanGenerationTrigger;
  loadStep: number;
  inputsFingerprint: string;
  ruleVersions: Record<string, string>;
  plan: Record<string, unknown>;
  notes: unknown[];
}

export function parseWeeklyPlanCreate(
  p: Record<string, unknown>,
): WeeklyPlanCreateInput {
  const weekStart = requireCalendarDate(p.week_start, 'week_start');
  if (weekStart.getUTCDay() !== 1)
    throw new Error('week_start must be a Monday');
  const effectiveFrom = requireCalendarDate(p.effective_from, 'effective_from');
  const offsetDays =
    (effectiveFrom.getTime() - weekStart.getTime()) / 86_400_000;
  if (offsetDays < 0 || offsetDays > 6) {
    throw new Error('effective_from must fall within its week');
  }
  const trigger = p.generation_trigger;
  if (!PLAN_GENERATION_TRIGGERS.includes(trigger as PlanGenerationTrigger)) {
    throw new Error('generation_trigger is not a known trigger');
  }
  const fingerprint = p.inputs_fingerprint;
  if (
    typeof fingerprint !== 'string' ||
    !/^[a-z0-9]{1,128}$/.test(fingerprint)
  ) {
    throw new Error('inputs_fingerprint must be a short lowercase hash');
  }
  return {
    weekStart,
    revision: requireInteger(p.revision, 'revision', 1, 10_000),
    effectiveFrom,
    generationTrigger: trigger as PlanGenerationTrigger,
    loadStep: requireInteger(p.load_step, 'load_step', 0, MAX_LOAD_STEP),
    inputsFingerprint: fingerprint,
    ruleVersions: requireRuleVersions(p.rule_versions),
    plan: requirePlan(p.plan),
    notes: requireNotes(p.notes),
  };
}

/** A plan revision is immutable in content; an UPDATE re-sends the whole row. */
export type WeeklyPlanUpdateInput = WeeklyPlanCreateInput;
export function parseWeeklyPlanUpdate(
  p: Record<string, unknown>,
): WeeklyPlanUpdateInput {
  return parseWeeklyPlanCreate(p);
}
