import {
  FALLBACK_LANGUAGE,
  LANGUAGE_PREFERENCE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
} from './language';

/**
 * Pre-hydration document-language correction for the static Web export
 * (BUG-016 F-5, ADR-P032).
 *
 * `app.json` sets `web.output: "static"`, so every document is prerendered
 * once, in Node, with no visitor attached: the build cannot know which of the
 * two languages a given visitor reads. The shell therefore ships a
 * deterministic `lang="en"` and corrects it **synchronously in `<head>`**,
 * before the body is parsed, so the document is tagged with the language it is
 * about to be read in rather than the language it was built in.
 *
 * What it is allowed to look at is deliberately narrow:
 *
 * - the **non-sensitive UI language preference** already approved for
 *   JS-readable Web storage by ADR-P018 §Decision 2 — the only value this
 *   repository persists in a browser at all; and
 * - the browser's own language list.
 *
 * It reads no token, no session, no credential and no user content, it writes
 * nothing, and it contacts nothing. It only ever assigns one of the two
 * supported language tags.
 */

/**
 * Resolve and apply the document language. Serialized into the document shell
 * with `String()`, so it runs **before the bundle exists** and must stay
 * self-contained by construction: no import, no closure over module scope, and
 * everything it needs arrives as an argument. `web-document-language.spec.ts`
 * evaluates the emitted string in an isolated scope, which is what keeps that
 * true.
 *
 * Mirrors `resolveLanguage()` exactly — explicit supported preference wins,
 * otherwise the first supported browser language, otherwise the deterministic
 * fallback. Every failure mode (storage blocked, storage throwing, no
 * `navigator`, no `document`) resolves to the fallback instead of throwing:
 * this runs on the critical path of first paint on a surface a locked-out user
 * reaches, so it must never be able to block it.
 */
export function correctDocumentLanguage(
  storageKey: string,
  supported: readonly string[],
  fallback: string,
): void {
  try {
    let stored: string | null = null;
    try {
      if (typeof localStorage !== 'undefined' && localStorage !== null) {
        stored = localStorage.getItem(storageKey);
      }
    } catch {
      // Blocked cookies, private mode, or a storage partition that throws on
      // access: indistinguishable from "nothing stored".
      stored = null;
    }

    const candidates: string[] = [];
    if (stored !== null && supported.indexOf(stored) !== -1) {
      candidates.push(stored);
    } else {
      try {
        if (typeof navigator !== 'undefined' && navigator !== null) {
          const list = navigator.languages;
          if (list && list.length > 0) {
            for (let index = 0; index < list.length; index++) candidates.push(list[index]);
          } else if (navigator.language) {
            candidates.push(navigator.language);
          }
        }
      } catch {
        // No navigator, or a hardened one that throws.
      }
    }

    let resolved = fallback;
    for (let index = 0; index < candidates.length; index++) {
      const code = String(candidates[index]).toLowerCase().split(/[-_]/)[0];
      if (supported.indexOf(code) !== -1) {
        resolved = code;
        break;
      }
    }

    if (typeof document !== 'undefined' && document !== null && document.documentElement) {
      document.documentElement.lang = resolved;
    }
  } catch {
    // Never block first paint. The shell keeps the deterministic `lang="en"`.
  }
}

/**
 * The inline `<head>` script the document shell emits, built from the same
 * constants the runtime resolver uses so the two cannot drift.
 *
 * Every argument is a repository-owned constant — no user content, no request
 * data and nothing interpolated from outside this module reaches the emitted
 * source.
 */
export const DOCUMENT_LANGUAGE_SCRIPT = `(${String(correctDocumentLanguage)})(${JSON.stringify(
  LANGUAGE_PREFERENCE_STORAGE_KEY,
)},${JSON.stringify(SUPPORTED_LANGUAGES)},${JSON.stringify(FALLBACK_LANGUAGE)});`;
