import { useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { DietaryPreference, DietaryPreferenceInput } from '../domain/dietary-preference';
import { AVOID_TAGS, AVOID_TAG_LABELS, type AvoidTag } from '../domain/food-catalog';
import { getCanonicalByCatalogKey } from '../application/catalog-lookup.service';
import { search } from '../application/food-catalog.service';
import { useDietaryPreferenceStore } from '../application/dietary-preference.store';

/** Friendly labels for the closed catalog avoid-tag vocabulary (shared copy). */
const TAG_LABEL: Record<AvoidTag, string> = AVOID_TAG_LABELS;

const KIND_LABEL: Record<DietaryPreference['kind'], string> = {
  allergy: 'Allergy / sensitivity',
  preference: 'Preference / dislike',
};

function exclusionLabel(p: DietaryPreference): string {
  if (p.avoidTag) return `${TAG_LABEL[p.avoidTag] ?? p.avoidTag} · category`;
  if (p.catalogKey) {
    return `${getCanonicalByCatalogKey(p.catalogKey)?.name ?? p.catalogKey} · food`;
  }
  return 'Exclusion';
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

/**
 * Dietary preferences & allergies management (ADR-P014 / FEATURE-006 Slice
 * 2B). View / add / remove exclusions — either a catalog avoid-tag category or
 * a specific food — classified as an allergy/sensitivity or a
 * preference/dislike. ALL persistence goes through the Slice 2A store →
 * service → repository (local-first write, note encryption, sync enqueue); the
 * UI never touches SQLite. Not yet connected to meal-plan generation (Slice 3)
 * or food logging (Slice 4).
 */
export function DietaryPreferences() {
  const theme = useTheme();
  const { status, preferences, error, load, add, remove } = useDietaryPreferenceStore();

  const [mode, setMode] = useState<'category' | 'food'>('category');
  const [kind, setKind] = useState<DietaryPreference['kind']>('allergy');
  const [tag, setTag] = useState<AvoidTag | null>(null);
  const [query, setQuery] = useState('');
  const [food, setFood] = useState<{ catalogKey: string; name: string } | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    void load();
  }, [load]);

  const results = useMemo(() => (query.trim() ? search(query).slice(0, 8) : []), [query]);
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
        <AppText variant="headline">Dietary preferences & allergies</AppText>
        <AppText tone="muted">
          Tell your coach what to avoid. Allergies and sensitivities help personalize your meal
          planning — this is not emergency medical advice. Entries are saved on your device first and
          sync to your account later. Meal-plan integration arrives in the next update, so your
          current plan may not change yet.
        </AppText>
      </View>

      {error ? (
        <Banner title="Something went wrong" tone="error">
          {error}
        </Banner>
      ) : null}

      <Card accessibilityLabel="Add an exclusion">
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="title">Add an exclusion</AppText>

          <AppText variant="label" tone="muted">
            What are you excluding?
          </AppText>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Chip
              label="A category"
              testID="dp-mode-category"
              active={mode === 'category'}
              onPress={() => setMode('category')}
            />
            <Chip
              label="A specific food"
              testID="dp-mode-food"
              active={mode === 'food'}
              onPress={() => setMode('food')}
            />
          </View>

          <AppText variant="label" tone="muted">
            Why?
          </AppText>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Chip
              label={KIND_LABEL.allergy}
              testID="dp-kind-allergy"
              active={kind === 'allergy'}
              onPress={() => setKind('allergy')}
            />
            <Chip
              label={KIND_LABEL.preference}
              testID="dp-kind-preference"
              active={kind === 'preference'}
              onPress={() => setKind('preference')}
            />
          </View>

          {mode === 'category' ? (
            <View style={{ gap: theme.spacing.sm }}>
              <AppText variant="label" tone="muted">
                Category
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                {AVOID_TAGS.map((t) => (
                  <Chip
                    key={t}
                    label={TAG_LABEL[t]}
                    testID={`dp-tag-${t}`}
                    active={tag === t}
                    onPress={() => setTag(t)}
                  />
                ))}
              </View>
            </View>
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              <AppText variant="label" tone="muted">
                Find a food
              </AppText>
              <TextInput
                accessibilityLabel="Search foods to exclude"
                testID="dp-food-search"
                placeholder="Search foods…"
                placeholderTextColor={theme.colors.outline}
                value={query}
                onChangeText={(t) => {
                  setQuery(t);
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
                <AppText tone="muted">Selected: {food.name}</AppText>
              ) : (
                results.map((f) => (
                  <Pressable
                    key={f.id}
                    accessibilityRole="button"
                    testID={`dp-food-result-${f.id}`}
                    onPress={() => setFood({ catalogKey: f.id, name: f.name })}
                  >
                    <AppText>{f.name}</AppText>
                  </Pressable>
                ))
              )}
            </View>
          )}

          <TextInput
            accessibilityLabel="Optional note"
            testID="dp-note"
            placeholder="Optional note (encrypted on your device)"
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
            accessibilityLabel="Add exclusion"
            testID="dp-add"
            disabled={!canAdd}
            loading={status === 'saving'}
            onPress={() => void onAdd()}
          >
            Add exclusion
          </AppButton>
        </View>
      </Card>

      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="title">Your exclusions</AppText>
        {initialLoading ? (
          <AppText accessibilityLabel="Loading dietary preferences">Loading…</AppText>
        ) : preferences.length === 0 ? (
          <AppText tone="muted">No exclusions yet.</AppText>
        ) : (
          preferences.map((p) => (
            <Card key={p.id} accessibilityLabel={`Exclusion: ${exclusionLabel(p)}`}>
              <View style={{ gap: theme.spacing.xs }}>
                <AppText variant="label">{exclusionLabel(p)}</AppText>
                <AppText variant="caption" tone={p.kind === 'allergy' ? 'warning' : 'muted'}>
                  {KIND_LABEL[p.kind]}
                  {p.hasNote ? ' · note saved' : ''}
                </AppText>
                <AppButton
                  accessibilityLabel={`Remove exclusion: ${exclusionLabel(p)}`}
                  testID={`dp-remove-${p.id}`}
                  variant="text"
                  loading={status === 'saving'}
                  onPress={() => void remove(p.id)}
                >
                  Remove
                </AppButton>
              </View>
            </Card>
          ))
        )}
      </View>
    </View>
  );
}
