import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { useLocalization } from '@/shared/localization';
import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { SubscriptionIssue } from '../application/subscription.store';
import { useSubscriptionStore } from '../subscription-store';
import { SubscriptionActiveCard } from './SubscriptionActiveCard';
import { SubscriptionOfferCard } from './SubscriptionOfferCard';
import { issueCopy, noticeCopy, PENDING_COPY } from './subscription-copy';

/** Neutral recovery is informational; only real failures use the error tone. */
function issueTone(issue: Exclude<SubscriptionIssue, null>): 'error' | 'warning' | 'info' {
  if (issue === 'sessionChanged') return 'info';
  if (issue === 'network') return 'warning';
  return 'error';
}

/**
 * The subscription surface (ADR-P034 S-3). Orchestration only: every state and
 * outcome comes from the store as a discriminant and is rendered from the
 * catalogue, so no provider message, identifier or diagnostic can reach the
 * screen. Web renders the ADR-P019 unavailable treatment with no action, and a
 * build without provider keys says so plainly — no offer is ever fabricated.
 */
export function SubscriptionScreen() {
  const theme = useTheme();
  const { t } = useLocalization();
  const { status, storeKind, access, offer, operation, notice, issue, purchasePending } =
    useSubscriptionStore(
      useShallow((state) => ({
        status: state.status,
        storeKind: state.storeKind,
        access: state.access,
        offer: state.offer,
        operation: state.operation,
        notice: state.notice,
        issue: state.issue,
        purchasePending: state.purchasePending,
      })),
    );
  const { load, purchase, restore, manage } = useSubscriptionStore(
    useShallow((state) => ({
      load: state.load,
      purchase: state.purchase,
      restore: state.restore,
      manage: state.manage,
    })),
  );

  // Re-read on every focus: returning from the store's management sheet or a
  // purchase approval must show the provider's current answer, not a cache.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const busy = operation !== null;
  const buttonStyle = { minHeight: theme.spacing.x5l };

  const retry = (
    <AppButton
      accessibilityLabel={t('subscription.retryAccessibility')}
      onPress={() => void load()}
      style={buttonStyle}
      testID="subscription-retry"
      variant="secondary"
    >
      {t('subscription.retry')}
    </AppButton>
  );

  const restoreButton = (
    <AppButton
      accessibilityLabel={t('subscription.restoreAccessibility')}
      disabled={busy}
      loading={operation === 'restoring'}
      onPress={() => void restore()}
      style={buttonStyle}
      testID="subscription-restore"
      variant="text"
    >
      {t('subscription.restore')}
    </AppButton>
  );

  const header = (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText accessibilityRole="header" variant="headline">
        {t('subscription.title')}
      </AppText>
      <AppText tone="muted">{t('subscription.subtitle')}</AppText>
    </View>
  );

  if (status === 'idle' || status === 'loading') {
    return (
      <View style={{ gap: theme.spacing.lg }}>
        {header}
        <Card
          accessible
          accessibilityLabel={t('subscription.loadingAccessibility')}
          accessibilityState={{ busy: true }}
          testID="subscription-loading"
        >
          <View style={{ gap: theme.spacing.md }}>
            <View
              style={{
                backgroundColor: theme.colors.surfaceVariant,
                borderRadius: theme.radius.medium,
                height: theme.spacing.xxl,
                width: '54%',
              }}
            />
            <View
              style={{
                backgroundColor: theme.colors.surfaceVariant,
                borderRadius: theme.radius.medium,
                height: theme.spacing.lg,
                width: '86%',
              }}
            />
          </View>
        </Card>
      </View>
    );
  }

  if (status === 'web-unavailable') {
    return (
      <View style={{ gap: theme.spacing.lg }}>
        {header}
        <Banner title={t('subscription.webUnavailableTitle')} tone="info">
          {t('subscription.webUnavailableBody')}
        </Banner>
      </View>
    );
  }

  if (status === 'unavailable') {
    return (
      <View style={{ gap: theme.spacing.lg }}>
        {header}
        <Banner title={t('subscription.unavailableTitle')} tone="info">
          {t('subscription.unavailableBody')}
        </Banner>
      </View>
    );
  }

  if (status === 'offline' || status === 'error') {
    const copy =
      status === 'offline'
        ? { title: t('subscription.offlineTitle'), body: t('subscription.offlineBody') }
        : issue === 'sessionChanged'
          ? {
              title: t('subscription.sessionChangedTitle'),
              body: t('subscription.sessionChangedBody'),
            }
          : { title: t('subscription.errorTitle'), body: t('subscription.errorBody') };
    const tone = status === 'offline' ? 'warning' : issue === 'sessionChanged' ? 'info' : 'error';
    return (
      <View style={{ gap: theme.spacing.lg }}>
        {header}
        <Banner title={copy.title} tone={tone}>
          {copy.body}
        </Banner>
        {retry}
      </View>
    );
  }

  const noticeText = notice ? noticeCopy(notice) : null;
  const issueText = issue ? issueCopy(issue) : null;

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {header}

      {/* A pending purchase is never active, and it cannot be bought twice:
          the banner stands for as long as the store has not confirmed it. */}
      {purchasePending && !access?.isActive ? (
        <Banner title={t(PENDING_COPY.title)} tone={PENDING_COPY.tone}>
          {t(PENDING_COPY.body)}
        </Banner>
      ) : null}

      {noticeText ? (
        <Banner title={t(noticeText.title)} tone={noticeText.tone}>
          {t(noticeText.body)}
        </Banner>
      ) : null}

      {issue && issueText ? (
        <Banner title={t(issueText.title)} tone={issueTone(issue)}>
          {t(issueText.body)}
        </Banner>
      ) : null}

      {access?.isActive ? (
        <SubscriptionActiveCard
          access={access}
          disabled={busy}
          managing={operation === 'managing'}
          onManage={() => void manage()}
        />
      ) : offer ? (
        <SubscriptionOfferCard
          disabled={busy || purchasePending}
          offer={offer}
          onPurchase={() => void purchase()}
          purchasing={operation === 'purchasing'}
          storeKind={storeKind}
        />
      ) : (
        <>
          {/* A recoverable Error, not Empty: the user cannot create a store
              offer, the provider returned none (or an unusable one), and a
              retry can succeed. The error tone carries the Banner's polite
              announcement request. */}
          <Banner title={t('subscription.noOfferTitle')} tone="error">
            {t('subscription.noOfferBody')}
          </Banner>
          {retry}
        </>
      )}

      {access?.isActive ? null : (
        <AppText variant="caption" tone="muted">
          {t('subscription.ownership')}
        </AppText>
      )}

      {restoreButton}
    </View>
  );
}
