import {
  formatKcalQuantity,
  formatNumber,
  interpolate,
  type SupportedLanguage,
  type TranslationKey,
} from '@/shared/localization';

import type { CarryOver } from '../domain/carry-over';

type Translate = (key: TranslationKey) => string;

/**
 * The carry-over sentence (ADR-P040 Addendum v11-B) for Inicio's iCoach card and
 * Nutrición's day header. Neutral: what was logged, what the iCoach does today,
 * no judgement and no health claim. Null when today has no adjustment.
 */
export function carryOverText(
  carryOver: CarryOver | null,
  t: Translate,
  language: SupportedLanguage,
): string | null {
  if (!carryOver || carryOver.adjustment === 0) return null;
  const more = carryOver.adjustment > 0;
  const kcal = formatKcalQuantity(Math.abs(carryOver.adjustment), language);
  const yesterday = carryOver.yesterday;
  // Yesterday is named only when it points the same way as today's change.
  const fromYesterday =
    yesterday !== null &&
    Math.sign(yesterday.target - yesterday.consumed) === Math.sign(carryOver.adjustment);
  const sentence = fromYesterday
    ? interpolate(
        t(
          more
            ? 'nutrition.carryOver.moreAfterYesterday'
            : 'nutrition.carryOver.lessAfterYesterday',
        ),
        {
          consumed: formatNumber(yesterday.consumed, language),
          target: formatKcalQuantity(yesterday.target, language),
          kcal,
        },
      )
    : interpolate(t(more ? 'nutrition.carryOver.more' : 'nutrition.carryOver.less'), { kcal });
  return Math.sign(carryOver.remaining) === Math.sign(carryOver.adjustment)
    ? `${sentence} ${t('nutrition.carryOver.rest')}`
    : sentence;
}
