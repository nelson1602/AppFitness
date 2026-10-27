import { render, screen } from '@testing-library/react-native';

import DashboardRoute from '@/app/(tabs)/dashboard';

let mockSessionStatus: 'unknown' | 'authenticated' | 'anonymous';
let mockEmailVerifiedAt: string | null = '2026-10-01T00:00:00.000Z';
let mockLanguage: 'en' | 'es' = 'en';
let mockStackTitle: string | undefined;

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Redirect: {href}</Text>;
  },
  Stack: {
    Screen: ({ options }: { options: { title: string } }) => {
      mockStackTitle = options.title;
      return null;
    },
  },
}));

jest.mock('@/features/authentication', () => ({
  useSession: () => ({
    status: mockSessionStatus,
    session:
      mockSessionStatus === 'authenticated'
        ? { user: { emailVerifiedAt: mockEmailVerifiedAt } }
        : null,
  }),
}));
jest.mock('@/shared/localization', () => {
  const { en } = jest.requireActual<typeof import('@/shared/localization/resources/en')>(
    '@/shared/localization/resources/en',
  );
  const { es } = jest.requireActual<typeof import('@/shared/localization/resources/es')>(
    '@/shared/localization/resources/es',
  );

  return {
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: keyof typeof en) => (mockLanguage === 'es' ? es : en)[key],
    }),
  };
});

jest.mock('@/features/dashboard', () => ({
  DashboardScreen: () => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Dashboard content</Text>;
  },
}));

let mockEvaluation: 'unknown' | 'checking' | 'owed' | 'done' = 'done';
jest.mock('@/features/evaluation/application/evaluation-gate.store', () => ({
  useEvaluationGate: (select: (state: { status: string }) => unknown) =>
    select({ status: mockEvaluation }),
}));

let mockWelcomePending = false;
jest.mock('@/features/shell/application/welcome-gate', () => ({
  useWelcomePending: () => mockWelcomePending,
}));

describe('DashboardRoute', () => {
  beforeEach(() => {
    mockLanguage = 'en';
    mockStackTitle = undefined;
    mockWelcomePending = false;
  });

  it('shows a skeleton while session restoration is pending', async () => {
    mockSessionStatus = 'unknown';

    await render(<DashboardRoute />);

    expect(screen.getAllByLabelText('Loading content')).toHaveLength(3);
  });

  it('redirects anonymous users to sign in', async () => {
    mockSessionStatus = 'anonymous';

    await render(<DashboardRoute />);

    expect(screen.getByText('Redirect: /sign-in')).toBeOnTheScreen();
  });

  it('renders the dashboard for authenticated users', async () => {
    mockSessionStatus = 'authenticated';

    await render(<DashboardRoute />);

    expect(screen.getByText('Dashboard content')).toBeOnTheScreen();
    expect(mockStackTitle).toBe('Dashboard');
  });

  // ADR-P039 D5: the welcome screen is owed once after a sign-in.
  it('sends an unverified account to the verification step before loading anything', async () => {
    mockSessionStatus = 'authenticated';
    mockEmailVerifiedAt = null;

    await render(<DashboardRoute />);

    expect(screen.getByText('Redirect: /verify-pending')).toBeOnTheScreen();
    mockEmailVerifiedAt = '2026-10-01T00:00:00.000Z';
  });

  it('sends a just-signed-in user to the welcome screen first', async () => {
    mockSessionStatus = 'authenticated';
    mockWelcomePending = true;

    await render(<DashboardRoute />);

    expect(screen.getByText('Redirect: /welcome')).toBeOnTheScreen();
    expect(screen.queryByText('Dashboard content')).toBeNull();
  });

  it('never sends an anonymous user to the welcome screen', async () => {
    mockSessionStatus = 'anonymous';
    mockWelcomePending = true;

    await render(<DashboardRoute />);

    expect(screen.getByText('Redirect: /sign-in')).toBeOnTheScreen();
  });

  it('skips the welcome screen on Web, where there is no device data (D2)', async () => {
    mockSessionStatus = 'authenticated';
    mockWelcomePending = true;
    const { Platform } = jest.requireActual<typeof import('react-native')>('react-native');
    const os = jest.replaceProperty(Platform, 'OS', 'web');

    await render(<DashboardRoute />);

    expect(screen.getByText('Dashboard content')).toBeOnTheScreen();
    os.restore();
  });

  it('localizes the native route title in Spanish', async () => {
    mockSessionStatus = 'authenticated';
    mockLanguage = 'es';

    await render(<DashboardRoute />);

    expect(mockStackTitle).toBe('Panel');
  });
});
