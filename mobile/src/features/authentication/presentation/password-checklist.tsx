import { View } from 'react-native';

import { type TranslationKey, useLocalization } from '@/shared/localization';
import { interpolate } from '@/shared/localization/format';
import { AppText, Icon } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { PASSWORD_RULES, type PasswordRule, unmetPasswordRules } from '../domain/password-policy';

const RULE_COPY: Record<PasswordRule, TranslationKey> = {
  length: 'auth.passwordRules.length',
  uppercase: 'auth.passwordRules.uppercase',
  lowercase: 'auth.passwordRules.lowercase',
  digit: 'auth.passwordRules.digit',
  symbol: 'auth.passwordRules.symbol',
};

interface PasswordChecklistProps {
  password: string;
  testID?: string;
}

/**
 * Live password requirements under a new-password field (ADR-P041 D1).
 *
 * Each row ticks as soon as the rule is met. The rules come from the domain
 * policy, which mirrors the API exactly, so a password the checklist accepts
 * is a password the server accepts. Each row names its own state for screen
 * readers ("…: met" / "…: not met yet") instead of relying on the icon.
 */
export function PasswordChecklist({
  password,
  testID = 'password-checklist',
}: PasswordChecklistProps) {
  const theme = useTheme();
  const { t } = useLocalization();
  const unmet = new Set(unmetPasswordRules(password));

  return (
    <View style={{ gap: theme.spacing.xs }} testID={testID}>
      <AppText tone="onStageVariant" variant="label">
        {t('auth.passwordRules.title')}
      </AppText>
      {PASSWORD_RULES.map((rule) => {
        const met = !unmet.has(rule);
        const label = t(RULE_COPY[rule]);
        return (
          <View
            accessibilityLabel={interpolate(
              t(met ? 'auth.passwordRules.met' : 'auth.passwordRules.unmet'),
              { rule: label },
            )}
            accessible
            key={rule}
            style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.sm }}
            testID={`${testID}-${rule}-${met ? 'met' : 'unmet'}`}
          >
            <Icon
              color={met ? theme.colors.accentCyan : theme.colors.onStageVariant}
              name={met ? 'check' : 'x'}
              size={16}
            />
            <AppText style={{ flexShrink: 1 }} tone={met ? 'onStage' : 'onStageVariant'}>
              {label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}
