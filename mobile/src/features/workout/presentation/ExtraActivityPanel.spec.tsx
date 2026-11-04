import { render, screen } from '@testing-library/react-native';

import { describeActivity } from '../domain/extra-activity';
import { ExtraActivityPanel } from './ExtraActivityPanel';

let mockLanguage: 'en' | 'es' = 'es';

jest.mock('@/shared/localization', () => {
  const actual = jest.requireActual('@/shared/localization');
  const resources = {
    en: jest.requireActual('@/shared/localization/resources/en').en,
    es: jest.requireActual('@/shared/localization/resources/es').es,
  };
  return {
    ...actual,
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: string) => resources[mockLanguage][key],
    }),
  };
});

const TODAY = '2026-11-05'; // Thursday
const run = describeActivity(
  {
    id: 'run',
    name: 'Correr 15 min',
    startedAt: '2026-11-05T12:00:00.000Z',
    finishedAt: '2026-11-05T12:20:00.000Z',
    localDate: TODAY,
  },
  [],
  70,
);
const lift = describeActivity(
  {
    id: 'lift',
    name: 'Levantamiento de pesas',
    startedAt: '2026-11-03T12:00:00.000Z',
    finishedAt: null,
    localDate: '2026-11-03',
  },
  [],
  70,
);

beforeEach(() => {
  mockLanguage = 'es';
});

describe('ExtraActivityPanel (ADR-P040 Addendum v10-A)', () => {
  it('renders nothing without extras or iCoach changes', async () => {
    await render(
      <ExtraActivityPanel calorieBonus={0} extras={[]} lightenings={[]} moves={[]} today={TODAY} />,
    );
    expect(screen.queryByTestId('workout-extra-panel')).toBeNull();
  });

  it('shows each extra activity with day, time, kcal and status, and the bonus', async () => {
    await render(
      <ExtraActivityPanel
        calorieBonus={123}
        extras={[lift, run]}
        lightenings={[]}
        moves={[]}
        today={TODAY}
      />,
    );
    expect(screen.getByText('Actividad extra')).toBeOnTheScreen();
    expect(screen.getByText('+123 kcal por actividad')).toBeOnTheScreen();
    expect(screen.getByText('Correr 15 min')).toBeOnTheScreen();
    expect(screen.getByText('Hoy · 15 min · 123 kcal')).toBeOnTheScreen();
    expect(screen.getByTestId('workout-extra-run-status')).toHaveTextContent('Completada');
    expect(screen.getByText('Martes · Sin duración')).toBeOnTheScreen();
    expect(screen.getByTestId('workout-extra-lift-status')).toHaveTextContent('En curso');
  });

  it('explains moved and lightened sessions in one iCoach sentence each', async () => {
    await render(
      <ExtraActivityPanel
        calorieBonus={0}
        extras={[]}
        lightenings={[
          {
            date: '2026-11-06',
            sessionKey: 's3',
            exerciseKeys: ['exercise.back_squat'],
            groups: ['quadriceps'],
            activityId: 'lift',
            at: '2026-11-05T12:00:00.000Z',
          },
        ]}
        moves={[{ sessionKey: 's2', from: '2026-11-04', to: '2026-11-07' }]}
        today={TODAY}
      />,
    );
    expect(screen.getByText('iCoach: la sesión del miércoles pasa al sábado.')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'iCoach: tu sesión del viernes lleva una serie menos en cuádriceps, porque ya los trabajaste.',
      ),
    ).toBeOnTheScreen();
  });

  it('speaks English when the app does', async () => {
    mockLanguage = 'en';
    await render(
      <ExtraActivityPanel
        calorieBonus={0}
        extras={[run]}
        lightenings={[]}
        moves={[]}
        today={TODAY}
      />,
    );
    expect(screen.getByText('Extra activity')).toBeOnTheScreen();
    expect(screen.getByTestId('workout-extra-run-status')).toHaveTextContent('Completed');
  });
});
