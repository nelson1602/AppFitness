import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { Profile } from '../domain/profile.types';
import type { ProfileFormState } from '../application/profile.store';
import { ProfileForm } from './ProfileForm';

const load = jest.fn();
const save = jest.fn();

let mockStoreState: ProfileFormState;
let mockLanguage: 'en' | 'es' = 'en';

jest.mock('../application/profile.store', () => ({
  useProfileStore: () => mockStoreState,
}));

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

function setStore(partial: Partial<ProfileFormState>) {
  mockStoreState = {
    status: 'ready',
    profile: null,
    error: null,
    load,
    save,
    ...partial,
  };
}

const existingProfile: Profile = {
  id: 'p1',
  userId: 'u1',
  birthDate: '1988-01-02',
  gender: 'FEMALE',
  heightCm: 165,
  fitnessLevel: 'ADVANCED',
  yearsTraining: 6,
  activityLevel: 'ACTIVE',
  occupation: 'Nurse',
  sleepHoursBaseline: 7,
  stressLevelBaseline: 3,
  equipment: ['barbell', 'bands'],
  trainingDaysPerWeek: 5,
  sessionDurationMins: 60,
  targetCalories: null,
  targetProteinG: null,
  targetCarbsG: null,
  targetFatG: null,
  version: 2,
  syncStatus: 'synced',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

describe('ProfileForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'en';
  });

  it('loads the profile on mount', async () => {
    setStore({ status: 'loading' });

    await render(<ProfileForm onSaved={jest.fn()} />);

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  });

  it('shows a loading state while the profile resolves', async () => {
    setStore({ status: 'loading' });

    await render(<ProfileForm onSaved={jest.fn()} />);

    expect(screen.getByLabelText('Loading profile')).toBeOnTheScreen();
  });

  it('prefills fields from an existing profile (edit mode)', async () => {
    setStore({ status: 'ready', profile: existingProfile });

    await render(<ProfileForm onSaved={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByTestId('field-birthDate').props.value).toBe('1988-01-02'),
    );
    expect(screen.getByTestId('field-heightCm').props.value).toBe('165');
    expect(screen.getByText('Edit profile')).toBeOnTheScreen();
  });

  it('blocks submission and shows validation errors when required fields are empty', async () => {
    setStore({ status: 'ready', profile: null });

    await render(<ProfileForm onSaved={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(screen.getByText('Use YYYY-MM-DD')).toBeOnTheScreen());
    expect(save).not.toHaveBeenCalled();
  });

  it('maps valid input to the domain shape, saves, and calls onSaved', async () => {
    const onSaved = jest.fn();
    save.mockResolvedValue(true);
    setStore({ status: 'ready', profile: null });

    await render(<ProfileForm onSaved={onSaved} />);

    await fireEvent.changeText(screen.getByTestId('field-birthDate'), '1990-05-14');
    await fireEvent.changeText(screen.getByTestId('field-heightCm'), '178');
    await fireEvent.press(screen.getByTestId('option-fitnessLevel-INTERMEDIATE'));
    await fireEvent.press(screen.getByTestId('option-activityLevel-MODERATE'));
    await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        birthDate: '1990-05-14',
        heightCm: 178,
        fitnessLevel: 'INTERMEDIATE',
        activityLevel: 'MODERATE',
      }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it('renders Spanish copy and preserves stable enum values in the saved profile', async () => {
    mockLanguage = 'es';
    save.mockResolvedValue(true);
    setStore({ status: 'ready', profile: null });

    await render(<ProfileForm onSaved={jest.fn()} />);

    expect(screen.getByText('Crea tu perfil')).toBeOnTheScreen();
    expect(screen.getByText('Nivel de condición física *')).toBeOnTheScreen();
    expect(screen.getByText('Intermedio')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('field-birthDate'), '1990-05-14');
    await fireEvent.changeText(screen.getByTestId('field-heightCm'), '178');
    await fireEvent.press(screen.getByTestId('option-fitnessLevel-ADVANCED'));
    await fireEvent.press(screen.getByTestId('option-activityLevel-ACTIVE'));
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar perfil' }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          fitnessLevel: 'ADVANCED',
          activityLevel: 'ACTIVE',
        }),
      ),
    );
  });

  it('renders localized Spanish validation messages', async () => {
    mockLanguage = 'es';
    setStore({ status: 'ready', profile: null });

    await render(<ProfileForm onSaved={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar perfil' }));

    await waitFor(() => expect(screen.getByText('Usa AAAA-MM-DD')).toBeOnTheScreen());
    expect(save).not.toHaveBeenCalled();
  });

  it('does not navigate away when the save fails', async () => {
    const onSaved = jest.fn();
    save.mockResolvedValue(false);
    setStore({ status: 'ready', profile: null });

    await render(<ProfileForm onSaved={onSaved} />);

    await fireEvent.changeText(screen.getByTestId('field-birthDate'), '1990-05-14');
    await fireEvent.changeText(screen.getByTestId('field-heightCm'), '178');
    await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('surfaces a safe error banner from the store', async () => {
    setStore({
      status: 'error',
      profile: null,
      error: 'Your profile could not be saved. Please try again.',
    });

    await render(<ProfileForm onSaved={jest.fn()} />);

    expect(screen.getByText('Couldn’t save')).toBeOnTheScreen();
    expect(
      screen.getByText('Your profile could not be saved right now. Try again.'),
    ).toBeOnTheScreen();
    expect(
      screen.queryByText('Your profile could not be saved. Please try again.'),
    ).not.toBeOnTheScreen();
  });
});
