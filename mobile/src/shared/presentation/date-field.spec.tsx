import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { DateField } from './date-field';
import {
  datePattern,
  formatIsoForDisplay,
  isoToLocalDate,
  localDateToIso,
} from './date-field.format';

describe('date-field format helpers (ADR-P043)', () => {
  it('round-trips YYYY-MM-DD through the local calendar, with no day shift', () => {
    for (const iso of ['1990-03-15', '2026-12-31', '2000-02-29']) {
      const date = isoToLocalDate(iso);
      expect(date).not.toBeNull();
      expect(localDateToIso(date as Date)).toBe(iso);
    }
  });

  it('rejects malformed and rolled-over dates', () => {
    expect(isoToLocalDate('2026-02-30')).toBeNull();
    expect(isoToLocalDate('15/03/1990')).toBeNull();
    expect(isoToLocalDate(null)).toBeNull();
  });

  it('shows DD/MM/AAAA in Spanish and MM/DD/YYYY in English', () => {
    expect(formatIsoForDisplay('1990-03-15', 'es')).toBe('15/03/1990');
    expect(formatIsoForDisplay('1990-03-15', 'en')).toBe('03/15/1990');
    expect(formatIsoForDisplay(null, 'es')).toBe('');
    expect(datePattern('es')).toBe('DD/MM/AAAA');
    expect(datePattern('en')).toBe('MM/DD/YYYY');
  });
});

describe('DateField (Android)', () => {
  const original = Platform.OS;
  beforeAll(() => {
    Platform.OS = 'android';
  });
  afterAll(() => {
    Platform.OS = original;
  });
  beforeEach(() => jest.mocked(DateTimePickerAndroid.open).mockClear());

  it('shows the pattern when empty and opens the native dialog with the bounds', async () => {
    const onChange = jest.fn();
    await render(
      <DateField
        label="Birth date"
        maximumDate="2010-10-26"
        minimumDate="1920-01-01"
        onChange={onChange}
        testID="birth"
        value={null}
      />,
    );
    expect(screen.getByText('MM/DD/YYYY')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('birth'));
    const options = jest.mocked(DateTimePickerAndroid.open).mock.calls[0][0];
    expect(options.mode).toBe('date');
    expect(localDateToIso(options.maximumDate as Date)).toBe('2010-10-26');
    expect(localDateToIso(options.minimumDate as Date)).toBe('1920-01-01');

    await act(async () => {
      options.onChange?.(
        { type: 'set', nativeEvent: { timestamp: 0 } } as never,
        new Date(1990, 2, 15),
      );
    });
    expect(onChange).toHaveBeenCalledWith('1990-03-15');
  });

  it('ignores a dismissed dialog', async () => {
    const onChange = jest.fn();
    await render(<DateField label="Date" onChange={onChange} testID="d" value="2026-10-26" />);
    expect(screen.getByText('10/26/2026')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('d'));
    const options = jest.mocked(DateTimePickerAndroid.open).mock.calls[0][0];
    await act(async () => {
      options.onChange?.({ type: 'dismissed', nativeEvent: { timestamp: 0 } } as never, undefined);
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('names the field and its value for screen readers', async () => {
    await render(
      <DateField label="Target date" onChange={jest.fn()} testID="t" value="2027-01-31" />,
    );
    expect(screen.getByLabelText('Target date, 01/31/2027')).toBeOnTheScreen();
  });
});
