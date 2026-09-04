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
 * The one redemption this page has attempted, keyed by the token it used.
 *
 * **Why this exists.** A verification token is single-use server-side, so it
 * may be redeemed exactly once. On Web, hydration and Expo Router can mount
 * this screen more than once for the same page load; the previous
 * `useRef` guard was instance-scoped and did not survive that, so the second
 * mount redeemed again, the server correctly rejected the already-consumed
 * token with a 400, and a genuinely successful verification was overwritten by
 * "This link is no longer valid".
 *
 * **What this changes — and what it deliberately does not.** Only the client
 * stops asking twice. Server single-use semantics are untouched: a token still
 * redeems once, a rejection is still a rejection, and no failure is ever
 * converted into a success. This is deduplication, not a retry and not a cache
 * of authority.
 *
 * **Bounded by construction.** Exactly one slot. A different token replaces it,
 * so nothing accumulates. It lives in module memory for the current JavaScript
 * page lifecycle only — never SecureStore, SQLite, `localStorage`,
 * `sessionStorage` or any other browser storage — so a real page load starts
 * clean and the raw token never outlives the tab.
 *
 * The stored promise **resolves** to an outcome and never rejects, so every
 * later mount reads the first attempt's verdict rather than re-deriving it.
 */
let redemption: { token: string; outcome: Promise<RedemptionResult> } | null = null;

/**
 * Redeem `token` once per page lifecycle, reusing the in-flight or settled
 * attempt when the same token is presented again.
 *
 * Reuse covers both races the remount creates: a second mount arriving while
 * the first request is still open (it awaits the same promise, so the API is
 * called once), and one arriving after it settled (it reads the same verdict).
 *
 * Exported as a seam so the deduplication contract can be asserted directly and
 * deterministically, without depending on a test renderer to mount twice.
 */
export function redeemOnce(token: string): Promise<RedemptionResult> {
  if (redemption !== null && redemption.token === token) return redemption.outcome;

  const outcome = verifyEmail({ token }).then(
    (): RedemptionResult => 'success',
    (error: unknown): RedemptionResult => {
      // Only the typed, safe reason is read — never the raw error, and never
      // the token. A rejected token is one indistinguishable outcome by
      // contract: expired, already used and unrecognised all land here.
      const reason = error instanceof EmailVerificationError ? error.reason : 'unexpected';
      return reason === 'invalid-verification-token' ? 'invalid' : 'error';
    },
  );

  redemption = { token, outcome };
  return outcome;
}

/**
 * Clear the page-lifecycle memo. **Test seam only** — production code relies on
 * a real page load to reset it, which is exactly the boundary the memo is
 * scoped to.
 */
export function resetRedemptionMemo(): void {
  redemption = null;
}

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
    // to do for either. It exists only to obtain the verdict for a real token.
    if (token === undefined || token === null) return;

    // Deduplicated across mounts by `redeemOnce`, so a hydration/router remount
    // reads the first attempt's verdict instead of redeeming a spent token and
    // turning a real success into "no longer valid".
    let active = true;
    void redeemOnce(token).then((outcome) => {
      // A mount that unmounted mid-flight must not write state; the memo keeps
      // the verdict for whichever mount is still alive to read it.
      if (active) setResult(outcome);
    });
    return () => {
      active = false;
    };
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
