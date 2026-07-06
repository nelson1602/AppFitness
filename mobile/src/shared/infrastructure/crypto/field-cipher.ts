import { gcm } from '@noble/ciphers/aes.js';
import { bytesToUtf8, utf8ToBytes } from '@noble/ciphers/utils.js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * Device field cipher (ADR-P001, Accepted): AES-256-GCM via the audited
 * @noble/ciphers. The per-device 256-bit key lives ONLY in SecureStore
 * (hardware-backed) — never hardcoded, never in SQLite. Stored format:
 * nonce(12) ‖ ciphertext ‖ GCM tag(16).
 *
 * Key loss is recoverable: the server holds the canonical copy and
 * re-sync restores data (ADR-P001 refinement note).
 */

const KEY_STORE = 'crypto.fieldKey';
const KEY_ID_STORE = 'crypto.fieldKeyId';
const NONCE_LENGTH = 12;

let cached: { key: Uint8Array; keyId: string } | null = null;

async function getOrCreateKey(): Promise<{ key: Uint8Array; keyId: string }> {
  if (cached) return cached;

  let keyB64 = await SecureStore.getItemAsync(KEY_STORE);
  let keyId = await SecureStore.getItemAsync(KEY_ID_STORE);

  if (!keyB64 || !keyId) {
    const raw = await Crypto.getRandomBytesAsync(32);
    keyB64 = toBase64(raw);
    keyId = `device-${Crypto.randomUUID().slice(0, 8)}`;
    await SecureStore.setItemAsync(KEY_STORE, keyB64);
    await SecureStore.setItemAsync(KEY_ID_STORE, keyId);
  }

  cached = { key: fromBase64(keyB64), keyId };
  return cached;
}

export async function getFieldKeyId(): Promise<string> {
  return (await getOrCreateKey()).keyId;
}

export async function encryptText(plaintext: string): Promise<Uint8Array> {
  const { key } = await getOrCreateKey();
  const nonce = await Crypto.getRandomBytesAsync(NONCE_LENGTH);
  const ciphertext = gcm(key, nonce).encrypt(utf8ToBytes(plaintext));
  const out = new Uint8Array(NONCE_LENGTH + ciphertext.length);
  out.set(nonce, 0);
  out.set(ciphertext, NONCE_LENGTH);
  return out;
}

export async function decryptText(data: Uint8Array): Promise<string> {
  const { key } = await getOrCreateKey();
  const nonce = data.slice(0, NONCE_LENGTH);
  const ciphertext = data.slice(NONCE_LENGTH);
  return bytesToUtf8(gcm(key, nonce).decrypt(ciphertext));
}

export async function encryptToBase64(plaintext: string): Promise<string> {
  return toBase64(await encryptText(plaintext));
}

export async function decryptFromBase64(encoded: string): Promise<string> {
  return decryptText(fromBase64(encoded));
}

// ─── base64 (dependency-free; no reliance on atob/btoa polyfills) ────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)] : '=';
    out += i + 2 < bytes.length ? B64[c & 63] : '=';
  }
  return out;
}

export function fromBase64(encoded: string): Uint8Array {
  const clean = encoded.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let outIndex = 0;
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = B64.indexOf(char);
    if (value < 0) throw new Error('invalid base64 input');
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[outIndex++] = (buffer >> bits) & 0xff;
    }
  }
  return out;
}
