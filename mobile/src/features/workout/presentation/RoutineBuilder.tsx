import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { CustomExercise, Routine, RoutineExercise } from '../domain/workout';
import { useTrainingPlan } from '../application/use-training-plan';
import { useWorkoutStore } from '../application/workout.store';
import {
  getBuiltInExerciseById,
  listBuiltInExercises,
} from '../infrastructure/exercise-catalog.data';
import { CustomExerciseForm } from './CustomExerciseForm';
import { CustomExerciseNote } from './CustomExerciseNote';
import { ExerciseExclusionNote } from './ExerciseExclusionNote';
import { resolveExerciseName } from './resolve-exercise-name';
import { TrainingPlanCard } from './TrainingPlanCard';

/**
 * Routine builder (ADR-P015 Phase 16 Slice 5; TrainingPlan integration in Slice
 * 7). View / create / remove routines and manage a routine's exercises using
 * the Slice 2 built-in catalog. ALL persistence routes through the Slice 4A/4B
 * workout store → service → repository (local-first write, sync enqueue); the
 * UI never touches SQLite.
 *
 * Safety context is READ from the deterministic iCoach `TrainingPlan` (via
 * `useTrainingPlan`) — never recomputed here. `TrainingPlanCard` surfaces the
 * blocked / clearance / intensity / RPE-cap / days-per-week guidance; an
 * exercise whose movement patterns intersect the plan's `excludedMovements`
 * shows a NON-blocking caution. Medical restrictions are never overridden.
 */

const CATALOG = listBuiltInExercises();

export function RoutineBuilder() {
  const theme = useTheme();
  const {
    status,
    routines,
    routineExercises,
    customExercises,
    error,
    load,
    createRoutine,
    createCustomExercise,
    deactivateRoutine,
    loadRoutineExercises,
    addRoutineExercise,
    removeRoutineExercise,
  } = useWorkoutStore();

  // Read-only training safety context (may be absent if the dashboard has not
  // loaded yet). We never recompute it.
  const training = useTrainingPlan();
  const excludedMovements = training?.excludedMovements ?? [];

  const [name, setName] = useState('');
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [showNewExercise, setShowNewExercise] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  const initialLoading = status === 'loading' && routines.length === 0;

  const onCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const ok = await createRoutine({ name: trimmed });
    if (ok) setName('');
  };

  const onSelect = async (routine: Routine) => {
    if (selectedRoutineId === routine.id) {
      setSelectedRoutineId(null);
      return;
    }
    setSelectedRoutineId(routine.id);
    await loadRoutineExercises(routine.id);
  };

  const onAddExerciseById = (exerciseId: string) => {
    if (!selectedRoutineId) return;
    void addRoutineExercise(selectedRoutineId, {
      exerciseId,
      order: routineExercises.length,
    });
  };

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="headline">Workout routines</AppText>
        <AppText tone="muted">
          Build reusable routines from built-in and your own custom exercises. Routines are saved on
          your device first and sync to your account later.
        </AppText>
      </View>

      {error ? (
        <Banner title="Something went wrong" tone="error">
          {error}
        </Banner>
      ) : null}

      <TrainingPlanCard plan={training} />

      <Card accessibilityLabel="Create a routine">
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="title">Create a routine</AppText>
          <TextInput
            accessibilityLabel="Routine name"
            testID="routine-name"
            placeholder="e.g. Push day"
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
            accessibilityLabel="Create routine"
            testID="routine-create"
            disabled={!name.trim()}
            loading={status === 'saving'}
            onPress={() => void onCreate()}
          >
            Create routine
          </AppButton>
        </View>
      </Card>

      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="title">Your routines</AppText>
        {initialLoading ? (
          <AppText accessibilityLabel="Loading routines">Loading…</AppText>
        ) : routines.length === 0 ? (
          <AppText tone="muted">No routines yet.</AppText>
        ) : (
          routines.map((routine) => (
            <Card key={routine.id} accessibilityLabel={`Routine: ${routine.name}`}>
              <View style={{ gap: theme.spacing.sm }}>
                <AppText variant="label">{routine.name}</AppText>
                {routine.description ? (
                  <AppText variant="caption" tone="muted">
                    {routine.description}
                  </AppText>
                ) : null}
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                  <AppButton
                    accessibilityLabel={`View exercises for ${routine.name}`}
                    testID={`routine-select-${routine.id}`}
                    variant="secondary"
                    onPress={() => void onSelect(routine)}
                  >
                    {selectedRoutineId === routine.id ? 'Hide exercises' : 'View exercises'}
                  </AppButton>
                  <AppButton
                    accessibilityLabel={`Remove routine ${routine.name}`}
                    testID={`routine-remove-${routine.id}`}
                    variant="text"
                    loading={status === 'saving'}
                    onPress={() => void deactivateRoutine(routine.id)}
                  >
                    Remove
                  </AppButton>
                </View>

                {selectedRoutineId === routine.id ? (
                  <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.sm }}>
                    <ExerciseList
                      exercises={routineExercises}
                      excludedMovements={excludedMovements}
                      customExercises={customExercises}
                      onRemove={(id) => void removeRoutineExercise(id)}
                      removing={status === 'saving'}
                    />
                    <AppText variant="label" tone="muted">
                      Add an exercise
                    </AppText>

                    {showNewExercise ? (
                      <Card accessibilityLabel="New custom exercise">
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
                        accessibilityLabel="Create a new custom exercise"
                        testID="routine-new-custom-exercise"
                        variant="secondary"
                        onPress={() => setShowNewExercise(true)}
                      >
                        + New exercise
                      </AppButton>
                    )}

                    <AppText variant="caption" tone="muted">
                      Built-in
                    </AppText>
                    <View style={{ gap: theme.spacing.sm }}>
                      {CATALOG.map((exercise) => (
                        <Pressable
                          key={exercise.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Add ${exercise.name}`}
                          testID={`add-exercise-${exercise.key}`}
                          onPress={() => onAddExerciseById(exercise.id)}
                          style={{
                            borderColor: theme.colors.outline,
                            borderRadius: theme.radius.medium,
                            borderWidth: 1,
                            padding: theme.spacing.sm,
                          }}
                        >
                          <AppText>{exercise.name}</AppText>
                          <AppText variant="caption" tone="muted">
                            {exercise.muscleGroup}
                          </AppText>
                          <ExerciseExclusionNote
                            exercise={exercise}
                            excludedMovements={excludedMovements}
                          />
                        </Pressable>
                      ))}
                    </View>

                    <AppText variant="caption" tone="muted">
                      My exercises
                    </AppText>
                    {customExercises.length === 0 ? (
                      <AppText tone="muted">No custom exercises yet.</AppText>
                    ) : (
                      <View style={{ gap: theme.spacing.sm }}>
                        {customExercises.map((exercise) => (
                          <Pressable
                            key={exercise.id}
                            accessibilityRole="button"
                            accessibilityLabel={`Add ${exercise.name}`}
                            testID={`add-custom-exercise-${exercise.id}`}
                            onPress={() => onAddExerciseById(exercise.id)}
                            style={{
                              borderColor: theme.colors.outline,
                              borderRadius: theme.radius.medium,
                              borderWidth: 1,
                              padding: theme.spacing.sm,
                            }}
                          >
                            <AppText>{exercise.name}</AppText>
                            <AppText variant="caption" tone="muted">
                              {exercise.muscleGroup}
                            </AppText>
                            <CustomExerciseNote />
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                ) : null}
              </View>
            </Card>
          ))
        )}
      </View>
    </View>
  );
}

function ExerciseList({
  exercises,
  excludedMovements,
  customExercises,
  onRemove,
  removing,
}: {
  exercises: RoutineExercise[];
  excludedMovements: readonly string[];
  customExercises: readonly CustomExercise[];
  onRemove: (id: string) => void;
  removing: boolean;
}) {
  const theme = useTheme();
  if (exercises.length === 0) {
    return <AppText tone="muted">No exercises in this routine yet.</AppText>;
  }
  return (
    <View style={{ gap: theme.spacing.sm }}>
      {exercises.map((re) => {
        // A built-in resolves from the catalog; a custom from the loaded list;
        // a removed/not-yet-loaded custom shows "(removed exercise)".
        const exercise = getBuiltInExerciseById(re.exerciseId);
        const displayName = resolveExerciseName(re.exerciseId, customExercises);
        return (
          <View key={re.id} testID={`routine-exercise-${re.id}`} style={{ gap: theme.spacing.xs }}>
            <AppText variant="label">{displayName}</AppText>
            <ExerciseExclusionNote exercise={exercise} excludedMovements={excludedMovements} />
            <AppButton
              accessibilityLabel={`Remove ${displayName} from routine`}
              testID={`routine-exercise-remove-${re.id}`}
              variant="text"
              loading={removing}
              onPress={() => onRemove(re.id)}
            >
              Remove
            </AppButton>
          </View>
        );
      })}
    </View>
  );
}
