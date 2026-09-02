import { render, screen } from '@testing-library/react-native';

import { en } from '@/shared/localization/resources/en';
import { es } from '@/shared/localization/resources/es';

import { DashboardSkeleton } from './dashboard-skeleton';

let mockLanguage: 'en' | 'es' = 'en';

jest.mock('@/shared/localization', () => ({
  useLocalization: () => ({
    language: mockLanguage,
    t: (key: keyof typeof import('@/shared/localization/resources/en').en) =>
      (mockLanguage === 'es'
        ? jest.requireActual<typeof import('@/shared/localization/resources/es')>(
            '@/shared/localization/resources/es',
          ).es
        : jest.requireActual<typeof import('@/shared/localization/resources/en')>(
            '@/shared/localization/resources/en',
          ).en)[key],
  }),
}));

/**
 * BUG-010: this component is the session-resolution loader for 12 routes, so its
 * accessible label reached assistive technology on every authenticated entry —
 * as a hardcoded English literal. These tests pin the label to the catalogue in
 * both languages. They assert what is RENDERED; they claim nothing about whether
 * or how a screen reader announces it (that is the UX-4C manual pass).
 */
describe('DashboardSkeleton', () => {
  beforeEach(() => {
    mockLanguage = 'en';
  });

  it('labels every placeholder from the catalogue in English (BUG-010)', async () => {
    await render(<DashboardSkeleton />);

    expect(screen.getAllByLabelText(en['common.loadingContentAccessibility'])).toHaveLength(3);
  });

  it('labels every placeholder from the catalogue in Spanish (BUG-010)', async () => {
    mockLanguage = 'es';
    await render(<DashboardSkeleton />);

    expect(screen.getAllByLabelText(es['common.loadingContentAccessibility'])).toHaveLength(3);
  });

  it('exposes no English string on a Spanish-locale device (BUG-010)', async () => {
    mockLanguage = 'es';
    await render(<DashboardSkeleton />);

    // The defect in one assertion: the old hardcoded literal, and the English
    // catalogue value, must both be absent under `es`.
    expect(screen.queryByLabelText('Loading dashboard section')).toBeNull();
    expect(screen.queryByLabelText(en['common.loadingContentAccessibility'])).toBeNull();
  });

  it('keeps EN and ES labels distinct, so the key is really resolved (BUG-010)', () => {
    // Guards against a catalogue regression that silently copies EN into ES and
    // would make the two locale tests above pass vacuously.
    expect(es['common.loadingContentAccessibility']).not.toBe(
      en['common.loadingContentAccessibility'],
    );
  });

  it('renders three placeholder cards and takes no props (BUG-010 API guard)', async () => {
    await render(<DashboardSkeleton />);

    // The visual/behavioural API is unchanged by the localization fix: still
    // three cards, still no props. Whether the label belongs on one container or
    // on repeated blocks is a UX-4C question, not a copy decision.
    expect(screen.getAllByLabelText(en['common.loadingContentAccessibility'])).toHaveLength(3);
    expect(DashboardSkeleton.length).toBe(0);
  });
});
