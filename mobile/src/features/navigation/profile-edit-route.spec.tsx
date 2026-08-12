import { fireEvent, render, screen } from '@testing-library/react-native';

import ProfileEditRoute from '@/app/profile-edit';

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
  router: { replace: jest.fn() },
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

// Render a stand-in that exposes the onSaved callback so we can assert the
// route navigates to the dashboard after a successful save.
jest.mock('@/features/profile/presentation/ProfileForm', () => ({
  ProfileForm: ({ onSaved }: { onSaved: () => void }) => {
    const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <Pressable accessibilityRole="button" onPress={onSaved}>
        <Text>Profile form</Text>
      </Pressable>
    );
  },
}));

describe('ProfileEditRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'en';
    mockStackTitle = undefined;
  });

  it('shows a skeleton while session restoration is pending', async () => {
    mockSessionStatus = 'unknown';

    await render(<ProfileEditRoute />);

    expect(screen.getAllByLabelText('Loading dashboard section').length).toBeGreaterThan(0);
  });

  it('redirects anonymous users to sign in', async () => {
    mockSessionStatus = 'anonymous';

    await render(<ProfileEditRoute />);

    expect(screen.getByText('Redirect: /sign-in')).toBeOnTheScreen();
  });

  it('renders the profile form for authenticated users', async () => {
    mockSessionStatus = 'authenticated';

    await render(<ProfileEditRoute />);

    expect(screen.getByText('Profile form')).toBeOnTheScreen();
    expect(mockStackTitle).toBe('Profile');
  });

  it('localizes the native route title in Spanish', async () => {
    mockSessionStatus = 'authenticated';
    mockLanguage = 'es';

    await render(<ProfileEditRoute />);

    expect(mockStackTitle).toBe('Perfil');
  });

  it('returns to the dashboard after a successful save', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    mockSessionStatus = 'authenticated';

    await render(<ProfileEditRoute />);
    fireEvent.press(screen.getByText('Profile form'));

    expect(router.replace).toHaveBeenCalledWith('/dashboard');
  });
});
