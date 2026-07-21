import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { CustomExercise } from '../domain/workout';
import { useWorkoutStore } from '../application/workout.store';
import { listBuiltInExercises } from '../infrastructure/exercise-catalog.data';
import { CustomExerciseForm } from './CustomExerciseForm';
import { CustomExerciseNote } from './CustomExerciseNote';

/**
 * Exercise library (ADR-P015 Phase 16 Slice 9). The home for user CUSTOM
 * exercises: create / edit / soft-delete, plus a read-only view of the built-in
 * catalog. ALL persistence routes through the workout store → service →
 * repository (local-first write, sync enqueue); the UI never touches SQLite.
 *
 * Custom exercises carry NO medical authority — they are neutral/unmapped in the
 * deterministic iCoach exclusion matcher and never recompute or override the
 * `TrainingPlan` (D2/D5). Soft-delete is non-destructive: existing routines/logs
 * keep their reference; the exercise is only removed from new pickers.
 */

const BUILT_INS = listBuiltInExercises();

function SyncBadge({ syncStatus }: { syncStatus: CustomExercise['syncStatus'] }) {
  if (syncStatus === 'conflict') {
    return (
      <AppText variant="caption" tone="warning" accessibilityLabel="Sync conflict">
        Sync conflict
      </AppText>
    );
  }
  if (syncStatus === 'pending') {
    return (
      <AppText variant="caption" tone="muted" accessibilityLabel="Sync pending">
        Pending sync
      </AppText>
    );
  }
  return null;
}

export function ExerciseLibrary() {
  const theme = useTheme();
  const {
    status,
    customExercises,
    error,
    load,
    createCustomExercise,
    updateCustomExercise,
    removeCustomExercise,
    countRoutineReferences,
  } = useWorkoutStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [refCount, setRefCount] = useState<number | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const initialLoading = status === 'loading' && customExercises.length === 0;
  const saving = status === 'saving';

  const onAskDelete = async (id: string) => {
    setPendingDeleteId(id);
    setRefCount(null);
    const n = await countRoutineReferences(id);
    setRefCount(n);
  };

  const onConfirmDelete = async (id: string) => {
    const ok = await removeCustomExercise(id);
    if (ok) {
      setPendingDeleteId(null);
      setRefCount(null);
    }
  };

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="headline">Exercise library</AppText>
        <AppText tone="muted">
          Create your own exercises to use in routines and workouts. Saved on your device first and
          synced to your account later.
        </AppText>
      </View>

      {error ? (
        <Banner title="Something went wrong" tone="error">
          {error}
        </Banner>
      ) : null}

      <Card accessibilityLabel="Add a custom exercise">
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="title">Add a custom exercise</AppText>
          <CustomExerciseForm
            existing={customExercises}
            saving={saving}
            onSubmit={createCustomExercise}
          />
        </View>
      </Card>

      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="title">Your custom exercises</AppText>
        {initialLoading ? (
          <AppText accessibilityLabel="Loading exercises">Loading…</AppText>
        ) : customExercises.length === 0 ? (
          <AppText tone="muted">
            No custom exercises yet. Add one above to use it in your routines and workouts.
          </AppText>
        ) : (
          customExercises.map((exercise) => (
            <Card key={exercise.id} accessibilityLabel={`Custom exercise: ${exercise.name}`}>
              {editingId === exercise.id ? (
                <View style={{ gap: theme.spacing.sm }}>
                  <AppText variant="title">Edit exercise</AppText>
                  <CustomExerciseForm
                    initial={exercise}
                    existing={customExercises}
                    saving={saving}
                    onSubmit={(input) => updateCustomExercise(exercise.id, input)}
                    onDone={() => setEditingId(null)}
                    onCancel={() => setEditingId(null)}
                  />
                </View>
              ) : (
                <View style={{ gap: theme.spacing.sm }}>
                  <AppText variant="label">{exercise.name}</AppText>
                  <AppText variant="caption" tone="muted">
                    {exercise.muscleGroup} · {exercise.category}
                  </AppText>
                  <SyncBadge syncStatus={exercise.syncStatus} />
                  <CustomExerciseNote />
                  <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                    <AppButton
                      accessibilityLabel={`Edit ${exercise.name}`}
                      testID={`custom-edit-${exercise.id}`}
                      variant="secondary"
                      onPress={() => setEditingId(exercise.id)}
                    >
                      Edit
                    </AppButton>
                    <AppButton
                      accessibilityLabel={`Delete ${exercise.name}`}
                      testID={`custom-delete-${exercise.id}`}
                      variant="text"
                      onPress={() => void onAskDelete(exercise.id)}
                    >
                      Delete
                    </AppButton>
                  </View>

                  {pendingDeleteId === exercise.id ? (
                    <View
                      style={{
                        gap: theme.spacing.sm,
                        marginTop: theme.spacing.xs,
                        borderColor: theme.colors.outline,
                        borderRadius: theme.radius.medium,
                        borderWidth: 1,
                        padding: theme.spacing.sm,
                      }}
                    >
                      <AppText variant="caption">
                        {refCount === null
                          ? 'Checking where this exercise is used…'
                          : refCount > 0
                            ? `Used in ${refCount} ${refCount === 1 ? 'routine' : 'routines'} — existing routines keep it; you just can’t add it to new ones.`
                            : 'This exercise isn’t used in any routines. Existing workout history is kept.'}
                      </AppText>
                      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                        <AppButton
                          accessibilityLabel={`Confirm delete ${exercise.name}`}
                          testID={`custom-delete-confirm-${exercise.id}`}
                          loading={saving}
                          onPress={() => void onConfirmDelete(exercise.id)}
                        >
                          Confirm delete
                        </AppButton>
                        <AppButton
                          accessibilityLabel="Cancel delete"
                          testID={`custom-delete-cancel-${exercise.id}`}
                          variant="text"
                          onPress={() => {
                            setPendingDeleteId(null);
                            setRefCount(null);
                          }}
                        >
                          Cancel
                        </AppButton>
                      </View>
                    </View>
                  ) : null}
                </View>
              )}
            </Card>
          ))
        )}
      </View>

      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="title">Built-in exercises</AppText>
        <AppText variant="caption" tone="muted">
          Provided by AppFitness. These are read-only and checked against your training-plan
          restrictions.
        </AppText>
        {BUILT_INS.map((exercise) => (
          <Card key={exercise.id} accessibilityLabel={`Built-in exercise: ${exercise.name}`}>
            <View style={{ gap: theme.spacing.xs }}>
              <AppText variant="label">{exercise.name}</AppText>
              <AppText variant="caption" tone="muted">
                {exercise.muscleGroup} · {exercise.category}
              </AppText>
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}
