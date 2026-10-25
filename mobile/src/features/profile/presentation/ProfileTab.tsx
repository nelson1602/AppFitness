import { router, useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { signOut } from '@/features/authentication';
import { useDashboardStore } from '@/features/dashboard/application/dashboard.store';
import { loadHomeData, useHomeData } from '@/features/dashboard/application/use-home-data';
import { AccountSettingsSection } from '@/features/dashboard/presentation/AccountSettingsSection';
import { TabScreen } from '@/features/shell/presentation/tab-screen';
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
      <View style={[styles.row, { gap: spacing.sm }]}>
        <Icon color={colors.accentCyan} name={icon} size={18} />
        <AppText accessibilityRole="header" style={styles.grow} tone="onStage" variant="title">
          {title}
        </AppText>
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

/**
 * The Perfil tab (ADR-P039): the prototype's panels — physical evaluation with
 * "Actualizar evaluación", the goal, "Próximamente" and sign-out — plus one
 * compact "Cuenta y ajustes" section holding everything that left Inicio. The
 * biometric switch joins with PR #233; the medical rows (pressure, pulse,
 * conditions) wait for ADR-P038.
 */
export function ProfileTab() {
  const theme = useTheme();
  const { colors, radius, spacing } = theme;
  const { language, t } = useLocalization();
  const refresh = useDashboardStore((s) => s.refresh);
  const profile = useProfileStore((s) => s.profile);
  const { summary, evaluation, evaluationDate, goalType, goalTargetDate } = useHomeData();

  useFocusEffect(
    useCallback(() => {
      void refresh();
      loadHomeData();
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
            value={summary.weight ? kg(summary.weight.current) : '–'}
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
        <AppButton
          accessibilityLabel={t('dashboard.wellnessSafetyAccessibility')}
          onPress={() => router.push('/wellness-safety-profile')}
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
        <AppText tone="onStageVariant" variant="caption">
          {goalDetail ?? t('profile.tab.goalEmpty')}
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
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  stretch: {
    alignItems: 'stretch',
  },
});
