import { fireEvent, screen } from '@testing-library/react-native';

/**
 * Test helper (v8.1, ADR-P043 amendment): picks `iso` in the `BirthDateField`
 * with `testID` the way a person does — open the sheet, tap the year, the
 * month and the day on the wheel, then "Listo". The year goes first so a
 * month or day is never clamped by the previous year.
 */
export async function pickBirthDate(testID: string, iso: string): Promise<void> {
  const [year, month, day] = iso.split('-').map(Number);
  await fireEvent.press(screen.getByTestId(testID));
  const row = (part: string, value: number) =>
    screen.getByTestId(`${testID}-wheel-${part}-${value}`, { includeHiddenElements: true });
  await fireEvent.press(row('year', year));
  await fireEvent.press(row('month', month));
  await fireEvent.press(row('day', day));
  await fireEvent.press(screen.getByTestId(`${testID}-done`));
}
