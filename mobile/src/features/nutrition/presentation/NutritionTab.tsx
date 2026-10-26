import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { loadHomeData, useHomeData } from '@/features/dashboard/application/use-home-data';
import { TabScreen } from '@/features/shell/presentation/tab-screen';
import {
  formatNumber,
  formatQuantity,
  interpolate,
  type TranslationKey,
  useLocalization,
} from '@/shared/localization';
import { AppText, Banner, GlassCard, GlassRow, Icon, ProgressBar } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useFoodLogStore } from '../application/food-log.store';

const MACRO_KEY: Record<'protein' | 'carbs' | 'fat', TranslationKey> = {
  protein: 'nutrition.plan.protein',
  carbs: 'nutrition.plan.carbs',
  fat: 'nutrition.plan.fat',
};
const MACRO_TONE = { protein: 'cyan', carbs: 'success', fat: 'energy' } as const;

/**
 * The Nutrición tab (ADR-P039): the stage with today's calories and macros
 * against the iCoach targets, and rows to the food log, the 15-day plan, the
 * targets in detail and dietary preferences. The day carousel, dishes with
 * their ingredients and the redesigned food logger come with their phase.
 */
export function NutritionTab() {
  const { colors, spacing } = useTheme();
  const { language, t } = useLocalization();
  const status = useFoodLogStore((s) => s.status);
  const { summary, evaluation } = useHomeData();

  useFocusEffect(
    useCallback(() => {
      loadHomeData();
    }, []),
  );

  if (status === 'web-unavailable') {
    return (
      <TabScreen>
        <Banner title={t('nutrition.targets.webUnavailableTitle')} tone="info">
          {t('nutrition.targets.webUnavailableBody')}
        </Banner>
      </TabScreen>
    );
  }

  const { calories } = summary;
  const caloriesValue =
    calories.target === null
      ? t('home.tile.caloriesEmpty')
      : interpolate(t('home.tile.caloriesValue'), {
          consumed: formatNumber(Math.round(calories.consumed ?? 0), language),
          target: formatNumber(calories.target, language),
        });

  return (
    <TabScreen>
      <GlassCard style={{ gap: spacing.md, padding: spacing.lg }} testID="nutrition-today-card">
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Icon color={colors.accentEnergy} name="flame" size={18} />
          <AppText accessibilityRole="header" style={styles.grow} tone="onStage" variant="title">
            {t('nutrition.tab.todayTitle')}
          </AppText>
        </View>
        <AppText tone="onStage" testID="nutrition-calories" variant="title">
          {caloriesValue}
        </AppText>
        <ProgressBar
          accessibilityLabel={t('home.tile.caloriesBar')}
          tone="energy"
          value={calories.share ?? 0}
        />
        {evaluation ? (
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
                  testID={`nutrition-macro-${macro.kind}`}
                >
                  <AppText numberOfLines={1} tone="onStageVariant" variant="caption">
                    {name}
                  </AppText>
                  <AppText tone="onStage" variant="label">
                    {formatQuantity(consumed, 'g', language)}
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
        ) : null}
      </GlassCard>

      <GlassCard style={{ gap: spacing.xs, padding: spacing.sm }} testID="nutrition-rows">
        <GlassRow
          accessibilityLabel={t('dashboard.foodLogAccessibility')}
          icon="food"
          label={t('dashboard.foodLog')}
          onPress={() => router.push('/food-log')}
          testID="nutrition-food-log"
        />
        <GlassRow
          icon="clipboard"
          label={t('nutrition.targets.viewPlan')}
          onPress={() => router.push('/nutrition-plan')}
          testID="nutrition-plan"
        />
        <GlassRow
          icon="target"
          label={t('nutrition.tab.targetsRow')}
          onPress={() => router.push('/nutrition-targets')}
          testID="nutrition-targets"
        />
        <GlassRow
          accessibilityLabel={t('dashboard.preferencesAccessibility')}
          icon="shield"
          label={t('dashboard.preferences')}
          onPress={() => router.push('/dietary-preferences')}
          testID="nutrition-preferences"
        />
      </GlassCard>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
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
