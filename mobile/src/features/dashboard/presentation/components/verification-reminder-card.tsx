import { useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';

import {
  dismissReminder,
  dismissedUserSnapshot,
  resendVerification,
  subscribeToReminder,
  useSession,
} from '@/features/authentication';
import { useLocalization, type TranslationKey } from '@/shared/localization';
import { AppButton, Banner } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

/**
 * Dashboard verification reminder (ADR-P026 Vertical 2, V2-D).
 *
 * **Advisory, never a gate.** The soft gate (Decision 11) means an unverified
 * user keeps full core access: this blocks no navigation, disables no control
 * and replaces no content. An unverified and a verified user differ only by the
 * presence of this card, and its tone is `info` — never `warning` or `error`,
 * because nothing is broken.
 *
 * **Shown only while `emailVerifiedAt` is null** and the user has not dismissed
 * it in the current session. Dismissal is in-memory and tied to the
 * authenticated session — cleared on sign-out, session loss or app restart, and
 * never written to SQLite or sent to the server (V2-B state matrix).
 *
 * **Resend sends no address.** It calls the authenticated endpoint, which acts
 * on the account behind the bearer token. Every accepted outcome — dispatched,
 * already verified, a provider failure, or the per-account ceiling — answers
 * one identical 202, so this shows one acknowledgement for all of them. Every
 * failure shows the single frozen failure pair, because the deck deliberately
 * provides only one: a per-status message would turn the reminder into a probe.
 */

type ResendState = 'idle' | 'sending' | 'sent' | 'failed';

export function VerificationReminderCard() {
  const theme = useTheme();
  const { t, language } = useLocalization();
  const { status, session } = useSession();
  const [resend, setResend] = useState<ResendState>('idle');

  const dismissedUserId = useSyncExternalStore(
    subscribeToReminder,
    dismissedUserSnapshot,
    dismissedUserSnapshot,
  );

  const user = session?.user;
  // An absent `emailVerifiedAt` (a session persisted by an older build) reads
  // as unverified — the safe default is to show the advisory, not hide it.
  const verified = user?.emailVerifiedAt != null;

  if (status !== 'authenticated' || !user) return null;
  if (verified) return null;
  if (dismissedUserId === user.id) return null;

  const send = async () => {
    setResend('sending');
    try {
      await resendVerification({ locale: language });
      setResend('sent');
    } catch {
      // The typed reason is deliberately not branched on: the frozen copy has
      // one failure message, and distinguishing 429 from 503 here would leak
      // account/throttle state into the UI for no user benefit.
      setResend('failed');
    }
  };

  const outcome: { title: TranslationKey; body: TranslationKey } | null =
    resend === 'sent'
      ? { title: 'auth.verify.resentTitle', body: 'auth.verify.resentBody' }
      : resend === 'failed'
        ? { title: 'auth.verify.resendFailedTitle', body: 'auth.verify.resendFailedBody' }
        : null;

  return (
    <View style={{ gap: theme.spacing.sm }} testID="verification-reminder">
      <Banner title={t('auth.verify.reminderTitle')} tone="info">
        {t('auth.verify.reminderBody')}
      </Banner>

      {outcome ? (
        <View
          testID={resend === 'sent' ? 'verification-resend-sent' : 'verification-resend-failed'}
        >
          <Banner title={t(outcome.title)} tone={resend === 'sent' ? 'success' : 'error'}>
            {t(outcome.body)}
          </Banner>
        </View>
      ) : null}

      <AppButton
        loading={resend === 'sending'}
        onPress={() => void send()}
        testID="button-verification-resend"
        accessibilityLabel={t('auth.verify.reminderResend')}
        variant="secondary"
      >
        {resend === 'sending' ? t('auth.verify.resendSending') : t('auth.verify.reminderResend')}
      </AppButton>

      <AppButton
        onPress={() => dismissReminder(user.id)}
        testID="button-verification-dismiss"
        accessibilityLabel={t('auth.verify.reminderDismissAccessibility')}
        variant="text"
      >
        {t('auth.verify.reminderDismiss')}
      </AppButton>
    </View>
  );
}
