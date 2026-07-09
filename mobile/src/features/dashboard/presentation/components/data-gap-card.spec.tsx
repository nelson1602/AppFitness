import { fireEvent, render, screen } from '@testing-library/react-native';

import { DataGapCard } from './data-gap-card';

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
  it('renders setup requirements and details', async () => {
    await render(<DataGapCard gaps={gaps} />);

    expect(screen.getByLabelText('Dashboard setup requirements')).toBeOnTheScreen();
    expect(screen.getByText('Finish your baseline')).toBeOnTheScreen();
    expect(screen.getByText('Create your profile')).toBeOnTheScreen();
    expect(screen.getByText('Add current weight')).toBeOnTheScreen();
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
    expect(screen.queryByRole('button', { name: 'Fix: Add current weight' })).toBeNull();

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
});
