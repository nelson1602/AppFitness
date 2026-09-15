import { render, screen } from '@testing-library/react-native';

import SyncConflictsRoute from '@/app/sync-conflicts';

/**
 * The `/sync-conflicts` route itself — ADR-P030 **C-6**, verified by C-7.
 *
 * The screen's own arms are covered by `SyncConflictsScreen.spec.tsx`. What
 * only the route can decide is **who gets to see it at all**: the session
 * gate. A route that rendered the surface before the session resolved, or for
 * a signed-out visitor, would put one account's decisions in front of whoever
 * opened the app — so each arm is asserted here rather than left to the
 * device journey alone.
 *
 * This is the last uncovered file of the slice: `src/app/**` ships twelve
 * session-guarded routes and, before this spec, no route test at all.
 */

/**
 * Node built-ins used only by this Node/Jest test; the React Native tsconfig
 * ships no Node types, so the sliver used here is declared locally — the same
 * idiom as the database source guard.
 */
declare const __dirname: string;
declare function require(id: 'node:fs'): { readFileSync(file: string, encoding: 'utf8'): string };

let mockStatus: 'unknown' | 'authenticated' | 'unauthenticated' = 'unknown';

jest.mock('@/features/authentication', () => ({
  useSession: () => ({ status: mockStatus, session: null }),
}));

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    // A redirect renders nothing of its own; the destination is the assertion.
    Redirect: ({ href }: { href: string }) =>
      React.createElement(RN.Text, { testID: 'redirect' }, href),
    Stack: {
      Screen: ({ options }: { options: { title: string } }) =>
        React.createElement(RN.Text, { testID: 'route-title' }, options.title),
    },
  };
});

jest.mock('@/shared/localization', () => {
  const { en } = jest.requireActual('@/shared/localization/resources/en') as {
    en: Record<string, string>;
  };
  return { useLocalization: () => ({ language: 'en', t: (key: string) => en[key] ?? key }) };
});

jest.mock('@/features/sync-conflicts', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    SyncConflictsScreen: () =>
      React.createElement(RN.Text, { testID: 'review-surface' }, 'surface'),
  };
});

jest.mock('@/features/dashboard/presentation/components/dashboard-skeleton', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return { DashboardSkeleton: () => React.createElement(RN.View, { testID: 'session-skeleton' }) };
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('the session gate', () => {
  it('waits while the session is still resolving, showing no surface', async () => {
    mockStatus = 'unknown';

    await render(<SyncConflictsRoute />);

    expect(screen.getByTestId('session-skeleton')).toBeOnTheScreen();
    expect(screen.queryByTestId('review-surface')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('redirect')).not.toBeOnTheScreen();
  });

  it('sends a signed-out visitor to the auth surface instead of the review', async () => {
    mockStatus = 'unauthenticated';

    await render(<SyncConflictsRoute />);

    expect(screen.getByTestId('redirect')).toHaveTextContent('/sign-in');
    expect(screen.queryByTestId('review-surface')).not.toBeOnTheScreen();
  });

  it('renders the review surface for an authenticated visitor, under its own title', async () => {
    mockStatus = 'authenticated';

    await render(<SyncConflictsRoute />);

    expect(screen.getByTestId('review-surface')).toBeOnTheScreen();
    expect(screen.getByTestId('route-title')).toHaveTextContent('Changes to review');
    expect(screen.queryByTestId('redirect')).not.toBeOnTheScreen();
  });
});

describe('the route stays platform-neutral', () => {
  it('leaves the Web decision to the screen, not to a platform check here', () => {
    const source = require('node:fs').readFileSync(
      `${__dirname}/../../app/sync-conflicts.tsx`,
      'utf8',
    );

    // ADR-P019's terminal arm is driven by a store status, so this file builds
    // identically for native and Web. Importing the platform module here would
    // split the two builds apart. The assertion is on the import rather than
    // the word, because the route's own prose names the check it avoids.
    expect(source).not.toMatch(/^import[^\n]*\bPlatform\b[^\n]*'react-native'/m);
    expect(source).not.toMatch(/Platform\.OS\s*===/);
  });
});
