import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { deleteAccount } from '@/features/authentication';
import DeleteAccountScreen from '../../app/delete-account';

let mockSessionStatus: 'authenticated' | 'unauthenticated' | 'unknown' = 'authenticated';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  Redirect: () => null,
  router: { replace: jest.fn(), back: jest.fn() },
}));
jest.mock('@/features/authentication', () => ({
  deleteAccount: jest.fn(),
  useSession: () => ({ status: mockSessionStatus, session: null }),
}));

const mockDeleteAccount = jest.mocked(deleteAccount);

describe('DeleteAccountScreen (Step 6B product surface)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionStatus = 'authenticated';
  });

  it('does not delete until the confirmation phrase is typed exactly', async () => {
    await render(<DeleteAccountScreen />);

    const confirm = screen.getByRole('button', { name: 'Permanently delete account' });
    // Disabled + guarded before the phrase matches.
    expect(confirm.props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(confirm);
    expect(mockDeleteAccount).not.toHaveBeenCalled();

    // Wrong phrase stays disabled.
    fireEvent.changeText(screen.getByTestId('input-confirm-phrase'), 'delete please');
    fireEvent.press(confirm);
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it('deletes and routes to sign-in once DELETE is confirmed', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    mockDeleteAccount.mockResolvedValue(undefined);
    await render(<DeleteAccountScreen />);

    fireEvent.changeText(screen.getByTestId('input-confirm-phrase'), 'DELETE');
    // Wait for the confirmation to enable the button before pressing.
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Permanently delete account' }).props.accessibilityState
          ?.disabled,
      ).toBe(false),
    );
    fireEvent.press(screen.getByRole('button', { name: 'Permanently delete account' }));

    await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/sign-in'));
  });

  it('shows a safe error and stays put when deletion fails', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    mockDeleteAccount.mockRejectedValue(new Error('500 boom token=secret'));
    await render(<DeleteAccountScreen />);

    fireEvent.changeText(screen.getByTestId('input-confirm-phrase'), 'DELETE');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Permanently delete account' }).props.accessibilityState
          ?.disabled,
      ).toBe(false),
    );
    fireEvent.press(screen.getByRole('button', { name: 'Permanently delete account' }));

    expect(await screen.findByText('Deletion failed')).toBeOnTheScreen();
    expect(
      screen.getByText('We could not delete your account. Please try again.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/secret/)).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('cancel returns without deleting', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    await render(<DeleteAccountScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Cancel account deletion' }));

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it('redirects to sign-in when unauthenticated', async () => {
    mockSessionStatus = 'unauthenticated';
    await render(<DeleteAccountScreen />);

    expect(screen.queryByTestId('input-confirm-phrase')).toBeNull();
  });
});
