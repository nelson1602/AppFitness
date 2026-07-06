import { render, screen } from '@testing-library/react-native';

import DashboardRoute from '@/app/dashboard';

let mockSessionStatus: 'unknown' | 'authenticated' | 'anonymous';

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Redirect: {href}</Text>;
  },
  Stack: {
    Screen: () => null,
  },
}));

jest.mock('@/features/authentication', () => ({
  useSession: () => ({ status: mockSessionStatus }),
}));

jest.mock('@/features/dashboard', () => ({
  DashboardScreen: () => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Dashboard content</Text>;
  },
}));

describe('DashboardRoute', () => {
  it('shows a skeleton while session restoration is pending', async () => {
    mockSessionStatus = 'unknown';

    await render(<DashboardRoute />);

    expect(screen.getAllByLabelText('Loading dashboard section')).toHaveLength(3);
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
  });
});
