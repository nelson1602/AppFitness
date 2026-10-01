import { useEffect, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';

import { formatNumber, useLocalization } from '@/shared/localization';
import {
  AppButton,
  AppText,
  AppTextInput,
  Banner,
  Card,
  PaidWriteDisabledProvider,
  usePaidWriteDisabled,
} from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { SyncStatus } from '@/shared/infrastructure/database/types';

import type { CustomExercise, WorkoutLog, WorkoutSet } from '../domain/workout';
import { exerciseDisplayName } from '../application/exercise-display.service';
import { useWorkoutStore } from '../application/workout.store';
import {
  getBuiltInExerciseById,
  listBuiltInExercises,
} from '../infrastructure/exercise-catalog.data';
import { CustomExerciseForm } from './CustomExerciseForm';
import { CustomExerciseNote } from './CustomExerciseNote';

/** Same dimming as a disabled `AppButton` (S-4 read-only write controls). */
const DISABLED_OPACITY = 0.56;

/**
 * Bilingual workout logging (ADR-P015 Phase 16 Slice 6). Start an ad-hoc
 * workout (or from a routine), log sets against built-in
 * exercises, edit/remove sets, and finish the workout. ALL persistence routes
 * through the Slice 4A/4B workout store → service → repository (local-first
 * write, sync enqueue); the UI never touches SQLite. Rows carry their local
 * `syncStatus`, surfaced as localized pending-sync and conflict hints. Public
 * wellness v1
 * intentionally does not consume the retained medical TrainingPlan domain;
 * that architecture remains dormant for possible future use behind a separate
 * approved product contract.
 */

const CATALOG = listBuiltInExercises();

function PendingHint({ syncStatus }: { syncStatus: WorkoutSet['syncStatus'] }) {
  const { t } = useLocalization();
  if (syncStatus !== 'pending') return null;
  return (
    <AppText
      variant="caption"
      tone="muted"
      accessibilityLabel={t('workout.log.syncPendingAccessibility')}
    >
      {t('workout.log.syncPending')}
    </AppText>
  );
}

/**
 * A diverged row, reported only (BUG-011). `warning`, never `error`, because
 * both versions are preserved (`.ai/08_UI_UX.md` distinction 5) — matching the
 * conformant `ExerciseLibrary` badge. There is deliberately no choose action:
 * no resolution flow is authorized anywhere in v1 (BUG-012).
 */
function ConflictHint({ syncStatus }: { syncStatus: SyncStatus }) {
  const { t } = useLocalization();
  if (syncStatus !== 'conflict') return null;
  return (
    <AppText
      variant="caption"
      tone="warning"
      accessibilityLabel={t('workout.log.syncConflictAccessibility')}
    >
      {t('workout.log.syncConflict')}
    </AppText>
  );
}

export function WorkoutLogScreen() {
  const theme = useTheme();
  const paidWriteDisabled = usePaidWriteDisabled();
  const { language, t } = useLocalization();
  const {
    status,
    routines,
    workoutLogs,
    workoutSets,
    customExercises,
    error,
    load,
    startWorkout,
    finishWorkout,
    removeWorkout,
    loadWorkoutSets,
    logWorkoutSet,
    updateWorkoutSet,
    removeWorkoutSet,
    createCustomExercise,
  } = useWorkoutStore();

  const [name, setName] = useState('');
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [showNewExercise, setShowNewExercise] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  const initialLoading = status === 'loading' && workoutLogs.length === 0;
  const openLogs = workoutLogs.filter((l) => !l.finishedAt);
  const finishedLogs = workoutLogs.filter((l) => l.finishedAt);
  const onStart = async (routineId: string | null) => {
    const trimmed = name.trim() || t('workout.log.defaultName');
    const ok = await startWorkout(routineId ? { name: trimmed, routineId } : { name: trimmed });
    if (ok) setName('');
  };

  const onSelectLog = async (log: WorkoutLog) => {
    if (selectedLogId === log.id) {
      setSelectedLogId(null);
      return;
    }
    setSelectedLogId(log.id);
    setExerciseId(null);
    await loadWorkoutSets(log.id);
  };

  const onAddSet = async () => {
    if (!selectedLogId || !exerciseId) return;
    const ok = await logWorkoutSet(selectedLogId, {
      exerciseId,
      setNumber: workoutSets.length + 1,
      reps: reps.trim() === '' ? null : Number(reps),
      weightKg: weight.trim() === '' ? null : Number(weight),
    });
    if (ok) {
      setReps('');
      setWeight('');
    }
  };

  const onEditReps = (id: string, text: string) => {
    const next = text.trim() === '' ? null : Number(text);
    if (next !== null && Number.isNaN(next)) return;
    void updateWorkoutSet(id, { reps: next });
  };

  // Local database is dormant on Web (ADR-P019): render an honest, info-tone
  // bilingual state — no forms, data, editing controls, or retry.
  if (status === 'web-unavailable') {
    return (
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="headline">{t('workout.log.title')}</AppText>
          <AppText tone="muted">{t('workout.log.subtitle')}</AppText>
        </View>
        <Banner title={t('workout.log.webUnavailableTitle')} tone="info">
          {t('workout.log.webUnavailableBody')}
        </Banner>
      </View>
    );
  }

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="headline">{t('workout.log.title')}</AppText>
        <AppText tone="muted">{t('workout.log.subtitle')}</AppText>
      </View>

      {error ? (
        <Banner title={t('workout.log.errorTitle')} tone="error">
          {t('workout.log.errorMessage')}
        </Banner>
      ) : null}

      <Card accessibilityLabel={t('workout.log.startAccessibility')}>
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="title">{t('workout.log.startTitle')}</AppText>
          <AppTextInput
            accessibilityLabel={t('workout.log.name')}
            testID="workout-name"
            placeholder={t('workout.log.namePlaceholder')}
            value={name}
            onChangeText={setName}
          />
          <AppButton
            accessibilityLabel={t('workout.log.startButton')}
            testID="workout-start"
            loading={status === 'saving'}
            onPress={() => void onStart(null)}
          >
            {t('workout.log.startButton')}
          </AppButton>

          {routines.length > 0 ? (
            <View style={{ gap: theme.spacing.sm }}>
              <AppText variant="label" tone="muted">
                {t('workout.log.fromRoutine')}
              </AppText>
              {routines.map((routine) => (
                <AppButton
                  key={routine.id}
                  accessibilityLabel={`${t('workout.log.startFromAccessibility')} ${routine.name}`}
                  testID={`workout-start-routine-${routine.id}`}
                  variant="secondary"
                  onPress={() => void onStart(routine.id)}
                >
                  {routine.name}
                </AppButton>
              ))}
            </View>
          ) : null}
        </View>
      </Card>

      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="title">{t('workout.log.openTitle')}</AppText>
        {initialLoading ? (
          <AppText accessibilityLabel={t('workout.log.loadingAccessibility')}>
            {t('workout.log.loading')}
          </AppText>
        ) : openLogs.length === 0 ? (
          <AppText tone="muted">{t('workout.log.openEmpty')}</AppText>
        ) : (
          openLogs.map((log) => (
            <Card
              key={log.id}
              accessibilityLabel={`${t('workout.log.workoutAccessibility')} ${log.name}`}
            >
              <View style={{ gap: theme.spacing.sm }}>
                <AppText variant="label">{log.name}</AppText>
                {log.syncStatus === 'pending' ? (
                  <AppText
                    variant="caption"
                    tone="muted"
                    accessibilityLabel={t('workout.log.savedAccessibility')}
                  >
                    {t('workout.log.savedOnDevice')}
                  </AppText>
                ) : null}
                <ConflictHint syncStatus={log.syncStatus} />
                {/* BUG-026: wraps so a large-text action is not pushed off the card. */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                  <PaidWriteDisabledProvider disabled={false}>
                    <AppButton
                      accessibilityLabel={`${t('workout.log.logSetsAccessibility')} ${log.name}`}
                      testID={`workout-select-${log.id}`}
                      variant="secondary"
                      onPress={() => void onSelectLog(log)}
                    >
                      {selectedLogId === log.id
                        ? t('workout.log.hideSets')
                        : t('workout.log.logSets')}
                    </AppButton>
                  </PaidWriteDisabledProvider>
                  <AppButton
                    accessibilityLabel={`${t('workout.log.finishAccessibility')} ${log.name}`}
                    testID={`workout-finish-${log.id}`}
                    loading={status === 'saving'}
                    onPress={() => void finishWorkout(log.id)}
                  >
                    {t('workout.log.finish')}
                  </AppButton>
                  <AppButton
                    accessibilityLabel={`${t('workout.log.removeWorkoutAccessibility')} ${log.name}`}
                    testID={`workout-remove-${log.id}`}
                    variant="text"
                    loading={status === 'saving'}
                    onPress={() => void removeWorkout(log.id)}
                  >
                    {t('workout.log.remove')}
                  </AppButton>
                </View>

                {selectedLogId === log.id ? (
                  <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.sm }}>
                    <SetList
                      sets={workoutSets}
                      customExercises={customExercises}
                      onEditReps={onEditReps}
                      onToggle={(id, completed) => void updateWorkoutSet(id, { completed })}
                      onRemove={(id) => void removeWorkoutSet(id)}
                      saving={status === 'saving'}
                    />

                    <AppText variant="label" tone="muted">
                      {t('workout.log.addSetTitle')}
                    </AppText>

                    {showNewExercise ? (
                      <Card accessibilityLabel={t('workout.log.newCustomAccessibility')}>
                        <CustomExerciseForm
                          existing={customExercises}
                          saving={status === 'saving'}
                          onSubmit={createCustomExercise}
                          onDone={() => setShowNewExercise(false)}
                          onCancel={() => setShowNewExercise(false)}
                        />
                      </Card>
                    ) : (
                      <AppButton
                        accessibilityLabel={t('workout.log.createCustomAccessibility')}
                        testID="set-new-custom-exercise"
                        variant="secondary"
                        onPress={() => setShowNewExercise(true)}
                      >
                        {t('workout.log.newExercise')}
                      </AppButton>
                    )}

                    <AppText variant="caption" tone="muted">
                      {t('workout.log.builtIn')}
                    </AppText>
                    <View style={{ gap: theme.spacing.sm }}>
                      {CATALOG.map((exercise) => {
                        const displayName = exerciseDisplayName(exercise.key, language);
                        return (
                          <Pressable
                            key={exercise.id}
                            accessibilityRole="button"
                            accessibilityLabel={`${t('workout.log.chooseAccessibility')} ${displayName}`}
                            accessibilityState={{
                              selected: exerciseId === exercise.id,
                              disabled: paidWriteDisabled,
                            }}
                            disabled={paidWriteDisabled}
                            testID={`set-exercise-${exercise.key}`}
                            onPress={() => setExerciseId(exercise.id)}
                            style={{
                              opacity: paidWriteDisabled ? DISABLED_OPACITY : 1,
                              backgroundColor:
                                exerciseId === exercise.id
                                  ? theme.colors.surfaceVariant
                                  : 'transparent',
                              borderColor:
                                exerciseId === exercise.id
                                  ? theme.colors.primary
                                  : theme.colors.outline,
                              borderRadius: theme.radius.medium,
                              borderWidth: 1,
                              // BUG-023: padding, border and one name line came
                              // to 42 dp tall, under the 44×44 floor.
                              justifyContent: 'center',
                              minHeight: theme.spacing.x5l,
                              padding: theme.spacing.sm,
                            }}
                          >
                            <AppText>{displayName}</AppText>
                          </Pressable>
                        );
                      })}
                    </View>

                    <AppText variant="caption" tone="muted">
                      {t('workout.log.myExercises')}
                    </AppText>
                    {customExercises.length === 0 ? (
                      <AppText tone="muted">{t('workout.log.customEmpty')}</AppText>
                    ) : (
                      <View style={{ gap: theme.spacing.sm }}>
                        {customExercises.map((exercise) => (
                          <Pressable
                            key={exercise.id}
                            accessibilityRole="button"
                            accessibilityLabel={`${t('workout.log.chooseAccessibility')} ${exercise.name}`}
                            accessibilityState={{
                              selected: exerciseId === exercise.id,
                              disabled: paidWriteDisabled,
                            }}
                            disabled={paidWriteDisabled}
                            testID={`set-custom-exercise-${exercise.id}`}
                            onPress={() => setExerciseId(exercise.id)}
                            style={{
                              opacity: paidWriteDisabled ? DISABLED_OPACITY : 1,
                              backgroundColor:
                                exerciseId === exercise.id
                                  ? theme.colors.surfaceVariant
                                  : 'transparent',
                              borderColor:
                                exerciseId === exercise.id
                                  ? theme.colors.primary
                                  : theme.colors.outline,
                              borderRadius: theme.radius.medium,
                              borderWidth: 1,
                              padding: theme.spacing.sm,
                            }}
                          >
                            <AppText>{exercise.name}</AppText>
                            <CustomExerciseNote />
                          </Pressable>
                        ))}
                      </View>
                    )}

                    <NewSetInputs
                      reps={reps}
                      weight={weight}
                      onChangeReps={setReps}
                      onChangeWeight={setWeight}
                    />
                    <AppButton
                      accessibilityLabel={t('workout.log.addSet')}
                      testID="set-add"
                      disabled={!exerciseId}
                      loading={status === 'saving'}
                      onPress={() => void onAddSet()}
                    >
                      {t('workout.log.addSet')}
                    </AppButton>
                  </View>
                ) : null}
              </View>
            </Card>
          ))
        )}
      </View>

      {finishedLogs.length > 0 ? (
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="title">{t('workout.log.recentTitle')}</AppText>
          {finishedLogs.map((log) => (
            <Card
              key={log.id}
              accessibilityLabel={`${t('workout.log.finishedWorkoutAccessibility')} ${log.name}`}
            >
              <View style={{ gap: theme.spacing.xs }}>
                <AppText variant="label">{log.name}</AppText>
                <AppText variant="caption" tone="muted">
                  {t('workout.log.finished')}
                </AppText>
                <AppButton
                  accessibilityLabel={`${t('workout.log.removeWorkoutAccessibility')} ${log.name}`}
                  testID={`workout-remove-${log.id}`}
                  variant="text"
                  loading={status === 'saving'}
                  onPress={() => void removeWorkout(log.id)}
                >
                  {t('workout.log.remove')}
                </AppButton>
              </View>
            </Card>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * The paired new-set reps and weight inputs (UX-5). They sit side by side at
 * equal width while both placeholders fit, and stack when they do not: at 2.0×
 * text the Spanish "Repeticiones" is wider than half the card.
 *
 * The decision is content-driven. Each placeholder is laid out off-screen in
 * the input's own body type (`AppText` body, font scaling on), and the widest
 * one plus the input's horizontal padding and focused border is compared with
 * the row's measured width. `AppTextInput` takes no style, so plain wrapper
 * `View`s carry the layout. Until both are measured, the pair renders side by
 * side, as it always has.
 */
function NewSetInputs({
  reps,
  weight,
  onChangeReps,
  onChangeWeight,
}: {
  reps: string;
  weight: string;
  onChangeReps: (next: string) => void;
  onChangeWeight: (next: string) => void;
}) {
  const theme = useTheme();
  const { t } = useLocalization();
  const [rowWidth, setRowWidth] = useState(0);
  const [placeholderWidths, setPlaceholderWidths] = useState({ reps: 0, weight: 0 });

  // Both sides' horizontal padding, plus both sides of the 2 px focused border.
  const chrome = theme.spacing.md * 2 + theme.spacing.xs;
  const cellWidth = Math.max(placeholderWidths.reps, placeholderWidths.weight) + chrome;
  const stacked = rowWidth > 0 && cellWidth * 2 + theme.spacing.sm > rowWidth;

  const measure = (key: 'reps' | 'weight') => (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setPlaceholderWidths((current) =>
      current[key] === width ? current : { ...current, [key]: width },
    );
  };

  return (
    <View onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}>
      {/* Off-screen measurers: never visible, never announced, never touched. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, opacity: 0 }}
      >
        <AppText testID="set-reps-input-measure" numberOfLines={1} onLayout={measure('reps')}>
          {t('workout.log.reps')}
        </AppText>
        <AppText testID="set-weight-input-measure" numberOfLines={1} onLayout={measure('weight')}>
          {t('workout.log.weightKg')}
        </AppText>
      </View>
      <View
        testID="set-inputs-pair"
        style={{ flexDirection: stacked ? 'column' : 'row', gap: theme.spacing.sm }}
      >
        <View style={stacked ? undefined : { flex: 1 }}>
          <AppTextInput
            accessibilityLabel={t('workout.log.reps')}
            testID="set-reps-input"
            placeholder={t('workout.log.reps')}
            keyboardType="numeric"
            value={reps}
            onChangeText={onChangeReps}
          />
        </View>
        <View style={stacked ? undefined : { flex: 1 }}>
          <AppTextInput
            accessibilityLabel={t('workout.log.weightKg')}
            testID="set-weight-input"
            placeholder={t('workout.log.weightKg')}
            keyboardType="numeric"
            value={weight}
            onChangeText={onChangeWeight}
          />
        </View>
      </View>
    </View>
  );
}

function SetList({
  sets,
  customExercises,
  onEditReps,
  onToggle,
  onRemove,
  saving,
}: {
  sets: WorkoutSet[];
  customExercises: readonly CustomExercise[];
  onEditReps: (id: string, text: string) => void;
  onToggle: (id: string, completed: boolean) => void;
  onRemove: (id: string) => void;
  saving: boolean;
}) {
  const theme = useTheme();
  const { language, t } = useLocalization();
  if (sets.length === 0) {
    return <AppText tone="muted">{t('workout.log.setsEmpty')}</AppText>;
  }
  return (
    <View style={{ gap: theme.spacing.sm }}>
      {sets.map((set) => {
        const exercise = getBuiltInExerciseById(set.exerciseId);
        const customExercise = customExercises.find((item) => item.id === set.exerciseId);
        const displayName = exercise
          ? exerciseDisplayName(exercise.key, language)
          : (customExercise?.name ?? t('workout.builder.removedExercise'));
        return (
          <View key={set.id} testID={`set-${set.id}`} style={{ gap: theme.spacing.xs }}>
            <AppText variant="label">
              {formatNumber(set.setNumber, language)}. {displayName}
            </AppText>
            <PendingHint syncStatus={set.syncStatus} />
            <ConflictHint syncStatus={set.syncStatus} />
            {/* BUG-026: wraps so the set controls stay on the card at large text. */}
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              {/* UX-5: the compact width lives on a wrapper because AppTextInput
                  takes no style; the input stretches to fill it. */}
              <View style={{ minWidth: theme.spacing.xl * 2 }}>
                <AppTextInput
                  accessibilityLabel={`${t('workout.log.repsForSetAccessibility')} ${formatNumber(set.setNumber, language)}`}
                  testID={`set-reps-${set.id}`}
                  keyboardType="numeric"
                  defaultValue={set.reps === null ? '' : String(set.reps)}
                  onCommitEnd={(text) => onEditReps(set.id, text)}
                />
              </View>
              <AppText tone="muted">
                {set.weightKg === null ? '—' : `${formatNumber(set.weightKg, language)} kg`}
              </AppText>
              <AppButton
                accessibilityLabel={`${t(
                  set.completed
                    ? 'workout.log.markNotDoneAccessibility'
                    : 'workout.log.markDoneAccessibility',
                )} ${formatNumber(set.setNumber, language)}`}
                testID={`set-toggle-${set.id}`}
                variant="secondary"
                loading={saving}
                onPress={() => onToggle(set.id, !set.completed)}
              >
                {set.completed ? t('workout.log.done') : t('workout.log.markDone')}
              </AppButton>
              <AppButton
                accessibilityLabel={`${t('workout.log.removeSetAccessibility')} ${formatNumber(set.setNumber, language)}`}
                testID={`set-remove-${set.id}`}
                variant="text"
                loading={saving}
                onPress={() => onRemove(set.id)}
              >
                {t('workout.log.remove')}
              </AppButton>
            </View>
          </View>
        );
      })}
    </View>
  );
}
