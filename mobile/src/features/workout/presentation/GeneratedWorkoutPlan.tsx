import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useDashboardStore } from '@/features/dashboard/application/dashboard.store';
import type {
  GeneratedWorkoutRoutine,
  Weekday,
  WorkoutExercisePrescription,
  WorkoutProgressionRule,
} from '@/features/icoach';
import { useProfileStore } from '@/features/profile/application/profile.store';
import { useWeeklyPlanStore } from '@/features/weekly-plan/application/weekly-plan.store';
import { planAsRoutine } from '@/features/weekly-plan/domain/plan-routine';
// Direct import: the barrel would also load the subscription store composition.
import { SubscriptionAccessNotice } from '@/features/subscriptions/presentation/SubscriptionAccessNotice';
import { useEntitlementAccess } from '@/shared/application/use-entitlement-access';
import {
  formatNumber,
  interpolate,
  type SupportedLanguage,
  type TranslationKey,
  useLocalization,
} from '@/shared/localization';
import {
  AppButton,
  AppText,
  Banner,
  Card,
  Chip,
  GlassCard,
  Icon,
  withAlpha,
} from '@/shared/presentation';
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
  // The read outcome, so this surface can tell an unreadable declaration
  // (ADR-P031 §Decision 8) from a generic dashboard failure and say the
  // right thing about it.
  const wellnessRead = useDashboardStore((state) => state.data?.wellness ?? 'absent');
  const refreshDashboard = useDashboardStore((state) => state.refresh);
  const profileStatus = useProfileStore((state) => state.status);
  const profile = useProfileStore((state) => state.profile);
  const loadProfile = useProfileStore((state) => state.load);
  const { t } = useLocalization();
  const entitlement = useEntitlementAccess();
  const generationAllowed = entitlement.mode === 'unregulated' || entitlement.mode === 'active';

  useEffect(() => {
    if (dashboardStatus === 'idle') void refreshDashboard();
  }, [dashboardStatus, refreshDashboard]);

  useEffect(() => {
    if (profileStatus === 'idle') void loadProfile();
  }, [loadProfile, profileStatus]);

  const planRevisions = useWeeklyPlanStore((state) => state.revisions);

  const live = useMemo(
    () =>
      profile
        ? generationAllowed
          ? selectWorkoutRoutine(assessment, {
              equipment: profile.equipment,
              sessionDurationMins: profile.sessionDurationMins,
              // ADR-P031 W-4D: the assessment’s own exclusion set, not `[]`.
              // Same list, same order, so the routine can never contain what
              // the assessment says was excluded.
              excludedMovements: assessment?.assessment.training.excludedMovements ?? [],
            })
          : ({ status: 'gap' } satisfies WorkoutRoutineSelection)
        : ({ status: 'gap' } satisfies WorkoutRoutineSelection),
    [assessment, generationAllowed, profile],
  );
  // v8 Block 3 (ADR-P042): "Ver plan completo" shows the saved week the
  // Entrenamientos tab shows — with the days earned through ADR-P040 D11 —
  // and keeps the live routine's progression rules and equipment notes. The
  // live routine stays the fallback until the week's plan exists.
  const selection = useMemo<WorkoutRoutineSelection>(() => {
    const saved = generationAllowed ? planAsRoutine(planRevisions) : null;
    if (!saved || live.status !== 'ready') return live;
    return { ...live, routine: { ...saved, progression: live.routine.progression } };
  }, [generationAllowed, live, planRevisions]);

  if (!generationAllowed) return <SubscriptionAccessNotice />;

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

  // An unreadable declaration outranks the generic failure: the plan must not
  // be presented as respecting limitations the app could not read, and it is
  // not Empty, not Data-gap and not a crash.
  if (wellnessRead === 'unavailable') {
    return (
      <Banner title={t('workout.plan.wellnessUnavailableTitle')} tone="error">
        {t('workout.plan.wellnessUnavailableBody')}
      </Banner>
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

const WEEKDAYS: readonly Weekday[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

const WEEKDAY_SHORT_KEYS: Readonly<Record<Weekday, TranslationKey>> = {
  MONDAY: 'workouts.dayShort.monday',
  TUESDAY: 'workouts.dayShort.tuesday',
  WEDNESDAY: 'workouts.dayShort.wednesday',
  THURSDAY: 'workouts.dayShort.thursday',
  FRIDAY: 'workouts.dayShort.friday',
  SATURDAY: 'workouts.dayShort.saturday',
  SUNDAY: 'workouts.dayShort.sunday',
};

/** The 44 dp floor for every target on this screen (BUG-023). */
const TARGET = 44;

/**
 * "Plan completo" in the prototype's language (v8 Block 3,
 * docs/design/appfitnessrd-prototipo.html, Entrenamientos): the week as a day
 * strip, the chosen day's session (or rest) in a glass panel, the week's
 * sessions as a list, then how to progress. It opens on today.
 */
export function GeneratedWorkoutPlanView({
  selection,
  today = new Date(),
}: {
  selection: WorkoutRoutineSelection;
  /** Injected by tests; the screen uses the device clock. */
  today?: Date;
}) {
  const theme = useTheme();
  const { language, t } = useLocalization();
  const todayWeekday = WEEKDAYS[(today.getDay() + 6) % 7];
  const [selected, setSelected] = useState<Weekday>(todayWeekday);

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
    // Insufficient catalogue coverage is a catalogue limitation, not a user
    // mistake: every declared exclusion is kept, and reviewing the
    // declarations is offered without implying that removing one is the fix
    // (ADR-P031 §Decision 15). No missing pattern and no token is named.
    const coverage = selection.code === 'INSUFFICIENT_CATALOG_COVERAGE';
    return (
      <Banner
        title={t(coverage ? 'workout.plan.coverageTitle' : 'workout.plan.errorTitle')}
        tone="error"
      >
        {t(coverage ? 'workout.plan.coverageBody' : 'workout.plan.errorMessage')}
      </Banner>
    );
  }

  const { routine } = selection;
  // Localized where the number is produced, so the strip, the panel and the
  // list always read the same session the same way.
  const sessionName = (sessionKey: string) => {
    const index = routine.sessions.findIndex((session) => session.key === sessionKey);
    return `${t('workout.plan.session')} ${formatNumber(index + 1, language)} · ${t('workout.plan.fullBody')}`;
  };
  const selectedDay = routine.schedule.find((day) => day.weekday === selected);

  return (
    <View accessibilityLabel={t('workout.plan.accessibility')} style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="title">{t('workout.plan.title')}</AppText>
        <AppText tone="muted">{t('workout.plan.subtitle')}</AppText>
      </View>

      {selection.unsupportedEquipment.length > 0 ? (
        <Banner title={t('workout.plan.unsupportedTitle')} tone="warning">
          {`${t('workout.plan.unsupportedMessage')} ${selection.unsupportedEquipment.join(', ')}`}
        </Banner>
      ) : null}

      <WeekStrip routine={routine} selected={selected} onSelect={setSelected} />

      {selectedDay?.kind === 'TRAINING' ? (
        <SessionPanel
          isToday={selected === todayWeekday}
          routine={routine}
          sessionKey={selectedDay.sessionKey}
          title={sessionName(selectedDay.sessionKey)}
          weekday={selected}
        />
      ) : (
        <GlassCard testID="plan-rest-day">
          <View style={[styles.row, { gap: theme.spacing.sm }]}>
            <Icon color={theme.colors.linkOnStage} name="heart" size={17} />
            <AppText accessibilityRole="header" style={styles.grow} variant="title">
              {t('workout.plan.restDay')}
            </AppText>
          </View>
          <AppText tone="muted">
            {t(
              selectedDay?.kind === 'RECOVERY' && selectedDay.recovery === 'ACTIVE_RECOVERY'
                ? 'workout.plan.restDayActive'
                : 'workout.plan.restDayFull',
            )}
          </AppText>
        </GlassCard>
      )}

      <GlassCard>
        <View style={[styles.row, { gap: theme.spacing.sm }]}>
          <Icon color={theme.colors.linkOnStage} name="dumbbell" size={17} />
          <AppText accessibilityRole="header" style={styles.grow} variant="title">
            {t('workout.plan.weekPlan')}
          </AppText>
          <Chip label={t('workouts.week.renews')} testID="plan-week-renews" />
        </View>
        <View>
          {routine.schedule
            .filter((day) => day.kind === 'TRAINING')
            .map((day, index) => {
              if (day.kind !== 'TRAINING') return null;
              const dayName = t(WEEKDAY_KEYS[day.weekday]);
              return (
                <Pressable
                  key={day.weekday}
                  accessibilityLabel={`${dayName}: ${sessionName(day.sessionKey)}`}
                  accessibilityRole="button"
                  onPress={() => setSelected(day.weekday)}
                  style={[
                    styles.row,
                    {
                      borderTopColor: theme.colors.glassBorder,
                      borderTopWidth: index > 0 ? StyleSheet.hairlineWidth : 0,
                      gap: theme.spacing.md,
                      minHeight: TARGET,
                      paddingVertical: theme.spacing.sm,
                    },
                  ]}
                  testID={`plan-week-row-${day.weekday}`}
                >
                  <View style={styles.grow}>
                    <AppText style={{ color: theme.colors.linkOnStage }} variant="caption">
                      {dayName}
                    </AppText>
                    <AppText variant="label">{sessionName(day.sessionKey)}</AppText>
                  </View>
                  {day.weekday === todayWeekday ? (
                    <Chip label={t('workouts.week.today')} testID="plan-week-today" tone="energy" />
                  ) : null}
                </Pressable>
              );
            })}
        </View>
      </GlassCard>

      <Progression routine={routine} language={language} />

      <AppText variant="caption" tone="muted">
        {t('workout.plan.wellnessNotice')}
      </AppText>
    </View>
  );
}

function WeekStrip({
  routine,
  selected,
  onSelect,
}: {
  routine: GeneratedWorkoutRoutine;
  selected: Weekday;
  onSelect: (weekday: Weekday) => void;
}) {
  const { colors, radius, spacing } = useTheme();
  const { t } = useLocalization();
  return (
    <View
      accessibilityLabel={t('workout.plan.weekStrip')}
      accessibilityRole="tablist"
      style={[styles.row, { gap: spacing.xs }]}
    >
      {WEEKDAYS.map((weekday) => {
        const active = weekday === selected;
        const training = routine.schedule.some(
          (day) => day.weekday === weekday && day.kind === 'TRAINING',
        );
        const dayName = t(WEEKDAY_KEYS[weekday]);
        return (
          <Pressable
            key={weekday}
            accessibilityLabel={interpolate(
              t(training ? 'workouts.week.training' : 'workouts.week.rest'),
              { day: dayName },
            )}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(weekday)}
            style={{
              alignItems: 'center',
              backgroundColor: active ? colors.accentCyan : colors.glassFill,
              borderColor: active ? colors.linkOnStage : colors.glassBorder,
              borderRadius: radius.large,
              borderWidth: 1,
              flex: 1,
              gap: spacing.xs,
              justifyContent: 'center',
              minHeight: 60,
            }}
            testID={`plan-week-day-${weekday}`}
          >
            <AppText style={{ color: active ? colors.stageDeep : colors.onStage }} variant="label">
              {t(WEEKDAY_SHORT_KEYS[weekday])}
            </AppText>
            <View
              style={{
                backgroundColor: training
                  ? active
                    ? colors.stageDeep
                    : colors.accentEnergy
                  : 'transparent',
                borderRadius: 3,
                height: 6,
                width: 6,
              }}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

function SessionPanel({
  routine,
  sessionKey,
  title,
  weekday,
  isToday,
}: {
  routine: GeneratedWorkoutRoutine;
  sessionKey: string;
  title: string;
  weekday: Weekday;
  isToday: boolean;
}) {
  const theme = useTheme();
  const { language, t } = useLocalization();
  const session = routine.sessions.find((candidate) => candidate.key === sessionKey);
  return (
    <GlassCard testID="plan-session-panel">
      <View style={{ gap: theme.spacing.xs }}>
        <View style={[styles.row, { gap: theme.spacing.sm }]}>
          <Icon color={theme.colors.linkOnStage} name="sparkle" size={17} />
          <AppText accessibilityRole="header" style={styles.grow} variant="title">
            {title}
          </AppText>
        </View>
        <AppText tone="muted" variant="caption">
          {interpolate(t('workout.plan.byICoach'), { day: t(WEEKDAY_KEYS[weekday]) })}
        </AppText>
      </View>
      <View style={{ gap: theme.spacing.sm }}>
        {(session?.exercises ?? []).map((exercise) => (
          <Exercise key={exercise.exerciseKey} exercise={exercise} language={language} />
        ))}
      </View>
      {isToday ? (
        <AppButton onPress={() => router.push('/workout-log')} testID="plan-session-start">
          {t('home.coach.start')}
        </AppButton>
      ) : null}
    </GlassCard>
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
      ? `${formatNumber(exercise.target.min, language)}–${formatNumber(exercise.target.max, language)} ${t('workout.plan.reps')}`
      : `${formatNumber(exercise.target.seconds, language)} ${t('workout.plan.seconds')}`;

  return (
    <View
      style={{
        backgroundColor: theme.colors.glassFill,
        borderRadius: theme.radius.large,
        gap: theme.spacing.xs,
        padding: theme.spacing.md,
      }}
    >
      <AppText variant="label">{exerciseDisplayName(exercise.exerciseKey, language)}</AppText>
      <AppText variant="caption" tone="muted">
        {formatNumber(exercise.sets, language)} {t('workout.plan.sets')} · {target} ·{' '}
        {formatNumber(exercise.restSeconds, language)} {t('workout.plan.seconds')}{' '}
        {t('workout.plan.rest')} · {t('workout.plan.targetRpe')}{' '}
        {formatNumber(exercise.targetRpe, language)}
      </AppText>
      {/* One mark per set, as in the prototype; decorative (the count is read above). */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.row, { gap: theme.spacing.xs }]}
      >
        {Array.from({ length: exercise.sets }, (_, set) => (
          <View
            key={set}
            style={{
              backgroundColor: withAlpha(theme.colors.onStage, 0.15),
              borderRadius: 3,
              height: 6,
              width: 20,
            }}
          />
        ))}
      </View>
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
    <GlassCard accessibilityLabel={t('workout.plan.progression')}>
      <View style={[styles.row, { gap: theme.spacing.sm }]}>
        <Icon color={theme.colors.linkOnStage} name="chart" size={17} />
        <AppText accessibilityRole="header" style={styles.grow} variant="title">
          {t('workout.plan.progression')}
        </AppText>
      </View>
      {routine.progression.map((rule) => (
        <View key={rule.id} style={{ gap: theme.spacing.xs }}>
          {/* The count is substituted into the sentence instead of appended after
              it: `After successful sessions 2` and `Después de sesiones exitosas
              2` put the number outside the phrase it belongs to. */}
          <AppText>
            {interpolate(t('workout.plan.afterSessions'), {
              count: formatNumber(rule.requiredSuccessfulSessions, language),
            })}
            : {progressionInstruction(rule, language, labels)}.
          </AppText>
          <AppText variant="caption" tone="muted">
            {rule.appliesToExerciseKeys
              .map((exerciseKey) => exerciseDisplayName(exerciseKey, language))
              .join(', ')}
          </AppText>
        </View>
      ))}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  row: { alignItems: 'center', flexDirection: 'row' },
});

function progressionInstruction(
  rule: WorkoutProgressionRule,
  language: SupportedLanguage,
  labels: { addDuration: string; addLoad: string; addRepetitions: string },
): string {
  if (rule.loadIncreasePct !== null) {
    return `${labels.addLoad} ${formatNumber(rule.loadIncreasePct, language)}%`;
  }
  if (rule.repetitionIncrease !== null) {
    return `${labels.addRepetitions} +${formatNumber(rule.repetitionIncrease, language)}`;
  }
  return `${labels.addDuration} +${formatNumber(rule.durationIncreaseSeconds ?? 0, language)}`;
}
