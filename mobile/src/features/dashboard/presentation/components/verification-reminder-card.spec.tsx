import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Taken from the mocked barrel deliberately: the mock spreads the real
// dismissal module, so this is the exact function instance the component uses.
// A separate `requireActual` would be a different instance and would not reset
// the state the component reads.
import { resetDismissal } from '@/features/authentication';

import { VerificationReminderCard } from './verification-reminder-card';

/**
 * Dashboard verification reminder (ADR-P026 V2-D).
 *
 * Covers visibility, the dismissal lifecycle, and every resend outcome the
 * frozen contract defines. The real dismissal store is used — it is pure
 * in-memory module state, so exercising it here also proves the component and
 * the store agree.
 */

let mockSession: {
  status: string;
  session: { user: { id: string; emailVerifiedAt?: string | null } } | null;
} = { status: 'authenticated', session: null };
let mockLanguage = 'en';
const mockResend = jest.fn();

jest.mock('@/features/authentication', () => {
  const reminder = jest.requireActual<
    typeof import('@/features/authentication/application/verification-reminder')
  >('@/features/authentication/application/verification-reminder');
  return {
    ...reminder,
    useSession: () => mockSession,
    resendVerification: (input: { locale: string }) => mockResend(input),
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

const unverified = {
  status: 'authenticated',
  session: { user: { id: 'user-1', emailVerifiedAt: null } },
};

describe('VerificationReminderCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetDismissal();
    mockLanguage = 'en';
    mockResend.mockResolvedValue(undefined);
    mockSession = { ...unverified };
  });

  describe('visibility', () => {
    it('shows for an authenticated user whose email is not verified', async () => {
      await render(<VerificationReminderCard />);
      expect(screen.getByTestId('verification-reminder')).toBeTruthy();
      expect(screen.getByText('Verify your email')).toBeTruthy();
    });

    it('is hidden once the address is verified', async () => {
      mockSession = {
        status: 'authenticated',
        session: { user: { id: 'user-1', emailVerifiedAt: '2026-09-03T00:00:00Z' } },
      };
      await render(<VerificationReminderCard />);
      expect(screen.queryByTestId('verification-reminder')).toBeNull();
    });

    it('is hidden when unauthenticated — it is an authenticated affordance', async () => {
      mockSession = { status: 'unauthenticated', session: null };
      await render(<VerificationReminderCard />);
      expect(screen.queryByTestId('verification-reminder')).toBeNull();
    });

    it('is hidden while the session is still unknown', async () => {
      mockSession = { status: 'unknown', session: null };
      await render(<VerificationReminderCard />);
      expect(screen.queryByTestId('verification-reminder')).toBeNull();
    });

    it('treats a missing emailVerifiedAt as unverified — the safe default', async () => {
      mockSession = { status: 'authenticated', session: { user: { id: 'user-1' } } };
      await render(<VerificationReminderCard />);
      expect(screen.getByTestId('verification-reminder')).toBeTruthy();
    });

    it('renders Spanish copy', async () => {
      mockLanguage = 'es';
      await render(<VerificationReminderCard />);
      expect(screen.getByText('Verifica tu correo')).toBeTruthy();
      expect(screen.getByText('Enviar correo de verificación')).toBeTruthy();
    });
  });

  describe('dismissal lifecycle', () => {
    it('hides the reminder when dismissed', async () => {
      await render(<VerificationReminderCard />);
      fireEvent.press(screen.getByTestId('button-verification-dismiss'));
      await waitFor(() => expect(screen.queryByTestId('verification-reminder')).toBeNull());
    });

    it('comes back after the session ends — dismissal never persists', async () => {
      await render(<VerificationReminderCard />);
      fireEvent.press(screen.getByTestId('button-verification-dismiss'));
      await waitFor(() => expect(screen.queryByTestId('verification-reminder')).toBeNull());

      // Sign-out / session loss: session-manager calls resetDismissal().
      resetDismissal();

      await render(<VerificationReminderCard />);
      expect(screen.getByTestId('verification-reminder')).toBeTruthy();
    });

    it('does not carry a dismissal across accounts', async () => {
      await render(<VerificationReminderCard />);
      fireEvent.press(screen.getByTestId('button-verification-dismiss'));
      await waitFor(() => expect(screen.queryByTestId('verification-reminder')).toBeNull());

      mockSession = {
        status: 'authenticated',
        session: { user: { id: 'user-2', emailVerifiedAt: null } },
      };
      await render(<VerificationReminderCard />);
      expect(screen.getByTestId('verification-reminder')).toBeTruthy();
    });

    it('labels the dismiss control for assistive technology', async () => {
      await render(<VerificationReminderCard />);
      expect(screen.getByLabelText('Hide this reminder until your next session')).toBeTruthy();
    });
  });

  describe('resend', () => {
    it('sends with the active locale and shows the generic acknowledgement', async () => {
      mockLanguage = 'es';
      await render(<VerificationReminderCard />);
      fireEvent.press(screen.getByTestId('button-verification-resend'));

      await waitFor(() => expect(screen.getByTestId('verification-resend-sent')).toBeTruthy());
      expect(mockResend).toHaveBeenCalledWith({ locale: 'es' });
      expect(screen.getByText('Revisa tu correo')).toBeTruthy();
    });

    it('never sends an email address', async () => {
      await render(<VerificationReminderCard />);
      fireEvent.press(screen.getByTestId('button-verification-resend'));

      await waitFor(() => expect(mockResend).toHaveBeenCalled());
      const [arg] = mockResend.mock.calls[0] as [Record<string, unknown>];
      expect(Object.keys(arg)).toEqual(['locale']);
      expect(JSON.stringify(arg)).not.toContain('@');
    });

    it('shows exactly one acknowledgement whatever the accepted outcome was', async () => {
      // The server answers an identical 202 for dispatched / already verified /
      // provider failure / ceiling, so the client cannot and must not branch.
      await render(<VerificationReminderCard />);
      fireEvent.press(screen.getByTestId('button-verification-resend'));
      await waitFor(() => expect(screen.getByTestId('verification-resend-sent')).toBeTruthy());
      expect(
        screen.getByText(
          'If your address needs verifying, a link is on its way. It expires in 24 hours.',
        ),
      ).toBeTruthy();
    });

    it.each([
      ['503 mail unavailable', 'mail-unavailable'],
      ['429 rate limited', 'rate-limited'],
      ['401 unauthenticated', 'unauthenticated'],
      ['server failure', 'server'],
      ['connectivity failure', 'connectivity'],
    ])('shows one generic failure for %s', async (_label, reason) => {
      mockResend.mockRejectedValue(new Error(reason));
      await render(<VerificationReminderCard />);
      fireEvent.press(screen.getByTestId('button-verification-resend'));

      await waitFor(() => expect(screen.getByTestId('verification-resend-failed')).toBeTruthy());
      expect(screen.getByText("Couldn't send right now")).toBeTruthy();
      expect(screen.getByText('Your account is unaffected. Try again in a moment.')).toBeTruthy();
      // The failure copy must never disclose which limit or status was hit.
      expect(screen.queryByText(/429|503|401|throttl/i)).toBeNull();
    });

    it('keeps the reminder visible after a failure so the user can retry', async () => {
      mockResend.mockRejectedValue(new Error('server'));
      await render(<VerificationReminderCard />);
      fireEvent.press(screen.getByTestId('button-verification-resend'));

      await waitFor(() => expect(screen.getByTestId('verification-resend-failed')).toBeTruthy());
      expect(screen.getByTestId('verification-reminder')).toBeTruthy();
      expect(screen.getByTestId('button-verification-resend')).toBeTruthy();
    });

    it('exposes an accessible label on the resend control', async () => {
      await render(<VerificationReminderCard />);
      expect(screen.getByLabelText('Send verification email')).toBeTruthy();
    });
  });
});
