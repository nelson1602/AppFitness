import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// Import the Web platform file explicitly so the dormant adapter is under test.
import {
  decryptFromBase64,
  decryptText,
  encryptText,
  encryptToBase64,
  fromBase64,
  getFieldKeyId,
  toBase64,
} from './field-cipher.web';

// The Web adapter must never touch these. Spies prove the code path never
// reaches a keystore, randomness source, or key generator.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(),
  randomUUID: jest.fn(),
}));

const UNSUPPORTED_ON_WEB = 'Field encryption is unsupported on Web';

describe('field cipher (web) — dormant, fail-safe (ADR-P018 Slice 2B2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects every async crypto/key operation with a stable, non-sensitive message', async () => {
    await expect(getFieldKeyId()).rejects.toThrow(UNSUPPORTED_ON_WEB);
    await expect(encryptText('sensitive note')).rejects.toThrow(UNSUPPORTED_ON_WEB);
    await expect(decryptText(new Uint8Array([1, 2, 3]))).rejects.toThrow(UNSUPPORTED_ON_WEB);
    await expect(encryptToBase64('sensitive note')).rejects.toThrow(UNSUPPORTED_ON_WEB);
    await expect(decryptFromBase64('AAAAAAAAAAAAAAAA')).rejects.toThrow(UNSUPPORTED_ON_WEB);
  });

  it('throws on the synchronous base64 helpers too (module fully dormant)', () => {
    expect(() => toBase64(new Uint8Array([1, 2, 3]))).toThrow(UNSUPPORTED_ON_WEB);
    expect(() => fromBase64('AAAA')).toThrow(UNSUPPORTED_ON_WEB);
  });

  it('never returns input plaintext or partial data as a fallback (rejects, not resolves)', async () => {
    // A resolved value would signal a silent/plaintext fallback — forbidden.
    await expect(encryptToBase64('SENSITIVE-MEDICAL-NOTE')).rejects.toBeInstanceOf(Error);
    await expect(decryptFromBase64('SENSITIVE-MEDICAL-NOTE')).rejects.toBeInstanceOf(Error);
  });

  it('performs no SecureStore, key-generation, or randomness call', async () => {
    await Promise.allSettled([
      getFieldKeyId(),
      encryptText('x'),
      decryptText(new Uint8Array([1])),
      encryptToBase64('x'),
      decryptFromBase64('AAAA'),
    ]);

    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(Crypto.getRandomBytesAsync).not.toHaveBeenCalled();
    expect(Crypto.randomUUID).not.toHaveBeenCalled();
  });

  it('never writes a key to browser storage', async () => {
    const localSetItem = jest.fn();
    const sessionSetItem = jest.fn();
    Object.defineProperty(globalThis, 'localStorage', {
      value: { setItem: localSetItem, getItem: jest.fn(), removeItem: jest.fn() },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: { setItem: sessionSetItem, getItem: jest.fn(), removeItem: jest.fn() },
      configurable: true,
      writable: true,
    });

    try {
      await Promise.allSettled([getFieldKeyId(), encryptToBase64('x'), decryptFromBase64('AAAA')]);

      expect(localSetItem).not.toHaveBeenCalled();
      expect(sessionSetItem).not.toHaveBeenCalled();
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
      delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
    }
  });
});
