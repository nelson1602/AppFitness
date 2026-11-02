import { useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { birthDateBounds, defaultBirthDate } from '../application/birth-date';
import { useLocalization } from '../localization/use-localization';
import { useTheme } from '../theme';
import { AppButton } from './app-button';
import { AppText } from './app-text';
import { datePattern, formatIsoForDisplay } from './date-field.format';
import { clampDate } from './date-wheel.model';
import { DateWheelPicker } from './date-wheel-picker';
import { withAlpha } from './gradient-style';
import { Icon } from './icon';
import { useReducedMotion } from './use-reduced-motion';

export interface BirthDateFieldProps {
  label: string;
  /** `YYYY-MM-DD`, or null when empty. */
  value: string | null;
  onChange: (next: string) => void;
  /** The local calendar day, `YYYY-MM-DD`: the 16–100 range is measured from it. */
  today: string;
  error?: string;
  testID: string;
}

/**
 * The birth-date field (owner decision 2026-11-02, v8.1; ADR-P043 amendment).
 * Closed, it is the same field as `DateField` — the date as DD/MM/AAAA (ES)
 * or MM/DD/YYYY (EN) beside a calendar icon. Pressed, it opens a bottom sheet
 * with the Día / Mes / Año wheel instead of a month-by-month calendar: ages
 * 16 to 100, starting 30 years ago when empty. "Listo" saves the wheel's date
 * as `YYYY-MM-DD`; the system back gesture closes the sheet without saving.
 * Screen-reader focus lands on the year column when the sheet opens.
 */
export function BirthDateField({
  label,
  value,
  onChange,
  today,
  error,
  testID,
}: BirthDateFieldProps) {
  const theme = useTheme();
  const { colors, radius, spacing } = theme;
  const { language, t } = useLocalization();
  const reduceMotion = useReducedMotion();
  const yearRef = useRef<View>(null);
  const { min, max } = birthDateBounds(today);
  const [draft, setDraft] = useState<string | null>(null);
  const display = formatIsoForDisplay(value, language);

  const open = () => setDraft(clampDate(value, min, max, defaultBirthDate(today)));
  const close = () => setDraft(null);
  const done = () => {
    if (draft) onChange(draft);
    close();
  };
  const focusYear = () => {
    const year = yearRef.current;
    if (!year) return;
    if (Platform.OS === 'web') year.focus();
    else AccessibilityInfo.sendAccessibilityEvent(year, 'focus');
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText tone="onStage" variant="label">
        {label}
      </AppText>
      <Pressable
        accessibilityHint={t('form.dateWheel.openHint')}
        accessibilityLabel={`${label}, ${display || t('form.date.empty')}`}
        accessibilityRole="button"
        onPress={open}
        style={{
          alignItems: 'center',
          backgroundColor: colors.fieldFill,
          borderColor: error ? colors.errorOnStage : colors.fieldIcon,
          borderRadius: radius.field,
          borderWidth: 1,
          flexDirection: 'row',
          gap: spacing.sm,
          minHeight: theme.spacing.x5l,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
        }}
        testID={testID}
      >
        <Icon color={colors.fieldIcon} name="calendar" size={18} />
        <AppText style={{ color: display ? colors.onField : colors.fieldIcon, flex: 1 }}>
          {display || datePattern(language)}
        </AppText>
      </Pressable>
      {error ? (
        <AppText testID={`${testID}-error`} tone="errorOnStage" variant="caption">
          {error}
        </AppText>
      ) : null}
      {draft ? (
        <Modal
          animationType={reduceMotion ? 'none' : 'slide'}
          onRequestClose={close}
          onShow={focusYear}
          statusBarTranslucent
          transparent
          visible
        >
          {/* Like the notification list, the scrim is not a control: "Listo"
              saves and the system back gesture closes without saving. */}
          <View style={[styles.scrim, { backgroundColor: withAlpha(colors.stage, 0.75) }]}>
            <View
              accessibilityViewIsModal
              style={{
                backgroundColor: colors.stageDeep,
                borderColor: colors.glassBorder,
                borderTopLeftRadius: radius.sheet,
                borderTopRightRadius: radius.sheet,
                borderWidth: 1,
                gap: spacing.lg,
                paddingBottom: spacing.x3l,
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.lg,
              }}
              testID={`${testID}-sheet`}
            >
              <AppText accessibilityRole="header" tone="onStage" variant="title">
                {label}
              </AppText>
              <DateWheelPicker
                maximumDate={max}
                minimumDate={min}
                onChange={setDraft}
                testID={`${testID}-wheel`}
                value={draft}
                yearRef={yearRef}
              />
              <AppButton onPress={done} testID={`${testID}-done`}>
                {t('form.date.done')}
              </AppButton>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
  },
});
