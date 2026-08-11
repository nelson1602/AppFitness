import { useEffect, useMemo } from 'react';
import { View } from 'react-native';

import { useDashboardStore } from '@/features/dashboard/application/dashboard.store';
import type {
  GeneratedWorkoutRoutine,
  Weekday,
  WorkoutExercisePrescription,
  WorkoutProgressionRule,
} from '@/features/icoach';
import { useProfileStore } from '@/features/profile/application/profile.store';
import {
  formatNumber,
  type SupportedLanguage,
  type TranslationKey,
  useLocalization,
} from '@/shared/localization';
import { AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { exerciseDisplayName } from '../application/exercise-display.service';
import {
  selectWorkoutRoutine,
  type WorkoutRoutineSelection,
} from '../application/workout-routine.service';

const WEEKDAY_KEYS: Readonly<Record<Weekday, TranslationKey>> = {
  MONDAY: 'workout.day.monday',
  TUESDAY: 'workout.day.tuesday',
  WEDNESDAY: 'workout.day.wednesday',
  THURSDAY: 'workout.day.thursday',
  FRIDAY: 'workout.day.friday',
  SATURDAY: 'workout.day.saturday',
  SUNDAY: 'workout.day.sunday',
};

/**
 * Read-only public-v1 projection of the deterministic workout generator.
 * The component loads existing profile/dashboard inputs but never persists the
 * generated routine or reads dormant medical data.
 */
export function GeneratedWorkoutPlan() {
  const dashboardStatus = useDashboardStore((state) => state.status);
  const assessment = useDashboardStore((state) => state.data?.assessment ?? null);
  const refreshDashboard = useDashboardStore((state) => state.refresh);
  const profileStatus = useProfileStore((state) => state.status);
  const profile = useProfileStore((state) => state.profile);
  const loadProfile = useProfileStore((state) => state.load);
  const { t } = useLocalization();

  useEffect(() => {
    if (dashboardStatus === 'idle') void refreshDashboard();
  }, [dashboardStatus, refreshDashboard]);

  useEffect(() => {
    if (profileStatus === 'idle') void loadProfile();
  }, [loadProfile, profileStatus]);

  const selection = useMemo(
    () =>
      profile
        ? selectWorkoutRoutine(assessment, {
            equipment: profile.equipment,
            sessionDurationMins: profile.sessionDurationMins,
            excludedMovements: [],
          })
        : ({ status: 'gap' } satisfies WorkoutRoutineSelection),
    [assessment, profile],
  );

  if (
    dashboardStatus === 'idle' ||
    dashboardStatus === 'loading' ||
    profileStatus === 'idle' ||
    profileStatus === 'loading'
  ) {
    return (
      <Card accessibilityLabel={t('workout.plan.accessibility')}>
        <AppText>{t('workout.plan.loading')}</AppText>
      </Card>
    );
  }

  if (dashboardStatus === 'error' || profileStatus === 'error') {
    return (
      <Banner title={t('workout.plan.errorTitle')} tone="error">
        {t('workout.plan.errorMessage')}
      </Banner>
    );
  }

  return <GeneratedWorkoutPlanView selection={selection} />;
}

export function GeneratedWorkoutPlanView({ selection }: { selection: WorkoutRoutineSelection }) {
  const theme = useTheme();
  const { language, t } = useLocalization();

  if (selection.status === 'gap') {
    return (
      <Banner title={t('workout.plan.gapTitle')} tone="warning">
        {t('workout.plan.gapMessage')}
      </Banner>
    );
  }
  if (selection.status === 'blocked') {
    return (
      <Banner title={t('workout.plan.blockedTitle')} tone="warning">
        {t('workout.plan.blockedMessage')}
      </Banner>
    );
  }
  if (selection.status === 'error') {
    return (
      <Banner title={t('workout.plan.errorTitle')} tone="error">
        {t('workout.plan.errorMessage')}
      </Banner>
    );
  }

  return (
    <Card accessibilityLabel={t('workout.plan.accessibility')}>
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="headline">{t('workout.plan.title')}</AppText>
          <AppText tone="muted">{t('workout.plan.subtitle')}</AppText>
        </View>

        {selection.unsupportedEquipment.length > 0 ? (
          <Banner title={t('workout.plan.unsupportedTitle')} tone="warning">
            {`${t('workout.plan.unsupportedMessage')} ${selection.unsupportedEquipment.join(', ')}`}
          </Banner>
        ) : null}

        <Schedule routine={selection.routine} />
        <Sessions routine={selection.routine} language={language} />
        <Progression routine={selection.routine} language={language} />

        <AppText variant="caption" tone="muted">
          {t('workout.plan.wellnessNotice')}
        </AppText>
      </View>
    </Card>
  );
}

function Schedule({ routine }: { routine: GeneratedWorkoutRoutine }) {
  const theme = useTheme();
  const { t } = useLocalization();
  const sessionNumbers = new Map(
    routine.sessions.map((session, index) => [session.key, index + 1]),
  );

  return (
    <View accessibilityLabel={t('workout.plan.schedule')} style={{ gap: theme.spacing.xs }}>
      <AppText variant="title">{t('workout.plan.schedule')}</AppText>
      {routine.schedule.map((day) => {
        const activity =
          day.kind === 'TRAINING'
            ? `${t('workout.plan.training')} · ${t('workout.plan.session')} ${sessionNumbers.get(day.sessionKey) ?? ''}`
            : day.recovery === 'ACTIVE_RECOVERY'
              ? t('workout.plan.activeRecovery')
              : t('workout.plan.fullRest');
        return (
          <AppText key={day.weekday}>
            {t(WEEKDAY_KEYS[day.weekday])}: {activity}
          </AppText>
        );
      })}
    </View>
  );
}

function Sessions({
  routine,
  language,
}: {
  routine: GeneratedWorkoutRoutine;
  language: SupportedLanguage;
}) {
  const theme = useTheme();
  const { t } = useLocalization();

  return (
    <View accessibilityLabel={t('workout.plan.sessions')} style={{ gap: theme.spacing.md }}>
      <AppText variant="title">{t('workout.plan.sessions')}</AppText>
      {routine.sessions.map((session, index) => (
        <View key={session.key} style={{ gap: theme.spacing.sm }}>
          <AppText variant="label">
            {t('workout.plan.session')} {index + 1} · {t('workout.plan.fullBody')}
          </AppText>
          {session.exercises.map((exercise) => (
            <Exercise key={exercise.exerciseKey} exercise={exercise} language={language} />
          ))}
        </View>
      ))}
    </View>
  );
}

function Exercise({
  exercise,
  language,
}: {
  exercise: WorkoutExercisePrescription;
  language: SupportedLanguage;
}) {
  const theme = useTheme();
  const { t } = useLocalization();
  const target =
    exercise.target.kind === 'REPETITIONS'
      ? `${exercise.target.min}–${exercise.target.max} ${t('workout.plan.reps')}`
      : `${exercise.target.seconds} ${t('workout.plan.seconds')}`;

  return (
    <View style={{ gap: theme.spacing.xs, paddingLeft: theme.spacing.sm }}>
      <AppText variant="label">{exerciseDisplayName(exercise.exerciseKey, language)}</AppText>
      <AppText variant="caption" tone="muted">
        {exercise.sets} {t('workout.plan.sets')} · {target} · {exercise.restSeconds}{' '}
        {t('workout.plan.seconds')} {t('workout.plan.rest')} · {t('workout.plan.targetRpe')}{' '}
        {exercise.targetRpe}
      </AppText>
      {exercise.substitutions.length > 0 ? (
        <AppText variant="caption" tone="muted">
          {t('workout.plan.substitutions')}:{' '}
          {exercise.substitutions
            .map(({ exerciseKey }) => exerciseDisplayName(exerciseKey, language))
            .join(', ')}
        </AppText>
      ) : null}
    </View>
  );
}

function Progression({
  routine,
  language,
}: {
  routine: GeneratedWorkoutRoutine;
  language: SupportedLanguage;
}) {
  const theme = useTheme();
  const { t } = useLocalization();
  const labels = {
    addDuration: t('workout.plan.addDuration'),
    addLoad: t('workout.plan.addLoad'),
    addRepetitions: t('workout.plan.addRepetitions'),
  };

  return (
    <View accessibilityLabel={t('workout.plan.progression')} style={{ gap: theme.spacing.sm }}>
      <AppText variant="title">{t('workout.plan.progression')}</AppText>
      {routine.progression.map((rule) => (
        <View key={rule.id} style={{ gap: theme.spacing.xs }}>
          <AppText>
            {t('workout.plan.afterSessions')} {rule.requiredSuccessfulSessions}:{' '}
            {progressionInstruction(rule, language, labels)}.
          </AppText>
          <AppText variant="caption" tone="muted">
            {rule.appliesToExerciseKeys
              .map((exerciseKey) => exerciseDisplayName(exerciseKey, language))
              .join(', ')}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function progressionInstruction(
  rule: WorkoutProgressionRule,
  language: SupportedLanguage,
  labels: { addDuration: string; addLoad: string; addRepetitions: string },
): string {
  if (rule.loadIncreasePct !== null) {
    return `${labels.addLoad} ${formatNumber(rule.loadIncreasePct, language)}%`;
  }
  if (rule.repetitionIncrease !== null) {
    return `${labels.addRepetitions} +${rule.repetitionIncrease}`;
  }
  return `${labels.addDuration} +${rule.durationIncreaseSeconds ?? 0}`;
}
