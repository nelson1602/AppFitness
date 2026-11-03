import type { TranslationKey } from '@/shared/localization';

import type { AvoidTag } from '../domain/food-catalog';

/** The food categories a person can keep off the plan, in words. */
export const AVOID_TAG_KEY: Record<AvoidTag, TranslationKey> = {
  nut_allergy: 'nutrition.avoid.nuts',
  shellfish_allergy: 'nutrition.avoid.shellfish',
  gluten_sensitive: 'nutrition.avoid.gluten',
  lactose_sensitive: 'nutrition.avoid.lactose',
  high_sodium_sensitive: 'nutrition.avoid.sodium',
  high_purine: 'nutrition.avoid.purine',
  added_sugar: 'nutrition.avoid.addedSugar',
  alcohol: 'nutrition.avoid.alcohol',
  caffeine: 'nutrition.avoid.caffeine',
  fried: 'nutrition.avoid.fried',
};
