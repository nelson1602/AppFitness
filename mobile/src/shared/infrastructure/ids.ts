import * as Crypto from 'expo-crypto';

/**
 * UUIDv4 generation for entity ids and sync operation ids.
 * Cryptographically random (expo-crypto). Entity ids minted here are
 * accepted verbatim by the server (client-generatable UUID PKs — see
 * .ai/15/16 schema design docs); op ids become server-side idempotency
 * keys.
 */
export function generateUuid(): string {
  return Crypto.randomUUID();
}
