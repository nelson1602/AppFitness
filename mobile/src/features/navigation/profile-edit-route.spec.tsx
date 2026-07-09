import { fireEvent, render, screen } from '@testing-library/react-native';

import ProfileEditRoute from '@/app/profile-edit';

let mockSessionStatus: 'unknown' | 'authenticated' | 'anonymous';

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Redirect: {href}</Text>;
  },
  Stack: {
    Screen: () => null,
  },
  router: { replace: jest.fn() },
}));

jest.mock('@/features/authentication', () => ({
  useSession: () => ({ status: mockSessionStatus }),
}));

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
  });

  it('returns to the dashboard after a successful save', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    mockSessionStatus = 'authenticated';

    await render(<ProfileEditRoute />);
    fireEvent.press(screen.getByText('Profile form'));

    expect(router.replace).toHaveBeenCalledWith('/dashboard');
  });
});
