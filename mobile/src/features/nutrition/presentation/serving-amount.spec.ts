import { formatServingAmount } from './serving-amount';

const NBSP = ' ';

describe('formatServingAmount (v8 Block 3 display rounding)', () => {
  it('shows grams and millilitres as whole numbers (ES and EN)', () => {
    expect(formatServingAmount(271.2, 'g', 'g', 'es')).toBe(`271${NBSP}g`);
    expect(formatServingAmount(271.6, 'g', 'g', 'en')).toBe(`272${NBSP}g`);
    expect(formatServingAmount(16.8, 'g', 'g', 'es')).toBe(`17${NBSP}g`);
    // Spanish groups thousands only from five digits (RAE / es-ES).
    expect(formatServingAmount(1250.4, 'ml', 'ml', 'es')).toBe(`1250${NBSP}ml`);
    expect(formatServingAmount(1250.4, 'ml', 'ml', 'en')).toBe(`1,250${NBSP}ml`);
  });

  it('rounds spoons, cups, pieces and slices to the nearest half', () => {
    expect(formatServingAmount(1.8, 'tbsp', 'cda.', 'es')).toBe(`2${NBSP}cda.`);
    expect(formatServingAmount(0.6, 'piece', 'unidad', 'es')).toBe(`½${NBSP}unidad`);
    expect(formatServingAmount(1.3, 'cup', 'taza', 'es')).toBe(`1½${NBSP}taza`);
    expect(formatServingAmount(2.6, 'cup', 'cup', 'en')).toBe(`2½${NBSP}cup`);
    expect(formatServingAmount(1.2, 'slice', 'slice', 'en')).toBe(`1${NBSP}slice`);
    expect(formatServingAmount(0.75, 'tsp', 'tsp', 'en')).toBe(`1${NBSP}tsp`);
  });

  it('never shows a zero amount', () => {
    expect(formatServingAmount(0.2, 'cup', 'taza', 'es')).toBe(`½${NBSP}taza`);
    expect(formatServingAmount(0.3, 'g', 'g', 'en')).toBe(`1${NBSP}g`);
  });

  it('only formats: the value it is given is not changed', () => {
    const amount = 0.8;
    formatServingAmount(amount, 'cup', 'taza', 'es');
    expect(amount).toBe(0.8);
  });
});
