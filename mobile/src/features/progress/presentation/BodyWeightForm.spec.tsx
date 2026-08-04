import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { BodyWeightForm } from './BodyWeightForm';

const DATE = '2026-08-04';

describe('BodyWeightForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prefills the date field with the provided default date', async () => {
    await render(<BodyWeightForm defaultDate={DATE} saving={false} onSubmit={jest.fn()} />);
    expect(screen.getByTestId('field-date').props.value).toBe(DATE);
  });

  it('blocks submission when the required weight is missing', async () => {
    const onSubmit = jest.fn();
    await render(<BodyWeightForm defaultDate={DATE} saving={false} onSubmit={onSubmit} />);
    // Date defaults to the provided date (valid); weight is left blank.
    await fireEvent.press(screen.getByRole('button', { name: 'Save body weight' }));

    await waitFor(() => expect(onSubmit).not.toHaveBeenCalled());
  });

  it('rejects a non-positive weight', async () => {
    const onSubmit = jest.fn();
    await render(<BodyWeightForm defaultDate={DATE} saving={false} onSubmit={onSubmit} />);

    await fireEvent.changeText(screen.getByTestId('field-weightKg'), '0');
    await fireEvent.press(screen.getByRole('button', { name: 'Save body weight' }));

    await waitFor(() =>
      expect(screen.getByText('Enter a weight greater than 0')).toBeOnTheScreen(),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('maps a valid entry to the domain shape and submits (notes → null when blank)', async () => {
    const onSubmit = jest.fn().mockResolvedValue(true);
    await render(<BodyWeightForm defaultDate={DATE} saving={false} onSubmit={onSubmit} />);

    await fireEvent.changeText(screen.getByTestId('field-weightKg'), '80.5');
    await fireEvent.press(screen.getByRole('button', { name: 'Save body weight' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({ date: DATE, weightKg: 80.5, notes: null });
  });

  it('resets the form after a successful save', async () => {
    const onSubmit = jest.fn().mockResolvedValue(true);
    await render(<BodyWeightForm defaultDate={DATE} saving={false} onSubmit={onSubmit} />);

    await fireEvent.changeText(screen.getByTestId('field-weightKg'), '80.5');
    await fireEvent.press(screen.getByRole('button', { name: 'Save body weight' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('field-weightKg').props.value).toBe(''));
    expect(screen.getByTestId('field-date').props.value).toBe(DATE);
  });

  it('does not reset when the save fails', async () => {
    const onSubmit = jest.fn().mockResolvedValue(false);
    await render(<BodyWeightForm defaultDate={DATE} saving={false} onSubmit={onSubmit} />);

    await fireEvent.changeText(screen.getByTestId('field-weightKg'), '80.5');
    await fireEvent.press(screen.getByRole('button', { name: 'Save body weight' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('field-weightKg').props.value).toBe('80.5');
  });
});
