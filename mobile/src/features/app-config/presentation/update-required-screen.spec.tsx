import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { UpdateRequiredScreen } from './update-required-screen';

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

jest.mock('expo-application', () => ({
  __esModule: true,
  nativeBuildVersion: '16',
  applicationId: 'com.appfitnessrd.mobile',
}));

describe('UpdateRequiredScreen (ADR-P049 amendment 1)', () => {
  let openURL: jest.SpyInstance;

  beforeEach(() => {
    mockLanguage = 'en';
    openURL = jest.spyOn(Linking, 'openURL');
  });

  afterEach(() => openURL.mockRestore());

  it('renders the title as a header, the explanation and the action in English', async () => {
    await render(<UpdateRequiredScreen />);
    expect(screen.getByRole('header', { name: 'Update the app' })).toBeOnTheScreen();
    expect(screen.getByText(/no longer supported/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Update' })).toBeOnTheScreen();
  });

  it('renders in Spanish', async () => {
    mockLanguage = 'es';
    await render(<UpdateRequiredScreen />);
    expect(screen.getByRole('header', { name: 'Actualiza la app' })).toBeOnTheScreen();
    expect(screen.getByText(/Tus datos se conservan\./)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeOnTheScreen();
  });

  it('opens the Play Store listing', async () => {
    openURL.mockResolvedValue(true);
    await render(<UpdateRequiredScreen />);
    await fireEvent.press(screen.getByTestId('button-update-required'));
    expect(openURL).toHaveBeenCalledWith('market://details?id=com.appfitnessrd.mobile');
  });

  it('falls back to the web listing when market:// is rejected', async () => {
    openURL.mockRejectedValueOnce(new Error('no handler')).mockResolvedValueOnce(true);
    await render(<UpdateRequiredScreen />);
    await fireEvent.press(screen.getByTestId('button-update-required'));
    expect(openURL).toHaveBeenNthCalledWith(
      2,
      'https://play.google.com/store/apps/details?id=com.appfitnessrd.mobile',
    );
  });
});
