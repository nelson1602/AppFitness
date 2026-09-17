// Native light/dark capture harness — gate 6, `.ai/23_THEME_SURFACE_VERIFICATION.md`.
//
// Drives the INSTALLED app on a connected Android device/emulator with `adb`
// only, and captures each named surface twice: once with the OS in light mode
// and once in dark. It changes nothing in the product — the theme is the OS
// setting (`useTheme()` reads `useColorScheme()`), so each pass sets it with
// `cmd uimode night yes|no`, the same signal a user's system toggle produces,
// and the applied value is read back rather than assumed.
//
// Both captures of a surface are taken at the SAME route and the SAME scroll
// offset: the toggle happens while the surface sits still, so the light and
// dark images of one target differ only by theme. That is what makes them
// comparable evidence rather than two similar screenshots.
//
// It creates no data. Populated surfaces come from `theme-seed.mjs` (public
// sync contract) pulled onto the device by the shipped "Sync now" control.
//
// Usage:
//   node e2e/theme-capture.mjs --out=../.artifacts/theme [--only=progress-trends]
//                              [--serial=emulator-5554] [--settle=2500]
//
// Every target below is reached by its own deep link and then scrolled by a
// fixed number of identical swipes, so a re-run reproduces the same framing.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((pair) => {
    const [key, ...value] = pair.replace(/^--/, '').split('=');
    return [key, value.join('=') || 'true'];
  }),
);

const APP_ID = 'com.appfitness.mobile';
const OUT = path.resolve(args.out ?? '../.artifacts/theme');
const SETTLE = Number(args.settle ?? 2500);
const SERIAL = args.serial ?? null;
const ONLY = args.only ? new Set(args.only.split(',')) : null;

/**
 * Surfaces that only render WITH data, plus the two whose populated rows the
 * first pass could not reach. `scrolls` is the number of identical upward
 * swipes applied after the route settles — tuned once, then fixed.
 */
const TARGETS = [
  { name: 'dashboard-populated', link: '/dashboard', scrolls: 0 },
  { name: 'dashboard-populated-lower', link: '/dashboard', scrolls: 3 },
  { name: 'progress-summary', link: '/progress', scrolls: 0 },
  { name: 'progress-trends', link: '/progress', scrolls: 2 },
  { name: 'progress-weekly', link: '/progress', scrolls: 4 },
  { name: 'routines-plan', link: '/routines', scrolls: 0 },
  { name: 'routines-plan-lower', link: '/routines', scrolls: 2 },
  { name: 'routines-rows', link: '/routines', scrolls: 5 },
  { name: 'workout-log-rows', link: '/workout-log', scrolls: 2 },
  { name: 'exercises-rows', link: '/exercises', scrolls: 2 },
  { name: 'dietary-preferences-rows', link: '/dietary-preferences', scrolls: 2 },
  { name: 'food-log-rows', link: '/food-log', scrolls: 2 },
  { name: 'nutrition-populated', link: '/nutrition', scrolls: 1 },
  { name: 'nutrition-plan-populated', link: '/nutrition-plan', scrolls: 1 },
  { name: 'wellness-profile-populated', link: '/wellness-safety-profile', scrolls: 1 },
  { name: 'sync-conflicts-card', link: '/sync-conflicts', scrolls: 0 },
  { name: 'sync-conflicts-card-lower', link: '/sync-conflicts', scrolls: 2 },
  // Same route, a different staged treatment: run these with `--only` after a
  // choice has been recorded with the loopback dropped (`conflict-offline-
  // choice.yml`), which is what puts the card into `retrying`.
  { name: 'sync-conflicts-retrying', link: '/sync-conflicts', scrolls: 0 },
  { name: 'sync-conflicts-retrying-lower', link: '/sync-conflicts', scrolls: 2 },
];

function adb(adbArgs, options = {}) {
  const full = SERIAL ? ['-s', SERIAL, ...adbArgs] : adbArgs;
  return execFileSync('adb', full, { maxBuffer: 64 * 1024 * 1024, ...options });
}

function sh(command) {
  return adb(['shell', ...command])
    .toString()
    .trim();
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Sets the OS theme and reads it back — the applied value, never an assumption. */
function setNight(on) {
  sh(['cmd', 'uimode', 'night', on ? 'yes' : 'no']);
  const state = sh(['cmd', 'uimode', 'night']);
  const expected = on ? 'yes' : 'no';
  if (!state.toLowerCase().includes(expected)) {
    throw new Error(`uimode night did not apply: wanted ${expected}, read "${state}"`);
  }
  return state;
}

function openLink(link) {
  sh(['am', 'start', '-a', 'android.intent.action.VIEW', '-d', `appfitness://${link}`, APP_ID]);
}

/** One fixed upward swipe; repeated `n` times for a reproducible offset. */
function scroll(n) {
  for (let i = 0; i < n; i += 1) {
    sh(['input', 'swipe', '540', '1700', '540', '700', '400']);
  }
}

function capture(file) {
  const png = adb(['exec-out', 'screencap', '-p']);
  // `exec-out` is binary-safe, but guard anyway: a text-mode mangle turns the
  // PNG header into something unreadable, and a silently corrupt capture is
  // worse than no capture.
  if (png.length < 8 || png[0] !== 0x89 || png[1] !== 0x50) {
    throw new Error(`screencap did not return a PNG for ${path.basename(file)}`);
  }
  fs.writeFileSync(file, png);
  return { bytes: png.length, sha256: createHash('sha256').update(png).digest('hex') };
}

fs.mkdirSync(OUT, { recursive: true });

const device = SERIAL ?? sh(['getprop', 'ro.serialno']);
const release = sh(['getprop', 'ro.build.version.release']);
const sdk = sh(['getprop', 'ro.build.version.sdk']);
console.log(`[theme-capture] device=${device} android=${release} sdk=${sdk} out=${OUT}`);

const inventory = [];

for (const target of TARGETS) {
  if (ONLY && !ONLY.has(target.name)) continue;

  setNight(false);
  openLink(target.link);
  await wait(SETTLE);
  // Re-open: the first intent may only bring a backgrounded process forward.
  openLink(target.link);
  await wait(SETTLE);
  scroll(target.scrolls);
  await wait(1200);

  const lightFile = path.join(OUT, `${target.name}-light.png`);
  const light = capture(lightFile);

  // The surface does not move: only the OS theme changes underneath it.
  const nightState = setNight(true);
  await wait(SETTLE);
  const darkFile = path.join(OUT, `${target.name}-dark.png`);
  const dark = capture(darkFile);
  setNight(false);
  await wait(800);

  inventory.push({
    name: target.name,
    link: target.link,
    scrolls: target.scrolls,
    nightStateRead: nightState,
    light: { file: path.basename(lightFile), ...light },
    dark: { file: path.basename(darkFile), ...dark },
  });
  console.log(
    `[theme-capture] ${target.name} light=${light.bytes}B dark=${dark.bytes}B ` +
      `identical=${light.sha256 === dark.sha256 ? 1 : 0}`,
  );
}

// The inventory MERGES rather than replaces. A `--only` run captures a handful
// of targets — often because a state had to be staged for them — and an
// inventory that listed just those would silently disown every capture taken
// earlier in the same pass. `files` is rebuilt from what is actually on disk,
// so the index always describes the whole directory, not one invocation.
const inventoryPath = path.join(OUT, 'inventory.json');
let previous = { targets: [] };
try {
  previous = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
} catch {
  // No previous inventory: this is the first run into this directory.
}
const merged = new Map((previous.targets ?? []).map((entry) => [entry.name, entry]));
for (const entry of inventory) merged.set(entry.name, entry);

const files = fs
  .readdirSync(OUT)
  .filter((name) => name.endsWith('.png'))
  .sort()
  .map((name) => {
    const bytes = fs.readFileSync(path.join(OUT, name));
    return {
      file: name,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  });

fs.writeFileSync(
  inventoryPath,
  `${JSON.stringify(
    {
      device,
      android: release,
      sdk,
      updatedAt: new Date().toISOString(),
      targets: [...merged.values()].sort((a, b) => a.name.localeCompare(b.name)),
      files,
    },
    null,
    2,
  )}\n`,
);
console.log(`[theme-capture] done targets=${inventory.length} indexed=${files.length}`);
