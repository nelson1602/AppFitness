import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useDashboardStore } from '@/features/dashboard/application/dashboard.store';
import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { BuiltInExercise } from '../domain/exercise-catalog';
import { matchExerciseExclusion } from '../domain/exercise-exclusion';
import type { Routine, RoutineExercise } from '../domain/workout';
import { useWorkoutStore } from '../application/workout.store';
import {
  getBuiltInExerciseById,
  listBuiltInExercises,
} from '../infrastructure/exercise-catalog.data';

/**
 * Routine builder (ADR-P015 Phase 16 Slice 5). View / create / remove routines
 * and manage a routine's exercises using the Slice 2 built-in catalog. ALL
 * persistence routes through the Slice 4A/4B workout store → service →
 * repository (local-first write, sync enqueue); the UI never touches SQLite.
 *
 * Safety context is READ from the deterministic iCoach `TrainingPlan` already
 * assembled by the dashboard store — never recomputed here. A blocked /
 * clearance-required plan shows a prominent notice; an exercise whose movement
 * patterns intersect the plan's `excludedMovements` shows a NON-blocking
 * caution (via `matchExerciseExclusion`). Medical restrictions are never
 * overridden. Workout logging (start/finish + sets) belongs to Slice 6.
 */

const CATALOG = listBuiltInExercises();

function ExclusionNote({
  exercise,
  excludedMovements,
}: {
  exercise: BuiltInExercise | undefined;
  excludedMovements: readonly string[];
}) {
  const match = matchExerciseExclusion(exercise, excludedMovements);
  if (match.status !== 'excluded') return null;
  return (
    <AppText variant="caption" tone="warning">
      May conflict with your current plan: {match.matchedMovements.join(', ')}
    </AppText>
  );
}

export function RoutineBuilder() {
  const theme = useTheme();
  const {
    status,
    routines,
    routineExercises,
    error,
    load,
    createRoutine,
    deactivateRoutine,
    loadRoutineExercises,
    addRoutineExercise,
    removeRoutineExercise,
  } = useWorkoutStore();

  // Read-only training safety context (may be absent if the dashboard has not
  // loaded yet). We never recompute it.
  const training = useDashboardStore((s) => s.data?.assessment?.assessment.training ?? null);
  const excludedMovements = training?.excludedMovements ?? [];

  const [name, setName] = useState('');
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);

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

  const onAddExercise = (exercise: BuiltInExercise) => {
    if (!selectedRoutineId) return;
    void addRoutineExercise(selectedRoutineId, {
      exerciseId: exercise.id,
      order: routineExercises.length,
    });
  };

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="headline">Workout routines</AppText>
        <AppText tone="muted">
          Build reusable routines from the built-in exercise library. Routines are saved on your
          device first and sync to your account later. Logging your sets arrives in the next update.
        </AppText>
      </View>

      {error ? (
        <Banner title="Something went wrong" tone="error">
          {error}
        </Banner>
      ) : null}

      {training?.blocked ? (
        <Banner title="Training is on hold" tone="error">
          Your iCoach assessment has paused training based on your medical information. You can
          still plan routines, but do not start training until your restrictions are cleared.
        </Banner>
      ) : training?.requiresMedicalClearance ? (
        <Banner title="Medical clearance recommended" tone="warning">
          Your iCoach assessment suggests getting medical clearance before training. Plan carefully
          and check with a professional first.
        </Banner>
      ) : null}

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
                      onRemove={(id) => void removeRoutineExercise(id)}
                      removing={status === 'saving'}
                    />
                    <AppText variant="label" tone="muted">
                      Add an exercise
                    </AppText>
                    <View style={{ gap: theme.spacing.sm }}>
                      {CATALOG.map((exercise) => (
                        <Pressable
                          key={exercise.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Add ${exercise.name}`}
                          testID={`add-exercise-${exercise.key}`}
                          onPress={() => onAddExercise(exercise)}
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
                          <ExclusionNote
                            exercise={exercise}
                            excludedMovements={excludedMovements}
                          />
                        </Pressable>
                      ))}
                    </View>
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
  onRemove,
  removing,
}: {
  exercises: RoutineExercise[];
  excludedMovements: readonly string[];
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
        const exercise = getBuiltInExerciseById(re.exerciseId);
        return (
          <View key={re.id} testID={`routine-exercise-${re.id}`} style={{ gap: theme.spacing.xs }}>
            <AppText variant="label">{exercise?.name ?? 'Exercise'}</AppText>
            <ExclusionNote exercise={exercise} excludedMovements={excludedMovements} />
            <AppButton
              accessibilityLabel={`Remove ${exercise?.name ?? 'exercise'} from routine`}
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
