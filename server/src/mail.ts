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
