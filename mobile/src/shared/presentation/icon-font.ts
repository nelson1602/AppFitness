/**
 * Native icon-font availability (ADR-P033 pilot).
 *
 * On iOS and Android both faces are linked into the binary at build time by the
 * `expo-font` config plugin (`app.json` → plugins → `expo-font`), which copies
 * them to `app/src/main/assets/fonts` and registers them under `UIAppFonts`.
 * They are therefore available from the first frame: there is nothing to load,
 * no asynchronous state, and no network.
 *
 * This file deliberately contains **no `require()` of the `.ttf` files**. A
 * static require would make Metro bundle each face as an app asset *as well as*
 * the plugin's native copy — measured at ~2.3 MB of pure duplication per build.
 * The Web counterpart (`icon-font.web.ts`) owns that require, because Web has no
 * native linking step and genuinely needs it.
 *
 * The consequence is recorded rather than hidden: because the faces arrive
 * through a config plugin, adding or changing one needs a **native rebuild** and
 * cannot ship as an OTA update.
 */
export function useIconFont(): boolean {
  return true;
}
