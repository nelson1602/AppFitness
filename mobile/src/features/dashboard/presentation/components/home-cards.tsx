import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  formatNumber,
  formatQuantity,
  interpolate,
  type TranslationKey,
  useLocalization,
} from '@/shared/localization';
import { AppButton, AppText, Chip, GlassCard, ProgressBar, Ring } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { HomeSummary } from '../../domain/home-summary';

/** The session length the design shows when the profile has none. */
const DEFAULT_MINUTES = 45;

/**
 * "Tu meta te espera" (design, Inicio): the week's workouts as a ring — energy
 * while open, success once the week is complete — and weight toward the goal.
 * Every value is also text; the ring and bar are never the only signal.
 */
export function GoalCard({ summary }: { summary: HomeSummary }) {
  const { spacing } = useTheme();
  const { language, t } = useLocalization();
  const { done, goal, complete } = summary.week;
  const n = (value: number) => formatNumber(value, language);

  const ringLabel =
    goal === null
      ? t('home.goal.ringEmpty')
      : interpolate(t('home.goal.ringLabel'), { done: n(done), goal: n(goal) });
  const left = goal === null ? null : Math.max(0, goal - done);
  const status =
    left === null
      ? t('home.goal.noPlan')
      : complete
        ? t('home.goal.allDone')
        : left === 1
          ? t('home.goal.leftOne')
          : interpolate(t('home.goal.leftMany'), { count: n(left) });

  return (
    <GlassCard testID="home-goal-card">
      <AppText tone="onStageVariant" variant="caption">
        {t('home.week.eyebrow')}
      </AppText>
      <View style={[styles.row, { gap: spacing.lg }]}>
        <Ring
          accessibilityLabel={ringLabel}
          testID="home-week-ring"
          tone={complete ? 'success' : 'energy'}
          value={goal ? done / goal : 0}
        >
          <AppText tone="onStage" variant="title">
            {goal === null ? '–' : `${n(done)}/${n(goal)}`}
          </AppText>
        </Ring>
        <View style={[styles.grow, { gap: spacing.xs }]}>
          <AppText accessibilityRole="header" tone="onStage" variant="headline">
            {complete ? t('home.goal.titleDone') : t('home.goal.title')}
          </AppText>
          <AppText tone="onStageVariant" testID="home-goal-status">
            {status}
          </AppText>
        </View>
      </View>
      <View style={{ gap: spacing.xs }}>
        <AppText tone="onStage" variant="label">
          {t('home.weight.label')}
        </AppText>
        {summary.weight ? (
          <>
            <ProgressBar
              accessibilityLabel={t('home.weight.label')}
              testID="home-weight-bar"
              tone="cyan"
              value={summary.weight.progress}
            />
            <AppText tone="onStageVariant" variant="caption">
              {`${formatQuantity(summary.weight.current, 'kg', language, { maximumFractionDigits: 1 })} → ${formatQuantity(summary.weight.target, 'kg', language, { maximumFractionDigits: 1 })}`}
            </AppText>
          </>
        ) : (
          <AppText tone="onStageVariant" variant="caption">
            {t('home.weight.empty')}
          </AppText>
        )}
      </View>
    </GlassCard>
  );
}

/** Today's plan day in words; the done states are added beside it as chips. */
function coachMessage(today: HomeSummary['today']): { key: TranslationKey; minutes?: number } {
  switch (today.kind) {
    case 'training':
      return { key: 'home.coach.train', minutes: today.minutes ?? DEFAULT_MINUTES };
    case 'rest':
      return { key: today.active ? 'home.coach.restActive' : 'home.coach.restFull' };
    case 'unknown':
      return { key: 'home.coach.noPlan' };
  }
}

/**
 * The iCoach card (design): today's recommendation from the deterministic
 * plan. "Empezar" opens Entrenamientos; once today's session is finished it
 * says so, and once the whole week is done it says that instead.
 */
export function CoachCard({ summary }: { summary: HomeSummary }) {
  const { spacing } = useTheme();
  const { language, t } = useLocalization();
  const message = coachMessage(summary.today);
  const text =
    message.minutes === undefined
      ? t(message.key)
      : interpolate(t(message.key), { minutes: formatNumber(message.minutes, language) });

  return (
    <GlassCard testID="home-coach-card">
      <View style={[styles.row, styles.wrap, { gap: spacing.sm }]}>
        <AppText accessibilityRole="header" style={styles.grow} tone="onStage" variant="title">
          {t('home.coach.title')}
        </AppText>
        <Chip label={t('home.coach.chip')} testID="home-coach-chip" tone="cyan" />
      </View>
      <AppText tone="onStage" testID="home-coach-message">
        {text}
      </AppText>
      {summary.coach === 'start' ? (
        <AppButton
          accessibilityLabel={t('home.coach.startAccessibility')}
          onPress={() => router.navigate('/workouts')}
          testID="home-coach-start"
          variant="primary"
        >
          {t('home.coach.start')}
        </AppButton>
      ) : null}
      {summary.coach === 'today-done' ? (
        <Chip label={t('home.coach.todayDone')} testID="home-coach-today-done" tone="energy" />
      ) : null}
      {summary.coach === 'week-done' ? (
        <Chip label={t('home.coach.weekDone')} testID="home-coach-week-done" tone="energy" />
      ) : null}
    </GlassCard>
  );
}

/** Today's training and calories, side by side (wrapping at large text). */
export function TodayTiles({ summary }: { summary: HomeSummary }) {
  const { spacing } = useTheme();
  const { language, t } = useLocalization();
  const { today, calories } = summary;

  const training =
    today.kind === 'training'
      ? today.completed
        ? t('home.tile.trainingDone')
        : interpolate(t('home.tile.trainingMinutes'), {
            minutes: formatNumber(today.minutes ?? DEFAULT_MINUTES, language),
          })
      : today.kind === 'rest'
        ? t('home.tile.rest')
        : t('home.tile.noPlan');

  return (
    <View style={[styles.row, styles.wrap, { gap: spacing.md }]}>
      <GlassCard style={styles.tile} testID="home-tile-training">
        <AppText tone="onStageVariant" variant="caption">
          {t('home.tile.training')}
        </AppText>
        <AppText tone="onStage" variant="title">
          {training}
        </AppText>
      </GlassCard>
      <GlassCard style={styles.tile} testID="home-tile-calories">
        <AppText tone="onStageVariant" variant="caption">
          {t('home.tile.calories')}
        </AppText>
        {calories.target === null ? (
          <AppText tone="onStage" variant="title">
            {t('home.tile.caloriesEmpty')}
          </AppText>
        ) : (
          <>
            <AppText tone="onStage" variant="title">
              {calories.consumed === null
                ? formatQuantity(calories.target, 'kcal', language)
                : interpolate(t('home.tile.caloriesValue'), {
                    consumed: formatNumber(Math.round(calories.consumed), language),
                    target: formatNumber(calories.target, language),
                  })}
            </AppText>
            {calories.share === null ? null : (
              <ProgressBar
                accessibilityLabel={t('home.tile.caloriesBar')}
                testID="home-calories-bar"
                tone="energy"
                value={calories.share}
              />
            )}
          </>
        )}
      </GlassCard>
    </View>
  );
}

const QUICK_ACTIONS = [
  { key: 'home.quick.food', href: '/food-log', testID: 'home-quick-food' },
  { key: 'home.quick.workout', href: '/workout-log', testID: 'home-quick-workout' },
  { key: 'home.quick.weight', href: '/progress', testID: 'home-quick-weight' },
] as const;

export function QuickActions() {
  const { spacing } = useTheme();
  const { t } = useLocalization();

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText accessibilityRole="header" tone="onStage" variant="title">
        {t('home.quick.title')}
      </AppText>
      <View style={[styles.row, styles.wrap, { gap: spacing.sm }]}>
        {QUICK_ACTIONS.map((action) => (
          <AppButton
            key={action.key}
            onPress={() => router.push(action.href)}
            style={styles.quick}
            testID={action.testID}
            variant="stage-secondary"
          >
            {t(action.key)}
          </AppButton>
        ))}
      </View>
    </View>
  );
}

/**
 * Water and heart rate need a smartwatch integration that does not exist yet
 * (docs/design/GAP_ANALYSIS.md), so they are announced, never faked.
 */
export function ComingSoonCard() {
  const { spacing } = useTheme();
  const { t } = useLocalization();

  return (
    <GlassCard testID="home-coming-soon">
      <View style={[styles.row, styles.wrap, { gap: spacing.sm }]}>
        <AppText accessibilityRole="header" style={styles.grow} tone="onStage" variant="title">
          {t('home.soon.title')}
        </AppText>
        <Chip label={t('home.soon.chip')} testID="home-soon-chip" />
      </View>
      <AppText tone="onStageVariant">{t('home.soon.water')}</AppText>
      <AppText tone="onStageVariant">{t('home.soon.heart')}</AppText>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  grow: {
    flexGrow: 1,
    flexShrink: 1,
  },
  quick: {
    flexBasis: '30%',
    flexGrow: 1,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  tile: {
    flexBasis: '45%',
    flexGrow: 1,
  },
  wrap: {
    flexWrap: 'wrap',
  },
});
