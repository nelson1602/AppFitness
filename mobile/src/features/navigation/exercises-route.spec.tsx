import { render, screen } from '@testing-library/react-native';

import ExercisesRoute from '@/app/exercises';

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
  ExerciseLibrary: () => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Exercise library content</Text>;
  },
}));

describe('ExercisesRoute', () => {
  it('shows a skeleton while session restoration is pending', async () => {
    mockSessionStatus = 'unknown';
    await render(<ExercisesRoute />);
    expect(screen.getAllByLabelText('Loading dashboard section').length).toBeGreaterThan(0);
  });

  it('redirects anonymous users to sign in', async () => {
    mockSessionStatus = 'anonymous';
    await render(<ExercisesRoute />);
    expect(screen.getByText('Redirect: /sign-in')).toBeOnTheScreen();
  });

  it('renders the exercise library for authenticated users', async () => {
    mockSessionStatus = 'authenticated';
    await render(<ExercisesRoute />);
    expect(screen.getByText('Exercise library content')).toBeOnTheScreen();
  });
});
