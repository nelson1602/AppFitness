import { router } from 'expo-router';
import { View } from 'react-native';

import { signOut } from '@/features/authentication';
import { LanguageSelector, useLocalization } from '@/shared/localization';
import { AppButton, AppText, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

/**
 * The Perfil tab (ADR-P039 D1): the account actions that used to close the
 * dashboard, in one place. The evaluation summary card and the biometric
 * switch come with their own phases (ADR-P038 gate; PR #233).
 */
export function ProfileTab() {
  const { spacing } = useTheme();
  const { t } = useLocalization();

  return (
    <View style={{ gap: spacing.lg }}>
      <Card style={{ gap: spacing.sm }}>
        <AppButton
          accessibilityLabel={t('dashboard.wellnessSafetyAccessibility')}
          onPress={() => router.push('/wellness-safety-profile')}
          testID="profile-wellness-safety"
          variant="secondary"
        >
          {t('dashboard.wellnessSafety')}
        </AppButton>
        <AppButton
          onPress={() => router.push('/profile-edit')}
          testID="profile-edit"
          variant="secondary"
        >
          {t('profile.editTitle')}
        </AppButton>
        <AppButton
          onPress={() => router.push('/goal-edit')}
          testID="profile-goal"
          variant="secondary"
        >
          {t('goal.editTitle')}
        </AppButton>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <AppText accessibilityRole="header" variant="title">
          {t('dashboard.account')}
        </AppText>
        {/* Subscription status, offer, restore and management (ADR-P034 S-3). */}
        <AppButton
          accessibilityLabel={t('dashboard.subscriptionAccessibility')}
          onPress={() => router.push('/subscription')}
          testID="profile-subscription"
          variant="secondary"
        >
          {t('dashboard.subscription')}
        </AppButton>
        <LanguageSelector />
      </Card>

      {/* Sign-out clears the session; the tab's session guard then redirects
          to /sign-in — no manual navigation. */}
      <AppButton
        accessibilityLabel={t('dashboard.signOutAccessibility')}
        onPress={() => {
          void signOut();
        }}
        testID="profile-sign-out"
        variant="text"
      >
        {t('dashboard.signOut')}
      </AppButton>
      <AppButton
        accessibilityLabel={t('dashboard.deleteAccountAccessibility')}
        onPress={() => router.push('/delete-account')}
        testID="profile-delete-account"
        variant="text"
      >
        {t('dashboard.deleteAccount')}
      </AppButton>
    </View>
  );
}
