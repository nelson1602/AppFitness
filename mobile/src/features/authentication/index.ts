export type { AuthUser, Role, Session, SessionStatus, SessionTokens } from './domain/session.types';
export { AuthApiError } from './infrastructure/auth-api';
export {
  AuthError,
  EmailVerificationError,
  PasswordRecoveryError,
  getAccessToken,
  getSession,
  getSessionSnapshot,
  getStatus,
  isSessionCurrent,
  requireSessionSnapshot,
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
export type { AuthAttemptOutcome, SessionSnapshot } from './application/session-manager';
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
export { bindStoreToSession } from './application/session-scope';
export { useSession } from './presentation/use-session';
