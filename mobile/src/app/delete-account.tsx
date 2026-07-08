import { Redirect, Stack, router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { deleteAccount, useSession } from '@/features/authentication';
import { AppButton, AppText, Banner, Card, Screen } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

const CONFIRM_PHRASE = 'DELETE';

/**
 * Minimal, guarded account-deletion surface (ADR-P011 / Step 6B).
 * Deletion is immediate and irreversible (v1 — no recovery window), so
 * it is gated behind a typed confirmation phrase. Calls the existing
 * `deleteAccount()` use case, which deletes server-side then wipes the
 * local session + database; the session guard returns to sign-in.
 */
export default function DeleteAccountScreen() {
  const theme = useTheme();
  const { status } = useSession();
  const [phrase, setPhrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'unauthenticated') return <Redirect href="/sign-in" />;

  const confirmed = phrase.trim() === CONFIRM_PHRASE;

  const submit = async () => {
    if (!confirmed) return;
    setLoading(true);
    setError(null);
    try {
      await deleteAccount();
      router.replace('/sign-in');
    } catch {
      setError('We could not delete your account. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Screen scroll={false}>
      <Stack.Screen options={{ title: 'Delete account' }} />
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="headline">Delete account</AppText>
          <AppText tone="muted">
            This permanently deletes your account and all your data. This cannot be undone.
          </AppText>
        </View>

        {error ? (
          <Banner title="Deletion failed" tone="error">
            {error}
          </Banner>
        ) : null}

        <Card>
          <View style={{ gap: theme.spacing.md }}>
            <AppText variant="label">Type {CONFIRM_PHRASE} to confirm</AppText>
            <TextInput
              accessibilityLabel="Deletion confirmation phrase"
              testID="input-confirm-phrase"
              autoCapitalize="characters"
              autoCorrect={false}
              onChangeText={setPhrase}
              value={phrase}
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
            />
            <AppButton
              accessibilityLabel="Permanently delete account"
              disabled={!confirmed}
              loading={loading}
              onPress={() => void submit()}
              variant="destructive"
            >
              Delete my account
            </AppButton>
            <AppButton
              accessibilityLabel="Cancel account deletion"
              onPress={() => router.back()}
              variant="text"
            >
              Cancel
            </AppButton>
          </View>
        </Card>
      </View>
    </Screen>
  );
}
