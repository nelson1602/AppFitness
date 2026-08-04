import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { BodyMeasurementForm } from './BodyMeasurementForm';

const DATE = '2026-08-04';

describe('BodyMeasurementForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prefills the date field with the provided default date', async () => {
    await render(<BodyMeasurementForm defaultDate={DATE} saving={false} onSubmit={jest.fn()} />);
    expect(screen.getByTestId('field-date').props.value).toBe(DATE);
  });

  it('blocks submission when the required waist is missing', async () => {
    const onSubmit = jest.fn();
    await render(<BodyMeasurementForm defaultDate={DATE} saving={false} onSubmit={onSubmit} />);
    // Date defaults to the provided date (valid); waist is left blank.
    await fireEvent.press(screen.getByRole('button', { name: 'Save body measurements' }));

    await waitFor(() => expect(onSubmit).not.toHaveBeenCalled());
  });

  it('rejects a non-positive waist', async () => {
    const onSubmit = jest.fn();
    await render(<BodyMeasurementForm defaultDate={DATE} saving={false} onSubmit={onSubmit} />);

    await fireEvent.changeText(screen.getByTestId('field-waistCm'), '0');
    await fireEvent.press(screen.getByRole('button', { name: 'Save body measurements' }));

    await waitFor(() =>
      expect(screen.getByText('Enter a waist measurement greater than 0')).toBeOnTheScreen(),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits waist-only with optional fields left null', async () => {
    const onSubmit = jest.fn().mockResolvedValue(true);
    await render(<BodyMeasurementForm defaultDate={DATE} saving={false} onSubmit={onSubmit} />);

    await fireEvent.changeText(screen.getByTestId('field-waistCm'), '82');
    await fireEvent.press(screen.getByRole('button', { name: 'Save body measurements' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      date: DATE,
      waistCm: 82,
      hipCm: null,
      chestCm: null,
      bodyFatPct: null,
      notes: null,
    });
  });

  it('includes optional measurements when provided', async () => {
    const onSubmit = jest.fn().mockResolvedValue(true);
    await render(<BodyMeasurementForm defaultDate={DATE} saving={false} onSubmit={onSubmit} />);

    await fireEvent.changeText(screen.getByTestId('field-waistCm'), '82');
    await fireEvent.changeText(screen.getByTestId('field-hipCm'), '96');
    await fireEvent.changeText(screen.getByTestId('field-bodyFatPct'), '18');
    await fireEvent.press(screen.getByRole('button', { name: 'Save body measurements' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ waistCm: 82, hipCm: 96, bodyFatPct: 18, chestCm: null }),
    );
  });

  it('rejects a body-fat % over 100', async () => {
    const onSubmit = jest.fn();
    await render(<BodyMeasurementForm defaultDate={DATE} saving={false} onSubmit={onSubmit} />);

    await fireEvent.changeText(screen.getByTestId('field-waistCm'), '82');
    await fireEvent.changeText(screen.getByTestId('field-bodyFatPct'), '150');
    await fireEvent.press(screen.getByRole('button', { name: 'Save body measurements' }));

    await waitFor(() =>
      expect(screen.getByText('Enter a body-fat % between 0 and 100')).toBeOnTheScreen(),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('resets the form after a successful save', async () => {
    const onSubmit = jest.fn().mockResolvedValue(true);
    await render(<BodyMeasurementForm defaultDate={DATE} saving={false} onSubmit={onSubmit} />);

    await fireEvent.changeText(screen.getByTestId('field-waistCm'), '82');
    await fireEvent.press(screen.getByRole('button', { name: 'Save body measurements' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('field-waistCm').props.value).toBe(''));
  });
});
