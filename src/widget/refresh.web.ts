import type { Db } from '../db/types';

/** The widget's name, as declared in app.json. */
export const WIDGET_NAME = 'Steady';

/** There is no home-screen widget on the web. */
export async function refreshWidget(db: Db): Promise<void> {
  void db;
}
