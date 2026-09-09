import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Pressable, View } from 'react-native';

import { AppText } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { WellnessTokenOption } from './wellness-token-labels';

/**
 * Multi-select token group (ADR-P017 **W-3**).
 *
 * The shared `FormSelect` is a single-value radio row; a limitation list is a
 * multi-select, so this is the smallest possible sibling of it — same chip
 * anatomy, same theme tokens, same 48pt minimum target — differing only in
 * arity and therefore in role: `checkbox` per chip, not `radio`.
 *
 * **Selection never depends on colour** (ADR-P022 Decision 7, `.ai/08_UI_UX.md`
 * §Non-colour redundancy). A selected chip carries three redundant signals: a
 * visible marker glyph, a heavier border, and `accessibilityState`. The colour
 * change is the fourth, not the only one. The marker duplicates the state that
 * assistive technology already receives, so it is deliberately kept out of the
 * accessible name — the chip's `accessibilityLabel` is set explicitly, so the
 * glyph is never announced.
 *
 * The stored value is always the language-neutral token: the label is only ever
 * read forwards, so a translated string cannot become persisted data.
 *
 * ── Measured contrast (WCAG 2.2 AA, both themes) ────────────────────────────
 * The selected fill is the **container** pair rather than `FormSelect`'s
 * `primary` fill, which renders its label through `onSurface` and therefore
 * measures 1.42:1 in the dark theme (`.ai/08_UI_UX.md` §Finding 1, FEATURE-010).
 * This component must not reproduce that defect, and it decides no token value:
 * it uses the shipped `primaryContainer` role as designed.
 *
 * | Pairing | Light | Dark |
 * |---|---|---|
 * | label `onSurface` on `primaryContainer` (selected) | 13.79:1 | 6.87:1 |
 * | label `onSurfaceVariant` on `surfaceVariant` (unselected) | 8.23:1 | 8.76:1 |
 * | border `primary` on `surfaceVariant` (selected, non-text ≥3:1) | 3.12:1 | 8.13:1 |
 * | border `outline` on `surfaceVariant` (unselected, non-text ≥3:1) | 3.96:1 | 4.69:1 |
 */

/** Non-colour selected marker. Not an icon — a text glyph, hidden from AT. */
const SELECTED_MARKER = '✓';

const UNSELECTED_BORDER = 1;
const SELECTED_BORDER = 2;

interface WellnessTokenGroupProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  /** The group's visible legend; also the prefix of each chip's accessible name. */
  legend: string;
  /** Visible guidance, rendered as content so it is read rather than inferred. */
  hint: string;
  options: readonly WellnessTokenOption[];
  /** Prefix for each chip's `testID`, e.g. `area` → `wellness-area-knee`. */
  testIDPrefix: string;
}

export function WellnessTokenGroup<T extends FieldValues>({
  control,
  name,
  legend,
  hint,
  options,
  testIDPrefix,
}: WellnessTokenGroupProps<T>) {
  const theme = useTheme();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value } }) => {
        const selected: string[] = Array.isArray(value) ? value : [];
        const toggle = (token: string) =>
          onChange(
            selected.includes(token)
              ? selected.filter((current) => current !== token)
              : [...selected, token],
          );

        return (
          <View style={{ gap: theme.spacing.sm }} accessibilityLabel={legend}>
            <AppText variant="label">{legend}</AppText>
            <AppText variant="caption" tone="muted">
              {hint}
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {options.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected, selected: isSelected }}
                    accessibilityLabel={`${legend}: ${option.label}`}
                    testID={`wellness-${testIDPrefix}-${option.value}`}
                    onPress={() => toggle(option.value)}
                    style={{
                      alignItems: 'center',
                      backgroundColor: isSelected
                        ? theme.colors.primaryContainer
                        : theme.colors.surfaceVariant,
                      borderColor: isSelected ? theme.colors.primary : theme.colors.outline,
                      borderRadius: theme.radius.medium,
                      borderWidth: isSelected ? SELECTED_BORDER : UNSELECTED_BORDER,
                      flexDirection: 'row',
                      gap: theme.spacing.xs,
                      justifyContent: 'center',
                      minHeight: theme.spacing.x5l,
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.sm,
                    }}
                  >
                    {isSelected ? (
                      <AppText
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                        testID={`wellness-${testIDPrefix}-${option.value}-marker`}
                        variant="label"
                      >
                        {SELECTED_MARKER}
                      </AppText>
                    ) : null}
                    <AppText tone={isSelected ? 'default' : 'muted'}>{option.label}</AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      }}
    />
  );
}
