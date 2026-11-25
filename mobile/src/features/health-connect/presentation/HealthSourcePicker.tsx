import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { interpolate, useLocalization } from '@/shared/localization';
import { AppText } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useHealthConnectStore } from '../application/health-connect.store';
import { sourceLabels } from '../domain/data-source';

const AUTO = 'auto';

/**
 * Perfil → "Fuente de datos" (ADR-P048 amendment): which app's data the card
 * and the iCoach read. "Automática" (the default) or one of the apps that
 * wrote data today; the pick is kept on the phone per account. Radio pills,
 * as the language selector draws them on the stage (BUG-039 Web semantics).
 */
export function HealthSourcePicker() {
  const theme = useTheme();
  const { t } = useLocalization();
  const sources = useHealthConnectStore((s) => s.sources);
  const source = useHealthConnectStore((s) => s.source);
  const picked = useHealthConnectStore((s) => s.pickedSource);
  const [saving, setSaving] = useState(false);
  const isWeb = Platform.OS === 'web';
  if (source === null && sources.length === 0) return null;

  // A pick with no recent data stays listed, so it remains visible and selected.
  const packages = sources.map((origin) => origin.packageName);
  if (picked !== null && !packages.includes(picked)) packages.push(picked);
  // Names, never package names; repeated names are numbered to stay distinct.
  const names = sourceLabels(source !== null ? [...packages, source] : packages, {
    honor: t('profile.source.honor'),
    thisPhone: t('profile.source.thisPhone'),
    otherApp: t('profile.source.otherApp'),
  });
  const label = (packageName: string) => names.get(packageName) ?? t('profile.source.otherApp');
  const options = [
    { value: AUTO, text: t('profile.source.auto') },
    ...packages.map((packageName) => ({ value: packageName, text: label(packageName) })),
  ];
  const selectedValue = picked ?? AUTO;

  const select = async (value: string) => {
    setSaving(true);
    try {
      await useHealthConnectStore.getState().setSource(value === AUTO ? null : value);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: theme.spacing.sm }} testID="profile-health-source">
      {source !== null ? (
        <AppText tone="onStage" testID="profile-health-source-current" variant="label">
          {interpolate(t('profile.source.current'), { source: label(source) })}
        </AppText>
      ) : null}
      <AppText tone="onStageVariant" variant="caption">
        {t('profile.source.hint')}
      </AppText>
      <View
        accessibilityLabel={t('profile.source.title')}
        accessibilityRole="radiogroup"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
      >
        {options.map(({ value, text }) => {
          const selected = value === selectedValue;
          return (
            <Pressable
              key={value}
              accessibilityLabel={`${t('profile.source.title')}: ${text}`}
              accessibilityRole="radio"
              accessibilityState={{ disabled: saving, selected }}
              aria-checked={isWeb ? selected : undefined}
              disabled={saving}
              onPress={() => void select(value)}
              style={{
                // Selected: solid fill and a heavier border, not colour alone.
                backgroundColor: selected
                  ? theme.colors.choiceSelectedFill
                  : theme.colors.glassFill,
                borderColor: selected ? theme.colors.choiceSelectedFill : theme.colors.glassBorder,
                borderRadius: theme.radius.field,
                borderWidth: selected ? 2 : 1,
                justifyContent: 'center',
                // Never wider than the row: a long name wraps inside the chip.
                flexShrink: 1,
                maxWidth: '100%',
                minHeight: theme.spacing.x5l,
                paddingHorizontal: theme.spacing.md,
              }}
              testID={`profile-health-source-${value}`}
            >
              <AppText
                style={{
                  color: selected ? theme.colors.onChoiceSelected : theme.colors.onStage,
                  flexShrink: 1,
                }}
                variant="label"
              >
                {text}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
