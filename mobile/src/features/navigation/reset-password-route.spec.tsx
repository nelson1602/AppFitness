import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { type PasswordRecoveryErrorReason, resetPassword } from '@/features/authentication';
import ResetPasswordScreen, {
  captureResetToken,
  clearTokenFromUrl,
} from '../../app/reset-password';

let mockLanguage: 'en' | 'es' = 'en';
let mockParams: { token?: string | string[] } = { token: 'raw-token-from-link' };

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));

// Drive the browser seam directly: jest-expo runs these specs in the native
// environment, so `currentWebLocation()` would otherwise always report null.
let mockWebLocation: { pathname: string; search: string; hash: string } | null = null;
const mockReplaceState = jest.fn();

jest.mock('@/features/authentication/presentation/reset-link.web-location', () => {
  const actual = jest.requireActual<
    typeof import('@/features/authentication/presentation/reset-link.web-location')
  >('@/features/authentication/presentation/reset-link.web-location');
  return {
    ...actual,
    currentWebLocation: () => mockWebLocation,
    currentWebHistory: () => (mockWebLocation ? { replaceState: mockReplaceState } : null),
  };
});
jest.mock('@/features/authentication', () => {
  class PasswordRecoveryError extends Error {
    reason: string;
    constructor(reason: string) {
      super(reason);
      this.name = 'PasswordRecoveryError';
      this.reason = reason;
    }
  }
  return { resetPassword: jest.fn(), PasswordRecoveryError };
});
jest.mock('@/shared/localization', () => {
  const { en } = jest.requireActual<typeof import('@/shared/localization/resources/en')>(
    '@/shared/localization/resources/en',
  );
  const { es } = jest.requireActual<typeof import('@/shared/localization/resources/es')>(
    '@/shared/localization/resources/es',
  );

  return {
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: keyof typeof en) => (mockLanguage === 'es' ? es : en)[key],
    }),
  };
});

const mockReset = jest.mocked(resetPassword);
const { PasswordRecoveryError } = jest.requireMock<typeof import('@/features/authentication')>(
  '@/features/authentication',
);

/**
 * ADR-P026 correction: the emailed HTTPS link carries the token in the
 * fragment, which never reaches a server or proxy log. The native custom
 * scheme keeps its query parameter, which never traverses HTTP at all.
 */
describe('captureResetToken', () => {
  beforeEach(() => {
    mockWebLocation = null;
    mockReplaceState.mockClear();
  });

  it('reads the token from the fragment on Web', () => {
    mockWebLocation = { pathname: '/reset-password', search: '', hash: '#token=from-fragment' };

    expect(captureResetToken(undefined)).toBe('from-fragment');
  });

  it('prefers the fragment over a query parameter when both are present', () => {
    mockWebLocation = {
      pathname: '/reset-password',
      search: '?token=from-query',
      hash: '#token=from-fragment',
    };

    expect(captureResetToken('from-query')).toBe('from-fragment');
  });

  it('falls back to the router parameter for the native custom scheme', () => {
    // No browser location: appfitness://reset-password?token=…
    mockWebLocation = null;

    expect(captureResetToken('from-scheme')).toBe('from-scheme');
  });

  it('still accepts a query parameter on Web when no fragment was supplied', () => {
    mockWebLocation = { pathname: '/reset-password', search: '?token=legacy', hash: '' };

    expect(captureResetToken('legacy')).toBe('legacy');
  });

  it('returns null when neither shape carries a usable token', () => {
    mockWebLocation = { pathname: '/reset-password', search: '', hash: '#token=' };

    expect(captureResetToken(undefined)).toBeNull();
  });
});

describe('clearTokenFromUrl', () => {
  beforeEach(() => {
    mockWebLocation = null;
    mockReplaceState.mockClear();
  });

  it('replaces the history entry with a URL that has no token in it', () => {
    mockWebLocation = {
      pathname: '/reset-password',
      search: '?lang=es&token=secret-value',
      hash: '#token=secret-value',
    };

    clearTokenFromUrl();

    expect(mockReplaceState).toHaveBeenCalledTimes(1);
    const [, , url] = mockReplaceState.mock.calls[0] as [unknown, string, string];
    expect(url).toBe('/reset-password?lang=es');
    expect(url).not.toContain('secret-value');
  });

  it('does nothing when there is no token to strip', () => {
    mockWebLocation = { pathname: '/reset-password', search: '?lang=es', hash: '' };

    clearTokenFromUrl();

    expect(mockReplaceState).not.toHaveBeenCalled();
  });

  it('does nothing on native, where there is no history to rewrite', () => {
    mockWebLocation = null;

    clearTokenFromUrl();

    expect(mockReplaceState).not.toHaveBeenCalled();
  });
});

describe('ResetPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'en';
    mockParams = { token: 'raw-token-from-link' };
    mockWebLocation = null;
    mockReset.mockResolvedValue(undefined);
  });

  const fill = async (password: string, confirmation = password) => {
    await fireEvent.changeText(screen.getByTestId('input-new-password'), password);
    await fireEvent.changeText(screen.getByTestId('input-confirm-password'), confirmation);
  };
  const submit = () => fireEvent.press(screen.getByTestId('button-reset-submit'));

  // The end-to-end shape of the emailed Web link: token in the fragment, no
  // router parameter at all, and the address bar cleaned on mount.
  it.each<['en' | 'es', string, string]>([
    ['en', 'Choose a new password', 'Password changed'],
    ['es', 'Elige una nueva contraseña', 'Contraseña cambiada'],
  ])(
    'accepts a fragment-delivered token and scrubs the URL (%s)',
    async (language, heading, success) => {
      mockLanguage = language;
      mockParams = {};
      mockWebLocation = {
        pathname: '/reset-password',
        search: '',
        hash: '#token=token-from-email',
      };

      await render(<ResetPasswordScreen />);

      // The token was found, so the form renders rather than the
      // incomplete-link state.
      expect(screen.getByText(heading)).toBeTruthy();
      expect(screen.getByTestId('button-reset-submit')).toBeTruthy();

      // ...and it is gone from the visible URL and the history entry. The
      // scrub is re-asserted on a few later ticks (Expo Router rewrites the
      // URL back after mount), so the contract is "at least once, and every
      // write is token-free" rather than a single call.
      expect(mockReplaceState.mock.calls.length).toBeGreaterThanOrEqual(1);
      for (const call of mockReplaceState.mock.calls) {
        const [, , url] = call as [unknown, string, string];
        expect(url).toBe('/reset-password');
        expect(url).not.toContain('token-from-email');
      }

      // The in-memory copy still works after the URL was rewritten.
      await fill('brand-new-password');
      await submit();
      await waitFor(() =>
        expect(mockReset).toHaveBeenCalledWith({
          token: 'token-from-email',
          password: 'brand-new-password',
        }),
      );
      expect(await screen.findByText(success)).toBeTruthy();
    },
  );

  it('shows the incomplete-link state when the fragment carries no token', async () => {
    mockParams = {};
    mockWebLocation = { pathname: '/reset-password', search: '', hash: '#other=1' };

    await render(<ResetPasswordScreen />);

    expect(screen.getByText('This link is incomplete')).toBeTruthy();
    expect(screen.queryByTestId('button-reset-submit')).toBeNull();
  });

  it('submits the token from the link with the new password', async () => {
    await render(<ResetPasswordScreen />);

    await fill('brand-new-password');
    await submit();

    await waitFor(() =>
      expect(mockReset).toHaveBeenCalledWith({
        token: 'raw-token-from-link',
        password: 'brand-new-password',
      }),
    );
  });

  it('shows the completion state and routes to sign in', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    await render(<ResetPasswordScreen />);

    await fill('brand-new-password');
    await submit();

    expect(await screen.findByText('Password changed')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('button-reset-sign-in'));
    expect(router.replace).toHaveBeenCalledWith('/sign-in');
  });

  it('rejects a password below the API minimum without calling the API', async () => {
    await render(<ResetPasswordScreen />);

    await fill('short');
    await submit();

    expect(await screen.findByText('Use at least 8 characters.')).toBeTruthy();
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('requires both entries to match', async () => {
    await render(<ResetPasswordScreen />);

    await fill('brand-new-password', 'brand-new-passwerd');
    await submit();

    expect(await screen.findByText('Both passwords must match.')).toBeTruthy();
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('offers a new link when the deep link carries no token', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    mockParams = {};
    await render(<ResetPasswordScreen />);

    expect(screen.getByText('This link is incomplete')).toBeTruthy();
    expect(screen.queryByTestId('button-reset-submit')).toBeNull();

    await fireEvent.press(screen.getByTestId('button-reset-request-new'));
    expect(router.replace).toHaveBeenCalledWith('/forgot-password');
  });

  it.each<[PasswordRecoveryErrorReason, string]>([
    ['invalid-reset-token', 'This link no longer works'],
    ['rate-limited', 'Too many attempts'],
    ['connectivity', 'No connection'],
    ['server', 'Something went wrong'],
  ])('maps the %s reason to localized copy', async (reason, title) => {
    mockReset.mockRejectedValue(new PasswordRecoveryError(reason));
    await render(<ResetPasswordScreen />);

    await fill('brand-new-password');
    await submit();

    expect(await screen.findByText(title)).toBeTruthy();
    // The form stays available; no success state is shown.
    expect(screen.getByTestId('button-reset-submit')).toBeTruthy();
    expect(screen.queryByText('Password changed')).toBeNull();
  });

  it('never renders raw server text for an unrecognized failure', async () => {
    mockReset.mockRejectedValue(new Error('token raw-token-from-link rejected'));
    await render(<ResetPasswordScreen />);

    await fill('brand-new-password');
    await submit();

    expect(await screen.findByText('Something went wrong')).toBeTruthy();
    expect(screen.queryByText(/raw-token-from-link/)).toBeNull();
  });

  it('clears both password fields after a successful reset', async () => {
    await render(<ResetPasswordScreen />);

    await fill('brand-new-password');
    await submit();
    await screen.findByText('Password changed');

    // The inputs are unmounted with the form, so the new password is no longer
    // held anywhere in the component tree.
    expect(screen.queryByTestId('input-new-password')).toBeNull();
    expect(screen.queryByTestId('input-confirm-password')).toBeNull();
  });

  it('renders Spanish copy when the app language is Spanish', async () => {
    mockLanguage = 'es';
    await render(<ResetPasswordScreen />);

    expect(screen.getByText('Elige una nueva contraseña')).toBeTruthy();
    await fill('brand-new-password');
    await submit();
    expect(await screen.findByText('Contraseña cambiada')).toBeTruthy();
  });
});
