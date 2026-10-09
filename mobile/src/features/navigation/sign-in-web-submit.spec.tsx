import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import SignInScreen from '@/app/sign-in';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockSignIn = jest.fn();
const mockSignUp = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: (href: string) => mockReplace(href),
    push: (href: string) => mockPush(href),
  },
  Stack: {
    Screen: () => null,
  },
}));

jest.mock('@/features/authentication', () => {
  // Real-shaped AuthError so `error instanceof AuthError` works in the screen.
  // Factory-local, mock-prefixed name to satisfy babel-jest-hoist.
  class MockAuthError extends Error {
    reason: string;
    constructor(reason: string) {
      super(reason);
      this.name = 'AuthError';
      this.reason = reason;
    }
  }
  return {
    AuthError: MockAuthError,
    signIn: (...args: unknown[]) => mockSignIn(...args),
    signUp: (...args: unknown[]) => mockSignUp(...args),
  };
});

const { AuthError } = jest.requireMock<{
  AuthError: new (reason: string) => Error & { reason: string };
}>('@/features/authentication');

// BUG-035 (Web only): Enter submits sign-in from any field, a second Enter or
// a press while loading starts no second request, and the loading button stays
// enabled and busy so it keeps focus. Native keeps the ADR-P030 double-tap model
// above. The focus outcome was verified in headless Chrome in EN and ES.
describe('SignInScreen Web submit (BUG-035)', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockSignIn.mockReset();
    mockReplace.mockReset();
  });
  afterEach(async () => {
    // Settle every continuation this test started before the tree is cleaned up.
    await act(async () => {});
    jest.restoreAllMocks();
  });

  it('submits once on repeated Enter and keeps the busy button enabled', async () => {
    let reject: (error: Error) => void = () => {};
    mockSignIn.mockReturnValue(new Promise((_resolve, r) => (reject = r)));
    await render(<SignInScreen />);
    await fireEvent.changeText(screen.getByTestId('input-email'), 'person@example.test');
    await fireEvent.changeText(screen.getByTestId('input-password'), 'password12345');

    const password = screen.getByTestId('input-password');
    expect(password.props.blurOnSubmit).toBe(false);
    await fireEvent(password, 'submitEditing', { nativeEvent: { text: '' } });
    await fireEvent(screen.getByTestId('input-email'), 'submitEditing', {
      nativeEvent: { text: '' },
    });
    expect(mockSignIn).toHaveBeenCalledTimes(1);

    const button = screen.getByRole('button', { name: 'Sign in' });
    expect(button).not.toBeDisabled();
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ busy: true }));
    button.props.onClick?.({
      nativeEvent: {},
      persist() {},
      preventDefault() {},
      stopPropagation() {},
    });
    expect(mockSignIn).toHaveBeenCalledTimes(1);

    await act(async () => {
      reject(new AuthError('server'));
    });
    expect(screen.getByTestId('input-password')).toBeOnTheScreen();
  });

  it('allows a new attempt after the first one settles', async () => {
    mockSignIn.mockRejectedValueOnce(new AuthError('server'));
    mockSignIn.mockResolvedValueOnce({ status: 'authenticated', session: {} });
    await render(<SignInScreen />);
    await fireEvent.changeText(screen.getByTestId('input-email'), 'person@example.test');
    await fireEvent.changeText(screen.getByTestId('input-password'), 'password12345');

    await fireEvent(screen.getByTestId('input-password'), 'submitEditing', {
      nativeEvent: { text: '' },
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).not.toBeBusy());
    await fireEvent(screen.getByTestId('input-password'), 'submitEditing', {
      nativeEvent: { text: '' },
    });

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/dashboard'));
    expect(mockSignIn).toHaveBeenCalledTimes(2);
  });
});
