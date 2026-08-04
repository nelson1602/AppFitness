import { useEffect, useMemo } from 'react';
import { View } from 'react-native';

import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useProgressStore } from '../application/progress.store';
import type { BodyMeasurementInput, BodyWeightInput } from '../domain/progress';
import { BodyMeasurementForm } from './BodyMeasurementForm';
import { BodyWeightForm } from './BodyWeightForm';

/**
 * Resolve today as a user-local `YYYY-MM-DD` at the UI boundary (ADR-P016 D6).
 * The clock read lives here in presentation — never in the domain/engine — and
 * only seeds the entry forms' default date.
 */
function todayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Progress Monitoring entry surface (ADR-P016 Phase 17 Slice 5a). Local-first
 * body-weight + body-measurement entry plus a manual weekly-insights recompute.
 * Binds only to the `useProgressStore` public API — no SQLite/repository access
 * from the UI. Feed-not-override (D5): this only records the user's own metrics
 * and recomputes the deterministic snapshot; it never mutates the training plan,
 * nutrition targets, or medical state. Trend charts + the weekly snapshot
 * visualization are deferred to Slice 5b.
 */
export function ProgressScreen() {
  const theme = useTheme();
  const {
    status,
    bodyWeights,
    bodyMeasurements,
    snapshots,
    error,
    load,
    addBodyWeight,
    addBodyMeasurement,
    recomputeSnapshots,
  } = useProgressStore();

  useEffect(() => {
    void load();
  }, [load]);

  // Stable for the lifetime of this mount so the prefilled date doesn't shift
  // mid-session; a new session/mount picks up the new day.
  const defaultDate = useMemo(() => todayLocalDate(), []);

  const saving = status === 'saving';

  // Auto-recompute after a successful weight entry (weight feeds the weekly
  // snapshot); measurements do not, so they don't trigger a recompute.
  const handleAddWeight = async (input: BodyWeightInput): Promise<boolean> => {
    const ok = await addBodyWeight(input);
    if (ok) await recomputeSnapshots();
    return ok;
  };

  const handleAddMeasurement = (input: BodyMeasurementInput): Promise<boolean> =>
    addBodyMeasurement(input);

  const latestWeight = bodyWeights[0] ?? null;

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="headline">Progress</AppText>
        <AppText tone="muted">
          Record your weight and measurements. Saved on your device first, synced when online.
        </AppText>
      </View>

      {status === 'loading' || status === 'idle' ? (
        <AppText accessibilityLabel="Loading progress">Loading…</AppText>
      ) : status === 'error' ? (
        <Banner title="Progress unavailable" tone="error">
          {error ?? 'Please try again.'}
        </Banner>
      ) : (
        <>
          <Card accessibilityLabel="Your latest progress">
            <View style={{ gap: theme.spacing.xs }}>
              <AppText variant="label">Latest</AppText>
              {latestWeight ? (
                <AppText>
                  {latestWeight.weightKg} kg on {latestWeight.date}
                </AppText>
              ) : (
                <AppText tone="muted">No weight recorded yet.</AppText>
              )}
              <AppText variant="caption" tone="muted">
                {bodyWeights.length} weight entr{bodyWeights.length === 1 ? 'y' : 'ies'} ·{' '}
                {bodyMeasurements.length} measurement entr
                {bodyMeasurements.length === 1 ? 'y' : 'ies'}
              </AppText>
            </View>
          </Card>

          <Card>
            <BodyWeightForm defaultDate={defaultDate} saving={saving} onSubmit={handleAddWeight} />
          </Card>

          <Card>
            <BodyMeasurementForm
              defaultDate={defaultDate}
              saving={saving}
              onSubmit={handleAddMeasurement}
            />
          </Card>

          <Card accessibilityLabel="Weekly insights">
            <View style={{ gap: theme.spacing.sm }}>
              <AppText variant="title">Weekly insights</AppText>
              {snapshots.length > 0 ? (
                <AppText tone="muted">
                  {snapshots.length} weekly snapshot{snapshots.length === 1 ? '' : 's'} computed.
                  Trend charts are coming soon.
                </AppText>
              ) : (
                <AppText tone="muted">
                  No weekly insights yet. Add some data, then update your insights.
                </AppText>
              )}
              <AppButton
                accessibilityLabel="Update weekly insights"
                testID="progress-recompute"
                variant="secondary"
                loading={saving}
                onPress={() => void recomputeSnapshots()}
              >
                Update weekly insights
              </AppButton>
            </View>
          </Card>
        </>
      )}
    </View>
  );
}
