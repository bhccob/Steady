import type { SteadyExport } from '../settings/data';
import { packBackup, unpackBackup } from './pack';

// Talks to the account routes on Steady's server (server/src/account.ts). Every call throws an
// AccountError when the server doesn't answer 2xx, so callers can tell "try again" from "refused".

export class AccountError extends Error {
  constructor(
    readonly status: number,
    readonly reason?: string,
  ) {
    super(`account server: ${status}${reason ? ` ${reason}` : ''}`);
    this.name = 'AccountError';
  }
}

export interface SignInResult {
  token: string;
  isNew: boolean;
  hasBackup: boolean;
  savedAt: number | null;
}

export interface AccountStatus {
  /** This device is the one whose backups the server takes. */
  active: boolean;
  savedAt: number | null;
}

export interface AccountApi {
  requestCode(email: string): Promise<void>;
  signIn(email: string, code: string, deviceId: string): Promise<SignInResult>;
  status(token: string): Promise<AccountStatus>;
  getBackup(token: string): Promise<{ savedAt: number; schemaVersion: number; data: SteadyExport } | null>;
  putBackup(token: string, backup: SteadyExport): Promise<void>;
  claim(token: string): Promise<void>;
  signOut(token: string): Promise<void>;
  signOutEverywhere(token: string): Promise<void>;
  deleteAccount(token: string): Promise<void>;
}

export function createAccountApi(baseUrl: string, f: typeof fetch = fetch): AccountApi {
  const call = async (method: string, path: string, token: string | null, body?: unknown): Promise<Response> => {
    const res = await f(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const reason = await res
        .json()
        .then((b: { reason?: unknown }) => (typeof b?.reason === 'string' ? b.reason : undefined))
        .catch(() => undefined);
      throw new AccountError(res.status, reason);
    }
    return res;
  };
  return {
    async requestCode(email) {
      await call('POST', '/v1/account/code', null, { email, consent: true });
    },
    async signIn(email, code, deviceId) {
      return (await call('POST', '/v1/account/session', null, { email, code, deviceId })).json();
    },
    async status(token) {
      return (await call('GET', '/v1/account', token)).json();
    },
    async getBackup(token) {
      try {
        const { savedAt, schemaVersion, gz } = (await (await call('GET', '/v1/account/backup', token)).json()) as { savedAt: number; schemaVersion: number; gz: string };
        return { savedAt, schemaVersion, data: unpackBackup(gz) };
      } catch (e) {
        if (e instanceof AccountError && e.status === 404) return null;
        throw e;
      }
    },
    async putBackup(token, backup) {
      await call('PUT', '/v1/account/backup', token, { schemaVersion: backup.schemaVersion, gz: packBackup(backup) });
    },
    async claim(token) {
      await call('POST', '/v1/account/claim', token);
    },
    async signOut(token) {
      await call('DELETE', '/v1/account/session', token);
    },
    async signOutEverywhere(token) {
      await call('DELETE', '/v1/account/sessions', token);
    },
    async deleteAccount(token) {
      await call('DELETE', '/v1/account', token);
    },
  };
}
