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
  isBiometricLinked,
  isSessionCurrent,
  linkBiometrics,
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
  unlinkBiometrics,
  unlockWithBiometrics,
  verifyEmail,
} from './application/session-manager';
export type {
  AuthAttemptOutcome,
  BiometricLinkOutcome,
  BiometricUnlinkOutcome,
  BiometricUnlockOutcome,
  SessionSnapshot,
} from './application/session-manager';
export {
  getBiometricCapability,
  type BiometricCapability,
  type BiometricKind,
} from './infrastructure/biometric-capability';
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
export { BiometricLinkSheet } from './presentation/biometric-link-sheet';
export { BiometricSwitch } from './presentation/biometric-switch';
export { useBiometricCapability } from './presentation/use-biometric-capability';
