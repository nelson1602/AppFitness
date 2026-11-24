import { AppState } from 'react-native';

import { type AppConfig, EMPTY_APP_CONFIG } from '../domain/app-config';
import { fetchAppConfig } from '../infrastructure/app-config-api';
import {
  APP_CONFIG_REFRESH_INTERVAL_MS,
  startAppConfigWatch,
  useAppConfigStore,
} from './app-config.store';

jest.mock('../infrastructure/app-config-api', () => ({ fetchAppConfig: jest.fn() }));

const mockFetch = fetchAppConfig as jest.MockedFunction<typeof fetchAppConfig>;

const NOTICE: AppConfig = {
  maintenance: { tone: 'warning', message: { es: 'Mantenimiento', en: 'Maintenance' } },
  minAndroidVersionCode: 14,
};

let now = 1_000_000;
let foreground: ((state: string) => void) | null = null;
const remove = jest.fn();

beforeEach(() => {
  now = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    foreground = listener as (state: string) => void;
    return { remove } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
  mockFetch.mockReset();
  useAppConfigStore.setState({ config: EMPTY_APP_CONFIG, lastAttemptAt: null });
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Lets the store's request settle. */
const settle = () => new Promise<void>((resolve) => setImmediate(() => resolve()));

describe('useAppConfigStore (ADR-P049 amendment 1)', () => {
  it('loads once on start and shares a request already running', async () => {
    mockFetch.mockResolvedValue(NOTICE);
    const stop = startAppConfigWatch();
    // A second start, and a refresh while the first request runs, ask nothing more.
    expect(startAppConfigWatch()).toBe(stop);
    void useAppConfigStore.getState().refresh();
    await settle();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(useAppConfigStore.getState().config).toEqual(NOTICE);
    stop();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('refreshes on return to the foreground no more than once per 60 s', async () => {
    mockFetch.mockResolvedValue(NOTICE);
    const stop = startAppConfigWatch();
    await settle();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    now += APP_CONFIG_REFRESH_INTERVAL_MS - 1;
    foreground?.('active');
    await settle();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    now += 1;
    foreground?.('background');
    await settle();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    foreground?.('active');
    await settle();
    expect(mockFetch).toHaveBeenCalledTimes(2);
    stop();
  });

  it('keeps the last good value when a request fails', async () => {
    mockFetch.mockResolvedValueOnce(NOTICE).mockResolvedValueOnce(null);
    await useAppConfigStore.getState().refresh();
    expect(useAppConfigStore.getState().config).toEqual(NOTICE);

    now += APP_CONFIG_REFRESH_INTERVAL_MS;
    await useAppConfigStore.getState().refresh();
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(useAppConfigStore.getState().config).toEqual(NOTICE);
  });

  it('clears the notice when the server says there is none', async () => {
    mockFetch.mockResolvedValueOnce(NOTICE).mockResolvedValueOnce(EMPTY_APP_CONFIG);
    await useAppConfigStore.getState().refresh();
    now += APP_CONFIG_REFRESH_INTERVAL_MS;
    await useAppConfigStore.getState().refresh();
    expect(useAppConfigStore.getState().config).toEqual(EMPTY_APP_CONFIG);
  });
});
