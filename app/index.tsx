import { Redirect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { getProfile } from '../src/db/dao/profile';
import { Background } from '../src/ui/Background';

/** No profile yet means onboarding hasn't finished. */
export default function Index() {
  const db = useSQLiteContext();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    getProfile(db).then((p) => setOnboarded(p !== null));
  }, [db]);

  if (onboarded === null) return <Background />;
  return <Redirect href={onboarded ? '/home' : '/onboarding'} />;
}
