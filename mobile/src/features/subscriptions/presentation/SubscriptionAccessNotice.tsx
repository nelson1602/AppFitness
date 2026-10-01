import { router } from 'expo-router';
import { View } from 'react-native';

import { useEntitlementAccess } from '@/shared/application/use-entitlement-access';
import { useLocalization } from '@/shared/localization';
import { AppButton, Banner } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

/** Shared, bilingual explanation for every S-4 read-only product surface. */
export function SubscriptionAccessNotice() {
  const { mode } = useEntitlementAccess();
  const { t } = useLocalization();
  const theme = useTheme();

  if (mode === 'unregulated' || mode === 'active') return null;

  const checking = mode === 'checking';
  return (
    <View style={{ gap: theme.spacing.md }} testID="subscription-access-notice">
      <Banner
        title={t(checking ? 'subscription.accessCheckingTitle' : 'subscription.readOnlyTitle')}
        tone={checking ? 'info' : 'warning'}
      >
        {t(checking ? 'subscription.accessCheckingBody' : 'subscription.readOnlyBody')}
      </Banner>
      {checking ? null : (
        <AppButton
          onPress={() => router.push('/subscription')}
          testID="subscription-access-open"
          variant="secondary"
        >
          {t('subscription.open')}
        </AppButton>
      )}
    </View>
  );
}
