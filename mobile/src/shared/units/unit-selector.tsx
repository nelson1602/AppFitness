import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { logError } from '@/shared/infrastructure/logging/logger';
import { type TranslationKey, useLocalization } from '@/shared/localization';
import { AppText, Banner } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { UnitSystem } from './units';
import { useUnits } from './use-units';

type WebKeyEvent = {
  key: string;
  nativeEvent?: { repeat?: boolean };
  preventDefault: () => void;
};

const OPTIONS: readonly { system: UnitSystem; labelKey: TranslationKey }[] = [
  { system: 'metric', labelKey: 'units.metric' },
  { system: 'imperial', labelKey: 'units.imperial' },
];

/**
 * Perfil → "Unidades" (v10 Block C, item 9): kg/cm or lb/ft-in. The same
 * stage row and radio semantics as the language selector (BUG-039: Web
 * `aria-checked`, Space selects).
 */
export function UnitSelector() {
  const theme = useTheme();
  const { t } = useLocalization();
  const { system, setUnitSystem } = useUnits();
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const isWeb = Platform.OS === 'web';

  const select = async (next: UnitSystem) => {
    setSaving(true);
    setSaveFailed(false);
    try {
      await setUnitSystem(next);
    } catch (error) {
      logError('units.preference', error);
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const onSpace = (option: UnitSystem) => (event: WebKeyEvent) => {
    if (event.key !== ' ' && event.key !== 'Spacebar') return;
    event.preventDefault();
    if (saving || event.nativeEvent?.repeat) return;
    void select(option);
  };

  return (
    <View accessibilityRole="radiogroup" style={{ gap: theme.spacing.sm }} testID="unit-selector">
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.md,
          justifyContent: 'space-between',
        }}
      >
        <AppText tone="onStageVariant" variant="label">
          {t('units.title')}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {OPTIONS.map(({ system: option, labelKey }) => {
            const selected = system === option;
            const label = t(labelKey);
            return (
              <Pressable
                key={option}
                accessibilityLabel={`${t('units.title')}: ${label}`}
                accessibilityRole="radio"
                accessibilityState={{ disabled: saving, selected }}
                aria-checked={isWeb ? selected : undefined}
                disabled={saving}
                onPress={() => void select(option)}
                {...(isWeb ? { onKeyDown: onSpace(option) } : null)}
                style={{
                  backgroundColor: selected ? theme.colors.fieldFill : theme.colors.glassFill,
                  borderColor: selected ? theme.colors.fieldFill : theme.colors.glassBorder,
                  borderRadius: theme.radius.field,
                  borderWidth: selected ? 2 : 1,
                  justifyContent: 'center',
                  minHeight: theme.spacing.x5l,
                  paddingHorizontal: theme.spacing.md,
                }}
                testID={`unit-option-${option}`}
              >
                <AppText
                  style={{ color: selected ? theme.colors.ctaStart : theme.colors.onStage }}
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
        <Banner title={t('units.title')} tone="error">
          {t('units.saveError')}
        </Banner>
      ) : null}
    </View>
  );
}
