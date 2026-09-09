import { render, screen } from '@testing-library/react-native';

import WellnessSafetyProfileRoute from '@/app/wellness-safety-profile';

/**
 * ADR-P017 **W-3** route guard. Mirrors the sibling route specs: the session
 * resolves before the screen mounts, an unauthenticated visitor is redirected
 * rather than shown a form no account could receive, and the native route
 * title is localized.
 */

let mockSessionStatus: 'unknown' | 'authenticated' | 'anonymous';
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
  useSession: () => ({ status: mockSessionStatus }),
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

jest.mock('@/features/wellness', () => ({
  WellnessSafetyProfileScreen: () => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Wellness safety profile content</Text>;
  },
}));

describe('WellnessSafetyProfileRoute', () => {
  beforeEach(() => {
    mockLanguage = 'en';
    mockStackTitle = undefined;
  });

  it('shows a skeleton while session restoration is pending', async () => {
    mockSessionStatus = 'unknown';
    await render(<WellnessSafetyProfileRoute />);

    expect(screen.getAllByLabelText('Loading content').length).toBeGreaterThan(0);
    expect(screen.queryByText('Wellness safety profile content')).toBeNull();
  });

  it('redirects anonymous users to sign in', async () => {
    mockSessionStatus = 'anonymous';
    await render(<WellnessSafetyProfileRoute />);

    expect(screen.getByText('Redirect: /sign-in')).toBeOnTheScreen();
    expect(screen.queryByText('Wellness safety profile content')).toBeNull();
  });

  it('renders the capture surface for authenticated users', async () => {
    mockSessionStatus = 'authenticated';
    await render(<WellnessSafetyProfileRoute />);

    expect(screen.getByText('Wellness safety profile content')).toBeOnTheScreen();
    expect(mockStackTitle).toBe('Evaluation and limitations');
  });

  it('localizes the native route title in Spanish', async () => {
    mockSessionStatus = 'authenticated';
    mockLanguage = 'es';

    await render(<WellnessSafetyProfileRoute />);

    expect(mockStackTitle).toBe('Evaluación y limitaciones');
  });
});
