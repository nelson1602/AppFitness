import { View } from 'react-native';

import { useLocalization } from '@/shared/localization';
import { AppButton, AppText, Screen, StageSurfaceProvider } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { openStoreListing } from '../infrastructure/installed-app';

/**
 * ADR-P049 amendment 1: shown by the root layout over the (still mounted,
 * hidden) navigator while this Android build is below the server's minimum.
 * It only covers the UI — local data, the session and background sync are
 * untouched — and its one action opens the app's Google Play listing.
 */
export function UpdateRequiredScreen() {
  const theme = useTheme();
  const { t } = useLocalization();
  return (
    <Screen stage style={{ flexGrow: 1 }}>
      <StageSurfaceProvider>
        <View
          style={{ flex: 1, gap: theme.spacing.lg, justifyContent: 'center' }}
          testID="update-required-screen"
        >
          <View style={{ gap: theme.spacing.sm }}>
            <AppText accessibilityRole="header" variant="headline">
              {t('appConfig.updateRequired.title')}
            </AppText>
            <AppText tone="muted">{t('appConfig.updateRequired.body')}</AppText>
          </View>
          <AppButton
            accessibilityLabel={t('appConfig.updateRequired.action')}
            onPress={() => void openStoreListing()}
            testID="button-update-required"
          >
            {t('appConfig.updateRequired.action')}
          </AppButton>
        </View>
      </StageSurfaceProvider>
    </Screen>
  );
}
