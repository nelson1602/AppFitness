import { render, screen } from '@testing-library/react-native';

import { useAppConfigStore } from '../application/app-config.store';
import { type AppConfig, EMPTY_APP_CONFIG } from '../domain/app-config';
import { MaintenanceBanner } from './maintenance-banner';

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

jest.mock('../infrastructure/app-config-api', () => ({ fetchAppConfig: jest.fn() }));

const config = (tone: 'info' | 'warning'): AppConfig => ({
  maintenance: { tone, message: { es: 'Mantenimiento a las 22:00', en: 'Maintenance at 22:00' } },
  minAndroidVersionCode: null,
});

beforeEach(() => {
  mockLanguage = 'en';
  useAppConfigStore.setState({ config: EMPTY_APP_CONFIG, lastAttemptAt: null });
});

describe('MaintenanceBanner (ADR-P049 amendment 1)', () => {
  it('renders nothing while there is no notice', async () => {
    await render(<MaintenanceBanner placement="shell" />);
    expect(screen.toJSON()).toBeNull();
    await render(<MaintenanceBanner placement="inline" />);
    expect(screen.toJSON()).toBeNull();
  });

  it('shows the notice in English with the server tone', async () => {
    useAppConfigStore.setState({ config: config('info') });
    await render(<MaintenanceBanner placement="shell" />);
    expect(screen.getByTestId('shell-maintenance-notice')).toBeTruthy();
    expect(screen.getByText('Notice')).toBeTruthy();
    expect(screen.getByText('Maintenance at 22:00')).toBeTruthy();
    expect(screen.queryByText('Mantenimiento a las 22:00')).toBeNull();
  });

  it('shows the notice in Spanish, inline, without the shell frame', async () => {
    mockLanguage = 'es';
    useAppConfigStore.setState({ config: config('warning') });
    await render(<MaintenanceBanner placement="inline" />);
    expect(screen.getByText('Aviso')).toBeTruthy();
    expect(screen.getByText('Mantenimiento a las 22:00')).toBeTruthy();
    expect(screen.queryByTestId('shell-maintenance-notice')).toBeNull();
  });

  // An info Banner title takes the primary tone, a warning one the warning tone.
  it('colours the title by tone', async () => {
    useAppConfigStore.setState({ config: config('info') });
    await render(<MaintenanceBanner placement="inline" />);
    const infoColor = screen.getByText('Notice').props.style;
    await screen.unmount();
    useAppConfigStore.setState({ config: config('warning') });
    await render(<MaintenanceBanner placement="inline" />);
    const warningColor = screen.getByText('Notice').props.style;
    expect(JSON.stringify(warningColor)).not.toEqual(JSON.stringify(infoColor));
  });
});
