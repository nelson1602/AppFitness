import { logError } from '@/shared/infrastructure/logging/logger';

// Import the Web platform file explicitly so the adapter under test is the
// localStorage-backed one regardless of the jest default platform.
import { loadLanguagePreference, saveLanguagePreference } from './language-storage.web';

jest.mock('@/shared/infrastructure/logging/logger', () => ({
  logError: jest.fn(),
}));

const KEY = 'appfitness.language-preference';

interface StorageMock {
  storage: Storage;
  getItem: jest.Mock;
  setItem: jest.Mock;
}

/** A minimal in-memory localStorage double. */
function memoryStorage(seed?: string): StorageMock {
  const map = new Map<string, string>();
  if (seed !== undefined) map.set(KEY, seed);

  const getItem = jest.fn((key: string) => (map.has(key) ? (map.get(key) as string) : null));
  const setItem = jest.fn((key: string, value: string) => {
    map.set(key, value);
  });

  return { storage: { getItem, setItem } as unknown as Storage, getItem, setItem };
}

function setLocalStorage(value: Storage | undefined): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value,
    configurable: true,
    writable: true,
  });
}

describe('web language preference storage', () => {
  let original: PropertyDescriptor | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  });

  afterEach(() => {
    if (original) {
      Object.defineProperty(globalThis, 'localStorage', original);
    } else {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });

  it('loads a supported persisted preference from localStorage', async () => {
    const { storage, getItem } = memoryStorage('es');
    setLocalStorage(storage);

    await expect(loadLanguagePreference()).resolves.toBe('es');
    expect(getItem).toHaveBeenCalledWith(KEY);
  });

  it('persists an explicit language to localStorage without storing user content', async () => {
    const { storage, setItem } = memoryStorage();
    setLocalStorage(storage);

    await saveLanguagePreference('en');

    expect(setItem).toHaveBeenCalledWith(KEY, 'en');
  });

  it('round-trips a saved preference (save then load)', async () => {
    const { storage } = memoryStorage();
    setLocalStorage(storage);

    await saveLanguagePreference('es');

    await expect(loadLanguagePreference()).resolves.toBe('es');
  });

  it('falls back to the device preference for missing or unsupported values', async () => {
    setLocalStorage(memoryStorage().storage); // nothing stored -> null
    await expect(loadLanguagePreference()).resolves.toBe('system');

    setLocalStorage(memoryStorage('fr').storage); // unsupported locale
    await expect(loadLanguagePreference()).resolves.toBe('system');
  });

  it('degrades safely to system and is a no-op save when localStorage is unavailable', async () => {
    setLocalStorage(undefined);

    await expect(loadLanguagePreference()).resolves.toBe('system');
    await expect(saveLanguagePreference('es')).resolves.toBeUndefined();
  });

  it('degrades safely and reports via the logging boundary when localStorage throws', async () => {
    const throwing = {
      getItem: jest.fn(() => {
        throw new Error('SecurityError: storage is disabled');
      }),
      setItem: jest.fn(() => {
        throw new Error('QuotaExceededError');
      }),
    } as unknown as Storage;
    setLocalStorage(throwing);

    await expect(loadLanguagePreference()).resolves.toBe('system');
    await expect(saveLanguagePreference('en')).resolves.toBeUndefined();

    expect(jest.mocked(logError)).toHaveBeenCalledWith(
      'localization.storage.web.load',
      expect.anything(),
    );
    expect(jest.mocked(logError)).toHaveBeenCalledWith(
      'localization.storage.web.save',
      expect.anything(),
    );
  });
});
