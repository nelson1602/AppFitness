import { en } from '@/shared/localization/resources/en';
import { es } from '@/shared/localization/resources/es';

/**
 * Structural guards for the S-3 subscription surface (ADR-P034 Decisions 3,
 * 4 and 10), checked from source — the same idiom as
 * `subscription-composition.source.spec.ts`.
 *
 * 1. RevenueCat types and values stay inside the one adapter file.
 * 2. No price, currency or trial promise is hardcoded anywhere in the feature
 *    or its catalogue family; every price is a `{price}` substitution.
 */
declare const __dirname: string;
declare function require(id: 'node:fs'): {
  readFileSync(file: string, encoding: 'utf8'): string;
  readdirSync(dir: string): string[];
  statSync(path: string): { isDirectory(): boolean };
};

const fs = require('node:fs');

const SRC = `${__dirname}/../..`.replace(/\\/g, '/');
const ADAPTER = 'features/subscriptions/infrastructure/revenuecat-purchases.adapter.ts';

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (fs.statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.spec\.tsx?$/.test(name) ? [path] : [];
  });
}

const PRODUCTION = sourceFiles(SRC).map((path) => ({
  path: path.replace(/\\/g, '/').slice(SRC.length + 1),
  text: fs.readFileSync(path, 'utf8'),
}));
const FEATURE = PRODUCTION.filter(({ path }) => path.startsWith('features/subscriptions/'));

const english = en as Record<string, string>;
const spanish = es as Record<string, string>;
const FAMILY = Object.keys(english).filter((key) => key.startsWith('subscription.'));

describe('subscription provider boundary', () => {
  it('reads the whole subscriptions feature', () => {
    expect(FEATURE.length).toBeGreaterThanOrEqual(10);
  });

  it('names react-native-purchases in exactly one production file', () => {
    const importers = PRODUCTION.filter(({ text }) => text.includes('react-native-purchases')).map(
      ({ path }) => path,
    );
    expect(importers).toEqual([ADAPTER]);
  });

  it('imports the SDK only as types at module scope', () => {
    const adapter = PRODUCTION.find(({ path }) => path === ADAPTER)?.text ?? '';
    const staticImports = adapter.match(/^import\s[^;]*?from\s+'react-native-purchases';/gms) ?? [];
    expect(staticImports.length).toBeGreaterThan(0);
    for (const statement of staticImports) expect(statement).toMatch(/^import type /);
  });

  it('keeps provider type names out of every other layer', () => {
    const PROVIDER_TYPES =
      /\b(PurchasesPackage|PurchasesStoreProduct|PurchasesOffering|CustomerInfo|SubscriptionOption|PURCHASES_ERROR_CODE|INTRO_ELIGIBILITY_STATUS)\b/;
    const leaking = PRODUCTION.filter(({ path }) => path !== ADAPTER)
      .filter(({ text }) => PROVIDER_TYPES.test(text))
      .map(({ path }) => path);
    expect(leaking).toEqual([]);
  });
});

describe('no hardcoded price or trial promise', () => {
  const CURRENCY = /(US\$|RD\$|\$\s?\d|€|£|\bUSD\b|\bDOP\b|\b\d+[.,]\d{2}\b)/;

  it('keeps currency and price literals out of the feature source', () => {
    const offenders = FEATURE.filter(({ text }) => CURRENCY.test(text)).map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  it('keeps currency and price literals out of the catalogue family', () => {
    for (const key of FAMILY) {
      expect(`${key}: ${english[key]}`).not.toMatch(CURRENCY);
      expect(`${key}: ${spanish[key]}`).not.toMatch(CURRENCY);
    }
  });

  it('shows a price only through the store-supplied {price} substitution', () => {
    const priced = FAMILY.filter((key) =>
      /per month|al mes|each month|cada mes/.test(english[key] + spanish[key]),
    );
    expect(priced.length).toBeGreaterThan(0);
    for (const key of priced) {
      expect(english[key]).toContain('{price}');
      expect(spanish[key]).toContain('{price}');
    }
  });

  it('confines free/trial wording to the keys used only on the confirmed-trial branch', () => {
    const TRIAL_ONLY = new Set([
      'subscription.trialDaysOne',
      'subscription.trialDaysMany',
      'subscription.trialWeeksOne',
      'subscription.trialWeeksMany',
      'subscription.trialMonthsOne',
      'subscription.trialMonthsMany',
      'subscription.trialYearsOne',
      'subscription.trialYearsMany',
      'subscription.startTrial',
      'subscription.startTrialAccessibility',
      'subscription.trialRenewalTerms',
    ]);
    const mentioning = FAMILY.filter((key) =>
      /free|trial|gratis|prueba/i.test(`${english[key]} ${spanish[key]}`),
    );
    expect(new Set(mentioning)).toEqual(TRIAL_ONLY);
  });

  it('never promises a medical or outcome guarantee', () => {
    for (const key of FAMILY) {
      expect(english[key]).not.toMatch(/guarantee|cure|treat|diagnos|lose \d|results in/i);
      expect(spanish[key]).not.toMatch(/garantiza|cura|tratamiento|diagn/i);
    }
  });
});
