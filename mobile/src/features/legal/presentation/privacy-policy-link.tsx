import * as WebBrowser from 'expo-web-browser';

import { useLocalization } from '@/shared/localization';
import { AppButton } from '@/shared/presentation';

export const PRIVACY_POLICY_URL = {
  en: 'https://appfitnessrd.com/en/privacy/',
  es: 'https://appfitnessrd.com/privacidad/',
} as const;

export function privacyPolicyUrl(language: 'en' | 'es'): string {
  return PRIVACY_POLICY_URL[language];
}

export function PrivacyPolicyLink({ testID }: { testID: string }) {
  const { language, t } = useLocalization();
  return (
    <AppButton
      accessibilityLabel={t('legal.privacyPolicyAccessibility')}
      onPress={() => void WebBrowser.openBrowserAsync(privacyPolicyUrl(language))}
      testID={testID}
      variant="stage-link"
    >
      {t('legal.privacyPolicy')}
    </AppButton>
  );
}
