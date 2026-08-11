import { useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import {
  useLocalization,
  type SupportedLanguage,
  type TranslationKey,
} from '@/shared/localization';
import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { getCanonicalByCatalogKey } from '../application/catalog-lookup.service';
import { useDietaryPreferenceStore } from '../application/dietary-preference.store';
import { foodDisplayName, searchFoodsForDisplay } from '../application/food-display.service';
import type { DietaryPreference, DietaryPreferenceInput } from '../domain/dietary-preference';
import { AVOID_TAGS, type AvoidTag } from '../domain/food-catalog';

type Translate = (key: TranslationKey) => string;

const TAG_KEY: Record<AvoidTag, TranslationKey> = {
  nut_allergy: 'nutrition.avoid.nuts',
  shellfish_allergy: 'nutrition.avoid.shellfish',
  gluten_sensitive: 'nutrition.avoid.gluten',
  lactose_sensitive: 'nutrition.avoid.lactose',
  high_sodium_sensitive: 'nutrition.avoid.sodium',
  high_purine: 'nutrition.avoid.purine',
};

const KIND_KEY: Record<DietaryPreference['kind'], TranslationKey> = {
  allergy: 'nutrition.preferences.allergy',
  preference: 'nutrition.preferences.preference',
};

function exclusionLabel(
  preference: DietaryPreference,
  language: SupportedLanguage,
  t: Translate,
): string {
  if (preference.avoidTag) {
    return `${t(TAG_KEY[preference.avoidTag])} · ${t('nutrition.preferences.categorySuffix')}`;
  }
  if (preference.catalogKey) {
    const food = getCanonicalByCatalogKey(preference.catalogKey);
    const name = food ? foodDisplayName(food, language) : preference.catalogKey;
    return `${name} · ${t('nutrition.preferences.foodSuffix')}`;
  }
  return t('nutrition.preferences.exclusion');
}

function Chip({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      testID={testID}
      onPress={onPress}
      style={{
        backgroundColor: active ? theme.colors.primary : theme.colors.surfaceVariant,
        borderColor: active ? theme.colors.primary : theme.colors.outline,
        borderRadius: theme.radius.medium,
        borderWidth: 1,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
      }}
    >
      <AppText tone={active ? 'default' : 'muted'} variant="label">
        {label}
      </AppText>
    </Pressable>
  );
}

/** Local-first dietary exclusions; presentation language never changes stored identity. */
export function DietaryPreferences() {
  const theme = useTheme();
  const { language, t } = useLocalization();
  const { status, preferences, error, load, add, remove } = useDietaryPreferenceStore();

  const [mode, setMode] = useState<'category' | 'food'>('category');
  const [kind, setKind] = useState<DietaryPreference['kind']>('allergy');
  const [tag, setTag] = useState<AvoidTag | null>(null);
  const [query, setQuery] = useState('');
  const [food, setFood] = useState<{ catalogKey: string } | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    void load();
  }, [load]);

  const results = useMemo(
    () => (query.trim() ? searchFoodsForDisplay(query, language).slice(0, 8) : []),
    [language, query],
  );
  const selectedFood = food ? getCanonicalByCatalogKey(food.catalogKey) : null;
  const canAdd = mode === 'category' ? tag !== null : food !== null;
  const initialLoading = status === 'loading' && preferences.length === 0;

  const reset = () => {
    setTag(null);
    setQuery('');
    setFood(null);
    setNote('');
  };

  const onAdd = async () => {
    const base = { kind, note: note.trim() || null };
    const input: DietaryPreferenceInput =
      mode === 'category'
        ? { ...base, exclusionType: 'avoid_tag', avoidTag: tag }
        : { ...base, exclusionType: 'catalog_key', catalogKey: food?.catalogKey };
    const ok = await add(input);
    if (ok) reset();
  };

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="headline">{t('nutrition.preferences.title')}</AppText>
        <AppText tone="muted">{t('nutrition.preferences.subtitle')}</AppText>
      </View>

      {error ? (
        <Banner title={t('nutrition.preferences.errorTitle')} tone="error">
          {t('nutrition.preferences.errorMessage')}
        </Banner>
      ) : null}

      <Card accessibilityLabel={t('nutrition.preferences.addAccessibility')}>
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="title">{t('nutrition.preferences.addTitle')}</AppText>

          <AppText variant="label" tone="muted">
            {t('nutrition.preferences.what')}
          </AppText>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Chip
              label={t('nutrition.preferences.categoryChoice')}
              testID="dp-mode-category"
              active={mode === 'category'}
              onPress={() => setMode('category')}
            />
            <Chip
              label={t('nutrition.preferences.foodChoice')}
              testID="dp-mode-food"
              active={mode === 'food'}
              onPress={() => setMode('food')}
            />
          </View>

          <AppText variant="label" tone="muted">
            {t('nutrition.preferences.why')}
          </AppText>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Chip
              label={t(KIND_KEY.allergy)}
              testID="dp-kind-allergy"
              active={kind === 'allergy'}
              onPress={() => setKind('allergy')}
            />
            <Chip
              label={t(KIND_KEY.preference)}
              testID="dp-kind-preference"
              active={kind === 'preference'}
              onPress={() => setKind('preference')}
            />
          </View>

          {mode === 'category' ? (
            <View style={{ gap: theme.spacing.sm }}>
              <AppText variant="label" tone="muted">
                {t('nutrition.preferences.category')}
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                {AVOID_TAGS.map((avoidTag) => (
                  <Chip
                    key={avoidTag}
                    label={t(TAG_KEY[avoidTag])}
                    testID={`dp-tag-${avoidTag}`}
                    active={tag === avoidTag}
                    onPress={() => setTag(avoidTag)}
                  />
                ))}
              </View>
            </View>
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              <AppText variant="label" tone="muted">
                {t('nutrition.preferences.findFood')}
              </AppText>
              <TextInput
                accessibilityLabel={t('nutrition.preferences.searchAccessibility')}
                testID="dp-food-search"
                placeholder={t('nutrition.preferences.searchPlaceholder')}
                placeholderTextColor={theme.colors.outline}
                value={query}
                onChangeText={(text) => {
                  setQuery(text);
                  setFood(null);
                }}
                style={{
                  borderColor: theme.colors.outline,
                  borderRadius: theme.radius.medium,
                  borderWidth: 1,
                  color: theme.colors.onSurface,
                  padding: theme.spacing.sm,
                }}
              />
              {food ? (
                <AppText tone="muted">
                  {t('nutrition.preferences.selected')}:{' '}
                  {selectedFood ? foodDisplayName(selectedFood, language) : food.catalogKey}
                </AppText>
              ) : (
                results.map((result) => (
                  <Pressable
                    key={result.id}
                    accessibilityRole="button"
                    testID={`dp-food-result-${result.id}`}
                    onPress={() => setFood({ catalogKey: result.id })}
                  >
                    <AppText>{foodDisplayName(result, language)}</AppText>
                  </Pressable>
                ))
              )}
            </View>
          )}

          <TextInput
            accessibilityLabel={t('nutrition.preferences.noteAccessibility')}
            testID="dp-note"
            placeholder={t('nutrition.preferences.notePlaceholder')}
            placeholderTextColor={theme.colors.outline}
            value={note}
            onChangeText={setNote}
            style={{
              borderColor: theme.colors.outline,
              borderRadius: theme.radius.medium,
              borderWidth: 1,
              color: theme.colors.onSurface,
              padding: theme.spacing.sm,
            }}
          />

          <AppButton
            accessibilityLabel={t('nutrition.preferences.addAccessibility')}
            testID="dp-add"
            disabled={!canAdd}
            loading={status === 'saving'}
            onPress={() => void onAdd()}
          >
            {t('nutrition.preferences.addButton')}
          </AppButton>
        </View>
      </Card>

      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="title">{t('nutrition.preferences.listTitle')}</AppText>
        {initialLoading ? (
          <AppText accessibilityLabel={t('nutrition.preferences.loadingAccessibility')}>
            {t('nutrition.plan.loading')}
          </AppText>
        ) : preferences.length === 0 ? (
          <AppText tone="muted">{t('nutrition.preferences.empty')}</AppText>
        ) : (
          preferences.map((preference) => {
            const label = exclusionLabel(preference, language, t);
            return (
              <Card
                key={preference.id}
                accessibilityLabel={`${t('nutrition.preferences.exclusion')}: ${label}`}
              >
                <View style={{ gap: theme.spacing.xs }}>
                  <AppText variant="label">{label}</AppText>
                  <AppText
                    variant="caption"
                    tone={preference.kind === 'allergy' ? 'warning' : 'muted'}
                  >
                    {t(KIND_KEY[preference.kind])}
                    {preference.hasNote ? ` · ${t('nutrition.preferences.noteSaved')}` : ''}
                  </AppText>
                  <AppButton
                    accessibilityLabel={`${t('nutrition.preferences.removeAccessibility')}: ${label}`}
                    testID={`dp-remove-${preference.id}`}
                    variant="text"
                    loading={status === 'saving'}
                    onPress={() => void remove(preference.id)}
                  >
                    {t('nutrition.preferences.remove')}
                  </AppButton>
                </View>
              </Card>
            );
          })
        )}
      </View>
    </View>
  );
}
