import * as SecureStore from 'expo-secure-store';

import { logError } from '@/shared/infrastructure/logging/logger';

import { parseSignupCountry, SIGNUP_COUNTRY_STORAGE_KEY } from './signup-country';
import {
  forgetSignupCountry,
  readSignupCountry,
  rememberSignupCountry,
} from './signup-country.storage';
import * as web from './signup-country.storage.web';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/shared/infrastructure/logging/logger', () => ({ logError: jest.fn() }));

const VALUE = { userId: 'user-1', country: 'DO' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('parseSignupCountry (v8.1)', () => {
  it('reads a stored account and country back', () => {
    expect(parseSignupCountry(JSON.stringify(VALUE))).toEqual(VALUE);
  });

  it('treats anything malformed as none', () => {
    expect(parseSignupCountry(null)).toBeNull();
    expect(parseSignupCountry('not json')).toBeNull();
    expect(parseSignupCountry('null')).toBeNull();
    expect(parseSignupCountry('"DO"')).toBeNull();
    expect(parseSignupCountry(JSON.stringify({ userId: '', country: 'DO' }))).toBeNull();
    expect(parseSignupCountry(JSON.stringify({ userId: 'user-1', country: 'do' }))).toBeNull();
    expect(parseSignupCountry(JSON.stringify({ userId: 'user-1' }))).toBeNull();
  });
});

describe('sign-up country storage, native (v8.1)', () => {
  it('remembers, reads and forgets the value under its key', async () => {
    await rememberSignupCountry(VALUE);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      SIGNUP_COUNTRY_STORAGE_KEY,
      JSON.stringify(VALUE),
    );

    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify(VALUE));
    expect(await readSignupCountry()).toEqual(VALUE);

    await forgetSignupCountry();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(SIGNUP_COUNTRY_STORAGE_KEY);
  });

  it('logs storage failures and never throws', async () => {
    jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('full'));
    jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('locked'));
    jest.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error('gone'));

    await expect(rememberSignupCountry(VALUE)).resolves.toBeUndefined();
    await expect(readSignupCountry()).resolves.toBeNull();
    await expect(forgetSignupCountry()).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledTimes(3);
  });
});

describe('sign-up country storage, Web (v8.1)', () => {
  const store = new Map<string, string>();
  const fakeStorage = {
    getItem: jest.fn((key: string) => store.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => void store.set(key, value)),
    removeItem: jest.fn((key: string) => void store.delete(key)),
  };

  beforeEach(() => {
    store.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: fakeStorage,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('keeps the value in localStorage', async () => {
    await web.rememberSignupCountry(VALUE);
    expect(await web.readSignupCountry()).toEqual(VALUE);
    await web.forgetSignupCountry();
    expect(await web.readSignupCountry()).toBeNull();
  });

  it('logs failures and never throws', async () => {
    fakeStorage.setItem.mockImplementationOnce(() => {
      throw new Error('quota');
    });
    fakeStorage.getItem.mockImplementationOnce(() => {
      throw new Error('blocked');
    });
    fakeStorage.removeItem.mockImplementationOnce(() => {
      throw new Error('blocked');
    });

    await expect(web.rememberSignupCountry(VALUE)).resolves.toBeUndefined();
    await expect(web.readSignupCountry()).resolves.toBeNull();
    await expect(web.forgetSignupCountry()).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledTimes(3);
  });

  it('reads nothing when localStorage is missing', async () => {
    Reflect.deleteProperty(globalThis, 'localStorage');
    expect(await web.readSignupCountry()).toBeNull();
    await expect(web.rememberSignupCountry(VALUE)).resolves.toBeUndefined();
  });
});
