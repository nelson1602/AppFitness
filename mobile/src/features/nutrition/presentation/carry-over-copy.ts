import {
  formatKcalQuantity,
  formatNumber,
  interpolate,
  type SupportedLanguage,
  type TranslationKey,
} from '@/shared/localization';

import type { CarryOver } from '../domain/carry-over';

type Translate = (key: TranslationKey) => string;

/** What the sentence needs: the carry-over and the cardio it added for yesterday. */
export interface CarryOverMessage {
  carryOver: CarryOver;
  /** Minutes on the next workout that cover yesterday; 0 when none (or removed). */
  cardioMinutesToday: number;
}

/**
 * The one carry-over sentence (ADR-P040 Addendum v11-B) for Inicio's iCoach
 * card and Nutrición's day header: what was logged, what the iCoach does to
 * today's food and, when yesterday went past 10 %, the cardio it added to the
 * next workout. Neutral, no judgement and no health claim. Null when nothing
 * changes today.
 */
export function carryOverText(
  message: CarryOverMessage | null,
  t: Translate,
  language: SupportedLanguage,
): string | null {
  if (!message) return null;
  const { carryOver } = message;
  const minutes = formatNumber(message.cardioMinutesToday, language);
  const yesterday = carryOver.yesterday;
  const cardio = message.cardioMinutesToday > 0 && yesterday !== null;
  if (carryOver.adjustment === 0 && !cardio) return null;
  const kcal = formatKcalQuantity(Math.abs(carryOver.adjustment), language);
  const day = yesterday
    ? {
        consumed: formatNumber(yesterday.consumed, language),
        target: formatKcalQuantity(yesterday.target, language),
      }
    : null;

  if (cardio && day) {
    return carryOver.adjustment < 0
      ? interpolate(t('nutrition.carryOver.lessWithCardio'), { ...day, kcal, minutes })
      : interpolate(t('nutrition.carryOver.cardioOnly'), { ...day, minutes });
  }
  const more = carryOver.adjustment > 0;
  // Yesterday is named only when it points the same way as today's change.
  const fromYesterday =
    yesterday !== null &&
    day !== null &&
    Math.sign(yesterday.target - yesterday.consumed) === Math.sign(carryOver.adjustment);
  const sentence =
    fromYesterday && day
      ? interpolate(
          t(
            more
              ? 'nutrition.carryOver.moreAfterYesterday'
              : 'nutrition.carryOver.lessAfterYesterday',
          ),
          { ...day, kcal },
        )
      : interpolate(t(more ? 'nutrition.carryOver.more' : 'nutrition.carryOver.less'), { kcal });
  return more && carryOver.remaining > 0
    ? `${sentence} ${t('nutrition.carryOver.rest')}`
    : sentence;
}
