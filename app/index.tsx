import { Redirect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { getProfile } from '../src/db/dao/profile';
import { Background } from '../src/ui/Background';
import { useInstall } from '../src/web/useInstall';

/** On the web, install comes first. Then: no profile yet means onboarding hasn't finished. */
export default function Index() {
  const db = useSQLiteContext();
  const { step } = useInstall();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    getProfile(db).then((p) => setOnboarded(p !== null));
  }, [db]);

  if (step !== 'installed') return <Redirect href="/install" />;
  if (onboarded === null) return <Background />;
  return <Redirect href={onboarded ? '/home' : '/onboarding'} />;
}
