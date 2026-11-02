import { useState } from 'react';
import { View } from 'react-native';

import { Choice } from '@/features/evaluation/presentation/evaluation-controls';
import { interpolate, useLocalization } from '@/shared/localization';
import { AppButton, AppText } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { COUNTRY_CODES, DEFAULT_COUNTRY, isCountryCode, type CountryCode } from '../domain/country';
import { COUNTRY_LABEL_KEY } from './country-label';

interface CountrySelectProps {
  value: string;
  onChange: (country: CountryCode) => void;
  testID?: string;
}

/**
 * "País" (v8.1), on the stage: the chosen country with a "Cambiar" button;
 * opening it shows the curated list as one-of radio chips — the evaluation's
 * own `Choice` control, so the selection is a check mark and a border, never
 * colour alone, and assistive technology hears a radio with its state. Picking
 * a country closes the list. Used on the sign-up form and in Editar perfil.
 */
export function CountrySelect({ value, onChange, testID = 'country-select' }: CountrySelectProps) {
  const theme = useTheme();
  const { t } = useLocalization();
  const [open, setOpen] = useState(false);
  // A code set by another client outside the curated list reads as "Otro país".
  const selected: CountryCode = isCountryCode(value) ? value : value ? 'ZZ' : DEFAULT_COUNTRY;
  const label = t('profile.country');
  const current = t(COUNTRY_LABEL_KEY[selected]);

  return (
    <View style={{ gap: theme.spacing.xs }} testID={testID}>
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          justifyContent: 'space-between',
        }}
      >
        <AppText tone="onStage" variant="label">
          {label}
        </AppText>
        <AppButton
          accessibilityLabel={interpolate(t('profile.country.changeAccessibility'), {
            country: current,
          })}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((shown) => !shown)}
          style={{ paddingHorizontal: 0 }}
          testID={`${testID}-toggle`}
          variant="stage-link"
        >
          {t('profile.country.change')}
        </AppButton>
      </View>
      {open ? (
        <View
          accessibilityLabel={label}
          accessibilityRole="radiogroup"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
        >
          {COUNTRY_CODES.map((code) => {
            const name = t(COUNTRY_LABEL_KEY[code]);
            return (
              <Choice
                key={code}
                accessibilityLabel={`${label}: ${name}`}
                label={name}
                onPress={() => {
                  onChange(code);
                  setOpen(false);
                }}
                role="radio"
                selected={code === selected}
                testID={`${testID}-option-${code}`}
              />
            );
          })}
        </View>
      ) : (
        <AppText testID={`${testID}-value`} tone="onStage">
          {current}
        </AppText>
      )}
      <AppText tone="onStageVariant" variant="caption">
        {t('profile.country.hint')}
      </AppText>
    </View>
  );
}
