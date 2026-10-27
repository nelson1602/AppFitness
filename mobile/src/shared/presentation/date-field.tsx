import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { useLocalization } from '../localization/use-localization';
import { useTheme } from '../theme';
import { AppButton } from './app-button';
import { AppText } from './app-text';
import {
  datePattern,
  formatIsoForDisplay,
  isoToLocalDate,
  localDateToIso,
} from './date-field.format';
import { Icon } from './icon';

export interface DateFieldProps {
  label: string;
  /** `YYYY-MM-DD`, or null when empty. */
  value: string | null;
  onChange: (next: string) => void;
  /** `YYYY-MM-DD` bounds, inclusive. */
  minimumDate?: string;
  maximumDate?: string;
  /** Date the picker opens on when the field is empty. */
  initialDate?: string;
  error?: string;
  testID: string;
}

/**
 * A date field that opens the native date picker (ADR-P043) instead of asking
 * for typed AAAA-MM-DD text. Shows DD/MM/AAAA in Spanish and MM/DD/YYYY in
 * English; stores `YYYY-MM-DD`. Android opens the system dialog; iOS shows the
 * inline calendar under the field with a "Listo" button. Web has its own file.
 */
export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  initialDate,
  error,
  testID,
}: DateFieldProps) {
  const theme = useTheme();
  const { language, t } = useLocalization();
  const [iosOpen, setIosOpen] = useState(false);
  const display = formatIsoForDisplay(value, language);
  const current =
    isoToLocalDate(value) ??
    isoToLocalDate(initialDate) ??
    isoToLocalDate(maximumDate) ??
    new Date();
  const minimum = isoToLocalDate(minimumDate) ?? undefined;
  const maximum = isoToLocalDate(maximumDate) ?? undefined;

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        minimumDate: minimum,
        maximumDate: maximum,
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(localDateToIso(date));
        },
      });
      return;
    }
    setIosOpen((shown) => !shown);
  };

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText tone="onStage" variant="label">
        {label}
      </AppText>
      <Pressable
        accessibilityHint={t('form.date.openHint')}
        accessibilityLabel={`${label}, ${display || t('form.date.empty')}`}
        accessibilityRole="button"
        onPress={open}
        style={{
          alignItems: 'center',
          backgroundColor: theme.colors.fieldFill,
          borderColor: error ? theme.colors.errorOnStage : theme.colors.fieldIcon,
          borderRadius: theme.radius.field,
          borderWidth: 1,
          flexDirection: 'row',
          gap: theme.spacing.sm,
          minHeight: theme.spacing.x5l,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xs,
        }}
        testID={testID}
      >
        <Icon color={theme.colors.fieldIcon} name="calendar" size={18} />
        <AppText
          style={{ color: display ? theme.colors.onField : theme.colors.fieldIcon, flex: 1 }}
        >
          {display || datePattern(language)}
        </AppText>
      </Pressable>
      {iosOpen && Platform.OS === 'ios' ? (
        <View testID={`${testID}-ios-picker`}>
          <DateTimePicker
            display="inline"
            locale={language === 'es' ? 'es-DO' : 'en-US'}
            maximumDate={maximum}
            minimumDate={minimum}
            mode="date"
            onChange={(_, date) => {
              if (date) onChange(localDateToIso(date));
            }}
            value={current}
          />
          <AppButton onPress={() => setIosOpen(false)} variant="stage-link">
            {t('form.date.done')}
          </AppButton>
        </View>
      ) : null}
      {error ? (
        <AppText tone="errorOnStage" variant="label">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
