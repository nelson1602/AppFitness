import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { goalTypeLabelKey } from '@/features/profile/presentation/goal-type-label';
import type { GoalType } from '@/shared/infrastructure/database/types';
import {
  formatDate,
  formatNumber,
  formatQuantity,
  interpolate,
  type TranslationKey,
  useLocalization,
} from '@/shared/localization';
import {
  AppText,
  backgroundImageStyle,
  Chip,
  ctaBackgroundImage,
  GlassCard,
  goalCardBackgroundImage,
  Icon,
  type IconName,
  Mascot,
  ProgressBar,
  Pulse,
  Ring,
} from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { HomeEvaluation } from '../../application/use-home-data';
import type { HomeSummary } from '../../domain/home-summary';

/** The session length the design shows when the profile has none. */
const DEFAULT_MINUTES = 45;

/** The design's panel title row: an icon, the title (a header) and an optional chip. */
function PanelTitle({ icon, title, right }: { icon: IconName; title: string; right?: ReactNode }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={[styles.row, styles.wrap, { gap: spacing.sm }]}>
      <View style={[styles.row, styles.grow, { gap: spacing.sm }]}>
        <Icon color={colors.accentCyan} name={icon} size={18} />
        <AppText accessibilityRole="header" tone="onStage" variant="title">
          {title}
        </AppText>
      </View>
      {right}
    </View>
  );
}

/**
 * "Tu meta te espera" (design, Inicio): the brand-blue card with the mascot,
 * the week's workouts as a ring (energy while open, success once the week is
 * complete), the goal and weight toward it, and the heartbeat. Every value is
 * also text; the ring and bar are never the only signal.
 */
export function GoalCard({
  summary,
  goalType,
}: {
  summary: HomeSummary;
  goalType: GoalType | null;
}) {
  const { colors, radius, spacing } = useTheme();
  const { language, t } = useLocalization();
  const { done, goal, complete } = summary.week;
  const n = (value: number) => formatNumber(value, language);
  const onCta = { color: colors.onCta };

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
  const goalKey = goalType ? goalTypeLabelKey(goalType) : null;
  const kg = (value: number) => formatQuantity(value, 'kg', language, { maximumFractionDigits: 1 });

  return (
    <View
      style={[
        backgroundImageStyle(goalCardBackgroundImage(colors), colors.ctaStart),
        { borderRadius: radius.sheet, gap: spacing.md, overflow: 'hidden', padding: spacing.lg },
      ]}
      testID="home-goal-card"
    >
      <View style={[styles.mascot, { right: spacing.xs, top: spacing.xs }]}>
        <Mascot size={80} testID="home-goal-mascot" variant="solo" />
      </View>
      <View style={[styles.row, { gap: spacing.lg }]}>
        <Ring
          accessibilityLabel={ringLabel}
          size={88}
          strokeWidth={10}
          testID="home-week-ring"
          tone={complete ? 'success' : 'energy'}
          value={goal ? done / goal : 0}
        >
          <AppText style={onCta} variant="title">
            {goal === null ? '–' : `${n(done)}/${n(goal)}`}
          </AppText>
        </Ring>
        {/* Text stops short of the mascot in the top-right corner. */}
        <View style={[styles.grow, { gap: spacing.xs, paddingRight: spacing.x7l }]}>
          <AppText style={onCta} variant="caption">
            {t('home.week.eyebrow')}
          </AppText>
          <AppText accessibilityRole="header" style={onCta} variant="title">
            {complete ? t('home.goal.titleDone') : t('home.goal.title')}
          </AppText>
          <AppText style={onCta} testID="home-goal-status" variant="caption">
            {status}
          </AppText>
        </View>
      </View>
      <View style={{ gap: spacing.xs }}>
        <View style={[styles.row, styles.spread, { gap: spacing.sm }]}>
          <AppText style={onCta} variant="label">
            {goalKey ? t(goalKey) : t('home.weight.label')}
          </AppText>
          {summary.weight ? (
            <AppText style={onCta} variant="label">
              {`${kg(summary.weight.current)} → ${kg(summary.weight.target)}`}
            </AppText>
          ) : null}
        </View>
        {summary.weight ? (
          <ProgressBar
            accessibilityLabel={t('home.weight.label')}
            testID="home-weight-bar"
            tone="cyan"
            value={summary.weight.progress}
          />
        ) : (
          <AppText style={onCta} variant="caption">
            {t('home.weight.empty')}
          </AppText>
        )}
      </View>
      <Pulse gradientId="pulse-home" height={28} testID="home-goal-pulse" />
    </View>
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
export function CoachCard({
  summary,
  evaluationDate,
}: {
  summary: HomeSummary;
  evaluationDate: string | null;
}) {
  const theme = useTheme();
  const { colors, radius, spacing } = theme;
  const { language, t } = useLocalization();
  const message = coachMessage(summary.today);
  const text =
    message.minutes === undefined
      ? t(message.key)
      : interpolate(t(message.key), { minutes: formatNumber(message.minutes, language) });
  const basedOn = evaluationDate
    ? interpolate(t('home.coach.basedOn'), {
        date: formatDate(new Date(`${evaluationDate}T12:00:00`), language, {
          day: 'numeric',
          month: 'long',
        }),
      })
    : null;

  return (
    <GlassCard style={{ gap: spacing.sm, padding: spacing.lg }} testID="home-coach-card">
      <PanelTitle
        icon="sparkle"
        right={<Chip label={t('home.coach.chip')} testID="home-coach-chip" tone="cyan" />}
        title={t('home.coach.title')}
      />
      <AppText tone="onStage" testID="home-coach-message" variant="label">
        {text}
      </AppText>
      <View style={[styles.row, styles.wrap, styles.spread, { gap: spacing.sm }]}>
        {basedOn ? (
          <AppText style={styles.shrink} tone="onStageVariant" variant="caption">
            {basedOn}
          </AppText>
        ) : (
          <View />
        )}
        {summary.coach === 'start' ? (
          <Pressable
            accessibilityLabel={t('home.coach.startAccessibility')}
            accessibilityRole="button"
            onPress={() => router.navigate('/workouts')}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: pressed ? colors.glassBorder : colors.glassFill,
                borderColor: colors.glassBorder,
                borderRadius: radius.field,
                borderWidth: 1,
                gap: spacing.xs,
                minHeight: theme.spacing.x5l,
                paddingHorizontal: spacing.md,
              },
            ]}
            testID="home-coach-start"
          >
            <AppText tone="onStage" variant="label">
              {t('home.coach.start')}
            </AppText>
            <Icon color={colors.onStage} name="arrow" size={16} />
          </Pressable>
        ) : null}
        {summary.coach === 'today-done' ? (
          <Chip label={t('home.coach.todayDone')} testID="home-coach-today-done" tone="cyan" />
        ) : null}
        {summary.coach === 'week-done' ? (
          <Chip label={t('home.coach.weekDone')} testID="home-coach-week-done" tone="cyan" />
        ) : null}
      </View>
    </GlassCard>
  );
}

/** One of the two aligned "today" tiles: icon and label, the value, a bar. */
function Tile({
  icon,
  iconColor,
  label,
  value,
  bar,
  testID,
}: {
  icon: IconName;
  iconColor: string;
  label: string;
  value: string;
  bar: ReactNode;
  testID: string;
}) {
  const { spacing } = useTheme();
  return (
    <GlassCard style={[styles.tile, { gap: spacing.sm, padding: spacing.md }]} testID={testID}>
      <View style={[styles.row, { gap: spacing.xs }]}>
        <Icon color={iconColor} name={icon} size={16} />
        <AppText tone="onStageVariant" variant="caption">
          {label}
        </AppText>
      </View>
      <AppText style={styles.grow} tone="onStage" variant="title">
        {value}
      </AppText>
      {bar}
    </GlassCard>
  );
}

/** Today's training and calories, side by side, same structure so they align. */
export function TodayTiles({ summary }: { summary: HomeSummary }) {
  const { colors, spacing } = useTheme();
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
  const trainingShare =
    today.kind === 'training' ? (today.completed ? 1 : 0) : today.kind === 'rest' ? 1 : 0;

  const caloriesValue =
    calories.target === null
      ? t('home.tile.caloriesEmpty')
      : calories.consumed === null
        ? formatQuantity(calories.target, 'kcal', language)
        : interpolate(t('home.tile.caloriesValue'), {
            consumed: formatNumber(Math.round(calories.consumed), language),
            target: formatNumber(calories.target, language),
          });

  return (
    <View style={[styles.row, styles.stretch, { gap: spacing.md }]}>
      <Tile
        bar={
          <ProgressBar
            accessibilityLabel={t('home.tile.training')}
            testID="home-training-bar"
            tone="cyan"
            value={trainingShare}
          />
        }
        icon="dumbbell"
        iconColor={colors.accentCyan}
        label={t('home.tile.training')}
        testID="home-tile-training"
        value={training}
      />
      <Tile
        bar={
          <ProgressBar
            accessibilityLabel={t('home.tile.caloriesBar')}
            testID="home-calories-bar"
            tone="energy"
            value={calories.share ?? 0}
          />
        }
        icon="flame"
        iconColor={colors.accentEnergy}
        label={t('home.tile.calories')}
        testID="home-tile-calories"
        value={caloriesValue}
      />
    </View>
  );
}

const MACRO_KEY: Record<HomeEvaluation['macros'][number]['kind'], TranslationKey> = {
  protein: 'nutrition.plan.protein',
  carbs: 'nutrition.plan.carbs',
  fat: 'nutrition.plan.fat',
};
const MACRO_TONE = { protein: 'cyan', carbs: 'success', fat: 'energy' } as const;

/**
 * "Tu evaluación de hoy" (design): BMI with its category, and today's protein,
 * carbohydrates and fat against the iCoach targets. Blood pressure is a
 * medical field and stays out until ADR-P038 (SECURITY-002).
 */
export function EvaluationCard({ evaluation }: { evaluation: HomeEvaluation | null }) {
  const { colors, radius, spacing } = useTheme();
  const { language, t } = useLocalization();

  return (
    <GlassCard style={{ gap: spacing.md, padding: spacing.lg }} testID="home-eval-card">
      <PanelTitle icon="clipboard" title={t('home.eval.title')} />
      {evaluation ? (
        <>
          <View
            style={[
              styles.row,
              styles.spread,
              {
                backgroundColor: colors.glassFill,
                borderRadius: radius.field,
                gap: spacing.md,
                padding: spacing.md,
              },
            ]}
          >
            <View>
              <AppText tone="onStageVariant" variant="caption">
                {t('home.eval.bmi')}
              </AppText>
              <AppText tone="onStage" testID="home-eval-bmi" variant="title">
                {formatNumber(evaluation.bmi, language, {
                  maximumFractionDigits: 1,
                  minimumFractionDigits: 1,
                })}
              </AppText>
            </View>
            <Chip
              label={t(`dashboard.bmi.${evaluation.bmiCategory.toLowerCase()}` as TranslationKey)}
              testID="home-eval-bmi-category"
              tone={evaluation.bmiCategory === 'NORMAL' ? 'cyan' : 'energy'}
            />
          </View>
          <View style={[styles.row, styles.stretch, { gap: spacing.md }]}>
            {evaluation.macros.map((macro) => {
              const name = t(MACRO_KEY[macro.kind]);
              const consumed = Math.round(macro.consumed ?? 0);
              const values = {
                consumed: formatNumber(consumed, language),
                target: formatNumber(macro.target, language),
              };
              return (
                <View
                  key={macro.kind}
                  style={[styles.grow, { gap: spacing.xs }]}
                  testID={`home-eval-${macro.kind}`}
                >
                  <AppText numberOfLines={1} tone="onStageVariant" variant="caption">
                    {name}
                  </AppText>
                  <AppText tone="onStage" variant="label">
                    {interpolate(t('home.eval.grams'), values)}
                  </AppText>
                  <ProgressBar
                    accessibilityLabel={interpolate(t('home.eval.macroLabel'), {
                      macro: name,
                      ...values,
                    })}
                    height={6}
                    tone={MACRO_TONE[macro.kind]}
                    value={macro.target > 0 ? consumed / macro.target : 0}
                  />
                </View>
              );
            })}
          </View>
        </>
      ) : (
        <AppText tone="onStageVariant">{t('home.eval.empty')}</AppText>
      )}
    </GlassCard>
  );
}

const QUICK_ACTIONS = [
  { key: 'home.quick.food', icon: 'food', href: '/food-log', testID: 'home-quick-food' },
  {
    key: 'home.quick.workout',
    icon: 'dumbbell',
    href: '/workout-log',
    testID: 'home-quick-workout',
  },
  { key: 'home.quick.weight', icon: 'scale', href: '/progress-log', testID: 'home-quick-weight' },
] as const;

/** The three quick actions (design): a gradient icon above each label. */
export function QuickActions() {
  const theme = useTheme();
  const { colors, radius, spacing } = theme;
  const { t } = useLocalization();

  return (
    <View style={[styles.row, styles.stretch, { gap: spacing.sm }]}>
      {QUICK_ACTIONS.map((action) => (
        <Pressable
          accessibilityRole="button"
          key={action.key}
          onPress={() => router.push(action.href)}
          style={({ pressed }) => [
            styles.quick,
            {
              backgroundColor: pressed ? colors.glassBorder : colors.glassFill,
              borderColor: colors.glassBorder,
              borderRadius: radius.sheet,
              borderWidth: 1,
              gap: spacing.sm,
              minHeight: theme.spacing.x5l,
              paddingHorizontal: spacing.xs,
              paddingVertical: spacing.md,
            },
          ]}
          testID={action.testID}
        >
          <View
            style={[
              styles.quickIcon,
              backgroundImageStyle(ctaBackgroundImage(colors), colors.ctaStart),
              { borderRadius: radius.full, height: spacing.x4l, width: spacing.x4l },
            ]}
          >
            <Icon color={colors.onCta} name={action.icon} size={19} />
          </View>
          <AppText align="center" tone="onStage" variant="caption">
            {t(action.key)}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

const SOON = [
  { icon: 'drop', title: 'home.soon.waterTitle', body: 'home.soon.waterBody' },
  { icon: 'heart', title: 'home.soon.heartTitle', body: 'home.soon.heartBody' },
] as const;

/**
 * Water and heart rate need a smartwatch integration that does not exist yet
 * (docs/design/GAP_ANALYSIS.md), so they are announced as dashed placeholders,
 * never faked.
 */
export function ComingSoonCard() {
  const { colors, radius, spacing } = useTheme();
  const { t } = useLocalization();

  return (
    <GlassCard style={{ gap: spacing.md, padding: spacing.lg }} testID="home-coming-soon">
      <PanelTitle
        icon="watch"
        right={<Chip label={t('home.soon.chip')} testID="home-soon-chip" />}
        title={t('home.soon.title')}
      />
      <View style={[styles.row, styles.stretch, { gap: spacing.md }]}>
        {SOON.map((item) => (
          <View
            key={item.icon}
            style={[
              styles.grow,
              {
                borderColor: colors.glassBorder,
                borderRadius: radius.field,
                borderStyle: 'dashed',
                borderWidth: 1,
                gap: spacing.xs,
                padding: spacing.md,
              },
            ]}
            testID={`home-soon-${item.icon}`}
          >
            <Icon color={colors.onStageVariant} name={item.icon} size={20} />
            <AppText tone="onStage" variant="label">
              {t(item.title)}
            </AppText>
            <AppText tone="onStageVariant" variant="caption">
              {t(item.body)}
            </AppText>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  grow: {
    flex: 1,
  },
  mascot: {
    position: 'absolute',
  },
  quick: {
    alignItems: 'center',
    flex: 1,
  },
  quickIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  shrink: {
    flexShrink: 1,
  },
  spread: {
    justifyContent: 'space-between',
  },
  stretch: {
    alignItems: 'stretch',
  },
  tile: {
    flex: 1,
  },
  wrap: {
    flexWrap: 'wrap',
  },
});
