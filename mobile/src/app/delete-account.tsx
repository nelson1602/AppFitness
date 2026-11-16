import { Redirect, Stack, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  DeleteAccountError,
  type DeleteAccountErrorReason,
  deleteAccount,
  useSession,
} from '@/features/authentication';
import { type TranslationKey, useLocalization } from '@/shared/localization';
import { AppButton, AppText, AppTextInput, Banner, Card, StageScreen } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

const CONFIRM_PHRASE = 'DELETE';

// ADR-P047 D2: what each refusal tells the person. Never raw server text.
const ERROR_COPY: Record<DeleteAccountErrorReason, TranslationKey> = {
  'wrong-password': 'account.delete.error.wrongPassword',
  locked: 'account.delete.error.locked',
  'session-ended': 'account.delete.error.sessionEnded',
  connectivity: 'account.delete.error.connectivity',
  server: 'account.delete.errorMessage',
};

const RETAIN_ITEMS = [
  'account.delete.retain.plan',
  'account.delete.retain.history',
  'account.delete.retain.logs',
] as const;

/**
 * Minimal, guarded account-deletion surface (ADR-P011 / Step 6B).
 * Deletion is immediate and irreversible (v1 — no recovery window), so
 * it is gated behind a typed confirmation phrase and, since ADR-P046/P047, the
 * current password. Calls the `deleteAccount()` use case, which deletes
 * server-side then wipes the local session + database; the session guard
 * returns to sign-in. The password lives in component state only and is
 * cleared after a refusal.
 */
export default function DeleteAccountScreen() {
  const theme = useTheme();
  const { t } = useLocalization();
  const { status } = useSession();
  // v10 Block C, item 12: a short retention step comes first.
  const [step, setStep] = useState<'retain' | 'confirm'>('retain');
  const [phrase, setPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A biometric-locked session (ADR-P036) is not authenticated either.
  if (status === 'unauthenticated' || status === 'locked') return <Redirect href="/sign-in" />;

  if (step === 'retain') {
    return (
      <StageScreen style={{ flexGrow: 1 }}>
        <Stack.Screen options={{ title: t('account.delete.screenTitle') }} />
        <View style={{ flexGrow: 1, justifyContent: 'center', gap: theme.spacing.lg }}>
          <Card>
            <View style={{ gap: theme.spacing.md }}>
              <AppText accessibilityRole="header" variant="title">
                {t('account.delete.retain.title')}
              </AppText>
              <AppText>{t('account.delete.retain.lead')}</AppText>
              {RETAIN_ITEMS.map((key) => (
                <AppText key={key} tone="muted">
                  {`•  ${t(key)}`}
                </AppText>
              ))}
              <AppText tone="muted" variant="caption">
                {t('account.delete.retain.subscription')}
              </AppText>
              <AppButton
                accessibilityLabel={t('account.delete.retain.stayAccessibility')}
                onPress={() => router.back()}
                testID="delete-account-stay"
              >
                {t('account.delete.retain.stay')}
              </AppButton>
              <AppButton
                onPress={() => setStep('confirm')}
                testID="delete-account-continue"
                variant="text"
              >
                {t('account.delete.retain.continue')}
              </AppButton>
            </View>
          </Card>
        </View>
      </StageScreen>
    );
  }

  const confirmed = phrase.trim() === CONFIRM_PHRASE && password !== '';

  const submit = async () => {
    if (!confirmed) return;
    setLoading(true);
    setError(null);
    try {
      await deleteAccount(password);
      router.replace('/sign-in');
    } catch (failure) {
      setPassword('');
      setError(
        t(
          failure instanceof DeleteAccountError
            ? ERROR_COPY[failure.reason]
            : 'account.delete.errorMessage',
        ),
      );
      setLoading(false);
    }
  };

  return (
    // BUG-022. Scrollable so the Android keyboard cannot cover the confirm and
    // cancel actions: `Screen` adds keyboard clearance only to its scroll form.
    // `flexGrow` (not `flex: 1`) lets the column fill the viewport and stay
    // centred without ever shrinking below its content.
    <StageScreen style={{ flexGrow: 1 }}>
      <Stack.Screen options={{ title: t('account.delete.screenTitle') }} />
      <View style={{ flexGrow: 1, justifyContent: 'center', gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xs }}>
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
            <AppTextInput
              accessibilityLabel={t('account.delete.confirmationAccessibility')}
              testID="input-confirm-phrase"
              autoCapitalize="characters"
              autoCorrect={false}
              onChangeText={setPhrase}
              value={phrase}
            />
            <AppText variant="label">{t('account.delete.passwordLabel')}</AppText>
            <AppTextInput
              accessibilityLabel={t('account.delete.passwordAccessibility')}
              testID="input-delete-password"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              onChangeText={setPassword}
              value={password}
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
    </StageScreen>
  );
}
