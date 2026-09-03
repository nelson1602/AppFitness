import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';

import { EmailVerificationError, useSession, verifyEmail } from '@/features/authentication';
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
import { AppButton, Banner, Screen } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

/**
 * Email-verification landing (ADR-P026 Vertical 2, V2-D).
 *
 * **Web-first and session-agnostic.** This is the fallback that makes an
 * emailed link work when the app is absent (Decision 13), and it may be opened
 * with a session or without one, on the registering device or another — so it
 * must never assume either (V2-B). It holds no address and **cannot resend**:
 * resend lives only on the authenticated dashboard reminder.
 *
 * **Redeeming does not authenticate.** The endpoint sets `emailVerifiedAt` and
 * answers 204 with no tokens; no session is created, extended or restored here.
 * `Continue` therefore goes to the dashboard only when a session *already*
 * exists, and to sign-in otherwise.
 *
 * Token handling mirrors the shipped `/reset-password` route for the same
 * reasons — see `reset-link.ts` (why the fragment) and the scrub loop below
 * (why re-asserting is necessary).
 */

/**
 * How long to keep re-asserting the scrubbed URL after mount.
 *
 * Expo Router canonicalizes `location` shortly after mount and re-appends the
 * fragment it was navigated with, which silently undoes a single `replaceState`
 * — the exact behaviour observed on `/reset-password` in a real browser.
 * Re-running the scrub on a few later ticks lets our write land last. Bounded
 * and self-cancelling.
 */
const SCRUB_RETRY_DELAYS_MS = [0, 60, 250, 600];

/** What the redemption request itself resolved to. */
type RedemptionResult = 'pending' | 'success' | 'invalid' | 'error';

/** What the screen renders — derived, never stored. */
type VerifyState = 'checking' | 'success' | 'missing-token' | 'invalid' | 'error';

/**
 * Derive the rendered state from the captured token and the request result.
 *
 * Deriving rather than storing keeps "no token" out of the effect entirely —
 * it is a property of the input, not an event — so the effect only ever runs
 * the request. Pure, so the mapping is unit-testable on its own.
 */
export function resolveVerifyState(
  token: string | null | undefined,
  result: RedemptionResult,
): VerifyState {
  // 'undefined' is the hydrating render: neutral, not yet a missing token.
  if (token === undefined) return 'checking';
  if (token === null) return 'missing-token';
  return result === 'pending' ? 'checking' : result;
}

/**
 * Capture the verification token once, from whichever shape delivered it.
 *
 * Fragment first (the emailed HTTPS link on the account host), then the
 * router's `token` query parameter (the native `appfitness://` scheme).
 */
export function captureVerificationToken(
  routerParam: string | string[] | undefined,
): string | null {
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
 * `replaceState`, not `pushState`: the credential must not be left in the
 * address bar, the back-stack, or anything that later reads `document.URL` (an
 * analytics snippet, a crash reporter, a shared screenshot). It never reached a
 * server — a fragment is not part of the request — so this closes the remaining
 * client-side exposure. No-op on native and when there is nothing to strip.
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
 * Resolve the token safely for the prerendered Web build.
 *
 * The Web export is prerendered in Node, where no `location` exists, so a
 * render-phase read would make the client's first output differ from the
 * prerendered HTML — a real hydration mismatch (React #418). `useSyncExternalStore`
 * renders the *server* snapshot (`undefined`, the neutral pre-capture state)
 * while hydrating, then switches to the client snapshot. On native there is no
 * hydration, so the token is present on the first render.
 */
function useCapturedVerificationToken(routerToken: string | null): string | null | undefined {
  const cached = useRef<{ value: string | null } | undefined>(undefined);
  const getSnapshot = useCallback((): string | null => {
    cached.current ??= { value: captureVerificationToken(routerToken ?? undefined) };
    return cached.current.value;
  }, [routerToken]);

  return useSyncExternalStore<string | null | undefined>(
    NO_STORE_SUBSCRIPTION,
    getSnapshot,
    () => undefined,
  );
}

export default function VerifyEmailScreen() {
  const theme = useTheme();
  const { t } = useLocalization();
  const { status } = useSession();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const routerToken = readTokenParam(params.token);

  const token = useCapturedVerificationToken(routerToken);
  const [result, setResult] = useState<RedemptionResult>('pending');
  const attempted = useRef(false);
  const state = resolveVerifyState(token, result);

  useEffect(() => {
    // The capture already happened during render; now take the credential out
    // of the address bar, re-asserting it until the router stops overwriting.
    clearTokenFromUrl();
    const timers = SCRUB_RETRY_DELAYS_MS.map((delay) => setTimeout(clearTokenFromUrl, delay));
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    // `undefined` is "not captured yet" (hydrating) and `null` is a missing
    // token — both are rendered states derived above, so the effect has nothing
    // to do for either. It exists only to run the request, exactly once.
    if (token === undefined || token === null) return;
    if (attempted.current) return;
    attempted.current = true;

    void (async () => {
      try {
        await verifyEmail({ token });
        setResult('success');
      } catch (error) {
        // Only the typed, safe reason is read — never the raw error, and never
        // the token. A rejected token is one indistinguishable outcome by
        // contract: expired, already used and unrecognised all land here.
        const reason = error instanceof EmailVerificationError ? error.reason : 'unexpected';
        setResult(reason === 'invalid-verification-token' ? 'invalid' : 'error');
      }
    })();
  }, [token]);

  const authenticated = status === 'authenticated';

  /**
   * Frozen navigation (V2-B): dashboard when a session already exists, sign-in
   * otherwise — on success and on failure alike. Redeeming created no session,
   * so an unauthenticated visitor still has to sign in.
   */
  const goOnwards = () => router.replace(authenticated ? '/dashboard' : '/sign-in');

  const onwardLabel = authenticated ? t('auth.verify.continue') : t('auth.verify.goToSignIn');

  return (
    <Screen>
      <Stack.Screen options={{ title: t('auth.verify.screenTitle') }} />
      <View style={{ gap: theme.spacing.lg }} testID="verify-email-screen">
        {state === 'checking' ? (
          <View testID="verify-checking">
            <Banner title={t('auth.verify.checkingTitle')} tone="info">
              {t('auth.verify.checkingBody')}
            </Banner>
          </View>
        ) : null}

        {state === 'success' ? (
          <>
            <View testID="verify-success">
              <Banner title={t('auth.verify.successTitle')} tone="success">
                {t('auth.verify.successBody')}
              </Banner>
            </View>
            {/* Success always offers Continue; only its destination varies. */}
            <AppButton
              onPress={goOnwards}
              testID="button-verify-continue"
              accessibilityLabel={t('auth.verify.continue')}
            >
              {t('auth.verify.continue')}
            </AppButton>
          </>
        ) : null}

        {state === 'missing-token' ? (
          <View testID="verify-missing-token">
            <Banner title={t('auth.verify.missingTokenTitle')} tone="error">
              {t('auth.verify.missingTokenBody')}
            </Banner>
          </View>
        ) : null}

        {state === 'invalid' ? (
          <View testID="verify-invalid">
            <Banner title={t('auth.verify.invalidTitle')} tone="error">
              {t('auth.verify.invalidBody')}
            </Banner>
          </View>
        ) : null}

        {state === 'error' ? (
          <View testID="verify-error">
            <Banner title={t('auth.verify.errorTitle')} tone="error">
              {t('auth.verify.errorBody')}
            </Banner>
          </View>
        ) : null}

        {/*
          One conditional action for every failure arm (V2-B): `continue` to the
          dashboard when a session exists, `goToSignIn` otherwise. This surface
          never resends — it holds no address.
        */}
        {state === 'missing-token' || state === 'invalid' || state === 'error' ? (
          <AppButton
            onPress={goOnwards}
            testID="button-verify-onward"
            accessibilityLabel={onwardLabel}
          >
            {onwardLabel}
          </AppButton>
        ) : null}
      </View>
    </Screen>
  );
}
