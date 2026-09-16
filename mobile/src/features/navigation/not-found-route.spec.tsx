import { fireEvent, render, screen } from '@testing-library/react-native';

import { en } from '@/shared/localization/resources/en';
import { es } from '@/shared/localization/resources/es';
import NotFoundScreen from '../../app/+not-found';

let mockLanguage: 'en' | 'es' = 'en';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { replace: jest.fn() },
}));
jest.mock('@/shared/localization', () => {
  const { en: english } = jest.requireActual<typeof import('@/shared/localization/resources/en')>(
    '@/shared/localization/resources/en',
  );
  const { es: spanish } = jest.requireActual<typeof import('@/shared/localization/resources/es')>(
    '@/shared/localization/resources/es',
  );

  return {
    // Web-only document head; a no-op on the platform these tests render.
    DocumentHead: () => null,
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: keyof typeof english) => (mockLanguage === 'es' ? spanish : english)[key],
    }),
  };
});

/**
 * The product not-found screen (BUG-016 F-4, ADR-P032).
 *
 * Authoring `app/+not-found.tsx` is what takes Expo Router's built-in
 * `Unmatched` screen out of the product: it is not `__DEV__`-gated, so before
 * this file a mistyped or expired recovery link landed on `Unmatched Route`,
 * `Page could not be found.`, `Go back` and `Sitemap` — framework English in
 * both languages, with a development route enumeration attached.
 *
 * These tests assert the two things that can regress independently: that the
 * copy comes from the catalogues in **both** languages, and that neither the
 * framework copy nor the sitemap affordance can come back.
 */

/** Framework copy the built-in screen renders. None of it may appear here. */
const FRAMEWORK_COPY = ['Unmatched Route', 'Page could not be found.', 'Go back', 'Sitemap'];

describe('NotFoundScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'en';
  });

  it('renders the English product copy from the catalogue', async () => {
    await render(<NotFoundScreen />);

    expect(screen.getByText(en['notFound.title'])).toBeTruthy();
    expect(screen.getByText(en['notFound.body'])).toBeTruthy();
    expect(screen.getByRole('button', { name: en['notFound.action'] })).toBeTruthy();
  });

  it('renders the Spanish product copy from the catalogue', async () => {
    mockLanguage = 'es';
    await render(<NotFoundScreen />);

    expect(screen.getByText(es['notFound.title'])).toBeTruthy();
    expect(screen.getByText(es['notFound.body'])).toBeTruthy();
    expect(screen.getByRole('button', { name: es['notFound.action'] })).toBeTruthy();

    // The Spanish screen must not fall back to any English value.
    expect(screen.queryByText(en['notFound.title'])).toBeNull();
    expect(screen.queryByText(en['notFound.body'])).toBeNull();
  });

  it.each(['en', 'es'] as const)('renders no framework English in %s', async (language) => {
    mockLanguage = language;
    await render(<NotFoundScreen />);

    for (const copy of FRAMEWORK_COPY) {
      expect(screen.queryByText(copy)).toBeNull();
    }
  });

  it('offers no sitemap affordance', async () => {
    await render(<NotFoundScreen />);

    // `/_sitemap` enumerates every route, including the ones ADR-P019 keeps
    // dormant on Web. It is a development tool, not a product recovery path.
    expect(screen.queryByText('Sitemap')).toBeNull();
    expect(screen.queryByTestId('button-not-found-sitemap')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('sends the one action to the session-resolving entry route', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    await render(<NotFoundScreen />);

    fireEvent.press(screen.getByTestId('button-not-found-home'));

    // `/` redirects by session — dashboard when one exists, sign-in otherwise —
    // so one label stays correct on Web and native, signed in and signed out.
    expect(router.replace).toHaveBeenCalledWith('/');
  });
});
