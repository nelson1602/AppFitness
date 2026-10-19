import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { logError } from '@/shared/infrastructure/logging/logger';
import { AppText, Banner } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { LanguagePreference } from './language';
import type { TranslationKey } from './resources/en';
import { useLocalization } from './use-localization';

// The part of a react-native-web keydown event the Space handler reads.
type WebKeyEvent = {
  key: string;
  nativeEvent?: { repeat?: boolean };
  preventDefault: () => void;
};

const OPTIONS: readonly { preference: LanguagePreference; labelKey: TranslationKey }[] = [
  { preference: 'system', labelKey: 'language.system' },
  { preference: 'es', labelKey: 'language.spanish' },
  { preference: 'en', labelKey: 'language.english' },
];

export function LanguageSelector() {
  const theme = useTheme();
  const { preference, setLanguagePreference, t } = useLocalization();
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // BUG-039: react-native-web does not read `accessibilityState`, so on Web the
  // radios carry `aria-checked` as well. Native keeps `selected` alone, since
  // React Native would merge `aria-checked` into its state there.
  // react-native-web also activates a Pressable with Space only for the button
  // role, so on Web Space on a radio selects it here; Enter keeps its existing
  // activation.
  const isWeb = Platform.OS === 'web';
  const onSpace = (option: LanguagePreference) => (event: WebKeyEvent) => {
    if (event.key !== ' ' && event.key !== 'Spacebar') return;
    event.preventDefault();
    if (saving || event.nativeEvent?.repeat) return;
    void select(option);
  };

  const select = async (next: LanguagePreference) => {
    setSaving(true);
    setSaveFailed(false);
    try {
      await setLanguagePreference(next);
    } catch (error) {
      logError('localization.preference', error);
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View accessibilityRole="radiogroup" style={{ gap: theme.spacing.sm }}>
      <View>
        <AppText variant="title">{t('language.title')}</AppText>
        <AppText tone="muted">{t('language.description')}</AppText>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {OPTIONS.map(({ preference: option, labelKey }) => {
          const selected = preference === option;
          const label = t(labelKey);
          return (
            <Pressable
              key={option}
              accessibilityLabel={`${t('language.title')}: ${label}`}
              accessibilityRole="radio"
              accessibilityState={{ disabled: saving, selected }}
              aria-checked={isWeb ? selected : undefined}
              disabled={saving}
              onPress={() => void select(option)}
              {...(isWeb ? { onKeyDown: onSpace(option) } : null)}
              style={{
                backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceVariant,
                borderColor: selected ? theme.colors.primary : theme.colors.outline,
                borderRadius: theme.radius.medium,
                borderWidth: 1,
                justifyContent: 'center',
                minHeight: theme.spacing.x5l,
                paddingHorizontal: theme.spacing.md,
              }}
              testID={`language-option-${option}`}
            >
              <AppText
                style={{ color: selected ? theme.colors.onPrimary : theme.colors.onSurface }}
                variant="label"
              >
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {saveFailed ? (
        <Banner title={t('language.title')} tone="error">
          {t('language.saveError')}
        </Banner>
      ) : null}
    </View>
  );
}
