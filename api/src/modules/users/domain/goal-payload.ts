import { GoalAttributes, GoalType } from './goal.types';

/**
 * Validates an untrusted goal wire payload (snake_case). Whitelist-based;
 * range/type violations throw. Mirrors DB CHECK constraints.
 */

const GOAL_TYPES: readonly GoalType[] = [
  'FAT_LOSS',
  'MUSCLE_GAIN',
  'RECOMPOSITION',
  'STRENGTH',
  'ENDURANCE',
  'GENERAL_HEALTH',
  'REHABILITATION',
  'MAINTENANCE',
];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class GoalPayloadError extends Error {
  constructor(field: string, reason: string) {
    super(`Invalid goal payload: ${field} ${reason}`);
    this.name = 'GoalPayloadError';
  }
}

function parseIsoDateTime(field: string, value: unknown): Date {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new GoalPayloadError(field, 'must be an ISO date-time string');
  }
  return new Date(value);
}

export function parseGoalPayload(
  payload: Record<string, unknown>,
): Partial<GoalAttributes> {
  const out: Partial<GoalAttributes> = {};

  if ('goal_type' in payload) {
    const value = payload['goal_type'];
    if (typeof value !== 'string' || !GOAL_TYPES.includes(value as GoalType)) {
      throw new GoalPayloadError(
        'goal_type',
        `must be one of ${GOAL_TYPES.join(', ')}`,
      );
    }
    out.goalType = value as GoalType;
  }

  if ('target_weight_kg' in payload) {
    const value = payload['target_weight_kg'];
    if (value === null) out.targetWeightKg = null;
    else if (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value > 0 &&
      value < 500
    ) {
      out.targetWeightKg = value;
    } else
      throw new GoalPayloadError(
        'target_weight_kg',
        'must be a positive number or null',
      );
  }

  if ('target_date' in payload) {
    const value = payload['target_date'];
    if (value === null) out.targetDate = null;
    else if (typeof value === 'string' && DATE_RE.test(value))
      out.targetDate = value;
    else
      throw new GoalPayloadError('target_date', 'must be YYYY-MM-DD or null');
  }

  if ('is_active' in payload) {
    const value = payload['is_active'];
    if (typeof value !== 'boolean' && value !== 0 && value !== 1) {
      throw new GoalPayloadError('is_active', 'must be a boolean');
    }
    out.isActive = value === true || value === 1;
  }

  if ('started_at' in payload) {
    out.startedAt = parseIsoDateTime('started_at', payload['started_at']);
  }

  if ('ended_at' in payload) {
    const value = payload['ended_at'];
    out.endedAt = value === null ? null : parseIsoDateTime('ended_at', value);
  }

  return out;
}

/** CREATE requires a goal type — there is no sensible default. */
export function requireGoalType(attributes: Partial<GoalAttributes>): void {
  if (!attributes.goalType) {
    throw new GoalPayloadError('goal_type', 'is required for CREATE');
  }
}
