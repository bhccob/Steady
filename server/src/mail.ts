// Sends Steady's two emails (sign-in code, new device). Plain text only, and never a word about
// pills, moods or health.

export interface Mailer {
  /** True when the email was handed over for delivery. */
  send(to: string, subject: string, text: string): Promise<boolean>;
}

export function resendMailer(apiKey: string, from: string, f: typeof fetch = fetch): Mailer {
  return {
    async send(to, subject, text) {
      try {
        const res = await f('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from, to, subject, text }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}

/**
 * The mailer for this Worker. `MAIL_MODE = "log"` (only ever set on the `wrangler dev` command
 * line) prints emails for local testing; otherwise Resend sends them. Without a Resend key nothing
 * is sent, so code requests answer 503 instead of pretending.
 */
export function mailerFor(env: { MAIL_MODE?: string; RESEND_API_KEY?: string; MAIL_FROM: string }): Mailer {
  if (env.MAIL_MODE === 'log') {
    return {
      async send(to, subject, text) {
        console.log(`[local email] to ${to}: ${subject}\n${text}`);
        return true;
      },
    };
  }
  if (!env.RESEND_API_KEY) return { send: async () => false };
  return resendMailer(env.RESEND_API_KEY, env.MAIL_FROM);
}
