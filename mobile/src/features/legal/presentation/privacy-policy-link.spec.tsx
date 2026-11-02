import { fireEvent, render, screen } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';

import { PrivacyPolicyLink, privacyPolicyUrl } from './privacy-policy-link';

let mockLanguage: 'en' | 'es' = 'en';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('@/shared/localization', () => ({
  useLocalization: () => ({
    language: mockLanguage,
    t: (key: string) =>
      key === 'legal.privacyPolicyAccessibility' ? 'Open privacy policy' : 'Privacy policy',
  }),
}));

describe('PrivacyPolicyLink (v8 Block 4)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the published English and Spanish URLs', () => {
    expect(privacyPolicyUrl('en')).toBe('https://appfitnessrd.com/en/privacy/');
    expect(privacyPolicyUrl('es')).toBe('https://appfitnessrd.com/privacidad/');
  });

  it.each([
    ['en', 'https://appfitnessrd.com/en/privacy/'],
    ['es', 'https://appfitnessrd.com/privacidad/'],
  ] as const)('opens the %s policy in the in-app browser', async (selected, url) => {
    mockLanguage = selected;
    await render(<PrivacyPolicyLink testID="privacy" />);
    await fireEvent.press(screen.getByTestId('privacy'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(url);
  });
});
