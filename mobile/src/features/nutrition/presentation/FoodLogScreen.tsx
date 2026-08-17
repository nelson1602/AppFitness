import { useEffect, useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { useDashboardStore } from '@/features/dashboard/application/dashboard.store';
import type { MealTypeName } from '@/shared/infrastructure/database/types';
import { useLocalization, type TranslationKey } from '@/shared/localization';
import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useDietaryPreferenceStore } from '../application/dietary-preference.store';
import { foodDisplayName } from '../application/food-display.service';
import { getById } from '../application/food-catalog.service';
import { useFoodLogStore, type FoodLogSyncSummary } from '../application/food-log.store';
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

function SyncBanner({ sync }: { sync: FoodLogSyncSummary }) {
  const { t } = useLocalization();
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
      return (
        <Banner title={t('nutrition.log.actionTitle')} tone="error">
          {sync.actionRequired}{' '}
          {t(
            sync.actionRequired === 1
              ? 'nutrition.log.actionMessageOne'
              : 'nutrition.log.actionMessageMany',
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
          {sync.pending}{' '}
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

  return (
    <View
      accessibilityLabel={`${displayName}, ${formatServingCount(item.servingCount)} ${t('nutrition.log.servings')}`}
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
        {formatServingCount(item.servingCount)}× {item.serving.amount}
        {item.serving.unit} · {item.consumed.calories} kcal · {t('nutrition.plan.protein')}{' '}
        {item.consumed.proteinG}g · {t('nutrition.plan.carbs')} {item.consumed.carbsG}g ·{' '}
        {t('nutrition.plan.fat')} {item.consumed.fatG}g
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
          style={{ padding: theme.spacing.sm }}
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
}: {
  label: string;
  consumed: number;
  target: number | null;
  unit: string;
}) {
  return (
    <AppText variant="caption" tone="muted">
      {label} {consumed}
      {target != null ? ` / ${target}` : ''}
      {unit}
    </AppText>
  );
}

function DailyTotals({ totals }: { totals: ConsumedMacros }) {
  const theme = useTheme();
  const { t } = useLocalization();
  const nutrition = useDashboardStore(
    (state) => state.data?.assessment?.assessment.nutrition ?? null,
  );

  return (
    <Card accessibilityLabel={t('nutrition.log.totalsAccessibility')}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="label">{t('nutrition.log.totals')}</AppText>
        <AppText variant="headline">
          {totals.calories}
          {nutrition ? ` / ${nutrition.calories}` : ''} kcal
        </AppText>
        <View style={{ gap: 2 }}>
          <TargetLine
            label={t('nutrition.plan.protein')}
            consumed={totals.proteinG}
            target={nutrition?.proteinG ?? null}
            unit="g"
          />
          <TargetLine
            label={t('nutrition.plan.carbs')}
            consumed={totals.carbsG}
            target={nutrition?.carbsG ?? null}
            unit="g"
          />
          <TargetLine
            label={t('nutrition.plan.fat')}
            consumed={totals.fatG}
            target={nutrition?.fatG ?? null}
            unit="g"
          />
          {totals.fiberG != null ? (
            <TargetLine
              label={t('nutrition.log.fiber')}
              consumed={totals.fiberG}
              target={null}
              unit="g"
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
  const { status, items, totals, sync, load, addFood, syncNow } = useFoodLogStore();
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
