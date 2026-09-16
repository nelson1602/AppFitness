import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { ReactNode } from 'react';

import { DOCUMENT_LANGUAGE_SCRIPT } from '@/shared/localization/web-document-language';

/**
 * Root HTML document for the static Web export (BUG-016 F-5, ADR-P032).
 *
 * Web-only and build-time only: `expo-router/_ctx.{ios,android}` excludes
 * `+html` from the native context, so nothing here reaches the mobile app. The
 * component body runs in Node during `expo export -p web` and has no DOM.
 *
 * It is the framework template plus exactly one addition — a synchronous
 * `<head>` script that corrects `lang` **before the body is parsed**. Without an
 * owner-authorized per-locale prerender (explicitly out of scope: it multiplies
 * the exported documents and needs a Cloudflare routing decision this slice may
 * not make), a statically prerendered document cannot know its visitor. So the
 * shell ships the deterministic `lang="en"` fallback and the visitor's own
 * browser corrects it. See `web-document-language.ts` for what that script is
 * allowed to read — the ADR-P018 language preference and the browser language
 * list, and nothing else.
 *
 * The prerendered **body** copy stays English (BUG-016 F-7): that is the
 * accepted, recorded first-paint limitation of a single-language static export,
 * not something the shell may fake by duplicating portal copy.
 *
 * `title` is deliberately absent here. The static renderer splices Helmet's
 * head tags in ahead of anything this component renders and a browser takes the
 * first `<title>`, so titles are supplied through `expo-router/head` in
 * `document-head.web.tsx`.
 */
export default function Root({ children }: { children: ReactNode }) {
  // Server-side rendering only: document attributes and head/body nodes the
  // renderer wants carried through.
  const { bodyAttributes, bodyNodes, htmlAttributes, headNodes } = useServerDocumentContext();

  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/*
          Runs before the body: the document is tagged with the language it is
          about to be read in, so a screen reader picks the right voice and the
          browser stops offering to translate Spanish "from English".
        */}
        <script dangerouslySetInnerHTML={{ __html: DOCUMENT_LANGUAGE_SCRIPT }} />

        {/*
          Disable body scrolling on web so ScrollView components behave as they
          do on native.
        */}
        <ScrollViewStyleReset />

        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
