import type { TranslationKey } from '@/shared/localization';
import { en } from '@/shared/localization/resources/en';
import { es } from '@/shared/localization/resources/es';

import {
  formatIngredientAmount,
  formatServingAmount,
  GREEN_BANANA_PEELED_GRAMS,
} from './serving-amount';

const NBSP = ' ';
const tEs = (key: TranslationKey) => es[key];
const tEn = (key: TranslationKey) => en[key];

describe('formatServingAmount (v8 Block 3 display rounding)', () => {
  it('shows grams and millilitres as whole numbers (ES and EN)', () => {
    expect(formatServingAmount(271.2, 'g', 'es', tEs)).toBe(`271${NBSP}g`);
    expect(formatServingAmount(271.6, 'g', 'en', tEn)).toBe(`272${NBSP}g`);
    expect(formatServingAmount(16.8, 'g', 'es', tEs)).toBe(`17${NBSP}g`);
    // Spanish groups thousands only from five digits (RAE / es-ES).
    expect(formatServingAmount(1250.4, 'ml', 'es', tEs)).toBe(`1250${NBSP}ml`);
    expect(formatServingAmount(1250.4, 'ml', 'en', tEn)).toBe(`1,250${NBSP}ml`);
  });

  it('rounds spoons, cups, pieces and slices to the nearest half', () => {
    expect(formatServingAmount(1.8, 'tbsp', 'es', tEs)).toBe(`2${NBSP}cda.`);
    expect(formatServingAmount(0.6, 'piece', 'es', tEs)).toBe(`½${NBSP}unidad`);
    expect(formatServingAmount(1.2, 'slice', 'en', tEn)).toBe(`1${NBSP}slice`);
    expect(formatServingAmount(0.75, 'tsp', 'en', tEn)).toBe(`1${NBSP}tsp`);
  });

  it('gives the unit the plural that agrees with the amount shown', () => {
    expect(formatServingAmount(1.3, 'cup', 'es', tEs)).toBe(`1½${NBSP}tazas`);
    expect(formatServingAmount(6, 'cup', 'es', tEs)).toBe(`6${NBSP}tazas`);
    expect(formatServingAmount(1.1, 'cup', 'es', tEs)).toBe(`1${NBSP}taza`);
    expect(formatServingAmount(0.5, 'cup', 'es', tEs)).toBe(`½${NBSP}taza`);
    expect(formatServingAmount(2, 'piece', 'es', tEs)).toBe(`2${NBSP}unidades`);
    expect(formatServingAmount(2.4, 'slice', 'es', tEs)).toBe(`2½${NBSP}rebanadas`);
    expect(formatServingAmount(2.6, 'cup', 'en', tEn)).toBe(`2½${NBSP}cups`);
    expect(formatServingAmount(3, 'piece', 'en', tEn)).toBe(`3${NBSP}pieces`);
    // Abbreviations read the same for any amount.
    expect(formatServingAmount(2, 'tbsp', 'en', tEn)).toBe(`2${NBSP}tbsp`);
  });

  it('never shows a zero amount', () => {
    expect(formatServingAmount(0.2, 'cup', 'es', tEs)).toBe(`½${NBSP}taza`);
    expect(formatServingAmount(0.3, 'g', 'en', tEn)).toBe(`1${NBSP}g`);
  });

  it('keeps an unknown stored unit as stored rather than dropping it', () => {
    expect(formatServingAmount(2, 'oz', 'es', tEs)).toBe(`2${NBSP}oz`);
  });
});

describe('formatIngredientAmount (guineítos, v8.1 round 2)', () => {
  it('counts guineítos from the peeled weight, then shows the grams', () => {
    expect(GREEN_BANANA_PEELED_GRAMS).toBe(118);
    expect(formatIngredientAmount('food.green_banana_raw', 236, 'g', 'es', tEs)).toBe(
      `2 guineítos · 236${NBSP}g`,
    );
    expect(formatIngredientAmount('food.green_banana_raw', 236, 'g', 'en', tEn)).toBe(
      `2 green bananas · 236${NBSP}g`,
    );
    // To the nearest half; the name agrees with the count; never zero.
    expect(formatIngredientAmount('food.green_banana_raw', 177, 'g', 'es', tEs)).toBe(
      `1½ guineítos · 177${NBSP}g`,
    );
    expect(formatIngredientAmount('food.green_banana_raw', 118, 'g', 'es', tEs)).toBe(
      `1 guineíto · 118${NBSP}g`,
    );
    expect(formatIngredientAmount('food.green_banana_raw', 20, 'g', 'en', tEn)).toBe(
      `½ green banana · 20${NBSP}g`,
    );
  });

  it('leaves every other food as formatServingAmount shows it', () => {
    expect(formatIngredientAmount('food.plantain_boiled', 200, 'g', 'es', tEs)).toBe(
      formatServingAmount(200, 'g', 'es', tEs),
    );
    expect(formatIngredientAmount('toString', 2, 'cup', 'en', tEn)).toBe(
      formatServingAmount(2, 'cup', 'en', tEn),
    );
  });
});
