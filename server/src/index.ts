import type { D1Database, ExecutionContext, ExportedHandler, ScheduledController } from '@cloudflare/workers-types';

import { handle } from './core';
import { d1Store, pruneHits } from './d1Store';
import { runDue } from './send';
import { webPushSender } from './webPush';

export interface Env {
  DB: D1Database;
  /** The Steady web app's address: the only origin allowed to call, and the VAPID subject. */
  ALLOWED_ORIGIN: string;
  VAPID_SUBJECT: string;
  VAPID_PUBLIC_KEY: string;
  /** Secret: the VAPID private key as JWK JSON. */
  VAPID_PRIVATE_KEY: string;
}

const HOUR = 60 * 60 * 1000;

export default {
  async fetch(request, env) {
    return handle(request as unknown as Request, { store: d1Store(env.DB), now: Date.now(), allowedOrigin: env.ALLOWED_ORIGIN }) as never;
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const now = Date.now();
        const sender = webPushSender({ privateJwk: env.VAPID_PRIVATE_KEY, publicKey: env.VAPID_PUBLIC_KEY, subject: env.VAPID_SUBJECT });
        const result = await runDue({ store: d1Store(env.DB), sender, now });
        await pruneHits(env.DB, now - HOUR);
        // Counts only: no ids, times or addresses in the logs.
        if (result.sent || result.gone || result.dropped) console.log(JSON.stringify(result));
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
