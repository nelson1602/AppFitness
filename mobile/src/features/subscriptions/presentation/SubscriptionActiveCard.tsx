import { View } from 'react-native';

import { useLocalization } from '@/shared/localization';
import { AppButton, AppText, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { PurchaseAccessSnapshot } from '../domain/purchases.port';
import { accessLine } from './subscription-copy';

interface SubscriptionActiveCardProps {
  readonly access: PurchaseAccessSnapshot;
  readonly managing: boolean;
  readonly disabled: boolean;
  readonly onManage: () => void;
}

/**
 * Shown only when the provider reports the entitlement active. Status is
 * carried by text (title and renewal line), never by colour alone, and the
 * card offers management — cancellation lives in the store, not here.
 */
export function SubscriptionActiveCard({
  access,
  managing,
  disabled,
  onManage,
}: SubscriptionActiveCardProps) {
  const theme = useTheme();
  const { t, language } = useLocalization();

  return (
    <Card testID="subscription-active">
      <View style={{ gap: theme.spacing.md }}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText accessibilityRole="header" variant="title" tone="success">
            {t('subscription.activeTitle')}
          </AppText>
          <AppText tone="muted">{accessLine(access, t, language)}</AppText>
        </View>
        <AppButton
          accessibilityLabel={t('subscription.manageAccessibility')}
          disabled={disabled}
          loading={managing}
          onPress={onManage}
          style={{ minHeight: theme.spacing.x5l }}
          testID="subscription-manage"
          variant="secondary"
        >
          {t('subscription.manage')}
        </AppButton>
      </View>
    </Card>
  );
}
