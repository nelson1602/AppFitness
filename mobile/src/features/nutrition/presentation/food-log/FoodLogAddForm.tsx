import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { MealTypeName } from '@/shared/infrastructure/database/types';
// Direct import: the barrel would also load the subscription store composition.
import { SubscriptionRequiredNotice } from '@/features/subscriptions/presentation/SubscriptionRequiredNotice';
import { useTodayTargets } from '@/features/dashboard/application/use-today-targets';
import { localDateOf } from '@/features/weekly-plan/domain/week';
import {
  formatKcal,
  formatKcalQuantity,
  formatNumber,
  interpolate,
  type TranslationKey,
  useLocalization,
} from '@/shared/localization';
import {
  AppButton,
  AppText,
  AppTextInput,
  Banner,
  Card,
  usePaidWriteDisabled,
  stageChoiceColors,
  useStageSurface,
} from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { foodDisplayName } from '../../application/food-display.service';
import { useFoodLogStore } from '../../application/food-log.store';
import {
  foodItemFromCanonical,
  foodItemFromSearchResult,
  type RemoteFoodFailure,
  remoteFoodFailureOf,
  saveChosenFood,
} from '../../application/remote-food.service';
import type { DietaryPreference } from '../../domain/dietary-preference';
import {
  isLoggingBlocked,
  matchFoodExclusion,
  type ExclusionMatch,
} from '../../domain/dietary-preference-match';
import type { AvoidTag, FoodItem, ServingUnit } from '../../domain/food-catalog';
import { MEAL_SLOTS } from '../../domain/meal-plan';
import type { FoodSearchResult } from '../../infrastructure/food-search-api';
import { CustomFoodForm } from './CustomFoodForm';
import { RemoteFoodResults } from './RemoteFoodResults';
import { ServingStepper } from './ServingStepper';
import { useFoodSearch } from './use-food-search';

/** Same dimming as a disabled `AppButton` (S-4 read-only write controls). */
const DISABLED_OPACITY = 0.56;

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
  added_sugar: 'nutrition.avoid.addedSugar',
  alcohol: 'nutrition.avoid.alcohol',
  caffeine: 'nutrition.avoid.caffeine',
  fried: 'nutrition.avoid.fried',
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
  const stage = useStageSurface();
  const paidWriteDisabled = usePaidWriteDisabled();
  const { language, t } = useLocalization();
  const targets = useTodayTargets();
  const logDate = useFoodLogStore((state) => state.date);
  const consumedToday = useFoodLogStore((state) => state.totals.calories);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [mealType, setMealType] = useState<MealTypeName>(defaultMealType);
  const [servingCount, setServingCount] = useState(1);
  // v10 Block B: a server result is saved (shared catalogue) only when added.
  const [pending, setPending] = useState<FoodSearchResult | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveProblem, setSaveProblem] = useState<RemoteFoodFailure | null>(null);

  const {
    local: results,
    remote,
    remoteStatus,
  } = useFoodSearch(query, language, !paidWriteDisabled);
  const exclusion = useMemo(
    () => (selected ? matchFoodExclusion(selected, activePreferences) : null),
    [selected, activePreferences],
  );
  const selectedDisplayName = selected ? foodDisplayName(selected, language) : null;

  const reset = (): void => {
    setSelected(null);
    setPending(null);
    setShowCustom(false);
    setSaveProblem(null);
    setQuery('');
    setServingCount(1);
  };

  const blocked = isLoggingBlocked(exclusion);
  // ADR-P040 v10-B: today, a food that takes the day past its target gets a
  // preview of the total before it is saved.
  const overTarget =
    selected && targets && logDate === localDateOf(new Date().toISOString())
      ? (() => {
          const total = Math.round(consumedToday + selected.calories * servingCount);
          const target = Math.round(targets.calories);
          return total > target ? { total, target } : null;
        })()
      : null;

  const submit = async (): Promise<void> => {
    if (!selected || blocked || saving) return;
    if (!pending) {
      onAdd(selected.id, mealType, servingCount);
      reset();
      return;
    }
    setSaving(true);
    setSaveProblem(null);
    try {
      const food = await saveChosenFood(pending);
      onAdd(food.catalogKey, mealType, servingCount);
      reset();
    } catch (error) {
      setSaveProblem(remoteFoodFailureOf(error));
    } finally {
      setSaving(false);
    }
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
                accessibilityState={{ selected: active, disabled: paidWriteDisabled }}
                accessibilityLabel={`${t('nutrition.log.mealAccessibility')}: ${label}`}
                disabled={paidWriteDisabled}
                testID={`meal-type-${slot}`}
                onPress={() => setMealType(slot)}
                style={{
                  opacity: paidWriteDisabled ? DISABLED_OPACITY : 1,
                  backgroundColor: stage
                    ? stageChoiceColors(theme.colors, active).backgroundColor
                    : active
                      ? theme.colors.primary
                      : theme.colors.surfaceVariant,
                  borderColor: stage
                    ? stageChoiceColors(theme.colors, active).borderColor
                    : active
                      ? theme.colors.primary
                      : theme.colors.outline,
                  borderRadius: theme.radius.medium,
                  borderWidth: 1,
                  minHeight: theme.spacing.x5l,
                  justifyContent: 'center',
                  paddingHorizontal: theme.spacing.md,
                }}
              >
                {stage ? (
                  <AppText style={{ color: stageChoiceColors(theme.colors, active).labelColor }}>
                    {label}
                  </AppText>
                ) : (
                  <AppText tone={active ? 'onPrimary' : 'muted'}>{label}</AppText>
                )}
              </Pressable>
            );
          })}
        </View>

        <AppTextInput
          accessibilityLabel={t('nutrition.log.searchAccessibility')}
          testID="food-search-input"
          placeholder={t('nutrition.log.searchPlaceholder')}
          autoCorrect={false}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setSelected(null);
            setPending(null);
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
                  accessibilityState={{ disabled: paidWriteDisabled }}
                  disabled={paidWriteDisabled}
                  testID={`food-option-${food.id}`}
                  onPress={() => setSelected(food)}
                  style={{
                    opacity: paidWriteDisabled ? DISABLED_OPACITY : 1,
                    // `outline`, not `divider`: this border is the only thing
                    // bounding an interactive element, so WCAG 1.4.11's 3:1
                    // applies. `divider` is exempt only while it stays
                    // decorative, and measures 1.27:1 light / 1.29:1 dark —
                    // the escape `.ai/08_UI_UX.md` already names for this case
                    // ("if a divider ever becomes the sole boundary of an
                    // interactive element, it must meet 3:1 or an `outline`
                    // must be used instead"). ADR-P022 Addendum A.
                    // On the stage the glass hairline bounds it (v8 Block 3).
                    borderColor: stage ? theme.colors.glassBorder : theme.colors.outline,
                    borderRadius: theme.radius.medium,
                    borderWidth: 1,
                    padding: theme.spacing.md,
                  }}
                >
                  <AppText>{displayName}</AppText>
                  <AppText variant="caption" tone="muted">
                    {formatNumber(food.servingSize.amount, language)}{' '}
                    {t(UNIT_KEY[food.servingSize.unit])} · {formatKcal(food.calories, language)}{' '}
                    kcal
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {!selected && !showCustom ? (
          <RemoteFoodResults
            disabled={paidWriteDisabled}
            onChoose={(result) => {
              setSelected(foodItemFromSearchResult(result));
              setPending(result);
            }}
            results={remote}
            status={remoteStatus}
          />
        ) : null}

        {!selected &&
        query.trim() &&
        results.length === 0 &&
        remote.length === 0 &&
        remoteStatus !== 'loading' ? (
          <AppText tone="muted" testID="food-search-no-results">
            {t('nutrition.log.noResults')}
          </AppText>
        ) : null}

        {!selected && query.trim() && !showCustom && !paidWriteDisabled ? (
          <AppButton
            onPress={() => setShowCustom(true)}
            testID="custom-food-open"
            variant="stage-secondary"
          >
            {t('nutrition.custom.open')}
          </AppButton>
        ) : null}

        {!selected && showCustom ? (
          <CustomFoodForm
            initialName={query}
            offline={remoteStatus === 'offline'}
            onCancel={() => setShowCustom(false)}
            onCreated={(food) => {
              setSelected(foodItemFromCanonical(food));
              setShowCustom(false);
            }}
          />
        ) : null}

        {selected ? (
          <View style={{ gap: theme.spacing.md }}>
            <View style={{ gap: 2 }}>
              <AppText variant="label">{selectedDisplayName}</AppText>
              <AppText variant="caption" tone="muted">
                {t('nutrition.log.oneServing')} ={' '}
                {formatNumber(selected.servingSize.amount, language)}{' '}
                {t(UNIT_KEY[selected.servingSize.unit])} · {formatKcal(selected.calories, language)}{' '}
                kcal
              </AppText>
            </View>
            {exclusion && selectedDisplayName ? (
              <ExclusionWarning match={exclusion} foodName={selectedDisplayName} />
            ) : null}
            <ServingStepper
              disabled={paidWriteDisabled}
              value={servingCount}
              onChange={setServingCount}
              testIDPrefix="add-serving"
            />
            {overTarget ? (
              // ADR-P040 v10-B: a heads-up, never a block; saving stays one tap away.
              <Banner
                title={interpolate(t('nutrition.rebalance.preview'), {
                  total: formatNumber(overTarget.total, language),
                  target: formatKcalQuantity(overTarget.target, language),
                })}
                tone="info"
              />
            ) : null}
            {saveProblem === 'subscription' ? (
              <SubscriptionRequiredNotice outcome="not-saved" testID="food-save-subscription" />
            ) : saveProblem ? (
              <Banner
                title={t(
                  saveProblem === 'offline'
                    ? 'nutrition.search.saveOffline'
                    : 'nutrition.search.saveError',
                )}
                tone="error"
              />
            ) : null}
            <AppButton
              accessibilityLabel={`${t('nutrition.log.logAccessibility')} ${selectedDisplayName}`}
              disabled={blocked}
              loading={saving}
              testID="food-log-add-submit"
              onPress={() => void submit()}
            >
              {t('nutrition.log.addButton')}
            </AppButton>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
