# FOCUS — current fix list (read this first, nothing else)

**Rule:** read only this file, the prototype line ranges listed below, and the app files you change. Do not re-read the whole codebase or the whole prototype. Do not redesign anything not listed here.

**Design source of truth:** `docs/design/appfitnessrd-prototipo.html`, replaced by the synced copy in this handoff folder. The old repo copy was missing "Semanas anteriores" and the "Se renueva el lunes" chip.

## Prototype map (line numbers in the synced copy)
| What | Lines |
|---|---|
| Colors: HERO_BG, BTN_BG | 180–191 |
| Panel / Bar / Chip styles | 585–612 |
| Animated figure: MOTIONS, motionFor, ExerciseDemo | 894–990 |
| Dashboard background and header | 1217–1233 |
| Inicio tab | 1235–1326 |
| Entrenamientos tab | 1327–1389 |
| Nutrición tab | 1390–1462 |
| Progreso tab | 1463–1514 |
| Perfil tab | 1515–1565 |

## Exact design tokens
- Screen background: `#060A14`, plus a top glow `radial-gradient(120% 70% at 50% 0%, rgba(31,139,240,.55), rgba(11,79,196,.25) 45%, transparent 75%)`, 340 px tall. The rest of the screen stays dark. **No bright-blue full-screen gradient.**
- Header: transparent over the glow. Date `#9FB0C8` at 12.5; title 19 bold.
- Panel: radius 24, border `white/10`, background `white/5`, padding 16; title 16 bold with a `#67E8F9` icon.
- Chips: cyan `#22D3EE`/14% with text `#67E8F9`; orange `#FF7A45`/16% with `#FFA585`; green `#22C55E`/16% with `#86EFAC`; gray `white/10` with `#CBD5E1`.
- Tab bar: floating, inset 12, radius 26, background `#0D1628`/85, border `white/15`.

## Open items (v8.1, PR #245)
1. **Animated figure ("muñeco")** in "Ver cómo se hace": port ExerciseDemo exactly. It is the SVG stick figure with the MOTIONS keyframes (a→b, cosine easing over 2.4 s; bike uses the circular formula), props (bench, seat, box, bike), gradients `dmF`/`dmB`, the radial background, and the numbered cues below.
   - Use react-native-svg + reanimated (already installed).
   - Copy the MOTIONS and motionFor tables verbatim.
   - Reduce motion → a static pose.
   - Never show a motion that doesn't match the exercise (fallback: cues only).
2. **Background and colors:** match the tokens above on all 5 tabs.
3. **Dominican dishes:** everyday dishes dominate the plan (mangú, moro, la bandera, sancocho, locrio, guineítos, yuca, casabe, queso blanco, avena con canela, habichuelas guisadas). Add casabe, queso blanco and canela to the catalogue.
4. **Meal order:** Desayuno, Almuerzo, Merienda, Cena.
5. **15-day slider:** a draggable track between "Plan de 15 días" and "Día N de 15".
6. **Perfil:** evaluation summary chips (Salud, Alimentación, Estilo de vida; no pressure or pulse), "· N entrenamientos por semana" on the Meta line, and the Seguridad panel with the Face ID / Huella toggle.
7. **Update prompt:** the "You changed your country" reason appears even when the country didn't change.
8. **Dev-only button:** "Cargar 4 semanas de ejemplo (desarrollo)" must not appear in release builds; show the guard.
9. **Progreso:** "Plan de la semana" in Entrenamientos gets the "Se renueva el lunes" chip; "Semanas anteriores" follows the synced prototype.

## Already approved — do not touch
Swipe between tabs, the 7-day strip and Serie N, the weight chart and Medidas, language switching, País, the birth-date wheel, sync diagnostics.

## Screenshots
- ES only; EN only where text changed. Side by side with the prototype, one image per screen position, no duplicates.
- Save to `dist/v8.1-review/round-2/`.
- Stop after that: no merge, no build.
