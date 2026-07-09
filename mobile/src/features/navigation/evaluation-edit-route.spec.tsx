import { fireEvent, render, screen } from '@testing-library/react-native';

import EvaluationEditRoute from '@/app/evaluation-edit';

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

// Render a stand-in that exposes onSaved so we can assert the route
// navigates to the dashboard after a successful save.
jest.mock('@/features/medical/presentation/EvaluationForm', () => ({
  EvaluationForm: ({ onSaved }: { onSaved: () => void }) => {
    const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <Pressable accessibilityRole="button" onPress={onSaved}>
        <Text>Evaluation form</Text>
      </Pressable>
    );
  },
}));

describe('EvaluationEditRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a skeleton while session restoration is pending', async () => {
    mockSessionStatus = 'unknown';

    await render(<EvaluationEditRoute />);

    expect(screen.getAllByLabelText('Loading dashboard section').length).toBeGreaterThan(0);
  });

  it('redirects anonymous users to sign in', async () => {
    mockSessionStatus = 'anonymous';

    await render(<EvaluationEditRoute />);

    expect(screen.getByText('Redirect: /sign-in')).toBeOnTheScreen();
  });

  it('renders the evaluation form for authenticated users', async () => {
    mockSessionStatus = 'authenticated';

    await render(<EvaluationEditRoute />);

    expect(screen.getByText('Evaluation form')).toBeOnTheScreen();
  });

  it('returns to the dashboard after a successful save', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    mockSessionStatus = 'authenticated';

    await render(<EvaluationEditRoute />);
    await fireEvent.press(screen.getByText('Evaluation form'));

    expect(router.replace).toHaveBeenCalledWith('/dashboard');
  });
});
