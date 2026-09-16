import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { en } from './resources/en';
import { es } from './resources/es';
// The Web platform file explicitly: this is the implementation that ships into
// the static export, regardless of the jest default platform.
import { DocumentHead, portalTitleKey } from './document-head.web';

let mockPathname = '/';
let mockLanguage: 'en' | 'es' = 'en';
let mockCapturedTitle: string | null = null;

jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
}));
jest.mock('expo-router/head', () => ({
  __esModule: true,
  // Stands in for Helmet: capture what would reach the document head.
  default: ({ children }: { children: ReactElement<{ children: string }> }) => {
    mockCapturedTitle = children.props.children;
    return null;
  },
}));
jest.mock('./use-localization', () => {
  const { en: english } = jest.requireActual<typeof import('./resources/en')>('./resources/en');
  const { es: spanish } = jest.requireActual<typeof import('./resources/es')>('./resources/es');

  return {
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: keyof typeof english) => (mockLanguage === 'es' ? spanish : english)[key],
    }),
  };
});

/**
 * The Web document head (BUG-016 F-5/F-6, ADR-P032).
 *
 * Two things ship from here and can regress independently: which title reaches
 * the document, and whether `lang` keeps following the language actually
 * rendered once hydration takes over from the shell's inline script.
 */

function documentDouble(): { documentElement: { lang: string } } {
  return { documentElement: { lang: 'en' } };
}

describe('portalTitleKey', () => {
  it('titles each shipped portal with the screen-title key it already renders', () => {
    // No new copy enters the product: these are the keys the native headers use.
    expect(portalTitleKey('/forgot-password')).toBe('auth.forgot.screenTitle');
    expect(portalTitleKey('/reset-password')).toBe('auth.reset.screenTitle');
    expect(portalTitleKey('/verify-email')).toBe('auth.verify.screenTitle');
  });

  it('claims no route outside the shipped Web portals', () => {
    // Everything else is a DB-backed surface that renders the ADR-P019
    // Web-unavailable state; it takes the product title, not a bespoke one.
    for (const route of ['/', '/dashboard', '/progress', '/sign-in', '/nothing-here']) {
      expect(portalTitleKey(route)).toBeUndefined();
    }
  });

  it('resolves both catalogues for every route it does claim', () => {
    for (const route of ['/forgot-password', '/reset-password', '/verify-email']) {
      const key = portalTitleKey(route);
      expect(key).toBeDefined();
      expect(en[key!].trim()).not.toBe('');
      expect(es[key!].trim()).not.toBe('');
    }
  });
});

describe('DocumentHead', () => {
  let originalDocument: PropertyDescriptor | undefined;

  beforeEach(() => {
    mockPathname = '/';
    mockLanguage = 'en';
    mockCapturedTitle = null;
    originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  });

  afterEach(() => {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete (globalThis as { document?: unknown }).document;
  });

  const setDocument = (value: unknown): void => {
    Object.defineProperty(globalThis, 'document', { value, configurable: true, writable: true });
  };

  it('gives every unclaimed route the product title', async () => {
    mockPathname = '/dashboard';
    setDocument(documentDouble());

    await render(<DocumentHead />);

    expect(mockCapturedTitle).toBe(en['web.document.title']);
    expect(mockCapturedTitle).not.toBe('');
  });

  it.each([
    ['/forgot-password', 'auth.forgot.screenTitle'],
    ['/reset-password', 'auth.reset.screenTitle'],
    ['/verify-email', 'auth.verify.screenTitle'],
  ] as const)('titles %s from the catalogue in both languages', async (route, key) => {
    setDocument(documentDouble());

    mockPathname = route;
    await render(<DocumentHead />);
    expect(mockCapturedTitle).toBe(en[key]);

    mockLanguage = 'es';
    await render(<DocumentHead />);
    expect(mockCapturedTitle).toBe(es[key]);
  });

  it('lets a screen supply its own title, which is how +not-found is titled', async () => {
    mockPathname = '/nothing-here';
    setDocument(documentDouble());

    await render(<DocumentHead title={es['notFound.title']} />);

    expect(mockCapturedTitle).toBe(es['notFound.title']);
  });

  it('retags the document with the language actually being rendered', async () => {
    const fake = documentDouble();
    setDocument(fake);

    mockLanguage = 'es';
    await render(<DocumentHead />);

    // The shell's inline script tags the document before the body renders;
    // from hydration onwards the live language owns it, so switching language
    // inside the portal retags the document with it.
    expect(fake.documentElement.lang).toBe('es');
  });

  it('never blocks rendering when there is no document — the prerender has none', async () => {
    setDocument(undefined);

    await expect(render(<DocumentHead />)).resolves.toBeDefined();
    expect(mockCapturedTitle).toBe(en['web.document.title']);
  });
});
