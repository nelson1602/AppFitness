import type { ColorTokens } from '../theme';
import { withAlpha } from './gradient-style';

type StageColors = Pick<
  ColorTokens,
  | 'stage'
  | 'stageDeep'
  | 'stageMid'
  | 'stageTop'
  | 'stageGlow'
  | 'accentCyan'
  | 'accentEnergy'
  | 'ctaStart'
  | 'ctaEnd'
>;

/**
 * The redesign's stage (ADR-P035): the blue glow of the brand art melting into
 * deep navy with no hard edge, plus faint energy and cyan light at the sides.
 * Same four layers as the approved prototype's `BLEND_BG`, built from tokens.
 */
export function stageBackgroundImage(c: StageColors): string {
  return [
    `radial-gradient(120% 55% at 50% 0%, ${c.stageGlow} 0%, ${c.stageTop} 40%, ${withAlpha(c.stageTop, 0)} 72%)`,
    `radial-gradient(60% 35% at 100% 72%, ${withAlpha(c.accentEnergy, 0.2)} 0%, ${withAlpha(c.accentEnergy, 0)} 70%)`,
    `radial-gradient(70% 40% at 0% 88%, ${withAlpha(c.accentCyan, 0.16)} 0%, ${withAlpha(c.accentCyan, 0)} 70%)`,
    `linear-gradient(180deg, ${c.stageTop} 0%, ${c.stageMid} 38%, ${c.stageDeep} 68%, ${c.stage} 100%)`,
  ].join(', ');
}

/** The gradient primary CTA fill (ADR-P035 D3); `ctaStart` is its solid fallback. */
export function ctaBackgroundImage(c: StageColors): string {
  return `linear-gradient(90deg, ${c.ctaStart}, ${c.ctaEnd})`;
}

/**
 * The Inicio goal card's fill (design `HERO_BG`, ADR-P039): the CTA blues at
 * 160°, so its `onCta` text keeps the contrast measured for the CTA pair.
 */
export function goalCardBackgroundImage(c: StageColors): string {
  return `linear-gradient(160deg, ${c.ctaStart} 0%, ${c.ctaEnd} 100%)`;
}
