import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { logError } from '@/shared/infrastructure/logging/logger';
import { type TranslationKey, useLocalization } from '@/shared/localization';
import { AppText, Banner, Icon, useReducedMotion, withAlpha } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { HEIGHT_UNITS, type HeightUnit, WEIGHT_UNITS, type WeightUnit } from './units';
import { useUnits } from './use-units';

type Kind = 'weight' | 'height';

const UNIT_LABEL: Readonly<Record<WeightUnit | HeightUnit, TranslationKey>> = {
  kg: 'units.kg',
  lb: 'units.lb',
  cm: 'units.cm',
  'ft-in': 'units.ftIn',
};

const TITLE: Readonly<Record<Kind, TranslationKey>> = {
  weight: 'units.weightTitle',
  height: 'units.heightTitle',
};

/**
 * One field's unit (v11-B): "kg ▾" beside Peso, "cm ▾" beside Estatura. Pressed,
 * a bottom sheet lists the units as radios; choosing one saves it and closes.
 * Weight and height are independent (lb + cm is valid); values stay metric.
 */
export function UnitDropdown({ kind, testID }: { kind: Kind; testID: string }) {
  const theme = useTheme();
  const { colors, radius, spacing } = theme;
  const { t } = useLocalization();
  const reduceMotion = useReducedMotion();
  const units = useUnits();
  const [open, setOpen] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const current = kind === 'weight' ? units.weight : units.height;
  const options: readonly (WeightUnit | HeightUnit)[] =
    kind === 'weight' ? WEIGHT_UNITS : HEIGHT_UNITS;
  const title = t(TITLE[kind]);
  const isWeb = Platform.OS === 'web';

  const choose = async (next: WeightUnit | HeightUnit) => {
    setOpen(false);
    setSaveFailed(false);
    try {
      if (kind === 'weight') await units.setWeightUnit(next as WeightUnit);
      else await units.setHeightUnit(next as HeightUnit);
    } catch (error) {
      logError('units.preference', error);
      setSaveFailed(true);
    }
  };

  return (
    <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
      <Pressable
        accessibilityHint={t('units.openHint')}
        accessibilityLabel={`${title}: ${t(UNIT_LABEL[current])}`}
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          alignItems: 'center',
          backgroundColor: pressed ? colors.glassBorder : colors.glassFill,
          borderColor: colors.glassBorder,
          borderRadius: radius.field,
          borderWidth: 1,
          flexDirection: 'row',
          gap: spacing.xs,
          justifyContent: 'center',
          minHeight: theme.spacing.x5l,
          minWidth: theme.spacing.x5l,
          paddingHorizontal: spacing.md,
        })}
        testID={testID}
      >
        <AppText tone="onStage" variant="label">
          {t(UNIT_LABEL[current])}
        </AppText>
        <View style={styles.down}>
          <Icon color={colors.onStageVariant} name="chevron" size={14} />
        </View>
      </Pressable>
      {saveFailed ? (
        <Banner title={title} tone="error">
          {t('units.saveError')}
        </Banner>
      ) : null}
      {open ? (
        <Modal
          animationType={reduceMotion ? 'none' : 'slide'}
          onRequestClose={() => setOpen(false)}
          statusBarTranslucent
          transparent
          visible
        >
          {/* Like the birth-date sheet, the scrim is not a control: choosing a
              unit closes it, and so does the system back gesture. */}
          <View style={[styles.scrim, { backgroundColor: withAlpha(colors.stage, 0.75) }]}>
            <View
              accessibilityRole="radiogroup"
              accessibilityViewIsModal
              style={{
                backgroundColor: colors.stageDeep,
                borderColor: colors.glassBorder,
                borderTopLeftRadius: radius.sheet,
                borderTopRightRadius: radius.sheet,
                borderWidth: 1,
                gap: spacing.sm,
                paddingBottom: spacing.x3l,
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.lg,
              }}
              testID={`${testID}-sheet`}
            >
              <AppText accessibilityRole="header" tone="onStage" variant="title">
                {title}
              </AppText>
              {options.map((option) => {
                const selected = option === current;
                const label = t(UNIT_LABEL[option]);
                return (
                  <Pressable
                    key={option}
                    accessibilityLabel={`${title}: ${label}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    aria-checked={isWeb ? selected : undefined}
                    onPress={() => void choose(option)}
                    style={{
                      alignItems: 'center',
                      backgroundColor: selected ? colors.choiceSelectedFill : colors.glassFill,
                      borderColor: selected ? colors.choiceSelectedFill : colors.glassBorder,
                      borderRadius: radius.field,
                      borderWidth: selected ? 2 : 1,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      minHeight: theme.spacing.x5l,
                      paddingHorizontal: spacing.md,
                    }}
                    testID={`${testID}-option-${option}`}
                  >
                    <AppText
                      style={{ color: selected ? colors.onChoiceSelected : colors.onStage }}
                      variant="label"
                    >
                      {label}
                    </AppText>
                    {selected ? (
                      <Icon color={colors.onChoiceSelected} name="check" size={18} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  down: { transform: [{ rotate: '90deg' }] },
  scrim: { flex: 1, justifyContent: 'flex-end' },
});
