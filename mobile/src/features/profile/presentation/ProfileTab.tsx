import { router, useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { signOut } from '@/features/authentication';
import { useDashboardStore } from '@/features/dashboard/application/dashboard.store';
import { loadHomeData, useHomeData } from '@/features/dashboard/application/use-home-data';
import { AccountSettingsSection } from '@/features/dashboard/presentation/AccountSettingsSection';
import { evaluationSummaryFrom } from '@/features/evaluation/domain/evaluation';
import {
  ACTIVITY_LABEL,
  INJURY_LABEL,
  STRESS_LABEL,
  foodLabelKey,
} from '@/features/evaluation/presentation/evaluation-copy';
import { PrivacyPolicyLink } from '@/features/legal/presentation/privacy-policy-link';
import { useDietaryPreferenceStore } from '@/features/nutrition/application/dietary-preference.store';
import { TabScreen } from '@/features/shell/presentation/tab-screen';
import { useWellnessSafetyProfileStore } from '@/features/wellness/application/wellness-safety-profile.store';
import {
  formatDate,
  formatNumber,
  formatQuantity,
  interpolate,
  LanguageSelector,
  useLocalization,
} from '@/shared/localization';
import {
  AppButton,
  AppText,
  Chip,
  GlassCard,
  GlassRow,
  Icon,
  type IconName,
} from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useProfileStore } from '../application/profile.store';
import { goalTypeLabelKey } from './goal-type-label';

function Panel({
  icon,
  title,
  right,
  children,
  testID,
}: {
  icon: IconName;
  title: string;
  right?: ReactNode;
  children: ReactNode;
  testID: string;
}) {
  const { colors, spacing } = useTheme();
  return (
    <GlassCard style={{ gap: spacing.md, padding: spacing.lg }} testID={testID}>
      {/* v8 Block 4: as on Inicio (PanelTitle), the title keeps its natural
          width and the chip wraps below it when both do not fit (narrow
          phone, large text), so "Próximamente" never breaks mid-word. */}
      <View
        style={[styles.row, styles.spread, styles.wrap, { gap: spacing.sm }]}
        testID={`${testID}-title-row`}
      >
        <View style={[styles.row, styles.natural, { gap: spacing.sm }]}>
          <Icon color={colors.linkOnStage} name={icon} size={18} />
          <AppText
            accessibilityRole="header"
            style={styles.shrink}
            tone="onStage"
            variant="panelTitle"
          >
            {title}
          </AppText>
        </View>
        {right}
      </View>
      {children}
    </GlassCard>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      style={[
        styles.grow,
        { backgroundColor: colors.glassFill, borderRadius: radius.field, padding: spacing.sm },
      ]}
    >
      <AppText tone="onStageVariant" variant="caption">
        {label}
      </AppText>
      <AppText tone="onStage" variant="label">
        {value}
      </AppText>
    </View>
  );
}

/** One summary line of the evaluation: "Salud:" followed by its chips (they wrap). */
function SummaryRow({
  label,
  chips,
  testID,
}: {
  label: string;
  chips: { label: string; tone: 'energy' | 'neutral' | 'success' }[];
  testID: string;
}) {
  const { spacing } = useTheme();
  return (
    <View style={[styles.row, styles.wrap, { gap: spacing.xs }]} testID={testID}>
      <AppText tone="onStageVariant" variant="caption">
        {label}
      </AppText>
      {chips.map((chip, index) => (
        <Chip
          key={chip.label}
          label={chip.label}
          testID={`${testID}-chip-${index}`}
          tone={chip.tone}
        />
      ))}
    </View>
  );
}

/**
 * The Perfil tab (ADR-P039): the prototype's panels — physical evaluation with
 * its Salud / Alimentación / Estilo de vida summary and "Actualizar
 * evaluación", the goal with the weekly workouts, "Próximamente" and sign-out —
 * plus one compact "Cuenta y ajustes" section holding everything that left
 * Inicio. Salud shows only injuries and pain areas (owner rule, v8): never a
 * medical condition, pressure or pulse (ADR-P038). The prototype's Seguridad
 * panel (Face ID / Huella) is not shown: the app has no biometric capability
 * yet, and a switch that secures nothing would mislead.
 */
export function ProfileTab() {
  const theme = useTheme();
  const { colors, radius, spacing } = theme;
  const { language, t } = useLocalization();
  const refresh = useDashboardStore((s) => s.refresh);
  const profile = useProfileStore((s) => s.profile);
  const wellness = useWellnessSafetyProfileStore((s) => s.profile);
  const preferences = useDietaryPreferenceStore((s) => s.preferences);
  const { summary, currentWeightKg, evaluation, evaluationDate, goalType, goalTargetDate } =
    useHomeData();
  const answers = useMemo(
    () => evaluationSummaryFrom({ profile, wellness, preferences }),
    [profile, wellness, preferences],
  );

  useFocusEffect(
    useCallback(() => {
      void refresh();
      loadHomeData();
      void useDietaryPreferenceStore.getState().load();
    }, [refresh]),
  );

  const kg = (value: number) => formatQuantity(value, 'kg', language, { maximumFractionDigits: 1 });
  const date = (value: string) =>
    formatDate(new Date(`${value}T12:00:00`), language, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  const goalKey = goalType ? goalTypeLabelKey(goalType) : null;
  const target = summary.weight?.target ?? null;
  const goalDetail =
    target === null
      ? null
      : goalTargetDate
        ? interpolate(t('profile.tab.goalDetail'), {
            target: kg(target),
            date: date(goalTargetDate),
          })
        : interpolate(t('profile.tab.goalTarget'), { target: kg(target) });
  const weeklyWorkouts =
    answers.trainingDays === null
      ? null
      : answers.trainingDays === 1
        ? t('profile.tab.trainingDaysOne')
        : interpolate(t('profile.tab.trainingDaysMany'), {
            n: formatNumber(answers.trainingDays, language),
          });
  // The prototype's Meta line: "78 kg para el 31 de diciembre · 4 entrenamientos
  // por semana". Without a target the empty-state prompt stands alone.
  const goalLine =
    goalDetail === null
      ? null
      : [goalDetail, weeklyWorkouts].filter((part) => part !== null).join(' · ');
  const summaryLabel = (section: string) => interpolate(t('profile.tab.summaryLabel'), { section });
  const lower = (value: string) => value.toLocaleLowerCase(language);
  const lifestyleChips = [
    answers.activityLevel
      ? interpolate(t('profile.tab.activityChip'), {
          level: lower(t(ACTIVITY_LABEL[answers.activityLevel])),
        })
      : null,
    answers.stressLevel !== null
      ? interpolate(t('profile.tab.stressChip'), {
          level: lower(t(STRESS_LABEL[answers.stressLevel])),
        })
      : null,
  ]
    .filter((label): label is string => label !== null)
    .map((label) => ({ label, tone: 'neutral' as const }));

  return (
    <TabScreen>
      <Panel
        icon="clipboard"
        right={
          evaluationDate ? (
            <AppText tone="onStageVariant" variant="caption">
              {formatDate(new Date(`${evaluationDate}T12:00:00`), language, {
                day: 'numeric',
                month: 'short',
              })}
            </AppText>
          ) : undefined
        }
        testID="profile-evaluation"
        title={t('profile.tab.evalTitle')}
      >
        <View style={[styles.row, styles.stretch, { gap: spacing.sm }]}>
          <Stat
            label={t('profile.tab.weight')}
            value={currentWeightKg !== null ? kg(currentWeightKg) : '–'}
          />
          <Stat
            label={t('profile.tab.height')}
            value={profile?.heightCm ? formatQuantity(profile.heightCm, 'cm', language) : '–'}
          />
          <Stat
            label={t('home.eval.bmi')}
            value={
              evaluation
                ? formatNumber(evaluation.bmi, language, {
                    maximumFractionDigits: 1,
                    minimumFractionDigits: 1,
                  })
                : '–'
            }
          />
        </View>
        <View style={{ gap: spacing.sm }} testID="profile-evaluation-summary">
          <SummaryRow
            chips={
              answers.injuries.length > 0
                ? answers.injuries.map((injury) => ({
                    label: t(INJURY_LABEL[injury]),
                    tone: 'energy' as const,
                  }))
                : [{ label: t('evaluation.review.noInjuries'), tone: 'success' }]
            }
            label={summaryLabel(t('evaluation.step.health'))}
            testID="profile-summary-health"
          />
          <SummaryRow
            chips={
              answers.foods.length > 0
                ? answers.foods.map((id) => ({
                    label: t(foodLabelKey(id)),
                    tone: 'energy' as const,
                  }))
                : [{ label: t('evaluation.review.noFoods'), tone: 'success' }]
            }
            label={summaryLabel(t('evaluation.step.food'))}
            testID="profile-summary-food"
          />
          {lifestyleChips.length > 0 ? (
            <SummaryRow
              chips={lifestyleChips}
              label={summaryLabel(t('evaluation.step.lifestyle'))}
              testID="profile-summary-lifestyle"
            />
          ) : null}
        </View>
        <AppButton
          accessibilityLabel={t('dashboard.wellnessSafetyAccessibility')}
          onPress={() => router.push('/evaluation?mode=update')}
          testID="profile-wellness-safety"
        >
          {t('profile.tab.updateEval')}
        </AppButton>
      </Panel>

      <Panel icon="target" testID="profile-goal-card" title={t('profile.tab.goalTitle')}>
        {goalKey ? (
          <AppText tone="onStage" variant="label">
            {t(goalKey)}
          </AppText>
        ) : null}
        <AppText tone="onStageVariant" testID="profile-goal-detail" variant="caption">
          {goalLine ?? t('profile.tab.goalEmpty')}
        </AppText>
        <GlassRow
          icon="target"
          label={t('goal.editTitle')}
          onPress={() => router.push('/goal-edit')}
          testID="profile-goal"
        />
      </Panel>

      <Panel
        icon="watch"
        right={<Chip label={t('home.soon.chip')} />}
        testID="profile-soon"
        title={t('home.soon.title')}
      >
        <AppText tone="onStageVariant" variant="caption">
          {t('profile.tab.soonBody')}
        </AppText>
      </Panel>

      <Panel icon="user" testID="profile-settings" title={t('profile.tab.settingsTitle')}>
        <AccountSettingsSection />
        <GlassRow
          icon="user"
          label={t('profile.editTitle')}
          onPress={() => router.push('/profile-edit')}
          testID="profile-edit"
        />
        <GlassRow
          accessibilityLabel={t('dashboard.subscriptionAccessibility')}
          icon="sparkle"
          label={t('dashboard.subscription')}
          onPress={() => router.push('/subscription')}
          testID="profile-subscription"
        />
        <LanguageSelector appearance="stage" />
        <PrivacyPolicyLink testID="profile-privacy-policy" />
      </Panel>

      {/* Sign-out clears the session; the tab's session guard then redirects
          to /sign-in — no manual navigation. */}
      <Pressable
        accessibilityLabel={t('dashboard.signOutAccessibility')}
        accessibilityRole="button"
        onPress={() => {
          void signOut();
        }}
        style={({ pressed }) => [
          styles.row,
          styles.center,
          {
            backgroundColor: pressed ? colors.glassFill : 'transparent',
            borderColor: colors.glassBorder,
            borderRadius: radius.field,
            borderWidth: 1,
            gap: spacing.sm,
            minHeight: theme.spacing.x5l,
          },
        ]}
        testID="profile-sign-out"
      >
        <Icon color={colors.errorOnStage} name="logout" size={18} />
        <AppText style={{ color: colors.errorOnStage }} variant="label">
          {t('dashboard.signOut')}
        </AppText>
      </Pressable>
      <AppButton
        accessibilityLabel={t('dashboard.deleteAccountAccessibility')}
        onPress={() => router.push('/delete-account')}
        testID="profile-delete-account"
        variant="stage-link"
      >
        {t('dashboard.deleteAccount')}
      </AppButton>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    justifyContent: 'center',
  },
  grow: {
    flex: 1,
  },
  natural: {
    flexShrink: 0,
    maxWidth: '100%',
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
  wrap: {
    flexWrap: 'wrap',
  },
});
