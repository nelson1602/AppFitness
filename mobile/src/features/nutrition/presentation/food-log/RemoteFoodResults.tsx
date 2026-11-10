import { Pressable, View } from 'react-native';

import {
  formatKcal,
  formatNumber,
  type TranslationKey,
  useLocalization,
} from '@/shared/localization';
import { AppText, Chip, useStageSurface } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { FoodSearchResult } from '../../infrastructure/food-search-api';
import type { RemoteSearchStatus } from './use-food-search';

const SOURCE_KEY: Record<FoodSearchResult['source'], TranslationKey> = {
  catalog: 'nutrition.search.sourceShared',
  custom: 'nutrition.search.sourceMine',
  fdc: 'nutrition.search.sourceFdc',
  off: 'nutrition.search.sourceOff',
};

const STATUS_KEY: Partial<Record<RemoteSearchStatus, TranslationKey>> = {
  loading: 'nutrition.search.loading',
  offline: 'nutrition.search.offline',
  unavailable: 'nutrition.search.unavailable',
  error: 'nutrition.search.unavailable',
};

/**
 * "Más alimentos" (v10 Block B, item 7): server results beyond the phone —
 * the shared catalogue, USDA FoodData Central and Open Food Facts — each
 * labelled with its source, plus why there are none (offline, unavailable).
 * Open Food Facts data is shown with its attribution (ODbL).
 */
export function RemoteFoodResults({
  results,
  status,
  disabled,
  onChoose,
}: {
  results: readonly FoodSearchResult[];
  status: RemoteSearchStatus;
  disabled: boolean;
  onChoose: (result: FoodSearchResult) => void;
}) {
  const theme = useTheme();
  const stage = useStageSurface();
  const { language, t } = useLocalization();
  const statusKey = STATUS_KEY[status];
  if (status === 'idle' || (!statusKey && results.length === 0)) return null;

  return (
    <View style={{ gap: theme.spacing.xs }} testID="food-remote-results">
      <AppText accessibilityRole="header" tone="muted" variant="caption">
        {t('nutrition.search.remoteTitle')}
      </AppText>
      {statusKey ? (
        <AppText
          accessibilityLiveRegion="polite"
          testID={`food-remote-status-${status}`}
          tone="muted"
          variant="caption"
        >
          {t(statusKey)}
        </AppText>
      ) : null}
      {results.map((result) => {
        const serving = `${formatNumber(result.servingAmount, language)} ${result.servingUnit}`;
        return (
          <Pressable
            key={`${result.source}:${result.sourceId}`}
            accessibilityLabel={`${t('nutrition.log.choose')} ${result.name}`}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => onChoose(result)}
            style={{
              borderColor: stage ? theme.colors.glassBorder : theme.colors.outline,
              borderRadius: theme.radius.medium,
              borderWidth: 1,
              gap: theme.spacing.xs,
              minHeight: theme.spacing.x5l,
              opacity: disabled ? 0.56 : 1,
              padding: theme.spacing.md,
            }}
            testID={`food-remote-${result.source}-${result.sourceId}`}
          >
            <AppText>{result.name}</AppText>
            <View
              style={{
                alignItems: 'center',
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: theme.spacing.sm,
              }}
            >
              <AppText tone="muted" variant="caption">
                {`${serving} · ${formatKcal(result.caloriesPerServing, language)} kcal`}
                {result.brand ? ` · ${result.brand}` : ''}
              </AppText>
              <Chip label={t(SOURCE_KEY[result.source])} tone="neutral" />
            </View>
          </Pressable>
        );
      })}
      {results.some((result) => result.source === 'fdc' || result.source === 'off') ? (
        <AppText testID="food-remote-attribution" tone="muted" variant="caption">
          {t('nutrition.search.attribution')}
        </AppText>
      ) : null}
    </View>
  );
}
