import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import type { MealTypeName } from '@/shared/infrastructure/database/types';
import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { search } from '../../application/food-catalog.service';
import type { DietaryPreference } from '../../domain/dietary-preference';
import { matchFoodExclusion, type ExclusionMatch } from '../../domain/dietary-preference-match';
import { AVOID_TAG_LABELS, type FoodItem } from '../../domain/food-catalog';
import { MEAL_SLOTS } from '../../domain/meal-plan';
import { ServingStepper } from './ServingStepper';

const MAX_RESULTS = 8;

const MEAL_LABEL: Record<MealTypeName, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  SNACK: 'Snack',
};

/**
 * Non-blocking dietary-preference warning for a selected food (ADR-P014
 * Slice 4). Allergy/sensitivity matches get stronger safety wording;
 * preference/dislike matches get softer wording. Advisory only — the user can
 * still log the food. Not emergency medical advice.
 */
function ExclusionWarning({ match, foodName }: { match: ExclusionMatch; foodName: string }) {
  const reasons: string[] = [];
  if (match.avoidTags.length > 0) {
    reasons.push(match.avoidTags.map((t) => AVOID_TAG_LABELS[t]).join(', '));
  }
  if (match.byCatalogKey) reasons.push('a food you chose to avoid');
  const reasonText = reasons.join(' and ');

  if (match.severity === 'allergy') {
    return (
      <Banner title="Heads up — this matches an allergy or sensitivity" tone="error">
        {foodName} matches {reasonText}. You can still log it, but double-check it’s safe for you.
        This is not emergency medical advice.
      </Banner>
    );
  }
  return (
    <Banner title="This is on your avoid list" tone="warning">
      {foodName} matches {reasonText} in your dietary preferences. You can still log it if you’d
      like.
    </Banner>
  );
}

/**
 * Add-food surface: search the read-only catalog by name, pick a food, choose
 * a meal + serving count, and log it. The UI works in catalog keys/slugs
 * (`FoodItem.id`); the repository maps that to the persisted UUIDv5 identity.
 * No macro math here — the serving preview reads the catalog's own values.
 */
export function FoodLogAddForm({
  onAdd,
  defaultMealType = 'BREAKFAST',
  activePreferences = [],
}: {
  onAdd: (catalogKey: string, mealType: MealTypeName, servingCount: number) => void;
  defaultMealType?: MealTypeName;
  /** Active dietary preferences used to warn (never block) on a match. */
  activePreferences?: readonly DietaryPreference[];
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [mealType, setMealType] = useState<MealTypeName>(defaultMealType);
  const [servingCount, setServingCount] = useState(1);

  const results = useMemo(() => (query.trim() ? search(query).slice(0, MAX_RESULTS) : []), [query]);
  const exclusion = useMemo(
    () => (selected ? matchFoodExclusion(selected, activePreferences) : null),
    [selected, activePreferences],
  );

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
    <Card accessibilityLabel="Add a food to your log">
      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="title">Add food</AppText>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {MEAL_SLOTS.map((slot) => {
            const active = slot === mealType;
            return (
              <Pressable
                key={slot}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Meal: ${MEAL_LABEL[slot]}`}
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
                <AppText tone={active ? 'default' : 'muted'}>{MEAL_LABEL[slot]}</AppText>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          accessibilityLabel="Search foods"
          testID="food-search-input"
          placeholder="Search foods (e.g. chicken, oats)"
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
            {results.map((food) => (
              <Pressable
                key={food.id}
                accessibilityRole="button"
                accessibilityLabel={`Choose ${food.name}`}
                testID={`food-option-${food.id}`}
                onPress={() => setSelected(food)}
                style={{
                  borderColor: theme.colors.divider,
                  borderRadius: theme.radius.medium,
                  borderWidth: 1,
                  padding: theme.spacing.md,
                }}
              >
                <AppText>{food.name}</AppText>
                <AppText variant="caption" tone="muted">
                  {food.servingSize.amount}
                  {food.servingSize.unit} · {food.calories} kcal
                </AppText>
              </Pressable>
            ))}
          </View>
        ) : null}

        {!selected && query.trim() && results.length === 0 ? (
          <AppText tone="muted" testID="food-search-no-results">
            No foods match that search.
          </AppText>
        ) : null}

        {selected ? (
          <View style={{ gap: theme.spacing.md }}>
            <View style={{ gap: 2 }}>
              <AppText variant="label">{selected.name}</AppText>
              <AppText variant="caption" tone="muted">
                1 serving = {selected.servingSize.amount}
                {selected.servingSize.unit} · {selected.calories} kcal
              </AppText>
            </View>
            {exclusion ? <ExclusionWarning match={exclusion} foodName={selected.name} /> : null}
            <ServingStepper
              value={servingCount}
              onChange={setServingCount}
              testIDPrefix="add-serving"
            />
            <AppButton
              accessibilityLabel={`Log ${selected.name}`}
              testID="food-log-add-submit"
              onPress={submit}
            >
              Add to log
            </AppButton>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
