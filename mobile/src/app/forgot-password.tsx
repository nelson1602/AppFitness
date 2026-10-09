import { Stack, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import {
  PasswordRecoveryError,
  type PasswordRecoveryErrorReason,
  requestPasswordReset,
} from '@/features/authentication';
import { AuthTextField } from '@/features/authentication/presentation/auth-text-field';
import { RECOVERY_ERROR_COPY } from '@/features/authentication/presentation/recovery-error-copy';
import { useLocalization } from '@/shared/localization';
import { AppButton, AppText, Banner, Card, Screen } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

/**
 * Request a password-reset email (ADR-P026 Vertical 1).
 *
 * The confirmation state is identical whether or not the address belongs to an
 * account — the server is enumeration-resistant, and this screen must not undo
 * that by showing "no such account". Only a genuine transport-level failure
 * (offline, rate limited, mail disabled) produces a different state.
 */
export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const { t, language } = useLocalization();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorReason, setErrorReason] = useState<PasswordRecoveryErrorReason | null>(null);
  // A ref, not `loading`: two quick Enter presses both run before React
  // re-renders with `loading`, so state alone cannot stop a second request.
  const inFlight = useRef(false);
  const backRef = useRef<View>(null);

  // BUG-035 (Web): on success the form, and the focused control with it,
  // unmounts. Focus moves to the next action instead of falling to the page.
  useEffect(() => {
    if (sent && Platform.OS === 'web') backRef.current?.focus();
  }, [sent]);

  const submit = async () => {
    if (inFlight.current) return;
    const trimmed = email.trim();
    if (trimmed === '') {
      setFieldError(t('auth.forgot.emailRequired'));
      return;
    }

    setFieldError(null);
    setErrorReason(null);
    inFlight.current = true;
    setLoading(true);
    try {
      await requestPasswordReset({ email: trimmed, locale: language });
      setSent(true);
    } catch (error) {
      // Only the typed, safe reason is used — never the raw error/message.
      setErrorReason(error instanceof PasswordRecoveryError ? error.reason : 'unexpected');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('auth.forgot.screenTitle') }} />
      <View style={{ gap: theme.spacing.lg }}>
        <View>
          <AppText variant="headline">{t('auth.forgot.title')}</AppText>
          <AppText tone="muted">{t('auth.forgot.subtitle')}</AppText>
        </View>

        {errorReason ? (
          <Banner title={t(RECOVERY_ERROR_COPY[errorReason].title)} tone="error">
            {t(RECOVERY_ERROR_COPY[errorReason].body)}
          </Banner>
        ) : null}

        {sent ? (
          <Banner title={t('auth.forgot.sentTitle')} tone="success">
            {t('auth.forgot.sentBody')}
          </Banner>
        ) : (
          <Card>
            <View style={{ gap: theme.spacing.md }}>
              <AuthTextField
                label={t('auth.email')}
                testID="input-forgot-email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                error={fieldError ?? undefined}
                onWebSubmit={() => void submit()}
              />
              <AppButton
                loading={loading}
                onPress={() => void submit()}
                testID="button-forgot-submit"
              >
                {t('auth.forgot.submit')}
              </AppButton>
            </View>
          </Card>
        )}

        <AppButton
          accessibilityLabel={t('auth.forgot.backToSignIn')}
          onPress={() => router.replace('/sign-in')}
          ref={backRef}
          testID="button-forgot-back"
          variant="text"
        >
          {t('auth.forgot.backToSignIn')}
        </AppButton>
      </View>
    </Screen>
  );
}
