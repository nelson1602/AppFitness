/**
 * Native no-op for the Web document head (BUG-016, ADR-P032).
 *
 * `<title>` and `<html lang>` are Web document concepts with no native
 * equivalent — native screens are titled by `Stack.Screen options.title`, which
 * is unchanged and remains the only native mechanism. The Web implementation
 * lives in `document-head.web.tsx`; this file exists so the shared root layout
 * can mount one component on both platforms without a `Platform.OS` branch,
 * and so nothing Web-only is ever bundled into the native app.
 */
export function DocumentHead(_props: { title?: string }) {
  return null;
}
