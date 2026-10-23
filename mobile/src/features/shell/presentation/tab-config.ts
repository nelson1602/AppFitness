import type { TranslationKey } from '@/shared/localization';
import type { IconName } from '@/shared/presentation';

/**
 * The five tabs of the shell (ADR-P039 D1), in design order. `name` is the
 * route file inside `src/app/(tabs)/`; existing URLs (`/dashboard`,
 * `/nutrition`, `/progress`) are unchanged.
 */
export const TABS = [
  { name: 'dashboard', labelKey: 'tabs.home', icon: 'home' },
  { name: 'workouts', labelKey: 'tabs.workouts', icon: 'dumbbell' },
  { name: 'nutrition', labelKey: 'tabs.nutrition', icon: 'food' },
  { name: 'progress', labelKey: 'tabs.progress', icon: 'chart' },
  { name: 'profile', labelKey: 'tabs.profile', icon: 'user' },
] as const satisfies readonly { name: string; labelKey: TranslationKey; icon: IconName }[];

export type TabName = (typeof TABS)[number]['name'];

export function tabOf(name: string): (typeof TABS)[number] | undefined {
  return TABS.find((tab) => tab.name === name);
}
