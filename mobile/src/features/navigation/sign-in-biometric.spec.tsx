import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import SignInScreen from '@/app/sign-in';

const mockReplace = jest.fn();
const mockSignIn = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: (href: string) => mockReplace(href), push: jest.fn() },
  Stack: { Screen: () => null },
}));

jest.mock('@/features/authentication', () => {
  // Plain field assignment: a TS parameter property trips babel-jest-hoist.
  class MockAuthError extends Error {
    reason: string;
    constructor(reason: string) {
      super(reason);
      this.reason = reason;
    }
  }
  return {
    AuthError: MockAuthError,
    signIn: (...args: unknown[]) => mockSignIn(...args),
    signUp: jest.fn(),
    useSession: () => ({ status: mockSessionStatus, session: null }),
    useBiometricCapability: () => mockCapability,
    unlockWithBiometrics: (...args: unknown[]) => mockUnlock(...args),
    BiometricLinkSheet: ({ onDone }: { onDone: () => void }) => {
      const { Pressable, Text } = jest.requireActual('react-native');
      return (
        <Pressable accessibilityRole="button" onPress={onDone} testID="mock-link-sheet">
          <Text>link sheet</Text>
        </Pressable>
      );
    },
  };
});

let mockSessionStatus: 'unauthenticated' | 'locked' = 'unauthenticated';
let mockCapability: { available: boolean; kind: 'face' | 'fingerprint' } | null = null;
const mockUnlock = jest.fn();

// ADR-P036 (Amendment A) on the sign-in screen.
describe('SignInScreen biometric sign-in', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionStatus = 'unauthenticated';
    mockCapability = null;
    mockSignIn.mockResolvedValue({ status: 'authenticated', session: {} });
  });

  it('shows the hint, with the owner sentence, only while biometrics are not linked', async () => {
    mockCapability = { available: true, kind: 'fingerprint' };
    await render(<SignInScreen />);

    expect(
      screen.getByText('You can turn on Face ID or fingerprint when you sign in.'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('button-biometric-unlock')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Create an account' }));
    expect(screen.queryByTestId('biometric-hint')).toBeNull();
  });

  it('shows no biometric hint or button where biometrics are unavailable', async () => {
    mockCapability = { available: false, kind: 'fingerprint' };
    mockSessionStatus = 'locked';
    await render(<SignInScreen />);

    expect(screen.queryByTestId('biometric-hint')).toBeNull();
    expect(screen.queryByTestId('button-biometric-unlock')).toBeNull();
  });

  it.each([
    ['face', 'Sign in with Face ID'],
    ['fingerprint', 'Sign in with fingerprint'],
  ] as const)('offers the %s unlock on a locked device', async (kind, name) => {
    mockCapability = { available: true, kind };
    mockSessionStatus = 'locked';
    await render(<SignInScreen />);

    expect(screen.getByRole('button', { name })).toBeOnTheScreen();
    expect(screen.queryByTestId('biometric-hint')).toBeNull();
    // Password sign-in stays available while locked.
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
  });

  it('goes to the dashboard after a successful unlock', async () => {
    mockCapability = { available: true, kind: 'fingerprint' };
    mockSessionStatus = 'locked';
    mockUnlock.mockResolvedValue('unlocked');
    await render(<SignInScreen />);

    await fireEvent.press(screen.getByTestId('button-biometric-unlock'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/dashboard'));
    expect(mockUnlock).toHaveBeenCalledWith('Unlock AppFitnessRD');
  });

  it('explains the fail-safe reset and stays on sign-in', async () => {
    mockCapability = { available: true, kind: 'fingerprint' };
    mockSessionStatus = 'locked';
    mockUnlock.mockResolvedValue('reset');
    await render(<SignInScreen />);

    await fireEvent.press(screen.getByTestId('button-biometric-unlock'));

    expect(await screen.findByText('Sign in with your password')).toBeOnTheScreen();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does nothing visible when the person cancels the prompt', async () => {
    mockCapability = { available: true, kind: 'fingerprint' };
    mockSessionStatus = 'locked';
    mockUnlock.mockResolvedValue('cancelled');
    await render(<SignInScreen />);

    await fireEvent.press(screen.getByTestId('button-biometric-unlock'));

    await waitFor(() => expect(mockUnlock).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Sign in with your password')).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('offers linking after a password sign-in, then continues to the dashboard', async () => {
    mockCapability = { available: true, kind: 'fingerprint' };
    await render(<SignInScreen />);

    await fireEvent.changeText(screen.getByTestId('input-email'), 'user@example.test');
    await fireEvent.changeText(screen.getByTestId('input-password'), 'password12345');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    const sheet = await screen.findByTestId('mock-link-sheet');
    expect(mockReplace).not.toHaveBeenCalled();

    await fireEvent.press(sheet);
    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });
});
