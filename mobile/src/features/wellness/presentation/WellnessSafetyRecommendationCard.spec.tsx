import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { WellnessSafetyProfile } from '../domain/wellness-safety-profile';
import type { WellnessSafetyProfileState } from '../application/wellness-safety-profile.store';
import { WellnessSafetyRecommendationCard } from './WellnessSafetyRecommendationCard';

/**
 * ADR-P017 **W-3** dashboard recommendation.
 *
 * The card's whole contract is *when it appears* and *what it promises*: it
 * recommends a professional evaluation, it disappears once something is
 * recorded, it stays silent in every state where it would only add noise, and
 * it never claims to be required.
 */

const load = jest.fn();
const onOpen = jest.fn();

let mockState: WellnessSafetyProfileState;
let mockLanguage: 'en' | 'es' = 'en';

jest.mock('../application/wellness-safety-profile.store', () => ({
  useWellnessSafetyProfileStore: (selector?: (s: WellnessSafetyProfileState) => unknown) =>
    selector ? selector(mockState) : mockState,
}));
jest.mock('@/shared/localization', () => {
  const { en } = jest.requireActual('@/shared/localization/resources/en') as {
    en: Record<string, string>;
  };
  const { es } = jest.requireActual('@/shared/localization/resources/es') as {
    es: Record<string, string>;
  };
  return {
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: string) => (mockLanguage === 'es' ? es[key] : en[key]) ?? key,
    }),
  };
});

const profile: WellnessSafetyProfile = {
  id: 'user-1',
  userId: 'user-1',
  evaluationCompleted: false,
  evaluationDate: null,
  affectedAreas: [],
  movementsToAvoid: [],
  createdAt: '2026-01-02T10:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.000Z',
  version: 1,
  deletedAt: null,
  deletedBy: null,
};

function setStore(partial: Partial<WellnessSafetyProfileState>) {
  mockState = {
    status: 'ready',
    profile: null,
    sync: 'synced',
    error: null,
    outcome: null,
    load,
    save: jest.fn(),
    remove: jest.fn(),
    ...partial,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = 'en';
  setStore({});
});

it('reads the profile on mount', async () => {
  await render(<WellnessSafetyRecommendationCard onOpen={onOpen} />);
  await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
});

it('recommends an evaluation when nothing is recorded, and says it is optional', async () => {
  setStore({ status: 'ready', profile: null });

  await render(<WellnessSafetyRecommendationCard onOpen={onOpen} />);

  expect(screen.getByText('Consider a professional physical evaluation')).toBeOnTheScreen();
  expect(
    screen.getByText(
      'A qualified professional can tell you what suits your body. AppFitnessRD is fitness and general-wellness software and cannot make that judgement for you.',
    ),
  ).toBeOnTheScreen();
  expect(screen.getByTestId('wellness-recommendation-optional')).toHaveTextContent(
    'This is a recommendation, not a requirement. Everything in the app stays available either way.',
  );
  expect(screen.getByLabelText('Professional evaluation recommendation')).toBeOnTheScreen();
});

it('offers a direct call to action into the capture surface', async () => {
  setStore({ status: 'ready', profile: null });

  await render(<WellnessSafetyRecommendationCard onOpen={onOpen} />);
  await fireEvent.press(
    screen.getByRole('button', { name: 'Add your evaluation and limitations' }),
  );

  expect(onOpen).toHaveBeenCalledTimes(1);
});

it('disappears once something is recorded, so it never becomes permanent furniture', async () => {
  setStore({ status: 'ready', profile });

  await render(<WellnessSafetyRecommendationCard onOpen={onOpen} />);

  expect(screen.queryByTestId('wellness-recommendation')).toBeNull();
  expect(screen.toJSON()).toBeNull();
});

it('still disappears when the recorded answer declares no limitations at all', async () => {
  // An "answered" profile is one that exists — declaring nothing is an answer,
  // and re-prompting for it would read as if the declaration did not count.
  setStore({
    status: 'ready',
    profile: { ...profile, evaluationCompleted: false, affectedAreas: [], movementsToAvoid: [] },
  });

  await render(<WellnessSafetyRecommendationCard onOpen={onOpen} />);

  expect(screen.toJSON()).toBeNull();
});

it.each(['idle', 'loading', 'saving', 'error', 'web-unavailable'] as const)(
  'renders nothing in the %s state rather than adding dashboard noise',
  async (status) => {
    setStore({ status, profile: null, error: status === 'error' ? 'load' : null });

    await render(<WellnessSafetyRecommendationCard onOpen={onOpen} />);

    expect(screen.toJSON()).toBeNull();
  },
);

it('never renders a blocking or gating affordance', async () => {
  setStore({ status: 'ready', profile: null });

  await render(<WellnessSafetyRecommendationCard onOpen={onOpen} />);

  // Exactly one control: the optional way in. No dismissal, no "required",
  // no confirmation, nothing that could read as a gate.
  expect(screen.getAllByRole('button')).toHaveLength(1);
  expect(screen.queryByText(/required/i)).toBeNull();
  expect(screen.queryByText(/must/i)).toBeNull();
});

it('renders the recommendation in Spanish', async () => {
  mockLanguage = 'es';
  setStore({ status: 'ready', profile: null });

  await render(<WellnessSafetyRecommendationCard onOpen={onOpen} />);

  expect(screen.getByText('Considera una evaluación física profesional')).toBeOnTheScreen();
  expect(screen.getByTestId('wellness-recommendation-optional')).toHaveTextContent(
    'Es una recomendación, no un requisito. Todo en la app sigue disponible de cualquier manera.',
  );
  expect(
    screen.getByRole('button', { name: 'Agregar tu evaluación y limitaciones' }),
  ).toBeOnTheScreen();
});
