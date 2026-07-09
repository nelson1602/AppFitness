import { render, screen } from '@testing-library/react-native';

import EvaluationHistoryRoute from '@/app/evaluation-history';

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

jest.mock('@/features/medical/presentation/EvaluationHistory', () => ({
  EvaluationHistory: () => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Evaluation history content</Text>;
  },
}));

describe('EvaluationHistoryRoute', () => {
  it('shows a skeleton while session restoration is pending', async () => {
    mockSessionStatus = 'unknown';
    await render(<EvaluationHistoryRoute />);
    expect(screen.getAllByLabelText('Loading dashboard section').length).toBeGreaterThan(0);
  });

  it('redirects anonymous users to sign in', async () => {
    mockSessionStatus = 'anonymous';
    await render(<EvaluationHistoryRoute />);
    expect(screen.getByText('Redirect: /sign-in')).toBeOnTheScreen();
  });

  it('renders the history for authenticated users', async () => {
    mockSessionStatus = 'authenticated';
    await render(<EvaluationHistoryRoute />);
    expect(screen.getByText('Evaluation history content')).toBeOnTheScreen();
  });
});
