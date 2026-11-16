import { View } from 'react-native';

import { useLocalization } from '@/shared/localization';
import { AppText } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { UnitDropdown } from './unit-dropdown';

/**
 * Perfil → "Unidades" (v11-B): Peso [kg ▾ | lb] and Estatura [cm ▾ | ft-in],
 * chosen apart with the same dropdowns as Evaluación → Medidas.
 */
export function UnitSelector() {
  const theme = useTheme();
  const { t } = useLocalization();
  const row = {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
  } as const;
  return (
    <View style={{ gap: theme.spacing.sm }} testID="unit-selector">
      <AppText accessibilityRole="header" tone="onStageVariant" variant="label">
        {t('units.title')}
      </AppText>
      <View style={row}>
        <AppText tone="onStage" variant="label">
          {t('units.weight')}
        </AppText>
        <UnitDropdown kind="weight" testID="unit-weight" />
      </View>
      <View style={row}>
        <AppText tone="onStage" variant="label">
          {t('units.height')}
        </AppText>
        <UnitDropdown kind="height" testID="unit-height" />
      </View>
    </View>
  );
}
