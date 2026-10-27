import { View } from 'react-native';

import { formatNumber, interpolate, useLocalization } from '@/shared/localization';
import { AppText, GlassCard } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { FoodMark } from '../../domain/evaluation';
import { FOOD_GROUPS } from '../../domain/food-groups';
import { Choice, Group, Legend } from '../evaluation-controls';
import { FOOD_GROUP_LABEL, FOOD_MARK_LABEL, foodLabelKey } from '../evaluation-copy';
import type { StepProps } from './step-props';

/**
 * Paso 3 — Alimentación (ADR-P040 D3/D4). Marking an item excludes it;
 * each marked item is then an "Alergia" (blocked when logging) or "Prefiero
 * evitar" (a warning only). A new mark starts as an allergy, the safer side.
 */
export function FoodStep({ draft, update }: StepProps) {
  const theme = useTheme();
  const { spacing } = theme;
  const { language, t } = useLocalization();
  const marked = Object.keys(draft.foods).length;

  const toggle = (id: string) => {
    const foods = { ...draft.foods };
    if (foods[id]) delete foods[id];
    else foods[id] = 'allergy';
    update({ foods });
  };
  const setKind = (id: string, kind: FoodMark) => update({ foods: { ...draft.foods, [id]: kind } });

  return (
    <View style={{ gap: spacing.lg }}>
      <Legend hint={t('evaluation.food.hint')}>{t('evaluation.food.title')}</Legend>
      <AppText tone="onStageVariant" variant="caption">
        {t('evaluation.food.kindHint')}
      </AppText>
      <View style={{ gap: spacing.sm }}>
        {FOOD_GROUPS.map((group) => {
          const markedHere = group.items.filter((item) => draft.foods[item.id]);
          return (
            <Group
              count={markedHere.length}
              key={group.id}
              testID={`evaluation-food-group-${group.id}`}
              title={t(FOOD_GROUP_LABEL[group.id])}
            >
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {group.items.map((item) => (
                  <Choice
                    key={item.id}
                    label={t(foodLabelKey(item.id))}
                    onPress={() => toggle(item.id)}
                    role="checkbox"
                    selected={Boolean(draft.foods[item.id])}
                    testID={`evaluation-food-${item.id}`}
                  />
                ))}
              </View>
              {markedHere.map((item) => {
                const label = t(foodLabelKey(item.id));
                return (
                  <View
                    accessibilityLabel={interpolate(t('evaluation.food.kindGroup'), {
                      food: label,
                    })}
                    accessibilityRole="radiogroup"
                    key={item.id}
                    style={{ gap: spacing.xs }}
                    testID={`evaluation-food-kind-${item.id}`}
                  >
                    <AppText tone="onStage" variant="label">
                      {label}
                    </AppText>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                      {(['allergy', 'preference'] as const).map((kind) => (
                        <Choice
                          accessibilityLabel={`${label}: ${t(FOOD_MARK_LABEL[kind])}`}
                          key={kind}
                          label={t(FOOD_MARK_LABEL[kind])}
                          onPress={() => setKind(item.id, kind)}
                          role="radio"
                          selected={draft.foods[item.id] === kind}
                          testID={`evaluation-food-${item.id}-${kind}`}
                        />
                      ))}
                    </View>
                  </View>
                );
              })}
            </Group>
          );
        })}
      </View>
      <GlassCard style={{ padding: spacing.md }} testID="evaluation-food-summary">
        <AppText tone="onStage" variant="caption">
          {marked === 0
            ? t('evaluation.food.none')
            : marked === 1
              ? t('evaluation.food.summaryOne')
              : interpolate(t('evaluation.food.summaryMany'), {
                  n: formatNumber(marked, language),
                })}
        </AppText>
      </GlassCard>
    </View>
  );
}
