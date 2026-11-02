import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Dimensions, FlatList, StyleSheet } from 'react-native';

import { birthDateBounds, defaultBirthDate, isBirthDateInRange } from '../application/birth-date';
import { BirthDateField } from './birth-date-field';
import { pickBirthDate } from './birth-date-field.testkit';
import { clampDate, columnValues, setPart, stepPart } from './date-wheel.model';

let mockLanguage: 'en' | 'es' = 'en';

jest.mock('../localization/use-localization', () => {
  const { en } = jest.requireActual('../localization/resources/en');
  const { es } = jest.requireActual('../localization/resources/es');
  return {
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: keyof typeof en) => (mockLanguage === 'es' ? es[key] : en[key]),
    }),
  };
});

const TODAY = '2026-11-02';
const { min: MIN, max: MAX } = birthDateBounds(TODAY);
// Jest's window reports fontScale 2, so a row is the title line height (28)
// doubled plus 12 dp: the large-text path, three rows tall.
const ROW = 28 * 2 + 12;

describe('birth-date rule (v8.1, ages 16 to 100)', () => {
  it('spans today − 100 years to today − 16 years and starts 30 years ago', () => {
    expect(birthDateBounds(TODAY)).toEqual({ min: '1926-11-02', max: '2010-11-02' });
    expect(defaultBirthDate(TODAY)).toBe('1996-11-02');
  });

  it('falls back to 28 February when today is 29 February and the target year has none', () => {
    expect(defaultBirthDate('2028-02-29')).toBe('1998-02-28');
    expect(birthDateBounds('2028-02-29')).toEqual({ min: '1928-02-29', max: '2012-02-29' });
    expect(birthDateBounds('2029-02-28')).toEqual({ min: '1929-02-28', max: '2013-02-28' });
  });

  it('accepts exactly the range, and nothing outside it', () => {
    expect(isBirthDateInRange('1926-11-02', TODAY)).toBe(true);
    expect(isBirthDateInRange('2010-11-02', TODAY)).toBe(true);
    expect(isBirthDateInRange('1926-11-01', TODAY)).toBe(false);
    expect(isBirthDateInRange('2010-11-03', TODAY)).toBe(false);
    expect(isBirthDateInRange(null, TODAY)).toBe(false);
    expect(isBirthDateInRange('02/11/1990', TODAY)).toBe(false);
  });
});

describe('date wheel model', () => {
  it('offers only the years in range, all 12 months, and the month’s days', () => {
    const values = columnValues('1992-02-10', MIN, MAX);
    expect(values.year[0]).toBe(1926);
    expect(values.year[values.year.length - 1]).toBe(2010);
    expect(values.month).toHaveLength(12);
    expect(values.day).toHaveLength(29);
    expect(columnValues('1993-02-10', MIN, MAX).day).toHaveLength(28);
    expect(columnValues('1993-07-10', MIN, MAX).day).toHaveLength(31);
  });

  it('clamps the day when the month or year changes', () => {
    expect(setPart('1990-01-31', 'month', 2, MIN, MAX)).toBe('1990-02-28');
    expect(setPart('1992-01-31', 'month', 2, MIN, MAX)).toBe('1992-02-29');
    expect(setPart('1992-02-29', 'year', 1993, MIN, MAX)).toBe('1993-02-28');
    expect(setPart('1990-03-31', 'month', 4, MIN, MAX)).toBe('1990-04-30');
  });

  it('keeps the whole date inside the range', () => {
    expect(setPart('2009-12-15', 'year', 2010, MIN, MAX)).toBe(MAX);
    expect(setPart('1927-01-15', 'year', 1926, MIN, MAX)).toBe(MIN);
    expect(clampDate('2020-01-01', MIN, MAX, '1996-11-02')).toBe(MAX);
    expect(clampDate(null, MIN, MAX, '1996-11-02')).toBe('1996-11-02');
  });

  it('steps one item and stops at the ends of a column', () => {
    expect(stepPart('1990-05-14', 'year', 1, MIN, MAX)).toBe('1991-05-14');
    expect(stepPart('1990-05-14', 'month', -1, MIN, MAX)).toBe('1990-04-14');
    expect(stepPart('1990-05-31', 'day', 1, MIN, MAX)).toBe('1990-05-31');
    expect(stepPart('1990-01-01', 'month', -1, MIN, MAX)).toBe('1990-01-01');
    expect(stepPart(MAX, 'year', 1, MIN, MAX)).toBe(MAX);
  });
});

describe('BirthDateField', () => {
  beforeEach(() => {
    mockLanguage = 'en';
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const renderField = async (value: string | null, onChange = jest.fn()) => {
    await render(
      <BirthDateField
        label="Date of birth"
        onChange={onChange}
        testID="dob"
        today={TODAY}
        value={value}
      />,
    );
    return onChange;
  };
  const column = (part: 'day' | 'month' | 'year') => screen.getByTestId(`dob-wheel-${part}`);
  const valueOf = (part: 'day' | 'month' | 'year') => column(part).props.accessibilityValue.text;
  const act11y = async (part: 'day' | 'month' | 'year', actionName: string) =>
    fireEvent(column(part), 'accessibilityAction', { nativeEvent: { actionName } });

  it('looks like the date field when closed and opens no picker until pressed', async () => {
    await renderField('1990-05-14');
    expect(screen.getByLabelText('Date of birth, 05/14/1990')).toBeOnTheScreen();
    expect(screen.queryByTestId('dob-sheet')).toBeNull();
  });

  it('starts an empty birth date exactly 30 years ago and saves it as YYYY-MM-DD', async () => {
    const onChange = await renderField(null);
    expect(screen.getByText('MM/DD/YYYY')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('dob'));
    expect(valueOf('year')).toBe('1996');
    expect(valueOf('month')).toBe('November');
    expect(valueOf('day')).toBe('2');
    await fireEvent.press(screen.getByTestId('dob-done'));
    expect(onChange).toHaveBeenCalledWith('1996-11-02');
    expect(screen.queryByTestId('dob-sheet')).toBeNull();
  });

  it('offers no year outside ages 16 to 100', async () => {
    await renderField(null);
    await fireEvent.press(screen.getByTestId('dob'));
    const row = (year: number) =>
      screen.queryByTestId(`dob-wheel-year-${year}`, { includeHiddenElements: true });
    expect(row(1926)).not.toBeNull();
    expect(row(2010)).not.toBeNull();
    expect(row(1925)).toBeNull();
    expect(row(2011)).toBeNull();
  });

  it('steps each column with the increment and decrement actions', async () => {
    const onChange = await renderField('1990-05-14');
    await fireEvent.press(screen.getByTestId('dob'));

    await act11y('year', 'increment');
    expect(valueOf('year')).toBe('1991');
    await act11y('month', 'decrement');
    expect(valueOf('month')).toBe('April');
    await act11y('day', 'increment');
    expect(valueOf('day')).toBe('15');

    for (const part of ['day', 'month', 'year'] as const) {
      expect(column(part).props.accessibilityRole).toBe('adjustable');
      expect(column(part).props.accessibilityActions).toEqual([
        { name: 'increment' },
        { name: 'decrement' },
      ]);
    }
    await fireEvent.press(screen.getByTestId('dob-done'));
    expect(onChange).toHaveBeenCalledWith('1991-04-15');
  });

  it('clamps the day when the month changes, and never passes the 16-year limit', async () => {
    const onChange = await renderField('1990-03-31');
    await fireEvent.press(screen.getByTestId('dob'));
    await act11y('month', 'decrement');
    expect(valueOf('month')).toBe('February');
    expect(valueOf('day')).toBe('28');

    await pickBirthDate('dob', '2010-11-02');
    expect(onChange).toHaveBeenLastCalledWith('2010-11-02');
  });

  it('cannot step past the youngest allowed date', async () => {
    const onChange = await renderField('2010-11-02');
    await fireEvent.press(screen.getByTestId('dob'));
    await act11y('year', 'increment');
    await act11y('month', 'increment');
    await act11y('day', 'increment');
    await fireEvent.press(screen.getByTestId('dob-done'));
    expect(onChange).toHaveBeenCalledWith('2010-11-02');
  });

  it('puts the year column first for screen readers and shows Día / Mes / Año', async () => {
    await renderField('1990-05-14');
    await fireEvent.press(screen.getByTestId('dob'));
    // Tree (focus) order is Year, Month, Day…
    expect(screen.getAllByRole('adjustable').map((node) => node.props.accessibilityLabel)).toEqual([
      'Year',
      'Month',
      'Day',
    ]);
    // …and row-reverse lays them out Day / Month / Year.
    expect(StyleSheet.flatten(screen.getByTestId('dob-wheel').props.style).flexDirection).toBe(
      'row-reverse',
    );
  });

  it('moves screen-reader focus to the year when the sheet opens', async () => {
    const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation();
    await renderField('1990-05-14');
    await fireEvent.press(screen.getByTestId('dob'));
    await act(async () => {
      await fireEvent(screen.getByTestId('dob-sheet'), 'show');
    });
    expect(send).toHaveBeenCalledWith(expect.anything(), 'focus');
  });

  it('speaks Spanish month names and column labels in Spanish', async () => {
    mockLanguage = 'es';
    await renderField('1990-05-14');
    expect(screen.getByText('14/05/1990')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('dob'));
    expect(valueOf('month')).toBe('mayo');
    expect(screen.getAllByRole('adjustable').map((node) => node.props.accessibilityLabel)).toEqual([
      'Año',
      'Mes',
      'Día',
    ]);
    expect(screen.getByText('Listo')).toBeOnTheScreen();
  });

  it('selects the row a fling settles on', async () => {
    const onChange = await renderField('1990-05-14');
    await fireEvent.press(screen.getByTestId('dob'));
    const list = screen.getByTestId('dob-wheel-year-list', { includeHiddenElements: true });
    // Index 2 of the year column is 1928.
    await fireEvent(list, 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 0, y: 2 * ROW } },
    });
    expect(valueOf('year')).toBe('1928');
    await fireEvent.press(screen.getByTestId('dob-done'));
    expect(onChange).toHaveBeenCalledWith('1928-05-14');
  });

  it('closes without saving on the system back gesture', async () => {
    const onChange = await renderField('1990-05-14');
    await fireEvent.press(screen.getByTestId('dob'));
    await act11y('year', 'increment');
    await act(async () => {
      await fireEvent(screen.getByTestId('dob-sheet'), 'requestClose');
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId('dob-sheet')).toBeNull();
  });

  it('keeps 48 dp rows at the default text size and grows them with large text', async () => {
    const height = () =>
      StyleSheet.flatten(screen.getByTestId('dob-wheel').props.style).height as number;
    await renderField('1990-05-14');
    await fireEvent.press(screen.getByTestId('dob'));
    expect(height()).toBe(3 * ROW);
    await screen.unmount();

    jest
      .spyOn(Dimensions, 'get')
      .mockReturnValue({ fontScale: 1, height: 800, scale: 2, width: 400 });
    await renderField('1990-05-14');
    await fireEvent.press(screen.getByTestId('dob'));
    expect(height()).toBe(5 * 48);
  });

  it('scrolls without animation when reduce motion is on', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const scroll = jest.spyOn(FlatList.prototype, 'scrollToOffset');
    await renderField('1990-05-14');
    await fireEvent.press(screen.getByTestId('dob'));
    await act11y('year', 'increment');
    expect(scroll).toHaveBeenLastCalledWith({ offset: 65 * ROW, animated: false });
  });

  it('animates the scroll when reduce motion is off', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const scroll = jest.spyOn(FlatList.prototype, 'scrollToOffset');
    await renderField('1990-05-14');
    await fireEvent.press(screen.getByTestId('dob'));
    await act(async () => {});
    await act11y('year', 'increment');
    expect(scroll).toHaveBeenLastCalledWith({ offset: 65 * ROW, animated: true });
  });
});
