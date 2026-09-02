import { Stack, router } from 'expo-router';
import { useState } from 'react';
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

  const submit = async () => {
    setLoading(true);
    setErrorReason(null);
    try {
      if (mode === 'register') {
        await signUp({ email, username, password });
      } else {
        await signIn({ email, password });
      }
      router.replace('/dashboard');
    } catch (error) {
      // Only the typed, safe reason is used — never the raw error/message.
      setErrorReason(error instanceof AuthError ? error.reason : 'unexpected');
    } finally {
      setLoading(false);
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
