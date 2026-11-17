/**
 * Build-time feature flags. Expo inlines `EXPO_PUBLIC_*` variables at build
 * time, so each must be read as a literal `process.env.EXPO_PUBLIC_…`.
 *
 * - `EXPO_PUBLIC_HEALTH_CONNECT=on` (ADR-P048): the watch card, the Perfil
 *   rows and the carry-over's watch input. On in the `internal`, `e2e` and
 *   `development` EAS profiles, off in `production` until the owner turns it
 *   on. Off, the app behaves exactly as before. The manifest permissions are
 *   declared either way (Play reviews them regardless).
 */
export function isHealthConnectEnabled(): boolean {
  return process.env.EXPO_PUBLIC_HEALTH_CONNECT === 'on';
}
