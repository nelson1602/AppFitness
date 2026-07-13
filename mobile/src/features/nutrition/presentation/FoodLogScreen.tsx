import { useEffect, useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { useDashboardStore } from '@/features/dashboard/application/dashboard.store';
import type { MealTypeName } from '@/shared/infrastructure/database/types';
import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useFoodLogStore, type FoodLogSyncSummary } from '../application/food-log.store';
import type { ConsumedMacros, LoggedMealItem } from '../domain/food-log';
import { MEAL_SLOTS } from '../domain/meal-plan';
import { NUTRITION_DISCLAIMER } from '../domain/nutrition-explain';
import { FoodLogAddForm } from './food-log/FoodLogAddForm';
import { formatServingCount, ServingStepper } from './food-log/ServingStepper';

const MEAL_LABEL: Record<MealTypeName, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  SNACK: 'Snack',
};

function SyncBanner({ sync }: { sync: FoodLogSyncSummary }) {
  switch (sync.state) {
    case 'syncing':
      return (
        <Banner title="Syncing" tone="info">
          Sending your food log.
        </Banner>
      );
    case 'offline':
      return (
        <Banner title="Offline" tone="warning">
          Your log is saved on this device and will sync later.
        </Banner>
      );
    case 'action_required':
      return (
        <Banner title="Action needed" tone="error">
          {sync.actionRequired} item(s) can’t sync because the food isn’t available on the server.
          Remove and re-add them to continue.
        </Banner>
      );
    case 'error':
      return (
        <Banner title="Sync needs attention" tone="error">
          Your log is saved locally. We’ll try again.
        </Banner>
      );
    case 'pending':
      return (
        <Banner title="Changes pending" tone="info">
          {sync.pending} change(s) waiting to sync.
        </Banner>
      );
    default:
      return (
        <Banner title="Log up to date" tone="success">
          Your food log is saved and synced.
        </Banner>
      );
  }
}

function ItemSyncChip({ item }: { item: LoggedMealItem }) {
  if (item.syncState === 'action_required') {
    return (
      <AppText variant="caption" tone="error" accessibilityLabel="Sync action required">
        Action needed
      </AppText>
    );
  }
  if (item.syncState === 'pending') {
    return (
      <AppText variant="caption" tone="muted" accessibilityLabel="Sync pending">
        Pending sync
      </AppText>
    );
  }
  return null;
}

function LoggedItemRow({ item }: { item: LoggedMealItem }) {
  const theme = useTheme();
  const editServing = useFoodLogStore((s) => s.editServing);
  const removeItem = useFoodLogStore((s) => s.removeItem);

  return (
    <View
      accessibilityLabel={`${item.name}, ${formatServingCount(item.servingCount)} servings`}
      testID={`logged-item-${item.id}`}
      style={{ gap: theme.spacing.sm }}
    >
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm }}
      >
        <AppText style={{ flexShrink: 1 }}>{item.name}</AppText>
        <ItemSyncChip item={item} />
      </View>
      <AppText variant="caption" tone="muted">
        {formatServingCount(item.servingCount)}× {item.serving.amount}
        {item.serving.unit} · {item.consumed.calories} kcal · P {item.consumed.proteinG}g / C{' '}
        {item.consumed.carbsG}g / F {item.consumed.fatG}g
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <ServingStepper
          value={item.servingCount}
          onChange={(next) => void editServing(item.id, next)}
          testIDPrefix={`edit-serving-${item.id}`}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.name}`}
          testID={`remove-item-${item.id}`}
          onPress={() => void removeItem(item.id)}
          style={{ padding: theme.spacing.sm }}
        >
          <AppText tone="error" variant="label">
            Remove
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

function MealGroup({ type, items }: { type: MealTypeName; items: LoggedMealItem[] }) {
  const theme = useTheme();
  if (items.length === 0) return null;
  return (
    <Card accessibilityLabel={`${MEAL_LABEL[type]} entries`}>
      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="label">{MEAL_LABEL[type]}</AppText>
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
  // Read-only target comparison from the deterministic assessment; never
  // recomputed or mutated here.
  const nutrition = useDashboardStore((s) => s.data?.assessment?.assessment.nutrition ?? null);

  return (
    <Card accessibilityLabel="Daily totals from your logged entries">
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="label">Today’s totals</AppText>
        <AppText variant="headline">
          {totals.calories}
          {nutrition ? ` / ${nutrition.calories}` : ''} kcal
        </AppText>
        <View style={{ gap: 2 }}>
          <TargetLine
            label="Protein"
            consumed={totals.proteinG}
            target={nutrition?.proteinG ?? null}
            unit="g"
          />
          <TargetLine
            label="Carbs"
            consumed={totals.carbsG}
            target={nutrition?.carbsG ?? null}
            unit="g"
          />
          <TargetLine
            label="Fat"
            consumed={totals.fatG}
            target={nutrition?.fatG ?? null}
            unit="g"
          />
          {totals.fiberG != null ? (
            <TargetLine label="Fiber" consumed={totals.fiberG} target={null} unit="g" />
          ) : null}
        </View>
      </View>
    </Card>
  );
}

/**
 * Food logging surface (Phase 15 Slice 4C). Local-first: entries are written
 * to SQLite and enqueued for sync; the read-only nutrition targets are shown
 * for context only and never recomputed. Business logic lives in the store /
 * repository — this screen only renders state and dispatches actions.
 */
export function FoodLogScreen() {
  const theme = useTheme();
  const { status, items, totals, sync, error, load, addFood, syncNow } = useFoodLogStore();

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(
    () => MEAL_SLOTS.map((type) => ({ type, items: items.filter((i) => i.mealType === type) })),
    [items],
  );

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="headline">Food log</AppText>
        <AppText tone="muted">
          Log what you eat today. Saved on your device first, synced when online.
        </AppText>
      </View>

      <SyncBanner sync={sync} />

      {status === 'loading' || status === 'idle' ? (
        <AppText accessibilityLabel="Loading food log">Loading…</AppText>
      ) : status === 'error' ? (
        <Banner title="Food log unavailable" tone="error">
          {error ?? 'Please try again.'}
        </Banner>
      ) : (
        <>
          <FoodLogAddForm onAdd={(key, meal, count) => void addFood(key, meal, count)} />

          {items.length === 0 ? (
            <Card accessibilityLabel="No food logged yet">
              <View style={{ gap: theme.spacing.sm }}>
                <AppText variant="title">Nothing logged yet</AppText>
                <AppText tone="muted">
                  Search the catalog above and add your first food to see your daily totals.
                </AppText>
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
            accessibilityLabel="Sync your food log now"
            testID="food-log-sync-now"
            variant="secondary"
            loading={sync.state === 'syncing'}
            onPress={() => void syncNow()}
          >
            Sync now
          </AppButton>
        </>
      )}

      <AppText variant="caption" tone="muted">
        {NUTRITION_DISCLAIMER}
      </AppText>
    </View>
  );
}
