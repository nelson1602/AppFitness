import { StyleSheet, View } from 'react-native';

import type { SessionLightening, SessionMove } from '@/features/weekly-plan/domain/realtime-recalc';
import {
  muscleGroupsInSentence,
  weekdayInSentence,
} from '@/features/weekly-plan/presentation/realtime-copy';
import {
  formatKcal,
  formatKcalQuantity,
  formatNumber,
  interpolate,
  useLocalization,
} from '@/shared/localization';
import { AppText, Chip, GlassCard, Icon, withAlpha } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { ExtraActivity } from '../domain/extra-activity';
import { WEEKDAY_KEYS, WEEKDAYS } from './weekday-labels';
import { dayIndexInWeek } from '@/features/weekly-plan/domain/week';

export interface ExtraActivityPanelProps {
  /** This week's extra activities (finished, plus unlinked ones in progress), in date order. */
  extras: readonly ExtraActivity[];
  /** R2: today's kcal added to the calorie budget. */
  calorieBonus: number;
  /** R3: skipped sessions moved to a free day. */
  moves: readonly SessionMove[];
  /** R4: sessions lightened after extra strength work. */
  lightenings: readonly SessionLightening[];
  /** Device-local today, `YYYY-MM-DD`. */
  today: string;
}

/**
 * "Actividad extra" (ADR-P040 Addendum v10-A): the week's workouts that are
 * not a planned session — each with its day, time, kcal and status — and the
 * iCoach's real-time changes (budget bonus, moved and lightened sessions). It
 * renders nothing when there is nothing to tell.
 */
export function ExtraActivityPanel({
  extras,
  calorieBonus,
  moves,
  lightenings,
  today,
}: ExtraActivityPanelProps) {
  const { colors, radius, spacing } = useTheme();
  const { language, t } = useLocalization();
  if (extras.length === 0 && moves.length === 0 && lightenings.length === 0) return null;

  const dayLabel = (date: string) =>
    date === today ? t('workouts.week.today') : t(WEEKDAY_KEYS[WEEKDAYS[dayIndexInWeek(date)]]);

  return (
    <GlassCard testID="workout-extra-panel">
      <View style={[styles.row, styles.wrap, { gap: spacing.sm }]}>
        <Icon color={colors.linkOnStage} name="flame" size={18} />
        <AppText accessibilityRole="header" style={styles.grow} variant="panelTitle">
          {t('workouts.extra.title')}
        </AppText>
        {calorieBonus > 0 ? (
          <Chip
            label={interpolate(t('home.tile.activityBonus'), {
              kcal: formatKcal(calorieBonus, language),
            })}
            testID="workout-extra-bonus"
            tone="energy"
          />
        ) : null}
      </View>

      {extras.map((activity) => {
        const time =
          activity.minutes !== null
            ? interpolate(t('workouts.session.minutes'), {
                minutes: formatNumber(activity.minutes, language),
              })
            : t('workouts.extra.noTime');
        const kcal = activity.kcal !== null ? formatKcalQuantity(activity.kcal, language) : null;
        const status = t(
          activity.status === 'done' ? 'workouts.extra.done' : 'workouts.extra.inProgress',
        );
        const day = dayLabel(activity.date);
        return (
          <View
            key={activity.id}
            accessibilityLabel={[activity.name, day, time, kcal, status]
              .filter((part): part is string => part !== null)
              .join(', ')}
            accessible
            style={{
              backgroundColor: colors.glassFill,
              borderRadius: radius.large,
              gap: spacing.xs,
              padding: spacing.md,
            }}
            testID={`workout-extra-${activity.id}`}
          >
            <View style={[styles.row, styles.wrap, { gap: spacing.sm }]}>
              <AppText style={styles.grow} variant="label">
                {activity.name}
              </AppText>
              <Chip
                label={status}
                testID={`workout-extra-${activity.id}-status`}
                tone={activity.status === 'done' ? 'success' : 'neutral'}
              />
            </View>
            <AppText tone="onStageVariant" variant="caption">
              {[day, time, kcal].filter((part): part is string => part !== null).join(' · ')}
            </AppText>
          </View>
        );
      })}

      {[
        ...moves.map((move) => ({ kind: 'moved' as const, move })),
        ...lightenings.map((l) => ({ kind: 'light' as const, l })),
      ].map((note) => {
        const text =
          note.kind === 'moved'
            ? interpolate(t('workouts.extra.moved'), {
                from: weekdayInSentence(note.move.from, t, language),
                to: weekdayInSentence(note.move.to, t, language),
              })
            : interpolate(t('workouts.extra.lightened'), {
                day: weekdayInSentence(note.l.date, t, language),
                groups: muscleGroupsInSentence(note.l.groups, t, language),
              });
        const key = note.kind === 'moved' ? `moved-${note.move.from}` : `light-${note.l.date}`;
        return (
          <View
            key={key}
            style={[
              styles.row,
              {
                alignItems: 'flex-start',
                backgroundColor: withAlpha(colors.accentCyan, 0.12),
                borderRadius: radius.large,
                gap: spacing.sm,
                padding: spacing.md,
              },
            ]}
            testID={`workout-extra-note-${key}`}
          >
            <Icon color={colors.linkOnStage} name="sparkle" size={16} />
            <AppText style={styles.grow} variant="body">
              {text}
            </AppText>
          </View>
        );
      })}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  row: { alignItems: 'center', flexDirection: 'row' },
  wrap: { flexWrap: 'wrap' },
});
