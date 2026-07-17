import { render, screen } from '@testing-library/react-native';

import RoutinesRoute from '@/app/routines';

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

jest.mock('@/features/workout', () => ({
  RoutineBuilder: () => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Routine builder content</Text>;
  },
}));

describe('RoutinesRoute', () => {
  it('shows a skeleton while session restoration is pending', async () => {
    mockSessionStatus = 'unknown';
    await render(<RoutinesRoute />);
    expect(screen.getAllByLabelText('Loading dashboard section').length).toBeGreaterThan(0);
  });

  it('redirects anonymous users to sign in', async () => {
    mockSessionStatus = 'anonymous';
    await render(<RoutinesRoute />);
    expect(screen.getByText('Redirect: /sign-in')).toBeOnTheScreen();
  });

  it('renders the routine builder for authenticated users', async () => {
    mockSessionStatus = 'authenticated';
    await render(<RoutinesRoute />);
    expect(screen.getByText('Routine builder content')).toBeOnTheScreen();
  });
});
