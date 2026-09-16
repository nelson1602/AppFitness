import {
  FALLBACK_LANGUAGE,
  LANGUAGE_PREFERENCE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
} from './language';
import { DOCUMENT_LANGUAGE_SCRIPT } from './web-document-language';

/**
 * The pre-hydration document-language correction (BUG-016 F-5, ADR-P032).
 *
 * Everything here runs **the emitted script**, not the TypeScript function it
 * is serialized from, and runs it in an isolated scope built with
 * `new Function`. That is deliberate on two counts:
 *
 *  1. the emitted string is what actually ships into `<head>`, before the
 *     bundle exists — so it is what has to be correct; and
 *  2. evaluating it with its globals shadowed by parameters proves it is
 *     **self-contained**. If a build step ever compiled a helper reference or a
 *     coverage counter into it, the body would throw here rather than fail
 *     silently in a locked-out user's browser.
 */

interface BrowserDouble {
  /** Absent models storage that does not exist (SSR, or a blocked partition). */
  storage?: { getItem(key: string): string | null };
  /** Absent models a runtime with no `navigator` at all. */
  navigator?: { languages?: readonly string[]; language?: string };
}

/** Run the shipped script against a fake browser; answer the resulting `lang`. */
function resolveDocumentLanguage(browser: BrowserDouble): string {
  const documentElement = { lang: 'unset' };
  // The three globals the script reads become parameters, so the script cannot
  // reach anything else — and cannot silently depend on the test environment.
  const run = new Function('localStorage', 'navigator', 'document', DOCUMENT_LANGUAGE_SCRIPT);
  run(browser.storage, browser.navigator, { documentElement });
  return documentElement.lang;
}

/** A storage double holding `value`, or holding nothing when `value` is null. */
function storageHolding(value: string | null) {
  return { getItem: (key: string) => (key === LANGUAGE_PREFERENCE_STORAGE_KEY ? value : null) };
}

const SPANISH_BROWSER = { languages: ['es-MX', 'en-US'] };
const ENGLISH_BROWSER = { languages: ['en-US'] };
const UNSUPPORTED_BROWSER = { languages: ['fr-FR', 'de-DE'] };

describe('the emitted shell script', () => {
  it('is built from the shared constants, not a second copy of them', () => {
    expect(DOCUMENT_LANGUAGE_SCRIPT).toContain(JSON.stringify(LANGUAGE_PREFERENCE_STORAGE_KEY));
    expect(DOCUMENT_LANGUAGE_SCRIPT).toContain(JSON.stringify(SUPPORTED_LANGUAGES));
    expect(DOCUMENT_LANGUAGE_SCRIPT).toContain(JSON.stringify(FALLBACK_LANGUAGE));
  });

  it('reads no token, session or credential, and contacts nothing', () => {
    // ADR-P018 approves exactly one value for JS-readable Web storage. The
    // script must not so much as name anything else.
    expect(DOCUMENT_LANGUAGE_SCRIPT).not.toMatch(/token|session|password|fetch|XMLHttpRequest/i);
    expect(DOCUMENT_LANGUAGE_SCRIPT).not.toMatch(/sessionStorage|indexedDB|cookie/i);
  });

  it('writes only the document language, and persists nothing', () => {
    expect(DOCUMENT_LANGUAGE_SCRIPT).toMatch(/document\.documentElement\.lang\s*=/);
    expect(DOCUMENT_LANGUAGE_SCRIPT).not.toContain('setItem');
    expect(DOCUMENT_LANGUAGE_SCRIPT).not.toContain('removeItem');
  });
});

describe('an explicit stored preference wins', () => {
  it.each([...SUPPORTED_LANGUAGES])('applies the stored "%s" preference', (language) => {
    // The browser disagrees on purpose: an explicit choice is not advisory.
    expect(
      resolveDocumentLanguage({
        storage: storageHolding(language),
        navigator: UNSUPPORTED_BROWSER,
      }),
    ).toBe(language);
  });
});

describe('without a usable stored preference it follows the browser', () => {
  it('treats the "system" preference as "ask the browser"', () => {
    expect(
      resolveDocumentLanguage({ storage: storageHolding('system'), navigator: SPANISH_BROWSER }),
    ).toBe('es');
  });

  it('ignores a stored value the product does not support', () => {
    expect(
      resolveDocumentLanguage({ storage: storageHolding('fr'), navigator: SPANISH_BROWSER }),
    ).toBe('es');
  });

  it('falls through when nothing is stored', () => {
    expect(
      resolveDocumentLanguage({ storage: storageHolding(null), navigator: SPANISH_BROWSER }),
    ).toBe('es');
  });

  it('falls through when storage does not exist at all', () => {
    expect(resolveDocumentLanguage({ navigator: SPANISH_BROWSER })).toBe('es');
  });

  it('falls through when storage throws — blocked cookies, private mode', () => {
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError: storage is disabled');
      },
    };
    expect(resolveDocumentLanguage({ storage: throwing, navigator: SPANISH_BROWSER })).toBe('es');
  });

  it('takes the first supported browser language, not the first language', () => {
    expect(resolveDocumentLanguage({ navigator: { languages: ['fr-FR', 'es-ES', 'en-GB'] } })).toBe(
      'es',
    );
  });

  it('normalizes region and underscore forms', () => {
    expect(resolveDocumentLanguage({ navigator: { languages: ['ES_mx'] } })).toBe('es');
    expect(resolveDocumentLanguage({ navigator: { languages: ['EN-gb'] } })).toBe('en');
  });

  it('reads the singular `navigator.language` when there is no list', () => {
    expect(resolveDocumentLanguage({ navigator: { language: 'es-DO' } })).toBe('es');
  });
});

describe('the deterministic English fallback', () => {
  it('applies when the browser speaks neither language', () => {
    expect(resolveDocumentLanguage({ navigator: UNSUPPORTED_BROWSER })).toBe(FALLBACK_LANGUAGE);
  });

  it('applies when there is no navigator and no storage', () => {
    expect(resolveDocumentLanguage({})).toBe(FALLBACK_LANGUAGE);
  });

  it('applies when navigator reports an empty language list', () => {
    expect(resolveDocumentLanguage({ navigator: { languages: [] } })).toBe(FALLBACK_LANGUAGE);
  });

  it('never leaves the document on a language the product does not ship', () => {
    const resolved = resolveDocumentLanguage({
      storage: storageHolding('de'),
      navigator: UNSUPPORTED_BROWSER,
    });
    expect(SUPPORTED_LANGUAGES).toContain(resolved);
  });

  it('is English, matching the shell fallback the export ships', () => {
    expect(FALLBACK_LANGUAGE).toBe('en');
    expect(resolveDocumentLanguage({ navigator: ENGLISH_BROWSER })).toBe('en');
  });
});
