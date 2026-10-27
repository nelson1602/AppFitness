import type { EvaluationDraft, StepIssue } from '../../domain/evaluation';

export interface StepProps {
  draft: EvaluationDraft;
  update: (patch: Partial<EvaluationDraft>) => void;
  /** Issues to show; empty until the person tries to continue. */
  issues: readonly StepIssue[];
  /** Device-local `YYYY-MM-DD`. */
  today: string;
}
