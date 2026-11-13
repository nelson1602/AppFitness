/**
 * The prebuilt native-module ABI gate (BUG-052).
 *
 * expo-sqlite 57.0.5 shipped a prebuilt AAR with `libexpo-sqlite.so` for
 * arm64-v8a only; on armeabi-v7a, x86 and x86_64 the app then waited forever at
 * "Cargando contenido". `mobile/scripts/check-native-abis.js` reads the AAR in
 * CI (`npm run verify:native-abis`); this spec keeps that gate honest with a
 * synthetic archive shaped like the broken 57.0.5 AAR and one shaped like
 * 57.0.4, and runs it over the AAR actually installed.
 *
 * The CommonJS script is loaded with `require`, as `web-export-shell.spec.ts`
 * does; the project ships no Node types, so the sliver used here is declared
 * locally.
 */

interface NodeBuffer {
  length: number;
  writeUInt16LE(value: number, offset: number): number;
  writeUInt32LE(value: number, offset: number): number;
  write(text: string, offset: number, encoding: 'utf8'): number;
}

interface NativeAbiChecker {
  CHECKED_MODULES: { packageName: string; library: string }[];
  REQUIRED_ABIS: string[];
  checkModule(
    nodeModules: string,
    module: { packageName: string; library: string },
  ): { aars: string[]; problems: string[] };
  missingAbis(entryNames: string[], library: string): string[];
  zipEntryNames(buffer: NodeBuffer): string[];
}

declare const __dirname: string;
declare function require(id: 'node:buffer'): { Buffer: { alloc(size: number): NodeBuffer } };
declare function require(id: string): NativeAbiChecker;

const { Buffer } = require('node:buffer');
/** `mobile`, forward-slashed so paths read the same on every platform. */
const MOBILE = __dirname
  .replace(/\\/g, '/')
  .replace(/\/src\/shared\/infrastructure\/database$/, '');

const checker = require(`${MOBILE}/scripts/check-native-abis.js`);

const LIBRARY = 'libexpo-sqlite.so';

/**
 * A zip holding only a central directory and its end record — all the gate
 * reads. Local file headers and data are irrelevant to it, so they are omitted.
 */
function centralDirectoryZip(names: string[]): NodeBuffer {
  const entriesSize = names.reduce((sum, name) => sum + 46 + name.length, 0);
  const buffer = Buffer.alloc(entriesSize + 22);
  let offset = 0;
  for (const name of names) {
    buffer.writeUInt32LE(0x02014b50, offset);
    buffer.writeUInt16LE(name.length, offset + 28);
    buffer.write(name, offset + 46, 'utf8');
    offset += 46 + name.length;
  }
  buffer.writeUInt32LE(0x06054b50, offset);
  buffer.writeUInt16LE(names.length, offset + 8);
  buffer.writeUInt16LE(names.length, offset + 10);
  buffer.writeUInt32LE(entriesSize, offset + 12);
  buffer.writeUInt32LE(0, offset + 16);
  return buffer;
}

const COMMON_ENTRIES = ['R.txt', 'AndroidManifest.xml', 'classes.jar', 'jni/'];

describe('check-native-abis (BUG-052)', () => {
  it('requires every ABI the app builds for', () => {
    expect(checker.REQUIRED_ABIS).toEqual(['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64']);
    expect(checker.CHECKED_MODULES).toContainEqual({
      packageName: 'expo-sqlite',
      library: LIBRARY,
    });
  });

  it('flags an AAR shaped like the broken 57.0.5 one (arm64-v8a only)', () => {
    const names = checker.zipEntryNames(
      centralDirectoryZip([...COMMON_ENTRIES, 'jni/arm64-v8a/', `jni/arm64-v8a/${LIBRARY}`]),
    );
    expect(names).toContain(`jni/arm64-v8a/${LIBRARY}`);
    expect(checker.missingAbis(names, LIBRARY)).toEqual(['armeabi-v7a', 'x86', 'x86_64']);
  });

  it('passes an AAR shaped like 57.0.4 (all four ABIs)', () => {
    const names = checker.zipEntryNames(
      centralDirectoryZip([
        ...COMMON_ENTRIES,
        ...checker.REQUIRED_ABIS.map((abi) => `jni/${abi}/${LIBRARY}`),
      ]),
    );
    expect(checker.missingAbis(names, LIBRARY)).toEqual([]);
  });

  it('does not accept a directory entry or another library in place of the library', () => {
    const names = [...checker.REQUIRED_ABIS.map((abi) => `jni/${abi}/`), 'jni/x86/libother.so'];
    expect(checker.missingAbis(names, LIBRARY)).toEqual(checker.REQUIRED_ABIS);
  });

  it('throws on a buffer that is not a zip, so a corrupt AAR fails the gate', () => {
    expect(() => checker.zipEntryNames(Buffer.alloc(64))).toThrow(/not a zip archive/);
  });

  it('passes the expo-sqlite AAR installed in node_modules', () => {
    const result = checker.checkModule(`${MOBILE}/node_modules`, checker.CHECKED_MODULES[0]);
    expect(result.problems).toEqual([]);
  });
});
