/**
 * The birth-date rule (owner decision 2026-11-02, v8.1; ADR-P043 amendment):
 * a person is between 16 and 100 years old today, so a birth date lies in
 * [today − 100 years, today − 16 years], and an empty birth date starts at
 * exactly 30 years ago. Dates are calendar dates, `YYYY-MM-DD`, compared as
 * strings; 29 February falls back to the 28th in a year without one.
 */
export const BIRTH_DATE_AGE = { min: 16, max: 100, default: 30 } as const;

/** `YYYY-MM-DD` shifted by whole years; 29 February falls back to the 28th. */
export function shiftYears(iso: string, years: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y + years, m - 1, d));
  if (target.getUTCMonth() !== m - 1) target.setUTCDate(0);
  return target.toISOString().slice(0, 10);
}

/** The inclusive `YYYY-MM-DD` range a birth date may take on `today`. */
export function birthDateBounds(today: string): { min: string; max: string } {
  return {
    min: shiftYears(today, -BIRTH_DATE_AGE.max),
    max: shiftYears(today, -BIRTH_DATE_AGE.min),
  };
}

/** Where an empty birth date starts: exactly 30 years before `today`. */
export function defaultBirthDate(today: string): string {
  return shiftYears(today, -BIRTH_DATE_AGE.default);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Whether `birthDate` is a `YYYY-MM-DD` inside {@link birthDateBounds}. */
export function isBirthDateInRange(birthDate: string | null | undefined, today: string): boolean {
  if (!birthDate || !ISO_DATE.test(birthDate)) return false;
  const { min, max } = birthDateBounds(today);
  return birthDate >= min && birthDate <= max;
}
