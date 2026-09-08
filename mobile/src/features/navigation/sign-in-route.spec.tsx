import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

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

describe('SignInScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // signIn/signUp resolve to a typed outcome (ADR-P030 C-1): 'authenticated'
    // for the attempt that still reflects the user's latest intent.
    mockSignIn.mockResolvedValue({ status: 'authenticated', session: {} });
    mockSignUp.mockResolvedValue({ status: 'authenticated', session: {} });
  });

  it('renders the development sign-in form', async () => {
    await render(<SignInScreen />);

    expect(screen.getByText('AppFitness')).toBeOnTheScreen();
    expect(screen.getByLabelText('Email')).toBeOnTheScreen();
    expect(screen.getByLabelText('Password')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
  });

  it('signs in and redirects to the dashboard', async () => {
    await render(<SignInScreen />);

    await fireEvent.changeText(screen.getByLabelText('Email'), 'user@appfitness.local');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'password12345');
    await fireEvent.press(screen.getByText('Sign in'));

    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'user@appfitness.local',
        password: 'password12345',
      }),
    );
    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });

  it('switches to registration and submits username', async () => {
    await render(<SignInScreen />);

    await fireEvent.press(screen.getByLabelText('Switch authentication mode'));
    expect(screen.getByLabelText('Username')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'new@appfitness.local');
    await fireEvent.changeText(screen.getByLabelText('Username'), 'new-user');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'password12345');
    await fireEvent.press(screen.getByText('Register'));

    await waitFor(() =>
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'new@appfitness.local',
        username: 'new-user',
        password: 'password12345',
      }),
    );
    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });

  it('shows a distinct invalid-credentials error on sign-in 401', async () => {
    mockSignIn.mockRejectedValue(new AuthError('invalid-credentials'));

    await render(<SignInScreen />);
    await fireEvent.press(screen.getByText('Sign in'));

    expect(await screen.findByText('Sign-in failed')).toBeOnTheScreen();
    expect(
      screen.getByText('That email or password is incorrect. Please try again.'),
    ).toBeOnTheScreen();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows a connectivity error when the network is unreachable', async () => {
    mockSignIn.mockRejectedValue(new AuthError('connectivity'));

    await render(<SignInScreen />);
    await fireEvent.press(screen.getByText('Sign in'));

    expect(await screen.findByText('No connection')).toBeOnTheScreen();
    expect(
      screen.getByText(
        "We couldn't reach AppFitness. Check your internet connection and try again.",
      ),
    ).toBeOnTheScreen();
  });

  it('shows a server error on an unexpected API response', async () => {
    mockSignIn.mockRejectedValue(new AuthError('server'));

    await render(<SignInScreen />);
    await fireEvent.press(screen.getByText('Sign in'));

    expect(await screen.findByText('Something went wrong')).toBeOnTheScreen();
    expect(
      screen.getByText('AppFitness is having trouble right now. Please try again in a moment.'),
    ).toBeOnTheScreen();
  });

  it('shows an unexpected (post-auth) error and never leaks raw error text', async () => {
    // A post-auth/local failure surfaces as a plain Error → mapped to unexpected;
    // credentials were valid, so it must NOT read as a credential error.
    mockSignIn.mockRejectedValue(new Error('SecureStore write failed: token abc123'));

    await render(<SignInScreen />);
    await fireEvent.press(screen.getByText('Sign in'));

    expect(await screen.findByText('Something went wrong')).toBeOnTheScreen();
    expect(
      screen.getByText("We couldn't finish signing you in on this device. Please try again."),
    ).toBeOnTheScreen();
    // Raw error text/token never rendered; not misclassified as invalid credentials.
    expect(screen.queryByText(/abc123/i)).toBeNull();
    expect(screen.queryByText('Sign-in failed')).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows a non-enumerating registration error on register conflict', async () => {
    mockSignUp.mockRejectedValue(new AuthError('registration-unavailable'));

    await render(<SignInScreen />);
    await fireEvent.press(screen.getByLabelText('Switch authentication mode'));
    await fireEvent.changeText(screen.getByLabelText('Email'), 'taken@appfitness.local');
    await fireEvent.changeText(screen.getByLabelText('Username'), 'taken-user');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'password12345');
    await fireEvent.press(screen.getByText('Register'));

    expect(await screen.findByText("Couldn't create account")).toBeOnTheScreen();
    expect(
      screen.getByText("We couldn't create your account with those details. Try different ones."),
    ).toBeOnTheScreen();
    // No account-existence disclosure / no echoed identifiers.
    expect(screen.queryByText(/already (exists|registered|taken)/i)).toBeNull();
    expect(screen.queryByText(/taken@appfitness\.local/)).toBeNull();
    expect(screen.queryByText(/taken-user/)).toBeNull();
  });

  // Password-recovery entry point (ADR-P026 Vertical 1).
  it('offers password recovery from sign-in and routes to the request screen', async () => {
    await render(<SignInScreen />);

    const link = screen.getByLabelText('Forgot your password?');
    expect(link).toBeOnTheScreen();

    await fireEvent.press(link);
    expect(mockPush).toHaveBeenCalledWith('/forgot-password');
  });

  it('hides the recovery entry point while creating an account', async () => {
    await render(<SignInScreen />);

    await fireEvent.press(screen.getByLabelText('Switch authentication mode'));

    // Nothing to recover before the account exists.
    expect(screen.queryByLabelText('Forgot your password?')).toBeNull();
  });

  /**
   * `superseded` says the session layer discarded the attempt, but not why: a
   * newer submission from this screen, or something external such as a
   * sign-out. Returning early without clearing `loading` stranded the spinner
   * forever in the external case, so ownership decides instead — the latest
   * submission owns `loading`, whatever the outcome (ADR-P030 C-1).
   *
   * The submit button renders a spinner in place of its label while loading,
   * so the label query IS the "controls usable" signal.
   */
  describe('superseded submissions never strand the form', () => {
    function deferred<T>(): {
      promise: Promise<T>;
      resolve: (value: T) => void;
      reject: (reason: unknown) => void;
    } {
      let resolve!: (value: T) => void;
      let reject!: (reason: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    }

    it('re-enables the form and shows nothing when the attempt is superseded', async () => {
      const pending = deferred<{ status: string }>();
      mockSignIn.mockReturnValue(pending.promise);

      await render(<SignInScreen />);
      await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

      // Spinner up: the label is replaced while the attempt is in flight.
      expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();

      // Superseded by something outside this screen (e.g. a sign-out). Every
      // resolution is flushed inside `act`, so the continuation it schedules
      // lands in this test rather than during a later one.
      await act(async () => {
        pending.resolve({ status: 'superseded' });
      });

      // Controls usable again…
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
      // …with no navigation and no banner for an account the user dropped.
      expect(mockReplace).not.toHaveBeenCalled();
      expect(screen.queryByText('Sign-in failed')).toBeNull();
      expect(screen.queryByText('Something went wrong')).toBeNull();
    });

    it(`does not let an older submission clear a newer one's spinner`, async () => {
      const first = deferred<{ status: string }>();
      const second = deferred<{ status: string; session: object }>();
      mockSignIn.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

      await render(<SignInScreen />);
      // Two presses land before the disable takes effect (a double tap within
      // one frame), so the screen genuinely owns two submissions.
      const button = screen.getByRole('button', { name: 'Sign in' });
      // Deliberately not awaited between presses: awaiting the first would
      // flush the disable, and the second tap would never become a second
      // submission — the very case under test.
      const presses = [fireEvent.press(button), fireEvent.press(button)];
      expect(mockSignIn).toHaveBeenCalledTimes(2);

      // The OLDER submission finishes first, superseded.
      await act(async () => {
        first.resolve({ status: 'superseded' });
      });

      // The spinner belongs to the newer submission and must still be up.
      expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
      expect(mockReplace).not.toHaveBeenCalled();

      // The newer submission then succeeds and owns the outcome.
      await act(async () => {
        second.resolve({ status: 'authenticated', session: {} });
      });
      await Promise.all(presses);
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
      // …and the spinner is cleared by the submission that owned it. The two
      // overlapping presses leave React work the un-awaited act scopes have
      // not flushed, so this is polled rather than read once.
      await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled());

      // Settle everything this test started, so no continuation of it can
      // re-render a tree owned by the next test.
      await act(async () => {});
    });
  });
});
