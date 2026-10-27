import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  formatDate,
  formatNumber,
  formatQuantity,
  type SupportedLanguage,
  type TranslationKey,
  useLocalization,
} from '@/shared/localization';
import { interpolate } from '@/shared/localization/format';
import {
  AppButton,
  AppText,
  Chip,
  GlassCard,
  Icon,
  Ring,
  useReducedMotion,
  withAlpha,
} from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { PastWeek } from '../application/weekly-plan.service';
import type { AdherenceTone, WeekAdherence } from '../domain/adherence';
import { addDays } from '../domain/week';
import type { PlanNote } from '../domain/weekly-plan';

const RING_TONE: Record<AdherenceTone, 'success' | 'cyan' | 'energy'> = {
  great: 'success',
  good: 'cyan',
  retake: 'energy',
};

const HEADLINE: Record<AdherenceTone, TranslationKey> = {
  great: 'plan.history.great',
  good: 'plan.history.good',
  retake: 'plan.history.retake',
};

const calendar = (date: string) => new Date(`${date}T12:00:00`);

/** "26 oct – 1 nov" in the person's language. */
export function weekLabel(weekStart: string, language: SupportedLanguage): string {
  const fmt = (date: string) =>
    formatDate(calendar(date), language, { day: 'numeric', month: 'short' }).replace('.', '');
  return `${fmt(weekStart)} – ${fmt(addDays(weekStart, 6))}`;
}

/** "Cuerpo completo 2" from `session.full_body_2`. */
function sessionName(
  sessionKey: string,
  t: (key: TranslationKey) => string,
  language: SupportedLanguage,
) {
  const n = Number(/(\d+)$/.exec(sessionKey)?.[1] ?? 1);
  return interpolate(t('plan.session.fullBody'), { n: formatNumber(n, language) });
}

/** The iCoach note the NEXT week's plan was built with, in words. */
export function noteText(
  notes: readonly PlanNote[],
  t: (key: TranslationKey) => string,
  language: SupportedLanguage,
): string {
  const parts = notes.map((note) => {
    const n = (key: string) => formatNumber(Number(note.params?.[key] ?? 0), language);
    switch (note.code) {
      case 'plan.progression.up':
        return t('plan.note.up');
      case 'plan.progression.max':
        return t('plan.note.max');
      case 'plan.progression.keep':
        return interpolate(
          t(Number(note.params?.missed) === 1 ? 'plan.note.keepOne' : 'plan.note.keepMany'),
          { missed: n('missed') },
        );
      case 'plan.calories.closer':
        return t('plan.note.calories');
      case 'plan.days.proposal':
        return interpolate(t('plan.note.days'), { days: n('days') });
      default:
        return null;
    }
  });
  const text = parts.filter((part): part is string => part !== null).join(' ');
  return text || t('plan.note.none');
}

/**
 * Progreso → "Semanas anteriores" (ADR-P042 D7): one row per past week with
 * its adherence ring, and a detail sheet with plan vs. done.
 */
export function PastWeeksPanel({
  weeks,
  onSeed,
}: {
  weeks: readonly PastWeek[];
  /** DEV ONLY: offered on an empty history in a development build on a local API. */
  onSeed?: () => void;
}) {
  const theme = useTheme();
  const { colors, radius, spacing } = theme;
  const { language, t } = useLocalization();
  const [open, setOpen] = useState<PastWeek | null>(null);

  return (
    <GlassCard style={{ gap: spacing.md, padding: spacing.lg }} testID="past-weeks">
      {/* The title keeps the whole row so it stays on one line; the subtitle
          sits below it (owner review 2026-10-27). */}
      <View style={{ gap: 2 }} testID="past-weeks-header">
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Icon color={colors.accentCyan} name="calendar" size={18} />
          <AppText accessibilityRole="header" style={styles.grow} tone="onStage" variant="title">
            {t('plan.history.title')}
          </AppText>
        </View>
        <AppText tone="onStageVariant" variant="caption">
          {t('plan.history.subtitle')}
        </AppText>
      </View>
      {weeks.length === 0 ? (
        <View style={{ gap: spacing.sm }}>
          <AppText tone="onStageVariant" testID="past-weeks-empty">
            {t('plan.history.empty')}
          </AppText>
          {onSeed ? (
            <AppButton onPress={onSeed} testID="past-weeks-dev-seed" variant="stage-secondary">
              {t('plan.history.devSeed')}
            </AppButton>
          ) : null}
        </View>
      ) : (
        weeks.map((week) => {
          const a = week.adherence;
          const label = weekLabel(a.weekStart, language);
          const summary = interpolate(t('plan.history.row'), {
            done: formatNumber(a.fulfilledSessions, language),
            planned: formatNumber(a.plannedSessions, language),
            meals: formatNumber(a.mealPct, language),
          });
          return (
            <Pressable
              accessibilityHint={t('plan.history.openHint')}
              accessibilityLabel={`${label}. ${interpolate(t('plan.history.scoreLabel'), {
                score: formatNumber(a.score, language),
              })}. ${summary}`}
              accessibilityRole="button"
              key={a.weekStart}
              onPress={() => setOpen(week)}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: pressed
                    ? withAlpha(colors.onStage, 0.09)
                    : withAlpha(colors.onStage, 0.05),
                  borderRadius: radius.field,
                  gap: spacing.md,
                  minHeight: theme.spacing.x5l,
                  padding: spacing.sm,
                },
              ]}
              testID={`past-week-${a.weekStart}`}
            >
              <Ring
                accessibilityLabel={interpolate(t('plan.history.scoreLabel'), {
                  score: formatNumber(a.score, language),
                })}
                size={52}
                strokeWidth={6}
                tone={RING_TONE[a.tone]}
                value={a.score / 100}
              >
                <AppText tone="onStage" variant="label">
                  {`${formatNumber(a.score, language)}%`}
                </AppText>
              </Ring>
              <View style={[styles.grow, { gap: 2 }]}>
                <AppText tone="onStage" variant="label">
                  {label}
                </AppText>
                <AppText tone="onStageVariant" variant="caption">
                  {summary}
                </AppText>
              </View>
              <Icon color={colors.onStageVariant} name="chevron" size={18} />
            </Pressable>
          );
        })
      )}
      {open ? <WeekDetailSheet onClose={() => setOpen(null)} week={open} /> : null}
    </GlassCard>
  );
}

function WeekDetailSheet({ week, onClose }: { week: PastWeek; onClose: () => void }) {
  const theme = useTheme();
  const { colors, radius, spacing } = theme;
  const { language, t } = useLocalization();
  const reduceMotion = useReducedMotion();
  const a: WeekAdherence = week.adherence;
  const kcal = (value: number) => formatQuantity(value, 'kcal', language);

  return (
    <Modal
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible
    >
      <View style={[styles.scrim, { backgroundColor: withAlpha(colors.stage, 0.7) }]}>
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.stageDeep,
            borderColor: colors.glassBorder,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            borderWidth: 1,
            maxHeight: '90%',
          }}
          testID="week-detail"
        >
          <ScrollView contentContainerStyle={{ gap: spacing.md, padding: spacing.lg }}>
            <View style={[styles.row, { gap: spacing.sm }]}>
              <View style={styles.grow}>
                <AppText tone="primary" variant="caption">
                  {t('plan.history.week')}
                </AppText>
                <AppText accessibilityRole="header" tone="onStage" variant="title">
                  {weekLabel(a.weekStart, language)}
                </AppText>
              </View>
              <Pressable
                accessibilityLabel={t('plan.history.close')}
                accessibilityRole="button"
                onPress={onClose}
                style={[
                  styles.center,
                  {
                    backgroundColor: colors.glassFill,
                    borderRadius: radius.full,
                    minHeight: theme.spacing.x5l,
                    minWidth: theme.spacing.x5l,
                  },
                ]}
                testID="week-detail-close"
              >
                <Icon color={colors.onStage} name="x" size={20} />
              </Pressable>
            </View>

            <View style={[styles.row, { gap: spacing.md }]}>
              <Ring
                accessibilityLabel={interpolate(t('plan.history.scoreLabel'), {
                  score: formatNumber(a.score, language),
                })}
                size={84}
                strokeWidth={9}
                tone={RING_TONE[a.tone]}
                value={a.score / 100}
              >
                <AppText tone="onStage" variant="title">
                  {`${formatNumber(a.score, language)}%`}
                </AppText>
              </Ring>
              <View style={[styles.grow, { gap: 2 }]}>
                <AppText tone="onStage" variant="title">
                  {t(HEADLINE[a.tone])}
                </AppText>
                <AppText tone="onStageVariant" variant="caption">
                  {t('plan.history.scoreExplain')}
                </AppText>
              </View>
            </View>

            <AppText tone="onStage" variant="label">
              {interpolate(t('plan.history.workouts'), {
                done: formatNumber(a.fulfilledSessions, language),
                planned: formatNumber(a.plannedSessions, language),
              })}
            </AppText>
            {a.sessions.map((session) => (
              <View
                key={`${session.date}-${session.sessionKey}`}
                style={[
                  styles.row,
                  styles.wrap,
                  {
                    backgroundColor: withAlpha(colors.onStage, 0.04),
                    borderRadius: radius.field,
                    gap: spacing.sm,
                    padding: spacing.sm,
                  },
                ]}
                testID={`week-session-${session.date}`}
              >
                <View style={[styles.grow, { gap: 2 }]}>
                  <AppText tone="primary" variant="caption">
                    {formatDate(calendar(session.date), language, { weekday: 'long' })}
                  </AppText>
                  <AppText tone="onStage">{sessionName(session.sessionKey, t, language)}</AppText>
                </View>
                <Chip
                  label={t(session.done ? 'plan.history.done' : 'plan.history.missed')}
                  tone={session.done ? 'cyan' : 'energy'}
                  testID={`week-session-${session.date}-${session.done ? 'done' : 'missed'}`}
                />
              </View>
            ))}

            <AppText tone="onStage" variant="label">
              {t('plan.history.food')}
            </AppText>
            <View style={[styles.row, { gap: spacing.sm }]}>
              {[
                [t('plan.history.meals'), `${formatNumber(a.mealPct, language)}%`],
                [
                  t('plan.history.daysInTarget'),
                  interpolate(t('plan.history.ofSeven'), {
                    days: formatNumber(a.daysInCalorieTarget, language),
                  }),
                ],
                [
                  t('plan.history.average'),
                  a.averageDailyCalories === null ? '—' : kcal(a.averageDailyCalories),
                ],
              ].map(([label, value]) => (
                <View
                  key={label}
                  style={[
                    styles.grow,
                    styles.center,
                    {
                      backgroundColor: withAlpha(colors.onStage, 0.05),
                      borderRadius: radius.field,
                      gap: 2,
                      padding: spacing.sm,
                    },
                  ]}
                >
                  <AppText tone="onStage" variant="label">
                    {value}
                  </AppText>
                  <AppText align="center" tone="onStageVariant" variant="caption">
                    {label}
                  </AppText>
                </View>
              ))}
            </View>
            <AppText tone="onStageVariant" variant="caption">
              {interpolate(t('plan.history.targetWas'), { kcal: kcal(a.targetCalories) })}
            </AppText>

            <AppText tone="onStage" variant="label">
              {t('plan.history.weight')}
            </AppText>
            <AppText tone="onStage" testID="week-weight">
              {a.weightChangeKg === null
                ? t('plan.history.noWeight')
                : interpolate(t('plan.history.weightChange'), {
                    kg: `${a.weightChangeKg > 0 ? '+' : ''}${formatQuantity(a.weightChangeKg, 'kg', language, { maximumFractionDigits: 1 })}`,
                  })}
            </AppText>

            <View
              style={{
                backgroundColor: withAlpha(colors.accentCyan, 0.12),
                borderRadius: radius.field,
                gap: spacing.xs,
                padding: spacing.md,
              }}
              testID="week-icoach-note"
            >
              <AppText tone="primary" variant="caption">
                {t('plan.history.icoach')}
              </AppText>
              <AppText tone="onStage">{noteText(week.nextWeekNotes, t, language)}</AppText>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
  row: { alignItems: 'center', flexDirection: 'row' },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  wrap: { flexWrap: 'wrap' },
});
