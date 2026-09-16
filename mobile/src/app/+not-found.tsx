import { Stack, router } from 'expo-router';
import { View } from 'react-native';

import { DocumentHead, useLocalization } from '@/shared/localization';
import { AppButton, AppText, Screen } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

/**
 * Product not-found screen (BUG-016 F-4, ADR-P032).
 *
 * Authoring this file replaces Expo Router's generated `+not-found` route, so
 * the built-in `Unmatched` screen — `Unmatched Route`, `Page could not be
 * found.`, `Go back` and a `Sitemap` link, all framework English and none of it
 * `__DEV__`-gated — no longer serves an unmatched URL.
 *
 * **Why this surface matters on Web.** A mistyped, truncated or expired
 * recovery or verification link lands here, which is the moment a locked-out
 * user is already least able to absorb a wrong-language developer screen. All
 * copy resolves through the bilingual catalogues; the body names the one cause
 * a portal visitor is most likely to have hit without asserting which one
 * happened.
 *
 * **No sitemap.** `/_sitemap` is a development affordance that enumerates every
 * route in the app, including the surfaces that are dormant on Web under
 * ADR-P019. It is deliberately not offered here.
 *
 * The single action goes to `/`, which resolves by session — dashboard when one
 * exists, sign-in otherwise — so the same label is correct on Web and native,
 * signed in and signed out.
 */
export default function NotFoundScreen() {
  const theme = useTheme();
  const { t } = useLocalization();

  return (
    <Screen>
      <Stack.Screen options={{ title: t('notFound.title') }} />
      <DocumentHead title={t('notFound.title')} />
      <View style={{ gap: theme.spacing.lg }} testID="not-found-screen">
        <View>
          <AppText variant="headline">{t('notFound.title')}</AppText>
          <AppText tone="muted">{t('notFound.body')}</AppText>
        </View>

        <AppButton
          accessibilityLabel={t('notFound.action')}
          onPress={() => router.replace('/')}
          testID="button-not-found-home"
        >
          {t('notFound.action')}
        </AppButton>
      </View>
    </Screen>
  );
}
