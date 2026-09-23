import { useEffect, useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { useDashboardStore } from '@/features/dashboard/application/dashboard.store';
import type { MealTypeName } from '@/shared/infrastructure/database/types';
import {
  formatNumber,
  useLocalization,
  type SupportedLanguage,
  type TranslationKey,
} from '@/shared/localization';
import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useDietaryPreferenceStore } from '../application/dietary-preference.store';
import { foodDisplayName } from '../application/food-display.service';
import { getById } from '../application/food-catalog.service';
import {
  useFoodLogStore,
  type FoodLogSyncSummary,
  type FoodLogWriteOperation,
} from '../application/food-log.store';
import type { ServingUnit } from '../domain/food-catalog';
import type { ConsumedMacros, LoggedMealItem } from '../domain/food-log';
import { MEAL_SLOTS } from '../domain/meal-plan';
import { FoodLogAddForm } from './food-log/FoodLogAddForm';
import { formatServingCount, ServingStepper } from './food-log/ServingStepper';

const MEAL_KEY: Record<MealTypeName, TranslationKey> = {
  BREAKFAST: 'nutrition.plan.breakfast',
  LUNCH: 'nutrition.plan.lunch',
  DINNER: 'nutrition.plan.dinner',
  SNACK: 'nutrition.plan.snack',
};

/**
 * Serving units are stored as identifiers, so the logged row resolves them
 * through the shipped vocabulary exactly as `FoodLogAddForm` and
 * `NutritionPlanScreen` already do. Rendering the stored token instead left
 * `piece`, `cup`, `tbsp`, `tsp` and `slice` in English inside a Spanish log.
 */
const UNIT_KEY: Record<ServingUnit, TranslationKey> = {
  g: 'nutrition.unit.g',
  ml: 'nutrition.unit.ml',
  piece: 'nutrition.unit.piece',
  cup: 'nutrition.unit.cup',
  tbsp: 'nutrition.unit.tbsp',
  tsp: 'nutrition.unit.tsp',
  slice: 'nutrition.unit.slice',
};

/**
 * A logged row stores its unit as a plain string, so the lookup is by string
 * and an unrecognised unit keeps its stored form rather than vanishing — the
 * same fail-safe shape as `DataGapCard`'s unknown-id fallback.
 * `surface-coverage.spec.ts` keeps `UNIT_KEY` total over `ServingUnit`, which
 * is what makes that fallback unreachable.
 */
const UNIT_LABEL: Readonly<Partial<Record<string, TranslationKey>>> = UNIT_KEY;

function SyncBanner({ sync }: { sync: FoodLogSyncSummary }) {
  const { language, t } = useLocalization();
  switch (sync.state) {
    case 'syncing':
      return (
        <Banner title={t('nutrition.log.syncingTitle')} tone="info">
          {t('nutrition.log.syncingMessage')}
        </Banner>
      );
    case 'offline':
      return (
        <Banner title={t('nutrition.log.offlineTitle')} tone="warning">
          {t('nutrition.log.offlineMessage')}
        </Banner>
      );
    case 'action_required':
      // Catalog incompatibility: a terminal sync FAILURE the user must act on.
      // Distinct from Conflict below — different cause, different copy, and
      // only this one asks the user to remove and re-add the food (BUG-007).
      return (
        <Banner title={t('nutrition.log.actionTitle')} tone="error">
          {formatNumber(sync.actionRequired, language)}{' '}
          {t(
            sync.actionRequired === 1
              ? 'nutrition.log.actionMessageOne'
              : 'nutrition.log.actionMessageMany',
          )}
        </Banner>
      );
    case 'conflict':
      // Both versions are preserved and nothing is lost, so this is `warning`
      // and never `error` (.ai/08_UI_UX.md distinction 5). Report-only: there
      // is no resolution affordance to offer while BUG-012 is open.
      return (
        <Banner title={t('nutrition.log.conflictTitle')} tone="warning">
          {formatNumber(sync.conflicts, language)}{' '}
          {t(
            sync.conflicts === 1
              ? 'nutrition.log.conflictMessageOne'
              : 'nutrition.log.conflictMessageMany',
          )}
        </Banner>
      );
    case 'error':
      return (
        <Banner title={t('nutrition.log.syncErrorTitle')} tone="error">
          {t('nutrition.log.syncErrorMessage')}
        </Banner>
      );
    case 'pending':
      return (
        <Banner title={t('nutrition.log.pendingTitle')} tone="info">
          {formatNumber(sync.pending, language)}{' '}
          {t(
            sync.pending === 1
              ? 'nutrition.log.pendingMessageOne'
              : 'nutrition.log.pendingMessageMany',
          )}
        </Banner>
      );
    default:
      return (
        <Banner title={t('nutrition.log.syncedTitle')} tone="success">
          {t('nutrition.log.syncedMessage')}
        </Banner>
      );
  }
}

/**
 * A failed write is reported distinctly from a failed read (BUG-008): the day is
 * still on screen and the user's input is still valid, so this renders ALONGSIDE
 * the content rather than replacing it. Copy is per-operation — "couldn't add"
 * and "couldn't remove" are different facts and must not be collapsed.
 */
const WRITE_ERROR_COPY: Record<
  FoodLogWriteOperation,
  { title: TranslationKey; body: TranslationKey }
> = {
  add: {
    title: 'nutrition.log.writeError.addTitle',
    body: 'nutrition.log.writeError.addBody',
  },
  servings: {
    title: 'nutrition.log.writeError.servingsTitle',
    body: 'nutrition.log.writeError.servingsBody',
  },
  remove: {
    title: 'nutrition.log.writeError.removeTitle',
    body: 'nutrition.log.writeError.removeBody',
  },
};

function WriteErrorBanner({ operation }: { operation: FoodLogWriteOperation }) {
  const { t } = useLocalization();
  const copy = WRITE_ERROR_COPY[operation];
  return (
    <Banner title={t(copy.title)} tone="error">
      {t(copy.body)}
    </Banner>
  );
}

function ItemSyncChip({ item }: { item: LoggedMealItem }) {
  const { t } = useLocalization();
  if (item.syncState === 'action_required') {
    return (
      <AppText
        variant="caption"
        tone="error"
        accessibilityLabel={t('nutrition.log.actionAccessibility')}
      >
        {t('nutrition.log.actionShort')}
      </AppText>
    );
  }
  if (item.syncState === 'conflict') {
    // `warning`, matching the two conformant conflict surfaces in the product
    // (sync-status-banner and ExerciseLibrary) — never `error`.
    return (
      <AppText
        variant="caption"
        tone="warning"
        accessibilityLabel={t('nutrition.log.conflictAccessibility')}
      >
        {t('nutrition.log.conflictShort')}
      </AppText>
    );
  }
  if (item.syncState === 'pending') {
    return (
      <AppText
        variant="caption"
        tone="muted"
        accessibilityLabel={t('nutrition.log.pendingAccessibility')}
      >
        {t('nutrition.log.pendingShort')}
      </AppText>
    );
  }
  return null;
}

function LoggedItemRow({ item }: { item: LoggedMealItem }) {
  const theme = useTheme();
  const { language, t } = useLocalization();
  const editServing = useFoodLogStore((state) => state.editServing);
  const removeItem = useFoodLogStore((state) => state.removeItem);
  const canonical = item.catalogKey ? getById(item.catalogKey) : undefined;
  const displayName = canonical ? foodDisplayName(canonical, language) : item.name;
  const unitKey = UNIT_LABEL[item.serving.unit];

  return (
    <View
      accessibilityLabel={`${displayName}, ${formatServingCount(item.servingCount, language)} ${t('nutrition.log.servings')}`}
      testID={`logged-item-${item.id}`}
      style={{ gap: theme.spacing.sm }}
    >
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm }}
      >
        <AppText style={{ flexShrink: 1 }}>{displayName}</AppText>
        <ItemSyncChip item={item} />
      </View>
      <AppText variant="caption" tone="muted">
        {formatServingCount(item.servingCount, language)}×{' '}
        {formatNumber(item.serving.amount, language)} {unitKey ? t(unitKey) : item.serving.unit} ·{' '}
        {formatNumber(item.consumed.calories, language)} kcal · {t('nutrition.plan.protein')}{' '}
        {formatNumber(item.consumed.proteinG, language)}g · {t('nutrition.plan.carbs')}{' '}
        {formatNumber(item.consumed.carbsG, language)}g · {t('nutrition.plan.fat')}{' '}
        {formatNumber(item.consumed.fatG, language)}g
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <ServingStepper
          value={item.servingCount}
          onChange={(next) => void editServing(item.id, next)}
          testIDPrefix={`edit-serving-${item.id}`}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('nutrition.log.removeAccessibility')} ${displayName}`}
          testID={`remove-item-${item.id}`}
          onPress={() => void removeItem(item.id)}
          // BUG-023: padding and one label line alone came to 36 dp tall.
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: theme.spacing.x5l,
            minWidth: theme.spacing.x5l,
            padding: theme.spacing.sm,
          }}
        >
          <AppText tone="error" variant="label">
            {t('nutrition.log.remove')}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

function MealGroup({ type, items }: { type: MealTypeName; items: LoggedMealItem[] }) {
  const theme = useTheme();
  const { t } = useLocalization();
  if (items.length === 0) return null;
  const label = t(MEAL_KEY[type]);
  return (
    <Card accessibilityLabel={`${label} ${t('nutrition.log.entries')}`}>
      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="label">{label}</AppText>
        {items.map((item) => (
          <LoggedItemRow key={item.id} item={item} />
        ))}
      </View>
    </Card>
  );
}

function TargetLine({
  label,
  consumed,
  target,
  unit,
  language,
}: {
  label: string;
  consumed: number;
  target: number | null;
  unit: string;
  language: SupportedLanguage;
}) {
  return (
    <AppText variant="caption" tone="muted">
      {label} {formatNumber(consumed, language)}
      {target != null ? ` / ${formatNumber(target, language)}` : ''}
      {unit}
    </AppText>
  );
}

function DailyTotals({ totals }: { totals: ConsumedMacros }) {
  const theme = useTheme();
  const { language, t } = useLocalization();
  const nutrition = useDashboardStore(
    (state) => state.data?.assessment?.assessment.nutrition ?? null,
  );

  return (
    <Card accessibilityLabel={t('nutrition.log.totalsAccessibility')}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="label">{t('nutrition.log.totals')}</AppText>
        {/* The same datum the assessment card and Nutrition targets render, so it
            goes through the same formatter — `2,500` there and `2500` here was a
            cross-surface disagreement in English, not a style choice. */}
        <AppText variant="headline">
          {formatNumber(totals.calories, language)}
          {nutrition ? ` / ${formatNumber(nutrition.calories, language)}` : ''} kcal
        </AppText>
        <View style={{ gap: 2 }}>
          <TargetLine
            label={t('nutrition.plan.protein')}
            consumed={totals.proteinG}
            target={nutrition?.proteinG ?? null}
            unit="g"
            language={language}
          />
          <TargetLine
            label={t('nutrition.plan.carbs')}
            consumed={totals.carbsG}
            target={nutrition?.carbsG ?? null}
            unit="g"
            language={language}
          />
          <TargetLine
            label={t('nutrition.plan.fat')}
            consumed={totals.fatG}
            target={nutrition?.fatG ?? null}
            unit="g"
            language={language}
          />
          {totals.fiberG != null ? (
            <TargetLine
              label={t('nutrition.log.fiber')}
              consumed={totals.fiberG}
              target={null}
              unit="g"
              language={language}
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
}

/** Local-first food log; copy is localized while persistence stays catalog-key based. */
export function FoodLogScreen() {
  const theme = useTheme();
  const { t } = useLocalization();
  const { status, items, totals, sync, writeError, load, addFood, syncNow } = useFoodLogStore();
  const { status: prefStatus, preferences, load: loadPreferences } = useDietaryPreferenceStore();

  useEffect(() => {
    void load();
    void loadPreferences();
  }, [load, loadPreferences]);

  const activePreferences = prefStatus === 'ready' ? preferences : [];
  const grouped = useMemo(
    () =>
      MEAL_SLOTS.map((type) => ({ type, items: items.filter((item) => item.mealType === type) })),
    [items],
  );

  // Local database is dormant on Web (ADR-P019): render an honest, info-tone
  // bilingual state — no sync banner, add form, entries, sync, or write controls.
  if (status === 'web-unavailable' || prefStatus === 'web-unavailable') {
    return (
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="headline">{t('nutrition.log.title')}</AppText>
          <AppText tone="muted">{t('nutrition.log.subtitle')}</AppText>
        </View>
        <Banner title={t('nutrition.log.webUnavailableTitle')} tone="info">
          {t('nutrition.log.webUnavailableBody')}
        </Banner>
      </View>
    );
  }

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="headline">{t('nutrition.log.title')}</AppText>
        <AppText tone="muted">{t('nutrition.log.subtitle')}</AppText>
      </View>

      <SyncBanner sync={sync} />

      {/* Write failures surface here, above the content they did not destroy. */}
      {writeError ? <WriteErrorBanner operation={writeError} /> : null}

      {status === 'loading' || status === 'idle' ? (
        <AppText accessibilityLabel={t('nutrition.log.loadingAccessibility')}>
          {t('nutrition.plan.loading')}
        </AppText>
      ) : status === 'error' ? (
        <Banner title={t('nutrition.log.unavailable')} tone="error">
          {t('nutrition.log.errorMessage')}
        </Banner>
      ) : (
        <>
          <FoodLogAddForm
            onAdd={(key, meal, count) => void addFood(key, meal, count)}
            activePreferences={activePreferences}
          />

          {items.length === 0 ? (
            <Card accessibilityLabel={t('nutrition.log.emptyAccessibility')}>
              <View style={{ gap: theme.spacing.sm }}>
                <AppText variant="title">{t('nutrition.log.emptyTitle')}</AppText>
                <AppText tone="muted">{t('nutrition.log.emptyMessage')}</AppText>
              </View>
            </Card>
          ) : (
            <>
              <DailyTotals totals={totals} />
              {grouped.map((group) => (
                <MealGroup key={group.type} type={group.type} items={group.items} />
              ))}
            </>
          )}

          <AppButton
            accessibilityLabel={t('nutrition.log.syncNowAccessibility')}
            testID="food-log-sync-now"
            variant="secondary"
            loading={sync.state === 'syncing'}
            onPress={() => void syncNow()}
          >
            {t('nutrition.log.syncNow')}
          </AppButton>
        </>
      )}

      <AppText variant="caption" tone="muted">
        {t('nutrition.plan.disclaimer')}
      </AppText>
    </View>
  );
}
