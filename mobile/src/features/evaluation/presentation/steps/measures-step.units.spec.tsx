import { act, fireEvent, render, screen } from '@testing-library/react-native';

import {
  initializeUnits,
  resetUnitsForTests,
  setHeightUnit,
  setWeightUnit,
} from '@/shared/units/unit-manager';

import { draftFromSources } from '../../domain/evaluation';
import { GoalStep } from './goal-step';
import { MeasuresStep } from './measures-step';

/** Both units at once, as the v10 single choice set them. */
async function setUnitSystem(system: 'metric' | 'imperial') {
  await setWeightUnit(system === 'imperial' ? 'lb' : 'kg');
  await setHeightUnit(system === 'imperial' ? 'ft-in' : 'cm');
}

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const TODAY = '2026-11-10';
const draft = draftFromSources({
  profile: null,
  goal: null,
  weightKg: 72,
  wellness: null,
  preferences: [],
  today: TODAY,
});

beforeEach(async () => {
  resetUnitsForTests();
  await initializeUnits();
});

/**
 * v10 Block C, item 9: with lb / ft-in chosen, the evaluation takes pounds and
 * feet + inches, and still stores kilograms and centimetres.
 */
describe('Evaluación física in lb / ft-in', () => {
  it('prefills the weight in lb and stores what is typed in kg', async () => {
    await act(async () => {
      await setUnitSystem('imperial');
    });
    const update = jest.fn();
    await render(<MeasuresStep draft={draft} issues={[]} today={TODAY} update={update} />);

    expect(screen.getByTestId('evaluation-weight')).toHaveProp('value', '158.7');
    await fireEvent.changeText(screen.getByTestId('evaluation-weight'), '160');
    expect(update).toHaveBeenLastCalledWith({ weightKg: expect.closeTo(72.575, 3) });
  });

  it('takes the height in feet and inches and stores centimetres', async () => {
    await act(async () => {
      await setUnitSystem('imperial');
    });
    const update = jest.fn();
    await render(<MeasuresStep draft={draft} issues={[]} today={TODAY} update={update} />);

    expect(screen.queryByTestId('evaluation-height')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('evaluation-height-feet'), '5');
    await fireEvent.changeText(screen.getByTestId('evaluation-height-inches'), '7');
    expect(update).toHaveBeenLastCalledWith({ heightCm: expect.closeTo(170.18, 2) });
  });

  it('shows the limits in lb and ft / in when a value is out of range', async () => {
    await act(async () => {
      await setUnitSystem('imperial');
    });
    await render(
      <MeasuresStep draft={draft} issues={['weight', 'height']} today={TODAY} update={jest.fn()} />,
    );

    expect(screen.getByTestId('evaluation-weight-error')).toHaveTextContent(
      /67 y 881.lb|67 and 881.lb/,
    );
    expect(screen.getByTestId('evaluation-height-feet-error')).toHaveTextContent(/3.ft 4.in/);
  });

  it('keeps kg and cm, unchanged, when metric is chosen', async () => {
    const update = jest.fn();
    await render(<MeasuresStep draft={draft} issues={[]} today={TODAY} update={update} />);

    expect(screen.getByTestId('evaluation-weight')).toHaveProp('value', '72');
    await fireEvent.changeText(screen.getByTestId('evaluation-height'), '175');
    expect(update).toHaveBeenLastCalledWith({ heightCm: 175 });
  });

  it('stores a target typed in lb as kg', async () => {
    await act(async () => {
      await setUnitSystem('imperial');
    });
    const update = jest.fn();
    await render(<GoalStep draft={draft} issues={[]} today={TODAY} update={update} />);

    await fireEvent.changeText(screen.getByTestId('evaluation-target-weight'), '150');
    expect(update).toHaveBeenLastCalledWith({ targetWeightKg: expect.closeTo(68.039, 3) });
  });
});

/** v11-B: Peso [kg ▾ | lb] and Estatura [cm ▾ | ft-in], each on its own field. */
describe('Medidas offers a unit dropdown on each field', () => {
  const pick = async (field: 'weight' | 'height', unit: string) => {
    await fireEvent.press(screen.getByTestId(`evaluation-${field}-unit`));
    await fireEvent.press(screen.getByTestId(`evaluation-${field}-unit-option-${unit}`));
  };

  it('re-shows what was typed in the new unit, converted once, with no drift', async () => {
    const update = jest.fn();
    const withHeight = { ...draft, heightCm: 175 };
    await render(<MeasuresStep draft={withHeight} issues={[]} today={TODAY} update={update} />);

    expect(screen.queryByTestId('unit-selector')).toBeNull();
    expect(screen.getByTestId('evaluation-weight-unit')).toHaveTextContent(/^kg/);
    expect(screen.getByTestId('evaluation-height-unit')).toHaveTextContent(/^cm/);
    expect(screen.getByTestId('evaluation-weight')).toHaveProp('value', '72');

    await pick('weight', 'lb');
    // The draft keeps kilograms; the field now reads pounds, converted once.
    expect(await screen.findByTestId('evaluation-weight-unit')).toHaveTextContent(/^lb/);
    expect(screen.getByTestId('evaluation-weight')).toHaveProp('value', '158.7');
    await pick('height', 'ft-in');
    expect(await screen.findByTestId('evaluation-height-feet')).toHaveProp('value', '5');
    expect(screen.getByTestId('evaluation-height-inches')).toHaveProp('value', '9');
    expect(update).not.toHaveBeenCalled();

    // Back and forth twice: the stored kg and cm read exactly as typed.
    await pick('weight', 'kg');
    await pick('height', 'cm');
    await pick('weight', 'lb');
    await pick('weight', 'kg');
    expect(screen.getByTestId('evaluation-weight')).toHaveProp('value', '72');
    expect(await screen.findByTestId('evaluation-height')).toHaveProp('value', '175');
    expect(update).not.toHaveBeenCalled();
  });

  it('keeps weight and height independent: lb with cm', async () => {
    const update = jest.fn();
    await render(<MeasuresStep draft={draft} issues={[]} today={TODAY} update={update} />);

    await pick('weight', 'lb');
    expect(screen.getByTestId('evaluation-height')).toBeOnTheScreen();
    expect(screen.queryByTestId('evaluation-height-feet')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('evaluation-weight'), '160');
    expect(update).toHaveBeenLastCalledWith({ weightKg: expect.closeTo(72.575, 3) });
    await fireEvent.changeText(screen.getByTestId('evaluation-height'), '175');
    expect(update).toHaveBeenLastCalledWith({ heightCm: 175 });
  });
});
