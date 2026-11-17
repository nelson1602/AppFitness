import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useSession } from '@/features/authentication';
import { PrivacyPolicyLink } from '@/features/legal/presentation/privacy-policy-link';
import { useLocalDay } from '@/shared/application/local-day';
import { useLocalization, type TranslationKey } from '@/shared/localization';
import {
  AppButton,
  AppText,
  Banner,
  Card,
  Icon,
  StageScreen,
  type IconName,
} from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useHealthConnectStore } from '../application/health-connect.store';
import { useWatchStatus } from '../application/use-watch-status';

const TYPES: readonly { icon: IconName; title: TranslationKey; body: TranslationKey }[] = [
  { icon: 'chart', title: 'healthConnect.stepsTitle', body: 'healthConnect.stepsBody' },
  {
    icon: 'flame',
    title: 'healthConnect.activeCaloriesTitle',
    body: 'healthConnect.activeCaloriesBody',
  },
  { icon: 'dumbbell', title: 'healthConnect.exerciseTitle', body: 'healthConnect.exerciseBody' },
  { icon: 'drop', title: 'healthConnect.hydrationTitle', body: 'healthConnect.hydrationBody' },
];

/**
 * The Health Connect permission rationale (ADR-P048), required by Health
 * Connect: what each of the four read types is for, in plain words, and the
 * privacy policy. Health Connect opens it from its permission dialog (the
 * MainActivity intent becomes `appfitness://health-connect`), and the app opens
 * it before asking. It shows even without a signed-in account; connecting
 * needs one.
 */
export function HealthConnectRationaleScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useLocalization();
  const { status: session } = useSession();
  const today = useLocalDay((s) => s.today);
  const status = useWatchStatus();
  const [asked, setAsked] = useState(false);
  const [busy, setBusy] = useState(false);
  const signedIn = session === 'authenticated';

  const connect = async () => {
    setBusy(true);
    await useHealthConnectStore.getState().connect(today);
    setAsked(true);
    setBusy(false);
  };
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const notice: { id: string; text: TranslationKey; tone: 'info' | 'success' } | null =
    status === 'unavailable'
      ? { id: 'unavailable', text: 'healthConnect.unavailable', tone: 'info' }
      : status === 'needs-update'
        ? { id: 'needs-update', text: 'healthConnect.needsUpdate', tone: 'info' }
        : status === 'connected'
          ? { id: 'connected', text: 'healthConnect.connected', tone: 'success' }
          : asked && status === 'not-connected'
            ? { id: 'denied', text: 'healthConnect.denied', tone: 'info' }
            : null;

  return (
    <StageScreen>
      <Stack.Screen options={{ title: t('healthConnect.title') }} />
      <AppText tone="muted">{t('healthConnect.intro')}</AppText>
      <Card>
        <View style={{ gap: spacing.md }} testID="health-connect-types">
          {TYPES.map((type) => (
            <View key={type.title} style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Icon color={colors.linkOnStage} name={type.icon} size={20} />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <AppText variant="label">{t(type.title)}</AppText>
                <AppText tone="muted" variant="caption">
                  {t(type.body)}
                </AppText>
              </View>
            </View>
          ))}
        </View>
      </Card>
      <AppText tone="muted" variant="caption">
        {t('healthConnect.optional')}
      </AppText>
      <PrivacyPolicyLink testID="health-connect-privacy" />

      {notice ? (
        <View testID={`health-connect-${notice.id}`}>
          <Banner title={t(notice.text)} tone={notice.tone} />
        </View>
      ) : null}

      {signedIn && status === 'not-connected' ? (
        <AppButton loading={busy} onPress={() => void connect()} testID="health-connect-continue">
          {t('healthConnect.continue')}
        </AppButton>
      ) : null}
      {signedIn && status === 'connected' ? (
        <AppButton
          onPress={() => useHealthConnectStore.getState().openSettings()}
          testID="health-connect-open"
          variant="secondary"
        >
          {t('healthConnect.open')}
        </AppButton>
      ) : null}
      <AppButton onPress={leave} testID="health-connect-not-now" variant="text">
        {t('healthConnect.notNow')}
      </AppButton>
    </StageScreen>
  );
}
