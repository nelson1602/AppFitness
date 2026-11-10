import {
  cmToDisplay,
  cmToFeetInches,
  displayToCm,
  displayToKg,
  feetInchesToCm,
  formatHeight,
  formatLength,
  formatWeight,
  isUnitSystem,
  kgToDisplay,
  lengthFieldText,
  parseFieldDecimal,
  weightFieldText,
  weightUnit,
} from './units';

const NBSP = ' ';
const plain = (text: string) => text.split(NBSP).join(' ');

describe('display units (v10 Block C, item 9)', () => {
  it('converts weights and lengths exactly, and back', () => {
    expect(kgToDisplay(72, 'imperial')).toBeCloseTo(158.733, 3);
    expect(displayToKg(kgToDisplay(72, 'imperial'), 'imperial')).toBeCloseTo(72, 10);
    expect(cmToDisplay(86, 'imperial')).toBeCloseTo(33.858, 3);
    expect(displayToCm(cmToDisplay(86, 'imperial'), 'imperial')).toBeCloseTo(86, 10);
  });

  it('leaves metric values untouched', () => {
    expect(kgToDisplay(72.35, 'metric')).toBe(72.35);
    expect(displayToKg(72.35, 'metric')).toBe(72.35);
    expect(cmToDisplay(86, 'metric')).toBe(86);
    expect(displayToCm(86, 'metric')).toBe(86);
  });

  it('splits a height into whole feet and inches, never "12 in"', () => {
    expect(cmToFeetInches(170)).toEqual({ feet: 5, inches: 7 });
    // 182.5 cm is 71.85 in: rounds to 72 in, which is 6 ft 0 in.
    expect(cmToFeetInches(182.5)).toEqual({ feet: 6, inches: 0 });
    expect(feetInchesToCm(5, 7)).toBeCloseTo(170.18, 2);
  });

  it('formats every value with its unit, joined by a no-break space', () => {
    expect(plain(formatWeight(72, 'metric', 'es'))).toBe('72 kg');
    expect(plain(formatWeight(72, 'imperial', 'es'))).toBe('158,7 lb');
    expect(plain(formatWeight(72, 'imperial', 'en'))).toBe('158.7 lb');
    expect(plain(formatLength(86, 'imperial', 'es'))).toBe('33,9 in');
    expect(plain(formatHeight(170, 'metric', 'es'))).toBe('170 cm');
    expect(plain(formatHeight(170, 'imperial', 'en'))).toBe('5 ft 7 in');
    expect(formatWeight(72, 'imperial', 'es')).not.toMatch(/\d lb/);
  });

  it('starts a metric field with the value as typed and an imperial one rounded to 0.1', () => {
    expect(weightFieldText(82.55, 'metric', 'es')).toBe('82,55');
    expect(weightFieldText(72, 'imperial', 'es')).toBe('158,7');
    expect(weightFieldText(null, 'imperial', 'en')).toBe('');
    expect(lengthFieldText(86, 'imperial', 'en')).toBe('33.9');
  });

  it('reads a typed decimal with a comma or a point, and nothing else', () => {
    expect(parseFieldDecimal('70,5')).toBe(70.5);
    expect(parseFieldDecimal('70.5')).toBe(70.5);
    expect(parseFieldDecimal('70,')).toBe(70);
    expect(parseFieldDecimal('setenta')).toBeNull();
    expect(parseFieldDecimal('-3')).toBeNull();
  });

  it('accepts only the two stored choices', () => {
    expect(isUnitSystem('metric')).toBe(true);
    expect(isUnitSystem('imperial')).toBe(true);
    expect(isUnitSystem('stones')).toBe(false);
    expect(isUnitSystem(null)).toBe(false);
    expect(weightUnit('imperial')).toBe('lb');
  });
});
