import type { Recommendation } from '@/features/icoach/domain/types';
import { formatNumber, type SupportedLanguage, type TranslationKey } from '@/shared/localization';

type Translate = (key: TranslationKey) => string;

export interface RecommendationCopy {
  title: string;
  explanation: string;
  evidence: string;
}

function numberInput(recommendation: Recommendation, key: string): number | null {
  const value = recommendation.inputs[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function template(value: string, replacements: Record<string, string>): string {
  return Object.entries(replacements).reduce(
    (result, [key, replacement]) => result.replaceAll(`{${key}}`, replacement),
    value,
  );
}

/** Presentation-only copy adapter. Stable rule ids and inputs remain unchanged. */
export function resolveRecommendationCopy(
  recommendation: Recommendation,
  language: SupportedLanguage,
  t: Translate,
): RecommendationCopy {
  const number = (key: string) => {
    const value = numberInput(recommendation, key);
    return value === null ? '—' : formatNumber(value, language);
  };

  switch (recommendation.id) {
    case 'NUTRITION:calorie_target':
      return {
        title: t('dashboard.recommendation.calorieTitle'),
        explanation:
          recommendation.inputs.safetyFloorApplied === true
            ? t('dashboard.recommendation.calorieSafetyFloor')
            : template(t('dashboard.recommendation.calorieExplanation'), {
                tdee: number('tdee'),
                adjustment: number('adjustmentPct'),
              }),
        evidence: t('dashboard.recommendation.calorieEvidence'),
      };
    case 'NUTRITION:macro_targets':
      return {
        title: template(t('dashboard.recommendation.macrosTitle'), {
          protein: number('proteinG'),
          carbs: number('carbsG'),
          fat: number('fatG'),
        }),
        explanation: t('dashboard.recommendation.macrosExplanation'),
        evidence: t('dashboard.recommendation.macrosEvidence'),
      };
    case 'TRAINING:intensity_plan':
      return {
        title: template(t('dashboard.recommendation.trainingTitle'), {
          days: number('daysPerWeek'),
          intensity: t(
            `dashboard.intensity.${String(recommendation.inputs.intensity).toLowerCase()}` as TranslationKey,
          ),
        }),
        explanation: t('dashboard.recommendation.trainingExplanation'),
        evidence: t('dashboard.recommendation.trainingEvidence'),
      };
    case 'RECOVERY:low_sleep':
      return {
        title: t('dashboard.recommendation.sleepTitle'),
        explanation: template(t('dashboard.recommendation.sleepExplanation'), {
          hours: number('sleepHours'),
        }),
        evidence: t('dashboard.recommendation.sleepEvidence'),
      };
    case 'BODY:underweight_fat_loss_warning':
      return {
        title: t('dashboard.recommendation.underweightTitle'),
        explanation: template(t('dashboard.recommendation.underweightExplanation'), {
          bmi: number('bmi'),
        }),
        evidence: t('dashboard.recommendation.underweightEvidence'),
      };
    default:
      return {
        title: recommendation.title,
        explanation: recommendation.explanation,
        evidence: recommendation.scientificBasis,
      };
  }
}
