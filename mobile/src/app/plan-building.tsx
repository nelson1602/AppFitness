import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/authentication';
import { PlanBuildingScreen } from '@/features/evaluation/presentation/PlanBuildingScreen';
import { useLocalization } from '@/shared/localization';

/** "Creando tu plan personal" after the first-run evaluation. */
export default function PlanBuildingRoute() {
  const { status } = useSession();
  const { t } = useLocalization();

  if (status === 'unknown') return null;
  if (status !== 'authenticated') return <Redirect href="/sign-in" />;

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: t('building.titleAccent') }} />
      <PlanBuildingScreen />
    </>
  );
}
