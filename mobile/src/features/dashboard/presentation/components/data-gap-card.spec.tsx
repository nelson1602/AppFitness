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
});
