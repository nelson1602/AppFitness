import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { localDayOf } from '@/shared/application/local-day';
import { pickBirthDate } from '@/shared/presentation/birth-date-field.testkit';

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
  country: 'DO',
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
      expect(screen.getByLabelText('Birth date *, 01/02/1988')).toBeOnTheScreen(),
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

    await pickBirthDate('field-birthDate', '1990-05-14');
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
    await pickBirthDate('field-birthDate', '1990-05-14');
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

    await pickBirthDate('field-birthDate', '1990-05-14');
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

    expect(screen.getByText("Couldn't save")).toBeOnTheScreen();
    expect(
      screen.getByText('Your profile could not be saved right now. Try again.'),
    ).toBeOnTheScreen();
    expect(
      screen.queryByText('Your profile could not be saved. Please try again.'),
    ).not.toBeOnTheScreen();
  });

  it('renders a distinct web-unavailable state in English with no form, validation, or save controls (ADR-P019)', async () => {
    setStore({ status: 'web-unavailable', profile: null });

    await render(<ProfileForm onSaved={jest.fn()} />);

    // Neutral heading preserved.
    // v8 Block 3: the stack header names the screen; the page does not repeat it.
    expect(screen.queryByText('Profile')).toBeNull();
    expect(screen.getByText("Profile editing isn't available on the web")).toBeOnTheScreen();
    expect(
      screen.getByText('Use the AppFitnessRD mobile app to create and update your profile.'),
    ).toBeOnTheScreen();
    // No form fields, save control, generic error, or create/edit copy.
    expect(screen.queryByTestId('field-birthDate')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save profile' })).toBeNull();
    expect(screen.queryByText('Couldn’t save')).toBeNull();
    expect(screen.queryByText('Create your profile')).toBeNull();
  });

  it('shows the date pattern on an empty birth date instead of a typed-format hint', async () => {
    setStore({ status: 'ready', profile: null });
    await render(<ProfileForm onSaved={jest.fn()} />);
    expect(screen.getByLabelText('Birth date *, no date')).toBeOnTheScreen();
    expect(screen.getByText('MM/DD/YYYY')).toBeOnTheScreen();
  });

  // v8.1 (owner, ADR-P043 amendment): the birth date opens the Día / Mes / Año
  // wheel — ages 16 to 100, 30 years ago when empty — not the native calendar.
  it('opens the birth-date wheel, ages 16 to 100, starting 30 years ago', async () => {
    mockLanguage = 'es';
    setStore({ status: 'ready', profile: null });
    await render(<ProfileForm onSaved={jest.fn()} />);
    jest.mocked(DateTimePickerAndroid.open).mockClear();
    await fireEvent.press(screen.getByTestId('field-birthDate'));
    expect(DateTimePickerAndroid.open).not.toHaveBeenCalled();

    const today = localDayOf(new Date());
    const thisYear = Number(today.slice(0, 4));
    expect(screen.getByTestId('field-birthDate-wheel-year').props.accessibilityValue).toEqual({
      text: String(thisYear - 30),
    });
    const yearRow = (year: number) =>
      screen.queryByTestId(`field-birthDate-wheel-year-${year}`, { includeHiddenElements: true });
    expect(yearRow(thisYear - 16)).not.toBeNull();
    expect(yearRow(thisYear - 100)).not.toBeNull();
    expect(yearRow(thisYear - 15)).toBeNull();
    expect(yearRow(thisYear - 101)).toBeNull();
  });

  describe('País (v8.1)', () => {
    async function fillRequired() {
      await pickDate('field-birthDate', '1990-05-14');
      await fireEvent.changeText(screen.getByTestId('field-heightCm'), '178');
      await fireEvent.press(screen.getByTestId('option-fitnessLevel-INTERMEDIATE'));
      await fireEvent.press(screen.getByTestId('option-activityLevel-MODERATE'));
    }

    it('defaults a new profile to the Dominican Republic and saves it', async () => {
      save.mockResolvedValue(true);
      setStore({ status: 'ready', profile: null });
      await render(<ProfileForm onSaved={jest.fn()} />);

      expect(screen.getByTestId('profile-country-value')).toHaveTextContent('Dominican Republic');
      await fillRequired();
      await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));

      await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
      expect(save).toHaveBeenCalledWith(expect.objectContaining({ country: 'DO' }));
    });

    it('prefills the saved country and saves another one picked from the radio list', async () => {
      save.mockResolvedValue(true);
      setStore({ status: 'ready', profile: { ...existingProfile, country: 'MX' } });
      await render(<ProfileForm onSaved={jest.fn()} />);

      await waitFor(() =>
        expect(screen.getByTestId('profile-country-value')).toHaveTextContent('Mexico'),
      );
      expect(screen.queryByRole('radio', { name: 'Country: Colombia' })).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: 'Change country. Now: Mexico' }));
      expect(screen.getByRole('radio', { name: 'Country: Mexico' })).toBeSelected();
      expect(screen.getByRole('radio', { name: 'Country: Dominican Republic' })).not.toBeSelected();
      await fireEvent.press(screen.getByRole('radio', { name: 'Country: Colombia' }));

      // Picking closes the list and shows the choice.
      expect(screen.queryByRole('radio', { name: 'Country: Colombia' })).toBeNull();
      expect(screen.getByTestId('profile-country-value')).toHaveTextContent('Colombia');
      await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
      await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
      expect(save).toHaveBeenCalledWith(expect.objectContaining({ country: 'CO' }));
    });

    it('names the country in Spanish', async () => {
      mockLanguage = 'es';
      setStore({ status: 'ready', profile: null });
      await render(<ProfileForm onSaved={jest.fn()} />);

      expect(screen.getByText('País')).toBeOnTheScreen();
      expect(screen.getByTestId('profile-country-value')).toHaveTextContent('República Dominicana');
      expect(
        screen.getByText('Con República Dominicana, tu plan de comidas usa platos dominicanos.'),
      ).toBeOnTheScreen();
    });
  });

  it('renders the web-unavailable state in Spanish', async () => {
    mockLanguage = 'es';
    setStore({ status: 'web-unavailable', profile: null });

    await render(<ProfileForm onSaved={jest.fn()} />);

    // v8 Block 3: the stack header names the screen; the page does not repeat it.
    expect(screen.queryByText('Perfil')).toBeNull();
    expect(
      screen.getByText('La edición del perfil no está disponible en la web'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Usa la app móvil de AppFitnessRD para crear y actualizar tu perfil.'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('field-birthDate')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Guardar perfil' })).toBeNull();
  });
});
