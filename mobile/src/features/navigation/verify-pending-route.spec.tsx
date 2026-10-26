import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

import VerifyPendingScreen, { RESEND_COOLDOWN_SECONDS } from '../../app/verify-pending';

let mockStatus: 'unknown' | 'authenticated' | 'unauthenticated' = 'authenticated';
let mockVerifiedAt: string | null = null;
let mockParams: { sent?: string } = {};
let mockLanguage: 'en' | 'es' = 'en';
const mockReplace = jest.fn();
const mockSignOut = jest.fn();
const mockConfirm = jest.fn();
const mockResend = jest.fn();
let appStateListeners: ((state: string) => void)[] = [];

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Redirect: {href}</Text>;
  },
  router: { replace: (href: string) => mockReplace(href) },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/features/authentication', () => {
  class EmailVerificationError extends Error {
    reason: string;
    constructor(reason: string) {
      super(reason);
      this.reason = reason;
    }
  }
  return {
    EmailVerificationError,
    signOut: () => mockSignOut(),
    useSession: () => ({
      status: mockStatus,
      session:
        mockStatus === 'authenticated'
          ? { user: { email: 'ana@example.test', emailVerifiedAt: mockVerifiedAt } }
          : null,
    }),
  };
});

jest.mock('@/features/authentication/application/access-gate', () => ({
  ...jest.requireActual('@/features/authentication/application/access-gate'),
  confirmEmailVerified: () => mockConfirm(),
  resendVerificationEmail: (locale: string) => mockResend(locale),
}));

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

describe('VerifyPendingScreen (ADR-P041 D2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatus = 'authenticated';
    mockVerifiedAt = null;
    mockParams = {};
    mockLanguage = 'en';
    // The quiet check on mount finds the account still unverified.
    mockConfirm.mockResolvedValue(false);
    mockResend.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
    appStateListeners = [];
    // Captured for every test (and never restored mid-file): the screen
    // subscribes on mount and removes the subscription on unmount.
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      appStateListeners.push(listener as (state: string) => void);
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
  });

  it('names the address the link was sent to', async () => {
    await render(<VerifyPendingScreen />);

    expect(screen.getByRole('header', { name: 'Verify your email' })).toBeOnTheScreen();
    expect(screen.getByText('We sent a link to:')).toBeOnTheScreen();
    expect(screen.getByTestId('verify-pending-email')).toHaveTextContent('ana@example.test');
    expect(screen.getByText('Open it to activate your account and continue.')).toBeOnTheScreen();
  });

  it('renders in Spanish', async () => {
    mockLanguage = 'es';
    await render(<VerifyPendingScreen />);

    expect(screen.getByRole('header', { name: 'Verifica tu correo' })).toBeOnTheScreen();
    expect(screen.getByText('Ya lo verifiqué')).toBeOnTheScreen();
    expect(screen.getByText('Reenviar correo')).toBeOnTheScreen();
    expect(screen.getByText('Usar otra cuenta')).toBeOnTheScreen();
  });

  it('continues to the app once "I\'ve verified it" confirms with the server', async () => {
    await render(<VerifyPendingScreen />);
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));

    mockConfirm.mockResolvedValueOnce(true);
    await fireEvent.press(screen.getByTestId('button-verify-confirm'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/dashboard'));
  });

  it('says "not verified yet" when the server still disagrees', async () => {
    await render(<VerifyPendingScreen />);
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));

    await fireEvent.press(screen.getByTestId('button-verify-confirm'));

    expect(await screen.findByText('Not verified yet')).toBeOnTheScreen();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('says "couldn\'t check" on a connectivity failure, never "not verified"', async () => {
    await render(<VerifyPendingScreen />);
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));

    mockConfirm.mockRejectedValueOnce(new TypeError('Network request failed'));
    await fireEvent.press(screen.getByTestId('button-verify-confirm'));

    expect(await screen.findByText("Couldn't check right now")).toBeOnTheScreen();
    expect(screen.queryByText('Not verified yet')).toBeNull();
  });

  it('re-checks quietly when the person comes back from the mail app', async () => {
    await render(<VerifyPendingScreen />);
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));

    mockConfirm.mockResolvedValueOnce(true);
    await act(async () => appStateListeners.forEach((listener) => listener('active')));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/dashboard'));
    expect(screen.queryByText('Not verified yet')).toBeNull();
  });

  it('resends in the active language and then holds the button for the cooldown', async () => {
    mockLanguage = 'es';
    await render(<VerifyPendingScreen />);

    await fireEvent.press(screen.getByTestId('button-verify-resend'));

    await waitFor(() => expect(mockResend).toHaveBeenCalledWith('es'));
    expect(await screen.findByText('Revisa tu correo')).toBeOnTheScreen();
    expect(screen.getByText(`Reenviar en ${RESEND_COOLDOWN_SECONDS} s`)).toBeOnTheScreen();
    expect(screen.getByTestId('button-verify-resend')).toBeDisabled();
  });

  it('holds resend right after sign-up, which already sent the first email', async () => {
    mockParams = { sent: '1' };
    await render(<VerifyPendingScreen />);

    expect(screen.getByTestId('button-verify-resend')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('button-verify-resend'));
    expect(mockResend).not.toHaveBeenCalled();
  });

  it('shows the generic failure copy when the resend fails', async () => {
    mockResend.mockRejectedValueOnce(new EmailVerificationError('mail-unavailable'));
    await render(<VerifyPendingScreen />);

    await fireEvent.press(screen.getByTestId('button-verify-resend'));

    expect(await screen.findByText("Couldn't send right now")).toBeOnTheScreen();
  });

  it('signs out to use another account', async () => {
    await render(<VerifyPendingScreen />);

    await fireEvent.press(screen.getByTestId('button-verify-switch-account'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/sign-in'));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('sends a signed-out visitor to sign in', async () => {
    mockStatus = 'unauthenticated';
    await render(<VerifyPendingScreen />);

    expect(screen.getByText('Redirect: /sign-in')).toBeOnTheScreen();
  });

  it('lets an already verified account straight through', async () => {
    mockVerifiedAt = '2026-10-26T12:00:00.000Z';
    await render(<VerifyPendingScreen />);

    expect(screen.getByText('Redirect: /dashboard')).toBeOnTheScreen();
  });
});
