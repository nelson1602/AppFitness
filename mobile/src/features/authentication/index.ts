export type { AuthUser, Role, Session, SessionStatus, SessionTokens } from './domain/session.types';
export { AuthApiError } from './infrastructure/auth-api';
export {
  AuthError,
  EmailVerificationError,
  PasswordRecoveryError,
  getAccessToken,
  getSession,
  getStatus,
  deleteAccount,
  refreshTokens,
  refreshUser,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  restoreSession,
  signIn,
  signOut,
  signUp,
  subscribe,
  verifyEmail,
} from './application/session-manager';
export type {
  AuthErrorReason,
  EmailVerificationErrorReason,
  PasswordRecoveryErrorReason,
} from './application/session-manager';
export {
  dismissReminder,
  dismissedUserSnapshot,
  isReminderDismissed,
  resetDismissal,
  subscribeToReminder,
} from './application/verification-reminder';
export { useSession } from './presentation/use-session';
