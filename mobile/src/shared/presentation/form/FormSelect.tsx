import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/shared/theme';

import { AppText } from '../app-text';
import { usePaidWriteDisabled } from '../paid-write-context';
import { useStageSurface } from '../stage-surface';

interface Option {
  label: string;
  value: string;
}

interface FormSelectProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  options: readonly Option[];
  required?: boolean;
}

/**
 * Reusable React Hook Form enum selector rendered as a row of pressable
 * chips (no UI framework / native picker). RHF-`Controller`-driven.
 * Shared across the profile, goal, and medical forms.
 */
export function FormSelect<T extends FieldValues>({
  control,
  name,
  label,
  options,
  required = false,
}: FormSelectProps<T>) {
  const theme = useTheme();
  const stage = useStageSurface();
  const disabled = usePaidWriteDisabled();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label">
            {label}
            {required ? ' *' : ''}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {options.map((opt) => {
              const selected = value === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled }}
                  accessibilityLabel={`${label}: ${opt.label}`}
                  testID={`option-${name}-${opt.value}`}
                  disabled={disabled}
                  onPress={() => onChange(opt.value)}
                  // v8 Block 3: on the stage, the evaluation's chip (cyan when chosen).
                  style={{
                    backgroundColor: stage
                      ? selected
                        ? theme.colors.accentCyan
                        : theme.colors.glassFill
                      : selected
                        ? theme.colors.primary
                        : theme.colors.surfaceVariant,
                    borderColor: stage
                      ? selected
                        ? theme.colors.onStage
                        : theme.colors.glassBorder
                      : selected
                        ? theme.colors.primary
                        : theme.colors.outline,
                    borderRadius: theme.radius.medium,
                    borderWidth: 1,
                    minHeight: theme.spacing.x5l,
                    // BUG-023: a short option label ("Sí") left the target
                    // 39.6 dp wide, under the 44×44 floor.
                    minWidth: theme.spacing.x5l,
                    opacity: disabled ? 0.56 : 1,
                    justifyContent: 'center',
                    paddingHorizontal: theme.spacing.md,
                  }}
                >
                  {stage ? (
                    // The evaluation chip's label: dark on cyan, light on glass.
                    <AppText
                      style={{
                        color: selected ? theme.colors.stageDeep : theme.colors.onStageVariant,
                      }}
                    >
                      {opt.label}
                    </AppText>
                  ) : (
                    <AppText tone={selected ? 'onPrimary' : 'muted'}>{opt.label}</AppText>
                  )}
                </Pressable>
              );
            })}
          </View>
          {error ? (
            <AppText variant="caption" tone="error">
              {error.message}
            </AppText>
          ) : null}
        </View>
      )}
    />
  );
}
