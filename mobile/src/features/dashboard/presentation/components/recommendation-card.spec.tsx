import { render, screen } from '@testing-library/react-native';

import type { Recommendation } from '@/features/icoach/domain/types';

import { RecommendationCard } from './recommendation-card';

let mockLanguage: 'en' | 'es' = 'en';

jest.mock('@/shared/localization', () => {
  const actual = jest.requireActual('@/shared/localization');
  const { en } = jest.requireActual('@/shared/localization/resources/en');
  const { es } = jest.requireActual('@/shared/localization/resources/es');
  return {
    ...actual,
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: keyof typeof en) => (mockLanguage === 'es' ? es[key] : en[key]),
    }),
  };
});

const recommendation: Recommendation = {
  id: 'NUTRITION:macro_targets',
  category: 'NUTRITION',
  priority: 'HIGH',
  title: 'Increase daily protein',
  explanation: 'Protein target supports recomposition and recovery.',
  scientificBasis: 'Deterministic iCoach v1 protein rule.',
  ruleVersion: 'icoach-v1',
  inputs: {
    weightKg: 82,
    proteinG: 164,
    carbsG: 280,
    fatG: 74,
  },
};

describe('RecommendationCard', () => {
  beforeEach(() => {
    mockLanguage = 'en';
  });

  it('renders explainable recommendation content', async () => {
    await render(<RecommendationCard recommendation={recommendation} />);

    expect(
      screen.getByLabelText('High recommendation: Macros: 164 g protein / 280 g carbs / 74 g fat'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Nutrition / High')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Protein is based on body weight, fat supports essential functions, and carbohydrates complete the remaining energy target.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Evidence: ISSN guidance on protein and macronutrient distribution.'),
    ).toBeOnTheScreen();
  });

  it('renders public deterministic recommendation copy in Spanish', async () => {
    mockLanguage = 'es';

    await render(<RecommendationCard recommendation={recommendation} />);

    expect(screen.getByText('Nutrición / Alta')).toBeOnTheScreen();
    expect(
      screen.getByText('Macros: 164 g de proteína / 280 g de carbohidratos / 74 g de grasa'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Fundamento: Guía de la ISSN sobre proteína y distribución de macronutrientes.',
      ),
    ).toBeOnTheScreen();
  });

  it('preserves copy for an unknown future recommendation id', async () => {
    mockLanguage = 'es';
    const futureRecommendation = { ...recommendation, id: 'FUTURE:new_rule' };

    await render(<RecommendationCard recommendation={futureRecommendation} />);

    expect(screen.getByText('Increase daily protein')).toBeOnTheScreen();
    expect(
      screen.getByText('Protein target supports recomposition and recovery.'),
    ).toBeOnTheScreen();
  });
});
