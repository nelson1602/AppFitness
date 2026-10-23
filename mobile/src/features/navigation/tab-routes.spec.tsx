import { render, screen } from '@testing-library/react-native';
import type { ComponentType } from 'react';

import ProfileRoute from '@/app/(tabs)/profile';
import WorkoutsRoute from '@/app/(tabs)/workouts';
import WelcomeRoute from '@/app/welcome';

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
      t: (key: keyof typeof en) => (mockLanguage === 'es' ? es[key] : en[key]),
    }),
  };
});
function mockContent(name: string) {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  function MockContent() {
    return <Text>{name} content</Text>;
  }
  return MockContent;
}
jest.mock('@/features/workout/presentation/WorkoutsTab', () => ({
  WorkoutsTab: mockContent('Workouts'),
}));
jest.mock('@/features/profile/presentation/ProfileTab', () => ({
  ProfileTab: mockContent('Profile'),
}));
jest.mock('@/features/shell/presentation/WelcomeScreen', () => ({
  WelcomeScreen: mockContent('Welcome'),
}));
jest.mock('@/features/subscriptions/presentation/SubscriptionWriteBoundary', () => ({
  SubscriptionWriteBoundary: ({ children }: { children: React.ReactNode }) => children,
}));

/** ADR-P039: the two new tabs and the welcome screen keep the shared session guard. */
describe.each([
  ['WorkoutsRoute', WorkoutsRoute, 'Workouts', 'Workouts', 'Entrenamientos'],
  ['ProfileRoute', ProfileRoute, 'Profile', 'Profile', 'Perfil'],
  ['WelcomeRoute', WelcomeRoute, 'Welcome', undefined, undefined],
] as const)('%s', (_name, Route: ComponentType, content, titleEn, titleEs) => {
  beforeEach(() => {
    mockLanguage = 'en';
    mockStackTitle = undefined;
  });

  it('shows a skeleton while session restoration is pending', async () => {
    mockSessionStatus = 'unknown';
    await render(<Route />);
    expect(screen.getAllByLabelText('Loading content').length).toBeGreaterThan(0);
  });

  it('redirects anonymous users to sign in', async () => {
    mockSessionStatus = 'anonymous';
    await render(<Route />);
    expect(screen.getByText('Redirect: /sign-in')).toBeOnTheScreen();
  });

  it('renders its content, titled in both languages, for authenticated users', async () => {
    mockSessionStatus = 'authenticated';
    await render(<Route />);
    expect(screen.getByText(`${content} content`)).toBeOnTheScreen();
    expect(mockStackTitle).toBe(titleEn);

    mockLanguage = 'es';
    await render(<Route />);
    expect(mockStackTitle).toBe(titleEs);
  });
});
