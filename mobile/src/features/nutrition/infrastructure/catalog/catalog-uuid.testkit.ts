/**
 * TEST-ONLY catalog identity derivation (ADR-P012 Slice 4A).
 *
 * This module is imported ONLY by `*.spec.ts` files — never by runtime code —
 * so the mobile app bundle ships precomputed static ids and carries no UUID
 * derivation at run time (no runtime UUID dependency; see catalog-identity.ts).
 *
 * It implements RFC 4122 v5 (SHA-1) in pure JS (no `crypto` import, no native
 * dependency), so the same algorithm runs in any environment. The API mirrors
 * this using Node's crypto; both are anchored to the SAME golden UUID literals
 * in tests, proving mobile and server derive identical catalog ids.
 */

import {
  NUTRITION_UUID_NAMESPACE,
  normalizeServing,
  revisionOf,
  type CanonicalFood,
} from '../../domain/catalog-identity';
import { CATALOG_VERSION, type FoodItem } from '../../domain/food-catalog';

// ── pure SHA-1 ─────────────────────────────────────────────────────────────

function utf8Bytes(str: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < str.length; i += 1) {
    const c = str.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return out;
}

function hexBytes(hex: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
}

function sha1Bytes(input: readonly number[]): number[] {
  const ml = input.length * 8;
  const msg = [...input, 0x80];
  while (msg.length % 64 !== 56) msg.push(0);
  for (let i = 0; i < 4; i += 1) msg.push(0);
  msg.push((ml >>> 24) & 0xff, (ml >>> 16) & 0xff, (ml >>> 8) & 0xff, ml & 0xff);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const rotl = (n: number, c: number): number => (n << c) | (n >>> (32 - c));

  for (let i = 0; i < msg.length; i += 64) {
    const w = new Array<number>(80);
    for (let j = 0; j < 16; j += 1) {
      w[j] =
        (msg[i + j * 4] << 24) |
        (msg[i + j * 4 + 1] << 16) |
        (msg[i + j * 4 + 2] << 8) |
        msg[i + j * 4 + 3];
    }
    for (let j = 16; j < 80; j += 1) w[j] = rotl(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let j = 0; j < 80; j += 1) {
      let f: number;
      let k: number;
      if (j < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (j < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (j < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const t = (rotl(a, 5) + f + e + k + w[j]) | 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = t;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }

  const out: number[] = [];
  for (const h of [h0, h1, h2, h3, h4]) {
    out.push((h >>> 24) & 0xff, (h >>> 16) & 0xff, (h >>> 8) & 0xff, h & 0xff);
  }
  return out;
}

const toHex = (bytes: readonly number[]): string =>
  bytes.map((x) => x.toString(16).padStart(2, '0')).join('');

/** RFC 4122 v5 (SHA-1) UUID. */
export function uuidv5(name: string, namespace: string): string {
  const ns = hexBytes(namespace.replace(/-/g, ''));
  if (ns.length !== 16) throw new Error(`Invalid UUID namespace: ${namespace}`);
  const bytes = sha1Bytes([...ns, ...utf8Bytes(name)]).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const h = toHex(bytes);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Deterministic food id from stable catalog key + immutable revision. */
export function deriveFoodId(catalogKey: string, foodRevision: number): string {
  return uuidv5(`${catalogKey}:${foodRevision}`, NUTRITION_UUID_NAMESPACE);
}

/** Stable content hash (SHA-1 hex) of a canonical catalog for drift/parity. */
export function canonicalHash(foods: readonly CanonicalFood[]): string {
  return toHex(sha1Bytes(utf8Bytes(stableStringify(foods))));
}

/** Deterministic JSON with sorted object keys. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * Build the canonical catalog from the authored bundle. Deterministic; ids are
 * derived here (test time) and then shipped as static data.
 */
export function buildCanonicalCatalog(catalog: readonly FoodItem[]): CanonicalFood[] {
  return catalog.map((item) => {
    const serving = normalizeServing(item.servingSize);
    const foodRevision = revisionOf(item.id);
    return {
      id: deriveFoodId(item.id, foodRevision),
      catalogKey: item.id,
      foodRevision,
      catalogVersion: CATALOG_VERSION,
      name: item.name,
      category: item.category,
      servingAmount: serving.servingAmount,
      servingUnit: serving.servingUnit,
      gramsPerServing: serving.gramsPerServing,
      caloriesPerServing: item.calories,
      proteinPerServing: item.proteinG,
      carbsPerServing: item.carbsG,
      fatPerServing: item.fatG,
      fiberPerServing: item.fiberG ?? null,
    };
  });
}
