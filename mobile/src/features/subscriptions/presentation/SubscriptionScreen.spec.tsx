import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { darkTheme, lightTheme } from '@/shared/theme';

import type { SubscriptionState } from '../application/subscription.store';
import type {
  PurchaseAccessSnapshot,
  SubscriptionOffer,
  SubscriptionOfferHandle,
} from '../domain/purchases.port';
import { SubscriptionScreen } from './SubscriptionScreen';

/**
 * ADR-P034 **S-3** subscription surface. Covers every store state the screen
 * can render, the conditional trial, verbatim store pricing, the one dominant
 * action, EN/ES and light/dark, the 48 dp floor, wrap-safe structure, and the
 * guarantee that no provider text or internal identifier is ever rendered.
 */

const load = jest.fn();
const purchase = jest.fn();
const restore = jest.fn();
const manage = jest.fn();
const reset = jest.fn();

let mockState: SubscriptionState;
let mockLanguage: 'en' | 'es' = 'en';
let mockDark = false;

jest.mock('../subscription-store', () => ({
  useSubscriptionStore: <T,>(selector: (state: SubscriptionState) => T): T => selector(mockState),
}));
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(() => effect(), [effect]);
    },
  };
});
jest.mock('@/shared/localization', () => {
  const actual = jest.requireActual<typeof import('@/shared/localization/format')>(
    '@/shared/localization/format',
  );
  const { en } = jest.requireActual('@/shared/localization/resources/en') as {
    en: Record<string, string>;
  };
  const { es } = jest.requireActual('@/shared/localization/resources/es') as {
    es: Record<string, string>;
  };
  return {
    ...actual,
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: string) => (mockLanguage === 'es' ? es[key] : en[key]) ?? key,
    }),
  };
});
jest.mock('@/shared/theme', () => {
  const actual = jest.requireActual<typeof import('@/shared/theme')>('@/shared/theme');
  return { ...actual, useTheme: () => (mockDark ? actual.darkTheme : actual.lightTheme) };
});

const PRICE = 'RD$ 295.00';
const inactive: PurchaseAccessSnapshot = {
  isActive: false,
  expiresAt: null,
  productId: null,
  willRenew: false,
};
const active: PurchaseAccessSnapshot = {
  isActive: true,
  expiresAt: '2026-11-30T12:00:00.000Z',
  productId: 'store_product_monthly',
  willRenew: true,
};
const paidOffer: SubscriptionOffer = {
  handle: 'offer-7' as SubscriptionOfferHandle,
  productId: 'store_product_monthly',
  price: PRICE,
  billingPeriod: { unit: 'month', count: 1 },
  freeTrial: null,
};
const trialOffer: SubscriptionOffer = { ...paidOffer, freeTrial: { unit: 'month', count: 1 } };

function setStore(partial: Partial<SubscriptionState> = {}) {
  mockState = {
    status: 'ready',
    storeKind: 'apple',
    access: inactive,
    offer: paidOffer,
    operation: null,
    notice: null,
    issue: null,
    purchasePending: false,
    load,
    purchase,
    restore,
    manage,
    reset,
    ...partial,
  };
}

function flat(node: { props: { style?: StyleProp<ViewStyle> } }): ViewStyle {
  return StyleSheet.flatten(node.props.style) ?? {};
}

function colorOf(node: { props: { style?: StyleProp<TextStyle> } }): TextStyle['color'] {
  return StyleSheet.flatten(node.props.style)?.color;
}

interface JsonNode {
  readonly props: Record<string, unknown>;
  readonly children: (JsonNode | string)[] | null;
}

/** Every host node of the rendered tree, depth first. */
function hostNodes(): JsonNode[] {
  const out: JsonNode[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const node = value as JsonNode;
    out.push(node);
    (node.children ?? []).forEach(visit);
  };
  visit(screen.toJSON());
  return out;
}

/** Every rendered string, so absence assertions cover the whole surface. */
function allText(): string {
  return hostNodes()
    .flatMap((node) => (node.children ?? []).filter((child) => typeof child === 'string'))
    .join('\n');
}

function allLabels(): string {
  return hostNodes()
    .map((node) => node.props.accessibilityLabel)
    .filter((label): label is string => typeof label === 'string')
    .join('\n');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = 'en';
  mockDark = false;
  setStore();
});

describe('SubscriptionScreen', () => {
  it('loads on focus', async () => {
    await render(<SubscriptionScreen />);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('announces a busy, localized loading state and never an empty one', async () => {
    setStore({ status: 'loading', offer: null, access: null });
    await render(<SubscriptionScreen />);

    const loading = screen.getByTestId('subscription-loading');
    expect(loading.props.accessibilityLabel).toBe('Loading subscription');
    expect(loading.props.accessibilityState).toEqual({ busy: true });
    expect(screen.queryByText('No subscription option is available right now')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  describe('offer', () => {
    it('shows ordinary paid terms with the store price verbatim when no trial is confirmed', async () => {
      await render(<SubscriptionScreen />);

      expect(screen.getByTestId('subscription-offer-headline')).toHaveTextContent(
        `${PRICE} per month`,
      );
      expect(
        screen.getByRole('button', { name: `Subscribe to AppFitness Pro for ${PRICE} per month` }),
      ).toBeTruthy();
      expect(screen.getByText('Subscribe')).toBeTruthy();
      expect(screen.getByTestId('subscription-renewal-terms')).toHaveTextContent(
        `Renews automatically each month at ${PRICE} until you cancel. Cancel at least 24 hours before the renewal date to avoid the next charge.`,
      );
      expect(allText()).not.toMatch(/free|trial/i);
      expect(allLabels()).not.toMatch(/free|trial/i);
    });

    it('presents the trial only when the offer carries a confirmed free trial', async () => {
      setStore({ offer: trialOffer });
      await render(<SubscriptionScreen />);

      expect(screen.getByTestId('subscription-offer-headline')).toHaveTextContent('1 month free');
      expect(screen.getByTestId('subscription-offer-price')).toHaveTextContent(
        `Then ${PRICE} per month`,
      );
      expect(screen.getByText('Start free trial')).toBeTruthy();
      expect(
        screen.getByRole('button', {
          name: `Start the AppFitness Pro free trial, then ${PRICE} per month`,
        }),
      ).toBeTruthy();
      expect(screen.getByTestId('subscription-renewal-terms')).toHaveTextContent(
        /When the free trial ends, it renews automatically each month at RD\$ 295\.00/,
      );
    });

    it('uses the plural phrase for a multi-unit trial', async () => {
      setStore({ offer: { ...paidOffer, freeTrial: { unit: 'week', count: 2 } } });
      await render(<SubscriptionScreen />);

      expect(screen.getByTestId('subscription-offer-headline')).toHaveTextContent('2 weeks free');
    });

    it('renders an unusual store price string exactly as given', async () => {
      const price = '1.234,50 €';
      setStore({ offer: { ...paidOffer, price } });
      await render(<SubscriptionScreen />);

      expect(screen.getByTestId('subscription-offer-headline')).toHaveTextContent(
        `${price} per month`,
      );
    });

    it('names the store the charge is made to', async () => {
      await render(<SubscriptionScreen />);
      expect(screen.getByText(/charged to your Apple Account/)).toBeTruthy();

      setStore({ storeKind: 'google' });
      await render(<SubscriptionScreen />);
      expect(screen.getByText(/charged to your Google Play account/)).toBeTruthy();
    });

    it('has exactly one filled primary action, ahead of restore in focus order', async () => {
      await render(<SubscriptionScreen />);

      const buttons = screen.getAllByRole('button');
      const filled = buttons.filter(
        (button) => flat(button).backgroundColor === lightTheme.colors.primary,
      );
      expect(filled).toHaveLength(1);
      expect(buttons.map((button) => button.props.testID)).toEqual([
        'subscription-purchase',
        'subscription-restore',
      ]);
    });

    it('purchases and restores on press', async () => {
      await render(<SubscriptionScreen />);

      await fireEvent.press(screen.getByTestId('subscription-purchase'));
      await fireEvent.press(screen.getByTestId('subscription-restore'));

      expect(purchase).toHaveBeenCalledTimes(1);
      expect(restore).toHaveBeenCalledTimes(1);
    });

    it('marks the purchase busy and blocks restore while purchasing', async () => {
      setStore({ operation: 'purchasing' });
      await render(<SubscriptionScreen />);

      expect(screen.getByTestId('subscription-purchase').props.accessibilityState).toMatchObject({
        busy: true,
        disabled: true,
      });
      expect(screen.getByTestId('subscription-restore').props.accessibilityState).toMatchObject({
        disabled: true,
      });
    });

    it('never renders an internal identifier', async () => {
      await render(<SubscriptionScreen />);

      const surface = `${allText()}\n${allLabels()}`;
      expect(surface).not.toContain('store_product_monthly');
      expect(surface).not.toContain('offer-7');
    });
  });

  describe('store returned no offer — a recoverable Error, never Empty', () => {
    it('renders the no-offer copy with error tone and the error announcement request', async () => {
      setStore({ offer: null });
      await render(<SubscriptionScreen />);

      const title = screen.getByText('No subscription option is available right now');
      expect(colorOf(title)).toBe(lightTheme.colors.error);
      expect(colorOf(title)).not.toBe(lightTheme.colors.primary);
      const announced = hostNodes().filter((node) => node.props['aria-live'] === 'polite');
      expect(announced).toHaveLength(1);
      expect(announced[0]?.props.accessibilityRole).toBe('summary');
      expect(flat(announced[0] as { props: { style?: StyleProp<ViewStyle> } }).borderColor).toBe(
        lightTheme.colors.error,
      );
    });

    it('offers exactly one retry, which calls load once per press', async () => {
      setStore({ offer: null });
      await render(<SubscriptionScreen />);
      const loadsOnFocus = load.mock.calls.length;

      expect(screen.getAllByTestId('subscription-retry')).toHaveLength(1);
      await fireEvent.press(screen.getByTestId('subscription-retry'));

      expect(load).toHaveBeenCalledTimes(loadsOnFocus + 1);
    });

    it('is never rendered as Empty: no offer, no creation action, no empty treatment', async () => {
      setStore({ offer: null });
      await render(<SubscriptionScreen />);

      expect(screen.queryByTestId('state-empty')).toBeNull();
      expect(screen.queryByTestId('subscription-offer')).toBeNull();
      expect(screen.queryByTestId('subscription-purchase')).toBeNull();
      const actions = screen.getAllByRole('button').map((button) => button.props.testID);
      expect(actions).toEqual(['subscription-retry', 'subscription-restore']);
    });
  });

  describe('active', () => {
    it('shows status text, renewal date and management, without any offer', async () => {
      setStore({ access: active, offer: null });
      await render(<SubscriptionScreen />);

      expect(screen.getByText('AppFitness Pro is active')).toBeTruthy();
      expect(screen.getByText('Renews on November 30, 2026')).toBeTruthy();
      expect(screen.queryByTestId('subscription-purchase')).toBeNull();
      expect(screen.queryByText(/per month/)).toBeNull();
      await fireEvent.press(screen.getByTestId('subscription-manage'));
      expect(manage).toHaveBeenCalledTimes(1);
    });

    it('says access continues without renewal when auto-renew is off', async () => {
      setStore({ access: { ...active, willRenew: false }, offer: null });
      await render(<SubscriptionScreen />);

      expect(
        screen.getByText("Access continues until November 30, 2026. It won't renew."),
      ).toBeTruthy();
    });

    it('never guesses a date it does not have', async () => {
      setStore({ access: { ...active, expiresAt: null }, offer: null });
      await render(<SubscriptionScreen />);

      expect(screen.getByText('Your subscription is active on this account.')).toBeTruthy();
    });
  });

  describe('outcomes', () => {
    it.each([
      ['purchased', 'Welcome to AppFitness Pro'],
      ['restored', 'Purchases restored'],
      ['nothingToRestore', 'No active subscription found'],
    ] as const)('renders the %s notice', async (notice, title) => {
      setStore({
        notice,
        ...(notice === 'purchased' || notice === 'restored' ? { access: active, offer: null } : {}),
      });
      await render(<SubscriptionScreen />);

      expect(screen.getByText(title)).toBeTruthy();
    });

    it('keeps a pending purchase visibly not active', async () => {
      setStore({ purchasePending: true });
      await render(<SubscriptionScreen />);

      expect(screen.getByText('Purchase pending')).toBeTruthy();
      expect(screen.queryByTestId('subscription-active')).toBeNull();
      expect(screen.getByTestId('subscription-offer')).toBeTruthy();
    });

    it('blocks a second purchase while pending but keeps restore available', async () => {
      setStore({ purchasePending: true, notice: 'nothingToRestore' });
      await render(<SubscriptionScreen />);

      const buy = screen.getByTestId('subscription-purchase');
      expect(buy.props.accessibilityState).toMatchObject({ disabled: true });
      await fireEvent.press(buy);
      expect(purchase).not.toHaveBeenCalled();

      const restoreButton = screen.getByTestId('subscription-restore');
      expect(restoreButton.props.accessibilityState).toMatchObject({ disabled: false });
      await fireEvent.press(restoreButton);
      expect(restore).toHaveBeenCalledTimes(1);
      // The pending banner outlives the later restore notice.
      expect(screen.getByText('Purchase pending')).toBeTruthy();
    });

    it('re-enables purchase once nothing is pending', async () => {
      await render(<SubscriptionScreen />);

      expect(screen.getByTestId('subscription-purchase').props.accessibilityState).toMatchObject({
        disabled: false,
      });
      expect(screen.queryByText('Purchase pending')).toBeNull();
    });

    it('drops the pending banner once the entitlement is confirmed active', async () => {
      setStore({ purchasePending: true, access: active, offer: null });
      await render(<SubscriptionScreen />);

      expect(screen.queryByText('Purchase pending')).toBeNull();
      expect(screen.getByTestId('subscription-active')).toBeTruthy();
    });

    it('shows nothing for a cancelled purchase', async () => {
      await render(<SubscriptionScreen />);

      expect(screen.queryByRole('summary')).toBeNull();
    });

    it.each([
      ['network', 'No connection'],
      ['purchaseFailed', "The purchase didn't go through"],
      ['purchaseNotAllowed', "Purchases aren't allowed"],
      ['restoreFailed', "We couldn't restore purchases"],
      ['manageFailed', "We couldn't open subscription settings"],
      ['sessionChanged', 'Please try again'],
    ] as const)('maps the %s issue to catalogue copy', async (issue, title) => {
      setStore({ issue });
      await render(<SubscriptionScreen />);

      expect(screen.getByText(title)).toBeTruthy();
    });

    it('uses the error tone only for real failures', async () => {
      setStore({ issue: 'sessionChanged' });
      await render(<SubscriptionScreen />);
      const neutral = screen.getByText('Please try again');
      expect(colorOf(neutral)).toBe(lightTheme.colors.primary);

      setStore({ issue: 'purchaseFailed' });
      await render(<SubscriptionScreen />);
      expect(colorOf(screen.getByText("The purchase didn't go through"))).toBe(
        lightTheme.colors.error,
      );
    });
  });

  describe('surface states', () => {
    it('renders Offline as a warning with a retry, not as an error', async () => {
      setStore({ status: 'offline', offer: null, access: null });
      await render(<SubscriptionScreen />);

      expect(colorOf(screen.getByText("You're offline"))).toBe(lightTheme.colors.warning);
      await fireEvent.press(screen.getByTestId('subscription-retry'));
      expect(load).toHaveBeenCalledTimes(2);
    });

    it('renders Error with a retry and no raw detail', async () => {
      setStore({ status: 'error', offer: null, access: null });
      await render(<SubscriptionScreen />);

      expect(screen.getByText("We couldn't load your subscription")).toBeTruthy();
      expect(screen.getByTestId('subscription-retry')).toBeTruthy();
    });

    it('renders a mid-load session change as a neutral retry', async () => {
      setStore({ status: 'error', issue: 'sessionChanged', offer: null, access: null });
      await render(<SubscriptionScreen />);

      expect(screen.getByText('Please try again')).toBeTruthy();
      expect(screen.queryByText("We couldn't load your subscription")).toBeNull();
    });

    it.each([
      ['web-unavailable', "Subscriptions aren't available on the web"],
      ['unavailable', "Subscriptions aren't available in this version"],
    ] as const)('renders %s with no action of any kind', async (status, title) => {
      setStore({ status, offer: null, access: null });
      await render(<SubscriptionScreen />);

      expect(screen.getByText(title)).toBeTruthy();
      expect(screen.queryAllByRole('button')).toHaveLength(0);
      expect(screen.queryByTestId('subscription-retry')).toBeNull();
      expect(allText()).not.toMatch(/per month/);
    });
  });

  describe('bilingual, theme and large-text structure', () => {
    it('renders the offer entirely in Spanish', async () => {
      mockLanguage = 'es';
      setStore({ offer: trialOffer });
      await render(<SubscriptionScreen />);

      expect(screen.getByTestId('subscription-offer-headline')).toHaveTextContent('1 mes gratis');
      expect(screen.getByTestId('subscription-offer-price')).toHaveTextContent(
        `Después, ${PRICE} al mes`,
      );
      expect(screen.getByText('Comenzar prueba gratis')).toBeTruthy();
      expect(screen.getByText('Restaurar compras')).toBeTruthy();
      expect(allText()).not.toMatch(/\b(Subscribe|Restore purchases|per month|free trial)\b/);
    });

    it('renders active status in Spanish', async () => {
      mockLanguage = 'es';
      setStore({ access: active, offer: null });
      await render(<SubscriptionScreen />);

      expect(screen.getByText('AppFitness Pro está activo')).toBeTruthy();
      expect(screen.getByText('Se renueva el 30 de noviembre de 2026')).toBeTruthy();
      expect(screen.getByText('Administrar suscripción')).toBeTruthy();
    });

    it('draws the primary action from the dark theme tokens', async () => {
      mockDark = true;
      await render(<SubscriptionScreen />);

      expect(flat(screen.getByTestId('subscription-purchase')).backgroundColor).toBe(
        darkTheme.colors.primary,
      );
    });

    it('gives every action at least a 48 dp target', async () => {
      setStore({ issue: 'purchaseFailed' });
      await render(<SubscriptionScreen />);
      const withOffer = screen.getAllByRole('button');

      setStore({ access: active, offer: null });
      await render(<SubscriptionScreen />);
      const withActive = screen.getAllByRole('button');

      for (const button of [...withOffer, ...withActive]) {
        expect(flat(button).minHeight).toBeGreaterThanOrEqual(48);
      }
    });

    it('never truncates text or lays actions out in a clipping row', async () => {
      setStore({ offer: trialOffer, purchasePending: true, issue: 'network' });
      await render(<SubscriptionScreen />);

      const truncated = hostNodes().filter(
        (node) => node.props.numberOfLines !== undefined || node.props.ellipsizeMode !== undefined,
      );
      expect(truncated).toHaveLength(0);
      const rows = hostNodes().filter(
        (node) => flat(node as { props: { style?: StyleProp<ViewStyle> } }).flexDirection === 'row',
      );
      expect(rows).toHaveLength(0);
    });
  });
});
