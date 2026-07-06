import { render, screen } from '@testing-library/react-native';

import type { Recommendation } from '@/features/icoach/domain/types';

import { RecommendationCard } from './recommendation-card';

const recommendation: Recommendation = {
  id: 'NUTRITION:protein',
  category: 'NUTRITION',
  priority: 'HIGH',
  title: 'Increase daily protein',
  explanation: 'Protein target supports recomposition and recovery.',
  scientificBasis: 'Deterministic iCoach v1 protein rule.',
  ruleVersion: 'icoach-v1',
  inputs: {
    weightKg: 82,
  },
};

describe('RecommendationCard', () => {
  it('renders explainable recommendation content', async () => {
    await render(<RecommendationCard recommendation={recommendation} />);

    expect(screen.getByLabelText('high recommendation: Increase daily protein')).toBeOnTheScreen();
    expect(screen.getByText('NUTRITION / HIGH')).toBeOnTheScreen();
    expect(
      screen.getByText('Protein target supports recomposition and recovery.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Evidence: Deterministic iCoach v1 protein rule.')).toBeOnTheScreen();
  });
});
