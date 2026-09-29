import { render, screen } from '@testing-library/react-native';

import { AppIcon } from './app-icon';
import { ICON_FONT_FAMILY, ICON_GLYPHS } from './icon-glyphs';

/**
 * `AppIcon` contract (ADR-P022 Decision 9, ADR-P033 pilot).
 *
 * Covers the two rules the specification states — outlined by default, filled
 * only for a selected state — and the accessibility rule that an icon
 * duplicating adjacent visible text must be hidden from assistive technology
 * rather than announced a second time.
 *
 * Note the `includeHiddenElements` on most queries: by default the testing
 * library resolves queries the way assistive technology sees the tree, and a
 * correctly hidden icon is *invisible* to it. Needing that option is itself
 * evidence the hiding works, so the one test that asserts the hiding does not
 * use it — it proves the default query cannot reach the icon at all.
 */
const hidden = { includeHiddenElements: true } as const;

describe('AppIcon', () => {
  it('renders the outlined face by default', async () => {
    await render(<AppIcon name="nutrition" testID="icon" />);

    expect(screen.getByTestId('icon', hidden)).toHaveStyle({
      fontFamily: ICON_FONT_FAMILY.outlined,
    });
  });

  it('renders the filled face only when selected', async () => {
    await render(<AppIcon name="nutrition" selected testID="icon" />);

    expect(screen.getByTestId('icon', hidden)).toHaveStyle({
      fontFamily: ICON_FONT_FAMILY.filled,
    });
  });

  it('renders the mapped ligature name, not the semantic name', async () => {
    // The font resolves `exercise`; `workout` is the product's word for it.
    await render(<AppIcon name="workout" testID="icon" />);

    expect(screen.getByTestId('icon', hidden)).toHaveTextContent(ICON_GLYPHS.workout);
  });

  it('is unreachable by an accessibility-respecting query when it has no label', async () => {
    await render(<AppIcon name="progress" testID="icon" />);

    // The icon duplicates adjacent visible text, so AT must not reach it.
    expect(screen.queryByTestId('icon')).toBeNull();

    const icon = screen.getByTestId('icon', hidden);
    expect(icon.props.accessible).toBe(false);
    expect(icon.props.accessibilityElementsHidden).toBe(true);
    expect(icon.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('becomes an accessibility element when a caller gives it a label', async () => {
    // For the case the spec allows: an icon carrying meaning no visible text has.
    await render(<AppIcon name="progress" accessibilityLabel="Progress" testID="icon" />);

    expect(screen.getByTestId('icon').props.accessible).toBe(true);
    expect(screen.getByLabelText('Progress')).toBeOnTheScreen();
  });

  it('sizes to the label type ramp by default so it reads at cap height', async () => {
    await render(<AppIcon name="nutrition" testID="icon" />);

    expect(screen.getByTestId('icon', hidden)).toHaveStyle({ fontSize: 14, lineHeight: 14 });
  });

  it('lets a caller override the size, keeping the box square', async () => {
    await render(<AppIcon name="nutrition" size={20} testID="icon" />);

    expect(screen.getByTestId('icon', hidden)).toHaveStyle({ fontSize: 20, lineHeight: 20 });
  });

  it('introduces no colour of its own', async () => {
    /**
     * "Icons inherit the semantic role of their context; they never introduce a
     * colour" (`.ai/08_UI_UX.md` §Icons). Rendering a `Text` with no colour is
     * what lets it take the surrounding label's tone.
     */
    await render(<AppIcon name="nutrition" testID="icon" />);

    const style = screen.getByTestId('icon', hidden).props.style as Record<string, unknown>[];
    const flat: Record<string, unknown> = Object.assign({}, ...style.filter(Boolean));
    expect(flat.color).toBeUndefined();
  });
});
