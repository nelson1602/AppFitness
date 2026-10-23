import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useSession } from '@/features/authentication';
import { loadHomeData, useHomeData } from '@/features/dashboard/application/use-home-data';
import { GoalCard } from '@/features/dashboard/presentation/components/home-cards';
import { formatNumber, interpolate, useLocalization } from '@/shared/localization';
import {
  AppButton,
  AppText,
  Screen,
  useReducedMotion,
  useScreenReader,
} from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { markWelcomeSeen } from '../application/welcome-gate';

/** The design's auto-continue delay. */
export const WELCOME_AUTO_CONTINUE_MS = 5000;

function toDashboard(): void {
  router.replace('/dashboard');
}

/**
 * "Tu meta te espera" after sign-in (ADR-P039 D5): the week's goal and today's
 * plan, then Inicio. It continues by itself after five seconds unless paused,
 * and never by itself under reduced motion or while a screen reader runs —
 * the person moves on with "Ir a mi panel" or "Saltar".
 */
export function WelcomeScreen() {
  const { spacing } = useTheme();
  const { language, t } = useLocalization();
  const { session } = useSession();
  const { summary } = useHomeData();
  const reduceMotion = useReducedMotion();
  const screenReader = useScreenReader();
  const [paused, setPaused] = useState(false);
  const autoContinue = !reduceMotion && !screenReader;

  useEffect(() => {
    markWelcomeSeen();
    loadHomeData();
  }, []);

  useEffect(() => {
    if (!autoContinue || paused) return;
    const timer = setTimeout(toDashboard, WELCOME_AUTO_CONTINUE_MS);
    return () => clearTimeout(timer);
  }, [autoContinue, paused]);

  const today =
    summary.today.kind === 'training'
      ? interpolate(t('welcome.todayTraining'), {
          minutes: formatNumber(summary.today.minutes ?? 45, language),
        })
      : summary.today.kind === 'rest'
        ? t('welcome.todayRest')
        : null;

  return (
    <Screen stage>
      <View style={{ gap: spacing.xs }}>
        <AppText tone="onStageVariant" variant="caption">
          {t('welcome.eyebrow')}
        </AppText>
        <AppText accessibilityRole="header" tone="onStage" variant="headline">
          {interpolate(t('welcome.greeting'), { name: session?.user.username ?? '' })}
        </AppText>
      </View>
      <GoalCard summary={summary} />
      {today ? (
        <AppText testID="welcome-today" tone="onStage">
          {today}
        </AppText>
      ) : null}
      <AppButton onPress={toDashboard} testID="welcome-continue" variant="primary">
        {t('welcome.continue')}
      </AppButton>
      <AppButton onPress={toDashboard} testID="welcome-skip" variant="stage-link">
        {t('welcome.skip')}
      </AppButton>
      {autoContinue ? (
        <View style={{ gap: spacing.xs }}>
          {paused ? null : (
            <AppText testID="welcome-auto" tone="onStageVariant" variant="caption">
              {t('welcome.autoContinue')}
            </AppText>
          )}
          <AppButton
            onPress={() => setPaused((value) => !value)}
            testID="welcome-pause"
            variant="stage-link"
          >
            {paused ? t('welcome.resume') : t('welcome.pause')}
          </AppButton>
        </View>
      ) : null}
    </Screen>
  );
}
