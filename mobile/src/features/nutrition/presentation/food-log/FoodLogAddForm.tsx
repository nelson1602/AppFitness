import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import type { MealTypeName } from '@/shared/infrastructure/database/types';
import { useLocalization, type TranslationKey } from '@/shared/localization';
import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { foodDisplayName, searchFoodsForDisplay } from '../../application/food-display.service';
import type { DietaryPreference } from '../../domain/dietary-preference';
import { matchFoodExclusion, type ExclusionMatch } from '../../domain/dietary-preference-match';
import type { AvoidTag, FoodItem, ServingUnit } from '../../domain/food-catalog';
import { MEAL_SLOTS } from '../../domain/meal-plan';
import { ServingStepper } from './ServingStepper';

const MAX_RESULTS = 8;

const MEAL_KEY: Record<MealTypeName, TranslationKey> = {
  BREAKFAST: 'nutrition.plan.breakfast',
  LUNCH: 'nutrition.plan.lunch',
  DINNER: 'nutrition.plan.dinner',
  SNACK: 'nutrition.plan.snack',
};

const TAG_KEY: Record<AvoidTag, TranslationKey> = {
  nut_allergy: 'nutrition.avoid.nuts',
  shellfish_allergy: 'nutrition.avoid.shellfish',
  gluten_sensitive: 'nutrition.avoid.gluten',
  lactose_sensitive: 'nutrition.avoid.lactose',
  high_sodium_sensitive: 'nutrition.avoid.sodium',
  high_purine: 'nutrition.avoid.purine',
};

const UNIT_KEY: Record<ServingUnit, TranslationKey> = {
  g: 'nutrition.unit.g',
  ml: 'nutrition.unit.ml',
  piece: 'nutrition.unit.piece',
  cup: 'nutrition.unit.cup',
  tbsp: 'nutrition.unit.tbsp',
  tsp: 'nutrition.unit.tsp',
  slice: 'nutrition.unit.slice',
};

function ExclusionWarning({ match, foodName }: { match: ExclusionMatch; foodName: string }) {
  const { t } = useLocalization();
  const reasons: string[] = [];
  if (match.avoidTags.length > 0) {
    reasons.push(match.avoidTags.map((avoidTag) => t(TAG_KEY[avoidTag])).join(', '));
  }
  if (match.byCatalogKey) reasons.push(t('nutrition.warning.catalogReason'));
  const reasonText = reasons.join(` ${t('nutrition.warning.join')} `);

  if (match.severity === 'allergy') {
    return (
      <Banner title={t('nutrition.warning.allergyTitle')} tone="error">
        {foodName} {t('nutrition.warning.matches')} {reasonText}.{' '}
        {t('nutrition.warning.allergyAdvice')}
      </Banner>
    );
  }
  return (
    <Banner title={t('nutrition.warning.preferenceTitle')} tone="warning">
      {foodName} {t('nutrition.warning.matches')} {reasonText}{' '}
      {t('nutrition.warning.preferenceAdvice')}
    </Banner>
  );
}

/** Catalog-key based add-food UI; localization never changes submitted identity. */
export function FoodLogAddForm({
  onAdd,
  defaultMealType = 'BREAKFAST',
  activePreferences = [],
}: {
  onAdd: (catalogKey: string, mealType: MealTypeName, servingCount: number) => void;
  defaultMealType?: MealTypeName;
  activePreferences?: readonly DietaryPreference[];
}) {
  const theme = useTheme();
  const { language, t } = useLocalization();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [mealType, setMealType] = useState<MealTypeName>(defaultMealType);
  const [servingCount, setServingCount] = useState(1);

  const results = useMemo(
    () => (query.trim() ? searchFoodsForDisplay(query, language).slice(0, MAX_RESULTS) : []),
    [language, query],
  );
  const exclusion = useMemo(
    () => (selected ? matchFoodExclusion(selected, activePreferences) : null),
    [selected, activePreferences],
  );
  const selectedDisplayName = selected ? foodDisplayName(selected, language) : null;

  const reset = (): void => {
    setSelected(null);
    setQuery('');
    setServingCount(1);
  };

  const submit = (): void => {
    if (!selected) return;
    onAdd(selected.id, mealType, servingCount);
    reset();
  };

  return (
    <Card accessibilityLabel={t('nutrition.log.addAccessibility')}>
      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="title">{t('nutrition.log.addTitle')}</AppText>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {MEAL_SLOTS.map((slot) => {
            const active = slot === mealType;
            const label = t(MEAL_KEY[slot]);
            return (
              <Pressable
                key={slot}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${t('nutrition.log.mealAccessibility')}: ${label}`}
                testID={`meal-type-${slot}`}
                onPress={() => setMealType(slot)}
                style={{
                  backgroundColor: active ? theme.colors.primary : theme.colors.surfaceVariant,
                  borderColor: active ? theme.colors.primary : theme.colors.outline,
                  borderRadius: theme.radius.medium,
                  borderWidth: 1,
                  minHeight: theme.spacing.x5l,
                  justifyContent: 'center',
                  paddingHorizontal: theme.spacing.md,
                }}
              >
                <AppText tone={active ? 'default' : 'muted'}>{label}</AppText>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          accessibilityLabel={t('nutrition.log.searchAccessibility')}
          testID="food-search-input"
          placeholder={t('nutrition.log.searchPlaceholder')}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          autoCorrect={false}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setSelected(null);
          }}
          style={{
            backgroundColor: theme.colors.surfaceVariant,
            borderColor: theme.colors.outline,
            borderRadius: theme.radius.medium,
            borderWidth: 1,
            color: theme.colors.onSurface,
            minHeight: theme.spacing.x5l,
            paddingHorizontal: theme.spacing.md,
            ...theme.typography.body,
          }}
        />

        {!selected && results.length > 0 ? (
          <View style={{ gap: theme.spacing.xs }}>
            {results.map((food) => {
              const displayName = foodDisplayName(food, language);
              return (
                <Pressable
                  key={food.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('nutrition.log.choose')} ${displayName}`}
                  testID={`food-option-${food.id}`}
                  onPress={() => setSelected(food)}
                  style={{
                    borderColor: theme.colors.divider,
                    borderRadius: theme.radius.medium,
                    borderWidth: 1,
                    padding: theme.spacing.md,
                  }}
                >
                  <AppText>{displayName}</AppText>
                  <AppText variant="caption" tone="muted">
                    {food.servingSize.amount} {t(UNIT_KEY[food.servingSize.unit])} · {food.calories}{' '}
                    kcal
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {!selected && query.trim() && results.length === 0 ? (
          <AppText tone="muted" testID="food-search-no-results">
            {t('nutrition.log.noResults')}
          </AppText>
        ) : null}

        {selected ? (
          <View style={{ gap: theme.spacing.md }}>
            <View style={{ gap: 2 }}>
              <AppText variant="label">{selectedDisplayName}</AppText>
              <AppText variant="caption" tone="muted">
                {t('nutrition.log.oneServing')} = {selected.servingSize.amount}{' '}
                {t(UNIT_KEY[selected.servingSize.unit])} · {selected.calories} kcal
              </AppText>
            </View>
            {exclusion && selectedDisplayName ? (
              <ExclusionWarning match={exclusion} foodName={selectedDisplayName} />
            ) : null}
            <ServingStepper
              value={servingCount}
              onChange={setServingCount}
              testIDPrefix="add-serving"
            />
            <AppButton
              accessibilityLabel={`${t('nutrition.log.logAccessibility')} ${selectedDisplayName}`}
              testID="food-log-add-submit"
              onPress={submit}
            >
              {t('nutrition.log.addButton')}
            </AppButton>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
