import { render, screen } from '@testing-library/react-native';

import HomeRoute from '@/app';

let mockSessionStatus: 'unknown' | 'authenticated' | 'anonymous';

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Redirect: {href}</Text>;
  },
}));

jest.mock('@/features/authentication', () => ({
  useSession: () => ({ status: mockSessionStatus }),
}));

describe('HomeRoute', () => {
  it('shows a loading skeleton while session restoration is pending', async () => {
    mockSessionStatus = 'unknown';

    await render(<HomeRoute />);

    expect(screen.getAllByLabelText('Loading dashboard section')).toHaveLength(3);
  });

  it('redirects authenticated users to the dashboard', async () => {
    mockSessionStatus = 'authenticated';

    await render(<HomeRoute />);

    expect(screen.getByText('Redirect: /dashboard')).toBeOnTheScreen();
  });

  it('redirects anonymous users to sign in', async () => {
    mockSessionStatus = 'anonymous';

    await render(<HomeRoute />);

    expect(screen.getByText('Redirect: /sign-in')).toBeOnTheScreen();
  });
});
