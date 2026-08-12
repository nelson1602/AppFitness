import { fireEvent, render, screen } from '@testing-library/react-native';

import { DataGapCard } from './data-gap-card';

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

const gaps = [
  {
    id: 'profile',
    title: 'Create your profile',
    detail: 'Birth date, height, and training background are required.',
  },
  {
    id: 'weight',
    title: 'Add current weight',
    detail: 'The iCoach engine needs a recent local evaluation.',
  },
];

describe('DataGapCard', () => {
  beforeEach(() => {
    mockLanguage = 'en';
  });

  it('renders setup requirements and details', async () => {
    await render(<DataGapCard gaps={gaps} />);

    expect(screen.getByLabelText('Dashboard setup requirements')).toBeOnTheScreen();
    expect(screen.getByText('Finish your baseline')).toBeOnTheScreen();
    expect(screen.getByText('Create your profile')).toBeOnTheScreen();
    expect(screen.getByText('Record a weight measurement')).toBeOnTheScreen();
  });

  it('shows the dev sample data action when a handler is provided', async () => {
    const onLoadSampleData = jest.fn();
    await render(<DataGapCard gaps={gaps} onLoadSampleData={onLoadSampleData} />);

    fireEvent.press(screen.getByRole('button', { name: 'Load fake sample dashboard data' }));

    expect(onLoadSampleData).toHaveBeenCalledTimes(1);
  });

  it('hides the sample data action when no handler is provided', async () => {
    await render(<DataGapCard gaps={gaps} />);

    expect(screen.queryByText('Load sample data')).toBeNull();
  });

  it('renders a fix action only for gaps the resolver can address', async () => {
    const fixProfile = jest.fn();
    const resolveFix = (gap: (typeof gaps)[number]) =>
      gap.id === 'profile' ? fixProfile : undefined;

    await render(<DataGapCard gaps={gaps} resolveFix={resolveFix} />);

    expect(screen.getByRole('button', { name: 'Fix: Create your profile' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Fix: Record a weight measurement' })).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Fix: Create your profile' }));
    expect(fixProfile).toHaveBeenCalledTimes(1);
  });

  it('exposes a stable testID per fixable gap for E2E targeting', async () => {
    const resolveFix = () => () => undefined;

    await render(<DataGapCard gaps={gaps} resolveFix={resolveFix} />);

    // testID mirrors the gap id so Maestro flows can target a specific gap.
    expect(screen.getByTestId('gap-fix-profile')).toBeOnTheScreen();
    expect(screen.getByTestId('gap-fix-weight')).toBeOnTheScreen();
  });

  it('localizes known requirements by stable id without changing fix behavior', async () => {
    const fixProfile = jest.fn();
    mockLanguage = 'es';

    await render(
      <DataGapCard
        gaps={gaps}
        resolveFix={(gap) => (gap.id === 'profile' ? fixProfile : undefined)}
      />,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Corregir: Crea tu perfil' }));

    expect(screen.getByText('Completa tus datos iniciales')).toBeOnTheScreen();
    expect(screen.getByText('Registra una medición de peso')).toBeOnTheScreen();
    expect(fixProfile).toHaveBeenCalledTimes(1);
  });

  it('preserves supplied copy for an unknown requirement id', async () => {
    mockLanguage = 'es';
    await render(
      <DataGapCard gaps={[{ id: 'future-gap', title: 'Future title', detail: 'Future detail' }]} />,
    );

    expect(screen.getByText('Future title')).toBeOnTheScreen();
    expect(screen.getByText('Future detail')).toBeOnTheScreen();
  });
});
