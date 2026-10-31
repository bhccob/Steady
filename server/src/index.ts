import type { D1Database, ExecutionContext, ExportedHandler, ScheduledController } from '@cloudflare/workers-types';

import { handleAccount } from './account';
import { handle } from './core';
import { d1AccountStore, pruneAccounts } from './d1AccountStore';
import { d1Store, pruneHits } from './d1Store';
import { mailerFor } from './mail';
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
  /** Secret: random; rate limits hash each address with it. */
  RATE_KEY: string;
  /** Secret: Resend API key (sending only) for sign-in emails. */
  RESEND_API_KEY?: string;
  /** Secret: random; keys the email and code hashes. */
  ACCOUNT_KEY?: string;
  /** Secret: random 32 bytes; seals backups. */
  BACKUP_KEY?: string;
  /** Who sign-in emails come from. */
  MAIL_FROM: string;
  /** "log" prints emails instead of sending them; only ever set on the wrangler dev command line. */
  MAIL_MODE?: string;
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname.startsWith('/v1/account')) {
      if (!env.ACCOUNT_KEY || !env.BACKUP_KEY) return new Response(null, { status: 503 }) as never;
      return handleAccount(request as unknown as Request, {
        store: d1AccountStore(env.DB),
        hits: d1Store(env.DB),
        mailer: mailerFor(env),
        now: Date.now(),
        allowedOrigin: env.ALLOWED_ORIGIN,
        ipKey: env.RATE_KEY,
        accountKey: env.ACCOUNT_KEY,
        backupKey: env.BACKUP_KEY,
      }) as never;
    }
    return handle(request as unknown as Request, { store: d1Store(env.DB), now: Date.now(), allowedOrigin: env.ALLOWED_ORIGIN, ipKey: env.RATE_KEY }) as never;
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const now = Date.now();
        const sender = webPushSender({ privateJwk: env.VAPID_PRIVATE_KEY, publicKey: env.VAPID_PUBLIC_KEY, subject: env.VAPID_SUBJECT });
        const result = await runDue({ store: d1Store(env.DB), sender, now });
        await pruneHits(env.DB, now);
        await pruneAccounts(env.DB, now);
        // Counts only: no ids, times or addresses in the logs.
        if (result.sent || result.gone || result.dropped) console.log(JSON.stringify(result));
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
