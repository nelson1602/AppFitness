import { render, screen } from '@testing-library/react-native';

import RestrictionsRoute from '@/app/restrictions';

let mockSessionStatus: 'unknown' | 'authenticated' | 'anonymous';

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Redirect: {href}</Text>;
  },
  Stack: { Screen: () => null },
}));

jest.mock('@/features/authentication', () => ({
  useSession: () => ({ status: mockSessionStatus }),
}));

jest.mock('@/features/medical/presentation/Restrictions', () => ({
  Restrictions: () => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Restrictions content</Text>;
  },
}));

describe('RestrictionsRoute', () => {
  it('shows a skeleton while session restoration is pending', async () => {
    mockSessionStatus = 'unknown';
    await render(<RestrictionsRoute />);
    expect(screen.getAllByLabelText('Loading dashboard section').length).toBeGreaterThan(0);
  });

  it('redirects anonymous users to sign in', async () => {
    mockSessionStatus = 'anonymous';
    await render(<RestrictionsRoute />);
    expect(screen.getByText('Redirect: /sign-in')).toBeOnTheScreen();
  });

  it('renders restrictions management for authenticated users', async () => {
    mockSessionStatus = 'authenticated';
    await render(<RestrictionsRoute />);
    expect(screen.getByText('Restrictions content')).toBeOnTheScreen();
  });
});
