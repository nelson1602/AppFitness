import { darkColors, lightColors, type ColorTokens } from './colors';

/**
 * WCAG 2.2 AA contrast gate for the semantic palette — **ADR-P022 Addendum A**.
 *
 * This is a *measurement*, not a restatement. Nothing here asserts that a token
 * equals a hex value; every expectation recomputes relative luminance from the
 * live `lightColors` / `darkColors` objects and compares the resulting ratio
 * against the threshold the pairing's role demands. Change any token value and
 * the arithmetic changes with it, so a regression fails here with the pairing's
 * name and its measured ratio instead of reaching a user.
 *
 * Method (`.ai/08_UI_UX.md` §Audit method): for each 8-bit channel `c`,
 * `s = c / 255`; `lin = s / 12.92` when `s <= 0.04045`, else
 * `lin = ((s + 0.055) / 1.055) ^ 2.4`; `L = 0.2126·R + 0.7152·G + 0.0722·B`;
 * ratio = `(max(L1, L2) + 0.05) / (min(L1, L2) + 0.05)`.
 *
 * The implementation is deliberately local to this spec: it exists to check the
 * palette, not to be imported by components, and shipping it as runtime code
 * would invite a component to compute colours instead of consuming tokens.
 */

const SRGB_BREAKPOINT = 0.04045;

function channelLuminance(channel: number): number {
  const s = channel / 255;
  return s <= SRGB_BREAKPOINT ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    throw new Error(`Not a six-digit sRGB hex colour: ${hex}`);
  }
  const [r, g, b] = [1, 3, 5].map((i) => channelLuminance(parseInt(hex.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * `text` is WCAG 1.4.3 normal-size text at 4.5:1. The shipped type scale puts
 * `body` (16/400), `label` (14/500) and `caption` (12/400) here — 14px at
 * weight 500 is **not** "14pt bold", so no tone applied at those variants may
 * claim the 3:1 large-text allowance.
 *
 * `nonText` is 1.4.11 at 3:1, for a boundary or graphical mark that carries
 * meaning. No pairing is gated at the large-text 3:1 allowance: every role
 * below is also rendered at a normal-size variant somewhere, so gating the
 * strictest use is the honest threshold.
 */
type Requirement = 'text' | 'nonText';

const THRESHOLD: Record<Requirement, number> = { text: 4.5, nonText: 3 };

/**
 * `rendered` — the pairing exists on a shipped surface today, named in `where`.
 * `approved` — the addendum approves it and the palette must already satisfy
 * it, but no shipped surface produces it yet. Both are gated identically; the
 * distinction keeps the table honest about what is evidence and what is
 * readiness, so nothing here can be read as a claim that a surface exists.
 */
type Status = 'rendered' | 'approved';

interface Pairing {
  readonly foreground: keyof ColorTokens;
  readonly background: keyof ColorTokens;
  readonly requirement: Requirement;
  readonly status: Status;
  readonly where: string;
}

const PAIRINGS: readonly Pairing[] = [
  // ── Neutral foregrounds ───────────────────────────────────────────────────
  {
    foreground: 'onSurface',
    background: 'surface',
    requirement: 'text',
    status: 'rendered',
    where: 'AppText default tone inside Card',
  },
  {
    foreground: 'onSurface',
    background: 'background',
    requirement: 'text',
    status: 'rendered',
    where: 'AppText default tone directly on Screen',
  },
  {
    foreground: 'onSurface',
    background: 'surfaceVariant',
    requirement: 'text',
    status: 'rendered',
    where: 'AppTextInput / FormField value text on its filled ground',
  },
  {
    foreground: 'onSurfaceVariant',
    background: 'surface',
    requirement: 'text',
    status: 'rendered',
    where: 'AppText tone="muted" inside Card',
  },
  {
    foreground: 'onSurfaceVariant',
    background: 'background',
    requirement: 'text',
    status: 'rendered',
    where: 'AppText tone="muted" directly on Screen',
  },
  {
    foreground: 'onSurfaceVariant',
    background: 'surfaceVariant',
    requirement: 'text',
    status: 'rendered',
    where: 'Banner body copy; placeholder text in every input',
  },
  {
    foreground: 'onBackground',
    background: 'background',
    requirement: 'text',
    status: 'approved',
    where: 'the background role pair; no consumer today (Screen text resolves through onSurface)',
  },

  // ── primary ───────────────────────────────────────────────────────────────
  {
    foreground: 'primary',
    background: 'surface',
    requirement: 'text',
    status: 'rendered',
    where: 'AppText tone="primary" and AppButton text/secondary label inside Card',
  },
  {
    foreground: 'primary',
    background: 'background',
    requirement: 'text',
    status: 'rendered',
    where: 'AppButton variant="text" sitting directly on a Screen ground',
  },
  {
    foreground: 'primary',
    background: 'surfaceVariant',
    requirement: 'text',
    status: 'rendered',
    where: 'Banner info title; AppButton variant="secondary" label; ServingStepper glyph',
  },
  {
    foreground: 'onPrimary',
    background: 'primary',
    requirement: 'text',
    status: 'rendered',
    where: 'filled primary CTA label; all four selected chips; language selector',
  },

  // ── Semantic state foregrounds, on each ground they reach ────────────────
  {
    foreground: 'success',
    background: 'surface',
    requirement: 'text',
    status: 'rendered',
    where: 'AppText tone="success" inside Card',
  },
  {
    foreground: 'success',
    background: 'background',
    requirement: 'text',
    status: 'rendered',
    where: 'AppText tone="success" directly on Screen',
  },
  {
    foreground: 'success',
    background: 'surfaceVariant',
    requirement: 'text',
    status: 'rendered',
    where: 'Banner tone="success" title on its recessed ground',
  },
  {
    foreground: 'warning',
    background: 'surface',
    requirement: 'text',
    status: 'rendered',
    where: 'AppText tone="warning" inside Card (TrainingPlanCard, SyncHint, ExerciseLibrary)',
  },
  {
    foreground: 'warning',
    background: 'background',
    requirement: 'text',
    status: 'rendered',
    where: 'AppText tone="warning" directly on Screen',
  },
  {
    foreground: 'warning',
    background: 'surfaceVariant',
    requirement: 'text',
    status: 'rendered',
    where: 'Banner tone="warning" title — offline and sync-conflict hints',
  },
  {
    foreground: 'error',
    background: 'surface',
    requirement: 'text',
    status: 'rendered',
    where: 'AppText tone="error" inside Card',
  },
  {
    foreground: 'error',
    background: 'background',
    requirement: 'text',
    status: 'rendered',
    where: 'AppText tone="error" directly on Screen',
  },
  {
    foreground: 'error',
    background: 'surfaceVariant',
    requirement: 'text',
    status: 'rendered',
    where: 'Banner tone="error" title; FormField validation caption',
  },
  {
    foreground: 'onError',
    background: 'error',
    requirement: 'text',
    status: 'rendered',
    where: 'AppButton variant="destructive" label and spinner',
  },

  // ── Container fill ────────────────────────────────────────────────────────
  {
    foreground: 'onSurface',
    background: 'primaryContainer',
    requirement: 'text',
    status: 'rendered',
    where: 'WellnessTokenGroup selected chip label',
  },

  // ── Non-text: boundaries and graphical marks ─────────────────────────────
  {
    foreground: 'outline',
    background: 'surface',
    requirement: 'nonText',
    status: 'rendered',
    where: 'input and chip borders over a Card ground',
  },
  {
    foreground: 'outline',
    background: 'background',
    requirement: 'nonText',
    status: 'rendered',
    where: 'input and chip borders over a Screen ground',
  },
  {
    foreground: 'outline',
    background: 'surfaceVariant',
    requirement: 'nonText',
    status: 'rendered',
    where: 'the border of a filled input against its own fill',
  },
  {
    foreground: 'info',
    background: 'surfaceVariant',
    requirement: 'nonText',
    status: 'rendered',
    where: 'Banner tone="info" left border',
  },
  {
    foreground: 'accent',
    background: 'surface',
    requirement: 'text',
    status: 'rendered',
    where:
      'TrendBars latest bar over a Card ground — gated at the stricter text threshold so the addendum can unblock accent for text as well as marks',
  },
  {
    foreground: 'accent',
    background: 'background',
    requirement: 'text',
    status: 'approved',
    where: 'accent mark on a Screen ground — achievements and positive deltas',
  },
  {
    foreground: 'accent',
    background: 'surfaceVariant',
    requirement: 'text',
    status: 'approved',
    where: 'accent mark on a recessed ground',
  },
];

/**
 * Roles with no rendered pairing. Listing them is what makes the coverage test
 * below meaningful: a role may be absent from `PAIRINGS` only by being declared
 * unconsumed here, so adding a consumer without measuring it fails.
 */
const UNCONSUMED_ROLES: readonly (keyof ColorTokens)[] = [
  'primaryContainer', // a ground, measured as the background of its own pairing
  'onPrimaryContainer',
  'secondary',
  'onSecondary',
  'tertiary',
  'onTertiary',
  'onSuccess',
  'onWarning',
  'onInfo',
  'disabled',
  'onDisabled',
  'divider',
];

/**
 * Pairings that are real but carry no contrast requirement, with the exemption
 * cited. Recorded rather than silently omitted, and asserted below to be
 * non-text — an exemption may never be claimed for text.
 */
const EXEMPT: readonly { readonly pairing: string; readonly exemption: string }[] = [
  {
    pairing: 'divider on surface',
    exemption:
      'WCAG 1.4.11 — a purely decorative separator (1.27:1 light / 1.29:1 dark). The exemption holds only while it stays decorative, so color-usage.source.spec.ts forbids divider on the boundary of any Pressable; the one site that did that now uses outline.',
  },
  {
    pairing: 'surfaceVariant fill on surface / background',
    exemption:
      'WCAG 1.4.11 — the component boundary is carried by its outline/primary border, which is gated above; the fill itself identifies nothing on its own.',
  },
  {
    pairing: 'primaryContainer fill on surface',
    exemption:
      'WCAG 1.4.11 — selection is carried by marker glyph, border width and accessibilityState (ADR-P022 Decision 7); the fill is the redundant fourth signal.',
  },
  {
    pairing: 'AppButton / AppTextInput disabled composites',
    exemption:
      'WCAG 1.4.3 and 1.4.11 inactive-control exception. The treatment is opacity, not the disabled/onDisabled roles, which have no consumer.',
  },
];

const THEMES: readonly (readonly [string, ColorTokens])[] = [
  ['light', lightColors],
  ['dark', darkColors],
];

function label(p: Pairing): string {
  return `${p.foreground} on ${p.background}`;
}

describe('WCAG 2.2 relative-luminance implementation', () => {
  // Anchors against externally known ratios, so a broken formula cannot make
  // the palette table pass vacuously.
  it.each([
    ['#000000', '#FFFFFF', 21],
    ['#FFFFFF', '#FFFFFF', 1],
    ['#767676', '#FFFFFF', 4.5422],
    ['#0000FF', '#FFFFFF', 8.5925],
  ])('measures %s on %s at %s:1', (fg, bg, expected) => {
    expect(contrastRatio(fg, bg)).toBeCloseTo(expected, 3);
  });

  it('is symmetric in its two arguments', () => {
    expect(contrastRatio('#0F62B8', '#FFFFFF')).toBeCloseTo(
      contrastRatio('#FFFFFF', '#0F62B8'),
      10,
    );
  });

  it('rejects anything that is not a six-digit sRGB hex colour', () => {
    expect(() => relativeLuminance('#FFF')).toThrow(/six-digit/);
  });
});

describe.each(THEMES)('%s theme palette meets WCAG 2.2 AA', (themeName, colors) => {
  it.each(PAIRINGS.map((p) => [label(p), p] as const))('%s', (_name, pairing) => {
    const required = THRESHOLD[pairing.requirement];
    const ratio = contrastRatio(colors[pairing.foreground], colors[pairing.background]);

    // The failure diff names the pairing, the theme, the measured ratio and the
    // threshold it missed — enough to act on without opening this file.
    expect([
      `${themeName}: ${label(pairing)}`,
      `measured ${ratio.toFixed(3)}:1, requires ${required}:1 (${pairing.requirement})`,
      pairing.where,
      ratio >= required,
    ]).toEqual([
      `${themeName}: ${label(pairing)}`,
      `measured ${ratio.toFixed(3)}:1, requires ${required}:1 (${pairing.requirement})`,
      pairing.where,
      true,
    ]);
  });
});

describe('the gate covers the palette it claims to cover', () => {
  it('measures every semantic role that is not declared unconsumed', () => {
    const measured = new Set<string>();
    for (const p of PAIRINGS) {
      measured.add(p.foreground);
      measured.add(p.background);
    }
    const unmeasured = (Object.keys(lightColors) as (keyof ColorTokens)[])
      .filter((role) => !measured.has(role))
      .filter((role) => !UNCONSUMED_ROLES.includes(role))
      .sort();

    expect(unmeasured).toEqual([]);
  });

  it('declares no role both measured and unconsumed', () => {
    const foregrounds = new Set(PAIRINGS.map((p) => p.foreground));
    expect(UNCONSUMED_ROLES.filter((role) => foregrounds.has(role))).toEqual([]);
  });

  it('keeps light and dark declaring exactly the same role set', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
  });

  it('claims no exemption for a text pairing', () => {
    for (const { pairing, exemption } of EXEMPT) {
      expect([pairing, /1\.4\.11|inactive-control/.test(exemption)]).toEqual([pairing, true]);
    }
  });

  it('has a real table, not an empty one', () => {
    expect(PAIRINGS.filter((p) => p.status === 'rendered').length).toBeGreaterThanOrEqual(25);
  });
});

/**
 * Negative control — proof the gate has teeth.
 *
 * The palette shipped before ADR-P022 Addendum A is replayed through the exact
 * same evaluation. If the gate were vacuous (a tautology, a threshold of zero,
 * an empty table) these would pass too. They must fail, and they must fail on
 * precisely the pairings the addendum set out to close — which is also what
 * makes the "resolved" claim in that addendum checkable rather than asserted.
 */
describe('negative control — the pre-addendum palette fails this gate', () => {
  const PRE_ADDENDUM_LIGHT: ColorTokens = {
    ...lightColors,
    primary: '#208AEF',
    success: '#1B873F',
    warning: '#B26A00',
    accent: '#00A6A6',
  };

  function failures(colors: ColorTokens): string[] {
    return PAIRINGS.filter(
      (p) => contrastRatio(colors[p.foreground], colors[p.background]) < THRESHOLD[p.requirement],
    )
      .map(label)
      .sort();
  }

  it('reports the shipped light palette as clean', () => {
    expect(failures(lightColors)).toEqual([]);
  });

  it('reports the shipped dark palette as clean', () => {
    expect(failures(darkColors)).toEqual([]);
  });

  it('reports every pairing the addendum corrected, and only those', () => {
    expect(failures(PRE_ADDENDUM_LIGHT)).toEqual([
      'accent on background',
      'accent on surface',
      'accent on surfaceVariant',
      'onPrimary on primary',
      'primary on background',
      'primary on surface',
      'primary on surfaceVariant',
      'success on background',
      'success on surfaceVariant',
      'warning on background',
      'warning on surface',
      'warning on surfaceVariant',
    ]);
  });

  it.each([
    ['primary', '#208AEF', 'primary', 'surfaceVariant', 3.119],
    ['onPrimary pair', '#208AEF', 'onPrimary', 'primary', 3.533],
    ['warning', '#B26A00', 'warning', 'surfaceVariant', 3.741],
    ['success', '#1B873F', 'success', 'surfaceVariant', 4.044],
    ['accent', '#00A6A6', 'accent', 'surface', 2.998],
  ] as const)(
    'reproduces the recorded pre-addendum ratio for %s',
    (_role, _hex, foreground, background, recorded) => {
      const ratio = contrastRatio(PRE_ADDENDUM_LIGHT[foreground], PRE_ADDENDUM_LIGHT[background]);
      expect(Number(ratio.toFixed(3))).toBe(recorded);
    },
  );

  it('rejects a candidate value that only clears the ratio on plain white', () => {
    // `#A05F00` is the lighter warning candidate `.ai/08_UI_UX.md` proposed. It
    // reaches 5.083:1 on `surface` but only 4.486:1 on `surfaceVariant`, where
    // the warning Banner title actually lives. The candidate table measured
    // `#FFFFFF` only, which is exactly the mistake this gate is here to catch.
    const rejected: ColorTokens = { ...lightColors, warning: '#A05F00' };
    expect(failures(rejected)).toEqual(['warning on surfaceVariant']);
  });
});
