import { act, render, screen } from '@testing-library/react-native';
import { memo } from 'react';
import { Text } from 'react-native';

import { translatorFor } from './i18n';
import { setLanguagePreference } from './language-manager';
import { useLocalization } from './use-localization';

jest.mock('./language-storage', () => ({
  loadLanguagePreference: jest.fn().mockResolvedValue('es'),
  saveLanguagePreference: jest.fn().mockResolvedValue(undefined),
}));

/**
 * The React Compiler memoizes a component's output by its inputs. This child
 * stands in for that: it only re-renders when `t` changes identity. Before
 * v8.1 `t` never changed, so a live language switch left such strings in the
 * old language until the app restarted.
 */
const MemoTitle = memo(function MemoTitle({ t }: { t: (key: 'tabs.profile') => string }) {
  return <Text testID="title">{t('tabs.profile')}</Text>;
});

function Screen() {
  const { t } = useLocalization();
  return <MemoTitle t={t} />;
}

describe('useLocalization (v8.1 live language switch)', () => {
  it('gives each language its own stable translator', () => {
    expect(translatorFor('es')).toBe(translatorFor('es'));
    expect(translatorFor('es')).not.toBe(translatorFor('en'));
    expect(translatorFor('es')('tabs.profile')).toBe('Perfil');
    expect(translatorFor('en')('tabs.profile')).toBe('Profile');
  });

  it('re-renders memoized strings in the new language after a live switch', async () => {
    await act(() => setLanguagePreference('es'));
    await render(<Screen />);
    expect(screen.getByTestId('title')).toHaveTextContent('Perfil');

    await act(() => setLanguagePreference('en'));
    expect(screen.getByTestId('title')).toHaveTextContent('Profile');

    await act(() => setLanguagePreference('es'));
    expect(screen.getByTestId('title')).toHaveTextContent('Perfil');
  });
});
