import { en } from './resources/en';
import { es } from './resources/es';

/**
 * The Web document shell, source and artifact (BUG-016, ADR-P032).
 *
 * BUG-016's defects are properties of the **emitted HTML**, so the regression
 * guard has to be too. `mobile/scripts/check-web-export.js` is what reads a real
 * export (`npm run verify:web-export`); this spec keeps that gate honest by
 * running its predicates over markup taken from both real exports — the
 * defective one `.ai/21_BILINGUAL_SURFACE_AUDIT.md` recorded, and the corrected
 * one — and by pinning the copy and the shell source the gate assumes.
 *
 * Reading source rather than importing it, where the thing under test is a file
 * the native jest platform does not resolve, is the established idiom here
 * (`surface-coverage.spec.ts`, `conflict-catalogue.spec.ts`).
 */

interface WebExportChecker {
  FRAMEWORK_NOT_FOUND_COPY: string[];
  NOT_FOUND_EXPECTED_COPY: string[];
  PRERENDER_LANGUAGE: string;
  REQUIRED_DOCUMENTS: string[];
  SITEMAP_AFFORDANCE: string;
  SUPPORTED_LANGUAGES: string[];
  TITLE_EXEMPT_DOCUMENTS: string[];
  checkDocument(name: string, html: string): string[];
  checkExport(
    readDirectory: () => string[],
    readFile: (name: string) => string,
  ): { documents: string[]; problems: string[] };
  checkNotFoundDocument(html: string): string[];
  documentLanguage(html: string): string | null;
  effectiveTitle(html: string): string | null;
  hasPreHydrationLanguageScript(html: string): boolean;
}

/**
 * Node built-ins used only by this Node/Jest test; the React Native tsconfig
 * ships no Node types, so the sliver used here is declared locally.
 */
declare const __dirname: string;
declare function require(id: 'node:fs'): {
  readFileSync(file: string, encoding: 'utf8'): string;
};
declare function require(id: string): WebExportChecker;

const fs = require('node:fs');
/** `mobile/src`, forward-slashed so paths read the same on every platform. */
const SRC = __dirname.replace(/\\/g, '/').replace(/\/shared\/localization$/, '');
const MOBILE = SRC.replace(/\/src$/, '');

const checker = require(`${MOBILE}/scripts/check-web-export.js`);
const readSource = (file: string): string => fs.readFileSync(`${MOBILE}/${file}`, 'utf8');

/**
 * The inline shell script, abbreviated to the two strings the gate keys on but
 * otherwise the shape a real export emits (minified, self-invoking).
 */
const SHELL_SCRIPT =
  "<script>(function n(t,n,l){try{let o=null;try{'undefined'!=typeof localStorage&&" +
  '(o=localStorage.getItem(t))}catch{o=null}' +
  'document.documentElement.lang=o||l}catch{}})("appfitness.language-preference",["en","es"],"en");</script>';

function document_(options: { title: string; script: boolean; body?: string }): string {
  return (
    '<!DOCTYPE html><html  lang="en"><head>' +
    `<title data-rh="true">${options.title}</title>` +
    '<meta charSet="utf-8"/>' +
    (options.script ? SHELL_SCRIPT : '') +
    '</head><body><div id="root">' +
    (options.body ?? '') +
    '</div></body></html>'
  );
}

/** What every document looked like before this slice (audit F-5 … F-7). */
const BASELINE_DOCUMENT = document_({ title: '', script: false });

describe('the gate reads the document the way a browser does', () => {
  it('reads the declared language', () => {
    expect(checker.documentLanguage(BASELINE_DOCUMENT)).toBe('en');
    expect(checker.documentLanguage('<html><head></head><body></body></html>')).toBeNull();
    expect(checker.documentLanguage('not html at all')).toBeNull();
  });

  it('reads the FIRST title, which is the one the browser uses', () => {
    // The static renderer splices Helmet's head tags in ahead of anything the
    // shell renders. A `<title>` added to `+html.tsx` would be second and
    // ignored, which is why titles go through `expo-router/head` instead.
    const twoTitles =
      '<html lang="en"><head><title data-rh="true"></title><title>AppFitness</title></head>' +
      '<body></body></html>';
    expect(checker.effectiveTitle(twoTitles)).toBe('');
    expect(checker.effectiveTitle(document_({ title: 'AppFitness', script: true }))).toBe(
      'AppFitness',
    );
  });

  it('accepts the language script only while it is still inside <head>', () => {
    expect(checker.hasPreHydrationLanguageScript(document_({ title: 'x', script: true }))).toBe(
      true,
    );
    expect(checker.hasPreHydrationLanguageScript(BASELINE_DOCUMENT)).toBe(false);

    // A copy that ended up after </head> could no longer run before the body.
    const tooLate =
      '<html lang="en"><head><title>x</title></head><body>' + SHELL_SCRIPT + '</body></html>';
    expect(checker.hasPreHydrationLanguageScript(tooLate)).toBe(false);
  });
});

describe('the gate fails the export BUG-016 recorded', () => {
  it('names every defect of a baseline document', () => {
    const problems = checker.checkDocument('forgot-password.html', BASELINE_DOCUMENT);

    expect(problems).toEqual([
      'forgot-password.html: the browser-effective <title> is empty',
      'forgot-password.html: <head> carries no pre-hydration language correction',
    ]);
  });

  it('passes a corrected document', () => {
    expect(
      checker.checkDocument(
        'forgot-password.html',
        document_({ title: en['auth.forgot.screenTitle'], script: true }),
      ),
    ).toEqual([]);
  });

  it('rejects a document prerendered in a language the build cannot know', () => {
    // The export has no visitor: anything but the deterministic fallback would
    // mean the build guessed (ADR-P032 §Decision 2).
    const spanishPrerender = document_({ title: 'x', script: true }).replace(
      'lang="en"',
      'lang="es"',
    );
    expect(checker.checkDocument('forgot-password.html', spanishPrerender)).toEqual([
      'forgot-password.html: prerendered lang is "es", expected "en"',
    ]);
  });

  it('rejects a document with no lang at all', () => {
    const noLang = document_({ title: 'x', script: true }).replace(' lang="en"', '');
    expect(checker.checkDocument('index.html', noLang)).toEqual([
      'index.html: <html> declares no lang',
    ]);
  });
});

describe('the not-found document carries product copy, not framework copy', () => {
  it('passes the shipped screen', () => {
    const body = `${en['notFound.title']} ${en['notFound.body']} ${en['notFound.action']}`;
    expect(checker.checkNotFoundDocument(document_({ title: 'x', script: true, body }))).toEqual(
      [],
    );
  });

  it('fails the framework Unmatched screen it replaces', () => {
    const framework = document_({
      title: 'x',
      script: true,
      body: 'Unmatched Route Page could not be found. Go back <a href="/_sitemap">Sitemap</a>',
    });

    expect(checker.checkNotFoundDocument(framework)).toEqual([
      `+not-found.html: missing product copy "${en['notFound.title']}"`,
      `+not-found.html: missing product copy "${en['notFound.action']}"`,
      '+not-found.html: renders framework copy "Unmatched Route"',
      '+not-found.html: renders framework copy "Page could not be found."',
      '+not-found.html: renders framework copy "Sitemap"',
      '+not-found.html: offers the /_sitemap development affordance',
    ]);
  });

  it('keeps the copy it checks pinned to the catalogues', () => {
    // The gate is dependency-free JS and cannot import the TypeScript
    // catalogues, so this is what stops its copy drifting away from theirs.
    expect(checker.NOT_FOUND_EXPECTED_COPY).toEqual([en['notFound.title'], en['notFound.action']]);
  });
});

describe('the export inventory', () => {
  const corrected = (title: string, body = '') => document_({ title, script: true, body });
  const notFoundBody = `${en['notFound.title']} ${en['notFound.body']} ${en['notFound.action']}`;

  const EXPORT: Readonly<Record<string, string>> = {
    'index.html': corrected(en['web.document.title']),
    'forgot-password.html': corrected(en['auth.forgot.screenTitle']),
    'reset-password.html': corrected(en['auth.reset.screenTitle']),
    'verify-email.html': corrected(en['auth.verify.screenTitle']),
    '+not-found.html': corrected(en['notFound.title'], notFoundBody),
    '_sitemap.html': corrected(''),
  };

  const run = (files: Readonly<Record<string, string>>) =>
    checker.checkExport(
      () => Object.keys(files),
      (name: string) => files[name],
    );

  it('passes a complete export', () => {
    expect(run(EXPORT).problems).toEqual([]);
  });

  it('fails if a recovery or verification document stops being exported', () => {
    for (const route of ['forgot-password.html', 'reset-password.html', 'verify-email.html']) {
      const without = { ...EXPORT };
      delete (without as Record<string, string>)[route];
      expect(run(without).problems).toContain(`missing exported document: ${route}`);
    }
  });

  it('fails if the not-found document stops being exported', () => {
    const without = { ...EXPORT };
    delete (without as Record<string, string>)['+not-found.html'];
    expect(run(without).problems).toContain('missing exported document: +not-found.html');
  });

  it('exempts only `_sitemap` from the title invariant, and only from that one', () => {
    // `_sitemap` is appended by ExpoRoot outside the app's root layout, so the
    // repository has no mount point in it — a recorded residual, not a silent
    // hole: its lang and shell script are still required.
    expect(checker.TITLE_EXEMPT_DOCUMENTS).toEqual(['_sitemap.html']);
    expect(checker.checkDocument('_sitemap.html', corrected(''))).toEqual([]);
    expect(checker.checkDocument('_sitemap.html', BASELINE_DOCUMENT)).toEqual([
      '_sitemap.html: <head> carries no pre-hydration language correction',
    ]);
  });
});

describe('the document shell source', () => {
  const html = readSource('src/app/+html.tsx');

  it('ships the deterministic English fallback the prerender can honestly claim', () => {
    expect(html).toContain('<html lang="en"');
  });

  it('inlines the language correction inside <head>, before the body', () => {
    const script = html.indexOf('DOCUMENT_LANGUAGE_SCRIPT');
    const headEnd = html.indexOf('</head>');
    expect(script).toBeGreaterThan(-1);
    expect(headEnd).toBeGreaterThan(script);
  });

  it('renders no title, because a title written here would never be used', () => {
    // The rendered tree only — the file's own prose explains why, and says
    // `<title>` while doing so.
    const rendered = html.slice(html.indexOf('export default function Root'));
    expect(rendered).not.toContain('<title');
  });

  it('duplicates no portal copy into the shell', () => {
    for (const key of ['auth.forgot.title', 'auth.forgot.submit', 'auth.reset.title'] as const) {
      expect(html).not.toContain(en[key]);
      expect(html).not.toContain(es[key]);
    }
  });

  it('keeps the native document head an inert no-op', () => {
    // Nothing Web-only may reach the mobile app, and `Stack.Screen
    // options.title` stays the only native titling mechanism.
    const native = readSource('src/shared/localization/document-head.tsx');
    expect(native).toContain('return null;');
    expect(native).not.toContain('expo-router/head');
    expect(native).not.toContain('document.');
  });
});
