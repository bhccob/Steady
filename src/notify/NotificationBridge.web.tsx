import { useEffect } from 'react';

import { setupNotifications } from './port';

/** On the web: sends any reminder changes left over from an offline moment. Renders nothing. */
export function NotificationBridge() {
  useEffect(() => {
    setupNotifications().catch(() => {});
  }, []);
  return null;
}
