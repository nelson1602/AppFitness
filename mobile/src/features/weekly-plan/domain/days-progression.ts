import { MAX_TRAINING_DAYS } from '@/features/icoach/domain/training';

import { addDays } from './week';
import type { PlanNote } from './weekly-plan';

/**
 * Training-days progression (ADR-P040 D11). Deterministic and conservative:
 * when the two weeks immediately before the new one were both planned at the
 * current number of days and at least 80 % of their sessions were fulfilled,
 * the Monday plan proposes one more day. It never goes above the days the
 * person chose, and it only proposes: the person confirms through "¿Actualizar
 * tu plan de esta semana?".
 */
export const DAYS_PROGRESSION_RULE_VERSION = 'plan-days@1.0.0';

/** The workout compliance each of the two weeks needs. */
export const DAYS_COMPLIANCE_THRESHOLD = 0.8;

/** Weeks in a row at the current days that earn the proposal. */
export const DAYS_STREAK_WEEKS = 2;

export const DAYS_PROPOSAL_NOTE = 'plan.days.proposal';

export interface WeekWorkoutResult {
  weekStart: string;
  /** Training days the week was planned with (its last revision). */
  plannedDays: number;
  plannedSessions: number;
  fulfilledSessions: number;
}

export interface DaysProgressionInput {
  /** Training days in force this week. */
  daysInForce: number;
  /** The days the person chose in their evaluation. */
  chosenDays: number;
  /** The new week's Monday. */
  weekStart: string;
  /** Earlier weeks, any order. */
  previousWeeks: readonly WeekWorkoutResult[];
}

/** The days to propose for the new week, or null when nothing is earned. */
export function proposedTrainingDays(input: DaysProgressionInput): number | null {
  const ceiling = Math.min(input.chosenDays, MAX_TRAINING_DAYS);
  if (input.daysInForce >= ceiling) return null;
  for (let back = 1; back <= DAYS_STREAK_WEEKS; back += 1) {
    const weekStart = addDays(input.weekStart, -7 * back);
    const week = input.previousWeeks.find((candidate) => candidate.weekStart === weekStart);
    if (!week) return null;
    if (week.plannedDays !== input.daysInForce || week.plannedSessions === 0) return null;
    if (week.fulfilledSessions / week.plannedSessions < DAYS_COMPLIANCE_THRESHOLD) return null;
  }
  return input.daysInForce + 1;
}

export function daysProposalNote(days: number): PlanNote {
  return { code: DAYS_PROPOSAL_NOTE, params: { days } };
}

/** The proposal a plan carries and has not applied yet, or null. */
export function openDaysProposal(notes: readonly PlanNote[], daysInForce: number): number | null {
  const note = notes.find((candidate) => candidate.code === DAYS_PROPOSAL_NOTE);
  const days = Number(note?.params?.days);
  return Number.isInteger(days) && days > daysInForce ? days : null;
}
