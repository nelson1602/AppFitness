/**
 * ADR-P042 — the saved weekly iCoach plan. One row per plan revision. The plan
 * is generated ON-DEVICE by the deterministic engine; the server validates the
 * shape and stores it, and never regenerates it.
 */
export const WEEKLY_PLAN_ENTITY_TYPE = 'weekly_plans';

export const PLAN_GENERATION_TRIGGERS = [
  'FIRST_RUN',
  'WEEKLY',
  'CHANGE',
] as const;
export type PlanGenerationTrigger = (typeof PLAN_GENERATION_TRIGGERS)[number];

export const MAX_LOAD_STEP = 4;

export interface WeeklyPlanRecord {
  id: string;
  userId: string;
  weekStart: Date;
  revision: number;
  effectiveFrom: Date;
  generationTrigger: string;
  loadStep: number;
  inputsFingerprint: string;
  ruleVersions: Record<string, string>;
  plan: Record<string, unknown>;
  notes: unknown[];
  version: number;
  syncSeq: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
