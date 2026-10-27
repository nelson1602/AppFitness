import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { isoToLocalDate } from './date-field.format';

/**
 * Test helper (ADR-P043): picks `iso` in the `DateField` with `testID` through
 * the mocked Android dialog, the way a person confirms a date. Returns the
 * options the dialog was opened with, so a test can check its bounds.
 */
export async function pickDate(
  testID: string,
  iso: string,
): Promise<Parameters<typeof DateTimePickerAndroid.open>[0]> {
  const original = Platform.OS;
  Platform.OS = 'android';
  try {
    jest.mocked(DateTimePickerAndroid.open).mockClear();
    await fireEvent.press(screen.getByTestId(testID));
    const options = jest.mocked(DateTimePickerAndroid.open).mock.calls[0][0];
    const date = isoToLocalDate(iso);
    if (!date) throw new Error(`pickDate: ${iso} is not a calendar date`);
    await act(async () => {
      options.onValueChange?.({ type: 'set', nativeEvent: { timestamp: 0 } } as never, date);
    });
    return options;
  } finally {
    Platform.OS = original;
  }
}
