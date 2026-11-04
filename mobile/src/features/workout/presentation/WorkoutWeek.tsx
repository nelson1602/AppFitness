import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type {
  GeneratedWorkoutRoutine,
  Weekday,
  WorkoutExercisePrescription,
} from '@/features/icoach';
import type { PlanNote } from '@/features/weekly-plan/domain/weekly-plan';
import { noteText } from '@/features/weekly-plan/presentation/PastWeeksPanel';
import {
  formatDate,
  formatNumber,
  interpolate,
  type SupportedLanguage,
  useLocalization,
} from '@/shared/localization';
import {
  AppText,
  backgroundImageStyle,
  Banner,
  Chip,
  GlassCard,
  Icon,
  ProgressBar,
  withAlpha,
} from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { exerciseDisplayName } from '../application/exercise-display.service';
import {
  type PlannedExercise,
  sessionComplete,
  usePlannedSessionStore,
} from '../application/planned-session.store';
import { demoMotionFor } from '../domain/exercise-demo';
import { figureFor } from '../domain/exercise-figure';
import { DEMO_CUE_KEYS } from './exercise-demo-copy';
import { ExerciseFigure } from './ExerciseFigure';
import { WEEKDAY_KEYS, WEEKDAY_SHORT_KEYS, WEEKDAYS } from './weekday-labels';

export interface WorkoutWeekProps {
  routine: GeneratedWorkoutRoutine;
  /** The person's session length, shown as the session's "{min} min" chip. */
  sessionMinutes: number | null;
  /** The saved week's iCoach notes, shown as chips on the session. */
  notes: readonly PlanNote[];
  /** Dates (YYYY-MM-DD) whose planned session is done, from the week's adherence. */
  doneDates: ReadonlySet<string>;
  /** This week's dates, Monday first. */
  weekDates: readonly string[];
  /** Index of today in the week, Monday = 0. */
  todayIndex: number;
  /**
   * First day of the plan (YYYY-MM-DD) in the person's first week, else null.
   * Earlier days are not part of the plan (v10 Block A, item 2).
   */
  planStart: string | null;
}

/** Repetitions recorded for a completed set: the prescription's upper bound. */
function repsFor(exercise: WorkoutExercisePrescription): number | null {
  return exercise.target.kind === 'REPETITIONS' ? exercise.target.max : null;
}

function plannedExercises(exercises: readonly WorkoutExercisePrescription[]): PlannedExercise[] {
  return exercises.map((exercise) => ({
    exerciseKey: exercise.exerciseKey,
    sets: exercise.sets,
    reps: repsFor(exercise),
  }));
}

/**
 * Entrenamientos in the prototype's layout (v8.1, docs/design prototype
 * `tab === 'entrenamientos'`): the 7-day strip, the rest timer after a set,
 * the chosen day's session (minutes, iCoach notes, sets progress, one row per
 * exercise with its set pills, "Ver cómo se hace" and "Serie N") or the rest
 * day, then "Plan de la semana" with Hecho / Hoy / Pendiente.
 */
export function WorkoutWeek({
  routine,
  sessionMinutes,
  notes,
  doneDates,
  weekDates,
  todayIndex,
  planStart,
}: WorkoutWeekProps) {
  const { colors, spacing } = useTheme();
  const { language, t } = useLocalization();
  const [selectedIndex, setSelectedIndex] = useState(todayIndex);
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const selectedWeekday = WEEKDAYS[selectedIndex];
  const selectedDay = routine.schedule.find((day) => day.weekday === selectedWeekday);
  const beforeStart = (index: number) => planStart !== null && (weekDates[index] ?? '') < planStart;
  const selectedDate = weekDates[selectedIndex] ?? '';
  // Today and the earlier days of this week can be logged, with their own date
  // (v10 Block A, item 3); later days only show their plan.
  const canLog = selectedIndex <= todayIndex && !beforeStart(selectedIndex);
  const selectedSessionKey =
    selectedDay?.kind === 'TRAINING' && canLog ? selectedDay.sessionKey : null;
  const loadPlanned = usePlannedSessionStore((s) => s.load);

  useEffect(() => {
    if (selectedSessionKey) void loadPlanned(selectedSessionKey, undefined, selectedDate);
  }, [loadPlanned, selectedSessionKey, selectedDate]);

  const sessionName = (sessionKey: string) => {
    const index = routine.sessions.findIndex((session) => session.key === sessionKey);
    return `${t('workout.plan.session')} ${formatNumber(index + 1, language)} · ${t('workout.plan.fullBody')}`;
  };

  return (
    <View style={{ gap: spacing.lg }} testID="workout-week">
      <DayStrip
        beforeStart={beforeStart}
        doneDates={doneDates}
        onSelect={setSelectedIndex}
        routine={routine}
        selectedIndex={selectedIndex}
        todayIndex={todayIndex}
        weekDates={weekDates}
      />

      {restUntil !== null ? (
        <RestTimer onDone={() => setRestUntil(null)} until={restUntil} />
      ) : null}

      {beforeStart(selectedIndex) && planStart !== null ? (
        <GlassCard testID="workout-before-start">
          <View style={[styles.row, { gap: spacing.sm }]}>
            <Icon color={colors.linkOnStage} name="calendar" size={18} />
            <AppText accessibilityRole="header" style={styles.grow} variant="panelTitle">
              {t('workout.plan.beforeStartTitle')}
            </AppText>
          </View>
          <AppText tone="onStageVariant">
            {interpolate(t('workout.plan.beforeStartBody'), {
              date: formatDate(new Date(`${planStart}T12:00:00`), language, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              }),
            })}
          </AppText>
        </GlassCard>
      ) : selectedDay?.kind === 'TRAINING' ? (
        <SessionPanel
          canLog={canLog}
          date={selectedDate}
          isToday={selectedIndex === todayIndex}
          language={language}
          minutes={sessionMinutes}
          notes={notes}
          onSetDone={(restSeconds) =>
            setRestUntil(restSeconds > 0 ? Date.now() + restSeconds * 1000 : null)
          }
          routine={routine}
          sessionKey={selectedDay.sessionKey}
          title={sessionName(selectedDay.sessionKey)}
          weekday={selectedWeekday}
          doneOnDate={doneDates.has(weekDates[selectedIndex] ?? '')}
        />
      ) : (
        <GlassCard testID="workout-rest-day">
          <View style={[styles.row, { gap: spacing.sm }]}>
            <Icon color={colors.linkOnStage} name="moon" size={18} />
            <AppText accessibilityRole="header" style={styles.grow} variant="panelTitle">
              {t('workout.plan.restDay')}
            </AppText>
          </View>
          <AppText tone="onStageVariant">
            {t(
              selectedDay?.kind === 'RECOVERY' && selectedDay.recovery === 'ACTIVE_RECOVERY'
                ? 'workout.plan.restDayActive'
                : 'workout.plan.restDayFull',
            )}
          </AppText>
        </GlassCard>
      )}

      <WeekPlanPanel
        beforeStart={beforeStart}
        doneDates={doneDates}
        onSelect={setSelectedIndex}
        routine={routine}
        sessionName={sessionName}
        todayIndex={todayIndex}
        weekDates={weekDates}
      />
    </View>
  );
}

function DayStrip({
  routine,
  selectedIndex,
  todayIndex,
  doneDates,
  weekDates,
  onSelect,
  beforeStart,
}: {
  beforeStart: (index: number) => boolean;
  routine: GeneratedWorkoutRoutine;
  selectedIndex: number;
  todayIndex: number;
  doneDates: ReadonlySet<string>;
  weekDates: readonly string[];
  onSelect: (index: number) => void;
}) {
  const theme = useTheme();
  const { colors, radius, spacing } = theme;
  const { t } = useLocalization();
  return (
    <View
      accessibilityLabel={t('workouts.week.strip')}
      accessibilityRole="tablist"
      style={[styles.row, { gap: spacing.xs }]}
      testID="workout-day-strip"
    >
      {WEEKDAYS.map((weekday, index) => {
        const active = index === selectedIndex;
        // A day before the plan started is neither a session nor missed.
        const training =
          !beforeStart(index) &&
          routine.schedule.some((day) => day.weekday === weekday && day.kind === 'TRAINING');
        const done = training && doneDates.has(weekDates[index] ?? '');
        const dayName = t(WEEKDAY_KEYS[weekday]);
        // The prototype's dot: green once done, dark on the chosen day,
        // orange for a planned session, none on a rest day.
        const dot = !training
          ? 'transparent'
          : done
            ? colors.success
            : active
              ? colors.stageDeep
              : colors.accentEnergy;
        return (
          <Pressable
            key={weekday}
            accessibilityLabel={interpolate(
              t(training ? 'workouts.week.training' : 'workouts.week.rest'),
              { day: dayName },
            )}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(index)}
            style={{
              alignItems: 'center',
              backgroundColor: active ? colors.accentCyan : colors.glassFill,
              borderColor: active ? colors.linkOnStage : colors.glassBorder,
              borderRadius: radius.large,
              borderWidth: 1,
              flex: 1,
              gap: spacing.xs,
              justifyContent: 'center',
              minHeight: theme.spacing.x5l,
              paddingVertical: spacing.sm,
            }}
            testID={`workout-day-${index}`}
          >
            <AppText style={{ color: active ? colors.stageDeep : colors.onStage }} variant="label">
              {t(WEEKDAY_SHORT_KEYS[weekday])}
            </AppText>
            <View
              style={{
                backgroundColor: dot,
                borderRadius: radius.full,
                height: 6,
                width: 6,
              }}
              testID={`workout-day-${index}-dot`}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

function RestTimer({ until, onDone }: { until: number; onDone: () => void }) {
  const theme = useTheme();
  const { colors, radius, spacing } = theme;
  const { language, t } = useLocalization();
  const [now, setNow] = useState(() => Date.now());
  const left = Math.max(0, Math.ceil((until - now) / 1000));

  useEffect(() => {
    if (left <= 0) {
      onDone();
      return;
    }
    const id = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(id);
  }, [left, now, onDone]);

  const time = `${formatNumber(Math.floor(left / 60), language)}:${String(left % 60).padStart(2, '0')}`;
  return (
    <View
      accessibilityLabel={interpolate(t('workouts.rest.a11y'), { time })}
      accessibilityLiveRegion="polite"
      style={[
        styles.row,
        {
          backgroundColor: withAlpha(colors.accentCyan, 0.12),
          borderColor: withAlpha(colors.accentCyan, 0.4),
          borderRadius: radius.large,
          borderWidth: 1,
          gap: spacing.md,
          padding: spacing.md,
        },
      ]}
      testID="workout-rest-timer"
    >
      <Icon color={colors.linkOnStage} name="timer" size={22} />
      <View style={styles.grow}>
        <AppText tone="onStageVariant" variant="caption">
          {t('workouts.rest.title')}
        </AppText>
        <AppText variant="title">{time}</AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onDone}
        style={{
          alignItems: 'center',
          backgroundColor: colors.glassFill,
          borderRadius: radius.field,
          justifyContent: 'center',
          minHeight: theme.spacing.x5l,
          paddingHorizontal: spacing.md,
        }}
        testID="workout-rest-skip"
      >
        <AppText variant="label">{t('workouts.rest.skip')}</AppText>
      </Pressable>
    </View>
  );
}

function SessionPanel({
  routine,
  sessionKey,
  title,
  weekday,
  isToday,
  canLog,
  date,
  doneOnDate,
  minutes,
  notes,
  language,
  onSetDone,
}: {
  routine: GeneratedWorkoutRoutine;
  sessionKey: string;
  title: string;
  weekday: Weekday;
  isToday: boolean;
  /** Today or an earlier day of this week since the plan started. */
  canLog: boolean;
  /** The selected day (YYYY-MM-DD); sets are recorded on it. */
  date: string;
  doneOnDate: boolean;
  minutes: number | null;
  notes: readonly PlanNote[];
  language: SupportedLanguage;
  onSetDone: (restSeconds: number) => void;
}) {
  const theme = useTheme();
  const { colors, radius, spacing } = theme;
  const { t } = useLocalization();
  const [demo, setDemo] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const done = usePlannedSessionStore((s) => s.done);
  const saving = usePlannedSessionStore((s) => s.status === 'saving');
  const completeSet = usePlannedSessionStore((s) => s.completeSet);
  const completeSession = usePlannedSessionStore((s) => s.completeSession);
  const loadedFor = usePlannedSessionStore((s) => s.sessionId);
  const session = routine.sessions.find((candidate) => candidate.key === sessionKey);
  const exercises = session?.exercises ?? [];
  const planned = plannedExercises(exercises);
  // Set progress belongs to the selected day; later days show their plan only.
  const ownCounts = canLog && loadedFor === `${date}|${sessionKey}`;
  const madeOf = (key: string) => (ownCounts ? (done[key] ?? 0) : 0);
  const total = planned.reduce((sum, x) => sum + x.sets, 0);
  const made = planned.reduce((sum, x) => sum + Math.min(madeOf(x.exerciseKey), x.sets), 0);
  const complete = doneOnDate || (ownCounts && sessionComplete(planned, done));
  const noteChips = notes
    .map((note) => noteText([note], t, language))
    .filter((text) => text !== t('plan.note.none'))
    .slice(0, 2);

  return (
    <GlassCard testID="workout-session-panel">
      <View style={{ gap: spacing.xs }}>
        <View style={[styles.row, styles.wrap, { gap: spacing.sm }]}>
          <Icon color={colors.linkOnStage} name="sparkle" size={18} />
          <AppText accessibilityRole="header" style={styles.grow} variant="panelTitle">
            {title}
          </AppText>
          {minutes ? (
            <Chip
              label={interpolate(t('workouts.session.minutes'), {
                minutes: formatNumber(minutes, language),
              })}
              testID="workout-session-minutes"
              tone="cyan"
            />
          ) : null}
        </View>
        <AppText tone="onStageVariant" variant="caption">
          {interpolate(t('workout.plan.byICoach'), { day: t(WEEKDAY_KEYS[weekday]) })}
        </AppText>
      </View>

      {noteChips.length > 0 ? (
        <View style={[styles.row, styles.wrap, { gap: spacing.xs }]} testID="workout-notes">
          {noteChips.map((text) => (
            <Chip key={text} label={text} tone="energy" />
          ))}
        </View>
      ) : null}

      <View style={[styles.row, { gap: spacing.md }]}>
        <View style={styles.grow}>
          <ProgressBar
            accessibilityLabel={interpolate(t('workouts.session.progressA11y'), {
              done: formatNumber(made, language),
              total: formatNumber(total, language),
            })}
            tone="cyan"
            value={total > 0 ? made / total : 0}
          />
        </View>
        <AppText tone="onStageVariant" variant="caption">
          {interpolate(t('workouts.session.setsProgress'), {
            done: formatNumber(made, language),
            total: formatNumber(total, language),
          })}
        </AppText>
      </View>

      {canLog && !isToday && !complete ? (
        <View style={{ gap: spacing.sm }} testID="workout-past-day">
          <AppText tone="onStageVariant" variant="caption">
            {interpolate(t('workouts.session.pastDay'), { day: t(WEEKDAY_KEYS[weekday]) })}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: saving }}
            disabled={saving}
            onPress={async () => {
              const ok = await completeSession({
                sessionKey,
                sessionName: title,
                exercises: planned,
                date,
              });
              setSaveFailed(!ok);
            }}
            style={{
              alignItems: 'center',
              backgroundColor: withAlpha(colors.accentCyan, 0.14),
              borderColor: withAlpha(colors.accentCyan, 0.45),
              borderRadius: radius.field,
              borderWidth: 1,
              justifyContent: 'center',
              minHeight: theme.spacing.x5l,
              paddingHorizontal: spacing.md,
            }}
            testID="workout-session-mark-done"
          >
            <AppText variant="label">{t('workouts.session.markDone')}</AppText>
          </Pressable>
        </View>
      ) : null}

      {saveFailed ? <Banner title={t('workouts.exercise.saveError')} tone="error" /> : null}

      <View style={{ gap: spacing.sm }}>
        {exercises.map((exercise, index) => {
          const key = `${sessionKey}-${exercise.exerciseKey}`;
          const plannedExercise = planned[index];
          const setsMade = Math.min(madeOf(exercise.exerciseKey), exercise.sets);
          const full = complete || setsMade >= exercise.sets;
          const name = exerciseDisplayName(exercise.exerciseKey, language);
          const target =
            exercise.target.kind === 'REPETITIONS'
              ? exercise.target.min === exercise.target.max
                ? formatNumber(exercise.target.max, language)
                : `${formatNumber(exercise.target.min, language)}–${formatNumber(exercise.target.max, language)}`
              : interpolate(t('workouts.exercise.seconds'), {
                  seconds: formatNumber(exercise.target.seconds, language),
                });
          const open = demo === key;
          return (
            <View
              key={key}
              style={{
                backgroundColor: full ? withAlpha(colors.success, 0.12) : colors.glassFill,
                borderRadius: radius.large,
                gap: spacing.sm,
                padding: spacing.md,
              }}
              testID={`workout-exercise-${index}`}
            >
              <View style={[styles.row, { gap: spacing.md }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  onPress={() => setDemo(open ? null : key)}
                  style={[styles.grow, { gap: spacing.xs, minHeight: theme.spacing.x5l }]}
                  testID={`workout-exercise-${index}-demo-toggle`}
                >
                  <AppText style={full ? { color: colors.success } : undefined} variant="label">
                    {name}
                  </AppText>
                  <AppText tone="onStageVariant" variant="caption">
                    {interpolate(t('workouts.exercise.setsReps'), {
                      sets: formatNumber(exercise.sets, language),
                      reps: target,
                    })}
                  </AppText>
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={[styles.row, { gap: spacing.xs }]}
                  >
                    {Array.from({ length: exercise.sets }, (_, set) => (
                      <View
                        key={set}
                        style={{
                          backgroundColor:
                            set < (complete ? exercise.sets : setsMade)
                              ? colors.accentCyan
                              : withAlpha(colors.onStage, 0.15),
                          borderRadius: radius.full,
                          height: 6,
                          width: 20,
                        }}
                        testID={`workout-exercise-${index}-pill-${set}`}
                      />
                    ))}
                  </View>
                  <View style={[styles.row, { gap: spacing.xs }]}>
                    <Icon color={colors.linkOnStage} name="play" size={12} />
                    <AppText style={{ color: colors.linkOnStage }} variant="caption">
                      {t(open ? 'workouts.exercise.hideDemo' : 'workouts.exercise.showDemo')}
                    </AppText>
                  </View>
                </Pressable>
                {canLog && plannedExercise ? (
                  <Pressable
                    accessibilityLabel={
                      full
                        ? interpolate(t('workouts.exercise.doneA11y'), { exercise: name })
                        : interpolate(t('workouts.exercise.completeSetA11y'), {
                            n: formatNumber(setsMade + 1, language),
                            exercise: name,
                          })
                    }
                    accessibilityRole="button"
                    accessibilityState={{ disabled: full || saving }}
                    disabled={full || saving}
                    onPress={async () => {
                      const ok = await completeSet({
                        sessionKey,
                        sessionName: title,
                        exercise: plannedExercise,
                        exercises: planned,
                        date,
                      });
                      setSaveFailed(!ok);
                      if (ok) onSetDone(exercise.restSeconds);
                    }}
                    style={{
                      alignItems: 'center',
                      backgroundColor: full ? colors.success : withAlpha(colors.accentCyan, 0.14),
                      borderColor: full ? colors.success : withAlpha(colors.accentCyan, 0.45),
                      borderRadius: radius.field,
                      borderWidth: 1,
                      justifyContent: 'center',
                      minHeight: theme.spacing.x5l,
                      minWidth: theme.spacing.x5l,
                      paddingHorizontal: spacing.md,
                    }}
                    testID={`workout-exercise-${index}-set`}
                  >
                    {full ? (
                      <Icon color={colors.stageDeep} name="check" size={18} />
                    ) : (
                      <AppText variant="label">
                        {interpolate(t('workouts.exercise.set'), {
                          n: formatNumber(setsMade + 1, language),
                        })}
                      </AppText>
                    )}
                  </Pressable>
                ) : null}
              </View>
              {open ? <ExerciseDemo exerciseKey={exercise.exerciseKey} name={name} /> : null}
            </View>
          );
        })}
      </View>

      {complete ? (
        <View
          accessibilityLiveRegion="polite"
          style={[
            styles.row,
            {
              backgroundColor: withAlpha(colors.success, 0.16),
              borderRadius: radius.large,
              gap: spacing.md,
              padding: spacing.md,
            },
          ]}
          testID="workout-session-complete"
        >
          <Icon color={colors.success} name="check" size={20} />
          <AppText style={styles.grow} variant="label">
            {t('workouts.session.complete')}
          </AppText>
        </View>
      ) : null}
    </GlassCard>
  );
}

/**
 * "Ver cómo se hace": the prototype's animated figure over its blue stage,
 * then the numbered cues. An exercise the figure would misrepresent shows the
 * cues only (exercise-figure.ts).
 */
function ExerciseDemo({ exerciseKey, name }: { exerciseKey: string; name: string }) {
  const { colors, radius, spacing } = useTheme();
  const { language, t } = useLocalization();
  const cues = DEMO_CUE_KEYS[demoMotionFor(exerciseKey)];
  const figure = figureFor(exerciseKey);
  return (
    <View
      style={[
        figure
          ? backgroundImageStyle(
              `radial-gradient(90% 90% at 50% 20%, ${colors.figureStage} 0%, ${colors.figureStageMid} 55%, ${colors.figureStageDeep} 100%)`,
              colors.figureStageMid,
            )
          : { backgroundColor: withAlpha(colors.stageDeep, 0.4) },
        {
          borderColor: colors.glassBorder,
          borderRadius: radius.large,
          borderWidth: 1,
          overflow: 'hidden',
        },
      ]}
      testID="workout-exercise-demo"
    >
      {figure ? (
        <ExerciseFigure
          exerciseName={name}
          idSuffix={exerciseKey.replace(/W/g, '_')}
          motion={figure}
        />
      ) : null}
      <View
        accessibilityRole="list"
        style={{
          backgroundColor: figure ? withAlpha(colors.figureStageDeep, 0.4) : undefined,
          borderColor: colors.glassBorder,
          borderTopWidth: figure ? 1 : 0,
          gap: spacing.xs,
          padding: spacing.md,
        }}
        testID="workout-exercise-cues"
      >
        {cues.map((cue, index) => (
          <View key={cue} style={[styles.row, { alignItems: 'flex-start', gap: spacing.sm }]}>
            <AppText
              style={{ color: figure ? colors.figureGround : colors.linkOnStage }}
              variant="label"
            >
              {`${formatNumber(index + 1, language)}.`}
            </AppText>
            <AppText
              style={[styles.grow, figure ? { color: colors.onFigure } : null]}
              variant="body"
            >
              {t(cue)}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

function WeekPlanPanel({
  routine,
  todayIndex,
  doneDates,
  weekDates,
  sessionName,
  onSelect,
  beforeStart,
}: {
  beforeStart: (index: number) => boolean;
  routine: GeneratedWorkoutRoutine;
  todayIndex: number;
  doneDates: ReadonlySet<string>;
  weekDates: readonly string[];
  sessionName: (sessionKey: string) => string;
  onSelect: (index: number) => void;
}) {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const { t } = useLocalization();
  // Days before the plan started are left out: never pending, never missed.
  const days = WEEKDAYS.map((weekday, index) => ({
    index,
    day: routine.schedule.find((candidate) => candidate.weekday === weekday),
  })).filter(({ index, day }) => day?.kind === 'TRAINING' && !beforeStart(index));

  return (
    <GlassCard testID="workout-week-plan">
      <View style={[styles.row, styles.wrap, { gap: spacing.sm }]}>
        <Icon color={colors.linkOnStage} name="dumbbell" size={18} />
        <AppText accessibilityRole="header" style={styles.grow} variant="panelTitle">
          {t('workout.plan.weekPlan')}
        </AppText>
        <Chip label={t('workouts.week.renews')} testID="workout-week-renews" />
      </View>
      <View>
        {days.map(({ index, day }, position) => {
          if (day?.kind !== 'TRAINING') return null;
          const dayName = t(WEEKDAY_KEYS[day.weekday]);
          const done = doneDates.has(weekDates[index] ?? '');
          const status = done
            ? { label: t('workouts.week.done'), tone: 'success' as const }
            : index === todayIndex
              ? { label: t('workouts.week.today'), tone: 'energy' as const }
              : { label: t('workouts.week.pending'), tone: 'neutral' as const };
          return (
            <Pressable
              key={day.weekday}
              accessibilityLabel={`${dayName}: ${sessionName(day.sessionKey)}, ${status.label}`}
              accessibilityRole="button"
              onPress={() => onSelect(index)}
              style={[
                styles.row,
                {
                  borderTopColor: colors.glassBorder,
                  borderTopWidth: position > 0 ? StyleSheet.hairlineWidth : 0,
                  gap: spacing.md,
                  minHeight: theme.spacing.x5l,
                  paddingVertical: spacing.sm,
                },
              ]}
              testID={`workout-week-row-${index}`}
            >
              <View style={styles.grow}>
                <AppText style={{ color: colors.linkOnStage }} variant="caption">
                  {dayName}
                </AppText>
                <AppText variant="label">{sessionName(day.sessionKey)}</AppText>
              </View>
              <Chip
                label={status.label}
                testID={`workout-week-row-${index}-status`}
                tone={status.tone}
              />
            </Pressable>
          );
        })}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  row: { alignItems: 'center', flexDirection: 'row' },
  wrap: { flexWrap: 'wrap' },
});
