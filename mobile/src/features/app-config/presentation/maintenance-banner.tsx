import { ScrollView, useWindowDimensions } from 'react-native';

import { useLocalization } from '@/shared/localization';
import { Banner, StageSurfaceProvider } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useAppConfigStore } from '../application/app-config.store';
import type { MaintenanceNotice } from '../domain/app-config';

/** The shell notice never takes more than this share of the window's height. */
export const SHELL_NOTICE_MAX_HEIGHT_RATIO = 0.3;

interface MaintenanceBannerProps {
  /**
   * `shell`: between the tab shell's header and its pages — glass on the stage,
   * with the header's side gutter, scrolling on its own past 30% of the window
   * so a long notice at large text never crowds out the page. `inline`: a plain
   * Banner for a screen that already scrolls (sign-in).
   */
  placement: 'shell' | 'inline';
}

/**
 * The server's maintenance notice (ADR-P049 amendment 1) in the app language,
 * with the server's tone. Not dismissible in this version; renders nothing
 * while there is no notice. Info and warning Banners are not live regions, so
 * the notice is read in place, never announced over what the person is doing.
 */
export function MaintenanceBanner({ placement }: MaintenanceBannerProps) {
  const maintenance = useAppConfigStore((state) => state.config.maintenance);
  if (!maintenance) return null;
  return placement === 'inline' ? (
    <NoticeBanner notice={maintenance} />
  ) : (
    <ShellNotice notice={maintenance} />
  );
}

function NoticeBanner({ notice }: { notice: MaintenanceNotice }) {
  const { language, t } = useLocalization();
  return (
    <Banner title={t('appConfig.maintenance.title')} tone={notice.tone}>
      {notice.message[language]}
    </Banner>
  );
}

/** Mounted only while there is a notice, so a screen without one reads no dimensions. */
function ShellNotice({ notice }: { notice: MaintenanceNotice }) {
  const { spacing } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <StageSurfaceProvider>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.sm, paddingHorizontal: spacing.lg }}
        style={{ flexGrow: 0, maxHeight: Math.round(height * SHELL_NOTICE_MAX_HEIGHT_RATIO) }}
        testID="shell-maintenance-notice"
      >
        <NoticeBanner notice={notice} />
      </ScrollView>
    </StageSurfaceProvider>
  );
}
