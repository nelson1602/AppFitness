import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { Evaluation } from '../domain/medical.types';
import { useEvaluationStore } from '../application/evaluation.store';

const SYNC_LABEL: Record<Evaluation['syncStatus'], string> = {
  pending: 'Pending sync',
  synced: 'Synced',
  conflict: 'Sync conflict',
};

/** Non-sensitive vitals summary. Free-text (notes/conditions/medications) is
 * intentionally NOT surfaced here. */
function vitalsSummary(e: Evaluation): string {
  const parts = [`${e.weightKg} kg`];
  if (e.bodyFatPct != null) parts.push(`${e.bodyFatPct}% BF`);
  if (e.muscleMassKg != null) parts.push(`${e.muscleMassKg} kg MM`);
  if (e.bloodPressureSystolic != null && e.bloodPressureDiastolic != null) {
    parts.push(`${e.bloodPressureSystolic}/${e.bloodPressureDiastolic}`);
  }
  if (e.restingHeartRate != null) parts.push(`${e.restingHeartRate} bpm`);
  return parts.join(' · ');
}

function EvaluationItem({
  evaluation,
  onRemove,
  busy,
}: {
  evaluation: Evaluation;
  onRemove: (id: string) => void;
  busy: boolean;
}) {
  const theme = useTheme();
  const [confirming, setConfirming] = useState(false);

  return (
    <Card accessibilityLabel={`Evaluation from ${evaluation.evaluationDate}`}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="label">{evaluation.evaluationDate}</AppText>
        <AppText tone="muted">{vitalsSummary(evaluation)}</AppText>
        <AppText
          variant="caption"
          tone={evaluation.syncStatus === 'conflict' ? 'warning' : 'muted'}
        >
          {SYNC_LABEL[evaluation.syncStatus]}
        </AppText>
        {confirming ? (
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <AppButton
              accessibilityLabel={`Confirm remove evaluation from ${evaluation.evaluationDate}`}
              testID={`evaluation-remove-confirm-${evaluation.id}`}
              variant="destructive"
              loading={busy}
              onPress={() => onRemove(evaluation.id)}
            >
              Confirm remove
            </AppButton>
            <AppButton variant="text" onPress={() => setConfirming(false)}>
              Cancel
            </AppButton>
          </View>
        ) : (
          <AppButton
            accessibilityLabel={`Remove evaluation from ${evaluation.evaluationDate}`}
            testID={`evaluation-remove-${evaluation.id}`}
            variant="text"
            onPress={() => setConfirming(true)}
          >
            Remove
          </AppButton>
        )}
      </View>
    </Card>
  );
}

/**
 * Evaluation history (Phase 14 Slice 2). Lists recorded evaluations with a
 * non-sensitive vitals summary and local sync status, and offers a safe
 * two-step soft-delete (removeEvaluation) — evaluations are append-only, so
 * corrections are a new record or a soft-delete, never an edit-in-place.
 */
export function EvaluationHistory() {
  const theme = useTheme();
  const { status, evaluations, error, load, remove } = useEvaluationStore();

  useEffect(() => {
    void load();
  }, [load]);

  const initialLoading = status === 'loading' && evaluations.length === 0;

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="headline">Evaluation history</AppText>
        <AppText tone="muted">
          Your recorded physical evaluations. Removing one is a soft-delete synced to your account.
        </AppText>
      </View>

      <AppButton
        accessibilityLabel="Record a new evaluation"
        testID="record-new-evaluation"
        onPress={() => router.push('/evaluation-edit')}
      >
        Record new evaluation
      </AppButton>

      {error ? (
        <Banner title="Something went wrong" tone="error">
          {error}
        </Banner>
      ) : null}

      {initialLoading ? (
        <AppText accessibilityLabel="Loading evaluations">Loading…</AppText>
      ) : evaluations.length === 0 ? (
        <AppText tone="muted">No evaluations recorded yet.</AppText>
      ) : (
        evaluations.map((evaluation) => (
          <EvaluationItem
            key={evaluation.id}
            evaluation={evaluation}
            busy={status === 'saving'}
            onRemove={(id) => {
              void remove(id);
            }}
          />
        ))
      )}
    </View>
  );
}
