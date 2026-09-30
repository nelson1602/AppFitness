import { View } from 'react-native';

import { useLocalization } from '@/shared/localization';
import { AppButton, AppText, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { SubscriptionStoreKind } from '../application/subscription.store';
import type { SubscriptionOffer } from '../domain/purchases.port';
import { chargeTermsKey, offerCopy } from './subscription-copy';

interface SubscriptionOfferCardProps {
  readonly offer: SubscriptionOffer;
  readonly storeKind: SubscriptionStoreKind;
  readonly purchasing: boolean;
  readonly disabled: boolean;
  readonly onPurchase: () => void;
}

/**
 * The single monthly offer. One filled primary action; everything else on the
 * card is information. The trial headline appears only when the normalized
 * offer carries a store-confirmed free trial, and every price is the store's
 * own localized string.
 */
export function SubscriptionOfferCard({
  offer,
  storeKind,
  purchasing,
  disabled,
  onPurchase,
}: SubscriptionOfferCardProps) {
  const theme = useTheme();
  const { t, language } = useLocalization();
  const copy = offerCopy(offer, t, language);

  return (
    <Card testID="subscription-offer">
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.sm }}>
          <AppText accessibilityRole="header" variant="label" tone="muted">
            {t('subscription.benefitsTitle')}
          </AppText>
          <AppText>{t('subscription.benefitTracking')}</AppText>
          <AppText>{t('subscription.benefitPlans')}</AppText>
          <AppText>{t('subscription.benefitSync')}</AppText>
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <AppText testID="subscription-offer-headline" variant="headline">
            {copy.headline}
          </AppText>
          {copy.priceLine ? (
            <AppText testID="subscription-offer-price" tone="muted">
              {copy.priceLine}
            </AppText>
          ) : null}
        </View>

        <AppButton
          accessibilityLabel={copy.actionAccessibility}
          disabled={disabled}
          loading={purchasing}
          onPress={onPurchase}
          style={{ minHeight: theme.spacing.x5l }}
          testID="subscription-purchase"
          variant="primary"
        >
          {copy.actionLabel}
        </AppButton>

        <View style={{ gap: theme.spacing.xs }}>
          <AppText testID="subscription-renewal-terms" variant="caption" tone="muted">
            {copy.renewalTerms}
          </AppText>
          <AppText variant="caption" tone="muted">
            {t(chargeTermsKey(storeKind))}
          </AppText>
          <AppText variant="caption" tone="muted">
            {t('subscription.deletionTerms')}
          </AppText>
        </View>
      </View>
    </Card>
  );
}
