import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { LanguageSelector } from './language-selector';

const mockSetLanguagePreference = jest.fn();

jest.mock('./use-localization', () => ({
  useLocalization: () => ({
    preference: 'system',
    language: 'en',
    status: 'ready',
    setLanguagePreference: mockSetLanguagePreference,
    t: (key: string) =>
      ({
        'language.title': 'Language',
        'language.description': 'Choose the language used by AppFitness.',
        'language.system': 'Device language',
        'language.spanish': 'Spanish',
        'language.english': 'English',
        'language.saveError': 'Language preference could not be saved. Try again.',
      })[key] ?? key,
  }),
}));
jest.mock('@/shared/infrastructure/logging/logger', () => ({ logError: jest.fn() }));

describe('LanguageSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetLanguagePreference.mockResolvedValue(undefined);
  });

  it('exposes accessible system, Spanish, and English radio options', async () => {
    await render(<LanguageSelector />);

    expect(screen.getByRole('radio', { name: 'Language: Device language' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Language: Spanish' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Language: English' })).toBeOnTheScreen();
    expect(screen.getByTestId('language-option-system')).toHaveProp('accessibilityState', {
      disabled: false,
      selected: true,
    });
  });

  it('requests and persists the selected language', async () => {
    await render(<LanguageSelector />);

    await act(async () => {
      fireEvent.press(screen.getByRole('radio', { name: 'Language: Spanish' }));
    });

    await waitFor(() => expect(mockSetLanguagePreference).toHaveBeenCalledWith('es'));
  });

  it('shows a safe error if persistence fails', async () => {
    mockSetLanguagePreference.mockRejectedValue(new Error('storage unavailable'));
    await render(<LanguageSelector />);

    await act(async () => {
      fireEvent.press(screen.getByRole('radio', { name: 'Language: English' }));
    });

    expect(
      await screen.findByText('Language preference could not be saved. Try again.'),
    ).toBeOnTheScreen();
  });
});
