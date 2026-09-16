'use strict';

/**
 * Web-export shell gate (BUG-016, ADR-P032).
 *
 * The defects BUG-016 records live in the **emitted HTML**, not in the React
 * tree: a fixed `lang`, an empty `<title>`, and a framework-English not-found
 * screen. Only the exported artifact can prove they are gone, so this script
 * reads the artifact.
 *
 *   npx expo export -p web --output-dir dist
 *   npm run verify:web-export
 *
 * Every predicate is exported and unit-tested against markup taken from real
 * exports — the defective one recorded by `.ai/21_BILINGUAL_SURFACE_AUDIT.md`
 * and the corrected one — by
 * `mobile/src/shared/localization/web-export-shell.spec.ts`, so the gate itself
 * cannot rot into always passing.
 *
 * CommonJS and dependency-free by design: it has to run against a built
 * directory with nothing installed beyond Node.
 */

const fs = require('node:fs');
const path = require('node:path');

/** Languages the product ships; mirrors `SUPPORTED_LANGUAGES`. */
const SUPPORTED_LANGUAGES = ['en', 'es'];

/**
 * The language a statically prerendered document is built in. The export has no
 * visitor, so it cannot be anything else; the shell's inline script corrects it
 * in the browser (ADR-P032 §Decision 2).
 */
const PRERENDER_LANGUAGE = 'en';

/** Documents the shipped public-v1 Web surface must keep exporting. */
const REQUIRED_DOCUMENTS = [
  'forgot-password.html',
  'reset-password.html',
  'verify-email.html',
  '+not-found.html',
];

/**
 * Copy that must appear in the emitted not-found document, and framework copy
 * that must not. Pinned to the catalogues by the spec, which compares these
 * against `en['notFound.*']` rather than trusting the duplication.
 */
const NOT_FOUND_EXPECTED_COPY = ['Page not found', 'Back to AppFitnessRD'];
const FRAMEWORK_NOT_FOUND_COPY = ['Unmatched Route', 'Page could not be found.', 'Sitemap'];

/** The development route enumeration that must not be offered to a visitor. */
const SITEMAP_AFFORDANCE = '/_sitemap';

/**
 * Documents the title invariant deliberately does not cover.
 *
 * `_sitemap` is Expo Router's generated development route enumeration. It is
 * appended by `ExpoRoot` as a sibling of the app's root slot, so it renders
 * **outside** `app/_layout.tsx` and the repository has no mount point in it:
 * `DocumentHead` never runs for it and cannot give it a title. Closing that
 * would mean either disabling `/_sitemap` outright or replacing it with a
 * repository-authored screen — both routing decisions outside BUG-016, so the
 * residual is recorded (ADR-P032 §Consequences) rather than hidden. Its `lang`
 * and pre-hydration script are still checked, because the document shell does
 * reach it.
 */
const TITLE_EXEMPT_DOCUMENTS = ['_sitemap.html'];

/** The `lang` a document actually declares, or `null` when it declares none. */
function documentLanguage(html) {
  const openingTag = /<html\b[^>]*>/i.exec(html);
  if (openingTag === null) return null;
  const lang = /\blang="([^"]*)"/i.exec(openingTag[0]);
  if (lang === null) return null;
  return lang[1];
}

/**
 * The title a browser actually uses: the **first** `<title>` in the document.
 *
 * This is the whole reason titles are fed through `expo-router/head` — the
 * static renderer splices Helmet's head tags in ahead of everything the shell
 * renders, so a `<title>` written into `+html.tsx` would be second and ignored.
 */
function effectiveTitle(html) {
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (title === null) return null;
  return title[1].trim();
}

/**
 * Whether the pre-hydration language correction is present **and** positioned
 * where it can still act: inside `<head>`, so it runs before the body is
 * parsed. A copy that landed after `</head>` would be a silent regression.
 */
function hasPreHydrationLanguageScript(html) {
  const headEnd = html.search(/<\/head>/i);
  if (headEnd === -1) return false;
  const head = html.slice(0, headEnd);
  return (
    head.includes('appfitness.language-preference') &&
    head.includes('document.documentElement.lang')
  );
}

/** Shell invariants every exported document must satisfy. Returns problems. */
function checkDocument(name, html) {
  const problems = [];

  const lang = documentLanguage(html);
  if (lang === null || lang.trim() === '') {
    problems.push(`${name}: <html> declares no lang`);
  } else if (SUPPORTED_LANGUAGES.indexOf(lang) === -1) {
    problems.push(`${name}: <html lang="${lang}"> is not a supported language`);
  } else if (lang !== PRERENDER_LANGUAGE) {
    problems.push(`${name}: prerendered lang is "${lang}", expected "${PRERENDER_LANGUAGE}"`);
  }

  if (TITLE_EXEMPT_DOCUMENTS.indexOf(name) === -1) {
    const title = effectiveTitle(html);
    if (title === null) {
      problems.push(`${name}: document has no <title>`);
    } else if (title === '') {
      problems.push(`${name}: the browser-effective <title> is empty`);
    }
  }

  if (!hasPreHydrationLanguageScript(html)) {
    problems.push(`${name}: <head> carries no pre-hydration language correction`);
  }

  return problems;
}

/** Product invariants for the not-found document specifically. */
function checkNotFoundDocument(html) {
  const problems = [];

  for (const copy of NOT_FOUND_EXPECTED_COPY) {
    if (!html.includes(copy)) problems.push(`+not-found.html: missing product copy "${copy}"`);
  }
  for (const copy of FRAMEWORK_NOT_FOUND_COPY) {
    if (html.includes(copy)) problems.push(`+not-found.html: renders framework copy "${copy}"`);
  }
  if (html.includes(SITEMAP_AFFORDANCE)) {
    problems.push(`+not-found.html: offers the ${SITEMAP_AFFORDANCE} development affordance`);
  }

  return problems;
}

/** Every invariant, over a whole export directory. Returns problems. */
function checkExport(readDirectory, readFile) {
  const documents = readDirectory().filter((entry) => entry.endsWith('.html'));
  const problems = [];

  for (const required of REQUIRED_DOCUMENTS) {
    if (documents.indexOf(required) === -1) problems.push(`missing exported document: ${required}`);
  }

  for (const name of documents) {
    const html = readFile(name);
    problems.push(...checkDocument(name, html));
    if (name === '+not-found.html') problems.push(...checkNotFoundDocument(html));
  }

  return { documents, problems };
}

function main(argv) {
  const directory = argv[2] ?? 'dist';
  if (!fs.existsSync(directory)) {
    console.error(
      `check-web-export: "${directory}" does not exist. Run: npx expo export -p web --output-dir ${directory}`,
    );
    return 1;
  }

  const { documents, problems } = checkExport(
    () => fs.readdirSync(directory),
    (name) => fs.readFileSync(path.join(directory, name), 'utf8'),
  );

  if (problems.length > 0) {
    console.error(
      `check-web-export: ${problems.length} problem(s) in ${documents.length} document(s)`,
    );
    for (const problem of problems) console.error(`  - ${problem}`);
    return 1;
  }

  console.log(`check-web-export: ${documents.length} document(s) pass the shell invariants`);
  return 0;
}

module.exports = {
  FRAMEWORK_NOT_FOUND_COPY,
  NOT_FOUND_EXPECTED_COPY,
  PRERENDER_LANGUAGE,
  REQUIRED_DOCUMENTS,
  SITEMAP_AFFORDANCE,
  SUPPORTED_LANGUAGES,
  TITLE_EXEMPT_DOCUMENTS,
  checkDocument,
  checkExport,
  checkNotFoundDocument,
  documentLanguage,
  effectiveTitle,
  hasPreHydrationLanguageScript,
};

if (require.main === module) {
  process.exit(main(process.argv));
}
