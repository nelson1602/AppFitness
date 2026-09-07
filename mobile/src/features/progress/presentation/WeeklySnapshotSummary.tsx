import { View } from 'react-native';

import {
  formatDate,
  formatNumber,
  useLocalization,
  type SupportedLanguage,
} from '@/shared/localization';
import { AppText } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { ProgressSnapshot } from '../domain/progress';
import { SyncHint } from './SyncHint';

interface WeeklySnapshotSummaryProps {
  /** Snapshots newest-first (as the store returns them). */
  snapshots: readonly ProgressSnapshot[];
  /** How many recent weeks to list after the latest. */
  recentCount?: number;
}

const DEFAULT_RECENT = 4;

/** Locale-aware value with a unit suffix; null renders as an em dash. */
function num(value: number | null, unit: string, language: SupportedLanguage): string {
  if (value === null) return '—';
  return `${formatNumber(value, language)}${unit}`;
}

/**
 * Announced counterpart of `num` for a metric row (UX-3D R-10). The visible `—`
 * is a compact VISUAL convention for "not recorded"; announcing "dash" carries
 * no meaning, and "zero", "none" or "unknown" would each be an invention. So
 * the two deliberately differ: the eye gets `—`, the announcement gets the
 * localized phrase. Non-null values announce exactly what is rendered.
 */
function announcedNum(
  value: number | null,
  unit: string,
  language: SupportedLanguage,
  notRecorded: string,
): string {
  if (value === null) return notRecorded;
  return num(value, unit, language);
}

/**
 * Parse a stored `YYYY-MM-DD` as a user-local calendar date for display only —
 * never a UTC timestamp, so the shown day can't shift across time zones
 * (ADR-P016 D6). Presentation-only; stored values/ordering are unchanged.
 */
function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Format a stored week-start `YYYY-MM-DD` for display in the active language. */
function formatWeek(iso: string, language: SupportedLanguage): string {
  return formatDate(parseLocalDate(iso), language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * One metric row = one INTENTIONAL accessible leaf (UX-3D §Weekly snapshot
 * semantics 1). Its two `Text` children are deliberately combined into a single
 * element announcing label then value, and neither child is a focus target of
 * its own — so this is the shape exception to the no-nesting rule, not an
 * exception to the rule itself: the row has no accessible ancestor and owns no
 * descendant that must stay independently selectable (R-12).
 *
 * Both children are marked `accessible={false}` **explicitly**. React Native's
 * `Text` is an accessibility element by default, so leaving it implicit would
 * put two named elements underneath an accessible, labelled row — exactly the
 * nesting the rule forbids, and the reason the row's combined label could be
 * bypassed. Being explicit makes the row the only leaf here by contract rather
 * than by luck.
 *
 * `accessibleValue` exists so a null metric can show `—` while announcing the
 * localized "not recorded" phrase (R-10); it defaults to the rendered value,
 * because every non-nullable row announces exactly what it shows.
 */
function MetricRow({
  label,
  value,
  accessibleValue = value,
}: {
  label: string;
  value: string;
  accessibleValue?: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${accessibleValue}`}
      style={{ flexDirection: 'row', justifyContent: 'space-between' }}
    >
      <AppText accessible={false} tone="muted">
        {label}
      </AppText>
      <AppText accessible={false} variant="label">
        {value}
      </AppText>
    </View>
  );
}

/**
 * Weekly snapshot summary (ADR-P016 Phase 17 Slice 5b). Renders the latest
 * deterministic `progress_snapshots` row (avg weight, total volume, avg
 * calories, workout count, deload flag) plus a short recent-weeks list. The
 * deload flag is shown as TEXT (Yes/No), never color-only. Nulls render as "—".
 * Copy is localized and numbers/dates use the active language; stored values,
 * rule versions, ordering, and calculations are unchanged. Pure/presentational —
 * this only reads the snapshots the store already holds (feed-not-override, D5).
 *
 * UX-3D (`.ai/20_PROGRESS_NONVISUAL.md`) adds no alternative rendering here —
 * this component is already text-first — but closes three semantic gaps:
 *
 * - a `null` metric announces the localized "not recorded" phrase rather than
 *   the visual `—` (R-10);
 * - the earlier-weeks heading states its NEWEST-FIRST order, which is the
 *   reverse of the trend charts, so no reader carries one order over to the
 *   other (R-11);
 * - each metric row is one accessible leaf announcing label then value.
 *
 * Neither the latest-week block, nor the earlier-weeks list, nor this root is
 * marked `accessible` or given an `accessibilityLabel` (R-12), and no live
 * region or imperative announcement is introduced (R-13).
 *
 * Structure is verifiable here; announcement is NOT. No VoiceOver, TalkBack,
 * browser-AT or large-text outcome is claimed — that is the unrun UX-4C pass.
 */
export function WeeklySnapshotSummary({
  snapshots,
  recentCount = DEFAULT_RECENT,
}: WeeklySnapshotSummaryProps) {
  const theme = useTheme();
  const { t, language } = useLocalization();

  if (snapshots.length === 0) {
    return <AppText tone="muted">{t('progress.weekly.noInsights')}</AppText>;
  }

  const [latest, ...rest] = snapshots;
  const recent = rest.slice(0, recentCount);
  const notRecorded = t('progress.weekly.notRecorded');

  return (
    <View style={{ gap: theme.spacing.md }} testID="weekly-snapshot-summary">
      {/* Plain layout View — the metric rows below are the accessible leaves. */}
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="label" tone="muted">
          {t('progress.weekly.weekOf')} {formatWeek(latest.weekStart, language)}
        </AppText>
        <MetricRow
          label={t('progress.weekly.avgWeight')}
          value={num(latest.avgWeightKg, ' kg', language)}
          accessibleValue={announcedNum(latest.avgWeightKg, ' kg', language, notRecorded)}
        />
        <MetricRow
          label={t('progress.weekly.totalVolume')}
          value={num(latest.totalVolumeKg, ' kg', language)}
          accessibleValue={announcedNum(latest.totalVolumeKg, ' kg', language, notRecorded)}
        />
        <MetricRow
          label={t('progress.weekly.avgCalories')}
          value={num(latest.avgCalories, ' kcal', language)}
          accessibleValue={announcedNum(latest.avgCalories, ' kcal', language, notRecorded)}
        />
        <MetricRow
          label={t('progress.weekly.workouts')}
          value={formatNumber(latest.workoutCount, language)}
        />
        <MetricRow
          label={t('progress.weekly.deloadWeek')}
          value={latest.isDeloadWeek ? t('progress.weekly.yes') : t('progress.weekly.no')}
        />
        <SyncHint syncStatus={latest.syncStatus} />
      </View>

      {recent.length > 0 ? (
        // Plain layout View. The heading states the order as VISIBLE text: the
        // store returns `week_start DESC` and this list does not reverse it, so
        // it runs newest-first — the opposite of the trend charts (R-11).
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" tone="muted">
            {t('progress.weekly.earlierWeeks')} · {t('progress.weekly.newestFirst')}
          </AppText>
          {recent.map((s) => (
            <View key={s.id} style={{ gap: theme.spacing.xs }}>
              <AppText variant="caption" tone="muted">
                {formatWeek(s.weekStart, language)}: {num(s.totalVolumeKg, ' kg', language)}{' '}
                {t('progress.weekly.volume')} · {formatNumber(s.workoutCount, language)}{' '}
                {t(
                  s.workoutCount === 1
                    ? 'progress.weekly.workoutOne'
                    : 'progress.weekly.workoutMany',
                )}
                {s.isDeloadWeek ? ` · ${t('progress.weekly.deloadTag')}` : ''}
              </AppText>
              <SyncHint syncStatus={s.syncStatus} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
