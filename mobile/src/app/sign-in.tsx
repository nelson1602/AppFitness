import { Stack, router } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import { AuthError, type AuthErrorReason, signIn, signUp } from '@/features/authentication';
import { LanguageSelector, type TranslationKey, useLocalization } from '@/shared/localization';
import { AppButton, AppText, AppTextInput, Banner, Card, Screen } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

// Reason → localized banner copy (Slice 2B4). Distinct, honest, non-enumerating
// messages; raw errors/tokens/server details are never shown.
const ERROR_COPY: Record<AuthErrorReason, { title: TranslationKey; body: TranslationKey }> = {
  'invalid-credentials': {
    title: 'auth.error.invalidCredentialsTitle',
    body: 'auth.error.invalidCredentialsBody',
  },
  'registration-unavailable': {
    title: 'auth.error.registrationTitle',
    body: 'auth.error.registrationBody',
  },
  connectivity: { title: 'auth.error.connectivityTitle', body: 'auth.error.connectivityBody' },
  server: { title: 'auth.error.serverTitle', body: 'auth.error.serverBody' },
  unexpected: { title: 'auth.error.unexpectedTitle', body: 'auth.error.unexpectedBody' },
};

export default function SignInScreen() {
  const theme = useTheme();
  const { t } = useLocalization();
  const [mode, setMode] = useState<'sign-in' | 'register'>('sign-in');
  // Release-visible surface: fields start empty — never prefilled
  // credentials (10_DEPLOYMENT.md: "No test credentials included").
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorReason, setErrorReason] = useState<AuthErrorReason | null>(null);
  /**
   * Which submission this screen currently owns (ADR-P030 C-1).
   *
   * `superseded` says the session layer discarded the attempt, but not why: it
   * may be a newer submission from this screen, or something external such as a
   * sign-out. Returning early without clearing `loading` was therefore unsafe —
   * an external supersession left the form spinning forever with no attempt
   * left to clear it. Ownership is what decides: the latest submission owns
   * `loading`, whatever the outcome, and an older one may never touch it.
   */
  const submissionRef = useRef(0);

  const submit = async () => {
    const submission = submissionRef.current + 1;
    submissionRef.current = submission;
    const ownsScreen = () => submissionRef.current === submission;

    setLoading(true);
    setErrorReason(null);
    try {
      const outcome =
        mode === 'register'
          ? await signUp({ email, username, password })
          : await signIn({ email, password });
      // The session layer replaced this attempt. Never navigate and never show
      // an error for it — a superseded attempt acted for an account the user no
      // longer asked for.
      if (outcome.status === 'superseded') return;
      router.replace('/dashboard');
    } catch (error) {
      // Only the typed, safe reason is used — never the raw error/message. A
      // superseded attempt never throws, so no stale banner can appear here;
      // and an older submission's failure must not overwrite a newer one.
      if (!ownsScreen()) return;
      setErrorReason(error instanceof AuthError ? error.reason : 'unexpected');
    } finally {
      // Cleared for every outcome — including `superseded`, so an external
      // sign-out cannot strand the spinner — but only by the submission that
      // still owns the screen.
      if (ownsScreen()) setLoading(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('auth.screenTitle') }} />
      <View style={{ gap: theme.spacing.lg }}>
        <View>
          <AppText variant="headline">AppFitness</AppText>
          <AppText tone="muted">{t('auth.subtitle')}</AppText>
        </View>

        {errorReason ? (
          <Banner title={t(ERROR_COPY[errorReason].title)} tone="error">
            {t(ERROR_COPY[errorReason].body)}
          </Banner>
        ) : null}

        <Card>
          <View style={{ gap: theme.spacing.md }}>
            <Input
              label={t('auth.email')}
              testID="input-email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
            {mode === 'register' ? (
              <Input
                label={t('auth.username')}
                testID="input-username"
                value={username}
                onChangeText={setUsername}
              />
            ) : null}
            <Input
              label={t('auth.password')}
              testID="input-password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <AppButton loading={loading} onPress={() => void submit()}>
              {mode === 'register' ? t('auth.register') : t('auth.signIn')}
            </AppButton>
            <AppButton
              accessibilityLabel={t('auth.switchMode')}
              onPress={() => setMode(mode === 'register' ? 'sign-in' : 'register')}
              variant="text"
            >
              {mode === 'register' ? t('auth.useExistingAccount') : t('auth.createAccount')}
            </AppButton>
            {mode === 'sign-in' ? (
              // Recovery entry point (ADR-P026 Vertical 1). Sign-in only: there
              // is nothing to recover while creating an account.
              <AppButton
                accessibilityLabel={t('auth.forgotPassword')}
                onPress={() => router.push('/forgot-password')}
                testID="button-forgot-password"
                variant="text"
              >
                {t('auth.forgotPassword')}
              </AppButton>
            ) : null}
          </View>
        </Card>
        <LanguageSelector />
      </View>
    </Screen>
  );
}

interface InputProps {
  label: string;
  testID: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'email-address';
  secureTextEntry?: boolean;
}

function Input({
  label,
  testID,
  value,
  onChangeText,
  keyboardType = 'default',
  secureTextEntry = false,
}: InputProps) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText variant="label">{label}</AppText>
      <AppTextInput
        accessibilityLabel={label}
        testID={testID}
        autoCapitalize="none"
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        value={value}
      />
    </View>
  );
}
