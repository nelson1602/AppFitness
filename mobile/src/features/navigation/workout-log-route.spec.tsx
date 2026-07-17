import { render, screen } from '@testing-library/react-native';

import WorkoutLogRoute from '@/app/workout-log';

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
  WorkoutLogScreen: () => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Workout log content</Text>;
  },
}));

describe('WorkoutLogRoute', () => {
  it('shows a skeleton while session restoration is pending', async () => {
    mockSessionStatus = 'unknown';
    await render(<WorkoutLogRoute />);
    expect(screen.getAllByLabelText('Loading dashboard section').length).toBeGreaterThan(0);
  });

  it('redirects anonymous users to sign in', async () => {
    mockSessionStatus = 'anonymous';
    await render(<WorkoutLogRoute />);
    expect(screen.getByText('Redirect: /sign-in')).toBeOnTheScreen();
  });

  it('renders the workout log screen for authenticated users', async () => {
    mockSessionStatus = 'authenticated';
    await render(<WorkoutLogRoute />);
    expect(screen.getByText('Workout log content')).toBeOnTheScreen();
  });
});
