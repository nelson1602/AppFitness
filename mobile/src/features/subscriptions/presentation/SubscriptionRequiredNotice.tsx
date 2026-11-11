import { router } from 'expo-router';
import { View } from 'react-native';

import { useLocalization } from '@/shared/localization';
import { AppButton, Banner } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

/**
 * The server refused a write with 402 SUBSCRIPTION_REQUIRED (v10). Never a
 * connection error: it says a subscription is needed and opens Suscripción.
 *
 * `kept`: the change stays queued on the phone and syncs once access is
 * active. `not-saved`: a direct request (saving a food from the internet,
 * creating a food) that has nothing queued to keep.
 */
export function SubscriptionRequiredNotice({
  outcome,
  testID = 'subscription-required-notice',
}: {
  outcome: 'kept' | 'not-saved';
  testID?: string;
}) {
  const { t } = useLocalization();
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }} testID={testID}>
      <Banner title={t('subscription.requiredTitle')} tone="warning">
        {t(
          outcome === 'kept'
            ? 'subscription.requiredKeptBody'
            : 'subscription.requiredNotSavedBody',
        )}
      </Banner>
      <AppButton
        onPress={() => router.push('/subscription')}
        testID={`${testID}-open`}
        variant="secondary"
      >
        {t('subscription.open')}
      </AppButton>
    </View>
  );
}
