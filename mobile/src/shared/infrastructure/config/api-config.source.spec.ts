/**
 * ADR-P047 D5: every API client imports `API_BASE_URL`; nothing else reads
 * `EXPO_PUBLIC_API_URL`, so the release check cannot be bypassed by a module
 * with its own fallback. Same Node-in-Jest idiom as
 * `shared/presentation/route-targets.source.spec.ts`.
 */
declare const __dirname: string;
declare function require(id: 'node:fs'): {
  readFileSync(file: string, encoding: 'utf8'): string;
  readdirSync(dir: string): string[];
  statSync(path: string): { isDirectory(): boolean };
};

const SRC = `${__dirname}/../../..`;

function sourceFiles(dir: string): string[] {
  const fs = require('node:fs');
  return fs.readdirSync(dir).flatMap((entry: string) => {
    const path = `${dir}/${entry}`;
    if (fs.statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) && !/\.spec\.tsx?$/.test(entry) ? [path] : [];
  });
}

it('only the API config module reads EXPO_PUBLIC_API_URL', () => {
  const fs = require('node:fs');
  const readers = sourceFiles(SRC)
    .filter((file) => fs.readFileSync(file, 'utf8').includes('process.env.EXPO_PUBLIC_API_URL'))
    .map((file) => file.replace(/\\/g, '/').split('/').slice(-3).join('/'));
  expect(readers).toEqual(['infrastructure/config/api-config.ts']);
});
