import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';

import {
  PasswordRecoveryError,
  type PasswordRecoveryErrorReason,
  resetPassword,
} from '@/features/authentication';
import { AuthTextField } from '@/features/authentication/presentation/auth-text-field';
import { RECOVERY_ERROR_COPY } from '@/features/authentication/presentation/recovery-error-copy';
import {
  parseTokenFromFragment,
  readTokenParam,
} from '@/features/authentication/presentation/reset-link';
import {
  currentWebHistory,
  currentWebLocation,
  scrubbedUrl,
} from '@/features/authentication/presentation/reset-link.web-location';
import { useLocalization } from '@/shared/localization';
import { AppButton, AppText, Banner, Card, Screen } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

/** Mirrors the API DTO so an obviously-too-short password never leaves the device. */
const MIN_PASSWORD_LENGTH = 8;

/**
 * How long to keep re-asserting the scrubbed URL after mount.
 *
 * Expo Router canonicalizes `location` itself shortly after the screen mounts
 * and re-appends the fragment it was navigated with, which silently undid a
 * single `replaceState` on mount — confirmed in a real browser, where the
 * history log showed our `/reset-password` write followed by the router
 * writing `/reset-password#token=…` straight back. Re-running the scrub on a
 * few later ticks lets our write land last. Bounded and self-cancelling.
 */
const SCRUB_RETRY_DELAYS_MS = [0, 60, 250, 600];

/**
 * Capture the reset token once, from whichever shape delivered it.
 *
 * Fragment first (the emailed HTTPS link, Web), then the router's `token`
 * query parameter (the native `appfitness://` scheme). See `reset-link.ts` for
 * why the two shapes differ.
 */
export function captureResetToken(routerParam: string | string[] | undefined): string | null {
  const location = currentWebLocation();
  if (location) {
    const fromFragment = parseTokenFromFragment(location.hash);
    if (fromFragment !== null) return fromFragment;
  }
  return readTokenParam(routerParam);
}

/**
 * Remove the token from the visible URL and from the history entry.
 *
 * `replaceState` rather than `pushState`: the goal is that the credential is
 * not left sitting in the address bar, in the back-stack, or in anything that
 * later reads `document.URL` (an analytics snippet, a crash reporter, a shared
 * screenshot). It was never sent to a server — a fragment is not part of the
 * request — so this closes the remaining client-side exposure.
 *
 * No-op on native and whenever there is nothing to strip.
 */
export function clearTokenFromUrl(): void {
  const location = currentWebLocation();
  const history = currentWebHistory();
  if (!location || !history) return;
  const next = scrubbedUrl(location);
  if (next === null) return;
  history.replaceState(null, '', next);
}

/** A store that never changes: the token is read once and then fixed. */
const NO_STORE_SUBSCRIPTION = () => () => {};

/**
 * Resolve the reset token in a way that is safe for the prerendered Web build.
 *
 * The Web export is prerendered in Node, where no `location` exists, so a
 * plain render-phase read would make the client's first output differ from the
 * prerendered HTML — a genuine hydration mismatch (React #418), observed in a
 * real browser before this was introduced.
 *
 * `useSyncExternalStore` is React's sanctioned answer: it renders the *server*
 * snapshot (`undefined`, the neutral pre-capture state) while hydrating, then
 * switches to the client snapshot. On native there is no hydration, so the
 * token is available on the very first render with no intermediate state.
 * The snapshot is memoised because `getSnapshot` must be stable across calls.
 */
function useCapturedResetToken(routerToken: string | null): string | null | undefined {
  const cached = useRef<{ value: string | null } | undefined>(undefined);
  const getSnapshot = useCallback((): string | null => {
    cached.current ??= { value: captureResetToken(routerToken ?? undefined) };
    return cached.current.value;
  }, [routerToken]);

  return useSyncExternalStore<string | null | undefined>(
    NO_STORE_SUBSCRIPTION,
    getSnapshot,
    () => undefined,
  );
}

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const { t } = useLocalization();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const routerToken = readTokenParam(params.token);

  const token = useCapturedResetToken(routerToken);

  useEffect(() => {
    // The capture already happened during render; now take the credential out
    // of the address bar, re-asserting it until the router stops overwriting.
    clearTokenFromUrl();
    const timers = SCRUB_RETRY_DELAYS_MS.map((delay) => setTimeout(clearTokenFromUrl, delay));
    return () => timers.forEach(clearTimeout);
  }, []);

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [errorReason, setErrorReason] = useState<PasswordRecoveryErrorReason | null>(null);

  const submit = async () => {
    // Covers the pre-capture (`undefined`) state as well as a missing token.
    if (token == null) return;

    const tooShort = password.length < MIN_PASSWORD_LENGTH;
    const mismatched = password !== confirmation;
    setPasswordError(tooShort ? t('auth.reset.passwordTooShort') : null);
    setConfirmationError(!tooShort && mismatched ? t('auth.reset.passwordMismatch') : null);
    if (tooShort || mismatched) return;

    setErrorReason(null);
    setLoading(true);
    try {
      await resetPassword({ token, password });
      // Never keep the new password in state after it has been submitted.
      setPassword('');
      setConfirmation('');
      setDone(true);
    } catch (error) {
      // Only the typed, safe reason is used — never the raw error/message.
      setErrorReason(error instanceof PasswordRecoveryError ? error.reason : 'unexpected');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('auth.reset.screenTitle') }} />
      <View style={{ gap: theme.spacing.lg }}>
        <View>
          <AppText variant="headline">{t('auth.reset.title')}</AppText>
          <AppText tone="muted">{t('auth.reset.subtitle')}</AppText>
        </View>

        {errorReason ? (
          <Banner title={t(RECOVERY_ERROR_COPY[errorReason].title)} tone="error">
            {t(RECOVERY_ERROR_COPY[errorReason].body)}
          </Banner>
        ) : null}

        {/*
          Three states, not two. `undefined` is "not captured yet" — the
          neutral shape the Web prerender and the hydrating client both
          render, which is what keeps hydration matching. It resolves to a
          token or to null on the first post-hydration render.
        */}
        {token === undefined ? null : token === null ? (
          <>
            <Banner title={t('auth.reset.missingTokenTitle')} tone="error">
              {t('auth.reset.missingTokenBody')}
            </Banner>
            <AppButton
              onPress={() => router.replace('/forgot-password')}
              testID="button-reset-request-new"
            >
              {t('auth.reset.requestNewLink')}
            </AppButton>
          </>
        ) : done ? (
          <>
            <Banner title={t('auth.reset.successTitle')} tone="success">
              {t('auth.reset.successBody')}
            </Banner>
            <AppButton onPress={() => router.replace('/sign-in')} testID="button-reset-sign-in">
              {t('auth.reset.goToSignIn')}
            </AppButton>
          </>
        ) : (
          <Card>
            <View style={{ gap: theme.spacing.md }}>
              <AuthTextField
                label={t('auth.reset.newPassword')}
                testID="input-new-password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                error={passwordError ?? undefined}
              />
              <AuthTextField
                label={t('auth.reset.confirmPassword')}
                testID="input-confirm-password"
                value={confirmation}
                onChangeText={setConfirmation}
                secureTextEntry
                error={confirmationError ?? undefined}
              />
              <AppButton
                loading={loading}
                onPress={() => void submit()}
                testID="button-reset-submit"
              >
                {t('auth.reset.submit')}
              </AppButton>
            </View>
          </Card>
        )}
      </View>
    </Screen>
  );
}
