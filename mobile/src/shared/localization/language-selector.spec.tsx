import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import { Platform } from 'react-native';

import { darkColors } from '@/shared/theme';

import { LanguageSelector } from './language-selector';

const mockSetLanguagePreference = jest.fn();
const mockState: { preference: 'system' | 'es' | 'en'; language: 'en' | 'es' } = {
  preference: 'system',
  language: 'en',
};

jest.mock('./use-localization', () => ({
  useLocalization: () => {
    const resources = {
      en: jest.requireActual('./resources/en').en,
      es: jest.requireActual('./resources/es').es,
    };
    return {
      preference: mockState.preference,
      language: mockState.language,
      status: 'ready',
      setLanguagePreference: mockSetLanguagePreference,
      t: (key: string) => resources[mockState.language][key] ?? key,
    };
  },
}));
jest.mock('@/shared/infrastructure/logging/logger', () => ({ logError: jest.fn() }));

describe('LanguageSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetLanguagePreference.mockResolvedValue(undefined);
    mockState.preference = 'system';
    mockState.language = 'en';
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exposes exactly two radio options, Spanish and English, with no device-language choice', async () => {
    await render(<LanguageSelector />);

    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: 'Language: Español' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Language: English' })).toBeOnTheScreen();
    expect(screen.queryByTestId('language-option-system')).toBeNull();
    expect(screen.queryByText('Device language')).toBeNull();
    expect(screen.getByTestId('language-option-en')).toHaveProp('accessibilityState', {
      disabled: false,
      selected: true,
    });
  });

  // Backward compatibility: a stored 'system' preference (the earlier
  // three-option model, or no explicit choice) shows the radio that matches the
  // resolved language, so exactly one of the two is selected.
  it.each([
    ['system', 'es', 'es'],
    ['system', 'en', 'en'],
    ['es', 'es', 'es'],
    ['en', 'en', 'en'],
  ] as const)(
    'with a stored %s preference resolved to %s, selects exactly %s',
    async (preference, language, expected) => {
      mockState.preference = preference;
      mockState.language = language;
      await render(<LanguageSelector />);

      for (const option of ['es', 'en'] as const) {
        expect(
          screen.getByTestId(`language-option-${option}`).props.accessibilityState.selected,
        ).toBe(option === expected);
      }
    },
  );

  it('requests and persists the selected language', async () => {
    await render(<LanguageSelector />);

    await act(async () => {
      fireEvent.press(screen.getByRole('radio', { name: 'Language: Español' }));
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

  // BUG-039: react-native-web does not read `accessibilityState`, so a browser
  // screen reader read every option "not checked". On Web each radio also
  // carries `aria-checked`, which react-native-web emits as the DOM attribute.
  // Under Jest, React Native's Pressable folds `aria-checked` into the host
  // `accessibilityState.checked`; the component never sets `checked` itself, so
  // that field is present only because `aria-checked` was passed. Prop evidence
  // only here; the NVDA + Chrome outcome is recorded in the backlog.
  describe('Web checked state (BUG-039)', () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', 'web');
    });

    const options = ['es', 'en'] as const;
    const state = (option: (typeof options)[number]) =>
      screen.getByTestId(`language-option-${option}`).props.accessibilityState;
    const checkedOptions = () => options.filter((option) => state(option).checked === true);

    it.each([
      ['en', ['Language: Español', 'Language: English']],
      ['es', ['Idioma: Español', 'Idioma: English']],
    ] as const)(
      'checks exactly the selected option in %s, with unchanged labels',
      async (language, names) => {
        mockState.language = language;
        await render(<LanguageSelector />);

        for (const name of names) {
          expect(screen.getAllByRole('radio', { name })).toHaveLength(1);
        }
        expect(screen.getAllByRole('radio')).toHaveLength(2);
        expect(checkedOptions()).toEqual([language]);
        for (const option of options) {
          expect(state(option).checked).toBe(option === language);
        }
      },
    );

    it('moves the checked state when the selected option changes', async () => {
      const view = await render(<LanguageSelector />);
      expect(checkedOptions()).toEqual(['en']);

      mockState.preference = 'es';
      mockState.language = 'es';
      await view.rerender(<LanguageSelector />);
      expect(checkedOptions()).toEqual(['es']);
      expect(
        screen.getByRole('radio', { name: 'Idioma: Español' }).props.accessibilityState.checked,
      ).toBe(true);
      expect(
        screen.getByRole('radio', { name: 'Idioma: English' }).props.accessibilityState.checked,
      ).toBe(false);

      mockState.preference = 'en';
      mockState.language = 'en';
      await view.rerender(<LanguageSelector />);
      expect(checkedOptions()).toEqual(['en']);
    });

    it('keeps the native selected state alongside the checked state', async () => {
      mockState.preference = 'en';
      await render(<LanguageSelector />);

      for (const option of options) {
        expect(state(option)).toEqual(
          expect.objectContaining({
            checked: option === 'en',
            disabled: false,
            selected: option === 'en',
          }),
        );
      }
    });
  });

  // BUG-039: react-native-web activates a Pressable with Space only for the
  // button role, so Space on a Web radio selected nothing (Enter worked). On Web
  // Space now selects the focused radio through the same handler as a press.
  describe('Web Space activation (BUG-039)', () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', 'web');
    });

    const keyDown = async (option: string, key: string, repeat = false) => {
      const event = { key, nativeEvent: { repeat }, preventDefault: jest.fn() };
      await act(async () => {
        fireEvent(screen.getByTestId(`language-option-${option}`), 'keyDown', event);
      });
      return event;
    };

    it.each([
      ['es', ' '],
      ['en', 'Spacebar'],
    ] as const)('selects %s once on Space and prevents its default', async (option, key) => {
      mockState.language = option === 'en' ? 'es' : 'en';
      await render(<LanguageSelector />);

      const event = await keyDown(option, key);

      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(mockSetLanguagePreference).toHaveBeenCalledTimes(1);
      expect(mockSetLanguagePreference).toHaveBeenCalledWith(option);
    });

    it('leaves Enter and other keys to the existing activation', async () => {
      await render(<LanguageSelector />);

      for (const key of ['Enter', 'Tab', 'a']) {
        const event = await keyDown('es', key);
        expect(event.preventDefault).not.toHaveBeenCalled();
      }
      expect(mockSetLanguagePreference).not.toHaveBeenCalled();

      // Enter's existing activation is the press path, and it runs once.
      await act(async () => {
        fireEvent.press(screen.getByTestId('language-option-es'));
      });
      expect(mockSetLanguagePreference).toHaveBeenCalledTimes(1);
      expect(mockSetLanguagePreference).toHaveBeenCalledWith('es');
    });

    it('ignores a held-down Space repeat', async () => {
      await render(<LanguageSelector />);

      const event = await keyDown('es', ' ', true);

      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(mockSetLanguagePreference).not.toHaveBeenCalled();
    });

    it('ignores Space while a selection is still saving', async () => {
      let finish: () => void = () => {};
      mockSetLanguagePreference.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
      await render(<LanguageSelector />);

      await keyDown('es', ' ');
      // While saving, the radios are disabled and the test renderer refuses
      // events on them, but react-native-web's Pressable still forwards a
      // keydown to `onKeyDown`, so call it directly as the browser would.
      await act(async () => {
        screen
          .getByTestId('language-option-en')
          .props.onKeyDown({ key: ' ', nativeEvent: { repeat: false }, preventDefault: jest.fn() });
      });
      expect(mockSetLanguagePreference).toHaveBeenCalledTimes(1);
      expect(mockSetLanguagePreference).toHaveBeenCalledWith('es');

      await act(async () => {
        finish();
      });
    });
  });

  // ADR-P035: the stage appearance changes only the look — the same two radios,
  // names and selected state, plus a non-colour selected signal (border width).
  it('keeps the radio semantics in the stage appearance', async () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');
    mockState.language = 'es';
    await render(<LanguageSelector appearance="stage" />);

    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: 'Idioma: Español' })).toHaveProp(
      'accessibilityState',
      {
        disabled: false,
        selected: true,
      },
    );
    const flat = (option: string) =>
      ReactNative.StyleSheet.flatten(screen.getByTestId(`language-option-${option}`).props.style);
    expect(flat('es')).toEqual(
      expect.objectContaining({ backgroundColor: darkColors.fieldFill, borderWidth: 2 }),
    );
    expect(flat('en')).toEqual(
      expect.objectContaining({ backgroundColor: darkColors.glassFill, borderWidth: 1 }),
    );
    expect(screen.queryByText('Elige el idioma que usa AppFitnessRD.')).toBeNull();
  });

  it.each(['android', 'ios'] as const)(
    'keeps %s on accessibilityState.selected alone, with no checked state',
    async (os) => {
      jest.replaceProperty(Platform, 'OS', os);
      mockState.preference = 'es';
      mockState.language = 'es';
      await render(<LanguageSelector />);

      for (const option of ['es', 'en'] as const) {
        const node = screen.getByTestId(`language-option-${option}`);
        expect(node.props.accessibilityState.checked).toBeUndefined();
        expect(node).toHaveProp('accessibilityState', {
          disabled: false,
          selected: option === 'es',
        });
      }
    },
  );

  it.each(['android', 'ios'] as const)(
    'adds no key handler on %s and keeps press selection',
    async (os) => {
      jest.replaceProperty(Platform, 'OS', os);
      await render(<LanguageSelector />);

      for (const option of ['es', 'en'] as const) {
        expect(screen.getByTestId(`language-option-${option}`).props.onKeyDown).toBeUndefined();
      }
      await act(async () => {
        fireEvent.press(screen.getByTestId('language-option-es'));
      });
      expect(mockSetLanguagePreference).toHaveBeenCalledTimes(1);
      expect(mockSetLanguagePreference).toHaveBeenCalledWith('es');
    },
  );
});
