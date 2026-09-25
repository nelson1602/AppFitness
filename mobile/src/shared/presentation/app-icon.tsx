import { Text, type TextProps } from 'react-native';

import { useIconFont } from './icon-font';
import { ICON_FONT_FAMILY, ICON_GLYPHS, type IconName } from './icon-glyphs';

/**
 * Material Symbols icon (ADR-P022 Decision 9, ADR-P033 feasibility pilot).
 *
 * **Outlined by default; filled only for a selected or active state.** The two
 * states are two different font faces, not an axis: the shipped faces are static
 * instances with no `fvar`, so `FILL` cannot be varied at runtime.
 *
 * Renders a `Text` so it inherits the colour of the label it sits beside —
 * "icons inherit the semantic role of their context; they never introduce a
 * colour" (`.ai/08_UI_UX.md` §Icons). `size` defaults to the `label` type ramp's
 * 14px so an icon reads at its label's cap height rather than an arbitrary size.
 *
 * **Accessibility.** An icon that duplicates adjacent visible text is decorative
 * for assistive technology and must be hidden from it, not announced twice. This
 * component is therefore hidden by default and is exposed only when a caller
 * supplies an `accessibilityLabel` — which is required when an icon carries
 * meaning that no visible text already carries.
 *
 * Where the faces come from is platform-specific and lives in `icon-font` /
 * `icon-font.web`: natively linked by the `expo-font` config plugin, registered
 * from the same local assets on Web.
 */
interface AppIconProps extends Omit<TextProps, 'children'> {
  name: IconName;
  /** Filled face. Reserved for selection / active state (ADR-P022 Decision 9). */
  selected?: boolean;
  /** Matches the `label` type ramp by default so the icon reads at cap height. */
  size?: number;
}

export function AppIcon({
  name,
  selected = false,
  size = 14,
  accessibilityLabel,
  style,
  ...props
}: AppIconProps) {
  const ready = useIconFont();

  const decorative = accessibilityLabel === undefined;
  const a11y = decorative
    ? ({
        accessible: false,
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
      } as const)
    : ({ accessible: true, accessibilityLabel } as const);

  return (
    <Text
      {...a11y}
      {...props}
      style={[
        {
          fontFamily: selected ? ICON_FONT_FAMILY.filled : ICON_FONT_FAMILY.outlined,
          fontSize: size,
          lineHeight: size,
        },
        style,
      ]}
    >
      {/*
       * Empty until the face is available. Rendering the ligature name in a
       * fallback face would print the literal word "nutrition" — worse than a
       * blank box, and only reachable on Web, where loading is asynchronous.
       */}
      {ready ? ICON_GLYPHS[name] : ''}
    </Text>
  );
}
