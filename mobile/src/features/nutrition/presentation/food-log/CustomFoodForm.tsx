import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { parseDecimal } from '@/features/evaluation/domain/evaluation';
import { type TranslationKey, useLocalization } from '@/shared/localization';
import {
  AppButton,
  AppText,
  AppTextInput,
  Banner,
  stageChoiceColors,
  useStageSurface,
} from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { saveCustomFood } from '../../application/remote-food.service';
import type { CanonicalFood } from '../../domain/catalog-identity';
import type { CustomFoodInput } from '../../infrastructure/food-search-api';

type CustomUnit = CustomFoodInput['servingUnit'];
const UNITS: readonly CustomUnit[] = ['g', 'ml', 'piece'];
const UNIT_KEY: Record<CustomUnit, TranslationKey> = {
  g: 'nutrition.unit.g',
  ml: 'nutrition.unit.ml',
  piece: 'nutrition.unit.piece',
};

interface Draft {
  name: string;
  amount: string;
  unit: CustomUnit;
  grams: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
}

/**
 * The checked values of the form, or null when one is missing or not a
 * number: a name, a portion above zero and kcal and macros of 0 or more. A
 * gram portion is its own weight; for ml and pieces the weight is optional.
 */
export function customFoodInputOf(draft: Draft): CustomFoodInput | null {
  const name = draft.name.trim();
  const amount = parseDecimal(draft.amount);
  const values = [draft.kcal, draft.protein, draft.carbs, draft.fat].map(parseDecimal);
  if (!name || name.length > 80 || amount === null || amount <= 0) return null;
  if (values.some((value) => value === null)) return null;
  const [kcal, protein, carbs, fat] = values as number[];
  const weight = draft.unit === 'g' ? amount : parseDecimal(draft.grams);
  if (draft.unit !== 'g' && draft.grams.trim() !== '' && (weight === null || weight <= 0)) {
    return null;
  }
  return {
    name,
    servingAmount: amount,
    servingUnit: draft.unit,
    gramsPerServing: weight ?? null,
    caloriesPerServing: kcal as number,
    proteinPerServing: protein as number,
    carbsPerServing: carbs as number,
    fatPerServing: fat as number,
  };
}

/**
 * "Crear un alimento" (v10 Block B, item 7): when a food is found nowhere, the
 * person enters it once — name, portion, kcal, protein, carbs and fat. It is
 * saved on the server (private to them) and on the phone, then logged as any
 * other food. Needs a connection.
 */
export function CustomFoodForm({
  initialName,
  offline,
  onCreated,
  onCancel,
}: {
  initialName: string;
  offline: boolean;
  onCreated: (food: CanonicalFood) => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const stage = useStageSurface();
  const { t } = useLocalization();
  const [draft, setDraft] = useState<Draft>({
    name: initialName.trim(),
    amount: '100',
    unit: 'g',
    grams: '',
    kcal: '',
    protein: '',
    carbs: '',
    fat: '',
  });
  const [problem, setProblem] = useState<'invalid' | 'save' | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (field: keyof Draft) => (value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  const field = (key: keyof Draft, label: TranslationKey, numeric = true) => (
    <View style={{ flexBasis: numeric ? '45%' : '100%', flexGrow: 1, gap: theme.spacing.xs }}>
      <AppText variant="caption">{t(label)}</AppText>
      <AppTextInput
        accessibilityLabel={t(label)}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        onChangeText={set(key)}
        testID={`custom-food-${key}`}
        value={draft[key] as string}
      />
    </View>
  );

  const save = async (): Promise<void> => {
    const input = customFoodInputOf(draft);
    if (!input) {
      setProblem('invalid');
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      onCreated(await saveCustomFood(input));
    } catch {
      setProblem('save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: theme.spacing.md }} testID="custom-food-form">
      <AppText accessibilityRole="header" variant="label">
        {t('nutrition.custom.title')}
      </AppText>
      {offline ? <Banner title={t('nutrition.custom.offline')} tone="warning" /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {field('name', 'nutrition.custom.name', false)}
        {field('amount', 'nutrition.custom.portion')}
      </View>
      <View
        accessibilityLabel={t('nutrition.custom.unit')}
        accessibilityRole="radiogroup"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
      >
        {UNITS.map((unit) => {
          const active = draft.unit === unit;
          const colors = stageChoiceColors(theme.colors, active);
          return (
            <Pressable
              key={unit}
              accessibilityLabel={t(UNIT_KEY[unit])}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => setDraft((current) => ({ ...current, unit }))}
              style={{
                backgroundColor: stage
                  ? colors.backgroundColor
                  : active
                    ? theme.colors.primary
                    : theme.colors.surfaceVariant,
                borderColor: stage ? colors.borderColor : theme.colors.outline,
                borderRadius: theme.radius.medium,
                borderWidth: 1,
                justifyContent: 'center',
                minHeight: theme.spacing.x5l,
                minWidth: theme.spacing.x5l,
                paddingHorizontal: theme.spacing.md,
              }}
              testID={`custom-food-unit-${unit}`}
            >
              <AppText
                style={stage ? { color: colors.labelColor } : undefined}
                tone={stage ? undefined : active ? 'onPrimary' : 'muted'}
              >
                {t(UNIT_KEY[unit])}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {draft.unit !== 'g' ? field('grams', 'nutrition.custom.grams') : null}
        {field('kcal', 'nutrition.custom.kcal')}
        {field('protein', 'nutrition.custom.protein')}
        {field('carbs', 'nutrition.custom.carbs')}
        {field('fat', 'nutrition.custom.fat')}
      </View>
      {problem ? (
        <Banner
          title={t(
            problem === 'invalid' ? 'nutrition.custom.invalid' : 'nutrition.custom.saveError',
          )}
          tone="error"
        />
      ) : null}
      <AppButton
        disabled={offline}
        loading={saving}
        onPress={() => void save()}
        testID="custom-food-save"
      >
        {t('nutrition.custom.save')}
      </AppButton>
      <AppButton onPress={onCancel} testID="custom-food-cancel" variant="text">
        {t('nutrition.custom.cancel')}
      </AppButton>
    </View>
  );
}
