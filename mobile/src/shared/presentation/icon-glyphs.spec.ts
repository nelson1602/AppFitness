import { ICON_FONT_FAMILY, ICON_GLYPHS } from './icon-glyphs';

/**
 * Glyph-parity contract for the two shipped Material Symbols faces
 * (ADR-P022 Decision 9, ADR-P033).
 *
 * This reads the **actual `.ttf` files the app ships** and resolves each
 * semantic name through the font's own `rlig` ligature table, exactly as the
 * text engine will at runtime. It therefore fails if an asset is replaced, a
 * face loses a glyph, the two faces drift apart, or a name is added to
 * `ICON_GLYPHS` that the fonts cannot render.
 *
 * It deliberately imports **no** glyph or codepoint table from any package: the
 * two files are the whole source of truth, which is the property that makes this
 * delivery mechanism self-contained.
 *
 * What it cannot prove: that a platform's shaping engine applies `rlig`. That is
 * a rendering outcome and needs a real device or browser — recorded as an
 * outstanding gate in ADR-P033, not asserted here.
 */

declare const __dirname: string;

/**
 * The sliver of Node this spec uses. The React Native tsconfig ships no Node
 * types, so it is declared locally — the same idiom as `contrast.spec.ts` and
 * `surface-coverage.spec.ts`, and for the same reason.
 */
interface FontBytes {
  readonly length: number;
  readUInt16BE(offset: number): number;
  readUInt32BE(offset: number): number;
  readInt16BE(offset: number): number;
  toString(encoding: 'ascii', start: number, end: number): string;
}
declare function require(id: 'node:fs'): { readFileSync(p: string): FontBytes };

const fs = require('node:fs');
const FONT_DIR = `${__dirname.replace(/\\/g, '/').replace(/\/src\/shared\/presentation$/, '')}/assets/fonts`;

interface Face {
  resolve(name: string): number | null;
  advance(gid: number): number;
  outlineBytes(gid: number): number;
  ligatureSubtables: number;
}

function openFace(file: string): Face {
  const b: FontBytes = fs.readFileSync(`${FONT_DIR}/${file}`);

  const tables: Record<string, { off: number; len: number }> = {};
  const tableCount = b.readUInt16BE(4);
  for (let i = 0; i < tableCount; i++) {
    const o = 12 + i * 16;
    tables[b.toString('ascii', o, o + 4)] = {
      off: b.readUInt32BE(o + 8),
      len: b.readUInt32BE(o + 12),
    };
  }

  // Unicode -> glyph id, from the best available cmap subtable.
  const cmap = new Map<number, number>();
  {
    const off = tables['cmap'].off;
    const n = b.readUInt16BE(off + 2);
    let best: { so: number; fmt: number } | null = null;
    let bestScore = -1;
    for (let i = 0; i < n; i++) {
      const r = off + 4 + i * 8;
      const pid = b.readUInt16BE(r);
      const eid = b.readUInt16BE(r + 2);
      const so = b.readUInt32BE(r + 4);
      const fmt = b.readUInt16BE(off + so);
      const score =
        pid === 3 && eid === 10 && fmt === 12 ? 3 : pid === 3 && eid === 1 && fmt === 4 ? 2 : -1;
      if (score > bestScore) {
        bestScore = score;
        best = { so, fmt };
      }
    }
    if (!best) throw new Error(`${file}: no usable cmap subtable`);
    const base = off + best.so;
    if (best.fmt === 12) {
      const groups = b.readUInt32BE(base + 12);
      for (let g = 0; g < groups; g++) {
        const o = base + 16 + g * 12;
        const s = b.readUInt32BE(o);
        const e = b.readUInt32BE(o + 4);
        const gi = b.readUInt32BE(o + 8);
        for (let c = s; c <= e; c++) cmap.set(c, gi + (c - s));
      }
    } else {
      const segX2 = b.readUInt16BE(base + 6);
      const endO = base + 14;
      const startO = endO + segX2 + 2;
      const deltaO = startO + segX2;
      const rangeO = deltaO + segX2;
      for (let i = 0; i < segX2 / 2; i++) {
        const end = b.readUInt16BE(endO + i * 2);
        const start = b.readUInt16BE(startO + i * 2);
        const delta = b.readInt16BE(deltaO + i * 2);
        const ro = b.readUInt16BE(rangeO + i * 2);
        if (start === 0xffff) continue;
        for (let c = start; c <= end; c++) {
          let g: number;
          if (ro === 0) g = (c + delta) & 0xffff;
          else {
            const gi = rangeO + i * 2 + ro + (c - start) * 2;
            if (gi + 1 >= b.length) continue;
            g = b.readUInt16BE(gi);
            if (g !== 0) g = (g + delta) & 0xffff;
          }
          if (g) cmap.set(c, g);
        }
      }
    }
  }

  // Ligature subtables, unwrapping LookupType 7 (Extension Substitution) —
  // which is how these faces actually store `rlig`.
  const subtables: number[] = [];
  {
    const gsub = tables['GSUB'].off;
    const listOff = gsub + b.readUInt16BE(gsub + 8);
    const count = b.readUInt16BE(listOff);
    for (let i = 0; i < count; i++) {
      const lo = listOff + b.readUInt16BE(listOff + 2 + i * 2);
      const type = b.readUInt16BE(lo);
      const subCount = b.readUInt16BE(lo + 4);
      for (let j = 0; j < subCount; j++) {
        const st = lo + b.readUInt16BE(lo + 6 + j * 2);
        if (type === 4) subtables.push(st);
        else if (type === 7 && b.readUInt16BE(st) === 1 && b.readUInt16BE(st + 2) === 4) {
          subtables.push(st + b.readUInt32BE(st + 4));
        }
      }
    }
  }

  function coverageIndex(off: number, glyph: number): number | undefined {
    const fmt = b.readUInt16BE(off);
    const n = b.readUInt16BE(off + 2);
    if (fmt === 1) {
      for (let i = 0; i < n; i++) if (b.readUInt16BE(off + 4 + i * 2) === glyph) return i;
      return undefined;
    }
    for (let i = 0; i < n; i++) {
      const r = off + 4 + i * 6;
      const s = b.readUInt16BE(r);
      const e = b.readUInt16BE(r + 2);
      if (glyph >= s && glyph <= e) return b.readUInt16BE(r + 4) + (glyph - s);
    }
    return undefined;
  }

  return {
    ligatureSubtables: subtables.length,
    resolve(name: string): number | null {
      const seq: number[] = [];
      for (const ch of name) {
        const g = cmap.get(ch.codePointAt(0) as number);
        if (g === undefined) return null;
        seq.push(g);
      }
      const [first, ...rest] = seq;
      for (const st of subtables) {
        if (b.readUInt16BE(st) !== 1) continue;
        const ci = coverageIndex(st + b.readUInt16BE(st + 2), first);
        if (ci === undefined || ci >= b.readUInt16BE(st + 4)) continue;
        const setOff = st + b.readUInt16BE(st + 6 + ci * 2);
        const ligCount = b.readUInt16BE(setOff);
        for (let k = 0; k < ligCount; k++) {
          const lig = setOff + b.readUInt16BE(setOff + 2 + k * 2);
          const compCount = b.readUInt16BE(lig + 2);
          if (compCount - 1 !== rest.length) continue;
          let match = true;
          for (let c = 0; c < rest.length; c++) {
            if (b.readUInt16BE(lig + 4 + c * 2) !== rest[c]) {
              match = false;
              break;
            }
          }
          if (match) return b.readUInt16BE(lig);
        }
      }
      return null;
    },
    advance(gid: number): number {
      const numH = b.readUInt16BE(tables['hhea'].off + 34);
      return b.readUInt16BE(tables['hmtx'].off + Math.min(gid, numH - 1) * 4);
    },
    outlineBytes(gid: number): number {
      const longLoca = b.readInt16BE(tables['head'].off + 50) !== 0;
      const loca = tables['loca'].off;
      const s = longLoca ? b.readUInt32BE(loca + gid * 4) : b.readUInt16BE(loca + gid * 2) * 2;
      const e = longLoca
        ? b.readUInt32BE(loca + gid * 4 + 4)
        : b.readUInt16BE(loca + gid * 2 + 2) * 2;
      return Math.max(0, e - s);
    },
  };
}

const outlined = openFace('MaterialSymbolsOutlined-Fill0.ttf');
const filled = openFace('MaterialSymbolsOutlined-Fill1.ttf');
const NAMES = Object.entries(ICON_GLYPHS);

describe('Material Symbols glyph parity', () => {
  it('ships two faces that both carry ligature lookups', () => {
    // Without these the semantic names cannot resolve to glyphs at all.
    expect([outlined.ligatureSubtables > 0, filled.ligatureSubtables > 0]).toEqual([true, true]);
  });

  it('declares one font family per state, and they differ', () => {
    expect(ICON_FONT_FAMILY.outlined).not.toEqual(ICON_FONT_FAMILY.filled);
  });

  it.each(NAMES)('resolves "%s" (%s) in both faces', (_semantic, glyph) => {
    expect([outlined.resolve(glyph) !== null, filled.resolve(glyph) !== null]).toEqual([
      true,
      true,
    ]);
  });

  it.each(NAMES)('gives "%s" (%s) the same advance width in both faces', (_semantic, glyph) => {
    // Unequal advances would shift the label beside the icon when it fills.
    const o = outlined.resolve(glyph) as number;
    const f = filled.resolve(glyph) as number;
    expect(outlined.advance(o)).toEqual(filled.advance(f));
  });

  it.each(NAMES)('gives "%s" (%s) a genuinely different filled outline', (_semantic, glyph) => {
    /**
     * Several Material Symbols are identical in both faces — `restaurant` and
     * `fitness_center` among them. Such a glyph cannot demonstrate the selected
     * state, so while this is a feasibility pilot every mapped name must differ.
     */
    const o = outlined.resolve(glyph) as number;
    const f = filled.resolve(glyph) as number;
    expect(outlined.outlineBytes(o)).not.toEqual(filled.outlineBytes(f));
  });
});
