import { render, screen } from '@testing-library/react-native';

import HomeRoute from '@/app';

let mockSessionStatus: 'unknown' | 'authenticated' | 'anonymous';
let mockEmailVerifiedAt: string | null = '2026-10-01T00:00:00.000Z';

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Redirect: {href}</Text>;
  },
}));

jest.mock('@/features/authentication', () => ({
  useSession: () => ({
    status: mockSessionStatus,
    session:
      mockSessionStatus === 'authenticated'
        ? { user: { emailVerifiedAt: mockEmailVerifiedAt } }
        : null,
  }),
}));

describe('HomeRoute', () => {
  it('shows a loading skeleton while session restoration is pending', async () => {
    mockSessionStatus = 'unknown';

    await render(<HomeRoute />);

    expect(screen.getAllByLabelText('Loading content')).toHaveLength(3);
  });

  it('redirects authenticated users to the dashboard', async () => {
    mockSessionStatus = 'authenticated';

    await render(<HomeRoute />);

    expect(screen.getByText('Redirect: /dashboard')).toBeOnTheScreen();
  });

  it('sends an unverified account to the verification step (ADR-P041)', async () => {
    mockSessionStatus = 'authenticated';
    mockEmailVerifiedAt = null;

    await render(<HomeRoute />);

    expect(screen.getByText('Redirect: /verify-pending')).toBeOnTheScreen();
    mockEmailVerifiedAt = '2026-10-01T00:00:00.000Z';
  });

  it('redirects anonymous users to sign in', async () => {
    mockSessionStatus = 'anonymous';

    await render(<HomeRoute />);

    expect(screen.getByText('Redirect: /sign-in')).toBeOnTheScreen();
  });
});
