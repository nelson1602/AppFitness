import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { RestrictionForm } from './RestrictionForm';

const save = jest.fn();
const mockState = { save };

jest.mock('../application/restriction.store', () => ({
  useRestrictionStore: (selector?: (s: unknown) => unknown) =>
    selector ? selector(mockState) : mockState,
}));

describe('RestrictionForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    save.mockResolvedValue(true);
  });

  it('renders the add form with the type selector', async () => {
    await render(<RestrictionForm />);
    expect(screen.getByText('Add a restriction')).toBeOnTheScreen();
    expect(screen.getByTestId('option-type-INJURY')).toBeOnTheScreen();
  });

  it('saves the defaulted restriction (injury, effective today) and maps it', async () => {
    await render(<RestrictionForm />);

    await fireEvent.press(screen.getByRole('button', { name: 'Add restriction' }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'INJURY',
        effectiveFrom: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    );
  });

  it('maps chosen type, body area, and notes onto the domain shape', async () => {
    await render(<RestrictionForm />);

    await fireEvent.press(screen.getByTestId('option-type-CONDITION'));
    await fireEvent.changeText(screen.getByTestId('field-bodyArea'), 'left knee');
    await fireEvent.changeText(screen.getByTestId('field-notes'), 'no deep squats');
    await fireEvent.press(screen.getByRole('button', { name: 'Add restriction' }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CONDITION',
        bodyArea: 'left knee',
        notes: 'no deep squats',
      }),
    );
  });

  it('blocks submission and shows an error for an invalid effective date', async () => {
    await render(<RestrictionForm />);

    await fireEvent.changeText(screen.getByTestId('field-effectiveFrom'), '99-99-9999');
    await fireEvent.press(screen.getByRole('button', { name: 'Add restriction' }));

    await waitFor(() => expect(screen.getByText('Use YYYY-MM-DD')).toBeOnTheScreen());
    expect(save).not.toHaveBeenCalled();
  });
});
