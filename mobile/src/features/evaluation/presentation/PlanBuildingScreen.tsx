import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { loadHomeData } from '@/features/dashboard/application/use-home-data';
import { useWeeklyPlanStore } from '@/features/weekly-plan/application/weekly-plan.store';
import { formatNumber, formatQuantity, interpolate, useLocalization } from '@/shared/localization';
import {
  AppButton,
  AppText,
  Banner,
  GradientText,
  Icon,
  Mascot,
  Pulse,
  Screen,
  StageSurfaceProvider,
  useReducedMotion,
  withAlpha,
} from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useEvaluationStore } from '../application/evaluation.store';
import { INJURY_LABEL, foodLabelKey } from './evaluation-copy';

/** The design's pacing: one line every 650 ms, then a second on the full list. */
export const BUILD_STEP_MS = 650;
export const BUILD_HOLD_MS = 1000;

/**
 * "Creando tu plan personal" (design README flow: Evaluación → the iCoach
 * creates the plan → "Tu meta te espera"). The list reads what the iCoach is
 * doing with the evaluation while the first week's plan is saved
 * (ADR-P042 D2, FIRST_RUN). It moves on only once the plan exists.
 */
export function PlanBuildingScreen() {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const { language, t } = useLocalization();
  const reduceMotion = useReducedMotion();
  const draft = useEvaluationStore((s) => s.draft);
  const planStatus = useWeeklyPlanStore((s) => s.status);
  const current = useWeeklyPlanStore((s) => s.current);
  const [shown, setShown] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    void useWeeklyPlanStore.getState().load();
  }, [attempt]);

  const items = useMemo(() => {
    const foods = draft ? Object.keys(draft.foods).map((id) => t(foodLabelKey(id))) : [];
    const injuries = draft ? draft.injuries.map((injury) => t(INJURY_LABEL[injury])) : [];
    const lines = [t('building.step.analyze')];
    lines.push(
      foods.length > 0
        ? interpolate(t('building.step.foods'), {
            list: foods.join(', ').toLocaleLowerCase(language),
          })
        : t('building.step.noFoods'),
    );
    lines.push(
      injuries.length > 0
        ? interpolate(t('building.step.injuries'), {
            list: injuries.join(', ').toLocaleLowerCase(language),
          })
        : t('building.step.noInjuries'),
    );
    if (current) {
      lines.push(
        interpolate(t('building.step.kcal'), {
          kcal: formatQuantity(current.plan.targets.calories, 'kcal', language),
        }),
      );
      const days = current.plan.days.filter((day) => day.workout.kind === 'TRAINING').length;
      lines.push(interpolate(t('building.step.days'), { n: formatNumber(days, language) }));
    }
    return lines;
  }, [draft, current, language, t]);

  const ready = planStatus === 'ready' && current !== null;
  const failed = planStatus === 'gap' || planStatus === 'error';
  const visible = reduceMotion ? items.length : shown;

  useEffect(() => {
    if (failed) return;
    if (visible < items.length) {
      const timer = setTimeout(() => setShown((n) => n + 1), BUILD_STEP_MS);
      return () => clearTimeout(timer);
    }
    if (!ready) return;
    const timer = setTimeout(
      () => {
        loadHomeData();
        router.replace('/welcome');
      },
      reduceMotion ? 0 : BUILD_HOLD_MS,
    );
    return () => clearTimeout(timer);
  }, [visible, items.length, ready, failed, reduceMotion]);

  const headline = {
    ...theme.typography.headline,
    fontFamily: theme.typography.display.fontFamily,
  };

  return (
    <Screen stage>
      <StageSurfaceProvider>
        <View style={{ marginHorizontal: -spacing.lg, marginTop: -spacing.lg }}>
          <Mascot maxHeight={260} testID="building-mascot" variant="hero" />
          <View style={{ marginTop: -spacing.lg }}>
            <Pulse gradientId="pulse-building" testID="building-pulse" />
          </View>
        </View>

        <View style={{ gap: spacing.xs }}>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}>
            <Icon color={colors.accentCyan} name="sparkle" size={16} />
            <AppText style={{ color: colors.accentCyan }} variant="caption">
              {t('building.eyebrow')}
            </AppText>
          </View>
          <View
            accessibilityLabel={`${t('building.titleLead')} ${t('building.titleAccent')}`}
            accessibilityRole="header"
            accessible
            style={{ flexDirection: 'row', flexWrap: 'wrap' }}
            testID="building-title"
          >
            <Text allowFontScaling style={[headline, { color: colors.onStage }]}>
              {`${t('building.titleLead')} `}
            </Text>
            <GradientText end={colors.accentEnergy} start={colors.accentCyan} textStyle={headline}>
              {t('building.titleAccent')}
            </GradientText>
          </View>
        </View>

        <View accessibilityLiveRegion="polite" style={{ gap: spacing.md }} testID="building-steps">
          {items.map((line, i) => {
            const done = i < visible;
            return (
              <View
                key={line}
                style={{
                  alignItems: 'center',
                  flexDirection: 'row',
                  gap: spacing.md,
                  opacity: done ? 1 : 0.35,
                }}
                testID={`building-step-${i}${done ? '-done' : ''}`}
              >
                <View
                  style={{
                    alignItems: 'center',
                    backgroundColor: done ? colors.accentCyan : 'transparent',
                    borderColor: done ? colors.accentCyan : withAlpha(colors.onStage, 0.3),
                    borderRadius: theme.radius.full,
                    borderWidth: 2,
                    height: 28,
                    justifyContent: 'center',
                    width: 28,
                  }}
                >
                  {done ? (
                    <Icon color={colors.stageDeep} name="check" size={15} strokeWidth={3} />
                  ) : null}
                </View>
                <AppText style={{ flex: 1 }} tone="onStage">
                  {line}
                </AppText>
              </View>
            );
          })}
        </View>

        {failed ? (
          <View style={{ gap: spacing.sm }} testID="building-error">
            <Banner title={t('building.error')} tone="error" />
            <AppButton onPress={() => setAttempt((n) => n + 1)} testID="building-retry">
              {t('building.retry')}
            </AppButton>
            <AppButton
              onPress={() => router.replace('/evaluation')}
              testID="building-review"
              variant="stage-link"
            >
              {t('building.review')}
            </AppButton>
          </View>
        ) : null}
      </StageSurfaceProvider>
    </Screen>
  );
}
