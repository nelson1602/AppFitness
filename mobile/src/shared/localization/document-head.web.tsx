import { usePathname } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect } from 'react';

import type { TranslationKey } from './resources/en';
import { useLocalization } from './use-localization';

/**
 * The Web document head: a non-empty `<title>` and a `lang` that keeps
 * following the language actually being rendered (BUG-016 F-5/F-6, ADR-P032).
 *
 * **Why `expo-router/head` and not the shell.** `Stack.Screen options.title` is
 * a native header title — React Navigation's document-title integration is
 * switched off in `ExpoRoot` — and a `<title>` written directly into
 * `app/+html.tsx` would lose: the static renderer splices the Helmet head tags
 * in immediately after `<head>`, ahead of anything the shell renders, and a
 * browser takes the *first* `<title>` in the document. Feeding Helmet is
 * therefore the only mechanism that actually reaches the exported title.
 * `expo-router/entry` already mounts `Head.Provider` on the client and the
 * static renderer mounts its own, so no provider is added here.
 *
 * **Titles are per-route only where the product is a Web product.** Under
 * ADR-P018/P019 the shipped Web surface is the account, recovery and
 * verification portals; every other document belongs to a DB-backed feature
 * that renders the honest Web-unavailable state, and takes the product title.
 * No new copy is introduced — the portals reuse the screen-title keys they
 * already render natively.
 *
 * **Accepted static-prerender limitation.** The export is prerendered once, in
 * Node, so the title in the emitted HTML is the English one; the visitor's
 * language is only known in the browser, where Helmet replaces it on hydration.
 * This is the same first-paint limitation as the body copy (BUG-016 F-7),
 * recorded in ADR-P032 rather than papered over with a per-locale prerender the
 * static build cannot produce.
 */
const PORTAL_TITLE_KEYS: Readonly<Record<string, TranslationKey>> = {
  '/forgot-password': 'auth.forgot.screenTitle',
  '/reset-password': 'auth.reset.screenTitle',
  '/verify-email': 'auth.verify.screenTitle',
};

/** The document title for `pathname`, or `undefined` for the product default. */
export function portalTitleKey(pathname: string): TranslationKey | undefined {
  return PORTAL_TITLE_KEYS[pathname];
}

export function DocumentHead({ title }: { title?: string }) {
  const { t, language } = useLocalization();
  const pathname = usePathname();

  const key = portalTitleKey(pathname);
  const resolved = title ?? (key === undefined ? t('web.document.title') : t(key));

  useEffect(() => {
    // The shell's inline script tags the document before the body renders; from
    // hydration onwards the live language owns it, so switching language in the
    // portal retags the document with it.
    if (typeof document === 'undefined' || !document.documentElement) return;
    document.documentElement.lang = language;
  }, [language]);

  return (
    <Head>
      <title>{resolved}</title>
    </Head>
  );
}
