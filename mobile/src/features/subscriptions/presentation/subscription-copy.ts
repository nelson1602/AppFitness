import {
  formatDate,
  formatNumber,
  interpolate,
  type SupportedLanguage,
  type TranslationKey,
} from '@/shared/localization';

import type {
  SubscriptionIssue,
  SubscriptionNotice,
  SubscriptionStoreKind,
} from '../application/subscription.store';
import type {
  PurchaseAccessSnapshot,
  SubscriptionDuration,
  SubscriptionOffer,
  SubscriptionPeriodUnit,
} from '../domain/purchases.port';

type Translate = (key: TranslationKey) => string;

export interface CopyPair {
  readonly title: TranslationKey;
  readonly body: TranslationKey;
}

/** One complete phrase per unit and count form — never a concatenated fragment. */
const TRIAL_KEYS: Record<SubscriptionPeriodUnit, { one: TranslationKey; many: TranslationKey }> = {
  day: { one: 'subscription.trialDaysOne', many: 'subscription.trialDaysMany' },
  week: { one: 'subscription.trialWeeksOne', many: 'subscription.trialWeeksMany' },
  month: { one: 'subscription.trialMonthsOne', many: 'subscription.trialMonthsMany' },
  year: { one: 'subscription.trialYearsOne', many: 'subscription.trialYearsMany' },
};

const ISSUE_COPY: Record<Exclude<SubscriptionIssue, null>, CopyPair> = {
  network: { title: 'subscription.networkTitle', body: 'subscription.networkBody' },
  purchaseFailed: {
    title: 'subscription.purchaseFailedTitle',
    body: 'subscription.purchaseFailedBody',
  },
  purchaseNotAllowed: {
    title: 'subscription.purchaseNotAllowedTitle',
    body: 'subscription.purchaseNotAllowedBody',
  },
  restoreFailed: {
    title: 'subscription.restoreFailedTitle',
    body: 'subscription.restoreFailedBody',
  },
  manageFailed: { title: 'subscription.manageFailedTitle', body: 'subscription.manageFailedBody' },
  sessionChanged: {
    title: 'subscription.sessionChangedTitle',
    body: 'subscription.sessionChangedBody',
  },
};

export interface NoticeCopy extends CopyPair {
  readonly tone: 'success' | 'info';
}

const NOTICE_COPY: Record<Exclude<SubscriptionNotice, null>, NoticeCopy> = {
  purchased: {
    title: 'subscription.purchasedTitle',
    body: 'subscription.purchasedBody',
    tone: 'success',
  },
  restored: {
    title: 'subscription.restoredTitle',
    body: 'subscription.restoredBody',
    tone: 'success',
  },
  nothingToRestore: {
    title: 'subscription.nothingToRestoreTitle',
    body: 'subscription.nothingToRestoreBody',
    tone: 'info',
  },
};

/** Shown for as long as a pending purchase stands, not only after the call. */
export const PENDING_COPY: NoticeCopy = {
  title: 'subscription.pendingTitle',
  body: 'subscription.pendingBody',
  tone: 'info',
};

const CHARGE_TERMS: Record<SubscriptionStoreKind, TranslationKey> = {
  apple: 'subscription.chargeTermsApple',
  google: 'subscription.chargeTermsGoogle',
};

export function issueCopy(issue: Exclude<SubscriptionIssue, null>): CopyPair {
  return ISSUE_COPY[issue];
}

export function noticeCopy(notice: Exclude<SubscriptionNotice, null>): NoticeCopy {
  return NOTICE_COPY[notice];
}

export function chargeTermsKey(storeKind: SubscriptionStoreKind): TranslationKey {
  return CHARGE_TERMS[storeKind];
}

export function trialLabel(
  trial: SubscriptionDuration,
  t: Translate,
  language: SupportedLanguage,
): string {
  const keys = TRIAL_KEYS[trial.unit];
  return interpolate(t(trial.count === 1 ? keys.one : keys.many), {
    count: formatNumber(trial.count, language),
  });
}

/**
 * Everything the offer card renders, derived only from the normalized store
 * offer. The price string is substituted verbatim — never parsed, rounded,
 * converted or replaced — and trial wording exists only when `freeTrial` does.
 */
export interface OfferCopy {
  readonly headline: string;
  readonly priceLine: string | null;
  readonly actionLabel: string;
  readonly actionAccessibility: string;
  readonly renewalTerms: string;
}

export function offerCopy(
  offer: SubscriptionOffer,
  t: Translate,
  language: SupportedLanguage,
): OfferCopy {
  const price = { price: offer.price };
  if (offer.freeTrial) {
    return {
      headline: trialLabel(offer.freeTrial, t, language),
      priceLine: interpolate(t('subscription.thenPricePerMonth'), price),
      actionLabel: t('subscription.startTrial'),
      actionAccessibility: interpolate(t('subscription.startTrialAccessibility'), price),
      renewalTerms: interpolate(t('subscription.trialRenewalTerms'), price),
    };
  }
  return {
    headline: interpolate(t('subscription.pricePerMonth'), price),
    priceLine: null,
    actionLabel: t('subscription.subscribe'),
    actionAccessibility: interpolate(t('subscription.subscribeAccessibility'), price),
    renewalTerms: interpolate(t('subscription.renewalTerms'), price),
  };
}

/** The active-plan status line. An unparseable or absent date never guesses. */
export function accessLine(
  access: PurchaseAccessSnapshot,
  t: Translate,
  language: SupportedLanguage,
): string {
  const time = access.expiresAt ? Date.parse(access.expiresAt) : Number.NaN;
  if (Number.isNaN(time)) return t('subscription.activeNoDate');
  const date = formatDate(time, language, { dateStyle: 'long' });
  return interpolate(
    t(access.willRenew ? 'subscription.activeRenewsOn' : 'subscription.activeEndsOn'),
    { date },
  );
}
