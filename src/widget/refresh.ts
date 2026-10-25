import type { Db } from '../db/types';
import { handlesButtonsInBackground } from '../notify/platform';

/** The widget's name, as declared in app.json. */
export const WIDGET_NAME = 'Steady';

/**
 * Redraws the home-screen widget after something changed. Does nothing in Expo Go or on iOS,
 * where the widget library's native side doesn't exist; it's loaded only here, lazily.
 */
export async function refreshWidget(db: Db): Promise<void> {
  if (!handlesButtonsInBackground()) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { updateWidgets } = require('./handler') as typeof import('./handler');
    await updateWidgets(db);
  } catch {
    // A widget that can't redraw now redraws on its next scheduled update.
  }
}
