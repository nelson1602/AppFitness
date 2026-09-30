import { interpolate, type TranslationKey } from '@/shared/localization';
import { en } from '@/shared/localization/resources/en';
import { es } from '@/shared/localization/resources/es';

import type {
  SubscriptionDuration,
  SubscriptionOffer,
  SubscriptionOfferHandle,
} from '../domain/purchases.port';
import {
  accessLine,
  chargeTermsKey,
  issueCopy,
  noticeCopy,
  offerCopy,
  PENDING_COPY,
  trialLabel,
} from './subscription-copy';

const tEn = (key: TranslationKey) => en[key];
const tEs = (key: TranslationKey) => es[key];

const offer = (
  freeTrial: SubscriptionDuration | null,
  price = 'RD$ 295.00',
): SubscriptionOffer => ({
  handle: 'offer-1' as SubscriptionOfferHandle,
  productId: 'store_product_monthly',
  price,
  billingPeriod: { unit: 'month', count: 1 },
  freeTrial,
});

const FREE_WORDS = /free|trial|gratis|prueba/i;

describe('subscription copy', () => {
  it.each([
    [{ unit: 'day', count: 1 }, '1 day free', '1 día gratis'],
    [{ unit: 'day', count: 7 }, '7 days free', '7 días gratis'],
    [{ unit: 'week', count: 1 }, '1 week free', '1 semana gratis'],
    [{ unit: 'week', count: 2 }, '2 weeks free', '2 semanas gratis'],
    [{ unit: 'month', count: 1 }, '1 month free', '1 mes gratis'],
    [{ unit: 'month', count: 3 }, '3 months free', '3 meses gratis'],
    [{ unit: 'year', count: 1 }, '1 year free', '1 año gratis'],
    [{ unit: 'year', count: 2 }, '2 years free', '2 años gratis'],
  ] as const)('words a %j trial as one complete phrase', (trial, english, spanish) => {
    expect(trialLabel(trial, tEn, 'en')).toBe(english);
    expect(trialLabel(trial, tEs, 'es')).toBe(spanish);
  });

  it.each([
    ['en', tEn],
    ['es', tEs],
  ] as const)('never mentions a trial when none is confirmed (%s)', (language, t) => {
    const copy = offerCopy(offer(null), t, language);

    for (const value of Object.values(copy)) {
      if (value !== null) expect(value).not.toMatch(FREE_WORDS);
    }
  });

  it.each(['RD$ 295.00', '€4,99', 'US$ 12.34', '₹ 1,299.00', 'CHF 7.–'])(
    'preserves the store price string %s exactly in every field that shows it',
    (price) => {
      const paid = offerCopy(offer(null, price), tEn, 'en');
      const trial = offerCopy(offer({ unit: 'month', count: 1 }, price), tEn, 'en');

      expect(paid.headline).toBe(interpolate(en['subscription.pricePerMonth'], { price }));
      expect(paid.actionAccessibility).toContain(price);
      expect(paid.renewalTerms).toContain(price);
      expect(trial.priceLine).toBe(interpolate(en['subscription.thenPricePerMonth'], { price }));
      expect(trial.actionAccessibility).toContain(price);
      expect(trial.renewalTerms).toContain(price);
    },
  );

  it('uses trial wording only on the trial branch', () => {
    const trial = offerCopy(offer({ unit: 'month', count: 1 }), tEn, 'en');

    expect(trial).toMatchObject({
      headline: '1 month free',
      priceLine: 'Then RD$ 295.00 per month',
      actionLabel: 'Start free trial',
    });
    expect(trial.renewalTerms).toMatch(/^When the free trial ends/);
  });

  it('formats the active line from the provider date in each language', () => {
    const access = {
      isActive: true,
      expiresAt: '2026-11-30T12:00:00.000Z',
      productId: null,
      willRenew: true,
    };

    expect(accessLine(access, tEn, 'en')).toBe('Renews on November 30, 2026');
    expect(accessLine(access, tEs, 'es')).toBe('Se renueva el 30 de noviembre de 2026');
    expect(accessLine({ ...access, willRenew: false }, tEn, 'en')).toBe(
      "Access continues until November 30, 2026. It won't renew.",
    );
    expect(accessLine({ ...access, expiresAt: 'not a date' }, tEn, 'en')).toBe(
      'Your subscription is active on this account.',
    );
  });

  it('maps every issue, notice and store to catalogue keys', () => {
    for (const issue of [
      'network',
      'purchaseFailed',
      'purchaseNotAllowed',
      'restoreFailed',
      'manageFailed',
      'sessionChanged',
    ] as const) {
      const { title, body } = issueCopy(issue);
      expect(en[title]).toBeTruthy();
      expect(es[body]).toBeTruthy();
    }
    for (const notice of ['purchased', 'restored', 'nothingToRestore'] as const) {
      expect(en[noticeCopy(notice).title]).toBeTruthy();
    }
    expect(en[PENDING_COPY.title]).toBe('Purchase pending');
    expect(PENDING_COPY.tone).toBe('info');
    expect(noticeCopy('purchased').tone).toBe('success');
    expect(en[chargeTermsKey('apple')]).toMatch(/Apple/);
    expect(en[chargeTermsKey('google')]).toMatch(/Google Play/);
  });
});
