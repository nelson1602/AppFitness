import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { WorkoutLog, WorkoutSet } from '../domain/workout';
import { useTrainingPlan } from '../application/use-training-plan';
import { useWorkoutStore } from '../application/workout.store';
import {
  getBuiltInExerciseById,
  listBuiltInExercises,
} from '../infrastructure/exercise-catalog.data';
import { ExerciseExclusionNote } from './ExerciseExclusionNote';
import { TrainingPlanCard } from './TrainingPlanCard';

/**
 * Workout logging (ADR-P015 Phase 16 Slice 6; TrainingPlan integration in Slice
 * 7). Start an ad-hoc workout (or from a routine), log sets against built-in
 * exercises, edit/remove sets, and finish the workout. ALL persistence routes
 * through the Slice 4A/4B workout store → service → repository (local-first
 * write, sync enqueue); the UI never touches SQLite. Rows carry their local
 * `syncStatus`, surfaced as a "pending sync" hint.
 *
 * Safety context is READ from the deterministic iCoach `TrainingPlan` (via
 * `useTrainingPlan`) — never recomputed. `TrainingPlanCard` surfaces the
 * blocked / clearance / intensity / RPE-cap / days-per-week guidance; an
 * exercise whose movement patterns intersect `excludedMovements` shows a
 * NON-blocking caution. Medical restrictions are never overridden. Custom
 * exercises stay deferred (Slice 3B); the catalog is unchanged (Slice 2).
 */

const CATALOG = listBuiltInExercises();

function PendingHint({ syncStatus }: { syncStatus: WorkoutSet['syncStatus'] }) {
  if (syncStatus !== 'pending') return null;
  return (
    <AppText variant="caption" tone="muted" accessibilityLabel="Sync pending">
      Pending sync
    </AppText>
  );
}

export function WorkoutLogScreen() {
  const theme = useTheme();
  const {
    status,
    routines,
    workoutLogs,
    workoutSets,
    error,
    load,
    startWorkout,
    finishWorkout,
    removeWorkout,
    loadWorkoutSets,
    logWorkoutSet,
    updateWorkoutSet,
    removeWorkoutSet,
  } = useWorkoutStore();

  // Read-only training safety context (may be absent if the dashboard has not
  // loaded yet). We never recompute it.
  const training = useTrainingPlan();
  const excludedMovements = training?.excludedMovements ?? [];

  const [name, setName] = useState('');
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');

  useEffect(() => {
    void load();
  }, [load]);

  const initialLoading = status === 'loading' && workoutLogs.length === 0;
  const openLogs = workoutLogs.filter((l) => !l.finishedAt);
  const finishedLogs = workoutLogs.filter((l) => l.finishedAt);
  const selectedExercise = exerciseId ? getBuiltInExerciseById(exerciseId) : undefined;

  const onStart = async (routineId: string | null) => {
    const trimmed = name.trim() || 'Workout';
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

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="headline">Log a workout</AppText>
        <AppText tone="muted">
          Track your sets as you train. Everything is saved on your device first and syncs to your
          account later.
        </AppText>
      </View>

      {error ? (
        <Banner title="Something went wrong" tone="error">
          {error}
        </Banner>
      ) : null}

      <TrainingPlanCard plan={training} />

      <Card accessibilityLabel="Start a workout">
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="title">Start a workout</AppText>
          <TextInput
            accessibilityLabel="Workout name"
            testID="workout-name"
            placeholder="e.g. Morning session"
            placeholderTextColor={theme.colors.outline}
            value={name}
            onChangeText={setName}
            style={{
              borderColor: theme.colors.outline,
              borderRadius: theme.radius.medium,
              borderWidth: 1,
              color: theme.colors.onSurface,
              padding: theme.spacing.sm,
            }}
          />
          <AppButton
            accessibilityLabel="Start workout"
            testID="workout-start"
            loading={status === 'saving'}
            onPress={() => void onStart(null)}
          >
            Start workout
          </AppButton>

          {routines.length > 0 ? (
            <View style={{ gap: theme.spacing.sm }}>
              <AppText variant="label" tone="muted">
                Or start from a routine
              </AppText>
              {routines.map((routine) => (
                <AppButton
                  key={routine.id}
                  accessibilityLabel={`Start workout from ${routine.name}`}
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
        <AppText variant="title">Open workouts</AppText>
        {initialLoading ? (
          <AppText accessibilityLabel="Loading workouts">Loading…</AppText>
        ) : openLogs.length === 0 ? (
          <AppText tone="muted">No open workouts.</AppText>
        ) : (
          openLogs.map((log) => (
            <Card key={log.id} accessibilityLabel={`Workout: ${log.name}`}>
              <View style={{ gap: theme.spacing.sm }}>
                <AppText variant="label">{log.name}</AppText>
                {log.syncStatus === 'pending' ? (
                  <AppText
                    variant="caption"
                    tone="muted"
                    accessibilityLabel="Workout saved on this device"
                  >
                    Saved on this device
                  </AppText>
                ) : null}
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                  <AppButton
                    accessibilityLabel={`Log sets for ${log.name}`}
                    testID={`workout-select-${log.id}`}
                    variant="secondary"
                    onPress={() => void onSelectLog(log)}
                  >
                    {selectedLogId === log.id ? 'Hide sets' : 'Log sets'}
                  </AppButton>
                  <AppButton
                    accessibilityLabel={`Finish workout ${log.name}`}
                    testID={`workout-finish-${log.id}`}
                    loading={status === 'saving'}
                    onPress={() => void finishWorkout(log.id)}
                  >
                    Finish
                  </AppButton>
                  <AppButton
                    accessibilityLabel={`Remove workout ${log.name}`}
                    testID={`workout-remove-${log.id}`}
                    variant="text"
                    loading={status === 'saving'}
                    onPress={() => void removeWorkout(log.id)}
                  >
                    Remove
                  </AppButton>
                </View>

                {selectedLogId === log.id ? (
                  <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.sm }}>
                    <SetList
                      sets={workoutSets}
                      excludedMovements={excludedMovements}
                      onEditReps={onEditReps}
                      onToggle={(id, completed) => void updateWorkoutSet(id, { completed })}
                      onRemove={(id) => void removeWorkoutSet(id)}
                      saving={status === 'saving'}
                    />

                    <AppText variant="label" tone="muted">
                      Add a set
                    </AppText>
                    <View style={{ gap: theme.spacing.sm }}>
                      {CATALOG.map((exercise) => (
                        <Pressable
                          key={exercise.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Choose ${exercise.name}`}
                          accessibilityState={{ selected: exerciseId === exercise.id }}
                          testID={`set-exercise-${exercise.key}`}
                          onPress={() => setExerciseId(exercise.id)}
                          style={{
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
                          <ExerciseExclusionNote
                            exercise={exercise}
                            excludedMovements={excludedMovements}
                          />
                        </Pressable>
                      ))}
                    </View>

                    {selectedExercise ? (
                      <ExerciseExclusionNote
                        exercise={selectedExercise}
                        excludedMovements={excludedMovements}
                      />
                    ) : null}

                    <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                      <TextInput
                        accessibilityLabel="Reps"
                        testID="set-reps-input"
                        placeholder="Reps"
                        placeholderTextColor={theme.colors.outline}
                        keyboardType="numeric"
                        value={reps}
                        onChangeText={setReps}
                        style={{
                          borderColor: theme.colors.outline,
                          borderRadius: theme.radius.medium,
                          borderWidth: 1,
                          color: theme.colors.onSurface,
                          flex: 1,
                          padding: theme.spacing.sm,
                        }}
                      />
                      <TextInput
                        accessibilityLabel="Weight (kg)"
                        testID="set-weight-input"
                        placeholder="Weight (kg)"
                        placeholderTextColor={theme.colors.outline}
                        keyboardType="numeric"
                        value={weight}
                        onChangeText={setWeight}
                        style={{
                          borderColor: theme.colors.outline,
                          borderRadius: theme.radius.medium,
                          borderWidth: 1,
                          color: theme.colors.onSurface,
                          flex: 1,
                          padding: theme.spacing.sm,
                        }}
                      />
                    </View>
                    <AppButton
                      accessibilityLabel="Add set"
                      testID="set-add"
                      disabled={!exerciseId}
                      loading={status === 'saving'}
                      onPress={() => void onAddSet()}
                    >
                      Add set
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
          <AppText variant="title">Recent workouts</AppText>
          {finishedLogs.map((log) => (
            <Card key={log.id} accessibilityLabel={`Finished workout: ${log.name}`}>
              <View style={{ gap: theme.spacing.xs }}>
                <AppText variant="label">{log.name}</AppText>
                <AppText variant="caption" tone="muted">
                  Finished
                </AppText>
                <AppButton
                  accessibilityLabel={`Remove workout ${log.name}`}
                  testID={`workout-remove-${log.id}`}
                  variant="text"
                  loading={status === 'saving'}
                  onPress={() => void removeWorkout(log.id)}
                >
                  Remove
                </AppButton>
              </View>
            </Card>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SetList({
  sets,
  excludedMovements,
  onEditReps,
  onToggle,
  onRemove,
  saving,
}: {
  sets: WorkoutSet[];
  excludedMovements: readonly string[];
  onEditReps: (id: string, text: string) => void;
  onToggle: (id: string, completed: boolean) => void;
  onRemove: (id: string) => void;
  saving: boolean;
}) {
  const theme = useTheme();
  if (sets.length === 0) {
    return <AppText tone="muted">No sets logged yet.</AppText>;
  }
  return (
    <View style={{ gap: theme.spacing.sm }}>
      {sets.map((set) => {
        const exercise = getBuiltInExerciseById(set.exerciseId);
        return (
          <View key={set.id} testID={`set-${set.id}`} style={{ gap: theme.spacing.xs }}>
            <AppText variant="label">
              {set.setNumber}. {exercise?.name ?? 'Exercise'}
            </AppText>
            <ExerciseExclusionNote exercise={exercise} excludedMovements={excludedMovements} />
            <PendingHint syncStatus={set.syncStatus} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <TextInput
                accessibilityLabel={`Reps for set ${set.setNumber}`}
                testID={`set-reps-${set.id}`}
                keyboardType="numeric"
                defaultValue={set.reps === null ? '' : String(set.reps)}
                onEndEditing={(e) => onEditReps(set.id, e.nativeEvent.text)}
                style={{
                  borderColor: theme.colors.outline,
                  borderRadius: theme.radius.medium,
                  borderWidth: 1,
                  color: theme.colors.onSurface,
                  minWidth: theme.spacing.xl * 2,
                  padding: theme.spacing.sm,
                }}
              />
              <AppText tone="muted">{set.weightKg === null ? '—' : `${set.weightKg} kg`}</AppText>
              <AppButton
                accessibilityLabel={`Mark set ${set.setNumber} ${set.completed ? 'not done' : 'done'}`}
                testID={`set-toggle-${set.id}`}
                variant="secondary"
                loading={saving}
                onPress={() => onToggle(set.id, !set.completed)}
              >
                {set.completed ? 'Done' : 'Mark done'}
              </AppButton>
              <AppButton
                accessibilityLabel={`Remove set ${set.setNumber}`}
                testID={`set-remove-${set.id}`}
                variant="text"
                loading={saving}
                onPress={() => onRemove(set.id)}
              >
                Remove
              </AppButton>
            </View>
          </View>
        );
      })}
    </View>
  );
}
