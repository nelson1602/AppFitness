import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { TabScreen } from '@/features/shell/presentation/tab-screen';
import { useLocalization } from '@/shared/localization';
import { Banner } from '@/shared/presentation';

import { useDashboardStore } from '../application/dashboard.store';
import { loadHomeData, useHomeData } from '../application/use-home-data';
import {
  CoachCard,
  ComingSoonCard,
  EvaluationCard,
  GoalCard,
  QuickActions,
  TodayTiles,
} from './components/home-cards';

/**
 * Inicio (ADR-P039, docs/design): exactly the prototype's six blocks, in its
 * order — the weekly goal, today's iCoach recommendation, today's training and
 * calories, today's evaluation, the quick actions and "Próximamente". Each
 * shows its empty state when its data does not exist yet.
 *
 * Everything the old dashboard also carried (setup checklist, sync, the email
 * reminder, the full recommendation list, subscription) lives in Perfil →
 * "Cuenta y ajustes" now; nothing was removed.
 */
export function DashboardScreen() {
  const { t } = useLocalization();
  const status = useDashboardStore((s) => s.status);
  const refresh = useDashboardStore((s) => s.refresh);
  const { summary, goalType, evaluationDate, evaluation } = useHomeData();

  // BUG-019: `back` reveals this screen's existing instance instead of
  // remounting it, so a mount-only effect never re-reads. Focus fires on that
  // reveal (and on the first mount), so one effect covers both.
  useFocusEffect(
    useCallback(() => {
      void refresh();
      loadHomeData();
    }, [refresh]),
  );

  // Local database is dormant on Web (ADR-P019): a distinct, non-error
  // informational state — no retry and no fabricated data (ADR-P039 D2).
  if (status === 'web-unavailable') {
    return (
      <TabScreen>
        <Banner title={t('dashboard.webUnavailableTitle')} tone="info">
          {t('dashboard.webUnavailableBody')}
        </Banner>
      </TabScreen>
    );
  }

  return (
    <TabScreen>
      <GoalCard goalType={goalType} summary={summary} />
      <CoachCard evaluationDate={evaluationDate} summary={summary} />
      <TodayTiles summary={summary} />
      <EvaluationCard evaluation={evaluation} />
      <QuickActions />
      <ComingSoonCard />
    </TabScreen>
  );
}
