import {
  decryptFromBase64,
  decryptText,
  encryptText,
  encryptToBase64,
  fromBase64,
  getFieldKeyId,
  toBase64,
} from './field-cipher';

// In-memory SecureStore + deterministic-but-varying randomness. Factory
// variables must be `mock`-prefixed for jest.mock hoisting.
const mockStore = new Map<string, string>();
let mockRandomCounter = 0;

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((k: string) => Promise.resolve(mockStore.get(k) ?? null)),
  setItemAsync: jest.fn((k: string, v: string) => {
    mockStore.set(k, v);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((k: string) => {
    mockStore.delete(k);
    return Promise.resolve();
  }),
}));
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn((length: number) => {
    mockRandomCounter += 1;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) bytes[i] = (i * 7 + mockRandomCounter * 31) & 0xff;
    return Promise.resolve(bytes);
  }),
  randomUUID: jest.fn(() => 'aabbccdd-1234-5678-9abc-def012345678'),
}));

/**
 * NOTE: test order matters for the first two tests — the module caches the
 * device key after first successful use, so the corrupted-key scenario must
 * run before any key is created.
 */
describe('field cipher (ADR-P001)', () => {
  it('fails loudly when the stored device key is corrupted (no silent fallback)', async () => {
    mockStore.set('crypto.fieldKey', '!!!not-base64!!!');
    mockStore.set('crypto.fieldKeyId', 'device-corrupt');

    await expect(encryptText('hello')).rejects.toThrow('invalid base64 input');

    mockStore.clear();
  });

  it('creates and persists a device key in SecureStore on first use', async () => {
    const keyId = await getFieldKeyId();

    expect(keyId).toBe('device-aabbccdd');
    expect(mockStore.get('crypto.fieldKeyId')).toBe(keyId);
    expect(mockStore.get('crypto.fieldKey')).toEqual(expect.any(String));
  });

  it('round-trips plaintext through encrypt/decrypt', async () => {
    const plaintext = 'patient reports knee pain — avoid deep squats';

    const encrypted = await encryptText(plaintext);
    await expect(decryptText(encrypted)).resolves.toBe(plaintext);

    const encoded = await encryptToBase64(plaintext);
    await expect(decryptFromBase64(encoded)).resolves.toBe(plaintext);
  });

  it('produces different ciphertexts for identical plaintext (fresh nonce per call)', async () => {
    const a = await encryptToBase64('same text');
    const b = await encryptToBase64('same text');

    expect(a).not.toBe(b);
  });

  it('never embeds recognizable plaintext in the stored bytes', async () => {
    const plaintext = 'SENSITIVE-MEDICAL-NOTE';
    const encoded = await encryptToBase64(plaintext);

    expect(encoded).not.toContain(plaintext);
    expect(encoded).not.toContain(toBase64(new TextEncoder().encode(plaintext)));
  });

  it('rejects tampered ciphertext (GCM authentication)', async () => {
    const encrypted = await encryptText('integrity matters');
    const tampered = new Uint8Array(encrypted);
    tampered[tampered.length - 1] ^= 0xff; // flip a tag byte

    await expect(decryptText(tampered)).rejects.toThrow();
  });

  it('reuses the persisted key instead of minting a new one per call', async () => {
    const storedKey = mockStore.get('crypto.fieldKey');

    await encryptText('one');
    await encryptText('two');

    expect(mockStore.get('crypto.fieldKey')).toBe(storedKey);
  });
});

describe('base64 helpers', () => {
  it('round-trips byte arrays of every padding length', () => {
    for (const bytes of [
      new Uint8Array([1]),
      new Uint8Array([1, 2]),
      new Uint8Array([1, 2, 3]),
      new Uint8Array([0, 255, 128, 64, 32, 7]),
      new Uint8Array([]),
    ]) {
      expect(fromBase64(toBase64(bytes))).toEqual(bytes);
    }
  });

  it('rejects non-base64 input instead of decoding garbage', () => {
    expect(() => fromBase64('abc$def')).toThrow('invalid base64 input');
  });
});
