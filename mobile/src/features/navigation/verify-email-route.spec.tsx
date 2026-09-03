import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import VerifyEmailScreen, {
  captureVerificationToken,
  clearTokenFromUrl,
  resolveVerifyState,
} from '../../app/verify-email';

/**
 * Verification landing (`/verify-email`, ADR-P026 V2-D).
 *
 * Covers the hydration-safe capture, fragment removal, every state in the
 * frozen V2-B matrix, and the conditional navigation that depends on whether a
 * session already exists. Redemption itself is mocked — the server contract is
 * proved by the V2-C e2e suite; what matters here is that the UI maps each
 * outcome to the right frozen copy and never leaks the token.
 */

const mockReplace = jest.fn();
const mockVerify = jest.fn();
let mockStatus = 'unauthenticated';
let mockParams: { token?: string | string[] } = {};
let mockLanguage = 'en';
let mockLocation: { pathname: string; search: string; hash: string } | null = null;
const mockReplaceState = jest.fn();

// Platform.OS is native under jest-expo, so the real web-location module would
// always answer null. Mocking just this seam — rather than all of react-native,
// which this rendering spec needs — keeps the browser path exercisable. The
// module's own platform gate is covered by reset-link.web-location.spec.ts.
jest.mock('@/features/authentication/presentation/reset-link.web-location', () => {
  const actual = jest.requireActual(
    '@/features/authentication/presentation/reset-link.web-location',
  );
  return {
    ...actual,
    currentWebLocation: () => mockLocation,
    currentWebHistory: () => ({ replaceState: mockReplaceState }),
  };
});

jest.mock('expo-router', () => ({
  router: { replace: (href: string) => mockReplace(href) },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/features/authentication', () => {
  // Plain field assignment, not a TS parameter property: Babel rejects the
  // latter inside a jest.mock factory as an out-of-scope variable access.
  class EmailVerificationError extends Error {
    reason: string;
    constructor(reason: string) {
      super(reason);
      this.reason = reason;
      this.name = 'EmailVerificationError';
    }
  }
  return {
    EmailVerificationError,
    useSession: () => ({ status: mockStatus, session: null }),
    verifyEmail: (input: { token: string }) => mockVerify(input),
  };
});

jest.mock('@/shared/localization', () => {
  const actual = jest.requireActual('@/shared/localization');
  const { en } = jest.requireActual('@/shared/localization/resources/en');
  const { es } = jest.requireActual('@/shared/localization/resources/es');
  return {
    ...actual,
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: keyof typeof en) => (mockLanguage === 'es' ? es[key] : en[key]),
    }),
  };
});

const { EmailVerificationError } = jest.requireMock<{
  EmailVerificationError: new (reason: string) => Error;
}>('@/features/authentication');

describe('VerifyEmailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatus = 'unauthenticated';
    mockParams = {};
    mockLanguage = 'en';
    mockVerify.mockResolvedValue(undefined);
    mockLocation = null;
  });

  describe('state derivation', () => {
    it('renders the neutral checking state while hydrating', () => {
      // 'undefined' is the prerender/hydration snapshot — never "missing".
      expect(resolveVerifyState(undefined, 'pending')).toBe('checking');
      expect(resolveVerifyState(undefined, 'success')).toBe('checking');
    });

    it('reports an incomplete link only once the capture resolved to null', () => {
      expect(resolveVerifyState(null, 'pending')).toBe('missing-token');
    });

    it('shows checking until the request resolves, then its outcome', () => {
      expect(resolveVerifyState('tok', 'pending')).toBe('checking');
      expect(resolveVerifyState('tok', 'success')).toBe('success');
      expect(resolveVerifyState('tok', 'invalid')).toBe('invalid');
      expect(resolveVerifyState('tok', 'error')).toBe('error');
    });
  });

  describe('token capture and fragment removal', () => {
    const withLocation = (hash: string, search = '') => {
      mockLocation = { pathname: '/verify-email', search, hash };
      return mockReplaceState;
    };

    it('reads the token from the URL fragment', () => {
      withLocation('#token=abc123');
      expect(captureVerificationToken(undefined)).toBe('abc123');
    });

    it('percent-decodes a fragment token', () => {
      withLocation('#token=a%2Bb');
      expect(captureVerificationToken(undefined)).toBe('a+b');
    });

    it('falls back to the native router param when there is no fragment', () => {
      expect(captureVerificationToken('native-token')).toBe('native-token');
    });

    it('refuses a duplicated token rather than guessing', () => {
      withLocation('#token=one&token=two');
      expect(captureVerificationToken(undefined)).toBeNull();
    });

    it('returns null when no token is present anywhere', () => {
      withLocation('');
      expect(captureVerificationToken(undefined)).toBeNull();
    });

    it('scrubs the fragment out of the visible URL', () => {
      const replaceState = withLocation('#token=abc123');
      clearTokenFromUrl();
      expect(replaceState).toHaveBeenCalledWith(null, '', '/verify-email');
      // The credential must not survive anywhere in the written URL.
      expect(JSON.stringify(replaceState.mock.calls)).not.toContain('abc123');
    });

    it('also strips a token query parameter (defence in depth)', () => {
      const replaceState = withLocation('', '?token=abc123&x=1');
      clearTokenFromUrl();
      expect(replaceState).toHaveBeenCalledWith(null, '', '/verify-email?x=1');
    });

    it('does nothing when there is nothing to strip', () => {
      const replaceState = withLocation('', '?x=1');
      clearTokenFromUrl();
      expect(replaceState).not.toHaveBeenCalled();
    });
  });

  describe('states', () => {
    it('shows the checking state before the request resolves', async () => {
      mockParams = { token: 'tok' };
      let resolve: (() => void) | undefined;
      mockVerify.mockReturnValue(
        new Promise<void>((r) => {
          resolve = r;
        }),
      );

      await render(<VerifyEmailScreen />);
      expect(screen.getByTestId('verify-checking')).toBeTruthy();
      expect(screen.getByText('Verifying your email')).toBeTruthy();

      resolve?.();
      await waitFor(() => expect(screen.getByTestId('verify-success')).toBeTruthy());
    });

    it('shows success and redeems exactly once', async () => {
      mockParams = { token: 'tok' };
      await render(<VerifyEmailScreen />);

      await waitFor(() => expect(screen.getByTestId('verify-success')).toBeTruthy());
      expect(screen.getByText('Email verified')).toBeTruthy();
      expect(mockVerify).toHaveBeenCalledTimes(1);
      expect(mockVerify).toHaveBeenCalledWith({ token: 'tok' });
    });

    it('shows the incomplete-link state when no token arrived, without calling the API', async () => {
      await render(<VerifyEmailScreen />);

      await waitFor(() => expect(screen.getByTestId('verify-missing-token')).toBeTruthy());
      expect(screen.getByText('This link is incomplete')).toBeTruthy();
      expect(mockVerify).not.toHaveBeenCalled();
    });

    it('maps a rejected token to the single invalid-link state', async () => {
      mockParams = { token: 'tok' };
      mockVerify.mockRejectedValue(new EmailVerificationError('invalid-verification-token'));

      await render(<VerifyEmailScreen />);
      await waitFor(() => expect(screen.getByTestId('verify-invalid')).toBeTruthy());
      expect(screen.getByText('This link is no longer valid')).toBeTruthy();
      // Expired / already used / unrecognised are one indistinguishable outcome.
      expect(screen.queryByText(/expired|already used|unrecognised/i)).toBeNull();
    });

    it.each([['connectivity'], ['server'], ['mail-unavailable'], ['rate-limited'], ['unexpected']])(
      'maps a %s failure to the request-failed state',
      async (reason) => {
        mockParams = { token: 'tok' };
        mockVerify.mockRejectedValue(new EmailVerificationError(reason));

        await render(<VerifyEmailScreen />);
        await waitFor(() => expect(screen.getByTestId('verify-error')).toBeTruthy());
        expect(screen.getByText('Something went wrong')).toBeTruthy();
      },
    );

    it('maps an untyped throw to the request-failed state, never crashing', async () => {
      mockParams = { token: 'tok' };
      mockVerify.mockRejectedValue(new Error('boom'));

      await render(<VerifyEmailScreen />);
      await waitFor(() => expect(screen.getByTestId('verify-error')).toBeTruthy());
    });

    it('renders Spanish copy', async () => {
      mockLanguage = 'es';
      mockParams = { token: 'tok' };
      await render(<VerifyEmailScreen />);
      await waitFor(() => expect(screen.getByText('Correo verificado')).toBeTruthy());
    });
  });

  describe('conditional navigation — verification creates no session', () => {
    it('sends an authenticated visitor to the dashboard on success', async () => {
      mockStatus = 'authenticated';
      mockParams = { token: 'tok' };
      await render(<VerifyEmailScreen />);

      await waitFor(() => expect(screen.getByTestId('button-verify-continue')).toBeTruthy());
      expect(screen.getByText('Continue')).toBeTruthy();
      fireEvent.press(screen.getByTestId('button-verify-continue'));
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });

    it('sends an unauthenticated visitor to sign-in on success', async () => {
      mockParams = { token: 'tok' };
      await render(<VerifyEmailScreen />);

      await waitFor(() => expect(screen.getByTestId('button-verify-continue')).toBeTruthy());
      fireEvent.press(screen.getByTestId('button-verify-continue'));
      // Redeeming established no session, so signing in is still required.
      expect(mockReplace).toHaveBeenCalledWith('/sign-in');
    });

    it('offers Continue to the dashboard on failure when a session exists', async () => {
      mockStatus = 'authenticated';
      mockParams = { token: 'tok' };
      mockVerify.mockRejectedValue(new EmailVerificationError('invalid-verification-token'));

      await render(<VerifyEmailScreen />);
      await waitFor(() => expect(screen.getByTestId('button-verify-onward')).toBeTruthy());
      expect(screen.getByText('Continue')).toBeTruthy();
      fireEvent.press(screen.getByTestId('button-verify-onward'));
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });

    it('offers Go to sign in on failure when no session exists', async () => {
      mockParams = { token: 'tok' };
      mockVerify.mockRejectedValue(new EmailVerificationError('invalid-verification-token'));

      await render(<VerifyEmailScreen />);
      await waitFor(() => expect(screen.getByTestId('button-verify-onward')).toBeTruthy());
      expect(screen.getByText('Go to sign in')).toBeTruthy();
      fireEvent.press(screen.getByTestId('button-verify-onward'));
      expect(mockReplace).toHaveBeenCalledWith('/sign-in');
    });

    it('offers the same conditional action on an incomplete link', async () => {
      await render(<VerifyEmailScreen />);
      await waitFor(() => expect(screen.getByTestId('button-verify-onward')).toBeTruthy());
      expect(screen.getByText('Go to sign in')).toBeTruthy();
    });
  });

  describe('this surface never resends', () => {
    it('renders no resend control and no email input in any state', async () => {
      mockParams = { token: 'tok' };
      mockVerify.mockRejectedValue(new EmailVerificationError('invalid-verification-token'));

      await render(<VerifyEmailScreen />);
      await waitFor(() => expect(screen.getByTestId('verify-invalid')).toBeTruthy());

      expect(screen.queryByTestId('button-verification-resend')).toBeNull();
      expect(screen.queryByText('Send verification email')).toBeNull();
      expect(screen.queryByPlaceholderText(/email/i)).toBeNull();
    });
  });
});
