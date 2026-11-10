import { Redirect, Stack, router } from 'expo-router';
import { View } from 'react-native';

import { useSession } from '@/features/authentication';
import { PrivacyPolicyLink } from '@/features/legal/presentation/privacy-policy-link';
import { useLocalization } from '@/shared/localization';
import { AppButton, AppText, Card, StageScreen } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

/**
 * Perfil → Cuenta y ajustes → "Privacidad y datos" (v10 Block C, item 12).
 * Holds the privacy policy and the in-app account deletion Google Play
 * requires; `/delete-account` keeps its path, so the Web deletion link works.
 */
export default function PrivacyDataScreen() {
  const theme = useTheme();
  const { t } = useLocalization();
  const { status } = useSession();

  if (status === 'unauthenticated' || status === 'locked') return <Redirect href="/sign-in" />;

  return (
    <StageScreen>
      <Stack.Screen options={{ title: t('privacyData.title') }} />
      <AppText tone="muted">{t('privacyData.body')}</AppText>
      <Card>
        <View style={{ gap: theme.spacing.sm }}>
          <PrivacyPolicyLink testID="privacy-data-policy" />
        </View>
      </Card>
      <Card>
        <View style={{ gap: theme.spacing.sm }}>
          <AppButton
            accessibilityLabel={t('dashboard.deleteAccountAccessibility')}
            onPress={() => router.push('/delete-account')}
            testID="privacy-data-delete-account"
            variant="destructive"
          >
            {t('dashboard.deleteAccount')}
          </AppButton>
          <AppText tone="muted" variant="caption">
            {t('privacyData.deleteHint')}
          </AppText>
        </View>
      </Card>
    </StageScreen>
  );
}
