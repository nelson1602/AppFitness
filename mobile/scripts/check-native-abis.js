'use strict';

/**
 * Prebuilt native-module ABI gate (BUG-052).
 *
 * Expo publishes some modules with a prebuilt Android AAR under
 * `node_modules/<pkg>/local-maven-repo/`, and Gradle links that AAR instead of
 * compiling the module. expo-sqlite 57.0.5 shipped an AAR holding
 * `libexpo-sqlite.so` for arm64-v8a only, so on armeabi-v7a, x86 and x86_64 the
 * library is missing from the app and the app waits forever at
 * "Cargando contenido". Nothing in type-check, Jest or the JS export notices, so
 * this script reads the installed AAR itself.
 *
 *   npm run verify:native-abis
 *
 * The predicates are exported and unit-tested by
 * `mobile/src/shared/infrastructure/database/native-abis.spec.ts`, against a
 * synthetic arm64-only archive and against the AAR actually installed.
 *
 * CommonJS and dependency-free by design: it reads the zip central directory
 * directly, so it needs nothing beyond Node.
 */

const fs = require('node:fs');
const path = require('node:path');

/** Every ABI in `reactNativeArchitectures` (android/gradle.properties). */
const REQUIRED_ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'];

/** Packages whose prebuilt AAR must carry their native library for every ABI. */
const CHECKED_MODULES = [{ packageName: 'expo-sqlite', library: 'libexpo-sqlite.so' }];

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;

/**
 * Names of the entries in a zip archive (an AAR is a zip), read from its
 * central directory. Throws when the buffer is not a readable zip, so a
 * corrupt or truncated AAR fails the gate instead of passing it.
 */
function zipEntryNames(buffer) {
  // The end-of-central-directory record is 22 bytes plus a comment of at most 65535.
  const searchStart = Math.max(0, buffer.length - 22 - 0xffff);
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a zip archive (no end-of-central-directory record)');

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const names = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_ENTRY) {
      throw new Error(`corrupt zip central directory at entry ${index}`);
    }
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    names.push(buffer.toString('utf8', offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}

/** ABIs from `REQUIRED_ABIS` with no `jni/<abi>/<library>` entry. */
function missingAbis(entryNames, library) {
  const present = new Set(entryNames);
  return REQUIRED_ABIS.filter((abi) => !present.has(`jni/${abi}/${library}`));
}

/** Every `*.aar` below a directory (the local maven repo nests by group/version). */
function findAars(directory) {
  if (!fs.existsSync(directory)) return [];
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...findAars(full));
    else if (entry.name.endsWith('.aar')) found.push(full);
  }
  return found.sort();
}

/**
 * Problems for one module: a missing package, an unreadable AAR, or an AAR
 * without the library for some ABI. A package with no prebuilt AAR is built
 * from source for every ABI by Gradle, so it has nothing to check.
 */
function checkModule(nodeModules, { packageName, library }) {
  const packageDir = path.join(nodeModules, packageName);
  if (!fs.existsSync(packageDir)) {
    return { aars: [], problems: [`${packageName} is not installed (run npm ci first)`] };
  }
  const aars = findAars(path.join(packageDir, 'local-maven-repo'));
  const problems = [];
  for (const aar of aars) {
    const label = path.relative(nodeModules, aar).replace(/\\/g, '/');
    try {
      const missing = missingAbis(zipEntryNames(fs.readFileSync(aar)), library);
      if (missing.length > 0) {
        problems.push(`${label} has no ${library} for ${missing.join(', ')}`);
      }
    } catch (error) {
      problems.push(`${label} could not be read: ${error.message}`);
    }
  }
  return { aars, problems };
}

function main(argv) {
  // `npm run` runs from mobile/; a path argument checks another node_modules.
  const nodeModules = path.resolve(argv[2] ?? 'node_modules');
  let failed = false;
  for (const module of CHECKED_MODULES) {
    const { aars, problems } = checkModule(nodeModules, module);
    if (problems.length > 0) {
      failed = true;
      for (const problem of problems) console.error(`check-native-abis: ${problem}`);
    } else if (aars.length === 0) {
      console.log(
        `check-native-abis: ${module.packageName} has no prebuilt AAR (built from source)`,
      );
    } else {
      console.log(
        `check-native-abis: ${module.packageName} prebuilt AAR has ${module.library} for ${REQUIRED_ABIS.join(', ')}`,
      );
    }
  }
  return failed ? 1 : 0;
}

module.exports = {
  CHECKED_MODULES,
  REQUIRED_ABIS,
  checkModule,
  findAars,
  missingAbis,
  zipEntryNames,
};

if (require.main === module) {
  process.exit(main(process.argv));
}
