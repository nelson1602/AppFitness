// Web light/dark + responsive capture harness — gate 6,
// `.ai/23_THEME_SURFACE_VERIFICATION.md`.
//
// Captures the three public Web portals — `/forgot-password`,
// `/reset-password`, `/verify-email` (ADR-P032 §Web boundary) — from a LOCAL
// static export, at several viewport widths, in both colour schemes.
//
// It never contacts a hosted environment. It serves `expo export --platform
// web` output from this machine over 127.0.0.1 and drives a local headless
// Chrome/Edge over the DevTools protocol. Node's built-in `WebSocket` and
// `http` are the only transports, so the harness adds no dependency and does
// not touch `package.json` or either lockfile.
//
// Theme is emulated the way a browser reports the OS setting:
// `Emulation.setEmulatedMedia` with `prefers-color-scheme`, which is exactly
// what `useColorScheme()` reads through react-native-web. The harness asserts
// the emulation took effect by evaluating `matchMedia` in the page, rather than
// assuming it — the same discipline the native pass applies to `cmd uimode`.
//
// Build the export first (the API URL is baked in at build time; point it at a
// local API, never a hosted one):
//
//   cd mobile
//   EXPO_PUBLIC_API_URL=http://127.0.0.1:3001 npx expo export --platform web \
//     --output-dir /tmp/webdist
//   node e2e/theme-web-capture.mjs --dist=/tmp/webdist --out=/tmp/web-captures
//
// Flags:
//   --dist=DIR     exported static site (required)
//   --out=DIR      capture output directory (required)
//   --port=8080    local port for the static server
//   --chrome=PATH  browser binary (auto-detected on Windows/macOS/Linux)
//   --settle=1800  ms to wait after load before capturing
//   --self-test    run the path-containment checks and exit; needs no export,
//                  no browser and no network, and ignores every other flag

import { Buffer } from 'node:buffer';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((pair) => {
    const [key, ...value] = pair.replace(/^--/, '').split('=');
    return [key, value.join('=') || 'true'];
  }),
);

// ── Path containment ─────────────────────────────────────────────────────────
// A request must never resolve outside the export directory. `startsWith` is
// not a containment test: it compares characters where the filesystem compares
// path segments, so it also accepts a SIBLING whose name merely begins with the
// same characters — `/srv/webdist-evil` against a root of `/srv/webdist`.
// `path.relative` answers the question that was actually being asked.

/** True when `target` is `root` itself or sits beneath it. */
function isInside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  if (relative === '') return true; // root itself
  // A leading `..` segment escapes upward, and an absolute result means a
  // different root entirely (on Windows, a different drive) — which `..` cannot
  // express. Anything else is a plain descent into `root`.
  if (relative === '..' || relative.startsWith(`..${path.sep}`)) return false;
  return !path.isAbsolute(relative);
}

/**
 * Resolve one request-shaped candidate under `root`, or `null` when it escapes.
 * `path.join` normalizes the `..` segments away first and the predicate then
 * decides, so a candidate that normalizes outside `root` is never opened.
 */
function resolveInside(root, candidate) {
  const file = path.join(root, candidate);
  return isInside(root, file) ? file : null;
}

/**
 * Deterministic containment self-test. It touches no filesystem, no browser,
 * no network and no dependency — it reasons about path strings only, so it
 * returns the same verdict on any machine. The negative controls are the point:
 * the last two assert that the replaced `startsWith` check really does accept
 * paths the predicate above refuses, so this is a control and not a tautology.
 */
function runContainmentSelfTest() {
  const root = path.resolve('/srv/webdist');
  const sibling = path.resolve('/srv/webdist-evil');

  /** `[label, actual, expected]` */
  const checks = [
    // Inside the export — must be servable.
    ['root itself', isInside(root, root), true],
    ['file at the root', isInside(root, path.join(root, 'index.html')), true],
    ['nested file', isInside(root, path.join(root, 'assets', 'app.js')), true],
    ['dot segments that stay inside', isInside(root, path.join(root, 'a', '..', 'b.html')), true],
    ['request for index.html', resolveInside(root, 'index.html') !== null, true],
    ['request for a prerendered route', resolveInside(root, 'forgot-password.html') !== null, true],

    // Outside the export — must be refused.
    ['sibling with a shared prefix', isInside(root, path.join(sibling, 'index.html')), false],
    ['the bare sibling directory', isInside(root, sibling), false],
    ['parent traversal', isInside(root, path.join(root, '..', 'secret.txt')), false],
    ['unrelated absolute path', isInside(root, path.resolve('/etc/passwd')), false],
    ['request that traverses up', resolveInside(root, '../secret.txt'), null],
    ['request that traverses out', resolveInside(root, '../../etc/passwd'), null],
    ['request into the sibling', resolveInside(root, '../webdist-evil/index.html'), null],

    // Negative control: what the replaced predicate would have served.
    ['startsWith accepts the sibling', path.join(sibling, 'index.html').startsWith(root), true],
    ['startsWith accepts the bare sibling', sibling.startsWith(root), true],
  ];
  if (process.platform === 'win32') {
    // A different drive: `path.relative` reports it as absolute, never as `..`.
    checks.push(['a different drive', isInside('C:/srv/webdist', 'D:/srv/webdist/x.html'), false]);
  }

  const failures = checks.filter(([, actual, expected]) => actual !== expected);
  for (const [label, actual, expected] of checks) {
    console.log(`[theme-web] self-test ${actual === expected ? 'ok  ' : 'FAIL'} ${label}`);
  }
  if (failures.length > 0) {
    throw new Error(`path containment self-test failed: ${failures.map(([l]) => l).join(', ')}`);
  }
  console.log(`[theme-web] self-test ok checks=${checks.length}`);
}

if (args['self-test']) {
  runContainmentSelfTest();
  process.exit(0);
}

const DIST = path.resolve(args.dist ?? '');
const OUT = path.resolve(args.out ?? '');
const PORT = Number(args.port ?? 8080);
const SETTLE = Number(args.settle ?? 1800);
if (!args.dist || !args.out) throw new Error('--dist and --out are required');
if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  throw new Error(`${DIST} does not look like an expo web export (no index.html)`);
}

/** The three portals ADR-P032 records as the public V1 Web surface. */
const ROUTES = [
  { name: 'forgot-password', url: '/forgot-password' },
  { name: 'reset-password', url: '/reset-password' },
  { name: 'verify-email', url: '/verify-email' },
];

/**
 * Representative widths: a small phone, a large phone, a tablet and a desktop
 * window. Heights are generous so a short portal form is fully in frame.
 */
const WIDTHS = [
  { name: 'w360', width: 360, height: 800 },
  { name: 'w414', width: 414, height: 896 },
  { name: 'w768', width: 768, height: 1024 },
  { name: 'w1280', width: 1280, height: 900 },
];

const THEMES = ['light', 'dark'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

/** Static server for the export: `/route` resolves to the prerendered `route.html`. */
function serve() {
  const server = http.createServer((req, res) => {
    const requested = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const candidates =
      requested === '/'
        ? ['index.html']
        : [requested.replace(/^\//, ''), `${requested.replace(/^\//, '')}.html`];
    for (const candidate of candidates) {
      // Never serve outside the export directory; each candidate is judged on
      // its own, so one that escapes is skipped rather than ending the search.
      const file = resolveInside(DIST, candidate);
      if (!file) continue;
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        res.writeHead(200, {
          'content-type': MIME[path.extname(file)] ?? 'application/octet-stream',
        });
        fs.createReadStream(file).pipe(res);
        return;
      }
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  });
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

function findBrowser() {
  if (args.chrome) return args.chrome;
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('no Chrome/Edge binary found; pass --chrome=PATH');
  return found;
}

/** Minimal CDP client over Node's built-in WebSocket — no dependency. */
class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      const entry = this.pending.get(message.id);
      if (!entry) return;
      this.pending.delete(message.id);
      if (message.error) entry.reject(new Error(`${entry.method}: ${message.error.message}`));
      else entry.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect(port) {
  for (let i = 0; i < 40; i += 1) {
    try {
      // The PAGE target, not `/json/version`: the browser-level endpoint does
      // not implement `Page.*`, and attaching to it fails with a bare
      // "'Page.enable' wasn't found".
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === 'page');
      if (!page) throw new Error('no page target yet');
      const { webSocketDebuggerUrl } = page;
      const socket = new WebSocket(webSocketDebuggerUrl);
      await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve, { once: true });
        socket.addEventListener('error', reject, { once: true });
      });
      return new Cdp(socket);
    } catch {
      await wait(500);
    }
  }
  throw new Error('could not reach the browser DevTools endpoint');
}

const server = await serve();
fs.mkdirSync(OUT, { recursive: true });

const browser = findBrowser();
const userDataDir = fs.mkdtempSync(path.join(process.env.TEMP ?? '/tmp', 'theme-web-'));
const debugPort = PORT + 1;
const child = execFile(browser, [
  '--headless=new',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${userDataDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  'about:blank',
]);

const cdp = await connect(debugPort);
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');

console.log(`[theme-web] browser=${path.basename(browser)} dist=${DIST} out=${OUT}`);

const inventory = [];
try {
  for (const route of ROUTES) {
    for (const size of WIDTHS) {
      for (const theme of THEMES) {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: size.width,
          height: size.height,
          deviceScaleFactor: 1,
          mobile: size.width < 768,
        });
        await cdp.send('Emulation.setEmulatedMedia', {
          media: 'screen',
          features: [{ name: 'prefers-color-scheme', value: theme }],
        });
        await cdp.send('Page.navigate', {
          url: `http://127.0.0.1:${PORT}${route.url}`,
        });
        await wait(SETTLE);

        // Read the emulation back from inside the page: the capture claims a
        // colour scheme, so the page has to agree it is in one.
        const probe = await cdp.send('Runtime.evaluate', {
          expression:
            "JSON.stringify({dark: matchMedia('(prefers-color-scheme: dark)').matches," +
            'width: innerWidth, bg: getComputedStyle(document.body).backgroundColor,' +
            'lang: document.documentElement.lang})',
          returnByValue: true,
        });
        const state = JSON.parse(probe.result.value);
        if (state.dark !== (theme === 'dark')) {
          throw new Error(`prefers-color-scheme did not apply for ${route.name} ${theme}`);
        }
        if (state.width !== size.width) {
          throw new Error(`viewport width ${state.width} != requested ${size.width}`);
        }

        const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
        const png = Buffer.from(shot.data, 'base64');
        const file = path.join(OUT, `${route.name}-${size.name}-${theme}.png`);
        fs.writeFileSync(file, png);
        inventory.push({
          route: route.url,
          width: size.width,
          theme,
          file: path.basename(file),
          bytes: png.length,
          bodyBackground: state.bg,
          documentLang: state.lang,
          sha256: createHash('sha256').update(png).digest('hex'),
        });
        console.log(
          `[theme-web] ${route.name} ${size.name} ${theme} bytes=${png.length} bg=${state.bg}`,
        );
      }
    }
  }
} finally {
  fs.writeFileSync(
    path.join(OUT, 'inventory.json'),
    `${JSON.stringify({ browser: path.basename(browser), capturedAt: new Date().toISOString(), captures: inventory }, null, 2)}\n`,
  );
  child.kill();
  server.close();
}

console.log(`[theme-web] done captures=${inventory.length}`);
process.exit(0);
