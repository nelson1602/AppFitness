import { Redirect, Stack, router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { deleteAccount, useSession } from '@/features/authentication';
import { useLocalization } from '@/shared/localization';
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
  const { t } = useLocalization();
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
      setError(t('account.delete.errorMessage'));
      setLoading(false);
    }
  };

  return (
    <Screen scroll={false}>
      <Stack.Screen options={{ title: t('account.delete.screenTitle') }} />
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="headline">{t('account.delete.title')}</AppText>
          <AppText tone="muted">{t('account.delete.description')}</AppText>
        </View>

        {error ? (
          <Banner title={t('account.delete.errorTitle')} tone="error">
            {error}
          </Banner>
        ) : null}

        <Card>
          <View style={{ gap: theme.spacing.md }}>
            <AppText variant="label">
              {t('account.delete.confirmInstruction').replace('{phrase}', CONFIRM_PHRASE)}
            </AppText>
            <TextInput
              accessibilityLabel={t('account.delete.confirmationAccessibility')}
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
              accessibilityLabel={t('account.delete.deleteAccessibility')}
              disabled={!confirmed}
              loading={loading}
              onPress={() => void submit()}
              variant="destructive"
            >
              {t('account.delete.deleteButton')}
            </AppButton>
            <AppButton
              accessibilityLabel={t('account.delete.cancelAccessibility')}
              onPress={() => router.back()}
              variant="text"
            >
              {t('account.delete.cancel')}
            </AppButton>
          </View>
        </Card>
      </View>
    </Screen>
  );
}
