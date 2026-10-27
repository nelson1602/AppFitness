import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';

import { EmailVerificationError, signOut, useSession } from '@/features/authentication';
import {
  confirmEmailVerified,
  requiredAccessStep,
  resendVerificationEmail,
} from '@/features/authentication/application/access-gate';
import { AuthScreen } from '@/features/authentication/presentation/auth-screen';
import { type TranslationKey, useLocalization } from '@/shared/localization';
import { interpolate } from '@/shared/localization/format';
import { AppButton, AppText, Banner, GlassCard, Mascot } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

/** Seconds between resends; well inside the server's 5-per-hour ceiling. */
export const RESEND_COOLDOWN_SECONDS = 60;

type Notice = {
  tone: 'success' | 'error' | 'warning';
  title: TranslationKey;
  body: TranslationKey;
} | null;

const RESENT: Notice = {
  tone: 'success',
  title: 'auth.verify.resentTitle',
  body: 'auth.verify.resentBody',
};
const RESEND_FAILED: Notice = {
  tone: 'error',
  title: 'auth.verify.resendFailedTitle',
  body: 'auth.verify.resendFailedBody',
};
const NOT_YET: Notice = {
  tone: 'warning',
  title: 'auth.pending.notYetTitle',
  body: 'auth.pending.notYetBody',
};
const CHECK_FAILED: Notice = {
  tone: 'error',
  title: 'auth.pending.checkFailedTitle',
  body: 'auth.pending.checkFailedBody',
};

/**
 * "Verifica tu correo" — the mandatory verification step (ADR-P041 D2).
 *
 * A signed-in account without a verified address sees only this screen. It
 * names the address the link went to and offers three ways forward: resend
 * the link, confirm after opening it ("Ya lo verifiqué"), or sign out to use
 * another account. Coming back to the app from the mail client re-checks
 * quietly, so opening the link is usually enough.
 */
export default function VerifyPendingScreen() {
  const theme = useTheme();
  const { t, language } = useLocalization();
  const { status, session } = useSession();
  // Sign-up has just sent the first email; don't offer an immediate second one.
  const { sent } = useLocalSearchParams<{ sent?: string }>();
  const [cooldown, setCooldown] = useState(sent === '1' ? RESEND_COOLDOWN_SECONDS : 0);
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  /** "Ya lo verifiqué": the explicit check, which reports what it found. */
  const confirm = async () => {
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    setNotice(null);
    try {
      if (await confirmEmailVerified()) {
        router.replace('/dashboard');
        return;
      }
      setNotice(NOT_YET);
    } catch {
      setNotice(CHECK_FAILED);
    } finally {
      busy.current = false;
      setChecking(false);
    }
  };

  // The link is opened in the mail app or browser; on mount and on every
  // return to the app the account is re-checked silently — it only ever
  // moves on, never shows "not yet".
  useEffect(() => {
    const quietCheck = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        if (await confirmEmailVerified()) router.replace('/dashboard');
      } catch {
        // Silent by design: the explicit button reports failures.
      } finally {
        busy.current = false;
      }
    };
    void quietCheck();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void quietCheck();
    });
    return () => subscription.remove();
  }, []);

  const resend = async () => {
    if (busy.current || cooldown > 0) return;
    busy.current = true;
    setResending(true);
    setNotice(null);
    try {
      await resendVerificationEmail(language);
      setNotice(RESENT);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      // Rate limiting is still "a link is on its way" from the person's view:
      // the server answers the same for every accepted request.
      const limited = error instanceof EmailVerificationError && error.reason === 'rate-limited';
      setNotice(limited ? RESENT : RESEND_FAILED);
      if (limited) setCooldown(RESEND_COOLDOWN_SECONDS);
    } finally {
      busy.current = false;
      setResending(false);
    }
  };

  if (status === 'unauthenticated' || (status === 'authenticated' && !session)) {
    return <Redirect href="/sign-in" />;
  }
  if (session && requiredAccessStep(session.user) === 'app') return <Redirect href="/dashboard" />;

  return (
    <AuthScreen>
      <Stack.Screen options={{ headerShown: false, title: t('auth.pending.screenTitle') }} />
      <View style={{ gap: theme.spacing.lg }} testID="verify-pending">
        <View style={{ alignItems: 'center' }}>
          <Mascot size={132} testID="verify-pending-mascot" variant="solo" />
        </View>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText accessibilityRole="header" tone="onStage" variant="headline">
            {t('auth.pending.title')}
          </AppText>
          <AppText tone="onStageVariant">{t('auth.pending.sentTo')}</AppText>
          <AppText testID="verify-pending-email" tone="onStage" variant="label">
            {session?.user.email ?? ''}
          </AppText>
          <AppText testID="verify-pending-body" tone="onStageVariant">
            {t('auth.pending.body')}
          </AppText>
        </View>

        {notice ? (
          <View testID="verify-pending-notice">
            <Banner title={t(notice.title)} tone={notice.tone}>
              {t(notice.body)}
            </Banner>
          </View>
        ) : null}

        <GlassCard testID="verify-pending-card">
          <View style={{ gap: theme.spacing.md }}>
            <AppText tone="onStageVariant">{t('auth.pending.hint')}</AppText>
            <AppButton
              loading={checking}
              onPress={() => void confirm()}
              style={{ borderRadius: theme.radius.large, minHeight: theme.spacing.x6l }}
              testID="button-verify-confirm"
            >
              {t('auth.pending.confirm')}
            </AppButton>
            <AppButton
              disabled={cooldown > 0}
              loading={resending}
              onPress={() => void resend()}
              style={{ borderRadius: theme.radius.large }}
              testID="button-verify-resend"
              variant="stage-secondary"
            >
              {cooldown > 0
                ? interpolate(t('auth.pending.resendIn'), { seconds: String(cooldown) })
                : t('auth.pending.resend')}
            </AppButton>
            <AppButton
              onPress={() => {
                void signOut().then(() => router.replace('/sign-in'));
              }}
              testID="button-verify-switch-account"
              variant="stage-link"
            >
              {t('auth.pending.switchAccount')}
            </AppButton>
          </View>
        </GlassCard>
      </View>
    </AuthScreen>
  );
}
