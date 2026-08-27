export type { AuthUser, Role, Session, SessionStatus, SessionTokens } from './domain/session.types';
export { AuthApiError } from './infrastructure/auth-api';
export {
  AuthError,
  PasswordRecoveryError,
  getAccessToken,
  getSession,
  getStatus,
  deleteAccount,
  refreshTokens,
  requestPasswordReset,
  resetPassword,
  restoreSession,
  signIn,
  signOut,
  signUp,
  subscribe,
} from './application/session-manager';
export type { AuthErrorReason, PasswordRecoveryErrorReason } from './application/session-manager';
export { useSession } from './presentation/use-session';
