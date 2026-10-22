import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { logError } from '@/shared/infrastructure/logging/logger';
import { AppText, Banner } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { SupportedLanguage } from './language';
import type { TranslationKey } from './resources/en';
import { useLocalization } from './use-localization';

// The part of a react-native-web keydown event the Space handler reads.
type WebKeyEvent = {
  key: string;
  nativeEvent?: { repeat?: boolean };
  preventDefault: () => void;
};

// Exactly two visible choices (owner decision). A stored `'system'` or missing
// preference stays valid: the radio that matches the resolved language is the
// one shown as selected, and choosing either stores an explicit preference.
const OPTIONS: readonly { preference: SupportedLanguage; labelKey: TranslationKey }[] = [
  { preference: 'es', labelKey: 'language.spanish' },
  { preference: 'en', labelKey: 'language.english' },
];

interface LanguageSelectorProps {
  /**
   * ADR-P035 `stage`: the redesign's compact row — the label beside two pills
   * on the stage. The radio semantics, Web `aria-checked` and Space handling
   * (BUG-039) are identical in both appearances.
   */
  appearance?: 'default' | 'stage';
}

export function LanguageSelector({ appearance = 'default' }: LanguageSelectorProps = {}) {
  const stage = appearance === 'stage';
  const theme = useTheme();
  const { language, setLanguagePreference, t } = useLocalization();
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // BUG-039: react-native-web does not read `accessibilityState`, so on Web the
  // radios carry `aria-checked` as well. Native keeps `selected` alone, since
  // React Native would merge `aria-checked` into its state there.
  // react-native-web also activates a Pressable with Space only for the button
  // role, so on Web Space on a radio selects it here; Enter keeps its existing
  // activation.
  const isWeb = Platform.OS === 'web';
  const onSpace = (option: SupportedLanguage) => (event: WebKeyEvent) => {
    if (event.key !== ' ' && event.key !== 'Spacebar') return;
    event.preventDefault();
    if (saving || event.nativeEvent?.repeat) return;
    void select(option);
  };

  const select = async (next: SupportedLanguage) => {
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
      <View
        style={
          stage
            ? {
                alignItems: 'center',
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: theme.spacing.md,
                justifyContent: 'space-between',
              }
            : undefined
        }
      >
        {stage ? (
          <AppText tone="onStageVariant" variant="label">
            {t('language.title')}
          </AppText>
        ) : (
          <View>
            <AppText variant="title">{t('language.title')}</AppText>
            <AppText tone="muted">{t('language.description')}</AppText>
          </View>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {OPTIONS.map(({ preference: option, labelKey }) => {
            const selected = language === option;
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
                  // Stage: a selected pill is filled white with a heavier border, an
                  // unselected one is glass — fill and border width, not colour alone.
                  backgroundColor: stage
                    ? selected
                      ? theme.colors.fieldFill
                      : theme.colors.glassFill
                    : selected
                      ? theme.colors.primary
                      : theme.colors.surfaceVariant,
                  borderColor: stage
                    ? selected
                      ? theme.colors.fieldFill
                      : theme.colors.glassBorder
                    : selected
                      ? theme.colors.primary
                      : theme.colors.outline,
                  borderRadius: stage ? theme.radius.field : theme.radius.medium,
                  borderWidth: stage && selected ? 2 : 1,
                  justifyContent: 'center',
                  minHeight: theme.spacing.x5l,
                  paddingHorizontal: theme.spacing.md,
                }}
                testID={`language-option-${option}`}
              >
                <AppText
                  style={{
                    color: stage
                      ? selected
                        ? theme.colors.ctaStart
                        : theme.colors.onStage
                      : selected
                        ? theme.colors.onPrimary
                        : theme.colors.onSurface,
                  }}
                  variant="label"
                >
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
      {saveFailed ? (
        <Banner title={t('language.title')} tone="error">
          {t('language.saveError')}
        </Banner>
      ) : null}
    </View>
  );
}
