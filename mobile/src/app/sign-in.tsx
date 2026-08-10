import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { signIn, signUp } from '@/features/authentication';
import { LanguageSelector, useLocalization } from '@/shared/localization';
import { AppButton, AppText, Banner, Card, Screen } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

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
  const [authenticationFailed, setAuthenticationFailed] = useState(false);

  const submit = async () => {
    setLoading(true);
    setAuthenticationFailed(false);
    try {
      if (mode === 'register') {
        await signUp({ email, username, password });
      } else {
        await signIn({ email, password });
      }
      router.replace('/dashboard');
    } catch {
      setAuthenticationFailed(true);
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

        {authenticationFailed ? (
          <Banner title={t('auth.errorTitle')} tone="error">
            {t('auth.errorMessage')}
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
      <TextInput
        accessibilityLabel={label}
        testID={testID}
        autoCapitalize="none"
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        style={{
          backgroundColor: theme.colors.surfaceVariant,
          borderColor: theme.colors.outline,
          borderRadius: theme.radius.medium,
          borderWidth: 1,
          color: theme.colors.onSurface,
          minHeight: theme.spacing.x5l,
          paddingHorizontal: theme.spacing.md,
          ...theme.typography.body,
        }}
        value={value}
      />
    </View>
  );
}
