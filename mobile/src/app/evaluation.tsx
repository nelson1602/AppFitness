import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router';

import { useSession } from '@/features/authentication';
import { landingRouteFor } from '@/features/authentication/application/access-gate';
import { loadHomeData } from '@/features/dashboard/application/use-home-data';
import { useEvaluationGate } from '@/features/evaluation/application/evaluation-gate.store';
import { EvaluationWizard } from '@/features/evaluation/presentation/EvaluationWizard';
import { useWeeklyPlanStore } from '@/features/weekly-plan/application/weekly-plan.store';
import { useLocalization } from '@/shared/localization';

/**
 * Evaluación física. `?mode=update` is Perfil → "Actualizar evaluación";
 * without it, the first-run step that ends in "Creando tu plan personal".
 */
export default function EvaluationRoute() {
  const { status, session } = useSession();
  const { t } = useLocalization();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const update = mode === 'update';

  if (status === 'unknown') return null;
  if (status !== 'authenticated' || !session) return <Redirect href="/sign-in" />;
  if (landingRouteFor(session.user) !== '/dashboard') return <Redirect href="/verify-pending" />;

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: t('evaluation.step.measures') }} />
      <EvaluationWizard
        mode={update ? 'update' : 'first-run'}
        onExit={update ? () => router.back() : undefined}
        onSaved={() => {
          if (update) {
            // The week's plan never changes by itself (ADR-P042 D3): a changed
            // deciding input raises "¿Actualizar tu plan de esta semana?".
            void useWeeklyPlanStore.getState().checkForChanges();
            loadHomeData();
            router.back();
            return;
          }
          useEvaluationGate.getState().markDone();
          router.replace('/plan-building');
        }}
      />
    </>
  );
}
