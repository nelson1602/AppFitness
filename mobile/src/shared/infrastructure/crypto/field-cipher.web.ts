/**
 * Web field cipher — DORMANT / FAIL-SAFE (ADR-P018 Slice 2B2, .ai/05_SECURITY.md).
 *
 * The native field cipher (ADR-P001) derives an AES-256-GCM key that lives ONLY
 * in the hardware-backed SecureStore. Web has no SecureStore backend, so there
 * is no safe place for that key. Rather than degrade the medical-data protection
 * model, every field-encryption operation is disabled on Web and fails
 * deterministically.
 *
 * This adapter intentionally imports nothing: no SecureStore, no crypto, no
 * storage of any kind. It therefore CANNOT:
 *   - read/write a key from SecureStore, localStorage, sessionStorage,
 *     IndexedDB, cookies, files, SQLite, AsyncStorage, or memory;
 *   - generate an ephemeral key;
 *   - return input plaintext or partially decrypted data as a fallback.
 *
 * The thrown error is stable and carries no plaintext, ciphertext, key,
 * identifier, or other sensitive context. Nothing is logged.
 */

const UNSUPPORTED_ON_WEB = 'Field encryption is unsupported on Web';

function unsupportedError(): Error {
  return new Error(UNSUPPORTED_ON_WEB);
}

export function getFieldKeyId(): Promise<string> {
  return Promise.reject(unsupportedError());
}

export function encryptText(plaintext: string): Promise<Uint8Array> {
  return Promise.reject(unsupportedError());
}

export function decryptText(data: Uint8Array): Promise<string> {
  return Promise.reject(unsupportedError());
}

export function encryptToBase64(plaintext: string): Promise<string> {
  return Promise.reject(unsupportedError());
}

export function decryptFromBase64(encoded: string): Promise<string> {
  return Promise.reject(unsupportedError());
}

export function toBase64(bytes: Uint8Array): string {
  throw unsupportedError();
}

export function fromBase64(encoded: string): Uint8Array {
  throw unsupportedError();
}
