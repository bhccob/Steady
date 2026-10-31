/** A signed-in device: its session token, the email it signed in with, and the last backup time. */
export interface AccountSession {
  token: string;
  email: string;
  savedAt: number | null;
}
