import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { signIn, signUp } from '@/features/authentication';
import { AppButton, AppText, Banner, Card, Screen } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

export default function SignInScreen() {
  const theme = useTheme();
  const [mode, setMode] = useState<'sign-in' | 'register'>('sign-in');
  const [email, setEmail] = useState('demo@appfitness.local');
  const [username, setUsername] = useState('demo');
  const [password, setPassword] = useState('password12345');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'register') {
        await signUp({ email, username, password });
      } else {
        await signIn({ email, password });
      }
      router.replace('/dashboard');
    } catch {
      setError('Authentication failed. Check the local API and credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll={false}>
      <Stack.Screen options={{ title: 'Sign in' }} />
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.lg }}>
        <View>
          <AppText variant="headline">AppFitness</AppText>
          <AppText tone="muted">Minimal development sign-in for dashboard validation.</AppText>
        </View>

        {error ? (
          <Banner title="Sign-in error" tone="error">
            {error}
          </Banner>
        ) : null}

        <Card>
          <View style={{ gap: theme.spacing.md }}>
            <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
            {mode === 'register' ? (
              <Input label="Username" value={username} onChangeText={setUsername} />
            ) : null}
            <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry />
            <AppButton loading={loading} onPress={() => void submit()}>
              {mode === 'register' ? 'Register' : 'Sign in'}
            </AppButton>
            <AppButton
              accessibilityLabel="Switch authentication mode"
              onPress={() => setMode(mode === 'register' ? 'sign-in' : 'register')}
              variant="text"
            >
              {mode === 'register' ? 'Use existing account' : 'Create a local account'}
            </AppButton>
          </View>
        </Card>
      </View>
    </Screen>
  );
}

interface InputProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'email-address';
  secureTextEntry?: boolean;
}

function Input({
  label,
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

