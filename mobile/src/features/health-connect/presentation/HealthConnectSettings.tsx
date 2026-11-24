import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  formatQuantity,
  interpolate,
  useLocalization,
  type TranslationKey,
} from '@/shared/localization';
import { AppButton, AppText, AppTextInput, GlassRow } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useHealthConnectStore, type WatchStatus } from '../application/health-connect.store';
import { parseWaterGoal } from '../domain/watch-activity';
import { HealthSourcePicker } from './HealthSourcePicker';

const STATUS_KEY: Partial<Record<WatchStatus, TranslationKey>> = {
  connected: 'profile.watch.connected',
  'not-connected': 'profile.watch.notConnected',
  'needs-update': 'profile.watch.needsUpdate',
};

/**
 * Perfil → "Reloj y Health Connect" (ADR-P048): the connection, which opens
 * the rationale screen, the data source (which app's data are read), and the
 * person's own water goal (local, no default, never synced). Rendered by
 * Perfil only when the watch UI shows.
 */
export function HealthConnectSettings({ status }: { status: WatchStatus }) {
  const { spacing } = useTheme();
  const { language, t } = useLocalization();
  const goal = useHealthConnectStore((s) => s.waterGoalMl);
  const [text, setText] = useState(goal === null ? '' : String(goal));
  const [message, setMessage] = useState<string | null>(null);
  const statusKey = STATUS_KEY[status];
  const ml = (value: number) => formatQuantity(value, 'ml', language);

  const save = async () => {
    const parsed = parseWaterGoal(text);
    if (parsed === null) {
      setMessage(t('profile.waterGoal.invalid'));
      return;
    }
    await useHealthConnectStore.getState().setWaterGoal(parsed);
    setText(String(parsed));
    setMessage(interpolate(t('profile.waterGoal.saved'), { goal: ml(parsed) }));
  };
  const clear = async () => {
    await useHealthConnectStore.getState().setWaterGoal(null);
    setText('');
    setMessage(null);
  };

  return (
    <View style={{ gap: spacing.md }}>
      <AppText tone="onStageVariant" testID="profile-watch-subtitle" variant="caption">
        {t('watch.subtitle')}
      </AppText>
      <GlassRow
        detail={statusKey ? t(statusKey) : undefined}
        icon="watch"
        label={t('healthConnect.title')}
        onPress={() => router.push('/health-connect')}
        testID="profile-health-connect"
      />
      {status === 'connected' ? <HealthSourcePicker /> : null}
      {status === 'connected' ? (
        <View style={{ gap: spacing.sm }} testID="profile-water-goal">
          <AppText tone="onStage" variant="label">
            {t('profile.waterGoal.label')}
          </AppText>
          <AppTextInput
            accessibilityLabel={t('profile.waterGoal.label')}
            appearance="stage"
            keyboardType="numeric"
            onChangeText={setText}
            testID="profile-water-goal-input"
            value={text}
          />
          <AppText tone="onStageVariant" variant="caption">
            {t('profile.waterGoal.hint')}
          </AppText>
          {message ? (
            <AppText
              accessibilityLiveRegion="polite"
              tone="onStageVariant"
              testID="profile-water-goal-message"
              variant="caption"
            >
              {message}
            </AppText>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <AppButton onPress={() => void save()} testID="profile-water-goal-save">
              {t('profile.waterGoal.save')}
            </AppButton>
            {goal !== null ? (
              <AppButton
                onPress={() => void clear()}
                testID="profile-water-goal-clear"
                variant="secondary"
              >
                {t('profile.waterGoal.clear')}
              </AppButton>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}
